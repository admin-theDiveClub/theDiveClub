-- Recurring tournaments (migration 20261125130921, UV 25 Nov): the switch,
-- the next tournament carrying every setting and nobody entered, and the
-- history of the series' other tournaments with their winners.
begin;
\ir _helpers.psql
select plan(25);

select tests.create_user('Rec Dee') as dee \gset
select tests.create_user('Rec Ref') as ref \gset
select tests.create_user('Rec Ann') as p1 \gset
select tests.create_user('Rec Ben') as p2 \gset
select tests.create_user('Rec Stranger') as stranger \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Friday Comp', tests.rules('{"win_condition_target": 7}'),
	p_starts_at => '2026-11-27 19:00+02', p_max_entrants => 16, p_entry_fee_credits => 50,
	p_entry_mode => 'interested', p_paid_confirms => true, p_progression => 'manual',
	p_create_matches => 'manual', p_third_place => true, p_is_listed => true) as t \gset
select public.tdc_add_competition_role(:'t', tests.player_of(:'ref'), 'referee');
select public.tdc_add_entrant(:'t', tests.player_of(:'p1'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'p2'), 'confirmed');
select tests.sign_out();
update public.tbl_tournaments set notes = 'private note', short_code = 'FRI' where id = :'t';
insert into public.tbl_tournament_round_rules (tournament_id, bracket, round, rules)
	values (:'t', 'main', 2, tests.rules('{"win_condition_target": 9}'));
select tests.sign_in(:'dee');

-- 1. The switch.
select throws_ok(format('select public.tdc_next_tournament(%L)', :'t'),
	'This tournament is not recurring. Turn on Recurring in its Details first.',
	'a tournament that is not recurring has no next one');
select tests.sign_in(:'stranger');
select throws_ok(format('select public.tdc_set_tournament_recurring(%L, true)', :'t'),
	'Only the people running this tournament can make it recurring.',
	'a stranger cannot make it recurring');
select tests.sign_in(:'dee');
select public.tdc_set_tournament_recurring(:'t', true);
select ok((select is_recurring and series_id = id from public.tbl_tournaments where id = :'t'),
	'turned on, it starts a series with its own id');
select public.tdc_set_tournament_recurring(:'t', false);
select ok((select not is_recurring and series_id = id from public.tbl_tournaments where id = :'t'),
	'turned off, the series id is kept');
select public.tdc_set_tournament_recurring(:'t', true);

-- 2. The next one.
select tests.sign_in(:'stranger');
select throws_ok(format('select public.tdc_next_tournament(%L)', :'t'),
	'Only the people running this tournament can make the next one.',
	'a stranger cannot make the next one');
select tests.sign_in(:'dee');
select public.tdc_next_tournament(:'t', '2026-12-04 19:00+02') as t2 \gset
select tests.sign_out();

select is((select row(name, format, rules, max_entrants, entry_fee_credits, entry_mode, paid_confirms,
		progression, create_matches, third_place, is_listed, venue_id)::text
	from public.tbl_tournaments where id = :'t2'),
	(select row(name, format, rules, max_entrants, entry_fee_credits, entry_mode, paid_confirms,
		progression, create_matches, third_place, is_listed, venue_id)::text
	from public.tbl_tournaments where id = :'t'),
	'every setting on the row is carried');
select ok((select is_recurring and series_id = :'t'::uuid from public.tbl_tournaments where id = :'t2'),
	'it is recurring, in the same series');
select is((select starts_at from public.tbl_tournaments where id = :'t2'), '2026-12-04 19:00+02'::timestamptz,
	'it starts when given');
select ok((select notes is null and short_code is distinct from 'FRI' and picture_path is null and not status_manual
	from public.tbl_tournaments where id = :'t2'),
	'notes, short link and picture are not carried (it gets a short link of its own)');
select is((select count(*)::integer from public.tbl_tournament_entrants where tournament_id = :'t2'), 0,
	'nobody is entered');
select is((select count(*)::integer from public.tbl_tournament_fixtures where tournament_id = :'t2'), 0,
	'there is no draw');
select is((select rules ->> 'win_condition_target' from public.tbl_tournament_round_rules
	where tournament_id = :'t2' and bracket = 'main' and round = 2), '9',
	'a round''s own rules are carried');
select is((select string_agg(role || ':' || player_id, ',' order by role) from public.tbl_competition_roles where tournament_id = :'t2'),
	(select string_agg(role || ':' || player_id, ',' order by role) from public.tbl_competition_roles where tournament_id = :'t'),
	'everybody who runs it is carried, once each');
select ok((select is_public from public.tbl_tournament_posters where tournament_id = :'t2'),
	'its poster is built and shared, as the last one''s was');
select is(private.tdc_tournament_status(:'t2'), 'draft', 'its status starts again');

-- Made from the second one, with a new name.
select tests.sign_in(:'dee');
select public.tdc_next_tournament(:'t2', null, '  Friday Comp (Xmas)  ') as t3 \gset
select tests.sign_out();
select is((select name from public.tbl_tournaments where id = :'t3'), 'Friday Comp (Xmas)',
	'a new name, trimmed, is taken');
select ok((select series_id = :'t'::uuid from public.tbl_tournaments where id = :'t3'),
	'made from the second, it is still the first one''s series');

-- 3. The history. Ann beats Ben in the first tournament's final.
select tests.sign_in(:'dee');
select public.tdc_generate_draw(:'t', p_confirmed_only => true);
select tests.sign_out();
select id as fx from public.tbl_tournament_fixtures where tournament_id = :'t' and bracket = 'main' order by round desc limit 1 \gset
update public.tbl_tournament_fixtures
	set advanced_entrant_id = (select id from public.tbl_tournament_entrants where tournament_id = :'t' and player_id = tests.player_of(:'p1')),
		advance_reason = 'walkover'
	where id = :'fx';

select tests.sign_in(:'p2');
select is((select count(*)::integer from public.tdc_tournament_history(:'t3')), 2,
	'any signed-in player sees the series'' other tournaments');
select is((select array_agg(tournament_id order by starts_at desc nulls first)::text from public.tdc_tournament_history(:'t3')),
	(select array[:'t2'::uuid, :'t'::uuid]::text),
	'newest first');
select is((select winner_player_id from public.tdc_tournament_history(:'t3') where tournament_id = :'t'),
	tests.player_of(:'p1'), 'the winner is counted from the final');
select is((select runner_up_name from public.tdc_tournament_history(:'t3') where tournament_id = :'t'),
	'Rec Ben', 'with the runner-up');
select is((select entrants from public.tdc_tournament_history(:'t3') where tournament_id = :'t'), 2,
	'and how many entered');
select ok((select winner_player_id is null from public.tdc_tournament_history(:'t3') where tournament_id = :'t2'),
	'an unplayed one has no winner');
select ok((select poster_open from public.tdc_tournament_history(:'t3') where tournament_id = :'t2'),
	'and says its shared poster can be opened');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok(format('select * from public.tdc_tournament_history(%L)', :'t'), '42501', null,
	'a signed-out visitor cannot read it');
select tests.sign_out();

select * from finish();
rollback;
