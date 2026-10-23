# theDiveClub — status

**The one live list.** What is being built, what is next, what is blocked, and what is waiting on UV. If an outstanding item is tracked anywhere else, that other place is wrong — bring it here and delete it there.

Updated at every milestone, in the same breath as giving UV a commit subject. Never batched to the end of a session.

Last updated: **23 Oct 2026** (late night: test leagues cleared; name down no longer confirms)

**Database is current through `20261023190825`** (checked against production's migration list, 23 Oct). **Waiting to push: `20261023193153`** (league settings, ruleset version 3) **and `20261023201147`** (putting your name down no longer confirms you). **Push both before deploying the site**: the site now makes every new match, tournament and league at ruleset version 3, which the live database refuses until the first is in.

---

## 1. Waiting on UV

Nothing here can be done by Claude.

| | What | Why it matters |
|---|---|---|
| 0a | **Try the league settings page** | After pushing `20261023193153` and deploying: open Test_WedSim_8BMTL → Settings (TestTuesday and Test 8BMTL were cleared on 23 Oct). Set team size 5, look at the rotation grid, change one cell in session 2 and watch it swap, save. The message should say **2 matches now use these rules** (neither has started) and none kept. To see the card follow it, try team size 4 once: a match's card should then offer 16 slots, not 25. Set it back to 5 afterwards |
| 0b | **Play a singles match straight after pushing** | `20261022230000` and `20261023090000` both patch **`tdc_record_frame`**, which every match goes through, plus `tdc_submit_card`, `tdc_answer_card` and `private.tdc_card_state`. All changes are additive and covered by new tests — including that a singles card still settles on submission when no approval is wanted, and still waits for an answer when it is — but the original match suites from 15–21 Oct did not survive their container, so a real singles match is the only end-to-end check there is |
| 0c | **Retest Name Down → In the League** | After pushing `20261023201147` and deploying: re-run `supabase/seed/dummy-league-players.sql`, which puts the 19 dummies back on Name Down, unconfirmed (Test_WedSim_8BMTL, cleared and recreated 23 Oct). Move them in: they should show **Has not confirmed**. That league confirms on payment, so tick paid on one and it should confirm. Your own entry is untouched |
| 0d | **Try the league pages on a phone** | Steps 2 and 3 are pushed and were proven only on a throwaway Postgres driven by headless Chromium. At `/leagues/`: create a league, add a second account, make two teams, confirm as both, generate the fixtures, start a match |
| 1 | **Play through sections 8, 11, 12, 13 and 14 of the test plan** | Several builds are proven only against a scratch database. The logic is verified; a real league night is not |
| 1b | **Try the bracket editor on a real draw** | Insert a prelim, add a match to it, click an arrow to rewire, remove a match. Proven against a scratch database and rendered in headless Chromium; never driven by a person. **Check a tournament with a third-place playoff in particular** — it was broken from 22 Oct until this build and nobody hit it |
| 2 | **Retest the walk-in merge via `/staff/link/`** | The one thing left that could lose real data. Changed again on 21 Oct by the merge fix, so earlier testing no longer counts |
| 3 | **Enable the signup bot check** (Turnstile or hCaptcha) | Self-entry currently rests on a confirmed email address alone. The bot check is the other half of "a verified account" |
| 4 | **Set the black-alpha values** for the refreshed branding | UV sets them himself on `/sandbox/` (palette Depth strengths and the logo controls) and saves them into `variables.css` (22 Oct). Done once he has saved and committed them |

---

## 1a. From the 23 Oct audit

Found in a read-only review of every migration, the front end, the edge functions and the build. **Each was checked against the latest code.** The full write-up is the "project-wide audit" doc in the claude.ai project.

### Fix before the next real league or tournament night

| | Where | What happens | Fix |
|---|---|---|---|
| A1 | `tdc_delete_match` (last changed `20261015200000`) | Any player in a tournament or league match can delete it, even after approval, unless it is sanctioned — and nothing is sanctioned today. Frames go; the fixture loses its match | Refuse unless the caller runs that tournament or league |
| A2 | `tdc_update_match_settings` (`20261015180000`) | Refuses an *agreed* card but not an *approved* one, so a player can change a competition match's rules (e.g. approval off), which reopens the card | Competition matches: directors only, and never after approval |
| A3 | `tdc_set_match_time` | Same gap — players can move a competition match, which also moves the lineup cutoff | Same guard as A2 |
| A4 | `tdc_record_frame`, team matches | Players named in a frame are not checked against the teams' rosters, and being in a frame grants edit rights | Check each player is an active entrant of that side |
| A5 | `private.tdc_merge_players` | Misses `tbl_league_match_squad`, `tbl_league_match_order` and `tbl_notification_prefs`; a merge empties lineups | Add them; run the migration's foreign-key query |
| A8 | Reopening | UV, 23 Oct (`docs/DECISIONS.md`): **a settled card is final for players**; only a TD/LD can open it again. Today either player can reopen a settled social card, and a player's reopen of a published tournament card half-works (says in progress, stays locked). *Send back now unlocks — done with A7* | **Written and tested: `20261023190825` plus `match.js`, waiting for UV to push and deploy.** Reopen is withdraw-only; the button is gone; test plan 7.5 / 11.3 / 11.5 updated |

### Before more real players join

| | What | Notes |
|---|---|---|
| B1 | **Privacy policy and terms** | Stubs today while the site stores SA ID numbers. Written or checked by a person, not Claude alone. Register an Information Officer with the Information Regulator |
| B2 | **Direct reads of personal data** | `tbl_tournament_entrants` (paid, notes — §6) and `tbl_players` (every player's first and last name, including names staff typed from ID documents) are readable by any signed-in user. Director notes on tournaments, leagues and fixtures, and dispute notes, likewise. Revoke the direct reads; read through functions |
| B3 | **Sign-in redirect** | `TDC.safeNext` lets `?next=/\evil.example` through, which sends a user off-site after sign-in. Notification links share the gap in their check constraint. Compare origins with `new URL(next, location.origin)` |
| B4 | `tdc_staff_link_account` | Staff at any venue can attach any walk-in to any account, with no consent and no venue link. Owner/admin only, walk-in tied to that venue, user confirms |
| B5 | `tdc_add_my_identifier` | Reveals whether an SA ID, phone or email belongs to someone else. Generic message and a rate limit |
| B6 | `tdc_remove_entrant` | Hard delete blanks decided bracket history. Refuse once they have played; mark withdrawn |
| B7 | `notify-card` | A match player can repeat a notification, or send one that doesn't match the card. Check the event exists; ignore repeats within a few minutes |
| B8 | Leagues and `score_entry_mode` | The competition lookup only knows tournaments, so a league's score-entry mode, rank protection and publishing don't apply. Extend it, or record that leagues don't use them |
| B9 | **Account deletion** | Decide the flow (POPIA). Also see §6 on deleting an account leaving a league player behind |

### Before public launch

| | What |
|---|---|
| C1 | **Backups and one test restore** — UV, 23 Oct: once functionality is complete and the site is ready for public use |
| C2 | A "local only — never `config push`" warning at the top of `supabase/config.toml` (it holds `127.0.0.1`, 6-character passwords, confirmations off) |
| C3 | A Content Security Policy meta tag in `layout.html`; move the inline service-worker registration into a script file |
| C4 | Real `404.html`, `robots.txt` (hide `/staff/` and `/sandbox/`) and `sitemap.xml` — all empty today |
| C5 | Service worker: cache scripts and styles so an offline reload of `/match/` keeps the offline queue; stop caching error pages |
| C6 | Define what the platform is for, and what "free" covers, **before involving other clubs** (UV, 23 Oct) |
| C7 | The director's guide, `docs/product/running-a-tournament.md`, before the first outside venue |

Lower-priority audit items are in `docs/BACKLOG.md` §7.

---

## 2. In progress

| Area | Chat | State |
|---|---|---|
| Leagues | Leagues | **All six steps built and pushed.** A league night is playable end to end: fixtures → start the match → both captains lock a lineup → frames appear → results on the grid → both sign. Structure, pages, fixtures, ruleset v2, lineups, submission, entry. See `docs/systems/leagues.md`. **The LD settings page is built (23 Oct, waiting to push).** **Two bodies of work remain**, in this order: the **session rework** (§3 item 0 — the order is per position, not per frame, settled 23 Oct) and **LD-configurable standings** (`docs/design/leagues.md` §6, token-array equations) |

---

## 3. Next up

In the order it probably makes sense.

| | What | Notes |
|---|---|---|
| 00 | **Put the tests in the repo** | **The harness is done (23 Oct):** Docker Desktop and a local Supabase that the fingerprint shows is identical to production, `supabase/roles.sql` for the two dashboard-made differences, the helpers, and `npx supabase test db` as the one command. See `docs/systems/tests.md`. **Still to do:** rebuild the scratch-database checks (468 by 23 Oct, all lost) as pgTAP files, one area at a time: matches and the card first (what A1–A4 touch), then the merge (A5), tournaments, leagues, notifications, identity and credits |
| 0 | **Leagues: the order is one per position, not one per frame** | **Next.** Settled 23 Oct, designed in `docs/design/leagues.md` §3. A captain names the first session only; the rest of the night derives from it by the LD's rotation table — **`team_size` and `rotation` now exist** (ruleset v3, `20261023193153`), and `private.tdc_rotation_away(rules, session, home)` already answers who meets whom. Reserves fill a position for one session under three rules. Changes `tbl_league_match_order` to one row per position; **the five live rows are kept** (they are session 1, positions 1–5), with a guard that stops the migration if anything was locked or played meanwhile. **UV kept testing on his phone after 23 Oct, so re-run the production check first** (order rows, locked sides, frames per league match). Both leagues are test leagues: if anything was locked or played, ask UV whether to clear that match's order instead. A league with `team_size` 0 needs an answer here: probably the old per-slot order, but ask UV |
| 0c | **The LD schedule page** | UV, 23 Oct: weeks (date and time, assumed from the generate settings), venue, tables, home/away. Open questions to put to him: is the venue per fixture or the home team's? how are tables identified? is a manual home/away swap wanted? |
| 1 | **Leagues: standings** | The table a league is for. LD-configurable columns built from a **token array, never a string** — the design is explicit about that and lists the tokens. Designed in `docs/design/leagues.md` §6 |
| 1b | **A player's own frame on `/match/`** | The design's second surface: a player opens the match page and sees only their own frame. `/match/` still refuses a team match, so today a player's frame is entered by their captain on the card. Nothing is blocked by this — it is the convenience half of "two surfaces, one record" |
| 2 | **UV to play through the bracket editor** | Built and render-checked, not yet used on a real draw. See §1 |

---

## 3a. UI work

| What | Notes |
|---|---|
| **A player cannot start their own match** | With `create_matches: manual` a player sees their fixture, has no way in, and no explanation. **UV, 22 Oct: a communication problem, to be solved when the rounds are drawn properly with progression arrows** — not a schema gap. The TD already gets a hint |

---

## 4. Wanted, not built

Agreed in principle, nothing written.

| What | Notes |
|---|---|
| **Close a tournament to specific players** | UV, 21 Oct: restricted to a named set, e.g. everyone in a given league. Probably a fourth `entry_mode` value plus an eligibility table, not a separate flag. Interacts with the poster: a restricted tournament may still want a public poster that says "members only" |
| **A live public scoreboard** | Explicitly *not* what the poster is. Needs an `anon` read of live data and therefore the per-function audit the poster design deliberately avoids. Decide on its own merits, do not grow the poster into it |
| **`player_facing` on `TDCMatchDef`** | **Corrected 22 Oct — this does less than it used to say here.** The flag would let the *pages* agree on which settings are player-facing, which is worth having. It would **not** remove `private.tdc_poster_rules`: that runs in SQL, cannot read the JS, and decides what becomes publicly readable, so it has to keep its own list. The real fix for the drift is a check that the two lists agree, not a shared one. Scope it as two jobs, not one |
| **Entry fee charging** | **Blocked** on the credit ledger's `ref_table` / `ref_id`, undecided for travelling leagues |
| **Double elimination, round robin, groups** | Only single elimination generates a draw today |
| **A screen for `tdc_frame_history`** | The audit log is written and queryable with nothing displaying it. **UV, 22 Oct: do it with the match visualisation**, not on its own |
| **Public follow view** | Watch a tournament without being in it |
| **Venue picker on tournament creation** | `p_venue_id` is always null today, so every tournament made in the app is the open tier. A club tournament needs the picker and staff rights at that venue |
| **Real content for 404, privacy policy, terms** | Stubs of 42–49 bytes |

---

## 5. Decisions needed from UV

Work is blocked or will be built wrong without these.

| Question | Why it is not Claude's call |
|---|---|
| Does a coordinator's rejection need a reason? | A dispute does. A rejection currently requires one in the function; confirm that is wanted |
| What does the coordinator's approval queue screen look like? | No design yet |
| Should an unpublished result be marked as pending in a player's own view? | Affects the match page and the match list |
| Travelling leagues: does a league have an owning venue, or its own fee scope? | Blocks entry fee charging |
| Shot clock and extension rules the timer hardware reads | Hardware is not specified |
| **A match started after its lineup cutoff** | Found 23 Oct. Round 1 was generated for 19:30 that day; the LD started it at 22:25 with an 8-hour cutoff (11:30), and opening the card locked both sides "by cutoff" with nothing in, so nobody could set a lineup. Should starting a match past its cutoff refuse, warn, or not apply the cutoff until the LD moves it? And should generating refuse a first round already in the past? |
| **Where the leagues list sends the LD** | Found 23 Oct. Signed in as Owner@TDC (runs the league, does not play), opening the league from the search results gave the join page's "Fancy a game? Put my name down". Correct from the data, but the LD probably wants the season or manage page |
| **In a league that confirms on payment, may a player confirm themselves?** | Found 23 Oct with `20261023201147`. The paid tick confirms, but `tdc_confirm_league_entry` still lets any player who is in the league press "I'm playing" before paying, and the season page offers the button. UV's rule ("not confirmed until the LD says so, as set in the settings") suggests it should refuse an unpaid player there. It affects players added by hand too, so it is not Claude's call |
| Captains inviting players to their team | UV, 22 Oct: common practice in existing leagues; to be discussed later. For now the director adds players (mid-season too) and a captain claims them — since 23 Oct without waiting for them to confirm |

---

## 6. Known gaps and rough edges

Real, small, and none of them blocking.

| | Area |
|---|---|
| **`tbl_tournament_entrants` can be read directly by any signed-in player** | `paid_at` and the TD's `notes` come back from the API with no function in the way. The 21 Oct gate on `tdc_tournament_entrants` closed the function, not the table: the `select … using (true)` policy and grant are still there. Found 22 Oct while building the league equivalent. The fix is a migration revoking the grant and dropping the policy, after checking no page selects from the table directly. Now item B2 in §1a |
| League pages not built yet | Per-season rule overrides, continuing a team from an earlier season, a venue picker. None blocks lineups. **When per-season overrides get a form, `tdc_update_league_season` must call `private.tdc_refreeze_league_matches`** as `tdc_update_league` does (23 Oct), or a season's change will not reach its unstarted matches |
| `strict_frame_order` is obeyed by the card only | The scorecard offers only the next unplayed frame when it is on. `/match/` does not know about it, which does not matter while `/match/` refuses team matches |
| **Deleting an account leaves an accountless league player** | `tbl_players.user_id` is `ON DELETE SET NULL`, so removing an auth user leaves the player row behind — still on any league's list, which is the one thing a league player may not be. The trigger that enforces it is insert-only on purpose (the walk-in merge needs that). Found 23 Oct while writing the dummy-player cleanup. Unlikely but real; the fix is either a cascade or a nightly check |
| **The 23 version 1 ruleset keys are not type-checked** | `private.tdc_check_match_rules` checks that the keys are present and that the enumerated values are known, but never that `win_condition_target` is a number or `draws_allowed` a boolean. The two version 2 keys added 22 Oct are checked; the older ones are a job of their own. The design note calls this jsonb quietly becoming an unvalidated config format the heaviest standing risk in the system |
| **Nothing tells the players the fixtures are out** | Generating notifies nobody on purpose (`docs/DECISIONS.md`): a fresh schedule is the director's working document and regenerating it is ordinary. Telling them should be a separate act, as sharing a tournament poster is. Not built |
| The team card records a winner, not how they won | `/leagues/card/` enters winner-only. Break detail, break & finish and the rest are on `/match/`, which refuses a team match — so on a league night those are unreachable. Fine for a club night; a nationals night that tracks breaks would want them |
| `tdc_remove_league_entrant` removes anyone | Fine while there are no fixtures. Once there are, it should refuse for a player who has played — as `tdc_remove_entrant` should have |
| Settings writes are still last-write-wins | Frames are guarded, settings are not |
| The match list and nav are not live | Everything else is |
| A future fixture does not read as upcoming in the match list | |
| `referee` is marked `stored: false` with no column | It lives only on the screen it is typed on |
| PWA icons are still the old silver artwork | `src/resources/icons/*` |
| Email assets are pre-refresh | `email-wordmark.png`, `email-dive.gif` |
| Duplicate light/dark SVGs are byte-identical | `logo-mark-*`, `logo-primary-*`. One of each is redundant, or one was never made |
| `hero.jpg` and `social-share.jpg` are 0 bytes | Referenced, empty |

---

## 7. How this document is kept

- **One list, not several.** Before adding an outstanding item anywhere else, add it here instead.
- **Date anything that could go stale.** A line without a date is read as current.
- **Move, do not copy.** An item that is done comes out of this document; if the reasoning is worth keeping it goes to `docs/DECISIONS.md`, and if it is a built system it goes to its file in `docs/systems/`.
- **This file is the agenda. `docs/systems/` is the record. `docs/DECISIONS.md` is the why.** `CLAUDE.md` is the short index that points at all of them.
- **The long backlog is `docs/BACKLOG.md`** — someday work, the schema still to come, deferred refinements. The split: if it is active, blocked, or waiting on UV it belongs here; if it is someday, it belongs there. When something there becomes active, **move** it here rather than copying it.
- **Business to-dos** (the club, not the code) live on the owner board at `/staff/board/`, not here.
