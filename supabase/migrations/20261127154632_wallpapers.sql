-- Wallpapers (UV, 27 Nov): the home page's table as a wallpaper for a TV at a
-- club or at home. Built first as sandbox pages (/sandbox/wallpaper/ and
-- /sandbox/wallpaper/edit/), to go on the main site afterwards (UV).
--
-- UV's rules:
--   * Only somebody signed in may make one; anybody may open it by its short
--     link, signed out (a TV, where signing in is close to impossible).
--   * One wallpaper per person, at most 8 pictures, looping in the middle of
--     the table. Each picture says how it is shown (fit). With none, the
--     club's logo, as on the home page.
--   * The colours of the cloth, the markings, the lines and the white ball,
--     and how one picture changes to the next.
--
-- The data:
--   * tbl_wallpapers, one row per account (user_id, unique). It references
--     auth.users, not tbl_players: a walk-in has no account and cannot make one,
--     so private.tdc_merge_players has nothing to carry.
--   * images is a jsonb list, in order, of {path, fit}: the pictures are only
--     ever saved as a whole set (the upload page's Save), so a table of their
--     own would add nothing. fit is 'fit' (the whole picture in the middle),
--     'fill' (fills the middle, cropped) or 'cloth' (fills the whole cloth,
--     cropped).
--   * A colour is '#rrggbb', or null for the site's own.
--   * transition is 'fade', 'slide', 'zoom' or 'cut'; seconds is how long each
--     picture shows, 3 to 300.
--   * short_code is made at the first save, as a competition's is suggested
--     (private.tdc_new_short_code, patched here to know wallpapers), and shown
--     as W-<code>. It cannot be chosen or changed.
--
-- The browser has no grant on the table. Writes go through
-- tdc_save_wallpaper, reads through tdc_my_wallpaper (its owner) and
-- tdc_wallpaper (anybody, by id: what the short link opens).
--
-- The pictures: a public bucket, wallpaper-pictures, built as the avatars
-- bucket is (migration player_avatars), for the same reasons. A TV is signed
-- out, so a signed URL is not possible anyway. The path is
-- <user id>/<random>.webp: only your own folder, said by the storage rules and
-- again by tdc_save_wallpaper. The browser shrinks (1920px, for a TV) and
-- re-encodes each picture before upload, which strips EXIF (a phone photo's GPS
-- position). A picture taken out of the set is deleted by the page after the
-- save, from the list tdc_save_wallpaper gives back.
--
-- The short link: tdc_resolve_short_code (latest in 20261110084238, patched
-- here) answers W-<code> before anything else that has a dash, signed in or
-- not, with /sandbox/wallpaper/?w=<id>. When the wallpaper moves to the main
-- site, that path changes in a new migration. W- now wins over a player whose
-- first name is the single letter W, as T- and L- already did.


-- ─────────────────────────────────────────────────────────────────
-- The table
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_wallpapers (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null unique references auth.users (id) on delete cascade,
	short_code text not null unique,
	images jsonb not null default '[]'::jsonb,
	cloth_colour text,
	markings_colour text,
	lines_colour text,
	cue_colour text,
	transition text not null default 'fade',
	seconds int not null default 10,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint tbl_wallpapers_images_list check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 8),
	constraint tbl_wallpapers_cloth_colour check (cloth_colour is null or cloth_colour ~ '^#[0-9a-f]{6}$'),
	constraint tbl_wallpapers_markings_colour check (markings_colour is null or markings_colour ~ '^#[0-9a-f]{6}$'),
	constraint tbl_wallpapers_lines_colour check (lines_colour is null or lines_colour ~ '^#[0-9a-f]{6}$'),
	constraint tbl_wallpapers_cue_colour check (cue_colour is null or cue_colour ~ '^#[0-9a-f]{6}$'),
	constraint tbl_wallpapers_transition check (transition in ('fade', 'slide', 'zoom', 'cut')),
	constraint tbl_wallpapers_seconds check (seconds between 3 and 300)
);

comment on table public.tbl_wallpapers is
	'A person''s wallpaper (UV, 27 Nov): the home page''s table, their pictures looping in the middle, their colours. One per account. Opened signed out by its short link, W-<short_code>.';
comment on column public.tbl_wallpapers.images is
	'In order: [{path, fit}]. path is an object in the public wallpaper-pictures bucket, <user id>/<random>.<ext>; fit is fit, fill or cloth. At most 8.';

alter table public.tbl_wallpapers enable row level security;
revoke all on table public.tbl_wallpapers from anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The pictures
-- ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'wallpaper-pictures',
	'wallpaper-pictures',
	true,
	4194304,
	array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "Anyone can see wallpaper pictures"
	on storage.objects
	for select
	to public
	using (bucket_id = 'wallpaper-pictures');

create policy "People can add their own wallpaper pictures"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'wallpaper-pictures'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "People can replace their own wallpaper pictures"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'wallpaper-pictures'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	)
	with check (
		bucket_id = 'wallpaper-pictures'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "People can remove their own wallpaper pictures"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'wallpaper-pictures'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);


-- ─────────────────────────────────────────────────────────────────
-- The code (patched from 20261109114638: the wallpaper branch only)
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_new_short_code(p_kind text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
	c_letters constant text := 'BCDFGHJKMNPQRSTVWXYZ23456789';
	v_code text;
	v_taken boolean;
begin
	loop
		select string_agg(substr(c_letters, 1 + floor(random() * length(c_letters))::int, 1), '')
			into v_code
			from generate_series(1, 5);

		if p_kind = 'tournament' then
			select exists (select 1 from public.tbl_tournaments where short_code = v_code) into v_taken;
		elsif p_kind = 'wallpaper' then
			select exists (select 1 from public.tbl_wallpapers where short_code = v_code) into v_taken;
		else
			select exists (select 1 from public.tbl_leagues where short_code = v_code) into v_taken;
		end if;

		exit when not v_taken;
	end loop;
	return v_code;
end;
$$;

revoke execute on function private.tdc_new_short_code(text) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Reading and saving
-- ─────────────────────────────────────────────────────────────────

-- What a wallpaper shows; the same shape for its owner and for the TV.
create function private.tdc_wallpaper_json(w public.tbl_wallpapers)
returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'id', w.id,
		'code', 'W-' || w.short_code,
		'images', w.images,
		'cloth_colour', w.cloth_colour,
		'markings_colour', w.markings_colour,
		'lines_colour', w.lines_colour,
		'cue_colour', w.cue_colour,
		'transition', w.transition,
		'seconds', w.seconds
	);
$$;

revoke execute on function private.tdc_wallpaper_json(public.tbl_wallpapers) from public, anon, authenticated;

-- Your own wallpaper, or null if you have not saved one.
create function public.tdc_my_wallpaper()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	w public.tbl_wallpapers;
begin
	if (select auth.uid()) is null then
		raise exception 'Sign in to make a wallpaper.';
	end if;
	select * into w from public.tbl_wallpapers where user_id = (select auth.uid());
	if w.id is null then
		return null;
	end if;
	return private.tdc_wallpaper_json(w);
end;
$$;

revoke execute on function public.tdc_my_wallpaper() from public, anon;
grant execute on function public.tdc_my_wallpaper() to authenticated;

-- A wallpaper by id, for anybody: what its short link opens. Null if none.
create function public.tdc_wallpaper(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	w public.tbl_wallpapers;
begin
	select * into w from public.tbl_wallpapers where id = p_id;
	if w.id is null then
		return null;
	end if;
	return private.tdc_wallpaper_json(w);
end;
$$;

revoke execute on function public.tdc_wallpaper(uuid) from public;
grant execute on function public.tdc_wallpaper(uuid) to anon, authenticated;

-- Saves your wallpaper whole: {images, cloth_colour, markings_colour,
-- lines_colour, cue_colour, transition, seconds}. A missing colour is the
-- site's own. The first save makes the wallpaper and its code. Returns the
-- wallpaper, plus 'removed': the paths no longer in it, for the page to delete.
create function public.tdc_save_wallpaper(p_settings jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
	v_uid uuid := (select auth.uid());
	v_images jsonb := coalesce(p_settings -> 'images', '[]'::jsonb);
	v_old jsonb;
	v_img jsonb;
	v_colour text;
	v_key text;
	v_removed jsonb;
	w public.tbl_wallpapers;
begin
	if v_uid is null then
		raise exception 'Sign in to make a wallpaper.';
	end if;
	if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
		raise exception 'TDC (Error): the wallpaper''s settings are missing.';
	end if;

	-- The pictures: a list of at most 8, each in your own folder, each shown one of three ways
	if jsonb_typeof(v_images) <> 'array' then
		raise exception 'TDC (Error): the wallpaper''s pictures must be a list.';
	end if;
	if jsonb_array_length(v_images) > 8 then
		raise exception 'A wallpaper takes at most 8 pictures.';
	end if;
	for v_img in select * from jsonb_array_elements(v_images) loop
		if jsonb_typeof(v_img) <> 'object'
			or jsonb_typeof(v_img -> 'path') <> 'string'
			or (v_img ->> 'path') not like v_uid::text || '/%'
			or (v_img ->> 'path') ~ '\.\.|//' then
			raise exception 'TDC (Error): a wallpaper picture must be in your own folder.';
		end if;
		if coalesce(v_img ->> 'fit', '') not in ('fit', 'fill', 'cloth') then
			raise exception 'TDC (Error): a picture is shown as fit, fill or cloth.';
		end if;
	end loop;
	-- Only the two keys are kept, whatever else the page sent
	select coalesce(jsonb_agg(jsonb_build_object('path', e ->> 'path', 'fit', e ->> 'fit') order by n), '[]'::jsonb)
		into v_images
		from jsonb_array_elements(v_images) with ordinality as x(e, n);

	-- The colours, said in words before the check constraints say it
	foreach v_key in array array['cloth_colour', 'markings_colour', 'lines_colour', 'cue_colour'] loop
		v_colour := lower(p_settings ->> v_key);
		if v_colour is not null and v_colour !~ '^#[0-9a-f]{6}$' then
			raise exception 'TDC (Error): % must be a colour like #1a2b3c.', v_key;
		end if;
	end loop;
	if coalesce(p_settings ->> 'transition', 'fade') not in ('fade', 'slide', 'zoom', 'cut') then
		raise exception 'TDC (Error): the change between pictures is fade, slide, zoom or cut.';
	end if;
	if coalesce((p_settings ->> 'seconds')::int, 10) not between 3 and 300 then
		raise exception 'Each picture shows for 3 to 300 seconds.';
	end if;

	select images into v_old from public.tbl_wallpapers where user_id = v_uid for update;

	insert into public.tbl_wallpapers as t (
		user_id, short_code, images,
		cloth_colour, markings_colour, lines_colour, cue_colour,
		transition, seconds
	) values (
		v_uid, private.tdc_new_short_code('wallpaper'), v_images,
		lower(p_settings ->> 'cloth_colour'), lower(p_settings ->> 'markings_colour'),
		lower(p_settings ->> 'lines_colour'), lower(p_settings ->> 'cue_colour'),
		coalesce(p_settings ->> 'transition', 'fade'), coalesce((p_settings ->> 'seconds')::int, 10)
	)
	on conflict (user_id) do update set
		images = excluded.images,
		cloth_colour = excluded.cloth_colour,
		markings_colour = excluded.markings_colour,
		lines_colour = excluded.lines_colour,
		cue_colour = excluded.cue_colour,
		transition = excluded.transition,
		seconds = excluded.seconds,
		updated_at = now()
		-- short_code is kept: the TV's link never changes
	returning * into w;

	select coalesce(jsonb_agg(o ->> 'path'), '[]'::jsonb)
		into v_removed
		from jsonb_array_elements(coalesce(v_old, '[]'::jsonb)) o
		where not exists (
			select 1 from jsonb_array_elements(v_images) n where n ->> 'path' = o ->> 'path'
		);

	return private.tdc_wallpaper_json(w) || jsonb_build_object('removed', v_removed);
end;
$$;

revoke execute on function public.tdc_save_wallpaper(jsonb) from public, anon;
grant execute on function public.tdc_save_wallpaper(jsonb) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The short link (patched from 20261110084238: the W- branch only)
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

	-- A wallpaper (UV, 27 Nov): W- and its code, for anybody, signed in or not
	-- (a TV). Before the player names, which a W- code would otherwise look like.
	if v_code ~ '^W-[A-Z0-9]{2,8}$' then
		select w.id into v_id from public.tbl_wallpapers w where w.short_code = substr(v_code, 3);
		if v_id is null then
			return jsonb_build_object('reason', 'not_found');
		end if;
		return jsonb_build_object('path', '/sandbox/wallpaper/?w=' || v_id);
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
