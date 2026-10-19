-- The draw.
--
-- A bracket is a shape: which slot feeds which, written down once and true
-- whether or not anybody has played yet. That is the whole idea here, and it
-- comes straight from the progression design in claude/stats-schema-design.md
-- (home_source_type / home_source_ref, with source_type one of entrant,
-- winner_of, loser_of, group_position, seed).
--
-- ─── Why the shape is not on tbl_matches ───
--
-- The design note put those columns on the match. It cannot go there:
-- tbl_matches_home_side_is_one_thing requires a 'player' side to carry a
-- player_id, so a round-of-16 match between two people nobody knows yet cannot
-- exist. Relaxing that constraint would weaken a guard protecting every social
-- and league match in the system in order to serve tournaments only.
--
-- So the shape lives in its own table and a real match is created later, when
-- both sides are known. The bracket is therefore readable and publishable with
-- no matches in existence at all, which is what a draw sheet pinned to the wall
-- actually is.
--
-- ─── Why no winner column ───
--
-- Frames are the only record: a played result is always counted, never stored.
-- A fixture that was played carries match_id and its winner is counted from
-- that match's frames like everybody else's.
--
-- But a bye, a walkover and a withdrawal are advancements with nothing to
-- count — there are no frames and there is no match. Those are recorded, in
-- advanced_entrant_id + advance_reason, which is a recording path rather than a
-- stored score. The two are mutually exclusive, and a check constraint says so.

-- ─────────────────────────────────────────────────────────────────
-- A third-place playoff is a property of the tournament, not of the
-- matches in it, so it is a column here and never a ruleset key.
-- Off by default: a club night almost never plays one.
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_tournaments
	add column third_place boolean not null default false;

comment on column public.tbl_tournaments.third_place is
	'Generate a third-place playoff fed by the losers of both semi-finals. Off by default.';


-- ─────────────────────────────────────────────────────────────────
-- How people move between rounds.
--
-- 'automatic' — a finished match puts its winner in the slot above.
-- 'manual'    — nothing moves on its own; the TD places each one.
--
-- This governs only whether the system moves people FOR the TD. It never
-- governs whether the TD may move them: a tournament director has full
-- control over the matches in their own tournament, in both settings. Plenty
-- of club tournaments are run loose, with progression adjusted by hand as the
-- night goes, and a bracket that argued with the person running it would just
-- be wrong.
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_tournaments
	add column progression text not null default 'automatic'
		check (progression in ('automatic', 'manual'));

comment on column public.tbl_tournaments.progression is
	'automatic: a finished match advances its winner. manual: the TD places everybody by hand. Neither restricts what the TD may change.';


-- ─────────────────────────────────────────────────────────────────
-- The bracket
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_tournament_fixtures (
	id            uuid primary key default gen_random_uuid(),
	created_at    timestamptz not null default now(),

	tournament_id uuid not null references public.tbl_tournaments (id) on delete cascade,

	-- 'main' is the only one single elimination produces. The others are
	-- written now because the losers' bracket is the next format and a
	-- fixture that cannot say which bracket it is in would need a migration
	-- against every row to acquire one.
	bracket       text not null default 'main'
		check (bracket in ('main', 'losers', 'third_place')),

	-- Round 1 is the first one played, so a 16-player draw runs 1 to 4 and the
	-- final is the highest number. Numbering down from the final instead would
	-- renumber every fixture the moment the field changes size.
	round         integer not null check (round >= 1),
	position      integer not null check (position >= 1),

	-- Where each side comes from. Null on both means a slot nobody can fill,
	-- which is how a bye is written: the opposing side advances.
	home_source_type text check (home_source_type in ('entrant', 'winner_of', 'loser_of', 'group_position', 'seed')),
	home_source_ref  uuid,
	away_source_type text check (away_source_type in ('entrant', 'winner_of', 'loser_of', 'group_position', 'seed')),
	away_source_ref  uuid,

	-- Who is actually in it, once known. Round 1 has these filled at
	-- generation; later rounds get them as results come in.
	home_entrant_id uuid references public.tbl_tournament_entrants (id) on delete set null,
	away_entrant_id uuid references public.tbl_tournament_entrants (id) on delete set null,

	-- The match, created when both sides are known. Null before that, and null
	-- forever on a fixture settled by a bye.
	match_id      uuid references public.tbl_matches (id) on delete set null,

	-- Only for an advancement with nothing to count. A played fixture leaves
	-- both of these null and is counted from its match's frames.
	advanced_entrant_id uuid references public.tbl_tournament_entrants (id) on delete set null,
	advance_reason      text check (advance_reason in ('bye', 'walkover', 'withdrawal', 'decision')),

	notes         text,

	constraint tbl_tournament_fixtures_one_per_slot unique (tournament_id, bracket, round, position),

	-- A fixture is either played or awarded, never both. This is the constraint
	-- that keeps "frames are the only record" true in the presence of byes.
	constraint tbl_tournament_fixtures_played_or_awarded check (
		advanced_entrant_id is null or match_id is null
	),
	constraint tbl_tournament_fixtures_awarded_has_a_reason check (
		(advanced_entrant_id is null) = (advance_reason is null)
	),
	-- A side cannot play itself.
	constraint tbl_tournament_fixtures_sides_differ check (
		home_entrant_id is distinct from away_entrant_id
		or home_entrant_id is null
	)
);

create index tbl_tournament_fixtures_tournament_idx
	on public.tbl_tournament_fixtures (tournament_id, bracket, round, position);
create index tbl_tournament_fixtures_match_idx
	on public.tbl_tournament_fixtures (match_id);

comment on table public.tbl_tournament_fixtures is
	'The shape of a draw: which slot feeds which. Holds no score — a played fixture is counted from its match''s frames, and only an advancement with nothing to count (a bye, a walkover) is recorded here.';

alter table public.tbl_tournament_fixtures enable row level security;

-- A draw is public information among signed-in players: it is the sheet on the
-- wall. Changing it goes through the functions below.
create policy "Signed-in users can see the draw"
	on public.tbl_tournament_fixtures for select to authenticated using (true);

grant select on public.tbl_tournament_fixtures to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Generating a single-elimination draw
-- ─────────────────────────────────────────────────────────────────

-- The standard bracket order, built by reflection: start with [1], and at each
-- doubling put each seed next to the one that completes the new bracket size.
-- Size 8 comes out [1,8,4,5,2,7,3,6], which is what a printed draw sheet looks
-- like, and it is the reason seeds 1 and 2 can only meet in the final.
create function private.tdc_bracket_order(p_size integer)
returns integer[]
language plpgsql
immutable
as $$
declare
	v_order integer[] := array[1];
	v_next  integer[];
	v_len   integer;
	v_seed  integer;
begin
	while array_length(v_order, 1) < p_size loop
		v_len  := array_length(v_order, 1) * 2;
		v_next := array[]::integer[];
		foreach v_seed in array v_order loop
			v_next := v_next || v_seed || (v_len + 1 - v_seed);
		end loop;
		v_order := v_next;
	end loop;
	return v_order;
end;
$$;


-- Generates the whole bracket in one call.
--
-- p_confirmed_only decides who is in it: confirmed entrants only, or everybody
-- who has not withdrawn. The TD answers that at the table, because the honest
-- answer depends on whether the people who said "interested" turned up.
--
-- Seeding is settled here rather than demanded beforehand. Entrants are taken
-- in seed order with anybody unseeded falling to the end by name, and those
-- positions are written back as seeds 1..n — so the seeds always describe the
-- draw that was actually generated, and a TD who never touched seeding still
-- gets a bracket.
create function public.tdc_generate_draw(
	p_tournament_id  uuid,
	p_confirmed_only boolean default true,
	p_replace        boolean default false,
	-- Confirmation, not permission: required only when matches are attached,
	-- so that redrawing a started tournament is deliberate rather than a
	-- mis-tap. See the body for why nothing is actually lost.
	p_detach_matches boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t        public.tbl_tournaments%rowtype;
	v_ids      uuid[];
	v_n        integer;
	v_size     integer;
	v_rounds   integer;
	v_order    integer[];
	v_round    integer;
	v_position integer;
	v_slots    integer;
	v_home     integer;
	v_away     integer;
	v_home_id  uuid;
	v_away_id  uuid;
	v_prev     uuid;
	v_prev_away uuid;
	v_semi     uuid[];
	v_played   integer;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can generate the draw.';
	end if;

	if v_t.format <> 'single_elimination' then
		raise exception 'This generates a single-elimination draw. This tournament is set to %.', v_t.format;
	end if;

	if exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		if not p_replace then
			raise exception 'This tournament already has a draw. Clear it first if you mean to redraw.';
		end if;

		-- Redrawing a tournament that has started is the TD's call to make,
		-- not this function's to forbid. What it will not do is make that call
		-- quietly: the count comes back in the message so the person reads
		-- what they are about to do before confirming it.
		--
		-- Nothing is destroyed either way. Deleting a fixture does not delete
		-- its match — the FK runs from the fixture to the match, so the played
		-- matches survive as matches and simply stop belonging to a bracket.
		select count(*) into v_played
		from public.tbl_tournament_fixtures
		where tournament_id = p_tournament_id and match_id is not null;

		if v_played > 0 and not p_detach_matches then
			raise exception
				'This draw has already started: % % already attached to it. Redrawing keeps % (nothing is deleted) but takes % out of the bracket. Confirm to go ahead.',
				v_played,
				case when v_played = 1 then 'match is' else 'matches are' end,
				case when v_played = 1 then 'it' else 'them' end,
				case when v_played = 1 then 'it' else 'them' end;
		end if;

		delete from public.tbl_tournament_fixtures where tournament_id = p_tournament_id;
	end if;

	-- ─── Who is in it ───
	select array_agg(e.id order by e.seed nulls last, p.display_name)
	into v_ids
	from public.tbl_tournament_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.tournament_id = p_tournament_id
		and e.status <> 'withdrawn'
		and (not p_confirmed_only or e.status = 'confirmed');

	v_n := coalesce(array_length(v_ids, 1), 0);
	if v_n < 2 then
		raise exception 'A draw needs at least two entrants, and this one has %.', v_n;
	end if;

	-- The seeds now describe the draw, not the other way round.
	update public.tbl_tournament_entrants set seed = null where tournament_id = p_tournament_id;
	update public.tbl_tournament_entrants t
	set seed = o.ord
	from unnest(v_ids) with ordinality as o(id, ord)
	where t.id = o.id;

	-- ─── The shape ───
	-- The smallest power of two that holds the field. The difference between
	-- that and the field is the number of byes, and the bracket order puts
	-- them against the top seeds, which is the point of seeding.
	v_size := 2;
	while v_size < v_n loop
		v_size := v_size * 2;
	end loop;
	v_rounds := (ln(v_size) / ln(2))::integer;
	v_order  := private.tdc_bracket_order(v_size);

	-- ─── Round 1: the entrants themselves ───
	v_slots := v_size / 2;
	for v_position in 1 .. v_slots loop
		v_home := v_order[v_position * 2 - 1];
		v_away := v_order[v_position * 2];

		-- A seed number past the end of the field is a bye: no source, no
		-- entrant, and the other side advances.
		v_home_id := case when v_home <= v_n then v_ids[v_home] end;
		v_away_id := case when v_away <= v_n then v_ids[v_away] end;

		insert into public.tbl_tournament_fixtures (
			tournament_id, bracket, round, position,
			home_source_type, home_source_ref, home_entrant_id,
			away_source_type, away_source_ref, away_entrant_id,
			advanced_entrant_id, advance_reason
		)
		values (
			p_tournament_id, 'main', 1, v_position,
			case when v_home_id is not null then 'entrant' end, v_home_id, v_home_id,
			case when v_away_id is not null then 'entrant' end, v_away_id, v_away_id,
			-- A bye is settled the moment it is drawn. There is nothing to play
			-- and nobody should have to press anything to make it true.
			case
				when v_home_id is not null and v_away_id is null then v_home_id
				when v_away_id is not null and v_home_id is null then v_away_id
			end,
			case when v_home_id is null or v_away_id is null then 'bye' end
		);
	end loop;

	-- ─── Later rounds: the winners of the round below ───
	for v_round in 2 .. v_rounds loop
		v_slots := v_size / (2 ^ v_round)::integer;
		for v_position in 1 .. v_slots loop
			-- Each slot is fed by the two fixtures below it: positions 2p-1
			-- and 2p of the previous round.
			select id into v_prev
			from public.tbl_tournament_fixtures
			where tournament_id = p_tournament_id and bracket = 'main'
				and round = v_round - 1 and position = v_position * 2 - 1;

			select id into v_prev_away
			from public.tbl_tournament_fixtures
			where tournament_id = p_tournament_id and bracket = 'main'
				and round = v_round - 1 and position = v_position * 2;

			insert into public.tbl_tournament_fixtures (
				tournament_id, bracket, round, position,
				home_source_type, home_source_ref,
				away_source_type, away_source_ref
			)
			values (
				p_tournament_id, 'main', v_round, v_position,
				'winner_of', v_prev,
				'winner_of', v_prev_away
			);
		end loop;
	end loop;

	-- ─── The third-place playoff ───
	-- Fed by the losers of both semi-finals. Only exists where there are two
	-- semi-finals to lose, so a four-player draw gets one and a two-player
	-- draw does not.
	if v_t.third_place and v_rounds >= 2 then
		select array_agg(id order by position) into v_semi
		from public.tbl_tournament_fixtures
		where tournament_id = p_tournament_id and bracket = 'main' and round = v_rounds - 1;

		if array_length(v_semi, 1) = 2 then
			insert into public.tbl_tournament_fixtures (
				tournament_id, bracket, round, position,
				home_source_type, home_source_ref,
				away_source_type, away_source_ref
			)
			values (
				p_tournament_id, 'third_place', v_rounds, 1,
				'loser_of', v_semi[1],
				'loser_of', v_semi[2]
			);
		end if;
	end if;

	return v_n;
end;
$$;

revoke execute on function public.tdc_generate_draw(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.tdc_generate_draw(uuid, boolean, boolean, boolean) to authenticated;


-- Clearing the draw, so a TD who generated before the last two people arrived
-- can simply do it again. As with regenerating, a started draw is not refused
-- — it asks first, and the matches themselves survive.
create function public.tdc_clear_draw(
	p_tournament_id  uuid,
	p_detach_matches boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_n      integer;
	v_played integer;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can clear the draw.';
	end if;

	select count(*) into v_played
	from public.tbl_tournament_fixtures
	where tournament_id = p_tournament_id and match_id is not null;

	if v_played > 0 and not p_detach_matches then
		raise exception
			'This draw has already started: % % attached to it. Clearing keeps % (nothing is deleted) but takes the bracket away. Confirm to go ahead.',
			v_played,
			case when v_played = 1 then 'match is' else 'matches are' end,
			case when v_played = 1 then 'it' else 'them' end;
	end if;

	delete from public.tbl_tournament_fixtures where tournament_id = p_tournament_id;
	get diagnostics v_n = row_count;
	return v_n;
end;
$$;

revoke execute on function public.tdc_clear_draw(uuid, boolean) from public, anon;
grant execute on function public.tdc_clear_draw(uuid, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Reading the draw
-- ─────────────────────────────────────────────────────────────────

-- The whole bracket in one call, names included. A bracket page that asked per
-- fixture would make sixty-three requests for a sixty-four draw.
create function public.tdc_tournament_draw(p_tournament_id uuid)
returns table (
	fixture_id    uuid,
	bracket       text,
	round         integer,
	-- Quoted: "position" is a keyword PostgreSQL will not accept bare in a
	-- RETURNS TABLE list, though it is fine as a column name on the table.
	"position"    integer,
	home_entrant_id uuid,
	home_name     text,
	home_seed     integer,
	home_source   text,
	away_entrant_id uuid,
	away_name     text,
	away_seed     integer,
	away_source   text,
	match_id      uuid,
	advanced_entrant_id uuid,
	advance_reason text,
	-- So a page can say "Winner of 2-1" without working the numbering out from
	-- the fixture ids it would otherwise have to cross-reference itself.
	home_feeder_round    integer,
	home_feeder_position integer,
	away_feeder_round    integer,
	away_feeder_position integer
)
language sql
stable
security definer
set search_path = ''
as $$
	select f.id, f.bracket, f.round, f.position,
		f.home_entrant_id, hp.display_name, he.seed, f.home_source_type,
		f.away_entrant_id, ap.display_name, ae.seed, f.away_source_type,
		f.match_id, f.advanced_entrant_id, f.advance_reason,
		hf.round, hf.position,
		af.round, af.position
	from public.tbl_tournament_fixtures f
	left join public.tbl_tournament_entrants he on he.id = f.home_entrant_id
	left join public.tbl_players hp            on hp.id = he.player_id
	left join public.tbl_tournament_entrants ae on ae.id = f.away_entrant_id
	left join public.tbl_players ap            on ap.id = ae.player_id
	left join public.tbl_tournament_fixtures hf on hf.id = f.home_source_ref
		and f.home_source_type in ('winner_of', 'loser_of')
	left join public.tbl_tournament_fixtures af on af.id = f.away_source_ref
		and f.away_source_type in ('winner_of', 'loser_of')
	where f.tournament_id = p_tournament_id
	order by f.bracket, f.round, f.position;
$$;

revoke execute on function public.tdc_tournament_draw(uuid) from public, anon;
grant execute on function public.tdc_tournament_draw(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Changing a fixture by hand
--
-- The TD's control over their own bracket, and the thing a "loose" tournament
-- is actually run on: progression adjusted at the table as the night goes.
-- It works the same whether progression is automatic or manual, and it works
-- on a draw that has already started — a bracket that argued with the person
-- running it would just be wrong.
--
-- What it will not do is produce a bracket that cannot be read: an entrant
-- from another tournament, somebody playing themselves, or a fixture that is
-- both played and awarded. Those are refused with a reason.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_set_fixture(
	p_fixture_id          uuid,
	p_home_entrant_id     uuid    default null,
	p_away_entrant_id     uuid    default null,
	p_clear_home          boolean default false,
	p_clear_away          boolean default false,
	-- Awarding the fixture to somebody without it being played: a walkover, a
	-- withdrawal, or a TD's decision. Only legal while no match is attached,
	-- because a played fixture is counted from its frames.
	p_advanced_entrant_id uuid    default null,
	p_advance_reason      text    default null,
	p_clear_advance       boolean default false,
	p_notes               text    default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f    public.tbl_tournament_fixtures%rowtype;
	v_home uuid;
	v_away uuid;
	v_adv  uuid;
	v_why  text;
begin
	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	-- What the row becomes. A clear flag beats a value, so one call can empty
	-- a slot without having to say what to put in it.
	v_home := case when p_clear_home then null else coalesce(p_home_entrant_id, v_f.home_entrant_id) end;
	v_away := case when p_clear_away then null else coalesce(p_away_entrant_id, v_f.away_entrant_id) end;
	v_adv  := case when p_clear_advance then null else coalesce(p_advanced_entrant_id, v_f.advanced_entrant_id) end;
	v_why  := case when p_clear_advance then null else coalesce(p_advance_reason, v_f.advance_reason) end;

	-- Everybody named has to be in this tournament. Without this a typo'd id
	-- puts a stranger in a bracket and the draw stops meaning anything.
	if exists (
		select 1 from unnest(array[v_home, v_away, v_adv]) as x(id)
		where x.id is not null
			and not exists (
				select 1 from public.tbl_tournament_entrants e
				where e.id = x.id and e.tournament_id = v_f.tournament_id
			)
	) then
		raise exception 'TDC (Error): that entrant is not in this tournament.';
	end if;

	if v_home is not null and v_home = v_away then
		raise exception 'Somebody cannot play themselves.';
	end if;

	-- Whoever is awarded the fixture should be one of the two people in it.
	-- Not enforced as a constraint, because a TD moving people around mid-edit
	-- will pass through states where it is briefly untrue, but refused here
	-- because the finished article being wrong is a bracket nobody can read.
	if v_adv is not null and v_adv is distinct from v_home and v_adv is distinct from v_away then
		raise exception 'That entrant is not in this fixture, so the fixture cannot be awarded to them.';
	end if;

	if v_adv is not null and v_f.match_id is not null then
		raise exception 'This fixture has a match, so its result is counted from the frames. Change the match, or detach it first.';
	end if;

	if v_adv is not null and v_why is null then
		raise exception 'TDC (Error): awarding a fixture needs a reason (bye, walkover, withdrawal or decision).';
	end if;

	update public.tbl_tournament_fixtures
	set home_entrant_id = v_home,
		away_entrant_id = v_away,
		advanced_entrant_id = v_adv,
		advance_reason  = v_why,
		notes           = coalesce(p_notes, notes),
		-- A slot filled by hand stops being fed by the round below. Leaving
		-- the source in place would mean the next automatic advance quietly
		-- overwrote the TD, which is the opposite of what this function is for.
		-- An emptied slot has no source at all, which is the same shape a bye
		-- is written in. A filled one is sourced from the entrant directly.
		home_source_type = case
			when p_clear_home then null
			when p_home_entrant_id is not null then 'entrant'
			else home_source_type end,
		home_source_ref = case
			when p_clear_home then null
			when p_home_entrant_id is not null then p_home_entrant_id
			else home_source_ref end,
		away_source_type = case
			when p_clear_away then null
			when p_away_entrant_id is not null then 'entrant'
			else away_source_type end,
		away_source_ref = case
			when p_clear_away then null
			when p_away_entrant_id is not null then p_away_entrant_id
			else away_source_ref end
	where id = p_fixture_id;
end;
$$;

revoke execute on function public.tdc_set_fixture(uuid, uuid, uuid, boolean, boolean, uuid, text, boolean, text) from public, anon;
grant execute on function public.tdc_set_fixture(uuid, uuid, uuid, boolean, boolean, uuid, text, boolean, text) to authenticated;
