-- Progression and match creation, decided when the tournament is made.
--
-- UV, 21 Oct: "We were supposed to offer options for auto-progression to TD.
-- This should be a setting on tournament creation and in the tournament page,
-- we should have a toggle."
--
-- Both columns have existed since 20261019170000/20261019180000 and are read
-- by the draw, but the only place to set them was the bracket page's setup
-- panel — which is shown *only while no draw exists*. So after generating,
-- there was no way to change your mind without clearing the draw, and the
-- create page never mentioned them at all.
--
-- Two halves to the fix. This migration is the create half: the three draw
-- settings become arguments, so a TD who already knows says it once. The
-- other half needs no schema — tdc_update_tournament has taken p_progression
-- and p_create_matches since 20261019180000, so the live toggle on the draw
-- page is a page change only.
--
-- third_place comes along because it is the third setting in that same panel
-- and would otherwise be the one left behind. It stays refused once a draw
-- exists (tdc_update_tournament enforces that) because the draw is generated
-- with it or without it.
--
-- Replaces the version from 20261021130000. Patched from that original, not
-- retyped. Dropped first because adding defaulted parameters would leave the
-- nine-argument version in place and make every existing call ambiguous.

drop function if exists public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean);

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
	p_third_place       boolean default null
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
		 entry_mode, paid_confirms, progression, create_matches, third_place)
	values
		((select auth.uid()), p_venue_id, trim(p_name), p_format, p_rules,
		 p_starts_at, p_max_entrants, coalesce(p_entry_fee_credits, 0),
		 coalesce(p_entry_mode, 'td_only'), coalesce(p_paid_confirms, false),
		 coalesce(p_progression, 'automatic'),
		 coalesce(p_create_matches, 'automatic'),
		 coalesce(p_third_place, false))
	returning id into v_id;

	-- Whoever made it runs it, or nobody does and it cannot be changed.
	insert into public.tbl_competition_roles (created_by, tournament_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director');

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean, text, text, boolean) from public, anon;
grant execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer, text, boolean, text, text, boolean) to authenticated;
