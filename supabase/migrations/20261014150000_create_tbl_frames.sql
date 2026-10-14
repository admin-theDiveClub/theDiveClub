-- Frames, and who played them.
--
-- Frames are the only record of what happened in a match. The score, the match
-- winner and every statistic are counted from these rows, never stored.
--
-- Which side broke is worked out, not typed in: the lag winner plus the break
-- rule plus the results so far. It is written here so a frame can be read on its
-- own, and rewritten whenever a governing setting changes. A breaker corrected
-- by hand sets break_side_manual, and the rule then leaves that frame alone.
--
-- Table and lineup slot are not here yet. They arrive with the tables table and
-- the team scoresheet, rather than being guessed at now.

create table public.tbl_frames (
	id                 uuid primary key default gen_random_uuid(),
	created_at         timestamptz not null default now(),
	match_id           uuid not null references public.tbl_matches (id) on delete cascade,
	frame_no           integer not null check (frame_no >= 1),

	referee_player_id  uuid references public.tbl_players (id) on delete set null,

	-- The break. Null where no break was played at all: a walkover, or a frame
	-- abandoned before anyone hit a ball.
	break_side         text check (break_side in ('home', 'away')),
	break_side_manual  boolean not null default false,
	break_player_id    uuid references public.tbl_players (id) on delete set null,
	break_outcome      text check (break_outcome in ('dry', 'in', 'scratch', 'foul')),

	-- How it ended.
	winner_side        text check (winner_side in ('home', 'away')),
	result_event       text check (result_event in
		('win', 'break_and_finish', 'reverse_break_and_finish', 'golden_break', 'default')),

	status             text not null default 'in_progress'
		check (status in ('in_progress', 'complete', 'abandoned')),
	abandon_reason     text check (abandon_reason is null or char_length(trim(abandon_reason)) between 3 and 500),

	-- Timing. rack_started_at is when racking for this frame began; it is null
	-- when the frame ended without a break being played, because the whole
	-- period then counts as frame time. paused_seconds is the part of the wall
	-- clock that was a genuine stoppage, so stalling still shows up.
	rack_started_at    timestamptz,
	started_at         timestamptz,
	ended_at           timestamptz,
	paused_seconds     integer not null default 0 check (paused_seconds >= 0),

	-- What the referee's clicker recorded, as [code, ms from frame start].
	-- Shot times, visits and extensions used are all worked out from this.
	clicker_log        jsonb,

	constraint tbl_frames_one_number_per_match unique (match_id, frame_no),

	-- A finished frame has a winner and says how it was won.
	constraint tbl_frames_complete_has_a_result check (
		status <> 'complete' or (winner_side is not null and result_event is not null)
	),
	-- An abandoned frame has no winner; it counts for nobody.
	constraint tbl_frames_abandoned_has_no_winner check (
		status <> 'abandoned' or (winner_side is null and result_event is null)
	),

	-- Always true, whatever a league's settings say: you cannot finish from the
	-- break without the break going in.
	constraint tbl_frames_break_finish_needs_a_ball check (
		result_event not in ('break_and_finish', 'golden_break') or break_outcome = 'in'
	),
	-- A reverse break and finish is by definition the side that did not break.
	constraint tbl_frames_reverse_is_the_other_side check (
		result_event <> 'reverse_break_and_finish'
		or (break_side is not null and winner_side is not null and winner_side <> break_side)
	),

	constraint tbl_frames_ends_after_it_starts check (
		ended_at is null or started_at is null or ended_at >= started_at
	)
);

create index tbl_frames_match_idx  on public.tbl_frames (match_id, frame_no);
create index tbl_frames_winner_idx on public.tbl_frames (match_id, winner_side) where status = 'complete';


-- Who was at the table. One row per player per side, so a singles frame has two
-- rows and a doubles frame four. Filled in even for singles, so that every
-- statistic about a player is one join away and never has to branch on format.
-- This is what makes individual records recoverable from a team league.
create table public.tbl_frame_participants (
	id          uuid primary key default gen_random_uuid(),
	frame_id    uuid not null references public.tbl_frames (id) on delete cascade,
	side        text not null check (side in ('home', 'away')),
	player_id   uuid not null references public.tbl_players (id) on delete restrict,
	-- Who shoots first in an alternating-shot format. Null for singles.
	play_order  smallint check (play_order is null or play_order between 1 and 4),

	constraint tbl_frame_participants_once_per_frame unique (frame_id, player_id)
);

create index tbl_frame_participants_frame_idx  on public.tbl_frame_participants (frame_id);
create index tbl_frame_participants_player_idx on public.tbl_frame_participants (player_id);


-- Access rules. Reading is open to signed-in users; results are not secret and
-- a player needs to see frames they were not in. Writing goes through functions
-- in a later migration: the breaker is derived, and a check constraint cannot
-- express "this follows from the frames before it".
alter table public.tbl_frames enable row level security;
alter table public.tbl_frame_participants enable row level security;

create policy "Signed-in users can see frames"
	on public.tbl_frames
	for select
	to authenticated
	using (true);

create policy "Signed-in users can see who played a frame"
	on public.tbl_frame_participants
	for select
	to authenticated
	using (true);

grant select on public.tbl_frames to authenticated;
grant select on public.tbl_frame_participants to authenticated;
grant select, insert, update, delete on public.tbl_frames to service_role;
grant select, insert, update, delete on public.tbl_frame_participants to service_role;
