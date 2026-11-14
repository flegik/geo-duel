import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {categories,createRound,emptyState,recordRound,nextRound,answerRound} from '../src/engine';
import {germanyQuestions,germanCityKey,germanStates,germanCities,stateByCode} from '../src/germanyPool';
import {projectGermanyPoint} from '../src/germanyProjection';
import map from '../data/germany/map.json';
import plates from '../data/germany/plates.json';
import {answerPreview} from '../src/answerPreview';

const answer=(q:typeof germanyQuestions[number])=>q.options[q.correct];
const unique=<T>(items:T[])=>new Set(items).size;
const names=(codes:string[])=>codes.map(c=>stateByCode.get(c)!.name);
const groups=Object.groupBy(germanyQuestions,q=>q.provenance.topic!);
const points=new Map(germanCities.map(c=>[c.ags,c]));
const stateName=(code:string)=>stateByCode.get(code)!.name;
test('Alle 970 Deutschlandfragen mit zehn Unterthemen, eindeutigen Lösungen, Quellen und neutralen Medien',()=>{
 assert.equal(Object.keys(categories).length,8);
 assert.deepEqual(Object.fromEntries(Object.entries(groups).map(([topic,items])=>[topic,items!.length])),{
  'state-map':48,'state-flag':64,capital:64,'city-state':180,'city-map':120,'state-border':80,nature:114,landmark:100,plate:120,statistics:80});
 assert.equal(unique(germanyQuestions.map(q=>q.id)),970);
 assert.ok(unique(germanyQuestions.map(q=>q.provenance.subjectKey))>=400);
 const fingerprints=new Set<string>();
 for(const q of germanyQuestions){
  const fingerprint=[q.prompt,q.media?.src,[...q.options].sort().join('|')].join('#');
  assert.ok(!fingerprints.has(fingerprint),q.id);
  fingerprints.add(fingerprint);
  assert.equal(unique(q.options),4);
  assert.ok(answer(q));
  assert.ok([1,2,3].includes(q.difficulty));
  assert.ok(q.provenance.sources.every(u=>u.startsWith('https://')));
  assert.ok(q.explanation.length>20);
  assert.doesNotMatch(q.media?.type??'',/silhouette/);
  if(q.media){
   assert.ok(!q.media.alt.includes(answer(q)),q.id);
   assert.ok(!q.media.src.includes(answer(q)),q.id);
  }
 }
});
test('16 Landesflaggen in Originalproportionen und 16 vollständige Landesgrenzen',()=>{
 const ratio:Record<string,number>={SH:5/3,HH:3/2,NI:1150/750,HB:3/2,NW:5/3,HE:5/3,RP:3/2,BW:5/3,BY:5/3,SL:5/3,BE:5/3,BB:5/3,MV:5/3,SN:5/3,ST:5/3,TH:2};
 assert.equal(map.paths.length,16);
 assert.equal(unique(map.paths.map(p=>p.code)),16);
 for(const s of germanStates){
  const file=readFileSync('public'+s.flag,'utf8').replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(file).digest('hex'),s.flagHash);
  const svg=file.match(/<svg\b[^>]*>/s)![0];
  const box=svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  const width=box?.[2]??Number(svg.match(/\bwidth="([^"]+)"/)?.[1]);
  const height=box?.[3]??Number(svg.match(/\bheight="([^"]+)"/)?.[1]);
  assert.ok(Math.abs(width/height-ratio[s.code])<.00001,s.code);
  assert.ok(/^M[\d.,MLZ-]+Z$/.test(map.paths.find(p=>p.code===s.code)!.path),s.code);
  assert.equal(points.get(s.capitalAgs)?.name,s.capital);
 }
 for(const q of groups['state-map']!){
  const s=stateByCode.get(q.provenance.germany!.state)!;
  assert.equal(answer(q),s.name);
  assert.equal(q.media?.src,'de-map:'+s.mapKey);
 }
});
test('AGS, Ortszuordnungen und Kartenpunkte verwenden die verifizierte WGS84-Quelle',()=>{
 assert.equal(unique(germanCities.map(c=>c.ags)),180);
 const [left,top,width,height]=map.viewBox.split(' ').map(Number);
 for(const q of groups['city-state']!){
  const c=points.get(q.provenance.germany!.city!)!;
  assert.equal(answer(q),stateName(c.state));
 }
 for(const q of groups['city-map']!){
  const c=points.get(q.provenance.germany!.city!)!;
  const [x,y]=projectGermanyPoint(c.point);
  assert.ok(x>left&&x<left+width&&y>top&&y<top+height,c.name);
  assert.equal(answer(q),c.name);
  assert.equal(q.media?.src,'de-point:'+c.point.join(','));
  assert.ok(q.provenance.germany!.cityChoices?.length===4);
  assert.deepEqual(answerPreview('germany',c.name,q.provenance).dePoint,c.point);
 }
 assert.ok(projectGermanyPoint([13.41053,52.52437])[0]>projectGermanyPoint([9.99302,53.55073])[0]);
});
test('Nachbarn folgen der symmetrischen BKG-Topologie und jede Option ist auswertbar',()=>{
 const lookup=Object.fromEntries(germanStates.map(s=>[s.code,s.neighbors]));
 assert.deepEqual(lookup.BE,['BB']);
 assert.deepEqual(lookup.HB,['NI']);
 assert.deepEqual(lookup.HH,['NI','SH']);
 assert.deepEqual(lookup.SL,['RP']);
 for(const [s,neighbors] of Object.entries(lookup))for(const n of neighbors)assert.ok(lookup[n].includes(s));
 for(const q of groups['state-border']!){
  const audit=(q.provenance.germany as unknown as {border:{of:string;kind:string}}).border;
  const neighbors=names(lookup[audit.of]);
  const relevant=(v:string)=>audit.kind==='yes'?neighbors.includes(v):audit.kind==='no'?!neighbors.includes(v):
   audit.kind==='count'?Number(v)===neighbors.length:neighbors.toSorted().join(',')===v.split(', ').toSorted().join(',');
  assert.deepEqual(q.options.filter(relevant),[answer(q)],q.id);
 }
});
test('Aktuelle, eindeutige Kennzeichen und ausreichend getrennte amtliche Vergleichswerte',()=>{
 assert.equal(plates.length,109);
 assert.equal(unique(plates.map(p=>p.code)),109);
 for(const [code,name] of Object.entries({MA:'Mannheim',LU:'Ludwigshafen am Rhein',HD:'Heidelberg',F:'Frankfurt am Main',HH:'Hamburg'})){
  assert.equal(plates.find(p=>p.code===code)?.name,name);
 }
 for(const q of groups.plate!){
  const audit=q.provenance.germany as unknown as {plate:string;state:string};
  assert.equal(plates.find(p=>p.code===audit.plate)?.state,audit.state);
  assert.match(q.explanation,/16\.04\.2026/);
 }
 for(const q of groups.statistics!){
  const stat=q.provenance.germany!.stat!;
  assert.equal(stat.year,2024);
  assert.equal(stat.date,'31.12.2024');
  if(stat.mode==='estimate'){
   const input=Number(answer(q).replace(/[^0-9]/g,''));
   assert.ok(stat.step&&Math.abs(input-stat.values[0].value)<=stat.step/2);
   continue;
  }
  const [correct,...others]=stat.values;
  assert.equal(correct.name,answer(q));
  assert.ok(others.every(r=>stat.mode==='max'?correct.value/r.value>=1.22:r.value/correct.value>=1.22));
 }
});
test('Deutschlandtraining mischt Themen, Länder und Punkte ohne Wiederholung über Folgerunden',()=>{
 let history=emptyState();
 let previous=new Set<string>();
 for(const size of [12,16,24,24,12] as const){
  let round=createRound(history,size,'germany');
  const picked=round.questions;
  const subjects=picked.map(q=>q.provenance.subjectKey!);
  assert.equal(picked.length,size);
  assert.equal(unique(subjects),size);
  assert.ok(subjects.every(s=>!previous.has(s)));
  assert.ok(unique(picked.map(q=>q.provenance.topic))>=9);
  assert.ok(unique(picked.map(q=>q.provenance.germany!.state))>=Math.min(10,size));
  assert.equal(unique(picked.map(q=>q.difficulty)),3);
  const cities=picked.map(germanCityKey).filter(Boolean);
  assert.equal(unique(cities),cities.length);
  assert.ok(picked.every((q,i)=>q.provenance.topic!==picked[i-1]?.provenance.topic));
  while(round.status==='playing')round=nextRound(answerRound(round,round.questions[round.cursor].correct));
  history=recordRound(history,round);
  assert.equal(history.records[0].categories.germany?.correct,size);
  previous=new Set(subjects);
 }
});
