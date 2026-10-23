-- Creating a match: tdc_create_match.
--
-- A signed-in player starts a match they are in, against another account. A
-- walk-in has nobody to confirm or dispute the result, so only venue staff may
-- start a match against one. The ruleset is checked whole and frozen onto the
-- match exactly as given.
begin;
\ir _helpers.psql
select plan(26);

select tests.create_user('Create Alice') as alice \gset
select tests.create_user('Create Bob') as bob \gset
select tests.create_user('Create Staff') as staff \gset
select tests.player_of(:'alice') as alice_p \gset
select tests.player_of(:'bob') as bob_p \gset

-- A venue with one staff member, and a walk-in with no account.
insert into public.tbl_venues (name, slug) values ('Test Venue', 'test-venue-create') returning id as venue \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'venue', :'staff', 'staff');
insert into public.tbl_players (display_name, player_type) values ('Walk-in Wally', 'walk_in') returning id as walkin_p \gset

-- ─── The ordinary case ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as m1 \gset
select tests.sign_out();

select isnt(:'m1'::uuid, null,'a player can start a match against another account');
select is((select home_player_id from public.tbl_matches where id = :'m1'), :'alice_p'::uuid, 'the creator is home by default');
select is((select away_player_id from public.tbl_matches where id = :'m1'), :'bob_p'::uuid, 'the opponent is away');
select is((select home_side_kind || '/' || away_side_kind from public.tbl_matches where id = :'m1'), 'player/player', 'both sides are players');
select is((select status from public.tbl_matches where id = :'m1'), 'scheduled', 'a new match is scheduled');
select is((select card_version from public.tbl_matches where id = :'m1'), 0, 'a new card is at version 0');
select is((select created_by from public.tbl_matches where id = :'m1'), :'alice'::uuid, 'the match records who created it');
select is((select sanctioned from public.tbl_matches where id = :'m1'), false, 'a match made in the app is not sanctioned');
select is((select rules from public.tbl_matches where id = :'m1'), tests.rules(), 'the ruleset is stored exactly as given');
select is((select count(*)::integer from public.tbl_frames where match_id = :'m1'), 0, 'a new match has no frames');

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules(), 'away', null, 'away') as m2 \gset
select tests.sign_out();

select is((select away_player_id from public.tbl_matches where id = :'m2'), :'alice_p'::uuid, 'p_i_am away puts the creator on the away side');
select is((select first_break_side from public.tbl_matches where id = :'m2'), 'away', 'the first break side is stored');

-- A version 1 ruleset is still accepted: version 1 is frozen, not retired.
select tests.sign_in(:'alice');
select lives_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'bob_p',
		tests.rules() - 'lineup_cutoff_hours' - 'strict_frame_order' || '{"version": 1}'),
	'a complete version 1 ruleset is accepted');

-- ─── Refusals ───

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'alice_p', tests.rules()),
	'P0001', 'You cannot start a match against yourself.',
	'nobody can play themselves');

select throws_like(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, gen_random_uuid(), tests.rules()),
	'TDC (Error): no player with id %',
	'an opponent who does not exist is refused');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb, null, null, 'middle') $$, :'bob_p', tests.rules()),
	'P0001', 'TDC (Error): your side must be home or away, not "middle".',
	'p_i_am must be home or away');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb, 'left') $$, :'bob_p', tests.rules()),
	'P0001', 'TDC (Error): first_break_side must be home or away, not "left".',
	'the first break side must be home or away');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'bob_p', tests.rules() - 'approval_mode'),
	'P0001', 'TDC (Error): the ruleset is missing approval_mode.',
	'a ruleset missing a key is refused');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'bob_p', tests.rules('{"referee": "Jim"}')),
	'P0001', 'TDC (Error): the ruleset has unknown setting(s) referee.',
	'a ruleset with an unknown key is refused');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'bob_p', tests.rules('{"version": 3}')),
	'P0001', 'TDC (Error): unknown ruleset version "3".',
	'an unknown ruleset version is refused');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'bob_p', tests.rules('{"win_condition_type": "first_to_fall"}')),
	'P0001', 'TDC (Error): unknown win condition "first_to_fall".',
	'an unknown enumerated value is refused');

select throws_like(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'bob_p', tests.rules() - 'version' || '{"version": 1}'),
	'TDC (Error): the ruleset has unknown setting(s) %',
	'a version 1 ruleset cannot carry the version 2 keys');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'walkin_p', tests.rules()),
	'P0001', 'Only club staff can start a match against a walk-in or guest.',
	'a player cannot start a match against a walk-in');

select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb, null, %L) $$, :'walkin_p', tests.rules(), :'venue'),
	'P0001', 'Only club staff can start a match against a walk-in or guest.',
	'naming a venue does not help a player who is not its staff');

-- ─── Venue staff and walk-ins ───

select tests.sign_in(:'staff');
select lives_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb, null, %L) $$, :'walkin_p', tests.rules(), :'venue'),
	'venue staff can start a match against a walk-in at their venue');

-- ─── Not signed in ───

select tests.sign_in_anon();
select throws_ok(
	format($$ select public.tdc_create_match(%L, %L::jsonb) $$, :'bob_p', tests.rules()),
	'42501', null,
	'someone not signed in cannot start a match');

select tests.sign_out();

select * from finish();
rollback;
