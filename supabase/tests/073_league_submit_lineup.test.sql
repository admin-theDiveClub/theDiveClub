-- A lineup goes in all at once, when the captain locks it (migration
-- 20261112125926, UV 12 Nov). tdc_submit_lineup sets who is here, the order
-- and the lock in one call, through the three existing functions, so a
-- refusal anywhere leaves nothing saved.
--
-- A three-man league, Hosts at home, Guests away.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('Sub Dee') as dee \gset
select tests.create_user('Sub H1') as h1 \gset
select tests.create_user('Sub H2') as h2 \gset
select tests.create_user('Sub H3') as h3 \gset
select tests.create_user('Sub H4') as h4 \gset
select tests.create_user('Sub A1') as a1 \gset
select tests.create_user('Sub A2') as a2 \gset
select tests.create_user('Sub A3') as a3 \gset

select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'h3') as ph3 \gset
select tests.player_of(:'h4') as ph4 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset
select tests.player_of(:'a3') as pa3 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Submit League', tests.rules('{"team_size": 3}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'ph3', :'th');
select public.tdc_add_league_entrant(:'season', :'ph4', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_add_league_entrant(:'season', :'pa3', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select tests.sign_out();

select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset

select tests.sign_in(:'dee');
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

-- An earlier save, as the old page made: H4 here and in position 1.
select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph4');
select public.tdc_set_lineup_slot(:'m', 1, :'ph4');
select tests.sign_out();

-- ─── Refusals leave nothing saved ───

select tests.sign_in(:'a1');
select throws_ok(
	format($$ select public.tdc_submit_lineup(%L, 'home', array[%L, %L]::uuid[], array[%L, %L]::uuid[]) $$,
		:'m', :'ph1', :'ph2', :'ph1', :'ph2'),
	'P0001', 'Only that team''s captain, or the league director, can lock its lineup.',
	'the other captain cannot lock this side');
select tests.sign_out();

select tests.sign_in(:'h1');
select throws_ok(
	format($$ select public.tdc_submit_lineup(%L, 'home', array[%L, %L]::uuid[], array[%L, %L]::uuid[]) $$,
		:'m', :'ph1', :'pa1', :'ph1', :'pa1'),
	'P0001', 'Everybody in a lineup has to be on that team.',
	'a player from the other team is refused');
select throws_ok(
	format($$ select public.tdc_submit_lineup(%L, 'home', array[%L]::uuid[], array[%L, %L]::uuid[]) $$,
		:'m', :'ph1', :'ph1', :'ph1'),
	'P0001', 'A player can hold only one position.',
	'one player in two positions is refused');
select throws_ok(
	format($$ select public.tdc_submit_lineup(%L, 'home', array[%L]::uuid[], array[%L, %L]::uuid[]) $$,
		:'m', :'ph1', :'ph1', :'ph2'),
	'P0001', 'A player with a position has to be here tonight.',
	'a position for somebody not here is refused');
select throws_ok(
	format($$ select public.tdc_submit_lineup(%L, 'home', array[%L, %L, %L, %L]::uuid[], array[%L, %L, %L, %L]::uuid[]) $$,
		:'m', :'ph1', :'ph2', :'ph3', :'ph4', :'ph1', :'ph2', :'ph3', :'ph4'),
	'P0001', 'This match has 3 positions, so there is no position 4.',
	'a fourth position is refused by tdc_set_lineup_slot');
select tests.sign_out();

select is(
	(select array_agg(player_id order by player_id) from public.tbl_league_match_squad where match_id = :'m' and side = 'home'),
	array[:'ph4'::uuid],
	'after the refusals the squad is as it was');
select is(
	(select player_id from public.tbl_league_match_order where match_id = :'m' and side = 'home' and lineup_slot = 1),
	:'ph4'::uuid,
	'and so is the order, even after the refusal that got as far as the positions');
select is(
	(select count(*)::integer from public.tbl_league_match_sides where match_id = :'m' and locked_at is not null),
	0, 'and nothing is locked');

-- ─── The captain locks in one call ───

-- H3 is here without a position; H4, saved earlier, is not here tonight.
select tests.sign_in(:'h1');
select is(
	public.tdc_submit_lineup(:'m', 'home', array[:'ph1', :'ph2', :'ph3']::uuid[], array[:'ph2', :'ph1']::uuid[]),
	0, 'the first side locks; no frames yet');
select tests.sign_out();

select is(
	(select array_agg(player_id order by player_id) from public.tbl_league_match_squad where match_id = :'m' and side = 'home'),
	(select array_agg(x order by x) from unnest(array[:'ph1', :'ph2', :'ph3']::uuid[]) x),
	'the squad is exactly who was sent: H4 is out, H3 is in');
select is(
	(select array_agg(coalesce(player_id::text, '-') order by lineup_slot) from public.tbl_league_match_order where match_id = :'m' and side = 'home'),
	array[:'ph2', :'ph1', '-'],
	'the order is as sent: H2, H1, and position 3 empty (H4 taken out of position 1)');

select tests.sign_in(:'h1');
select throws_ok(
	format($$ select public.tdc_submit_lineup(%L, 'home', array[%L]::uuid[], array[%L]::uuid[]) $$,
		:'m', :'ph1', :'ph1'),
	'P0001', 'That lineup is already locked. A change now is a reserve on the night, not a new order.',
	'a second submission for a locked side is refused, not ignored');
select tests.sign_out();

-- The director locks the away side; the side is said, as the director has none.
select tests.sign_in(:'dee');
select is(
	public.tdc_submit_lineup(:'m', 'away', array[:'pa1', :'pa2', :'pa3']::uuid[], array[:'pa1', :'pa2', :'pa3']::uuid[]),
	9, 'the director locks the second side and the nine frames are built');
select tests.sign_out();

select tests.sign_in(:'h1');
select is(
	(select home_player_id::text || away_player_id::text from public.tdc_match_card(:'m') where lineup_slot = 1),
	:'ph2' || :'pa1', 'frame 1 seats the home position 1 that was sent, H2, against A1');
select tests.sign_out();

select * from finish();
rollback;
