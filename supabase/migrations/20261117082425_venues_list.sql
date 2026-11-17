-- The venues page (UV, 17 Nov): /venues/ with no venue named lists every venue,
-- in wide cards like the Leagues page's, linked from the menu after Leagues.
--
-- Each card shows (UV): the picture, name, area and city, address, "Open now"
-- (the strip green open, grey closed), the tables and their note, the phone,
-- and how many leagues and tournaments are listed there. tdc_venues sent only
-- the name, area, city, picture and table count, so it now sends the rest too:
-- one call for the whole page, rather than tdc_venue once per venue
-- (docs/systems/foundations.md, "Reading fast").
--
-- The counts are counted by tdc_venue_competitions itself, so the card and the
-- venue's own page can never disagree about what is listed there.
--
-- Its return type changes, so it is dropped and made again with the same name,
-- arguments and grants (test 069 lists everything a stranger can reach by
-- signature). The new columns come after the old ones, so the venue picker,
-- which reads id, name, area and city, is untouched. Display details only, as
-- before: no staff, no email.
--
-- No player is referenced, so private.tdc_merge_players is unaffected.

drop function public.tdc_venues();

create function public.tdc_venues()
returns table (
	id               uuid,
	name             text,
	slug             text,
	area             text,
	city             text,
	picture_path     text,
	table_count      integer,
	address          text,
	table_note       text,
	phone            text,
	timezone         text,
	hours            jsonb,
	league_count     integer,
	tournament_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
	select v.id, v.name, v.slug, v.area, v.city, v.picture_path, v.table_count,
		v.address, v.table_note, v.phone, v.timezone,
		coalesce((
			select jsonb_agg(jsonb_build_object(
				'day', h.day_of_week,
				'opens', to_char(h.opens_at, 'HH24:MI'),
				'closes', to_char(h.closes_at, 'HH24:MI')
			) order by h.day_of_week, h.opens_at)
			from public.tbl_venue_hours h
			where h.venue_id = v.id
		), '[]'::jsonb),
		jsonb_array_length(c.lists -> 'leagues'),
		jsonb_array_length(c.lists -> 'tournaments')
	from public.tbl_venues v
	cross join lateral (select public.tdc_venue_competitions(v.id) as lists) c
	where v.active
	order by v.name;
$$;

revoke execute on function public.tdc_venues() from public;
grant execute on function public.tdc_venues() to anon, authenticated;
