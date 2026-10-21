# Product documentation

Written for people who **use** theDiveClub, not people who build it. Venue operators, tournament directors, players, and anyone deciding whether to adopt it.

The technical record lives elsewhere and is not for this audience: `CLAUDE.md` for how it is built, `docs/DECISIONS.md` for why, `docs/STATUS.md` for what is next.

---

## What is here

| Document | For | State |
|---|---|---|
| `features.md` | A venue deciding whether to use it; anyone asking what it does | **Written.** Reviewed 21 Oct 2026 |

## What is still to write

In the order it will probably be needed.

| Document | For | When it is needed |
|---|---|---|
| `running-a-tournament.md` | A tournament director, start to finish | **Before the first outside venue.** Setup, entries, the draw, scoring, corrections, publishing, the poster |
| `venue-setup.md` | A venue owner getting started | Before the first outside venue. Roles, staff, walk-ins, verification, credits |
| `player-guide.md` | A player with an account | When self-entry goes to real players. Entering, scoring, agreeing a card, disputing |
| `scoring-rules.md` | Directors setting up a match | When the rules get used in anger. What each setting means and what it does to play — break determination, break and finish, tiebreaks, clocks, approval modes |
| `faq.md` | Support | Once there are real questions. Do not write it before then |

---

## How to write these

The house style, such as it is.

- **Plain language.** The reader is running a pool night, not reading a specification. No jargon that the app itself does not use on screen.
- **Say what is not built.** A feature list that only lists features is a sales document and will be caught out within a week. Mark what does not exist.
- **Date anything that could go stale**, and review on a schedule rather than when somebody notices.
- **Screenshots will rot.** Prefer describing what to look for; use a screenshot only where the thing is genuinely hard to describe, and accept it will need replacing.
- **One document, one reader.** A director's guide that also explains the schema serves neither.
- **No invented capability.** If you are unsure whether something works, check the code or ask UV. Do not describe behaviour from memory of a design conversation.

---

## Before anything here is published

| | |
|---|---|
| 1 | **UV reads it.** These documents speak for the business, not for Claude |
| 2 | **Check it against the build**, not against `STATUS.md`. Status can lag |
| 3 | **Decide where it is served.** These are repo files today, not pages. Publishing them means a decision about whether they live on thediveclub.org, and if so under what layout |
| 4 | **The legal pages are separate** and are not Claude's to write — `404.html`, `privacypolicy.html` and `termsofservice.html` are stubs, and the last two need a real person |
