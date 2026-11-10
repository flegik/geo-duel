import {useState} from 'react';
import {regionalViews} from './mapViewport';
import geography from '../data/atlas/geography.json';
import water from '../data/atlas/water.json';
export const atlasGeography=geography.countries as Record<string,{continent:string;path:string;width:number;height:number}>;
const cache=new Map<string,ReturnType<typeof regionalViews>>();
function viewsFor(iso:string){if(!cache.has(iso))cache.set(iso,regionalViews(geography.world.filter(f=>f.iso===iso).map(f=>f.path)));return cache.get(iso)!;}
export function AtlasGeography({iso,name}:{iso:string;name:string;map?:boolean;regional?:boolean}){
 const [selection,setSelection]=useState({iso,index:0});const views=viewsFor(iso);const index=selection.iso===iso?selection.index:0;const view=views[index]??views[0];
 if(!view)return <p>Keine geprüfte Geometrie verfügbar.</p>;
 const draw=(v:Omit<typeof view,'detail'>,detail=false)=><svg className={`atlas-world regional-map ${v.aspect<1?'portrait':''}`} style={{aspectRatio:v.aspect,maxWidth:(detail?150:(v.aspect<1?390:340))*v.aspect}} viewBox={v.viewBox} role="img" aria-label={`${name} mintfarben im regionalen Kartenkontext${detail?' – vergrößerter Nahbereich':''}`} preserveAspectRatio="xMidYMid meet">
 <rect x={v.x-v.width/2} y={v.y-v.height/2} width={v.width} height={v.height} fill="#102435"/>
 {[-720,0,720].map(offset=><g key={offset} transform={`scale(${v.scaleX},1) translate(${offset},0)`}>
 {geography.world.map((f,i)=><path key={i} d={f.path} fill={f.iso===iso?'#6fe0c4':'#34495a'} fillRule="evenodd" stroke={f.iso===iso?'#a5f1de':'#647c8a'} strokeWidth={f.iso===iso?.8:.55} vectorEffect="non-scaling-stroke"/>)}
 {water.map((lake,i)=><path key={`lake-${i}`} d={lake.path} fill="#102435" fillRule="evenodd" stroke="#43677a" strokeWidth=".35" vectorEffect="non-scaling-stroke"/>)}
 </g>)}
 {v.tiny&&<circle cx={v.x} cy={v.y} r={v.width/55} fill="none" stroke="#a5f1de" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>}
 </svg>;
 return <div className="regional-geography"><div className="regional-map-frame" style={{maxWidth:view.aspect<1?351:544,margin:'0 auto'}}>{draw(view)}<span className="map-north" aria-label="Norden">N ↑</span></div>
 {view.detail&&<div className="map-detail"><span>Land und unmittelbare Umgebung vergrößert</span>{draw(view.detail,true)}<small>Kartografisch vereinfacht. Der Hauptausschnitt zeigt die regionale Lage.</small></div>}
 {views.length>1&&<div className="map-regions" role="group" aria-label="Regionale Kartenausschnitte">{views.map((_,i)=><button key={i} aria-pressed={index===i} onClick={()=>setSelection({iso,index:i})}>Ausschnitt {i+1}</button>)}<small>Entfernte Landesteile in eigenen regionalen Ausschnitten.</small></div>}
 <div className="map-legend"><span><i/>Hervorgehoben</span><span><i/>Umgebung</span><span><i/>Wasser</span></div></div>;
}
