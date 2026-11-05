-- The players I follow, listed on /players/ so I can stop following any of them
-- (UV, 5 Nov; docs/systems/players.md, "Follow"). Read only, and only ever the
-- list of the person asking: nothing here says who follows anybody, so follows
-- stay private to the follower (20261105205913). Stopping is the existing
-- tdc_set_follow.

create function public.tdc_my_follows()
returns table (player_id uuid, display_name text, full_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id,
		p.display_name,
		nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
		p.avatar_path
	from public.tbl_player_follows f
	join public.tbl_players me on me.id = f.follower_id
	join public.tbl_players p on p.id = f.followed_id
	where me.user_id = (select auth.uid())
	order by lower(p.display_name), p.id;
$$;

revoke execute on function public.tdc_my_follows() from public, anon;
grant execute on function public.tdc_my_follows() to authenticated;
