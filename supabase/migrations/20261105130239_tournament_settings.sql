-- ───────────────────────────────────────────────────────────
-- A tournament's Settings tab
--
-- UV, 5 Nov: every setting offered when a tournament is created is changeable
-- afterwards, on a Settings tab, as a league's are. Two things the tab needs
-- that the database did not do:
--
--   1. A rule change reaches every match not yet started, as a league's
--      does (UV: "like leagues"). Rules are frozen onto a match when it is
--      created, so until now a changed ruleset reached only matches made
--      afterwards. private.tdc_refreeze_tournament_matches puts each
--      untouched match back onto its round's rules
--      (private.tdc_rules_for_round, which falls back to the tournament's).
--      Untouched is the league's rule: no frames and no card events. A
--      frame means something was played under the old rules; frames are
--      never rescored. A round with its own rules keeps them: they are its
--      round's, not the tournament's.
--   2. Maximum entrants can go back to "no limit". tdc_update_tournament
--      read a null as "leave it alone", so once set it could never be
--      cleared. p_clear_max_entrants, as p_clear_starts_at does for the date.
--
-- tdc_update_tournament now returns what the re-freeze did, so the page can
-- say how many matches took the new rules and how many kept their own.
-- ───────────────────────────────────────────────────────────

create function private.tdc_refreeze_tournament_matches(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_updated integer;
	v_kept    integer;
begin
	with tm as (
		select m.id,
			m.rules as old_rules,
			private.tdc_rules_for_round(f.tournament_id, f.bracket, f.round) as new_rules,
			(not exists (select 1 from public.tbl_frames fr where fr.match_id = m.id)
				and not exists (select 1 from public.tbl_match_events ev where ev.match_id = m.id)
			) as untouched
		from public.tbl_tournament_fixtures f
		join public.tbl_matches m on m.id = f.match_id
		where f.tournament_id = p_tournament_id
	),
	upd as (
		update public.tbl_matches m
		set rules = tm.new_rules
		from tm
		where m.id = tm.id and tm.untouched and tm.new_rules is distinct from tm.old_rules
		returning m.id
	)
	select (select count(*) from upd),
		(select count(*) from tm where not tm.untouched and tm.new_rules is distinct from tm.old_rules)
	into v_updated, v_kept;

	return jsonb_build_object('matches_updated', v_updated, 'matches_kept', v_kept);
end;
$$;

revoke execute on function private.tdc_refreeze_tournament_matches(uuid) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- tdc_update_tournament: clears the maximum, re-freezes on a rule change,
-- returns what the re-freeze did
--
-- Replaces the version from 20261105084149. Patched from that text, not
-- retyped. Dropped first: the arguments and the return type change.
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean, boolean);

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
	p_third_place       boolean     default null,
	p_progression       text        default null,
	p_create_matches    text        default null,
	p_auto_status       boolean     default false,
	p_entry_mode        text        default null,
	p_paid_confirms     boolean     default null,
	p_is_listed         boolean     default null,
	p_clear_max_entrants boolean    default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t public.tbl_tournaments%rowtype;
	v_p public.tbl_tournament_posters%rowtype;
	v_frozen jsonb := jsonb_build_object('matches_updated', 0, 'matches_kept', 0);
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

	if p_format is not null and p_format <> v_t.format
		and exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'This tournament already has a draw, so its format cannot be changed. Clear the draw first.';
	end if;

	if p_third_place is not null and p_third_place <> v_t.third_place
		and exists (select 1 from public.tbl_tournament_fixtures where tournament_id = p_tournament_id) then
		raise exception 'The third-place playoff is decided when the draw is generated. Redraw to change it.';
	end if;

	update public.tbl_tournaments
	set name              = coalesce(trim(p_name), name),
		rules             = coalesce(p_rules, rules),
		format            = coalesce(p_format, format),
		status            = coalesce(p_status, status),
		status_manual     = case
			when p_auto_status then false
			when p_status is not null then true
			else status_manual
		end,
		starts_at         = case when p_clear_starts_at then null else coalesce(p_starts_at, starts_at) end,
		max_entrants      = case when p_clear_max_entrants then null else coalesce(p_max_entrants, max_entrants) end,
		entry_fee_credits = coalesce(p_entry_fee_credits, entry_fee_credits),
		notes             = coalesce(p_notes, notes),
		third_place       = coalesce(p_third_place, third_place),
		progression       = coalesce(p_progression, progression),
		create_matches    = coalesce(p_create_matches, create_matches),
		entry_mode        = coalesce(p_entry_mode, entry_mode),
		paid_confirms     = coalesce(p_paid_confirms, paid_confirms),
		is_listed         = coalesce(p_is_listed, is_listed)
	where id = p_tournament_id;

	-- Visible on shares the poster (UV, 5 Nov). One that exists is rebuilt
	-- with the choices it already has, so the director's names-and-draw
	-- settings stand; with none, the poster's own defaults.
	if p_is_listed then
		select * into v_p from public.tbl_tournament_posters where tournament_id = p_tournament_id;
		perform public.tdc_publish_poster(p_tournament_id,
			coalesce(v_p.include_entrants, false), coalesce(v_p.include_draw, false), true);
	end if;

	-- After the rules are written, because the re-freeze reads them back
	-- through private.tdc_rules_for_round (as tdc_update_league does).
	if p_rules is not null then
		v_frozen := private.tdc_refreeze_tournament_matches(p_tournament_id);
	end if;

	return v_frozen;
end;
$$;

revoke execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.tdc_update_tournament(uuid, text, jsonb, text, text, timestamptz, boolean, integer, integer, text, boolean, text, text, boolean, text, boolean, boolean, boolean) to authenticated;
