-- Venues and the staff who run them.
-- Everything venue-specific later (credits, tables, pricing) links to tbl_venues by venue_id.

-- A private schema: functions here can't be called through the website's API.
create schema if not exists private;

create table public.tbl_venues (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	name        text not null check (char_length(trim(name)) between 1 and 100),
	slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	timezone    text not null default 'Africa/Johannesburg',
	currency    text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
	active      boolean not null default true
);

create table public.tbl_venue_staff (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	venue_id    uuid not null references public.tbl_venues (id) on delete cascade,
	user_id     uuid not null references auth.users (id) on delete cascade,
	role        text not null check (role in ('owner', 'admin', 'staff')),
	created_by  uuid references auth.users (id) on delete set null,

	constraint tbl_venue_staff_one_role_per_venue unique (venue_id, user_id)
);

create index tbl_venue_staff_user_id_idx on public.tbl_venue_staff (user_id);

-- Helper for access rules: does the current user hold one of these roles at this venue?
create function private.tdc_has_venue_role(p_venue_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.tbl_venue_staff s
		where s.venue_id = p_venue_id
			and s.user_id = (select auth.uid())
			and s.role = any (p_roles)
	);
$$;

revoke execute on function private.tdc_has_venue_role(uuid, text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.tdc_has_venue_role(uuid, text[]) to authenticated;

-- Access rules: venues
alter table public.tbl_venues enable row level security;

create policy "Signed-in users can see active venues, staff see their own"
	on public.tbl_venues
	for select
	to authenticated
	using (active or private.tdc_has_venue_role(id, array['owner', 'admin', 'staff']));

grant select on public.tbl_venues to authenticated;
grant select, insert, update, delete on public.tbl_venues to service_role;

-- Access rules: staff
alter table public.tbl_venue_staff enable row level security;

create policy "Staff see their own roles, owners and admins see their venue's staff"
	on public.tbl_venue_staff
	for select
	to authenticated
	using (
		user_id = (select auth.uid())
		or private.tdc_has_venue_role(venue_id, array['owner', 'admin'])
	);

grant select on public.tbl_venue_staff to authenticated;
grant select, insert, update, delete on public.tbl_venue_staff to service_role;

-- First venue, owned by the business account.
insert into public.tbl_venues (name, slug) values ('The Dive Club', 'the-dive-club');

do $$
declare
	v_owner uuid;
	v_staff uuid;
begin
	select id into v_owner from auth.users where email = 'admin@thediveclub.org';
	select id into v_staff from auth.users where email = 'yuvannaidoo@gmail.com';

	if v_owner is null then
		raise warning 'TDC (Error): admin@thediveclub.org not found, The Dive Club has no owner. Add one manually.';
	else
		insert into public.tbl_venue_staff (venue_id, user_id, role, created_by)
		select v.id, v_owner, 'owner', v_owner from public.tbl_venues v where v.slug = 'the-dive-club';
	end if;

	if v_staff is null then
		raise warning 'TDC (Error): yuvannaidoo@gmail.com not found, first staff member not added.';
	else
		insert into public.tbl_venue_staff (venue_id, user_id, role, created_by)
		select v.id, v_staff, 'staff', v_owner from public.tbl_venues v where v.slug = 'the-dive-club';
	end if;
end;
$$;