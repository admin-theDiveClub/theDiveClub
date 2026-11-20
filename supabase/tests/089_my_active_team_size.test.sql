-- tdc_my_active's leagues carry team_size (migration 20261120120000, UV 20 Nov),
-- so the nav menu can leave "Captain" off a singles league.
begin;
\ir _helpers.psql
select plan(2);

select tests.create_user('Active LD') as dee \gset
select tests.create_user('Active Ann') as ann \gset
select tests.player_of(:'ann') as pann \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Active Singles', tests.rules('{"team_size": 1, "approval_mode": "coordinator_approval"}'));
select id as league from public.tbl_leagues where name = 'Active Singles' \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_add_league_entrant(:'season', :'pann');
select tests.sign_out();

select tests.sign_in(:'ann');
select public.tdc_my_active() as act \gset
select is((select (x ->> 'team_size')::int from jsonb_array_elements(:'act'::jsonb -> 'leagues') x
	where x ->> 'league_season_id' = :'season'), 1, 'a singles league reports team size 1');
select ok((select (x ->> 'i_captain')::boolean from jsonb_array_elements(:'act'::jsonb -> 'leagues') x
	where x ->> 'league_season_id' = :'season'), 'and its player is captain of their team of one (so the menu must hide it)');

select * from finish();
rollback;
