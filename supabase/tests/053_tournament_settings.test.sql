-- A tournament's Settings tab (migration 20261105130239).
--
-- UV, 5 Nov: a rule changed afterwards reaches every match not yet started,
-- as a league's does; a match with a frame keeps its rules. Maximum entrants
-- can go back to no limit.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('Set Dee') as dee \gset
select tests.create_user('Set P1') as p1 \gset
select tests.create_user('Set P2') as p2 \gset
select tests.create_user('Set P3') as p3 \gset
select tests.create_user('Set P4') as p4 \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Set Draw', tests.rules(), p_max_entrants => 16) as t \gset
select public.tdc_update_tournament(:'t', p_progression => 'automatic', p_create_matches => 'automatic');
select public.tdc_add_entrant(:'t', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2', :'p3', :'p4']::uuid[]) u;
select public.tdc_generate_draw(:'t');
select public.tdc_resolve_draw(:'t');
select tests.sign_out();

-- Two first-round matches, each started with the tournament's race to 5.
select f.match_id as played from public.tbl_tournament_fixtures f
	where f.tournament_id = :'t' and f.round = 1 and f.position = 1 \gset
select f.match_id as fresh from public.tbl_tournament_fixtures f
	where f.tournament_id = :'t' and f.round = 1 and f.position = 2 \gset
select is((select count(*)::integer from public.tbl_matches where id in (:'played', :'fresh')), 2, 'both first-round matches exist');

-- One of them has a frame in.
select m.home_player_id as home from public.tbl_matches m where m.id = :'played' \gset
select tests.sign_in((select user_id from public.tbl_players where id = :'home'));
select public.tdc_record_frame(:'played', 1, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_out();

-- A player cannot change the rules.
select tests.sign_in(:'p1');
select throws_ok(format($$ select public.tdc_update_tournament(%L, p_rules => %L) $$, :'t', tests.rules('{"win_condition_target": 7}')),
	'P0001', 'Only the people running this tournament can change it.', 'a player cannot change the tournament');
select tests.sign_out();

-- The director changes them: the fresh match follows, the played one keeps.
select tests.sign_in(:'dee');
select public.tdc_update_tournament(:'t', p_rules => tests.rules('{"win_condition_target": 7}')) as r \gset
select tests.sign_out();
select is((:'r'::jsonb ->> 'matches_updated')::integer, 1, 'one match took the new rules');
select is((:'r'::jsonb ->> 'matches_kept')::integer, 1, 'one kept its own');
select is((select (rules ->> 'win_condition_target')::integer from public.tbl_matches where id = :'fresh'), 7, 'the unstarted match is now a race to 7');
select is((select (rules ->> 'win_condition_target')::integer from public.tbl_matches where id = :'played'), 5, 'the match with a frame is still a race to 5');

-- A change that is not a rule change says nothing was re-frozen.
select tests.sign_in(:'dee');
select public.tdc_update_tournament(:'t', p_name => 'Set Draw Renamed') as r2 \gset
select tests.sign_out();
select is((:'r2'::jsonb ->> 'matches_updated')::integer, 0, 'a rename touches no match');

-- Maximum entrants back to no limit.
select tests.sign_in(:'dee');
select public.tdc_update_tournament(:'t', p_clear_max_entrants => true);
select tests.sign_out();
select is((select max_entrants from public.tbl_tournaments where id = :'t'), null, 'the maximum is cleared');
select is((select name from public.tbl_tournaments where id = :'t'), 'Set Draw Renamed', 'and nothing else moved');

select * from finish();
rollback;
