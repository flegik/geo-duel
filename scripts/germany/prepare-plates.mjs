import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const input=process.argv[2];
assert(input,'Pass the KBA text extract');
const records=readFileSync(input,'utf8').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
const sections=new Map();
for(const [i,line] of records.entries()){
 if(!/^[A-ZÄÖÜ]{1,3}$/.test(line))continue;
 const next=records.slice(i+1,i+46);
 const stop=next.findIndex(v=>/^[A-ZÄÖÜ]{1,3}$/.test(v));
 const caption=next.slice(0,stop<0?next.length:stop).join(' ').replace(/- /g,'-').replace(/ \d+ Unter-.*$/,'');
 const list=sections.get(line)??[];
 list.push(caption);
 sections.set(line,list);
}
const aliases={HB:'Freie Hansestadt Bremen',H:'Hannover',F:'Frankfurt/Main',HAL:'Halle, Stadt',
 BRB:'Brandenburg, Stadt',LRO:'Rostock, Landkreis',SB:'Saarbrücken, Stadt und Stadtver-band'};
const excluded=new Set(['L','HZ','BK','DD','FS','N']);
const citiesWithDistrict=new Set(['KS','DA','MZ','TR','KL','HD','KA','FR','PF','UL','HN','M','A','R','WÜ','PA','FÜ','FD']);
const quotas={NW:12,BE:1,HH:1,HB:1,SH:8,NI:11,HE:9,RP:9,BW:12,BY:12,SN:5,TH:6,ST:5,BB:6,MV:6,SL:5};
const used={};
const parsed=readFileSync('data/germany/plate-candidates.tsv','utf8').trim().split(/\r?\n/).map(l=>l.split('\t'));
const rows=parsed.flatMap(([code,name,state])=>{
 if(excluded.has(code)||((used[state]??0)>=quotas[state]))return [];
 const label=aliases[code]??name;
 const found=sections.get(code)?.find(v=>v.includes(label));
 assert(found,code+' / '+label);
 used[state]=(used[state]??0)+1;
 const caption=found.split(' auslaufend ')[0].replace(/\s*\d\)\s*/g,' ').replaceAll(' ,',';').trim();
 return [{code,name,state,caption,shared:citiesWithDistrict.has(code),historical:found.includes('auslaufend')}];
});
assert.equal(rows.length,109,JSON.stringify(used));
writeFileSync('data/germany/plates.json',JSON.stringify(rows,null,1)+'\n');
