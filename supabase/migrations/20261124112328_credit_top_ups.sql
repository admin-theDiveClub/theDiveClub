-- Credits, part 3: buying credits (the shop's Stage 1; docs/design/shop.md; DECISIONS 24 Nov).
--
-- A player asks for credits from the Add credits card, gets a short code, and pays at the club.
-- Staff find the request (scan or type the code), take the money and confirm it: only then do
-- the credits land, as one ledger row that can never land twice. Until then the request adds
-- nothing to anybody's balance.
--
--   1. tbl_credit_prices: each venue's price, set by its owner or admin, never in code.
--      The Dive Club starts at R1 a credit, 10 to 1,000 in steps of 10, no discounts (UV, 24 Nov).
--      A discount step is money off: 250 credits at 10% off cost R225 (UV, 24 Nov).
--   2. tbl_credit_top_ups: the request. Its price is frozen onto it when it is made, so a later
--      price change never alters a request already waiting. A request lasts 24 hours, then shows
--      as expired and the player starts a new one (UV, 24 Nov). Starting a new one cancels the
--      player's older waiting one at that venue (UV, 24 Nov).
--   3. The ledger takes a new entry kind, 'top_up', with its own link to the request (Claude's,
--      approved by UV 24 Nov), unique, so the database itself refuses a second landing.
--   4. Any staff at the venue may confirm, recording Cash or Card (UV, 24 Nov); nobody may confirm
--      their own. A wrong confirmation is put right with an owner's adjustment, never undone.
--
-- The code is stored as it is, unlike a printed redeem code: it is only a reference. It can add
-- credits only to the person who made the request, and only once staff have taken the money.
-- When a payment gateway arrives (shop Stage 6), its confirmation marks the same request paid,
-- with its own method; nothing here is rebuilt.

-- ─── 1. Prices ───
create table public.tbl_credit_prices (
	venue_id          uuid primary key references public.tbl_venues (id) on delete cascade,
	cents_per_credit  integer not null check (cents_per_credit between 1 and 100000),
	min_credits       integer not null check (min_credits >= 1),
	max_credits       integer not null check (max_credits <= 100000),
	step_credits      integer not null check (step_credits >= 1),
	-- Discount steps, lowest first: [{"at": 250, "pct": 10}, ...]. Empty = no discounts.
	tiers             jsonb not null default '[]' check (jsonb_typeof(tiers) = 'array'),
	updated_at        timestamptz not null default now(),
	updated_by        uuid references auth.users (id) on delete set null,

	constraint tbl_credit_prices_range check (min_credits <= max_credits),
	constraint tbl_credit_prices_steps check ((max_credits - min_credits) % step_credits = 0)
);

comment on table public.tbl_credit_prices is
	'Credit top-ups (20261124112328): what a venue''s credits cost. Set through tdc_set_credit_prices by its owner or admin.';

alter table public.tbl_credit_prices enable row level security;
-- No policies: read through tdc_credit_prices, written through tdc_set_credit_prices.
grant select, insert, update, delete on public.tbl_credit_prices to service_role;

insert into public.tbl_credit_prices (venue_id, cents_per_credit, min_credits, max_credits, step_credits, tiers)
select id, 100, 10, 1000, 10, '[]' from public.tbl_venues where slug = 'the-dive-club';

-- ─── 2. Top-up requests ───
create table public.tbl_credit_top_ups (
	id                uuid primary key default gen_random_uuid(),
	created_at        timestamptz not null default now(),
	venue_id          uuid not null references public.tbl_venues (id) on delete restrict,
	player_id         uuid not null references public.tbl_players (id) on delete restrict,
	credits           integer not null check (credits between 1 and 100000),
	cents_per_credit  integer not null check (cents_per_credit >= 1),
	gross_cents       integer not null check (gross_cents >= 0),
	discount_pct      integer not null default 0 check (discount_pct between 0 and 90),
	pay_cents         integer not null check (pay_cents >= 0),
	code              text not null check (code ~ '^[2-9A-HJ-NP-Z]{4}$'),
	status            text not null default 'waiting' check (status in ('waiting', 'paid', 'cancelled')),
	expires_at        timestamptz not null,
	created_by        uuid references auth.users (id) on delete set null,
	paid_at           timestamptz,
	paid_by           uuid references auth.users (id) on delete set null,
	paid_method       text check (paid_method in ('cash', 'card')),
	cancelled_at      timestamptz,

	constraint tbl_credit_top_ups_sums check (gross_cents = credits * cents_per_credit and pay_cents <= gross_cents),
	constraint tbl_credit_top_ups_status_matches_fields check (
		(status = 'waiting'      and paid_at is null and paid_method is null and cancelled_at is null)
		or (status = 'paid'      and paid_at is not null and paid_method is not null and cancelled_at is null)
		or (status = 'cancelled' and cancelled_at is not null and paid_at is null)
	)
);

comment on table public.tbl_credit_top_ups is
	'Credit top-ups (20261124112328): a request to buy credits, paid at the club. A waiting request past expires_at is expired. Written only through the tdc_ top-up functions.';

-- One waiting request per code at a venue, so a code staff type finds one request.
create unique index tbl_credit_top_ups_waiting_code on public.tbl_credit_top_ups (venue_id, code) where status = 'waiting';
create index tbl_credit_top_ups_player_idx on public.tbl_credit_top_ups (player_id, venue_id, created_at desc);
create index tbl_credit_top_ups_venue_waiting_idx on public.tbl_credit_top_ups (venue_id, created_at) where status = 'waiting';

-- Rows change only through the functions below, each switching on 'tdc.top_up_write' for its one
-- update; never deleted, so the history of every request stays whole.
create function private.tdc_credit_top_ups_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		return new;
	end if;
	if tg_op = 'UPDATE' and current_setting('tdc.top_up_write', true) = 'on' then
		return new;
	end if;
	raise exception 'TDC (Error): a top-up can''t be changed or deleted directly.';
end;
$$;

create trigger tbl_credit_top_ups_guard
	before update or delete on public.tbl_credit_top_ups
	for each row execute function private.tdc_credit_top_ups_guard();

create trigger tbl_credit_top_ups_no_truncate
	before truncate on public.tbl_credit_top_ups
	for each statement execute function private.tdc_credit_top_ups_guard();

revoke execute on function private.tdc_credit_top_ups_guard() from public, anon, authenticated;

alter table public.tbl_credit_top_ups enable row level security;
-- No policies: every read goes through the functions below.
grant select, insert, update on public.tbl_credit_top_ups to service_role;

-- ─── 3. The ledger: a confirmed top-up is its own entry kind, linked to its request ───
alter table public.tbl_credit_ledger drop constraint tbl_credit_ledger_entry_type_check;
alter table public.tbl_credit_ledger add constraint tbl_credit_ledger_entry_type_check
	check (entry_type in ('adjustment', 'code', 'top_up'));

alter table public.tbl_credit_ledger
	add column top_up_id uuid unique references public.tbl_credit_top_ups (id) on delete restrict;

alter table public.tbl_credit_ledger add constraint tbl_credit_ledger_top_up_link
	check ((entry_type = 'top_up') = (top_up_id is not null));

comment on column public.tbl_credit_ledger.top_up_id is
	'Credit top-ups (20261124112328): the request a top_up entry pays out. Unique, so a request lands once.';

-- ─── Internal: the price row, the quote, the caller's player ───

-- What a number of credits costs at a venue now. Refuses an amount off the slider.
create function private.tdc_top_up_quote(p_venue_id uuid, p_credits integer)
returns table (cents_per_credit integer, gross_cents integer, discount_pct integer, pay_cents integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_price public.tbl_credit_prices%rowtype;
	v_pct   integer := 0;
	v_tier  jsonb;
begin
	select * into v_price from public.tbl_credit_prices where venue_id = p_venue_id;
	if v_price.venue_id is null then
		raise exception 'This venue doesn''t sell credits online yet.';
	end if;
	if p_credits is null or p_credits < v_price.min_credits or p_credits > v_price.max_credits then
		raise exception 'Please choose between % and % credits.', v_price.min_credits, v_price.max_credits;
	end if;
	if (p_credits - v_price.min_credits) % v_price.step_credits <> 0 then
		raise exception 'Please choose credits in steps of %.', v_price.step_credits;
	end if;

	for v_tier in select * from jsonb_array_elements(v_price.tiers) loop
		if p_credits >= (v_tier->>'at')::integer then
			v_pct := greatest(v_pct, (v_tier->>'pct')::integer);
		end if;
	end loop;

	cents_per_credit := v_price.cents_per_credit;
	gross_cents      := p_credits * v_price.cents_per_credit;
	discount_pct     := v_pct;
	pay_cents        := gross_cents - round(gross_cents * v_pct / 100.0)::integer;
	return next;
end;
$$;

revoke execute on function private.tdc_top_up_quote(uuid, integer) from public, anon, authenticated;

-- A request as the pages see it. state: waiting, expired, paid or cancelled.
create function private.tdc_top_up_json(p_row public.tbl_credit_top_ups)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'id',               p_row.id,
		'venue_id',         p_row.venue_id,
		'created_at',       p_row.created_at,
		'credits',          p_row.credits,
		'cents_per_credit', p_row.cents_per_credit,
		'gross_cents',      p_row.gross_cents,
		'discount_pct',     p_row.discount_pct,
		'pay_cents',        p_row.pay_cents,
		'code',             p_row.code,
		'state',            case when p_row.status = 'waiting' and p_row.expires_at <= now() then 'expired' else p_row.status end,
		'expires_at',       p_row.expires_at,
		'paid_at',          p_row.paid_at,
		'paid_method',      p_row.paid_method
	);
$$;

revoke execute on function private.tdc_top_up_json(public.tbl_credit_top_ups) from public, anon, authenticated;

-- The signed-in caller's player row, or a plain refusal.
create function private.tdc_my_player_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_player_id uuid;
begin
	if auth.uid() is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	select id into v_player_id from public.tbl_players where user_id = (select auth.uid());
	if v_player_id is null then
		raise exception 'TDC (Error): no player profile found for this account.';
	end if;
	return v_player_id;
end;
$$;

revoke execute on function private.tdc_my_player_id() from public, anon, authenticated;

-- ─── 1. Anyone signed in: a venue's price, for the Add credits card ───
create function public.tdc_credit_prices(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_price public.tbl_credit_prices%rowtype;
begin
	if auth.uid() is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	select p.* into v_price
	from public.tbl_credit_prices p
	join public.tbl_venues v on v.id = p.venue_id
	where p.venue_id = p_venue_id and v.active and v.sells_credits;
	if v_price.venue_id is null then
		raise exception 'This venue doesn''t sell credits online yet.';
	end if;
	return jsonb_build_object(
		'venue_id',         v_price.venue_id,
		'cents_per_credit', v_price.cents_per_credit,
		'min_credits',      v_price.min_credits,
		'max_credits',      v_price.max_credits,
		'step_credits',     v_price.step_credits,
		'tiers',            v_price.tiers
	);
end;
$$;

-- ─── 2. A player: ask for credits. Returns the request with its code. ───
-- Cancels the caller's older waiting request at this venue (one code at a time; UV, 24 Nov).
create function public.tdc_start_top_up(p_venue_id uuid, p_credits integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_player_id uuid := private.tdc_my_player_id();
	v_alphabet  text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
	v_quote     record;
	v_code      text;
	v_row       public.tbl_credit_top_ups%rowtype;
	v_attempt   integer := 0;
begin
	if not exists (select 1 from public.tbl_venues where id = p_venue_id and active and sells_credits) then
		raise exception 'This venue doesn''t sell credits online yet.';
	end if;
	if exists (select 1 from public.tbl_players where id = v_player_id and player_type = 'guest') then
		raise exception 'Guests can''t hold credits. Their play is paid by their host.';
	end if;

	select * into v_quote from private.tdc_top_up_quote(p_venue_id, p_credits);

	-- One request at a time per player at this venue, so a double tap can't leave two waiting.
	perform pg_advisory_xact_lock(hashtextextended('top_up:' || p_venue_id::text || ':' || v_player_id::text, 0));

	perform set_config('tdc.top_up_write', 'on', true);
	update public.tbl_credit_top_ups
	set status = 'cancelled', cancelled_at = now()
	where venue_id = p_venue_id and player_id = v_player_id and status = 'waiting';
	perform set_config('tdc.top_up_write', 'off', true);

	loop
		v_attempt := v_attempt + 1;
		if v_attempt > 20 then
			raise exception 'TDC (Error): could not make a unique code, please try again.';
		end if;
		select string_agg(substr(v_alphabet, 1 + (get_byte(extensions.gen_random_bytes(4), n) % 32), 1), '')
		into v_code
		from generate_series(0, 3) as n;
		begin
			insert into public.tbl_credit_top_ups
				(created_at, venue_id, player_id, credits, cents_per_credit, gross_cents, discount_pct, pay_cents, code, expires_at, created_by)
			values
				(clock_timestamp(), p_venue_id, v_player_id, p_credits, v_quote.cents_per_credit, v_quote.gross_cents, v_quote.discount_pct,
				 v_quote.pay_cents, v_code, clock_timestamp() + interval '24 hours', auth.uid())
			returning * into v_row;
			exit;
		exception
			when unique_violation then
				continue;
		end;
	end loop;

	return private.tdc_top_up_json(v_row);
end;
$$;

-- ─── 3. A player: my requests at a venue, newest first (the last 10) ───
create function public.tdc_my_top_ups(p_venue_id uuid)
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
		select private.tdc_top_up_json(t)
		from public.tbl_credit_top_ups t
		where t.venue_id = p_venue_id and t.player_id = v_player_id
		order by t.created_at desc
		limit 10;
end;
$$;

-- ─── 4. A player: cancel my waiting request ───
create function public.tdc_cancel_my_top_up(p_top_up_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_player_id uuid := private.tdc_my_player_id();
	v_row       public.tbl_credit_top_ups%rowtype;
begin
	perform set_config('tdc.top_up_write', 'on', true);
	update public.tbl_credit_top_ups
	set status = 'cancelled', cancelled_at = now()
	where id = p_top_up_id and player_id = v_player_id and status = 'waiting'
	returning * into v_row;
	perform set_config('tdc.top_up_write', 'off', true);

	if v_row.id is null then
		if exists (select 1 from public.tbl_credit_top_ups where id = p_top_up_id and player_id = v_player_id and status = 'paid') then
			raise exception 'That top-up is already paid.';
		end if;
		raise exception 'That top-up isn''t waiting any more.';
	end if;
	return private.tdc_top_up_json(v_row);
end;
$$;

-- ─── 5. Staff: the requests waiting at their venue (not expired), oldest first ───
-- With who asked, so staff can see the right person before confirming.
create function public.tdc_staff_top_ups(p_venue_id uuid)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	return query
		select private.tdc_top_up_json(t) || jsonb_build_object(
			'player_id',    p.id,
			'display_name', p.display_name,
			'first_name',   p.first_name,
			'last_name',    p.last_name,
			'avatar_path',  p.avatar_path
		)
		from public.tbl_credit_top_ups t
		join public.tbl_players p on p.id = t.player_id
		where t.venue_id = p_venue_id and t.status = 'waiting' and t.expires_at > now()
		order by t.created_at;
end;
$$;

-- ─── 6. Staff: find a request by its code (whatever its state, so the page can say why) ───
-- Returns null when no request at this venue has that code.
create function public.tdc_staff_find_top_up(p_venue_id uuid, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
	v_out  jsonb;
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	if v_code = '' then
		raise exception 'Please enter a code.';
	end if;
	-- A waiting one first, else the newest with that code.
	select private.tdc_top_up_json(t) || jsonb_build_object(
		'player_id',    p.id,
		'display_name', p.display_name,
		'first_name',   p.first_name,
		'last_name',    p.last_name,
		'avatar_path',  p.avatar_path
	)
	into v_out
	from public.tbl_credit_top_ups t
	join public.tbl_players p on p.id = t.player_id
	where t.venue_id = p_venue_id and t.code = v_code
	order by (t.status = 'waiting') desc, t.created_at desc
	limit 1;
	return v_out;
end;
$$;

-- ─── 7. Staff: the money came in. Lands the credits; returns the player's new balance. ───
create function public.tdc_staff_confirm_top_up(p_venue_id uuid, p_top_up_id uuid, p_method text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_row     public.tbl_credit_top_ups%rowtype;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	if p_method is null or p_method not in ('cash', 'card') then
		raise exception 'Please choose Cash or Card.';
	end if;

	select * into v_row from public.tbl_credit_top_ups
	where id = p_top_up_id and venue_id = p_venue_id
	for update;

	if v_row.id is null then
		raise exception 'That top-up isn''t recognised here.';
	end if;
	if exists (select 1 from public.tbl_players where id = v_row.player_id and user_id = v_user_id) then
		raise exception 'You can''t confirm your own top-up. Please ask another staff member.';
	end if;
	if v_row.status = 'paid' then
		raise exception 'That top-up is already paid.';
	end if;
	if v_row.status = 'cancelled' then
		raise exception 'That top-up was cancelled. Ask them to start a new one.';
	end if;
	if v_row.expires_at <= now() then
		raise exception 'That top-up has expired. Ask them to start a new one.';
	end if;

	perform set_config('tdc.top_up_write', 'on', true);
	update public.tbl_credit_top_ups
	set status = 'paid', paid_at = now(), paid_by = v_user_id, paid_method = p_method
	where id = v_row.id;
	perform set_config('tdc.top_up_write', 'off', true);

	insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, created_by, idempotency_key, top_up_id)
	values (p_venue_id, v_row.player_id, v_row.credits, 'top_up', v_user_id, 'top_up:' || v_row.id, v_row.id);

	return private.tdc_credit_balance(p_venue_id, v_row.player_id);
end;
$$;

-- ─── 8. Owners and admins: set a venue's price ───
-- p_tiers: [{"at": 250, "pct": 10}, ...], each step inside the range and on it, both rising.
create function public.tdc_set_credit_prices(
	p_venue_id          uuid,
	p_cents_per_credit  integer,
	p_min_credits       integer,
	p_max_credits       integer,
	p_step_credits      integer,
	p_tiers             jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tier     jsonb;
	v_last_at  integer := 0;
	v_last_pct integer := 0;
	v_at       integer;
	v_pct      integer;
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
		raise exception 'Only owners and admins can set credit prices.';
	end if;
	if not exists (select 1 from public.tbl_venues where id = p_venue_id and sells_credits) then
		raise exception 'This venue doesn''t sell credits.';
	end if;
	if p_cents_per_credit is null or p_cents_per_credit < 1 or p_cents_per_credit > 100000 then
		raise exception 'Please enter a price per credit between 1 cent and R1,000.';
	end if;
	if p_min_credits is null or p_max_credits is null or p_step_credits is null
	   or p_min_credits < 1 or p_max_credits > 100000 or p_step_credits < 1 or p_min_credits > p_max_credits then
		raise exception 'Please enter a range from at least 1 credit, up to 100,000, with a step of at least 1.';
	end if;
	if (p_max_credits - p_min_credits) % p_step_credits <> 0 then
		raise exception 'The step must fit the range exactly (from % to % in steps of % doesn''t).', p_min_credits, p_max_credits, p_step_credits;
	end if;
	if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' then
		raise exception 'TDC (Error): discount steps must be a list.';
	end if;

	for v_tier in select * from jsonb_array_elements(p_tiers) loop
		begin
			v_at  := (v_tier->>'at')::integer;
			v_pct := (v_tier->>'pct')::integer;
		exception when others then
			raise exception 'TDC (Error): each discount step needs a whole number of credits and a whole percent.';
		end;
		if v_at is null or v_pct is null then
			raise exception 'TDC (Error): each discount step needs a whole number of credits and a whole percent.';
		end if;
		if v_at <= p_min_credits or v_at > p_max_credits or (v_at - p_min_credits) % p_step_credits <> 0 then
			raise exception 'A discount at % credits is off the slider (above % up to %, in steps of %).', v_at, p_min_credits, p_max_credits, p_step_credits;
		end if;
		if v_pct < 1 or v_pct > 90 then
			raise exception 'A discount must be between 1%% and 90%%.';
		end if;
		if v_at <= v_last_at or v_pct <= v_last_pct then
			raise exception 'Discount steps must go up: more credits, a bigger discount.';
		end if;
		v_last_at := v_at;
		v_last_pct := v_pct;
	end loop;

	insert into public.tbl_credit_prices (venue_id, cents_per_credit, min_credits, max_credits, step_credits, tiers, updated_at, updated_by)
	values (p_venue_id, p_cents_per_credit, p_min_credits, p_max_credits, p_step_credits,
		(select coalesce(jsonb_agg(jsonb_build_object('at', (t->>'at')::integer, 'pct', (t->>'pct')::integer)), '[]') from jsonb_array_elements(p_tiers) t),
		now(), auth.uid())
	on conflict (venue_id) do update
	set cents_per_credit = excluded.cents_per_credit,
		min_credits      = excluded.min_credits,
		max_credits      = excluded.max_credits,
		step_credits     = excluded.step_credits,
		tiers            = excluded.tiers,
		updated_at       = excluded.updated_at,
		updated_by       = excluded.updated_by;

	return public.tdc_credit_prices(p_venue_id);
end;
$$;

-- ─── Who can call these ───
revoke execute on function public.tdc_credit_prices(uuid)                                            from public, anon;
revoke execute on function public.tdc_start_top_up(uuid, integer)                                    from public, anon;
revoke execute on function public.tdc_my_top_ups(uuid)                                               from public, anon;
revoke execute on function public.tdc_cancel_my_top_up(uuid)                                         from public, anon;
revoke execute on function public.tdc_staff_top_ups(uuid)                                            from public, anon;
revoke execute on function public.tdc_staff_find_top_up(uuid, text)                                  from public, anon;
revoke execute on function public.tdc_staff_confirm_top_up(uuid, uuid, text)                         from public, anon;
revoke execute on function public.tdc_set_credit_prices(uuid, integer, integer, integer, integer, jsonb) from public, anon;

grant execute on function public.tdc_credit_prices(uuid)                                            to authenticated;
grant execute on function public.tdc_start_top_up(uuid, integer)                                    to authenticated;
grant execute on function public.tdc_my_top_ups(uuid)                                               to authenticated;
grant execute on function public.tdc_cancel_my_top_up(uuid)                                         to authenticated;
grant execute on function public.tdc_staff_top_ups(uuid)                                            to authenticated;
grant execute on function public.tdc_staff_find_top_up(uuid, text)                                  to authenticated;
grant execute on function public.tdc_staff_confirm_top_up(uuid, uuid, text)                         to authenticated;
grant execute on function public.tdc_set_credit_prices(uuid, integer, integer, integer, integer, jsonb) to authenticated;

-- ─── The merge: top-up requests move with the player ───
-- Patched from the latest definition (20261119124608_doubles_matches), one block added after the
-- redeem codes. Restrict on delete, so without it a claim by an account that had ever asked for
-- credits would fail on deleting the signup record.
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
