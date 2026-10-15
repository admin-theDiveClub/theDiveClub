-- Card events are ordered by real time, not transaction time.
--
-- tbl_match_events.created_at defaulted to now(), which in Postgres is the time
-- the *transaction* began, not the moment of the insert. Two events written in
-- one transaction therefore share a timestamp to the microsecond, and
-- tdc_card_state, which looks for an answer recorded *after* a submission,
-- could not see one.
--
-- Through the app each of these is its own request, so it would have behaved —
-- until the day something did two steps at once, and then a scorecard would
-- have sat waiting for an agreement that was already there.
--
-- clock_timestamp() reads the clock at the moment of the insert, so events
-- ordered by it are in the order they actually happened.

alter table public.tbl_match_events
	alter column created_at set default clock_timestamp();
