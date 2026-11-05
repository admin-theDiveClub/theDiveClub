-- The players I follow (tdc_my_follows, UV 5 Nov).
--
--   lists whom I follow, by name, and nobody else
--   it is my list only: nobody else's follows, and nothing about who follows me
--   stopping takes them off it
--   anon may not call it
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('Listed Ann') as ann \gset
select tests.create_user('Listed Bob') as bob \gset
select tests.create_user('Listed Cas') as cas \gset
select tests.create_user('Listed Dee') as dee \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset
select tests.player_of(:'cas') as pcas \gset
select tests.player_of(:'dee') as pdee \gset

create function pg_temp.names() returns text language sql as $$
	select string_agg(display_name, ',') from public.tdc_my_follows()
$$;

update public.tbl_players set first_name = 'Robert', last_name = 'Listed' where id = :'pbob';

select tests.sign_in(:'ann');
select is(pg_temp.names(), null, 'nobody to begin with');

select public.tdc_set_follow(:'pcas', true);
select public.tdc_set_follow(:'pbob', true);
select is(pg_temp.names(), 'Listed Bob,Listed Cas', 'whom I follow, by name');
select is((select player_id from public.tdc_my_follows() where display_name = 'Listed Bob'), :'pbob'::uuid, 'each with the id its link needs');
select is((select full_name from public.tdc_my_follows() where display_name = 'Listed Bob'), 'Robert Listed', 'and the full name');

select tests.sign_in(:'bob');
select is(pg_temp.names(), null, 'being followed puts nobody on my list');

select tests.sign_in(:'dee');
select is(pg_temp.names(), null, 'nor does somebody else''s following');

select tests.sign_in(:'ann');
select public.tdc_set_follow(:'pbob', false);
select is(pg_temp.names(), 'Listed Cas', 'stopping takes them off it');

select tests.sign_out();
select ok(not has_function_privilege('anon', 'public.tdc_my_follows()', 'execute'), 'anon may not call it');

select * from finish();
rollback;
