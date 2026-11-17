-- Every team's roster in one call (migration 20261117041517, UV 17 Nov 2026).
--
-- tdc_league_season_rosters must answer exactly what tdc_team_roster answers
-- for each team in the season, in the same order within a team, so the Season
-- tab shows the same rosters it did with one call per team.
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('Ro Director') as dee \gset
select tests.create_user('Ro Alpha') as a1 \gset
select tests.create_user('Ro Bravo') as a2 \gset
select tests.create_user('Ro Charlie') as b1 \gset
select tests.create_user('Ro Unplaced') as u1 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset
select tests.player_of(:'b1') as pb1 \gset
select tests.player_of(:'u1') as pu1 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Ro League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as tg \gset
select public.tdc_add_league_entrant(:'season', :'pa1', :'th', false);
select public.tdc_add_league_entrant(:'season', :'pa2', :'th', true);
select public.tdc_add_league_entrant(:'season', :'pb1', :'tg', true);
select public.tdc_add_league_entrant(:'season', :'pu1', null, false);
-- An empty team has no rows.
select public.tdc_create_team(:'season', 'Empty') as te \gset

-- Another season's team stays out.
select public.tdc_create_league_season(:'league', 'Autumn') as other \gset
select public.tdc_create_team(:'other', 'Elsewhere') as tx \gset
select public.tdc_add_league_entrant(:'other', :'pa1', :'tx', true);

-- ─── The same rows as one call per team ───

select results_eq(
	format($$ select team_id, player_id, display_name, is_captain, status, confirmed, avatar_path
		from public.tdc_league_season_rosters(%L) where team_id = %L $$, :'season', :'th'),
	format($$ select %L::uuid, player_id, display_name, is_captain, status, confirmed, avatar_path
		from public.tdc_team_roster(%L) $$, :'th', :'th'),
	'Hosts: the same rows, in the same order (captain first), as tdc_team_roster');
select results_eq(
	format($$ select player_id from public.tdc_league_season_rosters(%L) where team_id = %L $$, :'season', :'tg'),
	format($$ select player_id from public.tdc_team_roster(%L) $$, :'tg'),
	'Guests: the same rows as tdc_team_roster');
select is(
	(select count(*)::int from public.tdc_league_season_rosters(:'season')),
	3,
	'only this season''s placed players: no unplaced entrant, nobody from another season, nothing for an empty team');
select tests.sign_out();

-- ─── Who may call it ───

select ok(not has_function_privilege('anon', 'public.tdc_league_season_rosters(uuid)', 'execute'),
	'anon cannot call it');
select ok(has_function_privilege('authenticated', 'public.tdc_league_season_rosters(uuid)', 'execute'),
	'a signed-in player can, as with tdc_team_roster');

select * from finish();
rollback;
