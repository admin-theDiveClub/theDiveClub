-- The tournament follow page (migration 20261128113429).
--
-- UV, 28 Nov: one page on a TV for the night, signed in only, any signed-in
-- account. Entrants confirmed then interested; the draw and the start of play
-- read from the fixtures.
begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('Fol Dee') as dee \gset
select tests.create_user('Fol Ann') as ann \gset
select tests.create_user('Fol Bob') as bob \gset
select tests.create_user('Fol Cat') as cat \gset
select tests.create_user('Fol Eve') as eve \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Fol Cup', tests.rules()) as cup \gset
select public.tdc_add_entrant(:'cup', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'cup', tests.player_of(:'bob'), 'confirmed');
select public.tdc_add_entrant(:'cup', tests.player_of(:'cat'), 'interested');
select public.tdc_add_entrant(:'cup', tests.player_of(:'dee'), 'withdrawn');
select tests.sign_out();

-- Eve is in nothing and runs nothing: any signed-in account may read it.
select tests.sign_in(:'eve');
select is((public.tdc_tournament_follow(:'cup')) ->> 'name', 'Fol Cup', 'any signed-in account reads it');
select is((select string_agg(e ->> 'display_name' || ':' || (e ->> 'status'), ',')
		from jsonb_array_elements(public.tdc_tournament_follow(:'cup') -> 'entrants') e),
	'Fol Ann:confirmed,Fol Bob:confirmed,Fol Cat:interested', 'confirmed first, then interested, no one withdrawn');
select ok(not (public.tdc_tournament_follow(:'cup') -> 'entrants' -> 0) ? 'first_name', 'no full names');
select is((public.tdc_tournament_follow(:'cup')) ->> 'has_draw', 'false', 'no draw yet');
select is((public.tdc_tournament_follow(:'cup')) ->> 'started', 'false', 'not started');
select is((public.tdc_tournament_follow(:'cup')) ->> 'short_code', (select short_code from public.tbl_tournaments where id = :'cup'), 'the short code for the QR');
select is((select f ->> 'discipline' || ' ' || (f ->> 'win_condition_type') || ' ' || (f ->> 'win_condition_target')
		from public.tdc_tournament_follow(:'cup') f), '8ball race_to 5', 'the rules the details show');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_generate_draw(:'cup');
select tests.sign_out();
select tests.sign_in(:'eve');
select is((public.tdc_tournament_follow(:'cup')) ->> 'has_draw', 'true', 'the draw is made');
select is((public.tdc_tournament_follow(:'cup')) ->> 'started', 'false', 'a draw alone is not play');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_create_fixture_match(fixture_id) from public.tdc_tournament_draw(:'cup') where round = 1 and home_name is not null and away_name is not null limit 1;
select tests.sign_out();
select tests.sign_in(:'eve');
select is((public.tdc_tournament_follow(:'cup')) ->> 'started', 'true', 'a started match is play');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok(format('select public.tdc_tournament_follow(%L)', :'cup'), '42501', null, 'signed out: refused');
select tests.sign_out();

select is(public.tdc_tournament_follow(gen_random_uuid()), null, 'nothing for a tournament that is not there');

select * from finish();
