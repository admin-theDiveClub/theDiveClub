-- First name and surname at sign-up (UV, 10 Nov; docs/design/short-links.md).
--
-- The email form now sends both, as first_name and last_name, and they are
-- optional: a player without both has no short link and is told so. Google sends
-- only one full name, which cannot be split safely, so it is not read here:
-- /accounts/names/ asks after signing in, with a Skip.
--
-- 20260925065614's function, with only the two names added. The short link is
-- made by tbl_players_short_code when this row goes in.

create or replace function public.tdc_create_player_for_new_user()
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
		left(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 100),
		left(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), 100),
		'member'
	);
	return new;
end;
$$;
