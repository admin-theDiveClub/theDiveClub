-- The three columns added today — third_place, progression and create_matches
-- — have no way to be set. tdc_update_tournament predates all of them, and
-- tdc_create_tournament does not take them either, so every tournament is
-- stuck on the defaults.
--
-- Dropped and recreated rather than given an overload: adding parameters with
-- defaults alongside the existing signature leaves two candidates PostgREST
-- can resolve to, and "one place decides each thing" is worth more than
-- avoiding a drop. Nothing calls it yet.

drop function if exists public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text);

create function public.tdc_update_tournament(
	p_tournament_id     uuid,
	p_name              text        default null,
	p_rules             jsonb       default null,
	p_format            text        default null,
	p_status            text        default null,
	p_starts_at         timestamptz default null,
	p_clear_starts_at   boolean     default false,
	p_max_entrants      integer     default null,
	p_entry_fee_credits integer     default null,
	p_notes             text        default null,
	-- How the draw behaves. Null leaves each one as it is, so a page changing
	-- one setting does not have to send the other two back.
	p_third_place       boolean     default null,
	p_progression       text        default null,
	p_create_matches    text        default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_tournaments%rowtype;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can change it.';
	end if;

	if p_rules is not null then
		perform private.tdc_check_match_rules(p_rules);
	end if;

	-- Changing the format after a draw exists would leave matches wired to a
	-- shape that no longer applies.
	if p_format is not null and p_format <> v_t.format and v_t.status <> 'draft' then
		raise exception 'The format can only be changed while the tournament is still a draft.';
	end if;

	-- third_place is read when the draw is generated, so turning it on
	-- afterwards would silently do nothing. Said out loud instead.
	if p_third_place is not null and p_third_place <> v_t.third_place
		and exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'The third-place playoff is decided when the draw is generated. Redraw to change it.';
	end if;

	update public.tbl_tournaments
	set name              = coalesce(trim(p_name), name),
		rules             = coalesce(p_rules, rules),
		format            = coalesce(p_format, format),
		status            = coalesce(p_status, status),
		starts_at         = case when p_clear_starts_at then null else coalesce(p_starts_at, starts_at) end,
		max_entrants      = coalesce(p_max_entrants, max_entrants),
		entry_fee_credits = coalesce(p_entry_fee_credits, entry_fee_credits),
		notes             = coalesce(p_notes, notes),
		third_place       = coalesce(p_third_place, third_place),
		progression       = coalesce(p_progression, progression),
		create_matches    = coalesce(p_create_matches, create_matches)
	where id = p_tournament_id;
end;
$$;

revoke execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text) from public, anon;
grant execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text) to authenticated;
