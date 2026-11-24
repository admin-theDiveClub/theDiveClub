-- The poster's draw cards show each side's picture (UV, 24 Nov).
--
-- After entrants gained their pictures (20261124183008), a draw card's sides
-- still drew initials: the snapshot's draw held names and ids but no picture
-- paths. Version 5 adds, to each draw entry:
--   home_avatar, away_avatar   from tdc_tournament_draw, or null
--
-- private.tdc_poster_snapshot is patched from 20261124183008, its last
-- definition; nothing else changes. Then every poster below version 5 is
-- rebuilt once, as before: each poster's own choices, sharing and who
-- generated it left alone, generated_at now.

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
	-- which is already in the address, those of the venues it is played at,
	-- for the links to their pages, and (24 Nov) the players', for the links
	-- to their profiles.
	v_out := jsonb_build_object(
		'version', 5,
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
				'player_id', p.id,
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
			select jsonb_agg(p.display_name order by e.seed nulls last, p.display_name, p.id)
			from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = p_tournament_id and e.status <> 'withdrawn'
		), '[]'::jsonb))
		-- Each name's player, in the same order (24 Nov), for the link to their
		-- profile. Beside the names rather than in place of them, so a page or
		-- the designer text that reads entrant_names is unchanged.
		|| jsonb_build_object('entrant_ids', coalesce((
			select jsonb_agg(p.id order by e.seed nulls last, p.display_name, p.id)
			from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = p_tournament_id and e.status <> 'withdrawn'
		), '[]'::jsonb))
		-- Each name's status and picture, in the same order (24 Nov), so the
		-- page can list Confirmed and Interested apart, with faces.
		|| jsonb_build_object('entrant_statuses', coalesce((
			select jsonb_agg(e.status order by e.seed nulls last, p.display_name, p.id)
			from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = p_tournament_id and e.status <> 'withdrawn'
		), '[]'::jsonb))
		|| jsonb_build_object('entrant_avatars', coalesce((
			select jsonb_agg(p.avatar_path order by e.seed nulls last, p.display_name, p.id)
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
				-- Each side's player (24 Nov), for the link to their profile.
				'home_player_id', d.home_player_id,
				'away_player_id', d.away_player_id,
				-- Each side's picture (24 Nov), as the entrants have theirs.
				'home_avatar', d.home_avatar,
				'away_avatar', d.away_avatar,
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

update public.tbl_tournament_posters p
set snapshot     = private.tdc_poster_snapshot(p.tournament_id, p.include_entrants, p.include_draw),
	generated_at = now()
where coalesce((p.snapshot ->> 'version')::integer, 1) < 5;
