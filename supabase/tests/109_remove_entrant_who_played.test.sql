-- Removing an entrant who has played marks them withdrawn instead
-- (migration 20261127135138, STATUS 1a B6, UV 27 Nov).
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('Rm Dee') as dee \gset
select tests.create_user('Rm Ann') as ann \gset
select tests.create_user('Rm Bob') as bob \gset
select tests.create_user('Rm Cy') as cy \gset
select tests.create_user('Rm Di') as di \gset
select tests.create_user('Rm Stranger') as stranger \gset

-- Three in the draw: one has a bye, two meet in round 1.
select tests.sign_in(:'dee');
select public.tdc_create_tournament('Rm Comp', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed') as e_ann \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed') as e_bob \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'cy'), 'confirmed') as e_cy \gset
select public.tdc_generate_draw(:'t');
select tests.sign_out();

-- The round-1 fixture with two players gets its match.
select id as f1 from public.tbl_tournament_fixtures
	where tournament_id = :'t' and round = 1 and home_entrant_id is not null and away_entrant_id is not null \gset
select tests.sign_in(:'dee');
select public.tdc_create_fixture_match(:'f1')
	where (select match_id from public.tbl_tournament_fixtures where id = :'f1') is null;
-- Play has started (a score on that match), so the draw no longer follows the
-- entrants by itself (20261127175438): Di stays out of it, as this test means.
select public.tdc_set_match_override((select match_id from public.tbl_tournament_fixtures where id = :'f1'),
	1, 0, 'Entered on the draw', 'draft');
select public.tdc_add_entrant(:'t', tests.player_of(:'di'), 'confirmed') as e_di \gset
select tests.sign_out();

select home_entrant_id as played from public.tbl_tournament_fixtures where id = :'f1' \gset
select advanced_entrant_id as bye from public.tbl_tournament_fixtures
	where tournament_id = :'t' and round = 1 and advanced_entrant_id is not null \gset

select tests.sign_in(:'stranger');
select throws_ok(format('select public.tdc_remove_entrant(%L)', :'played'),
	'Only the people running this tournament can remove entrants.', 'a stranger cannot remove');

select tests.sign_in(:'dee');
select is(public.tdc_remove_entrant(:'played'), 'withdrawn', 'someone with a match is withdrawn, not removed');
select is(public.tdc_remove_entrant(:'bye'), 'withdrawn', 'someone awarded a bye is withdrawn, not removed');
select is(public.tdc_remove_entrant(:'e_di'), 'removed', 'someone not on the draw is removed as before');
select tests.sign_out();

select is((select status from public.tbl_tournament_entrants where id = :'played'), 'withdrawn', 'they are kept, withdrawn');
select is((select home_entrant_id from public.tbl_tournament_fixtures where id = :'f1'), :'played'::uuid,
	'their fixture still names them');
select ok(exists (select 1 from public.tbl_tournament_fixtures where advanced_entrant_id = :'bye'),
	'the bye still names its player');
select ok(not exists (select 1 from public.tbl_tournament_entrants where id = :'e_di'), 'the one not on the draw is gone');

select * from finish();
rollback;
