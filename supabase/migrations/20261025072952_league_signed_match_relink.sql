-- The repair of 20261025072000, again, for whatever empty match is on the
-- fixture.
--
--   20261025072000 put the signed TEAM B v TEAM C (905d6285) back on fixture
--   0719b3b8 only if that fixture still held the empty match made at 22:20
--   on 24 Oct (2e6ed6b0). By the push it did not: at 07:01 on 25 Oct that one
--   had been taken off and Start pressed again, making 2a6f5128. So the
--   relink was skipped (rightly: it checked for one exact state), and the
--   22:20 match, by then off the schedule and empty, was deleted.
--
--   This one does not name the empty match. It relinks the signed match as
--   long as the fixture holds a match with nothing on it (no frames, events,
--   squad, order or locked side), whatever its id, and the signed match is on
--   no fixture; then deletes that empty match. Anywhere else, including the
--   local copy, it does nothing.

do $$
declare
	v_empty uuid;
begin
	select f.match_id into v_empty
	from public.tbl_league_fixtures f
	join public.tbl_matches m on m.id = f.match_id
	where f.id = '0719b3b8-4d0d-4f20-b9c8-331b98534ede'
		and m.id <> '905d6285-19bf-473a-8a31-26e8f6846447'
		and m.status = 'scheduled'
		and not exists (select 1 from public.tbl_frames where match_id = m.id)
		and not exists (select 1 from public.tbl_match_events where match_id = m.id)
		and not exists (select 1 from public.tbl_league_match_squad where match_id = m.id)
		and not exists (select 1 from public.tbl_league_match_order where match_id = m.id)
		and not exists (select 1 from public.tbl_league_match_sides where match_id = m.id);

	if v_empty is null
		or not exists (select 1 from public.tbl_matches where id = '905d6285-19bf-473a-8a31-26e8f6846447' and status = 'complete')
		or exists (select 1 from public.tbl_league_fixtures where match_id = '905d6285-19bf-473a-8a31-26e8f6846447') then
		return;
	end if;

	update public.tbl_league_fixtures
	set match_id = '905d6285-19bf-473a-8a31-26e8f6846447'
	where id = '0719b3b8-4d0d-4f20-b9c8-331b98534ede';

	delete from public.tbl_matches where id = v_empty;
end;
$$;
