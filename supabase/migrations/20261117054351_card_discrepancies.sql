-- Discrepancies on a team card (UV, 17 Nov; docs/systems/leagues.md,
-- "Discrepancies"; DECISIONS 17 Nov).
--
-- A discrepancy is somebody's entry on a frame (the lag, or the result) that
-- somebody else has since changed. Thabo records "home won the lag"; the
-- opponent moves it to away: Thabo's entry has been overruled, and he, his
-- captain and the league director see a blue tick on the switch. Tapping it
-- accepts the change; tapping his own end puts his value back, and then the
-- opponent's entry is the one overruled. A person undoing their own entry is
-- never a discrepancy, and neither is filling a value nobody had entered.
--
-- A captain's signature counts as an entry (UV, 17 Nov: "one blue used
-- everywhere; this is a discrepancy just like changes after signing"): the
-- captain put their name to every value on the card, so anybody else
-- changing one afterwards overrules them. That replaces the page's own
-- "changed after signing" blue, worked out from tdc_frame_history.
--
-- Nothing about the changes themselves is stored: who set what, and when, is
-- already in tbl_frame_edit, written by a trigger on every frame write. The
-- one new record is an acceptance. It does not touch the card's version, so
-- accepting never knocks out a signature. Signing still never waits on a
-- discrepancy: a side's signature clears every discrepancy on that side up
-- to it, and the league director's approval clears them all.
--
--   tbl_frame_change_accept        which change was accepted, by whom
--   tdc_card_discrepancies(match)  the open ones, for the card page
--   tdc_accept_frame_change(...)   the blue tick
--
-- A new table referencing tbl_players, so private.tdc_merge_players carries
-- it (CLAUDE.md, idea 9). The foreign-key query from 20261024090641, run on a
-- fresh local copy on 17 Nov, gave 27 references, every one already handled,
-- before this table added its one. Patched from the definition as of
-- 20261113164109, extracted from that copy and diffed: one line added before
-- the signup record is deleted.

create table public.tbl_frame_change_accept (
	id         uuid primary key default gen_random_uuid(),
	-- clock_timestamp(), as tbl_frame_edit and tbl_match_events, so an
	-- acceptance sorts against the edits made in the same transaction.
	created_at timestamptz not null default clock_timestamp(),
	match_id   uuid not null references public.tbl_matches (id) on delete cascade,
	frame_id   uuid not null references public.tbl_frames (id) on delete cascade,
	-- The lag (break_side) or the result (winner_side and result_event).
	thing      text not null check (thing in ('lag', 'result')),
	-- The change accepted: the edit that overruled somebody. A later change
	-- is a new edit, so it is never covered by an older acceptance.
	edit_id    uuid not null references public.tbl_frame_edit (id) on delete cascade,
	accepted_by_player_id uuid references public.tbl_players (id) on delete set null,
	-- The side whose discrepancy was accepted (null for one owned by somebody
	-- on neither side, a league director's own entry). A change after both
	-- captains signed is one discrepancy per side, accepted per side. Also the
	-- side this acceptance speaks for when it is itself overruled later.
	side       text check (side in ('home', 'away')),
	unique nulls not distinct (edit_id, thing, side)
);

create index tbl_frame_change_accept_frame_idx on public.tbl_frame_change_accept (frame_id);
create index tbl_frame_change_accept_player_idx on public.tbl_frame_change_accept (accepted_by_player_id);

comment on table public.tbl_frame_change_accept is
	'A discrepancy on a team card accepted (17 Nov): which change (an edit in tbl_frame_edit) to the lag or the result, by whom. Written only by tdc_accept_frame_change.';

alter table public.tbl_frame_change_accept enable row level security;
revoke all on public.tbl_frame_change_accept from anon, authenticated;


-- The lag or the result of a frame row (tbl_frame_edit's before or after),
-- for comparing: null when nobody is set. The result is the winner with its
-- event, so a tick changed to a break & finish counts as a change.
create function private.tdc_frame_value(p_row jsonb, p_thing text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
	select case
		when p_row is null then null
		when p_thing = 'lag' then nullif(p_row->'break_side', 'null'::jsonb)
		when nullif(p_row->>'winner_side', '') is null then null
		else jsonb_build_array(p_row->'winner_side', p_row->'result_event')
	end;
$$;

-- The side a player is on in a team match, by the two teams' entrants
-- (reserves included), or null: a league director who plays for neither, or
-- nobody.
create function private.tdc_side_in_match(p_match_id uuid, p_player_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
	select case
		when p_player_id is null then null
		when exists (
			select 1 from public.tbl_matches m
			join public.tbl_league_season_entrants e on e.team_id = m.home_team_id
			where m.id = p_match_id and e.player_id = p_player_id
		) then 'home'
		when exists (
			select 1 from public.tbl_matches m
			join public.tbl_league_season_entrants e on e.team_id = m.away_team_id
			where m.id = p_match_id and e.player_id = p_player_id
		) then 'away'
	end;
$$;

revoke execute on function private.tdc_frame_value(jsonb, text) from public, anon;
revoke execute on function private.tdc_side_in_match(uuid, uuid) from public, anon;
grant execute on function private.tdc_frame_value(jsonb, text) to authenticated;
grant execute on function private.tdc_side_in_match(uuid, uuid) to authenticated;


-- ─── The open discrepancies on a card ───
--
-- For each frame, the lag and the result separately, everything that ever
-- set it, in time order:
--   an edit that changed it (tbl_frame_edit), by its editor;
--   a side's signature, by its signer, putting their name to it as it stood;
--   an acceptance, by whoever accepted, of it as it stood;
--   the league director's approval (only ever clears).
-- The last edit is the change in question, made by B. Walking back past B's
-- own entries, the first entry by somebody else is the one B overruled, by
-- its owner A. There is a discrepancy when A's value differs from what B left
-- (B changed it and changed it back: none), and A had a value (filling an
-- empty frame is not overruling anybody; a signature counts even on an empty
-- frame, as the captain signed it empty). It is cleared by an acceptance of
-- that change, a signature by A's side after it, or an approval.
--
-- Who sees the tick is the page's to decide from owner_player_id and
-- owner_side (the person, their captain, the league director); everybody
-- signed in may read this, as tdc_frame_history.
create function public.tdc_card_discrepancies(p_match_id uuid)
returns table (
	frame_id             uuid,
	frame_no             integer,
	thing                text,
	edit_id              uuid,
	owner_player_id      uuid,
	owner_side           text,
	changed_by_player_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_frame   record;
	v_thing   text;
	v_ev      jsonb;
	v_n       integer;
	v_i       integer;
	v_last    integer;
	v_e       jsonb;
	v_p       jsonb;
	v_owners  jsonb;
	v_cleared boolean;
begin
	if (select auth.uid()) is null then
		raise exception 'Sign in first.';
	end if;

	for v_frame in
		select f.id, f.frame_no from public.tbl_frames f
		where f.match_id = p_match_id order by f.frame_no
	loop
		foreach v_thing in array array['lag', 'result'] loop
			select coalesce(jsonb_agg(to_jsonb(x) order by x.at, x.ord), '[]'::jsonb) into v_ev
			from (
				select 'edit' as kind, e.created_at as at, 0 as ord, e.id as ref,
					e.edited_by_player_id as actor,
					private.tdc_side_in_match(p_match_id, e.edited_by_player_id) as side,
					private.tdc_frame_value(e.after, v_thing) as val
				from public.tbl_frame_edit e
				where e.frame_id = v_frame.id and e.action in ('insert', 'update')
					and private.tdc_frame_value(e.after, v_thing)
						is distinct from private.tdc_frame_value(e.before, v_thing)
					-- A lag is somebody's entry only when set by hand, or moved
					-- off a hand-set value. Recording one frame's lag re-works
					-- the derived lag of the frames after it
					-- (tdc_rederive_break_sides), and nobody entered those.
					and (v_thing <> 'lag'
						or coalesce((e.before->>'break_side_manual')::boolean, false)
						or coalesce((e.after->>'break_side_manual')::boolean, false))
				union all
				select 'sign', s.created_at, 1, s.id, s.player_id, s.side,
					private.tdc_frame_value((
						select x.after from public.tbl_frame_edit x
						where x.frame_id = v_frame.id and x.created_at <= s.created_at
						order by x.created_at desc, x.id desc limit 1), v_thing)
				from public.tbl_match_events s
				where s.match_id = p_match_id and s.kind = 'submitted' and s.side is not null
				union all
				select 'approve', s.created_at, 1, s.id, s.player_id, null, null
				from public.tbl_match_events s
				where s.match_id = p_match_id and s.kind = 'approved'
				union all
				select 'accept', a.created_at, 2, a.edit_id, a.accepted_by_player_id, a.side,
					private.tdc_frame_value((
						select x.after from public.tbl_frame_edit x
						where x.frame_id = v_frame.id and x.created_at <= a.created_at
						order by x.created_at desc, x.id desc limit 1), v_thing)
				from public.tbl_frame_change_accept a
				where a.frame_id = v_frame.id and a.thing = v_thing
			) x;

			v_n := jsonb_array_length(v_ev);

			-- The change in question: the last edit.
			v_last := null;
			for v_i in reverse v_n - 1 .. 0 loop
				if v_ev->v_i->>'kind' = 'edit' then v_last := v_i; exit; end if;
			end loop;
			continue when v_last is null;
			v_e := v_ev->v_last;

			-- The entry it overruled: the first by somebody else, walking back.
			-- When that is a signature, the other side's signature just before
			-- it was overruled too (both captains signed, then a change): each
			-- side has its own discrepancy.
			v_owners := '[]'::jsonb;
			for v_i in reverse v_last - 1 .. 0 loop
				continue when v_ev->v_i->>'kind' = 'approve';
				continue when (v_ev->v_i->>'actor') is not distinct from (v_e->>'actor');
				if jsonb_array_length(v_owners) = 0 then
					v_owners := jsonb_build_array(v_ev->v_i);
					exit when v_ev->v_i->>'kind' <> 'sign';
				else
					exit when v_ev->v_i->>'kind' <> 'sign';
					if not exists (select 1 from jsonb_array_elements(v_owners) o
						where (o->>'side') is not distinct from (v_ev->v_i->>'side')) then
						v_owners := v_owners || jsonb_build_array(v_ev->v_i);
					end if;
				end if;
			end loop;

			for v_p in select o from jsonb_array_elements(v_owners) o loop
				continue when v_p->>'kind' in ('edit', 'accept') and coalesce(v_p->'val', 'null'::jsonb) = 'null'::jsonb;
				continue when coalesce(v_p->'val', 'null'::jsonb) = coalesce(v_e->'val', 'null'::jsonb);

				-- Cleared since? An acceptance of this change for this side
				-- (the LD's for a side counts as that side's), a signature by
				-- this side, or the LD's approval.
				v_cleared := false;
				for v_i in v_last + 1 .. v_n - 1 loop
					if (v_ev->v_i->>'kind' = 'accept' and v_ev->v_i->>'ref' = v_e->>'ref'
							and (v_ev->v_i->>'side') is not distinct from (v_p->>'side'))
						or (v_ev->v_i->>'kind' = 'sign' and v_p->>'side' is not null and v_ev->v_i->>'side' = v_p->>'side')
						or v_ev->v_i->>'kind' = 'approve' then
						v_cleared := true;
						exit;
					end if;
				end loop;
				continue when v_cleared;

				frame_id := v_frame.id;
				frame_no := v_frame.frame_no;
				thing := v_thing;
				edit_id := (v_e->>'ref')::uuid;
				owner_player_id := (v_p->>'actor')::uuid;
				owner_side := v_p->>'side';
				changed_by_player_id := (v_e->>'actor')::uuid;
				return next;
			end loop;
		end loop;
	end loop;
end;
$$;

revoke execute on function public.tdc_card_discrepancies(uuid) from public, anon;
grant execute on function public.tdc_card_discrepancies(uuid) to authenticated;


-- ─── The blue tick ───
-- Accepts the open discrepancies on one frame's lag or result that this
-- person may accept: their own, their side's as its captain, or every one as
-- the league director (UV, 17 Nov). Each acceptance is stored for the side
-- whose discrepancy it was. Nothing open (already accepted by somebody else,
-- or the change put back): false, and the page reads the card again, which
-- shows that. Something open but none of it theirs: refused.
create function public.tdc_accept_frame_change(p_match_id uuid, p_frame_no integer, p_thing text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me    uuid;
	v_d     record;
	v_ld    boolean;
	v_open  boolean := false;
	v_taken boolean := false;
begin
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'Sign in first.';
	end if;
	if p_thing is null or p_thing not in ('lag', 'result') then
		raise exception 'TDC (Error): there is no "%" on a frame to accept.', p_thing;
	end if;
	v_ld := coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false);

	for v_d in
		select * from public.tdc_card_discrepancies(p_match_id) d
		where d.frame_no = p_frame_no and d.thing = p_thing
	loop
		v_open := true;
		continue when not (v_ld
			or coalesce(v_d.owner_player_id = v_me, false)
			or (v_d.owner_side is not null and private.tdc_can_set_lineup(p_match_id, v_d.owner_side)));
		insert into public.tbl_frame_change_accept (match_id, frame_id, thing, edit_id, accepted_by_player_id, side)
		values (p_match_id, v_d.frame_id, p_thing, v_d.edit_id, v_me, v_d.owner_side)
		on conflict (edit_id, thing, side) do nothing;
		v_taken := true;
	end loop;

	if v_open and not v_taken then
		raise exception 'Only the player whose entry was changed, their captain or the league director can accept this.';
	end if;
	return v_taken;
end;
$$;

revoke execute on function public.tdc_accept_frame_change(uuid, integer, text) from public, anon;
grant execute on function public.tdc_accept_frame_change(uuid, integer, text) to authenticated;


-- The merge carries the acceptances.
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

revoke execute on function private.tdc_merge_players(uuid, uuid, uuid) from public, anon, authenticated;
