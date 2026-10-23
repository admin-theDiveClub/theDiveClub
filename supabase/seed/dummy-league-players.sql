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
-- Safe to run twice: every insert is guarded, so a second run changes nothing.
-- The cleanup at the bottom removes all of it again.

do $$
declare
	-- UV's "Test 8BMTL" 2025/2026 season. Change this to point it elsewhere.
	v_season uuid := '1c436a86-218a-4cc0-9bfa-0d577a0c6d01';

	v_names text[] := array[
		'Thabo Mokoena', 'Ashwin Pillay', 'Johan van Wyk', 'Sipho Dlamini',
		'Riaan Botha', 'Kagiso Maseko', 'Dylan Fourie', 'Nadia Abrahams',
		'Pieter Steyn', 'Lerato Ndlovu', 'Shaun Naidoo', 'Bongani Khumalo',
		'Marco Ferreira', 'Tristan de Villiers', 'Zanele Mthembu',
		'Craig Petersen', 'Imraan Davids', 'Lebo Molefe', 'Werner Coetzee'
	];
	v_id    uuid;
	v_user  uuid;
	v_email text;
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

		-- Interested, and confirmed: putting your own name down is saying you
		-- are playing, which is what confirmed_at means.
		insert into public.tbl_league_season_entrants
			(league_season_id, player_id, status, confirmed_at)
		values (v_season, v_id, 'interested', now())
		on conflict (league_season_id, player_id) do update
			set status = 'interested', confirmed_at = coalesce(public.tbl_league_season_entrants.confirmed_at, now());
	end loop;

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
