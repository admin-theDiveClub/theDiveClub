# Brief: new 1v1 score input for /match/

Design agreed with UV on 26 Oct 2026 in claude.ai (canvas "Match Score Input"). This is a design to build into `/match/`, the one-vs-one scoring page. Team matches stay on `/leagues/card/`.

## How to work

1. Read `CLAUDE.md`, `docs/STATUS.md`, `docs/ui.md` and `docs/systems/matches.md` first.
2. This file is the settled design (`docs/design/match-score-input.md`). Check it against what is built. List anything here that conflicts with the systems docs or the decisions in `docs/ui.md` §2, and ask UV the open questions marked **Ask UV** before building. Do not guess.
3. Build in steps, one at a time, each tested at 420px portrait and a phone in landscape (render it), with a commit subject after each:
   1. Stage layout, cards, score digits, background
   2. Win input (card tap, special-win rings) and the break-event pill
   3. Slide-to-undo control (a new custom control)
   4. Frame history tables
   5. Player stats and match stats tables
   6. The timeline row (experimental, last)
4. Frames are the only record. Every stat below is counted from the frames, never stored.

## 1. Layout (both orientations)

- **Side by side in portrait and landscape.** No more top/bottom halves in portrait. This retires BACKLOG #1 (turn the top half 180°): note that in `docs/BACKLOG.md`.
- The stage still fills exactly one screen below the nav. Order down the stage: a small line "Frame 6 · Race to 5" (frame in the heading font), the two player cards side by side, then the break-event pill across the full width.
- In landscape the frame line sits in a narrow column between the two cards.
- **Open question for UV:** the design shows away on the left of the cards but home on the left of the history table. Ask which side home goes on, and use it everywhere.

## 2. Player card

- Three parts: a solid **header**, a transparent **middle**, a solid **footer**. Header and footer are a solid dark grey (#2b2b2b in the mock-up): this needs a new token in `variables.css` and on `/sandbox/`.
- **Header:** picture and name, name in Rushford Clean, centred.
  - Portrait: picture centred above the name.
  - Landscape: one row, name centred, the picture at the inner edge (left card's picture on its right, right card's on its left).
- **Middle:** the score. A single digit fills the card's width with a small margin, in Rushford Clean, stretched about 1.4× taller than its natural shape (not stretched to the full height). Leading score in `--color-primary`. Two digits (10+) must still fit the width.
- **Footer:** the special wins as ring icons (round buttons). Breaker's card: B&F, Golden break, ⋯ (more: won by default and the rest). Other card: Reverse B&F, ⋯. Same rules as today's `resultsFor()`.
- **The whole card is the button for a plain win.** Tapping anywhere outside the footer records a Win for that player. No separate Win button.
- **Depth:** header and footer cast a shadow onto the middle, the middle has a dark inset shadow round its edges, and the card has a soft drop shadow.
- **Breaking:** the breaker's card has a yellow (`--color-warning`, the team card's lag colour) border and glow, and a small yellow cue-ball badge on the picture.
- With `track_breaks` off (the simple card): no pill, no badge, no glow, and the footer offers only what the settings allow. The plain card tap is still the win.

## 3. Break event

- The **horizontal pill selector** from `tdc-controls.js` (`data-control="select"`), options Dry · In · Scratch · Foul, with its thumb and outline in `--color-warning` rather than green.
- One pill only, across the full width of the scorecard, under both cards. It belongs to the breaker.
- **Ask UV:** while no break event is set, should the special-win rings be hidden, greyed or live?

## 4. Background

- A radial gradient from `--color-primary` to `--bg-base`, its centre far above the top of the screen (in the mock-up: circle 1000px, centre 760px above the top), so only the faded edge shows at the top.
- **Fixed**: it stays still while the page scrolls. Use a fixed layer (a `position: fixed` element or `body::before`), not `background-attachment: fixed`, which iPhones ignore.
- The nav bar is see-through enough for the glow to show behind it.

## 5. Slide to undo (new control)

- Below the stage, before the frame history, so it is the first thing seen on scrolling down.
- A pill track with a cream round knob at the **right** holding an undo arrow, and the label "‹‹ Slide to undo frame 5". Drag the knob **right to left** to the end to undo the last frame. Released early, it springs back.
- It is a new custom control: build it in `tdc-controls.js` / `controls.css`, its sizes and colours as tokens, and **add it to `/sandbox/`** (palette's Controls group, the mock-up and the component list), as `docs/ui.md` requires for every control.
- It replaces the "Undo last" link in the history heading.

## 6. Frame history

Portrait (a row per frame):

| UV: Break | UV: Frame | # | Linton: Frame | Linton: Break |

- The player's name is a heading spanning their two columns. Last row: totals.
- Landscape: frames across (headings just 1, 2, 3 …), Total as the last column. Rows: UV Break, UV Frame, a time row, Linton Frame, Linton Break, with each name spanning its two rows.
- Everything centred in its cell.
- **Break cell:** a small yellow dot when we know who broke but no event was recorded, otherwise the event word in yellow.
- **Frame cell:** a green dot for a win. Golden break: green dot with a yellow ring. B&F: green dot with a green ring. (Ask UV for reverse B&F: suggestion, a cream ring.)
- **Times** (when the match records timing): portrait shows rack time in yellow under the break mark and frame time in green under the win dot. Landscape shows both in the time row, rack above frame, rack in yellow and frame in green.
- **Totals:** frames won in Rushford Clean, larger, green with a glow. Breaks in yellow, normal size. Landscape time total shows rack total over frame total.
- The frame in play is lightly shaded yellow and shows its rack time once racking is done.
- Corrections by tapping a cell keep working as today.

## 7. Player stats (new)

Three columns, UV · stat · Linton, in three groups:

- **Frames:** frames won (large, green, glow), B&F, golden break, reverse B&F, won by default, won on own break, won on the other's break, average length of frames won.
- **Breaks** (yellow): breaks taken, Dry, In, Scratch, Foul, not recorded.
- **Racking** (yellow): racks, rack time, average rack.
- **Ask UV who racks** (the non-breaker, the loser of the last frame, or other). Rack time per player depends on it, and today a frame does not record who racked.

## 8. Match stats (new)

Two columns, stat · value:

- **Result:** score, race to, frames played (with the one in play).
- **Time:** match time so far, playing time, racking time, average frame, average rack, longest and shortest frame (with the frame number).
- **Breaks:** how often the breaker won the frame, and how often a ball went in off the break (of the breaks recorded).

In portrait the two stats tables stack; in landscape they sit side by side.

## 9. Timeline (experimental, build last, ask before keeping)

- Landscape only: the time row becomes a timeline.
- A yellow tick on each frame's left edge marks racking, with its rack time above it. The frame time is centred in the frame's column. There is no dot in this row.
- One continuous grey line, smooth (spline through the points), behind everything. It starts on the base line at the first rack tick, passes through every win dot in the rows above and below, and ends in a dashed tail to the frame in play.
- Test variant: each frame column's width proportional to its rack plus frame time. A very short frame then needs a minimum width.

## Fonts and colours

- Headings, names, score digits and frame-count totals: Rushford Clean (`--font-display`). Body: the site's `--font-body`.
- Green `--color-primary`, lag yellow `--color-warning`, cream `--text-primary`, grey line about #6b6b6b (needs a token).
- Every value in `match.css` must be a token: add missing ones to `variables.css` and `/sandbox/`.

## 10. Answers (UV, 26 Oct, in Claude Code)

Checked against the built page before building. These settle the "Ask UV" points above and the gaps the check found; where they differ from the sections above, these win.

| Question | Answer |
|---|---|
| Which side is home? | **Home on the left, everywhere**: the cards, the history, the stats. (Today's stage draws away first.) |
| What can be tapped before the break event is set? | **The plain win is live, the special-win rings are greyed.** A card tap with no event records a Win with the break "not recorded" (it counts in Breaks: not recorded). Today the Win is disabled until an event is entered, so this is a change to `resultDisabled()`. Such a frame has no rack time: the whole period is frame time, as for a walkover |
| Reverse B&F in the Frame cell | **A plain green dot**, no ring and no label. "Reverse B&F is not that important." It is still counted in the player stats |
| Who racks? | **The breaker racks their own frame.** Rack time always belongs to whoever broke that frame; it is counted from `break_side`, nothing new is stored. Who breaks is decided by the break rule as today |
| The live rack and match clocks | **Counted from the frames**, the same on every phone and through a reload: match time runs from the first frame's `rack_started_at`, the live rack from the last frame's `ended_at`. Before frame 1 is finished there is nothing to count from, so it runs from the page opening, as today. Today both clocks are the scoring phone's own and restart when the page loads |
| The timing panel (pause frame and match, shot clock and turns, extensions, match clock) | **To be decided later.** Left where it is while the steps are built |
| The Scorecard panel (Submit, the answer buttons) | **At the very end of the page**, after the stats. The finished match still asks "Submit the card?" over the stage |

Taken as read (UV did not object, 26 Oct):

- The ⋯ menu keeps today's Walkover, Abandon frame and Change table.
- The "Who won the lag?" / "Who breaks this frame?" overlay stays, laid over the new cards.
- An abandoned frame shows "–" in its Frame cell, no dot.
- A PC is out of scope here; on a wide screen the landscape layout is used.
- Times are shown whenever a frame has them; there is no setting (every frame on `/match/` is timed).
- The clearer nav is on `/match/` only.
- The yellow break pill is the select control with `data-tone="warning"`, which the select gains (only the three-way switch has it today).
