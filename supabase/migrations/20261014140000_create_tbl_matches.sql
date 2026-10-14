-- Matches.
--
-- A match is two sides playing frames. Each side is either a single player or a
-- team: a singles league, a tournament round and two mates at the bar are all
-- player vs player, while a team league night is team vs team. The kind is not
-- decided by what the match belongs to, so it is stored per side.
--
-- Nothing about the score lives here. Frames are the only record of what
-- happened, and the score, the winner and every statistic are counted from them.
--
-- The league and tournament columns come with that layer. A match needs neither:
-- a social match belongs to nothing and is first class.

create table public.tbl_matches (
	id                 uuid primary key default gen_random_uuid(),
	created_at         timestamptz not null default now(),
	created_by         uuid references auth.users (id) on delete set null,

	-- Where and when. A venue is optional: a player running a match at home
	-- has no venue record, and we still want the match.
	venue_id           uuid references public.tbl_venues (id) on delete set null,
	scheduled_at       timestamptz,
	started_at         timestamptz,
	ended_at           timestamptz,

	-- The two sides.
	home_side_kind     text not null check (home_side_kind in ('player', 'team')),
	home_player_id     uuid references public.tbl_players (id) on delete restrict,
	home_team_id       uuid,  -- FK added with the teams table

	away_side_kind     text not null check (away_side_kind in ('player', 'team')),
	away_player_id     uuid references public.tbl_players (id) on delete restrict,
	away_team_id       uuid,  -- FK added with the teams table

	-- Who broke the first frame. Every later frame's breaker is worked out from
	-- this plus the break rule plus the results so far, so changing it moves the
	-- whole match.
	first_break_side   text check (first_break_side in ('home', 'away')),

	-- Whether this match counts towards ranked records. An authorisation fact,
	-- not a rule, so it is a column and can never be set by the ruleset.
	sanctioned         boolean not null default false,
	sanctioned_at      timestamptz,
	sanctioned_by      uuid references auth.users (id) on delete set null,

	-- The rules in force for this match, frozen when it was created so that a
	-- later change to a league's settings cannot rescore frames already played.
	rules              jsonb not null,

	status             text not null default 'scheduled'
		check (status in ('scheduled', 'in_progress', 'complete', 'abandoned')),

	-- Bumped by any change to this match's frames. A captain's submission
	-- records the version it signed, so two submissions only agree when they
	-- both refer to the card as it stands. Used by the team scoresheet.
	card_version       integer not null default 0,

	-- Exactly one id per side, matching that side's kind.
	constraint tbl_matches_home_side_is_one_thing check (
		(home_side_kind = 'player' and home_player_id is not null and home_team_id is null)
		or (home_side_kind = 'team' and home_team_id is not null and home_player_id is null)
	),
	constraint tbl_matches_away_side_is_one_thing check (
		(away_side_kind = 'player' and away_player_id is not null and away_team_id is null)
		or (away_side_kind = 'team' and away_team_id is not null and away_player_id is null)
	),

	-- A side cannot play itself.
	constraint tbl_matches_sides_differ check (
		home_player_id is distinct from away_player_id
		or home_player_id is null
	),

	constraint tbl_matches_sanctioned_has_a_source check (
		sanctioned = false or sanctioned_by is not null
	)
);

create index tbl_matches_venue_idx       on public.tbl_matches (venue_id);
create index tbl_matches_home_player_idx on public.tbl_matches (home_player_id);
create index tbl_matches_away_player_idx on public.tbl_matches (away_player_id);
create index tbl_matches_scheduled_idx   on public.tbl_matches (scheduled_at desc);

-- Access rules.
-- Reading is open to signed-in users: results are not secret, and a player
-- needs to see matches they are not in. Writing goes through functions in a
-- later migration, because a frame's breaker is derived and a check constraint
-- cannot express "this follows from the frames before it".
alter table public.tbl_matches enable row level security;

create policy "Signed-in users can see matches"
	on public.tbl_matches
	for select
	to authenticated
	using (true);

grant select on public.tbl_matches to authenticated;
grant select, insert, update, delete on public.tbl_matches to service_role;
