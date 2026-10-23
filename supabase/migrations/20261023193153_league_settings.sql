-- League settings: team size, the rotation table, and a rule change that
-- reaches the matches nobody has started.
--
-- Settled with UV on 23 Oct (docs/DECISIONS.md, four entries that day):
--
--   * A team night is sessions. The team size is a league setting: a five-man
--     league plays five frames a session, five sessions, 25 frames.
--   * The rotation table — who meets whom in each session after the first —
--     is the LD's, with a cyclic shift as the default. Session 1 is always the
--     captains' own order, H1 v A1 … H5 v A5.
--   * Each session uses every away position exactly once (design rule 1, a
--     player may not play twice in a session). A table that repeats a pairing
--     across the night is allowed; the settings page warns about it.
--   * The team size decides how long the card is. The win condition still
--     decides who won, and the two are not cross-checked.
--   * Changing a league's rules reaches every match in it that has no frames,
--     no locked side and no card events. The rest keep the rules they were
--     frozen with, and the caller is told how many.
--
-- ── Why version 3 ──
--
-- The same reason as version 2 (20261022220000): tdc_check_match_rules refuses
-- a ruleset missing a key, and the match page sends a match's stored ruleset
-- straight back when a setting changes. Adding required keys to version 2
-- would break the settings panel on every match made since 22 Oct. Versions 1
-- and 2 are frozen; TDCMatchDef makes new rulesets at version 3.
--
-- Both new keys are inert outside team play: a singles match made at version
-- 3 carries team_size 0 and rotation null, and nothing reads either for it.
--
-- `rotation` is null for the cyclic shift rather than the shift written out,
-- so the default is worked out in one place (private.tdc_rotation_away) and a
-- league that changes its team size does not carry a table of the old size.
-- It is frozen onto a match like everything else: an LD who edits the table on
-- Wednesday cannot reshuffle the rest of Tuesday's half-played night.
--
-- The stored form is one row per session, each naming the away position that
-- meets home positions 1, 2, 3 … in that session:
--
--   [[1,2,3,4,5], [2,3,4,5,1], [3,4,5,1,2], [4,5,1,2,3], [5,1,2,3,4]]
--
-- is the cyclic shift for five: in session 2, H1 meets A2 and H5 meets A1.


-- ─────────────────────────────────────────────────────────────────
-- Reading the two settings
-- ─────────────────────────────────────────────────────────────────

-- One place each is read, so "what does this mean on a ruleset that predates
-- it" is answered once. Versions 1 and 2: no team size, which is how every
-- league night behaved until now.
create function private.tdc_team_size(p_rules jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
	select coalesce((p_rules->>'team_size')::integer, 0);
$$;

-- Which away position meets home position p_home in session p_session.
-- Null when the ruleset has no team size, or either number is off the card.
create function private.tdc_rotation_away(p_rules jsonb, p_session integer, p_home integer)
returns integer
language sql
immutable
set search_path = ''
as $$
	select case
		when t.n < 1
			or p_session is null or p_session not between 1 and t.n
			or p_home is null or p_home not between 1 and t.n
			then null
		-- The LD's own table.
		when jsonb_typeof(p_rules->'rotation') = 'array'
			then (p_rules->'rotation'->(p_session - 1)->>(p_home - 1))::integer
		-- The cyclic shift: the away column moves up one each session.
		else ((p_home - 1 + p_session - 1) % t.n) + 1
	end
	from (select private.tdc_team_size(p_rules) as n) t;
$$;

revoke execute on function private.tdc_team_size(jsonb) from public, anon;
revoke execute on function private.tdc_rotation_away(jsonb, integer, integer) from public, anon;
grant execute on function private.tdc_team_size(jsonb) to authenticated;
grant execute on function private.tdc_rotation_away(jsonb, integer, integer) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The ruleset check
-- ─────────────────────────────────────────────────────────────────

-- Patched from the live definition (20261022220000): the version 3 list, its
-- dispatch, and the checks for its two keys. Nothing else is touched.

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
	-- session. Each row must use every away position once — design rule 1, a
	-- player may not play twice in a session — and session 1 is the captains'
	-- own order. A pairing repeated across sessions is allowed (UV, 23 Oct):
	-- the settings page warns about it, the database does not refuse it.
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

			if jsonb_typeof(v_row) <> 'array' or jsonb_array_length(v_row) <> v_n
				or exists (select 1 from jsonb_array_elements(v_row) e where jsonb_typeof(e) <> 'number') then
				raise exception 'TDC (Error): session % of the rotation table must name % away positions.', v_s + 1, v_n;
			end if;

			if (select array_agg((e #>> '{}')::numeric order by (e #>> '{}')::numeric) from jsonb_array_elements(v_row) e)
				<> (select array_agg(g::numeric order by g) from generate_series(1, v_n) g) then
				raise exception 'TDC (Error): in session % of the rotation table, every away player must play exactly once.', v_s + 1;
			end if;

			if v_s = 0 and exists (
				select 1 from jsonb_array_elements(v_row) with ordinality t(e, o)
				where (e #>> '{}')::numeric <> o
			) then
				raise exception 'TDC (Error): session 1 of the rotation table is the captains'' own order — H1 v A1, H2 v A2 and so on.';
			end if;
		end loop;
	end if;
end;
$function$;


-- ─────────────────────────────────────────────────────────────────
-- How many frames a team night has
-- ─────────────────────────────────────────────────────────────────

-- Patched from the live definition (20261023130000): a team size, when there
-- is one, decides the card ahead of the win condition. Five-man → 25. The win
-- condition still answers for a league with no team size, exactly as before.

CREATE OR REPLACE FUNCTION private.tdc_lineup_slots(p_match_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select greatest(
		-- Never zero. A night with nobody marked present yet still has a
		-- first slot, and the slot guard reads this number to decide what
		-- exists — answering zero there is the same bug in another place.
		1,
		-- What the rules say, when they say anything countable.
		coalesce((
			select case
				-- N players a side, N sessions of N frames. The win condition
				-- decides who won, not how long the night is (UV, 23 Oct).
				when private.tdc_team_size(m.rules) > 0
					then private.tdc_team_size(m.rules) * private.tdc_team_size(m.rules)
				else case m.rules->>'win_condition_type'
					when 'fixed_frames' then (m.rules->>'win_condition_target')::integer
					when 'best_of'      then (m.rules->>'win_condition_target')::integer
					when 'race_to'      then (m.rules->>'win_condition_target')::integer * 2 - 1
				end
			end
			from public.tbl_matches m where m.id = p_match_id
		), 0),
		-- Whatever order has already been built, so nothing is ever lost.
		coalesce((
			select max(lineup_slot) from public.tbl_league_match_order
			where match_id = p_match_id
		), 0),
		-- A timed or free-play night still has an order: one slot per player
		-- on the fuller side.
		coalesce((
			select max(n) from (
				select count(*) as n from public.tbl_league_match_squad
				where match_id = p_match_id group by side
			) s
		), 0)
	);
$function$;


-- ─────────────────────────────────────────────────────────────────
-- A rule change reaches the matches nobody has started
-- ─────────────────────────────────────────────────────────────────

-- Rules are frozen onto a match when it is created, so without this a
-- league's rule change touches no existing match at all — UV's race-to-13
-- league, switched to fixed frames, would keep two race-to-13 matches already
-- in its fixtures and say nothing.
--
-- A match is untouched when it has no frames, no locked side and no card
-- events. Those take the season's current rules. Anything else keeps what it
-- was frozen with: a lock means a captain committed an order under those
-- rules, and a frame means something was played under them. Frames are never
-- rescored.
--
-- Returns how many matches changed and how many kept rules that now differ
-- from the league's, so the page can say so rather than leave a director
-- believing every match follows the new rules.
create function private.tdc_refreeze_league_matches(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_updated integer;
	v_kept    integer;
begin
	with lm as (
		select m.id,
			m.rules as old_rules,
			private.tdc_rules_for_league_season(f.league_season_id) as new_rules,
			(not exists (select 1 from public.tbl_frames fr where fr.match_id = m.id)
				and not exists (select 1 from public.tbl_league_match_sides sd
					where sd.match_id = m.id and sd.locked_at is not null)
				and not exists (select 1 from public.tbl_match_events ev where ev.match_id = m.id)
			) as untouched
		from public.tbl_league_fixtures f
		join public.tbl_league_seasons s on s.id = f.league_season_id
		join public.tbl_matches m on m.id = f.match_id
		where s.league_id = p_league_id
	),
	upd as (
		update public.tbl_matches m
		set rules = lm.new_rules
		from lm
		where m.id = lm.id and lm.untouched and lm.new_rules is distinct from lm.old_rules
		returning m.id
	)
	select (select count(*) from upd),
		(select count(*) from lm where not lm.untouched and lm.new_rules is distinct from lm.old_rules)
	into v_updated, v_kept;

	return jsonb_build_object('matches_updated', v_updated, 'matches_kept', v_kept);
end;
$$;

revoke execute on function private.tdc_refreeze_league_matches(uuid) from public, anon, authenticated;


-- Patched from the live definition (20261022180000): returns what the
-- re-freeze did, and calls it when the rules change. Dropped first because
-- the return type changes from void; the grants are redone below.
drop function public.tdc_update_league(uuid, text, jsonb, text);

CREATE FUNCTION public.tdc_update_league(p_league_id uuid, p_name text DEFAULT NULL::text, p_rules jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_s record;
	v_frozen jsonb := jsonb_build_object('matches_updated', 0, 'matches_kept', 0);
begin
	if not exists (select 1 from public.tbl_leagues where id = p_league_id) then
		raise exception 'TDC (Error): league % not found.', p_league_id;
	end if;

	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can change it.';
	end if;

	if p_rules is not null then
		perform private.tdc_check_match_rules(p_rules);

		-- Every season lays its own changes over these. A league rule that
		-- makes one of them invalid is refused here, not discovered when the
		-- season's first match is created.
		for v_s in
			select id, name, rules_overrides from public.tbl_league_seasons where league_id = p_league_id
		loop
			begin
				perform private.tdc_check_match_rules(p_rules || v_s.rules_overrides);
			exception when others then
				raise exception 'Those rules would leave "%" with an invalid ruleset: %', v_s.name, sqlerrm;
			end;
		end loop;
	end if;

	update public.tbl_leagues
	set name  = coalesce(trim(p_name), name),
		rules = coalesce(p_rules, rules),
		notes = coalesce(p_notes, notes)
	where id = p_league_id;

	-- After the league's rules are written, because the re-freeze reads them
	-- back through private.tdc_rules_for_league_season.
	if p_rules is not null then
		v_frozen := private.tdc_refreeze_league_matches(p_league_id);
	end if;

	return v_frozen;
end;
$function$;

revoke execute on function public.tdc_update_league(uuid, text, jsonb, text) from public, anon;
grant  execute on function public.tdc_update_league(uuid, text, jsonb, text) to authenticated;
