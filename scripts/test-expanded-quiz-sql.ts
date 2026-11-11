import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {flagQuestions} from '../src/flags';

const {PGlite}=await import(process.env.GEODUEL_PGLITE_MODULE??'@electric-sql/pglite');
const db=new PGlite();
const root='supabase/migrations';
const migration=(suffix:string)=>readFileSync(`${root}/${readdirSync(root).find(name=>name.endsWith(suffix+'.sql'))}`,'utf8');
const read=(name:string)=>readFileSync(`${root}/${name}`,'utf8');
function definition(sql:string,name:string){
 const start=sql.toLowerCase().indexOf('create or replace function '+name);
 assert.ok(start>=0,name);
 const body=sql.indexOf('$function$',start);
 assert.ok(body>=0,name);
 return sql.slice(start,sql.indexOf('$function$',body+10)+10)+';';
}
await db.exec(`
create role anon;
create role authenticated;
create schema game;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select current_setting('geo.test_user',true)::uuid
$$;
create function game.throttle(text,int,int) returns boolean language sql as $$ select true $$;
create table game.rooms(
 id uuid primary key,code text,host uuid,status text,per_category int,selected_categories text[],categories text[],
 expires_at timestamptz default now()+interval '30 minutes',created_at timestamptz default now(),
 previous_id uuid,rematch_id uuid,finished_at timestamptz
);
create table game.profiles(id uuid primary key,nickname text);
create table game.participants(room_id uuid,profile_id uuid,ready boolean default false,cursor int default 0,finished boolean default false,
 primary key(room_id,profile_id));
create table public.duel_events(room_id uuid,version int default 0);
create table game.questions(id text primary key,category text,difficulty int,prompt text,options jsonb,correct int,
 explanation text,media jsonb,provenance jsonb,enabled bool,
 subject_key text generated always as(provenance->>'subjectKey') stored);
create table game.match_questions(room_id uuid,position int,question_id text,option_order int[],primary key(room_id,position));
create table game.answers(room_id uuid,profile_id uuid,position int,option_index int,points int,created_at timestamptz);
`);
const oldFlagSchema=readFileSync('scripts/flag-schema.sql','utf8');
const orderedStart=oldFlagSchema.indexOf('create or replace function game.ordered_options');
const orderedEnd=oldFlagSchema.indexOf('revoke all on function game.ordered_options',orderedStart);
await db.exec(oldFlagSchema.slice(orderedStart,orderedEnd));
await db.exec(definition(read('20261110202728_population_balance_activate.sql'),'public.geoduel'));
await db.exec(definition(read('20261110184919_question_pool_v3_support.sql'),'game.snapshot'));
await db.exec(read('20261111123541_duel_review_compare.sql'));
await db.exec(read('20261110201843_population_selection_helpers.sql'));
await db.exec(read('20261111164202_regional_round_selection.sql'));
await db.query(`insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
 select id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled
 from jsonb_to_recordset($1::jsonb) as t(id text,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,media jsonb,provenance jsonb,enabled bool)`,
 [JSON.stringify(flagQuestions)]);
await db.exec(migration('_expanded_quiz_compatibility'));
const seeds=readdirSync(root).filter(name=>name.includes('_expanded_quiz_seed_')).sort();
for(const name of seeds)await db.exec(read(name));
const aggregate=async()=> (await db.query(`select category,count(*)::int as total,count(*) filter(where enabled)::int as active
 from game.questions where id ~ '^(flag-image|city-map|landmark-city|world-compare)-v1-' group by category order by category`)).rows;
assert.deepEqual(await aggregate(),[
 {category:'flags',total:195,active:0},{category:'landmarks',total:42,active:0},
 {category:'maps',total:201,active:0},{category:'world',total:64,active:0},
]);
await db.exec(migration('_expanded_quiz_activate'));
for(const row of await aggregate())assert.equal(row.total,row.active);
const players=['00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020'];
for(const id of players)await db.query('insert into game.profiles values($1,\'QA\')',[id]);
async function action(user:string,kind:string,payload:Record<string,unknown>){
 await db.query("select set_config('geo.test_user',$1,false)",[user]);
 const data=(await db.query('select public.geoduel($1,$2::jsonb) as response',[kind,JSON.stringify(payload)])).rows[0].response;
 assert.ok(!data?.error,data?.error);
 return data;
}
async function room(id:string,category:string,formats:number[]){
 await db.query("insert into game.rooms(id,code,host,status,per_category,selected_categories,categories) values($1,'1234',$2,'waiting',3,array[$3::text],array[]::text[])",[id,players[0],category]);
 await db.query('insert into public.duel_events(room_id) values($1)',[id]);
 for(const [i,user] of players.entries()){
  await db.query('insert into game.participants(room_id,profile_id) values($1,$2)',[id,user]);
  await action(user,'ready',{roomId:id,ready:true,questionFormat:formats[i]});
 }
 return action(players[0],'start',{roomId:id});
}
const legacy='00000000-0000-0000-0000-000000000100';
await room(legacy,'flags',[2,1]);
const legacyPicked=(await db.query('select question_id from game.match_questions where room_id=$1',[legacy])).rows;
assert.equal(legacyPicked.length,3);
assert.ok(legacyPicked.every(q=>!q.question_id.startsWith('flag-image-v1-')));
await db.exec("update game.questions set enabled=false where category='flags' and id not like 'flag-image-v1-%'");
const modern='00000000-0000-0000-0000-000000000200';
const ready=await room(modern,'flags',[2,2]);
assert.match(ready.question.id,/^flag-image-v1-/);
const opponent=await action(players[1],'snapshot',{roomId:modern});
assert.deepEqual(ready.question,opponent.question);
assert.equal(ready.feedback,undefined);
assert.ok(ready.question.options.every((o:string)=>/^\/media\/flags\//.test(o)));
const {rows:[question]}=await db.query(`select qb.correct,mq.option_order from game.match_questions mq
 join game.questions qb on qb.id=mq.question_id where room_id=$1 and position=0`,[modern]);
const correct=question.option_order.indexOf(question.correct);
const solved=await action(players[0],'answer',{roomId:modern,position:0,option:correct});
assert.equal(solved.feedback.points,ready.question.difficulty);
assert.ok(solved.question.options.every((option:string)=>!option.startsWith('/')));
assert.equal((await action(players[1],'snapshot',{roomId:modern})).feedback,undefined);
for(const [index,[category,prefix,resolutionKey]] of [
 ['maps','city-map-v1-','cityLocation'],
 ['landmarks','landmark-city-v1-','cityChoices'],
 ['world','world-compare-v1-','comparison'],
].entries()){
 const id=`00000000-0000-0000-0000-000000000${index+3}00`;
 const started=await room(id,category,[2,2]);
 assert.ok(started.question.id.startsWith(prefix));
 assert.equal(started.feedback,undefined);
 assert.equal(started.question.provenance,undefined);
 assert.ok(!JSON.stringify(started.question.media).includes(resolutionKey));
 const {rows:[stored]}=await db.query(`select qb.correct,mq.option_order,qb.provenance from game.match_questions mq
  join game.questions qb on qb.id=mq.question_id where room_id=$1 and position=0`,[id]);
 const outcome=await action(players[0],'answer',{roomId:id,position:0,option:stored.option_order.indexOf(stored.correct)});
 assert.equal(outcome.feedback.points,started.question.difficulty);
 assert.deepEqual(outcome.feedback.provenance[resolutionKey],stored.provenance[resolutionKey]);
}
await db.close();
console.log('502 immutable seeds, guarded activation, format negotiation, opaque shared flag choices and all four resolutions passed.');
