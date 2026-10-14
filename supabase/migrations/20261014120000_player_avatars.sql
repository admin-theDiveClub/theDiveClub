-- Profile pictures.
--
-- The picture itself lives in Supabase Storage; tbl_players keeps the object path.
-- The bucket is public so a player's picture can be shown next to their name
-- anywhere, including pages people see without signing in (a tournament follow
-- page, a league table), without asking the server for a signed URL for every
-- face on the page.
--
-- Public does not mean findable: the object path is <player_id>/<random>.webp,
-- so it can't be worked out from someone's name, and nothing lists the bucket.
-- The browser also resizes and re-encodes the picture before uploading, which
-- strips EXIF — phone photos carry GPS coordinates of where they were taken.

alter table public.tbl_players
	add column avatar_path text;

-- A player's picture can only live in their own folder. This is belt and braces
-- with the storage rules below: even a bad write to this column can't point at
-- somebody else's file.
alter table public.tbl_players
	add constraint tbl_players_avatar_path_is_own
	check (avatar_path is null or avatar_path like id::text || '/%');

grant update (avatar_path) on public.tbl_players to authenticated;


-- ─── The bucket ───────────────────────────────────────────────────────────
-- 2 MiB is a generous ceiling: the browser sends about 40 KB after resizing.
-- It is there to stop someone bypassing the page and posting something large.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'player-avatars',
	'player-avatars',
	true,
	2097152,
	array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;


-- ─── Access rules ─────────────────────────────────────────────────────────
-- The first folder in the object name is the player id, so these rules say
-- "only in your own folder". Walk-ins have no login, so they match nothing
-- here and can't upload; staff doing it for them is a later step.

create policy "Anyone can see profile pictures"
	on storage.objects
	for select
	to public
	using (bucket_id = 'player-avatars');

create policy "Players can add their own picture"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'player-avatars'
		and (storage.foldername(name))[1] in (
			select p.id::text
			from public.tbl_players p
			where p.user_id = (select auth.uid())
		)
	);

create policy "Players can replace their own picture"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'player-avatars'
		and (storage.foldername(name))[1] in (
			select p.id::text
			from public.tbl_players p
			where p.user_id = (select auth.uid())
		)
	)
	with check (
		bucket_id = 'player-avatars'
		and (storage.foldername(name))[1] in (
			select p.id::text
			from public.tbl_players p
			where p.user_id = (select auth.uid())
		)
	);

create policy "Players can remove their own picture"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'player-avatars'
		and (storage.foldername(name))[1] in (
			select p.id::text
			from public.tbl_players p
			where p.user_id = (select auth.uid())
		)
	);
