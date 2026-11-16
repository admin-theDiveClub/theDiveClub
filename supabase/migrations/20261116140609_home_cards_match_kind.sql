-- The home page's Matches card: each match says what kind it is (UV, 16 Nov 2026:
-- league and single matches in the same list, with different badges).
--
-- tdc_home_cards (migration 20261116132606) gains 'kind' on each match: 'league' for
-- a league fixture's match (a team night, or a singles league's), 'tournament' for a
-- tournament fixture's, 'social' for one started on its own. Nothing else changes:
-- the function is that migration's text with the one field added.

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
			'matches', '[]'::jsonb
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
		), '[]'::jsonb)
	);
end;
$$;

revoke execute on function public.tdc_home_cards() from public;
grant execute on function public.tdc_home_cards() to anon, authenticated;
