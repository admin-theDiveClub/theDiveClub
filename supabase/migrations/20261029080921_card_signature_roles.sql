-- A team card's signatures say what they were signed as (UV, 29 Oct).
--
-- A league director may sign either side of a team card; the database has
-- allowed it since 20261023090000. What nobody could tell afterwards was
-- whether a signature was a captain's or the director's: the event held only
-- who pressed it. UV: anyone who runs the league signs **as the league
-- director**, on every side, their own team's included; the card page says
-- so on the signature lines and in the list of changes.
--
--   signed_as   'director' or 'captain', on a team card's signatures only.
--               Taken when the signature is written, so a director who later
--               steps down is still shown as having signed as one.
--   tdc_card_signatures(match)
--               every signature on a team card, newest first, with the name,
--               side, role, time and the version it was given at. Signed-in
--               users only, as tdc_match_card is: the card is read by anybody
--               following the night.
--
-- ── The signatures already given ──
--
-- Filled in from what is known now: a signer who holds a league role of
-- rank 100 or more on that season ran it, and so did a signer who was not a
-- captain of that side, because nobody else may sign. The one case this
-- cannot see, venue staff who were also that side's captain, had not
-- happened in production when this was written (seven signatures, 29 Oct).

alter table public.tbl_match_events
	add column signed_as text check (signed_as in ('captain', 'director'));

comment on column public.tbl_match_events.signed_as is
	'Team play, on a signature: captain, or director when the signer runs the league (any side, 29 Oct). Null elsewhere.';

update public.tbl_match_events e
set signed_as = case
	when exists (
		select 1 from public.tbl_league_fixtures fx
		join public.tbl_competition_roles r on r.league_season_id = fx.league_season_id
		join public.tbl_competition_role_types t on t.key = r.role
		where fx.match_id = e.match_id and r.player_id = e.player_id and t.rank >= 100
	) then 'director'
	when exists (
		select 1 from public.tbl_matches m
		join public.tbl_league_season_entrants le
			on le.team_id = case e.side when 'home' then m.home_team_id else m.away_team_id end
		where m.id = e.match_id and le.player_id = e.player_id and le.is_captain
	) then 'captain'
	else 'director'
end
where e.kind = 'submitted' and e.side is not null;

-- ── Every signature on a card ──
create function public.tdc_card_signatures(p_match_id uuid)
returns table (at timestamptz, side text, by_name text, signed_as text, card_version integer)
language sql
stable
security definer
set search_path = ''
as $$
	select e.created_at, e.side, coalesce(p.display_name, 'TDC (No Name)'), e.signed_as, e.card_version
	from public.tbl_match_events e
	left join public.tbl_players p on p.id = e.player_id
	where (select auth.uid()) is not null
		and e.match_id = p_match_id and e.kind = 'submitted' and e.side is not null
	order by e.created_at desc, e.id desc;
$$;
revoke execute on function public.tdc_card_signatures(uuid) from public, anon;
grant execute on function public.tdc_card_signatures(uuid) to authenticated;

-- ── Signing records what it was signed as ──
-- Patched from 20261029075957 (taken from a freshly reset database).
CREATE OR REPLACE FUNCTION public.tdc_submit_card(p_match_id uuid, p_side text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me     uuid;
	v_match  public.tbl_matches%rowtype;
	v_state  text;
	v_frames integer;
	v_team   boolean;
	v_side   text;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	if not private.tdc_can_edit_match(p_match_id) then
		raise exception 'Only the players in this match, venue staff, or the people running its competition can submit its scorecard.';
	end if;

	-- In a team match a captain signs for their own side, and signing is
	-- captain-only: a player may record their own frame but not put the
	-- team's name to the night. The league director may sign for either, and
	-- has to say which.
	v_team := v_match.home_side_kind = 'team' and v_match.away_side_kind = 'team';
	if v_team then
		v_side := coalesce(p_side, private.tdc_league_match_side(p_match_id));
		if v_side is null then
			raise exception 'Only a captain signs a team card. Say which side if you are running the league.';
		end if;
		if v_side not in ('home', 'away') then
			raise exception 'TDC (Error): side must be home or away, not "%".', v_side;
		end if;
		if not private.tdc_can_set_lineup(p_match_id, v_side) then
			raise exception 'Only that team''s captain, or the league director, can sign its card.';
		end if;
	elsif p_side is not null then
		raise exception 'TDC (Error): only a team match has sides to submit for.';
	end if;

	-- The event records who pressed it, so a coordinator submitting on behalf
	-- of two walk-ins is attributed to the coordinator rather than to nobody.
	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	if v_me is null then
		raise exception 'TDC (Error): no player profile for this account.';
	end if;

	select count(*) into v_frames from public.tbl_frames where match_id = p_match_id;
	if v_frames = 0 then
		raise exception 'There is nothing to submit yet — no frames have been played.';
	end if;

	v_state := private.tdc_card_state(p_match_id)->>'state';
	-- 'awaiting' on a team card means the other side has signed and this one
	-- has not, which is exactly when this side needs to sign. Only a signature
	-- already standing against this very card is refused.
	if v_state = 'awaiting' and not v_team then
		raise exception 'This scorecard has already been submitted and is waiting on the other player.';
	end if;
	if v_team and exists (
		select 1 from public.tbl_match_events
		where match_id = p_match_id and kind = 'submitted' and side = v_side
			and card_version = v_match.card_version
	) or coalesce((private.tdc_card_state(p_match_id)->'sides'->v_side->>'current')::boolean, false) then
		raise exception 'You have already signed this card as it stands.';
	end if;
	if v_state = 'agreed' then
		raise exception 'This scorecard has already been agreed.';
	end if;
	if v_state = 'approved' then
		raise exception 'This result has already been published.';
	end if;

	-- Signing says this is the final card, so a seat still empty is now a
	-- walkover. Before the signature, so the version signed includes them.
	if v_team and private.tdc_settle_empty_seats(p_match_id) > 0 then
		select card_version into v_match.card_version from public.tbl_matches where id = p_match_id;
	end if;

	-- The card's fingerprint with the signature, so an edit undone later
	-- brings it back (private.tdc_card_state). Singles leaves it unused.
	-- And what it was signed as: whoever runs the league signs as the league
	-- director, their own team's side included (UV, 29 Oct); anybody else
	-- who may sign is that side's captain.
	insert into public.tbl_match_events (match_id, player_id, kind, card_version, side, card_fingerprint, signed_as)
	values (p_match_id, v_me, 'submitted', v_match.card_version, v_side,
		case when v_team then private.tdc_card_fingerprint(p_match_id) end,
		case when v_team then case
			when coalesce(private.tdc_can_run_league(private.tdc_league_season_of_match(p_match_id)), false) then 'director'
			else 'captain' end end);

	-- Nobody has to sign this one. Submitting is the end of it. Never on a
	-- team card, which wants both captains however the approval mode is set.
	if not v_team and coalesce(v_match.rules->>'approval_mode', 'none') = 'none' then
		insert into public.tbl_match_events (match_id, player_id, kind, card_version, note)
		values (p_match_id, v_me, 'agreed', v_match.card_version,
			'Settled on submission: this match was set to need no approval.');
	end if;

	-- A team match is over when both captains have signed, not when the first
	-- one does. Marking it complete on one signature would close a night the
	-- other side has not seen.
	if not v_team or private.tdc_card_state(p_match_id)->>'state' = 'agreed' then
		update public.tbl_matches
		set status   = case when status in ('scheduled', 'in_progress') then 'complete' else status end,
			ended_at = coalesce(ended_at, now())
		where id = p_match_id;
	end if;

	return private.tdc_card_state(p_match_id);
end;
$function$;
