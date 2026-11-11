-- The fixtures say whether each side has locked its lineup (migration
-- 20261111105904, UV 11 Nov): the players' fixtures show a locked side's name
-- in yellow.
--
--   no match yet: neither side locked
--   a match made: neither, until a captain locks; then only that side
--   both locked: both
--   still only for somebody signed in
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('Lock LD') as dee \gset
select tests.create_user('Lock H1') as h1 \gset
select tests.create_user('Lock H2') as h2 \gset
select tests.create_user('Lock A1') as a1 \gset
select tests.create_user('Lock A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Lock League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;

select tests.sign_in(:'h2');
select is((select array[home_locked, away_locked] from public.tdc_league_fixtures(:'season') where fixture_id = :'fx'),
	array[false, false], 'no match yet: neither side locked');

select tests.sign_in(:'dee');
select public.tdc_create_league_match(:'fx') as m \gset

select tests.sign_in(:'h2');
select is((select array[home_locked, away_locked] from public.tdc_league_fixtures(:'season') where fixture_id = :'fx'),
	array[false, false], 'a match made: neither side locked yet');

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2');
select public.tdc_lock_lineup(:'m');

select tests.sign_in(:'a2');
select is((select array[home_locked, away_locked] from public.tdc_league_fixtures(:'season') where fixture_id = :'fx'),
	array[true, false], 'the home captain locked: home alone reads locked, to the other team too');

select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2');
select public.tdc_lock_lineup(:'m');

select tests.sign_in(:'h2');
select is((select array[home_locked, away_locked] from public.tdc_league_fixtures(:'season') where fixture_id = :'fx'),
	array[true, true], 'both captains locked: both read locked');
select is((select count(*)::int from public.tdc_league_fixtures(:'season') where home_locked or away_locked),
	1, 'only that fixture reads locked');
select is((select match_status from public.tdc_league_fixtures(:'season') where fixture_id = :'fx'),
	'in_progress', 'both locked, nothing scored: the match already reads in progress (the lock builds its frames)');

select tests.sign_in_anon();
select throws_ok(format('select * from public.tdc_league_fixtures(%L)', :'season'), '42501', null,
	'signed out: still refused');

select * from finish();
rollback;
