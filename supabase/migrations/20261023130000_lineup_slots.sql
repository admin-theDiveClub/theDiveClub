-- How many frames a team night has.
--
-- UV, 23 Oct, setting up a real league night: "After setting who is here
-- tonight where I marked everyone as yes, I only see Frame 1 for the order."
--
-- private.tdc_lineup_slots read win_condition_target only when the win
-- condition was `fixed_frames`, on the strength of a line in the design
-- saying a team match wants that one. His league is set to race to 13 — so
-- the function found nothing, fell back to the highest slot anybody had
-- used, found none of those either, and returned zero. The card drew a
-- single slot and the order could not be set.
--
-- The design's line was advice about which win condition suits a team night.
-- It was never a claim that the others cannot be counted. UV's correction:
-- "regardless of the format, we should still set our order as a team
-- otherwise you would open the door to duplicate race-to-ones in a team
-- match (we still follow an order regardless of format)". The order is the
-- thing being set; the format only decides how long the night runs. So this
-- function now answers for every format, and never answers zero.
--
--   fixed_frames   N frames are played.                     → N
--   best_of        N is the most that can be played.         → N
--   race_to        first to N, so at most 2N-1 are played.   → 2N-1
--   timed          however many fit in the time.             → squad
--   free_play      no target at all.                         → squad
--
-- race_to counts to the **maximum**, not the target: a team night plays its
-- whole card rather than stopping the moment one side gets there, so race to
-- 13 is a 25-frame card.
--
-- Where no count can be worked out from the rules at all, the night still
-- needs an order, so the fallback is the larger of the two squads: everybody
-- who is here gets a slot. A director who then builds a longer order by hand
-- keeps it — the highest slot already used is still part of the answer, so
-- this function never shrinks a card somebody has already filled in.
create or replace function private.tdc_lineup_slots(p_match_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select greatest(
		-- Never zero. A night with nobody marked present yet still has a
		-- first slot, and the slot guard reads this number to decide what
		-- exists — answering zero there is the same bug in another place.
		1,
		-- What the rules say, when they say anything countable.
		coalesce((
			select case m.rules->>'win_condition_type'
				when 'fixed_frames' then (m.rules->>'win_condition_target')::integer
				when 'best_of'      then (m.rules->>'win_condition_target')::integer
				when 'race_to'      then (m.rules->>'win_condition_target')::integer * 2 - 1
			end
			from public.tbl_matches m where m.id = p_match_id
		), 0),
		-- Whatever order has already been built, so nothing is ever lost.
		coalesce((
			select max(lineup_slot) from public.tbl_league_match_order
			where match_id = p_match_id
		), 0),
		-- A timed or free-play night still has an order: one slot per player
		-- on the fuller side.
		coalesce((
			select max(n) from (
				select count(*) as n from public.tbl_league_match_squad
				where match_id = p_match_id group by side
			) s
		), 0)
	);
$$;

revoke execute on function private.tdc_lineup_slots(uuid) from public, anon;
grant execute on function private.tdc_lineup_slots(uuid) to authenticated;
