-- The poster's entrants, confirmed and interested apart, with their pictures
-- (migration 20261124183008, UV 24 Nov): the snapshot, version 4, holds each
-- entrant's status and picture beside the name, in the same order, and old
-- posters are rebuilt.
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('Stat Dee') as dee \gset
select tests.create_user('Stat Ann') as p1 \gset
select tests.create_user('Stat Ben') as p2 \gset
select tests.create_user('Stat Cat') as p3 \gset

update public.tbl_players set avatar_path = id || '/a.webp' where id = tests.player_of(:'p1');

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Stat Night', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'p1'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'p2'), 'interested');
select public.tdc_add_entrant(:'t', tests.player_of(:'p3'), 'confirmed');
select tests.sign_out();
update public.tbl_tournament_entrants set status = 'withdrawn'
	where tournament_id = :'t' and player_id = tests.player_of(:'p3');

select tests.sign_in(:'dee');
select public.tdc_publish_poster(:'t', p_include_entrants => false, p_include_draw => false) as bare \gset
select public.tdc_publish_poster(:'t', p_include_entrants => true, p_include_draw => false, p_public => true) as snap \gset
select tests.sign_out();

select ok((:'snap'::jsonb ->> 'version')::integer >= 4, 'the snapshot is version 4 or later');
select is(jsonb_array_length(:'snap'::jsonb -> 'entrant_statuses'), 2, 'a status for every entrant, the withdrawn left out');

-- Each status and picture belongs to the name in the same place.
select is(
	(select count(*)::integer
	from jsonb_array_elements_text(:'snap'::jsonb -> 'entrant_ids') with ordinality d(id, i)
	join jsonb_array_elements_text(:'snap'::jsonb -> 'entrant_statuses') with ordinality s(status, j) on i = j
	join public.tbl_tournament_entrants e on e.player_id = d.id::uuid and e.tournament_id = :'t' and e.status = s.status),
	2, 'each status is the one of the player in the same place');
select is(
	(select a.path
	from jsonb_array_elements_text(:'snap'::jsonb -> 'entrant_ids') with ordinality d(id, i)
	join jsonb_array_elements(:'snap'::jsonb -> 'entrant_avatars') with ordinality a(path, j) on i = j
	where d.id::uuid = tests.player_of(:'p1')),
	to_jsonb(tests.player_of(:'p1') || '/a.webp'), 'a player with a picture carries its path');
select is(
	(select a.path
	from jsonb_array_elements_text(:'snap'::jsonb -> 'entrant_ids') with ordinality d(id, i)
	join jsonb_array_elements(:'snap'::jsonb -> 'entrant_avatars') with ordinality a(path, j) on i = j
	where d.id::uuid = tests.player_of(:'p2')),
	'null'::jsonb, 'a player without one carries null');

select ok(not (:'bare'::jsonb ? 'entrant_statuses') and not (:'bare'::jsonb ? 'entrant_avatars'),
	'left out with the names');

-- A poster built before version 4 is rebuilt by the migration's statement.
update public.tbl_tournament_posters
set snapshot = (snapshot - 'entrant_statuses' - 'entrant_avatars') || '{"version": 3}'::jsonb
where tournament_id = :'t';
update public.tbl_tournament_posters p
set snapshot     = private.tdc_poster_snapshot(p.tournament_id, p.include_entrants, p.include_draw),
	generated_at = now()
where coalesce((p.snapshot ->> 'version')::integer, 1) < 4;
select ok((select (snapshot ->> 'version')::integer from public.tbl_tournament_posters where tournament_id = :'t') >= 4,
	'an old poster is rebuilt at version 4 or later');

-- A stranger reads them through the one function open to them.
select tests.sign_in_anon();
select is((select jsonb_array_length(snapshot -> 'entrant_statuses') from public.tdc_tournament_poster(:'t')), 2,
	'a signed-out visitor reads the statuses');
select tests.sign_out();

select * from finish();
rollback;
