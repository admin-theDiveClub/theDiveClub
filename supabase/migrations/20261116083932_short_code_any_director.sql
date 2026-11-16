-- Any director may change a league's or tournament's short code (UV, 16 Nov).
--
-- Replaces the 9 Nov rule "only whoever set it, and only while they still run
-- it": a league had one LD who could change its code and every other LD saw
-- "Only <name> can change this code". Now whoever runs it may: for a league
-- private.tdc_can_manage_league (every LD, its creator, the venue's owner, admins
-- and staff), for a tournament private.tdc_can_run_tournament (every TD, the
-- venue's owner, admins and staff). The same people who see the Settings tab.
--
-- short_code_by now records who changed the code last, written on each save.
--
--   1. public.tdc_set_short_code   20261109114638's, the check and the save changed
--   2. public.tdc_short_link       20261110084238's, can_change changed
--
-- docs/design/short-links.md; DECISIONS 16 Nov.

comment on column public.tbl_tournaments.short_code_by is
	'Whoever changed short_code last. Starts as whoever created the tournament. Anybody who runs it may change the code (UV, 16 Nov).';
comment on column public.tbl_leagues.short_code_by is
	'Whoever changed short_code last. Starts as whoever created the league. Anybody who runs it may change the code (UV, 16 Nov).';


-- ─────────────────────────────────────────────────────────────────
-- 1. Changing one
--
-- Anybody who runs it (UV, 16 Nov). The old code is released at once: nothing
-- remembers it.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_set_short_code(p_kind text, p_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := (select auth.uid());
	v_target record;
	v_code text := upper(btrim(coalesce(p_code, '')));
	v_by uuid;
	v_runs boolean;
	v_problem text;
begin
	if v_uid is null then
		raise exception 'Sign in to change a short link.';
	end if;

	select * into v_target from private.tdc_short_target(p_kind, p_id);

	if v_target.kind = 'tournament' then
		select t.short_code_by into v_by from public.tbl_tournaments t where t.id = v_target.id for update;
		v_runs := private.tdc_can_run_tournament(v_target.id);
	else
		select l.short_code_by into v_by from public.tbl_leagues l where l.id = v_target.id for update;
		v_runs := private.tdc_can_manage_league(v_target.id);
	end if;

	if not coalesce(v_runs, false) then
		raise exception 'Only whoever runs it may change its short link.';
	end if;

	v_problem := private.tdc_short_code_problem(v_target.kind, v_target.id, v_code);
	if v_problem = 'taken' then raise exception 'That code is taken. Try another.'; end if;
	if v_problem = 'too_short' then raise exception 'A code needs at least 2 characters.'; end if;
	if v_problem = 'too_long' then raise exception 'A code can have at most 8 characters.'; end if;
	if v_problem = 'blocked' then raise exception 'That code is not allowed. Try another.'; end if;
	if v_problem is not null then raise exception 'A code can only have letters and numbers.'; end if;

	begin
		if v_target.kind = 'tournament' then
			update public.tbl_tournaments set short_code = v_code, short_code_by = v_uid where id = v_target.id;
		else
			update public.tbl_leagues set short_code = v_code, short_code_by = v_uid where id = v_target.id;
		end if;
	exception when unique_violation then
		raise exception 'That code is taken. Try another.';
	end;

	return v_code;
end;
$$;

revoke execute on function public.tdc_set_short_code(text, uuid, text) from public, anon;
grant execute on function public.tdc_set_short_code(text, uuid, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 2. What a page shows. 20261110084238's, with can_change following who runs it.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_short_link(p_kind text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := (select auth.uid());
	v_target record;
	v_code text;
	v_by uuid;
	v_runs boolean := false;
	v_number bigint;
	v_set_by text;
begin
	-- A signed-out visitor has no page to share this from, and a player's id must
	-- not turn into their name for a stranger.
	if p_kind = 'player' then
		if v_uid is null then
			raise exception 'Sign in to see a player''s short link.';
		end if;
		select p.short_code into v_code from public.tbl_players p where p.id = p_id;
		if not found then
			raise exception 'TDC (Error): that player could not be found.';
		end if;
		return jsonb_build_object('code', v_code, 'can_change', false, 'set_by', null);
	end if;

	if p_kind = 'match' then
		select 'T-' || t.short_code || '-' || f.match_number into v_code
			from public.tbl_tournament_fixtures f
			join public.tbl_tournaments t on t.id = f.tournament_id
			where f.match_id = p_id
			limit 1;

		if v_code is null then
			select 'L-' || l.short_code || '-' || f.match_number into v_code
				from public.tbl_league_fixtures f
				join public.tbl_league_seasons s on s.id = f.league_season_id
				join public.tbl_leagues l on l.id = s.league_id
				where f.match_id = p_id
				limit 1;
		end if;

		if v_code is null then
			select m.short_number into v_number from public.tbl_matches m where m.id = p_id;
			if v_number is null then
				raise exception 'TDC (Error): that match could not be found.';
			end if;
			v_code := v_number::text;
		end if;

		return jsonb_build_object('code', v_code, 'can_change', false, 'set_by', null);
	end if;

	select * into v_target from private.tdc_short_target(p_kind, p_id);

	if v_target.kind = 'tournament' then
		select 'T-' || t.short_code, t.short_code_by into v_code, v_by
			from public.tbl_tournaments t where t.id = v_target.id;
		if v_uid is not null then v_runs := private.tdc_can_run_tournament(v_target.id); end if;
	else
		select 'L-' || l.short_code, l.short_code_by into v_code, v_by
			from public.tbl_leagues l where l.id = v_target.id;
		if v_uid is not null then v_runs := private.tdc_can_manage_league(v_target.id); end if;
	end if;

	-- The name (who changed it last) is for the people running it. A stranger on
	-- a poster has no need of it.
	if coalesce(v_runs, false) then
		select p.display_name into v_set_by from public.tbl_players p where p.user_id = v_by;
	end if;

	return jsonb_build_object(
		'code', v_code,
		'can_change', v_uid is not null and coalesce(v_runs, false),
		'set_by', v_set_by
	);
end;
$$;

revoke execute on function public.tdc_short_link(text, uuid) from public;
grant execute on function public.tdc_short_link(text, uuid) to anon, authenticated;
