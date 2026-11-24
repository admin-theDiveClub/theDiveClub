-- The poster's draw cards show each side's picture (migration 20261124184220,
-- UV 24 Nov): the snapshot, version 5, holds home_avatar and away_avatar on
-- each draw entry, and old posters are rebuilt.
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('Pic Dee') as dee \gset
select tests.create_user('Pic Ann') as p1 \gset
select tests.create_user('Pic Ben') as p2 \gset

update public.tbl_players set avatar_path = id || '/a.webp' where id = tests.player_of(:'p1');

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Pic Night', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2']::uuid[]) u;
select public.tdc_generate_draw(:'t');
select public.tdc_publish_poster(:'t', p_include_entrants => true, p_include_draw => true, p_public => true) as snap \gset
select tests.sign_out();

select is((:'snap'::jsonb ->> 'version')::integer, 5, 'the snapshot is version 5');

-- The one match: whichever side Ann is on carries her picture, the other null.
select is(
	(select case when f ->> 'home_player_id' = tests.player_of(:'p1')::text then f ->> 'home_avatar' else f ->> 'away_avatar' end
	from jsonb_array_elements(:'snap'::jsonb -> 'draw') f where f ->> 'round' = '1'),
	tests.player_of(:'p1') || '/a.webp', 'a side with a picture carries its path');
select is(
	(select case when f ->> 'home_player_id' = tests.player_of(:'p2')::text then f -> 'home_avatar' else f -> 'away_avatar' end
	from jsonb_array_elements(:'snap'::jsonb -> 'draw') f where f ->> 'round' = '1'),
	'null'::jsonb, 'a side without one carries null');

-- A poster built before version 5 is rebuilt by the migration's statement.
update public.tbl_tournament_posters
set snapshot = jsonb_set(snapshot, '{version}', '4')
where tournament_id = :'t';
update public.tbl_tournament_posters p
set snapshot     = private.tdc_poster_snapshot(p.tournament_id, p.include_entrants, p.include_draw),
	generated_at = now()
where coalesce((p.snapshot ->> 'version')::integer, 1) < 5;
select is((select (snapshot ->> 'version')::integer from public.tbl_tournament_posters where tournament_id = :'t'), 5,
	'an old poster is rebuilt at version 5');

-- A stranger reads them through the one function open to them.
select tests.sign_in_anon();
select ok((select snapshot -> 'draw' -> 0 ? 'home_avatar' from public.tdc_tournament_poster(:'t')),
	'a signed-out visitor reads the pictures');
select tests.sign_out();

select * from finish();
rollback;
