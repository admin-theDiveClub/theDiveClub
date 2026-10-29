-- A player's full name in the standings (UV, 29 Oct: a switch on the
-- Standings tab between display name, the default, and full name).
-- tdc_league_standings (20261029194712) gains full_name on each player: first
-- and last name, null when neither is set (the page then shows the display
-- name and says so). Nothing else changes.
--
-- Not new exposure: tbl_players' first and last names are already readable
-- by any signed-in user (docs/STATUS.md, B2), which is its own job.
--
-- Made again from 20261029194712's text, patched, not retyped: one key added.

drop function public.tdc_league_standings(uuid, boolean);

create function public.tdc_league_standings(p_league_season_id uuid, p_live boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	with counted as (
		select m.id, m.home_team_id, m.away_team_id, m.status
		from public.tbl_league_fixtures f
		join public.tbl_matches m on m.id = f.match_id
		where f.league_season_id = p_league_season_id
			and (m.status = 'complete'
				-- Live (20261029194712): also a night not yet signed by both, once
				-- it has a finished frame. Never an abandoned one.
				or (p_live and m.status <> 'abandoned' and exists (
					select 1 from public.tbl_frames lf where lf.match_id = m.id and lf.status = 'complete')))
			and m.home_team_id is not null and m.away_team_id is not null
	),
	fr as (
		select f.id, f.match_id, f.winner_side, f.result_event, f.break_side,
			case when f.started_at is not null and f.ended_at is not null
				then greatest(extract(epoch from f.ended_at - f.started_at) - f.paused_seconds, 0) / 60.0
			end as minutes
		from public.tbl_frames f
		join counted c on c.id = f.match_id
		where f.status = 'complete'
	),
	score as (
		select c.id as match_id, c.home_team_id, c.away_team_id,
			count(fr.id) filter (where fr.winner_side = 'home') as home_won,
			count(fr.id) filter (where fr.winner_side = 'away') as away_won
		from counted c
		left join fr on fr.match_id = c.id
		group by c.id, c.home_team_id, c.away_team_id
	),
	-- Each team's side of each counted match, and how it went.
	sides as (
		select match_id, home_team_id as team_id, 'home'::text as side, home_won as mine, away_won as theirs from score
		union all
		select match_id, away_team_id, 'away', away_won, home_won from score
	),
	team_frames as (
		select s.team_id, s.side, fr.*
		from sides s
		join fr on fr.match_id = s.match_id
	),
	player_frames as (
		select p.player_id, tf.*
		from team_frames tf
		join public.tbl_frame_participants p on p.frame_id = tf.id and p.side = tf.side
	),
	people as (
		select e.player_id, e.team_id
		from public.tbl_league_season_entrants e
		where e.league_season_id = p_league_season_id and e.status in ('active', 'inactive')
		union
		select pf.player_id, e.team_id
		from (select distinct player_id from player_frames) pf
		left join public.tbl_league_season_entrants e
			on e.player_id = pf.player_id and e.league_season_id = p_league_season_id
	)
	select jsonb_build_object(
		'matches_counted', (select count(*) from counted),
		'matches_unsigned', (select count(*) from counted where counted.status <> 'complete'),
		'live', p_live,
		-- What a live page watches: every match on the season's fixtures
		-- that is not abandoned (a frame written moves its card_version).
		'watch_match_ids', coalesce((
			select jsonb_agg(m.id)
			from public.tbl_league_fixtures f
			join public.tbl_matches m on m.id = f.match_id
			where f.league_season_id = p_league_season_id and m.status <> 'abandoned'
		), '[]'::jsonb),
		'players', coalesce((
			select jsonb_agg(jsonb_build_object(
				'player_id', pl.id,
				'display_name', pl.display_name,
				-- 20261029203451: the Full names switch. Null when neither is set.
				'full_name', nullif(trim(concat_ws(' ', pl.first_name, pl.last_name)), ''),
				'avatar_path', pl.avatar_path,
				'team_id', pe.team_id,
				'stats', jsonb_build_object(
					'frames_played', fs.played,
					'frames_won', fs.won,
					'frames_lost', fs.played - fs.won,
					'frames_won_home', fs.won_home,
					'frames_won_away', fs.won_away,
					'lags_won', fs.lags,
					'won_with_lag', fs.with_lag,
					'won_without_lag', fs.without_lag,
					'break_and_finish', fs.bf,
					'reverse_break_and_finish', fs.rbf,
					'golden_break', fs.gb,
					'walkovers_won', fs.walkovers,
					'matches_played', ms.played,
					'matches_won', ms.won,
					'matches_lost', ms.lost,
					'matches_drawn', ms.drawn,
					'minutes_played', fs.minutes,
					'frames_timed', fs.timed,
					'leagues_played', hist.leagues,
					'seasons_played', hist.seasons
				)
			) order by pl.display_name)
			from people pe
			join public.tbl_players pl on pl.id = pe.player_id
			cross join lateral (
				select count(*) as played,
					count(*) filter (where pf.winner_side = pf.side) as won,
					count(*) filter (where pf.winner_side = pf.side and pf.side = 'home') as won_home,
					count(*) filter (where pf.winner_side = pf.side and pf.side = 'away') as won_away,
					count(*) filter (where pf.break_side = pf.side) as lags,
					count(*) filter (where pf.winner_side = pf.side and pf.break_side = pf.side) as with_lag,
					count(*) filter (where pf.winner_side = pf.side and pf.break_side <> pf.side) as without_lag,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'break_and_finish') as bf,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'reverse_break_and_finish') as rbf,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'golden_break') as gb,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'default') as walkovers,
					round(coalesce(sum(pf.minutes), 0), 1) as minutes,
					count(pf.minutes) as timed
				from player_frames pf
				where pf.player_id = pe.player_id
			) fs
			cross join lateral (
				select count(*) as played,
					count(*) filter (where s.mine > s.theirs) as won,
					count(*) filter (where s.mine < s.theirs) as lost,
					count(*) filter (where s.mine = s.theirs) as drawn
				from sides s
				where exists (
					select 1 from player_frames pf
					where pf.player_id = pe.player_id and pf.match_id = s.match_id and pf.side = s.side
				)
			) ms
			cross join lateral (
				select count(distinct ls.league_id) as leagues, count(distinct e.league_season_id) as seasons
				from public.tbl_league_season_entrants e
				join public.tbl_league_seasons ls on ls.id = e.league_season_id
				where e.player_id = pe.player_id and e.status in ('active', 'inactive')
			) hist
		), '[]'::jsonb),
		'teams', coalesce((
			select jsonb_agg(jsonb_build_object(
				'team_id', t.id,
				'name', t.name,
				'picture_path', t.picture_path,
				'stats', jsonb_build_object(
					'matches_played', ms.played,
					'matches_won', ms.won,
					'matches_lost', ms.lost,
					'matches_drawn', ms.drawn,
					'matches_won_home', ms.won_home,
					'matches_won_away', ms.won_away,
					'frames_played', fs.played,
					'frames_won', fs.won,
					'frames_lost', fs.played - fs.won,
					'lags_won', fs.lags,
					'won_with_lag', fs.with_lag,
					'won_without_lag', fs.without_lag,
					'break_and_finish', fs.bf,
					'reverse_break_and_finish', fs.rbf,
					'golden_break', fs.gb,
					'walkovers_won', fs.walkovers_won,
					'walkovers_given', fs.walkovers_given,
					'players_used', pu.used,
					'minutes_played', fs.minutes,
					'frames_timed', fs.timed
				)
			) order by t.name)
			from public.tbl_teams t
			cross join lateral (
				select count(*) as played,
					count(*) filter (where s.mine > s.theirs) as won,
					count(*) filter (where s.mine < s.theirs) as lost,
					count(*) filter (where s.mine = s.theirs) as drawn,
					count(*) filter (where s.mine > s.theirs and s.side = 'home') as won_home,
					count(*) filter (where s.mine > s.theirs and s.side = 'away') as won_away
				from sides s
				where s.team_id = t.id
			) ms
			cross join lateral (
				select count(*) as played,
					count(*) filter (where tf.winner_side = tf.side) as won,
					count(*) filter (where tf.break_side = tf.side) as lags,
					count(*) filter (where tf.winner_side = tf.side and tf.break_side = tf.side) as with_lag,
					count(*) filter (where tf.winner_side = tf.side and tf.break_side <> tf.side) as without_lag,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'break_and_finish') as bf,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'reverse_break_and_finish') as rbf,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'golden_break') as gb,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'default') as walkovers_won,
					count(*) filter (where tf.winner_side <> tf.side and tf.result_event = 'default') as walkovers_given,
					round(coalesce(sum(tf.minutes), 0), 1) as minutes,
					count(tf.minutes) as timed
				from team_frames tf
				where tf.team_id = t.id
			) fs
			cross join lateral (
				select count(distinct pf.player_id) as used
				from player_frames pf
				where pf.team_id = t.id
			) pu
			where t.league_season_id = p_league_season_id
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.tdc_league_standings(uuid, boolean) from public, anon;
grant execute on function public.tdc_league_standings(uuid, boolean) to authenticated;
