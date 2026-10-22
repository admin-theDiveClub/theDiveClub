-- A ruleset per round.
--
-- UV, 21 Oct: the TD page should be able to change match settings for a round
-- on demand. Race to 3 in the early rounds, race to 5 from the semis.
--
-- ─── The principle this looked like it broke, and does not ───
--
-- A match freezes its ruleset at creation so that a later change cannot
-- rescore frames already played. That reads like a bar to this feature, and
-- it was described as one on 21 Oct. It is not.
--
-- The principle protects against a *league's* settings changing underneath
-- old matches. It was never about a director deliberately changing a match in
-- front of them — and `tdc_update_match_settings` has always allowed exactly
-- that, refusing only an abandoned match or an agreed card, and re-deriving
-- the break sides afterwards. A TD can already do this one match at a time.
--
-- So this is a bulk version of something already permitted, plus somewhere to
-- remember the answer. Much smaller than it first appeared.
--
-- ─── Stored, not applied and forgotten ───
--
-- UV, 22 Oct: stored, and editable before the round starts. That matters in
-- manual mode, where matches appear through the evening: a one-off bulk apply
-- would change the three matches that exist and silently leave the fourth,
-- created an hour later, on the tournament's ruleset.
--
-- So a round's ruleset is a row, `tdc_create_fixture_match` reads it when it
-- freezes a match, and setting it for a round nobody has reached yet is an
-- ordinary thing to do.

-- ─────────────────────────────────────────────────────────────────
-- Where a round's ruleset lives
--
-- Keyed on (tournament, bracket, round) rather than given its own id: a round
-- is not a thing in this schema, it is a number on a fixture, and inventing a
-- rounds table to hold one column would mean every fixture needing to point
-- at it. This is the smallest shape that answers "what are this round's
-- rules".
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_tournament_round_rules (
	tournament_id uuid not null references public.tbl_tournaments (id) on delete cascade,
	bracket       text not null default 'main',
	round         integer not null check (round >= 1),

	-- Validated by the same private.tdc_check_match_rules the match page and
	-- the tournament use, so a round can never hold a ruleset its own matches
	-- would refuse.
	rules         jsonb not null,

	created_at    timestamptz not null default now(),
	created_by    uuid references auth.users (id) on delete set null,

	primary key (tournament_id, bracket, round)
);

comment on table public.tbl_tournament_round_rules is
	'The ruleset matches in one round of a tournament are created with. Absent means the tournament''s own rules. Read through private.tdc_rules_for_round, never straight off this table.';

alter table public.tbl_tournament_round_rules enable row level security;

create policy "Signed-in users can see round rules"
	on public.tbl_tournament_round_rules for select to authenticated using (true);

grant select on public.tbl_tournament_round_rules to authenticated;


-- The one place to ask what a round's rules are. Everything that needs them
-- goes through here, so the fallback to the tournament is decided once.
create function private.tdc_rules_for_round(
	p_tournament_id uuid,
	p_bracket       text,
	p_round         integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(
		(select r.rules from public.tbl_tournament_round_rules r
		  where r.tournament_id = p_tournament_id
			and r.bracket = p_bracket
			and r.round = p_round),
		(select t.rules from public.tbl_tournaments t where t.id = p_tournament_id)
	);
$$;

revoke execute on function private.tdc_rules_for_round(uuid, text, integer) from public, anon;
grant execute on function private.tdc_rules_for_round(uuid, text, integer) to authenticated;


-- What a page needs to show the rounds and which of them differ.
create function public.tdc_round_rules(p_tournament_id uuid)
returns table (bracket text, round integer, rules jsonb, matches integer)
language sql
stable
security definer
set search_path = ''
as $$
	select r.bracket, r.round, r.rules,
		(select count(*)::integer
		   from public.tbl_tournament_fixtures f
		  where f.tournament_id = r.tournament_id
			and f.bracket = r.bracket and f.round = r.round)
	from public.tbl_tournament_round_rules r
	where r.tournament_id = p_tournament_id
	order by r.bracket, r.round;
$$;

revoke execute on function public.tdc_round_rules(uuid) from public, anon;
grant execute on function public.tdc_round_rules(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Setting it
--
-- Rehearses by default, like tdc_cascade_draw and tdc_swap_fixture_player.
-- A TD is entitled to know that this will re-derive four matches with frames
-- in them *before* it happens.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_set_round_rules(
	p_tournament_id uuid,
	p_round         integer,
	p_rules         jsonb,
	p_bracket       text    default 'main',
	-- UV, 22 Oct: a checkbox for "and later rounds", so "race to 5 from the
	-- quarters on" is one action rather than five.
	p_and_later     boolean default false,
	p_apply         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_rounds  integer[];
	v_changed jsonb := jsonb_build_array();
	v_skipped jsonb := jsonb_build_array();
	v_last    integer;
	v_m       record;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change its rules.';
	end if;
	if p_round is null or p_round < 1 then
		raise exception 'TDC (Error): a round number of 1 or more is required.';
	end if;

	-- The same check the match page and the tournament use, so a round can
	-- never hold a ruleset its own matches would refuse.
	perform private.tdc_check_match_rules(p_rules);

	-- Which rounds this covers. "And later" means every round that exists in
	-- the draw above this one — not an open-ended promise about rounds nobody
	-- has drawn yet, which would be a rule with nothing to attach to.
	select max(round) into v_last
	from public.tbl_tournament_fixtures
	where tournament_id = p_tournament_id and bracket = p_bracket;

	v_rounds := case
		when not p_and_later then array[p_round]
		else (select coalesce(array_agg(g), array[p_round])
			  from generate_series(p_round, greatest(p_round, coalesce(v_last, p_round))) g)
	end;

	begin
		-- ── Remember it ──
		insert into public.tbl_tournament_round_rules
			(tournament_id, bracket, round, rules, created_by)
		select p_tournament_id, p_bracket, r, p_rules, (select auth.uid())
		from unnest(v_rounds) r
		on conflict (tournament_id, bracket, round) do update
			set rules = excluded.rules, created_by = excluded.created_by, created_at = now();

		-- ── Apply it to the matches that already exist ──
		--
		-- Reported either way. A match with frames in it is the one a TD
		-- needs to see before agreeing, which is why the count goes in the
		-- report rather than the match simply being changed.
		for v_m in
			select f.match_id, f.round, f."position",
				(select count(*)::integer from public.tbl_frames x where x.match_id = f.match_id) as frames,
				(private.tdc_card_state(f.match_id)->>'state') as card_state,
				m.status
			from public.tbl_tournament_fixtures f
			join public.tbl_matches m on m.id = f.match_id
			where f.tournament_id = p_tournament_id
				and f.bracket = p_bracket
				and f.round = any(v_rounds)
			order by f.round, f."position"
		loop
			-- An agreed card is settled and an abandoned match is over.
			-- tdc_update_match_settings refuses both, and one exception in
			-- the middle of a loop would take the whole batch with it, so
			-- they are filtered here and reported rather than attempted.
			if v_m.card_state = 'agreed' or v_m.status = 'abandoned' then
				v_skipped := v_skipped || jsonb_build_object(
					'round', v_m.round, 'position', v_m."position",
					'frames', v_m.frames,
					'why', case when v_m.status = 'abandoned'
						then 'the match was abandoned'
						else 'both players have agreed the card' end);
				continue;
			end if;

			perform public.tdc_update_match_settings(v_m.match_id, p_rules);

			v_changed := v_changed || jsonb_build_object(
				'round', v_m.round, 'position', v_m."position",
				'frames', v_m.frames,
				'in_progress', v_m.frames > 0);
		end loop;

		if not p_apply then
			-- Abort the subtransaction. Everything above is undone; the
			-- plpgsql variables survive, which is what makes this a rehearsal
			-- rather than a guess. Same trick as tdc_cascade_draw.
			raise exception 'TDC rehearsal' using errcode = 'TDCDR';
		end if;
	exception
		when sqlstate 'TDCDR' then
			null;
	end;

	return jsonb_build_object(
		'applied', p_apply,
		'rounds', to_jsonb(v_rounds),
		'changed', v_changed,
		'skipped', v_skipped,
		-- The number a TD actually wants before pressing: how many matches
		-- that are being played will be re-derived.
		'in_progress', (select count(*) from jsonb_array_elements(v_changed) e
						 where (e->>'in_progress')::boolean));
end;
$$;

comment on function public.tdc_set_round_rules(uuid, integer, jsonb, text, boolean, boolean) is
	'Sets the ruleset for a round, and for later rounds when asked. Rehearses by default: call with p_apply false to find out which matches change and how many are being played. Matches created later in that round inherit it through tdc_create_fixture_match.';

revoke execute on function public.tdc_set_round_rules(uuid, integer, jsonb, text, boolean, boolean) from public, anon;
grant execute on function public.tdc_set_round_rules(uuid, integer, jsonb, text, boolean, boolean) to authenticated;


-- Handing a round back to the tournament's own rules. Removing the row is the
-- whole of it: tdc_rules_for_round falls back on its own.
--
-- Matches already created keep the ruleset frozen onto them, which is correct
-- — this says what *future* matches inherit, and undoing a setting is not the
-- same as undoing what was played under it.
create function public.tdc_clear_round_rules(
	p_tournament_id uuid,
	p_round         integer,
	p_bracket       text    default 'main',
	p_and_later     boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_hit integer;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change its rules.';
	end if;

	delete from public.tbl_tournament_round_rules
	where tournament_id = p_tournament_id
		and bracket = p_bracket
		and (round = p_round or (p_and_later and round > p_round));

	get diagnostics v_hit = row_count;
	return v_hit;
end;
$$;

revoke execute on function public.tdc_clear_round_rules(uuid, integer, text, boolean) from public, anon;
grant execute on function public.tdc_clear_round_rules(uuid, integer, text, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- A new match takes its round's rules
--
-- Replaces the version from 20261022110000, patched not retyped. One line
-- changes: the ruleset frozen onto the match comes from the round rather
-- than straight off the tournament.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_create_fixture_match(uuid);

create function public.tdc_create_fixture_match(p_fixture_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f    public.tbl_tournament_fixtures%rowtype;
	v_t    public.tbl_tournaments%rowtype;
	v_home uuid;
	v_away uuid;
	v_id   uuid;
begin
	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_f.tournament_id) then
		raise exception 'Only the people running this tournament can start its matches.';
	end if;

	if v_f.match_id is not null then
		return v_f.match_id;
	end if;

	if v_f.advanced_entrant_id is not null then
		raise exception 'This fixture was already settled without being played, so it has no match.';
	end if;

	if v_f.home_entrant_id is null or v_f.away_entrant_id is null then
		raise exception 'Both sides have to be known before this fixture can be played.';
	end if;

	select * into v_t from public.tbl_tournaments where id = v_f.tournament_id;

	select player_id into v_home from public.tbl_tournament_entrants where id = v_f.home_entrant_id;
	select player_id into v_away from public.tbl_tournament_entrants where id = v_f.away_entrant_id;

	insert into public.tbl_matches (
		created_by, venue_id, rules,
		home_side_kind, home_player_id,
		away_side_kind, away_player_id,
		-- The tournament's own sanctioning carries onto its matches. It is an
		-- authorisation fact in both places, never a ruleset key, so it
		-- propagates rather than being decided again per match.
		sanctioned, sanctioned_at, sanctioned_by
	)
	values (
		-- The round's own ruleset where it has one, the tournament's
		-- otherwise. Added 20261022140000; this is the moment the rules
		-- are frozen onto the match, so it is the only place that has to
		-- know rounds can differ.
		(select auth.uid()), v_t.venue_id,
		private.tdc_rules_for_round(v_f.tournament_id, v_f.bracket, v_f.round),
		'player', v_home,
		'player', v_away,
		v_t.sanctioned,
		case when v_t.sanctioned then now() end,
		case when v_t.sanctioned then (select auth.uid()) end
	)
	returning id into v_id;

	update public.tbl_tournament_fixtures set match_id = v_id where id = p_fixture_id;

	-- Both players, now there is something to play. Added 20261022100000.
	-- This is the single place a tournament match comes into existence —
	-- automatic progression and a TD pressing Start match both arrive here —
	-- so one patch covers UV's "notify for auto-progression too".
	declare
		v_me    uuid := private.tdc_me();
		v_hname text;
		v_aname text;
		v_where text := 'Round ' || v_f.round || ' · Match ' || v_f."position";
	begin
		select display_name into v_hname from public.tbl_players where id = v_home;
		select display_name into v_aname from public.tbl_players where id = v_away;

		perform private.tdc_notify(v_home, 'tournament', 'match_ready',
			'Your match is ready',
			v_where || ' — you are playing ' || coalesce(v_aname, 'your opponent') || '.',
			'/match/?id=' || v_id, v_id, v_f.tournament_id, v_me);

		perform private.tdc_notify(v_away, 'tournament', 'match_ready',
			'Your match is ready',
			v_where || ' — you are playing ' || coalesce(v_hname, 'your opponent') || '.',
			'/match/?id=' || v_id, v_id, v_f.tournament_id, v_me);
	end;

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_fixture_match(uuid) from public, anon;
grant execute on function public.tdc_create_fixture_match(uuid) to authenticated;
