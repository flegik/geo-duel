-- A room receives new formats only after both participants advertise support.
alter table game.participants add column if not exists question_format smallint not null default 1
 check(question_format in (1,2));

do $patch$
declare
 definition text:=pg_get_functiondef('public.geoduel(text,jsonb)'::regprocedure);
 old text[]:=array[
  'short_offset int:=floor(random()*3)::int;',
  'update game.participants set ready=coalesce((payload->>''ready'')::boolean,false) where room_id=r and profile_id=u;',
  'cats:=ro.selected_categories;',
  'where qb.enabled and qb.category=c and qb.difficulty=d and not exists',
  'chosen:=game.pick_balanced_question(c,d,r);'
 ];
 next text[]:=array[
  'short_offset int:=floor(random()*3)::int; unsupported_questions text[]:=''{}'';',
  'update game.participants set ready=coalesce((payload->>''ready'')::boolean,false), question_format=case when payload->>''questionFormat''=''2'' then 2 else 1 end where room_id=r and profile_id=u;',
  $start$if exists(select 1 from game.participants p where p.room_id=r and p.question_format<2) then
   select coalesce(array_agg(qb.id),'{}'::text[]) into unsupported_questions
   from game.questions qb where qb.enabled and qb.id ~ '^(flag-image|city-map|landmark-city|world-compare)-v1-';
  end if;
  cats:=ro.selected_categories;$start$,
  'where qb.enabled and qb.category=c and qb.difficulty=d and not(qb.id=any(unsupported_questions)) and not exists',
  'chosen:=game.pick_balanced_question(c,d,r,unsupported_questions);'
 ];
 i int;
begin
 for i in 1..cardinality(old) loop
  if (length(definition)-length(replace(definition,old[i],'')))/length(old[i])<>1 then
   raise exception 'Unexpected GeoDuel RPC definition at patch %',i;
  end if;
  definition:=replace(definition,old[i],next[i]);
 end loop;
 execute definition;
end
$patch$;

-- Question and answer order remain based on the one persisted permutation.
-- Before answering an inverse flag question, return opaque asset paths instead of country names.
do $patch$
declare
 definition text:=pg_get_functiondef('game.snapshot(uuid,uuid)'::regprocedure);
 old text:='game.ordered_options(q.options,ord)';
 next text:=$value$game.ordered_options(case
  when a.profile_id is null and q.media->>'type'='flag-options' then q.provenance->'optionImages'
  else q.options end,ord)$value$;
begin
 if (length(definition)-length(replace(definition,old,'')))/length(old)<>1 then
  raise exception 'Unexpected GeoDuel snapshot definition';
 end if;
 execute replace(definition,old,next);
end
$patch$;

create or replace function game.selection_topic(provenance jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select case when provenance ? 'comparison' then 'comparisons'
 when provenance ? 'population' then 'population' else case provenance->>'topic'
 when 'Naturregionen' then 'nature' when 'Länderflächen' then 'area'
 when 'Binnenstaaten' then 'landlocked' when 'Kontinente' then 'continents'
 else 'general' end end
$$;
revoke all on function game.selection_topic(jsonb) from public,anon,authenticated;
