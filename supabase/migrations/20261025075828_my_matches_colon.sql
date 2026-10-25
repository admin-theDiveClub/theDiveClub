-- A match's two sides are written with a colon, not "v" (UV, 25 Oct, site-wide).
--
-- tdc_my_matches names both sides for a match the caller referees; that
-- one string goes from ' v ' to ' : '. Patched from its text in
-- 20261024162559, nothing else changed. Same arguments and return type, so
-- replaced in place; its grants stand.

CREATE OR REPLACE FUNCTION public.tdc_my_matches(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, played_at timestamp with time zone, status text, sanctioned boolean, my_side text, opponent text, my_frames integer, their_frames integer, frames_played integer, win_condition text, target integer, discipline text, card_state jsonb, needs_me boolean, refereeing boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	with me as (
		select p.id from public.tbl_players p where p.user_id = (select auth.uid())
	),
	mine as (
		select m.id as match_id,
			case when m.home_player_id = (select id from me) then 'home' else 'away' end as side
		from public.tbl_matches m
		where (select id from me) is not null
			and ((select id from me) in (m.home_player_id, m.away_player_id))
		union
		select f.match_id, fp.side
		from public.tbl_frame_participants fp
		join public.tbl_frames f on f.id = fp.frame_id
		where fp.player_id = (select id from me)
		-- Match referee (20261024162559).
		union
		select m.id, 'ref'
		from public.tbl_matches m
		where (select id from me) is not null
			and m.referee_player_id = (select id from me)
	),
	one_side as (
		-- Match referee (20261024162559): a referee reads the score home first.
		select match_id,
			case when min(side) = 'ref' then 'home' else min(side) end as side,
			min(side) = 'ref' as refereeing
		from mine group by match_id
	)
	select
		m.id,
		coalesce(m.started_at, m.scheduled_at, m.created_at),
		m.status,
		m.sanctioned,
		s.side,
		case
			-- Match referee (20261024162559).
			when s.refereeing then
				(case when m.home_side_kind = 'team' then 'Team' else coalesce(hp.display_name, 'TDC (Error)') end)
				|| ' : '
				|| (case when m.away_side_kind = 'team' then 'Team' else coalesce(ap.display_name, 'TDC (Error)') end)
			when s.side = 'home' then
				case when m.away_side_kind = 'team' then 'Team' else coalesce(ap.display_name, 'TDC (Error)') end
			else
				case when m.home_side_kind = 'team' then 'Team' else coalesce(hp.display_name, 'TDC (Error)') end
		end,
		(select count(*) from public.tbl_frames f
			where f.match_id = m.id and f.status = 'complete' and f.winner_side = s.side)::integer,
		(select count(*) from public.tbl_frames f
			where f.match_id = m.id and f.status = 'complete' and f.winner_side <> s.side)::integer,
		(select count(*) from public.tbl_frames f where f.match_id = m.id)::integer,
		m.rules->>'win_condition_type',
		(m.rules->>'win_condition_target')::integer,
		m.rules->>'discipline',
		private.tdc_card_state(m.id),
		-- Somebody else submitted and is waiting on me.
		(not s.refereeing
			and private.tdc_card_state(m.id)->>'state' = 'awaiting'
			and (private.tdc_card_state(m.id)->>'submitted_by')::uuid
				is distinct from (select id from me)),
		s.refereeing
	from one_side s
	join public.tbl_matches m on m.id = s.match_id
	left join public.tbl_players hp on hp.id = m.home_player_id
	left join public.tbl_players ap on ap.id = m.away_player_id
	order by coalesce(m.started_at, m.scheduled_at, m.created_at) desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$function$;
