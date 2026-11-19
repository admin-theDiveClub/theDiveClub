-- 8-Ball Mainstream: reverse break & finish onto every match it has (UV, 19 Nov).
--
-- The LD switched rBF on in the league's settings on 19 Nov, after 08:03.
-- A settings save re-freezes only untouched matches (no frames, no locked
-- side, no card events; tdc_refreeze_league_matches), so only Break and
-- Blaze v Knights took it. The Ultimates v Cheeky Tiger and Wu Tang Clan v
-- Foul Play Syndicate (25 Nov, lineups locked, nothing played) and the 36
-- played nights kept rBF off, and their scorecards offered no rBF stop.
--
-- UV chose: every match in the league, played nights included. On a played
-- night it only adds rBF as a choice when a frame is corrected; no frame
-- changes, and none can be rescored, because no frame was ever recorded as
-- an rBF while it was off. The re-freeze rule itself is unchanged.
--
-- What it does: on every match of the league's fixtures whose frozen rules
-- have reverse_break_finish_enabled not true, sets that one key to true.
-- Nothing else in any match's rules changes (played nights keep the
-- rotation they were frozen with). Matches not on a fixture (six leftovers
-- from 11 and 18 Nov, no frames) are left alone.
-- Read 19 Nov (production, read only): 38 such matches.
--
-- Guards: on a copy without the league (the local test database) it does
-- nothing. If the league no longer tracks breaks with rBF on, it stops with
-- nothing changed. Afterwards it proves every match's rules, apart from
-- that key, are exactly what they were.

do $$
declare
	v_league uuid := 'b4601f93-517b-43bf-b22a-d650fcd1e682';
	v_rules  jsonb;
	v_before jsonb;
	v_after  jsonb;
	v_todo   integer;
	v_done   integer;
	v_m      record;
begin
	select rules into v_rules from public.tbl_leagues where id = v_league;
	if not found then
		raise notice '8-Ball Mainstream is not in this database: nothing to do.';
		return;
	end if;

	if not coalesce((v_rules->>'track_breaks')::boolean, false)
		or not coalesce((v_rules->>'reverse_break_finish_enabled')::boolean, false) then
		raise exception 'TDC (Error): 8-Ball Mainstream no longer has reverse break & finish on; nothing changed.';
	end if;

	-- Every match of the league, its rules without the key, to prove after.
	select coalesce(jsonb_object_agg(m.id, m.rules - 'reverse_break_finish_enabled'), '{}'::jsonb),
		count(*) filter (where (m.rules->'reverse_break_finish_enabled') is distinct from 'true'::jsonb)
	into v_before, v_todo
	from public.tbl_league_fixtures f
	join public.tbl_league_seasons s on s.id = f.league_season_id
	join public.tbl_matches m on m.id = f.match_id
	where s.league_id = v_league;

	-- Each new set of rules must still pass the match rules check.
	for v_m in
		select m.id, m.rules
		from public.tbl_league_fixtures f
		join public.tbl_league_seasons s on s.id = f.league_season_id
		join public.tbl_matches m on m.id = f.match_id
		where s.league_id = v_league
			and (m.rules->'reverse_break_finish_enabled') is distinct from 'true'::jsonb
	loop
		perform private.tdc_check_match_rules(jsonb_set(v_m.rules, '{reverse_break_finish_enabled}', 'true'::jsonb));
	end loop;

	with upd as (
		update public.tbl_matches m
		set rules = jsonb_set(m.rules, '{reverse_break_finish_enabled}', 'true'::jsonb)
		from public.tbl_league_fixtures f
		join public.tbl_league_seasons s on s.id = f.league_season_id
		where f.match_id = m.id and s.league_id = v_league
			and (m.rules->'reverse_break_finish_enabled') is distinct from 'true'::jsonb
		returning m.id
	)
	select count(*) into v_done from upd;

	select coalesce(jsonb_object_agg(m.id, m.rules - 'reverse_break_finish_enabled'), '{}'::jsonb)
	into v_after
	from public.tbl_matches m
	where v_before ? m.id::text;

	if v_after <> v_before then
		raise exception 'TDC (Error): something other than rBF would have changed in a match''s rules; nothing changed.';
	end if;

	if v_done <> v_todo then
		raise exception 'TDC (Error): expected % matches to take rBF, got %; nothing changed.', v_todo, v_done;
	end if;

	raise notice '8-Ball Mainstream: reverse break & finish on for % matches.', v_done;
end;
$$;
