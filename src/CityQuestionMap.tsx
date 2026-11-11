import atlas from '../data/atlas/geography.json';
import anchors from '../data/learning/map-country-anchors.json';
import registry from '../data/flags/registry.json';
import {pointMapViewport,type Point} from './mapViewport';
import type {CityLocation} from './QuestionMedia';

const codes=new Map(registry.map(country=>[country.name,country.iso]));
const points:Record<string,number[]>=anchors;
const project=([lat,lon]:readonly number[]):Point=>[(lon+180)*2,(90-lat)*2];

export function CityQuestionMap({options,location,correct,selected,onSelect,disabled}:{
 options:string[];location?:CityLocation;correct?:number;selected?:number;
 onSelect?:(index:number)=>void;disabled?:boolean;
}){
 const markers=options.map((name,index)=>{
  const iso=codes.get(name);
  return iso&&points[iso]?{iso,name,index,point:project(points[iso])}:null;
 }).filter(marker=>marker!==null);
 if(markers.length!==4)return null;
 const city=location?project(location.point):undefined;
 const view=pointMapViewport([...markers.map(marker=>marker.point),...(city?[city]:[])]);
 const left=view.sourceX-view.sourceWidth/2,right=view.sourceX+view.sourceWidth/2;
 const offsets=[...(left<0?[-720]:[]),0,...(right>720?[720]:[])];
 const localX=(x:number)=>((x-view.sourceX+1080)%720-360+view.sourceX)*view.scaleX;
 const radius=view.width*.032;
 const correctIso=markers.find(marker=>marker.index===correct)?.iso;
 const tones=new Map(markers.map(m=>[m.iso,m.index===correct?'#6fe0c4':'#7890ab']));
 return <div className="city-map">
  <svg viewBox={view.viewBox} role="group" aria-label="Regionalkarte mit vier Ländern" className="city-map-svg">
   {offsets.map(offset=><g key={offset} transform={`scale(${view.scaleX},1) translate(${offset},0)`} aria-hidden="true">
    {atlas.world.map((feature,index)=><path key={index} d={feature.path} fill={tones.get(feature.iso)??'#304657'}
      fillOpacity={feature.iso===correctIso?'.7':'1'}
      fillRule="evenodd" stroke="#102638" strokeWidth=".6" vectorEffect="non-scaling-stroke"/>)}
   </g>)}
   {markers.map(({point:[x,y],index,name})=>{
    const tone=index===correct?'correct':index===selected?'incorrect':'';
    const choose=onSelect&&!disabled?()=>onSelect(index):undefined;
    return <g key={name} transform={`translate(${localX(x)} ${y})`} className={`city-country-pin ${tone}`}
      role={choose?'button':undefined} tabIndex={choose?0:undefined} aria-label={choose?`Karte ${'ABCD'[index]}: ${name}`:undefined}
      aria-hidden={choose?undefined:true} onClick={choose} onKeyDown={event=>{
       if(choose&&(event.key==='Enter'||event.key===' ')){event.preventDefault();choose();}
      }}>
     <circle r={radius} strokeWidth={radius*.15}/>
     <text textAnchor="middle" dominantBaseline="central" fontSize={radius*1.12}>{'ABCD'[index]}</text>
    </g>;
   })}
   {city&&<g className="city-location-pin" transform={`translate(${localX(city[0])} ${city[1]})`} aria-hidden="true">
    <circle r={radius*.63} strokeWidth={radius*.19}/>
    <circle r={radius*.29}/>
   </g>}
  </svg>
  {location&&<p className="city-map-location"><span aria-hidden="true"/> Lage von {location.name}</p>}
 </div>;
}
