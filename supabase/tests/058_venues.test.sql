-- Venues, step 1 (migration venues_details_and_places, 5 Nov).
--
--   the venue a competition belongs to gives rights and is guarded: a league
--     takes an owner or admin, a tournament staff as well
--   the venues it is played at give no rights to anybody, and whoever runs it
--     may list any active one
--   a season's list follows to the next season; a fixture names its own venue
--     or takes the season's, and never touches the match's venue
--   signed out, a venue's display details are readable through the functions
--     and nowhere else; its owner or admin edits them
begin;
\ir _helpers.psql
select plan(62);

select tests.create_user('Ven Owner') as owner \gset
select tests.create_user('Ven Admin') as admin \gset
select tests.create_user('Ven Staff') as staff \gset
select tests.create_user('Ven Stranger') as stranger \gset
select tests.create_user('Ven H1') as h1 \gset
select tests.create_user('Ven A1') as a1 \gset

insert into public.tbl_venues (name, slug) values ('Club One', 'club-one') returning id as one \gset
insert into public.tbl_venues (name, slug) values ('Club Two', 'club-two') returning id as two \gset
insert into public.tbl_venues (name, slug, active) values ('Closed Club', 'closed-club', false) returning id as closed \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values
	(:'one', :'owner', 'owner'), (:'one', :'admin', 'admin'), (:'one', :'staff', 'staff');


-- ─── The seed ───

select is((select address || ' / ' || area || ' / ' || city from public.tbl_venues where slug = 'the-dive-club'),
	'C5, The Gantry / Lonehill, Fourways / Johannesburg', 'The Dive Club has its address');
select is((select table_count from public.tbl_venues where slug = 'billiard-cafe-rivonia'), 24, 'Rivonia is seeded');
select is((select area from public.tbl_venues where slug = 'billiard-cafe-randpark-ridge'), 'Randpark Ridge', 'Randpark Ridge is seeded');
select is((public.tdc_venue((select id from public.tbl_venues where slug = 'billiard-cafe-randpark-ridge'))->'hours'->0)::text,
	'{"day": 1, "opens": "15:00", "closes": "22:30"}', 'its Monday is the short day');
select is((select count(*)::integer from public.tbl_venue_hours h join public.tbl_venues v on v.id = h.venue_id where v.slug = 'billiard-cafe-randpark-ridge'), 7, 'it has all seven days');


-- ─── Who may tie a competition to a venue ───

select tests.sign_in(:'owner');
select lives_ok(format($$ select public.tdc_create_league('Owner League', tests.rules('{"team_size": 2}'), %L) $$, :'one'),
	'an owner may tie a league to the venue');
select tests.sign_in(:'admin');
select lives_ok(format($$ select public.tdc_create_league('Admin League', tests.rules('{"team_size": 2}'), %L) $$, :'one'),
	'an admin may tie a league to the venue');
select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_create_league('Staff League', tests.rules('{"team_size": 2}'), %L) $$, :'one'),
	'Only an owner or admin of that venue can run a league there.', 'staff may no longer tie a league to the venue');
select lives_ok(format($$ select public.tdc_create_tournament('Staff Night', tests.rules(), 'single_elimination', %L) $$, :'one'),
	'staff may still tie a tournament to the venue');
select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_create_league('Stranger League', tests.rules('{"team_size": 2}'), %L) $$, :'one'),
	'Only an owner or admin of that venue can run a league there.', 'a stranger may not tie a league to the venue');
select throws_ok(format($$ select public.tdc_create_tournament('Stranger Night', tests.rules(), 'single_elimination', %L) $$, :'one'),
	'Only staff at that venue can run a tournament there.', 'a stranger may not tie a tournament to the venue');
select lives_ok($$ select public.tdc_create_league('Still Open', tests.rules('{"team_size": 2}')) $$,
	'with no venue anyone may still run a league');


-- ─── Played at: whoever runs it lists any active venue, and gains nothing ───

select public.tdc_create_league('Travelling', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_tournament('Travelling Night', tests.rules()) as tourn \gset

select lives_ok(format($$ select public.tdc_set_league_season_venues(%L, array[%L, %L]::uuid[]) $$, :'season', :'two', :'one'),
	'whoever runs a season may list venues with no role at them');
select is((select array_agg(venue_id::text order by position) from public.tbl_league_season_venues where league_season_id = :'season'),
	array[:'two', :'one'], 'the list keeps the order given');
select lives_ok(format($$ select public.tdc_set_tournament_venues(%L, array[%L]::uuid[]) $$, :'tourn', :'one'),
	'whoever runs a tournament may list a venue with no role at it');
select is((select venue_id::text from public.tbl_tournament_venues where tournament_id = :'tourn'), :'one', 'the tournament''s list is saved');

select throws_ok(format($$ select public.tdc_set_league_season_venues(%L, array[%L]::uuid[]) $$, :'season', :'closed'),
	'That venue is not open on the platform.', 'a closed venue cannot be listed');
select throws_ok(format($$ select public.tdc_set_tournament_venues(%L, array[%L, %L]::uuid[]) $$, :'tourn', :'one', :'one'),
	'A venue can only be listed once.', 'a venue cannot be listed twice');

select is((select venue_id from public.tbl_leagues where id = :'league'), null, 'listing venues leaves the league belonging to none');
select is((select venue_id from public.tbl_tournaments where id = :'tourn'), null, 'and the tournament too');

select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_set_league_season_venues(%L, '{}'::uuid[]) $$, :'season'),
	'Only the people running this league can change where it is played.', 'staff at a listed venue may not change the season''s list');
select throws_ok(format($$ select public.tdc_set_tournament_venues(%L, '{}'::uuid[]) $$, :'tourn'),
	'Only the people running this tournament can change where it is played.', 'nor the tournament''s');
select throws_ok(format($$ select public.tdc_create_team(%L, 'Sneaked') $$, :'season'),
	null, 'being played at a venue does not let its staff run the league');
select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_update_venue(%L, p_area => 'Mine') $$, :'one'),
	'Only an owner or admin of this venue can change its details.', 'listing a venue does not let the director edit it');


-- ─── A closed venue already on the list may stay ───

select tests.sign_out();
update public.tbl_venues set active = false where id = :'two';
select tests.sign_in(:'stranger');
select lives_ok(format($$ select public.tdc_set_league_season_venues(%L, array[%L, %L]::uuid[]) $$, :'season', :'one', :'two'),
	'a venue that closed after it was listed may stay');


-- ─── The next season copies the list, less what has closed ───

select public.tdc_create_league_season(:'league', 'Summer') as summer \gset
select is((select array_agg(venue_id::text) from public.tbl_league_season_venues where league_season_id = :'summer'),
	array[:'one'], 'a new season copies the last one''s venues, less a closed one');
select is((select count(*)::integer from public.tbl_league_season_venues where league_season_id = :'season'),
	2, 'the old season keeps its own');
select public.tdc_set_league_season_venues(:'summer', '{}');
select is((select count(*)::integer from public.tbl_league_season_venues where league_season_id = :'summer'),
	0, 'an empty list clears it');
select is((select count(*)::integer from public.tbl_league_season_venues where league_season_id = :'season'),
	2, 'changing one season leaves the other alone');

select tests.sign_out();
update public.tbl_venues set active = true where id = :'two';
select tests.sign_in(:'stranger');


-- ─── A fixture's venue ───

select public.tdc_set_league_season_venues(:'season', array[:'one']::uuid[]);
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'h1'), :'th', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'a1'), :'ta', true);
select public.tdc_add_league_fixture(:'season', 1, :'th', :'ta') as fx \gset

select is((select venue_id::text from public.tbl_league_fixtures where id = :'fx'), null, 'a fixture starts blank');
select is((select venue_id::text from public.tdc_league_fixtures(:'season')), :'one', 'blank takes the season''s one venue');
select is((select venue_name from public.tdc_league_fixtures(:'season')), 'Club One', 'and its name');
select is((select venue_inherited from public.tdc_league_fixtures(:'season')), true, 'and says it was inherited');

select public.tdc_set_league_season_venues(:'season', array[:'one', :'two']::uuid[]);
select is((select venue_id::text from public.tdc_league_fixtures(:'season')), null, 'blank in a season at several names none');
select is((select venue_inherited from public.tdc_league_fixtures(:'season')), false, 'and inherited nothing');

select public.tdc_set_league_fixture(:'fx', p_venue_id => :'two');
select is((select venue_id::text from public.tdc_league_fixtures(:'season')), :'two', 'a fixture''s own venue wins');
select is((select venue_inherited from public.tdc_league_fixtures(:'season')), false, 'and is not inherited');
select public.tdc_set_league_fixture(:'fx', p_notes => 'moved');
select is((select venue_id::text from public.tbl_league_fixtures where id = :'fx'), :'two', 'changing something else keeps it');

select throws_ok(format($$ select public.tdc_set_league_fixture(%L, p_venue_id => %L) $$, :'fx', :'closed'),
	'That venue is not open on the platform.', 'a fixture cannot move to a closed venue');
select throws_ok(format($$ select public.tdc_add_league_fixture(%L, 2, %L, %L, null, null, null, %L) $$, :'season', :'th', :'ta', :'closed'),
	'That venue is not open on the platform.', 'nor be added at one');

select tests.sign_out();
update public.tbl_venues set active = false where id = :'two';
select tests.sign_in(:'stranger');
select lives_ok(format($$ select public.tdc_set_league_fixture(%L, p_venue_id => %L) $$, :'fx', :'two'),
	'a fixture may keep a venue that has since closed');
select tests.sign_out();
update public.tbl_venues set active = true where id = :'two';
select tests.sign_in(:'stranger');

select public.tdc_create_league_match(:'fx') as m \gset
select is((select venue_id from public.tbl_matches where id = :'m'), null, 'a fixture''s venue never reaches the match, so its staff get no rights');

select public.tdc_set_league_fixture(:'fx', p_clear_venue => true);
select is((select venue_id from public.tbl_league_fixtures where id = :'fx'), null, 'a fixture''s venue can be cleared');


-- ─── Reading, signed out ───

select tests.sign_out();
update public.tbl_venues set description = 'A test club', phone = '083 000 0000', table_count = 8 where id = :'one';
insert into public.tbl_venue_hours (venue_id, day_of_week, opens_at, closes_at) values
	(:'one', 5, '12:00', '02:00'), (:'one', 1, '17:00', '23:00');

select tests.sign_in_anon();
select throws_ok($$ select * from public.tbl_venues $$, '42501', null, 'signed out, the table itself is not readable');
select throws_ok($$ select * from public.tbl_venue_hours $$, '42501', null, 'nor the hours');
select is((select count(*)::integer from public.tdc_venues() where id = :'one'), 1, 'an active venue is in the list');
select is((select count(*)::integer from public.tdc_venues() where id = :'closed'), 0, 'a closed one is not');
select is(public.tdc_venue(:'one')->>'phone', '083 000 0000', 'its details are readable signed out');
select is((public.tdc_venue(:'one')->'hours')::text,
	'[{"day": 1, "opens": "17:00", "closes": "23:00"}, {"day": 5, "opens": "12:00", "closes": "02:00"}]',
	'hours come in day order, closing past midnight allowed');
select is(public.tdc_venue(:'closed'), null, 'a closed venue reads as nothing');
select is(public.tdc_venue(:'one') ? 'currency', false, 'display details only');
select tests.sign_out();

select throws_ok(format($$ insert into public.tbl_venue_hours (venue_id, day_of_week, opens_at, closes_at) values (%L, 2, '12:00', '12:00') $$, :'one'),
	'23514', null, 'a time cannot open and close at the same moment');


-- ─── Editing ───

select tests.sign_in(:'admin');
select lives_ok(format($$ select public.tdc_update_venue(%L, p_area => ' Rivonia ', p_maps_url => 'https://maps.app.goo.gl/x', p_table_count => 24, p_phone => '083 788 9971') $$, :'one'),
	'an admin may edit the venue');
select is((select area from public.tbl_venues where id = :'one'), 'Rivonia', 'the details are saved, trimmed');
select is((select description from public.tbl_venues where id = :'one'), null, 'a detail left out is cleared: the whole form is sent');
select throws_ok(format($$ select public.tdc_update_venue(%L, p_website_url => 'javascript:alert(1)') $$, :'one'),
	'The website must be a full link starting https://', 'a link must be https');
select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_update_venue(%L, p_area => 'Nope') $$, :'one'),
	'Only an owner or admin of this venue can change its details.', 'staff may not edit the venue');


-- ─── The picture ───

select throws_ok(format($$ select public.tdc_set_venue_picture(%L, %L) $$, :'one', :'one' || '/a.webp'),
	'Only an owner or admin of this venue can change its picture.', 'staff may not set the picture');
select tests.sign_in(:'owner');
select throws_ok(format($$ select public.tdc_set_venue_picture(%L, 'elsewhere/a.webp') $$, :'one'),
	'TDC (Error): a venue''s picture must be in its own folder.', 'the picture must be in the venue''s folder');
select is(public.tdc_set_venue_picture(:'one', :'one' || '/a.webp'), null, 'the owner may set it');
select is(public.tdc_set_venue_picture(:'one', null), :'one' || '/a.webp', 'clearing it returns the old path to delete');
select tests.sign_out();

select is((select public from storage.buckets where id = 'venue-pictures'), true, 'the bucket is public');

select * from finish();
rollback;
