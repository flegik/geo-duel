do $activation$
begin
 if (select count(*) from game.questions where category='germany' and id like 'de1-%') <> 970 then
  raise exception 'Germany seed is incomplete';
 end if;
 update game.questions set enabled=true where category='germany' and id like 'de1-%' and not enabled;
end
$activation$;
