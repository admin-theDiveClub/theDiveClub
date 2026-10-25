-- A referee for one match (migration 20261024162559).
--
--   who sets it      either player of a social match, the director of a
--                    tournament match, the league director of a league
--                    match; nobody once the card is settled; the referee
--                    themselves cannot (unless they also play)
--   who may be one   anyone with an account, a player in the match included;
--                    never a walk-in
--   what they do     score the match at rank 50, outranking the players; the
--                    director still outranks them; they may submit the card
--                    but only the players answer it
--   removed          in a social match the players get the frames back
--   their list       the match is in their match list, flagged, never "Needs you"
--   the merge        a claim carries the referee onto the walk-in record
begin;
\ir _helpers.psql
select plan(46);

select tests.create_user('Ref Alice') as alice \gset
select tests.create_user('Ref Bob') as bob \gset
select tests.create_user('Ref Rae') as rae \gset
select tests.create_user('Ref Stranger') as stranger \gset
select tests.create_user('Ref TD') as td \gset
select tests.create_user('Ref LD') as ld \gset
select tests.create_user('Ref H1') as h1 \gset
select tests.create_user('Ref A1') as a1 \gset
select tests.create_user('Ref Kim') as kim \gset
select tests.create_user('Ref Staff') as staff \gset
select tests.player_of(:'alice') as alice_p \gset
select tests.player_of(:'bob') as bob_p \gset
select tests.player_of(:'rae') as rae_p \gset
select tests.player_of(:'kim') as kim_p \gset

insert into public.tbl_venues (name, slug) values ('Ref Venue', 'ref-venue') returning id as venue \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'venue', :'staff', 'staff');
select tests.sign_in(:'staff');
select public.tdc_create_walk_in(:'venue', 'Walter Walk-in') as walter \gset
select public.tdc_create_walk_in(:'venue', 'Kim Walk-in') as wkim \gset
select tests.sign_out();


-- ─── Social: who sets it ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as social \gset

select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'social', :'rae_p'),
	'P0001', 'You are not on this match and cannot change its settings.', 'social: a stranger cannot pick a referee');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'social', :'walter'),
	'P0001', 'Only a player with an account can referee a match.', 'social: a walk-in cannot referee');
select lives_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'social', :'rae_p'),
	'social: a player picks a referee');
select tests.sign_out();
select is((select referee_player_id from public.tbl_matches where id = :'social'), :'rae_p'::uuid, 'and it is stored');


-- ─── Social: what the referee may do ───

select tests.sign_in(:'rae');
select is(public.tdc_may_edit_match(:'social'), true, 'social: the referee may score');
select is(public.tdc_may_change_match(:'social'), false, 'social: but not change the rules');
select throws_ok(format($$ select public.tdc_set_match_referee(%L, null) $$, :'social'),
	'P0001', 'Only the players can change who referees this match.', 'social: nor remove themselves');
select is(private.tdc_score_rank(:'social'), 50, 'social: the referee is rank 50');

select tests.sign_in(:'alice');
select is(private.tdc_score_rank(:'social'), 0, 'social: a player is rank 0');
select public.tdc_record_frame(:'social', 1, '{"winner_side": "home", "result_event": "win"}');

select tests.sign_in(:'rae');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'social'),
	'social: the referee corrects a frame a player recorded');
select tests.sign_out();
select is((select editor_rank from public.tbl_frame_edit where match_id = :'social' and frame_no = 1 order by created_at desc limit 1),
	50, 'and the edit is logged at rank 50');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}') $$, :'social'),
	'P0001', 'Frame 1 was last set by the referee. Ask them to change it.', 'social: a player cannot change the referee''s frame');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "home", "result_event": "win"}') $$, :'social'),
	'social: a player still scores a frame the referee has not touched');

select tests.sign_in(:'stranger');
select is(public.tdc_may_edit_match(:'social'), false, 'social: a stranger still may not score');


-- ─── Social: the referee in their match list ───

select tests.sign_in(:'rae');
select is((select refereeing from public.tdc_my_matches() where id = :'social'), true, 'list: the referee sees the match, flagged');
select is((select opponent from public.tdc_my_matches() where id = :'social'), 'Ref Alice : Ref Bob', 'list: named as both players, with a colon (20261025075828)');
select is((select my_frames || '-' || their_frames from public.tdc_my_matches() where id = :'social'), '1-1', 'list: the score home first');

select tests.sign_in(:'alice');
select is((select refereeing from public.tdc_my_matches() where id = :'social'), false, 'list: a player''s row is not flagged');

-- The referee may submit; only a player answers.
select tests.sign_in(:'rae');
select lives_ok(format($$ select public.tdc_submit_card(%L) $$, :'social'), 'card: the referee submits it');
select is((select needs_me from public.tdc_my_matches() where id = :'social'), false, 'list: waiting is never "Needs you" for the referee');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'social'),
	'P0001', 'Only the players in this match can answer its scorecard.', 'card: the referee cannot answer it');

select tests.sign_in(:'bob');
select is((select needs_me from public.tdc_my_matches() where id = :'social'), true, 'list: but it needs a player');
select lives_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'social'), 'card: a player agrees');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_set_match_referee(%L, null) $$, :'social'),
	'P0001', 'This scorecard is settled and final.', 'settled: nobody changes the referee');
select tests.sign_out();


-- ─── Social: removed, and picking yourself ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as social2 \gset
select public.tdc_set_match_referee(:'social2', :'rae_p');
select tests.sign_in(:'rae');
select public.tdc_record_frame(:'social2', 1, '{"winner_side": "home", "result_event": "win"}');

select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'social2'),
	'P0001', 'Frame 1 was last set by the referee. Ask them to change it.', 'removed: before, the frame is the referee''s');
select lives_ok(format($$ select public.tdc_set_match_referee(%L, null) $$, :'social2'),
	'removed: the other player clears the referee');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'social2'),
	'removed: and the players have the frame back');

select tests.sign_in(:'rae');
select is(public.tdc_may_edit_match(:'social2'), false, 'removed: the old referee may no longer score');

select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'social2', :'alice_p'),
	'self: a player may referee their own match');
select is(public.tdc_may_change_match(:'social2'), true, 'self: and, being a player, still changes the rules');
select is((select count(*)::integer from public.tdc_search_referees('Ref Alice') where id = :'alice_p'), 1,
	'search: the referee search finds the person searching');
select tests.sign_out();


-- ─── Tournament ───

insert into public.tbl_tournaments (name, rules) values ('Ref Open', tests.rules()) returning id as t \gset
insert into public.tbl_competition_roles (tournament_id, player_id, role) values (:'t', tests.player_of(:'td'), 'director');
select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as tm \gset
select tests.sign_out();
insert into public.tbl_tournament_fixtures (tournament_id, round, position, match_id) values (:'t', 1, 1, :'tm');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'tm', :'rae_p'),
	'P0001', 'Only the people running this tournament can change this match''s referee.', 'tournament: a player cannot pick the referee');
select public.tdc_record_frame(:'tm', 1, '{"winner_side": "home", "result_event": "win"}');

select tests.sign_in(:'td');
select lives_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'tm', :'rae_p'),
	'tournament: the director picks one');

select tests.sign_in(:'rae');
select is(public.tdc_may_change_match(:'tm'), false, 'tournament: the referee does not change the rules');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'tm'),
	'tournament: the referee, holding no tournament role, corrects a player''s frame');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}') $$, :'tm'),
	'P0001', 'Frame 1 was last set by the referee. Ask them to change it.', 'tournament: the player is outranked');

select tests.sign_in(:'td');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}') $$, :'tm'),
	'tournament: the director outranks the referee');
select lives_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'tm', tests.rules('{"score_entry_mode": "referee"}')),
	'tournament: the director makes it referee-only');

select tests.sign_in(:'rae');
select is(public.tdc_may_edit_match(:'tm'), true, 'referee-only: the match referee still scores');
select tests.sign_in(:'alice');
select is(public.tdc_may_edit_match(:'tm'), false, 'referee-only: a player does not');
select tests.sign_out();


-- ─── League ───

select tests.sign_in(:'ld');
select public.tdc_create_league('Ref League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'h1'), :'th', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'a1'), :'ta', true);
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select public.tdc_create_league_match(:'fx') as lm \gset
select tests.sign_out();

select tests.sign_in(:'h1');
select throws_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'lm', :'rae_p'),
	'P0001', 'Only the people running this league can change this match''s referee.', 'league: a captain cannot pick the referee');

select tests.sign_in(:'ld');
select lives_ok(format($$ select public.tdc_set_match_referee(%L, %L) $$, :'lm', :'rae_p'),
	'league: the league director picks one');
-- With a referee the rank guard fires on a league match, so the league
-- director has to outrank them or could not correct the referee's frames.
select is(private.tdc_score_rank(:'lm'), 100, 'league: the league director is rank 100');
select tests.sign_in(:'rae');
select is(private.tdc_score_rank(:'lm'), 50, 'league: the referee 50');
select tests.sign_out();


-- ─── The walk-in merge ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as social3 \gset
select public.tdc_set_match_referee(:'social3', :'kim_p');

select tests.sign_in(:'staff');
select public.tdc_staff_link_account(:'venue', :'wkim', :'kim_p');
select tests.sign_out();
select is((select referee_player_id from public.tbl_matches where id = :'social3'), :'wkim'::uuid,
	'merge: the referee is carried onto the walk-in record');
select tests.sign_in(:'kim');
select is(public.tdc_may_edit_match(:'social3'), true, 'merge: and the account still referees it');
select tests.sign_out();

select * from finish();
rollback;
