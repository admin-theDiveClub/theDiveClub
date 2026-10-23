-- Removing a frame from the middle of a match could fail.
--
-- Found 23 Oct by the first pgTAP suite for matches (011_match_frames).
--
-- tdc_remove_frame deletes the frame and closes the numbering up with one
-- statement: "every frame after it, take one off your number". The rule that
-- a match has one frame per number (tbl_frames_one_number_per_match) is not
-- deferrable, so Postgres checks it row by row *as the statement runs*, in
-- whatever order it happens to visit the rows. If it visits frame 3 before
-- frame 2, frame 3 becomes 2 while the old frame 2 is still there, and the
-- whole removal fails with a raw duplicate-key error.
--
-- Which order it visits is down to where the rows sit on disk, and correcting
-- a frame moves that row to the end. So the recipe was ordinary: three
-- frames, correct frame 2, remove frame 1. It failed every time.
--
-- Not reachable from the site today: the only remove on the match page is
-- Undo, which takes the last frame, and nothing comes after the last frame.
-- It would have been the first page to remove a frame from the middle.
--
-- ─── The fix ───
--
-- Move the frames down one at a time, lowest first. Each one drops into the
-- gap the one before it left, so the numbers never collide.
--
-- Rejected: two passes (lift every number out of the way, then bring them
-- down), because the frame edit log records every write and would show a
-- made-up frame number for each moved frame. Rejected: making the rule
-- deferrable, which changes the table for every writer to fix one function.
--
-- The rest of the function is the 20261017120000 text unchanged. Same
-- signature, so create or replace keeps its grants.

create or replace function public.tdc_remove_frame(p_match_id uuid, p_frame_no integer,
	p_card_version integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_status text;
	v_frame  uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	-- Refuse a write aimed at a card that has moved on. Checked here, not in
	-- the browser, because the browser is the thing that is out of date.
	if p_card_version is not null then
		perform private.tdc_check_card_version(p_match_id, p_card_version);
	end if;

	select status into v_status from public.tbl_matches where id = p_match_id;
	if v_status is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its score.';
	end if;

	if v_status = 'abandoned' then
		raise exception 'This match was abandoned. Frames can no longer be changed.';
	end if;

	delete from public.tbl_frames
	where match_id = p_match_id and frame_no = p_frame_no;

	if not found then
		raise exception 'TDC (Error): frame % is not on this match.', p_frame_no;
	end if;

	-- One at a time, lowest first, so each frame drops into the gap the one
	-- before it left. A single update is checked row by row in no particular
	-- order and can collide (see the header).
	for v_frame in
		select id from public.tbl_frames
		where match_id = p_match_id and frame_no > p_frame_no
		order by frame_no
	loop
		update public.tbl_frames
		set frame_no = frame_no - 1
		where id = v_frame;
	end loop;

	perform public.tdc_rederive_break_sides(p_match_id);

	update public.tbl_matches
	set card_version = card_version + 1
	where id = p_match_id;
end;
$$;
