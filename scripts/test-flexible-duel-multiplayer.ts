import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {writeFileSync} from 'node:fs';
import {questions} from '../src/engine';
import {questionSubject,flags} from '../src/flags';
import type {QuestionCounts} from '../src/duelConfiguration';

const url=process.env.VITE_SUPABASE_URL!,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
assert.ok(url&&key);
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const clients=[client(),client()];
const pool=new Map(questions.map(q=>[q.id,q]));
const flagNames=new Map(flags.map(f=>[f.svg,f.name]));
const scoreTotals=[0,0];
let current:string|undefined;
let reconnect=false,concurrentRematch=false;
const report:{configuration:QuestionCounts;total:number;points:number[];subjects:number}[]=[];

async function request(c:typeof clients[number],action:string,payload:Record<string,unknown>={}){
 const {data,error}=['create','join'].includes(action)?await c.functions.invoke('game',{body:{action,payload}}):
  await c.rpc('geoduel',{action,payload});
 assert.ifError(error);
 return data;
}
async function rpc(c:typeof clients[number],action:string,payload:Record<string,unknown>={}){
 const data=await request(c,action,payload);
 assert.ok(!data?.error,`${action}: ${data?.error}`);
 return data;
}
const both=(action:string,roomId:string,extra:Record<string,unknown>={})=>
 Promise.all(clients.map(c=>rpc(c,action,{roomId,...extra})));

try{
 await Promise.all(clients.map(async(c,i)=>{
  const {data,error}=await c.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
  await rpc(c,'profile',{nickname:`QA Flex ${i+1}`});
 }));
 for(const [run,configuration] of ([{flags:12},{flags:8,maps:8}] as QuestionCounts[]).entries()){
  const created=await rpc(clients[0],'create',{perCategory:3});
  const roomId=created.id;
  current=roomId;
  await rpc(clients[1],'join',{code:created.code});
  await both('ready',roomId,{ready:true,questionFormat:2,configRevision:created.configRevision});
  assert.ok((await request(clients[1],'configure',{roomId,questionCounts:configuration})).error);
  const lobby=await rpc(clients[0],'configure',{roomId,questionCounts:configuration,configRevision:created.configRevision});
  const expectedTotal=Object.values(configuration).reduce((sum,n)=>sum+n,0);
  assert.equal(lobby.total,expectedTotal);
  const guestLobby=await rpc(clients[1],'snapshot',{roomId});
  assert.equal(guestLobby.total,expectedTotal);
  assert.deepEqual(guestLobby.questionCounts,configuration);
  assert.ok(guestLobby.players.every(p=>!p.ready));
  assert.ok((await request(clients[1],'ready',{roomId,ready:true,configRevision:created.configRevision})).error);
  await both('ready',roomId,{ready:true,questionFormat:2,configRevision:lobby.configRevision});
  const started=await rpc(clients[0],'start',{roomId});
  const opponent=await rpc(clients[1],'snapshot',{roomId});
  assert.deepEqual(started.playedCounts,configuration);
  assert.deepEqual(opponent.playedCounts,configuration);
  assert.ok((await request(clients[0],'configure',{roomId,questionCounts:{flags:4}})).error);
  assert.ok((await request(clients[1],'review',{roomId})).error);

  let snapshots=[started,opponent];
  const counts:QuestionCounts={};
  const subjects=new Set<string>();
  const points=[0,0],difficulty=[0,0,0];
  for(let position=0;position<expectedTotal;position++){
   const q=snapshots[0].question;
   assert.deepEqual(q,snapshots[1].question);
   for(const state of snapshots){
    assert.equal(state.cursor,position);
    assert.equal(state.total,expectedTotal);
    assert.equal(state.feedback,undefined);
    assert.equal(state.question.correct,undefined);
    assert.ok(state.players.every(p=>!('points' in p)));
   }
   const source=pool.get(q.id)!;
   assert.ok(source);
   const subject=questionSubject(source);
   assert.ok(!subjects.has(subject),subject);
   subjects.add(subject);
   counts[source.category]=(counts[source.category]??0)+1;
   difficulty[source.difficulty-1]++;
   const labels=q.options.map((option:string)=>flagNames.get(option)??option);
   const correct=labels.indexOf(source.options[source.correct]);
   assert.ok(correct>=0);
   const feedback=await Promise.all(clients.map((c,i)=>rpc(c,'answer',{roomId,position,option:(correct+i)%4})));
   for(const [i,state] of feedback.entries()){
    assert.equal(state.feedback.correct,correct);
    assert.equal(state.feedback.points,i===0?source.difficulty:0);
    points[i]+=state.feedback.points;
    assert.equal(state.points,points[i]);
   }
   if(!reconnect){
    const restoredClient=client();
    const {data:{session}}=await clients[0].auth.getSession();
    assert.ifError((await restoredClient.auth.setSession(session!)).error);
    const restored=await rpc(restoredClient,'snapshot',{roomId});
    assert.deepEqual(restored.question,feedback[0].question);
    assert.deepEqual(restored.feedback,feedback[0].feedback);
    assert.deepEqual(restored.playedCounts,configuration);
    await restoredClient.removeAllChannels();
    reconnect=true;
   }
   snapshots=await both('next',roomId,{position});
  }
  assert.deepEqual(counts,configuration);
  if(run===0)assert.deepEqual(difficulty,[4,4,4]);
  const [finishedA,finishedB]=await both('snapshot',roomId);
  for(const state of [finishedA,finishedB]){
   assert.equal(state.status,'completed');
   assert.equal(state.result.total,expectedTotal);
   assert.deepEqual(state.playedCounts,configuration);
   assert.deepEqual(state.result.players.map(p=>p.points).sort((a,b)=>a-b),points.toSorted((a,b)=>a-b));
  }
  const reviews=await both('review',roomId);
  for(let i=0;i<reviews.length;i++){
   assert.equal(reviews[i].length,expectedTotal);
   assert.ok(reviews[i].every(row=>row.answers.length===2));
   scoreTotals[i]+=points[i];
  }
  assert.deepEqual(reviews[0].map(row=>row.options),reviews[1].map(row=>row.options));
  assert.deepEqual(reviews[0].map(row=>row.correct),reviews[1].map(row=>row.correct));
  report.push({configuration,total:expectedTotal,points,subjects:subjects.size});
  console.log(JSON.stringify(report.at(-1)));

  const [rematchA,rematchB]=await both('rematch',roomId);
  assert.equal(rematchA.id,rematchB.id);
  concurrentRematch=true;
  current=rematchA.id;
  assert.equal(rematchA.status,'waiting');
  assert.deepEqual(rematchA.questionCounts,configuration);
  assert.equal(rematchA.playedCounts,null);
  assert.ok(rematchA.players.every(p=>!p.ready));
  const editable=await rpc(clients[0],'configure',{roomId:rematchA.id,questionCounts:{flags:7,maps:5}});
  assert.equal(editable.total,12);
  await rpc(clients[0],'leave',{roomId:rematchA.id});
  current=undefined;
 }
 const stats=await Promise.all(clients.map(c=>rpc(c,'stats')));
 for(const [i,s] of stats.entries()){
  assert.equal(s.played,2);
  assert.equal(s.answers,28);
  assert.equal(s.points,scoreTotals[i]);
  assert.deepEqual(s.history.map(h=>h.total),[16,12]);
  assert.equal(s.categories.reduce((sum,c)=>sum+c.total,0),28);
 }
 const evidence={status:'PASS',matches:report,reconnect,concurrentRematch,stats:true};
 console.log(JSON.stringify(evidence));
 if(process.env.GEODUEL_TEST_REPORT)writeFileSync(process.env.GEODUEL_TEST_REPORT,JSON.stringify(evidence,null,2)+'\n');
}finally{
 if(current)await rpc(clients[0],'leave',{roomId:current}).catch(()=>{});
 await Promise.all(clients.map(c=>c.removeAllChannels()));
}
process.exit(0);
