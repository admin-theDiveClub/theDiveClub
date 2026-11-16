-- The home page's cards (migration 20261116132606, UV 16 Nov 2026).
--
-- tdc_home_cards: signed out, only what has been made public (a listed league
-- season; a listed tournament with a public poster), never a hidden one;
-- signed in, only the person's own leagues, tournaments and matches, active
-- first, at most six, six and five, and never a match they only refereed.
begin;
\ir _helpers.psql
select plan(16);

select tests.create_user('Home Dee') as dee \gset
select tests.create_user('Home Pat') as pat \gset
select tests.create_user('Home Sam') as sam \gset
select tests.create_user('Home Ref') as ref \gset
select tests.player_of(:'pat') as ppat \gset
select tests.player_of(:'sam') as psam \gset
select tests.player_of(:'ref') as pref \gset

-- Two leagues by Dee, one listed; two tournaments, one listed.
select tests.sign_in(:'dee');
select public.tdc_create_league('Home Listed League', tests.rules('{"team_size": 2}')) as l1 \gset
select public.tdc_create_league_season(:'l1', 'Spring') as s1 \gset
select public.tdc_create_league('Home Hidden League', tests.rules('{"team_size": 2}')) as l2 \gset
select public.tdc_create_league_season(:'l2', 'Spring') as s2 \gset
select public.tdc_create_tournament('Home Listed Cup', tests.rules(),
	p_entry_mode => 'interested', p_is_listed => true) as t1 \gset
select public.tdc_create_tournament('Home Hidden Cup', tests.rules(),
	p_entry_mode => 'interested') as t2 \gset
select tests.sign_out();
update public.tbl_league_seasons set is_listed = true where id = :'s1';
update public.tbl_league_seasons set is_listed = false where id = :'s2';

-- Pat plays Sam twice (one finished, one being played); Ref referees a third.
select tests.sign_in(:'pat');
select public.tdc_create_match(:'psam', tests.rules()) as m_old \gset
select public.tdc_create_match(:'psam', tests.rules()) as m_live \gset
select tests.sign_out();
update public.tbl_matches set status = 'complete', started_at = now() - interval '2 days' where id = :'m_old';
update public.tbl_matches set status = 'in_progress', started_at = now() - interval '3 days' where id = :'m_live';
update public.tbl_matches set referee_player_id = :'pref' where id = :'m_old';

-- ─── Signed out ───

select tests.sign_in_anon();
select lives_ok($$ select public.tdc_home_cards() $$, 'signed out: anyone may read it');
select public.tdc_home_cards() as anon \gset
select tests.sign_out();

select is((:'anon'::jsonb ->> 'signed_in')::boolean, false, 'signed out: says so');
select ok((:'anon'::jsonb -> 'leagues') @> jsonb_build_array(jsonb_build_object('league_season_id', :'s1')),
	'signed out: a listed season is shown');
select ok(not ((:'anon'::jsonb -> 'leagues') @> jsonb_build_array(jsonb_build_object('league_season_id', :'s2'))),
	'signed out: a hidden season is not');
select ok((:'anon'::jsonb -> 'tournaments') @> jsonb_build_array(jsonb_build_object('id', :'t1')),
	'signed out: a listed tournament is shown');
select ok(not ((:'anon'::jsonb -> 'tournaments') @> jsonb_build_array(jsonb_build_object('id', :'t2'))),
	'signed out: a hidden tournament is not');
select is(jsonb_array_length(:'anon'::jsonb -> 'matches'), 0, 'signed out: no matches');

-- A listed tournament whose poster is no longer shared is not shown: its link
-- would lead nowhere.
update public.tbl_tournament_posters set is_public = false where tournament_id = :'t1';
select tests.sign_in_anon();
select ok(not ((public.tdc_home_cards() -> 'tournaments') @> jsonb_build_array(jsonb_build_object('id', :'t1'))),
	'signed out: a listed tournament without a public poster is not shown');
select tests.sign_out();
update public.tbl_tournament_posters set is_public = true where tournament_id = :'t1';

-- ─── Signed in ───

select tests.sign_in(:'dee');
select public.tdc_home_cards() as dee_cards \gset
select tests.sign_out();
select is(jsonb_array_length(:'dee_cards'::jsonb -> 'leagues'), 2, 'the director: both their leagues, the hidden one too');
select is(jsonb_array_length(:'dee_cards'::jsonb -> 'tournaments'), 2, 'the director: both their tournaments');

select tests.sign_in(:'pat');
select public.tdc_home_cards() as pat_cards \gset
select tests.sign_out();
select is((:'pat_cards'::jsonb ->> 'signed_in')::boolean, true, 'signed in: says so');
select is(jsonb_array_length(:'pat_cards'::jsonb -> 'leagues'), 0, 'a player in no league: none, not the public ones');
select is(jsonb_array_length(:'pat_cards'::jsonb -> 'matches'), 2, 'a player: both their matches');
select is(:'pat_cards'::jsonb -> 'matches' -> 0 ->> 'id', :'m_live',
	'active first: the match being played leads, though it is older');
select is(:'pat_cards'::jsonb -> 'matches' -> 0 ->> 'opponent_kind', 'player', 'the opponent is a player');

select tests.sign_in(:'ref');
select is(jsonb_array_length(public.tdc_home_cards() -> 'matches'), 0, 'a match only refereed is not one played');
select tests.sign_out();

select * from finish();
rollback;
