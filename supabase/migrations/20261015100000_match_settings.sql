-- Changing a match's settings.
--
-- Rules and first_break_side are one operation, not two. Both move the whole
-- match: change who broke first, or change the break rule, and every frame's
-- breaker follows. Doing them separately would mean a match briefly scored
-- under half the new settings.
--
-- The ruleset is validated here rather than trusted. The design note calls the
-- jsonb quietly becoming an unvalidated config format the heaviest standing
-- risk in the whole system, and the browser is not the place to stop that: the
-- timer hardware and a future scorer app write here too.
--
-- Three things happen on every change, in order:
--   1. The new ruleset is checked whole — every key present, no extras, every
--      enumerated value known.
--   2. Break sides are worked out again, frames corrected by hand excepted.
--   3. Frames whose result no longer fits the new rules are put back to a plain
--      win, and the count is returned so the page can say what it did.
--
-- Step 3 is what stops the database holding frames that break the match's own
-- ruleset. Turn on "a break and finish must go to the breaker" halfway through
-- a match and any break and finish already credited to the other side stops
-- being legal — the browser repairs that on screen, and without this the stored
-- copy would quietly disagree with it.

create function public.tdc_update_match_settings(
	p_match_id         uuid,
	p_rules            jsonb,
	p_first_break_side text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	-- Version 1 of the ruleset. A later version adds its own list rather than
	-- editing this one, so a match scored under version 1 keeps its meaning.
	v_required text[] := array[
		'version', 'discipline', 'win_condition_type', 'win_condition_target',
		'break_determination', 'draws_allowed', 'tiebreak_method', 'on_time_expiry',
		'max_match_minutes', 'golden_break_enabled', 'reverse_break_finish_enabled',
		'break_finish_requires_breaker', 'shot_clock_enabled', 'shot_clock_seconds',
		'shot_clock_first_shot_seconds', 'extensions_per_player', 'extension_seconds',
		'referee_required', 'score_entry_mode', 'approval_mode', 'dispute_window_hours'
	];
	v_missing  text[];
	v_extra    text[];
	v_status   text;
	v_requires boolean;
	v_golden   boolean;
	v_reverse  boolean;
	v_breaks   integer;
	v_results  integer := 0;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select status into v_status from public.tbl_matches where id = p_match_id;
	if v_status is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its settings.';
	end if;

	if v_status = 'abandoned' then
		raise exception 'This match was abandoned. Its settings can no longer be changed.';
	end if;

	-- ── The ruleset, checked whole ──
	if p_rules is null or jsonb_typeof(p_rules) <> 'object' then
		raise exception 'TDC (Error): the ruleset must be a json object.';
	end if;

	if (p_rules->>'version') is distinct from '1' then
		raise exception 'TDC (Error): unknown ruleset version "%".', p_rules->>'version';
	end if;

	select array_agg(k) into v_missing
	from unnest(v_required) k where not (p_rules ? k);
	if v_missing is not null then
		raise exception 'TDC (Error): the ruleset is missing %.', array_to_string(v_missing, ', ');
	end if;

	select array_agg(k) into v_extra
	from (select k from jsonb_object_keys(p_rules) k) s
	where k <> all (v_required);
	if v_extra is not null then
		raise exception 'TDC (Error): the ruleset has unknown setting(s) %.', array_to_string(v_extra, ', ');
	end if;

	-- Enumerated values. A typo here would otherwise sit in the match until
	-- something read it and behaved oddly months later.
	if p_rules->>'discipline' not in ('8ball', '9ball', '10ball', 'blackball') then
		raise exception 'TDC (Error): unknown discipline "%".', p_rules->>'discipline'; end if;
	if p_rules->>'win_condition_type' not in ('race_to', 'best_of', 'fixed_frames', 'timed') then
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

	if p_first_break_side is not null and p_first_break_side not in ('home', 'away') then
		raise exception 'TDC (Error): first_break_side must be home or away, not "%".', p_first_break_side;
	end if;

	-- ── Write ──
	update public.tbl_matches
	set rules            = p_rules,
		first_break_side = coalesce(p_first_break_side, first_break_side),
		card_version     = card_version + 1
	where id = p_match_id;

	-- ── Everything that follows from it ──
	v_breaks := public.tdc_rederive_break_sides(p_match_id);

	v_requires := coalesce((p_rules->>'break_finish_requires_breaker')::boolean, true);
	v_golden   := coalesce((p_rules->>'golden_break_enabled')::boolean, true);
	v_reverse  := coalesce((p_rules->>'reverse_break_finish_enabled')::boolean, true);

	-- A result that no longer fits goes back to a plain win. The frame still
	-- happened and somebody still won it; only the manner of the win is in
	-- doubt, so that is the only part given up.
	with repaired as (
		update public.tbl_frames f
		set result_event = 'win'
		where f.match_id = p_match_id
			and f.status = 'complete'
			and (
				(f.result_event in ('break_and_finish', 'golden_break')
					and (f.break_outcome is distinct from 'in'
						or (v_requires and f.winner_side is distinct from f.break_side)))
				or (f.result_event = 'golden_break' and not v_golden)
				or (f.result_event = 'reverse_break_and_finish'
					and (not v_reverse or f.winner_side = f.break_side or f.break_side is null))
			)
		returning 1
	)
	select count(*) into v_results from repaired;

	return jsonb_build_object(
		'breaks_changed', v_breaks,
		'results_downgraded', v_results
	);
end;
$$;

revoke execute on function public.tdc_update_match_settings(uuid, jsonb, text) from public, anon;
grant execute on function public.tdc_update_match_settings(uuid, jsonb, text) to authenticated;
