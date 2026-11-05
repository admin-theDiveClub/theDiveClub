-- A player's profile page, /players/?p=<id> (UV, 5 Nov: the combined design,
-- artboard D on the "Player Profile Designs" canvas). Two read functions; the
-- page counts every number from what they return (frames are the only record).
--
-- tdc_player_profile(player)
--   player   who they are: display and full name, picture, since, verified
--            (an identifier with a verification not revoked, at any venue;
--            only the yes or no leaves the database), is_me
--   matches  every match they played a frame in, newest first, with its score
--            counted from the frames. A team night is theirs too (UV, 5 Nov:
--            "a match they played a frame in, won if their side won"), so mine
--            and theirs are the two sides' frames, not the player's own.
--   frames   their own frames in those matches: won, broke (null where breaks
--            were not tracked), the result event
--   teams    every league season they are entered in, with team and captaincy
--
-- tdc_head_to_head(player): the signed-in player against that one. Only
-- frames the two played against each other count (on a team night two
-- players can be in the same match and never meet). A meeting is a match
-- holding at least one such frame; it is won by whoever won more of them.
--
-- What counts (Claude's, for UV to judge): only matches whose status is
-- 'complete', and only their complete frames. A social match still in progress,
-- or a league night not yet signed by both, adds nothing until it is finished;
-- an abandoned match never does. The period filter (All time, 90 days, 30
-- days) is done by the page on played_at, as /matches/ dates a match.
--
-- Both signed in only (UV, 5 Nov): frames are readable by signed-in users
-- alone. Not new exposure: names are already readable by any signed-in user
-- (docs/STATUS.md, B2).

create function public.tdc_player_profile(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_me uuid;
	v_out jsonb;
begin
	if (select auth.uid()) is null then
		raise exception 'Sign in to see a player''s profile.';
	end if;
	if not exists (select 1 from public.tbl_players p where p.id = p_player_id) then
		raise exception 'No player with that id. Check the link.';
	end if;
	select p.id into v_me from public.tbl_players p where p.user_id = (select auth.uid());

	with in_match as (
		-- The side of the frames they are in, as tdc_my_matches reads it.
		select f.match_id, min(fp.side) as side
		from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id
		where fp.player_id = p_player_id
		group by f.match_id
	),
	counted as (
		select m.id, m.home_side_kind, m.away_side_kind, m.home_player_id, m.away_player_id,
			m.home_team_id, m.away_team_id, m.rules, s.side,
			coalesce(m.started_at, m.scheduled_at, m.created_at) as played_at,
			(select count(*) from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side = s.side)::integer as mine,
			(select count(*) from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side <> s.side)::integer as theirs
		from in_match s
		join public.tbl_matches m on m.id = s.match_id
		where m.status = 'complete'
	)
	select jsonb_build_object(
		'player', (
			select jsonb_build_object(
				'player_id', p.id,
				'display_name', p.display_name,
				'full_name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
				'avatar_path', p.avatar_path,
				'since', p.created_at,
				'verified', exists (
					select 1 from public.tbl_player_identifiers i
					join public.tbl_identifier_verifications v on v.identifier_id = i.id
					where i.player_id = p.id and v.revoked_at is null),
				'is_me', p.id is not distinct from v_me
			)
			from public.tbl_players p where p.id = p_player_id
		),
		'matches', coalesce((
			select jsonb_agg(jsonb_build_object(
				'match_id', c.id,
				'played_at', c.played_at,
				'kind', case when lf.match_id is not null then 'league'
					when tf.match_id is not null then 'tournament' else 'social' end,
				'competition', coalesce(lg.name, tn.name),
				'discipline', c.rules ->> 'discipline',
				'team_match', c.home_side_kind = 'team' and c.away_side_kind = 'team',
				'my_side', c.side,
				'my_team', mt.name,
				'opponent', case when op_kind = 'team' then coalesce(ot.name, 'Team')
					else coalesce(op.display_name, 'TDC (Error)') end,
				'opponent_player_id', op.id,
				'opponent_avatar', case when op_kind = 'team' then null else op.avatar_path end,
				'opponent_team_id', ot.id,
				'opponent_team_picture', ot.picture_path,
				'mine', c.mine,
				'theirs', c.theirs
			) order by c.played_at desc)
			from counted c
			cross join lateral (select case when c.side = 'home' then c.away_side_kind else c.home_side_kind end as op_kind) k
			left join public.tbl_players op
				on op.id = case when c.side = 'home' then c.away_player_id else c.home_player_id end
			left join public.tbl_teams ot
				on ot.id = case when c.side = 'home' then c.away_team_id else c.home_team_id end
			left join public.tbl_teams mt
				on mt.id = case when c.side = 'home' then c.home_team_id else c.away_team_id end
			left join lateral (select x.match_id, x.league_season_id from public.tbl_league_fixtures x where x.match_id = c.id limit 1) lf on true
			left join public.tbl_league_seasons ls on ls.id = lf.league_season_id
			left join public.tbl_leagues lg on lg.id = ls.league_id
			left join lateral (select x.match_id, x.tournament_id from public.tbl_tournament_fixtures x where x.match_id = c.id limit 1) tf on true
			left join public.tbl_tournaments tn on tn.id = tf.tournament_id
		), '[]'::jsonb),
		'frames', coalesce((
			select jsonb_agg(jsonb_build_object(
				'match_id', f.match_id,
				'frame_no', f.frame_no,
				'at', coalesce(f.ended_at, f.started_at, c.played_at),
				'won', coalesce(f.winner_side = fp.side, false),
				'broke', case when f.break_side is null then null else f.break_side = fp.side end,
				'result_event', f.result_event
			) order by c.played_at desc, f.frame_no)
			from counted c
			join public.tbl_frames f on f.match_id = c.id and f.status = 'complete'
			join public.tbl_frame_participants fp on fp.frame_id = f.id and fp.player_id = p_player_id
		), '[]'::jsonb),
		'teams', coalesce((
			select jsonb_agg(jsonb_build_object(
				'league_season_id', ls.id,
				'season_name', ls.name,
				'league_id', lg.id,
				'league_name', lg.name,
				'league_picture', lg.picture_path,
				'discipline', private.tdc_rules_for_league_season(ls.id) ->> 'discipline',
				'team_id', t.id,
				'team_name', t.name,
				'team_picture', t.picture_path,
				'is_captain', coalesce(e.is_captain, false),
				'status', e.status
			) order by ls.created_at desc)
			from public.tbl_league_season_entrants e
			join public.tbl_league_seasons ls on ls.id = e.league_season_id
			join public.tbl_leagues lg on lg.id = ls.league_id
			left join public.tbl_teams t on t.id = e.team_id
			where e.player_id = p_player_id and e.status in ('active', 'inactive')
		), '[]'::jsonb)
	) into v_out;

	return v_out;
end;
$$;

revoke execute on function public.tdc_player_profile(uuid) from public, anon;
grant  execute on function public.tdc_player_profile(uuid) to authenticated;


create function public.tdc_head_to_head(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_me uuid;
	v_out jsonb;
begin
	if (select auth.uid()) is null then
		raise exception 'Sign in to compare yourself with a player.';
	end if;
	if not exists (select 1 from public.tbl_players p where p.id = p_player_id) then
		raise exception 'No player with that id. Check the link.';
	end if;
	select p.id into v_me from public.tbl_players p where p.user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): this account has no player record.';
	end if;
	if v_me = p_player_id then
		return jsonb_build_object('me', v_me, 'same', true, 'meetings', '[]'::jsonb);
	end if;

	with met as (
		-- Frames the two played on opposite sides.
		select f.match_id, f.frame_no,
			coalesce(f.ended_at, f.started_at, coalesce(m.started_at, m.scheduled_at, m.created_at)) as at,
			coalesce(m.started_at, m.scheduled_at, m.created_at) as played_at,
			coalesce(f.winner_side = a.side, false) as won,
			case when f.break_side is null then null else f.break_side = a.side end as broke
		from public.tbl_frame_participants a
		join public.tbl_frame_participants b on b.frame_id = a.frame_id and b.side <> a.side
		join public.tbl_frames f on f.id = a.frame_id and f.status = 'complete'
		join public.tbl_matches m on m.id = f.match_id and m.status = 'complete'
		where a.player_id = v_me and b.player_id = p_player_id
	)
	select jsonb_build_object(
		'me', v_me,
		'same', false,
		'meetings', coalesce((
			select jsonb_agg(jsonb_build_object(
				'match_id', g.match_id,
				'played_at', g.played_at,
				'kind', case when lf.match_id is not null then 'league'
					when tf.match_id is not null then 'tournament' else 'social' end,
				'competition', coalesce(lg.name, tn.name),
				'team_match', mm.home_side_kind = 'team' and mm.away_side_kind = 'team',
				'home_team', ht.name,
				'away_team', awt.name,
				'mine', g.mine,
				'theirs', g.theirs,
				'frames', g.frames
			) order by g.played_at desc)
			from (
				select met.match_id, min(met.played_at) as played_at,
					count(*) filter (where met.won)::integer as mine,
					count(*) filter (where not met.won)::integer as theirs,
					jsonb_agg(jsonb_build_object('frame_no', met.frame_no, 'at', met.at, 'won', met.won, 'broke', met.broke)
						order by met.frame_no) as frames
				from met
				group by met.match_id
			) g
			join public.tbl_matches mm on mm.id = g.match_id
			left join public.tbl_teams ht on ht.id = mm.home_team_id
			left join public.tbl_teams awt on awt.id = mm.away_team_id
			left join lateral (select x.match_id, x.league_season_id from public.tbl_league_fixtures x where x.match_id = g.match_id limit 1) lf on true
			left join public.tbl_league_seasons ls on ls.id = lf.league_season_id
			left join public.tbl_leagues lg on lg.id = ls.league_id
			left join lateral (select x.match_id, x.tournament_id from public.tbl_tournament_fixtures x where x.match_id = g.match_id limit 1) tf on true
			left join public.tbl_tournaments tn on tn.id = tf.tournament_id
		), '[]'::jsonb)
	) into v_out;

	return v_out;
end;
$$;

revoke execute on function public.tdc_head_to_head(uuid) from public, anon;
grant  execute on function public.tdc_head_to_head(uuid) to authenticated;
