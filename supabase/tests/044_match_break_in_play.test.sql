-- The break event of the frame in play, saved on the match (20261030155332):
-- tdc_set_break_in_play.
--
-- Whoever may score the match saves it, for the frame in play only, and
-- never once the card is settled. It never moves card_version, so a
-- submission stands; every frame write moves card_version on, which is how
-- the page knows a stored event is old.
begin;
\ir _helpers.psql
select plan(19);

select tests.create_user('Break Alice') as alice \gset
select tests.create_user('Break Bob') as bob \gset
select tests.create_user('Break Stranger') as stranger \gset
select tests.player_of(:'bob') as bob_p \gset

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules('{"track_breaks": true}'), 'home') as m \gset

-- ─── Setting it ───

select lives_ok(format($$ select public.tdc_set_break_in_play(%L, 1, 'in') $$, :'m'), 'a player saves the break event of frame 1');

select tests.sign_out();
select results_eq(
	format($$ select break_in_play, break_in_play_frame_no, break_in_play_card_version from public.tbl_matches where id = %L $$, :'m'),
	$$ values ('in'::text, 1, 0) $$,
	'it is stored with its frame and the card version it was tapped at');
select is((select card_version from public.tbl_matches where id = :'m'), 0, 'saving it does not move card_version');

select tests.sign_in(:'bob');
select lives_ok(format($$ select public.tdc_set_break_in_play(%L, 1, 'dry') $$, :'m'), 'the other player changes it');
select tests.sign_out();
select is((select break_in_play from public.tbl_matches where id = :'m'), 'dry', 'the latest tap stands');

-- ─── Refused ───

select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_set_break_in_play(%L, 1, 'in') $$, :'m'),
	'P0001', 'Only the people scoring this match can enter its break event.', 'somebody not in the match is refused');
select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_set_break_in_play(%L, 1, 'in') $$, :'m'),
	'42501', null, 'anon cannot call it');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_set_break_in_play(%L, 2, 'in') $$, :'m'),
	'TDC01', 'Someone else has scored this match: frame 1 is the one in play.', 'a frame that is not in play is refused');
select throws_ok(format($$ select public.tdc_set_break_in_play(%L, 1, 'golden') $$, :'m'),
	'P0001', 'TDC (Error): golden is not a break event.', 'something that is not a break event is refused');
select throws_ok(format($$ update public.tbl_matches set break_in_play = 'in' where id = %L $$, :'m'),
	'42501', null, 'a player cannot write it straight to the table');

-- ─── A frame saved makes it old ───

select public.tdc_record_frame(:'m', 1, '{"winner_side": "home", "result_event": "win", "break_outcome": "dry"}');
select tests.sign_out();
select isnt((select card_version from public.tbl_matches where id = :'m'),
	(select break_in_play_card_version from public.tbl_matches where id = :'m'),
	'once frame 1 is saved the stored event no longer matches the card');

select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_set_break_in_play(%L, 2, 'foul') $$, :'m'), 'frame 2 is in play next');
select throws_ok(format($$ select public.tdc_set_break_in_play(%L, 1, 'in') $$, :'m'),
	'TDC01', 'Someone else has scored this match: frame 2 is the one in play.', 'frame 1 is no longer in play');

select public.tdc_record_frame(:'m', 2, '{"winner_side": "away", "result_event": "win"}');
select public.tdc_set_break_in_play(:'m', 3, 'in');
select tests.sign_out();
select card_version as v_before from public.tbl_matches where id = :'m' \gset
select tests.sign_in(:'alice');
select public.tdc_remove_frame(:'m', 2);
select tests.sign_out();
select isnt((select card_version from public.tbl_matches where id = :'m'), :v_before,
	'removing a frame (an undo) also makes the stored event old');

-- ─── The card ───

select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m');
select lives_ok(format($$ select public.tdc_set_break_in_play(%L, 2, 'in') $$, :'m'), 'a submitted card still takes a break event');
select is(public.tdc_card_state(:'m')->>'state', 'awaiting', 'and its submission stands');

select tests.sign_in(:'bob');
select is(public.tdc_answer_card(:'m', true)->>'state', 'agreed', 'the card is agreed');
select throws_ok(format($$ select public.tdc_set_break_in_play(%L, 2, 'dry') $$, :'m'),
	'P0001', 'This scorecard is settled, so no frame is in play.', 'a settled card takes none');
select tests.sign_out();
select is((select break_in_play from public.tbl_matches where id = :'m'), 'in', 'and keeps what it had');

select * from finish();
rollback;
