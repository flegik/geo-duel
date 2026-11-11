import {QuestionMedia,QuestionImageCredit} from './QuestionMedia';
import {useState} from 'react';
import {AnswerDiscovery} from './AnswerDiscovery';
import {AnswerOption,answerLetter,hasFlagOptions} from './AnswerOption';
import type {Question} from './engine';

export function SoloReviewOptions({question,selected}:{question:Question;selected?:number}){
 const [preview,setPreview]=useState<number|null>(null);
 return <>
  {question.provenance.cityChoices&&question.media&&<>
   <div className="question-image landmarks"><QuestionMedia media={question.media}/></div>
   <QuestionImageCredit credit={question.provenance.imageCredit}/>
  </>}
  {question.media?.type==='city-map'&&<QuestionMedia media={question.media} options={question.options}
   location={question.provenance.cityLocation} correct={question.correct} selected={selected} onSelect={setPreview}/>}
  <div className={hasFlagOptions(question.media)?'answers flag-options':'answers'}>
   {question.options.map((option,index)=><button key={index} type="button"
     className={`answer ${index===question.correct?'correct':index===selected?'incorrect':''}`}
     aria-label={`Entdecken: ${option}${index===question.correct?', richtige Lösung':''}`}
     aria-pressed={preview===index} onClick={()=>setPreview(preview===index?null:index)}>
     <span className="letter" aria-hidden="true">{answerLetter(index)}</span>
     <AnswerOption option={option} media={question.media} revealed/>
   </button>)}
  </div>
  <AnswerDiscovery category={question.category} options={question.options} selected={preview} onSelect={setPreview} resolution={question.provenance}/>
 </>;
}
