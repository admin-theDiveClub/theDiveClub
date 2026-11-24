-- Posters built before player ids are rebuilt once (migration 20261124173925,
-- UV 24 Nov). The migration ran at reset, before any poster here existed, so
-- this runs its statement again on a poster made old by hand: the ids arrive,
-- and the sharing and the choices stay as they were.
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('Rebuild Dee') as dee \gset
select tests.create_user('Rebuild Ann') as p1 \gset
select tests.create_user('Rebuild Ben') as p2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Rebuild Night', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(u), 'confirmed')
	from unnest(array[:'p1', :'p2']::uuid[]) u;
select public.tdc_publish_poster(:'t', p_include_entrants => true, p_include_draw => false, p_public => true);
select tests.sign_out();

-- As a poster built before 20261124172239 was: version 2, no ids.
update public.tbl_tournament_posters
set snapshot = (snapshot - 'entrant_ids') || jsonb_build_object('version', 2,
		'officials', (select jsonb_agg(o - 'player_id') from jsonb_array_elements(snapshot -> 'officials') o)),
	generated_at = now() - interval '2 hours'
where tournament_id = :'t';

-- The migration's statement.
update public.tbl_tournament_posters p
set snapshot     = private.tdc_poster_snapshot(p.tournament_id, p.include_entrants, p.include_draw),
	generated_at = now()
where coalesce((p.snapshot ->> 'version')::integer, 1) < 3;

select is((select (snapshot ->> 'version')::integer from public.tbl_tournament_posters where tournament_id = :'t'), 3, 'the old poster is rebuilt at version 3');
select is((select snapshot #>> '{officials,0,player_id}' from public.tbl_tournament_posters where tournament_id = :'t'), tests.player_of(:'dee')::text, 'its director has their player id');
select is((select jsonb_array_length(snapshot -> 'entrant_ids') from public.tbl_tournament_posters where tournament_id = :'t'), 2, 'its entrants have theirs');
select ok((select is_public from public.tbl_tournament_posters where tournament_id = :'t'), 'it is still shared');
select ok((select include_entrants and not include_draw from public.tbl_tournament_posters where tournament_id = :'t'), 'with its own choices: names, no draw');
select ok(not (select snapshot ? 'draw' from public.tbl_tournament_posters where tournament_id = :'t'), 'so the draw is still left out');

select * from finish();
rollback;
