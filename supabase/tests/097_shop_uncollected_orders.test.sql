-- The shop: the nightly job for uncollected orders (migration shop_uncollected_orders, 24 Nov).
--
--   merch past its 30 days is cancelled, whatever step it is at; credits paid come back once
--   café only, placed on an earlier day at the club, is cancelled; today's stays
--   paid at the club: cancelled, nothing returned
--   collected and future orders are left alone; a second run does nothing
--   the job is scheduled, and nobody on the site can run it
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('Night Owner') as owner \gset
select tests.create_user('Night Ann') as ann \gset
select tests.create_user('Night Bob') as bob \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset

select id as tdc from public.tbl_venues where slug = 'the-dive-club' \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'tdc', :'owner', 'owner');
select id as cafe from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Café' \gset
select id as apparel from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Apparel' \gset

select tests.sign_in(:'owner');
select public.tdc_save_shop_product(:'tdc', null, :'cafe', 'Flat white', 30, 'bar') as coffee \gset
select public.tdc_save_shop_product(:'tdc', null, :'apparel', 'Club socks', 80, 'collect') as socks \gset
select public.tdc_staff_adjust_credits(:'tdc', :'pann', 300, 'Test credits', 'night-ann-300');

-- Ann: old socks (o1), yesterday's coffee (o2), today's coffee (o4), new socks (o5).
-- Bob: yesterday's coffee at the club (o3), and one collected yesterday (o6).
select tests.sign_in(:'ann');
select public.tdc_set_cart_qty(:'socks', 1);
select (public.tdc_place_order(:'tdc', 'credits', 80, 'night-ann-o1')->>'id') as o1 \gset
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'credits', 30, 'night-ann-o2')->>'id') as o2 \gset
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'credits', 30, 'night-ann-o4')->>'id') as o4 \gset
select public.tdc_set_cart_qty(:'socks', 1);
select (public.tdc_place_order(:'tdc', 'credits', 80, 'night-ann-o5')->>'id') as o5 \gset
select tests.sign_in(:'bob');
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'club', 30, 'night-bob-o3')->>'id') as o3 \gset
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'club', 30, 'night-bob-o6')->>'id') as o6 \gset

-- Back-date them, as time passing would.
select tests.sign_out();
select set_config('tdc.order_write', 'on', true);
update public.tbl_shop_orders set placed_at = now() - interval '31 days', collect_by = now() - interval '1 day', status = 'ready' where id = :'o1';
update public.tbl_shop_orders set order_day = order_day - 1 where id in (:'o2', :'o3', :'o6');
update public.tbl_shop_orders set status = 'collected', collected_at = now() - interval '1 day', paid_at = now() - interval '1 day', paid_method = 'cash' where id = :'o6';
select set_config('tdc.order_write', 'off', true);

select tests.sign_in(:'ann');
select is(public.tdc_my_credit_balance(:'tdc'), 80, 'Ann has 80 left before the night');


-- ─── The night ───

select tests.sign_out();
select is(private.tdc_cancel_uncollected_orders(), 3, 'three orders are cancelled');
select is((select status from public.tbl_shop_orders where id = :'o1'), 'cancelled', 'socks past 30 days, though Ready');
select is((select status from public.tbl_shop_orders where id = :'o2'), 'cancelled', 'yesterday''s coffee');
select is((select status from public.tbl_shop_orders where id = :'o3'), 'cancelled', 'yesterday''s coffee at the club');
select is((select status from public.tbl_shop_orders where id = :'o4'), 'placed', 'today''s coffee stays');
select is((select status from public.tbl_shop_orders where id = :'o5'), 'placed', 'socks inside their 30 days stay');
select is((select status from public.tbl_shop_orders where id = :'o6'), 'collected', 'a collected order is left alone');
select is(private.tdc_credit_balance(:'tdc', :'pann'), 190, 'Ann''s 80 and 30 credits come back');
select is((select reason from public.tbl_credit_ledger where order_id = :'o1' and entry_type = 'order_refund'), 'Not collected in time', 'with the reason');
select is((select count(*)::int from public.tbl_credit_ledger where player_id = :'pbob'), 0, 'Bob paid nothing, so nothing comes back');
select is(private.tdc_cancel_uncollected_orders(), 0, 'a second run does nothing');

select ok(exists (select 1 from cron.job where jobname = 'tdc-cancel-uncollected-orders' and schedule = '0 2 * * *'), 'it runs every night at 02:00 UTC (04:00 at the club)');

select tests.sign_in(:'ann');
select throws_ok($$ select private.tdc_cancel_uncollected_orders() $$, '42501', null, 'nobody on the site can run it');

select * from finish();
rollback;
