-- Additive only: existing rooms keep their category list, selected questions and option order.
-- NULL selection preserves the existing four-random-category behavior for older clients.
alter table game.rooms add column if not exists selected_categories text[];
CREATE OR REPLACE FUNCTION public.geoduel(action text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); r uuid; ro game.rooms; pa game.participants; q game.questions; a game.answers; code_value text; n int; c text; d int; pos int:=0; chosen text; cats text[]; v jsonb; i int; old_r uuid; cat_index int:=0; short_offset int:=floor(random()*3)::int;
begin
 if u is null then return jsonb_build_object('error','Bitte melde dich erneut an.');end if;
 if action not in ('snapshot','profile','stats','review') and not game.throttle(u::text||':'||action,case when action='join' then 8 when action='create' then 5 else 90 end,60) then return jsonb_build_object('error','Zu viele Versuche. Bitte warte eine Minute.');end if;
 if action='join' and not game.throttle('global:join',120,60) then return jsonb_build_object('error','Gerade sind viele Beitritte aktiv. Bitte warte eine Minute.');end if;
 -- Keep throttle writes even when a validation error below is returned.
 begin
 if action in ('join','create') and current_setting('game.gateway_verified',true) is distinct from 'true' then raise exception 'Bitte verwende den geschützten Raumzugang.';end if;
 if action='profile' then
  if payload ? 'nickname' then
   insert into game.profiles(id,nickname) values(u,btrim(payload->>'nickname')) on conflict(id) do update set nickname=excluded.nickname;
  end if;
  return (select to_jsonb(p) from game.profiles p where id=u);
 end if;
 if not exists(select 1 from game.profiles where id=u) then raise exception 'Bitte lege zuerst dein Profil an.';end if;
 if action='stats' then return game.stats(u);end if;
 if action='active' then
  select p.room_id into r from game.participants p join game.rooms rr on rr.id=p.room_id where p.profile_id=u and (rr.status='playing' or rr.status='waiting' and rr.expires_at>now()) order by rr.created_at desc limit 1;
  return case when r is null then 'null'::jsonb else game.snapshot(r,u) end;
 end if;
 if action in ('create','join') then
  -- Serialize membership acquisition per profile, including separate tabs.
  perform pg_advisory_xact_lock(hashtext(u::text));
  update game.rooms set status='aborted' where status='waiting' and expires_at<now();
  select rr.id into old_r from game.rooms rr join game.participants pp on pp.room_id=rr.id where pp.profile_id=u and rr.status in ('waiting','playing') limit 1;
  if old_r is not null then
   if action='join' and (select code from game.rooms where id=old_r)<>payload->>'code' then raise exception 'Du hast bereits ein offenes Duell. Setze es fort oder verlasse es.';end if;
   return game.snapshot(old_r,u);
  end if;
  if action='create' then
   n:=coalesce((payload->>'perCategory')::int,3);
   if n not in(2,3,4) then raise exception 'Ungültige Fragenanzahl.';end if;
   for i in 1..100 loop
    code_value:=lpad(floor(random()*10000)::int::text,4,'0');
    begin
     insert into game.rooms(code,host,per_category) values(code_value,u,n) returning id into r;exit;
    exception when unique_violation then if i=100 then raise exception 'Alle Räume sind gerade belegt. Bitte versuche es später.';end if;
    end;
   end loop;
   insert into game.participants(room_id,profile_id) values(r,u);
   insert into public.duel_events(room_id) values(r);
  else
   if coalesce(payload->>'code','') !~ '^[0-9]{4}$' then raise exception 'Bitte gib einen vierstelligen Code ein.';end if;
   select * into ro from game.rooms where code=payload->>'code' and status='waiting' and expires_at>now() for update;
   if ro.id is null then raise exception 'Raum nicht gefunden oder bereits gestartet / abgelaufen.';end if;
   r:=ro.id;
   if (select count(*) from game.participants where room_id=r)>=2 then raise exception 'Dieser Raum ist bereits voll.';end if;
   insert into game.participants(room_id,profile_id) values(r,u);
   update public.duel_events set version=version+1 where room_id=r;
  end if;
  return game.snapshot(r,u);
 end if;
 r:=(payload->>'roomId')::uuid;
 select * into ro from game.rooms where id=r for update;
 select * into pa from game.participants where room_id=r and profile_id=u;
 if pa.profile_id is null then raise exception 'Du gehörst nicht zu diesem Duell.';end if;
 if ro.status='waiting' and ro.expires_at<now() then update game.rooms set status='aborted' where id=r;ro.status:='aborted';end if;
 if action='snapshot' then return game.snapshot(r,u);end if;
 if action='configure' then
  if ro.status<>'waiting' or ro.host<>u then raise exception 'Nur der Host kann die Lobby konfigurieren.';end if;
  if payload ? 'categories' then
   if jsonb_typeof(payload->'categories')<>'array' then raise exception 'Ungültige Kategorien.';end if;
   select array_agg(distinct x) into cats from jsonb_array_elements_text(payload->'categories') as input(x);
   if cardinality(cats) not between 1 and 7 or cats is null or exists(select 1 from unnest(cats) x where x is null or x not in ('flags','maps','capitals','silhouettes','borders','landmarks','world')) then raise exception 'Wähle mindestens eine gültige Kategorie.';end if;
   update game.rooms set selected_categories=cats where id=r;
  elsif coalesce((payload->>'randomCategories')::boolean,false) then
   update game.rooms set selected_categories=null where id=r;
  end if;
  update game.rooms set per_category=coalesce((payload->>'perCategory')::int,per_category) where id=r;
  update game.participants set ready=false where room_id=r;
 elsif action='ready' then
  if ro.status<>'waiting' then raise exception 'Dieses Duell hat bereits begonnen.';end if;
  update game.participants set ready=coalesce((payload->>'ready')::boolean,false) where room_id=r and profile_id=u;
 elsif action='start' then
  if ro.host<>u then raise exception 'Nur der Host kann das Duell starten.';end if;
  if ro.status='playing' then return game.snapshot(r,u);end if;
  if ro.status<>'waiting' or (select count(*) from game.participants where room_id=r and ready)<>2 then raise exception 'Beide Spieler müssen bereit sein.';end if;
  cats:=ro.selected_categories;
  if cats is null then
   select array_agg(category) into cats from(select distinct category from game.questions where enabled)c;
   select array_agg(category) into cats from(select unnest(cats) category order by random() limit 4)c;
   if cardinality(cats)<>4 then raise exception 'Der Fragenpool ist noch nicht vollständig eingerichtet.';end if;
  end if;
  foreach c in array cats loop
   cat_index:=cat_index+1;
   for i in 1..ro.per_category loop
    d:=case when ro.per_category=2 then 1+mod(cat_index+short_offset+i,3) when i<=3 then i else 2 end;
    -- Prefer questions not seen by either participant throughout their recorded rounds.
    select qb.id into chosen from game.questions qb where qb.enabled and qb.category=c and qb.difficulty=d and not exists(select 1 from game.match_questions mq0 join game.questions prior on prior.id=mq0.question_id where mq0.room_id=r and prior.subject_key=qb.subject_key)
    order by (select count(*) from game.match_questions mq join game.questions recent_question on recent_question.id=mq.question_id where recent_question.subject_key=qb.subject_key and mq.room_id in(select recent.id from (select distinct rr.id,rr.created_at from game.rooms rr join game.participants pp on pp.room_id=rr.id where rr.status in('playing','completed') and rr.id<>r and pp.profile_id in(select profile_id from game.participants where room_id=r) order by rr.created_at desc  )recent)),random() limit 1;
    if chosen is null then raise exception 'Für diese Kategorie fehlen Fragen.';end if;
    insert into game.match_questions(room_id,position,question_id,option_order) values(r,pos,chosen,(select array_agg(choice.option_index order by random()) from generate_series(0,3) as choice(option_index)));pos:=pos+1;
   end loop;
  end loop;
  update game.rooms set status='playing',categories=cats where id=r;
 elsif action='answer' then
  if ro.status<>'playing' or pa.finished then raise exception 'Du kannst hier keine Antwort mehr abgeben.';end if;
  n:=(payload->>'position')::int;
  select * into a from game.answers where room_id=r and profile_id=u and position=n;
  if a.profile_id is not null then return game.snapshot(r,u);end if;
  if n is distinct from pa.cursor then raise exception 'Bitte beantworte die aktuelle Frage.';end if;
  select qb.* into q from game.questions qb join game.match_questions mq on mq.question_id=qb.id where mq.room_id=r and mq.position=n;
  i:=(payload->>'option')::int;
  if i is null or i not between 0 and 3 then raise exception 'Ungültige Antwort.';end if;
  insert into game.answers values(r,u,n,i,case when (select option_order[i+1] from game.match_questions where room_id=r and position=n)=q.correct then q.difficulty else 0 end,now());
 elsif action='next' then
  if ro.status<>'playing' or pa.finished then return game.snapshot(r,u);end if;
  if (payload->>'position')::int is distinct from pa.cursor then return game.snapshot(r,u);end if;
  if not exists(select 1 from game.answers where room_id=r and profile_id=u and position=pa.cursor) then raise exception 'Bitte wähle zuerst eine Antwort.';end if;
  update game.participants set cursor=cursor+1,finished=(cursor+1=ro.per_category*coalesce(nullif(cardinality(ro.categories),0),cardinality(ro.selected_categories),4)) where room_id=r and profile_id=u;
  if (select count(*) from game.participants where room_id=r and finished)=2 then update game.rooms set status='completed',finished_at=now() where id=r;end if;
 elsif action='leave' then
  if ro.status='waiting' then
   if ro.host=u then update game.rooms set status='aborted' where id=r;
   else delete from game.participants where room_id=r and profile_id=u;update game.participants set ready=false where room_id=r;end if;
  elsif ro.status='playing' then update game.rooms set status='aborted' where id=r;
  end if;
  update public.duel_events set version=version+1 where room_id=r;
  return 'null'::jsonb;
 elsif action='review' then
  if ro.status<>'completed' then raise exception 'Die Auflösung ist nach Duellende verfügbar.';end if;
  return (select jsonb_agg(jsonb_build_object('position',mq.position,'prompt',qb.prompt,'category',qb.category,'options',game.ordered_options(qb.options,mq.option_order),'selected',ans.option_index,'correct',array_position(mq.option_order,qb.correct)-1,'points',ans.points,'explanation',qb.explanation,'media',qb.media,'provenance',qb.provenance) order by mq.position) from game.match_questions mq join game.questions qb on qb.id=mq.question_id join game.answers ans on ans.room_id=r and ans.position=mq.position and ans.profile_id=u where mq.room_id=r);
 elsif action='rematch' then
  if ro.status<>'completed' then raise exception 'Eine Revanche ist erst nach dem Duell möglich.';end if;
  if ro.rematch_id is not null then return game.snapshot(ro.rematch_id,u);end if;
  -- Reserve both identities; do not pull an opponent out of another active duel.
  perform pg_advisory_xact_lock(hashtext(profile_id::text)) from game.participants where room_id=r order by profile_id;
  if exists(select 1 from game.participants pp join game.rooms rr on rr.id=pp.room_id where pp.profile_id in(select profile_id from game.participants where room_id=r) and rr.status in ('playing','waiting') and (rr.status='playing' or rr.expires_at>now())) then raise exception 'Einer von euch hat bereits ein offenes Duell.';end if;
  for i in 1..100 loop
   begin
    insert into game.rooms(code,host,per_category,previous_id,selected_categories) values(lpad(floor(random()*10000)::int::text,4,'0'),ro.host,ro.per_category,r,ro.selected_categories) returning id into old_r;exit;
   exception when unique_violation then if i=100 then raise exception 'Bitte versuche die Revanche später erneut.';end if;
   end;
  end loop;
  insert into game.participants(room_id,profile_id) select old_r,profile_id from game.participants where room_id=r;
  insert into public.duel_events(room_id) values(old_r);
  update game.rooms set rematch_id=old_r where id=r;
  update public.duel_events set version=version+1 where room_id=r;
  return game.snapshot(old_r,u);
 else raise exception 'Unbekannte Aktion.';
 end if;
 update public.duel_events set version=version+1 where room_id=r;
 return game.snapshot(r,u);
 exception when others then
  return jsonb_build_object('error',case when sqlstate in('23514','22P02','22023') then 'Bitte überprüfe deine Eingabe.' when sqlstate='P0001' then sqlerrm else 'Die Aktion konnte nicht gespeichert werden. Bitte versuche es erneut.' end);
 end;
end$function$
;
CREATE OR REPLACE FUNCTION game.snapshot(r uuid, u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare ro game.rooms; pa game.participants; q game.questions; a game.answers; v jsonb; ord int[];
begin
 select * into ro from game.rooms where id=r;
 select * into pa from game.participants where room_id=r and profile_id=u;
 if pa.profile_id is null then raise exception 'Du gehörst nicht zu diesem Duell.'; end if;
 v:=jsonb_build_object('id',r,'code',ro.code,'host',ro.host,'status',ro.status,'perCategory',ro.per_category,'selectedCategories',ro.selected_categories,'categories',ro.categories,'total',ro.per_category*coalesce(nullif(cardinality(ro.categories),0),cardinality(ro.selected_categories),4),'cursor',pa.cursor,'finished',pa.finished,'rematchId',ro.rematch_id,'expiresAt',ro.expires_at,'points',(select coalesce(sum(points),0) from game.answers where room_id=r and profile_id=u),'players',(select jsonb_agg(jsonb_build_object('id',p.profile_id,'nickname',pr.nickname,'ready',p.ready,'finished',p.finished,'progress',(select count(*) from game.answers where room_id=r and profile_id=p.profile_id)) order by p.profile_id) from game.participants p join game.profiles pr on pr.id=p.profile_id where p.room_id=r));
 if ro.status='playing' and not pa.finished then
  select qb.* into q from game.match_questions mq join game.questions qb on qb.id=mq.question_id where mq.room_id=r and mq.position=pa.cursor;
  select * into a from game.answers where room_id=r and profile_id=u and position=pa.cursor;
  select option_order into ord from game.match_questions where room_id=r and position=pa.cursor;
  v:=v||jsonb_build_object('question',jsonb_build_object('id',q.id,'category',q.category,'difficulty',q.difficulty,'prompt',q.prompt,'options',game.ordered_options(q.options,ord),'media',q.media));
  if a.profile_id is not null then v:=v||jsonb_build_object('feedback',jsonb_build_object('selected',a.option_index,'correct',array_position(ord,q.correct)-1,'points',a.points,'explanation',q.explanation,'provenance',q.provenance));end if;
 end if;
 if ro.status='completed' then v:=v||jsonb_build_object('result',game.result(r));end if;
 return v;
end$function$
;
CREATE OR REPLACE FUNCTION game.result(r uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select jsonb_build_object('id',ro.id,'date',ro.finished_at,'categories',ro.categories,'total',ro.per_category*coalesce(nullif(cardinality(ro.categories),0),cardinality(ro.selected_categories),4),'players',(select jsonb_agg(jsonb_build_object('id',p.profile_id,'nickname',pr.nickname,'points',(select coalesce(sum(a.points),0) from game.answers a where a.room_id=r and a.profile_id=p.profile_id),'correct',(select count(*) from game.answers a where a.room_id=r and a.profile_id=p.profile_id and a.points>0),'categories',(select jsonb_object_agg(c.category,c.points) from (select q.category,sum(a.points) points from game.answers a join game.match_questions mq on mq.room_id=a.room_id and mq.position=a.position join game.questions q on q.id=mq.question_id where a.room_id=r and a.profile_id=p.profile_id group by q.category)c)) order by p.profile_id) from game.participants p join game.profiles pr on pr.id=p.profile_id where p.room_id=r)) from game.rooms ro where ro.id=r and ro.status='completed'
$function$
;
