-- Credits, part 1: the ledger.
-- Every credit movement is one row in tbl_credit_ledger. A player's balance at a venue is the sum of their rows there.
-- Rows can never be edited or deleted: mistakes are fixed with a new opposite entry, so the history always adds up.
--
-- Rules:
--   - Credits are venue-scoped: a balance at one venue can't be spent at another.
--   - Members and walk-ins can hold credits. Guests can't: their play is paid from their host's balance (later step).
--   - A balance can never go below zero.
--   - For now the only way in or out is a manual adjustment by an owner or admin (reason required).
--     Cash codes, payments and table sessions come in later migrations, which add their own entry types.
--   - When a walk-in record is claimed, its credits stay with it, and any credits on the signup record move across (see tdc_merge_players below).

-- ─── The ledger ───
create table public.tbl_credit_ledger (
	id               uuid primary key default gen_random_uuid(),
	created_at       timestamptz not null default now(),
	venue_id         uuid not null references public.tbl_venues (id) on delete restrict,
	player_id        uuid not null references public.tbl_players (id) on delete restrict,
	amount           integer not null check (amount <> 0),              -- whole credits: + in, − out
	entry_type       text not null check (entry_type in ('adjustment')), -- later: code, purchase, spend, ...
	reason           text check (reason is null or char_length(trim(reason)) between 3 and 500),
	created_by       uuid references auth.users (id) on delete set null,
	idempotency_key  text not null unique check (char_length(idempotency_key) between 8 and 100),

	constraint tbl_credit_ledger_adjustment_needs_reason
		check (entry_type <> 'adjustment' or reason is not null)
);

create index tbl_credit_ledger_venue_player_idx on public.tbl_credit_ledger (venue_id, player_id);
create index tbl_credit_ledger_player_idx       on public.tbl_credit_ledger (player_id);
create index tbl_credit_ledger_created_by_idx   on public.tbl_credit_ledger (created_by);

-- ─── Guard: guests can't hold credits; rows can't be edited or deleted ───
-- Two narrow exceptions, both automatic:
--   1. tdc_merge_players moves rows to the kept player record (it switches on 'tdc.ledger_merge' for that moment only).
--   2. If a staff login is deleted, created_by becomes empty (the database does this itself).
create function private.tdc_credit_ledger_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		if exists (select 1 from public.tbl_players where id = new.player_id and player_type = 'guest') then
			raise exception 'Guests can''t hold credits. Their play is paid by their host.';
		end if;
		return new;
	end if;

	if tg_op = 'UPDATE' then
		if current_setting('tdc.ledger_merge', true) = 'on'
		   and (to_jsonb(new) - 'player_id') = (to_jsonb(old) - 'player_id') then
			return new;
		end if;
		if new.created_by is null and old.created_by is not null
		   and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
			return new;
		end if;
	end if;

	raise exception 'TDC (Error): credit history can''t be changed or deleted. Add a correcting adjustment instead.';
end;
$$;

create trigger tbl_credit_ledger_guard
	before insert or update or delete on public.tbl_credit_ledger
	for each row execute function private.tdc_credit_ledger_guard();

create trigger tbl_credit_ledger_no_truncate
	before truncate on public.tbl_credit_ledger
	for each statement execute function private.tdc_credit_ledger_guard();

-- ─── Access rules: read only. All writes go through the functions below. ───
alter table public.tbl_credit_ledger enable row level security;

create policy "Players see their own credit history, staff see their venue's"
	on public.tbl_credit_ledger
	for select
	to authenticated
	using (
		exists (select 1 from public.tbl_players p where p.id = player_id and p.user_id = (select auth.uid()))
		or private.tdc_has_venue_role(venue_id, array['owner', 'admin', 'staff'])
	);

grant select on public.tbl_credit_ledger to authenticated;
grant select, insert on public.tbl_credit_ledger to service_role;

-- ─── Internal: a player's balance at a venue ───
create function private.tdc_credit_balance(p_venue_id uuid, p_player_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(sum(amount), 0)::integer
	from public.tbl_credit_ledger
	where venue_id = p_venue_id and player_id = p_player_id;
$$;

revoke execute on function private.tdc_credit_balance(uuid, uuid) from public, anon, authenticated;

-- ─── 1. A signed-in player: my balance at a venue ───
create function public.tdc_my_credit_balance(p_venue_id uuid)
returns integer
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

	return private.tdc_credit_balance(p_venue_id, v_player_id);
end;
$$;

-- ─── 2. Staff: a player's balance at their venue ───
create function public.tdc_staff_credit_balance(p_venue_id uuid, p_player_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	if not exists (select 1 from public.tbl_players where id = p_player_id) then
		raise exception 'TDC (Error): player not found.';
	end if;

	return private.tdc_credit_balance(p_venue_id, p_player_id);
end;
$$;

-- ─── 3. Owners and admins: add or remove credits by hand (reason required). Returns the new balance. ───
-- p_idempotency_key: a fresh random id from the page for each attempt, so a double-tap or retry can't apply twice.
create function public.tdc_staff_adjust_credits(
	p_venue_id         uuid,
	p_player_id        uuid,
	p_amount           integer,
	p_reason           text,
	p_idempotency_key  text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id  uuid := auth.uid();
	v_existing public.tbl_credit_ledger%rowtype;
	v_balance  integer;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
		raise exception 'Only owners and admins can adjust credits.';
	end if;
	if p_amount is null or p_amount = 0 then
		raise exception 'Please enter an amount other than zero.';
	end if;
	if abs(p_amount) > 100000 then
		raise exception 'That amount is too large for a manual adjustment.';
	end if;
	if nullif(trim(p_reason), '') is null or char_length(trim(p_reason)) < 3 then
		raise exception 'Please give a reason for the adjustment.';
	end if;
	if char_length(trim(p_reason)) > 500 then
		raise exception 'Please keep the reason under 500 characters.';
	end if;
	if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
		raise exception 'TDC (Error): missing or invalid idempotency key.';
	end if;
	if exists (select 1 from public.tbl_players where id = p_player_id and user_id = v_user_id) then
		raise exception 'You can''t adjust your own credits. Please ask another owner or admin.';
	end if;
	if not exists (select 1 from public.tbl_players where id = p_player_id) then
		raise exception 'TDC (Error): player not found.';
	end if;

	-- One change at a time per player at this venue, so two adjustments can't both pass the balance check.
	perform pg_advisory_xact_lock(hashtextextended(p_venue_id::text || ':' || p_player_id::text, 0));

	-- Already applied? Return the balance instead of applying it again.
	select * into v_existing from public.tbl_credit_ledger where idempotency_key = p_idempotency_key;
	if v_existing.id is not null then
		if v_existing.venue_id <> p_venue_id or v_existing.player_id <> p_player_id or v_existing.amount <> p_amount then
			raise exception 'TDC (Error): this request id was already used for a different change.';
		end if;
		return private.tdc_credit_balance(p_venue_id, p_player_id);
	end if;

	v_balance := private.tdc_credit_balance(p_venue_id, p_player_id);
	if v_balance + p_amount < 0 then
		raise exception 'That would take the balance below zero (current balance: % credits).', v_balance;
	end if;

	insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, reason, created_by, idempotency_key)
	values (p_venue_id, p_player_id, p_amount, 'adjustment', trim(p_reason), v_user_id, p_idempotency_key);

	return v_balance + p_amount;
end;
$$;

-- ─── Who can call these ───
revoke execute on function public.tdc_my_credit_balance(uuid)                            from public, anon;
revoke execute on function public.tdc_staff_credit_balance(uuid, uuid)                   from public, anon;
revoke execute on function public.tdc_staff_adjust_credits(uuid, uuid, integer, text, text) from public, anon;

grant execute on function public.tdc_my_credit_balance(uuid)                             to authenticated;
grant execute on function public.tdc_staff_credit_balance(uuid, uuid)                    to authenticated;
grant execute on function public.tdc_staff_adjust_credits(uuid, uuid, integer, text, text) to authenticated;

-- ─── Claiming: carry credits across when a walk-in record is joined to an account ───
-- Same as the walk_ins_and_claim version, plus the tbl_credit_ledger move.
-- ⚠ When new tables reference tbl_players (matches, credits, XP, ...), add them to the "move" section below.
create or replace function private.tdc_merge_players(p_keep_id uuid, p_remove_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

	-- Move everything that points at the signup record onto the walk-in record.
	update public.tbl_player_identifiers set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_players set guest_of_player_id = p_keep_id where guest_of_player_id = p_remove_id;

	-- Credits: the only time ledger rows may change owner. The switch is on for this transaction step only.
	perform set_config('tdc.ledger_merge', 'on', true);
	update public.tbl_credit_ledger set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.ledger_merge', 'off', true);

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
$$;

revoke execute on function private.tdc_merge_players(uuid, uuid, uuid) from public, anon, authenticated;
