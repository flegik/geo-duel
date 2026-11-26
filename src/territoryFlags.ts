import territories from '../data/flags/territories.json';
import groups from '../data/flags/territory-groups.json';
import registry from '../data/flags/registry.json';
import type {Question} from './engine';

export const territoryFlags=territories;
export const territoryByName=new Map(territories.map(flag=>[flag.name,flag]));
export const territoryById=new Map(territories.map(flag=>[flag.id,flag]));
export const territoryFlagPaths=new Set(territories.map(flag=>flag.svg));

const allFlags=new Map<string,{name:string;svg:string}>([...registry.map(flag=>[flag.iso.toLowerCase(),flag] as const),
 ...territories.map(flag=>[flag.id.slice('territory-'.length),flag] as const)]);
const families=groups.map(([id,description,codes])=>({id,description,members:codes.split(' ')}));
const nearIdentical=new Set(['cu:pr','ai:ms','ms:vg']);
const roster=[...allFlags.entries()];

function alternatives(code:string,challenge:1|2|3){
 const ranked=roster.filter(([other])=>other!==code&&!nearIdentical.has([code,other].sort().join(':')))
  .map(([other,flag])=>({flag,score:families.reduce((score,{members})=>
   members.includes(code)&&members.includes(other)?score+30/members.length:score,0)}))
  .filter(({score})=>score>0).sort((a,b)=>b.score-a.score||a.flag.name.localeCompare(b.flag.name,'de'));
 if(ranked.length<3)throw Error(`Keine plausiblen Flaggenalternativen für ${code}`);
 return (challenge===3?[0,1,2]:[0,2,Math.min(4,ranked.length-1)]).map(i=>ranked[i].flag.name);
}

const affiliationGroups=[
 ['Königreich der Niederlande','Vereinigtes Königreich','Frankreich','Vereinigte Staaten'],
 ['Königreich Dänemark','Finnland','Norwegen','Schweden'],
 ['Volksrepublik China','Japan','Südkorea','Singapur'],
 ['Australien','Neuseeland','Fidschi','Papua-Neuguinea'],
];
const regionGroups=[
 ['Karibik','Ostsee','Mittelmeer','Indischer Ozean'],
 ['Nordatlantik','Südatlantik','Südwestpazifik','Indischer Ozean'],
 ['Großbritannien','Irische See','Ärmelkanal','Ostsee'],
 ['Ostsee','Ägäis','Adria','Schwarzes Meer'],
 ['Arktis','Antarktis','Ostsee','Mittelmeer'],
 ['Straße von Gibraltar','Straße von Messina','Bosporus','Straße von Dover'],
 ['Balkan','Iberische Halbinsel','Bretagne','Skandinavien'],
 ['Ostasien','Südostasien','Südasien','Zentralasien'],
 ['Mikronesien','Melanesien','Polynesien','Indischer Ozean'],
 ['Südwestpazifik','Karibik','Südatlantik','Indischer Ozean'],
];

const features=[
 {code:'ky',choices:['vi','aw','cw'],label:'ein britisches Überseegebiet ist',prompt:'Welches dieser Gebiete ist ein britisches Überseegebiet?',test:(f:typeof territories[number])=>f.kind==='overseas'},
 {code:'aw',choices:['mq','pr','ky'],label:'ein konstituierendes Land im Königreich der Niederlande ist',prompt:'Welches dieser Gebiete ist ein konstituierendes Land im Königreich der Niederlande?',test:(f:typeof territories[number])=>f.kind==='constituent'&&f.affiliation==='Königreich der Niederlande'},
 {code:'gu',choices:['tk','nc','cx'],label:'ein Gebiet der Vereinigten Staaten ist',prompt:'Welches dieser Gebiete gehört zu den Vereinigten Staaten?',test:(f:typeof territories[number])=>f.affiliation==='Vereinigte Staaten'},
 {code:'ck',choices:['tk','nf','pf'],label:'in freier Assoziierung mit Neuseeland steht',prompt:'Welches dieser Gebiete steht in freier Assoziierung mit Neuseeland?',test:(f:typeof territories[number])=>f.kind==='associated'},
 {code:'mq',choices:['pf','pr','bq-bo'],label:'eine französische Gebietskörperschaft in der Karibik ist',prompt:'Welches dieser Gebiete ist eine französische Gebietskörperschaft in der Karibik?',test:(f:typeof territories[number])=>f.affiliation==='Frankreich'&&f.region==='Karibik'},
];
const imageOptions={type:'flag-options',src:'choice:flags',alt:'Vier Flaggen als Antwortmöglichkeiten',license:'Public Domain – Flagpedia / Wikimedia Commons'};

const territoryQuestions:Question[]=territories.flatMap((flag,index)=>{
 const code=flag.id.slice('territory-'.length);
 const create=(variant:string,prompt:string,answer:string,choices:string[],difficulty:number,media:Question['media']=null):Question=>{
  const options=[answer,...choices];
  const offset=(index+variant.charCodeAt(0))%4;
  const ordered=options.slice(offset).concat(options.slice(0,offset));
  return {id:`flag-territory-v1-${code}-${variant}`,category:'flags',difficulty,prompt,options:ordered,correct:ordered.indexOf(answer),
   enabled:true,media,explanation:`${flag.name} · ${flag.description} Geografische Region: ${flag.region}.`,
   provenance:{sources:[flag.statusSource,flag.source],subjectKey:`flag:${flag.id}`,territoryId:flag.id}};
 };
 const forward=create('identify','Zu welchem Land oder Gebiet gehört diese Flagge?',flag.name,alternatives(code,3),flag.familiarity,
  {type:'image',src:flag.svg,alt:'Flagge in Originalproportionen',license:flag.license});
 const reverse=create('reverse',`Welche dieser Flaggen steht für ${flag.name}?`,flag.name,alternatives(code,2),Math.max(2,flag.familiarity),imageOptions);
 const result=[forward,reverse];
 if(flag.affiliation){
  const options=affiliationGroups.find(list=>list.includes(flag.affiliation!))!;
  result.push(create('affiliation',`Zu welchem Staat oder Königreich gehört ${flag.name}?`,flag.affiliation,
   options.filter(name=>name!==flag.affiliation),Math.max(2,flag.familiarity)));
 }
 const regions=regionGroups.find(list=>list.includes(flag.region))!;
 result.push(create('region',`In welcher geografischen Region liegt ${flag.name}?`,flag.region,
  regions.filter(region=>region!==flag.region),Math.max(2,flag.familiarity)));
 const feature=features.find(item=>item.code===code);
 if(feature){
  const choices=feature.choices.map(key=>territoryById.get(`territory-${key}`)!);
  if(!feature.test(flag)||choices.some(feature.test))throw Error(`Mehrdeutige Flaggenfrage für ${code}`);
  result.push(create('feature',`Welche Flagge steht für ein Gebiet, das ${feature.label}?`,flag.name,choices.map(choice=>choice.name),3,imageOptions));
 }
 return result;
});

const isFlagQuestion=(question:Question)=>/-(identify|reverse)$/.test(question.id);
export const territoryFlagQuestions=territoryQuestions.filter(isFlagQuestion);
export const retiredTerritoryQuestions=territoryQuestions.filter(question=>!isFlagQuestion(question))
 .map(question=>({...question,enabled:false}));

export const territoryWorldQuestions:Question[]=retiredTerritoryQuestions.map(question=>{
 const flag=territoryById.get(question.provenance.territoryId!)!;
 const code=flag.id.slice('territory-'.length);
 const variant=question.id.endsWith('-feature')?'feature':question.id.endsWith('-region')?'region':'affiliation';
 const feature=features.find(item=>item.code===code);
 const prompt=variant==='feature'?feature!.prompt
  :variant==='region'?`In welcher geografischen Region liegt das Gebiet „${flag.name}“?`
  :`Zu welchem Staat oder Königreich gehört das Gebiet „${flag.name}“?`;
 return {...question,id:`world-territory-v1-${code}-${variant}`,category:'world',prompt,media:null,enabled:true,
  provenance:{...question.provenance,topic:'Regionen & Gebiete',territoryQuestionType:variant,subjectKey:`world:${flag.id}`}};
});

export const territoryAffiliations=new Map(registry.flatMap(flag=>
 affiliationGroups.flat().filter(name=>name===flag.name||
  (flag.iso==='NL'&&name==='Königreich der Niederlande')||
  (flag.iso==='DK'&&name==='Königreich Dänemark')||
  (flag.iso==='CN'&&name==='Volksrepublik China')).map(name=>[name,flag.svg] as const)));
export const territoryRegions=new Set(regionGroups.flat());
export const flagImagePath=(name:string)=>territoryByName.get(name)?.svg??registry.find(flag=>flag.name===name)?.svg;
