-- Short links for players (migration 20261110084238, docs/design/short-links.md).
--
-- UV, 10 Nov:
--   • first name, surname and a number only when the name is taken, with dashes
--   • the first to register has the plain name
--   • nobody can choose or change one; it follows the name
--   • no first name or surname, no link
--   • a stranger cannot test names to learn who belongs to the club
begin;
\ir _helpers.psql
select plan(38);

select tests.create_user('Plink One') as one \gset
select tests.create_user('Plink Two') as two \gset
select tests.create_user('Plink Three') as three \gset
select tests.create_user('Plink Four') as four \gset
select tests.create_user('Plink Five') as five \gset
select tests.player_of(:'one') as p1 \gset
select tests.player_of(:'two') as p2 \gset
select tests.player_of(:'three') as p3 \gset
select tests.player_of(:'four') as p4 \gset
select tests.player_of(:'five') as p5 \gset

create function tests.code(p_id uuid) returns text language sql security definer set search_path = ''
as $$ select short_code from public.tbl_players where id = p_id $$;

create function tests.set_name(p_id uuid, p_first text, p_last text) returns void language sql security definer set search_path = ''
as $$ update public.tbl_players set first_name = p_first, last_name = p_last where id = p_id $$;

-- ─── Making one ───

select is(tests.code(:'p1'), null, 'an account with no names has no link');

select tests.sign_in(:'one');
update public.tbl_players set first_name = 'Ann', last_name = 'Smith' where id = :'p1';
select tests.sign_out();
select is(tests.code(:'p1'), 'Ann-Smith', 'first name, dash, surname, as the player saves them');

select tests.set_name(:'p2', 'ann', 'SMITH');
select is(tests.code(:'p2'), 'ann-SMITH-2', 'the name taken in any capitals: the next number');
select tests.set_name(:'p3', 'Ann', 'Smith');
select is(tests.code(:'p3'), 'Ann-Smith-3', 'and the next');

select tests.set_name(:'p4', 'José Mary', 'O''Brien-van der Merwe');
select is(tests.code(:'p4'), 'Jose-Mary-OBrien-van-der-Merwe', 'accents off, apostrophes closed up, every word kept');
select tests.set_name(:'p4', 'Bjørn', 'Müller');
select is(tests.code(:'p4'), 'Bjorn-Muller', 'more accents');
select tests.set_name(:'p4', 'Bob2', 'Jones');
select is(tests.code(:'p4'), 'Bob-Jones', 'digits in a name are left out, so only the added number is one');
select tests.set_name(:'p4', 'J.P.', 'Du Toit');
select is(tests.code(:'p4'), 'J-P-Du-Toit', 'initials with a surname');

-- ─── No link ───

select tests.set_name(:'p5', 'Sam', null);
select is(tests.code(:'p5'), null, 'no surname, no link');
select tests.set_name(:'p5', null, 'Jones');
select is(tests.code(:'p5'), null, 'no first name, no link');
select tests.set_name(:'p5', 'S', 'Jones');
select is(tests.code(:'p5'), null, 'an initial is not a first name');
select tests.set_name(:'p5', 'T', 'Bone');
select is(tests.code(:'p5'), null, 'T-Bone would be read as a tournament');
select tests.set_name(:'p5', 'L.A.', 'Bone');
select is(tests.code(:'p5'), null, 'L-A-Bone starts like a league');
select tests.set_name(:'p5', '李', '王');
select is(tests.code(:'p5'), null, 'nothing an address can hold, no link');

-- ─── It follows the name ───

update public.tbl_players set display_name = 'Annie' where id = :'p2';
select is(tests.code(:'p2'), 'ann-SMITH-2', 'a new display name changes nothing');
select tests.set_name(:'p2', 'ann', 'SMITH');
select is(tests.code(:'p2'), 'ann-SMITH-2', 'saving the same name keeps the number');
select tests.set_name(:'p2', 'Ann', 'Smith');
select is(tests.code(:'p2'), 'Ann-Smith-2', 'new capitals keep the number too');

select tests.set_name(:'p1', 'Anne', 'Smith');
select is(tests.code(:'p1'), 'Anne-Smith', 'a new name, a new link');
select is(tests.code(:'p2'), 'Ann-Smith-2', 'the others keep theirs when the plain one is freed');
select tests.set_name(:'p5', 'Ann', 'Smith');
select is(tests.code(:'p5'), 'Ann-Smith', 'the plain one is free for the next person to have that name');
select tests.set_name(:'p5', null, null);
select is(tests.code(:'p5'), null, 'clearing the names removes the link');

-- ─── An account is needed ───

insert into public.tbl_players (display_name, first_name, last_name, player_type)
values ('Walker', 'Wally', 'Walker', 'walk_in')
returning id as walkin \gset
select is(tests.code(:'walkin'), null, 'a walk-in has no link');

select tests.create_user('Wally Signup') as wally \gset
select tests.player_of(:'wally') as wally_p \gset
select tests.set_name(:'wally_p', 'Wally', 'Walker');
select is(tests.code(:'wally_p'), 'Wally-Walker', 'so the person who registers has the plain name');

select private.tdc_merge_players(:'walkin', :'wally_p', :'wally');
select is(tests.code(:'walkin'), 'Wally-Walker', 'merging gives the walk-in record the link');

delete from auth.users where id = :'wally';
select is(tests.code(:'walkin'), null, 'a deleted account gives its link up');

-- ─── Following one ───

select tests.sign_in(:'two');
select is(public.tdc_resolve_short_code('Anne-Smith') ->> 'path', '/players/?p=' || :'p1', 'opens the profile');
select is(public.tdc_resolve_short_code('anne-SMITH') ->> 'path', '/players/?p=' || :'p1', 'in any capitals');
select is(public.tdc_resolve_short_code('Ann-Smith-3') ->> 'path', '/players/?p=' || :'p3', 'with its number');
select is(public.tdc_resolve_short_code('Nobody-Here') ->> 'reason', 'no_player', 'a name nobody has says so');
select is(public.tdc_resolve_short_code('T-Bone') ->> 'reason', 'not_found', 'T- is still only a tournament');
select is(public.tdc_short_link('player', :'p1') ->> 'code', 'Anne-Smith', 'the page reads the code');
select is(public.tdc_short_link('player', :'p5') ->> 'code', null, 'and learns there is none');
select tests.sign_out();

select tests.sign_in_anon();
select is(public.tdc_resolve_short_code('Anne-Smith'), '{"reason": "sign_in"}'::jsonb, 'signed out: asked to sign in');
select is(public.tdc_resolve_short_code('Nobody-Here'), '{"reason": "sign_in"}'::jsonb, 'with the same answer for a name nobody has');
select throws_ok(format('select public.tdc_short_link(''player'', %L)', :'p1'), 'Sign in to see a player''s short link.',
	'a stranger cannot turn an id into a name');
select tests.sign_out();

-- ─── Nobody chooses one ───

select tests.sign_in(:'one');
select throws_ok(format('update public.tbl_players set short_code = ''Free-Drinks'' where id = %L', :'p1'), '42501', null,
	'the browser cannot write it');
select throws_ok(format('select public.tdc_set_short_code(''player'', %L, ''FREE'')', :'p1'), null, null,
	'the code-changing function does not take a player');
select throws_ok(format('select public.tdc_short_code_status(''player'', %L, ''FREE'')', :'p1'), null, null,
	'nor does the field''s check');
select tests.sign_out();

select * from finish();
rollback;
