-- The list of a player's matches.
--
-- A function rather than a query from the page, for two reasons:
--
--   1. The score is counted from frames, never stored. Done in the browser that
--      is one request per match to count two numbers — forty matches, forty
--      requests. Here it is one.
--   2. "My matches" is not just the matches I am a side of. In a team match the
--      sides are teams and the people are in frames, so a player's own matches
--      have to be found through tbl_frame_participants as well. That is a join
--      the page should not have to know about.
--
-- Returns the newest first. A match with no date at all still appears, ordered
-- by when it was created, because a social match started on the spot has no
-- scheduled time and is exactly the one someone is looking for.

create function public.tdc_my_matches(p_limit integer default 50)
returns table (
	id            uuid,
	played_at     timestamptz,
	status        text,
	sanctioned    boolean,
	my_side       text,
	opponent      text,
	my_frames     integer,
	their_frames  integer,
	frames_played integer,
	win_condition text,
	target        integer,
	discipline    text
)
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select p.id from public.tbl_players p where p.user_id = (select auth.uid())
	),
	mine as (
		-- A side of the match outright.
		select m.id as match_id,
			case when m.home_player_id = (select id from me) then 'home' else 'away' end as side
		from public.tbl_matches m
		where (select id from me) is not null
			and ((select id from me) in (m.home_player_id, m.away_player_id))

		union

		-- Or at the table in one of its frames, which is how a team match works.
		select f.match_id, fp.side
		from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id
		where fp.player_id = (select id from me)
	),
	-- A player could in principle appear on both sides across a long match's
	-- frames; take one, so a match is listed once.
	one_side as (
		select match_id, min(side) as side from mine group by match_id
	)
	select
		m.id,
		coalesce(m.started_at, m.scheduled_at, m.created_at) as played_at,
		m.status,
		m.sanctioned,
		s.side,
		case
			when s.side = 'home' then
				case when m.away_side_kind = 'team' then 'Team' else coalesce(ap.display_name, 'TDC (Error)') end
			else
				case when m.home_side_kind = 'team' then 'Team' else coalesce(hp.display_name, 'TDC (Error)') end
		end as opponent,
		(select count(*) from public.tbl_frames f
			where f.match_id = m.id and f.status = 'complete' and f.winner_side = s.side)::integer,
		(select count(*) from public.tbl_frames f
			where f.match_id = m.id and f.status = 'complete' and f.winner_side <> s.side)::integer,
		(select count(*) from public.tbl_frames f where f.match_id = m.id)::integer,
		m.rules->>'win_condition_type',
		(m.rules->>'win_condition_target')::integer,
		m.rules->>'discipline'
	from one_side s
	join public.tbl_matches m on m.id = s.match_id
	left join public.tbl_players hp on hp.id = m.home_player_id
	left join public.tbl_players ap on ap.id = m.away_player_id
	order by coalesce(m.started_at, m.scheduled_at, m.created_at) desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.tdc_my_matches(integer) from public, anon;
grant execute on function public.tdc_my_matches(integer) to authenticated;
