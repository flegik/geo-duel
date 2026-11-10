create or replace function game.selection_policy() returns jsonb language sql immutable security invoker set search_path='' as $config$ select $policy${"version":"population-balance-2026-11","continentWeights":{"Europa":34,"Asien":28,"Nordamerika":10,"Südamerika":9,"Ozeanien":4,"Afrika":15},"africaFocusShare":0.85,"africaFocusCountries":["EG","ZA","NG","MA","DZ","TN","KE","ET","TZ","GH","SN","CD","CM","UG","ZW"],"preferredCountryWeight":2,"preferredCountries":["DE","FR","GB","IT","ES","PL","NL","BE","CH","AT","SE","NO","DK","FI","IE","PT","GR","CZ","SI","SK","HR","RS","RO","BG","HU","UA","RU","TR","CN","IN","JP","KR","ID","PK","BD","VN","TH","MY","PH","SG","SA","IR","IL","AE","US","CA","MX","BR","AR","CL","CO","PE","CU","AU","NZ","PG","FJ"],"worldTopicWeights":{"population":40,"general":12,"nature":18,"area":12,"landlocked":9,"continents":9},"continentOverrides":{"CY":"Asien"},"subregionContinents":{"Southern Europe":"Europa","Southeast Europe":"Europa","Central Europe":"Europa","Western Europe":"Europa","Eastern Europe":"Europa","Northern Europe":"Europa","Western Asia":"Asien","Southern Asia":"Asien","South-Eastern Asia":"Asien","Eastern Asia":"Asien","Central Asia":"Asien","Northern Africa":"Afrika","Western Africa":"Afrika","Middle Africa":"Afrika","Eastern Africa":"Afrika","Southern Africa":"Afrika","North America":"Nordamerika","Central America":"Nordamerika","Caribbean":"Nordamerika","South America":"Südamerika","Australia and New Zealand":"Ozeanien","Melanesia":"Ozeanien","Micronesia":"Ozeanien","Polynesia":"Ozeanien"},"populationKindWeights":{"country":50,"city":50},"countryContinents":{"AD":"Europa","AE":"Asien","AF":"Asien","AG":"Nordamerika","AL":"Europa","AM":"Asien","AO":"Afrika","AR":"Südamerika","AT":"Europa","AU":"Ozeanien","AZ":"Asien","BA":"Europa","BB":"Nordamerika","BD":"Asien","BE":"Europa","BF":"Afrika","BG":"Europa","BH":"Asien","BI":"Afrika","BJ":"Afrika","BN":"Asien","BO":"Südamerika","BR":"Südamerika","BS":"Nordamerika","BT":"Asien","BW":"Afrika","BY":"Europa","BZ":"Nordamerika","CA":"Nordamerika","CD":"Afrika","CF":"Afrika","CG":"Afrika","CH":"Europa","CI":"Afrika","CL":"Südamerika","CM":"Afrika","CN":"Asien","CO":"Südamerika","CR":"Nordamerika","CU":"Nordamerika","CV":"Afrika","CY":"Asien","CZ":"Europa","DE":"Europa","DJ":"Afrika","DK":"Europa","DM":"Nordamerika","DO":"Nordamerika","DZ":"Afrika","EC":"Südamerika","EE":"Europa","EG":"Afrika","ER":"Afrika","ES":"Europa","ET":"Afrika","FI":"Europa","FJ":"Ozeanien","FM":"Ozeanien","FR":"Europa","GA":"Afrika","GB":"Europa","GD":"Nordamerika","GE":"Asien","GH":"Afrika","GM":"Afrika","GN":"Afrika","GQ":"Afrika","GR":"Europa","GT":"Nordamerika","GW":"Afrika","GY":"Südamerika","HN":"Nordamerika","HR":"Europa","HT":"Nordamerika","HU":"Europa","ID":"Asien","IE":"Europa","IL":"Asien","IN":"Asien","IQ":"Asien","IR":"Asien","IS":"Europa","IT":"Europa","JM":"Nordamerika","JO":"Asien","JP":"Asien","KE":"Afrika","KG":"Asien","KH":"Asien","KI":"Ozeanien","KM":"Afrika","KN":"Nordamerika","KP":"Asien","KR":"Asien","KW":"Asien","KZ":"Asien","LA":"Asien","LB":"Asien","LC":"Nordamerika","LI":"Europa","LK":"Asien","LR":"Afrika","LS":"Afrika","LT":"Europa","LU":"Europa","LV":"Europa","LY":"Afrika","MA":"Afrika","MC":"Europa","MD":"Europa","ME":"Europa","MG":"Afrika","MH":"Ozeanien","MK":"Europa","ML":"Afrika","MM":"Asien","MN":"Asien","MR":"Afrika","MT":"Europa","MU":"Afrika","MV":"Asien","MW":"Afrika","MX":"Nordamerika","MY":"Asien","MZ":"Afrika","NA":"Afrika","NE":"Afrika","NG":"Afrika","NI":"Nordamerika","NL":"Europa","NO":"Europa","NP":"Asien","NR":"Ozeanien","NZ":"Ozeanien","OM":"Asien","PA":"Nordamerika","PE":"Südamerika","PG":"Ozeanien","PH":"Asien","PK":"Asien","PL":"Europa","PS":"Asien","PT":"Europa","PW":"Ozeanien","PY":"Südamerika","QA":"Asien","RO":"Europa","RS":"Europa","RU":"Europa","RW":"Afrika","SA":"Asien","SB":"Ozeanien","SC":"Afrika","SD":"Afrika","SE":"Europa","SG":"Asien","SI":"Europa","SK":"Europa","SL":"Afrika","SM":"Europa","SN":"Afrika","SO":"Afrika","SR":"Südamerika","SS":"Afrika","ST":"Afrika","SV":"Nordamerika","SY":"Asien","SZ":"Afrika","TD":"Afrika","TG":"Afrika","TH":"Asien","TJ":"Asien","TL":"Asien","TM":"Asien","TN":"Afrika","TO":"Ozeanien","TR":"Asien","TT":"Nordamerika","TV":"Ozeanien","TZ":"Afrika","UA":"Europa","UG":"Afrika","US":"Nordamerika","UY":"Südamerika","UZ":"Asien","VA":"Europa","VC":"Nordamerika","VE":"Südamerika","VN":"Asien","VU":"Ozeanien","WS":"Ozeanien","YE":"Asien","ZA":"Afrika","ZM":"Afrika","ZW":"Afrika"}}$policy$::jsonb $config$;
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
