-- Publishing.
--
-- "Recorded is not the same as published" from claude/approval-and-corrections.md,
-- built to the flow UV described on 20 Oct. Until now approval_mode had four
-- values and two of them did nothing, and the bracket advanced on
-- tbl_matches.status — which for a dispute window is set at submission, up to
-- 48 hours before the result is actually settled.
--
-- ─── The two axes ───
--
-- In a competition these are now independent, which is what makes UV's three
-- cases expressible without inventing anything:
--
--   approval_mode        decides WHEN it publishes
--     none                 on submission
--     dispute_window       on submission
--     coordinator_approval on the coordinator's approval
--     both                 on the coordinator's approval
--
--   dispute_window_hours decides HOW LONG a player may object afterwards
--
-- Publishing locks the card. A dispute never reopens it and never un-publishes
-- it: the objection goes to the coordinator, who either lets it stand or
-- changes the score. That is the whole difference from social play, where a
-- dispute does reopen the card because there is nobody else to ask.
--
-- A social match is untouched by all of this. It has nothing to publish to,
-- so dispute_window keeps the meaning it has today.

-- ─────────────────────────────────────────────────────────────────
-- Two more things that can happen to a card
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_match_events
	drop constraint tbl_match_events_kind_check;

alter table public.tbl_match_events
	add constraint tbl_match_events_kind_check
	check (kind in ('submitted', 'agreed', 'disputed', 'reopened', 'approved', 'rejected'));

-- A rejection is a coordinator telling the players it is wrong, which is the
-- same speech act as a dispute. A dispute has to carry a reason; consistency
-- says this does too. (Open question 2 in the design note, settled 20 Oct.)
alter table public.tbl_match_events
	add constraint tbl_match_events_rejection_has_a_reason
	check (kind <> 'rejected' or (note is not null and char_length(trim(note)) >= 3));


-- ─────────────────────────────────────────────────────────────────
-- Is this match part of a competition?
-- ─────────────────────────────────────────────────────────────────

-- A match belongs to a competition through its fixture, never through a
-- column: a match is first class and belongs to nothing by default.
create function private.tdc_match_competition(p_match_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
	select x.tournament_id
	from public.tbl_tournament_fixtures x
	where x.match_id = p_match_id
	limit 1;
$$;

revoke execute on function private.tdc_match_competition(uuid) from public, anon;
grant execute on function private.tdc_match_competition(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- When was it published?
--
-- Null means not published. The timestamp is the moment the result started
-- counting, and it is also when a player's objection window opens.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_published_at(p_match_id uuid)
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
		select max(e.created_at) into v_at
		from public.tbl_match_events e
		where e.match_id = p_match_id and e.kind = 'approved'
			and e.card_version = v_m.card_version;
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

revoke execute on function private.tdc_published_at(uuid) from public, anon;
grant execute on function private.tdc_published_at(uuid) to authenticated;


create function private.tdc_is_published(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.tdc_published_at(p_match_id) is not null; $$;

revoke execute on function private.tdc_is_published(uuid) from public, anon;
grant execute on function private.tdc_is_published(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Where a card stands
--
-- Replaces the version from 20261015210000. The existing states and their
-- meanings are unchanged; 'approved' is added as a terminal state, 'rejected'
-- reopens the card as 'reopened' does, and the jsonb now carries whether the
-- result is published and whether somebody has objected since.
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
-- Locking
--
-- Today a card locks when both players agree. Now it also locks the moment it
-- is published, which in a competition is the point: a published result has
-- already moved the bracket, and a player editing frames underneath it would
-- change a fact other people are relying on.
--
-- A coordinator is not stopped. They are the one person who is supposed to be
-- able to correct a locked card, and their edits are what the override and the
-- frame-level correction powers are for.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_card_is_locked(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select (private.tdc_card_state(p_match_id)->>'state') in ('agreed', 'approved')
		or private.tdc_is_published(p_match_id);
$$;

revoke execute on function private.tdc_card_is_locked(uuid) from public, anon;
grant execute on function private.tdc_card_is_locked(uuid) to authenticated;


create or replace function private.tdc_frames_locked_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
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

	if private.tdc_is_published(v_match) and v_comp is not null then
		raise exception 'This result has been published. Only the people running the competition can change it now.';
	end if;

	raise exception 'Both players have agreed this scorecard. Reopen it before changing anything.';
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- Submitting, now that a coordinator may do it too
--
-- Replaces the version from 20261015210000. The only change is who is allowed:
-- anyone private.tdc_can_edit_match permits, which since 20261020100000 means
-- the players, venue staff, and the competition's own officials.
--
-- Without this a tournament director cannot finish a match between two people
-- who do not use the app — he can record every frame and then has no way to
-- say the card is done. That is principle 8 broken, and it was found by audit
-- on 20 Oct rather than by anything going wrong on a night.
-- ─────────────────────────────────────────────────────────────────

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

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'Only the players in this match, venue staff, or the people running its competition can submit its scorecard.';
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
	if v_state = 'awaiting' then
		raise exception 'This scorecard has already been submitted and is waiting on the other player.';
	end if;
	if v_state = 'agreed' then
		raise exception 'This scorecard has already been agreed.';
	end if;
	if v_state = 'approved' then
		raise exception 'This result has already been published.';
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


-- ─────────────────────────────────────────────────────────────────
-- Answering a card
--
-- Replaces the version from 20261015160000. Social play is unchanged. What is
-- new is the competition case: once a result is published a player may still
-- object, within the window the coordinator set, but the objection does not
-- reopen the card and does not un-publish the result. It goes to the
-- coordinator.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_answer_card(p_match_id uuid, p_agree boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;


-- ─────────────────────────────────────────────────────────────────
-- Approving and sending back
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_approve_card(p_match_id uuid)
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

	if coalesce(v_match.rules->>'approval_mode', 'none') not in ('coordinator_approval', 'both') then
		raise exception 'This match publishes as soon as its card is submitted, so there is nothing to approve.';
	end if;

	select count(*) into v_frames from public.tbl_frames where match_id = p_match_id;
	if v_frames = 0 and not exists (
		select 1 from public.tbl_match_result_override o where o.match_id = p_match_id) then
		raise exception 'There is no result to publish yet: no frames, and no score set by hand.';
	end if;

	if private.tdc_is_published(p_match_id) then
		raise exception 'This result has already been published.';
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

revoke execute on function public.tdc_approve_card(uuid) from public, anon;
grant execute on function public.tdc_approve_card(uuid) to authenticated;


-- Sending a card back to the players. The same speech act as a dispute, so it
-- carries a reason for the same reason.
create function public.tdc_reject_card(p_match_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_comp  uuid;
	v_match public.tbl_matches%rowtype;
	v_me    uuid;
begin
	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_comp := private.tdc_match_competition(p_match_id);
	if v_comp is null or not private.tdc_can_run_tournament(v_comp) then
		raise exception 'Only the people running this competition can send a card back.';
	end if;

	if p_note is null or char_length(trim(p_note)) < 3 then
		raise exception 'Please say briefly what is wrong with the scorecard.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());

	insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
	values (p_match_id, v_me, 'rejected', v_match.card_version, trim(p_note));

	update public.tbl_matches
	set status = 'in_progress', ended_at = null
	where id = p_match_id;

	return private.tdc_card_state(p_match_id);
end;
$$;

revoke execute on function public.tdc_reject_card(uuid, text) from public, anon;
grant execute on function public.tdc_reject_card(uuid, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The bracket advances on published, not on complete
--
-- Replaces the version from 20261020100000. This is the whole point of the
-- migration: a result that has not been published has not happened as far as
-- the draw is concerned.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_fixture_outcome(p_fixture_id uuid)
returns table (winner_entrant_id uuid, loser_entrant_id uuid, decided boolean, why text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_f     public.tbl_tournament_fixtures%rowtype;
	v_score record;
begin
	winner_entrant_id := null;
	loser_entrant_id  := null;
	decided := false;
	why := null;

	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		return next;
		return;
	end if;

	-- Awarded rather than played: a bye, a walkover, a withdrawal, a decision.
	if v_f.advanced_entrant_id is not null then
		winner_entrant_id := v_f.advanced_entrant_id;
		loser_entrant_id := case
			when v_f.advanced_entrant_id = v_f.home_entrant_id then v_f.away_entrant_id
			else v_f.home_entrant_id
		end;
		decided := true;
		why := v_f.advance_reason;
		return next;
		return;
	end if;

	if v_f.match_id is null then
		why := 'not played';
		return next;
		return;
	end if;

	if not private.tdc_is_published(v_f.match_id) then
		why := 'not published';
		return next;
		return;
	end if;

	select * into v_score from private.tdc_match_score(v_f.match_id);

	if v_score.home_score = v_score.away_score then
		why := 'level';
		return next;
		return;
	end if;

	if v_score.home_score > v_score.away_score then
		winner_entrant_id := v_f.home_entrant_id;
		loser_entrant_id  := v_f.away_entrant_id;
	else
		winner_entrant_id := v_f.away_entrant_id;
		loser_entrant_id  := v_f.home_entrant_id;
	end if;
	decided := winner_entrant_id is not null;
	why := case
		when not decided then 'published, but the slot is empty'
		when v_score.overridden then 'set by hand'
		else 'published'
	end;
	return next;
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- And the draw says whether a result counts yet
--
-- Replaces the version from 20261020100000. Three more columns, all of which
-- the bracket page needs to stop being misleading: a submitted-but-unpublished
-- result looks identical to a published one otherwise, and the TD is left
-- wondering why nobody moved up.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_tournament_draw(uuid);

create function public.tdc_tournament_draw(p_tournament_id uuid)
returns table (
	fixture_id    uuid,
	bracket       text,
	round         integer,
	"position"    integer,
	home_entrant_id uuid,
	home_name     text,
	home_seed     integer,
	home_source   text,
	away_entrant_id uuid,
	away_name     text,
	away_seed     integer,
	away_source   text,
	match_id      uuid,
	match_status  text,
	home_frames   integer,
	away_frames   integer,
	overridden    boolean,
	override_stale boolean,
	override_reason text,
	card_state    text,
	-- Does this result count yet?
	published     boolean,
	-- Does it need somebody to publish it, or did submitting do that?
	needs_approval boolean,
	-- Has a player objected since it was published?
	objection     boolean,
	winner_entrant_id uuid,
	advanced_entrant_id uuid,
	advance_reason text,
	home_feeder_round    integer,
	home_feeder_position integer,
	away_feeder_round    integer,
	away_feeder_position integer
)
language sql
stable
security definer
set search_path = ''
as $$
	select f.id, f.bracket, f.round, f.position,
		f.home_entrant_id, hp.display_name, he.seed, f.home_source_type,
		f.away_entrant_id, ap.display_name, ae.seed, f.away_source_type,
		f.match_id, m.status,
		s.home_score, s.away_score,
		coalesce(s.overridden, false), coalesce(s.stale, false), o.reason,
		cs->>'state',
		coalesce((cs->>'published')::boolean, false),
		coalesce(m.rules->>'approval_mode', 'none') in ('coordinator_approval', 'both'),
		cs ? 'objection',
		(select x.winner_entrant_id from private.tdc_fixture_outcome(f.id) x),
		f.advanced_entrant_id, f.advance_reason,
		hf.round, hf.position,
		af.round, af.position
	from public.tbl_tournament_fixtures f
	left join public.tbl_matches m              on m.id = f.match_id
	left join lateral private.tdc_match_score(f.match_id) s on f.match_id is not null
	left join lateral (select private.tdc_card_state(f.match_id) as cs) c on f.match_id is not null
	left join public.tbl_match_result_override o on o.match_id = f.match_id
	left join public.tbl_tournament_entrants he on he.id = f.home_entrant_id
	left join public.tbl_players hp             on hp.id = he.player_id
	left join public.tbl_tournament_entrants ae on ae.id = f.away_entrant_id
	left join public.tbl_players ap             on ap.id = ae.player_id
	left join public.tbl_tournament_fixtures hf on hf.id = f.home_source_ref
		and f.home_source_type in ('winner_of', 'loser_of')
	left join public.tbl_tournament_fixtures af on af.id = f.away_source_ref
		and f.away_source_type in ('winner_of', 'loser_of')
	where f.tournament_id = p_tournament_id
	order by f.bracket, f.round, f.position;
$$;

revoke execute on function public.tdc_tournament_draw(uuid) from public, anon;
grant execute on function public.tdc_tournament_draw(uuid) to authenticated;
