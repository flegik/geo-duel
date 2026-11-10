import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import population from '../data/question-pool/population.json';import countryData from '../data/learning/population-countries.json';import cityData from '../data/learning/population-cities.json';import registry from '../data/flags/registry.json';import geo from '../data/atlas/geography.json';
import {questions,createRound,emptyState,answerRound,nextRound,recordRound} from '../src/engine';import {countryContinent,selectionPolicy,pickBalanced} from '../src/selection';import {questionSubject} from '../src/flags';
test('120 source-derived population questions split 60/60, dated, four unique options and immutable numeric evidence',()=>{
 assert.equal(population.length,120);assert.equal(new Set(population.map(q=>q.id)).size,120);
 for(const kind of ['country','city'])assert.equal(population.filter(q=>q.provenance.population.kind===kind).length,60);
 for(const q of population){const p=q.provenance.population;assert.equal(q.category,'world');assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.correct>=0&&q.correct<4);assert.equal(p.referenceYear,2025);assert.equal(p.referenceDate,'2025-07-01');assert.equal(p.unit,'persons');assert.ok(q.provenance.sources.every(s=>s.startsWith('https://population.un.org/')));assert.ok(q.prompt.includes('2025'));
  for(const e of p.values){const expected=p.kind==='country'?(countryData.countries as Record<string,{population:number}>)[e.iso]:cityData.cities.find(c=>c.id===e.id);assert.ok(expected);assert.equal(e.population,expected.population);assert.equal(registry.some(c=>c.iso===e.iso),true);if(p.kind==='city'){assert.ok(q.prompt.includes('urbanes Zentrum nach UN-DEGURBA'));assert.equal((expected as typeof cityData.cities[number]).quizEligible,true);}else assert.ok(q.prompt.includes('UN-Projektion'));}
 }
 for(const d of [1,2,3])assert.ok(population.filter(q=>q.difficulty===d).length>=10);
});
test('All estimate intervals are disjoint; comparisons and thresholds have one correct answer and clear numerical margins',()=>{
 for(const q of population){const p=q.provenance.population;const value=p.values[0].population;
  if(p.variant==='estimate'){const ranges=(p.ranges??[]).toSorted((a,b)=>a.minInclusive-b.minInclusive);assert.equal(ranges.length,4);for(let i=1;i<4;i++)assert.ok(ranges[i].minInclusive>=ranges[i-1].maxExclusive);const matches=ranges.filter(r=>value>=r.minInclusive&&value<r.maxExclusive);assert.equal(matches.length,1);assert.equal(q.options[q.correct],matches[0].label);}
  else{const values=p.values;const threshold=p.threshold??0;const truth=values.filter(e=>p.variant==='compare-max'?e.population===Math.max(...values.map(e=>e.population)):p.variant==='compare-min'?e.population===Math.min(...values.map(e=>e.population)):p.variant==='threshold-above'?e.population>threshold:e.population<threshold);assert.equal(truth.length,1);assert.equal(q.options[q.correct],truth[0].name);
   if(p.variant.startsWith('compare'))for(const e of values.slice(1))assert.ok(Math.max(value,e.population)/Math.min(value,e.population)>=1.25);
   else for(const e of values)assert.ok(e.population<=threshold*.8||e.population>=threshold*1.2);
  }
 }
});
test('Geography metadata reuses shared country facts and matches all 195 existing atlas assignments',()=>{for(const c of registry)assert.equal(countryContinent(c.iso),geo.countries[c.iso as keyof typeof geo.countries].continent,c.iso);assert.equal(Object.values(selectionPolicy.continentWeights).reduce((s,n)=>s+n,0),100);assert.equal(Object.values(selectionPolicy.worldTopicWeights).reduce((s,n)=>s+n,0),100);});
test('1000 simulated ordinary rounds reduce Africa and preserve an internationally varied selection',()=>{
 const result=JSON.parse(readFileSync('docs/GEOGRAPHY_AFTER_FRESH.json','utf8')),before=JSON.parse(readFileSync('docs/GEOGRAPHY_BEFORE.json','utf8'));assert.ok(result.rounds>=1000);assert.ok(result.percentages.Afrika>=13&&result.percentages.Afrika<=17);assert.ok(result.core.africaPercent>=13&&result.core.africaPercent<=17);assert.ok(result.percentages.Afrika<before.percentages.Afrika-5);assert.ok(result.percentages.Europa>before.percentages.Europa);assert.ok(result.percentages.Asien>before.percentages.Asien);assert.equal(result.repeatedSubjectsWithinRound,0);
 for(const c of ['Nordamerika','Südamerika'])assert.ok(result.percentages[c]>=7);assert.ok(result.percentages.Ozeanien>=3);
});
test('Category training can explore every country, flags stay unweighted, and scoring remains difficulty-based',()=>{
 let state=emptyState();const seen=new Set<string>();for(let run=0;run<12;run++){let r=createRound(state,16,'maps');for(const q of r.questions){assert.ok(!seen.has(questionSubject(q)));seen.add(questionSubject(q));}while(r.status==='playing')r=nextRound(answerRound(r,r.questions[r.cursor].correct));state=recordRound(state,r);}assert.equal(seen.size,192);
 assert.equal(questions.filter(q=>q.enabled&&q.category==='flags').length,585);const q=questions.find(q=>q.id===population[0].id)!;const r={...createRound(emptyState(),8,'world'),questions:[q],cursor:0};assert.equal(answerRound(r,q.correct).answers[0].points,q.difficulty);assert.equal(answerRound(r,(q.correct+1)%4).answers[0].points,0);
});
