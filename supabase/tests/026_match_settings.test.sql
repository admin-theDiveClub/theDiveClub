-- Who may change a match's rules and its time (migration
-- 20261024082447, audit A2 and A3).
--
--   social match       whoever may edit the card, as before
--   tournament match   the people running the tournament; a player or a
--                      referee may still record the lag winner, which comes
--                      through tdc_update_match_settings with the rules unchanged
--   league match       the people running the league season — not a captain
--   any match          nobody once the card is agreed, approved or published,
--                      directors included
begin;
\ir _helpers.psql
select plan(26);

select tests.create_user('Set Alice') as alice \gset
select tests.create_user('Set Bob') as bob \gset
select tests.create_user('Set Stranger') as stranger \gset
select tests.create_user('Set TD') as td \gset
select tests.create_user('Set Referee') as ref \gset
select tests.create_user('Set LD') as ld \gset
select tests.create_user('Set H1') as h1 \gset
select tests.create_user('Set A1') as a1 \gset
select tests.player_of(:'bob') as bob_p \gset

select (now() + interval '1 day') as soon \gset

-- ─── Social ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules('{"approval_mode": "none"}')) as social \gset
select tests.sign_out();

select tests.sign_in(:'stranger');
select is(public.tdc_may_change_match(:'social'), false, 'social: a stranger may not change it');
select throws_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'social', tests.rules('{"approval_mode": "none", "win_condition_target": 9}')),
	'P0001', 'You are not on this match and cannot change its settings.', 'social: and is refused, as before');

select tests.sign_in(:'bob');
select is(public.tdc_may_change_match(:'social'), true, 'social: either player may');
select lives_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'social', tests.rules('{"approval_mode": "none", "win_condition_target": 9}')),
	'social: a player changes the rules');
select lives_ok(format($$ select public.tdc_set_match_time(%L, %L) $$, :'social', :'soon'),
	'social: a player sets the time');

select public.tdc_record_frame(:'social', 1, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_submit_card(:'social');
select throws_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'social', tests.rules('{"approval_mode": "none"}')),
	'P0001', 'This scorecard is settled and final.', 'social: a settled card''s rules cannot change');
select throws_ok(format($$ select public.tdc_set_match_time(%L, null) $$, :'social'),
	'P0001', 'This scorecard is settled and final.', 'social: nor its time');
select tests.sign_out();


-- ─── Tournament ───

insert into public.tbl_tournaments (name, rules) values ('Set Open', tests.rules()) returning id as t \gset
insert into public.tbl_competition_roles (tournament_id, player_id, role) values
	(:'t', tests.player_of(:'td'), 'director'),
	(:'t', tests.player_of(:'ref'), 'referee');
select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules('{"approval_mode": "coordinator_approval"}')) as tm \gset
select tests.sign_out();
insert into public.tbl_tournament_fixtures (tournament_id, round, position, match_id) values (:'t', 1, 1, :'tm');
select rules as tm_rules from public.tbl_matches where id = :'tm' \gset

select tests.sign_in(:'alice');
select is(public.tdc_may_change_match(:'tm'), false, 'tournament: a player may not change it');
select throws_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'tm', tests.rules('{"approval_mode": "none"}')),
	'P0001', 'Only the people running this tournament can change this match''s rules.',
	'tournament: a player cannot turn approval off');
select lives_ok(format($$ select public.tdc_update_match_settings(%L, %L, 'away') $$, :'tm', :'tm_rules'),
	'tournament: a player records the lag winner, sending the rules back unchanged');
select tests.sign_out();
select is((select first_break_side from public.tbl_matches where id = :'tm'), 'away', 'and the lag winner is stored');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_set_match_time(%L, %L) $$, :'tm', :'soon'),
	'P0001', 'Only the people running this tournament can change when this match is played.',
	'tournament: a player cannot move it');

select tests.sign_in(:'ref');
select is(public.tdc_may_change_match(:'tm'), false, 'tournament: a referee may not change it');
select throws_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'tm', tests.rules('{"approval_mode": "none"}')),
	'P0001', 'Only the people running this tournament can change this match''s rules.',
	'tournament: nor change its rules');

select tests.sign_in(:'td');
select is(public.tdc_may_change_match(:'tm'), true, 'tournament: its director may');
select lives_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'tm', tests.rules('{"approval_mode": "coordinator_approval", "win_condition_target": 9}')),
	'tournament: the director changes the rules without playing');
select lives_ok(format($$ select public.tdc_set_match_time(%L, %L) $$, :'tm', :'soon'),
	'tournament: and moves the match');
select tests.sign_out();

-- Played, submitted and approved.
select tests.sign_in(:'alice');
select public.tdc_record_frame(:'tm', 1, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_submit_card(:'tm');
select tests.sign_in(:'td');
select public.tdc_approve_card(:'tm');
select rules as tm_rules from public.tbl_matches where id = :'tm' \gset

select throws_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'tm', tests.rules('{"approval_mode": "none"}')),
	'P0001', 'This result is settled. It has to be sent back before the match can be changed.',
	'approved: not even the director changes the rules');
select throws_ok(format($$ select public.tdc_set_match_time(%L, null) $$, :'tm'),
	'P0001', 'This result is settled. It has to be sent back before the match can be changed.',
	'approved: nor the time');
select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_update_match_settings(%L, %L, 'home') $$, :'tm', :'tm_rules'),
	'P0001', 'This result is settled. It has to be sent back before the match can be changed.',
	'approved: a player cannot change the lag winner either');
select tests.sign_out();
select is(private.tdc_card_state(:'tm')->>'state', 'approved', 'and the result is still approved');


-- ─── League ───

select tests.sign_in(:'ld');
select public.tdc_create_league('Set League', tests.rules('{"team_size": 2}')) as league \gset
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
select is(public.tdc_may_change_match(:'lm'), false, 'league: a captain may not change it');
select throws_ok(format($$ select public.tdc_set_match_time(%L, %L) $$, :'lm', :'soon'),
	'P0001', 'Only the people running this league can change when this match is played.',
	'league: a captain cannot move the match, and with it the lineup cutoff');
select throws_ok(format($$ select public.tdc_update_match_settings(%L, %L) $$, :'lm', tests.rules('{"team_size": 2, "win_condition_target": 9}')),
	'P0001', 'Only the people running this league can change this match''s rules.',
	'league: nor change its rules');

select tests.sign_in(:'ld');
select is(public.tdc_may_change_match(:'lm'), true, 'league: the league director may');
select lives_ok(format($$ select public.tdc_set_match_time(%L, %L) $$, :'lm', :'soon'),
	'league: and moves the match');
select tests.sign_out();

select * from finish();
rollback;
