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
- `_includes/layout.html` is the shared shell (head, PWA meta, nav, Supabase CDN + client, per-page scripts, SW registration).
  - Pages opt in with front matter: `layout: layout.html`, `title`, `description`, optional `extraScripts: [...]` (loaded after `supabaseClient.js`), optional `hideNav: true`.
- `_includes/nav.html` + `scripts/nav.js` + `stylesheets/nav.css` make up the shared nav. Nav items live in `_data/navLinks.json`.
  - Note: `src/navLinks.json` is a stray duplicate and can be removed.
- `.eleventy.js` handles passthrough copy (stylesheets, resources, scripts, components, sw.js, manifest, CNAME, robots, sitemap, favicon, Google verification file).
  - Any new top-level static file must be added there.
- `404.html`, `privacypolicy.html`, `termsofservice.html` and `google07470aafc2664052.html` must keep their **exact flat URLs**. Use permalinks for these, not pretty URLs.
- `scripts/supabaseClient.js` creates the global `supabaseClient` (publishable key, custom domain).
- `accounts/index.html` + `scripts/auth.js` are the login and signup page.
- `index.html` + `scripts/push.js` are the home page, with the test notification buttons.
- `sw.js` + `site.webmanifest` make the PWA installable (iOS confirmed).

## Status (as of 25 Sep 2026)
- Phase 0 (HTTPS, DNS cleanup) is **done**.
- Phase 1 (installable PWA shell) is **done**.
- Phase 2 (login + push notifications) is **in progress**:
  - Email/password and Google OAuth login both work end-to-end. The Google consent screen shows `db.thediveclub.org`.
  - Auth emails go through **Resend** SMTP from `no-reply@thediveclub.org` (domain verified; SPF, DKIM and DMARC pass). `no-reply@` is not a real mailbox, so replies bounce.
  - Auth settings: confirm email on, leaked-password protection on, minimum 8 characters with letters and digits, secure email change and secure password change on, current password required to change it. Anonymous sign-ins off.
  - Push subscribe works (`tbl_push_subscriptions`), and the Edge Function `send-test-notification` sends test pushes. Its source is copied into `supabase/functions/`, but the live version was deployed from the dashboard and hasn't been redeployed with the CLI yet.
  - Built with migrations: `tbl_push_subscriptions`, `tbl_players` (plus the signup trigger), `tbl_venues`, `tbl_venue_staff` (plus `private.tdc_has_venue_role`), and a permissions hardening pass.
  - Seed data: venue The Dive Club (`the-dive-club`); `admin@thediveclub.org` is owner, `yuvannaidoo@gmail.com` is staff.
  - **Still to do:**
    - Identifiers and ID verification (private identifiers table, SA ID verified in store by staff, walk-in claim/merge).
    - Push leftovers: deep link to the match URL, deploy the Edge Function via the CLI, restrict its CORS to `https://thediveclub.org`, iPhone login persistence check, Android testing, and the real "score changed" trigger once match tables exist.
    - Pages: login (min length 8, display name field), profile, reset password, branded auth email templates. Replace the test pages.
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
- **Explain and propose; don't bulk-edit.**
  - UV implements changes himself, one step at a time, and verifies each step (often with screenshots) before moving on.
  - Ask before editing files. Show exact find/replace blocks with file paths.
- Plain language, no unexplained jargon. One concern per step, and don't open several threads at once.
- **Built-in debugging:**
  - When expected data or a response is missing, show a visible marker (e.g. `TDC (Error): …`) and `console.error` with a `[Area]` prefix, following the pattern in `push.js`.
  - Never fall back silently.
- Security matters. Never put secrets (VAPID private key, service-role key) in client code or the repo.
- Test locally with `npx eleventy --serve` before pushing, then check the live site after a deploy.
