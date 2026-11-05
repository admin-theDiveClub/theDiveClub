-- Venues, step 1 of 3: the database only (UV, 5 Nov). No page changes, and no
-- page reads any of this yet.
--
-- A competition now has two kinds of venue, kept apart on purpose:
--
--   * The venue it BELONGS to: the venue_id already on tbl_leagues and
--     tbl_tournaments. That venue's staff may run it and its credits settle
--     there. Unchanged, and still fixed at creation. A match copies its
--     league's or tournament's into tbl_matches.venue_id, which is what gives
--     staff the right to edit the card (private.tdc_can_edit_match), so a
--     venue something is merely played at must never be written there.
--
--   * The venues it is PLAYED AT: tbl_league_season_venues and
--     tbl_tournament_venues, new here. Words on a page and nothing more: no
--     rights for that venue's staff, none for whoever lists it. Whoever runs
--     the competition may list any active venue, with no approval.
--
-- What UV decided, 5 Nov:
--
--   * Tying a LEAGUE to a venue takes that venue's owner or admin (24 Oct: "only
--     a venue the person owns"); staff no longer may. A TOURNAMENT keeps owner,
--     admin or staff, because a club night's TD is often whoever is behind the
--     bar. No exception for UV's own account: he lists any venue as played at.
--   * Played-at is per season, not per league, so a league moving to another
--     club does not rewrite its old seasons. A new season copies the last one's.
--   * A fixture may name its own venue, as it names its own tables, or stay
--     blank and take the season's.
--   * Opening hours are real times in their own table, typed in by UV.
--   * Signed-out visitors may read a venue's display details, through
--     tdc_venues and tdc_venue only.
--   * A venue's owner or admin edits its details. New venues come through a
--     migration.
--
-- tdc_create_league, tdc_create_league_season, tdc_add_league_fixture,
-- tdc_set_league_fixture and tdc_league_fixtures are patched from their text in
-- a freshly reset database, not retyped. No player is referenced, so
-- private.tdc_merge_players is unaffected.


-- ─── A venue's details ───

alter table public.tbl_venues
	add column description   text,
	add column address       text,
	add column area          text,
	add column city          text,
	add column maps_url      text,
	add column picture_path  text,
	add column table_count   integer,
	add column table_note    text,
	add column phone         text,
	add column whatsapp      text,
	add column email         text,
	add column website_url   text,
	add column instagram_url text,
	add column facebook_url  text,
	add column hours_note    text;

-- Links are drawn as links on public pages, so https only: this is what stops a
-- javascript: address reaching a page.
alter table public.tbl_venues
	add constraint tbl_venues_description_length check (char_length(description) <= 500),
	add constraint tbl_venues_address_length check (char_length(address) <= 200),
	add constraint tbl_venues_area_length check (char_length(area) <= 100),
	add constraint tbl_venues_city_length check (char_length(city) <= 100),
	add constraint tbl_venues_table_note_length check (char_length(table_note) <= 200),
	add constraint tbl_venues_hours_note_length check (char_length(hours_note) <= 200),
	add constraint tbl_venues_table_count_range check (table_count between 0 and 200),
	add constraint tbl_venues_phone_shape check (phone ~ '^\+?[0-9][0-9 ]{5,19}$'),
	add constraint tbl_venues_whatsapp_shape check (whatsapp ~ '^\+?[0-9][0-9 ]{5,19}$'),
	add constraint tbl_venues_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(email) <= 200),
	add constraint tbl_venues_maps_url_https check (maps_url ~ '^https://[^[:space:]]+$' and char_length(maps_url) <= 500),
	add constraint tbl_venues_website_url_https check (website_url ~ '^https://[^[:space:]]+$' and char_length(website_url) <= 500),
	add constraint tbl_venues_instagram_url_https check (instagram_url ~ '^https://[^[:space:]]+$' and char_length(instagram_url) <= 500),
	add constraint tbl_venues_facebook_url_https check (facebook_url ~ '^https://[^[:space:]]+$' and char_length(facebook_url) <= 500),
	add constraint tbl_venues_picture_path_is_own check (picture_path is null or picture_path like id::text || '/%');

comment on column public.tbl_venues.description is 'A short description for the venue''s page.';
comment on column public.tbl_venues.address is 'The street address without the area or city, e.g. "C5, The Gantry".';
comment on column public.tbl_venues.area is 'The part of town, e.g. "Lonehill, Fourways".';
comment on column public.tbl_venues.table_count is 'How many tables the venue has. Null when not known.';
comment on column public.tbl_venues.table_note is 'What the tables are, in words, e.g. "6 x 9ft, 1 snooker".';
comment on column public.tbl_venues.picture_path is 'The venue''s picture: an object in the public venue-pictures bucket, <venue id>/<random>.<ext>. Set through tdc_set_venue_picture.';
comment on column public.tbl_venues.hours_note is 'Anything the times in tbl_venue_hours cannot say, e.g. "Closed on public holidays".';

comment on column public.tbl_leagues.venue_id is
	'The venue this league BELONGS to: its staff may run it and its credits settle there. Fixed at creation. Where it is played is tbl_league_season_venues.';
comment on column public.tbl_tournaments.venue_id is
	'The venue this tournament BELONGS to: its staff may run it and its credits settle there. Fixed at creation. Where it is played is tbl_tournament_venues.';
comment on column public.tbl_matches.venue_id is
	'The venue whose staff may edit this card: the one its league or tournament belongs to. Never the venue a fixture is played at (tbl_league_fixtures.venue_id), which gives no rights.';


-- ─── Opening hours ───
-- One row for each time the venue opens, so a day may hold two and a day with no
-- row is closed. Real times rather than text, so a page can say "Open now". A
-- closing time earlier than the opening time is the next morning: 12:00 to 02:00.
-- There is no function to write these: UV types them in the dashboard's Table
-- Editor (5 Nov).

create table public.tbl_venue_hours (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	venue_id    uuid not null references public.tbl_venues (id) on delete cascade,
	day_of_week smallint not null check (day_of_week between 1 and 7),
	opens_at    time not null,
	closes_at   time not null,

	constraint tbl_venue_hours_opens_and_closes check (opens_at <> closes_at),
	constraint tbl_venue_hours_once unique (venue_id, day_of_week, opens_at)
);

comment on table public.tbl_venue_hours is
	'When a venue is open. A day with no row is closed; a closing time earlier than the opening time is the next morning.';
comment on column public.tbl_venue_hours.day_of_week is '1 is Monday, 7 is Sunday.';

alter table public.tbl_venue_hours enable row level security;

create policy "Signed-in users can see the hours of venues they can see"
	on public.tbl_venue_hours
	for select
	to authenticated
	using (exists (select 1 from public.tbl_venues v where v.id = venue_id));

grant select on public.tbl_venue_hours to authenticated;
grant select, insert, update, delete on public.tbl_venue_hours to service_role;


-- ─── Where a competition is played ───
-- Position is the order a page lists them in. Nothing here gives anybody a right.

create table public.tbl_league_season_venues (
	league_season_id uuid not null references public.tbl_league_seasons (id) on delete cascade,
	venue_id         uuid not null references public.tbl_venues (id) on delete cascade,
	position         integer not null check (position >= 1),
	created_at       timestamptz not null default now(),
	created_by       uuid references auth.users (id) on delete set null,

	primary key (league_season_id, venue_id)
);

create index tbl_league_season_venues_venue_idx on public.tbl_league_season_venues (venue_id);

create table public.tbl_tournament_venues (
	tournament_id uuid not null references public.tbl_tournaments (id) on delete cascade,
	venue_id      uuid not null references public.tbl_venues (id) on delete cascade,
	position      integer not null check (position >= 1),
	created_at    timestamptz not null default now(),
	created_by    uuid references auth.users (id) on delete set null,

	primary key (tournament_id, venue_id)
);

create index tbl_tournament_venues_venue_idx on public.tbl_tournament_venues (venue_id);

comment on table public.tbl_league_season_venues is
	'The venues a league season is played at. Gives no rights: those come from tbl_leagues.venue_id.';
comment on table public.tbl_tournament_venues is
	'The venues a tournament is played at. Gives no rights: those come from tbl_tournaments.venue_id.';

alter table public.tbl_league_season_venues enable row level security;
alter table public.tbl_tournament_venues enable row level security;

create policy "Signed-in users can see where a league season is played"
	on public.tbl_league_season_venues for select to authenticated using (true);
create policy "Signed-in users can see where a tournament is played"
	on public.tbl_tournament_venues for select to authenticated using (true);

grant select on public.tbl_league_season_venues to authenticated;
grant select on public.tbl_tournament_venues to authenticated;
grant select, insert, update, delete on public.tbl_league_season_venues to service_role;
grant select, insert, update, delete on public.tbl_tournament_venues to service_role;

-- A venue a fixture names for itself. Set null with the venue, as the blank it
-- then is takes the season's.
alter table public.tbl_league_fixtures
	add column venue_id uuid references public.tbl_venues (id) on delete set null;

create index tbl_league_fixtures_venue_idx on public.tbl_league_fixtures (venue_id);

comment on column public.tbl_league_fixtures.venue_id is
	'Where this fixture is played, when it is not simply the season''s venue. Blank takes the season''s (tdc_league_fixtures). Gives no rights, and is never copied to tbl_matches.venue_id.';


-- A list of venues to play at: no blanks, no repeats, and each one active. One
-- already on the list may stay after it closes, so an old season can still be
-- saved.
create function private.tdc_check_venue_list(p_venue_ids uuid[], p_already uuid[])
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
end;
$$;

revoke execute on function private.tdc_check_venue_list(uuid[], uuid[]) from public, anon, authenticated;

-- Each takes the whole list in its order, as tdc_set_seeds does; empty clears it.
create function public.tdc_set_league_season_venues(p_league_season_id uuid, p_venue_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_already uuid[];
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can change where it is played.';
	end if;

	select array_agg(venue_id) into v_already
	from public.tbl_league_season_venues where league_season_id = p_league_season_id;

	perform private.tdc_check_venue_list(p_venue_ids, v_already);

	delete from public.tbl_league_season_venues where league_season_id = p_league_season_id;

	insert into public.tbl_league_season_venues (league_season_id, venue_id, position, created_by)
	select p_league_season_id, x.id, x.n, (select auth.uid())
	from unnest(p_venue_ids) with ordinality as x(id, n);
end;
$$;

revoke execute on function public.tdc_set_league_season_venues(uuid, uuid[]) from public, anon;
grant execute on function public.tdc_set_league_season_venues(uuid, uuid[]) to authenticated;

create function public.tdc_set_tournament_venues(p_tournament_id uuid, p_venue_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_already uuid[];
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change where it is played.';
	end if;

	select array_agg(venue_id) into v_already
	from public.tbl_tournament_venues where tournament_id = p_tournament_id;

	perform private.tdc_check_venue_list(p_venue_ids, v_already);

	delete from public.tbl_tournament_venues where tournament_id = p_tournament_id;

	insert into public.tbl_tournament_venues (tournament_id, venue_id, position, created_by)
	select p_tournament_id, x.id, x.n, (select auth.uid())
	from unnest(p_venue_ids) with ordinality as x(id, n);
end;
$$;

revoke execute on function public.tdc_set_tournament_venues(uuid, uuid[]) from public, anon;
grant execute on function public.tdc_set_tournament_venues(uuid, uuid[]) to authenticated;


-- ─── Reading a venue ───
-- The only way in for somebody signed out: tbl_venues is not granted to anon.
-- Display details only, so no staff, timezone or currency. A closed venue is
-- hidden as the table's own rule hides it, except from its own staff.

create function public.tdc_venues()
returns table (
	id           uuid,
	name         text,
	slug         text,
	area         text,
	city         text,
	picture_path text,
	table_count  integer
)
language sql
stable
security definer
set search_path = ''
as $$
	select v.id, v.name, v.slug, v.area, v.city, v.picture_path, v.table_count
	from public.tbl_venues v
	where v.active
	order by v.name;
$$;

revoke execute on function public.tdc_venues() from public;
grant execute on function public.tdc_venues() to anon, authenticated;

create function public.tdc_venue(p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'id', v.id,
		'name', v.name,
		'slug', v.slug,
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
		), '[]'::jsonb)
	)
	from public.tbl_venues v
	where v.id = p_venue_id
		and (v.active or private.tdc_has_venue_role(v.id, array['owner', 'admin', 'staff']));
$$;

revoke execute on function public.tdc_venue(uuid) from public;
grant execute on function public.tdc_venue(uuid) to anon, authenticated;


-- ─── Editing a venue ───
-- Its owner or admin, the whole form at once: a blank clears that detail. Name,
-- slug, timezone, currency and active are not here; those stay in migrations.

create function public.tdc_update_venue(
	p_venue_id      uuid,
	p_description   text default null,
	p_address       text default null,
	p_area          text default null,
	p_city          text default null,
	p_maps_url      text default null,
	p_table_count   integer default null,
	p_table_note    text default null,
	p_phone         text default null,
	p_whatsapp      text default null,
	p_email         text default null,
	p_website_url   text default null,
	p_instagram_url text default null,
	p_facebook_url  text default null,
	p_hours_note    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_row record;
begin
	if not exists (select 1 from public.tbl_venues where id = p_venue_id) then
		raise exception 'TDC (Error): venue % not found.', p_venue_id;
	end if;

	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
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
$$;

revoke execute on function public.tdc_update_venue(uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.tdc_update_venue(uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text, text) to authenticated;


-- ─── A venue's picture ───
-- Built as team-pictures is (migration team_pictures), for the same reasons: a
-- public bucket with a random path, <venue id>/<random>.webp, the browser
-- shrinking and re-encoding first. Its owner or admin may set it. objects.name,
-- never a bare name: inside the subquery that would be the venue's own name.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'venue-pictures',
	'venue-pictures',
	true,
	2097152,
	array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "Anyone can see venue pictures"
	on storage.objects
	for select
	to public
	using (bucket_id = 'venue-pictures');

create policy "Venue owners can add its picture"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'venue-pictures'
		and exists (
			select 1 from public.tbl_venues v
			where v.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_has_venue_role(v.id, array['owner', 'admin'])
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
				and private.tdc_has_venue_role(v.id, array['owner', 'admin'])
		)
	)
	with check (
		bucket_id = 'venue-pictures'
		and exists (
			select 1 from public.tbl_venues v
			where v.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_has_venue_role(v.id, array['owner', 'admin'])
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
				and private.tdc_has_venue_role(v.id, array['owner', 'admin'])
		)
	);

-- Sets (or, with null, clears) the picture and returns the path it had, so the
-- page can delete the old file once the new one is in place.
create function public.tdc_set_venue_picture(p_venue_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_old text;
begin
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
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
$$;

revoke execute on function public.tdc_set_venue_picture(uuid, text) from public, anon;
grant execute on function public.tdc_set_venue_picture(uuid, text) to authenticated;


-- ─── The functions this reaches ───

-- tdc_create_league's arguments do not change, so it is replaced in place.

CREATE OR REPLACE FUNCTION public.tdc_create_league(p_name text, p_rules jsonb, p_venue_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_id uuid;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	if not exists (select 1 from public.tbl_players where user_id = (select auth.uid())) then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	-- A league attached to a venue gives that venue's staff the running of it,
	-- so only its owner or admin may attach one (UV, 5 Nov). Without a venue
	-- anyone may run one — the open tier, as for tournaments.
	if p_venue_id is not null
		and not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
		raise exception 'Only an owner or admin of that venue can run a league there.';
	end if;

	perform private.tdc_check_league_rules(p_rules);

	insert into public.tbl_leagues (created_by, venue_id, name, rules, notes)
	values ((select auth.uid()), p_venue_id, trim(p_name), p_rules, p_notes)
	returning id into v_id;

	return v_id;
end;
$function$;

-- Replaced in place too: only the body changes.

CREATE OR REPLACE FUNCTION public.tdc_create_league_season(p_league_id uuid, p_name text, p_season_name text DEFAULT NULL::text, p_starts_on date DEFAULT NULL::date, p_ends_on date DEFAULT NULL::date, p_season_id uuid DEFAULT NULL::uuid, p_rules_overrides jsonb DEFAULT '{}'::jsonb, p_max_reserves integer DEFAULT 2)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me     uuid;
	v_league public.tbl_leagues%rowtype;
	v_season uuid := p_season_id;
	v_id     uuid;
begin
	select * into v_league from public.tbl_leagues where id = p_league_id;
	if v_league.id is null then
		raise exception 'TDC (Error): league % not found.', p_league_id;
	end if;

	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can open a season.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	p_rules_overrides := coalesce(p_rules_overrides, '{}'::jsonb);
	if jsonb_typeof(p_rules_overrides) <> 'object' then
		raise exception 'TDC (Error): the rule changes must be a json object.';
	end if;
	-- The merged result is what matches will freeze, so that is what is checked.
	-- An unknown key in the overrides shows up here as an unknown setting.
	perform private.tdc_check_league_rules(v_league.rules || p_rules_overrides);

	-- Before the insert: the column's check would refuse it anyway, with a
	-- message nobody can act on.
	if p_max_reserves is null or p_max_reserves not between 0 and 10 then
		raise exception 'Reserves allowed must be a number from 0 to 10.';
	end if;

	if v_season is null then
		insert into public.tbl_seasons (created_by, name, starts_on, ends_on)
		values ((select auth.uid()), trim(coalesce(p_season_name, p_name)), p_starts_on, p_ends_on)
		returning id into v_season;
	elsif not exists (select 1 from public.tbl_seasons where id = v_season) then
		raise exception 'TDC (Error): season % not found.', v_season;
	end if;

	if exists (
		select 1 from public.tbl_league_seasons where league_id = p_league_id and season_id = v_season
	) then
		raise exception 'This league already has a season for that period.';
	end if;

	insert into public.tbl_league_seasons (created_by, league_id, season_id, name, rules_overrides, max_reserves)
	values ((select auth.uid()), p_league_id, v_season, trim(p_name), p_rules_overrides, p_max_reserves)
	returning id into v_id;

	insert into public.tbl_competition_roles (created_by, league_season_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director');

	-- Where it is played follows from the season before (UV, 5 Nov), less any
	-- venue that has since closed. A first season starts with none.
	insert into public.tbl_league_season_venues (league_season_id, venue_id, position, created_by)
	select v_id, sv.venue_id, sv.position, (select auth.uid())
	from public.tbl_league_season_venues sv
	join public.tbl_venues v on v.id = sv.venue_id and v.active
	where sv.league_season_id = (
		select ls.id from public.tbl_league_seasons ls
		where ls.league_id = p_league_id and ls.id <> v_id
		order by ls.created_at desc
		limit 1
	);

	return v_id;
end;
$function$;

-- These gain arguments or columns, so each is dropped and made again.

drop function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text, integer[]);

CREATE OR REPLACE FUNCTION public.tdc_add_league_fixture(p_league_season_id uuid, p_round integer, p_home_team_id uuid, p_away_team_id uuid DEFAULT NULL::uuid, p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text, p_table_numbers integer[] DEFAULT NULL::integer[], p_venue_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_pos integer;
	v_id  uuid;
begin
	if not private.tdc_can_run_league(p_league_season_id) then
		raise exception 'Only the people running this league can add a fixture.';
	end if;

	if p_round is null or p_round < 1 then
		raise exception 'TDC (Error): a fixture needs a round of 1 or more.';
	end if;

	if p_home_team_id is null then
		raise exception 'A fixture needs a team. For a bye, give the team that is sitting out and leave the other side empty.';
	end if;

	-- Said here rather than left to the foreign key, which would come back as
	-- a constraint name nobody can act on.
	if not exists (select 1 from public.tbl_teams
		where id = p_home_team_id and league_season_id = p_league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;
	if p_away_team_id is not null and not exists (select 1 from public.tbl_teams
		where id = p_away_team_id and league_season_id = p_league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;
	if p_away_team_id = p_home_team_id then
		raise exception 'A team cannot play itself.';
	end if;

	if p_venue_id is not null then
		perform private.tdc_check_venue_list(array[p_venue_id], null);
	end if;

	select coalesce(max(position), 0) + 1 into v_pos
	from public.tbl_league_fixtures
	where league_season_id = p_league_season_id and round = p_round;

	insert into public.tbl_league_fixtures
		(created_by, league_season_id, round, position, home_team_id, away_team_id, scheduled_at, notes, table_numbers, venue_id)
	values
		((select auth.uid()), p_league_season_id, p_round, v_pos,
		 p_home_team_id, p_away_team_id, p_scheduled_at, p_notes, coalesce(p_table_numbers, '{}'), p_venue_id)
	returning id into v_id;

	return v_id;
end;
$function$;

revoke execute on function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text, integer[], uuid) from public, anon;
grant execute on function public.tdc_add_league_fixture(uuid, integer, uuid, uuid, timestamptz, text, integer[], uuid) to authenticated;

drop function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text, integer[]);

CREATE OR REPLACE FUNCTION public.tdc_set_league_fixture(p_fixture_id uuid, p_home_team_id uuid DEFAULT NULL::uuid, p_away_team_id uuid DEFAULT NULL::uuid, p_clear_away boolean DEFAULT false, p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_clear_schedule boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_table_numbers integer[] DEFAULT NULL::integer[], p_venue_id uuid DEFAULT NULL::uuid, p_clear_venue boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_f    public.tbl_league_fixtures%rowtype;
	v_home uuid;
	v_away uuid;
begin
	select * into v_f from public.tbl_league_fixtures where id = p_fixture_id;
	if v_f.id is null then
		raise exception 'TDC (Error): fixture % not found.', p_fixture_id;
	end if;

	if not private.tdc_can_run_league(v_f.league_season_id) then
		raise exception 'Only the people running this league can change a fixture.';
	end if;

	v_home := coalesce(p_home_team_id, v_f.home_team_id);
	v_away := case when p_clear_away then null else coalesce(p_away_team_id, v_f.away_team_id) end;

	-- Changing who plays after the match exists would leave the match naming
	-- one pair of teams and the fixture another.
	if v_f.match_id is not null and (v_home is distinct from v_f.home_team_id
		or v_away is distinct from v_f.away_team_id) then
		raise exception 'This fixture already has a match. Take the match off it before changing who is playing.';
	end if;

	if v_home is null then
		raise exception 'A fixture needs a team.';
	end if;
	if v_home = v_away then
		raise exception 'A team cannot play itself.';
	end if;
	if not exists (select 1 from public.tbl_teams
		where id = v_home and league_season_id = v_f.league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;
	if v_away is not null and not exists (select 1 from public.tbl_teams
		where id = v_away and league_season_id = v_f.league_season_id) then
		raise exception 'That team is not in this league season.';
	end if;

	if p_venue_id is not null and not p_clear_venue then
		perform private.tdc_check_venue_list(array[p_venue_id], array[v_f.venue_id]);
	end if;

	update public.tbl_league_fixtures
	set home_team_id = v_home,
		away_team_id = v_away,
		scheduled_at = case when p_clear_schedule then null else coalesce(p_scheduled_at, scheduled_at) end,
		notes        = coalesce(p_notes, notes),
		table_numbers = coalesce(p_table_numbers, table_numbers),
		venue_id     = case when p_clear_venue then null else coalesce(p_venue_id, venue_id) end
	where id = p_fixture_id;
end;
$function$;

revoke execute on function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text, integer[], uuid, boolean) from public, anon;
grant execute on function public.tdc_set_league_fixture(uuid, uuid, uuid, boolean, timestamptz, boolean, text, integer[], uuid, boolean) to authenticated;

drop function public.tdc_league_fixtures(uuid);

CREATE OR REPLACE FUNCTION public.tdc_league_fixtures(p_league_season_id uuid)
 RETURNS TABLE(fixture_id uuid, round integer, "position" integer, scheduled_at timestamp with time zone, home_team_id uuid, home_name text, away_team_id uuid, away_name text, is_bye boolean, match_id uuid, match_status text, home_frames integer, away_frames integer, notes text, table_numbers integer[], venue_id uuid, venue_name text, venue_inherited boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	select f.id, f.round, f."position", f.scheduled_at,
		f.home_team_id, h.name,
		f.away_team_id, a.name,
		f.away_team_id is null,
		f.match_id,
		-- A signed night changed since (UV, 29 Oct) reads 'reopened'. The
		-- match itself stays complete, so its fixture stays locked as a signed
		-- night is (20261025072000) until it is signed again or the change is
		-- undone. Only a complete match is asked, so the rest cost nothing.
		case when m.status = 'complete' then
			case when coalesce((private.tdc_card_state(m.id)->>'reopened')::boolean, false)
				then 'reopened' else 'complete' end
			else m.status end,
		s.home_score, s.away_score,
		f.notes,
		f.table_numbers,
		-- Its own venue, or else the season's when the season has exactly one.
		-- A blank fixture in a season at several has none: naming the first
		-- could send a player to the wrong club, so the page lists the season's.
		coalesce(f.venue_id, sv.venue_id),
		coalesce(fv.name, sv.venue_name),
		f.venue_id is null and sv.venue_id is not null
	from public.tbl_league_fixtures f
	join public.tbl_teams h on h.id = f.home_team_id
	left join public.tbl_teams a on a.id = f.away_team_id
	left join public.tbl_matches m on m.id = f.match_id
	left join lateral private.tdc_match_score(f.match_id) s on f.match_id is not null
	left join public.tbl_venues fv on fv.id = f.venue_id
	left join lateral (
		select (array_agg(v.id))[1] as venue_id, (array_agg(v.name))[1] as venue_name
		from public.tbl_league_season_venues lv
		join public.tbl_venues v on v.id = lv.venue_id
		where lv.league_season_id = f.league_season_id
		having count(*) = 1
	) sv on true
	where (select auth.uid()) is not null
		and f.league_season_id = p_league_season_id
	order by f.round, f."position";
$function$;

revoke execute on function public.tdc_league_fixtures(uuid) from public, anon;
grant execute on function public.tdc_league_fixtures(uuid) to authenticated;


-- ─── The real venues ───
-- The Dive Club as the site's footer gives it; the rest of its details follow
-- when UV has them. The two Billiard Cafés from the Google Maps listings UV sent and confirmed, 5 Nov. They have no
-- owner or staff here, so nobody can tie a competition to them or edit them
-- until one is added, but anyone may list them as played at.

update public.tbl_venues
set address     = 'C5, The Gantry',
	area        = 'Lonehill, Fourways',
	city        = 'Johannesburg',
	website_url = 'https://thediveclub.org'
where slug = 'the-dive-club';

insert into public.tbl_venues (name, slug, address, area, city, maps_url, table_count, phone) values
	('Billiard Café (Rivonia)', 'billiard-cafe-rivonia', 'Edenburg, 17 Wessel Rd', 'Rivonia', 'Sandton',
		'https://maps.app.goo.gl/gQmowCuajAcUvq6d9', 24, '083 788 9971'),
	('Billiard Café (Randpark Ridge)', 'billiard-cafe-randpark-ridge', 'Beyers Naudé Dr & Duiker Ave', 'Randpark Ridge', 'Johannesburg',
		'https://maps.app.goo.gl/Hh1Qybti7LdyMYnp8', 20, '068 629 4019');

-- Randpark Ridge's hours, from its listing. Rivonia's week was not on its
-- listing's screenshot, so UV adds those.
insert into public.tbl_venue_hours (venue_id, day_of_week, opens_at, closes_at)
select v.id, h.day_of_week, h.opens_at, h.closes_at
from public.tbl_venues v
cross join (values
	(1, time '15:00', time '22:30'),
	(2, time '11:00', time '02:00'),
	(3, time '11:00', time '02:00'),
	(4, time '11:00', time '02:00'),
	(5, time '11:00', time '02:00'),
	(6, time '11:00', time '02:00'),
	(7, time '11:00', time '21:30')
) as h(day_of_week, opens_at, closes_at)
where v.slug = 'billiard-cafe-randpark-ridge';
