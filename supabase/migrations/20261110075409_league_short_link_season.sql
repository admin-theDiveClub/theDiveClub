-- A league's short link opens its season page, for everybody (UV, 10 Nov).
--
-- The league join page is gone: the season page is the one page for a league,
-- whether or not you are in it (docs/DECISIONS.md, 10 Nov). Until now this
-- sent somebody not in the league to /leagues/join/. The function is
-- 20261109114638's, with only that ending changed.

create or replace function public.tdc_resolve_short_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_code text := upper(btrim(coalesce(p_code, '')));
	v_uid uuid := (select auth.uid());
	v_me uuid;
	v_parts text[];
	v_kind text;
	v_id uuid;
	v_season uuid;
	v_match uuid;
	v_shared boolean;
	v_part_of boolean := false;
begin
	if length(v_code) > 24 then
		return jsonb_build_object('reason', 'invalid');
	end if;

	if v_uid is not null then
		v_me := private.tdc_me();
	end if;

	-- A social match: digits and nothing else.
	if v_code ~ '^[0-9]{1,15}$' then
		select m.id into v_match
			from public.tbl_matches m
			where m.short_number = v_code::bigint
				and not exists (select 1 from public.tbl_tournament_fixtures f where f.match_id = m.id)
				and not exists (select 1 from public.tbl_league_fixtures f where f.match_id = m.id);

		if v_match is null then
			return jsonb_build_object('reason', 'not_found');
		end if;
		return jsonb_build_object('path', '/match/?id=' || v_match);
	end if;

	v_parts := regexp_match(v_code, '^([TL])-([A-Z0-9]{2,8})(?:-([0-9]{1,9}))?$');
	if v_parts is null then
		return jsonb_build_object('reason', 'invalid');
	end if;

	v_kind := v_parts[1];

	if v_kind = 'T' then
		select t.id into v_id from public.tbl_tournaments t where t.short_code = v_parts[2];
	else
		select l.id into v_id from public.tbl_leagues l where l.short_code = v_parts[2];
	end if;

	if v_id is null then
		return jsonb_build_object('reason', 'not_found');
	end if;

	-- A match inside it.
	if v_parts[3] is not null then
		if v_kind = 'T' then
			select f.match_id into v_match
				from public.tbl_tournament_fixtures f
				where f.tournament_id = v_id and f.match_number = v_parts[3]::int;
			if v_match is null then
				return jsonb_build_object('reason', 'no_such_match');
			end if;
			return jsonb_build_object('path', '/match/?id=' || v_match);
		end if;

		select f.match_id into v_match
			from public.tbl_league_fixtures f
			join public.tbl_league_seasons s on s.id = f.league_season_id
			where s.league_id = v_id and f.match_number = v_parts[3]::int
			limit 1;
		if v_match is null then
			return jsonb_build_object('reason', 'no_such_match');
		end if;
		return jsonb_build_object('path', '/leagues/card/?m=' || v_match);
	end if;

	if v_kind = 'T' then
		if v_uid is not null then
			v_part_of := private.tdc_can_run_tournament(v_id)
				or private.tdc_competition_rank(v_id) > 0
				or exists (
					select 1 from public.tbl_tournament_entrants e
					where e.tournament_id = v_id and e.player_id = v_me and e.status <> 'withdrawn'
				);
		end if;

		if coalesce(v_part_of, false) then
			return jsonb_build_object('path', '/tournaments/bracket/?t=' || v_id);
		end if;

		select p.is_public into v_shared from public.tbl_tournament_posters p where p.tournament_id = v_id;
		if not coalesce(v_shared, false) then
			return jsonb_build_object('reason', 'poster_not_shared');
		end if;
		return jsonb_build_object('path', '/tournaments/poster/?t=' || v_id);
	end if;

	-- A league opens its newest season.
	select s.id into v_season
		from public.tbl_league_seasons s
		where s.league_id = v_id
		order by s.created_at desc, s.id
		limit 1;

	if v_season is null then
		return jsonb_build_object('reason', 'no_season');
	end if;

	return jsonb_build_object('path', '/leagues/season/?s=' || v_season);
end;
$$;

revoke execute on function public.tdc_resolve_short_code(text) from public;
grant execute on function public.tdc_resolve_short_code(text) to anon, authenticated;
