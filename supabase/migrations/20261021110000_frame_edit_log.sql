-- The frame edit log, and the rank rule it makes possible.
--
-- `tbl_frame_edit` is in the design from the start: "frames stay the record,
-- the edit goes through the normal write path with the lock bypassed for a
-- role that is allowed to bypass it, and tbl_frame_edit records who, when,
-- and before/after." It is also what the scoresheet design needs to tell a
-- captain *"The card changed after you submitted: Frame 3, break outcome Dry
-- → Foul, by Trevor Mokoena 14:22"*.
--
-- And it is the missing half of the role model UV described: "TD > Referee >
-- Scorer > Player, where a higher role can overwrite a lower one's entry but
-- not vice versa … tbl_frame_edit records the editor's role at the time of
-- the edit, and a write is rejected if a higher-ranked role has already
-- touched that frame — unless the writer outranks them." That rule cannot
-- exist without a record of who touched what, which is why it waited for
-- this table.
--
-- ─── Why a trigger and not the write functions ───
--
-- Every frame write goes through tdc_record_frame or tdc_remove_frame today,
-- but a coordinator correcting a locked card, the merge function, and
-- anything added later do not. A log with a hole in it is worse than no log,
-- because it is believed. A row-level trigger is the only place that sees
-- every write.

-- ─────────────────────────────────────────────────────────────────
-- The log
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_frame_edit (
	id         uuid primary key default gen_random_uuid(),
	-- clock_timestamp(), not now(): now() is the time the *transaction* began,
	-- so several frames written in one transaction would share a timestamp to
	-- the microsecond and the history would come back jumbled. This is the
	-- same correction 20261015170000 made to tbl_match_events, for the same
	-- reason — and it was caught here the same way, by a test that wrote four
	-- edits in one block and got them back out of order.
	created_at timestamptz not null default clock_timestamp(),

	-- Denormalised on purpose: a card's history is one query against one
	-- column, and the frame itself may be gone by the time anybody reads it.
	match_id   uuid not null references public.tbl_matches (id) on delete cascade,
	frame_id   uuid,
	frame_no   integer not null,

	action     text not null check (action in ('insert', 'update', 'delete')),

	-- Who. Null only where a write happened with no signed-in player behind
	-- it, which today means a service-role or migration write.
	edited_by_player_id uuid references public.tbl_players (id) on delete set null,

	-- Their standing on this match at the moment of the edit, frozen. Roles
	-- change — a scorer on Tuesday may be the director in March — and a log
	-- that resolved the role at read time would rewrite history every time
	-- somebody was promoted.
	editor_role text not null check (editor_role in ('director', 'referee', 'scorer', 'player')),
	editor_rank integer not null,

	-- The card as it stood after this edit, so a submission that no longer
	-- matches can be explained by the rows that came after it.
	card_version integer not null,

	-- The whole row, before and after. Null on the side that does not exist.
	-- Kept as jsonb rather than a column per field so that adding a column to
	-- tbl_frames does not silently stop being logged.
	before jsonb,
	after  jsonb
);

create index tbl_frame_edit_match_idx on public.tbl_frame_edit (match_id, created_at desc);
create index tbl_frame_edit_frame_idx on public.tbl_frame_edit (frame_id);
create index tbl_frame_edit_player_idx on public.tbl_frame_edit (edited_by_player_id);

comment on table public.tbl_frame_edit is
	'Every change to every frame: who, when, their rank at the time, and the row before and after. Written by a trigger so no write path can miss it.';

alter table public.tbl_frame_edit enable row level security;

-- Readable by any signed-in player, like the frames and the card events it
-- describes. Nothing is writable through the API: the trigger is the only
-- thing that inserts, and nothing ever updates or deletes a log row.
create policy "Signed-in users can see how a card was changed"
	on public.tbl_frame_edit for select to authenticated using (true);

grant select on public.tbl_frame_edit to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Who the editor is, in the terms the ladder uses
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_editor_role(p_rank integer)
returns text
language sql
immutable
as $$
	select case
		when p_rank >= 100 then 'director'
		when p_rank >= 50  then 'referee'
		when p_rank >= 30  then 'scorer'
		else 'player'
	end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- The rank rule
--
-- A write is refused when somebody senior has already touched this frame,
-- unless the writer is at least their equal. Equal ranks may overwrite each
-- other, which is what lets two players score their own match and two scorers
-- share a table.
--
-- Outside a competition everyone is rank 0, so this never fires on social
-- play: there are no officials, and the only people involved are the two
-- playing.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_frame_rank_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

	if private.tdc_match_competition(v_match) is null then
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
$$;

-- Named so it sorts after tbl_frames_locked_when_agreed: triggers of the same
-- timing fire in name order, and "this card is locked" is the more fundamental
-- refusal of the two, so it should be the one somebody hears first.
create trigger tbl_frames_rank_guard
	before insert or update or delete on public.tbl_frames
	for each row execute function private.tdc_frame_rank_guard();


-- ─────────────────────────────────────────────────────────────────
-- Writing the log
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_frame_edit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_match uuid := coalesce(new.match_id, old.match_id);
	v_me    uuid;
	v_rank  integer;
begin
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

	return coalesce(new, old);
end;
$$;

create trigger tbl_frames_edit_log
	after insert or update or delete on public.tbl_frames
	for each row execute function private.tdc_frame_edit_log();


-- ─────────────────────────────────────────────────────────────────
-- Reading it back
--
-- Returns what changed in words rather than two blobs, because the thing a
-- captain needs is "Frame 3, break outcome Dry → Foul, by Trevor Mokoena",
-- not a pair of jsonb documents to diff by eye.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_frame_history(p_match_id uuid, p_since_version integer default null)
returns table (
	at           timestamptz,
	frame_no     integer,
	action       text,
	by_name      text,
	editor_role  text,
	card_version integer,
	changed      text
)
language sql
stable
security definer
set search_path = ''
as $$
	select e.created_at, e.frame_no, e.action,
		coalesce(p.display_name, 'TDC (No Name)'), e.editor_role, e.card_version,
		case
			when e.action = 'insert' then 'Frame added'
			when e.action = 'delete' then 'Frame removed'
			else nullif(
				(select string_agg(
					k || ' ' || coalesce(e.before->>k, '—') || ' → ' || coalesce(e.after->>k, '—'),
					', ' order by k)
				from jsonb_object_keys(e.after) k
				-- Only the fields a person would recognise. Timings and the
				-- clicker log change constantly and would bury the one line
				-- somebody is actually looking for.
				where k in ('break_side', 'break_outcome', 'winner_side', 'result_event',
					'status', 'abandon_reason', 'referee_player_id', 'break_player_id')
					and e.before->>k is distinct from e.after->>k),
				'')
		end
	from public.tbl_frame_edit e
	left join public.tbl_players p on p.id = e.edited_by_player_id
	where e.match_id = p_match_id
		and (p_since_version is null or e.card_version > p_since_version)
	order by e.created_at desc, e.id desc;
$$;

revoke execute on function public.tdc_frame_history(uuid, integer) from public, anon;
grant execute on function public.tdc_frame_history(uuid, integer) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The merge has to know about the new table — and three older ones
--
-- CLAUDE.md carries the warning on tdc_merge_players: "When new tables
-- reference tbl_players, add them to the move section below." Four tables
-- have been added since it was last touched and none of them were:
--
--   tbl_frame_edit.edited_by_player_id       (set null)  — added above
--   tbl_competition_roles.player_id          (cascade)   — 20261019140000
--   tbl_tournament_entrants.player_id        (cascade)   — 20261019140000
--   tbl_match_result_override.set_by         (set null)  — 20261020100000
--
-- The two cascades are the dangerous ones. The merge deletes the signup
-- record, so a walk-in who had already been entered in a tournament under
-- their new account would have had that entry — and any role they held —
-- deleted without a word at the moment staff linked the records. That is
-- exactly the "loses its history quietly" failure the original comment warns
-- about, on the one flow UV has flagged as able to lose real data.
--
-- The entrant move is a plain update rather than an upsert because
-- tbl_tournament_entrants is unique on (tournament_id, player_id): if both
-- records are somehow in the same tournament, the update fails loudly rather
-- than silently dropping one of them. The same is true of the roles table,
-- which is unique on (tournament_id, player_id, role).
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
