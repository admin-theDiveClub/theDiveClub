-- The device manager (migration 20261128132115).
--
-- UV, 28 Nov: a list of everywhere the account is signed in, each with Sign
-- out, plus "Sign out everywhere else"; a TV signed in by QR names the phone
-- that allowed it; a sign-in unused for 30 days is signed out.
begin;
\ir _helpers.psql
select plan(29);

select tests.create_user('Dm Ann') as ann \gset
select tests.create_user('Dm Bob') as bob \gset

-- Acting as an account on one particular sign-in (the JWT's session_id).
create function pg_temp.as_session(p_user uuid, p_session uuid)
returns void
language plpgsql
as $$
begin
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_session)::text, true);
end;
$$;

-- Ann's phone (in use), laptop, an old tablet, and Bob's phone.
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, user_agent, ip) values
	('a0000000-0000-0000-0000-000000000001', :'ann', now() - interval '5 days', now() - interval '1 hour', null,
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', '196.21.4.7'),
	('a0000000-0000-0000-0000-000000000002', :'ann', now() - interval '2 days', now() - interval '2 days', (now() - interval '3 hours') at time zone 'UTC',
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', '41.13.2.9'),
	('a0000000-0000-0000-0000-000000000003', :'ann', now() - interval '60 days', now() - interval '40 days', null,
		'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', '41.13.2.10'),
	('b0000000-0000-0000-0000-000000000001', :'bob', now() - interval '1 day', now() - interval '1 day', null,
		'Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile Safari/537.36', '102.1.1.1');

-- ─── Signed out: nothing ───

select tests.sign_in_anon();
select throws_ok($$ select public.tdc_my_sessions() $$, '42501', null, 'signed out: no list');
select throws_ok($$ select public.tdc_sign_out_session('a0000000-0000-0000-0000-000000000002') $$, '42501', null, 'signed out: cannot sign out a session');
select throws_ok($$ select public.tdc_sign_out_other_sessions() $$, '42501', null, 'signed out: cannot sign out the others');
select throws_ok($$ select public.tdc_device_login_link('x') $$, '42501', null, 'signed out: cannot link');
select tests.sign_out();
select tests.sign_in(:'ann');
select throws_ok($$ select * from public.tbl_device_sessions $$, '42501', null, 'signed in: the TV labels table is refused');
select tests.sign_out();

-- ─── A TV signed in by QR from Ann's phone ───

set local role service_role;
select public.tdc_device_login_start('tv-secret-dm-' || repeat('x', 30), 'Samsung Internet on Samsung TV') as s1 \gset
reset role;
select pg_temp.as_session(:'ann', 'a0000000-0000-0000-0000-000000000001');
select lives_ok(format('select public.tdc_device_login_answer(%L, true)', :'s1'::jsonb ->> 'code'), 'Ann allows the TV from her phone');
select tests.sign_out();
select is((select approved_session_id from public.tbl_device_logins where code = :'s1'::jsonb ->> 'code'),
	'a0000000-0000-0000-0000-000000000001'::uuid, 'Allow records the phone''s session');
set local role service_role;
select is(public.tdc_device_login_collect('tv-secret-dm-' || repeat('x', 30)) ->> 'state', 'approved', 'the TV collects');
reset role;

-- The TV's new session (made by verifyOtp).
insert into auth.sessions (id, user_id, created_at, updated_at, user_agent, ip) values
	('a0000000-0000-0000-0000-000000000004', :'ann', now(), now(), 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) SamsungBrowser/5.0 TV Safari/537.36', '196.21.4.8');

select pg_temp.as_session(:'bob', 'b0000000-0000-0000-0000-000000000001');
select throws_ok(format('select public.tdc_device_login_link(%L)', 'tv-secret-dm-' || repeat('x', 30)),
	'TDC (Error): this device''s sign-in request was not found.', 'another account cannot link Ann''s request');
select tests.sign_out();
select pg_temp.as_session(:'ann', 'a0000000-0000-0000-0000-000000000002');
select throws_ok(format('select public.tdc_device_login_link(%L)', 'tv-secret-dm-' || repeat('x', 30)),
	'TDC (Error): this sign-in is not the one the phone allowed.', 'an older sign-in cannot be labelled the TV');
select tests.sign_out();
select pg_temp.as_session(:'ann', 'a0000000-0000-0000-0000-000000000004');
select throws_ok($$ select public.tdc_device_login_link('wrong-secret') $$,
	'TDC (Error): this device''s sign-in request was not found.', 'a wrong secret links nothing');
select lives_ok(format('select public.tdc_device_login_link(%L)', 'tv-secret-dm-' || repeat('x', 30)), 'the TV links its own session');
select lives_ok(format('select public.tdc_device_login_link(%L)', 'tv-secret-dm-' || repeat('x', 30)), 'linking twice does no harm');
select tests.sign_out();

-- ─── The list ───

select pg_temp.as_session(:'ann', 'a0000000-0000-0000-0000-000000000001');
select public.tdc_my_sessions() as list \gset
select tests.sign_out();
select is(jsonb_array_length(:'list'::jsonb), 3, 'Ann sees her phone, laptop and TV: not the tablet unused 40 days, not Bob''s');
select is(:'list'::jsonb -> 0 ->> 'id', 'a0000000-0000-0000-0000-000000000001', 'this device first');
select is((:'list'::jsonb -> 0 ->> 'current')::boolean, true, 'marked as this device');
select is(:'list'::jsonb -> 1 ->> 'id', 'a0000000-0000-0000-0000-000000000004', 'then the most recently used');
select is(:'list'::jsonb -> 1 -> 'qr' ->> 'device', 'Samsung Internet on Samsung TV', 'the TV is marked as signed in by QR');
select ok((:'list'::jsonb -> 1 -> 'qr' ->> 'allowed_by_user_agent') like '%iPhone%', 'naming the phone that allowed it');
select is(:'list'::jsonb -> 2 ->> 'ip', '41.13.2.9', 'with the IP');
select ok((:'list'::jsonb -> 2 ->> 'last_used_at')::timestamptz > now() - interval '4 hours', 'last used counts the latest refresh');

-- ─── Signing out ───

select pg_temp.as_session(:'ann', 'a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.tdc_sign_out_session('a0000000-0000-0000-0000-000000000001') $$,
	'That is the device you are using. Use Log out to sign out here.', 'this device is signed out with Log out');
select throws_ok($$ select public.tdc_sign_out_session('b0000000-0000-0000-0000-000000000001') $$,
	'That sign-in was not found. It may already be signed out.', 'Ann cannot sign out Bob');
select lives_ok($$ select public.tdc_sign_out_session('a0000000-0000-0000-0000-000000000004') $$, 'Ann signs out the TV');
select tests.sign_out();
select ok(not exists (select 1 from auth.sessions where id = 'a0000000-0000-0000-0000-000000000004')
	and not exists (select 1 from public.tbl_device_sessions where session_id = 'a0000000-0000-0000-0000-000000000004'),
	'the TV''s session and its label are gone');

select pg_temp.as_session(:'ann', 'a0000000-0000-0000-0000-000000000001');
select is(public.tdc_sign_out_other_sessions(), 2, 'Sign out everywhere else: the laptop and the old tablet');
select tests.sign_out();
select is((select array_agg(id order by id) from auth.sessions where user_id in (:'ann', :'bob')),
	array['a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001']::uuid[],
	'Ann''s phone and Bob''s phone are still signed in');

-- ─── Unused for 30 days ───

insert into auth.sessions (id, user_id, created_at, updated_at) values
	('b0000000-0000-0000-0000-000000000002', :'bob', now() - interval '45 days', now() - interval '31 days');
insert into public.tbl_device_sessions (session_id, user_id, device, allowed_at)
	values ('b0000000-0000-0000-0000-000000000009', :'bob', 'Chrome on Windows', now());
select is(private.tdc_clear_unused_sessions(), 1, 'the nightly job signs out the session unused 31 days');
select ok(exists (select 1 from auth.sessions where id = 'b0000000-0000-0000-0000-000000000001')
	and not exists (select 1 from public.tbl_device_sessions where session_id = 'b0000000-0000-0000-0000-000000000009'),
	'keeps the one in use, and forgets a label whose session has gone');

select * from finish();
rollback;
