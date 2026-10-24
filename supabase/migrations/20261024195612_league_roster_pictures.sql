-- A player's picture beside their name on the season page (UV, 24 Oct): a
-- team's roster and the people running the league now carry avatar_path.
--
-- The path is the object in the public player-avatars bucket (migration
-- player_avatars): the page builds the URL. Public on purpose, as that
-- migration explains, so nothing new becomes readable that a page could not
-- already show beside the same name.
--
-- Both functions' results change, so each is dropped and made again from its
-- latest text (tdc_team_roster 20261022190000, tdc_league_officials
-- 20261022180000), patched, not retyped: one column added to the result and
-- to the select. Nothing else calls them.

drop function public.tdc_team_roster(uuid);

CREATE FUNCTION public.tdc_team_roster(p_team_id uuid)
 RETURNS TABLE(player_id uuid, display_name text, is_captain boolean, status text, confirmed boolean, avatar_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id, p.display_name, e.is_captain, e.status, e.confirmed_at is not null, p.avatar_path
	from public.tbl_league_season_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.team_id = p_team_id
	order by e.is_captain desc, p.display_name;
$function$;

revoke execute on function public.tdc_team_roster(uuid) from public, anon;
grant execute on function public.tdc_team_roster(uuid) to authenticated;

drop function public.tdc_league_officials(uuid);

create function public.tdc_league_officials(p_league_season_id uuid)
returns table (
	role_id      uuid,
	player_id    uuid,
	display_name text,
	role         text,
	role_name    text,
	rank         integer,
	avatar_path  text
)
language sql
stable
security definer
set search_path = ''
as $$
	select r.id, p.id, p.display_name, r.role,
		-- The lookup says "Tournament director"; on a league it is the League's.
		case when r.role = 'director' then 'League director' else t.name end,
		t.rank,
		p.avatar_path
	from public.tbl_competition_roles r
	join public.tbl_players p on p.id = r.player_id
	join public.tbl_competition_role_types t on t.key = r.role
	where r.league_season_id = p_league_season_id
	order by t.rank desc, p.display_name;
$$;

revoke execute on function public.tdc_league_officials(uuid) from public, anon;
grant execute on function public.tdc_league_officials(uuid) to authenticated;
