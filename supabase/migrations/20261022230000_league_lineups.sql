-- Leagues step 4: squads, lineups, and the frames that come out of them.
--
-- A team league night is a flat list of frames, each its own race-to-one
-- between two named players. There is no "rubber" or sub-match: the slot
-- identifies the contest, which is why the design dropped the contest_no it
-- first proposed — it would have duplicated what the slot already says.
--
-- Three things happen, in order:
--
--   1. **The squad.** Who is available tonight, from each team's roster. Open
--      — anybody can see it — and editable right up to the end, because
--      somebody always drops out at six o'clock.
--   2. **The order.** Which of them plays which slot. A **blind exchange**:
--      neither captain sees the other's order until both have locked. That is
--      the whole point, and it is enforced in the read function rather than
--      in a page, because a page is not a place to keep a secret.
--   3. **The lock.** When the second side locks, the frames are created. Both
--      sides filled gives a real frame with its two players; one side filled
--      gives a walkover to whoever showed up; neither gives **no frame at
--      all** — the slot simply vanishes.
--
-- Submitting a lineup is confirming participation for the night, even a
-- partial one. That deliberately fixes a real pain point in existing leagues,
-- where confirmation is a separate step everybody ignores.
--
-- ── What this reuses rather than building ──
--
-- `tbl_frame_participants` already exists, already carries (frame, side,
-- player, play_order), and is already understood by tdc_record_frame,
-- tdc_can_edit_match, tdc_my_matches and the walk-in merge. It was built for
-- exactly this and needed nothing. `by_schedule` likewise: it has been an
-- allowed break rule since the tournament work, and
-- private.tdc_break_side_for_frame already returns null for it — nothing is
-- derived, which is right, because winner_breaks and loser_breaks cannot be
-- derived in team play at all, where frame 4 routinely finishes before frame 3.

-- ── A frame that exists but has not been played ──
--
-- Until now a frame row meant a frame that had at least started, and the three
-- statuses said so. The card of a team night is a grid that exists from the
-- moment the lineups lock, so it needs a fourth: the slot is real, the two
-- players are known, nobody has played it yet.
--
-- Only a team match ever has one. Everything that counts a score already asks
-- for status = 'complete', so a pending frame contributes nothing to anybody's
-- total; what it does is give the scorecard a row to write into.
alter table public.tbl_frames drop constraint tbl_frames_status_check;
alter table public.tbl_frames add constraint tbl_frames_status_check
	check (status in ('pending', 'in_progress', 'complete', 'abandoned'));

-- Which contest on the sheet this frame is. Null for a singles match, where
-- the match's own two players are the only ones there are.
--
-- It is not the same as frame_no and must not be confused with it: frame_no is
-- the order frames are played in and is what strict_frame_order governs, while
-- lineup_slot is the row of the printed sheet. They come apart the moment a
-- slot vanishes because neither captain filled it.
alter table public.tbl_frames add column lineup_slot integer check (lineup_slot >= 1);

comment on column public.tbl_frames.lineup_slot is
	'Team play: which slot of the lineup this frame is. Null in a singles match. Not frame_no — a vanished slot makes them differ.';

-- ── The squad ──

create table public.tbl_league_match_squad (
	id         uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	added_by   uuid references auth.users (id) on delete set null,

	match_id   uuid not null references public.tbl_matches (id) on delete cascade,
	side       text not null check (side in ('home', 'away')),
	player_id  uuid not null references public.tbl_players (id) on delete cascade,

	-- One player is available once, for one side. Somebody cannot be in both
	-- squads even if they are somehow on both rosters.
	constraint tbl_league_match_squad_once unique (match_id, player_id)
);

create index tbl_league_match_squad_match_idx on public.tbl_league_match_squad (match_id, side);

comment on table public.tbl_league_match_squad is
	'Who is available for a team match tonight. Open to read. Editable after the lineups lock, because a reserve changes a frame''s participant rather than creating one.';

-- ── The order ──

create table public.tbl_league_match_order (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	set_by      uuid references auth.users (id) on delete set null,

	match_id    uuid not null references public.tbl_matches (id) on delete cascade,
	side        text not null check (side in ('home', 'away')),
	lineup_slot integer not null check (lineup_slot >= 1),

	-- Null is a slot the captain has deliberately left empty. A slot nobody
	-- has touched has no row at all; both mean the same thing at lock, and
	-- keeping the row lets a captain clear one without it looking untouched.
	player_id   uuid references public.tbl_players (id) on delete set null,

	constraint tbl_league_match_order_one_per_slot unique (match_id, side, lineup_slot)
);

-- One player cannot be in two slots for the same side. A partial index because
-- an empty slot is null and nulls do not collide.
create unique index tbl_league_match_order_once_per_side
	on public.tbl_league_match_order (match_id, side, player_id)
	where player_id is not null;

comment on table public.tbl_league_match_order is
	'Which player takes which slot. A blind exchange: tdc_match_lineup hides the other side until both have locked.';

-- ── The lock ──

create table public.tbl_league_match_sides (
	match_id  uuid not null references public.tbl_matches (id) on delete cascade,
	side      text not null check (side in ('home', 'away')),
	locked_at timestamptz,
	locked_by uuid references auth.users (id) on delete set null,
	-- Set when the cutoff locked this side rather than a person, so the card
	-- can say why a side conceded without anybody having to remember.
	by_cutoff boolean not null default false,

	primary key (match_id, side)
);

comment on table public.tbl_league_match_sides is
	'Per side of a team match: whether the lineup is locked, when, and whether the cutoff did it rather than a captain.';

-- All three are readable by any signed-in player and written only through the
-- functions below. The order table is readable too, and that is deliberate:
-- the blind exchange is enforced by tdc_match_lineup, so a direct select would
-- show an opponent's order. See the note on RLS below, which closes it.
alter table public.tbl_league_match_squad enable row level security;
alter table public.tbl_league_match_order enable row level security;
alter table public.tbl_league_match_sides enable row level security;

create policy "Signed-in users can see a match squad"
	on public.tbl_league_match_squad for select to authenticated using (true);

create policy "Signed-in users can see lineup locks"
	on public.tbl_league_match_sides for select to authenticated using (true);

grant select on public.tbl_league_match_squad to authenticated;
grant select on public.tbl_league_match_sides to authenticated;
grant select, insert, update, delete on public.tbl_league_match_squad   to service_role;
grant select, insert, update, delete on public.tbl_league_match_order   to service_role;
grant select, insert, update, delete on public.tbl_league_match_sides   to service_role;

-- **tbl_league_match_order has RLS on, no policy and no grant.** It is the one
-- table here that holds a secret: an opponent's order before the lock. A
-- select policy clever enough to hide it would have to re-implement the lock
-- rule, and then the rule would live in two places. So nothing reads it but
-- the functions, exactly as tbl_league_season_entrants is closed because it
-- carries payment.

-- ── Who may do what ──

-- The side this account captains in this match, or null. One place answers it,
-- because every function below starts by asking.
create function private.tdc_league_match_side(p_match_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
	select case
		when exists (
			select 1 from public.tbl_matches m
			join public.tbl_league_season_entrants e on e.team_id = m.home_team_id
			join public.tbl_players p on p.id = e.player_id
			where m.id = p_match_id and e.is_captain and e.status = 'active'
				and e.confirmed_at is not null and p.user_id = (select auth.uid())
		) then 'home'
		when exists (
			select 1 from public.tbl_matches m
			join public.tbl_league_season_entrants e on e.team_id = m.away_team_id
			join public.tbl_players p on p.id = e.player_id
			where m.id = p_match_id and e.is_captain and e.status = 'active'
				and e.confirmed_at is not null and p.user_id = (select auth.uid())
		) then 'away'
	end;
$$;

-- The league season a match belongs to, by way of its fixture. A team match
-- that is not on a fixture belongs to no league, and nothing here applies.
create function private.tdc_league_season_of_match(p_match_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
	select league_season_id from public.tbl_league_fixtures where match_id = p_match_id;
$$;

-- A captain may set their own side. The league director may set either, which
-- is principle 8: a director has to be able to run the whole night alone.
create function private.tdc_can_set_lineup(p_match_id uuid, p_side text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_league_match_side(p_match_id) = p_side
		or coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false);
$$;

revoke execute on function private.tdc_league_match_side(uuid) from public, anon;
revoke execute on function private.tdc_league_season_of_match(uuid) from public, anon;
revoke execute on function private.tdc_can_set_lineup(uuid, text) from public, anon;
grant execute on function private.tdc_league_match_side(uuid) to authenticated;
grant execute on function private.tdc_league_season_of_match(uuid) to authenticated;
grant execute on function private.tdc_can_set_lineup(uuid, text) to authenticated;

-- How many slots this match has. The ruleset's target under fixed_frames,
-- which is what the design says a team match wants; otherwise whatever the
-- captains have actually used, so a league set up some other way still works
-- rather than refusing at the worst moment.
create function private.tdc_lineup_slots(p_match_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select greatest(
		coalesce((
			select case when m.rules->>'win_condition_type' = 'fixed_frames'
				then (m.rules->>'win_condition_target')::integer end
			from public.tbl_matches m where m.id = p_match_id
		), 0),
		coalesce((
			select max(lineup_slot) from public.tbl_league_match_order where match_id = p_match_id
		), 0)
	);
$$;

revoke execute on function private.tdc_lineup_slots(uuid) from public, anon;
grant execute on function private.tdc_lineup_slots(uuid) to authenticated;

-- The guard every writer starts with: a team match, on a fixture, not yet
-- played out from under them.
create function private.tdc_lineup_match(p_match_id uuid)
returns public.tbl_matches
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_m public.tbl_matches%rowtype;
begin
	select * into v_m from public.tbl_matches where id = p_match_id;
	if v_m.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;
	if v_m.home_side_kind <> 'team' or v_m.away_side_kind <> 'team' then
		raise exception 'This is not a team match, so it has no lineup.';
	end if;
	if private.tdc_league_season_of_match(p_match_id) is null then
		raise exception 'This team match is not on a league fixture, so there is nothing to build a lineup from.';
	end if;
	return v_m;
end;
$$;

revoke execute on function private.tdc_lineup_match(uuid) from public, anon;
grant execute on function private.tdc_lineup_match(uuid) to authenticated;

-- ── The squad ──

create function public.tdc_set_match_squad(
	p_match_id  uuid,
	p_player_id uuid,
	p_available boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_m    public.tbl_matches%rowtype;
	v_ls   uuid;
	v_team uuid;
	v_side text;
begin
	v_m  := private.tdc_lineup_match(p_match_id);
	v_ls := private.tdc_league_season_of_match(p_match_id);

	-- The side follows from the player's team, not from who is asking. A
	-- captain cannot put somebody in the wrong squad by accident, and the
	-- director does not have to say which side they meant.
	select team_id into v_team
	from public.tbl_league_season_entrants
	where league_season_id = v_ls and player_id = p_player_id
		and status = 'active' and confirmed_at is not null;

	if v_team is null then
		raise exception 'That player is not an active, confirmed player in this league.';
	end if;

	v_side := case v_team when v_m.home_team_id then 'home' when v_m.away_team_id then 'away' end;
	if v_side is null then
		raise exception 'That player is not on either of the teams playing this match.';
	end if;

	if not private.tdc_can_set_lineup(p_match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can change its squad.';
	end if;

	if coalesce(p_available, true) then
		insert into public.tbl_league_match_squad (added_by, match_id, side, player_id)
		values ((select auth.uid()), p_match_id, v_side, p_player_id)
		on conflict (match_id, player_id) do nothing;
	else
		-- Taking somebody out of the squad takes them out of the order with
		-- it: a slot held by a player who is not there is how a side arrives
		-- at the table a man short without anybody noticing.
		update public.tbl_league_match_order
		set player_id = null
		where match_id = p_match_id and player_id = p_player_id;

		delete from public.tbl_league_match_squad
		where match_id = p_match_id and player_id = p_player_id;
	end if;
end;
$$;

revoke execute on function public.tdc_set_match_squad(uuid, uuid, boolean) from public, anon;
grant execute on function public.tdc_set_match_squad(uuid, uuid, boolean) to authenticated;

-- ── The order ──

create function public.tdc_set_lineup_slot(
	p_match_id    uuid,
	p_lineup_slot integer,
	p_player_id   uuid default null,
	p_side        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_m      public.tbl_matches%rowtype;
	v_side   text;
	v_locked timestamptz;
	v_slots  integer;
begin
	v_m := private.tdc_lineup_match(p_match_id);

	-- A captain's own side by default; the director has to say which.
	v_side := coalesce(p_side, private.tdc_league_match_side(p_match_id));
	if v_side is null then
		raise exception 'Say which side this is for. You do not captain either team in this match.';
	end if;
	if v_side not in ('home', 'away') then
		raise exception 'TDC (Error): side must be home or away, not "%".', v_side;
	end if;
	if not private.tdc_can_set_lineup(p_match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can set its lineup.';
	end if;

	select locked_at into v_locked
	from public.tbl_league_match_sides where match_id = p_match_id and side = v_side;

	-- What locks is the order. A reserve after the lock changes a frame's
	-- participant instead, which is a different act on a different table.
	if v_locked is not null then
		raise exception 'That lineup is locked. A change now is a reserve on the night, not a new order.';
	end if;

	v_slots := private.tdc_lineup_slots(p_match_id);
	if p_lineup_slot is null or p_lineup_slot < 1 then
		raise exception 'TDC (Error): a slot number starts at 1.';
	end if;
	if v_slots > 0 and p_lineup_slot > v_slots then
		raise exception 'This match has % slots, so there is no slot %.', v_slots, p_lineup_slot;
	end if;

	if p_player_id is not null then
		if not exists (
			select 1 from public.tbl_league_match_squad
			where match_id = p_match_id and side = v_side and player_id = p_player_id
		) then
			raise exception 'That player is not in the squad for tonight. Add them to the squad first.';
		end if;

		-- A player in two slots is the one mistake that cannot be played.
		update public.tbl_league_match_order
		set player_id = null
		where match_id = p_match_id and side = v_side
			and player_id = p_player_id and lineup_slot <> p_lineup_slot;
	end if;

	insert into public.tbl_league_match_order (set_by, match_id, side, lineup_slot, player_id)
	values ((select auth.uid()), p_match_id, v_side, p_lineup_slot, p_player_id)
	on conflict (match_id, side, lineup_slot)
		do update set player_id = excluded.player_id, set_by = excluded.set_by;
end;
$$;

revoke execute on function public.tdc_set_lineup_slot(uuid, integer, uuid, text) from public, anon;
grant execute on function public.tdc_set_lineup_slot(uuid, integer, uuid, text) to authenticated;

-- ── Creating the frames ──
--
-- Called when the second side locks, and once only. The three-way rule is the
-- design's: both filled is a frame, one filled is a walkover, neither is
-- nothing at all.
--
-- A vanished slot shrinks the card, which is why a team match wants
-- fixed_frames and "most frames wins" rather than a race to a number that may
-- no longer be reachable.
create function private.tdc_materialise_lineup_frames(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_slots integer;
	v_slot  integer;
	v_home  uuid;
	v_away  uuid;
	v_no    integer := 0;
	v_id    uuid;
begin
	-- Both sides have to be in before anything is written.
	if (select count(*) from public.tbl_league_match_sides
		where match_id = p_match_id and locked_at is not null) < 2 then
		return 0;
	end if;

	-- Idempotent: a second lock, or a cutoff arriving after one, finds the
	-- frames already there and leaves them alone.
	if exists (select 1 from public.tbl_frames where match_id = p_match_id) then
		return 0;
	end if;

	v_slots := private.tdc_lineup_slots(p_match_id);

	for v_slot in 1 .. v_slots loop
		select player_id into v_home from public.tbl_league_match_order
		where match_id = p_match_id and side = 'home' and lineup_slot = v_slot;
		select player_id into v_away from public.tbl_league_match_order
		where match_id = p_match_id and side = 'away' and lineup_slot = v_slot;

		-- Neither side filled it: no frame. The slot vanishes.
		if v_home is null and v_away is null then
			continue;
		end if;

		v_no := v_no + 1;

		if v_home is not null and v_away is not null then
			insert into public.tbl_frames (match_id, frame_no, lineup_slot, status)
			values (p_match_id, v_no, v_slot, 'pending')
			returning id into v_id;

			insert into public.tbl_frame_participants (frame_id, side, player_id)
			values (v_id, 'home', v_home), (v_id, 'away', v_away);
		else
			-- One side showed up. The frame is over before it starts, and the
			-- card says why: won by default.
			insert into public.tbl_frames
				(match_id, frame_no, lineup_slot, status, winner_side, result_event, ended_at)
			values (p_match_id, v_no, v_slot, 'complete',
				case when v_home is not null then 'home' else 'away' end, 'default', now())
			returning id into v_id;

			insert into public.tbl_frame_participants (frame_id, side, player_id)
			values (v_id,
				case when v_home is not null then 'home' else 'away' end,
				coalesce(v_home, v_away));
		end if;
	end loop;

	update public.tbl_matches
	set card_version = card_version + 1,
		status = case when status = 'scheduled' then 'in_progress' else status end,
		started_at = coalesce(started_at, now())
	where id = p_match_id;

	return v_no;
end;
$$;

revoke execute on function private.tdc_materialise_lineup_frames(uuid) from public, anon;

-- ── Locking ──

create function public.tdc_lock_lineup(p_match_id uuid, p_side text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_m      public.tbl_matches%rowtype;
	v_side   text;
	v_other  text;
	v_ls     uuid;
	v_me     uuid := private.tdc_me();
	v_made   integer;
	v_name   text;
begin
	v_m    := private.tdc_lineup_match(p_match_id);
	v_side := coalesce(p_side, private.tdc_league_match_side(p_match_id));

	if v_side is null then
		raise exception 'Say which side this is for. You do not captain either team in this match.';
	end if;
	if not private.tdc_can_set_lineup(p_match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can lock its lineup.';
	end if;

	if exists (select 1 from public.tbl_league_match_sides
		where match_id = p_match_id and side = v_side and locked_at is not null) then
		return 0;   -- already in; locking twice is not an error
	end if;

	insert into public.tbl_league_match_sides (match_id, side, locked_at, locked_by)
	values (p_match_id, v_side, now(), (select auth.uid()))
	on conflict (match_id, side)
		do update set locked_at = now(), locked_by = (select auth.uid());

	-- The other captain is told, which is the design's manually triggered
	-- notification: it goes out because somebody locked, not on a timer.
	v_other := case v_side when 'home' then 'away' else 'home' end;
	v_ls    := private.tdc_league_season_of_match(p_match_id);

	select t.name into v_name from public.tbl_teams t
	where t.id = case v_side when 'home' then v_m.home_team_id else v_m.away_team_id end;

	perform private.tdc_notify(e.player_id, 'league', 'lineup_locked',
		coalesce(v_name, 'The other team') || ' have put their lineup in',
		'Lock yours to see it and start the night.',
		'/leagues/fixtures/?s=' || v_ls::text, p_match_id, null, v_me)
	from public.tbl_league_season_entrants e
	where e.team_id = case v_other when 'home' then v_m.home_team_id else v_m.away_team_id end
		and e.is_captain and e.status = 'active';

	v_made := private.tdc_materialise_lineup_frames(p_match_id);
	return v_made;
end;
$$;

revoke execute on function public.tdc_lock_lineup(uuid, text) from public, anon;
grant execute on function public.tdc_lock_lineup(uuid, text) to authenticated;

-- Unlocking, for the director only, and only while it still means anything.
-- Once the frames exist the night has started and the way back is a reserve or
-- a correction, not a new order.
create function public.tdc_unlock_lineup(p_match_id uuid, p_side text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform private.tdc_lineup_match(p_match_id);

	if not coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false) then
		raise exception 'Only the league director can unlock a lineup.';
	end if;

	if exists (select 1 from public.tbl_frames where match_id = p_match_id) then
		raise exception 'The frames are already set for this match. Change a player on the frame instead.';
	end if;

	update public.tbl_league_match_sides
	set locked_at = null, locked_by = null, by_cutoff = false
	where match_id = p_match_id and side = p_side;
end;
$$;

revoke execute on function public.tdc_unlock_lineup(uuid, text) from public, anon;
grant execute on function public.tdc_unlock_lineup(uuid, text) to authenticated;

-- ── The cutoff ──
--
-- Past lineup_cutoff_hours before the match, a side that has not locked is
-- locked where it stands — with nothing in it, if that is what they have, in
-- which case they concede every slot to the side that did turn up.
--
-- Evaluated lazily, when somebody opens the match, so there is no scheduled
-- job to go wrong. It is a separate call rather than something a read does
-- quietly, because it writes.
create function public.tdc_apply_lineup_cutoff(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_m     public.tbl_matches%rowtype;
	v_hours integer;
	v_side  text;
	v_n     integer := 0;
begin
	v_m := private.tdc_lineup_match(p_match_id);

	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	v_hours := private.tdc_lineup_cutoff_hours(v_m.rules);

	-- No cutoff set, or no date to count back from, so nothing can be late.
	if v_hours <= 0 or v_m.scheduled_at is null then
		return 0;
	end if;

	if now() < v_m.scheduled_at - (v_hours * interval '1 hour') then
		return 0;
	end if;

	foreach v_side in array array['home', 'away'] loop
		if not exists (select 1 from public.tbl_league_match_sides
			where match_id = p_match_id and side = v_side and locked_at is not null) then

			insert into public.tbl_league_match_sides (match_id, side, locked_at, by_cutoff)
			values (p_match_id, v_side, now(), true)
			on conflict (match_id, side)
				do update set locked_at = now(), by_cutoff = true;
			v_n := v_n + 1;
		end if;
	end loop;

	if v_n > 0 then
		perform private.tdc_materialise_lineup_frames(p_match_id);
	end if;

	return v_n;
end;
$$;

revoke execute on function public.tdc_apply_lineup_cutoff(uuid) from public, anon;
grant execute on function public.tdc_apply_lineup_cutoff(uuid) to authenticated;

-- ── Reading ──

create function public.tdc_match_squad(p_match_id uuid)
returns table (
	side         text,
	player_id    uuid,
	display_name text,
	in_order     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	select s.side, p.id, p.display_name,
		exists (
			select 1 from public.tbl_league_match_order o
			where o.match_id = s.match_id and o.player_id = p.id
		)
	from public.tbl_league_match_squad s
	join public.tbl_players p on p.id = s.player_id
	where (select auth.uid()) is not null and s.match_id = p_match_id
	order by s.side, p.display_name;
$$;

revoke execute on function public.tdc_match_squad(uuid) from public, anon;
grant execute on function public.tdc_match_squad(uuid) to authenticated;

-- The blind exchange lives here. Your own side always; the other side only
-- once both have locked. The order table has no policy and no grant, so this
-- is the only way to read it and the rule cannot be gone around.
create function public.tdc_match_lineup(p_match_id uuid)
returns table (
	lineup_slot  integer,
	side         text,
	player_id    uuid,
	display_name text,
	locked       boolean,
	hidden       boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_mine  text;
	v_runs  boolean;
	v_both  boolean;
	v_slots integer;
begin
	if (select auth.uid()) is null then
		return;
	end if;
	if not exists (select 1 from public.tbl_matches where id = p_match_id) then
		return;
	end if;

	v_mine := private.tdc_league_match_side(p_match_id);
	v_runs := coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false);
	v_both := (select count(*) from public.tbl_league_match_sides
		where match_id = p_match_id and locked_at is not null) >= 2;
	v_slots := private.tdc_lineup_slots(p_match_id);

	-- Every slot of both sides comes back, so a captain sees the shape of the
	-- night rather than only the rows somebody has filled. What is withheld is
	-- the name.
	return query
		select g.slot, g.side,
			case when v_both or v_runs or g.side = v_mine then o.player_id end,
			case when v_both or v_runs or g.side = v_mine then p.display_name end,
			s.locked_at is not null,
			-- True where there is somebody in the slot and you are not allowed
			-- to know who yet. An empty slot is not a secret.
			not (v_both or v_runs or g.side = v_mine) and o.player_id is not null
		from (
			select gs.slot, sides.side
			from generate_series(1, greatest(v_slots, 1)) gs(slot)
			cross join (values ('home'), ('away')) sides(side)
		) g
		left join public.tbl_league_match_order o
			on o.match_id = p_match_id and o.side = g.side and o.lineup_slot = g.slot
		left join public.tbl_players p on p.id = o.player_id
		left join public.tbl_league_match_sides s
			on s.match_id = p_match_id and s.side = g.side
		order by g.slot, g.side;
end;
$$;

revoke execute on function public.tdc_match_lineup(uuid) from public, anon;
grant execute on function public.tdc_match_lineup(uuid) to authenticated;

-- Where the night has got to, for whoever is looking at it.
create function public.tdc_lineup_state(p_match_id uuid)
returns table (
	my_side        text,
	i_run_it       boolean,
	slots          integer,
	home_locked    boolean,
	away_locked    boolean,
	home_by_cutoff boolean,
	away_by_cutoff boolean,
	frames_made    integer,
	cutoff_hours   integer,
	cutoff_at      timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_league_match_side(p_match_id),
		coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false),
		private.tdc_lineup_slots(p_match_id),
		coalesce((select locked_at is not null from public.tbl_league_match_sides
			where match_id = p_match_id and side = 'home'), false),
		coalesce((select locked_at is not null from public.tbl_league_match_sides
			where match_id = p_match_id and side = 'away'), false),
		coalesce((select by_cutoff from public.tbl_league_match_sides
			where match_id = p_match_id and side = 'home'), false),
		coalesce((select by_cutoff from public.tbl_league_match_sides
			where match_id = p_match_id and side = 'away'), false),
		(select count(*)::integer from public.tbl_frames where match_id = p_match_id),
		private.tdc_lineup_cutoff_hours(m.rules),
		case when private.tdc_lineup_cutoff_hours(m.rules) > 0 and m.scheduled_at is not null
			then m.scheduled_at - (private.tdc_lineup_cutoff_hours(m.rules) * interval '1 hour') end
	from public.tbl_matches m
	where m.id = p_match_id and (select auth.uid()) is not null;
$$;

revoke execute on function public.tdc_lineup_state(uuid) from public, anon;
grant execute on function public.tdc_lineup_state(uuid) to authenticated;

-- The card of the night: every frame with the two people in it. This is what
-- the captain's scorecard will be built on in step 6.
create function public.tdc_match_card(p_match_id uuid)
returns table (
	frame_id     uuid,
	frame_no     integer,
	lineup_slot  integer,
	status       text,
	home_player  text,
	away_player  text,
	break_side   text,
	winner_side  text,
	result_event text
)
language sql
stable
security definer
set search_path = ''
as $$
	select f.id, f.frame_no, f.lineup_slot, f.status,
		(select p.display_name from public.tbl_frame_participants fp
			join public.tbl_players p on p.id = fp.player_id
			where fp.frame_id = f.id and fp.side = 'home' limit 1),
		(select p.display_name from public.tbl_frame_participants fp
			join public.tbl_players p on p.id = fp.player_id
			where fp.frame_id = f.id and fp.side = 'away' limit 1),
		f.break_side, f.winner_side, f.result_event
	from public.tbl_frames f
	where (select auth.uid()) is not null and f.match_id = p_match_id
	order by f.frame_no;
$$;

revoke execute on function public.tdc_match_card(uuid) from public, anon;
grant execute on function public.tdc_match_card(uuid) to authenticated;

-- ── The reserve ──
--
-- After the lock, a change of player is a change to a frame, not to an order.
-- The frame stays, its slot stays, and somebody else plays it.
create function public.tdc_swap_frame_player(
	p_frame_id  uuid,
	p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_f    public.tbl_frames%rowtype;
	v_side text;
	v_m    public.tbl_matches%rowtype;
	v_ls   uuid;
	v_team uuid;
begin
	select * into v_f from public.tbl_frames where id = p_frame_id;
	if v_f.id is null then
		raise exception 'TDC (Error): frame % not found.', p_frame_id;
	end if;

	v_m  := private.tdc_lineup_match(v_f.match_id);
	v_ls := private.tdc_league_season_of_match(v_f.match_id);

	if v_f.status = 'complete' or v_f.status = 'abandoned' then
		raise exception 'That frame is already settled. Changing who played it is a correction, not a reserve.';
	end if;

	-- Which side the new player is on decides which seat they take, so a
	-- captain cannot put their own player into the opposition's.
	select team_id into v_team
	from public.tbl_league_season_entrants
	where league_season_id = v_ls and player_id = p_player_id
		and status = 'active' and confirmed_at is not null;

	v_side := case v_team when v_m.home_team_id then 'home' when v_m.away_team_id then 'away' end;
	if v_side is null then
		raise exception 'That player is not on either of the teams playing this match.';
	end if;

	if not private.tdc_can_set_lineup(v_f.match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can put a reserve in.';
	end if;

	if exists (select 1 from public.tbl_frame_participants
		where frame_id = p_frame_id and player_id = p_player_id) then
		return;
	end if;

	delete from public.tbl_frame_participants where frame_id = p_frame_id and side = v_side;
	insert into public.tbl_frame_participants (frame_id, side, player_id)
	values (p_frame_id, v_side, p_player_id);

	-- A reserve is available by definition, so the squad is caught up rather
	-- than made to disagree with the card.
	insert into public.tbl_league_match_squad (added_by, match_id, side, player_id)
	values ((select auth.uid()), v_f.match_id, v_side, p_player_id)
	on conflict (match_id, player_id) do nothing;

	update public.tbl_matches set card_version = card_version + 1 where id = v_f.match_id;
end;
$$;

revoke execute on function public.tdc_swap_frame_player(uuid, uuid) from public, anon;
grant execute on function public.tdc_swap_frame_player(uuid, uuid) to authenticated;

-- ── Two shipped functions that leagues made wrong ──
--
-- Both are patched from their live definitions, additions only, and both were
-- found by writing the tests for everything above rather than by reading.

-- 1. tdc_record_frame took a frame's players from the payload alone. A team
--    frame is given its two players when the lineups lock, and a scorer
--    tapping in a result does not re-send them — so recording the result of a
--    frame that already had its players failed outright on "a finished frame
--    needs at least one player on each side", and would have emptied the
--    frame if it had not. It now falls back to the people already in the
--    frame when the payload names none.
--
--    Provably nothing changes for anything that existed before leagues: in a
--    singles match both sides are filled from the match's own players before
--    this runs, and in doubles the page sends the list.

CREATE OR REPLACE FUNCTION public.tdc_record_frame(p_match_id uuid, p_frame_no integer, p_frame jsonb DEFAULT '{}'::jsonb, p_card_version integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_allowed  text[] := array[
		'referee_player_id', 'break_side', 'break_player_id', 'break_outcome',
		'winner_side', 'result_event', 'status', 'abandon_reason',
		'rack_started_at', 'started_at', 'ended_at', 'paused_seconds', 'clicker_log',
		'home_players', 'away_players'
	];
	v_unknown  text[];
	v_match    public.tbl_matches;
	v_frame_id uuid;

	v_derived  text;
	v_given    text;
	v_break    text;
	v_manual   boolean := false;

	v_status   text;
	v_winner   text;
	v_event    text;
	v_outcome  text;
	v_home     uuid[];
	v_away     uuid[];
	v_requires boolean;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	-- Refuse a write aimed at a card that has moved on. Checked here, not in
	-- the browser, because the browser is the thing that is out of date.
	if p_card_version is not null then
		perform private.tdc_check_card_version(p_match_id, p_card_version);
	end if;

	if p_match_id is null or p_frame_no is null or p_frame_no < 1 then
		raise exception 'TDC (Error): a match id and a frame number of 1 or more are required.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its score.';
	end if;

	if v_match.status = 'abandoned' then
		raise exception 'This match was abandoned. Frames can no longer be changed.';
	end if;

	-- A misspelt field would otherwise be dropped without a word.
	select array_agg(k) into v_unknown
	from (select k from jsonb_object_keys(coalesce(p_frame, '{}'::jsonb)) k) s
	where k <> all (v_allowed);
	if v_unknown is not null then
		raise exception 'TDC (Error): unknown frame field(s) %.', array_to_string(v_unknown, ', ');
	end if;

	v_status  := coalesce(p_frame->>'status', 'complete');
	v_winner  := p_frame->>'winner_side';
	v_event   := p_frame->>'result_event';
	v_outcome := p_frame->>'break_outcome';

	-- ── The break side: derived unless corrected ──
	v_derived := private.tdc_break_side_for_frame(p_match_id, p_frame_no);
	v_given   := p_frame->>'break_side';

	if v_given is null then
		v_break  := v_derived;
		v_manual := false;
	else
		v_break  := v_given;
		v_manual := v_given is distinct from v_derived;
	end if;

	-- ── A walkover or forfeit: awarded, never played ──
	if v_event = 'default' then
		if v_given is not null or v_outcome is not null or p_frame ? 'break_player_id' then
			raise exception 'TDC (Error): a frame awarded by default has no break. Remove the break fields.';
		end if;
		if v_winner is null then
			raise exception 'TDC (Error): a frame awarded by default still needs a winning side.';
		end if;
		v_break := null;
		v_manual := false;
	end if;

	-- ── Does a break and finish have to be the breaker's? Per match, by rule ──
	v_requires := coalesce((v_match.rules->>'break_finish_requires_breaker')::boolean, true);
	if v_requires and v_event in ('break_and_finish', 'golden_break') then
		if v_break is null then
			raise exception 'TDC (Error): a break and finish needs to say which side broke.';
		end if;
		if v_winner is distinct from v_break then
			raise exception 'TDC (Error): in this match a break and finish must go to the side that broke.';
		end if;
	end if;

	-- ── Who was at the table ──
	if p_frame ? 'home_players' then
		select array_agg(e::uuid) into v_home
		from jsonb_array_elements_text(p_frame->'home_players') e;
	elsif v_match.home_side_kind = 'player' then
		v_home := array[v_match.home_player_id];
	end if;

	if p_frame ? 'away_players' then
		select array_agg(e::uuid) into v_away
		from jsonb_array_elements_text(p_frame->'away_players') e;
	elsif v_match.away_side_kind = 'player' then
		v_away := array[v_match.away_player_id];
	end if;

	-- A team frame is given its two players when the lineups lock, and a
	-- scorer tapping in a result sends a payload that says nothing about who
	-- played. Fall back to the people already in the frame, so recording the
	-- result neither fails the check below nor empties the frame. Nothing
	-- changes for a singles match, where the two sides are the match's own
	-- players and were filled in above, or for doubles, where the page sends
	-- the list and replacing it wholesale is the point.
	if v_home is null or v_away is null then
		declare
			v_existing uuid;
		begin
			select id into v_existing from public.tbl_frames
			where match_id = p_match_id and frame_no = p_frame_no;

			if v_existing is not null then
				if v_home is null then
					select array_agg(player_id order by coalesce(play_order, 1)) into v_home
					from public.tbl_frame_participants where frame_id = v_existing and side = 'home';
				end if;
				if v_away is null then
					select array_agg(player_id order by coalesce(play_order, 1)) into v_away
					from public.tbl_frame_participants where frame_id = v_existing and side = 'away';
				end if;
			end if;
		end;
	end if;

	if v_status = 'complete' and (coalesce(array_length(v_home, 1), 0) = 0 or coalesce(array_length(v_away, 1), 0) = 0) then
		raise exception 'TDC (Error): a finished frame needs at least one player on each side.';
	end if;

	-- In a singles match the player is the side, so nobody else can appear.
	if v_match.home_side_kind = 'player' and v_home is not null
		and v_home <> array[v_match.home_player_id] then
		raise exception 'TDC (Error): the home side of this match is one player and cannot be changed per frame.';
	end if;
	if v_match.away_side_kind = 'player' and v_away is not null
		and v_away <> array[v_match.away_player_id] then
		raise exception 'TDC (Error): the away side of this match is one player and cannot be changed per frame.';
	end if;
	-- Team sides are not checked against a squad yet: that arrives with the
	-- teams table, and guessing at it now would be wrong either way.

	-- The breaker has to be one of the people on the breaking side.
	if p_frame->>'break_player_id' is not null then
		if v_break is null then
			raise exception 'TDC (Error): a breaking player was given but not which side broke.';
		end if;
		if not ((p_frame->>'break_player_id')::uuid = any (
			case v_break when 'home' then v_home else v_away end
		)) then
			raise exception 'TDC (Error): the breaking player is not on the side that broke.';
		end if;
	end if;

	-- ── Write it ──
	insert into public.tbl_frames (
		match_id, frame_no, referee_player_id,
		break_side, break_side_manual, break_player_id, break_outcome,
		winner_side, result_event, status, abandon_reason,
		rack_started_at, started_at, ended_at, paused_seconds, clicker_log
	)
	values (
		p_match_id, p_frame_no, (p_frame->>'referee_player_id')::uuid,
		v_break, v_manual, (p_frame->>'break_player_id')::uuid, v_outcome,
		v_winner, v_event, v_status, p_frame->>'abandon_reason',
		(p_frame->>'rack_started_at')::timestamptz,
		(p_frame->>'started_at')::timestamptz,
		(p_frame->>'ended_at')::timestamptz,
		coalesce((p_frame->>'paused_seconds')::integer, 0),
		p_frame->'clicker_log'
	)
	on conflict (match_id, frame_no) do update set
		referee_player_id = excluded.referee_player_id,
		break_side        = excluded.break_side,
		break_side_manual = excluded.break_side_manual,
		break_player_id   = excluded.break_player_id,
		break_outcome     = excluded.break_outcome,
		winner_side       = excluded.winner_side,
		result_event      = excluded.result_event,
		status            = excluded.status,
		abandon_reason    = excluded.abandon_reason,
		rack_started_at   = excluded.rack_started_at,
		started_at        = excluded.started_at,
		ended_at          = excluded.ended_at,
		paused_seconds    = excluded.paused_seconds,
		clicker_log       = excluded.clicker_log
	returning id into v_frame_id;

	-- Replaced wholesale, so removing a player from a doubles frame works.
	delete from public.tbl_frame_participants where frame_id = v_frame_id;

	if v_home is not null then
		insert into public.tbl_frame_participants (frame_id, side, player_id, play_order)
		select v_frame_id, 'home', p.id,
			case when array_length(v_home, 1) > 1 then p.ord::smallint end
		from unnest(v_home) with ordinality as p(id, ord);
	end if;

	if v_away is not null then
		insert into public.tbl_frame_participants (frame_id, side, player_id, play_order)
		select v_frame_id, 'away', p.id,
			case when array_length(v_away, 1) > 1 then p.ord::smallint end
		from unnest(v_away) with ordinality as p(id, ord);
	end if;

	-- The card moved. A later frame's breaker may now follow from a different
	-- result, so rules-driven break sides are worked out again.
	perform public.tdc_rederive_break_sides(p_match_id);

	update public.tbl_matches
	set status       = case when status = 'scheduled' then 'in_progress' else status end,
		started_at   = coalesce(started_at, now()),
		card_version = card_version + 1
	where id = p_match_id;

	return v_frame_id;
end;
$function$;

-- 2. private.tdc_can_edit_match reaches a competition's officials through
--    tbl_tournament_fixtures only, because a tournament was the only kind of
--    competition a match could belong to when it was written. A league
--    director who was not playing could not score their own league night —
--    the same hole the tournament clause was added to close, and principle 8
--    is that a director has to be able to run everything alone. A team's
--    captain goes in with them.

CREATE OR REPLACE FUNCTION private.tdc_can_edit_match(p_match_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select exists (
		select 1
		from public.tbl_matches m
		where m.id = p_match_id
			and (
				-- Either side's player, in a singles match.
				exists (
					select 1
					from public.tbl_players p
					where p.user_id = (select auth.uid())
						and p.id in (m.home_player_id, m.away_player_id)
				)
				-- Anyone who actually played a frame. This is what covers a team
				-- match, where the sides are teams and the people are in frames.
				or exists (
					select 1
					from public.tbl_frames f
					join public.tbl_frame_participants fp on fp.frame_id = f.id
					join public.tbl_players p on p.id = fp.player_id
					where f.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- Staff at the venue the match is being played at.
				or (
					m.venue_id is not null
					and private.tdc_has_venue_role(m.venue_id, array['owner', 'admin', 'staff'])
				)
				-- Anyone holding a role in a competition this match belongs to:
				-- its director, referee or scorer. Without this a TD who is not
				-- playing and is not venue staff cannot score their own
				-- tournament, which is the whole of principle 8.
				or exists (
					select 1
					from public.tbl_tournament_fixtures x
					join public.tbl_competition_roles r on r.tournament_id = x.tournament_id
					join public.tbl_players p on p.id = r.player_id
					where x.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- The same, for a league. The clause above was written when a
				-- tournament was the only kind of competition a match could
				-- belong to, so a league director who was not playing could
				-- not score their own league night.
				or exists (
					select 1
					from public.tbl_league_fixtures lf
					join public.tbl_competition_roles r on r.league_season_id = lf.league_season_id
					join public.tbl_players p on p.id = r.player_id
					where lf.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- And either team's captain, who runs the night from beside
				-- the table whether or not they are in a frame themselves.
				or exists (
					select 1
					from public.tbl_league_season_entrants e
					join public.tbl_players p on p.id = e.player_id
					where m.home_team_id is not null
						and e.team_id in (m.home_team_id, m.away_team_id)
						and e.is_captain and e.status = 'active'
						and p.user_id = (select auth.uid())
				)
			)
	)
	-- And, in a competition, they must also be senior enough for the way this
	-- tournament has chosen to have its scores entered.
	and private.tdc_meets_score_entry_mode(p_match_id);
$function$;
