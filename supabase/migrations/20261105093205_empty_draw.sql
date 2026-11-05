-- An empty draw: "No one" in the draw page's Who goes in.
--
-- UV, 5 Nov: the matches are made and wired round to round but not filled.
-- The director then puts people into the first round by hand, with the slot
-- picker that already exists (tdc_swap_fixture_player).
--
-- ─── Why nothing else had to change ───
--
-- An empty first-round slot is not a bye. A bye is written as an award
-- (advanced_entrant_id + advance_reason 'bye') at generation; a slot with no
-- source and no award is simply waiting. tdc_resolve_draw only ever fills a
-- slot fed by winner_of / loser_of and only starts a match with both sides
-- known, so it leaves an empty draw alone. Filling a slot by hand gives it
-- source 'entrant', exactly as it does in a populated draw.
--
-- ─── The size ───
--
-- With nobody in it there is nothing to count, so the director says how many
-- first-round places there are (UV: a picker of 4, 8, 16, 32, 64 starting at
-- the tournament's max entrants). Any power of two from 2 to 1024 is accepted
-- here, the same range max_entrants allows; the picker is the page's choice.
--
-- ─── Why the old function is dropped ───
--
-- Two new arguments make a new signature. Left in place, the four-argument
-- version would be a second function by the same name that the page could
-- still reach. Nothing else in the database calls it. The body below is the
-- 20261019160000 text with only the empty-draw branches added.

drop function public.tdc_generate_draw(uuid, boolean, boolean, boolean);

create function public.tdc_generate_draw(
	p_tournament_id  uuid,
	p_confirmed_only boolean default true,
	p_replace        boolean default false,
	-- Confirmation, not permission: required only when matches are attached,
	-- so that redrawing a started tournament is deliberate rather than a
	-- mis-tap. See the body for why nothing is actually lost.
	p_detach_matches boolean default false,
	-- No one goes in: the shape only, every first-round slot empty.
	-- p_confirmed_only is ignored when this is true.
	p_empty          boolean default false,
	-- How many first-round places an empty draw has. Required with p_empty
	-- and refused without it, since a populated draw is sized by its field.
	p_size           integer default null
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

	-- Checked before anything is deleted, so a bad size never costs the TD
	-- the draw they already had.
	if p_empty then
		if p_size is null or p_size < 2 or p_size > 1024 or (p_size & (p_size - 1)) <> 0 then
			raise exception 'An empty draw needs a size of 2, 4, 8, 16 and so on up to 1024, not %.', coalesce(p_size::text, 'none');
		end if;
	elsif p_size is not null then
		raise exception 'TDC (Error): a draw size is only given for an empty draw; a filled one is sized by who goes in.';
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
	if p_empty then
		-- Nobody, so the seeds are left as they are: they describe no draw,
		-- and the TD may still be using them to decide where people go.
		v_n := 0;
	else
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
	end if;

	-- ─── The shape ───
	-- The smallest power of two that holds the field. The difference between
	-- that and the field is the number of byes, and the bracket order puts
	-- them against the top seeds, which is the point of seeding.
	-- An empty draw is the size the TD asked for, checked above.
	if p_empty then
		v_size := p_size;
	else
		v_size := 2;
		while v_size < v_n loop
			v_size := v_size * 2;
		end loop;
	end if;
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
			-- An empty draw's slots are both null and are not byes: nobody
			-- advances, the slot waits for the TD.
			case when not p_empty and (v_home_id is null or v_away_id is null) then 'bye' end
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

	-- How many people went in: 0 for an empty draw.
	return v_n;
end;
$$;

revoke execute on function public.tdc_generate_draw(uuid, boolean, boolean, boolean, boolean, integer) from public, anon;
grant execute on function public.tdc_generate_draw(uuid, boolean, boolean, boolean, boolean, integer) to authenticated;
