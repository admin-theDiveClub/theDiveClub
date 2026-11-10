-- A league's document (UV, 10 Nov): one PDF per league, in addition to the
-- generated Rules tab, which players open from a link. A switch can hide the
-- generated rules and leave only the document.
--
-- Built to withstand somebody uploading with bad intent:
--
--   * The bucket is private, and allows application/pdf alone, 5 MB at most.
--     Those limits are the storage server's, so a browser cannot talk past them.
--   * A file is reached only through a short-lived signed link, and only by
--     somebody signed in (UV). Clearing the column ends access at once.
--   * Files are served from the database's address as PDFs, never as a page
--     of the site, so a file dressed up as a PDF cannot run on the site.
--   * The object path is <league id>/<uuid>.pdf, forced by the insert rule and
--     a check constraint. The filename somebody chose is never stored or shown.
--   * Only whoever may manage the league may add or delete. No update rule: a
--     file cannot be swapped under its existing name.
--   * A folder holds the current document and at most one more, for the
--     moment of a replace, so nobody can fill the storage (slot_free below).
--   * tdc_set_league_document names a file only if the storage server
--     recorded it as a PDF within the limit.
--
-- Nothing scans a PDF for viruses; the page says who it comes from.
--
-- Signed-out visitors learn only whether there is a document and whether the
-- generated rules are hidden, never its path: tdc_public_league_season is
-- patched from its text in 20261110094557, the two keys added and nothing else.

alter table public.tbl_leagues
	add column document_path text,
	add column show_generated_rules boolean not null default true;

alter table public.tbl_leagues
	add constraint tbl_leagues_document_path_is_own
	check (document_path is null or document_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.pdf$'));

-- The generated rules can be hidden only when there is something in their place.
alter table public.tbl_leagues
	add constraint tbl_leagues_rules_or_document
	check (show_generated_rules or document_path is not null);

comment on column public.tbl_leagues.document_path is
	'The league''s PDF: an object in the private league-documents bucket, <league id>/<uuid>.pdf. Set through tdc_set_league_document only.';
comment on column public.tbl_leagues.show_generated_rules is
	'Off: the Rules tab shows only the league document. Needs a document; removing the document turns this back on.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('league-documents', 'league-documents', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Whether a league's folder has room for a new file: nothing in it but the
-- current document. Security definer, as a policy on storage.objects cannot
-- query storage.objects without recursing.
create function private.tdc_league_document_slot_free(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select not exists (
		select 1 from storage.objects o
		where o.bucket_id = 'league-documents'
			and o.name like p_folder || '/%'
			and o.name is distinct from (select l.document_path from public.tbl_leagues l where l.id::text = p_folder)
	);
$$;
revoke execute on function private.tdc_league_document_slot_free(text) from public, anon;
grant execute on function private.tdc_league_document_slot_free(text) to authenticated;

-- The current document of any league, for anyone signed in; every file in its
-- folder for whoever manages the league, who has to see what to clear away.
create policy "Signed-in players can read a league's document"
	on storage.objects
	for select
	to authenticated
	using (
		bucket_id = 'league-documents'
		and (
			exists (select 1 from public.tbl_leagues l where l.document_path = objects.name)
			or exists (
				select 1 from public.tbl_leagues l
				where l.id::text = (storage.foldername(objects.name))[1]
					and private.tdc_can_manage_league(l.id)
			)
		)
	);

create policy "League managers can add its document"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'league-documents'
		and objects.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
		and exists (
			select 1 from public.tbl_leagues l
			where l.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_manage_league(l.id)
		)
		and private.tdc_league_document_slot_free((storage.foldername(objects.name))[1])
	);

create policy "League managers can remove its document"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'league-documents'
		and exists (
			select 1 from public.tbl_leagues l
			where l.id::text = (storage.foldername(objects.name))[1]
				and private.tdc_can_manage_league(l.id)
		)
	);

-- Sets (or, with null, clears) the league's document and returns the path it
-- had, so the page can delete the old file once the new one is named. Clearing
-- it brings the generated rules back: there would be nothing else to show.
create function public.tdc_set_league_document(p_league_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_old text;
begin
	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can change its document.';
	end if;

	select document_path into v_old from public.tbl_leagues where id = p_league_id;

	if p_path is null then
		update public.tbl_leagues set document_path = null, show_generated_rules = true where id = p_league_id;
		return v_old;
	end if;

	if p_path !~ ('^' || p_league_id::text || '/[0-9a-f-]{36}\.pdf$') then
		raise exception 'TDC (Error): a league''s document must be in its own folder.';
	end if;

	-- What the storage server recorded, not what the page said.
	if not exists (
		select 1 from storage.objects o
		where o.bucket_id = 'league-documents' and o.name = p_path
			and o.metadata ->> 'mimetype' = 'application/pdf'
			and (o.metadata ->> 'size')::bigint <= 5242880
	) then
		raise exception 'That file was not stored as a PDF of 5 MB or less.';
	end if;

	update public.tbl_leagues set document_path = p_path where id = p_league_id;
	return v_old;
end;
$$;
revoke execute on function public.tdc_set_league_document(uuid, text) from public, anon;
grant execute on function public.tdc_set_league_document(uuid, text) to authenticated;

create function public.tdc_set_league_show_rules(p_league_id uuid, p_show boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_manage_league(p_league_id) then
		raise exception 'Only the people running this league can change this.';
	end if;
	if p_show is null then
		raise exception 'TDC (Error): the rules switch needs a value.';
	end if;
	if not p_show and not exists (
		select 1 from public.tbl_leagues where id = p_league_id and document_path is not null
	) then
		raise exception 'Upload a league document before hiding the rules.';
	end if;

	update public.tbl_leagues set show_generated_rules = p_show where id = p_league_id;
end;
$$;
revoke execute on function public.tdc_set_league_show_rules(uuid, boolean) from public, anon;
grant execute on function public.tdc_set_league_show_rules(uuid, boolean) to authenticated;

-- Patched from 20261110094557: 'has_document' and 'show_generated_rules' added.
create or replace function public.tdc_public_league_season(p_league_season_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'league_name', l.name,
		'name', s.name,
		'starts_on', z.starts_on,
		'ends_on', z.ends_on,
		'rules', private.tdc_rules_for_league_season(s.id),
		'notes', s.notes,
		'venues', private.tdc_season_venue_list(s.id),
		'status', s.status,
		'max_reserves', s.max_reserves,
		'entry_mode', s.entry_mode,
		'picture_path', l.picture_path,
		'has_document', l.document_path is not null,
		'show_generated_rules', l.show_generated_rules,
		'shows_players', s.public_shows_players,
		'players', (select count(*)::integer from public.tbl_league_season_entrants e
			where e.league_season_id = s.id and e.status = 'active'),
		'interested', (select count(*)::integer from public.tbl_league_season_entrants e
			where e.league_season_id = s.id and e.status = 'interested'),
		'fixtures', coalesce((
			select jsonb_agg(jsonb_build_object(
				'scheduled_at', f.scheduled_at,
				'is_bye', f.away_team_id is null,
				'match_status', m.status,
				'frames', coalesce(sc.home_score, 0) + coalesce(sc.away_score, 0)
			) order by f.round, f."position")
			from public.tbl_league_fixtures f
			left join public.tbl_matches m on m.id = f.match_id
			left join lateral private.tdc_match_score(f.match_id) sc on f.match_id is not null
			where f.league_season_id = s.id
		), '[]'::jsonb),
		'teams', coalesce((
			select jsonb_agg(jsonb_build_object(
				'team_id', t.id,
				'name', t.name,
				'picture_path', t.picture_path,
				'active_players', private.tdc_team_active_players(t.id),
				'team_limit', private.tdc_team_limit(t.id)
			) || case when s.public_shows_players then jsonb_build_object('roster', coalesce((
				select jsonb_agg(jsonb_build_object(
					'display_name', p.display_name,
					'avatar_path', p.avatar_path,
					'is_captain', e.is_captain
				) order by e.is_captain desc, p.display_name)
				from public.tbl_league_season_entrants e
				join public.tbl_players p on p.id = e.player_id
				where e.team_id = t.id and e.status in ('active', 'inactive')
			), '[]'::jsonb)) else '{}'::jsonb end
			order by lower(t.name))
			from public.tbl_teams t
			where t.league_season_id = s.id
		), '[]'::jsonb),
		-- Always shown, as on the poster. Only somebody with an account: the
		-- page's search offers nothing else, but the function that names an
		-- official does not refuse a walk-in.
		'officials', coalesce((
			select jsonb_agg(jsonb_build_object(
				'display_name', p.display_name,
				'avatar_path', p.avatar_path,
				'role_name', case when r.role = 'director' then 'League director' else t.name end
			) order by t.rank desc, p.display_name)
			from public.tbl_competition_roles r
			join public.tbl_players p on p.id = r.player_id
			join public.tbl_competition_role_types t on t.key = r.role
			where r.league_season_id = s.id and p.user_id is not null
		), '[]'::jsonb)
	)
	from public.tbl_league_seasons s
	join public.tbl_leagues l on l.id = s.league_id
	join public.tbl_seasons z on z.id = s.season_id
	where s.id = p_league_season_id and s.is_listed;
$$;
