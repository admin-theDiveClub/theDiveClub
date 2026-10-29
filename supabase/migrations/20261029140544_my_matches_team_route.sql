-- My matches knows a team match (UV, 29 Oct).
--
-- A team match in /matches/ opened /match/, which refuses a team match, and
-- read "vs Team". UV: a player goes to the player's page for the night, a
-- captain or the league director to the captain's card. The page needs to
-- know which it is, so tdc_my_matches gains two columns:
--   team_match  both sides are teams
--   card_role   'director' (private.tdc_can_run_league on the match's
--               season), 'captain' (private.tdc_league_match_side names a
--               side), else null; null for every match that is not a team one
-- and names the other team where it said 'Team' (the caller's side is the
-- side of the frames they are in, as before).
--
-- needs_me on a team card: "somebody else submitted and is waiting on me"
-- is a singles idea. On a team card any player in the frames read it as
-- theirs once one captain signed. Now, for a team match, it is a captain
-- whose side's signature is still wanted, or the league director while any
-- is (tdc_card_state's waiting_on: 'home', 'away' or 'both').
--
-- Patched from its text in 20261025075828, nothing else changed. A new
-- return type, so dropped and recreated, and its grants redone.

drop function public.tdc_my_matches(integer);

CREATE FUNCTION public.tdc_my_matches(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, played_at timestamp with time zone, status text, sanctioned boolean, my_side text, opponent text, my_frames integer, their_frames integer, frames_played integer, win_condition text, target integer, discipline text, card_state jsonb, needs_me boolean, refereeing boolean, team_match boolean, card_role text)
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
	),
	-- A team match's role for the caller (20261029140544).
	roles as (
		select s.match_id,
			case
				when private.tdc_can_run_league(private.tdc_league_season_of_match(s.match_id)) then 'director'
				when private.tdc_league_match_side(s.match_id) is not null then 'captain'
			end as card_role,
			private.tdc_league_match_side(s.match_id) as captain_side
		from one_side s
		join public.tbl_matches m on m.id = s.match_id
		where m.home_side_kind = 'team' and m.away_side_kind = 'team'
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
				(case when m.home_side_kind = 'team' then coalesce(ht.name, 'Team') else coalesce(hp.display_name, 'TDC (Error)') end)
				|| ' : '
				|| (case when m.away_side_kind = 'team' then coalesce(awt.name, 'Team') else coalesce(ap.display_name, 'TDC (Error)') end)
			when s.side = 'home' then
				case when m.away_side_kind = 'team' then coalesce(awt.name, 'Team') else coalesce(ap.display_name, 'TDC (Error)') end
			else
				case when m.home_side_kind = 'team' then coalesce(ht.name, 'Team') else coalesce(hp.display_name, 'TDC (Error)') end
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
		case
			-- A team card (20261029140544): a signature this person gives.
			when r.match_id is not null then
				coalesce(private.tdc_card_state(m.id)->>'state' = 'awaiting'
					and (r.card_role = 'director'
						or private.tdc_card_state(m.id)->>'waiting_on' in (r.captain_side, 'both')), false)
			else
		(not s.refereeing
			and private.tdc_card_state(m.id)->>'state' = 'awaiting'
			and (private.tdc_card_state(m.id)->>'submitted_by')::uuid
				is distinct from (select id from me))
		end,
		s.refereeing,
		r.match_id is not null,
		r.card_role
	from one_side s
	join public.tbl_matches m on m.id = s.match_id
	left join public.tbl_players hp on hp.id = m.home_player_id
	left join public.tbl_players ap on ap.id = m.away_player_id
	left join public.tbl_teams ht on ht.id = m.home_team_id
	left join public.tbl_teams awt on awt.id = m.away_team_id
	left join roles r on r.match_id = m.id
	order by coalesce(m.started_at, m.scheduled_at, m.created_at) desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$function$;

revoke execute on function public.tdc_my_matches(integer) from public, anon;
grant  execute on function public.tdc_my_matches(integer) to authenticated;
