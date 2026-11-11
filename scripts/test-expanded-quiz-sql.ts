import assert from 'node:assert/strict';
import {createDuelTestDb,migration} from './duel-sql-fixture';

const db=await createDuelTestDb();
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
