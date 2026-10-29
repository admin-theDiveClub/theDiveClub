-- A team's own picture (UV, 29 Oct: "for captains, add a picture upload for
-- the team icon"), shown where the shield stood in until now: the season
-- page's team headings, the fixtures planner, the team card's banner and its
-- result section.
--
-- Built as league-pictures is (migration league_pictures), for the same
-- reasons:
--
--   * A public bucket, team-pictures. A team's picture appears on pages anyone
--     signed in can open, and a signed URL per picture is slow. Public is not
--     findable: the path is random and nothing lists the bucket.
--   * The object path is <team id>/<random>.webp, and tbl_teams.picture_path
--     holds it. A check constraint and the storage rules both say "only that
--     team's folder".
--   * The browser crops, shrinks (512px) and re-encodes the picture before
--     upload, which also strips EXIF (a phone photo's GPS position).
--   * Each upload gets a new random name and the old file is deleted
--     afterwards, so a cached copy of the old picture is never served.
--
-- Who may: whoever controls the team (private.tdc_can_control_team: an active
-- captain of that team, or whoever runs its league season), for the files and
-- for the column. The column is written only through tdc_set_team_picture,
-- never straight from the browser.
--
-- Pages read the column straight from tbl_teams, which every signed-in user
-- may select whole (league_structure), so no read function changes.
--
-- A team is per season (teams do not persist), so a new season's team starts
-- without one. Deleting a team leaves its file behind; nothing lists it.

alter table public.tbl_teams
	add column picture_path text;

alter table public.tbl_teams
	add constraint tbl_teams_picture_path_is_own
	check (picture_path is null or picture_path like id::text || '/%');

comment on column public.tbl_teams.picture_path is
	'The team''s picture: an object in the public team-pictures bucket, <team id>/<random>.<ext>. Set through tdc_set_team_picture.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'team-pictures',
	'team-pictures',
	true,
	2097152,
	array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "Anyone can see team pictures"
	on storage.objects
	for select
	to public
	using (bucket_id = 'team-pictures');

-- The folder is a team the person controls. Compared as text, so a folder
-- that is not a team id is simply refused rather than an error. objects.name,
-- never a bare name: inside the subquery that would be tbl_teams.name, the
-- team's own name, and no folder would ever match.
create policy "Team captains can add its picture"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'team-pictures'
		and exists (
			select 1 from public.tbl_teams t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_control_team(t.id)
		)
	);

create policy "Team captains can replace its picture"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'team-pictures'
		and exists (
			select 1 from public.tbl_teams t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_control_team(t.id)
		)
	)
	with check (
		bucket_id = 'team-pictures'
		and exists (
			select 1 from public.tbl_teams t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_control_team(t.id)
		)
	);

create policy "Team captains can remove its picture"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'team-pictures'
		and exists (
			select 1 from public.tbl_teams t
			where t.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_control_team(t.id)
		)
	);

-- Sets (or, with null, clears) the team's picture and returns the path it
-- had, so the page can delete the old file once the new one is in place.
create function public.tdc_set_team_picture(p_team_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_old text;
begin
	if not private.tdc_can_control_team(p_team_id) then
		raise exception 'Only the team''s captain or whoever runs the league can change its picture.';
	end if;

	select picture_path into v_old from public.tbl_teams where id = p_team_id;

	-- The check constraint says the same; said here in words.
	if p_path is not null and p_path not like p_team_id::text || '/%' then
		raise exception 'TDC (Error): a team''s picture must be in its own folder.';
	end if;

	update public.tbl_teams set picture_path = p_path where id = p_team_id;
	return v_old;
end;
$$;

revoke execute on function public.tdc_set_team_picture(uuid, text) from public, anon;
grant execute on function public.tdc_set_team_picture(uuid, text) to authenticated;
