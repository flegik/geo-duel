-- Format 4 uses neutral marker references before the answer. Older clients
-- keep the original representation, including for already-started duels.
alter table game.participants drop constraint participants_question_format_check;
alter table game.participants add constraint participants_question_format_check
 check(question_format in (1,2,3,4));

do $migration$
declare
 rpc text:=replace(pg_get_functiondef('public.geoduel(text,jsonb)'::regprocedure),chr(13),'');
 snapshot text:=pg_get_functiondef('game.snapshot(uuid,uuid)'::regprocedure);
 format_case text:=$m$case payload->>'questionFormat' when '3' then 3 when '2' then 2 else 1 end$m$;
 germany_guard text:=$m$coalesce(payload->>'questionFormat','')<>'3'$m$;
 snapshot_case text:=$m$when a.profile_id is null and q.media->>'type'='flag-options' then q.provenance->'optionImages'$m$;
begin
 if strpos(rpc,format_case)=0 or strpos(rpc,germany_guard)=0 or strpos(snapshot,snapshot_case)=0 then
  raise exception 'Unexpected GeoDuel answer format definitions';
 end if;
 execute replace(replace(rpc,format_case,replace(format_case,'when ''3''','when ''4'' then 4 when ''3''')),
  germany_guard,$m$coalesce(payload->>'questionFormat','') not in ('3','4')$m$);
 execute replace(snapshot,snapshot_case,snapshot_case||$m$
  when a.profile_id is null and pa.question_format>=4 and q.media->>'type'='city-map' then
   (select jsonb_agg('marker:'||md5(choice) order by position)
    from jsonb_array_elements_text(q.options) with ordinality as options(choice,position))$m$);
end
$migration$;
