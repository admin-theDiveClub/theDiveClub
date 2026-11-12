-- Surnames sent on their own (migration surnames_apart, UV 12 Nov).
--
-- The page draws a surname in a lower weight than the first name, so each
-- read that sends a full name also sends the surname alone. A first name of
-- two words is why: "Mary Anne Smith" cannot be split at a space.
--
--   the surname comes alone, next to the full name it ends
--   no surname: null, and the full name is unchanged
--   the draw carries one for each side
--   the dropped and recreated reads are still closed to anon
begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('Sur Ann') as ann \gset
select tests.create_user('Sur Bob') as bob \gset
select tests.create_user('Sur Dee') as dee \gset

update public.tbl_players set first_name = 'Mary Anne', last_name = 'van der Merwe' where id = tests.player_of(:'ann');
update public.tbl_players set first_name = 'Bob', last_name = null where id = tests.player_of(:'bob');

select tests.sign_in(:'dee');
select is((select surname from public.tdc_search_opponents('Sur Ann', 5)), 'van der Merwe', 'opponent search: the surname alone');
select is((select full_name from public.tdc_search_opponents('Sur Ann', 5)), 'Mary Anne van der Merwe', 'beside the full name it ends');
select is((select surname from public.tdc_search_opponents('Sur Bob', 5)), null, 'no surname: null');
select is((select full_name from public.tdc_search_opponents('Sur Bob', 5)), 'Bob', 'and the full name as before');
select is((select surname from public.tdc_search_referees('Sur Ann', 5)), 'van der Merwe', 'referee search: the surname');

select public.tdc_set_follow(tests.player_of(:'ann'), true);
select is((select surname from public.tdc_my_follows()), 'van der Merwe', 'my follows: the surname');
select is((public.tdc_player_profile(tests.player_of(:'ann')) -> 'player' ->> 'surname'), 'van der Merwe', 'the profile: the surname');

select public.tdc_create_tournament('Sur Draw', tests.rules()) as t \gset
select is((select surname from public.tdc_search_entrants(:'t', 'Sur Ann', 5)), 'van der Merwe', 'entrant search: the surname');
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed');
select public.tdc_generate_draw(:'t');
-- Seeds settle Ann first by name, so she is home.
select is((select home_surname || '|' || coalesce(away_surname, 'none') from public.tdc_tournament_draw(:'t') where round = 1),
	'van der Merwe|none', 'the draw: a surname for each side');

select tests.sign_out();
select ok(not has_function_privilege('anon', 'public.tdc_search_opponents(text, integer)', 'execute'), 'anon still may not search opponents');
select ok(not has_function_privilege('anon', 'public.tdc_tournament_draw(uuid)', 'execute'), 'nor read the draw');
select ok(has_function_privilege('authenticated', 'public.tdc_search_league_players(uuid, text, integer)', 'execute'), 'a signed-in player still may');

select * from finish();
rollback;
