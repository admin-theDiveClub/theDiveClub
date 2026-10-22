# theDiveClub — decision log

**Why things are the way they are.** Append-only. Entries are never edited to match a later change of mind: if a decision is reversed, the old entry stays and a new one supersedes it, naming what it replaces. That is the point — a log you can rewrite tells you nothing.

One entry per decision that would be expensive to get wrong or that somebody will later be tempted to undo. Not every choice; the ones with a reason worth keeping.

Earlier reasoning that predates this log lives in `CLAUDE.md` and in `claude/stats-schema-design.md`.

---

## Format

**`YYYY-MM-DD` — The decision, in one line**
*Decided by:* UV, or Claude with UV's agreement
*Why:* the reasoning
*Rejected:* what was considered instead, and what it would have cost
*Touches:* where it shows up

---

## The founding principles

These predate the log. They are recorded here because every one of them is a decision somebody could reasonably undo without realising what it was holding up. **Breaking one of these is how this project goes wrong.**

**Frames are the only record**
*Why:* scores, winners and statistics are always counted, never stored, so there is exactly one truth and no second copy to drift from it.
*Exception:* a TD-run match may have no frames at all, so a directly entered match score is a normal recording path — but it is stored as its own visible record, never written onto the match as if it had been played.

**The ruleset is frozen onto each match at creation**
*Why:* so that changing a league's settings in March cannot rescore frames played in October.
*Consequence:* any feature that changes a ruleset after the fact — per-round settings, for instance — has to say what happens to matches already under way. It cannot simply overwrite.

**Writes go through security-definer `tdc_` functions, never straight from the browser**
*Why:* the rules live in one place that the client cannot route around. Access helpers live in `private`.

**One place decides each permission**
*Why:* `private.tdc_can_edit_match` for cards, `private.tdc_can_run_tournament` for competitions. A rule repeated in two functions is a rule that will disagree with itself.
*Rejected:* per-function permission checks, which is how an override ends up allowed in one path and refused in another.

**The card is an append-only event log, not a status column**
*Why:* `card_version` retires stale submissions automatically, and the history of who said what survives.

**After every write the page re-reads from the server**
*Why:* the server owns derived values — break sides, counted scores, card state. A page that patches its own copy drifts the first time two people write at once.

**A setting is defined once, in `TDCMatchDef`**
*Why:* the match panel, the create page and the poster text all generate from it. Adding a setting should be one edit, never two that drift.

**A tournament director must be able to run everything alone**
*Why:* plenty of entrants never open the app, and a TD at a club night works from a scoresheet on the bar. Players entering their own scores is a convenience, not the path. Any design that assumes player participation is wrong.

---

## 2026-10-19 — The draw is its own table, not columns on the match

*Decided by:* UV
*Why:* the progression design wanted `home_source_type` / `home_source_ref` on `tbl_matches`. They cannot go there: `tbl_matches_home_side_is_one_thing` requires a `player` side to carry a `player_id`, so a round-of-16 match between two unknown people could not exist.
*Rejected:* relaxing that constraint — it would have weakened a guard protecting every social and league match in order to serve tournaments only.
*Consequence:* a bracket is readable and publishable with no matches in existence, which is what a draw sheet on a wall actually is. A real `tbl_matches` row is created later, when both sides are known.
*Touches:* `tbl_tournament_fixtures`, `tdc_create_fixture_match`

## 2026-10-19 — A started draw can be redrawn, it just asks first

*Decided by:* UV — "the TD has full control over their own tournament"
*Why:* refusing outright would have made the app argue with the person running the night.
*How:* with matches attached, `tdc_generate_draw` and `tdc_clear_draw` refuse once with a message naming how many, and proceed when passed `p_detach_matches`. Nothing is destroyed: the FK runs fixture → match, so played matches survive and simply stop belonging to a bracket.

## 2026-10-20 — The bracket advances on *published*, not on *recorded*

*Decided by:* UV, in `claude/approval-and-corrections.md`
*Why:* a result that has not been approved is not yet a result. Advancing on it means the round above is built on something that may be sent back.
*Touches:* `tdc_fixture_outcome`, `tdc_resolve_draw`

## 2026-10-20 — A match whose players change stops belonging to the draw, keeping its frames

*Decided by:* Claude, in `tdc_cascade_draw`, with UV's agreement
*Why:* the match was between two particular people. If either changes it is not that fixture's match any more. Frames record a winner as a *side* while the match names a *player*, so repointing the match would silently turn one person's frames into another's.
*Rejected:* deleting the match (destroys real play), and repointing it (falsifies a record).
*Reused by:* the fixture player swap on 21 Oct, deliberately rather than inventing a second answer to the same question.

## 2026-10-21 — Tournament status is derived, with a manual override

*Decided by:* Claude, with UV's agreement
*Why:* the status column had existed since 19 Oct and nothing ever wrote it, so every tournament read "Draft" forever — and the badge is believed. The facts behind a status are already in the database, so it is counted rather than stored.
*Rejected:* writing the column from the six functions that could change one of those facts — six places to keep in step and a seventh somebody forgets, which is how a status column goes stale in the first place.
*Override:* a derivation cannot express "cancelled", so the stored column stays as the override with `status_manual` saying it is in force. **Same shape as `tbl_frames.break_side_manual`** — a TD who has met one already understands the other.

## 2026-10-21 — Entry defaults to `td_only`, and paid-confirms is optional

*Decided by:* UV
*Why:* every tournament that already existed keeps behaving exactly as it did. A TD who confirms on some criterion other than payment would be surprised by paid-confirms, so it is a choice rather than a rule.
*Also:* entering never *lowers* a status — pressing "interested" again must not undo a confirmation the TD has already given.

## 2026-10-21 — The poster is a stored snapshot, not a public read of the live tables

*Decided by:* UV — *"maybe you route the information through the TD's account rather than letting unsigned accounts access the DB?"*
*Why:* three reasons. Every `tdc_` function written so far assumes a caller with a player record, so opening any to `anon` means re-auditing each one. A poster is a snapshot by nature — the TD produces it at a moment. And it collapses the whole exposure question to one reviewable place: `anon` can select one table holding one pre-vetted blob, and nothing else.
*Rejected:* granting `anon` a narrow read of `tbl_tournaments` plus a cut-down draw function. Cheaper to write, far more expensive to keep safe.
*Cost, accepted:* a published poster goes stale and says so. Correct for a poster, wrong for a scoreboard — so a live public scoreboard is a **separate** feature and must not be built by growing this one.

## 2026-10-21 — A picker, not drag-and-drop, for swapping a player

*Decided by:* Claude, proposed to UV and accepted
*Why:* UV asked for dragging a player from the confirmed list onto a match. A TD at the desk is on a phone, and dragging across a sideways-scrolling bracket mis-taps.
*Note:* `tdc_swap_fixture_player` serves either, so a drag can be added later without schema change.

## 2026-10-21 — A rejection undoes an approval; an objection does not

*Decided by:* Claude, fixing a bug
*Why:* `tdc_card_state` treated the latest `approved` event as terminal without checking what came after. That rule is right for a player's **objection** — which must not unpublish a result — and wrong for a **rejection**, which is the coordinator withdrawing their own approval. The two acts were conflated.
*Consequence:* "send it back" did nothing but write a note. No way out of a mistaken approval, frames still locked, bracket still advancing.
*Fix:* one `not exists` clause in three places. The third — `tdc_approve_card`'s own guard — mattered: fixing only the first two produced a card that could be sent back and then never approved again.

## 2026-10-21 — The bracket side is a grid, not a flex line

*Decided by:* Claude
*Why:* as flex, the player's name was a shrinkable item sharing a row with the swap button, and on UV's screen it collapsed to **0 × 20** — every name invisible, the frame score left looking like the name.
*Honest note:* the cause was **never reproduced**. The DOM, the function's return value and all five stylesheets checked out, and a headless Chromium rendering the same markup against UV's own CSS gave the name 158–178 px every time.
*So:* fixed structurally rather than chased. A `1fr` grid track cannot be squeezed away by what sits beside it. **Prefer explicit grid tracks over a flex line wherever an element must never vanish.**

## 2026-10-21 — The nav reload button stays hidden in a browser

*Decided by:* UV
*Why:* raised when it was missing on PC. Claude changed it to show everywhere, arguing that it also pokes the service worker; UV reverted that — *"The refresh is supposed to be hidden on pc. Leave as is please."*
*Status:* settled. Do not reopen.

## 2026-10-21 — Documentation moves to a living record, not handovers

*Decided by:* UV and Claude
*Why:* two records went into the 21 Oct session. `claude/handover.md`, written once at a session end, was wrong two days later and misled the next chat. `CLAUDE.md`, updated at every milestone, stayed accurate throughout. A handover is a snapshot of a moving thing and rots immediately.
*So:* no more handover documents. One living record (`CLAUDE.md`), one agenda (`docs/STATUS.md`), one why (this file), and a short bootstrap prompt that makes the first turn of a new chat a read-back rather than a guess.

## 2026-10-21 — Commit messages carry a body, not just a subject

*Decided by:* UV
*Why:* git history is the one record that cannot go stale and is automatically ordered. With a subject alone it answers *what* changed and never *why*, so every "why is this like this" question falls back to a document somebody has to maintain. Three or four lines of body on a non-obvious commit makes the repo self-documenting.
*How:* Claude gives UV a subject, plus a short body where the change is not self-evident. A one-line fix stays a one-line subject — a body on everything is noise, and noise is skipped.
*Unchanged:* Claude still never commits or pushes. The message is handed over; UV commits.

## 2026-10-22 — Colours are chosen in the sandbox and saved into variables.css; the logo stays inline, driven by variables

*Decided by:* UV
*Why:* UV wants to pick colours by seeing them on the site, not by editing hex values and reloading, and wants a change to be a visible file change he can commit or undo in Fork. The sandbox therefore edits drafts per theme and patches `variables.css` in place; nothing is stored anywhere else. The logo stays an inline SVG on the live site, so its values (and later animation) can change dynamically, which an `<img>` cannot do.
*So:* the specified palette is cut to what is chosen by hand (11 colours, the surface's opacity, two depth strengths per theme). `--alpha-1` to `--alpha-4`, `--shadow-raised`, `--color-cream` and `--color-ink` were removed because nothing used them; `--hover-wash`, `--shadow-panel` and `--scrim` are built from the chosen values. The logo's colours, opacities, blur and gradient are `--logo-*` variables, per theme.
*Rejected:* a settings table or localStorage for the choices (a second place for the truth, and invisible to Git); keeping the logo as an `<img>` (cannot be changed by variables or animated).
*Touches:* `variables.css`, `/sandbox/`, and any future inline logo markup in `_includes`.

## 2026-10-22 — Notifications are a record first and a push second

*Decided by:* UV, after asking what the difference was
*Why:* a push is handed to Apple or Google and forgotten. Phone off, or notifications never switched on — which is most people — and it never happened, with nothing to find later. A TD entering sixteen players on Tuesday for Saturday would reach almost none of them.
*So:* every notification is a row in `tbl_notifications` the recipient can come back to, and a push goes on top where they have allowed it. **A failed push is not data loss.**
*Follows from it:* the per-category switches govern the push and never the record — muting tournaments stops the interruption and keeps the history, which is what muting means to a person.

## 2026-10-22 — An account is required for notifications

*Decided by:* UV — "Walk-ins are not a priority for notifications. A player should have an account for notifications to be enabled."
*Why:* a walk-in has no account and can never read a notification, so the row would be unreachable.
*Where:* `private.tdc_notify` writes nothing for a player with no `user_id`.
*One line kept anyway:* `tdc_merge_players` moves notifications, because the record it *removes* during a walk-in claim is the signup record — the one with the account. Without it, claiming a walk-in would silently wipe what that account had been told.

## 2026-10-22 — The frame notification is for officials, not opponents

*Decided by:* Claude, flagged to UV
*Why:* the frame-edit trigger fires on every frame write. Notifying each time would message the opponent once per frame during ordinary play, which is the opposite of useful.
*So:* it fires only for an editor who is **not a player in the match** — a TD, scorer or referee acting on somebody else's card. A player scoring their own match is the card flow's business.
*And it collapses:* an unseen notice of the same kind about the same match is refreshed rather than joined by a second, so a TD correcting five frames leaves one. Verified: ordinary play produces zero.

## 2026-10-22 — Pushing is a sweep, not a trigger

*Decided by:* Claude, from what the project has
*Why:* notification rows are written inside database functions and triggers, so the page that caused them does not know how many were written or to whom and cannot compose them. A trigger calling out over HTTP needs `pg_net`, and the project has **neither `pg_net` nor `pg_cron`** installed.
*So:* `pushed_at` is a queue, `tdc_claim_pushes` hands out work and marks it in one statement (`for update skip locked`, so two sweeps cannot double-send), and the `notify-push` Edge Function sends it. Any page sets it going.
*Deliberately trigger-agnostic:* the function does not know what set it off, so a schedule can call it later with no change.
*Exception recorded:* `tdc_claim_pushes` lives in `public`, breaking the rule that internals live in `private`. PostgREST exposes `public` only and the Edge Function calls it over the API. The lock-down is the grant — revoked from `anon` and `authenticated`, granted to `service_role` alone.

## 2026-10-22 — pg_cron waits for leagues

*Decided by:* UV — "Keep PGCron for later (I think we'll enable when we sort out the leagues which require scheduled notifications)"
*Why:* nothing built so far needs a scheduler. The two things that would — the dispute-window reminder and league scheduling — are both ahead, so enabling it now would be infrastructure with one speculative user.
*What this costs today:* nothing. The push sweep was designed to need no scheduler, and will accept one without modification.

## 2026-10-22 — The UI chat refines; the schema chat builds

*Decided by:* UV — "The UI chat is for me to update UI elements. Not build pages."
*Why:* the split written on 21 Oct gave the UI chat all markup and all stylesheets, which would have meant a page's data layer and its markup being owned by different chats and written into the same file.
*So:* the schema chat builds a page together with the functions behind it, markup and CSS included. The UI chat refines what exists — styling, tokens, layout, accessibility — and owns `/sandbox/`.
*Recorded in:* `claude/ui-handover.md` §2, which now says so explicitly.

## 2026-10-22 — A round may have its own ruleset

*Decided by:* UV — "Stored, and editable before the round starts" / "Apply, after showing which ones" / "Either — a checkbox for 'and later rounds'"
*The tension:* a match freezes its ruleset at creation **on purpose**, so that a later change cannot rescore frames already played. A per-round setting appears to contradict that. It does not: the two answer different questions. The frozen copy says what a match *was played under*; the round row says what a match *started from now on* will use.
*So:* `tbl_tournament_round_rules` is a real row, keyed `(tournament_id, bracket, round)`. Absent means the round follows the tournament — there is no row to create up front and no backfill. `private.tdc_rules_for_round` is the one place that resolves round-then-tournament, and `tdc_create_fixture_match` calls it instead of reading `tournament.rules` directly.
*On matches that already exist:* they are changed, but only after the TD has been shown exactly which. `tdc_set_round_rules` rehearses in a subtransaction and returns the list — which matches change, how many are being played right now, and which are being left alone and why. `p_apply` defaults to false, so the first call never writes.
*What is never touched:* a match whose card is agreed or published. It is skipped and reported as skipped, not fought with.
*On a match being played:* its frames are kept and the break order is derived again under the new rules. Nothing is rescored; the derivation was always a function of the frames and the ruleset.
*Scope:* `p_and_later` covers every round above this one that is already drawn — one checkbox rather than two buttons, which was the cheaper of the two readings UV allowed.
*Validation is not duplicated:* a ruleset the matches would refuse is refused here too, by the same check.

## 2026-10-22 — `.tdc-card button` outranks a single class

*Decided by:* Claude, found by rendering rather than by reading
*What happened:* the round-rules pill on each round heading came out 233×45px — stretched to the whole column. `forms.css` styles `.tdc-card button` as a full-width pill, and that (0,1,1) beats `.bracket-round-rules` (0,1,0) no matter which file loads last.
*So:* any small inline button inside a card is written as `.tdc-card .<class>` and undoes `width`, `height` and `margin` explicitly. `.bracket-name.as-button` already dodged this by accident — two classes tie, and `bracket.css` loads second.
*Worth the note because:* nothing in the markup or the stylesheet looks wrong. It is only visible once rendered, which is the argument for rendering.

