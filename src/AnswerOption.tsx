import registry from '../data/flags/registry.json';
import type {QuestionMediaData} from './QuestionMedia';
import './answerOptions.css';

const countries=new Map(registry.map(country=>[country.name,country]));
export const answerLetter=(index:number)=>'ABCD'[index];
export const hasFlagOptions=(media?:QuestionMediaData|null)=>media?.type==='flag-options';

export function AnswerOption({option,media,revealed=false}:{option:string;media?:QuestionMediaData|null;revealed?:boolean}){
 const flag=hasFlagOptions(media)?countries.get(option):undefined;
 if(!flag)return <span>{option}</span>;
 return <span className="flag-option">
  <img src={flag.svg} alt="" decoding="async"/>
  {revealed&&<span>{option}</span>}
 </span>;
}
