-- A player's full name in the standings (migration 20261029203451, UV 29 Oct).
begin;
\ir _helpers.psql
select plan(3);

select tests.create_user('Name LD') as dee \gset
select tests.create_user('Ace') as ace \gset
select tests.create_user('Plain') as plain \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Name League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'ace'), :'th', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'plain'), :'th');
select tests.sign_out();

update public.tbl_players set first_name = 'Thabo', last_name = 'Mokoena' where id = tests.player_of(:'ace');

select tests.sign_in(:'dee');
select public.tdc_league_standings(:'season') as st \gset
select is((select p ->> 'full_name' from jsonb_array_elements(:'st'::jsonb -> 'players') p where p ->> 'player_id' = tests.player_of(:'ace')::text),
	'Thabo Mokoena', 'a player with first and last names has their full name');
select is((select p ->> 'display_name' from jsonb_array_elements(:'st'::jsonb -> 'players') p where p ->> 'player_id' = tests.player_of(:'ace')::text),
	'Ace', 'and still their display name');
select is((select p -> 'full_name' from jsonb_array_elements(:'st'::jsonb -> 'players') p where p ->> 'player_id' = tests.player_of(:'plain')::text),
	'null'::jsonb, 'a player with neither has none');

select * from finish();
rollback;
