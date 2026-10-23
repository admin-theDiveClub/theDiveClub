-- The harness itself: helpers load, signing in is seen by auth.uid() and by
-- private.tdc_me(), and the roles really change.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('Harness One') as u1 \gset
select isnt(tests.player_of(:'u1'), null, 'signing up makes a player row');

select tests.sign_in(:'u1');
select is(auth.uid(), :'u1'::uuid, 'auth.uid() is the signed-in account');
select is(current_user::text, 'authenticated', 'signed in as the authenticated role');
select is((select display_name from public.tbl_players where user_id = auth.uid()), 'Harness One', 'a signed-in user can read their own player row');

select tests.sign_in_anon();
select is(auth.uid(), null, 'anon has no user');
select throws_ok('select * from public.tbl_players', '42501', null, 'anon cannot read players directly');

select tests.sign_out();
select is(current_user::text, 'postgres', 'signed out returns to postgres');

select * from finish();
rollback;
