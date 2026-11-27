-- A walkover on a match started but never played (migration 20261127214214).
--
-- UV, 27 Nov: a started match with no score offers W/O. With no frames and no
-- score set by hand the empty match goes, recorded, and the award stands; a
-- match with a score is still refused.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('Wos Dee') as dee \gset
select tests.create_user('Wos Ann') as ann \gset
select tests.create_user('Wos Bob') as bob \gset
select tests.create_user('Wos Cat') as cat \gset
select tests.create_user('Wos Dan') as dan \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Wos Cup', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'cat'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'dan'), 'confirmed');
select public.tdc_generate_draw(:'t');
select fixture_id as f1, home_entrant_id as f1_home from public.tdc_tournament_draw(:'t') where round = 1 and position = 1 \gset
select fixture_id as f2, away_entrant_id as f2_away from public.tdc_tournament_draw(:'t') where round = 1 and position = 2 \gset
select public.tdc_create_fixture_match(:'f1') as m1 \gset
select public.tdc_create_fixture_match(:'f2') as m2 \gset

-- Started, nothing played: the walkover goes through.
select lives_ok(format($$ select public.tdc_set_fixture(p_fixture_id => %L, p_advanced_entrant_id => %L, p_advance_reason => 'walkover') $$, :'f1', :'f1_home'),
	'a walkover on a started match with no frames and no score is allowed');
select is((select advanced_entrant_id from public.tbl_tournament_fixtures where id = :'f1'), :'f1_home'::uuid, 'the player is awarded it');
select is((select match_id from public.tbl_tournament_fixtures where id = :'f1'), null, 'the fixture no longer has a match');
select ok(not exists (select 1 from public.tbl_matches where id = :'m1'), 'the empty match is deleted');
select tests.sign_out();
select matches((select summary from public.tbl_deleted_matches where match_id = :'m1'), '^Wos \w+ 0 – Wos \w+ 0, 0 frames \(a walkover on the draw\)$',
	'and recorded');

-- A score set by hand: refused as before.
select tests.sign_in(:'dee');
select public.tdc_set_match_override(:'m2', 1, 0, 'Entered on the draw', 'draft');
select throws_ok(format($$ select public.tdc_set_fixture(p_fixture_id => %L, p_advanced_entrant_id => %L, p_advance_reason => 'walkover') $$, :'f2', :'f2_away'),
	'This fixture has a match, so its result is counted from the frames. Change the match, or detach it first.',
	'a walkover on a match with a score is still refused');
select ok(exists (select 1 from public.tbl_matches where id = :'m2'), 'and its match is kept');
select tests.sign_out();

select * from finish();
rollback;
