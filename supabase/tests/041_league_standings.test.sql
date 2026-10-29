-- League standings (migration 20261029162031, UV 29 Oct).
--
--   a season starts with the default columns, 3 for players and 6 for teams
--   only whoever runs the league changes them; nobody writes the table
--   the guards: a name once per table whatever its case, an equation once,
--     an equation the buttons could have made (values and operators
--     alternating, brackets closed, values this table has)
--   move, rank (a priority taken from another column swaps), remove (the
--     rest close up), back to the defaults
--   the counts: nothing until the night is signed by both, then the frames,
--     the match, and a lag
begin;
\ir _helpers.psql
select plan(29);

select tests.create_user('Std LD') as dee \gset
select tests.create_user('Std H1') as h1 \gset
select tests.create_user('Std H2') as h2 \gset
select tests.create_user('Std A1') as a1 \gset
select tests.create_user('Std A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Std League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select tests.sign_out();

-- ─── The defaults ───

select is((select count(*)::int from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player'),
	3, 'a new season has the three player columns');
select is((select string_agg(name, ' | ' order by position) from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'team'),
	'Matches Played | Matches Won | M Win % | Frames Played | Frames Won | Frames Won %', 'and the six team columns, in order');

-- ─── Who may ───

select tests.sign_in(:'h1');
select throws_ok(format($$ select public.tdc_add_standing_column(%L, 'player', 'Lost', '[{"t":"var","v":"frames_lost"}]') $$, :'season'),
	'P0001', 'Only whoever runs the league can change its standings.', 'a captain may not add a column');
select throws_ok(format($$ insert into public.tbl_league_standing_columns (league_season_id, scope, position, name, equation)
	values (%L, 'player', 9, 'Sneaky', '[{"t":"var","v":"frames_lost"}]') $$, :'season'),
	'42501', null, 'nor write the table directly');
select is((select count(*)::int from public.tbl_league_standing_columns where league_season_id = :'season'),
	9, 'but anybody signed in can read the columns');

-- ─── The guards ───

select tests.sign_in(:'dee');
select isnt(public.tdc_add_standing_column(:'season', 'player', 'Frame Diff',
	'[{"t":"var","v":"frames_won"},{"t":"op","v":"-"},{"t":"var","v":"frames_lost"}]'), null,
	'the LD adds a column');
select is((select position from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player' and name = 'Frame Diff'),
	4, 'at the end of the table');
select throws_ok(format($$ select public.tdc_add_standing_column(%L, 'player', ' frame diff ', '[{"t":"var","v":"lags_won"}]') $$, :'season'),
	'P0001', 'There is already a column called "Frame Diff" in this table.', 'a name already used, in any case, is refused');
select throws_ok(format($$ select public.tdc_add_standing_column(%L, 'player', 'FW', '[{"t":"var","v":"frames_won"}]') $$, :'season'),
	'P0001', 'The column "Frames Won" already has that equation.', 'an equation already used is refused');
select lives_ok(format($$ select public.tdc_add_standing_column(%L, 'team', 'Frame Diff', '[{"t":"var","v":"frames_won"},{"t":"op","v":"-"},{"t":"var","v":"frames_lost"}]') $$, :'season'),
	'the same name and equation in the other table is fine');
select throws_ok(format($$ select public.tdc_add_standing_column(%L, 'player', 'Half', '[{"t":"var","v":"frames_won"},{"t":"op","v":"/"}]') $$, :'season'),
	'P0001', 'The equation ends on an operator. Finish it with a value.', 'an equation ending on an operator is refused');
select throws_ok(format($$ select public.tdc_add_standing_column(%L, 'player', 'Two', '[{"t":"var","v":"frames_won"},{"t":"var","v":"frames_lost"}]') $$, :'season'),
	'P0001', 'Two values need an operator between them.', 'two values side by side are refused');
select throws_ok(format($$ select public.tdc_add_standing_column(%L, 'player', 'Open', '[{"t":"paren","v":"("},{"t":"var","v":"frames_won"}]') $$, :'season'),
	'P0001', 'A bracket is still open. Close it before confirming.', 'an open bracket is refused');
select throws_like(format($$ select public.tdc_add_standing_column(%L, 'player', 'Used', '[{"t":"var","v":"players_used"}]') $$, :'season'),
	'%a value this table does not have: players_used.', 'a team value in the player table is refused');
select throws_like(format($$ select public.tdc_add_standing_column(%L, 'player', 'SQL', '[{"t":"var","v":"frames_won; drop table x"}]') $$, :'season'),
	'%a value this table does not have%', 'anything not on a button is refused');
select lives_ok(format($$ select public.tdc_add_standing_column(%L, 'team', 'Points', '[{"t":"num","v":3},{"t":"op","v":"*"},{"t":"paren","v":"("},{"t":"var","v":"matches_won"},{"t":"op","v":"+"},{"t":"var","v":"matches_drawn"},{"t":"paren","v":")"}]') $$, :'season'),
	'numbers and brackets are accepted');
select tests.sign_out();
select throws_ok(format($$ insert into public.tbl_league_standing_columns (league_season_id, scope, position, name, equation)
	values (%L, 'player', 9, 'Bad', '[{"t":"op","v":"+"}]') $$, :'season'),
	'23514', null, 'the table itself refuses an equation the buttons could not make');

-- ─── Move, rank, remove, reset ───

select tests.sign_in(:'dee');
select id as diff from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player' and name = 'Frame Diff' \gset
select public.tdc_move_standing_column(:'diff', 1);
select is((select string_agg(name, ' | ' order by position) from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player'),
	'Frame Diff | Frames Played | Frames Won | Win %', 'moving a column to the front shifts the others along');
select public.tdc_set_standing_column_rank(:'diff', 1);
select is((select string_agg(name || '=' || coalesce(rank_priority::text, '-'), ' ' order by position) from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player'),
	'Frame Diff=1 Frames Played=- Frames Won=- Win %=2', 'taking priority 1 from Frames Won leaves it with Frame Diff''s none');
select throws_ok(format($$ select public.tdc_set_standing_column_rank(%L, 9) $$, :'diff'),
	'P0001', 'A ranking priority is 0 (not used) to 4, the number of columns.', 'a priority past the number of columns is refused');
select public.tdc_remove_standing_column(id) from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player' and name = 'Frames Played';
select is((select string_agg(position || ' ' || name, ', ' order by position) from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player'),
	'1 Frame Diff, 2 Frames Won, 3 Win %', 'removing a column closes the gap');
select public.tdc_reset_standing_columns(:'season', 'player');
select is((select string_agg(name, ' | ' order by position) from public.tbl_league_standing_columns where league_season_id = :'season' and scope = 'player'),
	'Frames Played | Frames Won | Win %', 'and the defaults come back');
-- The place and priority checks wait for the end of a transaction, which a
-- test never reaches (it rolls back); this makes them run now.
select lives_ok('set constraints all immediate', 'after all that, no two columns share a place or a priority');

-- ─── The counts ───

-- A night: home wins frames 1 to 3, away frame 4; frame 1's lag to home,
-- every other lag to away (given, so the break rule derives none).
-- With two a side, frame 1 is H1 v A1, 2 H2 v A2, 3 H1 v A2, 4 H2 v A1.
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

select tests.sign_in(:'h1');
select public.tdc_record_frame(:'m', f.frame_no, jsonb_build_object('status', 'complete',
	'winner_side', case when f.frame_no <= 3 then 'home' else 'away' end, 'result_event', 'win',
	'break_side', case when f.frame_no = 1 then 'home' else 'away' end))
from public.tbl_frames f where f.match_id = :'m';
select public.tdc_submit_card(:'m');

select is((public.tdc_league_standings(:'season') ->> 'matches_counted')::int, 0, 'a night signed by one side counts for nothing yet');

select tests.sign_in(:'a1');
select public.tdc_submit_card(:'m');

select public.tdc_league_standings(:'season') as st \gset
select is((:'st'::jsonb ->> 'matches_counted')::int, 1, 'signed by both, it counts');
select is((select t -> 'stats' from jsonb_array_elements(:'st'::jsonb -> 'teams') t where t ->> 'team_id' = :'th')
	@> '{"matches_played": 1, "matches_won": 1, "frames_played": 4, "frames_won": 3, "frames_lost": 1, "lags_won": 1, "players_used": 2}'::jsonb,
	true, 'the home team: one match won, 3 frames of 4, the lag, two players');
select is((select string_agg((p ->> 'display_name') || ' ' || (p -> 'stats' ->> 'frames_played') || '/' || (p -> 'stats' ->> 'frames_won') || ' m' || (p -> 'stats' ->> 'matches_won'), ', ' order by p ->> 'display_name')
		from jsonb_array_elements(:'st'::jsonb -> 'players') p),
	'Std A1 2/1 m0, Std A2 2/0 m0, Std H1 2/2 m1, Std H2 2/1 m1', 'each player''s frames played and won, and their team''s match');
select is((select (p -> 'stats') @> '{"lags_won": 1, "won_with_lag": 1, "seasons_played": 1, "leagues_played": 1}'::jsonb
		from jsonb_array_elements(:'st'::jsonb -> 'players') p where p ->> 'player_id' = :'ph1'),
	true, 'H1 won the lag and the frame with it');

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_league_standings(%L) $$, :'season'),
	'42501', null, 'somebody not signed in cannot read the standings');

select * from finish();
rollback;
