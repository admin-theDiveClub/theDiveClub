-- The player star's Break in spoke (UV, 19 Nov 2026; docs/design/player-star.md).
--
-- tdc_player_profile's frames gain 'break_outcome' ('dry', 'in', 'scratch',
-- 'foul', or null where none was recorded), so the profile can count breaks
-- with a ball in out of breaks with a result recorded. Nothing else changes.
--
-- Patched from its text in a freshly reset database (19 Nov, after
-- 20261119124608_doubles_matches), never retyped: one line added after
-- 'result_event'.

CREATE OR REPLACE FUNCTION public.tdc_player_profile(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
		-- The side of the frames they are in, as tdc_my_matches reads it; a
		-- singles match naming them; a team night's squad (never the order).
		select x.match_id, min(x.side) as side
		from (
			select f.match_id, fp.side
			from public.tbl_frame_participants fp
			join public.tbl_frames f on f.id = fp.frame_id
			where fp.player_id = p_player_id
			union all
			select m.id, case when m.home_player_id = p_player_id then 'home' else 'away' end
			from public.tbl_matches m
			where p_player_id in (m.home_player_id, m.away_player_id)
			-- Doubles (20261119124608): any seat, before a frame is played too.
			union all
			select s.match_id, s.side
			from public.tbl_match_side_players s
			where s.player_id = p_player_id
			union all
			select q.match_id, q.side
			from public.tbl_league_match_squad q
			where q.player_id = p_player_id
		) x
		group by x.match_id
	),
	counted as (
		select m.id, m.home_side_kind, m.away_side_kind, m.home_player_id, m.away_player_id,
			m.home_team_id, m.away_team_id, m.rules, m.status, s.side,
			-- Doubles (20261119124608): listed, never counted in singles numbers (UV, 19 Nov).
			exists (select 1 from public.tbl_match_side_players d where d.match_id = m.id) as doubles,
			coalesce(m.started_at, m.scheduled_at, m.created_at) as played_at,
			(select count(*) from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side = s.side)::integer as mine,
			(select count(*) from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side <> s.side)::integer as theirs
		from in_match s
		join public.tbl_matches m on m.id = s.match_id
	)
	select jsonb_build_object(
		'player', (
			select jsonb_build_object(
				'player_id', p.id,
				'display_name', p.display_name,
				'full_name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
				'surname', nullif(trim(p.last_name), ''),
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
				'status', c.status,
				'played_at', c.played_at,
				'kind', case when lf.match_id is not null then 'league'
					when tf.match_id is not null then 'tournament' else 'social' end,
				'competition', coalesce(lg.name, tn.name),
				'discipline', c.rules ->> 'discipline',
				'team_match', c.home_side_kind = 'team' and c.away_side_kind = 'team',
				'my_side', c.side,
				'my_team', mt.name,
				'opponent', case when op_kind = 'team' then coalesce(ot.name, 'Team')
					else coalesce(private.tdc_doubles_side_name(c.id, case when c.side = 'home' then 'away' else 'home' end),
						op.display_name, 'TDC (Error)') end,
				-- Doubles (20261119124608): the flag the page counts by, and the
				-- partner(s), "Bob" (every other seat of their side, in order).
				'doubles', c.doubles,
				'partner', case when c.doubles then (
					select string_agg(coalesce(pp.display_name, 'TDC (Error)'), ' & ' order by sp.seat)
					from public.tbl_match_side_players sp
					left join public.tbl_players pp on pp.id = sp.player_id
					where sp.match_id = c.id and sp.side = c.side and sp.player_id <> p_player_id) end,
				'opponent_player_id', op.id,
				'opponent_avatar', case when op_kind = 'team' then null else op.avatar_path end,
				'opponent_team_id', ot.id,
				'opponent_team_picture', ot.picture_path,
				'mine', c.mine,
				'theirs', c.theirs,
				'venues', private.tdc_match_venue_list(c.id)
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
				'result_event', f.result_event,
				'break_outcome', f.break_outcome
			) order by c.played_at desc, f.frame_no)
			from counted c
			join public.tbl_frames f on f.match_id = c.id and f.status = 'complete'
			join public.tbl_frame_participants fp on fp.frame_id = f.id and fp.player_id = p_player_id
			where c.status = 'complete'   -- what is counted: finished matches only
				and not c.doubles         -- and singles numbers only (20261119124608)
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
				'status', e.status,
				'venues', private.tdc_season_venue_list(ls.id)
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
$function$

;
