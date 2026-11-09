import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const url=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url&&key,'Supply public Supabase configuration');
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
async function rpc(c,action,payload={}){const {data,error}= ['create','join'].includes(action)?await c.functions.invoke('game',{body:{action,payload}}):await c.rpc('geoduel',{action,payload});assert.ifError(error);assert.ok(!data?.error,data?.error);return data;}
let room;
try{
 for(let i=0;i<2;i++){const {data,error}=await clients[i].auth.signInAnonymously();assert.ifError(error);assert.ok(data.user);await rpc(clients[i],'profile',{nickname:`QA-PWA-${i+1}`});}
 room=await rpc(clients[0],'create',{perCategory:2});assert.match(room.code,/^\d{4}$/);
 await rpc(clients[1],'join',{code:room.code});
 for(const c of clients)await rpc(c,'ready',{roomId:room.id,ready:true});
 await rpc(clients[0],'start',{roomId:room.id});
 let expected=[0,0];let ids=[];
 for(let player=0;player<2;player++){
  const c=clients[player];
  for(let position=0;position<8;position++){
   let s=await rpc(c,'snapshot',{roomId:room.id});assert.equal(s.cursor,position);assert.equal(s.question.correct,undefined);assert.ok(s.players.every(p=>!('points' in p)));
   if(player===0)ids.push(s.question.id);else assert.equal(s.question.id,ids[position]);
   s=await rpc(c,'answer',{roomId:room.id,position,option:0});expected[player]+=s.feedback.points;assert.equal(s.points,expected[player]);
   const repeated=await rpc(c,'answer',{roomId:room.id,position,option:1});assert.equal(repeated.points,s.points);
   await rpc(c,'next',{roomId:room.id,position});
  }
  const s=await rpc(c,'snapshot',{roomId:room.id});assert.equal(s.finished,true);if(player===0){assert.equal(s.status,'playing');assert.equal(s.result,undefined);}
 }
 const finished=await rpc(clients[0],'snapshot',{roomId:room.id});assert.equal(finished.status,'completed');assert.equal(finished.result.players.length,2);
 for(let i=0;i<2;i++){const {data:{session}}=await clients[i].auth.getSession();const reconnected=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});assert.ifError((await reconnected.auth.setSession(session)).error);assert.equal((await rpc(reconnected,'snapshot',{roomId:room.id})).status,'completed');const stats=await rpc(reconnected,'stats');assert.equal(stats.played,1);assert.equal(stats.points,expected[i]);assert.equal((await rpc(reconnected,'review',{roomId:room.id})).length,8);await reconnected.removeAllChannels();}
 const previous=room.id;room=await rpc(clients[0],'rematch',{roomId:room.id});assert.notEqual(room.id,previous);assert.equal(room.players.length,2);assert.equal((await rpc(clients[1],'rematch',{roomId:previous})).id,room.id);
 console.log('PASS: two independent guest sessions, room code, identical questions, hidden scores, scoring, idempotent answers, waiting, results, persistent stats, session reconnect, review and shared rematch');
}finally{if(room)await rpc(clients[0],'leave',{roomId:room.id});for(const c of clients)await c.removeAllChannels();}
process.exit(0);
