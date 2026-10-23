-- Recording and removing frames: tdc_record_frame, tdc_remove_frame.
--
-- Frames are the only record: the score is counted from them. One call creates
-- or replaces a frame number; removing one closes the numbering up. The break
-- side is derived by the match's rule unless someone corrects it by hand, and a
-- correction carries through to the frames after it. Every change bumps
-- card_version, and a write aimed at an older version is refused with TDC01.
begin;
\ir _helpers.psql
select plan(46);

select tests.create_user('Frames Alice') as alice \gset
select tests.create_user('Frames Bob') as bob \gset
select tests.player_of(:'alice') as alice_p \gset
select tests.player_of(:'bob') as bob_p \gset

-- Alternate breaks, home breaks first, breaks tracked.
select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules('{"track_breaks": true}'), 'home') as m \gset

-- ─── Recording ───

select isnt(public.tdc_record_frame(:'m', 1, '{"winner_side": "home", "result_event": "win"}'), null, 'a player records a frame');

select tests.sign_out();
select is((select card_version from public.tbl_matches where id = :'m'), 1, 'recording a frame bumps card_version');
select is((select status from public.tbl_matches where id = :'m'), 'in_progress', 'the first frame puts the match in progress');
select isnt((select started_at from public.tbl_matches where id = :'m'), null, 'the first frame starts the match clock');
select is((select status from public.tbl_frames where match_id = :'m' and frame_no = 1), 'complete', 'a frame is complete unless it says otherwise');
select is(
	(select array_agg(fp.side || ':' || fp.player_id order by fp.side) from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id where f.match_id = :'m' and f.frame_no = 1),
	array['away:' || :'bob_p', 'home:' || :'alice_p'],
	'a singles frame names both players as participants without being told');
select is((select break_side from public.tbl_frames where match_id = :'m' and frame_no = 1), 'home', 'frame 1 is broken by the first-break side');

select tests.sign_in(:'bob');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'m'), 'the other player records a frame too');
select lives_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "home", "result_event": "win"}') $$, :'m'), 'and another');

select results_eq(
	format($$ select home_score, away_score from public.tdc_match_score(%L) $$, :'m'),
	$$ values (2, 1) $$,
	'the score is counted from the frames');

select tests.sign_out();
select is(
	(select array_agg(break_side order by frame_no) from public.tbl_frames where match_id = :'m'),
	array['home', 'away', 'home'],
	'alternate breaks flip each frame');

-- ─── Replacing a frame ───

select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "home", "result_event": "win"}') $$, :'m'), 'recording an existing frame number corrects it');
select results_eq(
	format($$ select home_score, away_score from public.tdc_match_score(%L) $$, :'m'),
	$$ values (3, 0) $$,
	'the correction changes the score');
select is((select count(*)::integer from public.tbl_frames where match_id = :'m'), 3, 'a correction does not add a frame');
select is((select card_version from public.tbl_matches where id = :'m'), 4, 'a correction bumps card_version');

-- ─── Correcting the break side ───

select lives_ok(
	format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "break_side": "away", "result_event": "win"}') $$, :'m'),
	'a player corrects who broke frame 1');

select tests.sign_out();
select is((select break_side_manual from public.tbl_frames where match_id = :'m' and frame_no = 1), true, 'a break side that differs from the rule is recorded as a correction');
select is(
	(select array_agg(break_side order by frame_no) from public.tbl_frames where match_id = :'m'),
	array['away', 'home', 'away'],
	'the frames after a correction follow it');

-- Passing the side the rule would have given anyway is not a correction.
select tests.sign_in(:'alice');
select public.tdc_record_frame(:'m', 2, '{"winner_side": "home", "break_side": "home", "result_event": "win"}');
select tests.sign_out();
select is((select break_side_manual from public.tbl_frames where match_id = :'m' and frame_no = 2), false, 'giving the derived side is not marked as a correction');

-- ─── Removing a frame ───

select tests.sign_in(:'alice');
select card_version as v_before from public.tbl_matches where id = :'m' \gset
select lives_ok(format($$ select public.tdc_remove_frame(%L, 1) $$, :'m'), 'a player removes frame 1');

select tests.sign_out();
select is(
	(select array_agg(frame_no order by frame_no) from public.tbl_frames where match_id = :'m'),
	array[1, 2],
	'removing a frame closes the numbering up');
select is((select card_version from public.tbl_matches where id = :'m'), :'v_before'::integer + 1, 'removing a frame bumps card_version');
select is(
	(select array_agg(break_side order by frame_no) from public.tbl_frames where match_id = :'m'),
	array['home', 'away'],
	'removing the corrected frame re-derives the break sides after it');

-- The recipe that failed every time before 20261023185340: correcting frame 2
-- moves its row to the end of the table, and a single renumbering update then
-- reached frame 3 first and collided with it.
select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as mr \gset
select public.tdc_record_frame(:'mr', n, '{"winner_side": "home", "result_event": "win"}') from generate_series(1, 3) n;
select public.tdc_record_frame(:'mr', 2, '{"winner_side": "away", "result_event": "win"}');
select lives_ok(format($$ select public.tdc_remove_frame(%L, 1) $$, :'mr'), 'removing frame 1 after correcting frame 2 works');
select is(
	(select array_agg(winner_side order by frame_no) from public.tbl_frames where match_id = :'mr'),
	array['away', 'home'],
	'the frames after it move down in order, keeping their results');

select throws_ok(format($$ select public.tdc_remove_frame(%L, 9) $$, :'m'),
	'P0001', 'TDC (Error): frame 9 is not on this match.', 'removing a frame that is not there is refused');

-- ─── Refusals on the frame itself ───

select throws_ok(format($$ select public.tdc_record_frame(%L, 0, '{"winner_side": "home", "result_event": "win"}') $$, :'m'),
	'P0001', 'TDC (Error): a match id and a frame number of 1 or more are required.', 'frame numbers start at 1');

select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner": "home"}') $$, :'m'),
	'P0001', 'TDC (Error): unknown frame field(s) winner.', 'an unknown field is refused, not dropped');

select throws_ok(format($$ select public.tdc_record_frame(%L, 3, %L) $$, :'m',
		jsonb_build_object('winner_side', 'home', 'result_event', 'win', 'home_players', jsonb_build_array(:'bob_p'))),
	'P0001', 'TDC (Error): the home side of this match is one player and cannot be changed per frame.',
	'a singles side cannot be given a different player');

select throws_ok(format($$ select public.tdc_record_frame(%L, 3, %L) $$, :'m',
		jsonb_build_object('winner_side', 'home', 'result_event', 'win', 'break_side', 'home', 'break_player_id', :'bob_p')),
	'P0001', 'TDC (Error): the breaking player is not on the side that broke.',
	'the breaker must be on the breaking side');

select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "away", "break_side": "home", "result_event": "break_and_finish"}') $$, :'m'),
	'P0001', 'TDC (Error): in this match a break and finish must go to the side that broke.',
	'a break and finish goes to the breaker when the rule says so');

select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "home", "break_side": "home", "result_event": "default"}') $$, :'m'),
	'P0001', 'TDC (Error): a frame awarded by default has no break. Remove the break fields.',
	'a frame awarded by default has no break');

select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"result_event": "default"}') $$, :'m'),
	'P0001', 'TDC (Error): a frame awarded by default still needs a winning side.',
	'a frame awarded by default needs a winner');

select lives_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "away", "result_event": "default"}') $$, :'m'),
	'a frame can be awarded by default');
select tests.sign_out();
select is((select break_side from public.tbl_frames where match_id = :'m' and frame_no = 3), null, 'a frame awarded by default is stored with no break side');

-- ─── The card version guard ───

select card_version as v from public.tbl_matches where id = :'m' \gset
select count(*) as n from public.tbl_frames where match_id = :'m' \gset

select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_record_frame(%L, 4, '{"winner_side": "away", "result_event": "win"}', %s) $$, :'m', :'v'::integer - 1),
	'TDC01', 'TDC (Conflict): somebody else has scored on this match. Your change was not saved.',
	'a frame written against an older card is refused with TDC01');
select throws_ok(format($$ select public.tdc_remove_frame(%L, 1, %s) $$, :'m', :'v'::integer - 1),
	'TDC01', 'TDC (Conflict): somebody else has scored on this match. Your change was not saved.',
	'a frame removed against an older card is refused with TDC01');

select tests.sign_out();
select is((select count(*)::integer from public.tbl_frames where match_id = :'m'), :'n'::integer, 'a refused write adds or removes nothing');
select is((select card_version from public.tbl_matches where id = :'m'), :'v'::integer, 'a refused write does not move the card');

select tests.sign_in(:'bob');
select lives_ok(format($$ select public.tdc_record_frame(%L, 4, '{"winner_side": "away", "result_event": "win"}', %s) $$, :'m', :'v'),
	'a frame written against the current card is accepted');
select lives_ok(format($$ select public.tdc_record_frame(%L, 5, '{"winner_side": "away", "result_event": "win"}') $$, :'m'),
	'no version given means no check (the offline queue checks once up front)');
select lives_ok(format($$ select public.tdc_remove_frame(%L, 5, %s) $$, :'m', :'v'::integer + 2),
	'a frame removed against the current card is accepted');

-- ─── The other break rules ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules('{"track_breaks": true, "break_determination": "winner_breaks"}'), 'home') as mw \gset
select public.tdc_record_frame(:'mw', 1, '{"winner_side": "away", "result_event": "win"}');
select public.tdc_record_frame(:'mw', 2, '{"winner_side": "away", "result_event": "win"}');
select public.tdc_create_match(:'bob_p', tests.rules('{"track_breaks": true, "break_determination": "lag_each_frame"}'), 'home') as ml \gset
select public.tdc_record_frame(:'ml', 1, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_record_frame(:'ml', 2, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_out();

select is(
	(select array_agg(break_side order by frame_no) from public.tbl_frames where match_id = :'mw'),
	array['home', 'away'],
	'winner breaks: the winner of the frame before breaks the next');
select is(
	(select count(*)::integer from public.tbl_frames where match_id = :'ml' and break_side is null),
	2,
	'lag each frame: the rule has no answer, so the break side is left empty');

-- ─── An abandoned match ───

update public.tbl_matches set status = 'abandoned' where id = :'mw';
select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "home", "result_event": "win"}') $$, :'mw'),
	'P0001', 'This match was abandoned. Frames can no longer be changed.', 'an abandoned match takes no more frames');
select throws_ok(format($$ select public.tdc_remove_frame(%L, 1) $$, :'mw'),
	'P0001', 'This match was abandoned. Frames can no longer be changed.', 'an abandoned match loses no frames');
select tests.sign_out();

select * from finish();
rollback;
