-- A team night is sessions: the order is one per position, not one per frame.
--
-- UV, 23 Oct: "My lineup should be set for the amount of frames in a session
-- and then reserves can be managed." Designed in docs/design/leagues.md §3
-- and settled with him on 23–24 Oct (docs/DECISIONS.md):
--
--   • A captain names team_size positions (five, in a five-man league), not
--     25 slots. tbl_league_match_order.lineup_slot now means the position.
--   • At the second lock the night is built from the two orders and the
--     rotation table: session s, home position h meets away position
--     private.tdc_rotation_away(rules, s, h). A frame's lineup_slot is
--     (s − 1) × team_size + h, so session 2 of a five-man night is slots 6–10.
--   • **An empty seat stays open until the card is signed** (UV: option b,
--     which is what the design always said and the 22 Oct build did not do).
--     A position filled on one side only gives a pending frame with one
--     player; a reserve or a latecomer can be put into it; whatever is still
--     empty becomes a walkover to the side that turned up when a captain
--     signs. A pairing empty on both sides has no frame, as before.
--   • **Reserves fill a frame — one position in one session — after the
--     lock**, through tdc_swap_frame_player, under UV's three rules:
--       1. a player plays no more than one frame in a session;
--       2. a player locked into the order keeps their position: only a
--          reserve (someone not in tonight's order) comes in, and the
--          position's own player can be put back;
--       3. a reserve never faces the same opponent twice in the night.
--   • A match frozen with no team size (before ruleset version 3) keeps the
--     old shape: one position per slot, slot n meets slot n. Every league has
--     a team size since 20261023213048, so this is only for old matches.
--
-- The rows already in tbl_league_match_order are kept: slots 1–5 are
-- positions 1–5 (docs/DECISIONS.md, "The orders already recorded are kept").
-- The migration stops rather than guess if an order already has frames or a
-- locked side behind it, or a slot beyond its match's team size.
--
-- Patched from definitions extracted from a freshly reset local database:
-- private.tdc_lineup_slots (20261023193153), tdc_set_lineup_slot,
-- tdc_match_lineup, private.tdc_materialise_lineup_frames,
-- tdc_swap_frame_player, tdc_match_card (20261022230000 and later),
-- tdc_submit_card (20261023090000 and later).


-- ─── Stop rather than guess ───

do $$
declare
	v_bad text;
begin
	select string_agg(distinct o.match_id::text, ', ') into v_bad
	from public.tbl_league_match_order o
	where exists (select 1 from public.tbl_frames f where f.match_id = o.match_id)
		or exists (select 1 from public.tbl_league_match_sides s
			where s.match_id = o.match_id and s.locked_at is not null);
	if v_bad is not null then
		raise exception 'Stopped: these matches have an order with frames or a locked side behind it, which this migration will not translate: %. Ask UV whether to clear them.', v_bad;
	end if;

	select string_agg(distinct o.match_id::text, ', ') into v_bad
	from public.tbl_league_match_order o
	join public.tbl_matches m on m.id = o.match_id
	where private.tdc_team_size(m.rules) > 0
		and o.lineup_slot > private.tdc_team_size(m.rules);
	if v_bad is not null then
		raise exception 'Stopped: these matches have order slots beyond their team size, which are not positions: %. Ask UV whether to clear them.', v_bad;
	end if;
end;
$$;


-- ─── Where a frame sits ───
-- The one place a frame's session and positions are worked out from its
-- slot. Null-safe and never raising, because the card reads call them.

create function private.tdc_frame_session(p_rules jsonb, p_slot integer)
returns integer
language sql
immutable
set search_path = ''
as $$
	select case
		when p_slot is null then null
		when private.tdc_team_size(p_rules) < 1 then 1
		else ((p_slot - 1) / private.tdc_team_size(p_rules)) + 1
	end;
$$;

create function private.tdc_frame_position(p_rules jsonb, p_slot integer, p_side text)
returns integer
language sql
immutable
set search_path = ''
as $$
	select case
		when p_slot is null then null
		-- No sessions: the slot is the position, and slot n meets slot n.
		when t.n < 1 then p_slot
		when p_side = 'home' then ((p_slot - 1) % t.n) + 1
		else private.tdc_rotation_away(p_rules, ((p_slot - 1) / t.n) + 1, ((p_slot - 1) % t.n) + 1)
	end
	from (select private.tdc_team_size(p_rules) as n) t;
$$;

revoke execute on function private.tdc_frame_session(jsonb, integer) from public, anon, authenticated;
revoke execute on function private.tdc_frame_position(jsonb, integer, text) from public, anon, authenticated;


-- ─── How many frames, how many positions ───

-- With a team size the card is exactly team_size² frames. It used to be the
-- largest of that, the highest slot used and the fuller squad, which with
-- reserves allowed could have outgrown the night (a two-man league with a
-- six-player squad would have drawn six slots).
CREATE OR REPLACE FUNCTION private.tdc_lineup_slots(p_match_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select case
		when (select private.tdc_team_size(m.rules) from public.tbl_matches m where m.id = p_match_id) > 0
			then (select private.tdc_team_size(m.rules) * private.tdc_team_size(m.rules)
				from public.tbl_matches m where m.id = p_match_id)
		else greatest(
		-- Never zero. A night with nobody marked present yet still has a
		-- first slot, and the slot guard reads this number to decide what
		-- exists — answering zero there is the same bug in another place.
		1,
		-- What the rules say, when they say anything countable.
		coalesce((
			select case m.rules->>'win_condition_type'
					when 'fixed_frames' then (m.rules->>'win_condition_target')::integer
					when 'best_of'      then (m.rules->>'win_condition_target')::integer
					when 'race_to'      then (m.rules->>'win_condition_target')::integer * 2 - 1
				end
			from public.tbl_matches m where m.id = p_match_id
		), 0),
		-- Whatever order has already been built, so nothing is ever lost.
		coalesce((
			select max(lineup_slot) from public.tbl_league_match_order
			where match_id = p_match_id
		), 0),
		-- A timed or free-play night still has an order: one slot per player
		-- on the fuller side.
		coalesce((
			select max(n) from (
				select count(*) as n from public.tbl_league_match_squad
				where match_id = p_match_id group by side
			) s
		), 0)
	) end;
$function$;

-- What a captain fills in: the team size, or one per slot with none.
create function private.tdc_lineup_positions(p_match_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select case
		when private.tdc_team_size(m.rules) > 0 then private.tdc_team_size(m.rules)
		else private.tdc_lineup_slots(p_match_id)
	end
	from public.tbl_matches m where m.id = p_match_id;
$$;

revoke execute on function private.tdc_lineup_positions(uuid) from public, anon, authenticated;


-- ─── The order is positions ───

CREATE OR REPLACE FUNCTION public.tdc_set_lineup_slot(p_match_id uuid, p_lineup_slot integer, p_player_id uuid DEFAULT NULL::uuid, p_side text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_m      public.tbl_matches%rowtype;
	v_side   text;
	v_locked timestamptz;
	v_slots  integer;
begin
	v_m := private.tdc_lineup_match(p_match_id);

	-- A captain's own side by default; the director has to say which.
	v_side := coalesce(p_side, private.tdc_league_match_side(p_match_id));
	if v_side is null then
		raise exception 'Say which side this is for. You do not captain either team in this match.';
	end if;
	if v_side not in ('home', 'away') then
		raise exception 'TDC (Error): side must be home or away, not "%".', v_side;
	end if;
	if not private.tdc_can_set_lineup(p_match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can set its lineup.';
	end if;

	select locked_at into v_locked
	from public.tbl_league_match_sides where match_id = p_match_id and side = v_side;

	-- What locks is the order. A reserve after the lock changes a frame's
	-- participant instead, which is a different act on a different table.
	if v_locked is not null then
		raise exception 'That lineup is locked. A change now is a reserve on the night, not a new order.';
	end if;

	-- Positions, not frames: a five-man night has five (UV, 23 Oct).
	v_slots := private.tdc_lineup_positions(p_match_id);
	if p_lineup_slot is null or p_lineup_slot < 1 then
		raise exception 'TDC (Error): a slot number starts at 1.';
	end if;
	if v_slots > 0 and p_lineup_slot > v_slots then
		raise exception 'This match has % positions, so there is no position %.', v_slots, p_lineup_slot;
	end if;

	if p_player_id is not null then
		if not exists (
			select 1 from public.tbl_league_match_squad
			where match_id = p_match_id and side = v_side and player_id = p_player_id
		) then
			raise exception 'That player is not in the squad for tonight. Add them to the squad first.';
		end if;

		-- A player in two slots is the one mistake that cannot be played.
		update public.tbl_league_match_order
		set player_id = null
		where match_id = p_match_id and side = v_side
			and player_id = p_player_id and lineup_slot <> p_lineup_slot;
	end if;

	insert into public.tbl_league_match_order (set_by, match_id, side, lineup_slot, player_id)
	values ((select auth.uid()), p_match_id, v_side, p_lineup_slot, p_player_id)
	on conflict (match_id, side, lineup_slot)
		do update set player_id = excluded.player_id, set_by = excluded.set_by;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tdc_match_lineup(p_match_id uuid)
 RETURNS TABLE(lineup_slot integer, side text, player_id uuid, display_name text, locked boolean, hidden boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_mine  text;
	v_runs  boolean;
	v_both  boolean;
	v_slots integer;
begin
	if (select auth.uid()) is null then
		return;
	end if;
	if not exists (select 1 from public.tbl_matches where id = p_match_id) then
		return;
	end if;

	v_mine := private.tdc_league_match_side(p_match_id);
	v_runs := coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false);
	v_both := (select count(*) from public.tbl_league_match_sides
		where match_id = p_match_id and locked_at is not null) >= 2;
	v_slots := private.tdc_lineup_positions(p_match_id);

	-- Every slot of both sides comes back, so a captain sees the shape of the
	-- night rather than only the rows somebody has filled. What is withheld is
	-- the name.
	return query
		select g.slot, g.side,
			case when v_both or v_runs or g.side = v_mine then o.player_id end,
			case when v_both or v_runs or g.side = v_mine then p.display_name end,
			s.locked_at is not null,
			-- True where there is somebody in the slot and you are not allowed
			-- to know who yet. An empty slot is not a secret.
			not (v_both or v_runs or g.side = v_mine) and o.player_id is not null
		from (
			select gs.slot, sides.side
			from generate_series(1, greatest(v_slots, 1)) gs(slot)
			cross join (values ('home'), ('away')) sides(side)
		) g
		left join public.tbl_league_match_order o
			on o.match_id = p_match_id and o.side = g.side and o.lineup_slot = g.slot
		left join public.tbl_players p on p.id = o.player_id
		left join public.tbl_league_match_sides s
			on s.match_id = p_match_id and s.side = g.side
		order by g.slot, g.side;
end;
$function$;


-- ─── The night, built from two orders and the rotation ───

CREATE OR REPLACE FUNCTION private.tdc_materialise_lineup_frames(p_match_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_rules jsonb;
	v_slots integer;
	v_slot  integer;
	v_home  uuid;
	v_away  uuid;
	v_no    integer := 0;
	v_id    uuid;
begin
	-- Both sides have to be in before anything is written.
	if (select count(*) from public.tbl_league_match_sides
		where match_id = p_match_id and locked_at is not null) < 2 then
		return 0;
	end if;

	-- Idempotent: a second lock, or a cutoff arriving after one, finds the
	-- frames already there and leaves them alone.
	if exists (select 1 from public.tbl_frames where match_id = p_match_id) then
		return 0;
	end if;

	select rules into v_rules from public.tbl_matches where id = p_match_id;
	v_slots := private.tdc_lineup_slots(p_match_id);

	for v_slot in 1 .. v_slots loop
		-- Who sits in each seat of this frame: the home position's player
		-- and the away position the rotation pairs it with.
		select player_id into v_home from public.tbl_league_match_order
		where match_id = p_match_id and side = 'home'
			and lineup_slot = private.tdc_frame_position(v_rules, v_slot, 'home');
		select player_id into v_away from public.tbl_league_match_order
		where match_id = p_match_id and side = 'away'
			and lineup_slot = private.tdc_frame_position(v_rules, v_slot, 'away');

		-- Neither side filled it: no frame. The slot vanishes.
		if v_home is null and v_away is null then
			continue;
		end if;

		v_no := v_no + 1;

		-- One side empty is still a frame to play: a reserve or a latecomer
		-- can be put in until the card is signed, and only then does an
		-- empty seat become a walkover (UV, 24 Oct; design §3).
		insert into public.tbl_frames (match_id, frame_no, lineup_slot, status)
		values (p_match_id, v_no, v_slot, 'pending')
		returning id into v_id;

		insert into public.tbl_frame_participants (frame_id, side, player_id)
		select v_id, x.side, x.player_id
		from (values ('home', v_home), ('away', v_away)) x(side, player_id)
		where x.player_id is not null;
	end loop;

	update public.tbl_matches
	set card_version = card_version + 1,
		status = case when status = 'scheduled' then 'in_progress' else status end,
		started_at = coalesce(started_at, now())
	where id = p_match_id;

	return v_no;
end;
$function$;


-- ─── An empty seat becomes a walkover when the card is signed ───
-- Called by tdc_submit_card before the signature is recorded, so the version
-- a captain signs is the card with its walkovers in it. Only a pending frame
-- with exactly one side seated is touched.

create function private.tdc_settle_empty_seats(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_n integer;
begin
	update public.tbl_frames f
	set status = 'complete',
		winner_side = (select fp.side from public.tbl_frame_participants fp where fp.frame_id = f.id limit 1),
		result_event = 'default',
		ended_at = now()
	where f.match_id = p_match_id
		and f.status = 'pending'
		and (select count(distinct fp.side) from public.tbl_frame_participants fp where fp.frame_id = f.id) = 1;
	get diagnostics v_n = row_count;

	if v_n > 0 then
		update public.tbl_matches set card_version = card_version + 1 where id = p_match_id;
	end if;
	return v_n;
end;
$$;

revoke execute on function private.tdc_settle_empty_seats(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tdc_submit_card(p_match_id uuid, p_side text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me     uuid;
	v_match  public.tbl_matches%rowtype;
	v_state  text;
	v_frames integer;
	v_team   boolean;
	v_side   text;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'Only the players in this match, venue staff, or the people running its competition can submit its scorecard.';
	end if;

	-- In a team match a captain signs for their own side, and signing is
	-- captain-only: a player may record their own frame but not put the
	-- team's name to the night. The league director may sign for either, and
	-- has to say which.
	v_team := v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team';
	if v_team then
		v_side := coalesce(p_side, private.tdc_league_match_side(p_match_id));
		if v_side is null then
			raise exception 'Only a captain signs a team card. Say which side if you are running the league.';
		end if;
		if v_side not in ('home', 'away') then
			raise exception 'TDC (Error): side must be home or away, not "%".', v_side;
		end if;
		if not private.tdc_can_set_lineup(p_match_id, v_side) then
			raise exception 'Only that team''s captain, or the league director, can sign its card.';
		end if;
	elsif p_side is not null then
		raise exception 'TDC (Error): only a team match has sides to submit for.';
	end if;

	-- The event records who pressed it, so a coordinator submitting on behalf
	-- of two walk-ins is attributed to the coordinator rather than to nobody.
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	select count(*) into v_frames from public.tbl_frames where match_id = p_match_id;
	if v_frames = 0 then
		raise exception 'There is nothing to submit yet — no frames have been played.';
	end if;

	v_state := private.tdc_card_state(p_match_id)->>'state';
	-- 'awaiting' on a team card means the other side has signed and this one
	-- has not, which is exactly when this side needs to sign. Only a signature
	-- already standing against this very card is refused.
	if v_state = 'awaiting' and not v_team then
		raise exception 'This scorecard has already been submitted and is waiting on the other player.';
	end if;
	if v_team and exists (
		select 1 from public.tbl_match_events
		where match_id = p_match_id and kind = 'submitted' and side = v_side
			and card_version = v_match.card_version
	) then
		raise exception 'You have already signed this card as it stands.';
	end if;
	if v_state = 'agreed' then
		raise exception 'This scorecard has already been agreed.';
	end if;
	if v_state = 'approved' then
		raise exception 'This result has already been published.';
	end if;

	-- Signing says this is the final card, so a seat still empty is now a
	-- walkover. Before the signature, so the version signed includes them.
	if v_team and private.tdc_settle_empty_seats(p_match_id) > 0 then
		select card_version into v_match.card_version from public.tbl_matches where id = p_match_id;
	end if;

	insert into public.tbl_match_events (match_id, player_id, kind, card_version, side)
	values (p_match_id, v_me, 'submitted', v_match.card_version, v_side);

	-- Nobody has to sign this one. Submitting is the end of it. Never on a
	-- team card, which wants both captains however the approval mode is set.
	if not v_team and coalesce(v_match.rules->>'approval_mode', 'none') = 'none' then
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'agreed', v_match.card_version,
			'Settled on submission: this match was set to need no approval.');
	end if;

	-- A team match is over when both captains have signed, not when the first
	-- one does. Marking it complete on one signature would close a night the
	-- other side has not seen.
	if not v_team or private.tdc_card_state(p_match_id)->>'state' = 'agreed' then
		update public.tbl_matches
		set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
			ended_at = coalesce(ended_at, now())
		where id = p_match_id;
	end if;

	return private.tdc_card_state(p_match_id);
end;
$function$;


-- ─── Reserves, under the three rules ───

CREATE OR REPLACE FUNCTION public.tdc_swap_frame_player(p_frame_id uuid, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_f    public.tbl_frames%rowtype;
	v_side text;
	v_m    public.tbl_matches%rowtype;
	v_ls   uuid;
	v_team uuid;
	v_n        integer;
	v_session  integer;
	v_position integer;
	v_regular  uuid;
	v_in_order integer;
	v_opponent uuid;
	v_name     text;
begin
	select * into v_f from public.tbl_frames where id = p_frame_id;
	if v_f.id is null then
		raise exception 'TDC (Error): frame % not found.', p_frame_id;
	end if;

	v_m  := private.tdc_lineup_match(v_f.match_id);
	v_ls := private.tdc_league_season_of_match(v_f.match_id);

	if v_f.status = 'complete' or v_f.status = 'abandoned' then
		raise exception 'That frame is already settled. Changing who played it is a correction, not a reserve.';
	end if;

	-- Which side the new player is on decides which seat they take, so a
	-- captain cannot put their own player into the opposition's. Confirmation
	-- is not asked for: it stopped gating anything on 23 Oct (20261023120000).
	select team_id into v_team
	from public.tbl_league_season_entrants
	where league_season_id = v_ls and player_id = p_player_id
		and status = 'active';

	v_side := case v_team when v_m.home_team_id then 'home' when v_m.away_team_id then 'away' end;
	if v_side is null then
		raise exception 'That player is not on either of the teams playing this match.';
	end if;

	if not private.tdc_can_set_lineup(v_f.match_id, v_side) then
		raise exception 'Only that team''s captain, or the league director, can put a reserve in.';
	end if;

	if exists (select 1 from public.tbl_frame_participants
		where frame_id = p_frame_id and player_id = p_player_id) then
		return;
	end if;

	-- The three rules (UV, 23–24 Oct), for a night played in sessions.
	v_n := private.tdc_team_size(v_m.rules);
	if v_n > 0 and v_f.lineup_slot is not null then
		v_session  := private.tdc_frame_session(v_m.rules, v_f.lineup_slot);
		v_position := private.tdc_frame_position(v_m.rules, v_f.lineup_slot, v_side);

		select player_id into v_regular from public.tbl_league_match_order
		where match_id = v_f.match_id and side = v_side and lineup_slot = v_position;

		select p.display_name into v_name from public.tbl_players p where p.id = p_player_id;

		-- Putting a position's own player back undoes a reserve, which every
		-- rule already allows: it is where the order put them.
		if p_player_id is distinct from v_regular then
			-- Rule 2: a player in the order keeps their position.
			select lineup_slot into v_in_order from public.tbl_league_match_order
			where match_id = v_f.match_id and side = v_side and player_id = p_player_id;
			if v_in_order is not null then
				raise exception '% plays position % tonight. A player in the lineup keeps their position; only a reserve can come in.',
					v_name, v_in_order;
			end if;

			-- Rule 1: one frame per session.
			if exists (
				select 1 from public.tbl_frames f2
				join public.tbl_frame_participants fp on fp.frame_id = f2.id
				where f2.match_id = v_f.match_id and f2.id <> v_f.id
					and fp.player_id = p_player_id
					and private.tdc_frame_session(v_m.rules, f2.lineup_slot) = v_session
			) then
				raise exception '% already plays a frame in session %. A player plays one frame a session.', v_name, v_session;
			end if;

			-- Rule 3: a reserve never meets the same opponent twice.
			select fp.player_id into v_opponent from public.tbl_frame_participants fp
			where fp.frame_id = p_frame_id and fp.side <> v_side;
			if v_opponent is not null and exists (
				select 1 from public.tbl_frames f2
				join public.tbl_frame_participants a on a.frame_id = f2.id and a.player_id = p_player_id
				join public.tbl_frame_participants b on b.frame_id = f2.id and b.player_id = v_opponent
				where f2.match_id = v_f.match_id and f2.id <> v_f.id
			) then
				raise exception '% has already played % tonight. A reserve may not face the same opponent twice.',
					v_name, (select p.display_name from public.tbl_players p where p.id = v_opponent);
			end if;
		end if;
	end if;

	delete from public.tbl_frame_participants where frame_id = p_frame_id and side = v_side;
	insert into public.tbl_frame_participants (frame_id, side, player_id)
	values (p_frame_id, v_side, p_player_id);

	-- A reserve is available by definition, so the squad is caught up rather
	-- than made to disagree with the card.
	insert into public.tbl_league_match_squad (added_by, match_id, side, player_id)
	values ((select auth.uid()), v_f.match_id, v_side, p_player_id)
	on conflict (match_id, player_id) do nothing;

	update public.tbl_matches set card_version = card_version + 1 where id = v_f.match_id;
end;
$function$;


-- ─── The card says where each frame sits ───
-- Gains the session, both positions and both player ids, so the page can
-- group frames by session and offer a reserve without working out the
-- rotation a second time.

drop function public.tdc_match_card(uuid);

CREATE FUNCTION public.tdc_match_card(p_match_id uuid)
 RETURNS TABLE(frame_id uuid, frame_no integer, lineup_slot integer, status text, home_player text, away_player text, break_side text, winner_side text, result_event text, session integer, home_position integer, away_position integer, home_player_id uuid, away_player_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select f.id, f.frame_no, f.lineup_slot, f.status,
		(select p.display_name from public.tbl_frame_participants fp
			join public.tbl_players p on p.id = fp.player_id
			where fp.frame_id = f.id and fp.side = 'home' limit 1),
		(select p.display_name from public.tbl_frame_participants fp
			join public.tbl_players p on p.id = fp.player_id
			where fp.frame_id = f.id and fp.side = 'away' limit 1),
		f.break_side, f.winner_side, f.result_event,
		private.tdc_frame_session(m.rules, f.lineup_slot),
		private.tdc_frame_position(m.rules, f.lineup_slot, 'home'),
		private.tdc_frame_position(m.rules, f.lineup_slot, 'away'),
		(select fp.player_id from public.tbl_frame_participants fp
			where fp.frame_id = f.id and fp.side = 'home' limit 1),
		(select fp.player_id from public.tbl_frame_participants fp
			where fp.frame_id = f.id and fp.side = 'away' limit 1)
	from public.tbl_frames f
	join public.tbl_matches m on m.id = f.match_id
	where (select auth.uid()) is not null and f.match_id = p_match_id
	order by f.frame_no;
$function$;

revoke execute on function public.tdc_match_card(uuid) from public, anon;
grant  execute on function public.tdc_match_card(uuid) to authenticated;
