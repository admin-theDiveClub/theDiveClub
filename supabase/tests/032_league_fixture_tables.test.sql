-- Matches per team per round and table numbers (migration 20261024191110).
--
--   four teams, once each, 2 matches a round, 2 tables a match
--     → 3 passes of the round robin; passes 1 and 2 share round 1, pass 3 is
--       round 2 on its own night
--     → each team plays twice in round 1 and once in round 2
--     → tables restart each pass: {1,2} and {3,4}
--   five teams (byes): a bye has no tables
--   adding and changing a fixture's tables; the limits
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('Tab LD') as ld \gset
select tests.create_user('Tab P1') as p1 \gset
select tests.create_user('Tab P2') as p2 \gset
select tests.create_user('Tab P3') as p3 \gset
select tests.create_user('Tab P4') as p4 \gset
select tests.create_user('Tab P5') as p5 \gset

select tests.sign_in(:'ld');
select public.tdc_create_league('Tab League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Alpha') as ta \gset
select public.tdc_create_team(:'season', 'Bravo') as tb \gset
select public.tdc_create_team(:'season', 'Charlie') as tc \gset
select public.tdc_create_team(:'season', 'Delta') as td \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p1'), :'ta', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p2'), :'tb', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p3'), :'tc', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p4'), :'td', true);

select is(public.tdc_generate_league_fixtures(:'season', 1, '2026-11-04 17:30+00', 7, false, false, 2, 2), 6,
	'four teams once each is six fixtures, however they are grouped');
select tests.sign_out();

select is((select array_agg(distinct round order by round) from public.tbl_league_fixtures where league_season_id = :'season'),
	array[1, 2], 'three passes at two a round make two rounds');
select is((select count(*)::integer from public.tbl_league_fixtures where league_season_id = :'season' and round = 1), 4,
	'round 1 holds two passes: four fixtures');
select is((select array_agg(distinct scheduled_at) from public.tbl_league_fixtures where league_season_id = :'season' and round = 2),
	array['2026-11-11 17:30+00'::timestamptz], 'round 2 is a week after round 1, not two');

select is((
	select bool_and(n = 2) from (
		select count(*) as n from public.tbl_league_fixtures f, lateral (values (f.home_team_id), (f.away_team_id)) t(team)
		where f.league_season_id = :'season' and f.round = 1 group by team) x),
	true, 'every team plays twice in round 1');
select is((select array_agg(distinct position order by position) from public.tbl_league_fixtures where league_season_id = :'season' and round = 1),
	array[1, 2, 3, 4], 'positions run on through the night');

select is((select array_agg(table_numbers::text order by position) from public.tbl_league_fixtures where league_season_id = :'season' and round = 1),
	array['{1,2}', '{3,4}', '{1,2}', '{3,4}'], 'tables restart for the second pass of the night');

-- Adding and changing.
select tests.sign_in(:'ld');
select public.tdc_add_league_fixture(:'season', 2, :'ta', :'tc', null, null, array[5, 6]) as added \gset
select is((select table_numbers from public.tbl_league_fixtures where id = :'added'), array[5, 6], 'a fixture is added with its tables');
select public.tdc_add_league_fixture(:'season', 2, :'tb', :'td') as plain \gset
select is((select table_numbers from public.tbl_league_fixtures where id = :'plain'), '{}'::integer[], 'and without any, it has none');
select public.tdc_set_league_fixture(:'added', p_table_numbers => array[7]);
select is((select table_numbers from public.tbl_league_fixtures where id = :'added'), array[7], 'a fixture''s tables can be changed');
select public.tdc_set_league_fixture(:'added', p_notes => 'moved');
select is((select table_numbers from public.tbl_league_fixtures where id = :'added'), array[7], 'and changing something else leaves them');
select throws_ok(format($$ select public.tdc_set_league_fixture(%L, p_table_numbers => array[0]) $$, :'added'),
	'23514', null, 'a table is numbered from 1');
select throws_ok(format($$ select public.tdc_generate_league_fixtures(%L, 1, null, 7, true, true, 7) $$, :'season'),
	'P0001', 'Each team can play between one and six matches a round, not 7.', 'seven matches a round is refused');

-- An odd field: the bye has no tables.
select public.tdc_create_team(:'season', 'Echo') as te \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p5'), :'te', true);
select public.tdc_generate_league_fixtures(:'season', 1, null, 7, true, true, 1, 1);
select tests.sign_out();
select is((select bool_and(cardinality(table_numbers) = 0) from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is null)
	and (select bool_and(cardinality(table_numbers) = 1) from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null),
	true, 'a bye plays on no table; every match on one');

select * from finish();
rollback;
