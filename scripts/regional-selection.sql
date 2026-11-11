-- The live RPC still chooses and persists options once per room. Only selection changes.
create or replace function game.pick_regional_question(p_category text, p_difficulty integer, p_room uuid, p_excluded text[])
returns text language plpgsql volatile security invoker set search_path='' as $$
declare
 cfg jsonb:=game.selection_policy();
 target int:=(cfg->'regionalAfricaTargets'->>p_category)::int;
 phase numeric:=case when p_room is null then random()::numeric*100
  else (('x'||left(md5(p_room::text),8))::bit(32)::bigint)*100::numeric/4294967296 end;
 previous_target int;
 africa_slot boolean;
 focus_slot boolean;
 region text;
 weights jsonb;
 pool jsonb;
 filtered jsonb;
 oldest timestamptz;
 selected_subject text;
 chosen text;
begin
 select coalesce(sum((cfg->'regionalAfricaTargets'->>q.category)::int),0)
 into previous_target
 from game.match_questions mq join game.questions q on q.id=mq.question_id
 where mq.room_id=p_room;
 africa_slot:=floor((phase+previous_target+target)/100)>floor((phase+previous_target)/100);

 -- Look at both participants' history, including disabled questions from old matches.
 -- The most recent room of each participant also supplies country-level variety.
 with member_history as (
  select pp.room_id,
   row_number() over(partition by pp.profile_id order by r.created_at desc,r.id desc) as recency,
   r.created_at
  from game.participants member
  join game.participants pp on pp.profile_id=member.profile_id
  join game.rooms r on r.id=pp.room_id
  where member.room_id=p_room and r.id<>p_room and r.status in ('playing','completed')
 ), historic_rooms as (
  select room_id,created_at,bool_or(recency=1) as recent
  from member_history group by room_id,created_at
 ), history as (
  select q.subject_key,q.provenance->>'iso' as iso,h.created_at,h.recent
  from historic_rooms h join game.match_questions mq on mq.room_id=h.room_id
  join game.questions q on q.id=mq.question_id
 ), subjects as (
  select subject_key,max(created_at) as seen,bool_or(recent) as recent_subject
  from history group by subject_key
 ), countries as (
  select distinct iso from history where recent
 )
 select jsonb_agg(jsonb_build_object(
   'id',q.id,'subject',q.subject_key,'iso',q.provenance->>'iso',
   'region',game.selection_continent(q.provenance->>'iso'),'difficulty',q.difficulty,
   'seen',s.seen,'recentSubject',coalesce(s.recent_subject,false),'recentCountry',c.iso is not null
 )) into pool
 from game.questions q
 left join subjects s on s.subject_key=q.subject_key
 left join countries c on c.iso=q.provenance->>'iso'
 where q.enabled and q.category=p_category and not(q.id=any(p_excluded)) and not exists(
  select 1 from game.match_questions mq join game.questions prior on prior.id=mq.question_id
  where mq.room_id=p_room and prior.subject_key=q.subject_key
 );
 if pool is null then return null; end if;

 if africa_slot then
  select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where value->>'region'='Afrika';
 end if;
 if filtered is null then
  select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where value->>'region' is distinct from 'Afrika';
 end if;
 if filtered is not null then pool:=filtered; end if;

 select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where not (value->>'recentSubject')::boolean;
 if filtered is not null then pool:=filtered; end if;
 select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where value->>'seen' is null;
 if filtered is not null then pool:=filtered; end if;

 if pool->0->>'region' is distinct from 'Afrika' then
  select jsonb_object_agg(c,coalesce(cfg->'regionalContinentOverrides'->p_category->c,cfg->'regionalContinentWeights'->c,'1'::jsonb))
  into weights
  from (select distinct coalesce(value->>'region','global') as c from jsonb_array_elements(pool)) regions;
  region:=game.selection_weighted(weights);
  select jsonb_agg(value) into pool from jsonb_array_elements(pool)
  where coalesce(value->>'region','global')=region;
 end if;

 select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where not (value->>'recentCountry')::boolean;
 if filtered is not null then pool:=filtered; end if;

 if pool->0->>'region'='Afrika' and
    (select count(distinct cfg->'regionalAfricaFocusCountries' ? (value->>'iso')) from jsonb_array_elements(pool))=2 then
  focus_slot:=random()<(cfg->>'regionalAfricaFocusShare')::double precision;
  select jsonb_agg(value) into pool from jsonb_array_elements(pool)
  where (cfg->'regionalAfricaFocusCountries' ? (value->>'iso'))=
        focus_slot;
 end if;

 select jsonb_agg(value) into filtered from jsonb_array_elements(pool) where (value->>'difficulty')::int=p_difficulty;
 if filtered is not null then pool:=filtered; end if;
 select min((value->>'seen')::timestamptz) into oldest from jsonb_array_elements(pool);
 if oldest is not null then
  select jsonb_agg(value) into pool from jsonb_array_elements(pool) where (value->>'seen')::timestamptz=oldest;
 end if;

 select jsonb_object_agg(value->>'subject',case when cfg->'preferredCountries' ? (value->>'iso')
  then (cfg->>'preferredCountryWeight')::numeric else 1 end)
 into weights from jsonb_array_elements(pool);
 selected_subject:=game.selection_weighted(weights);
 select value->>'id' into chosen from jsonb_array_elements(pool)
 where value->>'subject'=selected_subject order by random() limit 1;
 return chosen;
end $$;
revoke all on function game.pick_regional_question(text,integer,uuid,text[]) from public,anon,authenticated;
