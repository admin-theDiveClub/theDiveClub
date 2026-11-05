-- Asking to join a team (migration 20261105153021; UV, 5 Nov).
--
--   • only a player active in the league and on no team may ask; a full
--     team is refused; asking twice is one request and one notice
--   • the team's captains are told, linked to the Players tab
--   • a captain sees their own team's requests, the director every team's,
--     a player their own, a stranger none
--   • a captain of the team (or the director) may decline; another may not
--   • taken onto any team, every request the player made in the season goes,
--     and they are told only when the team was one they asked
--   • the walk-in merge carries a request
--
-- A two-man league with one reserve, so a team's limit is 3.
begin;
\ir _helpers.psql
select plan(22);

select tests.create_user('Ask Dee') as dee \gset
select tests.create_user('Ask Cap') as cap \gset
select tests.create_user('Ask Bob') as bob \gset
select tests.create_user('Ask P1') as u1 \gset
select tests.create_user('Ask P2') as u2 \gset
select tests.create_user('Ask P3') as u3 \gset
select tests.create_user('Ask P4') as u4 \gset
select tests.create_user('Ask P5') as u5 \gset
select tests.create_user('Ask Out') as out \gset
select tests.create_user('Ask Staff') as staff \gset

select tests.player_of(:'cap') as pcap \gset
select tests.player_of(:'u1') as p1 \gset
select tests.player_of(:'u2') as p2 \gset
select tests.player_of(:'u3') as p3 \gset
select tests.player_of(:'u4') as p4 \gset
select tests.player_of(:'u5') as p5 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Ask League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring', p_max_reserves => 1) as season \gset
select public.tdc_create_team(:'season', 'Alpha') as alpha \gset
select public.tdc_create_team(:'season', 'Bravo') as bravo \gset
select public.tdc_add_league_entrant(:'season', :'pcap', :'alpha', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'bob'), :'bravo', true);
select public.tdc_add_league_entrant(:'season', :'p3', :'bravo');
select public.tdc_add_league_entrant(:'season', :'p1');
select public.tdc_add_league_entrant(:'season', :'p2');
select public.tdc_add_league_entrant(:'season', :'p4');
select public.tdc_add_league_entrant(:'season', :'p5');
select tests.sign_out();

-- ─── Who may ask ───

select tests.sign_in(:'out');
select throws_ok(
	format($$ select public.tdc_request_team(%L) $$, :'alpha'),
	'P0001', 'Only a player in this league can ask to join one of its teams.',
	'somebody not in the league cannot ask');
select tests.sign_out();

select tests.sign_in(:'u3');
select throws_ok(
	format($$ select public.tdc_request_team(%L) $$, :'alpha'),
	'P0001', 'You are already on Bravo. Your captain has to release you before another team can take you.',
	'a player on a team cannot ask another');
select tests.sign_out();

select tests.sign_in(:'u1');
select lives_ok(format($$ select public.tdc_request_team(%L) $$, :'alpha'), 'a player on no team asks Alpha');
select lives_ok(format($$ select public.tdc_request_team(%L) $$, :'alpha'), 'asking again is no error');
select lives_ok(format($$ select public.tdc_request_team(%L) $$, :'bravo'), 'and may ask a second team too');
select tests.sign_out();

select is((select count(*)::integer from public.tbl_team_join_requests where player_id = :'p1' and team_id = :'alpha'),
	1, 'asking twice is one request');
select is((select count(*)::integer from public.tbl_notifications where player_id = :'pcap' and kind = 'team_join_request'),
	1, 'Alpha''s captain is told once');
select is((select link from public.tbl_notifications where player_id = :'pcap' and kind = 'team_join_request'),
	'/leagues/season/?s=' || :'season' || '&view=players', 'the notice opens the Players tab');

-- ─── Who sees which ───

select tests.sign_in(:'u1');
select is((select count(*)::integer from public.tdc_team_join_requests(:'season') where is_mine),
	2, 'the player sees both their requests as their own');
select tests.sign_out();

select tests.sign_in(:'cap');
select is((select array_agg(team_id) from public.tdc_team_join_requests(:'season')),
	array[:'alpha'::uuid], 'Alpha''s captain sees only Alpha''s request');
select tests.sign_out();

select tests.sign_in(:'dee');
select is((select count(*)::integer from public.tdc_team_join_requests(:'season')),
	2, 'the director sees every team''s');
select tests.sign_out();

select tests.sign_in(:'out');
select is((select count(*)::integer from public.tdc_team_join_requests(:'season')),
	0, 'a stranger sees none');
select tests.sign_out();

-- ─── Declining and taking back ───

select tests.sign_in(:'bob');
select throws_ok(
	format($$ select public.tdc_decline_team_request(%L, %L) $$, :'alpha', :'p1'),
	'P0001', 'Only a captain of this team or the league director can turn a request down.',
	'Bravo''s captain cannot decline a request to Alpha');
select lives_ok(format($$ select public.tdc_decline_team_request(%L, %L) $$, :'bravo', :'p1'),
	'Bravo''s captain declines the request to Bravo');
select tests.sign_out();

select is((select array_agg(team_id) from public.tbl_team_join_requests where player_id = :'p1'),
	array[:'alpha'::uuid], 'only the request to Alpha is left');

select tests.sign_in(:'u2');
select public.tdc_request_team(:'alpha');
select lives_ok(format($$ select public.tdc_cancel_team_request(%L) $$, :'alpha'), 'a player takes their request back');
select tests.sign_out();
select is((select count(*)::integer from public.tbl_team_join_requests where player_id = :'p2'),
	0, 'and it is gone');

-- ─── Taken onto a team ───

select tests.sign_in(:'u1');
select public.tdc_request_team(:'bravo');
select tests.sign_out();

select tests.sign_in(:'cap');
select public.tdc_team_claim_player(:'alpha', :'p1');
select public.tdc_team_claim_player(:'alpha', :'p2');
select tests.sign_out();

select is((select count(*)::integer from public.tbl_team_join_requests where player_id = :'p1'),
	0, 'taken onto Alpha, every request the player made goes, Bravo''s too');
select is((select title from public.tbl_notifications where player_id = :'p1' and kind = 'team_join_taken'),
	'You are on Alpha', 'the player is told the team they asked took them');
select is((select count(*)::integer from public.tbl_notifications where player_id = :'p2' and kind = 'team_join_taken'),
	0, 'a player claimed without asking is not told this way');

select tests.sign_in(:'u4');
select throws_ok(
	format($$ select public.tdc_request_team(%L) $$, :'alpha'),
	'P0001', 'Alpha is full: 3 of 3 places taken.',
	'a full team cannot be asked');
select tests.sign_out();

-- ─── The walk-in merge carries a request ───

insert into public.tbl_venues (name, slug) values ('Ask Venue', 'ask-venue') returning id as venue \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'venue', :'staff', 'staff');

select tests.sign_in(:'staff');
select public.tdc_create_walk_in(:'venue', 'P5 Walk-in') as w5 \gset
select tests.sign_out();

select tests.sign_in(:'u5');
select public.tdc_request_team(:'bravo');
select tests.sign_out();

select tests.sign_in(:'staff');
select public.tdc_staff_link_account(:'venue', :'w5', :'p5');
select tests.sign_out();

select is((select player_id from public.tbl_team_join_requests where team_id = :'bravo'),
	:'w5'::uuid, 'linking the account to a walk-in carries its request onto the walk-in record');

select * from finish();
rollback;
