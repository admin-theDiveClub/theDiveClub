-- Owners and admins: list the ID verifications done at their venue, so they can review and revoke them.
-- Shows who was verified and by whom, with only the last 3 characters of the document number.

create function public.tdc_list_venue_verifications(p_venue_id uuid)
returns table (
	verification_id  uuid,
	verified_at      timestamptz,
	player_id        uuid,
	player_name      text,
	document_kind    text,
	document_hint    text,
	verified_by_name text,
	revoked_at       timestamptz,
	revoked_by_name  text,
	revoke_reason    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;
	if not private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']) then
		raise exception 'Only owners and admins at this venue can see its verifications.';
	end if;

	return query
	select
		v.id,
		v.created_at,
		p.id,
		p.display_name,
		i.kind,
		'•••' || right(i.value, 3),
		coalesce(vb.display_name, 'TDC (Unknown staff)'),
		v.revoked_at,
		rb.display_name,
		v.revoke_reason
	from public.tbl_identifier_verifications v
	join public.tbl_player_identifiers i on i.id = v.identifier_id
	join public.tbl_players p            on p.id = i.player_id
	left join public.tbl_players vb      on vb.user_id = v.verified_by
	left join public.tbl_players rb      on rb.user_id = v.revoked_by
	where v.venue_id = p_venue_id
	order by v.created_at desc;
end;
$$;

revoke execute on function public.tdc_list_venue_verifications(uuid) from public, anon;
grant execute on function public.tdc_list_venue_verifications(uuid) to authenticated;
