-- The entrant list's pictures (migration 20261105102452).
--
-- UV, 5 Nov: the draw page shows every entrant as a pill with their picture,
-- for the director to drag onto a match. The list is still the director's
-- alone.
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('Pill Dee') as dee \gset
select tests.create_user('Pill Ann') as ann \gset
select tests.create_user('Pill Bob') as bob \gset

update public.tbl_players set avatar_path = id || '/a.webp'
	where id = tests.player_of(:'ann');

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Pill Draw', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'interested');
create temp table l as select * from public.tdc_tournament_entrants(:'t');
select tests.sign_out();

select is((select count(*)::int from l), 2, 'the director reads both entrants');
select is((select avatar_path from l where player_id = tests.player_of(:'ann')),
	tests.player_of(:'ann') || '/a.webp', 'the picture''s path');
select is((select avatar_path from l where player_id = tests.player_of(:'bob')),
	null, 'no picture: null');
select is((select display_name from l where player_id = tests.player_of(:'ann')),
	'Pill Ann', 'the columns before it are unchanged');

-- A player in it still reads nothing.
select tests.sign_in(:'bob');
select is((select count(*)::int from public.tdc_tournament_entrants(:'t')), 0,
	'a player still reads no entrant list');
select tests.sign_out();

select * from finish();
rollback;
