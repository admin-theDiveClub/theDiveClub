-- Signing in a TV (or any browser) with a phone (UV, 28 Nov; docs/systems/
-- foundations.md, "Signing in a TV with a phone").
--
-- UV: "a QR code style login system to allow users to log in on TVs, similar
-- to Netflix, Amazon Prime". The login page shows a QR and a code; the phone
-- scans it (or types the code at thediveclub.org/tv), signs in if it needs to,
-- and is asked "Allow this device?". On Allow, the TV signs in as that account
-- with a session of its own. Everything the account can do (UV, 28 Nov).
--
-- One row per request. The TV holds a secret only it knows; the row keeps its
-- SHA-256, never the secret. The code on the screen can only be answered (by a
-- signed-in phone); only the secret collects the sign-in, so a photo of the
-- screen steals nothing. UV, 28 Nov: "a new code generated every 30 s ... it's
-- a real security risk" (a QR someone screenshots or prints as a poster, "scan
-- for free credits", would sign its maker in as whoever taps Allow). So the
-- page shows a new code every 30 s and each code may be allowed for 60 s
-- (Claude's, for UV to correct: a code scanned in its last second still has
-- 30 s to be allowed); the page keeps collecting the previous one meanwhile.
--
-- The TV is signed out, so it talks only to the edge function device-login,
-- which calls tdc_device_login_start and tdc_device_login_collect with the
-- service role (granted to nobody else). Collecting an approved request marks
-- it used and gives the function the account's email, from which it makes a
-- one-time sign-in token for the TV (auth.admin.generateLink). The phone uses
-- tdc_device_login_view and tdc_device_login_answer, signed in.
--
-- approved_by is the auth user, not a player: a sign-in belongs to an account,
-- and an account is never merged away (a walk-in is), so this table needs no
-- line in private.tdc_merge_players.

create table public.tbl_device_logins (
	id uuid primary key default gen_random_uuid(),
	code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
	secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
	device text not null check (length(device) between 1 and 100),
	created_at timestamptz not null default now(),
	expires_at timestamptz not null default now() + interval '60 seconds',
	approved_by uuid references auth.users (id) on delete cascade,
	approved_at timestamptz,
	refused_at timestamptz,
	used_at timestamptz,
	check (approved_at is null or refused_at is null),
	check ((approved_by is null) = (approved_at is null)),
	check (used_at is null or approved_at is not null)
);

comment on table public.tbl_device_logins is
	'Signing in a TV with a phone: one row per QR shown on a login page. Written only through the tdc_device_login_ functions. See migration 20261128123827.';

alter table public.tbl_device_logins enable row level security;
revoke all on table public.tbl_device_logins from anon, authenticated;

-- A code as typed: capitals, anything but letters and digits dropped
-- ("k7qm-4xpd" is K7QM4XPD).
create function private.tdc_device_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
	select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
$$;

-- The TV asks for a code. p_secret is the TV's own random secret; p_device is
-- what the phone will be shown ("Chrome on Windows"), worked out by the edge
-- function from the TV's browser. Requests over a day old are cleared here.
create function public.tdc_device_login_start(p_secret text, p_device text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	-- No 0/O, 1/I: a code is read off a TV across a room. 32 letters, so a
	-- byte's remainder picks one evenly.
	c_letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	v_bytes bytea;
	v_code text;
	v_row public.tbl_device_logins;
begin
	if p_secret is null or length(p_secret) not between 32 and 200 then
		raise exception 'TDC (Error): the device''s secret is missing or the wrong length.';
	end if;

	delete from public.tbl_device_logins where created_at < now() - interval '1 day';

	loop
		-- A uuid's bytes 0 to 5 and 10 to 15 are random (6 to 9 carry its version).
		v_bytes := substring(uuid_send(gen_random_uuid()) from 1 for 6)
			|| substring(uuid_send(gen_random_uuid()) from 11 for 2);
		v_code := '';
		for i in 0..7 loop
			v_code := v_code || substr(c_letters, get_byte(v_bytes, i) % 32 + 1, 1);
		end loop;
		begin
			insert into public.tbl_device_logins (code, secret_hash, device)
			values (v_code, encode(sha256(convert_to(p_secret, 'UTF8')), 'hex'),
				left(coalesce(nullif(btrim(p_device), ''), 'A browser'), 100))
			returning * into v_row;
			exit;
		exception when unique_violation then
			-- The same code in use (or, vanishingly, the same secret): try again.
			if exists (select 1 from public.tbl_device_logins
				where secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')) then
				raise exception 'TDC (Error): that secret is already in use; the page makes a new one.';
			end if;
		end;
	end loop;

	return jsonb_build_object('code', v_row.code, 'expires_at', v_row.expires_at);
end;
$$;

-- The TV asks whether it may sign in. state: waiting, approved, refused,
-- expired, used or unknown. Approved is answered once: the request is marked
-- used and the account's user id and email come back with it, for the edge
-- function to make the one-time token. An approval is collected within 2
-- minutes of being given or not at all.
create function public.tdc_device_login_collect(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_row public.tbl_device_logins;
	v_email text;
begin
	select * into v_row from public.tbl_device_logins
	where secret_hash = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
	for update;

	if not found then
		return jsonb_build_object('state', 'unknown');
	elsif v_row.used_at is not null then
		return jsonb_build_object('state', 'used');
	elsif v_row.refused_at is not null then
		return jsonb_build_object('state', 'refused');
	elsif v_row.approved_at is not null then
		if v_row.approved_at < now() - interval '2 minutes' then
			return jsonb_build_object('state', 'expired');
		end if;
		select u.email into v_email from auth.users u where u.id = v_row.approved_by;
		update public.tbl_device_logins set used_at = now() where id = v_row.id;
		return jsonb_build_object('state', 'approved', 'user_id', v_row.approved_by, 'email', v_email);
	elsif v_row.expires_at < now() then
		return jsonb_build_object('state', 'expired');
	end if;
	return jsonb_build_object('state', 'waiting', 'expires_at', v_row.expires_at);
end;
$$;

-- The phone reads a code before answering: which device, and where it stands.
-- Null for a code that is not there.
create function public.tdc_device_login_view(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_row public.tbl_device_logins;
begin
	if auth.uid() is null then
		raise exception 'Sign in first.' using errcode = '42501';
	end if;

	select * into v_row from public.tbl_device_logins
	where code = private.tdc_device_code(p_code);
	if not found then
		return null;
	end if;

	return jsonb_build_object(
		'code', v_row.code,
		'device', v_row.device,
		'created_at', v_row.created_at,
		'expires_at', v_row.expires_at,
		'state', case
			when v_row.used_at is not null then 'used'
			when v_row.refused_at is not null then 'refused'
			when v_row.approved_at is not null then 'approved'
			when v_row.expires_at < now() then 'expired'
			else 'waiting' end,
		'mine', v_row.approved_by is not distinct from auth.uid() and v_row.approved_at is not null);
end;
$$;

-- The phone answers: Allow (the device signs in as this account) or Cancel.
-- Only a waiting code, once.
create function public.tdc_device_login_answer(p_code text, p_allow boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_row public.tbl_device_logins;
begin
	if auth.uid() is null then
		raise exception 'Sign in first.' using errcode = '42501';
	end if;
	if p_allow is null then
		raise exception 'TDC (Error): no answer was given.';
	end if;

	select * into v_row from public.tbl_device_logins
	where code = private.tdc_device_code(p_code)
	for update;

	if not found then
		raise exception 'There is no such code. Check the code on the screen and try again.';
	elsif v_row.approved_at is not null or v_row.refused_at is not null then
		raise exception 'That code has already been answered. The screen will show a new one.';
	elsif v_row.expires_at < now() then
		raise exception 'That code has run out. The screen shows a new one: scan it again.';
	end if;

	if p_allow then
		update public.tbl_device_logins set approved_by = auth.uid(), approved_at = now() where id = v_row.id;
	else
		update public.tbl_device_logins set refused_at = now() where id = v_row.id;
	end if;
end;
$$;

revoke execute on function private.tdc_device_code(text) from public, anon, authenticated;
revoke execute on function public.tdc_device_login_start(text, text) from public, anon, authenticated;
revoke execute on function public.tdc_device_login_collect(text) from public, anon, authenticated;
grant execute on function public.tdc_device_login_start(text, text) to service_role;
grant execute on function public.tdc_device_login_collect(text) to service_role;
revoke execute on function public.tdc_device_login_view(text) from public, anon;
revoke execute on function public.tdc_device_login_answer(text, boolean) from public, anon;
grant execute on function public.tdc_device_login_view(text) to authenticated;
grant execute on function public.tdc_device_login_answer(text, boolean) to authenticated;
