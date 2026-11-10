import policy from '../data/learning/selection-policy.json';
import facts from '../data/learning/countries.json';
import {questionSubject} from './flags';
import type {Question} from './engine';
export {policy as selectionPolicy};
export function countryContinent(iso:string){return (policy.continentOverrides as Record<string,string>)[iso]??(policy.subregionContinents as Record<string,string>)[(facts as Record<string,{subregion:string}>)[iso]?.subregion];}
export function worldTopic(q:Question){if(q.provenance.population)return 'population';return ({Naturregionen:'nature',Länderflächen:'area',Binnenstaaten:'landlocked',Kontinente:'continents'} as Record<string,string>)[q.provenance.topic??'']??'general';}
export function weighted<T>(items:T[],weight:(x:T)=>number,random:()=>number){const total=items.reduce((s,x)=>s+weight(x),0);let n=random()*total;for(const item of items){n-=weight(item);if(n<0)return item;}return items[items.length-1];}
export function pickBalanced(pool:Question[],difficulty:number,seen:string[],random:()=>number){
 if(!pool.length)return undefined;
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
 const unseen=candidates.filter(q=>!seen.includes(questionSubject(q)));if(unseen.length)candidates=unseen;
 else {const oldest=Math.min(...candidates.map(q=>seen.lastIndexOf(questionSubject(q))));candidates=candidates.filter(q=>seen.lastIndexOf(questionSubject(q))===oldest);}
 const subjects=[...new Set(candidates.map(questionSubject))];
 const subject=weighted(subjects,s=>{const q=candidates.find(q=>questionSubject(q)===s)!;return policy.preferredCountries.includes(q.provenance.iso??'')?policy.preferredCountryWeight:1;},random);
 const variants=candidates.filter(q=>questionSubject(q)===subject);return variants[Math.floor(random()*variants.length)];
}
