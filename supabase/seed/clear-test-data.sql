-- Clears every test player, league, tournament, match and frame from the database.
--
-- UV, 11 Nov 2026: none of it is real, and the Rivonia 8MTL import
-- (docs/STATUS.md R1) brings clean data to test with. **Not a migration**: it
-- deletes rows, it does not change the schema. Run it by hand in the Supabase
-- SQL editor; Claude does not write to production.
--
-- Counted in production before writing this (11 Nov, read only): 2 leagues,
-- 2 seasons, 2 tournaments, 36 matches, 122 frames, 16 deleted-match records,
-- 117 notifications, 28 accounts.
--
-- **Players removed (22), with their accounts:**
--   the 19 dummies (dummy01…dummy19@test.thediveclub.org),
--   Test1-player and Test2-player (admin+test1@ and admin+test2@thediveclub.org),
--   "Yuvan", UV's own test account, named by its player id so that its email
--   is not written into the repo.
-- **Kept (UV, 11 Nov):** UV, The Club Lifeguard (admin@), Rick Schoenlank,
-- Linton Paul (and his credits), Basil's Billiards, Yeshveer Manawar.
-- **Also kept:** venues and staff, credits, redeem codes, identifiers of kept
-- players, follows between kept players, push subscriptions and notification
-- settings of kept accounts, the owner board, titles, and
-- tbl_competition_role_types (a lookup, not test data).
--
-- One block, so it is all or nothing. It stops with nothing deleted if the
-- players it finds are not exactly those 22, or if any of them has a credit
-- or a redeemed code.
--
-- The order matters:
--   1. Empty the competition tables with TRUNCATE (as migration
--      20261105133615 did): the frame guards refuse deleting a signed card's
--      frames, and the edit-log trigger would write a row for each one;
--      TRUNCATE fires no row triggers. **No CASCADE, on purpose:** the list
--      is every table that references a league, season, tournament, match or
--      notification, found by asking the database on 11 Nov (27 tables). If a
--      later table references one and is not listed, Postgres refuses the
--      whole statement and nothing is emptied.
--   2. The 22 player rows. Frames, match events and the deleted-match log
--      refuse to lose a player, which is why step 1 comes first. Their
--      identifiers, follows, notification settings and squad places cascade.
--   3. Their accounts. Not the accounts alone: tbl_players.user_id is
--      ON DELETE SET NULL, which would leave accountless player rows behind.
--
-- **Not done here: files in storage.** Supabase does not let SQL delete them.
-- Before running, remove the league's picture and the two team pictures in
-- the dashboard (Storage: league-pictures, team-pictures). The script lists
-- any profile picture left behind by a removed player.

do $$
declare
	v_wits    constant uuid := 'f371c7f6-ac44-4c7a-a587-df890bc6134a';
	v_players uuid[];
	v_users   uuid[];
	v_avatars text[];
	v_n       integer;
begin
	select coalesce(array_agg(p.id), '{}'), coalesce(array_agg(p.user_id) filter (where p.user_id is not null), '{}'),
		coalesce(array_agg(p.avatar_path) filter (where p.avatar_path is not null), '{}')
	into v_players, v_users, v_avatars
	from public.tbl_players p
	left join auth.users u on u.id = p.user_id
	where u.email like 'dummy__@test.thediveclub.org'
		or u.email in ('admin+test1@thediveclub.org', 'admin+test2@thediveclub.org')
		or p.id = v_wits;

	if cardinality(v_players) <> 22 then
		raise exception 'Expected 22 test players, found %. Nothing deleted: check with Claude first.', cardinality(v_players);
	end if;
	if exists (select 1 from public.tbl_credit_ledger where player_id = any(v_players))
		or exists (select 1 from public.tbl_redeem_codes where redeemed_player_id = any(v_players)) then
		raise exception 'A test player has a credit or a redeemed code. Nothing deleted: check with Claude first.';
	end if;

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
		public.tbl_tournament_venues,
		public.tbl_competition_roles,
		-- leagues
		public.tbl_seasons,
		public.tbl_leagues,
		public.tbl_league_seasons,
		public.tbl_league_season_venues,
		public.tbl_teams,
		public.tbl_league_season_entrants,
		public.tbl_league_fixtures,
		public.tbl_league_match_squad,
		public.tbl_league_match_order,
		public.tbl_league_match_sides,
		public.tbl_league_standing_columns,
		public.tbl_team_join_requests,
		-- every notification is about one of the above
		public.tbl_notifications;
	raise notice 'Every league, tournament, match, frame and notification removed.';

	delete from public.tbl_players where id = any(v_players);
	get diagnostics v_n = row_count;
	raise notice '% test players removed.', v_n;

	delete from auth.users where id = any(v_users);
	get diagnostics v_n = row_count;
	raise notice '% test accounts removed.', v_n;

	if cardinality(v_avatars) > 0 then
		raise notice 'Profile pictures left in storage (player-avatars), delete them in the dashboard: %', array_to_string(v_avatars, ', ');
	end if;

	select count(*) into v_n from public.tbl_players;
	raise notice '% players left.', v_n;
end $$;
