import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import registry from '../data/flags/registry.json';
import {mapMarkerCountry} from '../src/cityMapOptions';
import {questions} from '../src/engine';

const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url&&key);
const guests=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
const known=new Map(questions.map(q=>[q.id,q]));
const countries=new Map(registry.map(c=>[c.iso,c.name]));
const format={questionFormat:4};
let roomId:string|undefined;
async function rpc(player:number,action:string,payload:Record<string,unknown>={}){
 const client=guests[player];
 const {data,error}=['create','join'].includes(action)?await client.functions.invoke('game',{body:{action,payload}}):
  await client.rpc('geoduel',{action,payload});
 assert.ifError(error);
 assert.ok(!data?.error,action+': '+data?.error);
 return data;
}
try{
 const ids=await Promise.all(guests.map(async(client,i)=>{
  const {data,error}=await client.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
  await rpc(i,'profile',{nickname:`QA Karten ${i+1}`});
  return data.user.id;
 }));
 assert.notEqual(ids[0],ids[1]);
 const distribution={maps:16,germany:8};
 const created=await rpc(0,'create',format);
 roomId=created.id;
 const room={roomId};
 await rpc(1,'join',{code:created.code,...format});
 const configured=await rpc(0,'configure',{...room,questionCounts:distribution,configRevision:created.configRevision});
 const both=(action:string,extra:Record<string,unknown>={})=>Promise.all(guests.map((_,i)=>rpc(i,action,{...room,...extra})));
 await both('ready',{ready:true,configRevision:configured.configRevision,...format});
 const started=await rpc(0,'start',room);
 assert.deepEqual(started.playedCounts,distribution);
 const reviewOptions:string[][]=[];
 const scores=[0,0];
 const picks:Record<string,number>={};
 let maps=0,reconnected=false;
 for(let position=0;position<started.total;position++){
  const [a,b]=await both('snapshot');
  const q=a.question;
  assert.deepEqual(q,b.question);
  assert.equal(a.feedback,undefined);
  assert.equal(b.feedback,undefined);
  assert.equal(q.correct,undefined);
  assert.equal(q.provenance,undefined);
  const source=known.get(q.id);
  assert.ok(source?.enabled,q.id);
  picks[q.category]=(picks[q.category]??0)+1;
  const city=q.media?.type==='city-map';
  if(city){
   maps++;
   assert.ok(q.options.every((v:string)=>/^marker:[a-f0-9]{32}$/.test(v)));
  }
  const labels:string[]=city?q.options.map((v:string)=>countries.get(mapMarkerCountry(v)!)):q.options;
  const correct=labels.indexOf(source.options[source.correct]);
  assert.ok(correct>=0);
  reviewOptions.push(labels);
  const answered=await rpc(0,'answer',{...room,position,option:correct});
  assert.deepEqual(answered.question.options,labels);
  assert.equal(answered.feedback.points,source.difficulty);
  scores[0]+=source.difficulty;
  if(city){
   assert.ok(answered.feedback.provenance.cityLocation);
   assert.deepEqual((await rpc(1,'snapshot',room)).question.options,q.options);
   if(!reconnected){
    const restored=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{session}}=await guests[0].auth.getSession();
    assert.ifError((await restored.auth.setSession(session!)).error);
    const {data,error}=await restored.rpc('geoduel',{action:'snapshot',payload:room});
    assert.ifError(error);
    assert.deepEqual(data.feedback,answered.feedback);
    assert.deepEqual(data.question.options,labels);
    await restored.removeAllChannels();
    reconnected=true;
   }
  }
  const wrong=await rpc(1,'answer',{...room,position,option:(correct+1)%4});
  assert.deepEqual(wrong.question.options,labels);
  assert.equal(wrong.feedback.correct,correct);
  assert.equal(wrong.feedback.points,0);
  await both('next',{position});
 }
 assert.deepEqual(picks,distribution);
 assert.ok(maps>0&&reconnected);
 const [a,b]=await both('snapshot');
 assert.deepEqual(a.result,b.result);
 assert.equal(a.result.players.find((p:{id:string})=>p.id===ids[0]).points,scores[0]);
 const reviews=await both('review');
 for(const review of reviews){
  assert.deepEqual(review.map((q:{options:string[]})=>q.options),reviewOptions);
  assert.ok(review.every((q:{answers:unknown[]})=>q.answers.length===2));
 }
 roomId=undefined;
 console.log(JSON.stringify({status:'PASS',distribution,internationalCityMaps:maps,scores,reconnected,reviewForBoth:true}));
}finally{
 if(roomId)await rpc(0,'leave',{roomId}).catch(()=>{});
 await Promise.all(guests.map(client=>client.removeAllChannels()));
}
