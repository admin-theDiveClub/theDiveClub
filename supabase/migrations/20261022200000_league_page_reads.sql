-- Leagues step 2: the reads the pages need.
--
-- Three small things the league pages could not do without:
--
--   1. A player search for a league. The tournament one (tdc_search_entrants) is
--      gated on a tournament and returns walk-ins, which can never be league
--      players, so a league gets its own: accounts only, and it says whether the
--      person is already in the season and in what state, so a withdrawn player
--      can be added back and an active one is shown as already there.
--   2. The pool a captain claims from: active, confirmed players on no team.
--      tdc_league_season_entrants is the director's list and carries payment and
--      notes, so a captain cannot be given that.
--   3. The notification a newly added player receives now links to the page where
--      they confirm. It was null in 20261022190000 because no page existed.
--
-- No tables change.

-- An active, confirmed captain of any team in the season. The one place that
-- question is answered for the pool read below.
create function private.tdc_is_league_captain(p_league_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.tbl_league_season_entrants e
		join public.tbl_players p on p.id = e.player_id
		where e.league_season_id = p_league_season_id
			and e.is_captain
			and e.status = 'active'
			and e.confirmed_at is not null
			and p.user_id = (select auth.uid())
	);
$$;

revoke execute on function private.tdc_is_league_captain(uuid) from public, anon;
grant execute on function private.tdc_is_league_captain(uuid) to authenticated;

create function public.tdc_search_league_players(
	p_league_season_id uuid,
	p_query            text,
	p_limit            integer default 20
)
returns table (
	id             uuid,
	display_name   text,
	full_name      text,
	avatar_path    text,
	entrant_status text
)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		p.avatar_path,
		e.status
	from public.tbl_players p
	left join public.tbl_league_season_entrants e
		on e.league_season_id = p_league_season_id and e.player_id = p.id
	where private.tdc_can_run_league(p_league_season_id)
		and p.user_id is not null
		and char_length(trim(coalesce(p_query, ''))) >= 2
		and (
			p.display_name ilike '%' || trim(p_query) || '%'
			or coalesce(p.first_name, '') ilike '%' || trim(p_query) || '%'
			or coalesce(p.last_name, '')  ilike '%' || trim(p_query) || '%'
		)
	order by p.display_name
	limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke execute on function public.tdc_search_league_players(uuid, text, integer) from public, anon;
grant execute on function public.tdc_search_league_players(uuid, text, integer) to authenticated;

create function public.tdc_league_unplaced(p_league_season_id uuid)
returns table (
	player_id    uuid,
	display_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not (private.tdc_can_run_league(p_league_season_id)
		or private.tdc_is_league_captain(p_league_season_id)) then
		return;
	end if;

	return query
		select p.id, p.display_name
		from public.tbl_league_season_entrants e
		join public.tbl_players p on p.id = e.player_id
		where e.league_season_id = p_league_season_id
			and e.status = 'active'
			and e.confirmed_at is not null
			and e.team_id is null
		order by p.display_name;
end;
$$;

revoke execute on function public.tdc_league_unplaced(uuid) from public, anon;
grant execute on function public.tdc_league_unplaced(uuid) to authenticated;

-- ── The notification now links to the page ──
-- Patched from the live definition (20261022190000): the only change is the link.

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
			'/leagues/season/?s=' || p_league_season_id::text, null, null, v_actor);
	end if;

	return v_id;
end;
$function$;

revoke execute on function public.tdc_add_league_entrant(uuid, uuid, uuid, boolean, text) from public, anon;
grant execute on function public.tdc_add_league_entrant(uuid, uuid, uuid, boolean, text) to authenticated;
