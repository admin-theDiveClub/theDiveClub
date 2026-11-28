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

## 2026-10-24 — The ruleset form in UV's five sections; folding groups animate

*Decided by:* UV (the sections, the order, what sits side by side, the lines, which fold); the mechanism, Claude
*Replaces:* the groups This match, Format, Results, Timing, Officials and approval, and the main settings being win condition, target, record who breaks, breaks and the lag winner.
*Why:* the grouping did not match how a director thinks about a match: breaks were split between Format and Results, and the lag winner sat apart from the break settings it belongs with.
*So:* `GROUPS` is Format (open: discipline, win condition and target), Match settings, Timing, Officials and approval (folded). The lag winner sits between record who breaks and breaks; if level goes under draws allowed; the referee goes under referee required. A setting's `row` puts it beside its neighbours and `rule` draws a line above it, through one `TDCMatchDef.layout()` every page calls, so a page cannot lay the groups out differently. Opening and closing a group by hand fades and grows as fields shown by a setting already did, in `tdc-controls.js`, with no page edits. The match page's panel keeps one setting a line (`rows: false`).
*Rejected:* a layout list per page (six copies to drift); fitting rows by shrinking labels (they wrap instead, and a subgrid keeps the controls in line).
*Touches:* `match-settings.js`, `tdc-controls.js`, `forms.css`, `match.js`, `match-new.js`, `tournament-new.js`, `tournament-bracket.js`, `league-new.js`, `league-settings.js`

## 2026-10-24 — A match can have its own referee, picked from the players

*Decided by:* UV (who may be picked, what they may do, who sets it, the picker; then: a player may be their own referee, a removed referee gives the frames back, no notification, the match list shows it)
*Why:* "Referee" was a text box on the match page that saved nowhere (`stored: false`). Referees existed only as officials of a whole tournament or league season.
*So:* migration `20261024162559`. `tbl_matches.referee_player_id`. Anyone with an account may be picked, in social and competition matches alike, including a player in the match. The referee scores exactly as a tournament referee: rank 50, outranking the players, and the director still outranks them. Whoever may change the match's rules sets it (either player of a social match, the director of a competition match, nobody once settled); somebody who is only the referee cannot. When a social match's referee is removed, the players can change the frames the referee set. Nobody is notified. The referee sees the match in their match list, tagged Referee. Followed from it (Claude): a league director is rank 100 on their league's matches, or they could not correct a referee's frames there.
*Example:* Rae referees Alice v Bob. Alice records frame 1 as hers; Rae corrects it to Bob's; Alice can no longer change frame 1 ("last set by the referee"), but can still record frame 2. Bob removes Rae as referee, and Alice can change frame 1 again.
*Rejected:* refusing a player as their own referee (Claude's recommendation); notifying the referee (Claude's recommendation); keeping a removed referee's frames protected.
*Touches:* `tdc_can_edit_match`, `tdc_score_rank`, `tdc_frame_rank_guard`, `tdc_can_change_match`, `tdc_set_match_referee`, `tdc_search_referees`, `tdc_my_matches`, `tdc_merge_players`, `match-settings.js`, `match-new.js`, `match.js`, `matches.js`, `forms.css`, `match.css`

## 2026-10-24 — The fixtures page is a planner; a fixture is added to the chosen night

*Decided by:* UV (the planner, the calendar, home | menu | away, the menu's actions, the team icon and player count, All fixtures with filters, adding to the chosen night); the mechanism, Claude
*Replaces:* the schedule as one folding box per round, each fixture's buttons under its names, and Add a fixture as its own panel with a round number.
*Why:* a director plans by the night, not by round number, and wants the week's games in front of them with the actions out of the way.
*So:* Add a fixture sits under the chosen night and adds to that night's round at its time (the most common among its fixtures), or to a round with no date, or to New round (the next round number, no date). There is no round box. Rounds with no date cannot be marked on a calendar, so they are offered as buttons under it.
*Example:* Wednesday 4 November is Round 2 at 19:30. Choose it, pick Cue Tips v Chalk Dust, Add it: the fixture is Round 2, 4 November, 19:30, and appears in that night's table.
*Rejected:* keeping the round number beside Home and Away (UV first asked for that, then moved Add a fixture under the night instead).
*Touches:* `leagues/fixtures/index.html`, `league-fixtures.js`, `league.css`

## 2026-10-24 — Several matches a night per team, and a fixture's tables

*Decided by:* UV (matches per team per round, tables per match, table numbers under each fixture, changeable); how the numbers run, Claude
*Why:* some leagues play each team twice on a night, and a venue wants each game on named tables.
*So:* Matches per team per round puts that many passes of the round robin into one night and one round number; Days between rounds counts nights. Tables per match numbers each fixture's tables, **restarting for each pass of the night** (a team's second match follows its first, so the tables are free again); a bye has none. A fixture added by hand gets the night's next free numbers, as many as its other fixtures have. Numbers are stored on the fixture (`table_numbers`), changed with steppers on their side, and saved a moment after the last change.
*Example:* six teams, 2 matches a round, 2 tables a match: round 1 has six fixtures, the first three on tables 1-2, 3-4, 5-6 and the next three on 1-2, 3-4, 5-6 again. Adding a seventh to that night puts it on 7-8.
*Rejected:* unique tables across the whole night (they would run to 12 for six teams playing twice, which no venue has); numbers worked out on the page from position (lost the moment one is changed by hand).
*Touches:* migration `20261024191110`, `league-fixtures.js`, `leagues/fixtures/index.html`, `tdc-controls.js`, `controls.css`, `league.css`, `variables.css`, `sandbox.js`

## 2026-10-24 — Table numbers run on through the night

*Decided by:* UV
*Replaces:* the numbering in "Several matches a night per team, and a fixture's tables" above, which restarted the tables at each pass of the round robin.
*Why:* restarting put a team's second match back on the tables of its first whenever it held the same place in both passes. UV: every match on a night gets different tables by default, and a team should not play all its matches on one table; the director changes numbers by hand if the venue needs otherwise.
*So:* Generate numbers every fixture of a night on from the last: with 2 tables a match, {1,2}, {3,4}, {5,6}… Since no two fixtures of a night share a table, a team playing twice is on different tables each time. A fixture added by hand already took the night's next free numbers.
*Example:* six teams, 2 matches a round, 2 tables a match: round 1's six fixtures are on 1-2, 3-4, 5-6, 7-8, 9-10, 11-12. Alpha plays on 1-2 and later on 9-10.
*Rejected:* reusing tables across passes while shuffling which team gets which (it still needs a venue's table count to be worth anything, and nothing records that).
*Touches:* migration `20261024194237`, `032_league_fixture_tables.test.sql`

## 2026-10-24 — The season page leads with the league; a team's name opens it

*Decided by:* UV (the banner, the numbers, pictures and profile links, team names opening the season page); the layout, Claude
*Replaces:* "Ready to begin?" on the season page, and team names linking to a separate team page (made earlier the same day, never built).
*Why:* a player opening a league wants to see what it is, how it is going and who is in it; a team is best seen among the others, on the page that already lists them.
*So:* the season page opens with a banner (the league's picture, name, season, status, and how it is played, the venue linked) and the league's numbers, counted from the fixtures and teams. A team's name anywhere on the fixtures page opens the season page with that team expanded and in view. Every player and official shows their picture and links to a player page; the venue links to a venue page; both pages say they are not built yet. How many have confirmed, which "Ready to begin?" said, is now one of the numbers, for the people who could see it before.
*Rejected:* a separate team page for now (UV: on the list for another time).
*Touches:* migration `20261024195612`, `league-season.js`, `leagues/season/index.html`, `league-fixtures.js`, `league.css`, `venues/index.html`, `players/index.html`

## 2026-10-24 — A league's pages are one pill at the top of each

*Decided by:* UV (always there, every page, a horizontal pill); who sees which, Claude
*Replaces:* the links at the foot of each league page, different on each and some shown only to the director.
*So:* the season, fixtures, manage, settings and card pages share one bar at the top: Season, Fixtures, Run it, Settings, New season, All leagues, the current page in the green pill, scrolling sideways on a phone. Run it, Settings and New season are offered only to the people running the league; to a player they would only be refused.
*Rejected:* showing every page to everybody (a player would meet a refusal); a menu that opens (UV asked for the pill, not a dropdown).
*Touches:* `league-nav.js`, `forms.css`, the five league pages and their scripts

## 2026-10-24 — A league's own picture, per league

*Decided by:* UV (a picture set on the league's settings, as a profile picture is); per league rather than per season, Claude (the STATUS note left it open)
*Why:* the trophy stood in for every league; a club wants its own badge on its league.
*So:* `tbl_leagues.picture_path` and a public `league-pictures` bucket, built as `player-avatars` is: prepared in the browser (square, 512 px, re-encoded, EXIF gone), a new random name each time, the old file deleted. Whoever may manage the league uploads and sets it, through `tdc_set_league_picture`. Every season of a league shows the same picture: on the season page's banner, the leagues list and the league search. Saved the moment it is chosen, not with the settings page's Save.
*Rejected:* a picture per season (a league's badge does not change each year; a season could get its own later without undoing this).
*Touches:* migration `20261024202149`, `league-settings.js`, `leagues/settings/index.html`, `league-season.js`, `leagues.js`, `tdc.js`, `profile.js`, `league.css`

## 2026-10-25 — A night both captains have signed is locked on the fixtures page

*Decided by:* UV
*Why:* on 24 Oct UV signed TEAM B v TEAM C for both sides, then pressed "Take the match off" on the finished fixture as LD. Nothing was deleted, but the fixture had no match, and Start made a new one that asked for the lineups again. UV: "Once a match is submitted, it should be locked. Even if the LD had to move it, we shouldn't be asking for the lineup again." The point of the app is that a director does not need to touch a night; sensitive controls belong on the **LD approvals page** (not built), not the fixtures page.
*So:* once both captains have signed (match status complete), the fixture shows only the button that opens the card: no Take off, no Move, no table steppers, and the night's Move all leaves it where it is. The database refuses to take a signed match off its fixture (`tdc_detach_league_match`), and refuses to clear or replace a schedule that holds one (`tdc_clear_league_fixtures`, which generating again goes through). Moving a signed match's date is still allowed in the database, for the approvals page to use.
*Rejected:* keeping Take off with a stronger warning (the warning was there, and said truthfully that nothing would be lost; the trouble was what the schedule did next).
*Touches:* migration `20261025072000`, `league-fixtures.js`, test `035_league_signed_match_locked`

## 2026-10-25 — The fixtures page shows scores and follows live matches

*Decided by:* UV
*So:* each side's score sits between its team and the buttons, once any frame has a result or the match is finished. Anybody on the page, player or director, follows the night live: every match on the schedule not yet finished is watched (a change to its row in `tbl_matches`, which every frame write makes), and a finished one is read once and never watched.
*Touches:* `league-fixtures.js`, `league.css`

## 2026-10-25 — A finished fixture is one link to its card, and two sides are written with a colon

*Decided by:* UV
*So:* on the fixtures page a fixture both captains have signed has no buttons and its teams are not links: anywhere in its box opens the card, and the middle reads "13 : 12". Unfinished fixtures keep their buttons and team links. Everything in a fixture is centred in its cell, the score is as tall as a team's picture (2rem), and the short line between fixtures went (the outline parts them; the gap stays). **Site-wide, two sides are written "A : B", never "A v B" or "vs"**: the fixtures, the card's banner and title, the bracket's score entry, the poster's share text, the rotation warning, and `tdc_my_matches` for a refereed match (migration `20261025075828`).
*Claude's call, to confirm:* on a phone a playing match's score sits above its buttons, because a score either side of three buttons is 434px wide against a 380px card. A PC, and a finished fixture anywhere, keep UV's layout.
*Not changed yet:* the match list's "vs Opponent" (asked) and the database's rotation refusal, which says "H1 v A1" (it lives in `private.tdc_check_match_rules`).
*Touches:* `league-fixtures.js`, `league.css`, `league-card.js`, `leagues/card/index.html`, `tournament-bracket.js`, `tournament-poster.js`, `match-settings.js`, migration `20261025075828`, test `031_match_referee`

## 2026-10-25 — Tables available when generating a schedule

*Decided by:* UV (all three choices asked and answered)
*So:* Make the schedule has **Tables available** beside Tables per match. Tables are numbered on through a night as before but stop at the last one available: **the fixture that reaches it gets what is left** (3 available, 2 a match: {1,2}, {3}, then none), and the night's later fixtures get none, for the director to give by hand. **Blank means no limit.** **It is for that Generate only and is not saved**, so Add a fixture still numbers on past it.
*Rejected:* whole matches only (a match on one table of two is still playable); remembering it per season (no schema change wanted for it now).
*Also:* the page's groups are now Planner (open), All fixtures, Make the schedule (folded), Add a fixture (its own group).
*Touches:* migration `20261025082733`, `league-fixtures.js`, `leagues/fixtures/index.html`, test `036_league_tables_available`

## 2026-10-26 — The dots: one travelling set replaces every element's own dots

*Decided by:* UV (asked before building, from the open questions in `docs/design/dots-motion-spec.md` §15)
*So:* four dots for the whole page, serving whatever is waiting on the network (`scripts/dots.js`, `docs/systems/dots.md`). **They replace the per-element dots of `scripts/ring-status.js`** on every checkbox, switch, three-way switch, nav button and fixture icon (step 7 of the build). Three consequences, following the spec: when several saves are out at once, the dots go to the latest tap and the others come back without them; an icon's lines fade in as a whole while the dots trace over them, rather than being drawn on behind a dot; and a control revealed with no network call (a folded section opening) gets no dots, which changes the 24 Oct entry in `docs/ui.md` about switches orbiting as they appear.
*Rejected:* keeping the ring engine for inputs, since several can be saving at once and one set of dots cannot be in five places (Claude's recommendation; UV chose one system); leaving rings alone, which could put two sets of dots on screen together.
*Also decided the same day:*
- **Colour:** the dots take the colour of the line they are on, blending between: the ring's colour while orbiting and racing, the icon's while tracing it. Not a palette of their own; the spec's placeholder colours are not used.
- **Numbers:** dots trace hand-drawn single-line digits laid over the number, and those lines crossfade into the real text in the site font. Rejected: the font's outline (twice the path, busier) and showing numbers as stroked digits for good (changes how scores look everywhere).
- **A tap during page load takes the dots at once.** Sections that finish loading meanwhile just appear; any still loading afterwards get the dots next.
- **Icons:** the dots trace the site's own icons, the strokes in `ring-status.js`, not Tabler (the spec assumed Tabler; the site has never used it).
*Touches:* `scripts/dots.js`, `stylesheets/dots.css`, `/sandbox/dots/`, later `scripts/ring-status.js`, `scripts/tdc-controls.js`, `scripts/nav.js` and the league pages

## 2026-10-26 — The dots: a fake ring comes from the shorter side, and the dots meet the line

*Decided by:* UV, after the first sandbox review
*So:* **a fake ring's radius is half the element's shorter side plus the margin** (a wide button's height, a tall number stepper's width), not the spec's half-diagonal. This settles the spec's open question 4 (plain diagonal or a 48px cap); the cap token went. **Travelling, the dots ease off one ring and onto the next**: near the destination their formation opens out to its ring and settles onto the page, each dot meeting the line at its own place, and cruise eases up from the speed they arrived at. Leaving works the same in reverse.
*Why:* the half-diagonal gave a full-width button a ring about 374px across, far wider than the page, where cruise smeared the dots into streaks. And the first build kept the travelling formation 6px across to the end, so all four reached the middle together and came out to the ring over the top: "all the dots seem to be moving to one point before they animate rather than organically meeting the line" (UV).
*Rejected:* the cap (still a big circle on any wide element, and one number for every size).
*Touches:* `scripts/dots.js`, `variables.css` (`--dots-ring-cap` removed), `docs/systems/dots.md`

## 2026-10-26 — The dots: animations are states that run on their own, and the dots show them

*Decided by:* UV ("Almost like the animation is running and the dots just show it visually")
*So:* every animation of the dots (cruise, race, from step 2 the trace) is a state that keeps running and says where each dot would be; the dots draw the current one. **A change between states is a crossfade of positions, eased in and out, while both run** (`--dots-blend`, 0.6 s), so the dots never jerk into place before the next animation. **Travel is the same thing:** the destination's cruise starts the moment a target is served, and the dots go straight to it, lifting on the way, and arrive in it where it has got to, already moving. No spring, so no overshoot. Two states on the same ring (cruise into race) share their dots instead, the race easing its speed up, because sliding between two dots circling at different speeds cuts across the ring.
*Supersedes:* the travel in the entry above ("the dots meet the line": a springy formation that opened out near the ring), which still overshot and started the cruise separately on arrival. The fake ring from the shorter side stands.
*Touches:* `scripts/dots.js`, `variables.css` (`--dots-blend`), `docs/systems/dots.md`

## 2026-10-26 — The dots travel by moving their sphere, not each dot

*Decided by:* UV ("they are exploding far from each other as they move into the new sphere")
*So:* travelling, the dots keep cruising on their sphere and the sphere moves: its centre glides straight to the new ring, and its radius lifts to 1.5 times the new ring's, holds, and settles onto it. Each dot trails the sphere by at most 60 ms. "Lift" means the sphere growing, not the dots.
*Supersedes:* the travel in the entry above ("animations are states"), where each dot slid from its place in the old animation to its own place in the new one. Far out from the new ring the four dots swung round towards their own places and fanned out across a circle hundreds of px wide. The rest of that entry stands: an animation keeps running and the dots show it, and the cruise eases into the race.
*Touches:* `scripts/dots.js`, `docs/systems/dots.md`

## 2026-10-26 — The dots: what each kind of target traces, and how a trace sits on the sphere

*Decided by:* UV (the switch, the buttons, the tab and the finish, asked before building step 2); Claude (how the trace fits the engine, following UV's "the animation runs, the dots show it")
*So:* **a switch is served as a ring**: its knob is the site's own ring, so the dots wait on it and trace its new tick or cross while the knob slides. **Buttons trace nothing**: the fake ring from the shorter side is enough, and the button's border or fill comes back as the dots race it. **A tab traces its pill's outline** in the colour it fills with, then fills (the site has no underlined tabs; its tab bar is the league pages' pill). **Every kind ends with the ring race** on its real or fake ring, not the spec's "brief hover, then fade". In the engine, the trace is an animation beside the sphere, which keeps running underneath; the dots slide into it over `--dots-blend` the moment the call is back (the trace already moving), swing out into a race that takes over that same sphere, and, if another target is tapped mid-trace, travel from that sphere too. The result goes onto the page the moment the call is back, hidden while it is traced, so the **new** icon or number is what the dots draw.
*Rejected:* the spec's switch outline and button outline traces; the prototype's way of following a pen (a dot leapt 12.9px in one frame where one digit ends and the next begins, and lagged its pen on every curve): a dot now sits on its pen and swoops, eased, only where the lines jump; leaving a trace from the dots' own place and size, which flew a 5.8px digit line into the lift (9.75px dots).
*Then, after UV's first look (same day):* **a number is traced in its own font.** Only the real number fades in; the dots are as thick as the font's strokes (one thickness per font, measured from the font: "an approximate size is ok"), and large dots on a small ring afterwards are fine. This replaces "those lines crossfade into the real text in the site font" in the first 26 Oct entry: the hand-drawn digits now only guide the dots and are never drawn, and `--dots-digit-weight` went. **The race runs on the ring line itself**: on the sphere, height pulled racing dots up to 2% inside the ring, and it looked smaller than its ring; a dot's bob now shows only in its size and brightness.
*Touches:* `scripts/dots.js`, `stylesheets/dots.css`, `variables.css` (`--dots-draw`), `/sandbox/dots/`, `scripts/sandbox.js` (the Dots group), `docs/systems/dots.md`

## 2026-10-26 — The dots: the waiting moves are a registry inside the sphere, and carry on while travelling

*Decided by:* UV (asked before building step 4: the moves keep running while the dots travel; a group never finishes first when the call is back; the prototype's sizes to be judged in the sandbox); Claude (how the moves fit the engine)
*So:* each of the spec's 18 solo and 14 group moves is **one entry** in `SOLO` or `GROUP` in `scripts/dots.js` (its weight, length and a function of progress; a group may add a start and a canvas drawing), run by `Ring` while it waits. **Nothing jumps between moves:** a solo move eases its aim in from the last one's (300 ms); a group fades in over `--dots-blend` and out again after its time, held at its end; and two aims are mixed by turning along the sphere, not by a straight line. The moves carry on in flight. When the call is back a group fades straight into the trace or race, and the race takes over whatever move is running and eases it out. Five of the prototype's moves were changed where they jumped when measured (steamroll's second pass, the black hole's streak, the squashes of wobble, jitter and wave) and the black hole's disk was redrawn in fewer strokes (it doubled the frame time); splat's one-frame impact was kept as the move.
*Rejected:* the prototype's way of starting a move (it relied on the spring to absorb a jump in aim, which still showed as a lurch); a straight-line mix of aims (3–4px in a frame partway into five group moves); waiting for a group to end before tracing (up to 4.6 s of added delay).
*Touches:* `scripts/dots.js`, `scripts/sandbox-dots.js`, `/sandbox/dots/`, `docs/systems/dots.md`

## 2026-10-26 — The dots: pool, merge and a new moons, and what the engine gained for them

*Decided by:* UV (the three moves, designed after the spec); Claude (how they fit the engine)
*So:* **pool** and **merge** are new group moves and **moons** is redone, each still one registry entry. Pool's balls are real physics (constant acceleration into the object ball with a cut, elastic collision, a lossy round cushion, drag plus rolling friction) and the group ends when they stop, about 7 s. Merge's pairs pop in, loop and annihilate, a third as Hawking pairs, unseen between pops and moved there at once. The moons orbit their hosts in 3D off the sphere with 2.6 s trails. For them the engine gained a once-a-frame hook and an early end for groups, a pin to a move's aim (exact for the balls, at once for an unseen pair) with the trail cut when a dot jumps, and trails measured in time and set per move. Pool's balls glide to their places on an eased path before being pinned; pinning a dot whose spring had not arrived jumped 7.6px.
*Touches:* `scripts/dots.js`, `docs/design/dots-motion-spec.md` §8, `docs/systems/dots.md`

## 2026-10-26 — The dots: the page-load queue traces only the last, and goes wherever the next one is

*Decided by:* UV (asked before building step 5); Claude (how the queue sits on `serve()`, and the travel fixes it needed)
*So:* `TDCDots.track(el, promise, opts)` puts something loading with the page in a queue; `serve()` stays the tap and takes the dots at once. After 150 ms everything still loading dims (the existing busy look; what sits inside it while it loads is each page's own choice, at step 7) and the dots go to the first in the page's order, **wherever it is, off the screen included**. **Only the last is traced, and only the last gets the race and fade**: every other element comes in as the dots fly on to the next, a tap included when something is still loading. One that is back before the dots reach it simply appears and they turn mid-flight; if it was the last, **they land on it anyway** and race and fade there. A tap abandoned by a later tap is not queued again.
*Rejected:* shortening each trace (about 3× faster, Claude's recommendation) in favour of skipping all but the last; visiting only elements on the screen (Claude's recommendation); fading out mid-flight when the last is back early.
*Also, because the dots now turn in flight often:* a trip that starts mid-trip keeps the speed the dots had and curves round, rather than starting from rest (26–50px changes of speed in a frame, measured on the step 4 engine); each dot keeps its own lag for good as a smoothing, not a delay picked each trip (a turn jumped a dot 17–21px); and a new trip starts from the frame the dots were last placed in (one frame of standing still, 19.6px). These change travel for taps too.
*Touches:* `scripts/dots.js`, `/sandbox/dots/`, `scripts/sandbox-dots.js`, `stylesheets/sandbox.css`, `docs/systems/dots.md`

## 2026-10-26 — The dots: reduced motion is a calm pulse on taps only, and every failure is shown with the page left right

*Decided by:* UV (asked before building step 6: the hang limit, page load under reduced motion, where a failure shows, what a failed call does); Claude (the pulse's shape, and how each failure is caught)
*So:* **Reduced motion** (the device's setting, or `data-motion` on the page's root, which the sandbox switches): no dots at all. A tapped target breathes in opacity while its call is out, a ring icon's ring, else the whole element, and fades in when it is back. **Something loading with the page only dims and fades in, with no pulse** (UV). **Failures:** each is reported as "TDC (Error)" on the page's status line if `serve()` / `track()` were given one, else on the dots' own line at the foot of the screen, and with `[Dots]` in the console. **A call with no answer after 20 s** is shown as it was and the dots move on; answered later, its result then shows plainly. **A call that fails is not traced** (nothing was saved); its `reveal` still runs and the page reports its own error, so the dots only log it. A target leaving the page before its result is shown is cleaned at once, but leaving after its result is shown is not a failure (pages redraw after every save). If the dots themselves throw, they hide and every target is put right, rather than the loop dying with every busy target dimmed.
*Rejected:* a pulse on everything loading at page load, in step (Claude's recommendation; UV chose dimming only); 10 s and 30 s as the hang limit; tracing a failed call as a success (the step 5 behaviour); the dots reporting a failed call on the page too, which would repeat the page's own message.
*Touches:* `scripts/dots.js`, `stylesheets/dots.css`, `variables.css` (`--dots-pulse`, `--dots-pulse-peak`), `scripts/sandbox.js`, `/sandbox/dots/`, `scripts/sandbox-dots.js`, `stylesheets/sandbox.css`, `docs/systems/dots.md`

## 2026-10-26 — The dots on the site: the first list, following a redrawn button, and no dots without a call

*Decided by:* UV (the first list, following to the new button, Account and Reload waiting for the page to go; asked before building step 7, spec §15 question 5); Claude (how the calls reach the dots, and the two engine changes the real pages needed)
*So:* `dots.js` and `dots.css` are on every page, and `ring-status.js` is the ring icon alone. **The first release:** every saving checkbox, switch and three-way switch; the nav's bell, account and reload; the fixtures page's Start, Take off, Remove, Start all and Remove all; and the fixtures page's load (the heading, then the planner). **A save made through `TDC.writer` gives its answer to the dots** (`{ dots: el }`, or a custom control asking `TDC.writeSince()` after its change), settling after the page's re-read and failing when the save did, so only what the database kept is traced. **A change with no call gets no dots** (a box in a form, the menu's cross, a field shown): its icon draws in. **After Start, the dots follow to the button now in its place** (the card's arrow) and trace it; after Remove they finish where it was. **Account and Reload keep their dots until the page has gone.**
*Also, because the real pages showed them:* a target that jumps on the page (the planner growing as the fixtures arrive, 185px in a frame; a followed button standing elsewhere) has its ring glide from where it was over 350 ms, where the committed engine snapped 770–1040px in a frame; a dot swoops wherever its pen passes from one line to another across a gap, not only where the pen moves more than 6px in a frame, which on a table's small ring let it leap the tick's gap in one frame; and the ring icon's busy look is keyed on `data-dots-ring`, so a section full of ring icons dims as a section.
*Rejected:* tracing the whole fixture row instead of the button, or no trace at all on the fixtures' buttons (UV chose following); no dots for Account and Reload. *Not yet:* `track()` on other pages (each loads its data its own way; one page first).
*Touches:* `layout.html`, `scripts/dots.js`, `stylesheets/dots.css`, `scripts/ring-status.js`, `stylesheets/status.css`, `scripts/tdc.js`, `scripts/tdc-controls.js`, `scripts/nav.js`, `scripts/league-fixtures.js`, `variables.css` (`--ring-load`, `--ring-spin`, `--ring-fade` removed), `scripts/sandbox.js`, `sandbox/index.html`, `sandbox/dots/index.html`, `docs/systems/dots.md` §7

## 2026-10-26 — A switch is an empty ring off; every cross is red

*Decided by:* UV
*So:* a switch shows **an empty ring when off** and a tick when on, like a ring; its track and knob still say it is a switch. **Every cross on the site is red** (`--color-error`), its ring staying cream: the menu's close, the fixtures' Close the move and Remove. The cross keeps its place in `ring-status.js`; a mark carries its icon's name as a class (`mark-cross`), which `status.css` colours.
*Replaces:* "tick on, cross off, never an empty ring" (24 Oct, the ring status entry above).
*Touches:* `scripts/tdc-controls.js`, `scripts/ring-status.js`, `stylesheets/status.css`, `scripts/sandbox-dots.js`, `sandbox/index.html`, `docs/ui.md`

## 2026-10-26 — The 1v1 score input: side by side, home on the left, a win without a break event

*Decided by:* UV (design in claude.ai, answers in Claude Code; `docs/design/match-score-input.md` §10)
*So:* on `/match/` the two players' cards sit **side by side in portrait as well as landscape**, **home on the left everywhere** (the cards, the history, the stats). With breaks tracked, **a plain win may be recorded before the break event is set** (the break then counts as not recorded); the special wins wait for the event. **Rack time belongs to the breaker**, who racks their own frame: counted from `break_side`, nothing stored. The live rack and match clocks are **counted from the frames**, so every phone shows the same and a reload keeps them. A reverse B&F has no mark of its own in the history.
*Rejected:* top and bottom halves in portrait, with the top turned 180° (BACKLOG §6 #1, retired); a per-frame "who racked" column; each phone keeping its own clocks.
*Open:* where the timing controls go (pause, shot clock, extensions, match clock): later.
*Touches:* `match/index.html`, `scripts/match.js`, `stylesheets/match.css`, `variables.css`, `scripts/sandbox.js`, `docs/systems/matches.md`

## 2026-10-26 — Slide to confirm is a range input; the score input's timeline is an experiment

*Decided by:* Claude, building UV's design (`docs/design/match-score-input.md` §5, §9); UV to review
*So:* the slide to undo is a new custom control (`slide` in `tdc-controls.js`) built round an **`<input type="range">`**, so the keyboard and screen readers have a real control and a page listens for an ordinary change to the minimum, as for any form element. The knob's place is a CSS variable, so only the drag is measured. The break event is the existing select pill with a **`data-tone="warning"`**, rather than a new control. The **timeline is on by default with switches beside it** (on/off, widths even or by time), remembered per browser, so UV can compare before deciding whether it stays.
*Rejected:* a button that fires a custom event (no keyboard story); separate break-event buttons kept beside the pill.
*Touches:* `scripts/tdc-controls.js`, `stylesheets/controls.css`, `scripts/ring-status.js` (`undo` icon), `variables.css`, `scripts/sandbox.js`, `sandbox/index.html`, `scripts/match.js`, `stylesheets/match.css`, `match/index.html`

## 2026-10-28 — Every control gets the dots, call or not

*Decided by:* UV (after trying step 7: "horizontal and vertical pill selectors and numeric inputs don't get any dots. They should. Even when no network call happens"; the score, the break event with its cue ball, the slide, folding groups; a held stepper keeps the dots until it is let go; "I don't mind if the dots barely arrive before tracing"); Claude (how)
*So:* every custom control, in `tdc-controls.js` and so on every page, gives the site's dots each change: the save it made if there is one, never less than 0.2 s. Steppers trace their number (a held chevron keeps the dots, the number lit, until release), pills trace the green pill's outline (or an icon in it: the match page's break event wears the cue ball), switches and rings their icon, the slide rides its knob while dragged, a folding group has them while it opens, and the match page's score traces its new number after the frame's save. An icon is traced twice as fast as before.
*Replaces:* "a control revealed with no network call gets no dots" (26 Oct, the first step 7 entry) for the controls. The nav's menu cross and an icon drawing in as a page opens still have none.
*Then (UV, same day):* every button too; a filled button or green pill keeps some colour while it waits (`--dots-busy-fill`); icons traced faster still (0.35 s); the dots on a digit thinner than its stroke; the break event's cue ball as tall as the pill, at its left, with its ring.
*Rejected for now:* fewer dots for an icon with fewer strokes (UV's consideration).
*Touches:* `scripts/tdc-controls.js`, `scripts/dots.js`, `stylesheets/dots.css`, `stylesheets/controls.css`, `scripts/match.js`, `docs/systems/dots.md` §8

## 2026-10-28 — Nothing fades in until it is ready; the dots stand in for it

*Decided by:* UV ("only when an element is ready for interaction do we fade in")
*So:* a folding group opens with its contents hidden and the dots on the group (a ring from its shorter side); the contents fade in once it has opened and anything its opening set loading is back, as the dots reach it. Something loading with the page is hidden, not dimmed, until it is loaded.
*Replaces:* contents fading in as a group grows (24 Oct), and page-load targets dimmed while they load (26 Oct, step 5).
*Touches:* `scripts/tdc-controls.js` (`fold()`), `scripts/dots.js` (`fake`, `data-dots-load`), `stylesheets/dots.css`, `docs/ui.md`, `docs/systems/dots.md` §8

## 2026-10-28 — The dots' timings are three times in seconds; the ring margin is for squares only

*Decided by:* UV
*So:* the dots' settings are **Transition time** (`--dots-blend`, 0.5 s: waiting into tracing, tracing into the ring race, and the dots fading out), **Draw time** (`--dots-draw`, 0.12 s: the trace, any kind, a number a third more a digit) and **Fade time** (`--dots-reveal`, 0.25 s: the ring fading in after the trace). The dots fade out only once the ring is fully in, over the transition time; there is no race of its own before. A fake ring is the element's shorter side, with no margin; `--dots-ring-margin` (16 px) is added only round a square.
*Replaces:* draw and fade as speeds times the prototype's (`--dots-draw` 1, `--dots-fade` 1, removed), the per-kind trace times and the 0.5 s race before the fade; the margin on every fake ring (26 Oct).
*Touches:* `scripts/dots.js`, `variables.css`, `scripts/sandbox-dots.js`, `scripts/sandbox.js`, `docs/systems/dots.md` §3, §5

## 2026-10-29 — An edit after signing voids both signatures; undoing it brings them back

*Decided by:* UV
*So:* any change to a signed card voids **both** captains' signatures, not only the other side's, and the card cannot be submitted until both sign again. This is enforced in the database. **If the edit is undone**, so that the card is exactly what both sides signed, both signatures stand again: they signed that card, so nothing needs signing twice.
*Example:* both captains sign at 13 : 12. The LD changes frame 7's winner, and both signatures go. The LD changes it back: 13 : 12 with every frame as signed, and both signatures are back, with nobody signing again.
*Rejected:* voiding only the other team's signature (the side that made the edit would still be standing behind a card it had just changed).
*Built:* migration `20261029075957` (a fingerprint of the card on each signature). Claude's additions: a content match never counts across a later dispute, and each side's latest signature is the one that counts.

## 2026-10-29 — The league director signs both sides, and always as the league director

*Decided by:* UV (both answers asked); the mechanism, Claude
*So:* on the team card the league director gets a sign button for each side whose signature does not stand (a captain only their own). **Whoever runs the league signs as the league director on every side, their own team's included**, even when they also captain that team. The signature lines say "Signed · Owner TDC · league director" (or "· captain"). The list under the signatures, now "Signatures and changes", **holds the signatures as well as the edits**, and an edit by the director says "league director" after the name.
*Why:* the page signed for the side being set up, whose switch hides once both lineups lock, so a director could only ever sign one side. And a director's signature read as if the team had signed.
*Rejected:* labelling by the side's own role (captain on their own team, director on the other); keeping the list to edits only.
*Touches:* migration `20261029080921` (`signed_as`, `tdc_card_signatures`), `league-card.js`, `leagues/card/index.html`, test `038_card_signature_roles`

## 2026-10-29 — Re-opened; signing approves the card as it stands; the changelog grouped by signature

*Decided by:* UV (the name, what blue is for, the grouping, the table, newest first); the details, Claude
*So:*
- **Re-opened.** A night both captains signed and then someone changed reads **Re-opened**, on the card's badge and the fixtures page. UV: "playing is a bit vague". The match stays complete, so its fixture stays locked as a signed night is, until it is signed again or the change is undone. `tdc_league_fixtures` reports `reopened`, and nothing is stored.
- **Signing approves the card as it stands**, your own changes and the other captain's. "The point of the blue is that it allows the user to track changes visually." So blue marks only what you have not put your name to: a captain sees changes since their side's latest signature. Anybody else (the league director, a captain who has not signed) sees what both sides have not yet agreed, from the older of the two signatures that no longer stand. A signature that stands means no blue.
- **The opposition captain signing** a card nobody has changed since the first signature agrees, locks and completes it. This was already so (UV's note, confirmed).
- **The changelog** (renamed from "Signatures and changes"): a group per signature, newest first, each holding the changes made after it. The top group is "still to be signed". Each change is rows of **Frame · Change · Was · Now**, with who (and "league director") and when on a line beneath. A status or a plain win that only follows the winner is left out; the lag is called Lag.
*Then (UV, same day):* each signature's set of changes folds on its own, the newest open; Lag and Winner rows in their switches' yellow and green; Was and Now show the team and that frame's player; the signature section as wide as the other sections.
*Rejected:* "Playing" for a re-opened night; a new match status (it would have unlocked the fixture and touched every page that reads status).

## 2026-10-29 — A league's pages are one page; the pill's items are tabs

*Decided by:* UV (one page, tabs switching in place with the dots); how, Claude
*So:* Season, Fixtures, Run it and Settings are panels of `/leagues/season/`, chosen with `&tab=`, switched in place with no page load, and Back steps between tabs. **Each panel's script starts the first time its tab is opened**, so a player never starts Run it or Settings, and the page never reads four pages' data at once. A tab opened again shows what it had, without reading again. The old addresses forward to their tab, because the database's fixtures notification and people's bookmarks still use them. **New season stays a link**: it is a form for creating another season, not a view of this one. On the fixtures, a team's name opens the Season tab in place with that team open.
*Rejected:* fetching each page and swapping it in (every script would run again, with its listeners twice); starting every panel at load (four pages' reads, and refusals shown to players from tabs they never opened); one shared heading for every tab (each panel keeps its own, as it was).
*Not yet:* a tab opened again is not read again, so a change made in one tab (a team renamed in Run it) shows in another (Fixtures) after a reload. That is UV's item 13 (data updated in place).
*Touches:* `league-nav.js`, `leagues/season/index.html`, `_includes/league/*`, the four league scripts, the three old pages (now forwarders), `league-new.js`, `leagues.js`, `forms.css`, `docs/ui.md`, `docs/systems/file-map.md`

## 2026-10-29 — Data arriving updates the page in place, and changed text fades out and in

*Decided by:* UV (item 13); where and how, Claude
*Found:* no page reloads itself when data arrives (the two `location.reload()` calls are the nav's Reload and the profile after linking a walk-in). What did happen: **the team card did not follow at all**, so a captain saw the other side's changes only by reloading; the live pages (fixtures, match, bracket) redraw everything with nothing to show what moved; and the league tabs (item 8) showed what they had when shown again.
*So:*
- **The card follows its match live**: a frame written (the match's `card_version` moves) or a signature (an event), both already sent live. It re-reads in place within half a second, and again whenever it is shown or back online. It waits while this person's saves are out or a choice is unsaved. The echo of their own save cannot be told apart, so it costs one more re-read.
- **`TDC.liveSnapshot` / `TDC.liveFade`**: before a re-read is drawn, the text of every `[data-live]` element is noted; after, each one that changed fades out with its old value and in with its new (`--live-fade`, 0.5 s, on the sandbox). Not on a first draw; nothing under reduced motion. Marked so far: the card's scores, session totals and signature scores; the fixtures' scores.
- **A league tab shown again is read again** (a panel's start returns `{ refresh }`). Season and Run it re-read; Fixtures as a live change would. **Settings is not**, so a half-made change is not thrown away.
*Rejected:* telling the card's own echo apart by reading `card_version` on every re-read (one more call per re-read on a phone, to save one re-read per burst of taps).
*Not yet:* fades on the match page and the bracket (they already update live; marking their text is the next step), the season page's numbers, and a switch moved by the other captain gliding rather than appearing in place.
*Touches:* migration `20261029082020`, `league-card.js`, `league-fixtures.js`, `league-season.js`, `league.css`, `leagues/card/index.html`, test `037`

## 2026-10-29 — Every page opens behind a loading screen, gone once its data is in; each page says when it is ready

*Decided by:* UV (a loading screen on every page, hidden only once the page has fully loaded; Loader A; opaque); how a page says it is ready, Claude
*So:* an opaque screen, in the layout from the first paint, covers the whole page and the nav. Loader A: the site's own dots serve a large invisible ring in the middle of the screen, and the site icon sits exactly where the nav's does, so when the screen fades the real icon is left in the same spot. **A page says what it is waiting for with `TDCLoader.hold(promise)`**: every page's start block is wrapped in it, `TDCDots.track` holds what it tracks, and the league page holds the tab it opens on. The screen goes once all of those have settled, the network has gone quiet and the page's pictures are in. While it is up, the dots' page-load queue waits (everything loading is under the screen). After 20 s the page is shown with "TDC (Error): … (waiting for …)".
*Example:* `/leagues/season/?s=…&tab=fixtures`. The screen is up with the dots circling; the season is read, then the fixtures; the tab's heading and planner are drawn underneath; the moment the last read is in, the screen fades over half a second while the dots race the ring and fade with it, and the page is there with the real nav icon where the screen's was.
*Rejected:* deciding "ready" from the network going quiet alone (it cannot tell a page between two reads from a page that is done, and the request was for each page to say so; quiet is kept as a backstop for the nav and pages with no data of their own); a separate spinner beside the dots (UV: build on the dots and their page-load queue); Loader B, the diver falling through the hole (not chosen, kept as an option in STATUS).
*Touches:* `scripts/loader.js`, `stylesheets/loader.css`, `_includes/layout.html`, `dots.js` (`track` holds, the queue waits), `league-nav.js`, `tdc.js` (`requireSession` keeps the screen up on its way to sign-in), every page script's start block, `variables.css` (`--loader-*`, `--nav-logo-height`), `nav.css`, `sandbox.js`

## 2026-10-29 — Notifications and reload live in the menu, not on the bar

*Decided by:* UV (the menu, not the bar); the layout, Claude
*So:* the bell and reload are rows in the slide-out menu: Notifications at the top, its list unfolding under the row; the page links; Reload at the foot, still only in an installed app. The bar holds the menu button, the logo, the offline tag and the account. **The unread pip sits on the menu button as well as on the bell**, since otherwise nothing on the bar says something is waiting.
*Why:* the bar was crowded: at 375px the bell's slot overlapped the logo by 16px, and an installed app's reload would have made it overlap at 420px too. Now the logo has over 100px clear each side.
*Rejected:* keeping the tray as a floating panel opened from the menu (a second layer over a layer); a count on the menu button (the pip is a dot, not a count, 22 Oct).
*Touches:* `_includes/nav.html`, `nav.css`, `nav.js`, `docs/systems/notifications.md`, `docs/ui.md`

## 2026-10-29 — The loading screen is see-through, and comes back for a section still loading

*Decided by:* UV (blurred, not opaque; on every page or tab where a section is still loading; gone only once the page is present and populated); how, Claude
*So:* the screen blurs the page under it (`--loader-blur`) rather than hiding it. A hold made after the screen has gone brings it back at once, so a league tab opened for the first time is covered until it is drawn, exactly as a page is. A tab shown again is not covered: it is drawn already and reads again in place (item 13). Anything loading with the page that is back while the screen is up is shown at once rather than fading in under it, so it is whole when the screen goes.
*Example:* on a league's Season tab, tap Fixtures for the first time. The screen is back within a frame, the dots in the middle; the season and fixtures are read and the planner drawn underneath; the screen fades with everything in place. Tap Season: no screen, the numbers re-read in place.
*Rejected:* a screen over every re-read (it would hide the changed-text fades and flash on every live update); a screen over a team opened on the Season tab (it already waits with the dots until its players are in, and covering the page to open one team is heavy; UV may ask for it).
*Touches:* `loader.js` (`raise`, `cycle`), `loader.css`, `league-nav.js`, `dots.js` (`underScreen`), `variables.css`, `sandbox.js`, `docs/systems/dots.md` §9

## 2026-10-29 — The changed-text fade reaches the match page, the bracket and the season numbers; a moved switch glides

*Decided by:* UV (item 13's remainder); where, Claude
*So:* the match page fades what another phone changed (the score, "Frame n", both stats tables), only on that path (`refreshFromRemote`), because this phone's own tap is shown by the dots tracing its score. The bracket fades each slot's frame count and name, so a winner arriving in the next round is seen arriving. The Season tab fades its numbers. `TDC.liveFade` now leaves alone anything the dots are serving. And a redraw that makes a new switch whose value differs from the one it replaces starts it where the old one stood and glides it over (`movedFrom` in `tdc-controls.js`), for every switch, ring and three-way switch, not only the card's.
*Rejected:* fading the match page after this phone's own saves (the dots already show that change, and the two would fight); fading the ticking clocks (they change every second); limiting the glide to the team card (the same redraw pattern is on every page, and an unchanged switch still never moves).
*Touches:* `match.js`, `tournament-bracket.js`, `league-season.js`, `tdc.js`, `tdc-controls.js`, `docs/ui.md`

## 2026-10-29 — Never a loading message; the dots show every wait

*Decided by:* UV (repeated: the dots are how the site shows it is working and not ready for input; never a loading message; every section that loads, collapsible groups included); how, Claude
*So:* every "Loading…", "Saving…", "Checking…", "Reading…" line and placeholder is gone. A handler shows its work with `TDC.busy(el, promise)`, the dots on what was used; `TDC.writer` prints nothing and hands an unclaimed save to the focused element; a section that loads when opened (a team on the Season tab) has the dots on it and nothing written inside until it is in. Success and error messages stay.
*Rejected:* hiding in-progress messages centrally inside `TDC.status` (it would leave no dots in their place, and a message that never shows is still a message somebody wrote).
*Touches:* `tdc.js` (`busy`, the writer), 17 page scripts, four pages' HTML, `docs/ui.md`, `docs/systems/dots.md` §8a

## 2026-10-29 — The card's lineup is one list, and a captain never waits on it

*Decided by:* UV (one list: a switch for here tonight and a number for the position; pick the next while the last saves); how, Claude
*So:* a row per player with a switch and a stepper on its side. Each choice is kept on the page until saved and read again, so going down the list never looks undone. A position saves 0.7 s after the last step, so a stepper passing through a position on its way does not knock its holder out.
*Example:* Ann to 1; while that save is out, Ben stepped 1 → 2 and Cal 1 → 2 → 3: the page shows Ann 1, Ben 2, Cal 3 throughout, and three saves go (1 Ann, 2 Ben, 3 Cal), not six.
*Rejected:* saving every step (each passing step would empty a position in the database); the upright stepper (a list of seven players twice as tall on a phone).
*Touches:* `league-card.js`, `leagues/card/index.html`, `league.css`, `docs/systems/leagues.md`, `docs/ui.md`

## 2026-10-29 — A held position is skipped, not taken; a player switched on gets the first free one

*Decided by:* UV
*So:* on the card's lineup, stepping onto a position another player holds jumps on, in the same direction, to the next free one, rolling through the held numbers so it is seen; with none free that way it stays where it was. Switching a player on gives them the first free position, which the captain then adjusts. The stepper is the switch's height.
*Why:* taking the position pushed its holder out, so setting each new player undid the last one (UV: "every time I set a different player's number, it replaces the previous").
*Replaces:* "taking a position empties its holder" from the entry above, the same day.
*Consequence:* two players are swapped by switching one off, stepping the other onto the freed number, and switching the first back on (they get the free one).
*Touches:* `league-card.js` (`choosePos`, `takenBesides`, `setHere`), `league.css`

## 2026-10-29 — A folding group's dots sit on its + / –, at the right end of the heading

*Decided by:* UV (the dots in the heading, green, at the right; then: move the + to the right end and let the dots take its place)
*So:* every folding group's + / – is at the right end of its heading (the ruleset groups had it straight after the words). While a group loads, the + hides and the dots circle in its spot in the site's green (`TDC.groupDots`), then the – comes back. The contents still wait hidden and fade in once ready, as before. Before, the dots went round the whole group as it grew.
*Touches:* `tdc.js` (`groupDots`), `tdc-controls.js` (`fold`), `league-season.js`, `forms.css`, `league.css`, `dots.css`, `variables.css` and the sandbox (`--group-dots-size`, `--group-dots-stroke`)

## 2026-10-29 — The green glow is every page's, and it is a light that drifts and casts the edge shadow

*Decided by:* UV (the glow on every page; the shadow on the edges away from the light)
*So:* the green glow above the top of the screen, the match page's alone until now, is on every page. It drifts slowly from one random point to the next (30 s a move, resting at each), within a quarter of the screen's width either side of the centre and 100px up or down, never below the top. The shadow round the screen's edges, an even glow until now, is cast by it: pushed away from the light, so the bottom is heaviest and the side the light has drifted from darker; the top stays clear for the glow. Its place is kept between pages, so moving around the site never makes it jump.
*Example:* the light drifts to the right: over the next half minute the left edge darkens a little and the right clears, while the bottom stays the darkest.
*Rejected:* the shadow on the edges nearest the light (a true recess, lit from above, shadows its top edge), which would have darkened the glow itself; the glow on the match page only.
*Touches:* `global.css` (`body::before`, `body::after`), `match.css`, `page-light.js` (new), `layout.html`, `variables.css` and the sandbox (`--page-glow-*`, replacing `--match-glow-*`; `--page-inset-offset`, `--page-inset-lean`)

## 2026-10-29 — The edge shadow falls on the edges nearest the light

*Decided by:* UV
*So:* the shadow round the screen's edges lies along the top and down the side the light has drifted to, as the frame of a screen set into a phone shades it when lit from above. It is hard: 14px of blur, not a glow.
*Example:* the light drifts to the right: the right edge darkens, the left clears; the top is always shaded, the bottom never.
*Replaces:* "the shadow on the edges away from the light" in the entry above, the same day (there it was the rejected option).
*Touches:* `page-light.js` (the sign of the offset), `global.css`, `variables.css`, the sandbox's text

## 2026-10-29 — The season page does not show who has confirmed; a team heading shows only its captain

*Decided by:* UV
*So:* on the Season tab a player's line under their team is Captain or Player (and Away or Withdrawn), never "Has not confirmed". A team's heading is its name, then "Captain: Name", and nothing else: the "5 of 7 active · 1 away · over the limit" line is gone from there. Your own panel says "You are playing for Team 0." without "and you have confirmed". Who has confirmed and the team limit are still on the manage page, and the claim list still says when a captain's team is full. The "Confirmed n of m" number in the stats row stays (it is shown only to whoever runs the league and its captains).
*Touches:* `league-season.js`

## 2026-10-29 — A team has its own picture, set by its captain or whoever runs the league

*Decided by:* UV (a captain uploads the team icon; it shows everywhere the shield was)
*So:* a team's picture replaces the shield on the Season tab's team headings, the fixtures planner, and the team card's banner and result section. A team with none keeps the shield. Who may set it is `private.tdc_can_control_team`, the same rule as renaming the team: an active captain of that team, or whoever runs its league season. A player on the team, another team's captain and a stranger may not. Built as the league picture is (a public `team-pictures` bucket, `<team id>/<random>.webp`, cropped to 512px, EXIF stripped, a new name on every upload). Teams are per season, so a new season's team starts with the shield.
*Touches:* migration `20261029154054_team_pictures`, `tdc.js` (`teamPic`), `league-season.js`, `league-fixtures.js`, `league-card.js`, `league.css`; test `040_team_pictures`

## 2026-10-29 — Standings: columns per league season, counted from signed nights, worked out in the browser

*Decided by:* UV (the tables, the default columns, the builder, rank order per column, build from scratch); Claude where noted, for UV to confirm
*So:* two tables on a Standings tab, Individual Rankings and Team Rankings (teams opening onto their players). Their columns are the league director's, built on the Settings tab from buttons into a token array, and stored **per league season**, as the design settled (UV had said "probably per league": per season means a later change cannot rewrite an old season's table). A new season starts with UV's defaults. **Only nights signed by both captains count** (Claude: a league table is a shared fact, and the archive's approval design has standings read settled results). The equation is checked by the database and **worked out in the browser** from counts the database returns (Claude: no evaluator in SQL at all, and nothing string-shaped reaches either side). The team table's + / – is its first column rather than its last (Claude: on a phone the last is scrolled out of sight).
*Rejected:* columns shared across a league's seasons; counting nights still being played; a string equation with a parser; evaluating the equation in SQL.
*Touches:* migration `20261029162031_league_standings`, `league-standings-def.js`, `league-standings.js`, `league-standings-edit.js`, `league-settings.js`, `league-nav.js`, `ring-status.js` (`back`), `league.css`; test `041_league_standings`

## 2026-10-29 — Standings can be live: a switch per viewer

*Decided by:* UV ("add a toggle to the standings page to allow live updates", answering whether a night being played should show)
*So:* a Live switch on the Standings tab, off by default and kept per device. Off, only nights signed by both captains count. On, a night not yet signed counts too, from its first finished frame (Claude: so a night just started is not a 0–0 draw), never an abandoned one, and the tab follows every frame as it is recorded through realtime, as the fixtures page does. It is the viewer's choice, not the league director's: the signed table is still what everybody sees by default.
*Rejected:* a league setting deciding it for everybody; counting a started night with no finished frame.
*Touches:* migration `20261029194712_league_standings_live`, `league-standings.js`, `_includes/league/standings.html`; test `042_league_standings_live`

## 2026-10-29 — Standings tables: frozen name and heading, a names switch, a row-and-column highlight

*Decided by:* UV (bigger numbers, everything centred, the name and heading frozen, every second row tinted, a display name / full name switch with display name the default, hover or tap to light a row and column in a green inner glow that a second tap clears)
*So:* each table sits in a box at most three-quarters of the screen tall that scrolls both ways (Claude: a frozen heading only sticks inside the box that scrolls; the page's own scroll cannot hold it). In Team Rankings the + / – freezes with the name, and a tap on a team's row now highlights it instead of opening it (Claude: the tap could not do both; the + / – opens it). Full name is first and last name, and a player with neither shows their display name. The dummies' nicknames are a seed script, not a migration.
*Rejected:* freezing a team's players' own heading under the team table's (it would stack two frozen headings in one box).
*Touches:* migration `20261029203451_league_standings_full_names`, `league-standings.js`, `league-standings-edit.js`, `_includes/league/standings.html`, `league.css`, `supabase/seed/dummy-player-nicknames.sql`, `supabase/seed/dummy-league-players.sql`; test `043_league_standings_full_names`

## 2026-10-30 — A new match page, split between the two players

*Decided by:* UV ("I don't like the current one"; the inputs are frame win, the special wins, the break event, undo, and pause / play for the match and for a session; frame history is the most important thing to show; everything without scrolling where possible; "top-bottom split on portrait and a side-side split on landscape. No diagonal"; then "keep both sides using my site's dark theme. Just give both sides an inner shadow to show the split")
*So:* a new page at `/match-v2/`, built beside `/match/`, which stays as the reference until the new one replaces it at that address. Its stage is exactly one screen below the nav, split in two halves: home on top and away below when upright, home on the left and away on the right when turned sideways. Both halves are the site's dark theme, each set in with an inner shadow (Claude: the page edge's own shadow tokens, so it matches and is already on `/sandbox/`).
*Then (UV, same day):* on this page only the nav hides until asked for: on a PC by hovering where it sits, on a phone by a small scroll up when already at the top. Claude: it goes again 0.4 s after the mouse leaves it, or 3 s after the last touch on it on a phone, never while its menu or account panel is open; the phone's pull to refresh is off on the page, or the pull down would reload it. A cream ring in the middle of the screen, a third of its height, its line about 12px (UV first said a circle, then a ring). Each player's score centred in and filling the outer third on their side (Claude: sideways, the left and right thirds). The ring and the scores with a shadow, and every shadow on the page reacting to the background glow (Claude: the page edge's offset from `page-light.js`, so the drop shadows fall away from the light and the halves' inner shadows sit nearest it). The dots on the ring, sized by its stroke, looping for now, the ring fading out while they run (Claude: served with a pretend call each round, so the engine's own busy look does the fade; a new `line` option in `dots.js` puts the dots on the ring's line rather than a margin outside it). The dots confined to the ring at the start of each round (UV: they "explode off the ring before animating"; Claude: dots starting on or inside their target's ring now appear on it rather than making a trip, whose lift was the burst; site-wide, but only where the dots start inside the ring they are going to). The break event inside the ring as a yellow ring split like an X into four buttons, In at the top, Dry at the bottom, Scratch and Foul either side, the chosen one filled and the others transparent, site fades, its outline and the filled one with the light-cast shadow; a new sandbox element if the design is kept (UV). Then the words along the rim so the hole is bigger; the break ring in the cream ring's place and the cream ring inside its hole, its line as thick as the words' letter strokes (UV chose stroke over height) and its gap to the yellow the quadrants' own gap (UV). Claude: the stem measured in the browser (0.23 of the font size), and the hole and gap passed from the drawing to the stylesheet so neither is written twice. Then the screen in twelfths, 5 : 2 : 5 in place of thirds, each player's five split 1 : 4 between name and picture and score (UV). Claude: upright the names at the outer ends, so both scores sit beside the rings; sideways the 1 : 4 down each side, the name across the top; the rings fill the middle two twelfths. Then each player's picture and names in their area: the picture on the left, the display name on the right with the full name under it, picture and names the same height, together centred (UV). Claude: the initials in a circle without a picture, the full name left out when it is the display name, a long name ending in "…". Then padding above and below the names, and the breaker's half outlined (the break buttons' weight) and glowing in yellow, both meeting the break ring's rim and stopping there (UV). Who breaks is worked out as the current page does (UV: "we already have this working"): its `breakSideAt`, moved across unchanged. Then the same yellow glow on the break buttons, and back to thirds, sideways the name strip the whole half wide (UV). Claude: the glow's size and colour two tokens the half and the buttons share. Then the buttons' glow and shadow consistent with the halves' glow and the scores' shadows (UV). Claude: an inner glow in each quadrant built as the half's (an SVG filter on a layer of its own), and the light's shadow on the buttons' lines and words only, not on the glow. Then shadows inside the buttons as well as out, following the light, and the same for the cream ring (UV). Claude: inside, the halves' own inset shadow (a filter layer over the buttons, its offset updated as the light moves; for the ring, an inset box-shadow in its hole); outside, the score digits' shadow. Then the special wins: buttons in the break buttons' style in green, beside the ring upright and above and below it sideways, rounded rectangles whose inner edge follows the ring with the same gap, their words along it; four, two a slot (B&F and GB, rB&F and a walkover); the ring shrinks so they fit; sideways the ring centres in the space below the name strips (UV). Claude: slot A left and top, first button top and left; words in the lower half turned round so they read upright; the breaker's glow now stops at the whole group. Then the breaker's line still meeting the break ring (UV: the special wins were cutting it off). Claude: it runs through the gaps between and round the special wins, clear of their lines, while the glow, which would lie under them, stops at the group: the two are separate layers. Then no artefacts where the special wins meet the glow (UV): the glow cut by the buttons' own shapes (a mask drawn by the script from the same geometry) rather than a rectangle round the group. Then three dots in place of W/O, opening a pop-up in the site's style with the stage buttons' look, both players' options clearly marked, Pause match among them, laid out for upright and sideways (UV). Claude: each player's box headed by their picture and names, mirroring the stage; Walkover green, Abandon frame and Pause match cream; Change table left out until there are tables. Then the cream ring as the ring of an icon: the frame in play (with the most frames where there is one, "6/9" for race to 5) above, the win condition below, the shadows as everywhere else; and every network call on the page shown by the dots on that ring rather than flying round the page (UV). Claude: a divider between the halves; a `TDCNet.onAsk` hook so the page hears every call; the page's own replacement for `TDCDots.serve`, sending every target's dots to the ring, the loading screen's excepted; the demo loop removed. Then the scores with a green outline as wide as the buttons' and their glow, to read as buttons, their fill to follow the frame history later; and the ring's words smaller to fit (UV). Claude: the scores as SVG text, so the outline stays even on the stretched digits, with the buttons' inside glow and shadow too. Then the scores' inside shadow a little stronger (UV): its own two tokens, strength 0.9 and 1.5 times the light's reach, the halves and buttons unchanged. Then the scores' outline the same width as the buttons' (UV). Claude: drawn as a button's, centred on the digit's edge, in the score's filter, since a text stroke sat all outside the digit and stretched with it. Then a little padding below the scores sideways and the bottom name upright, and the scores always centred (UV). Claude: each score centred by measuring its own digits' ink, since the face's digits stand a little differently. Then centred across too (UV), the same way: by the digits' ink, not their spacing. Then the plan to make the page fully functional (UV): frame history, stats, timing and the scorecard below the stage; the undo slide first under it; match settings from the More pop-up; `match.js` ported into `match-v2.js` rather than shared, since the old page is to go. The ring's words fade out altogether while the dots run (UV). Claude: Scratch left and Foul right; nothing chosen at first and never cleared, as on the old page.
*Rejected:* a diagonal split, with the leader on top (UV). A palette per player, p0 dark and p1 light, so each player's frame history reads in their colours: proposed by UV, built, then dropped by UV the same day.
*Touches:* `src/match-v2/index.html`, `match-v2.js`, `match-v2.css`, `layout.html` (`navAutoHide`), `nav.js`, `nav.css`, `dots.js` (`line`), `supabaseClient.js` (`TDCNet.onAsk`), `variables.css` (`--match-break-stroke`, `--match-glow-size`, `--match-glow-colour`, `--match-win-glow-colour`, `--match-mark-shadow`)

## 2026-10-30 — The dots stay inside their ring; more middle, more depth

*Decided by:* UV ("all animations will now be confined to the ring"; "allow more centralized random points"; "exaggerate the 3d effect of the dots" by the ring's diameter; "remove an animation if it's causing an issue since I want to define new animations later")
*So:* no waiting move takes a dot outside its ring; a move that went past it is drawn in so its furthest point is on the ring (moons, shadows, merge), and the engine makes the ring a soft wall for everything else (Claude: soft, so a dot curves onto it rather than stopping dead, settling about 1% inside). Merge's pops and the stars may be anywhere inside the ring. Burst, collide and conga go through the middle (Claude's choice of three). A dot's height shows in its size up to 1.8 times as strongly on a big ring, never wider than 45% of it, and burst, collide, stars and conga use a tilted plane or the sphere for depth (Claude's choice). The trip between two targets still lifts to 1.5 times the new ring (Claude: a flight, not a waiting move; UV to say otherwise).
*Rejected:* a hard wall (turned the conga's dots 8px in a frame); scaling moves already inside the ring (pool) out to it.
*Touches:* `dots.js` (`springTo`, `wall`, `DEPTH`, moons, shadows, merge, stars, burst, collide, conga)

## 2026-10-30 — The new match page, step 1: the data and the writes ported

*Decided by:* UV (port `match.js` wholesale, patched not retyped, diffed; test headless against the local copy with nothing test-only in `match-v2.js`; the notice under the stage for step 1, with "Offline" and "Someone else has scored" also on the stage in step 2; the finished match's question a plain notice until the scorecard is drawn in step 3, the last frame saving normally and only the submission waiting)
*So:* the logic was copied by line range and changed only where it drew the old page; each moved declaration was diffed against `match.js` with comments stripped. Claude: where the old page drew something that comes later (the history, the panels, the overlays, the result view) the call is left out with a comment naming the step, never stubbed quietly; a correction that would lose a frame's result is refused out loud until the history can ask; the sign-in sends the visitor to sign in, as v2 did, since a notice under a full-screen stage would not be seen.
*Rejected:* taking the page's functions from a debugger pause (UV's first choice): V8 keeps no reference to functions nothing calls yet, so in step 1 the write paths cannot be reached that way. A temporary `window` handle in `match-v2.js` (UV's fallback) was not needed either: the test adds the same handle to the script as the browser receives it, so the file is untouched.
*Touches:* `match-v2.js`, `src/match-v2/index.html` (`#mv-notice`), `match-v2.css` (`.mv-notice`)

## 2026-10-30 — The new match page, steps 2 to 5: the stage wired, the panels, settings, played through

*Decided by:* UV ("continue with the whole list here"; earlier: undo the red slide first under the stage; history, stats, timing, scorecard below in that order; settings from the More pop-up; "Offline" and "Someone else has scored" on the stage)
*So:* the rest of `match.js` ported as step 1 was. Claude's choices, for UV to overrule: a button that does nothing now is greyed on the stage, not hidden, and a tap on it says which rule is in the way (overruled by UV the same day: such a button is disabled and a tap does nothing, as on the old page); with breaks not recorded, the break ring is greyed rather than gone (the special wins live, as on the old page: corrected the same day, Claude had greyed them); when the rules let either player have a break & finish, the page asks whose; the lag question and the finish question are pop-ups in the More pop-up's style (the lag one cannot be dismissed, and offers Match settings, since a modal would otherwise trap a match that should not be recording breaks); Pause match closes the pop-up (it said so on the stage until UV's correction below); the lag question was made not "busy" so another phone's answer closed it (reverted the same day, below); the dots go to the ring only while the stage is shown.
*Rejected:* a session pause (UV's brief named pause / play for a session, a player's smoke break): the old page has no such thing to port, and what it means for the clocks and the record is a design question, not a port.
*Touches:* `match-v2.js`, `src/match-v2/index.html`, `match-v2.css` (match.css's sections copied, then "This page")

## 2026-10-30 — The new match page changes the look, never the behaviour

*Decided by:* UV ("all we did was update the UI. I didn't ask you to change any of the underlying functionality of the page"; "you shouldn't be showing me messages for failed presses"; "follow the docs for decisions made in the past"; "glitching when I select some of the break event buttons")
*So:* wherever `/match-v2/` behaved differently from `match.js`, it now behaves as `match.js` did; only the drawing differs. Put back: `busyScoring` (the lag question is busy again, so another phone's answer is held back as before); a watcher sees the lag question with its buttons disabled; the settings panel does not count as busy; the special wins are offered by `resultsFor` and disabled by `resultDisabled` themselves (Claude's retyped rule had greyed them with breaks off, where the old page let them be used); a disabled button does nothing and says nothing; Pause match no longer adds a message; another phone's change fades the scores in again (`data-live`). A break tap no longer sends a pretend wait to the cream ring, which blanked it for a second on each tap. Kept, as the drawing's own needs: the More pop-up and its closing, "B&F: to whom?" where the old page had a B&F on each card, the lag pop-up modal for a player, and "Offline" and "Someone else has scored" on the stage (UV asked for those).
*Rejected:* anything that changes what a tap does, what is saved, or when the page re-reads, without UV asking for it.
*Then (UV, same day):* **reverse B&F is not offered after "In"** ("you shouldn't be able to select RB&F when opposition break event is in"): it is the other player clearing after a break that potted nothing for the breaker. Put in `resultDisabled`, the one place that decides it. The "someone else has scored" line on the stage carries its refresh link, as the old notice did.
*Touches:* `match-v2.js`, `src/match-v2/index.html`, `match-v2.css`, `docs/systems/matches.md`

## 2026-10-30 — The new look goes onto /match/; match.js's behaviour stays

*Decided by:* UV (port the UI updates to the old page; the four layout cases approved as proposed; settings from the more pop-up with the nav hidden; the dots on the cream ring; match.js's messages unchanged, with "Offline · n waiting" and "Someone else has scored" also on the stage; below the stage the notice, the undo slide, history, stats, timing, scorecard)
*So:* `/match/` wears the new stage. Only the functions that drew the old cards, the break pill and the overlays' contents changed; everything else in `match.js` is as committed (checked by diff). The four special wins are fixed buttons, greyed and silent when the old card would not have offered or enabled one; when either player may have a B&F the overlay asks whose; one ⋯ opens one pop-up (both walkovers, Abandon frame, Change table, Pause match, Match settings); the break ring is greyed and silent when the pill would have been hidden. Reverse B&F is not offered after "In" (UV).
*Rejected:* carrying on with `match-v2.js` as a second copy of the page's behaviour (it drifted, and every difference cost UV time).
*Touches:* `match.js`, `src/match/index.html`, `match.css`, `docs/systems/matches.md`

*Then (UV, same day):* **B&F and GB sit on the side of the player breaking, rB&F and the ⋯ on the opposition's half**, so the dots are always on the side that is not breaking. They move when the break passes. Drawing only.

*Then (UV, same day):* **the break event goes live to the other phone as it is tapped.** It was never sent before (checked against `match.js` at `9766988`, 29 Oct: only the saved frame carried it). It is sent as a Realtime broadcast on the match's existing channel, with nothing stored, because the frame carries it once saved. On the receiving phone it does not count as busy, so that phone still follows the saved frame by itself. *Rejected:* storing the frame in play on the match (a migration, and a second record of a frame that is not played yet).

## 2026-10-30 — The break event in play is saved on the match

*Decided by UV:* a break event that has been tapped is shown, solid, whenever the match page is opened, on any phone. The broadcast (above) reached only the phones already open, so a phone opening the match afterwards, or the same phone after a reload, showed none until the frame was saved. UV chose to save it on the match (asked 30 Oct: "B, save it on the match").
*So:* migration `20261030155332` adds `break_in_play`, its frame number and the card version it was tapped at to `tbl_matches`, written only by `tdc_set_break_in_play` (whoever may score, the frame in play, never a settled card). It does not move `card_version`. An event older than the card's version is ignored, so saving, removing or correcting a frame retires it with no clearing and no change to `tdc_record_frame`. The other phones hear it through the `tbl_matches` changes they already follow; the broadcast is gone. The save has no dots on the ring (UV, 30 Oct).
*Replaces:* the same day's "nothing stored", and its rejection of storing the frame in play. It is still not a record of the frame: never counted, and the frame carries the event once saved.
*Rejected:* Realtime presence (lasts only while the tapping phone is open and online); keeping the tap on the phone only (no help to another phone).
*Touches:* `supabase/migrations/20261030155332_match_break_in_play.sql`, `supabase/tests/044_match_break_in_play.test.sql`, `match.js`, `docs/systems/matches.md`

## 2026-10-30 — Buttons a match's settings rule out are hidden; the score meets the buttons

*Decided by UV:* "when a specific setting is turned off, we should hide buttons that aren't used for the match", and without break events no special win can be recorded, so the break ring and the special wins go. The answers were already in the docs (UV: "check all docs"): the old card's footer offered only what the settings allow and always had ⋯ (`docs/design/match-score-input.md` §2), and a player's name and picture sit centred in their area.
*So:* `shownByRules` in `match.js` hides the break ring when breaks are not tracked, B&F and GB when Break & finish is off, GB when Golden break is off, rB&F when Reverse B&F is off; ⋯ always stays. A button the settings allow but that cannot act now is still greyed. The others keep their places and the ring its size. Upright, the score keeps its size and moves in to meet the buttons, the digit at that end of its space, the name centred in the room left; sideways, the score is centred between the page's edge and the buttons.
*Replaces:* the same day's "greyed and silent when the old card would not have offered one" for buttons the settings rule out.
*Touches:* `match.js`, `match.css`, `docs/systems/matches.md`

## 2026-10-30 — The nav stays on the match page; the auto-hide is gone

*Decided by UV:* "Remove the auto-hide on the nav bar in the match page and adjust the stage area accordingly", then "remove the auto-hide completely".
*So:* everything 5ffd9fa added for it is taken out (`navAutoHide`, `data-nav="auto"`, its part of `nav.js` and `nav.css`; those files are as they were before it). The stage is the screen below the nav. The settings panel, its scrim and the floating overlay start below the nav again, as built. The top name keeps its notch padding (UV).
*Replaces:* the same day's "on this page only the nav hides until asked for".
*Touches:* `nav.js`, `nav.css`, `layout.html`, `src/match/index.html`, `match.css`, `docs/ui.md`, `docs/systems/matches.md`, `docs/systems/file-map.md`

## 2026-10-31 — The account dropdown becomes the profile menu, with the theme and motion toggles

*Decided by UV:* the dropdown becomes a menu in three parts: the player banner at the top, the middle (quick links and views, business-ops tools, the sports-track profiles) sunken into the screen with an inner shadow and left empty until discussed, and the UI toggles at the foot on a flat colour, two of them, icons only, an icon for each mode; on a phone it covers the screen (below the bar, UV chose); the banner is the picture and names, and a tap anywhere on it opens the profile; Staff and Log out are left out, to be reached by "some custom solution" later; the theme switch is wanted there so it is reachable at any time.
*Claude's, for UV to advise on:* the banner's look; the second toggle being less motion (the one other customisation Claude listed); less motion reaching only the dots and the drifting light; the choices kept on the device (localStorage) rather than the account; the icons (moon / sun, a ball with speed lines / the ball still between two bars).
*So:* `#nav-account` slides in from the right as the menu does from the left, one at a time. Each toggle is the site's switch with its own icon per side (`data-icon-off` / `data-icon-on`, new and opt-in; every other switch unchanged). `scripts/prefs.js` puts the theme and motion on `<html>` from the head, so a light page never flashes dark.
*Touches:* `nav.html`, `nav.js`, `nav.css`, `layout.html`, `prefs.js` (new), `page-light.js`, `tdc-controls.js`, `ring-status.js`, `variables.css`, `forms.css`, `sandbox.js`, `docs/ui.md`, `docs/systems/file-map.md`, `docs/STATUS.md`, `docs/product/features.md`

## 2026-11-01 — The animation picker: every animation in its own card; the dots stay dots

*Decided by UV:* every animation plays in its own card, the site's moves too; the dots are always dots, turning into a shape only for a moment and back (the permanent shape control dropped); loops present seamlessly, with randomness where possible; where there is a ground it looks 3D, not a flat line; organic motion preferred; more maths, physics and sports scenes; a window that plays the whole set marked for the loop; scenes that play with fake light and shadow.
*Claude's, for UV to judge:* the site's moves shown through a frame per card of a bare page running the real dots.js (the dots are one set to a page, so this is the only way to show them side by side without reimplementing them); that frame's ring line made 2.5 times the site's so the dots read at card size; the two kinds of loop (a scene that returns to its start goes straight round; any other fades out and comes back redrawn); The loop's six seconds per animation.
*Touches:* `sandbox/animations/index.html`, `sandbox/animations/move/index.html` (new), `sandbox-animations.js`, `sandbox-move.js` (new), `sandbox.css`, `docs/ui.md`, `docs/systems/file-map.md`, `docs/STATUS.md`

## 2026-11-02 — The match stage: a green pill, a yellow toggle, and the dots idling in it

*Decided by UV:* the special wins and the scores inside a green pill (line only, the page's glow and shadows), the four buttons filling its round ends as quarter circles, their words along the round edge and sized to the button; sideways the pill fills the space under the names, upright it stands between them (UV chose the narrower mock, "C", over a full-width pill that left the scores about 52px tall); B&F and GB stay on the breaker's end (the 30 Oct rule). While breaks are recorded, a yellow pill two break rings long round the break ring, the break ring and the info ring moving in it as one, like the team card's switches, and only once the load is done (the dots back). The breaker's yellow glow inside the green pill's breaker half, the line staying green; then stronger, round the middle edge too, behind the buttons and the score, never in them; the line between the halves hidden behind the yellow pill but not the green one; an outer glow on the breaker's half of the **yellow** pill only. The scores always the same size, and centred in their space. A grey dot at each end of the yellow pill; at the empty one the page's one set of dots (never on both: they move between the info ring and the idle dot) plays the pool move, the two balls on the tilted table, not the break: still 10 s (first 5), pool 5 s whatever its state, back into the dot; when the toggle moves, they start at the other end; after a save where it does not, they fly back and gather into the dot. In and out straight to the centre. Grey on the idle dot, cream on the info ring. The pool's balls the idle dot's size, then a little smaller; resting on the table with a realistic shadow from a light source that they meet; trails weaker; depth gentler; shadows constant.
*Claude's, for UV to judge:* the pill's sizes (upright at most 0.52 of the width, at least 3.4 times as long as thick; the ring 0.57 of its thickness); the light for the pool's shadows being the page's drifting light, 50° above the table; in an end, the first button top sideways and left upright; the idle grey being `--text-muted` (the switch's stops are cream at 35%); the trails made weaker by shortening them (no engine setting for strength).
*So:* `match.js` draws the pill's buttons and runs the toggle (`placeKnob`) and the idle controller; `dots.js` gains three serve options (`move`, `from: 'centre'`, `end: 'gather'`), inert unless asked for, and the pool move's new look everywhere.
*Replaces:* 30 Oct's special wins in slots round the ring, the score against the buttons, the breaker's screen-half outline.
*Touches:* `src/match/index.html`, `match.js`, `match.css`, `dots.js`, `docs/systems/matches.md`, `docs/systems/dots.md`, `docs/STATUS.md`

## 2026-11-02 — The green pill becomes a rounded rectangle, so the scores can grow

*Decided by UV:* the green pill fills the width upright and the height sideways (stopping at the name strips), its corners keeping today's radius; the special wins stay quarter circles tucked into the corners; where space opens between an end's two buttons, a score takes it only if its numbers fit there (bigger).
*Claude's, for UV to judge:* the ring and yellow toggle kept at today's size (sized from the old thickness); the larger tap area for a plain win (the gap is part of the score's box).
*So:* a phone held sideways is unchanged (the pill was already as tall as the space; its corners meet); upright the scores roughly double; a wide screen sideways gets a taller pill.
*Touches:* `match.css`, `match.js` (`pillBox`, `winButtons`, `fitScores`), `docs/systems/matches.md`

## 2026-11-02 — The special wins become pills bent round the corners

*Decided by UV:* each special win and the more button is a pill only as tall as its word, bent to the green pill's corner radius, tucked into the corner; where that frees space the scores grow into it, as decided before (only if they fit there bigger).
*Claude's, for UV to judge:* the word's size and padding (the break words' proportion); the pill reaching round the corner short of its straight edges by its round end and a gap; the digits centred in the span left between the bands and the rings, not in the whole box (centred in the whole box they ran into the bands on a phone held sideways).
*Replaces:* the same day's quarter circles.
*Touches:* `match.js` (`cornerBand`, `winBand`, `winButtons`, `fitScores`), `docs/systems/matches.md`

## 2026-11-02 — Only the pill wins a frame; a green centre line; the left player mirrored

*Decided by UV:* only the space inside the green pill is the plain-win button (the names no longer are); the centre line inside the green pill is green with the pill's glow, on the side that is not breaking when breaks are recorded, both sides otherwise; sideways, the left player's picture on the right and the names right-aligned.
*Claude's, for UV to judge:* the yellow pill's empty part counts as inside the pill (a tap there is a win; the break ring and special wins take their own taps); the centre line's glow follows the toggle as it slides.
*Touches:* `src/match/index.html`, `match.css`, `match.js` (`renderStage`, `glowMasks`), `docs/systems/matches.md`

## 2026-11-02 — The light theme's muted grey is #a3a3a3

*Decided by UV:* the light theme's `--text-muted` becomes a real grey, site-wide: first the dark theme's #808080, then #a3a3a3, set by UV in the file the same day. It had been #20333b, the same as `--text-primary`, so every muted element in light mode (muted text, disabled buttons, the match page's idle dots) drew as the main text colour.
*Rejected:* a token for the idle dots alone; a warm grey (#8a8178).
*Touches:* `variables.css` (UV may still retune it on `/sandbox/`)

## 2026-11-03 — The site saves battery: the light rests, the idle dots sleep, less motion while the phone saves power

*Decided by UV:* the drifting light rests where it is after 30 s without a touch and drifts on at the next; the match stage's idle dots stop after 2 minutes without a touch and start again on the next; less motion goes on by itself while an Android phone saves data or is low on battery; and the three changes nobody sees (the light on a timer rather than every frame, the match clock writing only what changed, live sockets let go while a page is hidden).
*Claude's, for UV to judge:* "low battery" is 20% or less and not charging; a choice on the profile menu's toggle always wins over the battery; a touch means a tap, key, scroll or wheel, and the page being shown again counts as one; the idle dots wake into the usual 10 s rest rather than playing at once; the match page keeps its live socket while hidden (its re-read is skipped mid-frame, so letting go could miss a frame scored elsewhere).
*Why:* measured idle in headless Chrome, the light alone kept a page at 3.7% CPU and 14 restyles a second on a fast laptop, several times that on a phone, for as long as a page stayed open on the table.
*Rejected:* lowering the light's write rate (it would step visibly); a lighter light on phones only.
*Touches:* `page-light.js`, `prefs.js`, `match.js` (`paintTimes`, the idle controller), `league-fixtures.js`, `league-standings.js`, `league-card.js`, `tournament-bracket.js`, `docs/ui.md`, `docs/systems/matches.md`, `docs/STATUS.md`

## 2026-11-03 — The install tutorial: drawn iPhone screens, one green dot, Full and Compact

*Decided by UV:* a page showing how to install the app, its pictures redrawn as SVG from UV's own screenshots, everything personal (contacts, apps, widget, wallpaper) replaced by plain shapes. The first version covers iPhone (Safari and Chrome), Android Chrome, and the "open this in your browser" screen for links opened inside Instagram or Facebook. On Android and desktop Chrome: both the one-tap Install button and the steps. Safari first. The whole process is one animation with a single flat dot in the site's green for the finger (moves, taps, the drag, typing), quick between points; the clock always 16:20; the status bar laid out as iOS draws it; no phone frame, only the rounded screen; "Open as Web App" shown off and then switched on. A Full / Compact switch, animated between the two: Compact puts a small screen beside the live step at the top of the page, so it stays in view above the half-open Share sheet, the steps scrolling past as the animation runs. The page opens in Full until switched. The animation keeps step 1 (typing the address); the real page's numbered steps start at ⋯, since anyone reading it is already on the site.
*Claude's, for UV to judge:* the soft shadow under the screen (so its corners show on the dark page); the drag in step 4 made on the sheet's header (on UV's phone everything fitted without one; a smaller iPhone needs it); the battery at 80% and the 4G label; Compact about 198px tall with an 84px-wide screen (the half-open sheet leaves about 211px under the site's bar; the heading folds away in Compact so the block sits right under it).
*Why:* a drawing carries nobody's contacts or notifications, follows the site's own icon and logo files when they change (`apple-touch-icon.png`, `icon-primary.svg`, `logo-primary-dark.svg` are referenced, not copied), and weighs a few KB.
*Rejected:* real screenshots; Claude taking them (it cannot see a phone's own screens).
*Touches:* nothing in the repo yet; the draft is the claude.ai artifact "Install on iPhone" (https://claude.ai/artifact/BFoihUrXck3AnBZYwTujnB)

## 2026-11-03 — Payments before spending, designed as one

*Decided by UV:* the payment gateway (PayFast, STATUS P4) is built and working before anything spends credits. Ledger changes for spending, entry-fee charging, part-payment, the travelling-league fee scope and splitting a table all wait for it. Payments and spending are designed together, in one document UV reads and understands in depth, before any of it is built.
*Why:* UV does not want money handled by pieces built in different places at different times. He needs to understand the whole design of how money comes in and how it is spent.
*Rejected:* Claude's suggestion (3 Nov) to build the ledger's spending changes and entry fees now, with credits loaded by codes, and add the gateway later as one more way in.
*Touches:* `docs/STATUS.md` §0 (P4)

## 2026-11-03 — Light and dark apply everywhere, the artwork included

*Decided by UV:* "The point of the light and dark schemes is that it's applied everywhere, consistently." Every logo and icon the site draws follows the theme: the light theme shows the `-light` files (`logo-primary-light.svg` on the home page, `logo-mark-light.svg` in the nav and on the loading screen), the dark theme the dark ones.
*So:* an `<img>` draws the colours its file holds, so each is placed twice, the dark file with `.for-dark` and the light with `.for-light`, and one rule in `global.css` hides the other theme's. It lasts until the logo goes inline (22 Oct). Anything new that is drawn in fixed colours must follow the theme too.
*Not yet following it (found 3 Nov, for UV):* the install tutorial's drawing (it draws the dark home screen in fixed colours), and the phone's status bar (`theme-color` is #202020 in both themes).
*Touches:* `global.css`, `_includes/nav.html`, `_includes/layout.html`, `index.html`, `docs/ui.md`

## 2026-11-03 — The share picture

*Decided by UV:* option A (the full logo centred under the site's green light) with option D's green band across the foot, "OPENING SOON" in the background colour, and a hard shadow along the top edge so the logo sits sunken (the site's own page-edge shadow: 70% black, 14px blur, cast 10px). "Opening soon" is a placeholder until opening. The hero picture waits for the home page design.
*Why:* chosen from six options at https://claude.ai/artifact/F1ymSFgb3hiUDQQEfGm2pQ (option F there; its page renders each at 1200 × 630, so the picture can be remade from it when the words change).
*Touches:* `src/resources/branding/social-share.jpg` (1200 × 630, 68 KB). Nothing shows it until `layout.html` has share-preview tags (`docs/STATUS.md` §1, item 4)

## 2026-11-03 — Share tags; the install drawing and the phone's bar follow the theme

*Decided by UV:* share-preview tags on every page, so a pasted link shows the share picture. The install tutorial's drawn iPhone follows the theme, the whole drawing: iOS in light mode with the site's light screen in the light theme. The phone's bar follows the theme wherever the phone allows.
*So:* `layout.html` carries `og:` and `twitter:` tags from each page's title and description, with the one share picture. `prefs.js` sets `theme-color` to the theme's `--bg-base` and asks an installed iPhone app for dark status-bar text in the light theme. The manifest stays #202020 (fixed at install). The drawing's colours are tokens in `install.css`, with light-mode values; seven stay fixed, the same in both (`docs/systems/foundations.md`). This replaces the 3 Nov build's choice to keep the drawn iPhone dark in either theme, which was Claude's.
*Unconfirmed:* whether iOS honours the status-bar style set by script before the first paint; only an iPhone can show it (`docs/STATUS.md` §1, 4a).
*Touches:* `_includes/layout.html`, `scripts/prefs.js`, the three forwarding pages under `/leagues/`, `_includes/install/safari.svg`, `stylesheets/install.css`

## 2026-11-03 — The dive: the loader, at rest the logo

*Decided by UV:* the email GIF's diver, redrawn as an SVG (approved at https://claude.ai/artifact/FABxymhx8RrGu1Q7ifLy5J), becomes the loading overlay, and the nav icon's loader under reduced motion in place of the dots. "The logo is static until loading happens. That's when she dives and the animation starts looping during loading." Her timing stays the GIF's, with a top speed. In the light theme she takes `logo-mark-light.svg`'s colours (navy suit, cream skin), not the `--logo-*` pair, which would swap them.
*So:* `_includes/dive.svg` + `scripts/dive.js`, on `/sandbox/dive/` only for now; wiring it into the loader and the nav is the next job.
*Claude's, for UV to confirm:* when loading ends she goes through, falls in once more and stops in the logo pose (no pause, no easing); she vanishes at the hole's near edge, not below the ring as in the GIF; a fall is never shorter than the box (she always enters from above).
*Touches:* `_includes/dive.svg`, `scripts/dive.js`, `scripts/sandbox-dive.js`, `sandbox/dive/index.html`, `sandbox/index.html`, `stylesheets/sandbox.css`, `stylesheets/variables.css`

## 2026-11-03 — The portal rim is shaded; the icons follow

*Decided by UV:* the logo mark's portal rim gets the same black gradient as the wordmark (`gra_m_all`), in `icon-primary.svg`, `logo-mark-dark.svg` and `logo-mark-light.svg`, and the change goes everywhere the mark appears.
*So:* pages that show the SVG files needed nothing. `dive.svg` was rebuilt from the new file, and its build script kept as `tools/dive-svg/build.js` so the next change is one command. The app icons, favicons and `icon-primary.png` were re-rendered from the new `icon-primary.svg` by Claude, at their old sizes and framing (headless Chrome; rendering the old SVG the same way reproduced the old icons to within 146 pixels in four million). An installed app keeps its old home-screen icon until it is added again.
*Not yet:* the email GIF keeps the old rim; rebuilding it is its own job (`docs/BACKLOG.md`, item 3).
*Touches:* the three logo SVGs, `_includes/dive.svg`, `tools/dive-svg/`, `resources/icons/*`, `favicon.ico`, `branding/icon-primary.png`

## 2026-11-03 — The dive wired in: the loading screen everywhere, the nav's icon under reduced motion

*Decided by UV:* the diver replaces the loading screen's dots "everywhere, all the time", falling the full length of the screen into the portal at its foot, with **the wordmark behind, centred on the screen and scaled to fit** ("on strange phones which are long, the wordmark will be smaller than the diver and portal relatively"). **The dots stay on buttons and network calls.** With reduced motion "she is the reduced motion mode": the screen still dives, the ring breathes beside her (kept for now, may go), and wherever the dots would be out (a tap's save, a section loading) the nav's icon dives and loops instead; the tapped control keeps its breathing. **No delay between drops** in any of them: the next starts the moment she is through the hole.
*So:* the drawing once per page in a `<template>`, cloned by `loader.js` (frame `fit`) and `nav.js` (frame `logo`, in place of the `<img>`, which stay hidden as the fallback); `dots.js` says when, under reduced motion, anything is waiting (`TDCDots.waiting`, `tdc-dots-waiting`), and `loader.js` when the screen goes up or down (`tdc-loader`). A wordmark-only drawing (`wordmark-dark.svg` / `-light.svg`) made by the dive's build script from the full logo, never retyped.
*Example:* with less motion on, tick Paid on tournament manage: the box breathes; after 150 ms the nav's diver drops through the hole, again and again; the save is back, she goes through once more, falls in and rests.
*Claude's, for UV to confirm:* the screen fades as soon as the page is ready, without waiting for her to land (she finishes during the fade); both the screen's and the nav's diver wait 150 ms (the dots' `GRACE`) before diving, so an instant page or call shows her still; the wordmark's margin is 16px each side.
*Touches:* `_includes/layout.html`, `scripts/loader.js`, `stylesheets/loader.css`, `scripts/dots.js`, `scripts/nav.js`, `stylesheets/nav.css`, `scripts/dive.js` (`pause` 0), `sandbox/dive/index.html`, `tools/dive-svg/`, `resources/branding/wordmark-*.svg`

## 2026-11-03 — The loading screen's wordmark is as wide as the portal

*Decided by UV:* fitted to the screen the wordmark was "way too big on some screens and too striking"; it stays centred, its width proportional to the portal and diver.
*So:* its width is the portal's on screen times `--loader-wordmark` (1 for now), reported by `dive.js` after each layout (`onLayout`); never wider than the screen less 16px a side. At 420 wide it is 272px, the portal's width, where it was 388.
*Touches:* `scripts/dive.js`, `scripts/loader.js`, `stylesheets/loader.css`, `stylesheets/variables.css`

## 2026-11-03 — No breathing ring on the loading screen

*Decided by UV:* "The breathing ring shouldn't be on the overlay loader." The diver alone is the loading screen, in both motion modes (it had been kept under reduced motion, beside her).
*So:* the ring's element, its CSS, its serve in `loader.js` and its tokens `--loader-size` / `--loader-stroke` (with their main-sandbox entries) are gone. A tapped control still breathes under reduced motion.
*Touches:* `_includes/layout.html`, `scripts/loader.js`, `stylesheets/loader.css`, `stylesheets/variables.css`, `scripts/sandbox.js`, `scripts/dots.js` (a comment)

## 2026-11-03 — The match info goes to the idle dot; the break buttons are quarter circles

*Decided by UV:* the frame and win condition leave the cream ring in the break ring's hole for the yellow pill's empty end, where the idle dot was, in grey, its ring with it; the idle pool shrinks the words into the dot, plays, gathers back and grows them again; the end being covered gets the new words while hidden, never faded. The break buttons become quarter circles, now the middle is free. Every button's words as big as fits, the break buttons' and the special wins' alike. While nobody is known to break, both ends show only the grey dot and a call's dots run round the yellow pill.
*Claude's, for UV to confirm:* with breaks not recorded the grey info ring sits in the middle and the pool plays there (UV: "apply as you see fit"); "as big as fits" is one size per group (the four break words, the three special wins), not each word its own maximum.
*So:* `docs/systems/matches.md`, "The info rings and the quarter circles". The special wins' bands thicken with their words, so the scores have a little less room.
*Touches:* `match/index.html`, `scripts/match.js`, `stylesheets/match.css`

## 2026-11-03 — The loading screen's scene is the screen's width over the golden ratio

*Decided by UV:* the scene was a bit too big; side padding, with the wordmark, the diver and the portal each the screen's width ÷ 1.618.
*So:* the dive's new `across` option (1 / 1.618 on the loading screen) sizes the portal, ladder and diver together, still within the dive's height limit and its largest size (360px diver), so a PC keeps the scene at 300px; the wordmark takes the scene's width (`onLayout` now reports it), times `--loader-wordmark` (1). At 420 wide both are 256px, where the scene was 300 and the wordmark 272.
*Touches:* `scripts/dive.js`, `scripts/loader.js`, `stylesheets/loader.css`, `stylesheets/variables.css` (a comment)

## 2026-11-03 — A footer on every page

*Decided by UV:* a simple site-wide footer, approved from a mock-up artifact with these changes: the name as tall as the mark beside it; the headings' size and spacing fixed; links made clearly links next to the Visit text; on a phone the mark and name centred, the rest as it was; social links added, all in green, to be linked later; a shadow above the footer so the page looks sunken behind it.
*Claude's, for UV to confirm:* Instagram, Facebook, TikTok and WhatsApp as the four socials; links cream with a half-strength green underline, plain information muted; About and Contact kept although they have no pages yet; the tagline wording; the match page without the footer.
*So:* `docs/ui.md`, "The footer".
*Touches:* `_includes/footer.html` (new), `stylesheets/footer.css` (new), `_includes/layout.html`, `match/index.html`

## 2026-11-05 — The player profile page, from the combined design

*Decided by UV:* the three profile designs combined into one (artboard D, every element kept, the sport selector left out), then built on `/players/` with a toggle below Compare with me between the player's profile and head to head. Four answers before building: Follow, Challenge, the rematch, Honours' trophies and Home venue are shown though nothing is behind them, and a tap says "not built yet"; a team league night counts as a match the player played a frame in, won if their side won; the period is All time · Last 90 days · Last 30 days ("this season" has no single meaning across leagues); signed in only.
*Claude's, for UV to judge:* only finished matches and their finished frames count (a match in progress, or a league night not yet signed by both, adds nothing); head to head counts only the frames the two played against each other, a meeting won by whoever won more of them; "Lags won" is frames broken, as the standings count it; honours shows the golden breaks, break and finishes and best win streak that can be counted today, beside a Trophies tile not built; a bar under the nav with Back, Share (works) and More (not built); the team's place ranked with that league's own standings columns; your own profile shows no toggle and no buttons for others.
*Noted:* STATUS §0 says D1 (one profile, an environment per sport) should be settled before the player page. UV set the multi-sport option aside for this build.
*So:* `docs/systems/players.md`.
*Touches:* migration `20261105044302_player_profile.sql`, `supabase/tests/045_player_profile.test.sql`, `players/index.html`, `scripts/player.js` (new), `stylesheets/player.css` (new)

## 2026-11-05 — The player page's hero: picture and names either side of the centre line; the large picture

*Decided by UV:* the picture right-aligned to the centre line, the display name and full name left-aligned to it; a tap on the picture shows it large, in the green ring with the glow, closed by any interaction, animated both ways (players use it to identify each other, so it matters); the chips under the names move to About.
*Claude's recommendations, UV said "implement" without picking:* a player with no photo gets no large picture (initials identify nobody); of the chips only the discipline is new to About, as a Plays row, since Verified, Home venue and Since were already rows.
*Claude's, found while building, for UV to judge:* a display name keeps 2.75rem where it fits and shrinks only until its longest word fits its half, wrapping between words, never inside one (the half is 172px on a 420 phone, narrower than "Shadow" at full size); the large picture is at most 36rem, so a 512px picture is never shown blown up; with less motion it fades instead of growing.
*So:* `docs/systems/players.md`, "The hero" and "The large picture".
*Touches:* `players/index.html`, `scripts/player.js`, `stylesheets/player.css`

## 2026-11-05 — The player page's buttons as ring icons; Compare as a third tab

*Decided by UV:* no Back button or "Player" title; Share and More grouped with Challenge and Follow, all four as ring icons; Challenge's icon is the break icon from the league scorecard (the spotted cue ball), in a green ring, the other three cream; Compare with me becomes a tab beside Profile and Head to head, the old Head to head split in two: Head to head keeps your meetings, Compare takes Side by side.
*Claude's, for UV to judge:* the new icons' drawings (Follow: the person with a small plus; Share: an arrow up out of an open box; More: three dots), added to the site's ring set so any page can use them; the tab named "Compare"; the rings 3rem, with no word under them (each named by its tooltip); on your own profile only Share and More.
*So:* `docs/systems/players.md`, "The buttons and the tabs"; `docs/ui.md`, "Buttons as ring icons".
*Touches:* `players/index.html`, `scripts/player.js`, `stylesheets/player.css`, `scripts/ring-status.js`

## 2026-11-05 — No bold icons, site-wide; the player Profile tab's second pass

*Decided by UV:* every icon's line is as heavy as the ring it sits in, site-wide; icons drawn as dots or spots stay solid; icons with no ring are thinned to the same weight. On the player page's Profile tab (Compare later): the names bottom-aligned; Form is the last 10 frames across all matches, showing where they broke; the stats as four equal boxes in a row, wrapping where they don't fit: Frames (win %, green; P · W · L), Matches (win %, green; P · W · L), B&F (count, yellow; GB · rB&F), Conversion (win % on their own break, cream; Lags · FW); the per-night chart becomes the frame difference, negatives under the base line, the last 15 nights, its heading changed; On the break removed.
*Claude's, for UV to judge:* "the ring's weight" for an icon with no ring is a standard ring's line (5% of `--ring-size`, 1.8px) at any size; an icon in a bordered circle (the slide's knob, the verified tick) takes that border's 2px; Matches adds "· D n" only when there is a draw, or P would not add up; a night that came out even is a short grey stub on the line; the boxes wrap at 9rem (2 × 2 on a phone, 4 across on a PC).
*So:* `docs/ui.md`, "No bold icons"; `docs/systems/players.md`, "The Profile tab, second pass".
*Touches:* `stylesheets/status.css`, `nav.css`, `controls.css`, `league.css`, `footer.css`, `variables.css` (`--icon-line`, `--chevron-stroke`), `scripts/ring-status.js`, `tdc.js`, `league-season.js`, `players/index.html`, `scripts/player.js`, `stylesheets/player.css`

## 2026-11-05 — The player page's match lists: every state, a page at a time

*Decided by UV:* Leagues & teams becomes **Teams** (the list as it was), at the top of the Profile tab; a new **Competitions** section with **Leagues** and **Tournaments**, 4 matches a page; Recent matches 5 a page, its look kept; a page number at the right of each list's heading; each match with the fixtures' state strip; the lists show matches in every state (a migration), while the stats still count finished matches only; a league night shows once the player is in their team's lineup; Last match frames removed; Honours removed until built, kept as a to-do (`docs/BACKLOG.md` §2 item 9).
*Claude's, for UV to judge:* before the lineups lock, the night is found through its **squad** (who is available, open to read), not the order, which is a blind exchange until both sides lock and would tell an opponent who is playing; after the lock the frames carry it, as before. The page number is the site's stepper on its side; the strip's colours are exactly the fixtures' (so not started is plain green and finished is lit green); a match with no frames shows "–" for its score; Competitions sits where Leagues & teams was.
*So:* `docs/systems/players.md`, "The Profile tab, third pass" and "Every state, counted or not".
*Touches:* migration `20261105064410_player_profile_every_state.sql`, `supabase/tests/045_player_profile.test.sql`, `046_player_profile_every_state.test.sql` (new), `players/index.html`, `scripts/player.js`, `stylesheets/player.css`, `docs/BACKLOG.md`

## 2026-11-05 — The player page's Compare tab: the two profiles side by side

*Decided by UV:* each profile next to the other with an explicit centre line in the match stage's style (with its shadow); each player's picture and display name at the top of their half, below the tabs, frozen as the page scrolls, styled and aligned as on the stage; Form as vertical dots; the frame difference as vertical graphs; About one combined table with the headings in the middle and every cell centred. Answers before building: every Profile section goes in; the old Side by side bars go; yours is the left side; one period switch for both.
*Claude's, for UV to judge:* the centre line is the two halves' inner shadows meeting, as on the stage, not a drawn line; section headings run across both halves; in a half the match and team rows drop their pictures and the win or loss dot, scores smaller; a list's page number sits under its heading; the stat boxes one column per half on a phone, two by two on a PC; down the page the frame difference has won to the right of the line, newest night at the foot; Leagues and Tournaments are separate rows so their headings line up.
*So:* `docs/systems/players.md`, "The Compare tab".
*Touches:* `players/index.html`, `scripts/player.js`, `stylesheets/player.css`

## 2026-11-05 — Tournaments open for entry, found without a link

*Decided by UV:* players can find open tournaments on `/tournaments/` without being sent a link; the tournament's creator marks it **visible to public** (a switch, not every shareable tournament); only signed-in players see the list; **switching Visible on also shares the poster**, since entering happens on the poster.
*Claude's, for UV to judge:* stopping sharing the poster turns Visible off, and Visible off leaves the poster shared; Visible on with no poster builds one with names and draw left out; Draft counts as open for entry unless set by hand (a tournament reads Draft until its first entry); a full tournament stays listed, marked Full; ones you run or have any entry in (withdrawn too) are not repeated under Open for entry; the badge uses the poster's button words.
*Rejected:* listing every tournament whose poster is shared (no switch); showing the list to signed-out visitors, which would need a live read open to `anon` that the poster's snapshot design avoids.
*So:* `docs/systems/tournaments.md`, "Open for entry, and Visible to public".
*Touches:* migration `20261105084149_tournament_listed.sql`, `supabase/tests/047_open_tournaments.test.sql` (new), `tournaments/index.html`, `scripts/tournaments.js`, `tournaments/new/index.html`, `scripts/tournament-new.js`, `tournaments/manage/index.html`, `scripts/tournament-manage.js`

## 2026-11-05 — An empty draw: "No one" in Who goes in

*Decided by UV:* the draw page's Who goes in gets a third choice, **No one**: the matches are made and wired round to round but not filled. An empty draw's size is a **Draw size picker (4, 8, 16, 32, 64) starting at the tournament's max entrants**. An empty slot that is not a bye reads **"Open"**.
*Claude's, for UV to judge:* the seeds are left alone by an empty draw; with no max entrants the size starts at everybody signed up (64 at most); a slot the director empties by hand now reads "Open" too, where it used to say "Bye"; the database accepts any power of two from 2 to 1024, the picker offering five.
*Rejected:* always sizing an empty draw by max entrants with no picker (refused when a tournament has none); sizing it by the number signed up so far.
*So:* `docs/systems/tournaments.md`, "An empty draw".
*Touches:* migration `20261105093205_empty_draw.sql`, `supabase/tests/048_empty_draw.test.sql` (new), `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`

## 2026-11-05 — The draw page redesigned: views, cards, zoom

*Decided by UV:* three icon-only toggles with their own icons (Linear | Outside to inside; rounds Horizontal | Vertical; a card's players Horizontal | Vertical); font size and zoom steppers beside them; the league fixtures' card styling, the match state as on the profile and fixtures, each player's picture; the card opens its match and the Open match button goes; the arrows leave and enter where the view puts them. Answers before building: **the card opens the match anywhere but its buttons and names, and a card with no match is not a link**; **arrows into a side-by-side card enter the edge facing the round they come from, home at its first third and away at its second**; **outside to inside splits each round by where its matches lead (following the arrows)**; **font 70–150%, zoom 50–150%, steps of 10, every view setting kept on the device**; **names: the standings' Full names switch, kept on the device**; **a bye shows only the player going through** (no badge, no empty slot); **the director's buttons stay small text buttons under the card for now**.
*Claude's, put to UV:* a director still sees a bye's empty slot as its swap icon alone, since it is the only way to seat a late arrival there.
*Claude's, for UV to judge:* an award (walkover, withdrawal, decision) reads Finished on the strip; an empty slot shows a dashed circle so names line up; a smaller picture and score on a phone; the toggle icons; arrows into a stacked card in rows come in at a third and two thirds of its top edge (UV's side-by-side rule turned on its side); rounds stay top-aligned in columns and left-aligned in rows, not centred; from the outside in, adding a round or a match is offered on the left half and the middle only, and "+ Round" only in the linear view; text size grows the cards with the text (widths in em), pictures stay their size; zoom scales the draw alone, not the view row.
*Rejected:* splitting rounds by position for outside to inside; ring icon buttons for the director now; a separate icon toggle for names.
*So:* `docs/systems/tournaments.md`, "The draw page redesigned".
*Touches:* migration `20261105095518_draw_pictures_full_names.sql`, `supabase/tests/049_draw_pictures_full_names.test.sql` (new), `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`, `stylesheets/bracket.css`

## 2026-11-05 — Players dragged onto the draw; the Wiring panel goes

*Decided by UV:* every entrant as a pill (picture left, name inside, only as wide as the name) in a row under the draw's view toggles, each draggable; a pill dropped on a card's slot changes the player; a player dragged from one round to another changes the progression wiring, replacing the Wiring panel; the confirmation comes up by itself on the drop, with no panel and no button. This reverses Claude's 21 Oct "a picker, not drag-and-drop" (accepted by UV then).
*Claude's, for UV to judge:* the pills are the director's alone (the entrant list is theirs) and leave out withdrawn entrants; on a phone a drag starts after holding 0.35 s, so a swipe still scrolls; a slot dropped on its own round is ignored; a drop into the third-place playoff wires the loser, anywhere else the winner; an empty or "Winner of …" slot can be dragged too (it stands for whoever comes out of its match); the picker on a name stays, for a keyboard and a one-handed tap; the arrows are no longer clickable; a line under the pills says how to drag. **Lost with the panel:** un-feeding an empty slot (pointing it at nothing).
*So:* `docs/systems/tournaments.md`, "Dragging players onto the draw".
*Touches:* migration `20261105102452_entrants_pictures.sql`, `supabase/tests/050_entrants_pictures.test.sql` (new), `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`, `stylesheets/bracket.css`

## 2026-11-05 — The draw's cards, second pass

*Decided by UV:* arrows out of a side-by-side card leave on the correct side; a toggle to hide pictures; no player numbers beside names; a finished match's indicator split in two, the loser grey and the winner green; on side-by-side cards the indicator at the top or bottom depending on the view; every match being played yellow; tighter spacing on the cards; cards centred both ways where possible.
*Claude's, for UV to judge:* "the correct side" read as the side of the slot the arrow feeds (a third of the exit edge for home, two thirds for away), as arrows arrive; the side-by-side strip along the top, and along the bottom only for the right half from the outside in with rounds in rows (where its arrows come in from below); "being played" as any match with frames in, whatever its status says; the pictures toggle as a fourth icon pill; centring as spreading a round's cards evenly (`space-around`), which also lines a round up with the pairs feeding it.
*So:* `docs/systems/tournaments.md`, "The draw page redesigned", second pass.
*Touches:* `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`, `stylesheets/bracket.css`

## 2026-11-05 — The draw page, third pass

*Decided by UV:* arrows always leave a card from the correct side where the view and card allow; cards as small as possible (no wide gap between name and score); no Playing badge, the yellow status only; text size and zoom as horizontal steppers the toggles' size; steppers for the vertical and horizontal space between cards; a red cross in a ring on every card for the director to delete the match, on the card's top right corner over its edge; the director's settings at the foot in a folding group; generating the draw always available to the director, a folding group above the status and progression settings.
*Claude's, for UV to judge:* "the correct side" as the side of the slot fed, in every view (a third / two thirds along the exit edge); the cross runs the existing removal, so a match that has been started is refused (its frames were really played) and one still wired to a later slot is named, not removed; progression and match starting asked only in Running the draw (Generate saves only third place, locked once a draw exists); Generate open by itself only while there is no draw; spacing 0–64px in steps of 4, defaults 8 down and 16 across.
*So:* `docs/systems/tournaments.md`, "The draw page redesigned", third pass.
*Touches:* `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`, `stylesheets/bracket.css`

## 2026-11-05 — The draw page, fourth pass

*Decided by UV:* a button to fit every card on the screen by adjusting sizes, spacing and zoom while keeping the toggles; a button for full screen; no "change who is in this slot" button on the cards (players are changed by dragging); in rows, the round headings as vertical text on either side of each round; a bin in the entrants section to drag a player from a match onto, to take them out of it; active matches yellow.
*Claude's, for UV to judge:* Fit tightens spacing to 4 down and 8 across, keeps the text at 100% unless even 50% zoom will not fit, and grows a small draw up to 150%; full screen is the view row, the entrants and the draw together, and covers the page where the browser cannot (an iPhone); names became plain text for a director too, so a tap opens the match; "active" read as every match that exists and is not finished or abandoned; dropping on the bin goes through the same check, reason and warning as any drop.
*So:* `docs/systems/tournaments.md`, "The draw page redesigned", fourth pass.
*Touches:* `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`, `stylesheets/bracket.css`

## 2026-11-05 — The draw page, fifth pass

*Decided by UV:* + Match attached to each round's heading, below it; the + to add a round always visible, between the round names; a card's round name the same as its heading's; rounds named Last 16, Last 32 and on.
*Claude's, for UV to judge:* the Final and the third-place playoff named alone on their cards ("Final", not "Final · Match 1"); slots' short form "Winner of QF 2", "Loser of SF 1", "Winner of L16 3" ("R1 · M2" for an unnamed round); in rows, + Match under the left-hand name and the + between rows at the left; the round heading a fixed 2rem line, which also dropped a 2rem margin the site's heading style had been adding above it.
*So:* `docs/systems/tournaments.md`, "The draw page redesigned", fifth pass.
*Touches:* `scripts/tournament-bracket.js`, `stylesheets/bracket.css`

## 2026-11-05 — The draw page, sixth pass

*Decided by UV:* text size and zoom any value, with a larger cap; + Match in the same orientation as the round heading, below it; in full screen, the settings as an auto-hiding bar like the nav bar and the draw centred both ways; the rules badge as a button like + Match; the arrows' heads and lines sized by the text; Fit making the text as big as possible; a Reset view button.
*Claude's, for UV to judge:* caps of 300% for both, floors of 50% text and 25% zoom; Fit holding zoom at 100% and searching the text size, the spacing growing with it; arrows scaled by text size times zoom; pictures and the card's buttons growing with the text too; the bar showing near the top (64px) and hiding after 3 seconds or a 200px scroll down; the entrants hidden in full screen; Reset leaving Full names alone.
*So:* `docs/systems/tournaments.md`, "The draw page redesigned", sixth pass.
*Touches:* `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`, `stylesheets/bracket.css`

## 2026-11-05 — Filling and shuffling the draw's first round

*Decided by UV:* in Generate the draw, a button to fill the first round's available slots and a button to shuffle every first-round player across its matches; filling in random order; a shuffle deletes first-round matches with no frames and is refused once any has a frame.
*Claude's, for UV to judge:* a bye's empty slot counts as available (filling it ends the bye); a walkover, withdrawal or decision in the first round blocks the shuffle; No one in Who goes in fills from the confirmed; the deleted matches recorded in `tbl_deleted_matches`.
*So:* `docs/systems/tournaments.md`, "Filling and shuffling the first round".
*Touches:* migration `20261105115859_populate_and_shuffle_draw.sql`, `supabase/tests/051_populate_shuffle_draw.test.sql` (new), `tournaments/bracket/index.html`, `scripts/tournament-bracket.js`

## 2026-11-05 — A tab's loading screen covers that tab only

*Decided by UV:* when switching tabs, the loading screen shows only over the tab that is loading; the page's screen is still there when the page first loads; the same look (the blur, the wordmark, the diver into the portal), sized to the tab, the diver in the part of the tab on the screen. Every tabbed page: today the league season page, and the tournament page once it has tabs.
*Claude's, for UV to judge:* any hold made while a tab's cover is up joins the cover; a tab that has drawn nothing yet is given a least height (60% of the screen, at most 30rem) so the cover has room; the tab's pill keeps the button's own busy look but gets no traced dots while its tab is covered; the profile page's tabs are unchanged (they read nothing when switched).
*So:* `docs/systems/dots.md` §9, "A screen over one tab".
*Touches:* `scripts/loader.js`, `stylesheets/loader.css`, `scripts/dots.js`, `scripts/league-nav.js`

## 2026-11-05 — A player's picture opens their profile, everywhere

*Decided by UV:* wherever a player's profile picture is shown, it opens their profile; the match stage's pictures too; on the draw, a picture on a card opens the profile and the director's entrant pills stay drag-only.
*Claude's, for UV to judge:* the picture is marked and one capture listener takes the tap (not a link wrapped round it), so it works inside a card, a row link or a seat; initials count as a picture; left alone: your own nav picture, the profile's big photo, the More pop-up's walkover boxes, the season page's people (already a link); the green glow on hover; the draw's player ids added to `tdc_tournament_draw` rather than read from the entrant table.
*So:* `docs/ui.md` §2, "A player's picture opens their profile"; `docs/systems/tournaments.md`, "A picture on the draw opens the player's profile".
*Touches:* migration `20261105125434_draw_player_ids.sql`, `supabase/tests/052_draw_player_ids.test.sql` (new), `scripts/tdc.js`, `stylesheets/forms.css`, `scripts/league-card.js`, `scripts/league-standings.js`, `scripts/player.js`, `scripts/tournament-bracket.js`, `scripts/match.js`, `scripts/match-new.js`

## 2026-11-05 — The match page says when a match is part of a tournament

*Decided by UV:* a banner attached to the foot of the nav bar, the stage adjusted to fit the page again; it reads the tournament's name and the round ("Quarter-finals · Match 2"), and a tap opens the draw.
*Claude's, for UV to judge:* the trophy icon and chevron; the banner's height (2.5rem) and the nav's surface and line; the banner over the result view too; the settings panel's context line following it (it said "Social match" for every match); the round named by a copy of the draw's naming rather than a shared file (no change to the draw page).
*So:* `docs/systems/matches.md`, the match page, "The tournament banner".
*Touches:* `match/index.html`, `scripts/match.js`, `stylesheets/match.css`, `stylesheets/variables.css`

## 2026-11-05 — A tournament's pages are tabs, with a Settings tab

*Decided by UV:* the tournament pages become tabs like a league's: Draw · Entrants · Settings on `/tournaments/bracket/`, the old Entrants address forwarding; the Poster stays its own page, a link in the bar; the settings available when creating a tournament are on a Settings tab, and the copies on Draw and Entrants come off so each setting is in one place; a rule changed there reaches every match not yet started, like leagues (a migration).
*Claude's, for UV to judge:* the third-place playoff moved to Settings with them (it is generated with the draw, so it locks once there is one); one Save for the whole tab rather than each setting saving as it changes; the ruleset sent only when it changed; "not yet started" meaning no frame and no card event (the league's rule), so a match a director re-ruled by hand on the match page, with no frame yet, follows a later tournament rule change; Entrants keeping the link to share with a line pointing to Settings; a player's bar showing Draw alone (and the Poster once shared); a sibling of `league-nav.js` rather than one shared tab script (no change to the league pages).
*So:* `docs/systems/tournaments.md`, "The tournament's pages as tabs, and its Settings tab".
*Touches:* migration `20261105130239_tournament_settings.sql`, `supabase/tests/053_tournament_settings.test.sql` (new), `tournaments/bracket/index.html`, `tournaments/manage/index.html`, `_includes/tournament/{draw,entrants,settings}.html` (new), `scripts/tournament-nav.js` (new), `scripts/tournament-settings.js` (new), `scripts/tournament-bracket.js`, `scripts/tournament-manage.js`, `scripts/tournament-new.js`, `scripts/tournament-poster.js`, `scripts/tournaments.js`, `tournaments/poster/index.html`

## 2026-11-05 — A tab's loading screen has no blur; the tab fades in once loaded

*Decided by UV (second look, same day):* the blurred cover over a tab hid what was under it rather than letting the content fade in after loading; on tabs, no blur, since nothing should show until loading has completed. Applies to every tabbed page (the league season and the tournament share the cover).
*So:* while a tab is covered its content is invisible and only the wordmark and the diver show; when it is ready the content fades in as they fade out. The page's own loading screen is unchanged. `docs/systems/dots.md` §9, "A screen over one tab".
*Touches:* `stylesheets/loader.css`, `scripts/loader.js`

## 2026-11-05 — Every league, tournament, match and frame is cleared; testing starts again from nothing

*Decided by UV:* no real match or frame has been recorded yet, so every league, tournament, match and frame goes, with the records that belong to them; also the deleted-match records and the test season (T_SeasonName). UV deletes the league and team pictures left in storage from the dashboard. STATUS §1's steps that name the cleared data are marked "recreate to retest".
*Claude's, for UV to judge:* a migration rather than an SQL editor script (CLAUDE.md: writes to production go through migrations); `TRUNCATE` rather than `DELETE`, because the frame guards refuse deleting an agreed card's frames and the edit log would write a row for each one; no `CASCADE`, so a table missed from the list makes the whole statement refuse rather than empty something unseen; every notification goes (all 111 were about a match, tournament or league); players (the 19 dummies too), accounts, identifiers, credits, venues, push subscriptions, notification settings, the owner board and the role types are kept.
*Touches:* migration `20261105133615_clear_test_competitions.sql`

## 2026-11-05 — A player asks to join a team; its captain takes them or declines

*Decided by UV:* on the join page each team card has a join button, a ring with an icon, for a player already in the league who has no team. The requests show on the season page's Players tab, where a captain puts the player on their team. In answer to Claude's questions: a captain sees **only their own team's** requests; the team's captains are told of a request and the player is told when taken; a captain may **decline**; and "once you are in a team, you must be released by your captain before you can be added to another team".
*Claude's, for UV to judge:* read from that last answer, a player may ask several teams while on none, and every request they made in the season goes the moment one team takes them; a full team's ring is greyed and asking it refused (its captain could not take them anyway); Take is the existing claim (`tdc_team_claim_player`), so the team limit and every rule of claiming stay where they were; the requests are cleared and the player told by a trigger on the entrant's team, so the director placing them from Run it clears them too; the player is told only when a team they asked takes them; nothing is sent on a decline; Decline asks first; the director sees every team's requests through the function but has no list of them (Run it is theirs); the captain's notice opens the Players tab (`&view=players`).
*So:* `docs/systems/leagues.md`, "Asking to join a team".
*Touches:* migration `20261105153021_team_join_requests.sql` (new table `tbl_team_join_requests`, added to `private.tdc_merge_players`), `supabase/tests/054_team_join_requests.test.sql` (new), `leagues/join/index.html`, `scripts/league-join.js`, `stylesheets/league-join.css`, `_includes/league/season.html`, `scripts/league-season.js`, `stylesheets/league.css`

## 2026-11-05 — Set my lineup goes to the next match whose lineup is not set, else the last result

*Decided by UV:* the Players tab's Set my lineup button shows which match it opens; it is always the next match that has been opened and whose lineup is not set; otherwise it reads Go to last result. The ring to ask to join a team goes on each team on the season page's Teams tab too. A team's players are indented so an open list reads more easily.
*Claude's, for UV to judge:* "opened" read as a match made on the fixture and not finished or abandoned (`scheduled` or `in_progress`), "set" as the team's side locked; "next" as earliest by date, then round and position, including one whose date has passed but is still open; the line under the words ("v Bravo · Wed 12 Nov", the score on a result) on Go to last result too; a captain with neither gets no button; a player who is not captain keeps My next match and its old rule, with the line added; the ring at the right of the heading beside the + / –; the indent to the team's name. The ring is one shared script for both pages (`team-ask.js`).
*So:* `docs/systems/leagues.md`, "Set my lineup says which match" and "The ring on the season page too".
*Touches:* `scripts/team-ask.js` (new), `scripts/league-join.js`, `scripts/league-season.js`, `leagues/join/index.html`, `leagues/season/index.html`, `stylesheets/league.css`, `stylesheets/league-join.css`

## 2026-11-05 — The poster in the site's look, showing everything set and nothing unset

*Decided by UV:* the tournament poster redone in the site's theme, the league join page its inspiration; as much information as possible, but only settings and information the director specified. In answer to Claude's questions: an entry fee of 0 is left out (no "Free entry"); a rule is shown when it is switched on or has a value, as on the join page (the defaults cannot be told from a choice); the poster's snapshot gains the third-place playoff, the rules set for a round and who runs the tournament (a migration).
*Claude's, for UV to judge:* the officials' display names, roles and picture paths in the public snapshot (no ids; the picture bucket is already public); Record who breaks and Break & finish needs the breaker added to the player-facing rules, since the break settings depend on them; Round by round showing only what differs from the tournament's rules, an off switch included; a bye drawn as the player going through; the default entry mode shown ("Added by whoever runs it"); the page borrowing `league.css` and `league-join.css` rather than copying their styles.
*So:* `docs/systems/tournaments.md`, "The poster redesigned, and what it holds".
*Touches:* migration `20261105160712_poster_more.sql`, `supabase/tests/055_poster_more.test.sql` (new), `tournaments/poster/index.html`, `scripts/tournament-poster.js`, `stylesheets/poster.css`

## 2026-11-05 — A tournament's card opens the poster until it starts, then the draw

*Decided by UV:* while a tournament has not started, clicking on it always opens the poster; once it has started, straight to the draw. In answer to Claude's questions: the director's card too (Entrants is reached from the poster's foot); a player who cannot open the poster (not shared) is sent to the draw instead, with a small migration so the list knows.
*Claude's, for UV to judge:* "not started" as Draft or Open, so Cancelled opens the draw; a director whose tournament has no poster at all also gets the draw (no longer Entrants).
*So:* `docs/systems/tournaments.md`, "A tournament's card opens the poster before the start, the draw after".
*Touches:* migration `20261105162834_tournament_link_poster.sql`, `supabase/tests/056_tournament_link_poster.test.sql` (new), `scripts/tournaments.js`

## 2026-11-05 — A player dragged into a later round goes through, scored to 0 by the director

*Decided by UV:* dragging a player from one round to another on the draw rewires and also moves that player into the next round, the match they left scored at the win condition to 0 (race to 5: 5-0). In answer to Claude's questions: a match with frames or a result is rewired only and the page says so (its score is set from the card as now); the reason on the record is written automatically, "Moved through on the draw"; best of N gives just over half to 0 (best of 9: 5-0), fixed frames, timed and free play 1-0; a drag onto the third-place playoff is rewired only, since it takes the loser.
*Claude's, for UV to judge:* one database function doing the rewire, the match, the score and the placing together (rehearsed first, so nothing is half done) rather than three calls from the page; the player placed in the slot even where players are moved on by hand; a bye or walkover, an empty dragged slot and an opponent not yet known also rewire only; the match made for the score notifies both players a moment before it is scored.
*So:* `docs/systems/tournaments.md`, "Dragging players onto the draw".
*Touches:* migration `20261105164508_move_through_on_the_draw.sql`, `supabase/tests/057_move_through.test.sql` (new), `scripts/tournament-bracket.js`

## 2026-11-05 — The draw is live for changes to the draw; a moved-through match is complete

*Decided by UV:* the draw page must receive live updates for players moved between rounds; and a match scored by dragging a player through is set to complete.
*Claude's, for UV to judge:* the draw's fixtures and the director's scores published for live updates (readable by any signed-in user already, so nothing new is shared), the page always watching its tournament's fixtures even with no match started; a moved-through match completed the way approving a result does (status and end time), with no card event written, so the card's own buttons (Lock it, Send back, Use the frames) still show for it.
*So:* `docs/systems/tournaments.md`, "Dragging players onto the draw".
*Touches:* migrations `20261105165641_realtime_draw.sql`, `20261105165954_move_through_completes.sql`, `supabase/tests/057_move_through.test.sql`, `scripts/tournament-bracket.js`

## 2026-11-05 — A competition's venue: the one it belongs to and the ones it is played at

*Decided by UV:* the venue that decides staff rights and credits stays separate from the venues a competition is played at, which give no rights. Tying a league to a venue takes its owner or admin; a tournament keeps owner, admin or staff. No exception for UV's account. The venue it belongs to is fixed at creation. Whoever runs a competition may list any active venue as played at, with no approval. The list is per season and copied to each new season. An LD may give a fixture its own venue, as with tables, or leave it blank and inherit. Hours are stored as times and UV enters them. Signed-out visitors may read display details. A venue's owner or admin edits it; new venues come through Claude. The field list as proposed. The two Billiard Cafés as on the Google Maps listings UV sent.
*Why (Claude's reasoning):* a venue's rights travel to its staff and onto every match's card, so a club hosting one night must gain nothing from it.
*Claude's, for UV to judge:* a blank fixture in a season with several venues names none rather than the first, so a player is not sent to the wrong club; a fixture may name any active venue, not only one on the season's list; a venue that closes may stay on a list it is already on; name, slug, timezone, currency and active are not editable by a venue's owner; no function writes hours, so an owner cannot change them yet; The Dive Club's area as "Lonehill, Fourways", from the footer; a listing's address split into address, area and city, with postcodes not held.
*Rejected:* a platform admin (UV: no exception). Renaming the existing `venue_id` columns (Claude's: many working functions for no gain).
*So:* `docs/systems/foundations.md`, "Venues". STATUS §5's travelling-league fee question stays open.
*Touches:* migration `20261105200430_venues_details_and_places.sql`, `supabase/tests/058_venues.test.sql` (new)

## 2026-11-05 — Choosing where a competition is played: a search box and pills

*Decided by UV:* venues are chosen in a search box that adds each one as a pill, and the field always shows.
*Why (Claude's reasoning):* more than one venue is allowed, and the list will grow as clubs join.
*Claude's, for UV to judge:* the picker sets the played-at list only, not the venue a competition belongs to, because that list is the one that takes several venues and it needs no role at a venue. UV also chose "a line saying they run no venues" for someone with nothing to choose, answering a question Claude wrote before step 1 was read; under step 1 anyone running a competition may list any open venue, so that person does not exist. The line says "No venues are open yet" only when no venue is open at all. Also: results appear once something is typed; pills in the order added; a closed venue on a list keeps an unnamed pill.
*Rejected:* a ticked list (Claude's recommendation; UV chose the search).
*So:* `docs/systems/foundations.md`, "Venues".
*Touches:* `scripts/venue-picker.js` (new), `scripts/tournament-new.js`, `scripts/tournament-settings.js`, `scripts/league-new.js`, `scripts/league-settings.js`, `stylesheets/forms.css`, both create pages, both Settings includes

## 2026-11-05 — The profile menu's middle: what you're in

*Decided by UV:* start the middle with active matches, leagues and tournaments, each one tap from opening (the layout approved first); a small read-only function rather than the three existing lists.
*Why:* the existing lists miss a league night until both lineups lock, the moment a captain most needs the link, and list a tournament the person withdrew from.
*Claude's, for UV to judge:* a captain whose side has not locked sees Needs you and "Set your lineup" (until now Needs you on a team card meant only a signature); a league night shows for captains and the squad, read-only for a squad player until the lock, never for a teammate out of the squad; somebody running a league without playing has the league and not its nights; a social match left unfinished stays until it is finished or abandoned; rows solid over the see-through panel; 5 rows a section.
*Rejected:* extending `tdc_my_matches` (it would change `/matches/` too, and it works out the card state three times for each of up to 200 rows, on a menu opened often).
*So:* `docs/ui.md`, "The profile menu".
*Touches:* migration `20261105204243_my_active.sql`, `supabase/tests/060_my_active.test.sql` (new), `_includes/nav.html`, `scripts/nav.js`, `stylesheets/nav.css`

## 2026-11-05 — The venue shown wherever a competition is, and a venue's own page

*Decided by UV:* every place that shows a league or tournament shows where it is played, including the eight places beyond those first named. Lists and cards give every name. The banner on a tournament match is two lines at the same height: the tournament, then the round and venue, several reading "3 venues". A competition with no venue leaves the row out everywhere. A venue's name opens a venue page showing every associated league and tournament.
*Why (Claude's reasoning, for the banner):* one match is at one club, so naming the first of three could send somebody to the wrong one. The one line had no room: the name would have been cut to a few letters.
*Settled by checking the database, as UV asked:* a fixture can already name its own venue (step 1), so a league night's scorecard shows that venue, or the season's list when it has none.
*Claude's, for UV to judge:* the venue page lists a competition that belongs to the venue, lists it as played at, or (leagues) has a fixture there; only what is listed (`is_listed`), so a private one is missing even for the people in it; a listed Draft shows, badged Draft. Its contents: picture or a pin, area and city, address, tables, phone, WhatsApp, email, then Open in Maps, Call and the other links, About, Hours (a day with no row reads Closed; no hours at all, no section), Leagues, Tournaments, each only if filled in, except the two lists, which say when empty. A WhatsApp number without a leading + is words, not a link, rather than guessing the country. The poster's snapshot now holds the venues' ids, for the links, where it held no ids but the tournament's. Changing the venues rebuilds a poster that exists, so its other facts and its generated date move too. The league search also finds a league by where it is played. A match's Venue row names the played-at list, not the venue whose staff may edit the card. The heading lines put the venues on their own line, and each venue is a link wherever the place is not already one big link.
*Rejected:* "The Dive Club +2" on cards (Claude's recommendation; UV chose every name). The maps link instead of a venue page (Claude's recommendation; UV chose the page). Showing a played-at venue by writing it to `tbl_matches.venue_id`: that column gives staff rights.
*So:* `docs/systems/foundations.md`, "Where a venue is shown". D1 (STATUS §0) was to come before the venue page; UV asked for the page now, so D1 may reshape it.
*Touches:* migration `20261105203829_venues_shown.sql`, `supabase/tests/059_venues_shown.test.sql` (new), `venues/index.html`, `scripts/venue.js` and `stylesheets/venue.css` (new), `scripts/tdc.js`, `leagues.js`, `league-season.js`, `league-join.js`, `league-fixtures.js`, `league-manage.js`, `league-standings.js`, `league-card.js`, `tournaments.js`, `tournament-bracket.js`, `tournament-manage.js`, `tournament-settings.js`, `tournament-poster.js`, `match.js`, `player.js`, `match/index.html`, `_includes/league/standings.html`, `match.css`, `league.css`

## 2026-11-05 — Follow is one-way and private; the player search is /players/

*Decided by UV:* one-way with no approval; only you can see who you follow, with no follower lists or counts; nobody is told; the search lives at `/players/`, linked as Players in the left menu, and each result only links to the profile; no page for managing follows yet.
*Why:* a request and answer flow needs somewhere to manage it, which UV did not want yet. Private can be opened up later, but once people have seen who follows whom it cannot be taken back (Claude's reasoning for recommending it).
*Claude's, for UV to judge:* the green tick once you follow; anybody with a player record can be followed, a walk-in too; the search reusing `tdc_search_opponents`, so it finds account holders and never you; Players last in the left menu.
*Rejected:* mutual follows; counts on a profile; follower lists; a notification; extending `tdc_player_profile` for the state (a small function of its own keeps "who follows this player" out of anything other people can call).
*So:* `docs/systems/players.md`, "Follow" and "The player search".
*Touches:* migration `20261105205913_player_follows.sql` (with `private.tdc_merge_players`), `supabase/tests/061_player_follows.test.sql` (new), `players/index.html`, `scripts/player.js`, `stylesheets/player.css`, `_data/navLinks.json`

## 2026-11-05 — The profile menu's people lists

*Decided by UV:* two lists, players I've played recently and players I play most often, worked out from frames and never stored, marking the ones I follow, each linking to the profile; opponents only, across every finished frame; most often counted in frames, showing the number; above Matches, five people each.
*Why:* frames are the only record, and a league night's frames are the fair measure: one night against somebody can be several frames but is only one match.
*Claude's, for UV to judge:* a walkover does not count, since nobody played it; a frame counts by its own state, so a match still being played counts from its first finished frame, and so do finished frames of a match later abandoned; no All › on these lists, since there is no full list to open.
*Rejected:* teammates on the lists; counting by matches; the lists below Tournaments (Claude's recommendation; UV chose above Matches).
*So:* `docs/ui.md`, "The profile menu".
*Touches:* migration `20261105211524_my_people.sql`, `supabase/tests/062_my_people.test.sql` (new), `scripts/nav.js`, `stylesheets/nav.css`

## 2026-11-05 — The profile menu is solid on a phone

*Decided by UV:* solid on a phone, answering the question open since 31 Oct.
*Why:* it fills the screen there, and on the home page the logo showing through the blur made a green tick over its green hard to see.
*Claude's, for UV to judge:* above phone width, where the panel is 320px beside the page, it keeps the see-through blurred surface.
*Touches:* `stylesheets/nav.css`

## 2026-11-05 — The players page lists whom you follow

*Decided by UV:* `/players/` shows all the players you follow, so you can stop following them. This replaces the same day's "no page for managing follows yet".
*Claude's, for UV to judge:* the list sits under the search and always shows; a green tick on each row stops following, with no confirm, since following again is two taps from the search; each name links to the profile.
*Why it stays private:* `tdc_my_follows` only ever returns the list of the person asking, so nothing can say who follows anybody.
*So:* `docs/systems/players.md`, "Follow".
*Touches:* migration `20261105212922_my_follows.sql`, `supabase/tests/063_my_follows.test.sql` (new), `players/index.html`, `scripts/player.js`, `stylesheets/player.css`

## 2026-11-05 — Stopping following takes one tap

*Decided by UV:* no confirm before stopping following on `/players/`, settling what the entry above left to judge.
*Why (Claude's reasoning):* a follow is cheap to redo, and nobody is told either way.
*Rejected:* asking first; keeping the row until a reload so a second tap restores it.
*Touches:* nothing in the code; it was built this way.

## 2026-11-05 — The feed on /players/

*Decided by UV:* a feed above Following, of matches and results from the players you follow: playing now and finished results, not upcoming; a league night as one row, team v team, the team score and who played; a result reads finished as soon as it is scored; live scores while the page is open.
*Why (Claude's reasoning for what UV chose):* a row that says the moment a frame or a result lands is what a feed is for, at the cost of showing a result before it is settled and of the page holding a socket while open. Hidden, it lets go, as the site's other live pages do.
*Claude's, for UV to judge:* abandoned matches left out; ten rows and Show more; a match that starts while the page is open appears only on coming back to it, since hearing every new match would mean listening to all of them.
*Rejected:* upcoming matches; a followed player's own frames on a league night; Finished only once settled and reading on opening only (both Claude's recommendations; UV chose otherwise).
*So:* `docs/systems/players.md`, "The feed".
*Touches:* migration `20261105214625_my_feed.sql`, `supabase/tests/064_my_feed.test.sql` (new), `players/index.html`, `scripts/player.js`, `stylesheets/player.css`

## 2026-11-06 — Points: the concept

*Decided by UV:* a points system now, to get people using and testing the site and learning its "language", and as a show of skill and long-term use that feeds a hall of fame and VIP status. Only verified accounts earn. Points and credits stay separate ("You can't gamify people's money on a site I give away for free"); they will connect only indirectly, on the business side, later. Lifetime points never reset. Social games count once per opponent per week and never nearly as much as league or managed tournament play; captains, scorers and directors get more. Recorded data builds a match's pot and frame data splits it (UV's scenarios A to D in the design). Removing a match removes its points, so points are dynamic. Periodic awards exist (e.g. the week's top league player). Tiers are subjective owner-written rules on top of points (e.g. senior citizens; the league's top 3 each week as VIP). UV enters past champions' titles himself, as retro points. Data values are listed objectively (frame time and racking time, not "a fast frame") and each is weighted on its own (B&F and reverse B&F differ). The formula is set on an owner-only tuning page with sliders and scenarios.
*Why:* every feature someone uses enriches the data and pushes the site forward; leagues, captaincy and fluency are what to encourage.
*Claude's, for UV to judge:* a pot per frame, not per match; multipliers for context, not separate bases; paying for data recorded on a frame, not settings switched on; paying only once signed; first-use bonuses; points for confirmed bug reports; periodic awards and retro titles and manual adjustments in a small ledger, frozen once given, beside dynamic points; formula versions kept.
*Rejected:* unverified or guest players earning reduced points; points turning into credits.
*So:* `docs/design/points-and-tiers.md`.
*Touches:* nothing in the code yet.

## 2026-11-06 — The points tuning page: UV describes formulas, the page judges them

*Decided by UV, answering the plan:* formula sets for each level: fixed bonus formulas from a player's profile and history, then frames, matches, tournaments, leagues and so on. UV writes pseudo code in a space on the page, clicking data points to drop them in, and copies it to Claude, who adds it to the page; the sliders judge scenarios afterwards. Roles and every setting are data points, so there can be formulas for a TD or LD and for values like the minimum role for score entry. There is no starting set: value goes on the story that comes out of the data once it is locked, because just scores say only who won and by how much. Locking a result is itself rewarded, which discourages deleting a bad one. "Negative" is a playing style and subjective, which suggests site-wide stats such as average frames per match as data points. Weight sets are named versions in an owner-only table. Any operator is welcome.
*Why:* UV is versed in maths and code, so describing a formula is quicker than clicking one together, and it can be refined later.
*Claude's, for UV to judge:* formulas as plain code in `points-formula.js`; five levels with site-wide stats as data at every level; an unverified person shown 0 with what they would have earned; the social cap stopping frame and match formulas but not player formulas or career counts; a failing formula counting as 0 with a warning.
*Rejected:* an on-page formula builder in the first build (UV's own earlier idea, may return); fixed pots, bases or multipliers built into the page; side-by-side comparison in the first build; a bug-report slider.
*So:* `docs/design/points-and-tiers.md` §9a, `docs/systems/points.md`.
*Touches:* `src/scripts/points-formula.js`, `tools/points-tests/`.

## 2026-11-06 — The first points formula: profile completeness

*Decided by UV:* picture added, display name added, name and surname set, ID verified, notifications enabled and sign-in methods each carry a value in 0 to 1 (generally -1 to 1) with its own slider; the values are added, then multiplied at the end for a total. It is almost the base for anyone who uses the site, so it should be almost insignificant, and everyone gets it almost by default.
*Claude's, for UV to judge:* sign-in methods as methods ÷ 2; officials earning it; "notifications enabled" meaning on at least one device; the sliders' starting values.
*So:* `docs/systems/points.md`, "The formulas". Open: what "verified" means, design §10 q8.

## 2026-11-06 — New data updates the points page; the tournament win state is to be completed

*Decided by UV:* every time new data is defined, the points page is updated too. The tournament win state (completed win conditions and so on) has to be completed.
*Why:* points are built from the data, so a data point the page does not know earns nothing.
*So:* `CLAUDE.md` §3 and `docs/STATUS.md` §3 item 0n.

## 2026-11-06 — Points are a loyalty system

*Decided by UV:* points are never used directly for anything and are completely arbitrary. You never lose them. They say to the business that someone is a valued customer who should receive benefits other customers don't: they affect a player's tier, and a tier could, for example, give discounts on anything in the shop. How points link to the business is entirely UV's, the same logic as credits, except that credits are real money and can go up and down.
*Why:* think loyalty system.
*Rejected:* Claude's reading of shop points as "buying points" against §2 of the design, and its suggestion of a legal check. Neither is to be raised again.
*So:* `docs/design/points-and-tiers.md` §10a. Still to ask: whether a removed match takes its points away (§10 q9).

## 2026-11-06 — An ID verified is one bonus, not a gate

*Decided by UV:* a player receives only a single bonus for being ID verified. It does not carry forward to other calculations. This replaces "verified accounts only" in the design.
*Claude's, for UV to judge:* a guest or walk-in with no account still earns nothing, kept from the same rule.
*So:* `docs/design/points-and-tiers.md` §2, `docs/systems/points.md`.

## 2026-11-06 — Points: tiers by multiplier, one total, a rebuildable table

*Decided by UV:* no account, no points. Points are never spent, but a removed match takes its own points. One number on the outside with a hidden stream on each formula. An edge function may store earned points in a table that can always be rebuilt, never the record. Tiers are a custom implementation with decisions still to make: the hall of fame is awarded to a select few and sits like a boost on the profile, straight into a higher tier or affecting the points multiplier; adjusting points multipliers is a good way to manage tiers. A venue multiplier is an assumed value to play with, almost a signature that this club developed the system. Sign-in methods may not count at all, as a security matter: no influence in the scenario until values are solidified. Data points on the points page skip the button animation.
*Rejected:* Claude's tiers reading a rolling period with lifetime points deciding the hall of fame.
*So:* `docs/design/points-and-tiers.md` §10a, §10 q9.
*Touches:* `points-formula.js`, `points-tuning.js`, `tdc-controls.js` (`data-no-dots`).

## 2026-11-06 — The title ladder: 100 steps, titles that unlock, event themes

*Decided by UV:* a ladder of 100 steps where each step can hold several titles. A title has one step ("20+"): from there up, a player may choose it, so titles unlock as points are earned and a player shows off subtly with the one they pick. Each group of titles has its own steps (Space: Planet 20+, Galaxy 40+, Universe 60+). Every title is carefully considered and offers artistic expression: never "George Clooney", perhaps "Clooney" or "Pitt", Clooney on the higher step. UV keeps the list on a new page only he can access, and the site saves his changes: only an owner of The Dive Club may open or edit it, since the titles belong to the whole platform. The page starts from Claude's lists as a draft, with placeholder steps. The docs plan for event themes on the website, such as worldwide holidays.
*Replaces:* Claude's suggestion of one ladder made of groups, each group holding one band of steps; groups have their own steps instead.
*Claude's, for UV to judge:* every placeholder step; each title having an optional note for its comparison value; a name being unique only within its group; Captain left out of the Military group because it is already a league role.
*So:* `docs/design/points-and-tiers.md` §6a, `docs/systems/points.md`, `docs/BACKLOG.md` §2 item 12.

## 2026-11-07 — The neumorphism style: one dropdown, sideways number inputs

*Decided by UV:* wherever this style goes, the new dropdown (a sunken pill that opens as a window over its options) replaces the site's sideways select pills, and number inputs are sideways, never upright. Both are gone from the sandbox page, along with the multi-line selector built the same day.
*Replaces, if the style is adopted:* `data-control="select"` and the upright stepper in `tdc-controls.js`. Whether the style goes anywhere on the site is still undecided, and no live page has changed.
*Rejected:* a selector showing one selection at a time between two arrows, wrapped over several lines (built and removed 7 Nov).
*So:* `docs/ui.md`, `docs/STATUS.md` §1 4ab.
*Touches:* `sandbox/neumorph/index.html`, `sandbox-neumorph.js`, `sandbox.css`.

## 2026-11-07 — The neumorphism design goes site-wide

*Decided by UV:* apply the entire design site-wide, leaving out the match stage, and no more rings around icons. Anything unsure is brought to UV.
*Replaces:* "whether the style goes anywhere is undecided" in the entry above. It also reopens, by UV's word, the ring status design and the upright stepper in `docs/ui.md`, both recorded earlier as settled; how each is replaced is among the questions with UV.
*So:* not built yet. The plan is in stages, shared layers first, each tested on real pages.

## 2026-11-07 — How the design went site-wide: Claude's choices, for UV to settle

*UV said go and that questions would be settled later. None of these is UV's decision yet:* a date is the browser's own field; the tick is in a sunken well; a label too long for its dropdown goes above the pill; settings rows are one a row; the arrow replaces + and - on folding groups; standings numbers are 16px, against UV's "numbers large" of 29 Oct; panels that must stay readable over what scrolls under them stay solid; a filled green stays on each page's main action; yellow break rings stay as data; the points page stays compact at 36px.
*So:* the list with what each looks like is with UV; `docs/STATUS.md`.
*Touches:* `design.css`, `variables.css`, `tdc-controls.js`, `page-light.js`, every page stylesheet.

## 2026-11-09 — Short links: one code each for leagues, tournaments and matches

*Decided by UV:* `thediveclub.org/<code>` is a shortcut to an existing page. Leagues are `L-` and tournaments `T-`, fixed, followed by what the LD or TD chooses; their matches inherit that code and an automatic number (`T-BC26-7`). A social match is only a number and nobody can customise it. Only letters and digits can be typed. Every league, tournament and match gets a code when created, one each and no others. Only whoever set a code may change it, in Settings, with clear feedback rather than a pop-up. A changed code is released at once and can be reused. Share is open to anyone, on the poster and match pages. A code opens the poster, or deeper for somebody signed in and part of it. A broken link says why and never falls back to home. Pages for signed-out visitors are a separate job; until then the current sign-in flow stays.
*Replaces:* a short link for almost any page, a Share button in the nav's toggle section and a pop-up (UV's first version, same day).
*Rejected:* codes where the director must follow a shape, such as ending in a letter (UV: people would struggle to make a valid one); a type-less code; an old code that keeps forwarding.
*Claude's, for UV to judge:* a suggested code being 5 characters with no vowels or look-alikes; 2 to 8 characters for the chosen part; social numbers running in order from 1000; the short list of refused words; one code per league meaning the newest season; a former director who set a code not being able to change it.
*So:* `docs/design/short-links.md`, `docs/systems/foundations.md`, "Short links".
*Touches:* migration `20261109114638`, `066_short_links.test.sql`.

## 2026-11-09 — League and team pictures get their own shapes; every picture set into the page

*Decided by UV:* a league's picture is framed by a classic shield and a team's by a hexagon. Every picture somebody chose is set into the page with the sandbox's inset, the picture filling the hole with the shadow across it, site-wide and **including the match stage** (the stage was otherwise left out of the design on 7 Nov). A league with no picture shows the empty sunken badge with the trophy inside. On `/leagues/`: no "Your Leagues" heading or count line; each season a card in sections with grey lines, its last row for stats with a real ranking ("1st / 128"); the pill drifts only when its stats do not fit, and a finger stops it.
*Rejected:* a trophy shape (cuts too far into a picture); the crest badge Claude recommended for leagues, which UV passed over for the shield.
*Claude's, for UV to judge:* the team's empty hexagon holding its old shield icon (extended from the league's answer); the Team rank and the season's player columns beside Ranking; leaving the league details after them in the pill; "Not ranked yet" before a night counts; the status strip kept; the Ranking column gone; two cards side by side on a PC; 24px a second for the drift.
*So:* `docs/ui.md`, "Pictures are set into the page"; `docs/systems/leagues.md`.
*Touches:* no migration.

## 2026-11-09 — League cards, second pass: stats in boxes, the rules in the carousel, a pointed shield

*Decided by UV:* no grey lines on the cards. The shield takes the shape of the reference picture (a point at the top centre), fills its space with minimal padding, and is as tall as the top of the league name to the bottom of the dates. The pill holds league details only, plus every rule in use. The stats have their own row below it, each in its own box: Rank / players, Team Rank / teams in the league, and BF | rBF | GB counts. The pill keeps its auto-scroll and can also be dragged. Each of BF, rBF and GB shows only when that rule is on, as a plain number. The display font's small titles (league names, list-row titles) lose the browser's fake bold and use the font's true weight, which is thinner at the same size; UV preferred that to slimming the letters further. This replaces the same day's grey lines, ranking in the pill and classic shield path.
*Claude's, for UV to judge:* "Not yet" in the rank boxes before a night is counted; the season's own player columns dropped from the card, since UV's list did not name them; a rule's wording taken from the settings page's labels; the shield capped at 40% of the row; the shield 0.88 as wide as it is tall, everywhere.
*So:* `docs/systems/leagues.md`.
*Touches:* no migration.

## 2026-11-09 — A filter's label joins its pill; team names blue; the alternate green becomes orange

*Decided by UV:* on a filter pill the label and the selection share one pill, the label grey, everywhere there are filters. A team's name is the blue of a league match's changes (`--color-edited`), everywhere a team is named. The alternate green (`--color-success`) becomes a muted orange everywhere it is used, so it is easy to tell where it is used, "like the off green" of the site's primary. UV was told this makes the success colour orange and accepted it. No "Find a league" label or "Leave it empty" hint on `/leagues/`. Cards side by side line up row by row, as they already matched in height.
*Claude's, for UV to judge:* the orange itself, `#ff9b61` (the primary green's lightness and saturation at an orange hue, redder than the warning's amber so the two differ), and `#b8602a` on the light preview; "filters" taken as the `/leagues/` three, the fixtures Team and Match, and the verifications Show, not a form's dropdowns or the fixtures' date fields; a team named inside a sentence, a button or a dropdown option left uncoloured; the card summary's leading side keeping its own colour, because that colour is how it says who is ahead.
*So:* `docs/ui.md`, "Filters and names".
*Touches:* no migration.

## 2026-11-09 — League cards, third pass: fixed shields, compact filters, new search tiles

*Decided by UV:* the shield on a card is one size whatever the height of its row, bigger being better, which replaces "as tall as the name to the dates". Venue names in bold. Ranks in the site's green. Lags join the special wins box, and a stats box that does not fit scrolls like the rules pill. Filter pills are compact, in one row where possible, no space between label and selection, tighter margins between them. Search results: picture beside league name and season name, then venue in bold, then discipline. "You are in this one" in blue. A line that does not fit scrolls by itself. The season's status ("Taking entries") is a yellow badge; the team size is a rule and goes in the details text, not a badge. A search tile's league name is in the site's font. The status bar sits below the season name and picture, and everything below it is centred. The page's outermost card has less inner padding on a phone.
*Claude's, for UV to judge:* "badges" taken as the league shields, at 6rem tall; a phone taken as up to 36rem wide for the padding; Lags shown when the season records who breaks, counted as Standings' lags won; a tile's date, status and player count dropped, since UV's list did not name them; tile lines auto-scroll but do not drag, so a swipe still moves the row of tiles.
*So:* `docs/systems/leagues.md`, `docs/ui.md`.
*Touches:* no migration.

## 2026-11-09 — A set line height for headings in the display font

*Decided by UV:* every heading in the display font gets the same set line height, after the league names showed extra space on an iPhone.
*Why:* Safari ignores the font's metric overrides, so a normal line height was nearly twice as tall there. 1.32 is what those overrides come to in Chrome.
*Claude's, for UV to judge:* besides h1 to h4, the four title classes that are not heading tags (`.cs-title`, `.pp-h3`, `.pp-panel-title`, `.pp-c-h`); the match stage's names and scores, and other numbers in this font, left alone.
*So:* `docs/ui.md`.
*Touches:* no migration.

## 2026-11-09 — A phone in landscape fills the screen

*Decided by UV:* across the site, turning to landscape stretches the elements to fit the screen.
*Claude's, for UV to judge:* `/match/` left out, because it has its own landscape layout; the rule stops at 991px wide, above which the PC layout's ten of twelve columns (UV, 24 Oct) already applies; reading-width limits on a few paragraphs of text left as they are.
*So:* `docs/ui.md`.
*Touches:* no migration.

## 2026-11-09 — League cards keep their rows on a wide screen

*Decided by UV:* on a wide screen the league name, season and venue keep their own rows, and the Your Leagues cards show in rows where possible. The sizes are fine.
*Claude's, for UV to judge:* the rows applied at every width, phones included, so a short name no longer has its season beside it; "where possible" taken as two cards across on a PC, as before, and on a phone in landscape from 40rem wide.
*Touches:* no migration.

## 2026-11-09 — The league join page, and every banner

*Decided by UV:* on the join page the status badge moves into the details, in yellow, beside a blue badge for being in the league; the Entries detail goes; Share and a way in (arrow or +) sit as icons at the banner's top right; the "You are in this league" section goes; "How it is played" becomes "Rules"; Teams goes above Rules; Nights becomes a calendar in the states' colours, with a one-line key, and a tap on a night shows its time and matches under it. People not in the league get a badge in the league search's words. On **every banner**: an outer shadow rather than an inner one, the full inner green glow, and the status bar where the grey separator was, with the separator gone.
*Decided by UV:* the display font is only ever its standard weight, site-wide.
*Claude's, for UV to judge:* the badges as the details' first row; "Added by whoever runs it" for a league that takes no names; a night being played shown yellow even when it is also the next; a past night not fully played staying green; a line round the tapped night; the name's line height, 1.2; the weight enforced once, on the font's own definition, rather than rule by rule; the status bar on the scorecard's result panel going where its grey line was.
*So:* `docs/systems/leagues.md`, `docs/ui.md`.
*Touches:* no migration.

## 2026-11-10 — One page for a league, and its Season tab to be public

*Decided by UV:* there is no need for two pages: the league join page is folded into the season page and removed. No forward is left at the old address, since only test data exists ("Ignore existing links"), and future links lead to the season page, so a league's short link opens it for everybody. The team cards take the join page's look with a drop-down arrow at the right end of the faces; open, the faces go and the arrow stays on its row. The Season tab shows the join page's seven numbers, plus Confirmed for those who could see it already. Somebody not in the league sees a plain Teams heading. "Players" is renamed "My Season". The cards now show places taken, which replaces "the captain and nothing else" (29 Oct), because the season page was to follow the join page.
*Decided by UV, not built:* the Season tab is to open to signed-out visitors; Fixtures and Standings ask them to sign in; whoever runs the league gets a switch for whether players' names and faces show, as the tournament poster has. **This departs, for this tab, from 21 Oct** ("The poster is a stored snapshot, not a public read of the live tables"): the functions it reads must each be audited and opened to `anon`. UV's reasoning: the season page holds nothing sensitive.
*Claude's, for UV to judge:* Confirmed written 12/20, as "12 of 20" wrapped in its tile; "Your team" under the captain's name; every roster read with the page, as the closed cards show faces.
*Rejected:* forwarding `/leagues/join/` to the season page; keeping both pages.
*So:* `docs/systems/leagues.md`, "One page for a league"; `docs/ui.md`.
*Touches:* migration `20261110075409_league_short_link_season.sql`, `supabase/tests/066_short_links.test.sql`, `leagues/join/index.html` and `scripts/league-join.js` (both removed), `leagues/season/index.html`, `_includes/league/season.html`, `scripts/league-season.js`, `scripts/leagues.js`, `scripts/venue.js`, `scripts/team-ask.js`, `stylesheets/league-join.css`, `stylesheets/league.css`, `stylesheets/design.css`, `stylesheets/forms.css`

## 2026-11-10 — The Season tab, every banner and collapsible groups restyled

*Decided by UV:* **every banner** has inset shadows only and a thin site-green inner line that casts shadows, replacing the outer shadow and inner glow of 9 Nov. **Who runs it** moves into the league banner after Venue, as pictures and names. **Rules** is the last section, collapsed at the start. Each **calendar month** is an inset card, a grey line separates weekends from weekdays, and the Sa and Su pills go. Number rows are centred with even padding. **Share** sits below the + in site green, with a softer icon. A grey line runs through each section heading and either side of the Teams and My Season pill. **Collapsible groups, site-wide:** the pill goes and the arrow sits right after the words, reversing 29 Oct's move to the right end. **Team cards** are inset and show only the picture and name; open shows every player with a Captain badge and no "Player" word, the places on the arrow's line, and the ask ring there too; the "Your team" badge goes. This replaces the faces row and places on a closed card (9-10 Nov). On a phone the cards are condensed, name under picture, arrow centred below, fitting in rows, and an opened card expands and pushes the others.
*Claude's, for UV to judge:* the share icon as three joined circles (UV asked for a softer one and left the choice); the phone card's 7.5rem width; the calendar change kept to the Season tab, leaving the Fixtures planner; Away and Withdrawn kept on a player's row; the hint's new words, "Open a team and tap its ring"; every roster still read with the page, so a card opens at once.
*Decided by UV, second look the same day:* Who runs it in the row with the league's details; team names cream, your own team's blue; no pills on the league nights; a thicker green line on the banners; number tiles raised rather than inlaid, with smaller text; the places on a team card held within the arrow's row.
*Claude's, for UV to judge, second look:* the next night keeps its soft glow, since without it Next and Coming up are the same green.
*Not built:* a Scorer badge. "Scorer" is only a score-entry rule, and no person can be named one.
*So:* `docs/systems/leagues.md`, "The Season tab restyled"; `docs/ui.md`.
*Touches:* no migration. `_includes/league/season.html`, `scripts/league-season.js`, `scripts/ring-status.js`, `stylesheets/league-join.css`, `stylesheets/league.css`, `stylesheets/design.css`

## 2026-11-10 — Short links for players: their full name, built by the site

*Decided by UV:* a player's short link is their first name and surname with dashes (`Yuvan-Naidoo`), and a number only when the name is already taken. Full names, so a list of links can be searched elsewhere. It cannot be customised, and the first to register has the plain name. It follows the name: change your name and the old link stops working. A second person with a name gets the next number in order (`Yuvan-Naidoo-2`). A player without a first name and surname has no short link: Share gives the long address and their own page says why. A signed-out visitor is always asked to sign in first, found or not, so nobody can test names to learn who belongs to the club.
*Replaces:* "No other page has one" in the 9 Nov short links decision, for players only.
*Rejected:* a link fixed when first made; a random number; "Link not found" for a signed-out visitor; a display name standing in for a missing name.
*Claude's, for UV to judge:* only somebody with an account has a link, so a walk-in cannot hold a name ahead of whoever registers; a first name reading T- or L-, or either name under two letters, gets no link, since T-Bone would read as a tournament's code; a number freed by a change is given out again; accents dropped and apostrophes closed up (Jose-OBrien); the note on your own page always showing rather than only after Share.
*So:* `docs/design/short-links.md`, `docs/systems/foundations.md`, "Short links".
*Touches:* migration `20261110084238_player_short_links.sql`, `supabase/tests/067_player_short_links.test.sql`, `scripts/short-link.js`, `scripts/tdc.js`, `scripts/player.js`, `players/index.html`, `stylesheets/player.css`

## 2026-11-10 — My Season: where you stand, and your season so far

*Decided by UV:* "Players" becomes "My Season". The top of the tab is one compact row (team picture, team name, Captain) with My next match as the one main button, and Away and Not playing small at the foot of the tab. Your season so far: rank, frames played, won and lost, win %, lags won, plus your team's place and its results. Confirm, the other standings, Asked to join and Waiting for a team stay.
*Claude's, for UV to judge:* Asked to join and Waiting for a team above the season so far, since they need action; the numbers counted exactly as Standings with Live off, so signed nights only; a player whose name is only down, or who left without playing, sees no season section; the green glow and "Your place" label gone from the panel.
*Left open by UV:* the wording for a withdrawn player against the + in the banner ("leave it for now").
*So:* `docs/systems/leagues.md`, "My Season".
*Touches:* no migration. `_includes/league/season.html`, `scripts/league-season.js`, `stylesheets/league.css`

## 2026-11-10 — First name and surname asked for at sign-up, and skippable

*Decided by UV:* sign-up asks for a first name and surname, and a player may skip them, with the warning that no short link will exist without both. Somebody who skipped is asked again at each sign-in until both are in.
*Rejected:* making the names required, with the site waiting until they are in; asking once only; refusing a lone initial.
*Claude's, for UV to judge:* Google sends one full name, so the screen starts its boxes off with the first word and the rest, and nothing is saved until Save; Save needs both names, since Skip covers leaving them out; somebody who leaves the email form's names blank meets the screen after confirming their email; a signed-in player with a name missing who opens `/accounts/` meets it too.
*So:* `docs/design/short-links.md`, "Players"; `docs/systems/foundations.md`, "Short links".
*Touches:* migration `20261110093122_signup_names.sql`, `supabase/tests/068_signup_names.test.sql`, `accounts/index.html`, `accounts/names/index.html`, `scripts/auth.js`, `scripts/account-names.js`

## 2026-11-10 — A league for signed-out visitors: Season and Standings, and Visible to public

*Decided by UV:* only the Season and Standings tabs open to signed-out visitors, and everything else stays behind a login. **This replaces, from the 10 Nov entry "One page for a league", Standings asking for a sign-in.** Fixtures shows a short message with a Sign in button. "Show in the league search" becomes **Visible to public** and applies to links as well: off, a signed-out visitor is asked to sign in and is then taken to the page they wanted. The names and faces switch is off until the director turns it on. With it off, Standings shows only display names with rank, and the Season tab's teams show no players. Signed-out Standings has neither Live nor Full names: signed nights and display names only. The + stays for a signed-out visitor, going to sign-in and back to the page, where they tap it themselves. A rank is worked out from only the counts that decide it, sent to the browser and not drawn, rather than a second copy of the ranking rule in the database.
*Claude's, following UV's "everything else behind a login":* two reads of their own (`tdc_public_league_season`, `tdc_public_league_standings`) rather than auditing and opening each existing function as the earlier entry said. Opening them would have let anyone read the fixtures, every league and names the switch must hide. They are live reads, so the departure from 21 Oct stands.
*Claude's, for UV to judge:* team numbers staying on Team Rankings with the switch off, its teams opening onto rank and name; Who runs it always shown, as on the poster; withdrawn players left off a team and nobody marked Away; names plain text for a signed-out visitor; the switch affecting signed-out visitors only.
*Worth knowing:* with the switch off Standings still names people, and anyone with a free account sees every name. Turned on, a player's name and face are public on the director's choice alone, and the privacy page is not written yet (B1).
*Rejected:* the ranking rule in the database (it would live twice); the counts of every column going to a stranger.
*So:* `docs/systems/leagues.md`, "What a stranger can read"; `docs/STATUS.md` §1 4aj.
*Touches:* migration `20261110094557_league_public_reads.sql`, `supabase/tests/069_league_public_reads.test.sql`, `_includes/league/manage.html`, `scripts/league-season.js`, `scripts/league-standings.js`, `scripts/league-fixtures.js`, `scripts/league-nav.js`, `scripts/league-manage.js`, `scripts/auth.js`

## 2026-11-10 — The Season banner: who runs it in a row, lines between the details

*Decided by UV:* Who runs it in a row where possible, each person a picture beside their name over their role. Grey lines between the banner's details, vertical and horizontal.
*Claude's, for UV to judge:* Who runs it taking a whole row, which replaces this morning's "in the row with the league's details" because one column holds only one person; the details four across on a PC, three with no venue.
*So:* `docs/systems/leagues.md`, "The Season tab restyled"; `docs/STATUS.md` §1 4ak.
*Touches:* `src/scripts/league-season.js`, `src/stylesheets/league-join.css`

## 2026-11-10 — The Season tab: the details in one row, equal team cards, the numbers at the foot

*Decided by UV:* the banner's details and Who runs it all in one row where possible; a line across only once they wrap; lines unbroken, top to bottom and side to side, between sections only and never above or below them. Every team card the same size, a name that does not fit scrolling; equal cards in rows on a PC, an opened one taking the row. No green glow on your own team's card. The numbers moved to the last section before the page footer, their look unchanged (UV first asked for them smaller and in the banner, then withdrew that).
*Replaces:* the earlier entry today, Who runs it taking a whole row.
*Claude's, for UV to judge:* a name running sideways and back rather than round in a loop; "…" with less motion on; a team you have asked to join keeping its glow; the widths at which the details change layout (48rem, 75rem).
*So:* `docs/systems/leagues.md`, "The Season tab restyled"; `docs/STATUS.md` §1 4ak.
*Touches:* `src/_includes/league/season.html`, `src/scripts/league-season.js`, `src/stylesheets/league-join.css`, `src/stylesheets/league.css`

## 2026-11-10 — The rules as a document, and a second pill for whoever runs it

*Decided by UV:* the rules move from a folded section on the Season tab to a tab of their own, a clean written document explaining each rule, saying the ruleset applies to every match in the league, with the league director at the foot, picture and link to profile. Whoever runs a league or tournament gets the admin tabs in a new pill just under the first; the first pill shows every tab a player sees and takes the director there as a player, so they can show the league to somebody on their phone. The same for tournaments. Team cards centred in their rows.
*Claude's, for UV to judge (UV said to go ahead without a plan):* the director's controls on Fixtures and on the Draw had no home once those tabs became the player's view, so a **Schedule** tab and a **Run the draw** tab in the second pill show the same panels with the controls on; Approval and the Dispute window left out of the document, because a team card is settled by both captains signing whatever they say; tournaments got the pills and not a Rules tab; the wording of every clause; cards 22rem wide.
*So:* `docs/systems/leagues.md`, "The Rules tab, the admin pill"; `docs/systems/tournaments.md`, "Two pills"; `docs/STATUS.md` §1 4al.
*Touches:* `src/scripts/league-rules.js` (new), `src/_includes/league/rules.html` (new), `src/_includes/league/season.html`, `src/leagues/season/index.html`, `src/leagues/card/index.html`, `src/tournaments/bracket/index.html`, `src/scripts/league-nav.js`, `src/scripts/tournament-nav.js`, `src/scripts/league-fixtures.js`, `src/scripts/league-season.js`, `src/scripts/tournament-bracket.js`, `src/stylesheets/league-join.css`, `src/stylesheets/design.css`

## 2026-11-10 — A tournament's Rules tab; Approval and the Dispute window stay on a league's Settings

*Decided by UV:* tournaments get a Rules tab too. Approval and the Dispute window, which do nothing on a league night, stay on a league's Settings. **This settles two points from the entry above:** tournaments getting no Rules tab, and whether to hide those two settings.
*Claude's, for UV to judge:* Rules signed-in only, as the Draw is, the Poster being the page for a stranger; a round's own rules shown as only what differs, as on the poster; the wording of every clause.
*So:* `docs/systems/tournaments.md`, "The Rules tab"; `docs/STATUS.md` §1 4al.
*Touches:* `src/scripts/tournament-rules.js` (new), `src/scripts/rules-doc.js` (new), `src/_includes/tournament/rules.html` (new), `src/scripts/league-rules.js`, `src/scripts/tournament-nav.js`, `src/tournaments/bracket/index.html`, `src/leagues/season/index.html`, `src/stylesheets/league.css`, `src/stylesheets/league-join.css`

## 2026-11-10 — A league's document, the players' fixtures, one animation for tabs, nothing outside its card

*Decided by UV:* every tab selector behaves and animates the same. An LD may upload one PDF per league, 5 MB at most, opened by players from a link with no preview, for signed-in players only; the switch that turns off the generated rules appears only after an upload. **The Rules tabs are worded from the docs and updated whenever a policy changes.** Fixtures for players: table numbers under the ":" or arrow, no player counts, names in the display face and cream with only your team blue, right and left aligned about the middle, pictures inside the names, small grey lock replacing the bar on a completed match (an experiment), rows only as wide as they need, smaller names, a long name scrolling, a score never on two rows, the picture above the name when a row is too narrow, each round in an inset card with its date outside, filters in one row at one size, no Show byes, Planner and All fixtures as tabs, the Season tab's styling throughout. Admin pages later. Nothing extends outside its card and no card outside its container, anywhere; what does not fit scrolls inside. The Google button blue with the Google icon.
*Claude's, for UV to judge:* removing the document turning the generated rules back on (the tab would otherwise be empty); a re-opened card keeping its bar, since it is not locked; a folder limited to the document and one more; a 5-minute link; the 34rem at which a picture goes above its name.
*Rejected:* a permanent public link for the PDF.
*So:* `docs/systems/leagues.md`, "The Fixtures tab for a player", "A league's document"; `docs/ui.md`; `docs/STATUS.md` §1 4am.
*Touches:* migration `20261110123505_league_document.sql`, `supabase/tests/070_league_document.test.sql`, and the files in the commits

## 2026-11-11 — The players' fixtures: a match's state, round labels, full-width cards

*Decided by UV:* a player's fixture shows its match's state. **Scheduled** (no match yet): the grey lock in place of the ":", team names grey, no table number. **Opened for lineups** (a match made): a yellow checklist with a yellow glow in place of the lock, names cream, a side that has locked its lineup yellow. **Lineups in, started, scoring** (both locked, or frames in): a yellow play icon with a yellow glow, the scores yellow with a glow. **Completed** (signed by both): names green, no table number, the scores round a ":", the winner's green with a glow and the loser's grey. The checklist and the play open the card (the scorecard icon is no longer on a player's fixtures). The calendar's weekend headings are plain, no longer pills. Your own team takes its state's colour and is underlined (first kept blue, then underlined instead the same day). A re-opened card shows as being played. Each round's number and date are grey labels over its card, round left and date right, the date DD/MM/YY here only, in the display face; team names in the body face. Every round card (Planner and All fixtures) the tab's full width, names to its edges, every name one size and scrolling when longer than its half, fading at its edges (shrinking a long name was tried and dropped: too small); the score column the same width in every round; the picture and the name centred in their side when the picture sits above it. The state bar and the experimental lock were taken off first. Open the card a scorecard icon on the Schedule tab; date headings there in the body face.
*Claude's, for UV to judge:* a drawn final both scores green with the glow; an abandoned match grey as scheduled, its scores grey if any; the time kept beside the date in the round label; the checklist drawn with three ticks (UV's picture has four); the 6.5rem score column; team names bold (600) in the body face; the label at 1rem; the middle on the row's centre with its table hanging below; the scores in set slots, 1.75rem each, the middle 1.25rem, 0.25rem apart; the calendar's weekend headings plain on the Schedule tab too (it shares the calendar); a scrolling name faded at both edges, 0.75rem each, even where it rests against one; both lineups locked counting as started (the lock already sets the match in progress).
*Rejected:* shrinking long names to fit.
*So:* `docs/systems/leagues.md`, "The Fixtures tab for a player"; `docs/STATUS.md` §1 4an.
*Touches:* migration `20261111105904_league_fixtures_lineup_locks.sql`, `supabase/tests/071_league_fixture_locks.test.sql`, `src/scripts/league-fixtures.js`, `src/scripts/ring-status.js`, `src/stylesheets/league.css`, `src/_includes/league/fixtures.html`

## 2026-11-11 — Rivonia 8MTL comes onto the site: placeholders, and how its history is read

*Decided by UV:* bring Rivonia 8MTL 2026-27 onto the site from CueScore's frame-by-frame export and the league's players file. **Every player goes in**; those without an account are placeholders who link to their record when they sign up, the email from the players file being the main way (the existing walk-in claim). **A placeholder may be lined up before signing up**: UV's 22 Oct rule, "a league player needs an account of their own", changes for placeholders only. How a player who signs up with another email is linked is still to be discussed. A forfeited frame is an empty seat for now (the site's way: a walkover for the side that turned up, nothing against the absent player); recording forfeits properly comes later, and the data set keeps which side forfeited. A CueScore runout is a B&F. Nights where players moved positions mid-night go in exactly as played; the reserve rules apply from the first night on the site. The two nights missing from the export were postponed. League directors Rick Schoenlank and the admin@ account; UV's own account a player. Every night played counts as signed by both sides and published by the LD, both signatures recorded in Rick's name as LD, since the captains are not known and a placeholder cannot sign (management policies to be gone through later). Visible to public off until the players are told. The clean data set is kept outside git so the league can be deleted and imported again. Clear every test player, league and tournament from production; keep UV, the admin@ account, Rick Schoenlank, Linton Paul (and his credits), Basil's Billiards and Yeshveer Manawar.
*Claude's, for UV to judge:* the placeholder mark on the **league entry** rather than the player record (the league vouches for the person; once they claim, they have an account and the mark no longer matters); only the import sets it, with no page for it yet; a night's outside id kept on the fixture (`external_ref`) so the import can run again without doubling anything; the clean data set as a gitignored `private-data/` folder inside the repo.
*Rejected:* placeholders only in past frames, with every player made to sign up before playing (74 sign-ups before the first night on the site).
*So:* `docs/systems/leagues.md`, "League placeholders and a night's outside number"; `docs/STATUS.md` §1 R1.
*Touches:* migration `20261111130357_league_placeholders.sql`, `supabase/tests/072_league_placeholders.test.sql`, `supabase/seed/clear-test-data.sql`, `.gitignore`

## 2026-11-11 — The Rivonia 8MTL import: the fixtures list, its dates, and how nights go in

*Decided by UV:* **Knights take every BYE slot** of the published fixtures list (all 22 nights played match that way); their tables stay empty for the LD. **The published round numbers are used** (CueScore's rounds 2 and 3 are swapped). Every fixture goes in at **19:30**, at Billiard Café (Rivonia), BSC Travelers' home nights at Bryanston SC once it is a venue (a migration from its Google Maps listing). **Every fixture keeps its published date**, the two nights played late and the two postponed included. **From round 5 on, exactly 7 days later** than printed (4 Nov was a public holiday), which lands round 7 on 25 Nov, round 9 on 16 Dec and round 12 on 3 Feb, for the LD to move once he says how the shift runs. **Nights where players moved seats go in as played, written directly**, the reserve rules not applied. **Notifications the import causes are kept** (UV's and Rick's accounts). **The import is kept entirely in the private data folder**; nothing about it is committed.
*Claude's, for UV to judge:* a side's order is session 1's, a forfeited position taking the first player who sat there later, and every seat then set as played; placeholders without an email found again by name on a re-run; a fixture at a venue not yet on the site carries a note saying where, taken off when the venue exists; the import does not publish, because the site has no publish step for a league night (`tdc_approve_card` knows only tournaments).
*Rejected:* holding rounds 5 to 22 until the LD answers; a shift that skips event nights (UV chose the flat 7 days); the import's logic committed with only the data private.
*So:* `docs/systems/leagues.md`, "The Rivonia 8MTL import"; `docs/STATUS.md` §1 R1; the data set's README.
*Touches:* `private-data/rivonia-8mtl-2026-27/` only (gitignored): `clean.py`, `fixtures.csv`, `build_import.py`, `import-template.sql`, `import.sql`, `README.md`

## 2026-11-11 — The team card's colours follow a fixture's

*Decided by UV:* the card's finished banner, win dots in Head to head and By session, and "Signed" use the site's green, not the orange success colour. The banner's strip and badge follow the fixtures' colours and glow: every state before both have signed is yellow (Lineups not in included, as a fixture open for lineups is yellow), Signed by both green, both lit. Published stays grey.
*Claude's, for UV to judge:* Disputed kept red and unlit, as an abandoned fixture is.
*So:* `docs/systems/leagues.md`, "The card's colours follow a fixture's"; `docs/STATUS.md` §1 4ao.
*Touches:* `src/stylesheets/league.css`

*Decided by UV, later the same day:* the whole card copies the fixtures' and Season tab's styling, text colours and the banner design included, so the pages read as one language; apply the logic, don't ask item by item. Built: every score yellow until signed, then green (the winner green, the loser grey); banner names in the fixture's state colours, your own team underlined; every other team name cream; the Season tab's headings with a grey line through; the banner's details with the Season tab's grey lines between them; ":" between the result's scores.
*Claude's, for UV to judge:* Published names green (the result stands), though the badge stays grey; a disputed card's scores cream; the league over the result in the display face, cream; four details across from 48rem.
*Touches:* `src/leagues/card/index.html`, `src/scripts/league-card.js`, `src/stylesheets/league.css`, `src/stylesheets/design.css`

## 2026-11-12 — LF line endings, after the move to a Mac

*Decided by UV:* files use **LF**, not CRLF, now that the repo has moved from Windows to a Mac. The repository already stored every file as LF; the CRLF was only in the Windows working copies. A `.gitattributes` (`* text=auto eol=lf`) makes it the rule on every machine. `tools/dive-svg/build.js` writes LF instead of forcing CRLF.
*Rejected:* keeping CRLF (every file would have shown as changed on the Mac).
*So:* `CLAUDE.md` §1; `docs/systems/notifications.md` (the old CRLF trap marked as history).
*Touches:* `.gitattributes`, `CLAUDE.md`, `docs/systems/notifications.md`, `tools/dive-svg/build.js`

## 2026-11-12 — After the first night with players: reserves in the tables, one table for a player, a lineup sent once

*Decided by UV:* (1) **Reserves show in Every player's frames.** Head to head gives each reserve who played their own row in their team's table and their own column in the other's, after the positions, so a regular's row holds only their own frames. By session keeps a column per position, and a reserve's frame shows their small picture beside the mark; the foot counts the position's wins. (2) **A player's own view loses its head-to-head table**, which repeated By session. (3) **The lineup is sent only when Lock the lineup is pressed**, in one call; the switches and steppers make no network call. UV accepted the consequences: the cutoff locks what is saved, so a lineup set on the page but never locked has nothing in at the cutoff; a squad player sees the night once their side locks, not before (this changes the 5 Nov "found through its squad" behaviour in practice); a reload loses unsent choices.
*Why:* found on the first night played with real people (11 Nov): a reserve's frames were credited to the player they replaced, and a captain going quickly down the list waited on a save for every tap.
*Claude's, for UV to judge:* somebody who filled an empty position is drawn as a reserve (they were not in the order); a reserve's row and column are labelled "Reserve" rather than with the position they covered; `tdc_submit_lineup` refuses a side already locked, where `tdc_lock_lineup` alone shrugs, so choices are never thrown away silently.
*Rejected:* a column per reserve in By session (wider on a phone); keeping a lineup draft on the phone across reloads (offered, not asked for).
*So:* `docs/systems/leagues.md`, "Nothing is sent until the lock", "Reserves in the players' tables", "The player's view has one table".
*Touches:* migration `20261112125926_league_submit_lineup.sql`, `supabase/tests/073_league_submit_lineup.test.sql`, `src/scripts/league-card.js`, `src/leagues/card/index.html`, `src/stylesheets/league.css`

## 2026-11-12 — The lineup page, Now and next, F1, players centred

*Decided by UV:* until both lineups are in, the card is a **lineup page for everybody**: the two teams' season so far as a **football-style head-to-head table**, then **each team in a table of its own** with the **league's Standings columns** for its players. **A captain manages and locks their lineup in their own team's table**; players see the tables read-only, and only ever see this page and then the scorecard. The page follows the Season, Fixtures and scorecard pages' look and colour rules. **Now and next** at the top of the scorecard: the next four frames without a result, plus any frame whose lag is in without a result, the out-of-order ones at the top; each an inset pill with the scorecard's L and W, disabled for anybody but a captain; a leaving pill fades out completely, the list lifts, then the new one fades in at the bottom. **"F1"** for "Frame 1". **Wherever a player takes more than one line, the picture and the name are centred.**
*Claude's, for UV to judge:* the better of two teams' values green and lit, the other grey, level both green, only for the league position and the columns that rank the table (no colour where "better" is not known); the league director keeps the side switch rather than both tables being live; on a phone the team being set up comes first, its initials column dropped and its numbers scrolling sideways as the Standings tab's; a stray frame (lag in, outside the next four) that falls into them leaves the top and fades in again at the bottom; the pill's top line says the session and "Under way" (the F is under the home player); the director's switches in Now and next are live (the director runs everything alone); "under way" means a lag is in, which holds for `lag_each_frame` and `by_schedule` but not a derived break rule.
*Rejected:* bars under the head-to-head numbers (not asked for); showing tonight's order on the lineup page beyond what `tdc_match_lineup` already reveals to the reader.
*So:* `docs/systems/leagues.md`, "The lineup page", "Now and next", "F1, not Frame 1, and a player centred"; `docs/ui.md` (headless at 500px, motion checks).
*Touches:* `src/leagues/card/index.html`, `src/scripts/league-card.js`, `src/stylesheets/league.css`, `src/stylesheets/design.css`

## 2026-11-12 — Now and next in two rings, sized by the tables; a compact banner once the lineups are in

*Decided by UV:* Now and next shows **twice as many frames as the match has tables**, or **four** where no tables are set. The frames under way sit in a **yellow ring (Now)**, the rest in a **grey ring (Next)**, each a group. Adding and removing animate: **fade out, the cards scroll up, then the new one fades in**, and a frame **moving between the groups out of order animates too**. **Once both lineups are in, the banner is compact**: only the teams and the state above the "Record each frame…" line, with a **dropdown arrow centred** to show the rest; **closed by default once the lineups are in, open by default before**.
*Claude's, for UV to judge:* "under way beyond the shown frames" still joins Now (out of order, first); a group that empties folds away as one, and a new group fades in as one rather than pill by pill; the reader's own opening or closing of the banner is kept until the lineups change state; the arrow points down when closed and up when open, as every folding group's.
*So:* `docs/systems/leagues.md`, "Now and next in two rings; how many; the compact banner".
*Touches:* `src/leagues/card/index.html`, `src/scripts/league-card.js`, `src/stylesheets/league.css`

## 2026-11-12 — On a small phone a frame stays on one row

*Decided by UV:* on small screens a player's name word-wraps rather than the L and W switches moving to a row of their own.
*Claude's, for UV to judge:* the switches a little smaller below 24rem (5.25rem wide, from 6.25rem) and the names 0.9rem there, so a name wraps at its spaces rather than inside a word.
*Replaces:* the 24rem rule that put the names side by side and the switches under them.
*Touches:* `src/stylesheets/league.css`

## 2026-11-12 — A full name's surname is lighter, site-wide

*Decided by UV:* wherever a player's first name and surname are shown, the surname is drawn in a lower weight than the first name, as a rule across the whole site (asked first for the league pages, then made site-wide). **Full names only**: display names are never split. **The server sends the surname on its own**, so a two-word first name splits correctly. **The surname is always 400**, whatever the first name's weight.
*Rejected:* splitting display names too (they are often nicknames); splitting the full name at its first space in the browser (wrong for "Mary Anne Smith"); one step lighter than the first name (300 where the name is already 400); always 300.
*Claude's, for UV to judge:* the new field is called `surname`, not `last_name`; a full name in the draw no longer fades when its slot changes (`TDC.liveFade` skips elements holding other elements).
*So:* `docs/systems/foundations.md`, "Full names: the surname lighter"; `docs/ui.md`, "Full names".
*Touches:* migration `20261112152540_surnames_apart.sql`, `supabase/tests/074_surnames_apart.test.sql`, `src/scripts/tdc.js`, `src/stylesheets/global.css`, `league-standings.js`, `league-manage.js`, `tournament-bracket.js`, `tournament-manage.js`, `match-new.js`, `match-settings.js`, `match.js`, `player.js`, `nav.js`, `profile.js`, `staff-common.js` and the five staff pages that use its player line

## 2026-11-13 — Getting the app: a strip, a menu row, the steps by device, and a record

*Decided by UV:* prompts that guide new players to install the app, from Claude's plan, taken whole ("go for all your suggestions"): a strip under the nav bar, a "Get the app" row in the menu, and the install steps at the moment they matter (notifications on an iPhone); **no pop-up**. **Phones only.** The strip shows on a first visit; it shows on every page from a visit to the home page until ✕, and after ✕ only again at the next visit to the home page. **Record which device, browser and app-or-not each signed-in player uses**, so installs can be counted (points), starting now. UV will refine the look afterwards.
*Why:* 6 of the 13 accounts were last on an iPhone in Safari, where notifications reach only the installed app and a site cannot install itself; app installs were already listed as data that cannot be recovered later (`docs/design/points-and-tiers.md`).
*Rejected:* a pop-up (interrupts); the browser's own install banner (Android only, its timing not ours, so it is held back for the site's own strip).
*Claude's, for UV to judge:* the strip's look and words; the installed app's one-off welcome (sign in once more, then turn on notifications); `/install/`'s written steps for iPhone Chrome, Android and in-app browsers until they are drawn; the record as one row per player, device, browser and app-or-not, once a day, Johannesburg days, unknown values refused.
*So:* `docs/systems/foundations.md`, "Getting the app"; `docs/systems/points.md`, "Using the app".
*Touches:* `src/scripts/device.js` (new), `_includes/layout.html`, `_includes/nav.html`, `scripts/nav.js`, `stylesheets/nav.css`, `scripts/ring-status.js`, `install/index.html`, `scripts/install.js`, `stylesheets/install.css`, `accounts/profile/index.html`, `scripts/push.js`, `scripts/points-formula.js`, migration `20261113164109_player_devices.sql`, `supabase/tests/075_player_devices.test.sql`

## 2026-11-16 — On an iPhone, the install page sends other browsers to Safari

*Decided by UV:* on an iPhone in Chrome (and so Edge and Firefox too, the same section), `/install/` first tells the person to open the site in Safari, then the rest of the process follows there. It stresses that the app installs only through Safari, and that adding it through Chrome always opens the site in Chrome, not as the app.
*Why:* UV found that an icon added from Chrome on an iPhone opens the website in Chrome rather than as the installed app, so the 13 Nov written steps for Chrome led to an icon that is not the app (and an iPhone's notifications reach only the installed app).
*Rejected:* the 13 Nov written Share → Add to Home Screen steps for Chrome, Edge and Firefox (Claude's), removed.
*Claude's, for UV to judge:* the words; **Copy the link** as the way across (no button opens Safari directly); the line telling anyone who already added it from Chrome to delete that icon and add it again from Safari.
*So:* `docs/systems/foundations.md`, "Getting the app".
*Touches:* `src/install/index.html`, `src/scripts/install.js`

## 2026-11-14 — The pool-table banner is the site's banner; today's banner is its reduced-motion form

*Decided by UV:* the banner built on `/sandbox/banner/` (the hero's table as the banner's edge: cushions and pockets, no markings, the balls playing shots over the banner's text, frosted, the cushions following the banner as it opens and closes and pushing the balls) becomes **the normal banner, site-wide**. **The existing banner** (the sunken card with the green line inside its edge, `league.css` `.jumbo`) **stays, as the banner under reduced motion.**
*Why:* UV's design for the banner; the animation is the motion, so less motion keeps the still banner the site already has.
*Also decided by UV, the same day:* the **top banners only** (the league's Season tab, the scorecard's top banner, the tournament poster, the venue page); the scorecard's result-and-signatures section keeps today's look, as it holds a form. Switching less motion on or off changes the banners **straight away**. The shot readout stays on the sandbox only.
*So:* `docs/systems/file-map.md`, the banner sandbox; the build onto the real banners is planned in `docs/STATUS.md` §1 4au.

## 2026-11-14 — The policy pages: what is sold, refunds, delivery, age, privacy

*Decided by UV*, for PayFast's onboarding (worked through in the claude.ai project, 14 Nov):
- **Scope:** The Dive Club only; terms for other clubs come later. The company and contact details are shown on the policy pages only, never the footer: The Dive Club (Pty) Ltd, 2025/917817/07, not registered for VAT; trading address C5, The Gantry, Lonehill, Fourways, 2191; registered office "Kyalami, Midrand, 1684" (the short form, with a note that it is being updated); admin@thediveclub.org, +27 82 766 4905. Never the tax number, bank details or the director's ID.
- **Information Officer:** UV. Not yet registered with the Information Regulator.
- **Sold through PayFast:** credits only. Credits buy table time, games and activities, entries and merchandise.
- **Refunds:** credits not refundable except where the law requires; credits never expire; no refund of an entry once entered; an event the club cancels is refunded in full in credits; a card refund, where due, goes to the original method within 5 business days of approval (the bank a further 3 to 10).
- **Delivery:** credits added at once; activities used at the venue; merchandise bought with credits and collected at the venue within 30 days by the account holder with ID, else cancelled and the credits returned; out of stock, credits returned in full; nothing posted.
- **Age:** the site is open to all ages; adults-only areas, products and features unlock only after staff verify an ID in person; restricted products are never named. Under 18: a parent or guardian gives their name and email and confirms by email; minors are shown like everyone else.
- **Privacy:** ID photos (planned) kept while the account is open and 30 days after; the device record while the account is open; a closed account's match history keeps the name, everything else deleted, payment records five years; a former player may ask for their name to be removed; a player may hide their photo; account deletion is a button in the profile, **built before the pages go live**.
*Claude's, for UV and the reviewer to judge:* the standard clauses UV did not discuss: rulings final for a competition, suspending an account, points and tiers having no cash value, our content and the profile picture permission, the limits of liability, credits bought at the venue as well as online, prices of credits and items changing, the breach notice, the legal grounds, and the providers named as processing outside South Africa.
*So:* `/termsofservice.html`, `/privacypolicy.html`, `/refunds/`, `/delivery/`; STATUS B1.

## 2026-11-16 — The middle pockets get bevelled knuckles; the pool table is made cheaper to draw without changing its look

*Decided by UV:* knuckles on the pockets, made as **a straight bevel on the existing line, not curves** ("simpler than curves"), **half a ball** long ("bold"), on **the middle pockets only**, the corners left as they were. On both tables (the banner and the hero). Balls come off the bevel as off a cushion (Claude's, from the plan UV approved).
*Also decided by UV:* the animation stutters in Low Power Mode, and "it's really beautiful as is": **every speed-up that does not change the look is built now**; those that do (C1 the glow worked out per pixel, G lighter or no frosted circles, H a lighter version on a struggling phone, I less planning time) wait until UV has seen the result on his phone.
*Rejected:* curved knuckles (UV: a bevel is simpler); bevels on the corner pockets (UV).
*Claude's, within "no change to the look":* a ball painted again only when it has turned; its body and each pixel's place on the sphere once per size; its glow and its shadow blurred once into pictures and reused; the canvases drawn again only when something on them changed; the light alone redrawing the table at most every 200 ms; the banner's size read only while it may be changing. Proven by a pixel comparison of the same moment before and after (only the bevels differ; the cue ball by at most 3 of 255).
*So:* `docs/systems/file-map.md` (the hero and `banner-table.js`, "The knuckles", "Drawing cost"); STATUS §1 4av.

## 2026-11-16 — The look-changing speed-ups are built as switches; UV chooses on his phone

*Decided by UV:* "implement all and let me decide": the speed-ups that change the look (a quarter-size glow blur, lighter or no frosted circles, lower sharpness, and a lighter version once the phone struggles, including smaller planning slices) are **built, each off**, for UV to try in Low Power Mode before any reaches the real pages. Also UV: **fix the sideways scroll** from a dropping ball's frosted circle.
*Claude's, for UV to judge:* the switches live on `/sandbox/banner/` only and are kept in that browser; the banner only (the hero has no frosted circles and is on no real page); C1 became a quarter-size blur rather than a glow worked out per pixel, since a per-pixel glow could not reach outside the ball as the blur does; "struggling" is the time between frames averaging over 45 ms for 2 s (an iPhone in Low Power Mode runs at 30 frames, 33 ms, so a steady 30 is not struggling), and once struggling a page stays so until reloaded, so the drawing never flicks back and forth.
*So:* `docs/systems/file-map.md` (`banner-table.js`, "The frosted circles", "The look-changing speed-ups"; the banner sandbox, "Speed"); STATUS §1 4av.

## 2026-11-16 — The light holds while the balls roll, once a stutter is seen; changes apply site-wide

*Decided by UV:* the stutter left is "when the light moves and the balls are moving at the same time", so the page's light **stops moving once a stutter is seen, while the balls move**, and drifts in the pauses. **On the real pages, everywhere** ("The changes we make must apply everywhere. Site wide."): every banner and the hero.
*Rejected:* holding it always while balls move; holding it only once "struggling" (the 22-frames test); a sandbox switch first (UV: site-wide).
*Claude's, for UV to judge:* a stutter is a frame more than twice the usual time between frames and at least 40 ms (so a steady 30 frames in Low Power Mode is not one); once seen, the rule stands for the rest of the visit; it uses `page-light.js`'s existing hold, as the dots and the dropdown do, so the light carries on from where it stopped.
*So:* `docs/systems/file-map.md` (`banner-table.js`, "The light"); STATUS §1 4av.

## 2026-11-16 — A ball's trail is drawn on the table's surface only

*Decided by UV:* no trail is drawn where a ball crosses an **inset or raised** element in the banner; the line only draws on the table surface. Every banner.
*Rejected by UV:* the banner's sunken elements as holes balls fall into (built, then discarded the same day).
*Claude's, for UV to judge:* "raised or sunken" is read from the look (a visible shadow on the element or its picture layer, or a hexagon or shield), so a new such part on a banner is left clear by itself; the line is cut at the part's own outline, not its shadow's reach.
*So:* `docs/systems/file-map.md` (`banner-table.js`, "No trail over the banner's raised and sunken parts"); STATUS §1 4av.

## 2026-11-16 — League placeholders link by themselves; the yellow strip; initials in the nav

*Decided by UV:* a player signing in whose confirmed email matches a league placeholder is **linked automatically**, with nothing pressed, and a **site-yellow strip** says "your account has been linked to existing stats", **above the Get the app strip**, with a ✕, **kept on this device only until ✕**, and **a button to the league they were linked to**; **tapping that button counts as ✕**. **Leagues only**: league entry is stricter than a tournament's and nobody can make a league walk-in on the site (only the import did). The strip follows `--color-warning`, so it is **dark red in the light theme**. Signed in without a picture, the nav shows **the display name's initials** instead of the generic icon, **one letter for a one-word name**, as on the profile menu and the Season tab. A home-screen link to the player's active leagues comes later; the strip is enough until then.
*Claude's, for UV to judge:* the link runs on **every signed-in page load**, not only at sign-in, so players already signed in are caught too (Vashan Reddy signed up on 11 Nov and never opened his profile); it runs before the nav reads the player, adding one call to each load. A link the merge refuses (two SA IDs, both in one season) shows its error in the same strip, red, on every page. The strip's wording; a button per league season, labelled with the league's name.
*Rejected:* a trigger on sign-up (a failed merge would break signing up); keeping the strip on every device (a column and a second function, for little gain).
*So:* migration `20261116073757_league_auto_link.sql`, `supabase/tests/076_league_auto_link.test.sql`, `src/_includes/nav.html`, `src/scripts/nav.js`, `src/stylesheets/nav.css`; `docs/systems/leagues.md`, "League placeholders"; STATUS §1 4aw.

## 2026-11-16 — Anybody who runs a league or tournament may change its short code

*Decided by UV:* any LD (and any TD) may change the short code, not only whoever set it. Asked whether that should include venue staff: **yes, anyone who runs it**: every LD or TD, a league's creator, and the venue's owner, admins and staff, the same people who see the Settings tab. Raised because a league's second LD saw "Only Rick can change this code".
*Replaces:* "Only whoever set it may change it, a co-director or the club owner included" in the 9 Nov short links decision.
*Claude's, for UV to judge:* `short_code_by` is kept and now records who changed the code last; a director who leaves loses the right with everything else in Settings, even if they changed the code last.
*So:* migration `20261116083932_short_code_any_director.sql`, `supabase/tests/066_short_links.test.sql`, `src/scripts/short-code-field.js`; `docs/design/short-links.md`, "Who can do what"; `docs/systems/foundations.md`, "Short links".

## 2026-11-16 — No orange: every state in the site's existing colours; the profile menu's order

*Decided by UV:* everywhere orange was used, it follows the state colours instead, using only existing site colours. A running league is yellow, as anything under way is: its strip on the season banner, the leagues list and the search tile, its badge, and its row in the nav menu. **On break is grey** (it was yellow, which would now match running). The staff hub's any-staff tile heading is **cream**. In the profile menu, **what you're in (Matches, Leagues, Tournaments) comes above Played recently and Play most often**, and so does "You are not in anything right now" with its buttons.
*Replaces:* "The alternate green (`--color-success`) becomes a muted orange everywhere it is used" (9 Nov); the people first in the profile menu (5 Nov).
*Claude's, for UV to judge:* success messages and the Verified, Agreed, Sanctioned, Confirmed and Paid badges green (done or agreed, as Signed is green); a running league's menu row yellow without the glow a live match's row has (a league runs for months); `--color-success` removed rather than kept as an alias, so it cannot creep back.
*So:* `docs/ui.md`, "State colours" and "The profile menu".
*Touches:* no migration. `src/stylesheets/variables.css`, `league.css`, `nav.css`, `forms.css`, `design.css`, `src/scripts/nav.js`, `src/scripts/sandbox.js`, `src/sandbox/index.html`

*Decided by UV, later the same day:* team names had almost no line spacing, so a name on two lines overlapped (the underline under your own team touched the next line). Every team name in the display font now uses the headings' line height, 1.32.
*Claude's, for UV to judge:* 1.32 as the "small amount" (it was 1.1 to 1.15), chosen because headings already use it.
*Touches:* `src/stylesheets/league.css`

## 2026-11-16 — The team card's folded banner keeps the venue and the discipline; Game in its details

*Decided by UV:* when the banner is folded, it shows badges for the venue and the discipline only, under the ":". The discipline is also among the banner's league details.
*Claude's, for UV to judge:* the badges grey (they are not a state); a badge per venue when a night has more than one; the detail labelled "Game", the Season tab's and the poster's word (the match page says "Discipline"); the team card's banner taken as the only one that folds (the Season tab's and the poster's already list Game).
*So:* `docs/systems/leagues.md`, "The folded banner's badges".
*Touches:* `src/leagues/card/index.html`, `src/scripts/league-card.js`, `src/stylesheets/league.css`

## 2026-11-16 — The home page: the site icon where the loader leaves it, the hero's table covering the screen

*Decided by UV:* the home page loses "Lonehill, Fourways · Opening soon" and the My Account button. The full logo gives way to the site icon (portal, ladder and diver, no wordmark) **at the loading screen's size and in its spot, the portals aligned**, so the loader fades into the page. **The hero's table covers the screen**, under the bar to the foot of the first screen, **its shape following the screen rather than a real table's**, and **the icon always sits inside it, as if on the cloth**. On the home page the table has **no logo and no markings** (the sandbox keeps both). The table **plays whatever the motion setting**, as the sandbox does.
*Claude's, for UV to judge:* the icon drawn under the table, so the balls roll over it; the icon is the loader's own drawing at rest (`dive.svg`, laid out by `dive.js` with the loader's options), not `icon-primary.svg`, so the portals match to the pixel; 18 balls of cloth across the short side unless holding the icon needs smaller balls; the table's margin half a ball, so it runs nearly to the screen's edges; a side of the icon that would need balls under 9px is not held (a phone on its side: the portal's foot over the bottom cushion, the diver's head under the bar); the search description still says "Opening soon".
*So:* `docs/systems/file-map.md`, the home page and the hero.
*Touches:* no migration. `src/index.html`, `src/scripts/home.js` (new), `src/scripts/hero.js` (was `sandbox-hero.js`), `src/sandbox/hero/index.html`

## 2026-11-16 — The home page's table frozen, its content scrolling on the cloth

*Decided by UV, later the same day:* **no icon** on the home page (and so not its grey version). **The table is frozen with its animation** over the whole screen, under the bar, which hides it until the bar slides away; **the content scrolls inside the table**, as wide as the cloth. **The balls roll over the content**, and **the table's shadows, highlights and outline lie over it too**. **The content starts at the top of the cloth.** **The footer is always at the foot of the page and nothing scrolls past it.** **The banners under the bar stay above everything, as the bar does.** **The balls are sized from the pockets, and the pockets from the screen.**
*Replaces:* the icon in the loader's spot and the cloth sized to hold it (the entry above).
*Decided by UV, later the same day:* the pockets keep **the banner's maximum, 32px** (14 Nov): UV preferred the small pockets and balls of the stretched table with the icon on it, which came from fitting the icon, not from a rule. Measured as the banner measures it, on a middle pocket, so balls are at most 16.8px on any screen.
*Claude's, for UV to judge:* a corner pocket's mouth 0.08 of the screen's short side below that maximum (only a small screen comes under it); the content's first line padded below the bar and any banner, so it is not hidden when the page opens; the banners sliding away with the bar (elsewhere they scroll away with the page); the window not scrolling, so the bar's hiding follows the box's scroll (`nav.js`, `data-page-scroll`); the footer's own solid background kept, so it reads as a panel on the cloth.
*So:* `docs/systems/file-map.md`, the home page and the hero.
*Touches:* no migration. `src/index.html`, `src/scripts/home.js`, `src/scripts/hero.js`, `src/scripts/nav.js`

*Decided by UV, later the same day:* on the home page **the bar always shows** (no hiding on scroll), and **the table fits the screen under it**. The banners under the bar stay above everything, over the table's top.
*Replaces:* the table running under the bar and showing whole once the bar hides; the bar following the content box's scroll (`nav.js` and `data-page-scroll` are back as they were: the bar hides only on the page's own scroll, and this page never scrolls).
*Claude's, for UV to judge:* the table not made smaller for a banner (they come and go, and a resize would move the balls); the content's first line padded below a banner instead.
*Touches:* `src/index.html`, `src/scripts/home.js`; `src/scripts/nav.js` unchanged from before this work

## 2026-11-16 — The home page's Get the app card

*Decided by UV:* on the home page, a **raised glass card with a blur**, linking to `/install/`, on **any device not using the installed app** (computers too, unlike the strip, which is phones only); **never in the installed app**. **Cut off by the table's edge, but shown over the balls** ("if not possible, the balls above the card": it was possible). **At the top of the content**, scrolling away with it. **The Get the app strip stays** on the home page as well. **No ✕.**
*Decided by UV, the same day:* **the gap below the sponsor banner is the gap between every card on the page** (`--space-5`, `footer.css` `.site-partners`), so the card has it below it too. On a screen taller than the content, the footer still keeps to the foot of the cloth, so the room left over still opens between the card and the banner (open, for UV).
*How:* the content lies under the balls, so the card is drawn in its own layer over them, clipped to the same rounded shape on the cloth as the content and moved with the content's scroll, over an empty spot of its height (`docs/systems/file-map.md`, the home page).
*Claude's, for UV to judge:* the words ("Get the app", "Install The Dive Club on this device") and the site icon on it; the card as wide as the content (1,360px on a large screen); the glass (the page's background at 35%, a 12px blur); a finger dragged on the card not scrolling the content (the wheel does), as it sits outside the scrolling box.
*Touches:* no migration. `src/index.html`, `src/scripts/home.js`

## 2026-11-16 — The home page's three cards: Matches, Leagues, Tournaments

*Decided by UV:* for everybody, three cards under the Get the app card, **raised in the site's card style with a solid background**. **Signed out:** Leagues and Tournaments show the **publicly visible** ones; Matches says **"Sign in to start a new match."** **Signed in:** my leagues, my tournaments, my recent matches. **Each league and tournament a badge with only its name under it; each match the player or team last played.** **Active first.** The **state colours**, and **status bars** where possible, as the league pages use them. **One row on a computer.** **Six badges and five matches** per card, the heading's All › for the rest; the **Get the app card full width above** the row.
*How:* one database call, `tdc_home_cards` (migration `20261116132606`), which signed-out visitors may call. "Publicly visible" is what a venue's page already shows a stranger: a listed season (whose Season tab opens signed out) and a listed tournament with a public poster (its link). Signed in, it reads `tdc_my_leagues`, `tdc_my_tournaments` and `tdc_my_matches`, so who is "in" stays decided in one place each. `docs/systems/file-map.md`, the home page.
*Claude's, for UV to judge:* a tournament's badge (no tournament has a picture: its trophy in its state's colour in a sunken circle, as the poster's banner has the trophy); a refereed match not counted as one played; the order of active (leagues running, taking entries, on break, finished; tournaments under way, open, draft, finished; a match being played, then the newest); a match's colours (a dispute or abandoned red, being played or waiting on a signature yellow, done green with the glow, not started green); the empty cards' words ("You are not in a league yet. Find a league", "No public leagues yet."); the cards in the order UV named them.
*Touches:* migration `20261116132606_home_cards.sql`, test `077_home_cards`, test `069` (the new function is one a stranger may reach); `src/index.html`, `src/scripts/home-cards.js`, `src/stylesheets/home.css`, `src/stylesheets/design.css` (the two picture lists)

## 2026-11-16 — Every raised card on the home page: over the balls, under the table's edge

*Decided by UV:* the three cards behave like the Get the app card, **above the balls but cut off by the table's edge**; **the rule on this page for all raised cards.**
*How (Claude's):* not the Get the app card's own layer, moved with the scroll: a finger dragged on it could not scroll the content, and three cards cover most of a phone's cloth. Instead the content's box stops being a layer of its own (absolute, no z-index), so each raised card (`.home-raised`) takes a z-index over the balls while staying in the box: it scrolls natively and the box's rounded edge clips it. The Get the app card moved onto the same rule. `docs/systems/file-map.md`, the home page, says what breaks it.
*Replaces:* the Get the app card's own layer (`#home-over`, its empty spot, the scroll-following and wheel-forwarding in `home.js`).
*Not checked:* on an iPhone (Safari); checked in Chrome headless, touch included.
*Touches:* `src/index.html`, `src/scripts/home.js`

## 2026-11-16 — The home page opens on the logo and the markings

*Decided by UV:* above the Get the app card, **the site icon with the lettering behind it** (the full logo), **in the middle of the table, sized by the golden ratio**; **it is the only thing visible when the page opens**, the cards and the rest found by scrolling down. **The table's markings with it, one unit, scrolling up together.** The logo square, **the cloth's shorter side over 1.618** (UV's choice of two); **the balls roll over it** (UV).
*How:* the logo's section is the cloth's visible height; the markings, which the table drew on the fixed cloth, are drawn by `hero.js` on a canvas in the content instead (`data-markings-into`), so they scroll with the logo. `docs/systems/file-map.md`, the home page.
*Replaces:* the home page's table without markings (16 Nov, "no logo and no markings on the cloth"), for the markings only: the table itself still draws none and no logo of its own.
*Claude's, for UV to judge:* the logo centred in what is seen below a banner when one shows (so it sits a little lower than the markings' middle then); the logo at rest, not the loader's falling diver; its own colours.
*Touches:* `src/index.html`, `src/scripts/home.js`, `src/scripts/hero.js` (`data-markings-into`, `drawMarksInto`; `/sandbox/hero/` unchanged)

*Decided by UV, later the same day:* **the Get the app card, when it shows, sits at the top of the table, between the table's edge and the cross**; with the table on its side (a computer, a phone turned), where the cross is at the left, **in the band between the top cushion and the logo, centred** (UV's choice of three). It scrolls away with the logo and the markings.
*Claude's, for UV to judge:* the card at most 32rem wide (it had run the cloth's whole width on a computer); centred in its band.
*Found:* on a phone on its side (844×390) the band above the logo is 51px and the card 66px, so it was cut by the top cushion and overlapped the logo's top. *Decided by UV:* **there, a one-line card, the icon and "Get the app" only** (UV's choice of four): whenever the full card is taller than its band, it becomes one line (48px).
*Touches:* `src/index.html`, `src/scripts/home.js`, `src/scripts/hero.js` (`heroBed.cross`, `heroBed.land`), `src/stylesheets/home.css`

## 2026-11-16 — The Matches card: league and single matches in one list, each with a badge

*Decided by UV:* league and single matches **in the same list, with different badges** (asked after UV's own six matches on the card turned out all to be league nights).
*How:* `tdc_home_cards` gives each match its kind (migration `20261116140609`, the earlier function's text with one field added): `league` for a league fixture's match, `tournament` for a tournament fixture's, `social` for one started on its own.
*Claude's, for UV to judge:* the words, League, Tournament and Singles (a match started on its own is Singles; a tournament match its own badge rather than Singles); the badges in the site's plain badge style; on a phone, the names shortened further to make room.
*Touches:* migration `20261116140609_home_cards_match_kind.sql`, test `077_home_cards`; `src/scripts/home-cards.js`, `src/stylesheets/home.css`

## 2026-11-16 — The sponsor banner: logos in the background colour, no masks, its own layer

*Reported by UV:* a lot of flickering on the sponsor banner on the iPhone, seemingly when the light moves, with and without Low Power Mode.
*Found (headless Chrome, a trace while the light moved):* every repaint of the page, about 70 a second, covered the banner, so it was drawn again each time; its icons were cut-outs made with masks, which Safari redraws and can show blank for a moment.
*Decided by UV:* **instead of negative space, the logos in the site's background colour**; and **an inset shadow and highlight, above and below only**.
*How:* `partners.js` draws each logo in the background colour and the banner shows that picture: no mask anywhere in the banner (the phone carousel's edge fades are grey laid over its edges). The banner is a layer of its own (`will-change: transform`); measured again, it was not repainted at all while the light moved.
*Claude's, for UV to judge:* the shadow and highlight fixed (the shadow along the top, the highlight along the foot) rather than following the light, so the light never redraws the banner; their strength, the design's colours at half the design's blur.
*Not checked:* on an iPhone, where the flicker was seen.
*Touches:* `src/_includes/footer.html`, `src/scripts/partners.js`, `src/stylesheets/footer.css`, `src/resources/partners/README.md`

## 2026-11-16 — Get the app card's ✕; notifications asked for in the app after signing in

*Decided by UV:* **an ✕ to dismiss the home page's Get the app card**, which **hides it until the next visit** (UV's choice of two; nothing is kept). *Replaces:* "No ✕" (16 Nov, "The home page's Get the app card").
*Decided by UV:* **in the installed app, after signing in, a prompt to turn notifications on, rather than waiting for the profile page**, with **a notice that notifications are controlled from the profile page**; **in the strip under the bar** (UV's choice of two, in keeping with no pop-up).
*How:* the welcome strip's Turn on runs the profile button's own subscribe flow in the tap (moved, unchanged, into `scripts/push-core.js`, which both use), so the phone asks there and then. `docs/systems/foundations.md`, "Getting the app".
*Claude's, for UV to judge:* the words ("Turn on notifications to hear about your matches. You can change them any time on your profile page."; after it, "Notifications are on…" or, refused, that only the phone's settings can undo it); the welcome ending once notifications are on or refused.
*Not checked:* on a phone; driven headless as the installed app with a stand-in sign-in, where the flow stops at "no service worker" (none off the live site).
*Touches:* `src/index.html`, `src/scripts/home.js`, `src/scripts/nav.js`, `src/scripts/push.js`, `src/scripts/push-core.js` (new), `src/_includes/layout.html`

## 2026-11-16 — The 8-Ball Mainstream link's own share picture

*Decided by UV:* `thediveclub.org/L-BC8MTL` previews with its own picture: The Dive Club's mark and Billiard Cafe's logo, the green band from the site's share picture reading "8-BALL LEAGUE / BILLIARD CAFE / RIVONIA", **square**, the words wrapped and the logos smaller.
*How:* a real page at that address (`src/L-BC8MTL.html`), since WhatsApp reads only a page's own tags; it forwards through `short-link.js` as every short link does. `layout.html` takes a page's own `ogImage`. `docs/systems/foundations.md`, "Short links".
*Claude's, not asked:* the title "Billiard Cafe 8-Ball Mainstream" and description "Fixtures, standings and results for the 8-ball league at Billiard Cafe, Rivonia."; the thin line between the logos; PNG rather than JPG (182 KB).
*Touches:* `src/L-BC8MTL.html` (new), `src/resources/share/L-BC8MTL.png` (new), `src/_includes/layout.html`

## 2026-11-16 — Team names on one line, running sideways; the installed app's screen measured again after the keyboard

*Decided by UV:* **a team name that is too long runs sideways ("autoscroll")**, never broken inside a word, on the scorecards (UV's choice over shrinking to fit or hyphenating). Applied wherever a team name in the display face wrapped by the letter: the card's banner and result (`.cj-name`), the session headings (`.cs-team`), the lineup page's head-to-head (`.lu-cmp-team`), the Season tab's own team (`.ms-team`). *Replaces:* the 16 Nov "Team names' line" rule for these places (they no longer wrap).
*How:* one shared helper, `TDC.runName` (`tdc.js`), with `.tdc-run` in `design.css`, the Season tab's cards' and the players' fixtures' run (10–11 Nov) made shared. With less motion it stands still at "…". `docs/ui.md`, "Team names on one line".
*Decided by UV:* **guard against iOS's keyboard bug** in the installed app (seen in UV's recording: after the keyboard closed the app sized itself 536 of 874 points tall, so the loading screen's blur, the page's background and the footer stopped where the keyboard's top was, with a line across the screen; UV: "the same on other pages"). `prefs.js` makes iOS measure the page again (hiding and showing it in one go) when a page opens or a field gives up the keyboard, only in the installed app on the dark theme's see-through bar. *Not checked on a phone:* headless Chrome cannot reproduce the bug; there the guard fires and says it did not help, which is all it can show.
*Decided by UV:* **fix what Claude saw in UV's other screenshots** (16 Nov). Claude's fixes, for UV to judge:
- the match page said "Someone else has scored" twice over the bottom player's name: once now, and a line with words on the stage's foot sits on its own solid pill;
- the red "league record could not be linked … FetchEvent.respondWith … Load failed": the service worker no longer handles the database's calls (or anything not a read, or from another site), and the link is tried once more after a dropped connection before the error shows;
- the scorecard's "8-Ball Mainstream · 2026-27 · Billiard Café" showed a stray mark for each "·" (the display face has none): drawn in the body face;
- the Season tab's calendar drew a night that had passed with matches unplayed (postponed) green, "Coming up": grey now, as anything over is. (11 Nov green in UV's screenshot was not a fault: the night's import had not yet run.)
*Touches:* `src/scripts/tdc.js`, `src/stylesheets/design.css`, `src/scripts/league-card.js`, `src/scripts/league-season.js`, `src/stylesheets/league.css`, `src/scripts/prefs.js`, `src/scripts/match.js`, `src/stylesheets/match.css`, `src/sw.js`, `src/scripts/nav.js`

## 2026-11-16 — The sponsor banner on the home page only; played nights in a grey pill, on both calendars
*Decided by UV:* **the partners and sponsors banner shows only on the home page** (`footer.html`, `page.url == "/"`); every other page's footer has none.
*Decided by UV:* **a played night sits in a grey filled pill** on the Season tab's Nights calendar, and **the Fixtures planner's calendar follows it**: the same night states as the Season tab (live yellow, the next glowing, played or past grey in the grey pill), for players and directors alike.
*Claude's, for UV to judge:* the pill's strength (the muted grey at 22%); in the director's planner the chosen night now also has the line round it, since the next night's glow is the same glow a chosen night had there; the rule for a night's state written a second time in `league-fixtures.js` rather than shared with `league-season.js`.
*Touches:* `src/_includes/footer.html`, `src/scripts/league-fixtures.js`, `src/stylesheets/league-join.css`

## 2026-11-16 — The scorecard banner's team names wrap between words and use the banner's width
*Decided by UV:* **the team names in the scorecard's banner (and its result panel) fill more of the banner's width**, and **may wrap onto more lines, never broken inside a word**, **keeping the sideways run for a word still too long after wrapping**; **the underline of your own team must not touch the line below**. *Replaces*, for `.cj-name` only, the same day's "Team names on one line, running sideways"; the session headings, the lineup head-to-head and the Season tab keep one line.
*How:* `TDC.runWords` (`tdc.js`, `.tdc-wrap` in `design.css`): each word a run of its own (the existing `fitRun`), lines breaking at spaces; each line keeps 0.25em of the underline's room so the next line clears it.
*Claude's, for UV to judge:* where the room came from: the head's 1.75rem side padding for the Share icon removed (the pictures alone moved in 0.875rem, where that padding put them, so they never meet the icon: at 420 without it the away picture came within 3px, and would touch on a narrower phone or with the banner open); the gap beside the middle 0.75rem → 0.5rem; the venue and discipline badges under the ":" 9rem → 6.5rem wide, a long venue wrapping. Measured 494px wide (the narrowest a headless window goes), each name's column went from 83px to 135px; 103px at 420. A short name is centred in its column, so it sits 14px outward of its picture's centre.
*Touches:* `src/scripts/tdc.js`, `src/scripts/league-card.js`, `src/stylesheets/design.css`, `src/stylesheets/league.css`

## 2026-11-16 — The scorecard's signatures: score above the signature lines; sessions folded but the active; head to head fitted
*Decided by UV:* the signatures section's head shows **the team names and badges only, no score**; **above the signatures, the team names, badges and final score**; **every session folded by default, a session with active frames open (the captains' view)**; **the head-to-head tables' text smaller so the whole table fits the screen's width**, no sideways scroll.
*Claude's, for UV to judge:* "active" read as a frame in Now and next (under way, or among the next up), so at the start of a night the first session is open; a session the reader opens or closes is kept so until it matches the usual again; the director's grid follows the captains'; the head to head scaled as a whole (CSS `zoom`: text, marks and pictures together), not the text alone, down to 55%, past which it scrolls again; the empty middle left in the section's head where the score was.
*Touches:* `src/leagues/card/index.html`, `src/scripts/league-card.js`

## 2026-11-16 — The scorecard banner's score once complete; venue badges yellow; the keyboard guard narrowed
*Decided by UV:* **once a match is complete, its score either side of the banner's ":"**; **venue badges with yellow words** (the banner's folded venue badge, the only venue badge on the site; `--color-warning`, so the light theme's dark red).
*Claude's, for UV to judge:* "complete" read as signed by both or published (the card's own states; a night played but not yet signed shows the ":" alone); the score in the result's colours and size (the winner green and lit, the loser grey). **Later the same day (UV: check the spacing between the score and the badges):** the score's figures fill their line, so between the state badge and the venue badge it looked jammed at the middle's 8px; it now has 8px more above and below (16px each side), only when it shares the middle (`.cj-mid > .cj-score:not(:only-child)`). Rendered headless at 420.
*A fault, not a decision:* UV saw the installed app refresh every few minutes while scrolling, on every page. Nothing in the code reloads a page by itself (the only `location.reload()` is the nav's reload button). The one thing on every page, only in the installed app, is the keyboard guard (`prefs.js`, earlier today), which hides and shows the whole page: that resets scrolled boxes and restarts animations, which looks like a refresh. It ran on every `focusout`; now only a typed field's, and never again on a page once it has not helped. **Not certain this is the cause** (iOS rarely focuses a tapped button); the other suspect is iOS reloading a page whose memory grew too large (the pool-table canvases). If it goes on, look at the app with Safari's Web Inspector on the Mac (a `[Viewport]` line in the console means the guard ran).
*Touches:* `src/leagues/card/index.html`, `src/scripts/league-card.js`, `src/stylesheets/league.css`, `src/scripts/prefs.js`, `docs/ui.md`

## 2026-11-16 — The pool tables stop when not seen or the app is not in focus
*Decided by UV:* **an animation stops whenever it is not in view or the app is not in focus.** Both pool tables (the banners and the home page's) pause off the screen, while the app is in the background or the phone locked, and while the window has lost focus (a computer with another window in front), and pick up where they were on return. The banner already stopped off the screen; the home page's table never stopped.
*How:* one check for every page, `TDCPrefs.awake` / `TDCPrefs.onAwake` (`prefs.js`), so any later animation uses the same.
*Claude's, for UV to judge:* a page that opens without focus (the address bar's) counts as focused until a blur says otherwise, so it never opens frozen.
*Touches:* `src/scripts/prefs.js`, `src/scripts/banner-table.js`, `src/scripts/hero.js`

## 2026-11-16 — A league's own table sets the order of each session's frames; 8-Ball Mainstream follows its paper scoresheet
*Decided by UV:* **8-Ball Mainstream's scorecards follow Billiard Café's paper scoresheet frame for frame**, so players can follow paper and digital and both line up; **other leagues keep the standard rotation**; **the order is set on the settings page, under My own table**; **no existing data and no existing match is changed: only unplayed matches take it.**
*The finding:* the sheet's pairings are our cyclic shift (session s: H*h* meets A*h+s−1*), but each session opens one home player later, so the paper's F6 (H2 v A3) was the card's F10. My own table could choose only the away player of each frame (a frame's home position was its place in the session), so the sheet's order could not be entered.
*So:* migration `20261116182736`: a row of the rotation table may be `[home, away]` pairs in the order the frames are played; a row of numbers means what it always did. My own table offers a home and an away menu per frame. Saving re-freezes only matches with no frames, no locked side and no card events, as before. **The order itself was set by Claude, as UV asked**, in migration `20261116185036`: the league's rotation, then the same re-freeze, guarded so that no played or started match can change. **UV, same day: nothing from before may be lost; the order on old cards may change, but never who played who.** Old cards were left exactly as they are.
*Example:* 8-Ball Mainstream's 28 Oct night (Break and Blaze v BSC Travelers, imported) keeps its numbering: its F6 is UV v Brad, the paper's F10, the same 25 results. Round 6's Cheeky Tiger v Break and Blaze (locked, 5 frames scored) keeps it too. Round 6's five unstarted nights and every later night take the sheet's order once it is saved.
*Claude's, for UV to judge:* the own table's columns carry no heading (each cell has its frame number); two menus a cell make the table scroll sideways inside its panel, at 1440 as well; a row whose home players are in order is stored as numbers.
*Touches:* `supabase/migrations/20261116182736_league_rotation_frame_order.sql`, `supabase/migrations/20261116185036_league_8ball_mainstream_scoresheet_order.sql`, `src/scripts/match-settings.js`, `src/scripts/league-rules.js`, `src/stylesheets/league.css`

## 2026-11-16 — The lineup page shows the night's numbering by position
*Decided by UV:* **under the two team tables, the night's frame numbering, so captains can choose players by their position on the scorecard**; drawn as **the grid of positions** (home positions across, away down, the frame where they meet), chosen over a copy of the paper's session columns and a list per position.
*So:* `renderOrder` in `league-card.js`, from the match's own frozen order, so it always matches the card that will be built. No database change.
*Claude's, for UV to judge:* the heading "The scorecard"; the line under it naming whose H and whose A; shown to everybody on the lineup page, not only captains.
*Touches:* `src/leagues/card/index.html`, `src/scripts/league-card.js`, `src/scripts/match-settings.js` (`rotationFrames` exported), `src/stylesheets/league.css`

## 2026-11-16 — Rings draw in for a tap, never for a page load
*Decided by UV:* **the rings stay for interactions, not page loads; site-wide** ("we now have the diver overlay"). Found while chasing a hang on 8-Ball Mainstream's Schedule tab: UV's console showed one script run of 12.4 s, the Fixtures tab's loading screen giving up at 20 s, and the live scores timing out. A director's Schedule draws every unsigned fixture with 2 to 4 ring buttons (about 330 for 132 fixtures), and each drew itself in: strokes added, the whole page's style read, two or three animations started.
*So:* every ring made as a page opens or redraws takes its icon as `initial` and shows it at once; `drawTo` / `drawIn` only after a person's own change. A control's icons (chevrons, the date's cross) show at once on their first look too. This replaces the 24 Oct rule that an icon drew in when it first appeared, and the per-field memory that kept a redrawn one from drawing in again (no longer needed).
*Example:* opening the Schedule tab, Start, Move and Remove are already drawn on every fixture; tapping a team's + on Standings still draws it into a −; opening the menu still turns its lines into the cross.
*Measured (Claude):* a stand-in page of 390 ring buttons, 130 rows at 420px with the real stylesheets: about 280 ms to wake them before, 5 ms after. **UV's Performance trace of the real tab afterwards** (the same day, with the rings already changed) put the larger cost elsewhere: 1.6 s in `getAnimations`, which `drawIcon` (`tdc-controls.js`) called on every stroke of every new control's icons to cancel any running draw, each call restyling the whole page (77 at ~19 ms). A control now keeps its own draws (`tdcDraws`) and cancels those, so nothing is asked of the browser, on a first look or a tap. The same trace: a 5.4 s load, longest task 134 ms, `tdc_league_fixtures` taking 1.8 s and four reads made one after another before it.
*Touches:* `src/scripts/ring-status.js` (comment), `league-fixtures.js`, `league-season.js`, `league-standings.js`, `league-standings-edit.js`, `league-card.js`, `nav.js`, `player.js`, `team-ask.js`, `tdc-controls.js`; `docs/ui.md`

## 2026-11-16 — Every page sends its reads at once; nothing waits on a read it does not need
*Decided by UV:* **every page and tab as fast loading as possible**, the loading overlay (the diver) and the dots on interactions staying exactly as they are, the pool tables left alone; Claude may add database functions that answer a page in one call where that saves a trip.
*So:* `TDC.readEarly` / `TDC.read` (`tdc.js`; `docs/systems/foundations.md`, "Reading fast"): a page starts every read that needs only what it already knows (the season, the match, the sign-in), and each loader takes its own in its old order. Done on the league Season, Fixtures / Schedule, Run it and Settings tabs, the card and the profile; the venue picker, the standings editor and the short-code field ask theirs together.
*Example:* the Season tab asked 30 things in 12 trips one after another (your leagues, then join info, then the season, then fixtures, then teams, …); now the first 15 go together and only the team rosters wait, for the team list: 3.9 → 1.9 s at phone speed.
*Measured (Claude):* headless at 420px, CPU 4× slower, +220 ms per trip, as a league director on a local copy of 8-Ball Mainstream; each page's text identical before and after.
*Found, not yet done:* `tdc_league_fixtures` took 1.8 s on production in UV's trace, about 20 ms on the local copy with the same data; the moving light restyles the whole page at each move (every raised card's shadow follows it), about 0.1 s a move on Schedule at phone speed: a decision for UV.
*Touches:* `src/scripts/tdc.js`, `league-season.js`, `league-fixtures.js`, `league-manage.js`, `league-settings.js`, `league-card.js`, `league-standings-edit.js`, `venue-picker.js`, `short-code-field.js`, `profile.js`; `docs/systems/foundations.md`

## 2026-11-16 — The light moves in whole pixels and holds while the page is in use
*Decided by UV:* **shadows move in whole-pixel steps, and the light holds while a finger is on the screen or the page is scrolling** (chosen over whole pixels alone, holding still on every page but home, and leaving it).
*Why:* every raised card's shadow follows the light (`--nm-x` / `--nm-y` from `--page-shadow-x` / `-y`), so each write restyles the whole page: ~0.1 s on Schedule and ~0.3 s on Run it at phone speed. Written to a tenth of a pixel, it wrote 17 to 33 times in 5 s; a tap landing in one waited.
*So:* `page-light.js` writes whole pixels, each value only when it changes (`--page-light-x` / `-y` on the match page too); it holds while any pointer is down and for 0.4 s after the last scroll or wheel, then drifts on from where it was.
*Measured (Claude):* 1 to 6 writes in 5 s instead of 17 to 33; work after the page appears Season 0.6–1.1 → 0.1 s, Run it 0.75 → 0.26 s, Schedule 0.75–1.0 → 0.1–0.2 s. The hold during a touch or scroll is not driven headless.
*Claude's, for UV to judge:* 0.4 s after a scroll before it moves again; a mouse button held on a computer counts as a finger.
*Touches:* `src/scripts/page-light.js`

## 2026-11-17 — The Season tab reads every roster in one call
*Decided by UV:* **one database call for every team's roster on the Season tab** (asked after the finding below).
*Why:* the tab read the team list, waited for it, then asked `tdc_team_roster` once per team (12 calls): a second trip on every load and every re-read after a save. Read-only on production the same day, every call costs about 0.2 s however little work it does (the trip to eu-west-1); `tdc_league_fixtures`, 1.8 s in UV's 16 Nov trace, does 40 ms of work and is 0.23 s typical, so it needed no change.
*So:* `tdc_league_season_rosters(season)` (`20261117041517`): `tdc_team_roster`'s select for the whole season plus `team_id`, the same order within a team, signed in only through the grant as before. The Season tab sends it with its first batch and splits the rows by team. `tdc_team_roster` stays for the card.
*Example:* opening 8-Ball Mainstream's Season tab as a league director at phone speed, locally: 1.95 s → 1.3–1.5 s to the diver lifting; the page's text, folded rosters included, identical.
*Touches:* `supabase/migrations/20261117041517_league_season_rosters.sql`, `supabase/tests/079_league_season_rosters.test.sql`, `src/scripts/league-season.js`; `docs/systems/foundations.md`, `docs/systems/leagues.md`

## 2026-11-17 — Head to head at full size with the players' column frozen; bigger L and W icons
*Decided by UV:* **the head-to-head tables' text back to its size before 16 Nov** (16 Nov's "text smaller so the whole table fits", above, is undone); **the players in the first column frozen** while the rest scrolls sideways; **those names in cream**; **bigger icons in the L and W switches**.
*So:* `fitHeadToHead` (CSS `zoom` down to 55%) removed; `th.h2h-when` and `th.h2h-row` are `position: sticky; left: 0` on `--bg-base`, the names `--text-primary`. The three-way switch's icon (used only by L and W) fills its knob: padding 15% → 0, about 40% larger.
*Claude's, for UV to judge:* the date in the corner frozen with the column; the icons' lines thinned (stroke 5 → 3.5) so the tick is no bolder than before, as the no-bold-icons rule asks; the cue ball's spots and outline keep their own widths, so they grow with it; no line or shadow marking the frozen column's edge.
*Touches:* `src/scripts/league-card.js`, `src/stylesheets/league.css`, `src/stylesheets/design.css`; `docs/systems/leagues.md`, `docs/ui.md`

## 2026-11-17 — The light steps by the screen's own pixels, not whole CSS pixels
*Decided by UV:* **the light less severe, site-wide: no big jumps, the amount it moves kept as it is.** This revises "The light moves in whole pixels…" (16 Nov); the hold while a finger is down or the page scrolls stays.
*Why:* every raised card's shadow follows the light, and with whole CSS pixels each step moved every shadow on the page by one at once: on a phone that is two or three of the screen's pixels, a jump that caught the eye.
*So:* `page-light.js` rounds to one screen pixel (`devicePixelRatio`), the smallest step a shadow can be drawn at, still writing only when a value changes. Its range, speed and timing are unchanged.
*Measured (Claude):* headless at an iPhone's density (3) on Home, Season, Run it and Schedule: about 16 writes in 5 s against about 11 with whole pixels (both vary a lot with where the light is in its move); the work after a page appears within the same run-to-run noise. Not seen on a phone.
*Touches:* `src/scripts/page-light.js`

## 2026-11-17 — Scorecard sessions as inset pills; Now and next under lines, frames sliding between groups
*Decided by UV:* **each session its own expanding inset pill**, covering the heading and the arrow and growing down to show the session; **Now and next without its rings, a line separating each group in the same colours** (yellow under way, grey next); **on a PC a session alone in its row centred**; **no date in the head-to-head tables' top-left cell**; **in Now and next only a frame that is complete fades out; a frame moving between groups slides from one spot to the other**.
*So:* `details.cs-session` carries the sunken shadow and grows with the existing fold; `.qv-line` heads each group; the last odd session spans the grid centred at a column's width; `syncQuick` fades the finished frames, then slides every other pill (and the list's height) to its new place, then fades the new ones in.
*Claude's, for UV to judge:* the line sits **above** each group, Now's glowing as its ring did; the pill's radius (round ends folded, the same corners open); the player's Your frames block a pill too; the pills that move only because others went also slide (rather than jump); the slide's 0.38 s; a new frame fades in only after the slide.
*Example:* Next holds F3–F6. F3's lag goes in: the yellow line fades in above F3, which becomes Now's frame, and F4–F6 slide down under the grey line. F3's result goes in: F3 fades out where it is, then F4 slides up into its place.
*Touches:* `src/scripts/league-card.js`, `src/stylesheets/league.css`, `src/leagues/card/index.html`; `docs/systems/leagues.md`, `docs/ui.md`

## 2026-11-17 — Now and next in three groups; the session's folded heading and glow; sessions by height on a PC; the signatures' header
*Decided by UV:* **three groups: Under way (lag in), a yellow line, Now (assumed playing), a line, Next**; Under way and Now together as many frames as tables (two tables: the first two frames are Now, the next two Next), **a lag on another frame moving the assumed one out of Now**; **a line between Now and next and the sessions**; **a folded session: the heading centred with its arrow, a second row Team | score : score | Team** in the session's own type; **a yellow inner glow on a session pill holding a frame under way or assumed**; **on a PC, with a session open beside a folded one, the other sessions stack in the second column beside the open one**; **the signatures' header: the league's shield, the league's name as is, the season cream, the venue a green link as in the banner, the date grey as is, the round green**.
*Claude's, for UV to judge:* the line between Now and Next grey (the colour of Now, the group above it), and no line when the group below it is absent; with no tables set, two tables assumed (half of the four shown); the separator under Now and next a hairline in the border colour, not a coloured line; on a PC each session goes into the shorter column, so the layout follows a fold as it opens (a closing session's neighbours move back only at the end); a lone last session centred only when both columns are level above it; "Round 6" as the round's words; the shield 4.5rem; Your frames keeps its own heading (its score, no teams).
*Example:* two tables, F1–F4 shown, no lags: Now F1, F2; Next F3, F4. F3's lag goes in: Under way F3, a yellow line, Now F1, a grey line, Next F2, F4; F3 glides up, F2 slides down into Next.
*Touches:* `src/scripts/league-card.js`, `src/stylesheets/league.css`, `src/leagues/card/index.html`; `docs/systems/leagues.md`

## 2026-11-17 — The frame's number beside the session in Now and next, gone from the sessions
*Decided by UV:* in Now and next the frame's number moves up beside the session ("Session 1 · F3"); in the sessions it is removed, so under a player only the position ("H1").
*So:* `playerCell` no longer adds the F; `quickPill`'s top line carries it. **Then (UV):** the position centred under the player's name: the name and the position share a box (`.cs-namebox`), the picture beside it, so on a computer the picture sits level with the pair **Then (UV): a name on two lines is centred on every screen** (on a phone only since 12 Nov): the scorecard's players (sessions, Now and next, Your frames) and, by the same rule, the head to head's player column (Claude's reading of "all screens"). Your frames (the player's own rows) unchanged: "Session 1 · F1" there already.
*Touches:* `src/scripts/league-card.js`; `docs/systems/leagues.md`

## 2026-11-17 — The light moves as smoothly as before 16 Nov
*Decided by UV:* **the light smooth enough not to be noticed, without going far; the cost can be afforded.** This revises "The light steps by the screen's own pixels…" (the same day), which stuttered, and the whole pixels of 16 Nov, which jumped.
*So:* `page-light.js` writes to a tenth of a pixel on its 66 ms timer, as it did before 16 Nov, which nobody saw stutter. Kept from 16 Nov: a value is written only when it changes, and the light holds while a finger is down and for 0.4 s after a scroll. The 3 Nov timer (battery) stays; Claude tried every frame and dropped it as more than was asked.
*Touches:* `src/scripts/page-light.js`

## 2026-11-17 — Discrepancies on the scorecard: the blue tick, the glow, one blue
*Decided by UV:* when somebody's lag or result entry is changed by somebody else (a captain or the opponent), it is a **discrepancy**. Undoing your own entry never is. The switch's knob sits on the new value and **a blue tick replaces the middle dot**: tap it to accept, and the card looks normal again; tap your own end to put your value back, and the other person then sees the tick. Captains can accept or change their players' entries the same way. **Who sees the tick:** the person overruled, their captain and the league director. **The glow:** Head to head and By session show a discrepancy's cells with a blue inner glow, **for everybody**. **A change to Nobody:** the tick sits on the middle knob; tap it to accept, tap your end to put it back. **One blue everywhere:** a change after signing is a discrepancy just like the others, so the old "changed after signing" blue (the switch's blue bar, the cells' glow from signatures) became this. **Signing is never held back** by a discrepancy: signing means the captain accepts the card as it stands and is aware of the changes. No special messages or text; no change to the changelog. **A lost frame is a grey cross** in the tables; unplayed stays "–".
*So:* migration `20261117054351`: `tdc_card_discrepancies` works them out from the edit log, signatures and acceptances; `tdc_accept_frame_change` and `tbl_frame_change_accept` hold an acceptance (no card version change, so no signature is lost); the merge carries the new table. The tick is `data-accept` on the three-way switch (`tdc-controls.js`), shared code. Details in `docs/systems/leagues.md`, "Discrepancies".
*Claude's, for UV to judge:* (1) **the rule's edges:** filling a value nobody had entered is not a discrepancy, but a change to a frame a captain signed empty is; changing something and changing it back clears it. (2) **A change after both captains signed** gives each captain their own tick; one captain's acceptance clears only theirs, and the LD's clears both. (3) **A derived lag** (the next frames' lag re-worked when one frame's lag is set) is nobody's entry; only a lag set by hand counts. (4) **An LD accepting** for somebody stands for that person's side if the LD's acceptance is later changed. (5) **Not live for others:** an acceptance shows on another person's page at their next read, since it does not move what the card listens to. (6) **The Head to head key** gained "lost the frame" with the cross. (7) **The points page** gained `me.overruled` and `me.accepted` (the rule of 6 Nov). (8) The tick's lines as thin as the knob's icons, in `--color-edited` with a soft glow. (9) **The league Rules tab** gained a clause, "Changed entries", under Scores and signing (the rule of 10 Nov: a new policy updates the Rules tabs).
*Touches:* `supabase/migrations/20261117054351_card_discrepancies.sql`, `supabase/tests/080_card_discrepancies.test.sql`, `src/scripts/league-card.js`, `src/scripts/tdc-controls.js`, `src/scripts/points-formula.js`, `src/scripts/league-rules.js`, `src/stylesheets/status.css`, `src/stylesheets/league.css`, `src/leagues/card/index.html`; `docs/systems/leagues.md`, `docs/systems/points.md`, `docs/ui.md`

## 2026-11-17 — The player profile: scores as "9 : 16", rows without a date, Compare without halves, the display font at 1.32
*Decided by UV:* (1) **the display font's spacing fixed wherever it is wrong**; (2) **the frame difference per night off the Profile tab, kept on Compare**; (3) **no win dot on a match row; a loss shows both numbers grey; ":" in place of the dash, evenly spaced**; (4) **Compare without the sunken halves, and a heading repeated on each side made one**; UV chose to keep each side's picture and name pinned at the top, without a pill; (5) **a match row shows vs Team, the league or tournament, the venue, each a line, and no date.**
*So:* every display-font rule in page flow that set its line height below 1.32, or left it unset, now says 1.32 (`docs/ui.md`, "The display font on iPhones"): the profile's name, stat numbers, team place and scores; the season and join pages' places, numbers and venue lines; the scorecard's banner score and ":", the signatures' Signed, the lineup page's names and numbers; the footer's headings, the points page's totals, the poster's scores. A score on the profile is drawn by one function (`scoreNode`).
*Claude's, for UV to judge:* (a) **Left at their own line height:** the match stage's text (sized by script to fit the screen), SVG text, the sandbox pages, the footer's measured name and Compare's heads (`text-box` trimmed). (b) **Every meeting** follows the row rule as Home v Away (team night) or vs Name (singles); meetings have no venue, so two lines. (c) **A draw** both cream. (d) **Last meeting's** heading keeps its date: it is a panel, not a row. (e) **Compare's width** fixed to the card's phone padding (below 36rem, not 24rem), which ran it past the card's edges at 384–576px once the halves were gone. (f) The home page's Matches card and the `/players/` feed keep their dates and dashes: not asked.
*Touches:* `src/scripts/player.js`, `src/players/index.html`, `src/stylesheets/player.css`, `league.css`, `league-join.css`, `footer.css`, `points-tuning.css`, `poster.css`; `docs/systems/players.md`, `docs/ui.md`

## 2026-11-17 — Discrepancies: corrections to the entry above
*Decided by UV:* **the card is live**, acceptances included (as 29 Oct, "The card follows its match live"); **lags are each league's setting, and a team night lags every frame** (`docs/design/leagues.md` §2), so nothing on a team card is worked out from earlier frames; **once both captains have signed, the night is locked** (25 Oct; players cannot reopen it, 23 Oct).
*So:* migration `20261117060737`: acceptances go out live and the card listens for them. Test `080` now plays a lag-every-frame league. In the entry above, Claude's points (2), (3) and (5) were wrong and are withdrawn: (2) described captains changing a frame after both signed, which cannot happen; only the league director can correct a locked card (29 Oct's example), and that is the only way two signatures are overruled at once; (3) came from the test helper's "take turns" breaks, not a league's lag-every-frame setting; the database's hand-set-lag check is harmless there and stays; (5) was a broken rule, now fixed. Claude also broke CLAUDE.md by building its own choices and listing them for UV to judge afterwards; points (1), (4), (6), (7), (8) and (9) in the entry above were built that way and are put to UV as questions. **UV's answers (17 Nov):** keep the Rules tab clause (9), the key's "lost the frame" (6) and the points data (7). **After the LD approves, nobody edits** (UV): the card greys every switch once signed by both or approved, the LD's included, so no discrepancy can come after it. (Found while checking: the database's lock guard, `private.tdc_frames_locked_guard`, still lets whoever runs the league write to a locked card; only the page stops it. Not changed.)
*Touches:* `supabase/migrations/20261117060737_card_discrepancies_live.sql`, `supabase/tests/080_card_discrepancies.test.sql`, `src/scripts/league-card.js`; `docs/systems/leagues.md`

## 2026-11-17 — A player enters their own frames in Now and next
*Decided by UV:* **in Now and next a player can enter their own frames**; anybody else's stay greyed. This reverses 12 Nov's "L and W disabled for anybody but a captain" (and the director) for a player's own frames.
*So:* `quickPill` uses `canRecord(f)`, the rule a session row and the database already use: a captain or the league director any frame, a player their own. No database change: `tdc_record_frame` already lets a player record their own frame, and Now and next's switches save as Your frames' do.
*Example:* Thabo plays F3, shown in Now: his L and W there are live. F4 and F5, which he is not in, are greyed for him.
*Touches:* `src/scripts/league-card.js`; `docs/systems/leagues.md`

## 2026-11-17 — The profile hero: the picture as tall as the names
*Decided by UV:* **the player's picture takes the same height as the display name and full name, all in a row; the full name aligned with the picture's foot, without the big gap between the two names.**
*So:* the names are trimmed to the display name's capitals and the full name's baseline, a small gap between them, and the picture is sized to their height by script (`sizePic`), capped at its half of the hero.
*Claude's, for UV to judge:* (a) the picture follows the names, so a one-word display name gives a small picture (about 58px at 420 wide) and a long one a large one; (b) the initials scale with the picture (a third of it); (c) on iOS before 18.2, which cannot trim text, the picture comes out as tall as the names with their line spacing.
*Touches:* `src/scripts/player.js`, `src/stylesheets/player.css`; `docs/systems/players.md`

## 2026-11-17 — A completed scorecard: plain session tables and Your Frames
*Decided by UV:* on a completed league card **every session is a plain table, always open, with no pill or fold**: a row per frame, *home player · mark · mark · away player*, the marks as in Head to head and By session **except that a lost frame has no cross** (the lag's ring stays; the other tables keep their crosses), **no line between the team names and the players**, no pictures, each name on one line and running sideways when too long. **Everybody sees them, players included.** A player on a completed card sees **only their own table, headed "Your Frames"**, not the Your frames block with the switches. **On the live card a player sees only the Your frames block, not the table.** Completed means **signed by both, or published** (a re-opened card is live); Your Frames sits **above** the session tables; each table's heading is **the session with its score** ("Session 1 3 : 1"); **the team names head the name columns** (UV's answers to Claude's four questions, the recommended option each time).
*Example:* after both captains sign, Thabo (a player) opens the card: "Your Frames" with his three frames, then Session 1 to 5 as tables, "Thabo Mokoena ● × Jan van der Merwe" on one line. During the night he sees only his frames with their L and W.
*Claude's, not asked:* positions (H1) and the Reserve badge left out of the rows, as UV's row named only the players and the marks; home names right-aligned against the marks and away ones left, so a row reads across the middle; the grid's note (strict order, empty seats) hidden on a completed card, having nothing left to enter.
*Touches:* `src/scripts/league-card.js`, `src/stylesheets/league.css`, `src/leagues/card/index.html`; `docs/systems/leagues.md`

## 2026-11-17 — Only a venue's owner or admin may choose it
*Decided by UV:* **everywhere on the site a venue is selected, only that venue's owner or admin may select it.** Players and other venues' owners may not. This **reverses 5 Nov's "whoever runs a competition may list any active venue as played at"**, and a tournament's belongs-to venue no longer takes staff, only owner or admin, as a league's. **Rick Schoenlank owns both Billiard Cafés.** **The profile's Credits section shows The Dive Club only**, through a per-venue "sells credits" setting: credits are a business operation, and no other club is to be shown in that part of the site yet.
*Example:* a league director at the Billiard Café could list The Dive Club as a played-at venue for one night. Now The Dive Club is not in their search, and the database refuses it ("Only an owner or admin of a venue can choose it."). Rick, as the cafés' owner, can list either café on his leagues.
*Claude's, not asked:* a venue already on a list stays (as a closed venue does), so an old season still saves and a new season's copy keeps it; once taken off, only its owner or admin can put it back. Anyone running the competition may still remove a pill. The staff pages (walk-in, credits, codes, verify, link) are left offering the venues where you are owner, admin or staff, because they choose where you work rather than what a venue is tied to (raised with UV). The field's words when you have no venue: "You don't own or run a venue".
*Rejected:* naming The Dive Club in the code for credits (UV chose the setting).
*So:* `docs/systems/foundations.md`, "Venues".
*Touches:* migration `20261117073856_venue_owners_choose.sql`, `supabase/tests/058_venues.test.sql`, `059_venues_shown.test.sql`, `src/scripts/venue-picker.js`, `src/scripts/profile.js`, the Venues hints on both create pages and both Settings includes

## 2026-11-17 — A venue's page restyled, and its Settings tab
*Decided by UV:* the venue page in the league pages' language: the banner holds every detail the venue has; **Open in Maps and Call are icons in the banner, WhatsApp and Email too**; Website, Instagram and Facebook are words in a **Links** cell; Leagues and tournaments look as on the other pages, **a tournament as a league's tile with a trophy where the shield is**; an **"Open now · until 02:00"** line worked out from the hours. **Who runs it:** the owner for everybody, signed out too; admins and staff only for somebody signed in. **A Settings tab at the top for the venue's owner or admin**: every detail, the picture and **the hours** (until now only typed in the dashboard, 5 Nov). **The name stays in migrations.** **The site owner may change any venue's details** (UV: the site owner is the admin@thediveclub.org account, The Dive Club's owner, not UV's personal account), **details only**: choosing a venue for a competition, staff rights on cards and credits stay with that venue's own owner or admin.
*This narrows* 5 Nov's "no exception for UV's account" and 17 Nov's "nobody can edit a venue with no owner" to everything but a venue's details, picture and hours.
*Example:* at 22:00 on a Friday The Dive Club's banner reads "Open now · until 02:00" with a green status strip; a stranger sees its owner under Who runs it, a signed-in player the owner and both staff. admin@thediveclub.org opens Billiard Café (Rivonia), taps Settings and fixes its phone number; it still cannot list Rivonia as played at for a league.
*Claude's, not asked (forced by the layout or left open):* (1) the four icons sit in a row under the names rather than in the banner's top-right corner: four in the corner took the name's first line on a phone and split "The Dive Club" inside a word; (2) the Settings tab follows the league's two pills (Venue in the first, Settings in a second under it), and nobody else sees a bar; (3) the status strip green when open and grey when closed, green with no hours; (4) Tables one cell, the number with the note under it; (5) the email runs sideways rather than wrap inside the address, each link kept whole; (6) the hours in a sunken box, today in green; (7) a tournament's strip green open, yellow running, grey otherwise, as the home page's; (8) the tiles' names run sideways with the site's shared helper rather than the Leagues page's own drift; (9) the details grid two across on a phone and four on a computer, as the scorecard's banner; (10) the hours editor: a row a day with "Open this day" / "Add a time" and a ✕ per time, empty boxes rather than a guessed time; (11) a picture saved while the form holds unsaved changes leaves those changes in the form; (12) "Who runs it" as on the Season tab, "Nobody is listed yet." with none; (13) the venue's timezone sent by `tdc_venue` so Open now reads the club's clock, not the visitor's.
*So:* `docs/systems/foundations.md`, "Venues" and "A venue's page and its Settings tab".
*Touches:* migration `20261117074926_venue_page_edit.sql`, `supabase/tests/081_venue_edit.test.sql` (new), `src/venues/index.html`, `src/scripts/venue.js`, `src/scripts/venue-settings.js` (new), `src/stylesheets/venue.css`, `src/scripts/ring-status.js` (phone and chat icons)

## 2026-11-17 — A venue's picture stands plain
*Decided by UV:* **a venue's picture has no frame and no inset**: not the shadow round a chosen picture, nor the sunken layer over it (design.css, "Pictures set into the page", 9 Nov), in the banner and on the Settings tab.
*Also fixed (Claude's mistake, not a decision):* the venue page shrank every svg inside a tile's picture box to fit the tournament trophy, which shrank the shading layers of a league's shield too and threw its shadow off; the rule now reaches the bare trophy only.
*Touches:* `src/stylesheets/venue.css`; `docs/systems/foundations.md`

## 2026-11-17 — A venue's picture shown in full
*Decided by UV:* **a venue's picture shows in full**: not cropped to a circle in the banner, and not cut to the middle square on upload.
*So:* `TDC.preparePicture` takes `{ whole: true }`, which keeps the whole picture with its longer side shrunk to 512px (never enlarged); the venue's Settings uses it, and profiles, leagues and teams still get the middle square. The banner and the Settings preview fit the picture inside their box (`object-fit: contain`) with no circle. A picture uploaded before this was already square, so it stays square.
*Example:* a 1697 × 1113 logo is saved as 512 × 336 and shown whole beside the venue's name.
*Touches:* `src/scripts/tdc.js`, `src/scripts/venue-settings.js`, `src/stylesheets/venue.css`, `src/venues/index.html`; `docs/systems/foundations.md`

## 2026-11-17 — Affiliate Clubs: every venue, listed
*Decided by UV:* a page listing every venue, **"Affiliate Clubs" in the menu** (after Leagues), in the site's styling and listed as leagues and tournaments are, **with wider cards to show details**, the picture with no frame. **Each card:** the picture (whole), name, area and city, address, Open now (the strip green open, grey closed), a pill of the tables, their note and the phone, and badges counting the leagues and tournaments listed there. **A search box** over name, area and city.
*Example:* typing "rivon" leaves Billiard Café (Rivonia): "Open now · until 23:00", a "1 league" badge, the pill "24 tables · 20 x 8ft, 4 x 9ft · 011 555 1111"; tapping it opens its venue page.
*Claude's, not asked:* the page's heading is "Affiliate Clubs" too, matching the menu (the venue's own page keeps its name); the list lives at `/venues/` with no venue named, which said "Nothing here" until now; alphabetical; a count of 0 shows no badge; the search filters in the browser with no call; the pill runs sideways when it does not fit, with the site's shared helper.
*So:* migration `20261117082425_venues_list.sql`: `tdc_venues` also sends address, table note, phone, timezone, hours and the two counts, counted by `tdc_venue_competitions` so the card and the venue's page agree. `docs/systems/foundations.md`, "Affiliate Clubs".
*Touches:* `supabase/migrations/20261117082425_venues_list.sql`, `supabase/tests/082_venues_list.test.sql` (new), `src/_data/navLinks.json`, `src/venues/index.html`, `src/scripts/venue.js`, `src/stylesheets/venue.css`

## 2026-11-17 — A venue's website and socials as icons
*Decided by UV:* **the website, Instagram and Facebook links show as icons, not words.** This replaces this morning's "Website and socials as words in a Links cell" (chosen because the site's icon set had no such marks).
*So:* three line icons in the ring set (`globe`, `instagram`, `facebook`, `ring-status.js`), drawn as rings' from the footer's marks, in the Links cell as the banner's other icons; each opens its link in a new tab, its name as its label.
*Claude's, not asked:* they stay in the Links cell rather than joining Maps, Call, WhatsApp and Email under the name, so the row there stays the ways to reach the club; a globe for the website.
*Touches:* `src/scripts/ring-status.js`, `src/scripts/venue.js`, `src/stylesheets/venue.css`; `docs/systems/foundations.md`

## 2026-11-17 — No names screen after signing in
*Decided by UV:* **remove the prompt after signing in that asks for a first name and surname.** This reverses 10 Nov's "asked again at each sign-in until both are in". The sign-up form's optional name boxes stay.
*So:* `/accounts/names/` and `account-names.js` deleted; `auth.js` goes straight to the next page after any sign-in. A player with a name missing (a Google sign-up, or the form's boxes left blank) adds it on their profile; without both they have no short link, as before.
*Touches:* `src/scripts/auth.js`; deleted `src/accounts/names/index.html`, `src/scripts/account-names.js`; `docs/systems/foundations.md`, `docs/systems/file-map.md`

## 2026-11-17 — All fixtures: each round a folding pill, and the Fixtures tab's heading
*Decided by UV:* on the Fixtures tab's **All fixtures**, **each round's pill folds**, **its heading (the round and its date) inside the pill**, the pill growing down round the fixtures when opened; **all folded by default**; **a button beside the filters expands or collapses them all**. **The tab's heading:** the league's name smaller, the season's name under it in cream in the normal (body) face, the venue as the link it was.
*So:* each round is a folding group (`details.set-group.fx-round`) whose sunken pill is the round itself, opened by the site's fold, as the scorecard's sessions are. The button is + while any round is folded and – once all are open, the plus and minus rings Standings uses to open a team. The heading follows the scorecard signatures' header: the league in the display face at 1.35rem, the season in the body face, both cream.
*Example:* 8-Ball Mainstream's All fixtures opens as six folded pills, "ROUND 1 · 04/11/26 · 19:30" and so on; + opens all six and turns to –; folding Round 1 by hand turns it back to +.
*Claude's, not asked:* a round the reader opened stays open through a filter change, for that visit only; the button at the end of the filters row; the league at 1.35rem.
*Later the same day, UV:* **each round's heading in its status colour**, and **wherever a round is incomplete it is active, so yellow**: some nights were played but their scores are missing, and those stay active. *So:* all finished, green; a round being played, partly finished, or whose night is today or past without every fixture finished, yellow; a round still ahead, cream if a fixture is open for lineups, else grey. *Claude's, not asked:* "incomplete" read as a round part finished or whose night has come; a round ahead keeps cream or grey.
*Touches:* `src/scripts/league-fixtures.js`, `src/_includes/league/fixtures.html`, `src/stylesheets/league.css`; `docs/systems/leagues.md`

## 2026-11-17 — Every link underlined
*Decided by UV:* **enforce, site-wide, all links underlined.**
*So:* the base `a` rule in `global.css` underlines every link, a thin line 0.25em below the letters in the link's own colour (as the footer's links). Links drawn as something else (buttons, cards and tiles, icons, logos, menu rows) carry none, because their shape already says they can be tapped; the kinds that never set that themselves are listed beside the rule. The footer's own underline is unchanged.
*Example:* the venue link under a league's heading, "Sign in to start a new match." on the home page and the Rules tab's document link are underlined now; the menu's rows, the leagues' cards and "Create a League" are not.
*Claude's, not asked:* the thickness and gap (1px, 0.25em); which kinds count as controls rather than links.
*Touches:* `src/stylesheets/global.css`; `docs/ui.md`

## 2026-11-17 — The Standings tab as one board
*Decided by UV:* the Standings tab redesigned. **Row 1:** League Name | Season | Venue on one line, short vertical separators (not full height), running sideways where they don't fit. **Row 2:** Live and Full names as switches with no explanation, and (asked) the Individual / Team pill in the same row. **The table** as it is, with no side padding. **The key** in a full-width row under it, and (asked) it says only "Ranked by …": the "Counted from n signed nights" line goes. The top two rows read as part of the table; they and the heading row stay on the screen with the key at the bottom. Compact, neat; colours from the other league tabs.
*So:* the tab is one column at most a screen tall in which only the table's box scrolls; rows 1 and 2 above it and the key below never move, sideways either. The line runs as a long team name does (`TDC.runName`). The league in the display face, the season cream, the venue its green link, as the Fixtures heading.
*Example:* on a phone, "8-BALL MAINSTREAM | 2026 S1 | Billiard Café (Rivonia)" runs sideways and back; under it Individual · Team at the left, Live ◯ and Full names ◯ at the right; then the table to the card's edges; "Ranked by Frames Won, then Frames Lost (lowest first)." at the foot. Scrolling the table down or across leaves those three rows and the key where they are.
*Claude's, for UV to judge:* the pill's words shortened to **Individual · Team** (the full words and two switches don't fit a phone's row); the switches smaller than elsewhere (3rem by 1.75rem), the pill 2rem tall; the league at 1.15rem, the season and venue 0.9rem; the board ending at the card's edges rather than the screen's ("nothing outside its card", 10 Nov); a hairline above the key; signed out, the season's name read from the Season tab's public read.
*Touches:* `src/_includes/league/standings.html`, `src/scripts/league-standings.js`, `src/stylesheets/league.css`; `docs/systems/leagues.md`

## 2026-11-17 — Banner headings and team names at 1.15rem
*Decided by UV:* **in the banners, site-wide, a smaller size for the main headings, matching the Standings tab's top line** (1.15rem); then **the same for team names, smaller than they are now**, every team name site-wide.
*So:* every banner's main heading is 1.15rem (the Season tab, a venue's page, the poster all share `.lj-names h1`; it was `clamp(1.5rem, 7vw, 2.5rem)`). Every team name drawn larger than that is brought to 1.15rem: the scorecard banner and result panel (1.35rem on a computer), the Season tab's team cards (1.35rem on a computer), My Season's own team (1.5rem).
*Example:* the Season tab's "8-BALL MAINSTREAM" is 18px tall on every screen, where it was 29–40px; "CHEEKY TIGER" on a scorecard banner on a computer is 18px, where it was 22px.
*Claude's, for UV to judge:* a name already under 1.15rem is kept, not raised to it ("smaller than they are now"): the scorecard banner's names and the team cards at 1.1rem on a phone, the players' fixtures at 1.05 / 0.95rem, and every team name in body text (fixture tables, sessions, standings, the lineup page, the profile) at about 1rem.
*Touches:* `src/stylesheets/league-join.css`, `src/stylesheets/league.css`; `docs/ui.md`

## 2026-11-17 — The tables' physics retuned

*Decided by UV:* from the physics sliders put back on `/sandbox/banner/` the same day: **cloth speed 2, cloth spin 45, ball–ball 0.35, swerve 0.1**, the rest unchanged (cushion speed 0.25, cushion spin 0.9, side off cushions 0.35, side fades 0.03). **Everywhere:** every banner and the home page's table alike.
*Example:* a ball now rolls more than twice as far on the same pace (the cloth takes 2 a second from its speed, not 4.5), and an object ball leaves a contact with about two thirds of what a full hit gave it before.
*So:* `scripts/banner-table.js` and `scripts/hero.js`, `P`; `docs/systems/file-map.md`; STATUS §1 4ci.

## 2026-11-17 — Doubles in the pool tables' shot planner

*Decided by UV:* the planner tries doubles (a pot off one cushion), and **they compete with hard direct cuts** rather than only being tried when no pot works. Every banner and the home page's table.
*Example:* with only a 70° cut on, a straight double usually wins; with a 20° cut on, the cut does.
*Claude's, for UV to judge:* a double weighted at 0.35 of a direct pot of the same cut and length (`BANK_WEIGHT`); the cushion point aimed allowing for the cushion's loss (1 − ks); swerve fading in proportion to the speed below 2 balls a second (`SWERVE_FADE`), from UV's reading of the sticking glitch, which it did not cure (STATUS §3).
*So:* `scripts/banner-table.js` and `scripts/hero.js` (`doublesOn`, `paceFor`, `startPlanning`, the shot readout); STATUS §1 4ci and §3.

## 2026-11-17 — Two-cushion doubles by parallel shift

*Decided by UV:* the planner also tries doubles off two cushions, aimed by parallel shift. Every banner and the home page's table.
*Example:* a ball 3 off the side cushion and 4 off the end, a pocket 18 off the side and 2 off the end: the ball is sent about 3 along for each 1 across, and comes back off the second cushion on a parallel line into the pocket.
*Claude's, for UV to judge:* only the two cushions meeting at a corner (where the parallel shift holds whatever the cushion loss); weighted 0.2 of a direct pot (`BANK2_WEIGHT`), below one cushion's 0.35, so they come up rarely (1 in 59 shots in a test).
*So:* `scripts/banner-table.js` and `scripts/hero.js` (`doubles2On`); `docs/systems/file-map.md`; STATUS §1 4ci.

## 2026-11-17 — The pool tables strike up to 120 balls a second

*Decided by UV:* the cap on a shot's strength raised (from 48), as balls fell short of the pockets on large screens and on doubles; UV first asked for no cap, then a higher one.
*Claude's, for UV to judge:* 120 balls a second, the most at which the physics step (1/480 s) moves a ball no more than a quarter of a ball; past that a ball would sink into another before the contact is seen and leave at a wrong angle.
*So:* `PMAX` in `scripts/banner-table.js` and `scripts/hero.js`; STATUS §1 4ci.

## 2026-11-17 — The Season tab's team names smaller

*Decided by UV:* the team names on the Season tab's team cards smaller.
*Claude's, for UV to judge:* 1rem on a computer (was 1.15rem), 0.95rem on a phone (was 1.1rem); other team names untouched.
*So:* `.lj-teams .team-box-name` in `league-join.css`; `docs/ui.md`.

## 2026-11-17 — Pull down at the top to reload, on every page

*Decided by UV:* a pull down from the top of a page reloads it, as in a phone's browser. **Everywhere**: the browser's own pull is switched off and the site's is used on every phone, browser and installed app alike. **What shows is the site's dots, playing the waiting moves one after another, round and round.** **Every page, a universal function** (UV chose this over leaving out the match page, the draw and the owner board).
*Example:* on the install page at the top, a finger drags down: the page moves down with it and the dots open out, in the space above it, on a ring that grows as the finger goes on; past the reach, letting go reloads the page (a new version looked for first, as the menu's Reload does) and the dots carry on until it goes; let go short and they gather into the ring's middle and vanish.
*Claude's, for UV to judge:* the dots on a 48px ring with a 3px line, in the site green (UV, the same day; first cream, the Reload button's colour); 80px of pull to reload, at most 128, the pull stiffening towards it; each move 3 s, solo moves then group moves, where the list got to kept in this browser so each pull carries on from the last; the page (its content and footer) moves down with the finger and the dots play in the space opened above it (UV, the same day: "pulled down to reveal the dots animation in its own space rather than above the existing content"); the bar, the light and the loading screen stay put, and anything fixed inside the content moves with it while pulled. To stay universal without breaking the pages that already use the finger, a pull only starts where nothing else could take it: the page and every box the finger is in that scrolls at its top, nothing under the finger with a `touch-action` that stops the page panning up and down (the draw, the board's drags, sliders), no typing field or dropdown, one finger, not zoomed in, and mostly downwards. `data-pull="off"` turns it off for anything else. Touch only: a mouse has the browser's own reload. The update-then-reload steps moved from `nav.js` into `TDC.freshReload` so the button and the pull share them.
*So:* `scripts/pull-refresh.js`, `stylesheets/pull-refresh.css` (both in `layout.html`), `--pull-*` in `variables.css`, `overscroll-behavior-y: none` on `html, body` in `global.css`, `TDC.freshReload` in `tdc.js`; `docs/ui.md`; `docs/systems/file-map.md`; STATUS §1 4cj.

## 2026-11-18 — A league opens on Standings, first in the pill; the league's picture on the Standings line

*Decided by UV:* a league season's page opens on the Standings tab, and the first pill reads Standings, Fixtures, Season, Rules (was Season, Fixtures, Standings, Rules). The league's picture before its name on the Standings tab's line.
*Claude's, for UV to judge:* an address with `&team=` and no `&tab=` (a team's link, from Fixtures or a player's profile) still opens Season with that team open; moving to another tab drops `&team=` from the address so a reload opens the tab shown. The picture is the league's shield (or the empty one) at the line's height, 1.5em, scrolling with the line when it is too long.
*So:* `TABS` and `DEFAULT_TAB` in `league-nav.js`; `drawLine()` and `leaguePicture` in `league-standings.js`, `.sd-l-pic` in `league.css`; `docs/systems/leagues.md`; STATUS §1 4ck.

## 2026-11-18 — The home page's live match card

*Decided by UV:* when someone is signed in (on any device, the installed app included) and a match of theirs is **waiting for lineups or under way**, the home page shows a card **where the Get the app card sits, in the same glass with a yellow glow inside**, naming the **other team or player**; a tap opens **the scorecard**. UV took each of Claude's suggestions: **a singles match only once it is being played** (it has no lineups); **the match card takes the spot and Get the app is hidden while it shows**; **two at once, one card each, stacked, playing first**; the card says **Lineups, or Playing with the frames so far, and the league or tournament**.
*Claude's, for UV to judge:* "your team's night" is any match of a team you are an active player in, from the moment the director creates it until it is finished or abandoned, so a night created and never played keeps its card; the league director, playing for neither team, gets none; at most three cards; when two are too tall even on one line each (a phone on its side), they sit side by side.
*How:* `tdc_home_cards` gains `live` (migration `20261118062033`, the 16 Nov function's text with `live` added), read from the team entrants rather than `tdc_my_matches`, which finds a team night through your frames and so misses one still at lineups. `docs/systems/file-map.md`, "The home page's live match card"; STATUS §1 4cl.

## 2026-11-18 — The live match card: a ✕, and on every tab of a league's page

*Decided by UV:* **an ✕ on the live match card**; the card is shown again **on every reload until the match is complete**. **The same card on the league page**, so a player following the league's short link sees it, **on every tab**. UV took both of Claude's suggestions: **that league's nights only** on its page, and **under the pill**, before the tab's content.
*Claude's, for UV to judge:* on the home page, closing every live card brings Get the app back if it had been showing; the ✕ reads "Hide this until the page is reloaded" to a screen reader.
*How:* `public.tdc_my_live_matches` (migration `20261118073452`), which `tdc_home_cards` now calls, so which matches are live is decided in one place; the card's drawing and styles shared (`live-match.js`, `live-match.css`). `docs/systems/file-map.md`, "The home page's live match card"; STATUS §1 4cl.

## 2026-11-18 — The lineup page reordered and marked for the captain; league banners and the planner's calendar folded

*Decided by UV:* on the lineup page **the team tables come first, your own team at the top, then the other team, then This season** (then the scorecard grid as before), so the lineup is the first thing under the banner. **The table a captain sets up must be more obvious than a player's read-only one, with contrast and words**, since a captain may never see both. **Every league banner starts folded.** **The Fixtures planner's calendar folds, closed by default.** A **bottom nav bar** for the league's tabs is to be planned first, not built.
*Claude's (UV asked for "colour, badge, etc." and left the pick open):* the table being set up gets the banner's green line just inside its edge and a green inner glow, and a green line of words at its top, "Your lineup · set it here" for a captain, "You are setting this lineup" for the league director on the side they chose; "your own team" is the side being set up, else the reader's team, else home, at every width (on a PC, the left of the two); folded, the Season tab's banner shows the picture, the name, the season and the corner icons only, its details, badges and status strip under the arrow, as the card's.
*How:* `teamTable` and `renderLineups` in `league-card.js`, `#lineups`' order in `leagues/card/index.html`, `.lu-team.is-managing` and `.lu-yours` in `league.css`; the card's `#jumbo-more` without `open` and the page no longer setting it; the Season tab's facts in `details#jumbo-more.cj-more` (`.cj-more` rules now `.jumbo`'s); `#cal-group` in `_includes/league/fixtures.html`, re-centred on the chosen month when opened. `docs/systems/leagues.md`; STATUS §1 4cm.

## 2026-11-18 — The planner's Dates and Calendar tabs

*Decided by UV:* on the Fixtures tab's Planner, **the calendar fold becomes a pill with Dates and Calendar as tabs, Dates chosen by default**. **Dates is a sideways pill selector of every night, in short format**; **Calendar is as it was**. Styled by the site's colour rules. The reason: **the top of every page compact, so the actual content shows as soon as possible.**
*Claude's (not asked):* the short format is the page's existing `shortDate` (18/11/26); each date takes its night's state colour, as the calendar's days do; the choice of tab is not remembered between visits; the undated-round chips stay under both tabs.
*Then (UV, same day):* **the Fixtures tab's heading as the Standings tab's**: the league's shield, the league · season · venue on one line, the Planner · All fixtures pill compact under it. *Then:* **that pill and the Dates · Calendar pill centred, on mobile and desktop** (Standings' own row 2 stays at the left).
*How:* `#cal-views` and `#dates` in `_includes/league/fixtures.html`; `renderDates`, `showCalView` and `centreIn` in `league-fixtures.js`; `.fx-cal-views`, `.fx-dates` in `league.css`. The heading line moved from `league-standings.js` into `TDC.leagueLine` (`tdc.js`), which both tabs call; Fixtures' row 2 is `.sd-controls.fx-controls`. `docs/systems/leagues.md`; STATUS §1 4co.

## 2026-11-18 — The league tabs' bottom bar

*Decided by UV (took each of Claude's suggestions):* on a phone (below 48rem) **Standings, Fixtures, Season and Rules sit in a bar fixed to the foot of the screen**, Run it, Schedule and Settings staying a pill at the top; a computer keeps the top pill. **An icon with a small word under it.** Icons: **Standings a podium, Fixtures the calendar, Season the league's shield, Rules a document.** **It slides away with the site's bar on a long scroll down and back on scroll up.** **The scorecard page has it too** (its tabs are links back to the league).
*Claude's:* the bar stands over the page as the footer does (solid `--bg-base`, the footer's upward shadow), holding the same sunken pill and sliding thumb as the top pill, 3.75rem tall plus the home bar; the tab showing in the site's green and lit, the others cream; on the scorecard no tab is marked, as in its top pill.
*How:* `bottomBar` in `league-nav.js` (the body's own child, so the card cannot clip it; the same items, clicks and `mark()`), `podium`, `shield` and `document` in `ring-status.js`, `.league-tabbar` in `league.css`, `--tabbar-height` and `--tabbar-total` in `variables.css`. `docs/ui.md`; STATUS §1 4co.

## 2026-11-18 — The live match card above the league page's card

*Decided by UV:* on a league season's page **the live match cards sit above the page's content card**, no longer under the pill inside it (replacing "under the pill" of the earlier entry today); **the site's card shadow** on the live match card wherever it shows.
*Claude's:* the box keeps the content card's width at every size; on every tab as before.
*How:* `#league-live` moved before `.tdc-card` in `leagues/season/index.html`; `.league-live` in `live-match.css` copies `.tdc-card.wide`'s widths, and hides when `hidden` (`.live-cards`' flex otherwise beat it); `.live-card`'s shadow `--nm-card` in place of the switched-off `--shadow-panel`. `docs/systems/file-map.md`.

## 2026-11-18 — The bottom bar: a raised, solid pill alone

*Decided by UV:* the bottom bar's pill is **raised, not sunken**, with **a solid background**, and **the bar behind it is gone** (no background, no shadow): only the pill and its shadow show. Replaces Claude's first look in "The league tabs' bottom bar" above. *How:* `.league-tabbar` in `league.css` (see-through, taps passing through round the pill); `docs/ui.md`; STATUS §1 4co.

## 2026-11-18 — The league director's pages in the bottom bar

*Decided by UV:* where the bottom bar shows (a phone), **the league director's tab selector joins it**: **a new icon** that opens **a menu rising above it** with the pages they can go to. *Claude's:* the button is called **Manage** with a **sliders** icon (three upright lines with a knob each), last in the bar; the menu holds Run it, Schedule, Settings and New season as rows in a raised, solid panel at the bar's right end, the page open green and lit; Manage is marked while one of them is open; the menu shuts on a choice, a tap elsewhere, Escape or a scroll; the top admin pill is hidden on a phone. *How:* `bottomBar`, `setMenu` and `mark()` in `league-nav.js`, `sliders` in `ring-status.js`, `.league-tabmenu` and `body.has-league-tabmenu` in `league.css`. `docs/ui.md`; STATUS §1 4co.

## 2026-11-18 — The bottom bar's match pill

*Decided by UV:* wherever the bottom bar shows and **one of your matches is live (the yellow card shows)**, a quick link to it joins the bar, **not among the tabs but as a pill attached to the bar**. UV chose: **on the bar's top edge, centred**; its icon **follows the state**, the fixtures' yellow clipboard while lineups are open and the yellow play once being played; **it stays when the card's ✕ is pressed**; **with two or more live, a tap opens a small menu**, a row per match.
*Claude's:* the pill is shaped as a tab on a folder (round on top, flat where it meets the bar), solid and raised with the yellow inner glow of a session under way; with several, its icon is the first match's (the database's order, playing first); each menu row reads "v <other side>" over what is waiting ("Lineups", "Playing · 3–2") in yellow.
*How:* `live()` and `drawLive()` in `league-nav.js`, fed by `live-match.js` from its one read (`tdc_my_live_matches`), which now also gives `href` and `waiting`; the two menus share `setMenu`; `.league-livepill` and `.league-livemenu` in `league.css`. `docs/ui.md`; STATUS §1 4co.

## 2026-11-18 — The bottom bar: the match pill as a name strip, Manage grey, a green line round the tabs

*Decided by UV:* the match pill shows **the other side's name in words alone, no icon**, yellow and lit as the icon was; it is **as wide as the bar's pill and only as tall as its line of words**; it is **never cut off**: a whole pill whose lower part lies behind the bar's pill, and **the bar's shadow does not fall on it**. **Manage's icon and word are grey.** The bar's pill has **a green inner line, round the four tabs only** (Manage outside it). UV chose **"2 matches"** as the pill's words with more than one live, and **Manage green while one of its pages is open**.
*Claude's:* the pill lies in front of the bar's shadow and is clipped exactly at the bar's top edge, so it still looks tucked behind; the line is the banner's (2px, its own small shadows), and the pill's padding went from 4px to 8px to give the line room outside the thumb, the bar 3.75rem → 4rem to keep the words clear of it.
*How:* `drawLive` in `league-nav.js` (words, not an icon; `has-admin` on the track), `.league-livepill`, `.league-livepill-text`, `.league-tab-admin` and the track's `::after` in `league.css`, `--livepill-height` and `--livepill-tuck` in `variables.css`. `docs/ui.md`; STATUS §1 4co.

## 2026-11-18 — The match pill as a card behind the bar

*Decided by UV:* the match pill **grows down so its foot is level with the bar's foot**, reading as **a card behind the nav bar**, which **can be tapped only above the bar**. Replaces the clipped strip of the entry above. *How (Claude's):* the bar's pill's raised shadow moved to `.league-tabbar::before` at the pill's place, so the layers run shadow, match card, pill, and the bar's shadow still never falls on the card; the card is `--livepill-height` + `--tabbar-height` tall (`--livepill-tuck` gone). `docs/ui.md`; STATUS §1 4co.

## 2026-11-18 — The match card behind the bar in glass

*Decided by UV:* the match card behind the bottom bar is **glass, with a blur**. *How (Claude's):* the yellow live card's own glass (`live-match.css` `.live-card`: 35% of the page's colour, a 12px blur with 140% saturation, a fine border, its top highlight and yellow inner glow); since it is see-through, the bar's shadow layer is clipped at the bar's top edge while the card is there, or it would show through the strip. `docs/ui.md`.

## 2026-11-18 — The match card's state before the name

*Decided by UV:* the match card behind the bottom bar says **its state before the other side's name**, "Playing: Cheeky Tiger". *Claude's:* "Lineups:" while lineups are open, "Playing:" once it is being played (the yellow live card's words); the state in the regular weight, the name bold; with two or more still "2 matches". `drawLive` in `league-nav.js`, `.league-livepill-state` in `league.css`.

## 2026-11-18 — No "here tonight": captains set positions only, everybody else is a reserve

*Decided by UV:* captains no longer say which players are here on a night. **Every active player is taken to be available every night and can be picked as a reserve.** On a league night a captain only sets the order of their lineup; everybody else on the team is a reserve and can come into a frame at any moment. The lineup page loses the Here switch and shows only the position steppers. **The profile menu shows a team night to every active player on both teams from the start** (UV chose this over leaving it to captains and the lineup). **Away stays as it is** (UV): an away player cannot be given a position or come in as a reserve, and does not count towards the team's limit.
*Replaces:* the "here tonight" switch of 29 Oct and the squad as "who is available tonight" (22 Oct).
*Claude's:* the database keeps `tbl_league_match_squad` and `tdc_submit_lineup` unchanged; the page sends the players given a position as the squad, so the squad now means "in the lineup, or came in as a reserve". Reserves already followed the new rule (any active team-mate not in the order). The first free position that switching a player on used to give went with the switch; a captain steps each player from empty. The profile page (`tdc_player_profile`) still lists a night once the player is in the lineup, as UV set on 5 Nov.
*How:* `league-card.js` (`lineupShown`, `lineupToSend`, `teamTable`), `league-rules.js` (Naming a lineup, Reserves), migration `20261118110234` (`tdc_my_active`: every active entrant of either team, not only the captain). `docs/systems/leagues.md`; STATUS §1 4cp.

## 2026-11-18 — The lineup filled in from the standings, as an ordered list with arrows and drag

*Decided by UV:* the lineup a captain sets **starts filled in**, so they can accept it and start playing. **Strength is the league ranking** as the league's own rules set it (UV first proposed a formula, FW / FP², and dropped it after Claude showed it ranks the player with fewest frames highest). Using the match's scorecard, **the strongest player goes in the last frame of the last session** (the decider), the second strongest in the frame before, and so on. In the table: **the rank column moves between the player's name and the first stat column, and the position pill becomes the first column**; the pill's **left button is an up arrow and its right a down arrow**, each moving the player up or down the order. **Players can be dragged through the order, a green line showing where they will drop.**
*Claude's:* the table being set up is an ordered list: the first n rows are positions 1 to n, everybody below a reserve, away and withdrawn players at the foot and never moved. An arrow swaps with the neighbour, across the line into the reserves too; a drop takes the player out and puts them in at the line. So **every position is filled whenever the team has enough active players** (a position left empty is possible only when it is short). On a phone a drag starts after a 280 ms hold, so a swipe still scrolls; a mouse drags at once. Moved rows slide into place. Ties in the ranking (all at the start of a season) fall back to name order, as the table's own order does. The lineup cutoff is unchanged: it locks only what was saved, so a starting order never locked is not what the cutoff locks.
*Decided by UV (later the same day):* the position pill at the size of the Dates · Calendar selector (2rem tall, 0.85rem text).
*Decided by UV (later again):* a **"Reserves" label row** between the last position and the reserves (chosen over no line or a thin line). Every position pill the same size whether it shows one arrow or two (UV saw the one-arrow pills wider).
*How:* `league-card.js` (`suggestedOrder`, `orderFor`, `lineupRows`, `movePill`, `setOrder`, the drag handlers), `league.css` (`.lu-move`, `.lu-rank`, `lu-drop-*`). `docs/systems/leagues.md`; STATUS §1 4cq.

## 2026-11-18 — Scorecard · Stats on every team table

*Decided by UV:* under the team's name on the lineup page, the grey words (the hint and "Setting up tonight's lineup.") give way to a **Scorecard · Stats** toggle; **Scorecard first and shown on opening**. **Stats** is the table as it was. **Scorecard** is the same table, the same look, with only the stats columns replaced: the night's scorecard, this team's positions down the side (name, pill and drag in each row) and the other team's across, each cell the frame they meet in. **The reserves stay under the Reserves label**, moved in and out the same way. **Every team table has the toggle**; on a table the reader cannot change, the scorecard's rows are the positions, names only where that team's order may be seen. **The other team's Still choosing / Locked line is kept**; it goes only from the table being set up. **The scorecard section at the foot of the page is removed.**
*Claude's:* the rank (#) counts as a stats column, so Scorecard shows Position, picture, Player and the frames; a reserve's and an away player's frame cells are blank; the choice is kept per team across redraws but not across a reload.
*Decided by UV (later the same day):* on Scorecard the frame numbers are grey and written F1, F6 …, the last session's green; on Stats "#" reads "Rank"; the opposition's table has no Player column on Scorecard (positions and frames only), and **opens on Stats**. Once your own side has locked, its Scorecard shows the players' names beside the positions (the opposition cannot see them until it locks too).
*How:* `league-card.js` (`framesFor`, `scCells`, `scHeads`, `positionRows`, the toggle in `teamTable`, `data-view` on the team box), `league.css` (`.lu-views`, the `data-view` rules). `docs/systems/leagues.md`; STATUS §1 4cq.

## 2026-11-18 — Resetting a league night back to the schedule

*Decided by UV:* the league director can **reset** a night without taking it off the schedule: every score undone and the night back at lineups. **The button is on the director's Schedule page** (Reset the night, beside Take the match off). **A signed night may be reset too**, with a firmer question naming the score ("Hosts v Guests was signed 9 : 16. Reset it anyway?"). **The night takes the season's current rules**, as a fresh Start would. **A record is kept** of who reset it, when, and the score cleared; no page shows it yet.
*Replaces, in part:* 25 Oct, "a signed night shows no buttons on the fixtures page": Reset is now the one button a signed night has, for whoever runs the league. Take the match off is still refused on a signed night.
*Claude's:* the **match row is kept** and emptied rather than deleted and made again, so every `/leagues/card/?m=<id>` link a captain has open or saved keeps working, and its short number with it. Everything else on the night is deleted: frames (with their players, edit log and accepted discrepancies), both lineups and locks, **every card event** (deleted rather than left to lapse: a signature counts again whenever the card returns to the content it was signed at, so a replayed night could otherwise revive one), the night's notifications, the referee and break in play; `card_version` is bumped. The record names the director by account, not player, so the merge needs no new table. The Rules tab gains a clause, "Resetting a match". Enter on the Reset button in a signed row no longer also opens the card.
*How:* migration `20261118120357` (`tdc_reset_league_match(fixture)`, `tbl_league_match_resets`), test `084`; `league-fixtures.js` (`actions`, `act`, the row's Enter key), `league-rules.js`. `docs/systems/leagues.md`; STATUS §1 4cr.

## 2026-11-18 — A league night off the schedule leaves the profile menu

*Decided by UV:* a team night taken off its fixture (Take the match off) no longer shows in the profile menu. Found when The Apprentices v Break and Blaze was reset and then taken off: the league pages showed no match, the profile menu still listed it.
*Claude's:* the home page's live card had the same gap and is fixed with it; singles matches are unchanged. The empty match itself is kept (Take the match off keeps matches by design).
*How:* migration `20261118122114` (`tdc_my_active`, `tdc_my_live_matches`: a team match only while a league fixture points at it), test `084`. `docs/systems/leagues.md`; STATUS §1 4cr.

## 2026-11-18 — Two live match cards, one below the other

*Decided by UV:* on the home page two live match cards are always stacked, never side by side. Side by side (Claude's, from "The home page's live match card"), each card was too narrow and the opponent's name vanished.
*How:* `home.js` (`placeCard`: no `is-row`), `index.html` (the `.home-live.is-row` rules removed). When even two one-line cards are taller than the room above the black's cross, they are centred there and overlap the markings a little; `home.js` already logs that as a console error. STATUS §1 4cr.

## 2026-11-18 — Get the app on the home page only

*Decided by UV:* the Get the app strip under the bar no longer follows the person to every page. It shows on the home page only, at every visit, as before; its ✕ hides it for that visit. This replaces the 13 Nov rule ("on every page from a visit to the home page until ✕").
*Unchanged:* the home page's glass card, the menu's Get the app row, `/install/`, and the installed app's one-off welcome (still on any page).
*How:* `nav.js` ("Getting the app": the strip returns unless on the home page; the `tdc.get-app-off` key dropped), the comment in `nav.html`. `docs/systems/foundations.md`; STATUS §1 4cs.

## 2026-11-18 — The league director opens on Standings; Manage yellow

*Decided by UV:* **opening a league lands the LD on Standings, as everyone else**, not on Run it: the Leagues list, the home page's league cards and the site menu no longer add `&tab=manage` for whoever runs the league. Creating a new season still goes to Run it (`league-new.js`), as setting it up is the next job. **Manage's icon and word in the bottom bar are yellow** (`--color-warning`, the live pill's yellow), replacing grey; still green while one of its pages is open.
*How:* `card()` in `leagues.js`, `leagueBadge()` in `home-cards.js`, `activeLeague()` in `nav.js`; `.league-tab-admin` in `league.css`. `docs/ui.md`; STATUS §1 4ck, 4co.

## 2026-11-18 — The Standings tab's row 2 centred

*Decided by UV:* **the Individual · Team pill and the Live / Full names switches are centred** on the Standings tab, no longer pill at the left and switches at the right. They sit together in the middle; when they don't fit one line (a phone), the pill and the switches each take a centred line. Signed out, the pill alone, centred.
*How:* `.sd-controls` and `.sd-switches` in `league.css`. The Fixtures tab's row 2 (`.fx-controls`) was already centred. Replaces the left/right placement in "The Standings tab as one board" (17 Nov).

## 2026-11-18 — The league tabs' bottom bar at every screen size

*Decided by UV:* **the bottom bar shows at every screen size**, a computer included, replacing "a computer keeps the top pill" in "The league tabs' bottom bar" above; the top pill and the admin pill are hidden everywhere, Manage's menu holding the director's pages. UV chose **a phone's width, centred** on a wider screen (30rem), over the card's width or the full width. **The content card's top margin is corrected at every size** (UV): its top padding equals its sides, the extra having been room above the pill.
*How:* the `max-width: 47.99rem` media query round the bar's rules in `league.css` removed; `max-width: 30rem` and `margin-inline: auto` on `.league-tabbar`; `body.has-league-tabbar .tdc-card` padding-top `--space-5` (the sides, design.css), `--space-3` below 36rem as before. `docs/ui.md`; `docs/systems/leagues.md`; STATUS §1 4cu.

## 2026-11-18 — The scorecard's banner more compact on a phone

*Decided by UV:* to make the scorecard's top banner more compact on a phone: **the Standings and Fixtures tabs' heading above it** (the league's shield, the league in the display face · the season · the venue on one line), styled as theirs; **no venue or discipline badges under the ":" while folded** (reversing "The folded banner's badges", 16 Nov); **the fold's arrow in the teams' row, directly under the ":"**, no longer on a line of its own below them; **each team's picture centred over its name**; **team names smaller**; **less padding at the banner's foot** (the content 8px above the table's bottom cushion; the 8px is Claude's).
*Claude's (for UV to confirm):* the size, 1rem on every screen (was 1.15rem on a computer, 1.1rem on a phone), for the result and signing section's names too as they share the class; and the pictures' nudge clear of the Share icon dropped without a replacement, so on a 360–375px phone the icon's box overlaps the right picture's corner by a few pixels.
*How:* `#card-line` (`h1.sd-line`, `TDC.leagueLine`) and `button.cj-more-btn` in `leagues/card/index.html` and `league-card.js`; the details' summary kept with no height for the fold; `.cj-tags` removed; `league.css`. `docs/systems/leagues.md`; STATUS §1 4cv.

## 2026-11-18 — Stats first for anybody not in the match

*Decided by UV:* on the lineup page, anybody who is not playing in the match (another league player, the league director when not setting a side) opens **both** team tables on **Stats**. **Players in the match are unchanged**: their own team's table opens on Scorecard and the opposition's on Stats, and a captain's own table **stays on Scorecard after they lock** (UV, asked).
*Found while building it:* the server's `my_side` names captains only, so before the frames exist a teammate who is not captain looked like an outsider (both tables on Scorecard until now). The page now also counts the reader as in the match when their player is on either team's roster.
*How:* `renderLineups` and the toggle in `teamTable` in `league-card.js`. `docs/systems/leagues.md`; STATUS §1 4cw.

## 2026-11-18 — The tables' physics retuned again

*Decided by UV:* from the physics sliders on `/sandbox/banner/`: **cloth spin 60, side off cushions 0.7, side fades 0.2, ball–ball 0.42, swerve 0.3**; the rest unchanged (speed 1, cloth speed 2, cushion speed 0.25, cushion spin 0.9). **Everywhere:** every banner and the home page's table. Read from UV's screenshot of the sliders (the readouts were not in it); cloth spin and side fades are at the top of their sliders.
*Example:* a ball with side now comes off a cushion with twice the turn it had, and its side lasts longer on the cloth.
*So:* `scripts/banner-table.js` and `scripts/hero.js`, `P`; `docs/systems/file-map.md`; STATUS §1 4cx.

## 2026-11-18 — Doubles more often, and kicks when a ball is in the way

*Decided by UV:* **doubles about twice as often**: one cushion weighted 0.7 of a direct pot (was 0.35), two cushions 0.5 (was 0.2). **When a ball blocks the cue ball's straight way to the target, the cue ball plays a one- or two-cushion kick**: first kicks that also pot the target (checked on the copy of the table like every shot), and with no pot on at all, a kick that simply hits it, in place of the thin hit that went through the ball in the way. **Doubles get no extra weight when the other ball blocks a pocket's direct route** (UV, asked): that pot drops out and the doubles compete as on every shot.
*Example:* a straight double now beats a direct cut of about 35° or more (was about 55°); the white behind the striped ball with the solid ball beyond it goes off the side cushion onto the solid ball.
*Claude's, for UV to judge:* kick pots weighted 0.5 (one cushion) and 0.35 (two); "blocked" is the cue ball's straight line to the target's centre not clear of another ball; a kick is played with no side; a kick to hit takes one cushion over two (twice as likely) and the shorter way; a kick to hit is not tried on the copy of the table first.
*So:* `routesTo`, `kicksOn`, `kickToHit`, `paceFor`, `startPlanning`, `shoot` in `scripts/banner-table.js` and `scripts/hero.js` (identical); `docs/systems/file-map.md`; STATUS §1 4cx.

## 2026-11-18 — The banner sandbox's sliders explained

*Decided by UV:* under every Physics slider on `/sandbox/banner/`, **a line on what it does, its two ends, and (for the physics) a live line on what the value means now**; and **four labels renamed** to say what they do: Cloth spin → Cloth grip, Cushion speed → Cushion soaks up, Cushion spin → Cushion strips spin, Side fades → Side wears off. Sandbox only; the keys in `banner-table.js` keep their names.
*Example:* under Side wears off at 0.2: "Now: half the side is gone after 0.06 s, nearly all of it after 0.23 s."
*Claude's, for UV to judge:* the wording of every line and end label, and the examples chosen for the live lines (a ball rolling at 4 balls a second; a ball skidding at 4 balls a second).
*So:* `src/sandbox/banner/index.html`, `scripts/sandbox-banner-controls.js`, `.bp-*` in `sandbox.css`; `docs/systems/file-map.md`; STATUS §1 4cy.

## 2026-11-18 — The tables' physics, a third set

*Decided by UV:* from the explained sliders on `/sandbox/banner/`: **cloth speed 3, cloth grip 10, cushion soaks up 0.1, cushion strips spin 0.2, side off cushions 0.8, side wears off 0.1, ball–ball 0.1, swerve 0.15**; speed 1. **Everywhere:** every banner and the home page's table. Replaces the values set earlier the same day.
*Example:* a full hit now leaves the white with 10% of its speed (it kept 42%), and side spin lasts long enough to show off a cushion (half gone after 0.69 s, where it was 0.06 s).
*So:* `scripts/banner-table.js` and `scripts/hero.js`, `P`; `docs/systems/file-map.md`; STATUS §1 4cz.

## 2026-11-18 — Cushions deader, shots softer

*Decided by UV:* **cushion soaks up 0.5** (was 0.1 an hour earlier), and **the strongest shot 80 balls a second** (was 120; 48 before 17 Nov). Every banner and the home page's table.
*Example:* a ball keeps half its speed into a cushion; the hardest shot on a large screen is two thirds of what it was.
*So:* `P.ks` and `PMAX` in `scripts/banner-table.js` and `scripts/hero.js`; STATUS §1 4cz.

## 2026-11-19 — The scorecard's switches: letters inside, the special wins on W

*Decided by UV:* on the league scorecard, **the L and W letters go inside the switch**, in place of the dots at its ends, in the same grey; the letters outside the switch go, and **the players' columns take the room** they had. **W's knob shows a W, not a tick.** **Once the lag is in, W's own switch gains a stop for each special win the league has on, beyond W on the side it belongs to**, as the 1v1 page waits for the break event before its special wins (UV chose the lag as the card's break event: the card records no Dry / In / Scratch / Foul). The knob shows the special's letters there (BF, GB, rBF). **The switch grows by one stop per special, outward from W, with no blank stops**, and **does not move**: W · W stays where it was, under L, the middle dot in the middle; the new stops reach out on their own side only. **Team and player names are centred in their columns.**
*Rejected (UV, same session):* a separate switch per special win under W (built first, removed: "add the special win to the existing toggle as a new option on the relevant side"); blank stops to balance the sides; the whole switch re-centring as it grew.
*Replaces:* 29 Oct's "W cycles through the special wins" (a repeat tap on W stepping tick → BF → GB); a repeat tap on a chosen stop now clears it.
*Example:* a league with B&F, golden break and reverse B&F on; frame 4's lag goes to Team 3 (home). W becomes `GB BF W · W rBF`. Tapping BF records "Team 3 won with a break and finish", the knob showing BF; tapping it again clears the result.
*So:* `toggles()`, `winStops()` and `onFrameChange` in `scripts/league-card.js`; the three-way switch takes any number of stops, a letter per stop and a middle found by its empty value (`scripts/tdc-controls.js`, `status.css`); the `w` ring icon (`scripts/ring-status.js`); the card's columns and names in `league.css`. No database change.

## 2026-11-19 — The scoresheet as a picture; BF glowing yellow

*Decided by UV:* **a button in the top-right corner of the scorecard's signatures section saves or shares a high-quality picture of the scoresheet as it stands**, laid out like Billiard Café's paper scoresheet (`8MTL SCORESHEET.pdf`) but **in the site's styling**. **Its icon is a picture, not Share's** (Share shares the link). **BF (and GB, rBF) on the scorecard: larger letters, a yellow glow instead of the yellow lag ring, the letters kept green.**
*Claude's, within that (UV said "Yes, build it" to the plan):* drawn on a canvas from the card's data rather than a screenshot of the page (the page shows head to head, not a sheet); 2,400 pixels wide, PNG; the share sheet on a touch screen, a download with a mouse; columns SEQ · Player · B/F · LAG · P │ F# │ mirrored, as the paper, with session totals, total points, the signatures, and the time it was taken; the PDF's "(6)" marks and QR code left out.
*Example:* a captain at the bar taps the picture icon under the night's card; the share sheet opens with `8-Ball-Mainstream-R3-Cheeky-Tiger-v-Break-and-Blaze.png`, which they send to the team's WhatsApp group.
*So:* `drawSheet()`, `sheetClicked()` and the preloading in `scripts/league-card.js`; the `picture` ring icon (`scripts/ring-status.js`); `TDC.SHAPES` exported (`scripts/tdc.js`); `.h2h-mark.is-special` and `.sf-top` in `league.css`; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — The scoresheet picture's layout

*Decided by UV:* on the scoresheet picture, **the league's picture beside its name; the round and date on one line; the score as tall as a team's picture and name together; badges for the state and the frames instead of the line of text; a dot for a win in P, nothing for a loss; each session's frames won under P and its lags won under LAG in grey, "SESSION n" in the middle of the row and no "TOTAL" on it; the night's row the same, "TOTAL" in the middle with the points and lags; H or A before the position in SEQ; the site's green glow behind it.** Two badges (the state in the card's colour, and "23/25 frames") and the blank loss were UV's answers to Claude's questions.
*Claude's, within that:* the frames badge green once every frame is played, yellow before; the glow drawn from `--page-glow-size` and `--page-glow-rise`, so it follows the site's; **the teams moved out to the sides (340 each) to give the tall score room, so a long team name is cut with "…" at 320 (it had 474 before)**.
*Example:* a 25-frame night signed by both reads 11 : 12 in digits as tall as the hexagon and the name, with "Signed by both" glowing green and "25/25 frames" beside it; session 2's row reads `1 0 SESSION 2 5 4`, the grey numbers being lags.
*So:* `drawSheet()` in `scripts/league-card.js` only; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — Share the scoresheet from a button above Raise a dispute

*Decided by UV:* **the scoresheet picture's icon leaves the signatures section's corner; a button above Raise a dispute takes its place, "Share" in yellow with the same picture icon.**
*Claude's, within that:* the site's raised see-through button (as Raise a dispute's), always shown; the picture ring drawn larger than the words with negative margins so the button keeps the others' height.
*Example:* a captain who has just signed scrolls past the signature lines and taps the yellow Share under Sign; the share sheet opens with the picture.
*So:* `src/leagues/card/index.html` (`#sheet-btn` moved into `.sf-buttons`), `.sf-share` in `league.css` (and `.sf-top`'s corner padding removed), labels in `scripts/league-card.js`; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — The scoresheet picture as a JPEG of about 1 MB

*Decided by UV:* **the exported picture must be smaller, around 1 MB, at the best quality that allows.**
*Claude's, within that:* JPEG at quality 0.95, still 2,400 pixels wide. Measured on a 25-frame sample: PNG 1.77 MB; JPEG 0.95 0.88 MB, 0.92 0.74, 0.90 0.69; WebP 0.92 0.33; PNG at 1,800 wide 1.14. JPEG 0.95 is the highest quality under the target, and its text and marks are clean at full size. WebP was rejected because not every phone saves or forwards it, and a smaller PNG because it loses pixels and is still over 1 MB. Real team pictures add a little.
*Example:* a captain shares the night's sheet to WhatsApp as `8-Ball-Mainstream-R3-Cheeky-Tiger-v-Break-and-Blaze.jpg`, about 0.9 MB.
*So:* `makeSheet()` and `sheetName()` in `scripts/league-card.js`; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — The site's icon on the scoresheet picture

*Decided by UV:* **the site's icon at the top of the scoresheet picture, centred, small, above the league name.**
*Claude's, within that:* the 512px icon (`/resources/icons/icon-512.png`, the diver over the pool, transparent), drawn 84 pixels tall in the picture's 1,200-wide layout (168 real pixels); if it will not load, the picture is still made without it and the page says so.
*Example:* a shared sheet opens with the diver at the top, then the league's shield and name beneath it.
*So:* `sheetUrls()`, `preloadSheet()` and `drawSheet()` in `scripts/league-card.js`; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — The scoresheet picture: a compact table that sets the width

*Decided by UV:* **player names aligned inward (towards the table's middle); the table more compact and only as wide as it needs to be; the heading and the signatures no wider than the table, everything adjusted to fit; the columns on both sides the same size, the bigger side sizing the other.**
*Claude's, within that:* each column measured as its widest content over both teams; rows 38 tall (were 46); the picture still 2,400 pixels wide, drawn at whatever scale that takes; text above and below shrinks to 60% before it is cut; the score keeps its height unless each team would get less than 220; the JPEG quality 0.94 (from 0.95) to stay near 1 MB at the higher scale (993 KB on the sample).
*Example:* on a night whose longest name is "Ricky van der Merwe", both Player columns are just wide enough for it; home's names end against the frame column and away's start from it; the league name, score and signature boxes sit within the same width.
*So:* `drawSheet()` and `makeSheet()` in `scripts/league-card.js`; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — The message sent with the scoresheet picture

*Decided by UV:* **the shared picture's message reads, a line each: Team Name : Team Name; League Name | Season Name; the discipline; the date. "The Dive Club" is removed.**
*Claude's, within that:* sent as the share's text with no title (the title was the page's, which carried "The Dive Club", and some apps add a title to the text); the discipline worded as the banner's (`TDCMatchDef.DISCIPLINE`, "8-Ball"); the date as the banner's ("Wednesday, 19 November 2026" in the phone's language); a line with nothing in it left out. A computer's download carries no message.
*Example:* WhatsApp opens with the picture and "Cheeky Tiger : Break and Blaze / 8-Ball Mainstream | Season 1 / 8-Ball / Wednesday, 19 November 2026" as its caption.
*So:* `sheetMessage()`, `makeSheet()` and `giveSheet()` in `scripts/league-card.js`; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — The scoresheet picture's green rows, footer and display text

*Decided by UV:* **the green rows run out to the edge of the table's card; the total row's text fits inside it; wherever the display face is used, the space below the text is right; the total row sits as the card's footer with a small gap above it.**
*Claude's, within that:* the cause of the spill was the display face's line box, which is not its ink, so canvas's `middle` placed it high; every display text is now centred by the measured height of a capital. Session rows 40 tall (were 38), the total row 56 (was 48), the gap above it 10.
*Example:* the total row's 11 and 12 sit with equal room above and below inside the darker green footer, whose rounded corners are the card's own.
*So:* `say()`, `band()`, `hline()` and the card in `drawSheet()`, `scripts/league-card.js`; `docs/systems/leagues.md`. No database change.

## 2026-11-19 — 8-Ball Mainstream's reverse break & finish onto played nights too

*Decided by UV:* **rBF, switched on in the league's settings on 19 Nov, goes onto every match of the league: the two unplayed nights with locked lineups (The Ultimates v Cheeky Tiger, Wu Tang Clan v Foul Play Syndicate) and every played night.** Rejected: only the two unplayed nights; and changing the re-freeze rule so a locked lineup with no frames takes new settings (the rule stays as it is).
*Why:* the save's re-freeze reached only untouched matches, so the scorecard offered no rBF on the nights the LD expected. On a played night it only adds rBF as a choice when a frame is corrected; no frame changes or is rescored.
*Example:* on The Ultimates v Cheeky Tiger, once a lag is in, W's switch now has an rBF stop on the lag loser's end; BF stays on the lag winner's end; GB stays hidden while the league has it off.
*So:* migration `20261119101023` (that one key on 38 matches, nothing else); `docs/systems/leagues.md`. No page change.

## 2026-11-19 — Singles leagues: how they work

*Decided by UV:*
- **A singles player is a team of one, made automatically.** Rejected: fixtures naming the two players directly.
- **A singles night is a normal singles match on `/match/`.** Rejected: the league scorecard with one session and both players signing.
- **Only the league director starts a fixture's match**, as in team leagues. Rejected: either player may start it.
- **A new singles season ranks its players by matches won, then frames won.** Rejected: today's player default (frames won, then win %).
- **A result counts and settles as any singles match's does:** it counts once submitted; the opponent agrees, or the dispute window passes; a dispute reopens it. Rejected: both players signing as captains do; the league director approving every result.
- **A season may switch between singles and teams at any time, the director sorting out the teams.** Rejected: only while it has no teams and no fixtures.

*Replaces:* "Every league has a team size" (23 Oct), as UV's 24 Oct entry said it would: a league's team size is now 1 (singles) or 2 to 10.
*Why:* UV wants singles leagues as leagues like any other. A team of one keeps the fixtures, byes, readiness and Standings working on teams, and `/match/` already scores a singles match live with the players entering their own frames.
*Claude's, within that (for UV to correct):*
- The team is named after the player's display name when it is made, and they are its captain. A shared display name gets "(2)".
- The singles columns are Matches Played, Matches Won, Frames Played, Frames Won, Win %. The team defaults are seeded too, unused while it is singles.
- No reserves in singles (the team limit is 1).
- A team that is not exactly one active player is refused when its night is started, not when the rules change.

*Example:* Ann, Ben and Cas join a singles league and get teams "Ann", "Ben" and "Ben (2)". The director presses Start on Ann v Ben: a singles match Ann v Ben opens on `/match/`. Ann records 2–0 and submits, it counts in Standings at once, and Ben agrees. Switch a league with a team of two to singles, and that team's night is refused with "Pair has 2 active players. In a singles league a team is one player: sort it out on Run it first."
*Found while building:* nothing was needed for the result rule. `private.tdc_match_competition` knows only tournaments, so a league match is never "published", and a singles card's approval setting has no effect: it settles by agreement or the dispute window.
*So:* migration `20261119122128_singles_leagues`, tests `085_singles_leagues`; `docs/systems/leagues.md`. The pages are steps 2 and 3 (`docs/STATUS.md` §3, 1a).

## 2026-11-19 — A singles player in a team's place: their photo in a circle

*Decided by UV:* **where a team's hexagon or shield sits (Fixtures, the Season tab, Standings), a singles league shows the player's photo in a circle, or their initials in the circle without one.** Rejected: the photo inside the team hexagon.
*Claude's, within that:* the name shown is the player's display name as it is now, not the name their team of one was given when it was made.
*Example:* on Fixtures, "Cas 0 ▷ 0 Ann" with "C" and "A" in circles while neither has a photo.
*So:* `TDC.playerTeamPic` (`tdc.js`), `.team-initials` (`league.css`); `docs/systems/leagues.md`.

## 2026-11-19 — The Season tab and Run it in a singles league

*Decided by UV (the plan of 19 Nov):* the Season tab shows a player card per entrant in place of team cards, with no claiming, captains or asking to join; Run it has no team creation.
*Claude's, for UV to correct:*
- A player card is the closed team card, and a tap opens the player's profile rather than unfolding.
- The pill and heading say Players.
- My Season has no Away button for a singles player: the database lets only the director mark a team's only captain away. Changing that would need a migration.
- The results heading reads "My results", with no team place.
- The season's numbers have no Teams tile.
- On Fixtures, a singles player's name opens their profile.
- Run it explains how to split a team left from before a switch.

*Example:* Ann opens the Season tab: Players (3) with cards Ann (blue), Ben and Cas. My Season shows her row, "My next match v Cas" opening `/match/`, and "My results".
*So:* `league-season.js`, `season.html`, `league-manage.js`, `manage.html`, `league-fixtures.js`; `docs/systems/leagues.md`.

---

## 2026-11-19 — Doubles matches

*Decided by UV (19 Nov):* a social match can have more than one player a side, built for 2 v 2 and shaped for X v X, started from New Match with a 1 v 1 / 2 v 2 toggle and seats to fill, as padel apps do.
- **The pairs are fixed for the whole match.**
- **Any player on the other side may agree to or dispute the card; the first answer settles it.** The submitter's partner may not answer.
- **Break tracking records the side only**, as in singles.
- **Doubles is listed but kept out of singles numbers, head to head and points for now.**
- **The lists, the profile and the home cards show both names in this job.**

*Claude's, for UV to correct:*
- Seat 1 stays in `home_player_id` / `away_player_id` and a new table holds every seat, rather than a new side kind, so every existing reader keeps working and shows at least the first name.
- Two to four a side in the database; the page offers 2 v 2 only.
- A new or deleted doubles match also notifies the partner; every other card notification goes to the other side.
- The seats layout on New Match (yours left, a ringed empty seat that the search fills next) and the stage's overlapping pictures with a name a line.
- Doubles numbers of their own on the profile are not built.

*Example:* Alice starts a 2 v 2 with Bob against Carol and Dan. Bob scores frame 1 on his phone; it is credited to all four. Alice submits; Bob sees "Submitted. Waiting for Carol & Dan", Dan taps Looks right and it is settled. Alice's profile lists "with Bob vs Carol & Dan" and her win rate does not move.
*So:* migration `20261119124608_doubles_matches`, test `086_doubles_matches`; `match-new.js`, `src/matches/new/index.html`, `match.js`, `player.js`, `home-cards.js`, `live-match.js`, `points-formula.js`, `forms.css`, `match.css`, `notify-card`; `docs/systems/matches.md`, `players.md`, `points.md`.

## 2026-11-19 — The player star on the profile

*The question:* how to rate a player's game so it means something to them, when samples are small (league players have at most 31 frames), and how to show it.

*Decided by UV:*
- **Measured against UV's own standard for each spoke, never against other players.** Five spokes: win rate, own break, their break, break in, B&F. Standards 50 / 70 / 40 / 50 / 10%.
- **Starting frames** steady small samples (Claude's suggestion, UV took it as well): every player starts with frames played at the standard, 100 / 50 / 50 / 10 / 100. A star is solid at 200 frames.
- **On every Profile tab the raw star is shown dashed; on Compare it is hidden**, and Compare is one star across both halves.
- **The star follows the Stats period.** A spoke with no data sits on the standard, its label greyed with "no data".
- **The line only, no dots at the corners. The standard ring is grey.**
- **The break result is added to the profile function** so Break in can be counted.

*Rejected:* comparing each player with every other player (percentiles), which Claude first proposed; and frames played as the star's outer limit, which turns it into a measure of experience rather than ability.

*Claude's, not yet confirmed by UV:* walkovers left out; golden breaks counted as B&F; scratch and foul on the break not counted as "in"; the gap drawn as a ratio (UV had it on Ratio when approving the numbers); B&F counted even where a match's rules had B&F off.

*Example:* a newcomer who won 5 of 5 shows 52.4% on the win-rate spoke ((5 + 50) / (5 + 100)), faint, with a large dashed raw star; a regular at 232 of 400 shows 56.4%, nearly solid.

*So:* migration `20261119142114_player_profile_break_outcome`, test `087`; `scripts/player-star.js`, `stylesheets/player-star.css`, `player.js`, `players/index.html`, `player.css`; the sandbox uses the same module. `docs/systems/players.md`, `docs/design/player-star.md`.

## 19 Nov: The league star

*Decided by UV:* the star goes on each league's row on a player's profile and on each `/leagues/` card, showing one player's frames in that league only. Every spoke's starting frames are the expected maximum frames the player could play in the league, from the league's settings; the star's opacity is matches played ÷ matches scheduled.

*Chosen by UV from Claude's options:* the maximum is counted from the made schedule (a season does not store its rounds); a singles match counts its most frames from the match rules (race to N: 2N−1, best of N: N). *Decided by UV, 19 Nov:* the league star also shows the raw dashed line. *Decided by UV, 19 Nov, on the panel:* "matches played" is the player's own matches, so a team night they sat out lowers the star's solidity.

*Claude's, not confirmed:* the Stats period does not apply; shown only where the player is active.

*Decided by UV, 20 Nov:* a yellow line on each league star shows the league average for every spoke, ignoring UV's standards. *Claude's, not confirmed:* the average is pooled over every player's frames, so the win-rate spoke sits at 50% by construction; walkovers and doubles are left out.

*So:* migrations `20261119180000_player_profile_league_star` and `20261120080000_league_star_average`, test `088`; `player-star.js`, `player.js`, `leagues.js`, `player.css`, `league.css`, `leagues/index.html`.

## 20 Nov: The league star's own spokes, and no starting frames

*Decided by UV:* league stars (every league) use five spokes of their own, from who broke and who won alone: Win rate (FW / FP), Lags won (frames broken / FP), Own break (FW / lags won), Their break (FW / lags lost), B&F (BF / lags won). The grey pentagon is UV's standards from the sandbox, the same for every league; the yellow line the league's average; the green shape the player's current stats. **Lags won's standard is 50%.** **No starting frames on a league star**: the green shape is the frames alone, so the league lets a player feel the heat while the player profile's starting frames keep it from hurting the profile. The player star keeps its five spokes, to be reworked later.

*This reverses, for league stars:* the 19 Nov starting frames equal to the league's expected maximum frames (and the earlier idea of dropping UV's standards for the league average, which UV also dropped within the day). `framesPerNight` was removed; the raw dashed line is not drawn on a league star, as it would be the green shape.

*Claude's, not confirmed:* FW in Own and Their break means frames won within those lags; Break in is dropped from league stars.

*So:* `player-star.js` (`LEAGUE_SPOKES`, `EVERY`, spoke list passed to `draw`), `player.js`, `leagues.js`, `sandbox-star.js`, `sandbox/star/index.html` (the Star menu and the Lags won standard slider); `docs/systems/players.md`, `docs/design/player-star.md`.

## 20 Nov: The B&F standard is 5%

*Decided by UV:* the B&F standard goes from 10% to 5%. It is one spoke shared by the player star and the league star, so both change (`player-star.js`, `SPOKES`). The league's own rate so far is 2.3% of frames.

## 20 Nov: Numbers under the league star's labels

*Decided by UV:* under each spoke's label on a league star, the player's stat in green and the league average in yellow, `58% | 52%`, whole numbers (UV first asked for no % sign, then asked for them). `player-star.js` (`markNumbers`), `player-star.css`.

## 20 Nov: The league star's labels

*Decided by UV:* the league star's labels read Win %, Lags Won, W | Opp Brk, W | Own Brk, B&F | Own Brk (`LEAGUE_SPOKES` in `player-star.js`; the player star's labels are unchanged). *Claude's, not asked:* the spokes keep their order (Own break before Their break), each label named by what it measures; the picture is widened to fit the longest label, so the star is a little smaller in its box (its maximum width raised from 15 to 19rem).

## 20 Nov: Compare's shared league card, and league cards open Standings

*Decided by UV:* on a profile's Compare tab, a league both players are in is shown as one combined card with one star for both; the viewer's line is the raw-style dashed line. Any league card opens the league's first page (Standings), so the profile's Leagues rows no longer link with `&team=` (which opened the Season tab).

*Claude's, not asked:* the player whose profile it is is the green shape; three numbers under each label (yours | theirs | the league's); a league shows combined only when both players have a team in it; the card sits above the two halves' lists, which keep the leagues only one of them is in.

*So:* `player-star.js` (`dashed` layer, `markNumbers`), `player.js` (`renderShared`, `sharedSeasons`, the row's link), `players/index.html` (`#pp-cmp-shared`), `player.css`, `player-star.css`; `docs/systems/players.md`.

*Changed by UV, 20 Nov, later:* the viewer's line on the shared star is a **solid cream line**, not the dashed raw-style one.

*Changed by UV, 20 Nov, later still:* swapped: **you are the green shape and the other player is the solid cream line** on the shared star. (Claude's earlier choice that the profile's owner was green is reversed.)

## 20 Nov: The B&F standard is back to 10%

*Decided by UV:* the B&F standard goes back from 5% to 10% (`player-star.js`, `SPOKES`), for both the player star and the league star. This reverses "The B&F standard is 5%" above, made earlier the same day.

## 20 Nov: The B&F standard is 7%

*Decided by UV:* the B&F standard is 7% (`player-star.js`, `SPOKES`), for both the player star and the league star. It was 10%, then 5%, 10% and 8% earlier the same day; this is the one that stands.

## 20 Nov: The profile's tabs: Compare, Profile; Head to head removed

*Decided by UV:* the player profile's tabs are **Compare, Profile**, in that order, and **Compare opens by default** (for another player; your own profile has no tabs). The Head to head tab is removed completely.

*Claude's, not asked:* the database function `tdc_head_to_head` and its test are left in place (nothing calls it now), since removing a function is a migration UV did not ask for; the `.pp-vs-pic` rule in `design.css` is left alone; an old `&tab=h2h` link opens Compare.

*So:* `players/index.html`, `player.js` (`showTab`, the loader no longer calls `tdc_head_to_head`), `player.css`; `docs/systems/players.md`.

## 20 Nov: A one-sided league star on Compare has no labels

*Decided by UV:* where a league card sits on one player's side only, forced into a half-width column, the star shows without labels (no names, no numbers): the star alone. `player-star.js` (`draw` option `bare`), `player.js` (`renderTeams`).

## 20 Nov: League cards lose the player's name and the team's place; headings cream

*Decided by UV:* league cards on the profile show no player name (the names are pinned at the top of the page already) and no team rank; every heading on the Profile and Compare tabs is cream rather than green.

*So:* `player.js` (`renderTeams`, `renderShared`; `teamPlaces` removed), `player.css`, `players/index.html` (`league-standings-def.js` no longer loaded); `docs/systems/players.md`.

## 20 Nov: Compare's pinned heads are raised cards

*Decided by UV:* the player name and picture sections are raised cards with shadows. *Claude's reading, not confirmed:* the two pinned heads on Compare (`.pp-c-who`), not the hero. `player.css`.

*Later, UV, 20 Nov:* the type on the pinned heads is 0.75 of what it was (display name, full name and initials; the picture's size is unchanged).

*Then, UV, 20 Nov:* the display name alone is 0.75 of that again, 0.3375 of the picture's height in all (the full name stays at 0.289, the initials at 0.27).

*Then, UV, 20 Nov:* the strip behind the two pinned cards has no background of its own; each card is solid (`background: var(--bg-base)`), so content scrolling past shows between and round them.

## 20 Nov: No pill round the profile's league cards

*Decided by UV (with a marked-up screenshot of the league cards on Compare):* the raised, shadowed container round each league card is removed; the content stays. `player.css` (`.pp-team`).

## 20 Nov: No "Captain" in a singles league

*Decided by UV:* wherever a singles league is shown, "Captain" is left off, since every player is captain of their own team of one. *Claude's reading of "wherever":* the profile, Compare, the Leagues cards, the nav menu, the season page's roster (badge and Make captain button) and the manage page's Captain column.

*So:* migration `20261120120000_my_active_team_size` (one line: the menu's data had no team size), test `089`; `player.js`, `leagues.js`, `nav.js`, `league-season.js`, `league-manage.js`, `league.css`.

## 20 Nov: Grey lines between the profile's league cards

*Decided by UV:* grey separator lines between league cards: along the foot of a combined card, and down the middle where the two players' leagues stand separately. *Claude's addition, not asked:* a hairline between cards stacked in one list (and their gap closed). `player.css`.

## 20 Nov: The pinned heads keep a nav-bar-sized space above them, on mobile only

*Decided by UV:* a nav-bar-sized space always stays above the frozen cards, so they sit well on a phone when the nav disappears; on larger screens they behave as before. `player.css` (`.pp-c-head` `top: var(--nav-total)` below 36rem).

## 20 Nov: Form as rows; the tab selector centred

*Decided by UV:* the Compare / Profile selector is centred. Form loses its sunken pill: a row per frame with a grey line between rows, the dot exactly in the middle, and the opponent shown on each frame. *Claude's reading, not confirmed:* the rows apply to the Profile tab's form as well as Compare's (so Profile's form, which ran across, now runs down); the label is the opponent's name without "v".

*So:* `player.js` (`renderForm`), `player.css`, `players/index.html` (the Profile form's caption).

*Then, UV, 20 Nov:* on Compare the form reads **Opp | Result | Result | Opp**: yours Opp then Result, theirs Result then Opp, the dots meeting at the middle line. The Profile tab keeps the dot in the middle with the opponent to its right.

*Then, UV, 20 Nov:* the opponent on each form row is **the player, not the team**: `tdc_player_profile`'s frames gain `opponent` (migration `20261120130000`, test `090`), the display name of whoever was across the table in that frame.

*Then, UV, 20 Nov:* wherever the form shows, a line down the middle with an arrowhead at the foot shows the direction of time (newest at the bottom), on Compare and on the Profile tab. `player.css`.

*Then, UV, 20 Nov:* a "Streak: N" label at the bottom of the form section: frames won since the last lost frame. *Claude's reading:* counted over all finished frames, not only the ten shown; 0 if the latest frame was lost. `player.js` (`renderForm`), `players/index.html`, `player.css`.

## 20 Nov: The player star sits above Leagues

*Decided by UV:* the player stats star (the Profile tab's, and Compare's one star) sits above the Leagues section. *Claude's reading:* "player stats stars" means these, not the league stars on the league cards; it keeps following the Stats period switch, which stays under Stats. `players/index.html`, `player.css`.

## 20 Nov: The sandbox uses the league star's spokes

*Decided by UV:* the sandbox star uses the same formulas and headings as the league stars; UV will set new standards and starting frames on it. *Claude's, not asked:* the Star menu, the Break in spoke and the break-result columns were removed from the sandbox; the sandbox draws with its starting frames (the league cards use none); Lags Won gets a starting-frames slider (default 0). `sandbox-star.js`, `sandbox/star/index.html`, `docs/design/player-star.md`.

## 20 Nov: The profile star follows the sandbox star

*Decided by UV:* the player profile star (Profile tab and Compare) uses the sandbox star's spokes, labels and values: the league star's five spokes (Win %, Lags Won, W | Own Brk, W | Opp Brk, B&F | Own Brk), with the standards and starting frames set on the sandbox. This ends "we will play around with the main player star later" and drops Break in from it. `player.js`; the values stay in `player-star.js` (`defaults`).

## 20 Nov: UV's new standards and starting frames

*Decided by UV (set on the sandbox):* Win % 67% / 100 starting frames; Lags Won 50% / 20; W | Own Brk 75% / 100; W | Opp Brk 40% / 100; B&F | Own Brk 7% / 100. Written into `player-star.js` as the defaults, so the profile's player star follows them; the league stars use the same standards and no starting frames. These replace the 19 Nov numbers and the B&F values tried earlier the same day.

## 20 Nov: Compare's player star: you green, them cream, raw stars in colour

*Decided by UV:* on Compare's one star, you are green and the other player always cream (as on the league cards), and each shows their raw star dashed in their own colour. This replaces green and blue with no raw stars. `player.js` (`renderCompareStar`), `player-star.js` (the cream layer draws its raw star too), `player-star.css`.

## 20 Nov: Star labels wrap so the star can be bigger

*Decided by UV:* label text wraps where needed so the star can be larger. *Claude's reading:* a label wraps at its " | " ("W | Own Brk" becomes "W |" over "Own Brk"); the picture is only as wide as its longest line, so the star grows. The shared league card keeps its wider picture for the three numbers. `player-star.js`.

## 20 Nov: Another player's star is cream

*Decided by UV:* on the Profile tab, when viewing another player's profile, the star shape is white (cream), not green. *Claude's reading:* a cream filled shape, also for their league rows and the one-sided league stars on Compare; green only for your own. `player.js`, `player-star.css`.

## 20 Nov: Grey team names on league cards; your pinned card green

*Decided by UV:* team names in the league cards are grey text; on Compare's frozen cards the one for your stats has a green background. *Claude's reading:* the profile's league cards (not the `/leagues/` page's team-name badge); "green background" is a 22% green tint so cream text reads. `player.css`.

*Then, UV, 20 Nov:* your pinned card is the site's green with dark text, not a tint.

*Then, UV, 20 Nov:* the opponent's pinned card is cream with dark text, as yours is green with dark text.

## 20 Nov: Frame difference per night: one upright graph

*Decided by UV:* a normal upright graph, one base line for both sides, the bars above and below it. *Claude's reading, not confirmed:* one graph for both players with two bars a night (yours green, theirs cream), the nights lined up from the newest, no month labels. `player.js` (`renderCompareBars`), `players/index.html`, `player.css`.

## 20 Nov: The frame difference per night section is removed

*Decided by UV:* the Frame difference per night section is removed from Compare (it had been rebuilt as one upright graph earlier the same day). `players/index.html`, `player.js` (`renderCompareBars`, `nightsOf`, `dayKey`), `player.css`. The data it used is still in the profile function.

## 20 Nov: No outer content card on the profile

*Decided by UV:* the player profile's outer content card is removed; the name and buttons sit directly on the background. *Claude's reading:* the card's shadow and background are dropped, its padding stays so nothing moves. `player.css`.

## 20 Nov: The profile's content section is as wide as the removed card

*Decided by UV:* with the outer content card gone, the content section (the tabs and what is in them) is as wide as that card was. `player.css` (`.pp-tabs` side margins equal to the card's padding).

## 20 Nov: Nothing above the player stars

*Decided by UV:* above the player stars, the names (Compare's legend) and the grey subtitle are removed. `player.js` (`renderCompareStar`), `players/index.html`.

## 20 Nov: Percentages under the player stars' labels

*Decided by UV:* percentages under the player stars' labels, two lines (the player's stats, then the adjusted stats), in the players' colours. *Claude's reading, not confirmed:* raw then adjusted; yours | theirs on Compare; on a profile a single number a line. `player-star.js`, `player.js`.

*Then, UV, 20 Nov:* the adjusted values under the player stars' labels are smaller and in grey text (the player's own stats keep their colours).

*Then, UV, 20 Nov:* the adjusted values are centred under the actual values (both number lines are centred on the actual line's middle).

## 20 Nov: The Stats section is removed

*Decided by UV:* the Stats section (period switch and the four boxes) is removed from the Profile and Compare tabs. *Consequence, Claude's, not asked:* the period switch went with it, so the player stars are always all time. `players/index.html`, `player.js`, `player.css`.

## 20 Nov: Matches as one tabbed list; Home venue removed

*Decided by UV:* the Competitions headings are removed, and tabs show matches instead (All Matches, Leagues, Tournaments, Singles); Recent matches is removed as redundant; Home venue is removed from About. *Claude's reading, not confirmed:* Singles means the social matches between two people; one tab choice shared by both halves of Compare; 5 a page. `players/index.html`, `player.js`, `player.css`.

## 20 Nov: Match rows show the date

*Decided by UV:* wherever the profile lists matches, each row includes its date (this reverses the 17 Nov "no date"). *Claude's choice:* its own muted line between the competition and the venue; the year only when it is not this one. `player.js` (`rowNames`).

*Then, UV, 20 Nov:* the match list shows 3 matches a page, not 5 (`PER_PAGE` in `player.js`).

## 20 Nov: League names on league cards: display font, cream

*Decided by UV:* the league's name on the star cards is in the custom (display) font, the same size as the display name on the frozen cards, in cream. *Claude's reading:* the profile's league rows and Compare's shared card; on the rows the name moves to its own line at the top. `player.js`, `player.css` (`.pp-league-name`).

*Then, UV, 20 Nov:* a "Matches" heading above the match tabs, on both tabs.

*Then, UV, 20 Nov (a phone screenshot):* on a phone the space above the pinned cards is solid page background, so scrolling content does not show through it. `player.css` (`.pp-c-head::before`).

*Fix, UV's screenshot, 20 Nov:* the solid band above the pinned cards covered the tab selectors on a phone at the top of the page; it now shows only while the cards are pinned (`is-stuck`). `player.js`, `player.css`.

*Reversal, UV, 20 Nov:* what is above the pinned cards on a phone must not be solid: it blocked the island and hid the tab selectors. The solid band and its `is-stuck` script are removed; the nav-sized space above the cards stays and is transparent. `player.css`, `player.js`.

*Settled, UV, 20 Nov (phone screenshots):* on a phone the island and status bar zone above the pinned cards is transparent, and the nav-bar-sized space directly above the cards is blank page background (only while the cards are pinned). This replaces the solid band the whole nav height and the later removal of the band. `player.css`, `player.js`.

*Again, UV, 20 Nov (a third phone screenshot, "wrong again"):* the band above the pinned cards is a fade, solid against the cards and clear toward the island, running down to the cards' top edge; the solid block showed as a rectangle with a sliver of content below it. *Claude's reading, not confirmed.* `player.css`.

*Settled for now, UV, 20 Nov ("it should be transparent and the sizing is still wrong"):* no band or fade above Compare's pinned cards; they sit just under the nav while it shows and just under the phone's island (`--nav-top`) once it has gone, not a nav's height down. This replaces the always-`--nav-total` space and every band tried (solid, while-pinned, fade). *Claude's reading of "sizing", not confirmed.* `player.css`, `player.js` (`is-stuck` removed).

## 20 Nov: The player star on the home page

*Decided by UV:* the player star on the home page, above Matches. *Claude's reading, not confirmed:* a card "Your star" with the signed-in player's own player star (as on their profile, all time, with the percentages), signed in only, its heading a link to their profile; one extra call (`tdc_player_profile`). `index.html`, `home-cards.js`, `player-star.js` (`allFrames`).

*Then, UV, 20 Nov:* the home page's star has no card and no heading: it sits directly on the cloth. The link to the profile went with the heading.

## 20 Nov: A grey line at the foot of the home page's table

*Decided by UV:* a solid grey line, like the table's markings, at the bottom of the table, visible only when scrolled down. *Claude's reading, not confirmed:* a 2px line in the markings' grey across the foot of the cards, above the footer, in the scrolling box. `index.html`, `home.css`.

*Corrected, UV, 20 Nov:* the grey line is at the bottom of the table, above the player star (not below the cards, above the footer). `index.html`, `home.css`.

## 20 Nov: The home page's Matches, Leagues and Tournaments cards are removed

*Decided by UV:* the Matches, Leagues and Tournaments sections are removed from the home page, leaving the player star (with the grey line above it). This undoes 16 Nov "The home page's three cards". *Claude's, not asked:* the code that drew them was removed from `home-cards.js` (the file now draws only the live match and the star); the database function `tdc_home_cards` and its test are left as they are, still sending the lists, and the `hc-` styles stay in `home.css` unused. `index.html`, `home-cards.js`.

*Then, UV, 20 Nov:* the player's name and picture above the home page's star. *Claude's reading:* your display name in the display face with your picture beside it, no full name, no link (UV had removed the profile link). `home-cards.js`, `home.css`.

## 21 Nov: The player star's filled shape is the actual stats, the dotted line the adjusted; a key for the grey and the yellow

*Decided by UV:* wherever the player star is shown (profile, Compare, home page, and the sandbox, so everywhere), the **filled shape is the player's actual stats** (their frames alone) and the **dotted line is the adjusted star** (with the standards' starting frames). It was the other way round. The dotted line's **corners are always solid, joined at the corner, and the rest of each edge is broken** (`dotted` in `player-star.js`; the draw option `raw` is now `adjusted`). League stars are unchanged: they have no starting frames, so actual and adjusted are the same and they have no dotted line. A star with no labels (a league on one player's side of Compare) has no key.

*Decided by UV:* a **key for the colours of the data sets, only for the grey (Standard) and the yellow (League average)**, not the players' colours, set **once under the "Leagues" heading** (Profile tab and Compare) rather than on each star, since the styling holds for every league. It is the labels' size (`sizeKeys` in `player.js` measures a drawn star and scales 11 by it). It replaces the idea of a key on each star. *Claude's, for UV to judge:* the key shows only while a labelled league star is on screen under that heading. `/leagues/` has no stars today (`loadStars` in `leagues.js` is never called), so it has no key.

## 21 Nov: Singles leagues show no team line; a team league's win-rate standard is 50%

*Decided by UV:* in a **singles league** a league card on the profile and Compare's shared card show **no team name** (and no hexagon, role or player name): a team of one has no name of its own and the player is already named at the top. The shared card then has the league's name and the one star only. In a **team league** the league star's **Win % standard is 50, not 67**: a frame is won by one side and lost by the other, so the league's average win rate is always 50% (the yellow line sits on the standard). It does not apply to a singles league, nor to the player star (profile, Compare, home page, sandbox), which keep 67. `TDCStar.leagueSettings(…, teamLeague)` sets it; `player.js` passes `!isSingles(t)`. `/leagues/`'s star code is not called today, so it was not touched.

## 21 Nov: The star's scale: the edge is 100%, the standard's ring halfway, each side scaled on its own

*Decided by UV (from a screenshot, the percentages looked wrong):* the pentagon's **outer edge is 100%** and the centre 0%; the **standard's ring is always halfway out**, and the two gaps are scaled to the standard set on the sandbox. For a Win % standard of 67%: 0 to 67% runs from the centre to the ring (33.5% is halfway), 67% to 100% from the ring to the edge (83.5% is halfway). This replaces the **ratio** scale (the edge at twice the standard, so a 67% standard hit the edge at 100% but a 50% standard at 100% too, and a 7% B&F standard at 14%), and the **points** mode with its "points to the edge" slider, both removed from the sandbox and from `TDCStar` (`reach`, `defaults`). It applies to every star (player and league, the dotted line and the yellow average) and every standard.

## 23 Nov: The tables' physics, a fourth set; a potted ball's line undraws

*Decided by UV:* from the sliders on `/sandbox/banner/` (a screenshot): **cloth speed 3, cloth grip 20, cushion soaks up 0.5, cushion strips spin 0.4, side off cushions 0.8, side wears off 0.1, ball–ball 0.1, swerve 0.1**; speed 1. **Everywhere:** every banner and the home page's table. Changed from the set before: grip 10 → 20, strips spin 0.2 → 0.4, swerve 0.15 → 0.1.
*Example:* a ball skidding at 4 balls a second starts rolling after 0.06 s (it was 0.11 s), and side works at 60% of its strength off a cushion (it was 80%).

*Decided by UV:* on every table the green lines undraw like the white one, never just disappear. The home page's table wiped a potted ball's line when its new ball dropped in; it now keeps it, with a break, as the banner table already did.
*So:* `scripts/banner-table.js` and `scripts/hero.js` (`P`; `pocketStep` in `hero.js`); `docs/systems/file-map.md`.

## 2026-11-24 — The shop is built before the payment gateway
*Decided by UV:* the shop (credits, products, cart, checkout, orders, the staff queue, receipts) is built and running before PayFast or any other gateway, reversing 3 Nov "Payments before spending, designed as one". "Pay at the club" is the payment step until a gateway is live, and the site says so.
*Why:* payment providers' compliance reviews (PayFast stalled since 9 Nov) need to see a working shop with real products and prices. A gateway (PayFast, or Yoco as the fallback) plugs into the payment step later without changing the rest.
*Touches:* `docs/STATUS.md` P4, P5; `docs/design/shop.md`

## 2026-11-24 — Buying credits: prices, codes, who confirms (the shop's Stage 1)
*Decided by UV:*
- **Price:** R1 a credit to start; the slider from 10 to 1,000 credits in steps of 10; **no discounts yet**. A discount, when the owner sets one, is **money off** (250 credits at 10% off cost R225), not bonus credits. All of it is a setting the owner or admin changes, not code.
- **The pay-at-the-club code lasts 24 hours**, then shows as Expired and the person starts a new one. **A new request replaces a waiting one** (the old is cancelled): one code at a time.
- **Any staff at the venue may confirm** that a top-up was paid, and **they record Cash or Card**.
- **Where the balance shows:** the profile menu, under the banner, and the profile page's Credits section. Not on the shop or on screens players show others: a phone laid on the table for scores must not show someone's balance.
- **The cash redeem codes stay** beside top-ups.
- **The Terms get one line** on the 24-hour pay-at-the-club request.
*Claude's, approved by UV:* a confirmed top-up is its own ledger entry kind, `top_up`, with a dedicated, unique link to its request, in place of the backlog's general `ref_table` / `ref_id`, so the database itself refuses a second landing.
*Claude's, for UV to correct:* nobody confirms their own top-up (as with adjustments); a request's price is frozen when it is made; a wrong confirmation is put right with an owner's adjustment, with no Undo; the code is 4 characters from the redeem codes' alphabet (no 0, O, 1, I or L) and is stored as it is.
*Example:* Ann asks for 250 credits at 19:00 and gets code 7K4Q. At the bar Sipho types 7K4Q, sees Ann's name and face and "250 credits · R250", takes cash, taps Cash, then Confirm; Ann's balance shows 250. If Ann hadn't paid by 19:00 the next day, the code would read Expired.
*So:* `docs/systems/foundations.md`, "Buying credits"; `docs/design/shop.md`.
*Touches:* migration `20261124112328_credit_top_ups.sql`, `supabase/tests/091_credit_top_ups.test.sql`, `src/scripts/points-formula.js`

## 2026-11-24 — The top-up QR is a link to the staff page
*Decided by UV:* the QR on the Add credits card holds a link, `https://thediveclub.org/staff/top-ups/?code=7K4Q`. Staff scan it with the phone's own camera and land on that request, ready to confirm. The staff page reads `?code=` and looks it up as if it had been typed; the typed box stays for when a camera isn't handy.
*Why:* the phone's own camera reads a QR on every phone with no extra code; a Scan button inside the page would need a QR-reading library for iPhones.
*Rejected:* the code alone in the QR, with a Scan button on the staff page.
*Example:* Sipho points his phone's camera at Ann's card, taps the link, and `/staff/top-ups/` opens on "Top Ann · 250 credits · R250" with Cash, Card and Confirm. A player who scans their own QR gets the page's "You are not staff at this venue."
*Touches:* step 2 (the pages); `docs/design/shop.md` Stage 1

## 2026-11-24 — Buying credits: the pages (the shop's Stage 1, step 2)
*Built to UV's settled design* (`docs/design/shop.md`, canvas artboard 2; the entries above): the Add credits card over any page, the balance under the profile menu's banner and on the profile, `/staff/top-ups/` for any staff with the QR opening it, Pricing on `/staff/credits/`, the Terms' line.
*Claude's, for UV to correct:*
- The card starts at **100 credits** (a round amount near the low end of 10 to 1,000).
- **No "receipt to your account email" line** on Checkout, though the canvas has one: no email is sent until Stage 5, so the line would promise something that doesn't happen.
- The card asks whether staff have confirmed **every 4 seconds** while it is open and the page is shown, and stops when it closes.
- The profile lists **only waiting requests**; paid, cancelled and expired ones are not shown there (the ledger history is a later piece).
- The staff page's Waiting list is read on opening, after each confirm and on a venue change, **not live**; pull down to refresh it.
- A wrong code typed at the bar is caught by staff seeing the **name, picture and amount** before Confirm.
- The QR maker is **`qrcode-generator`** (MIT, no dependencies), pinned in `package.json` and copied at build like the Supabase library; it loads only when a code is shown.
*Example:* Ann taps "0 credits ⊕ Add" in her profile menu, slides to 250, Checkout, Get my code · R 250; the card shows TXZ5 and a QR. Sipho scans it with his camera, `/staff/top-ups/` opens on "Ann Test · 250 · R250", he taps Cash, Confirm; Ann's card turns to "Paid · 250 credits added" within 4 seconds.
*So:* `docs/systems/foundations.md`, "Buying credits"; `docs/ui.md`; `docs/systems/file-map.md`.
*Touches:* `scripts/credits-card.js`, `stylesheets/credits-card.css`, `_includes/layout.html`, `_includes/nav.html`, `scripts/nav.js`, `stylesheets/nav.css`, `accounts/profile/index.html`, `scripts/profile.js`, `staff/top-ups/index.html`, `scripts/staff-top-ups.js`, `stylesheets/staff-top-ups.css`, `staff/credits/index.html`, `scripts/staff-credits.js`, `stylesheets/staff-credits.css`, `staff/index.html`, `termsofservice.html`, `stylesheets/variables.css`, `.eleventy.js`, `package.json`

## 2026-11-24 — Join this league: a card on Standings, a yellow button on Season
*Decided by:* UV.
*What:* a league season's Standings tab has a card, like the live match card, for somebody not in the league: "Join this league". **It shows only while the season is Taking entries**: after that, the director adds players by hand. **A tap opens the Season tab**, where the + that sat in the banner's corner beside Share is now **a yellow button of its own just below the banner**, with the plus before the words "Join this league". Pressing it puts the name down, as the + did. **Once the name is down the button is Withdraw**, which takes it off again; **once the player is let in** (by the director, or by payment on a season where paying confirms) **the button is hidden**. A paid tick on somebody still only named down does not hide it (UV: not needed). Withdraw asks first (UV). What a press did ("Your name is down") shows on the button itself for a moment, not on a line under it (UV).
*Example:* Sipho opens Summer Singles (Taking entries), sees "Join this league · Taking names · Summer Singles" above the standings and taps it; the Season tab opens, he presses the yellow Join this league, and reads "Your name is down." Once the director sets the season to Running, nobody new sees the card.
*Claude's, for UV to correct:* the same people as the old + (a withdrawn player sees it too, the button reading "Join this league again"); the card is on Standings only; the button itself still shows whatever the season's status; the yellow is the site's warning colour with the main button's dark text; Withdraw keeps the yellow and its plus becomes a minus; the message shows for 2.5 seconds, words alone.
*So:* `docs/systems/leagues.md`, "Join this league".
*Touches:* `leagues/season/index.html`, `_includes/league/season.html`, `scripts/live-match.js`, `scripts/league-season.js`, `stylesheets/live-match.css`, `stylesheets/league-join.css`

## 2026-11-24 — The shop: products and the cart (the shop's Stage 2)
*Decided by UV:*
- **Prices are in credits, with the rand value shown small beside them** ("30 credits · R30"), worked out at the venue's current price per credit.
- **The owner types the products in** on a new Products page; nothing is loaded by Claude. **The owner manages the categories** there, starting with Café, Apparel and Pool accessories. **Owners and admins** may change products and categories (as pricing).
- **Studio services and Art are off the shop for now.**
- **No stock counts until P5**: the owner switches an item off when it runs out.
- **The cart is kept on the account**, the same on every device.
- **Anyone may browse the shop signed out**, with prices; adding to the cart asks them to sign in.
- **Nothing needs a verified ID to buy**: restricted products never appear on the site.
- **No balance on the shop page** (24 Nov stands: the profile menu and the profile only), and **no Credits tab** beside the categories.
*Claude's, for UV to correct:*
- A product is **never deleted**, only switched off, so a later order can always name what it sold; a category can be deleted only once empty.
- A product switched off while in someone's cart **stays in the cart, struck through, "No longer available"**, left out of the total, with Remove.
- The cart ends at **"Checkout · coming next"**, disabled, until Stage 3.
- A short line under the products says what else credits pay for (table time, games, arcade, simulators, entries), as the old Play credits list did; the policies and company block stay at the foot.
- **The Terms say "Everything we offer is listed in our Shop"**, which is no longer quite true with Studio services and Art off it: left for UV to word (B1).
- A product's picture is added once it is saved (the picture's folder is the product's id).
- The cart is not a points data point: it is emptied and refilled, so it says nothing lasting about a player (Stage 3's orders will be).
*Example:* Sipho adds "Flat white, Café, 30 credits, made at the bar" and its picture on Staff › Products. A stranger opening `/shop/` sees "Flat white · 30 credits · R30 · Made at the bar" and a +, which takes them to sign in and back. Ann adds two and a pair of socks: the bar reads "3 items · 140 credits". The socks run out; Sipho switches them off; Ann's cart shows them struck through and 60 credits.
*So:* `docs/systems/foundations.md`, "The shop: products and the cart"; `docs/ui.md`; `docs/systems/file-map.md`.
*Touches:* migration `20261124125407_shop_products_and_cart.sql`, `supabase/tests/092_shop_products_and_cart.test.sql`, `supabase/tests/069_league_public_reads.test.sql`, `shop/index.html`, `scripts/shop.js`, `stylesheets/shop.css`, `staff/products/index.html`, `scripts/staff-products.js`, `stylesheets/staff-products.css`, `staff/index.html`, `scripts/staff-hub.js`, `stylesheets/variables.css`

## 2026-11-24 — Basil's Billiards: its owner, and Summer Singles tied to it after creation
*Decided by UV:*
- **Basil Munsamy owns Basil's Billiards Pool Lounge** (his 9 Nov account, display name "Basil's Billiards"), not the second account "Basil Billiards BlackBall Comp" (23 Nov), which gets no role.
- **Summer Singles belongs to Basil's and is played there.** Belonging is "fixed at creation" (5 Nov); this is a one-off exception by migration, because the league was made before the venue had an owner, so nobody could have tied it there when it was created. The rule itself stands.
*Example:* Basil now sees the venue's Settings tab, can run Summer Singles as its venue's owner, and its season banner names Basil's.
*Touches:* migration `20261124133103_basils_owner_summer_singles.sql`; `docs/systems/foundations.md`.

## 2026-11-24 — The banner table's middle pockets never change sides
*Decided by UV:* a table should never switch its middle pockets to the longer side; strange table sizes are to be possible. Which sides carry them is chosen **from the banner as the page first shows it** (UV: "based on default view at start, on page load") and kept for the page's life, whatever the banner does afterwards (opening, closing, filling in).
*Why:* the pockets followed the longer sides every frame, and the padding they set changes how the text wraps. Basil's venue banner is almost square, so it flipped about three times a second for ever (374 ↔ 414px tall).
*How (Claude's, from that):* the choice is made at the first measuring after the loading screen lifts (`tdc-loader`), so a banner sitting empty behind the screen does not decide it. Behind the screen the table still follows the longer sides.
*Example:* on Basil's page the pockets sit top and bottom on one load and left and right on another, depending on which shape the banner had at the moment the screen lifted; either way they then stay put. A Season banner opened after load keeps the sides it had when the page showed.
*Touches:* `src/scripts/banner-table.js` (`midSides`); `docs/systems/file-map.md`; `docs/STATUS.md` (4au).

## 2026-11-24 — The site owner runs every league, tournament and match
*Decided by UV:* "As the owner of the site, I need my admin@thediveclub.org to behave like director on all leagues and tournaments ... I can see and edit leagues and tournaments even if I'm not part of the league. Same for matches." Asked whether that takes in social matches: **yes** (UV chose "Go ahead" over "leagues and tournaments only").
*This widens* 17 Nov's "the site owner may change any venue's details, details only" to running every competition and editing every match card. **Choosing a venue for a competition still takes that venue's own owner or admin** (17 Nov stands). It is not the 5 Nov "no exception for UV's account": that was tying a league to a venue, and UV's personal account is not the site owner.
*Claude's, not asked:* the site owner is The Dive Club venue's owner, the test the title ladder and venue editing already use; it is never written in as a director, so it does not appear under who runs a competition; it also outranks a social match's referee, so it can correct a referee's frames (told to UV at the hand-back).
*Example:* admin@ opens Summer Singles at Basil's, which it has no role in, and sees the Settings and Fixtures controls as Basil does; it fixes a wrong frame on a social game between two players at another club. Rick's league page still lists only Rick and admin@ (as before) under who runs it.
*Then, asked:* **admin@'s "my leagues" and "my tournaments" (home page, profile) list every competition on the site**, since they list what you run: UV chose to keep that over listing only what admin@ is named in. **The site owner may delete any match, social ones too** ("Yes, like editing"); a sanctioned match still cannot be deleted by anybody.
*Touches:* migrations `20261124142305_site_owner_runs_everything.sql` and `20261124142858_site_owner_deletes_matches.sql`; `supabase/tests/093_site_owner_runs_everything.test.sql`; `docs/systems/foundations.md`.

## 2026-11-24 — The site owner chooses any venue for a competition
*Decided by UV:* "As owner, I should also be able to add venues to any league or tournament." **admin@ (the site owner) may list any open venue as played at** on a league season, a tournament or a single fixture.
*This changes* 17 Nov's "only a venue's owner or admin may choose it" and 17 Nov's "the site owner's exception is details only", for the site owner alone. Everybody else is unchanged: their own venues as owner or admin. The venue a competition **belongs to** (staff rights) has no picker and is set at creation by a migration; unchanged.
*Claude's, told to UV before building:* one place decides (`private.tdc_can_choose_venue`); the picker now asks the database which venues to offer (`tdc_choosable_venues`) instead of reading the staff table itself, which would have kept hiding other clubs; for the site owner the field still reads "Search your venues".
*Example:* admin@ opens Summer Singles' Settings, searches "Billiard", and adds Billiard Café (Rivonia) to its played-at list, a venue it does not own. Rick, running his own league, still finds only the two Cafés.
*Touches:* migration `20261124145529_site_owner_chooses_venues.sql`; `src/scripts/venue-picker.js`; `supabase/tests/093_site_owner_runs_everything.test.sql`, `081_venue_edit.test.sql`; `docs/systems/foundations.md`.

## 2026-11-24 — The tournament poster in a league season's look
*Decided by UV:* the poster follows the league Season tab, "especially the I'm interested and Share buttons". **Share is the corner icon; entering is buttons just below the banner with no panel**, anything to say on a grey line under them; when both show, **Confirm my entry yellow, I'm interested plain**; **the banner's details fold, closed on opening**, with the venue (and the date) under the name and Who runs it in the details, as a league's; **entrants in neat columns**.
*Claude's, for UV to correct:* signed out, the mode's leading button leads to sign in; Withdraw yellow with a minus, as the league's; what a press did said on the button for 2.5 s, as the league's; date and venue not repeated in the details.
*Example:* a stranger opens the Friday 9-Ball poster: the banner shows Friday, 4 December, 19:00 and The Dive Club under the name, and a yellow I'm interested under it. A tap takes them to sign in and back; pressed, the button says "Your name is down" and then becomes Withdraw.
*Touches:* `src/tournaments/poster/index.html`, `src/scripts/tournament-poster.js`, `src/stylesheets/poster.css`; `docs/systems/tournaments.md`.

## 2026-11-24 — A tournament has its own picture, live on the poster
*Decided by UV:* "I should be able to add a pic for tournament, same as leagues." **The picture shows on the poster live**, as soon as it is set, not when the poster is next regenerated.
*Claude's, for UV to correct:* who may set it is whoever may run the tournament (`private.tdc_can_run_tournament`); with no picture the poster shows the trophy in the league's empty shield (it was a plain trophy); the field sits after the short link on the Settings tab, as the league's does. Not built: pictures on the `/tournaments/` cards or a Draw banner, which have neither today.
*Example:* the director of Friday 9-Ball opens Settings, chooses a photo, and the poster everybody already has the link to shows it at once, with no regenerating.
*Touches:* migration `20261124150322_tournament_pictures.sql`; `supabase/tests/094_tournament_pictures.test.sql`; `src/_includes/tournament/settings.html`, `src/scripts/tournament-settings.js`, `src/scripts/tournament-poster.js`, `src/scripts/tdc.js`; `docs/systems/tournaments.md`, `docs/systems/points.md`, `CLAUDE.md`.

## 2026-11-24 — The shop: checkout and orders (the shop's Stage 3)
*Decided by UV:*
- **An order is paid with credits or at the club.** Credits are taken the moment it is placed; at the club, it is placed unpaid and staff take cash or card at hand-over (Stage 4).
- **A player may cancel their own order until staff start it** (while it is Placed); credits paid come back at once.
- **Order numbers run per venue and start again each day.**
- **A cart with café items and merch is one order**, Ready only when all of it is.
- **No ID verification is needed for any purchase yet**, so the checkout has no "Bring your ID" line.
*Claude's, put to UV as the plan's five choices and built with the go-ahead "Go", not answered one by one; for UV to correct:*
- **The balance shows in the checkout** ("Credits · 120 credits", "Leaves 10 credits."), and only there in the shop; the shop page and the order card still show none (24 Nov: no balance on screens shown to others).
- **The number carries the weekday's letter**, A = Monday … G = Sunday (`B27`), so a merch order waiting up to 30 days is told apart from today's 27.
- **The day starts at midnight, club time** (the venue's timezone).
- **The order QR is shown now**, a link to `/staff/orders/?order=<id>` (as the top-up QR, DECISIONS 24 Nov); the page it opens is Stage 4.
- **The Refunds policy gains "Shop orders · Cancelling an order"**: cancel on the site until staff start preparing it; credits back at once.
*Claude's, for UV to correct:* the cart is the checkout (one tap from the shop, artboard 3); Credits is chosen when the balance covers the total, else At the club; short of credits, Add credits opens the Add credits card over the checkout; product names and prices are frozen onto the order's lines and the price per credit onto the order; a line switched off stays in the cart and is not ordered; the page's total must still be right or the order is refused; a retry with the same key returns the order already placed; no "we'll email you" line until Stage 5; Profile › Orders lists every open order and the last 10; the two Pay with rows skip the site's pressed-button dots (a choice, no wait).
*Not built:* the credits of an order not collected within 30 days coming back (the Refunds and Delivery policies promise it): a nightly job or a staff step, to settle with Stage 4 (STATUS).
*For UV:* the Delivery policy says staff check ID when merch is collected ("Who may collect"); with no ID verification for purchases, does that line stay?
*Example:* Ann (120 credits) puts a flat white (30) and socks (80) in her cart, taps View cart, Credits, Place order: the card shows **B1** (a Tuesday), Paid · 110 credits, collect by Thu 24 Dec, and her balance is 10. She cancels: "Cancelled · 110 credits back", 120 again. Bob orders a coffee At the club: **B2**, Pay at the club · R30.
*So:* `docs/systems/foundations.md`, "The shop: checkout and orders"; `docs/ui.md`; `docs/systems/file-map.md`; `docs/systems/points.md`.
*Touches:* migration `20261124152509_shop_orders.sql`, `supabase/tests/095_shop_orders.test.sql`, `src/scripts/shop.js`, `src/stylesheets/shop.css`, `src/shop/index.html`, `src/scripts/shop-order.js`, `src/stylesheets/shop-order.css`, `src/scripts/credits-card.js`, `src/accounts/profile/index.html`, `src/scripts/profile.js`, `src/refunds/index.html`, `src/scripts/points-formula.js`, `src/stylesheets/variables.css`

## 2026-11-24 — Uncollected shop orders, and ID at hand-over
*Decided by UV* (answering the two questions in "The shop: checkout and orders"):
- **An order not collected within 30 days is cancelled by a nightly job, automatically**, with its credits returned (the Refunds and Delivery policies). Not built yet: STATUS §3. The project has no `pg_cron` (notifications.md, 22 Oct), so the job means turning it on, in a migration.
- **The Delivery policy's "staff will check your ID" stays.** Staff look at an ID document when merch is handed over; no ID verification is needed to buy (24 Nov). Stage 4's hand-over keeps its "ID matches" tick.
*Example:* Ann orders socks on 24 Nov and never collects them; on the night of 24 Dec the order turns Cancelled and her 80 credits come back. Had she come in, staff would have looked at her ID before handing them over.
*Touches:* `docs/STATUS.md` §3, §5; `docs/systems/foundations.md`; `docs/design/shop.md` Stage 4

## 2026-11-24 — The shop: the staff queue and hand-over (the shop's Stage 4)
*Decided by UV:*
- **Any staff at the venue** (owner, admin, staff) see the queue and move orders on.
- **One page for a bar screen and phones**, which **checks for new orders every 5 seconds**; a new order **chimes and its card flashes** while the page is open.
- **Staff may cancel any open order** (out of stock), credits back at once, and **the player is told** (tray and push).
- **At hand-over, an order paid at the club is paid there with Cash or Card**; an order paid with credits shows Paid and needs no payment step. **No ticks**: Cash or Card, then Mark collected.
- **No ID check at hand-over**: the person collecting is tied to the order's code and account. **This reverses** "The Delivery policy's *staff will check your ID* stays" in "Uncollected shop orders, and ID at hand-over" (the same day). Delivery's "Who may collect" now reads: "Only the account holder may collect an order: show its code or QR at the bar."
- **One step back is allowed until an order is collected**; Collected is final.
- **Staff may not hand over (or cancel) their own order**, as with top-ups.
- **The player is told when the order is Ready**, under **a new Shop switch** in notification settings.
- **Scanning uses the phone's own camera** (the QR is already a link); a bar laptop types the number. No scanner in the page.
- **The nightly job is built now**: merch orders past 30 days and café-only orders from an earlier day are cancelled, credits back if paid with credits. **Refunds and Delivery gain** "Café orders not collected on the day are cancelled overnight, and credits paid are returned."
*Claude's, for UV to correct:* the job runs at 04:00 club time (02:00 UTC) and turns on `pg_cron`; it cancels Ready orders too, and tells nobody; a moved-already order is refused using the step the page showed; an order is handed over only from Ready, and no step is skipped; the code box sends any other four characters to Top-ups; two open orders with one number (a weekday repeating while merch waits) open the newest, saying so; the chime is two notes made in the browser, with a mute switch remembered per device; the order's card opens over the queue from a tap anywhere on a card, holding Back and Cancel, so each card has one button; Ready and Cancel link to the profile; `me.profile.shop_collected` on the points page.
*Example:* Ann orders a flat white and socks with credits: **B1** appears in New and chimes. Sipho taps Start, then Ready, and Ann's phone says "B1 is ready to collect". She shows her QR; Sipho's camera opens B1's card; Mark collected. Bob's **B2** (R40 at the club): Sipho picks Card, then "Mark collected · R40". Socks run out on Ann's next order: Cancel order, her 80 credits come back and she is told.
*So:* `docs/systems/foundations.md`, "The shop: the staff queue and hand-over"; `docs/systems/notifications.md`; `docs/ui.md`; `docs/systems/file-map.md`; `docs/systems/points.md`.
*Touches:* migrations `20261124155021_shop_staff_orders.sql`, `20261124160613_shop_uncollected_orders.sql`; tests `096_shop_staff_orders`, `097_shop_uncollected_orders`; `src/staff/orders/index.html`, `src/scripts/staff-orders.js`, `src/stylesheets/staff-orders.css`, `src/staff/index.html`, `src/scripts/push.js`, `src/delivery/index.html`, `src/refunds/index.html`, `src/scripts/points-formula.js`

## 2026-11-24 — The shop: receipt emails (the shop's Stage 5)
*Decided by UV:*
- **From "The Dive Club <orders@thediveclub.org>", replies to admin@thediveclub.org** (a real inbox; `no-reply@` stays for the sign-in emails).
- **Five emails, each its own switch on the profile, like the notification switches**: Credits added, Order placed, Ready to collect, Collected (the receipt), Order cancelled (by the player, by staff, or by the nightly job). After asking whether to drop them (24 Nov: "implement all the emails you listed with the switches. Including cancellations").
- **The Shop notification switch never stops an email**; it governs the push only.
- **No email to staff** for new orders: the Orders page already chimes.
- **No pg_net**: the nightly job's emails go out at the first page load after it, not at 04:00.
- **"We'll email you when it's ready" on the order card and "Receipt to …" on Add credits' Checkout**, each shown only while that email's switch is on.
- **The nightly job also tells the player in the tray and by push** ("B27 wasn't collected in time"), answering STATUS's open question from Stage 4.
*Claude's, for UV to correct:* every switch on until turned off (no row means on, as notifications); sent only to a confirmed address; the email built when sent, not when queued; an email over a day old is skipped instead of sent (a "ready" a day late is no longer true, and a backlog shouldn't land at once); five tries, 10 minutes apart; Resend given the queue row's id as its idempotency key; triggers on the order and top-up tables instead of patching the seven shop functions; the subjects and wording ("Thanks, Ann", "Here's your receipt", "The club cancelled B27", "Questions? Ask at the bar or reply to this email."); the wordmark only, no diver GIF; the trading address in the foot, not the registered office; the button goes to the profile (no deep link to one order); "Collected (your receipt)" as the switch's name; nothing added to the points page; the Privacy policy's two lines that said Resend sends only sign-in emails now name shop receipts and order updates too (dated 24 Nov), so it stays true.
*Example:* Ann orders a flat white and socks with credits: "Order B27 placed" arrives with the lines, "Total · paid with credits · 110 credits" and where to collect. She has turned Ready off, so Sipho's Ready sends her the push only. At the bar he marks it collected: "Your receipt for B27". Bob's top-up of 250 at 10% off: "250 credits added, Bob", R250, −R25, Paid · Cash · R225, balance 370.
*So:* `docs/systems/foundations.md`, "The shop: receipt emails"; `docs/systems/notifications.md`; `docs/systems/file-map.md`; `docs/systems/points.md`.
*Touches:* migration `20261124170346_shop_receipt_emails.sql`; test `098_shop_receipt_emails`; `supabase/functions/send-shop-emails/` (`index.ts`, `email.ts`), `supabase/config.toml`; `src/scripts/tdc.js`, `src/scripts/push.js`, `src/accounts/profile/index.html`, `src/scripts/shop.js`, `src/scripts/shop-order.js`, `src/scripts/credits-card.js`, `src/stylesheets/credits-card.css`, `src/scripts/staff-top-ups.js`, `src/privacypolicy.html`

## 2026-11-24 — The poster's players open their profiles; the gap under a table banner
*Decided by UV* (the UI list, `docs/ui-list.md` items 2 and 4): **every name and picture on the poster opens the player's profile**, a stranger being asked to sign in there; **player ids go into the poster's snapshot** to do it (UV chose this over links for signed-in visitors only), **reversing the 21 Oct design's "no ids of any kind except the tournament's own"**. And **there was too much space above I'm interested**: tighten it.
*Claude's, for UV to correct:* the snapshot keeps `entrant_names` and adds `entrant_ids` beside it, so the designer text is unchanged; posters already built gain the ids only when rebuilt (regenerated, or a Settings save), not in the migration; a walk-in's id in a poster built before a merge leads nobody until the poster is rebuilt (`tdc_merge_players` does not touch snapshots). The poster now differs from the league Season tab, which gives a signed-out visitor plain names (UV, 10 Nov). The gap: measured, the button sat 24px below the banner's box but about 40px below the table as drawn (its pockets stop short of the box's foot, by an amount that changes with the screen's width); now every pool-table banner's gap is measured from the table as drawn (`--banner-out-z`, set by `banner-table.js`), 24px, the same as under the button, and the join button has no top margin of its own. Site-wide, so whatever follows any table banner moves up 12–19px.
*Example:* a stranger opens Friday 9-Ball's poster and taps Johan in the draw: the sign-in page, then Johan's profile. On a phone, the yellow I'm interested now sits 24px under the table's bottom pockets, as the number boxes sit 24px under it.
*Touches:* migration `20261124172239_poster_player_ids.sql`; tests `099_poster_player_ids` (new), `055_poster_more` (two lines); `src/scripts/tournament-poster.js`, `src/stylesheets/poster.css`, `src/scripts/banner-table.js`, `src/stylesheets/banner-table.css`, `src/stylesheets/league-join.css`; `docs/systems/tournaments.md`, `docs/ui.md`, `docs/ui-list.md`, `docs/STATUS.md` (4do).

## 2026-11-24 — A tournament's pages get the league's bottom bar
*Decided by UV* (`docs/ui-list.md` item 3): a tournament's pages work as a league's, the bar at the foot of the screen with the admin controls as their own icon. **Poster · Draw · Rules**, and **Manage** holding Run the draw, Entrants and Settings; **signed out, the bar shows** and Draw and Rules ask to sign in (as a league's Fixtures tab).
*Claude's, for UV to correct:* the icons, a megaphone for the Poster and a bracket for the Draw (new; Rules and Manage are the league's); on the draw page the Poster is offered as the old pill offered it (whoever runs it, or anybody once shared); a poster showing "Nothing here" shows no bar; no match pill (the league's live-match strip), which UV did not ask for.
*Example:* a stranger opens Friday 9-Ball's poster: Poster lit, Draw and Rules beside it; Draw asks them to sign in, then opens the draw. The director on the same poster also has Manage, whose menu opens Entrants.
*Touches:* `src/scripts/tournament-nav.js`, `src/scripts/ring-status.js`, `src/stylesheets/league.css`, `src/tournaments/poster/index.html`; `docs/systems/tournaments.md`, `docs/systems/file-map.md`, `docs/ui.md`, `docs/ui-list.md`, `docs/STATUS.md` (4do).

## 2026-11-24 — Existing posters rebuilt with player ids
*Decided by UV:* after "I still can't open any profiles from the tournament poster page" (production's one poster was built two hours before `20261124172239` was pushed, so it held no ids), **rebuild every existing poster once in a migration** rather than regenerating by hand.
*Claude's, for UV to correct:* each rebuilt with its own choices; whether it is shared, and who generated it, left alone; `generated_at` set to now, since the page says the poster shows the tournament as it was then; only posters below version 3.
*Example:* Basil's Friday Super Comp's poster is rebuilt: 12 entrants now (8 when it was built), each name opening a profile.
*Touches:* migration `20261124173925_poster_rebuild_with_ids.sql`; test `100_poster_rebuild_with_ids`; `docs/systems/tournaments.md`, `docs/STATUS.md` (4do).

## 2026-11-24 — A tournament's Poster settings page
*Decided by UV:* the text for a poster designer moves off the poster to the admin pages, as a page; then **all the poster settings move there too**. **Who may open it:** whoever gets the Manage menu (every official on the tournament, and the site owner), not directors alone. **Visible to public and the tournament picture stay on Settings.**
*Claude's, for UV to correct:* named Poster settings, last in the Manage menu; the panel moved unchanged; the Entrants link's hint still says whether the link opens anything, pointing at the new page; the text box hidden until there is a poster.
*Example:* Rick, a referee on Basil's tournament, opens Manage › Poster settings, ticks the names, presses Regenerate, then Copy, and pastes the text into an image generator. A player who follows the same address sees the Draw.
*Touches:* `src/_includes/tournament/poster.html` (new), `src/scripts/tournament-poster-settings.js` (new), `src/scripts/poster-words.js` (new), `src/scripts/tournament-poster.js`, `src/scripts/tournament-manage.js`, `src/_includes/tournament/entrants.html`, `src/scripts/tournament-nav.js`, `src/tournaments/bracket/index.html`, `src/tournaments/poster/index.html`; `docs/systems/tournaments.md`, `docs/systems/file-map.md`, `docs/STATUS.md` (4do).

## 2026-11-24 — The admin pages split, one job each
*Decided by UV:* league and tournament admin pages split into separate pages so everything is easier to manage from a phone and a setting is quick to reach: **generate the draw separate from running it, Who runs it its own page, almost every major settings section its own page.** UV approved Claude's proposed split (tournaments: Generate the draw, Run the draw · Entrants, Who runs it · Details, Format, Entries, Match rules, Poster settings; leagues: Make the schedule, Run the schedule · Overview, Players, Teams and payment, Teams, Who runs it, Entry · League, Season, Match rules, Standings, New season) and answered the four questions: **Manage's menu in headed groups**; **three league people pages** (Players · Teams and payment · Teams); **Generate the draw shows the draw read-only under its controls**; **the league's Ready to begin? on an Overview page of its own, first in the menu**.
*Claude's, for UV to correct:* every new page shows its part of the panel that already existed, the scripts unchanged except the draw's (a third state, generating: the Generate group over a read-only draw, whose writes still move people up as Run the draw's do); each settings page keeps the one Save, which still sends the whole form; the key `settings` stays on Details so old links open; the Generate group always open on its page; Poster settings keeps its name and goes under Settings.
*Example:* at the desk Basil opens Manage › Entries on his phone, sets the fee to 25 and saves, without scrolling past the name, picture, format and ruleset. Then Manage › Generate the draw, Generate, and the draw appears under the button as players will see it; Manage › Run the draw for the drag and the crosses.
*Touches:* `src/scripts/tournament-nav.js`, `src/scripts/tournament-bracket.js`, `src/scripts/tournament-settings.js`, `src/scripts/tournament-new.js`, `src/_includes/tournament/{draw,entrants,settings}.html`, `src/stylesheets/global.css`, `src/stylesheets/league.css`; `docs/systems/tournaments.md`, `docs/systems/file-map.md`, `docs/ui-list.md`, `docs/STATUS.md`.
*Leagues, built the same day. Decided by UV afterwards:* **Make the schedule shows the fixtures in the player's view under its controls** (as Generate the draw), and **a new league opens on Overview** (Claude had built Players).
*Claude's, for UV to correct:* Run the schedule keeps Add a fixture (it adds to the night chosen in the planner); the old keys open the first page of each (`manage` Overview, `schedule` Run the schedule, `settings` League); the Save warning ("applies to every match not started") shows with the Save on League, Season and Match rules, since every save re-freezes the rules; the Settings pages' heading is the league's name with the page's name under it.
*Touches (leagues):* `src/scripts/league-nav.js`, `src/scripts/league-fixtures.js`, `src/scripts/league-settings.js`, `src/scripts/league-new.js`, `src/scripts/league-standings.js`, `src/_includes/league/{fixtures,manage,settings}.html`; `docs/systems/leagues.md`.

## 2026-11-24 — The poster: Confirmed and Interested apart, with pictures
*Decided by UV* (`docs/ui-list.md` item 8): on the poster, **Confirmed and Interested are separate lists, Confirmed first, Interested collapsible and collapsed by default, the numbers moved below both.** Also that entrants show their pictures, as the director does. **Existing posters are rebuilt** in the migration, rather than waiting for a regenerate.
*Claude's, for UV to correct:* the statuses and pictures sit beside the names in the snapshot (version 4) rather than replacing them, so the designer text is unchanged; the Interested heading is the site's fold (a `set-group`) centred like Confirmed's, with the arrow after its words; an empty list is hidden; a poster with names but no statuses is reported as an error, not shown as one list; the number tiles are unchanged (Confirmed and Interested still among them).
*Example:* Friday 9-Ball's poster: Confirmed 12 with faces, then "Interested 3" folded; a tap shows the three; then the tiles.
*Touches:* migration `20261124183008_poster_entrant_status.sql`; tests `101_poster_entrant_status` (new), `099` and `100` (version check); `src/tournaments/poster/index.html`, `src/scripts/tournament-poster.js`, `src/stylesheets/poster.css`; `docs/systems/tournaments.md`, `docs/ui-list.md`, `docs/STATUS.md` (4dp).
*Later the same day, decided by UV:* **the draw cards show each side's picture too** (snapshot version 5, migration `20261124184220_poster_draw_pictures`; test `102`).

## 2026-11-24 — A table banner fits the card's margin
*Decided by UV* (`docs/ui-list.md` item 9): where a page has a banner at the top, **its table fits the margin set for all other content on the card, measured from the pockets' outer edges (not the cushions)**, and **the top and side margins are equal**. This reverses 14 Nov's "let the new banner edge extend into that margin space".
*Claude's, for UV to correct:* done in `banner-table.js` for every table banner; the canvases are the banner's width, so the corner pockets' line and glow end at the content's edge; the top gap is made equal by pulling a banner that sits at the very top of its card up by the card's top padding less its side padding (12px on a phone, 24px wider); a banner lower down a page is not moved; under less motion (no table) nothing changes. **Found on a phone the same day (UV: "top and side margins are still different"):** `tableIn` moved both pairs of cushions together while fitting the corner pockets, so the sides with the middle pockets came in as far again as the corners needed of the other two, and the top pockets sat about 22px inside the banner while the side ones touched it. Each side now moves only while the corner hole still crosses it; measured at 360 and 390 (emulated phone), the pockets stop 4px inside the banner on all four sides. The banner is shorter by the same amount, its text nearer the top and bottom cushions.
*Example:* on a phone, the poster's top-left corner pocket sits 12px in from the card's left edge and 12px down from its top, and its left edge lines up with the left of the draw card below.
*Touches:* `src/scripts/banner-table.js`; `docs/ui.md`, `docs/systems/file-map.md`, `docs/ui-list.md`, `docs/STATUS.md` (4dp).

## 2026-11-24 — A banner's picture only as tall as the name
*Decided by UV* (`docs/ui-list.md` item 10): on **tournament and league banners** the picture fills only the row of the name, **as tall as the whole name (both lines when it wraps)**, to "relax the cramped text below the tournament and league names".
*Claude's, for UV to correct:* the venue's banner left as it was (not asked; offered); the lines under the name run the full width, under the picture too; the gap between picture and name kept at the banner's 16px; the empty shield's trophy at its usual size (a larger one was tried and broke the shadow; see the next entry).
*Example:* the poster on a phone: a small shield beside "FRIDAY NINE BALL", and "Single elimination" and the status badge starting at the banner's left edge under it.
*Touches:* `src/stylesheets/league-join.css`, `src/scripts/tdc.js`; `docs/ui.md`, `docs/ui-list.md`.

## 2026-11-24 — A picture's shadow lighter and moving less
*Decided by UV:* "on pictures, let the shadow be less severe and let it move less than the other shadows on the page", after the banner's name-sized shield showed its shadow "glitching" with "the shadow line in the middle of the image rather than the edges of the frame".
*The glitch was Claude's:* a rule making the empty shield's trophy larger (`.lj-pic-inner svg`, 70%) also resized the two shade layers, which are SVGs, so the shade's edge was drawn across the picture. Removed (the trophy is its usual size).
*Claude's, for UV to correct:* site-wide; half the move everywhere (round pictures' insets at half offsets and blur, shields and hexagons `--shade-move` halved); drawn at 0.6 (`--pic-shade-strength`); the banner's name-sized picture moves a quarter of the big one's again (0.125), its blur with it.
*Touches:* `src/stylesheets/variables.css`, `src/stylesheets/design.css`, `src/stylesheets/league-join.css`; `docs/ui.md`, `docs/ui-list.md` (item 12).

## 2026-11-24 — A venue's picture wherever a venue is shown
*Decided by UV* (`docs/ui-list.md` item 11): wherever a venue is shown, its picture with it; **a small circle the height of the text, before the name, as a player's picture**; **no picture, the map pin** as the venue card shows. Then "finish all here".
*Claude's, for UV to correct:* the three venue-list helpers carry `picture_path` (every list and banner, signed-out reads included: a path into a public bucket); the shop's two functions `venue_picture_path`; every poster rebuilt; a picture that will not load shows the pin and logs `[Venues]`; drawn in the league and tournament cards, the match page (context line, banner, details), the player profile, the venue picker's pills and results, the profile's credits and orders, the menu's credits and the shop; drop-down options (profile, credits card) stay text, since an `<option>` cannot hold a picture; the circle takes the picture shadow (item 12).
*Touches:* migration `20261124190347_venue_pictures_in_lists.sql`; test `103_venue_pictures_in_lists`; `src/scripts/tdc.js`, `leagues.js`, `tournaments.js`, `match.js`, `player.js`, `venue-picker.js`, `profile.js`, `nav.js`, `shop.js`, `shop-order.js`; `src/stylesheets/design.css`; `docs/ui.md`, `docs/ui-list.md`, `docs/systems/foundations.md`, `docs/systems/tournaments.md`, `docs/STATUS.md` (4dq).

## 2026-11-24 — Lines under the poster's entrant sections
*Decided by UV* (`docs/ui-list.md` item 14): line separators under Confirmed and Interested, and consistent margins below both.
*Claude's, for UV to correct:* the site's hairline; 16px above and below each line, open or folded; rows spaced by a see-through border so the gap holds in every column layout.
*Touches:* `src/stylesheets/poster.css`; `docs/ui-list.md`, `docs/systems/tournaments.md`.

## 2026-11-24 — The poster is a live page
*Decided by UV*, after Basil's Friday Super Comp showed 13 entrants on the tournaments page and 12 on its poster (King registered interest 38 minutes after the poster was built): "The poster shouldn't actually just be a poster. It's meant to be active like the season page in leagues." Which parts go live: **"All"** (details, entrants, draw and results). A signed-out visitor: **"They see the poster. Anything else requires sign in."** Regenerate and the "made at" line: **"Live page"**, so both go.
*Reverses* 21 Oct, "The poster is a stored snapshot". **The safety reason is kept:** a stranger still reaches exactly one function, `tdc_tournament_poster`, and it still returns the one vetted shape built by `private.tdc_poster_snapshot`. That shape is now built when it is read rather than read from `tbl_tournament_posters.snapshot`, the way the season page's public reads work. The poster row stays as the sharing switch: no row, or a private one, still shows a stranger nothing.
*Rejected:* rebuilding the stored poster on every entrant change. It was built and tested first, at UV's choice, then dropped when UV asked for a live page; it would have left results and details stale.
*Claude's, for UV to correct:* the names and the draw are always in, so the two switches on Poster settings are gone; Generate shows only while a tournament has no poster yet, because sharing needs one to exist; the Text for a poster designer stays, written from the same live read; after entering on the poster the whole page is read again, so the new name and the counts appear at once. The page does not update by itself while open (no realtime): a stranger has no realtime access, and a reload shows the latest.
*Example:* King presses I'm interested on Basil's poster; his name appears under Interested and the count goes to 13 at once, and anyone who opens the link afterwards sees 13.
*Touches:* migration `20261124210356_poster_live.sql`; test `104_poster_live`; `src/scripts/tournament-poster.js`, `src/scripts/tournament-poster-settings.js`, `src/tournaments/poster/index.html`, `src/_includes/tournament/poster.html`; `docs/systems/tournaments.md`, `docs/STATUS.md` (4dr).

## 2026-11-25 — The shop: categories as cards, a product's own card
*Decided by UV:* the shop's categories are no longer tabs over one list. Each category is a card on the page; a tap opens its products in a sheet over the page, and a product opens its own card there to choose the quantity and add it to the cart. The cart stays a sheet over the foot of the screen, restyled with each line's picture. Inspired by a bike-shop app design UV shared. Do less and review: one product card for now, a card of its own per kind of product later.
*Why:* a group of options (several chalks) reads as one thing on the page and opens to its choices, rather than every option filling the list.
*Claude's, for UV to correct:* grouping uses the existing categories (the owner makes a "Chalk" category), so no database change; a category card shows its first product picture; a category with one product opens straight to that product's card; on a phone an odd number of categories makes the first card full width.
*Example:* Ann taps Pool accessories, sees Chalk (blue) and Chalk (green), taps the blue, sets 2 and taps Add to cart; the row shows 2, the card shows 2 and the cart bar reads "2 items · 40 credits".
*Reverses:* the category tabs of `docs/design/shop.md`, Stage 2.
*Touches:* `src/scripts/shop.js`, `src/stylesheets/shop.css`, `src/shop/index.html`, `src/stylesheets/variables.css`; `docs/systems/foundations.md`, "The shop: products and the cart"; `docs/ui.md`

## 2026-11-25 — Taom Chalk's card shows its 3D model
*Decided by UV:* Taom Chalk's product card shows UV's 3D model in place of its picture. Its textures are lowered to 512px to keep the file small (6.6 MB down to 716 KB), the geometry left as it is. A drag turns it and it never pans. It is lit by the site's own light, from where that light is, a little toward the camera so the front is lit, moving with it; and it floats above the card, casting its shadow down onto the page away from the light. Brighter overall, since it looked dark.
*Why:* a product you can turn in your hand sells better than a flat picture, and the light and shadow make it part of the page rather than a window onto another scene.
*Agreed by UV ("Go") on Claude's recommendation:* the model is linked to the product by its id in `scripts/shop.js`, with no database field for now (an owner upload is `docs/BACKLOG.md` §2 item 14); the viewer library is a pinned copy served from our own site, not a CDN.
*Claude's, for UV to correct:* Google's `<model-viewer>` as the viewer; the light done by turning a drawn picture of a room (the viewer has no lamps); the lamp, room and exposure values; the shadow's distance (2.5 times a card's), blur and darkness; the viewer's hand prompt left on.
*Example:* with the page's light drifting to the top left, the left of the TAOM logo and the lid are the bright parts and the shadow falls down and to the right on the card; turn the chalk round and the light stays top left on screen.
*Touches:* `src/scripts/shop.js`, `src/stylesheets/shop.css`, `src/stylesheets/variables.css`, `.eleventy.js`, `package.json`, `src/resources/models/`; `docs/systems/foundations.md`, "A product's 3D model"

## 2026-11-25 — Taom Chalk's model: smaller, and turning until touched
*Decided by UV:* the model sits 10% smaller in its box than the viewer's own fit. By default it turns very slowly in a random direction until touched, then stays still.
*Why:* the movement shows at a glance that it is a 3D model you can turn, and stopping at the first touch hands it over to the person.
*Claude's, for UV to correct:* "very slowly" is 12° a second (a whole turn in 30 s); a new random direction each time the card opens; no turning with less motion, as with the site's other motion; the model turns rather than the camera, so the site's light stays where it is on the screen.
*Example:* Ann opens Taom Chalk: it drifts round, tipping its lid toward her; she puts a finger on it and it stops there, and from then on it moves only when she drags.
*Touches:* `src/scripts/shop.js`; `docs/systems/foundations.md`, "A product's 3D model"

## 2026-11-25 — Cards over the page move: rise, sink, slide, grow; Back on every screen
*Decided by UV:* a card over the page rises from the foot as it opens and sinks as it closes. Going between its screens, the content slides across and the card grows or shrinks to the new screen. This applies to every such card: the product sheet, the cart and the Add credits card. The product sheet has Back on every screen. On a product it goes to the category's list; on the list (or a category's only product) it closes the sheet, back to the category cards on the page.
*Why:* the motion shows where you are going and where you came from, so moving back and forth through categories and products reads as one path rather than a page that blinks.
*Claude's, for UV to correct:* going on slides in from the right and going back from the left; 0.35 s for both the rise and the slide (`--cc-rise`, `--cc-turn`), in the site's usual easing; the dim behind fades with the card; the cart also grows or shrinks when a line or note changes, and the Add credits card when a code is paid; with less motion everything simply happens; the order card and the staff queue's sheet (the same card look) are not changed.
*Example:* Ann taps Apparel: the sheet rises with its two products. She taps Versus Socks: the list slides off left as the socks' card slides in from the right and the sheet grows to fit. Back slides the list in from the left and the sheet shrinks; Back again and the sheet sinks away.
*Touches:* `src/scripts/tdc.js` (`TDC.cardOpen`, `cardClose`, `cardTurn`, `cardResize`), `src/scripts/shop.js`, `src/scripts/credits-card.js`, `src/stylesheets/variables.css`; `docs/systems/foundations.md`, "The shop: products and the cart"; `docs/ui.md`

## 2026-11-25 — Summer Singles' 23 Nov night from paper

*Decided by UV:*
- **The 15 matches played on paper on 23 Nov go into Summer Singles as that night's fixtures, and only those.** The rest of the season is generated later, by a way still to be built. Rejected for now: generating the season first.
- **One import.** Rejected: the three matches whose players were ready first, the rest later.
- **Players without an account go in as league placeholders and link on sign-up, as they did for 8-Ball Mainstream** (DECISIONS 11 and 16 Nov), so the import does not wait on anybody signing up. Shane Pillay and Brandon Reddy are their existing placeholder records, never new ones.
- **A score stands as it was when the session ended**, so a match may finish under the race (3–4, 4–3) or level (4–4, a draw for both).
- **The season starts on 23 Nov**, not 30 Nov.
- **The players are notified as usual**: "Your scorecard was changed", once per match each, which leads them to agree their card. Rejected: removing those notifications after the import.
- The sheets' readings, each settled by UV on 25 Nov: the names (the "K…" on Basil's sheet is Enver, "Prav…" is Pranesh, the night photo is Thai v Kat, "Juls" is Julian Narsamoolu, "Kat" is Katterpilla); Kat 5–1 Teegan and Teegan 5–2 MZ; Aldrin v Luke's order; every match's lag winner; "Apple" means a break-and-finish, and only three stand (Alonso f1 and Brandon f4 against each other, Luke f4 against Brandon).

*Why:* the night was played before the season had fixtures, and the frames are the record (CLAUDE.md §5.1), so they go in frame by frame, not as a typed-in score.
*Claude's, for UV to correct:*
- The import calls the pages' own functions, acting as Yuvan as league director, rather than writing rows. Each card is submitted by the director: it counts at once and settles as any singles result does.
- 19:00 as the night's time; the missing frame of Kat v Teegan and of MZ v Teegan put last; a tick in the shared Lag column read as the left-hand player (#9, #11, #12).
- `private.tdc_import_singles_night` is kept, for the test and a later paper night.
- The five new placeholders' names, taken from their emails: Luke Pillay, Sharm Chetty, Teegan Govindasamy, Enver Joel, and Pranesh with no surname.*Found:* Claude first planned to wait for every player to sign up, having missed the placeholder decisions of 11 and 16 Nov; UV caught it.

*Example:* Brandon v Luke on 23 Nov, Brandon won the lag: 8 frames, Brandon breaking 1, 3, 5, 7 and Luke 2, 4, 6, 8, Luke's frame 4 a break-and-finish. It ends 4–4 and both players' Standings show a draw.
*So:* migration `20261125120918_summer_singles_23_nov`, test `105_import_singles_night`; `docs/systems/leagues.md`; `docs/STATUS.md` §1 4du and §4.

## 2026-11-25 — Recurring tournaments

*Decided by UV:*
- **A tournament can be marked recurring, as a league runs season after season.** The next one carries every current setting and starts with a fresh set of players. Other features (anything counting across all of a series' tournaments) follow later; how the ids are managed is open, so long as those can be built.
- **The director makes the next one** (Manage › Next tournament), as a league's New season. Rejected: made automatically when one finishes, or weekly.
- **Its start is typed by the director**, blank each time. Rejected: a week on, filled in.
- **Everybody who runs it is carried** (director, referees, scorers); whoever makes it is a director too.
- **History is a button in the tournament's bottom bar**, on a recurring tournament only, for anybody who can see the Draw (signed in). It lists every other tournament of the series, unfinished ones too, newest first, with the winner and runner-up of a finished one.
- Recurring is switched on Settings › Details only, for now (not on the create page).
- Not carried: the director's notes and the short link (each tournament gets its own). The picture is copied as a new file into the new tournament's folder.
- History is hidden from a signed-out visitor on the poster.

*Why:* club nights repeat with the same settings and the same people running them; setting a tournament up again each week is work, and a series needs one place to look back on who won.
*Claude's, for UV to correct:*
- **The series is a shared id** (`tbl_tournaments.series_id`, the first tournament's own id), not a parent table, as `team_lineage_id` links a team's seasons. Anything across the series reads `where series_id = …`; the id can become a foreign key to a series row later without moving data.
- Turning Recurring off keeps the series id, so turning it on again rejoins the same history.
- `sanctioned` is not carried: a sanction is granted to one event by somebody else.
- The venue a tournament belongs to is carried only for that venue's owner or admin, as on create (17 Nov).
- The switch saves the moment it is ticked, as the picture does, so the one Save is untouched.
- A History card opens the poster for one not started when its poster can be opened, the draw otherwise (the rule of 5 Nov). The History icon: a clock face whose rim is an arrow turning back.
*Example:* Basil's Friday Super Comp on 27 Nov is marked recurring. On Saturday Basil opens Manage › Next tournament, types 4 Dec 19:00 and presses Create: a new Friday Comp opens on Entrants with nobody in it, the same race, fee, poster and referees. Its History shows 27 Nov: Ann won, Ben runner-up.
*So:* migration `20261125130921_recurring_tournaments`, test `106_recurring_tournaments`; `docs/systems/tournaments.md`, "Recurring tournaments"; `docs/STATUS.md` §1 4dv.

## 2026-11-25 — The Entrants list in the league's look
*Decided by UV:*
- A tournament's Entrants list is **split by status**: Confirmed, then Interested, then Withdrawn, each a league heading with its count (as the poster). Rejected: one list in seed order, as before.
- **A row is the league's Asked to join row**: picture, name, full name and Walk-in under it. Rejected: a one-line row opening a card with the controls (a paid tick would take two taps at the bar).
- **Two lines**: Remove beside the name, then the seed, the status and the paid tick with its time. **Compact, as the league's own small controls**: 36px pills, the status a filter pill. Rejected: the site's standard 52px controls on two lines of their own.
- On a narrow phone **the paid tick and its time drop to a line of their own**. Rejected: moving the time into the line under the name.
- The heading stays **the tournament's name**. Rejected: the page's name with the tournament under it, as Details.
- **Who runs it** gets the same rows.

*Why:* six columns in a phone's width cut the status to "C" and pushed Remove off the edge; the league's public pages are the site's settled look for lists of people.
*Claude's, for UV to correct:*
- The status pill shows the value alone ("Confirmed ▾"), no grey "Status" inside, as in the preview UV chose.
- On a PC the panel's columns are at least 24rem (two at 1440), as the league's match results; the league's 16rem gave four squeezed columns.
- The new rules are named in the league's `ls-` family in league.css, for the league Manage pages to use.
*Example:* Kay, confirmed and paid yesterday. Her row reads "K · Kay / Kayleigh Abrahams · [Remove]", then "‹ 4 › · Confirmed ▾", then "✓ Paid Yesterday 15:28" on its own line on a phone, or on the same line on a PC.
*So:* `docs/systems/tournaments.md`, "The Entrants and Who runs it lists in the league's look"; `docs/ui-list.md` item 16; `docs/STATUS.md` §1 4dw.

## 2026-11-25 — The scorecard says who changed a frame
*Decided by UV:* a frame with an open discrepancy (the blue on the league scorecard) gets **a line under it saying who made the change, for everybody**: "Changed by Sipho Dlamini". **Whoever has the blue tick** on that frame also reads "· tap the blue tick to accept". This replaces 17 Nov's "No special messages or text" for this one line; the glow, the tick and the changelog stay as they were. Rejected: showing the line only to those who can accept; a longer wording naming the lag or the result ("Sipho Dlamini changed the result. Tap the blue tick to accept.").
*Claude's, for UV to correct:* the line is small, centred across the row, in the discrepancy's blue. Two people changing one frame read "Changed by A and B". The completed card's session tables carry no line, as nothing changes once the night is locked.
*Example:* Thabo enters that he won frame 3; Sipho, the away captain, sets it to Sipho. Everybody sees "Changed by Sipho Dlamini" under frame 3; Thabo, his captain and the league director see "Changed by Sipho Dlamini · tap the blue tick to accept".
*So:* no database change (`tdc_card_discrepancies` already names the changer). `src/scripts/league-card.js` (`changeNote`, `rosterName`), `src/stylesheets/league.css` (`.cs-change-note`); `docs/systems/leagues.md`, "Discrepancies".

## 2026-11-25 — A star on every team's card

*Decided by UV:* each team's card on the Season tab shows a star under its players, **the league star players already get, drawn from the team's frames**, and **every star has the league's average** (the yellow line). In a singles league **each player's card shows that player's star**.

*Chosen by UV from Claude's options:* in singles the player's card **folds open as a team's does** to show the star (rejected: a tiny shape-only star in the closed card; a list of stars under the cards); the stars are **for people signed in only**, as the standards and the league's average (rejected: public, which would make a singles player's stats public); a team's star is **as solid as the team's matches played ÷ scheduled** (rejected: always solid).

*Claude's, not asked:* the team star counts every frame the team's side played, whoever played it, reserves included; the win standard is 50 in a team league (as the player's league star there) and the player star's in singles; signed out, a singles card keeps its tap to the profile, since it has no star to open to.

*Example:* Knights in 8-Ball Mainstream, after 6 of 22 nights: 99 of 150 frames won, so Win % reads `66% | 50%`; W | Own Brk `73% | 58%`; the star about a quarter solid (6 ÷ 22).

*So:* migration `20261125145821_team_star_counts` (`tdc_team_star_counts`), test `107`; `league-season.js` (`teamStar`, `playerCard`), `league-join.css` (`.lj-team-star`), `leagues/season/index.html` (loads `player-star.js` and `.css`); `docs/systems/leagues.md`, "Every team's star on its card".

## 2026-11-27 — 8-Ball Mainstream's round 7 (25 Nov) from CueScore

*Decided by UV:*
- **Trust CueScore.** The four nights not finished on the site go in from UV's CueScore screenshots, frame by frame: The Ultimates v Cheeky Tiger, Team Optimus v The Apprentices, Wu Tang Clan v Foul Play Syndicate, BSC Travelers v The Underdogs.
- **RACK IT UP v Streetwise Combo is left out;** UV gives its updates by hand. It was started on the site with a lineup that is not CueScore's.

*Claude's, for UV to correct:*
- Team Optimus v The Apprentices, started on the site, is filled where it stands rather than reset: its lineups and its 9 scored frames are CueScore's exactly, so the import keeps them and records the other 16, and stops if any of them differs.
- The import acts as the admin@ account, as on 19 Nov; it still runs the season, though its directors are now Rick Schoenlank and Nadeem Khan.

*Example:* Team Optimus v The Apprentices: frame 1 (Eric Hsueh broke, Annan Naidoo won) is on the site and on CueScore alike, so it is left; frame 10 (Eric Hsueh won the lag and the frame against Jay Pillay) is recorded from CueScore. The night ends 12 – 13.
*So:* `private-data/rivonia-8mtl-2026-27/` only (gitignored): `source/cuescore-2026-11-25.txt`, `build_2026_11_25.py`, `import-2026-11-25-template.sql`, `import-2026-11-25.sql`, `local_test_2026_11_25.py`; `docs/STATUS.md` §1 R1.

*Decided by UV, later the same day (RACK IT UP v Streetwise Combo):* Manoj Ramjith did not play; Jason Govender played in his place, as CueScore has it. **The night is reset and imported from CueScore**, Streetwise's seats as played (six players, 8 seats off the sheet). Match 11: Ntokozo broke (CueScore), not Nishay (the site). Match 14 has no L on CueScore: Shivhay broke, as the site had it. Match 19 has no L: it goes in with no lag.
*Rejected:* keeping the 4 frames scored on the site and fixing the lineup by hand.
*So:* `private-data/rivonia-8mtl-2026-27/` only: `source/cuescore-2026-11-25-rackitup.txt`, `build_2026_11_25_rackitup.py`, `import-2026-11-25-rackitup-template.sql`, `import-2026-11-25-rackitup.sql`, `local_test_2026_11_25_rackitup.py`; `docs/STATUS.md` §1 R1.

## 2026-11-27 — Only owners create tournaments and leagues, for now

*Decided by UV:* for now, block creating tournaments and leagues on the site; only club owners and UV (the owner account, admin@thediveclub.org) may create them. **Temporary, and in the pages only.** A league's New season stays with whoever runs the league (Claude's reading: it is not a new league).
*Claude's, for UV to correct:* "club owner" means `owner` at any venue in `tbl_venue_staff`, which includes the owner account; a non-owner reaching a create page by its address sees "Creating … is limited to club owners for now." rather than being sent away.
*Rejected:* refusing in `tdc_create_tournament` / `tdc_create_league` (UV: "just disable in the UI for now").
*So:* `docs/systems/foundations.md`, "Only owners see Create, for now"; `docs/STATUS.md` §1 4ea, §5 "Who may create a league or a tournament".
*Touches:* `src/scripts/tdc.js`, `tournaments.js`, `leagues.js`, `tournament-new.js`, `league-new.js`, `src/tournaments/index.html`, `src/leagues/index.html`

## 2026-11-27 — Tournament entrants as placeholders, not walk-ins with an email

*Decided by UV:* walk-ins added from Entrants with a unique email are **dropped**: telling a director whether an email is registered breaks earlier decisions on data integrity. Walk-ins stay as they are. Instead, **tournament placeholders**, after how Basil and Rick run nights now (a WhatsApp list pasted into Challonge): a director enters a list of names; each is a placeholder with no account and no future connection, **unless the director connects it to an account**. The site shows accounts that may fit a placeholder's name and the director connects or not, so a player may also play anonymously. A placeholder is awarded nothing unless connected. Connecting is allowed **during play too**. A regular without an account is a new placeholder each time.
*Decided by UV, later the same day:* **a placeholder is a walk-in**: "we are just updating the existing functionality". Connecting moves the frames to the account, as the walk-in merge does today; **the account's owner is asked and must accept**; the list box goes anywhere on Entrants for now (the settings pages are to be overhauled).
*So:* `docs/STATUS.md` §2, "Tournament clean-up for Basil and Rick".

## 2026-11-27 — Removing an entrant who has played

*Decided by UV:* fix B6 ("fix it"): removing a player must not wipe their bracket history.
*Claude's, for UV to correct:* "has played" means on a fixture with a match (started or played) or awarded a fixture; such an entrant is marked withdrawn and kept, anybody else is deleted as before, an unstarted round-1 slot included; the page says which happened.
*Rejected:* refusing outright (B6's other option), which would leave the director with no way to take them out.
*So:* `docs/systems/tournaments.md`, "Removing an entrant who has played"; `docs/STATUS.md` §1 4eb.
*Touches:* migration `20261127135138_remove_entrant_who_played.sql`, `supabase/tests/109_remove_entrant_who_played.test.sql`, `src/scripts/tournament-manage.js`

## 2026-11-27 — Private columns hidden from direct reads; full names stay readable

*Decided by UV:* fix B2 ("I thought we accounted for this already?": the 21 Oct gate closed the function, not the table). **Players' full names stay readable to signed-in players (option A)**: the site shows them by design, so hiding them from direct reads would protect nothing.
*Claude's, for UV to correct:* hidden column by column rather than closing the tables (no page needed changing); the private columns are paid and notes on tournament entrants, the notes on tournaments, tournament fixtures, leagues, league seasons and league fixtures, a dispute's note and an override's reason.
*Rejected:* B (full names private to the player, staff and their directors), a redesign across many pages.
*So:* `docs/systems/foundations.md`, "Private columns"; `docs/STATUS.md` §1 4ec.
*Touches:* migration `20261127144020_hide_private_columns.sql`, `supabase/tests/110_hide_private_columns.test.sql`

## 2026-11-27 — Wallpapers: the table on a TV, opened by a short link

*Decided by UV:* a wallpaper page that is the home page's table with the markings, the person's pictures looping in the middle (the logo when there are none; where pictures replace it, the nav icon stays where it sits in the bar, the same size, showing when the bar hides), an auto-hiding bar, filling the screen with no adjustment. The upload page and the wallpaper are separate pages; only somebody signed in may upload, anybody opens it by its short link with no sign-in (aimed at TVs). One wallpaper per person, at most 8 pictures. Each picture has a simple option for how it is shown, previewed on a table outline; people edit their pictures to suit. Animation options for the change between pictures. Colours: cloth, table markings, lines, white ball. A live preview of the wallpaper on the upload page, the table as the banners show it. Built as sandbox pages first, added to the main site afterwards.
*Claude's, for UV to correct:* the fits are three (`fit`: the whole picture in the middle; `fill`: the middle filled, cropped; `cloth`: the whole cloth filled); the changes are fade, slide, zoom and cut, with seconds per picture (3 to 300, 10 by default); the code is random and cannot be chosen; the table references the account, not the player; the pictures shrink to 1920px; `W-` wins over a player whose first name is the single letter W.
*So:* `docs/systems/foundations.md`, "Wallpapers"; `docs/STATUS.md` §2.
*Touches:* migration `20261127154632_wallpapers.sql`, `supabase/tests/112_wallpapers.test.sql`, `supabase/tests/069_league_public_reads.test.sql` (the stranger's list)

## 2026-11-27 — The draw's Rounds view

*Decided by UV:* the draw page gets a toggle at the top, **Bracket · Rounds**, for directors, players and the public. **Rounds** shows each round like a session of the league scorecard, compact for a phone; every match carries a **score** (number steppers, not a win toggle; "TDs don't watch matches to enter scores. Players keep track themselves and report the score at the end"), **saved on every press**; typing a number and pressing Enter goes straight to the other score of that match. The **lag** appears only when the match setting for who breaks is on; deeper break detail stays on the scorecard. Controls at the top of each round for its match and round settings; a match's other buttons stay as they are for now. **A player goes through automatically only once the director has entered both scores**: one score changed and the other left alone pushes nobody.
*Claude's, for UV to correct:* the score is the director's score (`tdc_set_match_override`) with the reason "Entered on the draw"; a score is a draft (published_at null) until both boxes have been changed on this visit, then final, which publishes and ends the match as Publish does; Enter score and moving a player through keep publishing at once; changing one score of a published match takes it back until the second is entered or Publish is pressed; after a reload both boxes count as untouched again; Publish publishes a draft even on a match approved before; a round is open while it holds a match still to play; the top of a round holds Rules (the round's match rules) and + Match; Generate the draw always shows the bracket; the list is not redrawn while a score is being entered; a tap on a score's pill focuses its number; the lag is greyed once the result is published (the database refuses it then) and cannot be cleared (as on the match page).
*Rejected:* +/− buttons recording frames (UV: TDs report the score at the end, they do not count frames); saving only when the director leaves a match's boxes (Claude's alternative, before UV's rule).
*So:* `docs/systems/tournaments.md`, "Bracket · Rounds"; `docs/STATUS.md` §1 4ed.
*Touches:* migrations `20261127153139_draw_lag.sql`, `20261127154848_draft_scores.sql`, `supabase/tests/111_draw_lag.test.sql`, `supabase/tests/113_draft_scores.test.sql`, `src/_includes/tournament/draw.html`, `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`

## 2026-11-27 — Wallpapers: the pages (steps 2 and 3)

*Decided by UV:* pictures for a TV kept at high quality ("maybe only shrink to 720p"); built at 1920px on the longer side, above that.
*Claude's, for UV to correct:* the bar hides after 4 seconds with nothing done; the Get the app and linked-record banners are not shown on the wallpaper (they would sit over the table for good); the preview is 16:9; pictures are uploaded only on Save, not when chosen; quality 0.9; the TV reads the wallpaper when it opens, not again; `hero.js` reads its colours inside its stage so a page can colour one table without the rest of the page.
*So:* `docs/systems/foundations.md`, "Wallpapers"; `docs/STATUS.md` §1 4ee.
*Touches:* `src/sandbox/wallpaper/`, `scripts/wallpaper.js`, `wallpaper-edit.js`, `wallpaper-show.js`, `stylesheets/wallpaper.css`, `scripts/hero.js`, `scripts/tdc.js`

## 2026-11-27 — Wallpapers: smooth shadows, and the icon on the cloth

*Decided by UV:* the shadows flickered as the light moved; worth spending a little on this page, "nothing crazy". The icon moves a bit down, onto the cloth rather than the table line.
*Claude's, for UV to correct:* the table's shadows follow every change of the light on the wallpaper and its preview only (about 15 redraws a second instead of 5; other pages keep 200 ms); the icon's top sits one ball below the top cushion's line.
*So:* `docs/systems/foundations.md`, "Wallpapers".
*Touches:* `scripts/hero.js` (`data-light-ms`), `scripts/wallpaper-show.js`, `stylesheets/wallpaper.css`, both wallpaper pages

## 2026-11-27 — Rounds is the draw's default view

*Decided by UV:* "Let the rounds be the default view for tournaments." The draw opens on Rounds for everybody (director, player, public) on Draw and Run the draw; Bracket is a tap away and is remembered on a device where it was chosen. Generate the draw still shows the bracket.
*So:* `docs/systems/tournaments.md`, "Bracket · Rounds".
*Touches:* `src/scripts/tournament-bracket.js`, `src/_includes/tournament/draw.html`

## 2026-11-27 — The draw follows the confirmed players

*Decided by UV:* "I need the draw to update automatically, as confirmed players come in", only confirmed players, and applied to the tournament already drawn (Basil's Friday Super Comp). A newly confirmed player takes **the first open place**; a full draw **grows by itself** to the next size (UV chose this over flagging it for a Redraw, knowing a shuffle or hand changes are lost); a player who withdraws or goes back to Interested **comes out**, their opponent getting a bye again; all of it **until play starts**.
*Claude's, for UV to correct:* "play has started" is a frame, a director's score, a finished or abandoned match, or a walkover, withdrawal or decision (a match made but not played is not play); an unplayed match whose players change is deleted and recorded, as the shuffle does; the earliest entered goes first when several arrive at once; the draw never shrinks; a failure fails the change that caused it; the one place deciding who runs a competition also says yes while the database itself is following that tournament (a transaction-local marker nothing in the API can set), rather than copying five draw functions; two older tests changed their setup, not their checks.
*Rejected:* leaving a full draw for the director to Redraw (Claude's recommendation); a random open place (as Fill does); stopping at the shuffle.
*Open:* players cannot enter themselves once a draw exists (`docs/STATUS.md` §5).
*So:* `docs/systems/tournaments.md`, "The draw follows the confirmed players"; `docs/STATUS.md` §1 4ee.
*Touches:* migration `20261127175438_draw_follows_entrants.sql`, `supabase/tests/114_draw_follows_entrants.test.sql`, `supabase/tests/109_remove_entrant_who_played.test.sql`, `supabase/tests/051_populate_shuffle_draw.test.sql`, `src/_includes/tournament/draw.html`

## 2026-11-27 — Start round; the match buttons in the middle; the bracket's view settings folded and fitted

*Decided by UV:* a **Start round** button at the top of the first round to start all its matches at once; each match's buttons **smaller, above the toggles, between the names**, not a row of their own; the bracket's view controls a **folding group, closed by default**; the bracket **fitted to the screen when it opens**.
*Claude's, for UV to correct:* Start round asks first (each start messages both players) and shows only while a match is ready; a walkover button reads ← W/O / W/O → with the name in its title; the badges keep their row; "View settings" is closed on every visit, not remembered; full screen opens the group for its bar and puts it back after; the bracket fits on the page's first bracket and on choosing Bracket, not on live updates, and scrolls to the draw as the Fit button does.
*So:* `docs/systems/tournaments.md`, "Start round, the match buttons in the middle, the bracket's view settings folded and fitted".
*Touches:* `src/scripts/tournament-bracket.js`, `src/_includes/tournament/draw.html`, `src/stylesheets/bracket.css`

## 2026-11-27 — The draw open to the public

*Decided by UV:* "the bracket view opened to the public, autosized to fit."
*Claude's, for UV to correct:* only tournaments set Visible to public; no full names, surnames or override reasons signed out; signed out opens on Bracket unless the device chose Rounds; a tournament not public still asks the visitor to sign in.
*So:* `docs/systems/tournaments.md`, "The draw open to the public".
*Touches:* migration `20261127181750_public_draw.sql`, `supabase/tests/115_public_draw.test.sql`, `059_venues_shown`, `069_league_public_reads`, `src/scripts/tournament-bracket.js`

## 2026-11-27 — The draw stops following once a match is started; it never grows by itself

*Decided by UV* (during Basil's comp): "Matches that are started should not be changed now. I need to add a player in a specific spot and now it's force redrawing all players." **This reverses** two parts of "The draw follows the confirmed players" the same evening: a full draw no longer grows by itself (the player waits for the director), and following stops at the first started match rather than the first played one.
*So:* `docs/systems/tournaments.md`, "The draw stops following once a match is started…".
*Touches:* migration `20261127185136_draw_follow_stops_at_start.sql`, `supabase/tests/114_draw_follows_entrants.test.sql`, `src/_includes/tournament/draw.html`

## 2026-11-27 — The first round's byes hidden

*Decided by UV:* "In the first round, hide the byes" (a big draw showed a card per bye).
*Claude's, for UV to correct:* hidden in Rounds for everybody and in the Bracket for readers (the Draw tab, the public); Run the draw's bracket keeps them, since a bye's empty slot is where a late player is dropped.
*So:* `docs/systems/tournaments.md`, "The first round's byes hidden".
*Touches:* `src/scripts/tournament-bracket.js`

## 2026-11-27 — The bracket fills the screen; the first round lines up with where it leads

*Decided by UV:* on a wide screen the entire bracket readable with text as large as possible, using all the width and height, the arrows leading point to point.
*Claude's, for UV to correct:* Fit leaves room for the top and foot bars even when they have slid away; the room left after the text goes to the spacing; Space across up to 240px; the bracket's scroller uses the window's width less a 16px gutter; with first-round byes hidden, each first-round card sits beside the slot it feeds.
*So:* `docs/systems/tournaments.md`, "The bracket fits the whole screen, the arrows point to point".
*Touches:* `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`, `src/_includes/tournament/draw.html`

## 2026-11-27 — Fit picks in order or outside in, whichever gives the larger text

*Decided by UV:* "see spacing and text size" (the fitted draw had small text and wide gaps between rounds, and a seam down each side).
*Claude's, for UV to correct:* Fit tries both flows and keeps the larger text, changing the flow toggle (until now Fit kept every toggle); leftover width no longer goes into the gaps between rounds; the card widens while the bracket shows rather than the bracket reaching out of it; a reader's column with nothing left after hiding byes is not drawn.
*So:* `docs/systems/tournaments.md`, "Fit picks the layout with the largest text…".
*Touches:* `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`

## 2026-11-27 — A score entered in Rounds moves nobody until it is locked

*Decided by UV:* "only auto move when TD locks the scorecard"; "changes should still be saved until lock". **Reverses** the same evening's "push a player through automatically when both scores are in": every change is saved as a draft, and only Publish / Lock it moves the winner on.
*So:* `docs/systems/tournaments.md`, "A score entered in Rounds moves nobody until the director locks it".
*Touches:* `src/scripts/tournament-bracket.js`

## 2026-11-27 — A draft score re-opens its match; Basil's matches all opened again

*Decided by UV:* "none of the matches are settled… no matches are complete. Open all again", keeping the current scores.
*Claude's, for UV to correct:* any score changed after a lock re-opens that match (unlocked, not ended) until it is locked again; on push, Basil's scores set by hand all become drafts, every match re-opens, and the draw is brought into line.
*So:* `docs/systems/tournaments.md`, "A draft score re-opens its match; Basil's opened again".
*Touches:* migration `20261127195047_draft_score_reopens.sql`, `supabase/tests/113_draft_scores.test.sql`

## 2026-11-27 — A match's buttons behind a ⋯; its status as its name's colour

*Decided by UV:* on Run the draw, a match's buttons behind a **⋯ that opens a pop-up with the score inputs, the lag and the buttons**; **every** button goes in it; the Rounds row **keeps** its steppers and lag; the ⋯ shows **only where there is something to offer**; **Rounds and Bracket** alike; the pop-up's scores **save as drafts on every press in both views** (the Bracket's Enter score form with its reason goes); **Publish stays visible beside the ⋯**, in **green text**, the dots **white**. **No status badges:** the match's label takes **the badge's own colour** (amber, red, grey), **for everybody**, in both views.
*Claude's, for UV to correct:* the pop-up is the site's card from the foot (the shop's and Add credits'); a button closes the card before it acts; Publish is in the card as well as beside the ⋯; on the Bracket a card that can be scored counts as having something to offer; where two statuses apply, red beats amber beats grey, and the words go in the label's tooltip and at the top of the card; the card is not redrawn while a score in it is being entered; Publish is green wherever it appears on the draw.
*Rejected:* each view keeping its own way to enter a score (Claude's alternative); badges for players and the public only on Draw.
*So:* `docs/systems/tournaments.md`, "A match's buttons behind a ⋯; its status as its name's colour"; `docs/ui-list.md` items 19 and 20; `docs/STATUS.md` §1 4eh.
*Touches:* `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`

## 2026-11-27 — A published match settled on the draw; no colon; unpublished scores yellow

*Decided by UV:* where a match is published, **hide the lag, hide the score steppers and grey out the loser**; the ⋯ card **keeps its steppers** for correcting (UV's choice) and hides the lag; **no colon between the players**; **unpublished scores in yellow**.
*Claude's, for UV to correct:* the loser greyed in both views and for everybody, the picture greyscale at 55%; "unpublished" is any match made and not published, a match being played at 0–0 included; on the bracket's side-by-side cards the colon's gap is kept, the ":" gone.
*So:* `docs/systems/tournaments.md`, "A published match settled on the draw…"; `docs/ui-list.md` items 21–23; `docs/STATUS.md` §1 4eh.
*Touches:* `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`

## 2026-11-27 — Publish only for a winning score; W/O on a started match; the public draw re-reads

*Decided by UV:* **Publish shows only when the score has a winner**; otherwise the walkover is used, so **a started match with no score offers W/O**; signed-out visitors' draws **re-read every 10 seconds** rather than a database broadcast.
*Claude's, for UV to correct:* Send back still shows on a 0-0 or level result; "no score" is no frames and no score set by hand; the empty match is deleted and recorded as the draw records an unplayed match, and the database does it in the same call as the walkover; no live feed is opened for a signed-out visitor.
*Rejected:* Publish on any non-0-0 score; W/O only before a match is started; a database broadcast to the public (Claude's alternative).
*So:* `docs/systems/tournaments.md`, "Publish only for a winning score…"; `docs/STATUS.md` §1 4ei.
*Touches:* migration `20261127214214_walkover_started_match.sql`, `supabase/tests/116_walkover_started_match.test.sql`, `src/scripts/tournament-bracket.js`

## 2026-11-28 — The draw's arrows: out from the separator or the winner, into the right player, smooth and heavier

*Decided by UV:* an arrow leaves a card **from the line between its players** by default, **from the winner's side once the match is complete**, and arrives **at the player it feeds**; the arrows **smooth** (UV's pick of "magnet or smooth", as Claude sketched them) and looking like arrows.
*Claude's, for UV to correct:* "complete" is any match with a winner (a published result or an award, a bye included); a loser_of arrow leaves from the loser's side; two players at one place along the edge share it at a third and two thirds of the pair; the line 2.25px and a barbed head about 14px, the curve's shape unchanged.
*Rejected:* elbowed ("magnet") connectors, tried the same day (UV: "worse than smooth").
*Then (UV, same day):* "forcing the curve to make sure the arrow meets the arrow head": the curve ends in a straight run into the head (Claude's: a head's length, at most three quarters of the gap); the S's control points scaled to the gap so it no longer bends into a squiggle. And "looser at the ends so the arrows look more natural": the handles 0.3 of the gap (Claude's number; 0.5 was the stiff S), one constant, `ARROW_LOOSE`. Then looser, 0.2 (UV, from the panel).
*Then (UV, same day):* in a gap too narrow for an arrow, "use top and bottom of cards where possible", the same for the outer cards, meeting "the center of the card": an arrow that leaves clear above or below the card it feeds hooks into the middle of that card's top or bottom edge. *Claude's:* "clear" is a head's length; the hook is a quarter turn with a straight run of a head's length into the edge; this replaces the open question of a minimum gap or a smaller head.
*So:* `docs/systems/tournaments.md`, "The arrows: out from the separator…".
*Touches:* `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`
*Then (UV, same day):* "try arc instead"; "wherever the top of one card overlaps the row of the previous card, use top and bottom always"; "use one style everywhere… I don't mind which you choose". Every arrow is quarter-ellipse arcs plus a straight run into the head: side to side as an arc S, a hook into the middle of a card's top or bottom edge where it leaves clear, and an over route (an arc S through the gap, then an arc in) where the edge is level with the leaving row. *Claude's:* arcs chosen as the one style; "level" is within one player row's height; the over route rises to three heads beyond the edge.
*Then (UV, same day):* grid arrows, on the picture and then the bracket ("lets go with grid on the bracket view as well"), replacing the arcs: straight runs with small rounded corners on the same three routes. *Claude's:* the corner radius 6px; a hook needs a head and a half of room, else the over route.

## 2026-11-28 — A picture of the bracket to share

*Decided by UV:* a **share icon at the top right of the bracket** exporting a **clean, high-quality image of the whole bracket**; **title, rounds, cards and arrows**; **for everybody who can see the bracket**; **shared on a phone, downloaded with a mouse**, as the scorecard; **the site's icon at the top right** of the picture; **grid arrows**.
*Claude's, for UV to correct:* drawn fresh on a canvas from the laid-out bracket (not a screenshot), so it follows the view settings; PNG at twice the screen's size or more, under 16 million pixels; the venue and date under the title; thediveclub.org small in the foot; the icon in a row of its own above the bracket, Bracket view only; a picture made too late for a phone waits for a second tap.
*So:* `docs/systems/tournaments.md`, "A picture of the bracket".
*Touches:* `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`, `src/_includes/tournament/draw.html`
*Then (UV, same day):* the cards "are round on mobile rather than cards with rounded corners"; the picture must "show well on portrait" and "you do not have to export the view that is being used. It must look good on mobile". *Claude's:* corners 0.8em (scale with the text); the picture always drawn from the default layout (rounds in order across, players stacked, pictures, 100%) as a player sees it, swapped in out of sight while measured; the title, icon, margins and address sized from the round headings.
*Then (UV, same day):* "the outside in view is better than the linear for output": the picture is drawn from the outside in. And "arrows behind cards where they overlap": the round's buttons and the + between rounds lifted above the arrows as the cards are.
*Then (UV, same day):* the picture follows the screen: portrait draws outside in from top and bottom to the centre, landscape from left and right; always outside in. *Claude's:* "portrait" is a window taller than wide.

## 2026-11-28 — The site's QR look
*Decided by UV* (chosen on `/sandbox/qr/`, built the same day for it): every QR the site shows (the Add credits card's and the order card's) has **round dots, rounded corner frames and centres, a 4-dot quiet zone and the app icon (`icon-primary.svg`) in the middle at 35% of the width, the dots behind it cleared**, **dark ink on the green paper** (`--qr-ink` #202020, `--qr-paper` #61ffad, the same in both themes), at **error level H**.
*Why:* UV's look. He first picked it inverted (green on dark) at level M; told that some older Android cameras cannot read an inverted code and that the icon covers about 14% of a code where M recovers about 15%, he chose dark on green and H (about 30%).
*Rejected:* green ink on dark paper; level M with the icon; the old plain square dots, dark on cream (Claude's, 24 Nov).
*So:* drawn once, `TDCCredits.qrSvg(link)` in `credits-card.js` (`QR_LOOK`); `shop-order.js` calls it. The links inside the codes are unchanged. `/sandbox/qr/` starts from this look.
*Example:* Ann's top-up card shows TXZ5 over a green square of round dark dots with the diver in the middle; Sipho's camera opens `/staff/top-ups/?code=TXZ5` as before.
*Touches:* `src/scripts/credits-card.js`, `src/scripts/shop-order.js`, `src/stylesheets/variables.css`, `src/stylesheets/credits-card.css`, `src/sandbox/qr/index.html`
*Then (UV, later the same day), final for now:* a **2-dot quiet zone** (was 4) and **round corner centres** (were rounded); the rest as above. In the sandbox's rectangle, the code fills the shorter side (480 × 264, centred), which a square card cannot show. `/sandbox/qr/` starts from these.

## 2026-11-28 — The home page shows your QR in the logo's place
*Decided by UV:* signed in, the home page's first screen shows **a QR of your player short link** (`thediveclub.org/Yuvan-Naidoo-2`, which opens your player page, not your account page) **where the logo was**, in the site's QR look, **on a square of the QR's green paper the logo's size** (the cloth's shorter side over 1.618; UV's choice of three, over a 480:264 card and one shaped like the cloth). **Signed out, the logo stays** (UV's choice of three).
*Replaces:* "The home page opens on the logo and the markings" (16 Nov), for a signed-in player only; the markings, the sizing and the Get the app card are unchanged.
*Claude's, for UV to correct:* a player with no short link (a first or last name not saved, so no link exists) keeps the logo, and the console says why, as the page has no way to make the link; the QR appears once the names are saved. The balls still roll over it, as over the logo (16 Nov); a trail across it may spoil one scan.
*Example:* Ann opens the home page signed in; a green square with her code sits on the cloth. Sipho points his camera at it, taps `thediveclub.org/Ann-Test`, and Ann's player page opens (signing in first if he isn't).
*Touches:* `src/index.html`, `src/scripts/home-cards.js` (`drawQr`)

## 2026-11-28 — The QR's logo, and its colours in the light theme
*Decided by UV:* the middle of every QR (the credits and order cards, the home page) is **the icon with the wordmark** (`logo-primary-light.svg`), not the app icon. **In the light theme the QR matches the theme: the cream paper (#f4e8d2) with grey dots**, the same light icon with wordmark; the dark theme keeps dark dots on the green.
*Claude's, for UV to correct:* the **light version** of the logo in the dark theme too (its dark lettering shows on the green; the dark version's green lettering barely does); the grey **#5c5c5c** (about 5.5:1 on the cream; the theme's `--text-muted`, #a3a3a3, is about 2:1). Every combination was decoded headless by ZXing; the weaker jsQR missed some, a phone has not been tried.
*Then (UV):* the balls rolling over the code stay: the 30% error correction covers them (headless, the 1280 home frame with two balls and a trail across it did not decode; the same frame without them did).
*Touches:* `src/scripts/credits-card.js` (`QR_LOOK.logo`), `src/stylesheets/variables.css` (`--qr-*` in the light theme), `src/sandbox/qr/index.html` (both logo versions; Logo margin)
*Then (UV, later the same day):* **the dark theme uses the dark version** of the icon with wordmark (Claude's light version reversed), each theme its own file; and **the dark theme's QR paper is the table markings' grey** (`--text-muted`, #808080, the colour `hero.js` draws the markings in; `--qr-paper: var(--text-muted)`, so it follows them), dark dots on it (about 4:1). The green paper is gone. The light theme is unchanged: grey dots #5c5c5c on the cream.
*Then (UV, later the same day):* **the site icon without the wordmark** in the middle, in both themes, each theme's own file (`logo-mark-dark.svg`, `logo-mark-light.svg`), replacing the icon with wordmark.
*Found (UV's iPhone, the same day):* a pale box round the diver, in both themes: WebKit draws the icon's blurred shadow (`filter59`) badly inside an SVG `<image>`. Reproduced in Playwright's WebKit; *Claude's fix, UV's files used as they are (UV):* the icon is an `<img>` laid over the code (`.tdc-qr`, `credits-card.css`), as the nav shows it, which draws cleanly. `/sandbox/qr/` still draws it inside its SVG, as its downloads need; its preview shows the box on an iPhone.
*Then (UV's iPhone, the same day):* the icon was gone from the home page's QR: the home page's own `.home-logo.has-qr img { display: none }`, which hides the logo when the QR shows, hid the QR's new `<img>` too. Narrowed to `> img`. Checked in WebKit as an iPhone 13, both themes, by looking at the picture (the earlier check only decoded the code, which scans without its icon).

## 2026-11-28 — A Scan button inside the app
*Decided by UV:* the site has its own QR scanner. **Scan a code** is in the menu for everyone, on every page, and **Scan** sits beside Find on the staff Top-ups and Orders pages. A Dive Club link it reads opens inside the app; the phone's own camera and typing the code still work.
*Replaces:* "The top-up QR is a link to the staff page" (24 Nov), its *Rejected* (a Scan button on the staff page), and the shop's "No scanner in the page". The QRs are unchanged: still links.
*Why:* on an iPhone the camera app opens a scanned link in Safari, which has its own sign-in apart from the installed app, so staff scanning at the bar would land signed out. Scanning from inside keeps them signed in. Asked first for the staff pages only, then (UV, the same day) "shouldn't the scanner be available all the time to everyone? like from the nav menu?": a player can scan a friend's home-page QR too.
*Claude's, for UV to correct:* the staff pages keep their own Scan as well as the menu's; the phone's built-in reader where there is one (Android), ZXing loaded on first use elsewhere (iPhone); the back camera; a camera problem is said inside the scanner sheet, which stays open, as the menu opens it on pages with no status line; the menu row sits under the page links and carries the line Get the app and Reload had.
*Example:* Sipho, signed in as staff in the installed app on his iPhone, opens the menu, taps Scan a code and points at Ann's top-up card; the phone buzzes and `/staff/top-ups/?code=TXZ5` opens in the app, still signed in, on "Ann Test · 250 · R250". Ann scans a friend's QR on the home page the same way and lands on his player page.
*Touches:* `src/scripts/qr-scan.js`, `src/stylesheets/qr-scan.css`, `src/_includes/layout.html`, `src/_includes/nav.html`, `src/scripts/nav.js`, `src/stylesheets/nav.css`, `src/scripts/ring-status.js`, `src/staff/top-ups/index.html`, `src/staff/orders/index.html`, `src/scripts/staff-top-ups.js`, `src/scripts/staff-orders.js`, `src/stylesheets/staff-top-ups.css`, `.eleventy.js`, `package.json`

## 2026-11-28 — The tournament follow page, for a TV at the venue
*Decided by UV:* a single page a TD puts on a TV and leaves for the night, "knowing that everything will just work" (`/tournaments/follow/?t=…`). It replaces leaving the public bracket open on a TV, as was done at Basil's on 27 Nov. **Signed in only** (TVs will sign in by QR code, built in another chat; access to every page to be reassessed with it). **Any signed-in account may open it and see the entrants** (UV, 28 Nov). **Optimised for every screen:** a square QR with the tournament's name above and its details below; wide, those on the left and the entrants (for now; the right-hand side will be refined) on the right; tall, the same stacked. **It starts with the QR for entry and changes by itself:** the bracket on the right **as soon as the draw exists** (UV, 28 Nov); once the tournament starts, the QR takes players to **their current match on this draw, otherwise the draw** (UV, 28 Nov), beside the full bracket. Leagues will get the same later, aimed at captains and players (scorecards, lineups).
*Claude's, for UV to correct:* "play has started" is any fixture with a match, any walkover, withdrawal or decision on the draw, or the tournament's status In play or Finished; the entry QR is the tournament's short link (strangers land on the poster, entrants on the draw, as short links already work); the words "Scan to enter" and "Scan for your match"; the page reads every 10 s, the bracket is the draw page itself in a frame (`&tv=1`: read-only even for the TD, no bars or settings, fitted again whenever the screen or the draw changes, read again every 30 s as well as live); the site's bar hides itself, as on the wallpaper; the screen is kept awake where the browser allows it, and where it refuses until touched (Safari) the page says to tap once and tries again on the tap; on a short screen the side's words shrink before the QR does; "Follow page (TV)" is last in the Draw group of Manage.
*Example:* Basil opens Manage › Follow page (TV) on the bar's TV at 18:00. Players scan the QR and land on the poster to enter; their names appear under Confirmed within 10 s as he confirms them. At 19:00 he generates the draw: the right-hand side becomes the bracket. He starts round 1; the words under the QR become "Scan for your match", and Thai scans it and lands on his match page. Nobody touches the TV all night.
*Touches:* `supabase/migrations/20261128113429_tournament_follow.sql`, `supabase/tests/117_tournament_follow.test.sql`, `src/tournaments/follow/index.html`, `src/scripts/tournament-follow.js`, `src/stylesheets/follow.css`, `src/tournaments/my-match/index.html`, `src/scripts/tournament-my-match.js`, `src/scripts/tournament-bracket.js`, `src/stylesheets/bracket.css`, `src/scripts/tournament-nav.js`

## 2026-11-28 — Signing in a TV with a phone
*Decided by UV:* a QR sign-in like Netflix or Prime, so TVs can sign in. **The TV shows a QR and a code**; the phone scans it or types the code at thediveclub.org/tv, signs in if needed, and is asked to allow the device. A TV signed in this way **may do everything the account can** (UV: "is this then a way for anyone to extend their log in on any device? Sounds cool"). **A new code every 30 s** ("a real security risk"). **Codes are made only while the login card is open** and stop when it closes. **The device manager is wanted** (where you are signed in, sign out each), built after this.
*Claude's, for UV to correct:* each code may be allowed for 60 s (shown for 30, so one scanned at the last second still works); an approval must be collected within 2 minutes; the TV asks every 3 s and stops after 30 minutes with nobody scanning ("Show a new code"); the device's name is worked out on the server from the TV's browser; the QR shows only in Log In mode, not Sign Up; the token is made with Supabase's own magic-link mechanism (`generateLink` + `verifyOtp`), nothing emailed. *Rejected:* the phone showing a code to type on the TV (typing with a remote is slow, and it is the reverse of what people know); a 10-minute code (UV: 30 s).
*Example:* Basil's TV shows the login page. He scans the QR with his phone, sees "Allow this device? Samsung Internet on Samsung TV", taps Allow, and the TV is signed in as him within 3 s. A photo of the TV's QR taken a minute earlier no longer works.
*Touches:* `supabase/migrations/20261128123827_device_login.sql`, `supabase/tests/118_device_login.test.sql`, `supabase/functions/device-login/index.ts`, `supabase/config.toml`, `src/scripts/device-login.js`, `src/stylesheets/device-login.css`, `src/accounts/index.html`, `src/scripts/auth.js`, `src/tv/index.html`, `src/scripts/tv.js`.

## 2026-11-28 — Walk-in names from a pasted list: letters only, made neat

*Decided by UV:* each line of the bulk walk-in list keeps only its text, made neat: "4) UV", "4. UV", "4 UV420" and "420UV" are all UV. The field warns that only letters are kept. **Neat** is one space between words and a capital to start each word, with the rest left as typed (so UV stays UV, not Uv). **Apostrophes and hyphens inside a name are kept** (O'Brien, Jean-Luc).
*Claude's, for UV to correct:* letters in any language are kept (Émile); a curly apostrophe is made straight; a removed character leaves a space, so "Jo.Smith" is Jo Smith; a line with no letters left is dropped. *Rejected:* full title case (turns UV into Uv).
*Example:* Basil pastes "3. jo  smith 🎱" and "12) UV420"; the list gains Jo Smith and UV.
*Touches:* `supabase/migrations/20261128125413_walk_in_names_letters_only.sql`, `supabase/tests/119_walk_in_names.test.sql`, `src/_includes/tournament/entrants.html`, `src/scripts/tournament-manage.js`.
