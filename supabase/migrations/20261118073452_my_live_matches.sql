-- Your live matches as a function of their own (UV, 18 Nov 2026), so the league
-- page can show the live match card too: every tab of a league season's page, that
-- league's nights only.
--
-- public.tdc_my_live_matches(p_league_season_id): the 'live' list of
-- tdc_home_cards (migration 20261118062033), moved here word for word, with one
-- filter added: given a league season, only matches of that season's fixtures.
-- Null: every live match, as the home page has it. Signed in only (it reads
-- auth.uid(); signed out the list is simply empty, but anon is not granted it).
--
-- tdc_home_cards is that migration's text with its 'live' block replaced by a
-- call to this function, so which matches are "live" is decided in one place.

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

create or replace function public.tdc_home_cards()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if (select auth.uid()) is null then
		return jsonb_build_object(
			'signed_in', false,
			'leagues', coalesce((
				select jsonb_agg(x.j order by x.rank, x.starts_on desc nulls last, x.name)
				from (
					select jsonb_build_object(
						'league_season_id', s.id,
						'name', l.name,
						'picture_path', l.picture_path,
						'status', s.status
					) as j,
					case s.status when 'running' then 0 when 'taking_entries' then 1
						when 'on_break' then 2 else 3 end as rank,
					z.starts_on, l.name
					from public.tbl_league_seasons s
					join public.tbl_leagues l on l.id = s.league_id
					join public.tbl_seasons z on z.id = s.season_id
					where s.is_listed
					order by rank, z.starts_on desc nulls last, l.name
					limit 6
				) x
			), '[]'::jsonb),
			'tournaments', coalesce((
				select jsonb_agg(x.j order by x.rank, x.starts_at desc nulls last, x.name)
				from (
					select jsonb_build_object(
						'id', t.id,
						'name', t.name,
						'status', st.status,
						'poster_open', true
					) as j,
					case st.status when 'in_progress' then 0 when 'open' then 1
						when 'draft' then 2 else 3 end as rank,
					t.starts_at, t.name
					from public.tbl_tournaments t
					cross join lateral (select private.tdc_tournament_status(t.id) as status) st
					where t.is_listed
						and exists (select 1 from public.tbl_tournament_posters p
							where p.tournament_id = t.id and p.is_public)
					order by rank, t.starts_at desc nulls last, t.name
					limit 6
				) x
			), '[]'::jsonb),
			'matches', '[]'::jsonb,
			'live', '[]'::jsonb
		);
	end if;

	return jsonb_build_object(
		'signed_in', true,
		'leagues', coalesce((
			select jsonb_agg(x.j order by x.rank, x.starts_on desc nulls last, x.name)
			from (
				select jsonb_build_object(
					'league_season_id', m.league_season_id,
					'name', m.league_name,
					'picture_path', l.picture_path,
					'status', m.status,
					'i_run_it', m.i_run_it
				) as j,
				case m.status when 'running' then 0 when 'taking_entries' then 1
					when 'on_break' then 2 else 3 end as rank,
				m.starts_on, m.league_name as name
				from public.tdc_my_leagues(200) m
				join public.tbl_league_seasons s on s.id = m.league_season_id
				join public.tbl_leagues l on l.id = s.league_id
				order by rank, m.starts_on desc nulls last, m.league_name
				limit 6
			) x
		), '[]'::jsonb),
		'tournaments', coalesce((
			select jsonb_agg(x.j order by x.rank, x.starts_at desc nulls last, x.name)
			from (
				select jsonb_build_object(
					'id', t.id,
					'name', t.name,
					'status', t.status,
					'poster_open', t.poster_open
				) as j,
				case t.status when 'in_progress' then 0 when 'open' then 1
					when 'draft' then 2 else 3 end as rank,
				t.starts_at, t.name
				from public.tdc_my_tournaments(200) t
				order by rank, t.starts_at desc nulls last, t.name
				limit 6
			) x
		), '[]'::jsonb),
		'matches', coalesce((
			select jsonb_agg(x.j order by x.rank, x.played_at desc)
			from (
				select jsonb_build_object(
					'id', mm.id,
					'status', mm.status,
					'card_state', mm.card_state ->> 'state',
					'team_match', mm.team_match,
					'opponent', mm.opponent,
					'opponent_kind', k.kind,
					'opponent_picture', case when k.kind = 'team' then ot.picture_path else op.avatar_path end,
					'my_frames', mm.my_frames,
					'their_frames', mm.their_frames,
					'played_at', mm.played_at,
					-- What kind of match, for its badge (UV, 16 Nov; migration home_cards_match_kind)
					'kind', case
						when exists (select 1 from public.tbl_league_fixtures f where f.match_id = mm.id) then 'league'
						when exists (select 1 from public.tbl_tournament_fixtures f where f.match_id = mm.id) then 'tournament'
						else 'social'
					end
				) as j,
				case when mm.status = 'in_progress' then 0 else 1 end as rank,
				mm.played_at
				from public.tdc_my_matches(200) mm
				join public.tbl_matches m on m.id = mm.id
				cross join lateral (select case when mm.my_side = 'home' then m.away_side_kind
					else m.home_side_kind end as kind) k
				left join public.tbl_players op
					on op.id = case when mm.my_side = 'home' then m.away_player_id else m.home_player_id end
				left join public.tbl_teams ot
					on ot.id = case when mm.my_side = 'home' then m.away_team_id else m.home_team_id end
				where not mm.refereeing
				order by rank, mm.played_at desc
				limit 5
			) x
		), '[]'::jsonb),
		-- The live match card (UV, 18 Nov): one function, shared with the league page
		-- (migration my_live_matches)
		'live', public.tdc_my_live_matches(null)
	);
end;
$$;

revoke execute on function public.tdc_home_cards() from public;
grant execute on function public.tdc_home_cards() to anon, authenticated;
