-- ───────────────────────────────────────────────────────────
-- The draw says who won the lag, and whether a match records it
--
-- UV, 27 Nov: Run the draw gets a second view, Rounds, each round laid out
-- as a session of the league scorecard, a row per match with its score. A
-- match's lag is shown there only when its rules record who breaks
-- ("Record who breaks", track_breaks in TDCMatchDef): "the lag switch
-- shouldn't be there at all unless the setting for who breaks is on".
--
-- tdc_tournament_draw gains two columns at the end:
--
--     track_breaks      the match's frozen rules' track_breaks; null when the
--                       fixture has no match yet (the page then goes by the
--                       round's or the tournament's rules, which it reads)
--     first_break_side  who won the lag (tbl_matches.first_break_side),
--                       home, away or null
--
-- Nothing new is revealed: any signed-in user can read a match's rules and
-- lag on the match page already. The lag is written as the match page
-- writes it, through tdc_update_match_settings, so no writer changes.
--
-- Patched from the text of a freshly reset database (pg_get_functiondef),
-- not retyped: the two columns added, nothing else. Dropped and created
-- again, because PostgreSQL will not change a return type in place; its
-- grants and comment are put back below.
-- ───────────────────────────────────────────────────────────

drop function if exists public.tdc_tournament_draw(uuid);

CREATE FUNCTION public.tdc_tournament_draw(p_tournament_id uuid)
 RETURNS TABLE(fixture_id uuid, bracket text, round integer, "position" integer, home_entrant_id uuid, home_name text, home_seed integer, home_source text, away_entrant_id uuid, away_name text, away_seed integer, away_source text, match_id uuid, match_status text, home_frames integer, away_frames integer, overridden boolean, override_stale boolean, override_reason text, card_state text, published boolean, needs_approval boolean, objection boolean, winner_entrant_id uuid, advanced_entrant_id uuid, advance_reason text, home_feeder_id uuid, home_feeder_bracket text, home_feeder_round integer, home_feeder_position integer, away_feeder_id uuid, away_feeder_bracket text, away_feeder_round integer, away_feeder_position integer, home_avatar text, home_full_name text, away_avatar text, away_full_name text, home_player_id uuid, away_player_id uuid, home_surname text, away_surname text, track_breaks boolean, first_break_side text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select f.id, f.bracket, f.round, f.position,
		f.home_entrant_id, hp.display_name, he.seed, f.home_source_type,
		f.away_entrant_id, ap.display_name, ae.seed, f.away_source_type,
		f.match_id, m.status,
		s.home_score, s.away_score,
		coalesce(s.overridden, false), coalesce(s.stale, false), o.reason,
		cs->>'state',
		coalesce((cs->>'published')::boolean, false),
		coalesce(m.rules->>'approval_mode', 'none') in ('coordinator_approval', 'both'),
		cs ? 'objection',
		(select x.winner_entrant_id from private.tdc_fixture_outcome(f.id) x),
		f.advanced_entrant_id, f.advance_reason,
		hf.id, hf.bracket, hf.round, hf.position,
		af.id, af.bracket, af.round, af.position,
		hp.avatar_path, nullif(trim(concat_ws(' ', hp.first_name, hp.last_name)), ''),
		ap.avatar_path, nullif(trim(concat_ws(' ', ap.first_name, ap.last_name)), ''),
		he.player_id, ae.player_id,
		nullif(trim(hp.last_name), ''), nullif(trim(ap.last_name), ''),
		case when m.id is not null then coalesce((m.rules->>'track_breaks')::boolean, false) end,
		m.first_break_side
	from public.tbl_tournament_fixtures f
	left join public.tbl_matches m              on m.id = f.match_id
	left join lateral private.tdc_match_score(f.match_id) s on f.match_id is not null
	left join lateral (select private.tdc_card_state(f.match_id) as cs) c on f.match_id is not null
	left join public.tbl_match_result_override o on o.match_id = f.match_id
	left join public.tbl_tournament_entrants he on he.id = f.home_entrant_id
	left join public.tbl_players hp             on hp.id = he.player_id
	left join public.tbl_tournament_entrants ae on ae.id = f.away_entrant_id
	left join public.tbl_players ap             on ap.id = ae.player_id
	left join public.tbl_tournament_fixtures hf on hf.id = f.home_source_ref
		and f.home_source_type in ('winner_of', 'loser_of')
	left join public.tbl_tournament_fixtures af on af.id = f.away_source_ref
		and f.away_source_type in ('winner_of', 'loser_of')
	where f.tournament_id = p_tournament_id
	order by f.bracket, f.round, f.position;
$function$;

revoke execute on function public.tdc_tournament_draw(uuid) from public, anon;
grant execute on function public.tdc_tournament_draw(uuid) to authenticated;

comment on function public.tdc_tournament_draw(uuid) is
	'The whole draw in one call: names, scores, card states, and where each slot comes from — the feeder''s id and bracket as well as its round and position, so the page can draw an arrow to it rather than infer one. Each player''s picture, full name and player id for the cards. Whether each match records who breaks, and who won its lag, for the Rounds view.';
