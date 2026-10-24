-- Joining a walk-in record to an account: private.tdc_merge_players, through
-- tdc_staff_link_account as staff use it on /staff/link/ (migration
-- 20261024090641, audit A5).
--
-- The merge moves everything off the signup record (the account's) onto the
-- walk-in record, then deletes the signup record. Tonight's squad, the lineup
-- and the notification settings were not moved, so a claim took a league
-- player out of their squad, emptied their position and turned their
-- notifications back on.
--
-- A walk-in cannot be in any of those tables through a function. Where one is
-- anyway (written directly here), the account's row stands and the
-- walk-in's goes (UV, 24 Oct).
begin;
\ir _helpers.psql
select plan(16);

select tests.create_user('Merge Dee') as dee \gset
select tests.create_user('Merge Sam') as sam \gset
select tests.create_user('Merge Pat') as pat \gset
select tests.create_user('Merge Opp') as opp \gset
select tests.create_user('Merge Two') as two \gset
select tests.create_user('Merge Ken') as ken \gset
select tests.create_user('Merge Staff') as staff \gset
select tests.player_of(:'sam') as psam \gset
select tests.player_of(:'pat') as ppat \gset
select tests.player_of(:'opp') as popp \gset
select tests.player_of(:'two') as ptwo \gset
select tests.player_of(:'ken') as pken \gset

insert into public.tbl_venues (name, slug) values ('Merge Venue', 'merge-venue') returning id as venue \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'venue', :'staff', 'staff');

select tests.sign_in(:'staff');
select public.tdc_create_walk_in(:'venue', 'Sam Walk-in') as wsam \gset
select public.tdc_create_walk_in(:'venue', 'Ken Walk-in') as wken \gset
select tests.sign_out();

-- A two-man league played twice, so two matches between the same teams.
select tests.sign_in(:'dee');
select public.tdc_create_league('Merge League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'psam', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ppat', :'th');
select public.tdc_add_league_entrant(:'season', :'popp', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'ptwo', :'ta');
select public.tdc_generate_league_fixtures(:'season', 2);
select tests.sign_out();

select id as fx1 from public.tbl_league_fixtures where league_season_id = :'season' and round = 1 \gset
select id as fx2 from public.tbl_league_fixtures where league_season_id = :'season' and round = 2 \gset

select tests.sign_in(:'dee');
select public.tdc_set_league_fixture(:'fx1', p_home_team_id => :'th', p_away_team_id => :'ta');
select public.tdc_set_league_fixture(:'fx2', p_home_team_id => :'th', p_away_team_id => :'ta');
select public.tdc_create_league_match(:'fx1') as m \gset
select public.tdc_create_league_match(:'fx2') as m2 \gset
select tests.sign_out();

-- ─── Sam: tonight's squad at position 1, league notifications off, and a
--     singles frame against Pat ───

select tests.sign_in(:'sam');
select public.tdc_set_match_squad(:'m', :'psam');
select public.tdc_set_match_squad(:'m', :'ppat');
select public.tdc_set_lineup_slot(:'m', 1, :'psam');
select public.tdc_set_lineup_slot(:'m', 2, :'ppat');
select public.tdc_set_notification_pref('league', false);
select public.tdc_create_match(:'ppat', tests.rules()) as ms \gset
select public.tdc_record_frame(:'ms', 1, '{"winner_side": "home", "result_event": "win"}'::jsonb);
select tests.sign_out();

select tests.sign_in(:'staff');
select lives_ok(
	format($$ select public.tdc_staff_link_account(%L, %L, %L) $$, :'venue', :'wsam', :'psam'),
	'staff link Sam''s walk-in record to his account');
select tests.sign_out();

select is(
	(select count(*)::integer from public.tbl_players where id = :'psam'),
	0, 'the signup record is gone');
select is(
	(select side from public.tbl_league_match_squad where match_id = :'m' and player_id = :'wsam'),
	'home', 'Sam is still in tonight''s squad');
select is(
	(select player_id from public.tbl_league_match_order where match_id = :'m' and side = 'home' and lineup_slot = 1),
	:'wsam'::uuid, 'and still at position 1');
select is(
	(select push_enabled from public.tbl_notification_prefs where player_id = :'wsam' and category = 'league'),
	false, 'his league notifications are still off');
select is(
	(select team_id from public.tbl_league_season_entrants where player_id = :'wsam'),
	:'th'::uuid, 'he is still on Hosts');
select is(
	(select fp.player_id from public.tbl_frame_participants fp join public.tbl_frames f on f.id = fp.frame_id
	 where f.match_id = :'ms' and fp.side = 'home'),
	:'wsam'::uuid, 'and his singles frame is his');

select tests.sign_in(:'sam');
select is(
	private.tdc_me(), :'wsam'::uuid,
	'signing in now reaches the walk-in record');
select tests.sign_out();

-- ─── Clashes: the account's row stands and the walk-in's goes ───
--
-- Ken's account is in match 2's home squad at position 1 and has league
-- notifications off. His walk-in record is written in directly: in the away
-- squad at position 2, and with league notifications on.

insert into public.tbl_league_match_squad (match_id, side, player_id) values
	(:'m2', 'home', :'pken'), (:'m2', 'away', :'wken');
insert into public.tbl_league_match_order (match_id, side, lineup_slot, player_id) values
	(:'m2', 'home', 1, :'pken'), (:'m2', 'away', 2, :'wken');
insert into public.tbl_notification_prefs (player_id, category, push_enabled) values
	(:'pken', 'league', false), (:'wken', 'league', true), (:'wken', 'match', false);

select tests.sign_in(:'staff');
select lives_ok(
	format($$ select public.tdc_staff_link_account(%L, %L, %L) $$, :'venue', :'wken', :'pken'),
	'a merge where both records are in the same match does not fail');
select tests.sign_out();

select is(
	(select array_agg(side) from public.tbl_league_match_squad where match_id = :'m2' and player_id = :'wken'),
	array['home'], 'Ken is in one squad, the account''s');
select is(
	(select player_id from public.tbl_league_match_order where match_id = :'m2' and side = 'home' and lineup_slot = 1),
	:'wken'::uuid, 'the account''s position stands');
select is(
	(select count(*)::integer from public.tbl_league_match_order where match_id = :'m2' and side = 'away' and lineup_slot = 2 and player_id is null),
	1, 'the walk-in''s position is left empty, as a captain clearing it would');
select is(
	(select push_enabled from public.tbl_notification_prefs where player_id = :'wken' and category = 'league'),
	false, 'the account''s setting wins a clash');
select is(
	(select push_enabled from public.tbl_notification_prefs where player_id = :'wken' and category = 'match'),
	false, 'a setting only the walk-in had is kept');

-- ─── Nothing points at a deleted record ───

select is(
	(select count(*)::integer from public.tbl_league_match_squad where player_id in (:'psam', :'pken'))
	+ (select count(*)::integer from public.tbl_league_match_order where player_id in (:'psam', :'pken'))
	+ (select count(*)::integer from public.tbl_notification_prefs where player_id in (:'psam', :'pken')),
	0, 'no squad, lineup or setting row names a signup record');
select is(
	(select count(*)::integer from public.tbl_players where id = :'pken'),
	0, 'and Ken''s signup record is gone too');

select * from finish();
rollback;
