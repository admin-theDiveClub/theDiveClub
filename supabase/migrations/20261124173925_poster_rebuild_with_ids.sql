-- Every poster built before player ids rebuilt once (UV, 24 Nov).
--
-- 20261124172239 put player ids into the poster's snapshot (version 3), but a
-- poster already built kept its old snapshot, so its names opened no profiles
-- until somebody regenerated it (UV: "I still can't open any profiles from the
-- tournament poster page"; production's one poster was built two hours before
-- the push). UV chose a rebuild over regenerating by hand.
--
-- Rebuilt with each poster's own choices (entrant names, the draw) through
-- private.tdc_poster_snapshot, as tdc_publish_poster builds it. Whether it is
-- shared is left alone, so nothing becomes public by being rebuilt, and so is
-- who generated it (a migration has nobody signed in). generated_at is now:
-- the page says when the poster was made and that it shows the tournament as
-- it was then, and from now on that is true of the rebuilt content.
--
-- Only posters below version 3, so running it again changes nothing.

update public.tbl_tournament_posters p
set snapshot     = private.tdc_poster_snapshot(p.tournament_id, p.include_entrants, p.include_draw),
	generated_at = now()
where coalesce((p.snapshot ->> 'version')::integer, 1) < 3;
