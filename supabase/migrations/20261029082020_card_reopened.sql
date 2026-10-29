-- A signed night that is changed afterwards reads "Re-opened" (UV, 29 Oct).
--
-- An edit after both captains signed voids both signatures (20261029075957).
-- The match stays complete: nothing un-marks it, and that is kept on purpose,
-- because complete is what locks a night on the fixtures page and refuses
-- taking its match off (20261025072000). UV asked what such a night should be
-- called, and chose "Re-opened" over "Playing" ("a bit vague").
--
--   private.tdc_card_state  a team card waiting on a signature also says
--                           whether it is re-opened: both sides once signed
--                           the same card, by version or by content.
--   tdc_league_fixtures     reports match_status 'reopened' for a complete
--                           match whose card is re-opened. The page shows it
--                           as Re-opened and keeps the night locked.
--
-- Signed again by both, or the change undone, and it reads complete again:
-- nothing is stored, it is worked out each time.

-- ── The card's state ──
-- Patched from 20261029075957 (taken from a freshly reset database).
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
				end,
				-- Re-opened (UV, 29 Oct): both sides once signed the same card,
				-- by version or by content, and it has been changed since.
				'reopened', exists (
					select 1 from public.tbl_match_events h
					join public.tbl_match_events a on a.match_id = h.match_id
					where h.match_id = p_match_id
						and h.kind = 'submitted' and h.side = 'home'
						and a.kind = 'submitted' and a.side = 'away'
						and (h.card_version = a.card_version or h.card_fingerprint = a.card_fingerprint)));
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

-- ── The fixtures ──
-- Patched from 20261024191110 (taken from a freshly reset database).
CREATE OR REPLACE FUNCTION public.tdc_league_fixtures(p_league_season_id uuid)
 RETURNS TABLE(fixture_id uuid, round integer, "position" integer, scheduled_at timestamp with time zone, home_team_id uuid, home_name text, away_team_id uuid, away_name text, is_bye boolean, match_id uuid, match_status text, home_frames integer, away_frames integer, notes text, table_numbers integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select f.id, f.round, f."position", f.scheduled_at,
		f.home_team_id, h.name,
		f.away_team_id, a.name,
		f.away_team_id is null,
		f.match_id,
		-- A signed night changed since (UV, 29 Oct) reads 'reopened'. The
		-- match itself stays complete, so its fixture stays locked as a signed
		-- night is (20261025072000) until it is signed again or the change is
		-- undone. Only a complete match is asked, so the rest cost nothing.
		case when m.status = 'complete' then
			case when coalesce((private.tdc_card_state(m.id)->>'reopened')::boolean, false)
				then 'reopened' else 'complete' end
			else m.status end,
		s.home_score, s.away_score,
		f.notes,
		f.table_numbers
	from public.tbl_league_fixtures f
	join public.tbl_teams h on h.id = f.home_team_id
	left join public.tbl_teams a on a.id = f.away_team_id
	left join public.tbl_matches m on m.id = f.match_id
	left join lateral private.tdc_match_score(f.match_id) s on f.match_id is not null
	where (select auth.uid()) is not null
		and f.league_season_id = p_league_season_id
	order by f.round, f."position";
$function$;
