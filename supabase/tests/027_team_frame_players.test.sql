-- A team frame's players come from the lineup (migration 20261024084837,
-- audit A4).
--
-- tdc_record_frame used to accept a list of who played and check nothing
-- about it on a team card, and being in a frame grants edit rights. Now, on a
-- team card, it never makes a frame and never changes who is in one: the
-- lineup and tdc_swap_frame_player decide that.
--
-- A three-man night, every position filled, so frames 1–9 are slots 1–9:
--   session 1: H1–A1  H2–A2  H3–A3
--   session 2: H1–A2  H2–A3  H3–A1
--   session 3: H1–A3  H2–A1  H3–A2
begin;
\ir _helpers.psql
select plan(17);

select tests.create_user('Frame Dee') as dee \gset
select tests.create_user('Frame H1') as h1 \gset
select tests.create_user('Frame H2') as h2 \gset
select tests.create_user('Frame H3') as h3 \gset
select tests.create_user('Frame A1') as a1 \gset
select tests.create_user('Frame A2') as a2 \gset
select tests.create_user('Frame A3') as a3 \gset
select tests.create_user('Frame AR') as ar \gset
select tests.create_user('Frame Outsider') as ou \gset

select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'h3') as ph3 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset
select tests.player_of(:'a3') as pa3 \gset
select tests.player_of(:'ar') as par \gset
select tests.player_of(:'ou') as pou \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Frame League', tests.rules('{"team_size": 3}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'ph3', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_add_league_entrant(:'season', :'pa3', :'ta');
select public.tdc_add_league_entrant(:'season', :'par', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select tests.sign_out();

select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset

select tests.sign_in(:'dee');
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_match_squad(:'m', :'ph3');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2');
select public.tdc_set_lineup_slot(:'m', 3, :'ph3');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_match_squad(:'m', :'pa3');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2');
select public.tdc_set_lineup_slot(:'m', 3, :'pa3');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

-- ─── A list that changes who played is refused, whoever sends it ───

select tests.sign_in(:'h1');
select throws_ok(
	format($$ select public.tdc_record_frame(%L, 1, %L::jsonb) $$, :'m',
		jsonb_build_object('status', 'pending', 'home_players', jsonb_build_array(:'pou'))),
	'P0001', 'Who plays a frame on a team card comes from the lineup. To put a reserve in, use the picker under the frame.',
	'a captain cannot name an outsider in their own seat');
select tests.sign_out();

select tests.sign_in(:'ou');
select is(private.tdc_can_edit_match(:'m'), false,
	'so the outsider gains no edit rights on the match');
select tests.sign_out();

select tests.sign_in(:'h1');
select throws_ok(
	format($$ select public.tdc_record_frame(%L, 2, %L::jsonb) $$, :'m',
		jsonb_build_object('status', 'pending', 'away_players', jsonb_build_array(:'pa3'))),
	'P0001', 'Who plays a frame on a team card comes from the lineup. To put a reserve in, use the picker under the frame.',
	'a captain cannot reach into the other side''s seat');
select tests.sign_out();

select tests.sign_in(:'h3');
select throws_ok(
	format($$ select public.tdc_record_frame(%L, 3, %L::jsonb) $$, :'m',
		jsonb_build_object('status', 'complete', 'winner_side', 'home', 'result_event', 'win',
			'away_players', jsonb_build_array(:'pou'))),
	'P0001', 'Who plays a frame on a team card comes from the lineup. To put a reserve in, use the picker under the frame.',
	'a player cannot replace their own opponent');
select throws_ok(
	format($$ select public.tdc_record_frame(%L, 50, %L::jsonb) $$, :'m',
		jsonb_build_object('status', 'complete', 'winner_side', 'home', 'result_event', 'win',
			'home_players', jsonb_build_array(:'ph3'), 'away_players', jsonb_build_array(:'pou'))),
	'P0001', 'There is no frame 50 on this card. A team card''s frames come from the two lineups.',
	'a player cannot make a frame that is not on the card');
select tests.sign_out();

select tests.sign_in(:'dee');
select throws_ok(
	format($$ select public.tdc_record_frame(%L, 4, %L::jsonb) $$, :'m',
		jsonb_build_object('status', 'pending', 'away_players', jsonb_build_array(:'ph2'))),
	'P0001', 'Who plays a frame on a team card comes from the lineup. To put a reserve in, use the picker under the frame.',
	'nor can the league director');
select throws_ok(
	format($$ select public.tdc_record_frame(%L, 10, '{"status": "pending"}'::jsonb) $$, :'m'),
	'P0001', 'There is no frame 10 on this card. A team card''s frames come from the two lineups.',
	'or make a tenth frame');
select tests.sign_out();

select is(
	(select count(*)::integer from public.tbl_frames where match_id = :'m'),
	9, 'the card still has its nine frames');

-- ─── What the card sends still works ───

select tests.sign_in(:'h1');
select lives_ok(
	format($$ select public.tdc_record_frame(%L, 1, %L::jsonb) $$, :'m',
		jsonb_build_object('status', 'complete', 'winner_side', 'home', 'result_event', 'win',
			'home_players', jsonb_build_array(:'ph1'), 'away_players', jsonb_build_array(:'pa1'))),
	'a list naming exactly the people already there is accepted');
select lives_ok(
	format($$ select public.tdc_record_frame(%L, 4, '{"status": "pending", "break_side": "away"}'::jsonb) $$, :'m'),
	'a lag with no list is accepted, as the card sends it');
select tests.sign_out();

-- A2 leaves Guests after the lock: still in their frames, which still take a
-- result (production's Thabo Mokoena, 24 Oct).
select tests.sign_in(:'a1');
select public.tdc_team_release_player(:'ta', :'pa2');
select tests.sign_out();

select tests.sign_in(:'h2');
select lives_ok(
	format($$ select public.tdc_record_frame(%L, 2, '{"status": "complete", "winner_side": "away", "result_event": "win"}'::jsonb) $$, :'m'),
	'a frame whose player has since left the team still takes a result');
select tests.sign_out();

select is(
	(select player_id from public.tbl_frame_participants fp join public.tbl_frames f on f.id = fp.frame_id
	 where f.match_id = :'m' and f.frame_no = 2 and fp.side = 'away'),
	:'pa2'::uuid, 'and keeps them in it');

-- ─── The league director corrects who played a finished frame: clear the
--     result, put the right player in, record it again (UV, 24 Oct) ───

select tests.sign_in(:'dee');
select lives_ok(
	format($$ select public.tdc_record_frame(%L, 1, '{"status": "pending"}'::jsonb) $$, :'m'),
	'the director clears the result of frame 1');
select lives_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$,
		(select id from public.tbl_frames where match_id = :'m' and frame_no = 1), :'par'),
	'puts the reserve in with the picker');
select lives_ok(
	format($$ select public.tdc_record_frame(%L, 1, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb) $$, :'m'),
	'and records it again');
select tests.sign_out();

select is(
	(select player_id from public.tbl_frame_participants fp join public.tbl_frames f on f.id = fp.frame_id
	 where f.match_id = :'m' and f.frame_no = 1 and fp.side = 'away'),
	:'par'::uuid, 'frame 1 is now the reserve''s');

-- ─── Singles is untouched ───

select tests.sign_in(:'h1');
select public.tdc_create_match(:'ph2', tests.rules()) as ms \gset
select lives_ok(
	format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}'::jsonb) $$, :'ms'),
	'a singles match still records a new frame with no list');
select tests.sign_out();

select * from finish();
rollback;
