-- Signing in a TV with a phone (migration 20261128123827).
--
-- UV, 28 Nov: the login page shows a QR and a code; a signed-in phone allows
-- it; the TV signs in. The secret collects, the code only answers; a code
-- may be allowed for 60 s; an approval is collected once.
begin;
\ir _helpers.psql
select plan(23);

select tests.create_user('Dev Ann') as ann \gset
select tests.create_user('Dev Bob') as bob \gset
select email as ann_email from auth.users where id = :'ann' \gset

-- ─── Only the edge function (service role) starts and collects ───

select tests.sign_in_anon();
select throws_ok($$ select public.tdc_device_login_start(repeat('a', 43), 'Chrome on Windows') $$, '42501', null, 'signed out: cannot start');
select throws_ok($$ select public.tdc_device_login_collect(repeat('a', 43)) $$, '42501', null, 'signed out: cannot collect');
select throws_ok($$ select public.tdc_device_login_view('ABCDEFGH') $$, '42501', null, 'signed out: cannot view');
select throws_ok($$ select * from public.tbl_device_logins $$, '42501', null, 'signed out: the table is refused');
select tests.sign_out();

select tests.sign_in(:'ann');
select throws_ok($$ select public.tdc_device_login_start(repeat('a', 43), 'x') $$, '42501', null, 'signed in: cannot start either');
select throws_ok($$ select public.tdc_device_login_collect(repeat('a', 43)) $$, '42501', null, 'signed in: cannot collect either');
select throws_ok($$ select * from public.tbl_device_logins $$, '42501', null, 'signed in: the table is refused');
select tests.sign_out();

set local role service_role;
select public.tdc_device_login_start('tv-secret-one-' || repeat('x', 29), 'Samsung Internet on Samsung TV') as s1 \gset
select public.tdc_device_login_start('tv-secret-two-' || repeat('x', 29), 'Chrome on Windows') as s2 \gset
select throws_ok($$ select public.tdc_device_login_start('short', 'x') $$, 'TDC (Error): the device''s secret is missing or the wrong length.', 'a short secret is refused');
select is(public.tdc_device_login_collect('tv-secret-one-' || repeat('x', 29)) ->> 'state', 'waiting', 'nobody has answered yet');
select is(public.tdc_device_login_collect('not-the-secret-' || repeat('x', 28)) ->> 'state', 'unknown', 'a wrong secret collects nothing');
reset role;

select ok((:'s1'::jsonb ->> 'code') ~ '^[A-HJ-NP-Z2-9]{8}$', 'an 8-letter code with no 0, O, 1 or I');
select ok((select expires_at = created_at + interval '60 seconds'
	from public.tbl_device_logins where code = :'s1'::jsonb ->> 'code'), 'a code may be allowed for 60 s (shown for 30)');
select ok(not exists (select 1 from public.tbl_device_logins where secret_hash like 'tv-secret%'), 'the secret itself is never kept');

-- ─── The phone ───

select tests.sign_in(:'ann');
-- Typed in small letters with a dash, as somebody might.
select is(public.tdc_device_login_view(lower(left(:'s1'::jsonb ->> 'code', 4) || '-' || right(:'s1'::jsonb ->> 'code', 4))) ->> 'device',
	'Samsung Internet on Samsung TV', 'the phone sees which device, the code typed loosely');
select is(public.tdc_device_login_view('ZZZZZZZZ'), null, 'nothing for a code that is not there');
select lives_ok(format('select public.tdc_device_login_answer(%L, true)', :'s1'::jsonb ->> 'code'), 'Ann allows the TV');
select throws_ok(format('select public.tdc_device_login_answer(%L, true)', :'s1'::jsonb ->> 'code'),
	'That code has already been answered. The screen will show a new one.', 'a code is answered once');
select lives_ok(format('select public.tdc_device_login_answer(%L, false)', :'s2'::jsonb ->> 'code'), 'Ann cancels the other');
select tests.sign_out();

set local role service_role;
select public.tdc_device_login_collect('tv-secret-one-' || repeat('x', 29)) as c1 \gset
select is(:'c1'::jsonb ->> 'user_id', :'ann'::text, 'the TV collects Ann''s sign-in');
select is(:'c1'::jsonb ->> 'email', :'ann_email'::text, 'with her email, for the one-time token');
select is(public.tdc_device_login_collect('tv-secret-one-' || repeat('x', 29)) ->> 'state', 'used', 'and only once');
select is(public.tdc_device_login_collect('tv-secret-two-' || repeat('x', 29)) ->> 'state', 'refused', 'the cancelled one is refused');
reset role;

-- ─── A code that has run out ───

update public.tbl_device_logins set expires_at = now() - interval '1 second' where code = :'s2'::jsonb ->> 'code';
set local role service_role;
select public.tdc_device_login_start('tv-secret-old-' || repeat('x', 29), 'Chrome on Mac') as s3 \gset
reset role;
update public.tbl_device_logins set expires_at = now() - interval '1 second' where code = :'s3'::jsonb ->> 'code';
select tests.sign_in(:'bob');
select throws_ok(format('select public.tdc_device_login_answer(%L, true)', :'s3'::jsonb ->> 'code'),
	'That code has run out. The screen shows a new one: scan it again.', 'a code past its 60 s cannot be allowed');
select tests.sign_out();

select * from finish();
rollback;
