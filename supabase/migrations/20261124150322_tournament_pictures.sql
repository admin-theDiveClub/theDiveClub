-- A tournament's own picture (UV, 24 Nov: "I should be able to add a pic for
-- a tournament, same as leagues"), shown on the poster's banner where the
-- trophy stood in until now.
--
-- Built as league-pictures is (migration 20261024202149_league_pictures), for
-- the same reasons:
--
--   * A public bucket, tournament-pictures. The poster is read signed out,
--     and a signed URL per picture is slow. Public is not findable: the path
--     is random and nothing lists the bucket.
--   * The object path is <tournament id>/<random>.webp, and tbl_tournaments.
--     picture_path holds it. A check constraint and the storage rules both
--     say "only that tournament's folder".
--   * The browser crops, shrinks (512px) and re-encodes the picture before
--     upload, which also strips EXIF (a phone photo's GPS position).
--   * Each upload gets a new random name and the old file is deleted
--     afterwards, so a cached copy of the old picture is never served.
--
-- Who may: whoever may run the tournament (private.tdc_can_run_tournament,
-- the one place that decides it), for the files and for the column. The
-- column is written only through tdc_set_tournament_picture.
--
-- On the poster the picture is live, not part of the snapshot (UV, 24 Nov):
-- it shows as soon as it is set, without regenerating. So tdc_tournament_poster
-- returns picture_path beside the snapshot, read from the tournament itself,
-- and only when it would return the poster at all. That widens what anon can
-- read by one value, a path into a bucket that is public already.

alter table public.tbl_tournaments
	add column picture_path text;

alter table public.tbl_tournaments
	add constraint tbl_tournaments_picture_path_is_own
	check (picture_path is null or picture_path like id::text || '/%');

comment on column public.tbl_tournaments.picture_path is
	'The tournament''s picture: an object in the public tournament-pictures bucket, <tournament id>/<random>.<ext>. Set through tdc_set_tournament_picture. Shown live on the poster.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'tournament-pictures',
	'tournament-pictures',
	true,
	2097152,
	array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "Anyone can see tournament pictures"
	on storage.objects
	for select
	to public
	using (bucket_id = 'tournament-pictures');

-- The folder is a tournament the person may run. Compared as text, so a
-- folder that is not a tournament id is simply refused rather than an error.
-- objects.name, never a bare name: inside the subquery that would be
-- tbl_tournaments.name, and no folder would ever match.
create policy "Tournament runners can add its picture"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'tournament-pictures'
		and exists (
			select 1 from public.tbl_tournaments t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_run_tournament(t.id)
		)
	);

create policy "Tournament runners can replace its picture"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'tournament-pictures'
		and exists (
			select 1 from public.tbl_tournaments t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_run_tournament(t.id)
		)
	)
	with check (
		bucket_id = 'tournament-pictures'
		and exists (
			select 1 from public.tbl_tournaments t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_run_tournament(t.id)
		)
	);

create policy "Tournament runners can remove its picture"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'tournament-pictures'
		and exists (
			select 1 from public.tbl_tournaments t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_run_tournament(t.id)
		)
	);

-- Sets (or, with null, clears) the tournament's picture and returns the path
-- it had, so the page can delete the old file once the new one is in place.
create function public.tdc_set_tournament_picture(p_tournament_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_old text;
begin
	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change its picture.';
	end if;

	select picture_path into v_old from public.tbl_tournaments where id = p_tournament_id;

	-- The check constraint says the same; said here in words.
	if p_path is not null and p_path not like p_tournament_id::text || '/%' then
		raise exception 'TDC (Error): a tournament''s picture must be in its own folder.';
	end if;

	update public.tbl_tournaments set picture_path = p_path where id = p_tournament_id;
	return v_old;
end;
$$;

revoke execute on function public.tdc_set_tournament_picture(uuid, text) from public, anon;
grant execute on function public.tdc_set_tournament_picture(uuid, text) to authenticated;

-- tdc_tournament_poster (20261021140000), patched: one column added,
-- picture_path, read live from the tournament. A new column changes the
-- return type, so it is dropped and made again, with its grants.
drop function public.tdc_tournament_poster(uuid);

create function public.tdc_tournament_poster(p_tournament_id uuid)
returns table (
	snapshot     jsonb,
	generated_at timestamptz,
	is_public    boolean,
	i_run_it     boolean,
	picture_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_p public.tbl_tournament_posters%rowtype;
	v_run boolean := false;
begin
	select * into v_p from public.tbl_tournament_posters
	where tournament_id = p_tournament_id;

	-- An unauthenticated caller has no player record, so this is asked only
	-- when somebody is signed in. tdc_can_run_tournament would be false for
	-- anon anyway; this just avoids the work.
	if (select auth.uid()) is not null then
		v_run := private.tdc_can_run_tournament(p_tournament_id);
	end if;

	-- No row, or a private poster and you do not run it: nothing. Not an
	-- error — a tournament without a poster and one whose poster is private
	-- are the same thing to a visitor, and saying which would leak that the
	-- tournament exists.
	if v_p.tournament_id is null then return; end if;
	if not v_p.is_public and not v_run then return; end if;

	snapshot     := v_p.snapshot;
	generated_at := v_p.generated_at;
	is_public    := v_p.is_public;
	i_run_it     := v_run;
	-- Live, not from the snapshot (UV, 24 Nov).
	select t.picture_path into picture_path from public.tbl_tournaments t where t.id = p_tournament_id;
	return next;
end;
$$;

revoke execute on function public.tdc_tournament_poster(uuid) from public;
grant execute on function public.tdc_tournament_poster(uuid) to anon, authenticated;
