-- Two corrections from UV's first real run through a tournament, 20 Oct.
--
-- 1. A published card still reported state 'awaiting', so the match page
--    offered "Looks right" and the database then refused it: the card was
--    already published and locked at submission. Offering a button that
--    cannot work is the thing this project has a rule against. Once a result
--    is published there is nothing left to agree to — only something to
--    object to, and only while the window is open.
--
-- 2. tdc_approve_card refused every mode except coordinator_approval, on the
--    reasoning that the others publish by themselves so there is nothing to
--    approve. There is: ending it. UV wants the TD to be able to mark any
--    finished match published and locked, with no further player input, in
--    any mode. The TD has full control, and approving is how that is said.

-- ─────────────────────────────────────────────────────────────────
-- Where a card stands
--
-- Replaces the version from 20261020120000. The change is that a published
-- card reports as settled rather than as waiting on somebody, and carries
-- whether this player may still object and until when.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_card_state(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_match     public.tbl_matches%rowtype;
	v_last      public.tbl_match_events%rowtype;
	v_approved  public.tbl_match_events%rowtype;
	v_objection public.tbl_match_events%rowtype;
	v_hours     integer;
	v_deadline  timestamptz;
	v_none      boolean;
	v_published timestamptz;
	v_until     timestamptz;
	v_base      jsonb;
begin
	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		return jsonb_build_object('state', 'unknown');
	end if;

	v_none := coalesce(v_match.rules->>'approval_mode', 'none') = 'none';
	v_published := private.tdc_published_at(p_match_id);

	v_base := jsonb_build_object(
		'no_approval', v_none,
		'published', v_published is not null,
		'published_at', v_published
	);

	-- An objection raised after publication. It does not change the state and
	-- does not unlock the card — it is a flag for the coordinator.
	if v_published is not null then
		select * into v_objection
		from public.tbl_match_events
		where match_id = p_match_id and kind = 'disputed'
			and card_version = v_match.card_version
			and created_at >= v_published
		order by created_at desc, id desc
		limit 1;

		if v_objection.id is not null then
			v_base := v_base || jsonb_build_object(
				'objection', jsonb_build_object(
					'by', v_objection.player_id,
					'at', v_objection.created_at,
					'note', v_objection.note));
		end if;

		-- How long a player has to say it is wrong. Independent of the mode:
		-- the mode decides when it publishes, this decides how long the
		-- objection window stays open afterwards.
		v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 0);
		v_until := case when v_hours > 0 then v_published + make_interval(hours => v_hours) end;
		v_base := v_base || jsonb_build_object(
			'object_until', v_until,
			'can_object', v_until is not null and now() < v_until and v_objection.id is null);
	end if;

	-- An approval of the card as it stands is terminal.
	select * into v_approved
	from public.tbl_match_events
	where match_id = p_match_id and kind = 'approved'
		and card_version = v_match.card_version
	order by created_at desc, id desc
	limit 1;

	if v_approved.id is not null then
		return v_base || jsonb_build_object('state', 'approved',
			'by', v_approved.player_id, 'at', v_approved.created_at);
	end if;

	-- Published, but nobody has approved it: the modes where submitting is
	-- publishing. Settled, locked, and open to objection — never 'awaiting',
	-- because there is nothing for the other player to agree to.
	if v_published is not null then
		return v_base || jsonb_build_object('state', 'agreed', 'by', null, 'at', v_published);
	end if;

	-- ─── Unpublished: a social card, or one waiting on a coordinator ───

	select * into v_last
	from public.tbl_match_events
	where match_id = p_match_id and card_version = v_match.card_version
	order by created_at desc, id desc
	limit 1;

	if v_last.id is null or v_last.kind in ('reopened', 'rejected') then
		return v_base || jsonb_build_object('state', 'in_progress',
			'sent_back', v_last.kind = 'rejected',
			'note', case when v_last.kind = 'rejected' then v_last.note end);
	end if;

	if v_last.kind = 'agreed' then
		return v_base || jsonb_build_object('state', 'agreed',
			'by', v_last.player_id, 'at', v_last.created_at);
	end if;

	if v_last.kind = 'disputed' then
		return v_base || jsonb_build_object('state', 'disputed', 'by', v_last.player_id,
			'at', v_last.created_at, 'note', v_last.note);
	end if;

	-- Submitted, and nobody has answered.
	v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 48);
	v_deadline := v_last.created_at + make_interval(hours => v_hours);

	if v_hours > 0 and now() >= v_deadline then
		return v_base || jsonb_build_object('state', 'agreed', 'by', null, 'at', v_deadline,
			'by_silence', true);
	end if;

	return v_base || jsonb_build_object(
		'state', 'awaiting',
		'submitted_by', v_last.player_id,
		'at', v_last.created_at,
		'deadline', case when v_hours > 0 then v_deadline end
	);
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- Approving, in any mode
--
-- Replaces the version from 20261020120000. Approving is no longer only the
-- publication step for coordinator_approval; it is the coordinator saying
-- this one is finished, which is meaningful in every mode:
--
--   coordinator_approval / both  it publishes the result
--   none                         it locks a settled card against reopening
--   dispute_window               it ends the objection window early
--
-- In all three the match becomes published, locked and terminal, and no
-- further player input is needed or possible.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_approve_card(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_comp   uuid;
	v_match  public.tbl_matches%rowtype;
	v_me     uuid;
	v_frames integer;
begin
	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_comp := private.tdc_match_competition(p_match_id);
	if v_comp is null then
		raise exception 'This match is not part of a competition, so there is nobody to approve it.';
	end if;
	if not private.tdc_can_run_tournament(v_comp) then
		raise exception 'Only the people running this competition can publish its results.';
	end if;

	select count(*) into v_frames from public.tbl_frames where match_id = p_match_id;
	if v_frames = 0 and not exists (
		select 1 from public.tbl_match_result_override o where o.match_id = p_match_id) then
		raise exception 'There is no result to publish yet: no frames, and no score set by hand.';
	end if;

	-- Already approved, rather than already published: in the modes where
	-- submitting publishes, the earlier check made approving impossible for
	-- exactly the matches the TD most wants to close.
	if exists (
		select 1 from public.tbl_match_events e
		where e.match_id = p_match_id and e.kind = 'approved'
			and e.card_version = v_match.card_version
	) then
		raise exception 'This result has already been approved.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());

	insert into public.tbl_match_events (match_id, player_id, kind, card_version)
	values (p_match_id, v_me, 'approved', v_match.card_version);

	update public.tbl_matches
	set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
		ended_at = coalesce(ended_at, now())
	where id = p_match_id;

	return private.tdc_card_state(p_match_id);
end;
$$;
