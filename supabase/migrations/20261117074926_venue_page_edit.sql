-- A venue's page, restyled, and its Settings tab (UV, 17 Nov).
--
-- What UV decided, 17 Nov:
--
--   * The banner names the venue's people. The OWNER is shown to everybody,
--     signed out too; admins and staff only to somebody signed in.
--   * A venue's owner or admin edits every detail on the page's Settings tab,
--     its picture and its opening hours included. Until now nothing wrote the
--     hours: UV typed them in the dashboard (5 Nov).
--   * The name stays in migrations, as do slug, timezone, currency and active.
--   * THE SITE OWNER may edit any venue's details, picture and hours: the owner
--     of The Dive Club (admin@thediveclub.org in production, not UV's personal
--     account), the same test as the title ladder. Details only: choosing a
--     venue for a competition, staff rights on a card and credits stay with
--     the venue's own owner or admin. This narrows 5 Nov's "no exception for
--     UV's account" and 17 Nov's "nobody can edit a venue with no owner" to
--     everything except a venue's details.
--   * "Open now" in the banner, worked out from the hours in the venue's own
--     time, so tdc_venue sends the venue's timezone.
--   * The league tiles on the page show each league's picture, so
--     tdc_venue_competitions sends it.
--
-- One place decides who may edit a venue: private.tdc_can_edit_venue. The
-- details, the picture, the picture's storage rules, the hours and the page's
-- own "may I edit" all ask it.
--
-- tdc_venue, tdc_venue_competitions, tdc_update_venue and tdc_set_venue_picture
-- are patched from their text in a freshly reset database, not retyped: tdc_venue
-- gains people and i_manage, tdc_venue_competitions a league's picture_path, and
-- the other two their guard. No new table references tbl_players, so
-- private.tdc_merge_players is unaffected.


-- ─── Who may edit a venue ───
-- Its owner or admin, or the site owner. True or false, never null.

create function private.tdc_can_edit_venue(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_has_venue_role(p_venue_id, array['owner', 'admin'])
		or exists (
			select 1
			from public.tbl_venue_staff s
			join public.tbl_venues v on v.id = s.venue_id
			where v.slug = 'the-dive-club'
				and s.user_id = (select auth.uid())
				and s.role = 'owner'
		);
$$;

revoke execute on function private.tdc_can_edit_venue(uuid) from public, anon;
grant execute on function private.tdc_can_edit_venue(uuid) to authenticated;


-- ─── Opening hours ───
-- The whole week at once, as the Settings tab sends it: an array of
-- {day, opens, closes}, day 1 Monday to 7 Sunday, times as HH:MM. A day with no
-- entry is closed; an empty array clears every day. A closing time earlier than
-- the opening time is the next morning, as the table says.

create function public.tdc_set_venue_hours(p_venue_id uuid, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_days constant text[] := array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	v_item jsonb;
	v_day integer;
	v_time text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
	if not exists (select 1 from public.tbl_venues where id = p_venue_id) then
		raise exception 'TDC (Error): venue % not found.', p_venue_id;
	end if;

	if not private.tdc_can_edit_venue(p_venue_id) then
		raise exception 'Only an owner or admin of this venue can change its hours.';
	end if;

	if p_hours is null or jsonb_typeof(p_hours) <> 'array' then
		raise exception 'TDC (Error): the hours must be a list.';
	end if;

	if jsonb_array_length(p_hours) > 21 then
		raise exception 'A week can hold at most 21 opening times.';
	end if;

	for v_item in select value from jsonb_array_elements(p_hours)
	loop
		if jsonb_typeof(v_item) <> 'object'
			or jsonb_typeof(v_item -> 'day') <> 'number'
			or coalesce(v_item ->> 'opens', '') !~ v_time
			or coalesce(v_item ->> 'closes', '') !~ v_time then
			raise exception 'TDC (Error): an opening time came in a shape the database does not know: %', v_item;
		end if;

		v_day := (v_item ->> 'day')::integer;
		if v_day not between 1 and 7 then
			raise exception 'TDC (Error): a day must be 1 (Monday) to 7 (Sunday), not %.', v_day;
		end if;

		if v_item ->> 'opens' = v_item ->> 'closes' then
			raise exception '% opens and closes at the same time.', v_days[v_day];
		end if;
	end loop;

	if exists (
		select 1 from jsonb_array_elements(p_hours) x
		group by (x ->> 'day'), (x ->> 'opens')
		having count(*) > 1
	) then
		raise exception 'Two opening times on one day start at the same time.';
	end if;

	delete from public.tbl_venue_hours where venue_id = p_venue_id;

	insert into public.tbl_venue_hours (venue_id, day_of_week, opens_at, closes_at)
	select p_venue_id, (x ->> 'day')::smallint, (x ->> 'opens')::time, (x ->> 'closes')::time
	from jsonb_array_elements(p_hours) x;
end;
$$;

revoke execute on function public.tdc_set_venue_hours(uuid, jsonb) from public, anon;
grant execute on function public.tdc_set_venue_hours(uuid, jsonb) to authenticated;


-- ─── The picture's storage rules ask the same question ───
-- objects.name, never a bare name (CLAUDE.md §8).

drop policy "Venue owners can add its picture" on storage.objects;
drop policy "Venue owners can replace its picture" on storage.objects;
drop policy "Venue owners can remove its picture" on storage.objects;

create policy "Venue owners can add its picture"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'venue-pictures'
		and exists (
			select 1 from public.tbl_venues v
			where v.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_edit_venue(v.id)
		)
	);

create policy "Venue owners can replace its picture"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'venue-pictures'
		and exists (
			select 1 from public.tbl_venues v
			where v.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_edit_venue(v.id)
		)
	)
	with check (
		bucket_id = 'venue-pictures'
		and exists (
			select 1 from public.tbl_venues v
			where v.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_edit_venue(v.id)
		)
	);

create policy "Venue owners can remove its picture"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'venue-pictures'
		and exists (
			select 1 from public.tbl_venues v
			where v.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_edit_venue(v.id)
		)
	);


-- ─── The functions patched (from a freshly reset database) ───

-- tdc_venue: people (the owner for everybody, the rest signed in), i_manage, and
-- timezone (for "Open now" in the venue's own time).
-- tdc_venue_competitions: a league's picture_path.

create or replace function public.tdc_venue(p_venue_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select jsonb_build_object(
		'id', v.id,
		'name', v.name,
		'slug', v.slug,
		'timezone', v.timezone,
		'description', v.description,
		'address', v.address,
		'area', v.area,
		'city', v.city,
		'maps_url', v.maps_url,
		'picture_path', v.picture_path,
		'table_count', v.table_count,
		'table_note', v.table_note,
		'phone', v.phone,
		'whatsapp', v.whatsapp,
		'email', v.email,
		'website_url', v.website_url,
		'instagram_url', v.instagram_url,
		'facebook_url', v.facebook_url,
		'hours_note', v.hours_note,
		'hours', coalesce((
			select jsonb_agg(jsonb_build_object(
				'day', h.day_of_week,
				'opens', to_char(h.opens_at, 'HH24:MI'),
				'closes', to_char(h.closes_at, 'HH24:MI')
			) order by h.day_of_week, h.opens_at)
			from public.tbl_venue_hours h
			where h.venue_id = v.id
		), '[]'::jsonb),
		'people', coalesce((
			select jsonb_agg(jsonb_build_object(
				'player_id', p.id,
				'display_name', p.display_name,
				'avatar_path', p.avatar_path,
				'role', s.role
			) order by case s.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.display_name)
			from public.tbl_venue_staff s
			join public.tbl_players p on p.user_id = s.user_id
			where s.venue_id = v.id
				and (s.role = 'owner' or (select auth.uid()) is not null)
		), '[]'::jsonb),
		'i_manage', private.tdc_can_edit_venue(v.id)
	)
	from public.tbl_venues v
	where v.id = p_venue_id
		and (v.active or private.tdc_has_venue_role(v.id, array['owner', 'admin', 'staff']));
$function$;

create or replace function public.tdc_venue_competitions(p_venue_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select jsonb_build_object(
		'leagues', coalesce((
			select jsonb_agg(jsonb_build_object(
				'league_season_id', s.id,
				'league_name', l.name,
				'picture_path', l.picture_path,
				'season_name', s.name,
				'status', s.status,
				'starts_on', z.starts_on,
				'ends_on', z.ends_on,
				'discipline', private.tdc_rules_for_league_season(s.id) ->> 'discipline',
				'team_size', private.tdc_team_size(private.tdc_rules_for_league_season(s.id)),
				'players', (select count(*)::integer from public.tbl_league_season_entrants e
					where e.league_season_id = s.id and e.status = 'active')
			) order by z.starts_on desc nulls last, l.name)
			from public.tbl_league_seasons s
			join public.tbl_leagues l on l.id = s.league_id
			join public.tbl_seasons z on z.id = s.season_id
			where s.is_listed
				and (
					l.venue_id = p_venue_id
					or exists (select 1 from public.tbl_league_season_venues lv
						where lv.league_season_id = s.id and lv.venue_id = p_venue_id)
					or exists (select 1 from public.tbl_league_fixtures f
						where f.league_season_id = s.id and f.venue_id = p_venue_id)
				)
		), '[]'::jsonb),
		'tournaments', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', t.id,
				'name', t.name,
				'format', t.format,
				'status', private.tdc_tournament_status(t.id),
				'starts_at', t.starts_at,
				'entrants', (select count(*)::integer from public.tbl_tournament_entrants e
					where e.tournament_id = t.id and e.status <> 'withdrawn'),
				'max_entrants', t.max_entrants,
				'poster_open', exists (select 1 from public.tbl_tournament_posters p
					where p.tournament_id = t.id and p.is_public)
			) order by t.starts_at desc nulls last, t.name)
			from public.tbl_tournaments t
			where t.is_listed
				and (
					t.venue_id = p_venue_id
					or exists (select 1 from public.tbl_tournament_venues tv
						where tv.tournament_id = t.id and tv.venue_id = p_venue_id)
				)
		), '[]'::jsonb)
	)
	from public.tbl_venues v
	where v.id = p_venue_id
		and (v.active or private.tdc_has_venue_role(v.id, array['owner', 'admin', 'staff']));
$function$;

-- tdc_update_venue and tdc_set_venue_picture: the one guard.

create or replace function public.tdc_update_venue(p_venue_id uuid, p_description text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_area text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_maps_url text DEFAULT NULL::text, p_table_count integer DEFAULT NULL::integer, p_table_note text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_whatsapp text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_website_url text DEFAULT NULL::text, p_instagram_url text DEFAULT NULL::text, p_facebook_url text DEFAULT NULL::text, p_hours_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_row record;
begin
	if not exists (select 1 from public.tbl_venues where id = p_venue_id) then
		raise exception 'TDC (Error): venue % not found.', p_venue_id;
	end if;

	if not private.tdc_can_edit_venue(p_venue_id) then
		raise exception 'Only an owner or admin of this venue can change its details.';
	end if;

	p_description   := nullif(trim(p_description), '');
	p_address       := nullif(trim(p_address), '');
	p_area          := nullif(trim(p_area), '');
	p_city          := nullif(trim(p_city), '');
	p_maps_url      := nullif(trim(p_maps_url), '');
	p_table_note    := nullif(trim(p_table_note), '');
	p_phone         := nullif(trim(p_phone), '');
	p_whatsapp      := nullif(trim(p_whatsapp), '');
	p_email         := nullif(trim(p_email), '');
	p_website_url   := nullif(trim(p_website_url), '');
	p_instagram_url := nullif(trim(p_instagram_url), '');
	p_facebook_url  := nullif(trim(p_facebook_url), '');
	p_hours_note    := nullif(trim(p_hours_note), '');

	-- Said here rather than left to the checks on the table, which come back
	-- as constraint names nobody can act on.
	for v_row in
		select * from (values
			('The description', p_description, 500),
			('The address', p_address, 200),
			('The area', p_area, 100),
			('The city', p_city, 100),
			('The note about the tables', p_table_note, 200),
			('The note about the hours', p_hours_note, 200)
		) as t(label, value, most)
	loop
		if char_length(v_row.value) > v_row.most then
			raise exception '% can be at most % characters.', v_row.label, v_row.most;
		end if;
	end loop;

	for v_row in
		select * from (values
			('The maps link', p_maps_url),
			('The website', p_website_url),
			('The Instagram link', p_instagram_url),
			('The Facebook link', p_facebook_url)
		) as t(label, value)
	loop
		if v_row.value !~ '^https://[^[:space:]]+$' or char_length(v_row.value) > 500 then
			raise exception '% must be a full link starting https://', v_row.label;
		end if;
	end loop;

	if p_table_count not between 0 and 200 then
		raise exception 'The number of tables must be from 0 to 200.';
	end if;
	if p_phone !~ '^\+?[0-9][0-9 ]{5,19}$' then
		raise exception 'The phone number can hold only digits, spaces and a leading +.';
	end if;
	if p_whatsapp !~ '^\+?[0-9][0-9 ]{5,19}$' then
		raise exception 'The WhatsApp number can hold only digits, spaces and a leading +.';
	end if;
	if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(p_email) > 200 then
		raise exception 'That is not an email address.';
	end if;

	update public.tbl_venues
	set description   = p_description,
		address       = p_address,
		area          = p_area,
		city          = p_city,
		maps_url      = p_maps_url,
		table_count   = p_table_count,
		table_note    = p_table_note,
		phone         = p_phone,
		whatsapp      = p_whatsapp,
		email         = p_email,
		website_url   = p_website_url,
		instagram_url = p_instagram_url,
		facebook_url  = p_facebook_url,
		hours_note    = p_hours_note
	where id = p_venue_id;
end;
$function$;

create or replace function public.tdc_set_venue_picture(p_venue_id uuid, p_path text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_old text;
begin
	if not private.tdc_can_edit_venue(p_venue_id) then
		raise exception 'Only an owner or admin of this venue can change its picture.';
	end if;

	select picture_path into v_old from public.tbl_venues where id = p_venue_id;

	-- The check constraint says the same; said here in words.
	if p_path is not null and p_path not like p_venue_id::text || '/%' then
		raise exception 'TDC (Error): a venue''s picture must be in its own folder.';
	end if;

	update public.tbl_venues set picture_path = p_path where id = p_venue_id;
	return v_old;
end;
$function$;
