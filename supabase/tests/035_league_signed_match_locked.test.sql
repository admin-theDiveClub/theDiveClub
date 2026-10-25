-- A match both captains have signed stays on its fixture (migration
-- 20261025072000).
--
--   a match not yet signed can still be taken off, and started again
--   a signed match (status complete) cannot be taken off
--   nor can the schedule holding it be cleared or replaced, confirmed or not
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('Lock LD') as ld \gset
select tests.create_user('Lock P1') as p1 \gset
select tests.create_user('Lock P2') as p2 \gset

select tests.sign_in(:'ld');
select public.tdc_create_league('Lock League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Alpha') as ta \gset
select public.tdc_create_team(:'season', 'Bravo') as tb \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p1'), :'ta', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'p2'), :'tb', true);
select public.tdc_generate_league_fixtures(:'season', 1, '2026-11-04 17:30+00', 7);
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' \gset

-- Not signed: taken off and started again, as before.
select public.tdc_create_league_match(:'fx') as m1 \gset
select lives_ok(format($$ select public.tdc_detach_league_match(%L) $$, :'fx'),
	'a match not yet signed can be taken off its fixture');
select public.tdc_create_league_match(:'fx') as m2 \gset
select isnt(:'m2'::uuid, :'m1'::uuid, 'and starting the fixture again makes a new match');
select tests.sign_out();

-- Signed by both: the status both signatures set.
update public.tbl_matches set status = 'complete' where id = :'m2';

select tests.sign_in(:'ld');
select throws_ok(format($$ select public.tdc_detach_league_match(%L) $$, :'fx'),
	'P0001', 'Both captains have signed this match, so it stays on its fixture.',
	'a signed match cannot be taken off');
select throws_like(format($$ select public.tdc_clear_league_fixtures(%L, true) $$, :'season'),
	'One match has been signed by both captains%', 'the schedule holding it cannot be cleared, even confirmed');
select throws_like(format($$ select public.tdc_generate_league_fixtures(%L, 1, null, 7, true, true) $$, :'season'),
	'One match has been signed by both captains%', 'nor replaced by generating again');
select tests.sign_out();

select is((select match_id from public.tbl_league_fixtures where id = :'fx'), :'m2'::uuid,
	'the signed match is still on its fixture');

select * from finish();
rollback;
