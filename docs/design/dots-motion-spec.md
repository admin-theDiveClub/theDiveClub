# The Dots: loading and feedback motion system

Design spec and handover for theDiveClub. Settled in a design session on 26 Oct 2026 with UV.
Reference prototype: `docs/design/dots-prototype.html` (open it in a browser; it is the source of truth for how the motion should *feel*).

---

## 1. Purpose (read this first)

The dots exist to **communicate that something is happening, and where**. They are a loading and feedback indicator, not decoration.

- When the user taps something that makes a network call, the dots go to that thing and stay alive there until the call finishes. Then they draw the result in and leave.
- On page load, the dots travel from element to element **in the order elements are still loading**, so the user sees the page being assembled.
- On a fast connection the dots should be barely visible. On a slow connection they should look great. Speed of the network decides how much of the show the user sees; the dots never add delay of their own.

Inspiration: Claude's own "working" dots. Four dots, apparently 3D, always moving as one living thing.

Design rule of thumb: every decision should make the dots feel **alive, organic and physical**: particles with mass that fly, settle, squash and glow, never sprites that snap between positions.

---

## 2. Vocabulary

| Term | Meaning |
|---|---|
| Dots | Exactly four particles. One shared colour at a time. |
| Target | The element the dots are currently serving (a button, icon, tab, number, card…). |
| Ring | A circle around the target. Icons already have a real visible ring (circle border around the icon). Elements without one get a **fake ring** (section 6). |
| Sphere | An invisible sphere whose **equator is the ring**. Its radius equals the ring radius. The dots live on its surface while waiting. |
| Ground | The plane of the screen at the equator. "Above ground" = towards the viewer, "below" = away. |
| Ground size | The dot diameter when it sits exactly on the ground: **equal to the stroke width of the line it is on or following**. |
| Trace | Dots running along the target's lines (icon strokes, button outline, tab underline, digits) while those lines fade in. |

---

## 3. Lifecycle of one interaction

| # | Stage | What happens |
|---|---|---|
| 1 | Tap | Target goes into a busy state (icon dims, ring/outline hidden). Dots fade in if hidden, otherwise leave immediately from wherever they are. |
| 2 | Travel | Dots move **as one** cluster with a springy, slightly lagging follow (each dot lags a little differently). They **lift** while travelling (grow, as if rising off the page), cruise high, then **settle** down into the next sphere. Colour blends to the target's colour during the trip. Fast movement stretches dots along their direction of travel. |
| 3 | Orbit (waiting) | Dots live on the target's sphere and perform moves (section 8) until the network call resolves. Size and brightness show height. |
| 4 | Dive and trace | When the call resolves, each dot flies loosely from the sphere to a point on the target's lines, **shrinking to the line's stroke width** as it arrives, then runs along the lines while the lines fade in (section 9). |
| 5 | Reveal | The moment tracing is complete, the real element appears (icon + ring fade in quickly, about 0.25s; outlines and underlines return; number updates). |
| 6 | Ring race | Dots swing back out to the ring and race clockwise around it at ground size, slight bob for depth, roughly 2 laps/second. |
| 7 | Fade | After the ring is **fully** visible (read the element's actual transition duration), dots fade out while still racing. |
| 8 | Hidden | Dots stay hidden until the next tap or the next loading element. They do not idle on screen. |

Interruptions:
- Tap another target at any time: dots leave **immediately** for the new target. The abandoned target restores itself normally when its own call finishes (no dots).
- Tapping a target that is already busy does nothing.

---

## 4. The sphere model

The core idea that makes the dots look 3D.

- Each dot's position is a **unit 3D vector on the sphere**. Screen position = ring centre + ringRadius × (x, y). The z component is **height above ground**.
- The ring is the equator. A dot on the ring line is at height 0.
- **Size from height:** `size = groundSize × 2^(1.5 × height)`. On the ring line a dot is exactly the stroke width; at the top of the sphere (over the centre) about 2.8×; at the bottom about 0.35×.
- **Brightness from height:** opacity ≈ 0.35 + 0.65 × (height + 1) / 2. Higher = brighter, lower = dimmer.
- Dots **never leave the sphere surface** while orbiting. They only reach the inside of the ring by going over the top or under the bottom of the sphere (which shows as large-and-bright or small-and-dim). The only exceptions are diving in to trace, the black hole, and the shadow dots (section 8).
- Motion on the sphere uses a 3D spring towards a target point, renormalised to the sphere each frame (velocity kept tangent). This gives follow-through and overshoot for free.

---

## 5. Stroke-width matching

The dots always take the width of the stroke they are following. Read these from the live page (computed styles), never hard-code them.

| Dot is… | Ground size = |
|---|---|
| On or racing around an icon ring | The ring's border width |
| Tracing an icon | The icon's stroke width (Tabler outline = 2px at 24px icon size; scale with icon size) |
| Tracing a button / switch outline | That element's border width |
| Tracing a tab underline | The underline (border-bottom) width |
| Tracing a number | The number's stroke width (6px in the prototype) |
| On a fake ring | Default 1.5px, or the element's border width if it has one |

Size changes are always **smooth** (eased), never jumps: a dot swelling from 1.5px on the ring to 6px on a digit grows as it flies in.

Height-based depth still applies on top of ground size, so dots can pulse bigger/smaller for depth while racing a ring.

---

## 6. Rings and fake rings

| Element | Ring used |
|---|---|
| Icon with a visible ring | The real ring. Ring colour = icon colour. Ring is hidden while busy and fades in at reveal. |
| Everything else (buttons, cards, numbers, list rows, images…) | A **fake ring**: invisible circle centred on the element. Never drawn, never revealed. Dots orbit and race on it exactly as on a real ring. |

**Fake ring size:** `radius = (half the element's bounding-box diagonal) + RING_MARGIN`.
- `RING_MARGIN` is a design token, default **6px**, adjustable in the sandbox.
- Wide elements (e.g. a full-width button) give very large circles. In the sandbox, also try a **cap** (e.g. max radius 48px, centred) and pick what looks best. Flag the result to UV.

---

## 7. Organic motion rules

1. **Nothing teleports or snaps into formation.** Every position change goes through a spring or eased curve. Dots arrive loosely, each slightly differently.
2. **Each dot has its own lag and timing**, so the group reads as living particles, not a rigid shape.
3. **Clockwise by default.** Wherever a direction is a free choice (orbits, races, shooting stars, group laps, ball spin seen from above), go clockwise so motion flows naturally into the ring race and doesn't fight it. Exceptions by nature: over/under/juggle (cross the centre), collide (pairs meet), and tracing (follows each glyph's own path direction).
4. **Squash and stretch** everywhere it makes sense: stretch along velocity when fast; squash on landings and impacts; anticipation squash before bursts.
5. **The 12 principles of animation** guide every move: squash and stretch, anticipation, staging, slow in/out, arcs, follow-through and overlapping action, secondary action, timing, exaggeration, solid drawing (3D volume), appeal.
6. **Staging:** only one dot does a "big" solo move at a time; the others calm down (about 70% speed, smaller bob) so the big move reads clearly.
7. **Trails** (short fading tails) on fast or graceful moves only. **Glow** on energetic moments (see section 8). Both take the current dot colour.
8. Base orbit speed is brisk (about a lap per 1.2s). Waiting should feel energetic, not sleepy.

---

## 8. Move catalogue (waiting state)

While waiting, each dot runs its own random **solo** moves on a timer. Every 2–5 seconds a **group** move takes over all four dots, then they return to solos. Weights below are relative frequencies in random mode.

### Solo moves

| Move | Weight | ~Duration | Description | Glow / trail |
|---|---|---|---|---|
| cruise | 3 | 0.9–1.7s | Clockwise along the ring, gentle bob above/below ground | – |
| splat | 1.2 | 1.5–1.8s | Rises (slight shrink, gathering), falls accelerating, hits ground and squishes: half the time an even pancake, half an oval at a random angle. Jelly wobble back to round. | flash on impact |
| flatten | 1.2 | 1.6–1.9s | As if a ball rolls over it: small bulge (anticipation), pressed into a wide smear crosswise to the roll, holds, springs back with a jelly wobble | – |
| hop | 1.1 | 0.8s | Crouch (squash), spring up stretched, hang at the top, land with squash + tiny rebound | soft |
| dive | 0.9 | 0.8s | Same as hop but below ground | – |
| shoot | 0.8 | 1s | Pull back (anticipation), burst most of a lap, overshoot and settle | medium |
| comet | 0.9 | 1.1s | Bigger shooting star | strong + trail |
| over | 0.9 | 1–1.25s | Small wind-up, arc over the top through the centre, land on the far side | soft |
| under | 0.7 | 1–1.25s | Same underneath | faint |
| tilt | 0.8 | 2–2.4s | Two laps on a tilted orbit | soft + trail |
| spiral | 0.8 | 1.8–2.2s | Circles while climbing to the top (or bottom) and back | medium + trail |
| settle | 0.8 | 1.1–1.4s | Eases to a stop, breathes with a tiny pulse, picks back up | pulse |
| weave | 1 | 1.6–2s | Weaves up and down while orbiting | – |
| reverse | 0.5 | 1.1–1.3s | Brief backpedal mid-move, then clockwise again | – |
| wobble | 0.8 | 1.5–2s | Unsteady, tipsy path | – |
| zigzag | 0.8 | 1.3–1.6s | Sharp up/down switchbacks | – |
| drop | 0.9 | 1.3–1.5s | Slow rise, sudden fall, big landing squash | flash on landing |
| jitter | 0.7 | 1.1–1.3s | Excited vibration (charging), then a dash | charges then releases |

### Group moves

| Move | Weight | ~Duration | Description |
|---|---|---|---|
| shadows | 1.2 | 4.6s | A tilted "floor" (faint dotted ellipse, random angle) appears through the centre. Two dots bounce above it on opposite sides. The other two become their **shadows**: projected flat onto the floor along a random light direction, squashed to the floor's angle, dimmer, and larger + blurrier + fainter the higher their dot is. Shadows peel back onto the sphere at the end. |
| stars | 1.1 | 4.6s | Dots spread over the sphere; the sky turns very slowly. Each twinkles on its own rhythm: dim and small, then a sharp bright glowing peak. |
| blackhole | 1.1 | 3.6s | A Saturn-style system appears at a random 3D tilt: small glowing core, three rings; front half of the rings bright and over the core, back half dim and behind it, a shimmer travelling round. Dots spiral down into it one by one, accelerating, stretching into streaks and dimming. A beat of nothing, then all burst back out to the ring with a flash and trails. |
| moons | 1.1 | 5.2s | Two hosts, enlarged, orbit the ring on the sphere. The other two are small moons (about half the host's size), each on a tight 3D orbit round its host at a random tilt per run, growing in front of it and shrinking behind; they may leave the sphere. Their trails are long enough to trace most of the ring as the host travels. *(Revised by UV, 26 Oct.)* |
| pool | 1 | 6–12s | *(Added by UV, 26 Oct.)* A table (a plane at a random tilt, its edge the cushion, a faint dotted ellipse) inside the ring. Dots 0 and 1 are balls just above it; 2 and 3 their shadows, flattened and foreshortened onto it, dimmer, blurred, offset along a random light. The cue ball pulls back (slight stretch), accelerates evenly into the object ball (usually a cut), they collide elastically with a flash, bank off the cushion losing energy, and stop under drag (proportional to speed plus rolling friction). Long trails while moving; at rest everything blends back onto the sphere. Ends when the balls stop. |
| merge | 1 | 7s | *(Added by UV, 26 Oct.)* Virtual particle pairs. The pairs take turns: a pair pops in as one glowing dot somewhere on the sphere (squash), splits, runs a small loop and recombines with a flash (annihilation), and pops out; the next pop is well away from recent ones, the dots unseen between and moved there at once. About a third are Hawking pops: a faint core glows at the centre, one partner falls in (stretching, dimming), the other escapes past the ring with a glowing trail, and both vanish where they are. At the end all four pop back in evenly round the ring. |
| steamroll | 1 | 2.8s | Dots sit evenly spaced; an invisible ball rolls clockwise round the ring and flattens each in turn; each jiggles back to round behind it. |
| ball | 1 | 3.6s | Dots become four spots evenly spread over an invisible ball (tetrahedron corners) and the ball spins on one random axis at one random speed, held steady for the whole move (always clockwise seen from above). Only size/brightness show which side a spot is on. No ball is drawn. |
| conga | 1 | 2s | Single file chasing a leader, two laps, each following the bob of the one ahead. Trails; leader glows. |
| atom | 1 | 2.4s | Each dot on its own tilted orbit like electrons. Trails + glow. |
| burst | 1 | 1.8s | Gather, crouch together (glow builds), explode apart clockwise (two over, two under) and overshoot into place. |
| juggle | 1 | 2.1s | Dots arc over the top one after another, each with wind-up and landing squash. |
| wave | 1 | 2s | Evenly spaced; a stadium wave lifts each in turn. |
| binary | 1 | 2.2s | Two pairs, each spinning around itself while orbiting. |
| collide | 0.9 | 1.7s | Pairs rush together, squash + flash on impact, bounce apart. |
| polar | 0.9 | 2.2s | All four spiral up to the top, swirl, come back down. Trails + glow. |

Implementation notes:
- Each move is a function of progress (0→1) returning a target point on the sphere plus optional overrides: squash/stretch (x, y scale and angle), glow, trail on/off, size multiplier, visibility multiplier, blur. Keep moves as **data-driven entries in a registry** so adding one later is one function plus one table row.
- Group moves also need a start hook (pick random axes/planes, assign spots) and may draw extras on a canvas layer (black hole disk, shadow floor).

---

## 9. Tracing (the "draw")

- The line set comes from the target: icon SVG paths, button/switch outline (rounded rect from the element's box and border radius), tab underline, digit paths.
- All lines are joined into one long path. Each dot gets a different **start offset** (spread around the path, with jitter), covers about **45–70%** of the total length at its own pace (±15% duration), with slow-in/slow-out. Dots overlap and cross; they do **not** split the shape into rigid quarters.
- Where the path jumps between separate lines, the dot **swoops across** with a spring, not a jump.
- While dots trace, the lines themselves **fade in as a whole** (opacity 0→1 over the draw duration). The dots are tracing, not literally drawing the line.
- Dots shrink to the stroke width on arrival (section 5), stay mostly flat (little depth), with a slight wobble so they still read as particles. Soft glow while tracing.
- Draw durations in the prototype: icon 1.3s, outline/underline 1.5s, number 1.5s + 0.5s per digit. All scaled by the **draw speed** control.

---

## 10. Element types

| Type | Waiting | Trace | Reveal | Finish |
|---|---|---|---|---|
| Icon with ring | Sphere on real ring | Icon strokes | Icon + ring fade in (0.25s) | Ring race, fade after ring is fully in |
| Outline (button, switch, card) | Sphere on fake ring | Outline | Outline/label return (switch flips) | Brief hover, then fade |
| Underline (tab) | Sphere on fake ring | Underline | Tab becomes active | Brief hover, then fade |
| Number | Sphere on fake ring | Digits of the **new** value (old value hidden while tracing) | New number appears, no ring | Race on fake ring, fade |
| Other / generic | Sphere on fake ring | Element outline if it has a border, else skip tracing | Element content appears | Race on fake ring, fade |

---

## 11. Colour

- Dots take the **target's colour** (icon colour for icons, primary text colour otherwise), blending smoothly during travel. Tracing lines use the same colour.
- Rings follow their icon's colour.
- Icons can use brand colours. The prototype uses placeholders: green `#2FBF71`, amber `#EF9F27`, blue `#378ADD`, purple `#7F77DD`. **Replace with real brand tokens** (see open questions).

---

## 12. Page load sequencing

- Elements that load data register a pending promise with the dots system (e.g. `dots.track(element, promise)` or a wrapper around the existing fetch/Supabase calls).
- **Grace period:** dots only appear if something is still pending after about **150ms**, so instant loads show nothing (no flicker).
- Dots go to the first still-pending element in load (DOM) order, wait there, trace it when it resolves, then fly on to the next pending one. Elements that finish before the dots arrive are skipped (they simply appear).
- When nothing is left pending, the last element gets the normal ring race and fade.
- The same queue handles taps: a tap is just a high-priority pending element (see open question 3 for whether it preempts the load sequence).

---

## 13. Sandbox page

Add a dev sandbox page (or extend the existing one if the repo has one; check `CLAUDE.md`) that reproduces the prototype with real site components, plus controls:

| Control | Purpose |
|---|---|
| Network delay | Fake call duration (0.3–15s) so slow loads can be studied |
| Animation picker + Random toggle | Force one solo or group move on repeat; untick to return to random |
| **Draw speed** | Multiplier on trace duration (0.25×–3×) |
| **Fade speed** | Multiplier on the final ring race hold and fade (0.25×–3×) |
| Ring margin | `RING_MARGIN` for fake rings (0–24px), plus the radius cap option |
| Status line | Shows the current move (e.g. "Group: blackhole" or the four solo moves) |
| Simulate page load | Button that reloads a set of sandbox elements with staggered random delays to test sequencing |

Include at least: icons with rings in several colours, a tab bar, a switch, a primary button, a list row with an icon button, and a big counter number that increments on tap.

---

## 14. Technical requirements

- One `requestAnimationFrame` loop. Animate only `transform` and `opacity` on the dot elements; draw trails and group extras on a single canvas layer. Pause when the tab is hidden.
- Frame-rate independent (scale all springs/eases by real delta time).
- Read stroke widths, colours, radii and transition durations from computed styles, so the system adapts when the design changes.
- Use **local** Tabler SVG paths (not a CDN fetch) for icon tracing.
- `prefers-reduced-motion`: no orbiting or flying. Show a simple calm pulse on the target while busy and a plain fade-in on completion.
- No added latency: the dots never delay showing a result beyond the trace/reveal sequence, and the trace should be skippable/shortened if another call is queued.
- Visible debugging per project convention: if anything fails (icon path missing, target removed mid-flight), log it and show the "TDC (Error)" marker rather than failing silently; the target must still end in its correct final state.
- Must work on mobile Safari/Chrome at 60fps with four dots plus canvas.

---

## 15. Open questions for UV (ask before building)

| # | Question |
|---|---|
| 1 | Exact brand colours (hex) to replace the placeholders, especially the site's green. |
| 2 | Numbers: single-line digits like the prototype (dots follow a centre line), or dots running around the outline of the site font's digits? |
| 3 | During page load, does a user tap take the dots away immediately, or does the load sequence finish first? |
| 4 | Fake rings on wide elements: plain diagonal + margin, or capped radius? (Decide in the sandbox.) |
| 5 | Which real site buttons/elements get dots in the first release? |

---

## 16. Build order (suggested)

1. Engine: dot state, sphere model, springs, render loop, stroke-width/colour reading. Travel + cruise + ring race + fade only.
2. Tracing system and element types (icon, outline, underline, number, generic).
3. Sandbox page with all controls.
4. Move registry, then port solo moves, then group moves, checking each against the prototype.
5. Page-load queue and the `track()` API.
6. Reduced-motion and error handling.
7. Wire into real site elements (after UV picks them).

Pause for UV to review in the sandbox after steps 1, 3 and 4.
