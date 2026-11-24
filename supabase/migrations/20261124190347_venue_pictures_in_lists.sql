-- A venue's picture wherever a venue is shown (UV, 24 Nov; docs/ui-list.md
-- item 11): a small circle before its name, or the map pin when it has none.
--
-- Every page reads its venues from these three helpers, as
-- [{ "id", "name" }]; each object gains "picture_path" (tbl_venues.picture_path,
-- an object in the public venue-pictures bucket, or null). Patched from
-- 20261105203829, their only definition; nothing else changes. The public
-- wrappers (tdc_tournament_venue_list, tdc_match_venue_list) call these, and
-- so does every list and banner that carries "venues".
--
-- What a signed-out visitor can read grows by one value per venue, a path into
-- a bucket that is public already (as the venue's own page shows it).
--
-- The poster's venues are in its stored snapshot, so every poster is rebuilt
-- once at the end, as 20261124173925 did: each poster's own choices, sharing
-- and who generated it left alone, generated_at now. No version change: the
-- page reads picture_path where it is present.
--
-- No player is referenced, so private.tdc_merge_players is unaffected.

create or replace function private.tdc_season_venue_list(p_league_season_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'picture_path', v.picture_path) order by lv.position), '[]'::jsonb)
	from public.tbl_league_season_venues lv
	join public.tbl_venues v on v.id = lv.venue_id
	where lv.league_season_id = p_league_season_id;
$$;

revoke execute on function private.tdc_season_venue_list(uuid) from public, anon, authenticated;

create or replace function private.tdc_tournament_venue_list(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'picture_path', v.picture_path) order by tv.position), '[]'::jsonb)
	from public.tbl_tournament_venues tv
	join public.tbl_venues v on v.id = tv.venue_id
	where tv.tournament_id = p_tournament_id;
$$;

revoke execute on function private.tdc_tournament_venue_list(uuid) from public, anon, authenticated;

-- Where one match is played. A league night: its fixture's own venue, or else the
-- season's list. A tournament match: the tournament's list. A social match: the
-- venue on the match, if it has one.
create or replace function private.tdc_match_venue_list(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_season uuid;
	v_own    uuid;
	v_t      uuid;
	v_list   jsonb;
begin
	select f.league_season_id, f.venue_id into v_season, v_own
	from public.tbl_league_fixtures f where f.match_id = p_match_id limit 1;

	if v_own is not null then
		select jsonb_build_array(jsonb_build_object('id', v.id, 'name', v.name, 'picture_path', v.picture_path)) into v_list
		from public.tbl_venues v where v.id = v_own;
		return coalesce(v_list, '[]'::jsonb);
	end if;
	if v_season is not null then
		return private.tdc_season_venue_list(v_season);
	end if;

	select f.tournament_id into v_t
	from public.tbl_tournament_fixtures f where f.match_id = p_match_id limit 1;
	if v_t is not null then
		return private.tdc_tournament_venue_list(v_t);
	end if;

	select jsonb_build_array(jsonb_build_object('id', v.id, 'name', v.name, 'picture_path', v.picture_path)) into v_list
	from public.tbl_matches m
	join public.tbl_venues v on v.id = m.venue_id
	where m.id = p_match_id;
	return coalesce(v_list, '[]'::jsonb);
end;
$$;

revoke execute on function private.tdc_match_venue_list(uuid) from public, anon, authenticated;

update public.tbl_tournament_posters p
set snapshot     = private.tdc_poster_snapshot(p.tournament_id, p.include_entrants, p.include_draw),
	generated_at = now();


-- ─── The shop's venue, with its picture ───
-- The shop page and an order name their venue (venue_name); each gains
-- venue_picture_path beside it. Patched from 20261124125407 and 20261124152509,
-- their only definitions; nothing else changes.

create or replace function public.tdc_shop(p_venue_id uuid)
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
		'venue_picture_path', v_venue.picture_path,
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

create or replace function private.tdc_shop_order_json(p_row public.tbl_shop_orders)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'id',               p_row.id,
		'venue_id',         p_row.venue_id,
		'venue_name',       (select name from public.tbl_venues where id = p_row.venue_id),
		'venue_picture_path', (select picture_path from public.tbl_venues where id = p_row.venue_id),
		'label',            chr(64 + extract(isodow from p_row.order_day)::integer) || p_row.order_number,
		'order_day',        p_row.order_day,
		'order_number',     p_row.order_number,
		'placed_at',        p_row.placed_at,
		'status',           p_row.status,
		'pay_with',         p_row.pay_with,
		'paid_at',          p_row.paid_at,
		'total_credits',    p_row.total_credits,
		'cents_per_credit', p_row.cents_per_credit,
		'pay_cents',        p_row.total_credits * p_row.cents_per_credit,
		'collect_by',       p_row.collect_by,
		'cancelled_at',     p_row.cancelled_at,
		'can_cancel',       p_row.status = 'placed',
		'lines', coalesce((
			select jsonb_agg(jsonb_build_object(
				'product_id',    l.product_id,
				'name',          l.name,
				'price_credits', l.price_credits,
				'qty',           l.qty,
				'collect',       l.collect
			) order by l.sort_order)
			from public.tbl_shop_order_lines l
			where l.order_id = p_row.id
		), '[]'::jsonb)
	);
$$;
