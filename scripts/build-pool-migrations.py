"""Generate disabled, insert-only seeds; no profiles/answers/rounds are updated.
After applying, move each generated SQL into supabase/migrations using the actual server migration version.
"""
import json
from pathlib import Path
root=Path('scripts/generated');root.mkdir(exist_ok=True)
for category in ['capitals','silhouettes','maps','borders','landmarks','world']:
 data=json.loads(Path(f'data/question-pool/{category}.json').read_text());blob=json.dumps(data,ensure_ascii=False,separators=(',',':'))
 assert '$question_data$' not in blob
 sql='''-- Stage new questions disabled. Existing IDs and content are never overwritten.
insert into game.questions(id,category,difficulty,prompt,options,correct,explanation,media,provenance,enabled)
select id,category,difficulty,prompt,options,correct,explanation,nullif(media,'null'::jsonb),provenance,false
from jsonb_to_recordset($question_data$'''+blob+'''$question_data$::jsonb) as x(id text,category text,difficulty int,prompt text,options jsonb,correct int,explanation text,media jsonb,provenance jsonb)
on conflict(id) do nothing;
'''
 (root/f'question_pool_v3_seed_{category}.sql').write_text(sql)
 existing=list(Path('supabase/migrations').glob(f'*_question_pool_v3_seed_{category}.sql'))
 if existing:existing[0].write_text(sql)
# Exact lists protect any unrelated questions and flag activation state.
new=[q for cat in ['capitals','silhouettes','maps','borders','landmarks','world'] for q in json.loads(Path(f'data/question-pool/{cat}.json').read_text())]
old=[q['id'] for q in json.loads(Path('data/questions.json').read_text()) if q['category']!='flags']
ids=lambda xs:','.join("'"+x.replace("'","''")+"'" for x in xs)
(root/'question_pool_v3_activate.sql').write_text('''-- Apply ONLY after the compatible PWA and atlas media are deployed and verified.
do $guard$ begin
 if (select count(*) from game.questions where id in ('''+ids([q['id'] for q in new])+'''))<>1218 then raise exception 'Incomplete v3 pool';end if;
 if exists(select 1 from game.questions where id like 'geo-v3-%' and (jsonb_array_length(options)<>4 or correct not between 0 and 3 or subject_key is null or explanation='')) then raise exception 'Invalid v3 question';end if;
end $guard$;
update game.questions set enabled=true where id in ('''+ids([q['id'] for q in new])+''');
update game.questions set enabled=false where id in ('''+ids(old)+''');
''')
print('Generated six disabled seeds and guarded activation for 1218 questions; 180 legacy questions retained')
