-- The poster holds more: the third-place playoff, the rules set for a round,
-- and who runs the tournament (UV, 5 Nov, with the poster's redesign: "show as
-- much information as possible", leaving out anything not set).
--
-- Still a snapshot (migration 20261021140000): these are added to the blob the
-- director builds, so a stranger reads them only once the poster is shared,
-- and nothing new is opened to anon.
--
--   - third_place: whether the losing semi-finalists play for third.
--   - rounds: how many rounds the main bracket has, so a round's rules can be
--     named ("Final", "Semi-finals") without the draw being included. Null
--     until there is a draw.
--   - round_rules: each round with rules of its own, filtered through
--     private.tdc_poster_rules like the tournament's. The page shows only what
--     differs from the tournament's rules.
--   - officials: who runs it, by display name, role and picture path (the
--     player-avatars bucket is public already: a picture is shown beside a
--     name on pages anyone may see). No player ids, as before.
--
--   - track_breaks and break_finish_requires_breaker join the player-facing
--     rules: whether breaks are recorded decides whether break & finish and
--     golden break mean anything, and the page asks it before showing them.
--
-- private.tdc_poster_snapshot and private.tdc_poster_rules are patched from
-- 20261021140000, their only definitions; nothing else changes. An old poster
-- lacks these keys until it is regenerated, and the page reads each one as
-- optional.

create or replace function private.tdc_poster_rules(p_rules jsonb)
returns jsonb
language sql
immutable
as $$
	select coalesce(jsonb_object_agg(k, p_rules -> k), '{}'::jsonb)
	from unnest(array[
		'discipline',
		'win_condition_type',
		'win_condition_target',
		'draws_allowed',
		'tiebreak_method',
		'max_match_minutes',
		'on_time_expiry',
		'track_breaks',
		'golden_break_enabled',
		'break_determination',
		'break_finish_enabled',
		'break_finish_requires_breaker',
		'reverse_break_finish_enabled',
		'shot_clock_enabled',
		'shot_clock_seconds',
		'shot_clock_first_shot_seconds',
		'extensions_per_player',
		'extension_seconds',
		'referee_required'
	]) as k
	where p_rules ? k;
$$;

create or replace function private.tdc_poster_snapshot(
	p_tournament_id    uuid,
	p_include_entrants boolean,
	p_include_draw     boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
	-- which is already in the address.
	v_out := jsonb_build_object(
		'version', 2,
		'tournament_id', v_t.id,
		'name', v_t.name,
		'format', v_t.format,
		'status', private.tdc_tournament_status(v_t.id),
		'starts_at', v_t.starts_at,
		'venue_name', v_venue,
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
$$;
