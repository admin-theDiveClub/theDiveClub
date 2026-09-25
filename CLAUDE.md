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
  - Pages opt in with front matter: `layout: layout.html`, `title`, `description`, optional `extraScripts: [...]` (loaded after `supabaseClient.js`), optional `hideNav: true`.
- `_includes/nav.html` + `scripts/nav.js` + `stylesheets/nav.css` make up the shared nav. Nav items live in `_data/navLinks.json`.
  - Note: `src/navLinks.json` is a stray duplicate and can be removed.
- `.eleventy.js` handles passthrough copy (stylesheets, resources, scripts, components, sw.js, manifest, CNAME, robots, sitemap, favicon, Google verification file).
  - Any new top-level static file must be added there.
- `404.html`, `privacypolicy.html`, `termsofservice.html` and `google07470aafc2664052.html` must keep their **exact flat URLs**. Use permalinks for these, not pretty URLs.
- **Supabase library:** `@supabase/supabase-js` is pinned to an exact version in `package.json` and served from our own site at `/scripts/vendor/supabase.js` (copied from `node_modules` by `.eleventy.js`). Upgrade deliberately: `npm install @supabase/supabase-js@<version> --save-exact`, test, commit.
- `scripts/supabaseClient.js` creates the global `supabaseClient` (publishable key, custom domain).
- `scripts/tdc.js` holds the shared helpers (`TDC.error`, `TDC.status`, `TDC.showSupabaseError`, `TDC.getSession`, `TDC.requireSession`, `TDC.safeNext`, `TDC.getMyPlayer`). Use these on every page.
- `stylesheets/forms.css` holds the shared card, field, button, status and badge styles (`.tdc-card`, `.field`, `.btn-primary`, `.btn-secondary`, `.status`, `.badge`).
- Pages:
  - `index.html`: placeholder home page (logo, "Opening soon", My Account button) until the Phase 4 site.
  - `accounts/index.html` + `scripts/auth.js`: login and signup (display name, password rules, `?next=` return to the previous page).
  - `accounts/reset/index.html` + `scripts/reset.js`: request a reset email, then set a new password.
  - `accounts/profile/index.html` + `scripts/profile.js` + `scripts/push.js`: details, ID entry and verification badges, notifications, change password, log out.
  - Staff pages all load `scripts/staff-common.js` (`TDCStaff`: venue check, player search, results list) before their own script:
    - `staff/index.html` + `scripts/staff-hub.js`: staff hub linking the tools below (nav "Staff" link, staff only).
    - `staff/verify/index.html` + `scripts/staff-verify.js`: find a player and verify their ID from the physical document. `?player=<id>` preselects a player.
    - `staff/walk-in/index.html` + `scripts/staff-walk-in.js`: add a walk-in or guest (optional ID, phone, email).
    - `staff/link/index.html` + `scripts/staff-link.js`: link a walk-in/guest record to a player's account (in store, after checking ID).
- Front matter: put `description:` (and any value containing a colon) in quotes, or the build fails.
- `sw.js` + `site.webmanifest` make the PWA installable (iOS confirmed). The service worker caches only its `CORE_ASSETS` list (cache-first); pages are network-first. **Bump `CACHE_NAME` when a file in `CORE_ASSETS` changes** (logo, icons, manifest).
- **Cache-busting:** GitHub Pages lets browsers reuse CSS/JS for 10 minutes. `layout.html` adds `?v={{ build.version }}` (from `_data/build.js`, new on every build) to every stylesheet and script, including `extraScripts`, so each deploy's pages load that deploy's files. New stylesheets/scripts must be linked through `layout.html` or `extraScripts` to get the stamp.
- Eleventy's watcher sometimes misses new folders: if a new page gives a 404 locally, restart `npx eleventy --serve`.

## Status (as of 25 Sep 2026)
- Phase 0 (HTTPS, DNS cleanup) is **done**.
- Phase 1 (installable PWA shell) is **done**.
- Phase 2 (login + push notifications) is **live, with leftovers**:
  - Email/password and Google login work on the live site, including signup with display name, email confirmation, password reset and change password. The Google consent screen shows `db.thediveclub.org`.
  - Auth emails go through **Resend** SMTP from `no-reply@thediveclub.org` (domain verified; SPF, DKIM and DMARC pass). `no-reply@` is not a real mailbox, so replies bounce.
  - Auth settings: confirm email on, leaked-password protection on, minimum 8 characters with letters and digits, secure email change and secure password change on, current password required to change it (reset links are exempt, tested). Anonymous sign-ins off. Redirect URLs: `https://thediveclub.org/**` and `http://localhost:8080/**`.
  - Push: subscribe and test push work from the profile page on the installed iPhone app. The Edge Function `send-test-notification` source is in `supabase/functions/`, but the live version was deployed from the dashboard and hasn't been redeployed with the CLI yet.
  - Database (all via migrations): `tbl_push_subscriptions`, `tbl_players` (plus signup trigger), `tbl_venues`, `tbl_venue_staff`, permissions hardening, `tbl_player_identifiers`, `tbl_identifier_verifications`, and the functions `tdc_add_my_identifier`, `tdc_verify_identifier`, `tdc_revoke_verification`, `tdc_create_walk_in`, `tdc_staff_link_account`, `tdc_find_my_walk_in`, `tdc_claim_my_walk_in`.
  - ID verification works end to end: a player adds their SA ID or passport on the profile page; staff verify it on `/staff/verify/` by typing the number from the document. UV's personal account is verified at The Dive Club.
  - Walk-ins and claim work (migration `walk_ins_and_claim`): staff add walk-ins/guests (`tdc_create_walk_in`); a signup whose **confirmed** email matches a walk-in's email sees "We found your earlier record" on the profile and claims it (`tdc_find_my_walk_in`, `tdc_claim_my_walk_in`); otherwise staff link in store (`tdc_staff_link_account`). Claiming keeps the walk-in's player id (history stays attached), keeps the signup display name, prefers staff-entered first/last names, and deletes the empty signup record. Two different SA IDs block the join.
  - ⚠ `private.tdc_merge_players` must be updated whenever a new table references `tbl_players` (matches, credits, XP…), so nothing is left on the deleted record.
  - Seed data: venue The Dive Club (`the-dive-club`); `admin@thediveclub.org` is owner, `yuvannaidoo@gmail.com` is staff.
  - **Still to do:**
    - Audit log: record who linked, verified or revoked what (staff can link any walk-in to any account; there is no log yet).
    - Revoke-verification UI for owners/admins (the function exists).
    - Push leftovers: deploy the Edge Function via the CLI, restrict its CORS to `https://thediveclub.org`, iPhone login persistence check, Android testing, and the real "score changed" trigger + deep link once match tables exist.
    - Branded auth email templates (confirm, reset, email change).
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

## Database conventions
- Table names use the `tbl_` prefix. Our own functions use the `tdc_` prefix.
- Helper functions for access rules live in the `private` schema, so they can't be called through the API.
- **Every schema change is a Supabase CLI migration** in `supabase/migrations/`. Never make schema changes in the dashboard.
  - `npx supabase migration new <name>` → write the SQL → `npx supabase db push --dry-run` → `npx supabase db push` → commit the file.
  - **Never edit a migration that's already been applied.** Corrections go in a new migration.
  - **Never run `npx supabase config push`.** It would overwrite the live auth settings with local test values.
- Every table has RLS on and explicit grants. New tables are not auto-exposed to the API, and default privileges no longer give `anon` or `authenticated` TRUNCATE, REFERENCES, TRIGGER or MAINTAIN.
- Auth settings (passwords, SMTP, providers) are set in the dashboard, not in migrations.

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
