> **Archived 23 Oct 2026.** Moved word for word from the project doc `claude/stats-schema-design.md`. This is the 7–13 Oct design record that matches, tournaments and leagues were built from. What was built, and how it differs, is in `docs/systems/`. **The league parts are superseded by `docs/design/leagues.md`.** Kept for the reasoning — in particular the verification ladder, sanctioning, anti-abuse and ruleset-discipline sections, which are not yet built.

# Cue sports stats schema — design state

Sessions of 7, 10 & 13 Oct 2026. Working bottom-up: frame → match → league/tournament. Schema not built yet; the match page mockup is built (see "Build state").

---

## Governing principles

1. **Frames are the only truth.** No cached scores, no denormalised totals. Standings and stats compute on demand. At 16 teams × 25 frames ≈ 3,000 rows a season, aggregation is trivially fast and cached totals only create drift bugs.
2. **Variance goes in config, not columns.** Cue sports rules vary enormously between disciplines and leagues. Rules live in a jsonb ruleset; the schema stays stable.
3. **Shape vs interpretation.** If a setting changes how rows relate to each other, it's a column. If it only changes how they're scored, it's config.
4. **Freeze the ruleset onto the match at creation.** A mid-season rule change must not retroactively rescore old frames.
5. **One match page.** Leagues, tournaments and social matches are not separate templates — the same page reads different settings. Team *captain* surfaces are management around the match, not a second scorecard.
6. Follow existing conventions: `tbl_` table prefix, `tdc_` RPC prefix, venue scoping, RLS, writes via security-definer functions, versioned SQL migrations via Supabase CLI.

---

## Frame level

**`tbl_frame`**
- id, match_id, lineup_slot
- table_id, referee_player_id (nullable)
- home_entity_id, away_entity_id
- break_side (derived — see below), break_side_manual (bool), break_player_id, break_outcome
- winner_side (nullable), result_event (nullable)
- status: `not_started` / `in_progress` / `complete` / `abandoned`
- rack_started_at, started_at, ended_at, paused_seconds
- clicker_log (jsonb, nullable)

**break_outcome** — `dry` / `in` / `scratch` / `foul`. Four buttons as presented to the ref. Scratch is specifically the cue ball pocketed; foul is everything else (white off the table, time foul, insufficient balls across the line). No ball counts — not viable for a ref mid-match, and that's an external scorer's job.

**result_event** — `win` / `break_and_finish` / `reverse_break_and_finish` / `golden_break` / `default`.

Check constraints (enforced in DB, not just UI, since the timer system and future scorer apps also write):
- `break_and_finish` and `golden_break` → break_outcome = `in` AND winner_side = break_side *(unless `break_finish_requires_breaker` is false)*
- `reverse_break_and_finish` → winner_side ≠ break_side
- status `complete` → winner_side and result_event both present

### break_side is derived, not entered

`lag_winner` lives **on the match** as `first_break_side`: lag once at the start to decide who breaks frame 1, then `break_determination` governs the rest.

A frame's breaker is a function of (first_break_side + break_determination + results so far):
- `alternate` — frame i gets first breaker when i is even, the other when odd
- `winner_breaks` / `loser_breaks` — from the previous frame's winner
- `first_breaks` — lag winner breaks every frame
- `by_schedule` — the scoresheet grid sets it (8-ball nationals style, predetermined)
- `lag_each_frame` — **not derivable**; lagged at the table and recorded per frame. **This is the team-league default.**

Still **stored** on the frame, but recomputed whenever a governing setting changes. **A settings change applies across all frames already played**, not just future ones.

**A recompute can invalidate a frame already recorded** — e.g. a break & finish credited to a side that no longer breaks that frame. Rule adopted: downgrade the invalid result to a plain `win` and **report exactly which frames changed**, never silently rewrite.

**`break_side_manual` resolves the manual-override question (13 Oct).** Correcting a breaker by hand sets the flag, and the derivation then leaves that frame alone. The UI shows it dotted-underlined and offers "Back to the rule" to clear the flag and hand it back to the derivation. Implemented and tested in the mockup.

**Concurrency falls out for free:** because team matches lag every frame, the breaker never depends on a previous frame's result, so two tables running simultaneously is not a schema problem. The chain only matters for `winner_breaks`/`loser_breaks`, which team matches don't use. Concurrency remains a UI problem only.

**`break_player_id` is required for team matches** — "home breaks" identifies nobody when the lineup changes every frame.

### Timing (13 Oct)

Runs itself, with no buttons to forget:

| Event | Effect |
|---|---|
| Match starts | Racking starts |
| Break event entered | Racking ends, frame starts |
| Result entered | Frame ends, racking starts for the next frame |

**Edge case:** a frame ended while still racking, with no break event ever recorded — a walkover or abandon — has `rack_started_at = null`, and the whole period from the rack starting counts as frame time.

**Frame time and match time pause independently**, for genuine stoppages. Both the wall clock (`started_at`/`ended_at`) and `paused_seconds` are kept, so stalling still shows: a long wall clock with no pause is someone taking their time, which was the original reason for tracking it.

### Other frame decisions

**Re-racks**: the original breaker breaks again, so only one break event is ever stored. No break-history table.

**Walkovers and forfeits are frames** (`result_event = 'default'`, no times), so the match winner always derives from frames.

**Abandoned frames** have no winner and count towards nobody's score.

**No `contest_no` / rubber layer.** A rubber layer is only needed when a league scores by *contest* rather than by frame. In UV's leagues every frame is its own race-to-one with its own two players and its own lag, so team score = frames won. Even for a race-to-N contest later, `lineup_slot` identifies the contest and its frames share a slot.

**No `played_seq` column.** Sequence derives from `started_at`/`ended_at`. `strict_frame_order` is an *edit permission*, not a data concern: locked order means the scorer may only edit the next unplayed slot.

**clicker_log** — jsonb array on the frame: `[["A",0],["P",14200],["B",19800],["E",46000],["AA",612400]]` — event code plus ms offset. Codes: A/B start that side's turn, P pause, E extension, AA/BB that side wins and the clock stops for racking. Side-level only. Visits, shot times and extensions used are derivable.

**`tbl_frame_participant`** — frame_id, side, player_id, order (nullable, for scotch doubles). One row per player per side, populated even for singles so every stats query has one shape. This is what makes individual stats recoverable in team leagues.

**`tbl_frame_edit`** — frame_id, edited_by_player_id, edited_at, jsonb before/after snapshot, plus the editor's role at the time.

---

## Match level

**`tbl_match`**
- id, league_season_id OR tournament_id (both nullable — standalone matches are first class)
- round_id (nullable), match_no
- home_entity_id, away_entity_id
- venue_id (nullable)
- scheduled_at, started_at, ended_at, max_match_minutes
- first_break_side (lag winner)
- sanctioned (bool — authorisation fact, a column, never a ruleset key)
- card_version (int, see reconciliation)
- frozen ruleset snapshot (jsonb)
- status + approval/lifecycle fields

No cached scores, no `winner_side` — everything derives from frames.

**`tbl_match_table`** — match_id, table_id. The frame keeps a single table_id, FK'd to a table in the parent match's set.

**Win condition** — `win_condition_type` (`race_to` / `best_of` / `fixed_frames` / `timed`) + target.

**Discipline is per match**, not per frame.

### Draws and time expiry (13 Oct)

Split three ways, because `on_time_expiry: leader_wins` was doing two jobs badly — "leader wins" is just counting frames, which is always true.

- **`draws_allowed`** (bool) — can this match end level, by any route? **Forced false on knockout rounds**, and the setup page must not let a TD turn it on there: a bracket needs someone to advance, and that's a misconfiguration you'd discover at 10pm on finals night.
- **`tiebreak_method`** — only when draws aren't allowed and the match ends level: `sudden_death_frame` / `decider_on_lag` / `coordinator_decision`.
- **`on_time_expiry`** — narrowed to what the clock does to play: `stop_immediately` / `finish_current_frame`.

The win: there are two routes to a level match — the clock ran out, or the card ran out because slots vanished — and both now hit the same answer.

**Knock-on:** `$drawn` becomes a real standings primitive and a match result is three-way, so `3 × $won + 1 × $drawn` becomes expressible.

---

## Team league matches

Round-robin. The night is a flat list of frames, each its own race-to-one between two named players, each lagged separately.

### Two surfaces, one record

- **Captain's scorecard** — the assignment surface: the night's grid, lineups, who plays which slot. The stage is not useful to a captain.
- **The stage** — the recording surface, filtered so a player sees only their own frame. Players enter their own results.

Both read and write the same frames.

### Lineups and confirmation

- **Squad** is open and editable; **order** is a blind exchange between captains, locked at match start.
- **Submitting a lineup IS confirming participation**, even partially (3 of 5). Fixes a real pain point where confirmation is a separate, ignored step.
- `lineup_cutoff_hours` ruleset key. Past the cutoff with no lineup, that side concedes. **Evaluated lazily** when the match is opened — no scheduled job.
- Notification is **manually triggered**: when one team confirms, the other captain is notified.
- **Reserves may be added after lock.** What is locked is the *order*, not the squad. A reserve changes a frame's participant; it doesn't create frames.
- `strict_frame_order` — nationals forbid changing frame order; most league play allows any order.

Squad and order are separate things and want separate tables.

### Frames are created at lineup lock

When the second captain locks their lineup:
- **Both sides filled** → a real frame with its two participants
- **One side filled** → a `default` frame, walkover to the side that showed up
- **Neither filled** → **no frame; the slot vanishes**

A captain who never locks concedes every slot to the side that did.

**Consequence:** vanishing slots shrink the card, so a race-to target can become unreachable and a tie can appear where the format didn't expect one. Team matches therefore want `fixed_frames` with "most frames wins", plus `draws_allowed` to settle level.

### Scoresheet reconciliation — one shared record

Rejected: two parallel scoresheets reconciled at submission. That leaves a frame with no single truth until both submit, so every downstream query has to ask "whose version?".

Adopted: **one shared frame set plus a version counter.**

```
tbl_match.card_version       int, incremented by trigger on ANY frame insert/update/delete
tbl_match_submission         match_id, side, submitted_by, submitted_at, card_version
                             one row per side, replaced on re-submit
```

**The whole rule:** the card is agreed when both sides have a submission row AND both rows' `card_version` equals the match's current `card_version`. No clearing, no cascade — a submission is never invalidated, it just stops matching.

Worked example: Yesh enters frame 7 → v7. Home captain submits (v7). Away captain fixes frame 3 → v8. Home is no longer signed and sees *"The card changed after you submitted: Frame 3, break outcome Dry → Foul, by Trevor Mokoena 14:22"* — straight out of `tbl_frame_edit`. Away submits (v8). Home either agrees and re-submits, or raises a dispute on frame 3.

Why: one set of frames so nothing downstream asks "whose version"; a captain cannot quietly un-sign the other; and it generalises — a social match needs one signature or none, nationals could require the referee's too.

**After LD approval, version comparison stops.** Approval locks the match read-only for everyone below LD. Captains' submissions stop mattering; no re-signing. The LD can still edit and those edits are logged, but they don't un-sign anyone or reopen the card. **Approval is the end of the negotiation, not a checkpoint in it.**

**Notify a player whose frame was changed by someone else.**

**Partial submission allowed.** "Submit" means "this is the final card", not "all slots filled".

### Permissions on the night

- A player may enter results **only for their own frame**.
- A captain may edit any frame; edits are attributed.
- Scorers may edit during the match.
- **Captains outrank players.** Submission is captain-only.
- Approval is LD (league) or TD (tournament).

---

## Standings and league tables

Computed on fetch over all matches in the league season. Configurable by the LD.

Prior art: SportsPress Pro — columns with Name, Abbreviation, Equation, Precision, Priority; `$`-prefixed variables; sort priority decides tiebreak order; per-table visibility.

**Deliberately NOT copied:** SportsPress defines columns globally and shares them across every table, so editing an equation changes every league at once. On a multi-venue platform, columns belong to the league season.

```
tbl_league_season_column
  league_season_id, key, name, abbreviation
  equation (jsonb token array)
  precision, sort_priority, sort_direction
  visible_to_players (bool)
```

**Equations are built from buttons only** — one button per variable, one per operator. So store the **token sequence, not a string**:

```json
[ {"t":"var","v":"won"}, {"t":"op","v":"*"}, {"t":"num","v":3},
  {"t":"op","v":"+"}, {"t":"var","v":"drawn"} ]
```

No parser, no string handling, nothing to escape. Validation: does the sequence alternate value/operator, are brackets balanced.

**Hard rule: never `eval` the equation or interpolate it into SQL.** On a platform where anyone can create a league, an LD-supplied string reaching an evaluator is a remote code execution hole. The token array removes the attack surface entirely — an attacker cannot express anything the button set doesn't contain.

**Primitives** (all from frames): `$played`, `$won`, `$lost`, `$drawn`, `$frames_for`, `$frames_against`, `$frame_diff`, `$breaks_and_finishes`, `$golden_breaks`, `$walkovers_given`, `$walkovers_received`, `$streak`, `$last5`, `$home_record`, `$away_record`.

**`visible_to_players`** — "some leagues see some data as irrelevant". Probably wants to be broader than the standings table, covering which stat categories appear anywhere for that league.

---

## Tournament progression

Tournament matches only:

- `home_source_type`, `home_source_ref`, `away_source_type`, `away_source_ref`
- source_type: `entity` / `winner_of` / `loser_of` / `group_position` / `seed`

**Not automation** — the bracket's shape written down, a fact that outlives any computation. The resolver reads them plus the feeding match's result and writes the resolved entity. A coordinator filling a fixture manually writes the same column, which is why manual override works cleanly. Nullable throughout.

Flat columns, not a child table — cue sports are always two-sided.

Byes: a slot with no source and no entity; the opposing slot advances.

**Seeding** — `tbl_competition_entrant` with seed, plus nullable round_id so a re-seed after groups is a new row.

**Entrant status**: `interested` → `confirmed` (on payment, or ticked manually by a TD at a club not using credits).

**Who may enter scores**: players only for their own matches during live play; tournament-wide editing is TD only.

---

## League / tournament / season

Leagues and tournaments are **siblings**, not one table with a format discriminator.

- **`tbl_league`** — durable identity: name, discipline, default ruleset. Persists across seasons.
- **`tbl_league_season`** — league_id, season_id, name/number, ruleset overrides, status, standings columns.
- **`tbl_season`** — name, starts_on, ends_on.
- **`tbl_tournament`** — flat for now, nullable season_id. A `tournament_series` parent can be added later.

**Teams do NOT persist across seasons** — new entity per season carrying `league_season_id`. A nullable `team_lineage_id` links successive incarnations.

**`tbl_league_season_entrant`** — unique on (league_season_id, player_id): one team at a time, transfers are an update. No validity ranges needed; the frame carries the player and the match carries the teams, so attribution is correct at the moment of play. **Caveat**: "who is in team X" has two legitimate answers.

---

## Access, sanctioning and anti-abuse

Two independent axes — not one ladder.

**Access** is three scopes:
- **Platform** — UV. Approving clubs, resolving duplicate SA IDs, unpublishing abuse.
- **Venue** — existing `tbl_venue_staff` (owner / admin / staff).
- **Competition** — `tbl_competition_role` (LD/TD / referee / scorer), scoped to one tournament or season. Precedence as a **numeric rank**.

Scope beats seniority: a venue owner at another club does not outrank the TD of a tournament they aren't running.

**Verification** is a single ladder on the player:

| Level | Meaning |
|---|---|
| 0 | Walk-in, no account |
| 1 | Account, email unconfirmed |
| 2 | Email confirmed + bot check passed |
| 3 | Vouched for by an approved club |
| 4 | ID verified — The Dive Club staff only |

Level 4 stays venue-scoped, **for UV's own business operations only** — never a platform-wide trust signal. Level 3 is the weaker signal and gates public listing.

**Anyone can create a tournament.** No venue required. Approved clubs get a venue record, branded pages and venue-scoped features. The tier falls out of `venue_id` being nullable.

**Sanctioned vs casual** at competition and match level, a **column not a ruleset key**. A match may only be sanctioned if its parent is. Rejected unless the writer holds an approved-club role. Store `sanctioned_by` and `sanctioned_at`.

**Anti-abuse, in layers:**
1. Bot check at signup (Turnstile/hCaptcha, Supabase-native). Highest value, config not code.
2. Email confirmation before any write. *(Confirmed already ON.)*
3. Rate-limit creation by **time** as well as count.
4. Graduated tiers: unverified accounts can create, but nothing is publicly listed or indexed. This removes the incentive.

Phone OTP rejected: costs per message, fake numbers easy in SA.

Cap **active** competitions per unverified player, not total. "Remove one to make another" must archive, not delete.

---

## Roles

- **`tbl_entity_member`** — entity_id, player_id, role: captain, player, scorer, coach.
- **`tbl_competition_role`** — league_season_id or tournament_id, player_id, role: LD/TD, head referee, organiser, scorer.

Role as FK to a lookup table **with a rank number**, not an enum.

Referees are players.

---

## Tables and venues

**`tbl_table`** — venue_id, name/number, size, cloth type, last_recovered, status. Changing a frame's table is an edit like any other.

Match carries venue_id (nullable). Sufficient for travelling leagues.

---

## Approval and locking

- **Approval mode** (ruleset): `none` / `dispute_window` / `coordinator_approval` / both
- **Lifecycle**: in progress → both captains signed (card_version match) → dispute window → LD/TD approval → **locked, read-only below LD**
- LD/TD edits after approval are logged but don't reopen the card.

A dispute is raised against a *specific frame*, so the dispute record needs a nullable frame_id.

---

## Ruleset jsonb discipline

Merge order: competition settings → round overrides → **frozen onto match at creation**.

1. **Version the blob** — Zod discriminated union on `version`, so old matches parse under their original schema forever.
2. **No partial objects** — every key explicit including defaults. (Round overrides are the one place partials are allowed, pre-merge.)
3. **Validate on write, trust on read** — `.strict()` so a typo fails loudly. Validate the *merged* result too.
4. **Flat** — Postgres `||` is a shallow merge, so nested objects would replace wholesale.
5. **Structural things stay as columns** — discipline, format, entity size, sanctioned.

**No curation of which settings may be overridden per match.** "Nonsense" tournaments (a party format, a variety night) are a legitimate use; `scope` means *which levels can set this key*, not *which keys are permitted*.

**The settings UI is generated from the schema.** Each key carries metadata (type, min/max, label, help, scope, player_facing). The tournament setup page, round settings box, per-match override dropdown and the poster text file are all renderings of one definition. `player_facing` drives the poster text — auto-progression rules *are* player-facing. **Proven in the mockup:** its whole settings panel is generated from a `SETTINGS` array, and adding a setting there is the only edit needed.

**Current keys:** version, discipline, win_condition_type, win_condition_target, break_determination, draws_allowed, tiebreak_method, on_time_expiry, max_match_minutes, golden_break_enabled, reverse_break_finish_enabled, break_finish_requires_breaker, shot_clock_enabled, shot_clock_seconds, shot_clock_first_shot_seconds, extensions_per_player, extension_seconds, referee_required, score_entry_mode, approval_mode, dispute_window_hours. To add: lineup_cutoff_hours, strict_frame_order, blind_lineup_exchange.

---

## Player identity and merging

Solved by the shipped system: `tdc_claim_my_walk_in` and `tdc_staff_link_account`, both calling `private.tdc_merge_players`. Multiple walk-ins chain onto one account.

Guards: refuses when both records have an SA ID on file; only merges a walk-in *into* an account.

**⚠ `private.tdc_merge_players` enumerates the tables it moves by name.** Every new player-referencing table must be added. See `claude/stats-build-changes.md`.

Player search must be cross-venue, or TDs create duplicate walk-ins instead of finding the existing player.

---

## Credit system — findings from the live DB

Ledger only, no credit_lots, holds or balance cache. Balance is `tdc_my_credit_balance(venue_id)` summing `tbl_credit_ledger`.

Three blockers for league fees:

1. **No `ref_table` / `ref_id` on `tbl_credit_ledger`.** Nothing links an entry to its cause.
2. **`entry_type` check allows only `('adjustment','code')`.**
3. **Travelling leagues break venue scoping.** `venue_id` is NOT NULL, but a league at four clubs owes its fee to the league. **Undecided.**

`idempotency_key` is unique and required, so `league_fee:<entrant_id>` makes double-charging structurally impossible.

---

## Build state (13 Oct)

Mockup only, no database. Three files, untracked — UV commits:
- `src/match/index.html`
- `src/scripts/match.js` — the single `MATCH` object plus the `SETTINGS` definitions the panel is generated from
- `src/stylesheets/match.css`

**Page structure:**
- **Stage** — exactly one screen below the nav. Each side owns half: top/bottom portrait, left/right landscape. Name, lineup (tappable for teams), frames won, break-outcome buttons on the breaking half, result buttons, ⋯ for walkover / abandon / change table. The who-breaks overlay when the rule doesn't derive it.
- **Timing panel** — below the stage. State, table, rack/frame/match time, independent pause for frame and match. Shot clock, extensions and match clock sections appear only when their settings turn them on.
- **Frame history panel** — below timing. Visualisation placeholder, then the editable table, then Undo last.
- **Match panel** — nav bar slide-over. Context, badges, all settings, editable, applying retroactively.

**The winner is implied by which half you tap.** No separate winner step, which makes impossible frames unreachable rather than merely validated: break & finish exists only on the breaking half, reverse B&F only on the other.

**History table** — rows are what was recorded, columns are frames:

```
Lag: A        │ 1       │ 2    │ 3        │ 4  │ Total
Break         │ A       │ B    │ A        │ B  │ A 2 · B 2
Break event   │ In      │ Foul │ Dry      │ In │ In 2 · Foul 1 · Dry 1
Frame winner  │ A (B&F) │ A    │ B (rB&F) │ B  │ 2 — 2
```

A/B with a legend; scrolls sideways with row labels pinned. Every cell is editable during the match and the scoreboard follows, because the score is counted from the frames. The result picker only offers combinations that fit who broke. A correction that invalidates a frame reports it.

**Still to place** — stage, panel, below the fold, separate screen, or cut:

*Corrections*: abandon reason; raise a dispute on a frame.

*The record*: per-frame detail (players, times, table, referee); edit history / audit trail; submit scoresheet; approval state.

*Match identity*: match status; actual start/end; assigned scorer; match number; venue and scheduled date (in the data, shown nowhere).

*Stats*: the visualisation itself (placeholder in place); head-to-head; break-and-run %; average frame time; per-player contribution; extensions used / clock violations; effect on standings or bracket.

*Navigation*: link to league table or bracket; previous/next match; share link to public follow view; big-screen spectator mode; player profile links.

**Not yet built:** captain's team scorecard page; tournament rounds/bracket page; public follow view.

---

## Open questions

**Team matches**
- Both sides leave the same slot empty → **resolved: no frame, the slot vanishes.**

**Payments / fees**
- Is credit a stored balance that fees draw against, or an account with transactions? Money has audit requirements frames don't — worth its own session.
- Balance never goes negative. If a player is short on a league fee: entry blocked until paid in full, or partial payment allowed (meaning a fee is a thing with a balance, not a single debit)?
- Can a `walk_in` or `guest` be a league entrant, or must they have claimed an account first?
- Venue scoping for travelling leagues.

**Competition config**
- Approval and dispute mechanics in detail.
- Shot clock and extension rules the timer system reads.

**Match page (deferred refinements, not blocking)**
- Rotate the top half 180° in portrait so the opponent reads it across the table?
- Away on top / home on bottom is arbitrary — should the logged-in player always be the bottom half?
- One tap ends a frame. Right for social play, but should sanctioned matches need a confirm or long-press?
- Clearing a break event doesn't un-start the frame, so a mis-tap sets a frame start that only Undo clears.

**Scope decisions already made**
- Snooker (frame point scores) out of scope — separate system later if needed.
- Timer/clicker hardware built separately; it writes the clicker_log.
- Discipline is per match, not per frame.
- No rubber/contest layer; no played-sequence column.

---

## Standing concern

The genuine complexity isn't the schema — it's that cue sports rules really do vary this much. Most of this design pushes that variance into config instead of columns, which is right, but it doesn't make the variance disappear. It concentrates it in the ruleset, where discipline is required.

Heaviest remaining risk: the jsonb ruleset quietly becoming an unvalidated config format with behaviour depending on keys that may or may not be present. Write its schema early.
