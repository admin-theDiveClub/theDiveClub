-- Tournament walk-ins from Entrants, and connecting them to an account
-- (migration 20261127134429, UV 27 Nov): the pasted list, asking, the
-- account's answer through the walk-in merge, cancelling, and the merge
-- carrying an ask addressed to an account.
begin;
\ir _helpers.psql
select plan(38);

select tests.create_user('Wi Dee') as dee \gset
select tests.create_user('Wi Jane') as jane \gset
select tests.create_user('Wi Ben') as ben \gset
select tests.create_user('Wi Kim') as kim \gset
select tests.create_user('Wi Stranger') as stranger \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Friday Comp', tests.rules(), p_max_entrants => 4) as t \gset

-- 1. The pasted list.
select tests.sign_in(:'stranger');
select throws_ok(format('select * from public.tdc_add_walk_in_entrants(%L, %L)', :'t', '{Jo}'),
	'Only the people running this tournament can add entrants.',
	'a stranger cannot add walk-ins');
select tests.sign_in(:'dee');
select throws_ok(format('select * from public.tdc_add_walk_in_entrants(%L, %L)', :'t', '{}'),
	'Please enter at least one name.', 'an empty list is refused');

create temp table added as
select * from public.tdc_add_walk_in_entrants(:'t',
	array['1. Jo  Smith', 'jo smith', '', '   ', 'Ann', repeat('x', 101)]);
select is((select count(*)::integer from added), 3,
	'one row per name: blanks dropped, the same name twice is one');
select is((select string_agg(name, '|' order by name) from added where player_id is not null), 'Ann|Jo Smith',
	'numbering and doubled spaces are taken off');
select is((select skipped from added where player_id is null), 'longer than 100 characters',
	'a name over 100 characters is skipped, and says why');
select tests.sign_out();
select is((select count(*)::integer from public.tbl_players p join added a on a.player_id = p.id
	where p.player_type = 'walk_in' and p.user_id is null and p.created_by = :'dee'), 2,
	'each is a walk-in with no account, made by the director');
select is((select count(*)::integer from public.tbl_tournament_entrants e join added a on a.player_id = e.player_id
	where e.tournament_id = :'t' and e.status = 'confirmed' and e.added_by = :'dee'), 2,
	'each is entered, confirmed');
select is((select count(*)::integer from public.tbl_notifications n join added a on a.player_id = n.player_id), 0,
	'nobody is notified: a walk-in has no account');
select a.player_id as jo from added a where a.name = 'Jo Smith' \gset
select a.player_id as ann from added a where a.name = 'Ann' \gset

select tests.sign_in(:'dee');
select is((select skipped from public.tdc_add_walk_in_entrants(:'t', '{ANN}')), 'already entered',
	'a name already among the entrants is skipped');
select public.tdc_add_entrant(:'t', tests.player_of(:'kim'), 'confirmed');
select is((select string_agg(coalesce(skipped, 'added'), '|' order by name)
	from public.tdc_add_walk_in_entrants(:'t', '{Cy,Di}')), 'added|the tournament is full',
	'past the limit, the rest are skipped as full');
select p.id as cy from public.tbl_players p join public.tbl_tournament_entrants e on e.player_id = p.id
	where e.tournament_id = :'t' and p.display_name = 'Cy' \gset

-- 2. Asking.
select tests.sign_in(:'stranger');
select throws_ok(format('select public.tdc_ask_to_connect(%L, %L, %L)', :'t', :'jo', tests.player_of(:'jane')),
	'Only the people running this tournament can connect its walk-ins.',
	'a stranger cannot ask');
select tests.sign_in(:'dee');
select throws_ok(format('select public.tdc_ask_to_connect(%L, %L, %L)', :'t', :'jo', tests.player_of(:'dee')),
	'You can''t connect a walk-in to your own account. Ask another director.',
	'a director cannot connect a walk-in to their own account');
select throws_ok(format('select public.tdc_ask_to_connect(%L, %L, %L)', :'t', :'jo', :'ann'),
	'Ann has no account. Choose a player who has signed up.',
	'only an account can be asked');
select throws_ok(format('select public.tdc_ask_to_connect(%L, %L, %L)', :'t', :'jo', tests.player_of(:'kim')),
	'Wi Kim is already entered in this tournament. Remove one of the two first.',
	'an account already entered cannot be asked');
select throws_ok(format('select public.tdc_ask_to_connect(%L, %L, %L)', :'t', tests.player_of(:'kim'), tests.player_of(:'jane')),
	'Wi Kim already has an account.',
	'only a walk-in can be connected');

select public.tdc_ask_to_connect(:'t', :'jo', tests.player_of(:'ben')) as r1 \gset
select public.tdc_ask_to_connect(:'t', :'jo', tests.player_of(:'jane')) as r2 \gset
select tests.sign_out();
select is((select count(*)::integer from public.tbl_player_connect_requests where walk_in_player_id = :'jo'), 1,
	'asking again replaces the ask: one per walk-in');
select is((select account_player_id from public.tbl_player_connect_requests where walk_in_player_id = :'jo'),
	tests.player_of(:'jane'), 'the ask is now to the second account');
select is((select title from public.tbl_notifications where player_id = tests.player_of(:'jane') and kind = 'connect_ask'),
	'Were you "Jo Smith" in Friday Comp?', 'the account is asked in its tray');
select is((select link from public.tbl_notifications where player_id = tests.player_of(:'jane') and kind = 'connect_ask'),
	'/accounts/profile/#connect', 'the notification opens the profile');

-- 3. What is waiting.
select tests.sign_in(:'dee');
select is((select account_name from public.tdc_tournament_connect_requests(:'t') where walk_in_player_id = :'jo'), 'Wi Jane',
	'Entrants sees whom each walk-in''s ask is to');
select tests.sign_in(:'stranger');
select throws_ok(format('select * from public.tdc_tournament_connect_requests(%L)', :'t'),
	'Only the people running this tournament can see its requests.', 'a stranger cannot see them');
select is((select count(*)::integer from public.tdc_my_connect_requests()), 0, 'a stranger has nothing waiting');
select throws_ok('select * from public.tbl_player_connect_requests', '42501', null,
	'the table cannot be read directly');
select throws_ok(format('select public.tdc_answer_connect(%L, true)', :'r2'),
	'That request is no longer waiting for you.', 'a stranger cannot answer');
select tests.sign_in(:'jane');
select is((select row(walk_in_name, tournament_name, asked_by_name)::text from public.tdc_my_connect_requests()),
	'("Jo Smith","Friday Comp","Wi Dee")', 'the account sees who asks, about whom, in which tournament');

-- 4. Declining.
select tests.sign_in(:'dee');
select public.tdc_ask_to_connect(:'t', :'ann', tests.player_of(:'ben')) as r3 \gset
select tests.sign_in(:'ben');
select is(public.tdc_answer_connect(:'r3', false), null, 'declining returns nothing');
select tests.sign_out();
select ok(not exists (select 1 from public.tbl_player_connect_requests where id = :'r3'), 'declined, the ask is gone');
select ok((select user_id is null from public.tbl_players where id = :'ann'), 'and Ann stays a walk-in');
select is((select title from public.tbl_notifications where player_id = tests.player_of(:'dee') and kind = 'connect_declined'),
	'Wi Ben declined: they are not "Ann"', 'the director is told');

-- 5. Accepting: the walk-in merge.
select tests.player_of(:'jane') as jane_old \gset
select tests.sign_in(:'jane');
select is(public.tdc_answer_connect(:'r2', true), :'jo'::uuid, 'accepting keeps the walk-in''s record');
select tests.sign_out();
select ok((select user_id = :'jane' and player_type = 'member' and display_name = 'Wi Jane'
	from public.tbl_players where id = :'jo'), 'it is now Jane''s account, with the name she chose');
select ok(not exists (select 1 from public.tbl_players where id = :'jane_old'), 'her empty signup record is gone');
select ok(exists (select 1 from public.tbl_tournament_entrants where tournament_id = :'t' and player_id = :'jo' and status = 'confirmed'),
	'her place in the tournament is hers');
select ok(not exists (select 1 from public.tbl_player_connect_requests where walk_in_player_id = :'jo'), 'the ask is gone');
select is((select title from public.tbl_notifications where player_id = tests.player_of(:'dee') and kind = 'connect_accepted'),
	'Wi Jane accepted: they are "Jo Smith"', 'the director is told');

-- 6. Cancelling, and the merge carrying an ask to an account.
select tests.sign_in(:'dee');
select public.tdc_ask_to_connect(:'t', :'cy', tests.player_of(:'ben')) as r4 \gset
select tests.sign_in(:'stranger');
select throws_ok(format('select public.tdc_cancel_connect(%L)', :'r4'),
	'Only the people running this tournament can cancel its requests.', 'a stranger cannot cancel');
select tests.sign_out();
-- Ben's account is joined to an older walk-in of his (as Staff › Link does):
-- the ask to Ben goes with him.
insert into public.tbl_players (display_name, player_type) values ('Benny', 'walk_in') returning id as benny \gset
select private.tdc_merge_players(:'benny', tests.player_of(:'ben'), :'ben');
select is((select account_player_id from public.tbl_player_connect_requests where id = :'r4'), :'benny'::uuid,
	'an ask to an account moves with the account in a merge');
select tests.sign_in(:'dee');
select public.tdc_cancel_connect(:'r4');
select tests.sign_out();
select ok(not exists (select 1 from public.tbl_player_connect_requests where id = :'r4'), 'the director can take an ask back');

select * from finish();
rollback;
