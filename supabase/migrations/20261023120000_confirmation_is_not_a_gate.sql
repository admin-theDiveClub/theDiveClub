-- Confirmation stops being a precondition anywhere, and a player can take
-- theirs back. Both from UV testing a real league on 23 Oct.
--
-- ── 1. The gates ──
--
-- Until this morning a captain had to have confirmed before they could
-- captain, a player had to have confirmed before they could be put in a
-- squad, and a team could only claim somebody who had. That was consistent
-- while confirmation also gated the fixtures. It stopped being consistent an
-- hour ago, when UV ruled that it does not — and it bit him immediately: he
-- had added his own profile, made himself captain, not confirmed, and could
-- then do nothing as a captain at all.
--
-- So all seven checks come out. **Confirmation is reported, never required.**
-- tdc_league_season_readiness still names who is outstanding and the pages
-- still show it. Being *active* in the league is what gates things now, which
-- is the thing a director actually controls.
--
-- ── 2. Taking it back ──
--
-- UV: "There is no real way to unconfirm your participation as a player. I
-- should just be unconfirmed. My paid status should remain untouched."
--
-- The season page's "I am not playing" called tdc_withdraw_league_entry,
-- which takes the player out of the league altogether, strips their captaincy
-- and refuses outright if they are their team's only captain — which is why
-- pressing it appeared to do nothing. Those are two different acts. Taking
-- back your confirmation is the exact opposite of giving it: it clears
-- confirmed_at and touches nothing else, so the player keeps their place,
-- their team, their captaincy and their payment, and simply has not said yes
-- yet. Leaving the league is a bigger thing and keeps its own function.
--
-- Payment is never a player's to change, here or anywhere: it is not in this
-- function at all.

create function public.tdc_unconfirm_league_entry(p_league_season_id uuid)
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
		raise exception 'You are not in this league.';
	end if;
	if v_e.confirmed_at is null then
		return;   -- already unconfirmed; saying so twice is not an error
	end if;

	update public.tbl_league_season_entrants
	set confirmed_at = null
	where id = v_e.id;
end;
$$;

revoke execute on function public.tdc_unconfirm_league_entry(uuid) from public, anon;
grant execute on function public.tdc_unconfirm_league_entry(uuid) to authenticated;

-- ── The seven, patched from their live definitions ──

CREATE OR REPLACE FUNCTION private.tdc_can_control_team(p_team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
				and p.user_id = (select auth.uid())
		);
$function$;

CREATE OR REPLACE FUNCTION private.tdc_is_league_captain(p_league_season_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select exists (
		select 1
		from public.tbl_league_season_entrants e
		join public.tbl_players p on p.id = e.player_id
		where e.league_season_id = p_league_season_id
			and e.is_captain
			and e.status = 'active'
			and p.user_id = (select auth.uid())
	);
$function$;

CREATE OR REPLACE FUNCTION private.tdc_league_match_side(p_match_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select case
		when exists (
			select 1 from public.tbl_matches m
			join public.tbl_league_season_entrants e on e.team_id = m.home_team_id
			join public.tbl_players p on p.id = e.player_id
			where m.id = p_match_id and e.is_captain and e.status = 'active'
				and p.user_id = (select auth.uid())
		) then 'home'
		when exists (
			select 1 from public.tbl_matches m
			join public.tbl_league_season_entrants e on e.team_id = m.away_team_id
			join public.tbl_players p on p.id = e.player_id
			where m.id = p_match_id and e.is_captain and e.status = 'active'
				and p.user_id = (select auth.uid())
		) then 'away'
	end;
$function$;

CREATE OR REPLACE FUNCTION public.tdc_league_unplaced(p_league_season_id uuid)
 RETURNS TABLE(player_id uuid, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
			and e.team_id is null
		order by p.display_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tdc_set_match_squad(p_match_id uuid, p_player_id uuid, p_available boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_m    public.tbl_matches%rowtype;
	v_ls   uuid;
	v_team uuid;
	v_side text;
begin
	v_m  := private.tdc_lineup_match(p_match_id);
	v_ls := private.tdc_league_season_of_match(p_match_id);

	-- The side follows from the player's team, not from who is asking. A
	-- captain cannot put somebody in the wrong squad by accident, and the
	-- director does not have to say which side they meant.
	select team_id into v_team
	from public.tbl_league_season_entrants
	where league_season_id = v_ls and player_id = p_player_id
		and status = 'active';

	if v_team is null then
		raise exception 'That player is not an active player in this league.';
	end if;

	v_side := case v_team when v_m.home_team_id then 'home' when v_m.away_team_id then 'away' end;
	if v_side is null then
		raise exception 'That player is not on either of the teams playing this match.';
	end if;

	if not private.tdc_can_set_lineup(p_match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can change its squad.';
	end if;

	if coalesce(p_available, true) then
		insert into public.tbl_league_match_squad (added_by, match_id, side, player_id)
		values ((select auth.uid()), p_match_id, v_side, p_player_id)
		on conflict (match_id, player_id) do nothing;
	else
		-- Taking somebody out of the squad takes them out of the order with
		-- it: a slot held by a player who is not there is how a side arrives
		-- at the table a man short without anybody noticing.
		update public.tbl_league_match_order
		set player_id = null
		where match_id = p_match_id and player_id = p_player_id;

		delete from public.tbl_league_match_squad
		where match_id = p_match_id and player_id = p_player_id;
	end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tdc_team_claim_player(p_team_id uuid, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.tdc_team_set_captain(p_team_id uuid, p_player_id uuid, p_is_captain boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
		if v_e.status <> 'active' then
			raise exception 'A captain has to be an active player in the league.';
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
$function$;
