-- The poster is a live page (migration 20261124210356, UV 24 Nov): what
-- tdc_tournament_poster returns is built when it is read, with the names and
-- the draw always in, for a signed-out visitor as for anyone; the sharing gate
-- is unchanged.
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('Live Dee') as dee \gset
select tests.create_user('Live Ann') as p1 \gset
select tests.create_user('Live Ben') as p2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Live Night', tests.rules()) as t \gset
-- Built and shared with names and the draw left out, before anyone entered.
select public.tdc_publish_poster(:'t', p_include_entrants => false, p_include_draw => false, p_public => true);
select public.tdc_add_entrant(:'t', tests.player_of(:'p1'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'p2'), 'interested');
select tests.sign_out();

select tests.sign_in_anon();
select is((select (snapshot #>> '{entrants,total}')::integer from public.tdc_tournament_poster(:'t')), 2,
	'a signed-out visitor sees entrants who came after the poster was made');
select is((select jsonb_array_length(snapshot -> 'entrant_names') from public.tdc_tournament_poster(:'t')), 2,
	'with their names, though the poster was made without');
select ok((select snapshot ? 'draw' from public.tdc_tournament_poster(:'t')),
	'and the draw');
select tests.sign_out();

-- A status changes: the poster shows it at once.
update public.tbl_tournament_entrants set status = 'withdrawn' where tournament_id = :'t' and player_id = tests.player_of(:'p2');
select tests.sign_in_anon();
select is((select (snapshot #>> '{entrants,total}')::integer from public.tdc_tournament_poster(:'t')), 1,
	'someone withdrawn leaves it at once');
select ok((select generated_at > now() - interval '1 minute' from public.tdc_tournament_poster(:'t')),
	'it is as of the moment it is read');
select tests.sign_out();

-- The gate is unchanged: a private poster shows nothing to a stranger, and its
-- director still sees it.
update public.tbl_tournament_posters set is_public = false where tournament_id = :'t';
select tests.sign_in_anon();
select is((select count(*)::integer from public.tdc_tournament_poster(:'t')), 0,
	'a private poster shows a stranger nothing');
select tests.sign_out();
select tests.sign_in(:'dee');
select is((select (snapshot #>> '{entrants,total}')::integer from public.tdc_tournament_poster(:'t')), 1,
	'its director still sees it, live');
select tests.sign_out();

delete from public.tbl_tournament_posters where tournament_id = :'t';
select tests.sign_in(:'dee');
select is((select count(*)::integer from public.tdc_tournament_poster(:'t')), 0,
	'no poster, nothing');
select tests.sign_out();

select * from finish();
rollback;
