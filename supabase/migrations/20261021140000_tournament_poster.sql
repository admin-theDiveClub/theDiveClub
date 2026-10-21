-- The tournament poster: the one thing on this site a stranger can read.
--
-- UV's design, carried over from the earlier chat: a TD should be able to set a
-- tournament up to the point where they can copy a block of text describing the
-- whole thing, hand it to an AI, and get a custom poster back. The page works
-- before, during or after — during and after including progression.
--
-- ─── Why this is a snapshot and not a public read of the live tables ───
--
-- The obvious build is to grant anon a narrow read of tbl_tournaments and a
-- cut-down draw function. UV, 21 Oct: "maybe you route the information through
-- the TD's account rather than letting unsigned accounts access the DB?" —
-- which is the better design, for three reasons:
--
--   1. Every tdc_ function written so far assumes a caller with a player
--      record. Opening any of them to anon means re-auditing each one for a
--      caller who has none, and the cost of missing one is a stranger reading
--      walk-in records — people who never chose to be findable — or a TD's
--      private entrant notes.
--   2. A poster is a snapshot by its nature. It is a thing the TD produces at a
--      moment, not a live window. Generating it is already the gesture.
--   3. It collapses the exposure question to one reviewable place. anon can
--      select from exactly one table holding exactly one pre-vetted blob per
--      tournament. It never touches tbl_tournaments, tbl_players,
--      tbl_tournament_entrants, tbl_matches or tbl_frames at all.
--
-- So the TD's own authenticated call builds the snapshot, through a security
-- definer function gated on private.tdc_can_run_tournament, and anon reads the
-- result. Nothing is public until a TD makes it so, and what is public is
-- whatever they chose to put in it.
--
-- The cost, stated plainly: a published poster goes stale. It shows what the
-- tournament looked like when it was generated. That is correct for a poster
-- and wrong for a scoreboard, so the page says when it was made, and the TD
-- regenerates it. A live public scoreboard is a different feature and would
-- need the anon read this deliberately avoids.

-- ─────────────────────────────────────────────────────────────────
-- Where a published poster lives
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_tournament_posters (
	tournament_id uuid primary key
		references public.tbl_tournaments (id) on delete cascade,

	created_at    timestamptz not null default now(),
	generated_at  timestamptz not null default now(),
	generated_by  uuid references auth.users (id) on delete set null,

	-- Off by default, so generating a poster to read the text out of it does
	-- not publish anything. UV: the TD controls whether a tournament is
	-- publicly visible.
	is_public     boolean not null default false,

	-- What the TD chose to include, kept so the page can say so and the next
	-- regeneration can default to the same choices.
	include_entrants boolean not null default false,
	include_draw     boolean not null default false,

	-- The whole poster, built by tdc_publish_poster. One blob rather than
	-- columns: this is the shape anon reads, and a column per fact would mean
	-- a migration every time a poster gains a line.
	snapshot      jsonb not null
);

comment on table public.tbl_tournament_posters is
	'The only table an unauthenticated visitor can read, and only where is_public is true. Holds a snapshot built by the TD through tdc_publish_poster — never a live view. Nothing here is derived at read time, deliberately: see the migration header.';

comment on column public.tbl_tournament_posters.is_public is
	'False means generated but not shared: the TD can read the text output without the tournament being readable by anyone else.';

comment on column public.tbl_tournament_posters.snapshot is
	'What the public sees, exactly. Anything not in here is not exposed, so this is the one place to review when asking what a stranger can read.';

alter table public.tbl_tournament_posters enable row level security;

-- The one public read on the site. Scoped to is_public rather than granted
-- broadly, so an unpublished poster is invisible to anon even by id.
create policy "Anyone can see a published poster"
	on public.tbl_tournament_posters for select to anon
	using (is_public);

-- A signed-in player sees a published poster the same way. The TD's own view of
-- an unpublished one goes through tdc_tournament_poster, which asks
-- tdc_can_run_tournament — not through this policy.
create policy "Signed-in users can see a published poster"
	on public.tbl_tournament_posters for select to authenticated
	using (is_public);

grant select on public.tbl_tournament_posters to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Building one
--
-- Assembled here rather than in the page, for the same reason the status is
-- derived in the database: the shape of a poster is one decision, and a page
-- that assembles its own would drift from the text output the TD copies.
-- ─────────────────────────────────────────────────────────────────

-- Which ruleset keys a stranger is told about.
--
-- This belongs in TDCMatchDef as a player_facing flag — the setup page, the
-- round settings box, the per-match override dropdown and this text are all
-- renderings of one definition, and that was the decision. The flag does not
-- exist yet, so the list lives here and this is its only caller. When the flag
-- lands, this function is what gets deleted.
create function private.tdc_poster_rules(p_rules jsonb)
returns jsonb
language sql
immutable
as $$
	select coalesce(jsonb_object_agg(k, p_rules -> k), '{}'::jsonb)
	from unnest(array[
		'discipline',
		'win_condition_type',
		'win_condition_target',
		'draws_allowed',
		'tiebreak_method',
		'max_match_minutes',
		'on_time_expiry',
		'golden_break_enabled',
		'break_determination',
		'break_finish_enabled',
		'reverse_break_finish_enabled',
		'shot_clock_enabled',
		'shot_clock_seconds',
		'shot_clock_first_shot_seconds',
		'extensions_per_player',
		'extension_seconds',
		'referee_required'
	]) as k
	where p_rules ? k;
$$;

comment on function private.tdc_poster_rules(jsonb) is
	'The player-facing subset of a ruleset. Deliberately excludes score_entry_mode, approval_mode and dispute_window_hours: how a result is agreed is between the TD and the players, not poster copy. Delete this when TDCMatchDef gains a player_facing flag.';

revoke execute on function private.tdc_poster_rules(jsonb) from public, anon;
grant execute on function private.tdc_poster_rules(jsonb) to authenticated;


create function private.tdc_poster_snapshot(
	p_tournament_id    uuid,
	p_include_entrants boolean,
	p_include_draw     boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_t      public.tbl_tournaments%rowtype;
	v_venue  text;
	v_out    jsonb;
	v_live   integer;
	v_conf   integer;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	select name into v_venue from public.tbl_venues where id = v_t.venue_id;

	select count(*) filter (where status <> 'withdrawn'),
		count(*) filter (where status = 'confirmed')
	into v_live, v_conf
	from public.tbl_tournament_entrants
	where tournament_id = p_tournament_id;

	-- The tournament itself. Always included: this is the poster.
	--
	-- Note what is absent. No notes — those are the TD's. No entry fee in
	-- credits as a bare number without the venue context to read it. No
	-- created_by, no venue_id, no ids of any kind except the tournament's own,
	-- which is already in the address.
	v_out := jsonb_build_object(
		'version', 1,
		'tournament_id', v_t.id,
		'name', v_t.name,
		'format', v_t.format,
		'status', private.tdc_tournament_status(v_t.id),
		'starts_at', v_t.starts_at,
		'venue_name', v_venue,
		'max_entrants', v_t.max_entrants,
		'entry_fee_credits', v_t.entry_fee_credits,
		'entry_mode', v_t.entry_mode,
		'sanctioned', v_t.sanctioned,
		-- Counts, not names. UV: "the poster page is just the tournament
		-- information and maybe how many confirmed/interested entrants there
		-- are" — which is also what a poster advertising for entries needs.
		'entrants', jsonb_build_object(
			'total', v_live,
			'confirmed', v_conf,
			'interested', v_live - v_conf),
		-- The ruleset, filtered to what a player is told. Shot clock yes,
		-- dispute window no. See the player_facing work in TDCMatchDef — until
		-- that flag exists, the list is held here and this is the only caller.
		'rules', private.tdc_poster_rules(v_t.rules)
	);

	-- Who is in it, by display name only. Opt-in, because UV's considered
	-- answer was that the real entrant list is the TD's.
	if p_include_entrants then
		v_out := v_out || jsonb_build_object('entrant_names', coalesce((
			select jsonb_agg(p.display_name order by e.seed nulls last, p.display_name)
			from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = p_tournament_id and e.status <> 'withdrawn'
		), '[]'::jsonb));
	end if;

	-- The draw, with whatever has been decided. Opt-in. Scores come from
	-- tdc_tournament_draw, which reads through tdc_match_score, so a TD's
	-- hand-set result appears here the same as a counted one.
	if p_include_draw then
		v_out := v_out || jsonb_build_object('draw', coalesce((
			select jsonb_agg(jsonb_build_object(
				'bracket', d.bracket,
				'round', d.round,
				'position', d."position",
				'home', d.home_name,
				'away', d.away_name,
				'home_frames', d.home_frames,
				'away_frames', d.away_frames,
				-- Resolved to a name here: the draw returns an entrant id, and
				-- an id has no business in something a stranger reads.
				'winner', case
					when d.winner_entrant_id is null then null
					when d.winner_entrant_id = d.home_entrant_id then d.home_name
					when d.winner_entrant_id = d.away_entrant_id then d.away_name
				end,
				'match_status', d.match_status,
				-- So a poster generated mid-tournament can mark a result that
				-- has not been published as not yet official, rather than
				-- presenting it as settled.
				'published', d.published,
				-- A hand-set result is shown as one. The TD's score advances
				-- the bracket either way, and disguising it would be worse.
				'set_by_hand', d.overridden)
				order by d.bracket, d.round, d."position")
			from public.tdc_tournament_draw(p_tournament_id) d
		), '[]'::jsonb));
	end if;

	return v_out;
end;
$$;

revoke execute on function private.tdc_poster_snapshot(uuid, boolean, boolean) from public, anon;
grant execute on function private.tdc_poster_snapshot(uuid, boolean, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Publishing, and taking it down
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_publish_poster(
	p_tournament_id    uuid,
	-- Defaults match UV's considered answer: the poster advertises the
	-- tournament, the entrant list and the draw are the TD's until they say
	-- otherwise.
	p_include_entrants boolean default false,
	p_include_draw     boolean default false,
	-- Generating and sharing are separate acts. A TD who only wants the text to
	-- paste into an AI prompt need not make anything public to get it.
	p_public           boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_snap   jsonb;
	v_public boolean;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can publish its poster.';
	end if;

	v_snap := private.tdc_poster_snapshot(p_tournament_id, p_include_entrants, p_include_draw);

	-- Null leaves the sharing setting alone, so regenerating a published poster
	-- keeps it published and regenerating a private one keeps it private.
	-- Nothing becomes public by being rebuilt.
	if p_public is not null then
		v_public := p_public;
	else
		select is_public into v_public from public.tbl_tournament_posters
		where tournament_id = p_tournament_id;
		v_public := coalesce(v_public, false);
	end if;

	insert into public.tbl_tournament_posters
		(tournament_id, generated_by, generated_at, is_public,
		 include_entrants, include_draw, snapshot)
	values
		(p_tournament_id, (select auth.uid()), now(), v_public,
		 p_include_entrants, p_include_draw, v_snap)
	on conflict (tournament_id) do update
		set generated_by     = excluded.generated_by,
			generated_at     = excluded.generated_at,
			is_public        = excluded.is_public,
			include_entrants = excluded.include_entrants,
			include_draw     = excluded.include_draw,
			snapshot         = excluded.snapshot;

	return v_snap;
end;
$$;

revoke execute on function public.tdc_publish_poster(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.tdc_publish_poster(uuid, boolean, boolean, boolean) to authenticated;


-- Taking it down leaves the snapshot in place. Unsharing and deleting are
-- different intentions, and a TD who unshares by accident should not lose the
-- poster they built.
create function public.tdc_unpublish_poster(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change its poster.';
	end if;

	update public.tbl_tournament_posters
	set is_public = false
	where tournament_id = p_tournament_id;

	if not found then
		raise exception 'This tournament has no poster yet.';
	end if;
end;
$$;

revoke execute on function public.tdc_unpublish_poster(uuid) from public, anon;
grant execute on function public.tdc_unpublish_poster(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Reading one
--
-- Two callers with different rights, one function. A stranger or an ordinary
-- player gets a published poster. Whoever runs the tournament also gets an
-- unpublished one, so they can see what they are about to share.
--
-- This is granted to anon — the only function on the site that is. It reads
-- tbl_tournament_posters and, for the TD case, asks tdc_can_run_tournament.
-- It touches no other table, which is the whole point of the design.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_tournament_poster(p_tournament_id uuid)
returns table (
	snapshot     jsonb,
	generated_at timestamptz,
	is_public    boolean,
	i_run_it     boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_p public.tbl_tournament_posters%rowtype;
	v_run boolean := false;
begin
	select * into v_p from public.tbl_tournament_posters
	where tournament_id = p_tournament_id;

	-- An unauthenticated caller has no player record, so this is asked only
	-- when somebody is signed in. tdc_can_run_tournament would be false for
	-- anon anyway; this just avoids the work.
	if (select auth.uid()) is not null then
		v_run := private.tdc_can_run_tournament(p_tournament_id);
	end if;

	-- No row, or a private poster and you do not run it: nothing. Not an
	-- error — a tournament without a poster and one whose poster is private
	-- are the same thing to a visitor, and saying which would leak that the
	-- tournament exists.
	if v_p.tournament_id is null then return; end if;
	if not v_p.is_public and not v_run then return; end if;

	snapshot     := v_p.snapshot;
	generated_at := v_p.generated_at;
	is_public    := v_p.is_public;
	i_run_it     := v_run;
	return next;
end;
$$;

revoke execute on function public.tdc_tournament_poster(uuid) from public;
grant execute on function public.tdc_tournament_poster(uuid) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The merge has to know about this table
--
-- tdc_merge_players moves every reference to a merged-away player. A poster
-- holds display names inside its snapshot rather than player ids, so there is
-- nothing to repoint — but a snapshot built before a merge will show the old
-- name until the TD regenerates it. Recorded here rather than fixed: rewriting
-- names inside a stored blob is the kind of cleverness that goes wrong, and the
-- poster is explicitly a snapshot of a moment.
-- ─────────────────────────────────────────────────────────────────

comment on column public.tbl_tournament_posters.generated_at is
	'When the snapshot was built. A poster shows the tournament as it was at this moment — including entrant names from before any later merge — so the page shows this date and the TD regenerates to refresh it.';
