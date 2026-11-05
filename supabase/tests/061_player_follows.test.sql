-- Following a player (migration player_follows, UV 5 Nov).
--
--   one-way, no approval: following is done at once, for one direction only
--   saying what is already so is not an error
--   you cannot follow yourself, or nobody
--   private: the table cannot be read, and the one read answers only for the
--     person asking
--   the merge carries both directions, keeps no duplicates and leaves nobody
--     following themselves
begin;
\ir _helpers.psql
select plan(18);

select tests.create_user('Follow Ann') as ann \gset
select tests.create_user('Follow Bob') as bob \gset
select tests.create_user('Follow Cas') as cas \gset
select tests.create_user('Follow Sam') as sam \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset
select tests.player_of(:'cas') as pcas \gset
select tests.player_of(:'sam') as psam \gset

-- ─── Following ───

select tests.sign_in(:'ann');
select is(public.tdc_i_follow(:'pbob'), false, 'nobody is followed to begin with');
select is(public.tdc_set_follow(:'pbob', true), true, 'following says so');
select is(public.tdc_i_follow(:'pbob'), true, 'and it is done at once');
select lives_ok(format($$ select public.tdc_set_follow(%L, true) $$, :'pbob'), 'following twice is not an error');
select tests.sign_out();
select is((select count(*)::int from public.tbl_player_follows where follower_id = :'pann'), 1, 'and makes one row');
select tests.sign_in(:'ann');

select throws_like(format($$ select public.tdc_set_follow(%L, true) $$, :'pann'), '%cannot follow yourself%', 'not yourself');
select throws_like(format($$ select public.tdc_set_follow(%L, true) $$, gen_random_uuid()), '%not on here%', 'not nobody');

-- ─── Private ───

select tests.sign_in(:'bob');
select is(public.tdc_i_follow(:'pann'), false, 'following is one-way');
select throws_like($$ select * from public.tbl_player_follows $$, '%permission denied%', 'a player cannot read the table');
select tests.sign_out();
select ok(not has_function_privilege('anon', 'public.tdc_i_follow(uuid)', 'execute'), 'nor can anon ask');
select ok(not has_function_privilege('anon', 'public.tdc_set_follow(uuid, boolean)', 'execute'), 'or follow');

-- ─── Stopping ───

select tests.sign_in(:'ann');
select is(public.tdc_set_follow(:'pbob', false), false, 'stopping says so');
select is(public.tdc_i_follow(:'pbob'), false, 'and it is done');
select lives_ok(format($$ select public.tdc_set_follow(%L, false) $$, :'pbob'), 'stopping twice is not an error');

-- ─── The merge ───
-- A walk-in is followed by Ann and Cas. Sam's signup record, about to become
-- that walk-in, is followed by Ann and Bob, follows Cas, and follows the
-- walk-in itself.

select tests.sign_out();
insert into public.tbl_players (display_name, player_type) values ('Follow Walk-in', 'walk_in') returning id as walkin \gset
insert into public.tbl_player_follows (follower_id, followed_id) values
	(:'pann', :'walkin'), (:'pcas', :'walkin'),
	(:'pann', :'psam'), (:'pbob', :'psam'),
	(:'psam', :'pcas'), (:'psam', :'walkin');

select private.tdc_merge_players(:'walkin', :'psam', :'sam');

select is((select count(*)::int from public.tbl_player_follows where :'psam' in (follower_id, followed_id)), 0, 'nothing is left on the signup record');
select set_eq(
	format($$ select follower_id from public.tbl_player_follows where followed_id = %L $$, :'walkin'),
	format($$ values (%L::uuid), (%L::uuid), (%L::uuid) $$, :'pann', :'pcas', :'pbob'),
	'everyone following either record follows the one left, once each');
select set_eq(
	format($$ select followed_id from public.tbl_player_follows where follower_id = %L $$, :'walkin'),
	format($$ values (%L::uuid) $$, :'pcas'),
	'who the account followed comes with it');
select is((select count(*)::int from public.tbl_player_follows where follower_id = followed_id), 0, 'and nobody follows themselves');

select * from finish();
rollback;
