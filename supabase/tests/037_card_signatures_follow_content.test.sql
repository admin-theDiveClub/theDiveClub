-- A team card's signatures follow its content (migration 20261029075957,
-- UV 29 Oct).
--
--   both captains sign: agreed, complete, locked
--   the LD edits a frame: neither signature stands, the card is open
--   the LD undoes it: both stand again, agreed, with nobody signing twice
--   a signature given since stands by version; one older stands only if the
--     card is back to what it signed
--   a side whose signature stands again cannot sign twice
--   never across a dispute: undoing back to a disputed card does not agree it
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('Sig LD') as dee \gset
select tests.create_user('Sig H1') as h1 \gset
select tests.create_user('Sig H2') as h2 \gset
select tests.create_user('Sig A1') as a1 \gset
select tests.create_user('Sig A2') as a2 \gset
select tests.player_of(:'h1') as ph1 \gset
select tests.player_of(:'h2') as ph2 \gset
select tests.player_of(:'a1') as pa1 \gset
select tests.player_of(:'a2') as pa2 \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Sig League', tests.rules('{"team_size": 2}')) as league \gset
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

-- Every frame played: home wins 1 and 2, away 3 and 4.
select tests.sign_in(:'h1');
select public.tdc_record_frame(:'m', f.frame_no, jsonb_build_object('status', 'complete',
	'winner_side', case when f.frame_no <= 2 then 'home' else 'away' end, 'result_event', 'win'))
from public.tbl_frames f where f.match_id = :'m';
select public.tdc_submit_card(:'m');
select tests.sign_out();
select tests.sign_in(:'a1');
select public.tdc_submit_card(:'m');
select tests.sign_out();

select is(private.tdc_card_state(:'m')->>'state', 'agreed', 'both captains signed: the card is agreed');
select is((select status from public.tbl_matches where id = :'m'), 'complete', 'and the match is complete');

-- ─── An edit voids both ───

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 1, '{"status": "complete", "winner_side": "away", "result_event": "win"}'::jsonb);
select tests.sign_out();

select is(private.tdc_card_state(:'m')->>'waiting_on', 'both', 'the LD changes frame 1: neither signature stands');
select ok(not private.tdc_card_is_locked(:'m'), 'and the card is open again');

-- ─── Undone: both stand again ───

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 1, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb);
select tests.sign_out();

select is(private.tdc_card_state(:'m')->>'state', 'agreed', 'the LD changes it back: agreed again, nobody signs twice');
select is(private.tdc_card_state(:'m')->'sides'->'home'->>'current', 'true', 'the home signature stands');
select ok(private.tdc_card_is_locked(:'m'), 'and the card is locked again');

-- ─── A new signature by version, an old one by content ───

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 4, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb);
select tests.sign_out();
select tests.sign_in(:'h1');
select public.tdc_submit_card(:'m');
select tests.sign_out();
select is(private.tdc_card_state(:'m')->>'waiting_on', 'away',
	'home signs the changed card: it stands by version, away''s does not');

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 4, '{"status": "complete", "winner_side": "away", "result_event": "win"}'::jsonb);
select tests.sign_out();
select is(private.tdc_card_state(:'m')->>'waiting_on', 'home',
	'changed back: away''s first signature stands again, home''s newer one was for the other card');
select is(private.tdc_card_state(:'m')->'sides'->'home'->>'current', 'false', 'so home''s does not stand');

-- Home's first signature was at this content, but the newer one is the one
-- that counts (the latest per side), so home signs once more and it is agreed.
select tests.sign_in(:'h1');
select lives_ok(format($$ select public.tdc_submit_card(%L) $$, :'m'), 'home signs again');
select tests.sign_out();
select is(private.tdc_card_state(:'m')->>'state', 'agreed', 'and the card is agreed');

-- ─── A side standing again cannot sign twice ───

select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 2, '{"status": "complete", "winner_side": "away", "result_event": "win"}'::jsonb);
select tests.sign_out();
select tests.sign_in(:'a1');
select public.tdc_submit_card(:'m');                 -- away signs the changed card
select tests.sign_out();
select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 2, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb);
select tests.sign_out();
-- Back to the agreed card: both of the earlier signatures... but away's latest
-- is for the changed card, so it waits on away, and home stands by content.
select tests.sign_in(:'h1');
select throws_ok(format($$ select public.tdc_submit_card(%L) $$, :'m'),
	'P0001', 'You have already signed this card as it stands.',
	'home, standing again by content, cannot sign twice');
select tests.sign_out();

-- ─── Never across a dispute ───

select tests.sign_in(:'a1');
select public.tdc_answer_card(:'m', false, 'Frame 2 was ours');
select tests.sign_out();
select tests.sign_in(:'dee');
select public.tdc_record_frame(:'m', 3, '{"status": "complete", "winner_side": "home", "result_event": "win"}'::jsonb);
select public.tdc_record_frame(:'m', 3, '{"status": "complete", "winner_side": "away", "result_event": "win"}'::jsonb);
select tests.sign_out();
select is(private.tdc_card_state(:'m')->'sides'->'home'->>'current', 'false',
	'a signature older than a dispute does not stand again by content');

select * from finish();
rollback;
