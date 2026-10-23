> **Archived 23 Oct 2026.** Moved word for word from the project doc `claude/stats-build-changes.md`. Most of it is done (the merge fix, email confirmation). Still open and now tracked in `docs/STATUS.md` / `docs/BACKLOG.md`: the signup bot check, the credit ledger's `ref_table` / `ref_id` and `entry_type`, travelling-league fee scope, and the platform limits for unverified accounts.

# Changes needed to already-built systems

Running list, from the stats schema design sessions (Oct 2026). These are modifications to things already shipped in `thediveclub-prod`, as opposed to new tables. Companion to `claude/stats-schema-design.md`.

---

## Auth

**Enable a bot check at signup.** Supabase supports Cloudflare Turnstile or hCaptcha natively on auth endpoints. Config, not code. Highest-value single anti-abuse measure; blocks scripted signup without friction for real users. **Still to do.**

**Email confirmation — confirmed ON.** Checked in the dashboard on 13 Oct: "Confirm email" is enabled, along with signups allowed, manual linking off, anonymous sign-ins off. (An earlier inference from `auth.users` that it was off was wrong — the existing rows have `confirmation_sent_at` null because they predate the setting or were otherwise auto-confirmed.) Worth one end-to-end test of the signup mail path through Resend, since it has only been carrying password resets so far.

---

## `private.tdc_merge_players` — fixed in migration `20261014170000`, pending push

The function moves everything off the signup record onto the walk-in record, then deletes the signup record. It names tables one at a time, so a table nobody added is a table that either blocks the delete or loses history silently.

Before the fix it knew about three tables. Six more columns pointed at `tbl_players` without it:

| Column | On delete | Effect of the gap |
|---|---|---|
| `tbl_redeem_codes.redeemed_player_id` | `restrict` | **Already broken before the stats work.** Sign up → redeem a code → staff link the old walk-in record = foreign key error with no useful message. Shipped with redeem codes and never noticed, because nobody has done it in that order yet. |
| `tbl_matches.home_player_id` | `restrict` | Blocks the merge; would orphan a whole scorecard |
| `tbl_matches.away_player_id` | `restrict` | Same |
| `tbl_frame_participants.player_id` | `restrict` | Blocks the merge from the first frame played |
| `tbl_frames.referee_player_id` | `set null` | Silently loses who refereed |
| `tbl_frames.break_player_id` | `set null` | Silently loses who broke |

Redeem codes refuse direct edits via a guard trigger, so the merge sets `tdc.redeem_write` around its one update, the same way it already did with `tdc.ledger_merge` for the credit ledger.

**Two new refusals**, because joining two records that faced each other would put the same player on both sides of a match or twice in one frame — a check constraint would have failed with something nobody could act on:
- "These two records are recorded as having played against each other."
- "These two records are recorded as having played in the same frame."

Both queries verified against the dummy match (true for the pair who played it, false for a control pair). The function body itself is **untested** — the merge requires the record it deletes to be linked to a real auth account, and the only such accounts are live ones. Test it through the app: a throwaway signup, a walk-in record, a frame played by each, then the staff link flow.

The migration carries the query that lists everything referencing `tbl_players`, so the next person can check the function is still complete rather than trusting a list.

Still to come and also needing adding: `tbl_frame_edit.edited_by_player_id`, `tbl_league_season_entrant`, `tbl_competition_entrant`, `tbl_entity_member`, `tbl_competition_role`.

Existing guards worth knowing: refuses when both records have an SA ID on file (owner must resolve); only merges a walk-in *into* an account, never two walk-ins together.

---

## `tbl_credit_ledger`

**Add `ref_table` and `ref_id`.** The original design had them; the shipped table doesn't. Nothing currently links a ledger entry to what caused it. Needed before league fees — reconciliation, disputes and withdrawal refunds all need "which season did this debit settle".

**Extend the `entry_type` check constraint.** Currently allows only `('adjustment','code')`. League fees need a value, and so does ordinary table spend. Do both in one migration rather than altering the constraint twice.

**Decide the venue-scoping question for travelling leagues.** `venue_id` is NOT NULL on the ledger, but a league playing at four clubs owes its fee to the league, not a venue. Either the league has an owning venue and fees always settle there, or leagues get their own fee scope. Undecided.

---

## RLS / visibility

**Player search must be cross-venue.** Any authenticated player should be able to search other players; staff likewise. `tbl_players` has no `venue_id` so players are already global, but the RLS policies decide what a search actually returns. If staff at one venue can't see records created at another, TDs will create duplicate walk-ins instead of finding the existing player.

**Public read surface is new.** The tournament follow page is the first unauthenticated-read surface in the system — everything so far has been authed. Needs its own policy and a deliberate decision on what's exposed: brackets, scores and player display names yes; phone numbers, identifiers and payment status no.

Note: `tbl_matches`, `tbl_frames` and `tbl_frame_participants` currently grant SELECT to `authenticated` only. The follow page will need a public policy on all three.

---

## Platform limits (new behaviour, affects existing account model)

- Cap **active** competitions per unverified player, not total — completed ones must not count against the limit, and the "delete an old one" action should archive rather than delete, since the frames are the point.
- Rate-limit creation by time as well as count (a real person doesn't create five tournaments in a minute).
- Unverified-tier competitions are not publicly listed or indexed — reachable by direct link only. This is what removes the incentive to spam.

---

## Operational note (14 Oct)

`drop` and `delete` statements are blocked through Claude's Supabase connection; `insert`, `select` and function calls go through. Cleanup of test data has to be done by UV in the SQL editor or via a migration. Statements over roughly 8 KB are also rejected, so large test scripts have to be split — which is why the frame functions were validated in two passes rather than one.

Test data currently in the database: match `215b10ec-de44-4c61-a513-ab9768c43e72` (UV 3 – Linton 2, five frames). Kept deliberately as the dummy match for wiring up the match page.
