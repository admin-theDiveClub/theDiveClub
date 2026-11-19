-- Doubles: a social match with more than one player a side (migration
-- 20261119124608, UV 19 Nov).
--
--   creating     tdc_create_team_match: equal sides of 2–4, you in it, nobody twice
--   scoring      any seat may score, frame 1 included; every frame goes to the
--                side's seats in order; the pairs are fixed
--   the card     any player on the other side answers; the submitter's partner may not
--   deleting     any seat may delete a social one; the record keeps every seat
begin;
\ir _helpers.psql
select plan(22);

select tests.create_user('Dbl Alice') as alice \gset
select tests.create_user('Dbl Bob') as bob \gset
select tests.create_user('Dbl Carol') as carol \gset
select tests.create_user('Dbl Dan') as dan \gset
select tests.create_user('Dbl Stranger') as stranger \gset
select tests.player_of(:'alice') as alice_p \gset
select tests.player_of(:'bob') as bob_p \gset
select tests.player_of(:'carol') as carol_p \gset
select tests.player_of(:'dan') as dan_p \gset
select tests.player_of(:'stranger') as stranger_p \gset

-- ─── Creating ───

select tests.sign_in(:'alice');

select throws_ok(format($$ select public.tdc_create_team_match(array[%L]::uuid[], array[%L]::uuid[], tests.rules()) $$,
	:'alice_p', :'carol_p'),
	'P0001', 'TDC (Error): a team match needs two to four players a side, not 1.', 'one a side is refused (that is singles)');
select throws_ok(format($$ select public.tdc_create_team_match(array[%L, %L]::uuid[], array[%L]::uuid[], tests.rules()) $$,
	:'alice_p', :'bob_p', :'carol_p'),
	'P0001', 'Both sides need the same number of players.', 'unequal sides are refused');
select throws_ok(format($$ select public.tdc_create_team_match(array[%L, %L]::uuid[], array[%L, %L]::uuid[], tests.rules()) $$,
	:'alice_p', :'bob_p', :'carol_p', :'bob_p'),
	'P0001', 'A player can only take one seat in a match.', 'a player twice is refused');
select throws_ok(format($$ select public.tdc_create_team_match(array[%L, %L]::uuid[], array[%L, %L]::uuid[], tests.rules()) $$,
	:'stranger_p', :'bob_p', :'carol_p', :'dan_p'),
	'P0001', 'You can only start a match you are playing in.', 'a match you are not in is refused');

select public.tdc_create_team_match(array[:'alice_p', :'bob_p']::uuid[], array[:'carol_p', :'dan_p']::uuid[], tests.rules()) as m \gset

select is((select array_agg(player_id order by side desc, seat) from public.tbl_match_side_players where match_id = :'m'),
	array[:'alice_p', :'bob_p', :'carol_p', :'dan_p']::uuid[], 'every seat is recorded, home then away, in order');
select is((select home_player_id from public.tbl_matches where id = :'m'), :'alice_p'::uuid,
	'seat 1 is also the match''s home player, so singles readers still see a name');
select is((select away_player_id from public.tbl_matches where id = :'m'), :'carol_p'::uuid,
	'and the away player');
select tests.sign_out();

-- ─── Scoring ───

select tests.sign_in(:'bob');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}') $$, :'m'),
	'a partner in seat 2 scores frame 1, before being in any frame');
select tests.sign_out();

select is((select array_agg(fp.player_id order by fp.play_order) from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id where f.match_id = :'m' and f.frame_no = 1 and fp.side = 'home'),
	array[:'alice_p', :'bob_p']::uuid[], 'the frame goes to both home players, in seat order');
select is((select array_agg(fp.player_id order by fp.play_order) from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id where f.match_id = :'m' and f.frame_no = 1 and fp.side = 'away'),
	array[:'carol_p', :'dan_p']::uuid[], 'and to both away players');

select tests.sign_in(:'dan');
select throws_ok(format($$ select public.tdc_record_frame(%L, 2, %L::jsonb) $$, :'m',
		json_build_object('winner_side', 'away', 'result_event', 'win', 'away_players', array[:'dan_p'])),
	'P0001', 'TDC (Error): the away side of this match is fixed and cannot be changed per frame.',
	'the pairs are fixed: a frame for one away player alone is refused');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'m'),
	'an away player scores too');
select tests.sign_out();

select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "away", "result_event": "win"}') $$, :'m'),
	'P0001', 'You are not on this match and cannot change its score.', 'a stranger may not score it');
select tests.sign_out();

-- ─── The card ───

select tests.sign_in(:'alice');
select is(public.tdc_submit_card(:'m')->>'state', 'awaiting', 'a home player submits');
select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'m'),
	'P0001', 'Your side submitted this scorecard. The other side answers it.',
	'the submitter''s partner may not agree');
select throws_ok(format($$ select public.tdc_answer_card(%L, false, 'wrong score') $$, :'m'),
	'P0001', 'Your side submitted this scorecard. The other side answers it.',
	'nor dispute');
select tests.sign_in(:'dan');
select is(public.tdc_answer_card(:'m', true)->>'state', 'agreed', 'any player on the other side agrees, and it is settled');
select tests.sign_in(:'carol');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'m'),
	'P0001', 'There is nothing waiting to be answered on this scorecard.',
	'the first answer settled it: their partner has nothing left to answer');
select tests.sign_out();

-- ─── Deleting ───

select tests.sign_in(:'carol');
select public.tdc_create_team_match(array[:'alice_p', :'bob_p']::uuid[], array[:'carol_p', :'dan_p']::uuid[], tests.rules()) as m2 \gset
select tests.sign_in(:'dan');
select is(public.tdc_may_delete_match(:'m2'), true, 'any seat may delete a social doubles match');
select lives_ok(format($$ select public.tdc_delete_match(%L) $$, :'m2'), 'and does');
select tests.sign_out();

select is((select array[home_players, away_players] from public.tbl_deleted_matches where match_id = :'m2'),
	array[array[:'alice_p', :'bob_p'], array[:'carol_p', :'dan_p']]::uuid[][],
	'the deleted record keeps every seat, for the notification');
select is((select summary from public.tbl_deleted_matches where match_id = :'m2'),
	'Dbl Alice & Dbl Bob 0 – Dbl Carol & Dbl Dan 0, 0 frames', 'and names both sides in full');

select * from finish();
rollback;
