-- The shop, Stage 2: products, categories and the cart (docs/design/shop.md; DECISIONS 24 Nov).
--
--   1. tbl_shop_categories: a venue's tabs, managed by its owner or admin (UV, 24 Nov), in order.
--      The Dive Club starts with Café, Apparel and Pool accessories. Deleted only once empty.
--   2. tbl_shop_products: what is sold, priced in whole credits (the page shows the rand value
--      beside it at the venue's current price per credit; UV, 24 Nov), on or off. No stock counts
--      until P5: the owner switches an item off when it runs out (UV, 24 Nov). How it is collected:
--      made at the bar, or collect within 30 days (the Delivery policy). Never deleted, so a later
--      order can always name what it sold. Restricted products never appear here (UV, 14 Nov).
--   3. product-pictures: a public bucket, as the league and team pictures, <product id>/<random>.webp.
--   4. tbl_shop_cart_items: the cart, on the account (the same on every device; UV, 24 Nov).
--   5. tdc_shop: what a stranger may read too (UV, 24 Nov: browse signed out, with prices).
--
-- Checkout, orders and paying for them are Stage 3; nothing here takes credits from anybody.

-- ─── Who may manage a venue's shop: its owner or admin (UV, 24 Nov, as pricing) ───
create function private.tdc_can_manage_shop(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(private.tdc_has_venue_role(p_venue_id, array['owner', 'admin']), false);
$$;

revoke execute on function private.tdc_can_manage_shop(uuid) from public, anon, authenticated;

-- ─── 1. Categories ───
create table public.tbl_shop_categories (
	id          uuid primary key default gen_random_uuid(),
	created_at  timestamptz not null default now(),
	venue_id    uuid not null references public.tbl_venues (id) on delete cascade,
	name        text not null check (char_length(trim(name)) between 1 and 40),
	sort_order  integer not null default 0
);

create unique index tbl_shop_categories_venue_name on public.tbl_shop_categories (venue_id, lower(trim(name)));
create index tbl_shop_categories_venue_idx on public.tbl_shop_categories (venue_id, sort_order);

comment on table public.tbl_shop_categories is
	'The shop (20261124125407): a venue''s product tabs, in sort_order. Managed by its owner or admin.';

alter table public.tbl_shop_categories enable row level security;
-- No policies: read through tdc_shop / tdc_staff_shop, written through the functions below.
grant select, insert, update, delete on public.tbl_shop_categories to service_role;

insert into public.tbl_shop_categories (venue_id, name, sort_order)
select v.id, c.name, c.ord
from public.tbl_venues v
cross join (values ('Café', 1), ('Apparel', 2), ('Pool accessories', 3)) as c (name, ord)
where v.slug = 'the-dive-club';

-- ─── 2. Products ───
create table public.tbl_shop_products (
	id             uuid primary key default gen_random_uuid(),
	created_at     timestamptz not null default now(),
	updated_at     timestamptz not null default now(),
	venue_id       uuid not null references public.tbl_venues (id) on delete restrict,
	category_id    uuid not null references public.tbl_shop_categories (id) on delete restrict,
	name           text not null check (char_length(trim(name)) between 1 and 80),
	price_credits  integer not null check (price_credits between 1 and 100000),
	collect        text not null check (collect in ('bar', 'collect')),
	active         boolean not null default true,
	picture_path   text,
	sort_order     integer not null default 0,
	updated_by     uuid references auth.users (id) on delete set null,

	constraint tbl_shop_products_picture_is_own check (picture_path is null or picture_path like id::text || '/%')
);

create index tbl_shop_products_venue_idx on public.tbl_shop_products (venue_id, category_id, sort_order);
create index tbl_shop_products_category_idx on public.tbl_shop_products (category_id);

comment on table public.tbl_shop_products is
	'The shop (20261124125407): what a venue sells, priced in credits. collect: bar (made at the bar) or collect (within 30 days). Switched off, never deleted.';
comment on column public.tbl_shop_products.picture_path is
	'An object in the public product-pictures bucket, <product id>/<random>.webp. Set through tdc_set_shop_product_picture.';

alter table public.tbl_shop_products enable row level security;
grant select, insert, update, delete on public.tbl_shop_products to service_role;

-- A product's category must be of its own venue.
create function private.tdc_shop_product_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if not exists (select 1 from public.tbl_shop_categories where id = new.category_id and venue_id = new.venue_id) then
		raise exception 'TDC (Error): that category belongs to another venue.';
	end if;
	return new;
end;
$$;

revoke execute on function private.tdc_shop_product_guard() from public, anon, authenticated;

create trigger tbl_shop_products_guard
	before insert or update on public.tbl_shop_products
	for each row execute function private.tdc_shop_product_guard();

-- ─── 3. Product pictures ───
-- Whether the signed-in user may manage the product a storage folder is named after. A function,
-- security definer, because a storage rule runs as the user, who can't read tbl_shop_products: a
-- rule that read it directly made every upload to every bucket fail (the rules are all checked).
create function private.tdc_can_manage_product_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce((
		select private.tdc_can_manage_shop(p.venue_id)
		from public.tbl_shop_products p
		where p.id::text = p_folder
	), false);
$$;

revoke execute on function private.tdc_can_manage_product_folder(text) from public, anon;
grant execute on function private.tdc_can_manage_product_folder(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-pictures', 'product-pictures', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Anyone can see product pictures"
	on storage.objects
	for select
	to public
	using (bucket_id = 'product-pictures');

create policy "A venue's owner or admin can add a product picture"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'product-pictures'
		and private.tdc_can_manage_product_folder((storage.foldername(objects.name))[1])
	);

create policy "A venue's owner or admin can replace a product picture"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'product-pictures'
		and private.tdc_can_manage_product_folder((storage.foldername(objects.name))[1])
	)
	with check (
		bucket_id = 'product-pictures'
		and private.tdc_can_manage_product_folder((storage.foldername(objects.name))[1])
	);

create policy "A venue's owner or admin can remove a product picture"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'product-pictures'
		and private.tdc_can_manage_product_folder((storage.foldername(objects.name))[1])
	);


-- ─── 4. The cart ───
create table public.tbl_shop_cart_items (
	player_id   uuid not null references public.tbl_players (id) on delete cascade,
	product_id  uuid not null references public.tbl_shop_products (id) on delete cascade,
	qty         integer not null check (qty between 1 and 99),
	updated_at  timestamptz not null default now(),
	primary key (player_id, product_id)
);

create index tbl_shop_cart_items_product_idx on public.tbl_shop_cart_items (product_id);

comment on table public.tbl_shop_cart_items is
	'The shop (20261124125407): a player''s cart, kept on the account. Written through tdc_set_cart_qty.';

alter table public.tbl_shop_cart_items enable row level security;
grant select, insert, update, delete on public.tbl_shop_cart_items to service_role;

-- ─── Internal: a product as the pages see it ───
create function private.tdc_shop_product_json(p public.tbl_shop_products)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'id',            p.id,
		'category_id',   p.category_id,
		'name',          p.name,
		'price_credits', p.price_credits,
		'collect',       p.collect,
		'active',        p.active,
		'picture_path',  p.picture_path,
		'sort_order',    p.sort_order
	);
$$;

revoke execute on function private.tdc_shop_product_json(public.tbl_shop_products) from public, anon, authenticated;

-- ─── 5. Anyone, signed in or not: a venue's shop ───
-- Categories in order, each with its products that are on; a category with none is left out.
-- cents_per_credit is the venue's current price, for the rand shown beside each price (null if unset).
-- No venue given: the venue with a shop (the first by name, should there ever be several), since a
-- stranger cannot read tbl_venues to find it.
create function public.tdc_shop(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_venue public.tbl_venues%rowtype;
begin
	select * into v_venue from public.tbl_venues
	where (p_venue_id is null or id = p_venue_id) and active and sells_credits
	order by name
	limit 1;
	if v_venue.id is null then
		raise exception 'This venue has no shop on the site.';
	end if;
	return jsonb_build_object(
		'venue_id',         v_venue.id,
		'venue_name',       v_venue.name,
		'cents_per_credit', (select cents_per_credit from public.tbl_credit_prices where venue_id = v_venue.id),
		'categories', coalesce((
			select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'products', prods.list) order by c.sort_order, c.name)
			from public.tbl_shop_categories c
			cross join lateral (
				select jsonb_agg(private.tdc_shop_product_json(p) order by p.sort_order, p.name) as list
				from public.tbl_shop_products p
				where p.category_id = c.id and p.active
			) prods
			where c.venue_id = v_venue.id and prods.list is not null
		), '[]'::jsonb)
	);
end;
$$;

-- ─── 6. Owners and admins: everything, products that are off and empty categories too ───
create function public.tdc_staff_shop(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_manage_shop(p_venue_id) then
		raise exception 'Only owners and admins can manage the shop.';
	end if;
	return jsonb_build_object(
		'venue_id',         p_venue_id,
		'cents_per_credit', (select cents_per_credit from public.tbl_credit_prices where venue_id = p_venue_id),
		'categories', coalesce((
			select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'products', coalesce(prods.list, '[]'::jsonb)) order by c.sort_order, c.name)
			from public.tbl_shop_categories c
			cross join lateral (
				select jsonb_agg(private.tdc_shop_product_json(p) order by p.sort_order, p.name) as list
				from public.tbl_shop_products p
				where p.category_id = c.id
			) prods
			where c.venue_id = p_venue_id
		), '[]'::jsonb)
	);
end;
$$;

-- ─── 7. Owners and admins: add or rename a category. Returns its id. ───
create function public.tdc_save_shop_category(p_venue_id uuid, p_category_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name text := trim(coalesce(p_name, ''));
	v_id   uuid;
begin
	if not private.tdc_can_manage_shop(p_venue_id) then
		raise exception 'Only owners and admins can manage the shop.';
	end if;
	if char_length(v_name) not between 1 and 40 then
		raise exception 'Please give the category a name of up to 40 characters.';
	end if;
	if exists (select 1 from public.tbl_shop_categories
		where venue_id = p_venue_id and lower(trim(name)) = lower(v_name) and id is distinct from p_category_id) then
		raise exception 'There is already a category called %.', v_name;
	end if;

	if p_category_id is null then
		insert into public.tbl_shop_categories (venue_id, name, sort_order)
		values (p_venue_id, v_name, coalesce((select max(sort_order) + 1 from public.tbl_shop_categories where venue_id = p_venue_id), 1))
		returning id into v_id;
	else
		update public.tbl_shop_categories set name = v_name
		where id = p_category_id and venue_id = p_venue_id
		returning id into v_id;
		if v_id is null then
			raise exception 'TDC (Error): that category isn''t at this venue.';
		end if;
	end if;
	return v_id;
end;
$$;

-- ─── 8. Owners and admins: the categories' order, the whole list at once ───
create function public.tdc_set_shop_category_order(p_venue_id uuid, p_category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not private.tdc_can_manage_shop(p_venue_id) then
		raise exception 'Only owners and admins can manage the shop.';
	end if;
	if (select count(*) from public.tbl_shop_categories where venue_id = p_venue_id)
	   <> coalesce(array_length(p_category_ids, 1), 0)
	   or exists (select 1 from unnest(p_category_ids) i where not exists
			(select 1 from public.tbl_shop_categories c where c.id = i and c.venue_id = p_venue_id)) then
		raise exception 'TDC (Error): the order must list every category at this venue once.';
	end if;
	update public.tbl_shop_categories c
	set sort_order = o.ord
	from unnest(p_category_ids) with ordinality as o (id, ord)
	where c.id = o.id;
end;
$$;

-- ─── 9. Owners and admins: delete a category, only once it has no products ───
create function public.tdc_delete_shop_category(p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_venue uuid;
begin
	select venue_id into v_venue from public.tbl_shop_categories where id = p_category_id;
	if v_venue is null or not private.tdc_can_manage_shop(v_venue) then
		raise exception 'Only owners and admins can manage the shop.';
	end if;
	if exists (select 1 from public.tbl_shop_products where category_id = p_category_id) then
		raise exception 'Move or switch off its products first: a category with products can''t be deleted.';
	end if;
	delete from public.tbl_shop_categories where id = p_category_id;
end;
$$;

-- ─── 10. Owners and admins: add or change a product. Returns its id. ───
create function public.tdc_save_shop_product(
	p_venue_id       uuid,
	p_product_id     uuid,
	p_category_id    uuid,
	p_name           text,
	p_price_credits  integer,
	p_collect        text,
	p_active         boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_name text := trim(coalesce(p_name, ''));
	v_id   uuid;
begin
	if not private.tdc_can_manage_shop(p_venue_id) then
		raise exception 'Only owners and admins can manage the shop.';
	end if;
	if char_length(v_name) not between 1 and 80 then
		raise exception 'Please give the product a name of up to 80 characters.';
	end if;
	if p_price_credits is null or p_price_credits not between 1 and 100000 then
		raise exception 'Please give a price of at least 1 credit.';
	end if;
	if p_collect is null or p_collect not in ('bar', 'collect') then
		raise exception 'Please choose how it is collected: made at the bar, or collect within 30 days.';
	end if;
	if not exists (select 1 from public.tbl_shop_categories where id = p_category_id and venue_id = p_venue_id) then
		raise exception 'Please choose one of this venue''s categories.';
	end if;

	if p_product_id is null then
		insert into public.tbl_shop_products (venue_id, category_id, name, price_credits, collect, active, sort_order, updated_by)
		values (p_venue_id, p_category_id, v_name, p_price_credits, p_collect, coalesce(p_active, true),
			coalesce((select max(sort_order) + 1 from public.tbl_shop_products where category_id = p_category_id), 1), auth.uid())
		returning id into v_id;
	else
		update public.tbl_shop_products
		set category_id = p_category_id, name = v_name, price_credits = p_price_credits, collect = p_collect,
			active = coalesce(p_active, active), updated_at = now(), updated_by = auth.uid()
		where id = p_product_id and venue_id = p_venue_id
		returning id into v_id;
		if v_id is null then
			raise exception 'TDC (Error): that product isn''t at this venue.';
		end if;
	end if;
	return v_id;
end;
$$;

-- ─── 11. Owners and admins: switch a product on or off (off when it runs out) ───
create function public.tdc_set_shop_product_active(p_product_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_venue uuid;
begin
	select venue_id into v_venue from public.tbl_shop_products where id = p_product_id;
	if v_venue is null or not private.tdc_can_manage_shop(v_venue) then
		raise exception 'Only owners and admins can manage the shop.';
	end if;
	if p_active is null then
		raise exception 'TDC (Error): on or off must be given.';
	end if;
	update public.tbl_shop_products set active = p_active, updated_at = now(), updated_by = auth.uid() where id = p_product_id;
end;
$$;

-- ─── 12. Owners and admins: a product's picture. Returns the old path, for the page to delete. ───
create function public.tdc_set_shop_product_picture(p_product_id uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_venue uuid;
	v_old   text;
begin
	select venue_id, picture_path into v_venue, v_old from public.tbl_shop_products where id = p_product_id;
	if v_venue is null or not private.tdc_can_manage_shop(v_venue) then
		raise exception 'Only owners and admins can manage the shop.';
	end if;
	if p_path is not null and p_path not like p_product_id::text || '/%' then
		raise exception 'TDC (Error): a product''s picture must be in its own folder.';
	end if;
	update public.tbl_shop_products set picture_path = p_path, updated_at = now(), updated_by = auth.uid() where id = p_product_id;
	return v_old;
end;
$$;

-- ─── 13. A player: my cart at a venue ───
-- Every line, a product switched off since included as unavailable and left out of the totals.
create function public.tdc_my_cart(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_player_id uuid := private.tdc_my_player_id();
begin
	return (
		select jsonb_build_object(
			'venue_id',         p_venue_id,
			'cents_per_credit', (select cents_per_credit from public.tbl_credit_prices where venue_id = p_venue_id),
			'items', coalesce(jsonb_agg(private.tdc_shop_product_json(p) || jsonb_build_object('qty', ci.qty)
				order by c.sort_order, p.sort_order, p.name) filter (where p.id is not null), '[]'::jsonb),
			'count',         coalesce(sum(ci.qty) filter (where p.active), 0),
			'total_credits', coalesce(sum(ci.qty * p.price_credits) filter (where p.active), 0)
		)
		from public.tbl_shop_cart_items ci
		join public.tbl_shop_products p on p.id = ci.product_id and p.venue_id = p_venue_id
		join public.tbl_shop_categories c on c.id = p.category_id
		where ci.player_id = v_player_id
	);
end;
$$;

-- ─── 14. A player: how many of a product in my cart (0 takes it out). Returns the cart. ───
create function public.tdc_set_cart_qty(p_product_id uuid, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_player_id uuid := private.tdc_my_player_id();
	v_product   public.tbl_shop_products%rowtype;
begin
	select * into v_product from public.tbl_shop_products where id = p_product_id;
	if v_product.id is null then
		raise exception 'TDC (Error): that product isn''t recognised.';
	end if;
	if p_qty is null or p_qty < 0 or p_qty > 99 then
		raise exception 'Please choose between 0 and 99.';
	end if;

	if p_qty = 0 then
		delete from public.tbl_shop_cart_items where player_id = v_player_id and product_id = p_product_id;
	else
		if not v_product.active then
			raise exception '% is not available right now.', v_product.name;
		end if;
		insert into public.tbl_shop_cart_items (player_id, product_id, qty, updated_at)
		values (v_player_id, p_product_id, p_qty, now())
		on conflict (player_id, product_id) do update set qty = excluded.qty, updated_at = now();
	end if;
	return public.tdc_my_cart(v_product.venue_id);
end;
$$;

-- ─── Who can call these ───
revoke execute on function public.tdc_shop(uuid)                                                       from public;
revoke execute on function public.tdc_staff_shop(uuid)                                                 from public, anon;
revoke execute on function public.tdc_save_shop_category(uuid, uuid, text)                             from public, anon;
revoke execute on function public.tdc_set_shop_category_order(uuid, uuid[])                            from public, anon;
revoke execute on function public.tdc_delete_shop_category(uuid)                                       from public, anon;
revoke execute on function public.tdc_save_shop_product(uuid, uuid, uuid, text, integer, text, boolean) from public, anon;
revoke execute on function public.tdc_set_shop_product_active(uuid, boolean)                           from public, anon;
revoke execute on function public.tdc_set_shop_product_picture(uuid, text)                             from public, anon;
revoke execute on function public.tdc_my_cart(uuid)                                                    from public, anon;
revoke execute on function public.tdc_set_cart_qty(uuid, integer)                                      from public, anon;

grant execute on function public.tdc_shop(uuid)                                                       to anon, authenticated;
grant execute on function public.tdc_staff_shop(uuid)                                                 to authenticated;
grant execute on function public.tdc_save_shop_category(uuid, uuid, text)                             to authenticated;
grant execute on function public.tdc_set_shop_category_order(uuid, uuid[])                            to authenticated;
grant execute on function public.tdc_delete_shop_category(uuid)                                       to authenticated;
grant execute on function public.tdc_save_shop_product(uuid, uuid, uuid, text, integer, text, boolean) to authenticated;
grant execute on function public.tdc_set_shop_product_active(uuid, boolean)                           to authenticated;
grant execute on function public.tdc_set_shop_product_picture(uuid, text)                             to authenticated;
grant execute on function public.tdc_my_cart(uuid)                                                    to authenticated;
grant execute on function public.tdc_set_cart_qty(uuid, integer)                                      to authenticated;

-- ─── The merge: the cart moves with the player ───
-- Patched from the latest definition (20261124112328_credit_top_ups), one block added after the
-- top-ups. The cart cascades on delete, so without it a claim would quietly empty the account's cart.
CREATE OR REPLACE FUNCTION private.tdc_merge_players(p_keep_id uuid, p_remove_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
	v_keep   public.tbl_players%rowtype;
	v_remove public.tbl_players%rowtype;
begin
	select * into v_keep   from public.tbl_players where id = p_keep_id   for update;
	select * into v_remove from public.tbl_players where id = p_remove_id for update;

	if v_keep.id is null or v_remove.id is null then
		raise exception 'TDC (Error): player record not found.';
	end if;
	if v_keep.id = v_remove.id then
		raise exception 'TDC (Error): cannot join a player record with itself.';
	end if;
	if v_keep.user_id is not null then
		raise exception 'That record is already linked to an account.';
	end if;
	if v_keep.player_type not in ('walk_in', 'guest') then
		raise exception 'TDC (Error): only walk-in or guest records can be linked to an account.';
	end if;
	if v_remove.user_id is distinct from p_user_id then
		raise exception 'TDC (Error): the account does not match the selected player.';
	end if;

	-- Two different SA IDs can't be joined automatically. (The same SA ID can't be on two records.)
	if exists (select 1 from public.tbl_player_identifiers where player_id = p_keep_id   and kind = 'sa_id')
	   and exists (select 1 from public.tbl_player_identifiers where player_id = p_remove_id and kind = 'sa_id') then
		raise exception 'Both records have an SA ID on file. Please ask an owner or admin to resolve this.';
	end if;

	-- If the two records ever faced each other, joining them would make a match
	-- or a frame have the same player on both sides. Say so plainly rather than
	-- letting a check constraint fail with something nobody can act on.
	if exists (
		select 1 from public.tbl_matches
		where (home_player_id = p_keep_id   and away_player_id = p_remove_id)
		   or (home_player_id = p_remove_id and away_player_id = p_keep_id)
	) then
		raise exception 'These two records are recorded as having played against each other. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_frame_participants a
		join public.tbl_frame_participants b on b.frame_id = a.frame_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are recorded as having played in the same frame. Please ask an owner or admin to resolve this.';
	end if;

	-- Doubles (20261119124608): two seats of one match, partners or
	-- opponents, before any frame is played. Joined, one player would hold
	-- two seats.
	if exists (
		select 1
		from public.tbl_match_side_players a
		join public.tbl_match_side_players b on b.match_id = a.match_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both in the same match. Please ask an owner or admin to resolve this.';
	end if;

	if exists (
		select 1
		from public.tbl_league_season_entrants a
		join public.tbl_league_season_entrants b on b.league_season_id = a.league_season_id
		where a.player_id = p_keep_id and b.player_id = p_remove_id
	) then
		raise exception 'These two records are both entered in the same league season. Please ask an owner or admin to resolve this.';
	end if;

	-- ── Move everything that points at the signup record onto the walk-in record ──
	update public.tbl_player_identifiers set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_players set guest_of_player_id = p_keep_id where guest_of_player_id = p_remove_id;

	-- Credits: the only time ledger rows may change owner. The switch is on for this transaction step only.
	perform set_config('tdc.ledger_merge', 'on', true);
	update public.tbl_credit_ledger set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.ledger_merge', 'off', true);

	-- Redeem codes keep a full history and refuse direct edits, so the same
	-- controlled-write switch the redeem and void functions use is needed here.
	perform set_config('tdc.redeem_write', 'on', true);
	update public.tbl_redeem_codes set redeemed_player_id = p_keep_id where redeemed_player_id = p_remove_id;
	perform set_config('tdc.redeem_write', 'off', true);

	-- Credit top-ups (20261124112328). Restrict on delete, so without this a claim by an
	-- account that had ever asked for credits would fail on deleting the signup record.
	-- The rows refuse direct edits, so the top-up functions' write switch is needed here.
	perform set_config('tdc.top_up_write', 'on', true);
	update public.tbl_credit_top_ups set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.top_up_write', 'off', true);

	-- The cart (20261124125407). Cascades on delete, so without this a claim would quietly
	-- empty the account's cart. A walk-in has no account and so no cart; if it somehow
	-- has a line for the same product, the account's stands (as the notification settings).
	delete from public.tbl_shop_cart_items k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_shop_cart_items r where r.player_id = p_remove_id and r.product_id = k.product_id);
	update public.tbl_shop_cart_items set player_id = p_keep_id where player_id = p_remove_id;

	-- Matches and frames. The match rows matter as much as the frames: a side of
	-- a match is a player id, and losing it would orphan a whole scorecard.
	-- The frame writes now pass the rank guard as well as the lock, so they go
	-- through the same unlock the delete path uses: a merge is bookkeeping,
	-- not somebody trying to change a score.
	perform set_config('tdc.card_unlock', 'on', true);
	update public.tbl_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;
	-- Match referee (20261024162559). Set null on delete, so without this a
	-- claim would quietly forget who was refereeing.
	update public.tbl_matches set referee_player_id = p_keep_id where referee_player_id = p_remove_id;

	update public.tbl_frames set referee_player_id = p_keep_id where referee_player_id = p_remove_id;
	update public.tbl_frames set break_player_id   = p_keep_id where break_player_id   = p_remove_id;
	update public.tbl_frame_participants set player_id = p_keep_id where player_id = p_remove_id;
	-- Doubles seats (20261119124608), restrict on delete like the match's own columns.
	update public.tbl_match_side_players set player_id = p_keep_id where player_id = p_remove_id;
	perform set_config('tdc.card_unlock', 'off', true);

	-- Competitions. Both of these cascade on delete, so without them the
	-- signup record's tournament entries and official roles would vanish the
	-- moment it is deleted below — quietly, at the exact moment staff link
	-- the records. Plain updates, not upserts: both tables are unique per
	-- (tournament, player), so a record somehow in the same tournament twice
	-- fails loudly rather than losing one of them.
	update public.tbl_tournament_entrants set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_competition_roles   set player_id = p_keep_id where player_id = p_remove_id;

	-- What this person has been told. Added 20261022100000.
	--
	-- Load-bearing, despite notifications needing an account: the record
	-- being *removed* here is the signup record — the one with the account,
	-- and therefore the only one that can have notifications. The walk-in
	-- record survives and inherits the login. Without this line, claiming a
	-- walk-in would silently wipe everything that account had been told.
	--
	-- The settings move too (20261024090641). They were left out on the
	-- grounds that p_keep_id is a walk-in and has none, but the settings that
	-- matter are the account's, on p_remove_id, and deleting that record took
	-- them with it: somebody who had turned league notifications off had them
	-- back on after a claim. If both somehow have a setting for a category,
	-- the account's wins (UV, 24 Oct: always the account's).
	update public.tbl_notifications set player_id = p_keep_id where player_id = p_remove_id;

	delete from public.tbl_notification_prefs k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_notification_prefs r
			where r.player_id = p_remove_id and r.category = k.category);
	update public.tbl_notification_prefs set player_id = p_keep_id where player_id = p_remove_id;

	-- League seasons (20261022180000). Unique per (season, player), so a record
	-- somehow entered twice fails loudly rather than losing one of the two —
	-- the same stance as the tournament entries above, with the friendly
	-- message the guards at the top give.
	update public.tbl_league_season_entrants set player_id = p_keep_id where player_id = p_remove_id;

	-- Tonight's squad and lineup (20261022230000, missing until 20261024090641).
	-- The squad cascades and the order is set null, so a claim used to take a
	-- league player out of every squad and leave their lineup positions empty.
	--
	-- A walk-in cannot be a league player, so it cannot be in either table
	-- through any function. If it somehow is, in a match where the account is
	-- too, the account's place stands and the walk-in's goes (UV, 24 Oct):
	-- its squad row is deleted and its positions emptied, which is what a
	-- captain clearing a position leaves. Matched on the match, not the side,
	-- so one person never ends up in one team's lineup and the other's squad.
	update public.tbl_league_match_order k
	set player_id = null
	where k.player_id = p_keep_id
		and (
			exists (select 1 from public.tbl_league_match_squad r where r.match_id = k.match_id and r.player_id = p_remove_id)
			or exists (select 1 from public.tbl_league_match_order r where r.match_id = k.match_id and r.player_id = p_remove_id)
		);
	delete from public.tbl_league_match_squad k
	where k.player_id = p_keep_id
		and (
			exists (select 1 from public.tbl_league_match_squad r where r.match_id = k.match_id and r.player_id = p_remove_id)
			or exists (select 1 from public.tbl_league_match_order r where r.match_id = k.match_id and r.player_id = p_remove_id)
		);
	update public.tbl_league_match_squad set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_league_match_order set player_id = p_keep_id where player_id = p_remove_id;

	-- Added 20261022180000, found while reading this function for leagues.
	-- Neither table was here. tbl_match_events.player_id is ON DELETE RESTRICT,
	-- so a signup record that had ever submitted or answered a card made the
	-- delete below fail with a raw foreign-key error — loud, not lossy, but a
	-- walk-in claim would simply not go through. tbl_deleted_matches is set
	-- null (or restrict, for deleted_by), which would have forgotten who
	-- removed a match. Plain updates: neither table has a uniqueness rule on
	-- the player, so there is nothing to collide with.
	update public.tbl_match_events   set player_id = p_keep_id where player_id = p_remove_id;
	update public.tbl_deleted_matches set home_player_id = p_keep_id where home_player_id = p_remove_id;
	update public.tbl_deleted_matches set away_player_id = p_keep_id where away_player_id = p_remove_id;
	-- Doubles (20261119124608): arrays, so no foreign key would catch them.
	update public.tbl_deleted_matches set home_players = array_replace(home_players, p_remove_id, p_keep_id)
		where p_remove_id = any (home_players);
	update public.tbl_deleted_matches set away_players = array_replace(away_players, p_remove_id, p_keep_id)
		where p_remove_id = any (away_players);
	update public.tbl_deleted_matches set deleted_by     = p_keep_id where deleted_by     = p_remove_id;

	-- Who set a score by hand, and who changed a frame. Both "on delete set
	-- null", so these forget the person rather than blocking.
	update public.tbl_match_result_override set set_by = p_keep_id where set_by = p_remove_id;
	update public.tbl_frame_edit set edited_by_player_id = p_keep_id where edited_by_player_id = p_remove_id;

	-- Asking to join a team (20261105153021). Cascades on delete, so without
	-- this a claim would quietly take back every request the account made.
	-- Unique per (team, player): where both asked the same team, the
	-- account's request stands and the walk-in's goes.
	delete from public.tbl_team_join_requests k
	where k.player_id = p_keep_id
		and exists (select 1 from public.tbl_team_join_requests r
			where r.player_id = p_remove_id and r.team_id = k.team_id);
	update public.tbl_team_join_requests set player_id = p_keep_id where player_id = p_remove_id;

	-- Following (this migration). Cascades on delete, so without this a claim
	-- would quietly lose everyone following the walk-in or the account, and
	-- everyone the account follows. The two records following each other would
	-- become somebody following themselves, so that goes first; where both
	-- follow the same player, or the same player follows both, one row stands.
	delete from public.tbl_player_follows
	where (follower_id = p_remove_id and followed_id = p_keep_id)
		or (follower_id = p_keep_id and followed_id = p_remove_id);
	delete from public.tbl_player_follows k
	where k.follower_id = p_keep_id
		and exists (select 1 from public.tbl_player_follows r
			where r.follower_id = p_remove_id and r.followed_id = k.followed_id);
	update public.tbl_player_follows set follower_id = p_keep_id where follower_id = p_remove_id;
	delete from public.tbl_player_follows k
	where k.followed_id = p_keep_id
		and exists (select 1 from public.tbl_player_follows r
			where r.followed_id = p_remove_id and r.follower_id = k.follower_id);
	update public.tbl_player_follows set followed_id = p_keep_id where followed_id = p_remove_id;

	-- Devices (20261113164109). The account's record is the one with rows:
	-- a walk-in has no sign-in, so it never records one. Moved rather than
	-- left to the cascade, or a claim would lose the account's history of
	-- using the app. Where both somehow have the same device, the two are
	-- folded together.
	insert into public.tbl_player_devices (player_id, os, browser, installed, first_seen, last_seen, days_seen)
	select p_keep_id, d.os, d.browser, d.installed, d.first_seen, d.last_seen, d.days_seen
	from public.tbl_player_devices d where d.player_id = p_remove_id
	on conflict (player_id, os, browser, installed) do update
		set first_seen = least(public.tbl_player_devices.first_seen, excluded.first_seen),
			last_seen  = greatest(public.tbl_player_devices.last_seen, excluded.last_seen),
			days_seen  = public.tbl_player_devices.days_seen + excluded.days_seen;
	delete from public.tbl_player_devices where player_id = p_remove_id;

	-- Discrepancies accepted (20261117054351). Set null on delete, so without
	-- this a claim would forget who accepted; and a forgotten acceptor stops
	-- counting as the entry a later change overruled.
	update public.tbl_frame_change_accept set accepted_by_player_id = p_keep_id where accepted_by_player_id = p_remove_id;

	-- Remove the signup record first, so its login link is free for the walk-in record.
	delete from public.tbl_players where id = p_remove_id;

	update public.tbl_players
	set user_id            = p_user_id,
		player_type        = 'member',
		guest_of_player_id = null,
		-- Keep the display name chosen at signup; names prefer what staff entered (they saw the ID).
		display_name       = case when v_remove.display_name = 'TDC (No Name)' then v_keep.display_name else v_remove.display_name end,
		first_name         = coalesce(v_keep.first_name, v_remove.first_name),
		last_name          = coalesce(v_keep.last_name,  v_remove.last_name)
	where id = p_keep_id;

	return p_keep_id;
end;
$function$;

revoke execute on function private.tdc_merge_players(uuid, uuid, uuid) from public, anon, authenticated;
