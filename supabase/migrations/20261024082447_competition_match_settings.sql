-- A competition match's rules and time are its director's, and nobody's
-- once its result is settled.
--
-- Audit items A2 and A3 (docs/STATUS.md, 23 Oct).
--
-- A2. tdc_update_match_settings let anybody who could edit the card change
-- its rules, and refused only an *agreed* card. In a tournament that meant a
-- player could open an approved match and turn approval off: the rules
-- change moved card_version on, the approval stopped matching, and the
-- result was quietly unpublished.
--
-- A3. tdc_set_match_time had the same two gaps. On a league match the time
-- also decides the lineup cutoff, which is counted back from it, so a
-- player could move a cutoff the other captain was working to.
--
-- Now:
--   • private.tdc_can_change_match is the one place "who may change this
--     match's rules and time" is answered: the people running the tournament
--     (private.tdc_can_run_tournament) or league season
--     (private.tdc_can_run_league) for a match on their fixtures; for a
--     social match, whoever may edit the card, as before. True or false,
--     never null. tdc_may_change_match asks it for the match page, which
--     disables the settings and the time for anybody it would refuse.
--   • A player in a competition match may still record who won the lag.
--     The page sends the lag winner through tdc_update_match_settings with
--     the rules unchanged, so the rules are checked only when they differ
--     from the stored ones (UV, 24 Oct). Referees and scorers are treated
--     as players here: they score, they do not change the rules.
--   • Both functions refuse a locked card — agreed, approved or published
--     (private.tdc_card_is_locked) — for everyone, directors included. A
--     director sends the result back first. The old refusals told the
--     player to reopen the card, which players cannot do since 20261023190825.
--
-- Both functions are patched from their definitions as of 20261017140000
-- (time) and 20261015180000 (settings), extracted from a freshly reset local
-- database.


create function private.tdc_can_change_match(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_t  uuid;
	v_ls uuid;
begin
	v_t := private.tdc_match_competition(p_match_id);
	if v_t is not null then
		return coalesce(private.tdc_can_run_tournament(v_t), false);
	end if;

	v_ls := private.tdc_league_season_of_match(p_match_id);
	if v_ls is not null then
		return coalesce(private.tdc_can_run_league(v_ls), false);
	end if;

	return coalesce(private.tdc_can_edit_match(p_match_id), false);
end;
$$;

revoke execute on function private.tdc_can_change_match(uuid) from public, anon, authenticated;

create function public.tdc_may_change_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select (select auth.uid()) is not null and private.tdc_can_change_match(p_match_id);
$$;

revoke execute on function public.tdc_may_change_match(uuid) from public, anon;
grant  execute on function public.tdc_may_change_match(uuid) to authenticated;


CREATE OR REPLACE FUNCTION public.tdc_update_match_settings(p_match_id uuid, p_rules jsonb, p_first_break_side text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_status   text;
	v_rules    jsonb;
	v_requires boolean;
	v_golden   boolean;
	v_reverse  boolean;
	v_breaks   integer;
	v_results  integer := 0;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select status, rules into v_status, v_rules from public.tbl_matches where id = p_match_id;
	if v_status is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'You are not on this match and cannot change its settings.';
	end if;

	if v_status = 'abandoned' then
		raise exception 'This match was abandoned. Its settings can no longer be changed.';
	end if;

	-- Agreed, approved or published (audit A2, 24 Oct). Checking "agreed"
	-- alone let a player change an approved tournament card's rules, which
	-- moved its card_version on and quietly unpublished the result.
	if private.tdc_card_is_locked(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null
			or private.tdc_league_season_of_match(p_match_id) is not null then
			raise exception 'This result is settled. It has to be sent back before the match can be changed.';
		end if;
		raise exception 'This scorecard is settled and final.';
	end if;

	-- In a tournament or league the rules are the director's. A player may
	-- still record who won the lag, which comes through here with the rules
	-- sent back unchanged (jsonb equality ignores key order).
	if p_rules is distinct from v_rules and not private.tdc_can_change_match(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null then
			raise exception 'Only the people running this tournament can change this match''s rules.';
		end if;
		raise exception 'Only the people running this league can change this match''s rules.';
	end if;

	perform private.tdc_check_match_rules(p_rules);

	if p_first_break_side is not null and p_first_break_side not in ('home', 'away') then
		raise exception 'TDC (Error): first_break_side must be home or away, not "%".', p_first_break_side;
	end if;

	update public.tbl_matches
	set rules            = p_rules,
		first_break_side = coalesce(p_first_break_side, first_break_side),
		card_version     = card_version + 1
	where id = p_match_id;

	v_breaks := public.tdc_rederive_break_sides(p_match_id);

	v_requires := coalesce((p_rules->>'break_finish_requires_breaker')::boolean, true);
	v_golden   := coalesce((p_rules->>'golden_break_enabled')::boolean, true);
	v_reverse  := coalesce((p_rules->>'reverse_break_finish_enabled')::boolean, true);

	with repaired as (
		update public.tbl_frames f
		set result_event = 'win'
		where f.match_id = p_match_id
			and f.status = 'complete'
			and (
				(f.result_event in ('break_and_finish', 'golden_break')
					and (f.break_outcome is distinct from 'in'
						or (v_requires and f.winner_side is distinct from f.break_side)))
				or (f.result_event = 'golden_break' and not v_golden)
				or (f.result_event = 'reverse_break_and_finish'
					and (not v_reverse or f.winner_side = f.break_side or f.break_side is null))
			)
		returning 1
	)
	select count(*) into v_results from repaired;

	return jsonb_build_object('breaks_changed', v_breaks, 'results_downgraded', v_results);
end;
$function$;

CREATE OR REPLACE FUNCTION public.tdc_set_match_time(p_match_id uuid, p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

	-- In a tournament or league the time is the director's (audit A3, 24 Oct).
	-- On a league match it also decides the lineup cutoff, which is counted
	-- back from it.
	if not private.tdc_can_change_match(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null then
			raise exception 'Only the people running this tournament can change when this match is played.';
		end if;
		raise exception 'Only the people running this league can change when this match is played.';
	end if;

	-- A settled card is a match that has been played. Scheduling it is either a
	-- mistake or a sign the wrong match is open. Agreed, approved or published:
	-- "agreed" alone missed an approved competition card.
	if private.tdc_card_is_locked(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null
			or private.tdc_league_season_of_match(p_match_id) is not null then
			raise exception 'This result is settled. It has to be sent back before the match can be changed.';
		end if;
		raise exception 'This scorecard is settled and final.';
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
$function$;
