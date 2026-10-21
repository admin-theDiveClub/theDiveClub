-- A tournament's status, which until now never changed.
--
-- tbl_tournaments.status has existed since 20261019140000 with five values and
-- a check constraint. Nothing has ever written it, so every tournament ever
-- created reads "Draft" — including on the list, where the badge is the first
-- thing you see. A column that is always the same value is worse than no
-- column, because the badge is believed.
--
-- ─── Derived, not synced ───
--
-- The status is a fact about the tournament: whether it has entrants, whether
-- it has a draw, whether the final has been decided. Those are all things the
-- database already knows, so the status is counted rather than stored — the
-- same rule that keeps scores out of tbl_matches.
--
-- The alternative was to write the column from every function that could
-- change one of those facts: tdc_add_entrant, tdc_remove_entrant,
-- tdc_generate_draw, tdc_clear_draw, tdc_resolve_draw, and anything added
-- later. That is six places to keep in step and a seventh that somebody
-- forgets, which is how a status column goes stale in the first place.
--
-- ─── Except when the TD says otherwise ───
--
-- A derived status cannot express "cancelled", and it cannot express a TD who
-- wants entries closed early or a tournament reopened. So the stored column
-- stays, as the override, with a flag saying it is in force.
--
-- This is the shape tbl_frames.break_side_manual already uses: correcting it
-- by hand sets the flag and the derivation leaves it alone from then on, with
-- a way back to the rule. Same idea, same reason, and a TD who has met one
-- already understands the other.

alter table public.tbl_tournaments
	add column status_manual boolean not null default false;

comment on column public.tbl_tournaments.status_manual is
	'True when the TD has set the status by hand. The derivation then leaves it alone, exactly as break_side_manual does on a frame.';

comment on column public.tbl_tournaments.status is
	'Only meaningful while status_manual is true. Otherwise the status is derived — read it through tdc_tournament_status, never straight off this column.';


-- ─────────────────────────────────────────────────────────────────
-- What the facts say
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_derived_tournament_status(p_tournament_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_last  integer;
	v_final uuid;
	v_out   record;
begin
	select max(round) into v_last
	from public.tbl_tournament_fixtures
	where tournament_id = p_tournament_id and bracket = 'main';

	if v_last is not null then
		-- The final. Its outcome being decided implies everything feeding it
		-- was too, so there is nothing else to check.
		select id into v_final
		from public.tbl_tournament_fixtures
		where tournament_id = p_tournament_id and bracket = 'main' and round = v_last
		limit 1;

		select * into v_out from private.tdc_fixture_outcome(v_final);
		if v_out.decided then
			return 'complete';
		end if;
		return 'in_progress';
	end if;

	-- No draw yet. Somebody has entered, so it is taking entries.
	if exists (
		select 1 from public.tbl_tournament_entrants
		where tournament_id = p_tournament_id and status <> 'withdrawn'
	) then
		return 'open';
	end if;

	return 'draft';
end;
$$;

revoke execute on function private.tdc_derived_tournament_status(uuid) from public, anon;
grant execute on function private.tdc_derived_tournament_status(uuid) to authenticated;


-- The one place to read a status from. Everything that shows one goes
-- through here, so the derivation and the override are decided once.
create function private.tdc_tournament_status(p_tournament_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
	select case
		when t.status_manual then t.status
		else private.tdc_derived_tournament_status(t.id)
	end
	from public.tbl_tournaments t
	where t.id = p_tournament_id;
$$;

revoke execute on function private.tdc_tournament_status(uuid) from public, anon;
grant execute on function private.tdc_tournament_status(uuid) to authenticated;


create function public.tdc_tournament_status(p_tournament_id uuid)
returns table (status text, set_by_hand boolean, would_be text)
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_tournament_status(t.id),
		t.status_manual,
		-- What it would say if the TD handed it back, so a page can offer
		-- that honestly rather than making somebody find out by pressing it.
		private.tdc_derived_tournament_status(t.id)
	from public.tbl_tournaments t
	where t.id = p_tournament_id;
$$;

revoke execute on function public.tdc_tournament_status(uuid) from public, anon;
grant execute on function public.tdc_tournament_status(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Setting it by hand, and handing it back
--
-- Replaces the version from 20261019180000. Passing p_status now also raises
-- the flag: saying what the status is only means something if the derivation
-- stops arguing with you.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text);

create function public.tdc_update_tournament(
	p_tournament_id     uuid,
	p_name              text        default null,
	p_rules             jsonb       default null,
	p_format            text        default null,
	p_status            text        default null,
	p_starts_at         timestamptz default null,
	p_clear_starts_at   boolean     default false,
	p_max_entrants      integer     default null,
	p_entry_fee_credits integer     default null,
	p_notes             text        default null,
	p_third_place       boolean     default null,
	p_progression       text        default null,
	p_create_matches    text        default null,
	-- Hand the status back to the derivation. Wins over p_status if both are
	-- sent, because "follow the tournament again" is the more specific wish.
	p_auto_status       boolean     default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_tournaments%rowtype;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change it.';
	end if;

	if p_rules is not null then
		perform private.tdc_check_match_rules(p_rules);
	end if;

	-- Changing the format after a draw exists would leave matches wired to a
	-- shape that no longer applies.
	--
	-- This used to test `v_t.status <> 'draft'`, which never fired once: the
	-- status column was never written, so every tournament was 'draft'
	-- forever and the format could always be changed. The test is on the
	-- thing it was always about — whether a draw exists — rather than on a
	-- status that now means something but still would not mean this.
	if p_format is not null and p_format <> v_t.format
		and exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'This tournament already has a draw, so its format cannot be changed. Clear the draw first.';
	end if;

	-- third_place is read when the draw is generated, so turning it on
	-- afterwards would silently do nothing. Said out loud instead.
	if p_third_place is not null and p_third_place <> v_t.third_place
		and exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'The third-place playoff is decided when the draw is generated. Redraw to change it.';
	end if;

	update public.tbl_tournaments
	set name              = coalesce(trim(p_name), name),
		rules             = coalesce(p_rules, rules),
		format            = coalesce(p_format, format),
		status            = coalesce(p_status, status),
		-- Setting a status by hand is what makes it stick; clearing the flag
		-- is what gives it back.
		status_manual     = case
			when p_auto_status then false
			when p_status is not null then true
			else status_manual
		end,
		starts_at         = case when p_clear_starts_at then null else coalesce(p_starts_at, starts_at) end,
		max_entrants      = coalesce(p_max_entrants, max_entrants),
		entry_fee_credits = coalesce(p_entry_fee_credits, entry_fee_credits),
		notes             = coalesce(p_notes, notes),
		third_place       = coalesce(p_third_place, third_place),
		progression       = coalesce(p_progression, progression),
		create_matches    = coalesce(p_create_matches, create_matches)
	where id = p_tournament_id;
end;
$$;

revoke execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean) from public, anon;
grant execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The list shows the real one
--
-- Replaces the version from 20261019140000. Same columns plus whether the
-- status was set by hand, so the list can say so rather than presenting a
-- cancelled tournament as though the system worked it out.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_my_tournaments(integer);

create function public.tdc_my_tournaments(p_limit integer default 50)
returns table (
	id            uuid,
	name          text,
	format        text,
	status        text,
	status_manual boolean,
	starts_at     timestamptz,
	venue_name    text,
	entrants      integer,
	i_run_it      boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select t.id, t.name, t.format,
		private.tdc_tournament_status(t.id),
		t.status_manual,
		t.starts_at, v.name,
		(select count(*)::integer from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.status <> 'withdrawn'),
		private.tdc_can_run_tournament(t.id)
	from public.tbl_tournaments t
	left join public.tbl_venues v on v.id = t.venue_id
	where (select id from me) is not null
		and (
			private.tdc_can_run_tournament(t.id)
			or exists (
				select 1 from public.tbl_tournament_entrants e
				where e.tournament_id = t.id and e.player_id = (select id from me)
			)
		)
	order by coalesce(t.starts_at, t.created_at) desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.tdc_my_tournaments(integer) from public, anon;
grant execute on function public.tdc_my_tournaments(integer) to authenticated;
