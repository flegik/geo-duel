import atlas from '../data/atlas/geography.json';
import anchors from '../data/learning/map-country-anchors.json';
import registry from '../data/flags/registry.json';
import {cityMapViewport,projectWorldPoint} from './mapViewport';
import type {CityLocation} from './QuestionMedia';

const codes=new Map(registry.map(country=>[country.name,country.iso]));
const points:Record<string,number[]>=anchors;

export function CityQuestionMap({options,location,correct,selected,onSelect,disabled}:{
 options:string[];location?:CityLocation;correct?:number;selected?:number;
 onSelect?:(index:number)=>void;disabled?:boolean;
}){
 const markers=options.map((name,index)=>{
  const iso=codes.get(name);
  return iso&&points[iso]?{iso,name,index,point:projectWorldPoint(points[iso])}:null;
 }).filter(marker=>marker!==null);
 if(markers.length!==4)return null;
 const revealed=correct!==undefined;
 const cityPoint=revealed&&location?projectWorldPoint(location.point):undefined;
 const view=cityMapViewport(markers.map(marker=>marker.point),cityPoint);
 const city=cityPoint?view.toViewport(cityPoint):undefined;
 const radius=view.width*.025;
 const correctIso=markers.find(marker=>marker.index===correct)?.iso;
 const tones=new Map(markers.map(m=>[m.iso,m.index===correct?'#6fe0c4':'#7890ab']));
 return <div className="city-map">
  <svg viewBox={view.viewBox} role="group" aria-label="Regionalkarte mit vier Ländern" className="city-map-svg">
   {view.offsets.map(offset=><g key={offset} transform={`scale(${view.scaleX},1) translate(${offset},0)`} aria-hidden="true">
    {atlas.world.map((feature,index)=><path key={index} d={feature.path} fill={tones.get(feature.iso)??'#304657'}
      fillOpacity={feature.iso===correctIso?'.7':'1'}
      fillRule="evenodd" stroke="#102638" strokeWidth=".6" vectorEffect="non-scaling-stroke"/>)}
   </g>)}
   {markers.map(({point,index,name})=>{
    const [x,y]=view.toViewport(point);
    const tone=index===correct?'correct':revealed&&index===selected?'incorrect':'';
    const choose=onSelect&&!disabled?()=>onSelect(index):undefined;
    return <g key={name} transform={`translate(${x} ${y})`} className={`city-country-pin ${tone}`}
      role={choose?'button':undefined} tabIndex={choose?0:undefined} aria-label={choose?`Karte ${'ABCD'[index]}: ${name}`:undefined}
      aria-hidden={choose?undefined:true} onClick={choose} onKeyDown={event=>{
       if(choose&&(event.key==='Enter'||event.key===' ')){event.preventDefault();choose();}
      }}>
     <circle className="city-pin-hit" r={radius*1.15}/>
     <circle className="city-pin-disc" r={radius} strokeWidth={radius*.15}/>
     <text textAnchor="middle" dominantBaseline="central" fontSize={radius*1.35}>{'ABCD'[index]}</text>
    </g>;
   })}
   {city&&<g className="city-location-pin" transform={`translate(${city[0]} ${city[1]})`} aria-hidden="true">
    <circle r={radius*.63} strokeWidth={radius*.19}/>
    <circle r={radius*.29}/>
   </g>}
  </svg>
  {city&&location&&<p className="city-map-location"><span aria-hidden="true"/> Lage von {location.name}</p>}
 </div>;
}
