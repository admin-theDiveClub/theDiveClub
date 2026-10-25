-- Tables available (UV, 25 Oct): how many tables the venue has for a night.
--
--   tdc_generate_league_fixtures gains p_tables_available (null for no limit,
--   as before; otherwise 1 to 99). Tables are still numbered on through the
--   night, p_tables_per_match to a fixture, but never past the last table
--   available: a fixture that reaches it gets what is left (UV: fill what is
--   left), and every fixture after it on that night gets none, for the
--   director to give tables by hand. Used for this Generate only; nothing is
--   stored (UV).
--
-- Patched from its text in 20261024194237: the parameter, its check, and the
-- cap on the numbers. A new parameter changes the signature, so dropped and
-- recreated, and its grants redone.

drop function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean, integer, integer);

CREATE FUNCTION public.tdc_generate_league_fixtures(p_league_season_id uuid, p_times_played integer DEFAULT 1, p_first_round_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_days_between integer DEFAULT 7, p_replace boolean DEFAULT false, p_detach_matches boolean DEFAULT false, p_matches_per_round integer DEFAULT 1, p_tables_per_match integer DEFAULT 0, p_tables_available integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_teams  uuid[];
	v_list   uuid[];
	v_empty  text[];
	v_n      integer;
	v_half   integer;
	v_rounds integer;
	v_cycle  integer;
	v_round  integer;
	v_r      integer;
	v_i      integer;
	v_a      uuid;
	v_b      uuid;
	v_home   uuid;
	v_away   uuid;
	v_when   timestamptz;
	v_made   integer := 0;
	-- 24 Oct: several passes of the round robin to a night, and tables.
	v_per    integer := coalesce(p_matches_per_round, 1);
	v_tables integer := coalesce(p_tables_per_match, 0);
	v_night  integer;
	v_slot   integer;
	v_played integer;
	v_nums   integer[];
	-- 25 Oct: the venue's tables for a night; null for no limit.
	v_avail  integer := p_tables_available;
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can generate its fixtures.';
	end if;

	if coalesce(p_times_played, 1) < 1 or coalesce(p_times_played, 1) > 4 then
		raise exception 'Teams can play each other between one and four times, not %.', p_times_played;
	end if;

	if coalesce(p_days_between, 7) < 0 or coalesce(p_days_between, 7) > 365 then
		raise exception 'TDC (Error): days between rounds must be between 0 and 365.';
	end if;

	if v_per < 1 or v_per > 6 then
		raise exception 'Each team can play between one and six matches a round, not %.', p_matches_per_round;
	end if;

	if v_tables < 0 or v_tables > 20 then
		raise exception 'A match can be played on up to 20 tables, not %.', p_tables_per_match;
	end if;

	if v_avail is not null and (v_avail < 1 or v_avail > 99) then
		raise exception 'A venue can have between 1 and 99 tables available, not %. Leave it blank for no limit.', v_avail;
	end if;

	-- Confirmation used to refuse this outright. UV, 23 Oct: "It is not a
	-- requirement that every active player has confirmed. I should be able to
	-- start the league regardless." He is right — a director who knows their
	-- players should not be held up by somebody who has not opened the app.
	--
	-- private.tdc_league_ready and tdc_league_season_readiness still answer
	-- the question, and the pages still show who is outstanding. It is
	-- something a director is told, not something they are stopped for.

	if exists (select 1 from public.tbl_league_fixtures where league_season_id = p_league_season_id)
		and not p_replace then
		raise exception 'This season already has fixtures. Clear them first, or ask to replace them.';
	end if;

	-- A team with nobody in it cannot play, and a schedule containing one is
	-- wrong from the moment it is made rather than on the night.
	-- A team with nobody on it cannot play, and a schedule containing one is
	-- wrong from the moment it is made. Whether those players have confirmed
	-- is a different question, and no longer this one.
	select array_agg(t.name order by lower(t.name)) into v_empty
	from public.tbl_teams t
	where t.league_season_id = p_league_season_id
		and not exists (
			select 1 from public.tbl_league_season_entrants e
			where e.team_id = t.id and e.status = 'active'
		);

	if v_empty is not null then
		raise exception 'These teams have nobody in them: %. Every team needs at least one player before the fixtures can be generated.',
			array_to_string(v_empty, ', ');
	end if;

	select array_agg(t.id order by lower(t.name), t.id) into v_teams
	from public.tbl_teams t where t.league_season_id = p_league_season_id;

	v_n := coalesce(array_length(v_teams, 1), 0);
	if v_n < 2 then
		raise exception 'A league needs at least two teams before there is anything to schedule.';
	end if;

	-- An odd field gets a phantom team. Whoever is drawn against it has a bye
	-- that round, which is a fixture row like any other so that "who do we
	-- play this week" always has an answer.
	if v_n % 2 = 1 then
		v_teams := v_teams || array[null::uuid];
		v_n := v_n + 1;
	end if;

	v_half   := v_n / 2;
	v_rounds := v_n - 1;

	if p_replace then
		perform public.tdc_clear_league_fixtures(p_league_season_id, p_detach_matches);
	end if;

	for v_cycle in 1 .. p_times_played loop
		-- Each cycle starts from the same order, so cycle 2 produces the same
		-- pairings as cycle 1 — with the sides swapped below, which is what
		-- makes a double round home-and-away.
		v_list := v_teams;

		for v_r in 1 .. v_rounds loop
			-- v_round counts passes of the round robin. v_per of them share a
			-- night: that night is the round a fixture is filed under, and v_slot
			-- is which pass of the night this is.
			v_round := (v_cycle - 1) * v_rounds + v_r;
			v_night := (v_round - 1) / v_per + 1;
			v_slot  := (v_round - 1) % v_per;
			v_when  := case when p_first_round_at is not null
				then p_first_round_at + ((v_night - 1) * coalesce(p_days_between, 7)) * interval '1 day'
			end;
			-- Tables run on through the night (UV, 24 Oct): counted from 1 at
			-- the night's first pass only, not again at each pass.
			if v_slot = 0 then
				v_played := 0;
			end if;

			for v_i in 1 .. v_half loop
				v_a := v_list[v_i];
				v_b := v_list[v_n + 1 - v_i];

				-- The held-still team sits at position 1 every round, so
				-- without this it would be at home every single week.
				if v_i = 1 and v_r % 2 = 0 then
					v_home := v_b; v_away := v_a;
				else
					v_home := v_a; v_away := v_b;
				end if;

				-- Odd cycles as drawn, even cycles reversed: the return leg.
				if v_cycle % 2 = 0 then
					v_a := v_home; v_home := v_away; v_away := v_a;
				end if;

				-- A pairing with the phantom is a bye, and the bye row always
				-- names the real team as the home side.
				if v_home is null then
					v_home := v_away; v_away := null;
				end if;

				-- The next v_tables tables of the night; a bye plays on none.
				-- Never past the last table available (25 Oct): the fixture that
				-- reaches it gets what is left, and the night's later ones none.
				v_nums := '{}';
				if v_away is not null and v_tables > 0 then
					v_played := v_played + 1;
					select array_agg(g order by g) into v_nums
					from generate_series((v_played - 1) * v_tables + 1,
						least(v_played * v_tables, coalesce(v_avail, v_played * v_tables))) g;
					v_nums := coalesce(v_nums, '{}');
				end if;

				insert into public.tbl_league_fixtures
					(created_by, league_season_id, round, position, home_team_id, away_team_id, scheduled_at, table_numbers)
				values
					((select auth.uid()), p_league_season_id, v_night, v_slot * v_half + v_i, v_home, v_away, v_when, v_nums);

				v_made := v_made + 1;
			end loop;

			-- Rotate: the first stays where it is, the last comes round to
			-- second place, everybody else shifts up one.
			v_list := array[v_list[1]] || v_list[v_n : v_n] || v_list[2 : v_n - 1];
		end loop;
	end loop;

	return v_made;
end;
$function$;

revoke execute on function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean, integer, integer, integer) from public, anon;
grant execute on function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean, integer, integer, integer) to authenticated;
