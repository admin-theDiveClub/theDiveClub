-- Entering a tournament.
--
-- Until now every entrant write was gated on running the tournament, so the
-- only way in was a TD typing your name. UV's flow, 21 Oct:
--
--   TD creates a tournament and decides how people get in
--   TD shares a link
--   A player marks themselves interested
--   The TD confirms them, on whatever criterion they use — often payment
--
-- The ladder itself is unchanged and was settled long ago: interested →
-- confirmed, with confirmation coming either from a TD ticking it or from
-- payment. What is new is that a player can put themselves on the first rung.

-- ─────────────────────────────────────────────────────────────────
-- How people get in
--
-- Defaults to td_only, so every tournament that already exists keeps
-- behaving exactly as it does today.
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_tournaments
	add column entry_mode text not null default 'td_only'
		check (entry_mode in ('td_only', 'interested', 'self_confirm'));

comment on column public.tbl_tournaments.entry_mode is
	'td_only: the TD adds everybody. interested: anyone may put themselves down and the TD confirms. self_confirm: anyone may confirm themselves, for a free tournament or a pay-at-the-desk one.';

-- UV, 21 Oct: "we should add an option on tournament creation where
-- (optionally) paid can trigger confirmed". Off by default, because a TD who
-- is not using payment as their criterion would be surprised by it.
alter table public.tbl_tournaments
	add column paid_confirms boolean not null default false;

comment on column public.tbl_tournaments.paid_confirms is
	'When true, marking an entrant paid also confirms them. The TD''s criterion for confirmation is often payment, but not always, so it is a choice.';


-- ─────────────────────────────────────────────────────────────────
-- A verified account
--
-- UV, 21 Oct: self-entry needs a verified account, but not a verified ID.
--
-- What the database can actually check is that the account exists and its
-- email has been confirmed. The other half of "verified" in the design — the
-- signup bot check — is a Turnstile or hCaptcha at signup, which leaves no
-- trace here and is still switched off. So this is the floor, not the whole
-- of the intent, and the bot check remains on UV's own list.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_is_verified_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1 from auth.users u
		where u.id = (select auth.uid()) and u.email_confirmed_at is not null
	);
$$;

revoke execute on function private.tdc_is_verified_account() from public, anon;
grant execute on function private.tdc_is_verified_account() to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Putting yourself down for one
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_enter_tournament(
	p_tournament_id uuid,
	-- 'interested' always, where the mode allows entry at all. 'confirmed'
	-- only where the TD has said people may confirm themselves.
	p_status        text default 'interested'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t     public.tbl_tournaments%rowtype;
	v_me    uuid;
	v_count integer;
	v_id    uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if v_t.entry_mode = 'td_only' then
		raise exception 'This tournament is filled by whoever is running it. Ask them to add you.';
	end if;

	if not private.tdc_is_verified_account() then
		raise exception 'Confirm your email address before entering a tournament.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	if p_status not in ('interested', 'confirmed') then
		raise exception 'TDC (Error): an entry is either interested or confirmed.';
	end if;
	if p_status = 'confirmed' and v_t.entry_mode <> 'self_confirm' then
		raise exception 'Whoever is running this tournament confirms entries. You can put yourself down as interested.';
	end if;

	-- A tournament that has started is not taking entries. The TD can still
	-- add somebody by hand — this is the self-entry door, not theirs.
	if exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'The draw for this tournament has already been made.';
	end if;

	-- Withdrawn entrants do not take up a place, exactly as in tdc_add_entrant.
	select count(*) into v_count
	from public.tbl_tournament_entrants
	where tournament_id = p_tournament_id and status <> 'withdrawn'
		and player_id <> v_me;

	if v_t.max_entrants is not null and v_count >= v_t.max_entrants then
		raise exception 'This tournament is full (% of %).', v_count, v_t.max_entrants;
	end if;

	-- Pressing "interested" again must not undo a confirmation the TD has
	-- already given — which is what it would do if this simply took the new
	-- value. Withdrawing and coming back is the case this has to allow, so the
	-- rule is that entering never lowers you: it raises you to confirmed where
	-- the mode permits that, and otherwise brings a withdrawal back to
	-- interested.
	insert into public.tbl_tournament_entrants (added_by, tournament_id, player_id, status)
	values ((select auth.uid()), p_tournament_id, v_me, p_status)
	on conflict (tournament_id, player_id) do update
		set status = case
			when excluded.status = 'confirmed' then 'confirmed'
			when public.tbl_tournament_entrants.status = 'confirmed' then 'confirmed'
			else excluded.status
		end
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_enter_tournament(uuid, text) from public, anon;
grant execute on function public.tdc_enter_tournament(uuid, text) to authenticated;


-- Taking your own name off. Withdrawing rather than deleting: the TD needs to
-- see that somebody pulled out, and a seeded draw that silently loses a name
-- is worse than one with a withdrawal in it.
create function public.tdc_withdraw_from_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me uuid;
begin
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	update public.tbl_tournament_entrants
	set status = 'withdrawn'
	where tournament_id = p_tournament_id and player_id = v_me;

	if not found then
		raise exception 'You are not entered in this tournament.';
	end if;
end;
$$;

revoke execute on function public.tdc_withdraw_from_tournament(uuid) from public, anon;
grant execute on function public.tdc_withdraw_from_tournament(uuid) to authenticated;


-- Where the signed-in player stands with a tournament, for the page that
-- offers the buttons. One call rather than reading the entrant list, which
-- the player has no business seeing.
create function public.tdc_my_entry(p_tournament_id uuid)
returns table (
	entrant_id uuid,
	status     text,
	paid       boolean,
	entry_mode text,
	may_enter  boolean,
	may_confirm boolean,
	why_not    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_t    public.tbl_tournaments%rowtype;
	v_me   uuid;
	v_e    public.tbl_tournament_entrants%rowtype;
	v_open boolean;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then return; end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is not null then
		select * into v_e from public.tbl_tournament_entrants
		where tournament_id = p_tournament_id and player_id = v_me;
	end if;

	v_open := not exists (
		select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id);

	entrant_id  := v_e.id;
	status      := v_e.status;
	paid        := v_e.paid_at is not null;
	entry_mode  := v_t.entry_mode;
	may_enter   := v_t.entry_mode <> 'td_only' and v_open
		and v_me is not null and private.tdc_is_verified_account();
	may_confirm := may_enter and v_t.entry_mode = 'self_confirm';
	why_not := case
		when v_t.entry_mode = 'td_only' then 'Whoever is running this tournament adds the entrants.'
		when not v_open then 'The draw has already been made.'
		when v_me is null then 'Sign in to enter.'
		when not private.tdc_is_verified_account() then 'Confirm your email address to enter.'
	end;
	return next;
end;
$$;

revoke execute on function public.tdc_my_entry(uuid) from public, anon;
grant execute on function public.tdc_my_entry(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Paid can confirm
--
-- Replaces the version from 20261019140000. Patched, not retyped: the body
-- below is the original with the paid_confirms branch added.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_set_entrant(
	p_entrant_id uuid,
	p_status     text default null,
	p_paid       boolean default null,
	p_seed       integer default null,
	p_clear_seed boolean default false,
	p_notes      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tournament uuid;
	v_confirms   boolean;
begin
	select tournament_id into v_tournament
	from public.tbl_tournament_entrants where id = p_entrant_id;

	if v_tournament is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_tournament(v_tournament) then
		raise exception 'Only the people running this tournament can change entrants.';
	end if;

	select paid_confirms into v_confirms from public.tbl_tournaments where id = v_tournament;

	update public.tbl_tournament_entrants
	set status  = case
			-- Marking somebody paid confirms them, where the TD has said that
			-- is their criterion. An explicit status still wins: a TD saying
			-- "paid, but withdrawn" means it.
			when p_status is not null then p_status
			when v_confirms and p_paid then 'confirmed'
			else status
		end,
		paid_at = case
			when p_paid is null then paid_at
			when p_paid then coalesce(paid_at, now())
			else null
		end,
		seed    = case when p_clear_seed then null else coalesce(p_seed, seed) end,
		notes   = coalesce(p_notes, notes)
	where id = p_entrant_id;
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- The entrant list is the TD's view
--
-- Replaces the version from 20261019140000, which any signed-in player could
-- call. It carries payment status and the TD's private notes, so it is gated
-- like everything else that does. It also now returns paid_at rather than a
-- bare boolean, because UV wants the time shown beside the tick.
--
-- This is not the same question as the player search being gated: a
-- platform-wide people directory and one tournament's participant list are
-- different things. The public list of who is playing belongs on the poster
-- page and will be its own, narrower read.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_tournament_entrants(uuid);

create function public.tdc_tournament_entrants(p_tournament_id uuid)
returns table (
	entrant_id   uuid,
	player_id    uuid,
	display_name text,
	first_name   text,
	last_name    text,
	player_type  text,
	has_account  boolean,
	status       text,
	paid         boolean,
	paid_at      timestamptz,
	seed         integer,
	notes        text
)
language sql
stable
security definer
set search_path = ''
as $$
	select e.id, p.id, p.display_name, p.first_name, p.last_name, p.player_type,
		p.user_id is not null, e.status, e.paid_at is not null, e.paid_at, e.seed, e.notes
	from public.tbl_tournament_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.tournament_id = p_tournament_id
		and private.tdc_can_run_tournament(p_tournament_id)
	order by e.seed nulls last, p.display_name;
$$;

revoke execute on function public.tdc_tournament_entrants(uuid) from public, anon;
grant execute on function public.tdc_tournament_entrants(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Decided when the tournament is created
--
-- UV, 21 Oct: "we should add an option on tournament creation". Taken here
-- rather than written by the page straight afterwards, which would be a second
-- call that can fail on its own and leave a tournament open to the world when
-- the TD asked for the opposite.
--
-- Replaces the version from 20261019140000. Patched, not retyped: the body is
-- the original with two columns added to the insert. Dropped first because
-- adding defaulted parameters would otherwise leave the seven-argument version
-- in place and make every existing call ambiguous.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer);

create function public.tdc_create_tournament(
	p_name              text,
	p_rules             jsonb,
	p_format            text default 'single_elimination',
	p_venue_id          uuid default null,
	p_starts_at         timestamptz default null,
	p_max_entrants      integer default null,
	p_entry_fee_credits integer default 0,
	p_entry_mode        text default 'td_only',
	p_paid_confirms     boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me uuid;
	v_id uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	-- A tournament attached to a venue has to be run by someone who works
	-- there. Without a venue, anyone may run one — that is the open tier.
	if p_venue_id is not null
		and not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin', 'staff']) then
		raise exception 'Only staff at that venue can run a tournament there.';
	end if;

	-- Validated by the same function the match page uses, so a tournament can
	-- never hold a ruleset its own matches would refuse.
	perform private.tdc_check_match_rules(p_rules);

	insert into public.tbl_tournaments
		(created_by, venue_id, name, format, rules, starts_at, max_entrants, entry_fee_credits,
		 entry_mode, paid_confirms)
	values
		((select auth.uid()), p_venue_id, trim(p_name), p_format, p_rules,
		 p_starts_at, p_max_entrants, coalesce(p_entry_fee_credits, 0),
		 coalesce(p_entry_mode, 'td_only'), coalesce(p_paid_confirms, false))
	returning id into v_id;

	-- Whoever made it runs it, or nobody does and it cannot be changed.
	insert into public.tbl_competition_roles (created_by, tournament_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director');

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean) from public, anon;
grant execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- And changeable afterwards, on the one function that changes a tournament
--
-- Replaces the version from 20261021120000.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean);

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
	p_auto_status       boolean     default false,
	p_entry_mode        text        default null,
	p_paid_confirms     boolean     default null
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

	if p_format is not null and p_format <> v_t.format
		and exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'This tournament already has a draw, so its format cannot be changed. Clear the draw first.';
	end if;

	if p_third_place is not null and p_third_place <> v_t.third_place
		and exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'The third-place playoff is decided when the draw is generated. Redraw to change it.';
	end if;

	update public.tbl_tournaments
	set name              = coalesce(trim(p_name), name),
		rules             = coalesce(p_rules, rules),
		format            = coalesce(p_format, format),
		status            = coalesce(p_status, status),
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
		create_matches    = coalesce(p_create_matches, create_matches),
		entry_mode        = coalesce(p_entry_mode, entry_mode),
		paid_confirms     = coalesce(p_paid_confirms, paid_confirms)
	where id = p_tournament_id;
end;
$$;

revoke execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean) from public, anon;
grant execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean) to authenticated;
