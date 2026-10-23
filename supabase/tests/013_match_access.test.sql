-- Who may touch a card: private.tdc_can_edit_match, asked through
-- tdc_may_edit_match and by every write.
--
-- Either player in a singles match, venue staff at the match's venue, and
-- anyone holding a role in a tournament the match belongs to — but in a
-- tournament only if senior enough for its score_entry_mode. Nobody writes the
-- tables directly; every write goes through a tdc_ function. Answering a card
-- is narrower than editing it: only the players answer, which is what makes
-- an answer worth anything. Captains and league directors are in the leagues
-- tests.
begin;
\ir _helpers.psql
select plan(38);

select tests.create_user('Access Alice') as alice \gset
select tests.create_user('Access Bob') as bob \gset
select tests.create_user('Access Carol') as carol \gset
select tests.create_user('Access Staff') as staff \gset
select tests.create_user('Access Other Staff') as other_staff \gset
select tests.create_user('Access Director') as td \gset
select tests.create_user('Access Referee') as ref \gset
select tests.create_user('Access Scorer') as scorer \gset
select tests.player_of(:'alice') as alice_p \gset
select tests.player_of(:'bob') as bob_p \gset
select tests.player_of(:'staff') as staff_p \gset

insert into public.tbl_venues (name, slug) values ('Access Venue', 'access-venue') returning id as venue \gset
insert into public.tbl_venues (name, slug) values ('Other Venue', 'other-venue') returning id as venue2 \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'venue', :'staff', 'staff'), (:'venue2', :'other_staff', 'owner');

-- A social match with no venue, and one at the venue.
select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as m \gset
select public.tdc_create_match(:'bob_p', tests.rules(), null, :'venue') as mv \gset
select public.tdc_record_frame(:'m', 1, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_out();

-- ─── The players, and someone who is not one ───

select tests.sign_in(:'alice');
select is(public.tdc_may_edit_match(:'m'), true, 'the home player may edit');
select tests.sign_in(:'bob');
select is(public.tdc_may_edit_match(:'m'), true, 'the away player may edit');
select tests.sign_in(:'carol');
select is(public.tdc_may_edit_match(:'m'), false, 'someone not in the match may not');
select is(public.tdc_may_edit_match(gen_random_uuid()), false, 'a match that does not exist answers false, not null');

select throws_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'m'),
	'P0001', 'You are not on this match and cannot change its score.', 'an outsider cannot record a frame');
select throws_ok(format($$ select public.tdc_remove_frame(%L, 1) $$, :'m'),
	'P0001', 'You are not on this match and cannot change its score.', 'an outsider cannot remove a frame');
select throws_ok(format($$ select public.tdc_rederive_break_sides(%L) $$, :'m'),
	'P0001', 'You are not on this match and cannot change its score.', 'an outsider cannot re-derive the break sides');

-- Watching is allowed: the match page and Realtime rely on signed-in reads.
select is((select count(*)::integer from public.tbl_matches where id = :'m'), 1, 'an outsider who is signed in can see the match');
select is((select count(*)::integer from public.tbl_frames where match_id = :'m'), 1, 'and its frames');
select is(public.tdc_card_state(:'m')->>'state', 'in_progress', 'and its card state');

-- ─── Nobody writes the tables directly ───

select tests.sign_in(:'alice');
select throws_ok(format($$ insert into public.tbl_frames (match_id, frame_no, winner_side, result_event) values (%L, 2, 'home', 'win') $$, :'m'),
	'42501', null, 'a player cannot insert a frame directly');
select throws_ok(format($$ update public.tbl_frames set winner_side = 'away' where match_id = %L $$, :'m'),
	'42501', null, 'a player cannot update a frame directly');
select throws_ok(format($$ update public.tbl_matches set card_version = 0 where id = %L $$, :'m'),
	'42501', null, 'a player cannot update a match directly');
select throws_ok(format($$ insert into public.tbl_match_events (match_id, player_id, kind, card_version) values (%L, %L, 'agreed', 1) $$, :'m', :'alice_p'),
	'42501', null, 'a player cannot write a card event directly');

-- The private helpers are kept off the API by the API serving only public
-- (config.toml), not by grants: authenticated holds execute on them by
-- convention (20261022130000). anon has no usage on the schema at all.
select tests.sign_in_anon();
select throws_ok(format($$ select private.tdc_can_edit_match(%L) $$, :'m'),
	'42501', null, 'someone not signed in cannot reach the private helpers');
select throws_ok('select * from public.tbl_matches', '42501', null, 'someone not signed in cannot read matches');
select throws_ok(format($$ select public.tdc_may_edit_match(%L) $$, :'m'), '42501', null, 'someone not signed in cannot ask');
select throws_ok(format($$ select public.tdc_record_frame(%L, 2, '{}') $$, :'m'), '42501', null, 'someone not signed in cannot record a frame');

-- ─── Venue staff ───

select tests.sign_in(:'staff');
select is(public.tdc_may_edit_match(:'mv'), true, 'staff at the match''s venue may edit it');
select is(public.tdc_may_edit_match(:'m'), false, 'staff may not edit a match with no venue');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}') $$, :'mv'),
	'venue staff can record a frame');

select tests.sign_in(:'other_staff');
select is(public.tdc_may_edit_match(:'mv'), false, 'staff at another venue may not, even its owner');

-- Staff can submit on the players' behalf, and the event says it was them.
-- They cannot answer: an answer is the players' word.
select tests.sign_in(:'staff');
select is(public.tdc_submit_card(:'mv')->>'submitted_by', :'staff_p'::text, 'venue staff can submit a card, and it is attributed to them');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'mv'),
	'P0001', 'Only the players in this match can answer its scorecard.', 'venue staff cannot answer a card');
select tests.sign_in(:'alice');
select is(public.tdc_answer_card(:'mv', true)->>'state', 'agreed', 'either player answers a card staff submitted');

-- ─── A tournament's officials ───

select tests.sign_out();
insert into public.tbl_tournaments (name, rules) values ('Access Open', tests.rules()) returning id as t \gset
insert into public.tbl_competition_roles (tournament_id, player_id, role) values
	(:'t', tests.player_of(:'td'), 'director'),
	(:'t', tests.player_of(:'ref'), 'referee'),
	(:'t', tests.player_of(:'scorer'), 'scorer');

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as mt \gset
select public.tdc_create_match(:'bob_p', tests.rules('{"score_entry_mode": "td_only"}')) as mt_td \gset
select public.tdc_create_match(:'bob_p', tests.rules('{"score_entry_mode": "referee"}')) as mt_ref \gset
select tests.sign_out();
insert into public.tbl_tournament_fixtures (tournament_id, round, position, match_id) values
	(:'t', 1, 1, :'mt'), (:'t', 1, 2, :'mt_td'), (:'t', 1, 3, :'mt_ref');

select tests.sign_in(:'td');
select is(public.tdc_may_edit_match(:'mt'), true, 'the tournament director may edit a match in their tournament');
select is(public.tdc_may_edit_match(:'m'), false, 'but not a match outside it');
select tests.sign_in(:'ref');
select is(public.tdc_may_edit_match(:'mt'), true, 'a referee of the tournament may edit');
select tests.sign_in(:'scorer');
select is(public.tdc_may_edit_match(:'mt'), true, 'a scorer of the tournament may edit');

-- score_entry_mode raises the bar inside a tournament.
select tests.sign_in(:'alice');
select is(public.tdc_may_edit_match(:'mt'), true, 'with score entry by players, a player in the match may edit');
select is(public.tdc_may_edit_match(:'mt_td'), false, 'with score entry by the TD only, a player in the match may not');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}') $$, :'mt_td'),
	'P0001', 'You are not on this match and cannot change its score.', 'and their frame is refused');
select is(public.tdc_may_edit_match(:'mt_ref'), false, 'with score entry by referees, a player may not');
select tests.sign_in(:'scorer');
select is(public.tdc_may_edit_match(:'mt_ref'), false, 'with score entry by referees, a scorer may not');
select tests.sign_in(:'ref');
select is(public.tdc_may_edit_match(:'mt_ref'), true, 'with score entry by referees, a referee may');
select tests.sign_in(:'td');
select is(public.tdc_may_edit_match(:'mt_td'), true, 'the director may edit whatever the score entry mode');

-- A frame an official set cannot be overwritten by someone junior to them.
select public.tdc_record_frame(:'mt', 1, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'mt'),
	'P0001', 'Frame 1 was last set by the tournament director. Ask them to change it.', 'a player cannot overwrite a frame the director set');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'mt'),
	'but can still record a frame of their own');

select tests.sign_out();
select * from finish();
rollback;
