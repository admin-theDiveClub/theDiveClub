-- A league's Season and Standings tabs for somebody not signed in (migration
-- 20261110094557, UV 10 Nov).
--
--   Visible to public off: both reads answer nothing, as for no such season
--   the names and faces switch: off by default, only whoever runs it sets it
--   switch off: teams with no players; Standings display names and rank only,
--     the counts behind the ranking columns and no others
--   switch on: rosters with no ids or status, withdrawn left off; faces
--   always: no pairings on a fixture, no full names, no ids of players or
--     matches, the counts a signed-out read may not reach stay refused
--   the exact list of what a stranger can reach, so a later opening fails here
begin;
\ir _helpers.psql
select plan(38);

select tests.create_user('Pub LD') as dee \gset
select tests.create_user('Pub H1') as h1 \gset
select tests.create_user('Pub H2') as h2 \gset
select tests.create_user('Pub H3') as h3 \gset
select tests.create_user('Pub A1') as a1 \gset
select tests.create_user('Pub A2') as a2 \gset
select tests.create_user('Pub Stranger') as stranger \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'h3') as ph3 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Pub League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'ph3', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2');
select public.tdc_lock_lineup(:'m');
select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2');
select public.tdc_lock_lineup(:'m');
select tests.sign_in(:'h1');
select public.tdc_record_frame(:'m', f.frame_no, jsonb_build_object('status', 'complete',
	'winner_side', case when f.frame_no <= 3 then 'home' else 'away' end, 'result_event', 'win',
	'break_side', case when f.frame_no = 1 then 'home' else 'away' end))
from public.tbl_frames f where f.match_id = :'m';
select public.tdc_submit_card(:'m');
select tests.sign_in(:'a1');
select public.tdc_submit_card(:'m');

select tests.sign_out();
update public.tbl_players set avatar_path = id || '/face.webp', first_name = 'Secret', last_name = 'Surname' where id = :'ph1';
update public.tbl_league_season_entrants set status = 'withdrawn' where player_id = :'ph3' and league_season_id = :'season';

-- ─── Visible to public off ───

select is((select is_listed or public_shows_players from public.tbl_league_seasons where id = :'season'),
	false, 'a new season is not visible, and its players not shown');
select tests.sign_in_anon();
select is(public.tdc_public_league_season(:'season'), null, 'not visible: the Season read answers nothing');
select is(public.tdc_public_league_standings(:'season'), null, 'not visible: nor does Standings');
select is(public.tdc_public_league_season(gen_random_uuid()), null, 'the same answer as no such season');
select is(public.tdc_public_league_standings(gen_random_uuid()), null, 'on Standings too');

select tests.sign_in(:'dee');
select public.tdc_update_league_season(:'season', p_is_listed => true);

-- ─── Switch off, the default ───

select tests.sign_in_anon();
select public.tdc_public_league_season(:'season') as s \gset
select public.tdc_public_league_standings(:'season') as st \gset

select is(:'s'::jsonb ->> 'league_name', 'Pub League', 'visible: a stranger reads the season');
select is((:'s'::jsonb ->> 'shows_players')::boolean, false, 'and is told the players are not shown');
select is((select count(*)::int from jsonb_array_elements(:'s'::jsonb -> 'teams') t where t ? 'roster'),
	0, 'no team carries a roster');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys((:'s'::jsonb -> 'teams') -> 0) k),
	'active_players,name,picture_path,team_id,team_limit', 'a team is its name, picture and places');
select is(:'s'::jsonb -> 'officials' -> 0 ->> 'display_name', 'Pub LD', 'who runs it is shown');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys((:'s'::jsonb -> 'officials') -> 0) k),
	'avatar_path,display_name,role_name', 'by name, picture and role');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys((:'s'::jsonb -> 'fixtures') -> 0) k),
	'frames,is_bye,match_status,scheduled_at', 'a fixture has no teams, ids or notes');
select is((select sum((f ->> 'frames')::int)::int from jsonb_array_elements(:'s'::jsonb -> 'fixtures') f),
	4, 'and the frames are counted');
select is((select count(*)::int from jsonb_array_elements(:'s'::jsonb -> 'fixtures') f where f ->> 'match_status' = 'complete'),
	1, 'and the night reads complete');

select is((select string_agg(p ->> 'display_name', ',' order by p ->> 'display_name') from jsonb_array_elements(:'st'::jsonb -> 'players') p),
	'Pub A1,Pub A2,Pub H1,Pub H2', 'Standings: display names, with switch off');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys((:'st'::jsonb -> 'players') -> 0) k),
	'display_name,key,stats,team_id', 'no picture, player id or full name');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys(((:'st'::jsonb -> 'players') -> 0) -> 'stats') k),
	'frames_played,frames_won', 'only the counts behind the ranking columns');
select is((select string_agg(c ->> 'name', ',' order by (c ->> 'position')::int) from jsonb_array_elements(:'st'::jsonb -> 'columns') c where c ->> 'scope' = 'player'),
	'Frames Won,Win %', 'only the player columns that decide the rank');
select is((select count(*)::int from jsonb_array_elements(:'st'::jsonb -> 'columns') c where c ->> 'scope' = 'team'),
	6, 'every team column');
select is(((:'st'::jsonb -> 'teams') -> 0) -> 'stats' ->> 'frames_won' is not null, true, 'and the teams keep their numbers');
select is(:'st'::jsonb ? 'watch_match_ids', false, 'no match ids');

-- ─── The switch ───

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_set_league_public_players(%L, true) $$, :'season'),
	'42501', null, 'somebody not signed in cannot set the switch');
select tests.sign_in(:'h1');
select throws_ok(format($$ select public.tdc_set_league_public_players(%L, true) $$, :'season'),
	'P0001', 'Only the people running this league can change this.', 'nor can a captain');
select tests.sign_in(:'stranger');
select throws_ok(format($$ select public.tdc_set_league_public_players(%L, true) $$, :'season'),
	'P0001', 'Only the people running this league can change this.', 'nor a stranger');
select tests.sign_in(:'dee');
select lives_ok(format($$ select public.tdc_set_league_public_players(%L, true) $$, :'season'), 'the director can');

-- ─── Switch on ───

select tests.sign_in_anon();
select public.tdc_public_league_season(:'season') as s \gset
select public.tdc_public_league_standings(:'season') as st \gset

select is((select string_agg(r ->> 'display_name', ',' order by r ->> 'display_name')
		from jsonb_array_elements(:'s'::jsonb -> 'teams') t, jsonb_array_elements(t -> 'roster') r where t ->> 'team_id' = :'th'),
	'Pub H1,Pub H2', 'on: a team''s players, the withdrawn left off');
select is((select string_agg(k, ',' order by k)
		from jsonb_array_elements(:'s'::jsonb -> 'teams') t, jsonb_object_keys((t -> 'roster') -> 0) k where t ->> 'team_id' = :'th'),
	'avatar_path,display_name,is_captain', 'no player id, status or confirmation');
select is((select p ->> 'avatar_path' from jsonb_array_elements(:'st'::jsonb -> 'players') p where p ->> 'display_name' = 'Pub H1'),
	:'ph1' || '/face.webp', 'Standings: the face');
select is((select count(*)::int from jsonb_array_elements(:'st'::jsonb -> 'columns') c where c ->> 'scope' = 'player'),
	3, 'every player column');
select is((select p -> 'stats' ->> 'frames_won' from jsonb_array_elements(:'st'::jsonb -> 'players') p where p ->> 'display_name' = 'Pub H1'),
	'2', 'the same count as a member sees');
select ok(not (((:'st'::jsonb -> 'players') -> 0) -> 'stats' ? 'leagues_played'), 'a count no column uses stays home');
select ok(position('Surname' in :'st') = 0 and position('Surname' in :'s') = 0, 'a surname appears nowhere');
select ok(position(:'ph2' in :'st') = 0 and position(:'ph2' in :'s') = 0, 'a player with no picture has no id anywhere');
select ok(position(:'m' in :'st') = 0 and position(:'m' in :'s') = 0, 'nor a match''s id');

-- ─── Everything else stays behind a login ───

select throws_ok(format($$ select public.tdc_league_fixtures(%L) $$, :'season'), '42501', null, 'the fixtures are refused');
select throws_ok(format($$ select public.tdc_team_roster(%L) $$, :'th'), '42501', null, 'the roster is refused');
select throws_ok($$ select * from public.tbl_league_seasons $$, '42501', null, 'the seasons table is refused');

select tests.sign_out();
select is((select string_agg(object_kind || ' ' || object_name, E'\n' order by object_kind, object_name)
		from private.tdc_audit_anon_reach()),
	E'function public.tdc_public_league_season(p_league_season_id uuid)
function public.tdc_public_league_standings(p_league_season_id uuid)
function public.tdc_resolve_short_code(p_code text)
function public.tdc_short_link(p_kind text, p_id uuid)
function public.tdc_tournament_poster(p_tournament_id uuid)
function public.tdc_venue_competitions(p_venue_id uuid)
function public.tdc_venue(p_venue_id uuid)
function public.tdc_venues()
table public.tbl_tournament_posters', 'everything a stranger can reach, exactly');

select * from finish();
rollback;
