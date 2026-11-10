-- Private helpers only. No new SECURITY DEFINER or public API endpoint.
create or replace function game.selection_continent(iso text) returns text
language sql immutable security invoker set search_path='' as $$
 select game.selection_policy()->'countryContinents'->>iso
$$;
create or replace function game.selection_topic(provenance jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select case when provenance ? 'population' then 'population' else case provenance->>'topic'
 when 'Naturregionen' then 'nature' when 'Länderflächen' then 'area' when 'Binnenstaaten' then 'landlocked' when 'Kontinente' then 'continents' else 'general' end end
$$;
create or replace function game.selection_weighted(weights jsonb) returns text
language plpgsql volatile security invoker set search_path='' as $$
declare total numeric; roll double precision; pair record; last_key text;
begin
 select sum(value::numeric) into total from jsonb_each_text(weights);
 if total is null or total<=0 then raise exception 'Empty selection weights';end if;
 roll:=random()*total;
 for pair in select key,value::numeric as weight from jsonb_each_text(weights) order by key loop
  last_key:=pair.key;roll:=roll-pair.weight;if roll<0 then return pair.key;end if;
 end loop;
 return last_key;
end $$;
create or replace function game.pick_balanced_question(p_category text,p_difficulty integer,p_room uuid default null,p_excluded text[] default '{}') returns text
language plpgsql volatile security invoker set search_path='' as $$
declare cfg jsonb:=game.selection_policy(); pool jsonb; filtered jsonb; focus jsonb; other jsonb; weights jsonb; region text; topic text; kind text; subject text; continent text; part record; has_africa boolean; other_weight numeric; oldest numeric; chosen text;
begin
 if p_category='flags' then raise exception 'Flag selection uses the unchanged native path';end if;
 with recent as (
  select prior.subject_key,max(extract(epoch from rr.created_at)) seen
  from game.match_questions mq join game.questions prior on prior.id=mq.question_id join game.rooms rr on rr.id=mq.room_id
  where p_room is not null and rr.id<>p_room and rr.status in ('playing','completed') and exists(
   select 1 from game.participants pp where pp.room_id=rr.id and pp.profile_id in(select member.profile_id from game.participants member where member.room_id=p_room)
  ) group by prior.subject_key
 )
 select jsonb_agg(jsonb_build_object('id',q.id,'subject',q.subject_key,'iso',q.provenance->>'iso','difficulty',q.difficulty,'topic',game.selection_topic(q.provenance),'kind',q.provenance->'population'->>'kind','seen',recent.seen)) into pool
 from game.questions q left join recent on recent.subject_key=q.subject_key
 where q.enabled and q.category=p_category and not(q.id=any(p_excluded)) and not exists(
  select 1 from game.match_questions mq0 join game.questions existing on existing.id=mq0.question_id where mq0.room_id=p_room and existing.subject_key=q.subject_key
 );
 if pool is null then return null;end if;
 if p_category='world' then
  select jsonb_object_agg(t,cfg->'worldTopicWeights'->t) into weights from(select distinct value->>'topic' t from jsonb_array_elements(pool)) topics;
  topic:=game.selection_weighted(weights);
  select jsonb_agg(value) into pool from jsonb_array_elements(pool) where value->>'topic'=topic;
  if topic='population' then
   select jsonb_object_agg(k,cfg->'populationKindWeights'->k) into weights from(select distinct value->>'kind' k from jsonb_array_elements(pool)) kinds;
   kind:=game.selection_weighted(weights);
   select jsonb_agg(value) into pool from jsonb_array_elements(pool) where value->>'kind'=kind;
  end if;
 end if;
 -- Unclassified general geography stays in its own topic; it is not counted as a continent.
 if not exists(select 1 from jsonb_array_elements(pool) where game.selection_continent(value->>'iso') is null) then
  select bool_or(c='Afrika'),sum((cfg->'continentWeights'->>c)::numeric) filter(where c<>'Afrika') into has_africa,other_weight
  from(select distinct game.selection_continent(value->>'iso') c from jsonb_array_elements(pool)) regions;
  weights:='{}'::jsonb;
  for part in select distinct game.selection_continent(value->>'iso') c from jsonb_array_elements(pool) loop
   weights:=weights||jsonb_build_object(part.c,case when part.c='Afrika' then case when other_weight is null then 100 else (cfg->'continentWeights'->>'Afrika')::numeric end
   else (case when has_africa then 100-(cfg->'continentWeights'->>'Afrika')::numeric else 100 end)*(cfg->'continentWeights'->>part.c)::numeric/other_weight end);
  end loop;
  region:=game.selection_weighted(weights);
  select jsonb_agg(value) into pool from jsonb_array_elements(pool) where game.selection_continent(value->>'iso')=region;
 end if;
 select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where (value->>'difficulty')::int=p_difficulty;
 if filtered is not null then pool:=filtered;end if;
 if game.selection_continent(pool->0->>'iso')='Afrika' then
  select jsonb_agg(value) filter(where cfg->'africaFocusCountries' ? (value->>'iso')),jsonb_agg(value) filter(where not(cfg->'africaFocusCountries' ? (value->>'iso'))) into focus,other from jsonb_array_elements(pool);
  if focus is not null and other is not null then pool:=case when random()<(cfg->>'africaFocusShare')::double precision then focus else other end;end if;
 end if;
 select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where value->>'seen' is null;
 if filtered is not null then pool:=filtered;
 else
  select min((value->>'seen')::numeric) into oldest from jsonb_array_elements(pool);
  select jsonb_agg(value) into pool from jsonb_array_elements(pool) where (value->>'seen')::numeric=oldest;
 end if;
 select jsonb_object_agg(value->>'subject',case when cfg->'preferredCountries' ? (value->>'iso') then (cfg->>'preferredCountryWeight')::numeric else 1 end) into weights from jsonb_array_elements(pool);
 subject:=game.selection_weighted(weights);
 select value->>'id' into chosen from jsonb_array_elements(pool) where value->>'subject'=subject order by random() limit 1;
 return chosen;
end $$;
revoke all on function game.selection_policy() from public,anon,authenticated;
revoke all on function game.selection_continent(text) from public,anon,authenticated;
revoke all on function game.selection_topic(jsonb) from public,anon,authenticated;
revoke all on function game.selection_weighted(jsonb) from public,anon,authenticated;
revoke all on function game.pick_balanced_question(text,integer,uuid,text[]) from public,anon,authenticated;
