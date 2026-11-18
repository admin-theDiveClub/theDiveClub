-- A league night taken off the schedule leaves the profile menu and the home
-- page's live card (UV, 18 Nov 2026).
--
-- Found after the first resets in production: The Apprentices v Break and
-- Blaze was reset, then taken off its fixture with Take the match off. The
-- league pages showed the fixture with no match, but the profile menu still
-- listed the empty match, because tdc_my_active lists every scheduled or
-- in-progress match of the reader's team, on a fixture or not. The home
-- page's live card (tdc_my_live_matches with no league given) had the same
-- gap. Not new with the reset: any night taken off its fixture stayed.
--
-- The patch, one filter each:
--   tdc_my_active         a team match counts only while it is on a league
--                         fixture; singles matches are unchanged.
--   tdc_my_live_matches   the team-night branch likewise.
-- Both are copied from their latest text (20261118110234 and 20261118073452)
-- with only those lines and these comments added. Same arguments, so their
-- grants stand; they are repeated as in the originals.

create or replace function public.tdc_my_active()
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
			-- A team night only while it is on the schedule (UV, 18 Nov).
			and (not (m.home_side_kind = 'team' and m.away_side_kind = 'team')
				or exists (select 1 from public.tbl_league_fixtures lf where lf.match_id = m.id))
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


create or replace function public.tdc_my_live_matches(p_league_season_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce((
		select jsonb_agg(x.j order by x.rank, x.at desc)
		from (
			select jsonb_build_object(
				'id', c.id,
				'team_match', c.team_match,
				'state', c.state,
				'opponent', case when c.team_match then coalesce(ot.name, 'Team')
					else coalesce(op.display_name, 'TDC (Error)') end,
				'opponent_kind', case when c.team_match then 'team' else 'player' end,
				'opponent_picture', case when c.team_match then ot.picture_path else op.avatar_path end,
				'my_frames', (select count(*) from public.tbl_frames f
					where f.match_id = c.id and f.status = 'complete' and f.winner_side = c.my_side)::integer,
				'their_frames', (select count(*) from public.tbl_frames f
					where f.match_id = c.id and f.status = 'complete' and f.winner_side <> c.my_side)::integer,
				'competition', coalesce(
					(select l.name from public.tbl_league_fixtures lf
						join public.tbl_league_seasons ls on ls.id = lf.league_season_id
						join public.tbl_leagues l on l.id = ls.league_id
						where lf.match_id = c.id limit 1),
					(select t.name from public.tbl_tournament_fixtures tf
						join public.tbl_tournaments t on t.id = tf.tournament_id
						where tf.match_id = c.id limit 1))
			) as j,
			case when c.state = 'playing' then 0 else 1 end as rank,
			c.at
			from (
				-- A team night for a team I play for
				select m.id, true as team_match,
					case when m.home_team_id = e.team_id then 'home' else 'away' end as my_side,
					case when m.status = 'in_progress'
						or (select count(*) from public.tbl_league_match_sides sd
							where sd.match_id = m.id and sd.locked_at is not null) >= 2
						then 'playing' else 'lineups' end as state,
					coalesce(m.started_at, m.scheduled_at, m.created_at) as at,
					m.home_team_id, m.away_team_id, m.home_player_id, m.away_player_id
				from public.tbl_matches m
				join public.tbl_league_season_entrants e
					on e.team_id in (m.home_team_id, m.away_team_id)
					and e.status = 'active'
					and e.player_id = (select p.id from public.tbl_players p where p.user_id = (select auth.uid()))
				where m.home_side_kind = 'team' and m.away_side_kind = 'team'
					and m.status in ('scheduled', 'in_progress')
					-- Only while it is on the schedule (UV, 18 Nov).
					and exists (select 1 from public.tbl_league_fixtures lf where lf.match_id = m.id)
				union all
				-- A singles match I am playing
				select m.id, false,
					case when m.home_player_id = me.id then 'home' else 'away' end,
					'playing',
					coalesce(m.started_at, m.scheduled_at, m.created_at),
					m.home_team_id, m.away_team_id, m.home_player_id, m.away_player_id
				from public.tbl_matches m
				join public.tbl_players me on me.user_id = (select auth.uid())
					and me.id in (m.home_player_id, m.away_player_id)
				where m.home_side_kind = 'player' and m.away_side_kind = 'player'
					and m.status = 'in_progress'
			) c
			left join public.tbl_teams ot
				on ot.id = case when c.my_side = 'home' then c.away_team_id else c.home_team_id end
			left join public.tbl_players op
				on op.id = case when c.my_side = 'home' then c.away_player_id else c.home_player_id end
			-- On a league's page, that league's nights only (UV, 18 Nov)
			where p_league_season_id is null
				or exists (select 1 from public.tbl_league_fixtures lf
					where lf.match_id = c.id and lf.league_season_id = p_league_season_id)
			order by rank, c.at desc
			limit 3
		) x
	), '[]'::jsonb);
$$;

revoke execute on function public.tdc_my_live_matches(uuid) from public, anon;
grant execute on function public.tdc_my_live_matches(uuid) to authenticated;
