-- Renaming a season renames its period too, when no other league shares it.
--
-- UV, 23 Oct: the settings page should let a director change everything they
-- set when the league was made. The season name is one of those, and it is
-- stored twice: on tbl_league_seasons (this league's season) and on
-- tbl_seasons (the period that holds the dates). tdc_create_league_season
-- writes both from the one box; tdc_update_league_season renamed only the
-- first, so the leagues list (which shows the period's name, and in search
-- results only that) would have kept the old name.
--
-- The same rule as the dates in this function: a period shared with another
-- league keeps its own name, because renaming it would rename someone else's
-- season. The league's own season name still changes.
--
-- Two smaller changes, both for the same page:
--   • p_clear_dates now means "set the dates to exactly these", so a blank
--     clears that one date. It used to clear both whatever was sent, so a
--     director could not remove an end date and keep the start. Nothing
--     called it with p_clear_dates before this (checked: only league-manage.js
--     calls the function, for the entry settings).
--   • An end before the start, or a name under two characters, is refused
--     here, not only by the page.
--
-- Patched from the definition as of 20261023100000, extracted from the local
-- database.

CREATE OR REPLACE FUNCTION public.tdc_update_league_season(p_league_season_id uuid, p_name text DEFAULT NULL::text, p_rules_overrides jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text, p_starts_on date DEFAULT NULL::date, p_ends_on date DEFAULT NULL::date, p_clear_dates boolean DEFAULT false, p_entry_mode text DEFAULT NULL::text, p_paid_confirms boolean DEFAULT NULL::boolean, p_is_listed boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_s       public.tbl_league_seasons%rowtype;
	v_league  public.tbl_leagues%rowtype;
	v_shared  integer;
	v_start   date;
	v_end     date;
begin
	select * into v_s from public.tbl_league_seasons where id = p_league_season_id;
	if v_s.id is null then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can change it.';
	end if;

	select * into v_league from public.tbl_leagues where id = v_s.league_id;

	if p_rules_overrides is not null then
		if jsonb_typeof(p_rules_overrides) <> 'object' then
			raise exception 'TDC (Error): the rule changes must be a json object.';
		end if;
		perform private.tdc_check_match_rules(v_league.rules || p_rules_overrides);
	end if;

	-- Dates belong to the season row, which other leagues may share. Moving a
	-- shared period under someone else's league is refused rather than done.
	if p_clear_dates or p_starts_on is not null or p_ends_on is not null then
		select count(*) into v_shared from public.tbl_league_seasons where season_id = v_s.season_id;
		if v_shared > 1 then
			raise exception 'This period is shared with other leagues, so its dates cannot be changed from here.';
		end if;

		-- p_clear_dates means "set exactly these", so a blank clears that one
		-- date. Without it a null keeps what is there.
		select case when p_clear_dates then p_starts_on else coalesce(p_starts_on, starts_on) end,
			case when p_clear_dates then p_ends_on else coalesce(p_ends_on, ends_on) end
		into v_start, v_end
		from public.tbl_seasons where id = v_s.season_id;

		-- Before the write: tbl_seasons_dates_in_order would refuse it anyway,
		-- but with a message no director can act on.
		if v_end < v_start then
			raise exception 'The season cannot end before it starts.';
		end if;

		update public.tbl_seasons
		set starts_on = v_start, ends_on = v_end
		where id = v_s.season_id;
	end if;

	if p_name is not null then
		if length(trim(p_name)) < 2 then
			raise exception 'The season needs a name of two characters or more.';
		end if;

		-- The period's name follows, unless another league shares the period.
		if (select count(*) from public.tbl_league_seasons where season_id = v_s.season_id) = 1 then
			update public.tbl_seasons set name = trim(p_name) where id = v_s.season_id;
		end if;
	end if;

	if p_entry_mode is not null and p_entry_mode not in ('ld_only', 'interested', 'self_confirm') then
		raise exception 'TDC (Error): unknown entry mode "%".', p_entry_mode;
	end if;

	update public.tbl_league_seasons
	set entry_mode    = coalesce(p_entry_mode, entry_mode),
		paid_confirms = coalesce(p_paid_confirms, paid_confirms),
		is_listed     = coalesce(p_is_listed, is_listed),
		name            = coalesce(trim(p_name), name),
		rules_overrides = coalesce(p_rules_overrides, rules_overrides),
		notes           = coalesce(p_notes, notes)
	where id = p_league_season_id;
end;
$function$

;
