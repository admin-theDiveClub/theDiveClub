-- Sending a card back actually sends it back.
--
-- Found 21 Oct while building the fixture player swap, which needs a way to
-- unlock a published result and names "reject or override" as the two routes.
-- Only one of them worked.
--
-- ─── The bug ───
--
-- tdc_approve_card writes an 'approved' event. tdc_reject_card writes a
-- 'rejected' event and sets the match back to in_progress. But
-- private.tdc_card_state looks for the latest 'approved' event at the current
-- card_version and returns 'approved' the moment it finds one, before it ever
-- looks at what happened afterwards. private.tdc_published_at does the same.
--
-- So after approving and then rejecting:
--
--   state      = approved     (should be in_progress, sent_back)
--   published  = true         (should be false)
--   locked     = true         (should be false)
--
-- A TD who approved by mistake had no way back, the frames stayed locked
-- against further editing, and the bracket kept advancing on the result. The
-- "send it back" button did nothing but write a note.
--
-- ─── Why it was written that way ───
--
-- The comment on the approved branch reads: "An approval of the card as it
-- stands is terminal. A later objection is recorded against it but does not
-- undo it." That rule is correct and deliberate — a *player objecting* after
-- publication must not unpublish a result, which is the whole point of
-- 20261020140000. The mistake is that the branch does not distinguish an
-- objection from a rejection. They are different acts by different people:
--
--   'disputed'  — a player says the card is wrong. Recorded, flagged to the
--                 coordinator, does not unlock. Unchanged by this migration.
--   'rejected'  — the coordinator themselves sends the card back. That is the
--                 coordinator withdrawing their own approval, and it has to
--                 take effect or the button is a lie.
--
-- ─── The fix ───
--
-- One extra condition in each of the two functions: an approval counts only
-- while no rejection of the same card_version is newer than it. Nothing else
-- about either function changes, and nothing about objections changes.

-- ─────────────────────────────────────────────────────────────────
-- Publishing
--
-- Replaces the version from 20261020120000. Identical but for the
-- not-exists on a later rejection in the coordinator_approval branch.
-- Patched, not retyped.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_published_at(p_match_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_m    public.tbl_matches%rowtype;
	v_mode text;
	v_at   timestamptz;
begin
	select * into v_m from public.tbl_matches where id = p_match_id;
	if v_m.id is null then return null; end if;

	-- Publishing only means something inside a competition: a social match has
	-- no bracket and no standings to publish to, and nobody above the two
	-- players to approve it. Without this line a social dispute_window match
	-- would publish and lock the moment it was submitted, leaving the opponent
	-- unable to agree or dispute — which is social play broken outright.
	if private.tdc_match_competition(p_match_id) is null then
		return null;
	end if;

	-- A coordinator setting the score by hand is the coordinator approving it:
	-- there is nobody above them to ask, and making them press a second button
	-- would only produce matches that are overridden and not published.
	if exists (select 1 from public.tbl_match_result_override o where o.match_id = p_match_id) then
		select o.set_at into v_at from public.tbl_match_result_override o where o.match_id = p_match_id;
		return v_at;
	end if;

	v_mode := coalesce(v_m.rules->>'approval_mode', 'none');

	if v_mode in ('coordinator_approval', 'both') then
		-- Only an approval of the card as it stands. An approval of an older
		-- version describes a card that has since changed, exactly as a stale
		-- submission does.
		--
		-- And only one the coordinator has not since taken back: a 'rejected'
		-- event newer than the approval is the coordinator withdrawing it.
		-- Added 21 Oct — without this, sending a card back left it published.
		select max(e.created_at) into v_at
		from public.tbl_match_events e
		where e.match_id = p_match_id and e.kind = 'approved'
			and e.card_version = v_m.card_version
			and not exists (
				select 1 from public.tbl_match_events r
				where r.match_id = p_match_id and r.kind = 'rejected'
					and r.card_version = v_m.card_version
					and (r.created_at, r.id) > (e.created_at, e.id)
			);
		return v_at;
	end if;

	-- none and dispute_window: submitting is publishing.
	select max(e.created_at) into v_at
	from public.tbl_match_events e
	where e.match_id = p_match_id and e.kind = 'submitted'
		and e.card_version = v_m.card_version;
	return v_at;
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- Where a card stands
--
-- Replaces the version from 20261020120000. The only change is the same
-- not-exists on the approved branch. Patched, not retyped — the rest of this
-- function is the publishing design and must not drift.
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
	v_base      jsonb;
begin
	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		return jsonb_build_object('state', 'unknown');
	end if;

	v_none := coalesce(v_match.rules->>'approval_mode', 'none') = 'none';
	v_published := private.tdc_published_at(p_match_id);

	-- Everything below carries these, so a page never has to ask separately
	-- whether a result counts or whether it may still be edited.
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
	end if;

	-- An approval of the card as it stands is terminal. A later objection is
	-- recorded against it but does not undo it.
	-- A later *rejection* is a different act from an objection: that is the
	-- coordinator withdrawing their own approval, and it does undo it. Added
	-- 21 Oct; before that this branch caught both and "send it back" did
	-- nothing but write a note.
	select * into v_approved
	from public.tbl_match_events e
	where e.match_id = p_match_id and e.kind = 'approved'
		and e.card_version = v_match.card_version
		and not exists (
			select 1 from public.tbl_match_events r
			where r.match_id = p_match_id and r.kind = 'rejected'
				and r.card_version = v_match.card_version
				and (r.created_at, r.id) > (e.created_at, e.id)
		)
	order by e.created_at desc, e.id desc
	limit 1;

	if v_approved.id is not null then
		return v_base || jsonb_build_object('state', 'approved',
			'by', v_approved.player_id, 'at', v_approved.created_at);
	end if;

	-- Only events about the card as it stands now. An older one describes a
	-- card that has since been changed, so it says nothing about this one.
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
		-- In a competition a dispute after publication is an objection, held
		-- above, and the card stays where it was. This branch is a dispute on
		-- an unpublished card, which still reopens it.
		if v_published is not null then
			return v_base || jsonb_build_object('state', 'agreed',
				'by', null, 'at', v_published);
		end if;
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
-- Approving again after sending it back
--
-- Replaces the version from 20261020140000. Same conflation, third place: the
-- guard refuses to approve a card that has an 'approved' event at the current
-- version, without noticing that the coordinator has since rejected it. So
-- fixing the two functions above on their own would have produced a card that
-- could be sent back and then never approved — a worse dead end than the one
-- being fixed.
--
-- Patched from the original, not retyped.
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
	-- ...and not since taken back. A rejection newer than the approval is the
	-- coordinator withdrawing it, so the card is approvable again. Without
	-- this, sending a card back left it permanently unapprovable — a worse
	-- dead end than the one the rejection fix removed. Added 21 Oct.
	if exists (
		select 1 from public.tbl_match_events e
		where e.match_id = p_match_id and e.kind = 'approved'
			and e.card_version = v_match.card_version
			and not exists (
				select 1 from public.tbl_match_events r
				where r.match_id = p_match_id and r.kind = 'rejected'
					and r.card_version = v_match.card_version
					and (r.created_at, r.id) > (e.created_at, e.id)
			)
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
