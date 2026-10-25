-- Tables available (migration 20261025082733).
--
--   four teams, 2 matches a round, 2 tables a match, 3 tables available
--     → round 1 (two passes, four fixtures): {1,2}, {3}, none, none
--     → round 2 (one pass, two fixtures): {1,2}, {3}
--   blank (null) is no limit: numbered on as before
--   0 or 100 is refused
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('Avail LD') as ld \gset
select tests.create_user('Avail P1') as p1 \gset
select tests.create_user('Avail P2') as p2 \gset
select tests.create_user('Avail P3') as p3 \gset
select tests.create_user('Avail P4') as p4 \gset

select tests.sign_in(:'ld');
select public.tdc_create_league('Avail League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Alpha') as ta \gset
select public.tdc_create_team(:'season', 'Bravo') as tb \gset
select public.tdc_create_team(:'season', 'Charlie') as tc \gset
select public.tdc_create_team(:'season', 'Delta') as td \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p1'), :'ta', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p2'), :'tb', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p3'), :'tc', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p4'), :'td', true);

select public.tdc_generate_league_fixtures(:'season', 1, '2026-11-04 17:30+00', 7, false, false, 2, 2, 3);
select tests.sign_out();

select is((select array_agg(table_numbers::text order by position) from public.tbl_league_fixtures where league_season_id = :'season' and round = 1),
	array['{1,2}', '{3}', '{}', '{}'], 'three tables: the second fixture gets what is left, the rest of the night none');
select is((select array_agg(table_numbers::text order by position) from public.tbl_league_fixtures where league_season_id = :'season' and round = 2),
	array['{1,2}', '{3}'], 'and the next night starts from table 1 again');

select tests.sign_in(:'ld');
select public.tdc_generate_league_fixtures(:'season', 1, null, 7, true, true, 2, 2, null);
select tests.sign_out();
select is((select array_agg(table_numbers::text order by position) from public.tbl_league_fixtures where league_season_id = :'season' and round = 1),
	array['{1,2}', '{3,4}', '{5,6}', '{7,8}'], 'blank is no limit: numbered on through the night as before');

select tests.sign_in(:'ld');
select throws_ok(format($$ select public.tdc_generate_league_fixtures(%L, 1, null, 7, true, true, 1, 1, 0) $$, :'season'),
	'P0001', 'A venue can have between 1 and 99 tables available, not 0. Leave it blank for no limit.', 'no tables available is refused');
select throws_ok(format($$ select public.tdc_generate_league_fixtures(%L, 1, null, 7, true, true, 1, 1, 100) $$, :'season'),
	'P0001', 'A venue can have between 1 and 99 tables available, not 100. Leave it blank for no limit.', 'nor more than 99');
select tests.sign_out();

select * from finish();
rollback;
