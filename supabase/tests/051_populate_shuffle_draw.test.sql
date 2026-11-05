-- Filling and shuffling the draw (migration 20261105115859).
--
-- UV, 5 Nov: fill the first round's available slots with the entrants not
-- yet in the draw, in random order; shuffle every first-round player across
-- its matches, deleting unplayed matches and refusing once a frame is
-- played. Both rehearse by default.
begin;
\ir _helpers.psql
select plan(20);

select tests.create_user('Fill Dee') as dee \gset
select tests.create_user('Fill P1') as p1 \gset
select tests.create_user('Fill P2') as p2 \gset
select tests.create_user('Fill P3') as p3 \gset
select tests.create_user('Fill P4') as p4 \gset
select tests.create_user('Fill P5') as p5 \gset
select tests.create_user('Fill P6') as p6 \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Fill Draw', tests.rules()) as t \gset
select public.tdc_update_tournament(:'t', p_progression => 'automatic', p_create_matches => 'automatic');
select public.tdc_add_entrant(:'t', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2', :'p3', :'p4', :'p5', :'p6']::uuid[]) u;
select public.tdc_generate_draw(:'t', p_empty => true, p_size => 8);
select tests.sign_out();

-- ─── Filling ───

select tests.sign_in(:'p1');
select throws_ok(format($$ select public.tdc_populate_draw(%L) $$, :'t'),
	'P0001', 'Only the people running this tournament can change the draw.',
	'a player cannot fill the draw');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_populate_draw(:'t') as r \gset
select tests.sign_out();
select is((:'r'::jsonb ->> 'placed')::integer, 6, 'the rehearsal says six go in');
select is((:'r'::jsonb ->> 'open_slots')::integer, 8, 'of eight open slots');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and (home_entrant_id is not null or away_entrant_id is not null)), 0,
	'and changes nothing');

select tests.sign_in(:'dee');
select public.tdc_populate_draw(:'t', true, true) as r \gset
select tests.sign_out();
select is((:'r'::jsonb ->> 'placed')::integer, 6, 'applied: six placed');
select is((select count(distinct e)::integer from public.tbl_tournament_fixtures f,
		lateral (values (f.home_entrant_id), (f.away_entrant_id)) v(e)
		where f.tournament_id = :'t' and f.round = 1 and e is not null), 6,
	'six different people in the first round');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and round = 1 and home_source_type = 'entrant' and away_source_type = 'entrant'
			and match_id is not null), 3,
	'the three full matches started (automatic)');

select tests.sign_in(:'dee');
select public.tdc_populate_draw(:'t', true, true) as r \gset
select tests.sign_out();
select is((:'r'::jsonb ->> 'placed')::integer, 0, 'filling again places nobody');

-- ─── Shuffling ───

select array_agg(e order by e) as before from public.tbl_tournament_fixtures f,
	lateral (values (f.home_entrant_id), (f.away_entrant_id)) v(e)
	where f.tournament_id = :'t' and f.round = 1 and e is not null \gset

select tests.sign_in(:'p1');
select throws_ok(format($$ select public.tdc_shuffle_draw(%L) $$, :'t'),
	'P0001', 'Only the people running this tournament can change the draw.',
	'a player cannot shuffle the draw');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_shuffle_draw(:'t') as r \gset
select tests.sign_out();
select is((:'r'::jsonb ->> 'shuffled')::integer, 6, 'the rehearsal shuffles six');
select is((:'r'::jsonb ->> 'matches_removed')::integer, 3, 'and would remove the three unplayed matches');
select is((select count(*)::integer from public.tbl_deleted_matches
		where summary like '%the draw was shuffled%'), 0, 'a rehearsal deletes nothing');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and round = 1 and match_id is not null), 3,
	'the rehearsal kept the matches');

select tests.sign_in(:'dee');
select public.tdc_shuffle_draw(:'t', true) as r \gset
select tests.sign_out();
select is((select array_agg(e order by e) from public.tbl_tournament_fixtures f,
		lateral (values (f.home_entrant_id), (f.away_entrant_id)) v(e)
		where f.tournament_id = :'t' and f.round = 1 and e is not null), :'before'::uuid[],
	'applied: the same six people are in the first round');
select is((select count(*)::integer from public.tbl_deleted_matches
		where summary like '%the draw was shuffled%'), 3,
	'the three unplayed matches are deleted and recorded');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and round = 1 and match_id is not null), 3,
	'and the new pairs'' matches started');

-- A frame played: no more shuffling.
insert into public.tbl_frames (match_id, frame_no, winner_side, result_event, status)
select match_id, 1, 'home', 'win', 'complete' from public.tbl_tournament_fixtures
	where tournament_id = :'t' and round = 1 and match_id is not null order by position limit 1;

select tests.sign_in(:'dee');
select throws_like(format($$ select public.tdc_shuffle_draw(%L, true) $$, :'t'),
	'The first round has started:%', 'a frame played refuses the shuffle');
select tests.sign_out();

-- ─── A bye filled ───

select tests.create_user('Fill Late') as late \gset
select tests.sign_in(:'dee');
select public.tdc_create_tournament('Fill Bye', tests.rules()) as b \gset
select public.tdc_add_entrant(:'b', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2', :'p3']::uuid[]) u;
select public.tdc_generate_draw(:'b');
select public.tdc_add_entrant(:'b', tests.player_of(:'late'), 'confirmed');
select public.tdc_populate_draw(:'b', true, true) as r \gset
select tests.sign_out();
select is((:'r'::jsonb ->> 'byes_cleared')::integer, 1, 'the late arrival fills the bye''s slot');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'b' and advance_reason = 'bye'), 0, 'and the bye is gone');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'b' and round = 1 and home_entrant_id is not null and away_entrant_id is not null), 2,
	'both first-round matches have two players');

select * from finish();
rollback;
