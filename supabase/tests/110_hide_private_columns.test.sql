-- Private columns hidden from direct reads (migration 20261127144020, B2).
begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('Pc Player') as p \gset

-- The only columns a signed-in user cannot read are the private ones. A new
-- column on one of these tables fails this until a migration grants it.
select is(
	(select string_agg(c.table_name || '.' || c.column_name, ', ' order by c.table_name, c.column_name)
	from information_schema.columns c
	where c.table_schema = 'public'
		and c.table_name in ('tbl_tournament_entrants', 'tbl_tournaments', 'tbl_tournament_fixtures',
			'tbl_leagues', 'tbl_league_seasons', 'tbl_league_fixtures', 'tbl_match_events', 'tbl_match_result_override')
		and not has_column_privilege('authenticated', format('public.%I', c.table_name), c.column_name, 'SELECT')),
	'tbl_league_fixtures.notes, tbl_league_seasons.notes, tbl_leagues.notes, tbl_match_events.note, '
	|| 'tbl_match_result_override.reason, tbl_tournament_entrants.notes, tbl_tournament_entrants.paid_at, '
	|| 'tbl_tournament_fixtures.notes, tbl_tournaments.notes',
	'exactly the private columns are hidden; every other column is readable');

select tests.sign_in(:'p');
select throws_ok('select paid_at from public.tbl_tournament_entrants', '42501', null, 'who has paid is hidden');
select throws_ok('select notes from public.tbl_tournament_entrants', '42501', null, 'the director''s notes on an entrant are hidden');
select throws_ok('select * from public.tbl_tournament_entrants', '42501', null, 'so is reading every column');
select lives_ok('select id, player_id, status, seed from public.tbl_tournament_entrants', 'the rest of an entrant is readable');
select throws_ok('select notes from public.tbl_tournaments', '42501', null, 'a tournament''s notes are hidden');
select lives_ok('select id, name, is_recurring from public.tbl_tournaments', 'the rest of a tournament is readable');
select throws_ok('select notes from public.tbl_tournament_fixtures', '42501', null, 'a fixture''s notes are hidden');
select throws_ok('select notes from public.tbl_leagues', '42501', null, 'a league''s notes are hidden');
select throws_ok('select notes from public.tbl_league_fixtures', '42501', null, 'a league fixture''s notes are hidden');
select throws_ok('select note from public.tbl_match_events', '42501', null, 'a dispute''s note is hidden');
select throws_ok('select reason from public.tbl_match_result_override', '42501', null, 'an override''s reason is hidden');

select * from finish();
rollback;
