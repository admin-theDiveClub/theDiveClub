-- Every team's star on the Season tab (migration 20261125145821, UV 25 Nov).
--
--   one row per team in the season, byes neither played nor scheduled
--   a team's frames are its own side's, counted as the league's average counts:
--     Ann 2-0 over her opponent, the second frame her break and finish
--   the opponent's row is the same frames from the other side
--   a team that has not played has nothing counted
--   refused when signed out
begin;
\ir _helpers.psql
select plan(13);

select tests.create_user('TStar LD') as dee \gset
select tests.create_user('TStar Ann') as ann \gset
select tests.create_user('TStar Ben') as ben \gset
select tests.create_user('TStar Cas') as cas \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'ben') as pben \gset
select tests.player_of(:'cas') as pcas \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Team Star League', tests.rules('{"team_size": 1, "approval_mode": "coordinator_approval"}'));
select id as league from public.tbl_leagues where name = 'Team Star League' \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_add_league_entrant(:'season', :'pann');
select public.tdc_add_league_entrant(:'season', :'pben');
select public.tdc_add_league_entrant(:'season', :'pcas');
select public.tdc_generate_league_fixtures(:'season');
select tests.sign_out();
select team_id as tann from public.tbl_league_season_entrants where player_id = :'pann' and league_season_id = :'season' \gset

-- Ann's first non-bye fixture is played, 2-0 to Ann, and submitted.
select id as fx, (home_team_id = :'tann'::uuid) as ann_home,
	case when home_team_id = :'tann'::uuid then away_team_id else home_team_id end as topp
from public.tbl_league_fixtures
where league_season_id = :'season' and away_team_id is not null and (home_team_id = :'tann'::uuid or away_team_id = :'tann'::uuid)
order by round, position limit 1 \gset
select id as tidle from public.tbl_teams where league_season_id = :'season' and id not in (:'tann'::uuid, :'topp'::uuid) \gset
select tests.sign_in(:'dee');
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();
select case when :'ann_home'::boolean then 'home' else 'away' end as ann_side \gset
select tests.sign_in(:'ann');
select public.tdc_record_frame(:'m', 1, jsonb_build_object('status', 'complete', 'winner_side', :'ann_side', 'result_event', 'win'));
select public.tdc_record_frame(:'m', 2, jsonb_build_object('status', 'complete', 'winner_side', :'ann_side',
	'break_side', :'ann_side', 'result_event', 'break_and_finish'));
select public.tdc_submit_card(:'m', null);
select tests.sign_out();

select tests.sign_in(:'ben');
select public.tdc_team_star_counts(:'season') as got \gset
select tests.sign_out();

select is(jsonb_array_length(:'got'::jsonb), 3, 'one row for every team in the season');

select (x ->> 'fp')::int as a_fp, (x ->> 'fw')::int as a_fw, (x ->> 'b')::int as a_b, (x ->> 'bw')::int as a_bw,
	(x ->> 'bf')::int as a_bf, (x ->> 'ob')::int as a_ob, (x ->> 'played')::int as a_played, (x ->> 'scheduled')::int as a_sched
from jsonb_array_elements(:'got'::jsonb) x where x ->> 'team_id' = :'tann' \gset
select is(:a_fp, 2, 'Ann''s team played two frames');
select is(:a_fw, 2, 'and won both');
select is(:a_b, 1, 'broke once (the frame with no breaker recorded counts for the win rate only)');
select is(:a_bw, 1, 'and won on her break');
select is(:a_bf, 1, 'with a break and finish');
select is(:a_ob, 0, 'and never faced her opponent''s break');
select is(:a_played, 1, 'one of her matches is played');
select is(:a_sched, 2, 'of two scheduled: the bye is not a match');

select (x ->> 'fp')::int as o_fp, (x ->> 'fw')::int as o_fw, (x ->> 'ob')::int as o_ob, (x ->> 'obw')::int as o_obw
from jsonb_array_elements(:'got'::jsonb) x where x ->> 'team_id' = :'topp' \gset
select is(array[:o_fp, :o_fw, :o_ob, :o_obw], array[2, 0, 1, 0], 'her opponent: two frames, none won, faced one break and lost it');

select is((select (x ->> 'fp')::int from jsonb_array_elements(:'got'::jsonb) x where x ->> 'team_id' = :'tidle'), 0,
	'the team that has not played has no frames');
select is((select (x ->> 'played')::int from jsonb_array_elements(:'got'::jsonb) x where x ->> 'team_id' = :'tidle'), 0,
	'and no matches played');

select throws_ok(format($$ select public.tdc_team_star_counts(%L) $$, :'season'), null, null, 'it needs a signed-in person');

select * from finish();
rollback;
