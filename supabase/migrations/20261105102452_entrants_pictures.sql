-- ─────────────────────────────────────────────────────────────────
-- The entrant list, with each player's picture
--
-- UV, 5 Nov: the draw page shows every entrant as a pill, their picture on
-- the left and their name inside, for the director to drag onto a match.
-- The draw itself carries pictures only for players already in it
-- (20261105095518), so the entrant list gains one column at the end:
--
--     avatar_path
--
-- the player's own path in the public player-avatars bucket, or null. Still
-- gated on running the tournament, as it has been since 20261021130000.
--
-- Patched from the 20261021130000 text, not retyped.
-- ─────────────────────────────────────────────────────────────────

-- Dropped rather than replaced: this adds a column, and PostgreSQL will not
-- change the return type of an existing function in place.
drop function if exists public.tdc_tournament_entrants(uuid);

create function public.tdc_tournament_entrants(p_tournament_id uuid)
returns table (
	entrant_id   uuid,
	player_id    uuid,
	display_name text,
	first_name   text,
	last_name    text,
	player_type  text,
	has_account  boolean,
	status       text,
	paid         boolean,
	paid_at      timestamptz,
	seed         integer,
	notes        text,
	avatar_path  text
)
language sql
stable
security definer
set search_path = ''
as $$
	select e.id, p.id, p.display_name, p.first_name, p.last_name, p.player_type,
		p.user_id is not null, e.status, e.paid_at is not null, e.paid_at, e.seed, e.notes,
		p.avatar_path
	from public.tbl_tournament_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.tournament_id = p_tournament_id
		and private.tdc_can_run_tournament(p_tournament_id)
	order by e.seed nulls last, p.display_name;
$$;

revoke execute on function public.tdc_tournament_entrants(uuid) from public, anon;
grant execute on function public.tdc_tournament_entrants(uuid) to authenticated;
