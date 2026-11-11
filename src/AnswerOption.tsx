import registry from '../data/flags/registry.json';
import type {QuestionMediaData} from './QuestionMedia';
import './answerOptions.css';

const countries=new Map(registry.map(country=>[country.name,country]));
const flagPaths=new Set(registry.map(country=>country.svg));
export const answerLetter=(index:number)=>'ABCD'[index];
export const hasFlagOptions=(media?:QuestionMediaData|null)=>media?.type==='flag-options';

export function AnswerOption({option,media,revealed=false}:{option:string;media?:QuestionMediaData|null;revealed?:boolean}){
 const image=hasFlagOptions(media)?countries.get(option)?.svg??(flagPaths.has(option)?option:undefined):undefined;
 if(!image)return <span>{option}</span>;
 return <span className="flag-option">
  <img src={image} alt="" decoding="async"/>
  {revealed&&<span>{option}</span>}
 </span>;
}
