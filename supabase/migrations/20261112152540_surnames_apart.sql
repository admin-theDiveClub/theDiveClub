-- ───────────────────────────────────────────────────────────
-- Surnames sent on their own
--
-- UV, 12 Nov: wherever a player's first name and surname are shown, the
-- surname is drawn in a lower weight (400) than the first name. The full
-- name reached the page as one string, joined here, so the page could not
-- tell where the surname begins ("Mary Anne Smith"). Each read that sends a
-- full name now also sends the surname alone:
--
--     surname                     tdc_search_opponents, tdc_search_entrants,
--                                 tdc_search_league_players,
--                                 tdc_search_referees, tdc_my_follows,
--                                 tdc_league_standings (each player),
--                                 tdc_player_profile (player)
--     home_surname, away_surname  tdc_tournament_draw (added at the end)
--
-- Null when there is no surname. Nothing new is revealed: the surname is
-- already inside full_name, to the same callers.
--
-- Named "surname", not "last_name", so a table-returning function's output
-- column can never be mistaken for tbl_players.last_name inside it.
--
-- Patched from the text of a freshly reset database (pg_get_functiondef),
-- not retyped. The table-returning ones are dropped and created again,
-- because PostgreSQL will not change a return type in place; their grants
-- and comments are restored below exactly as they were.
-- ───────────────────────────────────────────────────────────

-- tdc_search_opponents: surname after full_name.
drop function if exists public.tdc_search_opponents(text, integer);

CREATE FUNCTION public.tdc_search_opponents(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, display_name text, full_name text, surname text, avatar_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		nullif(trim(p.last_name), ''),
		p.avatar_path
	from public.tbl_players p
	where p.user_id is not null
		and p.id <> coalesce(
			(select x.id from public.tbl_players x where x.user_id = (select auth.uid())),
			'00000000-0000-0000-0000-000000000000'::uuid)
		and char_length(trim(coalesce(p_query, ''))) >= 2
		and (
			p.display_name ilike '%' || trim(p_query) || '%'
			or coalesce(p.first_name, '') ilike '%' || trim(p_query) || '%'
			or coalesce(p.last_name, '')  ilike '%' || trim(p_query) || '%'
		)
	order by p.display_name
	limit greatest(1, least(coalesce(p_limit, 20), 50));
$function$;

-- tdc_search_entrants: surname after full_name.
drop function if exists public.tdc_search_entrants(uuid, text, integer);

CREATE FUNCTION public.tdc_search_entrants(p_tournament_id uuid, p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, display_name text, full_name text, surname text, player_type text, has_account boolean, avatar_path text, already_in boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		nullif(trim(p.last_name), ''),
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
$function$;

-- tdc_search_league_players: surname after full_name.
drop function if exists public.tdc_search_league_players(uuid, text, integer);

CREATE FUNCTION public.tdc_search_league_players(p_league_season_id uuid, p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, display_name text, full_name text, surname text, avatar_path text, entrant_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		nullif(trim(p.last_name), ''),
		p.avatar_path,
		e.status
	from public.tbl_players p
	left join public.tbl_league_season_entrants e
		on e.league_season_id = p_league_season_id and e.player_id = p.id
	where private.tdc_can_run_league(p_league_season_id)
		and p.user_id is not null
		and char_length(trim(coalesce(p_query, ''))) >= 2
		and (
			p.display_name ilike '%' || trim(p_query) || '%'
			or coalesce(p.first_name, '') ilike '%' || trim(p_query) || '%'
			or coalesce(p.last_name, '')  ilike '%' || trim(p_query) || '%'
		)
	order by p.display_name
	limit greatest(1, least(coalesce(p_limit, 20), 50));
$function$;

-- tdc_search_referees: surname after full_name.
drop function if exists public.tdc_search_referees(text, integer);

CREATE FUNCTION public.tdc_search_referees(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, display_name text, full_name text, surname text, avatar_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		nullif(trim(p.last_name), ''),
		p.avatar_path
	from public.tbl_players p
	where p.user_id is not null
		and char_length(trim(coalesce(p_query, ''))) >= 2
		and (
			p.display_name ilike '%' || trim(p_query) || '%'
			or coalesce(p.first_name, '') ilike '%' || trim(p_query) || '%'
			or coalesce(p.last_name, '')  ilike '%' || trim(p_query) || '%'
		)
	order by p.display_name
	limit greatest(1, least(coalesce(p_limit, 20), 50));
$function$;

-- tdc_my_follows: surname after full_name.
drop function if exists public.tdc_my_follows();

CREATE FUNCTION public.tdc_my_follows()
 RETURNS TABLE(player_id uuid, display_name text, full_name text, surname text, avatar_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		nullif(trim(p.last_name), ''),
		p.avatar_path
	from public.tbl_player_follows f
	join public.tbl_players me on me.id = f.follower_id
	join public.tbl_players p on p.id = f.followed_id
	where me.user_id = (select auth.uid())
	order by lower(p.display_name), p.id;
$function$;

-- tdc_tournament_draw: home_surname, away_surname at the end.
drop function if exists public.tdc_tournament_draw(uuid);

CREATE FUNCTION public.tdc_tournament_draw(p_tournament_id uuid)
 RETURNS TABLE(fixture_id uuid, bracket text, round integer, "position" integer, home_entrant_id uuid, home_name text, home_seed integer, home_source text, away_entrant_id uuid, away_name text, away_seed integer, away_source text, match_id uuid, match_status text, home_frames integer, away_frames integer, overridden boolean, override_stale boolean, override_reason text, card_state text, published boolean, needs_approval boolean, objection boolean, winner_entrant_id uuid, advanced_entrant_id uuid, advance_reason text, home_feeder_id uuid, home_feeder_bracket text, home_feeder_round integer, home_feeder_position integer, away_feeder_id uuid, away_feeder_bracket text, away_feeder_round integer, away_feeder_position integer, home_avatar text, home_full_name text, away_avatar text, away_full_name text, home_player_id uuid, away_player_id uuid, home_surname text, away_surname text)
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
		nullif(trim(hp.last_name), ''), nullif(trim(ap.last_name), '')
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

-- tdc_league_standings: surname on each player. Replaced in place (jsonb).
CREATE OR REPLACE FUNCTION public.tdc_league_standings(p_league_season_id uuid, p_live boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with counted as (
		select m.id, m.home_team_id, m.away_team_id, m.status
		from public.tbl_league_fixtures f
		join public.tbl_matches m on m.id = f.match_id
		where f.league_season_id = p_league_season_id
			and (m.status = 'complete'
				-- Live (20261029194712): also a night not yet signed by both, once
				-- it has a finished frame. Never an abandoned one.
				or (p_live and m.status <> 'abandoned' and exists (
					select 1 from public.tbl_frames lf where lf.match_id = m.id and lf.status = 'complete')))
			and m.home_team_id is not null and m.away_team_id is not null
	),
	fr as (
		select f.id, f.match_id, f.winner_side, f.result_event, f.break_side,
			case when f.started_at is not null and f.ended_at is not null
				then greatest(extract(epoch from f.ended_at - f.started_at) - f.paused_seconds, 0) / 60.0
			end as minutes
		from public.tbl_frames f
		join counted c on c.id = f.match_id
		where f.status = 'complete'
	),
	score as (
		select c.id as match_id, c.home_team_id, c.away_team_id,
			count(fr.id) filter (where fr.winner_side = 'home') as home_won,
			count(fr.id) filter (where fr.winner_side = 'away') as away_won
		from counted c
		left join fr on fr.match_id = c.id
		group by c.id, c.home_team_id, c.away_team_id
	),
	-- Each team's side of each counted match, and how it went.
	sides as (
		select match_id, home_team_id as team_id, 'home'::text as side, home_won as mine, away_won as theirs from score
		union all
		select match_id, away_team_id, 'away', away_won, home_won from score
	),
	team_frames as (
		select s.team_id, s.side, fr.*
		from sides s
		join fr on fr.match_id = s.match_id
	),
	player_frames as (
		select p.player_id, tf.*
		from team_frames tf
		join public.tbl_frame_participants p on p.frame_id = tf.id and p.side = tf.side
	),
	people as (
		select e.player_id, e.team_id
		from public.tbl_league_season_entrants e
		where e.league_season_id = p_league_season_id and e.status in ('active', 'inactive')
		union
		select pf.player_id, e.team_id
		from (select distinct player_id from player_frames) pf
		left join public.tbl_league_season_entrants e
			on e.player_id = pf.player_id and e.league_season_id = p_league_season_id
	)
	select jsonb_build_object(
		'matches_counted', (select count(*) from counted),
		'matches_unsigned', (select count(*) from counted where counted.status <> 'complete'),
		'live', p_live,
		-- What a live page watches: every match on the season's fixtures
		-- that is not abandoned (a frame written moves its card_version).
		'watch_match_ids', coalesce((
			select jsonb_agg(m.id)
			from public.tbl_league_fixtures f
			join public.tbl_matches m on m.id = f.match_id
			where f.league_season_id = p_league_season_id and m.status <> 'abandoned'
		), '[]'::jsonb),
		'players', coalesce((
			select jsonb_agg(jsonb_build_object(
				'player_id', pl.id,
				'display_name', pl.display_name,
				-- 20261029203451: the Full names switch. Null when neither is set.
				'full_name', nullif(trim(concat_ws(' ', pl.first_name, pl.last_name)), ''),
				'surname', nullif(trim(pl.last_name), ''),
				'avatar_path', pl.avatar_path,
				'team_id', pe.team_id,
				'stats', jsonb_build_object(
					'frames_played', fs.played,
					'frames_won', fs.won,
					'frames_lost', fs.played - fs.won,
					'frames_won_home', fs.won_home,
					'frames_won_away', fs.won_away,
					'lags_won', fs.lags,
					'won_with_lag', fs.with_lag,
					'won_without_lag', fs.without_lag,
					'break_and_finish', fs.bf,
					'reverse_break_and_finish', fs.rbf,
					'golden_break', fs.gb,
					'walkovers_won', fs.walkovers,
					'matches_played', ms.played,
					'matches_won', ms.won,
					'matches_lost', ms.lost,
					'matches_drawn', ms.drawn,
					'minutes_played', fs.minutes,
					'frames_timed', fs.timed,
					'leagues_played', hist.leagues,
					'seasons_played', hist.seasons
				)
			) order by pl.display_name)
			from people pe
			join public.tbl_players pl on pl.id = pe.player_id
			cross join lateral (
				select count(*) as played,
					count(*) filter (where pf.winner_side = pf.side) as won,
					count(*) filter (where pf.winner_side = pf.side and pf.side = 'home') as won_home,
					count(*) filter (where pf.winner_side = pf.side and pf.side = 'away') as won_away,
					count(*) filter (where pf.break_side = pf.side) as lags,
					count(*) filter (where pf.winner_side = pf.side and pf.break_side = pf.side) as with_lag,
					count(*) filter (where pf.winner_side = pf.side and pf.break_side <> pf.side) as without_lag,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'break_and_finish') as bf,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'reverse_break_and_finish') as rbf,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'golden_break') as gb,
					count(*) filter (where pf.winner_side = pf.side and pf.result_event = 'default') as walkovers,
					round(coalesce(sum(pf.minutes), 0), 1) as minutes,
					count(pf.minutes) as timed
				from player_frames pf
				where pf.player_id = pe.player_id
			) fs
			cross join lateral (
				select count(*) as played,
					count(*) filter (where s.mine > s.theirs) as won,
					count(*) filter (where s.mine < s.theirs) as lost,
					count(*) filter (where s.mine = s.theirs) as drawn
				from sides s
				where exists (
					select 1 from player_frames pf
					where pf.player_id = pe.player_id and pf.match_id = s.match_id and pf.side = s.side
				)
			) ms
			cross join lateral (
				select count(distinct ls.league_id) as leagues, count(distinct e.league_season_id) as seasons
				from public.tbl_league_season_entrants e
				join public.tbl_league_seasons ls on ls.id = e.league_season_id
				where e.player_id = pe.player_id and e.status in ('active', 'inactive')
			) hist
		), '[]'::jsonb),
		'teams', coalesce((
			select jsonb_agg(jsonb_build_object(
				'team_id', t.id,
				'name', t.name,
				'picture_path', t.picture_path,
				'stats', jsonb_build_object(
					'matches_played', ms.played,
					'matches_won', ms.won,
					'matches_lost', ms.lost,
					'matches_drawn', ms.drawn,
					'matches_won_home', ms.won_home,
					'matches_won_away', ms.won_away,
					'frames_played', fs.played,
					'frames_won', fs.won,
					'frames_lost', fs.played - fs.won,
					'lags_won', fs.lags,
					'won_with_lag', fs.with_lag,
					'won_without_lag', fs.without_lag,
					'break_and_finish', fs.bf,
					'reverse_break_and_finish', fs.rbf,
					'golden_break', fs.gb,
					'walkovers_won', fs.walkovers_won,
					'walkovers_given', fs.walkovers_given,
					'players_used', pu.used,
					'minutes_played', fs.minutes,
					'frames_timed', fs.timed
				)
			) order by t.name)
			from public.tbl_teams t
			cross join lateral (
				select count(*) as played,
					count(*) filter (where s.mine > s.theirs) as won,
					count(*) filter (where s.mine < s.theirs) as lost,
					count(*) filter (where s.mine = s.theirs) as drawn,
					count(*) filter (where s.mine > s.theirs and s.side = 'home') as won_home,
					count(*) filter (where s.mine > s.theirs and s.side = 'away') as won_away
				from sides s
				where s.team_id = t.id
			) ms
			cross join lateral (
				select count(*) as played,
					count(*) filter (where tf.winner_side = tf.side) as won,
					count(*) filter (where tf.break_side = tf.side) as lags,
					count(*) filter (where tf.winner_side = tf.side and tf.break_side = tf.side) as with_lag,
					count(*) filter (where tf.winner_side = tf.side and tf.break_side <> tf.side) as without_lag,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'break_and_finish') as bf,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'reverse_break_and_finish') as rbf,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'golden_break') as gb,
					count(*) filter (where tf.winner_side = tf.side and tf.result_event = 'default') as walkovers_won,
					count(*) filter (where tf.winner_side <> tf.side and tf.result_event = 'default') as walkovers_given,
					round(coalesce(sum(tf.minutes), 0), 1) as minutes,
					count(tf.minutes) as timed
				from team_frames tf
				where tf.team_id = t.id
			) fs
			cross join lateral (
				select count(distinct pf.player_id) as used
				from player_frames pf
				where pf.team_id = t.id
			) pu
			where t.league_season_id = p_league_season_id
		), '[]'::jsonb)
	);
$function$;

-- tdc_player_profile: surname on the player. Replaced in place (jsonb).
CREATE OR REPLACE FUNCTION public.tdc_player_profile(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me uuid;
	v_out jsonb;
begin
	if (select auth.uid()) is null then
		raise exception 'Sign in to see a player''s profile.';
	end if;
	if not exists (select 1 from public.tbl_players p where p.id = p_player_id) then
		raise exception 'No player with that id. Check the link.';
	end if;
	select p.id into v_me from public.tbl_players p where p.user_id = (select auth.uid());

	with in_match as (
		-- The side of the frames they are in, as tdc_my_matches reads it; a
		-- singles match naming them; a team night's squad (never the order).
		select x.match_id, min(x.side) as side
		from (
			select f.match_id, fp.side
			from public.tbl_frame_participants fp
			join public.tbl_frames f on f.id = fp.frame_id
			where fp.player_id = p_player_id
			union all
			select m.id, case when m.home_player_id = p_player_id then 'home' else 'away' end
			from public.tbl_matches m
			where p_player_id in (m.home_player_id, m.away_player_id)
			union all
			select q.match_id, q.side
			from public.tbl_league_match_squad q
			where q.player_id = p_player_id
		) x
		group by x.match_id
	),
	counted as (
		select m.id, m.home_side_kind, m.away_side_kind, m.home_player_id, m.away_player_id,
			m.home_team_id, m.away_team_id, m.rules, m.status, s.side,
			coalesce(m.started_at, m.scheduled_at, m.created_at) as played_at,
			(select count(*) from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side = s.side)::integer as mine,
			(select count(*) from public.tbl_frames f
				where f.match_id = m.id and f.status = 'complete' and f.winner_side <> s.side)::integer as theirs
		from in_match s
		join public.tbl_matches m on m.id = s.match_id
	)
	select jsonb_build_object(
		'player', (
			select jsonb_build_object(
				'player_id', p.id,
				'display_name', p.display_name,
				'full_name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
				'surname', nullif(trim(p.last_name), ''),
				'avatar_path', p.avatar_path,
				'since', p.created_at,
				'verified', exists (
					select 1 from public.tbl_player_identifiers i
					join public.tbl_identifier_verifications v on v.identifier_id = i.id
					where i.player_id = p.id and v.revoked_at is null),
				'is_me', p.id is not distinct from v_me
			)
			from public.tbl_players p where p.id = p_player_id
		),
		'matches', coalesce((
			select jsonb_agg(jsonb_build_object(
				'match_id', c.id,
				'status', c.status,
				'played_at', c.played_at,
				'kind', case when lf.match_id is not null then 'league'
					when tf.match_id is not null then 'tournament' else 'social' end,
				'competition', coalesce(lg.name, tn.name),
				'discipline', c.rules ->> 'discipline',
				'team_match', c.home_side_kind = 'team' and c.away_side_kind = 'team',
				'my_side', c.side,
				'my_team', mt.name,
				'opponent', case when op_kind = 'team' then coalesce(ot.name, 'Team')
					else coalesce(op.display_name, 'TDC (Error)') end,
				'opponent_player_id', op.id,
				'opponent_avatar', case when op_kind = 'team' then null else op.avatar_path end,
				'opponent_team_id', ot.id,
				'opponent_team_picture', ot.picture_path,
				'mine', c.mine,
				'theirs', c.theirs,
				'venues', private.tdc_match_venue_list(c.id)
			) order by c.played_at desc)
			from counted c
			cross join lateral (select case when c.side = 'home' then c.away_side_kind else c.home_side_kind end as op_kind) k
			left join public.tbl_players op
				on op.id = case when c.side = 'home' then c.away_player_id else c.home_player_id end
			left join public.tbl_teams ot
				on ot.id = case when c.side = 'home' then c.away_team_id else c.home_team_id end
			left join public.tbl_teams mt
				on mt.id = case when c.side = 'home' then c.home_team_id else c.away_team_id end
			left join lateral (select x.match_id, x.league_season_id from public.tbl_league_fixtures x where x.match_id = c.id limit 1) lf on true
			left join public.tbl_league_seasons ls on ls.id = lf.league_season_id
			left join public.tbl_leagues lg on lg.id = ls.league_id
			left join lateral (select x.match_id, x.tournament_id from public.tbl_tournament_fixtures x where x.match_id = c.id limit 1) tf on true
			left join public.tbl_tournaments tn on tn.id = tf.tournament_id
		), '[]'::jsonb),
		'frames', coalesce((
			select jsonb_agg(jsonb_build_object(
				'match_id', f.match_id,
				'frame_no', f.frame_no,
				'at', coalesce(f.ended_at, f.started_at, c.played_at),
				'won', coalesce(f.winner_side = fp.side, false),
				'broke', case when f.break_side is null then null else f.break_side = fp.side end,
				'result_event', f.result_event
			) order by c.played_at desc, f.frame_no)
			from counted c
			join public.tbl_frames f on f.match_id = c.id and f.status = 'complete'
			join public.tbl_frame_participants fp on fp.frame_id = f.id and fp.player_id = p_player_id
			where c.status = 'complete'   -- what is counted: finished matches only
		), '[]'::jsonb),
		'teams', coalesce((
			select jsonb_agg(jsonb_build_object(
				'league_season_id', ls.id,
				'season_name', ls.name,
				'league_id', lg.id,
				'league_name', lg.name,
				'league_picture', lg.picture_path,
				'discipline', private.tdc_rules_for_league_season(ls.id) ->> 'discipline',
				'team_id', t.id,
				'team_name', t.name,
				'team_picture', t.picture_path,
				'is_captain', coalesce(e.is_captain, false),
				'status', e.status,
				'venues', private.tdc_season_venue_list(ls.id)
			) order by ls.created_at desc)
			from public.tbl_league_season_entrants e
			join public.tbl_league_seasons ls on ls.id = e.league_season_id
			join public.tbl_leagues lg on lg.id = ls.league_id
			left join public.tbl_teams t on t.id = e.team_id
			where e.player_id = p_player_id and e.status in ('active', 'inactive')
		), '[]'::jsonb)
	) into v_out;

	return v_out;
end;
$function$;

-- Grants and comments, as they were before the drop.
revoke execute on function public.tdc_search_opponents(text, integer) from public, anon;
grant execute on function public.tdc_search_opponents(text, integer) to authenticated;
revoke execute on function public.tdc_search_entrants(uuid, text, integer) from public, anon;
grant execute on function public.tdc_search_entrants(uuid, text, integer) to authenticated;
revoke execute on function public.tdc_search_league_players(uuid, text, integer) from public, anon;
grant execute on function public.tdc_search_league_players(uuid, text, integer) to authenticated;
revoke execute on function public.tdc_search_referees(text, integer) from public, anon;
grant execute on function public.tdc_search_referees(text, integer) to authenticated;
revoke execute on function public.tdc_my_follows() from public, anon;
grant execute on function public.tdc_my_follows() to authenticated;
revoke execute on function public.tdc_tournament_draw(uuid) from public, anon;
grant execute on function public.tdc_tournament_draw(uuid) to authenticated;
comment on function public.tdc_search_entrants(uuid, text, integer) is
	'Player search for a tournament entrant list. Unlike tdc_search_opponents it includes walk-ins and the caller, and is therefore restricted to people who run the tournament.';
comment on function public.tdc_tournament_draw(uuid) is
	'The whole draw in one call: names, scores, card states, and where each slot comes from — the feeder''s id and bracket as well as its round and position, so the page can draw an arrow to it rather than infer one. Each player''s picture, full name and player id for the cards.';
