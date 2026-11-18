-- Resetting a league night back to the schedule (migration 20261118120357,
-- UV 18 Nov).
--
--   a captain cannot reset; signed out cannot call it
--   the director resets a signed night: frames, lineups, locks, events and
--     notifications gone; status scheduled; card_version bumped
--   the match stays on its fixture, with the season's current rules
--   a record of who, when and the score cleared
--   the night can be set up and played again, and the old signatures do not
--     come back when the same results are entered
--   a fixture with no match is refused
--   a night taken off its fixture leaves the profile menu and the live card
--     (migration 20261118122114)
begin;
\ir _helpers.psql
select plan(21);

select tests.create_user('Reset LD') as dee \gset
select tests.create_user('Reset H1') as h1 \gset
select tests.create_user('Reset H2') as h2 \gset
select tests.create_user('Reset A1') as a1 \gset
select tests.create_user('Reset A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Reset League', tests.rules('{"team_size": 2}')) as league \gset
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

-- The director sets both lineups, records every frame and signs both sides.
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
select public.tdc_submit_card(:'m', 'home');
select public.tdc_submit_card(:'m', 'away');
select tests.sign_out();

select count(*) as frames_before from public.tbl_frames where match_id = :'m' \gset
select card_version as version_before from public.tbl_matches where id = :'m' \gset
select is((select status from public.tbl_matches where id = :'m'), 'complete', 'the night is signed before the reset');

-- ─── Who may reset ───

select tests.sign_in(:'h1');
select throws_ok(format($$ select public.tdc_reset_league_match(%L) $$, :'fx'),
	'P0001', 'Only the people running this league can reset a match.',
	'a captain cannot reset a night');
select tests.sign_out();
select throws_ok(format($$ select public.tdc_reset_league_match(%L) $$, :'fx'),
	'P0001', 'TDC (Error): not signed in.', 'signed out, it cannot be called');

-- ─── The director resets the signed night ───

select tests.sign_in(:'dee');
select lives_ok(format($$ select public.tdc_reset_league_match(%L) $$, :'fx'),
	'the director resets a signed night');
select tests.sign_out();

select is((select count(*)::int from public.tbl_frames where match_id = :'m'), 0, 'every frame is gone');
select is((select count(*)::int from public.tbl_match_events where match_id = :'m'), 0, 'every signature is gone');
select is(
	(select count(*)::int from public.tbl_league_match_order where match_id = :'m')
	+ (select count(*)::int from public.tbl_league_match_squad where match_id = :'m')
	+ (select count(*)::int from public.tbl_league_match_sides where match_id = :'m'),
	0, 'both lineups and their locks are gone');
select is((select count(*)::int from public.tbl_notifications where match_id = :'m'), 0, 'the night''s notifications are gone');
select is((select status from public.tbl_matches where id = :'m'), 'scheduled', 'the match is back to scheduled');
select ok((select started_at is null and ended_at is null from public.tbl_matches where id = :'m'), 'with no start or end time');
select ok((select card_version > :'version_before'::int from public.tbl_matches where id = :'m'), 'and a newer card version');
select is((select match_id from public.tbl_league_fixtures where id = :'fx'), :'m'::uuid, 'the same match stays on its fixture');
select is((select rules from public.tbl_matches where id = :'m'), private.tdc_rules_for_league_season(:'season'),
	'it takes the season''s current rules');

select is(
	(select summary from public.tbl_league_match_resets where match_id = :'m'),
	'Hosts ' || :'frames_before' || ' – Guests 0, ' || :'frames_before' || ' frames, signed',
	'a record keeps the score that was cleared');
select is((select reset_by from public.tbl_league_match_resets where match_id = :'m'), :'dee'::uuid,
	'and who reset it');

-- ─── Played again ───

select tests.sign_in(:'dee');
select public.tdc_set_match_squad(:'m', p) from unnest(array[:'ph1', :'ph2', :'pa1', :'pa2']::uuid[]) p;
select public.tdc_set_lineup_slot(:'m', 1, :'ph1', 'home');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2', 'home');
select public.tdc_lock_lineup(:'m', 'home');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1', 'away');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2', 'away');
select public.tdc_lock_lineup(:'m', 'away');
select is((select count(*)::int from public.tbl_frames where match_id = :'m'), :'frames_before'::int,
	'both lineups lock again and the frames are made again');
select public.tdc_record_frame(:'m', f.frame_no, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb)
from public.tbl_frames f where f.match_id = :'m';
select isnt(private.tdc_card_state(:'m')->>'state', 'agreed',
	'the same results entered again do not bring back the old signatures');

-- ─── Taken off the schedule (migration 20261118122114) ───

select tests.sign_out();
select tests.sign_in(:'h2');
select ok(public.tdc_my_active()->'matches' @> jsonb_build_array(jsonb_build_object('id', :'m')),
	'on its fixture, the night is in a team player''s profile menu');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_reset_league_match(:'fx');
select public.tdc_detach_league_match(:'fx');
select throws_ok(format($$ select public.tdc_reset_league_match(%L) $$, :'fx'),
	'P0001', 'This fixture has not been started, so there is nothing to reset.',
	'a fixture with no match is refused');
select tests.sign_out();

select tests.sign_in(:'h2');
select ok(not (public.tdc_my_active()->'matches' @> jsonb_build_array(jsonb_build_object('id', :'m'))),
	'taken off its fixture, it leaves the profile menu');
select ok(not (public.tdc_my_live_matches() @> jsonb_build_array(jsonb_build_object('id', :'m'))),
	'and the home page''s live card');
select tests.sign_out();

select * from finish();
rollback;
