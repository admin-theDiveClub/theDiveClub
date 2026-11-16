-- League placeholders link to their account by themselves (UV, 16 Nov 2026).
--
-- The 8-Ball Mainstream import (20261111130357) made 76 placeholders: player
-- records with no account, holding the email from the league's players file.
-- Until now a player claimed theirs by opening the profile page and pressing
-- Link to My Account (tdc_find_my_walk_in, tdc_claim_my_walk_in); signing in
-- lands on the home page, so most never saw it.
--
-- tdc_link_my_league_records links it with nothing pressed. The nav calls it on
-- every signed-in page load and, when it linked something, shows a strip with a
-- button to each league season the record was entered in (UV, 16 Nov), so it
-- returns those seasons rather than the player id.
--
--   * Leagues only. A record is linked only if it is a league placeholder
--     (tbl_league_season_entrants.placeholder). Nothing on the site makes one;
--     only the import does, so the league has vouched for that email.
--     Tournament walk-ins keep the profile page's button.
--   * The match is tdc_find_my_walk_in's own: no account on the record, and its
--     email equal to the signed-in account's confirmed email.
--   * At most one record can match: an email may sit on one record only
--     (tbl_player_identifiers_unique), so there is never a choice to make.
--   * The merge is private.tdc_merge_players, as for every claim, so its own
--     refusals (two SA IDs, both in one season, played each other) stand and
--     the placeholder's player id is kept with its frames, team and positions.
--   * Two tabs loading at once: the placeholder's row is locked and checked
--     again, so the second finds it linked and links nothing.

create function public.tdc_link_my_league_records()
returns table (league_season_id uuid, league_name text, season_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_found   uuid;
	v_keep    uuid;
	v_mine    uuid;
begin
	if v_user_id is null then
		raise exception 'Sign in first.';
	end if;

	select f.player_id into v_found
	from public.tdc_find_my_walk_in() f
	where exists (
		select 1 from public.tbl_league_season_entrants e
		where e.player_id = f.player_id and e.placeholder
	);

	if v_found is null then
		return;
	end if;

	-- Another tab may be linking it right now: wait for it, then look again.
	select p.id into v_keep
	from public.tbl_players p
	where p.id = v_found and p.user_id is null
	for update;
	if v_keep is null then
		return;
	end if;

	select id into v_mine from public.tbl_players where user_id = v_user_id;
	if v_mine is null then
		raise exception 'TDC (Error): no player profile found for this account.';
	end if;

	perform private.tdc_merge_players(v_keep, v_mine, v_user_id);

	return query
		select s.id, l.name, s.name
		from public.tbl_league_season_entrants e
		join public.tbl_league_seasons s on s.id = e.league_season_id
		join public.tbl_leagues l on l.id = s.league_id
		where e.player_id = v_keep and e.placeholder
		order by s.created_at desc;
end;
$$;

comment on function public.tdc_link_my_league_records() is
	'Links the signed-in account to its league placeholder (same confirmed email, placeholder entry), keeping the placeholder''s player id. Returns the league seasons it was entered in (for the strip''s buttons), or nothing. Called by the nav on every signed-in page load (UV, 16 Nov 2026).';

revoke execute on function public.tdc_link_my_league_records() from public, anon;
grant  execute on function public.tdc_link_my_league_records() to authenticated;
