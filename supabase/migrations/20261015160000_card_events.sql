-- Submitting, agreeing, disputing — and deleting a match.
--
-- A scorecard is finished when both sides say so. One submits, the other has a
-- window to agree or dispute, and silence for long enough counts as agreement.
--
-- Kept as an append-only log rather than a status column, for the same reason
-- frames are: the state is worked out from what happened, so it cannot drift
-- from the events that produced it, and nothing is lost when it changes.
--
-- The useful part is free. Every change to a frame bumps tbl_matches.card_version,
-- so a submission records the version it signed. Edit a frame afterwards and the
-- submission no longer refers to the card as it stands — an agreement cannot
-- survive a card that has changed underneath it, without a line of code to
-- enforce it.

create table public.tbl_match_events (
	id           uuid primary key default gen_random_uuid(),
	created_at   timestamptz not null default now(),
	match_id     uuid not null references public.tbl_matches (id) on delete cascade,
	player_id    uuid not null references public.tbl_players (id) on delete restrict,

	kind         text not null check (kind in ('submitted', 'agreed', 'disputed', 'reopened')),

	-- The card as it stood. A submission for an older version is stale.
	card_version integer not null,

	-- Why, for a dispute. Required there and pointless elsewhere.
	note         text check (note is null or char_length(trim(note)) between 3 and 1000),

	constraint tbl_match_events_dispute_has_a_reason check (
		kind <> 'disputed' or (note is not null and char_length(trim(note)) >= 3)
	)
);

create index tbl_match_events_match_idx on public.tbl_match_events (match_id, created_at desc);

alter table public.tbl_match_events enable row level security;

create policy "Signed-in users can see what happened to a card"
	on public.tbl_match_events
	for select
	to authenticated
	using (true);

grant select on public.tbl_match_events to authenticated;
grant select, insert on public.tbl_match_events to service_role;


-- ─── Where a card stands ───
-- in_progress  nothing submitted, or the card changed since it was
-- awaiting     submitted, waiting on the other side
-- agreed       the other side agreed, or the window ran out
-- disputed     the other side says it is wrong
create function private.tdc_card_state(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_match   public.tbl_matches%rowtype;
	v_sub     public.tbl_match_events%rowtype;
	v_after   public.tbl_match_events%rowtype;
	v_hours   integer;
	v_deadline timestamptz;
begin
	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		return jsonb_build_object('state', 'unknown');
	end if;

	-- The most recent submission of the card as it stands now. An older one
	-- refers to a card that has since been changed, so it does not count.
	select * into v_sub
	from public.tbl_match_events
	where match_id = p_match_id and kind = 'submitted' and card_version = v_match.card_version
	order by created_at desc
	limit 1;

	if v_sub.id is null then
		return jsonb_build_object('state', 'in_progress');
	end if;

	select * into v_after
	from public.tbl_match_events
	where match_id = p_match_id
		and kind in ('agreed', 'disputed')
		and created_at > v_sub.created_at
		and card_version = v_match.card_version
	order by created_at desc
	limit 1;

	if v_after.kind = 'agreed' then
		return jsonb_build_object('state', 'agreed', 'by', v_after.player_id, 'at', v_after.created_at);
	end if;
	if v_after.kind = 'disputed' then
		return jsonb_build_object('state', 'disputed', 'by', v_after.player_id,
			'at', v_after.created_at, 'note', v_after.note);
	end if;

	-- Nobody has answered. Silence past the window counts as agreement, which
	-- is what stops a card sitting unfinished because somebody lost interest.
	v_hours := coalesce((v_match.rules->>'dispute_window_hours')::integer, 48);
	v_deadline := v_sub.created_at + make_interval(hours => v_hours);

	if v_hours > 0 and now() >= v_deadline then
		return jsonb_build_object('state', 'agreed', 'by', null, 'at', v_deadline, 'by_silence', true);
	end if;

	return jsonb_build_object(
		'state', 'awaiting',
		'submitted_by', v_sub.player_id,
		'at', v_sub.created_at,
		'deadline', case when v_hours > 0 then v_deadline end
	);
end;
$$;

revoke execute on function private.tdc_card_state(uuid) from public, anon;
grant execute on function private.tdc_card_state(uuid) to authenticated;

create function public.tdc_card_state(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_card_state(p_match_id);
$$;

revoke execute on function public.tdc_card_state(uuid) from public, anon;
grant execute on function public.tdc_card_state(uuid) to authenticated;


-- ─── Helper: my player row, and that I am on this match ───
create function private.tdc_my_player_on_match(p_match_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
	select p.id
	from public.tbl_players p
	where p.user_id = (select auth.uid())
		and (
			exists (select 1 from public.tbl_matches m
				where m.id = p_match_id and p.id in (m.home_player_id, m.away_player_id))
			or exists (select 1 from public.tbl_frames f
				join public.tbl_frame_participants fp on fp.frame_id = f.id
				where f.match_id = p_match_id and fp.player_id = p.id)
		);
$$;

revoke execute on function private.tdc_my_player_on_match(uuid) from public, anon;
grant execute on function private.tdc_my_player_on_match(uuid) to authenticated;


-- ─── Say the card is finished ───
create function public.tdc_submit_card(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_match public.tbl_matches%rowtype;
	v_state text;
	v_frames integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can submit its scorecard.';
	end if;

	select count(*) into v_frames from public.tbl_frames where match_id = p_match_id;
	if v_frames = 0 then
		raise exception 'There is nothing to submit yet — no frames have been played.';
	end if;

	v_state := private.tdc_card_state(p_match_id)->>'state';
	if v_state = 'awaiting' then
		raise exception 'This scorecard has already been submitted and is waiting on the other player.';
	end if;
	if v_state = 'agreed' then
		raise exception 'This scorecard has already been agreed.';
	end if;

	insert into public.tbl_match_events (match_id, player_id, kind, card_version)
	values (p_match_id, v_me, 'submitted', v_match.card_version);

	update public.tbl_matches
	set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
		ended_at = coalesce(ended_at, now())
	where id = p_match_id;

	return private.tdc_card_state(p_match_id);
end;
$$;

revoke execute on function public.tdc_submit_card(uuid) from public, anon;
grant execute on function public.tdc_submit_card(uuid) to authenticated;


-- ─── Agree, or say it is wrong ───
-- Agreeing is for the other side: signing your own card proves nothing.
create function public.tdc_answer_card(p_match_id uuid, p_agree boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_match public.tbl_matches%rowtype;
	v_state jsonb;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can answer its scorecard.';
	end if;

	v_state := private.tdc_card_state(p_match_id);
	if v_state->>'state' <> 'awaiting' then
		raise exception 'There is nothing waiting to be answered on this scorecard.';
	end if;

	if (v_state->>'submitted_by')::uuid = v_me then
		raise exception 'You submitted this scorecard. The other player answers it.';
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
$$;

revoke execute on function public.tdc_answer_card(uuid, boolean, text) from public, anon;
grant execute on function public.tdc_answer_card(uuid, boolean, text) to authenticated;


-- ─── Delete a match ───
-- For a match started by mistake, or while finding your way around. Social
-- results are nobody's record but the players' own, so either of them may
-- remove one. A sanctioned match is somebody else's record too, and stays.
--
-- The frames go with it. This is the one place in the system where a frame is
-- destroyed rather than corrected, which is why it is this narrow.
create function public.tdc_delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_match public.tbl_matches%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can delete it.';
	end if;

	if v_match.sanctioned then
		raise exception 'This match counts towards rankings and cannot be deleted. Ask the organiser.';
	end if;

	-- When leagues and tournaments land, a match belonging to one must be
	-- refused here too: it is the competition's record, not just the players'.
	-- Those columns do not exist yet, so "sanctioned" is the whole test today.

	delete from public.tbl_matches where id = p_match_id;
end;
$$;

revoke execute on function public.tdc_delete_match(uuid) from public, anon;
grant execute on function public.tdc_delete_match(uuid) to authenticated;


-- ─── The match list carries the card's state ───
drop function if exists public.tdc_my_matches(integer);

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
	discipline    text,
	card_state    jsonb,
	needs_me      boolean
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
	),
	one_side as (
		select match_id, min(side) as side from mine group by match_id
	)
	select
		m.id,
		coalesce(m.started_at, m.scheduled_at, m.created_at),
		m.status,
		m.sanctioned,
		s.side,
		case
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
		(private.tdc_card_state(m.id)->>'state' = 'awaiting'
			and (private.tdc_card_state(m.id)->>'submitted_by')::uuid
				is distinct from (select id from me))
	from one_side s
	join public.tbl_matches m on m.id = s.match_id
	left join public.tbl_players hp on hp.id = m.home_player_id
	left join public.tbl_players ap on ap.id = m.away_player_id
	order by coalesce(m.started_at, m.scheduled_at, m.created_at) desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.tdc_my_matches(integer) from public, anon;
grant execute on function public.tdc_my_matches(integer) to authenticated;
