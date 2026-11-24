-- The shop, Stage 5: receipt emails (migration shop_receipt_emails, 24 Nov; docs/design/shop.md).
--
--   each step queues its email: placed, ready, collected, cancelled (by the player, by staff, by
--     the nightly job), a top-up confirmed; preparing sends nothing
--   the switches: all five on by default, each turned off on its own; off queues nothing
--   no email for an address never confirmed
--   what the email is built from: the lines, who cancelled, credits back, the balance
--   the sweep: only the server claims; a claimed row is not handed out twice; sent, retried, failed
--   over a day old is skipped
--   the nightly job also tells the player in the tray
--   the merge moves the switches and the queue
--   who may call what
begin;
\ir _helpers.psql
-- The sweep runs as the server's role; let it step back out through the helpers (rolled back).
grant usage on schema tests to service_role;
grant execute on all functions in schema tests to service_role;
select plan(46);

select tests.create_user('Mail Owner') as owner \gset
select tests.create_user('Mail Sipho') as sipho \gset
select tests.create_user('Mail Ann') as ann \gset
select tests.create_user('Mail Bob') as bob \gset
select tests.create_user('Mail Carl', false) as carl \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'bob') as pbob \gset
select tests.player_of(:'carl') as pcarl \gset
select email::text as ann_email from auth.users where id = :'ann' \gset

select id as tdc from public.tbl_venues where slug = 'the-dive-club' \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values
	(:'tdc', :'owner', 'owner'), (:'tdc', :'sipho', 'staff');
select id as cafe from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Café' \gset
select id as apparel from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Apparel' \gset

select tests.sign_in(:'owner');
select public.tdc_save_shop_product(:'tdc', null, :'cafe', 'Flat white', 30, 'bar') as coffee \gset
select public.tdc_save_shop_product(:'tdc', null, :'apparel', 'Club socks', 80, 'collect') as socks \gset
select public.tdc_staff_adjust_credits(:'tdc', :'pann', 300, 'Test credits', 'mail-ann-300');


-- ─── The switches ───

select tests.sign_in(:'ann');
select public.tdc_email_prefs() as prefs \gset
select is(jsonb_array_length(:'prefs'::jsonb->'prefs'), 5, 'five emails on the profile');
select is((select count(*)::int from jsonb_array_elements(:'prefs'::jsonb->'prefs') x where (x->>'enabled')::boolean), 5, 'all on by default');
select is(:'prefs'::jsonb->'prefs'->0->>'kind', 'top_up_paid', 'credits added first');
select is(:'prefs'::jsonb->>'email', :'ann_email', 'with the address they go to');
select lives_ok($$ select public.tdc_set_email_pref('order_ready', false) $$, 'Ann turns Ready off');
select is((select (x->>'enabled')::boolean from jsonb_array_elements(public.tdc_email_prefs()->'prefs') x where x->>'kind' = 'order_ready'), false, 'and it reads off');
select throws_ok($$ select public.tdc_set_email_pref('order_lost', false) $$, 'TDC (Error): unknown email "order_lost".', 'an unknown email is refused');
select throws_ok($$ select public.tdc_set_email_pref('order_placed', null) $$, 'TDC (Error): an email setting is on or off.', 'on or off, nothing else');


-- ─── Each step ───

-- Ann: coffee and socks with credits (o1).
select public.tdc_set_cart_qty(:'coffee', 1);
select public.tdc_set_cart_qty(:'socks', 1);
select (public.tdc_place_order(:'tdc', 'credits', 110, 'mail-ann-1')->>'id') as o1 \gset
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where order_id = :'o1' and kind = 'order_placed' and status = 'waiting'), 1, 'Place order queues "placed"');

select tests.sign_in(:'sipho');
select public.tdc_staff_move_order(:'tdc', :'o1', 'placed', 'preparing');
select public.tdc_staff_move_order(:'tdc', :'o1', 'preparing', 'ready');
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where order_id = :'o1'), 1, 'preparing sends nothing, and Ready nothing with Ann''s switch off');
select is((select count(*)::int from public.tbl_notifications where player_id = :'pann' and kind = 'order_ready'), 1, 'the push and tray are not touched by it');

select tests.sign_in(:'sipho');
select public.tdc_staff_collect_order(:'tdc', :'o1', null);
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where order_id = :'o1' and kind = 'order_collected'), 1, 'handed over queues the receipt');

-- Bob: a coffee at the club (o2), Ready (his switch on), then cancelled by staff.
select tests.sign_in(:'bob');
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'club', 30, 'mail-bob-1')->>'id') as o2 \gset
select tests.sign_in(:'sipho');
select public.tdc_staff_move_order(:'tdc', :'o2', 'placed', 'preparing');
select public.tdc_staff_move_order(:'tdc', :'o2', 'preparing', 'ready');
select public.tdc_staff_cancel_order(:'tdc', :'o2');
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where order_id = :'o2' and kind = 'order_ready'), 1, 'Bob''s Ready queues "ready"');
select is((select count(*)::int from public.tbl_shop_emails where order_id = :'o2' and kind = 'order_cancelled'), 1, 'staff cancel queues "cancelled"');
select is(private.tdc_shop_email_payload('order_cancelled', :'pbob', :'o2', null)->>'cancelled_by', 'club', 'saying the club cancelled it');
select is((private.tdc_shop_email_payload('order_cancelled', :'pbob', :'o2', null)->>'refunded')::boolean, false, 'nothing to give back at the club');

-- Ann cancels her own (o3).
select tests.sign_in(:'ann');
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'credits', 30, 'mail-ann-3')->>'id') as o3 \gset
select public.tdc_cancel_my_order(:'o3');
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where order_id = :'o3' and kind = 'order_cancelled'), 1, 'cancelling your own queues "cancelled"');
select is(private.tdc_shop_email_payload('order_cancelled', :'pann', :'o3', null)->>'cancelled_by', 'you', 'saying you cancelled it');
select is((private.tdc_shop_email_payload('order_cancelled', :'pann', :'o3', null)->>'refunded')::boolean, true, 'with the credits back');

-- What the placed email is built from.
select private.tdc_shop_email_payload('order_placed', :'pann', :'o1', null) as pay1 \gset
select is(jsonb_array_length(:'pay1'::jsonb->'lines'), 2, 'the order''s lines');
select is(:'pay1'::jsonb->>'venue_name', 'The Dive Club', 'where to collect');
select is(:'pay1'::jsonb->>'first_name', null, 'the name as the player has it (none set here)');
select is(:'pay1'::jsonb->>'display_name', 'Mail Ann', 'and the display name to fall back on');

-- A top-up confirmed (Bob, 100 credits).
select tests.sign_in(:'bob');
select (public.tdc_start_top_up(:'tdc', 100)->>'id') as t1 \gset
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where top_up_id = :'t1'), 0, 'asking for credits sends nothing');
select tests.sign_in(:'sipho');
select public.tdc_staff_confirm_top_up(:'tdc', :'t1', 'cash');
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where top_up_id = :'t1' and kind = 'top_up_paid'), 1, 'confirming it queues "credits added"');
select is((private.tdc_shop_email_payload('top_up_paid', :'pbob', null, :'t1')->>'balance')::int, 100, 'with the new balance');
select is(private.tdc_shop_email_payload('top_up_paid', :'pbob', null, :'t1')->>'paid_method', 'cash', 'and how it was paid');

-- Carl never confirmed his address.
select tests.sign_in(:'carl');
select public.tdc_set_cart_qty(:'coffee', 1);
select (public.tdc_place_order(:'tdc', 'club', 30, 'mail-carl-1')->>'id') as o4 \gset
select tests.sign_out();
select is((select count(*)::int from public.tbl_shop_emails where player_id = :'pcarl'), 0, 'no email to an address never confirmed');


-- ─── Who may call what ───

select tests.sign_in_anon();
select throws_ok($$ select public.tdc_email_prefs() $$, '42501', null, 'a stranger has no switches');
select tests.sign_in(:'ann');
select throws_ok($$ select * from public.tdc_claim_shop_emails(10) $$, '42501', null, 'a player can''t claim emails');
select throws_ok(format($$ select public.tdc_mark_shop_email(%L, null, null) $$, gen_random_uuid()), '42501', null, 'nor mark one sent');
select ok(public.tdc_shop_emails_waiting() >= 6, 'but may ask how many are waiting');


-- ─── The sweep ───

select tests.sign_out();
select set_config('role', 'service_role', true);
select count(*)::int as claimed,
	(array_agg(to_email) filter (where payload->>'id' = :'o1'))[1] as to_ann,
	(array_agg(payload->>'label') filter (where kind = 'order_collected'))[1] as label_ann
from public.tdc_claim_shop_emails(50) \gset
select is(:claimed, 8, 'the server claims all eight waiting');
select is((select count(*)::int from public.tdc_claim_shop_emails(50)), 0, 'and none is handed out twice');
select tests.sign_out();
select is(:'to_ann'::text, :'ann_email'::text, 'addressed to the player''s account');
select is(:'label_ann'::text, (select chr(64 + extract(isodow from order_day)::int) || order_number from public.tbl_shop_orders where id = :'o1'), 'with the order''s number');

select id as e1 from public.tbl_shop_emails where order_id = :'o1' and kind = 'order_placed' \gset
select id as e2 from public.tbl_shop_emails where order_id = :'o1' and kind = 'order_collected' \gset
select set_config('role', 'service_role', true);
select public.tdc_mark_shop_email(:'e1', 're_123', null);
select public.tdc_mark_shop_email(:'e2', null, 'Resend said 500');
select tests.sign_out();
select is((select status from public.tbl_shop_emails where id = :'e1'), 'sent', 'a send marks it sent');
select is((select provider_id from public.tbl_shop_emails where id = :'e1'), 're_123', 'with Resend''s id');
select is((select status || ' ' || last_error from public.tbl_shop_emails where id = :'e2'), 'waiting Resend said 500', 'a failure waits to be tried again, the error kept');

update public.tbl_shop_emails set attempts = 5 where id = :'e2';
select set_config('role', 'service_role', true);
select public.tdc_mark_shop_email(:'e2', null, 'Resend said 500');
select tests.sign_out();
select is((select status from public.tbl_shop_emails where id = :'e2'), 'failed', 'the fifth failure gives up');

-- Over a day old.
select id as e3 from public.tbl_shop_emails where order_id = :'o2' and kind = 'order_ready' \gset
update public.tbl_shop_emails set created_at = now() - interval '2 days', claimed_at = null where id = :'e3';
select set_config('role', 'service_role', true);
select count(*) from public.tdc_claim_shop_emails(50);
select tests.sign_out();
select is((select status from public.tbl_shop_emails where id = :'e3'), 'skipped', 'an email over a day old is skipped');


-- ─── The nightly job ───

select tests.sign_in(:'ann');
select public.tdc_set_cart_qty(:'socks', 1);
select (public.tdc_place_order(:'tdc', 'credits', 80, 'mail-ann-5')->>'id') as o5 \gset
select tests.sign_out();
select set_config('tdc.order_write', 'on', true);
update public.tbl_shop_orders set collect_by = now() - interval '1 day' where id = :'o5';
select set_config('tdc.order_write', 'off', true);
select private.tdc_cancel_uncollected_orders();
select is((select title from public.tbl_notifications where player_id = :'pann' and kind = 'order_uncollected'),
	(select chr(64 + extract(isodow from order_day)::int) || order_number || ' wasn''t collected in time' from public.tbl_shop_orders where id = :'o5'),
	'the nightly job tells the player in the tray');
select is((select body from public.tbl_notifications where player_id = :'pann' and kind = 'order_uncollected'), '80 credits are back in your account.', 'saying the credits are back');
select is(private.tdc_shop_email_payload('order_cancelled', :'pann', :'o5', null)->>'cancelled_by', 'uncollected', 'and its email says it wasn''t collected');


-- ─── The merge ───

insert into public.tbl_players (display_name, player_type) values ('Mail Walk-in', 'walk_in') returning id as walkin \gset
select private.tdc_merge_players(:'walkin', :'pann', :'ann');
select is((select count(*)::int from public.tbl_email_prefs where player_id = :'walkin' and kind = 'order_ready' and not enabled), 1, 'Ann''s switch moves to the kept record');
select ok((select count(*)::int from public.tbl_shop_emails where player_id = :'walkin') >= 4, 'and her emails with it');

select * from finish();
rollback;
