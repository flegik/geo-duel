import registry from '../data/flags/registry.json';
import raw from '../data/questions.json';
export type AtlasArea='flags'|'silhouettes'|'maps'|'facts';
export const favoriteKey='geoduel-atlas-favorites-v1';
export const atlasCountries=registry.map(f=>{
 const media=(category:string)=>raw.find(q=>q.category===category&&q.options[q.correct]===f.name)?.media??null;
 const capitalQuestion=raw.find(q=>q.category==='capitals'&&q.prompt===`Was ist die Hauptstadt von ${f.name}?`);
 const neighbors=new Set<string>();
 for(const q of raw.filter(q=>q.category==='borders')){const home=q.prompt.match(/^Welches dieser Länder hat eine Landgrenze mit (.+)\?$/)?.[1];const other=q.options[q.correct];if(home===f.name)neighbors.add(other);if(other===f.name&&home)neighbors.add(home);}
 const landmarks=raw.filter(q=>q.category==='landmarks'&&q.options[q.correct]===f.name).map(q=>({name:q.prompt.match(/„(.+)“/)?.[1]??'Sehenswürdigkeit',media:q.media}));
 return {iso:f.iso,name:f.name,flag:f.svg,outline:media('silhouettes'),map:media('maps'),capital:capitalQuestion?.options[capitalQuestion.correct]??null,neighbors:[...neighbors],landmarks};
}).sort((a,b)=>a.name.localeCompare(b.name,'de'));
export function loadFavorites(storage:Pick<Storage,'getItem'>):string[]{try{const data=JSON.parse(storage.getItem(favoriteKey)??'[]');return Array.isArray(data)?[...new Set(data.filter((x:unknown)=>typeof x==='string'&&atlasCountries.some(c=>c.iso===x)))]:[];}catch{return [];}}
export function filterAtlas(query:string,favorites:string[],onlyFavorites:boolean){const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').replace(/ß/g,'ss');return atlasCountries.filter(c=>(!onlyFavorites||favorites.includes(c.iso))&&(norm(c.name).includes(norm(query.trim()))||c.iso.toLowerCase()===query.trim().toLowerCase()));}
export function shuffleAtlas<T>(items:T[],random= Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
