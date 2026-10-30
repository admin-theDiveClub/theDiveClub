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
