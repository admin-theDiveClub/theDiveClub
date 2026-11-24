-- The shop, Stage 3: checkout and orders (docs/design/shop.md; DECISIONS 24 Nov).
--
-- A player turns their cart into one order (UV, 24 Nov: a cart with café items and merch is one
-- order, Ready only when all of it is), paying with credits or at the club (UV, 24 Nov).
--
--   1. tbl_shop_orders: the order. Its price per credit is frozen onto it, as a top-up's is, so the
--      rand to pay at the club never changes after it is placed. Numbered per venue, starting again
--      each day at midnight, club time (UV, 24 Nov), behind the weekday's letter: Monday A ...
--      Sunday G, so last Tuesday's B27 and today's 27 are told apart while merch waits up to 30
--      days (Claude's, UV's go-ahead 24 Nov). Status placed, preparing, ready, collected or
--      cancelled; only placing and the player's own cancel are built here: staff moving an order
--      on is Stage 4.
--   2. tbl_shop_order_lines: each product's name and price frozen onto the line, as the ruleset is
--      onto a match, so a later price change or rename never alters an order.
--   3. tbl_shop_order_counters: the next number, per venue per day, handed out safely when two
--      people order at the same moment.
--   4. The ledger takes two entry kinds, 'order' (credits out, at placing) and 'order_refund'
--      (credits back), each linked to its order; the database itself refuses a second charge or a
--      second refund for one order.
--   5. A player may cancel their own order until staff start it, that is while it is placed
--      (UV, 24 Nov); credits paid come back at once.
--
-- Paying at the club: the order is placed unpaid; staff take cash or card at hand-over (Stage 4).
-- An uncollected order's credits coming back after 30 days (the Refunds and Delivery policies) is
-- not built here: STATUS.

-- ─── 1. Orders ───
create table public.tbl_shop_orders (
	id                uuid primary key default gen_random_uuid(),
	placed_at         timestamptz not null default now(),
	venue_id          uuid not null references public.tbl_venues (id) on delete restrict,
	player_id         uuid not null references public.tbl_players (id) on delete restrict,
	order_day         date not null,
	order_number      integer not null check (order_number >= 1),
	pay_with          text not null check (pay_with in ('credits', 'club')),
	total_credits     integer not null check (total_credits >= 1),
	cents_per_credit  integer not null check (cents_per_credit >= 1),
	status            text not null default 'placed' check (status in ('placed', 'preparing', 'ready', 'collected', 'cancelled')),
	collect_by        timestamptz,
	paid_at           timestamptz,
	cancelled_at      timestamptz,
	cancelled_by      uuid references auth.users (id) on delete set null,
	created_by        uuid references auth.users (id) on delete set null,
	idempotency_key   text not null unique check (char_length(idempotency_key) between 8 and 100),

	constraint tbl_shop_orders_number_per_day unique (venue_id, order_day, order_number),
	constraint tbl_shop_orders_credits_paid check (pay_with <> 'credits' or paid_at is not null),
	constraint tbl_shop_orders_cancelled check ((status = 'cancelled') = (cancelled_at is not null))
);

comment on table public.tbl_shop_orders is
	'The shop (20261124152509): an order, from the cart. Its price per credit is frozen onto it. Numbered per venue per day behind the weekday''s letter (A = Monday). Written only through the tdc_ order functions; never deleted.';
comment on column public.tbl_shop_orders.collect_by is
	'When the order holds something collected within 30 days: placed_at + 30 days (the Delivery policy). Null for café only.';

create index tbl_shop_orders_player_idx on public.tbl_shop_orders (player_id, venue_id, placed_at desc);
create index tbl_shop_orders_venue_open_idx on public.tbl_shop_orders (venue_id, placed_at) where status in ('placed', 'preparing', 'ready');

-- Rows change only through the functions below, each switching on 'tdc.order_write' for its one
-- update; never deleted, so every order's history stays whole.
create function private.tdc_shop_orders_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		return new;
	end if;
	if tg_op = 'UPDATE' and current_setting('tdc.order_write', true) = 'on' then
		return new;
	end if;
	raise exception 'TDC (Error): an order can''t be changed or deleted directly.';
end;
$$;

revoke execute on function private.tdc_shop_orders_guard() from public, anon, authenticated;

create trigger tbl_shop_orders_guard
	before update or delete on public.tbl_shop_orders
	for each row execute function private.tdc_shop_orders_guard();

create trigger tbl_shop_orders_no_truncate
	before truncate on public.tbl_shop_orders
	for each statement execute function private.tdc_shop_orders_guard();

alter table public.tbl_shop_orders enable row level security;
-- No policies: every read goes through the functions below.
grant select, insert, update on public.tbl_shop_orders to service_role;

-- ─── 2. Order lines ───
create table public.tbl_shop_order_lines (
	id             uuid primary key default gen_random_uuid(),
	order_id       uuid not null references public.tbl_shop_orders (id) on delete restrict,
	product_id     uuid not null references public.tbl_shop_products (id) on delete restrict,
	name           text not null,
	price_credits  integer not null check (price_credits >= 1),
	qty            integer not null check (qty between 1 and 99),
	collect        text not null check (collect in ('bar', 'collect')),
	sort_order     integer not null default 0,

	constraint tbl_shop_order_lines_one_per_product unique (order_id, product_id)
);

comment on table public.tbl_shop_order_lines is
	'The shop (20261124152509): what an order holds, with the product''s name, price and how it is collected frozen when it was placed. Never changed.';

create index tbl_shop_order_lines_product_idx on public.tbl_shop_order_lines (product_id);

-- Written once, with the order; never changed or deleted.
create function private.tdc_shop_order_lines_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception 'TDC (Error): an order''s lines can''t be changed or deleted.';
end;
$$;

revoke execute on function private.tdc_shop_order_lines_guard() from public, anon, authenticated;

create trigger tbl_shop_order_lines_guard
	before update or delete on public.tbl_shop_order_lines
	for each row execute function private.tdc_shop_order_lines_guard();

create trigger tbl_shop_order_lines_no_truncate
	before truncate on public.tbl_shop_order_lines
	for each statement execute function private.tdc_shop_order_lines_guard();

alter table public.tbl_shop_order_lines enable row level security;
grant select, insert on public.tbl_shop_order_lines to service_role;

-- ─── 3. The day's counter ───
create table public.tbl_shop_order_counters (
	venue_id     uuid not null references public.tbl_venues (id) on delete cascade,
	order_day    date not null,
	last_number  integer not null check (last_number >= 1),
	primary key (venue_id, order_day)
);

comment on table public.tbl_shop_order_counters is
	'The shop (20261124152509): the last order number handed out at a venue on a day (club time). Written only by tdc_place_order.';

alter table public.tbl_shop_order_counters enable row level security;
grant select, insert, update on public.tbl_shop_order_counters to service_role;

-- ─── 4. The ledger: an order's charge and its refund, each linked to the order ───
alter table public.tbl_credit_ledger drop constraint tbl_credit_ledger_entry_type_check;
alter table public.tbl_credit_ledger add constraint tbl_credit_ledger_entry_type_check
	check (entry_type in ('adjustment', 'code', 'top_up', 'order', 'order_refund'));

alter table public.tbl_credit_ledger
	add column order_id uuid references public.tbl_shop_orders (id) on delete restrict;

alter table public.tbl_credit_ledger add constraint tbl_credit_ledger_order_link
	check ((entry_type in ('order', 'order_refund')) = (order_id is not null));

alter table public.tbl_credit_ledger add constraint tbl_credit_ledger_order_sign
	check ((entry_type <> 'order' or amount < 0) and (entry_type <> 'order_refund' or amount > 0));

-- One charge and at most one refund per order.
create unique index tbl_credit_ledger_order_once on public.tbl_credit_ledger (order_id, entry_type) where order_id is not null;

comment on column public.tbl_credit_ledger.order_id is
	'Shop orders (20261124152509): the order an order or order_refund entry belongs to. One of each per order at most.';

-- ─── Internal: an order as the pages see it ───
create function private.tdc_shop_order_json(p_row public.tbl_shop_orders)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'id',               p_row.id,
		'venue_id',         p_row.venue_id,
		'venue_name',       (select name from public.tbl_venues where id = p_row.venue_id),
		'label',            chr(64 + extract(isodow from p_row.order_day)::integer) || p_row.order_number,
		'order_day',        p_row.order_day,
		'order_number',     p_row.order_number,
		'placed_at',        p_row.placed_at,
		'status',           p_row.status,
		'pay_with',         p_row.pay_with,
		'paid_at',          p_row.paid_at,
		'total_credits',    p_row.total_credits,
		'cents_per_credit', p_row.cents_per_credit,
		'pay_cents',        p_row.total_credits * p_row.cents_per_credit,
		'collect_by',       p_row.collect_by,
		'cancelled_at',     p_row.cancelled_at,
		'can_cancel',       p_row.status = 'placed',
		'lines', coalesce((
			select jsonb_agg(jsonb_build_object(
				'product_id',    l.product_id,
				'name',          l.name,
				'price_credits', l.price_credits,
				'qty',           l.qty,
				'collect',       l.collect
			) order by l.sort_order)
			from public.tbl_shop_order_lines l
			where l.order_id = p_row.id
		), '[]'::jsonb)
	);
$$;

revoke execute on function private.tdc_shop_order_json(public.tbl_shop_orders) from public, anon, authenticated;

-- ─── 1. A player: place an order from my cart. Returns the order. ───
-- p_pay_with: 'credits' (taken now) or 'club' (paid at hand-over, Stage 4).
-- p_expected_total: the total the page showed; if the cart or a price changed meanwhile, refused.
-- p_idempotency_key: a fresh random id from the page for each attempt, so a double tap or retry
-- returns the order already placed instead of placing a second.
-- Only the cart's lines that are on are ordered; a line switched off stays in the cart.
create function public.tdc_place_order(
	p_venue_id         uuid,
	p_pay_with         text,
	p_expected_total   integer,
	p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_player_id  uuid := private.tdc_my_player_id();
	v_venue      public.tbl_venues%rowtype;
	v_existing   public.tbl_shop_orders%rowtype;
	v_row        public.tbl_shop_orders%rowtype;
	v_total      integer;
	v_lines      integer;
	v_collect    boolean;
	v_cents      integer;
	v_balance    integer;
	v_day        date;
	v_number     integer;
begin
	select * into v_venue from public.tbl_venues where id = p_venue_id and active and sells_credits;
	if v_venue.id is null then
		raise exception 'This venue has no shop on the site.';
	end if;
	if exists (select 1 from public.tbl_players where id = v_player_id and player_type = 'guest') then
		raise exception 'Guests can''t order from the shop. Please sign up for your own account.';
	end if;
	if p_pay_with is null or p_pay_with not in ('credits', 'club') then
		raise exception 'Please choose how to pay: credits, or at the club.';
	end if;
	if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
		raise exception 'TDC (Error): missing or invalid idempotency key.';
	end if;

	-- One change to this player's balance at this venue at a time (the same lock as an adjustment),
	-- so two orders can't both pass the balance check, and a double tap waits for the first.
	perform pg_advisory_xact_lock(hashtextextended(p_venue_id::text || ':' || v_player_id::text, 0));

	select * into v_existing from public.tbl_shop_orders where idempotency_key = p_idempotency_key;
	if v_existing.id is not null then
		if v_existing.player_id <> v_player_id then
			raise exception 'TDC (Error): that idempotency key belongs to another order.';
		end if;
		return private.tdc_shop_order_json(v_existing);
	end if;

	select coalesce(sum(ci.qty * p.price_credits), 0)::integer, count(*)::integer, coalesce(bool_or(p.collect = 'collect'), false)
	into v_total, v_lines, v_collect
	from public.tbl_shop_cart_items ci
	join public.tbl_shop_products p on p.id = ci.product_id
	where ci.player_id = v_player_id and p.venue_id = p_venue_id and p.active;

	if v_lines = 0 then
		raise exception 'Your cart is empty.';
	end if;
	if p_expected_total is distinct from v_total then
		raise exception 'Your cart or a price has changed. Please check your order and place it again.';
	end if;

	select cents_per_credit into v_cents from public.tbl_credit_prices where venue_id = p_venue_id;
	if v_cents is null then
		raise exception 'This venue has no price per credit set yet.';
	end if;

	if p_pay_with = 'credits' then
		v_balance := private.tdc_credit_balance(p_venue_id, v_player_id);
		if v_balance < v_total then
			raise exception 'You have % credits; this order needs %.', v_balance, v_total;
		end if;
	end if;

	-- Today, club time; the next number for today at this venue.
	v_day := (now() at time zone coalesce(nullif(v_venue.timezone, ''), 'Africa/Johannesburg'))::date;
	insert into public.tbl_shop_order_counters as c (venue_id, order_day, last_number)
	values (p_venue_id, v_day, 1)
	on conflict (venue_id, order_day) do update set last_number = c.last_number + 1
	returning last_number into v_number;

	insert into public.tbl_shop_orders
		(venue_id, player_id, order_day, order_number, pay_with, total_credits, cents_per_credit,
		 collect_by, paid_at, created_by, idempotency_key)
	values
		(p_venue_id, v_player_id, v_day, v_number, p_pay_with, v_total, v_cents,
		 case when v_collect then now() + interval '30 days' end,
		 case when p_pay_with = 'credits' then now() end,
		 auth.uid(), p_idempotency_key)
	returning * into v_row;

	insert into public.tbl_shop_order_lines (order_id, product_id, name, price_credits, qty, collect, sort_order)
	select v_row.id, p.id, p.name, p.price_credits, ci.qty, p.collect,
		row_number() over (order by c.sort_order, p.sort_order, p.name)
	from public.tbl_shop_cart_items ci
	join public.tbl_shop_products p on p.id = ci.product_id
	join public.tbl_shop_categories c on c.id = p.category_id
	where ci.player_id = v_player_id and p.venue_id = p_venue_id and p.active;

	delete from public.tbl_shop_cart_items ci
	using public.tbl_shop_products p
	where p.id = ci.product_id and ci.player_id = v_player_id and p.venue_id = p_venue_id and p.active;

	if p_pay_with = 'credits' then
		insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, created_by, idempotency_key, order_id)
		values (p_venue_id, v_player_id, -v_total, 'order', auth.uid(), 'order:' || v_row.id, v_row.id);
	end if;

	return private.tdc_shop_order_json(v_row);
end;
$$;

-- ─── 2. A player: my orders at a venue, newest first ───
-- Every open one (placed, preparing, ready), and the last 10 of any kind.
create function public.tdc_my_orders(p_venue_id uuid)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_player_id uuid := private.tdc_my_player_id();
begin
	return query
		select private.tdc_shop_order_json(o)
		from public.tbl_shop_orders o
		where o.venue_id = p_venue_id and o.player_id = v_player_id
			and (o.status in ('placed', 'preparing', 'ready')
				or o.id in (select r.id from public.tbl_shop_orders r
					where r.venue_id = p_venue_id and r.player_id = v_player_id
					order by r.placed_at desc limit 10))
		order by o.placed_at desc;
end;
$$;

-- ─── 3. A player: one of my orders (the order card asks this while it is open) ───
create function public.tdc_my_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_player_id uuid := private.tdc_my_player_id();
	v_row       public.tbl_shop_orders%rowtype;
begin
	select * into v_row from public.tbl_shop_orders where id = p_order_id and player_id = v_player_id;
	if v_row.id is null then
		raise exception 'That order isn''t one of yours.';
	end if;
	return private.tdc_shop_order_json(v_row);
end;
$$;

-- ─── 4. A player: cancel my order, while it is placed (UV, 24 Nov). Credits paid come back. ───
create function public.tdc_cancel_my_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_player_id uuid := private.tdc_my_player_id();
	v_row       public.tbl_shop_orders%rowtype;
begin
	select * into v_row from public.tbl_shop_orders
	where id = p_order_id and player_id = v_player_id
	for update;

	if v_row.id is null then
		raise exception 'That order isn''t one of yours.';
	end if;
	if v_row.status = 'cancelled' then
		raise exception 'That order is already cancelled.';
	end if;
	if v_row.status <> 'placed' then
		raise exception 'Staff have started that order, so it can''t be cancelled here. Please ask at the bar.';
	end if;

	perform set_config('tdc.order_write', 'on', true);
	update public.tbl_shop_orders
	set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
	where id = v_row.id
	returning * into v_row;
	perform set_config('tdc.order_write', 'off', true);

	if v_row.pay_with = 'credits' and v_row.paid_at is not null then
		insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, created_by, idempotency_key, order_id)
		values (v_row.venue_id, v_row.player_id, v_row.total_credits, 'order_refund', auth.uid(), 'order_refund:' || v_row.id, v_row.id);
	end if;

	return private.tdc_shop_order_json(v_row);
end;
$$;

-- ─── Who can call these ───
revoke execute on function public.tdc_place_order(uuid, text, integer, text) from public, anon;
revoke execute on function public.tdc_my_orders(uuid)                       from public, anon;
revoke execute on function public.tdc_my_order(uuid)                        from public, anon;
revoke execute on function public.tdc_cancel_my_order(uuid)                 from public, anon;

grant execute on function public.tdc_place_order(uuid, text, integer, text) to authenticated;
grant execute on function public.tdc_my_orders(uuid)                       to authenticated;
grant execute on function public.tdc_my_order(uuid)                        to authenticated;
grant execute on function public.tdc_cancel_my_order(uuid)                 to authenticated;

-- ─── The merge: orders move with the player ───
-- Patched from the latest definition (20261124125407_shop_products_and_cart), one block added after
-- the cart. Restrict on delete, so without it a claim by an account that had ever ordered would
-- fail on deleting the signup record.
CREATE OR REPLACE FUNCTION private.tdc_merge_players(p_keep_id uuid, p_remove_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_keep   public.tbl_players%rowtype;
	v_remove public.tbl_players%rowtype;
begin
	select * into v_keep   from public.tbl_players where id = p_keep_id   for update;
	select * into v_remove from public.tbl_players where id = p_remove_id for update;

	if v_keep.id is null or v_remove.id is null then
		raise exception 'TDC (Error): player record not found.';
	end if;
	if v_keep.id = v_remove.id then
		raise exception 'TDC (Error): cannot join a player record with itself.';
	end if;
	if v_keep.user_id is not null then
		raise exception 'That record is already linked to an account.';
	end if;
	if v_keep.player_type not in ('walk_in', 'guest') then
		raise exception 'TDC (Error): only walk-in or guest records can be linked to an account.';
	end if;
	if v_remove.user_id is distinct from p_user_id then
		raise exception 'TDC (Error): the account does not match the selected player.';
	end if;

	-- Two different SA IDs can't be joined automatically. (The same SA ID can't be on two records.)
	if exists (select 1 from public.tbl_player_identifiers where player_id = p_keep_id   and kind = 'sa_id')
	   and exists (select 1 from public.tbl_player_identifiers where player_id = p_remove_id and kind = 'sa_id') then
		raise exception 'Both records have an SA ID on file. Please ask an owner or admin to resolve this.';
	end if;

	-- If the two records ever faced each other, joining them would make a match
	-- or a frame have the same player on both sides. Say so plainly rather than
	-- letting a check constraint fail with something nobody can act on.
	if exists (
		select 1 from public.tbl_matches
		where (home_player_id = p_keep_id   and away_player_id = p_remove_id)
		   or (home_player_id = p_remove_id and away_player_id = p_keep_id)
	) then
		raise exception 'These two records are recorded as having played against each other. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_frame_participants a
		join public.tbl_frame_participants b on b.frame_id = a.frame_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are recorded as having played in the same frame. Please ask an owner or admin to resolve this.';
	end if;

	-- Doubles (20261119124608): two seats of one match, partners or
	-- opponents, before any frame is played. Joined, one player would hold
	-- two seats.
	if exists (
		select 1
		from public.tbl_match_side_players a
		join public.tbl_match_side_players b on b.match_id = a.match_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both in the same match. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_league_season_entrants a
		join public.tbl_league_season_entrants b on b.league_season_id = a.league_season_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both entered in the same league season. Please ask an owner or admin to resolve this.';
	end if;

	-- ── Move everything that points at the signup record onto the walk-in record ──
	update public.tbl_player_identifiers set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_players set guest_of_player_id = p_keep_id where guest_of_player_id = p_remove_id;

	-- Credits: the only time ledger rows may change owner. The switch is on for this transaction step only.
	perform set_config('tdc.ledger_merge', 'on', true);
	update public.tbl_credit_ledger set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.ledger_merge', 'off', true);

	-- Redeem codes keep a full history and refuse direct edits, so the same
	-- controlled-write switch the redeem and void functions use is needed here.
	perform set_config('tdc.redeem_write', 'on', true);
	update public.tbl_redeem_codes set redeemed_player_id = p_keep_id where redeemed_player_id = p_remove_id;
	perform set_config('tdc.redeem_write', 'off', true);

	-- Credit top-ups (20261124112328). Restrict on delete, so without this a claim by an
	-- account that had ever asked for credits would fail on deleting the signup record.
	-- The rows refuse direct edits, so the top-up functions' write switch is needed here.
	perform set_config('tdc.top_up_write', 'on', true);
	update public.tbl_credit_top_ups set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.top_up_write', 'off', true);

	-- The cart (20261124125407). Cascades on delete, so without this a claim would quietly
	-- empty the account's cart. A walk-in has no account and so no cart; if it somehow
	-- has a line for the same product, the account's stands (as the notification settings).
	delete from public.tbl_shop_cart_items k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_shop_cart_items r where r.player_id = p_remove_id and r.product_id = k.product_id);
	update public.tbl_shop_cart_items set player_id = p_keep_id where player_id = p_remove_id;

	-- Shop orders (20261124152509). Restrict on delete, so without this a claim by an account
	-- that had ever ordered would fail on deleting the signup record. The rows refuse direct
	-- edits, so the order functions' write switch is needed here. The ledger rows linked to
	-- them have already moved above.
	perform set_config('tdc.order_write', 'on', true);
	update public.tbl_shop_orders set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.order_write', 'off', true);

	-- Matches and frames. The match rows matter as much as the frames: a side of
	-- a match is a player id, and losing it would orphan a whole scorecard.
	-- The frame writes now pass the rank guard as well as the lock, so they go
	-- through the same unlock the delete path uses: a merge is bookkeeping,
	-- not somebody trying to change a score.
	perform set_config('tdc.card_unlock', 'on', true);
	update public.tbl_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;
	-- Match referee (20261024162559). Set null on delete, so without this a
	-- claim would quietly forget who was refereeing.
	update public.tbl_matches set referee_player_id = p_keep_id where referee_player_id = p_remove_id;

	update public.tbl_frames set referee_player_id = p_keep_id where referee_player_id = p_remove_id;
	update public.tbl_frames set break_player_id   = p_keep_id where break_player_id   = p_remove_id;
	update public.tbl_frame_participants set player_id = p_keep_id where player_id = p_remove_id;
	-- Doubles seats (20261119124608), restrict on delete like the match's own columns.
	update public.tbl_match_side_players set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.card_unlock', 'off', true);

	-- Competitions. Both of these cascade on delete, so without them the
	-- signup record's tournament entries and official roles would vanish the
	-- moment it is deleted below — quietly, at the exact moment staff link
	-- the records. Plain updates, not upserts: both tables are unique per
	-- (tournament, player), so a record somehow in the same tournament twice
	-- fails loudly rather than losing one of them.
	update public.tbl_tournament_entrants set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_competition_roles   set player_id = p_keep_id where player_id = p_remove_id;

	-- What this person has been told. Added 20261022100000.
	--
	-- Load-bearing, despite notifications needing an account: the record
	-- being *removed* here is the signup record — the one with the account,
	-- and therefore the only one that can have notifications. The walk-in
	-- record survives and inherits the login. Without this line, claiming a
	-- walk-in would silently wipe everything that account had been told.
	--
	-- The settings move too (20261024090641). They were left out on the
	-- grounds that p_keep_id is a walk-in and has none, but the settings that
	-- matter are the account's, on p_remove_id, and deleting that record took
	-- them with it: somebody who had turned league notifications off had them
	-- back on after a claim. If both somehow have a setting for a category,
	-- the account's wins (UV, 24 Oct: always the account's).
	update public.tbl_notifications set player_id = p_keep_id where player_id = p_remove_id;

	delete from public.tbl_notification_prefs k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_notification_prefs r
			where r.player_id = p_remove_id and r.category = k.category);
	update public.tbl_notification_prefs set player_id = p_keep_id where player_id = p_remove_id;

	-- League seasons (20261022180000). Unique per (season, player), so a record
	-- somehow entered twice fails loudly rather than losing one of the two —
	-- the same stance as the tournament entries above, with the friendly
	-- message the guards at the top give.
	update public.tbl_league_season_entrants set player_id = p_keep_id where player_id = p_remove_id;

	-- Tonight's squad and lineup (20261022230000, missing until 20261024090641).
	-- The squad cascades and the order is set null, so a claim used to take a
	-- league player out of every squad and leave their lineup positions empty.
	--
	-- A walk-in cannot be a league player, so it cannot be in either table
	-- through any function. If it somehow is, in a match where the account is
	-- too, the account's place stands and the walk-in's goes (UV, 24 Oct):
	-- its squad row is deleted and its positions emptied, which is what a
	-- captain clearing a position leaves. Matched on the match, not the side,
	-- so one person never ends up in one team's lineup and the other's squad.
	update public.tbl_league_match_order k
	set player_id = null
	where k.player_id = p_keep_id
		and (
			exists (select 1 from public.tbl_league_match_squad r where r.match_id = k.match_id and r.player_id = p_remove_id)
			or exists (select 1 from public.tbl_league_match_order r where r.match_id = k.match_id and r.player_id = p_remove_id)
		);
	delete from public.tbl_league_match_squad k
	where k.player_id = p_keep_id
		and (
			exists (select 1 from public.tbl_league_match_squad r where r.match_id = k.match_id and r.player_id = p_remove_id)
			or exists (select 1 from public.tbl_league_match_order r where r.match_id = k.match_id and r.player_id = p_remove_id)
		);
	update public.tbl_league_match_squad set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_league_match_order set player_id = p_keep_id where player_id = p_remove_id;

	-- Added 20261022180000, found while reading this function for leagues.
	-- Neither table was here. tbl_match_events.player_id is ON DELETE RESTRICT,
	-- so a signup record that had ever submitted or answered a card made the
	-- delete below fail with a raw foreign-key error — loud, not lossy, but a
	-- walk-in claim would simply not go through. tbl_deleted_matches is set
	-- null (or restrict, for deleted_by), which would have forgotten who
	-- removed a match. Plain updates: neither table has a uniqueness rule on
	-- the player, so there is nothing to collide with.
	update public.tbl_match_events   set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_deleted_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_deleted_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;
	-- Doubles (20261119124608): arrays, so no foreign key would catch them.
	update public.tbl_deleted_matches set home_players = array_replace(home_players, p_remove_id, p_keep_id)
		where p_remove_id = any (home_players);
	update public.tbl_deleted_matches set away_players = array_replace(away_players, p_remove_id, p_keep_id)
		where p_remove_id = any (away_players);
	update public.tbl_deleted_matches set deleted_by     = p_keep_id where deleted_by     = p_remove_id;

	-- Who set a score by hand, and who changed a frame. Both "on delete set
	-- null", so these forget the person rather than blocking.
	update public.tbl_match_result_override set set_by = p_keep_id where set_by = p_remove_id;
	update public.tbl_frame_edit set edited_by_player_id = p_keep_id where edited_by_player_id = p_remove_id;

	-- Asking to join a team (20261105153021). Cascades on delete, so without
	-- this a claim would quietly take back every request the account made.
	-- Unique per (team, player): where both asked the same team, the
	-- account's request stands and the walk-in's goes.
	delete from public.tbl_team_join_requests k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_team_join_requests r
			where r.player_id = p_remove_id and r.team_id = k.team_id);
	update public.tbl_team_join_requests set player_id = p_keep_id where player_id = p_remove_id;

	-- Following (this migration). Cascades on delete, so without this a claim
	-- would quietly lose everyone following the walk-in or the account, and
	-- everyone the account follows. The two records following each other would
	-- become somebody following themselves, so that goes first; where both
	-- follow the same player, or the same player follows both, one row stands.
	delete from public.tbl_player_follows
	where (follower_id = p_remove_id and followed_id = p_keep_id)
		or (follower_id = p_keep_id and followed_id = p_remove_id);
	delete from public.tbl_player_follows k
	where k.follower_id = p_keep_id
		and exists (select 1 from public.tbl_player_follows r
			where r.follower_id = p_remove_id and r.followed_id = k.followed_id);
	update public.tbl_player_follows set follower_id = p_keep_id where follower_id = p_remove_id;
	delete from public.tbl_player_follows k
	where k.followed_id = p_keep_id
		and exists (select 1 from public.tbl_player_follows r
			where r.followed_id = p_remove_id and r.follower_id = k.follower_id);
	update public.tbl_player_follows set followed_id = p_keep_id where followed_id = p_remove_id;

	-- Devices (20261113164109). The account's record is the one with rows:
	-- a walk-in has no sign-in, so it never records one. Moved rather than
	-- left to the cascade, or a claim would lose the account's history of
	-- using the app. Where both somehow have the same device, the two are
	-- folded together.
	insert into public.tbl_player_devices (player_id, os, browser, installed, first_seen, last_seen, days_seen)
	select p_keep_id, d.os, d.browser, d.installed, d.first_seen, d.last_seen, d.days_seen
	from public.tbl_player_devices d where d.player_id = p_remove_id
	on conflict (player_id, os, browser, installed) do update
		set first_seen = least(public.tbl_player_devices.first_seen, excluded.first_seen),
			last_seen  = greatest(public.tbl_player_devices.last_seen, excluded.last_seen),
			days_seen  = public.tbl_player_devices.days_seen + excluded.days_seen;
	delete from public.tbl_player_devices where player_id = p_remove_id;

	-- Discrepancies accepted (20261117054351). Set null on delete, so without
	-- this a claim would forget who accepted; and a forgotten acceptor stops
	-- counting as the entry a later change overruled.
	update public.tbl_frame_change_accept set accepted_by_player_id = p_keep_id where accepted_by_player_id = p_remove_id;

	-- Remove the signup record first, so its login link is free for the walk-in record.
	delete from public.tbl_players where id = p_remove_id;

	update public.tbl_players
	set user_id            = p_user_id,
		player_type        = 'member',
		guest_of_player_id = null,
		-- Keep the display name chosen at signup; names prefer what staff entered (they saw the ID).
		display_name       = case when v_remove.display_name = 'TDC (No Name)' then v_keep.display_name else v_remove.display_name end,
		first_name         = coalesce(v_keep.first_name, v_remove.first_name),
		last_name          = coalesce(v_keep.last_name,  v_remove.last_name)
	where id = p_keep_id;

	return p_keep_id;
end;
$function$;

revoke execute on function private.tdc_merge_players(uuid, uuid, uuid) from public, anon, authenticated;
