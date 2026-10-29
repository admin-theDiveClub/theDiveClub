-- A signature on a team card follows the card's content, not only its version.
--
-- UV, 29 Oct (docs/DECISIONS.md): an edit after signing voids both captains'
-- signatures, and the card cannot be submitted until both sign again. That
-- part was already true and stays as it is: private.tdc_card_state counts a
-- team card as agreed only when both signatures were given at the card's
-- current version, every frame write moves the version on, and the lock, the
-- complete status and the card page all read that one answer. It is enforced
-- here, in the database, not by the page.
--
-- What is new is UV's second rule: **if the edit is undone, the signatures
-- stand again**, because the card is exactly what both sides signed. A
-- version never goes back, so a signature now also carries a fingerprint of
-- the card it signed, and it stands if either the version or the fingerprint
-- matches the card as it is now.
--
--   Both captains sign at 13 : 12 (version 40). The LD changes frame 7's
--   winner (41): neither signature stands. The LD changes it back (42): the
--   card's fingerprint is the one both signed, so both stand and the card is
--   agreed again, with nobody signing twice.
--
-- ── What the fingerprint covers ──
--
-- Everything the card says about each frame: its number, status, winner,
-- how it was won, the lag (break side), the break outcome, an abandon reason,
-- and who sat on each side. Not times, nor the break player: the team card
-- shows neither, and a change nobody can see should not void a signature
-- nobody can re-check. The walkovers that signing itself writes
-- (tdc_settle_empty_seats) are in, because the fingerprint is taken after.
--
-- ── Never across a dispute ──
--
-- A fingerprint match counts only for a signature given after the latest
-- dispute on the match. Otherwise undoing a correction back to a card
-- somebody objected to would agree it without anybody looking. The version
-- match is untouched: a dispute on the card as it stands still outranks it,
-- as before.
--
-- Signatures from before this migration have no fingerprint and behave as
-- they always did. Singles never writes one: there the submitter is the side
-- and the singles flow is unchanged.

alter table public.tbl_match_events
	add column card_fingerprint text;

comment on column public.tbl_match_events.card_fingerprint is
	'Team play, on a signature: private.tdc_card_fingerprint of the card as signed. A signature stands again once the card is back to it (29 Oct). Null elsewhere.';

-- md5 of every frame, in order. format() writes a null as an empty string, so
-- every frame is the same number of fields and two cards cannot collide by a
-- field shifting into its neighbour's place.
create function private.tdc_card_fingerprint(p_match_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
	select md5(coalesce(string_agg(format('%s|%s|%s|%s|%s|%s|%s|%s',
		f.frame_no, f.status, f.winner_side, f.result_event, f.break_side, f.break_outcome, f.abandon_reason,
		(select string_agg(p.side || ':' || p.player_id::text, ',' order by p.side, p.player_id)
			from public.tbl_frame_participants p where p.frame_id = f.id)
	), E'\n' order by f.frame_no), ''))
	from public.tbl_frames f
	where f.match_id = p_match_id;
$$;
revoke execute on function private.tdc_card_fingerprint(uuid) from public, anon, authenticated;

-- ── The card's state: a signature stands by version or by fingerprint ──
-- Patched from 20261023185945 (taken from a freshly reset database); only the
-- team branch's "does this signature stand" changes.
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
	v_now       text;
	v_disputed  timestamptz;
	v_home_ok   boolean;
	v_away_ok   boolean;
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

		-- A signature stands while the card is at the version it was given at,
		-- or once it is again exactly the card that was signed: an edit undone
		-- brings the signatures back (UV, 29 Oct). Never across a dispute raised
		-- since the signature, so undoing back to a card somebody objected to
		-- does not agree it.
		v_now := private.tdc_card_fingerprint(p_match_id);
		select max(created_at) into v_disputed from public.tbl_match_events
		where match_id = p_match_id and kind = 'disputed';
		v_home_ok := v_home.id is not null and (v_home.card_version = v_match.card_version
			or (v_home.card_fingerprint = v_now and v_home.created_at > coalesce(v_disputed, '-infinity')));
		v_away_ok := v_away.id is not null and (v_away.card_version = v_match.card_version
			or (v_away.card_fingerprint = v_now and v_away.created_at > coalesce(v_disputed, '-infinity')));

		v_sides := jsonb_build_object(
			'home', case when v_home.id is not null then jsonb_build_object(
				'by', v_home.player_id, 'at', v_home.created_at,
				'card_version', v_home.card_version,
				'current', v_home_ok) end,
			'away', case when v_away.id is not null then jsonb_build_object(
				'by', v_away.player_id, 'at', v_away.created_at,
				'card_version', v_away.card_version,
				'current', v_away_ok) end);

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

		if v_home_ok and v_away_ok then
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
					when not v_home_ok and not v_away_ok then 'both'
					when not v_home_ok then 'home'
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
$function$;

-- ── Signing: the fingerprint goes with the signature ──
-- Patched from 20261023221049. Also refuses a second signature while this
-- side's first still stands by fingerprint, as it already did by version.
CREATE OR REPLACE FUNCTION public.tdc_submit_card(p_match_id uuid, p_side text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me     uuid;
	v_match  public.tbl_matches%rowtype;
	v_state  text;
	v_frames integer;
	v_team   boolean;
	v_side   text;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'Only the players in this match, venue staff, or the people running its competition can submit its scorecard.';
	end if;

	-- In a team match a captain signs for their own side, and signing is
	-- captain-only: a player may record their own frame but not put the
	-- team's name to the night. The league director may sign for either, and
	-- has to say which.
	v_team := v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team';
	if v_team then
		v_side := coalesce(p_side, private.tdc_league_match_side(p_match_id));
		if v_side is null then
			raise exception 'Only a captain signs a team card. Say which side if you are running the league.';
		end if;
		if v_side not in ('home', 'away') then
			raise exception 'TDC (Error): side must be home or away, not "%".', v_side;
		end if;
		if not private.tdc_can_set_lineup(p_match_id, v_side) then
			raise exception 'Only that team''s captain, or the league director, can sign its card.';
		end if;
	elsif p_side is not null then
		raise exception 'TDC (Error): only a team match has sides to submit for.';
	end if;

	-- The event records who pressed it, so a coordinator submitting on behalf
	-- of two walk-ins is attributed to the coordinator rather than to nobody.
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	select count(*) into v_frames from public.tbl_frames where match_id = p_match_id;
	if v_frames = 0 then
		raise exception 'There is nothing to submit yet — no frames have been played.';
	end if;

	v_state := private.tdc_card_state(p_match_id)->>'state';
	-- 'awaiting' on a team card means the other side has signed and this one
	-- has not, which is exactly when this side needs to sign. Only a signature
	-- already standing against this very card is refused.
	if v_state = 'awaiting' and not v_team then
		raise exception 'This scorecard has already been submitted and is waiting on the other player.';
	end if;
	if v_team and exists (
		select 1 from public.tbl_match_events
		where match_id = p_match_id and kind = 'submitted' and side = v_side
			and card_version = v_match.card_version
	) or coalesce((private.tdc_card_state(p_match_id)->'sides'->v_side->>'current')::boolean, false) then
		raise exception 'You have already signed this card as it stands.';
	end if;
	if v_state = 'agreed' then
		raise exception 'This scorecard has already been agreed.';
	end if;
	if v_state = 'approved' then
		raise exception 'This result has already been published.';
	end if;

	-- Signing says this is the final card, so a seat still empty is now a
	-- walkover. Before the signature, so the version signed includes them.
	if v_team and private.tdc_settle_empty_seats(p_match_id) > 0 then
		select card_version into v_match.card_version from public.tbl_matches where id = p_match_id;
	end if;

	-- The card's fingerprint with the signature, so an edit undone later
	-- brings it back (private.tdc_card_state). Singles leaves it unused.
	insert into public.tbl_match_events (match_id, player_id, kind, card_version, side, card_fingerprint)
	values (p_match_id, v_me, 'submitted', v_match.card_version, v_side,
		case when v_team then private.tdc_card_fingerprint(p_match_id) end);

	-- Nobody has to sign this one. Submitting is the end of it. Never on a
	-- team card, which wants both captains however the approval mode is set.
	if not v_team and coalesce(v_match.rules->>'approval_mode', 'none') = 'none' then
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'agreed', v_match.card_version,
			'Settled on submission: this match was set to need no approval.');
	end if;

	-- A team match is over when both captains have signed, not when the first
	-- one does. Marking it complete on one signature would close a night the
	-- other side has not seen.
	if not v_team or private.tdc_card_state(p_match_id)->>'state' = 'agreed' then
		update public.tbl_matches
		set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
			ended_at = coalesce(ended_at, now())
		where id = p_match_id;
	end if;

	return private.tdc_card_state(p_match_id);
end;
$function$;
