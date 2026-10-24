-- A league season's status, and the league search's filters (migration
-- 20261024094617).
--
-- UV, 24 Oct:
--   • the status is the league director's to set: taking entries, running,
--     on break, finished; a new season is taking entries
--   • the search filters by discipline, status, and team or singles
--     (singles leagues cannot exist yet, so 'singles' finds nothing)
--   • a filter value the search does not know is refused, not quietly empty
--   • the search still shows only listed seasons a player can get into
--
-- Three listed leagues: an 8-ball and a 9-ball taking names, and an 8-ball
-- on a break. A fourth, listed but LD-only, never appears.
begin;
\ir _helpers.psql
select plan(18);

select tests.create_user('Status Dee') as dee \gset
select tests.create_user('Status Cap') as cap \gset
select tests.create_user('Status Stranger') as stranger \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Status Eight ' || md5(random()::text), tests.rules('{"team_size": 5, "discipline": "8ball"}')) as l8 \gset
select public.tdc_create_league_season(:'l8', 'Spring') as s8 \gset
select public.tdc_create_league('Status Nine ' || md5(random()::text), tests.rules('{"team_size": 4, "discipline": "9ball"}')) as l9 \gset
select public.tdc_create_league_season(:'l9', 'Spring') as s9 \gset
select public.tdc_create_league('Status Break ' || md5(random()::text), tests.rules('{"team_size": 5, "discipline": "8ball"}')) as lb \gset
select public.tdc_create_league_season(:'lb', 'Spring') as sb \gset
select public.tdc_create_league('Status Closed ' || md5(random()::text), tests.rules('{"team_size": 5, "discipline": "8ball"}')) as lc \gset
select public.tdc_create_league_season(:'lc', 'Spring') as sc \gset
select public.tdc_create_team(:'s8', 'Alpha') as alpha \gset
select public.tdc_add_league_entrant(:'s8', tests.player_of(:'cap'), :'alpha', true);
select tests.sign_out();

update public.tbl_league_seasons set is_listed = true, entry_mode = 'interested' where id in (:'s8', :'s9', :'sb');
update public.tbl_league_seasons set is_listed = true, entry_mode = 'ld_only' where id = :'sc';

select is((select status from public.tbl_league_seasons where id = :'s8'), 'taking_entries',
	'a new season is taking entries');

-- ─── Setting it ───

select tests.sign_in(:'dee');
select lives_ok(format($$ select public.tdc_set_league_season_status(%L, 'on_break') $$, :'sb'),
	'the league director puts a league on a break');
select throws_ok(format($$ select public.tdc_set_league_season_status(%L, 'paused') $$, :'sb'),
	'P0001', 'TDC (Error): unknown league status "paused".', 'an unknown status is refused');
select throws_ok(format($$ select public.tdc_set_league_season_status(%L, null) $$, :'sb'),
	'P0001', 'TDC (Error): unknown league status "<NULL>".', 'no status is refused');
select tests.sign_out();

select is((select status from public.tbl_league_seasons where id = :'sb'), 'on_break',
	'the status was written');

select tests.sign_in(:'cap');
select throws_ok(format($$ select public.tdc_set_league_season_status(%L, 'finished') $$, :'s8'),
	'P0001', 'Only the league director can change the league''s status.', 'a captain cannot change it');
select tests.sign_out();

select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_set_league_season_status(%L, 'finished') $$, :'s8'),
	'P0001', 'Only the league director can change the league''s status.', 'a stranger cannot change it');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_set_league_season_status(%L, 'finished') $$, :'s8'),
	'42501', null, 'anon cannot call it');
select tests.sign_out();

select is((select status from public.tbl_league_seasons where id = :'s8'), 'taking_entries',
	'nothing the refusals tried was written');

-- ─── The search ───
-- Only this test's leagues: each name carries "Status ".

select tests.sign_in(:'stranger');
select is(
	(select count(*)::int from public.tdc_search_leagues('Status ')),
	3, 'three listed leagues a player can get into; the LD-only one never appears');
select is(
	(select string_agg(discipline || '/' || team_size || '/' || status, ',' order by discipline, status)
	 from public.tdc_search_leagues('Status ')),
	'8ball/5/on_break,8ball/5/taking_entries,9ball/4/taking_entries',
	'each result carries its discipline, team size and status');
select is(
	(select count(*)::int from public.tdc_search_leagues('Status ', p_discipline => '9ball')),
	1, 'discipline: 9-ball finds the 9-ball league');
select is(
	(select count(*)::int from public.tdc_search_leagues('Status ', p_status => 'on_break')),
	1, 'status: on break finds the league on a break');
select is(
	(select count(*)::int from public.tdc_search_leagues('Status ', p_discipline => '8ball', p_status => 'taking_entries')),
	1, 'filters combine');
select is(
	(select count(*)::int from public.tdc_search_leagues('Status ', p_kind => 'team')),
	3, 'team finds every league');
select is(
	(select count(*)::int from public.tdc_search_leagues('Status ', p_kind => 'singles')),
	0, 'singles finds nothing until singles leagues exist');
select throws_ok($$ select * from public.tdc_search_leagues(p_status => 'paused') $$,
	'P0001', 'TDC (Error): unknown league status "paused".', 'an unknown status filter is refused');
select throws_ok($$ select * from public.tdc_search_leagues(p_kind => 'doubles') $$,
	'P0001', 'TDC (Error): a league is "team" or "singles", not "doubles".', 'an unknown kind is refused');
select tests.sign_out();

select * from finish();
rollback;
