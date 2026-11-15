import markers from '../data/learning/map-marker-keys.json';
import registry from '../data/flags/registry.json';

const names=new Map(registry.map(country=>[country.name,country.iso]));
const keys:Record<string,string>=markers;
export const mapMarkerCountry=(option:string)=>option.startsWith('marker:')?keys[option.slice(7)]:names.get(option);

export function cityMapPrompt(prompt:string) {
 const city=prompt.match(/^In welchem dieser Länder liegt (.+)\?$/)?.[1];
 return city ? `Welcher Marker zeigt das Land, in dem ${city} liegt?` : prompt;
}
