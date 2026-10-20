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
  - **Rushford Clean** (headings only, `h1`-`h4`): UV's own licensed font, shipped as woff2 -> woff -> otf. It's an all-caps face with no em dash or middle dot, so keep those out of headings. `size-adjust: 150%` on its `@font-face` is the single knob for how large headings read; change that number rather than every heading's font-size.
  - **Selawik** (body text): Microsoft's open-source (SIL OFL) metric-compatible replacement for Segoe UI, which is proprietary and can't legally be served as a web font. `--font-body` lists `"Segoe UI"` first so Windows uses its locally installed copy; every other device downloads Selawik, which has identical metrics (2048 upem, 1434 cap height), so both look the same. Licence kept at `src/resources/fonts/selawik-LICENSE.txt` — it must stay with the font files.
- `stylesheets/variables.css` is the **token layer**, and nothing else should hold a raw colour, radius or spacing value.
  - Brand: `--color-primary` (teal), `--color-cream`, `--color-ink` — the three colours the logo artwork is drawn from. `--color-on-primary` is what sits on top of a teal fill, and differs per theme: the dark theme's teal needs dark text, the light theme's deepened teal needs cream.
  - Depth: `--alpha-1`-`--alpha-4` (black at low alpha, matching how the artwork builds its shadows), then `--shadow-raised`, `--shadow-panel`, `--scrim`, `--hover-wash`. The alpha values are **provisional** until UV supplies the exact ones from the artwork.
  - Space and shape: `--space-1`-`--space-7`, `--radius-sm/md/lg/pill/round`, `--nav-height`.
  - The light theme is a cream page (`--bg-base: #f4e8d2`), not a grey one, and its teal, success, warning, error and owner colours are all deepened so they still pass contrast on cream.
- `stylesheets/forms.css` holds the shared card, field, button, status and badge styles (`.tdc-card`, `.field`, `.btn-primary`, `.btn-secondary`, `.status`, `.badge`), and below those a **shared component layer** written to work outside `.tdc-card`: `.btn` (the button shape, lifted off `.tdc-card button`), `.btn-sm`, `.btn-row`, `.btn-danger`, `.toolbar`, `.tdc-table` + `.table-scroll` + `.num`, `.list-row`, `.empty`, `.panel`, `.tdc-card.wide`, and `.badge` in `warn` / `pending` / `live` / `paid`.
  - Use a token or an existing component before adding a value or a class. Four stylesheets had invented their own variable names (`--warning-color`, `--error-color`, `--accent-color`, `--text-color`), none of which existed, so they had been silently falling back to hardcoded hexes since they were written.
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
  - `tournaments/index.html` + `scripts/tournaments.js`: the tournaments this account runs or is entered in. Only one you run is a link, because the public bracket does not exist yet.
  - `tournaments/new/index.html` + `scripts/tournament-new.js`: create a tournament. The ruleset controls are generated from `TDCMatchDef`, filtered to `scope: 'rules'` — the `'match'` ones describe one match being played and there is no match here yet.
  - `tournaments/manage/index.html` + `scripts/tournament-manage.js`: the entrant list, at `?t=<tournament id>`. Search, add, status, paid, seed, randomise, remove.
  - `staff/board/index.html`: the **Project Board** (owners only, gold hub tile). A thin page; its code lives outside `src/` in `tools/project-board/app/` (see "Project board" below).
- `stylesheets/global.css` has `[hidden] { display: none !important; }`, so the `hidden` attribute always wins over classes that set `display`.
- Front matter: put `description:` (and any value containing a colon) in quotes, or the build fails.
- `sw.js` + `site.webmanifest` make the PWA installable (iOS confirmed). The service worker caches only its `CORE_ASSETS` list (cache-first); pages are network-first and always revalidated with the server (`cache: 'no-cache'`), so a deploy shows on the next page load.
  - **`CACHE_NAME` carries the build stamp and no longer needs bumping by hand.** `layout.html` registers `/sw.js?v={{ build.version }}` and the worker reads that stamp into its cache name, so every deploy is a new cache and the `activate` handler deletes the previous one. Before this, a changed logo or icon stayed cached on every device that already had the old one, because `CORE_ASSETS` is served cache-first and the logo URL carries no stamp.
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
- **The scorecard starts simple and grows.** `track_breaks` off (the default) gives two names, two scores and one Win button a side: no lag question, no break buttons, no break & finish, and frames stored with null break data. Turning settings on adds controls. Social players want the score and nothing else; everything else belongs to league play.
  - Settings that add something to the card are gated with `when:` in the `SETTINGS` array, so the panel and the card stay in step automatically. New recording features should follow the same `track_…` shape.
  - `break_finish_enabled` exists because "breaks are tracked" and "we count break & finishes" are different questions.
  - Turning `track_breaks` off mid-match clears the break data it had recorded, so the card and the database agree.
- Rules read from the match's jsonb: `break_determination` (`alternate` | `winner_breaks` | `loser_breaks` | `first_breaks` | `lag_each_frame` | `by_schedule`, default `alternate`), `break_finish_requires_breaker` (default true — it's disputed between disciplines, which is why it's per match and not a constraint).
- Approval/locking is **not** built. `tbl_matches.status` is the lifecycle of play only (`scheduled`, `in_progress`, `complete`, `abandoned`); whether a card needs a captain's signature is a league setting, and submitted/approved will derive from a submissions table.
- Dummy match for UI work: `215b10ec-de44-4c61-a513-ab9768c43e72` (UV 3 – Linton 2, five frames, alternate breaks). Its `rules` carries all 21 keys, because the page errors on a missing one by design.

### Finishing a scorecard (`tbl_match_events`, migration `20261015160000`)
- **One submits, the other answers.** Signing your own card proves nothing, so `tdc_answer_card` refuses the submitter. Silence past `dispute_window_hours` counts as agreement, or cards sit unfinished forever.
- An **append-only log**, not a status column — same reason frames have no score column. States (`in_progress`, `awaiting`, `agreed`, `disputed`) are worked out by `tdc_card_state` from the events.
- **An agreement cannot survive a changed card.** A submission records the `card_version` it signed, and any frame change bumps that version, so editing a frame silently retires the submission. This falls out of the design rather than being enforced.
- A dispute needs a reason and **reopens the match** for editing — "that's wrong, fix it".
- `tdc_delete_match` is players-only and refuses anything sanctioned. **The one place a frame is destroyed rather than corrected**, which is why it is this narrow. Add league and competition checks to it when those tables exist.
- **`approval_mode` decides whether anyone has to sign** (migration `20261015210000`). It was validated and read nowhere for a week, so every match behaved as though a dispute window were set.
  - `none` — submitting settles it. `tdc_submit_card` writes a second `agreed` event in the same transaction, so the card locks immediately. The settlement is **recorded at the time, not re-derived from the rules**: the ruleset can be changed later, and a card settled under "no approval" must not start reading as unsettled because somebody turned approval on afterwards. Same reason frames carry their own result.
  - `dispute_window` — **the default**, 48 hours. A card nobody has to answer is a card nobody checks.
  - **The 48-hour lock needs no scheduled job.** `tdc_card_state` returns `agreed` the moment `now()` passes the deadline, and the lock trigger asks it on every write — so a card stops being editable when the window closes, with no job to miss and nothing to catch up on. Only the *reminder* notification needs a cron.
- **A finished match offers to submit itself.** When the win condition is met the page asks — "UV wins it, 5–3. Submit the card?" — rather than leaving submission as a step to remember, because a forgotten card is the one nobody ever agrees. It **asks rather than just doing it**, because submitting is what locks the card and a mis-tap on the deciding frame should cost a tap, not the night's match. The frame is saved either way; only the submission waits for an answer. "Not yet" leaves the card open with the Submit button where it was.
  - It fires only on the frame that *ends* the match (`wasOver`), or reopening a finished match to fix something would ask again on the first correction — and answering would lock it after one fix.
  - What happens next is the approval mode's business, not the page's: `none` settles on submission, `dispute_window` waits.
- **`matchWinner()` and `matchOver()` are different questions.** Only `race_to` was ever worked out, so a best-of or a fixed number of frames never ended — clocks stayed live and the match never read as complete. `best_of N` is won at `floor(N/2)+1`; `fixed_frames N` ends when N are played, **which can be a draw** — over, with no winner. Timed and free play end when the players say so. Every "the match has ended" check uses `matchOver()`; `matchWinner()` is only for who won.
- **The result page appears at submission, not agreement.** The match is over and the result is what matters. So that page carries the answer controls too (the scorecard panel lives on the stage, which is no longer on screen): "Looks right" / "Something is wrong" for the other player, and **Withdraw** for the submitter — `tdc_reopen_card` accepts an unanswered card from the person who sent it. The other player's way back in is to dispute, which asks for a reason, and that stays true. A disputed card puts the stage back, which is exactly what a dispute asks for.
- `created_at` defaults to `clock_timestamp()`, not `now()`. `now()` is the transaction start time, so two events written together shared a timestamp and the state machine could not tell which came first.
- On the page: the Scorecard panel below the stage. `CARD_ACTS` are deliberately **not** in `WRITE_ACTS` — a player answers a card they are not allowed to change, which is what makes the answer worth anything. When `myPlayerId` is unknown the answer buttons are hidden rather than guessed at.

### Telling the other player (`supabase/functions/notify-card/`, migration `20261015200000`)
- Fired **from the page**, not by a database trigger: the person doing it is standing there, so a failed notification can be logged and ignored without the write being at risk. `tellTheOther(kind)` runs after the RPC has already succeeded, and `cardAction` takes the kind as an argument so a new card action can't forget it.
- The page sends **only `{ match_id, kind }`** (`opponent_added`, `submitted`, `agreed`, `disputed`, `reopened`, `deleted`). It does not send the message and does not say who to tell. The function works both out from the match itself — otherwise anyone signed in could push any text to anyone, which is a spam machine rather than a notification.
- `opponent_added` is fired by the **create page**, not the match page, and is the only kind sent before a ball is struck: `NO_SCORE` keeps it from reading frames for a score that would read "0 – 0", and it describes the match instead ("Race to 7, 9-ball") so the recipient can decide whether they want the game.
- **Auth failures name their cause.** "No login token was sent" and "the login token was refused — *reason*" were one message, which made a real fault on one device impossible to tell apart from not being signed in. Both Edge Functions now say which, and the second carries the auth server's own words, because *expired* and *bad signature* need completely different fixes.
- The function checks the caller is in the match, picks the *other* player, and writes the score **from the recipient's point of view**, so it reads the way they would say it.
- Benign cases answer `{ sent: 0, note: … }` rather than an error: a team match (no single other player), a walk-in with no account, or someone who hasn't turned notifications on. Only a real fault is logged with `[Match]`.
- Dead subscriptions (404/410 from the push service) are deleted as they're found.
- `tbl_deleted_matches` exists because **a deleted match has nothing left to address a message to** — no names, no score, no participants. It keeps who was playing, who removed it and a one-line summary written at the time. It is not a backup: the frames are gone.
- The page `await`s the `deleted` notification before leaving for `/matches/`, since the tab is about to go.
- Deploy: `npx supabase functions deploy notify-card --use-api`. **The migration must be pushed first**, because the function reads `tbl_deleted_matches`.

### Two people scoring at once (migration `20261017120000`)
- **Refuse and reload.** Every frame write carries `p_card_version` — the version the browser last read — and a write aimed at a card that has moved on is refused. Nothing is merged and nothing is guessed at: the page says somebody else has scored, the match is read back, and the score in front of the player is the real one before they carry on.
- This closes two holes: the second write used to land on top silently, and **Undo was worse** — it removes "the last frame", so it could take away a frame the other person had just added. Both are refused now.
- Checked in `private.tdc_check_card_version`, called from `tdc_record_frame` and `tdc_remove_frame`, **not in the browser** — the browser is the thing that is out of date, and a database check covers every future route in (timer hardware, team scoresheet) without anyone remembering.
- It raises **SQLSTATE `TDC01`**, so `savingFinished()` can tell a conflict from every other refusal without reading the message text. `TDC01` is in the range Postgres leaves to applications.
- **`p_card_version` defaults to null, meaning "do not check".** The offline queue checks once before replaying, and must not be checked per frame: its own first write moves the version, which would then refuse its own second.
- Adding a parameter meant **dropping and recreating** rather than replacing — a replace cannot change a signature, and an overload would leave two functions the API could not choose between. The bodies are otherwise untouched, and the grants are re-applied in the same migration.
- Still last-write-wins: `tdc_update_match_settings`. Two people changing settings at the same moment is rarer than two people scoring, and settings re-derive the whole match anyway.

### When a match is played (migration `20261017140000`)
- `tbl_matches.scheduled_at` existed from the first matches migration and **nothing ever wrote to it** — no field on the create page, no control on the match page. Every match was "now, apparently".
- `tdc_set_match_time` is its own function, **not part of `tdc_update_match_settings`**, because a time is not a rule: settings re-derive every break side and can put frames back that new rules made impossible, while a time changes nothing about what was played. Folding it in would mean re-deriving a whole match to move a fixture by an hour.
- The create page calls it **as a second call** after `tdc_create_match` rather than passing another argument, which would have meant dropping and recreating a working function. If that second call fails the match exists with no time — the state every match was in until now, and fixable on the match page — so it is reported rather than treated as a failed creation.
- Clearing it is allowed and means "no particular time". Refused on a settled card, and more than two years either way, which catches a year typed wrong without blocking a fixture list published a season ahead.
- **`datetime-local` has no time zone.** The browser gives and takes "2026-10-21T19:30" meaning local time, so `localInputValue()` formats from the viewer's own clock — `toISOString()` would hand it UTC and show the wrong hour to everyone but Greenwich. The field is not rewritten while it has focus, or the cursor jumps as the panel redraws.
- **`time_set` is the first notification that goes to both players**, via `TELL_BOTH` in the Edge Function: a time is an arrangement between two people, and whoever set it may be venue staff rather than either of them. That is also why the message is not written from one side's point of view.
  - Creating a match with a time folds it into `opponent_added` instead of sending two notifications a second apart.
  - Because there can now be two recipients, the message is built **per person** (`messageFor`) — the score reads from the recipient's side, which is two different strings.
  - The fixture time is written in **South African time**, not the viewer's: a league night is a local arrangement and should read the way the people playing it would say it.

### Live updates (migration `20261017130000`)
- **The first use of Realtime in the project.** The project board polls on tab focus and the match page inherited that by default; a match is *watched* as well as scored, so a second screen going stale until somebody reloads is not good enough.
- **Two subscriptions, and neither is on `tbl_frames`:**
  - `tbl_matches` UPDATE, filtered to the match — every frame change bumps `card_version`, so this one row already carries an insert, a correction and a removal alike, plus settings and status. One subscription instead of three.
  - `tbl_match_events` INSERT — agreeing a card writes only an event and touches nothing on the match, so it would otherwise be the one thing a second screen never heard about.
- **No DELETE events, on purpose.** Postgres sends only a deleted row's key unless the table keeps a full replica identity, so a filter on `match_id` could never match one — and turning that on would put every deleted frame's contents onto a channel whose name is a match id. Routing deletions through `card_version` avoids both problems.
- **Nothing is merged from the payload.** An event means "something changed", and the page re-reads — the same rule it already follows after its own writes, and the reason the server stays the owner of every derived break side.
- **Realtime is for immediacy, not correctness.** Events are missed while a phone is locked or the socket is down, so the page also re-reads on `visibilitychange` and when the connection returns. That is what makes a missed event harmless, and it is the polling fallback for free.
- **It never redraws under someone's hands.** `busyScoring()` — a break event tapped, a running frame clock, an open overlay or cell menu — holds the change back and offers a *refresh* link instead, because a reload starts a fresh draft and would throw away a half-recorded frame. The banner clears itself once the next save has pulled the change in anyway.
- A change the page caused itself is ignored by comparing `card_version` with what it already holds.
- Access is unchanged: Realtime checks the subscriber can select the row, and all three tables already allow signed-in reads.
- Not yet live: the match list and the nav. Watching an order's status on the business side is the same machinery with a different channel.

### Match settings definitions (`scripts/match-settings.js`)
- **`TDCMatchDef` is the one place a match setting is defined**: labels, the `SETTINGS` array, `DEFAULT_RULES`, and `MAIN_KEYS` (the few asked before a match starts). Both the match page's panel and the create page build their forms from it, so adding a setting is one edit, not two that drift.
- `DEFAULT_RULES` is every key at its quietest, which is what makes a match created without touching anything the simple card. Keep it in step with `private.tdc_check_match_rules`, which refuses a ruleset missing a key or carrying an unknown one.
- `stored: false` marks a setting with nowhere to be kept yet (currently just `referee`). The create page leaves those out rather than offering a control that forgets.
- Each page calls `setSideNames()` to say what its two sides are called — players' names on the match page, the chosen opponent on the create page.
- **Load order matters:** `match-settings.js` before `match.js` and before `match-new.js`.

### Starting a match (`src/matches/new/`, `scripts/match-new.js`)
- Opponent search pinned at the top, then the main settings, then the rest in closed `<details>` groups. Skipping all of it gives the simple card.
- `tdc_create_match` only lets you create a match you are in. Against a walk-in or guest it needs venue staff, because nobody without a login can dispute a result.
- `tdc_search_opponents` searches across all venues and returns accounts only. Walk-ins go through the staff tools.

### The match list (`src/matches/`, `scripts/matches.js`)
- `/matches/` is the way into a match. Without it a match is only reachable by pasting its id into the address bar.
- One call to `tdc_my_matches`, which counts each scoreline from the frames. Counting in the browser would be one request per match to work out two numbers.
- "My matches" is not only the matches you are a side of — in a team match the sides are teams and the people are in frames, so the function looks through `tbl_frame_participants` too.
- The scoreline always puts this player's frames first. Nobody should have to work out which number is theirs.

### The match page (`src/match/`, `scripts/match.js`, `stylesheets/match.css`)
- Two modes from the address: `/match/` shows the built-in mockup (quickest way to work on layout), `/match/?id=<uuid>` reads that match from the database. `loadMatch()` builds exactly the mockup's shape, so nothing else in the file knows where its data came from.
- **Frames and settings both read and save.** The one exception is "Referee", which has no column yet, so the page deliberately doesn't send it.
- Settings go through `tdc_update_match_settings(match_id, rules, first_break_side)` — rules and the lag winner in one call, because both move the whole match. It validates the ruleset whole (all 21 keys, no extras, known enumerated values), re-derives every break side, and puts back any frame the new rules made impossible, returning counts of both.
- **A correction that would invalidate a frame's result asks first** (`resultLostBy()` / `confirmCellChange()`). The result picker only ever offers results that fit who broke, so a frame is valid when recorded; it's a later edit to the break side or break event that can invalidate it. The pop-up names the rule in the way — "a break & finish needs a ball potted on the break" — rather than greying out a button for reasons the user can't see.
- Saving hooks into the only three places that change the card: `pushFrame()`, `setCell()` and `undo()`. Keep it that way — a fourth write path that skips `persistFrame()` would save nothing and look like it worked.
- **After every write the match is read back, not patched locally.** The server owns the derived break side: correcting frame 2 can move who breaks frames 3 onwards, and `tdc_record_frame` re-derives the lot. A failed write reloads too, so the screen never keeps a change the database refused.
- `framePayload()` leaves `break_side` out unless someone set it by hand — omitting it is what tells the function to derive it.
- **Read-only for watchers.** The page asks `tdc_may_edit_match` before drawing any controls, rather than letting someone score a frame and then telling them it was never theirs. The database decides; the rule is not repeated in JavaScript.
  - `WRITE_ACTS` lists every action that changes the card. `mbtn()` and `cell()` both consult it, so a control added later is covered without anyone remembering to. `onClick` checks it again as belt and braces.
  - Settings are shown but disabled — knowing it's a race to 7 is the point.
  - **If the RPC errors the page goes read-only.** A watcher who can't score is a small annoyance; a scorer whose every frame is refused is a ruined night. This means `20261015120000_may_edit_match` must be pushed *before* the site is deployed, or nobody can score.
- **Offline.** A club with bad wifi is the normal case, so the stage keeps working with no connection: frames queue in `localStorage` under `tdc.match.<id>.queue` and go when the connection returns. Settings and corrections to earlier frames lock, because both re-derive or renumber the whole match. Undo still works for a frame that hasn't been sent yet — it drops it from the queue — but not for one already on the server.
  - Before replaying, the queue checks the match's `card_version` against what it was when the queue started. If somebody else scored in the meantime it stops and says so rather than renumbering their frames.
  - `flushQueue()` guards against running twice: browsers raise `online` more than once, and two flushes would send the same frames twice.
  - The nav's offline pip is in `nav.html` / `nav.js` and works on **every** page, firing `tdc:offline` and `tdc:online` window events. Other pages with input should listen for those and lock whatever they can't do — not yet done.
- Known gaps, all deliberate and visible rather than invented: `tables` is `['Table not set']` (no tables table yet), `context.kind` is always `social` (no league layer yet), and a team match refuses to load with an explanation.

## Tournaments (migration `20261019140000`)
- **The governing requirement: a tournament director must be able to run the whole thing alone.** Players entering their own scores is a convenience, not the path. Plenty of entrants never open the app, and a TD at a club night works from a scoresheet on the bar. Everything in this area is shaped by that, and a design that assumes player participation is wrong.
- **An entrant is a player record, which may be a walk-in with no account.** Nobody has to sign up to be in a tournament. This is why entrants key on `player_id` and not `user_id`.
- `tbl_tournaments` — identity, `rules` (the default ruleset matches inherit, validated by the same `private.tdc_check_match_rules` the match page uses, so a tournament cannot hold a ruleset its own matches would refuse), `format` (stored, not yet acted on), status, fee, `max_entrants`. `venue_id` is **nullable on purpose**: anyone may run a tournament, and an approved club gets branding and venue features — the tier falls out of that column being empty or not. `sanctioned` is a column, never a ruleset key.
- `tbl_competition_roles` + `tbl_competition_role_types` — **a lookup table with a rank number, not an enum**, so "outranks" is a comparison rather than a chain of ifs. `tournament_id` is nullable because a league season gets its own column here later, which is also why it is not called `tournament_role`.
- `private.tdc_can_run_tournament` is **the single place deciding who runs a competition**, in the same spirit as `private.tdc_can_edit_match`. Director, or venue staff where the tournament belongs to a venue — because a club night's TD is often whoever is behind the bar, and a club must be able to rescue a tournament whose director went home.
- **Whoever creates a tournament is made its director in the same transaction**, or nobody can change it.
- `tdc_set_seeds` takes the **whole order in one call** and clears anyone not named. A re-seed moves everybody, and half a re-seed is a draw nobody can read.
- `tdc_tournament_entrants` returns names, status, paid and seed together — the TD's entrant list is the screen a tournament is actually run from, and a request per row on a page showing thirty is not a page.
- **Not here, deliberately:** rounds, brackets and progression. Setup captures identity, rules and entrants; none of those depend on the format, and generating the draw is its own step. That separation is what let the setup page exist before any bracket generator does.
- Still to come: the format's draw generator, match-level score entry (a TD-run match may have **no frames at all**, so an entered score is a normal recording path rather than an override), and coordinator approval — see `claude/approval-and-corrections.md`.

### The setup pages (migration `20261019150000`)
- Three pages, following the shape of `/matches/`: the list, the create page, and the entrant list at `/tournaments/manage/?t=<id>`.
- **`tdc_search_entrants` is a second search, not a change to `tdc_search_opponents`.** The opponent search returns players with a login only and leaves the caller out of their own results, which is right for "who am I playing" and wrong twice over for a tournament: entrants are routinely walk-ins, and a TD plays in their own club night. The two questions have different answers, so they are two functions. The new one is gated on `private.tdc_can_run_tournament`, because unlike the opponent search it returns walk-in records — people who never chose to be findable.
- **Seeding is always sent as the whole order.** The seed boxes are read, sorted (unseeded falling to the end in name order), and the result handed to `tdc_set_seeds` as seeds 1..n. Typing a duplicate therefore cannot produce one — the second entrant just sorts next to the first. Randomise is Fisher-Yates, not a `Math.random()` sort, which is not uniform.
- **Withdrawn entrants stay on the list and out of the draw.** They keep their row so the TD can see who pulled out, they are never seeded, and they do not count toward `max_entrants`. Removing is different and asks first: it takes the person out of the record entirely.
- After every write the list is read again rather than patched in the page, as everywhere else in this project — the server owns the ordering.
- Read access and write access differ here: anyone signed in may read an entrant list, only the people running it may change one. The page settles that **before the first render** (a `readOnly` flag every render reads) so the controls are never offered and then taken away. The database refuses the write either way; this is the courtesy, not the guard.
- **Known gaps in these pages:**
  - No venue picker, so `p_venue_id` is always null and every tournament made here is the open tier. A club tournament needs the picker and staff rights at that venue.
  - A walk-in cannot be created *from* the entrant page, but the flow exists and is correct: `tdc_create_walk_in` needs venue staff rights, while `tdc_add_entrant` needs only that you run the tournament and the player exists. So staff-anywhere creates the walk-in at their own venue and then adds them to any tournament they run, venue or not. The only case that cannot is a TD who is staff at no venue at all, and per the verification ladder a level-0 player record *should* only be created by somebody accountable. **Resolved 19 Oct, UV: not a gap.** What is left is walking — `/staff/walk-in/` should accept `?next=` (via the existing `TDC.safeNext`) so creating a walk-in returns to the entrant list.
  - Nothing edits a tournament after creation, though `tdc_update_tournament` exists for it.
  - Entrants are not notified that they have been entered.

### The draw (migration `20261019160000`)
- **Format decision, 19 Oct (UV):** single elimination first. Round robin is more useful for leagues and comes with them. Double elimination follows, and is mostly a second set of source rows rather than a second generator — `loser_of` already exists in the design, and a losers'-bracket match is just a match whose slots are `loser_of` two others. The drop pattern is the real work there, not the schema.
- **`tbl_tournament_fixtures` holds the shape of the draw, not the matches.** The progression design put `home_source_type` / `home_source_ref` on the match; they cannot go there, because `tbl_matches_home_side_is_one_thing` requires a `player` side to carry a `player_id` and a round-of-16 match between two unknown people therefore cannot exist. Relaxing that constraint would weaken a guard protecting every social and league match in order to serve tournaments only. **Decided 19 Oct (UV): a separate table.** A real `tbl_matches` row is created later, when both sides are known — so a bracket is readable and publishable with no matches in existence, which is what a draw sheet on the wall actually is.
- **No winner column, and the reason matters.** A played fixture carries `match_id` and its winner is counted from that match's frames like everybody else's. A bye, a walkover or a withdrawal is an advancement with *nothing to count* — no frames, no match — so those are recorded in `advanced_entrant_id` + `advance_reason`. A check constraint makes the two mutually exclusive, which is what keeps "frames are the only record" true in the presence of byes.
- `bracket` is `main` / `losers` / `third_place` from the start. The losers' bracket is the next format, and a fixture that could not say which bracket it belongs to would need a migration against every row to acquire one.
- **Rounds number up from 1**, so the final is the highest number. Numbering down from the final would renumber every fixture the moment the field changes size.
- `private.tdc_bracket_order` builds the standard draw sheet by reflection: `[1]`, then at each doubling each seed sits next to the one completing the new size. Size 8 comes out `[1,8,4,5,2,7,3,6]`. This is why seeds 1 and 2 can only meet in the final, and why byes land on the top seeds.
- **`tdc_generate_draw` settles the seeding rather than demanding it first.** Entrants are taken in seed order with anybody unseeded falling to the end by name, and those positions are written back as seeds 1..n — so the seeds always describe the draw actually generated, and a TD who never touched seeding still gets a bracket.
- `p_confirmed_only` decides the field: confirmed only, or everybody not withdrawn. **Decided 19 Oct (UV): the TD chooses at draw time**, because the honest answer depends on whether the people who said "interested" turned up.
- `third_place` is a column on `tbl_tournaments`, off by default — a property of the tournament, never a ruleset key. Generated as one fixture fed by `loser_of` both semi-finals, and only where there are two semi-finals to lose.
- **A started draw can still be redrawn or cleared — it just asks first.** *(Changed 19 Oct on UV's instruction: the TD has full control over their own tournament.)* With matches attached, `tdc_generate_draw` and `tdc_clear_draw` refuse once with a message naming how many, and go ahead when passed `p_detach_matches`. Nothing is destroyed in either case: the FK runs from the fixture to the match, so deleting fixtures leaves the played matches intact — they simply stop belonging to a bracket.
- **`progression` on `tbl_tournaments` is `automatic` or `manual`.** Automatic puts a finished match's winner in the slot above; manual moves nobody and the TD places each one. **It governs only whether the system moves people *for* the TD, never whether the TD may move them** — plenty of club tournaments are run loose, with progression adjusted by hand as the night goes, and a bracket that argued with the person running it would just be wrong.
- **`tdc_set_fixture` is that control.** It sets either slot, empties either slot, or awards the fixture to somebody without it being played (walkover, withdrawal, decision). It works on a started draw and in both progression modes. It refuses only what would make a bracket unreadable: an entrant from another tournament, somebody playing themselves, an award to a player who is not in the fixture, an award with no reason, and an award on a fixture that has a match — that one is counted from its frames.
  - **Filling a slot by hand clears its source.** A slot fed by `winner_of` that the TD has filled stops being fed, or the next automatic advance would quietly overwrite them. Emptying a slot leaves it with no source at all, which is the same shape a bye is written in.
- Verified on a throwaway Postgres: the redraw confirmation and every `tdc_set_fixture` refusal, and across field sizes 2 to 33: fixture count is always size−1, byes always size−n and always on the top seeds, and with favourites advancing an 11-player draw still gives semi-finals of 1v4 and 2v3 and a final of 1v2.

### Progression (migration `20261019170000`)
- **`create_matches` on `tbl_tournaments` is `automatic` or `manual`** — the match behind a fixture is made the moment both sides are known, or when the TD says a table is free. *(19 Oct, UV: a feature, not a question.)* Same shape as `progression`: it governs what the system does on its own, never what the TD may do by hand.
- **`private.tdc_fixture_outcome` is the single answer to who won a fixture**, returning winner *and* loser as entrant ids. The loser is returned because `loser_of` feeds both the third-place playoff and the whole losers' bracket, which would otherwise each work it out again.
  - Awarded (bye, walkover, withdrawal, decision) → read off the fixture, since there are no frames to count.
  - Played → the score is counted from `tbl_frames` exactly as `tdc_my_matches` counts it. Never read from a column.
  - It advances nobody when the match is still in progress, or when the card is level: `draws_allowed` is off for knockout play and `tiebreak_method` settles it at the table, so a level finished card means the tiebreak has not been recorded, and the bracket should show that rather than guess.
- **`tdc_resolve_draw` is idempotent and called by the page**, on load and after every write, like every other read in this project. It is deliberately *not* a trigger: a resolver firing from a trigger advances somebody in the middle of a correction, which is the exact moment a TD is trying to stop it. One pass walks rounds in order, so a round-1 win can reach round 3 without three calls.
- **A slot the TD filled by hand is never overwritten.** `tdc_set_fixture` sets its source to `entrant`, and the resolver only fills slots still sourced `winner_of` / `loser_of`. Tested: a TD putting a beaten player into the final keeps them there while the other slot still fills automatically.
- `tdc_create_fixture_match` freezes the tournament's ruleset onto the match the same way `tdc_create_match` does, and is idempotent — called twice it returns the match it already made. The tournament's `sanctioned` flag propagates to its matches: an authorisation fact in both places, never decided again per match.
- `tdc_detach_fixture_match` takes a match off a fixture without deleting it. The match is a real record of frames really played; deleting one is `tdc_delete_match`'s job, asked for explicitly.
- `tdc_tournament_draw` was **dropped and recreated** rather than replaced — it gained columns, and PostgreSQL will not change a function's return type in place. It now also returns the frame score, the match status, the winner, and the card state, so a bracket can show that somebody advanced while their opponent is still disputing the card.
- Verified on a throwaway Postgres by playing whole tournaments: an 8-player bracket round by round to a winner; an 11-player field where all 5 byes advance on the first resolve; manual progression moving nobody; automatic progression with manual creation filling slots but starting nothing; a level card and an in-progress card each advancing nobody; and third place correctly fed by the two semi-final losers.

### The bracket page (migration `20261019180000`)
- `tournaments/bracket/index.html` + `scripts/tournament-bracket.js` + `stylesheets/bracket.css`, at `?t=<tournament id>`. Readable by any signed-in player; the controls appear only for the people running it, settled before the first render.
- **`tdc_update_tournament` was dropped and recreated** to carry `third_place`, `progression` and `create_matches`. Without it the three columns added earlier today had no way to be set and every tournament was stuck on the defaults. An overload was the alternative and is worse: two candidates PostgREST can resolve to, against "one place decides each thing". It also refuses to change `third_place` once a draw exists, because the draw reads it at generation and changing it afterwards would silently do nothing.
- **The draw settings live on this page, not the create page**, because generation is the last moment they mean anything. The empty state is the setup: who goes in (confirmed only or everyone not withdrawn, with a live count of each), progression, match creation, third place — then Generate.
- `tdc_resolve_draw` is called on load and after every write. Calling it on load is why a TD who scored three matches on somebody else's phone opens this page to a bracket that is already up to date.
- **Rounds are columns and the page scrolls sideways.** No connector lines: at phone width they cost more than they explain, and each fixture carries its number (`3-2`) while the next column says "Winner of 2-1", which is the same information in less ink. It prints, because a draw sheet on the wall is still how most of a club night is read.
- An unreached slot says where its player will come from rather than sitting blank — a draw sheet is readable before it is played, and that is most of what it is for.
- The redraw button does not write its own warning. It calls `tdc_generate_draw`, and if the database refuses with the already-started message, **that message is what the person is asked to confirm** — so the warning they read is the real count rather than a guess maintained in two places.
- Rounds are named from the end (Final, Semi-finals, Quarter-finals, then "Round n"), so the naming survives any field size.

### Overrides and officials (migration `20261020100000`)
Built to `claude/approval-and-corrections.md`, which is the design record for all of this.
- **`private.tdc_can_edit_match` now knows competition roles exist.** It never did, so a tournament director who was neither a player in the match nor staff at the venue could not touch their own tournament's matches — principle 8 was false in the database. One extra branch in the one function, per principle 4, joining through `tbl_tournament_fixtures` because a match belongs to a competition through its fixture and not through a column.
- **`tdc_add_competition_role` / `tdc_remove_competition_role` / `tdc_competition_officials`.** Until now the only insert into `tbl_competition_roles` anywhere was the director created inside `tdc_create_tournament`, so referees and scorers could not be appointed at all. Appointing is gated on `tdc_can_run_tournament`, so a scorer (rank 30) cannot appoint anybody — which is what the ranks are for. Removing the only director of a venue-less tournament is refused: nobody would ever be able to run it again.
- **`tbl_match_result_override`** is the design note's table, unchanged: one per match, `reason` mandatory, `counted_home` / `counted_away` recording what the frames said at the time, and `card_version` recording what it was set against.
  - **Reading a score is one branch in one place** — `private.tdc_match_score`: the override if there is one, otherwise count the frames. Everything reads through it.
  - **Only somebody running the competition the match belongs to.** A social match has no coordinator and therefore no override, which is right: nobody's word outranks the two people who played it.
  - **Corrected 20 Oct, migration `20261020110000`:** the original refused an override on a match whose status is `in_progress`. That read the note's open question 5 too literally — `in_progress` does not mean people are at the table, it means frames exist and the card has not been submitted, which is exactly the state a TD-run match sits in. Combined with `tdc_submit_card` accepting only the players in a match, it left a TD able to record frames, unable to submit, and unable to override: a dead end in the main flow. The refusal is gone; the page asks instead, per the house rule of confirm-and-repair rather than block. A reason and coordinator rights are still required.
  - **A later frame edit makes an override stale, never drops it.** A coordinator overriding a score is deliberately overruling the frames, so the page flags it for review. *(Same.)*
  - Clearing it restores the counted score, which a score written onto the match could never do.
- `tdc_fixture_outcome` and `tdc_tournament_draw` both read through `tdc_match_score`, so a TD's score advances the bracket and the draw shows it labelled as set by hand rather than disguised as a result.
- Verified on a throwaway Postgres: a TD who is neither player nor venue staff can edit, a stranger cannot, a referee can edit but can neither appoint nor override; an override beats the frames and advances the bracket from them, keeps what the frames said, goes stale on a card change without being dropped, and is reversible; reasonless, mid-match and non-coordinator overrides are all refused.
- **Known, not yet fixed — a TD cannot finish a card.** `tdc_submit_card` requires `private.tdc_my_player_on_match`, so only a player in the match may submit. In the core case — the TD runs it and neither player uses the app — the TD can record frames but cannot submit, so the match never reaches `complete`. Found by audit on 20 Oct; predates the tournament work but blocks it. The override is the way through for now. The fix belongs with the publishing work below, because who may finish a card and who may publish it are the same question.
- **Not here yet:** coordinator approval itself (`coordinator_approval` and `both` still behave like a dispute window), the role-rank conflict rule on frame writes (a lower rank overwriting a higher rank's frame), any page for officials or overrides, the public read-only view, and double elimination.

### Publishing — the shape UV described, 20 Oct
Not built. Recorded here so it is not re-derived.
- The bracket must advance on **published**, not recorded. It currently advances on `status = 'complete'`, which for a dispute window happens at submission — 48 hours early. Found by audit 20 Oct.
- UV's three cases map onto settings that already exist rather than anything new:

| Case | Settings | Published when |
|---|---|---|
| Player results publish immediately | `approval_mode: none` + `score_entry_mode: players` | On submission; the card locks |
| Only the TD publishes | `approval_mode: coordinator_approval` + `players` | On the TD's approve, or his override-and-publish |
| TD enters everything | `score_entry_mode: td_only` + override | On the override |

- So publishing is `approval_mode` finally meaning what it says, plus an `approved` card event retired by `card_version` like a submission — not a new concept.
- **An override by the TD publishes**, because the TD is the approver; overriding is implicitly approving.
- `score_entry_mode` is validated but **enforced nowhere**. `td_only` currently restricts nothing.
- **Answered 20 Oct (UV), and built — migration `20261020120000`:**
  - **`approval_mode` and `dispute_window_hours` are two independent axes in a competition.** The mode decides *when it publishes* (`none` / `dispute_window` on submission; `coordinator_approval` / `both` on the coordinator's approval). The hours decide *how long a player may object afterwards*. This corrects the design note's guess about `both`, which assumed the coordinator could not approve until the players had settled.
  - **Publishing locks the card. A dispute never reopens it and never un-publishes it** — the objection is recorded and goes to the coordinator, who lets it stand or changes the score.
  - **An override publishes.** The coordinator is the approver; making them press a second button would only produce matches that are overridden and not published.
  - **A coordinator may correct a locked card**, through the lock guard rather than a session flag. Nobody else may.
  - **Publication exists only inside a competition.** A social match has no bracket or standings to publish to, so `dispute_window` keeps exactly the meaning it has today. *This was caught by the social regression suite after a first version published and locked every social `dispute_window` match on submission, leaving the opponent unable to agree or dispute.*
  - `tdc_submit_card` now accepts anyone `tdc_can_edit_match` permits, which closes the audit finding that a TD could record every frame of a match between two walk-ins and then had no way to say the card was done.
  - New: `tdc_approve_card`, `tdc_reject_card` (reason required, for the same reason a dispute needs one), `private.tdc_published_at`, `private.tdc_is_published`, `private.tdc_card_is_locked`, `private.tdc_match_competition`. `tdc_fixture_outcome` advances on **published**, not on `status = 'complete'`.
  - `match.js` gained the `approved` state, the sent-back note and the objection note. Without it an approved card rendered an empty card panel and the page showed the scoring stage, because `settled()` did not know the state existed.
  - The bracket page gained Publish and Send back, offered only where the tournament actually asks for approval, plus a "Waiting on you" badge so an unpublished result does not look identical to a published one.
- **Cascade — answered 20 Oct (UV), not yet built.** With `progression: automatic` a change upstream cascades downstream, with warnings; that is the point of automatic. With `progression: manual` the TD changes each affected match by hand. A downstream match already played with what is now the wrong player is **detached, not deleted** — the frames were really played.


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
