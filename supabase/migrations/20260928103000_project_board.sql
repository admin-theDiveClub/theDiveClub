-- Project board: the owner's task list for the business and the website (/staff/board/).
-- Code lives in tools/project-board/; only these tables are part of the database.
--
-- Rules:
--   - Everything belongs to a venue. Only that venue's owners can see or change it (checked here, not just in the page).
--   - Tasks sit in a track ('business' or 'website'). Top-level tasks belong to a group; sub-tasks follow their parent
--     and have no group of their own. Sub-tasks can have sub-tasks, to any depth. Deleting a task deletes its sub-tasks.
--   - A task can have one person. Groups and people are their own rows, so renaming one is a single change.
--   - Links join two tasks: 'waiting_on', 'blocks' or 'related'. Deleting either task removes the link.

-- ─── Groups (per venue and track, in display order) ───
create table public.tbl_pm_groups (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	venue_id    uuid not null references public.tbl_venues (id) on delete cascade,
	track       text not null check (track in ('business', 'website')),
	name        text not null check (char_length(trim(name)) between 1 and 100),
	sort_order  integer not null default 0,

	constraint tbl_pm_groups_unique_name unique (venue_id, track, name)
);

-- ─── People (per venue) ───
create table public.tbl_pm_people (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	venue_id    uuid not null references public.tbl_venues (id) on delete cascade,
	name        text not null check (char_length(trim(name)) between 1 and 100),

	constraint tbl_pm_people_unique_name unique (venue_id, name)
);

-- ─── Tasks ───
create table public.tbl_pm_items (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	updated_at  timestamptz not null default now(),
	venue_id    uuid not null references public.tbl_venues (id) on delete cascade,
	track       text not null check (track in ('business', 'website')),
	group_id    uuid references public.tbl_pm_groups (id) on delete restrict,   -- a group with tasks can't be deleted
	parent_id   uuid references public.tbl_pm_items (id) on delete cascade,     -- deleting a task deletes its sub-tasks
	person_id   uuid references public.tbl_pm_people (id) on delete set null,
	title       text not null check (char_length(trim(title)) between 1 and 300),
	note        text not null default '' check (char_length(note) <= 4000),
	status      text not null default 'todo' check (status in ('next', 'progress', 'todo', 'waiting', 'done')),
	sort_order  integer not null default 0,
	created_by  uuid references auth.users (id) on delete set null,
	updated_by  uuid references auth.users (id) on delete set null,

	constraint tbl_pm_items_group_or_parent check (
		(parent_id is null and group_id is not null)
		or (parent_id is not null and group_id is null)
	),
	constraint tbl_pm_items_not_own_parent check (parent_id is null or parent_id <> id)
);

create index tbl_pm_items_venue_idx  on public.tbl_pm_items (venue_id);
create index tbl_pm_items_parent_idx on public.tbl_pm_items (parent_id);
create index tbl_pm_items_group_idx  on public.tbl_pm_items (group_id);
create index tbl_pm_items_person_idx on public.tbl_pm_items (person_id);

-- ─── Links between tasks ───
create table public.tbl_pm_links (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	venue_id    uuid not null references public.tbl_venues (id) on delete cascade,
	from_id     uuid not null references public.tbl_pm_items (id) on delete cascade,
	to_id       uuid not null references public.tbl_pm_items (id) on delete cascade,
	link_type   text not null check (link_type in ('waiting_on', 'blocks', 'related')),

	constraint tbl_pm_links_not_self check (from_id <> to_id),
	constraint tbl_pm_links_unique unique (from_id, to_id, link_type)
);

create index tbl_pm_links_from_idx on public.tbl_pm_links (from_id);
create index tbl_pm_links_to_idx   on public.tbl_pm_links (to_id);

-- ─── Guard: keep tasks consistent ───
-- A task's group, parent and person must be from the same venue (and the group and parent from the same track).
-- A task can't be moved under one of its own sub-tasks. updated_at/updated_by are filled in automatically.
create function private.tdc_pm_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_cursor uuid;
	v_depth  integer := 0;
begin
	if new.group_id is not null and not exists (
		select 1 from public.tbl_pm_groups g
		where g.id = new.group_id and g.venue_id = new.venue_id and g.track = new.track
	) then
		raise exception 'TDC (Error): that group belongs to a different venue or track.';
	end if;

	if new.person_id is not null and not exists (
		select 1 from public.tbl_pm_people p where p.id = new.person_id and p.venue_id = new.venue_id
	) then
		raise exception 'TDC (Error): that person belongs to a different venue.';
	end if;

	if new.parent_id is not null then
		if not exists (
			select 1 from public.tbl_pm_items i
			where i.id = new.parent_id and i.venue_id = new.venue_id and i.track = new.track
		) then
			raise exception 'TDC (Error): a sub-task must be in the same venue and track as its parent.';
		end if;

		-- Walk up from the new parent; meeting this task means the move would make a loop.
		v_cursor := new.parent_id;
		while v_cursor is not null loop
			if v_cursor = new.id then
				raise exception 'A task can''t be moved under one of its own sub-tasks.';
			end if;
			v_depth := v_depth + 1;
			if v_depth > 50 then
				raise exception 'TDC (Error): sub-tasks are nested too deeply (50 levels).';
			end if;
			select i.parent_id into v_cursor from public.tbl_pm_items i where i.id = v_cursor;
		end loop;
	end if;

	if tg_op = 'UPDATE' then
		new.created_at := old.created_at;
		new.created_by := old.created_by;
		new.updated_at := now();
		new.updated_by := (select auth.uid());
	else
		new.created_by := coalesce(new.created_by, (select auth.uid()));
		new.updated_by := new.created_by;
	end if;
	return new;
end;
$$;

create trigger tbl_pm_items_guard
	before insert or update on public.tbl_pm_items
	for each row execute function private.tdc_pm_items_guard();

-- Links must join two tasks of the link's own venue.
create function private.tdc_pm_links_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.from_id = new.to_id then
		raise exception 'A task can''t be linked to itself.';
	end if;
	if (select count(*) from public.tbl_pm_items i
	    where i.id in (new.from_id, new.to_id) and i.venue_id = new.venue_id) <> 2 then
		raise exception 'TDC (Error): a link must join two tasks from the same venue.';
	end if;
	return new;
end;
$$;

create trigger tbl_pm_links_guard
	before insert or update on public.tbl_pm_links
	for each row execute function private.tdc_pm_links_guard();

-- Moving a top-level task to another track (or a group between tracks) is not supported: it would strand sub-tasks.
create function private.tdc_pm_track_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.track <> old.track then
		raise exception 'Moving between Business and Website isn''t supported. Create the task in the other tab instead.';
	end if;
	return new;
end;
$$;

create trigger tbl_pm_items_track_locked
	before update of track on public.tbl_pm_items
	for each row execute function private.tdc_pm_track_locked();

create trigger tbl_pm_groups_track_locked
	before update of track on public.tbl_pm_groups
	for each row execute function private.tdc_pm_track_locked();

-- ─── Access rules: owners of the venue only ───
alter table public.tbl_pm_groups enable row level security;
alter table public.tbl_pm_people enable row level security;
alter table public.tbl_pm_items  enable row level security;
alter table public.tbl_pm_links  enable row level security;

create policy "Venue owners manage their board groups"
	on public.tbl_pm_groups for all to authenticated
	using (private.tdc_has_venue_role(venue_id, array['owner']))
	with check (private.tdc_has_venue_role(venue_id, array['owner']));

create policy "Venue owners manage their board people"
	on public.tbl_pm_people for all to authenticated
	using (private.tdc_has_venue_role(venue_id, array['owner']))
	with check (private.tdc_has_venue_role(venue_id, array['owner']));

create policy "Venue owners manage their board tasks"
	on public.tbl_pm_items for all to authenticated
	using (private.tdc_has_venue_role(venue_id, array['owner']))
	with check (private.tdc_has_venue_role(venue_id, array['owner']));

create policy "Venue owners manage their board links"
	on public.tbl_pm_links for all to authenticated
	using (private.tdc_has_venue_role(venue_id, array['owner']))
	with check (private.tdc_has_venue_role(venue_id, array['owner']));

grant select, insert, update, delete on public.tbl_pm_groups to authenticated;
grant select, insert, update, delete on public.tbl_pm_people to authenticated;
grant select, insert, update, delete on public.tbl_pm_items  to authenticated;
grant select, insert, update, delete on public.tbl_pm_links  to authenticated;

grant select, insert, update, delete on public.tbl_pm_groups to service_role;
grant select, insert, update, delete on public.tbl_pm_people to service_role;
grant select, insert, update, delete on public.tbl_pm_items  to service_role;
grant select, insert, update, delete on public.tbl_pm_links  to service_role;
