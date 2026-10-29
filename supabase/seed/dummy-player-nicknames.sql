-- Nicknames for the nineteen dummy players (UV, 29 Oct), for trying the
-- Standings tab's Full names switch.
--
-- The dummies were made with their full name as the display name and no
-- first or last name (dummy-league-players.sql). This puts the full name into
-- first_name and last_name, and a nickname into display_name, so the switch
-- has two different names to show.
--
-- **Not a migration**: it changes rows, not the schema. Run it in the
-- Supabase SQL editor. Safe to run again: it finds each dummy by its email
-- (dummy01…dummy19@test.thediveclub.org) and sets the same three values.
-- Touches nobody else.
--
-- To undo: the block at the bottom puts the full name back as the display
-- name and empties first and last name.

update public.tbl_players p
set first_name   = n.first_name,
	last_name    = n.last_name,
	display_name = n.nickname
from (values
	('01', 'Thabo',   'Mokoena',     'T-Bone'),
	('02', 'Ashwin',  'Pillay',      'Ash'),
	('03', 'Johan',   'van Wyk',     'Jo-Jo'),
	('04', 'Sipho',   'Dlamini',     'Sips'),
	('05', 'Riaan',   'Botha',       'Bothy'),
	('06', 'Kagiso',  'Maseko',      'Kaggy'),
	('07', 'Dylan',   'Fourie',      'Dyl'),
	('08', 'Nadia',   'Abrahams',    'Nads'),
	('09', 'Pieter',  'Steyn',       'Piet'),
	('10', 'Lerato',  'Ndlovu',      'Rato'),
	('11', 'Shaun',   'Naidoo',      'Shaunie'),
	('12', 'Bongani', 'Khumalo',     'Bongz'),
	('13', 'Marco',   'Ferreira',    'Polo'),
	('14', 'Tristan', 'de Villiers', 'Tris'),
	('15', 'Zanele',  'Mthembu',     'Zee'),
	('16', 'Craig',   'Petersen',    'Pete'),
	('17', 'Imraan',  'Davids',      'Immy'),
	('18', 'Lebo',    'Molefe',      'Lebz'),
	('19', 'Werner',  'Coetzee',     'Coetz')
) as n (num, first_name, last_name, nickname)
join auth.users u on u.email = 'dummy' || n.num || '@test.thediveclub.org'
where p.user_id = u.id;

-- Expect 19 rows. Check:
--   select u.email, p.display_name, p.first_name, p.last_name
--   from public.tbl_players p join auth.users u on u.id = p.user_id
--   where u.email like 'dummy%@test.thediveclub.org' order by u.email;

-- ─── Undo ───
-- update public.tbl_players p
-- set display_name = trim(p.first_name || ' ' || p.last_name), first_name = null, last_name = null
-- from auth.users u
-- where u.id = p.user_id and u.email like 'dummy%@test.thediveclub.org'
--   and p.first_name is not null and p.last_name is not null;
