-- A card inside a tournament: publishing, tdc_approve_card, tdc_reject_card,
-- and objecting to a published result.
--
-- approval_mode decides when a result publishes: 'none' and 'dispute_window'
-- on submission, 'coordinator_approval' and 'both' on the TD's approval.
-- Publishing locks the card. A published card reads as settled, never as
-- waiting: there is nothing to agree to, only something to object to while
-- dispute_window_hours runs, and an objection never unlocks it. Only the
-- people running the tournament approve or send back; a send-back really
-- unlocks the card so the players can fix it (UV, 23 Oct).
begin;
\ir _helpers.psql
select plan(43);

select tests.create_user('Approve Alice') as alice \gset
select tests.create_user('Approve Bob') as bob \gset
select tests.create_user('Approve Director') as td \gset
select tests.create_user('Approve Referee') as ref \gset
select tests.player_of(:'alice') as alice_p \gset
select tests.player_of(:'bob') as bob_p \gset

insert into public.tbl_tournaments (name, rules) values ('Approve Open', tests.rules()) returning id as t \gset
insert into public.tbl_competition_roles (tournament_id, player_id, role) values
	(:'t', tests.player_of(:'td'), 'director'),
	(:'t', tests.player_of(:'ref'), 'referee');

select tests.sign_in(:'alice');
select public.tdc_create_match(:'bob_p', tests.rules()) as m_social \gset
select public.tdc_create_match(:'bob_p', tests.rules('{"approval_mode": "coordinator_approval"}')) as m_coord \gset
select public.tdc_create_match(:'bob_p', tests.rules()) as m_dw \gset
select public.tdc_create_match(:'bob_p', tests.rules()) as m_late \gset
select public.tdc_create_match(:'bob_p', tests.rules('{"approval_mode": "none"}')) as m_none \gset
select public.tdc_create_match(:'bob_p', tests.rules('{"approval_mode": "coordinator_approval"}')) as m_empty \gset
select tests.sign_out();
insert into public.tbl_tournament_fixtures (tournament_id, round, position, match_id) values
	(:'t', 1, 1, :'m_coord'), (:'t', 1, 2, :'m_dw'), (:'t', 1, 3, :'m_late'), (:'t', 1, 4, :'m_none'), (:'t', 1, 5, :'m_empty');

select tests.sign_in(:'alice');
select public.tdc_record_frame(x.id, n, '{"winner_side": "home", "result_event": "win"}')
from (values (:'m_social'::uuid), (:'m_coord'::uuid), (:'m_dw'::uuid), (:'m_late'::uuid), (:'m_none'::uuid)) x(id)
	cross join generate_series(1, 2) n;

-- ─── Who may approve ───

select tests.sign_in(:'td');
select throws_ok(format($$ select public.tdc_approve_card(%L) $$, :'m_social'),
	'P0001', 'This match is not part of a competition, so there is nobody to approve it.', 'a social match has nobody to approve it');
select throws_ok(format($$ select public.tdc_approve_card(%L) $$, :'m_empty'),
	'P0001', 'There is no result to publish yet: no frames, and no score set by hand.', 'an empty card cannot be approved');
select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_approve_card(%L) $$, :'m_coord'),
	'P0001', 'Only the people running this competition can publish its results.', 'a player cannot approve');
select tests.sign_in(:'ref');
select throws_ok(format($$ select public.tdc_approve_card(%L) $$, :'m_coord'),
	'P0001', 'Only the people running this competition can publish its results.', 'a referee cannot approve');

-- ─── Coordinator approval: the TD publishes ───

select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m_coord') as st \gset
select is((:'st'::jsonb)->>'state', 'awaiting', 'with coordinator approval, a submission waits');
select is((:'st'::jsonb)->>'published', 'false', 'and is not published');

select tests.sign_in(:'td');
select public.tdc_approve_card(:'m_coord') as st \gset
select is((:'st'::jsonb)->>'state', 'approved', 'the TD approves the card');
select is((:'st'::jsonb)->>'published', 'true', 'approving publishes it');
select throws_ok(format($$ select public.tdc_approve_card(%L) $$, :'m_coord'),
	'P0001', 'This result has already been approved.', 'a card cannot be approved twice');

select tests.sign_out();
select is((select status from public.tbl_matches where id = :'m_coord'), 'complete', 'an approved match is complete');
select is(
	(select array_agg(player_id order by player_id) from public.tbl_notifications where match_id = :'m_coord' and kind = 'result_published'),
	(select array_agg(p order by p) from unnest(array[:'alice_p'::uuid, :'bob_p'::uuid]) p),
	'both players are told the result is published');

select tests.sign_in(:'alice');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'m_coord'),
	'P0001', 'This result has been published. Only the people running the competition can change it now.', 'a published card is locked for the players');
select throws_ok(format($$ select public.tdc_reopen_card(%L) $$, :'m_coord'),
	'P0001', 'This scorecard is not settled, so there is nothing to reopen.', 'a player cannot reopen an approved card');

-- ─── Sending it back ───

select throws_ok(format($$ select public.tdc_reject_card(%L, 'not right') $$, :'m_coord'),
	'P0001', 'Only the people running this competition can send a card back.', 'a player cannot send a card back');
select tests.sign_in(:'td');
select throws_ok(format($$ select public.tdc_reject_card(%L, 'no') $$, :'m_coord'),
	'P0001', 'Please say briefly what is wrong with the scorecard.', 'sending back needs a reason');

select public.tdc_reject_card(:'m_coord', 'Frame 2 was a foul') as st \gset
select is((:'st'::jsonb)->>'state', 'in_progress', 'sending back an approved card puts it back in progress');
select is((:'st'::jsonb)->>'sent_back', 'true', 'the state says it was sent back');
select is((:'st'::jsonb)->>'note', 'Frame 2 was a foul', 'with the TD''s reason');
select is((:'st'::jsonb)->>'published', 'false', 'and it is no longer published');

select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'m_coord'),
	'the players can fix a card that was sent back');
select public.tdc_submit_card(:'m_coord');
select tests.sign_in(:'td');
select is(public.tdc_approve_card(:'m_coord')->>'state', 'approved', 'the fixed card can be approved again');

-- ─── Dispute window: submitting publishes, and the card reads as settled ───

select tests.sign_in(:'alice');
select public.tdc_submit_card(:'m_dw') as st \gset
select is((:'st'::jsonb)->>'published', 'true', 'with a dispute window, submitting publishes');
select is((:'st'::jsonb)->>'state', 'agreed', 'a published card reads as settled, not as waiting');
select is((:'st'::jsonb)->>'can_object', 'true', 'and says a player may still object');
select isnt((:'st'::jsonb)->>'object_until', null, 'and until when');

select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_answer_card(%L, true) $$, :'m_dw'),
	'P0001', 'This result has already been published, so there is nothing left to agree to.', 'there is nothing to agree to on a published card');
select throws_ok(format($$ select public.tdc_answer_card(%L, false) $$, :'m_dw'),
	'P0001', 'Please say briefly what is wrong with the scorecard.', 'an objection needs a reason');

select public.tdc_answer_card(:'m_dw', false, 'Frame 1 was mine') as st \gset
select is((:'st'::jsonb)->>'state', 'agreed', 'an objection does not change the state');
select is((:'st'::jsonb)->>'published', 'true', 'or unpublish the result');
select is((:'st'::jsonb)->'objection'->>'by', :'bob_p'::text, 'it is recorded for the TD, with who raised it');
select is((:'st'::jsonb)->>'can_object', 'false', 'and the same player cannot object twice');
select throws_ok(format($$ select public.tdc_answer_card(%L, false, 'Frame 2 too') $$, :'m_dw'),
	'P0001', 'You have already disputed this result. It is with whoever is running the competition.', 'a second objection is refused');
select throws_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'m_dw'),
	'P0001', 'This result has been published. Only the people running the competition can change it now.', 'an objection does not unlock the card');

-- The TD acts on it by sending it back, which really unlocks it.
select tests.sign_in(:'td');
select public.tdc_reject_card(:'m_dw', 'Bob says frame 1 was his') as st \gset
select is((:'st'::jsonb)->>'published', 'false', 'sending back a card published on submission unpublishes it');
select is((:'st'::jsonb)->>'state', 'in_progress', 'and puts it back in progress');
select tests.sign_in(:'alice');
select lives_ok(format($$ select public.tdc_record_frame(%L, 1, '{"winner_side": "away", "result_event": "win"}') $$, :'m_dw'),
	'the players can fix it');
select is(public.tdc_submit_card(:'m_dw')->>'published', 'true', 'and submitting it again publishes it again');

-- The window closes.
select public.tdc_submit_card(:'m_late');
select tests.sign_out();
update public.tbl_match_events set created_at = now() - interval '49 hours' where match_id = :'m_late';
select is(public.tdc_card_state(:'m_late')->>'can_object', 'false', 'after the window a player can no longer object');
select tests.sign_in(:'bob');
select throws_ok(format($$ select public.tdc_answer_card(%L, false, 'Frame 1 was mine') $$, :'m_late'),
	'P0001', 'The time to dispute this result has passed. Speak to whoever is running it.', 'an objection after the window is refused');

-- ─── No approval: submitting publishes, and the TD can still approve ───

select tests.sign_in(:'alice');
select is(public.tdc_submit_card(:'m_none')->>'published', 'true', 'with no approval, submitting publishes');
select tests.sign_in(:'td');
select is(public.tdc_approve_card(:'m_none')->>'state', 'approved', 'the TD can approve in any mode, which ends it');

-- The TD may correct a locked card. The approval was of the card before the
-- correction, so it is retired by card_version like a submission.
select lives_ok(format($$ select public.tdc_record_frame(%L, 2, '{"winner_side": "away", "result_event": "win"}') $$, :'m_none'),
	'the TD can correct a published, approved card');
select is(public.tdc_card_state(:'m_none')->>'published', 'false', 'the correction retires the approval, so it must be published again');

select tests.sign_out();
select * from finish();
rollback;
