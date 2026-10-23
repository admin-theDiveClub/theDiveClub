-- Leagues step 5: two signatures on one card.
--
-- A team night is signed by both captains. The design's whole rule, settled
-- on 13 October:
--
--   The card is agreed when both sides have a submission **and** both were
--   given at the card as it stands. No clearing, no cascade. A signature is
--   never invalidated — it just stops matching.
--
-- So when somebody fixes frame 3 after the home captain signed, the home
-- signature does not disappear; it simply refers to a card that no longer
-- exists. The page can then say exactly what changed, because each side's
-- signed version comes back in the card state and tdc_frame_history already
-- answers "what happened since version N".
--
-- ── What this reuses rather than building ──
--
-- The design sketched a tbl_match_submission table. There is no need: a
-- submission is already an append-only event in tbl_match_events, with the
-- card_version it was given at, which is the same shape and the one the
-- founding principles ask for. It was missing only one thing — which side
-- signed — because in a singles match the submitter is the side.
--
-- ── What is deliberately not here ──
--
-- **Silence does not settle a team card.** In a singles match an unanswered
-- submission is agreed once the dispute window passes, which is right when one
-- person has seen the card and said nothing. A team card wants two signatures,
-- and a missing signature is not the same as an unanswered one. When a captain
-- will not sign, the league director approves — which is already terminal and
-- already version-matched. Worth revisiting with UV if a league in practice
-- wants a timer.
--
-- **Partial submission stays allowed**, as the design says in as many words:
-- "Submit" means *this is the final card*, not *all slots are filled*. A card
-- with a pending frame nobody played can be signed, and that frame counts for
-- nobody. This closes the question docs/STATUS.md raised yesterday — it was
-- not a gap, it was the design.

-- Which side signed. Null for every event in a singles match, and for an
-- approval or a rejection, which are the whole card rather than one side of it.
alter table public.tbl_match_events
	add column side text check (side in ('home', 'away'));

comment on column public.tbl_match_events.side is
	'Team play: which side this event is for. Null in a singles match, and on approvals and rejections, which are never one-sided.';

-- One signature per side per version. A captain pressing submit twice on the
-- same card writes one row, and the function says so rather than relying on
-- this — but a card is a record and two identical signatures on it are noise.
create unique index tbl_match_events_one_signature_per_side
	on public.tbl_match_events (match_id, side, card_version)
	where kind = 'submitted' and side is not null;

-- ── A permission check that could answer neither yes nor no ──
--
-- Found on 23 Oct while writing the tests for the rules below.
-- private.tdc_can_set_lineup, shipped yesterday in 20261022230000, was:
--
--     select private.tdc_league_match_side(p_match_id) = p_side
--         or coalesce(private.tdc_can_run_league(...), false);
--
-- For anybody who captains neither team, tdc_league_match_side returns null,
-- so the comparison is null and `null or false` is **null** — not false.
-- Every caller asks `if not private.tdc_can_set_lineup(...) then raise`, and
-- `not null` is null, which is not true, so the raise never fired.
--
-- The effect: a signed-in person outside the league entirely could set or
-- clear another team's lineup slots, and lock their lineup, by naming the
-- side explicitly. They could not read the opponent's order — that is
-- tdc_match_lineup, which is sound — and only a team match that had not yet
-- locked was exposed. Production had one league and one match when this was
-- found, so nothing is known to have been touched.
--
-- The lesson is the shape, not the typo: a permission helper must return true
-- or false and never null, because every caller negates it.
create or replace function private.tdc_can_set_lineup(p_match_id uuid, p_side text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(private.tdc_league_match_side(p_match_id) = p_side, false)
		or coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false);
$$;

-- ── The card state ──
-- Patched from the live definition: the team branch is inserted ahead of the
-- singles one, which is untouched below it.

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

-- ── Submitting ──
-- Patched from the live definition. A side, the captain-only rule, and the
-- three guards that had to learn what "already submitted" means when two
-- signatures are wanted.

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
	) then
		raise exception 'You have already signed this card as it stands.';
	end if;
	if v_state = 'agreed' then
		raise exception 'This scorecard has already been agreed.';
	end if;
	if v_state = 'approved' then
		raise exception 'This result has already been published.';
	end if;

	insert into public.tbl_match_events (match_id, player_id, kind, card_version, side)
	values (p_match_id, v_me, 'submitted', v_match.card_version, v_side);

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

revoke execute on function public.tdc_submit_card(uuid, text) from public, anon;
grant execute on function public.tdc_submit_card(uuid, text) to authenticated;

-- The old one-argument form would still resolve for anything that calls it
-- without a side, which is every existing page. Dropped so that there is one
-- function and no chance of two drifting.
drop function if exists public.tdc_submit_card(uuid);

-- ── Answering ──
-- Patched from the live definition: agreeing has no meaning on a team card.

CREATE OR REPLACE FUNCTION public.tdc_answer_card(p_match_id uuid, p_agree boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me        uuid;
	v_match     public.tbl_matches%rowtype;
	v_state     jsonb;
	v_published timestamptz;
	v_hours     integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	-- Agreeing to somebody else's submission is the singles shape. On a team
	-- card each captain signs their own side, so "I agree" has no meaning and
	-- would quietly settle a night the other side never signed. Disputing is
	-- unchanged: it still reopens the card.
	if coalesce(p_agree, false) and exists (
		select 1 from public.tbl_matches
		where id = p_match_id and home_side_kind = 'team' and away_side_kind = 'team'
	) then
		raise exception 'On a team card each captain signs their own side. Submit yours instead.';
	end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can answer its scorecard.';
	end if;

	v_state     := private.tdc_card_state(p_match_id);
	v_published := private.tdc_published_at(p_match_id);

	-- ─── A published result: objecting to the coordinator ───
	if v_published is not null then
		if p_agree then
			raise exception 'This result has already been published, so there is nothing left to agree to.';
		end if;

		v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 0);
		if v_hours <= 0 then
			raise exception 'This result is published and this match has no dispute window. Speak to whoever is running it.';
		end if;
		if now() >= v_published + make_interval(hours => v_hours) then
			raise exception 'The time to dispute this result has passed. Speak to whoever is running it.';
		end if;

		if p_note is null or char_length(trim(p_note)) < 3 then
			raise exception 'Please say briefly what is wrong with the scorecard.';
		end if;

		if (v_state->'objection'->>'by')::uuid = v_me then
			raise exception 'You have already disputed this result. It is with whoever is running the competition.';
		end if;

		-- Recorded, and nothing else moves: the card stays locked and the
		-- result stays published. The coordinator decides what happens next.
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'disputed', v_match.card_version, trim(p_note));

		return private.tdc_card_state(p_match_id);
	end if;

	-- ─── Social play, exactly as before ───
	if v_state->>'state' <> 'awaiting' then
		raise exception 'There is nothing waiting to be answered on this scorecard.';
	end if;

	if (v_state->>'submitted_by')::uuid = v_me then
		raise exception 'You submitted this scorecard. The other player answers it.';
	end if;

	if p_agree then
		insert into public.tbl_match_events (match_id, player_id, kind, card_version)
		values (p_match_id, v_me, 'agreed', v_match.card_version);
	else
		if p_note is null or char_length(trim(p_note)) < 3 then
			raise exception 'Please say briefly what is wrong with the scorecard.';
		end if;
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'disputed', v_match.card_version, trim(p_note));

		-- A dispute means "this is wrong, fix it", so the card opens again.
		update public.tbl_matches
		set status = 'in_progress', ended_at = null
		where id = p_match_id;
	end if;

	return private.tdc_card_state(p_match_id);
end;
$function$;

-- ── Recording a frame ──
-- Patched from the live definition: on a team night a player may enter the
-- result of their own frame and nobody else's, which is the design's
-- permission table. A captain may edit any frame of their match, and a scorer
-- or the league director any frame at all. Singles is untouched — there, both
-- players are in every frame there is.

CREATE OR REPLACE FUNCTION public.tdc_record_frame(p_match_id uuid, p_frame_no integer, p_frame jsonb DEFAULT '{}'::jsonb, p_card_version integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_allowed  text[] := array[
		'referee_player_id', 'break_side', 'break_player_id', 'break_outcome',
		'winner_side', 'result_event', 'status', 'abandon_reason',
		'rack_started_at', 'started_at', 'ended_at', 'paused_seconds', 'clicker_log',
		'home_players', 'away_players'
	];
	v_unknown  text[];
	v_match    public.tbl_matches;
	v_frame_id uuid;

	v_derived  text;
	v_given    text;
	v_break    text;
	v_manual   boolean := false;

	v_status   text;
	v_winner   text;
	v_event    text;
	v_outcome  text;
	v_home     uuid[];
	v_away     uuid[];
	v_requires boolean;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	-- Refuse a write aimed at a card that has moved on. Checked here, not in
	-- the browser, because the browser is the thing that is out of date.
	if p_card_version is not null then
		perform private.tdc_check_card_version(p_match_id, p_card_version);
	end if;

	if p_match_id is null or p_frame_no is null or p_frame_no < 1 then
		raise exception 'TDC (Error): a match id and a frame number of 1 or more are required.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its score.';
	end if;

	-- On a team night a player may enter the result of their own frame and
	-- nobody else's. A captain may edit any frame of their match, and a scorer
	-- or the league director any frame at all — which is what
	-- tdc_can_set_lineup already answers for either side.
	if v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team'
		and not (
			private.tdc_can_set_lineup(p_match_id, 'home')
			or private.tdc_can_set_lineup(p_match_id, 'away')
		)
		and exists (select 1 from public.tbl_frames where match_id = p_match_id and frame_no = p_frame_no)
		and not exists (
			select 1
			from public.tbl_frames f
			join public.tbl_frame_participants fp on fp.frame_id = f.id
			join public.tbl_players p on p.id = fp.player_id
			where f.match_id = p_match_id and f.frame_no = p_frame_no
				and p.user_id = (select auth.uid())
		) then
		raise exception 'That is not your frame. A captain or the league director can change anybody''s.';
	end if;

	if v_match.status = 'abandoned' then
		raise exception 'This match was abandoned. Frames can no longer be changed.';
	end if;

	-- A misspelt field would otherwise be dropped without a word.
	select array_agg(k) into v_unknown
	from (select k from jsonb_object_keys(coalesce(p_frame, '{}'::jsonb)) k) s
	where k <> all (v_allowed);
	if v_unknown is not null then
		raise exception 'TDC (Error): unknown frame field(s) %.', array_to_string(v_unknown, ', ');
	end if;

	v_status  := coalesce(p_frame->>'status', 'complete');
	v_winner  := p_frame->>'winner_side';
	v_event   := p_frame->>'result_event';
	v_outcome := p_frame->>'break_outcome';

	-- ── The break side: derived unless corrected ──
	v_derived := private.tdc_break_side_for_frame(p_match_id, p_frame_no);
	v_given   := p_frame->>'break_side';

	if v_given is null then
		v_break  := v_derived;
		v_manual := false;
	else
		v_break  := v_given;
		v_manual := v_given is distinct from v_derived;
	end if;

	-- ── A walkover or forfeit: awarded, never played ──
	if v_event = 'default' then
		if v_given is not null or v_outcome is not null or p_frame ? 'break_player_id' then
			raise exception 'TDC (Error): a frame awarded by default has no break. Remove the break fields.';
		end if;
		if v_winner is null then
			raise exception 'TDC (Error): a frame awarded by default still needs a winning side.';
		end if;
		v_break := null;
		v_manual := false;
	end if;

	-- ── Does a break and finish have to be the breaker's? Per match, by rule ──
	v_requires := coalesce((v_match.rules->>'break_finish_requires_breaker')::boolean, true);
	if v_requires and v_event in ('break_and_finish', 'golden_break') then
		if v_break is null then
			raise exception 'TDC (Error): a break and finish needs to say which side broke.';
		end if;
		if v_winner is distinct from v_break then
			raise exception 'TDC (Error): in this match a break and finish must go to the side that broke.';
		end if;
	end if;

	-- ── Who was at the table ──
	if p_frame ? 'home_players' then
		select array_agg(e::uuid) into v_home
		from jsonb_array_elements_text(p_frame->'home_players') e;
	elsif v_match.home_side_kind = 'player' then
		v_home := array[v_match.home_player_id];
	end if;

	if p_frame ? 'away_players' then
		select array_agg(e::uuid) into v_away
		from jsonb_array_elements_text(p_frame->'away_players') e;
	elsif v_match.away_side_kind = 'player' then
		v_away := array[v_match.away_player_id];
	end if;

	-- A team frame is given its two players when the lineups lock, and a
	-- scorer tapping in a result sends a payload that says nothing about who
	-- played. Fall back to the people already in the frame, so recording the
	-- result neither fails the check below nor empties the frame. Nothing
	-- changes for a singles match, where the two sides are the match's own
	-- players and were filled in above, or for doubles, where the page sends
	-- the list and replacing it wholesale is the point.
	if v_home is null or v_away is null then
		declare
			v_existing uuid;
		begin
			select id into v_existing from public.tbl_frames
			where match_id = p_match_id and frame_no = p_frame_no;

			if v_existing is not null then
				if v_home is null then
					select array_agg(player_id order by coalesce(play_order, 1)) into v_home
					from public.tbl_frame_participants where frame_id = v_existing and side = 'home';
				end if;
				if v_away is null then
					select array_agg(player_id order by coalesce(play_order, 1)) into v_away
					from public.tbl_frame_participants where frame_id = v_existing and side = 'away';
				end if;
			end if;
		end;
	end if;

	if v_status = 'complete' and (coalesce(array_length(v_home, 1), 0) = 0 or coalesce(array_length(v_away, 1), 0) = 0) then
		raise exception 'TDC (Error): a finished frame needs at least one player on each side.';
	end if;

	-- In a singles match the player is the side, so nobody else can appear.
	if v_match.home_side_kind = 'player' and v_home is not null
		and v_home <> array[v_match.home_player_id] then
		raise exception 'TDC (Error): the home side of this match is one player and cannot be changed per frame.';
	end if;
	if v_match.away_side_kind = 'player' and v_away is not null
		and v_away <> array[v_match.away_player_id] then
		raise exception 'TDC (Error): the away side of this match is one player and cannot be changed per frame.';
	end if;
	-- Team sides are not checked against a squad yet: that arrives with the
	-- teams table, and guessing at it now would be wrong either way.

	-- The breaker has to be one of the people on the breaking side.
	if p_frame->>'break_player_id' is not null then
		if v_break is null then
			raise exception 'TDC (Error): a breaking player was given but not which side broke.';
		end if;
		if not ((p_frame->>'break_player_id')::uuid = any (
			case v_break when 'home' then v_home else v_away end
		)) then
			raise exception 'TDC (Error): the breaking player is not on the side that broke.';
		end if;
	end if;

	-- ── Write it ──
	insert into public.tbl_frames (
		match_id, frame_no, referee_player_id,
		break_side, break_side_manual, break_player_id, break_outcome,
		winner_side, result_event, status, abandon_reason,
		rack_started_at, started_at, ended_at, paused_seconds, clicker_log
	)
	values (
		p_match_id, p_frame_no, (p_frame->>'referee_player_id')::uuid,
		v_break, v_manual, (p_frame->>'break_player_id')::uuid, v_outcome,
		v_winner, v_event, v_status, p_frame->>'abandon_reason',
		(p_frame->>'rack_started_at')::timestamptz,
		(p_frame->>'started_at')::timestamptz,
		(p_frame->>'ended_at')::timestamptz,
		coalesce((p_frame->>'paused_seconds')::integer, 0),
		p_frame->'clicker_log'
	)
	on conflict (match_id, frame_no) do update set
		referee_player_id = excluded.referee_player_id,
		break_side        = excluded.break_side,
		break_side_manual = excluded.break_side_manual,
		break_player_id   = excluded.break_player_id,
		break_outcome     = excluded.break_outcome,
		winner_side       = excluded.winner_side,
		result_event      = excluded.result_event,
		status            = excluded.status,
		abandon_reason    = excluded.abandon_reason,
		rack_started_at   = excluded.rack_started_at,
		started_at        = excluded.started_at,
		ended_at          = excluded.ended_at,
		paused_seconds    = excluded.paused_seconds,
		clicker_log       = excluded.clicker_log
	returning id into v_frame_id;

	-- Replaced wholesale, so removing a player from a doubles frame works.
	delete from public.tbl_frame_participants where frame_id = v_frame_id;

	if v_home is not null then
		insert into public.tbl_frame_participants (frame_id, side, player_id, play_order)
		select v_frame_id, 'home', p.id,
			case when array_length(v_home, 1) > 1 then p.ord::smallint end
		from unnest(v_home) with ordinality as p(id, ord);
	end if;

	if v_away is not null then
		insert into public.tbl_frame_participants (frame_id, side, player_id, play_order)
		select v_frame_id, 'away', p.id,
			case when array_length(v_away, 1) > 1 then p.ord::smallint end
		from unnest(v_away) with ordinality as p(id, ord);
	end if;

	-- The card moved. A later frame's breaker may now follow from a different
	-- result, so rules-driven break sides are worked out again.
	perform public.tdc_rederive_break_sides(p_match_id);

	update public.tbl_matches
	set status       = case when status = 'scheduled' then 'in_progress' else status end,
		started_at   = coalesce(started_at, now()),
		card_version = card_version + 1
	where id = p_match_id;

	return v_frame_id;
end;
$function$;

-- ── A team with no captain ──
--
-- Found in UV's own league on 23 Oct: a team with two players and neither of
-- them a captain. Nothing was wrong with the data and nothing refused it, but
-- that team cannot field a side — setting a lineup and signing a card are both
-- captain's work — so the league director would have had to do everything for
-- them without ever being told why.
--
-- Readiness already answers "can this season start"; this is the same
-- question one step further on, so it goes in the same place.
-- Dropped and recreated rather than replaced: it gains a column, and a
-- function's return shape cannot be changed in place.
drop function public.tdc_league_season_readiness(uuid);

create function public.tdc_league_season_readiness(p_league_season_id uuid)
returns table (
	ready               boolean,
	active_players      integer,
	confirmed           integer,
	waiting             integer,
	unplaced            integer,
	waiting_names       text[],
	teams_no_captain    text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not (
		private.tdc_can_run_league(p_league_season_id)
		or exists (
			select 1
			from public.tbl_league_season_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.league_season_id = p_league_season_id
				and e.is_captain and e.status = 'active'
				and p.user_id = (select auth.uid())
		)
	) then
		return;
	end if;

	return query
		select private.tdc_league_ready(p_league_season_id),
			count(*)::integer,
			(count(*) filter (where e.confirmed_at is not null))::integer,
			(count(*) filter (where e.confirmed_at is null))::integer,
			(count(*) filter (where e.team_id is null))::integer,
			coalesce(array_agg(p.display_name order by p.display_name)
				filter (where e.confirmed_at is null), '{}'::text[]),
			-- Not a reason to refuse the fixtures: a director can run a team's
			-- night for them, and some leagues may well work that way. It is
			-- something they should be told, not stopped for.
			coalesce((
				select array_agg(t.name order by lower(t.name))
				from public.tbl_teams t
				where t.league_season_id = p_league_season_id
					and not exists (
						select 1 from public.tbl_league_season_entrants c
						where c.team_id = t.id and c.is_captain and c.status = 'active'
					)
			), '{}'::text[])
		from public.tbl_league_season_entrants e
		join public.tbl_players p on p.id = e.player_id
		where e.league_season_id = p_league_season_id and e.status = 'active';
end;
$$;

revoke execute on function public.tdc_league_season_readiness(uuid) from public, anon;
grant execute on function public.tdc_league_season_readiness(uuid) to authenticated;

-- ── Correcting a card that has been signed ──
--
-- private.tdc_frames_locked_guard lets the coordinator of a match's
-- competition correct a locked card and refuses everybody else. It finds that
-- competition through tbl_tournament_fixtures only — the same blind spot
-- tdc_can_edit_match had yesterday — so a **league** director could not
-- correct their own agreed card. The design is explicit that they can: "The
-- LD can still edit, and those edits are logged, but they do not un-sign
-- anyone or reopen the card."
--
-- The refusal also told two teams that "both players" had agreed.
--
-- Patched from the live definition; the league branch and the wording are the
-- only changes.

CREATE OR REPLACE FUNCTION private.tdc_frames_locked_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
	v_match uuid := coalesce(new.match_id, old.match_id);
	v_comp  uuid;
begin
	if current_setting('tdc.card_unlock', true) = 'on' then
		return coalesce(new, old);
	end if;

	if not private.tdc_card_is_locked(v_match) then
		return coalesce(new, old);
	end if;

	-- The coordinator of the competition this match belongs to may correct a
	-- locked card. Everybody else is refused.
	v_comp := private.tdc_match_competition(v_match);
	if v_comp is not null and private.tdc_can_run_tournament(v_comp) then
		return coalesce(new, old);
	end if;

	-- The same for a league. tdc_match_competition reaches a tournament only,
	-- because a tournament was the only kind of competition a match could
	-- belong to when this was written — so without this a league director
	-- could not correct their own agreed card, and the design is explicit
	-- that they can: "The LD can still edit, and those edits are logged, but
	-- they do not un-sign anyone or reopen the card."
	if coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(v_match)), false) then
		return coalesce(new, old);
	end if;

	if private.tdc_is_published(v_match) and v_comp is not null then
		raise exception 'This result has been published. Only the people running the competition can change it now.';
	end if;

	if (select home_side_kind = 'team' from public.tbl_matches where id = v_match) then
		raise exception 'Both captains have signed this card. Reopen it before changing anything.';
	end if;

	raise exception 'Both players have agreed this scorecard. Reopen it before changing anything.';
end;
$function$;

-- ── What changed since you signed ──
--
-- The design's worked example: the home captain signs, somebody fixes frame 3,
-- and the home captain is shown *"The card changed after you submitted: Frame
-- 3, break outcome Dry → Foul, by Trevor Mokoena 14:22"* — straight out of
-- tbl_frame_edit.
--
-- tdc_frame_history answers "what happened after version N", but a row in
-- tbl_frame_edit carries the version the card was on **before** that edit
-- bumped it. So the edit that took the card from 2 to 3 is recorded as
-- version 2, and asking for everything after 2 would miss the very change the
-- captain needs to see. Rather than change what a shipped function means, this
-- asks the question the page actually has: what has happened since this side
-- put its name to the card.
create function public.tdc_card_changes_since_signing(p_match_id uuid, p_side text)
returns table (
	at          timestamptz,
	frame_no    integer,
	action      text,
	by_name     text,
	editor_role text,
	changed     text
)
language sql
stable
security definer
set search_path = ''
as $$
	select h.at, h.frame_no, h.action, h.by_name, h.editor_role, h.changed
	from public.tdc_frame_history(p_match_id,
		-- One below the signed version, because an edit is stamped with the
		-- version it changed rather than the one it produced.
		(select card_version - 1 from public.tbl_match_events
		 where match_id = p_match_id and kind = 'submitted' and side = p_side
		 order by created_at desc, id desc limit 1)) h
	where (select auth.uid()) is not null
		-- Nothing to show when this side has not signed, or has signed the
		-- card as it stands.
		and exists (
			select 1 from public.tbl_match_events e
			join public.tbl_matches m on m.id = e.match_id
			where e.match_id = p_match_id and e.kind = 'submitted' and e.side = p_side
				and e.card_version <> m.card_version
		);
$$;

revoke execute on function public.tdc_card_changes_since_signing(uuid, text) from public, anon;
grant execute on function public.tdc_card_changes_since_signing(uuid, text) to authenticated;
