-- The site owner runs every league, tournament and match (UV, 24 Nov;
-- docs/DECISIONS.md, 24 Nov; docs/systems/foundations.md, "The site owner").
--
-- UV: "As the owner of the site, I need my admin@thediveclub.org to behave like
-- director on all leagues and tournaments ... I can see and edit leagues and
-- tournaments even if I'm not part of the league. Same for matches."
--
-- ─── Who the site owner is ───
--
-- The owner of The Dive Club venue: the test the title ladder
-- (20261106071032) and venue editing (20261117074926) already use. In
-- production that is admin@thediveclub.org only; UV's personal account is
-- staff there and gets nothing from this. private.tdc_is_site_owner() holds
-- the test once; the two older functions keep their own copy, untouched.
--
-- ─── How ───
--
-- Seeing needed nothing: signed-in users already read every league and
-- tournament. Editing is decided in a handful of helpers, and each is patched
-- by one clause, copied from its latest definition:
--
--   tdc_competition_rank     site owner counts as rank 100 (director) on every
--   tdc_league_season_rank   tournament and league season. Every ">= 100" and
--                            "> 0" test, tdc_can_run_tournament and
--                            tdc_can_run_league follow from these two.
--   tdc_can_manage_league    site owner allowed: opening a season on a league
--                            that has no season, and so no director, yet.
--   tdc_can_edit_match       site owner allowed on every card, social too.
--   tdc_score_rank           site owner is 100 on every match, so on a social
--                            match with a referee (rank 50) it can still
--                            correct the referee's frames; in a competition it
--                            was already 100 through the ranks above.
--
-- The site owner is not written into tbl_competition_roles, so it is never
-- listed under who runs a competition, and tdc_league_officials,
-- tdc_competition_officials and the poster are unchanged. Choosing a venue for
-- a competition stays with that venue's own owner or admin (17 Nov): the venue
-- checks do not ask these helpers.
--
-- No new table references tbl_players, so private.tdc_merge_players is
-- unaffected.


-- ─── Who the site owner is. True or false, never null. ───

create function private.tdc_is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.tbl_venue_staff s
		join public.tbl_venues v on v.id = s.venue_id
		where v.slug = 'the-dive-club'
			and s.user_id = (select auth.uid())
			and s.role = 'owner'
	);
$$;

revoke execute on function private.tdc_is_site_owner() from public, anon;
grant execute on function private.tdc_is_site_owner() to authenticated;


-- ─── Tournaments: from 20261019140000 ───

create or replace function private.tdc_competition_rank(p_tournament_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select greatest(
		coalesce(max(t.rank), 0),
		-- The site owner runs every tournament (24 Nov).
		case when private.tdc_is_site_owner() then 100 else 0 end
	)
	from public.tbl_competition_roles r
	join public.tbl_competition_role_types t on t.key = r.role
	join public.tbl_players p on p.id = r.player_id
	where r.tournament_id = p_tournament_id
		and p.user_id = (select auth.uid());
$$;


-- ─── League seasons: from 20261022180000 ───

create or replace function private.tdc_league_season_rank(p_league_season_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select greatest(
		coalesce(max(t.rank), 0),
		-- The site owner runs every league season (24 Nov).
		case when private.tdc_is_site_owner() then 100 else 0 end
	)
	from public.tbl_competition_roles r
	join public.tbl_competition_role_types t on t.key = r.role
	join public.tbl_players p on p.id = r.player_id
	where r.league_season_id = p_league_season_id
		and p.user_id = (select auth.uid());
$$;


-- ─── Managing a league: from 20261022180000 ───

create or replace function private.tdc_can_manage_league(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
			select 1 from public.tbl_leagues l
			where l.id = p_league_id
				and (
					l.created_by = (select auth.uid())
					or (l.venue_id is not null
						and private.tdc_has_venue_role(l.venue_id, array['owner', 'admin', 'staff']))
				)
		)
		or exists (
			select 1 from public.tbl_league_seasons s
			where s.league_id = p_league_id
				and private.tdc_league_season_rank(s.id) >= 100
		)
		-- The site owner manages every league, one with no season too (24 Nov).
		or (private.tdc_is_site_owner()
			and exists (select 1 from public.tbl_leagues l where l.id = p_league_id));
$$;


-- ─── Who may edit a card: from 20261119124608 ───

CREATE OR REPLACE FUNCTION private.tdc_can_edit_match(p_match_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select exists (
		select 1
		from public.tbl_matches m
		where m.id = p_match_id
			and (
				-- Either side's player, in a singles match.
				exists (
					select 1
					from public.tbl_players p
					where p.user_id = (select auth.uid())
						and p.id in (m.home_player_id, m.away_player_id)
				)
				-- Doubles (20261119124608): every seat of either side, so a
				-- partner can score frame 1 before they are in any frame.
				or exists (
					select 1
					from public.tbl_match_side_players s
					join public.tbl_players p on p.id = s.player_id
					where s.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- Anyone who actually played a frame. This is what covers a team
				-- match, where the sides are teams and the people are in frames.
				or exists (
					select 1
					from public.tbl_frames f
					join public.tbl_frame_participants fp on fp.frame_id = f.id
					join public.tbl_players p on p.id = fp.player_id
					where f.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- Match referee (20261024162559): this match's own referee,
				-- picked from the players, social or competition alike.
				or exists (
					select 1
					from public.tbl_players p
					where p.user_id = (select auth.uid())
						and p.id = m.referee_player_id
				)
				-- Staff at the venue the match is being played at.
				or (
					m.venue_id is not null
					and private.tdc_has_venue_role(m.venue_id, array['owner', 'admin', 'staff'])
				)
				-- Anyone holding a role in a competition this match belongs to:
				-- its director, referee or scorer. Without this a TD who is not
				-- playing and is not venue staff cannot score their own
				-- tournament, which is the whole of principle 8.
				or exists (
					select 1
					from public.tbl_tournament_fixtures x
					join public.tbl_competition_roles r on r.tournament_id = x.tournament_id
					join public.tbl_players p on p.id = r.player_id
					where x.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- The same, for a league. The clause above was written when a
				-- tournament was the only kind of competition a match could
				-- belong to, so a league director who was not playing could
				-- not score their own league night.
				or exists (
					select 1
					from public.tbl_league_fixtures lf
					join public.tbl_competition_roles r on r.league_season_id = lf.league_season_id
					join public.tbl_players p on p.id = r.player_id
					where lf.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- And either team's captain, who runs the night from beside
				-- the table whether or not they are in a frame themselves.
				or exists (
					select 1
					from public.tbl_league_season_entrants e
					join public.tbl_players p on p.id = e.player_id
					where m.home_team_id is not null
						and e.team_id in (m.home_team_id, m.away_team_id)
						and e.is_captain and e.status = 'active'
						and p.user_id = (select auth.uid())
				)
				-- The site owner, on every match, social ones too (24 Nov).
				or private.tdc_is_site_owner()
			)
	)
	-- And, in a competition, they must also be senior enough for the way this
	-- tournament has chosen to have its scores entered.
	and private.tdc_meets_score_entry_mode(p_match_id);
$function$;


-- ─── Seniority on a match: from 20261024162559 ───

CREATE OR REPLACE FUNCTION private.tdc_score_rank(p_match_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_comp uuid;
	v_ls   uuid;
	v_ref  integer;
begin
	-- The site owner outranks everyone on every match, a social match's
	-- referee included (24 Nov).
	if private.tdc_is_site_owner() then
		return 100;
	end if;

	-- Match referee (20261024162559).
	v_ref := case when private.tdc_is_match_referee(p_match_id) then 50 else 0 end;

	v_comp := private.tdc_match_competition(p_match_id);
	if v_comp is null then
		-- Match referee (20261024162559): a league director runs the night.
		v_ls := private.tdc_league_season_of_match(p_match_id);
		if v_ls is not null and coalesce(private.tdc_can_run_league(v_ls), false) then
			return 100;
		end if;
		return v_ref;
	end if;

	-- Running the competition outranks every role in it. This is the same
	-- test the rest of the tournament code uses, so a venue's staff are
	-- included wherever the tournament belongs to a venue.
	if private.tdc_can_run_tournament(v_comp) then
		return 100;
	end if;

	-- Otherwise the highest role they hold in it: referee 50, scorer 30.
	-- Nothing, for a player who is only playing, which is rank 0.
	-- Match referee (20261024162559): or 50, for this match's referee.
	return greatest(private.tdc_competition_rank(v_comp), v_ref);
end;
$function$;
