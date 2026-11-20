-- The league star (migration 20261119180000, UV 19 Nov).
--
--   a league match in the profile's matches names its league season
--   the profile's teams carry the season's rules (team size)
--   the league's pooled counts (tdc_league_star_average, 20 Nov): Ann 2-0 over
--     a player, so 4 player-frames, 2 won; refused when signed out
--   a team's real nights are countable from the made schedule: byes are not
--     (three singles players, one round robin: two nights each, one bye)
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('LStar LD') as dee \gset
select tests.create_user('LStar Ann') as ann \gset
select tests.create_user('LStar Ben') as ben \gset
select tests.create_user('LStar Cas') as cas \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'ben') as pben \gset
select tests.player_of(:'cas') as pcas \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Star League', tests.rules('{"team_size": 1, "approval_mode": "coordinator_approval"}'));
select id as league from public.tbl_leagues where name = 'Star League' \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_add_league_entrant(:'season', :'pann');
select public.tdc_add_league_entrant(:'season', :'pben');
select public.tdc_add_league_entrant(:'season', :'pcas');
select public.tdc_generate_league_fixtures(:'season');
select tests.sign_out();
select team_id as tann from public.tbl_league_season_entrants where player_id = :'pann' and league_season_id = :'season' \gset

-- Ann's first non-bye fixture is played, 2-0 to Ann, and submitted.
select id as fx from public.tbl_league_fixtures
where league_season_id = :'season' and away_team_id is not null and (home_team_id = :'tann'::uuid or away_team_id = :'tann'::uuid)
order by round, position limit 1 \gset
select (home_team_id = :'tann'::uuid) as ann_home from public.tbl_league_fixtures where id = :'fx' \gset
select tests.sign_in(:'dee');
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();
select case when :'ann_home'::boolean then 'home' else 'away' end as ann_side \gset
select tests.sign_in(:'ann');
select public.tdc_record_frame(:'m', 1, jsonb_build_object('status', 'complete', 'winner_side', :'ann_side', 'result_event', 'win'));
select public.tdc_record_frame(:'m', 2, jsonb_build_object('status', 'complete', 'winner_side', :'ann_side', 'result_event', 'win'));
select public.tdc_submit_card(:'m', null);
select tests.sign_out();

select tests.sign_in(:'ben');
select public.tdc_player_profile(:'pann') as prof \gset

select is((select x ->> 'league_season_id' from jsonb_array_elements(:'prof'::jsonb -> 'matches') x where x ->> 'match_id' = :'m'),
	:'season', 'the league match names its season');
select is((select x ->> 'kind' from jsonb_array_elements(:'prof'::jsonb -> 'matches') x where x ->> 'match_id' = :'m'),
	'league', 'and is still a league match');
select is((select x -> 'rules' ->> 'team_size' from jsonb_array_elements(:'prof'::jsonb -> 'teams') x where x ->> 'league_season_id' = :'season'),
	'1', 'the team carries the season''s rules');
select is((select count(*)::int from public.tbl_league_fixtures
	where league_season_id = :'season' and away_team_id is not null and (home_team_id = :'tann'::uuid or away_team_id = :'tann'::uuid)),
	2, 'a team of a three-team round robin has two nights');
select is((select count(*)::int from public.tbl_league_fixtures
	where league_season_id = :'season' and (home_team_id = :'tann'::uuid or away_team_id = :'tann'::uuid)),
	3, 'and the bye is a row the count leaves out');

select tests.sign_in(:'ben');
select public.tdc_league_star_average(:'season') as avg \gset
select is((:'avg'::jsonb ->> 'fp')::int, 4, 'the league average pools every player''s frames: 2 frames, 2 players each');
select is((:'avg'::jsonb ->> 'fw')::int, 2, 'and half of them were won');
select is((:'avg'::jsonb ->> 'b')::int, 0, 'and no breaks are counted where who broke was not recorded');
select tests.sign_out();
select throws_ok(format($$ select public.tdc_league_star_average(%L) $$, :'season'), null, null, 'it needs a signed-in person');

select * from finish();
rollback;
