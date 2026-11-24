-- The poster is a live page (UV, 24 Nov), like a league's season page.
--
-- The tournaments page counted entrants live and the poster showed a stored
-- snapshot: Basil's Friday Super Comp said 13 on the list and 12 on the poster,
-- because King registered interest after it was built. UV: "The poster
-- shouldn't actually just be a poster. It's meant to be active like the season
-- page in leagues." Asked which parts go live: "All". What a signed-out visitor
-- sees: "They see the poster. Anything else requires sign in." Regenerate and
-- the "made at" line: gone, "Live page".
--
-- This reverses the 21 Oct decision that the poster is a stored snapshot. The
-- safety reason behind it is kept: a stranger still reaches exactly one
-- function, and what it returns is still the one vetted shape built by
-- private.tdc_poster_snapshot (no notes, no entrant ids beyond players', no
-- status of a withdrawn entrant). It is now built at read time instead of
-- read from tbl_tournament_posters.snapshot. The season page's public reads
-- (tdc_public_league_season) work the same way.
--
-- tdc_tournament_poster (20261124150322), patched: snapshot is built live with
-- everything in (names and the draw: "All"), and generated_at is now(), the
-- moment it was read. The gate is unchanged: a tournament with no poster row,
-- or with a private one you do not run, returns nothing. The poster row stays
-- as the sharing switch; its stored snapshot is no longer read by anything.
-- Same signature and return type, so no drop.

create or replace function public.tdc_tournament_poster(p_tournament_id uuid)
returns table (
	snapshot     jsonb,
	generated_at timestamptz,
	is_public    boolean,
	i_run_it     boolean,
	picture_path text
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

	-- Live, with everything in (UV, 24 Nov: "Live page", "All").
	snapshot     := private.tdc_poster_snapshot(p_tournament_id, true, true);
	generated_at := now();
	is_public    := v_p.is_public;
	i_run_it     := v_run;
	-- Live, not from the snapshot (UV, 24 Nov).
	select t.picture_path into picture_path from public.tbl_tournaments t where t.id = p_tournament_id;
	return next;
end;
$$;

revoke execute on function public.tdc_tournament_poster(uuid) from public;
grant execute on function public.tdc_tournament_poster(uuid) to anon, authenticated;
