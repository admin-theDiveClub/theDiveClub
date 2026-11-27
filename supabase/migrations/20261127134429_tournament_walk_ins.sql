-- Tournament walk-ins from Entrants, and connecting them to an account
-- (UV, 27 Nov; docs/DECISIONS.md, 27 Nov, "Tournament entrants as
-- placeholders, not walk-ins with an email"; docs/systems/tournaments.md,
-- "Walk-ins from Entrants, and connecting them").
--
-- Basil and Rick run a night from a WhatsApp list they paste into Challonge.
-- The site does the same: whoever runs a tournament pastes the names, and
-- each becomes a walk-in (a name and nothing else) entered and confirmed.
-- UV: "we are just updating the existing functionality" — a placeholder is a
-- walk-in. No email is asked for, so nothing tells a director who is
-- registered.
--
-- A walk-in is connected to an account only when the director asks and the
-- account's owner accepts. Accepting runs private.tdc_merge_players, exactly
-- as Staff › Link does: every frame, match and entry moves to the account,
-- mid-tournament too (UV: "even during play").
--
--   tdc_add_walk_in_entrants(tournament, names[])   the pasted list
--   tbl_player_connect_requests                      one waiting ask per walk-in
--   tdc_ask_to_connect(tournament, walk-in, account) the director asks; the account is told
--   tdc_cancel_connect(request)                      the director takes it back
--   tdc_tournament_connect_requests(tournament)      what is waiting, for Entrants
--   tdc_my_connect_requests()                        what is waiting for me, for the profile
--   tdc_answer_connect(request, accept)              the account's owner answers
--
-- Claude's, for UV to correct: a director may not ask to connect a walk-in to
-- their own account (Staff › Link refuses the same, or anyone running a
-- tournament could take a walk-in's history); accepting moves all of the
-- walk-in's history, not only this tournament's; the director is told of a
-- decline as of an accept.
--
-- tbl_player_connect_requests references tbl_players twice, so
-- tdc_merge_players gains it (patched from the definition a fresh reset gave,
-- not retyped). The foreign-key query in 20261014170000 lists 36 references
-- after this migration, every one handled.


-- ─── 1. The pasted list ───

create function public.tdc_add_walk_in_entrants(p_tournament_id uuid, p_names text[])
returns table (name text, player_id uuid, skipped text)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t     public.tbl_tournaments%rowtype;
	v_name  text;
	v_seen  text[] := '{}';
	v_count integer;
	v_id    uuid;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can add entrants.';
	end if;

	if p_names is null or coalesce(array_length(p_names, 1), 0) = 0 then
		raise exception 'Please enter at least one name.';
	end if;
	if array_length(p_names, 1) > 256 then
		raise exception 'That is more than 256 names. Add them in smaller lists.';
	end if;

	foreach v_name in array p_names loop
		-- A pasted list carries numbering and stray spaces: "1. Jo  Smith" is Jo Smith.
		v_name := regexp_replace(trim(coalesce(v_name, '')), '^\d+[.)]\s*', '');
		v_name := regexp_replace(trim(v_name), '\s+', ' ', 'g');
		continue when v_name = '';

		-- The same name twice in one list is one person.
		continue when lower(v_name) = any (v_seen);
		v_seen := v_seen || lower(v_name);

		name := v_name;
		player_id := null;
		skipped := null;

		if char_length(v_name) > 100 then
			skipped := 'longer than 100 characters';
		elsif exists (
			select 1 from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = p_tournament_id and lower(p.display_name) = lower(v_name)
		) then
			skipped := 'already entered';
		else
			-- Withdrawn entrants do not take up a place (as tdc_add_entrant).
			select count(*) into v_count
			from public.tbl_tournament_entrants
			where tournament_id = p_tournament_id and status <> 'withdrawn';

			if v_t.max_entrants is not null and v_count >= v_t.max_entrants then
				skipped := 'the tournament is full';
			end if;
		end if;

		if skipped is null then
			insert into public.tbl_players (display_name, player_type, created_by)
			values (v_name, 'walk_in', (select auth.uid()))
			returning id into v_id;

			insert into public.tbl_tournament_entrants (added_by, tournament_id, player_id, status)
			values ((select auth.uid()), p_tournament_id, v_id, 'confirmed');

			-- No notification: a walk-in has no account to tell (private.tdc_notify).
			player_id := v_id;
		end if;

		return next;
	end loop;
end;
$$;
revoke execute on function public.tdc_add_walk_in_entrants(uuid, text[]) from public, anon;
grant execute on function public.tdc_add_walk_in_entrants(uuid, text[]) to authenticated;
comment on function public.tdc_add_walk_in_entrants(uuid, text[]) is
	'A pasted list of names, each made a walk-in and entered confirmed. One row back per name, with player_id, or why it was skipped (already entered, full, too long). Whoever runs the tournament.';


-- ─── 2. The requests ───

create table public.tbl_player_connect_requests (
	id                uuid primary key default gen_random_uuid(),
	created_at        timestamptz not null default now(),
	tournament_id     uuid not null references public.tbl_tournaments (id) on delete cascade,
	walk_in_player_id uuid not null references public.tbl_players (id) on delete cascade,
	account_player_id uuid not null references public.tbl_players (id) on delete cascade,
	asked_by          uuid references auth.users (id) on delete set null,
	-- One waiting ask per walk-in: asking again replaces it.
	constraint tbl_player_connect_requests_once unique (walk_in_player_id),
	constraint tbl_player_connect_requests_two check (walk_in_player_id <> account_player_id)
);
create index tbl_player_connect_requests_account_idx on public.tbl_player_connect_requests (account_player_id);
create index tbl_player_connect_requests_tournament_idx on public.tbl_player_connect_requests (tournament_id);

comment on table public.tbl_player_connect_requests is
	'A director asking whether a walk-in is an account''s player. A row exists only while waiting: accepting (the merge), declining and cancelling all delete it. Read and written only through the tdc_ connect functions.';

-- Read only through the functions: no policy, no grant.
alter table public.tbl_player_connect_requests enable row level security;
revoke all on public.tbl_player_connect_requests from public, anon, authenticated;
grant select, insert, update, delete on public.tbl_player_connect_requests to service_role;


-- ─── 3. Asking ───

create function public.tdc_ask_to_connect(
	p_tournament_id     uuid,
	p_walk_in_player_id uuid,
	p_account_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t       public.tbl_tournaments%rowtype;
	v_walk_in public.tbl_players%rowtype;
	v_account public.tbl_players%rowtype;
	v_id      uuid;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can connect its walk-ins.';
	end if;

	select * into v_walk_in from public.tbl_players where id = p_walk_in_player_id;
	if v_walk_in.id is null
		or not exists (select 1 from public.tbl_tournament_entrants
			where tournament_id = p_tournament_id and player_id = p_walk_in_player_id) then
		raise exception 'TDC (Error): that player is not an entrant of this tournament.';
	end if;
	if v_walk_in.user_id is not null or v_walk_in.player_type not in ('walk_in', 'guest') then
		raise exception '% already has an account.', v_walk_in.display_name;
	end if;

	select * into v_account from public.tbl_players where id = p_account_player_id;
	if v_account.id is null then
		raise exception 'TDC (Error): no player with id %.', p_account_player_id;
	end if;
	if v_account.user_id is null then
		raise exception '% has no account. Choose a player who has signed up.', v_account.display_name;
	end if;
	if v_account.user_id = (select auth.uid()) then
		raise exception 'You can''t connect a walk-in to your own account. Ask another director.';
	end if;

	-- The merge would fail on the entrant list's one-row-per-player rule.
	if exists (select 1 from public.tbl_tournament_entrants
		where tournament_id = p_tournament_id and player_id = p_account_player_id) then
		raise exception '% is already entered in this tournament. Remove one of the two first.', v_account.display_name;
	end if;

	insert into public.tbl_player_connect_requests (tournament_id, walk_in_player_id, account_player_id, asked_by)
	values (p_tournament_id, p_walk_in_player_id, p_account_player_id, (select auth.uid()))
	on conflict (walk_in_player_id) do update
		set tournament_id     = excluded.tournament_id,
			account_player_id = excluded.account_player_id,
			asked_by          = excluded.asked_by,
			created_at        = now()
	returning id into v_id;

	perform private.tdc_notify(
		p_account_player_id, 'tournament', 'connect_ask',
		left('Were you "' || v_walk_in.display_name || '" in ' || v_t.name || '?', 120),
		'Whoever is running it asks whether this is you. Accept, and its results join your record.',
		'/accounts/profile/#connect',
		null, p_tournament_id, private.tdc_me());

	return v_id;
end;
$$;
revoke execute on function public.tdc_ask_to_connect(uuid, uuid, uuid) from public, anon;
grant execute on function public.tdc_ask_to_connect(uuid, uuid, uuid) to authenticated;


-- ─── 4. Taking it back ───

create function public.tdc_cancel_connect(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tournament uuid;
begin
	select tournament_id into v_tournament
	from public.tbl_player_connect_requests where id = p_request_id;

	-- Answered or cancelled meanwhile: nothing left to take back.
	if v_tournament is null then
		return;
	end if;

	if not private.tdc_can_run_tournament(v_tournament) then
		raise exception 'Only the people running this tournament can cancel its requests.';
	end if;

	delete from public.tbl_player_connect_requests where id = p_request_id;
end;
$$;
revoke execute on function public.tdc_cancel_connect(uuid) from public, anon;
grant execute on function public.tdc_cancel_connect(uuid) to authenticated;


-- ─── 5. What is waiting ───

-- For Entrants: each walk-in's waiting ask, and whom it asks.
create function public.tdc_tournament_connect_requests(p_tournament_id uuid)
returns table (id uuid, created_at timestamptz, walk_in_player_id uuid, account_player_id uuid, account_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can see its requests.';
	end if;

	return query
	select r.id, r.created_at, r.walk_in_player_id, r.account_player_id, a.display_name
	from public.tbl_player_connect_requests r
	join public.tbl_players a on a.id = r.account_player_id
	where r.tournament_id = p_tournament_id
	order by r.created_at;
end;
$$;
revoke execute on function public.tdc_tournament_connect_requests(uuid) from public, anon;
grant execute on function public.tdc_tournament_connect_requests(uuid) to authenticated;

-- For the profile: what is waiting for me.
create function public.tdc_my_connect_requests()
returns table (id uuid, created_at timestamptz, tournament_id uuid, tournament_name text,
	walk_in_player_id uuid, walk_in_name text, asked_by_name text)
language sql
stable
security definer
set search_path = ''
as $$
	select r.id, r.created_at, r.tournament_id, t.name, r.walk_in_player_id, w.display_name, d.display_name
	from public.tbl_player_connect_requests r
	join public.tbl_players a on a.id = r.account_player_id
	join public.tbl_players w on w.id = r.walk_in_player_id
	join public.tbl_tournaments t on t.id = r.tournament_id
	left join public.tbl_players d on d.user_id = r.asked_by
	where a.user_id = (select auth.uid())
	order by r.created_at;
$$;
revoke execute on function public.tdc_my_connect_requests() from public, anon;
grant execute on function public.tdc_my_connect_requests() to authenticated;


-- ─── 6. Answering ───

create function public.tdc_answer_connect(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_r        public.tbl_player_connect_requests%rowtype;
	v_walk_in  text;
	v_account  text;
	v_t        text;
	v_asker    uuid;
	v_keep     uuid;
begin
	select r.* into v_r
	from public.tbl_player_connect_requests r
	join public.tbl_players a on a.id = r.account_player_id
	where r.id = p_request_id and a.user_id = (select auth.uid());

	if v_r.id is null then
		raise exception 'That request is no longer waiting for you.';
	end if;
	if p_accept is null then
		raise exception 'TDC (Error): accept or decline.';
	end if;

	select display_name into v_walk_in from public.tbl_players where id = v_r.walk_in_player_id;
	select display_name into v_account from public.tbl_players where id = v_r.account_player_id;
	select name into v_t from public.tbl_tournaments where id = v_r.tournament_id;
	select id into v_asker from public.tbl_players where user_id = v_r.asked_by;

	if not p_accept then
		delete from public.tbl_player_connect_requests where id = p_request_id;
		perform private.tdc_notify(
			v_asker, 'tournament', 'connect_declined',
			left(v_account || ' declined: they are not "' || v_walk_in || '"', 120),
			'They declined to connect the walk-in in ' || v_t || ' to their account. It stays a walk-in.',
			'/tournaments/bracket/?t=' || v_r.tournament_id || '&tab=entrants',
			null, v_r.tournament_id, v_r.account_player_id);
		return null;
	end if;

	-- The walk-in record is kept and the account moves onto it, as Staff › Link
	-- and the email claim do. The merge's own guards (played each other, two SA
	-- IDs, the same league season) give their own messages; the merge deletes
	-- this request.
	begin
		v_keep := private.tdc_merge_players(v_r.walk_in_player_id, v_r.account_player_id, (select auth.uid()));
	exception
		when unique_violation then
			raise exception 'You and "%" are both entered in the same competition. Ask whoever runs it to remove one of the two first.', v_walk_in;
	end;

	perform private.tdc_notify(
		v_asker, 'tournament', 'connect_accepted',
		left(v_account || ' accepted: they are "' || v_walk_in || '"', 120),
		'They accepted: the walk-in in ' || v_t || ' is now their account, with its results.',
		'/tournaments/bracket/?t=' || v_r.tournament_id || '&tab=entrants',
		null, v_r.tournament_id, v_keep);

	return v_keep;
end;
$$;
revoke execute on function public.tdc_answer_connect(uuid, boolean) from public, anon;
grant execute on function public.tdc_answer_connect(uuid, boolean) to authenticated;


-- ─── 7. The merge gains the requests ───
-- Patched from the definition a fresh reset gave (last changed in
-- 20261124170346); the one addition is marked "(20261127134429)".

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

	-- Doubles (20261119124608): two seats of one match, partners or
	-- opponents, before any frame is played. Joined, one player would hold
	-- two seats.
	if exists (
		select 1
		from public.tbl_match_side_players a
		join public.tbl_match_side_players b on b.match_id = a.match_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both in the same match. Please ask an owner or admin to resolve this.';
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

	-- Credit top-ups (20261124112328). Restrict on delete, so without this a claim by an
	-- account that had ever asked for credits would fail on deleting the signup record.
	-- The rows refuse direct edits, so the top-up functions' write switch is needed here.
	perform set_config('tdc.top_up_write', 'on', true);
	update public.tbl_credit_top_ups set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.top_up_write', 'off', true);

	-- The cart (20261124125407). Cascades on delete, so without this a claim would quietly
	-- empty the account's cart. A walk-in has no account and so no cart; if it somehow
	-- has a line for the same product, the account's stands (as the notification settings).
	delete from public.tbl_shop_cart_items k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_shop_cart_items r where r.player_id = p_remove_id and r.product_id = k.product_id);
	update public.tbl_shop_cart_items set player_id = p_keep_id where player_id = p_remove_id;

	-- Shop orders (20261124152509). Restrict on delete, so without this a claim by an account
	-- that had ever ordered would fail on deleting the signup record. The rows refuse direct
	-- edits, so the order functions' write switch is needed here. The ledger rows linked to
	-- them have already moved above.
	perform set_config('tdc.order_write', 'on', true);
	update public.tbl_shop_orders set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.order_write', 'off', true);

	-- Receipt emails (20261124170346). The switches cascade on delete, so without this a claim
	-- would turn every email back on; where both somehow have one for the same email, the
	-- account's stands (as the notification settings). The queue would vanish with the record.
	delete from public.tbl_email_prefs k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_email_prefs r where r.player_id = p_remove_id and r.kind = k.kind);
	update public.tbl_email_prefs set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_shop_emails set player_id = p_keep_id where player_id = p_remove_id;

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
	-- Doubles seats (20261119124608), restrict on delete like the match's own columns.
	update public.tbl_match_side_players set player_id = p_keep_id where player_id = p_remove_id;
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
	-- Doubles (20261119124608): arrays, so no foreign key would catch them.
	update public.tbl_deleted_matches set home_players = array_replace(home_players, p_remove_id, p_keep_id)
		where p_remove_id = any (home_players);
	update public.tbl_deleted_matches set away_players = array_replace(away_players, p_remove_id, p_keep_id)
		where p_remove_id = any (away_players);
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

	-- Connection requests (20261127134429). Both players cascade on delete.
	-- Any ask about either record as a walk-in is over: the walk-in is now an
	-- account (and the ask being answered is one of these). An ask to the
	-- account about some other walk-in moves with the account, as its
	-- notifications do.
	delete from public.tbl_player_connect_requests where walk_in_player_id in (p_keep_id, p_remove_id);
	update public.tbl_player_connect_requests set account_player_id = p_keep_id where account_player_id = p_remove_id;

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
$function$;
