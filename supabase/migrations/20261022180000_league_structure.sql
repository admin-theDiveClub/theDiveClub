-- Leagues, part 1: the structure.
--
-- Built to docs/design/leagues.md (settled 13 Oct). This migration is only the
-- skeleton that everything else in the league track hangs off: the league, its
-- seasons, the teams in a season, who is entered, who runs it. It deliberately
-- contains no fixtures, no lineups, no captain's scorecard and no standings —
-- each of those is its own step and none of them is needed to test this one.
--
-- ─── Where this differs from the design document, and why ───
--
-- The design was written before the match layer was built. Four places where
-- the built system had already answered a question the document was still
-- asking, followed rather than argued with:
--
--   1. "Entity" is a team. The document says home_entity_id throughout; what
--      was built is a match whose sides are each a player or a team
--      (tbl_matches.home_side_kind), with home_team_id waiting for a teams
--      table. So the entity table is tbl_teams, and this migration adds the
--      foreign keys that comment has been promising since 14 Oct.
--
--   2. Table names are plural, matching tbl_tournaments, tbl_matches and
--      tbl_frames. The document's tbl_league is tbl_leagues, and so on.
--
--   3. Team membership lives on the entrant row, not in a separate member
--      table. The design calls "who is in team X" the one question with two
--      legitimate answers (the roster, and who actually played). A second table
--      of members would add a THIRD answer to the roster half. So the roster is
--      tbl_league_season_entrants.team_id and nothing else, and a captain is a
--      flag on that same row. Scorer and coach roles were in the document's
--      member table and are left out until something needs them: a scorer is a
--      competition role (tbl_competition_roles), which already exists.
--
--   4. No status column on a league season. The tournament status column sat at
--      'draft' for two days because nothing wrote it, and a badge nobody
--      updates is a badge that gets believed (20261021120000). A league
--      season's status will be derived from its fixtures, as a tournament's is,
--      when fixtures exist. Adding the column first would recreate that bug.
--
-- ─── Also deliberately not here ───
--
--   - A discipline column on tbl_leagues. Discipline is a key in the ruleset
--     already ('discipline'), and a second copy would be two places to disagree.
--   - A sanctioned flag. Nothing sets it yet; add it when sanctioning is built.
--   - An entry fee. It is blocked on the credit ledger (no ref_table/ref_id),
--     and on the undecided question of whose fee a travelling league owes.
--     paid_at is here because a ticked box at a desk needs nowhere else to go.
--
-- ─── Teams do not persist across seasons ───
--
-- A team is created per league season. team_lineage_id links successive
-- incarnations of "the same" team without making the team itself durable: it is
-- a plain shared id, not a foreign key, because there is no lineage row for it
-- to point at and inventing one would be a table whose only content is a key.
--
-- ─── Who can read what ───
--
-- Leagues, seasons, league seasons, teams and officials hold only public facts
-- and are readable by any signed-in player. tbl_league_season_entrants is NOT:
-- it carries payment and the director's private notes, so it has no direct
-- select grant at all and is read through functions. (tbl_tournament_entrants
-- has the same two columns and still carries a select policy of true —
-- recorded in docs/STATUS.md, not changed here.)


-- ─────────────────────────────────────────────────────────────────
-- Seasons
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_seasons (
	id         uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	created_by uuid references auth.users (id) on delete set null,

	name       text not null check (char_length(trim(name)) between 2 and 80),
	starts_on  date,
	ends_on    date,

	constraint tbl_seasons_dates_in_order
		check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

alter table public.tbl_seasons enable row level security;
create policy "Signed-in users can see seasons"
	on public.tbl_seasons for select to authenticated using (true);
grant select on public.tbl_seasons to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The league: the durable identity
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_leagues (
	id         uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	created_by uuid references auth.users (id) on delete set null,

	-- Nullable on purpose, as on tbl_tournaments: anyone may run a league
	-- without a club behind them, and an approved club's staff may rescue one
	-- whose director has gone. Whose fees a league owes is NOT decided by this
	-- column — that question is open (docs/STATUS.md §5).
	venue_id   uuid references public.tbl_venues (id) on delete set null,

	name       text not null check (char_length(trim(name)) between 2 and 120),

	-- The default ruleset every season of this league starts from. Validated by
	-- the same function every match uses, so a league cannot hold a ruleset its
	-- own matches would refuse.
	rules      jsonb not null,

	notes      text
);

create index tbl_leagues_venue_idx on public.tbl_leagues (venue_id);

alter table public.tbl_leagues enable row level security;
create policy "Signed-in users can see leagues"
	on public.tbl_leagues for select to authenticated using (true);
grant select on public.tbl_leagues to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- A league in a season: what fixtures and standings will hang off
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_league_seasons (
	id         uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	created_by uuid references auth.users (id) on delete set null,

	league_id  uuid not null references public.tbl_leagues (id) on delete cascade,
	season_id  uuid not null references public.tbl_seasons (id) on delete restrict,

	name       text not null check (char_length(trim(name)) between 2 and 120),

	-- Settings this season changes from the league's. Partial on purpose: it is
	-- the one place the ruleset discipline allows a partial object, because it
	-- is merged over the league's rules before anything reads it. Flat keys, so
	-- the shallow merge (||) is exact. The merged result is what gets validated
	-- and, later, frozen onto each match at creation.
	rules_overrides jsonb not null default '{}'::jsonb
		check (jsonb_typeof(rules_overrides) = 'object'),

	notes      text,

	constraint tbl_league_seasons_once unique (league_id, season_id),
	-- Lets an entrant's (team, season) pair be checked by a foreign key, so a
	-- player cannot be put on a team from a different season by any path.
	constraint tbl_league_seasons_id_league_unique unique (id, league_id)
);

create index tbl_league_seasons_season_idx on public.tbl_league_seasons (season_id);

alter table public.tbl_league_seasons enable row level security;
create policy "Signed-in users can see league seasons"
	on public.tbl_league_seasons for select to authenticated using (true);
grant select on public.tbl_league_seasons to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Teams: one per league season
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_teams (
	id               uuid primary key default gen_random_uuid(),
	created_at       timestamptz not null default now(),
	created_by       uuid references auth.users (id) on delete set null,

	league_season_id uuid not null references public.tbl_league_seasons (id) on delete cascade,
	name             text not null check (char_length(trim(name)) between 2 and 80),

	-- Shared by every incarnation of "the same" team across seasons. Null means
	-- nobody has linked this team to an earlier one. See the header.
	team_lineage_id  uuid,

	constraint tbl_teams_id_season_unique unique (id, league_season_id)
);

create unique index tbl_teams_name_once
	on public.tbl_teams (league_season_id, lower(trim(name)));
-- One incarnation of a lineage per season.
create unique index tbl_teams_lineage_once
	on public.tbl_teams (team_lineage_id, league_season_id)
	where team_lineage_id is not null;
create index tbl_teams_lineage_idx on public.tbl_teams (team_lineage_id);

alter table public.tbl_teams enable row level security;
create policy "Signed-in users can see teams"
	on public.tbl_teams for select to authenticated using (true);
grant select on public.tbl_teams to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Who is entered, and on which team
--
-- player_id, not user_id, as for tournament entrants: a walk-in is a player
-- record with no account. Whether a walk-in MAY be a league entrant is an open
-- question in the design (leagues.md §8); the structure allows it, as the
-- tournament one does, and refusing is one line in tdc_add_league_entrant if
-- UV decides otherwise.
--
-- Unique on (league_season, player): one team at a time. A transfer is an
-- update, which is why no validity dates are needed — a frame carries the
-- player and the match carries the teams, so attribution is already right at
-- the moment of play.
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_league_season_entrants (
	id               uuid primary key default gen_random_uuid(),
	created_at       timestamptz not null default now(),
	added_by         uuid references auth.users (id) on delete set null,

	league_season_id uuid not null references public.tbl_league_seasons (id) on delete cascade,
	player_id        uuid not null references public.tbl_players (id) on delete cascade,

	-- Null for a singles league, or a player not yet placed. The composite key
	-- is what stops a player being put on a team from another season: with a
	-- null team_id the pair is skipped, with one it must match exactly.
	team_id          uuid,
	is_captain       boolean not null default false,

	status           text not null default 'active'
		check (status in ('active', 'inactive', 'withdrawn')),

	paid_at          timestamptz,
	notes            text,

	constraint tbl_league_season_entrants_once unique (league_season_id, player_id),
	constraint tbl_league_season_entrants_team_in_season
		foreign key (team_id, league_season_id)
		references public.tbl_teams (id, league_season_id),
	constraint tbl_league_season_entrants_captain_has_team
		check (not is_captain or team_id is not null)
);

create index tbl_league_season_entrants_player_idx on public.tbl_league_season_entrants (player_id);
create index tbl_league_season_entrants_team_idx   on public.tbl_league_season_entrants (team_id);

-- RLS on, no policy and no grant: payment and the director's notes live here,
-- so the table is reached only through the functions below.
alter table public.tbl_league_season_entrants enable row level security;


-- ─────────────────────────────────────────────────────────────────
-- Roles: the competition roles table learns about league seasons
--
-- Its own comment promised this ("a league season gets its own column here
-- when leagues land, which is why this is not called tournament_role"). A role
-- belongs to exactly one competition, so the old "has a tournament" check
-- becomes "has exactly one of the two".
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_competition_roles
	add column league_season_id uuid references public.tbl_league_seasons (id) on delete cascade;

alter table public.tbl_competition_roles
	drop constraint tbl_competition_roles_belongs_somewhere;
alter table public.tbl_competition_roles
	add constraint tbl_competition_roles_belongs_to_one
	check (num_nonnulls(tournament_id, league_season_id) = 1);

-- The existing unique (tournament_id, player_id, role) cannot cover these rows:
-- a null tournament_id makes every row distinct.
create unique index tbl_competition_roles_league_one_each
	on public.tbl_competition_roles (league_season_id, player_id, role)
	where league_season_id is not null;
create index tbl_competition_roles_league_idx
	on public.tbl_competition_roles (league_season_id) where league_season_id is not null;

-- The 'director' role type is shared: LD and TD are the same rank, and the rank
-- column is unique, so a second role at 100 could not exist anyway. It is named
-- "Tournament director" in the lookup and is left alone — changing it would
-- relabel the tournament officials list. League pages say "League director"
-- from the function below.


-- ─────────────────────────────────────────────────────────────────
-- Matches finally get their teams
-- ─────────────────────────────────────────────────────────────────

-- No existing match has a team side (checked 22 Oct), so these validate cleanly.
-- RESTRICT: a team with matches cannot be deleted from under them.
alter table public.tbl_matches
	add constraint tbl_matches_home_team_fkey
	foreign key (home_team_id) references public.tbl_teams (id) on delete restrict;
alter table public.tbl_matches
	add constraint tbl_matches_away_team_fkey
	foreign key (away_team_id) references public.tbl_teams (id) on delete restrict;

-- tbl_matches_sides_differ covers two players facing each other; nothing
-- covered two teams.
alter table public.tbl_matches
	add constraint tbl_matches_teams_differ
	check (home_team_id is null or home_team_id is distinct from away_team_id);

create index tbl_matches_home_team_idx on public.tbl_matches (home_team_id) where home_team_id is not null;
create index tbl_matches_away_team_idx on public.tbl_matches (away_team_id) where away_team_id is not null;

comment on column public.tbl_matches.home_team_id is 'A team in a league season. Foreign key added 20261022180000.';
comment on column public.tbl_matches.away_team_id is 'A team in a league season. Foreign key added 20261022180000.';


-- ─────────────────────────────────────────────────────────────────
-- Access
--
-- The single place that decides whether somebody runs a league season, in the
-- same spirit as private.tdc_can_run_tournament. Anything that needs an LD asks
-- this one function.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_league_season_rank(p_league_season_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(max(t.rank), 0)
	from public.tbl_competition_roles r
	join public.tbl_competition_role_types t on t.key = r.role
	join public.tbl_players p on p.id = r.player_id
	where r.league_season_id = p_league_season_id
		and p.user_id = (select auth.uid());
$$;

revoke execute on function private.tdc_league_season_rank(uuid) from public, anon;
grant  execute on function private.tdc_league_season_rank(uuid) to authenticated;


-- Running a season: its director, or staff of the venue the league belongs to.
create function private.tdc_can_run_league(p_league_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_league_season_rank(p_league_season_id) >= 100
		or exists (
			select 1
			from public.tbl_league_seasons s
			join public.tbl_leagues l on l.id = s.league_id
			where s.id = p_league_season_id
				and l.venue_id is not null
				and private.tdc_has_venue_role(l.venue_id, array['owner', 'admin', 'staff'])
		);
$$;

revoke execute on function private.tdc_can_run_league(uuid) from public, anon;
grant  execute on function private.tdc_can_run_league(uuid) to authenticated;


-- Managing the league itself, across seasons: who made it, a director of any
-- of its seasons, or staff at its venue. Needed because a new season has no
-- director yet — whoever opens it must be able to, and then becomes it.
create function private.tdc_can_manage_league(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
			select 1 from public.tbl_leagues l
			where l.id = p_league_id
				and (
					l.created_by = (select auth.uid())
					or (l.venue_id is not null
						and private.tdc_has_venue_role(l.venue_id, array['owner', 'admin', 'staff']))
				)
		)
		or exists (
			select 1 from public.tbl_league_seasons s
			where s.league_id = p_league_id
				and private.tdc_league_season_rank(s.id) >= 100
		);
$$;

revoke execute on function private.tdc_can_manage_league(uuid) from public, anon;
grant  execute on function private.tdc_can_manage_league(uuid) to authenticated;


-- The ruleset a league season plays under: the league's, with this season's
-- changes laid over it. The ONE place that merge is done. Matches freeze the
-- result at creation, so a later change here never rescores anything played.
create function private.tdc_rules_for_league_season(p_league_season_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select l.rules || s.rules_overrides
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	where s.id = p_league_season_id;
$$;

revoke execute on function private.tdc_rules_for_league_season(uuid) from public, anon;
grant  execute on function private.tdc_rules_for_league_season(uuid) to authenticated;


create function public.tdc_may_run_league(p_league_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.tdc_can_run_league(p_league_season_id); $$;

revoke execute on function public.tdc_may_run_league(uuid) from public, anon;
grant  execute on function public.tdc_may_run_league(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Creating and changing a league
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_create_league(
	p_name     text,
	p_rules    jsonb,
	p_venue_id uuid default null,
	p_notes    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	if not exists (select 1 from public.tbl_players where user_id = (select auth.uid())) then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	-- A league attached to a venue has to be run by someone who works there.
	-- Without a venue anyone may run one — the open tier, as for tournaments.
	if p_venue_id is not null
		and not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'Only staff at that venue can run a league there.';
	end if;

	perform private.tdc_check_match_rules(p_rules);

	insert into public.tbl_leagues (created_by, venue_id, name, rules, notes)
	values ((select auth.uid()), p_venue_id, trim(p_name), p_rules, p_notes)
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_league(text, jsonb, uuid, text) from public, anon;
grant  execute on function public.tdc_create_league(text, jsonb, uuid, text) to authenticated;


create function public.tdc_update_league(
	p_league_id uuid,
	p_name      text default null,
	p_rules     jsonb default null,
	p_notes     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_s record;
begin
	if not exists (select 1 from public.tbl_leagues where id = p_league_id) then
		raise exception 'TDC (Error): league % not found.', p_league_id;
	end if;

	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can change it.';
	end if;

	if p_rules is not null then
		perform private.tdc_check_match_rules(p_rules);

		-- Every season lays its own changes over these. A league rule that
		-- makes one of them invalid is refused here, not discovered when the
		-- season's first match is created.
		for v_s in
			select id, name, rules_overrides from public.tbl_league_seasons where league_id = p_league_id
		loop
			begin
				perform private.tdc_check_match_rules(p_rules || v_s.rules_overrides);
			exception when others then
				raise exception 'Those rules would leave "%" with an invalid ruleset: %', v_s.name, sqlerrm;
			end;
		end loop;
	end if;

	update public.tbl_leagues
	set name  = coalesce(trim(p_name), name),
		rules = coalesce(p_rules, rules),
		notes = coalesce(p_notes, notes)
	where id = p_league_id;
end;
$$;

revoke execute on function public.tdc_update_league(uuid, text, jsonb, text) from public, anon;
grant  execute on function public.tdc_update_league(uuid, text, jsonb, text) to authenticated;


-- Opening a season. Whoever does it becomes its director in the same
-- transaction, or nobody could change it.
create function public.tdc_create_league_season(
	p_league_id       uuid,
	p_name            text,
	p_season_name     text default null,
	p_starts_on       date default null,
	p_ends_on         date default null,
	p_season_id       uuid default null,
	p_rules_overrides jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me     uuid;
	v_league public.tbl_leagues%rowtype;
	v_season uuid := p_season_id;
	v_id     uuid;
begin
	select * into v_league from public.tbl_leagues where id = p_league_id;
	if v_league.id is null then
		raise exception 'TDC (Error): league % not found.', p_league_id;
	end if;

	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can open a season.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	p_rules_overrides := coalesce(p_rules_overrides, '{}'::jsonb);
	if jsonb_typeof(p_rules_overrides) <> 'object' then
		raise exception 'TDC (Error): the rule changes must be a json object.';
	end if;
	-- The merged result is what matches will freeze, so that is what is checked.
	-- An unknown key in the overrides shows up here as an unknown setting.
	perform private.tdc_check_match_rules(v_league.rules || p_rules_overrides);

	if v_season is null then
		insert into public.tbl_seasons (created_by, name, starts_on, ends_on)
		values ((select auth.uid()), trim(coalesce(p_season_name, p_name)), p_starts_on, p_ends_on)
		returning id into v_season;
	elsif not exists (select 1 from public.tbl_seasons where id = v_season) then
		raise exception 'TDC (Error): season % not found.', v_season;
	end if;

	if exists (
		select 1 from public.tbl_league_seasons where league_id = p_league_id and season_id = v_season
	) then
		raise exception 'This league already has a season for that period.';
	end if;

	insert into public.tbl_league_seasons (created_by, league_id, season_id, name, rules_overrides)
	values ((select auth.uid()), p_league_id, v_season, trim(p_name), p_rules_overrides)
	returning id into v_id;

	insert into public.tbl_competition_roles (created_by, league_season_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director');

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_league_season(uuid, text, text, date, date, uuid, jsonb) from public, anon;
grant  execute on function public.tdc_create_league_season(uuid, text, text, date, date, uuid, jsonb) to authenticated;


-- Changing a season's name, its rule changes or its dates. Rule changes affect
-- matches created from now on; a match already created keeps what it froze.
create function public.tdc_update_league_season(
	p_league_season_id uuid,
	p_name             text default null,
	p_rules_overrides  jsonb default null,
	p_notes            text default null,
	p_starts_on        date default null,
	p_ends_on          date default null,
	p_clear_dates      boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_s       public.tbl_league_seasons%rowtype;
	v_league  public.tbl_leagues%rowtype;
	v_shared  integer;
begin
	select * into v_s from public.tbl_league_seasons where id = p_league_season_id;
	if v_s.id is null then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can change it.';
	end if;

	select * into v_league from public.tbl_leagues where id = v_s.league_id;

	if p_rules_overrides is not null then
		if jsonb_typeof(p_rules_overrides) <> 'object' then
			raise exception 'TDC (Error): the rule changes must be a json object.';
		end if;
		perform private.tdc_check_match_rules(v_league.rules || p_rules_overrides);
	end if;

	-- Dates belong to the season row, which other leagues may share. Moving a
	-- shared period under someone else's league is refused rather than done.
	if p_clear_dates or p_starts_on is not null or p_ends_on is not null then
		select count(*) into v_shared from public.tbl_league_seasons where season_id = v_s.season_id;
		if v_shared > 1 then
			raise exception 'This period is shared with other leagues, so its dates cannot be changed from here.';
		end if;

		update public.tbl_seasons
		set starts_on = case when p_clear_dates then null else coalesce(p_starts_on, starts_on) end,
			ends_on   = case when p_clear_dates then null else coalesce(p_ends_on, ends_on) end
		where id = v_s.season_id;
	end if;

	update public.tbl_league_seasons
	set name            = coalesce(trim(p_name), name),
		rules_overrides = coalesce(p_rules_overrides, rules_overrides),
		notes           = coalesce(p_notes, notes)
	where id = p_league_season_id;
end;
$$;

revoke execute on function public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean) from public, anon;
grant  execute on function public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Teams
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_create_team(
	p_league_season_id  uuid,
	p_name              text,
	p_continues_team_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_prev    record;
	v_league  uuid;
	v_lineage uuid;
	v_id      uuid;
begin
	select league_id into v_league from public.tbl_league_seasons where id = p_league_season_id;
	if v_league is null then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can add teams.';
	end if;

	if exists (
		select 1 from public.tbl_teams
		where league_season_id = p_league_season_id and lower(trim(name)) = lower(trim(p_name))
	) then
		raise exception 'There is already a team called "%" in this season.', trim(p_name);
	end if;

	if p_continues_team_id is not null then
		select t.id, t.league_season_id, t.team_lineage_id, s.league_id
		into v_prev
		from public.tbl_teams t
		join public.tbl_league_seasons s on s.id = t.league_season_id
		where t.id = p_continues_team_id;

		if v_prev.id is null then
			raise exception 'TDC (Error): team % not found.', p_continues_team_id;
		end if;
		if v_prev.league_id is distinct from v_league then
			raise exception 'That team belongs to a different league, so this one cannot continue it.';
		end if;
		if v_prev.league_season_id = p_league_season_id then
			raise exception 'A team cannot continue another team from the same season.';
		end if;

		v_lineage := coalesce(v_prev.team_lineage_id, v_prev.id);

		if exists (
			select 1 from public.tbl_teams
			where team_lineage_id = v_lineage and league_season_id = p_league_season_id
		) then
			raise exception 'That team already has a successor in this season.';
		end if;

		-- The first link is made retrospectively: the earlier team had no
		-- lineage until something continued it.
		update public.tbl_teams set team_lineage_id = v_lineage
		where id = v_prev.id and team_lineage_id is null;
	end if;

	insert into public.tbl_teams (created_by, league_season_id, name, team_lineage_id)
	values ((select auth.uid()), p_league_season_id, trim(p_name), v_lineage)
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_team(uuid, text, uuid) from public, anon;
grant  execute on function public.tdc_create_team(uuid, text, uuid) to authenticated;


create function public.tdc_update_team(p_team_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_teams%rowtype;
begin
	select * into v_t from public.tbl_teams where id = p_team_id;
	if v_t.id is null then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	if not private.tdc_can_run_league(v_t.league_season_id) then
		raise exception 'Only the people running this league can change a team.';
	end if;

	if exists (
		select 1 from public.tbl_teams
		where league_season_id = v_t.league_season_id
			and id <> p_team_id
			and lower(trim(name)) = lower(trim(p_name))
	) then
		raise exception 'There is already a team called "%" in this season.', trim(p_name);
	end if;

	update public.tbl_teams set name = trim(p_name) where id = p_team_id;
end;
$$;

revoke execute on function public.tdc_update_team(uuid, text) from public, anon;
grant  execute on function public.tdc_update_team(uuid, text) to authenticated;


-- A team with players or matches cannot be deleted from under them. The
-- foreign keys would refuse too, but with a message nobody can act on.
create function public.tdc_delete_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_teams%rowtype;
begin
	select * into v_t from public.tbl_teams where id = p_team_id;
	if v_t.id is null then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	if not private.tdc_can_run_league(v_t.league_season_id) then
		raise exception 'Only the people running this league can remove a team.';
	end if;

	if exists (select 1 from public.tbl_league_season_entrants where team_id = p_team_id) then
		raise exception 'This team still has players on it. Move or remove them first.';
	end if;

	if exists (
		select 1 from public.tbl_matches where home_team_id = p_team_id or away_team_id = p_team_id
	) then
		raise exception 'This team has matches. A team that has played cannot be deleted.';
	end if;

	delete from public.tbl_teams where id = p_team_id;
end;
$$;

revoke execute on function public.tdc_delete_team(uuid) from public, anon;
grant  execute on function public.tdc_delete_team(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Entrants
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_add_league_entrant(
	p_league_season_id uuid,
	p_player_id        uuid,
	p_team_id          uuid default null,
	p_is_captain       boolean default false,
	p_status           text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id uuid;
begin
	if not exists (select 1 from public.tbl_league_seasons where id = p_league_season_id) then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can add entrants.';
	end if;

	if not exists (select 1 from public.tbl_players where id = p_player_id) then
		raise exception 'TDC (Error): no player with id %.', p_player_id;
	end if;

	if p_status not in ('active', 'inactive', 'withdrawn') then
		raise exception 'TDC (Error): unknown entrant status "%".', p_status;
	end if;

	if p_team_id is not null and not exists (
		select 1 from public.tbl_teams where id = p_team_id and league_season_id = p_league_season_id
	) then
		raise exception 'That team is not in this league season.';
	end if;

	if coalesce(p_is_captain, false) and p_team_id is null then
		raise exception 'A captain needs a team.';
	end if;

	-- Idempotent, like the tournament one: adding someone already entered
	-- brings a withdrawal back and fills in a team they did not have, but never
	-- moves a placed player (that is tdc_set_league_entrant, which says so) and
	-- never takes a captaincy away.
	insert into public.tbl_league_season_entrants as e
		(added_by, league_season_id, player_id, team_id, is_captain, status)
	values
		((select auth.uid()), p_league_season_id, p_player_id, p_team_id, coalesce(p_is_captain, false), p_status)
	on conflict (league_season_id, player_id) do update
		set status     = excluded.status,
			team_id    = coalesce(e.team_id, excluded.team_id),
			is_captain = e.is_captain or (excluded.is_captain and coalesce(e.team_id, excluded.team_id) = excluded.team_id)
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_add_league_entrant(uuid, uuid, uuid, boolean, text) from public, anon;
grant  execute on function public.tdc_add_league_entrant(uuid, uuid, uuid, boolean, text) to authenticated;


-- Changing an entrant: status, team, captaincy, payment, notes. Moving to a
-- different team is the transfer, and it drops the captaincy unless it is
-- asked for again — a captain of one team is not automatically the captain of
-- the next.
create function public.tdc_set_league_entrant(
	p_entrant_id uuid,
	p_status     text default null,
	p_team_id    uuid default null,
	p_clear_team boolean default false,
	p_is_captain boolean default null,
	p_paid       boolean default null,
	p_notes      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_e       public.tbl_league_season_entrants%rowtype;
	v_team    uuid;
	v_captain boolean;
begin
	select * into v_e from public.tbl_league_season_entrants where id = p_entrant_id;
	if v_e.id is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_league(v_e.league_season_id) then
		raise exception 'Only the people running this league can change entrants.';
	end if;

	if p_status is not null and p_status not in ('active', 'inactive', 'withdrawn') then
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

	update public.tbl_league_season_entrants
	set status     = coalesce(p_status, status),
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
$$;

revoke execute on function public.tdc_set_league_entrant(uuid, text, uuid, boolean, boolean, boolean, text) from public, anon;
grant  execute on function public.tdc_set_league_entrant(uuid, text, uuid, boolean, boolean, boolean, text) to authenticated;


-- Removing an entrant outright. Withdrawing is the usual way out, because the
-- record of who was on a team is worth keeping; this exists for a mistake.
-- Once fixtures exist this should refuse for anyone who has played, as the
-- tournament one should have — noted rather than guessed at while there is
-- nothing to check against.
create function public.tdc_remove_league_entrant(p_entrant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_league_season uuid;
begin
	select league_season_id into v_league_season
	from public.tbl_league_season_entrants where id = p_entrant_id;

	if v_league_season is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_league(v_league_season) then
		raise exception 'Only the people running this league can remove entrants.';
	end if;

	delete from public.tbl_league_season_entrants where id = p_entrant_id;
end;
$$;

revoke execute on function public.tdc_remove_league_entrant(uuid) from public, anon;
grant  execute on function public.tdc_remove_league_entrant(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Officials
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_add_league_role(p_league_season_id uuid, p_player_id uuid, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id uuid;
begin
	if not exists (select 1 from public.tbl_league_seasons where id = p_league_season_id) then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can appoint its officials.';
	end if;

	if not exists (select 1 from public.tbl_competition_role_types where key = p_role) then
		raise exception 'TDC (Error): there is no role called %.', p_role;
	end if;

	if not exists (select 1 from public.tbl_players where id = p_player_id) then
		raise exception 'TDC (Error): no player with id %.', p_player_id;
	end if;

	insert into public.tbl_competition_roles (created_by, league_season_id, player_id, role)
	values ((select auth.uid()), p_league_season_id, p_player_id, p_role)
	on conflict (league_season_id, player_id, role) where league_season_id is not null
		do update set role = excluded.role
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_add_league_role(uuid, uuid, text) from public, anon;
grant  execute on function public.tdc_add_league_role(uuid, uuid, text) to authenticated;


create function public.tdc_remove_league_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_r public.tbl_competition_roles%rowtype;
begin
	select * into v_r from public.tbl_competition_roles
	where id = p_role_id and league_season_id is not null;
	if v_r.id is null then
		raise exception 'TDC (Error): league role % not found.', p_role_id;
	end if;

	if not private.tdc_can_run_league(v_r.league_season_id) then
		raise exception 'Only the people running this league can remove its officials.';
	end if;

	-- Same refusal as the tournament one: a season with no director and no venue
	-- behind it could never be changed by anybody again.
	if v_r.role = 'director' and not exists (
		select 1 from public.tbl_competition_roles
		where league_season_id = v_r.league_season_id and role = 'director' and id <> p_role_id
	) and (
		select l.venue_id from public.tbl_league_seasons s
		join public.tbl_leagues l on l.id = s.league_id
		where s.id = v_r.league_season_id
	) is null then
		raise exception 'This is the only director of a league with no venue behind it. Appoint another director first, or nobody will be able to run it.';
	end if;

	delete from public.tbl_competition_roles where id = p_role_id;
end;
$$;

revoke execute on function public.tdc_remove_league_role(uuid) from public, anon;
grant  execute on function public.tdc_remove_league_role(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Reading
-- ─────────────────────────────────────────────────────────────────

-- One league season, with the rules it actually plays under.
create function public.tdc_league_season_info(p_league_season_id uuid)
returns table (
	league_season_id uuid,
	league_id        uuid,
	league_name      text,
	name             text,
	season_name      text,
	starts_on        date,
	ends_on          date,
	venue_id         uuid,
	venue_name       text,
	rules            jsonb,
	rules_overrides  jsonb,
	notes            text,
	i_run_it         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	select s.id, l.id, l.name, s.name, z.name, z.starts_on, z.ends_on,
		l.venue_id, v.name,
		l.rules || s.rules_overrides, s.rules_overrides, s.notes,
		private.tdc_can_run_league(s.id)
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	left join public.tbl_venues v on v.id = l.venue_id
	where s.id = p_league_season_id;
$$;

revoke execute on function public.tdc_league_season_info(uuid) from public, anon;
grant  execute on function public.tdc_league_season_info(uuid) to authenticated;


-- Teams in a season, with how many players and who captains. Public facts, so
-- any signed-in player may read it.
create function public.tdc_league_season_teams(p_league_season_id uuid)
returns table (
	team_id         uuid,
	name            text,
	team_lineage_id uuid,
	players         integer,
	captains        text[]
)
language sql
stable
security definer
set search_path = ''
as $$
	select t.id, t.name, t.team_lineage_id,
		(select count(*)::integer from public.tbl_league_season_entrants e
			where e.team_id = t.id and e.status <> 'withdrawn'),
		coalesce((select array_agg(p.display_name order by p.display_name)
			from public.tbl_league_season_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.team_id = t.id and e.is_captain and e.status <> 'withdrawn'), '{}')
	from public.tbl_teams t
	where t.league_season_id = p_league_season_id
	order by lower(t.name);
$$;

revoke execute on function public.tdc_league_season_teams(uuid) from public, anon;
grant  execute on function public.tdc_league_season_teams(uuid) to authenticated;


-- A team's roster as it stands now. Names and captaincy only: no payment, no
-- notes. This is "who is in the team"; who actually played a night is a
-- different question answered from the frames.
create function public.tdc_team_roster(p_team_id uuid)
returns table (
	player_id    uuid,
	display_name text,
	is_captain   boolean,
	status       text
)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id, p.display_name, e.is_captain, e.status
	from public.tbl_league_season_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.team_id = p_team_id
	order by e.is_captain desc, p.display_name;
$$;

revoke execute on function public.tdc_team_roster(uuid) from public, anon;
grant  execute on function public.tdc_team_roster(uuid) to authenticated;


-- The director's list: everyone entered, with payment and notes. Gated, for the
-- reason the table has no select grant.
create function public.tdc_league_season_entrants(p_league_season_id uuid)
returns table (
	entrant_id   uuid,
	player_id    uuid,
	display_name text,
	first_name   text,
	last_name    text,
	player_type  text,
	has_account  boolean,
	team_id      uuid,
	team_name    text,
	is_captain   boolean,
	status       text,
	paid_at      timestamptz,
	notes        text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		return;
	end if;

	return query
		select e.id, p.id, p.display_name, p.first_name, p.last_name, p.player_type,
			p.user_id is not null, e.team_id, t.name, e.is_captain, e.status, e.paid_at, e.notes
		from public.tbl_league_season_entrants e
		join public.tbl_players p on p.id = e.player_id
		left join public.tbl_teams t on t.id = e.team_id
		where e.league_season_id = p_league_season_id
		order by lower(t.name) nulls last, e.is_captain desc, p.display_name;
end;
$$;

revoke execute on function public.tdc_league_season_entrants(uuid) from public, anon;
grant  execute on function public.tdc_league_season_entrants(uuid) to authenticated;


create function public.tdc_league_officials(p_league_season_id uuid)
returns table (
	role_id      uuid,
	player_id    uuid,
	display_name text,
	role         text,
	role_name    text,
	rank         integer
)
language sql
stable
security definer
set search_path = ''
as $$
	select r.id, p.id, p.display_name, r.role,
		-- The lookup says "Tournament director"; on a league it is the League's.
		case when r.role = 'director' then 'League director' else t.name end,
		t.rank
	from public.tbl_competition_roles r
	join public.tbl_players p on p.id = r.player_id
	join public.tbl_competition_role_types t on t.key = r.role
	where r.league_season_id = p_league_season_id
	order by t.rank desc, p.display_name;
$$;

revoke execute on function public.tdc_league_officials(uuid) from public, anon;
grant  execute on function public.tdc_league_officials(uuid) to authenticated;


-- League seasons this account runs or plays in, newest first.
create function public.tdc_my_leagues(p_limit integer default 50)
returns table (
	league_season_id uuid,
	league_name      text,
	name             text,
	season_name      text,
	starts_on        date,
	venue_name       text,
	i_run_it         boolean,
	my_team_id       uuid,
	my_team_name     text,
	i_captain        boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select s.id, l.name, s.name, z.name, z.starts_on, v.name,
		private.tdc_can_run_league(s.id),
		e.team_id, t.name, coalesce(e.is_captain, false)
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	left join public.tbl_venues v on v.id = l.venue_id
	left join public.tbl_league_season_entrants e
		on e.league_season_id = s.id and e.player_id = (select id from me)
	left join public.tbl_teams t on t.id = e.team_id
	where (select id from me) is not null
		and (private.tdc_can_run_league(s.id) or e.id is not null)
	order by coalesce(z.starts_on, s.created_at::date) desc, s.created_at desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.tdc_my_leagues(integer) from public, anon;
grant  execute on function public.tdc_my_leagues(integer) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Merging players: the league entrants, and two tables it was missing
--
-- Patched from the live definition, not retyped: the diff against the function
-- as it stood (20261022100000) is additions only — one friendly guard, the
-- league entrants, tbl_match_events and tbl_deleted_matches.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.tdc_merge_players(p_keep_id uuid, p_remove_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_keep   public.tbl_players%rowtype;
	v_remove public.tbl_players%rowtype;
begin
	select * into v_keep   from public.tbl_players where id = p_keep_id   for update;
	select * into v_remove from public.tbl_players where id = p_remove_id for update;

	if v_keep.id is null or v_remove.id is null then
		raise exception 'TDC (Error): player record not found.';
	end if;
	if v_keep.id = v_remove.id then
		raise exception 'TDC (Error): cannot join a player record with itself.';
	end if;
	if v_keep.user_id is not null then
		raise exception 'That record is already linked to an account.';
	end if;
	if v_keep.player_type not in ('walk_in', 'guest') then
		raise exception 'TDC (Error): only walk-in or guest records can be linked to an account.';
	end if;
	if v_remove.user_id is distinct from p_user_id then
		raise exception 'TDC (Error): the account does not match the selected player.';
	end if;

	-- Two different SA IDs can't be joined automatically. (The same SA ID can't be on two records.)
	if exists (select 1 from public.tbl_player_identifiers where player_id = p_keep_id   and kind = 'sa_id')
	   and exists (select 1 from public.tbl_player_identifiers where player_id = p_remove_id and kind = 'sa_id') then
		raise exception 'Both records have an SA ID on file. Please ask an owner or admin to resolve this.';
	end if;

	-- If the two records ever faced each other, joining them would make a match
	-- or a frame have the same player on both sides. Say so plainly rather than
	-- letting a check constraint fail with something nobody can act on.
	if exists (
		select 1 from public.tbl_matches
		where (home_player_id = p_keep_id   and away_player_id = p_remove_id)
		   or (home_player_id = p_remove_id and away_player_id = p_keep_id)
	) then
		raise exception 'These two records are recorded as having played against each other. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_frame_participants a
		join public.tbl_frame_participants b on b.frame_id = a.frame_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are recorded as having played in the same frame. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_league_season_entrants a
		join public.tbl_league_season_entrants b on b.league_season_id = a.league_season_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both entered in the same league season. Please ask an owner or admin to resolve this.';
	end if;

	-- ── Move everything that points at the signup record onto the walk-in record ──
	update public.tbl_player_identifiers set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_players set guest_of_player_id = p_keep_id where guest_of_player_id = p_remove_id;

	-- Credits: the only time ledger rows may change owner. The switch is on for this transaction step only.
	perform set_config('tdc.ledger_merge', 'on', true);
	update public.tbl_credit_ledger set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.ledger_merge', 'off', true);

	-- Redeem codes keep a full history and refuse direct edits, so the same
	-- controlled-write switch the redeem and void functions use is needed here.
	perform set_config('tdc.redeem_write', 'on', true);
	update public.tbl_redeem_codes set redeemed_player_id = p_keep_id where redeemed_player_id = p_remove_id;
	perform set_config('tdc.redeem_write', 'off', true);

	-- Matches and frames. The match rows matter as much as the frames: a side of
	-- a match is a player id, and losing it would orphan a whole scorecard.
	-- The frame writes now pass the rank guard as well as the lock, so they go
	-- through the same unlock the delete path uses: a merge is bookkeeping,
	-- not somebody trying to change a score.
	perform set_config('tdc.card_unlock', 'on', true);
	update public.tbl_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;

	update public.tbl_frames set referee_player_id = p_keep_id where referee_player_id = p_remove_id;
	update public.tbl_frames set break_player_id   = p_keep_id where break_player_id   = p_remove_id;
	update public.tbl_frame_participants set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.card_unlock', 'off', true);

	-- Competitions. Both of these cascade on delete, so without them the
	-- signup record's tournament entries and official roles would vanish the
	-- moment it is deleted below — quietly, at the exact moment staff link
	-- the records. Plain updates, not upserts: both tables are unique per
	-- (tournament, player), so a record somehow in the same tournament twice
	-- fails loudly rather than losing one of them.
	update public.tbl_tournament_entrants set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_competition_roles   set player_id = p_keep_id where player_id = p_remove_id;

	-- What this person has been told. Added 20261022100000.
	--
	-- Load-bearing, despite notifications needing an account: the record
	-- being *removed* here is the signup record — the one with the account,
	-- and therefore the only one that can have notifications. The walk-in
	-- record survives and inherits the login. Without this line, claiming a
	-- walk-in would silently wipe everything that account had been told.
	--
	-- The settings are deliberately not moved: p_keep_id is a walk-in and
	-- has none, so there is nothing to carry and nothing to overwrite.
	update public.tbl_notifications set player_id = p_keep_id where player_id = p_remove_id;

	-- League seasons (20261022180000). Unique per (season, player), so a record
	-- somehow entered twice fails loudly rather than losing one of the two —
	-- the same stance as the tournament entries above, with the friendly
	-- message the guards at the top give.
	update public.tbl_league_season_entrants set player_id = p_keep_id where player_id = p_remove_id;

	-- Added 20261022180000, found while reading this function for leagues.
	-- Neither table was here. tbl_match_events.player_id is ON DELETE RESTRICT,
	-- so a signup record that had ever submitted or answered a card made the
	-- delete below fail with a raw foreign-key error — loud, not lossy, but a
	-- walk-in claim would simply not go through. tbl_deleted_matches is set
	-- null (or restrict, for deleted_by), which would have forgotten who
	-- removed a match. Plain updates: neither table has a uniqueness rule on
	-- the player, so there is nothing to collide with.
	update public.tbl_match_events   set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_deleted_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_deleted_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;
	update public.tbl_deleted_matches set deleted_by     = p_keep_id where deleted_by     = p_remove_id;

	-- Who set a score by hand, and who changed a frame. Both "on delete set
	-- null", so these forget the person rather than blocking.
	update public.tbl_match_result_override set set_by = p_keep_id where set_by = p_remove_id;
	update public.tbl_frame_edit set edited_by_player_id = p_keep_id where edited_by_player_id = p_remove_id;

	-- Remove the signup record first, so its login link is free for the walk-in record.
	delete from public.tbl_players where id = p_remove_id;

	update public.tbl_players
	set user_id            = p_user_id,
		player_type        = 'member',
		guest_of_player_id = null,
		-- Keep the display name chosen at signup; names prefer what staff entered (they saw the ID).
		display_name       = case when v_remove.display_name = 'TDC (No Name)' then v_keep.display_name else v_remove.display_name end,
		first_name         = coalesce(v_keep.first_name, v_remove.first_name),
		last_name          = coalesce(v_keep.last_name,  v_remove.last_name)
	where id = p_keep_id;

	return p_keep_id;
end;
$function$

;
