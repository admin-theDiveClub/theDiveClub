-- A settled card is final for the players.
--
-- UV, 23 Oct (docs/DECISIONS.md), replacing the 15 Oct rule in
-- 20261015180000 that "either player can reopen a card". The players chose
-- how their card is approved when they set the match up, and that choice is
-- the agreement: once it has run its course, the result stands.
--
--   Social, dispute window — until the other player answers or the window
--     closes, they may agree or dispute, and the submitter may withdraw.
--     Once agreed (early or by silence) it is locked for good.
--   Social, no approval — locked for good on submission. The page's "Submit
--     the card?" prompt is the protection against a mis-tap.
--   Tournaments and leagues — players cannot reopen a settled or published
--     card. The TD or LD sends it back (20261023185945 made that unlock), or
--     corrects the frames themselves.
--
-- So tdc_reopen_card keeps exactly one job: the submitter taking back a card
-- nobody has answered yet ("Withdraw" on the page). Everything else it used
-- to allow is refused, with a message that says who can help.
--
-- Before this, a player's reopen of a published tournament card half-worked:
-- it wrote a 'reopened' event, the state read "in progress", and the frames
-- stayed locked by publication — scoring buttons that all failed.
--
-- The rest of the function is the 20261015210000 text unchanged. Same
-- signature, so create or replace keeps its grants.

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

	-- Settled is final for the players (UV, 23 Oct). In a competition the
	-- people running it can send it back; in a social match nobody can.
	if v_state->>'state' in ('agreed', 'approved') then
		if private.tdc_match_competition(p_match_id) is not null
			or private.tdc_league_season_of_match(p_match_id) is not null then
			raise exception 'This result is settled. Ask whoever is running the competition to send it back.';
		end if;
		raise exception 'This scorecard is settled and can no longer be changed.';
	end if;

	-- What is left is withdrawing: only an unanswered card, only its submitter.
	if v_state->>'state' <> 'awaiting' then
		raise exception 'This scorecard has not been submitted, so there is nothing to take back.';
	end if;
	if (v_state->>'submitted_by')::uuid is distinct from v_me then
		raise exception 'You did not submit this scorecard. Say what is wrong with it instead.';
	end if;

	insert into public.tbl_match_events (match_id, player_id, kind, card_version)
	values (p_match_id, v_me, 'reopened', v_match.card_version);

	update public.tbl_matches
	set status = 'in_progress', ended_at = null
	where id = p_match_id;

	return private.tdc_card_state(p_match_id);
end;
$$;

-- ─── The lock's refusal stops telling players to reopen ───
--
-- "Reopen it before changing anything" is advice a player can no longer
-- follow. The two player-facing messages now say the card is final (singles)
-- or who can still change it (a team card). The rest of the function is the
-- current text unchanged.

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
		raise exception 'Both captains have signed this card. Only the league director can change it now.';
	end if;

	raise exception 'This scorecard is settled and can no longer be changed.';
end;
$function$
;
