import geography from '../data/atlas/geography.json';
export const atlasGeography=geography.countries as Record<string,{continent:string;path:string;width:number;height:number}>;
export function AtlasGeography({iso,name,map=false}:{iso:string;name:string;map?:boolean}){
 const shape=atlasGeography[iso];if(!shape)return <p>Keine geprüfte Geometrie verfügbar.</p>;
 const outline=<svg className="atlas-visual" viewBox={`0 0 ${shape.width} ${shape.height}`} role="img" aria-label={`Umriss von ${name}`} preserveAspectRatio="xMidYMid meet"><path d={shape.path} fill="#6fe0c4" fillRule="evenodd"/></svg>;
 return map?<><svg className="atlas-world" viewBox="0 0 720 360" role="img" aria-label={`${name} auf der Weltkarte mintfarben markiert`}><rect width="720" height="360" fill="#101827"/>{geography.world.map((f,i)=><path key={i} d={f.path} fill={f.iso===iso?'#6fe0c4':'#344253'} fillRule="evenodd" stroke={f.iso===iso?'#6fe0c4':'#192536'} strokeWidth=".3"/>)}</svg><details><summary>Land vergrößert ansehen</summary>{outline}</details></>:outline;
}
