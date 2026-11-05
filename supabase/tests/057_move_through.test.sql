-- Dragging a player into a later round moves them through (migration
-- 20261105164508): the match they left is scored to them at the win
-- condition to 0, by the director, and they go into the slot.
begin;
\ir _helpers.psql
select plan(13);

select tests.create_user('Move Dee') as dee \gset
select tests.create_user('Move P1') as p1 \gset
select tests.create_user('Move P2') as p2 \gset
select tests.create_user('Move P3') as p3 \gset
select tests.create_user('Move P4') as p4 \gset

-- Four players, moved on by hand, matches started by themselves; third place on.
select tests.sign_in(:'dee');
select public.tdc_create_tournament('Move Night', tests.rules()) as t \gset
select public.tdc_update_tournament(:'t', p_progression => 'manual', p_create_matches => 'automatic', p_third_place => true);
select public.tdc_add_entrant(:'t', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2', :'p3', :'p4']::uuid[]) u;
select public.tdc_generate_draw(:'t');
select public.tdc_resolve_draw(:'t');
select tests.sign_out();

select id as sf1 from public.tbl_tournament_fixtures where tournament_id = :'t' and bracket = 'main' and round = 1 and position = 1 \gset
select id as sf2 from public.tbl_tournament_fixtures where tournament_id = :'t' and bracket = 'main' and round = 1 and position = 2 \gset
select id as fin from public.tbl_tournament_fixtures where tournament_id = :'t' and bracket = 'main' and round = 2 \gset
select id as third from public.tbl_tournament_fixtures where tournament_id = :'t' and bracket = 'third_place' \gset
select home_entrant_id as sf1_home, away_entrant_id as sf1_away, match_id as sf1_match from public.tbl_tournament_fixtures where id = :'sf1' \gset
select home_entrant_id as sf2_home, match_id as sf2_match from public.tbl_tournament_fixtures where id = :'sf2' \gset
-- Which side of the final semi-final 1 feeds.
select case when home_source_ref = :'sf1' then 'home' else 'away' end as fin_side from public.tbl_tournament_fixtures where id = :'fin' \gset

-- Only whoever runs it.
select tests.sign_in(:'p1');
select throws_ok(format($$ select public.tdc_move_through(%L, %L, %L, 'home', true) $$, :'fin', :'fin_side', :'sf1'),
	'P0001', 'Only the people running this tournament can change the draw.', 'a player cannot move anybody through');
select tests.sign_out();

-- A rehearsal says what would happen and changes nothing.
select tests.sign_in(:'dee');
select public.tdc_move_through(:'fin', :'fin_side', :'sf1', 'home') as r \gset
select tests.sign_out();
select is(:'r'::jsonb #>> '{scored,score}', '5-0', 'the rehearsal says 5-0');
select is((select count(*)::integer from public.tbl_match_result_override where match_id = :'sf1_match'), 0, 'and records nothing');

-- The usual drag: onto the slot that already reads "Winner of" that match.
select tests.sign_in(:'dee');
select public.tdc_move_through(:'fin', :'fin_side', :'sf1', 'home', true) as r \gset
select tests.sign_out();
select is((select home_score from public.tbl_match_result_override where match_id = :'sf1_match'), 5, 'semi-final 1 is scored 5');
select is((select away_score from public.tbl_match_result_override where match_id = :'sf1_match'), 0, 'to 0');
select is((select reason from public.tbl_match_result_override where match_id = :'sf1_match'), 'Moved through on the draw', 'with the reason on the record');
select is((select case when :'fin_side' = 'home' then home_entrant_id else away_entrant_id end from public.tbl_tournament_fixtures where id = :'fin'),
	:'sf1_home'::uuid, 'the player is in the final, though players are moved on by hand');
select is((select count(*)::integer from public.tbl_frames where match_id = :'sf1_match'), 0, 'no frame is invented');

-- Played: rewire only, and why.
select tests.sign_in((select user_id from public.tbl_players p join public.tbl_tournament_entrants e on e.player_id = p.id where e.id = :'sf2_home'));
select public.tdc_record_frame(:'sf2_match', 1, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_out();
select tests.sign_in(:'dee');
select public.tdc_move_through(:'fin', case when :'fin_side' = 'home' then 'away' else 'home' end, :'sf2', 'home', true) as r2 \gset
select tests.sign_out();
select is(:'r2'::jsonb ->> 'not_scored', 'That match has been played, so its score is set from its card.', 'a played match is not scored over');
select is((select count(*)::integer from public.tbl_match_result_override where match_id = :'sf2_match'), 0, 'and has no score set by hand');

-- Third place: rewire only.
select tests.sign_in(:'dee');
select public.tdc_move_through(:'third', 'home', :'sf1', 'away') as r3 \gset
select tests.sign_out();
select is(:'r3'::jsonb ->> 'not_scored', 'The third-place playoff takes the loser, so dragging there does not say who won.', 'third place scores nobody, and says why');

-- Best of 9: 5-0.
select tests.sign_in(:'dee');
select public.tdc_create_tournament('Best Of Night', tests.rules('{"win_condition_type": "best_of", "win_condition_target": 9}')) as b \gset
select public.tdc_update_tournament(:'b', p_progression => 'manual', p_create_matches => 'manual');
select public.tdc_add_entrant(:'b', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2', :'p3', :'p4']::uuid[]) u;
select public.tdc_generate_draw(:'b');
select tests.sign_out();
select id as bsf1 from public.tbl_tournament_fixtures where tournament_id = :'b' and bracket = 'main' and round = 1 and position = 1 \gset
select id as bfin, case when home_source_ref = :'bsf1' then 'home' else 'away' end as bside
	from public.tbl_tournament_fixtures where tournament_id = :'b' and bracket = 'main' and round = 2 \gset
select tests.sign_in(:'dee');
select public.tdc_move_through(:'bfin', :'bside', :'bsf1', 'away', true) as r4 \gset
select tests.sign_out();
select is(:'r4'::jsonb #>> '{scored,score}', '5-0', 'best of 9 is 5-0');
select is((select away_score from public.tbl_match_result_override o join public.tbl_tournament_fixtures f on f.match_id = o.match_id where f.id = :'bsf1'),
	5, 'to the away player, a match made for it');

select * from finish();
rollback;
