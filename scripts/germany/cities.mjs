import {pathToFileURL} from 'node:url';
import {byCode,bkg,question,read,write} from './foundation.mjs';

export const geonames='https://www.geonames.org/';
export const cities=read('cities');
const DE_STATES=Object.values(byCode);
const rad=Math.PI/180;
export const distance = (a,b) => {
 const [lon,lat]=a.point, [otherLon,otherLat]=b.point;
 const dy=Math.sin((otherLat-lat)*rad/2);
 const dx=Math.sin((otherLon-lon)*rad/2);
 return 12742*Math.asin(Math.sqrt(dy*dy+dx*dx*Math.cos(lat*rad)*Math.cos(otherLat*rad)));
};

export function cityQuestions(){
 const pool=[];
 for(const city of cities){
  const {ags,state,name,population,point,geoname,map}=city;
  const capital=byCode[state];
  const difficulty=population>=150000?1:population>=60000?2:3;
  const nearest=cities.filter(c=>c.ags!==ags).sort((a,b)=>distance(city,a)-distance(city,b));
  const neighborStates=[...new Set(nearest.map(c=>c.state))].filter(s=>s!==state);
  const distractorCodes=neighborStates.slice(0,3);
  const sameSubject={state,subjectKey:'de-city:'+ags,explanation:`${name} liegt in ${capital.name}. Die Landeshauptstadt ist ${capital.capital}.`,
   sources:[bkg,geonames+geoname],provenance:{city:ags}};
  pool.push(question({...sameSubject,topic:'city-state',key:ags,difficulty,prompt:`In welchem Bundesland liegt ${name}?`,
   answer:capital.name,choices:distractorCodes.map(code=>byCode[code].name),
   provenance:{city:ags,stateChoices:DE_STATES.filter(s=>[state,...distractorCodes].includes(s.code)).map(({name,code,capital})=>({name,code,capital}))}}));
  if(map){
   // Early questions offer well-known towns in other regions. The harder
   // map questions keep all options close enough to need geographic precision.
   const distractors=difficulty===1
    ?nearest.filter(c=>c.population>=100000&&distance(city,c)>90).slice(0,3)
    :nearest.slice(0,3);
   pool.push(question({...sameSubject,topic:'city-map',key:ags,difficulty,prompt:'Welche Stadt ist auf der Deutschlandkarte markiert?',
    answer:name,choices:distractors.map(c=>c.name),
    media:{type:'de-city-map',src:`de-point:${point.join(',')}`,alt:'Deutschlandkarte mit einem markierten Stadtpunkt',
     license:'© BKG 2026 · dl-de/by-2-0 · vereinfacht und eingefärbt'},
    provenance:{city:ags,cityChoices:[city,...distractors].map(({name,point,state})=>({name,point,state}))}}));
  }
 }
 return pool;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)write('city-questions',cityQuestions());
