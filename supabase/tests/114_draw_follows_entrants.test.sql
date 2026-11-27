-- The draw follows the confirmed players until a match is started
-- (migrations 20261127175438, 20261127185136).
--
-- UV, 27 Nov: a newly confirmed player takes the first open place; a player no
-- longer confirmed comes out, their opponent getting a bye again. Later the
-- same evening: started matches are never changed, and a full draw is never
-- made again by itself (the player waits for the director).
begin;
\ir _helpers.psql
select plan(19);

select tests.create_user('Fol Dee') as dee \gset
select tests.create_user('Fol Sam') as sam \gset
select tests.create_user('Fol A') as a \gset
select tests.create_user('Fol B') as b \gset
select tests.create_user('Fol C') as c \gset
select tests.create_user('Fol D') as d \gset
select tests.create_user('Fol E') as e \gset
select tests.create_user('Fol F') as f \gset
select tests.create_user('Fol G') as g \gset
select tests.create_user('Fol H') as h \gset
select tests.create_user('Fol I') as i \gset
select tests.create_user('Fol J') as j \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Fol Cup', tests.rules(), p_create_matches => 'manual', p_progression => 'automatic') as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'a'), 'confirmed') as ea \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'b'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'c'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'d'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'e'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'f'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'g'), 'interested') as eg \gset

-- No draw yet: nothing to follow.
select is((select count(*)::int from public.tbl_tournament_fixtures where tournament_id = :'t'), 0, 'no draw: confirming makes none');

-- Six into a draw of eight: two byes, A (seed 1) and B (seed 2).
select public.tdc_generate_draw(:'t');
select public.tdc_resolve_draw(:'t');
create temp view r1 as
	select position, home_entrant_id h, away_entrant_id a, advance_reason why, match_id
	from public.tbl_tournament_fixtures where tournament_id = :'t' and bracket = 'main' and round = 1;
grant select on r1 to authenticated;
select is((select count(*)::int from r1 where why = 'bye'), 2, 'six in eight: two byes');
select is((select h from r1 where position = 1), :'ea'::uuid, 'A at the top, on a bye');

-- G confirmed: the first open place, A's bye; the bye goes.
select public.tdc_set_entrant(:'eg', 'confirmed');
select is((select a from r1 where position = 1), :'eg'::uuid, 'G takes the first open place');
select is((select why from r1 where position = 1), null, 'A''s bye is gone');
select is((select count(*)::int from public.tbl_tournament_fixtures
	where tournament_id = :'t' and round = 2 and :'ea'::uuid in (home_entrant_id, away_entrant_id)), 0,
	'A is no longer in round 2');

-- A withdraws: out, G alone has a bye and goes through.
select public.tdc_set_entrant(:'ea', 'withdrawn');
select is((select h from r1 where position = 1), null, 'A comes out');
select is((select why from r1 where position = 1), 'bye', 'G has a bye');
select is((select count(*)::int from public.tbl_tournament_fixtures
	where tournament_id = :'t' and round = 2 and :'eg'::uuid in (home_entrant_id, away_entrant_id)), 1,
	'G goes through to round 2');

-- Confirmed again: the first open place.
select public.tdc_set_entrant(:'ea', 'confirmed');
select is((select h from r1 where position = 1), :'ea'::uuid, 'A confirmed again: the first open place');

-- Full: H in the last open place; I finds none and waits. The draw is not
-- made again by itself (20261127185136).
select public.tdc_add_entrant(:'t', tests.player_of(:'h'), 'confirmed');
select is((select count(*)::int from r1 where why = 'bye'), 0, 'eight in eight: no byes');
select public.tdc_add_entrant(:'t', tests.player_of(:'i'), 'confirmed') as ei \gset
select is((select count(*)::int from r1), 4, 'nine confirmed: still a draw of eight');
select ok(not exists (select 1 from public.tbl_tournament_fixtures f where f.tournament_id = :'t'
	and :'ei'::uuid in (f.home_entrant_id, f.away_entrant_id)), 'the ninth waits for the director');

-- The marker is never left set: a stranger still cannot change the draw.
select is(coalesce(current_setting('tdc.draw_follow', true), ''), '', 'the marker is cleared');
select tests.sign_out();
select tests.sign_in(:'sam');
select throws_ok(format($$ select public.tdc_shuffle_draw(%L, true) $$, :'t'),
	'Only the people running this tournament can change the draw.', 'a stranger still cannot change the draw');
select tests.sign_out();

-- A match started (nothing played): from then on nothing moves by itself.
select tests.sign_in(:'dee');
select public.tdc_set_entrant(:'ei', 'interested');
select fixture_id as fs from public.tdc_tournament_draw(:'t') where round = 1 and position = 2 \gset
select public.tdc_create_fixture_match(:'fs') as ms \gset
select (select h from r1 where position = 2) as ms_home \gset
select public.tdc_set_entrant(:'ms_home'::uuid, 'withdrawn');
select is((select h from r1 where position = 2), :'ms_home'::uuid, 'a withdrawal leaves a started match alone');
select ok(exists (select 1 from public.tbl_matches where id = :'ms'), 'and the match stands');
select public.tdc_add_entrant(:'t', tests.player_of(:'j'), 'confirmed') as ej \gset
select ok(not exists (select 1 from public.tbl_tournament_fixtures f where f.tournament_id = :'t'
	and :'ej'::uuid in (f.home_entrant_id, f.away_entrant_id)), 'a new confirmation waits for the director');
select is((select count(*)::int from r1), 4, 'and the draw is not made again');
select tests.sign_out();

select * from finish();
rollback;
