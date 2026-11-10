"""Generate the reviewed additive room compatibility migration from captured live function definitions."""
from pathlib import Path
p=next(Path('supabase/migrations').glob('*_question_pool_v3_support.sql'))
s=Path('scripts/current-game-functions.sql').read_text()
s=s.replace("  update game.rooms set per_category=(payload->>'perCategory')::int where id=r;", """  if payload ? 'categories' then
   if jsonb_typeof(payload->'categories')<>'array' then raise exception 'Ungültige Kategorien.';end if;
   select array_agg(distinct x) into cats from jsonb_array_elements_text(payload->'categories') as input(x);
   if cardinality(cats) not between 1 and 7 or cats is null or exists(select 1 from unnest(cats) x where x is null or x not in ('flags','maps','capitals','silhouettes','borders','landmarks','world')) then raise exception 'Wähle mindestens eine gültige Kategorie.';end if;
   update game.rooms set selected_categories=cats where id=r;
  elsif coalesce((payload->>'randomCategories')::boolean,false) then
   update game.rooms set selected_categories=null where id=r;
  end if;
  update game.rooms set per_category=coalesce((payload->>'perCategory')::int,per_category) where id=r;""")
s=s.replace("  select array_agg(category) into cats from(select distinct category from game.questions)c;\n  select array_agg(category) into cats from(select unnest(cats) category order by random() limit 4)c;\n  if cardinality(cats)<>4 then raise exception 'Der Fragenpool ist noch nicht vollständig eingerichtet.';end if;", """  cats:=ro.selected_categories;
  if cats is null then
   select array_agg(category) into cats from(select distinct category from game.questions where enabled)c;
   select array_agg(category) into cats from(select unnest(cats) category order by random() limit 4)c;
   if cardinality(cats)<>4 then raise exception 'Der Fragenpool ist noch nicht vollständig eingerichtet.';end if;
  end if;""")
s=s.replace("ro.per_category*4","ro.per_category*coalesce(nullif(cardinality(ro.categories),0),cardinality(ro.selected_categories),4)")
s=s.replace('limit 5)recent',' )recent').replace('within their last 5 rounds','throughout their recorded rounds')
s=s.replace("'perCategory',ro.per_category,", "'perCategory',ro.per_category,'selectedCategories',ro.selected_categories,")
s=s.replace("insert into game.rooms(code,host,per_category,previous_id) values(lpad(floor(random()*10000)::int::text,4,'0'),ro.host,ro.per_category,r)", "insert into game.rooms(code,host,per_category,previous_id,selected_categories) values(lpad(floor(random()*10000)::int::text,4,'0'),ro.host,ro.per_category,r,ro.selected_categories)")
assert 'selected_categories=cats' in s and 'cats:=ro.selected_categories' in s
p.write_text('''-- Additive only: existing rooms keep their category list, selected questions and option order.
-- NULL selection preserves the existing four-random-category behavior for older clients.
alter table game.rooms add column if not exists selected_categories text[];
'''+s)
print(p)
