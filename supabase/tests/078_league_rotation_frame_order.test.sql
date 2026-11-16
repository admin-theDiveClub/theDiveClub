-- A rotation table may set the order of a session's frames (migration
-- 20261116182736, UV, 16 Nov).
--
-- 8-Ball Mainstream plays from Billiard Café's paper scoresheet: our cyclic
-- shift's pairings, but each session opens one home player later. A table
-- row may now be [home, away] pairs in frame order; a row of numbers means
-- what it always did. Only untouched matches take a changed table.
--
-- The sheet, five-man:
--   session 1: H1–A1 H2–A2 H3–A3 H4–A4 H5–A5   (F1–F5)
--   session 2: H2–A3 H3–A4 H4–A5 H5–A1 H1–A2   (F6–F10)
--   session 3: H3–A5 H4–A1 H5–A2 H1–A3 H2–A4   (F11–F15)
--   session 4: H4–A2 H5–A3 H1–A4 H2–A5 H3–A1   (F16–F20)
--   session 5: H5–A4 H1–A5 H2–A1 H3–A2 H4–A3   (F21–F25)
begin;
\ir _helpers.psql
select plan(22);

\set sheet '[[[1,1],[2,2],[3,3],[4,4],[5,5]],[[2,3],[3,4],[4,5],[5,1],[1,2]],[[3,5],[4,1],[5,2],[1,3],[2,4]],[[4,2],[5,3],[1,4],[2,5],[3,1]],[[5,4],[1,5],[2,1],[3,2],[4,3]]]'

select tests.rules(jsonb_build_object('team_size', 5, 'rotation', :'sheet'::jsonb)) as sheet_rules \gset

-- ─── The ruleset check ───

select lives_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, :'sheet_rules'),
	'the scoresheet''s table, written as pairs in frame order, is accepted');

-- What the settings page sends: a row whose home players are in order stays
-- numbers (session 1 here), the rest are pairs.
select tests.rules('{"team_size": 3, "rotation": [[1,2,3],[[2,3],[3,1],[1,2]],[[3,2],[1,3],[2,1]]]}') as mixed \gset
select lives_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, :'mixed'),
	'a table mixing a row of numbers and rows of pairs is accepted');
select is(
	(select string_agg(private.tdc_frame_position(:'mixed', s, 'home') || 'v'
		|| private.tdc_frame_position(:'mixed', s, 'away'), ' ' order by s)
	 from generate_series(1, 6) s),
	'1v1 2v2 3v3 2v3 3v1 1v2', 'and is read row by row');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[[1,1],[2,2],[3,3]],[[2,3],[2,1],[1,2]],[[3,2],[1,3],[2,1]]]}')),
	'P0001', 'TDC (Error): in session 2 of the rotation table, every home player must play exactly once.',
	'a home player twice in a session is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[[1,1],[2,2],[3,3]],[[2,3],[3,3],[1,2]],[[3,2],[1,3],[2,1]]]}')),
	'P0001', 'TDC (Error): in session 2 of the rotation table, every away player must play exactly once.',
	'an away player twice in a session is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[[1,1],[2,2],[3,3]],[[2,3],1,[1,2]],[[3,2],[1,3],[2,1]]]}')),
	'P0001', 'TDC (Error): session 2 of the rotation table must name 3 pairs of home and away positions.',
	'a row mixing pairs and numbers is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[[1,1],[2,2],[3,3]],[[2,3,1],[3,1],[1,2]],[[3,2],[1,3],[2,1]]]}')),
	'P0001', 'TDC (Error): session 2 of the rotation table must name 3 pairs of home and away positions.',
	'a pair of three numbers is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[[2,2],[1,1],[3,3]],[[2,3],[3,1],[1,2]],[[3,2],[1,3],[2,1]]]}')),
	'P0001', 'TDC (Error): session 1 of the rotation table is the captains'' own order — H1 v A1, H2 v A2 and so on.',
	'session 1 is still the captains'' order, frame for frame');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[1,2,3],[2,3],[3,1,2]]}')),
	'P0001', 'TDC (Error): session 2 of the rotation table must name 3 away positions.',
	'a short row of numbers keeps its old message');

-- ─── Where each frame sits ───

select is(
	(select string_agg(private.tdc_frame_position(:'sheet_rules', s, 'home') || 'v'
		|| private.tdc_frame_position(:'sheet_rules', s, 'away'), ' ' order by s)
	 from generate_series(6, 10) s),
	'2v3 3v4 4v5 5v1 1v2', 'F6–F10 follow the sheet''s session 2');

select is(
	(select string_agg(private.tdc_frame_position(:'sheet_rules', s, 'home') || 'v'
		|| private.tdc_frame_position(:'sheet_rules', s, 'away'), ' ' order by s)
	 from generate_series(21, 25) s),
	'5v4 1v5 2v1 3v2 4v3', 'F21–F25 follow the sheet''s session 5');

select is(
	(select count(distinct private.tdc_frame_position(:'sheet_rules', s, 'home') || 'v'
		|| private.tdc_frame_position(:'sheet_rules', s, 'away'))::integer
	 from generate_series(1, 25) s),
	25, 'every home player meets every away player once');

select is(
	(select array_agg(private.tdc_frame_session(:'sheet_rules', s) order by s) from generate_series(9, 12) s),
	array[2, 2, 3, 3], 'a frame''s session is still its slot''s');

select is(private.tdc_rotation_away(:'sheet_rules', 2, 1), 2,
	'who meets whom: in session 2, H1 meets A2');

-- Off the card the new branch stands aside and the old answers stand.
select is(
	array[private.tdc_frame_position(:'sheet_rules', 26, 'home'),
		private.tdc_frame_position(:'sheet_rules', 26, 'away'),
		private.tdc_frame_position(:'sheet_rules', 0, 'away')],
	array[private.tdc_frame_position(tests.rules('{"team_size": 5}'), 26, 'home'), null, null]::integer[],
	'a slot off the card answers as it did before');

select is(
	(select string_agg(private.tdc_frame_position(tests.rules('{"team_size": 5}'), s, 'home') || 'v'
		|| private.tdc_frame_position(tests.rules('{"team_size": 5}'), s, 'away'), ' ' order by s)
	 from generate_series(6, 10) s),
	'1v2 2v3 3v4 4v5 5v1', 'the cyclic shift is unchanged');

select is(
	(select string_agg(private.tdc_frame_position(tests.rules('{"team_size": 3, "rotation": [[1,2,3],[1,3,2],[2,1,3]]}'), s, 'home') || 'v'
		|| private.tdc_frame_position(tests.rules('{"team_size": 3, "rotation": [[1,2,3],[1,3,2],[2,1,3]]}'), s, 'away'), ' ' order by s)
	 from generate_series(4, 9) s),
	'1v1 2v3 3v2 1v2 2v1 3v3', 'a table of numbers is unchanged');

-- ─── A night: only untouched matches take the new order ───
-- Three-man, the sheet's shape:
--   session 1: H1–A1 H2–A2 H3–A3;  session 2: H2–A3 H3–A1 H1–A2;
--   session 3: H3–A2 H1–A3 H2–A1

select tests.create_user('Order Dee') as dee \gset
select tests.create_user('Order H1') as h1 \gset
select tests.create_user('Order H2') as h2 \gset
select tests.create_user('Order H3') as h3 \gset
select tests.create_user('Order A1') as a1 \gset
select tests.create_user('Order A2') as a2 \gset
select tests.create_user('Order A3') as a3 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'h3') as ph3 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset
select tests.player_of(:'a3') as pa3 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Order League', tests.rules('{"team_size": 3}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'ph3', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_add_league_entrant(:'season', :'pa3', :'ta');
select public.tdc_generate_league_fixtures(:'season', p_times_played => 2);
select id as fx1 from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null order by round, position limit 1 \gset
select id as fx2 from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null order by round, position offset 1 limit 1 \gset
select public.tdc_set_league_fixture(:'fx1', p_home_team_id => :'th', p_away_team_id => :'ta');
select public.tdc_set_league_fixture(:'fx2', p_home_team_id => :'th', p_away_team_id => :'ta');
select public.tdc_create_league_match(:'fx1') as m1 \gset
select public.tdc_create_league_match(:'fx2') as m2 \gset
select tests.sign_out();

-- Match 1 is under way before the change: both sides lock under the shift.
select tests.sign_in(:'h1');
select public.tdc_submit_lineup(:'m1', 'home', array[:'ph1', :'ph2', :'ph3']::uuid[], array[:'ph1', :'ph2', :'ph3']::uuid[]);
select tests.sign_out();
select tests.sign_in(:'a1');
select public.tdc_submit_lineup(:'m1', 'away', array[:'pa1', :'pa2', :'pa3']::uuid[], array[:'pa1', :'pa2', :'pa3']::uuid[]);
select tests.sign_out();

select tests.sign_in(:'dee');
select is(
	public.tdc_update_league(:'league', null,
		tests.rules('{"team_size": 3, "rotation": [[[1,1],[2,2],[3,3]],[[2,3],[3,1],[1,2]],[[3,2],[1,3],[2,1]]]}')),
	'{"matches_updated": 1, "matches_kept": 1}'::jsonb,
	'saving the table updates the untouched match and keeps the one under way');
select tests.sign_out();

select is(
	(select rules->'rotation' from public.tbl_matches where id = :'m1'),
	'null'::jsonb, 'the match under way keeps the cyclic shift it was frozen with');

select tests.sign_in(:'h1');
select is(
	(select string_agg(home_position || 'v' || away_position, ' ' order by frame_no) from public.tdc_match_card(:'m1')),
	'1v1 2v2 3v3 1v2 2v3 3v1 1v3 2v1 3v2', 'and its frames are where they were');
select tests.sign_out();

-- Match 2 had not started: it plays the new order.
select tests.sign_in(:'h1');
select public.tdc_submit_lineup(:'m2', 'home', array[:'ph1', :'ph2', :'ph3']::uuid[], array[:'ph1', :'ph2', :'ph3']::uuid[]);
select tests.sign_out();
select tests.sign_in(:'a1');
select public.tdc_submit_lineup(:'m2', 'away', array[:'pa1', :'pa2', :'pa3']::uuid[], array[:'pa1', :'pa2', :'pa3']::uuid[]);
select tests.sign_out();

select tests.sign_in(:'h1');
select is(
	(select string_agg(frame_no || ':' || session || ':' || home_position || 'v' || away_position, ' ' order by frame_no) from public.tdc_match_card(:'m2')),
	'1:1:1v1 2:1:2v2 3:1:3v3 4:2:2v3 5:2:3v1 6:2:1v2 7:3:3v2 8:3:1v3 9:3:2v1',
	'the untouched match is built in the new order, session by session');
select is(
	(select home_player_id::text || away_player_id::text from public.tdc_match_card(:'m2') where frame_no = 4),
	:'ph2' || :'pa3', 'F4 seats H2 against A3');
select tests.sign_out();

select * from finish();
rollback;
