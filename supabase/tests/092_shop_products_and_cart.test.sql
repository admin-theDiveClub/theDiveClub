-- The shop, Stage 2 (migration shop_products_and_cart, 24 Nov; docs/design/shop.md).
--
--   categories and products are managed by a venue's owner or admin only
--   anyone, signed out too, reads the shop: categories in order, only products
--     that are on, the venue's price per credit for the rand beside each price
--   the cart is on the account; a product switched off stays in it as
--     unavailable and leaves the totals; it can't be added while off
--   a category with products can't be deleted; a product's category is its venue's
--   the merge carries the cart across
begin;
\ir _helpers.psql
select plan(39);

select tests.create_user('Shop Owner') as owner \gset
select tests.create_user('Shop Admin') as admin \gset
select tests.create_user('Shop Staff') as staff \gset
select tests.create_user('Shop Ann') as ann \gset
select tests.player_of(:'ann') as pann \gset

select id as tdc from public.tbl_venues where slug = 'the-dive-club' \gset
insert into public.tbl_venues (name, slug, sells_credits) values ('Other Club', 'other-club', true) returning id as other \gset
insert into public.tbl_venue_staff (venue_id, user_id, role) values
	(:'tdc', :'owner', 'owner'), (:'tdc', :'admin', 'admin'), (:'tdc', :'staff', 'staff'), (:'other', :'owner', 'owner');

-- The categories' names, in order, as the managers see them.
create function tests.shop_cats(p_venue uuid) returns text language sql as $$
	select string_agg(c->>'name', ', ' order by o) from jsonb_array_elements(public.tdc_staff_shop(p_venue)->'categories') with ordinality as x (c, o);
$$;
grant execute on function tests.shop_cats(uuid) to authenticated;


-- ─── The seed ───

select tests.sign_in(:'owner');
select is(tests.shop_cats(:'tdc'), 'Café, Apparel, Pool accessories', 'The Dive Club starts with three categories, in order');
select is(public.tdc_shop(:'tdc')->'categories', '[]'::jsonb, 'the public shop shows none while they are empty');
select is((public.tdc_shop(:'tdc')->>'cents_per_credit')::int, 100, 'and gives the price per credit, for the rand');


-- ─── Who manages ───

select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_staff_shop(%L) $$, :'tdc'), 'Only owners and admins can manage the shop.', 'staff cannot see the managers'' list');
select throws_ok(format($$ select public.tdc_save_shop_category(%L, null, 'Snacks') $$, :'tdc'), 'Only owners and admins can manage the shop.', 'nor add a category');
select tests.sign_in(:'ann');
select throws_ok(format($$ select public.tdc_save_shop_category(%L, null, 'Snacks') $$, :'tdc'), 'Only owners and admins can manage the shop.', 'nor can a player');


-- ─── Categories ───

select tests.sign_in(:'admin');
select public.tdc_save_shop_category(:'tdc', null, 'Snacks') as snacks \gset
select is(tests.shop_cats(:'tdc'), 'Café, Apparel, Pool accessories, Snacks', 'an admin adds one at the end');
select throws_ok(format($$ select public.tdc_save_shop_category(%L, null, ' snacks ') $$, :'tdc'), 'There is already a category called snacks.', 'a second with the same name is refused');
select throws_ok(format($$ select public.tdc_save_shop_category(%L, null, '') $$, :'tdc'), 'Please give the category a name of up to 40 characters.', 'a name is needed');
select lives_ok(format($$ select public.tdc_save_shop_category(%L, %L, 'Snacks and sweets') $$, :'tdc', :'snacks'), 'it can be renamed');

select tests.sign_out();
select id as cafe from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Café' \gset
select id as apparel from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Apparel' \gset
select id as pool from public.tbl_shop_categories where venue_id = :'tdc' and name = 'Pool accessories' \gset
select tests.sign_in(:'admin');
select lives_ok(format($$ select public.tdc_set_shop_category_order(%L, array[%L, %L, %L, %L]::uuid[]) $$, :'tdc', :'snacks', :'cafe', :'apparel', :'pool'), 'the order is set as a whole');
select is(tests.shop_cats(:'tdc'), 'Snacks and sweets, Café, Apparel, Pool accessories', 'and kept');
select throws_ok(format($$ select public.tdc_set_shop_category_order(%L, array[%L, %L]::uuid[]) $$, :'tdc', :'snacks', :'cafe'),
	'TDC (Error): the order must list every category at this venue once.', 'a part list is refused');


-- ─── Products ───

select public.tdc_save_shop_product(:'tdc', null, :'cafe', 'Flat white', 30, 'bar') as coffee \gset
select public.tdc_save_shop_product(:'tdc', null, :'cafe', 'Rooibos tea', 20, 'bar') as tea \gset
select public.tdc_save_shop_product(:'tdc', null, :'apparel', 'Club socks', 80, 'collect') as socks \gset
select throws_ok(format($$ select public.tdc_save_shop_product(%L, null, %L, 'Free', 0, 'bar') $$, :'tdc', :'cafe'),
	'Please give a price of at least 1 credit.', 'a price of at least 1 credit');
select throws_ok(format($$ select public.tdc_save_shop_product(%L, null, %L, 'Post', 10, 'post') $$, :'tdc', :'cafe'),
	'Please choose how it is collected: made at the bar, or collect within 30 days.', 'collected at the bar or within 30 days, nothing else');
select tests.sign_in(:'owner');
select public.tdc_save_shop_category(:'other', null, 'Elsewhere') as elsewhere \gset
select tests.sign_in(:'admin');
select throws_ok(format($$ select public.tdc_save_shop_product(%L, null, %L, 'Stray', 10, 'bar') $$, :'tdc', :'elsewhere'),
	'Please choose one of this venue''s categories.', 'a product cannot go in another venue''s category');
select throws_ok(format($$ select public.tdc_delete_shop_category(%L) $$, :'cafe'),
	'Move or switch off its products first: a category with products can''t be deleted.', 'a category with products cannot be deleted');
select lives_ok(format($$ select public.tdc_delete_shop_category(%L) $$, :'pool'), 'an empty one can');


-- ─── The public shop ───

select tests.sign_in_anon();
select is((public.tdc_shop(null)->>'venue_name'), 'Other Club', 'with no venue named: the first venue with a shop, by name (Other Club sorts before The Dive Club here)');
select is((select string_agg(c->>'name', ', ') from jsonb_array_elements(public.tdc_shop(:'tdc')->'categories') c), 'Café, Apparel',
	'signed out: the categories with products, in order');
select is((select string_agg(p->>'name' || ' ' || (p->>'price_credits'), ', ') from jsonb_array_elements(public.tdc_shop(:'tdc')->'categories'->0->'products') p),
	'Flat white 30, Rooibos tea 20', 'each with its products and prices');
select throws_ok(format($$ select public.tdc_staff_shop(%L) $$, :'tdc'), '42501', null, 'the managers'' list is not a stranger''s');
select throws_ok(format($$ select public.tdc_my_cart(%L) $$, :'tdc'), '42501', null, 'nor is a cart');
select throws_ok($$ select * from public.tbl_shop_products $$, '42501', null, 'nor the table');


-- ─── The cart ───

select tests.sign_in(:'ann');
select public.tdc_set_cart_qty(:'coffee', 2);
select public.tdc_set_cart_qty(:'socks', 1) as cart \gset
select is((:'cart'::jsonb)->>'count', '3', 'Ann puts in two coffees and socks: 3 items');
select is((:'cart'::jsonb)->>'total_credits', '140', 'for 140 credits');
select is((public.tdc_set_cart_qty(:'coffee', 1))->>'total_credits', '110', 'one coffee fewer: 110');
select throws_ok(format($$ select public.tdc_set_cart_qty(%L, 100) $$, :'tea'), 'Please choose between 0 and 99.', 'at most 99 of a thing');

select tests.sign_in(:'admin');
select lives_ok(format($$ select public.tdc_set_shop_product_active(%L, false) $$, :'socks'), 'the socks run out: switched off');
select tests.sign_in(:'ann');
select is((select string_agg(c->>'name', ', ') from jsonb_array_elements(public.tdc_shop(:'tdc')->'categories') c), 'Café',
	'they leave the shop, and their category with them');
select is(public.tdc_my_cart(:'tdc')->>'total_credits', '30', 'the cart leaves them out of the total');
select is((select i->>'active' from jsonb_array_elements(public.tdc_my_cart(:'tdc')->'items') i where i->>'name' = 'Club socks'), 'false',
	'but still lists them, as unavailable');
select throws_ok(format($$ select public.tdc_set_cart_qty(%L, 2) $$, :'socks'), 'Club socks is not available right now.', 'and they cannot be added while off');
select is((public.tdc_set_cart_qty(:'socks', 0)->'items')::text not like '%Club socks%', true, 'they can still be taken out');
select is((select count(*)::int from jsonb_array_elements(public.tdc_my_cart(:'other')->'items')), 0, 'a cart is per venue');


-- ─── Pictures ───

select tests.sign_in(:'admin');
select throws_ok(format($$ select public.tdc_set_shop_product_picture(%L, 'somewhere/else.webp') $$, :'coffee'),
	'TDC (Error): a product''s picture must be in its own folder.', 'a picture must be in the product''s folder');
select is(public.tdc_set_shop_product_picture(:'coffee', :'coffee' || '/abc.webp'), null, 'set in its folder, there was none before');
select tests.sign_in(:'staff');
select throws_ok(format($$ select public.tdc_set_shop_product_picture(%L, null) $$, :'coffee'), 'Only owners and admins can manage the shop.', 'staff cannot change it');


-- ─── The merge carries the cart ───

select tests.sign_out();
insert into public.tbl_players (display_name, player_type) values ('Shop Walk-in', 'walk_in') returning id as walkin \gset
select private.tdc_merge_players(:'walkin', :'pann', :'ann');
select is((select sum(qty)::int from public.tbl_shop_cart_items where player_id = :'walkin'), 1, 'Ann''s cart moves to the kept record');

select * from finish();
rollback;
