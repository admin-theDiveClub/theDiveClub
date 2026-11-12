-- A lineup goes in all at once, when the captain locks it (UV, 12 Nov).
--
-- Until now the card saved every switch (tdc_set_match_squad) and every
-- position (tdc_set_lineup_slot) as the captain went down the list, then
-- tdc_lock_lineup locked whatever was saved. A captain going quickly down a
-- list of seven waited on fourteen saves. Now the page keeps the choices to
-- itself and sends them once, here, when Lock the lineup is pressed.
--
-- tdc_submit_lineup does nothing new. It calls the three existing functions,
-- in one transaction, so every rule they hold (who may set a side, active
-- players only, the number of positions, a locked side refuses) is still
-- decided in one place, and a refusal anywhere leaves nothing half saved.
--
-- Consequences, accepted by UV (12 Nov):
--   • the cutoff locks what is saved, so a side set up on the page but never
--     locked has nothing in at the cutoff;
--   • the squad is written at the lock, so a squad player sees the night (in
--     the profile menu, on their page) once their side locks, not before;
--   • a reload loses choices not yet sent.
--
-- The three functions stay: they are what this one is made of.

create function public.tdc_submit_lineup(
	p_match_id uuid,
	p_side     text,
	p_here     uuid[],
	p_order    uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_m         public.tbl_matches%rowtype;
	v_side      text;
	v_team      uuid;
	v_ls        uuid;
	v_positions integer;
	v_here      uuid[] := array_remove(coalesce(p_here, '{}'), null);
	v_order     uuid[] := coalesce(p_order, '{}');
	v_id        uuid;
	v_i         integer;
begin
	v_m := private.tdc_lineup_match(p_match_id);

	v_side := coalesce(p_side, private.tdc_league_match_side(p_match_id));
	if v_side is null then
		raise exception 'Say which side this is for. You do not captain either team in this match.';
	end if;
	if v_side not in ('home', 'away') then
		raise exception 'TDC (Error): side must be home or away, not "%".', v_side;
	end if;
	if not private.tdc_can_set_lineup(p_match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can lock its lineup.';
	end if;

	-- Locking twice is not an error in tdc_lock_lineup, but here the page has
	-- sent choices that would be thrown away without a word.
	if exists (select 1 from public.tbl_league_match_sides
		where match_id = p_match_id and side = v_side and locked_at is not null) then
		raise exception 'That lineup is already locked. A change now is a reserve on the night, not a new order.';
	end if;

	v_team := case v_side when 'home' then v_m.home_team_id else v_m.away_team_id end;
	v_ls   := private.tdc_league_season_of_match(p_match_id);

	-- tdc_set_match_squad finds the side from the player's team, so a
	-- director could otherwise put a player into the other team's squad.
	if exists (
		select 1 from unnest(v_here) h(id)
		where not exists (
			select 1 from public.tbl_league_season_entrants e
			where e.league_season_id = v_ls and e.player_id = h.id and e.team_id = v_team
		)
	) then
		raise exception 'Everybody in a lineup has to be on that team.';
	end if;

	if (select count(*) from unnest(v_order) o(id) where o.id is not null)
		<> (select count(distinct o.id) from unnest(v_order) o(id) where o.id is not null) then
		raise exception 'A player can hold only one position.';
	end if;
	if exists (select 1 from unnest(v_order) o(id) where o.id is not null and not (o.id = any (v_here))) then
		raise exception 'A player with a position has to be here tonight.';
	end if;

	-- Who is here: exactly the list, on this side. tdc_set_match_squad
	-- refuses a player who is no longer active, so one left in the squad
	-- from an earlier save stays there; the loop below empties any position
	-- they held, so they cannot play.
	for v_id in
		select s.player_id from public.tbl_league_match_squad s
		join public.tbl_league_season_entrants e
			on e.league_season_id = v_ls and e.player_id = s.player_id and e.status = 'active'
		where s.match_id = p_match_id and s.side = v_side and not (s.player_id = any (v_here))
	loop
		perform public.tdc_set_match_squad(p_match_id, v_id, false);
	end loop;
	foreach v_id in array v_here loop
		perform public.tdc_set_match_squad(p_match_id, v_id, true);
	end loop;

	-- The order: position i is p_order[i]; past the end of the list, empty.
	-- tdc_set_lineup_slot refuses a position beyond the team size.
	v_positions := greatest(private.tdc_lineup_positions(p_match_id), cardinality(v_order));
	for v_i in 1 .. v_positions loop
		perform public.tdc_set_lineup_slot(p_match_id, v_i, v_order[v_i], v_side);
	end loop;

	return public.tdc_lock_lineup(p_match_id, v_side);
end;
$$;

revoke execute on function public.tdc_submit_lineup(uuid, text, uuid[], uuid[]) from public, anon;
grant execute on function public.tdc_submit_lineup(uuid, text, uuid[], uuid[]) to authenticated;
