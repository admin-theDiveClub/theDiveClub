-- Notifications: a record first, a push second.
--
-- Until now the only notification was a push, fired from the page by
-- notify-card. A push is handed to Apple or Google and forgotten: if the
-- phone was off, or the person never switched notifications on — which is
-- most people — it never happened and there is nothing to find afterwards.
--
-- UV's case, 22 Oct: a TD enters sixteen players on Tuesday for Saturday.
-- Push-only means everyone whose phone was off learns nothing.
--
-- So every notification becomes a **row** the recipient can come back to, and
-- a push is sent on top where they have allowed it. The push failing is then
-- not data loss. It also makes the per-category switches mean what people
-- expect: muting tournaments stops the interruption without throwing away the
-- record.
--
-- ─── What this migration does and does not do ───
--
-- Does: the table, the per-category switches, and the functions a page needs
-- to read, mark seen and clear.
--
-- Does not: write any notifications yet. The events are wired in the next
-- migration, so that this one can be reviewed as one idea.

-- ─────────────────────────────────────────────────────────────────
-- What a person has been told
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_notifications (
	id          uuid primary key default gen_random_uuid(),

	-- clock_timestamp, not now(): several notifications are written in one
	-- transaction — both players when a match becomes ready — and now() is
	-- transaction time, so they would share a timestamp and come back in an
	-- arbitrary order. Same correction 20261015170000 made to tbl_match_events
	-- and 20261021110000 made to tbl_frame_edit.
	created_at  timestamptz not null default clock_timestamp(),

	-- The player, not the user. Everything else in this schema keys on
	-- player_id, and a player may be merged into another — at which point
	-- tdc_merge_players moves these with everything else.
	player_id   uuid not null references public.tbl_players (id) on delete cascade,

	-- The switch that governs whether this interrupts anybody. UV, 22 Oct:
	-- high level — all notifications on or off for matches, tournaments,
	-- leagues and so on.
	category    text not null check (category in ('match', 'tournament', 'league', 'admin')),

	-- What happened. Not shown to anyone; it is for the page to group by and
	-- for us to find things with later.
	kind        text not null,

	-- Written when the notification is made, not derived at read time. A
	-- notification is a record of what somebody was told at a moment — if the
	-- tournament is renamed afterwards, the message they received did not
	-- change. The same reason the poster stores a snapshot.
	title       text not null check (char_length(trim(title)) between 1 and 120),
	body        text check (body is null or char_length(body) <= 400),

	-- Where it takes you. A same-site path only, checked here rather than
	-- trusted: this value ends up in an href, and a notification that can
	-- carry "https://elsewhere" is a phishing vector handed to whoever can
	-- write one.
	link        text check (link is null or (link like '/%' and link not like '//%')),

	-- What it is about, so a page can offer to open it and so the merge has
	-- something to repoint. Explicit columns rather than a generic
	-- ref_table/ref_id pair: there are two, they are both real foreign keys,
	-- and the generic version is still undecided for the credit ledger.
	match_id      uuid references public.tbl_matches (id) on delete cascade,
	tournament_id uuid references public.tbl_tournaments (id) on delete cascade,

	-- Null until the person opens the menu. Drives the pip and the greying.
	seen_at     timestamptz,

	-- Null until a push has gone out for this row. Lets the push be sent
	-- separately from the row being written, and sent once.
	pushed_at   timestamptz
);

comment on table public.tbl_notifications is
	'One row per thing a player has been told. The record is the notification; a push is a copy of it sent to a device, and may never arrive. Read through tdc_my_notifications.';

comment on column public.tbl_notifications.link is
	'A same-site path, enforced by a check constraint. Never a full URL: this value is put into an href, and anything that can write a notification could otherwise send somebody to another site.';

create index tbl_notifications_player_idx
	on public.tbl_notifications (player_id, created_at desc);

-- For the pip, which asks "are there any unseen" on every page load.
create index tbl_notifications_unseen_idx
	on public.tbl_notifications (player_id) where seen_at is null;

alter table public.tbl_notifications enable row level security;

-- Yours and nobody else's. Unlike most tables here, there is no case for a
-- wider read: a notification is addressed to one person.
create policy "A player can see their own notifications"
	on public.tbl_notifications for select to authenticated
	using (player_id in (
		select id from public.tbl_players where user_id = (select auth.uid())));

grant select on public.tbl_notifications to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Who wants to be interrupted
--
-- A row per player per category, and **no row means on**. That way nothing
-- has to be backfilled for existing players, and a category added later
-- starts switched on for everybody without a second migration.
--
-- This governs the push only. The row is always written: muting a category
-- means "stop buzzing my phone", not "keep things from me".
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_notification_prefs (
	player_id  uuid not null references public.tbl_players (id) on delete cascade,
	category   text not null check (category in ('match', 'tournament', 'league', 'admin')),
	push_enabled boolean not null default true,
	updated_at timestamptz not null default now(),

	primary key (player_id, category)
);

comment on table public.tbl_notification_prefs is
	'Per-category push switches. No row means on. Governs whether a push is sent, never whether the notification is recorded.';

alter table public.tbl_notification_prefs enable row level security;

create policy "A player can see their own notification settings"
	on public.tbl_notification_prefs for select to authenticated
	using (player_id in (
		select id from public.tbl_players where user_id = (select auth.uid())));

grant select on public.tbl_notification_prefs to authenticated;


create function public.tdc_set_notification_pref(p_category text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me uuid;
begin
	if p_category not in ('match', 'tournament', 'league', 'admin') then
		raise exception 'TDC (Error): unknown notification category "%".', p_category;
	end if;
	if p_enabled is null then
		raise exception 'TDC (Error): a notification setting is on or off.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	insert into public.tbl_notification_prefs (player_id, category, push_enabled)
	values (v_me, p_category, p_enabled)
	on conflict (player_id, category) do update
		set push_enabled = excluded.push_enabled, updated_at = now();
end;
$$;

revoke execute on function public.tdc_set_notification_pref(text, boolean) from public, anon;
grant execute on function public.tdc_set_notification_pref(text, boolean) to authenticated;


-- Every category with its setting, including the ones that have no row, so a
-- settings page can render the list without knowing what the categories are.
create function public.tdc_notification_prefs()
returns table (category text, push_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
	select c.category,
		coalesce(p.push_enabled, true)
	from unnest(array['match', 'tournament', 'league', 'admin']) as c(category)
	left join public.tbl_notification_prefs p
		on p.category = c.category
		and p.player_id = (select id from public.tbl_players where user_id = (select auth.uid()))
	order by array_position(array['match', 'tournament', 'league', 'admin'], c.category);
$$;

revoke execute on function public.tdc_notification_prefs() from public, anon;
grant execute on function public.tdc_notification_prefs() to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Writing one
--
-- private, because nothing outside the database should be able to put a
-- notification in front of somebody. The same reasoning as notify-card
-- taking only { match_id, kind } and composing the message itself: a
-- function that accepts arbitrary text addressed to an arbitrary person is a
-- spam machine rather than a notification system.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_notify(
	p_player_id     uuid,
	p_category      text,
	p_kind          text,
	p_title         text,
	p_body          text default null,
	p_link          text default null,
	p_match_id      uuid default null,
	p_tournament_id uuid default null,
	-- Who caused it. Nobody is told about their own action — the whole point
	-- of a notification is that you were not there. Pass null for something
	-- that had no actor, such as a window expiring.
	p_actor_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_has_account boolean;
	v_id uuid;
begin
	if p_player_id is null then return null; end if;

	-- Telling somebody what they just did themselves.
	if p_actor_id is not null and p_actor_id = p_player_id then
		return null;
	end if;

	-- A walk-in has no account and can never read this, so the row would be
	-- unreachable. tdc_merge_players carries a walk-in's history into a real
	-- account when they sign up, but it cannot deliver messages backwards in
	-- time, and a pile of unread rows arriving on day one is noise.
	select user_id is not null into v_has_account
	from public.tbl_players where id = p_player_id;

	if v_has_account is not true then
		return null;
	end if;

	insert into public.tbl_notifications
		(player_id, category, kind, title, body, link, match_id, tournament_id)
	values
		(p_player_id, p_category, p_kind, trim(p_title), p_body, p_link,
		 p_match_id, p_tournament_id)
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function private.tdc_notify(uuid, text, text, text, text, text, uuid, uuid, uuid) from public, anon;
grant execute on function private.tdc_notify(uuid, text, text, text, text, text, uuid, uuid, uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Reading them
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_my_notifications(p_limit integer default 50)
returns table (
	id         uuid,
	created_at timestamptz,
	category   text,
	kind       text,
	title      text,
	body       text,
	link       text,
	seen       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	select n.id, n.created_at, n.category, n.kind, n.title, n.body, n.link,
		n.seen_at is not null
	from public.tbl_notifications n
	where n.player_id = (select id from public.tbl_players where user_id = (select auth.uid()))
	order by n.created_at desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.tdc_my_notifications(integer) from public, anon;
grant execute on function public.tdc_my_notifications(integer) to authenticated;


-- Just the count, for the pip. Its own function because every page asks this
-- on load and none of them want the list.
create function public.tdc_unseen_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select count(*)::integer
	from public.tbl_notifications n
	where n.player_id = (select id from public.tbl_players where user_id = (select auth.uid()))
		and n.seen_at is null;
$$;

revoke execute on function public.tdc_unseen_notification_count() from public, anon;
grant execute on function public.tdc_unseen_notification_count() to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Opening the menu
--
-- Marks everything seen, which is what clears the pip, and takes the
-- opportunity to prune. Pruning happens here rather than on a schedule
-- because this is the one call that happens often, is already a write, and
-- already belongs to the person whose rows are being pruned. No cron to
-- forget, and nothing accumulating for somebody who never opens the app —
-- their rows stay, which is right, because they have not seen them.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_mark_notifications_seen()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me  uuid;
	v_hit integer;
begin
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	-- Anything seen and older than this goes. One number, in one place.
	-- Thirty days is long enough that a notification is still there when
	-- somebody comes back from a fortnight away, and short enough that the
	-- list stays a list rather than an archive.
	delete from public.tbl_notifications
	where player_id = v_me
		and seen_at is not null
		and seen_at < now() - interval '30 days';

	update public.tbl_notifications
	set seen_at = now()
	where player_id = v_me and seen_at is null;

	get diagnostics v_hit = row_count;
	return v_hit;
end;
$$;

revoke execute on function public.tdc_mark_notifications_seen() from public, anon;
grant execute on function public.tdc_mark_notifications_seen() to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Clearing
--
-- A hard delete, not a flag. This is the person's own record of what they
-- were told, they have asked for it gone, and keeping a hidden copy of
-- something somebody dismissed is the kind of thing that is embarrassing to
-- explain later.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_clear_notification(p_id uuid)
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

	delete from public.tbl_notifications
	where id = p_id and player_id = v_me;

	-- Silent on a miss. Clearing something already cleared — a second tap, or
	-- two tabs open — is not a failure worth a message.
end;
$$;

revoke execute on function public.tdc_clear_notification(uuid) from public, anon;
grant execute on function public.tdc_clear_notification(uuid) to authenticated;


create function public.tdc_clear_all_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me  uuid;
	v_hit integer;
begin
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	delete from public.tbl_notifications where player_id = v_me;
	get diagnostics v_hit = row_count;
	return v_hit;
end;
$$;

revoke execute on function public.tdc_clear_all_notifications() from public, anon;
grant execute on function public.tdc_clear_all_notifications() to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The merge has to know about this table
--
-- private.tdc_merge_players moves every reference to a merged-away player.
-- It has been four tables out of date once already, which hard-deleted
-- tournament entries and nulled override attribution — found 21 Oct by
-- running the old version against a scratch database.
--
-- Patched from the 20261021110000 version, not retyped. Retyping this
-- function has silently dropped guards twice.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_merge_players(p_keep_id uuid, p_remove_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
	-- The settings are deliberately not moved: p_keep_id is a walk-in and
	-- has none, so there is nothing to carry and nothing to overwrite.
	update public.tbl_notifications set player_id = p_keep_id where player_id = p_remove_id;

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
$$;
