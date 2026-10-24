-- A league's picture (migration 20261024202149): whoever may manage the league
-- sets it and uploads into its folder; nobody else.
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('LPic LD') as ld \gset
select tests.create_user('LPic Stranger') as stranger \gset

select tests.sign_in(:'ld');
select public.tdc_create_league('LPic League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset

select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('league-pictures', %L) $$, :'league' || '/a.webp'),
	'its director may upload into the league''s folder');
select is(public.tdc_set_league_picture(:'league', :'league' || '/a.webp'), null, 'setting the first picture returns no old one');
select is(public.tdc_set_league_picture(:'league', :'league' || '/b.webp'), :'league' || '/a.webp', 'setting another returns the one it replaced');
select throws_ok(format($$ select public.tdc_set_league_picture(%L, 'elsewhere/c.webp') $$, :'league'),
	'P0001', 'TDC (Error): a league''s picture must be in its own folder.', 'a picture outside the league''s folder is refused');
select is(public.tdc_set_league_picture(:'league', null), :'league' || '/b.webp', 'clearing it returns the last one');

select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_set_league_picture(%L, %L) $$, :'league', :'league' || '/d.webp'),
	'P0001', 'Only the people running this league can change its picture.', 'a stranger may not set it');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('league-pictures', %L) $$, :'league' || '/e.webp'),
	'42501', null, 'nor upload into its folder');
select tests.sign_out();

select is((select picture_path from public.tbl_leagues where id = :'league'), null, 'the picture is cleared');

select * from finish();
rollback;
