import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import registry from '../data/flags/registry.json';
import policy from '../data/learning/selection-policy.json';
import facts from '../data/learning/countries.json';
import {reverseFlagQuestions} from '../src/flags';
import cityMaps from '../data/question-pool/city-maps.json';
import landmarkCities from '../data/question-pool/landmark-cities.json';
import comparisons from '../data/question-pool/world-comparisons.json';

const images=new Map(registry.map(c=>[c.name,c.svg]));
const flags=reverseFlagQuestions.map(q=>({...q,provenance:{...q.provenance,optionImages:q.options.map(name=>images.get(name)!)}}));
const all=[...flags,...cityMaps,...landmarkCities,...comparisons];
const countryContinents=Object.fromEntries(Object.entries(facts).map(([iso,fact])=>[
 iso,(policy.continentOverrides as Record<string,string>)[iso]??(policy.subregionContinents as Record<string,string>)[fact.subregion],
]));
const config=JSON.stringify({...policy,countryContinents});
const args=process.argv.slice(2);
const compatibility=args.shift()!,activation=args.pop()!;
if(!process.env.COUNT_ONLY)assert.ok(compatibility&&activation);
assert.equal(all.length,502);
assert.equal(new Set(all.map(q=>q.id)).size,502);

const batches:string[][]=[[]];
let size=0;
for(const q of all){
 const row=JSON.stringify(q);
 const bytes=Buffer.byteLength(row)+1;
 if(size+bytes>96000){batches.push([]);size=0;}
 batches.at(-1)!.push(row);
 size+=bytes;
}
if(process.env.COUNT_ONLY){console.log(batches.length);process.exit(0);}
writeFileSync(compatibility,readFileSync('scripts/expanded-quiz-compatibility.sql','utf8')+
 `\ncreate or replace function game.selection_policy() returns jsonb\n
language sql immutable security invoker set search_path='' as $config$
 select $policy$${config}$policy$::jsonb
$config$;
revoke all on function game.selection_policy() from public,anon,authenticated;
`);
assert.equal(args.length,batches.length,'Provide one migration path per seed batch');
for(const [index,batch] of batches.entries()){
 const json='['+batch.join(',')+']';
 assert.ok(!json.includes('$seed$'));
 writeFileSync(args[index],`-- Insert immutable questions disabled. Activation is a separate transaction.
insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
select id,category,difficulty,prompt,options,correct,explanation,nullif(media,'null'::jsonb),provenance,false
from jsonb_to_recordset($seed$${json}$seed$::jsonb)
 as q(id text,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,media jsonb,provenance jsonb)
on conflict(id) do nothing;
`);
}

const ids=JSON.stringify(all.map(q=>q.id));
writeFileSync(activation,`-- Activate only the 502 IDs published by this release.
do $activation$
declare ids jsonb:=$ids$${ids}$ids$::jsonb;
begin
 if (select count(*) from game.questions where ids ? game.questions.id)<>502 then
  raise exception 'Incomplete GeoDuel question seeds';
 end if;
 update game.questions set enabled=true where ids ? game.questions.id and not enabled;
end
$activation$;
`);
