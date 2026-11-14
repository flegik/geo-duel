import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {germanyQuestions,germanCityKey,germanStates} from '../../src/germanyPool';
import {questions} from '../../src/engine';
import {flags} from '../../src/flags';
import {writeFileSync} from 'node:fs';

const url=process.env.VITE_SUPABASE_URL!,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
assert.ok(url&&key);
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const players=[client(),client()];
const pool=new Map(questions.map(q=>[q.id,q]));
const flagsByPath=new Map([...flags.map(f=>[f.svg,f.name] as const),...germanStates.map(s=>[s.flag,s.name] as const)]);
let current:string|undefined;
const played=new Set<string>();
const report=[];
let realtime=false,reconnect=false;
async function call(c:typeof players[number],action:string,payload:Record<string,unknown>={}){
 const {data,error}=['create','join'].includes(action)?await c.functions.invoke('game',{body:{action,payload}}):
  await c.rpc('geoduel',{action,payload});
 assert.ifError(error);
 assert.ok(!data?.error,action+': '+data?.error);
 return data;
}
const both=(action:string,roomId:string,extra:Record<string,unknown>={})=>
 Promise.all(players.map(c=>call(c,action,{roomId,...extra})));

try{
 const names=await Promise.all(players.map(async(c,i)=>{
  const {data,error}=await c.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
  await call(c,'profile',{nickname:'QA Deutschland '+(i+1)});
  return data.user.id;
 }));
 assert.equal(new Set(names).size,2);
 for(const configuration of [{germany:12},{germany:8,flags:8},{germany:24}]){
  const created=await call(players[0],'create',{questionFormat:3});
  const roomId=created.id;
  current=roomId;
  const events:number[]=[];
  let channel;
  if(!realtime){
   const {data:{session}}=await players[0].auth.getSession();
   await players[0].realtime.setAuth(session!.access_token);
   channel=players[0].channel('qa-germany-'+roomId)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'duel_events',filter:'room_id=eq.'+roomId},
     event=>events.push(Number(event.new.version)));
   await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Realtime timeout')),7500);
    channel!.subscribe(status=>{
     if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}
     if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timeout);reject(Error(status));}
    });
   });
  }
  await call(players[1],'join',{code:created.code,questionFormat:3});
  const config=await call(players[0],'configure',{roomId,questionCounts:configuration,configRevision:created.configRevision});
  if(channel){
   for(let i=0;i<80&&events.length===0;i++)await new Promise(r=>setTimeout(r,100));
   assert.ok(events.length>0);
   await players[0].removeChannel(channel);
   realtime=true;
  }
  await both('ready',roomId,{ready:true,questionFormat:3,configRevision:config.configRevision});
  let snapshots=[await call(players[0],'start',{roomId}),await call(players[1],'snapshot',{roomId})];
  const topics=new Set<string>(),states=new Set<string>(),cities=new Set<string>();
  const counts:Record<string,number>={};
  const scores=[0,0];
  const sequence:string[]=[];
  for(let position=0;position<config.total;position++){
   const q=snapshots[0].question;
   assert.deepEqual(q,snapshots[1].question);
   assert.ok(snapshots.every(s=>!s.feedback&&s.cursor===position));
   for(const k of ['correct','provenance','explanation'])assert.ok(!(k in q));
   const source=pool.get(q.id)!;
   assert.ok(source,q.id);
   counts[q.category]=(counts[q.category]??0)+1;
   if(source.category==='germany'){
    const subject=source.provenance.subjectKey!,topic=source.provenance.topic!,state=source.provenance.germany!.state;
    assert.ok(!played.has(subject));
    played.add(subject);
    const city=germanCityKey(source);
    assert.ok(!city||!cities.has(city));
    if(city)cities.add(city);
    topics.add(topic);
    sequence.push(topic);
    states.add(state);
    if(q.media?.src==='choice:de-flags')assert.ok(q.options.every(v=>flagsByPath.has(v)));
   }
   const option=q.options.map(v=>flagsByPath.get(v)??v).indexOf(source.options[source.correct]);
   assert.ok(option>=0);
   const feedback=await Promise.all(players.map((c,i)=>call(c,'answer',{roomId,position,option:(option+i)%4})));
   scores[0]+=source.difficulty;
   assert.equal(feedback[0].feedback.points,source.difficulty);
   assert.equal(feedback[1].feedback.points,0);
   if(!reconnect){
    const restored=client();
    const {data:{session}}=await players[0].auth.getSession();
    assert.ifError((await restored.auth.setSession(session!)).error);
    const loaded=await call(restored,'snapshot',{roomId});
    assert.deepEqual(loaded.feedback,feedback[0].feedback);
    assert.deepEqual(loaded.question,feedback[0].question);
    reconnect=true;
   }
   snapshots=await both('next',roomId,{position});
  }
  assert.deepEqual(counts,Object.fromEntries(Object.entries(configuration).filter(([,v])=>v)));
  assert.ok(sequence.every((topic,i)=>topic!==sequence[i-1]));
  assert.ok(topics.size>=Math.min(9,configuration.germany));
  const results=await both('snapshot',roomId);
  assert.deepEqual(results[0].result,results[1].result);
  assert.deepEqual(results[0].playedCounts,configuration);
  assert.equal(results[0].result.players.find(p=>p.id===names[0]).points,scores[0]);
  const reviews=await both('review',roomId);
  assert.deepEqual(reviews[0].map(q=>q.options),reviews[1].map(q=>q.options));
  assert.ok(reviews.every(items=>items.length===config.total&&items.every(item=>item.answers.length===2)));
  report.push({configuration,total:config.total,points:scores,topics:topics.size,states:states.size,reconnect,realtime});
  console.log(JSON.stringify(report.at(-1)));
  current=undefined;
 }
 assert.equal(played.size,germanyQuestions.length>0?44:0);
 if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
}finally{
 if(current)await Promise.allSettled(players.map(c=>call(c,'leave',{roomId:current})));
 await Promise.all(players.map(c=>c.removeAllChannels()));
}
