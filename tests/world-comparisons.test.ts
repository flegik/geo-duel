import {test} from 'node:test';
import assert from 'node:assert/strict';
import questions from '../data/question-pool/world-comparisons.json';
import catalog from '../data/learning/world-comparison-sources.json';
import oldWorld from '../data/question-pool/world.json';
import oldPopulation from '../data/question-pool/population.json';
import {answerPreview} from '../src/answerPreview';
import {countryContinent,worldTopic} from '../src/selection';
import type {Question} from '../src/engine';

const choicesKey=(q:{options:string[]})=>q.options.toSorted().join('\0');
test('64 original comparisons use consistent definitions and zero African options',()=>{
 assert.equal(questions.length,64);
 assert.equal(new Set(questions.map(choicesKey)).size,64);
 const old=new Set([...oldWorld,...oldPopulation].map(choicesKey));
 const focusRegions=new Set();
 for(const q of questions){
  const p=q.provenance,c=p.comparison;
  const source=catalog[c.metric as keyof typeof catalog];
  assert.equal(c.year,source.source.year);
  assert.equal(c.year,c.metric==='cityPopulation'?2025:2023);
  assert.equal(worldTopic(q as Question),'comparisons');
  assert.ok(p.sources.includes(source.source.url)&&p.sources.includes(source.source.download));
  assert.ok(!old.has(choicesKey(q)));
  assert.equal(q.options.length,4);
  assert.deepEqual(new Set(q.options),new Set(c.values.map(v=>v.name)));
  assert.equal(new Set(c.values.map(v=>v.display)).size,4);
  assert.equal(c.values[c.rank-1].name,q.options[q.correct]);
  focusRegions.add(countryContinent(p.iso));
  for(const [index,value] of c.values.entries()){
   assert.equal(source.records.find(r=>r.id===value.id)?.value,value.value);
   assert.ok(countryContinent(value.iso)&&countryContinent(value.iso)!=='Afrika');
   assert.ok(q.explanation.includes(value.display));
   assert.ok(answerPreview('world',value.name,p).text.includes(value.display));
   if(index)assert.ok(c.values[index-1].value/value.value>=c.minimumRatio);
  }
 }
 assert.equal(focusRegions.size,5);
 for(const metric of Object.keys(catalog))for(const rule of ['max','min','rank2','rank3'])
  assert.equal(questions.filter(q=>q.provenance.comparison.metric===metric&&q.provenance.comparison.rule===rule).length,4);
});
