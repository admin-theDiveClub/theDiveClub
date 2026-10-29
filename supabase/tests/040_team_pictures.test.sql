-- A team's picture (migration 20261029154054): its captain or whoever runs the
-- league sets it and uploads into its folder; a player on the team, a captain
-- of another team and a stranger may not.
begin;
\ir _helpers.psql
select plan(11);

select tests.create_user('TPic LD') as ld \gset
select tests.create_user('TPic Captain') as cap \gset
select tests.create_user('TPic Player') as player \gset
select tests.create_user('TPic Other Captain') as other \gset
select tests.create_user('TPic Stranger') as stranger \gset

select tests.sign_in(:'ld');
select public.tdc_create_league('TPic League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Alpha') as ta \gset
select public.tdc_create_team(:'season', 'Bravo') as tb \gset
select public.tdc_add_league_entrant(:'season', tests.player_of(:'cap'), :'ta', true);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'player'), :'ta', false);
select public.tdc_add_league_entrant(:'season', tests.player_of(:'other'), :'tb', true);

select tests.sign_in(:'cap');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('team-pictures', %L) $$, :'ta' || '/a.webp'),
	'its captain may upload into the team''s folder');
select is(public.tdc_set_team_picture(:'ta', :'ta' || '/a.webp'), null, 'setting the first picture returns no old one');
select is(public.tdc_set_team_picture(:'ta', :'ta' || '/b.webp'), :'ta' || '/a.webp', 'setting another returns the one it replaced');
select throws_ok(format($$ select public.tdc_set_team_picture(%L, %L) $$, :'ta', :'tb' || '/c.webp'),
	'P0001', 'TDC (Error): a team''s picture must be in its own folder.', 'a picture outside the team''s folder is refused');

select tests.sign_in(:'player');
select throws_ok(format($$ select public.tdc_set_team_picture(%L, %L) $$, :'ta', :'ta' || '/d.webp'),
	'P0001', 'Only the team''s captain or whoever runs the league can change its picture.', 'a player on the team may not set it');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('team-pictures', %L) $$, :'ta' || '/e.webp'),
	'42501', null, 'nor upload into its folder');

select tests.sign_in(:'other');
select throws_ok(format($$ select public.tdc_set_team_picture(%L, %L) $$, :'ta', :'ta' || '/f.webp'),
	'P0001', 'Only the team''s captain or whoever runs the league can change its picture.', 'another team''s captain may not set it');

select tests.sign_in(:'stranger');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('team-pictures', %L) $$, :'ta' || '/g.webp'),
	'42501', null, 'a stranger may not upload into its folder');

select tests.sign_in(:'ld');
select is(public.tdc_set_team_picture(:'ta', null), :'ta' || '/b.webp', 'whoever runs the league may clear it, getting the last one back');
select tests.sign_out();

select is((select picture_path from public.tbl_teams where id = :'ta'), null, 'the picture is cleared');
select throws_ok(format($$ update public.tbl_teams set picture_path = %L where id = %L $$, :'tb' || '/h.webp', :'ta'),
	'23514', null, 'the column itself refuses another team''s folder');

select * from finish();
rollback;
