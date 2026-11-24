-- The shop, Stage 4 (migration shop_staff_orders, 24 Nov; docs/design/shop.md).
--
--   only staff at the venue see the queue; it holds the open orders, oldest first, and the
--     top-ups waiting
--   an order is found by its number (the weekday's letter), or by its id
--   staff move it on and one step back; a stale screen is told it moved already
--   Ready tells the player, under the new Shop switch
--   hand-over: only from Ready; at the club needs Cash or Card and marks it paid; never your own
--   staff cancel any open order: credits back once, the player told; never your own
--   the order's new columns hold together
begin;
\ir _helpers.psql
select plan(45);

select tests.create_user('Queue Owner') as owner \gset
select tests.create_user('Queue Sipho') as sipho \gset
select tests.create_user('Queue Ann') as ann \gset
select tests.create_user('Queue Bob') as bob \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset
select tests.player_of(:'sipho') as psipho \gset

select id as tdc from public.tbl_venues where slug = 'the-dive-club' \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values
	(:'tdc', :'owner', 'owner'), (:'tdc', :'sipho', 'staff');
select id as cafe from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Café' \gset
select id as apparel from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Apparel' \gset

select tests.sign_in(:'owner');
select public.tdc_save_shop_product(:'tdc', null, :'cafe', 'Flat white', 30, 'bar') as coffee \gset
select public.tdc_save_shop_product(:'tdc', null, :'apparel', 'Club socks', 80, 'collect') as socks \gset
select public.tdc_staff_adjust_credits(:'tdc', :'pann', 120, 'Test credits', 'test-ann-120');
select public.tdc_staff_adjust_credits(:'tdc', :'psipho', 50, 'Test credits', 'test-sipho-50');

select (now() at time zone 'Africa/Johannesburg')::date as today \gset
select chr(64 + extract(isodow from :'today'::date)::int) as letter \gset

-- Ann: coffee and socks with credits (o1). Bob: a coffee at the club (o2). Sipho: a coffee (o3).
select tests.sign_in(:'ann');
select public.tdc_set_cart_qty(:'coffee', 1);
select public.tdc_set_cart_qty(:'socks', 1);
select (public.tdc_place_order(:'tdc', 'credits', 110, 'queue-ann-1')->>'id') as o1 \gset
select tests.sign_in(:'bob');
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'club', 30, 'queue-bob-1')->>'id') as o2 \gset
select tests.sign_in(:'sipho');
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'credits', 30, 'queue-sipho-1')->>'id') as o3 \gset
-- A top-up waiting, for the queue's count.
select tests.sign_in(:'bob');
select public.tdc_start_top_up(:'tdc', 100);


-- ─── Who sees the queue ───

select tests.sign_in(:'ann');
select throws_ok(format($$ select public.tdc_staff_orders(%L) $$, :'tdc'),
	'You are not staff at this venue.', 'a player can''t see the queue');
select throws_ok(format($$ select public.tdc_staff_move_order(%L, %L, 'placed', 'preparing') $$, :'tdc', :'o1'),
	'You are not staff at this venue.', 'nor move an order');
select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_staff_orders(%L) $$, :'tdc'),
	'42501', null, 'a stranger can''t call it at all');

select tests.sign_in(:'sipho');
select public.tdc_staff_orders(:'tdc') as q \gset
select is(jsonb_array_length(:'q'::jsonb->'orders'), 3, 'staff see the three open orders');
select is(:'q'::jsonb->'orders'->0->>'id', :'o1', 'oldest first');
select is(:'q'::jsonb->'orders'->0->>'display_name', 'Queue Ann', 'with who it is for');
select is((:'q'::jsonb->>'top_ups_waiting')::int, 1, 'and the top-ups waiting');
select is((:'q'::jsonb->'orders'->2->>'is_mine')::boolean, true, 'Sipho''s own order is marked his');


-- ─── Finding an order ───

select is((select count(*)::int from public.tdc_staff_find_order(:'tdc', lower(:'letter') || ' 2')), 1, 'by its number, case and spaces ignored');
select is((select x->>'id' from public.tdc_staff_find_order(:'tdc', :'letter' || '2') x), :'o2', 'the right order');
select is((select count(*)::int from public.tdc_staff_find_order(:'tdc', :'letter' || '99')), 0, 'a number nobody has: nothing');
select is((select count(*)::int from public.tdc_staff_find_order(:'tdc', '7K4Q')), 0, 'a top-up code is not an order number');
select is(public.tdc_staff_order(:'tdc', :'o1')->>'label', :'letter' || '1', 'by its id (the QR)');


-- ─── Moving it on, and back ───

select is(public.tdc_staff_move_order(:'tdc', :'o1', 'placed', 'preparing')->>'status', 'preparing', 'Start: preparing');
select throws_ok(format($$ select public.tdc_staff_move_order(%L, %L, 'placed', 'preparing') $$, :'tdc', :'o1'),
	'Someone has moved that order already. The list is up to date now.', 'a second screen showing the old step is told');
select throws_ok(format($$ select public.tdc_staff_move_order(%L, %L, 'placed', 'ready') $$, :'tdc', :'o2'),
	'TDC (Error): an order can''t move from "placed" to "ready".', 'no skipping a step');
select throws_ok(format($$ select public.tdc_staff_move_order(%L, %L, null, 'ready') $$, :'tdc', :'o2'),
	'TDC (Error): an order can''t move from "<NULL>" to "ready".', 'a step must be named');
select is(public.tdc_staff_move_order(:'tdc', :'o1', 'preparing', 'placed')->>'status', 'placed', 'one step back');
select is(public.tdc_staff_move_order(:'tdc', :'o1', 'placed', 'preparing')->>'status', 'preparing', 'and on again');

select tests.sign_in(:'ann');
select throws_ok(format($$ select public.tdc_cancel_my_order(%L) $$, :'o1'),
	'Staff have started that order, so it can''t be cancelled here. Please ask at the bar.', 'once started, Ann can''t cancel');

select tests.sign_in(:'sipho');
select is(public.tdc_staff_move_order(:'tdc', :'o1', 'preparing', 'ready')->>'status', 'ready', 'Ready');
select tests.sign_out();
select is((select count(*)::int from public.tbl_notifications where player_id = :'pann' and kind = 'order_ready' and category = 'shop'), 1, 'Ann is told it is ready, under Shop');
select is((select title from public.tbl_notifications where player_id = :'pann' and kind = 'order_ready'), :'letter' || '1 is ready to collect', 'naming her order');


-- ─── The Shop switch ───

select tests.sign_in(:'ann');
select ok(exists (select 1 from public.tdc_notification_prefs() where category = 'shop' and push_enabled), 'Shop is a switch, on by default');
select lives_ok($$ select public.tdc_set_notification_pref('shop', false) $$, 'and can be turned off');


-- ─── Hand-over ───

select tests.sign_in(:'sipho');
select throws_ok(format($$ select public.tdc_staff_collect_order(%L, %L, 'cash') $$, :'tdc', :'o2'),
	'That order isn''t ready yet. Mark it Ready first.', 'only a Ready order is handed over');
select public.tdc_staff_move_order(:'tdc', :'o2', 'placed', 'preparing');
select public.tdc_staff_move_order(:'tdc', :'o2', 'preparing', 'ready');
select throws_ok(format($$ select public.tdc_staff_collect_order(%L, %L) $$, :'tdc', :'o2'),
	'Please choose Cash or Card.', 'at the club: Cash or Card is needed');
select public.tdc_staff_collect_order(:'tdc', :'o2', 'card') as c2 \gset
select is(:'c2'::jsonb->>'status', 'collected', 'Bob''s coffee is collected');
select is(:'c2'::jsonb->>'paid_method', 'card', 'paid by card');
select ok(:'c2'::jsonb->>'paid_at' is not null, 'and marked paid');
select throws_ok(format($$ select public.tdc_staff_collect_order(%L, %L, 'card') $$, :'tdc', :'o2'),
	'That order has been collected already.', 'not twice');
select throws_ok(format($$ select public.tdc_staff_move_order(%L, %L, 'ready', 'preparing') $$, :'tdc', :'o2'),
	'That order has been collected.', 'no step back once collected');

select is(public.tdc_staff_collect_order(:'tdc', :'o1')->>'status', 'collected', 'Ann''s credits order needs no payment');
select is(public.tdc_staff_order(:'tdc', :'o1')->>'paid_method', null, 'and records none');

select public.tdc_staff_move_order(:'tdc', :'o3', 'placed', 'preparing');
select public.tdc_staff_move_order(:'tdc', :'o3', 'preparing', 'ready');
select throws_ok(format($$ select public.tdc_staff_collect_order(%L, %L) $$, :'tdc', :'o3'),
	'You can''t hand over your own order. Please ask another staff member.', 'Sipho can''t hand over his own');
select throws_ok(format($$ select public.tdc_staff_cancel_order(%L, %L) $$, :'tdc', :'o3'),
	'You can''t cancel your own order here. Please ask another staff member.', 'nor cancel it');
select tests.sign_out();
select is((select count(*)::int from public.tbl_notifications where player_id = :'psipho' and kind = 'order_ready'), 0, 'and isn''t told what he did himself');


-- ─── Staff cancel (out of stock) ───

-- Ann has 10 credits left after o1; the owner adds 100, and she orders socks (80).
select tests.sign_in(:'owner');
select public.tdc_staff_adjust_credits(:'tdc', :'pann', 100, 'Test credits', 'test-ann-100');
select tests.sign_in(:'ann');
select public.tdc_set_cart_qty(:'socks', 1);
select (public.tdc_place_order(:'tdc', 'credits', 80, 'queue-ann-2')->>'id') as o4 \gset
select is(public.tdc_my_credit_balance(:'tdc'), 30, 'Ann has 30 left after the socks');

select tests.sign_in(:'sipho');
select public.tdc_staff_move_order(:'tdc', :'o4', 'placed', 'preparing');
select is(public.tdc_staff_cancel_order(:'tdc', :'o4')->>'status', 'cancelled', 'staff cancel an order being prepared');
select throws_ok(format($$ select public.tdc_staff_cancel_order(%L, %L) $$, :'tdc', :'o4'),
	'That order is already cancelled.', 'not twice');
select throws_ok(format($$ select public.tdc_staff_cancel_order(%L, %L) $$, :'tdc', :'o1'),
	'That order has been collected, so it can''t be cancelled.', 'nor a collected one');

select tests.sign_in(:'ann');
select is(public.tdc_my_credit_balance(:'tdc'), 110, 'Ann''s 80 credits come back, once');
select tests.sign_out();
select is((select body from public.tbl_notifications where player_id = :'pann' and kind = 'order_cancelled'),
	'80 credits are back in your account.', 'and she is told');


-- ─── The columns hold together ───

select set_config('tdc.order_write', 'on', true);
select throws_ok(format($$ update public.tbl_shop_orders set paid_method = 'cash' where id = %L $$, :'o1'),
	'23514', null, 'cash or card only on an order paid at the club');
select throws_ok(format($$ update public.tbl_shop_orders set status = 'collected' where id = %L $$, :'o3'),
	'23514', null, 'collected needs its time');
select set_config('tdc.order_write', 'off', true);

select * from finish();
rollback;
