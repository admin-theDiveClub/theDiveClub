-- The profile menu's two people lists (UV, 5 Nov; docs/ui.md, "The profile
-- menu"): the players I have played most recently and the players I play most
-- often, each person marked if I follow them. Read only. Worked out from the
-- frames every time, never stored (CLAUDE.md, idea 1).
--
-- Settled with UV the same day: opponents only, never teammates; across every
-- finished frame; most often counted in frames played against them; five
-- people a list.
--
-- "Finished" is a frame's own state, not its match's, so a match still being
-- played counts from its first finished frame. A walkover (result_event
-- 'default') is left out: nobody played it (Claude's, for UV to judge).
--
-- The follow mark says only whether the person asking follows them, so it
-- keeps follows private (20261105205913).

create function public.tdc_my_people(p_limit integer default 5)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	with me as (
		select id from public.tbl_players where user_id = (select auth.uid())
	),
	met as (
		select them.player_id,
			count(distinct f.id)::integer as frames,
			max(coalesce(f.ended_at, f.started_at, f.created_at)) as last_at
		from public.tbl_frame_participants mine
		join public.tbl_frames f on f.id = mine.frame_id
		join public.tbl_frame_participants them on them.frame_id = f.id and them.side <> mine.side
		where mine.player_id = (select id from me)
			and them.player_id <> mine.player_id
			and f.status = 'complete'
			and f.result_event is distinct from 'default'
		group by them.player_id
	),
	people as (
		select m.player_id, m.frames, m.last_at, p.display_name, p.avatar_path,
			exists (
				select 1 from public.tbl_player_follows w
				where w.follower_id = (select id from me) and w.followed_id = m.player_id
			) as i_follow
		from met m
		join public.tbl_players p on p.id = m.player_id
	)
	select jsonb_build_object(
		'recent', coalesce((
			select jsonb_agg(to_jsonb(x) order by x.last_at desc, x.display_name)
			from (
				select * from people
				order by last_at desc, display_name
				limit greatest(1, least(coalesce(p_limit, 5), 20))
			) x
		), '[]'::jsonb),
		'often', coalesce((
			select jsonb_agg(to_jsonb(x) order by x.frames desc, x.last_at desc, x.display_name)
			from (
				select * from people
				order by frames desc, last_at desc, display_name
				limit greatest(1, least(coalesce(p_limit, 5), 20))
			) x
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.tdc_my_people(integer) from public, anon;
grant execute on function public.tdc_my_people(integer) to authenticated;
