-- Actions on identifiers. These functions are the only way identifiers and verifications get written.
-- Messages players or staff should see are plain sentences; unexpected problems start with "TDC (Error)".

-- ─── Helper: clean up formatting so the same identifier always looks the same ───
create function private.tdc_normalize_identifier(p_kind text, p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
	select case p_kind
		when 'sa_id'    then regexp_replace(coalesce(p_value, ''), '[\s-]', '', 'g')
		when 'passport' then upper(regexp_replace(coalesce(p_value, ''), '[\s-]', '', 'g'))
		when 'email'    then lower(trim(coalesce(p_value, '')))
		when 'phone'    then (
			select case
				when v ~ '^0[0-9]{9}$'  then '+27' || substr(v, 2)
				when v ~ '^27[0-9]{9}$' then '+' || v
				else v
			end
			from (select regexp_replace(coalesce(p_value, ''), '[\s()-]', '', 'g') as v) s
		)
		else p_value
	end;
$$;

-- ─── 1. A signed-in player adds an identifier to their own player row ───
create function public.tdc_add_my_identifier(
	p_kind            text,
	p_value           text,
	p_issuing_country text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id    uuid := auth.uid();
	v_player_id  uuid;
	v_value      text;
	v_country    text;
	v_new_id     uuid;
	v_constraint text;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select id into v_player_id from public.tbl_players where user_id = v_user_id;
	if v_player_id is null then
		raise exception 'TDC (Error): no player profile found for this account.';
	end if;

	if p_kind is null or p_kind not in ('sa_id', 'passport', 'phone', 'email') then
		raise exception 'TDC (Error): unknown identifier type "%".', p_kind;
	end if;

	v_value   := private.tdc_normalize_identifier(p_kind, p_value);
	v_country := case when p_kind = 'passport' then upper(trim(p_issuing_country)) end;

	begin
		insert into public.tbl_player_identifiers (player_id, kind, value, issuing_country, created_by)
		values (v_player_id, p_kind, v_value, v_country, v_user_id)
		returning id into v_new_id;
	exception
		when unique_violation then
			get stacked diagnostics v_constraint = constraint_name;
			if v_constraint = 'tbl_player_identifiers_one_sa_id' then
				raise exception 'You already have an SA ID on your account. Please ask staff if it needs correcting.';
			elsif exists (
				select 1 from public.tbl_player_identifiers
				where player_id = v_player_id and kind = p_kind and value = v_value
					and issuing_country is not distinct from v_country
			) then
				raise exception 'This is already on your account.';
			else
				raise exception 'This is already registered to another account. Please speak to staff.';
			end if;
		when check_violation then
			raise exception 'That doesn''t look like a valid %. Please check it and try again.',
				case p_kind
					when 'sa_id'    then 'SA ID number'
					when 'passport' then 'passport number and country'
					when 'phone'    then 'phone number'
					else 'email address'
				end;
	end;

	return v_new_id;
end;
$$;

-- ─── 2. Staff verify an ID by typing the number from the physical document ───
create function public.tdc_verify_identifier(
	p_venue_id            uuid,
	p_player_id           uuid,
	p_kind                text,
	p_value_from_document text,
	p_issuing_country     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id       uuid := auth.uid();
	v_identifier_id uuid;
	v_value         text;
	v_country       text;
	v_new_id        uuid;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'You are not staff at this venue.';
	end if;

	if p_kind is null or p_kind not in ('sa_id', 'passport') then
		raise exception 'Only SA ID numbers and passports can be verified.';
	end if;

	if exists (select 1 from public.tbl_players where id = p_player_id and user_id = v_user_id) then
		raise exception 'You can''t verify your own ID. Please ask another staff member.';
	end if;

	v_value   := private.tdc_normalize_identifier(p_kind, p_value_from_document);
	v_country := case when p_kind = 'passport' then upper(trim(p_issuing_country)) end;

	select id into v_identifier_id
	from public.tbl_player_identifiers
	where player_id = p_player_id
		and kind = p_kind
		and value = v_value
		and issuing_country is not distinct from v_country;

	if v_identifier_id is null then
		if exists (select 1 from public.tbl_player_identifiers where player_id = p_player_id and kind = p_kind) then
			raise exception 'The number doesn''t match what the player entered. Check the document and try again.';
		else
			raise exception 'This player has no % on file.',
				case p_kind when 'sa_id' then 'SA ID' else 'passport' end;
		end if;
	end if;

	begin
		insert into public.tbl_identifier_verifications (identifier_id, venue_id, verified_by)
		values (v_identifier_id, p_venue_id, v_user_id)
		returning id into v_new_id;
	exception
		when unique_violation then
			raise exception 'This ID is already verified at this venue.';
	end;

	return v_new_id;
end;
$$;

-- ─── 3. Owners/admins undo a verification (kept as a record, never deleted) ───
create function public.tdc_revoke_verification(
	p_verification_id uuid,
	p_reason          text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id  uuid := auth.uid();
	v_venue_id uuid;
	v_revoked  timestamptz;
begin
	if v_user_id is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select venue_id, revoked_at into v_venue_id, v_revoked
	from public.tbl_identifier_verifications
	where id = p_verification_id;

	if v_venue_id is null then
		raise exception 'TDC (Error): verification not found.';
	end if;

	if not private.tdc_has_venue_role(v_venue_id, array['owner', 'admin']) then
		raise exception 'Only owners and admins at this venue can revoke a verification.';
	end if;

	if v_revoked is not null then
		raise exception 'This verification has already been revoked.';
	end if;

	if nullif(trim(p_reason), '') is null then
		raise exception 'Please give a reason for revoking.';
	end if;

	update public.tbl_identifier_verifications
	set revoked_at = now(), revoked_by = v_user_id, revoke_reason = trim(p_reason)
	where id = p_verification_id;
end;
$$;

-- ─── Who can call these ───
revoke execute on function public.tdc_add_my_identifier(text, text, text)                from public, anon;
revoke execute on function public.tdc_verify_identifier(uuid, uuid, text, text, text)    from public, anon;
revoke execute on function public.tdc_revoke_verification(uuid, text)                    from public, anon;

grant execute on function public.tdc_add_my_identifier(text, text, text)                 to authenticated;
grant execute on function public.tdc_verify_identifier(uuid, uuid, text, text, text)     to authenticated;
grant execute on function public.tdc_revoke_verification(uuid, text)                     to authenticated;