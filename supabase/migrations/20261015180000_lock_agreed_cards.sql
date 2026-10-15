-- An agreed scorecard is locked, and can be reopened.
--
-- Until now "agreed" was a label. The frames stayed writable, so either player
-- could change a result after both had signed off on it and nothing would say
-- so. Agreement has to mean something or there is no point asking for it.
--
-- Locking is a trigger on tbl_frames rather than a check inside each function,
-- because it then covers every route in — the two frame functions today, the
-- timer hardware and the team scoresheet later — without anyone remembering to
-- add it.
--
-- Nothing becomes permanent. Either player can reopen a card, which is recorded
-- like everything else, and the match goes back to needing a fresh submission
-- and a fresh agreement. A mistake found a week later is still fixable; it just
-- cannot be fixed quietly.

-- ─── State, worked out from the last thing that happened ───
-- Rewritten: the old version looked for an answer recorded after a submission,
-- which could not express "reopened". Reading the most recent event instead
-- says the same thing more simply and leaves room for the next kind.
create or replace function private.tdc_card_state(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_match    public.tbl_matches%rowtype;
	v_last     public.tbl_match_events%rowtype;
	v_hours    integer;
	v_deadline timestamptz;
begin
	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		return jsonb_build_object('state', 'unknown');
	end if;

	-- Only events about the card as it stands now. An older one describes a
	-- card that has since been changed, so it says nothing about this one.
	select * into v_last
	from public.tbl_match_events
	where match_id = p_match_id and card_version = v_match.card_version
	order by created_at desc, id desc
	limit 1;

	if v_last.id is null or v_last.kind = 'reopened' then
		return jsonb_build_object('state', 'in_progress');
	end if;

	if v_last.kind = 'agreed' then
		return jsonb_build_object('state', 'agreed', 'by', v_last.player_id, 'at', v_last.created_at);
	end if;

	if v_last.kind = 'disputed' then
		return jsonb_build_object('state', 'disputed', 'by', v_last.player_id,
			'at', v_last.created_at, 'note', v_last.note);
	end if;

	-- Submitted, and nobody has answered. Silence past the window counts as
	-- agreement, or a card sits unfinished because somebody lost interest.
	v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 48);
	v_deadline := v_last.created_at + make_interval(hours => v_hours);

	if v_hours > 0 and now() >= v_deadline then
		return jsonb_build_object('state', 'agreed', 'by', null, 'at', v_deadline, 'by_silence', true);
	end if;

	return jsonb_build_object(
		'state', 'awaiting',
		'submitted_by', v_last.player_id,
		'at', v_last.created_at,
		'deadline', case when v_hours > 0 then v_deadline end
	);
end;
$$;


-- ─── The lock ───
-- Deleting a whole match has to get past this, so it turns the switch off for
-- its one statement, the same way the credit ledger and redeem codes do.
create function private.tdc_frames_locked_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_match uuid := coalesce(new.match_id, old.match_id);
begin
	if current_setting('tdc.card_unlock', true) = 'on' then
		return coalesce(new, old);
	end if;

	if (private.tdc_card_state(v_match)->>'state') = 'agreed' then
		raise exception 'Both players have agreed this scorecard. Reopen it before changing anything.';
	end if;

	return coalesce(new, old);
end;
$$;

create trigger tbl_frames_locked_when_agreed
	before insert or update or delete on public.tbl_frames
	for each row execute function private.tdc_frames_locked_guard();


-- ─── Reopening ───
create function public.tdc_reopen_card(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_match public.tbl_matches%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can reopen its scorecard.';
	end if;

	if v_match.sanctioned then
		raise exception 'This match counts towards rankings. Ask the organiser to reopen it.';
	end if;

	if (private.tdc_card_state(p_match_id)->>'state') <> 'agreed' then
		raise exception 'This scorecard is not settled, so there is nothing to reopen.';
	end if;

	insert into public.tbl_match_events (match_id, player_id, kind, card_version)
	values (p_match_id, v_me, 'reopened', v_match.card_version);

	update public.tbl_matches
	set status = 'in_progress', ended_at = null
	where id = p_match_id;

	return private.tdc_card_state(p_match_id);
end;
$$;

revoke execute on function public.tdc_reopen_card(uuid) from public, anon;
grant execute on function public.tdc_reopen_card(uuid) to authenticated;


-- ─── Settings are locked too ───
-- A ruleset change rescores frames, so it is every bit as much a change to an
-- agreed card as editing one.
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

	if (private.tdc_card_state(p_match_id)->>'state') = 'agreed' then
		raise exception 'Both players have agreed this scorecard. Reopen it before changing anything.';
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


-- ─── Deleting has to get past the lock ───
create or replace function public.tdc_delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_match public.tbl_matches%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can delete it.';
	end if;

	if v_match.sanctioned then
		raise exception 'This match counts towards rankings and cannot be deleted. Ask the organiser.';
	end if;

	-- Removing a match takes its frames with it, agreed or not. The lock is
	-- there to stop a card being changed behind someone's back, not to keep a
	-- match nobody wants.
	perform set_config('tdc.card_unlock', 'on', true);
	delete from public.tbl_matches where id = p_match_id;
	perform set_config('tdc.card_unlock', 'off', true);
end;
$$;
