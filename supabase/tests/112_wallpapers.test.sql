-- Wallpapers (migration 20261127154632_wallpapers).
--
-- UV, 27 Nov:
--   • only somebody signed in may make one; anybody opens it by its short link
--   • one wallpaper per person, at most 8 pictures, each with how it is shown
--   • the cloth, markings, lines and white ball colours, and the change between pictures
begin;
\ir _helpers.psql
select plan(32);

select tests.create_user('Wall Una') as una \gset
select tests.create_user('Wall Ben') as ben \gset

-- ─── Signed out ───

select tests.sign_in_anon();
select throws_ok($$ select public.tdc_save_wallpaper('{}') $$, '42501', null,
	'signed out, nobody may save a wallpaper');
select throws_ok($$ select public.tdc_my_wallpaper() $$, '42501', null,
	'signed out, there is no "my wallpaper"');
select tests.sign_out();

select is((select count(*) from information_schema.role_table_grants
	where table_name = 'tbl_wallpapers' and grantee in ('anon', 'authenticated'))::int, 0,
	'the browser has no grant on the table');

-- ─── The first save ───

select tests.sign_in(:'una');
select is(public.tdc_my_wallpaper(), null, 'before saving, there is none');

select public.tdc_save_wallpaper(jsonb_build_object(
	'images', jsonb_build_array(
		jsonb_build_object('path', :'una' || '/a.webp', 'fit', 'fit', 'extra', 'dropped'),
		jsonb_build_object('path', :'una' || '/b.webp', 'fit', 'cloth')),
	'cloth_colour', '#1A2B3C',
	'transition', 'slide',
	'seconds', 7)) as first \gset

select ok((:'first'::jsonb ->> 'code') ~ '^W-[B-DF-HJKMNP-TV-Z2-9]{5}$', 'the first save makes a W- code');
select is((:'first'::jsonb -> 'images' -> 0), jsonb_build_object('path', :'una' || '/a.webp', 'fit', 'fit'),
	'a picture keeps only its path and fit');
select is(jsonb_array_length(:'first'::jsonb -> 'images'), 2, 'both pictures are kept, in order');
select is(:'first'::jsonb ->> 'cloth_colour', '#1a2b3c', 'a colour is kept in small letters');
select is(:'first'::jsonb ->> 'lines_colour', null, 'a colour not given is the site''s own');
select is(:'first'::jsonb ->> 'transition', 'slide', 'the change between pictures is kept');
select is((:'first'::jsonb ->> 'seconds')::int, 7, 'the seconds are kept');
select is(:'first'::jsonb -> 'removed', '[]'::jsonb, 'nothing removed at the first save');
select is(public.tdc_my_wallpaper() ->> 'id', :'first'::jsonb ->> 'id', 'it is now my wallpaper');

-- ─── Saving again ───

select public.tdc_save_wallpaper(jsonb_build_object(
	'images', jsonb_build_array(jsonb_build_object('path', :'una' || '/b.webp', 'fit', 'fill')))) as second \gset

select is(:'second'::jsonb ->> 'id', :'first'::jsonb ->> 'id', 'one wallpaper per person: the same one again');
select is(:'second'::jsonb ->> 'code', :'first'::jsonb ->> 'code', 'its code never changes');
select is(:'second'::jsonb -> 'removed', jsonb_build_array(:'una' || '/a.webp'),
	'a picture taken out is given back to be deleted');
select is(:'second'::jsonb ->> 'transition', 'fade', 'left out, the change is a fade');
select is((:'second'::jsonb ->> 'seconds')::int, 10, 'left out, 10 seconds');
select tests.sign_out();
select is((select count(*) from public.tbl_wallpapers where user_id = :'una')::int, 1, 'still one row');
select tests.sign_in(:'una');

-- ─── Refused ───

select throws_ok(format($$ select public.tdc_save_wallpaper(jsonb_build_object('images',
	(select jsonb_agg(jsonb_build_object('path', %L || '/' || n || '.webp', 'fit', 'fit')) from generate_series(1, 9) n))) $$, :'una'),
	'A wallpaper takes at most 8 pictures.', 'nine pictures are refused');
select throws_ok(format($$ select public.tdc_save_wallpaper(jsonb_build_object('images',
	jsonb_build_array(jsonb_build_object('path', %L || '/x.webp', 'fit', 'fit')))) $$, :'ben'),
	'TDC (Error): a wallpaper picture must be in your own folder.', 'another person''s folder is refused');
select throws_ok(format($$ select public.tdc_save_wallpaper(jsonb_build_object('images',
	jsonb_build_array(jsonb_build_object('path', %L || '/../x.webp', 'fit', 'fit')))) $$, :'una'),
	'TDC (Error): a wallpaper picture must be in your own folder.', 'a path climbing out of the folder is refused');
select throws_ok(format($$ select public.tdc_save_wallpaper(jsonb_build_object('images',
	jsonb_build_array(jsonb_build_object('path', %L || '/x.webp', 'fit', 'stretch')))) $$, :'una'),
	'TDC (Error): a picture is shown as fit, fill or cloth.', 'an unknown fit is refused');
select throws_ok($$ select public.tdc_save_wallpaper('{"cloth_colour": "red"}') $$,
	'TDC (Error): cloth_colour must be a colour like #1a2b3c.', 'a colour by name is refused');
select throws_ok($$ select public.tdc_save_wallpaper('{"transition": "spin"}') $$,
	'TDC (Error): the change between pictures is fade, slide, zoom or cut.', 'an unknown change is refused');
select throws_ok($$ select public.tdc_save_wallpaper('{"seconds": 1}') $$,
	'Each picture shows for 3 to 300 seconds.', 'one second is refused');
select is(jsonb_array_length(public.tdc_my_wallpaper() -> 'images'), 1, 'a refused save changes nothing');

-- ─── Another person ───

select tests.sign_in(:'ben');
select is(public.tdc_my_wallpaper(), null, 'somebody else does not see mine as theirs');
select tests.sign_out();

-- ─── Opening it signed out: by id and by its short link ───

select tests.sign_in_anon();
select is(public.tdc_wallpaper((:'first'::jsonb ->> 'id')::uuid) ->> 'code', :'first'::jsonb ->> 'code',
	'signed out, a wallpaper opens by its id');
select is(public.tdc_wallpaper(gen_random_uuid()), null, 'an id that is not a wallpaper gives nothing');
select is(public.tdc_resolve_short_code(lower(:'first'::jsonb ->> 'code')),
	jsonb_build_object('path', '/sandbox/wallpaper/?w=' || (:'first'::jsonb ->> 'id')),
	'signed out, its short link opens the wallpaper, in any case');
select is(public.tdc_resolve_short_code('W-ZZZZ9'), '{"reason": "not_found"}'::jsonb,
	'a W- code that is nobody''s is not found');
select tests.sign_out();

select * from finish();
rollback;
