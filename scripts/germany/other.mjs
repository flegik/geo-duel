import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {bkg,byCode,question,read,states,write} from './foundation.mjs';
import {cities} from './cities.mjs';

const kba='https://www.kba.de/SharedDocs/Downloads/DE/Presse/kfz_kennzeichenliste_faltblatt.pdf?__blob=publicationFile&v=12';
const destatis='https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/_inhalt.html';
const plates=read('plates');
const plateDisplay=p=>({
 HB:'Stadtgemeinden Bremen und Bremerhaven',H:'Region Hannover',SB:'Regionalverband Saarbrücken (außer Völklingen)',
 HD:'Stadtkreis Heidelberg und Rhein-Neckar-Kreis',FR:'Stadtkreis Freiburg im Breisgau und Landkreis Breisgau-Hochschwarzwald',
 PF:'Stadtkreis Pforzheim und Enzkreis',UL:'Stadtkreis Ulm und Alb-Donau-Kreis',TR:'Stadt Trier und Landkreis Trier-Saarburg',
 MZ:'Stadt Mainz und Landkreis Mainz-Bingen',
}[p.code]??(p.shared?'Stadt und Landkreis '+p.name:p.name));
const numeral = n=>Math.round(n).toLocaleString('de-DE');
function plateQuestions(){
 const pool=[];
 for(const [i,p] of plates.entries()){
  const state=byCode[p.state];
  const distractors=plates.filter(r=>r.code!==p.code).sort((a,b)=>{
   const score=r=>Number(r.state===p.state)*3+Number(r.code[0]===p.code[0])*4+Number(r.code.length===p.code.length);
   return score(b)-score(a);
  }).slice(0,3);
  const common={topic:'plate',state:p.state,subjectKey:'de-plate:'+p.code,sources:[kba],
   explanation:`Das Unterscheidungszeichen ${p.code} wird derzeit für ${plateDisplay(p)} in ${state.name} ausgegeben (KBA, 16.04.2026).`,
   provenance:{plate:p.code,plateDistrict:p.name,city:cities.find(c=>c.name===p.name)?.ags}};
  const easy=['B','HH','HB','MA','HD','F','M','K','D','S','H','B','LU','DO','DD'].includes(p.code);
  const reverse=i%3===0||['HD','F','M','LU'].includes(p.code);
  const label=p.historical?'aktuell neu vergebene': 'aktuelle';
  pool.push(question({...common,key:p.code,difficulty:easy?1:i%3===0?2:3,
   prompt:reverse?`Welches ${label} Kfz-Kürzel gehört zu diesem Zulassungsgebiet? ${plateDisplay(p)}`:
    `Für welches Zulassungsgebiet wird das Kfz-Kürzel ${p.code} laut KBA neu vergeben?`,
   answer:reverse?p.code:plateDisplay(p),choices:distractors.map(r=>reverse?r.code:plateDisplay(r))}));
 }
 const reverseStates=['BY','BW','NW','RP','HE','NI','SH','BB','MV','TH','SN'];
 for(const [i,code] of reverseStates.entries()){
  const state=byCode[code];
  const target=plates.filter(p=>p.state===code).at(-1);
  const distractors=state.neighbors.flatMap(c=>plates.filter(p=>p.state===c).slice(0,1)).slice(0,3);
  for(const p of plates)if(distractors.length<3&&p.state!==code&&!distractors.some(d=>d.state===p.state))distractors.push(p);
  pool.push(question({topic:'plate',key:'state-'+code,state:code,subjectKey:'de-plate:'+target.code,sources:[kba],
   difficulty:2+i%2,prompt:`Welches dieser Kfz-Kürzel wird in ${state.name} neu vergeben?`,answer:target.code,choices:distractors.map(d=>d.code),
   explanation:`${target.code} gehört zu ${plateDisplay(target)} in ${state.name} (KBA, 16.04.2026).`,
   provenance:{plate:target.code,plateDistrict:target.name}}));
 }
 assert.equal(pool.length,120);
 return pool;
}

const stand='31.12.2024';
const definition={population:'Einwohnerzahl der amtlichen Bevölkerungsfortschreibung auf Basis des Zensus 2022',area:'amtliche Katasterfläche des Verwaltungsgebiets'};
const numberEntity=(r,type)=>({...r,type,key:r.ags});
const lands=states.map(r=>numberEntity({...r,state:r.code},'Bundesland'));
const towns=cities.map(r=>numberEntity(r,'Stadt'));
const fmt=(value,metric)=>numeral(value)+(metric==='area'?' km²':'');
function buildEstimate(record,metric){
 const val=record[metric];
 const step=val>1000000?100000:val>100000?10000:val>10000?1000:val>1000?100:val>100?10:1;
 const rounded=Math.round(val/step)*step;
 const choices=[.35,.63,1.7].map(f=>fmt(Math.round(rounded*f/step)*step,metric));
 return question({topic:'statistics',key:'estimate-'+record.key+metric,difficulty:metric==='population'&&val>500000?1:2,state:record.state,
  subjectKey:'de-stat:'+record.key+':'+metric,sources:[destatis,bkg],
  prompt:metric==='area'?`Wie groß ist die Fläche von ${record.name} ungefähr (Stand ${stand})?`:
   `Wie viele Menschen leben im Verwaltungsgebiet ${record.name} ungefähr (Stand ${stand})?`,
  answer:fmt(rounded,metric),choices,
  explanation:`${record.name} · ${fmt(val,metric)} am ${stand}. Grundlage: ${definition[metric]}.`,
  provenance:{stat:{year:2024,date:stand,definition:definition[metric],metric,mode:'estimate',values:[{name:record.name,value:val}],step},
   city:record.type==='Stadt'?record.ags:undefined}});
}
function compare(record,distractors,metric,ascending){
 const values=[record,...distractors].map(r=>({name:r.name,value:r[metric]}));
 return question({topic:'statistics',key:'compare-'+record.key+metric+ascending,difficulty:2,state:record.state,
  subjectKey:'de-stat:'+record.key+':'+metric,sources:[destatis,bkg],
  prompt:`Welche${record.type==='Stadt'?' dieser Städte':'s dieser Bundesländer'} ${metric==='area'?'hat die '+(ascending?'kleinste':'größte')+' Fläche':'hat die '+(ascending?'wenigsten':'meisten')+' Einwohner'} (Stand ${stand})?`,
  answer:record.name,choices:distractors.map(r=>r.name),
  explanation:`${record.name} · ${fmt(record[metric],metric)} am ${stand}. Grundlage: ${definition[metric]}.`,
  provenance:{stat:{year:2024,date:stand,definition:definition[metric],metric,mode:ascending?'min':'max',values},
   city:record.type==='Stadt'?record.ags:undefined},
 });
}
function statsQuestions(){
 const estimates=[
  ...lands.map(r=>buildEstimate(r,'population')),
  ...lands.map(r=>buildEstimate(r,'area')),
  ...towns.filter(c=>c.population>=100000&&!lands.some(s=>s.name===c.name)).slice(0,16).map(r=>buildEstimate(r,'population')),
 ];
 const comparisons=[];
 for(const [records,metric,count] of [[lands,'population',8],[lands,'area',8],[towns,'population',8],[towns,'area',8]]){
  const rank=[...records].sort((a,b)=>a[metric]-b[metric]);
  const focus=records===towns?rank.filter(c=>c.population>=75000):rank;
  for(let i=0;i<count;i++){
   const ascending=i%2===1;
   const target=ascending?focus[i>>1]:focus.at(-1-(i>>1));
   const eligible=rank.filter(r=>ascending?r[metric]>=target[metric]*1.22:r[metric]<=target[metric]/1.22)
    .sort((a,b)=>Math.abs(a[metric]-target[metric])-Math.abs(b[metric]-target[metric]));
   const choices=eligible.slice(i%3,i%3+3);
   assert.equal(choices.length,3,target.name);
   comparisons.push(compare(target,choices,metric,ascending));
  }
 }
 return [...estimates,...comparisons];
}
export function otherQuestions(){return [...plateQuestions(),...statsQuestions()];}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)write('other-questions',otherQuestions());
