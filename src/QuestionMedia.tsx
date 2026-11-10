import raw from '../data/questions.json';
import registry from '../data/flags/registry.json';
import {lazy,Suspense} from 'react';
const Geography=lazy(()=>import('./AtlasGeography').then(m=>({default:m.AtlasGeography})));
const legacy=new Map(raw.filter(q=>q.category==='maps'||q.category==='silhouettes').map(q=>[q.media!.src,registry.find(f=>f.name===q.options[q.correct])!.iso]));
export type QuestionMediaData={src:string;alt:string;license:string;type?:string};
export function QuestionMedia({media}:{media:QuestionMediaData}){
 const iso=media.src.startsWith('atlas:')?media.src.slice(6):legacy.get(media.src)??null;
 return <>{iso?<Suspense fallback={<p role="status">Karte wird geladen …</p>}><Geography iso={iso} name="gesuchtes Land" map={media.type==='atlas-map'} regional/></Suspense>:<img src={media.src} alt={media.alt}/>}<small>{media.license}</small></>;
}
