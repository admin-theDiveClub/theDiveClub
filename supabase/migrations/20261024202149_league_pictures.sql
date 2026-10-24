-- A league's own picture (UV, 24 Oct: "add the profile pic functionality to
-- the league settings page"), shown where a trophy stood in until now: the
-- season page's banner, the leagues list, the league search.
--
-- Per league, not per season: every season of a league shows the same
-- picture. Built as player-avatars is (migration player_avatars), for the same
-- reasons:
--
--   * A public bucket, league-pictures. A league's picture appears on pages
--     anyone signed in can open, and a signed URL per picture is slow. Public
--     is not findable: the path is random and nothing lists the bucket.
--   * The object path is <league id>/<random>.webp, and tbl_leagues.
--     picture_path holds it. A check constraint and the storage rules both
--     say "only that league's folder".
--   * The browser crops, shrinks (512px) and re-encodes the picture before
--     upload, which also strips EXIF (a phone photo's GPS position).
--   * Each upload gets a new random name and the old file is deleted
--     afterwards, so a cached copy of the old picture is never served.
--
-- Who may: whoever may manage the league (private.tdc_can_manage_league:
-- who made it, a director of any of its seasons, or the venue's owner, admin
-- or staff), for the files and for the column. The column is written only
-- through tdc_set_league_picture, never straight from the browser.

alter table public.tbl_leagues
	add column picture_path text;

alter table public.tbl_leagues
	add constraint tbl_leagues_picture_path_is_own
	check (picture_path is null or picture_path like id::text || '/%');

comment on column public.tbl_leagues.picture_path is
	'The league''s picture: an object in the public league-pictures bucket, <league id>/<random>.<ext>. Set through tdc_set_league_picture.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'league-pictures',
	'league-pictures',
	true,
	2097152,
	array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "Anyone can see league pictures"
	on storage.objects
	for select
	to public
	using (bucket_id = 'league-pictures');

-- The folder is a league the person may manage. Compared as text, so a
-- folder that is not a league id is simply refused rather than an error.
-- objects.name, never a bare name: inside the subquery that would be
-- tbl_leagues.name, the league's own name, and no folder would ever match.
create policy "League managers can add its picture"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'league-pictures'
		and exists (
			select 1 from public.tbl_leagues l
			where l.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_manage_league(l.id)
		)
	);

create policy "League managers can replace its picture"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'league-pictures'
		and exists (
			select 1 from public.tbl_leagues l
			where l.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_manage_league(l.id)
		)
	)
	with check (
		bucket_id = 'league-pictures'
		and exists (
			select 1 from public.tbl_leagues l
			where l.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_manage_league(l.id)
		)
	);

create policy "League managers can remove its picture"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'league-pictures'
		and exists (
			select 1 from public.tbl_leagues l
			where l.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_manage_league(l.id)
		)
	);

-- Sets (or, with null, clears) the league's picture and returns the path it
-- had, so the page can delete the old file once the new one is in place.
create function public.tdc_set_league_picture(p_league_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_old text;
begin
	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can change its picture.';
	end if;

	select picture_path into v_old from public.tbl_leagues where id = p_league_id;

	-- The check constraint says the same; said here in words.
	if p_path is not null and p_path not like p_league_id::text || '/%' then
		raise exception 'TDC (Error): a league''s picture must be in its own folder.';
	end if;

	update public.tbl_leagues set picture_path = p_path where id = p_league_id;
	return v_old;
end;
$$;

revoke execute on function public.tdc_set_league_picture(uuid, text) from public, anon;
grant execute on function public.tdc_set_league_picture(uuid, text) to authenticated;
