-- The shop, Stage 5: receipt emails (UV, 24 Nov; docs/design/shop.md; DECISIONS 24 Nov,
-- "The shop: receipt emails").
--
-- Five emails, each with its own switch on the profile (UV: "options on the player profile just
-- like notifications"), all on by default, as the notification switches are:
--
--   top_up_paid       staff confirmed a top-up: the credits, what was paid and how, the balance
--   order_placed      Place order
--   order_ready       staff marked it Ready
--   order_collected   handed over: the receipt
--   order_cancelled   cancelled by the player, by staff, or by the nightly job
--
-- The Shop notification switch is not consulted: it governs the push only (UV, 24 Nov).
--
-- ─── How an email is sent ───
--
-- As the push is (20261022120000): a queue and a sweep. A trigger on the order and the top-up adds
-- a row to tbl_shop_emails when the status changes, so none of the seven shop functions that move
-- an order or a top-up had to be retyped. The edge function send-shop-emails claims rows, builds
-- each email from the order as it is at that moment, and sends it through Resend, the key held as
-- a Supabase secret. Any signed-in page sets the sweep going (TDC.flushPushes sweeps both). The
-- nightly job's emails go out at the first page load after it (UV, 24 Nov: no pg_net).
--
-- Also here: the nightly job now tells the player in the tray and by push (UV, 24 Nov), through
-- a third kind in private.tdc_notify_order; and the merge moves the two new tables.

-- ─── 1. The switches ───
create table public.tbl_email_prefs (
	player_id   uuid not null references public.tbl_players (id) on delete cascade,
	kind        text not null check (kind in ('top_up_paid', 'order_placed', 'order_ready', 'order_collected', 'order_cancelled')),
	enabled     boolean not null,
	updated_at  timestamptz not null default now(),
	primary key (player_id, kind)
);

comment on table public.tbl_email_prefs is
	'Receipt emails (20261124170346): a player''s switch per shop email. No row means on. Written only through tdc_set_email_pref.';

alter table public.tbl_email_prefs enable row level security;
grant select, insert, update, delete on public.tbl_email_prefs to service_role;


-- ─── 2. The queue ───
create table public.tbl_shop_emails (
	id           uuid primary key default gen_random_uuid(),
	created_at   timestamptz not null default clock_timestamp(),
	venue_id     uuid not null references public.tbl_venues (id) on delete cascade,
	player_id    uuid not null references public.tbl_players (id) on delete cascade,
	kind         text not null check (kind in ('top_up_paid', 'order_placed', 'order_ready', 'order_collected', 'order_cancelled')),
	order_id     uuid references public.tbl_shop_orders (id) on delete cascade,
	top_up_id    uuid references public.tbl_credit_top_ups (id) on delete cascade,
	-- waiting: not sent yet; sent; skipped: never to be sent (over a day old, or no address);
	-- failed: Resend refused it five times.
	status       text not null default 'waiting' check (status in ('waiting', 'sent', 'skipped', 'failed')),
	attempts     integer not null default 0 check (attempts >= 0),
	claimed_at   timestamptz,
	sent_at      timestamptz,
	provider_id  text,
	last_error   text check (char_length(last_error) <= 500),

	constraint tbl_shop_emails_about check (
		(kind = 'top_up_paid' and top_up_id is not null and order_id is null)
		or (kind <> 'top_up_paid' and order_id is not null and top_up_id is null)
	),
	constraint tbl_shop_emails_sent check ((status = 'sent') = (sent_at is not null))
);

comment on table public.tbl_shop_emails is
	'Receipt emails (20261124170346): one row per email to send. Added by triggers on tbl_shop_orders and tbl_credit_top_ups; claimed and marked by the send-shop-emails edge function. The email is built when sent, from the order or top-up as it is then. No browser access.';

create index tbl_shop_emails_waiting_idx on public.tbl_shop_emails (created_at) where status = 'waiting';
create index tbl_shop_emails_player_idx on public.tbl_shop_emails (player_id);

alter table public.tbl_shop_emails enable row level security;
grant select, insert, update on public.tbl_shop_emails to service_role;


-- ─── 3. Adding to the queue ───
-- Only for an account with a confirmed email (a walk-in has nowhere to send to; an address never
-- confirmed may be mistyped), and only while the player's switch for it is on.
create function private.tdc_queue_shop_email(p_venue_id uuid, p_player_id uuid, p_kind text, p_order_id uuid, p_top_up_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not exists (
		select 1 from public.tbl_players p
		join auth.users u on u.id = p.user_id
		where p.id = p_player_id and u.email is not null and u.email_confirmed_at is not null
	) then
		return;
	end if;
	if exists (
		select 1 from public.tbl_email_prefs
		where player_id = p_player_id and kind = p_kind and not enabled
	) then
		return;
	end if;
	insert into public.tbl_shop_emails (venue_id, player_id, kind, order_id, top_up_id)
	values (p_venue_id, p_player_id, p_kind, p_order_id, p_top_up_id);
end;
$$;

revoke execute on function private.tdc_queue_shop_email(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

-- An order: placed (insert); ready, collected, cancelled (a change of status). Preparing and a
-- step back send nothing; a step back and Ready again sends a second "ready", as the push does.
-- The order's lines are written after the order in the same transaction; the email is built at
-- send time, so it always has them.
create function private.tdc_shop_order_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		perform private.tdc_queue_shop_email(new.venue_id, new.player_id, 'order_placed', new.id, null);
	elsif new.status is distinct from old.status and new.status in ('ready', 'collected', 'cancelled') then
		perform private.tdc_queue_shop_email(new.venue_id, new.player_id, 'order_' || new.status, new.id, null);
	end if;
	return null;
end;
$$;

revoke execute on function private.tdc_shop_order_email() from public, anon, authenticated;

create trigger tbl_shop_orders_email
	after insert or update of status on public.tbl_shop_orders
	for each row execute function private.tdc_shop_order_email();

-- A top-up: only when staff confirm it (paid).
create function private.tdc_top_up_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.status = 'paid' and old.status is distinct from 'paid' then
		perform private.tdc_queue_shop_email(new.venue_id, new.player_id, 'top_up_paid', null, new.id);
	end if;
	return null;
end;
$$;

revoke execute on function private.tdc_top_up_email() from public, anon, authenticated;

create trigger tbl_credit_top_ups_email
	after update of status on public.tbl_credit_top_ups
	for each row execute function private.tdc_top_up_email();


-- ─── 4. What the email says ───
-- Everything the edge function needs, read when the email is sent.
create function private.tdc_shop_email_payload(p_kind text, p_player_id uuid, p_order_id uuid, p_top_up_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_order  public.tbl_shop_orders%rowtype;
	v_top_up public.tbl_credit_top_ups%rowtype;
	v_user   uuid;
	v_who    jsonb;
	v_venue  jsonb;
begin
	select p.user_id, jsonb_build_object('first_name', p.first_name, 'display_name', p.display_name)
	into v_user, v_who
	from public.tbl_players p where p.id = p_player_id;

	if p_order_id is not null then
		select * into v_order from public.tbl_shop_orders where id = p_order_id;
	else
		select * into v_top_up from public.tbl_credit_top_ups where id = p_top_up_id;
	end if;

	select jsonb_build_object(
		'venue_name',    v.name,
		'venue_address', v.address,
		'venue_area',    v.area,
		'venue_city',    v.city,
		'timezone',      coalesce(nullif(v.timezone, ''), 'Africa/Johannesburg')
	) into v_venue
	from public.tbl_venues v where v.id = coalesce(v_order.venue_id, v_top_up.venue_id);

	if p_order_id is not null then
		return private.tdc_shop_order_json(v_order) || v_venue || v_who || jsonb_build_object(
			'kind',          p_kind,
			'paid_method',   v_order.paid_method,
			'collected_at',  v_order.collected_at,
			-- you: the player cancelled it; club: staff did; uncollected: the nightly job.
			'cancelled_by',  case
				when v_order.cancelled_at is null then null
				when v_order.cancelled_by is null then 'uncollected'
				when v_order.cancelled_by = v_user then 'you'
				else 'club' end,
			'refunded',      exists (select 1 from public.tbl_credit_ledger where order_id = v_order.id and entry_type = 'order_refund')
		);
	end if;

	return v_venue || v_who || jsonb_build_object(
		'kind',          p_kind,
		'id',            v_top_up.id,
		'code',          v_top_up.code,
		'credits',       v_top_up.credits,
		'discount_pct',  v_top_up.discount_pct,
		'gross_cents',   v_top_up.gross_cents,
		'pay_cents',     v_top_up.pay_cents,
		'paid_method',   v_top_up.paid_method,
		'paid_at',       v_top_up.paid_at,
		'balance',       private.tdc_credit_balance(v_top_up.venue_id, v_top_up.player_id)
	);
end;
$$;

revoke execute on function private.tdc_shop_email_payload(text, uuid, uuid, uuid) from public, anon, authenticated;


-- ─── 5. The sweep ───
-- In public for the reason tdc_claim_pushes is: the edge function calls it over the API. Locked
-- to service_role, which the browser never holds.
--
-- Claiming marks the row (claimed_at, attempts) in one statement with skip locked, so two sweeps
-- never take the same row. A claimed row that is never marked (the function died) is claimed
-- again after 10 minutes; Resend is given the row's id as its idempotency key, so a retry after a
-- send that did go through is not sent twice.
create function public.tdc_claim_shop_emails(p_limit integer default 10)
returns table (email_id uuid, kind text, to_email text, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
	-- Retired without sending. Over a day old: a "ready" a day late is no longer true, and a
	-- backlog (the key not yet set, say) should not land all at once.
	update public.tbl_shop_emails e
	set status = 'skipped', last_error = 'Over a day old'
	where e.status = 'waiting' and e.created_at < now() - interval '1 day';

	-- The address went (or was changed and not yet confirmed) since it was queued.
	update public.tbl_shop_emails e
	set status = 'skipped', last_error = 'No confirmed email address'
	where e.status = 'waiting'
		and not exists (
			select 1 from public.tbl_players p
			join auth.users u on u.id = p.user_id
			where p.id = e.player_id and u.email is not null and u.email_confirmed_at is not null
		);

	return query
	with claimed as (
		select e.id
		from public.tbl_shop_emails e
		where e.status = 'waiting' and e.attempts < 5
			and (e.claimed_at is null or e.claimed_at < now() - interval '10 minutes')
		order by e.created_at
		limit greatest(1, least(coalesce(p_limit, 10), 50))
		for update skip locked
	)
	update public.tbl_shop_emails e
	set claimed_at = now(), attempts = e.attempts + 1
	from claimed c
	where e.id = c.id
	returning e.id, e.kind,
		(select u.email::text from public.tbl_players p join auth.users u on u.id = p.user_id where p.id = e.player_id),
		private.tdc_shop_email_payload(e.kind, e.player_id, e.order_id, e.top_up_id);
end;
$$;

revoke execute on function public.tdc_claim_shop_emails(integer) from public, anon, authenticated;
grant execute on function public.tdc_claim_shop_emails(integer) to service_role;

-- After each send: no error, sent; an error, kept on the row and tried again after 10 minutes,
-- until the fifth attempt, then failed.
create function public.tdc_mark_shop_email(p_id uuid, p_provider_id text, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
	update public.tbl_shop_emails
	set status      = case when p_error is null then 'sent' when attempts >= 5 then 'failed' else 'waiting' end,
		sent_at     = case when p_error is null then now() end,
		provider_id = coalesce(p_provider_id, provider_id),
		last_error  = case when p_error is null then last_error else left(p_error, 500) end
	where id = p_id and status = 'waiting';
$$;

revoke execute on function public.tdc_mark_shop_email(uuid, text, text) from public, anon, authenticated;
grant execute on function public.tdc_mark_shop_email(uuid, text, text) to service_role;

-- Is there anything to send? For a page, so it skips the edge function when nothing is waiting.
-- A number about the queue as a whole, nothing about who.
create function public.tdc_shop_emails_waiting()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select count(*)::integer
	from public.tbl_shop_emails
	where status = 'waiting' and attempts < 5
		and created_at >= now() - interval '1 day'
		and (claimed_at is null or claimed_at < now() - interval '10 minutes');
$$;

revoke execute on function public.tdc_shop_emails_waiting() from public, anon;
grant execute on function public.tdc_shop_emails_waiting() to authenticated;


-- ─── 6. The profile's switches ───
-- Every email with its setting, rows or not, and the address they go to.
create function public.tdc_email_prefs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_me uuid;
begin
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	return jsonb_build_object(
		'email', (select email::text from auth.users where id = (select auth.uid())),
		'prefs', (
			select jsonb_agg(jsonb_build_object('kind', k.kind, 'enabled', coalesce(f.enabled, true)) order by k.n)
			from unnest(array['top_up_paid', 'order_placed', 'order_ready', 'order_collected', 'order_cancelled'])
				with ordinality as k(kind, n)
			left join public.tbl_email_prefs f on f.player_id = v_me and f.kind = k.kind
		)
	);
end;
$$;

revoke execute on function public.tdc_email_prefs() from public, anon;
grant execute on function public.tdc_email_prefs() to authenticated;

create function public.tdc_set_email_pref(p_kind text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me uuid;
begin
	if p_kind is null or p_kind not in ('top_up_paid', 'order_placed', 'order_ready', 'order_collected', 'order_cancelled') then
		raise exception 'TDC (Error): unknown email "%".', p_kind;
	end if;
	if p_enabled is null then
		raise exception 'TDC (Error): an email setting is on or off.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	insert into public.tbl_email_prefs (player_id, kind, enabled)
	values (v_me, p_kind, p_enabled)
	on conflict (player_id, kind) do update
		set enabled = excluded.enabled, updated_at = now();
end;
$$;

revoke execute on function public.tdc_set_email_pref(text, boolean) from public, anon;
grant execute on function public.tdc_set_email_pref(text, boolean) to authenticated;


-- ─── 7. The nightly job tells the player (UV, 24 Nov) ───
-- private.tdc_notify_order, patched from 20261124155021: a third kind, 'uncollected'. The job runs
-- with nobody signed in, so there is no actor and the player is always told.
create or replace function private.tdc_notify_order(p_row public.tbl_shop_orders, p_kind text)
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
	elsif p_kind = 'uncollected' then
		perform private.tdc_notify(p_row.player_id, 'shop', 'order_uncollected',
			v_label || ' wasn''t collected in time',
			case when p_row.pay_with = 'credits' and p_row.paid_at is not null
				then p_row.total_credits || ' credits are back in your account.'
				else 'Nothing was charged.' end,
			'/accounts/profile/', null, null, null);
	else
		raise exception 'TDC (Error): unknown order notice "%".', p_kind;
	end if;
end;
$$;

-- private.tdc_cancel_uncollected_orders, patched from 20261124160613: one line, the notice.
create or replace function private.tdc_cancel_uncollected_orders()
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
		perform private.tdc_notify_order(v_row, 'uncollected');
		v_count := v_count + 1;
	end loop;
	return v_count;
end;
$$;


-- ─── 8. The merge ───
-- private.tdc_merge_players, patched from the definition a fresh reset gives (last changed in
-- 20261124152509): the two new tables, after the shop orders. Nothing else changed.
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

	-- Receipt emails (20261124170346). The switches cascade on delete, so without this a claim
	-- would turn every email back on; where both somehow have one for the same email, the
	-- account's stands (as the notification settings). The queue would vanish with the record.
	delete from public.tbl_email_prefs k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_email_prefs r where r.player_id = p_remove_id and r.kind = k.kind);
	update public.tbl_email_prefs set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_shop_emails set player_id = p_keep_id where player_id = p_remove_id;

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
