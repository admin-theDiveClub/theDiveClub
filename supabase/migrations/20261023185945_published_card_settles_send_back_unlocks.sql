-- A published card reads as settled again, and sending it back unlocks it.
--
-- Found 23 Oct by the first pgTAP suites for matches. Two faults, one knot.
--
-- ─── 1. The 20 Oct bug came back ───
--
-- In a tournament on approval 'none' or 'dispute_window', submitting a card
-- publishes it: the result counts, the bracket moves, the card locks. On 20
-- Oct UV found such a card still reporting 'awaiting', so the other player was
-- offered "Looks right" and the database then refused it. 20261020140000
-- fixed that: a published card reports 'agreed', and carries can_object and
-- object_until so the page offers an objection instead (match.js still reads
-- both).
--
-- 20261021160000 (sending back undoes an approval) replaced tdc_card_state
-- and, beyond its one intended clause, dropped can_object / object_until and
-- moved the "published means settled" branch into the disputed case only.
-- Every later copy inherited that. So the 20 Oct bug was live again, and the
-- objection button could never appear.
--
-- ─── 2. Why the branch was moved: send back did not unlock ───
--
-- "Published" in these modes is worked out from the submission alone. A
-- coordinator's send-back ('rejected') did not change that, so a sent-back
-- card stayed published and locked — the players could not fix it. Had the
-- branch stayed where it was, a sent-back card would also have read as
-- settled; moving it hid that, at the cost of fault 1.
--
-- UV, 23 Oct (docs/DECISIONS.md): a settled card is final for the players;
-- the TD or LD can open it again, and their send-back must really unlock it.
--
-- ─── The fix ───
--
-- tdc_published_at: a submission no longer counts once a send-back of the
-- same card_version has come after it — the clause approvals already carry.
-- tdc_card_state: can_object / object_until restored, and the published
-- branch put back at the head of the singles path. Both exactly as
-- 20261020140000 wrote them. The team section is untouched: it returns before
-- that point, and leagues do not publish today.
--
-- Both functions are the current text (pg_get_functiondef from a fresh local
-- database, identical to 20261021160000 and 20261023090000) with only those
-- lines added.

CREATE OR REPLACE FUNCTION private.tdc_published_at(p_match_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
	--
	-- ...unless the coordinator has sent it back since, the same clause as
	-- the approval above. Added 23 Oct: without it a send-back in these modes
	-- said "sent back" and left the card published and locked, so the players
	-- it was sent back to could not fix it. A fresh submission after the
	-- send-back publishes again.
	select max(e.created_at) into v_at
	from public.tbl_match_events e
	where e.match_id = p_match_id and e.kind = 'submitted'
		and e.card_version = v_m.card_version
		and not exists (
			select 1 from public.tbl_match_events r
			where r.match_id = p_match_id and r.kind = 'rejected'
				and r.card_version = v_m.card_version
				and (r.created_at, r.id) > (e.created_at, e.id)
		);
	return v_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.tdc_card_state(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
	v_team      boolean;
	v_home      public.tbl_match_events%rowtype;
	v_away      public.tbl_match_events%rowtype;
	v_sides     jsonb;
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

		-- How long a player has to say it is wrong. Independent of the mode:
		-- the mode decides when it publishes, this decides how long the
		-- objection window stays open afterwards.
		-- Restored 23 Oct: written in 20261020140000, dropped by 20261021160000.
		v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 0);
		v_until := case when v_hours > 0 then v_published + make_interval(hours => v_hours) end;
		v_base := v_base || jsonb_build_object(
			'object_until', v_until,
			'can_object', v_until is not null and now() < v_until and v_objection.id is null);
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

	-- ── A team match is signed by both captains ──
	--
	-- One shared record plus a version: the card is agreed when both sides
	-- have submitted **and** both signatures were given at the card as it
	-- stands. Nothing is ever cleared or cascaded — a signature is not
	-- invalidated when the card changes, it just stops matching, which is why
	-- each side's own version comes back here for the page to compare.
	v_team := v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team';

	if v_team then
		select * into v_home from public.tbl_match_events
		where match_id = p_match_id and kind = 'submitted' and side = 'home'
		order by created_at desc, id desc limit 1;

		select * into v_away from public.tbl_match_events
		where match_id = p_match_id and kind = 'submitted' and side = 'away'
		order by created_at desc, id desc limit 1;

		v_sides := jsonb_build_object(
			'home', case when v_home.id is not null then jsonb_build_object(
				'by', v_home.player_id, 'at', v_home.created_at,
				'card_version', v_home.card_version,
				'current', v_home.card_version = v_match.card_version) end,
			'away', case when v_away.id is not null then jsonb_build_object(
				'by', v_away.player_id, 'at', v_away.created_at,
				'card_version', v_away.card_version,
				'current', v_away.card_version = v_match.card_version) end);

		v_base := v_base || jsonb_build_object('team', true, 'sides', v_sides);

		-- A dispute on the card as it stands still reopens it, exactly as in a
		-- singles match, and outranks an unmatched signature.
		select * into v_last from public.tbl_match_events
		where match_id = p_match_id and kind = 'disputed'
			and card_version = v_match.card_version
		order by created_at desc, id desc limit 1;

		if v_last.id is not null and v_published is null then
			return v_base || jsonb_build_object('state', 'disputed',
				'by', v_last.player_id, 'at', v_last.created_at, 'note', v_last.note);
		end if;

		if v_home.card_version = v_match.card_version
			and v_away.card_version = v_match.card_version then
			return v_base || jsonb_build_object('state', 'agreed',
				'at', greatest(v_home.created_at, v_away.created_at));
		end if;

		-- Somebody has signed, but not both at this version. Silence does not
		-- settle a team card: two signatures are wanted and a missing one is
		-- not the same as an unanswered one. The league director approving is
		-- the way out when a captain will not sign.
		if v_home.id is not null or v_away.id is not null then
			return v_base || jsonb_build_object('state', 'awaiting',
				'waiting_on', case
					when v_home.card_version is distinct from v_match.card_version
						and v_away.card_version is distinct from v_match.card_version then 'both'
					when v_home.card_version is distinct from v_match.card_version then 'home'
					else 'away'
				end);
		end if;

		return v_base || jsonb_build_object('state', 'in_progress');
	end if;

	-- Published, but nobody has approved it: the modes where submitting is
	-- publishing. Settled, locked, and open to objection — never 'awaiting',
	-- because there is nothing for the other player to agree to.
	-- Restored 23 Oct: written in 20261020140000, moved by 20261021160000 into
	-- the disputed branch only, which brought back "Looks right" on a card the
	-- database then refused to let anyone agree to. It can sit here again now
	-- that a send-back unpublishes (tdc_published_at, above).
	if v_published is not null then
		return v_base || jsonb_build_object('state', 'agreed', 'by', null, 'at', v_published);
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
$function$
;
