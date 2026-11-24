-- The poster's players open their profiles (migration 20261124172239, UV 24 Nov):
-- the snapshot, version 3, holds each official's, entrant's and draw side's
-- player id, read by a stranger through the one function open to them.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('Ids Dee') as dee \gset
select tests.create_user('Ids Ann') as p1 \gset
select tests.create_user('Ids Ben') as p2 \gset
select tests.create_user('Ids Cat') as p3 \gset
select tests.create_user('Ids Dan') as p4 \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Ids Night', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2', :'p3', :'p4']::uuid[]) u;
select public.tdc_generate_draw(:'t');
select public.tdc_publish_poster(:'t', p_include_entrants => true, p_include_draw => true, p_public => true) as snap \gset
-- Built without names or the draw: no ids for them either.
select public.tdc_publish_poster(:'t', p_include_entrants => false, p_include_draw => false) as bare \gset
select public.tdc_publish_poster(:'t', p_include_entrants => true, p_include_draw => true) as snap2 \gset
select tests.sign_out();

select ok((:'snap'::jsonb ->> 'version')::integer >= 3, 'the snapshot is version 3 or later');
select is(:'snap'::jsonb #>> '{officials,0,player_id}', tests.player_of(:'dee')::text, 'the director carries their player id');

select is(jsonb_array_length(:'snap'::jsonb -> 'entrant_ids'), 4, 'an id for every entrant');
-- Each id belongs to the name in the same place.
select is(
	(select count(*)::integer
	from jsonb_array_elements_text(:'snap'::jsonb -> 'entrant_names') with ordinality n(name, i)
	join jsonb_array_elements_text(:'snap'::jsonb -> 'entrant_ids') with ordinality d(id, j) on i = j
	join public.tbl_players p on p.id = d.id::uuid and p.display_name = n.name),
	4, 'each id is the player named in the same place');

select is(
	(select count(*)::integer from jsonb_array_elements(:'snap'::jsonb -> 'draw') f
	where f ->> 'home_player_id' is not null and f ->> 'away_player_id' is not null and f ->> 'round' = '1'),
	2, 'both sides of each first-round match carry their player id');
select ok(
	(select bool_and(f ->> 'home_player_id' is null) from jsonb_array_elements(:'snap'::jsonb -> 'draw') f where f ->> 'round' = '2'),
	'a side not yet decided has none');

select ok(not (:'bare'::jsonb ? 'entrant_ids') and not (:'bare'::jsonb ? 'draw'), 'left out with the names and the draw');
select ok(:'snap2'::jsonb ? 'entrant_ids', 'and back when they are included again');

-- A stranger reads them through the one function open to them.
select tests.sign_in_anon();
select is((select snapshot #>> '{officials,0,player_id}' from public.tdc_tournament_poster(:'t')), tests.player_of(:'dee')::text, 'a signed-out visitor reads the ids');
select tests.sign_out();

select * from finish();
rollback;
