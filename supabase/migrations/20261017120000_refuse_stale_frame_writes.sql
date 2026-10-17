-- Two people scoring the same match at once.
--
-- Until now the second write won. Both phones hold the card as they last read
-- it; one scores a frame, the other scores a frame it never saw, and the
-- second write lands on top with nothing to say it happened. Undo was worse:
-- it removes "the last frame", so it could take away a frame the other person
-- had just added.
--
-- The rule is now **refuse and reload**. Every frame write carries the version
-- the browser last saw, and a write aimed at a card that has moved on is
-- refused. Nothing is merged and nothing is guessed at — the person is told
-- somebody else has scored, the match is read back, and they can see where
-- things stand before scoring again.
--
-- It is checked in the database rather than the browser because the browser is
-- the thing that is out of date, and because this then covers every route in:
-- the timer hardware and the team scoresheet get it without anyone remembering.
--
-- card_version already existed for exactly this, and the offline queue already
-- used it this way before replaying. This is the same check for a connection
-- that never dropped.
--
-- The parameter is added with a default of null, meaning "do not check", so
-- the offline replay can keep checking once up front instead of per frame —
-- its first write moves the version, which would then refuse its own second.
--
-- Adding a parameter means dropping and recreating rather than replacing: a
-- replace cannot change a signature, and an overload would leave two functions
-- the API could not choose between. The bodies are otherwise unchanged.

create function private.tdc_check_card_version(p_match_id uuid, p_expected integer)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_now integer;
begin
	select card_version into v_now from public.tbl_matches where id = p_match_id;

	if v_now is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	-- A distinct SQLSTATE, so the page can tell this apart from every other
	-- refusal without reading the message. TDC01 is in the range Postgres
	-- leaves to applications.
	if v_now <> p_expected then
		raise exception 'TDC (Conflict): somebody else has scored on this match. Your change was not saved.'
			using errcode = 'TDC01',
				detail = 'The card moved from version ' || p_expected || ' to ' || v_now || '.';
	end if;
end;
$$;

revoke execute on function private.tdc_check_card_version(uuid, integer) from public, anon;
grant execute on function private.tdc_check_card_version(uuid, integer) to authenticated;


drop function public.tdc_record_frame(uuid, integer, jsonb);
drop function public.tdc_remove_frame(uuid, integer);


create function public.tdc_record_frame(
	p_match_id uuid,
	p_frame_no integer,
	p_frame    jsonb default '{}'::jsonb,

	-- What the caller believed the card was. Null means "do not check" — the
	-- offline queue checks once, up front, before replaying everything.
	p_card_version integer default null
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

create function public.tdc_remove_frame(p_match_id uuid, p_frame_no integer,
	p_card_version integer default null)
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

	-- Refuse a write aimed at a card that has moved on. Checked here, not in
	-- the browser, because the browser is the thing that is out of date.
	if p_card_version is not null then
		perform private.tdc_check_card_version(p_match_id, p_card_version);
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
revoke execute on function public.tdc_record_frame(uuid, integer, jsonb, integer) from public, anon;
grant execute on function public.tdc_record_frame(uuid, integer, jsonb, integer) to authenticated;

revoke execute on function public.tdc_remove_frame(uuid, integer, integer) from public, anon;
grant execute on function public.tdc_remove_frame(uuid, integer, integer) to authenticated;
