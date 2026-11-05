-- Venues, step 3 of 3 (UV, 5 Nov): the venues a competition is played at, shown
-- wherever it is shown, and a venue's own page.
--
-- Until now the pages named the venue a competition BELONGS to, which decides
-- staff rights. They name where it is PLAYED now (20261105200430). venue_id and
-- venue_name stay on the functions below, meaning what they always did, so the
-- pages already deployed keep working until the new ones are.
--
-- tbl_matches.venue_id is left exactly as it was: it is a rights column.
--
-- A closed venue stays on a list it is already on, so the lists read the table
-- as a security-definer function, past its rule that hides a closed venue.
--
-- Every function changed here is patched from its text in a freshly reset
-- database, not retyped. No player is referenced, so private.tdc_merge_players
-- is unaffected.


-- ─── A list of venues, as every page reads one ───
-- [{ "id": ..., "name": ... }], in the order the director put them. Never null.

create function private.tdc_season_venue_list(p_league_season_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name) order by lv.position), '[]'::jsonb)
	from public.tbl_league_season_venues lv
	join public.tbl_venues v on v.id = lv.venue_id
	where lv.league_season_id = p_league_season_id;
$$;

revoke execute on function private.tdc_season_venue_list(uuid) from public, anon, authenticated;

create function private.tdc_tournament_venue_list(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name) order by tv.position), '[]'::jsonb)
	from public.tbl_tournament_venues tv
	join public.tbl_venues v on v.id = tv.venue_id
	where tv.tournament_id = p_tournament_id;
$$;

revoke execute on function private.tdc_tournament_venue_list(uuid) from public, anon, authenticated;

-- Where one match is played. A league night: its fixture's own venue, or else the
-- season's list. A tournament match: the tournament's list. A social match: the
-- venue on the match, if it has one.
create function private.tdc_match_venue_list(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_season uuid;
	v_own    uuid;
	v_t      uuid;
	v_list   jsonb;
begin
	select f.league_season_id, f.venue_id into v_season, v_own
	from public.tbl_league_fixtures f where f.match_id = p_match_id limit 1;

	if v_own is not null then
		select jsonb_build_array(jsonb_build_object('id', v.id, 'name', v.name)) into v_list
		from public.tbl_venues v where v.id = v_own;
		return coalesce(v_list, '[]'::jsonb);
	end if;
	if v_season is not null then
		return private.tdc_season_venue_list(v_season);
	end if;

	select f.tournament_id into v_t
	from public.tbl_tournament_fixtures f where f.match_id = p_match_id limit 1;
	if v_t is not null then
		return private.tdc_tournament_venue_list(v_t);
	end if;

	select jsonb_build_array(jsonb_build_object('id', v.id, 'name', v.name)) into v_list
	from public.tbl_matches m
	join public.tbl_venues v on v.id = m.venue_id
	where m.id = p_match_id;
	return coalesce(v_list, '[]'::jsonb);
end;
$$;

revoke execute on function private.tdc_match_venue_list(uuid) from public, anon, authenticated;

-- For the pages that read a tournament or a match from its own table.
create function public.tdc_tournament_venue_list(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_tournament_venue_list(p_tournament_id);
$$;

revoke execute on function public.tdc_tournament_venue_list(uuid) from public, anon;
grant execute on function public.tdc_tournament_venue_list(uuid) to authenticated;

create function public.tdc_match_venue_list(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_match_venue_list(p_match_id);
$$;

revoke execute on function public.tdc_match_venue_list(uuid) from public, anon;
grant execute on function public.tdc_match_venue_list(uuid) to authenticated;


-- ─── The lists every list and banner reads ───

drop function public.tdc_my_leagues(integer);

CREATE OR REPLACE FUNCTION public.tdc_my_leagues(p_limit integer DEFAULT 50)
 RETURNS TABLE(league_season_id uuid, league_name text, name text, season_name text, starts_on date, venue_name text, i_run_it boolean, my_team_id uuid, my_team_name text, i_captain boolean, my_status text, confirmed_at timestamp with time zone, ends_on date, discipline text, team_size integer, team_count integer, player_count integer, status text, venues jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select s.id, l.name, s.name, z.name, z.starts_on, v.name,
		private.tdc_can_run_league(s.id),
		e.team_id, t.name, coalesce(e.is_captain, false), e.status, e.confirmed_at,
		z.ends_on,
		private.tdc_rules_for_league_season(s.id) ->> 'discipline',
		private.tdc_team_size(private.tdc_rules_for_league_season(s.id)),
		(select count(*)::int from public.tbl_teams tc where tc.league_season_id = s.id),
		(select count(*)::int from public.tbl_league_season_entrants pc
			where pc.league_season_id = s.id and pc.status = 'active'),
		s.status,
		private.tdc_season_venue_list(s.id)
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	left join public.tbl_venues v on v.id = l.venue_id
	left join public.tbl_league_season_entrants e
		on e.league_season_id = s.id and e.player_id = (select id from me)
	left join public.tbl_teams t on t.id = e.team_id
	where (select id from me) is not null
		and (private.tdc_can_run_league(s.id) or e.id is not null)
	order by coalesce(z.starts_on, s.created_at::date) desc, s.created_at desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$function$;

revoke execute on function public.tdc_my_leagues(integer) from public, anon;
grant execute on function public.tdc_my_leagues(integer) to authenticated;

drop function public.tdc_search_leagues(text, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.tdc_search_leagues(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_discipline text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_kind text DEFAULT NULL::text)
 RETURNS TABLE(league_season_id uuid, league_name text, season_name text, starts_on date, venue_name text, entry_mode text, players integer, my_status text, discipline text, team_size integer, status text, ends_on date, venues jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
	if p_status is not null and p_status not in ('taking_entries', 'running', 'on_break', 'finished') then
		raise exception 'TDC (Error): unknown league status "%".', p_status;
	end if;
	if p_kind is not null and p_kind not in ('team', 'singles') then
		raise exception 'TDC (Error): a league is "team" or "singles", not "%".', p_kind;
	end if;

	return query
	select r.id, r.league_name, r.season_name, r.starts_on, r.venue_name, r.entry_mode,
		r.players, r.my_status, r.discipline, r.team_size, r.status, r.ends_on, r.venues
	from (
		select s.id, l.name as league_name, s.name as season_name, z.starts_on, v.name as venue_name, s.entry_mode,
			(select count(*)::integer from public.tbl_league_season_entrants e
			 where e.league_season_id = s.id and e.status = 'active') as players,
			(select e.status from public.tbl_league_season_entrants e
			 join public.tbl_players p on p.id = e.player_id
			 where e.league_season_id = s.id and p.user_id = (select auth.uid())) as my_status,
			private.tdc_rules_for_league_season(s.id) ->> 'discipline' as discipline,
			private.tdc_team_size(private.tdc_rules_for_league_season(s.id)) as team_size,
			s.status, z.ends_on, l.name as sort_name,
			private.tdc_season_venue_list(s.id) as venues
		from public.tbl_league_seasons s
		join public.tbl_leagues l on l.id = s.league_id
		join public.tbl_seasons z on z.id = s.season_id
		left join public.tbl_venues v on v.id = l.venue_id
		where (select auth.uid()) is not null
			and s.is_listed
			and s.entry_mode <> 'ld_only'
			and (
				coalesce(trim(p_query), '') = ''
				or l.name ilike '%' || trim(p_query) || '%'
				or s.name ilike '%' || trim(p_query) || '%'
				or v.name ilike '%' || trim(p_query) || '%'
				or exists (
					select 1 from public.tbl_league_season_venues lv
					join public.tbl_venues pv on pv.id = lv.venue_id
					where lv.league_season_id = s.id and pv.name ilike '%' || trim(p_query) || '%'
				)
			)
			and (p_status is null or s.status = p_status)
	) r
	where (p_discipline is null or r.discipline = p_discipline)
		and (p_kind is null
			or (p_kind = 'team' and r.team_size >= 2)
			or (p_kind = 'singles' and r.team_size = 1))
	order by r.starts_on desc nulls last, r.sort_name
	limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$function$;

revoke execute on function public.tdc_search_leagues(text, integer, text, text, text) from public, anon;
grant execute on function public.tdc_search_leagues(text, integer, text, text, text) to authenticated;

drop function public.tdc_league_season_info(uuid);

CREATE OR REPLACE FUNCTION public.tdc_league_season_info(p_league_season_id uuid)
 RETURNS TABLE(league_season_id uuid, league_id uuid, league_name text, name text, season_name text, starts_on date, ends_on date, venue_id uuid, venue_name text, rules jsonb, rules_overrides jsonb, notes text, i_run_it boolean, venues jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select s.id, l.id, l.name, s.name, z.name, z.starts_on, z.ends_on,
		l.venue_id, v.name,
		l.rules || s.rules_overrides, s.rules_overrides, s.notes,
		private.tdc_can_run_league(s.id),
		private.tdc_season_venue_list(s.id)
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	left join public.tbl_venues v on v.id = l.venue_id
	where s.id = p_league_season_id;
$function$;

revoke execute on function public.tdc_league_season_info(uuid) from public, anon;
grant execute on function public.tdc_league_season_info(uuid) to authenticated;

drop function public.tdc_my_tournaments(integer);

CREATE OR REPLACE FUNCTION public.tdc_my_tournaments(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, name text, format text, status text, status_manual boolean, starts_at timestamp with time zone, venue_name text, entrants integer, i_run_it boolean, poster_open boolean, venues jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select t.id, t.name, t.format,
		private.tdc_tournament_status(t.id),
		t.status_manual,
		t.starts_at, v.name,
		(select count(*)::integer from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.status <> 'withdrawn'),
		private.tdc_can_run_tournament(t.id),
		exists (
			select 1 from public.tbl_tournament_posters p
			where p.tournament_id = t.id
				and (p.is_public or private.tdc_can_run_tournament(t.id))
		),
		private.tdc_tournament_venue_list(t.id)
	from public.tbl_tournaments t
	left join public.tbl_venues v on v.id = t.venue_id
	where (select id from me) is not null
		and (
			private.tdc_can_run_tournament(t.id)
			or exists (
				select 1 from public.tbl_tournament_entrants e
				where e.tournament_id = t.id and e.player_id = (select id from me)
			)
		)
	order by coalesce(t.starts_at, t.created_at) desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$function$;

revoke execute on function public.tdc_my_tournaments(integer) from public, anon;
grant execute on function public.tdc_my_tournaments(integer) to authenticated;

drop function public.tdc_open_tournaments(integer);

CREATE OR REPLACE FUNCTION public.tdc_open_tournaments(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, name text, format text, starts_at timestamp with time zone, venue_name text, entrants integer, max_entrants integer, entry_mode text, venues jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select t.id, t.name, t.format, t.starts_at, v.name,
		(select count(*)::integer from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.status <> 'withdrawn'),
		t.max_entrants, t.entry_mode,
		private.tdc_tournament_venue_list(t.id)
	from public.tbl_tournaments t
	join public.tbl_tournament_posters p on p.tournament_id = t.id and p.is_public
	left join public.tbl_venues v on v.id = t.venue_id
	where (select id from me) is not null
		and t.is_listed
		and t.entry_mode <> 'td_only'
		and (
			private.tdc_tournament_status(t.id) = 'open'
			or (not t.status_manual and private.tdc_tournament_status(t.id) = 'draft')
		)
		and not exists (select 1 from public.tbl_tournament_fixtures f where f.tournament_id = t.id)
		and not private.tdc_can_run_tournament(t.id)
		and not exists (
			select 1 from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.player_id = (select id from me)
		)
	order by t.starts_at nulls last, t.created_at
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$function$;

revoke execute on function public.tdc_open_tournaments(integer) from public, anon;
grant execute on function public.tdc_open_tournaments(integer) to authenticated;


-- ─── The poster ───
-- A snapshot, so it holds the names and ids as they were when it was built. The
-- ids are there for the links to each venue's page, which anyone may open.

CREATE OR REPLACE FUNCTION private.tdc_poster_snapshot(p_tournament_id uuid, p_include_entrants boolean, p_include_draw boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_t      public.tbl_tournaments%rowtype;
	v_venue  text;
	v_out    jsonb;
	v_live   integer;
	v_conf   integer;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	select name into v_venue from public.tbl_venues where id = v_t.venue_id;

	select count(*) filter (where status <> 'withdrawn'),
		count(*) filter (where status = 'confirmed')
	into v_live, v_conf
	from public.tbl_tournament_entrants
	where tournament_id = p_tournament_id;

	-- The tournament itself. Always included: this is the poster.
	--
	-- Note what is absent. No notes — those are the TD's. No entry fee in
	-- credits as a bare number without the venue context to read it. No
	-- created_by, no venue_id, no ids of any kind except the tournament's own,
	-- which is already in the address, and those of the venues it is played at,
	-- for the links to their pages.
	v_out := jsonb_build_object(
		'version', 2,
		'tournament_id', v_t.id,
		'name', v_t.name,
		'format', v_t.format,
		'status', private.tdc_tournament_status(v_t.id),
		'starts_at', v_t.starts_at,
		'venue_name', v_venue,
		'venues', private.tdc_tournament_venue_list(v_t.id),
		'max_entrants', v_t.max_entrants,
		'entry_fee_credits', v_t.entry_fee_credits,
		'entry_mode', v_t.entry_mode,
		'sanctioned', v_t.sanctioned,
		'third_place', v_t.third_place,
		-- Counts, not names. UV: "the poster page is just the tournament
		-- information and maybe how many confirmed/interested entrants there
		-- are" — which is also what a poster advertising for entries needs.
		'entrants', jsonb_build_object(
			'total', v_live,
			'confirmed', v_conf,
			'interested', v_live - v_conf),
		-- The ruleset, filtered to what a player is told. Shot clock yes,
		-- dispute window no. See the player_facing work in TDCMatchDef — until
		-- that flag exists, the list is held here and this is the only caller.
		'rules', private.tdc_poster_rules(v_t.rules),
		-- How many rounds the main bracket has, so a round can be named.
		'rounds', (
			select max(f.round) from public.tbl_tournament_fixtures f
			where f.tournament_id = p_tournament_id and f.bracket = 'main'),
		-- The rounds with rules of their own, through the same filter.
		'round_rules', coalesce((
			select jsonb_agg(jsonb_build_object(
				'bracket', rr.bracket,
				'round', rr.round,
				'rules', private.tdc_poster_rules(rr.rules))
				order by rr.bracket, rr.round)
			from public.tbl_tournament_round_rules rr
			where rr.tournament_id = p_tournament_id
		), '[]'::jsonb),
		-- Who runs it, as the league join page shows a league's.
		'officials', coalesce((
			select jsonb_agg(jsonb_build_object(
				'name', p.display_name,
				'role', rt.name,
				'avatar_path', p.avatar_path)
				order by rt.rank desc, p.display_name)
			from public.tbl_competition_roles r
			join public.tbl_players p on p.id = r.player_id
			join public.tbl_competition_role_types rt on rt.key = r.role
			where r.tournament_id = p_tournament_id
		), '[]'::jsonb)
	);

	-- Who is in it, by display name only. Opt-in, because UV's considered
	-- answer was that the real entrant list is the TD's.
	if p_include_entrants then
		v_out := v_out || jsonb_build_object('entrant_names', coalesce((
			select jsonb_agg(p.display_name order by e.seed nulls last, p.display_name)
			from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = p_tournament_id and e.status <> 'withdrawn'
		), '[]'::jsonb));
	end if;

	-- The draw, with whatever has been decided. Opt-in. Scores come from
	-- tdc_tournament_draw, which reads through tdc_match_score, so a TD's
	-- hand-set result appears here the same as a counted one.
	if p_include_draw then
		v_out := v_out || jsonb_build_object('draw', coalesce((
			select jsonb_agg(jsonb_build_object(
				'bracket', d.bracket,
				'round', d.round,
				'position', d."position",
				'home', d.home_name,
				'away', d.away_name,
				'home_frames', d.home_frames,
				'away_frames', d.away_frames,
				-- Resolved to a name here: the draw returns an entrant id, and
				-- an id has no business in something a stranger reads.
				'winner', case
					when d.winner_entrant_id is null then null
					when d.winner_entrant_id = d.home_entrant_id then d.home_name
					when d.winner_entrant_id = d.away_entrant_id then d.away_name
				end,
				'match_status', d.match_status,
				-- So a poster generated mid-tournament can mark a result that
				-- has not been published as not yet official, rather than
				-- presenting it as settled.
				'published', d.published,
				-- A hand-set result is shown as one. The TD's score advances
				-- the bracket either way, and disguising it would be worse.
				'set_by_hand', d.overridden)
				order by d.bracket, d.round, d."position")
			from public.tdc_tournament_draw(p_tournament_id) d
		), '[]'::jsonb));
	end if;

	return v_out;
end;
$function$;

-- Settings saves the venues after everything else, so a poster rebuilt by that
-- save would miss them. Rebuilt here with the choices it already has.

CREATE OR REPLACE FUNCTION public.tdc_set_tournament_venues(p_tournament_id uuid, p_venue_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_already uuid[];
	v_p       public.tbl_tournament_posters%rowtype;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change where it is played.';
	end if;

	select array_agg(venue_id) into v_already
	from public.tbl_tournament_venues where tournament_id = p_tournament_id;

	perform private.tdc_check_venue_list(p_venue_ids, v_already);

	delete from public.tbl_tournament_venues where tournament_id = p_tournament_id;

	insert into public.tbl_tournament_venues (tournament_id, venue_id, position, created_by)
	select p_tournament_id, x.id, x.n, (select auth.uid())
	from unnest(p_venue_ids) with ordinality as x(id, n);

	select * into v_p from public.tbl_tournament_posters where tournament_id = p_tournament_id;
	if v_p.tournament_id is not null then
		perform public.tdc_publish_poster(p_tournament_id, v_p.include_entrants, v_p.include_draw);
	end if;
end;
$function$;


-- ─── A player's profile ───

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
					else coalesce(op.display_name, 'TDC (Error)') end,
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
				'result_event', f.result_event
			) order by c.played_at desc, f.frame_no)
			from counted c
			join public.tbl_frames f on f.match_id = c.id and f.status = 'complete'
			join public.tbl_frame_participants fp on fp.frame_id = f.id and fp.player_id = p_player_id
			where c.status = 'complete'   -- what is counted: finished matches only
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
$function$;


-- ─── A venue's page ───
-- Every league season and tournament tied to the venue: one it belongs to, one
-- it is listed as played at, and a league with a fixture there. Anyone may read
-- it, signed out too, as anyone may read the venue. So only what its director has
-- made public: a listed season, a listed tournament. A closed venue shows nothing,
-- as tdc_venue shows nothing, except to its own staff.

create function public.tdc_venue_competitions(p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'leagues', coalesce((
			select jsonb_agg(jsonb_build_object(
				'league_season_id', s.id,
				'league_name', l.name,
				'season_name', s.name,
				'status', s.status,
				'starts_on', z.starts_on,
				'ends_on', z.ends_on,
				'discipline', private.tdc_rules_for_league_season(s.id) ->> 'discipline',
				'team_size', private.tdc_team_size(private.tdc_rules_for_league_season(s.id)),
				'players', (select count(*)::integer from public.tbl_league_season_entrants e
					where e.league_season_id = s.id and e.status = 'active')
			) order by z.starts_on desc nulls last, l.name)
			from public.tbl_league_seasons s
			join public.tbl_leagues l on l.id = s.league_id
			join public.tbl_seasons z on z.id = s.season_id
			where s.is_listed
				and (
					l.venue_id = p_venue_id
					or exists (select 1 from public.tbl_league_season_venues lv
						where lv.league_season_id = s.id and lv.venue_id = p_venue_id)
					or exists (select 1 from public.tbl_league_fixtures f
						where f.league_season_id = s.id and f.venue_id = p_venue_id)
				)
		), '[]'::jsonb),
		'tournaments', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', t.id,
				'name', t.name,
				'format', t.format,
				'status', private.tdc_tournament_status(t.id),
				'starts_at', t.starts_at,
				'entrants', (select count(*)::integer from public.tbl_tournament_entrants e
					where e.tournament_id = t.id and e.status <> 'withdrawn'),
				'max_entrants', t.max_entrants,
				'poster_open', exists (select 1 from public.tbl_tournament_posters p
					where p.tournament_id = t.id and p.is_public)
			) order by t.starts_at desc nulls last, t.name)
			from public.tbl_tournaments t
			where t.is_listed
				and (
					t.venue_id = p_venue_id
					or exists (select 1 from public.tbl_tournament_venues tv
						where tv.tournament_id = t.id and tv.venue_id = p_venue_id)
				)
		), '[]'::jsonb)
	)
	from public.tbl_venues v
	where v.id = p_venue_id
		and (v.active or private.tdc_has_venue_role(v.id, array['owner', 'admin', 'staff']));
$$;

revoke execute on function public.tdc_venue_competitions(uuid) from public;
grant execute on function public.tdc_venue_competitions(uuid) to anon, authenticated;
