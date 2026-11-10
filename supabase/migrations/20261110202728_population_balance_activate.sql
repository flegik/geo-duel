-- Only new starts use weighted selection; existing room questions/options/answers are untouched.
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
    if c='flags' then
    -- Prefer questions not seen by either participant throughout their recorded rounds.
    select qb.id into chosen from game.questions qb where qb.enabled and qb.category=c and qb.difficulty=d and not exists(select 1 from game.match_questions mq0 join game.questions prior on prior.id=mq0.question_id where mq0.room_id=r and prior.subject_key=qb.subject_key)
    order by (select count(*) from game.match_questions mq join game.questions recent_question on recent_question.id=mq.question_id where recent_question.subject_key=qb.subject_key and mq.room_id in(select recent.id from (select distinct rr.id,rr.created_at from game.rooms rr join game.participants pp on pp.room_id=rr.id where rr.status in('playing','completed') and rr.id<>r and pp.profile_id in(select profile_id from game.participants where room_id=r) order by rr.created_at desc  )recent)),random() limit 1;
    else
     chosen:=game.pick_balanced_question(c,d,r);
    end if;
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
do $check$ begin
 if (select count(*) from game.questions where id in ('population-v1-a9c42be49c752961b15b','population-v1-ca84b05041ea5970c2af','population-v1-31dc0398e21ad02bad95','population-v1-95dc38c8737a97770f82','population-v1-30f2ff0534fd7d27aa02','population-v1-7a79cc9088565295bcbf','population-v1-38beb7f50d0baef47533','population-v1-97b0af228b7a14c96d8d','population-v1-7b29854fb0530a7f9e64','population-v1-40717bcfa7fd10043318','population-v1-9f65503d8553474bffce','population-v1-7136570d1ff28806185a','population-v1-6cd566b4cf53bf4d33bf','population-v1-4eb3002e89727f3cf28e','population-v1-17a06689b87d6e0814a2','population-v1-e6925dd0a0ed522ece88','population-v1-274fa1fcd9fb69da6cf0','population-v1-b0ae499c526e3431287d','population-v1-741f0e2562300a71c859','population-v1-f938858927da29f903e0','population-v1-77570d1e0ae315effdc6','population-v1-ae276b5d0c71d9fadc12','population-v1-07505d2ddcfee2a73483','population-v1-93aef1b66b740cd9f18e','population-v1-41191adf36b06d227bdc','population-v1-fe7635d673d37cd29a2b','population-v1-02d210df25d429608116','population-v1-c506bc4e59b76ea7ee4a','population-v1-451a90d2cb211c36e8b9','population-v1-f47b7ca8e9a98212ea56','population-v1-fcc8581b9d1664b326f3','population-v1-a921645bf2190d04e5ed','population-v1-88c0a33ae83c5b709de5','population-v1-f0b0c5521953335868cd','population-v1-cc3062aff69b3328e0e7','population-v1-37f18b3aaa72db170726','population-v1-f47f6f89e52f7e259bc5','population-v1-af99383c11b3deaaecdf','population-v1-f2e184f909ce0f58cd50','population-v1-4bc133d7bc4335b544eb','population-v1-a214963471a5fecaf36e','population-v1-b594dd8d700143ad5c2c','population-v1-9bd900e4eae33c6c715a','population-v1-945603a2efc24037c35c','population-v1-fa9e17323e8629cdadc9','population-v1-43ecc3e22c0395f6d3eb','population-v1-7687d5d0e210969552d4','population-v1-d36cecb936833d31a76e','population-v1-26ba933febb35597127f','population-v1-50ad0d679fed48d0cf3b','population-v1-fe0b188ae030208ca0f4','population-v1-e7b69240b3c80f334195','population-v1-2403034910f6cd1ba8d6','population-v1-ada9b1ae7b1327c0ed41','population-v1-8f6cebe51d7bde707e02','population-v1-7dbc47620fdb2f4a3b52','population-v1-d273dc456001b8792754','population-v1-af439e21c7fd8865a13d','population-v1-01a25586186ac060cb5a','population-v1-17d2abd03214dec8a629','population-v1-00f3c14ffef58ab2d23f','population-v1-832d03ef6d697744d6c4','population-v1-1cd975f6d0df8fed10e6','population-v1-21175d3d726bdb0c8a2d','population-v1-4e19400465fe63be3329','population-v1-e2629f86e729effdc4f7','population-v1-02792e11dc80ec1d4b5c','population-v1-94c65009ae795d5fc6a4','population-v1-0f557d6cfc8dfe0fdf0b','population-v1-b0149b526bc0085b0d9c','population-v1-ec26f16933cdde80bd9a','population-v1-971007f3dbad8f7dcb44','population-v1-75aaa802fdaad9dd01aa','population-v1-92d90cf11db41f862ca4','population-v1-65eb4a7c54ed8c9d2cc7','population-v1-a8ceb01c3b447d8e4136','population-v1-38b88fdb4ea03dc346cd','population-v1-1e7253c9fa4f0b78c32e','population-v1-d5f35c62fdcd9bbdbcb6','population-v1-b597e7294f3a7d148b83','population-v1-b8b97d9de2c58b0f8b9c','population-v1-14a30d4c472b570cd9d2','population-v1-785e8724d0b5a47f62b9','population-v1-6bace7a5f4efb0d2a72f','population-v1-1b1144bc233f27d7869c','population-v1-81de9fc158e73c9bc5b3','population-v1-39db8c570e259297b410','population-v1-9bc530612fa009d5fe4a','population-v1-b067b24dc31c8c5c8474','population-v1-f48f9b26cd639b877af7','population-v1-02dccf8a2d1cf1d0bec0','population-v1-bb604b84fe7129b015e8','population-v1-ddb7e0ff14195a01f91d','population-v1-9ae62999489e801a1147','population-v1-7ec8e8844f612309bf5f','population-v1-8ee154766688ec617c47','population-v1-93273800cabd68326bc2','population-v1-5d6624e7462dc42a7eff','population-v1-e7bab9974caa4e5e0e26','population-v1-3e57645144f23daee750','population-v1-12695ee4f080f6abd975','population-v1-35697834b74b7db293f1','population-v1-3f5fbc596558025f885e','population-v1-06fec04cd2b10e359290','population-v1-d2c314e08b5815a4652a','population-v1-85b07e6b3f2cb8e9bdca','population-v1-75ec6ef09f91e70288ba','population-v1-46331e035191b8d84a2e','population-v1-bc0e7fcb843651850b27','population-v1-8b573d930c50deb83b72','population-v1-79d34001c77d815e4f46','population-v1-4e4d302e769bbe563bf6','population-v1-effbf83cc1dc373c9442','population-v1-9f4e62c3e942441696b4','population-v1-29686e7368fbbff9f664','population-v1-8e1f885cbd149a0aa998','population-v1-c7e8359878d0ce0e3ee5','population-v1-bf31263f3d065f9b3ed7','population-v1-367d05ecf822e08b4545','population-v1-134147224d8a529b984e'))<>120 then raise exception 'Incomplete population pool';end if;
end $check$;
update game.questions set enabled=true where id in ('population-v1-a9c42be49c752961b15b','population-v1-ca84b05041ea5970c2af','population-v1-31dc0398e21ad02bad95','population-v1-95dc38c8737a97770f82','population-v1-30f2ff0534fd7d27aa02','population-v1-7a79cc9088565295bcbf','population-v1-38beb7f50d0baef47533','population-v1-97b0af228b7a14c96d8d','population-v1-7b29854fb0530a7f9e64','population-v1-40717bcfa7fd10043318','population-v1-9f65503d8553474bffce','population-v1-7136570d1ff28806185a','population-v1-6cd566b4cf53bf4d33bf','population-v1-4eb3002e89727f3cf28e','population-v1-17a06689b87d6e0814a2','population-v1-e6925dd0a0ed522ece88','population-v1-274fa1fcd9fb69da6cf0','population-v1-b0ae499c526e3431287d','population-v1-741f0e2562300a71c859','population-v1-f938858927da29f903e0','population-v1-77570d1e0ae315effdc6','population-v1-ae276b5d0c71d9fadc12','population-v1-07505d2ddcfee2a73483','population-v1-93aef1b66b740cd9f18e','population-v1-41191adf36b06d227bdc','population-v1-fe7635d673d37cd29a2b','population-v1-02d210df25d429608116','population-v1-c506bc4e59b76ea7ee4a','population-v1-451a90d2cb211c36e8b9','population-v1-f47b7ca8e9a98212ea56','population-v1-fcc8581b9d1664b326f3','population-v1-a921645bf2190d04e5ed','population-v1-88c0a33ae83c5b709de5','population-v1-f0b0c5521953335868cd','population-v1-cc3062aff69b3328e0e7','population-v1-37f18b3aaa72db170726','population-v1-f47f6f89e52f7e259bc5','population-v1-af99383c11b3deaaecdf','population-v1-f2e184f909ce0f58cd50','population-v1-4bc133d7bc4335b544eb','population-v1-a214963471a5fecaf36e','population-v1-b594dd8d700143ad5c2c','population-v1-9bd900e4eae33c6c715a','population-v1-945603a2efc24037c35c','population-v1-fa9e17323e8629cdadc9','population-v1-43ecc3e22c0395f6d3eb','population-v1-7687d5d0e210969552d4','population-v1-d36cecb936833d31a76e','population-v1-26ba933febb35597127f','population-v1-50ad0d679fed48d0cf3b','population-v1-fe0b188ae030208ca0f4','population-v1-e7b69240b3c80f334195','population-v1-2403034910f6cd1ba8d6','population-v1-ada9b1ae7b1327c0ed41','population-v1-8f6cebe51d7bde707e02','population-v1-7dbc47620fdb2f4a3b52','population-v1-d273dc456001b8792754','population-v1-af439e21c7fd8865a13d','population-v1-01a25586186ac060cb5a','population-v1-17d2abd03214dec8a629','population-v1-00f3c14ffef58ab2d23f','population-v1-832d03ef6d697744d6c4','population-v1-1cd975f6d0df8fed10e6','population-v1-21175d3d726bdb0c8a2d','population-v1-4e19400465fe63be3329','population-v1-e2629f86e729effdc4f7','population-v1-02792e11dc80ec1d4b5c','population-v1-94c65009ae795d5fc6a4','population-v1-0f557d6cfc8dfe0fdf0b','population-v1-b0149b526bc0085b0d9c','population-v1-ec26f16933cdde80bd9a','population-v1-971007f3dbad8f7dcb44','population-v1-75aaa802fdaad9dd01aa','population-v1-92d90cf11db41f862ca4','population-v1-65eb4a7c54ed8c9d2cc7','population-v1-a8ceb01c3b447d8e4136','population-v1-38b88fdb4ea03dc346cd','population-v1-1e7253c9fa4f0b78c32e','population-v1-d5f35c62fdcd9bbdbcb6','population-v1-b597e7294f3a7d148b83','population-v1-b8b97d9de2c58b0f8b9c','population-v1-14a30d4c472b570cd9d2','population-v1-785e8724d0b5a47f62b9','population-v1-6bace7a5f4efb0d2a72f','population-v1-1b1144bc233f27d7869c','population-v1-81de9fc158e73c9bc5b3','population-v1-39db8c570e259297b410','population-v1-9bc530612fa009d5fe4a','population-v1-b067b24dc31c8c5c8474','population-v1-f48f9b26cd639b877af7','population-v1-02dccf8a2d1cf1d0bec0','population-v1-bb604b84fe7129b015e8','population-v1-ddb7e0ff14195a01f91d','population-v1-9ae62999489e801a1147','population-v1-7ec8e8844f612309bf5f','population-v1-8ee154766688ec617c47','population-v1-93273800cabd68326bc2','population-v1-5d6624e7462dc42a7eff','population-v1-e7bab9974caa4e5e0e26','population-v1-3e57645144f23daee750','population-v1-12695ee4f080f6abd975','population-v1-35697834b74b7db293f1','population-v1-3f5fbc596558025f885e','population-v1-06fec04cd2b10e359290','population-v1-d2c314e08b5815a4652a','population-v1-85b07e6b3f2cb8e9bdca','population-v1-75ec6ef09f91e70288ba','population-v1-46331e035191b8d84a2e','population-v1-bc0e7fcb843651850b27','population-v1-8b573d930c50deb83b72','population-v1-79d34001c77d815e4f46','population-v1-4e4d302e769bbe563bf6','population-v1-effbf83cc1dc373c9442','population-v1-9f4e62c3e942441696b4','population-v1-29686e7368fbbff9f664','population-v1-8e1f885cbd149a0aa998','population-v1-c7e8359878d0ce0e3ee5','population-v1-bf31263f3d065f9b3ed7','population-v1-367d05ecf822e08b4545','population-v1-134147224d8a529b984e');
-- Old population IDs stay queryable for historical/active duels; updates create new IDs.
update game.questions set enabled=false where id like 'population-v1-%' and id not in ('population-v1-a9c42be49c752961b15b','population-v1-ca84b05041ea5970c2af','population-v1-31dc0398e21ad02bad95','population-v1-95dc38c8737a97770f82','population-v1-30f2ff0534fd7d27aa02','population-v1-7a79cc9088565295bcbf','population-v1-38beb7f50d0baef47533','population-v1-97b0af228b7a14c96d8d','population-v1-7b29854fb0530a7f9e64','population-v1-40717bcfa7fd10043318','population-v1-9f65503d8553474bffce','population-v1-7136570d1ff28806185a','population-v1-6cd566b4cf53bf4d33bf','population-v1-4eb3002e89727f3cf28e','population-v1-17a06689b87d6e0814a2','population-v1-e6925dd0a0ed522ece88','population-v1-274fa1fcd9fb69da6cf0','population-v1-b0ae499c526e3431287d','population-v1-741f0e2562300a71c859','population-v1-f938858927da29f903e0','population-v1-77570d1e0ae315effdc6','population-v1-ae276b5d0c71d9fadc12','population-v1-07505d2ddcfee2a73483','population-v1-93aef1b66b740cd9f18e','population-v1-41191adf36b06d227bdc','population-v1-fe7635d673d37cd29a2b','population-v1-02d210df25d429608116','population-v1-c506bc4e59b76ea7ee4a','population-v1-451a90d2cb211c36e8b9','population-v1-f47b7ca8e9a98212ea56','population-v1-fcc8581b9d1664b326f3','population-v1-a921645bf2190d04e5ed','population-v1-88c0a33ae83c5b709de5','population-v1-f0b0c5521953335868cd','population-v1-cc3062aff69b3328e0e7','population-v1-37f18b3aaa72db170726','population-v1-f47f6f89e52f7e259bc5','population-v1-af99383c11b3deaaecdf','population-v1-f2e184f909ce0f58cd50','population-v1-4bc133d7bc4335b544eb','population-v1-a214963471a5fecaf36e','population-v1-b594dd8d700143ad5c2c','population-v1-9bd900e4eae33c6c715a','population-v1-945603a2efc24037c35c','population-v1-fa9e17323e8629cdadc9','population-v1-43ecc3e22c0395f6d3eb','population-v1-7687d5d0e210969552d4','population-v1-d36cecb936833d31a76e','population-v1-26ba933febb35597127f','population-v1-50ad0d679fed48d0cf3b','population-v1-fe0b188ae030208ca0f4','population-v1-e7b69240b3c80f334195','population-v1-2403034910f6cd1ba8d6','population-v1-ada9b1ae7b1327c0ed41','population-v1-8f6cebe51d7bde707e02','population-v1-7dbc47620fdb2f4a3b52','population-v1-d273dc456001b8792754','population-v1-af439e21c7fd8865a13d','population-v1-01a25586186ac060cb5a','population-v1-17d2abd03214dec8a629','population-v1-00f3c14ffef58ab2d23f','population-v1-832d03ef6d697744d6c4','population-v1-1cd975f6d0df8fed10e6','population-v1-21175d3d726bdb0c8a2d','population-v1-4e19400465fe63be3329','population-v1-e2629f86e729effdc4f7','population-v1-02792e11dc80ec1d4b5c','population-v1-94c65009ae795d5fc6a4','population-v1-0f557d6cfc8dfe0fdf0b','population-v1-b0149b526bc0085b0d9c','population-v1-ec26f16933cdde80bd9a','population-v1-971007f3dbad8f7dcb44','population-v1-75aaa802fdaad9dd01aa','population-v1-92d90cf11db41f862ca4','population-v1-65eb4a7c54ed8c9d2cc7','population-v1-a8ceb01c3b447d8e4136','population-v1-38b88fdb4ea03dc346cd','population-v1-1e7253c9fa4f0b78c32e','population-v1-d5f35c62fdcd9bbdbcb6','population-v1-b597e7294f3a7d148b83','population-v1-b8b97d9de2c58b0f8b9c','population-v1-14a30d4c472b570cd9d2','population-v1-785e8724d0b5a47f62b9','population-v1-6bace7a5f4efb0d2a72f','population-v1-1b1144bc233f27d7869c','population-v1-81de9fc158e73c9bc5b3','population-v1-39db8c570e259297b410','population-v1-9bc530612fa009d5fe4a','population-v1-b067b24dc31c8c5c8474','population-v1-f48f9b26cd639b877af7','population-v1-02dccf8a2d1cf1d0bec0','population-v1-bb604b84fe7129b015e8','population-v1-ddb7e0ff14195a01f91d','population-v1-9ae62999489e801a1147','population-v1-7ec8e8844f612309bf5f','population-v1-8ee154766688ec617c47','population-v1-93273800cabd68326bc2','population-v1-5d6624e7462dc42a7eff','population-v1-e7bab9974caa4e5e0e26','population-v1-3e57645144f23daee750','population-v1-12695ee4f080f6abd975','population-v1-35697834b74b7db293f1','population-v1-3f5fbc596558025f885e','population-v1-06fec04cd2b10e359290','population-v1-d2c314e08b5815a4652a','population-v1-85b07e6b3f2cb8e9bdca','population-v1-75ec6ef09f91e70288ba','population-v1-46331e035191b8d84a2e','population-v1-bc0e7fcb843651850b27','population-v1-8b573d930c50deb83b72','population-v1-79d34001c77d815e4f46','population-v1-4e4d302e769bbe563bf6','population-v1-effbf83cc1dc373c9442','population-v1-9f4e62c3e942441696b4','population-v1-29686e7368fbbff9f664','population-v1-8e1f885cbd149a0aa998','population-v1-c7e8359878d0ce0e3ee5','population-v1-bf31263f3d065f9b3ed7','population-v1-367d05ecf822e08b4545','population-v1-134147224d8a529b984e');
