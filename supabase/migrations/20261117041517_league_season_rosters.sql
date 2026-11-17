-- Every team's roster in a season, in one call (UV, 17 Nov: as fast as it can
-- load; docs/systems/foundations.md, "Reading fast").
--
-- The Season tab read the team list, waited for it, then called
-- tdc_team_roster once per team: a second round trip to the database (about
-- 0.2 s each from Johannesburg to eu-west-1) on every load and every re-read
-- after a save. This needs only the season, so the page sends it with its first
-- batch.
--
-- The select is tdc_team_roster's (20261024195612), copied: the same columns
-- and the same order within a team, the same rule on who may call it (signed
-- in, through the grant), plus team_id so the page can split the rows. Entrants
-- with no team (a singles league, or not yet placed) have no roster and are
-- left out. tdc_team_roster stays: the match card reads its two teams with it.

CREATE FUNCTION public.tdc_league_season_rosters(p_league_season_id uuid)
 RETURNS TABLE(team_id uuid, player_id uuid, display_name text, is_captain boolean, status text, confirmed boolean, avatar_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select e.team_id, p.id, p.display_name, e.is_captain, e.status, e.confirmed_at is not null, p.avatar_path
	from public.tbl_league_season_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.league_season_id = p_league_season_id
		and e.team_id is not null
	order by e.team_id, e.is_captain desc, p.display_name;
$function$;

revoke execute on function public.tdc_league_season_rosters(uuid) from public, anon;
grant execute on function public.tdc_league_season_rosters(uuid) to authenticated;
