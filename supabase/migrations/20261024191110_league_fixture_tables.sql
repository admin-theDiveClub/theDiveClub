-- Fixtures carry their table numbers, and a night can hold more than one
-- match per team (UV, 24 Oct).
--
--   * tbl_league_fixtures.table_numbers — the venue's tables a fixture is
--     played on, e.g. {1,2} for a fixture on two tables. Empty for none set,
--     and always empty is fine: nothing reads it but the fixtures page.
--
--   * tdc_generate_league_fixtures gains p_matches_per_round and
--     p_tables_per_match. With 2 matches per round, two passes of the round
--     robin share one night and one round number, so each team plays twice
--     that night (a bye counts as one of them). Positions run on through the
--     night, the first pass first.
--
--     Tables are numbered per pass: with 2 tables a match, the first pass's
--     fixtures get {1,2}, {3,4}, {5,6} and the second pass starts at {1,2}
--     again, because a team's second match follows its first and the tables
--     are free by then. A bye gets none.
--
--   * tdc_add_league_fixture and tdc_set_league_fixture take
--     p_table_numbers. The page works out what to send; neither function
--     invents numbers.
--
--   * tdc_league_fixtures returns table_numbers.
--
-- Each function's arguments or result change, so each is dropped and made
-- again from its latest text (20261023110000 for the generator,
-- 20261022210000 for the rest), patched, not retyped. No player is referenced,
-- so private.tdc_merge_players is unaffected.

alter table public.tbl_league_fixtures
	add column table_numbers integer[] not null default '{}';

alter table public.tbl_league_fixtures
	add constraint tbl_league_fixtures_table_numbers_check
	check (cardinality(table_numbers) <= 20 and 0 < all(table_numbers));

comment on column public.tbl_league_fixtures.table_numbers is
	'The venue tables this fixture is played on. Empty when none are set. Filled by tdc_generate_league_fixtures (p_tables_per_match) and changed on the fixtures page.';


-- ── Generating ──

drop function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean);

CREATE FUNCTION public.tdc_generate_league_fixtures(p_league_season_id uuid, p_times_played integer DEFAULT 1, p_first_round_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_days_between integer DEFAULT 7, p_replace boolean DEFAULT false, p_detach_matches boolean DEFAULT false, p_matches_per_round integer DEFAULT 1, p_tables_per_match integer DEFAULT 0)
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
			v_played := 0;

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

				-- The next v_tables tables of this pass; a bye plays on none.
				v_nums := '{}';
				if v_away is not null and v_tables > 0 then
					v_played := v_played + 1;
					select array_agg(g order by g) into v_nums
					from generate_series((v_played - 1) * v_tables + 1, v_played * v_tables) g;
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

revoke execute on function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean, integer, integer) from public, anon;
grant execute on function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean, integer, integer) to authenticated;


-- ── Adding one by hand ──

drop function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text);

create function public.tdc_add_league_fixture(
	p_league_season_id uuid,
	p_round            integer,
	p_home_team_id     uuid,
	p_away_team_id     uuid        default null,
	p_scheduled_at     timestamptz default null,
	p_notes            text        default null,
	p_table_numbers    integer[]   default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_pos integer;
	v_id  uuid;
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can add a fixture.';
	end if;

	if p_round is null or p_round < 1 then
		raise exception 'TDC (Error): a fixture needs a round of 1 or more.';
	end if;

	if p_home_team_id is null then
		raise exception 'A fixture needs a team. For a bye, give the team that is sitting out and leave the other side empty.';
	end if;

	-- Said here rather than left to the foreign key, which would come back as
	-- a constraint name nobody can act on.
	if not exists (select 1 from public.tbl_teams
		where id = p_home_team_id and league_season_id = p_league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;
	if p_away_team_id is not null and not exists (select 1 from public.tbl_teams
		where id = p_away_team_id and league_season_id = p_league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;
	if p_away_team_id = p_home_team_id then
		raise exception 'A team cannot play itself.';
	end if;

	select coalesce(max(position), 0) + 1 into v_pos
	from public.tbl_league_fixtures
	where league_season_id = p_league_season_id and round = p_round;

	insert into public.tbl_league_fixtures
		(created_by, league_season_id, round, position, home_team_id, away_team_id, scheduled_at, notes, table_numbers)
	values
		((select auth.uid()), p_league_season_id, p_round, v_pos,
		 p_home_team_id, p_away_team_id, p_scheduled_at, p_notes, coalesce(p_table_numbers, '{}'))
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text, integer[]) from public, anon;
grant execute on function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text, integer[]) to authenticated;


-- ── Changing one ──

drop function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text);

create function public.tdc_set_league_fixture(
	p_fixture_id     uuid,
	p_home_team_id   uuid        default null,
	p_away_team_id   uuid        default null,
	p_clear_away     boolean     default false,
	p_scheduled_at   timestamptz default null,
	p_clear_schedule boolean     default false,
	p_notes          text        default null,
	p_table_numbers  integer[]   default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f    public.tbl_league_fixtures%rowtype;
	v_home uuid;
	v_away uuid;
begin
	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can change a fixture.';
	end if;

	v_home := coalesce(p_home_team_id, v_f.home_team_id);
	v_away := case when p_clear_away then null else coalesce(p_away_team_id, v_f.away_team_id) end;

	-- Changing who plays after the match exists would leave the match naming
	-- one pair of teams and the fixture another.
	if v_f.match_id is not null and (v_home is distinct from v_f.home_team_id
		or v_away is distinct from v_f.away_team_id) then
		raise exception 'This fixture already has a match. Take the match off it before changing who is playing.';
	end if;

	if v_home is null then
		raise exception 'A fixture needs a team.';
	end if;
	if v_home = v_away then
		raise exception 'A team cannot play itself.';
	end if;
	if not exists (select 1 from public.tbl_teams
		where id = v_home and league_season_id = v_f.league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;
	if v_away is not null and not exists (select 1 from public.tbl_teams
		where id = v_away and league_season_id = v_f.league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;

	update public.tbl_league_fixtures
	set home_team_id = v_home,
		away_team_id = v_away,
		scheduled_at = case when p_clear_schedule then null else coalesce(p_scheduled_at, scheduled_at) end,
		notes        = coalesce(p_notes, notes),
		table_numbers = coalesce(p_table_numbers, table_numbers)
	where id = p_fixture_id;
end;
$$;

revoke execute on function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text, integer[]) from public, anon;
grant execute on function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text, integer[]) to authenticated;


-- ── Reading ──

drop function public.tdc_league_fixtures(uuid);

create function public.tdc_league_fixtures(p_league_season_id uuid)
returns table (
	fixture_id    uuid,
	round         integer,
	"position"    integer,
	scheduled_at  timestamptz,
	home_team_id  uuid,
	home_name     text,
	away_team_id  uuid,
	away_name     text,
	is_bye        boolean,
	match_id      uuid,
	match_status  text,
	home_frames   integer,
	away_frames   integer,
	notes         text,
	table_numbers integer[]
)
language sql
stable
security definer
set search_path = ''
as $$
	select f.id, f.round, f."position", f.scheduled_at,
		f.home_team_id, h.name,
		f.away_team_id, a.name,
		f.away_team_id is null,
		f.match_id, m.status,
		s.home_score, s.away_score,
		f.notes,
		f.table_numbers
	from public.tbl_league_fixtures f
	join public.tbl_teams h on h.id = f.home_team_id
	left join public.tbl_teams a on a.id = f.away_team_id
	left join public.tbl_matches m on m.id = f.match_id
	left join lateral private.tdc_match_score(f.match_id) s on f.match_id is not null
	where (select auth.uid()) is not null
		and f.league_season_id = p_league_season_id
	order by f.round, f."position";
$$;

revoke execute on function public.tdc_league_fixtures(uuid) from public, anon;
grant execute on function public.tdc_league_fixtures(uuid) to authenticated;
