-- The poster holds third place, round rules and who runs it (migration
-- 20261105160712). Still only through the snapshot: a stranger reads them
-- once the poster is shared, and never a player id.
begin;
\ir _helpers.psql
select plan(11);

select tests.create_user('Poster Dee') as dee \gset
select tests.create_user('Poster P1') as p1 \gset
select tests.create_user('Poster P2') as p2 \gset
select tests.create_user('Poster P3') as p3 \gset
select tests.create_user('Poster P4') as p4 \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Poster Night', tests.rules()) as t \gset
select public.tdc_update_tournament(:'t', p_third_place => true);
select public.tdc_add_entrant(:'t', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2', :'p3', :'p4']::uuid[]) u;
select public.tdc_generate_draw(:'t');
-- The final (round 2 of 2) is a race to 7.
select public.tdc_set_round_rules(:'t', 2, tests.rules('{"win_condition_target": 7}'), p_apply => true);
select public.tdc_publish_poster(:'t', p_public => true) as snap \gset
select tests.sign_out();

select is((:'snap'::jsonb ->> 'version')::integer, 2, 'the snapshot is version 2');
select is((:'snap'::jsonb ->> 'third_place')::boolean, true, 'it says there is a third-place playoff');
select is((:'snap'::jsonb ->> 'rounds')::integer, 2, 'it knows the main bracket has two rounds');
select is(jsonb_array_length(:'snap'::jsonb -> 'round_rules'), 1, 'one round has rules of its own');
select is((:'snap'::jsonb #>> '{round_rules,0,rules,win_condition_target}')::integer, 7, 'the final is a race to 7');
select ok(not (:'snap'::jsonb #> '{round_rules,0,rules}') ? 'approval_mode', 'round rules go through the player-facing filter');
select ok((:'snap'::jsonb -> 'rules') ? 'track_breaks', 'whether breaks are recorded is on the poster');
select is(:'snap'::jsonb #>> '{officials,0,name}', 'Poster Dee', 'the director is named');
select is(:'snap'::jsonb #>> '{officials,0,role}', 'Tournament director', 'with the role in words');
select ok(not (:'snap'::jsonb #> '{officials,0}') ? 'player_id', 'and no player id');

-- A stranger reads it through the one function open to them.
select tests.sign_in_anon();
select is((select (snapshot ->> 'third_place')::boolean from public.tdc_tournament_poster(:'t')), true, 'a signed-out visitor reads the new keys');
select tests.sign_out();

select * from finish();
rollback;
