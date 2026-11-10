import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {questions} from '../src/engine';
const url=process.env.VITE_SUPABASE_URL!,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
assert.ok(url&&key,'Public Supabase configuration required');
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
const pool=new Map(questions.map(q=>[q.id,q]));
async function rpc(c:typeof clients[number],action:string,payload:Record<string,unknown>={}){
 const {data,error}=['create','join'].includes(action)?await c.functions.invoke('game',{body:{action,payload}}):await c.rpc('geoduel',{action,payload});
 assert.ifError(error);assert.ok(!data?.error,data?.error);return data;
}
let room:any;let foundFlags=false;const report:any[]=[];const totals=[0,0];
try{
 for(let p=0;p<2;p++){const {data,error}=await clients[p].auth.signInAnonymously();assert.ifError(error);assert.ok(data.user?.is_anonymous);await rpc(clients[p],'profile',{nickname:`QA-Flag-${p+1}`});}
 const users=await Promise.all(clients.map(c=>c.auth.getUser()));assert.notEqual(users[0].data.user!.id,users[1].data.user!.id);
 for(let round=1;round<=8&&!foundFlags;round++){
  if(!room){room=await rpc(clients[0],'create',{perCategory:3});assert.match(room.code,/^\d{4}$/);await rpc(clients[1],'join',{code:room.code});}
  for(const c of clients)await rpc(c,'ready',{roomId:room.id,ready:true});
  await rpc(clients[0],'start',{roomId:room.id});
  const first=await rpc(clients[0],'snapshot',{roomId:room.id});
  const seen:any[]=[];const subjects=new Set<string>();const expected=[0,0];let flagCount=0;
  for(let p=0;p<2;p++){
   for(let pos=0;pos<12;pos++){
    let s=await rpc(clients[p],'snapshot',{roomId:room.id});const q=s.question,source=pool.get(q.id)!;
    assert.ok(source,`Unknown question ${q.id}`);assert.ok(source.enabled);assert.equal(s.cursor,pos);assert.equal(q.correct,undefined);assert.ok(s.players.every((x:any)=>!('points' in x)));
    assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);
    if(p===0){seen.push(q);const subject=source.provenance.subjectKey??q.id;assert.ok(!subjects.has(subject));subjects.add(subject);if(q.category==='flags'){flagCount++;assert.match(q.id,/^flag-v2-/);assert.match(q.media.src,/^\/media\/flags\/.+\.svg$/);}}
    else assert.deepEqual(q,seen[pos],'Both guests must see identical question, media, difficulty and option order');
    const correct=q.options.indexOf(source.options[source.correct]);assert.ok(correct>=0);
    const option=p===0?correct:(correct+1)%4;const points=p===0?source.difficulty:0;
    s=await rpc(clients[p],'answer',{roomId:room.id,position:pos,option});expected[p]+=points;
    assert.equal(s.feedback.correct,correct);assert.equal(s.feedback.points,points);assert.equal(s.points,expected[p]);
    if(pos===0){const duplicate=await rpc(clients[p],'answer',{roomId:room.id,position:pos,option:(option+1)%4});assert.equal(duplicate.points,s.points);assert.deepEqual(duplicate.feedback,s.feedback);}
    await rpc(clients[p],'next',{roomId:room.id,position:pos});
   }
   const done=await rpc(clients[p],'snapshot',{roomId:room.id});assert.equal(done.finished,true);if(p===0){assert.equal(done.status,'playing');assert.equal(done.result,undefined);}
  }
  const done=await rpc(clients[0],'snapshot',{roomId:room.id});assert.equal(done.status,'completed');
  const reviews=await Promise.all(clients.map(c=>rpc(c,'review',{roomId:room.id})));assert.equal(reviews[0].length,12);
  for(let pos=0;pos<12;pos++){assert.deepEqual(reviews[0][pos].options,reviews[1][pos].options);assert.equal(reviews[0][pos].correct,reviews[1][pos].correct);}
  for(let p=0;p<2;p++){
   totals[p]+=expected[p];const stats=await rpc(clients[p],'stats');assert.equal(stats.played,round);assert.equal(stats.points,totals[p]);
   const {data:{session}}=await clients[p].auth.getSession();const reconnect=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});assert.ifError((await reconnect.auth.setSession(session!)).error);assert.equal((await rpc(reconnect,'snapshot',{roomId:room.id})).status,'completed');await reconnect.removeAllChannels();
  }
  report.push({roomId:room.id,categories:first.categories,questions:12,flagQuestions:flagCount,points:expected,questionIds:seen.map(q=>q.id)});foundFlags=flagCount>0;
  if(!foundFlags){const previous=room.id;room=await rpc(clients[0],'rematch',{roomId:previous});assert.equal((await rpc(clients[1],'rematch',{roomId:previous})).id,room.id);}
 }
 assert.ok(foundFlags,'No flag category selected within eight complete random duels');
 console.log(JSON.stringify({status:'PASS',independentAnonymousProfiles:2,rounds:report,checks:['identical questions and option order','195-country registry question IDs','no subject duplicates','correct answer earns difficulty 1/2/3','wrong answers earn zero','duplicate answer idempotency','opponent scores hidden until completion','first player waits','complete review','persistent stats','session reconnect']},null,2));
}finally{if(room)await rpc(clients[0],'leave',{roomId:room.id});await Promise.all(clients.map(c=>c.removeAllChannels()));}
process.exit(0);
