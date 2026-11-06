-- The feed on /players/ (tdc_my_feed, UV 5 Nov).
--
--   only matches of the players I follow, one row however many of them are in it
--   playing first; a match reads finished as soon as it is scored
--   an abandoned match, and one not started, are left out
--   a league night is one row, team v team, naming the followed player; it
--     appears only once both lineups lock, so the order is never shown
--   the limit holds and says when there is more; stopping following clears it
--   anon may not call it
begin;
\ir _helpers.psql
select plan(25);

select tests.create_user('Feed Dee') as dee \gset
select tests.create_user('Feed Me') as me \gset
select tests.create_user('Feed Shadow') as shadow \gset
select tests.create_user('Feed Linton') as linton \gset
select tests.create_user('Feed Other') as other \gset
select tests.create_user('Feed Other2') as other2 \gset
select tests.player_of(:'me') as pme \gset
select tests.player_of(:'shadow') as psh \gset
select tests.player_of(:'linton') as pli \gset
select tests.player_of(:'other') as pot \gset
select tests.player_of(:'other2') as pot2 \gset

create function pg_temp.row_of(p_id uuid) returns jsonb language sql as $$
	select x from jsonb_array_elements(public.tdc_my_feed(50)->'rows') x where x->>'id' = p_id::text
$$;

select tests.sign_in(:'me');
select is(public.tdc_my_feed(), '{"follows": false, "more": false, "rows": []}'::jsonb, 'following nobody: nothing, and it says so');
select public.tdc_set_follow(:'psh', true);
select public.tdc_set_follow(:'pli', true);
select is(public.tdc_my_feed()->>'follows', 'true', 'following somebody: it says so');

-- ─── A singles match of somebody followed, race to 2 ───

select tests.sign_in(:'shadow');
select public.tdc_create_match(:'pot', tests.rules('{"approval_mode": "none", "win_condition_target": 2}')) as s1 \gset
select public.tdc_record_frame(:'s1', 1, '{"winner_side": "home", "result_event": "win"}');

select tests.sign_in(:'me');
select is(pg_temp.row_of(:'s1')->>'finished', 'false', 'being played: not finished');
select is(pg_temp.row_of(:'s1')->>'home', 'Feed Shadow', 'names the home player');
select is(pg_temp.row_of(:'s1')->>'away', 'Feed Other', 'and the away player');
select is((pg_temp.row_of(:'s1')->>'home_frames')::int, 1, 'with the score');
select is(pg_temp.row_of(:'s1')->'players', '["Feed Shadow"]'::jsonb, 'and whom I follow in it');

select tests.sign_in(:'shadow');
select public.tdc_record_frame(:'s1', 2, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_in(:'me');
select is(pg_temp.row_of(:'s1')->>'finished', 'true', 'the race reached: finished at once');

-- ─── Not mine to see, and left out ───

select tests.sign_in(:'other');
select public.tdc_create_match(:'pot2', tests.rules('{"approval_mode": "none"}')) as x1 \gset
select tests.sign_in(:'me');
select is(pg_temp.row_of(:'x1'), null, 'a match of nobody I follow is not there');

select tests.sign_in(:'shadow');
select public.tdc_create_match(:'pot', tests.rules('{"approval_mode": "none"}')) as s2 \gset
select public.tdc_record_frame(:'s2', 1, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_create_match(:'pot', tests.rules('{"approval_mode": "none"}')) as s3 \gset
select tests.sign_out();
update public.tbl_matches set status = 'abandoned' where id = :'s2';
update public.tbl_matches set status = 'scheduled' where id = :'s3';
select tests.sign_in(:'me');
select is(pg_temp.row_of(:'s2'), null, 'an abandoned match is left out');
select is(pg_temp.row_of(:'s3'), null, 'and one not started');

-- ─── Two followed players, one row; playing comes first ───

select tests.sign_in(:'shadow');
select public.tdc_create_match(:'pli', tests.rules('{"approval_mode": "none", "win_condition_target": 9}')) as s4 \gset
select public.tdc_record_frame(:'s4', 1, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_in(:'me');
select is((select count(*)::int from jsonb_array_elements(public.tdc_my_feed(50)->'rows') x where x->>'id' = :'s4'), 1, 'two I follow in one match: one row');
select is(pg_temp.row_of(:'s4')->'players', '["Feed Linton", "Feed Shadow"]'::jsonb, 'naming both');
select is(public.tdc_my_feed(50)->'rows'->0->>'id', :'s4', 'what is being played comes first');

-- ─── The limit ───

select is(jsonb_array_length(public.tdc_my_feed(1)->'rows'), 1, 'the limit holds');
select is(public.tdc_my_feed(1)->>'more', 'true', 'and says there is more');
select is(public.tdc_my_feed(50)->>'more', 'false', 'and when there is not');

-- ─── A league night ───

select tests.sign_in(:'dee');
select public.tdc_create_league('Feed League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'psh', :'th', true);
select public.tdc_add_league_entrant(:'season', :'pli', :'th');
select public.tdc_add_league_entrant(:'season', :'pot', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pot2', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select public.tdc_set_match_squad(:'m', :'psh');
select public.tdc_set_match_squad(:'m', :'pli');
select public.tdc_set_lineup_slot(:'m', 1, :'psh', 'home');
select public.tdc_set_lineup_slot(:'m', 2, :'pli', 'home');
select public.tdc_lock_lineup(:'m', 'home');

select tests.sign_in(:'me');
select is(pg_temp.row_of(:'m'), null, 'one side locked: the night is not shown, so the order is not');

select tests.sign_in(:'dee');
select public.tdc_set_match_squad(:'m', :'pot');
select public.tdc_set_match_squad(:'m', :'pot2');
select public.tdc_set_lineup_slot(:'m', 1, :'pot', 'away');
select public.tdc_set_lineup_slot(:'m', 2, :'pot2', 'away');
select public.tdc_lock_lineup(:'m', 'away');

select tests.sign_in(:'me');
select is(pg_temp.row_of(:'m')->>'team_match', 'true', 'both locked: the night is shown');
select is(pg_temp.row_of(:'m')->>'home', 'Hosts', 'team v team');
select is(pg_temp.row_of(:'m')->>'finished', 'false', 'not finished before its frames are');
select is(pg_temp.row_of(:'m')->>'competition', 'Feed League', 'in its league');

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', f.frame_no, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb)
from public.tbl_frames f where f.match_id = :'m';

select tests.sign_in(:'me');
select is(pg_temp.row_of(:'m')->>'finished', 'true', 'every frame scored, unsigned: finished at once');

-- ─── Stopping, and nobody's business ───

select public.tdc_set_follow(:'psh', false);
select public.tdc_set_follow(:'pli', false);
select is(public.tdc_my_feed(), '{"follows": false, "more": false, "rows": []}'::jsonb, 'stopping following clears it');

select tests.sign_out();
select ok(not has_function_privilege('anon', 'public.tdc_my_feed(integer)', 'execute'), 'anon may not call it');

select * from finish();
rollback;
