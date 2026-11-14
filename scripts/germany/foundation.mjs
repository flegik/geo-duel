import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

export const read = name => JSON.parse(readFileSync('data/germany/' + name + '.json','utf8'));
export const write = (name, data) => writeFileSync('data/germany/' + name + '.json', JSON.stringify(data,null,1) + '\n');
export const lines = name => readFileSync('data/germany/' + name + '.tsv','utf8').trim().split(/\r?\n/).map(s=>s.split('\t'));
export const bkg = 'https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-mit-einwohnerzahlen-stand-31-12-vg250-ew-31-12.html';
export const capitals = 'https://www.bpb.de/themen/politisches-system/24-deutschland/40429/foederalismus-und-bundeslaender/';
export const states = read('states');
export const byCode = Object.fromEntries(states.map(s=>[s.code,s]));
const hash = value => createHash('sha256').update(value).digest('hex');
const stateNames = codes => codes.map(code=>byCode[code].name);
const map = (key, type, alt) => ({src:key,type,alt,license:'© BKG 2026 · dl-de/by-2-0 · vereinfacht und eingefärbt'});
const neutralFlag = {type:'flag-options',src:'choice:de-flags',alt:'Vier Landesflaggen als Antwortmöglichkeiten',license:'Wikimedia Commons'};
const stateInfo = state => ({
 code: state.code,
 name: state.name,
 capital: state.capital,
});
const choiceInfo = codes => codes.map(code=>stateInfo(byCode[code]));
export function question({topic,key,subjectKey,difficulty,prompt,answer,choices,explanation,media=null,sources,state,provenance={}}){
 assert([1,2,3].includes(difficulty),key);
 assert.equal(new Set([answer,...choices]).size,4,key);
 assert.equal(choices.length,3,key);
 const id = 'de1-' + hash(topic + ':' + key).slice(0,14);
 const options = [answer,...choices].sort((a,b)=>hash(id+':'+a).localeCompare(hash(id+':'+b)));
 return {id,category:'germany',difficulty,prompt,options,correct:options.indexOf(answer),explanation,media,enabled:true,
  provenance:{topic,subjectKey,sources,germany:{state,...provenance},
   ...(media?.src==='choice:de-flags'?{optionImages:options.map(name=>states.find(s=>s.name===name).flag)}:{})}};
}
function alts(state, names, offset) {
 const codes = names.split(' ').filter(code=>code!==state.code);
 return Array.from({length:3},(_,i)=>codes[(offset+i)%codes.length]);
}
const regional = {
 SH:'HH NI MV HB BB', HH:'HB BE SH NI MV', NI:'NW SH ST HE MV', HB:'HH BE NI SH NW',
 NW:'NI HE RP BW SL', HE:'RP BW NW TH BY', RP:'SL HE BW NW BY', BW:'BY HE RP SL TH',
 BY:'BW TH SN HE RP', SL:'RP HE BW NW BY', BE:'HH HB BB ST SN', BB:'MV SN ST BE TH',
 MV:'SH NI BB ST HH', SN:'ST TH BB BY BE', ST:'SN TH BB NI MV', TH:'SN ST HE BY BB',
};
const flagNeighbors = {
 SH:'MV NW SN TH HH BB', HH:'BE HB HE TH BB BY', NI:'SL RP BW ST HE MV',
 HB:'HH BE BB TH HE BY', NW:'SN SH MV TH HE BW', HE:'TH BB BE HH HB SN',
 RP:'NI SL ST BW HE MV', BW:'ST NI SL RP HE SN', BY:'SN HH BE HB MV SH',
 SL:'NI RP ST BW SH NW', BE:'BB HH TH HE HB MV', BB:'BE HE TH HH HB MV',
 MV:'SH NW BB TH HE SN', SN:'NW TH SH HE BY BW', ST:'BW NI RP SL BB MV', TH:'HE BB BE HH HB SH',
};
const cityOptions = {
 SH:['Lübeck','Flensburg','Neumünster','Norderstedt'],
 HH:['Bremen','Lübeck','Kiel','Hannover'],
 NI:['Braunschweig','Oldenburg','Göttingen','Osnabrück'],
 HB:['Bremerhaven','Hamburg','Oldenburg','Wilhelmshaven'],
 NW:['Köln','Dortmund','Essen','Bonn'],
 HE:['Frankfurt am Main','Kassel','Darmstadt','Offenbach am Main'],
 RP:['Koblenz','Trier','Ludwigshafen am Rhein','Kaiserslautern'],
 BW:['Mannheim','Karlsruhe','Freiburg im Breisgau','Heidelberg'],
 BY:['Nürnberg','Augsburg','Regensburg','Würzburg'],
 SL:['Neunkirchen','Homburg','Völklingen','Saarlouis'],
 BE:['Potsdam','Hamburg','Bremen','Leipzig'],
 BB:['Cottbus','Brandenburg an der Havel','Frankfurt (Oder)','Oranienburg'],
 MV:['Rostock','Greifswald','Stralsund','Neubrandenburg'],
 SN:['Leipzig','Chemnitz','Zwickau','Görlitz'],
 ST:['Halle (Saale)','Dessau-Roßlau','Wittenberg','Merseburg'],
 TH:['Jena','Weimar','Gera','Eisenach'],
};
export function foundation() {
 return states.flatMap(state=>{
  const {code,name,capital,flag,flagDetail,flagLaw,flagSource,mapKey}=state;
  const common={state:code,subjectKey:'de-state:'+code};
  const pool=[];
  for(let level=1;level<=3;level++){
   const distractors=alts(state,regional[code],3-level);
   pool.push(question({...common,topic:'state-map',key:code+level,difficulty:level,
    prompt:'Welches Bundesland ist mintfarben markiert?',answer:name,choices:stateNames(distractors),
    explanation:`${name} ist auf der Deutschlandkarte markiert. Die Landeshauptstadt ist ${capital}.`,
    media:map('de-map:'+mapKey,'de-state-map','Deutschlandkarte mit einem hervorgehobenen Bundesland'),sources:[bkg],
    provenance:{stateChoices:choiceInfo([code,...distractors])}}));
  }
  for(const reverse of [false,true])for(const level of [1,3]){
   const distractors=alts(state,flagNeighbors[code],level===3?0:3);
   pool.push(question({...common,topic:'state-flag',key:code+reverse+level,difficulty:level,
    prompt:reverse?`Welche der vier Landesflaggen gehört zu ${name}?`:'Zu welchem Bundesland gehört diese Landesflagge?',
    answer:name,choices:stateNames(distractors),explanation:`Landesflagge von ${name}. ${flagDetail}.`,
    media:reverse?neutralFlag:{src:flag,type:'image',alt:'Abgebildete Landesflagge',license:'Wikimedia Commons · gemeinfrei'},
    sources:[flagLaw,flagSource],provenance:{stateChoices:choiceInfo([code,...distractors])}}));
  }
  const distractors=alts(state,regional[code],0);
  const townChoices=cityOptions[code].slice(0,3);
  const capitalCommon={...common,topic:'capital',subjectKey:'de-city:'+state.capitalAgs,sources:[capitals,bkg],
   explanation:`${capital} ist die Landeshauptstadt von ${name}.`};
  pool.push(
   question({...capitalCommon,key:code+'city',difficulty:1,prompt:`Wie heißt die Landeshauptstadt von ${name}?`,answer:capital,choices:townChoices}),
   question({...capitalCommon,key:code+'state',difficulty:1,prompt:`Von welchem Bundesland ist ${capital} die Hauptstadt?`,answer:name,choices:stateNames(distractors),provenance:{stateChoices:choiceInfo([code,...distractors])}}),
   question({...capitalCommon,key:code+'map',difficulty:2,prompt:'Wie heißt die Hauptstadt des markierten Bundeslandes?',answer:capital,
    choices:townChoices.slice(1).concat(cityOptions[code][3]),media:map('de-map:'+mapKey,'de-state-map','Deutschlandkarte mit einem hervorgehobenen Bundesland')}),
   question({...capitalCommon,key:code+'pair',difficulty:3,prompt:'Welches Paar Bundesland – Landeshauptstadt ist richtig?',answer:`${name} – ${capital}`,
    choices:distractors.map((other,i)=>`${byCode[other].name} – ${cityOptions[other][(i+states.indexOf(state))%4]}`)}));
  return pool;
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)write('foundation-questions',foundation());
