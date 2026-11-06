-- The feed on /players/: matches being played and results from the players I
-- follow (UV, 5 Nov; docs/systems/players.md, "The feed"). Read only.
--
-- Settled with UV the same day:
--   - Playing now and finished results; nothing not yet started.
--   - A league night is one row, team v team with the team score, naming the
--     followed players in it.
--   - A result reads finished as soon as it is scored, before it is settled:
--     once a card has been submitted, once a race is reached, or once every
--     frame of a team night has a result. So a result still waiting on a second
--     captain or a coordinator reads finished here, while its match says more.
--
-- A team night comes only through its frames, which are made when both lineups
-- lock, so this never reads the order, a blind exchange until then.
--
-- It shows nothing a signed-in player could not already see on those players'
-- profiles, and says nothing about who follows anybody: only the person asking
-- has their own feed, and tbl_player_follows stays unreadable.
--
-- The score is counted from the frames (CLAUDE.md, idea 1). The card state is
-- worked out only for a match not yet complete, since a player followed can
-- have many finished ones. An abandoned match is left out (Claude's).

create function public.tdc_my_feed(p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	),
	followed as (
		select f.followed_id as id
		from public.tbl_player_follows f
		where f.follower_id = (select id from me)
	),
	seen as (
		select m.id as match_id, m.home_player_id as player_id, 'home' as side
		from public.tbl_matches m
		where m.home_player_id in (select id from followed)
		union
		select m.id, m.away_player_id, 'away'
		from public.tbl_matches m
		where m.away_player_id in (select id from followed)
		union
		select f.match_id, fp.player_id, fp.side
		from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id
		where fp.player_id in (select id from followed)
	),
	counted as (
		select m.*,
			m.home_side_kind = 'team' and m.away_side_kind = 'team' as team_match,
			coalesce(m.started_at, m.scheduled_at, m.created_at) as played_at,
			(select count(*)::integer from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side = 'home') as home_frames,
			(select count(*)::integer from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side = 'away') as away_frames
		from public.tbl_matches m
		where m.status in ('in_progress', 'complete')
			and m.id in (select match_id from seen)
	),
	judged as (
		select c.*,
			case
				when c.status = 'complete' then true
				when c.team_match then
					private.tdc_card_state(c.id)->>'state' in ('awaiting', 'agreed', 'approved', 'disputed')
					or (exists (select 1 from public.tbl_frames f where f.match_id = c.id)
						and not exists (select 1 from public.tbl_frames f where f.match_id = c.id and f.status not in ('complete', 'abandoned')))
				when c.rules->>'win_condition_type' = 'race_to'
					and greatest(c.home_frames, c.away_frames) >= (c.rules->>'win_condition_target')::integer then true
				when c.rules->>'win_condition_type' = 'best_of'
					and greatest(c.home_frames, c.away_frames) > (c.rules->>'win_condition_target')::integer / 2 then true
				else private.tdc_card_state(c.id)->>'state' in ('awaiting', 'agreed', 'approved', 'disputed')
			end as finished
		from counted c
	),
	shown as (
		select * from judged
		order by finished, played_at desc, id
		limit greatest(1, least(coalesce(p_limit, 10), 200)) + 1
	)
	select jsonb_build_object(
		'follows', exists (select 1 from followed),
		'more', (select count(*) from shown) > greatest(1, least(coalesce(p_limit, 10), 200)),
		'rows', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', s.id,
				'team_match', s.team_match,
				'finished', s.finished,
				'home', case when s.home_side_kind = 'team' then coalesce(ht.name, 'Team') else coalesce(hp.display_name, 'TDC (Error)') end,
				'away', case when s.away_side_kind = 'team' then coalesce(awt.name, 'Team') else coalesce(ap.display_name, 'TDC (Error)') end,
				'home_frames', s.home_frames,
				'away_frames', s.away_frames,
				'played_at', s.played_at,
				'win_condition', s.rules->>'win_condition_type',
				'target', (s.rules->>'win_condition_target')::integer,
				'competition', coalesce(lg.name, tn.name),
				'players', who.names,
				'avatar_path', who.avatar_path,
				'team_picture', case when who.side = 'home' then ht.picture_path else awt.picture_path end
			) order by s.finished, s.played_at desc, s.id)
			from (
				select * from shown
				order by finished, played_at desc, id
				limit greatest(1, least(coalesce(p_limit, 10), 200))
			) s
			cross join lateral (
				select jsonb_agg(x.display_name order by x.display_name) as names,
					(array_agg(x.avatar_path order by x.display_name))[1] as avatar_path,
					(array_agg(x.side order by x.display_name))[1] as side
				from (
					select p.display_name, p.avatar_path, min(e.side) as side
					from seen e
					join public.tbl_players p on p.id = e.player_id
					where e.match_id = s.id
					group by p.id, p.display_name, p.avatar_path
				) x
			) who
			left join public.tbl_players hp on hp.id = s.home_player_id
			left join public.tbl_players ap on ap.id = s.away_player_id
			left join public.tbl_teams ht on ht.id = s.home_team_id
			left join public.tbl_teams awt on awt.id = s.away_team_id
			left join lateral (select x.league_season_id from public.tbl_league_fixtures x where x.match_id = s.id limit 1) lf on true
			left join public.tbl_league_seasons ls on ls.id = lf.league_season_id
			left join public.tbl_leagues lg on lg.id = ls.league_id
			left join lateral (select x.tournament_id from public.tbl_tournament_fixtures x where x.match_id = s.id limit 1) tf on true
			left join public.tbl_tournaments tn on tn.id = tf.tournament_id
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.tdc_my_feed(integer) from public, anon;
grant execute on function public.tdc_my_feed(integer) to authenticated;
