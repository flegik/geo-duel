import foundation from '../data/germany/foundation-questions.json';
import cities from '../data/germany/city-questions.json';
import geography from '../data/germany/geography-questions.json';
import other from '../data/germany/other-questions.json';
import states from '../data/germany/states.json';
import towns from '../data/germany/cities.json';
import type {Question} from './engine';

export const germanyQuestions=[...foundation,...cities,...geography,...other] as Question[];
export const germanStates=states;
export const germanCities=towns;
export const stateByName=new Map(states.map(state=>[state.name,state]));
export const stateByCode=new Map(states.map(state=>[state.code,state]));
export const germanFlagPaths=new Set(states.map(state=>state.flag));
export const germanyById=new Map(germanyQuestions.map(question=>[question.id,question]));
const cityNames=new Map(towns.map(city=>[city.name,city.ags]));
const cityKeyById=new Map<string,string>();
for(const q of germanyQuestions){
 const key=germanCityKey(q);
 if(key)cityKeyById.set(q.id,key);
}
export function germanCityKey(q:Question){
 if(q.provenance.germany?.city)return q.provenance.germany.city;
 const city=q.provenance.germany?.cityName;
 if(city)return cityNames.get(city)??city;
 if(q.provenance.subjectKey?.startsWith('de-city:'))return q.provenance.subjectKey.slice(8);
}
export function selectGermany(pool:Question[],count:number,seenIds:string[],random:()=>number){
 const chosen:Question[]=[];
 const lastSubjects=new Map<string,number>();
 const lastCities=new Map<string,number>();
 seenIds.forEach((id,index)=>{
  const q=germanyById.get(id);
  if(!q)return;
  lastSubjects.set(q.provenance.subjectKey!,index);
  const city=cityKeyById.get(q.id);
  if(city)lastCities.set(city,index);
 });
 const recentStart=seenIds.length-48;
 const subjects=new Set<string>();
 const cities=new Set<string>();
 const topics=new Map<string,number>();
 const states=new Map<string,number>();
 for(let i=0;i<count;i++){
  const target=[1,2,3,2][i%4],last=chosen.at(-1);
  let best:Question|undefined, bestScore=Infinity;
  for(const q of pool){
   const subject=q.provenance.subjectKey!,city=cityKeyById.get(q.id);
   if(subjects.has(subject)||(city&&cities.has(city)))continue;
   const topic=q.provenance.topic!,state=q.provenance.germany!.state;
   const age=Math.max(lastSubjects.get(subject)??-1,city?lastCities.get(city)??-1:-1);
   const score=(age>=0&&age>=recentStart?1000:0)
    +(topic===last?.provenance.topic?200:0)+(topics.get(topic)??0)*28
    +(state===last?.provenance.germany?.state?12:0)+(states.get(state)??0)*8
    +(q.difficulty===target?0:9)+(age<0?0:(age+1)/Math.max(1,seenIds.length)*6+2)+random();
   if(score<bestScore){best=q;bestScore=score;}
  }
  if(!best)break;
  chosen.push(best);
  const subject=best.provenance.subjectKey!,city=cityKeyById.get(best.id);
  const topic=best.provenance.topic!,state=best.provenance.germany!.state;
  subjects.add(subject);
  if(city)cities.add(city);
  topics.set(topic,(topics.get(topic)??0)+1);
  states.set(state,(states.get(state)??0)+1);
 }
 return chosen;
}
