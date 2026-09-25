-- Private identifiers (SA ID, passport, phone, email) and their venue-level verifications.
-- Nobody can browse these. Players see only their own. Changes happen only through controlled functions (next migration).

-- SA ID check: 13 digits with a valid check digit (Luhn). Catches typos, not stolen numbers.
create function private.tdc_is_valid_sa_id(p_id text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_sum   int := 0;
	v_digit int;
	i       int;
begin
	if p_id is null or p_id !~ '^[0-9]{13}$' then
		return false;
	end if;
	for i in 1..13 loop
		v_digit := substr(p_id, 14 - i, 1)::int;
		if i % 2 = 0 then
			v_digit := v_digit * 2;
			if v_digit > 9 then v_digit := v_digit - 9; end if;
		end if;
		v_sum := v_sum + v_digit;
	end loop;
	return v_sum % 10 = 0;
end;
$$;

grant usage on schema private to service_role;
grant execute on function private.tdc_is_valid_sa_id(text) to authenticated, service_role;

create table public.tbl_player_identifiers (
	id               uuid primary key default gen_random_uuid(),
	created_at       timestamptz not null default now(),
	player_id        uuid not null references public.tbl_players (id) on delete cascade,
	kind             text not null check (kind in ('sa_id', 'passport', 'phone', 'email')),
	value            text not null,
	issuing_country  text,
	created_by       uuid references auth.users (id) on delete set null,

	-- Each kind has one fixed format, so matching and duplicate checks are reliable.
	constraint tbl_player_identifiers_format check (
		(kind = 'sa_id'    and private.tdc_is_valid_sa_id(value) and issuing_country is null)
		or (kind = 'passport' and value ~ '^[A-Z0-9]{5,20}$' and issuing_country ~ '^[A-Z]{2}$')
		or (kind = 'phone'    and value ~ '^\+[1-9][0-9]{7,14}$' and issuing_country is null)
		or (kind = 'email'    and value = lower(value) and value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and issuing_country is null)
	),

	-- One identifier, one person, across the whole platform.
	constraint tbl_player_identifiers_unique unique nulls not distinct (kind, value, issuing_country)
);

create index tbl_player_identifiers_player_idx on public.tbl_player_identifiers (player_id);

-- A player can hold only one SA ID.
create unique index tbl_player_identifiers_one_sa_id
	on public.tbl_player_identifiers (player_id)
	where kind = 'sa_id';

create table public.tbl_identifier_verifications (
	id             uuid primary key default gen_random_uuid(),
	created_at     timestamptz not null default now(),
	identifier_id  uuid not null references public.tbl_player_identifiers (id) on delete cascade,
	venue_id       uuid not null references public.tbl_venues (id) on delete cascade,
	verified_by    uuid references auth.users (id) on delete set null,
	method         text not null default 'in_person_document' check (method in ('in_person_document')),
	revoked_at     timestamptz,
	revoked_by     uuid references auth.users (id) on delete set null,
	revoke_reason  text,

	constraint tbl_identifier_verifications_revoke_complete
		check ((revoked_at is null) = (revoke_reason is null))
);

-- At most one active verification per identifier per venue.
create unique index tbl_identifier_verifications_one_active
	on public.tbl_identifier_verifications (identifier_id, venue_id)
	where revoked_at is null;

create index tbl_identifier_verifications_venue_idx on public.tbl_identifier_verifications (venue_id);

-- Access rules: identifiers (players see only their own; no direct writes)
alter table public.tbl_player_identifiers enable row level security;

create policy "Players see their own identifiers"
	on public.tbl_player_identifiers
	for select
	to authenticated
	using (
		exists (
			select 1 from public.tbl_players p
			where p.id = player_id and p.user_id = (select auth.uid())
		)
	);

grant select on public.tbl_player_identifiers to authenticated;
grant select, insert, update, delete on public.tbl_player_identifiers to service_role;

-- Access rules: verifications (players see their own; owners/admins see their venue's, without the ID numbers)
alter table public.tbl_identifier_verifications enable row level security;

create policy "Players see their own verifications, owners and admins see their venue's"
	on public.tbl_identifier_verifications
	for select
	to authenticated
	using (
		exists (
			select 1
			from public.tbl_player_identifiers i
			join public.tbl_players p on p.id = i.player_id
			where i.id = identifier_id and p.user_id = (select auth.uid())
		)
		or private.tdc_has_venue_role(venue_id, array['owner', 'admin'])
	);

grant select on public.tbl_identifier_verifications to authenticated;
grant select, insert, update, delete on public.tbl_identifier_verifications to service_role;