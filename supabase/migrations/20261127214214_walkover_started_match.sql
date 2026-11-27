-- A walkover on a match that was started but never played (UV, 27 Nov).
--
-- UV: "publish should only be shown when we actually make an edit that can be
-- saved. Otherwise, we rely on the walk-over functionality", and a started
-- match with no score offers W/O (UV's answer). tdc_set_fixture refused any
-- award on a fixture with a match. Now, where the match has no frames and no
-- score set by hand, the empty match is deleted (recorded in
-- tbl_deleted_matches, as the draw's own unplayed matches are) and the award
-- stands. A match with frames or a score is refused as before.
--
-- Patched from the live definition (pg_get_functiondef on a fresh reset),
-- only the refusal and one declared variable changed.

CREATE OR REPLACE FUNCTION public.tdc_set_fixture(p_fixture_id uuid, p_home_entrant_id uuid DEFAULT NULL::uuid, p_away_entrant_id uuid DEFAULT NULL::uuid, p_clear_home boolean DEFAULT false, p_clear_away boolean DEFAULT false, p_advanced_entrant_id uuid DEFAULT NULL::uuid, p_advance_reason text DEFAULT NULL::text, p_clear_advance boolean DEFAULT false, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
	v_f    public.tbl_tournament_fixtures%rowtype;
	v_home uuid;
	v_away uuid;
	v_adv  uuid;
	v_why  text;
	v_me   uuid;
begin
	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	-- What the row becomes. A clear flag beats a value, so one call can empty
	-- a slot without having to say what to put in it.
	v_home := case when p_clear_home then null else coalesce(p_home_entrant_id, v_f.home_entrant_id) end;
	v_away := case when p_clear_away then null else coalesce(p_away_entrant_id, v_f.away_entrant_id) end;
	v_adv  := case when p_clear_advance then null else coalesce(p_advanced_entrant_id, v_f.advanced_entrant_id) end;
	v_why  := case when p_clear_advance then null else coalesce(p_advance_reason, v_f.advance_reason) end;

	-- Everybody named has to be in this tournament. Without this a typo'd id
	-- puts a stranger in a bracket and the draw stops meaning anything.
	if exists (
		select 1 from unnest(array[v_home, v_away, v_adv]) as x(id)
		where x.id is not null
			and not exists (
				select 1 from public.tbl_tournament_entrants e
				where e.id = x.id and e.tournament_id = v_f.tournament_id
			)
	) then
		raise exception 'TDC (Error): that entrant is not in this tournament.';
	end if;

	if v_home is not null and v_home = v_away then
		raise exception 'Somebody cannot play themselves.';
	end if;

	-- Whoever is awarded the fixture should be one of the two people in it.
	-- Not enforced as a constraint, because a TD moving people around mid-edit
	-- will pass through states where it is briefly untrue, but refused here
	-- because the finished article being wrong is a bracket nobody can read.
	if v_adv is not null and v_adv is distinct from v_home and v_adv is distinct from v_away then
		raise exception 'That entrant is not in this fixture, so the fixture cannot be awarded to them.';
	end if;

	-- A walkover on a match started but not played (UV, 27 Nov: "we rely on
	-- the walk-over functionality"): with no frames and no score set by hand
	-- nothing was played, so the empty match goes, recorded as the draw
	-- records an unplayed match (20261127175438), and the award stands. A
	-- match with frames or a score is still refused.
	if v_adv is not null and v_f.match_id is not null then
		if exists (select 1 from public.tbl_frames fr where fr.match_id = v_f.match_id)
			or exists (select 1 from public.tbl_match_result_override o where o.match_id = v_f.match_id) then
			raise exception 'This fixture has a match, so its result is counted from the frames. Change the match, or detach it first.';
		end if;
		select p.id into v_me from public.tbl_players p where p.user_id = (select auth.uid());
		if v_me is null then
			select r.player_id into v_me from public.tbl_competition_roles r
			where r.tournament_id = v_f.tournament_id and r.role = 'director'
			order by r.created_at limit 1;
		end if;
		insert into public.tbl_deleted_matches (match_id, deleted_by, home_player_id, away_player_id, summary)
		select m.id, v_me, m.home_player_id, m.away_player_id,
			coalesce(hp.display_name, 'Home') || ' 0 – ' || coalesce(ap.display_name, 'Away')
				|| ' 0, 0 frames (a walkover on the draw)'
		from public.tbl_matches m
		left join public.tbl_players hp on hp.id = m.home_player_id
		left join public.tbl_players ap on ap.id = m.away_player_id
		where m.id = v_f.match_id
		on conflict (match_id) do nothing;
		update public.tbl_tournament_fixtures set match_id = null where id = p_fixture_id;
		perform set_config('tdc.card_unlock', 'on', true);
		delete from public.tbl_matches where id = v_f.match_id;
		perform set_config('tdc.card_unlock', 'off', true);
	end if;

	if v_adv is not null and v_why is null then
		raise exception 'TDC (Error): awarding a fixture needs a reason (bye, walkover, withdrawal or decision).';
	end if;

	update public.tbl_tournament_fixtures
	set home_entrant_id = v_home,
		away_entrant_id = v_away,
		advanced_entrant_id = v_adv,
		advance_reason  = v_why,
		notes           = coalesce(p_notes, notes),
		-- A slot filled by hand stops being fed by the round below. Leaving
		-- the source in place would mean the next automatic advance quietly
		-- overwrote the TD, which is the opposite of what this function is for.
		-- An emptied slot has no source at all, which is the same shape a bye
		-- is written in. A filled one is sourced from the entrant directly.
		home_source_type = case
			when p_clear_home then null
			when p_home_entrant_id is not null then 'entrant'
			else home_source_type end,
		home_source_ref = case
			when p_clear_home then null
			when p_home_entrant_id is not null then p_home_entrant_id
			else home_source_ref end,
		away_source_type = case
			when p_clear_away then null
			when p_away_entrant_id is not null then 'entrant'
			else away_source_type end,
		away_source_ref = case
			when p_clear_away then null
			when p_away_entrant_id is not null then p_away_entrant_id
			else away_source_ref end
	where id = p_fixture_id;
end;
$$;

revoke execute on function public.tdc_set_fixture(uuid, uuid, uuid, boolean, boolean, uuid, text, boolean, text) from public, anon;
grant execute on function public.tdc_set_fixture(uuid, uuid, uuid, boolean, boolean, uuid, text, boolean, text) to authenticated;
