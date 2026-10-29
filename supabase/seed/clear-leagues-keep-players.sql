-- Clears every league and everything that hangs off it. Keeps every player.
--
-- Test data only. Written 29 Oct 2026, when the three leagues in production
-- (Test_WedSim_8BMTL, New League Test, UI Fixes) were all test leagues and UV
-- wanted to start fresh. **Not a migration**: it deletes rows, it does not
-- change the schema. Run it by hand in the Supabase SQL editor; Claude does
-- not write to production.
--
-- Unlike clear-test-leagues.sql (23 Oct) it leaves the dummy players and
-- their accounts alone, and it does not stop at played frames: these leagues
-- have been played, and the frames go with them.
--
-- One block, so it is all or nothing. The order matters:
--   1. Unlock. A signed card's frames refuse to be deleted
--      (private.tdc_frames_locked_guard), and so may a frame a director set
--      (private.tdc_frame_rank_guard). Both let through a delete made with
--      tdc.card_unlock on, the door tdc_delete_match uses. For this
--      transaction only.
--   2. Every match between two league teams, on a fixture or not (a
--      regenerate leaves the old ones behind, off their fixtures). Deleting a
--      match takes its frames and their players, events and signatures, the
--      changelog, director overrides, squads, orders, sides and its
--      notifications with it (all cascade). Fixtures holding one are set to
--      no match, and go in step 3.
--   3. The leagues. That cascades to seasons, teams, entrants, fixtures and
--      league roles. Teams could not go before step 2: a match refuses to
--      lose its team.
--   4. The tbl_seasons rows the leagues made, only those no league still uses
--      (nothing else points at them).
--   5. Notifications that link to a removed season's pages ("You are in …",
--      lineup locked), which would otherwise open a missing league.
--
-- Left behind on purpose: every player and account, the dummies included.
-- **League pictures are not removed from storage** (Supabase refuses a
-- delete from storage tables in SQL); remove a league's picture in its
-- Settings first, or the file stays in the league-pictures bucket, unused.

do $$
declare
	v_teams   uuid[];
	v_ls      uuid[];
	v_seasons uuid[];
	v_n       integer;
begin
	perform set_config('tdc.card_unlock', 'on', true);

	select coalesce(array_agg(id), '{}'), coalesce(array_agg(distinct season_id), '{}')
	into v_ls, v_seasons
	from public.tbl_league_seasons;

	select coalesce(array_agg(id), '{}') into v_teams
	from public.tbl_teams where league_season_id = any(v_ls);

	delete from public.tbl_matches
	where home_team_id = any(v_teams) or away_team_id = any(v_teams);
	get diagnostics v_n = row_count;
	raise notice '% league matches removed (with their frames, lineups, signatures and changelog).', v_n;

	delete from public.tbl_leagues;
	get diagnostics v_n = row_count;
	raise notice '% leagues removed (with their seasons, teams, entrants, fixtures and roles).', v_n;

	delete from public.tbl_seasons s
	where s.id = any(v_seasons)
		and not exists (select 1 from public.tbl_league_seasons ls where ls.season_id = s.id);
	get diagnostics v_n = row_count;
	raise notice '% seasons removed.', v_n;

	delete from public.tbl_notifications nt
	where exists (select 1 from unnest(v_ls) x where nt.link like '%' || x::text || '%');
	get diagnostics v_n = row_count;
	raise notice '% notifications about those leagues removed.', v_n;
end $$;
