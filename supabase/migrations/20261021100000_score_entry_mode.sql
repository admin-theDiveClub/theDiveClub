-- Making score_entry_mode mean something.
--
-- The setting has existed since 20261015100000, is validated, and is offered
-- on the create page with four values. It has never been enforced anywhere:
-- a tournament set to 'td_only' let any player in the match score it. A
-- setting that silently does nothing is worse than no setting, because the TD
-- picks it and believes it.
--
-- ─── Why this goes in tdc_can_edit_match ───
--
-- Principle 4: one place decides each permission. "May this person change
-- this card" is that place, and it is already asked by every write, by the
-- lock guard's callers, and — through tdc_may_edit_match — by the match page
-- before it draws any controls.
--
-- Putting it here rather than in a second trigger means the page stops
-- offering scoring buttons to somebody who may not score, instead of offering
-- them and having the database refuse. That is the house rule: don't offer
-- buttons that lead to invalid states.
--
-- ─── What the modes mean ───
--
--   players   anyone who may touch the card, which is the default and the
--             behaviour everything has had until now
--   scorer    a scorer, a referee or the director
--   referee   a referee or the director
--   td_only   the director alone (and venue staff where the tournament
--             belongs to a venue, who already count as running it)
--
-- A social match has no competition and no officials, so none of this applies
-- to one: a ruleset key about who may score has no meaning when the only
-- people involved are the two playing.

-- ─────────────────────────────────────────────────────────────────
-- The caller's standing on this match, as a number
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_score_rank(p_match_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_comp uuid;
begin
	v_comp := private.tdc_match_competition(p_match_id);
	if v_comp is null then
		return 0;
	end if;

	-- Running the competition outranks every role in it. This is the same
	-- test the rest of the tournament code uses, so a venue's staff are
	-- included wherever the tournament belongs to a venue.
	if private.tdc_can_run_tournament(v_comp) then
		return 100;
	end if;

	-- Otherwise the highest role they hold in it: referee 50, scorer 30.
	-- Nothing, for a player who is only playing, which is rank 0.
	return private.tdc_competition_rank(v_comp);
end;
$$;

revoke execute on function private.tdc_score_rank(uuid) from public, anon;
grant execute on function private.tdc_score_rank(uuid) to authenticated;


-- The rank a match's ruleset demands before somebody may touch its frames.
create function private.tdc_required_score_rank(p_mode text)
returns integer
language sql
immutable
as $$
	select case coalesce(p_mode, 'players')
		when 'td_only'  then 100
		when 'referee'  then 50
		when 'scorer'   then 30
		else 0          -- 'players', and anything unrecognised: no restriction
	end;
$$;


create function private.tdc_meets_score_entry_mode(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_rules    jsonb;
	v_required integer;
begin
	-- Not in a competition: nobody to outrank, nothing to enforce.
	if private.tdc_match_competition(p_match_id) is null then
		return true;
	end if;

	select rules into v_rules from public.tbl_matches where id = p_match_id;
	v_required := private.tdc_required_score_rank(v_rules->>'score_entry_mode');
	if v_required = 0 then
		return true;
	end if;

	return private.tdc_score_rank(p_match_id) >= v_required;
end;
$$;

revoke execute on function private.tdc_meets_score_entry_mode(uuid) from public, anon;
grant execute on function private.tdc_meets_score_entry_mode(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- One place decides
--
-- Replaces the version from 20261020100000. The branches are unchanged and
-- their comments are kept, because they are still the reasons; the whole lot
-- is now also conditional on the match's score_entry_mode.
-- ─────────────────────────────────────────────────────────────────

create or replace function private.tdc_can_edit_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.tbl_matches m
		where m.id = p_match_id
			and (
				-- Either side's player, in a singles match.
				exists (
					select 1
					from public.tbl_players p
					where p.user_id = (select auth.uid())
						and p.id in (m.home_player_id, m.away_player_id)
				)
				-- Anyone who actually played a frame. This is what covers a team
				-- match, where the sides are teams and the people are in frames.
				or exists (
					select 1
					from public.tbl_frames f
					join public.tbl_frame_participants fp on fp.frame_id = f.id
					join public.tbl_players p on p.id = fp.player_id
					where f.match_id = m.id
						and p.user_id = (select auth.uid())
				)
				-- Staff at the venue the match is being played at.
				or (
					m.venue_id is not null
					and private.tdc_has_venue_role(m.venue_id, array['owner', 'admin', 'staff'])
				)
				-- Anyone holding a role in a competition this match belongs to:
				-- its director, referee or scorer. Without this a TD who is not
				-- playing and is not venue staff cannot score their own
				-- tournament, which is the whole of principle 8.
				or exists (
					select 1
					from public.tbl_tournament_fixtures x
					join public.tbl_competition_roles r on r.tournament_id = x.tournament_id
					join public.tbl_players p on p.id = r.player_id
					where x.match_id = m.id
						and p.user_id = (select auth.uid())
				)
			)
	)
	-- And, in a competition, they must also be senior enough for the way this
	-- tournament has chosen to have its scores entered.
	and private.tdc_meets_score_entry_mode(p_match_id);
$$;


-- ─────────────────────────────────────────────────────────────────
-- So a page can say why, rather than just going quiet
--
-- tdc_may_edit_match already tells a page whether it may draw the controls.
-- When the answer is no because of the mode rather than because the person is
-- a stranger, the page should be able to say so — a player who finds the
-- scoring buttons missing deserves a sentence, not a blank card.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_score_entry_note(p_match_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_rules jsonb;
	v_mode  text;
begin
	if private.tdc_match_competition(p_match_id) is null then
		return null;
	end if;
	if private.tdc_meets_score_entry_mode(p_match_id) then
		return null;
	end if;

	select rules into v_rules from public.tbl_matches where id = p_match_id;
	v_mode := coalesce(v_rules->>'score_entry_mode', 'players');

	return case v_mode
		when 'td_only' then 'Only the tournament director enters scores in this tournament.'
		when 'referee' then 'Only a referee or the tournament director enters scores in this tournament.'
		when 'scorer'  then 'Only a scorer, a referee or the tournament director enters scores in this tournament.'
		else null
	end;
end;
$$;

revoke execute on function public.tdc_score_entry_note(uuid) from public, anon;
grant execute on function public.tdc_score_entry_note(uuid) to authenticated;
