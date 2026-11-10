import {mapViewport} from './mapViewport';
import geography from '../data/atlas/geography.json';
export const atlasGeography=geography.countries as Record<string,{continent:string;path:string;width:number;height:number}>;
export function AtlasGeography({iso,name,map=false,regional=false}:{iso:string;name:string;map?:boolean;regional?:boolean}){
 const shape=atlasGeography[iso];if(!shape)return <p>Keine geprüfte Geometrie verfügbar.</p>;
 const target=geography.world.filter(f=>f.iso===iso);const viewport=mapViewport(target.map(f=>f.path));
 const tiny=viewport.tiny;
 const outline=<svg className="atlas-visual" viewBox={`0 0 ${shape.width} ${shape.height}`} role="img" aria-label={`Umriss von ${name}`} preserveAspectRatio="xMidYMid meet"><path d={shape.path} fill="#6fe0c4" fillRule="evenodd"/></svg>;
 return map?<><svg className="atlas-world" viewBox={regional?viewport.viewBox:'0 0 720 360'} role="img" aria-label={`${name} auf der Weltkarte mintfarben markiert`}><rect x="-720" y="-720" width="2160" height="1800" fill="#101827"/>{(regional?[-720,0,720]:[0]).map(offset=><g key={offset} transform={`translate(${offset},0)`}>{geography.world.map((f,i)=><path key={i} d={f.path} fill={f.iso===iso?'#6fe0c4':'#344253'} fillRule="evenodd" stroke={f.iso===iso?'#6fe0c4':'#192536'} strokeWidth={regional?Math.min(.3,viewport.width/2000):.3}/>)}</g>)}{regional&&tiny&&<circle cx={viewport.x} cy={viewport.y} r={viewport.width/70} fill="none" stroke="#6fe0c4" strokeWidth={viewport.width/300}/>}</svg>{regional&&tiny&&<small>Positionsring für ein sehr kleines Land. Der Umriss darunter zeigt die Form vergrößert.</small>}<details open={regional&&tiny}><summary>Land vergrößert ansehen</summary>{outline}</details></>:outline;
}
