-- The draw's player ids (migration 20261105125434).
--
-- UV, 5 Nov: a player's picture opens their profile wherever it is shown,
-- the draw's cards included, so the draw says which player is in each side.
begin;
\ir _helpers.psql
select plan(3);

select tests.create_user('Pid Dee') as dee \gset
select tests.create_user('Pid Ann') as ann \gset
select tests.create_user('Pid Bob') as bob \gset
select tests.create_user('Pid Sam') as sam \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Pid Draw', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed');
select public.tdc_generate_draw(:'t');
select tests.sign_out();

-- Any signed-in player, not only the director, gets them.
select tests.sign_in(:'sam');
create temp table d as
	select * from public.tdc_tournament_draw(:'t') where round = 1;
select tests.sign_out();

-- Seeds settle Ann first by name, so she is home.
select is((select home_player_id from d), tests.player_of(:'ann'), 'home is Ann''s player id');
select is((select away_player_id from d), tests.player_of(:'bob'), 'away is Bob''s player id');
select is((select home_name from d), 'Pid Ann', 'the rest of the row is unchanged');

select * from finish();
rollback;
