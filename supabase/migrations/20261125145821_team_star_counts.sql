-- Every team's star on the Season tab (UV, 25 Nov 2026; docs/design/player-star.md).
--
-- tdc_team_star_counts(season): for every team in one league season, the same
-- nine counts a league star is drawn from (player-star.js, TDCStar.count),
-- pooled over the frames the team's side played, plus how many of its matches
-- are played and scheduled, so the page draws each team's star as the league
-- star is drawn for a player: UV's standards grey, the league's average
-- (tdc_league_star_average) yellow, the team green, as solid as matches played
-- out of matches scheduled (UV, 25 Nov). In a singles league a team is one
-- player, so this is every player's star there too.
--
-- Counted exactly as tdc_league_star_average counts (migration 20261120080000):
-- finished frames of finished matches, doubles left out, a walkover ('default')
-- left out. A bye (no away team) is neither played nor scheduled.
-- Signed in only, as the standings and the league's average (UV, 25 Nov).
--   fp  frames played        fw   won
--   b   frames broken        bw   won on own break      bf  break & finish or golden break
--   ob  opponent broke       obw  won on their break
--   r   break result recorded    i  breaks in
--   played     the team's matches finished      scheduled  the team's fixtures with an opponent

create or replace function public.tdc_team_star_counts(p_league_season_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
	if (select auth.uid()) is null then
		raise exception 'Sign in to see the teams'' stars.';
	end if;
	return (
		with sides as (
			select x.match_id, x.home_team_id as team_id, 'home'::text as side
			from public.tbl_league_fixtures x
			where x.league_season_id = p_league_season_id and x.away_team_id is not null
			union all
			select x.match_id, x.away_team_id, 'away'
			from public.tbl_league_fixtures x
			where x.league_season_id = p_league_season_id and x.away_team_id is not null
		),
		nights as (
			select s.team_id,
				count(*) as scheduled,
				count(*) filter (where m.status = 'complete') as played
			from sides s
			left join public.tbl_matches m on m.id = s.match_id
			group by s.team_id
		),
		frames as (
			select s.team_id,
				count(*) as fp,
				count(*) filter (where f.winner_side = fp.side) as fw,
				count(*) filter (where f.break_side = fp.side) as b,
				count(*) filter (where f.break_side = fp.side and f.winner_side = fp.side) as bw,
				count(*) filter (where f.break_side = fp.side and f.winner_side = fp.side
					and f.result_event in ('break_and_finish', 'golden_break')) as bf,
				count(*) filter (where f.break_side is not null and f.break_side <> fp.side) as ob,
				count(*) filter (where f.break_side is not null and f.break_side <> fp.side and f.winner_side = fp.side) as obw,
				count(*) filter (where f.break_side = fp.side and f.break_outcome is not null) as r,
				count(*) filter (where f.break_side = fp.side and f.break_outcome = 'in') as i
			from sides s
			join public.tbl_matches m on m.id = s.match_id and m.status = 'complete'
			join public.tbl_frames f on f.match_id = m.id and f.status = 'complete'
			join public.tbl_frame_participants fp on fp.frame_id = f.id and fp.side = s.side
			where f.result_event is distinct from 'default'
				and not exists (select 1 from public.tbl_match_side_players d where d.match_id = m.id)
			group by s.team_id
		)
		select coalesce(jsonb_agg(jsonb_build_object(
			'team_id', t.id,
			'fp', coalesce(c.fp, 0), 'fw', coalesce(c.fw, 0),
			'b', coalesce(c.b, 0), 'bw', coalesce(c.bw, 0), 'bf', coalesce(c.bf, 0),
			'ob', coalesce(c.ob, 0), 'obw', coalesce(c.obw, 0),
			'r', coalesce(c.r, 0), 'i', coalesce(c.i, 0),
			'played', coalesce(n.played, 0), 'scheduled', coalesce(n.scheduled, 0)
		)), '[]'::jsonb)
		from public.tbl_teams t
		left join nights n on n.team_id = t.id
		left join frames c on c.team_id = t.id
		where t.league_season_id = p_league_season_id
	);
end;
$function$;

revoke execute on function public.tdc_team_star_counts(uuid) from public, anon;
grant execute on function public.tdc_team_star_counts(uuid) to authenticated;
