-- Importing a singles night from paper (migration 20261125120918_summer_singles_23_nov, UV 25 Nov).
--
--   a player not ready (here: not entered) refuses the whole import, nothing written
--   each match: a round-1 fixture at the night's time, a singles match started by
--     the director, the lag on the match, every frame in order, submitted
--   who broke each frame follows the lag, alternating; B&F frames are marked
--   the card waits on the players (awaiting) and counts in Standings at once,
--     a level score as a draw
--   a league placeholder (no account) is imported like anybody, frames on their record
--   running it again writes nothing; a B&F not on the breaker refuses it all
--   the API cannot call it
begin;
\ir _helpers.psql
select plan(16);

select tests.create_user('Import LD') as dee \gset
select tests.create_user('Import Ann') as ann \gset
select tests.create_user('Import Ben') as ben \gset
select tests.create_user('Import Cas') as cas \gset
select tests.create_user('Import Eve') as eve \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'ben') as pben \gset
select tests.player_of(:'cas') as pcas \gset
select tests.player_of(:'eve') as peve \gset
update public.tbl_players set display_name = 'Eve' where id = :'peve';

select tests.sign_in(:'dee');
select public.tdc_create_league('Import Club', tests.rules('{"team_size": 1}')) as league \gset
select public.tdc_create_league_season(:'league', 'Night') as season \gset
select public.tdc_add_league_entrant(:'season', :'pann');
select public.tdc_add_league_entrant(:'season', :'pben');
select public.tdc_add_league_entrant(:'season', :'pcas');
select tests.sign_out();

-- ─── Refused while a player is not ready ───

select throws_ok(format($$ select private.tdc_import_singles_night(%L, %L, '2026-11-23 19:00+02', 1,
		jsonb_build_array(jsonb_build_object('home', %L, 'away', %L, 'lag', 'home', 'frames', 'HH'))) $$,
		:'season', :'dee', :'pann', :'peve'),
	'P0001', 'Nothing imported. These players are not ready: Eve (not entered in this season).',
	'a player not entered refuses the import, naming them');
select is((select count(*)::int from public.tbl_league_fixtures where league_season_id = :'season'), 0,
	'and nothing is written');

-- ─── The night ───
--   Ann 5-1 Ben   AHHHHH    lag Ben   B&F Ben f1, Ann f4
--   Cas 4-4 Ann   HAAAHHHA  lag Cas   B&F Ann f4
--   Ben 3-4 Cas   HAHHAAA   lag Ben

select is(private.tdc_import_singles_night(:'season', :'dee', '2026-11-23 19:00+02', 1, jsonb_build_array(
		jsonb_build_object('home', :'pann', 'away', :'pben', 'lag', 'away', 'frames', 'AHHHHH', 'bf', jsonb_build_array(1, 4)),
		jsonb_build_object('home', :'pcas', 'away', :'pann', 'lag', 'home', 'frames', 'HAAAHHHA', 'bf', jsonb_build_array(4)),
		jsonb_build_object('home', :'pben', 'away', :'pcas', 'lag', 'home', 'frames', 'HAHHAAA'))),
	3, 'three matches imported');

select m.id as m1 from public.tbl_league_fixtures f join public.tbl_matches m on m.id = f.match_id
where f.league_season_id = :'season' and m.home_player_id = :'pann' \gset
select m.id as m2 from public.tbl_league_fixtures f join public.tbl_matches m on m.id = f.match_id
where f.league_season_id = :'season' and m.home_player_id = :'pcas' \gset

select is((select array_agg(round || '/' || position || '/' || (scheduled_at = '2026-11-23 19:00+02') order by position)
		from public.tbl_league_fixtures where league_season_id = :'season'),
	array['1/1/true', '1/2/true', '1/3/true'], 'one round-1 fixture each, at the night''s time, in order');
select is((select count(*)::int from public.tbl_league_fixtures f join public.tbl_matches m on m.id = f.match_id
		where f.league_season_id = :'season' and m.status = 'complete' and m.home_side_kind = 'player'
			and m.created_by = :'dee'),
	3, 'each a complete singles match, started by the director');
select is((select first_break_side from public.tbl_matches where id = :'m1'), 'away', 'the lag winner is on the match');
select is((select string_agg(case winner_side when 'home' then 'H' else 'A' end, '' order by frame_no)
		from public.tbl_frames where match_id = :'m1' and status = 'complete'),
	'AHHHHH', 'every frame, in order');
select is((select string_agg(case break_side when 'home' then 'H' else 'A' end, '' order by frame_no)
		from public.tbl_frames where match_id = :'m1'),
	'AHAHAH', 'who broke follows the lag, alternating');
select is((select array_agg(frame_no order by frame_no) from public.tbl_frames
		where match_id = :'m1' and result_event = 'break_and_finish'),
	array[1, 4], 'the B&F frames are marked');
select is(private.tdc_card_state(:'m2')->>'state', 'awaiting', 'the card waits on the players');

select tests.sign_in(:'dee');
select is(
	(select array_agg((p->'stats'->>'matches_won') || '-' || (p->'stats'->>'matches_drawn') order by p->>'player_id' = :'pann' desc, p->>'player_id' = :'pcas' desc)
	from jsonb_array_elements(public.tdc_league_standings(:'season')->'players') p),
	array['1-1', '1-1', '0-0'], 'it counts in Standings at once: Ann and Cas a win and a draw, Ben none');
select tests.sign_out();

-- ─── A league placeholder plays too (DECISIONS 11 Nov) ───

insert into public.tbl_players (display_name, first_name, last_name, player_type)
	values ('Pip Placeholder', 'Pip', 'Placeholder', 'walk_in') returning id as ppip \gset
insert into public.tbl_player_identifiers (player_id, kind, value)
	values (:'ppip', 'email', private.tdc_normalize_identifier('email', 'pip@example.com'));
insert into public.tbl_league_season_entrants (league_season_id, player_id, status, placeholder)
	values (:'season', :'ppip', 'active', true);
select is(private.tdc_import_singles_night(:'season', :'dee', '2026-11-23 19:00+02', 1, jsonb_build_array(
		jsonb_build_object('home', :'ppip', 'away', :'pben', 'lag', 'home', 'frames', 'HAH'))),
	1, 'a placeholder with no account, given their team of one, is imported like anybody');
select is((select count(*)::int from public.tbl_frame_participants fp join public.tbl_frames f on f.id = fp.frame_id
		where fp.player_id = :'ppip' and f.status = 'complete'),
	3, 'with their frames on their record, for the sign-up link to carry over');

-- ─── Again, and wrongly ───

select is(private.tdc_import_singles_night(:'season', :'dee', '2026-11-23 19:00+02', 1, jsonb_build_array(
		jsonb_build_object('home', :'pann', 'away', :'pben', 'lag', 'away', 'frames', 'AHHHHH'))),
	0, 'running it again writes nothing');
select throws_ok(format($$ select private.tdc_import_singles_night(%L, %L, '2026-11-30 19:00+02', 2,
		jsonb_build_array(jsonb_build_object('home', %L, 'away', %L, 'lag', 'home', 'frames', 'HH', 'bf', jsonb_build_array(2)))) $$,
		:'season', :'dee', :'pann', :'pben'),
	'P0001', 'TDC (Error): in this match a break and finish must go to the side that broke.',
	'a B&F not on the breaker is refused');

select ok(not has_function_privilege('authenticated', 'private.tdc_import_singles_night(uuid, uuid, timestamptz, integer, jsonb)', 'execute'),
	'the API cannot call it');

select * from finish();
rollback;
