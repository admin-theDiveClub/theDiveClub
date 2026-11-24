-- Basil's Billiards gets its owner, and Summer Singles is tied to it (UV, 24 Nov).
--
--   1. Basil Munsamy (display name "Basil's Billiards", account made 9 Nov) owns
--      Basil's Billiards Pool Lounge. Chosen by UV over the second account,
--      "Basil Billiards BlackBall Comp" (23 Nov), which gets nothing here.
--   2. Summer Singles (made 24 Nov, 12:39, no fixtures yet) BELONGS to Basil's:
--      a one-off exception, chosen by UV, to "the venue a league belongs to is
--      fixed at creation" (DECISIONS 5 Nov). The league was made before the
--      venue had an owner, so nobody could have tied it there at creation.
--      With no fixtures there are no matches whose venue_id needs copying.
--   3. Summer Singles' season is PLAYED at Basil's.
--
-- Each step matches on ids that exist only in production, so a local copy is
-- unchanged, as the Billiard Cafés' owner was added (20261117073856).

-- 1. The owner
insert into public.tbl_venue_staff (venue_id, user_id, role)
select v.id, u.id, 'owner'
from public.tbl_venues v
cross join auth.users u
where v.slug = 'basils-billiards'
	and u.id = 'c2b296f7-4d7e-4d1f-bd7a-28e22d0bf126'
on conflict (venue_id, user_id) do nothing;

-- 2. Summer Singles belongs to Basil's (only while it still belongs nowhere)
update public.tbl_leagues l
set venue_id = v.id
from public.tbl_venues v
where v.slug = 'basils-billiards'
	and l.id = 'f11b7c44-1ec7-4de0-b349-2660c7155ed6'
	and l.venue_id is null;

-- 3. Its season is played at Basil's (only a season with no list yet)
insert into public.tbl_league_season_venues (league_season_id, venue_id, position)
select s.id, v.id, 1
from public.tbl_league_seasons s
cross join public.tbl_venues v
where s.league_id = 'f11b7c44-1ec7-4de0-b349-2660c7155ed6'
	and v.slug = 'basils-billiards'
	and not exists (select 1 from public.tbl_league_season_venues x where x.league_season_id = s.id);
