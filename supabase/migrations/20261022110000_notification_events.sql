-- Wiring the four events.
--
-- 20261022100000 built the table and the functions to read it, and wrote
-- nothing. This connects them, at the four moments UV picked on 22 Oct:
--
--   entered or confirmed      a TD put you in, or moved you to confirmed
--   your match is ready       a match now exists for a fixture you are in
--   your result was published a coordinator approved the card
--   somebody changed a frame  an official edited your scorecard
--
-- Every one of these is written by patching the function that already owns
-- the moment, rather than by a new trigger watching for it. The exception is
-- the frame edit, which already has a trigger doing exactly this job.
--
-- ─── "Your match is ready" has one hook, not two ───
--
-- UV, 22 Oct: notify for automatic progression as well as manual. That
-- sounded like it needed a scheduled job — nothing advances the bracket
-- until somebody opens it. It does not: automatic and manual both end at
-- tdc_create_fixture_match, which is the single place a tournament match
-- comes into existence. One patch covers both.
--
-- ─── Why the frame notification is not sent on every edit ───
--
-- The trigger fires on every frame write, so notifying each time would send
-- the opponent a message per frame during ordinary play — the opposite of
-- useful. It is scoped to an editor who is **not a player in the match**: a
-- TD, scorer or referee acting on somebody else's card. That is what
-- "somebody else changed your frame" means; a player scoring their own match
-- is already covered by the card flow.
--
-- And it collapses: a TD correcting five frames leaves one notification, not
-- five.

-- ─────────────────────────────────────────────────────────────────
-- One notification, however many times the thing happens
--
-- A separate helper rather than a parameter on tdc_notify, so that the
-- function shipped yesterday keeps its signature and its callers.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_notify_collapsing(
	p_player_id     uuid,
	p_category      text,
	p_kind          text,
	p_title         text,
	p_body          text default null,
	p_link          text default null,
	p_match_id      uuid default null,
	p_tournament_id uuid default null,
	p_actor_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_existing uuid;
begin
	-- An unseen one of the same kind about the same thing is refreshed rather
	-- than joined by a second. Refreshed, not left alone: the newest wording
	-- describes the card as it now stands, and bumping created_at floats it
	-- back to the top where somebody will see it.
	select id into v_existing
	from public.tbl_notifications
	where player_id = p_player_id
		and kind = p_kind
		and seen_at is null
		and match_id is not distinct from p_match_id
		and tournament_id is not distinct from p_tournament_id
	order by created_at desc
	limit 1;

	if v_existing is not null then
		update public.tbl_notifications
		set title = trim(p_title), body = p_body, created_at = clock_timestamp()
		where id = v_existing;
		return v_existing;
	end if;

	return private.tdc_notify(p_player_id, p_category, p_kind, p_title, p_body,
		p_link, p_match_id, p_tournament_id, p_actor_id);
end;
$$;

revoke execute on function private.tdc_notify_collapsing(uuid, text, text, text, text, text, uuid, uuid, uuid) from public, anon;
grant execute on function private.tdc_notify_collapsing(uuid, text, text, text, text, text, uuid, uuid, uuid) to authenticated;


-- Who is calling. Null for a walk-in acting through staff, which is fine:
-- the self-action check simply never matches.
create function private.tdc_me()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select id from public.tbl_players where user_id = (select auth.uid()); $$;

revoke execute on function private.tdc_me() from public, anon;
grant execute on function private.tdc_me() to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Entered by a TD
--
-- Replaces the version from 20261019140000, patched not retyped.
-- Self-entry through tdc_enter_tournament needs nothing: the actor is the
-- recipient, and tdc_notify already declines to tell somebody what they did.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_add_entrant(uuid, uuid, text);

create function public.tdc_add_entrant(
	p_tournament_id uuid,
	p_player_id     uuid,
	p_status        text default 'interested'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t     public.tbl_tournaments%rowtype;
	v_count integer;
	v_id    uuid;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can add entrants.';
	end if;

	if not exists (select 1 from public.tbl_players where id = p_player_id) then
		raise exception 'TDC (Error): no player with id %.', p_player_id;
	end if;

	-- Withdrawn entrants do not take up a place.
	select count(*) into v_count
	from public.tbl_tournament_entrants
	where tournament_id = p_tournament_id and status <> 'withdrawn';

	if v_t.max_entrants is not null and v_count >= v_t.max_entrants then
		raise exception 'This tournament is full (% of %).', v_count, v_t.max_entrants;
	end if;

	insert into public.tbl_tournament_entrants (added_by, tournament_id, player_id, status)
	values ((select auth.uid()), p_tournament_id, p_player_id, p_status)
	on conflict (tournament_id, player_id) do update
		set status = excluded.status
	returning id into v_id;

	-- Tell them they are in. Added 20261022100000. Nothing is told to the
	-- person doing it, so a TD entering themselves gets nothing.
	perform private.tdc_notify(
		p_player_id, 'tournament',
		case when p_status = 'confirmed' then 'confirmed' else 'entered' end,
		case when p_status = 'confirmed'
			then 'You are confirmed for ' || v_t.name
			else 'You have been entered in ' || v_t.name end,
		case when p_status = 'confirmed'
			then 'Whoever is running it has confirmed your place.'
			else 'Whoever is running it added you. They will confirm places nearer the time.' end,
		'/tournaments/bracket/?t=' || p_tournament_id,
		null, p_tournament_id, private.tdc_me());

	return v_id;
end;
$$;
revoke execute on function public.tdc_add_entrant(uuid, uuid, text) from public, anon;
grant execute on function public.tdc_add_entrant(uuid, uuid, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Confirmed by a TD
--
-- Replaces the version from 20261021130000, patched not retyped.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_set_entrant(
	p_entrant_id uuid,
	p_status     text default null,
	p_paid       boolean default null,
	p_seed       integer default null,
	p_clear_seed boolean default false,
	p_notes      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tournament uuid;
	v_confirms   boolean;
	v_was        text;
	v_who        uuid;
	v_now        text;
	v_name       text;
begin
	select tournament_id into v_tournament
	from public.tbl_tournament_entrants where id = p_entrant_id;

	if v_tournament is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_tournament(v_tournament) then
		raise exception 'Only the people running this tournament can change entrants.';
	end if;

	select paid_confirms into v_confirms from public.tbl_tournaments where id = v_tournament;

	-- What it was, so that confirming is only announced when it changes.
	-- Without this, a TD ticking "paid" twice would send two messages.
	select status, player_id into v_was, v_who
	from public.tbl_tournament_entrants where id = p_entrant_id;

	update public.tbl_tournament_entrants
	set status  = case
			-- Marking somebody paid confirms them, where the TD has said that
			-- is their criterion. An explicit status still wins: a TD saying
			-- "paid, but withdrawn" means it.
			when p_status is not null then p_status
			when v_confirms and p_paid then 'confirmed'
			else status
		end,
		paid_at = case
			when p_paid is null then paid_at
			when p_paid then coalesce(paid_at, now())
			else null
		end,
		seed    = case when p_clear_seed then null else coalesce(p_seed, seed) end,
		notes   = coalesce(p_notes, notes)
	where id = p_entrant_id;

	-- Confirmed, and was not before. Added 20261022100000. Only this
	-- transition is worth a message: being moved back to interested, or
	-- having a seed changed, is the TD's housekeeping.
	select status into v_now from public.tbl_tournament_entrants where id = p_entrant_id;

	if v_now = 'confirmed' and v_was is distinct from 'confirmed' then
		select name into v_name from public.tbl_tournaments where id = v_tournament;
		perform private.tdc_notify(
			v_who, 'tournament', 'confirmed',
			'You are confirmed for ' || v_name,
			'Your place is confirmed.',
			'/tournaments/bracket/?t=' || v_tournament,
			null, v_tournament, private.tdc_me());
	end if;
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- A match now exists
--
-- Replaces the version from 20261019170000, patched not retyped.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_create_fixture_match(uuid);

create function public.tdc_create_fixture_match(p_fixture_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f    public.tbl_tournament_fixtures%rowtype;
	v_t    public.tbl_tournaments%rowtype;
	v_home uuid;
	v_away uuid;
	v_id   uuid;
begin
	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can start its matches.';
	end if;

	if v_f.match_id is not null then
		return v_f.match_id;
	end if;

	if v_f.advanced_entrant_id is not null then
		raise exception 'This fixture was already settled without being played, so it has no match.';
	end if;

	if v_f.home_entrant_id is null or v_f.away_entrant_id is null then
		raise exception 'Both sides have to be known before this fixture can be played.';
	end if;

	select * into v_t from public.tbl_tournaments where id = v_f.tournament_id;

	select player_id into v_home from public.tbl_tournament_entrants where id = v_f.home_entrant_id;
	select player_id into v_away from public.tbl_tournament_entrants where id = v_f.away_entrant_id;

	insert into public.tbl_matches (
		created_by, venue_id, rules,
		home_side_kind, home_player_id,
		away_side_kind, away_player_id,
		-- The tournament's own sanctioning carries onto its matches. It is an
		-- authorisation fact in both places, never a ruleset key, so it
		-- propagates rather than being decided again per match.
		sanctioned, sanctioned_at, sanctioned_by
	)
	values (
		(select auth.uid()), v_t.venue_id, v_t.rules,
		'player', v_home,
		'player', v_away,
		v_t.sanctioned,
		case when v_t.sanctioned then now() end,
		case when v_t.sanctioned then (select auth.uid()) end
	)
	returning id into v_id;

	update public.tbl_tournament_fixtures set match_id = v_id where id = p_fixture_id;

	-- Both players, now there is something to play. Added 20261022100000.
	-- This is the single place a tournament match comes into existence —
	-- automatic progression and a TD pressing Start match both arrive here —
	-- so one patch covers UV's "notify for auto-progression too".
	declare
		v_me    uuid := private.tdc_me();
		v_hname text;
		v_aname text;
		v_where text := 'Round ' || v_f.round || ' · Match ' || v_f."position";
	begin
		select display_name into v_hname from public.tbl_players where id = v_home;
		select display_name into v_aname from public.tbl_players where id = v_away;

		perform private.tdc_notify(v_home, 'tournament', 'match_ready',
			'Your match is ready',
			v_where || ' — you are playing ' || coalesce(v_aname, 'your opponent') || '.',
			'/match/?id=' || v_id, v_id, v_f.tournament_id, v_me);

		perform private.tdc_notify(v_away, 'tournament', 'match_ready',
			'Your match is ready',
			v_where || ' — you are playing ' || coalesce(v_hname, 'your opponent') || '.',
			'/match/?id=' || v_id, v_id, v_f.tournament_id, v_me);
	end;

	return v_id;
end;
$$;
revoke execute on function public.tdc_create_fixture_match(uuid) from public, anon;
grant execute on function public.tdc_create_fixture_match(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The result is published
--
-- Replaces the version from 20261021160000, patched not retyped.
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

	-- Both players: the result now counts. Added 20261022100000. Approving is
	-- the only publishing moment worth a message — in the modes where
	-- submitting publishes, the other player already hears about the
	-- submission through notify-card.
	declare
		v_s record;
	begin
		select * into v_s from private.tdc_match_score(p_match_id);

		perform private.tdc_notify(v_match.home_player_id, 'match', 'result_published',
			'Result published',
			coalesce(v_s.home_score, 0) || ' – ' || coalesce(v_s.away_score, 0)
				|| '. The result is final unless you raise an objection.',
			'/match/?id=' || p_match_id, p_match_id, null, v_me);

		perform private.tdc_notify(v_match.away_player_id, 'match', 'result_published',
			'Result published',
			coalesce(v_s.away_score, 0) || ' – ' || coalesce(v_s.home_score, 0)
				|| '. The result is final unless you raise an objection.',
			'/match/?id=' || p_match_id, p_match_id, null, v_me);
	end;

	return private.tdc_card_state(p_match_id);
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- An official changed a frame
--
-- Replaces the version from 20261021110000, patched not retyped. The
-- trigger itself is unchanged and still points at this function.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_frame_edit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_match uuid := coalesce(new.match_id, old.match_id);
	v_me    uuid;
	v_rank  integer;
begin
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	v_rank := coalesce(private.tdc_score_rank(v_match), 0);

	insert into public.tbl_frame_edit (
		match_id, frame_id, frame_no, action,
		edited_by_player_id, editor_role, editor_rank, card_version,
		before, after
	)
	values (
		v_match,
		coalesce(new.id, old.id),
		coalesce(new.frame_no, old.frame_no),
		lower(tg_op),
		v_me,
		private.tdc_editor_role(v_rank),
		v_rank,
		-- Read after the fact: the card_version trigger has already bumped it,
		-- so this is the version this edit produced, which is the one a stale
		-- submission is compared against.
		coalesce((select m.card_version from public.tbl_matches m where m.id = v_match), 0),
		case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
		case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
	);

	-- Tell the players an official changed their card. Added 20261022100000.
	--
	-- Only an editor who is **not in the match**. This trigger fires on every
	-- frame write, so without that test a player scoring their own match
	-- would send their opponent a message per frame. A player editing their
	-- own card is the card flow's business, not this.
	--
	-- Collapsed, so a TD correcting five frames leaves one notification.
	if v_me is not null then
		declare
			v_home uuid;
			v_away uuid;
			v_who  text;
		begin
			select home_player_id, away_player_id into v_home, v_away
			from public.tbl_matches where id = v_match;

			if v_me is distinct from v_home and v_me is distinct from v_away then
				select display_name into v_who from public.tbl_players where id = v_me;

				perform private.tdc_notify_collapsing(v_home, 'match', 'frame_changed',
					'Your scorecard was changed',
					coalesce(v_who, 'Somebody') || ' changed frame '
						|| coalesce(new.frame_no, old.frame_no) || '.',
					'/match/?id=' || v_match, v_match, null, v_me);

				perform private.tdc_notify_collapsing(v_away, 'match', 'frame_changed',
					'Your scorecard was changed',
					coalesce(v_who, 'Somebody') || ' changed frame '
						|| coalesce(new.frame_no, old.frame_no) || '.',
					'/match/?id=' || v_match, v_match, null, v_me);
			end if;
		end;
	end if;

	return coalesce(new, old);
end;
$$;
