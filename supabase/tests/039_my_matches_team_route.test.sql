-- My matches knows a team match (migration 20261029140544, UV 29 Oct).
--
--   a team match is marked team_match and names the other team
--   card_role: null for a player, captain for a captain, director for
--   whoever runs the league
--   needs_me on a team card: a captain whose side's signature is wanted,
--   never a player, never the side that has signed
begin;
\ir _helpers.psql
select plan(10);

select tests.create_user('Route LD') as dee \gset
select tests.create_user('Route H1') as h1 \gset
select tests.create_user('Route H2') as h2 \gset
select tests.create_user('Route A1') as a1 \gset
select tests.create_user('Route A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Route League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset

select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1', 'home');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2', 'home');
select public.tdc_lock_lineup(:'m', 'home');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1', 'away');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2', 'away');
select public.tdc_lock_lineup(:'m', 'away');
select public.tdc_record_frame(:'m', f.frame_no, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb)
from public.tbl_frames f where f.match_id = :'m';
select tests.sign_out();

-- ─── A player ───

select tests.sign_in(:'h2');
select is((select team_match from public.tdc_my_matches() where id = :'m'), true, 'a team match is marked as one');
select is((select opponent from public.tdc_my_matches() where id = :'m'), 'Guests', 'and names the other team, not "Team"');
select is((select card_role from public.tdc_my_matches() where id = :'m'), null, 'a player has no role on the card');
select tests.sign_out();

-- ─── A captain ───

select tests.sign_in(:'h1');
select is((select card_role from public.tdc_my_matches() where id = :'m'), 'captain', 'a captain is one');
select is((select needs_me from public.tdc_my_matches() where id = :'m'), false, 'nothing is wanted of anybody before a signature');
select tests.sign_out();

-- The away captain signs: now the home captain's signature is wanted.
select tests.sign_in(:'a1');
select public.tdc_submit_card(:'m');
select is((select needs_me from public.tdc_my_matches() where id = :'m'), false, 'not of the side that signed');
select tests.sign_out();

select tests.sign_in(:'h1');
select is((select needs_me from public.tdc_my_matches() where id = :'m'), true, 'but of the captain whose side has not');
select tests.sign_out();

select tests.sign_in(:'h2');
select is((select needs_me from public.tdc_my_matches() where id = :'m'), false, 'never of a player, who does not sign');
select tests.sign_out();

-- ─── Whoever runs the league ───

select tests.sign_in(:'dee');
select public.tdc_add_league_role(:'season', :'ph2', 'director');
select tests.sign_out();
select tests.sign_in(:'h2');
select is((select card_role from public.tdc_my_matches() where id = :'m'), 'director', 'a player who runs the league is its director');
select is((select needs_me from public.tdc_my_matches() where id = :'m'), true, 'and a signature is wanted of them while one is');
select tests.sign_out();

select * from finish();
rollback;
