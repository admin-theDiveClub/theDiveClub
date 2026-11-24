-- The shop, Stage 3 (migration shop_orders, 24 Nov; docs/design/shop.md).
--
--   an order is placed from the cart's lines that are on, paid with credits (taken at once)
--     or at the club (unpaid); a line switched off stays in the cart
--   the total the page showed must still be right; credits must cover it
--   a double tap returns the same order and charges once
--   names and prices are frozen onto the lines, the price per credit onto the order
--   numbered per venue per day behind the weekday's letter (A = Monday), club time
--   merch sets collect within 30 days; café only does not
--   a player sees and cancels only their own, and only while placed; credits come back once
--   the rows refuse direct changes; the ledger refuses a second charge or refund
--   the merge carries the orders across
begin;
\ir _helpers.psql
select plan(42);

select tests.create_user('Order Owner') as owner \gset
select tests.create_user('Order Ann') as ann \gset
select tests.create_user('Order Bob') as bob \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset

select id as tdc from public.tbl_venues where slug = 'the-dive-club' \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'tdc', :'owner', 'owner');
select id as cafe from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Café' \gset
select id as apparel from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Apparel' \gset

select tests.sign_in(:'owner');
select public.tdc_save_shop_product(:'tdc', null, :'cafe', 'Flat white', 30, 'bar') as coffee \gset
select public.tdc_save_shop_product(:'tdc', null, :'cafe', 'Rooibos tea', 20, 'bar') as tea \gset
select public.tdc_save_shop_product(:'tdc', null, :'apparel', 'Club socks', 80, 'collect') as socks \gset
select public.tdc_staff_adjust_credits(:'tdc', :'pann', 120, 'Test credits', 'test-ann-120');

-- Today at the club, and its weekday letter.
select (now() at time zone 'Africa/Johannesburg')::date as today \gset
select chr(64 + extract(isodow from :'today'::date)::int) as letter \gset


-- ─── Refusals before anything is placed ───

select tests.sign_in(:'ann');
select throws_ok(format($$ select public.tdc_place_order(%L, 'credits', 0, 'ann-key-empty') $$, :'tdc'),
	'Your cart is empty.', 'an empty cart is refused');

select public.tdc_set_cart_qty(:'coffee', 1);
select public.tdc_set_cart_qty(:'socks', 1);
select throws_ok(format($$ select public.tdc_place_order(%L, 'credits', 100, 'ann-key-wrong') $$, :'tdc'),
	'Your cart or a price has changed. Please check your order and place it again.', 'a total that no longer matches is refused');
select throws_ok(format($$ select public.tdc_place_order(%L, 'cash', 110, 'ann-key-cash') $$, :'tdc'),
	'Please choose how to pay: credits, or at the club.', 'only credits or at the club');
select throws_ok(format($$ select public.tdc_place_order(%L, 'credits', 110, 'short') $$, :'tdc'),
	'TDC (Error): missing or invalid idempotency key.', 'a key is needed');

select tests.sign_in(:'bob');
select public.tdc_set_cart_qty(:'coffee', 1);
select throws_ok(format($$ select public.tdc_place_order(%L, 'credits', 30, 'bob-key-credits') $$, :'tdc'),
	'You have 0 credits; this order needs 30.', 'credits must cover the order');

select tests.sign_in_anon();
select throws_ok(format($$ select public.tdc_place_order(%L, 'club', 30, 'anon-key-1') $$, :'tdc'),
	'42501', null, 'a stranger cannot order');


-- ─── Ann pays with credits ───

select tests.sign_in(:'ann');
select public.tdc_place_order(:'tdc', 'credits', 110, 'ann-key-1') as o1 \gset
select (:'o1'::jsonb->>'id') as o1id \gset

select is(:'o1'::jsonb->>'status', 'placed', 'the order is placed');
select is(:'o1'::jsonb->>'label', :'letter' || '1', 'the first today, behind the weekday''s letter');
select is((:'o1'::jsonb->>'order_day')::date, :'today'::date, 'on today''s date at the club');
select is((:'o1'::jsonb->>'total_credits')::int, 110, '110 credits');
select is((:'o1'::jsonb->>'pay_cents')::int, 11000, 'R110 at today''s price');
select ok(:'o1'::jsonb->>'paid_at' is not null, 'paid with credits at once');
select ok((:'o1'::jsonb->>'collect_by')::timestamptz > now() + interval '29 days', 'socks: collect within 30 days');
select is(jsonb_array_length(:'o1'::jsonb->'lines'), 2, 'two lines');
select is((:'o1'::jsonb->'lines'->0->>'name'), 'Flat white', 'café first, as the shop orders its tabs');
select is(public.tdc_my_credit_balance(:'tdc'), 10, 'the credits are taken');
select is((public.tdc_my_cart(:'tdc')->>'count')::int, 0, 'and the cart is empty');

select is(public.tdc_place_order(:'tdc', 'credits', 110, 'ann-key-1')->>'id', :'o1id', 'the same attempt again returns the same order');
select is(public.tdc_my_credit_balance(:'tdc'), 10, 'and charges nothing more');


-- ─── Bob pays at the club ───

select tests.sign_in(:'bob');
select public.tdc_place_order(:'tdc', 'club', 30, 'bob-key-club') as o2 \gset
select (:'o2'::jsonb->>'id') as o2id \gset
select is(:'o2'::jsonb->>'label', :'letter' || '2', 'the next number today');
select ok(:'o2'::jsonb->>'paid_at' is null, 'paid at the club: unpaid until hand-over');
select ok(:'o2'::jsonb->>'collect_by' is null, 'café only: no collection window');
select is(public.tdc_my_credit_balance(:'tdc'), 0, 'no credits taken');

select throws_ok(format($$ select public.tdc_my_order(%L) $$, :'o1id'), 'That order isn''t one of yours.', 'Bob cannot see Ann''s order');
select throws_ok(format($$ select public.tdc_cancel_my_order(%L) $$, :'o1id'), 'That order isn''t one of yours.', 'nor cancel it');
select is((select count(*)::int from public.tdc_my_orders(:'tdc')), 1, 'Bob''s list holds only his');


-- ─── Frozen onto the order ───

select tests.sign_in(:'owner');
select public.tdc_save_shop_product(:'tdc', :'coffee', :'cafe', 'Large flat white', 40, 'bar');
select tests.sign_in(:'ann');
select is(public.tdc_my_order(:'o1id')->'lines'->0->>'name', 'Flat white', 'a later rename leaves the order''s line alone');
select is((public.tdc_my_order(:'o1id')->'lines'->0->>'price_credits')::int, 30, 'and a later price too');


-- ─── Ann cancels ───

select is(public.tdc_cancel_my_order(:'o1id')->>'status', 'cancelled', 'Ann cancels while it is placed');
select is(public.tdc_my_credit_balance(:'tdc'), 120, 'her 110 credits come back');
select is((public.tdc_my_order(:'o1id')->>'can_cancel')::boolean, false, 'it can''t be cancelled again');
select throws_ok(format($$ select public.tdc_cancel_my_order(%L) $$, :'o1id'), 'That order is already cancelled.', 'a second cancel is refused');
select is(public.tdc_my_credit_balance(:'tdc'), 120, 'and pays nothing more');


-- ─── Once staff have started it ───

select tests.sign_out();
select set_config('tdc.order_write', 'on', true);
update public.tbl_shop_orders set status = 'preparing' where id = :'o2id';
select set_config('tdc.order_write', 'off', true);
select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_cancel_my_order(%L) $$, :'o2id'),
	'Staff have started that order, so it can''t be cancelled here. Please ask at the bar.', 'once preparing, the player can''t cancel');


-- ─── A line switched off stays in the cart ───

select tests.sign_in(:'ann');
select public.tdc_set_cart_qty(:'tea', 2);
select public.tdc_set_cart_qty(:'coffee', 1);
select tests.sign_in(:'owner');
select public.tdc_set_shop_product_active(:'tea', false);
select tests.sign_in(:'ann');
select public.tdc_place_order(:'tdc', 'club', 40, 'ann-key-2') as o3 \gset
select is(jsonb_array_length(:'o3'::jsonb->'lines'), 1, 'only the line that is on is ordered, at today''s price');
select tests.sign_out();
select is((select qty from public.tbl_shop_cart_items where player_id = :'pann' and product_id = :'tea'), 2, 'the tea stays in the cart');


-- ─── The rows and the ledger hold ───

select tests.sign_out();
select throws_ok(format($$ update public.tbl_shop_orders set total_credits = 1 where id = %L $$, :'o2id'),
	'TDC (Error): an order can''t be changed or deleted directly.', 'an order can''t be edited directly');
select throws_ok(format($$ delete from public.tbl_shop_order_lines where order_id = %L $$, :'o1id'),
	'TDC (Error): an order''s lines can''t be changed or deleted.', 'nor its lines');
select throws_ok(format($$ insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, idempotency_key, order_id)
	values (%L, %L, 110, 'order_refund', 'second-refund-1', %L) $$, :'tdc', :'pann', :'o1id'),
	'23505', null, 'the ledger refuses a second refund for one order');
select throws_ok(format($$ insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, idempotency_key)
	values (%L, %L, -5, 'order', 'unlinked-order-1') $$, :'tdc', :'pann'),
	'23514', null, 'an order entry must name its order');


-- ─── The merge carries the orders ───

insert into public.tbl_players (display_name, player_type) values ('Order Walk-in', 'walk_in') returning id as walkin \gset
select private.tdc_merge_players(:'walkin', :'pann', :'ann');
select is((select count(*)::int from public.tbl_shop_orders where player_id = :'walkin'), 2, 'Ann''s orders move to the kept record');
select is(private.tdc_credit_balance(:'tdc', :'walkin'), 120, 'with her credits');

select * from finish();
rollback;
