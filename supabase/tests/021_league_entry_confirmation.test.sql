-- Putting your name down does not confirm you (migration 20261023201147).
--
-- Settled with UV on 23 Oct (docs/DECISIONS.md). What confirms a player
-- depends on the season's two entry settings:
--
--   entry mode     paid confirms   confirmed when
--   interested     on              the director ticks paid
--   interested     off             the player confirms, once let in
--   self_confirm   on              the director ticks paid
--   self_confirm   off             at once — joining is their confirmation
--
-- One season per row of that table, and a player in each.
begin;
\ir _helpers.psql
select plan(16);

select tests.create_user('Entry Dee') as dee \gset
select tests.create_user('Entry Ann') as ann \gset
select tests.create_user('Entry Ben') as ben \gset
select tests.create_user('Entry Cat') as cat \gset
select tests.create_user('Entry Dan') as dan \gset

select tests.sign_in(:'dee');
select public.tdc_create_league('Entry League', tests.rules()) as league \gset
select public.tdc_create_league_season(:'league', 'Interested, unpaid') as s_int \gset
select public.tdc_create_league_season(:'league', 'Interested, paid') as s_int_paid \gset
select public.tdc_create_league_season(:'league', 'Self, unpaid') as s_self \gset
select public.tdc_create_league_season(:'league', 'Self, paid') as s_self_paid \gset
select public.tdc_update_league_season(:'s_int', p_entry_mode => 'interested', p_paid_confirms => false);
select public.tdc_update_league_season(:'s_int_paid', p_entry_mode => 'interested', p_paid_confirms => true);
select public.tdc_update_league_season(:'s_self', p_entry_mode => 'self_confirm', p_paid_confirms => false);
select public.tdc_update_league_season(:'s_self_paid', p_entry_mode => 'self_confirm', p_paid_confirms => true);
select tests.sign_out();

-- ─── Interested, paid confirms off: the player confirms once let in ───

select tests.sign_in(:'ann');
select is(public.tdc_league_show_interest(:'s_int'), 'interested',
	'interested league: putting your name down puts you on the list');
select tests.sign_out();

select is(
	(select confirmed_at from public.tbl_league_season_entrants
	 where league_season_id = :'s_int' and player_id = tests.player_of(:'ann')),
	null, 'interested league: your name down is not a confirmation');

select tests.sign_in(:'ann');
select throws_ok(
	format($$ select public.tdc_confirm_league_entry(%L) $$, :'s_int'),
	'P0001', 'Your name is down and the league director has not confirmed it yet. There is nothing else for you to do.',
	'a player on the Name Down list has nothing to confirm yet');
select tests.sign_out();

select id as e_ann from public.tbl_league_season_entrants
where league_season_id = :'s_int' and player_id = tests.player_of(:'ann') \gset

select tests.sign_in(:'dee');
select public.tdc_set_league_entrants_status(array[:'e_ann'::uuid], 'active');
select tests.sign_out();

select is(
	(select status || ' / ' || (confirmed_at is not null)::text from public.tbl_league_season_entrants where id = :'e_ann'),
	'active / false', 'interested league: being let in does not confirm you either (UV''s report, 23 Oct)');

select is(
	(select count(*)::integer from public.tbl_notifications
	 where player_id = tests.player_of(:'ann') and kind = 'league_entry_added'
		and link = '/leagues/season/?s=' || :'s_int'),
	1, 'being let in tells the player, because they now have something to do');

select tests.sign_in(:'ann');
select lives_ok(
	format($$ select public.tdc_confirm_league_entry(%L) $$, :'s_int'),
	'once let in, the player can confirm');
select tests.sign_out();

select isnt(
	(select confirmed_at from public.tbl_league_season_entrants where id = :'e_ann'),
	null, 'and is then confirmed');

-- A confirmation does not survive leaving and asking again.
select tests.sign_in(:'ann');
select public.tdc_withdraw_league_entry(:'s_int');
select is(public.tdc_league_show_interest(:'s_int'), 'interested',
	'a withdrawn player can put their name down again');
select tests.sign_out();

select is(
	(select confirmed_at from public.tbl_league_season_entrants where id = :'e_ann'),
	null, 'and starts again unconfirmed');

-- ─── Interested, paid confirms on: the paid tick confirms ───

select tests.sign_in(:'ben');
select public.tdc_league_show_interest(:'s_int_paid');
select tests.sign_out();

select id as e_ben from public.tbl_league_season_entrants
where league_season_id = :'s_int_paid' and player_id = tests.player_of(:'ben') \gset

select tests.sign_in(:'dee');
select public.tdc_set_league_entrants_status(array[:'e_ben'::uuid], 'active');
select tests.sign_out();

select is(
	(select (confirmed_at is not null)::text from public.tbl_league_season_entrants where id = :'e_ben'),
	'false', 'paid league: being let in does not confirm you');

select is(
	(select count(*)::integer from public.tbl_notifications
	 where player_id = tests.player_of(:'ben') and kind = 'league_entry_added'),
	0, 'paid league: the player is not asked to confirm, because payment is the confirmation');

select tests.sign_in(:'dee');
select public.tdc_set_league_entrant(:'e_ben', p_paid => true);
select tests.sign_out();

select isnt(
	(select confirmed_at from public.tbl_league_season_entrants where id = :'e_ben'),
	null, 'paid league: ticking paid confirms');

-- ─── Self confirm, paid confirms off: joining is the confirmation ───

select tests.sign_in(:'cat');
select is(public.tdc_league_show_interest(:'s_self'), 'active',
	'self-confirm league: asking puts you straight in');
select tests.sign_out();

select isnt(
	(select confirmed_at from public.tbl_league_season_entrants
	 where league_season_id = :'s_self' and player_id = tests.player_of(:'cat')),
	null, 'self-confirm league with no payment step: joining confirms you (UV, 23 Oct)');

-- ─── Self confirm, paid confirms on: in, but payment still confirms ───

select tests.sign_in(:'dan');
select is(public.tdc_league_show_interest(:'s_self_paid'), 'active',
	'self-confirm league that confirms on payment: asking still puts you in');
select tests.sign_out();

select is(
	(select confirmed_at from public.tbl_league_season_entrants
	 where league_season_id = :'s_self_paid' and player_id = tests.player_of(:'dan')),
	null, 'but you are not confirmed until the director ticks paid');

select * from finish();
rollback;
