import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';

const read=path=>JSON.parse(readFileSync('data/'+path+'.json','utf8'));
const save=(path,value)=>writeFileSync('data/'+path+'.json',JSON.stringify(value,null,1)+'\n');
const retiredIds=[];
const replacements=[];
const hash=(text,algorithm='sha256')=>createHash(algorithm).update(text).digest('hex');
const revise=(q,changes)=>({...q,...changes,id:'quiz-v2-'+hash(q.id).slice(0,20)});
function replace(q,next){
 retiredIds.push(q.id);
 if(next)replacements.push(next);
}
const format=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2});
const amount=n=>n>=1e9?format.format(n/1e9)+' Mrd.':n>=1e6?format.format(n/1e6)+' Mio.':format.format(n);
const bpb='https://www.bpb.de/shop/materialien/karten/34303/bundesrepublik-deutschland-topographisch-politische-karte/';
const swisstopo='https://www.swisstopo.admin.ch/de/kuenstliche-und-natuerliche-grenzen';
const destatis='https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/05-staedte.html';
const vg250='https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-mit-einwohnerzahlen-stand-31-12-vg250-ew-31-12.html';
const refDate='31.12.2024';

function estimate(question,target,subject,explanation){
 const unit=10**Math.floor(Math.log10(target));
 const approximate=Math.round(target/unit)*unit;
 const values=[approximate/4,approximate/2,approximate,approximate*2].map(Math.round);
 assert.equal(values.reduce((best,v)=>Math.abs(v-target)<Math.abs(best-target)?v:best),approximate);
 return {...question,prompt:'Wie viele Einwohner hat '+subject+' ungefähr?',
  options:values.map(v=>'Ca. '+amount(v)),correct:2,explanation:amount(approximate)+' ist die nächste Größenordnung. '+explanation};
}

const german= ['foundation','city','geography','other'].flatMap(name=>read('germany/'+name+'-questions'));
const states=read('germany/states');
const cities=read('germany/cities');
const commonCities=new Set(cities.filter(c=>c.population>=100000).map(c=>c.name));
for(const {capital} of states)commonCities.add(capital);
for(const city of ['Bamberg','Bayreuth','Flensburg','Görlitz','Konstanz','Passau','Speyer','Stralsund','Weimar'])commonCities.add(city);
for(const q of german){
 const {germany:g,topic}=q.provenance;
 const city=cities.find(c=>c.ags===g.city);
 if(topic==='state-map'&&q.difficulty>=2||topic==='state-border'||
    topic==='capital'&&!q.prompt.startsWith('Welches Paar'))continue;
 if(topic==='city-state'&&city&&commonCities.has(city.name)&&
    !states.some(s=>s.name===city.name)){
  if(q.difficulty===3)replace(q,revise(q,{difficulty:2}));
  continue;
 }
 if(topic==='city-map'&&q.options.every(name=>commonCities.has(name))){
  if(q.difficulty===1)replace(q,revise(q,{difficulty:2}));
  continue;
 }
 replace(q);
}

for(const record of [...states,...cities.toSorted((a,b)=>b.population-a.population).slice(0,10)]){
 const isState='code' in record;
 const isCityState=isState&&cities.some(c=>c.ags===record.ags);
 const city= !isState ? record.ags : isCityState ? record.ags : undefined;
 const role=isState?'das Bundesland '+record.name:'die Stadt '+record.name;
 const id='de-pop-'+(isState?'land-':'stadt-')+record.ags;
 const definition=isState?'Bevölkerung des Bundeslands':'Bevölkerung im administrativen Stadtgebiet';
 replacements.push(estimate({
  id,category:'germany',difficulty:2,enabled:true,media:null,
  provenance:{topic:'statistics',subjectKey:city?'de-city:'+city:'de-state:'+record.code,
   sources:isState?[vg250]:[destatis,vg250],germany:{state:isState?record.code:record.state,city,
    stat:{year:2024,date:refDate,definition,metric:'population',mode:'estimate',values:[{name:record.name,value:record.population}]}}},
 },record.population,role,definition+' am '+refDate+': '+format.format(record.population)+'.'));
}

const borders=readFileSync('data/germany/country-borders.tsv','utf8').trim().split(/\r?\n/).map(line=>{
 const [name,codes]=line.split('\t');
 return {name,codes:codes.split(' ')};
});
const stateName=code=>states.find(s=>s.code===code).name;
const exactNames=codes=>codes.map(stateName).toSorted((a,b)=>a.localeCompare(b,'de')).join(', ');
function addBorder({key,code,subject,prompt,answer,wrong,explanation,country,direction,difficulty}){
 const options=[answer,...wrong];
 assert.equal(new Set(options).size,4);
 replacements.push({id:'de-border-v2-'+hash(key).slice(0,14),category:'germany',difficulty,
  prompt,options,correct:0,explanation,media:null,enabled:true,
  provenance:{topic:'country-border',subjectKey:subject,sources:[bpb,vg250,...(country==='Schweiz'||code==='BY'||code==='BW'?[swisstopo]:[])],
   germany:{state:code,countryBorder:{country,direction}}}});
}
const neighbors=code=>states.find(s=>s.code===code).neighbors;
for(const {name,codes} of borders){
 for(const code of codes){
  const alternatives=[...new Set([...neighbors(code),...states.map(s=>s.code)])].filter(c=>!codes.includes(c));
  const correct=stateName(code);
  const explanation='Deutsche Bundesländer mit Land- oder Flussgrenze zu '+name+': '+exactNames(codes)+'.';
  addBorder({key:name+'-'+code,code,subject:'de-country-border:'+name,prompt:'Welches dieser Bundesländer hat eine Land- oder Flussgrenze zu '+name+'?',
   answer:correct,wrong:alternatives.slice(0,3).map(stateName),explanation,country:name,direction:'state',difficulty:2});
 }
 if(codes.length>1){
  const alternatives=[...new Set([...codes.flatMap(neighbors),...states.map(s=>s.code)])].filter(c=>!codes.includes(c));
  addBorder({key:name+'-all',code:codes[0],subject:'de-country-border:'+name,
   prompt:'Welche Antwort nennt alle Bundesländer mit Land- oder Flussgrenze zu '+name+'?',
   answer:exactNames(codes),wrong:alternatives.slice(0,3).map((other,i)=>exactNames(codes.map((c,j)=>i%codes.length===j?other:c))),
   explanation:'An '+name+' grenzen '+exactNames(codes)+'.',country:name,direction:'all',difficulty:3});
 }
}
for(const {code,name} of states){
 const matches=borders.filter(b=>b.codes.includes(code));
 if(!matches.length)continue;
 const country=matches[0].name;
 addBorder({key:code,code,subject:'de-state:'+code,prompt:'An welchen dieser Staaten grenzt '+name+' auf dem Land oder in einem Fluss?',
  answer:country,wrong:borders.filter(b=>!b.codes.includes(code)).slice(0,3).map(b=>b.name),
  explanation:name+' hat Land- oder Flussgrenzen zu '+matches.map(b=>b.name).join(', ')+'.',
  country,direction:'country',difficulty:2});
}

// Global cities share the UN's harmonized urban-centre definition. German
// cities are already covered in the dedicated pool with municipality data.
const lessFamiliarCities=new Set(['Genf','Medellín','Bandung','Guangzhou','Addis Abeba','Dakar','Dhaka','Bengaluru','Riad','Chennai','Shenzhen','Kolkata']);
const lessFamiliarCountries=new Set(['Papua-Neuguinea','Fidschi','Samoa','Tansania','Ghana','Senegal']);
const globalSubjects=new Set();
for(const q of read('question-pool/population')){
 const p=q.provenance.population;
 const record=p.values.find(v=>v.name===q.options[q.correct])??p.values[0];
 const city=p.kind==='city';
 if(city&&(record.iso==='DE'||lessFamiliarCities.has(record.name))||!city&&lessFamiliarCountries.has(record.name)){
  replace(q);
  continue;
 }
 const definition=city?'zusammenhängendes Stadtgebiet laut UN':'mittlere UN-Bevölkerungsprojektion';
 const label=city?record.name+' im zusammenhängenden Stadtgebiet':record.name;
 const {ranges,threshold,...source}=p;
 const provenance={...q.provenance,population:{...source,variant:'estimate',values:[record]}};
 replace(q,estimate(revise(q,{difficulty:2,provenance}),record.population,label,
  record.name+': '+amount(record.population)+' ('+definition+', 2025).'));
 globalSubjects.add(q.provenance.subjectKey);
}

for(const q of read('question-pool/world-comparisons')){
 const c=q.provenance.comparison;
 if(!['population','cityPopulation'].includes(c.metric))continue;
 const city=c.metric==='cityPopulation';
 const eligible=(c.rule==='max'||c.rule==='min')&&c.values.every(v=>city?!lessFamiliarCities.has(v.name)&&v.iso!=='DE':!lessFamiliarCountries.has(v.name));
 if(!eligible){replace(q);continue;}
 const target=c.values[c.rank-1];
 const gap=Math.min(...c.values.filter(v=>v!==target).map(v=>Math.max(v.value,target.value)/Math.min(v.value,target.value)));
 if(gap<1.35){replace(q);continue;}
 const prompt=(city?'Welche dieser Städte':'Welches dieser Länder')+' hat die '+(c.rule==='max'?'meisten':'wenigsten')+' Einwohner'+(city?' im zusammenhängenden Stadtgebiet':'')+'?';
 const subjectKey='population:'+(city?'city:':'country:')+target.id;
 const provenance={...q.provenance,subjectKey:globalSubjects.has(subjectKey)?subjectKey:q.provenance.subjectKey};
 replace(q,revise(q,{prompt,provenance,difficulty:gap>=2.5?1:2}));
}

save('question-pool/quiz-quality',{retiredIds:retiredIds.sort(),replacements});
const markerRegistry=read('flags/registry').map(({name,iso})=>[hash(name,'md5'),iso]);
save('learning/map-marker-keys',Object.fromEntries(markerRegistry));
const quote=text=>"'"+text.replaceAll("'","''")+"'";
const sql=value=>typeof value==='string'?quote(value):value===null?'null':String(value);
const row=q=>[q.id,q.category,q.difficulty,q.prompt,JSON.stringify(q.options),q.correct,q.explanation,
 q.media&&JSON.stringify(q.media),JSON.stringify(q.provenance),q.enabled].map(sql).join(',');
const migrations='supabase/migrations/';
const file=readdirSync(migrations).find(name=>name.endsWith('_quiz_quality.sql'));
if(file)writeFileSync(migrations+file,`-- Generated by scripts/build-quiz-quality.mjs.
insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
values
${replacements.map(q=>'('+row(q)+')').join(',\n')}
on conflict(id) do nothing;

update game.questions set enabled=false where enabled and id in (
${retiredIds.map(quote).join(',\n')}
);
`);
console.log('Saved',retiredIds.length,'retirements and',replacements.length,'replacement or new questions.');
