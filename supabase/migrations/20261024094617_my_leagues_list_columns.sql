-- The leagues list shows each season's dates, format and size.
--
-- UV, 24 Oct: each row on /leagues/ under "Your Leagues" gets columns for the
-- start date, the end date, a ranking (connected once standings exist) and
-- the number of teams and players, and the line under the league's name
-- becomes the discipline and the team size. tdc_my_leagues returned only the
-- start date, so it gains:
--   • ends_on       the season period's end, as starts_on is its start
--   • discipline    from the season's merged rules (the league's, with the
--                   season's overrides), read through
--                   private.tdc_rules_for_league_season, the one place that
--                   merge is done
--   • team_size     the same rules, through private.tdc_team_size
--   • team_count    teams in the season
--   • player_count  active players in the season (UV: the whole league, not
--                   one team). Name Down, withdrawn, inactive and suspended
--                   are not counted, as nothing else that decides who plays
--                   counts them.
-- Counts only, no names: the caller already sees these seasons, because they
-- run them or are entered in them.
--
-- Dropped and recreated for the return type, so the grants are redone as in
-- 20261022190000. Patched from that definition, extracted from a freshly reset
-- local database; the diff is additions only.
--
-- The site must not deploy before this is pushed: leagues.js reads the new
-- columns.

drop function public.tdc_my_leagues(integer);
CREATE OR REPLACE FUNCTION public.tdc_my_leagues(p_limit integer DEFAULT 50)
 RETURNS TABLE(league_season_id uuid, league_name text, name text, season_name text, starts_on date, venue_name text, i_run_it boolean, my_team_id uuid, my_team_name text, i_captain boolean, my_status text, confirmed_at timestamp with time zone, ends_on date, discipline text, team_size integer, team_count integer, player_count integer)
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
			where pc.league_season_id = s.id and pc.status = 'active')
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
