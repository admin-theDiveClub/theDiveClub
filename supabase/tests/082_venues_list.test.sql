-- The venues page (migration venues_list, 17 Nov): tdc_venues sends each active
-- venue's card details, signed out too, with its league and tournament counts
-- counted as its own page lists them (tdc_venue_competitions): listed only.
begin;
\ir _helpers.psql
select plan(10);

select tests.create_user('Vl Owner') as owner \gset

insert into public.tbl_venues (name, slug, address, phone, table_count, table_note)
values ('List Club', 'list-club', '1 Cue Road', '011 555 0000', 8, '8 x 9ft')
returning id as club, timezone as club_tz \gset
insert into public.tbl_venues (name, slug, active) values ('Shut Club', 'shut-club', false) returning id as shut \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values (:'club', :'owner', 'owner');
insert into public.tbl_venue_hours (venue_id, day_of_week, opens_at, closes_at) values (:'club', 5, '12:00', '02:00');

-- Two leagues there, one listed; one tournament there, listed.
select tests.sign_in(:'owner');
select public.tdc_create_league('Shown League', tests.rules('{"team_size": 2}'), :'club') as l1 \gset
select public.tdc_create_league_season(:'l1', 'Spring') as s1 \gset
select public.tdc_create_league('Hidden League', tests.rules('{"team_size": 2}'), :'club') as l2 \gset
select public.tdc_create_league_season(:'l2', 'Spring') as s2 \gset
select public.tdc_create_tournament('Shown Night', tests.rules(), 'single_elimination', :'club') as t1 \gset
select tests.sign_out();
update public.tbl_league_seasons set is_listed = true where id = :'s1';
update public.tbl_league_seasons set is_listed = false where id = :'s2';
update public.tbl_tournaments set is_listed = true where id = :'t1';


select tests.sign_in_anon();
select is((select count(*)::integer from public.tdc_venues() where id = :'club'), 1, 'signed out, an active venue is listed');
select is((select count(*)::integer from public.tdc_venues() where id = :'shut'), 0, 'a closed one is not');
select is((select address || ' / ' || phone || ' / ' || table_count || ' / ' || table_note from public.tdc_venues() where id = :'club'),
	'1 Cue Road / 011 555 0000 / 8 / 8 x 9ft', 'its address, phone and tables');
select is((select timezone from public.tdc_venues() where id = :'club'), :'club_tz', 'its timezone, for Open now');
select is((select hours from public.tdc_venues() where id = :'club'), '[{"day": 5, "opens": "12:00", "closes": "02:00"}]'::jsonb,
	'its hours, as tdc_venue gives them');
select is((select league_count from public.tdc_venues() where id = :'club'), 1, 'one league: the unlisted one is not counted');
select is((select tournament_count from public.tdc_venues() where id = :'club'), 1, 'one tournament');
select is((select league_count from public.tdc_venues() where id = :'club'),
	jsonb_array_length(public.tdc_venue_competitions(:'club') -> 'leagues'), 'the same count as the venue''s own page');

select tests.sign_in(:'owner');
select is((select count(*)::integer from public.tdc_venues() where id = :'club'), 1, 'signed in, the same list');
select is((select array_agg(name order by name) from public.tdc_venues() where name in ('List Club', 'Shut Club')), array['List Club'],
	'ordered by name, closed ones left out');

select * from finish();
rollback;
