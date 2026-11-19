-- Doubles: a social match with more than one player a side (UV, 19 Nov 2026).
--
-- Built for 2 v 2, shaped for X v X. Decided by UV (docs/DECISIONS.md, 19 Nov):
--   · the pairs are fixed for the whole match: every frame goes to the same
--     players a side, which this file makes the default;
--   · any player on the other side may agree to or dispute the card, and the
--     first answer settles it; the submitter's partner may not answer;
--   · break tracking records the side only, as in singles;
--   · doubles frames are kept out of singles numbers, head to head and points
--     (a later migration, with the lists and the profile).
--
-- The shape. A doubles side is still side kind 'player', and seat 1 stays in
-- home_player_id / away_player_id, so every page and function that reads those
-- keeps working and shows at least the first name. tbl_match_side_players lists
-- every seat of each side (seat 1 included) and is filled only for a match made
-- with more than one player a side. "Is there a row here for this match?" is
-- how anything tells doubles from singles.
--
-- Functions patched from their text in a freshly reset database (19 Nov), never
-- retyped: tdc_my_player_on_match, tdc_can_edit_match, tdc_answer_card,
-- tdc_record_frame, tdc_frame_edit_log, tdc_delete_match, tdc_merge_players.

-- ─── The players of each side ───

create table public.tbl_match_side_players (
	match_id   uuid not null references public.tbl_matches (id) on delete cascade,
	side       text not null check (side in ('home', 'away')),
	seat       smallint not null check (seat >= 1),
	player_id  uuid not null references public.tbl_players (id) on delete restrict,
	primary key (match_id, side, seat),
	-- Nobody plays twice in one match, on either side.
	unique (match_id, player_id)
);

comment on table public.tbl_match_side_players is
	'Doubles (and any X v X) social match: every seat of each side, seat 1 included. Seat 1 is also the match''s home_player_id / away_player_id. Empty for singles. Written only by tdc_create_team_match. 19 Nov 2026.';

create index tbl_match_side_players_player_idx on public.tbl_match_side_players (player_id);

alter table public.tbl_match_side_players enable row level security;

-- Readable exactly as tbl_matches is: by anybody signed in.
create policy "Signed-in users can see match sides"
	on public.tbl_match_side_players for select to authenticated using (true);

grant select on public.tbl_match_side_players to authenticated;

-- The players of one side, in seat order. A doubles side reads its seats; a
-- singles side is its one player; a team side has no fixed players (they are
-- in the frames), so null.
create function private.tdc_match_side_players(p_match_id uuid, p_side text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(
		(select array_agg(s.player_id order by s.seat)
			from public.tbl_match_side_players s
			where s.match_id = p_match_id and s.side = p_side),
		(select array[case p_side when 'home' then m.home_player_id else m.away_player_id end]
			from public.tbl_matches m
			where m.id = p_match_id
				and case p_side when 'home' then m.home_side_kind else m.away_side_kind end = 'player')
	);
$$;
revoke execute on function private.tdc_match_side_players(uuid, text) from public, anon;

-- Which side a player is fixed to in a match: 'home', 'away', or null when
-- they are on neither (a team match, a referee, staff).
create function private.tdc_side_of_player(p_match_id uuid, p_player_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(
		(select s.side from public.tbl_match_side_players s
			where s.match_id = p_match_id and s.player_id = p_player_id),
		(select case
				when m.home_side_kind = 'player' and m.home_player_id = p_player_id then 'home'
				when m.away_side_kind = 'player' and m.away_player_id = p_player_id then 'away'
			end
			from public.tbl_matches m where m.id = p_match_id)
	);
$$;
revoke execute on function private.tdc_side_of_player(uuid, uuid) from public, anon;

-- ─── Starting a doubles match ───
--
-- tdc_create_match, with a list of players a side instead of one opponent.
-- A function of its own rather than more arguments on that one, which would
-- mean dropping and recreating the function every singles match goes through.
-- The same checks as singles: you are in it, nobody appears twice, and a
-- walk-in or guest needs venue staff (nobody without a login can dispute).
-- The two sides must be the same size, at least two and at most four.
create function public.tdc_create_team_match(
	p_home_players     uuid[],
	p_away_players     uuid[],
	p_rules            jsonb,
	p_first_break_side text default null,
	p_venue_id         uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_size  integer;
	v_all   uuid[];
	v_found integer;
	v_id    uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile found for this account.';
	end if;

	v_size := coalesce(array_length(p_home_players, 1), 0);
	if v_size < 2 or v_size > 4 then
		raise exception 'TDC (Error): a team match needs two to four players a side, not %.', v_size;
	end if;
	if coalesce(array_length(p_away_players, 1), 0) <> v_size then
		raise exception 'Both sides need the same number of players.';
	end if;

	v_all := p_home_players || p_away_players;
	if array_position(v_all, null) is not null then
		raise exception 'Every seat needs a player.';
	end if;
	if (select count(distinct x) from unnest(v_all) x) <> array_length(v_all, 1) then
		raise exception 'A player can only take one seat in a match.';
	end if;
	if not (v_me = any (v_all)) then
		raise exception 'You can only start a match you are playing in.';
	end if;

	select count(*) into v_found from public.tbl_players where id = any (v_all);
	if v_found <> array_length(v_all, 1) then
		raise exception 'TDC (Error): one of the players chosen no longer exists.';
	end if;

	-- A walk-in or guest has nobody who can confirm or dispute the result.
	if exists (select 1 from public.tbl_players where id = any (v_all) and user_id is null) then
		if p_venue_id is null
			or not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
			raise exception 'Only club staff can start a match with a walk-in or guest.';
		end if;
	end if;

	perform private.tdc_check_match_rules(p_rules);

	if p_first_break_side is not null and p_first_break_side not in ('home', 'away') then
		raise exception 'TDC (Error): first_break_side must be home or away, not "%".', p_first_break_side;
	end if;

	insert into public.tbl_matches (
		created_by, venue_id,
		home_side_kind, home_player_id, away_side_kind, away_player_id,
		first_break_side, rules, status
	)
	values (
		(select auth.uid()), p_venue_id,
		'player', p_home_players[1], 'player', p_away_players[1],
		p_first_break_side, p_rules, 'scheduled'
	)
	returning id into v_id;

	insert into public.tbl_match_side_players (match_id, side, seat, player_id)
	select v_id, 'home', p.ord, p.id from unnest(p_home_players) with ordinality as p(id, ord)
	union all
	select v_id, 'away', p.ord, p.id from unnest(p_away_players) with ordinality as p(id, ord);

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_team_match(uuid[], uuid[], jsonb, text, uuid) from public, anon;
grant execute on function public.tdc_create_team_match(uuid[], uuid[], jsonb, text, uuid) to authenticated;

-- ─── Patched functions ───

-- @@FN private.tdc_my_player_on_match
CREATE OR REPLACE FUNCTION private.tdc_my_player_on_match(p_match_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select p.id
	from public.tbl_players p
	where p.user_id = (select auth.uid())
		and (
			exists (select 1 from public.tbl_matches m
				where m.id = p_match_id and p.id in (m.home_player_id, m.away_player_id))
			-- Doubles (20261119124608): any seat of either side, before a
			-- frame is played as well as after.
			or exists (select 1 from public.tbl_match_side_players s
				where s.match_id = p_match_id and s.player_id = p.id)
			or exists (select 1 from public.tbl_frames f
				join public.tbl_frame_participants fp on fp.frame_id = f.id
				where f.match_id = p_match_id and fp.player_id = p.id)
		);
$function$

;

-- @@FN private.tdc_can_edit_match
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
			)
	)
	-- And, in a competition, they must also be senior enough for the way this
	-- tournament has chosen to have its scores entered.
	and private.tdc_meets_score_entry_mode(p_match_id);
$function$

;

-- @@FN public.tdc_answer_card
CREATE OR REPLACE FUNCTION public.tdc_answer_card(p_match_id uuid, p_agree boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me        uuid;
	v_match     public.tbl_matches%rowtype;
	v_state     jsonb;
	v_published timestamptz;
	v_hours     integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	-- Agreeing to somebody else's submission is the singles shape. On a team
	-- card each captain signs their own side, so "I agree" has no meaning and
	-- would quietly settle a night the other side never signed. Disputing is
	-- unchanged: it still reopens the card.
	if coalesce(p_agree, false) and exists (
		select 1 from public.tbl_matches
		where id = p_match_id and home_side_kind = 'team' and away_side_kind = 'team'
	) then
		raise exception 'On a team card each captain signs their own side. Submit yours instead.';
	end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can answer its scorecard.';
	end if;

	v_state     := private.tdc_card_state(p_match_id);
	v_published := private.tdc_published_at(p_match_id);

	-- ─── A published result: objecting to the coordinator ───
	if v_published is not null then
		if p_agree then
			raise exception 'This result has already been published, so there is nothing left to agree to.';
		end if;

		v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 0);
		if v_hours <= 0 then
			raise exception 'This result is published and this match has no dispute window. Speak to whoever is running it.';
		end if;
		if now() >= v_published + make_interval(hours => v_hours) then
			raise exception 'The time to dispute this result has passed. Speak to whoever is running it.';
		end if;

		if p_note is null or char_length(trim(p_note)) < 3 then
			raise exception 'Please say briefly what is wrong with the scorecard.';
		end if;

		if (v_state->'objection'->>'by')::uuid = v_me then
			raise exception 'You have already disputed this result. It is with whoever is running the competition.';
		end if;

		-- Recorded, and nothing else moves: the card stays locked and the
		-- result stays published. The coordinator decides what happens next.
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'disputed', v_match.card_version, trim(p_note));

		return private.tdc_card_state(p_match_id);
	end if;

	-- ─── Social play, exactly as before ───
	if v_state->>'state' <> 'awaiting' then
		raise exception 'There is nothing waiting to be answered on this scorecard.';
	end if;

	if (v_state->>'submitted_by')::uuid = v_me then
		raise exception 'You submitted this scorecard. The other player answers it.';
	end if;

	-- Doubles (20261119124608): the submitter's partner is on the side that
	-- submitted, so agreeing would be that side signing its own card. Any
	-- player on the other side answers, and the first answer settles it.
	if private.tdc_side_of_player(p_match_id, v_me) is not null
		and private.tdc_side_of_player(p_match_id, v_me)
			= private.tdc_side_of_player(p_match_id, (v_state->>'submitted_by')::uuid) then
		raise exception 'Your side submitted this scorecard. The other side answers it.';
	end if;

	if p_agree then
		insert into public.tbl_match_events (match_id, player_id, kind, card_version)
		values (p_match_id, v_me, 'agreed', v_match.card_version);
	else
		if p_note is null or char_length(trim(p_note)) < 3 then
			raise exception 'Please say briefly what is wrong with the scorecard.';
		end if;
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'disputed', v_match.card_version, trim(p_note));

		-- A dispute means "this is wrong, fix it", so the card opens again.
		update public.tbl_matches
		set status = 'in_progress', ended_at = null
		where id = p_match_id;
	end if;

	return private.tdc_card_state(p_match_id);
end;
$function$

;

-- @@FN public.tdc_record_frame
CREATE OR REPLACE FUNCTION public.tdc_record_frame(p_match_id uuid, p_frame_no integer, p_frame jsonb DEFAULT '{}'::jsonb, p_card_version integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_allowed  text[] := array[
		'referee_player_id', 'break_side', 'break_player_id', 'break_outcome',
		'winner_side', 'result_event', 'status', 'abandon_reason',
		'rack_started_at', 'started_at', 'ended_at', 'paused_seconds', 'clicker_log',
		'home_players', 'away_players'
	];
	v_unknown  text[];
	v_match    public.tbl_matches;
	v_frame_id uuid;

	v_derived  text;
	v_given    text;
	v_break    text;
	v_manual   boolean := false;

	v_status   text;
	v_winner   text;
	v_event    text;
	v_outcome  text;
	v_home     uuid[];
	v_away     uuid[];
	v_requires boolean;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	-- Refuse a write aimed at a card that has moved on. Checked here, not in
	-- the browser, because the browser is the thing that is out of date.
	if p_card_version is not null then
		perform private.tdc_check_card_version(p_match_id, p_card_version);
	end if;

	if p_match_id is null or p_frame_no is null or p_frame_no < 1 then
		raise exception 'TDC (Error): a match id and a frame number of 1 or more are required.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its score.';
	end if;

	-- On a team night a player may enter the result of their own frame and
	-- nobody else's. A captain may edit any frame of their match, and a scorer
	-- or the league director any frame at all — which is what
	-- tdc_can_set_lineup already answers for either side.
	if v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team'
		and not (
			private.tdc_can_set_lineup(p_match_id, 'home')
			or private.tdc_can_set_lineup(p_match_id, 'away')
		)
		and exists (select 1 from public.tbl_frames where match_id = p_match_id and frame_no = p_frame_no)
		and not exists (
			select 1
			from public.tbl_frames f
			join public.tbl_frame_participants fp on fp.frame_id = f.id
			join public.tbl_players p on p.id = fp.player_id
			where f.match_id = p_match_id and f.frame_no = p_frame_no
				and p.user_id = (select auth.uid())
		) then
		raise exception 'That is not your frame. A captain or the league director can change anybody''s.';
	end if;

	-- A team card's frames are made when the second lineup locks, one per
	-- pairing. Making one here would add a frame outside the lineup, with
	-- whoever the payload names in it (audit A4).
	if v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team'
		and not exists (select 1 from public.tbl_frames where match_id = p_match_id and frame_no = p_frame_no) then
		raise exception 'There is no frame % on this card. A team card''s frames come from the two lineups.', p_frame_no;
	end if;

	if v_match.status = 'abandoned' then
		raise exception 'This match was abandoned. Frames can no longer be changed.';
	end if;

	-- A misspelt field would otherwise be dropped without a word.
	select array_agg(k) into v_unknown
	from (select k from jsonb_object_keys(coalesce(p_frame, '{}'::jsonb)) k) s
	where k <> all (v_allowed);
	if v_unknown is not null then
		raise exception 'TDC (Error): unknown frame field(s) %.', array_to_string(v_unknown, ', ');
	end if;

	v_status  := coalesce(p_frame->>'status', 'complete');
	v_winner  := p_frame->>'winner_side';
	v_event   := p_frame->>'result_event';
	v_outcome := p_frame->>'break_outcome';

	-- ── The break side: derived unless corrected ──
	v_derived := private.tdc_break_side_for_frame(p_match_id, p_frame_no);
	v_given   := p_frame->>'break_side';

	if v_given is null then
		v_break  := v_derived;
		v_manual := false;
	else
		v_break  := v_given;
		v_manual := v_given is distinct from v_derived;
	end if;

	-- ── A walkover or forfeit: awarded, never played ──
	if v_event = 'default' then
		if v_given is not null or v_outcome is not null or p_frame ? 'break_player_id' then
			raise exception 'TDC (Error): a frame awarded by default has no break. Remove the break fields.';
		end if;
		if v_winner is null then
			raise exception 'TDC (Error): a frame awarded by default still needs a winning side.';
		end if;
		v_break := null;
		v_manual := false;
	end if;

	-- ── Does a break and finish have to be the breaker's? Per match, by rule ──
	v_requires := coalesce((v_match.rules->>'break_finish_requires_breaker')::boolean, true);
	if v_requires and v_event in ('break_and_finish', 'golden_break') then
		if v_break is null then
			raise exception 'TDC (Error): a break and finish needs to say which side broke.';
		end if;
		if v_winner is distinct from v_break then
			raise exception 'TDC (Error): in this match a break and finish must go to the side that broke.';
		end if;
	end if;

	-- ── Who was at the table ──
	if p_frame ? 'home_players' then
		select array_agg(e::uuid) into v_home
		from jsonb_array_elements_text(p_frame->'home_players') e;
	elsif v_match.home_side_kind = 'player' then
		-- Doubles (20261119124608): the side's seats, in order; singles: its one player.
		v_home := private.tdc_match_side_players(p_match_id, 'home');
	end if;

	if p_frame ? 'away_players' then
		select array_agg(e::uuid) into v_away
		from jsonb_array_elements_text(p_frame->'away_players') e;
	elsif v_match.away_side_kind = 'player' then
		v_away := private.tdc_match_side_players(p_match_id, 'away');
	end if;

	-- A team frame is given its two players when the lineups lock, and a
	-- scorer tapping in a result sends a payload that says nothing about who
	-- played. Fall back to the people already in the frame, so recording the
	-- result neither fails the check below nor empties the frame. Nothing
	-- changes for a singles match, where the two sides are the match's own
	-- players and were filled in above, or for doubles, where the page sends
	-- the list and replacing it wholesale is the point.
	if v_home is null or v_away is null then
		declare
			v_existing uuid;
		begin
			select id into v_existing from public.tbl_frames
			where match_id = p_match_id and frame_no = p_frame_no;

			if v_existing is not null then
				if v_home is null then
					select array_agg(player_id order by coalesce(play_order, 1)) into v_home
					from public.tbl_frame_participants where frame_id = v_existing and side = 'home';
				end if;
				if v_away is null then
					select array_agg(player_id order by coalesce(play_order, 1)) into v_away
					from public.tbl_frame_participants where frame_id = v_existing and side = 'away';
				end if;
			end if;
		end;
	end if;

	if v_status = 'complete' and (coalesce(array_length(v_home, 1), 0) = 0 or coalesce(array_length(v_away, 1), 0) = 0) then
		raise exception 'TDC (Error): a finished frame needs at least one player on each side.';
	end if;

	-- In a singles match the player is the side, so nobody else can appear.
	-- In doubles the pairs are fixed for the match (UV, 19 Nov;
	-- 20261119124608): the side's seats, in seat order, and nobody else.
	if v_match.home_side_kind = 'player' and v_home is not null
		and v_home <> private.tdc_match_side_players(p_match_id, 'home') then
		raise exception 'TDC (Error): the home side of this match is fixed and cannot be changed per frame.';
	end if;
	if v_match.away_side_kind = 'player' and v_away is not null
		and v_away <> private.tdc_match_side_players(p_match_id, 'away') then
		raise exception 'TDC (Error): the away side of this match is fixed and cannot be changed per frame.';
	end if;
	-- Who sits in a team frame is decided by the lineup and by
	-- tdc_swap_frame_player, which checks the team and the three reserve
	-- rules. A list sent here could name anybody, and being in a frame grants
	-- edit rights (audit A4), so it may only repeat the people already there.
	-- The fallback above fills an unsent side from those same people, which is
	-- what lets a frame keep a player who has since changed team.
	if v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team'
		and (p_frame ? 'home_players' or p_frame ? 'away_players') then
		declare
			v_frame uuid;
		begin
			select id into v_frame from public.tbl_frames
			where match_id = p_match_id and frame_no = p_frame_no;

			if (select array_agg(x order by x) from unnest(v_home) x)
					is distinct from (select array_agg(player_id order by player_id) from public.tbl_frame_participants
						where frame_id = v_frame and side = 'home')
				or (select array_agg(x order by x) from unnest(v_away) x)
					is distinct from (select array_agg(player_id order by player_id) from public.tbl_frame_participants
						where frame_id = v_frame and side = 'away') then
				raise exception 'Who plays a frame on a team card comes from the lineup. To put a reserve in, use the picker under the frame.';
			end if;
		end;
	end if;

	-- The breaker has to be one of the people on the breaking side.
	if p_frame->>'break_player_id' is not null then
		if v_break is null then
			raise exception 'TDC (Error): a breaking player was given but not which side broke.';
		end if;
		if not ((p_frame->>'break_player_id')::uuid = any (
			case v_break when 'home' then v_home else v_away end
		)) then
			raise exception 'TDC (Error): the breaking player is not on the side that broke.';
		end if;
	end if;

	-- ── Write it ──
	insert into public.tbl_frames (
		match_id, frame_no, referee_player_id,
		break_side, break_side_manual, break_player_id, break_outcome,
		winner_side, result_event, status, abandon_reason,
		rack_started_at, started_at, ended_at, paused_seconds, clicker_log
	)
	values (
		p_match_id, p_frame_no, (p_frame->>'referee_player_id')::uuid,
		v_break, v_manual, (p_frame->>'break_player_id')::uuid, v_outcome,
		v_winner, v_event, v_status, p_frame->>'abandon_reason',
		(p_frame->>'rack_started_at')::timestamptz,
		(p_frame->>'started_at')::timestamptz,
		(p_frame->>'ended_at')::timestamptz,
		coalesce((p_frame->>'paused_seconds')::integer, 0),
		p_frame->'clicker_log'
	)
	on conflict (match_id, frame_no) do update set
		referee_player_id = excluded.referee_player_id,
		break_side        = excluded.break_side,
		break_side_manual = excluded.break_side_manual,
		break_player_id   = excluded.break_player_id,
		break_outcome     = excluded.break_outcome,
		winner_side       = excluded.winner_side,
		result_event      = excluded.result_event,
		status            = excluded.status,
		abandon_reason    = excluded.abandon_reason,
		rack_started_at   = excluded.rack_started_at,
		started_at        = excluded.started_at,
		ended_at          = excluded.ended_at,
		paused_seconds    = excluded.paused_seconds,
		clicker_log       = excluded.clicker_log
	returning id into v_frame_id;

	-- Replaced wholesale, so removing a player from a doubles frame works.
	delete from public.tbl_frame_participants where frame_id = v_frame_id;

	if v_home is not null then
		insert into public.tbl_frame_participants (frame_id, side, player_id, play_order)
		select v_frame_id, 'home', p.id,
			case when array_length(v_home, 1) > 1 then p.ord::smallint end
		from unnest(v_home) with ordinality as p(id, ord);
	end if;

	if v_away is not null then
		insert into public.tbl_frame_participants (frame_id, side, player_id, play_order)
		select v_frame_id, 'away', p.id,
			case when array_length(v_away, 1) > 1 then p.ord::smallint end
		from unnest(v_away) with ordinality as p(id, ord);
	end if;

	-- The card moved. A later frame's breaker may now follow from a different
	-- result, so rules-driven break sides are worked out again.
	perform public.tdc_rederive_break_sides(p_match_id);

	update public.tbl_matches
	set status       = case when status = 'scheduled' then 'in_progress' else status end,
		started_at   = coalesce(started_at, now()),
		card_version = card_version + 1
	where id = p_match_id;

	return v_frame_id;
end;
$function$

;

-- @@FN private.tdc_frame_edit_log
CREATE OR REPLACE FUNCTION private.tdc_frame_edit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_match uuid := coalesce(new.match_id, old.match_id);
	v_me    uuid;
	v_rank  integer;
begin
	-- A frame deleted because its match is being deleted: nothing to log, and
	-- the match row is already gone, so the log row's foreign key would refuse
	-- it and take the whole delete down (audit A1 testing, 24 Oct).
	if tg_op = 'DELETE' and not exists (select 1 from public.tbl_matches where id = v_match) then
		return old;
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	v_rank := coalesce(private.tdc_score_rank(v_match), 0);

	insert into public.tbl_frame_edit (
		match_id, frame_id, frame_no, action,
		edited_by_player_id, editor_role, editor_rank, card_version,
		before, after
	)
	values (
		v_match,
		coalesce(new.id, old.id),
		coalesce(new.frame_no, old.frame_no),
		lower(tg_op),
		v_me,
		private.tdc_editor_role(v_rank),
		v_rank,
		-- Read after the fact: the card_version trigger has already bumped it,
		-- so this is the version this edit produced, which is the one a stale
		-- submission is compared against.
		coalesce((select m.card_version from public.tbl_matches m where m.id = v_match), 0),
		case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
		case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
	);

	-- Tell the players an official changed their card. Added 20261022100000.
	--
	-- Only an editor who is **not in the match**. This trigger fires on every
	-- frame write, so without that test a player scoring their own match
	-- would send their opponent a message per frame. A player editing their
	-- own card is the card flow's business, not this.
	--
	-- Collapsed, so a TD correcting five frames leaves one notification.
	if v_me is not null then
		declare
			-- Doubles (20261119124608): every seat of both sides, not only
			-- seat 1. A singles side is its one player, as before; a team
			-- side has no fixed players and adds nothing, as before (its
			-- home_player_id was null).
			v_players uuid[];
			v_player  uuid;
			v_who     text;
		begin
			v_players := coalesce(private.tdc_match_side_players(v_match, 'home'), '{}')
				|| coalesce(private.tdc_match_side_players(v_match, 'away'), '{}');

			if not (v_me = any (v_players)) then
				select display_name into v_who from public.tbl_players where id = v_me;

				foreach v_player in array v_players loop
					perform private.tdc_notify_collapsing(v_player, 'match', 'frame_changed',
						'Your scorecard was changed',
						coalesce(v_who, 'Somebody') || ' changed frame '
							|| coalesce(new.frame_no, old.frame_no) || '.',
						'/match/?id=' || v_match, v_match, null, v_me);
				end loop;
			end if;
		end;
	end if;

	return coalesce(new, old);
end;
$function$

;

-- @@FN public.tdc_delete_match
-- A deleted doubles match keeps every seat, so notify-card can tell all the
-- players (a deleted match has nothing else left to address a message to).
-- Null for singles, whose players are home_player_id / away_player_id.
alter table public.tbl_deleted_matches
	add column home_players uuid[],
	add column away_players uuid[];

comment on column public.tbl_deleted_matches.home_players is
	'Doubles (20261119124608): every home seat in order, seat 1 included. Null for singles. Kept in step by tdc_merge_players.';
comment on column public.tbl_deleted_matches.away_players is
	'Doubles (20261119124608): every away seat in order, seat 1 included. Null for singles. Kept in step by tdc_merge_players.';

CREATE OR REPLACE FUNCTION public.tdc_delete_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me      uuid;
	v_match   public.tbl_matches%rowtype;
	v_home    text;
	v_away    text;
	v_hs      integer;
	v_as      integer;
	v_frames  integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	if v_match.sanctioned then
		raise exception 'This match counts towards rankings and cannot be deleted. Ask the organiser.';
	end if;

	-- One place decides (audit A1, 24 Oct): the people running a tournament
	-- or league for a match on its fixtures, the players for a social one.
	if not private.tdc_can_delete_match(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null then
			raise exception 'This match is part of a tournament. Only the people running it can delete it.';
		elsif private.tdc_league_season_of_match(p_match_id) is not null then
			raise exception 'This match is part of a league. Only the people running it can delete it.';
		end if;
		raise exception 'Only the players in this match can delete it.';
	end if;

	v_me := private.tdc_me();

	-- Everything worth keeping, gathered while it still exists.
	-- Doubles (20261119124608): every seat, "UV & Sam". Singles: the one name.
	select string_agg(p.display_name, ' & ' order by x.ord) into v_home
	from unnest(private.tdc_match_side_players(p_match_id, 'home')) with ordinality as x(id, ord)
	join public.tbl_players p on p.id = x.id;
	select string_agg(p.display_name, ' & ' order by x.ord) into v_away
	from unnest(private.tdc_match_side_players(p_match_id, 'away')) with ordinality as x(id, ord)
	join public.tbl_players p on p.id = x.id;

	select count(*) filter (where status = 'complete' and winner_side = 'home'),
		count(*) filter (where status = 'complete' and winner_side = 'away'),
		count(*)
		into v_hs, v_as, v_frames
	from public.tbl_frames where match_id = p_match_id;

	insert into public.tbl_deleted_matches (match_id, deleted_by, home_player_id, away_player_id,
		home_players, away_players, summary)
	values (
		p_match_id, v_me, v_match.home_player_id, v_match.away_player_id,
		(select array_agg(s.player_id order by s.seat) from public.tbl_match_side_players s
			where s.match_id = p_match_id and s.side = 'home'),
		(select array_agg(s.player_id order by s.seat) from public.tbl_match_side_players s
			where s.match_id = p_match_id and s.side = 'away'),
		coalesce(v_home, 'Home') || ' ' || v_hs || ' – ' || coalesce(v_away, 'Away') || ' ' || v_as
			|| ', ' || v_frames || ' frame' || case when v_frames = 1 then '' else 's' end
	)
	on conflict (match_id) do nothing;

	perform set_config('tdc.card_unlock', 'on', true);
	delete from public.tbl_matches where id = p_match_id;
	perform set_config('tdc.card_unlock', 'off', true);
end;
$function$

;

-- @@FN private.tdc_merge_players
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

	-- Doubles (20261119124608): two seats of one match, partners or
	-- opponents, before any frame is played. Joined, one player would hold
	-- two seats.
	if exists (
		select 1
		from public.tbl_match_side_players a
		join public.tbl_match_side_players b on b.match_id = a.match_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both in the same match. Please ask an owner or admin to resolve this.';
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
	-- Doubles seats (20261119124608), restrict on delete like the match's own columns.
	update public.tbl_match_side_players set player_id = p_keep_id where player_id = p_remove_id;
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
	-- Doubles (20261119124608): arrays, so no foreign key would catch them.
	update public.tbl_deleted_matches set home_players = array_replace(home_players, p_remove_id, p_keep_id)
		where p_remove_id = any (home_players);
	update public.tbl_deleted_matches set away_players = array_replace(away_players, p_remove_id, p_keep_id)
		where p_remove_id = any (away_players);
	update public.tbl_deleted_matches set deleted_by     = p_keep_id where deleted_by     = p_remove_id;

	-- Who set a score by hand, and who changed a frame. Both "on delete set
	-- null", so these forget the person rather than blocking.
	update public.tbl_match_result_override set set_by = p_keep_id where set_by = p_remove_id;
	update public.tbl_frame_edit set edited_by_player_id = p_keep_id where edited_by_player_id = p_remove_id;

	-- Asking to join a team (20261105153021). Cascades on delete, so without
	-- this a claim would quietly take back every request the account made.
	-- Unique per (team, player): where both asked the same team, the
	-- account's request stands and the walk-in's goes.
	delete from public.tbl_team_join_requests k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_team_join_requests r
			where r.player_id = p_remove_id and r.team_id = k.team_id);
	update public.tbl_team_join_requests set player_id = p_keep_id where player_id = p_remove_id;

	-- Following (this migration). Cascades on delete, so without this a claim
	-- would quietly lose everyone following the walk-in or the account, and
	-- everyone the account follows. The two records following each other would
	-- become somebody following themselves, so that goes first; where both
	-- follow the same player, or the same player follows both, one row stands.
	delete from public.tbl_player_follows
	where (follower_id = p_remove_id and followed_id = p_keep_id)
		or (follower_id = p_keep_id and followed_id = p_remove_id);
	delete from public.tbl_player_follows k
	where k.follower_id = p_keep_id
		and exists (select 1 from public.tbl_player_follows r
			where r.follower_id = p_remove_id and r.followed_id = k.followed_id);
	update public.tbl_player_follows set follower_id = p_keep_id where follower_id = p_remove_id;
	delete from public.tbl_player_follows k
	where k.followed_id = p_keep_id
		and exists (select 1 from public.tbl_player_follows r
			where r.followed_id = p_remove_id and r.follower_id = k.follower_id);
	update public.tbl_player_follows set followed_id = p_keep_id where followed_id = p_remove_id;

	-- Devices (20261113164109). The account's record is the one with rows:
	-- a walk-in has no sign-in, so it never records one. Moved rather than
	-- left to the cascade, or a claim would lose the account's history of
	-- using the app. Where both somehow have the same device, the two are
	-- folded together.
	insert into public.tbl_player_devices (player_id, os, browser, installed, first_seen, last_seen, days_seen)
	select p_keep_id, d.os, d.browser, d.installed, d.first_seen, d.last_seen, d.days_seen
	from public.tbl_player_devices d where d.player_id = p_remove_id
	on conflict (player_id, os, browser, installed) do update
		set first_seen = least(public.tbl_player_devices.first_seen, excluded.first_seen),
			last_seen  = greatest(public.tbl_player_devices.last_seen, excluded.last_seen),
			days_seen  = public.tbl_player_devices.days_seen + excluded.days_seen;
	delete from public.tbl_player_devices where player_id = p_remove_id;

	-- Discrepancies accepted (20261117054351). Set null on delete, so without
	-- this a claim would forget who accepted; and a forgotten acceptor stops
	-- counting as the entry a later change overruled.
	update public.tbl_frame_change_accept set accepted_by_player_id = p_keep_id where accepted_by_player_id = p_remove_id;

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
$function$

;

