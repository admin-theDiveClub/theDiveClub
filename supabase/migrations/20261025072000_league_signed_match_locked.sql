-- A match both captains have signed stays on its fixture (UV, 25 Oct).
--
--   On 24 Oct UV signed TEAM B v TEAM C (UI Fixes) for both sides, then, as
--   the league director, pressed "Take the match off" on the finished
--   fixture. The match and its 25 frames were kept, as the function promises,
--   but the fixture was left with no match, and pressing Start made a new,
--   empty one that asked for the lineups again.
--
--   UV: once both captains have signed, the night is locked. Even moving its
--   date must not ask for the lineups again, and anything sensitive belongs on
--   the LD's approvals page (not built), not on the fixtures page.
--
--   tdc_detach_league_match   refuses a match whose status is complete (it is
--                             set only when both signatures land).
--   tdc_clear_league_fixtures refuses while any of the season's fixtures holds
--                             one, so regenerating or clearing the schedule
--                             cannot unhook a signed night either.
--
-- Both are patched from their text in 20261022210000: the guard and its
-- comment only. Same arguments, so replaced in place; their grants stand.
--
-- Then the repair of 24 Oct's night, written so it acts only on those rows in
-- exactly that state and does nothing anywhere else (the local copy has none
-- of them):
--   the signed match 905d6285 goes back on fixture 0719b3b8, in place of the
--   empty match 2e6ed6b0 that Start made at 22:20;
--   2e6ed6b0 and 36a70507 (an empty match left off the schedule when the
--   fixtures were regenerated at 19:45) are deleted, only while neither has
--   a frame, an event, a squad, an order or a locked side, and neither is on
--   a fixture.

create or replace function public.tdc_detach_league_match(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f public.tbl_league_fixtures%rowtype;
begin
	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can take a match off a fixture.';
	end if;

	-- A night both captains have signed is finished (UV, 25 Oct). Off its
	-- fixture, the schedule would offer to start it again and ask for the
	-- lineups of a night already played.
	if exists (select 1 from public.tbl_matches where id = v_f.match_id and status = 'complete') then
		raise exception 'Both captains have signed this match, so it stays on its fixture.';
	end if;

	-- The match is kept. It stops being part of the schedule, which is what a
	-- director wants when a night was set up against the wrong teams; deleting
	-- the record of frames that were played is never what they want.
	update public.tbl_league_fixtures set match_id = null where id = p_fixture_id;
end;
$$;

create or replace function public.tdc_clear_league_fixtures(
	p_league_season_id uuid,
	p_detach_matches   boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_n      integer;
	v_played integer;
	v_signed integer;
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can clear its fixtures.';
	end if;

	-- A signed night stays on its fixture (UV, 25 Oct), so a schedule holding
	-- one cannot be cleared or replaced, confirmed or not.
	select count(*) into v_signed
	from public.tbl_league_fixtures f
	join public.tbl_matches m on m.id = f.match_id
	where f.league_season_id = p_league_season_id and m.status = 'complete';

	if v_signed > 0 then
		raise exception
			'% signed by both captains, so the schedule cannot be cleared or replaced. Add, move or remove the fixtures still to play instead.',
			case when v_signed = 1 then 'One match has been' else v_signed || ' matches have been' end;
	end if;

	select count(*) into v_played
	from public.tbl_league_fixtures
	where league_season_id = p_league_season_id and match_id is not null;

	-- Same shape as tdc_clear_draw: the matches are kept, but they stop being
	-- part of a schedule, and that is worth being asked about once.
	if v_played > 0 and not p_detach_matches then
		raise exception
			'This season has already started: % % attached to the fixtures. Clearing keeps % (nothing is deleted) but takes the schedule away. Confirm to go ahead.',
			v_played,
			case when v_played = 1 then 'match is' else 'matches are' end,
			case when v_played = 1 then 'it' else 'them' end;
	end if;

	delete from public.tbl_league_fixtures where league_season_id = p_league_season_id;
	get diagnostics v_n = row_count;
	return v_n;
end;
$$;

-- ── The repair of 24 Oct ──

update public.tbl_league_fixtures
set match_id = '905d6285-19bf-473a-8a31-26e8f6846447'
where id = '0719b3b8-4d0d-4f20-b9c8-331b98534ede'
	and match_id = '2e6ed6b0-fc72-4664-b151-d4bcc981914c'
	and exists (
		select 1 from public.tbl_matches
		where id = '905d6285-19bf-473a-8a31-26e8f6846447' and status = 'complete')
	and not exists (
		select 1 from public.tbl_league_fixtures
		where match_id = '905d6285-19bf-473a-8a31-26e8f6846447');

delete from public.tbl_matches m
where m.id in ('2e6ed6b0-fc72-4664-b151-d4bcc981914c', '36a70507-4bd1-46dd-a192-0757c5a1fdd0')
	and m.status = 'scheduled'
	and not exists (select 1 from public.tbl_frames where match_id = m.id)
	and not exists (select 1 from public.tbl_match_events where match_id = m.id)
	and not exists (select 1 from public.tbl_league_match_squad where match_id = m.id)
	and not exists (select 1 from public.tbl_league_match_order where match_id = m.id)
	and not exists (select 1 from public.tbl_league_match_sides where match_id = m.id)
	and not exists (select 1 from public.tbl_league_fixtures where match_id = m.id);
