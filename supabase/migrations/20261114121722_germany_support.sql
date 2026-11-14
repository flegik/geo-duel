-- Install compatible schema and selection prior to publishing. Seed rows stay disabled.
alter table game.questions drop constraint if exists questions_category_check;
alter table game.questions add constraint questions_category_check
 check(category in ('flags','maps','capitals','silhouettes','borders','landmarks','world','germany'));
alter table game.participants drop constraint participants_question_format_check;
alter table game.participants add constraint participants_question_format_check check(question_format in (1,2,3));

create index if not exists germany_enabled_questions_idx on game.questions(id)
 where enabled and category='germany';

create function game.germany_city(provenance jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select coalesce(provenance#>>'{germany,city}',provenance#>>'{germany,cityName}',
  case when provenance->>'subjectKey' like 'de-city:%' then substr(provenance->>'subjectKey',9) end)
$$;

create function game.pick_germany_question(level integer,current_room uuid,excluded text[]) returns text
language sql volatile security invoker set search_path='' as $$
 with round as materialized (
  select m.position,q.subject_key,q.provenance->>'topic' as topic,q.provenance#>>'{germany,state}' as state,
   game.germany_city(q.provenance) as city
  from game.match_questions m join game.questions q on q.id=m.question_id
  where m.room_id=current_room and q.category='germany'
 ), recent_rooms as materialized (
  select distinct old.room_id from game.participants member join game.participants old using(profile_id)
  join game.rooms r on r.id=old.room_id
  where member.room_id=current_room and old.room_id<>current_room and r.status in ('playing','completed')
 ), history as materialized (
  select q.subject_key,game.germany_city(q.provenance) as city,r.created_at,m.position,
   row_number() over (order by r.created_at desc,m.position desc) as age
  from recent_rooms rr join game.rooms r on r.id=rr.room_id
  join game.match_questions m on m.room_id=rr.room_id join game.questions q on q.id=m.question_id
  where q.category='germany'
 ), topic_counts as (select topic,count(*) as n from round group by topic),
 state_counts as (select state,count(*) as n from round group by state),
 last as (select topic,state from round order by position desc limit 1),
 ages as (select subject_key,min(age) as age from history group by subject_key),
 cities as (select city,min(age) as age from history where city is not null group by city)
 select q.id from game.questions q
 left join topic_counts t on t.topic=q.provenance->>'topic'
 left join state_counts s on s.state=q.provenance#>>'{germany,state}'
 left join last on true
 left join ages a on a.subject_key=q.subject_key
 left join cities c on c.city=game.germany_city(q.provenance)
 where q.enabled and q.category='germany' and not(q.id=any(excluded))
 and not exists(select 1 from round prior where prior.subject_key=q.subject_key or prior.city=game.germany_city(q.provenance))
 order by
  case when least(a.age,c.age)<=48 then 1000 else 0 end
  + case when last.topic=q.provenance->>'topic' then 200 else 0 end
  + 28*coalesce(t.n,0)
  + case when last.state=q.provenance#>>'{germany,state}' then 12 else 0 end
  + 8*coalesce(s.n,0)
  + case when q.difficulty=level then 0 else 9 end
  + case when least(a.age,c.age) is null then 0 else 2+6.0/least(a.age,c.age) end
  + random()
 limit 1
$$;

revoke all on function game.germany_city(jsonb),game.pick_germany_question(integer,uuid,text[]) from public,anon,authenticated;

do $migration$
declare
 rpc text:=replace(pg_get_functiondef('public.geoduel(text,jsonb)'::regprocedure),chr(13),'');
 normalization text:=pg_get_functiondef('game.normalize_duel_counts(jsonb)'::regprocedure);
 known text:=$m$'flags','maps','capitals','silhouettes','borders','landmarks','world'$m$;
 participants text:='insert into game.participants(room_id,profile_id) values(r,u);';
 old_format text:=$m$case when payload->>'questionFormat'='2' then 2 else 1 end$m$;
 new_format text:=$m$case payload->>'questionFormat' when '3' then 3 when '2' then 2 else 1 end$m$;
 old_picker text:='chosen:=game.pick_balanced_question(c,d,r,unsupported_questions);';
 old_random text:='select distinct category from game.questions where enabled';
 old_update text:='update game.rooms set question_counts=counts,selected_categories=cats,per_category=n,';
 old_ready text:=$m$ elsif action='ready' then$m$;
 old_create text:=$m$   for i in 1..100 loop$m$;
 old_join text:='   r:=ro.id;';
begin
 if strpos(rpc,known)=0 or strpos(normalization,known)=0 or strpos(rpc,participants)=0 or
    strpos(rpc,old_format)=0 or strpos(rpc,old_picker)=0 or strpos(rpc,old_random)=0 or
    strpos(rpc,old_update)=0 or strpos(rpc,old_ready)=0 or strpos(rpc,old_create)=0 or strpos(rpc,old_join)=0 then
  raise exception 'Unexpected deployed GeoDuel functions';
 end if;
 execute replace(normalization,known,known||$m$,'germany'$m$);
 rpc:=replace(rpc,known,known||$m$,'germany'$m$);
 rpc:=replace(rpc,participants,'insert into game.participants(room_id,profile_id,question_format) values(r,u,'||new_format||');');
 rpc:=replace(rpc,old_format,new_format);
 rpc:=replace(rpc,old_picker,
  'if c=''germany'' then chosen:=game.pick_germany_question(d,r,unsupported_questions); else '||old_picker||' end if;');
 rpc:=replace(rpc,old_random,old_random||$m$
    and (category<>'germany' or not exists(select 1 from game.participants p where p.room_id=r and p.question_format<3))$m$);
 rpc:=replace(rpc,old_create,$m$
   if 'germany'=any(cats) and coalesce(payload->>'questionFormat','')<>'3' then
    raise exception 'Aktualisiere GeoDuel, um Deutschland zu spielen.';
   end if;
$m$||old_create);
 rpc:=replace(rpc,old_join,$m$
   if 'germany'=any(ro.selected_categories) and coalesce(payload->>'questionFormat','')<>'3' then
    raise exception 'Aktualisiere GeoDuel, um diesem Deutschland-Duell beizutreten.';
   end if;
$m$||old_join);
 rpc:=replace(rpc,old_update,$m$
  if 'germany'=any(cats) and exists(select 1 from game.participants p where p.room_id=r and p.question_format<3) then
   raise exception 'Für Deutschland benötigen beide Spieler die aktuelle GeoDuel-Version. Öffnet das Duell danach erneut.';
  end if;
$m$||old_update);
 rpc:=replace(rpc,old_ready,old_ready||$m$
  if 'germany'=any(ro.selected_categories) and coalesce(payload->>'questionFormat','')<>'3' then
   raise exception 'Aktualisiere GeoDuel, um Deutschland zu spielen.';
  end if;
$m$);
 execute rpc;
end
$migration$;
