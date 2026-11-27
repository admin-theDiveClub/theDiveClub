-- ───────────────────────────────────────────────────────────
-- A draft score re-opens its match
--
-- UV, 27 Nov, during Basil's Friday Super Comp: "I can't click to set lags
-- now", then "none of the matches are settled. Undo the first match. Current
-- score is correct."
--
-- Its first match had been locked (Lock it: approved, ended), then its score
-- changed in Rounds, which saves a draft (20261127154848): the score stopped
-- counting, but the approval still stood at the card's version, so the card
-- stayed locked. The lag was refused ("This result is settled"), and the
-- page offered no Publish or Send back for an approved card.
--
--   tdc_set_match_override  a draft now moves the match's card_version on (an
--                           approval or submission of the old version no
--                           longer stands) and re-opens a match that had
--                           ended. Publish / Lock it then settles it again.
--   every match left with a draft score is re-opened the same way, its score
--                           kept: Basil's first match on push.
--
-- Patched from the text of a freshly reset database; nothing else changed.
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tdc_set_match_override(p_match_id uuid, p_home_score integer, p_away_score integer, p_reason text, p_mode text DEFAULT 'publish'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_m    public.tbl_matches%rowtype;
	v_me   uuid;
	v_home integer;
	v_away integer;
begin
	select * into v_m from public.tbl_matches where id = p_match_id;
	if v_m.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_override_match(p_match_id) then
		raise exception 'Only the people running the competition this match belongs to can set its score.';
	end if;

	if nullif(trim(coalesce(p_reason, '')), '') is null or char_length(trim(p_reason)) < 3 then
		raise exception 'Setting a score by hand needs a reason.';
	end if;

	if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0 then
		raise exception 'TDC (Error): a score needs two numbers, neither of them negative.';
	end if;

	if p_mode is null or p_mode not in ('publish', 'draft', 'final') then
		raise exception 'TDC (Error): a score is saved to publish, as a draft or as final, not "%".', p_mode;
	end if;

	-- A draft re-opens the match (20261127195047, UV: "none of the matches
	-- are settled"): the card moves on a version, so an approval or a
	-- submission of the old one no longer stands and the card is not locked,
	-- and a match that had ended is open again (in progress if it has frames,
	-- else scheduled). Until then a score changed after Lock it left the card
	-- approved but the score unpublished: locked, its lag refused, and no
	-- Publish or Send back on the page.
	if p_mode = 'draft' then
		update public.tbl_matches
		set card_version = card_version + 1,
			status = case when status = 'complete' then
					case when exists (select 1 from public.tbl_frames fr where fr.match_id = p_match_id)
						then 'in_progress' else 'scheduled' end
				else status end,
			ended_at = case when status = 'complete' then null else ended_at end
		where id = p_match_id
		returning * into v_m;
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());

	select
		count(*) filter (where f.winner_side = 'home'),
		count(*) filter (where f.winner_side = 'away')
	into v_home, v_away
	from public.tbl_frames f
	where f.match_id = p_match_id and f.status = 'complete';

	insert into public.tbl_match_result_override
		(match_id, home_score, away_score, reason, set_by, counted_home, counted_away, card_version, published_at)
	values
		(p_match_id, p_home_score, p_away_score, trim(p_reason), v_me, v_home, v_away, v_m.card_version,
			case when p_mode = 'draft' then null else now() end)
	on conflict (match_id) do update set
		home_score   = excluded.home_score,
		away_score   = excluded.away_score,
		reason       = excluded.reason,
		set_by       = excluded.set_by,
		set_at       = now(),
		counted_home = excluded.counted_home,
		counted_away = excluded.counted_away,
		card_version = excluded.card_version,
		published_at = excluded.published_at;

	-- Final: the director's whole result, so the match ends as approving it
	-- (tdc_approve_card) and moving a player through (tdc_move_through) end it.
	if p_mode = 'final' then
		update public.tbl_matches
		set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
			ended_at = coalesce(ended_at, now())
		where id = p_match_id;
	end if;
end;
$function$;

-- Basil's Friday Super Comp, every match open again (UV, 27 Nov: "no matches
-- are complete. Open all again"): a score set by hand becomes a draft, the
-- numbers kept; the re-opening below then lifts every lock and ending.
update public.tbl_match_result_override o
set published_at = null
from public.tbl_tournament_fixtures f
where f.match_id = o.match_id and f.tournament_id = '4d0b23de-2304-4d7a-8715-b6f456d159a5';

-- Its matches with no score set by hand: any approval or submission retired
-- and any ending undone, as a draft does.
update public.tbl_matches m
set card_version = m.card_version + 1,
	status = case when m.status = 'complete' then
			case when exists (select 1 from public.tbl_frames fr where fr.match_id = m.id)
				then 'in_progress' else 'scheduled' end
		else m.status end,
	ended_at = case when m.status = 'complete' then null else m.ended_at end
from public.tbl_tournament_fixtures f
where f.match_id = m.id and f.tournament_id = '4d0b23de-2304-4d7a-8715-b6f456d159a5'
	and not exists (select 1 from public.tbl_match_result_override o where o.match_id = m.id);

-- Matches left with a draft score (Basil's, and any other): re-opened, the
-- score kept and not marked stale (its version moves with the match's).
with reopened as (
	update public.tbl_matches m
	set card_version = m.card_version + 1,
		status = case when m.status = 'complete' then
				case when exists (select 1 from public.tbl_frames fr where fr.match_id = m.id)
					then 'in_progress' else 'scheduled' end
			else m.status end,
		ended_at = case when m.status = 'complete' then null else m.ended_at end
	from public.tbl_match_result_override o
	where o.match_id = m.id and o.published_at is null
	returning m.id, m.card_version
)
update public.tbl_match_result_override o
set card_version = r.card_version
from reopened r
where o.match_id = r.id;

-- Basil's draw brought into line: anybody moved on by a result that no longer
-- counts comes back out (tdc_cascade_draw), as the director's own Refresh
-- would. Run as the database following the tournament (the marker the one
-- place deciding who runs it accepts, 20261127175438), nobody being signed in
-- here. Does nothing where the tournament is not on this database.
do $$
begin
	if exists (select 1 from public.tbl_tournaments where id = '4d0b23de-2304-4d7a-8715-b6f456d159a5') then
		perform set_config('tdc.draw_follow', '4d0b23de-2304-4d7a-8715-b6f456d159a5', true);
		perform public.tdc_cascade_draw('4d0b23de-2304-4d7a-8715-b6f456d159a5', true);
		perform set_config('tdc.draw_follow', '', true);
		-- tdc_cascade_draw leaves an away place filled when it should be
		-- empty and the home place is empty too (its update compares a null
		-- with a null), found rehearsing this: such places, on fixtures with
		-- no match yet, are set to what their feeder now says.
		update public.tbl_tournament_fixtures f
		set home_entrant_id = case when f.home_source_type = 'winner_of' then o.winner_entrant_id else o.loser_entrant_id end
		from public.tbl_tournament_fixtures g
		cross join lateral private.tdc_fixture_outcome(g.home_source_ref) o
		where g.id = f.id and f.tournament_id = '4d0b23de-2304-4d7a-8715-b6f456d159a5'
			and f.match_id is null and f.home_source_type in ('winner_of', 'loser_of')
			and f.home_entrant_id is distinct from (case when f.home_source_type = 'winner_of' then o.winner_entrant_id else o.loser_entrant_id end);
		update public.tbl_tournament_fixtures f
		set away_entrant_id = case when f.away_source_type = 'winner_of' then o.winner_entrant_id else o.loser_entrant_id end
		from public.tbl_tournament_fixtures g
		cross join lateral private.tdc_fixture_outcome(g.away_source_ref) o
		where g.id = f.id and f.tournament_id = '4d0b23de-2304-4d7a-8715-b6f456d159a5'
			and f.match_id is null and f.away_source_type in ('winner_of', 'loser_of')
			and f.away_entrant_id is distinct from (case when f.away_source_type = 'winner_of' then o.winner_entrant_id else o.loser_entrant_id end);
	end if;
end;
$$;
