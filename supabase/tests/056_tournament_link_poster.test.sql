-- tdc_my_tournaments says whether this account can open the poster
-- (migration 20261105162834), so a card never sends somebody to "Nothing here".
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('Link Dee') as dee \gset
select tests.create_user('Link P1') as p1 \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Link Night', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'p1'), 'confirmed');
select tests.sign_out();

-- No poster yet: nobody can open one.
select tests.sign_in(:'p1');
select is((select poster_open from public.tdc_my_tournaments() where id = :'t'), false, 'no poster: the player cannot open one');
select tests.sign_out();
select tests.sign_in(:'dee');
select is((select poster_open from public.tdc_my_tournaments() where id = :'t'), false, 'no poster: nor can the director');

-- Built, not shared: the director can, the player cannot.
select public.tdc_publish_poster(:'t');
select is((select poster_open from public.tdc_my_tournaments() where id = :'t'), true, 'an unshared poster opens for the director');
select tests.sign_out();
select tests.sign_in(:'p1');
select is((select poster_open from public.tdc_my_tournaments() where id = :'t'), false, 'but not for the player');
select tests.sign_out();

-- Shared: the player can.
select tests.sign_in(:'dee');
select public.tdc_publish_poster(:'t', p_public => true);
select tests.sign_out();
select tests.sign_in(:'p1');
select is((select poster_open from public.tdc_my_tournaments() where id = :'t'), true, 'a shared poster opens for the player');
select tests.sign_out();

select * from finish();
rollback;
