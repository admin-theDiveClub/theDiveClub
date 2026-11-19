-- Singles leagues (UV, 24 Oct: "a team size of 1 will mean singles"; built 19 Nov 2026).
--
-- Settled with UV on 19 Nov (docs/DECISIONS.md, "Singles leagues: …"):
--   * A singles player is a team of one, made automatically. Fixtures, byes,
--     the circle method, readiness and Standings all keep working on teams.
--   * A singles night is a normal singles match on /match/ (player against
--     player), the teams staying on the fixture. Its card settles as any
--     singles card does: it counts once submitted, the opponent agrees or the
--     dispute window passes, a dispute reopens it. Nothing here changes that:
--     private.tdc_match_competition knows only tournaments, so a league match
--     is never "published" and its Approval setting has no effect.
--   * Only the league director starts a fixture's match, as in team leagues.
--   * A new singles season ranks by matches won, then frames won.
--   * A season may switch between singles and teams at any time; the
--     director sorts the teams out. Unplaced active players get their team of
--     one at the switch; a team that is not one active player is refused only
--     when its match is started.
--
-- Patched from a freshly reset database (pg_get_functiondef), not retyped:
-- private.tdc_check_match_rules, private.tdc_check_league_rules,
-- private.tdc_team_limit, public.tdc_create_team, public.tdc_league_standings,
-- private.tdc_seed_standing_columns, public.tdc_create_league_match. Each
-- diff against the original is the lines marked "19 Nov" / "singles" only.
--
-- No new table refers to tbl_players, so private.tdc_merge_players is unchanged.


-- ─── Is this season singles? The one place it is answered ───

create function private.tdc_singles_season(p_league_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	-- Never null: an unknown season is not singles.
	select coalesce((
		select private.tdc_team_size(private.tdc_rules_for_league_season(p_league_season_id)) = 1
	), false);
$$;
revoke execute on function private.tdc_singles_season(uuid) from public, anon, authenticated;


-- ─── Team size 1 is a ruleset's singles ───
-- Patched: the range check takes 1, and a singles ruleset has no rotation table.

CREATE OR REPLACE FUNCTION private.tdc_check_match_rules(p_rules jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
	-- Version 1, exactly as it shipped on 15 October and exactly as the
	-- eighteen matches already played are frozen against. Nothing may be added
	-- to this list, ever: a match scored under version 1 keeps its meaning.
	v_v1 text[] := array[
		'version', 'discipline', 'win_condition_type', 'win_condition_target',
		'track_breaks', 'break_determination', 'break_finish_enabled',
		'draws_allowed', 'tiebreak_method', 'on_time_expiry',
		'max_match_minutes', 'golden_break_enabled', 'reverse_break_finish_enabled',
		'break_finish_requires_breaker', 'shot_clock_enabled', 'shot_clock_seconds',
		'shot_clock_first_shot_seconds', 'extensions_per_player', 'extension_seconds',
		'referee_required', 'score_entry_mode', 'approval_mode', 'dispute_window_hours'
	];
	-- Version 2 adds the two settings team play needs. A new list rather than
	-- an edit to the one above, which is what the 15 October note said a later
	-- version would do — and it has to be, because the match page reads a
	-- match's stored ruleset and sends it straight back when a setting is
	-- changed. Adding a required key to version 1 would have failed every
	-- match played so far, the first time anybody touched its settings.
	v_v2 text[] := v_v1 || array['lineup_cutoff_hours', 'strict_frame_order'];
	-- Version 3 (23 Oct): a team night is sessions. Frozen like the others.
	v_v3 text[] := v_v2 || array['team_size', 'rotation'];

	v_required text[];
	v_missing  text[];
	v_extra    text[];

	v_n   integer;
	v_s   integer;
	v_row jsonb;
	v_pairs boolean;
begin
	if p_rules is null or jsonb_typeof(p_rules) <> 'object' then
		raise exception 'TDC (Error): the ruleset must be a json object.';
	end if;

	v_required := case p_rules->>'version'
		when '1' then v_v1
		when '2' then v_v2
		when '3' then v_v3
	end;

	if v_required is null then
		raise exception 'TDC (Error): unknown ruleset version "%".', p_rules->>'version';
	end if;

	select array_agg(k) into v_missing from unnest(v_required) k where not (p_rules ? k);
	if v_missing is not null then
		raise exception 'TDC (Error): the ruleset is missing %.', array_to_string(v_missing, ', ');
	end if;

	select array_agg(k) into v_extra
	from (select k from jsonb_object_keys(p_rules) k) s
	where k <> all (v_required);
	if v_extra is not null then
		raise exception 'TDC (Error): the ruleset has unknown setting(s) %.', array_to_string(v_extra, ', ');
	end if;

	if p_rules->>'discipline' not in ('8ball', '9ball', '10ball', 'blackball') then
		raise exception 'TDC (Error): unknown discipline "%".', p_rules->>'discipline'; end if;
	-- free_play is the new one: a running score with nothing to reach.
	if p_rules->>'win_condition_type' not in ('race_to', 'best_of', 'fixed_frames', 'timed', 'free_play') then
		raise exception 'TDC (Error): unknown win condition "%".', p_rules->>'win_condition_type'; end if;
	if p_rules->>'break_determination' not in
		('alternate', 'winner_breaks', 'loser_breaks', 'first_breaks', 'lag_each_frame', 'by_schedule') then
		raise exception 'TDC (Error): unknown break rule "%".', p_rules->>'break_determination'; end if;
	if p_rules->>'tiebreak_method' not in ('sudden_death_frame', 'decider_on_lag', 'coordinator_decision') then
		raise exception 'TDC (Error): unknown tiebreak method "%".', p_rules->>'tiebreak_method'; end if;
	if p_rules->>'on_time_expiry' not in ('stop_immediately', 'finish_current_frame') then
		raise exception 'TDC (Error): unknown time expiry rule "%".', p_rules->>'on_time_expiry'; end if;
	if p_rules->>'score_entry_mode' not in ('td_only', 'referee', 'scorer', 'players') then
		raise exception 'TDC (Error): unknown score entry mode "%".', p_rules->>'score_entry_mode'; end if;
	if p_rules->>'approval_mode' not in ('none', 'dispute_window', 'coordinator_approval', 'both') then
		raise exception 'TDC (Error): unknown approval mode "%".', p_rules->>'approval_mode'; end if;

	-- The two version 2 settings are type-checked, which the version 1 keys
	-- never were. The design note calls this jsonb quietly becoming an
	-- unvalidated config format the heaviest standing risk in the system; the
	-- older keys are a job of their own (docs/STATUS.md), but new ones should
	-- not be added to the pile.
	if p_rules ? 'strict_frame_order'
		and jsonb_typeof(p_rules->'strict_frame_order') <> 'boolean' then
		raise exception 'TDC (Error): strict_frame_order must be true or false.';
	end if;

	if p_rules ? 'lineup_cutoff_hours' then
		if jsonb_typeof(p_rules->'lineup_cutoff_hours') <> 'number'
			or (p_rules->>'lineup_cutoff_hours')::numeric <> floor((p_rules->>'lineup_cutoff_hours')::numeric)
			or (p_rules->>'lineup_cutoff_hours')::numeric < 0
			or (p_rules->>'lineup_cutoff_hours')::numeric > 336 then
			raise exception 'TDC (Error): lineup_cutoff_hours must be a whole number of hours from 0 to 336.';
		end if;
	end if;

	-- Version 3. 0 means the league does not play in sessions. 1 is a
	-- singles league (UV, 24 Oct; built 19 Nov): each player their own team
	-- of one, each night a singles match, so it has no sessions either.
	if p_rules ? 'team_size' then
		if jsonb_typeof(p_rules->'team_size') <> 'number'
			or (p_rules->>'team_size')::numeric <> floor((p_rules->>'team_size')::numeric)
			or (p_rules->>'team_size')::numeric not between 0 and 10 then
			raise exception 'TDC (Error): team_size must be 0 (no sessions), 1 (singles) or a whole number from 2 to 10.';
		end if;
	end if;

	-- Null is the cyclic shift. Anything else is the LD's table, one row per
	-- session, in one of two forms. A row of numbers names the away position
	-- that meets home positions 1, 2, 3 … (23 Oct). A row of pairs names both,
	-- [home, away], in the order the frames are played (16 Nov, UV: a card
	-- that follows the league's paper scoresheet). Each row must use every
	-- home and every away position once — design rule 1, a player may not
	-- play twice in a session — and session 1 is the captains' own order. A
	-- pairing repeated across sessions is allowed (UV, 23 Oct): the settings
	-- page warns about it, the database does not refuse it.
	if p_rules ? 'rotation' and jsonb_typeof(p_rules->'rotation') <> 'null' then
		v_n := private.tdc_team_size(p_rules);

		if v_n = 0 then
			raise exception 'TDC (Error): a rotation table needs a team size.';
		end if;

		if v_n = 1 then
			raise exception 'TDC (Error): a singles league has no rotation table.';
		end if;

		if jsonb_typeof(p_rules->'rotation') <> 'array'
			or jsonb_array_length(p_rules->'rotation') <> v_n then
			raise exception 'TDC (Error): the rotation table must have one row for each of the % sessions.', v_n;
		end if;

		for v_s in 0 .. v_n - 1 loop
			v_row := p_rules->'rotation'->v_s;

			-- All numbers, or all [home, away] pairs of numbers: never a mix.
			if jsonb_typeof(v_row) <> 'array' or jsonb_array_length(v_row) <> v_n
				or (exists (select 1 from jsonb_array_elements(v_row) e where jsonb_typeof(e) <> 'number')
					and exists (select 1 from jsonb_array_elements(v_row) e
						where jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2
							or jsonb_typeof(e->0) <> 'number' or jsonb_typeof(e->1) <> 'number')) then
				if jsonb_typeof(v_row) = 'array' and jsonb_typeof(v_row->0) = 'array' then
					raise exception 'TDC (Error): session % of the rotation table must name % pairs of home and away positions.', v_s + 1, v_n;
				end if;
				raise exception 'TDC (Error): session % of the rotation table must name % away positions.', v_s + 1, v_n;
			end if;

			v_pairs := jsonb_typeof(v_row->0) = 'array';

			if (select array_agg(x order by x) from (
					select case when v_pairs then (e->>1)::numeric else (e #>> '{}')::numeric end as x
					from jsonb_array_elements(v_row) e) a)
				<> (select array_agg(g::numeric order by g) from generate_series(1, v_n) g) then
				raise exception 'TDC (Error): in session % of the rotation table, every away player must play exactly once.', v_s + 1;
			end if;

			if v_pairs and (select array_agg((e->>0)::numeric order by (e->>0)::numeric) from jsonb_array_elements(v_row) e)
				<> (select array_agg(g::numeric order by g) from generate_series(1, v_n) g) then
				raise exception 'TDC (Error): in session % of the rotation table, every home player must play exactly once.', v_s + 1;
			end if;

			if v_s = 0 and exists (
				select 1 from jsonb_array_elements(v_row) with ordinality t(e, o)
				where case when v_pairs
					then (e->>0)::numeric <> o or (e->>1)::numeric <> o
					else (e #>> '{}')::numeric <> o end
			) then
				raise exception 'TDC (Error): session 1 of the rotation table is the captains'' own order — H1 v A1, H2 v A2 and so on.';
			end if;
		end loop;
	end if;
end;
$function$

;

-- ─── A league's team size may be 1 ───
-- Patched: < 2 became < 1. Replaces "Every league has a team size" (23 Oct) as UV decided on 24 Oct.

CREATE OR REPLACE FUNCTION private.tdc_check_league_rules(p_rules jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
	perform private.tdc_check_match_rules(p_rules);

	-- 1 is singles (19 Nov). 0 stays for singles matches and tournaments.
	if private.tdc_team_size(p_rules) < 1 then
		raise exception 'A league needs a team size: 1 for singles, or 2 to 10 players a side in each session.';
	end if;
end;
$function$

;

-- ─── A singles team's limit is one ───
-- Patched: no reserves in singles, whatever the season's max_reserves says.

CREATE OR REPLACE FUNCTION private.tdc_team_limit(p_team_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	-- A singles team is its one player and has no reserves (19 Nov).
	select case when private.tdc_singles_season(t.league_season_id) then 1
		else private.tdc_team_size(private.tdc_rules_for_league_season(t.league_season_id)) + s.max_reserves
		end
	from public.tbl_teams t
	join public.tbl_league_seasons s on s.id = t.league_season_id
	where t.id = p_team_id;
$function$

;

-- ─── No teams by hand in singles ───
-- Patched: one refusal after the permission check.

CREATE OR REPLACE FUNCTION public.tdc_create_team(p_league_season_id uuid, p_name text, p_continues_team_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_prev    record;
	v_league  uuid;
	v_lineage uuid;
	v_id      uuid;
begin
	select league_id into v_league from public.tbl_league_seasons where id = p_league_season_id;
	if v_league is null then
		raise exception 'TDC (Error): league season % not found.', p_league_season_id;
	end if;

	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can add teams.';
	end if;

	-- In singles every player's team of one is made for them (19 Nov).
	if private.tdc_singles_season(p_league_season_id) then
		raise exception 'In a singles league every player is their own team, made when they join. There are no teams to add by hand.';
	end if;

	if exists (
		select 1 from public.tbl_teams
		where league_season_id = p_league_season_id and lower(trim(name)) = lower(trim(p_name))
	) then
		raise exception 'There is already a team called "%" in this season.', trim(p_name);
	end if;

	if p_continues_team_id is not null then
		select t.id, t.league_season_id, t.team_lineage_id, s.league_id
		into v_prev
		from public.tbl_teams t
		join public.tbl_league_seasons s on s.id = t.league_season_id
		where t.id = p_continues_team_id;

		if v_prev.id is null then
			raise exception 'TDC (Error): team % not found.', p_continues_team_id;
		end if;
		if v_prev.league_id is distinct from v_league then
			raise exception 'That team belongs to a different league, so this one cannot continue it.';
		end if;
		if v_prev.league_season_id = p_league_season_id then
			raise exception 'A team cannot continue another team from the same season.';
		end if;

		v_lineage := coalesce(v_prev.team_lineage_id, v_prev.id);

		if exists (
			select 1 from public.tbl_teams
			where team_lineage_id = v_lineage and league_season_id = p_league_season_id
		) then
			raise exception 'That team already has a successor in this season.';
		end if;

		-- The first link is made retrospectively: the earlier team had no
		-- lineage until something continued it.
		update public.tbl_teams set team_lineage_id = v_lineage
		where id = v_prev.id and team_lineage_id is null;
	end if;

	insert into public.tbl_teams (created_by, league_season_id, name, team_lineage_id)
	values ((select auth.uid()), p_league_season_id, trim(p_name), v_lineage)
	returning id into v_id;

	return v_id;
end;
$function$

;

-- ─── A singles season's default columns ───
-- Patched: a singles season's player table is Matches Played, Matches Won, Frames Played, Frames Won, Win %, ranked by matches won then frames won (UV, 19 Nov). tdc_reset_standing_columns calls this, so Put the defaults back follows the season as it is now.

CREATE OR REPLACE FUNCTION private.tdc_seed_standing_columns(p_league_season_id uuid, p_scope text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
	insert into public.tbl_league_standing_columns
		(league_season_id, scope, position, name, equation, decimals, rank_priority)
	select p_league_season_id, case when d.scope = 'singles' then 'player' else d.scope end,
		d.position, d.name, d.equation, 0, d.rank_priority
	from (values
		-- A singles season ranks its players on matches won, then frames won
		-- (UV, 19 Nov). The team defaults are seeded too, unused while it is
		-- singles, so a season switched to teams has them.
		('singles', 1, 'Matches Played', '[{"t":"var","v":"matches_played"}]'::jsonb, null::integer),
		('singles', 2, 'Matches Won',    '[{"t":"var","v":"matches_won"}]', 1),
		('singles', 3, 'Frames Played',  '[{"t":"var","v":"frames_played"}]', null),
		('singles', 4, 'Frames Won',     '[{"t":"var","v":"frames_won"}]', 2),
		('singles', 5, 'Win %',          '[{"t":"var","v":"frames_won"},{"t":"op","v":"/"},{"t":"var","v":"frames_played"},{"t":"op","v":"*"},{"t":"num","v":100}]', null),
		('player', 1, 'Frames Played', '[{"t":"var","v":"frames_played"}]'::jsonb, null::integer),
		('player', 2, 'Frames Won',    '[{"t":"var","v":"frames_won"}]', 1),
		('player', 3, 'Win %',         '[{"t":"var","v":"frames_won"},{"t":"op","v":"/"},{"t":"var","v":"frames_played"},{"t":"op","v":"*"},{"t":"num","v":100}]', 2),
		('team',   1, 'Matches Played', '[{"t":"var","v":"matches_played"}]', null),
		('team',   2, 'Matches Won',    '[{"t":"var","v":"matches_won"}]', 1),
		('team',   3, 'M Win %',        '[{"t":"var","v":"matches_won"},{"t":"op","v":"/"},{"t":"var","v":"matches_played"},{"t":"op","v":"*"},{"t":"num","v":100}]', null),
		('team',   4, 'Frames Played',  '[{"t":"var","v":"frames_played"}]', null),
		('team',   5, 'Frames Won',     '[{"t":"var","v":"frames_won"}]', 2),
		('team',   6, 'Frames Won %',   '[{"t":"var","v":"frames_won"},{"t":"op","v":"/"},{"t":"var","v":"frames_played"},{"t":"op","v":"*"},{"t":"num","v":100}]', null)
	) d (scope, position, name, equation, rank_priority)
	cross join (select private.tdc_singles_season(p_league_season_id) as singles) k
	where (p_scope is null or p_scope = case when d.scope = 'singles' then 'player' else d.scope end)
		and (d.scope = 'team' or (d.scope = 'singles') = k.singles);
$function$

;

-- ─── Standings count a singles night ───
-- Patched: the teams come from the fixture when the match names players.

CREATE OR REPLACE FUNCTION public.tdc_league_standings(p_league_season_id uuid, p_live boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with counted as (
		-- A singles night's match names players, not teams (19 Nov), so the
		-- teams come from the fixture; a team night's are the same either way.
		select m.id, coalesce(m.home_team_id, f.home_team_id) as home_team_id,
			coalesce(m.away_team_id, f.away_team_id) as away_team_id, m.status
		from public.tbl_league_fixtures f
		join public.tbl_matches m on m.id = f.match_id
		where f.league_season_id = p_league_season_id
			and (m.status = 'complete'
				-- Live (20261029194712): also a night not yet signed by both, once
				-- it has a finished frame. Never an abandoned one.
				or (p_live and m.status <> 'abandoned' and exists (
					select 1 from public.tbl_frames lf where lf.match_id = m.id and lf.status = 'complete')))
			and coalesce(m.home_team_id, f.home_team_id) is not null
			and coalesce(m.away_team_id, f.away_team_id) is not null
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
$function$

;

-- ─── Starting a singles fixture ───
-- Patched: a singles season makes a player-against-player match. Additions only.

CREATE OR REPLACE FUNCTION public.tdc_create_league_match(p_fixture_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_f  public.tbl_league_fixtures%rowtype;
	v_l  public.tbl_leagues%rowtype;
	v_id uuid;
	v_side text;
	v_team uuid;
	v_n    integer;
	v_home uuid;
	v_away uuid;
begin
	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can start its matches.';
	end if;

	-- Idempotent, like the tournament one: pressing it twice is one match.
	if v_f.match_id is not null then
		return v_f.match_id;
	end if;

	if v_f.away_team_id is null then
		raise exception 'This is a bye — there is nobody to play.';
	end if;

	select l.* into v_l
	from public.tbl_leagues l
	join public.tbl_league_seasons s on s.league_id = l.id
	where s.id = v_f.league_season_id;

	-- A singles league (19 Nov): each team is one player, and the night is a
	-- singles match between them, scored on /match/ like any other. The
	-- teams stay on the fixture. A team that is not exactly one active
	-- player (a season switched from teams, or its player away) is refused
	-- here, not when the rules change: the director sorts the teams out.
	if private.tdc_singles_season(v_f.league_season_id) then
		foreach v_side in array array['home', 'away'] loop
			v_team := case when v_side = 'home' then v_f.home_team_id else v_f.away_team_id end;
			select count(*) into v_n
			from public.tbl_league_season_entrants
			where team_id = v_team and status = 'active';
			if v_n <> 1 then
				raise exception '% has % active players. In a singles league a team is one player: sort it out on Run it first.',
					(select name from public.tbl_teams where id = v_team), v_n;
			end if;
			if v_side = 'home' then
				select player_id into v_home from public.tbl_league_season_entrants
				where team_id = v_team and status = 'active';
			else
				select player_id into v_away from public.tbl_league_season_entrants
				where team_id = v_team and status = 'active';
			end if;
		end loop;

		insert into public.tbl_matches (
			created_by, venue_id, scheduled_at, rules,
			home_side_kind, home_player_id,
			away_side_kind, away_player_id
		)
		values (
			(select auth.uid()), v_l.venue_id, v_f.scheduled_at,
			private.tdc_rules_for_league_season(v_f.league_season_id),
			'player', v_home,
			'player', v_away
		)
		returning id into v_id;

		update public.tbl_league_fixtures set match_id = v_id where id = p_fixture_id;

		return v_id;
	end if;

	insert into public.tbl_matches (
		created_by, venue_id, scheduled_at, rules,
		home_side_kind, home_team_id,
		away_side_kind, away_team_id
	)
	values (
		(select auth.uid()), v_l.venue_id, v_f.scheduled_at,
		-- The moment the season's rules are frozen onto a match. The merge of
		-- the league's ruleset with the season's overrides is done in one
		-- place, and this is the only caller that needs to know that.
		private.tdc_rules_for_league_season(v_f.league_season_id),
		'team', v_f.home_team_id,
		'team', v_f.away_team_id
	)
	returning id into v_id;

	update public.tbl_league_fixtures set match_id = v_id where id = p_fixture_id;

	return v_id;
end;
$function$

;


-- ─── The team of one ───
-- Every write that puts a player in or takes them off a team in a singles
-- season passes through here, whichever function made it (adding, letting in
-- off the Name Down list, paid confirms, the director's own table, a release).
--   * A team holds one player. Putting a second entrant on a team that has
--     one is refused, for the director too. Teams already bigger (a season
--     switched from teams) are left alone until the director moves people.
--   * An active player on no team gets their own, named after them, with
--     themselves as captain, so readiness never reports a team with no
--     captain and the player may set their team's picture.
-- Before, not after: the new team is put on the row being written, so no
-- second update of the row is needed.

create function private.tdc_singles_team_of_one()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_base text;
	v_name text;
	v_n    integer := 1;
begin
	if not private.tdc_singles_season(new.league_season_id) then
		return new;
	end if;

	if new.team_id is not null
		and (tg_op = 'INSERT' or new.team_id is distinct from old.team_id)
		and exists (
			select 1 from public.tbl_league_season_entrants o
			where o.team_id = new.team_id and o.id <> new.id
		) then
		raise exception 'In a singles league a team is one player, and % already has theirs.',
			(select name from public.tbl_teams where id = new.team_id);
	end if;

	if new.status = 'active' and new.team_id is null then
		select trim(display_name) into v_base from public.tbl_players where id = new.player_id;
		-- tbl_teams_name_check wants 2 to 80 characters.
		v_base := left(coalesce(nullif(v_base, ''), 'Player'), 72);
		if char_length(v_base) < 2 then
			v_base := 'Player ' || v_base;
		end if;
		v_name := v_base;
		-- Team names are unique within a season (tbl_teams_name_once): two
		-- players sharing a display name get "Thabo" and "Thabo (2)".
		while exists (
			select 1 from public.tbl_teams
			where league_season_id = new.league_season_id and lower(trim(name)) = lower(v_name)
		) loop
			v_n := v_n + 1;
			v_name := v_base || ' (' || v_n || ')';
		end loop;

		insert into public.tbl_teams (created_by, league_season_id, name)
		values ((select auth.uid()), new.league_season_id, v_name)
		returning id into new.team_id;
		new.is_captain := true;
	end if;

	return new;
end;
$$;
revoke execute on function private.tdc_singles_team_of_one() from public, anon, authenticated;

create trigger tbl_league_season_entrants_singles_team
	before insert or update of status, team_id on public.tbl_league_season_entrants
	for each row execute function private.tdc_singles_team_of_one();


-- ─── Switching a season to singles ───
-- When a league's rules or a season's overrides change, every singles season
-- touched gives its unplaced active players their team of one. Rewriting
-- team_id to itself is enough: the trigger above does the rest. Nothing is
-- refused and no team is broken up; that is the director's (UV, 19 Nov).

create function private.tdc_singles_fill_teams(p_league_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_singles_season(p_league_season_id) then
		return;
	end if;
	update public.tbl_league_season_entrants
	set team_id = null
	where league_season_id = p_league_season_id and status = 'active' and team_id is null;
end;
$$;
revoke execute on function private.tdc_singles_fill_teams(uuid) from public, anon, authenticated;

create function private.tdc_singles_on_league_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_s uuid;
begin
	for v_s in select id from public.tbl_league_seasons where league_id = new.id loop
		perform private.tdc_singles_fill_teams(v_s);
	end loop;
	return null;
end;
$$;
revoke execute on function private.tdc_singles_on_league_rules() from public, anon, authenticated;

create trigger tbl_leagues_singles_fill_teams
	after update of rules on public.tbl_leagues
	for each row execute function private.tdc_singles_on_league_rules();

create function private.tdc_singles_on_season_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform private.tdc_singles_fill_teams(new.id);
	return null;
end;
$$;
revoke execute on function private.tdc_singles_on_season_rules() from public, anon, authenticated;

create trigger tbl_league_seasons_singles_fill_teams
	after update of rules_overrides on public.tbl_league_seasons
	for each row execute function private.tdc_singles_on_season_rules();
