import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {flagQuestions} from '../src/flags';

const {PGlite}=await import(process.env.GEODUEL_PGLITE_MODULE??'@electric-sql/pglite');
const root='supabase/migrations';
export const migration=(suffix:string)=>readFileSync(`${root}/${readdirSync(root).find(name=>name.endsWith(suffix+'.sql'))}`,'utf8');
const read=(name:string)=>readFileSync(`${root}/${name}`,'utf8');
function definition(sql:string,name:string){
 const start=sql.toLowerCase().indexOf('create or replace function '+name);
 assert.ok(start>=0,name);
 const body=sql.indexOf('$function$',start);
 assert.ok(body>=0,name);
 return sql.slice(start,sql.indexOf('$function$',body+10)+10)+';';
}
export async function createDuelTestDb(){
const db=new PGlite();
await db.exec(`
create role anon;
create role authenticated;
create schema game;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select current_setting('geo.test_user',true)::uuid
$$;
create function game.throttle(text,int,int) returns boolean language sql as $$ select true $$;
create table game.rooms(
 id uuid primary key default gen_random_uuid(),code text,host uuid,status text default 'waiting',per_category int,selected_categories text[],categories text[] default '{}',
 expires_at timestamptz default now()+interval '30 minutes',created_at timestamptz default now(),
 previous_id uuid unique,rematch_id uuid,finished_at timestamptz
);
create unique index waiting_code on game.rooms(code) where status='waiting';
create table game.profiles(id uuid primary key,nickname text);
create table game.participants(room_id uuid,profile_id uuid,ready boolean default false,cursor int default 0,finished boolean default false,
 primary key(room_id,profile_id));
create table public.duel_events(room_id uuid,version int default 0);
create table game.questions(id text primary key,category text,difficulty int,prompt text,options jsonb,correct int,
 explanation text,media jsonb,provenance jsonb,enabled bool,
 subject_key text generated always as(provenance->>'subjectKey') stored);
create table game.match_questions(room_id uuid,position int,question_id text,option_order int[],primary key(room_id,position));
create table game.answers(room_id uuid,profile_id uuid,position int,option_index int,points int,created_at timestamptz);
`);
const oldFlagSchema=readFileSync('scripts/flag-schema.sql','utf8');
const orderedStart=oldFlagSchema.indexOf('create or replace function game.ordered_options');
const orderedEnd=oldFlagSchema.indexOf('revoke all on function game.ordered_options',orderedStart);
await db.exec(oldFlagSchema.slice(orderedStart,orderedEnd));
await db.exec(definition(read('20261110202728_population_balance_activate.sql'),'public.geoduel'));
await db.exec(definition(read('20261110184919_question_pool_v3_support.sql'),'game.snapshot'));
await db.exec(definition(read('20261110184919_question_pool_v3_support.sql'),'game.result'));
await db.exec(read('20261111123541_duel_review_compare.sql'));
await db.exec(read('20261110201843_population_selection_helpers.sql'));
await db.exec(read('20261111164202_regional_round_selection.sql'));
await db.query(`insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
 select id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled
 from jsonb_to_recordset($1::jsonb) as t(id text,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,media jsonb,provenance jsonb,enabled bool)`,
 [JSON.stringify(flagQuestions)]);
await db.exec(migration('_expanded_quiz_compatibility'));
const seeds=readdirSync(root).filter(name=>name.includes('_expanded_quiz_seed_')).sort();
for(const name of seeds)await db.exec(read(name));
return db;
}
