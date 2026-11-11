import policy from '../data/learning/selection-policy.json';
import facts from '../data/learning/countries.json';
import {questionSubject} from './flags';
import type {Category,Question} from './engine';
export {policy as selectionPolicy};
export function countryContinent(iso:string){return (policy.continentOverrides as Record<string,string>)[iso]??(policy.subregionContinents as Record<string,string>)[(facts as Record<string,{subregion:string}>)[iso]?.subregion];}
export function worldTopic(q:Question){if(q.provenance.population)return 'population';return ({Naturregionen:'nature',Länderflächen:'area',Binnenstaaten:'landlocked',Kontinente:'continents'} as Record<string,string>)[q.provenance.topic??'']??'general';}
export function weighted<T>(items:T[],weight:(x:T)=>number,random:()=>number){const total=items.reduce((s,x)=>s+weight(x),0);let n=random()*total;for(const item of items){n-=weight(item);if(n<0)return item;}return items[items.length-1];}
// A shared phase spreads the expected Africa count over the round. Each
// category and the round as a whole get at most the ceiling of their targets.
export function regionalAfricaTarget(category:Category){
 return (policy.regionalAfricaTargets as Partial<Record<Category,number>>)[category]??0;
}
export function africaSlots(categories:Category[], perCategory:number, phase:number){
 const slots=new Map<Category,boolean[]>();
 let cumulative=phase*100;
 for(const category of categories){
  const target=regionalAfricaTarget(category);
  if(!target)continue;
  slots.set(category,Array.from({length:perCategory},()=>{
   const previous=Math.floor(cumulative/100);
   cumulative+=target;
   return Math.floor(cumulative/100)>previous;
  }));
 }
 return slots;
}
const questionContinent=(q:Question)=>q.provenance.iso?countryContinent(q.provenance.iso):undefined;

function pickRegional(pool:Question[], difficulty:number, seen:string[], random:()=>number, africaSlot:boolean, recentCountries:ReadonlySet<string>){
 const recent=new Set(seen.slice(-policy.recentQuestionWindow));
 const nonAfrican=pool.filter(q=>questionContinent(q)!=='Afrika');
 const african=pool.filter(q=>questionContinent(q)==='Afrika');
 let candidates=africaSlot&&african.length?african:nonAfrican.length?nonAfrican:african;
 const newSubjects=candidates.filter(q=>!recent.has(questionSubject(q)));
 if(newSubjects.length)candidates=newSubjects;
 const lastSeen=new Map(seen.map((subject,index)=>[subject,index]));
 const age=(q:Question)=>lastSeen.get(questionSubject(q))??-1;
 const unseen=candidates.filter(q=>age(q)===-1);
 if(unseen.length)candidates=unseen;
 if(questionContinent(candidates[0])!=='Afrika'){
  const regions=[...new Set(candidates.map(questionContinent))];
  const weights={...policy.regionalContinentWeights,...(policy.regionalContinentOverrides as Record<string,Record<string,number>>)[pool[0].category]} as Record<string,number>;
  const region=weighted(regions,c=>weights[c??'']??1,random);
  candidates=candidates.filter(q=>questionContinent(q)===region);
 }
 const newCountries=candidates.filter(q=>!recentCountries.has(q.provenance.iso??''));
 if(newCountries.length)candidates=newCountries;
 if(questionContinent(candidates[0])==='Afrika'){
  const focus=candidates.filter(q=>policy.regionalAfricaFocusCountries.includes(q.provenance.iso!));
  const other=candidates.filter(q=>!policy.regionalAfricaFocusCountries.includes(q.provenance.iso!));
  if(focus.length&&other.length)candidates=random()<policy.regionalAfricaFocusShare?focus:other;
 }
 const matching=candidates.filter(q=>q.difficulty===difficulty);
 if(matching.length)candidates=matching;
 if(!unseen.length){
  const oldest=Math.min(...candidates.map(q=>age(q)));
  candidates=candidates.filter(q=>age(q)===oldest);
 }
 return pickSubject(candidates,random);
}

function pickSubject(candidates:Question[],random:()=>number){
 const bySubject=new Map<string,Question[]>();
 for(const q of candidates){
  const subject=questionSubject(q);
  const variants=bySubject.get(subject);
  if(variants)variants.push(q);
  else bySubject.set(subject,[q]);
 }
 const variants=weighted([...bySubject.values()],group=>policy.preferredCountries.includes(group[0].provenance.iso??'')?policy.preferredCountryWeight:1,random);
 return variants[Math.floor(random()*variants.length)];
}

export function pickBalanced(pool:Question[],difficulty:number,seen:string[],random:()=>number,africaSlot?:boolean,recentCountries:ReadonlySet<string>=new Set()){
 if(!pool.length)return undefined;
 if(africaSlot!==undefined)return pickRegional(pool,difficulty,seen,random,africaSlot,recentCountries);
 let candidates=pool;
 if(pool[0].category==='world'){
  const topics=[...new Set(pool.map(worldTopic))];const topic=weighted(topics,t=>(policy.worldTopicWeights as Record<string,number>)[t]??1,random);candidates=pool.filter(q=>worldTopic(q)===topic);
  if(topic==='population'){const kinds=[...new Set(candidates.map(q=>String(q.provenance.population!.kind)))];const kind=weighted(kinds,k=>(policy.populationKindWeights as Record<string,number>)[k]??1,random);candidates=candidates.filter(q=>q.provenance.population!.kind===kind);}
 }
 const continents=[...new Set(candidates.map(q=>q.provenance.iso?countryContinent(q.provenance.iso):'global'))];
 if(!continents.includes('global')){
  const hasAfrica=continents.includes('Afrika'),others=continents.filter(c=>c!=='Afrika');
  const sum=others.reduce((s,c)=>s+(policy.continentWeights as Record<string,number>)[c],0);
  const region=weighted(continents,c=>c==='Afrika'?(others.length?policy.continentWeights.Afrika:100):((hasAfrica?100-policy.continentWeights.Afrika:100)*(policy.continentWeights as Record<string,number>)[c]/sum),random);
  candidates=candidates.filter(q=>countryContinent(q.provenance.iso!)===region);
 }
 // Preserve the target level whenever this regional/topic pool can supply it.
 const matching=candidates.filter(q=>q.difficulty===difficulty);if(matching.length)candidates=matching;
 if(candidates[0]?.provenance.iso&&countryContinent(candidates[0].provenance.iso)==='Afrika'){
  const focus=candidates.filter(q=>policy.africaFocusCountries.includes(q.provenance.iso!)),other=candidates.filter(q=>!policy.africaFocusCountries.includes(q.provenance.iso!));
  if(focus.length&&other.length)candidates=random()<policy.africaFocusShare?focus:other;
 }
 const lastSeen=new Map(seen.map((subject,index)=>[subject,index]));
 const age=(q:Question)=>lastSeen.get(questionSubject(q))??-1;
 const unseen=candidates.filter(q=>age(q)===-1);if(unseen.length)candidates=unseen;
 else {const oldest=Math.min(...candidates.map(q=>age(q)));candidates=candidates.filter(q=>age(q)===oldest);}
 return pickSubject(candidates,random);
}
