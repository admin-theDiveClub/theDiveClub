-- A win condition of "free play": no target, no end.
--
-- Two people on a table for an hour are not racing to anything. They want a
-- running score and nothing else, and the match ends when they stop playing.
-- Without this, every casual knockabout had to pretend to be a race to some
-- number nobody was counting to.
--
-- Nothing else changes: a match with no win condition simply never has a
-- winner, which the page already handles, and the frames carry the record as
-- they always do.

create or replace function private.tdc_check_match_rules(p_rules jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_required text[] := array[
		'version', 'discipline', 'win_condition_type', 'win_condition_target',
		'track_breaks', 'break_determination', 'break_finish_enabled',
		'draws_allowed', 'tiebreak_method', 'on_time_expiry',
		'max_match_minutes', 'golden_break_enabled', 'reverse_break_finish_enabled',
		'break_finish_requires_breaker', 'shot_clock_enabled', 'shot_clock_seconds',
		'shot_clock_first_shot_seconds', 'extensions_per_player', 'extension_seconds',
		'referee_required', 'score_entry_mode', 'approval_mode', 'dispute_window_hours'
	];
	v_missing text[];
	v_extra   text[];
begin
	if p_rules is null or jsonb_typeof(p_rules) <> 'object' then
		raise exception 'TDC (Error): the ruleset must be a json object.';
	end if;

	if (p_rules->>'version') is distinct from '1' then
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
end;
$$;
