import {writeFileSync} from 'node:fs';
import {createRound,emptyState,questions,answerRound,nextRound,recordRound,type Question} from '../src/engine';
import geography from '../data/atlas/geography.json';
const seed=20261110;let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/2**32;};
const continents=geography.countries as Record<string,{continent:string}>;
const counts:Record<string,number>={},byCategory:Record<string,Record<string,number>>={},difficulty:Record<string,number>={};let eligible=0,core=0,coreAfrica=0,flags=0,global=0;const coreCats=['capitals','silhouettes','maps','borders'];
const rounds=Number(process.env.SIM_ROUNDS??1000);const continuous=process.env.SIM_CONTINUOUS==='1';let state=emptyState();let repeatedInRound=0;let immediateRepeats=0;let previous=new Set<string>();const distinct=new Set<string>();
for(let i=0;i<rounds;i++){
 let r=createRound(state,12,undefined,random);const seen=new Set<string>();for(const q of r.questions){const subject=q.provenance.subjectKey??q.id;distinct.add(subject);if(seen.has(subject))repeatedInRound++;seen.add(subject);if(previous.has(subject))immediateRepeats++;difficulty[q.difficulty]=(difficulty[q.difficulty]??0)+1;
  if(q.category==='flags'){flags++;continue;}const continent=q.provenance.iso?continents[q.provenance.iso]?.continent:undefined;if(!continent){global++;continue;}eligible++;counts[continent]=(counts[continent]??0)+1;const c=byCategory[q.category]??={};c[continent]=(c[continent]??0)+1;if(coreCats.includes(q.category)){core++;if(continent==='Afrika')coreAfrica++;}
 }
 previous=seen;
 if(continuous){while(r.status==='playing')r=nextRound(answerRound(r,0));state=recordRound(state,r);}
}
const percentages=Object.fromEntries(Object.entries(counts).map(([c,n])=>[c,Number((n/eligible*100).toFixed(3))]));
const result={seed,rounds,continuous,questions:rounds*12,eligibleCountryCityQuestions:eligible,flagsExcluded:flags,globalQuestionsExcluded:global,counts,percentages,byCategory,core:{questions:core,africa:coreAfrica,africaPercent:100*coreAfrica/core},difficulty,distinctSubjects:distinct.size,repeatedSubjectsWithinRound:repeatedInRound,subjectsRepeatedFromImmediatelyPreviousRound:immediateRepeats,poolCounts:Object.fromEntries(['capitals','silhouettes','maps','borders','landmarks','world','flags'].map(c=>[c,questions.filter(q=>q.enabled&&q.category===c).length]))};
const path=process.env.SIM_REPORT??'docs/GEOGRAPHY_SIMULATION.json';writeFileSync(path,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
