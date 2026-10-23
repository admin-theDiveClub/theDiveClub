# Tests

How the database is tested. Set up 23 Oct 2026, replacing the scratch databases that were rebuilt — and lost — in every chat's container.

## Running them

| Job | Command | Touches |
|---|---|---|
| Start the local copy (once per laptop restart) | `npx supabase start` | Local only |
| Rebuild it from every migration | `npx supabase db reset` | Local only |
| Run every test | `npx supabase test db` | Local only |
| Run one file | `npx supabase test db supabase/tests/<file>` | Local only |
| Check local still matches production | `supabase/scripts/schema-fingerprint.sql`, run on both | Production read-only |

Docker Desktop must be running (installed 23 Oct). **Never add `--linked` to `db reset` or `test db`**: that runs against production, which has no rollback.

Before a migration is handed to UV: write it, `db reset` (which applies it after all the others to a clean database), then `test db`. Both must pass.

## The local copy is production

`npx supabase start` and `db reset` build a real Supabase — Postgres 17.6, the real `auth` schema and `auth.uid()`, storage, realtime, the `anon` / `authenticated` / `service_role` roles — and apply every file in `supabase/migrations/`. Nothing is stubbed.

Two things in production were made by dashboard settings rather than migrations, so a fresh database lacked them. **`supabase/roles.sql`** recreates both. The CLI runs it before the migrations on a local build; `db push` never sends it (only with `--include-roles`, which we never use).

| Production has | Made by | Without it locally |
|---|---|---|
| `public.rls_auto_enable()` and the event trigger `ensure_rls` | The Auto-RLS setting | Migration `20260925065614` fails: it revokes execute on that function |
| Default grants in `public` that give new tables, functions and sequences to nobody but the owner (and `service_role` truncate/references/trigger/maintain on tables) | The "don't expose new tables" setting | Every table and function is open to `anon` and `authenticated`, so a permission test passes that production would fail |

Both were copied from production's own catalogue on 23 Oct. If either dashboard setting changes, this file must change with it.

**The fingerprint** (`supabase/scripts/schema-fingerprint.sql`) hashes functions (text, permissions, owner), tables and sequences (columns, defaults, RLS, permissions), constraints, indexes, policies (including storage), triggers, default grants, the event trigger, realtime tables, buckets and schema permissions. On 23 Oct all 11 lines matched. Function text is compared with carriage returns stripped: some earlier chats applied migrations from LF copies, so production's stored text differs only in line endings.

Run it after anything is changed in a dashboard, or whenever a test result and the live site disagree.

## Writing a test

One file per area, named `NNN_area.test.sql` so they run in a fixed order. Each is one transaction that ends in `rollback`, so tests never see each other's data:

```sql
begin;
\ir _helpers.psql
select plan(3);

select tests.create_user('Alice') as alice \gset
select tests.sign_in(:'alice');
select lives_ok($$ select public.tdc_something(...) $$, 'what it should do');
select tests.sign_out();

select * from finish();
rollback;
```

The helpers (`supabase/tests/_helpers.psql`, loaded inside each file's transaction):

| Helper | Does |
|---|---|
| `tests.create_user(name, confirmed default true)` | A new account; the signup trigger makes its player row. Returns the account id |
| `tests.player_of(user_id)` | That account's player id |
| `tests.sign_in(user_id)` | Act as that account: role `authenticated`, JWT claims set, so `auth.uid()` and `private.tdc_me()` see it |
| `tests.sign_in_anon()` | Act as someone not signed in |
| `tests.sign_out()` | Back to `postgres`, to set up data or read tables directly |

Call the `tdc_` functions as the user who would call them from the website, never as `postgres` — the permission checks are most of what is being tested.

## What exists

| File | Covers |
|---|---|
| `000_harness.test.sql` | The helpers themselves: signing in reaches `auth.uid()`, roles change, `anon` cannot read players |
