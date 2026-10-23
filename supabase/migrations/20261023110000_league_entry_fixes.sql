-- Two corrections from UV testing a real league, 23 Oct.
--
-- 1. **"Paid also confirms" only half did.** Ticking a player as paid put
--    them into the league but left confirmed_at empty, so the Confirmed
--    column stayed blank — the opposite of what the setting says. A director
--    who confirms on payment has their evidence; making the player say it
--    again is asking the same question twice.
--
-- 2. **Confirmation is no longer a gate on the fixtures.** UV: "It is not a
--    requirement that every active player has confirmed. I already added my
--    personal profile to the league and marked as a captain. I should be able
--    to start the league regardless."
--
--    That reverses the 22 Oct rule *for generating fixtures only*. The
--    confirmation itself stays, and so does everything that reads it: the
--    readiness panel still says who is outstanding, and the pages still show
--    it. It is something a director is told, not something they are stopped
--    for. A director who knows their players should not be held up by
--    somebody who has not opened the app.
--
--    The one gate that remains is a team with nobody on it, because a fixture
--    against an empty team cannot be played. That check no longer asks
--    whether those players have confirmed either.
--
-- Both patched from their live definitions.

CREATE OR REPLACE FUNCTION public.tdc_set_league_entrant(p_entrant_id uuid, p_status text DEFAULT NULL::text, p_team_id uuid DEFAULT NULL::uuid, p_clear_team boolean DEFAULT false, p_is_captain boolean DEFAULT NULL::boolean, p_paid boolean DEFAULT NULL::boolean, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_e       public.tbl_league_season_entrants%rowtype;
	v_team    uuid;
	v_captain boolean;
	v_status  text;
	v_paid_ok boolean;
	v_paid_confirmed boolean := false;
begin
	select * into v_e from public.tbl_league_season_entrants where id = p_entrant_id;
	if v_e.id is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_league(v_e.league_season_id) then
		raise exception 'Only the people running this league can change entrants.';
	end if;

	if p_status is not null and p_status not in ('interested', 'active', 'inactive', 'withdrawn', 'suspended') then
		raise exception 'TDC (Error): unknown entrant status "%".', p_status;
	end if;

	v_team := case when p_clear_team then null else coalesce(p_team_id, v_e.team_id) end;

	if v_team is not null and not exists (
		select 1 from public.tbl_teams where id = v_team and league_season_id = v_e.league_season_id
	) then
		raise exception 'That team is not in this league season.';
	end if;

	v_captain := case
		when p_is_captain is not null then p_is_captain
		when v_team is distinct from v_e.team_id then false
		else v_e.is_captain
	end;

	if v_captain and v_team is null then
		raise exception 'A captain needs a team.';
	end if;

	-- Ticking somebody as paid confirms them, when the season is set up that
	-- way. The same idea as a tournament's paid_confirms: for a league whose
	-- entry criterion simply is payment, the director should tick one box
	-- rather than two.
	select ls.paid_confirms into v_paid_ok
	from public.tbl_league_seasons ls where ls.id = v_e.league_season_id;

	v_status := coalesce(p_status, v_e.status);
	if coalesce(p_paid, false) and coalesce(v_paid_ok, false) then
		-- Somebody waiting is brought in; somebody already in simply stays.
		if v_status in ('interested', 'inactive') then
			v_status := 'active';
		end if;
		-- And either way they are confirmed, which is the half that was
		-- missing: a director who ticks paid on a player they added by hand
		-- had nothing happen at all, because that player was already active.
		-- Withdrawing or suspending somebody is not a moment to confirm them.
		if v_status not in ('withdrawn', 'suspended') then
			v_paid_confirmed := true;
		end if;
	end if;

	update public.tbl_league_season_entrants
	set status     = v_status,
		-- "Paid also confirms" means confirmed, not half confirmed. It was
		-- putting the player into the league and leaving the Confirmed column
		-- empty, which is the opposite of what the setting says (UV, 23 Oct).
		-- A director who confirms on payment has their evidence; making the
		-- player say it again is asking twice.
		confirmed_at = case
			when status = 'withdrawn' and v_status <> 'withdrawn' then null
			when v_paid_confirmed then coalesce(confirmed_at, now())
			else confirmed_at end,
		team_id    = v_team,
		is_captain = v_captain,
		paid_at    = case
			when p_paid is null then paid_at
			when p_paid then coalesce(paid_at, now())
			else null
		end,
		notes      = coalesce(p_notes, notes)
	where id = p_entrant_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tdc_generate_league_fixtures(p_league_season_id uuid, p_times_played integer DEFAULT 1, p_first_round_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_days_between integer DEFAULT 7, p_replace boolean DEFAULT false, p_detach_matches boolean DEFAULT false)
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
			v_round := (v_cycle - 1) * v_rounds + v_r;
			v_when  := case when p_first_round_at is not null
				then p_first_round_at + ((v_round - 1) * coalesce(p_days_between, 7)) * interval '1 day'
			end;

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

				insert into public.tbl_league_fixtures
					(created_by, league_season_id, round, position, home_team_id, away_team_id, scheduled_at)
				values
					((select auth.uid()), p_league_season_id, v_round, v_i, v_home, v_away, v_when);

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
