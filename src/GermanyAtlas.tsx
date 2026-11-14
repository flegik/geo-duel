import {useState} from 'react';
import {germanStates} from './germanyPool';
import {GermanyMap} from './GermanyMap';

const alphabetic=[...germanStates].sort((a,b)=>a.name.localeCompare(b.name,'de'));
export function GermanyAtlas(){
 const [code,setCode]=useState(alphabetic[0].code);
 const state=alphabetic.find(s=>s.code===code)!;
 return <div>
  <label className="label" htmlFor="atlas-bundesland">Bundesland wählen</label>
  <select id="atlas-bundesland" value={code} onChange={event=>setCode(event.target.value)}>
   {alphabetic.map(entry=><option key={entry.code} value={entry.code}>{entry.name}</option>)}
  </select>
  <article className="panel atlas-card germany-atlas-card">
   <h2>{state.name}</h2>
   <p>Landeshauptstadt <strong>{state.capital}</strong></p>
   <img className="atlas-visual atlas-flag" src={state.flag} alt={`Landesflagge von ${state.name}`}/>
   <p className="fine-print">{state.flagDetail}</p>
   <small className="atlas-source"><a href={state.flagSource} target="_blank" rel="noreferrer">Wikimedia Commons · gemeinfrei</a></small>
   <GermanyMap state={code}/>
  </article>
 </div>;
}
