-- The profile's frames carry the break result (migration
-- 20261119142114, UV 19 Nov: the player star's Break in spoke).
--
--   each frame's break_outcome comes back as recorded
--   a frame with no break result recorded comes back null
--   the other fields are unchanged
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('Star Alice') as alice \gset
select tests.create_user('Star Bob') as bob \gset
select tests.player_of(:'alice') as pal \gset
select tests.player_of(:'bob') as pbo \gset

-- Alice (home) v Bob, alternate breaks from home: frame 1 Alice breaks in and
-- wins, frame 2 Bob breaks dry and Alice wins, frame 3 Alice breaks and wins
-- with no break result recorded. Submitted with no approval: complete.
select tests.sign_in(:'alice');
select public.tdc_create_match(:'pbo', tests.rules('{"track_breaks": true, "approval_mode": "none"}'), 'home') as m1 \gset
select public.tdc_record_frame(:'m1', 1, '{"winner_side": "home", "result_event": "win", "break_outcome": "in"}');
select public.tdc_record_frame(:'m1', 2, '{"winner_side": "home", "result_event": "win", "break_outcome": "dry"}');
select public.tdc_record_frame(:'m1', 3, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_submit_card(:'m1');

select tests.sign_in(:'bob');
select public.tdc_player_profile(:'pal') as prof \gset

select is((select f ->> 'break_outcome' from jsonb_array_elements(:'prof'::jsonb -> 'frames') f where f ->> 'frame_no' = '1'),
	'in', 'frame 1: her break went in');
select is((select f ->> 'break_outcome' from jsonb_array_elements(:'prof'::jsonb -> 'frames') f where f ->> 'frame_no' = '2'),
	'dry', 'frame 2: his break was dry, on her frame too');
select ok((select (f -> 'break_outcome') = 'null'::jsonb from jsonb_array_elements(:'prof'::jsonb -> 'frames') f where f ->> 'frame_no' = '3'),
	'frame 3: no break result recorded is null');
select is((select string_agg(f ->> 'frame_no', ',' order by (f ->> 'frame_no')::int)
	from jsonb_array_elements(:'prof'::jsonb -> 'frames') f where (f ->> 'broke')::boolean), '1,3',
	'who broke is unchanged');
select is((select count(*)::int from jsonb_array_elements(:'prof'::jsonb -> 'frames') f where (f ->> 'won')::boolean), 3,
	'who won is unchanged');

select * from finish();
rollback;
