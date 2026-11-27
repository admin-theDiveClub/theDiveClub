-- ───────────────────────────────────────────────────────────
-- The draw follows the confirmed players until play starts
--
-- UV, 27 Nov: "I need the draw to update automatically, as confirmed players
-- come in." UV's answers: a newly confirmed player takes the first open place;
-- when the draw is full it grows by itself to the next size; a player who
-- withdraws or goes back to Interested comes out, their opponent getting a
-- bye again; all of it until play starts. And it applies to the tournament
-- already running tonight (Basil's Friday Super Comp), caught up at the end.
--
-- ─── How ───
--
-- A statement trigger on tbl_tournament_entrants (an entrant added, a status
-- changed, an entrant removed: the director's pill, Paid when paid confirms,
-- walk-ins, a player entering themselves) calls
-- private.tdc_follow_entrants(tournament) once per tournament touched. It
-- does nothing without a draw, and nothing once play has started: a frame, a
-- director's score, a finished or abandoned match, or a walkover, withdrawal
-- or decision anywhere in the tournament (Claude's: a match made but not
-- played is not play, so a tournament that starts matches automatically still
-- follows). Otherwise, in the first round:
--
--   1. anybody no longer confirmed (or removed) comes out of their place;
--   2. each confirmed player in no place goes into the first open place, in
--      draw order, home before away, the earliest entered first; an open
--      place is one with nobody and nothing feeding it, a bye's empty side
--      included (as Fill the first round);
--   3. if confirmed players are left over, the draw is made again at the size
--      that holds everybody confirmed (tdc_generate_draw, confirmed only), so
--      a shuffle or hand changes are lost (UV chose this);
--   4. otherwise: a match on a fixture whose players changed is deleted and
--      recorded, as the shuffle does (none can have been played); one player
--      alone has a bye, two have none;
--
-- then the change goes up the draw and matches start as the tournament's
-- settings say (tdc_cascade_draw, tdc_resolve_draw). The draw never shrinks.
-- A failure here fails the change that caused it, with its message: never a
-- confirmation quietly left out of the draw.
--
-- ─── Who may ───
--
-- Every draw function asks private.tdc_can_run_tournament, the one place
-- deciding who runs a competition, and a player confirming themselves does
-- not. So that one place also says yes while the database itself is
-- following the entrants of that tournament: tdc_follow_entrants sets the
-- transaction-local setting tdc.draw_follow to the tournament's id around its
-- work and clears it after (as the shuffle sets tdc.card_unlock to delete a
-- match). Nothing reachable from the API can set it.
-- ───────────────────────────────────────────────────────────

-- ─── The one place deciding who runs a competition ───
-- Patched from the text of a freshly reset database: the last line added.
CREATE OR REPLACE FUNCTION private.tdc_can_run_tournament(p_tournament_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select private.tdc_competition_rank(p_tournament_id) >= 100
		or exists (
			select 1 from public.tbl_tournaments t
			where t.id = p_tournament_id
				and t.venue_id is not null
				and private.tdc_has_venue_role(t.venue_id, array['owner', 'admin', 'staff'])
		)
		-- The database following this tournament's confirmed players
		-- (private.tdc_follow_entrants, 20261127175438).
		or coalesce(current_setting('tdc.draw_follow', true), '') = p_tournament_id::text;
$function$;


-- ─── Following the confirmed players ───
create function private.tdc_follow_entrants(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
			and (f.advance_reason in ('walkover', 'withdrawal', 'decision')
				or (f.match_id is not null and (
					exists (select 1 from public.tbl_frames fr where fr.match_id = f.match_id)
					or exists (select 1 from public.tbl_match_result_override o where o.match_id = f.match_id)
					or exists (select 1 from public.tbl_matches m where m.id = f.match_id
						and m.status in ('complete', 'abandoned')))))
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

		v_grow := coalesce(array_length(v_pool, 1), 0) > v_i;

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
$$;

revoke execute on function private.tdc_follow_entrants(uuid) from public, anon, authenticated;

comment on function private.tdc_follow_entrants(uuid) is
	'Keeps a single-elimination draw in step with its confirmed players until play starts (UV, 27 Nov): out when no longer confirmed, in at the first open place, the draw made again at the next size when full. Called by the entrants trigger.';


-- ─── The trigger ───
-- One call per tournament per statement, so a pasted list of walk-ins is
-- followed once. Three triggers, because a trigger with transition tables
-- takes one event; an update counts only where a status changed (a draw made
-- again sets seeds, which is not a change of who is in).
create function private.tdc_entrants_follow_draw()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t uuid;
begin
	if tg_op = 'INSERT' then
		for v_t in select distinct n.tournament_id from new_rows n loop
			perform private.tdc_follow_entrants(v_t);
		end loop;
	elsif tg_op = 'DELETE' then
		for v_t in select distinct o.tournament_id from old_rows o loop
			perform private.tdc_follow_entrants(v_t);
		end loop;
	else
		for v_t in
			select distinct n.tournament_id
			from new_rows n join old_rows o on o.id = n.id
			where n.status is distinct from o.status
		loop
			perform private.tdc_follow_entrants(v_t);
		end loop;
	end if;
	return null;
end;
$$;

revoke execute on function private.tdc_entrants_follow_draw() from public, anon, authenticated;

create trigger tdc_entrants_follow_draw_insert
	after insert on public.tbl_tournament_entrants
	referencing new table as new_rows
	for each statement execute function private.tdc_entrants_follow_draw();

create trigger tdc_entrants_follow_draw_update
	after update on public.tbl_tournament_entrants
	referencing old table as old_rows new table as new_rows
	for each statement execute function private.tdc_entrants_follow_draw();

create trigger tdc_entrants_follow_draw_delete
	after delete on public.tbl_tournament_entrants
	referencing old table as old_rows
	for each statement execute function private.tdc_entrants_follow_draw();


-- ─── Tonight's tournament, caught up (UV: "apply to the existing tournament") ───
-- Basil's Friday Super Comp: anybody confirmed since its draw was made goes in,
-- anybody withdrawn since comes out. Does nothing if play has started, or if
-- the tournament is not on this database (the local copy).
select private.tdc_follow_entrants('4d0b23de-2304-4d7a-8715-b6f456d159a5');
