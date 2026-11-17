-- An acceptance reaches every open card live (UV, 17 Nov: "the page is
-- supposed to be live"; DECISIONS 29 Oct, "The card follows its match live").
--
-- 20261117054351 stored acceptances in tbl_frame_change_accept, which nothing
-- sends live: the card listens to tbl_matches (a frame write moves its
-- card_version) and tbl_match_events (a signature), and an acceptance touches
-- neither, on purpose, so that accepting never knocks out a signature. So the
-- other phones kept the blue tick and the glow until their next read.
--
-- The table joins the realtime publication, as tbl_match_events did in
-- 20261017130000, and the card listens for its inserts (league-card.js).
-- Realtime only delivers a row to somebody allowed to select it, so signed-in
-- users may now read it, as they may read tbl_frame_edit and tbl_match_events:
-- which change was accepted, by whom, and for which side. Writing stays with
-- tdc_accept_frame_change alone.

create policy "Signed-in users can see which changes were accepted"
	on public.tbl_frame_change_accept for select to authenticated using (true);

grant select on public.tbl_frame_change_accept to authenticated;

alter publication supabase_realtime add table public.tbl_frame_change_accept;
