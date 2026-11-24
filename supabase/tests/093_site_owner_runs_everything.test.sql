-- The site owner runs every league, tournament and match (migration
-- site_owner_runs_everything, 24 Nov).
--
--   the site owner (The Dive Club's owner) counts as director on a tournament
--     and a league season it holds no role in, may manage a league with no
--     season, and may edit any match card, a social one with a referee too
--   it is not listed among a competition's officials
--   it may delete any match, a social one too (site_owner_deletes_matches)
--   it may list any venue as played at, and the picker is sent every venue
--     (site_owner_chooses_venues); others still only their own
--   a stranger and The Dive Club's staff get none of it
begin;
\ir _helpers.psql
select plan(33);

select tests.create_user('So Host') as host \gset
select tests.create_user('So Away') as away \gset
select tests.create_user('So Ref') as ref \gset
select tests.create_user('So Site') as site \gset
select tests.create_user('So DC Staff') as dcstaff \gset
select tests.create_user('So Stranger') as stranger \gset
select tests.create_user('So Club Owner') as clubowner \gset

insert into public.tbl_venues (name, slug) values ('So Club', 'so-club') returning id as club \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'club', :'clubowner', 'owner');

insert into public.tbl_venue_staff (venue_id, user_id, role)
select v.id, :'site', 'owner' from public.tbl_venues v where v.slug = 'the-dive-club';
insert into public.tbl_venue_staff (venue_id, user_id, role)
select v.id, :'dcstaff', 'staff' from public.tbl_venues v where v.slug = 'the-dive-club';

-- Everything is made by the host, with no venue, so nobody else holds a role.
select tests.sign_in(:'host');
select public.tdc_create_tournament('So Cup', tests.rules()) as t \gset
select public.tdc_create_league('So League', tests.rules('{"team_size": 1}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_league('So Empty League', tests.rules('{"team_size": 1}')) as empty_league \gset
select public.tdc_create_match(tests.player_of(:'away'), tests.rules()) as social \gset
select public.tdc_set_match_referee(:'social', tests.player_of(:'ref'));


-- ─── Who counts ───

select tests.sign_in(:'site');
select is(private.tdc_is_site_owner(), true, 'The Dive Club''s owner is the site owner');
select tests.sign_in(:'dcstaff');
select is(private.tdc_is_site_owner(), false, 'its staff are not: false, never null');
select tests.sign_in(:'stranger');
select is(private.tdc_is_site_owner(), false, 'nor is a stranger');


-- ─── Tournaments ───

select tests.sign_in(:'site');
select is(public.tdc_may_run_tournament(:'t'), true, 'the site owner runs a tournament it has no part in');
select lives_ok(format($$ select public.tdc_update_tournament(%L, p_is_listed => true) $$, :'t'),
	'and may change it');
select is((select count(*) from public.tdc_competition_officials(:'t') o where o.player_id = tests.player_of(:'site')),
	0::bigint, 'without being listed among its officials');

select tests.sign_in(:'dcstaff');
select is(public.tdc_may_run_tournament(:'t'), false, 'The Dive Club''s staff do not');
select tests.sign_in(:'stranger');
select is(public.tdc_may_run_tournament(:'t'), false, 'nor does a stranger');


-- ─── Leagues ───

select tests.sign_in(:'site');
select is(public.tdc_may_run_league(:'season'), true, 'the site owner runs a league season it has no part in');
select is(private.tdc_can_manage_league(:'empty_league'), true, 'and manages a league with no season yet');
select lives_ok(format($$ select public.tdc_update_league(%L, 'So League II') $$, :'league'),
	'and may change a league');
select lives_ok(format($$ select public.tdc_create_league_season(%L, 'First') $$, :'empty_league'),
	'and open the first season of one with no director');
select is(private.tdc_can_manage_league(gen_random_uuid()), false, 'a league that does not exist: false');

select tests.sign_in(:'dcstaff');
select is(public.tdc_may_run_league(:'season'), false, 'The Dive Club''s staff do not run it');
select is(private.tdc_can_manage_league(:'league'), false, 'nor manage it');


-- ─── Matches ───

select tests.sign_in(:'ref');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "home", "result_event": "win"}') $$, :'social'),
	'the referee records a frame on a social match');

select tests.sign_in(:'site');
select is(private.tdc_can_edit_match(:'social'), true, 'the site owner may edit a social match it has no part in');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'social'),
	'and correct the referee''s frame, outranking them');

select tests.sign_in(:'dcstaff');
select is(private.tdc_can_edit_match(:'social'), false, 'The Dive Club''s staff may not, away from their venue');
select tests.sign_in(:'stranger');
select is(private.tdc_can_edit_match(:'social'), false, 'nor may a stranger');


-- ─── Deleting a match (migration site_owner_deletes_matches) ───

select tests.sign_in(:'dcstaff');
select is(public.tdc_may_delete_match(:'social'), false, 'The Dive Club''s staff may not delete a social match');
select tests.sign_in(:'stranger');
select is(public.tdc_may_delete_match(:'social'), false, 'nor may a stranger');

select tests.sign_in(:'site');
select is(public.tdc_may_delete_match(:'social'), true, 'the site owner may delete a social match it has no part in');
select lives_ok(format($$ select public.tdc_delete_match(%L) $$, :'social'), 'and does');
select is((select count(*) from public.tbl_matches where id = :'social'), 0::bigint, 'and it is gone');

-- ─── Choosing a venue (migration site_owner_chooses_venues) ───

select tests.sign_in(:'host');
select throws_ok(format($$ select public.tdc_set_league_season_venues(%L, array[%L]::uuid[]) $$, :'season', :'club'),
	'Only an owner or admin of a venue can choose it.', 'whoever runs a season may not list another''s venue');
select is(:'club'::uuid = any (array(select public.tdc_choosable_venues())), false, 'and the picker does not offer it');

select tests.sign_in(:'clubowner');
select is(array(select public.tdc_choosable_venues()), array[:'club'::uuid], 'a venue''s owner is offered their own venue only');

select tests.sign_in(:'dcstaff');
select is(:'club'::uuid = any (array(select public.tdc_choosable_venues())), false, 'The Dive Club''s staff are not offered other venues');

select tests.sign_in(:'site');
select is((select count(*) from public.tdc_choosable_venues()), (select count(*) from public.tbl_venues where active),
	'the site owner is offered every open venue');
select lives_ok(format($$ select public.tdc_set_league_season_venues(%L, array[%L]::uuid[]) $$, :'season', :'club'),
	'and may list one it does not own on a league season');
select lives_ok(format($$ select public.tdc_set_tournament_venues(%L, array[%L]::uuid[]) $$, :'t', :'club'),
	'and on a tournament');
select is((select venue_id from public.tbl_tournament_venues where tournament_id = :'t'), :'club'::uuid, 'and it is saved');

select * from finish();
rollback;
