-- Short links (migration 20261109114638, docs/design/short-links.md).
--
-- UV, 9 Nov:
--   • every league, tournament and match gets a code when it is created
--   • T- and L- are fixed; the rest is letters and digits, 2 to 8 of them
--   • a league or tournament match is the competition's code and a number
--   • a social match is a number and cannot be customised
--   • only whoever set a code may change it, and an old code is released at once
--   • a code opens the poster, or deeper for somebody who is part of it
begin;
\ir _helpers.psql
select plan(63);

select tests.create_user('Link Dee') as dee \gset
select tests.create_user('Link Pat') as pat \gset
select tests.create_user('Link Sam') as sam \gset

-- ─── A code at creation ───

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Link Open', tests.rules(),
	p_entry_mode => 'interested', p_is_listed => true) as t1 \gset
select public.tdc_create_tournament('Link Hidden', tests.rules(),
	p_entry_mode => 'interested') as t2 \gset
select public.tdc_create_league('Link League', tests.rules('{"team_size": 5}')) as l1 \gset
select public.tdc_create_league('Link Empty', tests.rules('{"team_size": 5}')) as l2 \gset
select public.tdc_create_league_season(:'l1', 'First') as s1 \gset
select tests.sign_out();

select ok((select short_code ~ '^[B-DF-HJKMNP-TV-Z2-9]{5}$' from public.tbl_tournaments where id = :'t1'),
	'a new tournament gets a suggested code');
select ok((select short_code ~ '^[B-DF-HJKMNP-TV-Z2-9]{5}$' from public.tbl_leagues where id = :'l1'),
	'a new league gets a suggested code');
select is((select short_code_by from public.tbl_tournaments where id = :'t1'), :'dee'::uuid,
	'whoever created the tournament holds its code');
select is((select short_code_by from public.tbl_leagues where id = :'l1'), :'dee'::uuid,
	'whoever created the league holds its code');

-- ─── The field's feedback ───

select tests.sign_in(:'dee');
select public.tdc_set_short_code('tournament', :'t1', 'bc26');
select is(public.tdc_short_code_status('tournament', :'t2', 'BCOPEN'), 'available', 'a free code is available');
select is(public.tdc_short_code_status('tournament', :'t2', 'bc26'), 'taken', 'one in use is taken, in any case');
select is(public.tdc_short_code_status('tournament', :'t1', 'BC26'), 'yours', 'its own code is yours');
select is(public.tdc_short_code_status('tournament', :'t2', 'B'), 'too_short', 'one character is too short');
select is(public.tdc_short_code_status('tournament', :'t2', 'ABCDEFGHJ'), 'too_long', 'nine characters are too long');
select is(public.tdc_short_code_status('tournament', :'t2', 'BC-26'), 'invalid', 'a dash cannot be typed');
select is(public.tdc_short_code_status('tournament', :'t2', 'BC 26'), 'invalid', 'a space cannot be typed');
select is(public.tdc_short_code_status('tournament', :'t2', 'SHIT'), 'blocked', 'the worst words are refused');
select is(public.tdc_short_code_status('tournament', :'t2', 'CLASSIC'), 'available', 'an ordinary word holding one of the short words passes');
select is(public.tdc_short_code_status('league', :'l1', 'BC26'), 'available', 'T-BC26 and L-BC26 can both exist');

-- ─── Changing one ───

select is((select short_code from public.tbl_tournaments where id = :'t1'), 'BC26', 'the code is saved in capitals');
select throws_ok(format($$ select public.tdc_set_short_code('tournament', %L, 'BC26') $$, :'t2'),
	'That code is taken. Try another.', 'a taken code is refused');
select throws_ok(format($$ select public.tdc_set_short_code('tournament', %L, 'A') $$, :'t2'),
	'A code needs at least 2 characters.', 'too short is refused on saving too');
select throws_ok(format($$ select public.tdc_set_short_code('tournament', %L, 'A''B') $$, :'t2'),
	'A code can only have letters and numbers.', 'a quote is refused');
select tests.sign_out();

select tests.sign_in(:'sam');
select throws_ok(format($$ select public.tdc_set_short_code('tournament', %L, 'SAM') $$, :'t1'),
	'Only the person who set this short link may change it.', 'a stranger cannot change a tournament''s code');
select throws_ok(format($$ select public.tdc_set_short_code('season', %L, 'SAM') $$, :'s1'),
	'Only the person who set this short link may change it.', 'nor a league''s, by its season');
select tests.sign_out();

-- A co-director runs it but did not set the code.
insert into public.tbl_competition_roles (tournament_id, player_id, role)
values (:'t1', tests.player_of(:'pat'), 'director');
select tests.sign_in(:'pat');
select throws_ok(format($$ select public.tdc_set_short_code('tournament', %L, 'PAT') $$, :'t1'),
	'Only the person who set this short link may change it.', 'a co-director who did not set it cannot change it');
select is((public.tdc_short_link('tournament', :'t1') ->> 'can_change')::boolean, false, 'and the page knows that');
select is(public.tdc_short_link('tournament', :'t1') ->> 'set_by', 'Link Dee', 'and is told who can');
select tests.sign_out();
delete from public.tbl_competition_roles where tournament_id = :'t1' and player_id = tests.player_of(:'pat');

select tests.sign_in(:'sam');
select throws_ok(format($$ update public.tbl_tournaments set short_code = 'SAM' where id = %L $$, :'t1'),
	'42501', null, 'a code cannot be written straight to the table');
select tests.sign_out();

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_set_short_code('tournament', %L, 'ANON') $$, :'t1'),
	'42501', null, 'signed out, nobody can change one');
select tests.sign_out();

select tests.sign_in(:'dee');
select is((public.tdc_short_link('tournament', :'t1') ->> 'can_change')::boolean, true, 'whoever set it may change it');
select lives_ok(format($$ select public.tdc_set_short_code('season', %L, 'BCDAM') $$, :'s1'), 'a league''s code is set by its season');
select public.tdc_set_short_code('tournament', :'t2', 'OLDONE');
select public.tdc_set_short_code('tournament', :'t2', 'NEWONE');
select is(public.tdc_short_code_status('tournament', :'t1', 'OLDONE'), 'available', 'an old code is released at once');
select is(public.tdc_resolve_short_code('T-OLDONE') ->> 'reason', 'not_found', 'and its link stops working');
select tests.sign_out();

-- ─── Where a tournament's code goes ───

select tests.sign_in_anon();
select is(public.tdc_resolve_short_code('T-BC26') ->> 'path', '/tournaments/poster/?t=' || :'t1', 'signed out: the poster');
select is(public.tdc_resolve_short_code('t-bc26') ->> 'path', '/tournaments/poster/?t=' || :'t1', 'capitals do not matter');
select is(public.tdc_resolve_short_code('T-NEWONE') ->> 'reason', 'poster_not_shared', 'a poster not shared says so');
select ok(public.tdc_resolve_short_code('T-NEWONE')::text !~ 'Link Hidden', 'without naming the tournament');
select is(public.tdc_short_link('tournament', :'t1') ->> 'code', 'T-BC26', 'anyone on the poster can read the code to share');
select is(public.tdc_short_link('tournament', :'t1') ->> 'set_by', null, 'but not who set it');
select tests.sign_out();

select tests.sign_in(:'sam');
select is(public.tdc_resolve_short_code('T-BC26') ->> 'path', '/tournaments/poster/?t=' || :'t1', 'signed in, not part of it: the poster');
select tests.sign_out();

insert into public.tbl_tournament_entrants (tournament_id, player_id, status)
values (:'t1', tests.player_of(:'sam'), 'confirmed');
select tests.sign_in(:'sam');
select is(public.tdc_resolve_short_code('T-BC26') ->> 'path', '/tournaments/bracket/?t=' || :'t1', 'an entrant: the draw');
select tests.sign_out();

select tests.sign_in(:'dee');
select is(public.tdc_resolve_short_code('T-NEWONE') ->> 'path', '/tournaments/bracket/?t=' || :'t2', 'whoever runs it: the draw, shared or not');
select tests.sign_out();

-- ─── Matches ───

select tests.sign_in(:'dee');
select public.tdc_create_match(tests.player_of(:'pat'), tests.rules()) as social \gset
select public.tdc_create_match(tests.player_of(:'sam'), tests.rules()) as m_a \gset
select public.tdc_create_match(tests.player_of(:'sam'), tests.rules()) as m_b \gset
select tests.sign_out();

select short_number as social_no from public.tbl_matches where id = :'social' \gset
select short_number as a_no from public.tbl_matches where id = :'m_a' \gset

insert into public.tbl_tournament_fixtures (tournament_id, round, position, match_id) values (:'t1', 1, 1, :'m_a');
insert into public.tbl_tournament_fixtures (tournament_id, round, position) values (:'t1', 1, 2);
update public.tbl_tournament_fixtures set match_id = :'m_b' where tournament_id = :'t1' and position = 2;

select ok(:'social_no'::bigint >= 1000, 'a social match has a number of four digits or more');
select is(public.tdc_short_link('match', :'social') ->> 'code', :'social_no', 'and shows it');
select is((public.tdc_short_link('match', :'social') ->> 'can_change')::boolean, false, 'nobody can change a match''s code');
select is(public.tdc_short_link('match', :'m_b') ->> 'code', 'T-BC26-2', 'a tournament match carries the code and the next number');
select is(public.tdc_resolve_short_code(:'social_no') ->> 'path', '/match/?id=' || :'social', 'a social match opens by its number');
select is(public.tdc_resolve_short_code(:'a_no') ->> 'reason', 'not_found', 'a competition match does not open by the plain number');
select is(public.tdc_resolve_short_code('T-BC26-2') ->> 'path', '/match/?id=' || :'m_b', 'a tournament match opens by its code');
select is(public.tdc_resolve_short_code('T-BC26-9') ->> 'reason', 'no_such_match', 'a number not given out says so');

delete from public.tbl_tournament_fixtures where tournament_id = :'t1' and position = 2;
select tests.sign_in(:'dee');
select public.tdc_create_match(tests.player_of(:'pat'), tests.rules()) as m_c \gset
select tests.sign_out();
insert into public.tbl_tournament_fixtures (tournament_id, round, position, match_id) values (:'t1', 1, 3, :'m_c');
select is(public.tdc_short_link('match', :'m_c') ->> 'code', 'T-BC26-3', 'a number is never given out twice');

-- ─── Leagues ───

select tests.sign_in_anon();
select is(public.tdc_resolve_short_code('L-BCDAM') ->> 'path', '/leagues/join/?s=' || :'s1', 'signed out: the join page');
select tests.sign_out();

select tests.sign_in(:'dee');
select is(public.tdc_resolve_short_code('L-BCDAM') ->> 'path', '/leagues/season/?s=' || :'s1', 'whoever runs it: the season');
select public.tdc_set_short_code('league', :'l2', 'EMPTY');
select is(public.tdc_resolve_short_code('L-EMPTY') ->> 'reason', 'no_season', 'a league with no season says so');

select public.tdc_create_team(:'s1', 'Alpha') as ta \gset
select public.tdc_create_team(:'s1', 'Bravo') as tb \gset
select public.tdc_add_league_entrant(:'s1', tests.player_of(:'pat'), :'ta', true);
select public.tdc_add_league_entrant(:'s1', tests.player_of(:'sam'), :'tb', true);
select public.tdc_generate_league_fixtures(:'s1');
select tests.sign_out();

select id as lf from public.tbl_league_fixtures where league_season_id = :'s1' and away_team_id is not null order by round, position limit 1 \gset
select tests.sign_in(:'dee');
select public.tdc_create_league_match(:'lf') as lm \gset
select tests.sign_out();

select is(public.tdc_short_link('match', :'lm') ->> 'code', 'L-BCDAM-1', 'a league match carries the code and a number');
select is(public.tdc_resolve_short_code('L-BCDAM-1') ->> 'path', '/leagues/card/?m=' || :'lm', 'and opens its card');
select is(public.tdc_resolve_short_code('L-BCDAM-2') ->> 'reason', 'no_such_match', 'a number not given out says so');

select tests.sign_in(:'pat');
select is(public.tdc_resolve_short_code('L-BCDAM') ->> 'path', '/leagues/season/?s=' || :'s1', 'a player in the season: the season page');
select tests.sign_out();

select tests.create_user('Link Joe') as joe \gset
select tests.sign_in(:'joe');
select is(public.tdc_resolve_short_code('L-BCDAM') ->> 'path', '/leagues/join/?s=' || :'s1', 'signed in, not part of it: the join page');
select tests.sign_out();

select tests.sign_in(:'dee');
select public.tdc_create_league_season(:'l1', 'Second') as s2 \gset
select tests.sign_out();
update public.tbl_league_seasons set created_at = now() + interval '1 day' where id = :'s2';

select is(public.tdc_resolve_short_code('L-BCDAM') ->> 'path', '/leagues/join/?s=' || :'s2', 'a league''s code follows its newest season');
select is(public.tdc_resolve_short_code('L-BCDAM-1') ->> 'path', '/leagues/card/?m=' || :'lm', 'and an old season''s match still opens');

-- ─── Nonsense ───

select is(public.tdc_resolve_short_code('https://evil.example') ->> 'reason', 'invalid', 'an address is not a code');
select is(public.tdc_resolve_short_code('../../staff') ->> 'reason', 'invalid', 'nor is a path');
select is(public.tdc_resolve_short_code(''' or 1=1 --') ->> 'reason', 'invalid', 'nor is SQL');
select is(public.tdc_resolve_short_code(null) ->> 'reason', 'invalid', 'nor is nothing');
select is(public.tdc_resolve_short_code('T-ABCDEFGHJKLMNPQRSTVWXYZ') ->> 'reason', 'invalid', 'nor is something too long');
select is(public.tdc_resolve_short_code('X-BC26') ->> 'reason', 'invalid', 'only T and L start a code');

select * from finish();
rollback;
