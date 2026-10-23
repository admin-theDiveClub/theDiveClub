> **Archived 23 Oct 2026.** Moved word for word from the project doc `claude/approval-and-corrections.md`. This was the design; it has since been built — see `docs/systems/tournaments.md` (overrides, officials, publishing). Kept for the reasoning.

# Approval, publishing and corrections

Decisions from 19 Oct 2026. **Supersedes the "Approval and locking" section of `claude/stats-schema-design.md`**, which stays accurate but thin. Nothing here is built yet.

---

## The problem being solved

UV: *"this is to avoid a rogue player filling in incorrect scoresheets and throwing the current standings off."*

Players submitting their own scores is the point of the app. But a league table is a shared public fact, and one bad card changes everyone's position in it. So a coordinator needs a way to stand between a submitted card and the standings — **without** going back to the Challonge model where players report on paper and the TC retypes everything.

---

## Recorded is not the same as published

This is the idea the rest of the design hangs off, and it is new.

| | Meaning |
|---|---|
| **Recorded** | The frames exist. Players entered them, the card is what they say it is |
| **Published** | The result counts: it moves the standings, resolves the next bracket slot, appears on the big screen |

Today these are the same thing, because there is no coordinator. With `coordinator_approval`, a card can be fully recorded and agreed by both players and **still not published** until the TC says so. UV: *"TC can control what updates are 'pushed' to screen."*

Consequences to design for:

- Standings and bracket resolution read **published** results, not all results.
- A player's own match page shows the real card either way — hiding their own score from them would be absurd.
- A public follow view shows published results only, or shows unpublished ones clearly marked as pending.
- A TC screen in the venue is the whole reason this exists: nothing appears on it that the TC has not seen.

---

## The four approval modes

`approval_mode` already exists in the ruleset and is validated. Two of its four values currently do nothing.

| Mode | Who has to act | Published when |
|---|---|---|
| `none` | Nobody. Submitting settles it | On submission |
| `dispute_window` | The opponent, or silence for N hours | On agreement or when the window lapses |
| `coordinator_approval` | The TC/LD | On coordinator approval |
| `both` | The opponent **and** the TC/LD | On coordinator approval, which may only happen after the players have settled |

`none` and `dispute_window` are built. The other two are not.

### The coordinator flow, as UV described it

> *"when TC approval is needed, then when the first player submits, it goes to TC to approve but opposition can still reopen for dispute (in which case, TC approval would completely lock a scoresheet)."*

Reading that as a state machine:

1. A player submits → the card is **recorded**, not published, and appears in the TC's queue.
2. The opponent may still dispute it, which reopens the card for editing as it does today.
3. The TC may approve at any point. **Approval publishes and fully locks** — below the TC, nobody edits, and the dispute route closes.
4. A TC may also reject or send back, which should behave like a dispute: the card reopens with a reason attached.

**The difference between `coordinator_approval` and `both`** is whether the TC may approve before the players have settled between themselves:

- `coordinator_approval` — the TC can approve immediately. The opponent's dispute is *possible*, not *required*.
- `both` — the TC's approve action is unavailable until the players have agreed or the window has lapsed.

*This distinction is my reading of UV's description, not something he stated. Confirm before building.*

### What stays true from the existing design

- *"Approval is the end of the negotiation, not a checkpoint in it."* Still right. Approval is the terminal state.
- Coordinator edits after approval are **logged but do not reopen the card** and do not un-sign anybody.
- The card is still an append-only event log. `approved` and `rejected` become two more event kinds, alongside `submitted`, `agreed`, `disputed`, `reopened`.
- `card_version` still retires stale submissions, and should retire a stale **approval** the same way — an approval of a card that has since changed cannot stand on its own.

---

## Coordinator corrections

UV: *"LC and TC will have custom pages for managing tournaments and leagues where they will be able to manually change scores as needed (even locked matches) at frame level … and at match level … where I think TC and LC should have the power to overwrite but we should keep record of that as well."*

Two different powers, and they are not the same shape.

### Frame-level correction

A coordinator editing a frame on a locked match. This fits the existing design with no tension: frames stay the record, the edit goes through the normal write path with the lock bypassed for a role that is allowed to bypass it, and `tbl_frame_edit` records who, when, and before/after.

Mechanically this is the `tdc.card_unlock` flag that `tdc_delete_match` already uses, exposed to a coordinator role rather than to one function.

### Match-level override — and the invariant it breaks

Setting the **overall score without touching the frames**. A TC who is told "it finished 5–3" and has no interest in reconstructing eight frames at eleven at night.

This contradicts the project's oldest principle: *"Frames are the only truth. No cached scores, no denormalised totals."* A stored match score is exactly the cached total that principle forbids.

**Proposed resolution — an override is a separate, visible, administrative record, not a score written into the match.**

```
tbl_match_result_override
  match_id        (pk — one standing override per match)
  home_score      int
  away_score      int
  reason          text        not null
  set_by          player_id
  set_at          timestamptz
  counted_home    int         -- what the frames said at the time
  counted_away    int
```

Reading a match score becomes: *if an override exists, use it; otherwise count the frames.* One branch, in one place.

Why this rather than writing the score onto `tbl_matches`:

- **The frames stay honest.** They remain the record of what was played, not of what was decided.
- **It is visible as what it is.** A league table can always explain where a number came from, and a 5–3 that nobody played is labelled rather than disguised.
- **It is reversible.** Deleting the override restores the counted score, which a written-in score cannot do.
- **It carries its own justification.** `reason` is not optional. An override without a reason is the thing this feature will be blamed for.
- **It keeps the disagreement.** `counted_home` / `counted_away` record what the frames said at the moment of overriding, so "the frames say 4–4 and the TC said 5–3" is answerable later.

Open: whether an override should also be retired by a `card_version` change, as submissions are. My instinct is **no** — a TC overriding a score is deliberately overruling the frames, so a later frame edit should flag the override as stale for review rather than silently dropping it.

---

## Who is a coordinator

`private.tdc_can_edit_match` is already *"the single place deciding who may touch a card"* and carries a comment saying captains and league directors go in there when those tables exist. That remains the plan.

What is needed beyond it: editing and **approving** are different powers, and locking means a third question — who may edit a card that is locked. So the permission surface is three questions, not one:

| Question | Today | With competitions |
|---|---|---|
| May they edit an open card? | `tdc_can_edit_match` | plus captains, scorers |
| May they approve? | nobody | TD / LD for that competition |
| May they edit a **locked** card? | nobody | TD / LD, logged |

`tbl_competition_role` with a numeric rank, per the existing design. Scope beats seniority: a venue owner at another club does not outrank the TD of a tournament they are not running.

---

## Still to settle

1. **Confirm the `coordinator_approval` vs `both` distinction** above.
2. **Does a TC rejection need a reason?** A dispute does. Consistency says yes.
3. **What does the TC queue look like** — one page per competition listing cards awaiting approval, with the card inline? Probably, but it is the first screen built for a role rather than for a player.
4. **Unpublished results in a player's own view** — marked "awaiting the TC", or silent?
5. **Does an override need the match to be locked first**, or can a TC override an in-progress match? Overriding a match still being played seems like a mistake worth refusing.
6. **Review the whole lock/approval matrix per mode** once tournaments exist — UV's own note: *"I think we already have most of it correct. Its just the small stuff."*

---

## Why none of this can be built yet

Every path above needs a coordinator to exist, and a coordinator only exists inside a tournament or a league season. There is no `tbl_tournament`, no `tbl_competition_role`, and no way to say who the TC of anything is.

So the order is: **tournaments first, with this approval flow designed into them from the start** — not bolted on afterwards.
