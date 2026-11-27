-- The draw's lag and "Record who breaks" (migration 20261127153139).
--
-- UV, 27 Nov: the Rounds view of Run the draw shows a match's lag only when
-- its rules record who breaks. The draw says both, for any signed-in player;
-- the director sets the lag through tdc_update_match_settings, as the match
-- page does.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('Lag Dee') as dee \gset
select tests.create_user('Lag Ann') as ann \gset
select tests.create_user('Lag Bob') as bob \gset
select tests.create_user('Lag Sam') as sam \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Lag Draw', tests.rules('{"track_breaks": true}')) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed');
select public.tdc_generate_draw(:'t');
select fixture_id as f from public.tdc_tournament_draw(:'t') where round = 1 \gset
select tests.sign_out();

-- No match yet: nothing to say about either.
select tests.sign_in(:'sam');
select is((select track_breaks from public.tdc_tournament_draw(:'t') where fixture_id = :'f'), null,
	'no match: track_breaks is null');
select is((select first_break_side from public.tdc_tournament_draw(:'t') where fixture_id = :'f'), null,
	'no match: no lag');
select tests.sign_out();

-- The director starts the match and sets the lag the match page's way.
select tests.sign_in(:'dee');
select public.tdc_create_fixture_match(:'f') as m \gset
select public.tdc_update_match_settings(:'m', (select rules from public.tbl_matches where id = :'m'), 'away');
select tests.sign_out();

-- Any signed-in player reads both.
select tests.sign_in(:'sam');
create temp table d as select * from public.tdc_tournament_draw(:'t') where fixture_id = :'f';
select tests.sign_out();
select is((select track_breaks from d), true, 'the match records who breaks');
select is((select first_break_side from d), 'away', 'away won the lag');
select is((select home_name from d), 'Lag Ann', 'the rest of the row is unchanged');

-- A match whose rules do not record breaks says false, not null.
select tests.sign_in(:'dee');
select public.tdc_create_tournament('Lag Plain', tests.rules()) as t2 \gset
select public.tdc_add_entrant(:'t2', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t2', tests.player_of(:'bob'), 'confirmed');
select public.tdc_generate_draw(:'t2');
select fixture_id as f2 from public.tdc_tournament_draw(:'t2') where round = 1 \gset
select public.tdc_create_fixture_match(:'f2');
select is((select track_breaks from public.tdc_tournament_draw(:'t2') where fixture_id = :'f2'), false,
	'a match that does not record breaks: false');
select tests.sign_out();

select ok(not has_function_privilege('anon', 'public.tdc_tournament_draw(uuid)', 'execute'), 'still not readable signed out');

select * from finish();
rollback;
