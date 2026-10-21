-- Swapping a player in a fixture.
--
-- UV, 21 Oct: "Basically on every match, TD should be able to swap out a
-- player. I think we should warn and cascade. The main idea here is corrections
-- to a running tournament and will only rarely be used. I believe it will serve
-- more function at the start of a tournament where TD can randomize the player
-- list and then auto-populate the first round and then make edits."
--
-- So two uses, and they want the same function to behave differently without
-- being told which one you are doing:
--
--   Before play — editing an auto-populated first round. Nothing is at stake;
--   it should be two taps and no ceremony.
--
--   Mid-tournament — a correction. Somebody withdrew, or the wrong name was
--   entered. Matches exist, frames may have been played, and the rounds above
--   may already have been filled from this fixture's result.
--
-- ─── Why this is not just tdc_set_fixture ───
--
-- tdc_set_fixture already sets either slot and already detaches the slot from
-- its feeder, which is most of the first case. What it does not do is notice
-- the match.
--
-- tbl_frames records a winner as a *side* — 'home' or 'away' — while
-- tbl_matches names a *player*. So changing a fixture's entrant without
-- touching its match leaves the two disagreeing: the bracket shows Cal v Bob
-- while the match behind it is still Ann v Bob, and tdc_fixture_outcome reads
-- the match. Worse, if the match were simply repointed at Cal, two frames Ann
-- actually played would silently become Cal's record.
--
-- ─── The rule, which was already decided ───
--
-- tdc_cascade_draw (20261020130000) settled this: "The match in this fixture
-- was between two particular people. If either of them is changing, it is no
-- longer this fixture's match. It keeps its frames and stops belonging to the
-- draw." A swap follows the same rule rather than inventing a second answer to
-- the same question. Nothing is destroyed — the FK runs from fixture to match,
-- so the played match survives intact and simply stops being part of a bracket.
--
-- ─── Rehearse, then apply ───
--
-- Same shape as tdc_cascade_draw, and for the same reason: a TD is entitled to
-- know that a swap will detach a match with five frames in it and move two
-- people in the round above *before* it happens, not after. p_apply defaults to
-- false, so the first call is always a question.

-- ─────────────────────────────────────────────────────────────────
-- What a swap would do
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_swap_fixture_player(
	p_fixture_id uuid,
	-- Which slot. Named rather than inferred from the outgoing entrant: a TD
	-- filling an empty slot has nobody to name, and "replace whoever is in the
	-- home slot" is the actual intention either way.
	p_side       text,
	-- The entrant going in. Null empties the slot, which is how somebody who
	-- withdrew is taken out without a stand-in.
	p_entrant_id uuid    default null,
	p_apply      boolean default false,
	-- Why, where it is worth recording. Required once frames have been played,
	-- because re-attributing somebody's night should not be a two-tap action
	-- with no note of who did it or what for.
	p_reason     text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f        public.tbl_tournament_fixtures%rowtype;
	v_t        public.tbl_tournaments%rowtype;
	v_out      uuid;          -- who is in that slot now
	v_out_name text;
	v_in_name  text;
	v_frames   integer := 0;
	v_detached jsonb   := jsonb_build_object();
	v_cleared  jsonb   := jsonb_build_object();
	v_cascade  jsonb   := jsonb_build_object();
	v_locked   boolean := false;
	v_also     jsonb   := jsonb_build_array();
begin
	if p_side not in ('home', 'away') then
		raise exception 'TDC (Error): a side is home or away, not "%".', p_side;
	end if;

	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	select * into v_t from public.tbl_tournaments where id = v_f.tournament_id;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	v_out := case when p_side = 'home' then v_f.home_entrant_id else v_f.away_entrant_id end;

	-- Nothing to do, and said rather than reported as a change that did not
	-- happen.
	if v_out is not distinct from p_entrant_id then
		return jsonb_build_object(
			'applied', false,
			'note', 'That slot already holds that entrant.',
			'changes', jsonb_build_array());
	end if;

	-- The incoming entrant has to be in this tournament, for the same reason
	-- tdc_set_fixture checks: a typo'd id puts a stranger in the bracket and
	-- the draw stops meaning anything.
	if p_entrant_id is not null then
		if not exists (
			select 1 from public.tbl_tournament_entrants e
			where e.id = p_entrant_id and e.tournament_id = v_f.tournament_id
		) then
			raise exception 'TDC (Error): that entrant is not in this tournament.';
		end if;

		-- The case is parenthesised: `case ... end then` leaves the parser
		-- unable to see where the CASE stops and the IF resumes.
		if p_entrant_id = (case when p_side = 'home' then v_f.away_entrant_id else v_f.home_entrant_id end) then
			raise exception 'Somebody cannot play themselves. Move the other side first.';
		end if;
	end if;

	-- Where the incoming entrant already is in this draw.
	--
	-- Reported, not refused. A TD rearranging a bracket by hand legitimately
	-- passes through states where somebody is in two places — the same reason
	-- tdc_set_fixture refuses only the finished article being wrong — and
	-- refusing here would mean a swap had to be done in an order the TD worked
	-- out for themselves. But it must not be silent: two fixtures in one round
	-- holding the same player is a bracket nobody can play.
	if p_entrant_id is not null then
		select coalesce(jsonb_agg(jsonb_build_object(
				'bracket', f2.bracket, 'round', f2.round, 'position', f2."position",
				'same_round', f2.round = v_f.round)
				order by f2.round, f2."position"), '[]'::jsonb)
		into v_also
		from public.tbl_tournament_fixtures f2
		where f2.tournament_id = v_f.tournament_id
			and f2.id <> p_fixture_id
			and (f2.home_entrant_id = p_entrant_id or f2.away_entrant_id = p_entrant_id);
	end if;

	-- Names for the report. The TD is about to be asked a question about
	-- people, so it is asked with their names in it.
	select p.display_name into v_out_name
	from public.tbl_tournament_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.id = v_out;

	select p.display_name into v_in_name
	from public.tbl_tournament_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.id = p_entrant_id;

	-- ── The match, if there is one ──
	if v_f.match_id is not null then
		select count(*) into v_frames from public.tbl_frames where match_id = v_f.match_id;
		v_locked := private.tdc_card_is_locked(v_f.match_id);

		-- A published card is locked by design, and quietly detaching it from
		-- the bracket would change a result that has been agreed. The ways
		-- through already exist and are named rather than left to be guessed.
		if v_locked then
			raise exception 'The result of this match has been published, so the draw cannot be changed underneath it. Reject or override the result first, then swap.';
		end if;

		if v_frames > 0 and (p_reason is null or char_length(trim(p_reason)) < 3) then
			raise exception 'This match has % frame(s) already played. Say why the player is changing — the match keeps its frames and stops belonging to the draw.', v_frames;
		end if;

		v_detached := jsonb_build_object(
			'match_id', v_f.match_id,
			'frames', v_frames,
			'status', (select status from public.tbl_matches where id = v_f.match_id));
	end if;

	begin
		-- ── The swap itself ──
		if p_side = 'home' then
			update public.tbl_tournament_fixtures
			set home_entrant_id  = p_entrant_id,
				-- A slot set by hand stops being fed from the round below, or
				-- the next automatic advance would overwrite the TD. Same rule
				-- and same shape as tdc_set_fixture.
				home_source_type = case when p_entrant_id is null then null else 'entrant' end,
				home_source_ref  = p_entrant_id
			where id = p_fixture_id;
		else
			update public.tbl_tournament_fixtures
			set away_entrant_id  = p_entrant_id,
				away_source_type = case when p_entrant_id is null then null else 'entrant' end,
				away_source_ref  = p_entrant_id
			where id = p_fixture_id;
		end if;

		-- ── The match is no longer this fixture's ──
		if v_f.match_id is not null then
			update public.tbl_tournament_fixtures
			set match_id = null, notes = case
					when p_reason is null then notes
					else trim(coalesce(notes || E'\n', '') || 'Player changed: ' || trim(p_reason))
				end
			where id = p_fixture_id;
		elsif p_reason is not null then
			update public.tbl_tournament_fixtures
			set notes = trim(coalesce(notes || E'\n', '') || 'Player changed: ' || trim(p_reason))
			where id = p_fixture_id;
		end if;

		-- ── A walkover awarded to the person leaving is not a result ──
		if v_f.advanced_entrant_id is not null and v_f.advanced_entrant_id = v_out then
			v_cleared := jsonb_build_object('reason', v_f.advance_reason);
			update public.tbl_tournament_fixtures
			set advanced_entrant_id = null, advance_reason = null
			where id = p_fixture_id;
		end if;

		-- ── Downstream ──
		-- The cascade is the one place that knows how a change propagates, so
		-- it is called rather than reimplemented here. It is a no-op on a
		-- tournament set to manual progression, which is correct: there, the TD
		-- moves people themselves and cascading would overrule them.
		v_cascade := public.tdc_cascade_draw(v_f.tournament_id, true);

		-- Fill anything newly fillable and start what is ready, so the draw
		-- comes back consistent rather than half-moved.
		perform public.tdc_resolve_draw(v_f.tournament_id);

		if not p_apply then
			-- Abort the subtransaction. Everything above is undone; the
			-- plpgsql variables survive, which is what makes this a rehearsal
			-- rather than a guess. Same trick as tdc_cascade_draw.
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		'side', p_side,
		'was', coalesce(v_out_name, 'nobody'),
		'now', coalesce(v_in_name, 'nobody'),
		'round', v_f.round,
		'position', v_f."position",
		'bracket', v_f.bracket,
		-- Empty objects rather than nulls, so a page can test length without
		-- checking for null first.
		'detached', v_detached,
		'award_cleared', v_cleared,
		-- Other fixtures the incoming entrant is already in. Empty is the
		-- ordinary case; anything with same_round true is a bracket the TD
		-- needs to finish fixing.
		'also_in', v_also,
		'cascade', v_cascade);
end;
$$;

comment on function public.tdc_swap_fixture_player(uuid, text, uuid, boolean, text) is
	'Replace or remove the entrant in one slot of a fixture. Rehearses by default: call with p_apply false to find out what it would do, including which match detaches and who moves in the rounds above. Follows tdc_cascade_draw''s rule that a match between two particular people stops belonging to the draw when either of them changes.';

revoke execute on function public.tdc_swap_fixture_player(uuid, text, uuid, boolean, text) from public, anon;
grant execute on function public.tdc_swap_fixture_player(uuid, text, uuid, boolean, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Who can go in that slot
--
-- The entrant list is the TD's view and is gated, which is right — but the
-- swap control needs the names, and reading the whole entrant list to populate
-- a dropdown would hand the page payment status and private notes it has no
-- use for. This is the narrow read for that one purpose.
--
-- UV asked for drag-and-drop from a confirmed/paid list onto a match. The
-- picker is the same idea with a different gesture: a TD at the desk is on a
-- phone, where dragging across a scrolling bracket is unreliable. Whether it
-- becomes a drag later is a page question — this function serves either.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_fixture_candidates(p_fixture_id uuid)
returns table (
	entrant_id   uuid,
	display_name text,
	status       text,
	paid         boolean,
	seed         integer,
	-- Where they already are in this draw, so a TD can see they are about to
	-- put somebody in two places at once.
	already_in   text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_f public.tbl_tournament_fixtures%rowtype;
begin
	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	return query
	select e.id, p.display_name, e.status, e.paid_at is not null, e.seed,
		(select string_agg(
				f2.bracket || ' ' || f2.round || '-' || f2."position", ', '
				order by f2.round, f2."position")
			from public.tbl_tournament_fixtures f2
			where f2.tournament_id = v_f.tournament_id
				and f2.id <> p_fixture_id
				and (f2.home_entrant_id = e.id or f2.away_entrant_id = e.id))
	from public.tbl_tournament_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.tournament_id = v_f.tournament_id
		-- Somebody who withdrew is still offered: a TD correcting a withdrawal
		-- entered by mistake needs to be able to put them back, and the status
		-- is returned so the page can say what it is.
		and e.id is distinct from v_f.home_entrant_id
		and e.id is distinct from v_f.away_entrant_id
	order by e.seed nulls last, p.display_name;
end;
$$;

revoke execute on function public.tdc_fixture_candidates(uuid) from public, anon;
grant execute on function public.tdc_fixture_candidates(uuid) to authenticated;
