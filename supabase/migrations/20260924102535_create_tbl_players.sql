-- Players: one row per person who plays at any venue, with or without a login.
-- Non-private info only. ID numbers, phone and email go in a separate protected table (later step).

create table public.tbl_players (
	id                  uuid primary key default gen_random_uuid(),
	created_at          timestamptz not null default now(),
	user_id             uuid unique references auth.users (id) on delete set null,
	display_name        text not null check (char_length(trim(display_name)) between 1 and 100),
	first_name          text check (first_name is null or char_length(trim(first_name)) between 1 and 100),
	last_name           text check (last_name is null or char_length(trim(last_name)) between 1 and 100),
	player_type         text not null check (player_type in ('member', 'walk_in', 'guest')),
	guest_of_player_id  uuid references public.tbl_players (id) on delete set null,
	created_by          uuid references auth.users (id) on delete set null,

	constraint tbl_players_guest_of_only_for_guests
		check (guest_of_player_id is null or player_type = 'guest')
);

create index tbl_players_guest_of_idx on public.tbl_players (guest_of_player_id);

-- Automatically create a player row whenever someone signs up.
create function public.tdc_create_player_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.tbl_players (user_id, display_name, first_name, last_name, player_type)
	values (
		new.id,
		left(coalesce(
			nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
			nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
			'TDC (No Name)'
		), 100),
		left(nullif(trim(new.raw_user_meta_data ->> 'given_name'), ''), 100),
		left(nullif(trim(new.raw_user_meta_data ->> 'family_name'), ''), 100),
		'member'
	);
	return new;
end;
$$;

revoke execute on function public.tdc_create_player_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created_create_player
	after insert on auth.users
	for each row execute function public.tdc_create_player_for_new_user();

-- Give existing accounts a player row too.
insert into public.tbl_players (user_id, display_name, first_name, last_name, player_type)
select
	u.id,
	left(coalesce(
		nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
		nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
		'TDC (No Name)'
	), 100),
	left(nullif(trim(u.raw_user_meta_data ->> 'given_name'), ''), 100),
	left(nullif(trim(u.raw_user_meta_data ->> 'family_name'), ''), 100),
	'member'
from auth.users u
where not exists (select 1 from public.tbl_players p where p.user_id = u.id);

-- Access rules
alter table public.tbl_players enable row level security;

create policy "Signed-in users can see players"
	on public.tbl_players
	for select
	to authenticated
	using (true);

create policy "Players can edit their own row"
	on public.tbl_players
	for update
	to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

grant select on public.tbl_players to authenticated;
grant update (display_name, first_name, last_name) on public.tbl_players to authenticated;
grant select, insert, update, delete on public.tbl_players to service_role;