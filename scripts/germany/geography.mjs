import {pathToFileURL} from 'node:url';
import {bkg,byCode,states,lines,question,write} from './foundation.mjs';
import {readFileSync} from 'node:fs';
import {cities} from './cities.mjs';
import assert from 'node:assert/strict';

const bfn='https://www.bfn.de/nationalparke';
const peaks='https://sg.geodatenzentrum.de/web_public/gdz/themenkarten/wss-2017-08-berge.pdf';
const riverMap='https://www.bpb.de/system/files/pdf/NYO6CQ.pdf';
const germanNumber=new Intl.NumberFormat('de-DE');
const stateName=code=>byCode[code].name;
const stateList=codes=>codes.map(stateName).sort((a,b)=>a.localeCompare(b,'de')).join(', ');
const otherStates=(code,excluded=[])=>[
 ...byCode[code].neighbors,
 ...byCode[code].neighbors.flatMap(other=>byCode[other].neighbors),
 ...states.map(s=>s.code),
].filter((v,i,a)=>v!==code&&!excluded.includes(v)&&a.indexOf(v)===i);
const cityKey=(name,fallback)=>'de-city:'+(cities.find(c=>c.name===name)?.ags??fallback);
const stateSubject=code=>'de-state:'+code;

export function borderQuestions(){
 const pool=[];
 const positives=[];
 for(const {code,name,neighbors} of states){
  const non=otherStates(code,neighbors);
  const common={topic:'state-border',state:code,sources:[bkg],
   explanation:`An ${name} grenzen innerhalb Deutschlands: ${stateList(neighbors)}.`};
  for(const [i,neighbor] of neighbors.entries()){
   positives.push(question({...common,key:code+neighbor,subjectKey:'de-border:'+([code,neighbor].sort().join('-')),difficulty:i%2+1,
    prompt:`Welches dieser Bundesländer grenzt an ${name}?`,answer:stateName(neighbor),
    choices:non.slice(i%3,i%3+3).map(stateName),provenance:{border:{of:code,kind:'yes'}}}));
  }
  if(neighbors.length>=3)pool.push(question({...common,key:code+'-no',subjectKey:stateSubject(code),difficulty:2,
   prompt:`Welches dieser Bundesländer grenzt nicht an ${name}?`,answer:stateName(non[0]),
   choices:neighbors.slice(0,3).map(stateName),provenance:{border:{of:code,kind:'no'}}}));
  else pool.push(question({...common,key:code+'-count',subjectKey:stateSubject(code),difficulty:2,
   prompt:`Wie viele andere Bundesländer grenzen an ${name}?`,answer:String(neighbors.length),
   choices:['1','2','3','4'].filter(v=>v!==String(neighbors.length)),provenance:{border:{of:code,kind:'count'}}}));
  pool.push(question({...common,key:code+'-all',subjectKey:stateSubject(code),difficulty:3,
   prompt:`Welche Antwort nennt genau alle Bundesländer, die an ${name} grenzen?`,answer:stateList(neighbors),
   choices:non.slice(0,3).map((other,i)=>stateList(neighbors.map((v,j)=>j===i%neighbors.length?other:v))),
   provenance:{border:{of:code,kind:'all'}}}));
 }
 // Keep at least one positive question for each state, including enclaves.
 const chosen=states.map(s=>positives.find(q=>q.provenance.germany.state===s.code));
 for(const q of positives)if(chosen.length<48&&!chosen.includes(q))chosen.push(q);
 return [...pool,...chosen];
}

export function natureQuestions(){
 const pool=[];
 const mountains=lines('mountains');
 for(const [,[state,peak,height]] of mountains.entries()){
  const candidates=mountains.filter(p=>p[0]!==state).sort((a,b)=>Math.abs(a[2]-height)-Math.abs(b[2]-height));
  pool.push(question({topic:'nature',key:'peak-'+state,subjectKey:'de-peak:'+state,state,difficulty:Number(height)>=1100?1:2,
   prompt:`Wie heißt die höchste natürliche Erhebung in ${stateName(state)}?`,answer:peak,
   choices:candidates.slice(0,3).map(p=>p[1]),sources:[peaks],
   explanation:`Laut BKG-Themenkarte liegt ${peak} bei rund ${germanNumber.format(Number(height))} Metern über dem Meeresspiegel.`}));
 }
 const parks=lines('parks');
 for(const [name,codes,detail] of parks){
  const [state]=codes.split('/');
  const title=name.includes('Wattenmeer')?name:'Nationalpark '+name;
  pool.push(question({topic:'nature',key:'park-'+name,subjectKey:'de-park:'+name,state,difficulty:2,
   prompt:`Welcher Nationalpark schützt diese Landschaft? ${detail}.`,answer:title,
   choices:parks.filter(p=>p[0]!==name).sort((a,b)=>Number(b[1].includes(state))-Number(a[1].includes(state)))
    .slice(0,3).map(p=>p[0].includes('Wattenmeer')?p[0]:'Nationalpark '+p[0]),
   explanation:`${title} · ${stateList(codes.split('/'))}. ${detail}.`,sources:[bfn]}));
 }
 const rivers=lines('rivers');
 const alternatives={
 Rhein:'Neckar Main Weser Elbe Mosel Donau',Elbe:'Oder Saale Weser Havel Rhein Donau',Main:'Neckar Rhein Donau Lahn Isar Weser',
 Weser:'Elbe Ems Aller Leine Rhein',Donau:'Inn Isar Lech Neckar Rhein',Neckar:'Main Donau Rhein Kocher Elbe',
 Mosel:'Saar Rhein Main Nahe Ruhr',Fulda:'Werra Lahn Main Weser Saale',Werra:'Fulda Saale Lahn Weser Main',
 Saale:'Elbe Unstrut Mulde Havel Inn',Havel:'Spree Elbe Oder Dahme Rhein',Spree:'Havel Oder Elbe Neiße Saale',
 Isar:'Inn Lech Donau Main Wertach',Inn:'Isar Donau Lech Main Saale',Saar:'Mosel Nahe Rhein Lahn Elbe',
 'Lausitzer Neiße':'Spree Oder Elbe Saale Weser'};
 const exclude={Mainz:['Main'],Berlin:['Havel'],Potsdam:['Spree']};
 for(const [name,state,river] of rivers){
  if(name==='Rotenburg an der Fulda')continue;
  const options=alternatives[river].split(' ').filter(r=>!exclude[name]?.includes(r));
  const subjectKey=cityKey(name,'de-river-city:'+name);
  const prompt=name==='Potsdam'?'Wie heißt der Fluss am Potsdamer Stadtkanal und am Tiefen See?':
   name==='Dessau-Roßlau'?'An welchem Fluss liegt der Stadtteil Roßlau?':`Welcher dieser Flüsse fließt durch ${name} oder entlang seines Stadtgebiets?`;
  pool.push(question({topic:'nature',key:'river-'+name,subjectKey,state,difficulty:['Rhein','Elbe','Donau','Main'].includes(river)?1:2,
   prompt,answer:river,choices:options.slice(0,3),sources:[riverMap],
   explanation:`Der Fluss ${river} berührt das Stadtgebiet von ${name}.`}));
 }
 for(const [i,[name,state,kind,source]] of lines('waters').entries()){
  const island=kind!=='See';
  const stateChoice=i%2===0||!island;
  const coast=kind==='Nordsee'?'Ostsee':'Nordsee';
  const options=otherStates(state);
  const otherIslands=lines('waters').filter(([n,,sea])=>n!==name&&sea===coast).map(([n])=>n);
  const choices=stateChoice?options.slice(0,3).map(stateName):Array.from({length:3},(_,j)=>otherIslands[(i+j)%otherIslands.length]);
  pool.push(question({topic:'nature',key:'water-'+name,subjectKey:'de-water:'+name,state,difficulty:i%3===0?3:2,
   prompt:stateChoice?`In welchem Bundesland liegt ${island?'die Insel '+name:'die Wasserfläche des Gewässers „'+name+'“'}?`:
    `Welche dieser Inseln liegt in der ${kind}?`,
   answer:stateChoice?stateName(state):name,choices,sources:[source,riverMap],
   explanation:island?`${name} gehört zu ${stateName(state)} und liegt in der ${kind}.`:`${name} liegt in ${stateName(state)}.`}));
 }
 const landscapes=[
  ['Schwarzwald','BW','https://www.bfn.de/daten-und-fakten/biosphaerenreservate-deutschland','Mittelgebirge mit dem Feldberg südöstlich von Freiburg im Breisgau'],
  ['Thüringer Wald','TH','https://www.bfn.de/bedeutsame-landschaft/thueringer-wald','Mittelgebirge zwischen Eisenach und Ilmenau mit dem Rennsteig'],
  ['Lüneburger Heide','NI','https://www.bfn.de/naturschutzgebiete','Heidelandschaft mit einem großen Naturschutzgebiet südlich von Hamburg'],
  ['Thüringer Becken','TH','https://www.bfn.de/landschaftssteckbriefe/thueringer-becken','Ackerbaulandschaft zwischen Harz und Thüringer Wald'],
 ];
 for(const [name,state,source,detail] of landscapes)pool.push(question({topic:'nature',key:'landscape-'+name,subjectKey:'de-landscape:'+name,
  state,difficulty:2,prompt:`Welche Landschaft ist beschrieben? ${detail}.`,answer:name,
  choices:landscapes.filter(row=>row[0]!==name).map(row=>row[0]),explanation:`${name} liegt in ${stateName(state)}.`,sources:[source]}));
 assert.equal(pool.length,114);
 return pool;
}

const unesco='https://www.unesco.de/staette/';
const photos=JSON.parse(readFileSync('data/learning/landmark-city-photos.json','utf8'));
const reusedPhotos={'Aachener Dom':'3','Kölner Dom':'292','Würzburger Residenz':'169'};
export function landmarkQuestions(){
 const sites=lines('landmarks').map(([name,city,state,kind,link])=>({name,city,state,kind,
  source:link.startsWith('https:')?link:unesco+link+'/'}));
 const pool=[];
 for(const [i,{name,city,state,kind,source}] of sites.entries()){
  const sameKind=sites.filter(s=>s.kind===kind);
  const nearby=sites.filter(s=>s.state===state||byCode[state].neighbors.includes(s.state));
  const cityDistractors=[...new Set([...sameKind,...nearby,...sites].map(s=>s.city))].filter(c=>c!==city);
  const rivals=sites.filter(s=>s.city!==city&&s.kind===kind);
  const uniqueTown=sites.filter(s=>s.city===city&&s.kind===kind).length===1;
  const reverse=uniqueTown&&rivals.length>=3&&i%3!==0;
  const obvious=name.toLocaleLowerCase('de').includes(city.toLocaleLowerCase('de'))||
   /^(Kölner|Trierer|Speyerer|Naumburger|Würzburger|Dresdner|Hamburger|Heidelberger)\b/.test(name);
  const key='de-landmark:'+i;
  const explanation=`${name} · ${kind} in ${city}, ${stateName(state)}.`;
  const common={state,topic:'landmark',subjectKey:key,sources:[source,bkg],explanation,provenance:{landmark:name,cityName:city,city:cities.find(c=>c.name===city)?.ags}};
  const photo=photos[reusedPhotos[name]];
  pool.push(question({...common,key:key+'-location',difficulty:reverse||obvious?2:1,
   prompt:reverse?`Welche Sehenswürdigkeit befindet sich in ${city}?`:obvious?
    `In welchem Bundesland befindet sich ${name}?`:`In welcher Stadt oder Gemeinde befindet sich ${name}?`,
   answer:reverse?name:obvious?stateName(state):city,
   choices:reverse?rivals.slice(0,3).map(s=>s.name):obvious?otherStates(state).slice(0,3).map(stateName):cityDistractors.slice(0,3)}));
  if(photo)pool.push(question({...common,key:key+'-photo',difficulty:2,prompt:'Welche Sehenswürdigkeit zeigt dieses Foto?',answer:name,
   choices:rivals.slice(0,3).map(s=>s.name),media:{type:'image',src:photo.path,alt:'Foto einer deutschen Sehenswürdigkeit',license:photo.license},
   provenance:{...common.provenance,additionalLandmark:true},sources:[source,photo.source]}));
  if(photo)pool.at(-1).provenance.imageCredit=photo;
  if(!photo&&!obvious&&(reverse||i%2===0)&&pool.filter(q=>q.provenance.germany.additionalLandmark).length<100-sites.length){
   pool.push(question({...common,key:key+'-state',difficulty:2,prompt:`In welchem Bundesland befindet sich ${name}?`,
    answer:stateName(state),choices:otherStates(state).slice(0,3).map(stateName),provenance:{...common.provenance,additionalLandmark:true}}));
  }
 }
 assert.equal(pool.length,100);
 return pool;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)
 write('geography-questions',[...borderQuestions(),...natureQuestions(),...landmarkQuestions()]);
