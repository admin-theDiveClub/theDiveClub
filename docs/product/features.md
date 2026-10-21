# theDiveClub — what it does

A scoring and competition platform for cue sports. Built for the way a club night actually runs: one person at the bar with a phone, players who may never install anything, and a result that has to be right afterwards.

**Status:** in active development. Everything marked ✅ is built and in use. Everything marked ◻ is designed but not built. Nothing here is aspirational — if it is not built, it says so.

Last reviewed: **21 October 2026**

---

## The idea behind it

Three things shape every decision in this product, and they are worth stating because they are unusual.

**Frames are the only record.** A match score is never stored. It is counted from the frames, every time it is asked for. There is no second copy to disagree with the first, and no way for a score to drift from the play that produced it.

**The rules are frozen onto a match when it starts.** Change a league's settings in March and the frames played in October are untouched. A rule change can never rescore a finished match.

**One person can run the whole thing.** Players entering their own scores is a convenience, never the path. A tournament director with a scoresheet and a phone can run an entire night without a single entrant opening the app — and entrants need not have accounts at all.

---

## Scoring a match

| | Feature |
|---|---|
| ✅ | **Frame-by-frame scoring** with a running count |
| ✅ | **Any format** — race to, best of, fixed frames, timed, or free play with no end |
| ✅ | **8-ball, 9-ball, 10-ball and blackball** |
| ✅ | **Break tracking** — who broke, how it ended, and whose break is next, worked out from the rule in force |
| ✅ | **Break and finish, reverse break and finish, golden break**, each switchable |
| ✅ | **Match clock and shot clock**, with per-player extensions |
| ✅ | **Corrections** — any frame can be changed or removed, with the whole history kept |
| ✅ | **Works offline.** Scores queue on the device and send when the signal returns |
| ✅ | **Live across devices.** A score tapped at the table appears on the director's phone as it happens |
| ✅ | **Two people cannot overwrite each other.** A submission that refers to an older version of the card is refused rather than silently winning |

## Agreeing a result

A scorecard has a lifecycle, and who closes it is a setting rather than a rule.

| | Feature |
|---|---|
| ✅ | **Submit, agree, dispute, reopen** |
| ✅ | **Four approval modes** — none, a dispute window that settles by silence, coordinator approval, or both |
| ✅ | **A dispute window of any length**, settling itself when it expires |
| ✅ | **Coordinator approval** that publishes and locks the result |
| ✅ | **Objections after publication** are recorded and flagged to the coordinator without unpublishing the result |
| ✅ | **Sending a card back** reopens it for correction |
| ✅ | **A director's score entered by hand**, as its own visible record rather than invented frames — for the match nobody scored in the app |
| ✅ | **A full audit log of every frame change** — who, when, their role at the time, and the before and after |
| ◻ | A screen that displays that audit log |

## Running a tournament

| | Feature |
|---|---|
| ✅ | **Single elimination draws**, generated with correct seeding and byes |
| ✅ | **Third-place playoff**, optional |
| ✅ | **Automatic or manual progression** — winners advance on their own, or the director places everyone |
| ✅ | **Automatic or manual match starts** — a match begins when both players are known, or when a table is free |
| ✅ | **The director can override anything.** Move a player, award a walkover, enter a score, undo an award |
| ✅ | **Swap a player in any fixture**, with the consequences shown before anything happens — which match detaches, who moves in the rounds above |
| ✅ | **Cascading corrections.** Fix a score three rounds back and the draw offers to update everything it affects, listing the changes first |
| ✅ | **Officials** — directors, referees and scorers, each with what they are allowed to do |
| ✅ | **Who may enter scores** is a setting: players, a scorer, a referee, or the director alone |
| ✅ | **Entrants may be walk-ins** with no account and no email address |
| ✅ | **Seeding**, by hand or randomised |
| ✅ | **Tournament status** worked out from the tournament itself, and overridable by the director |
| ◻ | Double elimination, round robin, groups-then-knockout |
| ◻ | Adding rounds or matches to a tournament already under way |
| ◻ | Changing a whole round's settings at once |

## Entries

| | Feature |
|---|---|
| ✅ | **Three entry modes** — the director adds everyone, players mark themselves interested, or players confirm their own entry |
| ✅ | **The director confirms entries** on whatever basis they use |
| ✅ | **Marking somebody paid can confirm them**, if the director wants it to |
| ✅ | **Payment timestamps**, so "paid at the desk tonight" and "paid three weeks ago" are different facts |
| ✅ | **Entrant limits**, with withdrawals freeing a place |
| ✅ | **Withdrawing and re-entering** |
| ✅ | **Self-entry requires a confirmed email address** |
| ◻ | Charging an entry fee against the credit ledger |
| ◻ | Restricting a tournament to a named set of players, such as a league's members |

## The tournament poster

| | Feature |
|---|---|
| ✅ | **A public page per tournament** — the only page that opens without signing in |
| ✅ | **Nothing is public until the director shares it.** Generating a poster and sharing it are separate acts |
| ✅ | **The director chooses what goes in** — the tournament and entrant counts by default, with player names and the full draw optional |
| ✅ | **A block of copyable text** describing the whole tournament, to hand to a designer or an image generator |
| ✅ | **Works before, during and after** — an advert beforehand, a record afterwards |
| ✅ | **Entry buttons for anyone signed in**, and an invitation to sign in for anyone not |
| ◻ | A live public scoreboard. *Deliberately not the poster* — a poster is a snapshot and says when it was made |

## Accounts, venues and staff

| | Feature |
|---|---|
| ✅ | **Accounts with email confirmation**, profiles and avatars |
| ✅ | **Walk-in players** created by venue staff, with no account |
| ✅ | **Merging a walk-in into a real account** when that person signs up, carrying their whole history across |
| ✅ | **Venue roles** — owner, admin, staff |
| ✅ | **Identity verification** for venues that need it |
| ✅ | **A credit ledger** with redeem codes |
| ✅ | **Push notifications** for scorecard events |
| ◻ | Notifications for tournament events — being entered, being confirmed, somebody changing your frame |
| ◻ | Choosing a venue when creating a tournament. Every tournament made in the app today is the open tier |

## Installing it

| | Feature |
|---|---|
| ✅ | **Installs as an app** on phone and desktop, with its own icon |
| ✅ | **Works offline** for scoring |
| ✅ | **Dark and light**, following the device |

---

## What this is not, yet

Said plainly, because a feature list that only lists features is a sales document.

- **Leagues are designed but not built.** The schema reasoning exists; the tables and pages do not. Tournaments came first.
- **Standings and rankings are not built.** The design assumes they are counted from frames like everything else.
- **Only single elimination generates a draw.**
- **There is no public view of a tournament in progress** beyond a poster the director regenerates.
- **Nothing charges money.** The credit ledger exists; entry fees do not draw on it.

---

## For venues considering it

The honest summary: **match scoring is production-ready and has been used in real play. Tournaments are built and are being tested, having been written over three days in October 2026.** Treat tournaments as a capable beta — the logic is verified against a test database at every step, and a club night is a different thing from a test database.

What a venue needs to run it: nothing but phones. No hardware, no installation, no per-table device. Players do not need accounts. The director does.
