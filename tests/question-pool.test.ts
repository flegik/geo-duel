import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {expandedQuestions} from '../src/questionPool';import {answerRound,createRound,emptyState,nextRound,recordRound,questions} from '../src/engine';import {questionSubject,flagQuestions} from '../src/flags';import registry from '../data/flags/registry.json';import facts from '../data/learning/countries.json';import capitals from '../data/learning/capital-audit.json';import borderAudit from '../data/learning/borders-audit.json';import sites from '../data/learning/unesco-sites.json';import geo from '../data/atlas/geography.json';import {mapViewport} from '../src/mapViewport';
const codes=Object.keys(facts) as (keyof typeof facts)[];const byName=new Map(registry.map(c=>[c.name,c.iso]));
test('Expanded data: exact targets, opaque IDs, four choices, sources, historical rows retained',()=>{
 const expected={capitals:292,silhouettes:195,maps:396,borders:294,landmarks:162,world:334};
 assert.equal(expandedQuestions.length,1673);assert.equal(new Set(expandedQuestions.map(q=>q.id)).size,1673);
 for(const [cat,count] of Object.entries(expected))assert.equal(expandedQuestions.filter(q=>q.category===cat).length,count);
 for(const q of expandedQuestions){assert.match(q.id,/^(geo-v3-[a-z]+-[a-f0-9]{16}|(?:population-v1|capital-cities-v1|city-map-v1|landmark-city-v1|world-compare-v1)-[a-f0-9]{20})$/);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<=3);assert.ok(q.provenance.subjectKey);assert.ok(q.explanation.length>30);assert.ok(q.provenance.sources.every(s=>s.startsWith('https://')));}
 const raw=JSON.parse(readFileSync('data/questions.json','utf8'));for(const old of raw){const found=questions.find(q=>q.id===old.id);assert.deepEqual(found,{...old,enabled:false});}assert.equal(flagQuestions.length,585);
});
test('All 132 included capitals have audit evidence; both directions share one learning subject',()=>{
 assert.equal(capitals.filter(c=>c.capitalIncluded).length,132);for(const iso of codes.filter(c=>facts[c].capital)){
  const pair=expandedQuestions.filter(q=>q.category==='capitals'&&q.provenance.iso===iso);assert.ok(pair.length>=2);assert.equal(new Set(pair.map(questionSubject)).size,1);assert.ok(pair.some(q=>q.options[q.correct]===(iso==='US'?'Washington, D.C.':facts[iso].capital)));assert.ok(pair.some(q=>q.options[q.correct]===registry.find(c=>c.iso===iso)!.name));
 }
 for(const iso of ['ZA','LK','BO','CH','NL','PS','IL','GQ'])assert.equal(facts[iso as keyof typeof facts].capital,null);
});
test('Map/outline coverage complete; maps have regional choices; Brazil cannot be an ISO-collision polygon',()=>{
 for(const cat of ['maps','silhouettes']){const qs=expandedQuestions.filter(q=>q.category===cat&&q.media?.type!=='city-map');assert.equal(new Set(qs.map(q=>q.provenance.iso)).size,195);for(const q of qs){const iso=q.provenance.iso as keyof typeof geo.countries;assert.equal(q.media!.src,'atlas:'+iso);assert.equal(q.options[q.correct],registry.find(c=>c.iso===iso)!.name);for(const option of q.options)assert.ok(byName.has(option));if(cat==='maps')for(const c of q.provenance.confusions!)assert.equal(geo.countries[c as keyof typeof geo.countries].continent,geo.countries[iso].continent);}}
 assert.ok(geo.countries.BR.path.length>10000);assert.ok(geo.countries.BR.height/geo.countries.BR.width>.7);
 const va=mapViewport(geo.world.filter(f=>f.iso==='VA').map(f=>f.path));assert.equal(va.tiny,true);assert.ok(va.width<30);assert.ok(!va.viewBox.includes('NaN'));const fj=mapViewport(geo.world.filter(f=>f.iso==='FJ').map(f=>f.path));assert.ok(fj.width<200,'Date-line countries must have a compact regional map');
});
test('Every positive and negative border choice is consistent with the conservative audit',()=>{
 for(const q of expandedQuestions.filter(q=>q.category==='borders')){const iso=q.provenance.iso as keyof typeof facts;const p=q.provenance as typeof q.provenance&{relation:string};for(let i=0;i<4;i++){const other=byName.get(q.options[i])!;const adjacent=(borderAudit.verified[iso] as string[]).includes(other);const blocked=(borderAudit.blocked[iso] as string[]).includes(other);if(p.relation==='adjacent'){if(i===q.correct)assert.ok(adjacent);else assert.ok(!blocked);}else{if(i===q.correct)assert.ok(!blocked);else assert.ok(adjacent);}}}
 // Raw maritime false-positive must never turn into a land-border question.
 assert.ok(!(borderAudit.verified.LK as string[]).includes('IN'));
});
test('Additional landmarks/nature regions correspond to single-country UNESCO entries',()=>{
 for(const q of expandedQuestions.filter(q=>q.id.startsWith('geo-v3-landmarks')||q.category==='world'&&q.provenance.subjectKey?.startsWith('world:nature:'))){const p=q.provenance as typeof q.provenance&{siteId?:string};const id=p.siteId??q.provenance.subjectKey!.split(':').at(-1);if(id==='91')continue;const s=sites.find(s=>s.id===id)!;assert.ok(s);assert.equal(s.iso,q.provenance.iso);assert.ok(q.provenance.sources.includes(s.source));}
});
test('Capital directions share a subject and never repeat in consecutive rounds',()=>{
 let state=emptyState();const seen=new Set<string>();for(let n=0;n<8;n++){let r=createRound(state,16,'capitals');for(const q of r.questions)assert.ok(!seen.has(questionSubject(q)));seen.clear();for(const q of r.questions)seen.add(questionSubject(q));while(r.status==='playing')r=nextRound(answerRound(r,0));state=recordRound(state,r);}assert.equal(seen.size,16);
});
test('Round difficulty targets distribute 1/2/3 points while new subjects remain',()=>{const round=createRound(emptyState(),16,'maps',()=>.4);assert.deepEqual([1,2,3].map(d=>round.questions.filter(q=>q.difficulty===d).length),[4,8,4]);});
test('Country-revealing UNESCO prompts are retired immutably and replaced with distinct site IDs',()=>{
 const removed=new Set(['915','135','65','599','1499','699','1483','1245','286']);
 const retired=questions.filter(q=>q.category==='landmarks'&&!q.enabled&&q.id.startsWith('geo-v3-'));
 assert.equal(retired.length,9);
 for(const q of retired){const siteId=(q.provenance as typeof q.provenance&{siteId:string}).siteId;assert.ok(removed.has(siteId));assert.ok(!expandedQuestions.some(n=>n.id===q.id));}
 for(const q of expandedQuestions.filter(q=>q.category==='landmarks'&&q.media===null))assert.ok(!removed.has((q.provenance as typeof q.provenance&{siteId:string}).siteId));
});
