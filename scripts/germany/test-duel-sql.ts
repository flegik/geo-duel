import assert from 'node:assert/strict';
import {createDuelTestDb,migration} from '../duel-sql-fixture';
import {germanyQuestions,germanCityKey} from '../../src/germanyPool';

const db=await createDuelTestDb();
await db.exec(migration('_expanded_quiz_activate'));
await db.exec(migration('_flexible_duel_counts'));
await db.exec(migration('_germany_support'));
await db.exec(migration('_germany_seed'));
const rows=async(sql:string,params:unknown[]=[])=>(await db.query(sql,params)).rows;
assert.equal((await rows("select count(*)::int as n from game.questions where category='germany' and enabled"))[0].n,0);
await db.exec(migration('_germany_activate'));
assert.equal((await rows("select count(*)::int as n from game.questions where category='germany' and enabled"))[0].n,970);
const qById=new Map(germanyQuestions.map(q=>[q.id,q]));
const flagImages=new Map(germanyQuestions.filter(q=>q.media?.src.startsWith('/media/de/')).map(q=>[q.media!.src,q.options[q.correct]]));
const host='10000000-0000-0000-0000-000000000001',guest='10000000-0000-0000-0000-000000000002';
const previous=new Set<string>();
await db.query("insert into game.profiles values($1,'QA Germany A'),($2,'QA Germany B')",[host,guest]);
await db.exec("select set_config('game.gateway_verified','true',false)");
async function request(user:string,action:string,payload:Record<string,unknown>={}){
 await db.query("select set_config('geo.test_user',$1,false)",[user]);
 return (await rows('select public.geoduel($1,$2::jsonb) as data',[action,JSON.stringify(payload)]))[0].data;
}
async function rpc(user:string,action:string,payload:Record<string,unknown>={}){
 const data=await request(user,action,payload);
 assert.ok(!data?.error,action+': '+data?.error);
 return data;
}
for(const [run,configuration] of [{germany:12},{flags:8,germany:8},{germany:24}].entries()){
 const lobby=await rpc(host,'create',{questionFormat:3});
 const roomId=lobby.id;
 if(run===0){
  await rpc(guest,'join',{code:lobby.code,questionFormat:2});
  assert.match((await request(host,'configure',{roomId,questionCounts:configuration})).error,/aktuelle GeoDuel-Version/);
  await rpc(guest,'leave',{roomId});
 }
 await rpc(guest,'join',{code:lobby.code,questionFormat:3});
 const configured=await rpc(host,'configure',{roomId,questionCounts:configuration});
 await rpc(host,'ready',{roomId,ready:true,questionFormat:3,configRevision:configured.configRevision});
 await rpc(guest,'ready',{roomId,ready:true,questionFormat:3,configRevision:configured.configRevision});
 let snapshots=[await rpc(host,'start',{roomId}),await rpc(guest,'snapshot',{roomId})];
 const picked=[];
 for(let i=0;i<snapshots[0].total;i++){
  const q=snapshots[0].question;
  assert.deepEqual(q,snapshots[1].question);
  assert.equal(q.correct,undefined);
  assert.equal(q.provenance,undefined);
  assert.ok(snapshots.every(s=>!s.feedback));
  const source=qById.get(q.id);
  if(source)picked.push(source);
  const labels=q.options.map((v:string)=>flagImages.get(v)??v);
  if(source?.media?.src==='choice:de-flags')assert.ok(q.options.every((opt:string)=>flagImages.has(opt)));
  const option=source?labels.indexOf(source.options[source.correct]):0;
  assert.ok(option>=0);
  const feedback=await rpc(host,'answer',{roomId,position:i,option});
  if(source)assert.equal(feedback.feedback.points,source.difficulty);
  assert.deepEqual((await rpc(host,'snapshot',{roomId})).feedback,feedback.feedback);
  await rpc(guest,'answer',{roomId,position:i,option:(option+1)%4});
  snapshots=[await rpc(host,'next',{roomId,position:i}),await rpc(guest,'next',{roomId,position:i})];
 }
 assert.equal(snapshots[1].status,'completed');
 assert.deepEqual(snapshots[1].result.playedCounts??snapshots[1].playedCounts,configuration);
 assert.equal(picked.length,configuration.germany);
 const subjects=new Set(picked.map(q=>q.provenance.subjectKey!));
 assert.equal(subjects.size,picked.length);
 assert.ok([...subjects].every(s=>!previous.has(s)));
 for(const subject of subjects)previous.add(subject);
 const cities=picked.map(germanCityKey).filter(Boolean);
 assert.equal(new Set(cities).size,cities.length);
 assert.ok(new Set(picked.map(q=>q.provenance.topic)).size>=Math.min(8,picked.length));
 assert.ok(picked.every((q,i)=>q.provenance.topic!==picked[i-1]?.provenance.topic));
 for(const user of [host,guest]){
  const review=await rpc(user,'review',{roomId});
  assert.equal(review.length,configured.total);
  assert.ok(review.every((item:{answers:unknown[]})=>item.answers.length===2));
 }
 console.log(JSON.stringify({configuration,total:configured.total,topics:new Set(picked.map(q=>q.provenance.topic)).size}));
}
await db.close();
