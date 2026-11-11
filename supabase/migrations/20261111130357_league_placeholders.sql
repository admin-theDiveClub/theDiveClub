-- ───────────────────────────────────────────────────────────
-- League placeholders, and a night's number in the system it came from
--
-- UV, 11 Nov 2026 (docs/STATUS.md R1; DECISIONS 11 Nov): Rivonia 8MTL comes
-- onto the site with all 78 of its players, though only two have accounts.
-- The rest are **placeholders**: player records with no account (built as a
-- walk-in is), each with the email from the league's players file in
-- tbl_player_identifiers. Signing up with that email offers them their record
-- through the existing claim (tdc_find_my_walk_in, tdc_claim_my_walk_in), and
-- the merge carries their team place, lineups and frames to the account.
-- Without the email, staff link them on /staff/link/.
--
-- 1. tbl_league_season_entrants.placeholder. UV's 22 Oct rule, "a league
--    player needs an account of their own", changes for placeholders only:
--    an entrant row marked placeholder may name a player with no account, so
--    a captain can line them up before they sign up. Every other way an
--    accountless player could become an entrant is still refused, by the
--    same trigger as before. The mark is on the entry rather than the player
--    because it is the league that vouches for that person; once they have
--    claimed their record it no longer matters (the player has an account).
--    Nothing on the site sets it yet: only the import does.
--    tdc_add_league_entrant still refuses an accountless player, unchanged.
--
-- 2. tbl_league_fixtures.external_ref. The night's number in the system it
--    was imported from (for Rivonia 8MTL, the CueScore match id), so running
--    the import again with a newer export adds only the nights not yet in,
--    and the fixtures list can be matched to them. Unique within a season.
--
-- The trigger function is patched from its text in 20261022190000; the only
-- change is the placeholder test.
-- ───────────────────────────────────────────────────────────

-- ─── 1. Placeholder entrants ───

alter table public.tbl_league_season_entrants
	add column placeholder boolean not null default false;

comment on column public.tbl_league_season_entrants.placeholder is
	'Entered as a placeholder: a real league player with no account yet, who claims the record by signing up (UV, 11 Nov 2026). Only such a row may name a player with no account.';

-- Insert-only on purpose: tdc_merge_players moves entrants onto the surviving
-- player record, and a walk-in record only gains its user_id at the end of a
-- merge. An update guard would trip on that.
create or replace function private.tdc_league_entrant_needs_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not new.placeholder
		and (select user_id from public.tbl_players where id = new.player_id) is null then
		raise exception 'Walk-ins and guests cannot play in a league. A league player needs an account of their own.';
	end if;
	return new;
end;
$$;

revoke execute on function private.tdc_league_entrant_needs_account() from public, anon;

-- ─── 2. The night's number where it came from ───

alter table public.tbl_league_fixtures
	add column external_ref text check (external_ref is null or char_length(external_ref) between 1 and 64);

comment on column public.tbl_league_fixtures.external_ref is
	'The night''s id in the system it was imported from (Rivonia 8MTL: the CueScore match id). Null for a fixture made on the site.';

create unique index tbl_league_fixtures_external_ref_key
	on public.tbl_league_fixtures (league_season_id, external_ref)
	where external_ref is not null;
