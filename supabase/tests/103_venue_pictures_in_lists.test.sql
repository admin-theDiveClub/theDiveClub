-- A venue's picture wherever a venue is shown (migration 20261124190347, UV
-- 24 Nov): the venue lists carry picture_path, and the poster's snapshot with
-- them.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('Vpic Dee') as dee \gset

-- Two venues, one with a picture.
insert into public.tbl_venues (name, slug) values ('Vpic Hall', 'vpic-hall') returning id as v1 \gset
insert into public.tbl_venues (name, slug) values ('Vpic Den', 'vpic-den') returning id as v2 \gset
update public.tbl_venues set picture_path = id || '/a.webp' where id = :'v1';

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Vpic Night', tests.rules()) as t \gset
select tests.sign_out();
insert into public.tbl_tournament_venues (tournament_id, venue_id, position)
values (:'t', :'v1', 1), (:'t', :'v2', 2);

select is(private.tdc_tournament_venue_list(:'t') #>> '{0,picture_path}', :'v1' || '/a.webp', 'a venue with a picture carries its path');
select is(private.tdc_tournament_venue_list(:'t') -> 1 -> 'picture_path', 'null'::jsonb, 'one without carries null');
select is(private.tdc_tournament_venue_list(:'t') #>> '{0,name}', 'Vpic Hall', 'the name is still there');

select tests.sign_in(:'dee');
select public.tdc_publish_poster(:'t', p_include_entrants => false, p_include_draw => false, p_public => true) as snap \gset
select tests.sign_out();
select is(:'snap'::jsonb #>> '{venues,0,picture_path}', :'v1' || '/a.webp', 'the poster''s snapshot carries it');

-- A stranger reads it through the poster.
select tests.sign_in_anon();
select is((select snapshot #>> '{venues,0,picture_path}' from public.tdc_tournament_poster(:'t')), :'v1' || '/a.webp', 'a signed-out visitor reads it');
select tests.sign_out();

-- The shop page and an order carry their venue's picture beside its name.
select ok(pg_get_functiondef('public.tdc_shop(uuid)'::regprocedure) like '%''venue_picture_path'', v_venue.picture_path%', 'the shop names its venue''s picture');
select ok(pg_get_functiondef('private.tdc_shop_order_json(public.tbl_shop_orders)'::regprocedure) like '%''venue_picture_path''%', 'an order names its venue''s picture');

select * from finish();
rollback;
