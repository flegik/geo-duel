import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRound,emptyState,questions} from '../src/engine';
import {flags,questionSubject,seenSubject} from '../src/flags';
import {territoryFlags,territoryFlagQuestions,territoryById,flagImagePath} from '../src/territoryFlags';
import {answerPreview} from '../src/answerPreview';
import {atlasCountries} from '../src/atlasData';

test('236 distinguishable flags retain 195 sovereign atlas entries and 41 sourced native SVGs',()=>{
 assert.equal(flags.length,195);
 assert.equal(atlasCountries.length,195);
 assert.equal(territoryFlags.length,41);
 assert.equal(new Set([...flags,...territoryFlags].map(flag=>flag.name)).size,236);
 assert.equal(new Set([...flags,...territoryFlags].map(flag=>flag.sha256)).size,236);
 for(const flag of territoryFlags){
  assert.match(flag.id,/^territory-[a-z]{2}(?:-[a-z]{2,3})?$/);
  assert.ok(flag.ratio>0&&flag.source.startsWith('https://')&&flag.statusSource.startsWith('https://'));
  const svg=readFileSync(`public${flag.svg}`,'utf8');
  assert.match(svg,/<svg\b/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\bonload=/i);
  assert.equal(createHash('sha256').update(svg).digest('hex'),flag.sha256);
 }
 assert.equal(territoryById.get('territory-xk')?.iso3166_1,null);
 assert.equal(territoryById.get('territory-bq-bo')?.iso3166_2,'BQ-BO');
 assert.equal(territoryById.get('territory-mq')?.flagStatus,'territorial');
 assert.equal(territoryById.get('territory-nc')?.flagStatus,'kanak');
});
test('160 new questions have four unique options, verified answers and shared learning subjects',()=>{
 assert.equal(territoryFlagQuestions.length,160);
 assert.equal(questions.filter(q=>q.category==='flags'&&q.enabled).length,940);
 assert.equal(new Set(territoryFlagQuestions.map(q=>q.id)).size,160);
 for(const q of territoryFlagQuestions){
  const flag=territoryById.get(q.provenance.territoryId!)!;
  const variant=q.id.split('-').at(-1);
  assert.equal(q.options.length,4);
  assert.equal(new Set(q.options).size,4);
  assert.ok([1,2,3].includes(q.difficulty));
  assert.equal(q.options[q.correct],variant==='region'?flag.region:variant==='affiliation'?flag.affiliation:flag.name);
  assert.equal(questionSubject(q),`flag:${flag.id}`);
  assert.equal(seenSubject(q.id),questionSubject(q));
  if(variant==='affiliation')assert.ok(!['disputed','associated','crown'].includes(flag.kind));
  if(q.media?.type==='flag-options')assert.equal(new Set(q.options.map(option=>flagImagePath(option))).size,4);
  assert.equal(answerPreview('flags',flag.name,q.provenance).src,flag.svg);
 }
 for(const code of ['ky','aw','cw','bq-bo','sx','mq','gb-sct','fo','tw','xk']){
  assert.ok(territoryFlagQuestions.some(q=>q.id===`flag-territory-v1-${code}-reverse`));
 }
});
test('territory subjects enter normal solo flag rounds without repeats',()=>{
 const found=new Set<string>();
 let seen:string[]=[];
 for(let i=0;i<25;i++){
  const round=createRound({...emptyState(),seen},16,'flags');
  const subjects=round.questions.map(questionSubject);
  assert.equal(new Set(subjects).size,16);
  assert.ok(subjects.every(subject=>!seen.slice(-16).map(seenSubject).includes(subject)));
  round.questions.filter(q=>q.provenance.territoryId).forEach(q=>found.add(q.provenance.territoryId!));
  seen=[...seen,...round.questions.map(q=>q.id)];
 }
 assert.equal(found.size,41);
});
