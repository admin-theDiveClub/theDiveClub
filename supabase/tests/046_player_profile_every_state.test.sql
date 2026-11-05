-- A player's matches in every state (migration 20261105064410, UV 5 Nov).
--
--   a singles match is listed from the moment it names them, before any frame,
--     with its status; one being played shows its score so far
--   an abandoned match is listed as abandoned
--   none of it is counted: frames hold finished matches only
--   a team night is listed once they are in its squad, before the lineups
--     lock; a teammate in neither the squad nor a frame does not have it
begin;
\ir _helpers.psql
select plan(10);

select tests.create_user('State Alice') as alice \gset
select tests.create_user('State Bob') as bob \gset
select tests.create_user('State Carol') as carol \gset
select tests.player_of(:'alice') as pal \gset
select tests.player_of(:'bob') as pbo \gset

-- ─── Singles in three states ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'pbo', tests.rules('{"approval_mode": "none"}')) as m_new \gset
select public.tdc_create_match(:'pbo', tests.rules('{"approval_mode": "none"}')) as m_play \gset
select public.tdc_record_frame(:'m_play', 1, '{"winner_side": "away", "result_event": "win"}');
select public.tdc_create_match(:'pbo', tests.rules('{"approval_mode": "none"}')) as m_gone \gset
select tests.sign_out();
update public.tbl_matches set status = 'abandoned' where id = :'m_gone';

select tests.sign_in(:'carol');
select public.tdc_player_profile(:'pbo') as prof \gset
select is((select x ->> 'status' from jsonb_array_elements(:'prof'::jsonb -> 'matches') x where x ->> 'match_id' = :'m_new'),
	(select status from public.tbl_matches where id = :'m_new'), 'a match with no frames is listed, with its status');
select isnt((select x ->> 'status' from jsonb_array_elements(:'prof'::jsonb -> 'matches') x where x ->> 'match_id' = :'m_new'),
	'complete', 'and it is not finished');
select is((select (x ->> 'mine') || '-' || (x ->> 'theirs') from jsonb_array_elements(:'prof'::jsonb -> 'matches') x where x ->> 'match_id' = :'m_play'),
	'1-0', 'a match being played shows its score so far');
select is((select x ->> 'status' from jsonb_array_elements(:'prof'::jsonb -> 'matches') x where x ->> 'match_id' = :'m_gone'),
	'abandoned', 'an abandoned match is listed as abandoned');
select is(jsonb_array_length(:'prof'::jsonb -> 'matches'), 3, 'all three are listed');
select is(jsonb_array_length(:'prof'::jsonb -> 'frames'), 0, 'none of them is counted: no finished frames');
select is((select x ->> 'opponent' from jsonb_array_elements(:'prof'::jsonb -> 'matches') x where x ->> 'match_id' = :'m_new'),
	'State Alice', 'Bob''s opponent is Alice');

-- ─── A team night before the lock ───

select tests.create_user('State LD') as dee \gset
select tests.create_user('State H1') as h1 \gset
select tests.create_user('State H2') as h2 \gset
select tests.create_user('State A1') as a1 \gset
select tests.create_user('State A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('State League', tests.rules('{"team_size": 2}')) as league \gset
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

-- Hosts name H1 in the squad and the order, not locked; H2 in neither.
select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');

select tests.sign_in(:'a1');
select is((select x ->> 'opponent' from jsonb_array_elements(public.tdc_player_profile(:'ph1') -> 'matches') x where x ->> 'match_id' = :'m'),
	'Guests', 'a team night is listed once they are in its squad, before the lock');
select is((select x ->> 'kind' from jsonb_array_elements(public.tdc_player_profile(:'ph1') -> 'matches') x where x ->> 'match_id' = :'m'),
	'league', 'as a league night');
select is((select count(*)::int from jsonb_array_elements(public.tdc_player_profile(:'ph2') -> 'matches') x where x ->> 'match_id' = :'m'),
	0, 'a teammate not in the squad does not have it');

select * from finish();
rollback;
