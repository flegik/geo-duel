import {writeFileSync} from 'node:fs';
import registry from '../data/flags/registry.json';
import facts from '../data/learning/countries.json';
import {createRound,emptyState,questions,type Category,type Question} from '../src/engine';
import {questionSubject} from '../src/flags';
import {countryContinent,pickBalanced} from '../src/selection';
import * as selection from '../src/selection';

const seed=20261111;
const regularSizes=[8,12,16] as const;
const categoryList=['borders','capitals','silhouettes','maps','landmarks','world','flags'] as const;
const labels=new Map(registry.map(c=>[c.name,c.iso]));
for(const [iso,country] of Object.entries(facts))if(country.capital)labels.set(country.capital,iso);
const borderPool=questions.filter(q=>q.enabled&&q.category==='borders');

type Count=Record<string,number>;
const bump=(record:Count,key:string)=>record[key]=(record[key]??0)+1;
const africa=(q:Question)=>countryContinent(q.provenance.iso??'')==='Afrika';
function suite(mode:'regular'|'borders'|'live-size-borders',longHistory:boolean){
 let x=seed;
 const random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/2**32;};
 const rounds=mode==='regular'?5000:1000;
 const history:[string[],string[]]=[[],[]];
 const remember=(track:string[],ids:string[])=>[...track.filter(id=>!ids.includes(id)),...ids];
 const byCategory:Record<string,{focus:Count;distractors:Count;africanDistractorsPerQuestion:Count;africaPerCategoryRound:Count}>={};
 const africaPerRound:Count={}, consecutiveAfricaCounts:Count={};
 let repeatsWithin=0,repeatsFromPrevious=0,sameAfricanFocusFromPrevious=0,preferredAfricanFocus=0,africanFocus=0;
 let previousSubjects=new Set<string>(),previousCountries=new Set<string>(),previousAfrica=0;
 for(let i=longHistory?-50:0;i<rounds;i++){
  if(!longHistory&&i%10===0){history.fill([]);previousSubjects.clear();previousCountries.clear();}
  const state={...emptyState(),seen:history[0]};
  const slots='africaSlots' in selection?selection.africaSlots as (c:Category[],n:number,p:number)=>Map<Category,boolean[]>:undefined;
  let chosen:Question[];
  if(mode==='regular')chosen=createRound(state,regularSizes[(i+51)%3],undefined,random).questions;
  else{
   // Mirrors duel slot and two-participant history input. SQL is exercised independently.
   const size=mode==='borders'?12:2+(i+51)%3;
   const schedule=slots?.(['borders'],size,random()).get('borders');
   const both=[...new Set([...history[0].slice(0,-16),...history[1].slice(0,-16),...history[0].slice(-16),...history[1].slice(-16)])];
   const bothSubjects=both.map(id=>byId.get(id)).filter(Boolean).map(q=>questionSubject(q!));
   const recentCountries=new Set(both.slice(-32).flatMap(id=>byId.get(id)?.provenance.iso??[]));
   const picked=new Set<string>();
   chosen=Array.from({length:size},(_,slot)=>{
    const args=[borderPool.filter(q=>!picked.has(questionSubject(q))),[1,2,3,2][slot%4],bothSubjects,random,schedule?.[slot],recentCountries] as const;
    const q=Reflect.apply(pickBalanced,null,args) as Question;
    picked.add(questionSubject(q));
    return q;
   });
  }
  history[0]=remember(history[0],chosen.map(q=>q.id));
  history[1]=remember(history[1],chosen.map(q=>q.id));
  if(mode!=='regular'){
   // Add independent off-round history to both profiles.
   history[0]=remember(history[0],[borderPool[Math.floor(random()*borderPool.length)].id]);
   history[1]=remember(history[1],[borderPool[Math.floor(random()*borderPool.length)].id]);
  }
  if(i<0)continue;
  const currentSubjects=new Set<string>(),currentCountries=new Set<string>();
  let africaInRound=0;
  for(const category of categoryList){
   const group=chosen.filter(q=>q.category===category);
   if(!group.length)continue;
   const stats=byCategory[category]??={focus:{},distractors:{},africanDistractorsPerQuestion:{},africaPerCategoryRound:{}};
   let africaInCategory=0;
   for(const q of group){
    const subject=questionSubject(q);
    if(currentSubjects.has(subject))repeatsWithin++;
    if(previousSubjects.has(subject))repeatsFromPrevious++;
    currentSubjects.add(subject);
    if(q.category==='flags')continue;
    const iso=q.provenance.iso??'';
    bump(stats.focus,countryContinent(iso)??'global');
    if(africa(q)){
     if(previousCountries.has(iso))sameAfricanFocusFromPrevious++;
     currentCountries.add(iso);
     africaInCategory++;
     if(['EG','ZA','NG','MA','DZ','TN','KE','ET','TZ','GH'].includes(iso))preferredAfricanFocus++;
     africanFocus++;
    }
    let africaOptions=0;
    q.options.forEach((label,index)=>{
     if(index===q.correct)return;
     const data=q.provenance as Question['provenance']&{capitalOptions?:{name:string;iso:string}[]};
     const distractorIso=data.capitalOptions?.find(city=>city.name===label)?.iso??labels.get(label);
     const region=countryContinent(distractorIso??'')??'unclassified';
     bump(stats.distractors,region);
     if(region==='Afrika')africaOptions++;
    });
    bump(stats.africanDistractorsPerQuestion, String(africaOptions));
   }
   bump(stats.africaPerCategoryRound,String(africaInCategory));
   if(category!=='world')africaInRound+=africaInCategory;
  }
  bump(africaPerRound,String(africaInRound));
  if(i&&(longHistory||i%10))bump(consecutiveAfricaCounts,`${previousAfrica} → ${africaInRound}`);
  previousAfrica=africaInRound;
  previousSubjects=currentSubjects;
  previousCountries=currentCountries;
 }
 return {mode,rounds,longHistory,repeatsWithin,repeatsFromPrevious,sameAfricanFocusFromPrevious,
  preferredAfricanFocus,africanFocus,africaPerRound,consecutiveAfricaCounts,byCategory};
}
const byId=new Map(questions.map(q=>[q.id,q]));
const report=[false,true].flatMap(longHistory=>(['regular','borders','live-size-borders'] as const).map(mode=>suite(mode,longHistory)));
writeFileSync(process.argv[2],JSON.stringify({seed,report},null,2)+'\n');
