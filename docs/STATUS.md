# theDiveClub — status

**The one live list.** What is being built, what is next, what is blocked, and what is waiting on UV. If an outstanding item is tracked anywhere else, that other place is wrong — bring it here and delete it there.

Updated at every milestone, in the same breath as giving UV a commit subject. Never batched to the end of a session.

Last updated: **22 Oct 2026**

**Database is current through `20261022190000`** (leagues step 1 and its confirmation corrections, pushed 22 Oct), verified against `supabase_migrations.schema_migrations`. **`20261022200000_league_page_reads.sql` is written and tested but not pushed** (§1), and the four league pages are written but not committed.

---

## 1. Waiting on UV

Nothing here can be done by Claude.

| | What | Why it matters |
|---|---|---|
| 0 | **Push `20261022200000_league_page_reads.sql`, then try the league pages** | Leagues step 2. `npx supabase db push --dry-run`, then `db push`; the pages call two functions that exist only after it. Then at `/leagues/`: create a league, add yourself and a second account, make a team, confirm as the player, claim as the captain. Proven only on a throwaway Postgres driven by headless Chromium, not by a person on a phone |
| 1 | **Play through sections 8, 11, 12 and 13 of the test plan** | Several builds are proven only against a scratch database. The logic is verified; a real league night is not |
| 1b | **Try the bracket editor on a real draw** | Insert a prelim, add a match to it, click an arrow to rewire, remove a match. Proven against a scratch database and rendered in headless Chromium; never driven by a person. **Check a tournament with a third-place playoff in particular** — it was broken from 22 Oct until this build and nobody hit it |
| 2 | **Retest the walk-in merge via `/staff/link/`** | The one thing left that could lose real data. Changed again on 21 Oct by the merge fix, so earlier testing no longer counts |
| 3 | **Enable the signup bot check** (Turnstile or hCaptcha) | Self-entry currently rests on a confirmed email address alone. The bot check is the other half of "a verified account" |
| 4 | **Set the black-alpha values** for the refreshed branding | UV sets them himself on `/sandbox/` (palette Depth strengths and the logo controls) and saves them into `variables.css` (22 Oct). Done once he has saved and committed them |

---

## 2. In progress

| Area | Chat | State |
|---|---|---|
| Leagues | Leagues | **Steps 1 and 2 of 6 built.** Step 1 and its corrections (walk-ins refused, player confirmation, captains control teams) are pushed; step 2, the pages, is written and its migration (`200000`) not pushed. Structure: leagues, seasons, teams, entrants, officials; matches get their team keys; the merge fixed. See `CLAUDE.md` → Leagues. Remaining, in order: (3) round-robin fixtures and the team match (refuses unless the season is ready: every active player confirmed); (4) the three ruleset keys and lineups, with frames created at lock; (5) per-side submission and reconciliation; (6) the captain's scorecard page; then LD-configurable standings |

---

## 3. Next up

In the order it probably makes sense.

| | What | Notes |
|---|---|---|
| 1 | **Leagues, step 3: fixtures** | See §2. Round-robin fixtures and the team match. Designed in `docs/design/leagues.md`; the structure and the pages are built. **Must refuse unless `tdc_league_season_readiness` says ready.** Nothing to re-decide; the open items in §8 of that doc do not block it |
| 2 | **UV to play through the bracket editor** | Built and render-checked, not yet used on a real draw. See §1 |

---

## 3a. Left to the UI chat

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
| Captains inviting players to their team | UV, 22 Oct: common practice in existing leagues; to be discussed later. For now the director adds players (mid-season too) and a captain claims them once they have confirmed |

---

## 6. Known gaps and rough edges

Real, small, and none of them blocking.

| | Area |
|---|---|
| **`tbl_tournament_entrants` can be read directly by any signed-in player** | `paid_at` and the TD's `notes` come back from the API with no function in the way. The 21 Oct gate on `tdc_tournament_entrants` closed the function, not the table: the `select … using (true)` policy and grant are still there. Found 22 Oct while building the league equivalent. The fix is a migration revoking the grant and dropping the policy, after checking no page selects from the table directly. Tournaments chat's area; not changed from the leagues chat |
| League pages not built yet | Per-season rule overrides, continuing a team from an earlier season, a venue picker, and a page to edit a league's own rules (`tdc_update_league` has no form). None blocks fixtures |
| `tdc_remove_league_entrant` removes anyone | Fine while there are no fixtures. Once there are, it should refuse for a player who has played — as `tdc_remove_entrant` should have |
| Settings writes are still last-write-wins | Frames are guarded, settings are not |
| The match list and nav are not live | Everything else is |
| A future fixture does not read as upcoming in the match list | |
| No audit log for staff linking walk-ins | Frames have one; this does not |
| `referee` is marked `stored: false` with no column | It lives only on the screen it is typed on |
| PWA icons are still the old silver artwork | `src/resources/icons/*` |
| Email assets are pre-refresh | `email-wordmark.png`, `email-dive.gif` |
| Duplicate light/dark SVGs are byte-identical | `logo-mark-*`, `logo-primary-*`. One of each is redundant, or one was never made |
| `hero.jpg` and `social-share.jpg` are 0 bytes | Referenced, empty |

---

## 7. How this document is kept

- **One list, not several.** Before adding an outstanding item anywhere else, add it here instead.
- **Date anything that could go stale.** A line without a date is read as current.
- **Move, do not copy.** An item that is done comes out of this document; if the reasoning is worth keeping it goes to `docs/DECISIONS.md`, and if it is a built system it goes to `CLAUDE.md`.
- **Re-stage before every edit, and know which branch the repo is on.** This file is written by both chats and by several steps of one session. A copy staged ten minutes ago is already stale, and committing it silently reverts whatever landed in between — which happened twice on 22 Oct, both times putting a finished item back on the list. A delivery into a working tree mid-branch-switch also caused an autostash conflict the same day; ask before writing if the last message was not a plain "done".
- **This file is the agenda. `CLAUDE.md` is the record. `docs/DECISIONS.md` is the why.** Three files, three jobs, no overlap.
- **The long backlog is `claude/stats-todo.md`** in the project — someday work, the schema still to come, deferred refinements. The split: if it is active, blocked, or waiting on UV it belongs here; if it is someday, it belongs there. When something there becomes active, **move** it here rather than copying it.
