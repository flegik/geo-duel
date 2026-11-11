import assert from 'node:assert/strict';
import {createDuelTestDb,migration} from './duel-sql-fixture';
import {questions} from '../src/engine';

const db=await createDuelTestDb();
await db.exec(migration('_expanded_quiz_activate'));
await db.query(`insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
 select id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled
 from jsonb_to_recordset($1::jsonb) as q(id text,category text,difficulty int,prompt text,options jsonb,correct int,
 explanation text,media jsonb,provenance jsonb,enabled bool) on conflict(id) do nothing`,[JSON.stringify(questions)]);
const host='10000000-0000-0000-0000-000000000001',guest='10000000-0000-0000-0000-000000000002';
const players=[host,guest];
for(const [index,id] of players.entries())await db.query('insert into game.profiles values($1,$2)',[id,'QA'+index]);
await db.exec("select set_config('game.gateway_verified','true',false)");
async function request(user:string,action:string,payload:Record<string,unknown>={}){
 await db.query("select set_config('geo.test_user',$1,false)",[user]);
 return (await db.query('select public.geoduel($1,$2::jsonb) as data',[action,JSON.stringify(payload)])).rows[0].data;
}
async function rpc(user:string,action:string,payload:Record<string,unknown>={}){
 const data=await request(user,action,payload);
 assert.ok(!data?.error,`${action}: ${data?.error}`);
 return data;
}
async function room(counts?:Record<string,number>,perCategory=3){
 const created=await rpc(host,'create',counts?{questionCounts:counts}:{perCategory});
 assert.equal((await rpc(guest,'join',{code:created.code})).id,created.id);
 return created;
}
async function ready(id:string,revision?:number){
 for(const user of players)await rpc(user,'ready',{roomId:id,ready:true,questionFormat:2,
  ...(revision===undefined?{}:{configRevision:revision})});
}
async function assigned(id:string){
 return (await db.query(`select m.position,m.option_order,q.id,q.category,q.subject_key,q.difficulty,q.correct from game.match_questions m
 join game.questions q on q.id=m.question_id where m.room_id=$1 order by m.position`,[id])).rows;
}
async function finish(id:string){
 const picks=await assigned(id);
 let points=0;
 for(const q of picks){
  const snapshots=[];
  for(const user of players)snapshots.push(await rpc(user,'snapshot',{roomId:id}));
  assert.deepEqual(snapshots[0].question,snapshots[1].question);
  assert.equal(snapshots[0].feedback,undefined);
  assert.equal(snapshots[1].question.correct,undefined);
  assert.equal(snapshots[1].players.some(p=>'points' in p),false);
  const correct=q.option_order.indexOf(q.correct);
  for(const [index,user] of players.entries()){
   const option=(correct+index)%4;
   const answered=await rpc(user,'answer',{roomId:id,position:q.position,option});
   assert.equal(answered.feedback.correct,correct);
   assert.equal(answered.feedback.points,index===0?q.difficulty:0);
   if(index===0)points+=q.difficulty;
   await rpc(user,'next',{roomId:id,position:q.position});
  }
 }
 const result=await rpc(host,'snapshot',{roomId:id});
 assert.equal(result.status,'completed');
 assert.equal(result.total,picks.length);
 assert.equal(result.result.total,picks.length);
 assert.equal(result.result.players.find(p=>p.id===host).points,points);
 for(const user of players){
  const review=await rpc(user,'review',{roomId:id});
  assert.equal(review.length,picks.length);
  assert.ok(review.every(row=>row.answers.length===2));
 }
 return result;
}

const historical=await room();
await rpc(host,'configure',{roomId:historical.id,categories:['flags'],perCategory:3});
await ready(historical.id);
await rpc(host,'start',{roomId:historical.id});
const before=await assigned(historical.id);
await db.exec(migration('_flexible_duel_counts'));
assert.deepEqual(await assigned(historical.id),before);
const legacy=await finish(historical.id);
assert.equal(legacy.total,3);
assert.equal(legacy.playedCounts,null);

const draft=await room();
const draftId=draft.id;
const config=(questionCounts:unknown,extra={})=>request(host,'configure',{roomId:draftId,questionCounts,...extra});
for(const bad of [null,[],{fish:4},{flags:-1},{flags:'4'},{flags:1.5},{flags:25},{flags:24,maps:1}]){
 assert.ok((await config(bad)).error);
}
assert.ok((await request(guest,'configure',{roomId:draftId,questionCounts:{flags:4}})).error);
assert.deepEqual((await config({flags:0})).questionCounts,{});
assert.match((await request(host,'start',{roomId:draftId})).error,/mindestens 4/);
assert.equal((await config({flags:3})).total,3);
assert.match((await request(guest,'ready',{roomId:draftId,ready:true})).error,/mindestens 4/);
const first=await config({flags:12});
await ready(draftId,first.configRevision);
const unchanged=await config({flags:12,maps:0});
assert.equal(unchanged.configRevision,first.configRevision);
assert.ok(unchanged.players.every(p=>p.ready));
const changed=await config({flags:8,maps:8},{configRevision:first.configRevision});
assert.ok(changed.players.every(p=>!p.ready));
assert.equal(changed.total,16);
assert.deepEqual((await rpc(guest,'snapshot',{roomId:draftId})).questionCounts,{flags:8,maps:8});
assert.ok((await config({flags:4},{configRevision:first.configRevision})).error);
assert.ok((await request(guest,'ready',{roomId:draftId,ready:true,configRevision:first.configRevision})).error);
await rpc(host,'leave',{roomId:draftId});

const cases=[
 {flags:12},{flags:24},{flags:8,maps:8},{flags:10,capitals:6},
 {silhouettes:8,capitals:8},{flags:7,maps:5},{flags:10,maps:6,world:4},
 undefined,{capitals:24},{borders:24},{maps:24},{silhouettes:24},{landmarks:24},{world:24},{flags:4},
 {flags:1,maps:1,capitals:1,silhouettes:1,borders:1,landmarks:1,world:1},
];
for(const [index,counts] of cases.entries()){
 const lobby=await room();
 if(counts)await rpc(host,'configure',{roomId:lobby.id,questionCounts:counts});
 await ready(lobby.id);
 const started=await rpc(host,'start',{roomId:lobby.id});
 const expected=counts??Object.fromEntries(started.categories.map(category=>[category,3]));
 assert.deepEqual(started.playedCounts,expected);
 assert.equal(started.total,Object.values(expected).reduce((sum,n)=>sum+n,0));
 const picks=await assigned(lobby.id);
 const actual:Record<string,number>={};
 for(const q of picks)actual[q.category]=(actual[q.category]??0)+1;
 assert.deepEqual(actual,expected);
 assert.equal(new Set(picks.map(q=>q.subject_key)).size,picks.length);
 if(counts?.flags===12||counts?.flags===24){
  assert.deepEqual([1,2,3].map(d=>picks.filter(q=>q.difficulty===d).length),Array(3).fill(counts.flags/3));
 }
 assert.ok((await request(host,'configure',{roomId:lobby.id,questionCounts:{flags:4}})).error);
 if(index===2||!counts){
  const complete=await finish(lobby.id);
  assert.equal(complete.total,started.total);
  const rematch=await rpc(host,'rematch',{roomId:lobby.id});
  assert.equal((await rpc(guest,'rematch',{roomId:lobby.id})).id,rematch.id);
  assert.deepEqual(rematch.questionCounts,counts??null);
  assert.equal(rematch.total,started.total);
  if(index===2){
   await ready(rematch.id);
   const replay=await rpc(host,'start',{roomId:rematch.id});
   assert.deepEqual(replay.playedCounts,counts);
   const prior=new Set(picks.map(q=>q.subject_key));
   assert.ok((await assigned(rematch.id)).every(q=>!prior.has(q.subject_key)));
  }else await rpc(host,'configure',{roomId:rematch.id,questionCounts:{flags:4}});
  await rpc(host,'leave',{roomId:rematch.id});
 }else await rpc(host,'leave',{roomId:lobby.id});
}

for(const perCategory of [2,4]){
 const lobby=await room(undefined,perCategory);
 await ready(lobby.id);
 const started=await rpc(host,'start',{roomId:lobby.id});
 assert.equal(started.total,perCategory*4);
 assert.equal(new Set(started.categories).size,4);
 assert.deepEqual(Object.values(started.playedCounts),Array(4).fill(perCategory));
 await rpc(host,'leave',{roomId:lobby.id});
}

const insufficient=await room({landmarks:4});
await db.exec("update game.questions set enabled=false where category='landmarks'");
await ready(insufficient.id);
assert.match((await request(host,'start',{roomId:insufficient.id})).error,/nicht genügend unterschiedliche Fragen/);
assert.equal((await rpc(host,'snapshot',{roomId:insufficient.id})).status,'waiting');
assert.deepEqual(await assigned(insufficient.id),[]);
await db.close();
console.log(`${cases.length+2} exact plans, invalid inputs, lobby revisions, historical rooms, scoring, review, rematch and rollback passed.`);
