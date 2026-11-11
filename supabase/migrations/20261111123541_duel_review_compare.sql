-- Extend only the completed, participant-only review branch. Keep the existing
-- function identity, execution grants and unrelated gameplay branches intact.
do $migration$
declare
  definition text := pg_get_functiondef('public.geoduel(text,jsonb)'::regprocedure);
  previous_review text := $previous$
 elsif action='review' then
  if ro.status<>'completed' then raise exception 'Die Auflösung ist nach Duellende verfügbar.';end if;
  return (select jsonb_agg(jsonb_build_object('position',mq.position,'prompt',qb.prompt,'category',qb.category,'options',game.ordered_options(qb.options,mq.option_order),'selected',ans.option_index,'correct',array_position(mq.option_order,qb.correct)-1,'points',ans.points,'explanation',qb.explanation,'media',qb.media,'provenance',qb.provenance) order by mq.position) from game.match_questions mq join game.questions qb on qb.id=mq.question_id join game.answers ans on ans.room_id=r and ans.position=mq.position and ans.profile_id=u where mq.room_id=r);
 elsif action='rematch' then
$previous$;
  new_review text := $review$
 elsif action='review' then
  if ro.status<>'completed' then raise exception 'Die Auflösung ist nach Duellende verfügbar.';end if;
  -- Answer indices already refer to the displayed order, including in older duels.
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'position', mq.position,
      'prompt', qb.prompt,
      'category', qb.category,
      'options', game.ordered_options(qb.options, mq.option_order),
      'selected', own.option_index,
      'correct', array_position(mq.option_order, qb.correct) - 1,
      'points', own.points,
      'explanation', qb.explanation,
      'media', qb.media,
      'provenance', qb.provenance,
      'answers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'profileId', ans.profile_id,
          'selected', ans.option_index,
          'points', ans.points
        ) order by ans.profile_id), '[]'::jsonb)
        from game.answers ans
        where ans.room_id = mq.room_id and ans.position = mq.position
      )
    ) order by mq.position), '[]'::jsonb)
    from game.match_questions mq
    join game.questions qb on qb.id = mq.question_id
    left join game.answers own on own.room_id = mq.room_id
      and own.position = mq.position and own.profile_id = u
    where mq.room_id = r
  );
 elsif action='rematch' then
$review$;
begin
  if strpos(definition, previous_review) = 0 then
    raise exception 'Unexpected GeoDuel review definition. Check the deployed RPC before migrating.';
  end if;
  execute replace(definition, previous_review, new_review);
end
$migration$;
