-- Open for entry: Visible to public, and the list players find it in
-- (migration 20261105084149).
--
-- UV, 5 Nov:
--   • the creator marks a tournament visible to public; off by default
--   • only signed-in players see the list
--   • switching Visible on also shares the poster
-- And Claude's, from the same migration:
--   • stopping sharing turns Visible off; Visible off leaves the poster alone
--   • listed only while players may enter: not td_only, Open (or Draft not set
--     by hand), no draw; never one you run or are already in
begin;
\ir _helpers.psql
select plan(22);

select tests.create_user('Open Dee') as dee \gset
select tests.create_user('Open Pat') as pat \gset
select tests.create_user('Open Sam') as sam \gset

-- ─── Visible on at creation ───

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Open Listed', tests.rules(),
	p_entry_mode => 'interested', p_is_listed => true) as listed \gset
select public.tdc_create_tournament('Open Hidden', tests.rules(),
	p_entry_mode => 'interested') as hidden \gset
select tests.sign_out();

select is((select is_listed from public.tbl_tournaments where id = :'listed'), true,
	'created visible: the switch is on');
select is((select is_public from public.tbl_tournament_posters where tournament_id = :'listed'), true,
	'created visible: a poster was built and shared with it');
select is((select is_listed from public.tbl_tournaments where id = :'hidden'), false,
	'off by default');
select is((select count(*)::integer from public.tbl_tournament_posters where tournament_id = :'hidden'), 0,
	'off by default: no poster is made');

-- ─── Who sees it ───

select tests.sign_in(:'pat');
select ok(exists (select 1 from public.tdc_open_tournaments() where id = :'listed'),
	'a player finds a visible tournament nobody has entered (it reads Draft)');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'hidden'),
	'a hidden one is not listed');
select lives_ok(format($$ select public.tdc_enter_tournament(%L) $$, :'listed'),
	'the player enters');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'listed'),
	'once entered it leaves their Open list (it is on their own list)');
select tests.sign_out();

select tests.sign_in(:'sam');
select ok(exists (select 1 from public.tdc_open_tournaments() where id = :'listed'),
	'another player still finds it, now Open');
select tests.sign_out();

select tests.sign_in(:'dee');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'listed'),
	'the director does not see their own tournament here');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok($$ select * from public.tdc_open_tournaments() $$,
	'42501', null, 'a signed-out visitor cannot read the list');
select tests.sign_out();

-- ─── Visible on afterwards shares the poster ───

select tests.sign_in(:'sam');
select throws_ok(format($$ select public.tdc_update_tournament(%L, p_is_listed => true) $$, :'hidden'),
	'P0001', 'Only the people running this tournament can change it.', 'a player cannot list someone else''s tournament');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_publish_poster(:'hidden', true, false, false);
select public.tdc_update_tournament(:'hidden', p_is_listed => true);
select tests.sign_out();

select is((select is_public from public.tbl_tournament_posters where tournament_id = :'hidden'), true,
	'Visible on shares a private poster');
select is((select include_entrants from public.tbl_tournament_posters where tournament_id = :'hidden'), true,
	'and keeps the director''s choice to show names');

select tests.sign_in(:'sam');
select ok(exists (select 1 from public.tdc_open_tournaments() where id = :'hidden'),
	'and players find it');
select tests.sign_out();

-- ─── Only while players may enter ───

select tests.sign_in(:'dee');
select public.tdc_update_tournament(:'hidden', p_entry_mode => 'td_only');
select tests.sign_out();
select tests.sign_in(:'sam');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'hidden'),
	'director-only entry is not listed');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_update_tournament(:'hidden', p_entry_mode => 'interested', p_status => 'draft');
select tests.sign_out();
select tests.sign_in(:'sam');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'hidden'),
	'Draft set by hand is not listed');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_update_tournament(:'hidden', p_status => 'open');
select tests.sign_out();
insert into public.tbl_tournament_fixtures (tournament_id, round, position) values (:'hidden', 1, 1);
select tests.sign_in(:'sam');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'hidden'),
	'Open by hand but with a draw made is not listed');
select tests.sign_out();
delete from public.tbl_tournament_fixtures where tournament_id = :'hidden';

-- ─── Turning it off ───

select tests.sign_in(:'dee');
select public.tdc_update_tournament(:'hidden', p_is_listed => false);
select tests.sign_out();
select is((select is_public from public.tbl_tournament_posters where tournament_id = :'hidden'), true,
	'Visible off leaves the poster shared');
select tests.sign_in(:'sam');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'hidden'),
	'and takes it off the list');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_unpublish_poster(:'listed');
select tests.sign_out();
select is((select is_listed from public.tbl_tournaments where id = :'listed'), false,
	'stopping sharing the poster turns Visible off');
select tests.sign_in(:'sam');
select ok(not exists (select 1 from public.tdc_open_tournaments() where id = :'listed'),
	'and it leaves the list');
select tests.sign_out();

select * from finish();
rollback;
