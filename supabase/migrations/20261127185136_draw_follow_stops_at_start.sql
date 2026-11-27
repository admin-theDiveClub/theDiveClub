-- ───────────────────────────────────────────────────────────
-- The draw stops following the entrants once a match is started, and never
-- grows by itself
--
-- UV, 27 Nov, during Basil's Friday Super Comp: "Matches that are started
-- should not be changed now. I need to add a player in a specific spot and now
-- it's force redrawing all players." A 17th confirmation made the draw again at
-- 32 (20261127175438, step 3), deleting the 8 unplayed matches.
--
--   1. Play has started once any match in the tournament is started (made),
--      not only once one has a frame, a score or an end. From then the draw
--      is the director's alone.
--   2. A full draw is never made again by itself: a confirmed player with no
--      open place waits, for the director to put in a place of their choosing
--      (dragging the player's pill onto a slot, Run the draw).
--
-- Placing in the first open place and taking out anyone no longer confirmed
-- are unchanged, before any match is started. Patched from the text of a
-- freshly reset database; nothing else in the function changed.
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.tdc_follow_entrants(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_t       public.tbl_tournaments%rowtype;
	v_first   integer;
	v_slot    record;
	v_pool    uuid[];
	v_i       integer := 0;
	v_changed uuid[] := '{}';
	v_grow    boolean := false;
	v_me      uuid;
	v_m       record;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null or v_t.status in ('complete', 'cancelled') or v_t.format <> 'single_elimination' then
		return;
	end if;

	-- Already following this tournament (the draw's own writes to entrants,
	-- the seeds a new draw sets, come back through the trigger).
	if coalesce(current_setting('tdc.draw_follow', true), '') = p_tournament_id::text then
		return;
	end if;

	select min(round) into v_first
	from public.tbl_tournament_fixtures
	where tournament_id = p_tournament_id and bracket = 'main';
	if v_first is null then
		return;   -- no draw yet: the director makes the first one
	end if;

	-- Play has started: from here the director changes the draw by hand.
	if exists (
		select 1 from public.tbl_tournament_fixtures f
		where f.tournament_id = p_tournament_id
			-- Any match started (UV, 27 Nov: "matches that are started should
			-- not be changed"), or anything awarded but a bye.
			and (f.advance_reason in ('walkover', 'withdrawal', 'decision')
				or f.match_id is not null)
	) then
		return;
	end if;

	-- Who is deleting, for the record of an unplayed match deleted: whoever
	-- made the change, or the tournament's first director when nobody is
	-- signed in (a migration).
	select p.id into v_me from public.tbl_players p where p.user_id = (select auth.uid());
	if v_me is null then
		select r.player_id into v_me from public.tbl_competition_roles r
		where r.tournament_id = p_tournament_id and r.role = 'director'
		order by r.created_at limit 1;
	end if;

	begin
		perform set_config('tdc.draw_follow', p_tournament_id::text, true);

		-- 1. Out: a place holding anybody no longer confirmed, or nobody any
		--    more (an entrant deleted leaves the place null).
		for v_slot in
			select f.id, s.side
			from public.tbl_tournament_fixtures f
			cross join lateral (values
				('home', f.home_entrant_id, f.home_source_type),
				('away', f.away_entrant_id, f.away_source_type)
			) as s(side, entrant, stype)
			left join public.tbl_tournament_entrants e on e.id = s.entrant
			where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
				and s.stype = 'entrant'
				and (e.id is null or e.status <> 'confirmed')
		loop
			if v_slot.side = 'home' then
				update public.tbl_tournament_fixtures
				set home_entrant_id = null, home_source_type = null, home_source_ref = null
				where id = v_slot.id;
			else
				update public.tbl_tournament_fixtures
				set away_entrant_id = null, away_source_type = null, away_source_ref = null
				where id = v_slot.id;
			end if;
			v_changed := v_changed || v_slot.id;
		end loop;

		-- 2. In: each confirmed player in no place, the earliest entered first,
		--    into the first open place.
		select array_agg(e.id order by e.created_at, e.id)
		into v_pool
		from public.tbl_tournament_entrants e
		where e.tournament_id = p_tournament_id
			and e.status = 'confirmed'
			and not exists (
				select 1 from public.tbl_tournament_fixtures f
				where f.tournament_id = p_tournament_id
					and (f.home_entrant_id = e.id or f.away_entrant_id = e.id)
			);

		for v_slot in
			select f.id, s.side
			from public.tbl_tournament_fixtures f
			cross join lateral (values
				(1, 'home', f.home_entrant_id, f.home_source_type),
				(2, 'away', f.away_entrant_id, f.away_source_type)
			) as s(ord, side, entrant, stype)
			where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
				and s.entrant is null and s.stype is null
				and (f.advance_reason is null or f.advance_reason = 'bye')
			order by f."position", s.ord
		loop
			exit when v_i >= coalesce(array_length(v_pool, 1), 0);
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
			v_changed := v_changed || v_slot.id;
		end loop;

		-- A full draw is not made again by itself (UV, 27 Nov: it redrew every
		-- player when the director meant to put one in a place of their own):
		-- whoever finds no open place waits for the director.
		v_grow := false;

		-- Unplayed matches go, recorded as the shuffle records them: every one
		-- in the draw when it is made again, else those whose players changed.
		for v_m in
			select m.id, m.home_player_id, m.away_player_id,
				hp.display_name as home_name, ap.display_name as away_name
			from public.tbl_tournament_fixtures f
			join public.tbl_matches m on m.id = f.match_id
			left join public.tbl_players hp on hp.id = m.home_player_id
			left join public.tbl_players ap on ap.id = m.away_player_id
			where f.tournament_id = p_tournament_id
				and (v_grow or f.id = any(v_changed))
		loop
			insert into public.tbl_deleted_matches (match_id, deleted_by, home_player_id, away_player_id, summary)
			values (v_m.id, v_me, v_m.home_player_id, v_m.away_player_id,
				coalesce(v_m.home_name, 'Home') || ' 0 – ' || coalesce(v_m.away_name, 'Away')
					|| ' 0, 0 frames (the draw changed as entries came in)')
			on conflict (match_id) do nothing;
			perform set_config('tdc.card_unlock', 'on', true);
			delete from public.tbl_matches where id = v_m.id;
			perform set_config('tdc.card_unlock', 'off', true);
		end loop;

		if v_grow then
			-- 3. Full: made again at the size that holds everybody confirmed.
			perform public.tdc_generate_draw(p_tournament_id, true, true, true);
		else
			-- 4. One player alone has a bye; two, or nobody, have none.
			update public.tbl_tournament_fixtures f
			set advanced_entrant_id = null, advance_reason = null
			where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
				and f.advance_reason = 'bye'
				and ((f.home_entrant_id is null) = (f.away_entrant_id is null));
			update public.tbl_tournament_fixtures f
			set advanced_entrant_id = coalesce(f.home_entrant_id, f.away_entrant_id), advance_reason = 'bye'
			where f.tournament_id = p_tournament_id and f.bracket = 'main' and f.round = v_first
				and (f.home_entrant_id is null) <> (f.away_entrant_id is null)
				and f.match_id is null
				and (f.advance_reason is null or f.advance_reason = 'bye')
				and f.advanced_entrant_id is distinct from coalesce(f.home_entrant_id, f.away_entrant_id);
		end if;

		if v_grow or cardinality(v_changed) > 0 then
			perform public.tdc_cascade_draw(p_tournament_id, true);
			perform public.tdc_resolve_draw(p_tournament_id);
		end if;

		-- Cleared as soon as the work is done. A failure above ends the whole
		-- change that caused it, with its reason, and undoes the setting too.
		perform set_config('tdc.draw_follow', '', true);
	end;
end;
$function$;
