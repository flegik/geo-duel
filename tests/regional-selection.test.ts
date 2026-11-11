import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRound,emptyState} from '../src/engine';
import {africaSlots,countryContinent,selectionPolicy} from '../src/selection';

test('Controlled categories retain their exact expected share and bounded short-round counts',()=>{
 const categories=Object.keys(selectionPolicy.regionalAfricaTargets) as (keyof typeof selectionPolicy.regionalAfricaTargets)[];
 for(const size of [2,3,4,8,12,16]){
  const totals=new Map(categories.map(c=>[c,0]));
  for(let i=0;i<100;i++){
   const schedule=africaSlots(categories,size,(i+.5)/100);
   let roundTotal=0,roundExpected=0;
   for(const category of categories){
    const expected=size*selectionPolicy.regionalAfricaTargets[category]/100;
    const count=schedule.get(category)!.filter(Boolean).length;
    assert.ok(count>=Math.floor(expected)&&count<=Math.ceil(expected));
    totals.set(category,totals.get(category)!+count);
    roundTotal+=count;
    roundExpected+=expected;
   }
   assert.ok(roundTotal<=Math.ceil(roundExpected));
  }
  for(const category of categories)assert.equal(totals.get(category),size*selectionPolicy.regionalAfricaTargets[category]);
 }
});
test('12-question solo border training actually uses the quota',()=>{
 for(let i=0;i<20;i++){
  const round=createRound(emptyState(),12,'borders',()=>i/20);
  assert.equal(round.questions.length,12);
  assert.ok(round.questions.filter(q=>countryContinent(q.provenance.iso!)==='Afrika').length<=1);
 }
});
