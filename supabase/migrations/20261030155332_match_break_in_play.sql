-- The break event of the frame in play, saved on the match as it is tapped.
--
-- Decided by UV, 30 Oct (docs/DECISIONS.md, "The break event in play is
-- saved on the match"), replacing the same day's "nothing stored": a break
-- event tapped on one phone was sent live to the phones already open (a
-- Realtime broadcast) and kept nowhere else, so a phone that opened the
-- match afterwards, or the same phone reloaded, showed none until the frame
-- was saved. Saved here, every phone that opens the match shows it.
--
-- It is not a second record of the frame: tbl_frames stays the only record
-- of a played frame, and this is never counted. It says only "frame n's
-- break event, tapped while the card stood at version v". Every write that
-- changes the frames (tdc_record_frame, tdc_remove_frame,
-- tdc_update_match_settings, checked on a fresh reset 30 Oct) moves
-- card_version on, so once a frame is saved, removed or corrected the stored
-- event no longer matches the card and the page ignores it. Nothing here
-- needs clearing, and tdc_record_frame is left as it is.
--
-- Saving it does not move card_version: a break tap is not a change to the
-- card and must not retire a submission.
--
--   1. tbl_matches.break_in_play, break_in_play_frame_no,
--      break_in_play_card_version (all three or none)
--   2. public.tdc_set_break_in_play                new
--
-- tbl_matches is already readable by signed-in users (table-level select)
-- and in the realtime publication, so the other phones hear the change with
-- no new grant. No player is referenced, so tdc_merge_players is untouched.

-- ─── 1. The columns ───

alter table public.tbl_matches
	add column break_in_play text check (break_in_play in ('dry', 'in', 'scratch', 'foul')),
	add column break_in_play_frame_no integer check (break_in_play_frame_no >= 1),
	add column break_in_play_card_version integer,
	add constraint tbl_matches_break_in_play_whole check (
		(break_in_play is null) = (break_in_play_frame_no is null)
		and (break_in_play is null) = (break_in_play_card_version is null));

comment on column public.tbl_matches.break_in_play is
	'The break event tapped for the frame in play, before the frame is saved (20261030155332). Shown only while break_in_play_card_version is the card''s; never counted.';

-- ─── 2. Setting it ───

create or replace function public.tdc_set_break_in_play(p_match_id uuid, p_frame_no integer, p_break_outcome text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
	v_match public.tbl_matches%rowtype;
	v_next integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	-- Whoever may score the match: the same rule as recording a frame
	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'Only the people scoring this match can enter its break event.';
	end if;

	if private.tdc_card_is_locked(p_match_id) then
		raise exception 'This scorecard is settled, so no frame is in play.';
	end if;

	if p_break_outcome is null or p_break_outcome not in ('dry', 'in', 'scratch', 'foul') then
		raise exception 'TDC (Error): % is not a break event.', coalesce(p_break_outcome, 'nothing');
	end if;

	-- Only the frame in play: one numbered after the last saved. A phone
	-- that has not seen a frame someone else saved is told so.
	select coalesce(max(frame_no), 0) + 1 into v_next from public.tbl_frames where match_id = p_match_id;
	if p_frame_no is distinct from v_next then
		raise exception 'Someone else has scored this match: frame % is the one in play.', v_next
			using errcode = 'TDC01';
	end if;

	update public.tbl_matches
	set break_in_play = p_break_outcome,
		break_in_play_frame_no = p_frame_no,
		break_in_play_card_version = v_match.card_version
	where id = p_match_id;
end;
$function$;

revoke execute on function public.tdc_set_break_in_play(uuid, integer, text) from public, anon;
grant  execute on function public.tdc_set_break_in_play(uuid, integer, text) to authenticated;
