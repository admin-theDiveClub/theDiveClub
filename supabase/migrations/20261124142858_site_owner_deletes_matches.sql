-- The site owner may delete any match (UV, 24 Nov; docs/DECISIONS.md, 24 Nov,
-- "The site owner runs every league, tournament and match").
--
-- 20261124142305 let the site owner edit every card and change every match's
-- settings, and delete a competition's matches as their director. Deleting a
-- social match still took one of its players. Asked, UV: "Yes, like editing".
--
-- One clause, after the sanctioned guard, which stands for everybody: a
-- sanctioned match is not deleted by its director either. Copied from
-- 20261024080007, its only definition.
--
-- No new table references tbl_players, so private.tdc_merge_players is
-- unaffected.

create or replace function private.tdc_can_delete_match(p_match_id uuid)
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

	-- The site owner, on every match, social ones too (24 Nov).
	if private.tdc_is_site_owner() then
		return true;
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
