-- Moving through the bracket.
--
-- Two jobs, deliberately separate: deciding who won a fixture, and putting
-- that person in the slot above. The first is a reading of frames that already
-- exist. The second is an action the tournament's own settings govern.
--
-- Nothing here runs on a schedule and nothing is a trigger. tdc_resolve_draw
-- is idempotent and the bracket page calls it on load and after every write,
-- the same way every other page in this project re-reads rather than patching.
-- A resolver that fired from a trigger would advance somebody in the middle of
-- a correction, which is exactly the moment a TD is trying to stop it.

-- ─────────────────────────────────────────────────────────────────
-- When the match behind a fixture gets made.
--
-- 'automatic' — the moment both sides are known.
-- 'manual'    — when the TD says so, because the table is free.
--
-- The same shape as `progression`: it governs what the system does on its own,
-- never what the TD may do. A TD can always create a fixture's match by hand,
-- in either setting.
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_tournaments
	add column create_matches text not null default 'automatic'
		check (create_matches in ('automatic', 'manual'));

comment on column public.tbl_tournaments.create_matches is
	'automatic: a match is created as soon as both sides of a fixture are known. manual: the TD creates it when a table is free. Neither restricts what the TD may do by hand.';


-- ─────────────────────────────────────────────────────────────────
-- Who won a fixture
--
-- One answer, in one place, so the bracket page, the resolver and anything
-- later all agree. Returns the winner and the loser as entrant ids — the
-- loser because a third-place playoff and the whole losers' bracket are fed
-- by `loser_of` and would otherwise each work it out again.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_fixture_outcome(p_fixture_id uuid)
returns table (winner_entrant_id uuid, loser_entrant_id uuid, decided boolean, why text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_f    public.tbl_tournament_fixtures%rowtype;
	v_m    public.tbl_matches%rowtype;
	v_home integer;
	v_away integer;
begin
	winner_entrant_id := null;
	loser_entrant_id  := null;
	decided := false;
	why := null;

	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		return next;
		return;
	end if;

	-- Awarded rather than played: a bye, a walkover, a withdrawal, a decision.
	-- There are no frames to count, which is the whole reason this is recorded
	-- on the fixture at all.
	if v_f.advanced_entrant_id is not null then
		winner_entrant_id := v_f.advanced_entrant_id;
		loser_entrant_id := case
			when v_f.advanced_entrant_id = v_f.home_entrant_id then v_f.away_entrant_id
			else v_f.home_entrant_id
		end;
		decided := true;
		why := v_f.advance_reason;
		return next;
		return;
	end if;

	if v_f.match_id is null then
		why := 'not played';
		return next;
		return;
	end if;

	select * into v_m from public.tbl_matches where id = v_f.match_id;

	-- Frames are the only record, so the score is counted here exactly as
	-- tdc_my_matches counts it. Nothing about a result is read from a column.
	select
		count(*) filter (where f.winner_side = 'home'),
		count(*) filter (where f.winner_side = 'away')
	into v_home, v_away
	from public.tbl_frames f
	where f.match_id = v_f.match_id and f.status = 'complete';

	if v_m.status <> 'complete' then
		why := 'in progress';
		return next;
		return;
	end if;

	-- A level match advances nobody. draws_allowed is forced off for knockout
	-- play and tiebreak_method decides it at the table, so this is the case
	-- where the card is finished but the tiebreak has not been recorded —
	-- which the bracket should show rather than guess at.
	if v_home = v_away then
		why := 'level';
		return next;
		return;
	end if;

	if v_home > v_away then
		winner_entrant_id := v_f.home_entrant_id;
		loser_entrant_id  := v_f.away_entrant_id;
	else
		winner_entrant_id := v_f.away_entrant_id;
		loser_entrant_id  := v_f.home_entrant_id;
	end if;
	decided := winner_entrant_id is not null;
	why := case when decided then 'played' else 'played, but the slot is empty' end;
	return next;
end;
$$;

revoke execute on function private.tdc_fixture_outcome(uuid) from public, anon;
grant execute on function private.tdc_fixture_outcome(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Making the match behind a fixture
-- ─────────────────────────────────────────────────────────────────

-- Creates the tbl_matches row for a fixture whose two sides are known, with
-- the tournament's ruleset frozen onto it exactly as tdc_create_match does for
-- a social match. Returns the match id, and returns the existing one rather
-- than a second match if it is called twice.
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
		(select auth.uid()), v_t.venue_id, v_t.rules,
		'player', v_home,
		'player', v_away,
		v_t.sanctioned,
		case when v_t.sanctioned then now() end,
		case when v_t.sanctioned then (select auth.uid()) end
	)
	returning id into v_id;

	update public.tbl_tournament_fixtures set match_id = v_id where id = p_fixture_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_fixture_match(uuid) from public, anon;
grant execute on function public.tdc_create_fixture_match(uuid) to authenticated;


-- Taking a match back off a fixture, which is how a TD undoes a match started
-- against the wrong fixture. The match itself is left alone: it is a real
-- record of frames that were really played, and deleting it is tdc_delete_match's
-- job, asked for explicitly.
create function public.tdc_detach_fixture_match(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tournament uuid;
begin
	select tournament_id into v_tournament
	from public.tbl_tournament_fixtures where id = p_fixture_id;

	if v_tournament is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_tournament(v_tournament) then
		raise exception 'Only the people running this tournament can change the draw.';
	end if;

	update public.tbl_tournament_fixtures set match_id = null where id = p_fixture_id;
end;
$$;

revoke execute on function public.tdc_detach_fixture_match(uuid) from public, anon;
grant execute on function public.tdc_detach_fixture_match(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Resolving the draw
--
-- Walks the bracket from the bottom up, filling every slot whose feeding
-- fixture has been decided, then creating the matches for fixtures that are
-- ready. Both halves obey the tournament's settings, and both are skipped
-- entirely in manual mode.
--
-- Safe to call as often as a page likes: it only ever fills an empty slot
-- that is still fed by the round below. A slot the TD has filled by hand has
-- source_type 'entrant' and is therefore never touched, which is what makes
-- the hand-editing in tdc_set_fixture stick.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_resolve_draw(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t        public.tbl_tournaments%rowtype;
	v_f        record;
	v_out      record;
	v_who      uuid;
	v_advanced integer := 0;
	v_created  integer := 0;
	v_id       uuid;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can resolve the draw.';
	end if;

	if v_t.progression = 'manual' and v_t.create_matches = 'manual' then
		return jsonb_build_object('advanced', 0, 'matches_created', 0, 'note', 'this tournament is run by hand');
	end if;

	-- ─── Fill the slots ───
	-- In round order, so a win in round 1 can reach round 3 in a single pass
	-- rather than needing the page to call this three times.
	if v_t.progression = 'automatic' then
		for v_f in
			select f.id, f.home_source_type, f.home_source_ref, f.home_entrant_id,
				f.away_source_type, f.away_source_ref, f.away_entrant_id
			from public.tbl_tournament_fixtures f
			where f.tournament_id = p_tournament_id
				-- A fixture already being played has its sides settled; filling
				-- one now would contradict the match in progress.
				and f.match_id is null
				and f.advanced_entrant_id is null
			order by f.round, f.position
		loop
			if v_f.home_entrant_id is null
				and v_f.home_source_type in ('winner_of', 'loser_of')
				and v_f.home_source_ref is not null then

				select * into v_out from private.tdc_fixture_outcome(v_f.home_source_ref);
				v_who := case when v_f.home_source_type = 'winner_of'
					then v_out.winner_entrant_id else v_out.loser_entrant_id end;

				if v_out.decided and v_who is not null then
					update public.tbl_tournament_fixtures
					set home_entrant_id = v_who where id = v_f.id;
					v_advanced := v_advanced + 1;
				end if;
			end if;

			if v_f.away_entrant_id is null
				and v_f.away_source_type in ('winner_of', 'loser_of')
				and v_f.away_source_ref is not null then

				select * into v_out from private.tdc_fixture_outcome(v_f.away_source_ref);
				v_who := case when v_f.away_source_type = 'winner_of'
					then v_out.winner_entrant_id else v_out.loser_entrant_id end;

				-- Guards the sides_differ constraint. The same entrant reaching
				-- both slots means the bracket is wired wrong, and a raised
				-- exception here would stop the whole resolve for every other
				-- fixture, so it is left for the page to show as an empty slot.
				if v_out.decided and v_who is not null then
					update public.tbl_tournament_fixtures
					set away_entrant_id = v_who
					where id = v_f.id
						and home_entrant_id is distinct from v_who;
					if found then v_advanced := v_advanced + 1; end if;
				end if;
			end if;
		end loop;
	end if;

	-- ─── Start what is ready ───
	if v_t.create_matches = 'automatic' then
		for v_f in
			select f.id
			from public.tbl_tournament_fixtures f
			where f.tournament_id = p_tournament_id
				and f.match_id is null
				and f.advanced_entrant_id is null
				and f.home_entrant_id is not null
				and f.away_entrant_id is not null
			order by f.round, f.position
		loop
			v_id := public.tdc_create_fixture_match(v_f.id);
			if v_id is not null then v_created := v_created + 1; end if;
		end loop;
	end if;

	return jsonb_build_object('advanced', v_advanced, 'matches_created', v_created);
end;
$$;

revoke execute on function public.tdc_resolve_draw(uuid) from public, anon;
grant execute on function public.tdc_resolve_draw(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Reading the draw, now with results
--
-- Replaces the version from 20261019160000. Same columns plus what the page
-- needs to draw a bracket people can read: the score counted from frames, who
-- won, and whether the card behind it has actually settled.
-- ─────────────────────────────────────────────────────────────────

-- Dropped rather than replaced: this adds columns, and PostgreSQL will not
-- change the return type of an existing function in place.
drop function if exists public.tdc_tournament_draw(uuid);

create function public.tdc_tournament_draw(p_tournament_id uuid)
returns table (
	fixture_id    uuid,
	bracket       text,
	round         integer,
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
	match_status  text,
	home_frames   integer,
	away_frames   integer,
	-- 'agreed', 'awaiting', 'disputed', 'in_progress'. A bracket that advanced
	-- somebody whose opponent is still disputing the card should say so rather
	-- than present it as settled.
	card_state    text,
	winner_entrant_id uuid,
	advanced_entrant_id uuid,
	advance_reason text,
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
		f.match_id, m.status,
		(select count(*)::integer from public.tbl_frames x
			where x.match_id = f.match_id and x.status = 'complete' and x.winner_side = 'home'),
		(select count(*)::integer from public.tbl_frames x
			where x.match_id = f.match_id and x.status = 'complete' and x.winner_side = 'away'),
		case when f.match_id is not null
			then private.tdc_card_state(f.match_id)->>'state' end,
		(select o.winner_entrant_id from private.tdc_fixture_outcome(f.id) o),
		f.advanced_entrant_id, f.advance_reason,
		hf.round, hf.position,
		af.round, af.position
	from public.tbl_tournament_fixtures f
	left join public.tbl_matches m              on m.id = f.match_id
	left join public.tbl_tournament_entrants he on he.id = f.home_entrant_id
	left join public.tbl_players hp             on hp.id = he.player_id
	left join public.tbl_tournament_entrants ae on ae.id = f.away_entrant_id
	left join public.tbl_players ap             on ap.id = ae.player_id
	left join public.tbl_tournament_fixtures hf on hf.id = f.home_source_ref
		and f.home_source_type in ('winner_of', 'loser_of')
	left join public.tbl_tournament_fixtures af on af.id = f.away_source_ref
		and f.away_source_type in ('winner_of', 'loser_of')
	where f.tournament_id = p_tournament_id
	order by f.bracket, f.round, f.position;
$$;

revoke execute on function public.tdc_tournament_draw(uuid) from public, anon;
grant execute on function public.tdc_tournament_draw(uuid) to authenticated;
