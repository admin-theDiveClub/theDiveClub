-- Resetting a league night back to the schedule (UV, 18 Nov).
--
-- The league director needs to undo a night without taking it off the
-- schedule: every score gone, and the night back at lineups, exactly as it
-- stood the moment Start the match was pressed. UV's example: a night signed
-- 9–16 is found to have been played with the wrong lineup.
--
-- What it clears, for the match on the fixture:
--   every frame (and so its players, edit log and accepted discrepancies);
--   both lineups: positions, the squad and both locks;
--   every card event: signatures, disputes, reopenings;
--   the night's notifications, so no tray points at a night that is gone;
--   the referee, the break in play, who broke first, started_at, ended_at;
--   status back to 'scheduled'.
-- What it keeps:
--   the fixture (date, round, tables, venue, match number);
--   the match row itself, so every /leagues/card/?m=<id> link a captain has
--   open or saved keeps working, and its short number with it.
--
-- Decided by UV, 18 Nov (DECISIONS 18 Nov, "Resetting a league night"):
--   a signed night may be reset too (the page asks more firmly, naming the
--   score); the night takes the season's current rules, as a fresh Start
--   would; and a record is kept of who reset it, when, and the score cleared.
--
-- Why the events are deleted rather than left to lapse: a signature counts
-- while its card_version matches the card's, or while the card's content
-- matches the fingerprint it was signed at (private.tdc_card_state). A card
-- emptied and replayed could come back to that content and revive a
-- signature nobody gave tonight. card_version is bumped as well, so nothing
-- a page submits from before the reset is accepted.
--
-- Who: whoever runs the season (private.tdc_can_run_league), as for Start,
-- Take the match off and the lineup unlock.
--
-- The record names the director by account (auth.users), not by player: a
-- director always has an account, and a column referencing tbl_players would
-- have to be added to private.tdc_merge_players (CLAUDE.md §5, idea 9).


-- ─── The record ───

create table public.tbl_league_match_resets (
	id            uuid primary key default gen_random_uuid(),
	reset_at      timestamptz not null default now(),
	reset_by      uuid references auth.users (id) on delete set null,
	match_id      uuid not null references public.tbl_matches (id) on delete cascade,
	fixture_id    uuid references public.tbl_league_fixtures (id) on delete set null,
	-- Counted at the time: the frames are gone afterwards and cannot be
	-- counted again.
	home_frames   integer not null,
	away_frames   integer not null,
	frames        integer not null,
	was_signed    boolean not null,
	-- "Alpha 9 – Bravo 16, 25 frames, signed". Names as they were then.
	summary       text not null
);

create index tbl_league_match_resets_match_idx on public.tbl_league_match_resets (match_id);

comment on table public.tbl_league_match_resets is
	'One row per league night reset to the schedule (tdc_reset_league_match): who, when, and the score cleared. Not shown on any page yet (UV, 18 Nov).';

alter table public.tbl_league_match_resets enable row level security;

-- Written only by tdc_reset_league_match; read by nobody through the API yet.
revoke all on table public.tbl_league_match_resets from public, anon, authenticated;


-- ─── The reset ───

create function public.tdc_reset_league_match(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f      public.tbl_league_fixtures%rowtype;
	v_m      public.tbl_matches%rowtype;
	v_home   text;
	v_away   text;
	v_hs     integer;
	v_as     integer;
	v_frames integer;
	v_signed boolean;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can reset a match.';
	end if;

	if v_f.match_id is null then
		raise exception 'This fixture has not been started, so there is nothing to reset.';
	end if;

	-- Locked against a second reset or a frame landing at the same moment.
	select * into v_m from public.tbl_matches where id = v_f.match_id for update;

	-- Everything worth keeping, gathered while it still exists.
	select name into v_home from public.tbl_teams where id = v_f.home_team_id;
	select name into v_away from public.tbl_teams where id = v_f.away_team_id;
	select count(*) filter (where status = 'complete' and winner_side = 'home'),
		count(*) filter (where status = 'complete' and winner_side = 'away'),
		count(*)
		into v_hs, v_as, v_frames
	from public.tbl_frames where match_id = v_m.id;
	v_signed := v_m.status = 'complete';

	insert into public.tbl_league_match_resets
		(reset_by, match_id, fixture_id, home_frames, away_frames, frames, was_signed, summary)
	values (
		(select auth.uid()), v_m.id, v_f.id, v_hs, v_as, v_frames, v_signed,
		coalesce(v_home, 'Home') || ' ' || v_hs || ' – ' || coalesce(v_away, 'Away') || ' ' || v_as
			|| ', ' || v_frames || ' frame' || case when v_frames = 1 then '' else 's' end
			|| case when v_signed then ', signed' else '' end
	);

	-- Past the locked-card and rank guards on tbl_frames, as tdc_delete_match.
	perform set_config('tdc.card_unlock', 'on', true);

	delete from public.tbl_match_events        where match_id = v_m.id;
	delete from public.tbl_frame_change_accept where match_id = v_m.id;
	delete from public.tbl_frames              where match_id = v_m.id;   -- participants cascade
	-- After the frames: deleting them writes log rows of its own.
	delete from public.tbl_frame_edit          where match_id = v_m.id;
	delete from public.tbl_league_match_order  where match_id = v_m.id;
	delete from public.tbl_league_match_squad  where match_id = v_m.id;
	delete from public.tbl_league_match_sides  where match_id = v_m.id;
	delete from public.tbl_match_result_override where match_id = v_m.id;
	delete from public.tbl_notifications       where match_id = v_m.id;

	update public.tbl_matches set
		status                     = 'scheduled',
		started_at                 = null,
		ended_at                   = null,
		first_break_side           = null,
		referee_player_id          = null,
		break_in_play              = null,
		break_in_play_frame_no     = null,
		break_in_play_card_version = null,
		scheduled_at               = v_f.scheduled_at,
		-- The season's rules now, as tdc_create_league_match freezes them.
		rules                      = private.tdc_rules_for_league_season(v_f.league_season_id),
		card_version               = card_version + 1
	where id = v_m.id;

	perform set_config('tdc.card_unlock', 'off', true);
end;
$$;

revoke execute on function public.tdc_reset_league_match(uuid) from public, anon;
grant  execute on function public.tdc_reset_league_match(uuid) to authenticated;
