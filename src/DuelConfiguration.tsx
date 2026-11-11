import type {ReactNode} from 'react';
import {Minus,Plus} from 'lucide-react';
import {categories,type Category} from './engine';
import {adjustQuestionCount,countQuestions,duelCategories,maxDuelQuestions,minDuelQuestions,type DuelConfigUpdate,type QuestionCounts} from './duelConfiguration';

const presets:{label:string;counts:QuestionCounts}[]=[
 {label:'12× Flaggen',counts:{flags:12}},
 {label:'16× Flaggen',counts:{flags:16}},
 {label:'8× Flaggen + 8× Karten',counts:{flags:8,maps:8}},
];
const equal=(a:QuestionCounts,b:QuestionCounts)=>duelCategories.every(c=>(a[c]??0)===(b[c]??0));
const lengths=[2,3,4] as const;

export function DuelConfiguration({counts,perCategory,host,disabled,saving,onChange,icon}:{
 counts:QuestionCounts|null;perCategory:2|3|4;host:boolean;disabled:boolean;saving:boolean;
 onChange:(update:DuelConfigUpdate)=>void;icon:(category:Category)=>ReactNode;
}){
 const total=counts===null?perCategory*4:countQuestions(counts);
 return <section className="panel duel-configuration" aria-labelledby="duel-configuration-title">
  <div className="section-heading">
   <h2 id="duel-configuration-title">Duellkonfiguration</h2>
   {!host&&<span>{counts===null?'Zufälliges Duell':'Eigenes Duell'}</span>}
  </div>
  {host&&<div className="duel-presets" role="group" aria-label="Duellvorlagen">
   {presets.map(preset=><button type="button" key={preset.label} disabled={disabled}
    aria-pressed={counts!==null&&equal(counts,preset.counts)} onClick={()=>onChange({questionCounts:preset.counts})}>{preset.label}</button>)}
   <button type="button" disabled={disabled} aria-pressed={counts===null}
    onClick={()=>onChange({randomCategories:true,perCategory})}>Vier Kategorien zufällig</button>
   <button type="button" disabled={disabled} aria-pressed={counts!==null}
    onClick={()=>{if(counts===null)onChange({questionCounts:{}});}}>Eigene Zusammenstellung</button>
  </div>}
  {counts===null?<div className="duel-random">
   <p>Vier verschiedene Kategorien werden beim Start ausgelost. Pro Kategorie {perCategory} Fragen.</p>
   {host&&<div className="segmented" role="group" aria-label="Fragenanzahl im Zufallsduell">
    {lengths.map(n=><button type="button" key={n} disabled={disabled}
     className={perCategory===n?'selected':''} aria-pressed={perCategory===n}
     onClick={()=>onChange({randomCategories:true,perCategory:n})}><strong>{4*n}</strong><span>Fragen</span></button>)}
   </div>}
  </div>:<div className="duel-counts">
   {duelCategories.filter(category=>host||(counts[category]??0)>0).map(category=>{
    const amount=counts[category]??0;
    const name=categories[category].name;
    return <div key={category} className={`duel-count-row${amount===0?' inactive':''}`}>
     <span className="duel-count-name">{icon(category)}<span>{name}</span></span>
     {host?<div className="duel-stepper" role="group" aria-label={name}>
      <button type="button" aria-label={`${name}: eine Frage weniger`} disabled={disabled||amount===0}
       onClick={()=>onChange({questionCounts:adjustQuestionCount(counts,category,-1)})}><Minus size={17}/></button>
      <output aria-label={`${name}: Fragenanzahl`}>{amount}</output>
      <button type="button" aria-label={`${name}: eine Frage mehr`} disabled={disabled||total>=maxDuelQuestions}
       onClick={()=>onChange({questionCounts:adjustQuestionCount(counts,category,1)})}><Plus size={17}/></button>
     </div>:<strong>{amount} {amount===1?'Frage':'Fragen'}</strong>}
    </div>;
   })}
  </div>}
  <div className="duel-config-total">
   <output aria-live="polite"><strong>Gesamt</strong> {total}{counts!==null?` / ${maxDuelQuestions}`:''} Fragen</output>
   {saving&&<span role="status">Wird gespeichert …</span>}
  </div>
  {counts!==null&&total<minDuelQuestions&&<p className="duel-config-hint">Für ein eigenes Duell braucht ihr mindestens 4 Fragen.</p>}
 </section>;
}
