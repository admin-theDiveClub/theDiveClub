-- ───────────────────────────────────────────────────────────
-- Clear the test leagues, tournaments, matches and frames
--
-- UV, 5 Nov: no real match or frame has been recorded yet; everything in
-- these tables was made while testing. Empty them so testing starts again
-- from nothing.
--
-- Counted in production before writing this (5 Nov): 56 matches, 341 frames,
-- 7 tournaments, 1 league, 1 season, 4 teams, 111 notifications (every one
-- about a match, tournament or league), 7 deleted-match records.
--
-- TRUNCATE, not DELETE: the frame guards (tdc_frames_locked_guard,
-- tdc_frame_rank_guard) refuse deleting frames off an agreed card, and the
-- edit-log trigger would write a row for every frame removed. TRUNCATE does
-- not fire row triggers.
--
-- No CASCADE, on purpose. Every table that references one of these is in the
-- list; if a table outside it still did, Postgres refuses the whole statement
-- and nothing is emptied.
--
-- Kept: players (dummies and walk-ins too), accounts, identifiers, credits,
-- venues and staff, push subscriptions, notification settings, the owner
-- board, and tbl_competition_role_types (a lookup, not test data).
--
-- Not done here: the league and team pictures left in storage. Supabase does
-- not let SQL delete storage objects; UV deletes them in the dashboard.
--
-- Run on a fresh local reset this empties tables that are already empty, so
-- it changes nothing there.
-- ───────────────────────────────────────────────────────────

truncate table
	-- matches and frames
	public.tbl_matches,
	public.tbl_frames,
	public.tbl_frame_participants,
	public.tbl_frame_edit,
	public.tbl_match_events,
	public.tbl_match_result_override,
	public.tbl_deleted_matches,
	-- tournaments
	public.tbl_tournaments,
	public.tbl_tournament_entrants,
	public.tbl_tournament_fixtures,
	public.tbl_tournament_posters,
	public.tbl_tournament_round_rules,
	public.tbl_competition_roles,
	-- leagues
	public.tbl_seasons,
	public.tbl_leagues,
	public.tbl_league_seasons,
	public.tbl_teams,
	public.tbl_league_season_entrants,
	public.tbl_league_fixtures,
	public.tbl_league_match_squad,
	public.tbl_league_match_order,
	public.tbl_league_match_sides,
	public.tbl_league_standing_columns,
	-- every notification is about one of the above
	public.tbl_notifications;
