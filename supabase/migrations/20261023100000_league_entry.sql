-- Leagues: how a player gets into one.
--
-- Until now a league director added every player by hand. UV, 23 Oct: that is
-- backwards for a league of twenty. A player should be able to find the league
-- themselves and put their name down, and the director should see a list and
-- confirm people off it — the same shape tournaments already use.
--
-- So an entrant now has somewhere to stand before they are in the league:
--
--   interested  — put their own name down, or the director has them on the
--                 list. Not in the league: no team, no fixtures, not waited
--                 for by readiness.
--   active      — confirmed by the director. This is "in the league".
--   inactive    — on the books, not playing at the moment.
--   withdrawn   — pulled out.
--   suspended   — the director has taken their place away. A deliberate act
--                 with a different meaning from withdrawing, which is the
--                 player's own.
--
-- ── Two different confirmations, and they are not the same thing ──
--
-- `confirmed_at` has meant "the player themselves said they are playing"
-- since 22 Oct, and nothing but the player can set it. The director
-- confirming somebody off the interested list is a different act: it is the
-- league accepting them.
--
-- They meet in one place. **Showing interest sets confirmed_at**, because a
-- player who goes looking for the league and puts their own name down has
-- said they are playing about as plainly as it can be said. A player the
-- director adds by hand still has to confirm for themselves, exactly as
-- before. Nothing else changes.

alter table public.tbl_league_season_entrants drop constraint tbl_league_season_entrants_status_check;
alter table public.tbl_league_season_entrants add constraint tbl_league_season_entrants_status_check
	check (status in ('interested', 'active', 'inactive', 'withdrawn', 'suspended'));

comment on column public.tbl_league_season_entrants.status is
	'interested = name down, not yet in. active = in the league. inactive = on the books. withdrawn = their own choice. suspended = the director took their place away.';

-- Nothing that decides who plays has to change: squads, captaincy, fixtures
-- and readiness all ask for 'active', so an interested or suspended player is
-- already excluded from every one of them.

alter table public.tbl_league_seasons
	add column entry_mode text not null default 'ld_only'
		check (entry_mode in ('ld_only', 'interested', 'self_confirm')),
	add column paid_confirms boolean not null default false,
	add column is_listed boolean not null default false;

comment on column public.tbl_league_seasons.entry_mode is
	'ld_only: nobody can put themselves down. interested: they can, and the director confirms. self_confirm: they are in as soon as they ask.';
comment on column public.tbl_league_seasons.is_listed is
	'Whether this season appears in tdc_search_leagues. The join link works for any signed-in player either way, as a tournament poster link does.';

-- ── Finding a league ──
--
-- Listed seasons only, and only those taking entries: a league nobody can join
-- in the search results is a dead end with a name on it.
create function public.tdc_search_leagues(p_query text default null, p_limit integer default 25)
returns table (
	league_season_id uuid,
	league_name      text,
	season_name      text,
	starts_on        date,
	venue_name       text,
	entry_mode       text,
	players          integer,
	my_status        text
)
language sql
stable
security definer
set search_path = ''
as $$
	select s.id, l.name, s.name, z.starts_on, v.name, s.entry_mode,
		(select count(*)::integer from public.tbl_league_season_entrants e
		 where e.league_season_id = s.id and e.status = 'active'),
		(select e.status from public.tbl_league_season_entrants e
		 join public.tbl_players p on p.id = e.player_id
		 where e.league_season_id = s.id and p.user_id = (select auth.uid()))
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	left join public.tbl_venues v on v.id = l.venue_id
	where (select auth.uid()) is not null
		and s.is_listed
		and s.entry_mode <> 'ld_only'
		and (
			coalesce(trim(p_query), '') = ''
			or l.name ilike '%' || trim(p_query) || '%'
			or s.name ilike '%' || trim(p_query) || '%'
			or v.name ilike '%' || trim(p_query) || '%'
		)
	order by z.starts_on desc nulls last, l.name
	limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

revoke execute on function public.tdc_search_leagues(text, integer) from public, anon;
grant execute on function public.tdc_search_leagues(text, integer) to authenticated;

-- What a player sees before deciding. Readable by any signed-in player
-- whether or not the season is listed, which is what makes the link
-- shareable — the same way a tournament poster link is.
create function public.tdc_league_join_info(p_league_season_id uuid)
returns table (
	league_season_id uuid,
	league_name      text,
	season_name      text,
	name             text,
	starts_on        date,
	ends_on          date,
	venue_name       text,
	entry_mode       text,
	is_listed        boolean,
	teams            integer,
	players          integer,
	interested       integer,
	my_status        text,
	i_confirmed      boolean,
	i_run_it         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	select s.id, l.name, z.name, s.name, z.starts_on, z.ends_on, v.name,
		s.entry_mode, s.is_listed,
		(select count(*)::integer from public.tbl_teams t where t.league_season_id = s.id),
		(select count(*)::integer from public.tbl_league_season_entrants e
		 where e.league_season_id = s.id and e.status = 'active'),
		(select count(*)::integer from public.tbl_league_season_entrants e
		 where e.league_season_id = s.id and e.status = 'interested'),
		(select e.status from public.tbl_league_season_entrants e
		 join public.tbl_players p on p.id = e.player_id
		 where e.league_season_id = s.id and p.user_id = (select auth.uid())),
		(select e.confirmed_at is not null from public.tbl_league_season_entrants e
		 join public.tbl_players p on p.id = e.player_id
		 where e.league_season_id = s.id and p.user_id = (select auth.uid())),
		private.tdc_can_run_league(s.id)
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	left join public.tbl_venues v on v.id = l.venue_id
	where (select auth.uid()) is not null and s.id = p_league_season_id;
$$;

revoke execute on function public.tdc_league_join_info(uuid) from public, anon;
grant execute on function public.tdc_league_join_info(uuid) to authenticated;

-- ── Putting your own name down ──

create function public.tdc_league_show_interest(p_league_season_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_mode   text;
	v_me     uuid;
	v_status text;
	v_e      public.tbl_league_season_entrants%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select entry_mode into v_mode from public.tbl_league_seasons where id = p_league_season_id;
	if v_mode is null then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;
	if v_mode = 'ld_only' then
		raise exception 'This league is not taking names. Speak to whoever runs it.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	select * into v_e from public.tbl_league_season_entrants
	where league_season_id = p_league_season_id and player_id = v_me;

	-- Somebody the director has suspended does not get back in by asking.
	if v_e.status = 'suspended' then
		raise exception 'Your place in this league has been suspended. Speak to whoever runs it.';
	end if;
	-- Already in, in a way that asking again cannot improve.
	if v_e.status in ('active', 'interested') then
		return v_e.status;
	end if;

	v_status := case v_mode when 'self_confirm' then 'active' else 'interested' end;

	-- confirmed_at because this is the player themselves saying they are
	-- playing, which is exactly what that column has meant since 22 Oct.
	insert into public.tbl_league_season_entrants as e
		(added_by, league_season_id, player_id, status, confirmed_at)
	values ((select auth.uid()), p_league_season_id, v_me, v_status, now())
	on conflict (league_season_id, player_id) do update
		set status = v_status, confirmed_at = coalesce(e.confirmed_at, now());

	return v_status;
end;
$$;

revoke execute on function public.tdc_league_show_interest(uuid) from public, anon;
grant execute on function public.tdc_league_show_interest(uuid) to authenticated;

-- ── Moving people between the lists ──
--
-- The director's screen is three boxes — interested, in the league, suspended
-- — with arrows between them. One call moves a whole selection, because
-- confirming fifteen people one request at a time is fifteen chances for half
-- of it to land.
create function public.tdc_set_league_entrants_status(
	p_entrant_ids uuid[],
	p_status      text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ls uuid;
	v_n  integer;
begin
	if p_status not in ('interested', 'active', 'inactive', 'withdrawn', 'suspended') then
		raise exception 'TDC (Error): unknown entrant status "%".', p_status;
	end if;
	if p_entrant_ids is null or array_length(p_entrant_ids, 1) is null then
		return 0;
	end if;

	-- Every id has to belong to one season, and the caller has to run it.
	-- Otherwise a selection spanning two leagues would check one and move both.
	select array_agg(distinct league_season_id) into v_ls
	from public.tbl_league_season_entrants where id = any(p_entrant_ids)
	limit 1;

	if (select count(distinct league_season_id) from public.tbl_league_season_entrants
		where id = any(p_entrant_ids)) <> 1 then
		raise exception 'TDC (Error): those entrants are not all in one league season.';
	end if;

	select distinct league_season_id into v_ls
	from public.tbl_league_season_entrants where id = any(p_entrant_ids);

	if not private.tdc_can_run_league(v_ls) then
		raise exception 'Only the people running this league can change who is in it.';
	end if;

	update public.tbl_league_season_entrants
	set status = p_status,
		-- Coming off a withdrawal is a fresh decision, as it is everywhere
		-- else: they say again that they are playing.
		confirmed_at = case when status = 'withdrawn' and p_status <> 'withdrawn' then null else confirmed_at end,
		-- Somebody who is not in the league is not on a team either, and
		-- certainly not captaining one.
		team_id    = case when p_status in ('interested', 'suspended') then null else team_id end,
		is_captain = case when p_status in ('interested', 'suspended') then false else is_captain end
	where id = any(p_entrant_ids);

	get diagnostics v_n = row_count;
	return v_n;
end;
$$;

revoke execute on function public.tdc_set_league_entrants_status(uuid[], text) from public, anon;
grant execute on function public.tdc_set_league_entrants_status(uuid[], text) to authenticated;

-- ── The three functions that knew the old status list ──
-- All patched from their live definitions.

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

	if p_status not in ('interested', 'active', 'inactive', 'withdrawn', 'suspended') then
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
	if coalesce(p_paid, false) and coalesce(v_paid_ok, false)
		and v_status in ('interested', 'inactive') then
		v_status := 'active';
	end if;

	update public.tbl_league_season_entrants
	set status     = v_status,
		confirmed_at = case when status = 'withdrawn' and v_status <> 'withdrawn' then null else confirmed_at end,
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

CREATE OR REPLACE FUNCTION public.tdc_update_league_season(p_league_season_id uuid, p_name text DEFAULT NULL::text, p_rules_overrides jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text, p_starts_on date DEFAULT NULL::date, p_ends_on date DEFAULT NULL::date, p_clear_dates boolean DEFAULT false, p_entry_mode text DEFAULT NULL::text, p_paid_confirms boolean DEFAULT NULL::boolean, p_is_listed boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

	if p_entry_mode is not null and p_entry_mode not in ('ld_only', 'interested', 'self_confirm') then
		raise exception 'TDC (Error): unknown entry mode "%".', p_entry_mode;
	end if;

	update public.tbl_league_seasons
	set entry_mode    = coalesce(p_entry_mode, entry_mode),
		paid_confirms = coalesce(p_paid_confirms, paid_confirms),
		is_listed     = coalesce(p_is_listed, is_listed),
		name            = coalesce(trim(p_name), name),
		rules_overrides = coalesce(p_rules_overrides, rules_overrides),
		notes           = coalesce(p_notes, notes)
	where id = p_league_season_id;
end;
$function$;

revoke execute on function public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean, text, boolean, boolean) from public, anon;
grant execute on function public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean, text, boolean, boolean) to authenticated;
drop function if exists public.tdc_update_league_season(uuid, text, jsonb, text, date, date, boolean);

-- ── The director's list ──
-- tdc_league_season_entrants already returns everybody with their status, so
-- the three boxes are one read filtered three ways. It gains nothing here.

-- ── Confirming, when there is a place to confirm ──
--
-- tdc_confirm_league_entry refused a withdrawn or inactive player and knew
-- nothing of the two new states. A suspended player could still confirm and be
-- told they were confirmed, which is not true: they have no place. Somebody
-- on the interested list has already said they are playing by putting their
-- name down, so there is nothing further for them to do either.
--
-- Patched from the live definition; two refusals are the only change.

CREATE OR REPLACE FUNCTION public.tdc_confirm_league_entry(p_league_season_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
	if v_e.status = 'suspended' then
		raise exception 'Your place in this league has been suspended. Speak to whoever runs it.';
	end if;
	-- Somebody on the interested list has already said they are playing, by
	-- putting their name down. There is nothing further for them to confirm
	-- until the director lets them in.
	if v_e.status = 'interested' then
		raise exception 'Your name is down and the league director has not confirmed it yet. There is nothing else for you to do.';
	end if;

	update public.tbl_league_season_entrants
	set confirmed_at = coalesce(confirmed_at, now())
	where id = v_e.id;
end;
$function$;
