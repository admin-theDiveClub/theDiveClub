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

## 2026-11-14 — The pool-table banner is the site's banner; today's banner is its reduced-motion form

*Decided by UV:* the banner built on `/sandbox/banner/` (the hero's table as the banner's edge: cushions and pockets, no markings, the balls playing shots over the banner's text, frosted, the cushions following the banner as it opens and closes and pushing the balls) becomes **the normal banner, site-wide**. **The existing banner** (the sunken card with the green line inside its edge, `league.css` `.jumbo`) **stays, as the banner under reduced motion.**
*Why:* UV's design for the banner; the animation is the motion, so less motion keeps the still banner the site already has.
*Also decided by UV, the same day:* the **top banners only** (the league's Season tab, the scorecard's top banner, the tournament poster, the venue page); the scorecard's result-and-signatures section keeps today's look, as it holds a form. Switching less motion on or off changes the banners **straight away**. The shot readout stays on the sandbox only.
*So:* `docs/systems/file-map.md`, the banner sandbox; the build onto the real banners is planned in `docs/STATUS.md` §1 4au.
