-- Live standings (migration 20261029194712, UV 29 Oct).
--
--   off (and every caller that does not say): only nights signed by both
--   on: a night with a finished frame counts before it is signed, and says
--     how many such nights there are
--   on: a night with no finished frame yet does not count (no 0-0 draw)
--   on: the matches to watch are returned
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('Live LD') as dee \gset
select tests.create_user('Live H1') as h1 \gset
select tests.create_user('Live H2') as h2 \gset
select tests.create_user('Live A1') as a1 \gset
select tests.create_user('Live A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Live League', tests.rules('{"team_size": 2}')) as league \gset
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
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

-- The frames are there, none finished yet.
select tests.sign_in(:'h1');
select is((public.tdc_league_standings(:'season', true) ->> 'matches_counted')::int, 0,
	'live: a night with no finished frame does not count');
select is(public.tdc_league_standings(:'season', true) -> 'watch_match_ids', jsonb_build_array(:'m'),
	'live: the night is in the matches to watch');

-- Two frames played, home won both; nobody has signed.
select public.tdc_record_frame(:'m', 1, '{"status": "complete", "winner_side": "home", "result_event": "win", "break_side": "home"}'::jsonb);
select public.tdc_record_frame(:'m', 2, '{"status": "complete", "winner_side": "home", "result_event": "win", "break_side": "away"}'::jsonb);

select is((public.tdc_league_standings(:'season') ->> 'matches_counted')::int, 0,
	'off: a night being played does not count');
select is((public.tdc_league_standings(:'season', false) ->> 'live')::boolean, false, 'and says it is not live');

select public.tdc_league_standings(:'season', true) as st \gset
select is((:'st'::jsonb ->> 'matches_counted')::int, 1, 'live: the night being played counts');
select is((:'st'::jsonb ->> 'matches_unsigned')::int, 1, 'and is said to be unsigned');
select is((select t -> 'stats' from jsonb_array_elements(:'st'::jsonb -> 'teams') t where t ->> 'team_id' = :'th')
	@> '{"matches_played": 1, "matches_won": 1, "frames_played": 2, "frames_won": 2}'::jsonb,
	true, 'the home team leads it on the frames played so far');

-- Abandoned: gone from live too.
select tests.sign_out();
update public.tbl_matches set status = 'abandoned' where id = :'m';
select tests.sign_in(:'h1');
select is((public.tdc_league_standings(:'season', true) ->> 'matches_counted')::int, 0,
	'live: an abandoned night does not count');

select * from finish();
rollback;
