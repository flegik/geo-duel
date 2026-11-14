import map from '../data/germany/map.json';
import {germanStates} from './germanyPool';
import {projectGermanyPoint} from './germanyProjection';
import './germany.css';

const stateKeys=new Map(germanStates.map(s=>[s.mapKey,s.code]));

export function GermanyMap({state,point}:{state?:string;point?:readonly number[]}){
 const marker=point&&projectGermanyPoint(point);
 return <div className="germany-map">
  <svg viewBox={map.viewBox} role="img" aria-label={marker?'Deutschlandkarte mit markiertem Stadtpunkt':'Deutschlandkarte mit markiertem Bundesland'} className="germany-map-svg">
   <g aria-hidden="true">{map.paths.map(({code,path})=><path key={code} d={path} fill={code===state?'#6fe0c4':'#304b60'}
    stroke="#112637" strokeWidth=".8" vectorEffect="non-scaling-stroke" fillRule="evenodd"/>)}</g>
   {marker&&<g aria-hidden="true" transform={`translate(${marker[0]} ${marker[1]})`}>
    <circle r="12" fill="#6fe0c4" stroke="#14232d" strokeWidth="4"/><circle r="3" fill="#14232d"/>
   </g>}
  </svg>
  <small className="atlas-source">© <a href="https://www.bkg.bund.de" target="_blank" rel="noreferrer">BKG</a> 2026 · <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noreferrer">dl-de/by-2-0</a> · <a href="https://sg.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf" target="_blank" rel="noreferrer">Datenquellen</a> · vereinfacht und eingefärbt</small>
 </div>;
}

export function GermanyQuestionMap({src}:{src:string}){
 if(src.startsWith('de-map:'))return <GermanyMap state={stateKeys.get(src.slice(7))}/>;
 const point=src.slice(9).split(',').map(Number);
 return point.length===2&&point.every(Number.isFinite)?<GermanyMap point={point}/>:null;
}
