import {createClient} from '@supabase/supabase-js';import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {questions,type Category} from '../src/engine';
const url=process.env.VITE_SUPABASE_URL!,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;assert.ok(url&&key);
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));const pool=new Map(questions.map(q=>[q.id,q]));
async function rpc(c:typeof clients[number],action:string,payload:Record<string,unknown>={}){const {data,error}=['create','join'].includes(action)?await c.functions.invoke('game',{body:{action,payload}}):await c.rpc('geoduel',{action,payload});assert.ifError(error);assert.ok(!data?.error,data?.error);return data;}
let room:any;const report:any[]=[];const totals=[0,0];const guestIds:string[]=[];
try{
 for(let p=0;p<2;p++){const {data,error}=await clients[p].auth.signInAnonymously();assert.ifError(error);assert.ok(data.user?.is_anonymous);guestIds.push(data.user!.id);await rpc(clients[p],'profile',{nickname:`${process.env.GEODUEL_TEST_PROFILE_BASE??"QA-Pool"}-${p+1}`});}assert.notEqual(guestIds[0],guestIds[1]);
 const cases:(Category[]|null)[]=process.env.GEODUEL_TEST_CATEGORIES?[process.env.GEODUEL_TEST_CATEGORIES.split(',') as Category[]]:[null,['capitals'],['silhouettes'],['maps'],['borders'],['landmarks'],['world'],['flags']];
 for(const selection of cases){
  room=await rpc(clients[0],'create',{perCategory:3});await rpc(clients[1],'join',{code:room.code});
  if(selection){room=await rpc(clients[0],'configure',{roomId:room.id,categories:selection,perCategory:3});assert.deepEqual(room.selectedCategories,selection);assert.equal(room.total,3);}
  else{assert.equal(room.total,12);assert.equal(room.selectedCategories,null);}
  // A guest cannot configure the host's lobby, and invalid category input does not mutate it.
  const forbidden=await clients[1].rpc('geoduel',{action:'configure',payload:{roomId:room.id,categories:['world']}});assert.ok(forbidden.data?.error);const invalid=await clients[0].rpc('geoduel',{action:'configure',payload:{roomId:room.id,categories:['unknown']}});assert.ok(invalid.data?.error);assert.deepEqual((await rpc(clients[0],'snapshot',{roomId:room.id})).selectedCategories,room.selectedCategories);
  for(const c of clients)await rpc(c,'ready',{roomId:room.id,ready:true});
  const started=await rpc(clients[0],'start',{roomId:room.id});const total=started.total;const seen:any[]=[];const subjects=new Set<string>();const expected=[0,0];
  if(selection)assert.deepEqual(started.categories,selection);else assert.equal(started.categories.length,4);
  for(let pos=0;pos<total;pos++){
   const snaps=await Promise.all(clients.map(c=>rpc(c,'snapshot',{roomId:room.id})));assert.deepEqual(snaps[0].question,snaps[1].question);const source=pool.get(snaps[0].question.id)!;assert.ok(source?.enabled);if(source.category!=='flags')assert.match(source.id,/^geo-v3-/);
   const subject=source.provenance.subjectKey??source.id;assert.ok(!subjects.has(subject));subjects.add(subject);seen.push({id:source.id,category:source.category,difficulty:source.difficulty,mediaType:source.media?.type});
   for(let p=0;p<2;p++){
    const s=snaps[p],q=s.question;assert.equal(s.cursor,pos);assert.equal(q.correct,undefined);assert.equal(q.provenance,undefined);assert.ok(s.players.every((x:any)=>!('points'in x)));assert.equal(new Set(q.options).size,4);
    const correct=q.options.indexOf(source.options[source.correct]);assert.ok(correct>=0);const option=p===0?correct:(correct+1)%4;
    const a=await rpc(clients[p],'answer',{roomId:room.id,position:pos,option});expected[p]+=p===0?source.difficulty:0;assert.equal(a.feedback.correct,correct);assert.equal(a.feedback.points,p===0?source.difficulty:0);assert.equal(a.points,expected[p]);
    const repeat=await rpc(clients[p],'answer',{roomId:room.id,position:pos,option:(option+1)%4});assert.deepEqual(repeat.feedback,a.feedback);assert.equal(repeat.points,a.points);
    if(pos===0){const {data:{session}}=await clients[p].auth.getSession();const reconnect=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});assert.ifError((await reconnect.auth.setSession(session!)).error);const restored=await rpc(reconnect,'snapshot',{roomId:room.id});assert.deepEqual(restored.feedback,a.feedback);assert.deepEqual(restored.question,a.question);await reconnect.removeAllChannels();}
    const advanced=await rpc(clients[p],'next',{roomId:room.id,position:pos});if(p===0&&pos===total-1){assert.equal(advanced.finished,true);assert.equal(advanced.status,'playing');assert.equal(advanced.result,undefined);}
   }
  }
  const done=await rpc(clients[0],'snapshot',{roomId:room.id});assert.equal(done.status,'completed');assert.equal(done.total,total);assert.equal(done.result.total,total);
  for(let p=0;p<2;p++){const player=done.result.players.find((x:any)=>x.id===guestIds[p]);assert.equal(player.points,expected[p]);const review=await rpc(clients[p],'review',{roomId:room.id});assert.equal(review.length,total);totals[p]+=expected[p];const stats=await rpc(clients[p],'stats');assert.equal(stats.played,report.length+1);assert.equal(stats.points,totals[p]);}
  report.push({roomId:room.id,selection:selection??'random-four',total,points:expected,questions:seen});
  console.log('PASS',selection?.join(',')??'random-four',total,'questions',expected);
  room=null;
  // Production throttle is intentionally respected across the eight sequential duels.
  if(report.length===4)await new Promise(resolve=>setTimeout(resolve,60000));
 }
 const result={status:'PASS',independentAnonymousProfiles:2,duels:report,checks:['all six expanded categories and unchanged flags','one-category and four-category rooms','identical question/media/options','authoritative 1/2/3 scoring','zero points for wrong answers','duplicate submission idempotency','feedback session restore','opponent scores hidden','result/review/stats','non-host configuration rejected']};writeFileSync(process.env.GEODUEL_TEST_REPORT??'docs/QUESTION_POOL_MULTIPLAYER_TEST.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',duels:report.length,answeredQuestions:report.reduce((s,r)=>s+2*r.total,0)}));
}finally{if(room)await rpc(clients[0],'leave',{roomId:room.id});await Promise.all(clients.map(c=>c.removeAllChannels()));}
process.exit(0);
