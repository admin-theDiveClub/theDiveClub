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
| `010_match_create.test.sql` | `tdc_create_match`: who may start a match and against whom (walk-ins need venue staff), the ruleset checked whole and stored as given, version 1 still accepted |
| `011_match_frames.test.sql` | Recording, correcting and removing frames; the score counted from frames; break sides derived, corrected by hand and carried through; the `card_version` guard (`TDC01`); abandoned matches |
| `012_match_card.test.sql` | A singles card: submit, answer, dispute, withdraw, reopen; a changed card retiring a submission; silence settling it; approval `none` settling on submission and staying settled; the lock on an agreed card, including a direct table write |
| `013_match_access.test.sql` | Who may edit: either player, outsiders, venue staff, a tournament's director / referee / scorer under each `score_entry_mode`, the rank guard; no direct writes to the match tables; only players answer |
| `014_match_approval.test.sql` | A card in a tournament: when each approval mode publishes, a published card reading as settled with `can_object` / `object_until`, objections (recorded, never unlocking, once each, only inside the window), approve and send back (TD only, reason required, send back really unlocks, approve → send back → approve again), the TD correcting a locked card |
| `020_league_settings.test.sql` | Ruleset version 3: team size bounds, the rotation table's checks (size, one away player per session, session 1 the captains' order, repeats allowed), who meets whom under the cyclic shift and an LD's table, the card length from team size; `tdc_update_league` re-freezing only untouched matches (a locked side, a frame and a card event each keep theirs), its counts, and who may call it |

| `021_league_entry_confirmation.test.sql` | What confirms a league player under each entry mode and paid-confirms setting |
| `022_league_season_update.test.sql` | Renaming a season renames its period unless shared; dates set exactly; refusals |
| `023_league_team_limit.test.sql` | A team's limit (team size + reserves): a captain refused at it, the LD past it, away freeing a place and back refused while full, who may mark a player away, the only captain, withdrawn not counting, lowering reserves, every league needing a team size |

**A league needs a team size since `20261023213048`**, and `tests.rules()` carries `team_size: 0` (it is `DEFAULT_RULES`, for matches). A test that makes a league passes `tests.rules('{"team_size": 5}')` or similar.

`tests.rules(overrides)` in the helpers is `DEFAULT_RULES` from `match-settings.js` with overrides laid on top — **version 3 since 23 Oct**. Keep it in step with that file. A test that needs an older version subtracts the newer keys (see `010`).
