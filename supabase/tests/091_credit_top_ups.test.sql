-- Buying credits (migration credit_top_ups, 24 Nov; docs/design/shop.md, Stage 1).
--
--   a venue's price is a setting (R1 a credit, 10 to 1,000 in tens, no discounts
--     at The Dive Club), changed only by its owner or admin; a discount is money off
--   a player asks for credits and gets a 4-character code; a new request cancels
--     their older waiting one; a request lasts 24 hours
--   nothing lands until staff confirm (any staff; Cash or Card; never their own),
--     and then exactly once, as a top_up ledger row linked to the request
--   the merge carries requests across
begin;
\ir _helpers.psql
select plan(59);

select tests.create_user('Top Owner') as owner \gset
select tests.create_user('Top Admin') as admin \gset
select tests.create_user('Top Staff') as staff \gset
select tests.create_user('Top Ann') as ann \gset
select tests.create_user('Top Bob') as bob \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset
select tests.player_of(:'staff') as pstaff \gset

select id as tdc from public.tbl_venues where slug = 'the-dive-club' \gset
insert into public.tbl_venues (name, slug) values ('No Credits Club', 'no-credits-club') returning id as other \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values
	(:'tdc', :'owner', 'owner'), (:'tdc', :'admin', 'admin'), (:'tdc', :'staff', 'staff');


-- ─── The price ───

select tests.sign_in(:'ann');
select is(public.tdc_credit_prices(:'tdc'),
	jsonb_build_object('venue_id', :'tdc'::uuid, 'cents_per_credit', 100, 'min_credits', 10, 'max_credits', 1000, 'step_credits', 10, 'tiers', '[]'::jsonb),
	'The Dive Club starts at R1 a credit, 10 to 1,000 in tens, no discounts');
select throws_ok(format($$ select public.tdc_credit_prices(%L) $$, :'other'),
	'This venue doesn''t sell credits online yet.', 'a venue that does not sell credits has no price');
select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_credit_prices(%L) $$, :'tdc'), '42501', null, 'signed out, the price is not readable');


-- ─── Starting a top-up ───

select tests.sign_in(:'ann');
select public.tdc_start_top_up(:'tdc', 250) as t1 \gset
select is((:'t1'::jsonb)->>'credits', '250', 'Ann asks for 250 credits');
select is((:'t1'::jsonb)->>'pay_cents', '25000', 'and pays R250');
select is((:'t1'::jsonb)->>'discount_pct', '0', 'with no discount');
select is((:'t1'::jsonb)->>'state', 'waiting', 'it is waiting');
select ok((:'t1'::jsonb)->>'code' ~ '^[2-9A-HJ-NP-Z]{4}$', 'with a 4-character code');
select ok(((:'t1'::jsonb)->>'expires_at')::timestamptz between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute',
	'that lasts 24 hours');
select is(public.tdc_my_credit_balance(:'tdc'), 0, 'nothing lands yet');

select throws_ok(format($$ select public.tdc_start_top_up(%L, 5) $$, :'tdc'),
	'Please choose between 10 and 1000 credits.', 'below the slider is refused');
select throws_ok(format($$ select public.tdc_start_top_up(%L, 1010) $$, :'tdc'),
	'Please choose between 10 and 1000 credits.', 'above it too');
select throws_ok(format($$ select public.tdc_start_top_up(%L, 255) $$, :'tdc'),
	'Please choose credits in steps of 10.', 'off the step too');
select throws_ok(format($$ select public.tdc_start_top_up(%L, 100) $$, :'other'),
	'This venue doesn''t sell credits online yet.', 'and at a venue that does not sell credits');

select public.tdc_start_top_up(:'tdc', 100) as t2 \gset
select is((select count(*)::int from public.tdc_my_top_ups(:'tdc') j where j->>'state' = 'waiting'), 1,
	'a new request leaves one waiting');
select is((select j->>'state' from public.tdc_my_top_ups(:'tdc') j where j->>'id' = (:'t1'::jsonb)->>'id'), 'cancelled',
	'the older one is cancelled');
select is((select j->>'id' from public.tdc_my_top_ups(:'tdc') j limit 1), (:'t2'::jsonb)->>'id', 'the newest is listed first');

select throws_ok($$ insert into public.tbl_credit_top_ups (venue_id, player_id, credits, cents_per_credit, gross_cents, pay_cents, code, expires_at)
	values ((select id from public.tbl_venues where slug = 'the-dive-club'), (select id from public.tbl_players limit 1), 10, 100, 1000, 0, 'AAAA', now()) $$,
	'42501', null, 'the table cannot be written directly');
select throws_ok($$ select count(*) from public.tbl_credit_top_ups $$, '42501', null, 'nor read directly');


-- ─── Staff: the list and the lookup ───

select tests.sign_in(:'staff');
select is((select count(*)::int from public.tdc_staff_top_ups(:'tdc')), 1, 'staff see the one waiting');
select is((select j->>'display_name' from public.tdc_staff_top_ups(:'tdc') j), 'Top Ann', 'with who asked');
select is(public.tdc_staff_find_top_up(:'tdc', lower((:'t2'::jsonb)->>'code'))->>'id', (:'t2'::jsonb)->>'id',
	'a typed code finds it, in any case');
select is(public.tdc_staff_find_top_up(:'tdc', 'ZZZZ'), null, 'an unknown code finds nothing');
select throws_ok(format($$ select public.tdc_staff_find_top_up(%L, '') $$, :'tdc'), 'Please enter a code.', 'an empty code is asked for');

select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_staff_top_ups(%L) $$, :'tdc'), 'You are not staff at this venue.', 'a player cannot see the list');
select throws_ok(format($$ select public.tdc_staff_find_top_up(%L, %L) $$, :'tdc', (:'t2'::jsonb)->>'code'),
	'You are not staff at this venue.', 'nor look up a code');
select throws_ok(format($$ select public.tdc_staff_confirm_top_up(%L, %L, 'cash') $$, :'tdc', (:'t2'::jsonb)->>'id'),
	'You are not staff at this venue.', 'nor confirm one');


-- ─── Confirming ───

select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_staff_confirm_top_up(%L, %L, 'eft') $$, :'tdc', (:'t2'::jsonb)->>'id'),
	'Please choose Cash or Card.', 'the method must be Cash or Card');
select throws_ok(format($$ select public.tdc_staff_confirm_top_up(%L, %L, 'cash') $$, :'tdc', (:'t1'::jsonb)->>'id'),
	'That top-up was cancelled. Ask them to start a new one.', 'a cancelled one cannot be confirmed');
select throws_ok(format($$ select public.tdc_staff_confirm_top_up(%L, %L, 'cash') $$, :'other', (:'t2'::jsonb)->>'id'),
	'You are not staff at this venue.', 'nor confirmed at another venue');
select is(public.tdc_staff_confirm_top_up(:'tdc', ((:'t2'::jsonb)->>'id')::uuid, 'card'), 100, 'staff confirm it: Ann has 100 credits');
select throws_ok(format($$ select public.tdc_staff_confirm_top_up(%L, %L, 'card') $$, :'tdc', (:'t2'::jsonb)->>'id'),
	'That top-up is already paid.', 'a second confirm is refused');

select tests.sign_out();
select is((select count(*)::int from public.tbl_credit_ledger where top_up_id = ((:'t2'::jsonb)->>'id')::uuid), 1, 'one ledger row');
select is((select entry_type || ' ' || amount || ' ' || player_id from public.tbl_credit_ledger where top_up_id = ((:'t2'::jsonb)->>'id')::uuid),
	'top_up 100 ' || :'pann', 'a top_up of 100 for Ann');
select is((select paid_method || ' ' || (paid_by = :'staff'::uuid) from public.tbl_credit_top_ups where id = ((:'t2'::jsonb)->>'id')::uuid),
	'card true', 'recording Card and who confirmed it');
select throws_ok(format($$ insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, idempotency_key, top_up_id)
	values (%L, %L, 100, 'top_up', 'top_up:again-xyz', %L) $$, :'tdc', :'pann', (:'t2'::jsonb)->>'id'),
	'23505', null, 'the database itself refuses a second landing');
select throws_ok(format($$ insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, idempotency_key)
	values (%L, %L, 100, 'top_up', 'top_up:nolink-xyz') $$, :'tdc', :'pann'),
	'23514', null, 'a top_up row must name its request');
select throws_ok(format($$ update public.tbl_credit_top_ups set status = 'waiting', paid_at = null, paid_method = null where id = %L $$, (:'t2'::jsonb)->>'id'),
	'TDC (Error): a top-up can''t be changed or deleted directly.', 'a paid request cannot be reopened, even by the database owner');

select tests.sign_in(:'ann');
select is(public.tdc_my_credit_balance(:'tdc'), 100, 'Ann sees 100 credits');
select is((select j->>'state' from public.tdc_my_top_ups(:'tdc') j limit 1), 'paid', 'and her request as paid');
select throws_ok(format($$ select public.tdc_cancel_my_top_up(%L) $$, (:'t2'::jsonb)->>'id'),
	'That top-up is already paid.', 'a paid one cannot be cancelled');


-- ─── Nobody confirms their own ───

select tests.sign_in(:'staff');
select public.tdc_start_top_up(:'tdc', 50) as ts \gset
select throws_ok(format($$ select public.tdc_staff_confirm_top_up(%L, %L, 'cash') $$, :'tdc', (:'ts'::jsonb)->>'id'),
	'You can''t confirm your own top-up. Please ask another staff member.', 'staff cannot confirm their own');
select tests.sign_in(:'owner');
select is(public.tdc_staff_confirm_top_up(:'tdc', ((:'ts'::jsonb)->>'id')::uuid, 'cash'), 50, 'the owner can confirm it');


-- ─── Cancel and expiry ───

select tests.sign_in(:'bob');
select public.tdc_start_top_up(:'tdc', 30) as tb \gset
select throws_ok(format($$ select public.tdc_cancel_my_top_up(%L) $$, (:'ts'::jsonb)->>'id'),
	'That top-up isn''t waiting any more.', 'Bob cannot cancel somebody else''s');
select is(public.tdc_cancel_my_top_up(((:'tb'::jsonb)->>'id')::uuid)->>'state', 'cancelled', 'Bob cancels his own');

select public.tdc_start_top_up(:'tdc', 40) as tx \gset
select tests.sign_out();
select set_config('tdc.top_up_write', 'on', true);
update public.tbl_credit_top_ups set expires_at = now() - interval '1 minute' where id = ((:'tx'::jsonb)->>'id')::uuid;
select set_config('tdc.top_up_write', 'off', true);

select tests.sign_in(:'bob');
select is((select j->>'state' from public.tdc_my_top_ups(:'tdc') j limit 1), 'expired', 'past 24 hours it shows as expired');
select tests.sign_in(:'staff');
select is((select count(*)::int from public.tdc_staff_top_ups(:'tdc')), 0, 'it leaves the staff list');
select is(public.tdc_staff_find_top_up(:'tdc', (:'tx'::jsonb)->>'code')->>'state', 'expired', 'the lookup says why');
select throws_ok(format($$ select public.tdc_staff_confirm_top_up(%L, %L, 'cash') $$, :'tdc', (:'tx'::jsonb)->>'id'),
	'That top-up has expired. Ask them to start a new one.', 'and it cannot be confirmed');


-- ─── Setting the price ───

select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_set_credit_prices(%L, 100, 10, 1000, 10) $$, :'tdc'),
	'Only owners and admins can set credit prices.', 'staff cannot set the price');
select tests.sign_in(:'admin');
select throws_ok(format($$ select public.tdc_set_credit_prices(%L, 100, 10, 1005, 10) $$, :'tdc'),
	'The step must fit the range exactly (from 10 to 1005 in steps of 10 doesn''t).', 'a step that does not fit is refused');
select throws_ok(format($$ select public.tdc_set_credit_prices(%L, 100, 10, 1000, 10, '[{"at": 500, "pct": 15}, {"at": 250, "pct": 10}]') $$, :'tdc'),
	'Discount steps must go up: more credits, a bigger discount.', 'discount steps must rise');
select throws_ok(format($$ select public.tdc_set_credit_prices(%L, 100, 10, 1000, 10, '[{"at": 2000, "pct": 15}]') $$, :'tdc'),
	'A discount at 2000 credits is off the slider (above 10 up to 1000, in steps of 10).', 'a step off the slider is refused');
select is(public.tdc_set_credit_prices(:'tdc', 100, 10, 1000, 10, '[{"at": 250, "pct": 10}, {"at": 500, "pct": 15}]')->'tiers',
	'[{"at": 250, "pct": 10}, {"at": 500, "pct": 15}]'::jsonb, 'an admin sets two discount steps');

select tests.sign_in(:'ann');
select public.tdc_start_top_up(:'tdc', 250) as td \gset
select is((:'td'::jsonb)->>'pay_cents', '22500', 'a discount is money off: 250 credits for R225');
select is((:'td'::jsonb)->>'discount_pct', '10', 'at 10%');
select tests.sign_in(:'admin');
select public.tdc_set_credit_prices(:'tdc', 200, 10, 1000, 10);
select tests.sign_in(:'ann');
select is((select j->>'pay_cents' from public.tdc_my_top_ups(:'tdc') j limit 1), '22500', 'a later price change leaves a waiting request as it was');


-- ─── The merge carries requests across ───

select tests.sign_out();
insert into public.tbl_players (display_name, player_type) values ('Top Walk-in', 'walk_in') returning id as walkin \gset
select private.tdc_merge_players(:'walkin', :'pann', :'ann');
select is((select count(*)::int from public.tbl_credit_top_ups where player_id = :'walkin'), 3, 'Ann''s three requests move to the kept record');
select is(private.tdc_credit_balance(:'tdc', :'walkin'), 100, 'with her credits');

select * from finish();
rollback;
