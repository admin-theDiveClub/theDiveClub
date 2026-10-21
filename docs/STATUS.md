# theDiveClub — status

**The one live list.** What is being built, what is next, what is blocked, and what is waiting on UV. If an outstanding item is tracked anywhere else, that other place is wrong — bring it here and delete it there.

Updated at every milestone, in the same breath as giving UV a commit subject. Never batched to the end of a session.

Last updated: **21 Oct 2026**

**Database is current.** All migrations through `20261021170000` are applied to `thediveclub-prod`, verified 21 Oct against `supabase_migrations.schema_migrations` and by checking the function bodies — not taken on trust.

---

## 1. Waiting on UV

Nothing here can be done by Claude.

| | What | Why it matters |
|---|---|---|
| 1 | **Play through sections 8, 11, 12 and 13 of the test plan** | Several builds are proven only against a scratch database. The logic is verified; a real league night is not |
| 2 | **Retest the walk-in merge via `/staff/link/`** | The one thing left that could lose real data. Changed again on 21 Oct by the merge fix, so earlier testing no longer counts |
| 3 | **Enable the signup bot check** (Turnstile or hCaptcha) | Self-entry currently rests on a confirmed email address alone. The bot check is the other half of "a verified account" |
| 4 | **Hand over the exact black-alpha values** for the refreshed branding | The UI chat will otherwise guess, and guessing at brand colour is worse than waiting. UV, 21 Oct: agreed, not yet supplied |

---

## 2. In progress

| Area | Chat | State |
|---|---|---|
| — | — | Nothing mid-flight. The tournament track reached a natural stopping point on 21 Oct |

---

## 3. Next up

In the order it probably makes sense.

| | What | Notes |
|---|---|---|
| 1 | **Notifications** | Nobody is told they have been entered in a tournament, confirmed, or that someone else changed a frame on their card. UV wants to discuss the shape before anything is built |
| 2 | **A player cannot start their own match** | With `create_matches: manual` a player sees their fixture, has no way in, and no explanation. The TD now gets a hint; the player gets nothing |
| 3 | **Per-round match settings** | **Needs discussion.** See §5 |
| 4 | **Adding rounds and matches mid-tournament** | **Needs discussion.** See §5 |
| 5 | **A screen for `tdc_frame_history`** | The audit log is written and queryable, and nothing displays it |
| 6 | **Hardening migration for the `private` schema** | 14 `private.tdc_*` functions have no `revoke … from public`. Not a live hole — `anon` has no `usage` on the schema — but one `grant` away from being one |

---

## 4. Wanted, not built

Agreed in principle, nothing written.

| What | Notes |
|---|---|
| **Close a tournament to specific players** | UV, 21 Oct: restricted to a named set, e.g. everyone in a given league. Probably a fourth `entry_mode` value plus an eligibility table, not a separate flag. Interacts with the poster: a restricted tournament may still want a public poster that says "members only" |
| **A live public scoreboard** | Explicitly *not* what the poster is. Needs an `anon` read of live data and therefore the per-function audit the poster design deliberately avoids. Decide on its own merits, do not grow the poster into it |
| **`player_facing` on `TDCMatchDef`** | The setup page, the round settings box, the override dropdown and the poster text should all render from one definition. Until the flag exists, `private.tdc_poster_rules` holds a hand-kept copy — two places that can drift |
| **Entry fee charging** | **Blocked** on the credit ledger's `ref_table` / `ref_id`, undecided for travelling leagues |
| **Double elimination, round robin, groups** | Only single elimination generates a draw today |
| **Public follow view** | Watch a tournament without being in it |
| **Venue picker on tournament creation** | `p_venue_id` is always null today, so every tournament made in the app is the open tier. A club tournament needs the picker and staff rights at that venue |
| **Real content for 404, privacy policy, terms** | Stubs of 42–49 bytes |

---

## 5. Decisions needed from UV

Work is blocked or will be built wrong without these.

| Question | Why it is not Claude's call |
|---|---|
| **Per-round match settings** — what happens to matches in a round that have already started when the round's ruleset changes? | A match freezes its ruleset at creation *on purpose*, so a later change cannot rescore played frames. Changing a round's settings therefore has to say what happens to matches already under way, and whether a round becomes a real row |
| **Adding rounds and matches mid-tournament** — pre-sized bracket with empty slots, or genuinely insert fixtures and rewire everything downstream? | Fixtures are generated as a complete shape and nothing adds to them afterwards. The second option is where byes, seeding and the cascade all meet |
| **Notifications** — what gets sent, to whom, and on what | UV asked to discuss before anything is built |
| Does a coordinator's rejection need a reason? | A dispute does. A rejection currently requires one in the function; confirm that is wanted |
| What does the coordinator's approval queue screen look like? | No design yet |
| Should an unpublished result be marked as pending in a player's own view? | Affects the match page and the match list |
| Travelling leagues: does a league have an owning venue, or its own fee scope? | Blocks entry fee charging |
| Shot clock and extension rules the timer hardware reads | Hardware is not specified |

---

## 6. Known gaps and rough edges

Real, small, and none of them blocking.

| | Area |
|---|---|
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
- **This file is the agenda. `CLAUDE.md` is the record. `docs/DECISIONS.md` is the why.** Three files, three jobs, no overlap.
- **The long backlog is `claude/stats-todo.md`** in the project — someday work, the schema still to come, deferred refinements. The split: if it is active, blocked, or waiting on UV it belongs here; if it is someday, it belongs there. When something there becomes active, **move** it here rather than copying it.
