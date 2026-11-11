import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {questions,type Category} from '../src/engine';
import registry from '../data/flags/registry.json';

const url=process.env.VITE_SUPABASE_URL!,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
assert.ok(url&&key);
const makeClient=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const clients=[makeClient(),makeClient()];
const byId=new Map(questions.map(q=>[q.id,q]));
const formats={
 flags:'flag-image-v1-',maps:'city-map-v1-',landmarks:'landmark-city-v1-',world:'world-compare-v1-',
} as const;
const categories=Object.keys(formats) as (keyof typeof formats)[];
const seen=new Map(categories.map(c=>[c,0]));
let currentRoom:string|undefined,rematchChecked=false,reconnectChecked=false;
let rooms=0,questionsChecked=0;

async function rpc(client:typeof clients[number],action:string,payload:Record<string,unknown>={}){
 const {data,error}=['create','join'].includes(action)
  ?await client.functions.invoke('game',{body:{action,payload}})
  :await client.rpc('geoduel',{action,payload});
 assert.ifError(error);
 assert.ok(!data?.error,data?.error);
 return data;
}
async function start(selection:Category[],formatsSupported:[number,number]){
 const room=await rpc(clients[0],'create',{perCategory:4});
 currentRoom=room.id;
 await rpc(clients[1],'join',{code:room.code});
 await rpc(clients[0],'configure',{roomId:room.id,categories:selection,perCategory:4});
 await Promise.all(clients.map((client,p)=>rpc(client,'ready',{roomId:room.id,ready:true,
  ...(formatsSupported[p]===2?{questionFormat:2}:{})})));
 const started=await rpc(clients[0],'start',{roomId:room.id});
 assert.equal(started.total,selection.length*4);
 return started;
}
async function play(room:{id:string;total:number},newFormats=true){
 const history:{options:string[];correct:number}[]=[];
 const scores=[0,0];
 for(let position=0;position<room.total;position++){
  const snapshots=await Promise.all(clients.map(client=>rpc(client,'snapshot',{roomId:room.id})));
  const display=snapshots[0].question;
  assert.deepEqual(display,snapshots[1].question);
  const q=byId.get(display.id)!;
  assert.ok(q?.enabled,display.id);
  const type=categories.find(category=>q.id.startsWith(formats[category]));
  assert.ok(newFormats||!type,'old clients must only receive legacy questions');
  if(type)seen.set(type,seen.get(type)!+1);
  for(const snapshot of snapshots){
   assert.equal(snapshot.cursor,position);
   assert.equal(snapshot.feedback,undefined);
   assert.equal(snapshot.question.correct,undefined);
   assert.equal(snapshot.question.provenance,undefined);
   assert.ok(!JSON.stringify(snapshot.question.media).includes('cityLocation'));
  }
  const labels=type==='flags'
   ?display.options.map((path:string)=>registry.find(c=>c.svg===path)?.name)
   :display.options;
  if(type==='flags'){
   assert.ok(display.options.every((path:string)=>/^\/media\/flags\/[a-f0-9]+\.svg$/.test(path)));
   assert.ok(!display.options.includes(q.options[q.correct]));
  }
  assert.deepEqual(new Set(labels),new Set(q.options));
  const correct=labels.indexOf(q.options[q.correct]);
  history.push({options:labels,correct});
  for(const player of [0,1]){
   const client=clients[player];
   if(player===1)assert.equal((await rpc(client,'snapshot',{roomId:room.id})).feedback,undefined);
   const option=player===0?correct:(correct+1)%4;
   const answered=await rpc(client,'answer',{roomId:room.id,position,option});
   assert.equal(answered.feedback.correct,correct);
   assert.equal(answered.feedback.selected,option);
   assert.equal(answered.feedback.points,player===0?q.difficulty:0);
   assert.deepEqual(answered.question.options,labels);
   scores[player]+=answered.feedback.points;
   assert.equal(answered.points,scores[player]);
   if(type==='maps')assert.deepEqual(answered.feedback.provenance.cityLocation,q.provenance.cityLocation);
   if(type==='landmarks')assert.ok(answered.feedback.provenance.cityChoices.length===4);
   if(type==='world')assert.ok(answered.feedback.provenance.comparison.values.length===4);
   if(!reconnectChecked){
    const fresh=makeClient();
    const {data:{session}}=await client.auth.getSession();
    assert.ifError((await fresh.auth.setSession(session!)).error);
    const resumed=await rpc(fresh,'snapshot',{roomId:room.id});
    assert.deepEqual(resumed.question,answered.question);
    assert.deepEqual(resumed.feedback,answered.feedback);
    await fresh.removeAllChannels();
    reconnectChecked=true;
   }
   await rpc(client,'next',{roomId:room.id,position});
  }
 }
 const result=await rpc(clients[0],'snapshot',{roomId:room.id});
 assert.equal(result.status,'completed');
 assert.deepEqual(result.result.players.map((p:{points:number})=>p.points).sort((a:number,b:number)=>a-b),scores.toSorted((a,b)=>a-b));
 for(const client of clients){
  const review=await rpc(client,'review',{roomId:room.id});
  assert.equal(review.length,room.total);
  for(const [position,row] of review.entries()){
   assert.deepEqual(row.options,history[position].options);
   assert.equal(row.correct,history[position].correct);
   assert.equal(row.answers.length,2);
  }
 }
 currentRoom=undefined;
 rooms++;
 questionsChecked+=room.total;
 return result;
}
try{
 for(const [i,client] of clients.entries()){
  const {data,error}=await client.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
  await rpc(client,'profile',{nickname:`QA Formate ${i+1}`});
 }
 const compatibility=await start(categories,[2,1]);
 await play(compatibility,false);
 const first=await play(await start(categories,[2,2]));
 const rematch=await rpc(clients[0],'rematch',{roomId:first.id});
 currentRoom=rematch.id;
 assert.deepEqual(rematch.selectedCategories.toSorted(),categories.toSorted());
 await Promise.all(clients.map(client=>rpc(client,'ready',{roomId:rematch.id,ready:true,questionFormat:2})));
 await play(await rpc(clients[0],'start',{roomId:rematch.id}));
 rematchChecked=true;
 for(let attempt=0;attempt<4;attempt++){
  const missing=categories.filter(c=>!seen.get(c));
  if(!missing.length)break;
  if(rooms===5)await new Promise(resolve=>setTimeout(resolve,60000));
  await play(await start(missing,[2,2]));
 }
 assert.ok(categories.every(c=>seen.get(c)),JSON.stringify(Object.fromEntries(seen)));
 const report={status:'PASS',rooms,questionsChecked,newTypes:Object.fromEntries(seen),
  oldClientCompatibility:true,reconnectChecked,rematchChecked};
 console.log(JSON.stringify(report));
 if(process.env.GEODUEL_TEST_REPORT)writeFileSync(process.env.GEODUEL_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
}finally{
 if(currentRoom)await rpc(clients[0],'leave',{roomId:currentRoom}).catch(()=>{});
 await Promise.all(clients.map(client=>client.removeAllChannels()));
}
process.exit(0);
