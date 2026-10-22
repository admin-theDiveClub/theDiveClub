-- Leagues step 3: the fixture list, and the team match.
--
-- A league season's fixtures are a round robin: every team plays every other,
-- once or several times. The generator is the circle method — one team held
-- still while the rest rotate around it — which is the standard way to get
-- every pairing exactly once with nobody playing twice in a round.
--
-- Three things make this different from a tournament draw:
--
--   1. **Nothing is derived from a result.** A tournament's round 2 depends on
--      who won round 1, which is why tbl_tournament_fixtures carries source
--      types and a cascade. A league's whole schedule is known the moment the
--      teams are. There is no winner_of here and never will be.
--   2. **A bye is a row.** With an odd number of teams somebody sits out each
--      round, and "who do we play this week" deserves the answer "nobody" in
--      the same list as every other answer. A bye is a fixture with no away
--      team, and it can never have a match.
--   3. **The sides are teams, not players.** The match this creates is the
--      first team match in the system: home_side_kind = 'team'.
--
-- The generator refuses unless the season is ready — every active player has
-- confirmed (20261022190000). That is the point of confirmation: a schedule
-- built on people who have not said they are playing is a schedule that gets
-- rebuilt. It also refuses while any team is empty, because a fixture against
-- a team with nobody in it cannot be played.
--
-- Nothing here notifies anybody. A freshly generated schedule is the league
-- director's working document and regenerating it is ordinary, so telling the
-- players is a separate act, as sharing a tournament poster is.

create table public.tbl_league_fixtures (
	id               uuid primary key default gen_random_uuid(),
	created_at       timestamptz not null default now(),
	created_by       uuid references auth.users (id) on delete set null,

	league_season_id uuid not null references public.tbl_league_seasons (id) on delete cascade,

	-- Which week of the season, and the order within that week. Position is
	-- presentation, not precedence: the fixtures of a round are played on the
	-- same night, on whatever tables come free.
	round            integer not null check (round >= 1),
	position         integer not null check (position >= 1),

	-- The two sides. A null away team is a bye for the home team, which is why
	-- the home side is the one that is never null: a bye row always names the
	-- team that is sitting out.
	home_team_id     uuid not null,
	away_team_id     uuid,

	-- The match, once there is one. Set null on delete rather than cascade:
	-- deleting a match should not take the fixture with it, because the
	-- fixture is the thing that says the game exists.
	match_id         uuid references public.tbl_matches (id) on delete set null,

	-- When this one is played. Starts from the round's date and is moved per
	-- fixture, because a rearranged game is the most ordinary thing in a
	-- league.
	scheduled_at     timestamptz,
	notes            text,

	constraint tbl_league_fixtures_one_per_slot unique (league_season_id, round, position),

	-- Both teams have to be in this season. The composite keys make a
	-- cross-season fixture impossible by any path, not only through the
	-- functions — the same guard the entrant row has.
	constraint tbl_league_fixtures_home_in_season
		foreign key (home_team_id, league_season_id)
		references public.tbl_teams (id, league_season_id) on delete cascade,
	constraint tbl_league_fixtures_away_in_season
		foreign key (away_team_id, league_season_id)
		references public.tbl_teams (id, league_season_id) on delete cascade,

	constraint tbl_league_fixtures_teams_differ
		check (away_team_id is null or home_team_id <> away_team_id),

	-- A bye is not played by anybody.
	constraint tbl_league_fixtures_bye_has_no_match
		check (away_team_id is not null or match_id is null)
);

create index tbl_league_fixtures_season_idx on public.tbl_league_fixtures (league_season_id, round, position);
create index tbl_league_fixtures_home_idx   on public.tbl_league_fixtures (home_team_id);
create index tbl_league_fixtures_away_idx   on public.tbl_league_fixtures (away_team_id);
create index tbl_league_fixtures_match_idx  on public.tbl_league_fixtures (match_id);

comment on table public.tbl_league_fixtures is
	'The round-robin schedule of a league season. A row with no away team is a bye. Nothing here is derived from a result, unlike a tournament draw.';

-- Reading is open to signed-in users, as the tournament draw is: a fixture
-- list is not secret, and a player needs to see rounds they are not in.
-- Writing goes through the functions below.
alter table public.tbl_league_fixtures enable row level security;

create policy "Signed-in users can see league fixtures"
	on public.tbl_league_fixtures
	for select
	to authenticated
	using (true);

grant select on public.tbl_league_fixtures to authenticated;
grant select, insert, update, delete on public.tbl_league_fixtures to service_role;

-- ── Generating ──

create function public.tdc_clear_league_fixtures(
	p_league_season_id uuid,
	p_detach_matches   boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_n      integer;
	v_played integer;
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can clear its fixtures.';
	end if;

	select count(*) into v_played
	from public.tbl_league_fixtures
	where league_season_id = p_league_season_id and match_id is not null;

	-- Same shape as tdc_clear_draw: the matches are kept, but they stop being
	-- part of a schedule, and that is worth being asked about once.
	if v_played > 0 and not p_detach_matches then
		raise exception
			'This season has already started: % % attached to the fixtures. Clearing keeps % (nothing is deleted) but takes the schedule away. Confirm to go ahead.',
			v_played,
			case when v_played = 1 then 'match is' else 'matches are' end,
			case when v_played = 1 then 'it' else 'them' end;
	end if;

	delete from public.tbl_league_fixtures where league_season_id = p_league_season_id;
	get diagnostics v_n = row_count;
	return v_n;
end;
$$;

revoke execute on function public.tdc_clear_league_fixtures(uuid, boolean) from public, anon;
grant execute on function public.tdc_clear_league_fixtures(uuid, boolean) to authenticated;

create function public.tdc_generate_league_fixtures(
	p_league_season_id uuid,
	p_times_played     integer     default 1,
	p_first_round_at   timestamptz default null,
	p_days_between     integer     default 7,
	p_replace          boolean     default false,
	p_detach_matches   boolean     default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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

	-- The whole reason confirmation exists. A schedule built on people who
	-- have not said they are playing is a schedule that gets rebuilt.
	if not private.tdc_league_ready(p_league_season_id) then
		raise exception 'Not everybody has confirmed yet. The fixtures can be generated once every active player has said they are playing.';
	end if;

	if exists (select 1 from public.tbl_league_fixtures where league_season_id = p_league_season_id)
		and not p_replace then
		raise exception 'This season already has fixtures. Clear them first, or ask to replace them.';
	end if;

	-- A team with nobody in it cannot play, and a schedule containing one is
	-- wrong from the moment it is made rather than on the night.
	select array_agg(t.name order by lower(t.name)) into v_empty
	from public.tbl_teams t
	where t.league_season_id = p_league_season_id
		and not exists (
			select 1 from public.tbl_league_season_entrants e
			where e.team_id = t.id and e.status = 'active' and e.confirmed_at is not null
		);

	if v_empty is not null then
		raise exception 'These teams have no confirmed players yet: %. Every team needs at least one before the fixtures can be generated.',
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
$$;

revoke execute on function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean) from public, anon;
grant execute on function public.tdc_generate_league_fixtures(uuid, integer, timestamptz, integer, boolean, boolean) to authenticated;

-- ── One fixture at a time ──
-- A league rearranges games constantly, so adding, moving and removing one by
-- hand is ordinary work rather than a repair.

create function public.tdc_add_league_fixture(
	p_league_season_id uuid,
	p_round            integer,
	p_home_team_id     uuid,
	p_away_team_id     uuid        default null,
	p_scheduled_at     timestamptz default null,
	p_notes            text        default null
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
		(created_by, league_season_id, round, position, home_team_id, away_team_id, scheduled_at, notes)
	values
		((select auth.uid()), p_league_season_id, p_round, v_pos,
		 p_home_team_id, p_away_team_id, p_scheduled_at, p_notes)
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text) to authenticated;

create function public.tdc_set_league_fixture(
	p_fixture_id     uuid,
	p_home_team_id   uuid        default null,
	p_away_team_id   uuid        default null,
	p_clear_away     boolean     default false,
	p_scheduled_at   timestamptz default null,
	p_clear_schedule boolean     default false,
	p_notes          text        default null
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
		notes        = coalesce(p_notes, notes)
	where id = p_fixture_id;
end;
$$;

revoke execute on function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text) from public, anon;
grant execute on function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text) to authenticated;

create function public.tdc_remove_league_fixture(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f public.tbl_league_fixtures%rowtype;
begin
	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can remove a fixture.';
	end if;

	-- The match is the record of a game that happened. A fixture with one
	-- attached is not a scheduling mistake any more.
	if v_f.match_id is not null then
		raise exception 'This fixture has a match. Take the match off it first.';
	end if;

	delete from public.tbl_league_fixtures where id = p_fixture_id;
end;
$$;

revoke execute on function public.tdc_remove_league_fixture(uuid) from public, anon;
grant execute on function public.tdc_remove_league_fixture(uuid) to authenticated;

-- ── The team match ──
--
-- The first match in the system with teams on both sides. The columns and the
-- check constraints for it shipped on 14 Oct and the foreign keys on 22 Oct;
-- this is the first thing that writes one.
--
-- Nothing can score it yet: the lineups, the frames and the captain's
-- scorecard are steps 4 to 6, and the match page refuses to load a team match
-- until they exist. That is why this notifies nobody — a message saying a
-- match is ready, pointing at a page that cannot open it, would be a lie.

create function public.tdc_create_league_match(p_fixture_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f  public.tbl_league_fixtures%rowtype;
	v_l  public.tbl_leagues%rowtype;
	v_id uuid;
begin
	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can start its matches.';
	end if;

	-- Idempotent, like the tournament one: pressing it twice is one match.
	if v_f.match_id is not null then
		return v_f.match_id;
	end if;

	if v_f.away_team_id is null then
		raise exception 'This is a bye — there is nobody to play.';
	end if;

	select l.* into v_l
	from public.tbl_leagues l
	join public.tbl_league_seasons s on s.league_id = l.id
	where s.id = v_f.league_season_id;

	insert into public.tbl_matches (
		created_by, venue_id, scheduled_at, rules,
		home_side_kind, home_team_id,
		away_side_kind, away_team_id
	)
	values (
		(select auth.uid()), v_l.venue_id, v_f.scheduled_at,
		-- The moment the season's rules are frozen onto a match. The merge of
		-- the league's ruleset with the season's overrides is done in one
		-- place, and this is the only caller that needs to know that.
		private.tdc_rules_for_league_season(v_f.league_season_id),
		'team', v_f.home_team_id,
		'team', v_f.away_team_id
	)
	returning id into v_id;

	update public.tbl_league_fixtures set match_id = v_id where id = p_fixture_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_league_match(uuid) from public, anon;
grant execute on function public.tdc_create_league_match(uuid) to authenticated;

create function public.tdc_detach_league_match(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f public.tbl_league_fixtures%rowtype;
begin
	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can take a match off a fixture.';
	end if;

	-- The match is kept. It stops being part of the schedule, which is what a
	-- director wants when a night was set up against the wrong teams; deleting
	-- the record of frames that were played is never what they want.
	update public.tbl_league_fixtures set match_id = null where id = p_fixture_id;
end;
$$;

revoke execute on function public.tdc_detach_league_match(uuid) from public, anon;
grant execute on function public.tdc_detach_league_match(uuid) to authenticated;

-- ── Reading ──

create function public.tdc_league_fixtures(p_league_season_id uuid)
returns table (
	fixture_id   uuid,
	round        integer,
	"position"   integer,
	scheduled_at timestamptz,
	home_team_id uuid,
	home_name    text,
	away_team_id uuid,
	away_name    text,
	is_bye       boolean,
	match_id     uuid,
	match_status text,
	home_frames  integer,
	away_frames  integer,
	notes        text
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
		f.notes
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
