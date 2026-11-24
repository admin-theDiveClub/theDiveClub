-- The site owner may list any venue as played at (UV, 24 Nov; docs/DECISIONS.md,
-- 24 Nov, "The site owner chooses any venue for a competition").
--
-- UV: "As owner, I should also be able to add venues to any league or
-- tournament." This changes 17 Nov ("only a venue's owner or admin may choose
-- it"; the site owner's exception "details only") for the site owner alone.
--
--   private.tdc_can_choose_venue(venue)   the one place: the venue's owner or
--       admin, or the site owner. True or false, never null.
--   private.tdc_check_venue_list          from 20261117073856; its last test
--       asks the above instead of tdc_has_venue_role. All four writers of a
--       played-at list call it (a season's, a tournament's, a fixture's own).
--   public.tdc_choosable_venues()         the open venues the caller may
--       choose, for the picker (venue-picker.js), which until now worked its
--       list out from tbl_venue_staff itself and so would have kept hiding
--       other clubs from the site owner.
--
-- The venue a competition belongs to (staff rights) is not chosen on any page;
-- it is set at creation by a migration, and is unchanged.
--
-- No new table references tbl_players, so private.tdc_merge_players is
-- unaffected.


-- ─── Who may choose a venue ───

create function private.tdc_can_choose_venue(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']), false)
		or private.tdc_is_site_owner();
$$;

revoke execute on function private.tdc_can_choose_venue(uuid) from public, anon;
grant execute on function private.tdc_can_choose_venue(uuid) to authenticated;


-- ─── A played-at list: from 20261117073856 ───

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

	-- Its owner or admin, or the site owner (24 Nov).
	if exists (
		select 1 from unnest(p_venue_ids) x
		where not x = any (coalesce(p_already, '{}'))
			and not private.tdc_can_choose_venue(x)
	) then
		raise exception 'Only an owner or admin of a venue can choose it.';
	end if;
end;
$$;

revoke execute on function private.tdc_check_venue_list(uuid[], uuid[]) from public, anon, authenticated;


-- ─── The venues the caller may choose, for the picker ───

create function public.tdc_choosable_venues()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
	select v.id
	from public.tbl_venues v
	where v.active
		and private.tdc_can_choose_venue(v.id);
$$;

revoke execute on function public.tdc_choosable_venues() from public, anon;
grant execute on function public.tdc_choosable_venues() to authenticated;
