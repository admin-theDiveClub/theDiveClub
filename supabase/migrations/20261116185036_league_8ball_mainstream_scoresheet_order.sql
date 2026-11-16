-- 8-Ball Mainstream plays Billiard Café's paper scoresheet order (UV, 16 Nov).
--
-- UV: its scorecards must look the same as the sheet, so players can follow
-- paper and digital and both line up. Other leagues keep the standard
-- rotation. **No existing data and no existing match is changed; only
-- unplayed matches take it** (UV).
--
-- The sheet (five-man), in the order the frames are played:
--   session 1: H1–A1 H2–A2 H3–A3 H4–A4 H5–A5   (F1–F5, the captains' order)
--   session 2: H2–A3 H3–A4 H4–A5 H5–A1 H1–A2   (F6–F10)
--   session 3: H3–A5 H4–A1 H5–A2 H1–A3 H2–A4   (F11–F15)
--   session 4: H4–A2 H5–A3 H1–A4 H2–A5 H3–A1   (F16–F20)
--   session 5: H5–A4 H1–A5 H2–A1 H3–A2 H4–A3   (F21–F25)
-- The same pairings as the cyclic shift; only the order in each session
-- differs. Session 1 is stored as numbers, the rest as [home, away] pairs,
-- which is what the settings page would save (20261116182736).
--
-- What it does, the same as the LD saving My own table on the settings page:
--   1. sets the league's rotation (nothing else in its rules);
--   2. private.tdc_refreeze_league_matches, which rewrites the frozen rules
--      only of matches with no frames, no locked side and no card events.
-- Read 16 Nov (production, read only): six round-6 matches exist unplayed;
-- five are untouched and carry exactly the league's rules, so only their
-- rotation changes. Cheeky Tiger v Break and Blaze (lineups locked, 5 frames
-- scored) and every played night keep the rules they were frozen with.
-- Matches for later rounds do not exist yet and take the league's rules
-- when they are created.
--
-- Guards: on a copy without the league (the local test database) it does
-- nothing. If the league is no longer five-man on the standard rotation,
-- it stops with nothing changed: something moved since it was read.

do $$
declare
	v_league uuid := 'b4601f93-517b-43bf-b22a-d650fcd1e682';
	v_sheet  jsonb := '[[1,2,3,4,5],[[2,3],[3,4],[4,5],[5,1],[1,2]],[[3,5],[4,1],[5,2],[1,3],[2,4]],[[4,2],[5,3],[1,4],[2,5],[3,1]],[[5,4],[1,5],[2,1],[3,2],[4,3]]]';
	v_rules  jsonb;
	v_touched_before jsonb;
	v_touched_after  jsonb;
	v_untouched integer;
	v_result jsonb;
begin
	select rules into v_rules from public.tbl_leagues where id = v_league;
	if not found then
		raise notice '8-Ball Mainstream is not in this database: nothing to do.';
		return;
	end if;

	if private.tdc_team_size(v_rules) <> 5 or jsonb_typeof(v_rules->'rotation') <> 'null' then
		raise exception 'TDC (Error): 8-Ball Mainstream is no longer five-man on the standard rotation; nothing changed.';
	end if;

	-- Every match that is not untouched, with its rules, to prove afterwards
	-- that none of them changed.
	with lm as (
		select m.id, m.rules,
			(not exists (select 1 from public.tbl_frames fr where fr.match_id = m.id)
				and not exists (select 1 from public.tbl_league_match_sides sd
					where sd.match_id = m.id and sd.locked_at is not null)
				and not exists (select 1 from public.tbl_match_events ev where ev.match_id = m.id)
			) as untouched
		from public.tbl_league_fixtures f
		join public.tbl_league_seasons s on s.id = f.league_season_id
		join public.tbl_matches m on m.id = f.match_id
		where s.league_id = v_league
	)
	select coalesce(jsonb_object_agg(id, rules) filter (where not untouched), '{}'::jsonb),
		count(*) filter (where untouched)
	into v_touched_before, v_untouched
	from lm;

	v_rules := jsonb_set(v_rules, '{rotation}', v_sheet);
	perform private.tdc_check_league_rules(v_rules);

	update public.tbl_leagues set rules = v_rules where id = v_league;

	v_result := private.tdc_refreeze_league_matches(v_league);

	select coalesce(jsonb_object_agg(m.id, m.rules), '{}'::jsonb)
	into v_touched_after
	from public.tbl_matches m
	where v_touched_before ? m.id::text;

	if v_touched_after <> v_touched_before then
		raise exception 'TDC (Error): a played or started match would have changed; nothing changed.';
	end if;

	if (v_result->>'matches_updated')::integer <> v_untouched then
		raise exception 'TDC (Error): expected % unplayed matches to take the order, got %; nothing changed.',
			v_untouched, v_result->>'matches_updated';
	end if;

	raise notice '8-Ball Mainstream: scoresheet order set; % unplayed matches updated, % kept.',
		v_result->>'matches_updated', v_result->>'matches_kept';
end;
$$;
