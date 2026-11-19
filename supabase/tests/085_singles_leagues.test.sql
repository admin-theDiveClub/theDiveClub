-- Singles leagues (migration 20261119122128_singles_leagues, UV 19 Nov).
--
--   a league may have team size 1; a singles ruleset has no rotation table
--   every active player gets a team of one, named after them, as its captain;
--     a shared display name gets "(2)"
--   no teams by hand; a second player on a team of one is refused; limit 1
--   a singles season's default columns rank by matches won, then frames won
--   starting a fixture makes a player-against-player match, teams on the fixture
--   the card settles as a singles card under coordinator approval: awaiting
--     after submission, agreed when the opponent agrees; it counts in Standings
--     for the player and their team once submitted
--   resetting a singles night works
--   switching a team league to singles: the unplaced get a team of one, a team
--     of two stays, and starting its fixture is refused with a plain message
begin;
\ir _helpers.psql
select plan(26);

select tests.create_user('Singles LD') as dee \gset
select tests.create_user('Singles Ann') as ann \gset
select tests.create_user('Singles Ben') as ben \gset
select tests.create_user('Singles Cas') as cas \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'ben') as pben \gset
select tests.player_of(:'cas') as pcas \gset
-- Ben and Cas share a display name, so their teams cannot both be "Ben".
update public.tbl_players set display_name = 'Ben' where id in (:'pben', :'pcas');
update public.tbl_players set display_name = 'Ann' where id = :'pann';

-- ─── The rules ───

select tests.sign_in(:'dee');
select lives_ok($$ select public.tdc_create_league('Singles Club',
	tests.rules('{"team_size": 1, "approval_mode": "coordinator_approval"}')) $$,
	'a league may have team size 1');
select id as league from public.tbl_leagues where name = 'Singles Club' \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
-- The private helpers are not callable signed in, so they are checked as the
-- database itself.
select tests.sign_out();
select throws_ok($$ select private.tdc_check_league_rules(tests.rules('{"team_size": 1, "rotation": [[1]]}')) $$,
	'P0001', 'TDC (Error): a singles league has no rotation table.',
	'a singles ruleset has no rotation table');
select throws_ok($$ select private.tdc_check_league_rules(tests.rules('{"team_size": 0}')) $$,
	'P0001', 'A league needs a team size: 1 for singles, or 2 to 10 players a side in each session.',
	'a league still needs a team size');
select ok(private.tdc_singles_season(:'season'), 'its season is singles');

-- ─── The team of one ───

select tests.sign_in(:'dee');
select public.tdc_add_league_entrant(:'season', :'pann');
select public.tdc_add_league_entrant(:'season', :'pben');
select public.tdc_add_league_entrant(:'season', :'pcas');
select public.tdc_generate_league_fixtures(:'season');
-- The entrants table is read only through functions, so the checks below
-- read it as the database.
select tests.sign_out();
select team_id as tann from public.tbl_league_season_entrants where player_id = :'pann' and league_season_id = :'season' \gset
select team_id as tben from public.tbl_league_season_entrants where player_id = :'pben' and league_season_id = :'season' \gset
select team_id as tcas from public.tbl_league_season_entrants where player_id = :'pcas' and league_season_id = :'season' \gset

select is((select count(*)::int from public.tbl_league_season_entrants where league_season_id = :'season' and team_id is not null and is_captain),
	3, 'every player added has a team, as its captain');
select is((select name from public.tbl_teams where id = :'tann'), 'Ann', 'the team is named after its player');
select is((select array_agg(name order by name) from public.tbl_teams where id in (:'tben', :'tcas')), array['Ben', 'Ben (2)'],
	'a shared display name gets "(2)"');
select is(private.tdc_team_limit(:'tann'), 1, 'a team of one has room for one');

select tests.sign_in(:'dee');
select throws_ok(format($$ select public.tdc_create_team(%L, 'Extra') $$, :'season'),
	'P0001', 'In a singles league every player is their own team, made when they join. There are no teams to add by hand.',
	'no teams by hand in singles');
select tests.sign_out();
select throws_ok(format($$ update public.tbl_league_season_entrants set team_id = %L where player_id = %L and league_season_id = %L $$,
		:'tann', :'pben', :'season'),
	'P0001', 'In a singles league a team is one player, and Ann already has theirs.',
	'a second player on a team of one is refused, by any path');

select is(
	(select array_agg(name || ':' || coalesce(rank_priority::text, '-') order by position)
	from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player'),
	array['Matches Played:-', 'Matches Won:1', 'Frames Played:-', 'Frames Won:2', 'Win %:-'],
	'the singles columns rank by matches won, then frames won');

-- ─── A singles night ───

select id as fx from public.tbl_league_fixtures
where league_season_id = :'season' and :'tann'::uuid in (home_team_id, away_team_id) and away_team_id is not null
order by round, position limit 1 \gset
select (home_team_id = :'tann'::uuid) as ann_home,
	case when home_team_id = :'tann'::uuid then away_team_id else home_team_id end as topp
from public.tbl_league_fixtures where id = :'fx' \gset
select player_id as popp from public.tbl_league_season_entrants where team_id = :'topp' \gset
select tests.sign_out();

select tests.sign_in(:'ann');
select throws_ok(format($$ select public.tdc_create_league_match(%L) $$, :'fx'),
	'P0001', 'Only the people running this league can start its matches.',
	'a player cannot start the night (the director starts it, UV)');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();
select is((select home_side_kind || '/' || away_side_kind from public.tbl_matches where id = :'m'), 'player/player',
	'the night is a singles match');
select ok((select (case when :'ann_home'::boolean then home_player_id else away_player_id end) = :'pann'::uuid
		and (case when :'ann_home'::boolean then away_player_id else home_player_id end) = :'popp'::uuid
		and home_team_id is null and away_team_id is null
	from public.tbl_matches where id = :'m'),
	'between the two teams'' players, on their fixture''s sides');
select is((select rules from public.tbl_matches where id = :'m'), private.tdc_rules_for_league_season(:'season'),
	'with the season''s rules frozen onto it');

-- Ann wins it 2–0 and submits; the opponent agrees.
select case when :'ann_home'::boolean then 'home' else 'away' end as ann_side \gset
select tests.sign_in(:'ann');
select public.tdc_record_frame(:'m', 1, jsonb_build_object('status', 'complete', 'winner_side', :'ann_side', 'result_event', 'win'));
select public.tdc_record_frame(:'m', 2, jsonb_build_object('status', 'complete', 'winner_side', :'ann_side', 'result_event', 'win'));
select public.tdc_submit_card(:'m', null);
select tests.sign_out();

select is((select status from public.tbl_matches where id = :'m'), 'complete', 'submitted, the match is complete');
select is(private.tdc_card_state(:'m')->>'state', 'awaiting',
	'and waits for the opponent, though the league asks for coordinator approval');

select tests.sign_in(:'dee');
select is(
	(select (p->'stats'->>'matches_won')::int from jsonb_array_elements(public.tdc_league_standings(:'season')->'players') p
	where (p->>'player_id')::uuid = :'pann'),
	1, 'it counts in Standings for the player');
select is(
	(select (t->'stats'->>'matches_won')::int from jsonb_array_elements(public.tdc_league_standings(:'season')->'teams') t
	where (t->>'team_id')::uuid = :'tann'),
	1, 'and for their team of one');
select tests.sign_out();

select tests.sign_in((select user_id from public.tbl_players where id = :'popp'));
select public.tdc_answer_card(:'m', true, null);
select tests.sign_out();
select is(private.tdc_card_state(:'m')->>'state', 'agreed', 'the opponent agrees and it is settled');

-- ─── Reset ───

select tests.sign_in(:'dee');
select lives_ok(format($$ select public.tdc_reset_league_match(%L) $$, :'fx'), 'the director resets a singles night');
select tests.sign_out();
select is((select status || ':' || (select count(*) from public.tbl_frames where match_id = :'m')
	from public.tbl_matches where id = :'m'), 'scheduled:0', 'back to scheduled with no frames');

-- ─── Switching a team league to singles ───

select tests.create_user('Switch P1') as s1 \gset
select tests.create_user('Switch P2') as s2 \gset
select tests.create_user('Switch P3') as s3 \gset
select tests.player_of(:'s1') as ps1 \gset
select tests.player_of(:'s2') as ps2 \gset
select tests.player_of(:'s3') as ps3 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Switch League', tests.rules('{"team_size": 2}')) as league2 \gset
select public.tdc_create_league_season(:'league2', 'Spring') as season2 \gset
select public.tdc_create_team(:'season2', 'Pair') as tpair \gset
select public.tdc_add_league_entrant(:'season2', :'ps1', :'tpair', true);
select public.tdc_add_league_entrant(:'season2', :'ps2', :'tpair');
select public.tdc_add_league_entrant(:'season2', :'ps3');
select tests.sign_out();
select is((select team_id from public.tbl_league_season_entrants where player_id = :'ps3' and league_season_id = :'season2'), null,
	'in a team league an added player waits for a team');

select tests.sign_in(:'dee');
select public.tdc_update_league(:'league2', p_rules => tests.rules('{"team_size": 1}'));
select tests.sign_out();
select isnt((select team_id from public.tbl_league_season_entrants where player_id = :'ps3' and league_season_id = :'season2'), null,
	'switched to singles, the unplaced player gets a team of one');
select is((select count(*)::int from public.tbl_league_season_entrants where team_id = :'tpair'), 2,
	'a team of two stays as it was, for the director to sort out');

select tests.sign_in(:'dee');
select public.tdc_generate_league_fixtures(:'season2');
select id as fx2 from public.tbl_league_fixtures where league_season_id = :'season2' and away_team_id is not null limit 1 \gset
select throws_ok(format($$ select public.tdc_create_league_match(%L) $$, :'fx2'),
	'P0001', 'Pair has 2 active players. In a singles league a team is one player: sort it out on Run it first.',
	'its night cannot start until the team is one player');
select tests.sign_out();

select * from finish();
rollback;
