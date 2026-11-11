-- League placeholders and a fixture's external_ref (migration
-- 20261111130357, UV 11 Nov 2026; docs/STATUS.md R1).
--
-- A placeholder is a player record with no account, made by the import as a
-- walk-in with the email from the league's players file, and entered with
-- placeholder = true. Only such an entry may name a player with no account;
-- every other way in is still refused. A captain lines them up like anybody
-- else, and signing up with that email lets them claim the record, which
-- carries their entry across.
begin;
\ir _helpers.psql
select plan(13);

select tests.create_user('Ph Director') as dee \gset
select tests.create_user('Ph Captain') as cap \gset
select tests.create_user('Ph Opp') as opp \gset
select tests.player_of(:'cap') as pcap \gset
select tests.player_of(:'opp') as popp \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Ph League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_league_season(:'league', 'Autumn') as season2 \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'pcap', :'th', true);
select public.tdc_add_league_entrant(:'season', :'popp', :'ta', true);
select tests.sign_out();

-- Two placeholders, made the way the import makes them.
insert into public.tbl_players (display_name, first_name, last_name, player_type)
	values ('Kiv Placeholder', 'Kiv', 'Placeholder', 'walk_in') returning id as pk \gset
insert into public.tbl_player_identifiers (player_id, kind, value)
	values (:'pk', 'email', private.tdc_normalize_identifier('email', 'Kiv.Placeholder@Example.com'));
insert into public.tbl_players (display_name, player_type)
	values ('Plain Walk-in', 'walk_in') returning id as pw \gset

-- ─── Who may be an entrant ───

select throws_ok(
	format($$ insert into public.tbl_league_season_entrants (league_season_id, player_id, team_id, status) values (%L, %L, %L, 'active') $$, :'season', :'pw', :'th'),
	'P0001', 'Walk-ins and guests cannot play in a league. A league player needs an account of their own.',
	'a walk-in entered without the placeholder mark is still refused');

select lives_ok(
	format($$ insert into public.tbl_league_season_entrants (league_season_id, player_id, team_id, status, placeholder) values (%L, %L, %L, 'active', true) $$, :'season', :'pk', :'th'),
	'a placeholder entry may name a player with no account');

select tests.sign_in(:'dee');
select throws_ok(format($$ select public.tdc_add_league_entrant(%L, %L, %L) $$, :'season', :'pw', :'ta'),
	null, null, 'the director still cannot add a walk-in through tdc_add_league_entrant');
select tests.sign_out();

select tests.create_user('Ph Member') as mem \gset
select lives_ok(
	format($$ insert into public.tbl_league_season_entrants (league_season_id, player_id, status) values (%L, %L, 'active') $$, :'season', tests.player_of(:'mem')),
	'an account holder needs no mark, as before');

-- ─── A captain lines a placeholder up ───

select tests.sign_in(:'dee');
select public.tdc_add_league_fixture(:'season', 1, :'th', :'ta') as fx \gset
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

select tests.sign_in(:'cap');
select lives_ok(format($$ select public.tdc_set_match_squad(%L, %L) $$, :'m', :'pk'),
	'the captain puts the placeholder in tonight''s squad');
select lives_ok(format($$ select public.tdc_set_lineup_slot(%L, 1, %L) $$, :'m', :'pk'),
	'and in position 1');
select tests.sign_out();

select is((select player_id from public.tbl_league_match_order where match_id = :'m' and lineup_slot = 1),
	:'pk'::uuid, 'position 1 holds the placeholder');

-- ─── They sign up with that email and claim the record ───

select tests.create_user('Kiv Signs Up') as kiv \gset
update auth.users set email = 'kiv.placeholder@example.com' where id = :'kiv';

select tests.sign_in(:'kiv');
select is((select player_id from public.tdc_find_my_walk_in()), :'pk'::uuid,
	'signing up with the email finds the placeholder');
select is(public.tdc_claim_my_walk_in(:'pk'), :'pk'::uuid, 'and claims it, keeping its player id');
select tests.sign_out();

select is((select user_id from public.tbl_players where id = :'pk'), :'kiv'::uuid, 'the record now has the account');
select is((select team_id from public.tbl_league_season_entrants where league_season_id = :'season' and player_id = :'pk'),
	:'th'::uuid, 'their team place stays');

-- ─── external_ref: once per season ───

update public.tbl_league_fixtures set external_ref = '91586371' where id = :'fx';
select throws_ok(
	format($$ insert into public.tbl_league_fixtures (league_season_id, round, position, home_team_id, away_team_id, external_ref) values (%L, 2, 1, %L, %L, '91586371') $$, :'season', :'ta', :'th'),
	'23505', null, 'the same external_ref twice in one season is refused');

select tests.sign_in(:'dee');
select public.tdc_create_team(:'season2', 'Autumn Hosts') as th2 \gset
select tests.sign_out();
select lives_ok(
	format($$ insert into public.tbl_league_fixtures (league_season_id, round, position, home_team_id, external_ref) values (%L, 1, 1, %L, '91586371') $$, :'season2', :'th2'),
	'the same external_ref in another season is fine');

select * from finish();
rollback;
