-- The shop, Stage 4's last step: orders not collected are cancelled every night (UV, 24 Nov;
-- DECISIONS 24 Nov, "Uncollected shop orders, and ID at hand-over"; docs/design/shop.md).
--
-- At 04:00 club time (02:00 UTC) every open order (placed, preparing or ready) is cancelled when:
--   - it holds merch and its 30 days are up (collect_by has passed; the Delivery and Refunds
--     policies), or
--   - it is café only and was placed on an earlier day at the club (UV, 24 Nov: café orders left
--     from an earlier day).
-- Credits paid come back (an order_refund row, as a player's or staff's cancel). An order paid at
-- the club was never charged, so there is nothing to return.
--
-- This turns on pg_cron, the project's first scheduled job (notifications.md, 22 Oct: "a decision
-- of its own"; UV's go-ahead 24 Nov to build this job).

create extension if not exists pg_cron with schema pg_catalog;

-- Returns how many orders it cancelled. Run by the schedule below; private, so nothing on the
-- site can call it.
create function private.tdc_cancel_uncollected_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_row   public.tbl_shop_orders%rowtype;
	v_count integer := 0;
begin
	for v_row in
		select o.* from public.tbl_shop_orders o
		join public.tbl_venues v on v.id = o.venue_id
		where o.status in ('placed', 'preparing', 'ready')
			and (
				(o.collect_by is not null and o.collect_by < now())
				or (o.collect_by is null
					and o.order_day < (now() at time zone coalesce(nullif(v.timezone, ''), 'Africa/Johannesburg'))::date)
			)
		for update of o
	loop
		perform set_config('tdc.order_write', 'on', true);
		update public.tbl_shop_orders
		set status = 'cancelled', cancelled_at = now(), cancelled_by = null
		where id = v_row.id
		returning * into v_row;
		perform set_config('tdc.order_write', 'off', true);

		if v_row.pay_with = 'credits' and v_row.paid_at is not null then
			insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, reason, created_by, idempotency_key, order_id)
			values (v_row.venue_id, v_row.player_id, v_row.total_credits, 'order_refund', 'Not collected in time',
				null, 'order_refund:' || v_row.id, v_row.id);
		end if;
		v_count := v_count + 1;
	end loop;
	return v_count;
end;
$$;

revoke execute on function private.tdc_cancel_uncollected_orders() from public, anon, authenticated;

-- Every night at 04:00 in Johannesburg (02:00 UTC). A venue in another timezone still has its
-- "earlier day" worked out in its own time above.
select cron.schedule('tdc-cancel-uncollected-orders', '0 2 * * *', $$select private.tdc_cancel_uncollected_orders()$$);
