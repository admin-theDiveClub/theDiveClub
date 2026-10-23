-- Schema fingerprint: one line per category of database object, with a count
-- and a hash. Run it against the local copy and against production; if every
-- line matches, the migrations (plus supabase/roles.sql) rebuild production
-- exactly. Read-only. See docs/systems/tests.md.
--
-- Local:      docker exec -i supabase_db_theDiveClub psql -U postgres -At < supabase/scripts/schema-fingerprint.sql
-- Production: paste into the SQL editor, or run through the Supabase MCP (read-only).
--
-- Function text is compared with carriage returns stripped: some migrations
-- were applied from LF copies by earlier chats, which changes nothing that runs.

with items as (
	select 'fn ' || p.oid::regprocedure::text as k, md5(replace(pg_get_functiondef(p.oid), E'\r', '') || coalesce(array_to_string(p.proacl, ','), '') || pg_get_userbyid(p.proowner)) as v
	from pg_proc p join pg_namespace n on n.oid = p.pronamespace
	where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')
	union all
	select 'tbl ' || c.oid::regclass::text, md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || coalesce(array_to_string(a.attacl, ','), ''), ',' order by a.attnum) || c.relrowsecurity || coalesce(array_to_string(c.relacl, ','), '') || pg_get_userbyid(c.relowner))
	from pg_class c join pg_namespace n on n.oid = c.relnamespace
	join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
	left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
	where n.nspname in ('public', 'private') and c.relkind in ('r', 'v', 'p', 'S')
	group by c.oid
	union all
	select 'con ' || conrelid::regclass::text || '.' || conname, md5(pg_get_constraintdef(oid))
	from pg_constraint where connamespace in (select oid from pg_namespace where nspname in ('public', 'private'))
	union all
	select 'pol ' || schemaname || '.' || tablename || '.' || policyname, md5(coalesce(qual, '') || coalesce(with_check, '') || array_to_string(roles, ',') || cmd || permissive)
	from pg_policies where schemaname in ('public', 'private', 'storage')
	union all
	select 'trg ' || tgrelid::regclass::text || '.' || tgname, md5(pg_get_triggerdef(oid) || tgenabled::text)
	from pg_trigger where not tgisinternal and tgrelid in (select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private', 'auth', 'storage'))
	union all
	select 'idx ' || indexrelid::regclass::text, md5(pg_get_indexdef(indexrelid))
	from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private')
	union all
	select 'pub ' || pubname || '.' || schemaname || '.' || tablename, '' from pg_publication_tables where pubname = 'supabase_realtime'
	union all
	select 'bucket ' || id, md5(public::text || coalesce(file_size_limit::text, '') || coalesce(array_to_string(allowed_mime_types, ','), '')) from storage.buckets
	union all
	select 'schema ' || nspname, md5(coalesce(array_to_string(nspacl, ','), '') || pg_get_userbyid(nspowner)) from pg_namespace where nspname in ('public', 'private')
	union all
	select 'dacl ' || pg_get_userbyid(defaclrole) || '.' || coalesce(n.nspname, '*') || '.' || defaclobjtype::text, md5(array_to_string(defaclacl, ','))
	from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace where coalesce(n.nspname, '*') in ('public', 'private', '*')
	union all
	select 'evt ' || evtname, md5(evtevent || coalesce(array_to_string(evttags, ','), '') || evtenabled::text || evtfoid::regproc::text) from pg_event_trigger where evtname = 'ensure_rls'
)
select split_part(k, ' ', 1) as cat, count(*) as n, left(md5(string_agg(k || v, ',' order by k collate "C")), 12) as h from items group by 1 order by 1;
