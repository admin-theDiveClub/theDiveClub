-- Coordinator overrides, and the roles that make somebody a coordinator.
--
-- Both halves of this are designed in claude/approval-and-corrections.md. This
-- builds the override exactly as that note specifies, and closes the hole it
-- depends on: private.tdc_can_edit_match has never known that competition
-- roles exist, so a tournament director who is neither a player in the match
-- nor staff at the venue cannot touch their own tournament's matches. There is
-- also, until now, no way to appoint a referee or a scorer at all — the only
-- insert into tbl_competition_roles anywhere is the director created inside
-- tdc_create_tournament.

-- ─────────────────────────────────────────────────────────────────
-- Appointing officials
-- ─────────────────────────────────────────────────────────────────

-- Gated on tdc_can_run_tournament, which is the director or venue staff. A
-- scorer (rank 30) therefore cannot appoint anybody, which is the point of the
-- ranks being numbers.
create function public.tdc_add_competition_role(
	p_tournament_id uuid,
	p_player_id     uuid,
	p_role          text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id uuid;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can appoint its officials.';
	end if;

	if not exists (select 1 from public.tbl_competition_role_types where key = p_role) then
		raise exception 'TDC (Error): there is no role called %.', p_role;
	end if;

	if not exists (select 1 from public.tbl_players where id = p_player_id) then
		raise exception 'TDC (Error): no player with id %.', p_player_id;
	end if;

	insert into public.tbl_competition_roles (created_by, tournament_id, player_id, role)
	values ((select auth.uid()), p_tournament_id, p_player_id, p_role)
	on conflict (tournament_id, player_id, role) do update set role = excluded.role
	returning id into v_id;

	return v_id;
end;
$$;

revoke execute on function public.tdc_add_competition_role(uuid, uuid, text) from public, anon;
grant execute on function public.tdc_add_competition_role(uuid, uuid, text) to authenticated;


create function public.tdc_remove_competition_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_r public.tbl_competition_roles%rowtype;
begin
	select * into v_r from public.tbl_competition_roles where id = p_role_id;
	if v_r.id is null then
		raise exception 'TDC (Error): role % not found.', p_role_id;
	end if;

	if not private.tdc_can_run_tournament(v_r.tournament_id) then
		raise exception 'Only the people running this tournament can remove its officials.';
	end if;

	-- A tournament with no director can still be run by venue staff, but one
	-- with neither cannot be changed by anybody ever again. Refused rather
	-- than allowed and regretted.
	if v_r.role = 'director' and not exists (
		select 1 from public.tbl_competition_roles
		where tournament_id = v_r.tournament_id and role = 'director' and id <> p_role_id
	) and (select venue_id from public.tbl_tournaments where id = v_r.tournament_id) is null then
		raise exception 'This is the only director of a tournament with no venue behind it. Appoint another director first, or nobody will be able to run it.';
	end if;

	delete from public.tbl_competition_roles where id = p_role_id;
end;
$$;

revoke execute on function public.tdc_remove_competition_role(uuid) from public, anon;
grant execute on function public.tdc_remove_competition_role(uuid) to authenticated;


-- Who runs a competition, for the page that lists them.
create function public.tdc_competition_officials(p_tournament_id uuid)
returns table (
	role_id      uuid,
	player_id    uuid,
	display_name text,
	role         text,
	role_name    text,
	rank         integer
)
language sql
stable
security definer
set search_path = ''
as $$
	select r.id, p.id, p.display_name, r.role, t.name, t.rank
	from public.tbl_competition_roles r
	join public.tbl_players p on p.id = r.player_id
	join public.tbl_competition_role_types t on t.key = r.role
	where r.tournament_id = p_tournament_id
	order by t.rank desc, p.display_name;
$$;

revoke execute on function public.tdc_competition_officials(uuid) from public, anon;
grant execute on function public.tdc_competition_officials(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Competition roles can now edit their competition's matches
--
-- Replaces the version from 20261014160000, adding one branch. Everything
-- else is unchanged, and the comments on the original branches are kept
-- because they are still the reasons.
--
-- This is the fourth principle in practice: one place decides whether a card
-- may be touched, and a new kind of person who may touch it is a branch here
-- rather than a second rule somewhere else.
--
-- A match belongs to a competition through tbl_tournament_fixtures, not
-- through a column on tbl_matches — a match is first class and belongs to
-- nothing by default, which is why there is a join here rather than a
-- tournament_id to read.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_can_edit_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.tbl_matches m
		where m.id = p_match_id
			and (
				-- Either side's player, in a singles match.
				exists (
					select 1
					from public.tbl_players p
					where p.user_id = (select auth.uid())
						and p.id in (m.home_player_id, m.away_player_id)
				)
				-- Anyone who actually played a frame. This is what covers a team
				-- match, where the sides are teams and the people are in frames.
				or exists (
					select 1
					from public.tbl_frames f
					join public.tbl_frame_participants fp on fp.frame_id = f.id
					join public.tbl_players p on p.id = fp.player_id
					where f.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- Staff at the venue the match is being played at.
				or (
					m.venue_id is not null
					and private.tdc_has_venue_role(m.venue_id, array['owner', 'admin', 'staff'])
				)
				-- Anyone holding a role in a competition this match belongs to:
				-- its director, referee or scorer. Without this a TD who is not
				-- playing and is not venue staff cannot score their own
				-- tournament, which is the whole of principle 8.
				or exists (
					select 1
					from public.tbl_tournament_fixtures x
					join public.tbl_competition_roles r on r.tournament_id = x.tournament_id
					join public.tbl_players p on p.id = r.player_id
					where x.match_id = m.id
						and p.user_id = (select auth.uid())
				)
			)
	);
$$;


-- ─────────────────────────────────────────────────────────────────
-- The match-level override
--
-- Straight from claude/approval-and-corrections.md. A TC who is told "it
-- finished 5-3" and has no interest in reconstructing eight frames at eleven
-- at night, without a cached score being written onto the match.
--
-- Reading a match score becomes: if an override exists, use it; otherwise
-- count the frames. One branch, in one place.
-- ─────────────────────────────────────────────────────────────────

create table public.tbl_match_result_override (
	-- One standing override per match. A second one replaces the first rather
	-- than stacking, because "which override counts" is not a question
	-- anybody should have to answer.
	match_id     uuid primary key references public.tbl_matches (id) on delete cascade,

	home_score   integer not null check (home_score >= 0),
	away_score   integer not null check (away_score >= 0),

	-- Not optional. An override without a reason is the thing this feature
	-- will be blamed for.
	reason       text not null check (char_length(trim(reason)) >= 3),

	set_by       uuid references public.tbl_players (id) on delete set null,
	set_at       timestamptz not null default now(),

	-- What the frames said at the moment of overriding, so that "the frames
	-- say 4-4 and the TC said 5-3" is answerable later.
	counted_home integer not null,
	counted_away integer not null,

	-- The card version the override was set against. A later frame edit does
	-- not drop the override — a coordinator overriding a score is deliberately
	-- overruling the frames — but it does make it stale, and stale is
	-- something a page can show for review.
	card_version integer not null
);

comment on table public.tbl_match_result_override is
	'A coordinator''s match-level score, kept beside the frames rather than written onto the match. Visible as what it is, reversible, and carrying both its reason and what the frames said at the time.';

alter table public.tbl_match_result_override enable row level security;

create policy "Signed-in users can see overrides"
	on public.tbl_match_result_override for select to authenticated using (true);

grant select on public.tbl_match_result_override to authenticated;


-- Only somebody running a competition the match belongs to. A social match
-- has no coordinator, so it has no override — which is correct: there is
-- nobody whose word would outrank the two people who played it.
create function private.tdc_can_override_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1 from public.tbl_tournament_fixtures x
		where x.match_id = p_match_id
			and private.tdc_can_run_tournament(x.tournament_id)
	);
$$;

revoke execute on function private.tdc_can_override_match(uuid) from public, anon;
grant execute on function private.tdc_can_override_match(uuid) to authenticated;


create function public.tdc_set_match_override(
	p_match_id   uuid,
	p_home_score integer,
	p_away_score integer,
	p_reason     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_m    public.tbl_matches%rowtype;
	v_me   uuid;
	v_home integer;
	v_away integer;
begin
	select * into v_m from public.tbl_matches where id = p_match_id;
	if v_m.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_override_match(p_match_id) then
		raise exception 'Only the people running the competition this match belongs to can set its score.';
	end if;

	if nullif(trim(coalesce(p_reason, '')), '') is null or char_length(trim(p_reason)) < 3 then
		raise exception 'Setting a score by hand needs a reason.';
	end if;

	if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0 then
		raise exception 'TDC (Error): a score needs two numbers, neither of them negative.';
	end if;

	-- A match still being played is one where the frames are still arriving,
	-- and overriding it is almost always a mistake. A match that was never
	-- played is the opposite: that is the TD-run case this exists for.
	if v_m.status = 'in_progress' then
		raise exception 'This match is still being played. Finish or abandon it before setting the score by hand.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());

	select
		count(*) filter (where f.winner_side = 'home'),
		count(*) filter (where f.winner_side = 'away')
	into v_home, v_away
	from public.tbl_frames f
	where f.match_id = p_match_id and f.status = 'complete';

	insert into public.tbl_match_result_override
		(match_id, home_score, away_score, reason, set_by, counted_home, counted_away, card_version)
	values
		(p_match_id, p_home_score, p_away_score, trim(p_reason), v_me, v_home, v_away, v_m.card_version)
	on conflict (match_id) do update set
		home_score   = excluded.home_score,
		away_score   = excluded.away_score,
		reason       = excluded.reason,
		set_by       = excluded.set_by,
		set_at       = now(),
		counted_home = excluded.counted_home,
		counted_away = excluded.counted_away,
		card_version = excluded.card_version;
end;
$$;

revoke execute on function public.tdc_set_match_override(uuid, integer, integer, text) from public, anon;
grant execute on function public.tdc_set_match_override(uuid, integer, integer, text) to authenticated;


-- Deleting the override restores the counted score, which is the thing a
-- score written onto the match could never do.
create function public.tdc_clear_match_override(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_override_match(p_match_id) then
		raise exception 'Only the people running the competition this match belongs to can clear its score.';
	end if;

	delete from public.tbl_match_result_override where match_id = p_match_id;
end;
$$;

revoke execute on function public.tdc_clear_match_override(uuid) from public, anon;
grant execute on function public.tdc_clear_match_override(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The one branch
--
-- Every reader of a match score goes through here, so "if an override exists
-- use it, otherwise count the frames" is written once.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_match_score(p_match_id uuid)
returns table (
	home_score  integer,
	away_score  integer,
	overridden  boolean,
	stale       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		coalesce(o.home_score, (select count(*)::integer from public.tbl_frames f
			where f.match_id = p_match_id and f.status = 'complete' and f.winner_side = 'home')),
		coalesce(o.away_score, (select count(*)::integer from public.tbl_frames f
			where f.match_id = p_match_id and f.status = 'complete' and f.winner_side = 'away')),
		o.match_id is not null,
		-- The frames have moved since the coordinator set this. The override
		-- still stands; it is flagged for review rather than dropped.
		coalesce(o.card_version <> m.card_version, false)
	from public.tbl_matches m
	left join public.tbl_match_result_override o on o.match_id = m.id
	where m.id = p_match_id;
$$;

revoke execute on function private.tdc_match_score(uuid) from public, anon;
grant execute on function private.tdc_match_score(uuid) to authenticated;


create function public.tdc_match_score(p_match_id uuid)
returns table (home_score integer, away_score integer, overridden boolean, stale boolean)
language sql
stable
security definer
set search_path = ''
as $$ select * from private.tdc_match_score(p_match_id); $$;

revoke execute on function public.tdc_match_score(uuid) from public, anon;
grant execute on function public.tdc_match_score(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- The bracket reads the override too
--
-- Replaces the version from 20261019170000. Without this a TD could set a
-- score and watch the bracket ignore it, which is the opposite of the point.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_fixture_outcome(p_fixture_id uuid)
returns table (winner_entrant_id uuid, loser_entrant_id uuid, decided boolean, why text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_f     public.tbl_tournament_fixtures%rowtype;
	v_m     public.tbl_matches%rowtype;
	v_score record;
begin
	winner_entrant_id := null;
	loser_entrant_id  := null;
	decided := false;
	why := null;

	select * into v_f from public.tbl_tournament_fixtures where id = p_fixture_id;
	if v_f.id is null then
		return next;
		return;
	end if;

	-- Awarded rather than played: a bye, a walkover, a withdrawal, a decision.
	if v_f.advanced_entrant_id is not null then
		winner_entrant_id := v_f.advanced_entrant_id;
		loser_entrant_id := case
			when v_f.advanced_entrant_id = v_f.home_entrant_id then v_f.away_entrant_id
			else v_f.home_entrant_id
		end;
		decided := true;
		why := v_f.advance_reason;
		return next;
		return;
	end if;

	if v_f.match_id is null then
		why := 'not played';
		return next;
		return;
	end if;

	select * into v_m from public.tbl_matches where id = v_f.match_id;
	select * into v_score from private.tdc_match_score(v_f.match_id);

	-- A coordinator's score settles the match whatever its status says. That
	-- is the TD-run case: a fixture whose match was created and never played,
	-- where the result is simply known. Requiring 'complete' first would mean
	-- a TD had to pretend to play it.
	if not v_score.overridden and v_m.status <> 'complete' then
		why := 'in progress';
		return next;
		return;
	end if;

	if v_score.home_score = v_score.away_score then
		why := 'level';
		return next;
		return;
	end if;

	if v_score.home_score > v_score.away_score then
		winner_entrant_id := v_f.home_entrant_id;
		loser_entrant_id  := v_f.away_entrant_id;
	else
		winner_entrant_id := v_f.away_entrant_id;
		loser_entrant_id  := v_f.home_entrant_id;
	end if;
	decided := winner_entrant_id is not null;
	why := case
		when not decided then 'played, but the slot is empty'
		when v_score.overridden then 'set by hand'
		else 'played'
	end;
	return next;
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- And the draw shows it as what it is
--
-- Replaces the version from 20261019170000. A 5-3 that nobody played is
-- labelled rather than disguised.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_tournament_draw(uuid);

create function public.tdc_tournament_draw(p_tournament_id uuid)
returns table (
	fixture_id    uuid,
	bracket       text,
	round         integer,
	"position"    integer,
	home_entrant_id uuid,
	home_name     text,
	home_seed     integer,
	home_source   text,
	away_entrant_id uuid,
	away_name     text,
	away_seed     integer,
	away_source   text,
	match_id      uuid,
	match_status  text,
	home_frames   integer,
	away_frames   integer,
	overridden    boolean,
	override_stale boolean,
	override_reason text,
	card_state    text,
	winner_entrant_id uuid,
	advanced_entrant_id uuid,
	advance_reason text,
	home_feeder_round    integer,
	home_feeder_position integer,
	away_feeder_round    integer,
	away_feeder_position integer
)
language sql
stable
security definer
set search_path = ''
as $$
	select f.id, f.bracket, f.round, f.position,
		f.home_entrant_id, hp.display_name, he.seed, f.home_source_type,
		f.away_entrant_id, ap.display_name, ae.seed, f.away_source_type,
		f.match_id, m.status,
		-- The effective score: the override where there is one, the counted
		-- frames where there is not.
		s.home_score, s.away_score,
		coalesce(s.overridden, false), coalesce(s.stale, false), o.reason,
		case when f.match_id is not null
			then private.tdc_card_state(f.match_id)->>'state' end,
		(select x.winner_entrant_id from private.tdc_fixture_outcome(f.id) x),
		f.advanced_entrant_id, f.advance_reason,
		hf.round, hf.position,
		af.round, af.position
	from public.tbl_tournament_fixtures f
	left join public.tbl_matches m              on m.id = f.match_id
	left join lateral private.tdc_match_score(f.match_id) s on f.match_id is not null
	left join public.tbl_match_result_override o on o.match_id = f.match_id
	left join public.tbl_tournament_entrants he on he.id = f.home_entrant_id
	left join public.tbl_players hp             on hp.id = he.player_id
	left join public.tbl_tournament_entrants ae on ae.id = f.away_entrant_id
	left join public.tbl_players ap             on ap.id = ae.player_id
	left join public.tbl_tournament_fixtures hf on hf.id = f.home_source_ref
		and f.home_source_type in ('winner_of', 'loser_of')
	left join public.tbl_tournament_fixtures af on af.id = f.away_source_ref
		and f.away_source_type in ('winner_of', 'loser_of')
	where f.tournament_id = p_tournament_id
	order by f.bracket, f.round, f.position;
$$;

revoke execute on function public.tdc_tournament_draw(uuid) from public, anon;
grant execute on function public.tdc_tournament_draw(uuid) to authenticated;
