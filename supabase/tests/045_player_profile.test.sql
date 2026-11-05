-- A player's profile and head to head (migration 20261105044302, UV 5 Nov).
--
--   signed in only; an unknown player is refused
--   only finished matches count, and only their finished frames
--   a singles match: the score, each frame won and broke, the special win
--   a team night is the player's match too, scored as their side's frames,
--     while their own frames are only the ones they played
--   head to head counts only frames the two played against each other;
--     against yourself there is nothing to compare
begin;
\ir _helpers.psql
select plan(25);

select tests.create_user('Prof Alice') as alice \gset
select tests.create_user('Prof Bob') as bob \gset
select tests.create_user('Prof Carol') as carol \gset
select tests.player_of(:'alice') as pal \gset
select tests.player_of(:'bob') as pbo \gset
select tests.player_of(:'carol') as pca \gset

-- ─── Who may ───

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_player_profile(%L) $$, :'pbo'),
	'42501', null, 'a visitor not signed in cannot call it');
select tests.sign_in(:'carol');
select throws_ok($$ select public.tdc_player_profile(gen_random_uuid()) $$,
	'P0001', 'No player with that id. Check the link.', 'an unknown player is refused');

-- ─── A singles match ───
-- Alice (home) v Bob, alternate breaks from home: Alice wins 1, Bob 2,
-- Alice 3 with a break and finish. Submitted with no approval: complete.
-- A second match with one frame is left in progress.

select tests.sign_in(:'alice');
select public.tdc_create_match(:'pbo', tests.rules('{"track_breaks": true, "break_finish_enabled": true, "approval_mode": "none"}'), 'home') as m1 \gset
select public.tdc_record_frame(:'m1', 1, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_record_frame(:'m1', 2, '{"winner_side": "away", "result_event": "win"}');
select public.tdc_record_frame(:'m1', 3, '{"winner_side": "home", "result_event": "break_and_finish"}');
select public.tdc_submit_card(:'m1');
select public.tdc_create_match(:'pbo', tests.rules()) as m2 \gset
select public.tdc_record_frame(:'m2', 1, '{"winner_side": "away", "result_event": "win"}');

select tests.sign_in(:'carol');
select public.tdc_player_profile(:'pbo') as bob_prof \gset
select is(jsonb_array_length(:'bob_prof'::jsonb -> 'matches'), 1, 'only the finished match counts');
select is((:'bob_prof'::jsonb -> 'matches' -> 0 ->> 'mine')::int, 1, 'Bob''s side won one frame');
select is((:'bob_prof'::jsonb -> 'matches' -> 0 ->> 'theirs')::int, 2, 'and lost two');
select is(:'bob_prof'::jsonb -> 'matches' -> 0 ->> 'opponent', 'Prof Alice', 'the opponent is Alice');
select is(:'bob_prof'::jsonb -> 'matches' -> 0 ->> 'kind', 'social', 'a match outside a competition is social');
select is(jsonb_array_length(:'bob_prof'::jsonb -> 'frames'), 3, 'the in-progress match''s frame is not counted');
select is(:'bob_prof'::jsonb -> 'player' ->> 'is_me', 'false', 'Carol is not Bob');
select is(:'bob_prof'::jsonb -> 'player' ->> 'verified', 'false', 'Bob has no verified identifier');

select tests.sign_in(:'alice');
select public.tdc_player_profile(:'pal') as al_prof \gset
select is(:'al_prof'::jsonb -> 'player' ->> 'is_me', 'true', 'Alice looking at herself is_me');
select is((select count(*)::int from jsonb_array_elements(:'al_prof'::jsonb -> 'frames') f where (f ->> 'won')::boolean), 2,
	'Alice won two frames');
select is((select string_agg(f ->> 'frame_no', ',' order by (f ->> 'frame_no')::int)
	from jsonb_array_elements(:'al_prof'::jsonb -> 'frames') f where (f ->> 'broke')::boolean), '1,3',
	'she broke frames 1 and 3');
select is((select f ->> 'result_event' from jsonb_array_elements(:'al_prof'::jsonb -> 'frames') f where f ->> 'frame_no' = '3'),
	'break_and_finish', 'frame 3 was her break and finish');

-- ─── Head to head, singles ───

select public.tdc_head_to_head(:'pbo') as h2h \gset
select is(jsonb_array_length(:'h2h'::jsonb -> 'meetings'), 1, 'Alice and Bob met once (finished)');
select is((:'h2h'::jsonb -> 'meetings' -> 0 ->> 'mine')::int || '-' || (:'h2h'::jsonb -> 'meetings' -> 0 ->> 'theirs'), '2-1',
	'Alice won it 2-1');
select is(public.tdc_head_to_head(:'pal') ->> 'same', 'true', 'against yourself there is nothing to compare');
select tests.sign_in(:'carol');
select is(jsonb_array_length(public.tdc_head_to_head(:'pbo') -> 'meetings'), 0, 'Carol never played Bob');

-- ─── A team night ───
-- Two a side: frame 1 is H1 v A1, 2 H2 v A2, 3 H1 v A2, 4 H2 v A1. Home
-- wins frames 1 to 3, away frame 4. Signed by both: complete.

select tests.create_user('Prof LD') as dee \gset
select tests.create_user('Prof H1') as h1 \gset
select tests.create_user('Prof H2') as h2 \gset
select tests.create_user('Prof A1') as a1 \gset
select tests.create_user('Prof A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Prof League', tests.rules('{"team_size": 2}')) as league \gset
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

select public.tdc_player_profile(:'ph1') as h1_prof \gset
select is((select (x ->> 'mine') || '-' || (x ->> 'theirs') from jsonb_array_elements(:'h1_prof'::jsonb -> 'matches') x),
	'3-1', 'a team night is scored as the side''s frames');
select is((select x ->> 'opponent' from jsonb_array_elements(:'h1_prof'::jsonb -> 'matches') x), 'Guests', 'against the other team');
select is((select x ->> 'kind' from jsonb_array_elements(:'h1_prof'::jsonb -> 'matches') x), 'league', 'a league night');
select is((select string_agg(f ->> 'frame_no', ',' order by (f ->> 'frame_no')::int) from jsonb_array_elements(:'h1_prof'::jsonb -> 'frames') f),
	'1,3', 'but H1''s own frames are only the two they played');
select is((select x ->> 'team_name' || ':' || (x ->> 'is_captain') from jsonb_array_elements(:'h1_prof'::jsonb -> 'teams') x),
	'Hosts:true', 'their team, as captain');

-- ─── Head to head, a team night ───

select tests.sign_in(:'h1');
select public.tdc_head_to_head(:'pa2') as h2h_t \gset
select is((:'h2h_t'::jsonb -> 'meetings' -> 0 ->> 'mine') || '-' || (:'h2h_t'::jsonb -> 'meetings' -> 0 ->> 'theirs'), '1-0',
	'H1 and A2 met in frame 3 alone: 1-0');
select is(jsonb_array_length(public.tdc_head_to_head(:'ph2') -> 'meetings'), 0, 'teammates never meet');

select * from finish();
rollback;
