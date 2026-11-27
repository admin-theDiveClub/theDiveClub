-- The draw open to the public (migration 20261127181750).
--
-- UV, 27 Nov: the bracket open to the public. Signed out: only a tournament
-- set Visible to public, and no full names, surnames or override reasons.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('Pub Dee') as dee \gset
select tests.create_user('Pub Ann') as ann \gset
select tests.create_user('Pub Bob') as bob \gset
update public.tbl_players set first_name = 'Ann', last_name = 'Archer' where id = tests.player_of(:'ann');

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Pub Open', tests.rules(), p_is_listed => true) as open \gset
select public.tdc_create_tournament('Pub Hidden', tests.rules()) as hidden \gset
select public.tdc_add_entrant(:'open', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'open', tests.player_of(:'bob'), 'confirmed');
select public.tdc_add_entrant(:'hidden', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'hidden', tests.player_of(:'bob'), 'confirmed');
select public.tdc_generate_draw(:'open');
select public.tdc_generate_draw(:'hidden');
select public.tdc_set_match_override(public.tdc_create_fixture_match(fixture_id), 3, 1, 'A reason')
	from public.tdc_public_draw(:'open') where round = 1;
select is((select home_full_name from public.tdc_tournament_draw(:'open')), 'Ann Archer', 'signed in, the draw itself: the full name');
select tests.sign_out();

select tests.sign_in_anon();
select is((select count(*)::int from public.tdc_public_draw(:'open')), 1, 'signed out: a public tournament''s draw');
select is((select home_name from public.tdc_public_draw(:'open')), 'Pub Ann', 'with display names');
select is((select home_full_name from public.tdc_public_draw(:'open')), null, 'no full names');
select is((select home_surname from public.tdc_public_draw(:'open')), null, 'no surnames');
select is((select override_reason from public.tdc_public_draw(:'open')), null, 'no override reasons');
select is((select home_frames || '-' || away_frames from public.tdc_public_draw(:'open')), '3-1', 'the score');
select is((select count(*)::int from public.tdc_public_draw(:'hidden')), 0, 'nothing of a tournament not public');
select is((select name from public.tdc_tournament_public(:'open')) || '|' || coalesce((select name from public.tdc_tournament_public(:'hidden')), 'none'),
	'Pub Open|none', 'the heading read on the same terms');
select tests.sign_out();

select * from finish();
rollback;
