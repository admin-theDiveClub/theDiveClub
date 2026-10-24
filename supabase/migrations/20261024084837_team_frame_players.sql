-- A team frame's players come from the lineup, and nowhere else.
--
-- Audit item A4 (docs/STATUS.md, 23 Oct).
--
-- tdc_record_frame took a list of who played from its payload and, on a team
-- card, checked nothing about it. Being in a frame grants edit rights
-- (private.tdc_can_edit_match, "anyone who played a frame"), so before this,
-- against a local three-man night:
--   • a captain could name somebody outside the league in their own seat,
--     who could then score the whole match;
--   • a captain could put a player into the other side's seat, which
--     tdc_swap_frame_player refuses;
--   • a player could replace their own opponent and record the win (the
--     "your own frame only" check passes, because it is their frame);
--   • a player could make a frame that is not on the card at all, because
--     that check only looks at frames that already exist.
-- None of it is reachable from the site: the card sends a result and the lag
-- for frames that exist, never a player list.
--
-- Now, on a team card only:
--   • tdc_record_frame never makes a frame. They are made when the second
--     lineup locks (private.tdc_materialise_lineup_frames).
--   • tdc_record_frame never changes who is in a frame. A list identical to
--     the people already there is accepted; anything else is refused and
--     pointed at the reserve picker. tdc_swap_frame_player stays the one
--     place that decides who sits in a team frame.
-- A league director correcting who played a finished frame clears the
-- result, puts the right player in, and records it again (UV, 24 Oct).
--
-- The rule is about the list sent, not the people already in a frame: a
-- player who was in the order at the lock and has since changed team keeps
-- their frames, and those frames still take a result. Production has one
-- such player on 24 Oct, in three pending frames.
--
-- Singles is untouched: there the sides are the match's own two players and
-- any other list was already refused.
--
-- Patched from the definition as of 20261023090000, extracted from a freshly
-- reset local database. The grants survive create or replace.

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
		v_home := array[v_match.home_player_id];
	end if;

	if p_frame ? 'away_players' then
		select array_agg(e::uuid) into v_away
		from jsonb_array_elements_text(p_frame->'away_players') e;
	elsif v_match.away_side_kind = 'player' then
		v_away := array[v_match.away_player_id];
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
	if v_match.home_side_kind = 'player' and v_home is not null
		and v_home <> array[v_match.home_player_id] then
		raise exception 'TDC (Error): the home side of this match is one player and cannot be changed per frame.';
	end if;
	if v_match.away_side_kind = 'player' and v_away is not null
		and v_away <> array[v_match.away_player_id] then
		raise exception 'TDC (Error): the away side of this match is one player and cannot be changed per frame.';
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
$function$;
