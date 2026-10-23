-- Finishing a singles scorecard: tdc_submit_card, tdc_answer_card,
-- tdc_reopen_card, and the lock on an agreed card.
--
-- One player submits and the other answers; signing your own card proves
-- nothing. A dispute needs a reason and reopens the card. Silence past the
-- dispute window counts as agreement. With approval_mode 'none' submitting
-- settles it there and then, and that settlement is recorded rather than
-- re-derived from the rules. An agreed card is locked by a trigger on
-- tbl_frames, so every route in is covered, and either player can reopen it.
--
-- All of this is social play: no tournament or league, so nothing publishes.
begin;
\ir _helpers.psql
select plan(54);

select tests.create_user('Card Alice') as alice \gset
select tests.create_user('Card Bob') as bob \gset
select tests.create_user('Card Carol') as carol \gset
select tests.player_of(:'alice') as alice_p \gset
select tests.player_of(:'bob') as bob_p \gset

-- Six matches between Alice and Bob, each with two frames except the empty one.
select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as m_empty \gset
select public.tdc_create_match(:'bob_p', tests.rules()) as m \gset
select public.tdc_create_match(:'bob_p', tests.rules()) as m_dispute \gset
select public.tdc_create_match(:'bob_p', tests.rules()) as m_silence \gset
select public.tdc_create_match(:'bob_p', tests.rules('{"dispute_window_hours": 0}')) as m_zero \gset
select public.tdc_create_match(:'bob_p', tests.rules('{"approval_mode": "none"}')) as m_none \gset
select public.tdc_record_frame(x.id, n, '{"winner_side": "home", "result_event": "win"}')
from (values (:'m'::uuid), (:'m_dispute'::uuid), (:'m_silence'::uuid), (:'m_zero'::uuid), (:'m_none'::uuid)) x(id)
	cross join generate_series(1, 2) n;

-- ─── Submitting ───

select is(public.tdc_card_state(:'m')->>'state', 'in_progress', 'a card with frames and no events is in progress');

select throws_ok(format($$ select public.tdc_submit_card(%L) $$, :'m_empty'),
	'P0001', 'There is nothing to submit yet — no frames have been played.', 'an empty card cannot be submitted');
select throws_ok(format($$ select public.tdc_submit_card(%L, 'home') $$, :'m'),
	'P0001', 'TDC (Error): only a team match has sides to submit for.', 'a singles card has no sides to submit for');

select tests.sign_in(:'carol');
select throws_ok(format($$ select public.tdc_submit_card(%L) $$, :'m'),
	'P0001', 'Only the players in this match, venue staff, or the people running its competition can submit its scorecard.',
	'someone outside the match cannot submit it');

select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m') as st \gset
select is((:'st'::jsonb)->>'state', 'awaiting', 'submitting a dispute-window card waits for the other player');
select is(((:'st'::jsonb)->>'submitted_by')::uuid, :'alice_p'::uuid, 'the state says who submitted');
select isnt((:'st'::jsonb)->>'deadline', null, 'a dispute window gives the card a deadline');

select tests.sign_out();
select is((select status from public.tbl_matches where id = :'m'), 'complete', 'submitting marks the match complete');
select isnt((select ended_at from public.tbl_matches where id = :'m'), null, 'submitting stops the match clock');
select is(
	(select array_agg(kind) from public.tbl_match_events where match_id = :'m'),
	array['submitted'],
	'a dispute-window submission writes one event and no agreement');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_submit_card(%L) $$, :'m'),
	'P0001', 'This scorecard has already been submitted and is waiting on the other player.', 'a card cannot be submitted twice');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'m'),
	'P0001', 'You submitted this scorecard. The other player answers it.', 'the submitter cannot agree to their own card');

select tests.sign_in(:'carol');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'m'),
	'P0001', 'Only the players in this match can answer its scorecard.', 'someone outside the match cannot answer it');

-- A card that is only submitted is not locked: a fix is still possible.
select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'m'),
	'a submitted card that nobody has answered can still be changed');

-- ─── An agreement cannot survive a changed card ───

select is(public.tdc_card_state(:'m')->>'state', 'in_progress', 'changing a frame retires the submission');
select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'m'),
	'P0001', 'There is nothing waiting to be answered on this scorecard.', 'a retired submission cannot be agreed to');

-- ─── Agreeing, and the lock ───

select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m');
select tests.sign_in(:'bob');
select is(public.tdc_answer_card(:'m', true)->>'state', 'agreed', 'the other player agrees and the card is agreed');
select is((public.tdc_card_state(:'m')->>'by')::uuid, :'bob_p'::uuid, 'the agreed state says who agreed');

select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "away", "result_event": "win"}') $$, :'m'),
	'P0001', 'Both players have agreed this scorecard. Reopen it before changing anything.', 'an agreed card takes no new frame');
select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'m'),
	'P0001', 'Both players have agreed this scorecard. Reopen it before changing anything.', 'an agreed card cannot have a frame corrected');
select throws_ok(format($$ select public.tdc_remove_frame(%L, 2) $$, :'m'),
	'P0001', 'Both players have agreed this scorecard. Reopen it before changing anything.', 'an agreed card cannot lose a frame');

-- The lock is a trigger on the table, so it holds even for a write that
-- does not come through the functions.
select tests.sign_out();
select throws_ok(format($$ update public.tbl_frames set winner_side = 'away' where match_id = %L $$, :'m'),
	'P0001', 'Both players have agreed this scorecard. Reopen it before changing anything.', 'the lock holds against a direct write to the table');
select is((select count(*)::integer from public.tbl_frames where match_id = :'m' and winner_side = 'home'), 1, 'the agreed frames are unchanged');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_submit_card(%L) $$, :'m'),
	'P0001', 'This scorecard has already been agreed.', 'an agreed card cannot be submitted again');
select throws_ok(format($$ select public.tdc_answer_card(%L, false, 'not right') $$, :'m'),
	'P0001', 'There is nothing waiting to be answered on this scorecard.', 'an agreed social card cannot be disputed; it is reopened instead');

-- ─── Reopening ───

select tests.sign_in(:'carol');
select throws_ok(format($$ select public.tdc_reopen_card(%L) $$, :'m'),
	'P0001', 'Only the players in this match can reopen its scorecard.', 'someone outside the match cannot reopen it');

-- Either player may reopen an agreed card, not only the one who submitted.
select tests.sign_in(:'bob');
select is(public.tdc_reopen_card(:'m')->>'state', 'in_progress', 'either player can reopen an agreed card');
select tests.sign_out();
select is((select status || '/' || coalesce(ended_at::text, 'open') from public.tbl_matches where id = :'m'), 'in_progress/open', 'reopening puts the match back in play');

select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "home", "result_event": "win"}') $$, :'m'),
	'a reopened card can be changed again');
select throws_ok(format($$ select public.tdc_reopen_card(%L) $$, :'m'),
	'P0001', 'This scorecard is not settled, so there is nothing to reopen.', 'a card in progress has nothing to reopen');

-- Withdrawing: the submitter may take back an unanswered card, the other
-- player may not (they dispute instead).
select public.tdc_submit_card(:'m');
select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_reopen_card(%L) $$, :'m'),
	'P0001', 'You did not submit this scorecard. Say what is wrong with it instead.', 'the other player cannot withdraw a submission');
select tests.sign_in(:'alice');
select is(public.tdc_reopen_card(:'m')->>'state', 'in_progress', 'the submitter can withdraw an unanswered card');

-- A sanctioned match is not the players' to reopen.
select tests.sign_out();
update public.tbl_matches set sanctioned = true, sanctioned_by = :'alice', sanctioned_at = now() where id = :'m';
select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m');
select throws_ok(format($$ select public.tdc_reopen_card(%L) $$, :'m'),
	'P0001', 'This match counts towards rankings. Ask the organiser to reopen it.', 'a sanctioned card cannot be reopened by a player');

-- ─── Disputing ───

select public.tdc_submit_card(:'m_dispute');
select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_answer_card(%L, false) $$, :'m_dispute'),
	'P0001', 'Please say briefly what is wrong with the scorecard.', 'a dispute needs a reason');
select throws_ok(format($$ select public.tdc_answer_card(%L, false, '  no ') $$, :'m_dispute'),
	'P0001', 'Please say briefly what is wrong with the scorecard.', 'a reason of fewer than three characters is not a reason');

select public.tdc_answer_card(:'m_dispute', false, '  Frame 2 was mine  ') as st \gset
select is((:'st'::jsonb)->>'state', 'disputed', 'a dispute with a reason disputes the card');
select is((:'st'::jsonb)->>'note', 'Frame 2 was mine', 'the reason is kept, trimmed');
select tests.sign_out();
select is((select status || '/' || coalesce(ended_at::text, 'open') from public.tbl_matches where id = :'m_dispute'), 'in_progress/open', 'a dispute reopens the match');

select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'m_dispute'),
	'a disputed card can be fixed');
select is(public.tdc_card_state(:'m_dispute')->>'state', 'in_progress', 'fixing a frame moves a disputed card back to in progress');
select is(public.tdc_submit_card(:'m_dispute')->>'state', 'awaiting', 'the fixed card can be submitted again');
select tests.sign_in(:'bob');
select is(public.tdc_answer_card(:'m_dispute', true)->>'state', 'agreed', 'and agreed this time');

-- ─── Silence ───

select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m_silence');
select public.tdc_submit_card(:'m_zero');
select tests.sign_out();
update public.tbl_match_events set created_at = now() - interval '47 hours' where match_id = :'m_silence';
select is(public.tdc_card_state(:'m_silence')->>'state', 'awaiting', 'inside the dispute window the card is still waiting');

update public.tbl_match_events set created_at = now() - interval '49 hours' where match_id = :'m_silence';
select is(public.tdc_card_state(:'m_silence')->>'state', 'agreed', 'silence past the dispute window counts as agreement');
select is((public.tdc_card_state(:'m_silence')->>'by_silence')::boolean, true, 'the state says it was agreed by silence');

select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "away", "result_event": "win"}') $$, :'m_silence'),
	'P0001', 'Both players have agreed this scorecard. Reopen it before changing anything.', 'a card settled by silence is locked with no job having run');

select tests.sign_out();
update public.tbl_match_events set created_at = now() - interval '1000 hours' where match_id = :'m_zero';
select is(public.tdc_card_state(:'m_zero')->>'state', 'awaiting', 'a window of 0 hours never settles by silence');
select is(public.tdc_card_state(:'m_zero')->>'deadline', null, 'and has no deadline');

-- ─── Approval not needed: submitting settles it ───

select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m_none') as st \gset
select is((:'st'::jsonb)->>'state', 'agreed', 'with approval not needed, submitting settles the card');
select is((:'st'::jsonb)->>'no_approval', 'true', 'the state says no approval was needed');

select tests.sign_out();
select is(
	(select array_agg(kind order by created_at) from public.tbl_match_events where match_id = :'m_none'),
	array['submitted', 'agreed'],
	'the settlement is recorded as its own event, after the submission');
select is(
	(select note from public.tbl_match_events where match_id = :'m_none' and kind = 'agreed'),
	'Settled on submission: this match was set to need no approval.',
	'the agreement says why it was written');

select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_record_frame(%L, 3, '{"winner_side": "away", "result_event": "win"}') $$, :'m_none'),
	'P0001', 'Both players have agreed this scorecard. Reopen it before changing anything.', 'a card settled on submission is locked');

-- Turning approval on afterwards must not unsettle a card that settled
-- without it: the settlement was recorded, not worked out from the rules.
select tests.sign_out();
update public.tbl_matches set rules = rules || '{"approval_mode": "dispute_window"}' where id = :'m_none';
select is(public.tdc_card_state(:'m_none')->>'state', 'agreed', 'a later change to the approval mode does not unsettle the card');

select * from finish();
rollback;
