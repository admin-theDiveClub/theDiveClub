-- Closing the gap in the private schema.
--
-- Found 21 Oct while auditing what the poster page exposes. Fourteen
-- `private.tdc_*` functions were created without the `revoke execute … from
-- public` line every other one in this project carries, so they still hold
-- PostgreSQL's default grant to PUBLIC — and PUBLIC means every role,
-- including `anon`.
--
-- ─── It was not a live hole, and that is the point ───
--
-- `anon` has no `usage` on schema `private`, so it could not reach any of
-- them. One grant of schema usage, by anybody, at any time, and fourteen
-- functions would open at once with nothing in their own definitions to stop
-- it. Defence that rests on a single unrelated setting is not defence; it is
-- luck that has not run out.
--
-- ─── What was checked before revoking ───
--
-- A revoke is only safe if nothing evaluates these as the calling user.
-- Everything that would was looked for: check constraints, column defaults,
-- index expressions, RLS policies, and security-invoker functions.
--
-- One hit. `tbl_player_identifiers_format` is a CHECK constraint calling
-- `private.tdc_is_valid_sa_id`, and a constraint is evaluated as whoever
-- performs the write. Neither `anon` nor `authenticated` can insert into that
-- table — every write goes through a security definer function running as the
-- owner — so the revoke is safe. The grant to `authenticated` below keeps it
-- safe even if a direct write path is ever added.
--
-- ─── Why the trigger functions get no grant ───
--
-- PostgreSQL does not check EXECUTE when firing a trigger, so a trigger
-- function needs no grant to anybody and granting one would only suggest it
-- is callable. Nine of the fourteen are triggers and are revoked outright.
--
-- Nothing about behaviour changes. The suites are the proof: every trigger
-- below is exercised by one of them.

-- ─────────────────────────────────────────────────────────────────
-- Helpers — revoked from PUBLIC, granted to authenticated
--
-- Matching every other private helper in the project. They are called from
-- inside security definer functions, which run as the owner and would not
-- need the grant, but the convention is worth more than the marginal
-- tightening: a helper that one day gets called from a security invoker
-- function should not fail in a way nobody can explain.
-- ─────────────────────────────────────────────────────────────────

revoke execute on function private.tdc_bracket_order(integer) from public, anon;
grant  execute on function private.tdc_bracket_order(integer) to authenticated;

revoke execute on function private.tdc_editor_role(integer) from public, anon;
grant  execute on function private.tdc_editor_role(integer) to authenticated;

-- The one in a check constraint. See the header.
revoke execute on function private.tdc_is_valid_sa_id(text) from public, anon;
grant  execute on function private.tdc_is_valid_sa_id(text) to authenticated;

revoke execute on function private.tdc_normalize_code(text) from public, anon;
grant  execute on function private.tdc_normalize_code(text) to authenticated;

revoke execute on function private.tdc_normalize_identifier(text, text) from public, anon;
grant  execute on function private.tdc_normalize_identifier(text, text) to authenticated;

revoke execute on function private.tdc_required_score_rank(text) from public, anon;
grant  execute on function private.tdc_required_score_rank(text) to authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Trigger functions — revoked outright
--
-- Firing a trigger does not check EXECUTE, so none of these needs a grant.
-- ─────────────────────────────────────────────────────────────────

revoke execute on function private.tdc_credit_ledger_guard()  from public, anon, authenticated;
revoke execute on function private.tdc_frame_edit_log()       from public, anon, authenticated;
revoke execute on function private.tdc_frame_rank_guard()     from public, anon, authenticated;
revoke execute on function private.tdc_frames_locked_guard()  from public, anon, authenticated;
revoke execute on function private.tdc_pm_items_guard()       from public, anon, authenticated;
revoke execute on function private.tdc_pm_links_guard()       from public, anon, authenticated;
revoke execute on function private.tdc_pm_track_locked()      from public, anon, authenticated;
revoke execute on function private.tdc_redeem_codes_guard()   from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- Stop the next one happening
--
-- The fourteen above were not a decision; they were a line forgotten
-- fourteen times. Default privileges close the hole for everything created
-- in this schema from now on, so a future function is safe even if its
-- author forgets, which on this evidence they will.
--
-- This applies to functions created by `postgres`, which is the role
-- migrations run as.
-- ─────────────────────────────────────────────────────────────────

alter default privileges for role postgres in schema private
	revoke execute on functions from public;

-- And the same for the public schema. Everything there is granted
-- deliberately today, but the same forgotten line would be a real hole
-- rather than a near miss, because `anon` does have usage on public.
alter default privileges for role postgres in schema public
	revoke execute on functions from public;


-- ─────────────────────────────────────────────────────────────────
-- Leave a check behind
--
-- So the next audit is one query rather than the reasoning in this header.
-- ─────────────────────────────────────────────────────────────────

create function private.tdc_audit_anon_reach()
returns table (object_kind text, object_name text, note text)
language sql
stable
security definer
set search_path = ''
as $$
	select 'function',
		n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
		case when n.nspname = 'private'
			then 'anon can execute a private function — it is only out of reach while anon lacks usage on the schema'
			else 'anon can execute this; intended only for the poster page'
		end
	from pg_proc p
	join pg_namespace n on n.oid = p.pronamespace
	left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
	where n.nspname in ('public', 'private')
		and d.objid is null
		and has_function_privilege('anon', p.oid, 'execute')
	union all
	select 'table',
		n.nspname || '.' || c.relname,
		'anon can select from this; intended only for the poster snapshot'
	from pg_class c
	join pg_namespace n on n.oid = c.relnamespace
	where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
		and has_table_privilege('anon', c.oid, 'select')
	order by 1, 2;
$$;

comment on function private.tdc_audit_anon_reach() is
	'Everything an unauthenticated caller can reach. Should return exactly public.tdc_tournament_poster and public.tbl_tournament_posters — the poster page and nothing else. Any other row wants explaining.';

revoke execute on function private.tdc_audit_anon_reach() from public, anon;
grant execute on function private.tdc_audit_anon_reach() to authenticated;
