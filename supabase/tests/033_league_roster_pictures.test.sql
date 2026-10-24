-- A player's picture on the season page (migration 20261024195612): the
-- roster and the officials carry avatar_path.
begin;
\ir _helpers.psql
select plan(3);

select tests.create_user('Pic LD') as ld \gset
select tests.create_user('Pic P1') as p1 \gset
update public.tbl_players set avatar_path = tests.player_of(:'p1') || '/abc.webp' where id = tests.player_of(:'p1');

select tests.sign_in(:'ld');
select public.tdc_create_league('Pic League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Alpha') as ta \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p1'), :'ta', true);

select is((select avatar_path from public.tdc_team_roster(:'ta') where player_id = tests.player_of(:'p1')),
	tests.player_of(:'p1') || '/abc.webp', 'the roster carries a player''s picture');
select is((select avatar_path from public.tdc_league_officials(:'season') where player_id = tests.player_of(:'ld')),
	null, 'and the officials theirs (none set)');
select is((select role_name from public.tdc_league_officials(:'season') where player_id = tests.player_of(:'ld')),
	'League director', 'the officials read as before');
select tests.sign_out();

select * from finish();
rollback;
