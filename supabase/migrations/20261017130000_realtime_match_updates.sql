-- Live updates for a match in progress.
--
-- A match is watched as well as scored. Players follow the score from the next
-- table, and the second scorer needs to see a correction land. Until now every
-- page read once and then went stale until somebody thought to reload.
--
-- Two tables are published, and tbl_frames is deliberately not one of them:
--
--   tbl_matches       — every frame change bumps card_version, so this single
--                       row already carries an insert, a correction and a
--                       removal alike, as well as settings and status. One
--                       subscription instead of three, and no row payloads to
--                       merge: the page re-reads, which is the same rule the
--                       rest of the match page follows after every write.
--
--   tbl_match_events  — agreeing a card writes only an event and touches
--                       nothing on the match, so it would otherwise be the one
--                       thing a second screen never heard about.
--
-- Both are watched for INSERT and UPDATE only, never DELETE. Postgres sends
-- only a deleted row's key unless the table keeps a full replica identity, so a
-- filter on match_id could not match a delete — and turning full replica
-- identity on would put every deleted frame's contents onto a channel whose
-- name is a match id. Routing deletions through card_version avoids both.
--
-- Access is the existing RLS: Realtime checks the subscriber can select the row
-- before sending it, so publishing these tables grants nothing new.

alter publication supabase_realtime add table public.tbl_matches;
alter publication supabase_realtime add table public.tbl_match_events;
