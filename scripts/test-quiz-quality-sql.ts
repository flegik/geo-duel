import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDuelTestDb,migration} from './duel-sql-fixture';
import {germanyQuestions} from '../src/germanyPool';

const db=await createDuelTestDb();
for(const name of ['expanded_quiz_activate','flexible_duel_counts','germany_support','germany_seed','germany_activate']){
 await db.exec(migration('_'+name));
}
const query=async(sql:string,params:unknown[]=[])=>(await db.query(sql,params)).rows;
const [host,guest]=['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002'];
await query("insert into game.profiles values($1,'QA Host'),($2,'QA Guest')",[host,guest]);
await db.exec("select set_config('game.gateway_verified','true',false)");
async function rpc(user:string,action:string,payload:Record<string,unknown>={}){
 await query("select set_config('geo.test_user',$1,false)",[user]);
 const [{data}]=await query('select public.geoduel($1,$2::jsonb) as data',[action,JSON.stringify(payload)]);
 assert.ok(!data?.error,action+': '+data?.error);
 return data;
}
async function start(questionCounts:Record<string,number>,formats=[4,4]){
 const lobby=await rpc(host,'create',{questionFormat:formats[0],questionCounts});
 const roomId=lobby.id;
 await rpc(guest,'join',{code:lobby.code,questionFormat:formats[1]});
 for(const [index,user] of [host,guest].entries()){
  await rpc(user,'ready',{roomId,ready:true,questionFormat:formats[index]});
 }
 return rpc(host,'start',{roomId});
}
const oldRoom=await start({germany:12},[3,3]);
const saved=await query('select q.id,q.correct,q.difficulty,q.options,m.option_order from game.match_questions m join game.questions q on q.id=m.question_id where m.room_id=$1 order by position',[oldRoom.id]);
await db.exec(migration('_city_map_answer_formats'));
await db.exec(migration('_quiz_quality'));
await db.exec(migration('_retire_specialist_city_maps'));
assert.deepEqual(await query('select q.id,q.correct,q.difficulty,q.options,m.option_order from game.match_questions m join game.questions q on q.id=m.question_id where m.room_id=$1 order by position',[oldRoom.id]),saved);
const enabled=await query("select id from game.questions where category='germany' and enabled order by id");
assert.deepEqual(enabled.map(row=>row.id),germanyQuestions.filter(q=>q.enabled).map(q=>q.id).sort());
assert.equal((await query("select count(*)::int as n from game.questions where enabled and media->>'type'='city-map'"))[0].n,175);
await rpc(host,'leave',{roomId:oldRoom.id});

const germany=await start({germany:12},[4,3]);
assert.equal(germany.total,12);
await rpc(host,'leave',{roomId:germany.id});
// Force the already verified media type in this local database for a deterministic fixture.
await db.exec("update game.questions set enabled=false where category='maps' and media->>'type' is distinct from 'city-map'");
let left=await start({maps:4}), right=await rpc(guest,'snapshot',{roomId:left.id});
const id=left.id;
for(let position=0;position<4;position++){
 const [{options,correct,option_order}]=await query('select q.options,q.correct,m.option_order from game.match_questions m join game.questions q on q.id=m.question_id where m.room_id=$1 and m.position=$2',[id,position]);
 const labels=option_order.map((i:number)=>options[i]);
 const expected=labels.map((name:string)=>'marker:'+createHash('md5').update(name).digest('hex'));
 assert.deepEqual(left.question,right.question);
 assert.deepEqual(left.question.options,expected);
 assert.equal(left.feedback,undefined);
 assert.equal(left.question.provenance,undefined);
 assert.equal(left.question.correct,undefined);
 const correctIndex=option_order.indexOf(correct);
 left=await rpc(host,'answer',{roomId:id,position,option:correctIndex});
 assert.deepEqual(left.question.options,labels);
 assert.equal(left.feedback.points,left.question.difficulty);
 assert.deepEqual((await rpc(guest,'snapshot',{roomId:id})).question.options,expected);
 right=await rpc(guest,'answer',{roomId:id,position,option:(correctIndex+1)%4});
 assert.deepEqual(right.question.options,labels);
 assert.equal(right.feedback.correct,correctIndex);
 assert.equal(right.feedback.points,0);
 left=await rpc(host,'next',{roomId:id,position});
 right=await rpc(guest,'next',{roomId:id,position});
}
assert.equal(right.status,'completed');
const reviews=[await rpc(host,'review',{roomId:id}),await rpc(guest,'review',{roomId:id})];
for(const [index,review] of reviews.entries()){
 for(const row of review){
  assert.equal(row.selected,(row.correct+index)%4);
  assert.equal(row.points,index===0?row.answers.find((a:{profileId:string})=>a.profileId===host).points:0);
 }
}
const sharedReview=(review:Record<string,unknown>[])=>review.map(({selected,points,...shared})=>shared);
assert.deepEqual(sharedReview(reviews[0]),sharedReview(reviews[1]));
assert.ok(reviews[0].every((row:{answers:unknown[];options:string[]})=>
 row.answers.length===2&&row.options.every(v=>!v.startsWith('marker:'))));
const mixed=await start({maps:4},[4,3]);
assert.ok(mixed.question.options.every((option:string)=>option.startsWith('marker:')));
assert.ok((await rpc(guest,'snapshot',{roomId:mixed.id})).question.options.every((option:string)=>!option.startsWith('marker:')));
await db.close();
console.log('PASS: pool rollout, historical match immutability, formats 3/4, markers, reveal, scoring and review');
