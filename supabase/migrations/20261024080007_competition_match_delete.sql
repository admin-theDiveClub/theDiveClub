-- A competition match can be deleted only by the people running it.
--
-- Audit item A1 (docs/STATUS.md, 23 Oct). tdc_delete_match let anybody
-- "on the match" delete it unless it was sanctioned, and nothing is
-- sanctioned today. In a tournament that was either player, even after the
-- result was approved. In a league it was worse than the audit said:
-- private.tdc_my_player_on_match counts anybody with a frame, so any of the
-- ten players on a team night could delete the whole card. The frames go,
-- and the fixture is left with no match.
--
-- Now:
--   • a match on a tournament fixture: the people who run that tournament
--     (private.tdc_can_run_tournament);
--   • a match on a league fixture: the people who run that league season
--     (private.tdc_can_run_league);
--   • a social match: either player, settled or not — unchanged, and UV's
--     decision of 23 Oct ("Players may still delete a settled social match");
--   • a sanctioned match: nobody, as before.
--
-- private.tdc_can_delete_match is the one place this is answered. The
-- delete asks it, and so does tdc_may_delete_match, which the match page asks
-- before offering the button, so a player in a tournament match is not shown
-- a button that would be refused.
--
-- **Found while testing this: deleting any match with a frame had failed
-- since 21 Oct.** Deleting the match cascades to its frames, and the frame
-- edit log (20261021110000) then wrote a row — and could send a notification
-- — naming a match that no longer existed, which its foreign key refused. So
-- "Delete match" broke for every match with a frame played, social ones
-- included; production has no deletion since 18 Oct. The log now skips a
-- frame deleted because its match is going: the log rows would be cascaded
-- away with the match anyway, and tbl_deleted_matches keeps the summary.
--
-- tdc_delete_match is patched from its definition as of 20261015200000,
-- extracted from a freshly reset local database. deleted_by is now whoever
-- deleted it (private.tdc_me()) rather than the player on the match, because
-- a director deleting a match need not be playing in it.


create function private.tdc_can_delete_match(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_m  public.tbl_matches%rowtype;
	v_t  uuid;
	v_ls uuid;
begin
	select * into v_m from public.tbl_matches where id = p_match_id;
	if v_m.id is null or coalesce(v_m.sanctioned, false) then
		return false;
	end if;

	v_t := private.tdc_match_competition(p_match_id);
	if v_t is not null then
		return coalesce(private.tdc_can_run_tournament(v_t), false);
	end if;

	v_ls := private.tdc_league_season_of_match(p_match_id);
	if v_ls is not null then
		return coalesce(private.tdc_can_run_league(v_ls), false);
	end if;

	return private.tdc_my_player_on_match(p_match_id) is not null;
end;
$$;

revoke execute on function private.tdc_can_delete_match(uuid) from public, anon, authenticated;

create function public.tdc_may_delete_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select (select auth.uid()) is not null and private.tdc_can_delete_match(p_match_id);
$$;

revoke execute on function public.tdc_may_delete_match(uuid) from public, anon;
grant  execute on function public.tdc_may_delete_match(uuid) to authenticated;


CREATE OR REPLACE FUNCTION public.tdc_delete_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_me      uuid;
	v_match   public.tbl_matches%rowtype;
	v_home    text;
	v_away    text;
	v_hs      integer;
	v_as      integer;
	v_frames  integer;
begin
	if (select auth.uid()) is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	select * into v_match from public.tbl_matches where id = p_match_id;
	if v_match.id is null then raise exception 'TDC (Error): match % not found.', p_match_id; end if;

	if v_match.sanctioned then
		raise exception 'This match counts towards rankings and cannot be deleted. Ask the organiser.';
	end if;

	-- One place decides (audit A1, 24 Oct): the people running a tournament
	-- or league for a match on its fixtures, the players for a social one.
	if not private.tdc_can_delete_match(p_match_id) then
		if private.tdc_match_competition(p_match_id) is not null then
			raise exception 'This match is part of a tournament. Only the people running it can delete it.';
		elsif private.tdc_league_season_of_match(p_match_id) is not null then
			raise exception 'This match is part of a league. Only the people running it can delete it.';
		end if;
		raise exception 'Only the players in this match can delete it.';
	end if;

	v_me := private.tdc_me();

	-- Everything worth keeping, gathered while it still exists.
	select p.display_name into v_home from public.tbl_players p where p.id = v_match.home_player_id;
	select p.display_name into v_away from public.tbl_players p where p.id = v_match.away_player_id;

	select count(*) filter (where status = 'complete' and winner_side = 'home'),
		count(*) filter (where status = 'complete' and winner_side = 'away'),
		count(*)
		into v_hs, v_as, v_frames
	from public.tbl_frames where match_id = p_match_id;

	insert into public.tbl_deleted_matches (match_id, deleted_by, home_player_id, away_player_id, summary)
	values (
		p_match_id, v_me, v_match.home_player_id, v_match.away_player_id,
		coalesce(v_home, 'Home') || ' ' || v_hs || ' – ' || coalesce(v_away, 'Away') || ' ' || v_as
			|| ', ' || v_frames || ' frame' || case when v_frames = 1 then '' else 's' end
	)
	on conflict (match_id) do nothing;

	perform set_config('tdc.card_unlock', 'on', true);
	delete from public.tbl_matches where id = p_match_id;
	perform set_config('tdc.card_unlock', 'off', true);
end;
$function$;

-- ─── The frame edit log lets a match be deleted ───
-- Patched from its definition as of 20261022130000.

CREATE OR REPLACE FUNCTION private.tdc_frame_edit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_match uuid := coalesce(new.match_id, old.match_id);
	v_me    uuid;
	v_rank  integer;
begin
	-- A frame deleted because its match is being deleted: nothing to log, and
	-- the match row is already gone, so the log row's foreign key would refuse
	-- it and take the whole delete down (audit A1 testing, 24 Oct).
	if tg_op = 'DELETE' and not exists (select 1 from public.tbl_matches where id = v_match) then
		return old;
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());
	v_rank := coalesce(private.tdc_score_rank(v_match), 0);

	insert into public.tbl_frame_edit (
		match_id, frame_id, frame_no, action,
		edited_by_player_id, editor_role, editor_rank, card_version,
		before, after
	)
	values (
		v_match,
		coalesce(new.id, old.id),
		coalesce(new.frame_no, old.frame_no),
		lower(tg_op),
		v_me,
		private.tdc_editor_role(v_rank),
		v_rank,
		-- Read after the fact: the card_version trigger has already bumped it,
		-- so this is the version this edit produced, which is the one a stale
		-- submission is compared against.
		coalesce((select m.card_version from public.tbl_matches m where m.id = v_match), 0),
		case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
		case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
	);

	-- Tell the players an official changed their card. Added 20261022100000.
	--
	-- Only an editor who is **not in the match**. This trigger fires on every
	-- frame write, so without that test a player scoring their own match
	-- would send their opponent a message per frame. A player editing their
	-- own card is the card flow's business, not this.
	--
	-- Collapsed, so a TD correcting five frames leaves one notification.
	if v_me is not null then
		declare
			v_home uuid;
			v_away uuid;
			v_who  text;
		begin
			select home_player_id, away_player_id into v_home, v_away
			from public.tbl_matches where id = v_match;

			if v_me is distinct from v_home and v_me is distinct from v_away then
				select display_name into v_who from public.tbl_players where id = v_me;

				perform private.tdc_notify_collapsing(v_home, 'match', 'frame_changed',
					'Your scorecard was changed',
					coalesce(v_who, 'Somebody') || ' changed frame '
						|| coalesce(new.frame_no, old.frame_no) || '.',
					'/match/?id=' || v_match, v_match, null, v_me);

				perform private.tdc_notify_collapsing(v_away, 'match', 'frame_changed',
					'Your scorecard was changed',
					coalesce(v_who, 'Somebody') || ' changed frame '
						|| coalesce(new.frame_no, old.frame_no) || '.',
					'/match/?id=' || v_match, v_match, null, v_me);
			end if;
		end;
	end if;

	return coalesce(new, old);
end;
$function$;
