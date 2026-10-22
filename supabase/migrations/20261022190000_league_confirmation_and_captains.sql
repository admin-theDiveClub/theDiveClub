-- League corrections: no walk-ins, confirmation, captains control their teams.
--
-- Three rules settled by UV on 22 Oct, after step 1 (20261022180000) went out:
--
--   1. Walk-ins and guests never touch a league. They are for the business,
--      tournaments and matches. A league player has an account.
--   2. Every league player confirms their own place. Nobody can confirm for
--      them, and the league cannot begin until every active player has.
--   3. Only the league director creates teams. Captains control them: they
--      claim confirmed players onto the team, release them, name other
--      captains and rename it. The director keeps full power through the
--      existing functions.
--
-- Players can still be added mid-season by the director. They arrive
-- unplaced and unconfirmed; a captain claims them once they have confirmed.
-- Captains inviting players themselves is a later conversation, not built.
--
-- Production holds no league rows, so nothing here has to carry existing data.

alter table public.tbl_league_season_entrants
	add column confirmed_at timestamptz;

comment on column public.tbl_league_season_entrants.confirmed_at is
	'When the player confirmed they are playing. Set only by the player themselves (tdc_confirm_league_entry); cleared when a withdrawn player is added back.';

-- Insert-only on purpose: tdc_merge_players moves entrants onto the surviving
-- player record, and a walk-in record only gains its user_id at the end of a
-- merge. An update guard would trip on that.
create function private.tdc_league_entrant_needs_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if (select user_id from public.tbl_players where id = new.player_id) is null then
		raise exception 'Walk-ins and guests cannot play in a league. A league player needs an account of their own.';
	end if;
	return new;
end;
$$;

revoke execute on function private.tdc_league_entrant_needs_account() from public, anon;

create trigger tdc_league_entrant_needs_account
	before insert on public.tbl_league_season_entrants
	for each row execute function private.tdc_league_entrant_needs_account();

-- One place decides who may control a team: the director, or an active,
-- confirmed captain of that team.
create function private.tdc_can_control_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
			select 1 from public.tbl_teams t
			where t.id = p_team_id and private.tdc_can_run_league(t.league_season_id)
		)
		or exists (
			select 1
			from public.tbl_league_season_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.team_id = p_team_id
				and e.is_captain
				and e.status = 'active'
				and e.confirmed_at is not null
				and p.user_id = (select auth.uid())
		);
$$;

revoke execute on function private.tdc_can_control_team(uuid) from public, anon;
grant execute on function private.tdc_can_control_team(uuid) to authenticated;

-- Ready means at least one active player and every active player confirmed.
-- Withdrawn and inactive players are not waited for.
create function private.tdc_league_ready(p_league_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
			select 1 from public.tbl_league_season_entrants
			where league_season_id = p_league_season_id and status = 'active'
		)
		and not exists (
			select 1 from public.tbl_league_season_entrants
			where league_season_id = p_league_season_id
				and status = 'active' and confirmed_at is null
		);
$$;

revoke execute on function private.tdc_league_ready(uuid) from public, anon;
grant execute on function private.tdc_league_ready(uuid) to authenticated;

-- ── Existing functions, patched from their live text ──

CREATE OR REPLACE FUNCTION public.tdc_add_league_entrant(p_league_season_id uuid, p_player_id uuid, p_team_id uuid DEFAULT NULL::uuid, p_is_captain boolean DEFAULT false, p_status text DEFAULT 'active'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_id       uuid;
	v_user     uuid;
	v_actor    uuid;
	v_existing public.tbl_league_season_entrants%rowtype;
	v_label    text;
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

	-- A league player has to confirm their own place, which takes an account.
	-- Walk-ins and guests are for the business, tournaments and matches, never
	-- leagues. The table refuses the same thing by trigger; this is the message
	-- a person can act on.
	select user_id into v_user from public.tbl_players where id = p_player_id;
	if v_user is null then
		raise exception 'Walk-ins and guests cannot play in a league. A league player needs an account of their own, so they can confirm their place.';
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
	select * into v_existing from public.tbl_league_season_entrants
	where league_season_id = p_league_season_id and player_id = p_player_id;

	insert into public.tbl_league_season_entrants as e
		(added_by, league_season_id, player_id, team_id, is_captain, status)
	values
		((select auth.uid()), p_league_season_id, p_player_id, p_team_id, coalesce(p_is_captain, false), p_status)
	on conflict (league_season_id, player_id) do update
		set status     = excluded.status,
			-- Coming back from a withdrawal is a fresh decision to play.
			confirmed_at = case when e.status = 'withdrawn' and excluded.status <> 'withdrawn' then null else e.confirmed_at end,
			team_id    = coalesce(e.team_id, excluded.team_id),
			is_captain = e.is_captain or (excluded.is_captain and coalesce(e.team_id, excluded.team_id) = excluded.team_id)
	returning id into v_id;

	-- Tell them. A league place is nothing until the player confirms it, and
	-- they cannot confirm what they have not been told about. Only when they are
	-- newly in or coming back, not on every idempotent re-add.
	if v_existing.id is null or (v_existing.status = 'withdrawn' and p_status <> 'withdrawn') then
		select id into v_actor from public.tbl_players where user_id = (select auth.uid());
		select l.name || ' - ' || s.name into v_label
		from public.tbl_league_seasons s join public.tbl_leagues l on l.id = s.league_id
		where s.id = p_league_season_id;

		perform private.tdc_notify(
			p_player_id, 'league', 'league_entry_added',
			'You have been added to ' || v_label,
			'Confirm that you are playing, so the league can begin.',
			null, null, null, v_actor);
	end if;

	return v_id;
end;
$function$;

revoke execute on function public.tdc_add_league_entrant(uuid, uuid, uuid, boolean, text) from public, anon;
grant execute on function public.tdc_add_league_entrant(uuid, uuid, uuid, boolean, text) to authenticated;

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
		confirmed_at = case when status = 'withdrawn' and p_status is not null and p_status <> 'withdrawn' then null else confirmed_at end,
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

revoke execute on function public.tdc_set_league_entrant(uuid, text, uuid, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.tdc_set_league_entrant(uuid, text, uuid, boolean, boolean, boolean, text) to authenticated;

CREATE OR REPLACE FUNCTION public.tdc_update_team(p_team_id uuid, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_t public.tbl_teams%rowtype;
begin
	select * into v_t from public.tbl_teams where id = p_team_id;
	if v_t.id is null then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	-- The league director, or a captain of this team. Creating a team stays
	-- with the director.
	if not private.tdc_can_control_team(p_team_id) then
		raise exception 'Only the league director or a captain of this team can change it.';
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
$function$;

revoke execute on function public.tdc_update_team(uuid, text) from public, anon;
grant execute on function public.tdc_update_team(uuid, text) to authenticated;

-- ── Read functions that gain the confirmation ──

drop function public.tdc_team_roster(uuid);
CREATE OR REPLACE FUNCTION public.tdc_team_roster(p_team_id uuid)
 RETURNS TABLE(player_id uuid, display_name text, is_captain boolean, status text, confirmed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id, p.display_name, e.is_captain, e.status, e.confirmed_at is not null
	from public.tbl_league_season_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.team_id = p_team_id
	order by e.is_captain desc, p.display_name;
$function$;

revoke execute on function public.tdc_team_roster(uuid) from public, anon;
grant execute on function public.tdc_team_roster(uuid) to authenticated;

drop function public.tdc_league_season_entrants(uuid);
CREATE OR REPLACE FUNCTION public.tdc_league_season_entrants(p_league_season_id uuid)
 RETURNS TABLE(entrant_id uuid, player_id uuid, display_name text, first_name text, last_name text, player_type text, has_account boolean, team_id uuid, team_name text, is_captain boolean, status text, paid_at timestamp with time zone, notes text, confirmed_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		return;
	end if;

	return query
		select e.id, p.id, p.display_name, p.first_name, p.last_name, p.player_type,
			p.user_id is not null, e.team_id, t.name, e.is_captain, e.status, e.paid_at, e.notes, e.confirmed_at
		from public.tbl_league_season_entrants e
		join public.tbl_players p on p.id = e.player_id
		left join public.tbl_teams t on t.id = e.team_id
		where e.league_season_id = p_league_season_id
		order by lower(t.name) nulls last, e.is_captain desc, p.display_name;
end;
$function$;

revoke execute on function public.tdc_league_season_entrants(uuid) from public, anon;
grant execute on function public.tdc_league_season_entrants(uuid) to authenticated;

drop function public.tdc_my_leagues(integer);
CREATE OR REPLACE FUNCTION public.tdc_my_leagues(p_limit integer DEFAULT 50)
 RETURNS TABLE(league_season_id uuid, league_name text, name text, season_name text, starts_on date, venue_name text, i_run_it boolean, my_team_id uuid, my_team_name text, i_captain boolean, my_status text, confirmed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select s.id, l.name, s.name, z.name, z.starts_on, v.name,
		private.tdc_can_run_league(s.id),
		e.team_id, t.name, coalesce(e.is_captain, false), e.status, e.confirmed_at
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
$function$;

revoke execute on function public.tdc_my_leagues(integer) from public, anon;
grant execute on function public.tdc_my_leagues(integer) to authenticated;

-- ── The player's own decisions ──

create function public.tdc_confirm_league_entry(p_league_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_e public.tbl_league_season_entrants%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select e.* into v_e
	from public.tbl_league_season_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.league_season_id = p_league_season_id
		and p.user_id = (select auth.uid());

	if v_e.id is null then
		raise exception 'You have not been added to this league.';
	end if;
	if v_e.status = 'withdrawn' then
		raise exception 'You withdrew from this league. The league director can add you back.';
	end if;
	if v_e.status = 'inactive' then
		raise exception 'You are marked inactive in this league. Ask the league director to make you active first.';
	end if;

	update public.tbl_league_season_entrants
	set confirmed_at = coalesce(confirmed_at, now())
	where id = v_e.id;
end;
$$;

create function public.tdc_withdraw_league_entry(p_league_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_e public.tbl_league_season_entrants%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select e.* into v_e
	from public.tbl_league_season_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.league_season_id = p_league_season_id
		and p.user_id = (select auth.uid());

	if v_e.id is null then
		raise exception 'You have not been added to this league.';
	end if;
	if v_e.status = 'withdrawn' then
		return;
	end if;

	-- A team is never left without a captain by its own captain walking out.
	if v_e.is_captain and not exists (
		select 1 from public.tbl_league_season_entrants o
		where o.team_id = v_e.team_id and o.is_captain and o.status = 'active'
			and o.id <> v_e.id
	) then
		raise exception 'You are the only captain of your team. Name another captain first, or ask the league director.';
	end if;

	update public.tbl_league_season_entrants
	set status = 'withdrawn', is_captain = false
	where id = v_e.id;
end;
$$;

-- ── Captains control their team ──

create function public.tdc_team_claim_player(p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_teams%rowtype;
	v_e public.tbl_league_season_entrants%rowtype;
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
	if v_e.confirmed_at is null then
		raise exception 'That player has not confirmed yet. A team can only claim players who have.';
	end if;
	if v_e.team_id is not null then
		if v_e.team_id = p_team_id then
			return;
		end if;
		raise exception 'That player is already on another team. Their captain or the league director has to release them first.';
	end if;

	update public.tbl_league_season_entrants
	set team_id = p_team_id
	where id = v_e.id;
end;
$$;

create function public.tdc_team_release_player(p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_e public.tbl_league_season_entrants%rowtype;
begin
	if not exists (select 1 from public.tbl_teams where id = p_team_id) then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	if not private.tdc_can_control_team(p_team_id) then
		raise exception 'Only the league director or a captain of this team can release players.';
	end if;

	select * into v_e from public.tbl_league_season_entrants
	where team_id = p_team_id and player_id = p_player_id;
	if v_e.id is null then
		raise exception 'That player is not on this team.';
	end if;

	if v_e.is_captain and not exists (
		select 1 from public.tbl_league_season_entrants o
		where o.team_id = p_team_id and o.is_captain and o.status = 'active'
			and o.id <> v_e.id
	) then
		raise exception 'That player is the only captain. Name another captain first.';
	end if;

	update public.tbl_league_season_entrants
	set team_id = null, is_captain = false
	where id = v_e.id;
end;
$$;

create function public.tdc_team_set_captain(p_team_id uuid, p_player_id uuid, p_is_captain boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_e public.tbl_league_season_entrants%rowtype;
begin
	if not exists (select 1 from public.tbl_teams where id = p_team_id) then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	if not private.tdc_can_control_team(p_team_id) then
		raise exception 'Only the league director or a captain of this team can name captains.';
	end if;

	select * into v_e from public.tbl_league_season_entrants
	where team_id = p_team_id and player_id = p_player_id;
	if v_e.id is null then
		raise exception 'That player is not on this team.';
	end if;

	if coalesce(p_is_captain, false) then
		if v_e.status <> 'active' or v_e.confirmed_at is null then
			raise exception 'A captain has to be active and have confirmed their place.';
		end if;
	elsif v_e.is_captain and not exists (
		select 1 from public.tbl_league_season_entrants o
		where o.team_id = p_team_id and o.is_captain and o.status = 'active'
			and o.id <> v_e.id
	) then
		raise exception 'That player is the only captain. Name another captain first.';
	end if;

	update public.tbl_league_season_entrants
	set is_captain = coalesce(p_is_captain, false)
	where id = v_e.id;
end;
$$;

-- ── Readiness ──
-- Step 3 (fixtures) must refuse unless ready is true.

create function public.tdc_league_season_readiness(p_league_season_id uuid)
returns table (
	ready          boolean,
	active_players integer,
	confirmed      integer,
	waiting        integer,
	unplaced       integer,
	waiting_names  text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not (
		private.tdc_can_run_league(p_league_season_id)
		or exists (
			select 1
			from public.tbl_league_season_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.league_season_id = p_league_season_id
				and e.is_captain and e.status = 'active'
				and p.user_id = (select auth.uid())
		)
	) then
		return;
	end if;

	return query
		select private.tdc_league_ready(p_league_season_id),
			count(*)::integer,
			(count(*) filter (where e.confirmed_at is not null))::integer,
			(count(*) filter (where e.confirmed_at is null))::integer,
			(count(*) filter (where e.team_id is null))::integer,
			coalesce(array_agg(p.display_name order by p.display_name)
				filter (where e.confirmed_at is null), '{}'::text[])
		from public.tbl_league_season_entrants e
		join public.tbl_players p on p.id = e.player_id
		where e.league_season_id = p_league_season_id and e.status = 'active';
end;
$$;

revoke execute on function public.tdc_confirm_league_entry(uuid) from public, anon;
grant execute on function public.tdc_confirm_league_entry(uuid) to authenticated;
revoke execute on function public.tdc_withdraw_league_entry(uuid) from public, anon;
grant execute on function public.tdc_withdraw_league_entry(uuid) to authenticated;
revoke execute on function public.tdc_team_claim_player(uuid, uuid) from public, anon;
grant execute on function public.tdc_team_claim_player(uuid, uuid) to authenticated;
revoke execute on function public.tdc_team_release_player(uuid, uuid) from public, anon;
grant execute on function public.tdc_team_release_player(uuid, uuid) to authenticated;
revoke execute on function public.tdc_team_set_captain(uuid, uuid, boolean) from public, anon;
grant execute on function public.tdc_team_set_captain(uuid, uuid, boolean) to authenticated;
revoke execute on function public.tdc_league_season_readiness(uuid) from public, anon;
grant execute on function public.tdc_league_season_readiness(uuid) to authenticated;
