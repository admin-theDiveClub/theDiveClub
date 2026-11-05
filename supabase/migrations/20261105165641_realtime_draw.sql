-- Live updates for the draw itself (UV, 5 Nov: "the draw page is not receiving
-- live updates for players that I move between rounds").
--
-- The draw page watched only tbl_matches and tbl_match_events for the matches
-- already on it (20261017130000). A change to the draw is neither: rewiring,
-- placing or moving a player, adding or removing a match all write
-- tbl_tournament_fixtures, and a score set by the director (moving a player
-- through, Change score) writes tbl_match_result_override. So a second screen
-- never heard about them.
--
-- Both are published. The page re-reads on any change, as it already does for
-- a match, so no row payload is used.
--
-- Access is the existing RLS, as before: Realtime checks the subscriber can
-- select the row before sending it, and both tables are readable by any
-- signed-in user already, so publishing grants nothing new.

alter publication supabase_realtime add table public.tbl_tournament_fixtures;
alter publication supabase_realtime add table public.tbl_match_result_override;
