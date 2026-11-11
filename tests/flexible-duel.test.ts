import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DuelConfiguration} from '../src/DuelConfiguration';
import {adjustQuestionCount,countQuestions,duelDistribution,validDuelLength,type QuestionCounts} from '../src/duelConfiguration';

test('Host counters allow arbitrary combinations and respect both bounds',()=>{
 let counts:QuestionCounts={};
 for(let i=0;i<7;i++)counts=adjustQuestionCount(counts,'flags',1);
 for(let i=0;i<5;i++)counts=adjustQuestionCount(counts,'maps',1);
 assert.deepEqual(counts,{flags:7,maps:5});
 assert.equal(countQuestions(counts),12);
 assert.equal(validDuelLength(3),false);
 assert.equal(validDuelLength(4),true);
 assert.equal(validDuelLength(24),true);
 assert.equal(validDuelLength(25),false);
 counts={flags:24};
 assert.strictEqual(adjustQuestionCount(counts,'maps',1),counts);
 assert.strictEqual(adjustQuestionCount(counts,'maps',-1),counts);
 assert.deepEqual(adjustQuestionCount({world:1},'world',-1),{});
});
test('Lobby drafts, frozen plans, random rooms and historical rooms resolve separately',()=>{
 const historical={perCategory:3 as const,categories:['flags','maps'] as const,selectedCategories:null};
 assert.equal(duelDistribution({...historical,categories:[],status:'waiting'}),null);
 assert.deepEqual(duelDistribution({...historical,categories:[],status:'waiting',questionCounts:{flags:7,maps:5}}),{flags:7,maps:5});
 assert.deepEqual(duelDistribution({...historical,categories:[...historical.categories],status:'completed'}),{flags:3,maps:3});
 assert.deepEqual(duelDistribution({...historical,categories:[...historical.categories],status:'playing',
  questionCounts:{flags:7,maps:5},playedCounts:{flags:8,maps:8}}),{flags:8,maps:8});
});
function configuration(counts:QuestionCounts|null,host=true){
 return renderToStaticMarkup(createElement(DuelConfiguration,{counts,perCategory:3,host,disabled:false,saving:false,onChange:()=>{},icon:()=>null}));
}
test('Host presets, guest read-only distribution and 24-question stop render accessibly',()=>{
 const max=configuration({flags:24});
 for(const label of ['12× Flaggen','16× Flaggen','8× Flaggen + 8× Karten','Vier Kategorien zufällig','Eigene Zusammenstellung'])assert.ok(max.includes(label));
 assert.equal((max.match(/eine Frage mehr" disabled=""/g)??[]).length,7);
 assert.equal((max.match(/eine Frage weniger" disabled=""/g)??[]).length,6);
 assert.match(max,/24 \/ 24 Fragen/);
 const draft=configuration({flags:2});
 assert.match(draft,/mindestens 4 Fragen/);
 const guest=configuration({flags:7,maps:5},false);
 assert.match(guest,/7 Fragen/);
 assert.match(guest,/5 Fragen/);
 assert.match(guest,/12 \/ 24 Fragen/);
 assert.doesNotMatch(guest,/eine Frage mehr|eine Frage weniger|Hauptstädte/);
 const quick=configuration(null);
 assert.match(quick,/Pro Kategorie 3 Fragen/);
 assert.match(quick,/ 12 Fragen</);
});
