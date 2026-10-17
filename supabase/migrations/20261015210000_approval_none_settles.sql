-- "Approval: not needed" now means something.
--
-- approval_mode has been validated since the ruleset was written and read
-- nowhere, so every match behaved as though a dispute window were set: one
-- player submitted, the other had to agree, and a social game between two
-- mates needed a signature nobody wanted to give.
--
-- With approval_mode = 'none', submitting settles it there and then. The card
-- locks on submission and the match is over.
--
-- Two events are written rather than one, and the settlement is recorded at the
-- time rather than worked out later from the rules. That matters: the ruleset
-- can be changed afterwards, and a card that settled under "no approval needed"
-- must not start reading as unsettled because somebody later turned approval
-- on. It is the same reason frames carry their own result instead of the score
-- being stored, and the reason the ruleset is frozen onto the match.
--
-- Both events land in one transaction. created_at defaults to clock_timestamp()
-- rather than now(), so they get distinct times and the log keeps its order —
-- without that, the state machine could not tell which came last.

create or replace function public.tdc_submit_card(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me     uuid;
	v_match  public.tbl_matches%rowtype;
	v_state  text;
	v_frames integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can submit its scorecard.';
	end if;

	select count(*) into v_frames from public.tbl_frames where match_id = p_match_id;
	if v_frames = 0 then
		raise exception 'There is nothing to submit yet — no frames have been played.';
	end if;

	v_state := private.tdc_card_state(p_match_id)->>'state';
	if v_state = 'awaiting' then
		raise exception 'This scorecard has already been submitted and is waiting on the other player.';
	end if;
	if v_state = 'agreed' then
		raise exception 'This scorecard has already been agreed.';
	end if;

	insert into public.tbl_match_events (match_id, player_id, kind, card_version)
	values (p_match_id, v_me, 'submitted', v_match.card_version);

	-- Nobody has to sign this one. Submitting is the end of it.
	if coalesce(v_match.rules->>'approval_mode', 'none') = 'none' then
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'agreed', v_match.card_version,
			'Settled on submission: this match was set to need no approval.');
	end if;

	update public.tbl_matches
	set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
		ended_at = coalesce(ended_at, now())
	where id = p_match_id;

	return private.tdc_card_state(p_match_id);
end;
$$;


-- ─── Taking back a card nobody has answered ───
-- The result page now appears as soon as a card is submitted, not only once it
-- has been agreed, so the person who submitted one too early needs a way back
-- in. Reopening only accepted an agreed card, and the button would have failed.
--
-- Only the submitter may withdraw, and only while nothing has been answered.
-- The other player's way back in is to dispute it, which asks for a reason —
-- and that stays the case, because "I disagree" deserves to be written down.
create or replace function public.tdc_reopen_card(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_match public.tbl_matches%rowtype;
	v_state jsonb;
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

	v_state := private.tdc_card_state(p_match_id);

	if v_state->>'state' = 'awaiting' then
		if (v_state->>'submitted_by')::uuid is distinct from v_me then
			raise exception 'You did not submit this scorecard. Say what is wrong with it instead.';
		end if;
	elsif v_state->>'state' <> 'agreed' then
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


-- ─── The state says how it was settled ───
-- Three different things now end a card, and "Agreed by both players" is only
-- true of one of them. The page needs to be able to tell them apart, so the
-- state carries the reason rather than the page guessing from the rules.
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
	v_none     boolean;
begin
	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		return jsonb_build_object('state', 'unknown');
	end if;

	v_none := coalesce(v_match.rules->>'approval_mode', 'none') = 'none';

	-- Only events about the card as it stands now. An older one describes a
	-- card that has since been changed, so it says nothing about this one.
	select * into v_last
	from public.tbl_match_events
	where match_id = p_match_id and card_version = v_match.card_version
	order by created_at desc, id desc
	limit 1;

	if v_last.id is null or v_last.kind = 'reopened' then
		return jsonb_build_object('state', 'in_progress', 'no_approval', v_none);
	end if;

	if v_last.kind = 'agreed' then
		return jsonb_build_object('state', 'agreed', 'by', v_last.player_id, 'at', v_last.created_at,
			'no_approval', v_none);
	end if;

	if v_last.kind = 'disputed' then
		return jsonb_build_object('state', 'disputed', 'by', v_last.player_id,
			'at', v_last.created_at, 'note', v_last.note, 'no_approval', v_none);
	end if;

	-- Submitted, and nobody has answered. Silence past the window counts as
	-- agreement, or a card sits unfinished because somebody lost interest.
	--
	-- Nothing runs on a schedule to make this happen: the deadline passing is
	-- the whole of it. The lock on tbl_frames asks this function on every write,
	-- so a card stops being editable the moment the window closes, with no job
	-- to miss and nothing to catch up on.
	v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 48);
	v_deadline := v_last.created_at + make_interval(hours => v_hours);

	if v_hours > 0 and now() >= v_deadline then
		return jsonb_build_object('state', 'agreed', 'by', null, 'at', v_deadline,
			'by_silence', true, 'no_approval', v_none);
	end if;

	return jsonb_build_object(
		'state', 'awaiting',
		'submitted_by', v_last.player_id,
		'at', v_last.created_at,
		'deadline', case when v_hours > 0 then v_deadline end,
		'no_approval', v_none
	);
end;
$$;
