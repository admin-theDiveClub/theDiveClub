-- Who may delete a match (migration 20261024080007, audit A1).
--
--   social match       either player, settled or not (UV, 23 Oct)
--   tournament match   the people running the tournament
--   league match       the people running the league season — not a captain,
--                      not a player with a frame
--   sanctioned         nobody
begin;
\ir _helpers.psql
select plan(15);
-- (A sanctioned match needs a sanctioning source, which nothing creates yet;
-- its refusal is unchanged from 20261015200000 and is not tested here.)

select tests.create_user('Del Alice') as alice \gset
select tests.create_user('Del Bob') as bob \gset
select tests.create_user('Del Stranger') as stranger \gset
select tests.create_user('Del TD') as td \gset
select tests.create_user('Del LD') as ld \gset
select tests.create_user('Del H1') as h1 \gset
select tests.create_user('Del A1') as a1 \gset
select tests.player_of(:'bob') as bob_p \gset

-- ─── Social ───

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as social \gset
select public.tdc_record_frame(:'social', 1, '{"winner_side": "home", "result_event": "win"}');
select tests.sign_out();

select tests.sign_in(:'stranger');
select is(public.tdc_may_delete_match(:'social'), false, 'social: a stranger may not delete it');
select throws_ok(format($$ select public.tdc_delete_match(%L) $$, :'social'),
	'P0001', 'Only the players in this match can delete it.', 'social: and is refused');
select tests.sign_in(:'bob');
select is(public.tdc_may_delete_match(:'social'), true, 'social: either player may');
select lives_ok(format($$ select public.tdc_delete_match(%L) $$, :'social'), 'social: and does');
select tests.sign_out();

select is((select deleted_by from public.tbl_deleted_matches where match_id = :'social'), :'bob_p'::uuid,
	'the record says who deleted it');
select is((select count(*)::integer from public.tbl_frames where match_id = :'social'), 0,
	'a match with a frame played can be deleted, and its frames go with it (broken 21–24 Oct)');


-- ─── Tournament ───

insert into public.tbl_tournaments (name, rules) values ('Del Open', tests.rules()) returning id as t \gset
insert into public.tbl_competition_roles (tournament_id, player_id, role) values (:'t', tests.player_of(:'td'), 'director');
select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as tm \gset
select tests.sign_out();
insert into public.tbl_tournament_fixtures (tournament_id, round, position, match_id) values (:'t', 1, 1, :'tm');

select tests.sign_in(:'alice');
select is(public.tdc_may_delete_match(:'tm'), false, 'tournament: a player in the match may not delete it');
select throws_ok(format($$ select public.tdc_delete_match(%L) $$, :'tm'),
	'P0001', 'This match is part of a tournament. Only the people running it can delete it.',
	'tournament: and is told why');
select tests.sign_in(:'td');
select is(public.tdc_may_delete_match(:'tm'), true, 'tournament: its director may');
select lives_ok(format($$ select public.tdc_delete_match(%L) $$, :'tm'), 'tournament: and does, without playing in it');
select tests.sign_out();

select is((select match_id from public.tbl_tournament_fixtures where tournament_id = :'t'), null,
	'the fixture is left without a match, not removed');

-- ─── League ───

select tests.sign_in(:'ld');
select public.tdc_create_league('Del League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'h1'), :'th', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'a1'), :'ta', true);
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select public.tdc_create_league_match(:'fx') as lm \gset
select tests.sign_out();

-- Both captains put themselves in and lock, so each has a frame.
select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'lm', tests.player_of(:'h1'));
select public.tdc_set_lineup_slot(:'lm', 1, tests.player_of(:'h1'), (select case when home_team_id = :'th'::uuid then 'home' else 'away' end from public.tbl_matches where id = :'lm'));
select public.tdc_lock_lineup(:'lm', (select case when home_team_id = :'th'::uuid then 'home' else 'away' end from public.tbl_matches where id = :'lm'));
select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'lm', tests.player_of(:'a1'));
select public.tdc_set_lineup_slot(:'lm', 1, tests.player_of(:'a1'), (select case when home_team_id = :'ta'::uuid then 'home' else 'away' end from public.tbl_matches where id = :'lm'));
select public.tdc_lock_lineup(:'lm', (select case when home_team_id = :'ta'::uuid then 'home' else 'away' end from public.tbl_matches where id = :'lm'));
select tests.sign_out();

select tests.sign_in(:'h1');
select is(public.tdc_may_delete_match(:'lm'), false, 'league: a captain with a frame may not delete the night');
select throws_ok(format($$ select public.tdc_delete_match(%L) $$, :'lm'),
	'P0001', 'This match is part of a league. Only the people running it can delete it.',
	'league: and is told why');
select tests.sign_in(:'ld');
select is(public.tdc_may_delete_match(:'lm'), true, 'league: the league director may');
select lives_ok(format($$ select public.tdc_delete_match(%L) $$, :'lm'), 'league: and does');
select tests.sign_out();

select * from finish();
rollback;
