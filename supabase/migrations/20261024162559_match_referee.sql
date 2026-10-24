-- A referee for one match, picked from the players, that saves.
--
-- Until now "Referee" in TDCMatchDef was stored: false: a text box on the
-- match page's screen with nowhere to go, left out of New Match. Referees
-- existed only as competition officials (tbl_competition_roles, rank 50, a
-- whole tournament or league season). This is a separate referee for a
-- single match, social or competition alike.
--
-- Decided by UV, 24 Oct (docs/DECISIONS.md):
--   • Anyone with an account may be picked, a player in the match included.
--   • The referee scores the match exactly as a tournament referee does:
--     enters and corrects frames at rank 50, outranking the players.
--   • Whoever may change the match's rules sets or changes the referee:
--     either player of a social match, the director of a competition match,
--     nobody once the card is settled.
--   • In a social match with no referee, everyone is equal again: frames a
--     removed referee set are open to the players.
--   • Nobody is notified. The referee sees the match in their match list.
--
-- Every function below is patched from its definition in a freshly reset
-- local database (24 Oct), never retyped. What changed is marked "Match
-- referee (20261024162559)".
--
--   1. tbl_matches.referee_player_id
--   2. private.tdc_is_match_referee              new
--   3. private.tdc_can_edit_match                one branch added
--   4. private.tdc_score_rank                    the referee is 50; a league director 100
--   5. private.tdc_frame_rank_guard              fires in a match with a referee
--   6. private.tdc_can_change_match              a social match's referee does not change rules
--   7. public.tdc_set_match_referee              new
--   8. public.tdc_search_referees                new
--   9. public.tdc_my_matches                     refereed matches, flagged
--  10. private.tdc_merge_players                 carries the new column


-- ─────────────────────────────────────────────────────────────────
-- 1. The column
--
-- Set null on delete, like tbl_frames.referee_player_id: deleting a player
-- record forgets who refereed rather than blocking the delete or taking the
-- match with it. The merge moves it (part 10) so a walk-in link never gets
-- that far.
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_matches
	add column referee_player_id uuid references public.tbl_players (id) on delete set null;

create index tbl_matches_referee_idx on public.tbl_matches (referee_player_id)
	where referee_player_id is not null;

comment on column public.tbl_matches.referee_player_id is
	'This match''s own referee, separate from a competition''s officials. Scores at rank 50. Set through tdc_set_match_referee.';


-- ─────────────────────────────────────────────────────────────────
-- 2. Am I this match's referee?
--
-- True or false, never null (docs/DECISIONS.md, 23 Oct).
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_is_match_referee(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.tbl_matches m
		join public.tbl_players p on p.id = m.referee_player_id
		where m.id = p_match_id
			and p.user_id = (select auth.uid())
	);
$$;

revoke execute on function private.tdc_is_match_referee(uuid) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 3. One place decides who may touch a card
--
-- From 20261022230000. One branch added: the match's referee. Still subject
-- to the score_entry_mode check at the end, so in a tournament set to
-- td_only a match referee may not score, exactly as a tournament referee
-- may not.
-- ─────────────────────────────────────────────────────────────────

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
			)
	)
	-- And, in a competition, they must also be senior enough for the way this
	-- tournament has chosen to have its scores entered.
	and private.tdc_meets_score_entry_mode(p_match_id);
$function$;


-- ─────────────────────────────────────────────────────────────────
-- 4. The caller's standing on this match, as a number
--
-- From 20261021100000. The edit log freezes this number onto every frame
-- edit and the rank guard compares against it, so this is the one place
-- "the referee outranks the players" has to be said.
--
-- Two additions:
--   • The match's referee is 50, as a tournament referee is. In a
--     tournament they keep any higher role they also hold.
--   • Outside a tournament, whoever runs the league season is 100. Before
--     this a league director was rank 0 like everyone else, which did not
--     matter while nothing outranked anyone in a league. With a referee in
--     a league match the guard fires there, and a director at 0 could not
--     correct a frame the referee had set (principle 8).
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- 5. The rank rule
--
-- From 20261021110000. It skipped every match outside a tournament,
-- because there everyone was rank 0. A match with a referee is no longer
-- like that, so it now skips only a match that is neither in a tournament
-- nor has a referee. That is also what opens a social match's frames again
-- when its referee is removed (UV, 24 Oct): with no referee the guard
-- steps aside, as it always did.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.tdc_frame_rank_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_match uuid := coalesce(new.match_id, old.match_id);
	v_frame integer := coalesce(new.frame_no, old.frame_no);
	v_mine  integer;
	v_top   integer;
	v_who   text;
begin
	-- The same door tdc_delete_match and the merge go through.
	if current_setting('tdc.card_unlock', true) = 'on' then
		return coalesce(new, old);
	end if;

	-- Match referee (20261024162559): a match with its own referee has ranks
	-- too, wherever it is played.
	if private.tdc_match_competition(v_match) is null
		and not exists (select 1 from public.tbl_matches
			where id = v_match and referee_player_id is not null) then
		return coalesce(new, old);
	end if;

	select max(e.editor_rank), private.tdc_editor_role(max(e.editor_rank))
	into v_top, v_who
	from public.tbl_frame_edit e
	where e.match_id = v_match and e.frame_no = v_frame;

	if v_top is null then
		return coalesce(new, old);
	end if;

	v_mine := private.tdc_score_rank(v_match);
	if v_mine >= v_top then
		return coalesce(new, old);
	end if;

	raise exception 'Frame % was last set by the %. Ask them to change it.', v_frame,
		case v_who
			when 'director' then 'tournament director'
			when 'referee'  then 'referee'
			when 'scorer'   then 'scorer'
			else 'other player'
		end;
end;
$function$;


-- ─────────────────────────────────────────────────────────────────
-- 6. Who may change a match's rules and time
--
-- From 20261024082447. A social match falls back to "whoever may edit the
-- card", and the referee may now edit it. A referee scores; they do not
-- change the rules (UV, 24 Oct, as for competition officials), so somebody
-- who is only the referee is left out. A player who is also the referee is
-- still a player, and venue staff keep what they had.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.tdc_can_change_match(p_match_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_t  uuid;
	v_ls uuid;
	v_venue uuid;
begin
	v_t := private.tdc_match_competition(p_match_id);
	if v_t is not null then
		return coalesce(private.tdc_can_run_tournament(v_t), false);
	end if;

	v_ls := private.tdc_league_season_of_match(p_match_id);
	if v_ls is not null then
		return coalesce(private.tdc_can_run_league(v_ls), false);
	end if;

	-- Match referee (20261024162559): only the referee, and not playing or
	-- on the staff, may score but not change the rules.
	if private.tdc_is_match_referee(p_match_id)
		and private.tdc_my_player_on_match(p_match_id) is null then
		select venue_id into v_venue from public.tbl_matches where id = p_match_id;
		if v_venue is null
			or not coalesce(private.tdc_has_venue_role(v_venue, array['owner', 'admin', 'staff']), false) then
			return false;
		end if;
	end if;

	return coalesce(private.tdc_can_edit_match(p_match_id), false);
end;
$function$;


-- ─────────────────────────────────────────────────────────────────
-- 7. Setting the referee
--
-- Its own function rather than a scope: 'match' key in
-- tdc_update_match_settings: like the time, a referee is not a rule.
-- Changing one re-derives nothing and must not bump card_version, which
-- would retire a submission for no reason.
--
-- Guarded exactly as the rules are: tdc_can_change_match, and nobody once
-- the card is locked (agreed, approved or published). Null clears it.
-- Anyone with an account may be picked, a player in the match included
-- (UV, 24 Oct). A walk-in has no login and could never score.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_set_match_referee(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_status  text;
	v_current uuid;
	v_user    uuid;
	v_found   boolean;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select status, referee_player_id into v_status, v_current
	from public.tbl_matches where id = p_match_id;
	if v_status is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_change_match(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null then
			raise exception 'Only the people running this tournament can change this match''s referee.';
		end if;
		if private.tdc_league_season_of_match(p_match_id) is not null then
			raise exception 'Only the people running this league can change this match''s referee.';
		end if;
		if private.tdc_can_edit_match(p_match_id) then
			raise exception 'Only the players can change who referees this match.';
		end if;
		raise exception 'You are not on this match and cannot change its settings.';
	end if;

	if v_status = 'abandoned' then
		raise exception 'This match was abandoned. Its settings can no longer be changed.';
	end if;

	-- The same refusals as tdc_update_match_settings.
	if private.tdc_card_is_locked(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null
			or private.tdc_league_season_of_match(p_match_id) is not null then
			raise exception 'This result is settled. It has to be sent back before the match can be changed.';
		end if;
		raise exception 'This scorecard is settled and final.';
	end if;

	if p_player_id is not null then
		select true, user_id into v_found, v_user from public.tbl_players where id = p_player_id;
		if v_found is null then
			raise exception 'TDC (Error): no player with id %.', p_player_id;
		end if;
		if v_user is null then
			raise exception 'Only a player with an account can referee a match.';
		end if;
	end if;

	if p_player_id is not distinct from v_current then
		return;
	end if;

	update public.tbl_matches set referee_player_id = p_player_id where id = p_match_id;
end;
$$;

revoke execute on function public.tdc_set_match_referee(uuid, uuid) from public, anon;
grant  execute on function public.tdc_set_match_referee(uuid, uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 8. Finding a referee
--
-- tdc_search_opponents (20261015140000) with one clause taken out: it
-- leaves out the person searching, because you cannot play yourself. You
-- may referee yourself (UV, 24 Oct), and a director picking a referee is
-- not playing at all. Accounts only, for the reason in part 7.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_search_referees(p_query text, p_limit integer default 20)
returns table (id uuid, display_name text, full_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
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
$$;

revoke execute on function public.tdc_search_referees(text, integer) from public, anon;
grant  execute on function public.tdc_search_referees(text, integer) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 9. My matches, including the ones I referee
--
-- From 20261015160000. Dropped and recreated, because a new column
-- (refereeing) changes what it returns and a replace cannot.
--
-- A match I referee and do not play in comes back with refereeing true,
-- the score counted from the home side, and opponent reading "Home v Away"
-- since neither side is mine. needs_me is false for it: only the players
-- answer a card. If I both play and referee, I am a player in the list
-- ('away' and 'home' sort before 'ref').
-- ─────────────────────────────────────────────────────────────────

drop function public.tdc_my_matches(integer);

CREATE FUNCTION public.tdc_my_matches(p_limit integer DEFAULT 50)
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
				|| ' v '
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

revoke execute on function public.tdc_my_matches(integer) from public, anon;
grant  execute on function public.tdc_my_matches(integer) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 10. The walk-in merge
--
-- From 20261024090641. One line, in the matches block, inside the unlock
-- with the other match columns. The foreign-key query in 20261014170000
-- gave 22 references on 24 Oct, all handled; this is the 23rd. The "played
-- each other" guard needs nothing new: a player may referee their own
-- match, so a merge that makes the referee one of the players is allowed.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.tdc_merge_players(p_keep_id uuid, p_remove_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_keep   public.tbl_players%rowtype;
	v_remove public.tbl_players%rowtype;
begin
	select * into v_keep   from public.tbl_players where id = p_keep_id   for update;
	select * into v_remove from public.tbl_players where id = p_remove_id for update;

	if v_keep.id is null or v_remove.id is null then
		raise exception 'TDC (Error): player record not found.';
	end if;
	if v_keep.id = v_remove.id then
		raise exception 'TDC (Error): cannot join a player record with itself.';
	end if;
	if v_keep.user_id is not null then
		raise exception 'That record is already linked to an account.';
	end if;
	if v_keep.player_type not in ('walk_in', 'guest') then
		raise exception 'TDC (Error): only walk-in or guest records can be linked to an account.';
	end if;
	if v_remove.user_id is distinct from p_user_id then
		raise exception 'TDC (Error): the account does not match the selected player.';
	end if;

	-- Two different SA IDs can't be joined automatically. (The same SA ID can't be on two records.)
	if exists (select 1 from public.tbl_player_identifiers where player_id = p_keep_id   and kind = 'sa_id')
	   and exists (select 1 from public.tbl_player_identifiers where player_id = p_remove_id and kind = 'sa_id') then
		raise exception 'Both records have an SA ID on file. Please ask an owner or admin to resolve this.';
	end if;

	-- If the two records ever faced each other, joining them would make a match
	-- or a frame have the same player on both sides. Say so plainly rather than
	-- letting a check constraint fail with something nobody can act on.
	if exists (
		select 1 from public.tbl_matches
		where (home_player_id = p_keep_id   and away_player_id = p_remove_id)
		   or (home_player_id = p_remove_id and away_player_id = p_keep_id)
	) then
		raise exception 'These two records are recorded as having played against each other. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_frame_participants a
		join public.tbl_frame_participants b on b.frame_id = a.frame_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are recorded as having played in the same frame. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_league_season_entrants a
		join public.tbl_league_season_entrants b on b.league_season_id = a.league_season_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both entered in the same league season. Please ask an owner or admin to resolve this.';
	end if;

	-- ── Move everything that points at the signup record onto the walk-in record ──
	update public.tbl_player_identifiers set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_players set guest_of_player_id = p_keep_id where guest_of_player_id = p_remove_id;

	-- Credits: the only time ledger rows may change owner. The switch is on for this transaction step only.
	perform set_config('tdc.ledger_merge', 'on', true);
	update public.tbl_credit_ledger set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.ledger_merge', 'off', true);

	-- Redeem codes keep a full history and refuse direct edits, so the same
	-- controlled-write switch the redeem and void functions use is needed here.
	perform set_config('tdc.redeem_write', 'on', true);
	update public.tbl_redeem_codes set redeemed_player_id = p_keep_id where redeemed_player_id = p_remove_id;
	perform set_config('tdc.redeem_write', 'off', true);

	-- Matches and frames. The match rows matter as much as the frames: a side of
	-- a match is a player id, and losing it would orphan a whole scorecard.
	-- The frame writes now pass the rank guard as well as the lock, so they go
	-- through the same unlock the delete path uses: a merge is bookkeeping,
	-- not somebody trying to change a score.
	perform set_config('tdc.card_unlock', 'on', true);
	update public.tbl_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;
	-- Match referee (20261024162559). Set null on delete, so without this a
	-- claim would quietly forget who was refereeing.
	update public.tbl_matches set referee_player_id = p_keep_id where referee_player_id = p_remove_id;

	update public.tbl_frames set referee_player_id = p_keep_id where referee_player_id = p_remove_id;
	update public.tbl_frames set break_player_id   = p_keep_id where break_player_id   = p_remove_id;
	update public.tbl_frame_participants set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.card_unlock', 'off', true);

	-- Competitions. Both of these cascade on delete, so without them the
	-- signup record's tournament entries and official roles would vanish the
	-- moment it is deleted below — quietly, at the exact moment staff link
	-- the records. Plain updates, not upserts: both tables are unique per
	-- (tournament, player), so a record somehow in the same tournament twice
	-- fails loudly rather than losing one of them.
	update public.tbl_tournament_entrants set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_competition_roles   set player_id = p_keep_id where player_id = p_remove_id;

	-- What this person has been told. Added 20261022100000.
	--
	-- Load-bearing, despite notifications needing an account: the record
	-- being *removed* here is the signup record — the one with the account,
	-- and therefore the only one that can have notifications. The walk-in
	-- record survives and inherits the login. Without this line, claiming a
	-- walk-in would silently wipe everything that account had been told.
	--
	-- The settings move too (20261024090641). They were left out on the
	-- grounds that p_keep_id is a walk-in and has none, but the settings that
	-- matter are the account's, on p_remove_id, and deleting that record took
	-- them with it: somebody who had turned league notifications off had them
	-- back on after a claim. If both somehow have a setting for a category,
	-- the account's wins (UV, 24 Oct: always the account's).
	update public.tbl_notifications set player_id = p_keep_id where player_id = p_remove_id;

	delete from public.tbl_notification_prefs k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_notification_prefs r
			where r.player_id = p_remove_id and r.category = k.category);
	update public.tbl_notification_prefs set player_id = p_keep_id where player_id = p_remove_id;

	-- League seasons (20261022180000). Unique per (season, player), so a record
	-- somehow entered twice fails loudly rather than losing one of the two —
	-- the same stance as the tournament entries above, with the friendly
	-- message the guards at the top give.
	update public.tbl_league_season_entrants set player_id = p_keep_id where player_id = p_remove_id;

	-- Tonight's squad and lineup (20261022230000, missing until 20261024090641).
	-- The squad cascades and the order is set null, so a claim used to take a
	-- league player out of every squad and leave their lineup positions empty.
	--
	-- A walk-in cannot be a league player, so it cannot be in either table
	-- through any function. If it somehow is, in a match where the account is
	-- too, the account's place stands and the walk-in's goes (UV, 24 Oct):
	-- its squad row is deleted and its positions emptied, which is what a
	-- captain clearing a position leaves. Matched on the match, not the side,
	-- so one person never ends up in one team's lineup and the other's squad.
	update public.tbl_league_match_order k
	set player_id = null
	where k.player_id = p_keep_id
		and (
			exists (select 1 from public.tbl_league_match_squad r where r.match_id = k.match_id and r.player_id = p_remove_id)
			or exists (select 1 from public.tbl_league_match_order r where r.match_id = k.match_id and r.player_id = p_remove_id)
		);
	delete from public.tbl_league_match_squad k
	where k.player_id = p_keep_id
		and (
			exists (select 1 from public.tbl_league_match_squad r where r.match_id = k.match_id and r.player_id = p_remove_id)
			or exists (select 1 from public.tbl_league_match_order r where r.match_id = k.match_id and r.player_id = p_remove_id)
		);
	update public.tbl_league_match_squad set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_league_match_order set player_id = p_keep_id where player_id = p_remove_id;

	-- Added 20261022180000, found while reading this function for leagues.
	-- Neither table was here. tbl_match_events.player_id is ON DELETE RESTRICT,
	-- so a signup record that had ever submitted or answered a card made the
	-- delete below fail with a raw foreign-key error — loud, not lossy, but a
	-- walk-in claim would simply not go through. tbl_deleted_matches is set
	-- null (or restrict, for deleted_by), which would have forgotten who
	-- removed a match. Plain updates: neither table has a uniqueness rule on
	-- the player, so there is nothing to collide with.
	update public.tbl_match_events   set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_deleted_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_deleted_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;
	update public.tbl_deleted_matches set deleted_by     = p_keep_id where deleted_by     = p_remove_id;

	-- Who set a score by hand, and who changed a frame. Both "on delete set
	-- null", so these forget the person rather than blocking.
	update public.tbl_match_result_override set set_by = p_keep_id where set_by = p_remove_id;
	update public.tbl_frame_edit set edited_by_player_id = p_keep_id where edited_by_player_id = p_remove_id;

	-- Remove the signup record first, so its login link is free for the walk-in record.
	delete from public.tbl_players where id = p_remove_id;

	update public.tbl_players
	set user_id            = p_user_id,
		player_type        = 'member',
		guest_of_player_id = null,
		-- Keep the display name chosen at signup; names prefer what staff entered (they saw the ID).
		display_name       = case when v_remove.display_name = 'TDC (No Name)' then v_keep.display_name else v_remove.display_name end,
		first_name         = coalesce(v_keep.first_name, v_remove.first_name),
		last_name          = coalesce(v_keep.last_name,  v_remove.last_name)
	where id = p_keep_id;

	return p_keep_id;
end;
$function$;
