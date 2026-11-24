-- A tournament's picture (migration tournament_pictures, 24 Nov): whoever may
-- run the tournament sets it and uploads into its folder; nobody else. The
-- poster returns it live, beside the snapshot, to a signed-out visitor too,
-- and only when it returns the poster at all.
begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('TPic TD') as td \gset
select tests.create_user('TPic Stranger') as stranger \gset

select tests.sign_in(:'td');
select public.tdc_create_tournament('TPic Cup', tests.rules()) as t \gset
select public.tdc_create_tournament('TPic Private', tests.rules()) as t2 \gset

select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('tournament-pictures', %L) $$, :'t' || '/a.webp'),
	'its director may upload into the tournament''s folder');
select is(public.tdc_set_tournament_picture(:'t', :'t' || '/a.webp'), null, 'setting the first picture returns no old one');
select is(public.tdc_set_tournament_picture(:'t', :'t' || '/b.webp'), :'t' || '/a.webp', 'setting another returns the one it replaced');
select throws_ok(format($$ select public.tdc_set_tournament_picture(%L, 'elsewhere/c.webp') $$, :'t'),
	'P0001', 'TDC (Error): a tournament''s picture must be in its own folder.', 'a picture outside the tournament''s folder is refused');

-- A shared poster built before the picture was last changed.
select public.tdc_publish_poster(:'t', p_public => true);
select public.tdc_set_tournament_picture(:'t2', :'t2' || '/p.webp');
select public.tdc_publish_poster(:'t2', p_public => false);
select public.tdc_set_tournament_picture(:'t', :'t' || '/live.webp');
select is((select picture_path from public.tdc_tournament_poster(:'t')), :'t' || '/live.webp',
	'the poster shows the picture set after it was built: live, not from the snapshot');
select tests.sign_out();

select tests.sign_in_anon();
select is((select picture_path from public.tdc_tournament_poster(:'t')), :'t' || '/live.webp', 'a signed-out visitor reads it on a shared poster');
select is((select count(*) from public.tdc_tournament_poster(:'t2')), 0::bigint, 'and nothing at all of an unshared one');
select throws_ok(format($$ select public.tdc_set_tournament_picture(%L, null) $$, :'t'),
	'42501', null, 'a signed-out visitor may not set it');
select tests.sign_out();

select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_set_tournament_picture(%L, %L) $$, :'t', :'t' || '/d.webp'),
	'P0001', 'Only the people running this tournament can change its picture.', 'a stranger may not set it');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('tournament-pictures', %L) $$, :'t' || '/e.webp'),
	'42501', null, 'nor upload into its folder');
select tests.sign_out();

select tests.sign_in(:'td');
select is(public.tdc_set_tournament_picture(:'t', null), :'t' || '/live.webp', 'clearing it returns the last one');
select tests.sign_out();

select is((select picture_path from public.tbl_tournaments where id = :'t'), null, 'the picture is cleared');

select * from finish();
rollback;
