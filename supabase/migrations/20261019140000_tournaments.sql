-- Tournaments: the competition itself, who runs it, and who is in it.
--
-- The governing requirement, from UV: **a tournament director must be able to
-- run the whole thing alone.** Players filling in their own scores is a
-- convenience, not the path. Plenty of entrants will never open the app, and a
-- TD at a club night will be entering results from a scoresheet on the bar.
--
-- That shapes everything here:
--   - An entrant is a player record, which may be a walk-in with no account.
--     Nobody has to sign up to be in a tournament.
--   - The TD's powers are not corrections bolted onto a player-first flow; they
--     are the primary way a tournament is run.
--   - Entry status and payment live on the entrant, because the TD's entrant
--     list is the screen they actually work from.
--
-- What is deliberately NOT here: rounds, brackets and progression. The format
-- is stored as one choice and the draw is generated later, as its own step.
-- Setup captures identity, rules and entrants; none of those depend on whether
-- the draw is single elimination or groups. Building them separately is what
-- lets the setup page exist before any bracket generator does.

-- ─────────────────────────────────────────────────────────────────
-- Roles, with a rank rather than an enum
--
-- Per the design note: a lookup table with a rank number, not a check
-- constraint, so "outranks" is a comparison rather than a chain of ifs, and a
-- new role does not need a migration against every function that tests for one.
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_competition_role_types (
	key   text primary key,
	name  text not null,
	rank  integer not null unique
);

insert into public.tbl_competition_role_types (key, name, rank) values
	('director', 'Tournament director', 100),
	('referee',  'Referee',              50),
	('scorer',   'Scorer',               30);

alter table public.tbl_competition_role_types enable row level security;

create policy "Signed-in users can see role types"
	on public.tbl_competition_role_types for select to authenticated using (true);

grant select on public.tbl_competition_role_types to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The tournament
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_tournaments (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	created_by  uuid references auth.users (id) on delete set null,

	-- Nullable on purpose: anyone may run a tournament without a club behind
	-- them. An approved club gets branding and venue-scoped features; the tier
	-- falls out of this column being empty or not.
	venue_id    uuid references public.tbl_venues (id) on delete set null,

	name        text not null check (char_length(trim(name)) between 2 and 120),

	-- Stored, not acted on yet. The draw generator reads it when it exists.
	format      text not null default 'single_elimination'
		check (format in ('single_elimination', 'double_elimination', 'round_robin', 'groups_knockout')),

	status      text not null default 'draft'
		check (status in ('draft', 'open', 'in_progress', 'complete', 'cancelled')),

	-- The default ruleset entrant matches inherit and freeze at creation.
	-- Validated by the same function the match page uses, so a tournament
	-- cannot hold a ruleset a match would refuse.
	rules       jsonb not null,

	starts_at   timestamptz,
	max_entrants integer check (max_entrants is null or max_entrants between 2 and 1024),

	-- Credits, matching the existing ledger's unit. 0 means free to enter.
	entry_fee_credits integer not null default 0 check (entry_fee_credits >= 0),

	-- An authorisation fact, never a ruleset key — the ruleset must not be able
	-- to promote a tournament to counting for ranking.
	sanctioned  boolean not null default false,

	notes       text
);

create index tbl_tournaments_venue_idx  on public.tbl_tournaments (venue_id);
create index tbl_tournaments_starts_idx on public.tbl_tournaments (starts_at desc);

alter table public.tbl_tournaments enable row level security;

create policy "Signed-in users can see tournaments"
	on public.tbl_tournaments for select to authenticated using (true);

grant select on public.tbl_tournaments to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Who runs it
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_competition_roles (
	id            uuid primary key default gen_random_uuid(),
	created_at    timestamptz not null default now(),
	created_by    uuid references auth.users (id) on delete set null,

	-- One of these is set. A league season gets its own column here when
	-- leagues land, which is why this is not called tournament_role.
	tournament_id uuid references public.tbl_tournaments (id) on delete cascade,

	player_id     uuid not null references public.tbl_players (id) on delete cascade,
	role          text not null references public.tbl_competition_role_types (key),

	constraint tbl_competition_roles_belongs_somewhere check (tournament_id is not null),
	constraint tbl_competition_roles_one_each unique (tournament_id, player_id, role)
);

create index tbl_competition_roles_player_idx on public.tbl_competition_roles (player_id);

alter table public.tbl_competition_roles enable row level security;

create policy "Signed-in users can see who runs a competition"
	on public.tbl_competition_roles for select to authenticated using (true);

grant select on public.tbl_competition_roles to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Who is in it
--
-- player_id, not user_id: a walk-in is a player record with no account, and a
-- tournament full of people who have never used the app is the normal case.
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_tournament_entrants (
	id            uuid primary key default gen_random_uuid(),
	created_at    timestamptz not null default now(),
	added_by      uuid references auth.users (id) on delete set null,

	tournament_id uuid not null references public.tbl_tournaments (id) on delete cascade,
	player_id     uuid not null references public.tbl_players (id) on delete cascade,

	status        text not null default 'interested'
		check (status in ('interested', 'confirmed', 'withdrawn')),

	-- When they paid, not whether: the time answers both questions and is the
	-- thing a TD is asked about. The ledger entry that charged them links back
	-- here once tbl_credit_ledger carries ref_table / ref_id.
	paid_at       timestamptz,

	-- The draw order. Null until seeded; a re-seed rewrites them.
	seed          integer check (seed is null or seed > 0),

	notes         text,

	constraint tbl_tournament_entrants_once unique (tournament_id, player_id)
);

create index tbl_tournament_entrants_player_idx on public.tbl_tournament_entrants (player_id);
create index tbl_tournament_entrants_seed_idx   on public.tbl_tournament_entrants (tournament_id, seed);

alter table public.tbl_tournament_entrants enable row level security;

create policy "Signed-in users can see who entered"
	on public.tbl_tournament_entrants for select to authenticated using (true);

grant select on public.tbl_tournament_entrants to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Access
--
-- The single place that decides whether somebody runs a competition, in the
-- same spirit as private.tdc_can_edit_match. Everything that needs a TD asks
-- this, so adding league seasons later is one edit.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_competition_rank(p_tournament_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(max(t.rank), 0)
	from public.tbl_competition_roles r
	join public.tbl_competition_role_types t on t.key = r.role
	join public.tbl_players p on p.id = r.player_id
	where r.tournament_id = p_tournament_id
		and p.user_id = (select auth.uid());
$$;

revoke execute on function private.tdc_competition_rank(uuid) from public, anon;
grant execute on function private.tdc_competition_rank(uuid) to authenticated;


-- Running it: the director, or venue staff where the tournament belongs to a
-- venue. Venue staff are included because a club night's TD is often whoever
-- is behind the bar, and because a club must be able to rescue a tournament
-- whose director has gone home.
create function private.tdc_can_run_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_competition_rank(p_tournament_id) >= 100
		or exists (
			select 1 from public.tbl_tournaments t
			where t.id = p_tournament_id
				and t.venue_id is not null
				and private.tdc_has_venue_role(t.venue_id, array['owner', 'admin', 'staff'])
		);
$$;

revoke execute on function private.tdc_can_run_tournament(uuid) from public, anon;
grant execute on function private.tdc_can_run_tournament(uuid) to authenticated;


create function public.tdc_may_run_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.tdc_can_run_tournament(p_tournament_id); $$;

revoke execute on function public.tdc_may_run_tournament(uuid) from public, anon;
grant execute on function public.tdc_may_run_tournament(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Creating and changing a tournament
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_create_tournament(
	p_name              text,
	p_rules             jsonb,
	p_format            text default 'single_elimination',
	p_venue_id          uuid default null,
	p_starts_at         timestamptz default null,
	p_max_entrants      integer default null,
	p_entry_fee_credits integer default 0
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

	insert into public.tbl_tournaments
		(created_by, venue_id, name, format, rules, starts_at, max_entrants, entry_fee_credits)
	values
		((select auth.uid()), p_venue_id, trim(p_name), p_format, p_rules,
		 p_starts_at, p_max_entrants, coalesce(p_entry_fee_credits, 0))
	returning id into v_id;

	-- Whoever made it runs it, or nobody does and it cannot be changed.
	insert into public.tbl_competition_roles (created_by, tournament_id, player_id, role)
	values ((select auth.uid()), v_id, v_me, 'director');

	return v_id;
end;
$$;

revoke execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer) from public, anon;
grant execute on function public.tdc_create_tournament(text, jsonb, text, uuid, timestamptz, integer, integer) to authenticated;


create function public.tdc_update_tournament(
	p_tournament_id     uuid,
	p_name              text default null,
	p_rules             jsonb default null,
	p_format            text default null,
	p_status            text default null,
	p_starts_at         timestamptz default null,
	p_clear_starts_at   boolean default false,
	p_max_entrants      integer default null,
	p_entry_fee_credits integer default null,
	p_notes             text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_tournaments%rowtype;
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

	-- Changing the format after a draw exists would leave matches wired to a
	-- shape that no longer applies. Rounds do not exist yet, so this guard is
	-- written now and tightened when they do.
	if p_format is not null and p_format <> v_t.format and v_t.status <> 'draft' then
		raise exception 'The format can only be changed while the tournament is still a draft.';
	end if;

	update public.tbl_tournaments
	set name              = coalesce(trim(p_name), name),
		rules             = coalesce(p_rules, rules),
		format            = coalesce(p_format, format),
		status            = coalesce(p_status, status),
		starts_at         = case when p_clear_starts_at then null else coalesce(p_starts_at, starts_at) end,
		max_entrants      = coalesce(p_max_entrants, max_entrants),
		entry_fee_credits = coalesce(p_entry_fee_credits, entry_fee_credits),
		notes             = coalesce(p_notes, notes)
	where id = p_tournament_id;
end;
$$;

revoke execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text) from public, anon;
grant execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Entrants
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_add_entrant(
	p_tournament_id uuid,
	p_player_id     uuid,
	p_status        text default 'interested'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t     public.tbl_tournaments%rowtype;
	v_count integer;
	v_id    uuid;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can add entrants.';
	end if;

	if not exists (select 1 from public.tbl_players where id = p_player_id) then
		raise exception 'TDC (Error): no player with id %.', p_player_id;
	end if;

	-- Withdrawn entrants do not take up a place.
	select count(*) into v_count
	from public.tbl_tournament_entrants
	where tournament_id = p_tournament_id and status <> 'withdrawn';

	if v_t.max_entrants is not null and v_count >= v_t.max_entrants then
		raise exception 'This tournament is full (% of %).', v_count, v_t.max_entrants;
	end if;

	insert into public.tbl_tournament_entrants (added_by, tournament_id, player_id, status)
	values ((select auth.uid()), p_tournament_id, p_player_id, p_status)
	on conflict (tournament_id, player_id) do update
		set status = excluded.status
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_add_entrant(uuid, uuid, text) from public, anon;
grant execute on function public.tdc_add_entrant(uuid, uuid, text) to authenticated;


create function public.tdc_set_entrant(
	p_entrant_id uuid,
	p_status     text default null,
	p_paid       boolean default null,
	p_seed       integer default null,
	p_clear_seed boolean default false,
	p_notes      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tournament uuid;
begin
	select tournament_id into v_tournament
	from public.tbl_tournament_entrants where id = p_entrant_id;

	if v_tournament is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_tournament(v_tournament) then
		raise exception 'Only the people running this tournament can change entrants.';
	end if;

	update public.tbl_tournament_entrants
	set status  = coalesce(p_status, status),
		paid_at = case
			when p_paid is null then paid_at
			when p_paid then coalesce(paid_at, now())
			else null
		end,
		seed    = case when p_clear_seed then null else coalesce(p_seed, seed) end,
		notes   = coalesce(p_notes, notes)
	where id = p_entrant_id;
end;
$$;

revoke execute on function public.tdc_set_entrant(uuid, text, boolean, integer, boolean, text) from public, anon;
grant execute on function public.tdc_set_entrant(uuid, text, boolean, integer, boolean, text) to authenticated;


create function public.tdc_remove_entrant(p_entrant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tournament uuid;
begin
	select tournament_id into v_tournament
	from public.tbl_tournament_entrants where id = p_entrant_id;

	if v_tournament is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_tournament(v_tournament) then
		raise exception 'Only the people running this tournament can remove entrants.';
	end if;

	-- Once a draw exists this will have to refuse, or withdraw instead, rather
	-- than leaving a match pointing at nobody. Rounds do not exist yet.
	delete from public.tbl_tournament_entrants where id = p_entrant_id;
end;
$$;

revoke execute on function public.tdc_remove_entrant(uuid) from public, anon;
grant execute on function public.tdc_remove_entrant(uuid) to authenticated;


-- Seeding in one call: hand-ordered, or shuffled by the page and sent here.
-- One call rather than one per entrant, because a re-seed moves everybody and
-- half a re-seed is a draw nobody can read.
create function public.tdc_set_seeds(p_tournament_id uuid, p_order uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_n integer;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can seed it.';
	end if;

	if p_order is null or array_length(p_order, 1) is null then
		update public.tbl_tournament_entrants set seed = null where tournament_id = p_tournament_id;
		return 0;
	end if;

	if exists (
		select 1 from unnest(p_order) e(id)
		where not exists (
			select 1 from public.tbl_tournament_entrants t
			where t.id = e.id and t.tournament_id = p_tournament_id
		)
	) then
		raise exception 'TDC (Error): that seeding list names an entrant who is not in this tournament.';
	end if;

	-- Everyone not named loses their seed, so the list is the whole order
	-- rather than a patch on top of an older one.
	update public.tbl_tournament_entrants set seed = null where tournament_id = p_tournament_id;

	with ordered as (
		select id, ord from unnest(p_order) with ordinality as u(id, ord)
	)
	update public.tbl_tournament_entrants t
	set seed = o.ord
	from ordered o
	where t.id = o.id;

	get diagnostics v_n = row_count;
	return v_n;
end;
$$;

revoke execute on function public.tdc_set_seeds(uuid, uuid[]) from public, anon;
grant execute on function public.tdc_set_seeds(uuid, uuid[]) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Reading
-- ─────────────────────────────────────────────────────────────────

-- The TD's entrant list, which is the screen a tournament is actually run
-- from. One call: names, status, paid and seed together, because asking for
-- each separately is a request per row on a page that shows thirty.
create function public.tdc_tournament_entrants(p_tournament_id uuid)
returns table (
	entrant_id   uuid,
	player_id    uuid,
	display_name text,
	first_name   text,
	last_name    text,
	player_type  text,
	has_account  boolean,
	status       text,
	paid         boolean,
	seed         integer,
	notes        text
)
language sql
stable
security definer
set search_path = ''
as $$
	select e.id, p.id, p.display_name, p.first_name, p.last_name, p.player_type,
		p.user_id is not null, e.status, e.paid_at is not null, e.seed, e.notes
	from public.tbl_tournament_entrants e
	join public.tbl_players p on p.id = e.player_id
	where e.tournament_id = p_tournament_id
	order by e.seed nulls last, p.display_name;
$$;

revoke execute on function public.tdc_tournament_entrants(uuid) from public, anon;
grant execute on function public.tdc_tournament_entrants(uuid) to authenticated;


-- Tournaments this account runs or is entered in, newest first.
create function public.tdc_my_tournaments(p_limit integer default 50)
returns table (
	id           uuid,
	name         text,
	format       text,
	status       text,
	starts_at    timestamptz,
	venue_name   text,
	entrants     integer,
	i_run_it     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select t.id, t.name, t.format, t.status, t.starts_at, v.name,
		(select count(*)::integer from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.status <> 'withdrawn'),
		private.tdc_can_run_tournament(t.id)
	from public.tbl_tournaments t
	left join public.tbl_venues v on v.id = t.venue_id
	where (select id from me) is not null
		and (
			private.tdc_can_run_tournament(t.id)
			or exists (
				select 1 from public.tbl_tournament_entrants e
				where e.tournament_id = t.id and e.player_id = (select id from me)
			)
		)
	order by coalesce(t.starts_at, t.created_at) desc
	limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.tdc_my_tournaments(integer) from public, anon;
grant execute on function public.tdc_my_tournaments(integer) to authenticated;
