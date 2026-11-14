import type {QuestionResolution} from './QuestionMedia';
import {africaSlots,pickBalanced,selectionPolicy} from './selection';
import raw from '../data/questions.json';
import {expandedQuestions,retiredQuestions} from './questionPool';
import {flagQuestions,reverseFlagQuestions,questionSubject,seenSubject} from './flags';
import {germanyQuestions,selectGermany} from './germanyPool';
export const categories = {
 flags:{name:'Flaggen',description:'195 Staaten. Originalgetreue Flaggen.',icon:'Flag'},
 maps:{name:'Länder auf Karten',description:'Finde deinen Platz auf der Welt',icon:'Map'},
 capitals:{name:'Hauptstädte',description:'Von Berlin bis Buenos Aires',icon:'Building2'},
 silhouettes:{name:'Länder-Silhouetten',description:'Erkennst du den Umriss?',icon:'Shapes'},
 borders:{name:'Nachbarländer',description:'Was liegt gleich nebenan?',icon:'Signpost'},
 landmarks:{name:'Sehenswürdigkeiten',description:'Die besonderen Orte unserer Erde',icon:'Landmark'},
 world:{name:'Weltwissen',description:'Kleine Fragen, große Welt',icon:'Globe2'},
 germany:{name:'Deutschland',description:'Bundesländer, Städte, Natur und Kultur',icon:'MapPinned'},
} as const;
export type Category=keyof typeof categories;
export type Question={id:string;category:Category;difficulty:number;prompt:string;options:string[];correct:number;explanation:string;media:null|{src:string;alt:string;license:string;type:string};provenance:QuestionResolution&{subjectKey?:string;iso?:string;challenge?:number;confusions?:string[];topic?:string;population?:{[key:string]:unknown}};enabled:boolean};
export const questions:Question[]=[...(raw as Question[]).map(q=>({...q,enabled:false})),...flagQuestions,...reverseFlagQuestions,...expandedQuestions,...retiredQuestions,...germanyQuestions];
const questionById=new Map(questions.map(q=>[q.id,q]));
export type Answer={selected:number;points:number};
export type Round={id:string;mode:'quick'|'training';category?:Category;questions:Question[];answers:Answer[];cursor:number;status:'playing'|'completed';createdAt:string};
export type SoloRecord={id:string;mode:Round['mode'];category?:Category;date:string;points:number;maxPoints:number;correct:number;total:number;categories:Partial<Record<Category,{correct:number;total:number;points:number}>>};
export type SoloState={version:1;round:Round|null;records:SoloRecord[];seen:string[]};
export const emptyState=():SoloState=>({version:1,round:null,records:[],seen:[]});
export function shuffle<T>(values:T[],random:()=>number=Math.random){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function createRound(state:SoloState,count:8|12|16|24,category?:Category,random:()=>number=Math.random):Round{
 const chosen=category?[category]:shuffle(Object.keys(categories) as Category[],random).slice(0,4);
 const per=count/chosen.length;
 const seen=state.seen.map(seenSubject);
 const lastSeen=new Map(seen.map((subject,index)=>[subject,index]));
 const age=(q:Question)=>lastSeen.get(questionSubject(q))??-1;
 const slots=africaSlots(chosen,per,random());
 const recentCountries=new Set(state.seen.slice(-selectionPolicy.recentQuestionWindow).flatMap(id=>{
  const iso=questionById.get(id)?.provenance.iso;
  return iso?[iso]:[];
 }));
 const selected:Question[]=[];
 for(const cat of chosen){
  const pool=shuffle(questions.filter(q=>q.enabled&&q.category===cat),random);
  if(cat==='germany'){
   selected.push(...selectGermany(pool,per,state.seen,random));
   continue;
  }
  const regional=slots.get(cat);
  const balanced=regional||!category&&cat!=='flags';
  if(!balanced)pool.sort((a,b)=>age(a)-age(b));
  const chosenSubjects=new Set<string>();
  for(let i=0;i<per;i++){
   const available=pool.filter(q=>!chosenSubjects.has(questionSubject(q)));
   const target=[1,2,3,2][i%4];
   let q:Question|undefined;
   if(balanced)q=pickBalanced(available,target,seen,random,regional?.[i],recentCountries);
   else{
    // The native flag and world-training paths still exhaust unseen subjects first.
    const oldest=available.length?age(available[0]):-1;
    const eligible=available.filter(q=>age(q)===oldest);
    q=eligible.find(q=>q.difficulty===target)??eligible[0];
   }
   if(q){selected.push(q);chosenSubjects.add(questionSubject(q));}
  }
 }
 const prepared=(category==='germany'?selected:shuffle(selected,random)).map(q=>{const indices=shuffle([0,1,2,3],random);return {...q,options:indices.map(i=>q.options[i]),correct:indices.indexOf(q.correct)};});
 return {id:Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''),mode:category?'training':'quick',...(category?{category}:{}),questions:prepared,answers:[],cursor:0,status:'playing',createdAt:new Date().toISOString()};
}
export function answerRound(round:Round,selected:number):Round{
 if(round.status!=='playing'||round.answers[round.cursor]||!Number.isInteger(selected)||selected<0||selected>3)return round;
 const q=round.questions[round.cursor];return {...round,answers:[...round.answers,{selected,points:selected===q.correct?q.difficulty:0}]};
}
export function nextRound(round:Round):Round{
 if(!round.answers[round.cursor]||round.status==='completed')return round;
 if(round.cursor+1===round.questions.length)return {...round,status:'completed'};
 return {...round,cursor:round.cursor+1};
}
export function recordRound(state:SoloState,round:Round):SoloState{
 let seen=state.seen;
 for(const q of round.questions.slice(0,round.answers.length))seen=[...seen.filter(id=>id!==q.id),q.id];
 if(round.status!=='completed'||state.records.some(r=>r.id===round.id))return {...state,round,seen};
 const record:SoloRecord={id:round.id,mode:round.mode,category:round.category,date:new Date().toISOString(),points:round.answers.reduce((a,b)=>a+b.points,0),maxPoints:round.questions.reduce((a,b)=>a+b.difficulty,0),correct:round.answers.filter(a=>a.points>0).length,total:round.questions.length,categories:{}};
 round.questions.forEach((q,i)=>{const c=record.categories[q.category]??{correct:0,total:0,points:0};c.total++;c.correct+=Number(round.answers[i].points>0);c.points+=round.answers[i].points;record.categories[q.category]=c;});
 return {...state,round,seen,records:[record,...state.records]};
}
export function loadState(storage:Pick<Storage,'getItem'>=localStorage):SoloState{
 try{const v=JSON.parse(storage.getItem('geoduel-solo-v1')??'null');if(v?.version!==1||!Array.isArray(v.records)||!Array.isArray(v.seen))return emptyState();if(v.round&&(!Array.isArray(v.round.questions)||!Array.isArray(v.round.answers)||v.round.cursor<0||v.round.cursor>=v.round.questions.length))v.round=null;return v;}catch{return emptyState();}
}
export function saveState(state:SoloState,storage:Pick<Storage,'setItem'>=localStorage){storage.setItem('geoduel-solo-v1',JSON.stringify(state));}
export function soloSummary(records:SoloRecord[]){const total=records.reduce((s,r)=>s+r.total,0),correct=records.reduce((s,r)=>s+r.correct,0);return {played:records.length,total,correct,accuracy:total?Math.round(correct/total*100):0,points:records.reduce((s,r)=>s+r.points,0)};}
