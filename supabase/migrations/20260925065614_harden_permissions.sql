-- Hardening: remove permissions nobody needs, and tidy the signup function.

-- 1. rls_auto_enable is Supabase's "turn on RLS for new tables" helper.
--    It should run automatically, never be callable through the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. Remove low-level table permissions the website never uses, from existing tables.
revoke truncate, references, trigger, maintain on public.tbl_push_subscriptions from anon, authenticated;
revoke truncate, references, trigger, maintain on public.tbl_players            from anon, authenticated;
revoke truncate, references, trigger, maintain on public.tbl_venues             from anon, authenticated;
revoke truncate, references, trigger, maintain on public.tbl_venue_staff        from anon, authenticated;

-- 3. Stop future tables from getting those permissions in the first place.
alter default privileges for role postgres in schema public
	revoke truncate, references, trigger, maintain on tables from anon, authenticated;

-- 4. Signup function without the first/last name lookups (Google doesn't send those).
create or replace function public.tdc_create_player_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.tbl_players (user_id, display_name, player_type)
	values (
		new.id,
		left(coalesce(
			nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
			nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
			'TDC (No Name)'
		), 100),
		'member'
	);
	return new;
end;
$$;