-- A league's own rotation table may set the order of a session's frames,
-- not only who meets whom (UV, 16 Nov).
--
-- Why: 8-Ball Mainstream plays from Billiard Café's paper scoresheet. Its
-- pairings are our cyclic shift, but each session opens one home player
-- later (session 2 is H2 v A3, H3 v A4, H4 v A5, H5 v A1, H1 v A2), so F6 on
-- the paper was F10 on the card. Players follow both, so the two must line up.
--
-- How: a row of the table may now be written as pairs, [home, away], in the
-- order the frames are played, besides the 23 Oct form (a row of away
-- positions, frame j being home position j). A row of numbers means exactly
-- what it did, so every table already saved and every frozen match reads as
-- before. The LD enters the order on the settings page ("My own table").
--
-- Nothing here touches data. The settings page's save already re-freezes
-- only untouched matches (no frames, no locked side, no card events:
-- private.tdc_refreeze_league_matches); every other match keeps its rules.
--
-- Patched from their live definitions (20261023193153, 20261023221049):
--   private.tdc_check_match_rules  the rotation block and one variable
--   private.tdc_rotation_away       a branch for a row of pairs
--   private.tdc_frame_position      a branch for a row of pairs
-- tdc_frame_session is unchanged: a frame's session is still its slot's.
-- The frame builder, the reserve swap and tdc_match_card read positions
-- only through these, so they follow without change.


-- ─────────────────────────────────────────────────────────────────
-- The ruleset check
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.tdc_check_match_rules(p_rules jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
	-- Version 1, exactly as it shipped on 15 October and exactly as the
	-- eighteen matches already played are frozen against. Nothing may be added
	-- to this list, ever: a match scored under version 1 keeps its meaning.
	v_v1 text[] := array[
		'version', 'discipline', 'win_condition_type', 'win_condition_target',
		'track_breaks', 'break_determination', 'break_finish_enabled',
		'draws_allowed', 'tiebreak_method', 'on_time_expiry',
		'max_match_minutes', 'golden_break_enabled', 'reverse_break_finish_enabled',
		'break_finish_requires_breaker', 'shot_clock_enabled', 'shot_clock_seconds',
		'shot_clock_first_shot_seconds', 'extensions_per_player', 'extension_seconds',
		'referee_required', 'score_entry_mode', 'approval_mode', 'dispute_window_hours'
	];
	-- Version 2 adds the two settings team play needs. A new list rather than
	-- an edit to the one above, which is what the 15 October note said a later
	-- version would do — and it has to be, because the match page reads a
	-- match's stored ruleset and sends it straight back when a setting is
	-- changed. Adding a required key to version 1 would have failed every
	-- match played so far, the first time anybody touched its settings.
	v_v2 text[] := v_v1 || array['lineup_cutoff_hours', 'strict_frame_order'];
	-- Version 3 (23 Oct): a team night is sessions. Frozen like the others.
	v_v3 text[] := v_v2 || array['team_size', 'rotation'];

	v_required text[];
	v_missing  text[];
	v_extra    text[];

	v_n   integer;
	v_s   integer;
	v_row jsonb;
	v_pairs boolean;
begin
	if p_rules is null or jsonb_typeof(p_rules) <> 'object' then
		raise exception 'TDC (Error): the ruleset must be a json object.';
	end if;

	v_required := case p_rules->>'version'
		when '1' then v_v1
		when '2' then v_v2
		when '3' then v_v3
	end;

	if v_required is null then
		raise exception 'TDC (Error): unknown ruleset version "%".', p_rules->>'version';
	end if;

	select array_agg(k) into v_missing from unnest(v_required) k where not (p_rules ? k);
	if v_missing is not null then
		raise exception 'TDC (Error): the ruleset is missing %.', array_to_string(v_missing, ', ');
	end if;

	select array_agg(k) into v_extra
	from (select k from jsonb_object_keys(p_rules) k) s
	where k <> all (v_required);
	if v_extra is not null then
		raise exception 'TDC (Error): the ruleset has unknown setting(s) %.', array_to_string(v_extra, ', ');
	end if;

	if p_rules->>'discipline' not in ('8ball', '9ball', '10ball', 'blackball') then
		raise exception 'TDC (Error): unknown discipline "%".', p_rules->>'discipline'; end if;
	-- free_play is the new one: a running score with nothing to reach.
	if p_rules->>'win_condition_type' not in ('race_to', 'best_of', 'fixed_frames', 'timed', 'free_play') then
		raise exception 'TDC (Error): unknown win condition "%".', p_rules->>'win_condition_type'; end if;
	if p_rules->>'break_determination' not in
		('alternate', 'winner_breaks', 'loser_breaks', 'first_breaks', 'lag_each_frame', 'by_schedule') then
		raise exception 'TDC (Error): unknown break rule "%".', p_rules->>'break_determination'; end if;
	if p_rules->>'tiebreak_method' not in ('sudden_death_frame', 'decider_on_lag', 'coordinator_decision') then
		raise exception 'TDC (Error): unknown tiebreak method "%".', p_rules->>'tiebreak_method'; end if;
	if p_rules->>'on_time_expiry' not in ('stop_immediately', 'finish_current_frame') then
		raise exception 'TDC (Error): unknown time expiry rule "%".', p_rules->>'on_time_expiry'; end if;
	if p_rules->>'score_entry_mode' not in ('td_only', 'referee', 'scorer', 'players') then
		raise exception 'TDC (Error): unknown score entry mode "%".', p_rules->>'score_entry_mode'; end if;
	if p_rules->>'approval_mode' not in ('none', 'dispute_window', 'coordinator_approval', 'both') then
		raise exception 'TDC (Error): unknown approval mode "%".', p_rules->>'approval_mode'; end if;

	-- The two version 2 settings are type-checked, which the version 1 keys
	-- never were. The design note calls this jsonb quietly becoming an
	-- unvalidated config format the heaviest standing risk in the system; the
	-- older keys are a job of their own (docs/STATUS.md), but new ones should
	-- not be added to the pile.
	if p_rules ? 'strict_frame_order'
		and jsonb_typeof(p_rules->'strict_frame_order') <> 'boolean' then
		raise exception 'TDC (Error): strict_frame_order must be true or false.';
	end if;

	if p_rules ? 'lineup_cutoff_hours' then
		if jsonb_typeof(p_rules->'lineup_cutoff_hours') <> 'number'
			or (p_rules->>'lineup_cutoff_hours')::numeric <> floor((p_rules->>'lineup_cutoff_hours')::numeric)
			or (p_rules->>'lineup_cutoff_hours')::numeric < 0
			or (p_rules->>'lineup_cutoff_hours')::numeric > 336 then
			raise exception 'TDC (Error): lineup_cutoff_hours must be a whole number of hours from 0 to 336.';
		end if;
	end if;

	-- Version 3. A team of one is a singles match, so the smallest team is
	-- two; 0 means the league does not play in sessions.
	if p_rules ? 'team_size' then
		if jsonb_typeof(p_rules->'team_size') <> 'number'
			or (p_rules->>'team_size')::numeric <> floor((p_rules->>'team_size')::numeric)
			or ((p_rules->>'team_size')::numeric <> 0
				and (p_rules->>'team_size')::numeric not between 2 and 10) then
			raise exception 'TDC (Error): team_size must be 0 (no sessions) or a whole number from 2 to 10.';
		end if;
	end if;

	-- Null is the cyclic shift. Anything else is the LD's table, one row per
	-- session, in one of two forms. A row of numbers names the away position
	-- that meets home positions 1, 2, 3 … (23 Oct). A row of pairs names both,
	-- [home, away], in the order the frames are played (16 Nov, UV: a card
	-- that follows the league's paper scoresheet). Each row must use every
	-- home and every away position once — design rule 1, a player may not
	-- play twice in a session — and session 1 is the captains' own order. A
	-- pairing repeated across sessions is allowed (UV, 23 Oct): the settings
	-- page warns about it, the database does not refuse it.
	if p_rules ? 'rotation' and jsonb_typeof(p_rules->'rotation') <> 'null' then
		v_n := private.tdc_team_size(p_rules);

		if v_n = 0 then
			raise exception 'TDC (Error): a rotation table needs a team size.';
		end if;

		if jsonb_typeof(p_rules->'rotation') <> 'array'
			or jsonb_array_length(p_rules->'rotation') <> v_n then
			raise exception 'TDC (Error): the rotation table must have one row for each of the % sessions.', v_n;
		end if;

		for v_s in 0 .. v_n - 1 loop
			v_row := p_rules->'rotation'->v_s;

			-- All numbers, or all [home, away] pairs of numbers: never a mix.
			if jsonb_typeof(v_row) <> 'array' or jsonb_array_length(v_row) <> v_n
				or (exists (select 1 from jsonb_array_elements(v_row) e where jsonb_typeof(e) <> 'number')
					and exists (select 1 from jsonb_array_elements(v_row) e
						where jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2
							or jsonb_typeof(e->0) <> 'number' or jsonb_typeof(e->1) <> 'number')) then
				if jsonb_typeof(v_row) = 'array' and jsonb_typeof(v_row->0) = 'array' then
					raise exception 'TDC (Error): session % of the rotation table must name % pairs of home and away positions.', v_s + 1, v_n;
				end if;
				raise exception 'TDC (Error): session % of the rotation table must name % away positions.', v_s + 1, v_n;
			end if;

			v_pairs := jsonb_typeof(v_row->0) = 'array';

			if (select array_agg(x order by x) from (
					select case when v_pairs then (e->>1)::numeric else (e #>> '{}')::numeric end as x
					from jsonb_array_elements(v_row) e) a)
				<> (select array_agg(g::numeric order by g) from generate_series(1, v_n) g) then
				raise exception 'TDC (Error): in session % of the rotation table, every away player must play exactly once.', v_s + 1;
			end if;

			if v_pairs and (select array_agg((e->>0)::numeric order by (e->>0)::numeric) from jsonb_array_elements(v_row) e)
				<> (select array_agg(g::numeric order by g) from generate_series(1, v_n) g) then
				raise exception 'TDC (Error): in session % of the rotation table, every home player must play exactly once.', v_s + 1;
			end if;

			if v_s = 0 and exists (
				select 1 from jsonb_array_elements(v_row) with ordinality t(e, o)
				where case when v_pairs
					then (e->>0)::numeric <> o or (e->>1)::numeric <> o
					else (e #>> '{}')::numeric <> o end
			) then
				raise exception 'TDC (Error): session 1 of the rotation table is the captains'' own order — H1 v A1, H2 v A2 and so on.';
			end if;
		end loop;
	end if;
end;
$function$
;


-- ─────────────────────────────────────────────────────────────────
-- Who meets whom, and where a frame sits
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.tdc_rotation_away(p_rules jsonb, p_session integer, p_home integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
	select case
		when t.n < 1
			or p_session is null or p_session not between 1 and t.n
			or p_home is null or p_home not between 1 and t.n
			then null
		-- The LD's own table written as pairs in frame order (16 Nov): the
		-- away position paired with this home position in that session.
		when jsonb_typeof(p_rules->'rotation'->(p_session - 1)->0) = 'array'
			then (select (e->>1)::integer
				from jsonb_array_elements(p_rules->'rotation'->(p_session - 1)) e
				where (e->>0)::integer = p_home
				limit 1)
		-- The LD's own table.
		when jsonb_typeof(p_rules->'rotation') = 'array'
			then (p_rules->'rotation'->(p_session - 1)->>(p_home - 1))::integer
		-- The cyclic shift: the away column moves up one each session.
		else ((p_home - 1 + p_session - 1) % t.n) + 1
	end
	from (select private.tdc_team_size(p_rules) as n) t;
$function$
;

CREATE OR REPLACE FUNCTION private.tdc_frame_position(p_rules jsonb, p_slot integer, p_side text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
	select case
		when p_slot is null then null
		-- No sessions: the slot is the position, and slot n meets slot n.
		when t.n < 1 then p_slot
		-- A table written as pairs names both positions of each frame, in the
		-- order they are played (16 Nov): frame j of a session is its pair j.
		-- (p_slot >= 1: a negative index would count from the end of the row.)
		when p_slot >= 1
			and jsonb_typeof(p_rules->'rotation'->((p_slot - 1) / t.n)->((p_slot - 1) % t.n)) = 'array'
			then (p_rules->'rotation'->((p_slot - 1) / t.n)->((p_slot - 1) % t.n)
				->>(case when p_side = 'home' then 0 else 1 end))::integer
		when p_side = 'home' then ((p_slot - 1) % t.n) + 1
		else private.tdc_rotation_away(p_rules, ((p_slot - 1) / t.n) + 1, ((p_slot - 1) % t.n) + 1)
	end
	from (select private.tdc_team_size(p_rules) as n) t;
$function$
;
