-- The people lists in the profile menu (tdc_my_people, UV 5 Nov).
--
--   opponents only: a teammate on a league night is never listed
--   only finished frames count: not one in progress, abandoned or a walkover
--   most often is frames against them, most first
--   recent is the latest frame against them, newest first
--   the limit holds; the mark says whom I follow
--   a stranger has two empty lists; anon may not call it
begin;
\ir _helpers.psql
select plan(19);

select tests.create_user('People Dee') as dee \gset
select tests.create_user('People Ann') as ann \gset
select tests.create_user('People Bob') as bob \gset
select tests.create_user('People Cas') as cas \gset
select tests.create_user('People Mate') as mate \gset
select tests.create_user('People Opp') as opp \gset
select tests.create_user('People Opp2') as opp2 \gset
select tests.create_user('People Stranger') as stranger \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset
select tests.player_of(:'cas') as pcas \gset
select tests.player_of(:'mate') as pmate \gset
select tests.player_of(:'opp') as popp \gset
select tests.player_of(:'opp2') as popp2 \gset

create function pg_temp.row_of(p_list text, p_id uuid) returns jsonb language sql as $$
	select x from jsonb_array_elements(public.tdc_my_people(20)->p_list) x where x->>'player_id' = p_id::text
$$;
create function pg_temp.names(p_list text) returns text language sql as $$
	select string_agg(x->>'display_name', ',' order by o)
	from jsonb_array_elements(public.tdc_my_people()->p_list) with ordinality as t(x, o)
$$;

-- ─── Singles: two frames against Bob, one against Cas ───

select tests.sign_in(:'ann');
select public.tdc_create_match(:'pbob', tests.rules('{"approval_mode": "none", "win_condition_target": 9}')) as m1 \gset
select public.tdc_record_frame(:'m1', 1, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_record_frame(:'m1', 2, '{"winner_side": "away", "result_event": "win"}');
select is(pg_temp.row_of('often', :'pbob')->>'frames', '2', 'frames against them are counted');
select is(pg_temp.row_of('often', :'pbob')->>'i_follow', 'false', 'not followed yet');

select public.tdc_create_match(:'pcas', tests.rules('{"approval_mode": "none", "win_condition_target": 9}')) as m2 \gset
select public.tdc_record_frame(:'m2', 1, '{"winner_side": "home", "result_event": "win"}');

select tests.sign_out();
update public.tbl_frames set started_at = null, ended_at = now() - interval '2 days' where match_id = :'m1';
update public.tbl_frames set started_at = null, ended_at = now() - interval '1 day' where match_id = :'m2';
select tests.sign_in(:'ann');

select is(pg_temp.names('often'), 'People Bob,People Cas', 'most often: the most frames first');
select is(pg_temp.names('recent'), 'People Cas,People Bob', 'recent: the latest frame first');

-- ─── What does not count ───

select public.tdc_create_match(:'popp2', tests.rules('{"approval_mode": "none", "win_condition_target": 9}')) as m3 \gset
select is(pg_temp.row_of('recent', :'popp2'), null, 'a match with no finished frame says nothing');
select tests.sign_out();
insert into public.tbl_frames (match_id, frame_no, status, abandon_reason) values (:'m3', 1, 'abandoned', 'test') returning id as gone \gset
insert into public.tbl_frame_participants (frame_id, side, player_id) values (:'gone', 'home', :'pann'), (:'gone', 'away', :'popp2');
insert into public.tbl_frames (match_id, frame_no, status) values (:'m3', 2, 'in_progress') returning id as going \gset
insert into public.tbl_frame_participants (frame_id, side, player_id) values (:'going', 'home', :'pann'), (:'going', 'away', :'popp2');
insert into public.tbl_frames (match_id, frame_no, status, winner_side, result_event) values (:'m3', 3, 'complete', 'home', 'default') returning id as wo \gset
insert into public.tbl_frame_participants (frame_id, side, player_id) values (:'wo', 'home', :'pann'), (:'wo', 'away', :'popp2');
select tests.sign_in(:'ann');
select is(pg_temp.row_of('recent', :'popp2'), null, 'nor an abandoned frame, one in progress, or a walkover');

-- ─── A league night: an opponent counts, a teammate never ───

select tests.sign_in(:'dee');
select public.tdc_create_league('People League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'pann', :'th', true);
select public.tdc_add_league_entrant(:'season', :'pmate', :'th');
select public.tdc_add_league_entrant(:'season', :'popp', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'popp2', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select public.tdc_set_match_squad(:'m', :'pann');
select public.tdc_set_match_squad(:'m', :'pmate');
select public.tdc_set_lineup_slot(:'m', 1, :'pann', 'home');
select public.tdc_set_lineup_slot(:'m', 2, :'pmate', 'home');
select public.tdc_lock_lineup(:'m', 'home');
select public.tdc_set_match_squad(:'m', :'popp');
select public.tdc_set_match_squad(:'m', :'popp2');
select public.tdc_set_lineup_slot(:'m', 1, :'popp', 'away');
select public.tdc_set_lineup_slot(:'m', 2, :'popp2', 'away');
select public.tdc_lock_lineup(:'m', 'away');

select tests.sign_in(:'ann');
select is(pg_temp.row_of('often', :'popp'), null, 'a frame made by the lock but not played says nothing');

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', f.frame_no, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb)
from public.tbl_frames f where f.match_id = :'m';

select tests.sign_in(:'ann');
select is((pg_temp.row_of('often', :'popp')->>'frames')::int > 0, true, 'an opponent on a league night counts');
select is(pg_temp.row_of('often', :'pmate'), null, 'a teammate does not');
select is(pg_temp.row_of('recent', :'pmate'), null, 'on either list');
select is(pg_temp.row_of('often', :'pann'), null, 'nor am I my own opponent');
select is(pg_temp.row_of('often', :'popp')->>'display_name', 'People Opp', 'the name comes with them');

-- ─── The follow mark ───

select public.tdc_set_follow(:'pbob', true);
select is(pg_temp.row_of('often', :'pbob')->>'i_follow', 'true', 'one I follow is marked');
select is(pg_temp.row_of('recent', :'pbob')->>'i_follow', 'true', 'on both lists');
select is(pg_temp.row_of('often', :'pcas')->>'i_follow', 'false', 'one I do not is not');

select tests.sign_in(:'bob');
select is(pg_temp.row_of('often', :'pann')->>'i_follow', 'false', 'Bob is not told Ann follows him: it says only whom Bob follows');

-- ─── The limit, and nobody's business ───

select tests.sign_in(:'ann');
select is(jsonb_array_length(public.tdc_my_people(1)->'often'), 1, 'the limit holds');

select tests.sign_in(:'stranger');
select is(public.tdc_my_people(), '{"recent": [], "often": []}'::jsonb, 'a stranger has two empty lists');

select tests.sign_out();
select ok(not has_function_privilege('anon', 'public.tdc_my_people(integer)', 'execute'), 'anon may not call it');

select * from finish();
rollback;
