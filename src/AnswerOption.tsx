import registry from '../data/flags/registry.json';
import type {QuestionMediaData} from './QuestionMedia';
import './answerOptions.css';
import {germanFlagPaths,stateByName} from './germanyPool';

const countries=new Map(registry.map(country=>[country.name,country]));
const flagPaths=new Set(registry.map(country=>country.svg));
export const answerLetter=(index:number)=>'ABCD'[index];
export const hasFlagOptions=(media?:QuestionMediaData|null)=>media?.type==='flag-options';

export function AnswerOption({option,media,revealed=false}:{option:string;media?:QuestionMediaData|null;revealed?:boolean}){
 const image=hasFlagOptions(media)?(media?.src==='choice:de-flags'?
  stateByName.get(option)?.flag??(germanFlagPaths.has(option)?option:undefined):
  countries.get(option)?.svg??(flagPaths.has(option)?option:undefined)):undefined;
 if(!image)return <span>{option}</span>;
 return <span className="flag-option">
  <img src={image} alt="" decoding="async"/>
  {revealed&&<span>{option}</span>}
 </span>;
}
