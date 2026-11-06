-- The title ladder (UV, 6 Nov; docs/design/points-and-tiers.md §6a).
--
-- 100 steps. A title has one step: from there up, a player may choose it. Each
-- group sets its own steps and a step can hold several titles (Space: Planet 20+,
-- Galaxy 40+, Universe 60+).
--
-- This is only the list UV edits on /staff/titles/. Nothing here says which step
-- a player is on or which title they chose, so no table refers to a player and
-- private.tdc_merge_players does not change.
--
-- The titles belong to the whole platform, so only an owner of The Dive Club may
-- read or change them (UV, 6 Nov). Players read nothing yet. No policy and no grant
-- to the browser: everything goes through the functions below.

create table public.tbl_title_groups (
	id uuid primary key default gen_random_uuid(),
	name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
	position integer not null,
	created_at timestamptz not null default now()
);

create unique index tbl_title_groups_name_key on public.tbl_title_groups (lower(name));

create table public.tbl_titles (
	id uuid primary key default gen_random_uuid(),
	group_id uuid not null references public.tbl_title_groups (id) on delete cascade,
	name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
	step integer not null check (step between 1 and 100),
	note text check (note is null or (note = btrim(note) and char_length(note) between 1 and 120)),
	created_at timestamptz not null default now()
);

create unique index tbl_titles_group_name_key on public.tbl_titles (group_id, lower(name));
create index tbl_titles_step_idx on public.tbl_titles (step);

alter table public.tbl_title_groups enable row level security;
alter table public.tbl_titles enable row level security;

grant select, insert, update, delete on public.tbl_title_groups to service_role;
grant select, insert, update, delete on public.tbl_titles to service_role;

-- The one place that decides who may touch the list.
create function private.tdc_can_edit_titles()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.tbl_venue_staff s
		join public.tbl_venues v on v.id = s.venue_id
		where v.slug = 'the-dive-club'
			and s.user_id = (select auth.uid())
			and s.role = 'owner'
	);
$$;

revoke execute on function private.tdc_can_edit_titles() from public, anon;
grant execute on function private.tdc_can_edit_titles() to authenticated;

-- For the staff hub's tile.
create function public.tdc_can_edit_titles()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_can_edit_titles();
$$;

revoke execute on function public.tdc_can_edit_titles() from public, anon;
grant execute on function public.tdc_can_edit_titles() to authenticated;

-- Everything the page draws.
create function public.tdc_title_ladder()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_edit_titles() then
		raise exception 'This page is for an owner of The Dive Club only.';
	end if;

	return jsonb_build_object(
		'groups', coalesce((
			select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.position, g.id)
			from public.tbl_title_groups g
		), '[]'::jsonb),
		'titles', coalesce((
			select jsonb_agg(jsonb_build_object('id', t.id, 'group_id', t.group_id, 'name', t.name, 'step', t.step, 'note', t.note) order by t.step, lower(t.name), t.id)
			from public.tbl_titles t
		), '[]'::jsonb)
	);
end;
$$;

revoke execute on function public.tdc_title_ladder() from public, anon;
grant execute on function public.tdc_title_ladder() to authenticated;

-- A new group (p_id null) goes last, or an existing one is renamed.
create function public.tdc_save_title_group(p_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name text := btrim(coalesce(p_name, ''));
	v_id uuid;
begin
	if not private.tdc_can_edit_titles() then
		raise exception 'Only an owner of The Dive Club may change the titles.';
	end if;
	if char_length(v_name) not between 1 and 40 then
		raise exception 'A group''s name must be 1 to 40 characters.';
	end if;
	if exists (
		select 1 from public.tbl_title_groups g
		where lower(g.name) = lower(v_name) and g.id is distinct from p_id
	) then
		raise exception 'There is already a group called %.', v_name;
	end if;

	if p_id is null then
		insert into public.tbl_title_groups (name, position)
		values (v_name, coalesce((select max(g.position) from public.tbl_title_groups g), 0) + 1)
		returning id into v_id;
	else
		update public.tbl_title_groups set name = v_name where id = p_id
		returning id into v_id;
		if v_id is null then
			raise exception 'That group is not on the list any more.';
		end if;
	end if;
	return v_id;
end;
$$;

revoke execute on function public.tdc_save_title_group(uuid, text) from public, anon;
grant execute on function public.tdc_save_title_group(uuid, text) to authenticated;

-- Its titles go with it.
create function public.tdc_delete_title_group(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_edit_titles() then
		raise exception 'Only an owner of The Dive Club may change the titles.';
	end if;
	delete from public.tbl_title_groups where id = p_id;
	if not found then
		raise exception 'That group is not on the list any more.';
	end if;
end;
$$;

revoke execute on function public.tdc_delete_title_group(uuid) from public, anon;
grant execute on function public.tdc_delete_title_group(uuid) to authenticated;

-- A new title (p_id null), or an existing one changed.
create function public.tdc_save_title(p_id uuid, p_group_id uuid, p_name text, p_step integer, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name text := btrim(coalesce(p_name, ''));
	v_note text := nullif(btrim(coalesce(p_note, '')), '');
	v_id uuid;
begin
	if not private.tdc_can_edit_titles() then
		raise exception 'Only an owner of The Dive Club may change the titles.';
	end if;
	if char_length(v_name) not between 1 and 60 then
		raise exception 'A title must be 1 to 60 characters.';
	end if;
	if p_step is null or p_step not between 1 and 100 then
		raise exception 'A title''s step must be from 1 to 100.';
	end if;
	if char_length(v_note) > 120 then
		raise exception 'A note can be at most 120 characters.';
	end if;
	if not exists (select 1 from public.tbl_title_groups g where g.id = p_group_id) then
		raise exception 'That group is not on the list any more.';
	end if;
	if exists (
		select 1 from public.tbl_titles t
		where t.group_id = p_group_id and lower(t.name) = lower(v_name) and t.id is distinct from p_id
	) then
		raise exception 'That group already has a title called %.', v_name;
	end if;

	if p_id is null then
		insert into public.tbl_titles (group_id, name, step, note)
		values (p_group_id, v_name, p_step, v_note)
		returning id into v_id;
	else
		update public.tbl_titles
		set group_id = p_group_id, name = v_name, step = p_step, note = v_note
		where id = p_id
		returning id into v_id;
		if v_id is null then
			raise exception 'That title is not on the list any more.';
		end if;
	end if;
	return v_id;
end;
$$;

revoke execute on function public.tdc_save_title(uuid, uuid, text, integer, text) from public, anon;
grant execute on function public.tdc_save_title(uuid, uuid, text, integer, text) to authenticated;

create function public.tdc_delete_title(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_edit_titles() then
		raise exception 'Only an owner of The Dive Club may change the titles.';
	end if;
	delete from public.tbl_titles where id = p_id;
	if not found then
		raise exception 'That title is not on the list any more.';
	end if;
end;
$$;

revoke execute on function public.tdc_delete_title(uuid) from public, anon;
grant execute on function public.tdc_delete_title(uuid) to authenticated;

-- Claude's draft list for UV to judge (UV, 6 Nov: start from it). Planet, Galaxy and
-- Universe are on UV's steps; Quark low and Space Emperor high are UV's ends; every
-- other step is a placeholder. From here on the list lives in these tables and is
-- changed on the page, not in a migration.
insert into public.tbl_title_groups (name, position) values
	('Space', 1),
	('Quarks', 2),
	('Size of things', 3),
	('Ocean depths', 4),
	('Speed', 5),
	('Planets', 6),
	('Stars', 7),
	('Civilisations', 8),
	('Number prefixes', 9),
	('Physicists', 10),
	('Elements', 11),
	('Hardness', 12),
	('Wind', 13),
	('Chilli heat', 14),
	('Acids', 15),
	('Sharks', 16),
	('African animals', 17),
	('Dinosaurs', 18),
	('Star Wars', 19),
	('Star Trek', 20),
	('Harry Potter', 21),
	('Lord of the Rings', 22),
	('The Godfather', 23),
	('The Matrix', 24),
	('Bond', 25),
	('Dune', 26),
	('Game of Thrones', 27),
	('Pokémon', 28),
	('The Office', 29),
	('Pool films', 30),
	('Superheroes', 31),
	('Marvel', 32),
	('Dragon Ball', 33),
	('Greek myth', 34),
	('Arthurian', 35),
	('Sherlock Holmes', 36),
	('Dante''s Inferno', 37),
	('Pirates', 38),
	('Three Little Pigs', 39),
	('Snooker balls', 40),
	('Pool slang', 41),
	('Pool brands', 42),
	('Pool legends', 43),
	('Boxing weights', 44),
	('Golf scores', 45),
	('Martial arts belts', 46),
	('Motorsport', 47),
	('Sports stars', 48),
	('Wine bottles', 49),
	('Alcohol strength', 50),
	('Coffee', 51),
	('Cars', 52),
	('Flight', 53),
	('Ships', 54),
	('Watches', 55),
	('Film stars', 56),
	('Military', 57),
	('Rome', 58),
	('Japan', 59),
	('Nobility', 60),
	('University', 61),
	('Chess', 62),
	('Poker hands', 63),
	('Music', 64);

insert into public.tbl_titles (group_id, name, step, note)
select g.id, v.title, v.step, v.note
from (values
	('Space', 'Planet', 20, null),
	('Space', 'Galaxy', 40, null),
	('Space', 'Universe', 60, null),
	('Space', 'Space Emperor', 100, null),
	('Quarks', 'Quark', 1, 'The smallest thing there is'),
	('Quarks', 'Up Quark', 3, 'Lightest of the six'),
	('Quarks', 'Down Quark', 6, null),
	('Quarks', 'Strange Quark', 8, null),
	('Quarks', 'Charm Quark', 10, null),
	('Quarks', 'Bottom Quark', 13, null),
	('Quarks', 'Top Quark', 15, 'Heaviest of the six'),
	('Size of things', 'Atom', 5, null),
	('Size of things', 'Cell', 15, null),
	('Size of things', 'Flea', 25, null),
	('Size of things', 'Human', 30, null),
	('Size of things', 'Everest', 40, null),
	('Size of things', 'Moon', 50, null),
	('Ocean depths', 'Sunlight Zone', 5, '0 m'),
	('Ocean depths', 'Twilight Zone', 15, '200 m'),
	('Ocean depths', 'Midnight Zone', 30, '1,000 m'),
	('Ocean depths', 'Titanic', 40, '3,800 m'),
	('Ocean depths', 'Abyssal Zone', 50, '4,000 m'),
	('Ocean depths', 'Hadal Zone', 65, '6,000 m'),
	('Ocean depths', 'Challenger Deep', 75, '10,900 m'),
	('Speed', 'Snail', 5, '0.05 km/h'),
	('Speed', 'Sprinter', 20, '45 km/h'),
	('Speed', 'Cheetah', 35, '100 km/h'),
	('Speed', 'Peregrine Falcon', 50, '390 km/h'),
	('Speed', 'Speed of Sound', 60, '1,235 km/h'),
	('Speed', 'Voyager 1', 75, '61,000 km/h'),
	('Speed', 'Speed of Light', 90, '1 billion km/h'),
	('Planets', 'Mercury', 10, '4,900 km wide'),
	('Planets', 'Mars', 15, '6,800 km wide'),
	('Planets', 'Venus', 25, '12,100 km wide'),
	('Planets', 'Earth', 30, '12,800 km wide'),
	('Planets', 'Neptune', 35, '49,200 km wide'),
	('Planets', 'Uranus', 40, '50,700 km wide'),
	('Planets', 'Saturn', 50, '116,500 km wide'),
	('Planets', 'Jupiter', 55, '139,800 km wide'),
	('Stars', 'Brown Dwarf', 30, null),
	('Stars', 'Red Dwarf', 40, null),
	('Stars', 'Sun', 50, null),
	('Stars', 'Blue Giant', 60, null),
	('Stars', 'Red Supergiant', 65, null),
	('Stars', 'Neutron Star', 75, null),
	('Stars', 'Black Hole', 85, null),
	('Stars', 'Quasar', 95, null),
	('Civilisations', 'Type 0', 40, 'Kardashev scale: us'),
	('Civilisations', 'Planetary', 60, 'Type I'),
	('Civilisations', 'Stellar', 75, 'Type II'),
	('Civilisations', 'Galactic', 95, 'Type III'),
	('Number prefixes', 'Kilo', 10, '10³'),
	('Number prefixes', 'Mega', 20, '10⁶'),
	('Number prefixes', 'Giga', 30, '10⁹'),
	('Number prefixes', 'Tera', 35, '10¹²'),
	('Number prefixes', 'Peta', 45, '10¹⁵'),
	('Number prefixes', 'Exa', 55, '10¹⁸'),
	('Number prefixes', 'Zetta', 65, '10²¹'),
	('Number prefixes', 'Yotta', 70, '10²⁴'),
	('Number prefixes', 'Ronna', 80, '10²⁷'),
	('Number prefixes', 'Quetta', 90, '10³⁰'),
	('Physicists', 'Newton', 25, null),
	('Physicists', 'Curie', 35, null),
	('Physicists', 'Einstein', 45, null),
	('Physicists', 'Bohr', 55, null),
	('Physicists', 'Heisenberg', 65, null),
	('Physicists', 'Feynman', 75, null),
	('Physicists', 'Hawking', 85, null),
	('Elements', 'Hydrogen', 5, 'Atomic number 1'),
	('Elements', 'Helium', 20, 'Atomic number 2'),
	('Elements', 'Carbon', 30, 'Atomic number 6'),
	('Elements', 'Iron', 45, 'Atomic number 26'),
	('Elements', 'Silver', 55, 'Atomic number 47'),
	('Elements', 'Gold', 70, 'Atomic number 79'),
	('Elements', 'Uranium', 80, 'Atomic number 92'),
	('Elements', 'Oganesson', 95, 'Atomic number 118'),
	('Hardness', 'Talc', 5, 'Mohs 1'),
	('Hardness', 'Gypsum', 10, 'Mohs 2'),
	('Hardness', 'Calcite', 15, 'Mohs 3'),
	('Hardness', 'Fluorite', 25, 'Mohs 4'),
	('Hardness', 'Apatite', 30, 'Mohs 5'),
	('Hardness', 'Orthoclase', 35, 'Mohs 6'),
	('Hardness', 'Quartz', 40, 'Mohs 7'),
	('Hardness', 'Topaz', 50, 'Mohs 8'),
	('Hardness', 'Corundum', 55, 'Mohs 9'),
	('Hardness', 'Diamond', 60, 'Mohs 10'),
	('Wind', 'Calm', 5, 'Beaufort 0'),
	('Wind', 'Light Air', 15, 'Beaufort 1'),
	('Wind', 'Breeze', 25, 'Beaufort 3'),
	('Wind', 'Gale', 30, 'Beaufort 8'),
	('Wind', 'Storm', 40, 'Beaufort 10'),
	('Wind', 'Hurricane Force', 50, 'Beaufort 12'),
	('Chilli heat', 'Bell Pepper', 5, '0 Scoville'),
	('Chilli heat', 'Jalapeño', 20, '5,000 Scoville'),
	('Chilli heat', 'Habanero', 40, '300,000 Scoville'),
	('Chilli heat', 'Carolina Reaper', 55, '1.6 million Scoville'),
	('Chilli heat', 'Pepper X', 70, '2.7 million Scoville'),
	('Acids', 'Water', 10, 'pH 7'),
	('Acids', 'Black Coffee', 20, 'pH 5'),
	('Acids', 'Vinegar', 30, 'pH 2.5'),
	('Acids', 'Lemon', 40, 'pH 2'),
	('Acids', 'Stomach Acid', 50, 'pH 1.5'),
	('Acids', 'Battery Acid', 60, 'pH 0.5'),
	('Sharks', 'Dwarf Lanternshark', 15, '20 cm'),
	('Sharks', 'Hammerhead', 30, '4 m'),
	('Sharks', 'Tiger Shark', 45, '5 m'),
	('Sharks', 'Great White', 55, '6 m'),
	('Sharks', 'Megalodon', 70, '15 m or more'),
	('African animals', 'Dung Beetle', 5, null),
	('African animals', 'Meerkat', 15, null),
	('African animals', 'Springbok', 25, null),
	('African animals', 'Hyena', 35, null),
	('African animals', 'Leopard', 45, null),
	('African animals', 'Rhino', 55, null),
	('African animals', 'Elephant', 65, null),
	('African animals', 'Lion', 75, null),
	('Dinosaurs', 'Compsognathus', 15, null),
	('Dinosaurs', 'Velociraptor', 30, null),
	('Dinosaurs', 'Triceratops', 45, null),
	('Dinosaurs', 'T. rex', 55, null),
	('Dinosaurs', 'Argentinosaurus', 70, null),
	('Star Wars', 'Youngling', 15, null),
	('Star Wars', 'Padawan', 35, null),
	('Star Wars', 'Jedi Knight', 55, null),
	('Star Wars', 'Jedi Master', 70, null),
	('Star Wars', 'Grand Master', 90, null),
	('Star Trek', 'Ensign', 15, null),
	('Star Trek', 'First Officer', 40, null),
	('Star Trek', 'Starfleet Captain', 70, null),
	('Star Trek', 'Q', 95, null),
	('Harry Potter', 'Muggle', 5, null),
	('Harry Potter', 'First Year', 25, null),
	('Harry Potter', 'Prefect', 45, null),
	('Harry Potter', 'Auror', 65, null),
	('Harry Potter', 'Headmaster', 85, null),
	('Lord of the Rings', 'Hobbit', 10, null),
	('Lord of the Rings', 'Ranger', 30, null),
	('Lord of the Rings', 'Elf Lord', 50, null),
	('Lord of the Rings', 'Wizard', 70, null),
	('Lord of the Rings', 'Ring-bearer', 90, null),
	('The Godfather', 'Associate', 20, null),
	('The Godfather', 'Soldier', 35, null),
	('The Godfather', 'Capo', 55, null),
	('The Godfather', 'Underboss', 70, null),
	('The Godfather', 'Don', 85, null),
	('The Matrix', 'Bluepill', 10, null),
	('The Matrix', 'Redpill', 30, null),
	('The Matrix', 'Operator', 50, null),
	('The Matrix', 'Agent', 70, null),
	('The Matrix', 'The One', 90, null),
	('Bond', 'Moneypenny', 30, null),
	('Bond', 'Double-O Agent', 55, null),
	('Bond', 'M', 80, null),
	('Dune', 'Fremen', 25, null),
	('Dune', 'Naib', 50, null),
	('Dune', 'Mentat', 70, null),
	('Dune', 'Kwisatz Haderach', 95, null),
	('Game of Thrones', 'Smallfolk', 10, null),
	('Game of Thrones', 'Lord', 35, null),
	('Game of Thrones', 'Hand of the King', 65, null),
	('Game of Thrones', 'Iron Throne', 90, null),
	('Pokémon', 'Trainer', 10, null),
	('Pokémon', 'Gym Leader', 30, null),
	('Pokémon', 'Elite Four', 55, null),
	('Pokémon', 'Champion', 75, null),
	('The Office', 'Intern', 5, null),
	('The Office', 'Assistant to the Regional Manager', 30, null),
	('The Office', 'Regional Manager', 55, null),
	('Pool films', 'Felson', 40, 'The Hustler, The Color of Money'),
	('Pool films', 'Minnesota Fats', 70, 'The Hustler'),
	('Superheroes', 'Robin', 20, null),
	('Superheroes', 'Batman', 40, null),
	('Superheroes', 'Wonder Woman', 65, null),
	('Superheroes', 'Superman', 85, null),
	('Marvel', 'Sidekick', 15, null),
	('Marvel', 'Avenger', 25, null),
	('Marvel', 'Space Stone', 35, null),
	('Marvel', 'Mind Stone', 45, null),
	('Marvel', 'Reality Stone', 55, null),
	('Marvel', 'Power Stone', 65, null),
	('Marvel', 'Time Stone', 75, null),
	('Marvel', 'Soul Stone', 85, null),
	('Marvel', 'The Gauntlet', 95, null),
	('Dragon Ball', 'Earthling', 15, null),
	('Dragon Ball', 'Saiyan', 40, null),
	('Dragon Ball', 'Super Saiyan', 65, null),
	('Dragon Ball', 'Ultra Instinct', 90, null),
	('Greek myth', 'Mortal', 5, null),
	('Greek myth', 'Hero', 30, null),
	('Greek myth', 'Titan', 50, null),
	('Greek myth', 'Olympian', 75, null),
	('Greek myth', 'Zeus', 95, null),
	('Arthurian', 'Page', 5, null),
	('Arthurian', 'Squire', 25, null),
	('Arthurian', 'Round Table', 50, null),
	('Arthurian', 'Merlin', 70, null),
	('Arthurian', 'Pendragon', 90, null),
	('Sherlock Holmes', 'Irregular', 10, null),
	('Sherlock Holmes', 'Lestrade', 25, null),
	('Sherlock Holmes', 'Watson', 40, null),
	('Sherlock Holmes', 'Sherlock', 55, null),
	('Sherlock Holmes', 'Moriarty', 70, null),
	('Sherlock Holmes', 'Mycroft', 85, null),
	('Dante''s Inferno', 'Limbo', 10, 'Circle 1'),
	('Dante''s Inferno', 'Lust', 20, 'Circle 2'),
	('Dante''s Inferno', 'Gluttony', 30, 'Circle 3'),
	('Dante''s Inferno', 'Greed', 40, 'Circle 4'),
	('Dante''s Inferno', 'Wrath', 50, 'Circle 5'),
	('Dante''s Inferno', 'Heresy', 60, 'Circle 6'),
	('Dante''s Inferno', 'Violence', 70, 'Circle 7'),
	('Dante''s Inferno', 'Fraud', 80, 'Circle 8'),
	('Dante''s Inferno', 'Treachery', 90, 'Circle 9'),
	('Pirates', 'Cabin Boy', 5, null),
	('Pirates', 'Deckhand', 25, null),
	('Pirates', 'Bosun', 45, null),
	('Pirates', 'Quartermaster', 60, null),
	('Pirates', 'Pirate King', 80, null),
	('Three Little Pigs', 'Straw', 5, null),
	('Three Little Pigs', 'Sticks', 15, null),
	('Three Little Pigs', 'Bricks', 25, null),
	('Snooker balls', 'Red', 10, '1 point'),
	('Snooker balls', 'Yellow', 20, '2 points'),
	('Snooker balls', 'Green', 30, '3 points'),
	('Snooker balls', 'Brown', 40, '4 points'),
	('Snooker balls', 'Blue', 50, '5 points'),
	('Snooker balls', 'Pink', 60, '6 points'),
	('Snooker balls', 'Black', 70, '7 points'),
	('Pool slang', 'Fish', 1, null),
	('Pool slang', 'Banger', 15, null),
	('Pool slang', 'Rookie', 30, null),
	('Pool slang', 'Hustler', 40, null),
	('Pool slang', 'Road Player', 55, null),
	('Pool slang', 'Shark', 70, null),
	('Pool brands', 'Cuetec', 15, null),
	('Pool brands', 'Viking', 30, null),
	('Pool brands', 'Lucasi', 40, null),
	('Pool brands', 'McDermott', 55, null),
	('Pool brands', 'Mezz', 65, null),
	('Pool brands', 'Predator', 80, null),
	('Pool brands', 'Balabushka', 90, null),
	('Pool legends', 'Lee', 50, null),
	('Pool legends', 'Davis', 60, null),
	('Pool legends', 'Strickland', 70, null),
	('Pool legends', 'Van Boening', 80, null),
	('Pool legends', 'Mosconi', 90, null),
	('Pool legends', 'Reyes', 100, null),
	('Boxing weights', 'Strawweight', 10, '47 kg'),
	('Boxing weights', 'Flyweight', 20, '51 kg'),
	('Boxing weights', 'Bantamweight', 25, '53 kg'),
	('Boxing weights', 'Featherweight', 35, '57 kg'),
	('Boxing weights', 'Lightweight', 45, '61 kg'),
	('Boxing weights', 'Welterweight', 55, '67 kg'),
	('Boxing weights', 'Middleweight', 60, '72 kg'),
	('Boxing weights', 'Heavyweight', 70, '90 kg or more'),
	('Golf scores', 'Bogey', 10, '1 over par'),
	('Golf scores', 'Par', 25, 'Level'),
	('Golf scores', 'Birdie', 35, '1 under'),
	('Golf scores', 'Eagle', 50, '2 under'),
	('Golf scores', 'Albatross', 60, '3 under'),
	('Golf scores', 'Condor', 75, '4 under'),
	('Martial arts belts', 'White Belt', 5, null),
	('Martial arts belts', 'Yellow Belt', 20, null),
	('Martial arts belts', 'Green Belt', 30, null),
	('Martial arts belts', 'Blue Belt', 45, null),
	('Martial arts belts', 'Brown Belt', 55, null),
	('Martial arts belts', 'Black Belt', 70, null),
	('Motorsport', 'Karting', 10, null),
	('Motorsport', 'Formula 3', 30, null),
	('Motorsport', 'Formula 2', 50, null),
	('Motorsport', 'Formula 1', 70, null),
	('Motorsport', 'World Champion', 90, null),
	('Sports stars', 'Pienaar', 40, 'Rugby'),
	('Sports stars', 'Kolisi', 50, 'Rugby'),
	('Sports stars', 'Messi', 60, 'Football'),
	('Sports stars', 'Federer', 70, 'Tennis'),
	('Sports stars', 'Bolt', 75, 'Athletics'),
	('Sports stars', 'Serena', 85, 'Tennis'),
	('Sports stars', 'Ali', 95, 'Boxing'),
	('Wine bottles', 'Piccolo', 10, '187 ml'),
	('Wine bottles', 'Standard', 25, '750 ml'),
	('Wine bottles', 'Magnum', 35, '1.5 L'),
	('Wine bottles', 'Jeroboam', 50, '3 L'),
	('Wine bottles', 'Methuselah', 65, '6 L'),
	('Wine bottles', 'Balthazar', 75, '12 L'),
	('Wine bottles', 'Nebuchadnezzar', 90, '15 L'),
	('Alcohol strength', 'Beer', 10, '5%'),
	('Alcohol strength', 'Wine', 25, '13%'),
	('Alcohol strength', 'Port', 40, '20%'),
	('Alcohol strength', 'Whisky', 50, '40%'),
	('Alcohol strength', 'Absinthe', 65, '70%'),
	('Alcohol strength', 'Spirytus', 80, '96%'),
	('Coffee', 'Decaf', 5, null),
	('Coffee', 'Flat White', 15, null),
	('Coffee', 'Filter', 30, null),
	('Coffee', 'Espresso', 40, null),
	('Coffee', 'Double Espresso', 50, null),
	('Cars', 'Citi Golf', 10, null),
	('Cars', 'Golf GTI', 25, null),
	('Cars', 'Porsche 911', 40, null),
	('Cars', 'Ferrari', 60, null),
	('Cars', 'McLaren F1', 75, null),
	('Cars', 'Bugatti Chiron', 90, null),
	('Flight', 'Paper Plane', 5, null),
	('Flight', 'Cessna', 20, null),
	('Flight', 'Boeing 747', 40, null),
	('Flight', 'Concorde', 55, null),
	('Flight', 'SR-71', 75, null),
	('Flight', 'Saturn V', 90, null),
	('Ships', 'Dinghy', 5, null),
	('Ships', 'Yacht', 25, null),
	('Ships', 'Cruise Liner', 50, null),
	('Ships', 'Aircraft Carrier', 70, null),
	('Ships', 'Death Star', 90, null),
	('Watches', 'Casio', 15, null),
	('Watches', 'Seiko', 35, null),
	('Watches', 'Omega', 50, null),
	('Watches', 'Rolex', 70, null),
	('Watches', 'Patek Philippe', 85, null),
	('Film stars', 'Pitt', 40, null),
	('Film stars', 'Clooney', 50, null),
	('Film stars', 'DiCaprio', 60, null),
	('Film stars', 'De Niro', 70, null),
	('Film stars', 'Streep', 80, null),
	('Military', 'Cadet', 5, null),
	('Military', 'Private', 15, null),
	('Military', 'Corporal', 25, null),
	('Military', 'Sergeant', 35, null),
	('Military', 'Lieutenant', 45, null),
	('Military', 'Major', 55, null),
	('Military', 'Commander', 65, null),
	('Military', 'Colonel', 75, null),
	('Military', 'General', 85, null),
	('Military', 'Admiral', 95, null),
	('Rome', 'Legionary', 15, null),
	('Rome', 'Centurion', 35, null),
	('Rome', 'Legate', 55, null),
	('Rome', 'Consul', 70, null),
	('Rome', 'Caesar', 90, null),
	('Japan', 'Ronin', 20, null),
	('Japan', 'Samurai', 40, null),
	('Japan', 'Daimyo', 65, null),
	('Japan', 'Shogun', 85, null),
	('Nobility', 'Baron', 30, null),
	('Nobility', 'Viscount', 40, null),
	('Nobility', 'Earl', 50, null),
	('Nobility', 'Duke', 65, null),
	('Nobility', 'Prince', 75, null),
	('Nobility', 'King', 85, null),
	('Nobility', 'Emperor', 95, null),
	('University', 'Student', 5, null),
	('University', 'Bachelor', 20, null),
	('University', 'Master', 40, null),
	('University', 'Doctor', 55, null),
	('University', 'Professor', 75, null),
	('University', 'Nobel Laureate', 90, null),
	('Chess', 'Pawn', 5, null),
	('Chess', 'Knight', 20, null),
	('Chess', 'Bishop', 35, null),
	('Chess', 'Rook', 50, null),
	('Chess', 'Queen', 60, null),
	('Chess', 'FIDE Master', 75, null),
	('Chess', 'Grandmaster', 90, null),
	('Poker hands', 'High Card', 5, null),
	('Poker hands', 'Pair', 15, null),
	('Poker hands', 'Two Pair', 25, null),
	('Poker hands', 'Three of a Kind', 35, null),
	('Poker hands', 'Straight', 45, null),
	('Poker hands', 'Flush', 50, null),
	('Poker hands', 'Full House', 60, null),
	('Poker hands', 'Four of a Kind', 70, null),
	('Poker hands', 'Straight Flush', 80, null),
	('Poker hands', 'Royal Flush', 90, null),
	('Music', 'Busker', 10, null),
	('Music', 'Session Player', 30, null),
	('Music', 'Headliner', 50, null),
	('Music', 'Stadium Act', 65, null),
	('Music', 'Hall of Famer', 85, null)
) as v (group_name, title, step, note)
join public.tbl_title_groups g on g.name = v.group_name;
