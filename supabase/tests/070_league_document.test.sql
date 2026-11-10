-- A league's document (20261110, league_document): who may add, read, name and
-- delete it, and that nothing but a PDF in the league's own folder gets named.
begin;
\ir _helpers.psql
select plan(19);

select tests.create_user('Doc LD') as ld \gset
select tests.create_user('Doc Player') as player \gset

select tests.sign_in(:'ld');
select public.tdc_create_league('Doc League', tests.rules('{"team_size": 2}')) as league \gset

select ok(:'league' is not null, 'a league to attach a document to');

select :'league' || '/11111111-1111-4111-8111-111111111111.pdf' as good_a \gset
select :'league' || '/22222222-2222-4222-8222-222222222222.pdf' as good_b \gset
select :'league' || '/notes.pdf' as bad_name \gset
\set meta '{"mimetype":"application/pdf","size":1000}'

-- ─── The bucket's own limits ───
select tests.sign_out();
select is((select public from storage.buckets where id = 'league-documents'), false, 'the bucket is private');
select is((select file_size_limit::bigint from storage.buckets where id = 'league-documents'), 5242880::bigint, 'five megabytes at most');
select is((select allowed_mime_types from storage.buckets where id = 'league-documents'), array['application/pdf'], 'PDFs alone');
select tests.sign_in(:'ld');

-- ─── Adding ───
select lives_ok(format($$ insert into storage.objects (bucket_id, name, metadata) values ('league-documents', %L, %L) $$, :'good_a', :'meta'), 'a manager can add a file');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, metadata) values ('league-documents', %L, %L) $$, :'good_b', :'meta'), '42501', null, 'not a second file beside one not yet named');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, metadata) values ('league-documents', %L, %L) $$, :'bad_name', :'meta'), '42501', null, 'not a name of its own choosing');

-- ─── Naming it ───
select is(public.tdc_set_league_document(:'league', :'good_a'), null, 'naming the first returns nothing to delete');
select lives_ok(format($$ insert into storage.objects (bucket_id, name, metadata) values ('league-documents', %L, %L) $$, :'good_b', '{"mimetype":"text/html","size":1000}'), 'one more may be added for a replace');
select throws_ok(format($$ select public.tdc_set_league_document(%L, %L) $$, :'league', :'good_b'), 'P0001', 'That file was not stored as a PDF of 5 MB or less.', 'not one stored as something else');
select throws_ok(format($$ select public.tdc_set_league_document(%L, 'elsewhere/x.pdf') $$, :'league'), 'P0001', null, 'not outside its own folder');

-- ─── The switch ───
select lives_ok(format($$ select public.tdc_set_league_show_rules(%L, false) $$, :'league'), 'the rules can be hidden with a document');

-- ─── Somebody else ───
select tests.sign_in(:'player');
select is((select count(*)::int from storage.objects where bucket_id = 'league-documents' and name = :'good_a'), 1, 'a signed-in player can read the current document');
select is((select count(*)::int from storage.objects where bucket_id = 'league-documents' and name = :'good_b'), 0, 'but not a file that is not the document');
select throws_ok(format($$ select public.tdc_set_league_document(%L, null) $$, :'league'), 'P0001', null, 'a player cannot change it');
select throws_ok(format($$ select public.tdc_set_league_show_rules(%L, true) $$, :'league'), 'P0001', null, 'nor the switch');

select tests.sign_out();
set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'league-documents'), 0, 'somebody signed out reads no file');
reset role;

-- ─── Removing brings the rules back ───
select tests.sign_in(:'ld');
select is(public.tdc_set_league_document(:'league', null), :'good_a', 'clearing it returns the file to delete');
select is((select show_generated_rules from public.tbl_leagues where id = :'league'), true, 'and the generated rules show again');

select * from finish();
rollback;
