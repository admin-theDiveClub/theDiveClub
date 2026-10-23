-- Putting your name down no longer confirms you.
--
-- UV, 23 Oct, testing a real league: moving the whole Name Down list into the
-- league showed every one of them as confirmed, which they should not be
-- until the league says so in the way its settings say. The cause was
-- 20261023100000, where Claude made tdc_league_show_interest set
-- confirmed_at on the reasoning that putting your own name down is saying
-- you are playing. UV reversed that (docs/DECISIONS.md, 23 Oct).
--
-- What confirms a player now:
--
--   entry mode     paid confirms   confirmed when
--   interested     on              the director ticks paid (as before)
--   interested     off             the player presses "I'm playing", once let in
--   self_confirm   on              the director ticks paid
--   self_confirm   off             at once — joining is their confirmation
--
-- The self_confirm row is UV's answer too: with no director step and no
-- payment step, asking to join is the player saying they are playing.
--
-- Because the player now has something to do once they are let in, moving
-- somebody from Name Down into the league tells them, in the same way that
-- being added by hand always has — when paid confirms is off. Without it a
-- player in that league would never know to confirm. With paid confirms on
-- the paid tick is the confirmation, so they are not asked.
--
-- Both functions patched from their definitions as of 20261023100000,
-- extracted from a freshly reset local database.

CREATE OR REPLACE FUNCTION public.tdc_league_show_interest(p_league_season_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_mode    text;
	v_paid    boolean;
	v_me      uuid;
	v_status  text;
	v_confirm boolean;
	v_e       public.tbl_league_season_entrants%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select entry_mode, paid_confirms into v_mode, v_paid from public.tbl_league_seasons where id = p_league_season_id;
	if v_mode is null then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;
	if v_mode = 'ld_only' then
		raise exception 'This league is not taking names. Speak to whoever runs it.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	select * into v_e from public.tbl_league_season_entrants
	where league_season_id = p_league_season_id and player_id = v_me;

	-- Somebody the director has suspended does not get back in by asking.
	if v_e.status = 'suspended' then
		raise exception 'Your place in this league has been suspended. Speak to whoever runs it.';
	end if;
	-- Already in, in a way that asking again cannot improve.
	if v_e.status in ('active', 'interested') then
		return v_e.status;
	end if;

	v_status := case v_mode when 'self_confirm' then 'active' else 'interested' end;

	-- Name down is not confirmed. Only a self_confirm league with no payment
	-- step takes the asking as the confirmation. Anybody arriving here is
	-- new, withdrawn or inactive, so whatever confirmation they had before
	-- does not carry over: this is a fresh start.
	v_confirm := v_mode = 'self_confirm' and not v_paid;

	insert into public.tbl_league_season_entrants as e
		(added_by, league_season_id, player_id, status, confirmed_at)
	values ((select auth.uid()), p_league_season_id, v_me, v_status, case when v_confirm then now() end)
	on conflict (league_season_id, player_id) do update
		set status = v_status, confirmed_at = case when v_confirm then coalesce(e.confirmed_at, now()) end;

	return v_status;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.tdc_set_league_entrants_status(p_entrant_ids uuid[], p_status text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_ls     uuid;
	v_n      integer;
	v_let_in uuid[];
	v_actor  uuid;
	v_label  text;
	v_p      uuid;
begin
	if p_status not in ('interested', 'active', 'inactive', 'withdrawn', 'suspended') then
		raise exception 'TDC (Error): unknown entrant status "%".', p_status;
	end if;
	if p_entrant_ids is null or array_length(p_entrant_ids, 1) is null then
		return 0;
	end if;

	-- Every id has to belong to one season, and the caller has to run it.
	-- Otherwise a selection spanning two leagues would check one and move both.
	select array_agg(distinct league_season_id) into v_ls
	from public.tbl_league_season_entrants where id = any(p_entrant_ids)
	limit 1;

	if (select count(distinct league_season_id) from public.tbl_league_season_entrants
		where id = any(p_entrant_ids)) <> 1 then
		raise exception 'TDC (Error): those entrants are not all in one league season.';
	end if;

	select distinct league_season_id into v_ls
	from public.tbl_league_season_entrants where id = any(p_entrant_ids);

	if not private.tdc_can_run_league(v_ls) then
		raise exception 'Only the people running this league can change who is in it.';
	end if;

	-- Who is coming in off the Name Down list, so they can be told below.
	if p_status = 'active' then
		select array_agg(player_id) into v_let_in
		from public.tbl_league_season_entrants
		where id = any(p_entrant_ids) and status = 'interested';
	end if;

	update public.tbl_league_season_entrants
	set status = p_status,
		-- Coming off a withdrawal is a fresh decision, as it is everywhere
		-- else: they say again that they are playing.
		confirmed_at = case when status = 'withdrawn' and p_status <> 'withdrawn' then null else confirmed_at end,
		-- Somebody who is not in the league is not on a team either, and
		-- certainly not captaining one.
		team_id    = case when p_status in ('interested', 'suspended') then null else team_id end,
		is_captain = case when p_status in ('interested', 'suspended') then false else is_captain end
	where id = any(p_entrant_ids);

	get diagnostics v_n = row_count;

	-- Tell each of them they are in and should confirm, as
	-- tdc_add_league_entrant does for somebody added by hand. Not in a
	-- league that confirms on payment: there the director's paid tick is
	-- the confirmation, and asking the player would be asking the wrong
	-- person.
	if v_let_in is not null
		and not (select paid_confirms from public.tbl_league_seasons where id = v_ls) then
		select id into v_actor from public.tbl_players where user_id = (select auth.uid());
		select l.name || ' - ' || s.name into v_label
		from public.tbl_league_seasons s join public.tbl_leagues l on l.id = s.league_id
		where s.id = v_ls;

		for v_p in
			select player_id from public.tbl_league_season_entrants
			where league_season_id = v_ls and player_id = any(v_let_in) and confirmed_at is null
		loop
			perform private.tdc_notify(
				v_p, 'league', 'league_entry_added',
				'You are in ' || v_label,
				'Confirm that you are playing.',
				'/leagues/season/?s=' || v_ls::text, null, null, v_actor);
		end loop;
	end if;

	return v_n;
end;
$function$

;
