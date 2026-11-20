-- One-off data clean-up (20 Nov, UV): delete 9 empty singles matches made on
-- 19 Nov, left over from testing. Each is scheduled, has no frames, no team
-- and no league fixture. Listed by id; the extra conditions mean a match that
-- has since been played or put in a league is never deleted. No league,
-- team or Mainstream row is touched. On a database without these ids (the
-- local copy) this does nothing.

delete from public.tbl_matches m
where m.id in (
	'426fb567-8b24-4dbc-aeaa-85d2145ceaf6',
	'f3a77e9d-cb03-44f1-8143-8508b731ca7c',
	'9c0b9739-3f99-4633-8655-223070d1f94c',
	'f53ff99f-980d-4f06-9a55-2601f1f5f169',
	'64f47e70-5239-41cc-83d3-8f19a9892b44',
	'34fc6f5e-64fd-430c-a3d8-0be8612bdbf3',
	'68755409-682e-4051-bac4-9fa4dbb6af29',
	'51799836-299a-4be9-ac40-4f17bd59f73f',
	'2f1e85e7-5ccb-415c-9836-c1377aeb8e5a'
)
	and m.status = 'scheduled'
	and m.home_team_id is null
	and m.away_team_id is null
	and not exists (select 1 from public.tbl_frames f where f.match_id = m.id)
	and not exists (select 1 from public.tbl_league_fixtures lf where lf.match_id = m.id)
	and not exists (select 1 from public.tbl_tournament_fixtures tf where tf.match_id = m.id);
