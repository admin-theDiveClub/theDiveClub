# theDiveClub: project context for Claude

## What this is
theDiveClub (thediveclub.org) is the web app and PWA for **The Dive Club**, UV's pool lounge in Johannesburg (C5, The Gantry, Lonehill/Fourways). It is also designed as a **multi-venue platform**: other pool clubs will be able to adopt it, and players will share one community across venues.

## Stack
- **Eleventy 3 (11ty)** static site. All source is in `src/`. The build output goes to `_site/`, which is gitignored and never committed or edited.
- Plain HTML, CSS and JS, with no framework or Bootstrap. Styling uses CSS variables in `src/stylesheets/variables.css` (dark by default; `data-theme="light"` is a manual preview only, and there's no theme toggle UI yet).
- **Supabase** project `thediveclub-prod` (ref `dgmvavvegzxjwrbzfobh`, region eu-west-1), in the org "The Dive Club" under admin@thediveclub.org. It's served through the custom domain **`db.thediveclub.org`**. Auto-RLS is on, and new tables are not auto-exposed.
- **GitHub Pages**, with the source set to **GitHub Actions** (`.github/workflows/deploy.yml`, Node 22). Repo: `admin-theDiveClub/theDiveClub`.
- DNS lives in **Squarespace Domains**. Enter record names as prefixes only (e.g. `_acme-challenge.db`), because Squarespace appends the root domain itself.
- Local dev: `npx eleventy --serve` (localhost:8080). The service worker is deliberately *not* registered on localhost.
- Tools: VS Code and Fork (git GUI).

## Branches and deploy
- Work on **`production`** (staging). Merge `production` into **`main`**, then push `main`, which triggers the build and deploy.
- If a hotfix goes straight to `main`, merge `main` back into `production` afterwards.
- `11ty-setup` is merged and can be deleted. `propertyModel` is a separate branch.

## File map (src/)
- `_includes/layout.html` is the shared shell (head, PWA meta, nav, Supabase library + client, `tdc.js`, `forms.css`, per-page scripts, SW registration).
  - Pages opt in with front matter: `layout: layout.html`, `title`, `description`, optional `extraScripts: [...]` (loaded after `supabaseClient.js`), optional `extraStyles: [...]` (extra stylesheets, with the build stamp), optional `hideNav: true`.
- `_includes/nav.html` + `scripts/nav.js` + `stylesheets/nav.css` make up the shared nav. Nav items live in `_data/navLinks.json`.
  - The account button shows the signed-in player's profile picture when they have one, and the generic icon otherwise. `nav.js` swaps it only once the image has loaded, and falls back to the icon if the file is missing, so a stale path never leaves a broken picture in the nav. The profile page fires a `tdc:avatar-changed` window event after a save or a removal so the nav follows without a reload.
  - Note: `src/navLinks.json` is a stray duplicate and can be removed.
- `.eleventy.js` handles passthrough copy (stylesheets, resources, scripts, components, sw.js, manifest, CNAME, robots, sitemap, favicon, Google verification file).
  - Any new top-level static file must be added there.
- `404.html`, `privacypolicy.html`, `termsofservice.html` and `google07470aafc2664052.html` must keep their **exact flat URLs**. Use permalinks for these, not pretty URLs.
- **Supabase library:** `@supabase/supabase-js` is pinned to an exact version in `package.json` and served from our own site at `/scripts/vendor/supabase.js` (copied from `node_modules` by `.eleventy.js`). Upgrade deliberately: `npm install @supabase/supabase-js@<version> --save-exact`, test, commit.
- `scripts/supabaseClient.js` creates the global `supabaseClient` (publishable key, custom domain).
- `scripts/tdc.js` holds the shared helpers (`TDC.error`, `TDC.status`, `TDC.showSupabaseError`, `TDC.getSession`, `TDC.requireSession`, `TDC.safeNext`, `TDC.getMyPlayer`). Use these on every page.
- **Fonts** live in `src/resources/fonts/` (published automatically by the existing `resources` passthrough). Two families, declared in `global.css` and used via the `--font-display` / `--font-body` tokens in `variables.css`:
  - **Rushford Clean** (headings only, `h1`-`h4`): UV's own licensed font, shipped as woff2 -> woff -> otf. It's an all-caps face with no em dash or middle dot, so keep those out of headings. `size-adjust: 118%` on its `@font-face` is the single knob for how large headings read; change that number rather than every heading's font-size.
  - **Selawik** (body text): Microsoft's open-source (SIL OFL) metric-compatible replacement for Segoe UI, which is proprietary and can't legally be served as a web font. `--font-body` lists `"Segoe UI"` first so Windows uses its locally installed copy; every other device downloads Selawik, which has identical metrics (2048 upem, 1434 cap height), so both look the same. Licence kept at `src/resources/fonts/selawik-LICENSE.txt` — it must stay with the font files.
- `stylesheets/forms.css` holds the shared card, field, button, status and badge styles (`.tdc-card`, `.field`, `.btn-primary`, `.btn-secondary`, `.status`, `.badge`).
- Pages:
  - `index.html`: placeholder home page (logo, "Opening soon", My Account button) until the Phase 4 site.
  - `accounts/index.html` + `scripts/auth.js`: login and signup (display name, password rules, `?next=` return to the previous page).
  - `accounts/reset/index.html` + `scripts/reset.js`: request a reset email, then set a new password.
  - `accounts/profile/index.html` + `scripts/profile.js` + `scripts/push.js`: earlier-record claim banner, details, ID entry and verification badges, notifications, change password (with the emailed code step when Supabase asks for reauthentication), change email (confirmed on both addresses), log out. Password/email changes are only shown to email-and-password accounts.
  - Staff pages all load `scripts/staff-common.js` (`TDCStaff`: venue check, player search, results list) before their own script:
    - `staff/index.html` + `scripts/staff-hub.js`: staff hub linking the tools below (nav "Staff" link, staff only).
    - `staff/verify/index.html` + `scripts/staff-verify.js`: find a player and verify their ID from the physical document. `?player=<id>` preselects a player.
    - `staff/walk-in/index.html` + `scripts/staff-walk-in.js`: add a walk-in or guest (optional ID, phone, email).
    - `staff/link/index.html` + `scripts/staff-link.js`: link a walk-in/guest record to a player's account (in store, after checking ID).
    - `staff/verifications/index.html` + `scripts/staff-verifications.js`: owners/admins review the venue's ID verifications and revoke mistakes (reason required). Its hub tile shows only for owners/admins.
  - `staff/board/index.html`: the **Project Board** (owners only, gold hub tile). A thin page; its code lives outside `src/` in `tools/project-board/app/` (see "Project board" below).
- `stylesheets/global.css` has `[hidden] { display: none !important; }`, so the `hidden` attribute always wins over classes that set `display`.
- Front matter: put `description:` (and any value containing a colon) in quotes, or the build fails.
- `sw.js` + `site.webmanifest` make the PWA installable (iOS confirmed). The service worker caches only its `CORE_ASSETS` list (cache-first); pages are network-first and always revalidated with the server (`cache: 'no-cache'`), so a deploy shows on the next page load. **Bump `CACHE_NAME` when a file in `CORE_ASSETS` changes** (logo, icons, manifest).
- **Cache-busting:** GitHub Pages lets browsers reuse CSS/JS for 10 minutes. `layout.html` adds `?v={{ build.version }}` (from `_data/build.js`, new on every build) to every stylesheet and script, including `extraScripts`, so each deploy's pages load that deploy's files. New stylesheets/scripts must be linked through `layout.html` or `extraScripts` to get the stamp.
- Eleventy's watcher sometimes misses new folders: if a new page gives a 404 locally, restart `npx eleventy --serve`.

## Status (as of 25 Sep 2026)
- Phase 0 (HTTPS, DNS cleanup) is **done**.
- Phase 1 (installable PWA shell) is **done**.
- Phase 2 (login + push notifications) is **live, with leftovers**:
  - Email/password and Google login work on the live site, including signup with display name, email confirmation, password reset and change password. The Google consent screen shows `db.thediveclub.org`.
  - Auth emails go through **Resend** SMTP from `no-reply@thediveclub.org` (domain verified; SPF, DKIM and DMARC pass). `no-reply@` is not a real mailbox, so replies bounce.
  - Branded email templates (diver GIF + wordmark, dark theme) are installed in Supabase for: confirm signup, reset password, change email, reauthentication, and the security notifications (password changed, email changed, sign-in method linked/removed), which are switched on. The HTML and subjects are recorded in `supabase/templates/` (see its README); the dashboard is where they actually live, so **edit the repo copy and re-paste** when changing one. Images: `src/resources/branding/email-dive.gif`, `email-wordmark.png`.
  - Auth settings: confirm email on, leaked-password protection on, minimum 8 characters with letters and digits, secure email change and secure password change on, current password required to change it (reset links are exempt, tested). Anonymous sign-ins off. Redirect URLs: `https://thediveclub.org/**` and `http://localhost:8080/**`.
  - Push: subscribe and test push work from the profile page on the installed iPhone app. The Edge Function `send-test-notification` is deployed **from the repo** (`supabase/functions/`): `npx supabase functions deploy send-test-notification --use-api` (no Docker needed). It requires a login (`verify_jwt = true` in `supabase/config.toml`), only accepts browser calls from `https://thediveclub.org` and `http://localhost:8080`, limits title/body length, and only allows same-site paths for the link and icon. Secrets (VAPID_*) live in Supabase, not the repo.
  - Database (all via migrations): `tbl_push_subscriptions`, `tbl_players` (plus signup trigger), `tbl_venues`, `tbl_venue_staff`, permissions hardening, `tbl_player_identifiers`, `tbl_identifier_verifications`, and the functions `tdc_add_my_identifier`, `tdc_verify_identifier`, `tdc_revoke_verification`, `tdc_list_venue_verifications`, `tdc_create_walk_in`, `tdc_staff_link_account`, `tdc_find_my_walk_in`, `tdc_claim_my_walk_in`.
  - ID verification works end to end: a player adds their SA ID or passport on the profile page; staff verify it on `/staff/verify/` by typing the number from the document. UV's personal account is verified at The Dive Club.
  - Walk-ins and claim work (migration `walk_ins_and_claim`): staff add walk-ins/guests (`tdc_create_walk_in`); a signup whose **confirmed** email matches a walk-in's email sees "We found your earlier record" on the profile and claims it (`tdc_find_my_walk_in`, `tdc_claim_my_walk_in`); otherwise staff link in store (`tdc_staff_link_account`). Claiming keeps the walk-in's player id (history stays attached), keeps the signup display name, prefers staff-entered first/last names, and deletes the empty signup record. Two different SA IDs block the join.
  - ⚠ `private.tdc_merge_players` must be updated whenever a new table references `tbl_players`, so nothing is left on the deleted record. Migration `20261014170000` brought it up to date (redeem codes, matches, frames, frame participants) and carries a query that lists every foreign key to `tbl_players` — run it rather than trusting a list. Its body is untested: the merge deletes a record linked to a real auth account, so it has to be tested through the app's staff link flow, not from a SQL console.
  - Seed data: venue The Dive Club (`the-dive-club`); `admin@thediveclub.org` is owner, `yuvannaidoo@gmail.com` is staff.
  - **Still to do:**
    - Audit log: record who linked, verified or revoked what (staff can link any walk-in to any account; there is no log yet).
    - Push leftovers: iPhone login persistence check, Android testing, and the real "score changed" trigger + deep link once match tables exist.
    - Test the emails not yet seen live: change email (both addresses), reauthentication code (password change >24 h after login), sign-in method linked/removed.
    - Optional: slim down the email images (GIF ~360 KB, wordmark ~143 KB).
    - Account deletion: deleting an auth user leaves the `tbl_players` row (by design, for match history). A proper "delete my account" flow needs deciding (POPIA).
    - Phone login: probably dropped in favour of SA ID verification, not decided.
- Eleventy migration is **done and live** (shared layout and nav, Actions deploy).
- Phase 4 is the real website pages, with SEO/JSON-LD per page. It is gated on photography once the property opens (~1 Oct).
- NAP/JSON-LD for the Google Business Profile is drafted. The phone number and image URL are still missing.
- DNS note: the TXT record named `thediveclub.org` (google-site-verification) has the doubled-domain problem and isn't visible to Google. Sort it out during the SEO work.

<!-- UV: update the status lines above as things progress -->

## Data architecture
- One Supabase project for everything, never one project per venue.
- **`tbl_players` is the hub.** One row per person, with or without a login:
  - `user_id` links to `auth.users`. It can be empty and is unique. It's empty for guests and for walk-ins who haven't signed up.
  - `player_type` is `member`, `walk_in` or `guest`. `guest_of_player_id` records whose guest someone is.
  - Signups create a `member` row automatically (trigger). A walk-in claims their existing row later, through the identifiers step.
  - Only non-private info goes here (display name, first and last name), and all signed-in users can read it.
- **Private identifiers** (SA ID, passport, phone, email) go in a separate protected table, never in `tbl_players`.
  - Verification belongs to the ID, and is done in store by staff (verified_by, verified_at).
  - Blocking rules per business track are enforced in the database, not only in the UI. Cannabis: everything is blocked until verified. Pool: league entry requires verification.
- Domains:
  - **Global:** Identity, Ranking & Competition (WST-style points), Gamification (XP, raffles, fantasy league, hall of fame, top trumps).
  - **Venue-scoped via `venue_id`:** Commerce (closed-loop credits, working name "Cuedits"), Venue Ops (bookings, stock, table scheduling).
  - **Cross-cutting:** Platform (audit log, roles).
- Commerce and Ranking never share tables. `player_id` on a transaction is nullable (cash sales with no linked member are valid).

### Match scoring (migrations `20261014140000`, `20261014150000`, `20261014160000`, applied 14 Oct)
- **Frames are the only record.** The score, the match winner and every statistic are counted from `tbl_frames` on demand and never stored. Don't add a score column.
- `tbl_matches` — two sides, each independently a player or a team (`home_side_kind` / `away_side_kind`), because a singles league, a tournament round and two mates at the bar are all player vs player while a team league night is team vs team. A match needs no league or tournament: a social match is first class. `rules` is jsonb frozen at creation, so a later change to a league's settings can't rescore frames already played. `sanctioned` is a column, never a ruleset key, so the ruleset can't promote a match to counting for ranking. `card_version` bumps on every frame change, so two captains' submissions only agree when they refer to the same card.
  - `home_team_id` / `away_team_id` have no foreign key yet — it's added with the teams table.
- `tbl_frames` — one row per frame. `tbl_frame_participants` — one row per player per side, filled in even for singles, so every player statistic is one join away and never branches on format. This is what makes individual records recoverable from a team league.
- **Writes go through functions, never straight from the browser**, because which side breaks follows from the frames before it and a check constraint can only see its own row:
  - `tdc_record_frame(match_id, frame_no, frame_jsonb)` — creates or replaces that frame number, so one call serves "new frame" and "fix frame 3". Takes one json object rather than thirty arguments so a field can be added without dropping the function. Unknown field names are rejected, not silently dropped. Omit `break_side` and the rule decides it; pass one and it's recorded as a correction (`break_side_manual`) which the rule then leaves alone.
  - `tdc_remove_frame(match_id, frame_no)` — deletes and closes the numbering up, since a gap breaks every "the frame before" rule.
  - `tdc_rederive_break_sides(match_id)` — rewrites every rule-driven break side in order, skipping hand-corrected frames. Run after anything that moves the whole match. This is what makes "change who broke first and the whole match follows" work.
  - `private.tdc_can_edit_match(match_id)` — **the single place deciding who may touch a card.** Today: either side's player, anyone who played a frame in the match (this is what covers team matches, where the sides are teams and the people sit in frames), and venue staff. Captains and league directors go in here when those tables land; nothing else should need changing.
  - `private.tdc_break_side_for_frame(match_id, frame_no)` — the break rule. `alternate` flips the *previous frame's actual* break side rather than counting odd/even from the start, so a correction carries through. `lag_each_frame` and `by_schedule` return null on purpose: the rule has no answer.
- Rules read from the match's jsonb: `break_determination` (`alternate` | `winner_breaks` | `loser_breaks` | `first_breaks` | `lag_each_frame` | `by_schedule`, default `alternate`), `break_finish_requires_breaker` (default true — it's disputed between disciplines, which is why it's per match and not a constraint).
- Approval/locking is **not** built. `tbl_matches.status` is the lifecycle of play only (`scheduled`, `in_progress`, `complete`, `abandoned`); whether a card needs a captain's signature is a league setting, and submitted/approved will derive from a submissions table.
- Dummy match for UI work: `215b10ec-de44-4c61-a513-ab9768c43e72` (UV 3 – Linton 2, five frames, alternate breaks). Its `rules` carries all 21 keys, because the page errors on a missing one by design.

### The match page (`src/match/`, `scripts/match.js`, `stylesheets/match.css`)
- Two modes from the address: `/match/` shows the built-in mockup (quickest way to work on layout), `/match/?id=<uuid>` reads that match from the database. `loadMatch()` builds exactly the mockup's shape, so nothing else in the file knows where its data came from.
- **Frames and settings both read and save.** The one exception is "Referee", which has no column yet, so the page deliberately doesn't send it.
- Settings go through `tdc_update_match_settings(match_id, rules, first_break_side)` — rules and the lag winner in one call, because both move the whole match. It validates the ruleset whole (all 21 keys, no extras, known enumerated values), re-derives every break side, and puts back any frame the new rules made impossible, returning counts of both.
- **A correction that would invalidate a frame's result asks first** (`resultLostBy()` / `confirmCellChange()`). The result picker only ever offers results that fit who broke, so a frame is valid when recorded; it's a later edit to the break side or break event that can invalidate it. The pop-up names the rule in the way — "a break & finish needs a ball potted on the break" — rather than greying out a button for reasons the user can't see.
- Saving hooks into the only three places that change the card: `pushFrame()`, `setCell()` and `undo()`. Keep it that way — a fourth write path that skips `persistFrame()` would save nothing and look like it worked.
- **After every write the match is read back, not patched locally.** The server owns the derived break side: correcting frame 2 can move who breaks frames 3 onwards, and `tdc_record_frame` re-derives the lot. A failed write reloads too, so the screen never keeps a change the database refused.
- `framePayload()` leaves `break_side` out unless someone set it by hand — omitting it is what tells the function to derive it.
- **Offline.** A club with bad wifi is the normal case, so the stage keeps working with no connection: frames queue in `localStorage` under `tdc.match.<id>.queue` and go when the connection returns. Settings and corrections to earlier frames lock, because both re-derive or renumber the whole match. Undo still works for a frame that hasn't been sent yet — it drops it from the queue — but not for one already on the server.
  - Before replaying, the queue checks the match's `card_version` against what it was when the queue started. If somebody else scored in the meantime it stops and says so rather than renumbering their frames.
  - `flushQueue()` guards against running twice: browsers raise `online` more than once, and two flushes would send the same frames twice.
  - The nav's offline pip is in `nav.html` / `nav.js` and works on **every** page, firing `tdc:offline` and `tdc:online` window events. Other pages with input should listen for those and lock whatever they can't do — not yet done.
- Known gaps, all deliberate and visible rather than invented: `tables` is `['Table not set']` (no tables table yet), `context.kind` is always `social` (no league layer yet), and a team match refuses to load with an explanation.

## Database conventions
- Table names use the `tbl_` prefix. Our own functions use the `tdc_` prefix.
- Helper functions for access rules live in the `private` schema, so they can't be called through the API.
- **Every schema change is a Supabase CLI migration** in `supabase/migrations/`. Never make schema changes in the dashboard.
  - `npx supabase migration new <name>` → write the SQL → `npx supabase db push --dry-run` → `npx supabase db push` → commit the file.
  - **Never edit a migration that's already been applied.** Corrections go in a new migration.
  - **Never run `npx supabase config push`.** It would overwrite the live auth settings with local test values.
- Every table has RLS on and explicit grants. New tables are not auto-exposed to the API, and default privileges no longer give `anon` or `authenticated` TRUNCATE, REFERENCES, TRIGGER or MAINTAIN.
- Auth settings (passwords, SMTP, providers) are set in the dashboard, not in migrations.
- **Storage.** Buckets and their access rules are created in migrations too, not by clicking in the dashboard.
  - `player-avatars` (migration `player_avatars`): profile pictures. The object path is `<player_id>/<random>.webp` and `tbl_players.avatar_path` holds it. A check constraint on that column, plus the storage rules, both say "only your own folder".
  - The bucket is **public** on purpose: a player's picture has to appear next to their name on pages that people see without signing in (a tournament follow page, a league table), and asking for a signed URL for every face on a page is slow. Public does not mean findable — the random path can't be guessed from a name and nothing lists the bucket.
  - The browser crops, shrinks (512px) and re-encodes the picture before upload. That keeps it around 40 KB and, importantly, **strips EXIF**: phone photos carry the GPS coordinates of where they were taken.
  - Each upload gets a new random filename and the old file is deleted afterwards, so a cached copy of the old picture can never be served in its place.


## Project board
- The owner's task list for the business and the website, at **`/staff/board/`**. Owners only: the hub tile shows for owners, and the tables' access rules allow only `owner` at the venue (UV uses admin@thediveclub.org; his personal account is staff and can't see it).
- Kept separate from the rest of the site on purpose:
  - Code: `tools/project-board/app/board.js` and `board.css` (outside `src/`). `.eleventy.js` publishes that folder at `/staff/board/app/`. Only `app/` is published; the README stays private.
  - Page: `src/staff/board/index.html` is only front matter and an empty box the script fills.
  - Database: `tbl_pm_items`, `tbl_pm_groups`, `tbl_pm_people`, `tbl_pm_links` (migration `project_board`), all scoped by `venue_id`. Details in `tools/project-board/README.md`.
- It uses the site's colour variables and `TDC` helpers, and loads everything on open, then reloads after each change and when the tab is shown again (no Realtime).
- The board is the high-level list; this file stays the detailed record for the website. When a website item here is finished or added, update the board too.

## How to work with UV
- **Claude may write files directly in the repo; UV reviews, runs and commits.**
  - Claude writes/edits files (pages, scripts, styles, migrations, this file) and explains each change briefly.
  - UV reviews the changes in Fork, runs terminal commands (`npx eleventy --serve`, `npx supabase db push`), tests, and commits/pushes. Claude never commits or pushes.
  - Still one step at a time, with a test after each. Dashboard settings (Supabase, Google, Resend, Squarespace) are done by UV.
  - Files use CRLF line endings and tabs.
- Plain language, no unexplained jargon. One concern per step, and don't open several threads at once.
- **Built-in debugging:**
  - When expected data or a response is missing, show a visible marker (e.g. `TDC (Error): …`) and `console.error` with a `[Area]` prefix, using the helpers in `scripts/tdc.js`.
  - Never fall back silently.
- Security matters. Never put secrets (VAPID private key, service-role key) in client code or the repo.
- Test locally with `npx eleventy --serve` before pushing, then check the live site after a deploy.
- UV won't remember implementation details later: keep this file, migration comments and commit messages clear enough to be the record.
