-- A team night is sessions (migration 20261023221049).
--
-- Settled with UV on 23–24 Oct (docs/DECISIONS.md):
--   • a captain names team_size positions; the night is built from the two
--     orders and the rotation table (cyclic shift here)
--   • an empty seat stays open until a captain signs, then is a walkover
--   • a reserve fills one frame, under three rules: one frame per session;
--     a player in the order keeps their position; a reserve never meets the
--     same opponent twice
--
-- A three-man league, so nine frames. Cyclic shift:
--   session 1: H1–A1  H2–A2  H3–A3   (slots 1–3)
--   session 2: H1–A2  H2–A3  H3–A1   (slots 4–6)
--   session 3: H1–A3  H2–A1  H3–A2   (slots 7–9)
-- The away side leaves position 3 empty, so slots 3, 5 and 7 have one seat.
begin;
\ir _helpers.psql
select plan(22);

select tests.create_user('Night Dee') as dee \gset
select tests.create_user('Night H1') as h1 \gset
select tests.create_user('Night H2') as h2 \gset
select tests.create_user('Night H3') as h3 \gset
select tests.create_user('Night A1') as a1 \gset
select tests.create_user('Night A2') as a2 \gset
select tests.create_user('Night A3') as a3 \gset
select tests.create_user('Night AR') as ar \gset

select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'h3') as ph3 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset
select tests.player_of(:'a3') as pa3 \gset
select tests.player_of(:'ar') as par \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Night League', tests.rules('{"team_size": 3}')) as league \gset
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

-- The circle method decides who is at home; the test wants Hosts at home.
select tests.sign_in(:'dee');
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

-- ─── The order is positions ───

select tests.sign_in(:'h1');
select is((select count(*)::integer from public.tdc_match_lineup(:'m')), 6,
	'a three-man night has three positions a side, not nine slots');
select tests.sign_out();

select is(private.tdc_lineup_slots(:'m'), 9, 'and nine frames');

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_match_squad(:'m', :'ph3');
select throws_ok(
	format($$ select public.tdc_set_lineup_slot(%L, 4, %L) $$, :'m', :'ph1'),
	'P0001', 'This match has 3 positions, so there is no position 4.',
	'there is no fourth position');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2');
select public.tdc_set_lineup_slot(:'m', 3, :'ph3');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

-- A3 is late; position 3 is left empty.
select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2');
select is(public.tdc_lock_lineup(:'m'), 9,
	'the second lock builds all nine frames, the ones with an empty seat included');
select tests.sign_out();

-- ─── The night follows the rotation ───

select tests.sign_in(:'h1');
select is(
	(select session || ': ' || home_position || 'v' || away_position from public.tdc_match_card(:'m') where lineup_slot = 4),
	'2: 1v2', 'slot 4 is session 2, home position 1 against away position 2');
select is(
	(select home_player_id::text || away_player_id::text from public.tdc_match_card(:'m') where lineup_slot = 4),
	:'ph1' || :'pa2', 'and seats H1 against A2');
select is(
	(select array_agg(lineup_slot order by lineup_slot) from public.tdc_match_card(:'m') where away_player_id is null),
	array[3, 5, 7], 'every frame against away position 3 has an empty seat');
select is(
	(select count(*)::integer from public.tdc_match_card(:'m') where status = 'pending'),
	9, 'an empty seat is not a walkover yet: all nine frames wait');
select tests.sign_out();

select id as f1 from public.tbl_frames where match_id = :'m' and lineup_slot = 1 \gset
select id as f3 from public.tbl_frames where match_id = :'m' and lineup_slot = 3 \gset
select id as f4 from public.tbl_frames where match_id = :'m' and lineup_slot = 4 \gset
select id as f5 from public.tbl_frames where match_id = :'m' and lineup_slot = 5 \gset
select id as f7 from public.tbl_frames where match_id = :'m' and lineup_slot = 7 \gset
select frame_no as n5 from public.tbl_frames where match_id = :'m' and lineup_slot = 5 \gset

select tests.sign_in(:'h1');
select throws_like(
	format($$ select public.tdc_record_frame(%L, %s, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb) $$, :'m', :'n5'),
	'%player on each side%',
	'a frame with an empty seat cannot be given a result');
select tests.sign_out();

-- ─── Reserves and latecomers ───

select tests.sign_in(:'a1');
select lives_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f5', :'pa3'),
	'the latecomer takes the empty seat in session 2');
select throws_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f4', :'pa3'),
	'P0001', 'Night A3 already plays a frame in session 2. A player plays one frame a session.',
	'rule 1: nobody plays two frames in one session');
select throws_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f7', :'pa2'),
	'P0001', 'Night A2 plays position 2 tonight. A player in the lineup keeps their position; only a reserve can come in.',
	'rule 2: a player in the order cannot move to another position');
select lives_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f1', :'par'),
	'a reserve covers A1 in session 1, though they never confirmed their place');
select throws_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f7', :'par'),
	'P0001', 'Night AR has already played Night H1 tonight. A reserve may not face the same opponent twice.',
	'rule 3: a reserve cannot meet the same opponent again');
select lives_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f1', :'pa1'),
	'a position''s own player can be put back');
select tests.sign_out();

select is(
	(select player_id from public.tbl_frame_participants where frame_id = :'f1' and side = 'away'),
	:'pa1'::uuid, 'and is back in session 1');

select tests.sign_in(:'h1');
select throws_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f7', :'par'),
	'P0001', 'Only that team''s captain, or the league director, can put a reserve in.',
	'a captain cannot put a reserve into the other side''s seat');

-- ─── Signing settles the empty seats ───

select public.tdc_submit_card(:'m');
select tests.sign_out();

select is(
	(select array_agg(lineup_slot order by lineup_slot) from public.tbl_frames
	 where match_id = :'m' and result_event = 'default' and winner_side = 'home' and status = 'complete'),
	array[3, 7], 'signing turns the seats still empty into walkovers to the side that turned up');
select is(
	(select count(*)::integer from public.tbl_frames where match_id = :'m' and status = 'pending'),
	7, 'the seven frames with two players are untouched');
select is(
	private.tdc_card_state(:'m')->'sides'->'home'->>'current', 'true',
	'the signature was given at the card with its walkovers in it, so it stands');

select tests.sign_in(:'a1');
select throws_ok(
	format($$ select public.tdc_swap_frame_player(%L, %L) $$, :'f3', :'pa3'),
	'P0001', 'That frame is already settled. Changing who played it is a correction, not a reserve.',
	'a walkover is settled: a reserve cannot go into it');
select tests.sign_out();

select is(
	(select count(*)::integer from public.tbl_frames where match_id = :'m'),
	9, 'nothing was added or lost: nine frames');

select * from finish();
rollback;
