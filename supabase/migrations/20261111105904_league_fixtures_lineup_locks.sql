-- The fixtures say whether each side has locked its lineup (UV, 11 Nov).
--
-- A player's fixtures now show a match's state (docs/systems/leagues.md, "The
-- Fixtures tab for a player"): open for lineups, a side's name turns yellow once
-- that side has locked. tdc_league_fixtures gains home_locked and away_locked,
-- read from tbl_league_match_sides (20261022230000). Whether a side has locked
-- is no secret: the card shows it to every signed-in player; who is in the
-- lineup stays behind tdc_match_lineup's blind exchange.
--
-- The function's text is 20261105200430's, copied, with the two columns, their
-- two joins and the comment added; nothing else changed. A new return type
-- needs the drop.

drop function public.tdc_league_fixtures(uuid);

CREATE OR REPLACE FUNCTION public.tdc_league_fixtures(p_league_season_id uuid)
 RETURNS TABLE(fixture_id uuid, round integer, "position" integer, scheduled_at timestamp with time zone, home_team_id uuid, home_name text, away_team_id uuid, away_name text, is_bye boolean, match_id uuid, match_status text, home_frames integer, away_frames integer, notes text, table_numbers integer[], venue_id uuid, venue_name text, venue_inherited boolean, home_locked boolean, away_locked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select f.id, f.round, f."position", f.scheduled_at,
		f.home_team_id, h.name,
		f.away_team_id, a.name,
		f.away_team_id is null,
		f.match_id,
		-- A signed night changed since (UV, 29 Oct) reads 'reopened'. The
		-- match itself stays complete, so its fixture stays locked as a signed
		-- night is (20261025072000) until it is signed again or the change is
		-- undone. Only a complete match is asked, so the rest cost nothing.
		case when m.status = 'complete' then
			case when coalesce((private.tdc_card_state(m.id)->>'reopened')::boolean, false)
				then 'reopened' else 'complete' end
			else m.status end,
		s.home_score, s.away_score,
		f.notes,
		f.table_numbers,
		-- Its own venue, or else the season's when the season has exactly one.
		-- A blank fixture in a season at several has none: naming the first
		-- could send a player to the wrong club, so the page lists the season's.
		coalesce(f.venue_id, sv.venue_id),
		coalesce(fv.name, sv.venue_name),
		f.venue_id is null and sv.venue_id is not null,
		-- Whether each side has locked its lineup (20261111105904; UV, 11 Nov):
		-- the fixtures show a locked side's name in yellow. Not a secret: the
		-- card says it to every signed-in player.
		coalesce(hs.locked_at is not null, false),
		coalesce(aws.locked_at is not null, false)
	from public.tbl_league_fixtures f
	join public.tbl_teams h on h.id = f.home_team_id
	left join public.tbl_teams a on a.id = f.away_team_id
	left join public.tbl_matches m on m.id = f.match_id
	left join lateral private.tdc_match_score(f.match_id) s on f.match_id is not null
	left join public.tbl_venues fv on fv.id = f.venue_id
	left join public.tbl_league_match_sides hs on hs.match_id = f.match_id and hs.side = 'home'
	left join public.tbl_league_match_sides aws on aws.match_id = f.match_id and aws.side = 'away'
	left join lateral (
		select (array_agg(v.id))[1] as venue_id, (array_agg(v.name))[1] as venue_name
		from public.tbl_league_season_venues lv
		join public.tbl_venues v on v.id = lv.venue_id
		where lv.league_season_id = f.league_season_id
		having count(*) = 1
	) sv on true
	where (select auth.uid()) is not null
		and f.league_season_id = p_league_season_id
	order by f.round, f."position";
$function$;

revoke execute on function public.tdc_league_fixtures(uuid) from public, anon;
grant execute on function public.tdc_league_fixtures(uuid) to authenticated;
