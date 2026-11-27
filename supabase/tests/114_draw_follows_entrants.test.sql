-- The draw follows the confirmed players until play starts
-- (migration 20261127175438).
--
-- UV, 27 Nov: a newly confirmed player takes the first open place; a full draw
-- grows to the next size; a player no longer confirmed comes out, their
-- opponent getting a bye again; until play starts.
begin;
\ir _helpers.psql
select plan(21);

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

-- Matches start by themselves here, so unplayed matches are made and must go
-- when their players change.
select tests.sign_in(:'dee');
select public.tdc_create_tournament('Fol Cup', tests.rules(), p_create_matches => 'automatic', p_progression => 'automatic') as t \gset
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

-- G confirmed: the first open place, A's bye; the bye goes, a match starts.
select public.tdc_set_entrant(:'eg', 'confirmed');
select is((select a from r1 where position = 1), :'eg'::uuid, 'G takes the first open place');
select is((select why from r1 where position = 1), null, 'A''s bye is gone');
select ok((select match_id from r1 where position = 1) is not null, 'and their match starts (automatic)');
select is((select count(*)::int from public.tbl_tournament_fixtures
	where tournament_id = :'t' and round = 2 and :'ea'::uuid in (home_entrant_id, away_entrant_id)), 0,
	'A is no longer in round 2');
select (select match_id from r1 where position = 1) as m1 \gset

-- A withdraws: out, G alone has a bye, the unplayed match goes and is recorded.
select public.tdc_set_entrant(:'ea', 'withdrawn');
select is((select h from r1 where position = 1), null, 'A comes out');
select is((select why from r1 where position = 1), 'bye', 'G has a bye');
select ok(not exists (select 1 from public.tbl_matches where id = :'m1'), 'the unplayed match is deleted');
select tests.sign_out();
select ok(exists (select 1 from public.tbl_deleted_matches where match_id = :'m1' and summary like '%entries came in%'), 'and recorded');
select tests.sign_in(:'dee');
select is((select count(*)::int from public.tbl_tournament_fixtures
	where tournament_id = :'t' and round = 2 and :'eg'::uuid in (home_entrant_id, away_entrant_id)), 1,
	'G goes through to round 2');

-- Back to interested also takes a player out; confirmed again puts them back.
select public.tdc_set_entrant(:'ea', 'confirmed');
select is((select h from r1 where position = 1), :'ea'::uuid, 'A confirmed again: the first open place');

-- Filling up: H in the last open place; I has none, so the draw grows to 16.
select public.tdc_add_entrant(:'t', tests.player_of(:'h'), 'confirmed');
select is((select count(*)::int from r1 where why = 'bye'), 0, 'eight in eight: no byes');
select is((select count(*)::int from r1), 4, 'still a draw of eight');
select public.tdc_add_entrant(:'t', tests.player_of(:'i'), 'confirmed');
select is((select count(*)::int from r1), 8, 'nine confirmed: a draw of sixteen');
select is((select count(*)::int from r1 where why = 'bye'), 7, 'with seven byes');
select is((select count(*)::int from public.tbl_tournament_entrants e where e.tournament_id = :'t' and e.status = 'confirmed'
	and exists (select 1 from r1 where e.id in (r1.h, r1.a))), 9, 'everybody confirmed is in it');

-- The marker is never left set: a stranger still cannot change the draw.
select is(coalesce(current_setting('tdc.draw_follow', true), ''), '', 'the marker is cleared');
select tests.sign_out();
select tests.sign_in(:'sam');
select throws_ok(format($$ select public.tdc_shuffle_draw(%L, true) $$, :'t'),
	'Only the people running this tournament can change the draw.', 'a stranger still cannot change the draw');
select tests.sign_out();

-- Play starts (a score): from then on nothing moves by itself.
select tests.sign_in(:'dee');
select match_id as mp from r1 where match_id is not null limit 1 \gset
-- A director's score counts as play, as a frame does.
select public.tdc_set_match_override(:'mp', 1, 0, 'Entered on the draw', 'draft');
select public.tdc_add_entrant(:'t', tests.player_of(:'j'), 'confirmed') as ej \gset
select ok(not exists (select 1 from public.tbl_tournament_fixtures f where f.tournament_id = :'t'
	and :'ej'::uuid in (f.home_entrant_id, f.away_entrant_id)), 'once play starts a new confirmation waits for the director');
select tests.sign_out();

select * from finish();
rollback;
