# theDiveClub — start here

theDiveClub (thediveclub.org) is the web app and PWA for **The Dive Club**, UV's pool lounge in Johannesburg (C5, The Gantry, Lonehill/Fourways). It is also designed as a **multi-venue platform**: other pool clubs will be able to adopt it, and players will share one community across venues.

This file is read at the start of every session, so it is kept short. **The detail lives in the files listed under "Where things are", read when the work touches them.**

---

## 1. How UV works — non-negotiable

- **Claude writes files. UV reviews, runs and commits. Claude never commits or pushes** (`.claude/settings.json` blocks both). At each milestone give a **commit subject**, plus a body of three or four lines when the change is not self-evident.
- **Explain what you are about to do before you do it**, especially before running a command that changes anything or asking for access.
- **Ask when you don't know, and say so when in doubt.** Never guess at a design question. Before asking, check `docs/design/`, `docs/DECISIONS.md` and the system file for that area — re-asking something already answered wastes UV's time.
- **One thing at a time**, with a test after each. Plain language, explain outcomes rather than internals; UV reads code only up to a point and does not want to write SQL. **Tables over prose** for lists.
- **Tell UV when to start a fresh conversation** (at each milestone, or when a session has grown long) and **which model suits the next job**, by the rules in `docs/MODELS.md`. UV aims to use his Max 5x allowance fully.
- **Never fall back silently.** On a failure show `TDC (Error): …` on the page and `console.error` with an `[Area]` prefix, using the helpers in `scripts/tdc.js`.
- **Never put secrets in client code or the repo** (VAPID private key, service-role key).
- Files use **CRLF and tabs**.
- **Dashboard settings** (Supabase, Google, Resend, Squarespace) are done by UV. Test locally with `npx eleventy --serve` before pushing, then check the live site after a deploy.
- **UV will not remember implementation details.** These files, migration comments and commit messages are the memory.

## 2. Session start

Before replying with anything else, read this file, `docs/STATUS.md`, and the system and design files for the area you are about to work on. Then tell UV in a few lines what you read, what you take the current state to be, and what you think the next piece of work is. **Do not write a file or ask a question until you have done that.**

## 3. Every milestone

1. Write the files.
2. Update the system file in `docs/systems/` for what was built and why it is shaped that way.
3. Update `docs/STATUS.md` — remove what is done, add what was uncovered.
4. Add to `docs/DECISIONS.md` if a real decision was made.
5. Run the tests: `npx supabase db reset`, then `npx supabase test db` (local only — see `docs/systems/tests.md`).
6. Give UV the commit subject. **Never batch the documentation to the end of a session.**

---

## 4. Where things are

| File | Job |
|---|---|
| `docs/STATUS.md` | **The agenda.** Outstanding, blocked, decisions needed, waiting on UV. The only list of code and platform work |
| `docs/BACKLOG.md` | Someday work. When something becomes active, **move** it to `STATUS.md` |
| `docs/DECISIONS.md` | **The why.** Append-only: decisions, reasons, what was rejected |
| `docs/design/` | **Settled designs not yet built.** Read before proposing anything in that area. `leagues.md` is the current one |
| `docs/systems/` | **How each built system works** — read the one for your area |
| `docs/ui.md` | UI conventions, the stylesheet layers, known UI problems, layout traps |
| `docs/test-plan.md` | Scenarios UV plays on real devices; Claude checks the database afterwards |
| `docs/MODELS.md` | Which Claude model to use for which job |
| `docs/product/` | Documentation for venues, directors and players |
| `docs/archive/` | Retired design records, kept for history. Older migrations cite them as `claude/<name>.md` |

Business to-dos (the club itself, not the code) live on the owner board at `/staff/board/`.

### The systems

| File | Covers |
|---|---|
| `docs/systems/file-map.md` | Where every page, script and stylesheet is |
| `docs/systems/foundations.md` | Auth, emails, push, identity, walk-ins and the merge, credits, data architecture |
| `docs/systems/matches.md` | Frames, the card lifecycle, conflicts, live updates, match settings and the ruleset versions, the match pages |
| `docs/systems/tournaments.md` | Draws, progression, the bracket, overrides, officials, publishing, entry, the poster, round rules, editing a draw |
| `docs/systems/leagues.md` | Leagues, seasons, teams, entrants, fixtures, lineups, the captain's scorecard, entry |
| `docs/systems/notifications.md` | The notification record, the push sweep, the tray |
| `docs/systems/project-board.md` | The owner board |
| `docs/systems/dots.md` | The dots: the site's loading and feedback motion (in progress) |
| `docs/systems/tests.md` | The local Supabase copy, how it is kept identical to production, and how to write and run tests |

---

## 5. The ideas that hold it together

Breaking any of these is how the project goes wrong.

1. **Frames are the only record.** Scores, winners and statistics are counted, never stored. A director's entered score is its own visible record (`tbl_match_result_override`), never written onto the match.
2. **The ruleset is frozen onto each match at creation**, so a later rule change cannot rescore played frames.
3. **Writes go through security-definer `tdc_` functions**, never straight from the browser. Access helpers live in `private` and **must return true or false, never null**.
4. **One place decides each permission.** `private.tdc_can_edit_match` for cards, `private.tdc_can_run_tournament` for competitions. Extend those rather than repeating a rule.
5. **The card is an append-only event log**, not a status column. `card_version` retires stale submissions automatically.
6. **After every write the page re-reads from the server** rather than patching locally.
7. **A setting is defined once**, in `TDCMatchDef` (`scripts/match-settings.js`). Pages are generated from it.
8. **A director must be able to run everything alone.** Players entering their own scores is a convenience, not the path. Tournament entrants may be walk-ins with no account; league players may not.
9. **`private.tdc_merge_players` names every table that references `tbl_players`.** A new player-referencing table must be added to it, or a walk-in merge silently loses that history. Its migration carries the query that lists them all — run it rather than trusting a list.

## 6. Stack

- **Eleventy 3 (11ty)** static site. All source is in `src/`. The build output goes to `_site/`, which is gitignored and never committed or edited.
- Plain HTML, CSS and JS, with no framework or Bootstrap. Styling uses CSS variables in `src/stylesheets/variables.css` (dark by default; `data-theme="light"` is a manual preview only, and there's no theme toggle UI yet).
- **Supabase** project `thediveclub-prod` (ref `dgmvavvegzxjwrbzfobh`, region eu-west-1), in the org "The Dive Club" under admin@thediveclub.org. It's served through the custom domain **`db.thediveclub.org`**. Auto-RLS is on, and new tables are not auto-exposed.
- **Edge functions** in `supabase/functions/`: `notify-card`, `notify-push`, `send-test-notification`. Deploy with `npx supabase functions deploy <name> --use-api`.
- **GitHub Pages**, with the source set to **GitHub Actions** (`.github/workflows/deploy.yml`, Node 22). Repo: `admin-theDiveClub/theDiveClub`.
- DNS lives in **Squarespace Domains**. Enter record names as prefixes only (e.g. `_acme-challenge.db`), because Squarespace appends the root domain itself.
- Local dev: `npx eleventy --serve` (localhost:8080). The service worker is deliberately *not* registered on localhost.
- Tools: VS Code with Claude Code, and Fork (git GUI).

## 7. Branches and deploy

- Work on **`production`** (staging). Merge `production` into **`main`**, then push `main`, which triggers the build and deploy.
- If a hotfix goes straight to `main`, merge `main` back into `production` afterwards.
- `11ty-setup` is merged and can be deleted. `propertyModel` is a separate branch.

## 8. Database conventions

- Table names use the `tbl_` prefix. Our own functions use the `tdc_` prefix.
- Helper functions for access rules live in the `private` schema, so they can't be called through the API.
- **Every schema change is a Supabase CLI migration** in `supabase/migrations/`. Never make schema changes in the dashboard.
  - `npx supabase migration new <name>` → write the SQL → `npx supabase db push --dry-run` → `npx supabase db push` → commit the file.
  - **Never edit a migration that's already been applied.** Corrections go in a new migration.
  - **Never run `npx supabase config push`.** `supabase/config.toml` holds local test values and would overwrite the live auth settings.
- Every table has RLS on and explicit grants. New tables are not auto-exposed to the API, and default privileges no longer give `anon` or `authenticated` TRUNCATE, REFERENCES, TRIGGER or MAINTAIN.
- Auth settings (passwords, SMTP, providers) are set in the dashboard, not in migrations.
- **Storage.** Buckets and their access rules are created in migrations too, not by clicking in the dashboard.
  - `player-avatars` (migration `player_avatars`): profile pictures. The object path is `<player_id>/<random>.webp` and `tbl_players.avatar_path` holds it. A check constraint on that column, plus the storage rules, both say "only your own folder".
  - The bucket is **public** on purpose: a player's picture has to appear next to their name on pages that people see without signing in (a tournament follow page, a league table), and asking for a signed URL for every face on a page is slow. Public does not mean findable — the random path can't be guessed from a name and nothing lists the bucket.
  - The browser crops, shrinks (512px) and re-encodes the picture before upload. That keeps it around 40 KB and, importantly, **strips EXIF**: phone photos carry the GPS coordinates of where they were taken.
  - Each upload gets a new random filename and the old file is deleted afterwards, so a cached copy of the old picture can never be served in its place.
  - `league-pictures` (migration `league_pictures`, 24 Oct): a league's own picture, built the same way. Path `<league_id>/<random>.webp`, held in `tbl_leagues.picture_path`, set only through `tdc_set_league_picture`; whoever may manage the league (`private.tdc_can_manage_league`) may upload. In a storage rule's subquery write `objects.name`, never a bare `name`: inside a subquery on `tbl_leagues` it means the league's name, and nothing matches.

## 9. Lessons that cost real time

- **Patch a function's text; never retype it.** Retyping dropped two guards from `tdc_merge_players` once and silently rewrote half of `tdc_card_state` another time. Copy the latest definition from the migrations, change only what is meant, and diff against the original with comments stripped. Every time.
- **Test a migration locally before UV pushes it**: `npx supabase db reset` rebuilds a clean copy from every migration, then `npx supabase test db`. Extract function text from a freshly reset database, never one left over from an earlier session. **Never add `--linked`** to either.
- **Check production's migration list before changing a migration you believe is unpushed.** On 24 Oct `20261024094617` was extended after UV had already pushed it; production kept the old content, and `db push` skips a version it has, so the rest would never have arrived. Anything new goes in a new migration once there is any doubt.
- **The live database has no rollback.** Any direct SQL connection to production is for reading only. Writes go through migrations that UV pushes.
- **`_site/` can be badly stale.** It was 27 hours behind `src/` on 21 Oct and sent an investigation down the wrong road. Never edit it; never trust its age.
- **The service worker caches aggressively.** When UV says a change has not appeared, suspect it (and a stale deploy) first.
- **Render layouts rather than reason about them.** A headless browser against the real stylesheets caught several layout bugs that reading the CSS never would. Check at 420px wide first — the main context is a phone at the bar.
- There is a **stop-hook nagging about uncommitted changes**. Ignore it; committing is UV's.
