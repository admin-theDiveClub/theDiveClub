-- The nav menu's league rows know whether a league is singles (UV, 20 Nov 2026).
--
-- tdc_my_active's leagues gain 'team_size' (one line, from tdc_my_leagues, which
-- already returns it), so the menu can leave "Captain" off a singles league,
-- where every player is captain of a team of one. Nothing else changes.
--
-- Patched from the latest definition (20261119124608_doubles_matches), never retyped.

CREATE OR REPLACE FUNCTION public.tdc_my_active()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	),
	active as (
		select m.* from public.tbl_matches m
		where m.status in ('scheduled', 'in_progress')
			-- A team night only while it is on the schedule (UV, 18 Nov).
			and (not (m.home_side_kind = 'team' and m.away_side_kind = 'team')
				or exists (select 1 from public.tbl_league_fixtures lf where lf.match_id = m.id))
	),
	mine as (
		select a.id as match_id,
			case when a.home_player_id = (select id from me) then 'home' else 'away' end as side
		from active a
		where (select id from me) in (a.home_player_id, a.away_player_id)
		-- Doubles (20261119124608): any seat, before a frame is played too.
		union
		select a.id, s.side
		from public.tbl_match_side_players s
		join active a on a.id = s.match_id
		where s.player_id = (select id from me)
		union
		select a.id, fp.side
		from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id
		join active a on a.id = f.match_id
		where fp.player_id = (select id from me)
		union
		select a.id, q.side
		from public.tbl_league_match_squad q
		join active a on a.id = q.match_id
		where q.player_id = (select id from me)
		union
		select a.id, case when e.team_id = a.home_team_id then 'home' else 'away' end
		from public.tbl_league_season_entrants e
		join active a on e.team_id in (a.home_team_id, a.away_team_id)
		where e.player_id = (select id from me) and e.status = 'active'
		union
		select a.id, 'ref'
		from active a
		where a.referee_player_id = (select id from me)
	),
	one_side as (
		-- As tdc_my_matches: a referee reads the score home first.
		select match_id,
			case when min(side) = 'ref' then 'home' else min(side) end as side,
			min(side) = 'ref' as refereeing
		from mine group by match_id
	),
	base as (
		select m.*, s.side, s.refereeing,
			m.home_side_kind = 'team' and m.away_side_kind = 'team' as team_match,
			coalesce(m.started_at, m.scheduled_at, m.created_at) as played_at,
			private.tdc_card_state(m.id) as card,
			case when m.home_side_kind = 'team' and m.away_side_kind = 'team'
				then private.tdc_league_match_side(m.id) end as captain_side,
			case when m.home_side_kind = 'team' and m.away_side_kind = 'team'
				then private.tdc_can_run_league(private.tdc_league_season_of_match(m.id))
				else false end as director
		from one_side s
		join public.tbl_matches m on m.id = s.match_id
	),
	flagged as (
		select r.*,
			coalesce(r.captain_side is not null and not exists (
				select 1 from public.tbl_league_match_sides ms
				where ms.match_id = r.id and ms.side = r.captain_side and ms.locked_at is not null
			), false) as set_lineup
		from base r
	),
	needs as (
		select f.*,
			case
				when f.team_match then
					f.set_lineup
					or coalesce(f.card->>'state' = 'awaiting'
						and (f.director or f.card->>'waiting_on' in (f.captain_side, 'both')), false)
				else
					coalesce(not f.refereeing
						and f.card->>'state' = 'awaiting'
						and (f.card->>'submitted_by')::uuid is distinct from (select id from me)
						-- Doubles (20261119124608): nor my partner; the other side answers.
						and private.tdc_side_of_player(f.id, (f.card->>'submitted_by')::uuid) is distinct from f.side, false)
			end as needs_me
		from flagged f
	)
	select jsonb_build_object(
		'matches', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', n.id,
				'status', n.status,
				'team_match', n.team_match,
				'opponent', case
					-- Doubles (20261119124608): "Alice & Bob" in place of seat 1's name.
					when n.refereeing then
						(case when n.home_side_kind = 'team' then coalesce(ht.name, 'Team') else coalesce(private.tdc_doubles_side_name(n.id, 'home'), hp.display_name, 'TDC (Error)') end)
						|| ' : '
						|| (case when n.away_side_kind = 'team' then coalesce(awt.name, 'Team') else coalesce(private.tdc_doubles_side_name(n.id, 'away'), ap.display_name, 'TDC (Error)') end)
					when n.side = 'home' then
						case when n.away_side_kind = 'team' then coalesce(awt.name, 'Team') else coalesce(private.tdc_doubles_side_name(n.id, 'away'), ap.display_name, 'TDC (Error)') end
					else
						case when n.home_side_kind = 'team' then coalesce(ht.name, 'Team') else coalesce(private.tdc_doubles_side_name(n.id, 'home'), hp.display_name, 'TDC (Error)') end
				end,
				'my_frames', (select count(*) from public.tbl_frames f
					where f.match_id = n.id and f.status = 'complete' and f.winner_side = n.side),
				'their_frames', (select count(*) from public.tbl_frames f
					where f.match_id = n.id and f.status = 'complete' and f.winner_side <> n.side),
				'played_at', n.played_at,
				'win_condition', n.rules->>'win_condition_type',
				'target', (n.rules->>'win_condition_target')::integer,
				'card_state', n.card->>'state',
				'needs_me', n.needs_me,
				'set_lineup', n.set_lineup,
				'refereeing', n.refereeing
			)
			-- Needs you first, then what is being played, newest first, then
			-- what is to come, soonest first.
			order by n.needs_me desc, n.status = 'in_progress' desc,
				case when n.status = 'in_progress' then n.played_at end desc,
				n.played_at asc)
			from needs n
			left join public.tbl_players hp on hp.id = n.home_player_id
			left join public.tbl_players ap on ap.id = n.away_player_id
			left join public.tbl_teams ht on ht.id = n.home_team_id
			left join public.tbl_teams awt on awt.id = n.away_team_id
		), '[]'::jsonb),
		'leagues', coalesce((
			select jsonb_agg(jsonb_build_object(
				'league_season_id', l.league_season_id,
				'league_name', l.league_name,
				'season_name', l.season_name,
				'status', l.status,
				'i_run_it', l.i_run_it,
				'my_team_name', l.my_team_name,
				'i_captain', l.i_captain,
				'team_size', l.team_size,
				'my_status', l.my_status,
				'confirmed_at', l.confirmed_at
			) order by l.ordinality)
			from public.tdc_my_leagues(200) with ordinality as l
			where l.status <> 'finished'
				and (l.i_run_it or l.my_status is distinct from 'withdrawn')
		), '[]'::jsonb),
		'tournaments', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', t.id,
				'name', t.name,
				'status', t.status,
				'starts_at', t.starts_at,
				'entrants', t.entrants,
				'i_run_it', t.i_run_it,
				'poster_open', t.poster_open
			) order by t.ordinality)
			from public.tdc_my_tournaments(200) with ordinality as t
			where t.status in ('draft', 'open', 'in_progress')
				and (t.i_run_it or exists (
					select 1 from public.tbl_tournament_entrants e
					where e.tournament_id = t.id
						and e.player_id = (select id from me)
						and e.status <> 'withdrawn'
				))
		), '[]'::jsonb)
	);
$function$
;
