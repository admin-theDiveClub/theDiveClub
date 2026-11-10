-- Short links for players (UV, 10 Nov; docs/design/short-links.md).
--
--   Yuvan-Naidoo       a player's first name and surname
--   Yuvan-Naidoo-2     the next person with that name
--
-- Full names so that a list of links can be searched elsewhere. Nobody chooses
-- one: it is built here from the names, and the browser has no grant to write
-- the column.
--
--   • The first to register keeps the plain name. Existing players are given
--     theirs oldest account first.
--   • It follows the name. Change your name and the link changes with it; the
--     old one stops working and anybody may have it. A save that leaves the name
--     as it was keeps the link, its number included.
--   • Only somebody with an account has one, so a walk-in can never hold a name
--     ahead of the person who later registers. Merging a walk-in gives them one.
--   • No first name or no surname, no link. The page offers the long address.
--
-- It cannot clash with the other short links. A name holds only letters, so it
-- is never all digits and never ends in a number but the one added here. A name
-- reading T- or L- would look like a tournament's or a league's code, so it gets
-- no link at all, which is why an initial is not enough for a first name.
--
-- A stranger must not be able to test names to learn who belongs to the club, so
-- tdc_resolve_short_code answers everybody signed out with the same "sign in"
-- for anything shaped like a name, found or not.

alter table public.tbl_players
	add column short_code text;

comment on column public.tbl_players.short_code is
	'The player''s short link, as shown (Yuvan-Naidoo, Yuvan-Naidoo-2). Built only by tdc_player_short_code_on_save. Null with no account or without a first name and surname. docs/design/short-links.md.';

-- Upper case because that is how tdc_resolve_short_code holds a code: any mix of
-- capitals in an address is the same player, and so the same name when taken.
create unique index tbl_players_short_code_key on public.tbl_players (upper(short_code));


-- ─────────────────────────────────────────────────────────────────
-- A name, as it goes in an address
--
-- Accents come off (José, Jose), apostrophes close up (O'Brien, OBrien), and
-- anything else that is not a letter becomes a dash (van der Merwe keeps its
-- three words). Capitals stay as written.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_player_link_part(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
	select nullif(btrim(regexp_replace(regexp_replace(
		translate(
			replace(replace(replace(replace(replace(p_name, 'ß', 'ss'), 'æ', 'ae'), 'Æ', 'Ae'), 'œ', 'oe'), 'Œ', 'Oe'),
			'àáâãäåāăąçćčďèéêëēėęěìíîïīįłñńňòóôõöøōŕřśšťùúûüūůųýÿžźżÀÁÂÃÄÅĀĂĄÇĆČĎÈÉÊËĒĖĘĚÌÍÎÏĪĮŁÑŃŇÒÓÔÕÖØŌŔŘŚŠŤÙÚÛÜŪŮŲÝŸŽŹŻ',
			'aaaaaaaaacccdeeeeeeeeiiiiiilnnnoooooooorrsstuuuuuuuyyzzzAAAAAAAAACCCDEEEEEEEEIIIIIILNNNOOOOOOORRSSTUUUUUUUYYZZZ'
		),
		'[''’‘`]', '', 'g'),
		'[^A-Za-z]+', '-', 'g'),
		'-'), '');
$$;

revoke execute on function private.tdc_player_link_part(text) from public, anon, authenticated;

-- Null means this name cannot have a link.
create function private.tdc_player_link_name(p_first text, p_last text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_first text := private.tdc_player_link_part(p_first);
	v_last text := private.tdc_player_link_part(p_last);
begin
	if v_first is null or v_last is null or length(v_first) < 2 or length(v_last) < 2 then
		return null;
	end if;

	-- T-Smith would be read as a tournament's code.
	if v_first ~* '^[TL]-' then
		return null;
	end if;

	return v_first || '-' || v_last;
end;
$$;

revoke execute on function private.tdc_player_link_name(text, text) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Keeping it right
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_player_short_code_on_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name text := private.tdc_player_link_name(new.first_name, new.last_name);
	v_code text;
	v_number integer := 1;
begin
	if new.user_id is null or v_name is null then
		new.short_code := null;
		return new;
	end if;

	-- The same name: the number stays, only its capitals can have changed.
	if tg_op = 'UPDATE' and upper(regexp_replace(old.short_code, '-[0-9]+$', '')) = upper(v_name) then
		new.short_code := v_name || coalesce(substring(old.short_code from '-[0-9]+$'), '');
		return new;
	end if;

	-- Two people with one name registering together wait for each other here,
	-- since a clash on the index would fail somebody's sign-up.
	perform pg_advisory_xact_lock(hashtext('tdc_player_short_code:' || upper(v_name)));

	v_code := v_name;
	while exists (
		select 1 from public.tbl_players p
		where upper(p.short_code) = upper(v_code) and p.id <> new.id
	) loop
		v_number := v_number + 1;
		v_code := v_name || '-' || v_number;
	end loop;

	new.short_code := v_code;
	return new;
end;
$$;

revoke execute on function private.tdc_player_short_code_on_save() from public, anon, authenticated;

create trigger tbl_players_short_code
	before insert or update of first_name, last_name, user_id on public.tbl_players
	for each row execute function private.tdc_player_short_code_on_save();

-- Everybody already here, oldest first, so the first to register has the plain
-- name. Writing a name onto itself is what fires the trigger.
do $$
declare
	r record;
begin
	for r in select id from public.tbl_players order by created_at, id loop
		update public.tbl_players set first_name = first_name where id = r.id;
	end loop;
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- What a page shows. 20261109114638's, with the player's part added.
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

	-- The name is for the people running it, who are told who can change it.
	-- A stranger on a poster has no need of it.
	if coalesce(v_runs, false) then
		select p.display_name into v_set_by from public.tbl_players p where p.user_id = v_by;
	end if;

	return jsonb_build_object(
		'code', v_code,
		'can_change', v_uid is not null and v_by = v_uid and coalesce(v_runs, false),
		'set_by', v_set_by
	);
end;
$$;

revoke execute on function public.tdc_short_link(text, uuid) from public;
grant execute on function public.tdc_short_link(text, uuid) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Following a link. 20261110075409's, with names added.
-- ─────────────────────────────────────────────────────────────────

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
	-- Two names of 100 characters, a dash and a number.
	if length(v_code) > 210 then
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
		if v_code ~ '^[TL]-' or v_code !~ '^[A-Z]+(-[A-Z]+)+(-[0-9]{1,9})?$' then
			return jsonb_build_object('reason', 'invalid');
		end if;

		-- A player's name. Signed out the answer is the same found or not.
		if v_uid is null then
			return jsonb_build_object('reason', 'sign_in');
		end if;

		select p.id into v_id from public.tbl_players p where upper(p.short_code) = v_code;
		if v_id is null then
			return jsonb_build_object('reason', 'no_player');
		end if;
		return jsonb_build_object('path', '/players/?p=' || v_id);
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
