import raw from '../data/questions.json';
import registry from '../data/flags/registry.json';
import facts from '../data/learning/countries.json';
import sites from '../data/learning/unesco-sites.json';
import type {QuestionResolution} from './QuestionMedia';
import type {Category} from './engine';
type Preview={title:string;text:string;src?:string;license?:string;atlasIso?:string;map?:boolean};
export function answerPreview(category:Category,option:string,resolution?:QuestionResolution|null):Preview{
 const country=registry.find(f=>f.name===option);
 if(country&&(category==='maps'||category==='silhouettes'))return {title:option,text:category==='maps'?'Das mintfarben markierte Land.':'Der Länderumriss.',atlasIso:country.iso,map:category==='maps'};
 if(category==='capitals'){
 const match=Object.entries(facts).find(([,f])=>f.capital===option);
 if(match)return {title:option,text:`${option} ist die Hauptstadt von ${registry.find(c=>c.iso===match[0])!.name}.`};
 if(country){const f=facts[country.iso as keyof typeof facts];if(f.capital)return {title:option,text:`Die Hauptstadt von ${option} ist ${f.capital}.`,src:country.svg};}
 }
 if(category==='landmarks'){
 const city=resolution?.cityChoices?.find(choice=>choice.name===option);
 const owner=city&&registry.find(entry=>entry.iso===city.iso);
 if(city&&owner)return {title:option,text:`${option} liegt in ${owner.name}.`,src:owner.svg,license:'Public Domain – Flagpedia / Wikimedia Commons'};
 const site=sites.find(s=>s.name===option);if(site)return {title:option,text:`UNESCO-Stätte in ${registry.find(f=>f.iso===site.iso)?.name??site.iso}.`};
 }
 if(country)return {title:option,text:category==='borders'?'Zum Vergleich: die Staatsflagge dieses Landes. Eine Grenzbeziehung wird damit nicht behauptet.':'Staatsflagge in Originalproportionen.',src:country.svg,license:'Public Domain – Flagpedia / Wikimedia Commons'};
 const fact=raw.find(q=>q.category===category&&q.options[q.correct]===option);
 if(fact)return {title:option,text:fact.explanation};
 return {title:option,text:'Für diese Option ist noch keine gesicherte zusätzliche Erklärung hinterlegt.'};
}
