import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {states, write} from './foundation.mjs';

const input = process.argv[2];
assert(input, 'Pass the source directory from data/germany/SOURCES.md.');
const read = name => readFileSync(join(input,name),'utf8');
const unquote = value => value.startsWith('"') ? value.slice(1,-1).replaceAll('""','"') : value;
const rows = read('gemeinden.csv').trim().split(/\r?\n/).map(line=>line.match(/"(?:[^"]|"")*"|[^,]+|(?<=,)(?=,)/g).map(unquote));
const headers=rows.shift();
const municipality = rows.map(row=>Object.fromEntries(headers.map((name,i)=>[name,row[i]])))
 .filter(r=>r.gf==='4'&&r.bsg==='1'&&r.bez==='Stadt'&&Number(r.ewz)>0);
assert(municipality.length>1900);
let places=new Map();
for(const row of read('DE.txt').split(/\r?\n/)){
 const fields=row.split('\t');
 const [id,name,ascii,alternate,lat,lon,kind,code] = fields;
 // GeoNames stores AGS in admin4 (column 14) and WGS84 coordinates.
 const key=fields[13];
 if(kind!=='P'||!/^PPL(?:C|A[2-4]?|)$/.test(code)||!/^\d{8}$/.test(key))continue;
 const place={id,name,ascii,alternate,point:[Number(lon),Number(lat)],population:Number(fields[14])};
 const group=places.get(key)??[];
 group.push(place);
 places.set(key,group);
}
const rings = geometry => geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
function contains(ring,[x,y]) {
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i], [xj,yj]=ring[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
const borders=new Map(JSON.parse(read('lands.json')).features.filter(f=>f.properties.gf===4)
 .map(f=>[f.properties.lkz,rings(f.geometry)]));
const normalized = name => name.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={
 'Freiburg im Breisgau':'Freiburg', 'Frankfurt (Oder)':'Frankfurt (Oder)', 'Ludwigshafen am Rhein':'Ludwigshafen am Rhein',
 'Halle (Saale)':'Halle (Saale)', 'Brandenburg an der Havel':'Brandenburg an der Havel',
 'Lutherstadt Wittenberg':'Wittenberg', 'Neustadt an der Weinstraße':'Neustadt an der Weinstraße',
};
const cities=municipality.flatMap(({ags,lkz,gen,ewz,kfl})=>{
 const aliasesForCity=[gen,aliases[gen],gen.split(',')[0]].filter(Boolean).map(normalized);
 const matches=(places.get(ags)??[]).filter(p=>[p.name,p.ascii,...p.alternate.split(',')].map(normalized).some(n=>aliasesForCity.includes(n)))
  .filter(p=>borders.get(lkz)?.some(([outer,...holes])=>contains(outer,p.point)&&!holes.some(h=>contains(h,p.point))))
  .sort((a,b)=>b.population-a.population);
 const place=matches[0];
 if(!place)return [];
 const name=gen.replace(', Landeshauptstadt','').replace(', Bundesstadt','');
 return [{ags,state:lkz,name,point:place.point,geoname:place.id,population:Number(ewz),area:Number(kfl)}];
});
assert(cities.length>1500,cities.length.toString());
const seen=new Set();
const unique=cities.sort((a,b)=>b.population-a.population).filter(city=>{
 if(seen.has(city.name))return false;
 seen.add(city.name);
 return true;
});
const quotas={SH:10,HH:1,NI:19,HB:2,NW:23,HE:16,RP:13,BW:21,BY:22,SL:7,BE:1,BB:10,MV:8,SN:10,ST:9,TH:8};
const selected=states.flatMap(state=>{
 const local=unique.filter(c=>c.state===state.code);
 assert(local.some(c=>c.ags===state.capitalAgs),state.capital);
 return local.slice(0,quotas[state.code]);
});
assert(selected.length>=180,selected.length.toString());
const priorityNames=['Heidelberg','Mannheim','Ludwigshafen am Rhein','Worms','Görlitz','Weimar','Jena','Wetzlar','Passau','Trier',
 'Konstanz','Rostock','Stralsund','Garmisch-Partenkirchen','Saarlouis','Dresden','Leipzig','Augsburg','Freiburg im Breisgau','Dortmund','München','Köln'];
const byPriority=(a,b)=>Number(priorityNames.includes(b.name))-Number(priorityNames.includes(a.name))||b.population-a.population;
const pinned=states.map(s=>unique.find(c=>c.ags===s.capitalAgs)).concat(unique.filter(c=>priorityNames.includes(c.name)));
const selectedIds=new Set();
const core=[...pinned,...selected.sort(byPriority)].filter(c=>{
 if(selectedIds.has(c.ags))return false;
 selectedIds.add(c.ags);
 return true;
}).slice(0,180);
assert.equal(core.length,180);
const mapQuotas={SH:7,HH:1,NI:12,HB:2,NW:13,HE:10,RP:9,BW:13,BY:13,SL:5,BE:1,BB:7,MV:6,SN:8,ST:7,TH:6};
const mapSelected=states.flatMap(state=>core.filter(c=>c.state===state.code).slice(0,mapQuotas[state.code]));
const mapIds=new Set([...pinned.filter(c=>core.includes(c)),...mapSelected].slice(0,140).map(c=>c.ags));
for(const city of core)if(mapIds.size<120)mapIds.add(city.ags);
const allowed = new Set([...new Set([...pinned,...core.filter(c=>mapIds.has(c.ags))])].slice(0,120).map(c=>c.ags));
assert.equal(allowed.size,120);
write('cities',core.map(c=>({...c,map:allowed.has(c.ags)})));
