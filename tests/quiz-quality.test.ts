import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {questions} from '../src/engine';
import {germanCities,germanStates,stateByName} from '../src/germanyPool';
import cityData from '../data/learning/population-cities.json';
import countryData from '../data/learning/population-countries.json';
import quality from '../data/question-pool/quiz-quality.json';

const active=questions.filter(q=>q.enabled);
const germany=active.filter(q=>q.category==='germany');
const byId=new Map(questions.map(q=>[q.id,q]));
const answer=(q:typeof questions[number])=>q.options[q.correct];
const parseEstimate=(s:string)=>{
 const number=Number(s.replace('Ca. ','').replace(/[^\d,.]/g,'').replaceAll('.','').replace(',','.'));
 return Math.round(number*(s.includes('Mrd')?1e9:s.includes('Mio')?1e6:1));
};
const assertEstimate=(q:typeof questions[number],value:number)=>{
 const estimates=q.options.map(parseEstimate);
 assert.ok(estimates.every(x=>x>0));
 const byDistance=estimates.toSorted((a,b)=>Math.abs(a-value)-Math.abs(b-value));
 assert.equal(byDistance[0],parseEstimate(answer(q)),q.id);
 assert.ok(Math.abs(byDistance[0]-value)<Math.abs(byDistance[1]-value),q.id);
 const ranked=estimates.toSorted((a,b)=>a-b);
 assert.ok(ranked.slice(1).every((v,i)=>v/ranked[i]>=1.8),q.id);
 assert.doesNotMatch(q.prompt,/DEGURBA|Projektion|bis unter|202[0-9]/);
};

test('Regular German quiz covers only basic geography and records retired IDs',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(germany,q=>q.provenance.topic!)).map(([k,v])=>[k,v!.length])),
  {'state-map':32,capital:48,'city-state':79,'city-map':58,'state-border':80,statistics:26,'country-border':33});
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 for(const id of quality.retiredIds)assert.equal(byId.get(id)?.enabled,false,id);
 for(const state of germanStates){
  const capitals=germany.filter(q=>q.provenance.topic==='capital'&&q.provenance.germany?.state===state.code);
  assert.ok(capitals.some(q=>answer(q)===state.capital));
  assert.ok(capitals.some(q=>answer(q)===state.name));
  assert.ok(germany.some(q=>q.provenance.topic==='state-map'&&answer(q)===state.name&&q.difficulty>=2));
 }
});

test('All German border choices follow the land and river boundary register',()=>{
 const rows=readFileSync('data/germany/country-borders.tsv','utf8').trim().split(/\r?\n/).map(line=>line.split('\t'));
 const neighbors=new Map(rows.map(([name,codes])=>[name,codes.split(' ')]));
 assert.equal(neighbors.size,9);
 assert.deepEqual(neighbors.get('Schweiz'),['BW']);
 for(const [country,codes] of neighbors){
  const variants=quality.replacements.filter(q=>q.provenance.germany?.countryBorder?.country===country);
  assert.ok(codes.every(code=>variants.some(q=>q.provenance.germany?.state===code)));
  for(const q of variants){
   const info=q.provenance.germany!;
   const correct=(option:string)=>{
    switch(info.countryBorder!.direction){
     case 'state':return codes.includes(stateByName.get(option)?.code??'');
     case 'country':return neighbors.get(option)?.includes(info.state);
     default:return option.split(', ').map(name=>stateByName.get(name)?.code).toSorted().join(' ')===[...codes].sort().join(' ');
    }
   };
   assert.deepEqual(q.options.filter(correct),[q.options[q.correct]]);
  }
 }
});

test('German population questions cover the largest ten municipalities and all 16 states',()=>{
 const estimates=germany.filter(q=>q.provenance.topic==='statistics');
 const cities=estimates.filter(q=>q.id.startsWith('de-pop-stadt-'));
 assert.deepEqual(cities.map(q=>q.provenance.germany!.stat!.values[0].name),
  ['Berlin','Hamburg','München','Köln','Frankfurt am Main','Düsseldorf','Stuttgart','Leipzig','Dortmund','Bremen']);
 for(const q of estimates){
  const stat=q.provenance.germany!.stat!;
  const entities=q.id.startsWith('de-pop-stadt-')?germanCities:germanStates;
  assert.equal(stat.date,'31.12.2024');
  assert.equal(stat.values[0].value,entities.find(e=>q.id.endsWith(e.ags))?.population);
  assertEstimate(q,stat.values[0].value);
 }
});

test('International population estimates use one sourced definition per place and separated answers',()=>{
 const estimates=active.filter(q=>q.provenance.population?.variant==='estimate');
 assert.ok(estimates.length>=90);
 for(const q of estimates){
  const metadata=q.provenance.population as {kind:string;definition:string;values:{id:string;population:number}[];referenceDate:string};
  const target=metadata.values[0];
  assert.equal(metadata.referenceDate,'2025-07-01');
  if(metadata.kind==='city'){
   const city=cityData.cities.find(c=>c.id===target.id);
   assert.ok(city?.quizEligible&&city.iso!=='DE');
   assert.equal(target.population,city.population);
   assert.equal(metadata.definition,'city-un-degurba');
   assert.match(q.prompt,/zusammenhängenden Stadtgebiet/);
  }else{
   assert.equal(target.population,countryData.countries[target.id as keyof typeof countryData.countries]?.population);
  }
  assertEstimate(q,target.population);
 }
 assert.ok(active.every(q=>!q.provenance.population||q.provenance.population.variant==='estimate'));
});
