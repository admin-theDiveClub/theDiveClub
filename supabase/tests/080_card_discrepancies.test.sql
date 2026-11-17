-- Discrepancies on a team card (migration 20261117054351, UV 17 Nov).
--
--   a player's own entry, changed by themselves: none
--   the opponent changes it: the player's, on their side, by the opponent
--   only the person, their captain or the LD may accept; accepting clears it,
--     and a second accept finds nothing
--   put back: now the opponent's
--   filling a value nobody had entered: none
--   a change to Nobody is a discrepancy, the current value empty
--   a side's signature clears its side's; the other side's signature does not
--   a change after a signature overrules the signer, even on an empty frame
--   the LD may accept anybody's
--   the merge carries the acceptances
begin;
\ir _helpers.psql
select plan(20);

select tests.create_user('Dis LD') as dee \gset
select tests.create_user('Dis H1') as h1 \gset
select tests.create_user('Dis H2') as h2 \gset
select tests.create_user('Dis A1') as a1 \gset
select tests.create_user('Dis A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Dis League', tests.rules('{"team_size": 2}')) as league \gset
select public.tdc_create_league_season(:'league', 'Spring') as season \gset
select public.tdc_create_team(:'season', 'Hosts') as th \gset
select public.tdc_create_team(:'season', 'Guests') as ta \gset
select public.tdc_add_league_entrant(:'season', :'ph1', :'th', true);
select public.tdc_add_league_entrant(:'season', :'ph2', :'th');
select public.tdc_add_league_entrant(:'season', :'pa1', :'ta', true);
select public.tdc_add_league_entrant(:'season', :'pa2', :'ta');
select public.tdc_generate_league_fixtures(:'season');
select id as fx from public.tbl_league_fixtures where league_season_id = :'season' and away_team_id is not null limit 1 \gset
select home_team_id = :'th'::uuid as hosts_home from public.tbl_league_fixtures where id = :'fx' \gset
select public.tdc_set_league_fixture(:'fx', p_home_team_id => :'th', p_away_team_id => :'ta') where not :'hosts_home'::boolean;
select public.tdc_create_league_match(:'fx') as m \gset
select tests.sign_out();

select tests.sign_in(:'h1');
select public.tdc_set_match_squad(:'m', :'ph1');
select public.tdc_set_match_squad(:'m', :'ph2');
select public.tdc_set_lineup_slot(:'m', 1, :'ph1');
select public.tdc_set_lineup_slot(:'m', 2, :'ph2');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

select tests.sign_in(:'a1');
select public.tdc_set_match_squad(:'m', :'pa1');
select public.tdc_set_match_squad(:'m', :'pa2');
select public.tdc_set_lineup_slot(:'m', 1, :'pa1');
select public.tdc_set_lineup_slot(:'m', 2, :'pa2');
select public.tdc_lock_lineup(:'m');
select tests.sign_out();

-- The frame H2 and A2 play, and one they do not.
select f.frame_no as fr from public.tbl_frames f
where f.match_id = :'m'
	and exists (select 1 from public.tbl_frame_participants p where p.frame_id = f.id and p.player_id = :'ph2')
	and exists (select 1 from public.tbl_frame_participants p where p.frame_id = f.id and p.player_id = :'pa2')
limit 1 \gset
select f.frame_no as other from public.tbl_frames f
where f.match_id = :'m' and f.frame_no <> :'fr' order by f.frame_no limit 1 \gset

-- What is open, as one line per discrepancy: frame, thing, owner, side, by;
-- ordered by frame, thing, then side (away before home).
create function tests.dis_open(p_m uuid) returns text language sql as $$
	select coalesce(string_agg(d.frame_no || ' ' || d.thing || ' ' || coalesce(o.display_name, '-') || ' '
		|| coalesce(d.owner_side, '-') || ' ' || coalesce(b.display_name, '-'), '; ' order by d.frame_no, d.thing, d.owner_side), '')
	from public.tdc_card_discrepancies(p_m) d
	left join public.tbl_players o on o.id = d.owner_player_id
	left join public.tbl_players b on b.id = d.changed_by_player_id;
$$;
grant execute on function tests.dis_open(uuid) to authenticated;

-- ─── A player's own entry ───

select tests.sign_in(:'h2');
select public.tdc_record_frame(:'m', :'fr', '{"status": "pending", "break_side": "home"}'::jsonb);
select public.tdc_record_frame(:'m', :'fr', '{"status": "pending", "break_side": "away"}'::jsonb);
select is(tests.dis_open(:'m'), '', 'a player changes their own lag: no discrepancy');
select public.tdc_record_frame(:'m', :'fr', '{"status": "pending", "break_side": "home"}'::jsonb);
select tests.sign_out();

-- ─── Overruled by the opponent ───

select tests.sign_in(:'a2');
select public.tdc_record_frame(:'m', :'fr', '{"status": "pending", "break_side": "away"}'::jsonb);
select is(tests.dis_open(:'m'), :'fr' || ' lag Dis H2 home Dis A2', 'the opponent moves it: H2''s, on home, by A2');
select throws_ok(format($$ select public.tdc_accept_frame_change(%L, %s, 'lag') $$, :'m', :'fr'),
	'P0001', 'Only the player whose entry was changed, their captain or the league director can accept this.',
	'the opponent cannot accept it');
select tests.sign_out();

select tests.sign_in(:'h2');
select public.tdc_record_frame(:'m', :'fr', '{"status": "pending", "break_side": "home"}'::jsonb);
select is(tests.dis_open(:'m'), :'fr' || ' lag Dis A2 away Dis H2', 'H2 puts it back: now A2''s, by H2');
select tests.sign_out();

select card_version as v_before from public.tbl_matches where id = :'m' \gset
select tests.sign_in(:'a1');
select ok(public.tdc_accept_frame_change(:'m', :'fr', 'lag'), 'A2''s captain accepts it');
select is(tests.dis_open(:'m'), '', 'and it is gone');
select ok(not public.tdc_accept_frame_change(:'m', :'fr', 'lag'), 'accepting again finds nothing');
select tests.sign_out();
select is((select m.card_version from public.tbl_matches m where m.id = :'m'), :'v_before'::integer,
	'accepting does not move the card''s version');

-- ─── The result ───

select tests.sign_in(:'a2');
select public.tdc_record_frame(:'m', :'fr', '{"status": "complete", "winner_side": "away", "result_event": "win", "break_side": "home"}'::jsonb);
select is(tests.dis_open(:'m'), '', 'A2 fills the result nobody had entered: none');
select tests.sign_out();

select tests.sign_in(:'h1');
select public.tdc_record_frame(:'m', :'fr', '{"status": "complete", "winner_side": "home", "result_event": "win", "break_side": "home"}'::jsonb);
select is(tests.dis_open(:'m'), :'fr' || ' result Dis A2 away Dis H1', 'the home captain changes it: A2''s, by H1');
select public.tdc_record_frame(:'m', :'fr', '{"status": "pending", "break_side": "home"}'::jsonb);
select is(tests.dis_open(:'m'), :'fr' || ' result Dis A2 away Dis H1', 'and clears it to Nobody: still A2''s');
select is((select f.winner_side from public.tbl_frames f where f.match_id = :'m' and f.frame_no = :'fr'), null,
	'the frame has no winner now');
select tests.sign_out();

-- ─── Signatures ───

select tests.sign_in(:'h1');
select public.tdc_submit_card(:'m');
select is(tests.dis_open(:'m'), :'fr' || ' result Dis A2 away Dis H1', 'home signs: away''s discrepancy stays');
select tests.sign_out();

select tests.sign_in(:'a1');
select public.tdc_submit_card(:'m');
select is(tests.dis_open(:'m'), '', 'away signs: it is cleared, though nobody accepted it');
select tests.sign_out();

-- A change after both signed overrules both signers, one discrepancy each;
-- the frame was empty when they signed, and a signature counts even then.
select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', :'other', '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb);
select is(tests.dis_open(:'m'),
	:'other' || ' result Dis A1 away Dis LD; ' || :'other' || ' result Dis H1 home Dis LD',
	'the LD changes a frame after both signed: one for each captain');
select tests.sign_out();

select tests.sign_in(:'h2');
select throws_ok(format($$ select public.tdc_accept_frame_change(%L, %s, 'result') $$, :'m', :'other'),
	'P0001', 'Only the player whose entry was changed, their captain or the league director can accept this.',
	'a home player who is not captain cannot accept either');
select tests.sign_out();

select tests.sign_in(:'h1');
select public.tdc_accept_frame_change(:'m', :'other', 'result');
select is(tests.dis_open(:'m'), :'other' || ' result Dis A1 away Dis LD', 'the home captain accepts: only home''s goes');
select tests.sign_out();

select tests.sign_in(:'dee');
select ok(public.tdc_accept_frame_change(:'m', :'other', 'result'), 'the LD can accept anybody''s');
select is(tests.dis_open(:'m'), '', 'and it is gone');
select tests.sign_out();

-- ─── The merge ───

select ok(pg_get_functiondef('private.tdc_merge_players(uuid, uuid, uuid)'::regprocedure)
	like '%update public.tbl_frame_change_accept set accepted_by_player_id = p_keep_id%',
	'the walk-in merge carries the acceptances');

select * from finish();
rollback;
