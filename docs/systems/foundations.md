# Foundations: accounts, identity, push, credits, data architecture

> Moved verbatim from `CLAUDE.md` on 23 Oct 2026. The first section was written as a status on 25 Sep; it still describes how auth, emails, push, identity, walk-ins and the merge work. Outstanding items from it are tracked in `docs/STATUS.md` and `docs/BACKLOG.md`. Originally headed *Status (as of 25 Sep 2026)*.

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
  - ⚠ `private.tdc_merge_players` must be updated whenever a new table references `tbl_players`, so nothing is left on the deleted record. Migration `20261014170000` brought it up to date (redeem codes, matches, frames, frame participants) and carries a query that lists every foreign key to `tbl_players` — run it rather than trusting a list. ~~Its body is untested~~ — **tested since 24 Oct** (`supabase/tests/028_merge_players.test.sql`), on the local copy, through `tdc_staff_link_account` as `/staff/link/` calls it; the local copy is what makes deleting an account-linked record safe to try.
  - **Squads, lineups and notification settings (migration `20261024090641`, audit A5).** `tbl_league_match_squad` (cascade), `tbl_league_match_order` (set null) and `tbl_notification_prefs` (cascade) were not moved, so a claim took a league player out of tonight's squad, emptied their lineup position and turned their notifications back on. The settings had been left out on purpose, on the grounds that the walk-in has none; but the settings that matter are the account's, on the record being deleted. All three move now. **On a clash the account's row stands and the walk-in's goes** (UV, 24 Oct): the account's setting for a category wins; in any match where the account is in the squad or lineup, the walk-in's squad row is deleted and its positions emptied, matched on the match rather than the side so one person never ends up in one team's lineup and the other's squad. A walk-in cannot reach those tables through any function, so a clash means a direct write. On 24 Oct the foreign-key query gave the same 22 references on local and production; every one is handled, and no uuid column names a player without a foreign key.
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
