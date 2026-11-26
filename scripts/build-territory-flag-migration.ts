import {appendFileSync} from 'node:fs';
import {flagImagePath,territoryFlagQuestions,retiredTerritoryQuestions} from '../src/territoryFlags';

const file=process.argv[2];
if(!file)throw Error('Pass the destination migration file');
const data=[...territoryFlagQuestions,...retiredTerritoryQuestions].map(question=>{
 if(question.media?.type!=='flag-options')return question;
 const optionImages=question.options.map(flagImagePath);
 if(optionImages.some(path=>!path))throw Error(`Missing image for ${question.id}`);
 return {...question,provenance:{...question.provenance,optionImages}};
});
appendFileSync(file,`
insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
select id,category,difficulty,prompt,options,correct,explanation,media,provenance,true
from jsonb_to_recordset($territory_flags$${JSON.stringify(data)}$territory_flags$::jsonb)
as q(id text,category text,difficulty integer,prompt text,options jsonb,correct integer,explanation text,media jsonb,provenance jsonb)
on conflict(id) do nothing;
`);
