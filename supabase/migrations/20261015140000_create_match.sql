-- Creating a match, and the rules a match may carry.
--
-- Two changes here.
--
-- 1. The ruleset gains "track_breaks" and "break_finish_enabled".
--
--    A scorecard starts at its simplest — two names, two scores, a win button
--    each side — and grows as settings are turned on. Social players want the
--    score and nothing else; who broke, break events and the rest belong to
--    league play. Until now there was no way to say "we are not recording
--    breaks": the six break_determination options all answer *who* breaks,
--    none says don't ask.
--
--    Both default to off, so a match created without touching a setting is the
--    simple one.
--
-- 2. Validation moves into private.tdc_check_match_rules, which creating and
--    changing a match both call. Two copies of the key list would drift the
--    first time a setting was added.

-- ─── The ruleset, checked whole ───
create function private.tdc_check_match_rules(p_rules jsonb)
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
end;
$$;

revoke execute on function private.tdc_check_match_rules(jsonb) from public, anon;
grant execute on function private.tdc_check_match_rules(jsonb) to authenticated;


-- ─── Changing settings now uses the shared check ───
create or replace function public.tdc_update_match_settings(
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

	perform private.tdc_check_match_rules(p_rules);

	if p_first_break_side is not null and p_first_break_side not in ('home', 'away') then
		raise exception 'TDC (Error): first_break_side must be home or away, not "%".', p_first_break_side;
	end if;

	update public.tbl_matches
	set rules            = p_rules,
		first_break_side = coalesce(p_first_break_side, first_break_side),
		card_version     = card_version + 1
	where id = p_match_id;

	v_breaks := public.tdc_rederive_break_sides(p_match_id);

	v_requires := coalesce((p_rules->>'break_finish_requires_breaker')::boolean, true);
	v_golden   := coalesce((p_rules->>'golden_break_enabled')::boolean, true);
	v_reverse  := coalesce((p_rules->>'reverse_break_finish_enabled')::boolean, true);

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

	return jsonb_build_object('breaks_changed', v_breaks, 'results_downgraded', v_results);
end;
$$;


-- ─── Starting a match ───
-- A player may only create a match they are in themselves. Anything else is a
-- way to put results nobody played into somebody's record.
--
-- An opponent without a login — a walk-in or a guest — cannot agree to a result
-- or dispute one, so only venue staff may start a match against them.
create function public.tdc_create_match(
	p_opponent_player_id uuid,
	p_rules              jsonb,
	p_first_break_side   text default null,
	p_venue_id           uuid default null,
	p_i_am               text default 'home'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me       uuid;
	v_opponent public.tbl_players%rowtype;
	v_home     uuid;
	v_away     uuid;
	v_id       uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile found for this account.';
	end if;

	if p_i_am not in ('home', 'away') then
		raise exception 'TDC (Error): your side must be home or away, not "%".', p_i_am;
	end if;

	select * into v_opponent from public.tbl_players where id = p_opponent_player_id;
	if v_opponent.id is null then
		raise exception 'TDC (Error): no player with id %.', p_opponent_player_id;
	end if;
	if v_opponent.id = v_me then
		raise exception 'You cannot start a match against yourself.';
	end if;

	-- A walk-in or guest has nobody who can confirm or dispute the result.
	if v_opponent.user_id is null then
		if p_venue_id is null
			or not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
			raise exception 'Only club staff can start a match against a walk-in or guest.';
		end if;
	end if;

	perform private.tdc_check_match_rules(p_rules);

	if p_first_break_side is not null and p_first_break_side not in ('home', 'away') then
		raise exception 'TDC (Error): first_break_side must be home or away, not "%".', p_first_break_side;
	end if;

	if p_i_am = 'home' then v_home := v_me;       v_away := v_opponent.id;
	else                    v_home := v_opponent.id; v_away := v_me;
	end if;

	insert into public.tbl_matches (
		created_by, venue_id,
		home_side_kind, home_player_id, away_side_kind, away_player_id,
		first_break_side, rules, status
	)
	values (
		(select auth.uid()), p_venue_id,
		'player', v_home, 'player', v_away,
		p_first_break_side, p_rules, 'scheduled'
	)
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_match(uuid, jsonb, text, uuid, text) from public, anon;
grant execute on function public.tdc_create_match(uuid, jsonb, text, uuid, text) to authenticated;


-- ─── Finding someone to play ───
-- Name search across every venue: a player is global, and a search that only
-- found people from one club would push staff into creating a second record
-- for somebody who already exists.
--
-- Returns players with a login only. Walk-ins are reached through the staff
-- tools, which already know how to look them up.
create function public.tdc_search_opponents(p_query text, p_limit integer default 20)
returns table (id uuid, display_name text, full_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		p.avatar_path
	from public.tbl_players p
	where p.user_id is not null
		and p.id <> coalesce(
			(select x.id from public.tbl_players x where x.user_id = (select auth.uid())),
			'00000000-0000-0000-0000-000000000000'::uuid)
		and char_length(trim(coalesce(p_query, ''))) >= 2
		and (
			p.display_name ilike '%' || trim(p_query) || '%'
			or coalesce(p.first_name, '') ilike '%' || trim(p_query) || '%'
			or coalesce(p.last_name, '')  ilike '%' || trim(p_query) || '%'
		)
	order by p.display_name
	limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke execute on function public.tdc_search_opponents(text, integer) from public, anon;
grant execute on function public.tdc_search_opponents(text, integer) to authenticated;


-- ─── Bring the matches that already exist up to the new ruleset ───
-- Without this the next settings change on an older match would be refused for
-- missing keys it never had a chance to carry.
update public.tbl_matches
set rules = rules
	|| jsonb_build_object(
		'track_breaks', (rules ? 'break_determination'),
		'break_finish_enabled', true)
where not (rules ? 'track_breaks');
