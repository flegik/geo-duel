-- Legacy rooms retain their original columns and effective lengths.
alter table game.rooms
 add column question_counts jsonb check (jsonb_typeof(question_counts)='object'),
 add column played_counts jsonb check (jsonb_typeof(played_counts)='object'),
 add column config_revision integer not null default 0;

create function game.duel_counts_total(counts jsonb) returns integer
language sql immutable security invoker set search_path='' as $$
 select coalesce(sum(value::integer),0)::integer from jsonb_each_text(counts)
$$;

create function game.normalize_duel_counts(counts jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare normalized jsonb;
begin
 if jsonb_typeof(counts) is distinct from 'object' then
  raise exception 'Wähle die Fragenanzahl für gültige Kategorien.';
 end if;
 if exists(select 1 from jsonb_each(counts) where
  key not in ('flags','maps','capitals','silhouettes','borders','landmarks','world')
  or jsonb_typeof(value)<>'number' or value::text !~ '^(0|[1-9]|1[0-9]|2[0-4])$') then
  raise exception 'Pro Kategorie sind nur ganze Zahlen von 0 bis 24 erlaubt.';
 end if;
 if game.duel_counts_total(counts)>24 then raise exception 'Ein Duell darf höchstens 24 Fragen haben.'; end if;
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into normalized
 from jsonb_each(counts) where value<>'0'::jsonb;
 return normalized;
end
$$;

create function game.room_question_total(room game.rooms) returns integer
language sql stable security invoker set search_path='' as $$
 select case when coalesce(room.played_counts,room.question_counts) is not null
  then game.duel_counts_total(coalesce(room.played_counts,room.question_counts))
  else room.per_category*coalesce(nullif(cardinality(room.categories),0),cardinality(room.selected_categories),4) end
$$;

create function game.pick_duel_flag(level integer, current_room uuid, excluded text[]) returns text
language sql volatile security invoker set search_path='' as $$
 with prior_rooms as (
  select distinct pp.room_id from game.participants member
  join game.participants pp on pp.profile_id=member.profile_id
  join game.rooms r on r.id=pp.room_id
  where member.room_id=current_room and pp.room_id<>current_room and r.status in ('playing','completed')
 ), history as (
  select q.subject_key,count(*) as appearances
  from prior_rooms r join game.match_questions m on m.room_id=r.room_id
  join game.questions q on q.id=m.question_id
  where q.category='flags'
  group by q.subject_key
 )
 select q.id from game.questions q left join history h using(subject_key)
 where q.enabled and q.category='flags' and not(q.id=any(excluded))
 and not exists(select 1 from game.match_questions m join game.questions prior on prior.id=m.question_id
  where m.room_id=current_room and prior.subject_key=q.subject_key)
 order by q.difficulty<>level,coalesce(h.appearances,0),random()
 limit 1
$$;

revoke all on function game.duel_counts_total(jsonb),game.normalize_duel_counts(jsonb),
 game.room_question_total(game.rooms),game.pick_duel_flag(integer,uuid,text[]) from public,anon,authenticated;

-- Patch the three deployed functions without changing authorization, answers, or review.
do $migration$
declare
 rpc text:=pg_get_functiondef('public.geoduel(text,jsonb)'::regprocedure);
 snapshot text:=pg_get_functiondef('game.snapshot(uuid,uuid)'::regprocedure);
 result text:=pg_get_functiondef('game.result(uuid)'::regprocedure);
 old_total text:='ro.per_category*coalesce(nullif(cardinality(ro.categories),0),cardinality(ro.selected_categories),4)';
 new_total text:='game.room_question_total(ro)';
 configure_start text:=$marker$ if action='configure' then$marker$;
 ready_start text:=$marker$ elsif action='ready' then$marker$;
 picker_start text:='  foreach c in array cats loop';
 picker_end text:=$marker$ elsif action='answer' then$marker$;
 old_rematch text:=$marker$insert into game.rooms(code,host,per_category,previous_id,selected_categories) values(lpad(floor(random()*10000)::int::text,4,'0'),ro.host,ro.per_category,r,ro.selected_categories)$marker$;
 old_ready text:=$marker$  update game.participants set ready=coalesce((payload->>'ready')::boolean,false), question_format=$marker$;
 old_start_ready text:=$marker$  if ro.status<>'waiting' or (select count(*) from game.participants where room_id=r and ready)<>2 then$marker$;
 old_declare text:='cat_index int:=0; short_offset int:=floor(random()*3)::int;';
 old_create text:='insert into game.rooms(code,host,per_category) values(code_value,u,n)';
begin
 if strpos(rpc,configure_start)=0 or strpos(rpc,ready_start)<=strpos(rpc,configure_start)
  or strpos(rpc,picker_start)=0 or strpos(rpc,picker_end)<=strpos(rpc,picker_start)
  or strpos(rpc,old_declare)=0 or strpos(rpc,old_rematch)=0 or strpos(rpc,old_ready)=0
  or strpos(rpc,old_start_ready)=0 or strpos(rpc,old_create)=0
  or strpos(rpc,old_total)=0 or strpos(snapshot,old_total)=0 or strpos(result,old_total)=0 then
  raise exception 'Unexpected deployed GeoDuel functions';
 end if;

 rpc:=replace(rpc,old_declare,'difficulty_offset int:=floor(random()*3)::int; counts jsonb;');
 rpc:=replace(rpc,old_create,$create$insert into game.rooms(code,host,per_category,question_counts,selected_categories)
     values(code_value,u,n,counts,cats)$create$);
 rpc:=replace(rpc,'   for i in 1..100 loop',$create$   if payload ? 'questionCounts' then
    counts:=game.normalize_duel_counts(payload->'questionCounts');
    select coalesce(array_agg(key order by key),'{}') into cats from jsonb_object_keys(counts) as keys(key);
   end if;
   for i in 1..100 loop$create$);
 rpc:=left(rpc,strpos(rpc,configure_start)-1)||$configure$ if action='configure' then
  if ro.status<>'waiting' or ro.host<>u then raise exception 'Nur der Host kann die Lobby konfigurieren.';end if;
  if payload ? 'configRevision' and (payload->>'configRevision')::int is distinct from ro.config_revision then
   raise exception 'Die Lobby wurde bereits geändert. Prüfe die aktuelle Auswahl und versuche es erneut.';
  end if;
  n:=ro.per_category;
  cats:=ro.selected_categories;
  counts:=ro.question_counts;
  if payload ? 'questionCounts' then
   if payload ?| array['categories','randomCategories','perCategory'] then raise exception 'Wähle einen Duellmodus.';end if;
   counts:=game.normalize_duel_counts(payload->'questionCounts');
   select coalesce(array_agg(key order by key),'{}') into cats from jsonb_object_keys(counts) as keys(key);
  else
   n:=coalesce((payload->>'perCategory')::int,n);
   if n not in(2,3,4) then raise exception 'Zufallsduelle haben 8, 12 oder 16 Fragen.';end if;
   if payload ? 'categories' then
    if jsonb_typeof(payload->'categories')<>'array' then raise exception 'Ungültige Kategorien.';end if;
    select array_agg(distinct x order by x) into cats from jsonb_array_elements_text(payload->'categories') as input(x);
    if cats is null or exists(select 1 from unnest(cats) x where x is null or x not in
     ('flags','maps','capitals','silhouettes','borders','landmarks','world')) then
     raise exception 'Wähle mindestens eine gültige Kategorie.';
    end if;
    counts:=null;
   elsif coalesce((payload->>'randomCategories')::boolean,false) then
    cats:=null; counts:=null;
   end if;
   if counts is null and n*coalesce(cardinality(cats),4)>24 then raise exception 'Ein Duell darf höchstens 24 Fragen haben.';end if;
  end if;
  if (counts,cats,n) is not distinct from (ro.question_counts,ro.selected_categories,ro.per_category) then
   return game.snapshot(r,u);
  end if;
  update game.rooms set question_counts=counts,selected_categories=cats,per_category=n,
   config_revision=config_revision+1 where id=r;
  update game.participants set ready=false where room_id=r;
$configure$||substr(rpc,strpos(rpc,ready_start));

 rpc:=replace(rpc,old_ready,$ready$  if coalesce((payload->>'ready')::boolean,false) then
   if payload ? 'configRevision' and (payload->>'configRevision')::int is distinct from ro.config_revision then
    raise exception 'Die Konfiguration hat sich geändert. Bestätige die neue Auswahl.';
   end if;
   if ro.question_counts is not null and game.room_question_total(ro)<4 then
    raise exception 'Wähle mindestens 4 Fragen für dein eigenes Duell.';
   end if;
  end if;
  update game.participants set ready=coalesce((payload->>'ready')::boolean,false), question_format=$ready$);
 rpc:=replace(rpc,old_start_ready,$start$  if ro.question_counts is not null and game.room_question_total(ro)<4 then
   raise exception 'Wähle mindestens 4 Fragen für dein eigenes Duell.';
  end if;
  if game.room_question_total(ro)>24 then raise exception 'Reduziere das Duell auf höchstens 24 Fragen.';end if;
$start$||old_start_ready);

 rpc:=left(rpc,strpos(rpc,picker_start)-1)||$pick$  counts:=ro.question_counts;
  if counts is null then
   select jsonb_object_agg(cat,ro.per_category) into counts from unnest(cats) as plan(cat);
  end if;
  foreach c in array cats loop
   for i in 1..(counts->>c)::int loop
    d:=1+mod(pos+difficulty_offset,3);
    if c='flags' then
     chosen:=game.pick_duel_flag(d,r,unsupported_questions);
    else
     chosen:=game.pick_balanced_question(c,d,r,unsupported_questions);
    end if;
    if chosen is null then
     raise exception 'Für diese Mischung gibt es nicht genügend unterschiedliche Fragen. Wähle weniger Fragen in einer Kategorie.';
    end if;
    insert into game.match_questions(room_id,position,question_id,option_order)
    values(r,pos,chosen,(select array_agg(choice.option_index order by random()) from generate_series(0,3) as choice(option_index)));
    pos:=pos+1;
   end loop;
  end loop;
  if pos<>game.duel_counts_total(counts) then raise exception 'Die gewählte Fragenverteilung konnte nicht vollständig erstellt werden.';end if;
  update game.rooms set status='playing',categories=cats,played_counts=counts where id=r;
$pick$||substr(rpc,strpos(rpc,picker_end));
 rpc:=replace(rpc,old_total,new_total);
 rpc:=replace(rpc,old_rematch,$rematch$insert into game.rooms(code,host,per_category,previous_id,selected_categories,question_counts)
    values(lpad(floor(random()*10000)::int::text,4,'0'),ro.host,ro.per_category,r,ro.selected_categories,ro.question_counts)$rematch$);
 execute rpc;

 snapshot:=replace(snapshot,'''total'','||old_total,
  '''total'','||new_total||',''questionCounts'',ro.question_counts,''playedCounts'',ro.played_counts,''configRevision'',ro.config_revision,''revision'',(select e.version from public.duel_events e where e.room_id=r)');
 execute snapshot;
 result:=replace(result,'''total'','||old_total,'''total'','||new_total);
 execute result;
end
$migration$;
