# theDiveClub — decision log

**Why things are the way they are.** Append-only. Entries are never edited to match a later change of mind: if a decision is reversed, the old entry stays and a new one supersedes it, naming what it replaces. That is the point — a log you can rewrite tells you nothing.

One entry per decision that would be expensive to get wrong or that somebody will later be tempted to undo. Not every choice; the ones with a reason worth keeping.

Earlier reasoning that predates this log lives in `docs/systems/` and in `docs/archive/stats-schema-design.md`. Entries below that cite `claude/<name>.md` (a project doc at the time) now map to `docs/archive/<name>.md`, or to the file named in `docs/archive/README.md`.

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

## 2026-10-22 — Progression is a per-slot edge, and always was

*Decided by:* UV, describing what he wanted — "the arrows will adjust according to changes made by TD, where R1M1 & R1M2 -> R2M1 can become R1M1 & R1M3 -> R2M1"
*The finding:* this needed no schema change. `tbl_tournament_fixtures` has stored `home_source_type`/`ref` and `away_source_type`/`ref` **independently per slot** since the draw was first built. A pairing was never a thing the table knew about; it was only ever two slots that happened to point at adjacent fixtures.
*So:* the arrows UV wants on the page are not a visualisation of a rule to be invented. They are a direct drawing of two columns that are already there, and an inserted empty round is transparent for free — R2's slots still point at R1, so the arrows already pass over the gap.
*What was actually missing was the verb:* `tdc_set_fixture_source` to say it, `tdc_add_fixture` to put another match in a round, and a picker read. All three in `20261022150000`.
*Worth recording because:* the instinct on reading UV's description was that fixtures are "generated as a complete shape and nothing adds to them afterwards", which `docs/STATUS.md` had said since 21 Oct. That was true of the *generator* and never true of the *table*. Checking the columns before answering changed the size of the job from a migration with a renumber to two functions.

## 2026-10-22 — Repointing a slot empties it

*Decided by:* Claude, from how resolve works
*Why:* `tdc_resolve_draw` only ever fills an empty slot — that restraint is what makes it safe to call on every page load. So a slot that still holds last round's winner can never be filled by a newly attached source. The TD would be looking at an arrow that does nothing.
*So:* pointing a slot at a fixture clears its entrant, and the rehearsal reports who was displaced. Seating somebody directly (`entrant`) fills it instead, which is the same rule `tdc_set_fixture` already follows.
*And a bye goes with it:* a bye says "nobody can ever be here". Giving that slot a source makes it false, so the award is cleared and reported. That is the late-arrivals case on a draw with byes, which is the common one.

## 2026-10-22 — Inserting a round renumbers

*Decided by:* UV — "Renumbering it is"
*The alternative:* sparse ordering — rounds stored 10, 20, 30, inserted at 15, never renumbered. Cheap inserts, but every display and every round ruleset would then deal in an ordinal separate from the stored number, permanently.
*Why renumbering won:* one awkward function rather than a second concept that never goes away. `tbl_tournament_round_rules` is the only thing that stores a round number today, so the blast radius is still small — and it shrinks no further by waiting.
*Still to do when it is built:* move the round-rules rows with the renumber, and make `roundName()` explicit. Deriving "Semi-finals" from distance to the last round stops being true the moment the ladder is not a clean power of two, which a prelim round guarantees.

## 2026-10-22 — An empty round is a gap, not a row

*Decided by:* Claude, from what the schema already says
*Why:* there is no rounds table. A round exists because fixtures are in it. Adding one to hold an empty round would make rounds a thing that can disagree with the fixtures in them — two sources of truth for the same fact, and a new way for a draw to be wrong.
*So:* `tdc_insert_round` is **only** the renumber. It leaves a gap in the sequence, and the page draws `1..max` rather than the distinct rounds that have fixtures. The gap *is* the empty round.
*What falls out for free:* the arrows pass over it, because the round above still points at the round below and nothing was rewired. UV described exactly that behaviour as something to build; it turned out to be something not to break.
*Cost:* one rule the page has to know — draw `1..max`, not `distinct round`. Written into `docs/STATUS.md` against the arrows work rather than left to be rediscovered.

## 2026-10-22 — Renumbering moves in two passes, and the constraint stays immediate

*Decided by:* Claude
*The problem:* `update ... set round = round + 1 where round >= N` fails. The unique constraint on `(tournament_id, bracket, round, position)` is checked per row as rows are updated, so the first row moving from 1 to 2 collides with the 2 that is still there.
*The obvious fix, rejected:* make the constraint `deferrable` and defer it inside the function. Deferred constraints are checked at the end of the **transaction**, not the subtransaction — which is past the rehearsal's abort, and therefore past where a violation can be caught, reported, or rolled back cleanly. It would trade a visible failure for one that surfaces at `COMMIT` in a caller that has no idea what happened.
*So:* `private.tdc_shift_rounds` moves the affected rows clear of every existing number (offset by the current maximum round, which is by definition larger than anything staying put), then brings them back. Two statements instead of one, every check immediate, every failure inside the function.
*One place only:* both insert and delete go through the same helper, including delete, where shifting down could not collide anyway. One function that knows how to move a round number is worth more than a micro-optimisation in the half that is safe.

## 2026-10-22 — The arrow is the slot's source, not a picture of it

*Decided by:* Claude, from the shape the schema already had
*Why it matters:* the tempting build is a layer that works out progression for display — pairing rounds, halving positions, inferring who feeds whom. That layer would be a second model of progression, and the day it disagreed with `tdc_resolve_draw` the bracket would lie convincingly.
*So:* every arrow is drawn from `home_feeder_id` / `away_feeder_id`, the same columns resolve reads. UV asked for arrows that "show that change rather than resorting the entire tournament" — which is not a feature that had to be written, but a property of not writing the inferring layer.
*What that bought:* `20261022170000` adds four columns to `tdc_tournament_draw` and the page draws lines between boxes. There is no progression logic in the browser at all.

## 2026-10-22 — Arrows go behind the fixtures

*Decided by:* Claude, after rendering it
*Why:* drawn in front, an arrow crossing an inserted empty round runs straight through the names in the column it passes over. A printed draw sheet does not look like that.
*So:* the SVG layer sits at `z-index: 0` and fixtures at `1`, and a line simply disappears where a box covers it. `pointer-events` is off on the layer and on for the paths, so the arrows are still clickable where nothing covers them — checked with `elementFromPoint` rather than assumed — and they never steal a click from a fixture.
*Only visible by rendering:* nothing in the markup or the stylesheet reads as wrong. Second time in one day that the layout bug was invisible to reading, after `.tdc-card button`.

## 2026-10-22 — A round is named by how many matches are in it

*Decided by:* Claude, as a consequence of round insertion
*Was:* `roundName()` counted back from the last round — last is the Final, one before is the semis.
*Why that broke:* it assumes a clean power-of-two ladder. `tdc_insert_round` exists precisely to put a prelim in front of round 1, after which every round shifts and the old rule calls the real quarter-finals the semis. The names would have been confidently wrong on exactly the draws the new feature creates.
*Now:* walking down from the last round, one match is the Final, two the semis, four the quarters — and **naming stops the moment the halving breaks**. A prelim, an odd field, or a match added by hand all fall back to "Round n", which is true and is what a TD says out loud anyway.


## 2026-10-22 — A league season has no status column until there are fixtures to derive it from

*Decided by:* Claude, from the 21 Oct tournament-status lesson
*Why:* the design lists `status` on `tbl_league_season`. The tournament column of the same name sat at `draft` for two days because nothing wrote it, and a badge nobody updates is a badge that gets believed. A league season's honest status is a fact about its fixtures; creating the column first would recreate that bug with nothing to derive it from.
*So:* none yet. When fixtures exist, derive it as a tournament's is, with a manual override only if a derivation cannot say "cancelled".

## 2026-10-22 — Team membership lives on the entrant row; a captain is a flag there

*Decided by:* Claude, flagged to UV
*Why:* the design has both `tbl_league_season_entrant` (with a team) and `tbl_entity_member` (team, player, role). It also names "who is in team X" as the question with two legitimate answers — the roster, and who actually played. A member table alongside the entrant's team would add a third answer to the roster half.
*So:* the roster is `tbl_league_season_entrants.team_id`, a captain is `is_captain` on that row, and transfers are updates. Scorer and coach, the other member roles, are left out until something needs them; a scorer is a competition role already.
*Rejected:* a separate member table (two sources for one fact); captain as a competition role (it is per team, and `tbl_competition_roles` is per competition).
*Follows from it:* a composite key `(team_id, league_season_id)` makes a cross-season placement impossible by any path.

## 2026-10-22 — League directors and tournament directors are one role type

*Decided by:* Claude
*Why:* ranks are unique and a comparison, so a second role at 100 cannot exist; and the design treats LD and TD as the same power in different competitions. Renaming the lookup row would relabel the tournament officials list for no gain.
*So:* the `director` row is untouched and league functions label it "League director" on the way out.

## 2026-10-22 — A table that carries payment and private notes is reached only through functions

*Decided by:* Claude
*Why:* `tbl_tournament_entrants` was meant to be gated on 21 Oct and only its read function was. The table kept a `select … using (true)` policy, so the data the gate protects was one API call away.
*So:* `tbl_league_season_entrants` has RLS on, no policy and no grant. Everything reads it through a security-definer function that does its own check. The tournament table is recorded in `docs/STATUS.md` §6 and left to its own chat.

## 2026-10-22 — The merge moves card events and deleted-match records

*Decided by:* Claude, found while reading the function for leagues
*Why:* `tbl_match_events.player_id` is `ON DELETE RESTRICT` and the merge never moved it, so a signup record that had ever submitted or answered a card made the walk-in claim fail with a raw foreign-key error. Reproduced against the production definition on a scratch database before changing it. `tbl_deleted_matches` was missing too.
*Loud, not lossy:* the transaction aborts, so nothing was lost — but the claim simply could not go through, for exactly the players most likely to have played a match.
*Method:* the live function was patched, not retyped, and diffed against the original with comments intact: additions only.

## 2026-10-22 — Walk-ins and guests can never be league players

*Decided by:* UV
*Why:* walk-ins are for business operations, tournaments and matches. A league player has to confirm their own place, which takes an account. Claude had defaulted to allowing it, as tournaments do; UV said no.
*So:* `tdc_add_league_entrant` refuses an accountless player, and an insert trigger on the entrants table refuses it by any other path. Insert-only, because the walk-in merge repoints entrants at a record that only gains its login at the end.
*Cost:* the merge's same-league-season guard is now unreachable. Kept as a defence; not tested.

## 2026-10-22 — A league player confirms their own place, and the league waits for everyone

*Decided by:* UV
*Why:* a place is nothing until the player says they are playing. Existing leagues treat confirmation as a step everybody ignores; here it gates the start.
*So:* `confirmed_at` on the entrant row, set only by the player through `tdc_confirm_league_entry`. Adding a player notifies them. Coming back from a withdrawal clears it. A season is ready when it has an active player and every active player has confirmed; fixtures must refuse otherwise.

## 2026-10-22 — The league director creates teams; captains control them and claim confirmed players

*Decided by:* UV
*Why:* creating a team is a league-level act. Running one, day to day, is the captain's. Players can be added mid-season by the director, so a team needs a way to take them in.
*So:* team creation stays with the director. A captain (active and confirmed) may rename the team, claim a player who is in the season, active, confirmed and unplaced, release a player, and name other captains. A team's last captain is protected.
*Not decided:* captains inviting players themselves. UV: a common practice, to be discussed later.

## 2026-10-22 — Leagues get a manage page and a season page, not one page with two modes

*Decided by:* Claude
*Why:* the tournament manage page renders for the director only, and sends everyone else to the draw. A league has a second kind of person with real controls — the captain — and a third with only their own place to confirm. One page that hides and shows half its controls by role is the shape the tournament page was kept out of.
*So:* `/leagues/manage/` is the director's and sends anyone else away; `/leagues/season/` is for people who play, and for a captain it adds the controls for their own team. The director can see the player view from a link, and a captain never sees payment or notes, because `tdc_league_season_entrants` is not theirs.

## 2026-10-22 — League player search is its own function

*Decided by:* Claude
*Why:* `tdc_search_entrants` returns walk-ins and is gated on a tournament. Reusing it would have offered the director people the database then refuses, and told them so on the click.
*So:* `tdc_search_league_players` returns accounts only, so what the page offers is exactly what the add accepts, and reports each person's state in the season so a withdrawn player can be added back.

## 2026-10-22 — A league bye is a fixture row, not a missing one

*Decided by:* Claude
*Why:* with an odd number of teams somebody sits out each round. Leaving them out of the schedule entirely makes "who do we play this week" answerable only by elimination, and a captain checking the list finds nothing and wonders whether it is broken.
*So:* a bye is a row with a home team and no away team. `tbl_league_fixtures_bye_has_no_match` stops one ever carrying a match, by any path.

## 2026-10-22 — Generating the fixtures notifies nobody

*Decided by:* Claude
*Why:* a freshly generated schedule is the league director's working document — they will look at it, move a game, and quite often regenerate the whole thing. Notifying on generation would tell everybody three times. Notifying when a match is created would be worse: it would point at a page that cannot open a team match until step 6, which is a lie.
*So:* nothing in the fixtures step notifies. Telling the players the schedule is out becomes a deliberate separate act, as generating a tournament poster is separate from sharing it. Recorded as wanted in `docs/STATUS.md` §6.

## 2026-10-22 — Fixtures refuse on an empty team, but not on unplaced players

*Decided by:* Claude
*Why:* a fixture against a team with nobody in it cannot be played, so a schedule containing one is wrong when it is made rather than on the night. A player who is in the league and on no team is a different thing: a reserve pool is ordinary, and UV's own rule is that players can be added mid-season and claimed later.
*So:* generation names any team with no confirmed players and refuses. Unplaced players are reported by `tdc_league_season_readiness` and block nothing.

## 2026-10-22 — The ruleset gets a version 2 rather than two more keys

*Decided by:* Claude, following the note left in the 15 Oct migration
*Why:* `private.tdc_check_match_rules` refuses a ruleset that is missing a key, and `match.js` reads a match's stored ruleset and sends it straight back when a setting changes — no merge with the defaults in between. Adding `lineup_cutoff_hours` and `strict_frame_order` to the version 1 list would have broken the settings panel on all eighteen matches already played, the first time anyone touched one. The 15 Oct migration had already written the answer down: *"A later version adds its own list rather than editing this one, so a match scored under version 1 keeps its meaning."*
*So:* the check holds two lists and dispatches on `version`. Version 1 (23 keys) is frozen for good; version 2 (25) is what `DEFAULT_RULES` now makes. Nothing rewrites a played match.
*Rejected:* backfilling the two keys onto every existing match (it mutates a ruleset that was frozen on purpose), and making them optional at version 1 (it gives up the guarantee that a ruleset is complete, which is the whole point of the check).
*Follows from it:* every reader goes through `private.tdc_lineup_cutoff_hours` / `private.tdc_strict_frame_order`, so "what does this setting mean on a ruleset that predates it" is answered in one place.

## 2026-10-22 — Team-play settings are hidden by their group, not by a flag

*Decided by:* Claude
*Why:* a lineup cutoff and a strict frame order mean nothing on a social match or a tournament, and `TDCMatchDef` has no idea which kind of thing a form is being built for. Every page already builds its form by looping `GROUPS`.
*So:* the two settings sit in a group called `Team play` which is **not** in `GROUPS`, exported separately as `LEAGUE_GROUPS`. The match panel and the tournament create page skip them without being changed at all; the league pages loop `GROUPS.concat(LEAGUE_GROUPS)`. They are still stored in the ruleset, as version 2 requires.

## 2026-10-22 — A frame can exist before it is played

*Decided by:* Claude
*Why:* a team night's card is a grid that exists from the moment the lineups lock — every slot, both names, nothing played. The three frame statuses all meant a frame that had at least started, so there was no way to write that grid down.
*So:* `pending` joins them. Only a team match ever has one, and everything that counts a score already asks for `status = 'complete'`, so a pending frame adds nothing to anybody's total. What it does is give the scorecard a row to write into.
*Follows from it:* step 5 has to teach `tdc_submit_card` what a pending frame means, because a card with slots nobody has played is not a finished card. Recorded in `docs/STATUS.md` §6.

## 2026-10-22 — The blind exchange is enforced in a function, not a policy

*Decided by:* Claude
*Why:* neither captain may see the other's order until both have locked. A row-level policy able to express that would have to re-implement the lock rule, and then the rule lives in two places and they drift.
*So:* `tbl_league_match_order` has RLS on, no policy and no grant — the same shape as `tbl_league_season_entrants`, which is closed because it carries payment. `tdc_match_lineup` is the only way in, and it returns every slot of both sides with the opponent's **names** withheld, so a captain still sees how much of the other lineup is filled. An empty slot is never a secret.

## 2026-10-22 — Recording a frame falls back to the players it already has

*Decided by:* Claude
*Why:* `tdc_record_frame` took a frame's players from the payload alone. A team frame is given its two players when the lineups lock, and a scorer tapping in a result sends nothing about who played — so recording it failed outright, and would have emptied the frame if it had not.
*So:* when the payload names nobody, the people already in the frame are used. Nothing changes for a singles match, where both sides are filled from the match's own players before this runs, or for doubles, where the page sends the list and wholesale replacement is the point.
*Note:* this is a change to the most used function in the system, found by writing the tests rather than by reading. The original match suites did not survive their container, so `docs/STATUS.md` §1 asks for a real singles match after the push.

## 2026-10-23 — A submission stays an event, not a table

*Decided by:* Claude
*Why:* the design sketched `tbl_match_submission` (match, side, by, at, card_version). All of that already existed in `tbl_match_events`, which is append-only and already carries `card_version` — the shape the founding principles ask for. The only thing missing was which side signed, because in a singles match the submitter **is** the side.
*So:* one nullable `side` column and a partial unique index. No new table, and the card's whole history stays in one place.

## 2026-10-23 — Silence does not settle a team card

*Decided by:* Claude, flagged to UV
*Why:* a singles card is agreed when the dispute window passes with no answer, which is right when one person has seen it and said nothing. A team night wants two signatures, and a captain who never signs has not seen it at all — treating that as agreement would publish a result nobody on that side ever looked at.
*So:* a team card is agreed only when both sides have signed the card as it stands. When a captain will not sign, the league director signs for that side or approves, both of which are already terminal.
*Open:* if a league in practice wants a timer, this is the line to change.

## 2026-10-23 — A permission helper must never return null

*Decided by:* Claude, after finding one that did
*Why:* `private.tdc_can_set_lineup` was `tdc_league_match_side(match) = side or coalesce(can_run_league(...), false)`. For anybody who captained neither team the comparison is null, and `null or false` is null. Every caller asks `if not helper(...) then raise`, and `not null` is null — not true — so the raise never fired and the check passed everyone it was meant to stop.
*So:* the comparison is wrapped in `coalesce(..., false)`. The rule is the general one, not the fix: **a permission helper returns true or false and never null, because every caller negates it.**
*Found by:* writing a test that asserted a stranger was refused. Reading the function had not caught it in two passes.

## 2026-10-23 — Showing interest is confirming, but being confirmed is not

*Decided by:* Claude, from UV's 23 Oct brief
*Why:* two things are now called confirming. `confirmed_at` is the player saying they are playing, which UV made mandatory on 22 Oct. The director confirming somebody off the interested list is the league accepting them. Making a player who went looking for the league, found it and put their own name down then *also* press a confirm button would be asking the same question twice.
*So:* `tdc_league_show_interest` sets `confirmed_at`. A player the director adds by hand still confirms for themselves, exactly as before, and `tdc_confirm_league_entry` now refuses somebody who is only interested — there is nothing for them to confirm until they are let in.

## 2026-10-23 — Suspended is a list, not a setting

*Decided by:* UV
*Why:* taking somebody's place in a league away is a deliberate act with consequences — they come off their team and lose their captaincy. Buried in a status dropdown beside "inactive" it would look like an administrative tidy-up.
*So:* three lists on the director's screen with arrows between them, and suspending is its own column. The function clears team and captaincy when somebody moves to interested or suspended, so the lists cannot disagree with the teams.

## 2026-10-23 — The league pages get their own stylesheet

*Decided by:* Claude
*Why:* the three transfer lists need layout that does not exist, and `forms.css` is the UI chat's shared component layer — adding one page's furniture to it makes it everybody's problem.
*So:* `src/stylesheets/league.css`, loaded only by the league pages that ask for it, every value a token. If the transfer boxes prove worth having elsewhere they move to `forms.css` rather than this file growing.

## 2026-10-23 — Confirmation no longer stops a league starting

*Decided by:* UV, reversing his own rule of 22 Oct
*Why:* on 22 Oct: "Every league player must confirm their participation before the league can begin." On 23 Oct, testing a real league: *"It is not a requirement that every active player has confirmed. I already added my personal profile to the league and marked as a captain. I should be able to start the league regardless."* A director who knows their players should not be held up by somebody who has not opened the app.
*So:* `tdc_generate_league_fixtures` refuses only on fewer than two teams, or a team with nobody on it. Confirmation itself stays, and so does everything that reads it — the readiness panel still names who is outstanding. **It is information, not a gate.**
*Kept:* a team with nobody on it still refuses, because a fixture against an empty team cannot be played. That check no longer asks whether those players have confirmed either.

## 2026-10-23 — A team night's frame count reads every win condition

*Decided by:* Claude, after UV's test
*Why:* `private.tdc_lineup_slots` took the frame count from `win_condition_target` **only** when the win condition was `fixed_frames`, on the strength of a line in `docs/design/leagues.md` saying a team match wants that one. UV's real league is race-to-13 — which is how a mainstream team league is written down — so the function found nothing, fell back to the highest slot anybody had used, found none of those either, and returned zero. The card drew one frame and the order could not be set. *"After setting who is here tonight where I marked everyone as yes, I only see Frame 1 for the order."*
*So:* the count answers for every win condition. `fixed_frames` and `best_of` give their target; `race_to` gives **2N−1**, because a team night plays its whole card rather than stopping the moment one side gets there; a timed or free-play night gets one slot per player on the fuller side. **It is never zero** — a night with nobody marked present still has a first slot, and the slot guard reads this same number to decide what exists.
*Rejected:* reading the target regardless of win condition, which would have given UV's league 13 slots instead of 25 and quietly halved a real card.
*Noted:* the design's line was advice about which win condition suits a team night, not a claim that the others cannot be counted. Reading advice as a constraint left a league that was set up sensibly with a one-frame card and no explanation.
*Superseded in part:* once sessions exist the count comes from the **team size** (five-man → 25); this stays as the fallback for a league with no team size set.

## 2026-10-23 — The order is one row per position, not one per frame

*Decided by:* UV
*Why:* what was built on 22 Oct asks a captain to fill all 25 slots of the night by hand. That is not how a team league works. UV: *"Captains don't set the lineup on every frame. The scorecard carries a specified order of play based on the order of the first round-robin session. So, as a captain, I set the order on the first 5 frames and then the rest of the night is worked out from there."*
*So:* a team night is **sessions**. Session size is a league setting — a floor number of players in a team — so a five-man league plays five frames a session, five sessions, 25 frames, and `frames = team_size²`. A captain names the first session only; every later session derives from it by **the LD's rotation table**, which they define when designing their scorecard. `tbl_league_match_order` becomes one row per position per side. Frames may still be played out of order.
*Reserves:* a reserve never changes the session size or the frame count — it fills a position for **one session**. A five-man team with six players has five players play four frames and one play five. Three rules: one frame per player per session; a player locked in on the team lineup keeps the same position every session; a reserve may not face the same opponent twice. The captain marks each change themselves — *"2 changes is not much to ask for."*
*Unchanged:* the blind exchange. Neither side sees the other's order until both have locked.
*Not this:* pre-determined breaks per session, which exist in other formats and are an LD edge case for later. Who breaks is already the LD's setting, and this league is lag winner every frame.
*Open:* whether the rotation table is the LD's to define with a cyclic-shift default, or one fixed standard table. `docs/STATUS.md` §1 item 0.

## 2026-10-23 — Development moves to Claude Code, and the documentation shrinks to an index

*Decided by:* UV, from the project-wide audit
*Why:* every new chat read about 290 KB before starting (a 171 KB `CLAUDE.md`, this log, the agenda, the design, and the project docs), which cost a large share of each week's usage, and the agenda had begun to drift within hours. Working through the chat app also meant no shell, files staged one at a time, test suites lost with every container, and two chats able to overwrite each other.
*So:* development runs in Claude Code inside VS Code on UV's laptop, with commit and push blocked in `.claude/settings.json` so committing stays UV's. `CLAUDE.md` is a short index read every session; each system's detail moved word for word into `docs/systems/`, read only when the work touches it. The project docs the code needs moved into the repo (`docs/ui.md`, `docs/test-plan.md`, `docs/BACKLOG.md`); retired design records went to `docs/archive/`. Tests go into `supabase/tests/` so they survive. Business to-dos live on the owner board, not in these files. One chat at a time.
*Rejected:* keeping parallel chats with a "files in flight" table (it relied on every chat remembering to update it); a git branch per chat (UV works on one thing at a time, so it adds merging for nothing).
*Touches:* `CLAUDE.md`, `docs/`, `.claude/settings.json`

## 2026-10-23 — Tests run on a local Supabase in Docker, kept identical to production

*Decided by:* UV (Docker over PostgreSQL for Windows), Claude (the rest)
*Why:* the migrations lean on Supabase's own pieces — `auth.users` and `auth.uid()`, storage buckets and their rules, the realtime publication, the API roles and their grants. Plain Postgres would need hand-written imitations of all of them, and a test passing against an imitation proves nothing about production.
*So:* Docker Desktop runs the Supabase CLI's local stack; `npx supabase db reset` rebuilds it from every migration and `npx supabase test db` runs the pgTAP files in `supabase/tests/`. The first build failed on migration `20260925065614`, because two things in production were made by dashboard settings, not migrations: the Auto-RLS function and event trigger, and the default grants that keep new tables unexposed. Without the second, every table was writable by `anon` locally. Both are copied from production's catalogue into `supabase/roles.sql`, which the CLI runs before the migrations locally and `db push` never sends. `supabase/scripts/schema-fingerprint.sql` compares the two databases category by category; all 11 matched on 23 Oct.
*Rejected:* a new migration to create the Auto-RLS function — it would be pushed to production, where the function already exists, and would be out of order. Editing `20260925065614` — it is applied.
*Touches:* `supabase/roles.sql`, `supabase/tests/`, `supabase/scripts/schema-fingerprint.sql`, `docs/systems/tests.md`

## 2026-10-23 — A settled card is final for the players; only the people running a competition can open it again

*Decided by:* UV
*Replaces:* the 15 Oct rule in migration `20261015180000` — "Nothing becomes permanent. Either player can reopen a card." UV believed this had already been settled the other way in an earlier chat; it was never written down, so the code kept the 15 Oct rule.
*Why:* the players chose how their card is approved when they set the match up. That choice is the agreement: once it has run its course the result stands. UV: *"if they chose 48 hours for example, then the card is locked forever after that. A player should then only be able to raise a dispute within the window."*
*So:*
- **Social, dispute window.** Until the other player answers or the window closes, they may agree or dispute (a dispute reopens it for fixing), and the submitter may withdraw. Once the other player agrees, or the window closes, it is locked for good. **Agreeing early locks it** — the window is how long there is to answer, not a period during which an agreement can be taken back.
- **Social, no approval.** Locked for good on submission. A mis-tap on the deciding frame is covered by the page's "Submit the card?" prompt, and that is enough.
- **Tournaments and leagues.** Players cannot reopen a settled or published card. The TD or LD can: their **send back really unlocks it** so the players can fix it and resubmit, and they may still correct frames themselves.
*Rejected:* either player reopening (the 15 Oct rule — a result the other side agreed to could be reopened a week later by one person); both players agreeing to reopen (a new request step for little gain); venue staff reopening social matches.
*Touches:* `tdc_reopen_card`, `tdc_reject_card`, `private.tdc_published_at`, the Reopen button in `match.js`, `docs/test-plan.md` 7.5 and 11.3, `docs/BACKLOG.md` row C

## 2026-10-23 — Players may still delete a settled social match

*Decided by:* UV
*Why:* raised alongside "a settled card is final for players". Reopening a settled social card is refused, but deleting the whole match is a different act and stays the players' choice: a social match belongs to the two people who played it.
*So:* `tdc_delete_match` is unchanged for social play — either player, anything not sanctioned, settled or not. Competition matches are a separate matter (`docs/STATUS.md` A1: only the people running it).
*Touches:* `tdc_delete_match`

## 2026-10-23 — The rotation table is the LD's, with a cyclic shift as the default

*Decided by:* UV, answering `docs/STATUS.md` §1 item 0
*Why:* a club joining the platform already has a printed scoresheet with its own pattern of who meets whom in each session. One fixed table nobody may edit would make that club change how it plays to fit the software.
*So:* the rotation table is stored per league. A new league gets the cyclic shift: session 1 is H1–A1 … H5–A5, and each later session moves the away column up by one, so every player meets every opponent once. An LD may state their own table on the settings page. It is a ruleset key, so it is **frozen onto each match** like every other rule — an LD editing the table on Wednesday cannot reshuffle the rest of Tuesday's half-played night.
*Rejected:* one fixed standard table. Simpler, but going from it to a stored table later would be a schema change.

## 2026-10-23 — A league rule change reaches the matches that have not started

*Decided by:* UV, from Claude's proposal (replacing the earlier "refuse a change that would shrink a card")
*Why:* rules are frozen onto a match when it is created, so changing a league's rules touches no existing match at all. UV's race-to-13 league, switched to fixed-25, would still have two race-to-13 matches already sitting in its fixtures. Refusing the change would stop a director editing their own league; ignoring the existing matches would leave the switch half-done without saying so.
*So:* when the LD changes the league's rules, every match in it with **no frames and no locked lineup** takes the new rules. A match with frames, or with a side locked, keeps its frozen rules, and the page says how many kept them. A single match can still be corrected through its own settings. Recorded frames are never rescored.
*Rejected:* refusing the change while any match would shrink with frames recorded — it can stop a director in their own league over one played match.

## 2026-10-23 — The orders already recorded are kept, not cleared

*Decided by:* UV
*Why:* production held five order rows when this was decided: one side of one TestTuesday match, slots 1–5, unlocked, no frames. Slots 1–5 are exactly session 1, positions 1–5 — the new shape — so keeping them is a relabel, not a translation.
*So:* the migration that changes `tbl_league_match_order` to one row per position keeps the rows, and stops with a message rather than guessing if any side is locked, any frame exists, or any slot lies beyond the team size when it is pushed.
*Order of work:* the LD settings page first (team size and the rotation table live there), then the session rework.

## 2026-10-23 — A rotation table may repeat a pairing, with a warning

*Decided by:* UV
*Why:* a table where everybody meets everybody once is the usual shape, but it is the LD's scoresheet, and a format that repeats a pairing on purpose should not be locked out by the software.
*So:* each session must still use every away position exactly once — design rule 1, *a player may not play more than one frame in a session*, which is a hard check in the database. A table where somebody meets the same opponent twice across the night is **allowed**, and the settings page warns and names the repeats before it saves.
*Rejected:* refusing repeats outright (Claude's proposal).

## 2026-10-23 — Team size and the win condition are separate settings

*Decided by:* UV
*Why:* they answer different questions. The team size says how long the night is; the win condition says who has won it.
*So:* with a team size set, the card is `team_size²` frames (five-man → 25), whatever the win condition says. The win condition and its target are the LD's own and are not filled in or cross-checked. With no team size set (0), the card length falls back to the win condition, as it has since 23 Oct.
*Rejected:* the team size filling in the target and refusing a mismatch (Claude's proposal).

## 2026-10-23 — Putting your name down does not confirm you

*Decided by:* UV, reversing Claude's "Showing interest is confirming, but being confirmed is not" above
*Why:* testing a real league, UV moved the whole Name Down list into the league and every player arrived confirmed. *"They should not be confirmed until LD says so (as set in the settings)."* Claude's reasoning had been that a player who goes looking for the league and puts their name down has said they are playing; in practice that took the confirmation out of the league's hands.
*So:* migration `20261023201147`. Name down never confirms. In a league that confirms on payment, the paid tick confirms. Otherwise the player confirms on the season page once they are let in, and being let in now tells them so. **A self-confirm league with no payment step is the one exception:** joining is the confirmation, because there is no other step for it to wait on (UV).
*Rejected:* the director confirming by moving a player in, or by a separate tick of their own — UV kept confirmation as the player's own word.

## 2026-10-23 — A maximum number of players per team

*Decided by:* UV
*Why:* nothing limited a team's roster, so a five-man card offered the whole league as reserves. *"We need to set a max limit on reserves in a team (or a max amount of players per team)."* A seven-player limit in a five-man league means two reserves.
*So:* a league setting, **required when the league is created**. It **binds captains only**; the LD may place a player past it, for an emergency signing. **Lowering it below a team's current size is allowed**: that team keeps its players but cannot add anyone until it is under the limit, and the page warns which teams are over.
*Rejected:* refusing a lower limit until teams shed players; binding the LD too; no limit until one is set.
*Reshaped the same night:* the next entry says how the limit is set and what counts.

## 2026-10-23 — A team's limit is its team size plus its reserves

*Decided by:* UV, from Claude's proposal of a plain maximum
*Why:* the number a league actually talks about is reserves. *"For normal leagues, we have 2 max."* A plain maximum would also have to be kept above the team size by hand, and a team may play short anyway (down to one player, who need not be the captain), so the team size is not a minimum to defend.
*So:* migration `20261023213048`. **Reserves allowed** is a **season** setting (seasons can differ), default 2, 0 to 10, 0 meaning no subs. A team's limit is `team_size + reserves`, so a five-man league with two reserves holds seven. **Only active players count.** A player who is away for a while (work, injury) is marked inactive by themselves, their captain or the LD. They keep their place on the team, cannot be picked for a squad, and free a place, so a captain can recruit someone in their stead. Coming back is bound by the limit like a claim is. The LD is bound by neither. From the earlier entry, unchanged: lowering the limit below a team's size is allowed, and the page warns.
*Example:* Team 0 has seven active. Ben goes away for work; the team is 6 of 7, the captain claims Gus. Ben is back a month later: refused, *"Team 0 is full: 7 of 7 active players. Mark somebody away first, or ask the league director."* The captain marks Gus away, then Ben back.
*Rejected:* a plain max players per team (Claude's first proposal); counting inactive players too (a player who is away would block their own replacement); putting the setting on the league (a season with a different shape would need the league changed and changed back).

## 2026-10-23 — Every league has a team size

*Decided by:* UV
*Why:* the limit above adds reserves to the team size, which means nothing at 0, and the session rework would otherwise need a second shape of lineup for a league with no sessions. No league UV knows plays without a fixed team size.
*So:* a league's merged rules must have a team size from 2 to 10 (`private.tdc_check_league_rules`, on create and on every change of a league's or season's rules). **0 stays valid in a ruleset**, for singles matches and tournaments, where it is what `DEFAULT_RULES` carries and the Team play group is never shown. The team size control on the league pages starts at 2.
*Rejected:* keeping 0 for leagues, with the LD setting a plain maximum instead of reserves.

## 2026-10-24 — An empty seat stays open until the card is signed

*Decided by:* UV (option b)
*Why:* the 22 Oct build wrote a walkover the moment both lineups locked, so a fifth player stuck in traffic could not play any of their frames. The design had always said an unfilled slot's walkover is "materialised at submission, not before"; the build did not follow it.
*So:* migration `20261023221049`. A position filled on one side only gives a pending frame with one player in it. A reserve or a latecomer can be put into it. When a captain signs, any seat still empty becomes a walkover to the side that turned up, **before** the signature is recorded, so the version signed is the card with its walkovers in it. A pairing empty on both sides still has no frame.
*Rejected:* walkovers at lock (what was built).

## 2026-10-24 — The three reserve rules, as enforced

*Decided by:* UV, confirming Claude's reading of design §3
*So:* a reserve goes into one frame, which is one position in one session, through `tdc_swap_frame_player`. (1) Nobody plays two frames in a session. (2) A player in tonight's order keeps their position: only someone **not** in the order can come in, and a position's own player can be put back, which undoes a reserve. (3) A reserve never meets the same opponent twice in the night. Each refusal names the rule. A regular meeting someone twice because the LD's rotation repeats a pairing is still allowed (23 Oct).
*Example:* Team 0 is Ann, Ben, Cal, Dee, Eve; Gus is the reserve. Gus covers Ben in session 3, so he can't also cover Dee in session 3. Ann can't move to position 4 to cover Dee. If Gus met their A3 in session 2, he can't take a frame against A3 in session 4.

## 2026-10-24 — A competition match's rules and time are the director's; the lag winner stays with the players

*Decided by:* UV (from the audit, A2 and A3), with the lag winner on Claude's recommendation
*Why:* in a tournament a player could change their own match's rules after it was approved, for example turning approval off, which unpublished the result. On a league match, moving the time also moved the lineup cutoff.
*So:* migration `20261024082447`. In a tournament or league, only the people running it change a match's rules or time, and nobody does once the result is settled or approved; a director sends it back first. **Who won the lag is not a rule.** It is recorded by whoever may score, and goes through the same function with the rules unchanged, so it is let through. Referees and scorers are treated as players: they score, they don't change rules.
*Example:* in Test Tournament - 2, UV (a player and its scorer) can tap who won the lag in his match against Linton, but the race length and approval are greyed out. Owner@TDC, its director, can change both until the result is approved.
*Rejected:* the lag winner directors-only as well (players lag at the table, and the director is often not there).
*Touches:* `tdc_update_match_settings`, `tdc_set_match_time`, `private.tdc_can_change_match`, `match.js`

## 2026-10-24 — A team frame's players change only through the reserve picker

*Decided by:* UV (audit A4), choosing the "three taps" correction over a second route
*Why:* `tdc_record_frame` accepted a list of who played, and on a team card nothing checked it. Being in a frame grants edit rights, so a hand-made request could seat an outsider who could then score the match, put a player in the other side's seat, or replace a player's own opponent. Checking each named player against the team (the audit's first suggestion) would still have let a captain skip the three reserve rules and reach the other side's seat with a real team member, and it would have refused frames whose player has since changed team.
*So:* migration `20261024084837`. On a team card `tdc_record_frame` never changes who is in a frame and never makes one. `tdc_swap_frame_player` is the one way into a team frame. A league director correcting who played a **finished** frame clears the result, puts the right player in with the picker, and records it again.
*Example:* Ann is recorded as winning frame 7, but Gus played it. The LD presses Clear result on frame 7, chooses Gus in the picker, and presses Hosts won.
*Rejected:* letting the league director (only) send a changed list through `tdc_record_frame`, each player checked against their team — more code, and a second way in that skips the reserve rules.
*Touches:* `tdc_record_frame`

## 2026-10-24 — In a walk-in merge, a clash keeps the account's row

*Decided by:* UV (audit A5): *"Always keep account's and remove walk-in."*
*Why:* the merge moves everything from the signup record (the account's) onto the walk-in record. Where both have a row that cannot coexist (a notification setting for the same category, places in the same match's squad or lineup), one has to go. The account's is the person's own recent choice; the walk-in's was typed by staff, or written some other way.
*So:* migration `20261024090641`. The account's setting wins. In any match where the account is in the squad or lineup, the walk-in's squad row is deleted and its positions emptied, which is what a captain clearing a position leaves. The merge never fails on a duplicate there. A walk-in cannot reach these tables through any function, so this covers direct writes only.
*Example:* Ken's account is at Hosts position 1 in Tuesday's match and has league notifications off. His walk-in record somehow sits at Guests position 2 with them on. After the link, Ken is at Hosts position 1, Guests position 2 is empty, and league notifications are off.
*Rejected:* refusing the merge on a lineup clash with a plain message (Claude's recommendation, matching the existing "played each other" guards).
*Touches:* `private.tdc_merge_players`

## 2026-10-24 — A league season's status is set by its director

*Decided by:* UV
*Replaces:* the 22 Oct rule "no status column on a league season; derive it from the fixtures" (`docs/systems/leagues.md`).
*Why:* the leagues list wanted a status colour and the search a status filter. Claude offered a status derived from the fixtures and dates; UV: *"Status should be something set by LD. We should include things like on break (maybe for holidays)."* A break is something only the director knows; no fixture says it.
*So:* migration `20261024102616`. `tbl_league_seasons.status`, one of taking entries (the default), running, on break, finished — *"we will add more later"*. Set on the settings page through `tdc_set_league_season_status`, by whoever may run the season. Seasons that already had fixtures started as running. It colours the strip on `/leagues/` and the edge of a search tile, and the search filters by it.
*Rejected:* deriving it (taking names / under way / finished) from fixtures and dates; a status that is only how you get in (join now / name down).
*Touches:* `tbl_league_seasons`, `tdc_set_league_season_status`, `tdc_my_leagues`, `tdc_search_leagues`, `league-settings.js`, `leagues.js`

## 2026-10-24 — Singles leagues should exist

*Decided by:* UV
*Replaces, once built:* "Every league has a team size" (23 Oct), which made a team size of 2 to 10 compulsory.
*Why:* UV wants the league search to filter team leagues from singles leagues, and a singles league is a league like any other.
*So:* a team size of 1 will mean singles. **Not built**: it reaches lineups, the card, the team limit and the rotation, so it is its own piece of league work (`docs/STATUS.md` §3). The search's team / singles filter is built already and finds no singles league until then.

## 2026-10-24 — Every page fills ten of twelve columns on a PC, and everything stretches

*Decided by:* UV
*Why:* every page was a 400px column whatever the screen (`docs/ui.md` §2, "Make it work on a PC"). UV: *"up to 1:10:1 if that makes sense (bootstrap logic)"*, then *"Let the 1:10:1 rule apply across the site for desktop."*
*So:* from 992px (Bootstrap's large breakpoint) every `.tdc-card` is `calc(100% * 10 / 12)` wide, with a column's margin either side. Fields, buttons and tables stretch with it, forms included. Phones and tablets keep the column. `/match/`, the home page and the owner board have their own layouts and are unchanged.
*Rejected:* fields kept to 400px inside a wide page (Claude's recommendation); widening only list and table pages.
*Touches:* `forms.css`

## 2026-10-24 — The league search shows every status, but only leagues you can get into

*Decided by:* Claude, following UV's status filter
*Why:* a status filter is pointless if the search can only ever return leagues taking entries. But the search was built (23 Oct) to show only listed leagues a player can get into, because "a league in the results that nobody can join is a dead end with a name on it".
*So:* `tdc_search_leagues` returns listed seasons whose entry is not LD-only, whatever their status, and the filters narrow that. A running league that still lets players put their names down is found under Running.
*Rejected:* showing LD-only leagues too, which is a separate question about whether the search is for joining or for browsing.

## 2026-10-24 — Custom controls wrap the real input, and a page opts in with data-control or data-controls

*Decided by:* Claude, from UV's brief
*Why:* UV wants every number field on the site to become a pill with chevrons, keeps all the behaviour global, and is designing more controls with their own looks and behaviour. Each of those wants a place to go that no page has to know about.
*So:* `scripts/tdc-controls.js` and `stylesheets/controls.css`, both loaded on every page by `layout.html`. A control is the page's own `<input>` with `data-control="<kind>"`. The script builds the furniture round it and leaves the input as the thing pages read: `.value`, `input` and `change` work as before, and a button press fires both events as typing would. Each new kind is one `define()` in that file. **`data-controls="<kinds>"` on a container** switches every element inside it that a kind takes, including ones rendered later, which is how the generated ruleset dropdowns opt in without touching `TDCMatchDef`'s shared `control()`, and how the whole site will switch once the layouts are agreed. `data-control="none"` keeps one native. Kinds: `stepper`, `date` (three steppers over the real date input), `select` (the horizontal pill over the real select, which keeps the keyboard). All on trial on `/leagues/new/` only until UV decides where each goes. Every size and colour is a token, edited on `/sandbox/`.
*Rejected:* a Web Component (`<tdc-number>`), which every page script would have to learn to read; styling the native spinners, which browsers barely allow; adding `data-control` inside `TDCMatchDef.control()`, which would have switched every page that uses it at once.
*Touches:* `tdc-controls.js`, `controls.css`, `layout.html`, `forms.css` (the field glow skips custom controls), `variables.css`, `sandbox.js`

## 2026-10-24 — The custom controls are site-wide, except tables and long lists

*Decided by:* UV ("implement our new elements site-wide"); what stays native, Claude
*Why:* the stepper, the date and the select pill were tried on the new-league page and UV wanted them everywhere.
*So:* `<body data-controls="stepper date select">` in `layout.html`: every number field, date field and dropdown on the site, including those scripts render later. **Kept native:** anything inside a table, where the cells are too narrow; long lists of people or teams (`data-control="none"`: the captain's card's pickers, the bracket's swap picker, the fixtures' home and away), which as a pill would scroll on for dozens of names; and the bracket's two score boxes, which sit in one line between the names and need a design of their own. Date-and-time fields have no control yet. The `/leagues/` filters went from three narrow columns to one a row on a phone, because a pill needs room to show its options.
*Rejected:* switching page by page, as first planned: UV chose all at once.
*Touches:* `layout.html`, `tdc-controls.js`, `controls.css`, `forms.css`, `league.css`, `league-card.js`, `tournament-bracket.js`, `leagues/fixtures`, `leagues/new`, `leagues/settings`

## 2026-10-24 — Checkboxes are the ring status design; their load time is the save

*Decided by:* UV (the design, the switch-or-ring split, fixed draw and fade, labels beside, rings in tables, every icon drawing itself); the mechanism, Claude
*Why:* UV designed the ring status component for toggles and checkboxes across the site, with the load time "dependent on the site making its online calls" and 1 s where loading is irrelevant.
*So:* every checkbox is a switch (a setting: tick on, cross off) unless made `data-control="ring"` (a tick against a person or a thing: tick or empty). Draw 0.8 s, fade 0.5 s, fixed tokens. The load is measured, not set: `supabaseClient.js` creates the client with a counting fetch (`TDCNet`), and a box whose change made the page ask the database draws its answer once the network has been quiet for 150 ms, which includes the page's re-read, so what is drawn is what was kept; one that asked nothing orbits for 1 s. Pages rebuild after a write, so the live control is handed to the new checkbox by its id or data attributes. The chevrons, calendar, cross and select arrows draw in and out stroke by stroke in the same draw time, without dots.
*Rejected:* a fixed load time for saving boxes; each page telling the control when its save finished (every save handler edited, and a new one forgotten); wrapping `rpc` alone (it returns a builder that is chained and awaited later, and the fetch starts after the sign-in token); dots drawing the chevrons after 1 s (a chevron would take about 1.8 s to come back).
*Touches:* `ring-status.js`, `status.css`, `supabaseClient.js`, `tdc-controls.js`, `controls.css`, `variables.css`, `layout.html`, `sandbox`, `league-manage.js`, `tournament-manage.js`, `league-card.js`

## 2026-10-24 — Quick input is queued, never turned away

*Decided by:* UV ("accept quick inputs on the ring controls. Do not ignore", "implement queueing so that it feels seamless … site-wide"); the mechanism, Claude
*Replaces:* the "one write at a time, so two clicks cannot race" busy flags in every page script, which dropped a second click without saying so, and the ring ignoring clicks while it drew (from UV's demo).
*Why:* a director ticking Paid down a list, or a player tapping frames, had input silently lost.
*So:* `TDC.queued` is one write queue per page; `TDC.writer` runs saves through it in order and reads the page again once a burst has finished; errors are kept and shown after that re-read. A big action passes `{ single }`, so a double tap does it once. The ring accepts every click and draws what the database ends up holding. On `/match/` each queued save checks the card against the version read straight back after the save before it, so the protection against a second scorer stays and a real conflict stops the rest of the burst. A box that saves orbits on a 0.2 s profile (`--ring-min`), re-timed a moment after the click; UV: "I don't mind a long load time if the animation actually shows it still happening."
*Rejected:* re-reading after every queued save (ticks flicker back while the others save); counting card-version bumps by hand on the match page (not every write moves it by one); only lowering the earliest the dot may leave (the dot still had to come round on the 1 s orbit, so nothing changed: measured).
*Touches:* `tdc.js`, `match.js`, `league-manage.js`, `league-fixtures.js`, `league-season.js`, `league-join.js`, `league-card.js`, `tournament-manage.js`, `tournament-bracket.js`, `tournament-poster.js`, `push.js`, `ring-status.js`, `tdc-controls.js`, `variables.css`, `sandbox.js`

## 2026-10-24 — Beside-controls line up on the centre line; fields fade in and out; only the touched control moves

*Decided by:* UV
*Replaces:* "the control and its words are one pair centred in the row" (earlier the same day).
*Why:* centred pairs zigzagged down the page; toggling one switch redrew the icons of every other control, because the ruleset pages rebuild their whole form; fields shown and hidden by settings jumped.
*So:* a beside-control's right edge sits on the page's centre line, its words to the right; a control wider than half the row moves the line for its row only, so the two dates of a pair line up. Icons are remembered by field, so a rebuild redraws none that were already showing. `tdc-controls.js` compares the form before and after each change and fades new fields in (icons drawing, switches and rings running a short orbit) and gone ones out in place, for every page, with no page edits.
*Rejected:* a morph helper each page calls around its rebuild (every rebuilding page edited, and the next one forgotten); fitting the date into half a phone's width by shrinking it (too small to tap on a 360px phone).
*Touches:* `tdc-controls.js`, `controls.css`, `variables.css`, `sandbox.js`

## 2026-10-24 — A save's ring draws the moment the call is back

*Decided by:* UV ("The point of the animation being set to curve is that it doesn't have to actually meet the point to start drawing. Let the drawing truly start when the load is done.")
*Replaces:* the 0.2 s re-timed orbit (`--ring-min`, `RingStatus.retime`) from earlier the same day, which still made the lead dot come round to a set exit point.
*So:* `resolve(target, { now: true })`: every dot leaves from where it is, on the demo's curved exit, to the stroke start nearest it. A box that saves uses it as soon as the network has been quiet for 50 ms (down from 150; the gap it guards, a page's re-read starting after its write, is a few milliseconds). Measured with a 50 ms save: dots leave at 0.21 s (from 1.37 s with the 1 s profile). A box in a form keeps the demo's timing, 1 s.
*Touches:* `ring-status.js`, `tdc-controls.js`, `supabaseClient.js`, `variables.css`, `sandbox.js`

## 2026-10-24 — Draw 0.4 s, fade 0.1 s, spin 2x; the dots leave together and the knob moves with them

*Decided by:* UV
*So:* `--ring-draw` 0.4 s (from 0.8) and `--ring-fade` 0.1 s (from 0.5). The draw time is shared with the chevrons, calendar and cross drawing themselves, so those are quicker too. UV saw a switch stutter between loading and drawing: its knob followed the strokes drawn, so it stood still while the dots flew off the ring to the strokes, then lurched. `onProgress` now follows the dots along their whole paths with their easing; and every dot now leaves at once (`resolve` `together` at the load time for a form box, `now` for a save), because with the demo's timing each dot waited for its own exit point, so the knob started with the first and jerked forward as the others left (UV: "the circle starts moving before the load is actually done"). Measured on a form switch: all four dots leave at 1.05 s and the knob glides, each frame's step shrinking steadily, done 0.42 s later; a saving switch the same at the end of its call; unticked rings fade their dots together. Then UV: "since we are using real load times, we can adjust dot speed at the start. Lets set it to 2x": `load({ spin })` multiplies the demo's orbit speed, `--ring-spin: 2`; measured 249 to 498 degrees a second turning a switch on, 306 to 612 turning it off, the dots still leaving together when the call is back.
*Touches:* `ring-status.js`, `tdc-controls.js`, `variables.css`
