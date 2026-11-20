-- The league's average on its stars (UV, 20 Nov 2026; docs/design/player-star.md).
--
-- tdc_league_star_average(season): the counts of every player's frames in one
-- league season, pooled, in the same nine counts the star is drawn from
-- (player-star.js, TDCStar.count), so the page can draw the league's average as
-- a line on a player's star. Counted as the profile counts: finished frames of
-- finished matches, doubles left out, a walkover ('default') left out, a frame
-- once per player in it. It is a total, not anyone's own frames, so it can be
-- read by anyone signed in (as the standings are).
--   fp  frames played        fw   won
--   b   frames broken        bw   won on own break      bf  break & finish or golden break
--   ob  opponent broke       obw  won on their break
--   r   break result recorded    i  breaks in

create or replace function public.tdc_league_star_average(p_league_season_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
	if (select auth.uid()) is null then
		raise exception 'Sign in to see a league''s average.';
	end if;
	return (
		select jsonb_build_object(
			'fp', count(*),
			'fw', count(*) filter (where f.winner_side = fp.side),
			'b', count(*) filter (where f.break_side = fp.side),
			'bw', count(*) filter (where f.break_side = fp.side and f.winner_side = fp.side),
			'bf', count(*) filter (where f.break_side = fp.side and f.winner_side = fp.side
				and f.result_event in ('break_and_finish', 'golden_break')),
			'ob', count(*) filter (where f.break_side is not null and f.break_side <> fp.side),
			'obw', count(*) filter (where f.break_side is not null and f.break_side <> fp.side and f.winner_side = fp.side),
			'r', count(*) filter (where f.break_side = fp.side and f.break_outcome is not null),
			'i', count(*) filter (where f.break_side = fp.side and f.break_outcome = 'in')
		)
		from public.tbl_league_fixtures x
		join public.tbl_matches m on m.id = x.match_id and m.status = 'complete'
		join public.tbl_frames f on f.match_id = m.id and f.status = 'complete'
		join public.tbl_frame_participants fp on fp.frame_id = f.id
		where x.league_season_id = p_league_season_id
			and f.result_event is distinct from 'default'
			and not exists (select 1 from public.tbl_match_side_players d where d.match_id = m.id)
	);
end;
$function$;

revoke execute on function public.tdc_league_star_average(uuid) from public, anon;
grant execute on function public.tdc_league_star_average(uuid) to authenticated;
