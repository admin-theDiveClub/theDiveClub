-- Changing a season's name and dates from the settings page
-- (migration 20261023205736).
--
-- UV, 23 Oct: everything set when the league was made can be changed on the
-- settings page. The season name is stored twice — on the league's season and
-- on the period holding the dates — and both follow a rename unless another
-- league shares the period, the same rule the dates have always had.
begin;
\ir _helpers.psql
select plan(10);

select tests.create_user('Season Dee') as dee \gset
select tests.create_user('Season Stranger') as stranger \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Season League', tests.rules('{"team_size": 5}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring', 'Spring', '2027-01-01', '2027-06-30') as season \gset
select tests.sign_out();

select season_id as period from public.tbl_league_seasons where id = :'season' \gset

-- ─── A season nobody shares ───

select tests.sign_in(:'dee');
select lives_ok(
	format($$ select public.tdc_update_league_season(%L, p_name => 'Autumn') $$, :'season'),
	'the director can rename the season');
select tests.sign_out();

select is((select name from public.tbl_league_seasons where id = :'season'), 'Autumn',
	'the league''s season is renamed');
select is((select name from public.tbl_seasons where id = :'period'), 'Autumn',
	'and so is its period, which nobody else shares — the leagues list shows that name');

select tests.sign_in(:'dee');
select public.tdc_update_league_season(:'season',
	p_starts_on => '2027-02-01', p_ends_on => null, p_clear_dates => true);
select tests.sign_out();

select is((select starts_on::text || ' / ' || coalesce(ends_on::text, 'none') from public.tbl_seasons where id = :'period'),
	'2027-02-01 / none', '"exactly these": a new start, and a blank end clears only the end');

select tests.sign_in(:'dee');
select throws_ok(
	format($$ select public.tdc_update_league_season(%L, p_starts_on => '2027-05-01', p_ends_on => '2027-04-01', p_clear_dates => true) $$, :'season'),
	'P0001', 'The season cannot end before it starts.',
	'an end before the start is refused by the database, not only the page');
select throws_ok(
	format($$ select public.tdc_update_league_season(%L, p_name => ' x ') $$, :'season'),
	'P0001', 'The season needs a name of two characters or more.',
	'a one-character name is refused');
select tests.sign_out();

select is((select starts_on::text from public.tbl_seasons where id = :'period'), '2027-02-01',
	'a refused change leaves the dates as they were');

select tests.sign_in(:'stranger');
select throws_ok(
	format($$ select public.tdc_update_league_season(%L, p_name => 'Mine now') $$, :'season'),
	'P0001', 'Only the people running this league can change it.',
	'somebody who does not run the league cannot rename its season');
select tests.sign_out();

-- ─── A period two leagues share ───

select tests.sign_in(:'dee');
select public.tdc_create_league('Other League', tests.rules('{"team_size": 5}')) as other \gset
select public.tdc_create_league_season(:'other', 'Their Autumn', p_season_id => :'period') as other_season \gset
select public.tdc_update_league_season(:'season', p_name => 'Our Autumn');
select tests.sign_out();

select is((select name from public.tbl_seasons where id = :'period'), 'Autumn',
	'a shared period keeps its own name: renaming it would rename the other league''s season');

select tests.sign_in(:'dee');
select throws_ok(
	format($$ select public.tdc_update_league_season(%L, p_starts_on => '2027-03-01', p_clear_dates => true) $$, :'season'),
	'P0001', 'This period is shared with other leagues, so its dates cannot be changed from here.',
	'and its dates still cannot be moved from one league');
select tests.sign_out();

select * from finish();
rollback;
