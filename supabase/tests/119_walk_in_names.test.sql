-- Walk-in names from a pasted list: letters only, made neat (migration
-- 20261128125413, UV 28 Nov). Each name is sent on its own, so a name the
-- clean-up has already made comes back "already entered", still showing
-- what it was made.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('Wn Dee') as dee \gset
select tests.sign_in(:'dee');
select public.tdc_create_tournament('Names Night', tests.rules()) as t \gset

create function pg_temp.made(p_tournament uuid, p_line text) returns text
language sql as $$
	select coalesce(string_agg(name, '|'), '(dropped)') from public.tdc_add_walk_in_entrants(p_tournament, array[p_line])
$$;

-- UV's examples: all four are UV.
select is(pg_temp.made(:'t', '4) UV'), 'UV', '"4) UV" is UV');
select is(pg_temp.made(:'t', '4. UV'), 'UV', '"4. UV" is UV');
select is(pg_temp.made(:'t', '4 UV420'), 'UV', '"4 UV420" is UV');
select is(pg_temp.made(:'t', '420UV'), 'UV', '"420UV" is UV');

-- Neat: one space, a capital to start each word, the rest as typed.
select is(pg_temp.made(:'t', '  jo   smith 🎱'), 'Jo Smith', 'emoji and spaces off, each word capitalised');
select is(pg_temp.made(:'t', 'Jo.Smith!!'), 'Jo Smith', 'a symbol between words leaves a space');
select is(pg_temp.made(:'t', 'mcDonald'), 'McDonald', 'only the first letter is changed');

-- Apostrophes and hyphens inside a name stay; at a word's edge they go.
select is(pg_temp.made(:'t', 'o’brien'), 'O''brien', 'a curly apostrophe is made straight and kept');
select is(pg_temp.made(:'t', 'Jean-Luc'), 'Jean-Luc', 'a hyphen inside a name is kept');
select is(pg_temp.made(:'t', '- Kim - ''Lee'''), 'Kim Lee', 'a stray hyphen or quote is taken off');

-- Letters from any language.
select is(pg_temp.made(:'t', 'émile núñez'), 'Émile Núñez', 'accented letters are kept and capitalised');

-- Nothing left: dropped, as a blank line.
select is(pg_temp.made(:'t', '123'), '(dropped)', 'a line of digits is dropped');
select is(pg_temp.made(:'t', '🎱 - .'), '(dropped)', 'a line of symbols is dropped');

select tests.sign_out();
select is((select string_agg(p.display_name, '|' order by p.display_name collate "C")
	from public.tbl_tournament_entrants e join public.tbl_players p on p.id = e.player_id
	where e.tournament_id = :'t'), 'Jean-Luc|Jo Smith|Kim Lee|McDonald|O''brien|UV|Émile Núñez',
	'seven walk-ins entered, each once');

select * from finish();
rollback;
