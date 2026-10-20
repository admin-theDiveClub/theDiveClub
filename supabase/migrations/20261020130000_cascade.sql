-- Cascading a change back through the draw.
--
-- UV, 20 Oct: "If the tournament is set as auto-progression then we should
-- cascade the changes (this is the point of auto-progression) with warnings.
-- In almost every other case, the TD will be able to make changes upstream and
-- then go and delete matches or change scores and players in each match."
--
-- tdc_resolve_draw cannot do this. It only ever fills an empty slot, which is
-- what makes it safe to call on every page load — it can add somebody to the
-- draw but never take them out. Undoing is a different act with different
-- consequences, so it is a different function, and one that can be looked at
-- before it is run.
--
-- ─── What "drift" means ───
--
-- A slot fed by winner_of or loser_of should hold whoever that fixture's
-- outcome names. When it does not, the draw disagrees with itself: the TD
-- corrected a score, un-published a result, or awarded a walkover somewhere
-- upstream. That disagreement is drift, and cascading is resolving it.
--
-- A slot the TD filled by hand has source_type 'entrant' and is never drift.
-- That is the same rule that makes tdc_set_fixture stick, and it is why a
-- manually run tournament is simply one where every slot is 'entrant'.
--
-- ─── What happens to a match between the wrong people ───
--
-- It is detached, not deleted. Those frames were really played by those two
-- players and deleting them would be destroying a record to tidy a bracket.
-- The match survives on its own; the fixture goes back to needing one.
-- Deleting is tdc_delete_match, asked for deliberately.

-- ─────────────────────────────────────────────────────────────────
-- Where does the draw disagree with itself?
--
-- One layer only: what is wrong right now, given what is published now.
-- Fixing a round changes what the round above should hold, which is why the
-- cascade below loops rather than calling this once.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_draw_drift(p_tournament_id uuid)
returns table (
	fixture_id   uuid,
	bracket      text,
	round        integer,
	"position"   integer,
	side         text,
	now_entrant  uuid,
	should_be    uuid
)
language sql
stable
security definer
set search_path = ''
as $$
	with sides as (
		select f.id, f.bracket, f.round, f.position, 'home' as side,
			f.home_entrant_id as held, f.home_source_type as src, f.home_source_ref as ref
		from public.tbl_tournament_fixtures f
		where f.tournament_id = p_tournament_id
		union all
		select f.id, f.bracket, f.round, f.position, 'away',
			f.away_entrant_id, f.away_source_type, f.away_source_ref
		from public.tbl_tournament_fixtures f
		where f.tournament_id = p_tournament_id
	),
	expected as (
		select s.*,
			case when s.src = 'winner_of' then o.winner_entrant_id
				when s.src = 'loser_of'  then o.loser_entrant_id end as want
		from sides s
		left join lateral private.tdc_fixture_outcome(s.ref) o on true
		where s.src in ('winner_of', 'loser_of') and s.ref is not null
	)
	select id, bracket, round, position, side, held, want
	from expected
	where held is distinct from want
	order by round, position, side;
$$;

revoke execute on function private.tdc_draw_drift(uuid) from public, anon;
grant execute on function private.tdc_draw_drift(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Cascading
--
-- p_apply false is a real rehearsal, not an estimate: the work is done inside
-- a block with an exception handler, which gives it a subtransaction, and then
-- deliberately aborted. Every database change is rolled back; the report is a
-- plpgsql variable, which is not transactional, so it survives and is returned.
-- That means the warning the TD reads is exactly what will happen, including
-- the knock-on effects three rounds up, rather than a guess at the first layer.
--
-- The loop is bounded. A bracket is finite and each pass settles at least one
-- round, so ten passes is far more than any real draw needs; the bound exists
-- so that a wiring mistake cannot spin forever.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_cascade_draw(
	p_tournament_id uuid,
	p_apply         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t        public.tbl_tournaments%rowtype;
	v_report   jsonb := jsonb_build_array();
	v_detached jsonb := jsonb_build_array();
	v_cleared  jsonb := jsonb_build_array();
	v_d        record;
	v_f        public.tbl_tournament_fixtures%rowtype;
	v_pass     integer := 0;
	v_changed  integer;
	v_name     text;
	v_was      text;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	-- Manual progression means the TD moves people themselves. Cascading would
	-- be the system overruling them, which is the opposite of what the setting
	-- is for.
	if v_t.progression <> 'automatic' then
		return jsonb_build_object(
			'applied', false,
			'note', 'This tournament is set to move people by hand, so nothing is cascaded.',
			'changes', jsonb_build_array());
	end if;

	begin
		loop
			v_pass := v_pass + 1;
			v_changed := 0;

			for v_d in
				select * from private.tdc_draw_drift(p_tournament_id)
			loop
				select * into v_f from public.tbl_tournament_fixtures where id = v_d.fixture_id;

				select p.display_name into v_was
				from public.tbl_tournament_entrants e
				join public.tbl_players p on p.id = e.player_id
				where e.id = v_d.now_entrant;

				select p.display_name into v_name
				from public.tbl_tournament_entrants e
				join public.tbl_players p on p.id = e.player_id
				where e.id = v_d.should_be;

				v_report := v_report || jsonb_build_object(
					'bracket', v_d.bracket, 'round', v_d.round, 'position', v_d."position",
					'side', v_d.side,
					'was', coalesce(v_was, 'nobody'),
					'now', coalesce(v_name, 'nobody'));

				-- The match in this fixture was between two particular people.
				-- If either of them is changing, it is no longer this fixture's
				-- match. It keeps its frames and stops belonging to the draw.
				if v_f.match_id is not null then
					v_detached := v_detached || jsonb_build_object(
						'round', v_d.round, 'position', v_d."position",
						'match_id', v_f.match_id,
						'frames', (select count(*) from public.tbl_frames x where x.match_id = v_f.match_id),
						'published', private.tdc_is_published(v_f.match_id));
					update public.tbl_tournament_fixtures set match_id = null where id = v_f.id;
				end if;

				-- A walkover awarded to somebody who is no longer in this
				-- fixture is not a result any more.
				if v_f.advanced_entrant_id is not null
					and v_f.advanced_entrant_id is distinct from v_d.should_be
					and v_f.advanced_entrant_id = v_d.now_entrant then
					v_cleared := v_cleared || jsonb_build_object(
						'round', v_d.round, 'position', v_d."position",
						'reason', v_f.advance_reason);
					update public.tbl_tournament_fixtures
					set advanced_entrant_id = null, advance_reason = null
					where id = v_f.id;
				end if;

				if v_d.side = 'home' then
					update public.tbl_tournament_fixtures
					set home_entrant_id = v_d.should_be where id = v_f.id;
				else
					-- Guards the sides-differ constraint: the same entrant
					-- arriving in both slots means the bracket is wired wrong,
					-- and leaving the slot empty is better than failing the
					-- whole cascade.
					update public.tbl_tournament_fixtures
					set away_entrant_id = v_d.should_be
					where id = v_f.id and home_entrant_id is distinct from v_d.should_be;
				end if;

				v_changed := v_changed + 1;
			end loop;

			exit when v_changed = 0 or v_pass >= 10;
		end loop;

		-- Fill anything that is now fillable and start what is ready, so the
		-- draw comes back consistent rather than half-moved.
		perform public.tdc_resolve_draw(p_tournament_id);

		if not p_apply then
			-- Abort the subtransaction. Everything above is undone; v_report,
			-- v_detached and v_cleared are plpgsql variables and survive.
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		'changes', v_report,
		'detached', v_detached,
		'awards_cleared', v_cleared,
		'passes', v_pass);
end;
$$;

revoke execute on function public.tdc_cascade_draw(uuid, boolean) from public, anon;
grant execute on function public.tdc_cascade_draw(uuid, boolean) to authenticated;
