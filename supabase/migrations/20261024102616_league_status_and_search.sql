-- A league season's status, set by its director; the leagues list shows it;
-- the league search filters.
--
-- Follows 20261024094617, which gave tdc_my_leagues the dates, discipline,
-- team size and counts. This was first written into that same file after it
-- had already been pushed, so production never ran it; it is here under a
-- new number instead, and 20261024094617 is back exactly as production ran it.
--
-- UV, 24 Oct:
--
-- 1. A status per season, SET BY THE LEAGUE DIRECTOR. This replaces the
--    22 Oct decision "no status column on a league season; derive it from the
--    fixtures" (docs/DECISIONS.md): UV wants states the fixtures cannot know,
--    such as a league on a break over the holidays. Four to start, "we will
--    add more later":
--      taking_entries  open for names (the default for a new season)
--      running         fixtures being played
--      on_break        paused; the fixtures stay as they are
--      finished        the season is over
--    A check constraint, not a lookup table: a new status needs a migration
--    either way, and the labels and colours live with the pages
--    (TDCMatchDef.LEAGUE_STATUS, league.css). Seasons that already have
--    fixtures start as running; the rest as taking entries.
--    tdc_set_league_season_status is the one way to change it, for whoever
--    may run the season (private.tdc_can_run_league).
--
-- 2. tdc_my_leagues returns the status too. Patched from 20261024094617;
--    the diff is the one added column.
--
-- 3. Filters on the league search: discipline, status, and team or singles.
--    tdc_search_leagues gains p_discipline, p_status and p_kind ('team' or
--    'singles'; null for both), and returns discipline, team_size, status and
--    ends_on for the result tiles. **Singles leagues cannot exist yet**: every
--    league has a team size of 2 to 10 (23 Oct). UV decided on 24 Oct that
--    they should (team size 1), which is its own piece of league work
--    (docs/STATUS.md); until then 'singles' finds nothing, honestly. What the
--    search returns is unchanged otherwise: listed seasons a player can get
--    into (entry mode not ld_only), whatever their status. A filter value it
--    does not know is refused rather than quietly finding nothing. Patched
--    from 20261023100000; it became plpgsql for that refusal, and the query
--    is the old one plus the filters.
--
-- Both functions are dropped and recreated for their return types (and the
-- search for its parameters), so their grants are redone as before.
--
-- The site must not deploy before this is pushed: leagues.js and
-- league-settings.js read the status and call the new function.

-- ─── 1. Status ───

alter table public.tbl_league_seasons
	add column status text not null default 'taking_entries'
	constraint tbl_league_seasons_status_known
		check (status in ('taking_entries', 'running', 'on_break', 'finished'));

update public.tbl_league_seasons s set status = 'running'
where exists (select 1 from public.tbl_league_fixtures f where f.league_season_id = s.id);

create or replace function public.tdc_set_league_season_status(p_league_season_id uuid, p_status text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
	if not exists (select 1 from public.tbl_league_seasons where id = p_league_season_id) then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the league director can change the league''s status.';
	end if;

	if p_status is null or p_status not in ('taking_entries', 'running', 'on_break', 'finished') then
		raise exception 'TDC (Error): unknown league status "%".', p_status;
	end if;

	update public.tbl_league_seasons set status = p_status where id = p_league_season_id;
end;
$function$;

revoke execute on function public.tdc_set_league_season_status(uuid, text) from public, anon;
grant execute on function public.tdc_set_league_season_status(uuid, text) to authenticated;

-- ─── 2. Your leagues ───

drop function public.tdc_my_leagues(integer);
CREATE OR REPLACE FUNCTION public.tdc_my_leagues(p_limit integer DEFAULT 50)
 RETURNS TABLE(league_season_id uuid, league_name text, name text, season_name text, starts_on date, venue_name text, i_run_it boolean, my_team_id uuid, my_team_name text, i_captain boolean, my_status text, confirmed_at timestamp with time zone, ends_on date, discipline text, team_size integer, team_count integer, player_count integer, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select s.id, l.name, s.name, z.name, z.starts_on, v.name,
		private.tdc_can_run_league(s.id),
		e.team_id, t.name, coalesce(e.is_captain, false), e.status, e.confirmed_at,
		z.ends_on,
		private.tdc_rules_for_league_season(s.id) ->> 'discipline',
		private.tdc_team_size(private.tdc_rules_for_league_season(s.id)),
		(select count(*)::int from public.tbl_teams tc where tc.league_season_id = s.id),
		(select count(*)::int from public.tbl_league_season_entrants pc
			where pc.league_season_id = s.id and pc.status = 'active'),
		s.status
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

-- ─── 3. The search ───

drop function public.tdc_search_leagues(text, integer);
CREATE OR REPLACE FUNCTION public.tdc_search_leagues(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_discipline text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_kind text DEFAULT NULL::text)
 RETURNS TABLE(league_season_id uuid, league_name text, season_name text, starts_on date, venue_name text, entry_mode text, players integer, my_status text, discipline text, team_size integer, status text, ends_on date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
	if p_status is not null and p_status not in ('taking_entries', 'running', 'on_break', 'finished') then
		raise exception 'TDC (Error): unknown league status "%".', p_status;
	end if;
	if p_kind is not null and p_kind not in ('team', 'singles') then
		raise exception 'TDC (Error): a league is "team" or "singles", not "%".', p_kind;
	end if;

	return query
	select r.id, r.league_name, r.season_name, r.starts_on, r.venue_name, r.entry_mode,
		r.players, r.my_status, r.discipline, r.team_size, r.status, r.ends_on
	from (
		select s.id, l.name as league_name, s.name as season_name, z.starts_on, v.name as venue_name, s.entry_mode,
			(select count(*)::integer from public.tbl_league_season_entrants e
			 where e.league_season_id = s.id and e.status = 'active') as players,
			(select e.status from public.tbl_league_season_entrants e
			 join public.tbl_players p on p.id = e.player_id
			 where e.league_season_id = s.id and p.user_id = (select auth.uid())) as my_status,
			private.tdc_rules_for_league_season(s.id) ->> 'discipline' as discipline,
			private.tdc_team_size(private.tdc_rules_for_league_season(s.id)) as team_size,
			s.status, z.ends_on, l.name as sort_name
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
			and (p_status is null or s.status = p_status)
	) r
	where (p_discipline is null or r.discipline = p_discipline)
		and (p_kind is null
			or (p_kind = 'team' and r.team_size >= 2)
			or (p_kind = 'singles' and r.team_size = 1))
	order by r.starts_on desc nulls last, r.sort_name
	limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$function$;

revoke execute on function public.tdc_search_leagues(text, integer, text, text, text) from public, anon;
grant execute on function public.tdc_search_leagues(text, integer, text, text, text) to authenticated;
