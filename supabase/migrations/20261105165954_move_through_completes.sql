-- A match scored by moving a player through the draw is complete (UV, 5 Nov:
-- "when we drag and auto-mark a match as complete, we should make sure we
-- update the match status of the auto-set match to complete").
--
-- tdc_move_through (20261105164508) recorded the director's score but left the
-- match In progress, so the draw still showed it as being played. It now ends
-- the match the way approving a result does: status 'complete' (only from
-- scheduled or in progress) and ended_at, if not already set. No card event is
-- written; the card's own state is unchanged.
--
-- Patched from 20261105164508, the only definition: one update added.

create or replace function public.tdc_move_through(
	p_fixture_id      uuid,      -- the slot dropped on
	p_side            text,
	p_from_fixture_id uuid,      -- the match the player was dragged from
	p_from_side       text,
	p_apply           boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f        public.tbl_tournament_fixtures%rowtype;
	v_src      public.tbl_tournament_fixtures%rowtype;
	v_type     text;
	v_ent      uuid;
	v_other    uuid;
	v_rewire   jsonb;
	v_why_not  text;
	v_match    uuid;
	v_rules    jsonb;
	v_target   integer;
	v_win      integer;
	v_scored   jsonb;
	v_resolve  jsonb := jsonb_build_object();
begin
	if p_side not in ('home', 'away') or p_from_side not in ('home', 'away') then
		raise exception 'TDC (Error): a side is home or away.';
	end if;

	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	select * into v_src from public.tbl_tournament_fixtures where id = p_from_fixture_id;
	if v_f.id is null or v_src.id is null then
		raise exception 'TDC (Error): fixture not found.';
	end if;
	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	v_type  := case when v_f.bracket = 'third_place' then 'loser_of' else 'winner_of' end;
	v_ent   := case when p_from_side = 'home' then v_src.home_entrant_id else v_src.away_entrant_id end;
	v_other := case when p_from_side = 'home' then v_src.away_entrant_id else v_src.home_entrant_id end;

	-- Whether the match they came from may be scored to them.
	v_why_not := case
		when v_ent is null then null   -- an empty slot: a plain rewire, nothing to say
		when v_type = 'loser_of' then 'The third-place playoff takes the loser, so dragging there does not say who won.'
		when v_src.advanced_entrant_id is not null then 'That match is already settled.'
		when v_src.match_id is not null and (
			exists (select 1 from public.tbl_frames x where x.match_id = v_src.match_id and x.status = 'complete')
			or exists (select 1 from public.tbl_match_result_override o where o.match_id = v_src.match_id)
		) then 'That match has been played, so its score is set from its card.'
		when v_other is null then 'Their opponent is not known yet, so there is nobody to score against.'
	end;

	begin
		v_rewire := public.tdc_set_fixture_source(p_fixture_id, p_side, v_type, p_from_fixture_id, true);

		if v_ent is not null and v_why_not is null then
			v_match := coalesce(v_src.match_id, public.tdc_create_fixture_match(p_from_fixture_id));

			select m.rules into v_rules from public.tbl_matches m where m.id = v_match;
			v_target := nullif(v_rules->>'win_condition_target', '')::integer;
			v_win := case v_rules->>'win_condition_type'
				when 'race_to' then coalesce(v_target, 1)
				when 'best_of' then coalesce(v_target, 1) / 2 + 1
				else 1
			end;

			-- The match's home is the fixture's home (tdc_create_fixture_match).
			perform public.tdc_set_match_override(v_match,
				case when p_from_side = 'home' then v_win else 0 end,
				case when p_from_side = 'home' then 0 else v_win end,
				'Moved through on the draw');

			-- The match is over, as approving a result ends one (UV, 5 Nov).
			update public.tbl_matches
			set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
				ended_at = coalesce(ended_at, now())
			where id = v_match;

			-- Into the slot now, even where players are moved on by hand.
			update public.tbl_tournament_fixtures
			set home_entrant_id = case when p_side = 'home' then v_ent else home_entrant_id end,
				away_entrant_id = case when p_side = 'away' then v_ent else away_entrant_id end
			where id = p_fixture_id
				and match_id is null
				and (case when p_side = 'home' then home_entrant_id else away_entrant_id end) is null
				and (case when p_side = 'home' then away_entrant_id else home_entrant_id end) is distinct from v_ent;

			v_resolve := public.tdc_resolve_draw(v_f.tournament_id);

			v_scored := jsonb_build_object(
				'winner', (select e.display_name from public.tdc_tournament_entrants(v_f.tournament_id) e where e.entrant_id = v_ent),
				'loser', (select e.display_name from public.tdc_tournament_entrants(v_f.tournament_id) e where e.entrant_id = v_other),
				'score', v_win || '-0',
				'round', v_src.round,
				'position', v_src."position",
				'bracket', v_src.bracket);
		end if;

		if not p_apply then
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	-- Already wired there and nothing to score: said, not confirmed, with why
	-- it was not scored.
	if v_rewire ? 'note' and v_scored is null then
		return jsonb_build_object('applied', false, 'note', v_rewire->>'note', 'not_scored', v_why_not);
	end if;

	return (v_rewire - 'applied' - 'note') || jsonb_build_object(
		'applied', p_apply,
		'rewired', not (v_rewire ? 'note'),
		'scored', v_scored,
		'not_scored', v_why_not,
		'resolve', v_resolve);
end;
$$;

comment on function public.tdc_move_through(uuid, text, uuid, text, boolean) is
	'A player dragged on the draw onto a slot in another round: rewires the slot to that match, scores the match to them at the win condition to 0 (a director''s score, "Moved through on the draw") and puts them in the slot. Rewire only, saying why, where the match is played or settled, the slot is third place, or the opponent is not known. Rehearses by default.';

revoke execute on function public.tdc_move_through(uuid, text, uuid, text, boolean) from public, anon;
grant execute on function public.tdc_move_through(uuid, text, uuid, text, boolean) to authenticated;
