-- Filling the draw, and shuffling it.
--
-- UV, 5 Nov: two buttons in the draw page's Generate the draw group. One
-- fills the first round's available slots with the entrants not yet in the
-- draw; the other shuffles every player in the first round across its
-- matches.
--
-- ─── Filling (tdc_populate_draw) ───
--
-- Who: the entrants who are not withdrawn (or confirmed only, as Who goes in
-- says), and not already anywhere in this draw. In random order (UV).
-- Where: every empty slot of the first round, in match order, top slot then
-- bottom. An empty slot is one with nobody in it and nothing feeding it. A
-- bye's empty slot is available too (UV asked for the available slots): the
-- bye is a fact about a slot nobody could fill, so filling it clears the
-- award, as dropping a player onto it does (tdc_set_fixture_source,
-- 20261022150000). A fixture with any other award (a walkover, a withdrawal,
-- a decision) is left alone: that is a director's decision about the people
-- in it. The first round is the lowest round of the main bracket, so a
-- prelim inserted in front of it is the one filled.
--
-- ─── Shuffling (tdc_shuffle_draw) ───
--
-- Every player in the first round, re-dealt at random across the same slots.
-- Refused if any first-round match has a frame played, or a fixture there
-- carries a walkover, withdrawal or decision: those are results, and a
-- shuffle would move a player out of their own result. A first-round match
-- with no frames is deleted (UV: it holds nothing) and the draw starts the
-- new pairs' matches as usual; its deletion is written to
-- tbl_deleted_matches, as tdc_delete_match writes a player's. A bye moves
-- with the shuffle: whoever lands alone in a bye's fixture goes through.
--
-- ─── Both ───
--
-- Rehearse by default, as tdc_swap_fixture_player and tdc_remove_fixture do:
-- called with p_apply false they do everything inside a subtransaction that
-- is rolled back, and return what would happen, so the page asks with real
-- numbers. Then the change goes up the draw through tdc_cascade_draw (the one
-- place that knows how a change propagates; a no-op in manual progression)
-- and tdc_resolve_draw starts what is ready. Seeds are left alone.

-- ─────────────────────────────────────────────────────────────────
-- Filling
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_populate_draw(
	p_tournament_id  uuid,
	p_confirmed_only boolean default true,
	p_apply          boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_first   integer;
	v_pool    uuid[];
	v_slot    record;
	v_i       integer := 0;
	v_byes    integer := 0;
	v_open    integer := 0;
	v_left    integer := 0;
begin
	if not exists (select 1 from public.tbl_tournaments where id = p_tournament_id) then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	select min(round) into v_first
	from public.tbl_tournament_fixtures
	where tournament_id = p_tournament_id and bracket = 'main';

	if v_first is null then
		raise exception 'There is no draw to fill yet. Generate it first.';
	end if;

	-- The entrants not yet in the draw, in random order (UV).
	select array_agg(e.id order by random())
	into v_pool
	from public.tbl_tournament_entrants e
	where e.tournament_id = p_tournament_id
		and e.status <> 'withdrawn'
		and (not p_confirmed_only or e.status = 'confirmed')
		and not exists (
			select 1 from public.tbl_tournament_fixtures f
			where f.tournament_id = p_tournament_id
				and (f.home_entrant_id = e.id or f.away_entrant_id = e.id)
		);

	begin
		for v_slot in
			select f.id, s.side, f.advance_reason
			from public.tbl_tournament_fixtures f
			cross join lateral (values
				(1, 'home', f.home_entrant_id, f.home_source_type),
				(2, 'away', f.away_entrant_id, f.away_source_type)
			) as s(ord, side, entrant, stype)
			where f.tournament_id = p_tournament_id
				and f.bracket = 'main'
				and f.round = v_first
				and f.match_id is null
				and s.entrant is null
				and s.stype is null
				and (f.advance_reason is null or f.advance_reason = 'bye')
			order by f."position", s.ord
		loop
			-- Every open slot is counted, filled or not, so the report says
			-- how many are still open once the people run out.
			v_open := v_open + 1;
			continue when v_i >= coalesce(array_length(v_pool, 1), 0);
			v_i := v_i + 1;

			if v_slot.side = 'home' then
				update public.tbl_tournament_fixtures
				set home_entrant_id = v_pool[v_i], home_source_type = 'entrant', home_source_ref = v_pool[v_i]
				where id = v_slot.id;
			else
				update public.tbl_tournament_fixtures
				set away_entrant_id = v_pool[v_i], away_source_type = 'entrant', away_source_ref = v_pool[v_i]
				where id = v_slot.id;
			end if;

			-- A bye's slot filled: nobody goes through on a bye any more.
			if v_slot.advance_reason = 'bye' then
				update public.tbl_tournament_fixtures
				set advanced_entrant_id = null, advance_reason = null
				where id = v_slot.id and advance_reason = 'bye';
				if found then v_byes := v_byes + 1; end if;
			end if;
		end loop;

		v_left := coalesce(array_length(v_pool, 1), 0) - v_i;

		perform public.tdc_cascade_draw(p_tournament_id, true);
		perform public.tdc_resolve_draw(p_tournament_id);

		if not p_apply then
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		-- People placed, of the slots that were open.
		'placed', v_i,
		'open_slots', v_open,
		-- Byes undone because their empty slot was filled.
		'byes_cleared', v_byes,
		-- People still waiting for a slot: more entrants than room.
		'left_over', v_left);
end;
$$;

comment on function public.tdc_populate_draw(uuid, boolean, boolean) is
	'Fill the first round''s empty slots (a bye''s included, which clears the bye) with the entrants not yet in the draw, in random order. Rehearses by default: call with p_apply false to find out how many go in and how many are left over.';

revoke execute on function public.tdc_populate_draw(uuid, boolean, boolean) from public, anon;
grant execute on function public.tdc_populate_draw(uuid, boolean, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Shuffling
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_shuffle_draw(
	p_tournament_id uuid,
	p_apply         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_first    integer;
	v_played   text;
	v_awarded  text;
	v_people   uuid[];
	v_dealt    uuid[];
	v_slot     record;
	v_i        integer := 0;
	v_removed  integer := 0;
	v_me       uuid;
	v_m        record;
begin
	if not exists (select 1 from public.tbl_tournaments where id = p_tournament_id) then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	select min(round) into v_first
	from public.tbl_tournament_fixtures
	where tournament_id = p_tournament_id and bracket = 'main';

	if v_first is null then
		raise exception 'There is no draw to shuffle yet. Generate it first.';
	end if;

	-- A result in the first round stops the shuffle, named.
	select string_agg('Match ' || f."position", ', ' order by f."position")
	into v_played
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
		and f.match_id is not null
		and exists (select 1 from public.tbl_frames fr where fr.match_id = f.match_id);

	if v_played is not null then
		raise exception 'The first round has started: % % frames played. A shuffle would move players out of their own matches.',
			v_played, case when v_played like '%,%' then 'have' else 'has' end;
	end if;

	select string_agg('Match ' || f."position", ', ' order by f."position")
	into v_awarded
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
		and f.advance_reason in ('walkover', 'withdrawal', 'decision');

	if v_awarded is not null then
		raise exception 'The first round has a result awarded (%). Undo it first: a shuffle would move players out of it.', v_awarded;
	end if;

	-- Everybody in the first round, and the same people dealt at random.
	select array_agg(x.entrant order by x.position, x.ord), array_agg(x.entrant order by random())
	into v_people, v_dealt
	from (
		select f."position", s.ord, s.entrant
		from public.tbl_tournament_fixtures f
		cross join lateral (values (1, f.home_entrant_id), (2, f.away_entrant_id)) as s(ord, entrant)
		where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
			and s.entrant is not null
	) x;

	if coalesce(array_length(v_people, 1), 0) < 2 then
		raise exception 'There is nobody to shuffle: the first round needs at least two players in it.';
	end if;

	-- Who is deleting, for the record of an unplayed match deleted.
	select p.id into v_me from public.tbl_players p where p.user_id = (select auth.uid());

	begin
		-- Unplayed first-round matches go (UV): they hold nothing, and the new
		-- pairs get their own. The fixture's match_id is set null by the FK.
		for v_m in
			select m.id, m.home_player_id, m.away_player_id,
				hp.display_name as home_name, ap.display_name as away_name
			from public.tbl_tournament_fixtures f
			join public.tbl_matches m on m.id = f.match_id
			left join public.tbl_players hp on hp.id = m.home_player_id
			left join public.tbl_players ap on ap.id = m.away_player_id
			where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
		loop
			insert into public.tbl_deleted_matches (match_id, deleted_by, home_player_id, away_player_id, summary)
			values (v_m.id, v_me, v_m.home_player_id, v_m.away_player_id,
				coalesce(v_m.home_name, 'Home') || ' 0 – ' || coalesce(v_m.away_name, 'Away')
					|| ' 0, 0 frames (the draw was shuffled)')
			on conflict (match_id) do nothing;
			perform set_config('tdc.card_unlock', 'on', true);
			delete from public.tbl_matches where id = v_m.id;
			perform set_config('tdc.card_unlock', 'off', true);
			v_removed := v_removed + 1;
		end loop;

		-- The same slots, the shuffled people, in the same order.
		for v_slot in
			select f.id, s.side
			from public.tbl_tournament_fixtures f
			cross join lateral (values
				(1, 'home', f.home_entrant_id),
				(2, 'away', f.away_entrant_id)
			) as s(ord, side, entrant)
			where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
				and s.entrant is not null
			order by f."position", s.ord
		loop
			v_i := v_i + 1;
			-- Both sides of a fixture are set one at a time, and for a moment
			-- a fixture can hold the same person twice, which its check
			-- refuses. So each slot is first cleared, then filled.
			if v_slot.side = 'home' then
				update public.tbl_tournament_fixtures
				set home_entrant_id = null where id = v_slot.id;
			else
				update public.tbl_tournament_fixtures
				set away_entrant_id = null where id = v_slot.id;
			end if;
		end loop;

		v_i := 0;
		for v_slot in
			select f.id, s.side
			from public.tbl_tournament_fixtures f
			cross join lateral (values
				(1, 'home', f.home_source_type),
				(2, 'away', f.away_source_type)
			) as s(ord, side, stype)
			where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
				and s.stype = 'entrant'
			order by f."position", s.ord
		loop
			v_i := v_i + 1;
			if v_slot.side = 'home' then
				update public.tbl_tournament_fixtures
				set home_entrant_id = v_dealt[v_i], home_source_ref = v_dealt[v_i]
				where id = v_slot.id;
			else
				update public.tbl_tournament_fixtures
				set away_entrant_id = v_dealt[v_i], away_source_ref = v_dealt[v_i]
				where id = v_slot.id;
			end if;
		end loop;

		-- A bye goes to whoever landed alone in it.
		update public.tbl_tournament_fixtures f
		set advanced_entrant_id = coalesce(f.home_entrant_id, f.away_entrant_id)
		where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
			and f.advance_reason = 'bye';

		perform public.tdc_cascade_draw(p_tournament_id, true);
		perform public.tdc_resolve_draw(p_tournament_id);

		if not p_apply then
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		'shuffled', coalesce(array_length(v_people, 1), 0),
		-- Unplayed first-round matches deleted, to be started again for the
		-- new pairs.
		'matches_removed', v_removed);
end;
$$;

comment on function public.tdc_shuffle_draw(uuid, boolean) is
	'Re-deal every player in the first round at random across its slots. Refused once a first-round match has a frame or a result is awarded there; unplayed first-round matches are deleted (recorded in tbl_deleted_matches). Rehearses by default.';

revoke execute on function public.tdc_shuffle_draw(uuid, boolean) from public, anon;
grant execute on function public.tdc_shuffle_draw(uuid, boolean) to authenticated;
