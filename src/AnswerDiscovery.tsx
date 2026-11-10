import {lazy,Suspense,useState} from 'react';
import {motion,useReducedMotion} from 'motion/react';
const Geography=lazy(()=>import('./AtlasGeography').then(m=>({default:m.AtlasGeography})));
import {answerPreview} from './answerPreview';
import type {Category} from './engine';
export function AnswerDiscovery({category,options,selected,onSelect}:{category:Category;options:string[];selected:number|null;onSelect:(i:number)=>void}){
 const reduced=useReducedMotion();const info=selected===null?null:answerPreview(category,options[selected]);
 return <section className="answer-discovery" aria-label="Antworten entdecken"><span className="eyebrow">Antworten entdecken</span><p className="fine-print">Tippe oben auf eine Antwort und vergleiche. Deine Wertung bleibt gespeichert.</p>{info&&<motion.div key={selected} initial={reduced?false:{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15}} className="preview-card" aria-live="polite"><strong>{info.title}</strong>{info.atlasIso&&<Suspense fallback={<p>Vorschau wird geladen …</p>}><Geography iso={info.atlasIso} name={info.title} map={info.map} regional/></Suspense>}{info.src&&<img src={info.src} alt={`${info.title} – Vergleichsdarstellung`}/>}<p>{info.text}</p>{info.license&&<small>{info.license}</small>}</motion.div>}</section>;
}
export function useDiscovery(){return useState<number|null>(null);}
