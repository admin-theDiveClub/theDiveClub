-- Each frame in the profile names the player across the table (migration
-- 20261120130000, UV 20 Nov: the form's rows show the opponent, a player not a team).
begin;
\ir _helpers.psql
select plan(3);

select tests.create_user('Opp Alice') as alice \gset
select tests.create_user('Opp Bob') as bob \gset
select tests.player_of(:'alice') as pal \gset
select tests.player_of(:'bob') as pbo \gset
update public.tbl_players set display_name = 'Alice' where id = :'pal';
update public.tbl_players set display_name = 'Bobby' where id = :'pbo';

select tests.sign_in(:'alice');
select public.tdc_create_match(:'pbo', tests.rules('{"approval_mode": "none"}'), 'home') as m1 \gset
select public.tdc_record_frame(:'m1', 1, '{"winner_side": "home", "result_event": "win"}');
select public.tdc_record_frame(:'m1', 2, '{"winner_side": "away", "result_event": "win"}');
select public.tdc_submit_card(:'m1');

select tests.sign_in(:'bob');
select public.tdc_player_profile(:'pal') as pa \gset
select public.tdc_player_profile(:'pbo') as pb \gset

select is((select string_agg(f ->> 'opponent', ',') from jsonb_array_elements(:'pa'::jsonb -> 'frames') f),
	'Bobby,Bobby', 'Alice''s frames name Bobby across the table');
select is((select string_agg(f ->> 'opponent', ',') from jsonb_array_elements(:'pb'::jsonb -> 'frames') f),
	'Alice,Alice', 'and Bobby''s name Alice');
select is((select count(*)::int from jsonb_array_elements(:'pa'::jsonb -> 'frames') f where f ? 'opponent'), 2,
	'every frame carries the field');

select * from finish();
rollback;
