-- The leagues list: each season's dates, format, size and status (migration
-- 20261024094617, and the status from 20261024102616).
--
-- tdc_my_leagues gained ends_on, discipline, team_size, team_count,
-- player_count and status for the "Your Leagues" rows on /leagues/ (UV,
-- 24 Oct). Setting the status is 030.
--   • discipline and team size come from the season's merged rules, so a
--     season's override wins over the league's
--   • the player count is active players only, across the whole league
--   • a stranger still sees nothing, and anon cannot call it
--
-- A three-man 9-ball league with two teams, four active players, one on the
-- Name Down list and one withdrawn.
begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('List Dee') as dee \gset
select tests.create_user('List Cap') as cap \gset
select tests.create_user('List Bob') as bob \gset
select tests.create_user('List P1') as u1 \gset
select tests.create_user('List P2') as u2 \gset
select tests.create_user('List Name Down') as u3 \gset
select tests.create_user('List Gone') as u4 \gset
select tests.create_user('List Stranger') as stranger \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('List League', tests.rules('{"team_size": 3, "discipline": "9ball"}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring', p_starts_on => '2026-11-04', p_ends_on => '2027-03-31') as season \gset
select public.tdc_create_team(:'season', 'Alpha') as alpha \gset
select public.tdc_create_team(:'season', 'Bravo') as bravo \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'cap'), :'alpha', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'bob'), :'bravo', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u1'), :'alpha');
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u2'));
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u3'), p_status => 'interested');
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u4'));

-- A second season of the same league that plays 10-ball, four-man.
select public.tdc_create_league_season(:'league', 'Autumn',
	p_rules_overrides => '{"discipline": "10ball", "team_size": 4}'::jsonb) as autumn \gset
select tests.sign_out();

update public.tbl_league_season_entrants set status = 'withdrawn'
where league_season_id = :'season' and player_id = tests.player_of(:'u4');

-- ─── The director ───

select tests.sign_in(:'dee');
select is(
	(select ends_on from public.tdc_my_leagues() where league_season_id = :'season'),
	'2027-03-31'::date, 'the season''s end date comes back');
select is(
	(select starts_on from public.tdc_my_leagues() where league_season_id = :'season'),
	'2026-11-04'::date, 'the start date still comes back');
select is(
	(select discipline || ' ' || team_size from public.tdc_my_leagues() where league_season_id = :'season'),
	'9ball 3', 'discipline and team size come from the league''s rules');
select is(
	(select discipline || ' ' || team_size from public.tdc_my_leagues() where league_season_id = :'autumn'),
	'10ball 4', 'a season''s override wins over the league''s rules');
select is(
	(select team_count from public.tdc_my_leagues() where league_season_id = :'season'),
	2, 'two teams');
select is(
	(select player_count from public.tdc_my_leagues() where league_season_id = :'season'),
	4, 'four players: Name Down and withdrawn are not counted');
select is(
	(select team_count || ' ' || player_count from public.tdc_my_leagues() where league_season_id = :'autumn'),
	'0 0', 'an empty season counts nothing');
select is(
	(select status from public.tdc_my_leagues() where league_season_id = :'season'),
	'taking_entries', 'a new season is taking entries');
select tests.sign_out();

-- ─── A player sees the whole league's numbers, not their team's ───

select tests.sign_in(:'cap');
select is(
	(select team_count || ' ' || player_count || ' ' || my_team_name from public.tdc_my_leagues() where league_season_id = :'season'),
	'2 4 Alpha', 'a captain sees the league''s counts beside their own team');
select is(
	(select count(*)::int from public.tdc_my_leagues() where league_season_id = :'autumn'),
	0, 'a season they are not in does not appear');
select tests.sign_out();

-- ─── Nobody else ───

select tests.sign_in(:'stranger');
select is((select count(*)::int from public.tdc_my_leagues()), 0, 'a stranger sees no seasons');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok($$ select * from public.tdc_my_leagues() $$, '42501', null, 'anon cannot call it');
select tests.sign_out();

select * from finish();
rollback;
