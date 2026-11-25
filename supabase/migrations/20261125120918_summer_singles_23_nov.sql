-- Summer Singles: the night of 23 Nov 2026, from the paper score sheets (UV, 25 Nov).
--
-- Fifteen singles matches were played at Basil's on 23 Nov before the season
-- had any fixtures, and scored on paper. This writes them in as round 1, one
-- fixture per match, with every frame, each match's lag winner and the three
-- break-and-finishes. Only this night: the rest of the season's schedule is
-- made later, by a way of generating that is still to be built (UV, 25 Nov).
--
-- HOW: through the very functions the pages call, acting as the league
-- director Yuvan, so every check and trigger runs as it does on the page and
-- nothing of theirs is retyped (CLAUDE.md §9). Per match:
--   tdc_add_league_fixture      the fixture (round 1, 19:00 on 23 Nov)
--   tdc_create_league_match     Start: a singles match, the season's rules frozen
--   tdc_update_match_settings   the lag winner (the match's own rules, unchanged)
--   tdc_record_frame            each frame in order; who broke is derived from
--                               the lag, the break alternating (the rules)
--   tdc_submit_card             submitted by the director, as one scoring alone
--                               would. It counts in Standings at once and
--                               settles as any singles result does: the
--                               opponent agrees, or the dispute window passes.
--
-- private.tdc_import_singles_night does that for any list of matches, and
-- stays so the test (105_import_singles_night) can run it on made-up players.
-- It is in private, so the API cannot reach it.
--
-- GUARDS:
--   * PLAYERS WITHOUT AN ACCOUNT ARE LEAGUE PLACEHOLDERS (DECISIONS 11 Nov),
--     as in 8-Ball Mainstream: a walk-in record carrying their email, entered
--     with placeholder on, linked to their account by itself when they sign
--     in with that email (DECISIONS 16 Nov, tdc_link_my_league_records).
--     Shane Pillay and Brandon Reddy are already 8-Ball Mainstream
--     placeholders with their WhatsApp emails: those same records are entered
--     here, no new ones. Luke, Sharm, Teegan, Enver and Pranesh had no record
--     on 25 Nov: whoever holds their WhatsApp email by the time this runs is
--     used, else a placeholder is made with it.
--   * Every player must then be an active entrant with a team (of one), and
--     an account unless a placeholder. If anybody is not, NOTHING is written
--     and the message names them all.
--   * A match whose fixture is already there (same round, time and teams) is
--     skipped, and nobody is entered twice, so running this again adds nothing.
--   * The season's id exists only in production, so a local copy is unchanged.
--
-- The sheets, as UV settled them on 25 Nov. H = the home (left-hand) player
-- won the frame, A = the away player. A score under 5 stands: the session
-- ended (UV). 4-4 counts as a draw for both.
--    1 Shane    5-0 Sharm    HHHHH       lag Sharm
--    2 Aldrin   3-4 Luke     HAHHAAA     lag Aldrin
--    3 Brandon  5-1 Alonso   AHHHHH      lag Alonso   B&F Alonso f1, Brandon f4
--    4 Shane    5-2 Leshay   HHHAAHH     lag Shane
--    5 Kat      5-1 Teegan   HHHAHH      lag Teegan   (6th frame not on the sheet; added last)
--    6 Basil    5-3 Enver    HHHAAHAH    lag Basil
--    7 MZ       2-5 Teegan   AHAAHAA     lag Teegan   (7th frame not on the sheet; added last)
--    8 Sharm    5-2 MZ       HHHAAHH     lag MZ
--    9 Thai     5-4 Enver    HAAAAHHHH   lag Thai
--   10 Basil    5-1 Pranesh  HHHAHH      lag Basil
--   11 Brandon  4-4 Luke     HAAAHHHA    lag Brandon  B&F Luke f4
--   12 Leshay   1-5 Aldrin   AHAAAA      lag Leshay
--   13 Julian   4-3 Alonso   HAAAHHH     lag Julian
--   14 Pranesh  1-5 Julian   AAAHAA      lag Pranesh
--   15 Thai     5-2 Kat      AHHHAHH     lag Kat

create function private.tdc_import_singles_night(
	p_league_season_id uuid,
	p_director_user_id uuid,
	p_scheduled_at     timestamptz,
	p_round            integer,
	p_matches          jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_claims   text := current_setting('request.jwt.claims', true);
	v_problems text[];
	v_venue    uuid;
	v_m        jsonb;
	v_home_t   uuid;
	v_away_t   uuid;
	v_fixture  uuid;
	v_match    uuid;
	v_frames   text;
	v_i        integer;
	v_winner   text;
	v_written  integer := 0;
begin
	-- Every player, checked before anything is written.
	select array_agg(distinct problem order by problem) into v_problems
	from (
		select coalesce(p.display_name, x.pid::text) || case
				when p.id is null then ' (no such player)'
				when e.player_id is null then ' (not entered in this season)'
				-- A league placeholder may have no account (DECISIONS 11 Nov).
				when p.user_id is null and not e.placeholder then ' (no account, not a placeholder)'
				when e.status <> 'active' then ' (' || e.status || ' in this season)'
				when e.team_id is null then ' (no team in this season)'
			end as problem
		from (
			select (m->>'home')::uuid as pid from jsonb_array_elements(p_matches) m
			union
			select (m->>'away')::uuid from jsonb_array_elements(p_matches) m
		) x
		left join public.tbl_players p on p.id = x.pid
		left join public.tbl_league_season_entrants e
			on e.player_id = x.pid and e.league_season_id = p_league_season_id
	) s
	where problem is not null;
	if v_problems is not null then
		raise exception 'Nothing imported. These players are not ready: %.', array_to_string(v_problems, '; ');
	end if;

	-- The night's venue: the season's first, as where it is played.
	select venue_id into v_venue
	from public.tbl_league_season_venues
	where league_season_id = p_league_season_id
	order by position
	limit 1;

	-- Act as the director for the functions' own checks.
	perform set_config('request.jwt.claims',
		jsonb_build_object('sub', p_director_user_id, 'role', 'authenticated')::text, true);

	for v_m in select value from jsonb_array_elements(p_matches) loop
		select team_id into v_home_t from public.tbl_league_season_entrants
		where league_season_id = p_league_season_id and player_id = (v_m->>'home')::uuid;
		select team_id into v_away_t from public.tbl_league_season_entrants
		where league_season_id = p_league_season_id and player_id = (v_m->>'away')::uuid;

		if exists (
			select 1 from public.tbl_league_fixtures
			where league_season_id = p_league_season_id
				and round = p_round
				and scheduled_at = p_scheduled_at
				and home_team_id = v_home_t
				and away_team_id = v_away_t
		) then
			continue;
		end if;

		v_fixture := public.tdc_add_league_fixture(
			p_league_season_id, p_round, v_home_t, v_away_t, p_scheduled_at, null, null, v_venue);
		v_match := public.tdc_create_league_match(v_fixture);
		perform public.tdc_update_match_settings(
			v_match, (select rules from public.tbl_matches where id = v_match), v_m->>'lag');

		v_frames := v_m->>'frames';
		for v_i in 1 .. length(v_frames) loop
			v_winner := case substr(v_frames, v_i, 1) when 'H' then 'home' when 'A' then 'away' end;
			if v_winner is null then
				raise exception 'TDC (Error): frame % of "%" is not H or A.', v_i, v_frames;
			end if;
			perform public.tdc_record_frame(v_match, v_i, jsonb_build_object(
				'status', 'complete',
				'winner_side', v_winner,
				'result_event', case
					when coalesce(v_m->'bf', '[]'::jsonb) @> to_jsonb(v_i) then 'break_and_finish'
					else 'win' end));
		end loop;

		perform public.tdc_submit_card(v_match, null);
		v_written := v_written + 1;
	end loop;

	perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
	return v_written;
end;
$$;

revoke execute on function private.tdc_import_singles_night(uuid, uuid, timestamptz, integer, jsonb) from public, anon, authenticated;

-- ── The night of 23 Nov ──
do $$
declare
	v_season   constant uuid := 'de1666b0-47af-4fd1-a2b0-aead1e54f75b';
	v_director constant uuid := 'c67c851b-0647-4f9a-b24e-55b39edff763';
	v_p        jsonb;
	v_r        record;
	v_id       uuid;
	v_n        integer;
begin
	if not exists (select 1 from public.tbl_league_seasons where id = v_season) then
		raise notice 'Summer Singles is not in this database; nothing imported.';
		return;
	end if;

	-- The ten with records, by id. Shane and Brandon are their 8-Ball
	-- Mainstream placeholders (walk-ins carrying their WhatsApp emails).
	v_p := jsonb_build_object(
		'shane',   '6394d8cc-59ed-4769-8ee0-3b36224ef9ce',
		'brandon', '3cdf3ff6-1529-4727-8539-044bd5796f5b',
		'aldrin',  '8bda7164-77f3-45e8-87d1-cd6bdc18f1b4',
		'basil',   '5339c593-b355-4261-853d-a93725aa4f81',
		'thai',    '70837a00-7651-4f63-9028-17085f2281e1',
		'kat',     '70588aa0-8958-4f45-89dc-02c62d8960d2',
		'julian',  '37818e47-772c-4222-8be9-127628e8739a',
		'leshay',  '558c9fad-4d47-4ab6-b974-d1af84fc864d',
		'mz',      '9594e338-7852-4639-ae40-6b0bf0d9f6e4',
		'alonso',  '4fb6f26d-09af-43ee-9b4b-cead88715f45');

	-- The five with no record on 25 Nov: whoever already holds their WhatsApp
	-- email (an account, or a record carrying it), else a new placeholder made
	-- as the Rivonia import made them (test 072): a walk-in with the email.
	for v_r in
		select * from (values
			('luke',    'Luke Pillay',        'Luke',    'Pillay',      'pillayluke777@gmail.com'),
			('sharm',   'Sharm Chetty',       'Sharm',   'Chetty',      'sharm.chetty159@gmail.com'),
			('teegan',  'Teegan Govindasamy', 'Teegan',  'Govindasamy', 'teegangovindasamy@gmail.com'),
			('enver',   'Enver Joel',         'Enver',   'Joel',        'enver.joel123@gmail.com'),
			('pranesh', 'Pranesh',            'Pranesh', null,          'pranesh@pmpetroleum.co.za')
		) as v(k, display_name, first_name, last_name, email)
	loop
		v_id := coalesce(
			(select p.id from auth.users u join public.tbl_players p on p.user_id = u.id
			 where lower(u.email) = v_r.email),
			(select i.player_id from public.tbl_player_identifiers i
			 where i.kind = 'email' and i.value = private.tdc_normalize_identifier('email', v_r.email)));
		if v_id is null then
			insert into public.tbl_players (display_name, first_name, last_name, player_type)
			values (v_r.display_name, v_r.first_name, v_r.last_name, 'walk_in')
			returning id into v_id;
			insert into public.tbl_player_identifiers (player_id, kind, value)
			values (v_id, 'email', private.tdc_normalize_identifier('email', v_r.email));
		end if;
		v_p := v_p || jsonb_build_object(v_r.k, v_id);
	end loop;

	-- Enter anybody not yet in the season: a placeholder when they have no
	-- account (DECISIONS 11 Nov), an ordinary entry when they have. The singles
	-- trigger gives each their team of one.
	insert into public.tbl_league_season_entrants (league_season_id, player_id, status, placeholder)
	select v_season, p.id, 'active', p.user_id is null
	from jsonb_each_text(v_p) j
	join public.tbl_players p on p.id = j.value::uuid
	where not exists (
		select 1 from public.tbl_league_season_entrants e
		where e.league_season_id = v_season and e.player_id = p.id);

	v_n := private.tdc_import_singles_night(v_season, v_director, '2026-11-23 19:00:00+02', 1,
		jsonb_build_array(
			jsonb_build_object('home', v_p->'shane',   'away', v_p->'sharm',   'lag', 'away', 'frames', 'HHHHH'),
			jsonb_build_object('home', v_p->'aldrin',  'away', v_p->'luke',    'lag', 'home', 'frames', 'HAHHAAA'),
			jsonb_build_object('home', v_p->'brandon', 'away', v_p->'alonso',  'lag', 'away', 'frames', 'AHHHHH', 'bf', jsonb_build_array(1, 4)),
			jsonb_build_object('home', v_p->'shane',   'away', v_p->'leshay',  'lag', 'home', 'frames', 'HHHAAHH'),
			jsonb_build_object('home', v_p->'kat',     'away', v_p->'teegan',  'lag', 'away', 'frames', 'HHHAHH'),
			jsonb_build_object('home', v_p->'basil',   'away', v_p->'enver',   'lag', 'home', 'frames', 'HHHAAHAH'),
			jsonb_build_object('home', v_p->'mz',      'away', v_p->'teegan',  'lag', 'away', 'frames', 'AHAAHAA'),
			jsonb_build_object('home', v_p->'sharm',   'away', v_p->'mz',      'lag', 'away', 'frames', 'HHHAAHH'),
			jsonb_build_object('home', v_p->'thai',    'away', v_p->'enver',   'lag', 'home', 'frames', 'HAAAAHHHH'),
			jsonb_build_object('home', v_p->'basil',   'away', v_p->'pranesh', 'lag', 'home', 'frames', 'HHHAHH'),
			jsonb_build_object('home', v_p->'brandon', 'away', v_p->'luke',    'lag', 'home', 'frames', 'HAAAHHHA', 'bf', jsonb_build_array(4)),
			jsonb_build_object('home', v_p->'leshay',  'away', v_p->'aldrin',  'lag', 'home', 'frames', 'AHAAAA'),
			jsonb_build_object('home', v_p->'julian',  'away', v_p->'alonso',  'lag', 'home', 'frames', 'HAAAHHH'),
			jsonb_build_object('home', v_p->'pranesh', 'away', v_p->'julian',  'lag', 'home', 'frames', 'AAAHAA'),
			jsonb_build_object('home', v_p->'thai',    'away', v_p->'kat',     'lag', 'away', 'frames', 'AHHHAHH')
		));
	raise notice 'Summer Singles, 23 Nov: % matches imported.', v_n;
end;
$$;
