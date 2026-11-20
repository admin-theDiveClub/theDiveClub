-- One-off data clean-up (20 Nov, UV): remove the dummy "Black Ball Singles"
-- league. It had no fixtures and no matches, only 3 teams and 3 entrants.
-- Deleting the league cascades to its league-season, teams, entrants, venues,
-- standing columns, roles and join requests. Players are not touched.
-- The calendar season "26/27" is removed only if no league season uses it.
-- On a database without this league (the local copy) this does nothing.

do $$
declare
	v_league constant uuid := 'b293a410-3edf-4f66-b775-8373ac9e8ea6';
	v_seasons uuid[];
begin
	select coalesce(array_agg(season_id), '{}') into v_seasons
	from public.tbl_league_seasons where league_id = v_league;

	delete from public.tbl_leagues where id = v_league;

	delete from public.tbl_seasons s
	where s.id = any (v_seasons)
		and not exists (select 1 from public.tbl_league_seasons ls where ls.season_id = s.id);
end $$;
