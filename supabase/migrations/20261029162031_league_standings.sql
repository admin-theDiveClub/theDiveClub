-- League standings (docs/design/leagues.md §6; UV, 29 Oct): the two tables a
-- league is for, Individual Rankings and Team Rankings, and the columns the
-- league director builds for them on the Settings tab.
--
-- Counted, never stored. tdc_league_standings counts every number from the
-- frames of the season's matches each time it is asked (16 teams × 25 frames
-- is about 3,000 rows a season). Which matches: those on one of the season's
-- fixtures and complete, i.e. signed by both captains. A night still being
-- played, or one taken off its fixture, counts for nothing yet.
--
-- The columns belong to the league season, not the league and not the whole
-- platform (the design: SportsPress shares columns across every table, so one
-- edit changes every league at once). A season is made with the default
-- columns (a trigger, so no season-creating function had to change), and the
-- seasons that already exist get them here. The league director may remove
-- every one of them and build from nothing, or put the defaults back.
--
-- An equation is a token array, never a string, and is never evaluated in
-- SQL or with eval. The page builds it from buttons only, one per value and
-- one per operator, so the stored form is
--   [{"t":"var","v":"frames_won"}, {"t":"op","v":"/"}, {"t":"var","v":"frames_played"},
--    {"t":"op","v":"*"}, {"t":"num","v":100}]
-- and private.tdc_standing_equation_problem says whether a sequence is one
-- the buttons could have made: values and operators alternating, brackets
-- balanced, every value one of private.tdc_standing_vars(). The page works
-- the numbers out from the counts this file returns (league-standings-def.js).
--
-- Guards (UV: "build guards into the db to control inputs and prevent same
-- input"): a name of 1 to 24 characters, used once per table whatever its
-- case; an equation used once per table; at most 20 columns a table; at most
-- 40 parts an equation; numbers up to a million.
--
-- Ranking: rank_priority 1 is compared first, then 2 for a tie, and so on;
-- null is not used for ranking. higher_first says which way. A priority is
-- held by one column at a time: giving it to another swaps the two.

-- ─── What a column can be built from ───
-- The one list of values, per table, with the words the buttons show. The
-- page reads it (tdc_standing_variables) rather than keeping a copy, and
-- tdc_league_standings returns a count under each key. A new value is a row
-- here and a count there.
create function private.tdc_standing_vars()
returns table (scope text, key text, label text, ord integer)
language sql
immutable
set search_path = ''
as $$
	select * from (values
		('player', 'frames_played',            'Frames played',        1),
		('player', 'frames_won',               'Frames won',           2),
		('player', 'frames_lost',              'Frames lost',          3),
		('player', 'frames_won_home',          'Frames won at home',   4),
		('player', 'frames_won_away',          'Frames won away',      5),
		('player', 'lags_won',                 'Lags won',             6),
		('player', 'won_with_lag',             'Won with the lag',     7),
		('player', 'won_without_lag',          'Won without the lag',  8),
		('player', 'break_and_finish',         'Break & finish',       9),
		('player', 'reverse_break_and_finish', 'Reverse B&F',         10),
		('player', 'golden_break',             'Golden breaks',       11),
		('player', 'walkovers_won',            'Walkovers won',       12),
		('player', 'matches_played',           'Matches played',      13),
		('player', 'matches_won',              'Matches won',         14),
		('player', 'matches_lost',             'Matches lost',        15),
		('player', 'matches_drawn',            'Matches drawn',       16),
		('player', 'minutes_played',           'Minutes played',      17),
		('player', 'frames_timed',             'Frames timed',        18),
		('player', 'leagues_played',           'Leagues played',      19),
		('player', 'seasons_played',           'Seasons played',      20),

		('team',   'matches_played',           'Matches played',       1),
		('team',   'matches_won',              'Matches won',          2),
		('team',   'matches_lost',             'Matches lost',         3),
		('team',   'matches_drawn',            'Matches drawn',        4),
		('team',   'matches_won_home',         'Matches won at home',  5),
		('team',   'matches_won_away',         'Matches won away',     6),
		('team',   'frames_played',            'Frames played',        7),
		('team',   'frames_won',               'Frames won',           8),
		('team',   'frames_lost',              'Frames lost',          9),
		('team',   'lags_won',                 'Lags won',            10),
		('team',   'won_with_lag',             'Won with the lag',    11),
		('team',   'won_without_lag',          'Won without the lag', 12),
		('team',   'break_and_finish',         'Break & finish',      13),
		('team',   'reverse_break_and_finish', 'Reverse B&F',         14),
		('team',   'golden_break',             'Golden breaks',       15),
		('team',   'walkovers_won',            'Walkovers won',       16),
		('team',   'walkovers_given',          'Walkovers given',     17),
		('team',   'players_used',             'Players used',        18),
		('team',   'minutes_played',           'Minutes played',      19),
		('team',   'frames_timed',             'Frames timed',        20)
	) v (scope, key, label, ord);
$$;

revoke execute on function private.tdc_standing_vars() from public, anon;
grant execute on function private.tdc_standing_vars() to authenticated;

create function public.tdc_standing_variables()
returns table (scope text, key text, label text, ord integer)
language sql
stable
security definer
set search_path = ''
as $$
	select scope, key, label, ord from private.tdc_standing_vars() order by scope, ord;
$$;

revoke execute on function public.tdc_standing_variables() from public, anon;
grant execute on function public.tdc_standing_variables() to authenticated;

-- ─── Is this an equation the buttons could have made? ───
-- Null when it is; otherwise what is wrong, in words. Each part is an object
-- of exactly t and v:
--   var    v a key of private.tdc_standing_vars() for this table
--   num    v a number, at most a million either way
--   op     v one of + - * /
--   paren  v "(" or ")"
-- A value (var, num, or a bracketed group) and an operator alternate,
-- starting and ending on a value, and every bracket closes.
create function private.tdc_standing_equation_problem(p_scope text, p_equation jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_part      jsonb;
	v_t         text;
	v_v         jsonb;
	v_want_value boolean := true;
	v_depth     integer := 0;
begin
	if p_equation is null or jsonb_typeof(p_equation) <> 'array' then
		return 'TDC (Error): an equation is a list of the buttons pressed.';
	end if;
	if jsonb_array_length(p_equation) = 0 then
		return 'The equation is empty. Press a value to start it.';
	end if;
	if jsonb_array_length(p_equation) > 40 then
		return 'An equation can have at most 40 parts.';
	end if;

	for v_part in select value from jsonb_array_elements(p_equation) loop
		if jsonb_typeof(v_part) <> 'object'
			or not (v_part ? 't' and v_part ? 'v')
			or (select count(*) from jsonb_object_keys(v_part)) <> 2
			or jsonb_typeof(v_part -> 't') <> 'string' then
			return 'TDC (Error): part of the equation is not one the buttons make.';
		end if;
		v_t := v_part ->> 't';
		v_v := v_part -> 'v';

		if v_t = 'var' then
			if not v_want_value then return 'Two values need an operator between them.'; end if;
			if jsonb_typeof(v_v) <> 'string' or not exists (
				select 1 from private.tdc_standing_vars() s where s.scope = p_scope and s.key = v_part ->> 'v'
			) then
				return 'TDC (Error): the equation uses a value this table does not have: ' || coalesce(v_part ->> 'v', 'none') || '.';
			end if;
			v_want_value := false;
		elsif v_t = 'num' then
			if not v_want_value then return 'Two values need an operator between them.'; end if;
			if jsonb_typeof(v_v) <> 'number' then
				return 'TDC (Error): a number in the equation is not a number.';
			end if;
			if abs((v_part ->> 'v')::numeric) > 1000000 then
				return 'A number in an equation can be at most a million.';
			end if;
			v_want_value := false;
		elsif v_t = 'op' then
			if v_want_value then return 'An operator needs a value before it.'; end if;
			if jsonb_typeof(v_v) <> 'string' or (v_part ->> 'v') not in ('+', '-', '*', '/') then
				return 'TDC (Error): the equation uses an operator the buttons do not have.';
			end if;
			v_want_value := true;
		elsif v_t = 'paren' and jsonb_typeof(v_v) = 'string' and (v_part ->> 'v') = '(' then
			if not v_want_value then return 'An opening bracket after a value needs an operator before it.'; end if;
			v_depth := v_depth + 1;
		elsif v_t = 'paren' and jsonb_typeof(v_v) = 'string' and (v_part ->> 'v') = ')' then
			if v_want_value then return 'A closing bracket needs a value before it.'; end if;
			if v_depth = 0 then return 'A bracket is closed that was never opened.'; end if;
			v_depth := v_depth - 1;
		else
			return 'TDC (Error): part of the equation is not one the buttons make.';
		end if;
	end loop;

	if v_want_value then return 'The equation ends on an operator. Finish it with a value.'; end if;
	if v_depth > 0 then return 'A bracket is still open. Close it before confirming.'; end if;
	return null;
end;
$$;

revoke execute on function private.tdc_standing_equation_problem(text, jsonb) from public, anon;
grant execute on function private.tdc_standing_equation_problem(text, jsonb) to authenticated;

-- ─── The columns ───
create table public.tbl_league_standing_columns (
	id               uuid primary key default gen_random_uuid(),
	created_at       timestamptz not null default now(),
	created_by       uuid references auth.users (id) on delete set null,

	league_season_id uuid not null references public.tbl_league_seasons (id) on delete cascade,
	-- Which table: Individual Rankings (player; also the players under each
	-- team in Team Rankings) or Team Rankings (team).
	scope            text not null check (scope in ('player', 'team')),
	-- Left to right, after the fixed rank, picture and name.
	position         integer not null check (position >= 1),

	name             text not null check (name = trim(name) and char_length(name) between 1 and 24),
	equation         jsonb not null,
	decimals         integer not null default 0 check (decimals between 0 and 3),

	-- 1 is compared first; null is not used for ranking.
	rank_priority    integer check (rank_priority between 1 and 20),
	higher_first     boolean not null default true,

	-- Deferred, so moving a column (every position after it shifts) and
	-- swapping two priorities can pass through a moment of two equal ones.
	constraint tbl_league_standing_columns_position_once
		unique (league_season_id, scope, position) deferrable initially deferred,
	constraint tbl_league_standing_columns_priority_once
		unique (league_season_id, scope, rank_priority) deferrable initially deferred,
	constraint tbl_league_standing_columns_equation_once
		unique (league_season_id, scope, equation),
	constraint tbl_league_standing_columns_equation_valid
		check (private.tdc_standing_equation_problem(scope, equation) is null)
);

create unique index tbl_league_standing_columns_name_once
	on public.tbl_league_standing_columns (league_season_id, scope, lower(name));

comment on table public.tbl_league_standing_columns is
	'A league season''s standings columns, built by its league director (migration league_standings). Written only through the tdc_ standing column functions.';

-- Not secret: anybody who can see the standings sees their columns.
alter table public.tbl_league_standing_columns enable row level security;

create policy "Signed-in users can see standings columns"
	on public.tbl_league_standing_columns
	for select
	to authenticated
	using (true);

grant select on public.tbl_league_standing_columns to authenticated;
grant select, insert, update, delete on public.tbl_league_standing_columns to service_role;

-- ─── The defaults (UV, 29 Oct) ───
-- Individual: Frames Played | Frames Won | Win %, ranked by frames won, then
-- win %. Team: Matches Played | Matches Won | M Win % | Frames Played |
-- Frames Won | Frames Won %, ranked by matches won, then frames won.
create function private.tdc_seed_standing_columns(p_league_season_id uuid, p_scope text)
returns void
language sql
security definer
set search_path = ''
as $$
	insert into public.tbl_league_standing_columns
		(league_season_id, scope, position, name, equation, decimals, rank_priority)
	select p_league_season_id, d.scope, d.position, d.name, d.equation, 0, d.rank_priority
	from (values
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
	where p_scope is null or d.scope = p_scope;
$$;

revoke execute on function private.tdc_seed_standing_columns(uuid, text) from public, anon, authenticated;

create function private.tdc_league_season_seed_standings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform private.tdc_seed_standing_columns(new.id, null);
	return new;
end;
$$;

revoke execute on function private.tdc_league_season_seed_standings() from public, anon, authenticated;

create trigger tdc_league_season_seed_standings
	after insert on public.tbl_league_seasons
	for each row execute function private.tdc_league_season_seed_standings();

-- The seasons that already exist.
select private.tdc_seed_standing_columns(id, null) from public.tbl_league_seasons;

-- ─── Changing the columns ───
-- Each one for whoever runs the season (private.tdc_can_run_league), each
-- refusal in words the page can show as it is.

create function public.tdc_add_standing_column(
	p_league_season_id uuid,
	p_scope            text,
	p_name             text,
	p_equation         jsonb,
	p_decimals         integer default 0,
	p_higher_first     boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name    text := trim(coalesce(p_name, ''));
	v_problem text;
	v_same    text;
	v_count   integer;
	v_id      uuid;
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only whoever runs the league can change its standings.';
	end if;
	if p_scope is null or p_scope not in ('player', 'team') then
		raise exception 'TDC (Error): there is no standings table called %.', coalesce(p_scope, 'nothing');
	end if;
	if char_length(v_name) = 0 then
		raise exception 'The column needs a name.';
	end if;
	if char_length(v_name) > 24 then
		raise exception 'A column''s name can be at most 24 characters.';
	end if;
	if p_decimals is null or p_decimals not between 0 and 3 then
		raise exception 'A column shows 0 to 3 decimal places.';
	end if;

	select name into v_same from public.tbl_league_standing_columns
	where league_season_id = p_league_season_id and scope = p_scope and lower(name) = lower(v_name);
	if found then
		raise exception 'There is already a column called "%" in this table.', v_same;
	end if;

	v_problem := private.tdc_standing_equation_problem(p_scope, p_equation);
	if v_problem is not null then raise exception '%', v_problem; end if;

	select name into v_same from public.tbl_league_standing_columns
	where league_season_id = p_league_season_id and scope = p_scope and equation = p_equation;
	if found then
		raise exception 'The column "%" already has that equation.', v_same;
	end if;

	select count(*) into v_count from public.tbl_league_standing_columns
	where league_season_id = p_league_season_id and scope = p_scope;
	if v_count >= 20 then
		raise exception 'A table can have at most 20 columns. Remove one first.';
	end if;

	insert into public.tbl_league_standing_columns
		(created_by, league_season_id, scope, position, name, equation, decimals, higher_first)
	values (auth.uid(), p_league_season_id, p_scope, v_count + 1, v_name, p_equation, p_decimals, coalesce(p_higher_first, true))
	returning id into v_id;
	return v_id;
end;
$$;

revoke execute on function public.tdc_add_standing_column(uuid, text, text, jsonb, integer, boolean) from public, anon;
grant execute on function public.tdc_add_standing_column(uuid, text, text, jsonb, integer, boolean) to authenticated;

-- The columns after it close the gap. A ranking priority it held simply goes
-- with it: the others keep theirs, gaps and all, which ranks the same.
create function public.tdc_remove_standing_column(p_column_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_col public.tbl_league_standing_columns;
begin
	select * into v_col from public.tbl_league_standing_columns where id = p_column_id;
	if not found then
		raise exception 'That column is not there any more. The page will show what is.';
	end if;
	if not private.tdc_can_run_league(v_col.league_season_id) then
		raise exception 'Only whoever runs the league can change its standings.';
	end if;

	delete from public.tbl_league_standing_columns where id = p_column_id;
	update public.tbl_league_standing_columns
	set position = position - 1
	where league_season_id = v_col.league_season_id and scope = v_col.scope and position > v_col.position;
end;
$$;

revoke execute on function public.tdc_remove_standing_column(uuid) from public, anon;
grant execute on function public.tdc_remove_standing_column(uuid) to authenticated;

-- To a new place, 1 being leftmost; past either end is the end.
create function public.tdc_move_standing_column(p_column_id uuid, p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_col   public.tbl_league_standing_columns;
	v_count integer;
	v_to    integer;
begin
	select * into v_col from public.tbl_league_standing_columns where id = p_column_id;
	if not found then
		raise exception 'That column is not there any more. The page will show what is.';
	end if;
	if not private.tdc_can_run_league(v_col.league_season_id) then
		raise exception 'Only whoever runs the league can change its standings.';
	end if;

	select count(*) into v_count from public.tbl_league_standing_columns
	where league_season_id = v_col.league_season_id and scope = v_col.scope;
	v_to := least(greatest(coalesce(p_position, v_col.position), 1), v_count);
	if v_to = v_col.position then return; end if;

	if v_to < v_col.position then
		update public.tbl_league_standing_columns set position = position + 1
		where league_season_id = v_col.league_season_id and scope = v_col.scope
			and position >= v_to and position < v_col.position;
	else
		update public.tbl_league_standing_columns set position = position - 1
		where league_season_id = v_col.league_season_id and scope = v_col.scope
			and position > v_col.position and position <= v_to;
	end if;
	update public.tbl_league_standing_columns set position = v_to where id = p_column_id;
end;
$$;

revoke execute on function public.tdc_move_standing_column(uuid, integer) from public, anon;
grant execute on function public.tdc_move_standing_column(uuid, integer) to authenticated;

-- 0 or null: not used for ranking. 1 to the number of columns otherwise; the
-- column that held it takes this one's old priority (or none).
create function public.tdc_set_standing_column_rank(p_column_id uuid, p_priority integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_col   public.tbl_league_standing_columns;
	v_count integer;
	v_to    integer := nullif(p_priority, 0);
begin
	select * into v_col from public.tbl_league_standing_columns where id = p_column_id;
	if not found then
		raise exception 'That column is not there any more. The page will show what is.';
	end if;
	if not private.tdc_can_run_league(v_col.league_season_id) then
		raise exception 'Only whoever runs the league can change its standings.';
	end if;

	select count(*) into v_count from public.tbl_league_standing_columns
	where league_season_id = v_col.league_season_id and scope = v_col.scope;
	if v_to is not null and (v_to < 0 or v_to > least(v_count, 20)) then
		raise exception 'A ranking priority is 0 (not used) to %, the number of columns.', least(v_count, 20);
	end if;
	if v_to is not distinct from v_col.rank_priority then return; end if;

	if v_to is not null then
		update public.tbl_league_standing_columns set rank_priority = v_col.rank_priority
		where league_season_id = v_col.league_season_id and scope = v_col.scope
			and rank_priority = v_to and id <> p_column_id;
	end if;
	update public.tbl_league_standing_columns set rank_priority = v_to where id = p_column_id;
end;
$$;

revoke execute on function public.tdc_set_standing_column_rank(uuid, integer) from public, anon;
grant execute on function public.tdc_set_standing_column_rank(uuid, integer) to authenticated;

-- One table's columns back to the defaults, whatever was there.
create function public.tdc_reset_standing_columns(p_league_season_id uuid, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only whoever runs the league can change its standings.';
	end if;
	if p_scope is null or p_scope not in ('player', 'team') then
		raise exception 'TDC (Error): there is no standings table called %.', coalesce(p_scope, 'nothing');
	end if;

	delete from public.tbl_league_standing_columns
	where league_season_id = p_league_season_id and scope = p_scope;
	perform private.tdc_seed_standing_columns(p_league_season_id, p_scope);
end;
$$;

revoke execute on function public.tdc_reset_standing_columns(uuid, text) from public, anon;
grant execute on function public.tdc_reset_standing_columns(uuid, text) to authenticated;

-- ─── The counts ───
-- Every value of private.tdc_standing_vars(), for every player and every team
-- of the season, from the complete frames of its counted matches (above):
--   { "matches_counted": n,
--     "players": [{ player_id, display_name, avatar_path, team_id, stats: {key: n} }],
--     "teams":   [{ team_id, name, picture_path, stats: {key: n} }] }
-- A player is listed if they are an active or away entrant, or played a
-- counted frame; team_id is their team now, which is the team they are shown
-- under, while their counts are every frame they played. A walkover counts
-- as played and won for the side that turned up (and walkovers_won says how
-- many were). A match is won by the side with more frames; level is drawn.
-- Minutes are a frame's end less its start less its pauses, for frames that
-- have both times (frames_timed); the team card records neither yet.
create function public.tdc_league_standings(p_league_season_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	with counted as (
		select m.id, m.home_team_id, m.away_team_id
		from public.tbl_league_fixtures f
		join public.tbl_matches m on m.id = f.match_id
		where f.league_season_id = p_league_season_id
			and m.status = 'complete'
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
		'players', coalesce((
			select jsonb_agg(jsonb_build_object(
				'player_id', pl.id,
				'display_name', pl.display_name,
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
$$;

revoke execute on function public.tdc_league_standings(uuid) from public, anon;
grant execute on function public.tdc_league_standings(uuid) to authenticated;
