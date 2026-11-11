import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import questions from '../data/question-pool/landmark-cities.json';
import cityCatalog from '../data/learning/landmark-city-catalog.json';
import photos from '../data/learning/landmark-city-photos.json';
import sites from '../data/learning/unesco-sites.json';
import {answerPreview} from '../src/answerPreview';

const normalize=(text:string)=>text.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
test('42 independently sourced UNESCO buildings and four verified same-country cities per question',()=>{
 assert.equal(questions.length,42);
 assert.ok(questions.filter(q=>q.media).length>=24);
 const cities=new Map(cityCatalog.cities.map(city=>[city.geonameId,city]));
 for(const q of questions){
  const p=q.provenance;
  assert.equal(p.subjectKey,`landmark:${p.siteId}`);
  assert.ok(p.sources.includes(`https://whc.unesco.org/en/list/${p.siteId}/`));
  if(p.siteId!=='91')assert.equal(sites.find(s=>s.id===p.siteId)?.iso,p.iso);
  assert.equal(new Set(q.options).size,4);
  assert.equal(q.options[q.correct],p.cityChoices[q.correct].name);
  assert.ok(q.explanation.includes(q.options[q.correct]));
  for(const choice of p.cityChoices){
   assert.deepEqual(choice,cities.get(choice.geonameId));
   assert.equal(choice.iso,p.iso);
   if(normalize(choice.name).length>3)assert.ok(!normalize(q.prompt).includes(normalize(choice.name)),q.id);
   const preview=answerPreview('landmarks',choice.name,{...p,cityChoices:p.cityChoices.map(c=>({...c,point:c.point as [number,number]}))});
   assert.match(preview.text,/liegt in/);
  }
  if(q.media)assert.ok(readFileSync('public'+q.media.src).length);
 }
 const colosseum=questions.find(q=>q.provenance.siteId==='91')!;
 assert.equal(colosseum.options[colosseum.correct],'Rom');
 assert.deepEqual(new Set(colosseum.options),new Set(['Rom','Mailand','Neapel','Florenz']));
});
test('New photos are bundled with verified attribution and content hashes',()=>{
 for(const [id,photo] of Object.entries(photos)){
  const q=questions.find(question=>question.provenance.siteId===id)!;
  assert.equal(q.media?.src,photo.path);
  assert.equal(q.provenance.imageCredit?.source,photo.source);
  assert.match(photo.source,/^https:\/\/commons.wikimedia.org\/wiki\/File:/);
  assert.ok(photo.author&&photo.licenseUrl.startsWith('https://'));
  assert.equal(createHash('sha256').update(readFileSync('public'+photo.path)).digest('hex'),photo.sha256);
 }
});
