import {test} from 'node:test';
import assert from 'node:assert/strict';
import capitals from '../data/question-pool/capitals.json';
import retired from '../data/question-pool/retired.json';
import cityData from '../data/learning/capital-cities.json';
import countries from '../data/learning/countries.json';
import registry from '../data/flags/registry.json';

const updated=capitals.filter(q=>'capitalOptions' in q.provenance);
type City={id:number;name:string;nationalCapital:boolean;historicalSource?:string};
const normalize=(name:string)=>name.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const capital=(iso:string)=>iso==='US'?'Washington, D.C.':countries[iso as keyof typeof countries].capital;
const examples={
 BR:['Brasília','Rio de Janeiro','São Paulo','Salvador'],
 CA:['Ottawa','Toronto','Montréal','Vancouver'],
 AU:['Canberra','Sydney','Melbourne','Brisbane'],
 TR:['Ankara','Istanbul','Izmir','Bursa'],
 US:['Washington, D.C.','New York City','Los Angeles','Chicago'],
};

test('Five requested countries have easy, mixed, and exact all-domestic hard variants',()=>{
 for(const [iso,expected] of Object.entries(examples)){
  const group=updated.filter(q=>q.provenance.iso===iso);
  assert.equal(group.length,3);
  for(const q of group){
   assert.equal(q.options[q.correct],expected[0]);
   assert.equal(q.provenance.capitalOptions!.filter(o=>o.kind==='domesticCity').length,q.difficulty);
   if(q.difficulty===3)assert.deepEqual(new Set(q.options),new Set(expected));
  }
 }
});
test('Each revised question has one correct national capital, cited real city choices, and a retired predecessor',()=>{
 assert.equal(updated.length,135);
 const byId=new Map(retired.map(q=>[q.id,q]));
 const cities=cityData.countries as Record<string,City[]>;
 for(const q of updated){
  const p=q.provenance;
  const options=p.capitalOptions!;
  assert.equal(new Set(q.options.map(normalize)).size,4,q.id);
  assert.deepEqual(q.options,options.map(o=>o.name));
  assert.equal(q.options[q.correct],capital(p.iso));
  assert.deepEqual(options.filter(o=>o.kind==='capital'),[options[q.correct]]);
  assert.equal(options[q.correct].iso,p.iso);
  const predecessor=byId.get(p.replaces!);
  assert.ok(predecessor && !predecessor.enabled && predecessor.id!==q.id);
  assert.equal(predecessor.provenance.subjectKey,p.subjectKey);
  assert.ok(p.sources.includes(cityData.source));
  for(const [index,o] of options.entries()){
   if(index===q.correct)continue;
   if(o.kind==='domesticCity'){
    const city=cities[p.iso].find(c=>c.id===o.cityId);
    assert.ok(city && !city.nationalCapital);
    assert.equal(o.iso,p.iso);
    assert.equal(o.name,city.name);
    if(city.historicalSource)assert.ok(p.sources.includes(city.historicalSource));
   }else{
    assert.equal(o.kind,'regionalCapital');
    assert.notEqual(o.iso,p.iso);
    assert.equal(o.name,capital(o.iso));
   }
   assert.notEqual(normalize(o.name),normalize(q.options[q.correct]));
  }
 }
});
test('All original inverse questions still offer one correct country and complex capital assignments stay out of distractors',()=>{
 const inverse=capitals.filter(q=>q.prompt.startsWith('Zu welchem Land'));
 assert.equal(inverse.length,132);
 for(const q of inverse){
  assert.match(q.id,/^geo-v3-capitals-/);
  assert.equal(q.options[q.correct],registry.find(c=>c.iso===q.provenance.iso)?.name);
  assert.ok(q.options.every(name=>registry.some(c=>c.name===name)));
 }
 assert.ok(updated.filter(q=>q.provenance.iso==='TZ').every(q=>!q.options.includes('Dar es Salaam')));
 for(const iso of ['ZA','LK','BO','CH','NL','PS','IL','GQ','ID','MY','SZ']){
  assert.ok(updated.every(q=>q.provenance.capitalOptions!.every(o=>o.iso!==iso)));
 }
});
