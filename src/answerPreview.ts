import raw from '../data/questions.json';
import registry from '../data/flags/registry.json';
import type {Category} from './engine';
export function answerPreview(category:Category,option:string){
 const country=registry.find(f=>f.name===option);
 if(category==='flags'&&country)return {title:option,text:'Staatsflagge in Originalproportionen.',src:country.svg,license:'Public Domain – Flagpedia / Wikimedia Commons'};
 const asset=raw.find(q=>q.category===category&&q.options[q.correct]===option&&q.media);
 if((category==='maps'||category==='silhouettes')&&asset)return {title:option,text:category==='maps'?'Das mintfarben markierte Land.':'Der Länderumriss.',src:asset.media!.src,license:asset.media!.license};
 if(category==='capitals'){
 const q=raw.find(q=>q.category==='capitals'&&q.options[q.correct]===option);
 if(q)return {title:option,text:q.explanation};
 }
 if(category==='landmarks'){
 const q=raw.find(q=>q.category==='landmarks'&&q.options[q.correct]===option);
 if(q)return {title:option,text:q.explanation,src:q.media?.src,license:q.media?.license};
 }
 const fact=raw.find(q=>q.category==='world'&&q.options[q.correct]===option);
 if(category==='world'&&fact)return {title:option,text:fact.explanation};
 // A flag identifies the selected country, without asserting any border relationship.
 if(country)return {title:option,text:category==='borders'?'Zum Vergleich: die Staatsflagge dieses Landes. Eine Grenzbeziehung wird damit nicht behauptet.':'Zum Vergleich: die Staatsflagge dieses Landes.',src:country.svg,license:'Public Domain – Flagpedia / Wikimedia Commons'};
 return {title:option,text:'Für diese Option ist noch keine gesicherte zusätzliche Erklärung hinterlegt.'};
}
