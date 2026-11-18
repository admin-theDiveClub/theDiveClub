-- The home page's live match card (migration 20261118062033, UV 18 Nov 2026).
--
-- tdc_home_cards 'live': a team night for a team you play for, from the moment
-- the match exists ('lineups') to both sides locked or under way ('playing');
-- a singles match only while it is being played; never a finished one, never
-- someone else's, nothing signed out. tdc_my_live_matches (migration
-- 20261118073452) gives the same list, or one league season's nights only.
begin;
\ir _helpers.psql
select plan(18);

select tests.create_user('Live Dee') as dee \gset
select tests.create_user('Live H1') as h1 \gset
select tests.create_user('Live H2') as h2 \gset
select tests.create_user('Live A1') as a1 \gset
select tests.create_user('Live A2') as a2 \gset
select tests.create_user('Live Out') as outsider \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset
select tests.player_of(:'outsider') as pout \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Live League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select tests.sign_out();

select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select tests.sign_in(:'dee');
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

-- ─── Lineups: no frames yet, both teams' players see it ───

select tests.sign_in(:'h2');
select public.tdc_home_cards() -> 'live' as h2_live \gset
select tests.sign_out();
select is(jsonb_array_length(:'h2_live'::jsonb), 1, 'a player on the home team, in no frame yet: the night');
select is(:'h2_live'::jsonb -> 0 ->> 'id', :'m', 'it is the night''s match');
select is(:'h2_live'::jsonb -> 0 ->> 'state', 'lineups', 'neither side locked: lineups');
select is(:'h2_live'::jsonb -> 0 ->> 'opponent', 'Guests', 'the home side sees the away team');
select is(:'h2_live'::jsonb -> 0 ->> 'competition', 'Live League', 'and the league');

select tests.sign_in(:'a2');
select is(public.tdc_home_cards() -> 'live' -> 0 ->> 'opponent', 'Hosts', 'the away side sees the home team');
-- The league page's call (migration 20261118073452): that league's nights only
select is(public.tdc_my_live_matches(:'season') -> 0 ->> 'id', :'m', 'on this league''s page: the night');
select is(jsonb_array_length(public.tdc_my_live_matches(gen_random_uuid())), 0, 'on another league''s page: nothing');
select is(public.tdc_my_live_matches(), public.tdc_home_cards() -> 'live', 'no league: the home page''s list');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok($$ select public.tdc_my_live_matches() $$, '42501', null, 'signed out: refused');
select tests.sign_out();

select tests.sign_in(:'outsider');
select is(jsonb_array_length(public.tdc_home_cards() -> 'live'), 0, 'someone on neither team: nothing');
select tests.sign_out();

select tests.sign_in(:'dee');
select is(jsonb_array_length(public.tdc_home_cards() -> 'live'), 0, 'the director, playing for neither: nothing');
select tests.sign_out();

-- ─── Both locked: playing ───

insert into public.tbl_league_match_sides (match_id, side, locked_at) values
	(:'m', 'home', now()), (:'m', 'away', now())
	on conflict (match_id, side) do update set locked_at = now();
select tests.sign_in(:'h1');
select is(public.tdc_home_cards() -> 'live' -> 0 ->> 'state', 'playing', 'both sides locked: playing');
select tests.sign_out();

-- ─── Finished: gone ───

update public.tbl_matches set status = 'complete' where id = :'m';
select tests.sign_in(:'h1');
select is(jsonb_array_length(public.tdc_home_cards() -> 'live'), 0, 'a finished night: nothing');
select tests.sign_out();

-- ─── Singles: only while being played ───

select tests.sign_in(:'outsider');
select public.tdc_create_match(:'ph1', tests.rules()) as s \gset
select is(jsonb_array_length(public.tdc_home_cards() -> 'live'), 0, 'a singles match not started: nothing');
select tests.sign_out();
update public.tbl_matches set status = 'in_progress', started_at = now() where id = :'s';

select tests.sign_in(:'outsider');
select public.tdc_home_cards() -> 'live' as out_live \gset
select tests.sign_out();
select ok(:'out_live'::jsonb -> 0 ->> 'id' = :'s' and :'out_live'::jsonb -> 0 ->> 'opponent' = 'Live H1'
		and :'out_live'::jsonb -> 0 ->> 'opponent_kind' = 'player',
	'a singles match being played: the other player');

select tests.sign_in(:'a1');
select is(jsonb_array_length(public.tdc_home_cards() -> 'live'), 0, 'someone else''s singles match: nothing');
select tests.sign_out();

select tests.sign_in_anon();
select is(jsonb_array_length(public.tdc_home_cards() -> 'live'), 0, 'signed out: nothing');
select tests.sign_out();

select * from finish();
rollback;
