-- Walk-ins and claiming.
-- Staff can create players for people without an account (walk-ins and guests).
-- When such a person signs up, their account takes over the walk-in record (keeping its id, so history stays attached),
-- either automatically when their confirmed login email matches an email on the record, or with staff in store.

-- ─── Internal: join a signup record into a walk-in record ───
-- Keeps p_keep_id (the walk-in), links it to the account, moves everything from p_remove_id onto it, deletes p_remove_id.
-- ⚠ When new tables reference tbl_players (matches, credits, XP, ...), add them to the "move" section below.
create function private.tdc_merge_players(p_keep_id uuid, p_remove_id uuid, p_user_id uuid)
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

-- ─── 1. Staff create a walk-in or guest ───
create function public.tdc_create_walk_in(
	p_venue_id           uuid,
	p_display_name       text,
	p_first_name         text default null,
	p_last_name          text default null,
	p_player_type        text default 'walk_in',
	p_guest_of_player_id uuid default null,
	p_sa_id              text default null,
	p_passport           text default null,
	p_passport_country   text default null,
	p_phone              text default null,
	p_email              text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id   uuid := auth.uid();
	v_player_id uuid;
	v_kind      text;
	v_value     text;
	v_country   text;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;
	if p_player_type is null or p_player_type not in ('walk_in', 'guest') then
		raise exception 'TDC (Error): player type must be walk_in or guest.';
	end if;
	if p_player_type = 'guest' and p_guest_of_player_id is null then
		raise exception 'Please choose whose guest this is.';
	end if;
	if p_player_type = 'walk_in' and p_guest_of_player_id is not null then
		raise exception 'TDC (Error): only guests have a host player.';
	end if;
	if p_guest_of_player_id is not null and not exists (select 1 from public.tbl_players where id = p_guest_of_player_id) then
		raise exception 'TDC (Error): host player not found.';
	end if;
	if nullif(trim(p_display_name), '') is null then
		raise exception 'Please enter a display name.';
	end if;
	if nullif(trim(p_sa_id), '') is not null and nullif(trim(p_passport), '') is not null then
		raise exception 'Please enter either an SA ID or a passport, not both.';
	end if;

	begin
		insert into public.tbl_players (display_name, first_name, last_name, player_type, guest_of_player_id, created_by)
		values (
			trim(p_display_name),
			nullif(trim(p_first_name), ''),
			nullif(trim(p_last_name), ''),
			p_player_type,
			p_guest_of_player_id,
			v_user_id
		)
		returning id into v_player_id;
	exception
		when check_violation then
			raise exception 'Names must be 100 characters or fewer.';
	end;

	-- Any identifiers given. If one fails, the whole walk-in is cancelled (nothing is saved).
	for v_kind, v_value, v_country in
		select t.k, t.v, t.c
		from (values
			('sa_id',    p_sa_id,    null::text),
			('passport', p_passport, p_passport_country),
			('phone',    p_phone,    null::text),
			('email',    p_email,    null::text)
		) as t(k, v, c)
		where nullif(trim(t.v), '') is not null
	loop
		begin
			insert into public.tbl_player_identifiers (player_id, kind, value, issuing_country, created_by)
			values (
				v_player_id,
				v_kind,
				private.tdc_normalize_identifier(v_kind, v_value),
				case when v_kind = 'passport' then upper(trim(v_country)) end,
				v_user_id
			);
		exception
			when unique_violation then
				raise exception 'This % already belongs to an existing player. Search for them instead of adding a new one.',
					case v_kind when 'sa_id' then 'SA ID' when 'passport' then 'passport' when 'phone' then 'phone number' else 'email address' end;
			when check_violation then
				raise exception 'That doesn''t look like a valid %. Please check it and try again.',
					case v_kind when 'sa_id' then 'SA ID number' when 'passport' then 'passport number and country' when 'phone' then 'phone number' else 'email address' end;
		end;
	end loop;

	return v_player_id;
end;
$$;

-- ─── 2. Staff link a walk-in record to a player's account (person is in store, showed ID) ───
create function public.tdc_staff_link_account(
	p_venue_id           uuid,
	p_walk_in_player_id  uuid,
	p_account_player_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id        uuid := auth.uid();
	v_account_user   uuid;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;

	select user_id into v_account_user from public.tbl_players where id = p_account_player_id;
	if v_account_user is null then
		raise exception 'The second player has no account. Choose the player record that signed up.';
	end if;
	if v_account_user = v_user_id then
		raise exception 'You can''t link a record to your own account. Please ask another staff member.';
	end if;

	return private.tdc_merge_players(p_walk_in_player_id, p_account_player_id, v_account_user);
end;
$$;

-- ─── 3. A signed-in player: is there a walk-in record with my confirmed email? ───
create function public.tdc_find_my_walk_in()
returns table (player_id uuid, display_name text, first_name text, last_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id, p.display_name, p.first_name, p.last_name, p.created_at
	from auth.users u
	join public.tbl_player_identifiers i on i.kind = 'email' and i.value = lower(u.email)
	join public.tbl_players p on p.id = i.player_id and p.user_id is null
	where u.id = (select auth.uid())
		and u.email_confirmed_at is not null;
$$;

-- ─── 4. A signed-in player links that walk-in record to their account ───
create function public.tdc_claim_my_walk_in(p_walk_in_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id   uuid := auth.uid();
	v_my_player uuid;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	if not exists (select 1 from public.tdc_find_my_walk_in() f where f.player_id = p_walk_in_player_id) then
		raise exception 'This record can''t be linked automatically. Please ask staff at the venue.';
	end if;

	select id into v_my_player from public.tbl_players where user_id = v_user_id;
	if v_my_player is null then
		raise exception 'TDC (Error): no player profile found for this account.';
	end if;

	return private.tdc_merge_players(p_walk_in_player_id, v_my_player, v_user_id);
end;
$$;

-- ─── Who can call these ───
revoke execute on function public.tdc_create_walk_in(uuid, text, text, text, text, uuid, text, text, text, text, text) from public, anon;
revoke execute on function public.tdc_staff_link_account(uuid, uuid, uuid)                                         from public, anon;
revoke execute on function public.tdc_find_my_walk_in()                                                           from public, anon;
revoke execute on function public.tdc_claim_my_walk_in(uuid)                                                      from public, anon;

grant execute on function public.tdc_create_walk_in(uuid, text, text, text, text, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.tdc_staff_link_account(uuid, uuid, uuid)                                         to authenticated;
grant execute on function public.tdc_find_my_walk_in()                                                            to authenticated;
grant execute on function public.tdc_claim_my_walk_in(uuid)                                                       to authenticated;
