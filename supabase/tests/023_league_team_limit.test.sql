-- A team's limit is its team size plus its reserves (migration 20261023213048).
--
-- Settled with UV on 23 Oct (docs/DECISIONS.md):
--   • reserves allowed is a season setting, default 2, 0 to 10
--   • only active players count; a player away (inactive) frees a place
--   • the player, their captain or the director marks them away or back
--   • the limit binds captains and players, never the director
--   • lowering it below a team's size is allowed
--   • every league has a team size from 2 to 10
--
-- A two-man league with one reserve, so a team's limit is 3.
begin;
\ir _helpers.psql
select plan(24);

select tests.create_user('Limit Dee') as dee \gset
select tests.create_user('Limit Cap') as cap \gset
select tests.create_user('Limit Bob') as bob \gset
select tests.create_user('Limit P1') as u1 \gset
select tests.create_user('Limit P2') as u2 \gset
select tests.create_user('Limit P3') as u3 \gset
select tests.create_user('Limit P4') as u4 \gset

select tests.player_of(:'u1') as p1 \gset
select tests.player_of(:'u2') as p2 \gset
select tests.player_of(:'u3') as p3 \gset
select tests.player_of(:'u4') as p4 \gset

-- ─── A league needs a team size ───

select tests.sign_in(:'dee');
select throws_ok(
	format($$ select public.tdc_create_league('No Size', %L::jsonb) $$, tests.rules()),
	'P0001', 'A league needs a team size from 2 to 10: the number of players a side in each session.',
	'a league with no team size is refused');

select public.tdc_create_league('Limit League', tests.rules('{"team_size": 2}')) as league \gset

select throws_ok(
	format($$ select public.tdc_create_league_season(%L, 'Too Many', p_max_reserves => 11) $$, :'league'),
	'P0001', 'Reserves allowed must be a number from 0 to 10.',
	'eleven reserves is refused when the season is made');

select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select tests.sign_out();

select is((select max_reserves from public.tbl_league_seasons where id = :'season'), 2,
	'a season made without saying has two reserves');

select tests.sign_in(:'dee');
select public.tdc_update_league_season(:'season', p_max_reserves => 1);
select public.tdc_create_team(:'season', 'Alpha') as alpha \gset
select public.tdc_create_team(:'season', 'Bravo') as bravo \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'cap'), :'alpha', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'bob'), :'bravo', true);
select public.tdc_add_league_entrant(:'season', :'p1');
select public.tdc_add_league_entrant(:'season', :'p2');
select public.tdc_add_league_entrant(:'season', :'p3');
select public.tdc_add_league_entrant(:'season', :'p4');

select is(
	(select active_players || ' of ' || team_limit from public.tdc_league_season_teams(:'season') where team_id = :'alpha'),
	'1 of 3', 'the teams list gives each team''s active players against its limit');
select tests.sign_out();

-- ─── Claiming stops at the limit, for a captain ───

select tests.sign_in(:'cap');
select public.tdc_team_claim_player(:'alpha', :'p1');
select public.tdc_team_claim_player(:'alpha', :'p2');
select throws_ok(
	format($$ select public.tdc_team_claim_player(%L, %L) $$, :'alpha', :'p3'),
	'P0001', 'Alpha is full: 3 of 3 active players. Mark somebody away first, or ask the league director.',
	'a captain cannot claim a fourth player onto a team of three');
select tests.sign_out();

select tests.sign_in(:'dee');
select lives_ok(
	format($$ select public.tdc_team_claim_player(%L, %L) $$, :'alpha', :'p3'),
	'the director can sign somebody past the limit');
select is(
	(select active_players || ' of ' || team_limit from public.tdc_league_season_teams(:'season') where team_id = :'alpha'),
	'4 of 3', 'a team over its limit shows as over');
select tests.sign_out();

-- ─── Away and back ───

select tests.sign_in(:'u3');
select lives_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, false) $$, :'alpha', :'p3'),
	'a player can mark themselves away');
select tests.sign_out();

select is((select status from public.tbl_league_season_entrants where league_season_id = :'season' and player_id = :'p3'),
	'inactive', 'away is inactive, and they stay on the team');

select is((select team_id from public.tbl_league_season_entrants where league_season_id = :'season' and player_id = :'p3'),
	:'alpha'::uuid, 'an away player keeps their place on the team');

select tests.sign_in(:'u3');
select throws_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, true) $$, :'alpha', :'p3'),
	'P0001', 'Alpha is full: 3 of 3 active players. Mark somebody away first, or ask the league director.',
	'coming back is refused while the team is full');
select tests.sign_out();

select tests.sign_in(:'cap');
select lives_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, false) $$, :'alpha', :'p1'),
	'a captain can mark one of their players away');
select lives_ok(
	format($$ select public.tdc_team_claim_player(%L, %L) $$, :'alpha', :'p4'),
	'with a player away there is room to claim another');
select throws_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, false) $$, :'alpha', tests.player_of(:'cap')),
	'P0001', 'That player is the team''s only captain. Name another captain first, or ask the league director.',
	'the only captain cannot be marked away');
select tests.sign_out();

select tests.sign_in(:'u2');
select throws_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, false) $$, :'alpha', :'p4'),
	'P0001', 'Only the player, their captain or the league director can mark a player away or back.',
	'a team-mate who is not captain cannot mark somebody else away');
select tests.sign_out();

select tests.sign_in(:'bob');
select throws_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, false) $$, :'alpha', :'p2'),
	'P0001', 'Only the player, their captain or the league director can mark a player away or back.',
	'another team''s captain cannot either');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, false) $$, :'alpha', :'p2'),
	'42501', null, 'nobody signed out can call it at all');
select tests.sign_out();

select tests.sign_in(:'dee');
select lives_ok(
	format($$ select public.tdc_set_team_player_active(%L, %L, true) $$, :'alpha', :'p1'),
	'the director can bring a player back past the limit');
select is(
	(select active_players from public.tdc_league_season_teams(:'season') where team_id = :'alpha'),
	4, 'and the team is over again');
select tests.sign_out();

-- ─── Withdrawn players do not count ───

select tests.sign_in(:'u2');
select public.tdc_withdraw_league_entry(:'season');
select tests.sign_out();

select tests.sign_in(:'dee');
select is(
	(select active_players from public.tdc_league_season_teams(:'season') where team_id = :'alpha'),
	3, 'a player who withdraws frees their place');

-- ─── Changing the setting ───

select lives_ok(
	format($$ select public.tdc_update_league_season(%L, p_max_reserves => 0) $$, :'season'),
	'lowering reserves below a team''s size is allowed');
select is(
	(select active_players || ' of ' || team_limit from public.tdc_league_season_teams(:'season') where team_id = :'alpha'),
	'3 of 2', 'and the team is shown over its new limit');
select throws_ok(
	format($$ select public.tdc_update_league_season(%L, p_max_reserves => 11) $$, :'season'),
	'P0001', 'Reserves allowed must be a number from 0 to 10.',
	'eleven reserves is refused on an update too');
select throws_like(
	format($$ select public.tdc_update_league(%L, null, %L::jsonb) $$, :'league', tests.rules()),
	'A league needs a team size from 2 to 10%',
	'a league cannot be changed to no team size');
select tests.sign_out();

select * from finish();
rollback;
