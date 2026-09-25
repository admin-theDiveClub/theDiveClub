-- Cash redeem codes.
-- A player pays cash in the club; staff hand them a printed code that adds credits when redeemed.
-- The code itself is never stored: only a hash of it, the same way a password would be. If the database
-- were ever read directly, nobody could recover a working code from it, only that some code exists.
--
-- Flow:
--   1. Staff generate a batch (tdc_generate_redeem_codes). The plain codes are returned once, in that
--      response only, for printing. After that, only their hashes exist.
--   2. A player redeems their own code, or staff redeem one for a player who is with them (tdc_redeem_code).
--      Redeeming claims the code and adds a ledger entry in the same step, so a code can never be used twice,
--      even if two people try it at the same instant.

-- Let a credit_ledger entry come from a redeemed code, not just a manual adjustment.
alter table public.tbl_credit_ledger drop constraint tbl_credit_ledger_entry_type_check;
alter table public.tbl_credit_ledger add constraint tbl_credit_ledger_entry_type_check
	check (entry_type in ('adjustment', 'code'));

-- ─── The codes ───
create table public.tbl_redeem_codes (
	id                   uuid primary key default gen_random_uuid(),
	created_at           timestamptz not null default now(),
	venue_id             uuid not null references public.tbl_venues (id) on delete restrict,
	code_hash            text not null unique,
	credits              integer not null check (credits between 1 and 100000),
	status               text not null check (status in ('unused', 'redeemed', 'void')) default 'unused',
	note                 text check (note is null or char_length(trim(note)) between 1 and 200),
	expires_at           timestamptz,
	created_by           uuid references auth.users (id) on delete set null,
	redeemed_player_id   uuid references public.tbl_players (id) on delete restrict,
	redeemed_by          uuid references auth.users (id) on delete set null,
	redeemed_at          timestamptz,
	voided_by            uuid references auth.users (id) on delete set null,
	voided_at            timestamptz,

	constraint tbl_redeem_codes_status_matches_fields check (
		(status = 'unused'    and redeemed_at is null and redeemed_player_id is null and voided_at is null)
		or (status = 'redeemed' and redeemed_at is not null and redeemed_player_id is not null and voided_at is null)
		or (status = 'void'     and voided_at is not null and redeemed_at is null and redeemed_player_id is null)
	)
);

create index tbl_redeem_codes_venue_idx    on public.tbl_redeem_codes (venue_id);
create index tbl_redeem_codes_redeemed_idx on public.tbl_redeem_codes (redeemed_player_id);

-- Rows can't be edited or deleted directly, only through the functions below (which use security definer
-- to make the one permitted change each). Keeps a full, honest history of every code ever printed.
-- tdc_redeem_code and tdc_void_redeem_code turn on 'tdc.redeem_write' for their one controlled update.
-- Anything else, including a change from the dashboard, is blocked.
create function private.tdc_redeem_codes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'UPDATE' and current_setting('tdc.redeem_write', true) = 'on' then
		return new;
	end if;
	raise exception 'TDC (Error): redeem codes can''t be changed directly. Use the redeem or void functions.';
end;
$$;

create trigger tbl_redeem_codes_no_direct_write
	before update or delete on public.tbl_redeem_codes
	for each row execute function private.tdc_redeem_codes_guard();

create trigger tbl_redeem_codes_no_truncate
	before truncate on public.tbl_redeem_codes
	for each statement execute function private.tdc_redeem_codes_guard();

-- ─── Access rules: owners and admins can review the list (hashes only, never the plain code). ───
-- Generating and redeeming go through the functions below, open to all staff.
alter table public.tbl_redeem_codes enable row level security;

create policy "Owners and admins see their venue's codes"
	on public.tbl_redeem_codes
	for select
	to authenticated
	using (private.tdc_has_venue_role(venue_id, array['owner', 'admin']));

grant select on public.tbl_redeem_codes to authenticated;
grant select, insert, update, delete on public.tbl_redeem_codes to service_role;

-- ─── Internal: turn what someone typed into the same hash a stored code was saved as ───
-- Keep only letters and digits, ignore case: "wxyz-2345-6789", "WXYZ23456789" and pasted whitespace
-- around it all reach the same hash.
create function private.tdc_normalize_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
	select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

create function private.tdc_hash_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
	select encode(extensions.digest(private.tdc_normalize_code(p_code), 'sha256'), 'hex');
$$;

revoke execute on function private.tdc_normalize_code(text) from public, anon, authenticated;
revoke execute on function private.tdc_hash_code(text)      from public, anon, authenticated;

-- ─── 1. Staff generate a batch of codes. Returns the plain codes, once, for printing. ───
-- Excludes characters that look alike when printed or handwritten: 0/O, 1/I/L.
create function public.tdc_generate_redeem_codes(
	p_venue_id    uuid,
	p_credits     integer,
	p_quantity    integer,
	p_note        text default null,
	p_expires_at  timestamptz default null
)
returns table (code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id  uuid := auth.uid();
	v_alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
	v_raw      text;
	v_formatted text;
	v_attempt  integer;
	i          integer;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	if p_credits is null or p_credits < 1 or p_credits > 100000 then
		raise exception 'Please enter a credit value between 1 and 100000.';
	end if;
	if p_quantity is null or p_quantity < 1 or p_quantity > 200 then
		raise exception 'Please generate between 1 and 200 codes at a time.';
	end if;
	if p_note is not null and char_length(trim(p_note)) not between 1 and 200 then
		raise exception 'Please keep the note under 200 characters.';
	end if;
	if p_expires_at is not null and p_expires_at <= now() then
		raise exception 'The expiry date must be in the future.';
	end if;

	for i in 1..p_quantity loop
		v_attempt := 0;
		loop
			v_attempt := v_attempt + 1;
			if v_attempt > 5 then
				raise exception 'TDC (Error): could not generate a unique code, please try again.';
			end if;

			-- 12 random characters from a 32-character alphabet: about 60 bits, plenty for a cash code.
			select string_agg(substr(v_alphabet, 1 + (get_byte(extensions.gen_random_bytes(12), n) % 32), 1), '')
			into v_raw
			from generate_series(0, 11) as n;

			begin
				insert into public.tbl_redeem_codes (venue_id, code_hash, credits, note, expires_at, created_by)
				values (p_venue_id, private.tdc_hash_code(v_raw), p_credits, nullif(trim(p_note), ''), p_expires_at, v_user_id);
				exit;
			exception
				when unique_violation then
					continue;
			end;
		end loop;

		v_formatted := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
		code := v_formatted;
		return next;
	end loop;
end;
$$;

-- ─── 2. Redeem a code: self-serve, or staff redeeming one for a player with them. ───
-- p_player_id null = the caller's own player row. Given = staff crediting a chosen player (e.g. a walk-in).
create function public.tdc_redeem_code(
	p_venue_id   uuid,
	p_code       text,
	p_player_id  uuid default null
)
returns table (credits_added integer, new_balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id   uuid := auth.uid();
	v_player_id uuid;
	v_hash      text;
	v_row       public.tbl_redeem_codes%rowtype;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	if p_player_id is null then
		select id into v_player_id from public.tbl_players where user_id = v_user_id;
		if v_player_id is null then
			raise exception 'TDC (Error): no player profile found for this account.';
		end if;
	else
		if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
			raise exception 'You are not staff at this venue.';
		end if;
		if not exists (select 1 from public.tbl_players where id = p_player_id) then
			raise exception 'TDC (Error): player not found.';
		end if;
		v_player_id := p_player_id;
	end if;

	if exists (select 1 from public.tbl_players where id = v_player_id and player_type = 'guest') then
		raise exception 'Guests can''t hold credits. Redeem this for their host instead.';
	end if;

	if nullif(trim(p_code), '') is null then
		raise exception 'Please enter a code.';
	end if;
	v_hash := private.tdc_hash_code(p_code);

	-- Claim the code: only succeeds once, even against a second identical request arriving at the same time.
	perform set_config('tdc.redeem_write', 'on', true);
	update public.tbl_redeem_codes
	set status = 'redeemed', redeemed_player_id = v_player_id, redeemed_by = v_user_id, redeemed_at = now()
	where code_hash = v_hash
		and venue_id = p_venue_id
		and status = 'unused'
		and (expires_at is null or expires_at > now())
	returning * into v_row;
	perform set_config('tdc.redeem_write', 'off', true);

	if v_row.id is null then
		if exists (select 1 from public.tbl_redeem_codes where code_hash = v_hash and venue_id = p_venue_id) then
			raise exception 'This code has already been used or has expired.';
		end if;
		raise exception 'That code isn''t recognised here. Please check it and try again.';
	end if;

	insert into public.tbl_credit_ledger (venue_id, player_id, amount, entry_type, created_by, idempotency_key)
	values (p_venue_id, v_player_id, v_row.credits, 'code', v_user_id, 'redeem_code:' || v_row.id);

	credits_added := v_row.credits;
	new_balance := private.tdc_credit_balance(p_venue_id, v_player_id);
	return next;
end;
$$;

-- ─── 3. Owners and admins: void an unused code (printed in error, lost, refunded before use). ───
create function public.tdc_void_redeem_code(p_venue_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_hash    text;
	v_updated integer;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
		raise exception 'Only owners and admins can void a code.';
	end if;
	if nullif(trim(p_code), '') is null then
		raise exception 'Please enter a code.';
	end if;
	v_hash := private.tdc_hash_code(p_code);

	perform set_config('tdc.redeem_write', 'on', true);
	update public.tbl_redeem_codes
	set status = 'void', voided_by = v_user_id, voided_at = now()
	where code_hash = v_hash and venue_id = p_venue_id and status = 'unused';
	get diagnostics v_updated = row_count;
	perform set_config('tdc.redeem_write', 'off', true);

	if v_updated = 0 then
		raise exception 'That code is either already used, already void, or not recognised here.';
	end if;
end;
$$;

-- ─── Who can call these ───
revoke execute on function public.tdc_generate_redeem_codes(uuid, integer, integer, text, timestamptz) from public, anon;
revoke execute on function public.tdc_redeem_code(uuid, text, uuid)                                     from public, anon;
revoke execute on function public.tdc_void_redeem_code(uuid, text)                                      from public, anon;

grant execute on function public.tdc_generate_redeem_codes(uuid, integer, integer, text, timestamptz) to authenticated;
grant execute on function public.tdc_redeem_code(uuid, text, uuid)                                     to authenticated;
grant execute on function public.tdc_void_redeem_code(uuid, text)                                      to authenticated;

-- ⚠ When new tables reference tbl_players (matches, credits, XP, ...), add them to tdc_merge_players.
-- Redeemed codes reference the player through redeemed_player_id: add it there when accounts start
-- redeeming codes before signing up (not yet possible, since redemption requires a login or staff assist).
