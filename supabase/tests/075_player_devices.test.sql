-- Which devices each player uses (migration player_devices, UV 13 Nov).
--
-- The nav records once a day, signed in, the device, the browser and whether
-- it is the installed app, for the points to count using the app.
--
--   a record makes one row; the same day again only moves last_seen
--   a later day counts one more day
--   the app and the browser on the same phone are two rows
--   an unknown value is refused, as is somebody signed out
--   nobody can read the table from a page
--   a walk-in claim carries the account's rows onto the record that stays
begin;
\ir _helpers.psql
select plan(11);

select tests.create_user('Dev Ann') as ann \gset
select tests.create_user('Dev Sam') as sam \gset
select tests.create_user('Dev Staff') as staff \gset
select tests.player_of(:'ann') as pann \gset
select tests.player_of(:'sam') as psam \gset

select tests.sign_in(:'ann');
select public.tdc_record_device('ios', 'safari', false);
select public.tdc_record_device('ios', 'safari', false);
select tests.sign_out();
select is((select days_seen from public.tbl_player_devices where player_id = :'pann'), 1, 'twice in a day: one row, one day');

-- Pretend the last record was yesterday.
update public.tbl_player_devices set last_seen = now() - interval '1 day' where player_id = :'pann';
select tests.sign_in(:'ann');
select public.tdc_record_device('ios', 'safari', false);
select public.tdc_record_device('ios', 'other', true);
select tests.sign_out();
select is((select days_seen from public.tbl_player_devices where player_id = :'pann' and not installed), 2, 'a later day counts one more');
select is((select count(*)::int from public.tbl_player_devices where player_id = :'pann'), 2, 'the app is a row of its own');
select ok((select last_seen > now() - interval '1 minute' from public.tbl_player_devices where player_id = :'pann' and not installed), 'last seen moves on');

select tests.sign_in(:'ann');
select throws_like($$ select public.tdc_record_device('nokia', 'safari', false) $$, '%unknown device%', 'an unknown device is refused');
select throws_like($$ select public.tdc_record_device('ios', 'netscape', false) $$, '%unknown browser%', 'an unknown browser is refused');
select throws_like($$ select public.tbl_player_devices.player_id from public.tbl_player_devices $$, '%permission denied%', 'a page cannot read the table');
select tests.sign_out();

select tests.sign_in_anon();
select throws_like($$ select public.tdc_record_device('ios', 'safari', false) $$, '%permission denied%', 'signed out: not allowed');
select tests.sign_out();

-- A walk-in claimed by Sam's account: Sam's rows end on the walk-in record.
select tests.sign_in(:'sam');
select public.tdc_record_device('android', 'chrome', false);
select tests.sign_out();
insert into public.tbl_venues (name, slug) values ('Dev Venue', 'dev-venue') returning id as venue \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'venue', :'staff', 'staff');
select tests.sign_in(:'staff');
select public.tdc_create_walk_in(:'venue', 'Sam Walk-in') as wsam \gset
select public.tdc_staff_link_account(:'venue', :'wsam', :'psam');
select tests.sign_out();
select is((select count(*)::int from public.tbl_player_devices where player_id = :'wsam'), 1, 'the claim carries the device');
select is((select count(*)::int from public.tbl_player_devices where player_id = :'psam'), 0, 'nothing left on the removed record');

select ok(not has_function_privilege('anon', 'public.tdc_record_device(text, text, boolean)', 'execute'), 'anon may not call it');

select * from finish();
rollback;
