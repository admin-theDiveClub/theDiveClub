-- Finding someone to put in a tournament.
--
-- tdc_search_opponents cannot do this job. It returns players with a login
-- only and leaves the caller out of their own results, which is right for
-- "who am I playing" and wrong twice over here:
--
--   * A tournament is full of walk-ins. "A tournament director must be able to
--     run everything alone" means the entrant list has to reach people who
--     have never opened the app, or the TD is typing names into a phone.
--   * A TD plays in their own club night. Leaving the caller out means the
--     person running the tournament cannot enter it.
--
-- So this is a second search rather than a change to the first one: the two
-- questions have different answers and a shared function would have to be told
-- which one is being asked.
--
-- It is gated on running the tournament, because it returns walk-in records —
-- real people's names — to whoever calls it. tdc_search_opponents is open to
-- any signed-in player precisely because it only returns people who chose to
-- make an account.

create function public.tdc_search_entrants(
	p_tournament_id uuid,
	p_query         text,
	p_limit         integer default 20
)
returns table (
	id           uuid,
	display_name text,
	full_name    text,
	player_type  text,
	has_account  boolean,
	avatar_path  text,
	-- Saves the page a second request to work out which results are already in
	-- the list, and lets it show them as added rather than offering them again.
	already_in   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		p.player_type,
		p.user_id is not null,
		p.avatar_path,
		exists (
			select 1 from public.tbl_tournament_entrants e
			where e.tournament_id = p_tournament_id and e.player_id = p.id
		)
	from public.tbl_players p
	where private.tdc_can_run_tournament(p_tournament_id)
		and char_length(trim(coalesce(p_query, ''))) >= 2
		and (
			p.display_name ilike '%' || trim(p_query) || '%'
			or coalesce(p.first_name, '') ilike '%' || trim(p_query) || '%'
			or coalesce(p.last_name, '')  ilike '%' || trim(p_query) || '%'
		)
	-- People who can be told they are in something come first; a walk-in with
	-- a similar name is the fallback, not the first guess.
	order by (p.user_id is not null) desc, p.display_name
	limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

comment on function public.tdc_search_entrants(uuid, text, integer) is
	'Player search for a tournament entrant list. Unlike tdc_search_opponents it includes walk-ins and the caller, and is therefore restricted to people who run the tournament.';

revoke execute on function public.tdc_search_entrants(uuid, text, integer) from public, anon;
grant execute on function public.tdc_search_entrants(uuid, text, integer) to authenticated;
