-- The shop, Stage 4: the staff queue and the hand-over (docs/design/shop.md; DECISIONS 24 Nov).
--
-- Staff at the venue (owner, admin, staff; UV, 24 Nov) see every open order and move it on:
-- Placed -> Preparing -> Ready -> Collected, with one step back allowed until it is collected
-- (UV). At hand-over an order paid at the club is paid there, Cash or Card (UV, as top-ups); an
-- order paid with credits is simply marked collected. No ID check (UV, 24 Nov, reversing the
-- same day's "staff look at an ID document"). Staff may cancel any open order, credits back at
-- once (out of stock; UV). Nobody hands over or cancels their own order (UV, as top-ups).
--
--   1. tbl_shop_orders gains how an at-club order was paid, who took it, and who handed it over.
--   2. A notification category 'shop' (UV: a new Shop switch), and two notices: an order is
--      Ready (UV), and staff cancelled it (UV).
--   3. The staff functions: the queue, find by number, one order, move on or back, collect,
--      cancel.
--
-- The nightly job for uncollected orders is a migration of its own (Stage 4's last step).

-- ─── 1. The order: paid at the club, and collected ───
alter table public.tbl_shop_orders
	add column paid_method  text check (paid_method in ('cash', 'card')),
	add column paid_by      uuid references auth.users (id) on delete set null,
	add column collected_at timestamptz,
	add column collected_by uuid references auth.users (id) on delete set null;

-- Cash or card only for an order paid at the club; collected exactly when the status says so,
-- and never unpaid.
alter table public.tbl_shop_orders add constraint tbl_shop_orders_paid_method
	check (paid_method is null or pay_with = 'club');
alter table public.tbl_shop_orders add constraint tbl_shop_orders_collected
	check ((status = 'collected') = (collected_at is not null));
alter table public.tbl_shop_orders add constraint tbl_shop_orders_collected_paid
	check (status <> 'collected' or paid_at is not null);

comment on column public.tbl_shop_orders.paid_method is
	'Staff queue (20261124155021): cash or card, for an order paid at the club, taken at hand-over. Null for credits.';
comment on column public.tbl_shop_orders.collected_at is
	'Staff queue (20261124155021): when staff handed it over (status collected).';

-- The open-orders index is kept; the queue reads it.


-- ─── 2. The Shop switch and its notices ───
-- The two category lists, and the two functions that name the categories, patched from
-- 20261022100000_notifications (one word added to each list).
alter table public.tbl_notifications drop constraint tbl_notifications_category_check;
alter table public.tbl_notifications add constraint tbl_notifications_category_check
	check (category in ('match', 'tournament', 'league', 'admin', 'shop'));

alter table public.tbl_notification_prefs drop constraint tbl_notification_prefs_category_check;
alter table public.tbl_notification_prefs add constraint tbl_notification_prefs_category_check
	check (category in ('match', 'tournament', 'league', 'admin', 'shop'));

create or replace function public.tdc_set_notification_pref(p_category text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me uuid;
begin
	if p_category not in ('match', 'tournament', 'league', 'admin', 'shop') then
		raise exception 'TDC (Error): unknown notification category "%".', p_category;
	end if;
	if p_enabled is null then
		raise exception 'TDC (Error): a notification setting is on or off.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	insert into public.tbl_notification_prefs (player_id, category, push_enabled)
	values (v_me, p_category, p_enabled)
	on conflict (player_id, category) do update
		set push_enabled = excluded.push_enabled, updated_at = now();
end;
$$;

-- Every category with its setting, including the ones that have no row, so a
-- settings page can render the list without knowing what the categories are.
create or replace function public.tdc_notification_prefs()
returns table (category text, push_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
	select c.category,
		coalesce(p.push_enabled, true)
	from unnest(array['match', 'tournament', 'league', 'admin', 'shop']) as c(category)
	left join public.tbl_notification_prefs p
		on p.category = c.category
		and p.player_id = (select id from public.tbl_players where user_id = (select auth.uid()))
	order by array_position(array['match', 'tournament', 'league', 'admin', 'shop'], c.category);
$$;


-- ─── Internal: an order as the staff pages see it ───
-- The player's order, with who it is for (so staff see the right person) and how it was paid.
create function private.tdc_shop_order_staff_json(p_row public.tbl_shop_orders)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_shop_order_json(p_row) || jsonb_build_object(
		'player_id',    p.id,
		'display_name', p.display_name,
		'first_name',   p.first_name,
		'last_name',    p.last_name,
		'avatar_path',  p.avatar_path,
		'paid_method',  p_row.paid_method,
		'collected_at', p_row.collected_at,
		'is_mine',      coalesce(p.user_id = (select auth.uid()), false)
	)
	from public.tbl_players p
	where p.id = p_row.player_id;
$$;

revoke execute on function private.tdc_shop_order_staff_json(public.tbl_shop_orders) from public, anon, authenticated;


-- ─── Internal: tell the player their order changed ───
-- 'ready' or 'cancelled' (by staff). The staff member is the actor, so nobody is told about
-- their own order moving.
create function private.tdc_notify_order(p_row public.tbl_shop_orders, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_label text := chr(64 + extract(isodow from p_row.order_day)::integer) || p_row.order_number;
	v_venue text := (select name from public.tbl_venues where id = p_row.venue_id);
begin
	if p_kind = 'ready' then
		perform private.tdc_notify(p_row.player_id, 'shop', 'order_ready',
			v_label || ' is ready to collect',
			'At ' || v_venue || '. Show your code at the bar.',
			'/accounts/profile/', null, null, private.tdc_my_player_id());
	elsif p_kind = 'cancelled' then
		perform private.tdc_notify(p_row.player_id, 'shop', 'order_cancelled',
			v_label || ' was cancelled by the club',
			case when p_row.pay_with = 'credits'
				then p_row.total_credits || ' credits are back in your account.'
				else 'Nothing was charged.' end,
			'/accounts/profile/', null, null, private.tdc_my_player_id());
	else
		raise exception 'TDC (Error): unknown order notice "%".', p_kind;
	end if;
end;
$$;

revoke execute on function private.tdc_notify_order(public.tbl_shop_orders, text) from public, anon, authenticated;


-- ─── 3a. Staff: the queue ───
-- Every open order at the venue (placed, preparing, ready), oldest first, and how many top-ups
-- are waiting (not expired). One object, so the page asks once every few seconds.
create function public.tdc_staff_orders(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	return jsonb_build_object(
		'orders', coalesce((
			select jsonb_agg(private.tdc_shop_order_staff_json(o) order by o.placed_at)
			from public.tbl_shop_orders o
			where o.venue_id = p_venue_id and o.status in ('placed', 'preparing', 'ready')
		), '[]'::jsonb),
		'top_ups_waiting', (
			select count(*)::integer from public.tbl_credit_top_ups t
			where t.venue_id = p_venue_id and t.status = 'waiting' and t.expires_at > now()
		)
	);
end;
$$;

-- ─── 3b. Staff: find an order by its number (B27) ───
-- The letter is the weekday (A = Monday), so a number can belong to several weeks while merch
-- waits 30 days: every open order with it, newest first; with none open, the newest of any
-- state, so the page can say why it can't be handed over. Empty when nothing matches.
create function public.tdc_staff_find_order(p_venue_id uuid, p_label text)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_label  text := upper(regexp_replace(coalesce(p_label, ''), '[^a-zA-Z0-9]', '', 'g'));
	v_dow    integer;
	v_number integer;
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	if v_label !~ '^[A-G][0-9]{1,5}$' then
		return;
	end if;
	v_dow    := ascii(left(v_label, 1)) - 64;
	v_number := substr(v_label, 2)::integer;

	if exists (select 1 from public.tbl_shop_orders o
		where o.venue_id = p_venue_id and o.order_number = v_number
			and extract(isodow from o.order_day) = v_dow
			and o.status in ('placed', 'preparing', 'ready')) then
		return query
			select private.tdc_shop_order_staff_json(o)
			from public.tbl_shop_orders o
			where o.venue_id = p_venue_id and o.order_number = v_number
				and extract(isodow from o.order_day) = v_dow
				and o.status in ('placed', 'preparing', 'ready')
			order by o.placed_at desc;
	else
		return query
			select private.tdc_shop_order_staff_json(o)
			from public.tbl_shop_orders o
			where o.venue_id = p_venue_id and o.order_number = v_number
				and extract(isodow from o.order_day) = v_dow
			order by o.placed_at desc
			limit 1;
	end if;
end;
$$;

-- ─── 3c. Staff: one order, whatever its state (the player's QR opens this) ───
create function public.tdc_staff_order(p_venue_id uuid, p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_row public.tbl_shop_orders%rowtype;
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	select * into v_row from public.tbl_shop_orders where id = p_order_id and venue_id = p_venue_id;
	if v_row.id is null then
		raise exception 'That order isn''t one of this venue''s.';
	end if;
	return private.tdc_shop_order_staff_json(v_row);
end;
$$;

-- ─── 3d. Staff: move an order on, or one step back (UV, 24 Nov) ───
-- p_from is the status the page showed, so two screens can't both move the same order: the
-- second is told it has moved already. Forward: placed -> preparing -> ready. Back: ready ->
-- preparing -> placed. Collected and cancelled are their own functions. Turning Ready tells the
-- player (UV).
create function public.tdc_staff_move_order(p_venue_id uuid, p_order_id uuid, p_from text, p_to text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_row public.tbl_shop_orders%rowtype;
begin
	if auth.uid() is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	if p_from is null or p_to is null
	   or (p_from, p_to) not in (('placed', 'preparing'), ('preparing', 'ready'),
	                             ('ready', 'preparing'), ('preparing', 'placed')) then
		raise exception 'TDC (Error): an order can''t move from "%" to "%".', p_from, p_to;
	end if;

	select * into v_row from public.tbl_shop_orders
	where id = p_order_id and venue_id = p_venue_id
	for update;

	if v_row.id is null then
		raise exception 'That order isn''t one of this venue''s.';
	end if;
	if v_row.status = 'cancelled' then
		raise exception 'That order was cancelled.';
	end if;
	if v_row.status = 'collected' then
		raise exception 'That order has been collected.';
	end if;
	if v_row.status <> p_from then
		raise exception 'Someone has moved that order already. The list is up to date now.';
	end if;

	perform set_config('tdc.order_write', 'on', true);
	update public.tbl_shop_orders set status = p_to where id = v_row.id
	returning * into v_row;
	perform set_config('tdc.order_write', 'off', true);

	if p_to = 'ready' then
		perform private.tdc_notify_order(v_row, 'ready');
	end if;

	return private.tdc_shop_order_staff_json(v_row);
end;
$$;

-- ─── 3e. Staff: hand it over ───
-- Only a Ready order. Paid at the club: p_method is 'cash' or 'card' (UV, as top-ups), and the
-- order is marked paid now. Paid with credits: p_method is ignored. Never your own order.
create function public.tdc_staff_collect_order(p_venue_id uuid, p_order_id uuid, p_method text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_row     public.tbl_shop_orders%rowtype;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;

	select * into v_row from public.tbl_shop_orders
	where id = p_order_id and venue_id = p_venue_id
	for update;

	if v_row.id is null then
		raise exception 'That order isn''t one of this venue''s.';
	end if;
	if exists (select 1 from public.tbl_players where id = v_row.player_id and user_id = v_user_id) then
		raise exception 'You can''t hand over your own order. Please ask another staff member.';
	end if;
	if v_row.status = 'collected' then
		raise exception 'That order has been collected already.';
	end if;
	if v_row.status = 'cancelled' then
		raise exception 'That order was cancelled.';
	end if;
	if v_row.status <> 'ready' then
		raise exception 'That order isn''t ready yet. Mark it Ready first.';
	end if;
	if v_row.pay_with = 'club' and (p_method is null or p_method not in ('cash', 'card')) then
		raise exception 'Please choose Cash or Card.';
	end if;

	perform set_config('tdc.order_write', 'on', true);
	if v_row.pay_with = 'club' then
		update public.tbl_shop_orders
		set status = 'collected', collected_at = now(), collected_by = v_user_id,
			paid_at = now(), paid_by = v_user_id, paid_method = p_method
		where id = v_row.id
		returning * into v_row;
	else
		update public.tbl_shop_orders
		set status = 'collected', collected_at = now(), collected_by = v_user_id
		where id = v_row.id
		returning * into v_row;
	end if;
	perform set_config('tdc.order_write', 'off', true);

	return private.tdc_shop_order_staff_json(v_row);
end;
$$;

-- ─── 3f. Staff: cancel an order (out of stock; UV, 24 Nov) ───
-- Any open order; credits paid come back at once, and the player is told (UV). Never your own.
create function public.tdc_staff_cancel_order(p_venue_id uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_row     public.tbl_shop_orders%rowtype;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;

	select * into v_row from public.tbl_shop_orders
	where id = p_order_id and venue_id = p_venue_id
	for update;

	if v_row.id is null then
		raise exception 'That order isn''t one of this venue''s.';
	end if;
	if exists (select 1 from public.tbl_players where id = v_row.player_id and user_id = v_user_id) then
		raise exception 'You can''t cancel your own order here. Please ask another staff member.';
	end if;
	if v_row.status = 'cancelled' then
		raise exception 'That order is already cancelled.';
	end if;
	if v_row.status = 'collected' then
		raise exception 'That order has been collected, so it can''t be cancelled.';
	end if;

	perform set_config('tdc.order_write', 'on', true);
	update public.tbl_shop_orders
	set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id
	where id = v_row.id
	returning * into v_row;
	perform set_config('tdc.order_write', 'off', true);

	if v_row.pay_with = 'credits' and v_row.paid_at is not null then
		insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, created_by, idempotency_key, order_id)
		values (v_row.venue_id, v_row.player_id, v_row.total_credits, 'order_refund', v_user_id, 'order_refund:' || v_row.id, v_row.id);
	end if;

	perform private.tdc_notify_order(v_row, 'cancelled');

	return private.tdc_shop_order_staff_json(v_row);
end;
$$;


-- ─── Who can call these ───
revoke execute on function public.tdc_staff_orders(uuid)                          from public, anon;
revoke execute on function public.tdc_staff_find_order(uuid, text)                from public, anon;
revoke execute on function public.tdc_staff_order(uuid, uuid)                     from public, anon;
revoke execute on function public.tdc_staff_move_order(uuid, uuid, text, text)    from public, anon;
revoke execute on function public.tdc_staff_collect_order(uuid, uuid, text)       from public, anon;
revoke execute on function public.tdc_staff_cancel_order(uuid, uuid)              from public, anon;

grant execute on function public.tdc_staff_orders(uuid)                          to authenticated;
grant execute on function public.tdc_staff_find_order(uuid, text)                to authenticated;
grant execute on function public.tdc_staff_order(uuid, uuid)                     to authenticated;
grant execute on function public.tdc_staff_move_order(uuid, uuid, text, text)    to authenticated;
grant execute on function public.tdc_staff_collect_order(uuid, uuid, text)       to authenticated;
grant execute on function public.tdc_staff_cancel_order(uuid, uuid)              to authenticated;
