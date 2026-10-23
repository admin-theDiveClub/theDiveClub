-- League settings: ruleset version 3, the rotation table, and a rule change
-- reaching the matches nobody has started (migration 20261023193153).
--
-- Settled with UV on 23 Oct (docs/DECISIONS.md): the team size decides how
-- long the card is; the rotation table is the LD's with a cyclic shift as the
-- default; each session uses every away player once, but a pairing repeated
-- across the night is allowed; a rule change reaches every match with no
-- frames, no locked side and no card events, and the rest keep their rules.
begin;
\ir _helpers.psql
select plan(29);

-- ─── The ruleset check ───
-- Called directly: it is the one place a ruleset is validated, and every
-- create and update goes through it.

select lives_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, tests.rules('{"team_size": 5}')),
	'a version 3 ruleset with a team size and the cyclic shift is accepted');

select lives_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, tests.rules()),
	'team size 0 means no sessions, and is accepted');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, tests.rules('{"team_size": 1}')),
	'P0001', 'TDC (Error): team_size must be 0 (no sessions) or a whole number from 2 to 10.',
	'a team of one is a singles match, and is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, tests.rules('{"team_size": 2.5}')),
	'P0001', 'TDC (Error): team_size must be 0 (no sessions) or a whole number from 2 to 10.',
	'a fractional team size is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, tests.rules('{"team_size": "5"}')),
	'P0001', 'TDC (Error): team_size must be 0 (no sessions) or a whole number from 2 to 10.',
	'a team size typed as text is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, tests.rules('{"team_size": 11}')),
	'P0001', 'TDC (Error): team_size must be 0 (no sessions) or a whole number from 2 to 10.',
	'a team size over 10 is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$, tests.rules('{"rotation": [[1]]}')),
	'P0001', 'TDC (Error): a rotation table needs a team size.',
	'a rotation table without a team size is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[1,2,3],[2,3,1]]}')),
	'P0001', 'TDC (Error): the rotation table must have one row for each of the 3 sessions.',
	'a rotation table with a session missing is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[1,2,3],[2,3],[3,1,2]]}')),
	'P0001', 'TDC (Error): session 2 of the rotation table must name 3 away positions.',
	'a short session is refused');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[1,2,3],[2,2,1],[3,1,2]]}')),
	'P0001', 'TDC (Error): in session 2 of the rotation table, every away player must play exactly once.',
	'an away player twice in one session is refused (design rule 1)');

select throws_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[2,1,3],[1,3,2],[3,2,1]]}')),
	'P0001', 'TDC (Error): session 1 of the rotation table is the captains'' own order — H1 v A1, H2 v A2 and so on.',
	'session 1 must be the captains'' own order');

select lives_ok(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3, "rotation": [[1,2,3],[1,3,2],[2,1,3]]}')),
	'a table that repeats a pairing across sessions is allowed (the page warns, the database does not refuse)');

select throws_like(
	format($$ select private.tdc_check_match_rules(%L::jsonb) $$,
		tests.rules('{"team_size": 3}') - 'version' - 'team_size' - 'rotation' || '{"version": 2, "team_size": 3}'),
	'TDC (Error): the ruleset has unknown setting(s) %',
	'a version 2 ruleset cannot carry the version 3 keys');

-- ─── Who meets whom ───

select is(
	array[
		private.tdc_rotation_away(tests.rules('{"team_size": 5}'), 1, 3),
		private.tdc_rotation_away(tests.rules('{"team_size": 5}'), 2, 1),
		private.tdc_rotation_away(tests.rules('{"team_size": 5}'), 2, 5),
		private.tdc_rotation_away(tests.rules('{"team_size": 5}'), 5, 2)
	],
	array[3, 2, 1, 1],
	'the cyclic shift: session 1 is H3 v A3; session 2 is H1 v A2 and H5 v A1; session 5 is H2 v A1');

select is(
	private.tdc_rotation_away(tests.rules('{"team_size": 3, "rotation": [[1,2,3],[1,3,2],[2,1,3]]}'), 3, 1),
	2,
	'an LD''s own table is read as written');

select is(
	array[
		private.tdc_rotation_away(tests.rules('{"team_size": 5}'), 6, 1),
		private.tdc_rotation_away(tests.rules('{"team_size": 5}'), 1, 0),
		private.tdc_rotation_away(tests.rules(), 1, 1)
	],
	array[null, null, null]::integer[],
	'off the card, or no team size, is null');

-- ─── A league with matches in three states ───

select tests.create_user('Settings Dee') as dee \gset
select tests.create_user('Settings Stranger') as stranger \gset
select tests.create_user('Settings P1') as u1 \gset
select tests.create_user('Settings P2') as u2 \gset
select tests.create_user('Settings P3') as u3 \gset
select tests.create_user('Settings P4') as u4 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Settings League',
	tests.rules('{"win_condition_type": "race_to", "win_condition_target": 13}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Alpha') as t1 \gset
select public.tdc_create_team(:'season', 'Bravo') as t2 \gset
select public.tdc_create_team(:'season', 'Charlie') as t3 \gset
select public.tdc_create_team(:'season', 'Delta') as t4 \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u1'), :'t1', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u2'), :'t2', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u3'), :'t3', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'u4'), :'t4', true);
select public.tdc_generate_league_fixtures(:'season');
select tests.sign_out();

select id as f_open from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null order by round, position limit 1 offset 0 \gset
select id as f_locked from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null order by round, position limit 1 offset 1 \gset
select id as f_played from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null order by round, position limit 1 offset 2 \gset
select id as f_signed from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null order by round, position limit 1 offset 3 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league_match(:'f_open') as m_open \gset
select public.tdc_create_league_match(:'f_locked') as m_locked \gset
select public.tdc_create_league_match(:'f_played') as m_played \gset
select public.tdc_create_league_match(:'f_signed') as m_signed \gset
select tests.sign_out();

-- The three ways a match stops being untouched, set up directly: a locked
-- side, a frame, a card event.
insert into public.tbl_league_match_sides (match_id, side, locked_at) values (:'m_locked', 'home', now());
insert into public.tbl_frames (match_id, frame_no, status) values (:'m_played', 1, 'pending');
insert into public.tbl_match_events (match_id, player_id, kind, card_version, side)
	values (:'m_signed', tests.player_of(:'u1'), 'submitted', 0, 'home');

select is(private.tdc_lineup_slots(:'m_open'), 25, 'race to 13 with no team size is still a 25-frame card');

-- ─── Changing the rules ───

select tests.sign_in(:'stranger');
select throws_ok(
	format($$ select public.tdc_update_league(%L, null, %L::jsonb) $$, :'league', tests.rules('{"team_size": 4}')),
	'P0001', 'Only the people running this league can change it.',
	'somebody outside the league cannot change its rules');

select tests.sign_in_anon();
select throws_ok(
	format($$ select public.tdc_update_league(%L, null, %L::jsonb) $$, :'league', tests.rules('{"team_size": 4}')),
	'42501', null,
	'nobody signed out can call it at all');

select tests.sign_in(:'dee');
select is(
	public.tdc_update_league(:'league', null,
		tests.rules('{"win_condition_type": "fixed_frames", "win_condition_target": 10, "team_size": 4}')),
	'{"matches_kept": 3, "matches_updated": 1}'::jsonb,
	'the director''s change reaches the one untouched match and reports the three that kept their rules');
select tests.sign_out();

select is((select rules from public.tbl_matches where id = :'m_open'),
	tests.rules('{"win_condition_type": "fixed_frames", "win_condition_target": 10, "team_size": 4}'),
	'the untouched match takes the new rules');

select is(
	(select array_agg(rules->>'win_condition_type' order by id) from public.tbl_matches where id in (:'m_locked', :'m_played', :'m_signed')),
	array['race_to', 'race_to', 'race_to'],
	'a locked side, a frame and a card event each keep the match on the rules it was frozen with');

select is(private.tdc_lineup_slots(:'m_open'), 16,
	'with a team size the card is team_size squared, whatever the win condition says');

select is(private.tdc_lineup_slots(:'m_locked'), 25, 'a match that kept its rules keeps its card');

select tests.sign_in(:'dee');
select is(public.tdc_update_league(:'league', 'Settings League II'),
	'{"matches_kept": 0, "matches_updated": 0}'::jsonb,
	'renaming the league touches no match');

select is(
	public.tdc_update_league(:'league', null,
		tests.rules('{"win_condition_type": "fixed_frames", "win_condition_target": 10, "team_size": 4}')),
	'{"matches_kept": 3, "matches_updated": 0}'::jsonb,
	'saving the same rules again changes nothing and still reports the matches on other rules');

select throws_like(
	format($$ select public.tdc_update_league(%L, null, %L::jsonb) $$, :'league',
		tests.rules('{"team_size": 3, "rotation": [[1,2,3],[2,2,1],[3,1,2]]}')),
	'TDC (Error): in session 2 of the rotation table%',
	'an invalid rotation table is refused before anything is written');
select tests.sign_out();

select is((select rules->>'team_size' from public.tbl_leagues where id = :'league'), '4',
	'the refused change left the league''s rules alone');

select is((select name from public.tbl_leagues where id = :'league'), 'Settings League II',
	'the rename stuck');

select * from finish();
rollback;
