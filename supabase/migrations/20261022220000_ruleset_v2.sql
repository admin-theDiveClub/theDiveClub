-- Ruleset version 2: the two settings team play needs.
--
-- `lineup_cutoff_hours` — past this many hours before a team match, a side
--   that has not put a lineup in concedes. 0 is off. Evaluated lazily when the
--   match is opened, so there is no scheduled job to go wrong.
-- `strict_frame_order` — nationals forbid changing the order frames are played
--   in; most league play allows any order. When strict, a scorer may only edit
--   the frame next in sequence.
--
-- The third thing step 4 was going to need, a `by_schedule` break rule, is
-- already there: it was added with the tournament work and is in the version 1
-- list of allowed values. Team play lags every frame and the grid says who
-- breaks, so nothing is derived from results — which matters because
-- winner_breaks and loser_breaks cannot be derived in team play at all, where
-- frame 4 routinely finishes before frame 3.
--
-- ── Why a new version rather than two more keys ──
--
-- private.tdc_check_match_rules refuses a ruleset that is missing a key, and
-- the match page reads a match's stored ruleset and sends it straight back
-- when somebody changes a setting — there is no merge with defaults in
-- between. Adding a required key to version 1 would therefore have broken the
-- settings panel on every match already played, the first time anybody touched
-- it. The 15 October migration said as much when it wrote the list down: "A
-- later version adds its own list rather than editing this one, so a match
-- scored under version 1 keeps its meaning." This is that later version.
--
-- Version 1 is frozen. New rulesets are made at version 2 by TDCMatchDef;
-- matches already played stay at version 1 and keep round-tripping unchanged.
-- Everything that reads the new settings does so through the two helpers
-- below, which answer for a version 1 ruleset as the system behaves today.

-- One place each setting is read, so that "what does this mean on a ruleset
-- that predates it" is answered once rather than in every caller.
create function private.tdc_lineup_cutoff_hours(p_rules jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
	select case
		when p_rules ? 'lineup_cutoff_hours'
			then greatest(0, (p_rules->>'lineup_cutoff_hours')::integer)
		else 0   -- version 1: no cutoff, which is how every match behaves today
	end;
$$;

create function private.tdc_strict_frame_order(p_rules jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
	select coalesce((p_rules->>'strict_frame_order')::boolean, false);
$$;

revoke execute on function private.tdc_lineup_cutoff_hours(jsonb) from public, anon;
revoke execute on function private.tdc_strict_frame_order(jsonb) from public, anon;
grant execute on function private.tdc_lineup_cutoff_hours(jsonb) to authenticated;
grant execute on function private.tdc_strict_frame_order(jsonb) to authenticated;

-- Patched from the live definition: the version dispatch, the version 2 list
-- and the type checks for its two keys. Nothing else is touched.

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

	v_required text[];
	v_missing  text[];
	v_extra    text[];
begin
	if p_rules is null or jsonb_typeof(p_rules) <> 'object' then
		raise exception 'TDC (Error): the ruleset must be a json object.';
	end if;

	v_required := case p_rules->>'version'
		when '1' then v_v1
		when '2' then v_v2
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
end;
$function$;
