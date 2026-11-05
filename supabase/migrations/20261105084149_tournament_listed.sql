-- Open for entry: tournaments a player can find without being sent a link.
--
-- UV, 5 Nov: a test account could not find a tournament UV had made. Nothing
-- was broken — /tournaments/ lists only what an account runs or is entered
-- in, and the one way in was the poster link the director shares. A player
-- new to the site had nothing to join.
--
-- UV's answers, the same day:
--   - "The tournament creator should be able to mark the tournament as
--     visible to public." So a switch, is_listed, off by default: every
--     tournament that already exists stays exactly as findable as it was.
--   - Only signed-in players see the list. Strangers still read nothing but
--     the poster snapshot (20261021140000), so tdc_open_tournaments is not
--     granted to anon.
--   - "Switching Visible on also shares the poster." Entering happens on the
--     poster page, which shows nothing until the poster is shared, so a
--     listed tournament with an unshared poster would be a dead end.
--
-- Claude's, following from the last one (for UV to confirm):
--   - Visible on builds a poster if there is none (names and draw left out,
--     the poster's own defaults) and shares it; one that exists is rebuilt
--     with the choices it already has, and shared.
--   - Stop sharing the poster also turns Visible off, for the same dead-end
--     reason. Visible off leaves the poster alone: a shared link is the
--     director's to take back, separately.
--   - A tournament with nobody in it yet reads Draft (the derived status),
--     so Draft counts as open for entry too — unless the director set it by
--     hand, which is them saying it is not ready.
--
-- No table here refers to tbl_players, so tdc_merge_players is unaffected.


-- ─────────────────────────────────────────────────────────────────
-- The switch
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_tournaments
	add column is_listed boolean not null default false;

comment on column public.tbl_tournaments.is_listed is
	'Visible to public: signed-in players find it under Open for entry on /tournaments/ (tdc_open_tournaments). Turning it on shares the poster; stopping sharing turns it off. Listed only while players may enter, too — see tdc_open_tournaments.';


-- ─────────────────────────────────────────────────────────────────
-- Set at creation
--
-- Replaces the version from 20261021170000. Patched from that original, not
-- retyped. Dropped first because adding a defaulted parameter would leave the
-- twelve-argument version in place and make every existing call ambiguous.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean, text, text, boolean);

create function public.tdc_create_tournament(
	p_name              text,
	p_rules             jsonb,
	p_format            text default 'single_elimination',
	p_venue_id          uuid default null,
	p_starts_at         timestamptz default null,
	p_max_entrants      integer default null,
	p_entry_fee_credits integer default 0,
	p_entry_mode        text default 'td_only',
	p_paid_confirms     boolean default false,
	-- How the draw behaves once it exists. Set here so a TD who already knows
	-- says it once, and changeable afterwards on the draw page — the bracket
	-- used to be the only place to say it, and only before the draw existed.
	p_progression       text default null,
	p_create_matches    text default null,
	p_third_place       boolean default null,
	-- Visible to public. On shares a poster as well, in the same call, so a
	-- tournament is never listed with nothing behind its link.
	p_is_listed         boolean default false
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

	-- Null on any of the three new ones means "leave the column default alone",
	-- so a caller that does not care is unchanged by their existence.
	insert into public.tbl_tournaments
		(created_by, venue_id, name, format, rules, starts_at, max_entrants, entry_fee_credits,
		 entry_mode, paid_confirms, progression, create_matches, third_place, is_listed)
	values
		((select auth.uid()), p_venue_id, trim(p_name), p_format, p_rules,
		 p_starts_at, p_max_entrants, coalesce(p_entry_fee_credits, 0),
		 coalesce(p_entry_mode, 'td_only'), coalesce(p_paid_confirms, false),
		 coalesce(p_progression, 'automatic'),
		 coalesce(p_create_matches, 'automatic'),
		 coalesce(p_third_place, false),
		 coalesce(p_is_listed, false))
	returning id into v_id;

	-- Whoever made it runs it, or nobody does and it cannot be changed.
	insert into public.tbl_competition_roles (created_by, tournament_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director');

	-- After the role, because publishing asks whether the caller runs it.
	if coalesce(p_is_listed, false) then
		perform public.tdc_publish_poster(v_id, false, false, true);
	end if;

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean, text, text, boolean, boolean) from public, anon;
grant execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean, text, text, boolean, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- And changeable afterwards
--
-- Replaces the version from 20261021130000. Patched from that original, not
-- retyped; dropped first for the same reason as above.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean);

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
	p_paid_confirms     boolean     default null,
	p_is_listed         boolean     default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_tournaments%rowtype;
	v_p public.tbl_tournament_posters%rowtype;
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
		paid_confirms     = coalesce(p_paid_confirms, paid_confirms),
		is_listed         = coalesce(p_is_listed, is_listed)
	where id = p_tournament_id;

	-- Visible on shares the poster (UV, 5 Nov). One that exists is rebuilt
	-- with the choices it already has, so the director's names-and-draw
	-- settings stand; with none, the poster's own defaults.
	if p_is_listed then
		select * into v_p from public.tbl_tournament_posters where tournament_id = p_tournament_id;
		perform public.tdc_publish_poster(p_tournament_id,
			coalesce(v_p.include_entrants, false), coalesce(v_p.include_draw, false), true);
	end if;
end;
$$;

revoke execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean, boolean) from public, anon;
grant execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean, boolean) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Stop sharing the poster also takes it off the list
--
-- Replaces the version from 20261021140000. Patched from that original, not
-- retyped. Same signature, so replaced in place.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_unpublish_poster(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change its poster.';
	end if;

	update public.tbl_tournament_posters
	set is_public = false
	where tournament_id = p_tournament_id;

	if not found then
		raise exception 'This tournament has no poster yet.';
	end if;

	-- A listed tournament whose poster nobody can open is a dead end, so it
	-- comes off the list with it.
	update public.tbl_tournaments
	set is_listed = false
	where id = p_tournament_id;
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- The list
--
-- Every tournament a signed-in player could enter right now, and has not:
--   - Visible to public, and its poster shared (the page links to it);
--   - players may put themselves down (not td_only);
--   - taking entries: Open, or Draft not set by hand (Draft is what a
--     tournament with nobody in it yet reads), and no draw made, since
--     self-entry closes when the draw exists (tdc_enter_tournament);
--   - not one this account runs or has any entry in, withdrawn included:
--     those are already on its own list, from tdc_my_tournaments.
-- A full one stays on the list and says so; the poster refuses the entry.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_open_tournaments(p_limit integer default 50)
returns table (
	id           uuid,
	name         text,
	format       text,
	starts_at    timestamptz,
	venue_name   text,
	entrants     integer,
	max_entrants integer,
	entry_mode   text
)
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select t.id, t.name, t.format, t.starts_at, v.name,
		(select count(*)::integer from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.status <> 'withdrawn'),
		t.max_entrants, t.entry_mode
	from public.tbl_tournaments t
	join public.tbl_tournament_posters p on p.tournament_id = t.id and p.is_public
	left join public.tbl_venues v on v.id = t.venue_id
	where (select id from me) is not null
		and t.is_listed
		and t.entry_mode <> 'td_only'
		and (
			private.tdc_tournament_status(t.id) = 'open'
			or (not t.status_manual and private.tdc_tournament_status(t.id) = 'draft')
		)
		and not exists (select 1 from public.tbl_tournament_fixtures f where f.tournament_id = t.id)
		and not private.tdc_can_run_tournament(t.id)
		and not exists (
			select 1 from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.player_id = (select id from me)
		)
	order by t.starts_at nulls last, t.created_at
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.tdc_open_tournaments(integer) from public, anon;
grant execute on function public.tdc_open_tournaments(integer) to authenticated;
