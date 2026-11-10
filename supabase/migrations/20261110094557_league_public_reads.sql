-- A league's Season and Standings tabs for somebody not signed in (UV, 10 Nov;
-- docs/DECISIONS.md, 10 Nov; docs/systems/leagues.md).
--
-- ─── Why two new reads and not the functions the tabs already use ───
--
-- The poster's rule (21 Oct) was a stored snapshot. UV has departed from it for
-- these two tabs: they are live. What is kept from it is the point of it, that
-- what a stranger can read is reviewable in one place. Everything else stays
-- behind a login, so nothing already there is opened to anon:
--
--   tbl_league_seasons, tbl_leagues, tbl_teams   a policy cannot choose columns
--     and "using (true)" would list every league, with who created it
--   tdc_league_fixtures    the Fixtures tab's contents, which ask for a sign-in
--   tdc_team_roster        status, confirmation, player ids, and no switch
--   tdc_league_season_teams   captains' names, whatever the switch says
--   tdc_league_standings   full names, player ids, the ids of every match
--
-- ─── Who gets anything ───
--
-- is_listed is now Visible to public (UV, 10 Nov), for links as well as the
-- search. Off, both reads answer null, the same as for a season that does not
-- exist, and the page asks for a sign-in and comes back.
--
-- ─── The names and faces switch, public_shows_players ───
--
-- Off until whoever runs the league turns it on, like the poster's entrants.
-- It is enforced here, by what is left out, never by what a page chooses to
-- draw. UV's choices for off (10 Nov):
--   Season tab     teams with their picture, name and places; no players
--   Standings      display name and rank; no pictures and no columns
-- A rank is worked out by the browser from the counts (TDCStandings), the one
-- place that rule lives. So with the switch off the counts behind the ranking
-- columns still travel, those and no others, and the page does not draw them
-- (UV, 10 Nov: a second copy of the ranking rule here was the alternative).
--
-- Withdrawn players are left off a team. Nobody is marked away. Standings keeps
-- whoever played, since the numbers need them. Live and Full names are for the
-- signed-in only: Live would need tbl_matches opened.
--
-- A picture's path starts with the player's id (the bucket's own layout), so an
-- id can be seen beside a face with the switch on. Nothing a stranger can call
-- takes a player's id.

alter table public.tbl_league_seasons
	add column public_shows_players boolean not null default false;

comment on column public.tbl_league_seasons.public_shows_players is
	'Whether somebody not signed in sees this season''s players: the teams'' lists on the Season tab and faces and numbers on Standings. Enforced by tdc_public_league_season and tdc_public_league_standings.';

comment on column public.tbl_league_seasons.is_listed is
	'Visible to public: in the league search and on a venue''s page, and open by its link to somebody not signed in. Off, that visitor is asked to sign in first.';


-- ─────────────────────────────────────────────────────────────────
-- The switch
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_set_league_public_players(p_league_season_id uuid, p_show boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_show is null then
		raise exception 'TDC (Error): say whether players are shown.';
	end if;

	if not exists (select 1 from public.tbl_league_seasons where id = p_league_season_id) then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can change this.';
	end if;

	update public.tbl_league_seasons
	set public_shows_players = p_show
	where id = p_league_season_id;
end;
$$;

revoke execute on function public.tdc_set_league_public_players(uuid, boolean) from public, anon;
grant execute on function public.tdc_set_league_public_players(uuid, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The Season tab
--
-- A fixture here is a date, a state and how many frames: enough for the
-- calendar and the numbers, and no teams, because Fixtures asks for a sign-in.
-- A team's id stays: the page's cards and &team= links are built on it, and
-- nothing a stranger can call takes one.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_public_league_season(p_league_season_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'league_name', l.name,
		'name', s.name,
		'starts_on', z.starts_on,
		'ends_on', z.ends_on,
		'rules', private.tdc_rules_for_league_season(s.id),
		'notes', s.notes,
		'venues', private.tdc_season_venue_list(s.id),
		'status', s.status,
		'max_reserves', s.max_reserves,
		'entry_mode', s.entry_mode,
		'picture_path', l.picture_path,
		'shows_players', s.public_shows_players,
		'players', (select count(*)::integer from public.tbl_league_season_entrants e
			where e.league_season_id = s.id and e.status = 'active'),
		'interested', (select count(*)::integer from public.tbl_league_season_entrants e
			where e.league_season_id = s.id and e.status = 'interested'),
		'fixtures', coalesce((
			select jsonb_agg(jsonb_build_object(
				'scheduled_at', f.scheduled_at,
				'is_bye', f.away_team_id is null,
				'match_status', m.status,
				'frames', coalesce(sc.home_score, 0) + coalesce(sc.away_score, 0)
			) order by f.round, f."position")
			from public.tbl_league_fixtures f
			left join public.tbl_matches m on m.id = f.match_id
			left join lateral private.tdc_match_score(f.match_id) sc on f.match_id is not null
			where f.league_season_id = s.id
		), '[]'::jsonb),
		'teams', coalesce((
			select jsonb_agg(jsonb_build_object(
				'team_id', t.id,
				'name', t.name,
				'picture_path', t.picture_path,
				'active_players', private.tdc_team_active_players(t.id),
				'team_limit', private.tdc_team_limit(t.id)
			) || case when s.public_shows_players then jsonb_build_object('roster', coalesce((
				select jsonb_agg(jsonb_build_object(
					'display_name', p.display_name,
					'avatar_path', p.avatar_path,
					'is_captain', e.is_captain
				) order by e.is_captain desc, p.display_name)
				from public.tbl_league_season_entrants e
				join public.tbl_players p on p.id = e.player_id
				where e.team_id = t.id and e.status in ('active', 'inactive')
			), '[]'::jsonb)) else '{}'::jsonb end
			order by lower(t.name))
			from public.tbl_teams t
			where t.league_season_id = s.id
		), '[]'::jsonb),
		-- Always shown, as on the poster. Only somebody with an account: the
		-- page's search offers nothing else, but the function that names an
		-- official does not refuse a walk-in.
		'officials', coalesce((
			select jsonb_agg(jsonb_build_object(
				'display_name', p.display_name,
				'avatar_path', p.avatar_path,
				'role_name', case when r.role = 'director' then 'League director' else t.name end
			) order by t.rank desc, p.display_name)
			from public.tbl_competition_roles r
			join public.tbl_players p on p.id = r.player_id
			join public.tbl_competition_role_types t on t.key = r.role
			where r.league_season_id = s.id and p.user_id is not null
		), '[]'::jsonb)
	)
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	where s.id = p_league_season_id and s.is_listed;
$$;

revoke execute on function public.tdc_public_league_season(uuid) from public;
grant execute on function public.tdc_public_league_season(uuid) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The Standings tab
--
-- tdc_league_standings counts, signed nights only; this chooses what of it
-- leaves. Called rather than copied, so a stranger's numbers cannot differ
-- from a member's. A row's key is its place in this answer, not its player.
-- Only the counts a sent column uses are sent.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_public_league_standings(p_league_season_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_show boolean;
	v_league text;
	v_all jsonb;
	v_columns jsonb;
	v_player_vars text[];
	v_team_vars text[];
begin
	select s.public_shows_players, l.name into v_show, v_league
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	where s.id = p_league_season_id and s.is_listed;

	if not found then
		return null;
	end if;

	v_all := public.tdc_league_standings(p_league_season_id, false);

	-- Team columns always; a player column with the switch on, or one that
	-- decides the rank.
	select coalesce(jsonb_agg(jsonb_build_object(
			'id', c.id,
			'scope', c.scope,
			'position', c.position,
			'name', c.name,
			'equation', c.equation,
			'decimals', c.decimals,
			'rank_priority', c.rank_priority,
			'higher_first', c.higher_first
		) order by c.position), '[]'::jsonb)
	into v_columns
	from public.tbl_league_standing_columns c
	where c.league_season_id = p_league_season_id
		and (c.scope = 'team' or v_show or c.rank_priority is not null);

	select coalesce(array_agg(distinct t ->> 'v') filter (where c ->> 'scope' = 'player'), '{}'),
		coalesce(array_agg(distinct t ->> 'v') filter (where c ->> 'scope' = 'team'), '{}')
	into v_player_vars, v_team_vars
	from jsonb_array_elements(v_columns) c
	cross join lateral jsonb_array_elements(c -> 'equation') t
	where t ->> 't' = 'var';

	return jsonb_build_object(
		'league_name', v_league,
		'venues', private.tdc_season_venue_list(p_league_season_id),
		'shows_players', v_show,
		'matches_counted', v_all -> 'matches_counted',
		'columns', v_columns,
		'players', coalesce((
			select jsonb_agg(jsonb_build_object(
				'key', r.n,
				'display_name', r.item ->> 'display_name',
				'team_id', r.item -> 'team_id',
				'stats', (select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
					from jsonb_each(r.item -> 'stats') s
					where s.key = any (v_player_vars))
			) || case when v_show then jsonb_build_object('avatar_path', r.item -> 'avatar_path') else '{}'::jsonb end
			order by r.n)
			from jsonb_array_elements(v_all -> 'players') with ordinality as r(item, n)
		), '[]'::jsonb),
		'teams', coalesce((
			select jsonb_agg(jsonb_build_object(
				'team_id', r.item -> 'team_id',
				'name', r.item ->> 'name',
				'picture_path', r.item -> 'picture_path',
				'stats', (select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
					from jsonb_each(r.item -> 'stats') s
					where s.key = any (v_team_vars))
			) order by r.n)
			from jsonb_array_elements(v_all -> 'teams') with ordinality as r(item, n)
		), '[]'::jsonb)
	);
end;
$$;

revoke execute on function public.tdc_public_league_standings(uuid) from public;
grant execute on function public.tdc_public_league_standings(uuid) to anon, authenticated;
