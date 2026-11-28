-- The tournament follow page (UV, 28 Nov; docs/systems/tournaments.md,
-- "The follow page").
--
-- UV: a single page the TD puts on a TV at the venue and leaves for the
-- night, "knowing that everything will just work". Signed in only (TVs will
-- sign in by QR code); any signed-in account may open it (UV, 28 Nov). It
-- starts with the QR for entry and the entrants, shows the bracket once the
-- draw is made, and from the first started match a QR to each player's match.
--
-- One read for all of it, asked every few seconds by the page:
-- tdc_tournament_entrants is for whoever runs the tournament only, and the
-- poster's live read depends on the poster being shared. This returns the
-- heading's facts, the short code (for the QR), whether there is a draw and
-- whether play has started, and the entrants still in (display names and
-- pictures, as the draw already shows any signed-in player).
--
-- "Play has started" is any fixture with a match, or any result given on the
-- draw other than a bye (a walkover, withdrawal or decision), or the
-- tournament's own status in play or finished. It is what moves the page's
-- QR from entering to "your match".

create function public.tdc_tournament_follow(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'id', t.id,
		'name', t.name,
		'format', t.format,
		'status', t.status,
		'starts_at', t.starts_at,
		'max_entrants', t.max_entrants,
		'discipline', t.rules ->> 'discipline',
		'win_condition_type', t.rules ->> 'win_condition_type',
		'win_condition_target', t.rules -> 'win_condition_target',
		'short_code', t.short_code,
		'has_draw', exists (
			select 1 from public.tbl_tournament_fixtures f where f.tournament_id = t.id),
		'started', t.status in ('in_progress', 'complete') or exists (
			select 1 from public.tbl_tournament_fixtures f
			where f.tournament_id = t.id
				and (f.match_id is not null or f.advance_reason in ('walkover', 'withdrawal', 'decision'))),
		'entrants', coalesce((
			select jsonb_agg(jsonb_build_object(
					'player_id', p.id,
					'display_name', p.display_name,
					'avatar_path', p.avatar_path,
					'status', e.status)
				order by e.status, e.created_at, p.display_name)
			from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = t.id and e.status in ('confirmed', 'interested')), '[]'::jsonb)
	)
	from public.tbl_tournaments t
	where t.id = p_tournament_id
		and auth.uid() is not null;
$$;

revoke execute on function public.tdc_tournament_follow(uuid) from public, anon;
grant execute on function public.tdc_tournament_follow(uuid) to authenticated;

comment on function public.tdc_tournament_follow(uuid) is
	'The tournament follow page (a TV at the venue): the heading''s facts, the short code, whether there is a draw and whether play has started, and the confirmed and interested entrants. Any signed-in account (UV, 28 Nov).';
