const {PGlite}=await import(process.env.GEODUEL_PGLITE_MODULE??'@electric-sql/pglite');
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const db=new PGlite();
await db.exec(`
 create role anon; create role authenticated; create schema game;
 create table game.questions(
  id text primary key,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,
  media jsonb,provenance jsonb,enabled bool,subject_key text generated always as(provenance->>'subjectKey') stored);
 create table game.rooms(id uuid primary key,status text,created_at timestamptz);
 create table game.participants(room_id uuid,profile_id uuid,primary key(room_id,profile_id));
 create index on game.participants(profile_id);
 create table game.match_questions(room_id uuid,position int,question_id text,primary key(room_id,position));
`);
const load=(name)=>JSON.parse(readFileSync('data/question-pool/'+name+'.json','utf8'));
const cats=['borders','capitals','silhouettes','maps','landmarks','world'];
for(const cat of cats){
 const qs=cat==='capitals'?[...load(cat).filter(q=>!q.id.startsWith('capital-cities-v1-')),...load('retired').filter(q=>q.category==='capitals').map(q=>({...q,enabled:true}))]:load(cat);
 await db.query(`insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
 select id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled
 from jsonb_to_recordset($1::jsonb) as x(id text,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,media jsonb,provenance jsonb,enabled bool)`,[JSON.stringify(qs)]);
}
const migration=(suffix)=>'supabase/migrations/'+readdirSync('supabase/migrations').find(s=>s.endsWith(suffix+'.sql'));
await db.exec(readFileSync(migration('population_selection_helpers'),'utf8'));
await db.exec(readFileSync(migration('regional_round_selection'),'utf8'));
const capitalMigration=readdirSync('supabase/migrations').find(s=>s.endsWith('_capital_distractors.sql'));
if(capitalMigration){
 const sql=readFileSync('supabase/migrations/'+capitalMigration,'utf8');
 await db.exec(sql);
 await db.exec(sql);
 const {rows:[counts]}=await db.query(`select count(*) filter(where enabled)::int as active,count(*) filter(where enabled and id like 'capital-cities-v1-%')::int as new,count(*) filter(where not enabled)::int as retired from game.questions where category='capitals'`);
 if(counts.active!==292||counts.new!==135||counts.retired!==107)throw Error(JSON.stringify(counts));
 const {rows}=await db.query(`select id,category,prompt,options,correct,difficulty,explanation,media,provenance from game.questions where enabled and id like 'capital-cities-v1-%'`);
 const actual=new Map(rows.map(q=>[q.id,q]));
 for(const {enabled,...q} of load('capitals').filter(q=>q.id.startsWith('capital-cities-v1-'))){
  const rec=actual.get(q.id);
  const stable=(v)=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort()):x);
  if(stable(rec)!==stable(q))throw Error('Seed mismatch: '+q.id);
 }
 console.log('CAPITAL MIGRATION PASSED twice; 292 active, 135 new, 107 retired and all data identical.');
}
const num=Number(process.env.SQL_SIM_ROUNDS??1000);
await db.exec(`
 create temp table picks(run int,mode text,position int,subject text,category text,region text,iso text);
 create function pg_temp.sim(mode text,runs int) returns void language plpgsql as $$
 declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); r uuid; opp uuid; category text; chosen text;
 pos int; per int; cats text[];
 begin
 for run in 1..runs loop
  if run%50=1 then a:=gen_random_uuid();b:=gen_random_uuid();end if;
  r:=gen_random_uuid();pos:=0;
  if mode='borders' then cats:=array['borders'];per:=12;
  else
   select array_agg(c) into cats from (select unnest(array['borders','capitals','silhouettes','maps','landmarks','world']) c order by random() limit 4) c;
   per:=2+run%3;
  end if;
  insert into game.rooms values (r,'waiting',clock_timestamp());
  insert into game.participants values(r,a),(r,b);
  foreach category in array cats loop
   for slot in 1..per loop
    chosen:=game.pick_balanced_question(category,(array[1,2,3,2])[1+(slot-1)%4],r);
    if chosen is null then raise exception 'Empty choice in %',category;end if;
    insert into game.match_questions values(r,pos,chosen);
    insert into picks
     select run,mode,pos,q.subject_key,q.category,game.selection_continent(q.provenance->>'iso'),q.provenance->>'iso'
     from game.questions q where q.id=chosen;
    pos:=pos+1;
   end loop;
  end loop;
  update game.rooms set status='completed' where id=r;
  -- Give participant B a distinct most-recent match before the next joint round.
  opp:=gen_random_uuid();
  insert into game.rooms values(opp,'completed',clock_timestamp());
  insert into game.participants values(opp,b);
  insert into game.match_questions values(opp,0,(select q.id from game.questions q where q.enabled and q.category='borders' order by random() limit 1));
 end loop;
 end $$;
`);
await db.exec(`select pg_temp.sim('regular',${num}); select pg_temp.sim('borders',${num});`);
const report={};
for(const [label,query] of Object.entries({
 region:`select mode,category,coalesce(region,'global') as region,count(*)::int as total from picks group by 1,2,3 order by 1,2,3`,
 round:`select mode,africa,count(*)::int as rounds from
   (select mode,run,count(*) filter(where region='Afrika' and category<>'world')::int as africa from picks group by 1,2) r group by 1,2 order by 1,2`,
 repeats:`select a.mode,count(*) filter(where a.subject=b.subject)::int as repeated_subjects,
 count(distinct (a.run,a.position)) filter(where a.region='Afrika' and b.region='Afrika' and a.iso=b.iso)::int as repeated_african_focus
 from picks a join picks b on a.mode=b.mode and a.run=b.run+1 and a.run%50<>1 group by 1 order by 1`,
 duplicateSubjects:`select mode,count(*)::int as groups_with_duplicates from (select mode,run,subject from picks group by 1,2,3 having count(*)>1) t group by 1`,
}))report[label]=(await db.query(query)).rows;
writeFileSync(process.argv[2],JSON.stringify({runsPerMode:num,...report},null,2)+'\n');
await db.close();
