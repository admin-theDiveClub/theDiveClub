-- A note of a match that was deleted.
--
-- Deleting a match removes it for both players, and the other one deserves to
-- be told. The trouble is that by the time anything could send that message the
-- match is gone, along with the names, the score and any record of who was in
-- it — so there is nothing left to address the message to.
--
-- This keeps the little that is needed: who was playing, who removed it, and
-- what the score was. Enough to tell the other player what disappeared, and to
-- show them something later if we ever want to.
--
-- It is not a backup. The frames are gone and are not coming back; that is what
-- deleting means.

create table public.tbl_deleted_matches (
	match_id       uuid primary key,
	deleted_at     timestamptz not null default now(),
	deleted_by     uuid not null references public.tbl_players (id) on delete restrict,

	home_player_id uuid references public.tbl_players (id) on delete set null,
	away_player_id uuid references public.tbl_players (id) on delete set null,

	-- "UV 3 – Linton Paul 2, 5 frames". Written at the time, because the names
	-- and the score cannot be worked out again afterwards.
	summary        text
);

create index tbl_deleted_matches_players_idx
	on public.tbl_deleted_matches (home_player_id, away_player_id);

alter table public.tbl_deleted_matches enable row level security;

-- Only the two people who were in it.
create policy "Players see matches they were in"
	on public.tbl_deleted_matches
	for select
	to authenticated
	using (
		exists (
			select 1 from public.tbl_players p
			where p.user_id = (select auth.uid())
				and p.id in (home_player_id, away_player_id)
		)
	);

grant select on public.tbl_deleted_matches to authenticated;
grant select, insert on public.tbl_deleted_matches to service_role;


-- ─── Deleting now leaves that note behind ───
create or replace function public.tdc_delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_me      uuid;
	v_match   public.tbl_matches%rowtype;
	v_home    text;
	v_away    text;
	v_hs      integer;
	v_as      integer;
	v_frames  integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	v_me := private.tdc_my_player_on_match(p_match_id);
	if v_me is null then
		raise exception 'Only the players in this match can delete it.';
	end if;

	if v_match.sanctioned then
		raise exception 'This match counts towards rankings and cannot be deleted. Ask the organiser.';
	end if;

	-- Everything worth keeping, gathered while it still exists.
	select p.display_name into v_home from public.tbl_players p where p.id = v_match.home_player_id;
	select p.display_name into v_away from public.tbl_players p where p.id = v_match.away_player_id;

	select count(*) filter (where status = 'complete' and winner_side = 'home'),
		count(*) filter (where status = 'complete' and winner_side = 'away'),
		count(*)
		into v_hs, v_as, v_frames
	from public.tbl_frames where match_id = p_match_id;

	insert into public.tbl_deleted_matches (match_id, deleted_by, home_player_id, away_player_id, summary)
	values (
		p_match_id, v_me, v_match.home_player_id, v_match.away_player_id,
		coalesce(v_home, 'Home') || ' ' || v_hs || ' – ' || coalesce(v_away, 'Away') || ' ' || v_as
			|| ', ' || v_frames || ' frame' || case when v_frames = 1 then '' else 's' end
	)
	on conflict (match_id) do nothing;

	perform set_config('tdc.card_unlock', 'on', true);
	delete from public.tbl_matches where id = p_match_id;
	perform set_config('tdc.card_unlock', 'off', true);
end;
$$;
