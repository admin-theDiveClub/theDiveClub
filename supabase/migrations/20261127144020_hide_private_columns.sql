-- Private columns hidden from direct reads (STATUS 1a B2; UV, 27 Nov;
-- docs/systems/foundations.md, "Private columns").
--
-- Every signed-in user could read these straight from the API, because each
-- table's read rule is "using (true)" and the table-wide grant covered every
-- column. The 21 Oct gate on tdc_tournament_entrants closed the function, not
-- the table. Now the table-wide SELECT is taken away and given back column by
-- column, every column except the private ones:
--
--   tbl_tournament_entrants    paid_at, notes   (directors read them through tdc_tournament_entrants)
--   tbl_tournaments            notes
--   tbl_tournament_fixtures    notes
--   tbl_leagues                notes
--   tbl_league_seasons         notes
--   tbl_league_fixtures        notes
--   tbl_match_events           note             (the card shows it through tdc_card_state)
--   tbl_match_result_override  reason
--
-- Checked 27 Nov: no page reads any of these columns directly, none selects
-- "*" from these tables, and none writes to them directly; every view of them
-- goes through a security-definer function, which is unaffected. Realtime
-- (tbl_match_events, tbl_match_result_override, tbl_tournament_fixtures)
-- checks column privileges and leaves the hidden ones out of what it sends.
--
-- Players' full names (B2's other half) stay readable: UV, 27 Nov, they are
-- shown to signed-in players by design (search, profile, draw, standings).
--
-- ⚠ From now on a NEW column on one of these eight tables is not readable by
-- signed-in users until a migration grants it: add it to the table's grant,
-- as below. anon had no SELECT on any of them and still has none.

revoke select on public.tbl_tournament_entrants from authenticated;
grant select (id, created_at, added_by, tournament_id, player_id, status, seed)
	on public.tbl_tournament_entrants to authenticated;

revoke select on public.tbl_tournaments from authenticated;
grant select (id, created_at, created_by, venue_id, name, format, status, rules, starts_at,
	max_entrants, entry_fee_credits, sanctioned, third_place, progression, create_matches,
	status_manual, entry_mode, paid_confirms, is_listed, short_code, short_code_by,
	next_match_number, picture_path, is_recurring, series_id)
	on public.tbl_tournaments to authenticated;

revoke select on public.tbl_tournament_fixtures from authenticated;
grant select (id, created_at, tournament_id, bracket, round, position, home_source_type,
	home_source_ref, away_source_type, away_source_ref, home_entrant_id, away_entrant_id,
	match_id, advanced_entrant_id, advance_reason, match_number)
	on public.tbl_tournament_fixtures to authenticated;

revoke select on public.tbl_leagues from authenticated;
grant select (id, created_at, created_by, venue_id, name, rules, picture_path, short_code,
	short_code_by, next_match_number, document_path, show_generated_rules)
	on public.tbl_leagues to authenticated;

revoke select on public.tbl_league_seasons from authenticated;
grant select (id, created_at, created_by, league_id, season_id, name, rules_overrides,
	entry_mode, paid_confirms, is_listed, max_reserves, status, public_shows_players)
	on public.tbl_league_seasons to authenticated;

revoke select on public.tbl_league_fixtures from authenticated;
grant select (id, created_at, created_by, league_season_id, round, position, home_team_id,
	away_team_id, match_id, scheduled_at, table_numbers, venue_id, match_number, external_ref)
	on public.tbl_league_fixtures to authenticated;

revoke select on public.tbl_match_events from authenticated;
grant select (id, created_at, match_id, player_id, kind, card_version, side, card_fingerprint, signed_as)
	on public.tbl_match_events to authenticated;

revoke select on public.tbl_match_result_override from authenticated;
grant select (match_id, home_score, away_score, set_by, set_at, counted_home, counted_away, card_version)
	on public.tbl_match_result_override to authenticated;
