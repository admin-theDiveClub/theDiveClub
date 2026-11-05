-- A tournament's card opens its poster until the tournament starts, then the
-- draw (UV, 5 Nov). Everybody's card, the director's included: the poster's
-- foot has the director's Entrants and Draw links.
--
-- The card can only send somebody to a poster they can open, or the poster
-- page says "Nothing here". So tdc_my_tournaments says whether this account
-- can: a poster exists and is shared, or exists and they run the tournament
-- (tdc_tournament_poster shows an unshared one to whoever runs it). Without
-- one the card opens the draw (UV: "open the draw instead").
--
-- Patched from 20261021120000, the only definition: one column added. The
-- return type changes, so it is dropped and created again, grants with it.

drop function if exists public.tdc_my_tournaments(integer);

create function public.tdc_my_tournaments(p_limit integer default 50)
returns table (
	id            uuid,
	name          text,
	format        text,
	status        text,
	status_manual boolean,
	starts_at     timestamptz,
	venue_name    text,
	entrants      integer,
	i_run_it      boolean,
	poster_open   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	)
	select t.id, t.name, t.format,
		private.tdc_tournament_status(t.id),
		t.status_manual,
		t.starts_at, v.name,
		(select count(*)::integer from public.tbl_tournament_entrants e
			where e.tournament_id = t.id and e.status <> 'withdrawn'),
		private.tdc_can_run_tournament(t.id),
		exists (
			select 1 from public.tbl_tournament_posters p
			where p.tournament_id = t.id
				and (p.is_public or private.tdc_can_run_tournament(t.id))
		)
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
