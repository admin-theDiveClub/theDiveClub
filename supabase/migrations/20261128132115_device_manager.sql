-- The device manager (UV, 28 Nov; docs/systems/foundations.md, "The device
-- manager"). UV: "we do need the device manager functionality".
--
-- The profile page's Account section lists everywhere the account is signed
-- in (phones, computers, and TVs signed in by QR from a phone), each with Sign
-- out, plus "Sign out everywhere else". UV's answers, 28 Nov: each row shows
-- the device's name, when it signed in and was last used, its IP and "This
-- device"; a TV signed in by QR says so and names the phone that allowed it;
-- a sign-in unused for 30 days is signed out.
--
-- Supabase keeps one row per sign-in in auth.sessions (user_agent, ip,
-- created_at, updated_at, refreshed_at); the current one is the session_id
-- claim of the caller's JWT. auth is Supabase's schema, so it is read, and the
-- caller's own rows deleted, only through the security-definer functions here,
-- never through grants. Deleting a session is what Supabase's own logout does:
-- its refresh tokens go with it (on delete cascade), so that device cannot get
-- a new access token. The access token it already holds still works until it
-- runs out (at most an hour, the JWT expiry); the site checks the session once
-- on every page load (nav.js, getUser), which signs a stopped device out the
-- next time it loads a page.

-- ─── Which sign-in was a TV's, and which phone allowed it ───

-- The phone's own session when it taps Allow, so the TV's row can name it.
alter table public.tbl_device_logins add column approved_session_id uuid;

-- One row per session made by "Signing in a TV with a phone". Kept apart from
-- tbl_device_logins, whose rows are deleted after a day. No foreign key to
-- auth.sessions (Supabase's own sign-out must never depend on our table);
-- rows whose session has gone are deleted by the nightly job below and by the
-- sign-out functions. Names the auth user, not a player: an account is never
-- merged away, so this is not in private.tdc_merge_players.
create table public.tbl_device_sessions (
	session_id uuid primary key,
	user_id uuid not null references auth.users (id) on delete cascade,
	device text not null check (length(device) between 1 and 100),
	allowed_by_user_agent text check (length(allowed_by_user_agent) <= 1000),
	allowed_at timestamptz not null
);

comment on table public.tbl_device_sessions is
	'The device manager: sessions made by signing in a TV with a phone, with the device and the phone that allowed it. Written only through tdc_device_login_link. See migration 20261128132115.';

alter table public.tbl_device_sessions enable row level security;
revoke all on table public.tbl_device_sessions from anon, authenticated;
create index on public.tbl_device_sessions (user_id);

-- The caller's session, from the JWT. Null when there is none.
create function private.tdc_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
	select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

-- When a session was last used: Supabase stamps it each time the device gets
-- a new access token (about hourly while it is in use). refreshed_at is kept
-- without a time zone, in UTC.
create function private.tdc_session_last_used(s auth.sessions)
returns timestamptz
language sql
stable
set search_path = ''
as $$
	select greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC');
$$;

-- tdc_device_login_answer, patched (20261128123827): Allow also records the
-- phone's session. Nothing else changed.
create or replace function public.tdc_device_login_answer(p_code text, p_allow boolean)
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
		update public.tbl_device_logins set approved_by = auth.uid(), approved_at = now(),
			approved_session_id = private.tdc_session_id() where id = v_row.id;
	else
		update public.tbl_device_logins set refused_at = now() where id = v_row.id;
	end if;
end;
$$;

-- The TV, just signed in, records which session is its own. p_secret is the
-- secret it collected the sign-in with: only the TV has it. The request must
-- be this account's, collected in the last 10 minutes, and the session made
-- since (a minute's grace), so no other sign-in can be labelled a TV.
create function public.tdc_device_login_link(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_row public.tbl_device_logins;
	v_session uuid := private.tdc_session_id();
begin
	if auth.uid() is null then
		raise exception 'Sign in first.' using errcode = '42501';
	end if;

	select * into v_row from public.tbl_device_logins
	where secret_hash = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex');

	if not found or v_row.used_at is null or v_row.approved_by is distinct from auth.uid()
		or v_row.used_at < now() - interval '10 minutes' then
		raise exception 'TDC (Error): this device''s sign-in request was not found.';
	end if;
	if v_session is null or not exists (select 1 from auth.sessions s
		where s.id = v_session and s.user_id = auth.uid()
		and s.created_at >= v_row.used_at - interval '1 minute') then
		raise exception 'TDC (Error): this sign-in is not the one the phone allowed.';
	end if;

	insert into public.tbl_device_sessions (session_id, user_id, device, allowed_by_user_agent, allowed_at)
	values (v_session, auth.uid(), v_row.device,
		(select s.user_agent from auth.sessions s where s.id = v_row.approved_session_id),
		v_row.approved_at)
	on conflict (session_id) do nothing;
end;
$$;

-- ─── The list ───

-- Everywhere the caller is signed in, this device first, then the most
-- recently used. Each: id, user_agent (the page names the device from it),
-- ip, created_at, last_used_at, current, and for a TV signed in by QR, qr:
-- { device, allowed_by_user_agent, allowed_at }. Sessions past Supabase's own
-- end (not_after) or unused for 30 days are left out (the nightly job signs
-- them out).
create function public.tdc_my_sessions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_current uuid := private.tdc_session_id();
begin
	if auth.uid() is null then
		raise exception 'Sign in first.' using errcode = '42501';
	end if;

	return coalesce((
		select jsonb_agg(jsonb_build_object(
			'id', s.id,
			'user_agent', s.user_agent,
			'ip', host(s.ip),
			'created_at', s.created_at,
			'last_used_at', private.tdc_session_last_used(s),
			'current', s.id is not distinct from v_current,
			'qr', case when d.session_id is null then null else jsonb_build_object(
				'device', d.device,
				'allowed_by_user_agent', d.allowed_by_user_agent,
				'allowed_at', d.allowed_at) end)
			order by (s.id is not distinct from v_current) desc, private.tdc_session_last_used(s) desc)
		from auth.sessions s
		left join public.tbl_device_sessions d on d.session_id = s.id
		where s.user_id = auth.uid()
			and (s.not_after is null or s.not_after > now())
			and private.tdc_session_last_used(s) >= now() - interval '30 days'
	), '[]'::jsonb);
end;
$$;

-- ─── Signing out ───

-- Signs out one of the caller's other devices. This device is signed out with
-- Log out, which also clears it in the browser.
create function public.tdc_sign_out_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if auth.uid() is null then
		raise exception 'Sign in first.' using errcode = '42501';
	end if;
	if p_session_id is not distinct from private.tdc_session_id() then
		raise exception 'That is the device you are using. Use Log out to sign out here.';
	end if;

	delete from auth.sessions where id = p_session_id and user_id = auth.uid();
	if not found then
		raise exception 'That sign-in was not found. It may already be signed out.';
	end if;
	delete from public.tbl_device_sessions where session_id = p_session_id;
end;
$$;

-- Signs out every device but this one. Returns how many.
create function public.tdc_sign_out_other_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_current uuid := private.tdc_session_id();
	v_count integer;
begin
	if auth.uid() is null then
		raise exception 'Sign in first.' using errcode = '42501';
	end if;
	if v_current is null then
		raise exception 'TDC (Error): this sign-in has no session, so the others could not be told apart from it.';
	end if;

	delete from auth.sessions where user_id = auth.uid() and id <> v_current;
	get diagnostics v_count = row_count;
	delete from public.tbl_device_sessions where user_id = auth.uid() and session_id <> v_current;
	return v_count;
end;
$$;

-- ─── Unused for 30 days (UV, 28 Nov) ───

-- Signs out every session not used for 30 days, and forgets TV labels whose
-- session has gone. Returns how many sessions. Run nightly below.
create function private.tdc_clear_unused_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_count integer;
begin
	delete from auth.sessions s where private.tdc_session_last_used(s) < now() - interval '30 days';
	get diagnostics v_count = row_count;
	delete from public.tbl_device_sessions d
	where not exists (select 1 from auth.sessions s where s.id = d.session_id);
	return v_count;
end;
$$;

select cron.schedule('tdc-clear-unused-sessions', '30 2 * * *', $$select private.tdc_clear_unused_sessions()$$);

revoke execute on function private.tdc_session_id() from public, anon, authenticated;
revoke execute on function private.tdc_session_last_used(auth.sessions) from public, anon, authenticated;
revoke execute on function private.tdc_clear_unused_sessions() from public, anon, authenticated;
revoke execute on function public.tdc_device_login_link(text) from public, anon;
revoke execute on function public.tdc_my_sessions() from public, anon;
revoke execute on function public.tdc_sign_out_session(uuid) from public, anon;
revoke execute on function public.tdc_sign_out_other_sessions() from public, anon;
grant execute on function public.tdc_device_login_link(text) to authenticated;
grant execute on function public.tdc_my_sessions() to authenticated;
grant execute on function public.tdc_sign_out_session(uuid) to authenticated;
grant execute on function public.tdc_sign_out_other_sessions() to authenticated;
