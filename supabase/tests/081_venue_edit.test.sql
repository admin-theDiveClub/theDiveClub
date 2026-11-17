-- A venue's page and its Settings tab (migration venue_page_edit, 17 Nov).
--
--   tdc_venue names the venue's people: the owner to everybody, admins and
--     staff only to somebody signed in, owner first; and says whether the
--     caller may edit it (i_manage), never null
--   one check decides who may edit a venue: its owner or admin, or the site
--     owner (The Dive Club's owner), for the details, the hours, the picture
--     and the picture's storage rules
--   the site owner's exception is details only: choosing the venue for a
--     competition still takes its own owner or admin
--   the hours are written a week at once and checked
--   tdc_venue_competitions sends a league's picture
begin;
\ir _helpers.psql
select plan(38);

select tests.create_user('Ve Owner') as owner \gset
select tests.create_user('Ve Admin') as admin \gset
select tests.create_user('Ve Staff') as staff \gset
select tests.create_user('Ve Stranger') as stranger \gset
select tests.create_user('Ve Site') as site \gset
select tests.create_user('Ve DC Staff') as dcstaff \gset

insert into public.tbl_venues (name, slug) values ('Edit Club', 'edit-club') returning id as club, timezone as club_tz \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values
	(:'club', :'owner', 'owner'), (:'club', :'admin', 'admin'), (:'club', :'staff', 'staff');
insert into public.tbl_venue_staff (venue_id, user_id, role)
select v.id, :'site', 'owner' from public.tbl_venues v where v.slug = 'the-dive-club';
insert into public.tbl_venue_staff (venue_id, user_id, role)
select v.id, :'dcstaff', 'staff' from public.tbl_venues v where v.slug = 'the-dive-club';


-- ─── The people ───

select tests.sign_in_anon();
select is((select array_agg(x ->> 'role') from jsonb_array_elements(public.tdc_venue(:'club') -> 'people') x),
	array['owner'], 'signed out, only the owner is named');
select is((public.tdc_venue(:'club') -> 'people' -> 0 ->> 'display_name'), 'Ve Owner', 'with their name');
select ok((public.tdc_venue(:'club') -> 'people' -> 0) ? 'player_id' and (public.tdc_venue(:'club') -> 'people' -> 0) ? 'avatar_path',
	'their player id and picture, for the link and the face');
select is((public.tdc_venue(:'club') ->> 'timezone'), :'club_tz',
	'the venue''s timezone, for "Open now"');

select tests.sign_in(:'stranger');
select is((select array_agg(x ->> 'role') from jsonb_array_elements(public.tdc_venue(:'club') -> 'people') x),
	array['owner', 'admin', 'staff'], 'signed in, everybody, owner first');


-- ─── i_manage ───

select tests.sign_in_anon();
select is((public.tdc_venue(:'club') -> 'i_manage'), 'false'::jsonb, 'signed out: false, not null');
select tests.sign_in(:'stranger');
select is((public.tdc_venue(:'club') -> 'i_manage'), 'false'::jsonb, 'a stranger: false');
select tests.sign_in(:'staff');
select is((public.tdc_venue(:'club') -> 'i_manage'), 'false'::jsonb, 'its staff: false');
select tests.sign_in(:'admin');
select is((public.tdc_venue(:'club') -> 'i_manage'), 'true'::jsonb, 'its admin: true');
select tests.sign_in(:'owner');
select is((public.tdc_venue(:'club') -> 'i_manage'), 'true'::jsonb, 'its owner: true');
select tests.sign_in(:'site');
select is((public.tdc_venue(:'club') -> 'i_manage'), 'true'::jsonb, 'the site owner: true at any venue');
select tests.sign_in(:'dcstaff');
select is((public.tdc_venue(:'club') -> 'i_manage'), 'false'::jsonb, 'The Dive Club''s staff are not the site owner');


-- ─── The details ───

select tests.sign_in(:'site');
select lives_ok(format($$ select public.tdc_update_venue(%L, p_description => 'Set by the site', p_table_count => 4) $$, :'club'),
	'the site owner may change another venue''s details');
select tests.sign_out();
select is((select description from public.tbl_venues where id = :'club'), 'Set by the site', 'and they are saved');

select tests.sign_in(:'dcstaff');
select throws_ok(format($$ select public.tdc_update_venue(%L, p_description => 'No') $$, :'club'),
	'Only an owner or admin of this venue can change its details.', 'The Dive Club''s staff may not');
select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_update_venue(%L, p_description => 'No') $$, :'club'),
	'Only an owner or admin of this venue can change its details.', 'nor the venue''s own staff');
select tests.sign_in(:'admin');
select lives_ok(format($$ select public.tdc_update_venue(%L, p_description => 'Admin''s words') $$, :'club'),
	'its admin still may');


-- ─── The hours ───

select tests.sign_in(:'owner');
select lives_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club',
	'[{"day": 5, "opens": "12:00", "closes": "02:00"}, {"day": 1, "opens": "09:00", "closes": "12:00"}, {"day": 1, "opens": "14:00", "closes": "22:30"}]'),
	'its owner sets the week');
select is((public.tdc_venue(:'club') -> 'hours'),
	'[{"day": 1, "opens": "09:00", "closes": "12:00"}, {"day": 1, "opens": "14:00", "closes": "22:30"}, {"day": 5, "opens": "12:00", "closes": "02:00"}]'::jsonb,
	'read back in order, a day with two times and one past midnight');

select lives_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club', '[{"day": 7, "opens": "10:00", "closes": "18:00"}]'),
	'saved again');
select is((select count(*)::integer from public.tbl_venue_hours where venue_id = :'club'), 1, 'the whole week is replaced');

select throws_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club', '[{"day": 2, "opens": "10:00", "closes": "10:00"}]'),
	'Tuesday opens and closes at the same time.', 'a day cannot open and close at once');
select throws_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club',
	'[{"day": 3, "opens": "10:00", "closes": "12:00"}, {"day": 3, "opens": "10:00", "closes": "14:00"}]'),
	'Two opening times on one day start at the same time.', 'nor two times start together');
select throws_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club', '[{"day": 8, "opens": "10:00", "closes": "12:00"}]'),
	'TDC (Error): a day must be 1 (Monday) to 7 (Sunday), not 8.', 'a day past Sunday');
select throws_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club', '[{"day": 1, "opens": "25:00", "closes": "12:00"}]'),
	'TDC (Error): an opening time came in a shape the database does not know: {"day": 1, "opens": "25:00", "closes": "12:00"}',
	'a time that is not one');
select throws_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club', '{"day": 1}'),
	'TDC (Error): the hours must be a list.', 'not a list');
select is((select count(*)::integer from public.tbl_venue_hours where venue_id = :'club'), 1, 'a refused save changes nothing');

select lives_ok(format($$ select public.tdc_set_venue_hours(%L, '[]') $$, :'club'), 'an empty week');
select is((public.tdc_venue(:'club') -> 'hours'), '[]'::jsonb, 'clears every day');

select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_set_venue_hours(%L, '[]') $$, :'club'),
	'Only an owner or admin of this venue can change its hours.', 'its staff may not');
select tests.sign_in(:'site');
select lives_ok(format($$ select public.tdc_set_venue_hours(%L, %L) $$, :'club', '[{"day": 6, "opens": "10:00", "closes": "23:00"}]'),
	'the site owner may');
select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_set_venue_hours(%L, '[]') $$, :'club'), '42501', null,
	'somebody signed out cannot call it at all');


-- ─── The picture ───

select tests.sign_in(:'site');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('venue-pictures', %L) $$, :'club' || '/a.webp'),
	'the site owner may upload into another venue''s folder');
select lives_ok(format($$ select public.tdc_set_venue_picture(%L, %L) $$, :'club', :'club' || '/a.webp'),
	'and name it on the venue');
select tests.sign_in(:'dcstaff');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('venue-pictures', %L) $$, :'club' || '/b.webp'),
	'42501', null, 'The Dive Club''s staff may not upload');
select throws_ok(format($$ select public.tdc_set_venue_picture(%L, null) $$, :'club'),
	'Only an owner or admin of this venue can change its picture.', 'nor change the picture');


-- ─── Details only: choosing the venue stays with its own owner or admin ───

select tests.sign_in(:'site');
select public.tdc_create_league('Site League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select throws_ok(format($$ select public.tdc_set_league_season_venues(%L, array[%L]::uuid[]) $$, :'season', :'club'),
	'Only an owner or admin of a venue can choose it.', 'the site owner may not list another venue as played at');


-- ─── A league's picture on the venue's list ───

select tests.sign_in(:'owner');
select public.tdc_create_league('Club League', tests.rules('{"team_size": 2}'), :'club') as cleague \gset
select public.tdc_create_league_season(:'cleague', 'Spring') as cseason \gset
select tests.sign_out();
update public.tbl_league_seasons set is_listed = true where id = :'cseason';
update public.tbl_leagues set picture_path = :'cleague' || '/p.webp' where id = :'cleague';
select tests.sign_in_anon();
select is((public.tdc_venue_competitions(:'club') -> 'leagues' -> 0 ->> 'picture_path'), :'cleague' || '/p.webp',
	'each league on the venue''s list carries its picture');

select * from finish();
rollback;
