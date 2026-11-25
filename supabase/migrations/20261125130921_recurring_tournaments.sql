-- Recurring tournaments (UV, 25 Nov; docs/systems/tournaments.md, "Recurring
-- tournaments"; DECISIONS 25 Nov).
--
-- A tournament can be marked recurring. Its director then makes the next one
-- from it (Manage › Next tournament): every setting carried, nobody entered.
-- Every tournament of one series shares a series id, so anything later that
-- considers all of a tournament's nights (a series table, points across them)
-- reads `where series_id = …`. No parent table: the id is the series, as
-- team_lineage_id is a team's across seasons, and it can become a foreign key
-- to a series row later without moving any data.
--
-- 1. tbl_tournaments.is_recurring and series_id
-- 2. tdc_set_tournament_recurring: the switch
-- 3. tdc_next_tournament: the next one, copied
-- 4. tdc_tournament_history: the series' other tournaments and who won them
--
-- Nothing here references tbl_players, so tdc_merge_players is unchanged.


-- ─────────────────────────────────────────────────────────────────
-- 1. The columns
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_tournaments
	add column is_recurring boolean not null default false,
	add column series_id uuid;

comment on column public.tbl_tournaments.is_recurring is
	'Recurring: its director may make the next one from it (tdc_next_tournament). Set by tdc_set_tournament_recurring.';
comment on column public.tbl_tournaments.series_id is
	'The series this tournament is one night of: shared by every tournament made from it. The first tournament''s own id. Kept when Recurring is turned off, so the history stays linked. No foreign key: there is no series row (yet).';

create index tbl_tournaments_series_id_idx on public.tbl_tournaments (series_id) where series_id is not null;


-- ─────────────────────────────────────────────────────────────────
-- 2. The switch
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_set_tournament_recurring(p_tournament_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can make it recurring.';
	end if;
	if p_on is null then
		raise exception 'TDC (Error): say whether the tournament is recurring.';
	end if;

	-- Turning it on starts a series with this tournament, unless it is already
	-- one night of a series; turning it off leaves the series id alone.
	update public.tbl_tournaments
	set is_recurring = p_on,
		series_id = case when p_on then coalesce(series_id, id) else series_id end
	where id = p_tournament_id;
end;
$$;

revoke execute on function public.tdc_set_tournament_recurring(uuid, boolean) from public, anon;
grant execute on function public.tdc_set_tournament_recurring(uuid, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 3. The next tournament
-- ─────────────────────────────────────────────────────────────────
-- Carried: the settings on the row (name unless a new one is given, format,
-- rules, maximum, fee, entries, paid also confirms, progression, match
-- creation, third place, visible to public, the venue it belongs to), each
-- round's own rules, where it is played, everybody who runs it, and the poster
-- with its choices and whether it is shared.
-- Not carried (UV, 25 Nov): entrants and the draw (the point), the start
-- (given), the director's notes, the short link (each is unique), the status
-- (worked out again), and `sanctioned` (Claude's: a sanction is granted to one
-- event by somebody else, never by its director). The picture is copied by the
-- page as a new file in the new tournament's folder (the check constraint
-- tbl_tournaments_picture_path_is_own), then set with tdc_set_tournament_picture.

create function public.tdc_next_tournament(
	p_from_id   uuid,
	p_starts_at timestamptz default null,
	p_name      text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me   uuid;
	v_from public.tbl_tournaments;
	v_id   uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	select * into v_from from public.tbl_tournaments where id = p_from_id;
	if not found then
		raise exception 'TDC (Error): no such tournament.';
	end if;
	if not private.tdc_can_run_tournament(p_from_id) then
		raise exception 'Only the people running this tournament can make the next one.';
	end if;
	if not v_from.is_recurring then
		raise exception 'This tournament is not recurring. Turn on Recurring in its Details first.';
	end if;
	-- As tdc_create_tournament: a tournament is tied to a venue only by its
	-- owner or admin (17 Nov), so staff who run this one cannot make another there.
	if v_from.venue_id is not null
		and not private.tdc_has_venue_role(v_from.venue_id, array['owner', 'admin']) then
		raise exception 'Only an owner or admin of that venue can make its next tournament.';
	end if;

	insert into public.tbl_tournaments
		(created_by, venue_id, name, format, rules, starts_at, max_entrants, entry_fee_credits,
		 entry_mode, paid_confirms, progression, create_matches, third_place, is_listed,
		 is_recurring, series_id)
	values
		((select auth.uid()), v_from.venue_id,
		 coalesce(nullif(trim(p_name), ''), v_from.name),
		 v_from.format, v_from.rules, p_starts_at, v_from.max_entrants, v_from.entry_fee_credits,
		 v_from.entry_mode, v_from.paid_confirms, v_from.progression, v_from.create_matches,
		 v_from.third_place, v_from.is_listed,
		 true, coalesce(v_from.series_id, v_from.id))
	returning id into v_id;

	-- Each round's own rules. A round with no fixture yet is still a round
	-- number, so they apply as soon as the draw has that round.
	insert into public.tbl_tournament_round_rules (tournament_id, bracket, round, rules, created_by)
	select v_id, r.bracket, r.round, r.rules, (select auth.uid())
	from public.tbl_tournament_round_rules r
	where r.tournament_id = p_from_id;

	-- Where it is played: the venues the last one already listed, so nobody
	-- is choosing a venue here (tdc_check_venue_list asks only of new ones).
	insert into public.tbl_tournament_venues (tournament_id, venue_id, position, created_by)
	select v_id, v.venue_id, v.position, (select auth.uid())
	from public.tbl_tournament_venues v
	where v.tournament_id = p_from_id;

	-- Everybody who runs it (UV), and whoever made this one a director too, or
	-- they could not run what they just made.
	insert into public.tbl_competition_roles (created_by, tournament_id, player_id, role)
	select (select auth.uid()), v_id, r.player_id, r.role
	from public.tbl_competition_roles r
	where r.tournament_id = p_from_id;

	insert into public.tbl_competition_roles (created_by, tournament_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director')
	on conflict on constraint tbl_competition_roles_one_each do nothing;

	-- The poster, with its choices and sharing. After the roles: publishing asks
	-- whether the caller runs it. Visible to public shares one regardless, as on
	-- create (tdc_create_tournament).
	if exists (select 1 from public.tbl_tournament_posters where tournament_id = p_from_id) then
		perform public.tdc_publish_poster(v_id, p.include_entrants, p.include_draw, p.is_public or v_from.is_listed)
		from public.tbl_tournament_posters p
		where p.tournament_id = p_from_id;
	elsif v_from.is_listed then
		perform public.tdc_publish_poster(v_id, false, false, true);
	end if;

	return v_id;
end;
$$;

revoke execute on function public.tdc_next_tournament(uuid, timestamptz, text) from public, anon;
grant execute on function public.tdc_next_tournament(uuid, timestamptz, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 4. The history
-- ─────────────────────────────────────────────────────────────────
-- Every other tournament of the series, newest first (by its start, else when
-- it was made), with its status, how many entered (withdrawn left out), and
-- the winner and runner-up once the final is decided: the final's outcome
-- through private.tdc_fixture_outcome, counted from its frames as the draw
-- counts it, never stored. Readable by anybody signed in, as the draw is.

create function public.tdc_tournament_history(p_tournament_id uuid)
returns table (
	tournament_id      uuid,
	name               text,
	starts_at          timestamptz,
	status             text,
	entrants           integer,
	winner_player_id   uuid,
	winner_name        text,
	winner_avatar      text,
	runner_up_player_id uuid,
	runner_up_name     text,
	runner_up_avatar   text,
	-- As tdc_my_tournaments has it: a poster exists and is shared, or exists
	-- and this account runs it. A card for one not started opens the poster
	-- when this is true (UV, 5 Nov), the draw otherwise.
	poster_open        boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select series_id from public.tbl_tournaments where id = p_tournament_id
	),
	nights as (
		select t.*
		from public.tbl_tournaments t, me
		where me.series_id is not null
			and t.series_id = me.series_id
			and t.id <> p_tournament_id
	),
	finals as (
		select distinct on (f.tournament_id) f.tournament_id, f.id as fixture_id
		from public.tbl_tournament_fixtures f
		join nights n on n.id = f.tournament_id
		where f.bracket = 'main'
		order by f.tournament_id, f.round desc, f.position
	),
	outcomes as (
		select fi.tournament_id, o.winner_entrant_id, o.loser_entrant_id
		from finals fi
		cross join lateral private.tdc_fixture_outcome(fi.fixture_id) o
		where o.decided
	)
	select
		n.id,
		n.name,
		n.starts_at,
		private.tdc_tournament_status(n.id),
		(select count(*)::integer from public.tbl_tournament_entrants e
			where e.tournament_id = n.id and e.status <> 'withdrawn'),
		pw.id, pw.display_name, pw.avatar_path,
		pl.id, pl.display_name, pl.avatar_path,
		exists (select 1 from public.tbl_tournament_posters p
			where p.tournament_id = n.id
				and (p.is_public or private.tdc_can_run_tournament(n.id)))
	from nights n
	left join outcomes o on o.tournament_id = n.id
	left join public.tbl_tournament_entrants ew on ew.id = o.winner_entrant_id
	left join public.tbl_players pw on pw.id = ew.player_id
	left join public.tbl_tournament_entrants el on el.id = o.loser_entrant_id
	left join public.tbl_players pl on pl.id = el.player_id
	order by coalesce(n.starts_at, n.created_at) desc, n.created_at desc;
$$;

revoke execute on function public.tdc_tournament_history(uuid) from public, anon;
grant execute on function public.tdc_tournament_history(uuid) to authenticated;
