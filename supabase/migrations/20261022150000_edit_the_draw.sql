-- ─────────────────────────────────────────────────────────────────
-- Editing a draw that is already running
--
-- UV, 22 Oct: "Imagine a scenario where a TD starts a 16 man tournament, two
-- additional players arrive late and TD wants to add them to the draw, then
-- without recreating the whole tournament, they can add a match to any round
-- and then they can specify how the progression should happen."
--
-- Nothing structural is needed for that. tbl_tournament_fixtures already
-- stores where each side comes from *per slot* rather than per pairing:
-- home_source_type/ref and away_source_type/ref are independent. So
--
--     R1M1 & R1M2 -> R2M1   becoming   R1M1 & R1M3 -> R2M1
--
-- is one slot changing its away_source_ref. Nothing is resorted, nothing
-- downstream is regenerated, and tdc_resolve_draw only ever fills an empty
-- slot, so it cannot fight the TD over it.
--
-- What was missing was a way to say it. This adds the two primitives:
--
--     tdc_set_fixture_source   repoint one slot at a different fixture
--     tdc_add_fixture          put another match in a round
--
-- plus the narrow read the picker needs. Inserting a whole round is
-- deliberately not here: round is an integer and tbl_tournament_round_rules
-- keys off it, so an insert has to renumber, which is its own migration.
-- ─────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────
-- Would pointing here make a loop?
--
-- Walking upward from the proposed source: if we come back to the fixture
-- being edited, its winner would have to be known before it is played.
-- Bounded at 64 because a graph that is *already* cyclic would otherwise
-- spin here, and no real bracket is 64 rounds deep.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_fixture_would_loop(p_fixture_id uuid, p_source_ref uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	with recursive up as (
		select f.id, f.home_source_type, f.home_source_ref,
			f.away_source_type, f.away_source_ref, 1 as depth
		from public.tbl_tournament_fixtures f
		where f.id = p_source_ref

		union all

		select f.id, f.home_source_type, f.home_source_ref,
			f.away_source_type, f.away_source_ref, up.depth + 1
		from up
		join public.tbl_tournament_fixtures f on f.id = any (array[
			case when up.home_source_type in ('winner_of', 'loser_of') then up.home_source_ref end,
			case when up.away_source_type in ('winner_of', 'loser_of') then up.away_source_ref end
		])
		where up.depth < 64
	)
	select exists (select 1 from up where up.id = p_fixture_id);
$$;

comment on function private.tdc_fixture_would_loop(uuid, uuid) is
	'True when pointing a slot of p_fixture_id at p_source_ref would make the bracket feed itself.';

revoke execute on function private.tdc_fixture_would_loop(uuid, uuid) from public, anon;
grant execute on function private.tdc_fixture_would_loop(uuid, uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Repointing one slot
--
-- Rehearses by default, the same way tdc_cascade_draw and
-- tdc_swap_fixture_player do: p_apply false runs the whole thing inside a
-- subtransaction, aborts it, and returns what would have happened. The
-- plpgsql variables survive the abort; every database change does not.
--
-- Pointing a slot at a fixture *empties* it. The slot is being told to wait
-- for a result, so leaving the old occupant in place would mean the new
-- source could never fill it — resolve only ever fills an empty slot — and
-- the TD would be looking at a wire that does nothing. Who was displaced is
-- in the report.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_set_fixture_source(
	p_fixture_id  uuid,
	-- Which slot. Named, not inferred: an empty slot has nobody to name it by.
	p_side        text,
	-- 'winner_of' or 'loser_of' to wire it to a fixture, 'entrant' to seat
	-- somebody directly, null to clear the slot entirely — which is the shape
	-- a bye is written in.
	p_source_type text    default null,
	p_source_ref  uuid    default null,
	p_apply       boolean default false,
	p_reason      text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f         public.tbl_tournament_fixtures%rowtype;
	v_src       public.tbl_tournament_fixtures%rowtype;
	v_was_type  text;
	v_was_ref   uuid;
	v_was_ent   uuid;
	v_was_name  text;
	v_from      text;
	v_to        text;
	v_ent       uuid;
	v_cleared   jsonb := jsonb_build_object();
	v_resolve   jsonb := jsonb_build_object();
begin
	if p_side not in ('home', 'away') then
		raise exception 'TDC (Error): a side is home or away, not "%".', p_side;
	end if;

	if p_source_type is not null
		and p_source_type not in ('entrant', 'winner_of', 'loser_of') then
		raise exception 'TDC (Error): a slot is fed by an entrant, a winner_of or a loser_of, not "%".', p_source_type;
	end if;

	if p_source_type is not null and p_source_ref is null then
		raise exception 'TDC (Error): % needs something to point at.', p_source_type;
	end if;

	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	-- A fixture being played has settled sides. Repointing would describe a
	-- bracket the match in progress contradicts, and the frames are the
	-- record. Detaching is a deliberate act and stays one.
	if v_f.match_id is not null then
		raise exception 'This fixture has a match, so its sides are settled. Detach the match first if the wiring is wrong.';
	end if;

	v_was_type := case when p_side = 'home' then v_f.home_source_type else v_f.away_source_type end;
	v_was_ref  := case when p_side = 'home' then v_f.home_source_ref  else v_f.away_source_ref  end;
	v_was_ent  := case when p_side = 'home' then v_f.home_entrant_id  else v_f.away_entrant_id  end;

	if v_was_type is not distinct from p_source_type
		and v_was_ref is not distinct from p_source_ref then
		return jsonb_build_object(
			'applied', false,
			'note', 'That slot already comes from there.');
	end if;

	-- ─── What it is being pointed at ───
	if p_source_type = 'entrant' then
		if not exists (
			select 1 from public.tbl_tournament_entrants e
			where e.id = p_source_ref and e.tournament_id = v_f.tournament_id
		) then
			raise exception 'TDC (Error): that entrant is not in this tournament.';
		end if;

		select e.display_name into v_to
		from public.tdc_tournament_entrants(v_f.tournament_id) e
		where e.entrant_id = p_source_ref;
		v_ent := p_source_ref;

	elsif p_source_type in ('winner_of', 'loser_of') then
		select * into v_src from public.tbl_tournament_fixtures where id = p_source_ref;
		if v_src.id is null then
			raise exception 'TDC (Error): fixture % not found.', p_source_ref;
		end if;

		-- Same tournament, or the bracket starts describing somebody else's.
		if v_src.tournament_id <> v_f.tournament_id then
			raise exception 'TDC (Error): that fixture is in a different tournament.';
		end if;

		if v_src.id = v_f.id then
			raise exception 'A fixture cannot be fed by itself.';
		end if;

		if private.tdc_fixture_would_loop(p_fixture_id, p_source_ref) then
			raise exception 'That would make the draw feed itself: % % would have to be decided before it is played.',
				initcap(v_src.bracket), v_src.round;
		end if;

		v_to := case when p_source_type = 'winner_of' then 'Winner of ' else 'Loser of ' end
			|| 'Round ' || v_src.round || ' · Match ' || v_src."position";
		-- Emptied on purpose: the slot is now waiting on a result, and resolve
		-- only fills an empty slot.
		v_ent := null;
	else
		v_to  := 'nobody';
		v_ent := null;
	end if;

	-- ─── What it was ───
	if v_was_type = 'entrant' then
		select e.display_name into v_from
		from public.tdc_tournament_entrants(v_f.tournament_id) e
		where e.entrant_id = v_was_ref;
	elsif v_was_type in ('winner_of', 'loser_of') then
		select case when v_was_type = 'winner_of' then 'Winner of ' else 'Loser of ' end
			|| 'Round ' || s.round || ' · Match ' || s."position"
		into v_from
		from public.tbl_tournament_fixtures s where s.id = v_was_ref;
	end if;
	v_from := coalesce(v_from, 'nobody');

	if v_was_ent is not null then
		select e.display_name into v_was_name
		from public.tdc_tournament_entrants(v_f.tournament_id) e
		where e.entrant_id = v_was_ent;
	end if;

	begin
		update public.tbl_tournament_fixtures
		set home_source_type = case when p_side = 'home' then p_source_type else home_source_type end,
			home_source_ref  = case when p_side = 'home' then p_source_ref  else home_source_ref  end,
			home_entrant_id  = case when p_side = 'home' then v_ent         else home_entrant_id  end,
			away_source_type = case when p_side = 'away' then p_source_type else away_source_type end,
			away_source_ref  = case when p_side = 'away' then p_source_ref  else away_source_ref  end,
			away_entrant_id  = case when p_side = 'away' then v_ent         else away_entrant_id  end,
			notes            = coalesce(p_reason, notes)
		where id = p_fixture_id;

		-- A bye is "this slot can never be filled, so the other side goes
		-- through". Giving the slot a source makes that untrue, so the award
		-- goes. This is the late-arrivals case: a 16-draw with byes, and two
		-- players turning up to fill them.
		if v_f.advanced_entrant_id is not null
			and v_f.advance_reason = 'bye'
			and p_source_type is not null then

			v_cleared := jsonb_build_object(
				'entrant', (select e.display_name from public.tdc_tournament_entrants(v_f.tournament_id) e
					where e.entrant_id = v_f.advanced_entrant_id),
				'reason', v_f.advance_reason);

			update public.tbl_tournament_fixtures
			set advanced_entrant_id = null, advance_reason = null
			where id = p_fixture_id;
		end if;

		-- Fill anything newly fillable and start what is ready, so the draw
		-- comes back consistent rather than half-moved.
		v_resolve := public.tdc_resolve_draw(v_f.tournament_id);

		if not p_apply then
			-- Abort the subtransaction. Every database change above is undone;
			-- the plpgsql variables survive, which is what makes this a
			-- rehearsal rather than a guess.
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		'side', p_side,
		'bracket', v_f.bracket,
		'round', v_f.round,
		'position', v_f."position",
		'from', v_from,
		'to', coalesce(v_to, 'nobody'),
		-- Who was sitting in that slot and has been turned out of it. Null in
		-- the ordinary case of wiring up an empty slot.
		'displaces', v_was_name,
		'award_cleared', v_cleared,
		'resolve', v_resolve);
end;
$$;

comment on function public.tdc_set_fixture_source(uuid, text, text, uuid, boolean, text) is
	'Point one slot of a fixture at a different source: the winner or loser of another fixture, an entrant directly, or nothing. Rehearses by default — call with p_apply false to find out what it would do. Pointing a slot at a fixture empties it, because a slot waiting on a result has to be empty for the draw to fill it.';

revoke execute on function public.tdc_set_fixture_source(uuid, text, text, uuid, boolean, text) from public, anon;
grant execute on function public.tdc_set_fixture_source(uuid, text, text, uuid, boolean, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Another match in a round
--
-- Purely additive: a new fixture with nothing pointing at it changes nothing
-- downstream, so there is no rehearsal here. It is a dead end until the TD
-- wires something to it with tdc_set_fixture_source, and the return says so
-- rather than leaving them to notice.
--
-- Only into a round that already exists. Creating a round by adding a match
-- past the end would be round insertion through the back door, and that has
-- to renumber tbl_tournament_round_rules to be correct.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_add_fixture(
	p_tournament_id   uuid,
	p_round           integer,
	p_bracket         text    default 'main',
	p_home_entrant_id uuid    default null,
	p_away_entrant_id uuid    default null,
	p_notes           text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t        public.tbl_tournaments%rowtype;
	v_max      integer;
	v_pos      integer;
	v_id       uuid;
	v_feeds    jsonb := jsonb_build_array();
	v_resolve  jsonb := jsonb_build_object();
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	if p_bracket not in ('main', 'losers', 'third_place') then
		raise exception 'TDC (Error): "%" is not a bracket.', p_bracket;
	end if;

	select max(f.round), max(f."position") filter (where f.round = p_round)
	into v_max, v_pos
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = p_bracket;

	if v_max is null then
		raise exception 'This tournament has no draw yet, so there is no round to add a match to.';
	end if;

	if p_round < 1 or p_round > v_max then
		raise exception 'Round % is not in this draw, which runs 1 to %. Adding a round is a separate step.',
			p_round, v_max;
	end if;

	if p_home_entrant_id is not null and p_home_entrant_id = p_away_entrant_id then
		raise exception 'Somebody cannot play themselves.';
	end if;

	if exists (
		select 1 from unnest(array[p_home_entrant_id, p_away_entrant_id]) as x(id)
		where x.id is not null
			and not exists (
				select 1 from public.tbl_tournament_entrants e
				where e.id = x.id and e.tournament_id = p_tournament_id
			)
	) then
		raise exception 'TDC (Error): that entrant is not in this tournament.';
	end if;

	insert into public.tbl_tournament_fixtures (
		tournament_id, bracket, round, "position",
		home_source_type, home_source_ref, home_entrant_id,
		away_source_type, away_source_ref, away_entrant_id,
		notes)
	values (
		p_tournament_id, p_bracket, p_round, coalesce(v_pos, 0) + 1,
		case when p_home_entrant_id is not null then 'entrant' end, p_home_entrant_id, p_home_entrant_id,
		case when p_away_entrant_id is not null then 'entrant' end, p_away_entrant_id, p_away_entrant_id,
		p_notes)
	returning id, "position" into v_id, v_pos;

	-- Start it if both sides are known and the tournament starts matches
	-- itself. Nothing downstream can change, because nothing points here yet.
	v_resolve := public.tdc_resolve_draw(p_tournament_id);

	return jsonb_build_object(
		'fixture_id', v_id,
		'bracket', p_bracket,
		'round', p_round,
		'position', v_pos,
		-- Nothing can point at a fixture that did not exist a moment ago. Said
		-- plainly so the page can prompt for the wiring instead of leaving a
		-- match whose winner goes nowhere.
		'feeds_into', v_feeds,
		'needs_wiring', true,
		'resolve', v_resolve);
end;
$$;

comment on function public.tdc_add_fixture(uuid, integer, text, uuid, uuid, text) is
	'Put another match in a round that already exists, at the next free position. Additive and immediate — nothing downstream can be affected, because nothing points at it yet. Wire it up with tdc_set_fixture_source.';

revoke execute on function public.tdc_add_fixture(uuid, integer, text, uuid, uuid, text) from public, anon;
grant execute on function public.tdc_add_fixture(uuid, integer, text, uuid, uuid, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Which fixtures may feed that slot
--
-- For the picker, and the same reasoning as tdc_fixture_candidates: the page
-- needs labels, not the whole draw. Everything in the same tournament that
-- is not this fixture and would not make a loop.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_fixture_source_candidates(p_fixture_id uuid)
returns table (
	fixture_id uuid,
	bracket    text,
	round      integer,
	"position" integer,
	label      text,
	decided    boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_f public.tbl_tournament_fixtures%rowtype;
begin
	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	return query
	select s.id,
		s.bracket,
		s.round,
		s."position",
		'Round ' || s.round || ' · Match ' || s."position" as label,
		coalesce((select o.decided from private.tdc_fixture_outcome(s.id) o), false)
	from public.tbl_tournament_fixtures s
	where s.tournament_id = v_f.tournament_id
		and s.id <> v_f.id
		and not private.tdc_fixture_would_loop(p_fixture_id, s.id)
	order by s.bracket, s.round, s."position";
end;
$$;

comment on function public.tdc_fixture_source_candidates(uuid) is
	'The fixtures that could feed a slot of p_fixture_id: everything in the same tournament that would not make the draw feed itself.';

revoke execute on function public.tdc_fixture_source_candidates(uuid) from public, anon;
grant execute on function public.tdc_fixture_source_candidates(uuid) to authenticated;
