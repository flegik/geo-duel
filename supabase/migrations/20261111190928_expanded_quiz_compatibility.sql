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

create or replace function game.selection_policy() returns jsonb

language sql immutable security invoker set search_path='' as $config$
 select $policy${"version":"regional-rounds-2026-11","continentWeights":{"Europa":34,"Asien":28,"Nordamerika":10,"Südamerika":9,"Ozeanien":4,"Afrika":15},"africaFocusShare":0.85,"africaFocusCountries":["EG","ZA","NG","MA","DZ","TN","KE","ET","TZ","GH","SN","CD","CM","UG","ZW"],"preferredCountryWeight":2,"preferredCountries":["DE","FR","GB","IT","ES","PL","NL","BE","CH","AT","SE","NO","DK","FI","IE","PT","GR","CZ","SI","SK","HR","RS","RO","BG","HU","UA","RU","TR","CN","IN","JP","KR","ID","PK","BD","VN","TH","MY","PH","SG","SA","IR","IL","AE","US","CA","MX","BR","AR","CL","CO","PE","CU","AU","NZ","PG","FJ"],"worldTopicWeights":{"population":40,"general":12,"nature":18,"area":12,"landlocked":9,"continents":9,"comparisons":20},"continentOverrides":{"CY":"Asien"},"subregionContinents":{"Southern Europe":"Europa","Southeast Europe":"Europa","Central Europe":"Europa","Western Europe":"Europa","Eastern Europe":"Europa","Northern Europe":"Europa","Western Asia":"Asien","Southern Asia":"Asien","South-Eastern Asia":"Asien","Eastern Asia":"Asien","Central Asia":"Asien","Northern Africa":"Afrika","Western Africa":"Afrika","Middle Africa":"Afrika","Eastern Africa":"Afrika","Southern Africa":"Afrika","North America":"Nordamerika","Central America":"Nordamerika","Caribbean":"Nordamerika","South America":"Südamerika","Australia and New Zealand":"Ozeanien","Melanesia":"Ozeanien","Micronesia":"Ozeanien","Polynesia":"Ozeanien"},"populationKindWeights":{"country":50,"city":50},"regionalAfricaTargets":{"borders":5,"capitals":8,"silhouettes":10,"maps":10,"landmarks":10},"regionalContinentWeights":{"Europa":28,"Asien":26,"Nordamerika":16,"Südamerika":14,"Ozeanien":11},"regionalAfricaFocusShare":0.9,"regionalAfricaFocusCountries":["EG","ZA","NG","MA","DZ","TN","KE","ET","TZ","GH"],"recentQuestionWindow":16,"regionalContinentOverrides":{"borders":{"Ozeanien":4}},"countryContinents":{"AD":"Europa","AE":"Asien","AF":"Asien","AG":"Nordamerika","AL":"Europa","AM":"Asien","AO":"Afrika","AR":"Südamerika","AT":"Europa","AU":"Ozeanien","AZ":"Asien","BA":"Europa","BB":"Nordamerika","BD":"Asien","BE":"Europa","BF":"Afrika","BG":"Europa","BH":"Asien","BI":"Afrika","BJ":"Afrika","BN":"Asien","BO":"Südamerika","BR":"Südamerika","BS":"Nordamerika","BT":"Asien","BW":"Afrika","BY":"Europa","BZ":"Nordamerika","CA":"Nordamerika","CD":"Afrika","CF":"Afrika","CG":"Afrika","CH":"Europa","CI":"Afrika","CL":"Südamerika","CM":"Afrika","CN":"Asien","CO":"Südamerika","CR":"Nordamerika","CU":"Nordamerika","CV":"Afrika","CY":"Asien","CZ":"Europa","DE":"Europa","DJ":"Afrika","DK":"Europa","DM":"Nordamerika","DO":"Nordamerika","DZ":"Afrika","EC":"Südamerika","EE":"Europa","EG":"Afrika","ER":"Afrika","ES":"Europa","ET":"Afrika","FI":"Europa","FJ":"Ozeanien","FM":"Ozeanien","FR":"Europa","GA":"Afrika","GB":"Europa","GD":"Nordamerika","GE":"Asien","GH":"Afrika","GM":"Afrika","GN":"Afrika","GQ":"Afrika","GR":"Europa","GT":"Nordamerika","GW":"Afrika","GY":"Südamerika","HN":"Nordamerika","HR":"Europa","HT":"Nordamerika","HU":"Europa","ID":"Asien","IE":"Europa","IL":"Asien","IN":"Asien","IQ":"Asien","IR":"Asien","IS":"Europa","IT":"Europa","JM":"Nordamerika","JO":"Asien","JP":"Asien","KE":"Afrika","KG":"Asien","KH":"Asien","KI":"Ozeanien","KM":"Afrika","KN":"Nordamerika","KP":"Asien","KR":"Asien","KW":"Asien","KZ":"Asien","LA":"Asien","LB":"Asien","LC":"Nordamerika","LI":"Europa","LK":"Asien","LR":"Afrika","LS":"Afrika","LT":"Europa","LU":"Europa","LV":"Europa","LY":"Afrika","MA":"Afrika","MC":"Europa","MD":"Europa","ME":"Europa","MG":"Afrika","MH":"Ozeanien","MK":"Europa","ML":"Afrika","MM":"Asien","MN":"Asien","MR":"Afrika","MT":"Europa","MU":"Afrika","MV":"Asien","MW":"Afrika","MX":"Nordamerika","MY":"Asien","MZ":"Afrika","NA":"Afrika","NE":"Afrika","NG":"Afrika","NI":"Nordamerika","NL":"Europa","NO":"Europa","NP":"Asien","NR":"Ozeanien","NZ":"Ozeanien","OM":"Asien","PA":"Nordamerika","PE":"Südamerika","PG":"Ozeanien","PH":"Asien","PK":"Asien","PL":"Europa","PS":"Asien","PT":"Europa","PW":"Ozeanien","PY":"Südamerika","QA":"Asien","RO":"Europa","RS":"Europa","RU":"Europa","RW":"Afrika","SA":"Asien","SB":"Ozeanien","SC":"Afrika","SD":"Afrika","SE":"Europa","SG":"Asien","SI":"Europa","SK":"Europa","SL":"Afrika","SM":"Europa","SN":"Afrika","SO":"Afrika","SR":"Südamerika","SS":"Afrika","ST":"Afrika","SV":"Nordamerika","SY":"Asien","SZ":"Afrika","TD":"Afrika","TG":"Afrika","TH":"Asien","TJ":"Asien","TL":"Asien","TM":"Asien","TN":"Afrika","TO":"Ozeanien","TR":"Asien","TT":"Nordamerika","TV":"Ozeanien","TZ":"Afrika","UA":"Europa","UG":"Afrika","US":"Nordamerika","UY":"Südamerika","UZ":"Asien","VA":"Europa","VC":"Nordamerika","VE":"Südamerika","VN":"Asien","VU":"Ozeanien","WS":"Ozeanien","YE":"Asien","ZA":"Afrika","ZM":"Afrika","ZW":"Afrika"}}$policy$::jsonb
$config$;
revoke all on function game.selection_policy() from public,anon,authenticated;
