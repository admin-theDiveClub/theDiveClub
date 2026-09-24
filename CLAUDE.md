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

## Status (as of 23 Sep 2026)
- Phase 0 (HTTPS, DNS cleanup) is **done**.
- Phase 1 (installable PWA shell) is **done**.
- Phase 2 (login + push notifications) is **partly done**:
  - Email/password and Google OAuth login both work end-to-end. The Google consent screen shows `db.thediveclub.org`.
  - Push subscribe works. Subscriptions are upserted into `tbl_push_subscriptions` (`user_id`, `endpoint`, `p256dh`, `auth`; conflict on `endpoint`).
  - The Edge Function `send-test-notification` sends test pushes, custom icon included, and this works.
    - The Edge Function code and the VAPID private key live in Supabase (dashboard/secrets), **not in this repo**.
  - **Still to do:**
    - Real trigger: a DB webhook on match/score changes that calls an Edge Function, which pushes to the right player.
    - Deep link from a notification to the match URL.
    - Long-term login persistence check on iPhone.
    - Testing on Android.
    - Phone/SMS login. This needs Twilio, and whether to add it hasn't been decided.
    - SMTP for auth emails is deferred. Mailgun is the candidate; that account is kept but unsubscribed.
- Next after that: user profiles + RLS policies, and cleaning up the test pages.
- Eleventy migration is **done and live** (shared layout and nav, Actions deploy).
- Phase 4 is the real website pages, with SEO/JSON-LD per page. It is gated on photography once the property opens (~1 Oct).
- NAP/JSON-LD for the Google Business Profile is drafted. The phone number and image URL are still missing.

<!-- UV: update the status lines above as things progress -->

## Data architecture (decided, not yet built)
- One Supabase project for everything, never one project per venue.
- A global `players` table is the hub. Other domains reference it through an optional `player_id`.
- Domains:
  - **Global:** Identity, Ranking & Competition (WST-style points), Gamification (XP, raffles, fantasy league, hall of fame, top trumps).
  - **Venue-scoped via `venue_id`:** Commerce (closed-loop credits, working name "Cuedits"), Venue Ops (bookings, stock, table scheduling).
  - **Cross-cutting:** Platform (audit log, roles).
- Commerce and Ranking never share tables. `player_id` on a transaction is nullable (cash sales with no linked member are valid).
- Next design step: the Identity domain tables.
- Table naming so far: `tbl_` prefix.
- UV currently works in the Supabase UI, not with migrations. Save any SQL we write into the repo (e.g. `supabase/sql/`) for reference.

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
