-- What this person is in right now, for the profile menu's middle (UV, 5 Nov;
-- docs/ui.md, "The profile menu"). Read only: three lists, each row one tap
-- from opening it.
--
-- Why not tdc_my_matches, tdc_my_leagues and tdc_my_tournaments alone (UV chose
-- this, 5 Nov):
--   1. tdc_my_matches finds a team night through its frames, and the frames
--      are made when both lineups lock. So a captain whose lineup is not set,
--      which is when the link matters most, had no match to tap.
--   2. tdc_my_tournaments lists a tournament the person withdrew from and does
--      not say so.
--
-- Matches are read here, limited to the active ones: the menu is opened often,
-- and tdc_my_matches works out the card state three times for each of up to
-- 200 rows. Leagues and tournaments read the two existing functions and filter
-- them, so who counts as in one stays decided in one place.
--
-- A team night before the lock is found through the squad (open to read) and
-- the captain, never the order, which is a blind exchange until both sides
-- lock: the same rule as tdc_player_profile (20261105064410).
--
-- set_lineup, and needs_me being true for it, are Claude's, for UV to judge:
-- until now "Needs you" on a team card meant only a signature.

create function public.tdc_my_active()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	),
	active as (
		select m.* from public.tbl_matches m
		where m.status in ('scheduled', 'in_progress')
	),
	mine as (
		select a.id as match_id,
			case when a.home_player_id = (select id from me) then 'home' else 'away' end as side
		from active a
		where (select id from me) in (a.home_player_id, a.away_player_id)
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
		where e.player_id = (select id from me) and e.is_captain and e.status = 'active'
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
						and (f.card->>'submitted_by')::uuid is distinct from (select id from me), false)
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
					when n.refereeing then
						(case when n.home_side_kind = 'team' then coalesce(ht.name, 'Team') else coalesce(hp.display_name, 'TDC (Error)') end)
						|| ' : '
						|| (case when n.away_side_kind = 'team' then coalesce(awt.name, 'Team') else coalesce(ap.display_name, 'TDC (Error)') end)
					when n.side = 'home' then
						case when n.away_side_kind = 'team' then coalesce(awt.name, 'Team') else coalesce(ap.display_name, 'TDC (Error)') end
					else
						case when n.home_side_kind = 'team' then coalesce(ht.name, 'Team') else coalesce(hp.display_name, 'TDC (Error)') end
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
$$;

revoke execute on function public.tdc_my_active() from public, anon;
grant execute on function public.tdc_my_active() to authenticated;
