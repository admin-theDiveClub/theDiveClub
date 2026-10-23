# Match scoring — test plan

> Moved from the project doc `claude/stats-test-plan.md` on 23 Oct 2026, word for word. League nights are not covered here yet; add a section when the session rework lands.

How this works: UV plays or taps through a scenario on a real device. Claude checks the database afterwards and ticks it off here, recording what was actually stored. No test needs Claude to have site access.

Each test says **what to do** and **what Claude checks**. Where a test leaves data behind, the match id goes in the Notes column so it can be found later.

Status: ☐ not run · ☑ passed · ✗ failed (see notes)

> **Priority right now:** sections 8, 11, 12 and 13. Five builds went in between 15 and 17 Oct and none has been played through by two people on two phones. Everything in them was tested by Claude against a scratch database, which proves the logic and proves nothing about a league night.

---

## 1. The ordinary path

These are what every user does every night. If these aren't solid nothing else matters.

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 1.1 | Open `/match/?id=<dummy>` signed in | Page loads, names and score correct, no console errors | ☑ |
| 1.2 | Score one frame: tap break event, then a result on a half | One new `tbl_frames` row, correct `frame_no`, `break_side` derived not manual, two participants | ☑ |
| 1.3 | Score three more frames | Breaks alternate correctly, `card_version` went up once per frame | ☑ |
| 1.4 | Reload the page | Screen matches the database exactly — the real proof that saving works | ☑ |
| 1.5 | Tap Undo | Frame gone, numbering closed up, no gap | ☑ |
| 1.6 | Walkover from the ⋯ menu | `result_event = 'default'`, `break_side` and `break_outcome` both null | ☐ |
| 1.7 | Abandon a frame from ⋯ | `status = 'abandoned'`, no winner, no result event | ☐ |
| 1.8 | Score the match out to its race target | Scoreboard shows Final, further scoring is refused | ☑ |

---

## 2. Corrections

The history table is where a mis-tap gets fixed, and where the trickiest rules live.

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 2.1 | Change an early frame's winner | Score follows, later frames' breaks re-derived if the rule depends on results | ☐ |
| 2.2 | Change who broke on frame 2 by hand | That frame `break_side_manual = true`; later frames follow from it | ☐ |
| 2.3 | Tap "Back to the rule" on that frame | `break_side_manual = false`, break side back to derived | ☐ |
| 2.4 | On a break & finish frame, change the break event to Dry | Stored `result_event` is `win`, not `break_and_finish`. Screen said so. **The repair pass** | ☐ |
| 2.5 | On a reverse B&F frame, change the breaker to the winner's side | Stored `result_event` is `win`. Screen said so | ☐ |
| 2.6 | Correct a frame in the middle of a long match | Only that frame changed unexpectedly; no renumbering | ☐ |
| 2.7 | Undo immediately after a correction | Correct frame removed — not the one that was corrected | ☐ |
| 2.8 | Tap a history cell | Menu drops out of the cell, not the stage; closes on Escape, outside tap, or a choice | ☐ |

---

## 3. Settings

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 3.1 | Change who broke first, mid-match | Every rule-driven break flips; hand-corrected frames don't | ☐ |
| 3.2 | Change the break rule from Alternate to Winner breaks | All breaks re-derived from results | ☐ |
| 3.3 | Set the break rule to "Lag every frame" | Page asks who broke each new frame instead of deriving | ☐ |
| 3.4 | Turn **off** "break & finish must go to the breaker", record one to the non-breaker, then turn it back **on** | That frame is downgraded to a win in the database, and the count comes back to the page | ☐ |
| 3.5 | Turn off golden break with one already recorded | Same — downgraded, reported | ☐ |
| 3.6 | Change the race target below the current score | Match reads as complete; sensible, not broken | ☐ |
| 3.7 | Answer "who won the lag", then score several frames | Asked **once**. `first_break_side` stored on the match, not just on screen | ☑ |

---

## 4. Timing

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 4.1 | Score a frame slowly, watching rack and frame time | `rack_started_at`, `started_at`, `ended_at` stored and in order | ☑ |
| 4.2 | Pause the frame mid-way, resume, finish | `paused_seconds` roughly matches the pause; frame time excludes it | ☐ |
| 4.3 | Pause the match clock, score a frame | Match time doesn't advance; frame time does | ☐ |
| 4.4 | Leave the page open for 10 minutes, then score | Times sensible, no runaway clock | ☐ |

---

## 5. Permissions

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 5.1 | Open the match signed in as someone not in it | Refused with "You are not on this match…", not a raw error | ☐ |
| 5.2 | Open it signed out | "Please sign in" notice, with a working link back | ☐ |
| 5.3 | Open as venue staff, not a player in the match | Allowed to score — the staff path | ☐ |
| 5.4 | Open as the opponent | Can score and correct — both players can, by design | ☐ |

---

## 6. Bad addresses

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 6.1 | `/match/` with no id | Mockup, clearly labelled as such | ☐ |
| 6.2 | `/match/?id=hello` | "That is not a match id", mockup shown | ☐ |
| 6.3 | `/match/?id=<valid uuid, no such match>` | "Match not found" | ☐ |
| 6.4 | A team match id (once teams exist) | Explains teams aren't built yet rather than half-rendering | ☐ |

---

## 7. Finishing a card

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 7.1 | Submit a card | `submitted` event at the current `card_version`, match goes `complete` | ☑ |
| 7.2 | Agree from the other account | State `agreed`; the agreeing player answers from the **result page**, not the stage | ☐ |
| 7.3 | Dispute with a reason | State `disputed`, the stage comes back for editing, reason shown | ☐ |
| 7.4 | Try to change a frame on an agreed card | Refused by the database, not just hidden on screen | ☑ (tested directly) |
| 7.5 | Try to reopen an agreed card, from either account | No Reopen button; "This result is final." The database refuses it too (changed 23 Oct — settled is final for players) | ☐ |
| 7.6 | Edit a frame while a card is awaiting an answer | The submission lapses — state back to `in_progress` | ☑ (tested directly) |

---

## 8. Two scorers at once

**Rebuilt 17 Oct: refuse and reload.** Every frame write carries the version the browser last read, and a write aimed at a card that has moved on is refused with SQLSTATE `TDC01`. These used to be expected failures; they are now expected refusals. Needs two devices.

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 8.1 | Both score the same frame number within a few seconds | The second is **refused**, not stored on top. Its screen says someone else has scored and shows their version | ☐ |
| 8.2 | One adds a frame, the other taps Undo without reloading | The Undo is **refused** — this was the nastier bug, where it removed the other person's frame | ☐ |
| 8.3 | Both correct different frames at the same time | The second is refused and reloaded. Nothing is merged | ☐ |
| 8.4 | Both devices score the frame that ends the match | Only one `submitted` event; the device that lost the race says nothing alarming | ☐ |
| 8.5 | After a refusal, score again on the same device | Works — the reload brought a fresh `card_version` | ☐ |

---

## 9. Offline

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 9.1 | Aeroplane mode, score three frames, come back online | All three stored, in order, breaks correct. **The queue is not version-checked per frame** — it checks once before replaying | ☐ |
| 9.2 | Aeroplane mode — confirm the stage still works and settings/history are locked | Behaviour matches the design | ☐ |
| 9.3 | Go offline, score, close the browser, reopen, come back online | Queue survived, or said plainly that it didn't | ☐ |
| 9.4 | Go offline, score, meanwhile someone else scores online, reconnect | The whole queue is held back and reported, not partly applied | ☐ |
| 9.5 | Go offline and score the frame that ends the match | **No** finish prompt; the card waits to be submitted by hand | ☐ |

---

## 10. Real world

The ones that only show up in a club.

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 10.1 | Score a full league night on a phone, start to finish | Everything stored; anything surprising noted | ☐ |
| 10.2 | Hand the phone between two players each frame | No confusion about which half is whose | ☐ |
| 10.3 | Score with the screen rotating between portrait and landscape | No lost state, both history tables agree | ☐ |
| 10.4 | Someone's phone locks mid-frame, unlock and continue | Clock sensible, frame intact | ☐ |
| 10.5 | Give it to a player who has never seen it | Where they hesitate — the only test that finds UX problems | ☐ |

---

## 11. Approval and finishing

Built 15 Oct, amended 17 Oct so the finish **asks first**.

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 11.1 | Start a match, leave approval alone, score it out to the target | Default is the **48-hour window**. At the target the page asks "Submit the card?" — it does not submit on its own | ☐ |
| 11.2 | Same, but set Approval to "No approval needed" | The prompt says it settles straight away. On Submit: two events in one go, `submitted` then `agreed`, card locked | ☐ |
| 11.3 | On that settled match, try to change a frame | Refused, and there is no Reopen — the result is final (23 Oct) | ☐ |
| 11.4 | Answer **Not yet** at the prompt | Card stays open, Submit button still there, no event written | ☐ |
| 11.5 | Dispute a finished match from the other account, then correct **two** frames | It does **not** ask again after the first fix. Only the frame that *ends* a match prompts | ☐ |
| 11.6 | Submit by hand, then tap **Withdraw** as the submitter | `reopened` event, stage comes back | ☐ |
| 11.7 | Try to Withdraw from the *other* account | Refused — "say what is wrong with it instead" | ☐ |
| 11.8 | Play a **best of 5** out to 3–1 | Match reads as over at 3. Previously only "race to" ever ended | ☐ |
| 11.9 | Play a **fixed 4 frames** to 2–2 | Over, with no winner. A drawn match is still finished | ☐ |

### Notifications

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 11.10 | Create a match against Linton | He gets "You are in a match — … Race to N, 8-ball" | ☐ |
| 11.11 | Finish a 48-hour-window match | He gets "Scorecard to check" | ☐ |
| 11.12 | Finish a no-approval match | He gets "Match finished — … settled" instead | ☐ |
| 11.13 | Agree, dispute, and delete | One notification each, to the right person | ☐ |
| 11.14 | Send a test notification from the iPad | If it still fails, the message now names the reason | ☐ |

---

## 12. Live updates

Built 17 Oct. **Two devices, both on the same match page.** The passive device should follow without being touched.

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 12.1 | Score a frame on phone A, watch phone B | B's score follows within a second or two, untouched | ☐ |
| 12.2 | Correct an early frame on A | B follows, including any break sides that moved | ☐ |
| 12.3 | Undo on A | B follows — a removal arrives even though no DELETE is subscribed to | ☐ |
| 12.4 | Submit on A, agree on B, watch A | A's result page updates itself — agreement writes only an event, which is why it has its own subscription | ☐ |
| 12.5 | On B, tap a break event (do not finish the frame), then score on A | B does **not** redraw under your hands. A banner offers a refresh instead | ☐ |
| 12.6 | Tap that refresh link | B catches up, banner clears | ☐ |
| 12.7 | Finish B's frame instead of tapping refresh | The banner clears by itself — B's own save pulled the change in | ☐ |
| 12.8 | Lock phone B, score two frames on A, unlock B | B is correct on waking. **This is the one that matters** — it proves missed events are harmless | ☐ |
| 12.9 | Aeroplane mode on B, score on A, bring B back | Same — B re-reads when the connection returns | ☐ |
| 12.10 | Open the match on a **third** account that is only watching | It follows live and still cannot score | ☐ |

---

## 13. When a match is played

Built 17 Oct.

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 13.1 | Create a match with a **When** set for next week | `scheduled_at` stored; the opponent's notification carries the date | ☐ |
| 13.2 | Create one with When left blank | `scheduled_at` null; one notification, no mention of a time | ☐ |
| 13.3 | Change the time on the match page | **Both** players are notified, including you | ☐ |
| 13.4 | Clear the time | "Match time cleared" to both | ☐ |
| 13.5 | Set a time with a year typed wrong (2036) | Refused — "more than two years away, check the year" | ☐ |
| 13.6 | Try to set a time on a settled match | The field is disabled, and the database refuses it too | ☐ |
| 13.7 | Check the time shown in the notification against the field | Field is your local clock; the notification is South African time | ☐ |

---

## 14. Tournament cards: published, objected to, sent back

Fixed 23 Oct (`20261023185945`, A7 in `docs/STATUS.md`). Proven locally by `014_match_approval`; never played on the live site. A throwaway tournament with two player accounts and you as TD is enough. Leave approval on the default (48-hour window).

| # | Do this | Claude checks | Status |
|---|---|---|---|
| 14.1 | Player A scores a couple of frames and submits | Player B sees a **published** result with "if this is wrong, say so by …" and an objection option — **not** "Looks right" | ☐ |
| 14.2 | Player B objects with a reason | Card stays locked, result stays published; the objection shows for the TD. B cannot object a second time | ☐ |
| 14.3 | TD presses **Send back** with a note | The note shows; player A can change a frame again | ☐ |
| 14.4 | Player A fixes a frame and submits again | Published again | ☐ |
| 14.5 | If the match had already put someone into the next round: watch the bracket after 14.3 | Does the next-round slot empty, or keep the player? Not checked by the tests — note what happens | ☐ |

---

## Notes and results

| Date | Test | Match id | What happened |
|---|---|---|---|
| 15 Oct | 1.1–1.4, 1.8, 3.7, 4.1, 7.1 | `90722948-3c5a-4ced-935e-6b833ba57a5e` | UV scored a full 8-frame match on a phone and submitted it. Everything held: breaks alternated correctly from `first_break_side = away` with **every** frame derived (none manual), and the lag was asked once. All four result types appeared and all were stored legally — golden break and break & finish to the breaker, reverse break & finish to the non-breaker. Rack, start and end times on all eight frames. Two participants per frame. Away won 5–3, match reached `complete`, card state `awaiting`. Nothing to correct. |
| 15 Oct | 7.4, 7.5, 7.6 | (temporary, deleted) | Tested directly against the live functions. An agreed card refused a new frame, a changed frame, a removal, a settings change and a second submission — with the card untouched afterwards. Reopening restored writing; reopening an open card was refused; an agreed match could still be deleted. |
| 15 Oct | — | `215b10ec-de44-4c61-a513-ab9768c43e72` | Frames went from 5 to 0 during testing. Expected if Undo was used repeatedly; worth a glance if that wasn't deliberate. |
| 15 Oct | — | `09013847-d30e-41f8-91ed-9be09108d8f7` | The simple-card dummy: 4 frames, free play, submitted and awaiting an answer. Good one to test **7.2 Agree** on from Linton's account. |
| 15 Oct | — | `7fe49298-633e-433b-b8a3-efbc05b49acc` | Deleted by UV at 22:01 while testing. The tombstone was written correctly (`Owner@TDC 1 – UV 1, 2 frames`), which confirms the new `tdc_delete_match` in production. No notification went out because the **site** had not been deployed yet — the page had no code to send one. |
| 17 Oct | 8.x (by Claude, not by play) | (scratch database) | The conflict guard was proven against a throwaway Postgres with the real schema and functions: a write at the current version was accepted and bumped it; a second device at the old version was refused with `TDC01`; a stale Undo was refused; an offline replay passing no version was accepted. Two frames stored, none overwritten. **Still needs two real phones.** |
| 17 Oct | 13.x (by Claude, not by play) | (scratch database) | `tdc_set_match_time` accepted a time, accepted a clear, refused a date three years out, refused an unknown match and refused a settled card. The notification was checked against stubs: both players told, time rendered in SAST, and creating with a time folded into the single "you are in a match" message. |
