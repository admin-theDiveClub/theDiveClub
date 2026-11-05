-- Venues, step 3 (migration venues_shown, 5 Nov).
--
--   every read names where a competition is played, in the director's order,
--     and never the venue it merely belongs to
--   a league night names its fixture's own venue, or else the season's list
--   the poster holds the list, and changing the list rebuilds a poster that
--     exists without sharing one that was not
--   a venue's page lists what is tied to it, and only what is listed
begin;
\ir _helpers.psql
select plan(31);

select tests.create_user('Show Owner') as owner \gset
select tests.create_user('Show Home') as h1 \gset
select tests.create_user('Show Away') as a1 \gset
select tests.create_user('Show Stranger') as stranger \gset

insert into public.tbl_venues (name, slug) values ('Club One', 'club-one') returning id as one \gset
insert into public.tbl_venues (name, slug) values ('Club Two', 'club-two') returning id as two \gset
insert into public.tbl_venues (name, slug) values ('Club Three', 'club-three') returning id as three \gset
insert into public.tbl_venues (name, slug, active) values ('Closed Club', 'closed-club', false) returning id as closed \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'three', :'owner', 'owner');


-- ─── A tournament ───

select tests.sign_in(:'owner');
select public.tdc_create_tournament('Show Cup', tests.rules(), p_venue_id => :'three') as cup \gset

select is((select venues from public.tdc_my_tournaments() where id = :'cup'), '[]'::jsonb,
	'belonging to a venue is not being played at it');
select is((select venue_name from public.tdc_my_tournaments() where id = :'cup'), 'Club Three',
	'venue_name still says what it belongs to');

select public.tdc_set_tournament_venues(:'cup', array[:'two', :'one']::uuid[]);
select is((select jsonb_path_query_array(venues, '$[*].name') from public.tdc_my_tournaments() where id = :'cup'),
	'["Club Two", "Club One"]'::jsonb, 'Your Tournaments lists them in the director''s order');
select is((select venues -> 0 ->> 'id' from public.tdc_my_tournaments() where id = :'cup'), :'two', 'with their ids');
select is(jsonb_array_length(public.tdc_tournament_venue_list(:'cup')), 2, 'the draw''s read has both');

-- A venue that has closed since stays on the list it is on.
select tests.sign_out();
update public.tbl_venues set active = false where id = :'one';
select tests.sign_in(:'owner');
select is(jsonb_array_length(public.tdc_tournament_venue_list(:'cup')), 2, 'a venue closed since is still named');
select tests.sign_out();
update public.tbl_venues set active = true where id = :'one';
select tests.sign_in(:'owner');


-- ─── The poster ───

select tests.sign_out();
select is((select count(*)::integer from public.tbl_tournament_posters where tournament_id = :'cup'), 0,
	'saving a list makes no poster where there was none');
select tests.sign_in(:'owner');

select public.tdc_publish_poster(:'cup');
select is((select snapshot -> 'venues' -> 1 ->> 'name' from public.tdc_tournament_poster(:'cup')), 'Club One', 'the poster holds the list');
select public.tdc_set_tournament_venues(:'cup', array[:'one']::uuid[]);
select is((select jsonb_array_length(snapshot -> 'venues') from public.tdc_tournament_poster(:'cup')), 1, 'changing the list rebuilds the poster');
select tests.sign_out();
select is((select is_public from public.tbl_tournament_posters where tournament_id = :'cup'), false,
	'and rebuilding does not share it');
select tests.sign_in(:'owner');


-- ─── Open for entry ───

select public.tdc_create_tournament('Open Show Cup', tests.rules(), p_entry_mode => 'interested', p_is_listed => true) as open_cup \gset
select public.tdc_set_tournament_venues(:'open_cup', array[:'one', :'two']::uuid[]);
select is((select snapshot -> 'venues' -> 1 ->> 'name' from public.tbl_tournament_posters where tournament_id = :'open_cup'),
	'Club Two', 'a shared poster follows the list');
select is((select is_public from public.tbl_tournament_posters where tournament_id = :'open_cup'), true, 'and stays shared');

select tests.sign_in(:'stranger');
select is((select jsonb_array_length(venues) from public.tdc_open_tournaments() where id = :'open_cup'), 2,
	'Open for entry lists them');
select is(jsonb_array_length(public.tdc_tournament_venue_list(:'cup')), 1, 'any signed-in player may read a list');


-- ─── A league ───

select tests.sign_in(:'owner');
select public.tdc_create_league('Show League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Show Season') as season \gset
select tests.sign_out();
update public.tbl_league_seasons set is_listed = true, entry_mode = 'interested' where id = :'season';
select tests.sign_in(:'owner');

select public.tdc_set_league_season_venues(:'season', array[:'two', :'one']::uuid[]);
select is((select jsonb_path_query_array(venues, '$[*].name') from public.tdc_league_season_info(:'season')),
	'["Club Two", "Club One"]'::jsonb, 'the season info lists them in order');
select is((select jsonb_array_length(venues) from public.tdc_my_leagues() where league_season_id = :'season'), 2,
	'Your Leagues lists them');
select is((select jsonb_array_length(venues) from public.tdc_search_leagues('Show League') where league_season_id = :'season'), 2,
	'the search lists them');
select is((select count(*)::integer from public.tdc_search_leagues('Club Two') where league_season_id = :'season'), 1,
	'and finds a league by where it is played');


-- ─── A league night ───

select public.tdc_create_team(:'season', 'Home Side') as home_team \gset
select public.tdc_create_team(:'season', 'Away Side') as away_team \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'h1'), :'home_team', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'a1'), :'away_team', true);
select public.tdc_add_league_fixture(:'season', 1, :'home_team', :'away_team') as fx \gset
select public.tdc_create_league_match(:'fx') as night \gset

select is(jsonb_array_length(public.tdc_match_venue_list(:'night')), 2, 'a blank fixture takes the season''s list');
select public.tdc_set_league_fixture(:'fx', p_venue_id => :'three');
select is(public.tdc_match_venue_list(:'night') -> 0 ->> 'name', 'Club Three', 'a fixture''s own venue wins');
select is(jsonb_array_length(public.tdc_match_venue_list(:'night')), 1, 'and is the only one');
select is((select venue_id::text from public.tbl_matches where id = :'night'), null, 'and never reaches the match');


-- ─── Signed out ───

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_tournament_venue_list(%L) $$, :'cup'),
	'42501', null, 'signed out, a list is not read this way');
select throws_ok(format($$ select public.tdc_match_venue_list(%L) $$, :'night'),
	'42501', null, 'nor a match''s');


-- ─── A venue's page ───

select is(jsonb_array_length(public.tdc_venue_competitions(:'one') -> 'tournaments'), 1,
	'signed out, a venue lists the tournament that is listed');
select is(public.tdc_venue_competitions(:'one') -> 'tournaments' -> 0 ->> 'name', 'Open Show Cup',
	'and not the one that is not');
select is(public.tdc_venue_competitions(:'one') -> 'tournaments' -> 0 ->> 'poster_open', 'true',
	'and says its poster can be opened');
select is(public.tdc_venue_competitions(:'one') -> 'leagues' -> 0 ->> 'league_name', 'Show League',
	'and the listed league played there');
select is(public.tdc_venue_competitions(:'three') -> 'leagues' -> 0 ->> 'league_name', 'Show League',
	'a fixture there ties the league to the venue too');

select tests.sign_out();
update public.tbl_tournaments set is_listed = true where id = :'cup';
select tests.sign_in_anon();
select is(public.tdc_venue_competitions(:'three') -> 'tournaments' -> 0 ->> 'name', 'Show Cup',
	'as does belonging to it');
select is(public.tdc_venue_competitions(:'closed'), null, 'a closed venue shows nothing');

select * from finish();
rollback;
