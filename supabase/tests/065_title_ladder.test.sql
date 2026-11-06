-- The title ladder (/staff/titles/, UV 6 Nov).
--
--   only an owner of The Dive Club reads or changes it
--   not another venue's owner, not The Dive Club's staff, not a player, not anon
--   no direct reads or writes from the browser
--   the draft is there, with UV's ends and steps
--   adding, changing and deleting titles and groups, with their refusals
begin;
\ir _helpers.psql
select plan(33);

select tests.create_user('Ladder Owner') as owner \gset
select tests.create_user('Ladder Other Owner') as other_owner \gset
select tests.create_user('Ladder Staff') as staff \gset
select tests.create_user('Ladder Player') as player \gset

select id as dive from public.tbl_venues where slug = 'the-dive-club' \gset
insert into public.tbl_venues (name, slug) values ('Ladder Other Venue', 'ladder-other-venue') returning id as other \gset

insert into public.tbl_venue_staff (venue_id, user_id, role) values
	(:'dive', :'owner', 'owner'),
	(:'other', :'other_owner', 'owner'),
	(:'dive', :'staff', 'staff');

-- ─── Who may ───

select tests.sign_in(:'owner');
select ok(public.tdc_can_edit_titles(), 'The Dive Club''s owner may');
select lives_ok($$ select public.tdc_title_ladder() $$, 'and reads the list');

select tests.sign_in(:'other_owner');
select ok(not public.tdc_can_edit_titles(), 'another venue''s owner may not');
select throws_ok($$ select public.tdc_title_ladder() $$, 'This page is for an owner of The Dive Club only.', 'nor read the list');
select throws_ok($$ select public.tdc_save_title_group(null, 'Nope') $$, 'Only an owner of The Dive Club may change the titles.', 'nor add a group');

select tests.sign_in(:'staff');
select ok(not public.tdc_can_edit_titles(), 'The Dive Club''s staff may not');
select throws_ok($$ select public.tdc_title_ladder() $$, 'This page is for an owner of The Dive Club only.', 'nor read the list');

select tests.sign_in(:'player');
select is(public.tdc_can_edit_titles(), false, 'a player gets false, never null');
select throws_ok(format($$ select public.tdc_save_title(null, (select null::uuid), 'Nope', 10, null) $$), 'Only an owner of The Dive Club may change the titles.', 'nor add a title');
select throws_ok($$ select * from public.tbl_titles $$, '42501', null, 'no direct read of the titles');
select throws_ok($$ select * from public.tbl_title_groups $$, '42501', null, 'nor of the groups');
select throws_ok($$ insert into public.tbl_title_groups (name, position) values ('Nope', 99) $$, '42501', null, 'no direct write');

select tests.sign_out();
select ok(not has_function_privilege('anon', 'public.tdc_title_ladder()', 'execute'), 'anon may not read the list');
select ok(not has_function_privilege('anon', 'public.tdc_can_edit_titles()', 'execute'), 'nor ask');
select ok(not has_function_privilege('anon', 'public.tdc_save_title(uuid, uuid, text, integer, text)', 'execute'), 'nor add a title');

-- ─── The draft ───

select is((select t.step from public.tbl_titles t where t.name = 'Quark'), 1, 'Quark is at the bottom');
select is((select t.step from public.tbl_titles t where t.name = 'Space Emperor'), 100, 'Space Emperor at the top');
select results_eq(
	$$ select t.name, t.step from public.tbl_titles t join public.tbl_title_groups g on g.id = t.group_id
		where g.name = 'Space' and t.step < 100 order by t.step $$,
	$$ values ('Planet'::text, 20), ('Galaxy', 40), ('Universe', 60) $$,
	'UV''s Space example, on his steps'
);

-- ─── Changing the list ───

create function pg_temp.acorn(p_id uuid) returns text language sql security definer as $$
	select t.name || '|' || t.step || '|' || coalesce(t.note, '') from public.tbl_titles t where t.id = p_id
$$;

select tests.sign_in(:'owner');

select public.tdc_save_title_group(null, '  Test Trees  ') as trees \gset
select public.tdc_save_title(null, :'trees', ' Acorn ', 3, '  Small  ') as acorn \gset

select is(pg_temp.acorn(:'acorn'), 'Acorn|3|Small', 'a title is added, its spaces trimmed');
select ok(
	(select public.tdc_title_ladder() -> 'groups' -> -1 ->> 'name') = 'Test Trees',
	'a new group goes last'
);
select ok(
	(select public.tdc_title_ladder() -> 'titles') @> jsonb_build_array(jsonb_build_object('name', 'Acorn', 'step', 3, 'note', 'Small')),
	'and the list shows the title'
);
select lives_ok(format($$ select public.tdc_save_title(null, %L, 'Sapling', 3, null) $$, :'trees'), 'a step can hold several titles');

select public.tdc_save_title(:'acorn', :'trees', 'Oak', 90, '');
select is(pg_temp.acorn(:'acorn'), 'Oak|90|', 'a title is changed, and an empty note is no note');

select throws_ok(format($$ select public.tdc_save_title(null, %L, 'Elm', 0, null) $$, :'trees'), 'A title''s step must be from 1 to 100.', 'step 0 refused');
select throws_ok(format($$ select public.tdc_save_title(null, %L, 'Elm', 101, null) $$, :'trees'), 'A title''s step must be from 1 to 100.', 'step 101 refused');
select throws_ok(format($$ select public.tdc_save_title(null, %L, '   ', 10, null) $$, :'trees'), 'A title must be 1 to 60 characters.', 'an empty title refused');
select throws_ok(format($$ select public.tdc_save_title(null, %L, 'oak', 10, null) $$, :'trees'), 'That group already has a title called oak.', 'the same title twice in a group refused');
select throws_ok($$ select public.tdc_save_title_group(null, 'space') $$, 'There is already a group called space.', 'the same group twice refused');

select lives_ok(format($$ select public.tdc_save_title_group(%L, 'Test Forest') $$, :'trees'), 'a group is renamed');

select public.tdc_delete_title(:'acorn');
select is(pg_temp.acorn(:'acorn'), null, 'a title is deleted');
select throws_ok(format($$ select public.tdc_delete_title(%L) $$, :'acorn'), 'That title is not on the list any more.', 'and deleting it twice says so');

select public.tdc_delete_title_group(:'trees');
select is(
	(select count(*)::int from public.tdc_title_ladder() l, jsonb_array_elements(l -> 'titles') e where e ->> 'name' = 'Sapling'),
	0,
	'a group''s titles go with it'
);
select throws_ok(format($$ select public.tdc_delete_title_group(%L) $$, :'trees'), 'That group is not on the list any more.', 'and deleting it twice says so');

select * from finish();
rollback;
