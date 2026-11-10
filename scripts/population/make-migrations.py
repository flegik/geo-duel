"""Build disabled population seeds and shared selection SQL. Never overwrite applied migration files.
Copy generated SQL to supabase/migrations only using the actual applied version from the server.
"""
import json,hashlib
from pathlib import Path
root=Path('scripts/generated');root.mkdir(exist_ok=True)
policy=json.loads(Path('data/learning/selection-policy.json').read_text());facts=json.loads(Path('data/learning/countries.json').read_text())
policy['countryContinents']={iso:policy['continentOverrides'].get(iso,policy['subregionContinents'][v['subregion']]) for iso,v in facts.items()}
config=json.dumps(policy,ensure_ascii=False,separators=(',',':'))
config_sql="create or replace function game.selection_policy() returns jsonb language sql immutable security invoker set search_path='' as $config$ select $policy$"+config+"$policy$::jsonb $config$;\n"
helpers=config_sql+Path('scripts/population/selection-helpers.sql').read_text()
(root/'population_selection_helpers.sql').write_text(helpers)
# Only replace question picking; the flags branch, options, membership and scoring remain unchanged.
rpc=Path('scripts/generated-population-rpc-before.sql').read_text();start=rpc.index('    -- Prefer questions not seen');end=rpc.index("    if chosen is null",start);previous=rpc[start:end]
replacement="    if c='flags' then\n"+previous+"    else\n     chosen:=game.pick_balanced_question(c,d,r);\n    end if;\n"
rpc=rpc[:start]+replacement+rpc[end:]
(root/'population_selection_activate.sql').write_text('-- Only new starts use weighted selection; existing room questions/options/answers are untouched.\n'+rpc)
questions=json.loads(Path('data/question-pool/population.json').read_text());blob=json.dumps(questions,ensure_ascii=False,separators=(',',':'));assert '$population$' not in blob
sql="""-- Insert only. subject_key is generated from provenance. Stage disabled until PWA deployment.
insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
select id,category,difficulty,prompt,options,correct,explanation,nullif(media,'null'::jsonb),provenance,false
from jsonb_to_recordset($population$"""+blob+"""$population$::jsonb) as x(id text,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,media jsonb,provenance jsonb)
on conflict(id) do nothing;
"""
(root/'population_seed.sql').write_text(sql)
ids=','.join("'"+q['id']+"'" for q in questions)
activate="""do $check$ begin
 if (select count(*) from game.questions where id in ("""+ids+"""))<>120 then raise exception 'Incomplete population pool';end if;
end $check$;
update game.questions set enabled=true where id in ("""+ids+""");
-- Old population IDs stay queryable for historical/active duels; updates create new IDs.
update game.questions set enabled=false where id like 'population-v1-%' and id not in ("""+ids+""");
"""
(root/'population_questions_activate.sql').write_text(activate)
verify="with expected as(select * from jsonb_to_recordset($population$"+blob+"$population$::jsonb) as x(id text,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,media jsonb,provenance jsonb)) select count(*) expected,count(q.id) stored,count(*) filter(where q.id is null or (e.category,e.difficulty,e.prompt,e.options,e.correct,e.explanation,nullif(e.media,'null'::jsonb),e.provenance,e.provenance->>'subjectKey') is distinct from (q.category,q.difficulty,q.prompt,q.options,q.correct,q.explanation,q.media,q.provenance,q.subject_key)) mismatches from expected e left join game.questions q on q.id=e.id;"
(root/'population_verify.sql').write_text(verify)
print('Generated helper, RPC selection-only patch, 120 disabled seed rows, guarded activation and full source verification')
