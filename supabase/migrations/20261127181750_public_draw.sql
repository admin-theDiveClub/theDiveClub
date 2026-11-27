-- ───────────────────────────────────────────────────────────
-- The draw open to the public
--
-- UV, 27 Nov (Basil's Friday Super Comp, minutes before the start): "I need
-- the bracket view opened to the public, autosized to fit."
--
--   tdc_public_draw          the draw for a signed-out visitor: the rows of
--                            tdc_tournament_draw for a tournament set Visible
--                            to public (is_listed), without full names,
--                            surnames or override reasons (full names stay for
--                            signed-in players; UV, 27 Nov, "Private columns
--                            hidden"). tdc_tournament_draw itself is not
--                            touched: the live poster reads it inside its own
--                            function, for signed-out visitors too, and must
--                            not change.
--   tdc_tournament_public    the tournament's name and the facts the draw
--                            page's heading shows, on the same terms (a
--                            signed-out visitor cannot read tbl_tournaments).
--   tdc_tournament_venue_list  opened to signed-out visitors: where it is
--                            played, as the poster already shows.
-- ───────────────────────────────────────────────────────────

create function public.tdc_public_draw(p_tournament_id uuid)
returns table(fixture_id uuid, bracket text, round integer, "position" integer, home_entrant_id uuid, home_name text, home_seed integer, home_source text, away_entrant_id uuid, away_name text, away_seed integer, away_source text, match_id uuid, match_status text, home_frames integer, away_frames integer, overridden boolean, override_stale boolean, override_reason text, card_state text, published boolean, needs_approval boolean, objection boolean, winner_entrant_id uuid, advanced_entrant_id uuid, advance_reason text, home_feeder_id uuid, home_feeder_bracket text, home_feeder_round integer, home_feeder_position integer, away_feeder_id uuid, away_feeder_bracket text, away_feeder_round integer, away_feeder_position integer, home_avatar text, home_full_name text, away_avatar text, away_full_name text, home_player_id uuid, away_player_id uuid, home_surname text, away_surname text, track_breaks boolean, first_break_side text)
language sql
stable
security definer
set search_path = ''
as $$
	select d.fixture_id,
		d.bracket,
		d.round,
		d."position",
		d.home_entrant_id,
		d.home_name,
		d.home_seed,
		d.home_source,
		d.away_entrant_id,
		d.away_name,
		d.away_seed,
		d.away_source,
		d.match_id,
		d.match_status,
		d.home_frames,
		d.away_frames,
		d.overridden,
		d.override_stale,
		null::text as override_reason,
		d.card_state,
		d.published,
		d.needs_approval,
		d.objection,
		d.winner_entrant_id,
		d.advanced_entrant_id,
		d.advance_reason,
		d.home_feeder_id,
		d.home_feeder_bracket,
		d.home_feeder_round,
		d.home_feeder_position,
		d.away_feeder_id,
		d.away_feeder_bracket,
		d.away_feeder_round,
		d.away_feeder_position,
		d.home_avatar,
		null::text as home_full_name,
		d.away_avatar,
		null::text as away_full_name,
		d.home_player_id,
		d.away_player_id,
		null::text as home_surname,
		null::text as away_surname,
		d.track_breaks,
		d.first_break_side
	from public.tdc_tournament_draw(p_tournament_id) d
	where exists (select 1 from public.tbl_tournaments t where t.id = p_tournament_id and t.is_listed);
$$;

revoke execute on function public.tdc_public_draw(uuid) from public;
grant execute on function public.tdc_public_draw(uuid) to anon, authenticated;

comment on function public.tdc_public_draw(uuid) is
	'The draw for a signed-out visitor, when the tournament is set Visible to public: tdc_tournament_draw''s rows without full names, surnames or override reasons.';

create function public.tdc_tournament_public(p_tournament_id uuid)
returns table (id uuid, name text, format text, status text, starts_at timestamptz,
	third_place boolean, progression text, create_matches text, max_entrants integer)
language sql
stable
security definer
set search_path = ''
as $$
	select t.id, t.name, t.format, t.status, t.starts_at, t.third_place, t.progression, t.create_matches, t.max_entrants
	from public.tbl_tournaments t
	where t.id = p_tournament_id and t.is_listed;
$$;

revoke execute on function public.tdc_tournament_public(uuid) from public;
grant execute on function public.tdc_tournament_public(uuid) to anon, authenticated;

comment on function public.tdc_tournament_public(uuid) is
	'A tournament''s name and the facts the draw page''s heading shows, for a signed-out visitor, when it is set Visible to public.';

grant execute on function public.tdc_tournament_venue_list(uuid) to anon;
