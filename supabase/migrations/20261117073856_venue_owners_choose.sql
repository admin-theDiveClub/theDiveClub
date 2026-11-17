-- Only a venue's owner or admin may choose it (UV, 17 Nov).
--
-- Everywhere a venue is selected, the person selecting must be that venue's
-- owner or admin. A player, another venue's owner, or the venue's own staff may
-- not. This reverses 5 Nov's "whoever runs a competition may list any active
-- venue as played at" (DECISIONS 17 Nov, "Only a venue's owner or admin may
-- choose it").
--
--   1. Played at (a season's list, a tournament's list, a fixture's own venue):
--      private.tdc_check_venue_list, which all four writers call, now refuses a
--      venue the caller is not owner or admin of. One already on the list may
--      stay, as a closed one may, so a save that keeps it is not refused and
--      nothing already listed is lost.
--   2. Belongs to, for a tournament: staff no longer, owner or admin as for a
--      league.
--   3. Rick Schoenlank is the owner of both Billiard Cafés (UV, 17 Nov). Only
--      where his account exists, so a local copy is unchanged.
--   4. tbl_venues.sells_credits: which venues' credits a profile shows. On for
--      The Dive Club only (UV: credits are a business operation, and no other
--      club is shown in that part of the site yet).
--
-- Both functions patched from their latest text (20261105200430 and
-- 20261105084149), not retyped.


-- ─────────────────────────────────────────────────────────────────
-- 1. Played at
-- ─────────────────────────────────────────────────────────────────

-- A list of venues to play at: no blanks, no repeats, and each one active and
-- the caller's own (owner or admin). One already on the list may stay after it
-- closes, or when someone else listed it, so an old season can still be saved.
create or replace function private.tdc_check_venue_list(p_venue_ids uuid[], p_already uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if p_venue_ids is null or array_position(p_venue_ids, null) is not null then
		raise exception 'TDC (Error): a list of venues cannot hold a blank.';
	end if;

	if cardinality(p_venue_ids) <> (select count(distinct x) from unnest(p_venue_ids) x) then
		raise exception 'A venue can only be listed once.';
	end if;

	if exists (
		select 1 from unnest(p_venue_ids) x
		where not x = any (coalesce(p_already, '{}'))
			and not exists (select 1 from public.tbl_venues v where v.id = x and v.active)
	) then
		raise exception 'That venue is not open on the platform.';
	end if;

	if exists (
		select 1 from unnest(p_venue_ids) x
		where not x = any (coalesce(p_already, '{}'))
			and not private.tdc_has_venue_role(x, array['owner', 'admin'])
	) then
		raise exception 'Only an owner or admin of a venue can choose it.';
	end if;
end;
$$;

revoke execute on function private.tdc_check_venue_list(uuid[], uuid[]) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 2. The venue a tournament belongs to
-- ─────────────────────────────────────────────────────────────────

create or replace function public.tdc_create_tournament(
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

	-- A tournament attached to a venue has to be tied there by its owner or
	-- admin (UV, 17 Nov; staff before). Without a venue, anyone may run one —
	-- that is the open tier.
	if p_venue_id is not null
		and not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
		raise exception 'Only an owner or admin of that venue can run a tournament there.';
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
-- 3. Rick Schoenlank owns both Billiard Cafés
-- ─────────────────────────────────────────────────────────────────

insert into public.tbl_venue_staff (venue_id, user_id, role)
select v.id, u.id, 'owner'
from public.tbl_venues v
cross join auth.users u
where v.slug in ('billiard-cafe-rivonia', 'billiard-cafe-randpark-ridge')
	and u.id = '4eae183c-32f8-44ed-a9b4-66e26bcbd98e'
on conflict (venue_id, user_id) do nothing;


-- ─────────────────────────────────────────────────────────────────
-- 4. Which venues sell credits
-- ─────────────────────────────────────────────────────────────────

alter table public.tbl_venues
	add column sells_credits boolean not null default false;

comment on column public.tbl_venues.sells_credits is
	'Whether this venue sells credits on the site. A profile''s Credits section lists only these venues (UV, 17 Nov: credits are a business operation; no other club is shown there yet). Set by migration.';

update public.tbl_venues set sells_credits = true where slug = 'the-dive-club';
