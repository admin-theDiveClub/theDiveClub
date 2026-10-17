-- When a match is being played.
--
-- tbl_matches.scheduled_at has existed since the first matches migration and
-- nothing has ever written to it: there was no field on the create page and no
-- control on the match page, so every match has been "now, apparently".
--
-- It gets its own function rather than joining tdc_update_match_settings,
-- because the time is not a rule. Settings re-derive every break side and can
-- put frames back that the new rules made impossible; a time changes nothing
-- about what was played. Folding it in would mean re-deriving a whole match to
-- move a fixture by an hour.
--
-- Clearing it is allowed and means "no particular time" — the state every
-- social match starts in and should be able to return to.

create function public.tdc_set_match_time(p_match_id uuid, p_scheduled_at timestamptz default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_match public.tbl_matches%rowtype;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'Only the players in this match and venue staff can change when it is played.';
	end if;

	-- A settled card is a match that has been played. Scheduling it is either a
	-- mistake or a sign the wrong match is open.
	if (private.tdc_card_state(p_match_id)->>'state') = 'agreed' then
		raise exception 'This scorecard has been settled. Reopen it before changing the match.';
	end if;

	-- Far enough either side to cover a fixture list published a season ahead
	-- and a game being written up the morning after, while still catching a
	-- year typed wrong.
	if p_scheduled_at is not null
		and (p_scheduled_at < now() - interval '2 years' or p_scheduled_at > now() + interval '2 years') then
		raise exception 'TDC (Error): that date is more than two years away — check the year.';
	end if;

	update public.tbl_matches
	set scheduled_at = p_scheduled_at
	where id = p_match_id;

	return p_scheduled_at;
end;
$$;

revoke execute on function public.tdc_set_match_time(uuid, timestamptz) from public, anon;
grant execute on function public.tdc_set_match_time(uuid, timestamptz) to authenticated;
