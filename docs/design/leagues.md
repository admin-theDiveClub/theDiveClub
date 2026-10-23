# Leagues — the design, as settled

**Status: designed. The structure in §1 is built (22 Oct, migrations
`20261022180000` and `20261022190000`), and the pages to create and run a league
(`/leagues/`, with `20261022200000`), and the round-robin fixtures and the team
match (`20261022210000`); the lineups in §3 onwards are not.** Nothing in this document is a proposal.
All of it was decided with UV on 13 Oct 2026 and is reproduced here from that
session and from `claude/stats-schema-design.md` (now `docs/archive/stats-schema-design.md`). The record of
what was built, and how it differs, is `docs/systems/leagues.md`.

**Why this file exists.** The design lived only in a chat. On 22 Oct a new
session asked UV two questions he had already answered in detail — how
standings are configured, and what the captain's page is — because neither
answer was anywhere in the repo. A design that is settled but unwritten gets
re-asked, and being re-asked is worse than being undocumented, because it
costs the person time to say the same thing twice. Anything decided here goes
in here.

---

## 1. The shape

Leagues and tournaments are **siblings**, not one table with a format
discriminator. They genuinely differ — a fixture list and standings, against
rounds and elimination — and merging them leaves half the columns null either
way.

| Table | Holds |
|---|---|
| `tbl_league` | The durable identity: name, discipline, default ruleset. Persists across seasons |
| `tbl_season` | name, starts_on, ends_on |
| `tbl_league_season` | league_id, season_id, name/number, ruleset overrides, status. The fixtures and standings hang off this |
| `tbl_league_season_entrant` | league_season_id, player_id, entity_id, status (active / inactive / withdrawn), payment fields. **Unique on (league_season_id, player_id)** — one team at a time, a transfer is an update |

> **As built (22 Oct).** The names above are the design's; the built tables are
> plural — `tbl_leagues`, `tbl_seasons`, `tbl_league_seasons`,
> `tbl_league_season_entrants` — and the design's "entity" is `tbl_teams`.
> Three differences of substance, each in `docs/DECISIONS.md`: team membership
> is the entrant row's `team_id` and a captain is `is_captain` on it (no
> separate member table); there is no `status` column on a league season until
> fixtures exist to derive it from; and there is no `discipline` column on a
> league, because discipline is already a ruleset key.
>
> **Settled by UV on 22 Oct, after the first build:** a walk-in or guest can
> never be a league player; every league player confirms their own place before
> the league can begin; only the league director creates teams, and captains
> control them, claiming players who have confirmed. Players can be added
> mid-season by the director and are then claimed. Captains inviting players is
> deferred.

**Teams do not persist across seasons.** A new entity each season carrying
`league_season_id`, with a nullable `team_lineage_id` linking successive
incarnations. Cross-season history without making the entity durable.

**No validity date ranges.** The frame carries the player and the match carries
the teams, so attribution is correct at the moment of play regardless of later
transfers. A player who moves appears under both teams, each frame correctly
attributed.

> **Caveat to keep in mind:** "who is in team X" now has two legitimate
> answers — the current roster, and who actually played. Different questions,
> different numbers. Any screen showing a roster has to say which it means.

---

## 2. A team league night

> **As built (22 Oct).** The schedule itself is `tbl_league_fixtures`: a round
> robin by the circle method, one to four meetings per pair, generated only
> once every active player has confirmed. A bye is a row with no away team.
> `tdc_create_league_match` writes the team match. **Everything below this
> line — the flat list of frames, the lag per frame, `by_schedule` — is step 4
> and is not built**; a league match today is a match record with no frames.

Round-robin. **The night is a flat list of frames**, each its own race-to-one
between two named players, each lagged separately.

That flatness is the key simplification UV argued for and it holds: there is no
"rubber" or sub-match entity. `lineup_slot` identifies the contest, which is
why the proposed `contest_no` column was dropped — it would have duplicated
information already present.

**Played sequence is not a column.** It falls out of `started_at` / `ended_at`,
set when someone presses start.

### Breaking

Team play lags **every frame**, unlike tournaments and socials where one lag at
the start drives the whole match through `break_determination`. Nationals
pre-determine the break instead, printed on the scoresheet.

So `break_determination` needs a `by_schedule` value where the grid says who
breaks and nothing is derived from results. Note that `winner_breaks` and
`loser_breaks` **cannot** be derived in team play at all — the chain assumes
frames complete in order, and frame 4 routinely finishes before frame 3.

---

## 3. Lineups

> **As built (22 Oct, `20261022230000`).** Squad, order and lock are three
> tables; the blind exchange is enforced in `tdc_match_lineup`, not in a
> policy. Frames are created when the second side locks, exactly as the three
> rules below say. **Not built:** nothing yet reads `strict_frame_order` — it
> is stored and validated, and the scorecard that would obey it is step 6.
>
> **Built 23 Oct (`20261023193153`):** team size and the rotation table, as
> ruleset version 3 keys, with the LD's settings page to set them. See
> `docs/systems/leagues.md`. The order itself is still one per frame.
>
> **Superseded in one respect, 23 Oct.** What is built asks a captain to fill
> every slot of the night by hand. It should ask for the first session only and
> derive the rest — see *The order is one per position* below, which is the
> next piece of league work and changes `tbl_league_match_order`.

- **Squad is open** to everyone and editable. **Order is a blind exchange**
  between captains, locked at match start.
- **Submitting a lineup is confirming participation** for the night, even a
  partial one (3 of 5). This deliberately fixes a real pain point in existing
  leagues, where confirmation is a separate step everybody ignores.
- `lineup_cutoff_hours` — a ruleset key. Past the cutoff with no lineup, that
  side concedes. **Evaluated lazily** when the match is opened, so there is no
  scheduled job to go wrong.
- Notification is **manually triggered**: when one team confirms, the other
  captain is notified.
- **Reserves may still be added after lock.** What locks is the *order*, not
  the squad. A reserve changes a frame's participant; it does not create frames.
- `strict_frame_order` — a ruleset key. Nationals forbid changing frame order;
  most league play allows any order. When strict, a scorer may only edit the
  specific frame in sequence; when open, all frames are editable at once.

Squad and order are separate things and want **separate tables**.

### The order is one per position, not one per frame

> **Settled 23 Oct, not built.** UV: *"Captains don't set the lineup on every
> frame. The scorecard carries a specified order of play based on the order of
> the first round-robin session. So, as a captain, I set the order on the first
> 5 frames and then the rest of the night is worked out from there."*

A team night is **sessions**, not a flat list of frames.

- **Session size is a league setting**: a floor number of players in a team. A
  five-man league plays **five frames per session, five sessions, 25 frames** —
  so `frames = team_size²` and the order a captain sets is `team_size` long.
- A captain names the order for the **first session only**. Every later session
  is derived from it by the rotation table.
- **The rotation table belongs to the LD**, who defines it when designing their
  scorecard. We follow the same format. Default to a cyclic shift of the away
  order and let the LD state theirs.
- **Frames may be played out of order.** That only matters for standings, but
  nothing in the card may assume sequence.

So `tbl_league_match_order` holds one row per **position** per side, not one per
frame, and the night's pairings are derived from the two orders plus the table.
The blind exchange is unchanged: neither side sees the other's order until both
have locked.

#### Reserves fill a position for one session

A reserve never changes the session size or the frame count. It replaces a
player **in one frame of one session**. A five-man team with six players
usually has five players play four frames and one play five — 25 appearances
shared among six.

> **Built 23 Oct (`20261023213048`): how many reserves a team may carry.**
> The LD sets reserves allowed per season (default 2, 0 for no subs); a
> team holds at most team size + reserves **active** players. A player away
> for a while is marked inactive and frees a place. Every league now has a
> team size. `docs/DECISIONS.md`.

The captain sets how many players are in tonight and may add reserves on
demand. At lock time they still name only the first session; once the card is
generated they swap a reserve in per session. Three rules hold:

| | Rule |
|---|---|
| 1 | A player may not play **more than one frame in a session** |
| 2 | A player locked in on the team lineup **stays in the same position every session** — only a reserve coming in changes who occupies it |
| 3 | A reserve may **not face the same opponent twice** across sessions |

The captain marks each change themselves. UV: *"2 changes is not much to ask
for."*

#### Breaks are already answered

The LD sets who breaks on each frame, as they do for any match; a mainstream
team league is lag winner every frame. Formats with **pre-determined breaks per
session** exist and are an **LD edge case for later** — not part of this.

### Frames are created at lineup lock

When the second captain locks:

| Both sides filled | A real frame with its two participants |
|---|---|
| **One side filled** | A `default` frame — walkover to the side that showed up |
| **Neither filled** | **No frame. The slot vanishes** |

A captain who never locks concedes every slot to the side that did.

> **Consequence that bites:** vanishing slots shrink the card, so a race-to
> target can become unreachable and a tie can appear where the format did not
> expect one. Team matches therefore want `fixed_frames` with "most frames
> wins", plus `draws_allowed` to settle level.
>
> **This is advice, not a constraint (corrected 23 Oct).** It was read as one:
> `private.tdc_lineup_slots` counted frames only for `fixed_frames`, so UV's
> race-to-13 league returned zero slots and the card drew a single frame. The
> count now answers for every win condition — `fixed_frames` and `best_of` give
> their target, `race_to` gives **2N−1** because a team night plays its whole
> card rather than stopping when one side gets there, and a timed or free-play
> night gets one slot per player on the fuller side. It is never zero.
>
> **Once sessions exist this becomes a fallback.** A team night's frame count
> should come from the team size (five-man → 25); the win condition answers only
> for a league with no team size set.

An unfilled slot's `default` frame is **materialised at submission, not
before** — a team still arranging lifts should not be conceding frames at 19:30.

---

## 4. Two surfaces, one record

> **As built (23 Oct).** The captain's scorecard is `/leagues/card/?m=<match id>`
> and is a full recording surface, as this section says. **The second surface
> is not built**: `/match/` still refuses a team match, so a player's own frame
> is entered by their captain on the grid. One frame set either way, which is
> what the rule was about.

| Surface | For | Does |
|---|---|---|
| **Captain's scorecard** | Captains, scorers | The night's grid. Lineups, who plays which slot, frame-level results for **every** frame on one page, edits, submission |
| **The stage** (`/match/`) | Players | Filtered so a player sees only their own frame. Players enter their own results |

**Both read and write the same frames. Nothing is duplicated.**

This is the resolution of the apparent clash with the one-match-page rule, and
UV restated it on 22 Oct: the captain's page is a full recording surface in its
own right, and the stage remains an *alternative* way for a player to record
their own frame. It is not "management around the stage" — a captain can record
everything from the grid without the stage existing. What keeps the one-page
rule honest is that there is one **frame set**, not one screen.

---

## 5. Reconciliation — one shared record plus a version

**Rejected:** two parallel scoresheets reconciled at submission. That leaves a
frame with no single truth until both submit, so every downstream query — live
standings, player stats, the follow page — has to ask "whose version?".

**Adopted:**

```
tbl_match.card_version    int, bumped by trigger on ANY frame insert/update/delete
tbl_match_submission      match_id, side, submitted_by, submitted_at, card_version
                          one row per side, replaced on re-submit
```

**The whole rule:** the card is agreed when both sides have a submission row
**and** both rows' `card_version` equals the match's current `card_version`.
No clearing, no cascade. A submission is never invalidated — it just stops
matching.

Worked example, as agreed:

> Yesh enters frame 7 → v7. The home captain submits (v7). The away captain
> fixes frame 3 → v8. Home is no longer signed and sees *"The card changed
> after you submitted: Frame 3, break outcome Dry → Foul, by Trevor Mokoena
> 14:22"* — straight out of `tbl_frame_edit`. Away submits (v8). Home either
> agrees and re-submits, or raises a dispute on frame 3.

Why this shape: one set of frames, so nothing downstream asks whose version; a
captain cannot quietly un-sign the other; and it generalises — a social match
needs one signature or none, and nationals could require the referee's too.

**After LD approval, version comparison stops.** Approval locks the match
read-only for everyone below LD. Captains' submissions stop mattering and
nobody re-signs. The LD can still edit, and those edits are logged, but they
do not un-sign anyone or reopen the card. **Approval is the end of the
negotiation, not a checkpoint in it.**

**Partial submission is allowed.** "Submit" means *this is the final card*, not
*all slots are filled*.

**Notify a player whose frame was changed by somebody else.**

### Permissions on the night

- A player may enter results **only for their own frame**.
- A captain may edit any frame. Edits are attributed.
- Scorers may edit during the match.
- **Captains outrank players.** Submission is captain-only.
- Approval is the LD (league) or TD (tournament).

---

## 6. Standings

Computed on fetch over all matches in the league season — never cached. At
16 teams × 25 frames ≈ 3,000 rows a season, aggregation is trivially fast and a
cached total only creates drift bugs.

**Configurable by the LD**, who builds each column from buttons. Prior art is
SportsPress Pro: columns with name, abbreviation, equation, precision and sort
priority.

```
tbl_league_season_column
  league_season_id, key, name, abbreviation
  equation (jsonb token array)
  precision, sort_priority, sort_direction
  visible_to_players (bool)
```

**Deliberately not copied from SportsPress:** it defines columns *globally* and
shares them across every table, so editing one equation changes every league at
once. On a multi-venue platform that is wrong — **columns belong to the league
season**.

### Equations are a token array, never a string

Built from buttons only — one button per variable, one per operator — so the
stored form is the token sequence:

```json
[ {"t":"var","v":"won"}, {"t":"op","v":"*"}, {"t":"num","v":3},
  {"t":"op","v":"+"}, {"t":"var","v":"drawn"} ]
```

No parser, no string handling, nothing to escape. Validation is: does the
sequence alternate value and operator, and are the brackets balanced.

> **Hard rule: never `eval` the equation and never interpolate it into SQL.**
> On a platform where anyone can create a league, an LD-supplied string
> reaching an evaluator is a remote code execution hole. The token array
> removes the attack surface entirely — an attacker cannot express anything the
> button set does not contain.

**Primitives**, all computed from frames: `$played`, `$won`, `$lost`,
`$drawn`, `$frames_for`, `$frames_against`, `$frame_diff`,
`$breaks_and_finishes`, `$golden_breaks`, `$walkovers_given`,
`$walkovers_received`, `$streak`, `$last5`, `$home_record`, `$away_record`.

`3 × $won + 1 × $drawn` — the common league formula — must be expressible.
`$drawn` is a real primitive because a timed match can end level.

**`visible_to_players`** is UV's "some leagues see some data as irrelevant".
It probably wants to be broader than the standings table, governing which stat
categories appear anywhere for that league.

**Sort priority decides tiebreak order**, per column.

---

## 7. What already exists that this builds on

The tournament track shipped several things leagues were going to need. Check
each against the built version before designing around this list — it is a
pointer, not a specification.

| Already built | Note |
|---|---|
| `card_version` on `tbl_matches`, bumped on frame writes | The version counter above. Already drives the `TDC01` stale-write refusal |
| `tbl_match_events` as an append-only card log | Submit / agree / dispute / reopen. Per-player, not per-side — the team case needs the per-side submission row above |
| `tbl_frame_edit` / the frame edit log | What the "card changed after you submitted" message is built from |
| `tbl_competition_roles` (TD, referee, scorer) | Scoped to a tournament **or, since 22 Oct, a league season**. The LD is the shared `director` role. A captain is *not* a competition role — it is per team, so it lives on the entrant row |
| Notifications with per-category switches and push | The lineup-confirmed notification and the frame-changed notification both land here |
| Frozen rulesets, round-level overrides, `TDCMatchDef` | `lineup_cutoff_hours`, `strict_frame_order` and `by_schedule` are new keys in an existing system |

---

## 8. Still open

Carried from `claude/stats-schema-design.md` (now `docs/archive/`); none of it blocks starting.

- **Both sides leave the same slot empty.** No frame at all (preferred — it
  matches how a paper scoresheet strikes it out), a frame with no winner
  (breaks "every complete frame has a winner"), or a loss for both. Affects
  frames-won totals and therefore standings.
- **A manually overridden breaker** vs a later recompute stomping it. Needs a
  flag distinguishing derived from manually set, or an explicit decision that
  recompute always wins.
- **Travelling league fee scope.** `venue_id` is NOT NULL on `tbl_credit_ledger`,
  but a league playing at four clubs owes its fee to the league, not a venue.
  Either a league has an owning venue and fees always settle there, or leagues
  get their own fee scope. Blocks entry fees, not leagues.
- ~~Can a walk-in be a league entrant?~~ **Resolved 22 Oct: never.** Walk-ins are for business, tournaments and matches.
- **Captains inviting players** to their team. Common practice in existing leagues; UV will discuss later.
- **Approval and dispute mechanics** for the team case in detail.
- **Changing a league's rules after it starts.** There is no page for it, so a
  ruleset chosen wrongly at creation cannot be corrected — UV hit this on 23 Oct
  with a race-to league he had meant to make fixed-25. Proposed: refuse a change
  that would **shrink a card with frames already recorded**, allow it everywhere
  else, rather than silently dropping frames and breaking *frames are the only
  record*. Team size and the rotation table live here too.
  **Settled 23 Oct:** a change reaches every match with no frames and no locked
  side; the rest keep their frozen rules and the page says how many. Nothing is
  refused. `docs/DECISIONS.md`.
- ~~The rotation table's default.~~ **Settled 23 Oct: the LD states it, with a
  cyclic shift as the default.** Stored as a ruleset key, so it is frozen onto
  each match.
