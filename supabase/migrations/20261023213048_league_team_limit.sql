-- A limit on how many active players a team may have, set as reserves.
--
-- UV, 23 Oct night: nothing limited a team's roster, so a five-man card
-- offered the whole league as reserves. Settled with him the same night
-- (docs/DECISIONS.md, "A team's limit is its team size plus its reserves"):
--
--   • The league director sets **reserves allowed** on the season, default 2,
--     0 for no subs. A team's limit is the team size plus that: a five-man
--     league with two reserves holds seven. Seasons can differ, which is why
--     it is on the season and not the league.
--   • Only **active** players count. A player who is away for a while (work,
--     an injury) is marked inactive — by themselves, their captain or the
--     director — keeps their place on the team, cannot be picked for a squad
--     (tdc_set_match_squad already asks for active), and frees a place.
--   • It binds captains and players. The director may go past it. Lowering
--     it below a team's size is allowed: that team keeps everyone but can
--     claim nobody and bring nobody back until it is under.
--   • A team may be short — down to one player, who need not be the captain.
--     Empty seats forfeit their frames, as they always have.
--   • **Every league has a team size, 2 to 10** (UV: option 3). 0 stays a
--     valid ruleset value for singles and tournaments, where it means no
--     sessions; a league's merged rules may no longer use it. So the limit
--     always has a team size to add to, and the session rework never has to
--     answer what a night without sessions looks like.
--
-- Patched from definitions extracted from a freshly reset local database:
-- tdc_create_league (20261022180000), tdc_update_league (20261023193153),
-- tdc_create_league_season (20261022180000), tdc_update_league_season
-- (20261023205736), tdc_team_claim_player (20261023120000),
-- tdc_league_season_teams (20261022180000). The diffs are additions only,
-- plus the rules check swapped for the league one.


-- ─── Stop if a league has no team size ───
-- Production had one league when this was written (Test_WedSim_8BMTL, team
-- size 5). Anything else is a question for UV, not a guess.

do $$
declare
	v_bad text;
begin
	select string_agg(l.name || ' - ' || s.name, ', ') into v_bad
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	where coalesce(((l.rules || s.rules_overrides)->>'team_size')::integer, 0) < 2;

	if v_bad is not null then
		raise exception 'Stopped: these league seasons have no team size, which every league now needs: %. Set one on the settings page, then push this again.', v_bad;
	end if;
end;
$$;


-- ─── The setting ───

alter table public.tbl_league_seasons
	add column max_reserves integer not null default 2
		constraint tbl_league_seasons_max_reserves_range check (max_reserves between 0 and 10);

comment on column public.tbl_league_seasons.max_reserves is
	'Reserves a team may carry beyond the team size. A team''s limit on active players is team_size + max_reserves. Binds captains and players, not the director.';


-- ─── Helpers ───

-- A league's ruleset as a ruleset, plus the one thing a league adds: a team
-- size. Called wherever a league's merged rules are checked.
create function private.tdc_check_league_rules(p_rules jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
	perform private.tdc_check_match_rules(p_rules);

	if private.tdc_team_size(p_rules) < 2 then
		raise exception 'A league needs a team size from 2 to 10: the number of players a side in each session.';
	end if;
end;
$$;

-- The most active players a team may have: its season's team size plus its
-- reserves. Null for a team that does not exist.
create function private.tdc_team_limit(p_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_team_size(private.tdc_rules_for_league_season(t.league_season_id)) + s.max_reserves
	from public.tbl_teams t
	join public.tbl_league_seasons s on s.id = t.league_season_id
	where t.id = p_team_id;
$$;

create function private.tdc_team_active_players(p_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select count(*)::integer
	from public.tbl_league_season_entrants
	where team_id = p_team_id and status = 'active';
$$;

revoke execute on function private.tdc_check_league_rules(jsonb) from public, anon, authenticated;
revoke execute on function private.tdc_team_limit(uuid) from public, anon, authenticated;
revoke execute on function private.tdc_team_active_players(uuid) from public, anon, authenticated;


-- ─── A league's rules need a team size ───

CREATE OR REPLACE FUNCTION public.tdc_create_league(p_name text, p_rules jsonb, p_venue_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

	perform private.tdc_check_league_rules(p_rules);

	insert into public.tbl_leagues (created_by, venue_id, name, rules, notes)
	values ((select auth.uid()), p_venue_id, trim(p_name), p_rules, p_notes)
	returning id into v_id;

	return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tdc_update_league(p_league_id uuid, p_name text DEFAULT NULL::text, p_rules jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_s record;
	v_frozen jsonb := jsonb_build_object('matches_updated', 0, 'matches_kept', 0);
begin
	if not exists (select 1 from public.tbl_leagues where id = p_league_id) then
		raise exception 'TDC (Error): league % not found.', p_league_id;
	end if;

	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can change it.';
	end if;

	if p_rules is not null then
		perform private.tdc_check_league_rules(p_rules);

		-- Every season lays its own changes over these. A league rule that
		-- makes one of them invalid is refused here, not discovered when the
		-- season's first match is created.
		for v_s in
			select id, name, rules_overrides from public.tbl_league_seasons where league_id = p_league_id
		loop
			begin
				perform private.tdc_check_league_rules(p_rules || v_s.rules_overrides);
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

	-- After the league's rules are written, because the re-freeze reads them
	-- back through private.tdc_rules_for_league_season.
	if p_rules is not null then
		v_frozen := private.tdc_refreeze_league_matches(p_league_id);
	end if;

	return v_frozen;
end;
$function$;


-- ─── The season takes its reserves ───
-- Both functions gain a parameter, so they are dropped and recreated rather
-- than left with an overload beside them.

drop function public.tdc_create_league_season(uuid, text, text, date, date, uuid, jsonb);

CREATE FUNCTION public.tdc_create_league_season(p_league_id uuid, p_name text, p_season_name text DEFAULT NULL::text, p_starts_on date DEFAULT NULL::date, p_ends_on date DEFAULT NULL::date, p_season_id uuid DEFAULT NULL::uuid, p_rules_overrides jsonb DEFAULT '{}'::jsonb, p_max_reserves integer DEFAULT 2)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
	perform private.tdc_check_league_rules(v_league.rules || p_rules_overrides);

	-- Before the insert: the column's check would refuse it anyway, with a
	-- message nobody can act on.
	if p_max_reserves is null or p_max_reserves not between 0 and 10 then
		raise exception 'Reserves allowed must be a number from 0 to 10.';
	end if;

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

	insert into public.tbl_league_seasons (created_by, league_id, season_id, name, rules_overrides, max_reserves)
	values ((select auth.uid()), p_league_id, v_season, trim(p_name), p_rules_overrides, p_max_reserves)
	returning id into v_id;

	insert into public.tbl_competition_roles (created_by, league_season_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director');

	return v_id;
end;
$function$;

revoke execute on function public.tdc_create_league_season(uuid, text, text, date, date, uuid, jsonb, integer) from public, anon;
grant  execute on function public.tdc_create_league_season(uuid, text, text, date, date, uuid, jsonb, integer) to authenticated;

drop function public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean, text, boolean, boolean);

CREATE FUNCTION public.tdc_update_league_season(p_league_season_id uuid, p_name text DEFAULT NULL::text, p_rules_overrides jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text, p_starts_on date DEFAULT NULL::date, p_ends_on date DEFAULT NULL::date, p_clear_dates boolean DEFAULT false, p_entry_mode text DEFAULT NULL::text, p_paid_confirms boolean DEFAULT NULL::boolean, p_is_listed boolean DEFAULT NULL::boolean, p_max_reserves integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_s       public.tbl_league_seasons%rowtype;
	v_league  public.tbl_leagues%rowtype;
	v_shared  integer;
	v_start   date;
	v_end     date;
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
		perform private.tdc_check_league_rules(v_league.rules || p_rules_overrides);
	end if;

	-- Lowering it below a team's size is allowed (UV, 23 Oct): that team
	-- keeps its players and simply cannot add anyone until it is under.
	if p_max_reserves is not null and p_max_reserves not between 0 and 10 then
		raise exception 'Reserves allowed must be a number from 0 to 10.';
	end if;

	-- Dates belong to the season row, which other leagues may share. Moving a
	-- shared period under someone else's league is refused rather than done.
	if p_clear_dates or p_starts_on is not null or p_ends_on is not null then
		select count(*) into v_shared from public.tbl_league_seasons where season_id = v_s.season_id;
		if v_shared > 1 then
			raise exception 'This period is shared with other leagues, so its dates cannot be changed from here.';
		end if;

		-- p_clear_dates means "set exactly these", so a blank clears that one
		-- date. Without it a null keeps what is there.
		select case when p_clear_dates then p_starts_on else coalesce(p_starts_on, starts_on) end,
			case when p_clear_dates then p_ends_on else coalesce(p_ends_on, ends_on) end
		into v_start, v_end
		from public.tbl_seasons where id = v_s.season_id;

		-- Before the write: tbl_seasons_dates_in_order would refuse it anyway,
		-- but with a message no director can act on.
		if v_end < v_start then
			raise exception 'The season cannot end before it starts.';
		end if;

		update public.tbl_seasons
		set starts_on = v_start, ends_on = v_end
		where id = v_s.season_id;
	end if;

	if p_name is not null then
		if length(trim(p_name)) < 2 then
			raise exception 'The season needs a name of two characters or more.';
		end if;

		-- The period's name follows, unless another league shares the period.
		if (select count(*) from public.tbl_league_seasons where season_id = v_s.season_id) = 1 then
			update public.tbl_seasons set name = trim(p_name) where id = v_s.season_id;
		end if;
	end if;

	if p_entry_mode is not null and p_entry_mode not in ('ld_only', 'interested', 'self_confirm') then
		raise exception 'TDC (Error): unknown entry mode "%".', p_entry_mode;
	end if;

	update public.tbl_league_seasons
	set entry_mode    = coalesce(p_entry_mode, entry_mode),
		paid_confirms = coalesce(p_paid_confirms, paid_confirms),
		is_listed     = coalesce(p_is_listed, is_listed),
		max_reserves  = coalesce(p_max_reserves, max_reserves),
		name            = coalesce(trim(p_name), name),
		rules_overrides = coalesce(p_rules_overrides, rules_overrides),
		notes           = coalesce(p_notes, notes)
	where id = p_league_season_id;
end;
$function$;

revoke execute on function public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean, text, boolean, boolean, integer) from public, anon;
grant  execute on function public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean, text, boolean, boolean, integer) to authenticated;


-- ─── Claiming stops at the limit ───

CREATE OR REPLACE FUNCTION public.tdc_team_claim_player(p_team_id uuid, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_t public.tbl_teams%rowtype;
	v_e public.tbl_league_season_entrants%rowtype;
	v_active integer;
	v_limit  integer;
begin
	select * into v_t from public.tbl_teams where id = p_team_id;
	if v_t.id is null then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	if not private.tdc_can_control_team(p_team_id) then
		raise exception 'Only the league director or a captain of this team can add players to it.';
	end if;

	select * into v_e from public.tbl_league_season_entrants
	where league_season_id = v_t.league_season_id and player_id = p_player_id;

	if v_e.id is null then
		raise exception 'That player is not in this league season. The league director adds players to the league first.';
	end if;
	if v_e.status <> 'active' then
		raise exception 'That player is not active in this league.';
	end if;
	if v_e.team_id is not null then
		if v_e.team_id = p_team_id then
			return;
		end if;
		raise exception 'That player is already on another team. Their captain or the league director has to release them first.';
	end if;

	-- The limit binds a captain, not the director, who may sign somebody past
	-- it in an emergency (UV, 23 Oct).
	if not private.tdc_can_run_league(v_t.league_season_id) then
		v_active := private.tdc_team_active_players(p_team_id);
		v_limit  := private.tdc_team_limit(p_team_id);
		if v_active >= v_limit then
			raise exception '% is full: % of % active players. Mark somebody away first, or ask the league director.',
				v_t.name, v_active, v_limit;
		end if;
	end if;

	update public.tbl_league_season_entrants
	set team_id = p_team_id
	where id = v_e.id;
end;
$function$;


-- ─── Away and back ───
-- A player on a team is marked inactive while they are away and active when
-- they are back. The player, their captain and the director may each do it.
-- Coming back is bound by the limit, except for the director; going away
-- never is. The only captain cannot be marked away except by the director,
-- because an inactive captain controls nothing (private.tdc_can_control_team
-- asks for active) and the team would be left with nobody to run it.

create function public.tdc_set_team_player_active(p_team_id uuid, p_player_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t      public.tbl_teams%rowtype;
	v_e      public.tbl_league_season_entrants%rowtype;
	v_ld     boolean;
	v_active integer;
	v_limit  integer;
begin
	if p_active is null then
		raise exception 'TDC (Error): say whether the player is active or away.';
	end if;

	select * into v_t from public.tbl_teams where id = p_team_id;
	if v_t.id is null then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	select * into v_e from public.tbl_league_season_entrants
	where team_id = p_team_id and player_id = p_player_id;
	if v_e.id is null then
		raise exception 'That player is not on this team.';
	end if;

	v_ld := private.tdc_can_run_league(v_t.league_season_id);

	if not (
		private.tdc_can_control_team(p_team_id)
		or exists (select 1 from public.tbl_players where id = p_player_id and user_id = (select auth.uid()))
	) then
		raise exception 'Only the player, their captain or the league director can mark a player away or back.';
	end if;

	-- Withdrawn and suspended are other people's decisions to undo: the
	-- player's own withdrawal, the director's suspension.
	if v_e.status not in ('active', 'inactive') then
		raise exception 'Only a player who is in the league can be marked away or back.';
	end if;

	if p_active then
		if v_e.status = 'active' then
			return;
		end if;

		if not v_ld then
			v_active := private.tdc_team_active_players(p_team_id);
			v_limit  := private.tdc_team_limit(p_team_id);
			if v_active >= v_limit then
				raise exception '% is full: % of % active players. Mark somebody away first, or ask the league director.',
					v_t.name, v_active, v_limit;
			end if;
		end if;

		update public.tbl_league_season_entrants set status = 'active' where id = v_e.id;
	else
		if v_e.status = 'inactive' then
			return;
		end if;

		if v_e.is_captain and not v_ld and not exists (
			select 1 from public.tbl_league_season_entrants o
			where o.team_id = p_team_id and o.is_captain and o.status = 'active'
				and o.id <> v_e.id
		) then
			raise exception 'That player is the team''s only captain. Name another captain first, or ask the league director.';
		end if;

		update public.tbl_league_season_entrants set status = 'inactive' where id = v_e.id;
	end if;
end;
$$;

revoke execute on function public.tdc_set_team_player_active(uuid, uuid, boolean) from public, anon;
grant  execute on function public.tdc_set_team_player_active(uuid, uuid, boolean) to authenticated;


-- ─── The pages see each team against its limit ───
-- players is unchanged (everybody on the team but the withdrawn); the two
-- new columns are what the limit is about.

drop function public.tdc_league_season_teams(uuid);

CREATE FUNCTION public.tdc_league_season_teams(p_league_season_id uuid)
 RETURNS TABLE(team_id uuid, name text, team_lineage_id uuid, players integer, captains text[], active_players integer, team_limit integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select t.id, t.name, t.team_lineage_id,
		(select count(*)::integer from public.tbl_league_season_entrants e
			where e.team_id = t.id and e.status <> 'withdrawn'),
		coalesce((select array_agg(p.display_name order by p.display_name)
			from public.tbl_league_season_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.team_id = t.id and e.is_captain and e.status <> 'withdrawn'), '{}'),
		private.tdc_team_active_players(t.id),
		private.tdc_team_limit(t.id)
	from public.tbl_teams t
	where t.league_season_id = p_league_season_id
	order by lower(t.name);
$function$;

revoke execute on function public.tdc_league_season_teams(uuid) from public, anon;
grant  execute on function public.tdc_league_season_teams(uuid) to authenticated;
