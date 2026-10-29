-- A team card's signatures say what they were signed as (migration
-- 20261029080921, UV 29 Oct).
--
--   the league director signs both sides, each recorded as director
--   a captain's signature is recorded as captain
--   a director who also captains a team signs their own side as director
--   tdc_card_signatures lists them, newest first; signed out, it cannot be called
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('Role LD') as dee \gset
select tests.create_user('Role H1') as h1 \gset
select tests.create_user('Role H2') as h2 \gset
select tests.create_user('Role A1') as a1 \gset
select tests.create_user('Role A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Role League', tests.rules('{"team_size": 2}')) as league \gset
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

-- The director sets both lineups and records the night alone.
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

-- ─── The director signs both sides ───

select lives_ok(format($$ select public.tdc_submit_card(%L, 'home') $$, :'m'), 'the director signs for home');
select lives_ok(format($$ select public.tdc_submit_card(%L, 'away') $$, :'m'), 'and for away');
select is(private.tdc_card_state(:'m')->>'state', 'agreed', 'which agrees the card');
select is(
	(select array_agg(side || ':' || signed_as order by side) from public.tdc_card_signatures(:'m')),
	array['away:director', 'home:director'], 'both recorded as the director''s');
select tests.sign_out();

-- ─── A captain signs as captain ───

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 1, '{"status": "complete", "winner_side": "away", "result_event": "win"}'::jsonb);
select tests.sign_out();
select tests.sign_in(:'h1');
select public.tdc_submit_card(:'m');
select is((select signed_as from public.tdc_card_signatures(:'m') limit 1), 'captain',
	'a captain''s signature is recorded as captain, and listed first as the newest');
select tests.sign_out();

-- ─── A director who captains their own team signs it as director ───

select tests.sign_in(:'dee');
select public.tdc_add_league_role(:'season', :'ph1', 'director');
select public.tdc_record_frame(:'m', 1, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb);
select tests.sign_out();
select tests.sign_in(:'h1');
select public.tdc_submit_card(:'m', 'home');
select is((select signed_as from public.tdc_card_signatures(:'m') limit 1), 'director',
	'a captain who also runs the league signs their own side as the director');
select is((select by_name from public.tdc_card_signatures(:'m') limit 1), 'Role H1', 'with their name');
select tests.sign_out();

-- ─── Signed in only ───

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_card_signatures(%L) $$, :'m'), '42501', null, 'nobody signed out can read the signatures');
select tests.sign_out();

select * from finish();
rollback;
