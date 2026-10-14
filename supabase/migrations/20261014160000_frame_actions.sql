-- Writing frames.
--
-- Frames are never written straight from the browser. Two things make that
-- impossible to do safely with access rules alone:
--
--   1. Which side breaks follows from the frames before it. A check constraint
--      can only see the row in front of it, so the rule has to be applied here.
--   2. Some rules are per match, not universal. "A break and finish must go to
--      the breaker" is true in most disciplines and disputed in others, so it
--      lives in the match's frozen ruleset and is checked in code.
--
-- Who may write: either side's player, and staff at the venue. Captains and
-- league directors are added here when the teams and league tables land; the
-- permission helper is the only place that will need changing.
--
-- Locking is not here yet. When a card needs a captain's signature the approval
-- step will refuse edits after submission; today any permitted person can
-- correct a frame, which is how a paper scoresheet on the table behaves.

-- ─── Helper: may the current user write to this match's card? ───
create function private.tdc_can_edit_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
				-- Staff at the venue the match is being played at.
				or (
					m.venue_id is not null
					and private.tdc_has_venue_role(m.venue_id, array['owner', 'admin', 'staff'])
				)
			)
	);
$$;

revoke execute on function private.tdc_can_edit_match(uuid) from public, anon;
grant execute on function private.tdc_can_edit_match(uuid) to authenticated;


-- ─── Helper: which side should break this frame? ───
-- Worked out from the match's break rule, who broke first, and the results so
-- far. Returns null where the rule gives no answer, because the break is
-- decided at the table each frame (a lag) or by a schedule we don't hold yet.
create function private.tdc_break_side_for_frame(p_match_id uuid, p_frame_no integer)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_rule       text;
	v_first      text;
	v_prev_break text;
	v_prev_win   text;
begin
	select m.rules->>'break_determination', m.first_break_side
		into v_rule, v_first
	from public.tbl_matches m
	where m.id = p_match_id;

	if v_rule is null then
		v_rule := 'alternate';
	end if;

	-- Decided at the table, or by a draw sheet we don't store yet.
	if v_rule in ('lag_each_frame', 'by_schedule') then
		return null;
	end if;

	if p_frame_no <= 1 then
		return v_first;
	end if;

	select f.break_side, f.winner_side
		into v_prev_break, v_prev_win
	from public.tbl_frames f
	where f.match_id = p_match_id
		and f.frame_no = p_frame_no - 1;

	return case v_rule
		-- Flip the frame before it, rather than counting from the start, so a
		-- breaker someone corrected by hand carries through to what follows.
		when 'alternate' then
			case
				when v_prev_break = 'home' then 'away'
				when v_prev_break = 'away' then 'home'
				when p_frame_no % 2 = 1 then v_first
				when v_first = 'home' then 'away'
				when v_first = 'away' then 'home'
			end
		when 'winner_breaks' then coalesce(v_prev_win, v_first)
		when 'loser_breaks'  then
			case v_prev_win when 'home' then 'away' when 'away' then 'home' else v_first end
		when 'first_breaks'  then v_first
		else null
	end;
end;
$$;

revoke execute on function private.tdc_break_side_for_frame(uuid, integer) from public, anon;
grant execute on function private.tdc_break_side_for_frame(uuid, integer) to authenticated;


-- ─── 1. Record a frame ───
-- Creates the frame or replaces it if that number already exists, so the same
-- call serves "new frame" and "fix frame 3". The frame is passed as one json
-- object rather than thirty arguments: table and lineup slot are still to come,
-- and adding a field should not mean dropping and recreating the function.
--
-- Fields, all optional unless the result needs them:
--   referee_player_id, break_side, break_player_id, break_outcome,
--   winner_side, result_event, status, abandon_reason,
--   rack_started_at, started_at, ended_at, paused_seconds, clicker_log,
--   home_players, away_players  (arrays of player ids)
--
-- Leave break_side out and the rule decides it. Pass one and it is taken as a
-- correction, and the rule leaves that frame alone from then on. Passing the
-- side the rule would have chosen anyway puts the frame back under the rule.
create function public.tdc_record_frame(
	p_match_id uuid,
	p_frame_no integer,
	p_frame    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
	-- Team sides are not checked against a squad yet: that arrives with the
	-- teams table, and guessing at it now would be wrong either way.

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
$$;

revoke execute on function public.tdc_record_frame(uuid, integer, jsonb) from public, anon;
grant execute on function public.tdc_record_frame(uuid, integer, jsonb) to authenticated;


-- ─── 2. Remove a frame ───
-- For a frame entered by mistake. The numbers after it are closed up, because a
-- gap in frame numbers would break every rule that reads "the frame before".
create function public.tdc_remove_frame(p_match_id uuid, p_frame_no integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_status text;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select status into v_status from public.tbl_matches where id = p_match_id;
	if v_status is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its score.';
	end if;

	if v_status = 'abandoned' then
		raise exception 'This match was abandoned. Frames can no longer be changed.';
	end if;

	delete from public.tbl_frames
	where match_id = p_match_id and frame_no = p_frame_no;

	if not found then
		raise exception 'TDC (Error): frame % is not on this match.', p_frame_no;
	end if;

	update public.tbl_frames
	set frame_no = frame_no - 1
	where match_id = p_match_id and frame_no > p_frame_no;

	perform public.tdc_rederive_break_sides(p_match_id);

	update public.tbl_matches
	set card_version = card_version + 1
	where id = p_match_id;
end;
$$;

revoke execute on function public.tdc_remove_frame(uuid, integer) from public, anon;
grant execute on function public.tdc_remove_frame(uuid, integer) to authenticated;


-- ─── 3. Work out every break side again ───
-- Run after anything that moves the whole match: who broke first, the break
-- rule, a result, a frame removed. Frames whose breaker was corrected by hand
-- are left exactly as they are; everything else follows the rule. Frames are
-- walked in order, because each one's answer can depend on the one before it.
create function public.tdc_rederive_break_sides(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_frame   record;
	v_side    text;
	v_changed integer := 0;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its score.';
	end if;

	for v_frame in
		select id, frame_no, break_side, result_event
		from public.tbl_frames
		where match_id = p_match_id and break_side_manual = false
		order by frame_no
	loop
		-- A frame awarded by default was never broken.
		if v_frame.result_event = 'default' then
			continue;
		end if;

		v_side := private.tdc_break_side_for_frame(p_match_id, v_frame.frame_no);

		if v_side is distinct from v_frame.break_side then
			update public.tbl_frames
			set break_side = v_side,
				-- The person who broke no longer follows from the rule.
				break_player_id = null
			where id = v_frame.id;
			v_changed := v_changed + 1;
		end if;
	end loop;

	return v_changed;
end;
$$;

revoke execute on function public.tdc_rederive_break_sides(uuid) from public, anon;
grant execute on function public.tdc_rederive_break_sides(uuid) to authenticated;
