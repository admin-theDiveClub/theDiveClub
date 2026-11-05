-- An empty draw: "No one" in Who goes in (migration 20261105093205).
--
-- UV, 5 Nov: the matches are made and wired round to round but not filled;
-- the draw is sized by a picker starting at the tournament's max entrants.
-- And Claude's, from the same migration:
--   • an empty slot is not a bye: nobody advances, nothing starts
--   • the seeds are left alone
--   • a populated draw is unchanged
begin;
\ir _helpers.psql
select plan(18);

select tests.create_user('Empty Dee') as dee \gset
select tests.create_user('Empty Ann') as ann \gset
select tests.create_user('Empty Bob') as bob \gset
select tests.create_user('Empty Cal') as cal \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Empty Draw', tests.rules()) as t \gset
select public.tdc_update_tournament(:'t', p_third_place => true,
	p_progression => 'automatic', p_create_matches => 'automatic');
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed') as e_ann \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed') as e_bob \gset
select tests.sign_out();

-- ─── The size ───

select tests.sign_in(:'dee');
select throws_ok(format($$ select public.tdc_generate_draw(%L, p_empty => true) $$, :'t'),
	'P0001', 'An empty draw needs a size of 2, 4, 8, 16 and so on up to 1024, not none.',
	'an empty draw without a size is refused');
select throws_ok(format($$ select public.tdc_generate_draw(%L, p_empty => true, p_size => 6) $$, :'t'),
	'P0001', 'An empty draw needs a size of 2, 4, 8, 16 and so on up to 1024, not 6.',
	'a size that is not a power of two is refused');
select throws_ok(format($$ select public.tdc_generate_draw(%L, p_size => 8) $$, :'t'),
	'P0001', 'TDC (Error): a draw size is only given for an empty draw; a filled one is sized by who goes in.',
	'a size with a filled draw is refused');
select tests.sign_out();

select tests.sign_in(:'ann');
select throws_ok(format($$ select public.tdc_generate_draw(%L, p_empty => true, p_size => 8) $$, :'t'),
	'P0001', 'Only the people running this tournament can generate the draw.',
	'a player cannot make an empty draw');
select tests.sign_out();

-- ─── The shape ───

select tests.sign_in(:'dee');
select is(public.tdc_generate_draw(:'t', p_empty => true, p_size => 8), 0,
	'an empty draw of 8 is made, with nobody in it');
select public.tdc_resolve_draw(:'t');
select tests.sign_out();

select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and bracket = 'main'), 7,
	'8 places: 4 + 2 + 1 matches');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and bracket = 'main' and round = 1
			and home_entrant_id is null and away_entrant_id is null
			and home_source_type is null and away_source_type is null), 4,
	'every first-round slot is empty');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t'
			and (advanced_entrant_id is not null or advance_reason is not null)), 0,
	'no slot is a bye');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and bracket = 'main' and round > 1
			and home_source_type = 'winner_of' and home_source_ref is not null
			and away_source_type = 'winner_of' and away_source_ref is not null), 3,
	'the later rounds are wired to the winners below');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and bracket = 'third_place'
			and home_source_type = 'loser_of' and away_source_type = 'loser_of'), 1,
	'the third-place playoff is wired to the semi-finals');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and match_id is not null), 0,
	'resolving starts nothing');
select is((select count(*)::integer from public.tbl_tournament_entrants
		where tournament_id = :'t' and seed is not null), 0,
	'the seeds are left alone');

-- ─── Filled by hand ───

select id as r1m1 from public.tbl_tournament_fixtures
	where tournament_id = :'t' and bracket = 'main' and round = 1 and position = 1 \gset

select tests.sign_in(:'dee');
select public.tdc_swap_fixture_player(:'r1m1', 'home', :'e_ann', true);
select tests.sign_out();
select is((select match_id from public.tbl_tournament_fixtures where id = :'r1m1'), null,
	'one side filled: no match yet');

select tests.sign_in(:'dee');
select public.tdc_swap_fixture_player(:'r1m1', 'away', :'e_bob', true);
select tests.sign_out();
select isnt((select match_id from public.tbl_tournament_fixtures where id = :'r1m1'), null,
	'both sides filled: its match starts');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'t' and match_id is not null), 1,
	'and only that one');

-- ─── A populated draw is unchanged ───

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Filled Draw', tests.rules()) as f \gset
select public.tdc_add_entrant(:'f', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'f', tests.player_of(:'bob'), 'confirmed');
select public.tdc_add_entrant(:'f', tests.player_of(:'cal'), 'confirmed');
select is(public.tdc_generate_draw(:'f'), 3, 'a filled draw takes the three confirmed');
select tests.sign_out();

select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'f' and round = 1), 2,
	'three players: a draw of 4');
select is((select count(*)::integer from public.tbl_tournament_fixtures
		where tournament_id = :'f' and advance_reason = 'bye' and advanced_entrant_id is not null), 1,
	'with one bye, as before');

select * from finish();
rollback;
