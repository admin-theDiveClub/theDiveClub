-- Nineteen dummy players, all interested in one league season.
--
-- Test data, for trying the "name down → confirm" lists with a realistic
-- number of people in them. **Not a migration**: it inserts rows rather than
-- changing the schema, so it lives here and is run by hand.
--
-- Run it in the Supabase SQL editor. Claude did not run it: the rule in
-- claude/START-HERE.md is that execute_sql auto-commits and is never used to
-- write, and that rule is worth more than the twenty seconds it saves.
--
-- **Point it at a league by changing v_season at the top.** The same nineteen
-- accounts are used every time — one set of test accounts, not a set per
-- league. With v_move true, running it with a different season MOVES them
-- there, out of every other league. With v_move false (24 Oct) they are
-- added and keep their other leagues: Test_WedSim's teams and lineups need
-- them. Running it again on the same season resets them there: back on the
-- Name Down list, unconfirmed, off any team.
--
-- The cleanup block at the bottom removes all of it again.

do $$
declare
	-- UI Fixes — Testing (24 Oct). Test_WedSim_8BMTL — 1st Half 1995 was
	-- 87929f3a-104a-4227-9819-6aa10d56aabc.
	v_season uuid := 'ffc79915-3fce-4041-bfc1-e30371a21452';
	-- false: add them here and leave them in every other league.
	v_move   boolean := false;

	v_names text[] := array[
		'Thabo Mokoena', 'Ashwin Pillay', 'Johan van Wyk', 'Sipho Dlamini',
		'Riaan Botha', 'Kagiso Maseko', 'Dylan Fourie', 'Nadia Abrahams',
		'Pieter Steyn', 'Lerato Ndlovu', 'Shaun Naidoo', 'Bongani Khumalo',
		'Marco Ferreira', 'Tristan de Villiers', 'Zanele Mthembu',
		'Craig Petersen', 'Imraan Davids', 'Lebo Molefe', 'Werner Coetzee'
	];
	v_ids   uuid[] := '{}';
	v_id    uuid;
	v_user  uuid;
	v_email text;
	v_moved integer := 0;
	i       integer;
begin
	if not exists (select 1 from public.tbl_league_seasons where id = v_season) then
		raise exception 'No league season %. Put the right id at the top of this script.', v_season;
	end if;

	for i in 1 .. array_length(v_names, 1) loop
		v_email := 'dummy' || lpad(i::text, 2, '0') || '@test.thediveclub.org';

		select id into v_user from auth.users where email = v_email;

		if v_user is null then
			v_user := gen_random_uuid();
			-- A profile, not a login: no password is set, so nobody can sign
			-- in as one of these. That is all the lists need.
			--
			-- id and email only. Checked against production on 23 Oct: id is
			-- the one column of auth.users that is NOT NULL without a
			-- default, so naming any others would be guessing at a table
			-- Supabase owns and changes.
			insert into auth.users (id, email) values (v_user, v_email);
		end if;

		-- The player row is made by the trigger on auth.users; name it.
		update public.tbl_players set display_name = v_names[i] where user_id = v_user;
		select id into v_id from public.tbl_players where user_id = v_user;
		v_ids := v_ids || v_id;
	end loop;

	-- Out of any other league first, when moving. One set of test accounts,
	-- moved where it is wanted, rather than nineteen more every time this is
	-- pointed somewhere new.
	if v_move then
		delete from public.tbl_league_season_entrants
		where player_id = any(v_ids) and league_season_id <> v_season;
		get diagnostics v_moved = row_count;
	end if;

	-- Interested and not confirmed, as tdc_league_show_interest leaves them
	-- since 20261023201147: putting your name down no longer confirms you.
	-- Running this again puts all nineteen back on the Name Down list,
	-- unconfirmed and off any team, ready to test the flow again.
	insert into public.tbl_league_season_entrants
		(league_season_id, player_id, status, confirmed_at)
	select v_season, p, 'interested', null from unnest(v_ids) p
	on conflict (league_season_id, player_id) do update
		set status = 'interested', confirmed_at = null, team_id = null, is_captain = false;

	if v_moved > 0 then
		raise notice 'Took % of them out of another league on the way.', v_moved;
	end if;
	raise notice 'Nineteen dummy players are on the interested list for season %.', v_season;
end $$;


-- ── To remove them again ──
--
-- In this order, and not by deleting the accounts alone.
-- tbl_players.user_id is ON DELETE SET NULL, so removing the auth user
-- leaves the player row behind with no account — and still on the league's
-- list, which is the one thing a league player may not be. The entrant rows
-- go first, then the players, then the accounts.
--
-- do $$
-- declare
--     v_players uuid[];
-- begin
--     select array_agg(p.id) into v_players
--     from public.tbl_players p
--     join auth.users u on u.id = p.user_id
--     where u.email like 'dummy__@test.thediveclub.org';
--
--     if v_players is null then
--         raise notice 'No dummy players to remove.';
--         return;
--     end if;
--
--     delete from public.tbl_league_season_entrants where player_id = any(v_players);
--     delete from public.tbl_players where id = any(v_players);
--     delete from auth.users where email like 'dummy__@test.thediveclub.org';
--
--     raise notice '% dummy players removed.', array_length(v_players, 1);
-- end $$;
