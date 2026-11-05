-- The draw's pictures and full names (migration 20261105095518).
--
-- UV, 5 Nov: the draw page's cards show each player's picture with their
-- name, and a Full names switch shows first and last names. The full name is
-- null when neither is set, so the page falls back to the display name.
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('Pic Dee') as dee \gset
select tests.create_user('Pic Ann') as ann \gset
select tests.create_user('Pic Bob') as bob \gset
select tests.create_user('Pic Sam') as sam \gset

update public.tbl_players set first_name = 'Ann', last_name = 'Naidoo',
	avatar_path = id || '/a.webp' where id = tests.player_of(:'ann');

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Pic Draw', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed');
select public.tdc_generate_draw(:'t');
select tests.sign_out();

-- Any signed-in player reads the draw, as before.
select tests.sign_in(:'sam');
create temp table d as
	select * from public.tdc_tournament_draw(:'t') where round = 1;
select tests.sign_out();

-- Seeds settle Ann first by name, so she is home.
select is((select home_name from d), 'Pic Ann', 'the display name is unchanged');
select is((select home_full_name from d), 'Ann Naidoo', 'the full name is first and last name');
select is((select home_avatar from d), tests.player_of(:'ann') || '/a.webp', 'the picture''s path');
select is((select away_full_name from d), null, 'no first or last name: no full name');
select is((select away_avatar from d), null, 'no picture: null');

select tests.sign_in_anon();
select throws_ok(format($$ select * from public.tdc_tournament_draw(%L) $$, :'t'),
	'42501', null, 'a signed-out visitor still cannot read the draw');
select tests.sign_out();

select * from finish();
rollback;
