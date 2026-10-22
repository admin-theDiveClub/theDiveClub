-- ─────────────────────────────────────────────────────────────────
-- Inserting a round
--
-- UV, 22 Oct: "TD can hover on the border between two rounds and then add a
-- round via a '+' button." A prelim before round 1 is the case that matters.
--
-- UV chose renumbering over sparse ordering (docs/DECISIONS.md, 22 Oct): one
-- awkward function rather than a second concept that never goes away. Exactly
-- two tables store a round number, which is what makes that the cheaper side
-- of the trade:
--
--     tbl_tournament_fixtures     (tournament_id, bracket, round, position) unique
--     tbl_tournament_round_rules  (tournament_id, bracket, round) primary key
--
-- Everything else that mentions a round is a function's return column,
-- computed per call.
--
-- There is no rounds table and this does not add one. A round exists because
-- fixtures are in it, so inserting a round is only the renumber — it leaves a
-- gap in the sequence, and the page draws 1..max rather than the distinct
-- rounds that happen to have fixtures. The gap is the empty round, and the
-- arrows pass over it on their own because the round above still points at
-- the round below.
--
-- Also here, because they are the same shape of operation:
--
--     tdc_delete_round    close an empty round back up
--     tdc_remove_fixture  take a match out that nothing depends on
--     tdc_add_fixture     amended to allow appending a round at the top
-- ─────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────
-- Shifting the round numbers
--
-- Two passes, on purpose. The unique constraint on
-- (tournament_id, bracket, round, position) is checked per row as the rows
-- are updated, so a single `set round = round + 1` fails the moment it moves
-- round 1 onto round 2 while round 2 is still there. Making the constraint
-- deferrable would push the failure out to COMMIT, which is past the
-- rehearsal's subtransaction and therefore past where it can be caught and
-- reported. So: move the affected rows clear of every existing number, then
-- bring them back one higher. Every check stays immediate and every failure
-- surfaces inside the function.
--
-- The offset is the current maximum round, which is by definition larger than
-- anything that is staying put.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_shift_rounds(
	p_tournament_id uuid,
	p_bracket       text,
	p_from_round    integer,
	p_by            integer,
	p_offset        integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.tbl_tournament_fixtures
	set round = round + p_offset
	where tournament_id = p_tournament_id and bracket = p_bracket
		and round >= p_from_round;

	update public.tbl_tournament_fixtures
	set round = round - p_offset + p_by
	where tournament_id = p_tournament_id and bracket = p_bracket
		and round > p_offset;

	update public.tbl_tournament_round_rules
	set round = round + p_offset
	where tournament_id = p_tournament_id and bracket = p_bracket
		and round >= p_from_round;

	update public.tbl_tournament_round_rules
	set round = round - p_offset + p_by
	where tournament_id = p_tournament_id and bracket = p_bracket
		and round > p_offset;
end;
$$;

comment on function private.tdc_shift_rounds(uuid, text, integer, integer, integer) is
	'Move every round at or above p_from_round by p_by, in two passes via p_offset so the per-row unique check never sees a collision. Moves tbl_tournament_round_rules with the fixtures, which is the whole reason renumbering is not free.';

revoke execute on function private.tdc_shift_rounds(uuid, text, integer, integer, integer) from public, anon;


-- ─────────────────────────────────────────────────────────────────
-- An empty round, inserted
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_insert_round(
	p_tournament_id uuid,
	-- The round the new one goes *before*. 1 puts a prelim in front of
	-- everything, which is the case UV described.
	p_before_round  integer,
	p_bracket       text    default 'main',
	p_apply         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t       public.tbl_tournaments%rowtype;
	v_max     integer;
	v_moved   integer := 0;
	v_rules   integer := 0;
	v_playing integer := 0;
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

	select max(f.round) into v_max
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = p_bracket;

	if v_max is null then
		raise exception 'This tournament has no draw yet, so there is nothing to insert a round into.';
	end if;

	if p_before_round < 1 or p_before_round > v_max then
		raise exception 'Round % is not in this draw, which runs 1 to %. A round on the end is made by adding a match to round %.',
			p_before_round, v_max, v_max + 1;
	end if;

	-- What is about to be renumbered. Counted before the shift, because after
	-- it the numbers these describe no longer exist.
	select count(*) into v_moved
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = p_bracket
		and f.round >= p_before_round;

	select count(*) into v_rules
	from public.tbl_tournament_round_rules r
	where r.tournament_id = p_tournament_id and r.bracket = p_bracket
		and r.round >= p_before_round;

	-- Worth saying out loud. Renumbering does not touch a match — its ruleset
	-- was frozen at creation and its frames are untouched — but a TD watching
	-- a round change number while it is being played deserves to be told it
	-- is only a number.
	select count(*) into v_playing
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = p_bracket
		and f.round >= p_before_round and f.match_id is not null;

	begin
		perform private.tdc_shift_rounds(p_tournament_id, p_bracket, p_before_round, 1, v_max);

		if not p_apply then
			-- Abort the subtransaction. Every change above is undone; the
			-- plpgsql variables survive, which is what makes this a rehearsal.
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		'bracket', p_bracket,
		'new_round', p_before_round,
		'fixtures_renumbered', v_moved,
		'round_rules_moved', v_rules,
		-- Matches being played in the rounds that shift. They are unaffected:
		-- a match's ruleset is frozen on it and its frames are its own.
		'matches_in_play', v_playing,
		'rounds_before', v_max,
		'rounds_after', v_max + 1,
		'note', 'The new round is empty. Add a match to it, then wire it up.');
end;
$$;

comment on function public.tdc_insert_round(uuid, integer, text, boolean) is
	'Insert an empty round before p_before_round, renumbering every round above it and moving their stored rulesets with them. Rehearses by default. The new round holds no fixtures — a round exists because fixtures are in it — so the page draws 1..max and the gap is the empty round.';

revoke execute on function public.tdc_insert_round(uuid, integer, text, boolean) from public, anon;
grant execute on function public.tdc_insert_round(uuid, integer, text, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Closing an empty round back up
--
-- Only an empty one. Deleting a round with fixtures in it would be deleting
-- matches as a side effect of a layout change, and taking a match out is
-- tdc_remove_fixture, one at a time, with its own refusals.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_delete_round(
	p_tournament_id uuid,
	p_round         integer,
	p_bracket       text    default 'main',
	p_apply         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_max   integer;
	v_here  integer;
	v_moved integer := 0;
	v_rules integer := 0;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	select max(f.round) into v_max
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = p_bracket;

	if v_max is null then
		raise exception 'This tournament has no draw yet.';
	end if;

	if p_bracket not in ('main', 'losers', 'third_place') then
		raise exception 'TDC (Error): "%" is not a bracket.', p_bracket;
	end if;

	-- A number above the top is not a round, it is nothing. Saying so beats
	-- reporting a renumber of zero rows as if something happened.
	if p_round < 1 or p_round > v_max then
		raise exception 'Round % is not in this draw, which runs 1 to %.', p_round, v_max;
	end if;

	select count(*) into v_here
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = p_bracket and f.round = p_round;

	if v_here > 0 then
		raise exception 'Round % still has % match(es) in it. Take those out first.', p_round, v_here;
	end if;

	select count(*) into v_moved
	from public.tbl_tournament_fixtures f
	where f.tournament_id = p_tournament_id and f.bracket = p_bracket and f.round > p_round;

	select count(*) into v_rules
	from public.tbl_tournament_round_rules r
	where r.tournament_id = p_tournament_id and r.bracket = p_bracket and r.round > p_round;

	begin
		-- The empty round may still carry a ruleset somebody set on it.
		delete from public.tbl_tournament_round_rules
		where tournament_id = p_tournament_id and bracket = p_bracket and round = p_round;

		-- Shifting down cannot collide — the row being vacated is this one —
		-- but it goes through the same two-pass helper so there is one place
		-- that knows how to move a round number.
		perform private.tdc_shift_rounds(p_tournament_id, p_bracket, p_round + 1, -1, v_max);

		if not p_apply then
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		'bracket', p_bracket,
		'removed_round', p_round,
		'fixtures_renumbered', v_moved,
		'round_rules_moved', v_rules,
		'rounds_before', v_max,
		'rounds_after', v_max - 1);
end;
$$;

comment on function public.tdc_delete_round(uuid, integer, text, boolean) is
	'Close an empty round back up, renumbering everything above it. Refuses while the round still has fixtures: removing a match is a separate, deliberate act.';

revoke execute on function public.tdc_delete_round(uuid, integer, text, boolean) from public, anon;
grant execute on function public.tdc_delete_round(uuid, integer, text, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Taking a match back out
--
-- The undo for tdc_add_fixture. Refuses while anything depends on it, and
-- says what, so the TD rewires rather than discovering a dangling arrow
-- afterwards.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_remove_fixture(
	p_fixture_id uuid,
	p_apply      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f    public.tbl_tournament_fixtures%rowtype;
	v_fed  jsonb := jsonb_build_array();
begin
	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	-- A played fixture is a record of frames. Detaching the match is the way
	-- to say the match no longer belongs to the draw, and it keeps the frames.
	if v_f.match_id is not null then
		raise exception 'This fixture has a match. Detach the match first — removing the fixture would throw away a result that was really played.';
	end if;

	-- Anything wired to it. Removing it would leave those slots pointing at
	-- nothing, and the FK is on entrants, not on the source refs, so nothing
	-- else would catch it.
	select coalesce(jsonb_agg(jsonb_build_object(
			'fixture_id', o.id,
			'round', o.round,
			'position', o."position",
			'side', s.side) order by o.round, o."position"), jsonb_build_array())
	into v_fed
	from public.tbl_tournament_fixtures o
	cross join lateral (values
		('home', o.home_source_type, o.home_source_ref),
		('away', o.away_source_type, o.away_source_ref)
	) as s(side, stype, sref)
	where o.tournament_id = v_f.tournament_id
		and s.stype in ('winner_of', 'loser_of')
		and s.sref = p_fixture_id;

	if jsonb_array_length(v_fed) > 0 and p_apply then
		raise exception 'Something still comes from this match. Point those slots somewhere else first.';
	end if;

	if p_apply then
		delete from public.tbl_tournament_fixtures where id = p_fixture_id;
		perform public.tdc_resolve_draw(v_f.tournament_id);
	end if;

	return jsonb_build_object(
		'applied', p_apply and jsonb_array_length(v_fed) = 0,
		'bracket', v_f.bracket,
		'round', v_f.round,
		'position', v_f."position",
		-- Empty is the removable case. Anything in here has to be rewired
		-- first, and naming it is the point of rehearsing at all.
		'feeds', v_fed);
end;
$$;

comment on function public.tdc_remove_fixture(uuid, boolean) is
	'Remove a fixture that has no match and that nothing is wired to. Rehearses by default and names every slot that still comes from it.';

revoke execute on function public.tdc_remove_fixture(uuid, boolean) from public, anon;
grant execute on function public.tdc_remove_fixture(uuid, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Appending a round, by putting the first match in it
--
-- Replaces the version from 20261022150000, which refused any round past the
-- last one on the grounds that creating a round needs a renumber. Adding one
-- on the *end* needs no renumber — nothing moves — so the refusal was wider
-- than its reason. Inserting below the top still goes through
-- tdc_insert_round.
--
-- Only one round past the end: allowing round 9 of a 2-round draw would leave
-- rounds 3 to 8 as gaps nobody asked for.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_add_fixture(
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

	-- One past the end is a new round on top and moves nothing. Further than
	-- that would leave gaps nobody asked for, and anywhere below the top is
	-- tdc_insert_round's job because it renumbers.
	if p_round < 1 or p_round > v_max + 1 then
		raise exception 'Round % is not in this draw, which runs 1 to %. The next round up is %; to put one in below that, insert a round.',
			p_round, v_max, v_max + 1;
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
		'new_round', p_round > v_max,
		-- Nothing can point at a fixture that did not exist a moment ago. Said
		-- plainly so the page can prompt for the wiring instead of leaving a
		-- match whose winner goes nowhere.
		'feeds_into', v_feeds,
		'needs_wiring', true,
		'resolve', v_resolve);
end;
$$;

comment on function public.tdc_add_fixture(uuid, integer, text, uuid, uuid, text) is
	'Put another match in a round, at the next free position. One round past the last is allowed and makes a new round on top, which moves nothing. Additive and immediate — nothing downstream can be affected, because nothing points at it yet. Wire it up with tdc_set_fixture_source.';

revoke execute on function public.tdc_add_fixture(uuid, integer, text, uuid, uuid, text) from public, anon;
grant execute on function public.tdc_add_fixture(uuid, integer, text, uuid, uuid, text) to authenticated;
