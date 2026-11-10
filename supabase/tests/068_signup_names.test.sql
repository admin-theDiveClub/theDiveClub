-- First name and surname at sign-up (migration 20261110093122).
--
-- UV, 10 Nov: asked for at sign-up, and optional. A player without both has no
-- short link. The sign-up must never fail over what was or was not sent.
begin;
\ir _helpers.psql
select plan(12);

create function tests.signup(p_meta jsonb) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
	v_id uuid := gen_random_uuid();
begin
	insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
	values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
		left(v_id::text, 8) || '@test.local', '', now(), '{"provider": "email"}', p_meta, now(), now());
	return v_id;
end;
$$;

create function tests.row_of(p_user uuid) returns public.tbl_players language sql security definer set search_path = ''
as $$ select * from public.tbl_players where user_id = p_user $$;

select tests.signup('{"display_name": "Annie", "first_name": "Ann", "last_name": "Naidu"}') as a \gset
select is((tests.row_of(:'a')).first_name, 'Ann', 'the first name is saved');
select is((tests.row_of(:'a')).last_name, 'Naidu', 'the surname is saved');
select is((tests.row_of(:'a')).display_name, 'Annie', 'the display name as before');
select is((tests.row_of(:'a')).short_code, 'Ann-Naidu', 'and the short link is there from the start');

select tests.signup('{"display_name": "Annie Two", "first_name": "Ann", "last_name": "Naidu"}') as b \gset
select is((tests.row_of(:'b')).short_code, 'Ann-Naidu-2', 'the same name registering later has the number');

select tests.signup('{"display_name": "Skipper"}') as c \gset
select is((tests.row_of(:'c')).first_name, null, 'skipping both is allowed');
select is((tests.row_of(:'c')).short_code, null, 'and there is no link');

select tests.signup('{"display_name": "Blank", "first_name": "   ", "last_name": ""}') as d \gset
select is((tests.row_of(:'d')).last_name, null, 'blanks are not names');

select tests.signup('{"display_name": "Spaced", "first_name": "  Bo  ", "last_name": null}') as e \gset
select is((tests.row_of(:'e')).first_name, 'Bo', 'spaces are trimmed');
select is((tests.row_of(:'e')).short_code, null, 'one name is not enough for a link');

select tests.signup(jsonb_build_object('display_name', 'Long', 'first_name', repeat('a', 300), 'last_name', 'Lee')) as f \gset
select is(length((tests.row_of(:'f')).first_name), 100, 'a very long name is cut rather than failing the sign-up');

select tests.signup('{"full_name": "Google Person", "name": "Google Person"}') as g \gset
select is((tests.row_of(:'g')).first_name, null, 'Google''s one full name is not split here');

select * from finish();
rollback;
