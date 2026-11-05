-- A player asking to join a team, and its captain taking them or turning
-- them down.
--
-- UV, 5 Nov: on the join page each team gets a ring (an icon and a ring)
-- with which a player already in the league and on no team asks to join it;
-- the team's captains see the requests on the season page's Players tab and
-- take the player onto their team, or decline. Settled with him the same day:
--
--   • A captain sees only requests to their own team; the league director
--     sees every team's (private.tdc_can_control_team, the one place that
--     question is answered, says both).
--   • A player may ask several teams while on none. Being on a team already
--     blocks being taken by another (tdc_team_claim_player refuses until
--     their captain releases them, UV), so the moment one team takes them
--     every request they made in that season goes.
--   • The team's captains are told of a request; the player is told when a
--     team they asked takes them. Nothing on a decline.
--   • A captain may decline: the request goes, and the player may ask again.
--
-- Taking a player is the existing tdc_team_claim_player, untouched: the team
-- limit, the active check and who may claim all stay where they are. The
-- requests are cleared, and the player told, by a trigger on the entrant's
-- team, so every way onto a team (a captain's claim, the director's manage
-- page) clears them the same.
--
-- A new table referencing tbl_players, so private.tdc_merge_players carries
-- it (CLAUDE.md, idea 9). Patched from its latest definition
-- (20261024162559, copied whole, diffed: one block added before the signup
-- record is deleted).


-- ─── The requests ───
create table public.tbl_team_join_requests (
	id         uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	team_id    uuid not null references public.tbl_teams (id) on delete cascade,
	player_id  uuid not null references public.tbl_players (id) on delete cascade,
	constraint tbl_team_join_requests_once unique (team_id, player_id)
);

create index tbl_team_join_requests_player_idx on public.tbl_team_join_requests (player_id);

comment on table public.tbl_team_join_requests is
	'A league player asking to join a team (UV, 5 Nov). Written only through tdc_request_team; gone once the player is on any team in that season, or the request is taken back or declined.';

-- Read and written only through the functions below.
alter table public.tbl_team_join_requests enable row level security;
revoke all on public.tbl_team_join_requests from anon, authenticated;


-- ─── Asking ───
-- Only a player active in the team's league and on no team in it. A full
-- team is refused here, said before the captain would be refused taking
-- them. Asking twice is no error.
create function public.tdc_request_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me     uuid := private.tdc_me();
	v_t      public.tbl_teams%rowtype;
	v_e      public.tbl_league_season_entrants%rowtype;
	v_on     text;
	v_name   text;
	v_label  text;
	v_cap    uuid;
	v_active integer;
	v_limit  integer;
begin
	if v_me is null then
		raise exception 'Sign in to ask to join a team.';
	end if;

	select * into v_t from public.tbl_teams where id = p_team_id;
	if v_t.id is null then
		raise exception 'TDC (Error): team % not found.', p_team_id;
	end if;

	select * into v_e from public.tbl_league_season_entrants
	where league_season_id = v_t.league_season_id and player_id = v_me;

	if v_e.id is null or v_e.status <> 'active' then
		raise exception 'Only a player in this league can ask to join one of its teams.';
	end if;
	if v_e.team_id is not null then
		if v_e.team_id = p_team_id then
			raise exception 'You are already on %.', v_t.name;
		end if;
		select name into v_on from public.tbl_teams where id = v_e.team_id;
		raise exception 'You are already on %. Your captain has to release you before another team can take you.', v_on;
	end if;

	v_active := private.tdc_team_active_players(p_team_id);
	v_limit  := private.tdc_team_limit(p_team_id);
	if v_active >= v_limit then
		raise exception '% is full: % of % places taken.', v_t.name, v_active, v_limit;
	end if;

	insert into public.tbl_team_join_requests (team_id, player_id)
	values (p_team_id, v_me)
	on conflict on constraint tbl_team_join_requests_once do nothing;
	if not found then
		return;   -- asked already: nobody is told twice
	end if;

	-- The team's captains are told (UV), linked to the Players tab.
	select display_name into v_name from public.tbl_players where id = v_me;
	select l.name || ' - ' || s.name into v_label
	from public.tbl_league_seasons s join public.tbl_leagues l on l.id = s.league_id
	where s.id = v_t.league_season_id;

	for v_cap in
		select player_id from public.tbl_league_season_entrants
		where team_id = p_team_id and is_captain and status = 'active'
	loop
		perform private.tdc_notify(
			v_cap, 'league', 'team_join_request',
			v_name || ' asked to join ' || v_t.name,
			v_label,
			'/leagues/season/?s=' || v_t.league_season_id::text || '&view=players',
			null, null, v_me);
	end loop;
end;
$$;

revoke execute on function public.tdc_request_team(uuid) from public, anon;
grant execute on function public.tdc_request_team(uuid) to authenticated;


-- ─── Taking it back ───
create function public.tdc_cancel_team_request(p_team_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
	delete from public.tbl_team_join_requests
	where team_id = p_team_id and player_id = private.tdc_me();
$$;

revoke execute on function public.tdc_cancel_team_request(uuid) from public, anon;
grant execute on function public.tdc_cancel_team_request(uuid) to authenticated;


-- ─── Declining ───
-- Whoever may control the team: its captain or the league director.
create function public.tdc_decline_team_request(p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_control_team(p_team_id) then
		raise exception 'Only a captain of this team or the league director can turn a request down.';
	end if;
	delete from public.tbl_team_join_requests
	where team_id = p_team_id and player_id = p_player_id;
end;
$$;

revoke execute on function public.tdc_decline_team_request(uuid, uuid) from public, anon;
grant execute on function public.tdc_decline_team_request(uuid, uuid) to authenticated;


-- ─── Reading ───
-- A season's requests, as far as the caller may see them: their own (the
-- join page's rings), and those to every team they may control (a captain's
-- own team; the director every team). Only players still active and on no
-- team, so a request the trigger below has not had to clear (the player
-- withdrawn since, say) never shows.
create function public.tdc_team_join_requests(p_league_season_id uuid)
returns table (
	team_id      uuid,
	team_name    text,
	player_id    uuid,
	display_name text,
	avatar_path  text,
	created_at   timestamptz,
	is_mine      boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	select r.team_id, t.name, r.player_id, p.display_name, p.avatar_path, r.created_at,
		r.player_id = private.tdc_me()
	from public.tbl_team_join_requests r
	join public.tbl_teams t on t.id = r.team_id
	join public.tbl_players p on p.id = r.player_id
	join public.tbl_league_season_entrants e
		on e.league_season_id = t.league_season_id and e.player_id = r.player_id
	where t.league_season_id = p_league_season_id
		and e.status = 'active' and e.team_id is null
		and (r.player_id = private.tdc_me() or private.tdc_can_control_team(r.team_id))
	order by r.created_at;
$$;

revoke execute on function public.tdc_team_join_requests(uuid) from public, anon;
grant execute on function public.tdc_team_join_requests(uuid) to authenticated;


-- ─── Onto a team: the requests go, and the player is told ───
-- On every way onto a team. Told only when a team they asked takes them, and
-- never by themselves (tdc_notify declines that).
create function private.tdc_team_join_requests_on_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name  text;
	v_label text;
begin
	if new.team_id is null then
		return null;
	end if;
	if tg_op = 'UPDATE' then
		if new.team_id is not distinct from old.team_id then
			return null;
		end if;
	end if;

	if exists (select 1 from public.tbl_team_join_requests
		where team_id = new.team_id and player_id = new.player_id) then
		select t.name, l.name || ' - ' || s.name into v_name, v_label
		from public.tbl_teams t
		join public.tbl_league_seasons s on s.id = t.league_season_id
		join public.tbl_leagues l on l.id = s.league_id
		where t.id = new.team_id;

		perform private.tdc_notify(
			new.player_id, 'league', 'team_join_taken',
			'You are on ' || v_name,
			v_label,
			'/leagues/season/?s=' || new.league_season_id::text || '&team=' || new.team_id::text,
			null, null, private.tdc_me());
	end if;

	delete from public.tbl_team_join_requests r
	using public.tbl_teams t
	where t.id = r.team_id
		and t.league_season_id = new.league_season_id
		and r.player_id = new.player_id;

	return null;
end;
$$;

revoke execute on function private.tdc_team_join_requests_on_team() from public, anon, authenticated;

create trigger tbl_league_season_entrants_team_join_requests
	after insert or update of team_id on public.tbl_league_season_entrants
	for each row execute function private.tdc_team_join_requests_on_team();


-- ─── The walk-in merge carries the requests ───
-- A walk-in cannot be a league player, so it cannot have asked; if it
-- somehow has, for a team the account asked too, the account's stands.
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
