# theDiveClub — backlog

**Someday work**: wanted, not scheduled, not blocking anything today. `docs/STATUS.md` is the agenda; when something here becomes active, **move** it there rather than copying it.

Built from the project doc `claude/stats-todo.md` on 23 Oct 2026, with everything since built taken out (live updates, conflict refusal, match time, coordinator approval, the frame edit log, single-elimination draws, and the whole league structure, lineups and scorecard).

---

## 1. Open questions

| | Question | Why it matters |
|---|---|---|
| E | League fees — entry blocked until paid in full, or partial allowed? | Blocks the fees table |
| F | Travelling leagues — does a league have an owning venue, or its own fee scope? | Blocks entry-fee charging |
| H | Shot clock and extension rules the timer hardware reads | Blocks the hardware integration |

## 2. Build queue

| | What | Size |
|---|---|---|
| 1 | **The dispute-window reminder** — the only notification with no page event behind it. Needs `pg_cron` + `pg_net` or a scheduled Edge Function | Small |
| 2 | **Player profiles.** Somewhere for stats to live; "Play UV" from a profile; a separate sanctioned-only section | Large |
| 3 | **The visualisation** on the match page — placeholder still sitting there. Show `tdc_frame_history` with it (UV, 22 Oct) | Medium |
| 4 | **Credits: split a table** between players at the end of a match | Needs the ledger changes first |
| 5 | **Offline for the other input pages** — the nav pip and `tdc:offline` / `tdc:online` already work everywhere; only the match page acts on them | Small each |
| 6 | ~~Payments~~ **Moved to `docs/STATUS.md` §0 (P4), 31 Oct** | |
| 7 | **An owner finance tracker** — payments, invoices and receipts in the owner tools, with exports for the accountant and financial advisor (UV, 23 Oct) | Medium |
| 8 | **Add to Home Screen** install prompt | Small |

## 3. Database still to build

| | What |
|---|---|
| 1 | `table_id` on `tbl_frames`, a tables table, and `tbl_match_table` (which tables a match is played on) |
| 2 | Ruleset validation in the browser (Zod, versioned, `.strict()`) — belt-and-braces; the server already validates the keys |
| 3 | Credit ledger: `ref_table` / `ref_id`, wider `entry_type`, travelling-league venue scoping |
| 4 | Public read policies on matches and frames, for a live follow page. *The poster solved public reading with a stored snapshot — read `docs/DECISIONS.md` before designing this* |
| 5 | A `referee` column, or drop the setting — marked `stored: false` and deliberately not sent |
| 6 | Team-match notifications — `notify-card` answers "team match" today, because there is no single other player to tell |
| 7 | Platform limits for unverified accounts: cap *active* competitions, rate-limit creation by time, unlisted until verified (`docs/archive/stats-build-changes.md`) |

## 4. Match page — elements still to place

| Group | Items |
|---|---|
| Corrections | Abandon reason; dispute a single frame rather than the whole card |
| The record | Per-frame detail (players, times, table, referee); edit history |
| Match identity | Assigned scorer; match number; venue and scheduled date |
| Stats | Head-to-head; break-and-run %; per-player contribution; extensions used / clock violations; effect on standings or bracket |
| Navigation | League table or bracket; previous/next match; share link to the public follow view; big-screen spectator mode; player profile links |

## 5. Documents to write

| | What |
|---|---|
| 1 | **Rules and scenarios reference.** Every rule, every setting with its options, and the scenarios covered — in plain language. Reused for poster text, league handbooks, in-app help. Write it once the rules stop moving |
| 2 | The rest of `docs/product/` — a director's guide (before the first outside venue), venue setup, a player guide. See `docs/product/README.md` |

## 6. Deferred refinements

| | What |
|---|---|
| 1 | ~~Rotate the top half 180° in portrait so the opponent reads it across the table?~~ **Retired 26 Oct:** the new score input puts the two players side by side in portrait too, so there is no top half (`docs/design/match-score-input.md`) |
| 2 | Should the signed-in player always be the bottom half? |
| 3 | One tap ends a frame and the match. Should sanctioned matches need a confirm or long-press? |
| 4 | A break event mis-tapped starts the frame, and changing it does not undo that (since 26 Oct the pill changes the event but cannot clear it), so the frame's start stays where the mis-tap put it |
| 5 | Changing the race target mid-match can make a match over, but does not auto-submit |
| 6 | "Table not set" and every match showing as social — deliberate placeholders until those layers exist |

## 7. Code tidy-ups from the 23 Oct audit (low priority)

| | What |
|---|---|
| 1 | Split `match.js` and `tournament-bracket.js` into ES modules: `api.js`, `rules.js` (pure, testable), `state.js`, `render/`, `main.js`. Move the helpers copied into 9–22 files (`el`, `node`, `when`, avatar URLs) into `src/scripts/lib/` |
| 2 | Keyboard focus: the match cell menu and settings panel should move focus in and back; the profile dropdown and hamburger should close on Escape and set `aria-expanded` |
| 3 | `showNotice()` in `match.js` takes an HTML string — safe today, make it build nodes |
| 4 | `auth.js` logs the whole sign-up response; `push.js` uses top-level globals and ships a test-notification button |
| 5 | Four `private` helpers without `set search_path` (`tdc_bracket_order`, `tdc_required_score_rank`, `tdc_editor_role`, `tdc_poster_rules`) |
| 6 | Row locks for two small races: `max_entrants` on tournament entry, and the last captain on a team |
| 7 | Dead statement in `tdc_set_league_entrants_status` (a `uuid[]` into a `uuid`) |
| 8 | Edge functions: return generic errors, commit a `deno.lock`, add an explicit `[functions.notify-push]` entry in `config.toml` |
| 9 | Deploy workflow: build job `contents: read` only; pin actions to commit SHAs |
| 10 | Manifest: proper maskable icons and an `id`; run SVGO on the 60 KB logo |

## 8. Older leftovers

| | What |
|---|---|
| 1 | **Audit log for staff actions** — who linked, verified or revoked what |
| 2 | Emails not yet seen live: change email (both addresses), reauthentication code, sign-in method linked/removed |
| 3 | Slim down the email images (GIF ~456 KB, wordmark ~143 KB) — and they are pre-branding-refresh |
| 4 | The `thediveclub.org` TXT record has the doubled-domain problem and isn't visible to Google — sort out during SEO work |
| 5 | Phone login — probably dropped in favour of SA ID verification, not decided |
| 6 | Consider encrypting SA ID numbers at rest (Vault or pgsodium), keeping a hashed copy for lookups |
