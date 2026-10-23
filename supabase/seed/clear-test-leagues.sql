-- Clears every league, and the nineteen dummy players, from the database.
--
-- Test data only. Written 23 Oct 2026, when the two leagues in production
-- ("Test 8BMTL" and "TestTuesday : BC BBMTL") were both test leagues and UV
-- wanted to start the league feedback from scratch. **Not a migration**: it
-- deletes rows, it does not change the schema. Run it by hand in the Supabase
-- SQL editor; Claude does not write to production.
--
-- One block, so it is all or nothing. It stops without deleting anything if
-- any league match has a frame, because then it is not just test scaffolding.
--
-- The order matters:
--   1. Fixtures first. A fixture points at its match without a cascade, so the
--      match cannot go while the fixture holds it.
--   2. The league matches. Deleting a match takes its order, squad, sides,
--      events and notifications with it (all cascade).
--   3. The leagues. That cascades to seasons, teams, entrants and LD roles.
--      Teams could not go before step 2: a match refuses to lose its team.
--   4. The tbl_seasons rows the leagues made (tdc_create_league_season makes
--      one when none is given). Only those no league still uses.
--   5. The dummy players: player rows, then their accounts. Not the accounts
--      alone — tbl_players.user_id is ON DELETE SET NULL, so that would leave
--      accountless player rows behind.

do $$
declare
	v_matches uuid[];
	v_seasons uuid[];
	v_players uuid[];
	v_n       integer;
begin
	select coalesce(array_agg(match_id), '{}') into v_matches
	from public.tbl_league_fixtures where match_id is not null;

	if exists (select 1 from public.tbl_frames where match_id = any(v_matches)) then
		raise exception 'A league match has frames. Nothing deleted: check with Claude first.';
	end if;

	select coalesce(array_agg(distinct season_id), '{}') into v_seasons
	from public.tbl_league_seasons;

	delete from public.tbl_league_fixtures;
	get diagnostics v_n = row_count;
	raise notice '% fixtures removed.', v_n;

	delete from public.tbl_matches where id = any(v_matches);
	get diagnostics v_n = row_count;
	raise notice '% league matches removed.', v_n;

	delete from public.tbl_leagues;
	get diagnostics v_n = row_count;
	raise notice '% leagues removed (with their seasons, teams and entrants).', v_n;

	delete from public.tbl_seasons s
	where s.id = any(v_seasons)
		and not exists (select 1 from public.tbl_league_seasons ls where ls.season_id = s.id);
	get diagnostics v_n = row_count;
	raise notice '% seasons removed.', v_n;

	select array_agg(p.id) into v_players
	from public.tbl_players p
	join auth.users u on u.id = p.user_id
	where u.email like 'dummy__@test.thediveclub.org';

	if v_players is null then
		raise notice 'No dummy players to remove.';
	else
		delete from public.tbl_players where id = any(v_players);
		delete from auth.users where email like 'dummy__@test.thediveclub.org';
		raise notice '% dummy players removed.', array_length(v_players, 1);
	end if;
end $$;
