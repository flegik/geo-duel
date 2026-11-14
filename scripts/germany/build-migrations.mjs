import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {read} from './foundation.mjs';
import assert from 'node:assert/strict';
const root='supabase/migrations/';
const migration=name=>{
 const file=readdirSync(root).find(f=>f.endsWith('_germany_'+name+'.sql'));
 assert(file,name);
 return root+file;
};
const questions=['foundation','city','geography','other'].flatMap(name=>read(name+'-questions'));
assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
const sqlString=text=>"'"+text.replaceAll("'","''")+"'";
const rows=questions.map(({id,category,difficulty,prompt,options,correct,explanation,media,provenance})=>
 [id,category,difficulty,prompt,JSON.stringify(options),correct,explanation,media&&JSON.stringify(media),JSON.stringify(provenance),false]);
const insert='insert into game.questions (id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled) values\n';
const values=rows.map(row=>'('+row.map(v=>v===null?'null':typeof v==='string'?sqlString(v):String(v)).join(',')+')');
writeFileSync(migration('seed'),insert+values.join(',\n')+'\non conflict (id) do nothing;\n');
writeFileSync(migration('activate'),`do $activation$
begin
 if (select count(*) from game.questions where category='germany' and id like 'de1-%') <> ${questions.length} then
  raise exception 'Germany seed is incomplete';
 end if;
 update game.questions set enabled=true where category='germany' and id like 'de1-%' and not enabled;
end
$activation$;
`);
