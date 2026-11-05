-- What a person is in, for the profile menu (tdc_my_active, UV 5 Nov).
--
--   a team night shows for a captain before any lineup, marked Needs you
--     until their side locks; for a player once in the squad, never before
--   somebody running a league but not playing has the league, not the night
--   a singles match shows, with its score, until it is finished or abandoned
--   a finished league and one the person withdrew from are gone
--   a finished tournament and one the person withdrew from are gone; the
--     director keeps theirs
--   a stranger has three empty lists; anon may not call it
begin;
\ir _helpers.psql
select plan(26);

select tests.create_user('Active LD') as dee \gset
select tests.create_user('Active H1') as h1 \gset
select tests.create_user('Active H2') as h2 \gset
select tests.create_user('Active A1') as a1 \gset
select tests.create_user('Active A2') as a2 \gset
select tests.create_user('Active Stranger') as stranger \gset
select tests.player_of(:'dee') as pdee \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

-- What the signed-in person's lists hold.
create function pg_temp.match_row(p_id uuid) returns jsonb language sql as $$
	select x from jsonb_array_elements(public.tdc_my_active()->'matches') x where x->>'id' = p_id::text
$$;
create function pg_temp.has_league(p_id uuid) returns boolean language sql as $$
	select exists (select 1 from jsonb_array_elements(public.tdc_my_active()->'leagues') x
		where x->>'league_season_id' = p_id::text)
$$;
create function pg_temp.has_tournament(p_id uuid) returns boolean language sql as $$
	select exists (select 1 from jsonb_array_elements(public.tdc_my_active()->'tournaments') x
		where x->>'id' = p_id::text)
$$;

select tests.sign_in(:'dee');
select public.tdc_create_league('Active League', tests.rules('{"team_size": 2}')) as league \gset
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

-- ─── The night before any lineup ───

select tests.sign_in(:'h1');
select is(pg_temp.match_row(:'m')->>'team_match', 'true', 'a captain has the night before any lineup');
select is(pg_temp.match_row(:'m')->>'opponent', 'Guests', 'named as the other team');
select is(pg_temp.match_row(:'m')->>'set_lineup', 'true', 'their lineup is wanted');
select is(pg_temp.match_row(:'m')->>'needs_me', 'true', 'so it needs them');

select tests.sign_in(:'h2');
select is(pg_temp.match_row(:'m'), null, 'a player out of the squad does not have it');

select tests.sign_in(:'dee');
select is(pg_temp.match_row(:'m'), null, 'nor does somebody running the league but not playing');
select is(pg_temp.has_league(:'season'), true, 'who has the league');

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');

select tests.sign_in(:'h2');
select is(pg_temp.match_row(:'m')->>'set_lineup', 'false', 'a player in the squad has it, nothing to set');
select is(pg_temp.match_row(:'m')->>'needs_me', 'false', 'and it does not need them');

select tests.sign_in(:'a2');
select is(pg_temp.match_row(:'m'), null, 'the other team''s squad says nothing to their players');

select tests.sign_in(:'h1');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1', 'home');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2', 'home');
select public.tdc_lock_lineup(:'m', 'home');
select is(pg_temp.match_row(:'m')->>'needs_me', 'false', 'once locked it no longer needs the captain');

select tests.sign_in(:'a1');
select is(pg_temp.match_row(:'m')->>'set_lineup', 'true', 'the other captain still has theirs to set');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1', 'away');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2', 'away');
select public.tdc_lock_lineup(:'m', 'away');

-- ─── Singles ───

select tests.sign_in(:'h2');
select public.tdc_create_match(:'pa2', tests.rules('{"approval_mode": "none"}')) as s1 \gset
select public.tdc_record_frame(:'s1', 1, '{"winner_side": "home", "result_event": "win"}');
select is((pg_temp.match_row(:'s1')->>'my_frames')::int, 1, 'a singles match shows my frames');
select is(pg_temp.match_row(:'s1')->>'opponent', 'Active A2', 'and who against');

select tests.sign_in(:'a2');
select is((pg_temp.match_row(:'s1')->>'their_frames')::int, 1, 'the other player reads it their way round');

select tests.sign_out();
update public.tbl_matches set status = 'abandoned' where id = :'s1';
select tests.sign_in(:'h2');
select is(pg_temp.match_row(:'s1'), null, 'an abandoned match is gone');

select tests.sign_out();
update public.tbl_matches set status = 'complete' where id = :'m';
select tests.sign_in(:'h2');
select is(pg_temp.match_row(:'m'), null, 'a finished night is gone');

-- ─── Leagues ───

select is(pg_temp.has_league(:'season'), true, 'a running league shows');
select tests.sign_in(:'a2');
select public.tdc_withdraw_league_entry(:'season');
select is(pg_temp.has_league(:'season'), false, 'one the person withdrew from does not');

select tests.sign_out();
update public.tbl_league_seasons set status = 'finished' where id = :'season';
select tests.sign_in(:'h2');
select is(pg_temp.has_league(:'season'), false, 'nor a finished one');

-- ─── Tournaments ───

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Active Cup', tests.rules()) as cup \gset
select public.tdc_add_entrant(:'cup', :'ph2', 'confirmed');
select public.tdc_add_entrant(:'cup', :'pa2', 'confirmed');
select is(pg_temp.has_tournament(:'cup'), true, 'the director has their tournament');

select tests.sign_in(:'h2');
select is(pg_temp.has_tournament(:'cup'), true, 'an entrant has it');

select tests.sign_out();
update public.tbl_tournament_entrants set status = 'withdrawn' where tournament_id = :'cup' and player_id = :'ph2';
select tests.sign_in(:'h2');
select is(pg_temp.has_tournament(:'cup'), false, 'one the person withdrew from is gone');

select tests.sign_out();
update public.tbl_tournaments set status = 'complete', status_manual = true where id = :'cup';
select tests.sign_in(:'a2');
select is(pg_temp.has_tournament(:'cup'), false, 'a finished one is gone');

-- ─── Nobody's business ───

select tests.sign_in(:'stranger');
select is(public.tdc_my_active(), '{"matches": [], "leagues": [], "tournaments": []}'::jsonb, 'a stranger has three empty lists');

select tests.sign_out();
select ok(not has_function_privilege('anon', 'public.tdc_my_active()', 'execute'), 'anon may not call it');

select * from finish();
rollback;
