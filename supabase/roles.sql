-- LOCAL ONLY. The Supabase CLI runs this file before the migrations when it
-- builds a local copy (`npx supabase start`, `npx supabase db reset`).
-- `db push` never sends it unless given --include-roles, which we never use.
--
-- Production has two objects the migrations never created, because the
-- dashboard's Auto-RLS setting made them: the function public.rls_auto_enable()
-- and the event trigger ensure_rls. Migration 20260925065614 revokes execute on
-- the function, so a fresh database fails without it. Both are copied here
-- verbatim from production (read 23 Oct 2026 with pg_get_functiondef), so the
-- local copy also switches RLS on for new public tables, as production does.
--
-- Production also has the dashboard setting that stops new tables being
-- exposed to the API, which changes the default grants in public. A fresh local
-- copy grants everything to anon, authenticated and service_role instead, so
-- tests would pass against permissions production does not have. The revokes
-- below reproduce production's pg_default_acl for postgres in public (read
-- 23 Oct 2026): owner only on sequences and functions; on tables, owner plus
-- service_role's truncate, references, trigger and maintain. Migration
-- 20260925065614 then removes those four from anon and authenticated.

alter default privileges for role postgres in schema public
	revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
	revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
	revoke select, insert, update, delete on tables from anon, authenticated, service_role;

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
	when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
	execute function public.rls_auto_enable();
