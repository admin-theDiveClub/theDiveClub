-- A director's score saved before it is published (migration 20261127154848).
--
-- UV, 27 Nov: the Rounds view saves every press, but pushes a player through
-- only once the director has entered both scores. One score alone is a
-- draft: saved, shown, not published, nobody moves.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('Dft Dee') as dee \gset
select tests.create_user('Dft Ann') as ann \gset
select tests.create_user('Dft Bob') as bob \gset
select tests.create_user('Dft Cat') as cat \gset
select tests.create_user('Dft Dan') as dan \gset

select tests.sign_in(:'dee');
select public.tdc_create_tournament('Dft Cup', tests.rules()) as t \gset
select public.tdc_add_entrant(:'t', tests.player_of(:'ann'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'bob'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'cat'), 'confirmed');
select public.tdc_add_entrant(:'t', tests.player_of(:'dan'), 'confirmed');
select public.tdc_generate_draw(:'t');
select fixture_id as f1, away_entrant_id as f1_away from public.tdc_tournament_draw(:'t') where round = 1 and position = 1 \gset
select fixture_id as f2 from public.tdc_tournament_draw(:'t') where round = 1 and position = 2 \gset
select public.tdc_create_fixture_match(:'f1') as m1 \gset
select public.tdc_create_fixture_match(:'f2') as m2 \gset

-- One score in: a draft. Saved and shown, not published, nobody through.
select public.tdc_set_match_override(:'m1', 3, 0, 'Entered on the draw', 'draft');
select public.tdc_resolve_draw(:'t');
select is((select home_frames || '-' || away_frames from public.tdc_tournament_draw(:'t') where fixture_id = :'f1'), '3-0', 'a draft score is shown');
select ok(not private.tdc_is_published(:'m1'), 'a draft is not published');
select is((select winner_entrant_id from public.tdc_tournament_draw(:'t') where fixture_id = :'f1'), null, 'a draft decides nothing');
select is((select count(*)::int from public.tdc_tournament_draw(:'t') where round = 2 and (home_entrant_id is not null or away_entrant_id is not null)), 0,
	'nobody goes through on a draft');

-- Both in: final. Published, the match ends, the winner goes through.
select public.tdc_set_match_override(:'m1', 3, 5, 'Entered on the draw', 'final');
select public.tdc_resolve_draw(:'t');
select ok(private.tdc_is_published(:'m1'), 'a final score is published');
select is((select status from public.tbl_matches where id = :'m1'), 'complete', 'a final score ends the match');
select is((select winner_entrant_id from public.tdc_tournament_draw(:'t') where fixture_id = :'f1'), :'f1_away'::uuid, 'the away player won 3-5');
select is((select home_entrant_id from public.tdc_tournament_draw(:'t') where round = 2), :'f1_away'::uuid, 'and went through');

-- The default is as before: published, the match left as it was.
select public.tdc_set_match_override(:'m2', 4, 1, 'Entered on the draw');
select ok(private.tdc_is_published(:'m2'), 'the default still publishes');
select is((select status from public.tbl_matches where id = :'m2'), 'scheduled', 'and leaves the match as it was');

-- Approved, then changed to a draft: unpublished, and Publish publishes it
-- again rather than saying it was approved already.
select public.tdc_approve_card(:'m2');
select public.tdc_set_match_override(:'m2', 4, 2, 'Entered on the draw', 'draft');
select ok(not private.tdc_is_published(:'m2'), 'a draft after approving takes the result back');
select lives_ok(format($$ select public.tdc_approve_card(%L) $$, :'m2'), 'Publish publishes a draft on a match approved before');
select ok(private.tdc_is_published(:'m2'), 'and it is published');

select throws_ok(format($$ select public.tdc_set_match_override(%L, 1, 1, 'Entered on the draw', 'maybe') $$, :'m2'),
	'TDC (Error): a score is saved to publish, as a draft or as final, not "maybe".', 'an unknown mode is refused');
select tests.sign_out();

select * from finish();
rollback;
