-- League placeholders link to their account by themselves (migration
-- 20261116073757, UV 16 Nov 2026).
--
-- tdc_link_my_league_records links the signed-in account to a league
-- placeholder with the same confirmed email, keeping the placeholder's player
-- id, and returns the league seasons it was in for the nav's strip. Leagues
-- only: a tournament walk-in with the same email is left for the profile
-- page's button. One email can sit on one record only, so there is never a
-- choice between two.
begin;
\ir _helpers.psql
select plan(13);

select tests.create_user('Al Director') as dee \gset
select tests.create_user('Al Captain') as cap \gset
select tests.player_of(:'cap') as pcap \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Al League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_add_league_entrant(:'season', :'pcap', :'th', true);
select tests.sign_out();

-- A placeholder, made the way the import makes them, on a team and in a lineup.
insert into public.tbl_players (display_name, first_name, last_name, player_type)
	values ('Ren Placeholder', 'Ren', 'Placeholder', 'walk_in') returning id as pk \gset
insert into public.tbl_player_identifiers (player_id, kind, value)
	values (:'pk', 'email', private.tdc_normalize_identifier('email', 'Ren.Placeholder@Example.com'));
insert into public.tbl_league_season_entrants (league_season_id, player_id, team_id, status, placeholder)
	values (:'season', :'pk', :'th', 'active', true);

-- A plain walk-in (a tournament's), with an email of its own.
insert into public.tbl_players (display_name, player_type)
	values ('Tom Walkin', 'walk_in') returning id as pw \gset
insert into public.tbl_player_identifiers (player_id, kind, value)
	values (:'pw', 'email', private.tdc_normalize_identifier('email', 'tom.walkin@example.com'));

-- ─── Signed out ───

select throws_ok($$ select * from public.tdc_link_my_league_records() $$,
	'P0001', 'Sign in first.', 'signed out: refused');

-- ─── Nothing to link ───

select tests.sign_in(:'cap');
select is((select count(*)::int from public.tdc_link_my_league_records()), 0,
	'an account with no placeholder links nothing');
select tests.sign_out();

-- ─── Not confirmed: nothing ───

select tests.create_user('Ren Unconfirmed', false) as renu \gset
update auth.users set email = 'ren.placeholder@example.com' where id = :'renu';
select tests.sign_in(:'renu');
select is((select count(*)::int from public.tdc_link_my_league_records()), 0,
	'an unconfirmed email links nothing');
select tests.sign_out();
select is((select user_id from public.tbl_players where id = :'pk'), null::uuid, 'the placeholder still has no account');
update auth.users set email = 'renu.elsewhere@example.com' where id = :'renu';

-- ─── The placeholder signs up with that email ───

select tests.create_user('Ren Signs Up') as ren \gset
select tests.player_of(:'ren') as pren \gset
update auth.users set email = 'ren.placeholder@example.com' where id = :'ren';

select tests.sign_in(:'ren');
select results_eq(
	$$ select league_season_id, league_name, season_name from public.tdc_link_my_league_records() $$,
	format($$ values (%L::uuid, 'Al League'::text, 'Spring'::text) $$, :'season'),
	'linked at once, returning the league season for the strip''s button');
select is((select count(*)::int from public.tdc_link_my_league_records()), 0,
	'a second call links nothing');
select tests.sign_out();

select is((select user_id from public.tbl_players where id = :'pk'), :'ren'::uuid,
	'the placeholder''s record now has the account, keeping its player id');
select is((select count(*)::int from public.tbl_players where id = :'pren'), 0,
	'the empty sign-up record is gone');
select is((select team_id from public.tbl_league_season_entrants where league_season_id = :'season' and player_id = :'pk'),
	:'th'::uuid, 'their team place stays');

-- ─── Leagues only ───

select tests.create_user('Tom Signs Up') as tom \gset
update auth.users set email = 'tom.walkin@example.com' where id = :'tom';
select tests.sign_in(:'tom');
select is((select count(*)::int from public.tdc_link_my_league_records()), 0,
	'a walk-in with no league placeholder entry is not linked');
select is((select player_id from public.tdc_find_my_walk_in()), :'pw'::uuid,
	'and is still offered on the profile page');
select tests.sign_out();

-- ─── One email, one record: what the function relies on ───

insert into public.tbl_players (display_name, player_type)
	values ('Sam Two', 'walk_in') returning id as ps2 \gset
select throws_ok(
	format($$ insert into public.tbl_player_identifiers (player_id, kind, value) values (%L, 'email', 'tom.walkin@example.com') $$, :'ps2'),
	'23505', null, 'an email already on one record cannot go on a second');

-- ─── Who may call it ───

select ok(not has_function_privilege('anon', 'public.tdc_link_my_league_records()', 'execute'),
	'anon cannot call it');

select * from finish();
rollback;
