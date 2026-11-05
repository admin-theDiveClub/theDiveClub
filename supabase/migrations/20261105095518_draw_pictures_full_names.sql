-- ───────────────────────────────────────────────────────────
-- The draw, with each player's picture and full name
--
-- UV, 5 Nov: the draw page's cards show each player's profile picture with
-- their name, and a Full names switch (as the standings have) shows first
-- and last names in place of display names.
--
-- Four columns added at the end, from the player joins already there:
--
--     home_avatar, home_full_name
--     away_avatar, away_full_name
--
-- The full name is worked out as the standings work it out (20261029203451):
-- first and last name, or null when neither is set, so the page falls back to
-- the display name. Readable by anybody signed in, as the draw always was and
-- as the standings' full names are.
--
-- Patched from the 20261022170000 text, not retyped.
-- ───────────────────────────────────────────────────────────

-- Dropped rather than replaced: this adds columns, and PostgreSQL will not
-- change the return type of an existing function in place.
drop function if exists public.tdc_tournament_draw(uuid);

create function public.tdc_tournament_draw(p_tournament_id uuid)

returns table (
	fixture_id uuid,
	bracket text,
	round integer,
	"position" integer,
	home_entrant_id uuid,
	home_name text,
	home_seed integer,
	home_source text,
	away_entrant_id uuid,
	away_name text,
	away_seed integer,
	away_source text,
	match_id uuid,
	match_status text,
	home_frames integer,
	away_frames integer,
	overridden boolean,
	override_stale boolean,
	override_reason text,
	card_state text,
	published boolean,
	needs_approval boolean,
	objection boolean,
	winner_entrant_id uuid,
	advanced_entrant_id uuid,
	advance_reason text,
	home_feeder_id uuid,
	home_feeder_bracket text,
	home_feeder_round integer,
	home_feeder_position integer,
	away_feeder_id uuid,
	away_feeder_bracket text,
	away_feeder_round integer,
	away_feeder_position integer,
	home_avatar text,
	home_full_name text,
	away_avatar text,
	away_full_name text
)
language sql
stable
security definer
set search_path = ''
as $$
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
		ap.avatar_path, nullif(trim(concat_ws(' ', ap.first_name, ap.last_name)), '')
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
$$;

comment on function public.tdc_tournament_draw(uuid) is
	'The whole draw in one call: names, scores, card states, and where each slot comes from — the feeder''s id and bracket as well as its round and position, so the page can draw an arrow to it rather than infer one. Each player''s picture and full name for the cards.';

revoke execute on function public.tdc_tournament_draw(uuid) from public, anon;
grant execute on function public.tdc_tournament_draw(uuid) to authenticated;
