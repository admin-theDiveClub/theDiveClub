-- ───────────────────────────────────────────────────────────
-- A director's score can be saved before it is published
--
-- UV, 27 Nov: the Rounds view of Run the draw saves a match's score on every
-- press of its steppers, "but only push a player through automatically when
-- [the director] has inputted a score for both. So if he updates one score
-- and then does nothing on the next input, then no auto push."
--
-- Until now a score set by hand published itself the moment it was saved
-- (tdc_published_at: "a coordinator setting the score by hand is the
-- coordinator approving it"), so typing 3 then 5 for a 3–5 first published
-- 3–0: the wrong player went through and their next match was started.
--
--   tbl_match_result_override.published_at   when the score was published;
--                                            null while it is a draft. Every
--                                            score already set was published
--                                            when it was set, so it is set_at.
--   tdc_set_match_override(..., p_mode)      'publish' (the default: as
--                                            before, so Enter score and moving
--                                            a player through are unchanged),
--                                            'draft' (saved, not published) or
--                                            'final' (published, and the match
--                                            ends, as approving ends it). The
--                                            Rounds view saves 'draft' until
--                                            the director has entered both
--                                            scores, then 'final'.
--   private.tdc_published_at                 a score set by hand publishes at
--                                            its published_at, not its set_at.
--   tdc_approve_card                         Publish publishes a draft score,
--                                            even on a match approved before.
--
-- Patched from the text of a freshly reset database (pg_get_functiondef),
-- not retyped. tdc_set_match_override gains an argument, so it is dropped and
-- created again with its grants; its callers (tdc_move_through) pass four
-- arguments and get the default. The new column is readable as the others
-- are, column by column (20261127144020).
-- ───────────────────────────────────────────────────────────

alter table public.tbl_match_result_override add column published_at timestamptz;
update public.tbl_match_result_override set published_at = set_at;
comment on column public.tbl_match_result_override.published_at is
	'When this score was published; null while it is a draft (the Rounds view, before both scores are in).';
grant select (published_at) on public.tbl_match_result_override to authenticated;

drop function if exists public.tdc_set_match_override(uuid, integer, integer, text);

CREATE FUNCTION public.tdc_set_match_override(p_match_id uuid, p_home_score integer, p_away_score integer, p_reason text, p_mode text DEFAULT 'publish'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_m    public.tbl_matches%rowtype;
	v_me   uuid;
	v_home integer;
	v_away integer;
begin
	select * into v_m from public.tbl_matches where id = p_match_id;
	if v_m.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_override_match(p_match_id) then
		raise exception 'Only the people running the competition this match belongs to can set its score.';
	end if;

	if nullif(trim(coalesce(p_reason, '')), '') is null or char_length(trim(p_reason)) < 3 then
		raise exception 'Setting a score by hand needs a reason.';
	end if;

	if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0 then
		raise exception 'TDC (Error): a score needs two numbers, neither of them negative.';
	end if;

	if p_mode is null or p_mode not in ('publish', 'draft', 'final') then
		raise exception 'TDC (Error): a score is saved to publish, as a draft or as final, not "%".', p_mode;
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());

	select
		count(*) filter (where f.winner_side = 'home'),
		count(*) filter (where f.winner_side = 'away')
	into v_home, v_away
	from public.tbl_frames f
	where f.match_id = p_match_id and f.status = 'complete';

	insert into public.tbl_match_result_override
		(match_id, home_score, away_score, reason, set_by, counted_home, counted_away, card_version, published_at)
	values
		(p_match_id, p_home_score, p_away_score, trim(p_reason), v_me, v_home, v_away, v_m.card_version,
			case when p_mode = 'draft' then null else now() end)
	on conflict (match_id) do update set
		home_score   = excluded.home_score,
		away_score   = excluded.away_score,
		reason       = excluded.reason,
		set_by       = excluded.set_by,
		set_at       = now(),
		counted_home = excluded.counted_home,
		counted_away = excluded.counted_away,
		card_version = excluded.card_version,
		published_at = excluded.published_at;

	-- Final: the director's whole result, so the match ends as approving it
	-- (tdc_approve_card) and moving a player through (tdc_move_through) end it.
	if p_mode = 'final' then
		update public.tbl_matches
		set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
			ended_at = coalesce(ended_at, now())
		where id = p_match_id;
	end if;
end;
$function$;

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
	-- ...unless it was saved as a draft (20261127154848: the Rounds view saves
	-- one score at a time), which publishes when it is published: null until
	-- then, whatever the frames' own submission said.
	if exists (select 1 from public.tbl_match_result_override o where o.match_id = p_match_id) then
		select o.published_at into v_at from public.tbl_match_result_override o where o.match_id = p_match_id;
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
$function$;

CREATE OR REPLACE FUNCTION public.tdc_approve_card(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
	-- A draft score set by hand since is a new result to publish, so it does
	-- not count as approved already (20261127154848).
	if not exists (
		select 1 from public.tbl_match_result_override o
		where o.match_id = p_match_id and o.published_at is null
	) and exists (
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

	-- A draft score set by hand is published by approving it (20261127154848).
	update public.tbl_match_result_override
	set published_at = now()
	where match_id = p_match_id and published_at is null;

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
$function$;

revoke execute on function public.tdc_set_match_override(uuid, integer, integer, text, text) from public, anon;
grant execute on function public.tdc_set_match_override(uuid, integer, integer, text, text) to authenticated;
