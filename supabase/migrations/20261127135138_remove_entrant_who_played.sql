-- Removing an entrant who has played marks them withdrawn instead (STATUS
-- 1a B6; UV, 27 Nov: "fix it"; docs/systems/tournaments.md, "Removing an
-- entrant who has played").
--
-- tdc_remove_entrant deleted the entrant row whatever the draw held. The
-- fixtures point at entrants "on delete set null", so a player who had lost
-- in round 1 and was then removed by mistake vanished from their round-1
-- fixture: the decided bracket history went blank. Its own comment said so:
-- "Once a draw exists this will have to refuse, or withdraw instead".
--
-- Now: an entrant on a fixture with a match (started or played), or awarded
-- a fixture (a bye, walkover, withdrawal or decision), is marked withdrawn
-- and kept; anybody else is deleted as before. It returns which: 'removed'
-- or 'withdrawn', so the page can say so. The return type changes (it was
-- void), so the function is dropped and made again; patched from
-- 20261019140000's text, the original lines kept.
--
-- An entrant in a round-1 slot whose match has not been started is still
-- deleted, leaving the slot empty, as before: nothing has been decided there,
-- and the draw's own controls fill it.

drop function public.tdc_remove_entrant(uuid);

create function public.tdc_remove_entrant(p_entrant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_tournament uuid;
begin
	select tournament_id into v_tournament
	from public.tbl_tournament_entrants where id = p_entrant_id;

	if v_tournament is null then
		raise exception 'TDC (Error): entrant % not found.', p_entrant_id;
	end if;

	if not private.tdc_can_run_tournament(v_tournament) then
		raise exception 'Only the people running this tournament can remove entrants.';
	end if;

	-- Played, or awarded a fixture: deleting would blank the bracket's
	-- history, so they are withdrawn and kept (B6, 27 Nov).
	if exists (
		select 1 from public.tbl_tournament_fixtures f
		where f.tournament_id = v_tournament
			and (
				(f.match_id is not null and p_entrant_id in (f.home_entrant_id, f.away_entrant_id))
				or f.advanced_entrant_id = p_entrant_id
			)
	) then
		update public.tbl_tournament_entrants set status = 'withdrawn' where id = p_entrant_id;
		return 'withdrawn';
	end if;

	delete from public.tbl_tournament_entrants where id = p_entrant_id;
	return 'removed';
end;
$$;
revoke execute on function public.tdc_remove_entrant(uuid) from public, anon;
grant execute on function public.tdc_remove_entrant(uuid) to authenticated;
comment on function public.tdc_remove_entrant(uuid) is
	'Takes an entrant out: deleted, or marked withdrawn and kept when they are on a fixture with a match or were awarded one (B6). Returns removed or withdrawn.';
