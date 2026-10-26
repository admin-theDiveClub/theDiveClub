# The dots — loading and feedback motion

> Built from `docs/design/dots-motion-spec.md` (the architecture and requirements) and `docs/design/dots-prototype.html` (how it should feel). Started 26 Oct 2026. **In progress: steps 1 to 4 of the spec's seven (§16) are built.** This file says what exists and why it is shaped that way; the spec says what is still to come.

## 1. What it is

Four dots, **one set for the whole page**, that show that something is happening and where. A target that makes a network call gets them: they fly to it, live on an invisible sphere round it until the call is back, then (from step 2) trace its lines, race its ring and fade. On a fast connection they are barely seen; the network decides how much of the show there is, and the dots never add a delay of their own.

**It will replace the per-element dots** in `scripts/ring-status.js` (UV, 26 Oct): every checkbox, switch, three-way switch, nav button and fixture icon is to be served by the one travelling set. That is step 7; until then `ring-status.js` is unchanged and the new engine runs only on `/sandbox/dots/`.

## 2. Files

| File | Job |
|---|---|
| `scripts/dots.js` | The engine, `TDCDots`. Not yet in `layout.html`: the sandbox loads it |
| `stylesheets/dots.css` | The layer, and what a target looks like while busy and while it comes back |
| `variables.css` `--dots-*` | Every size and time (§5) |
| `sandbox/dots/index.html` + `scripts/sandbox-dots.js` | `/sandbox/dots/`: real components that pretend to call the network. Styles at the end of `sandbox.css` |

## 3. How it works

**The API.** `TDCDots.serve(el, promise, { reveal, trace })` marks `el` busy (`data-dots="busy"`), takes the dots to it and returns the promise. When the promise settles, either way, `reveal()` puts the result on the page at once (a new number, a switch flipped), hidden while the dots trace it (`data-dots="tracing"`, `data-dots-trace` the kind); then `data-dots="revealing"` while its transition brings it in, then the attributes go. A target already busy is not served twice; the dots wait for both calls. Served again while it is still being traced, that trace ends at once and a new serve begins. Step 5 adds `track()` and the page-load queue on top of this.

`trace` says what the dots trace (spec §10), and defaults from the target:

| `trace` | Lines | Their size and colour | Default for |
|---|---|---|---|
| `icon` | The ring icon's own `.mark.on` paths, read after `reveal()` so the **new** icon is traced. They fade in themselves; nothing is copied | The marks' computed stroke and width (the cue ball's per-stroke widths come out exact), scaled from the 100 box | Anything holding a `.tdc-ring` |
| `number` | **The number itself, in the site's font**, fading in as a whole under the dots; nothing is drawn in another hand (UV, 26 Oct). The dots' way round each digit is the prototype's single-line digit (a 10 × 16 box), never drawn: fitted over the real digit's ink (`measureText` and a Range per character), both ways, inset by half the font's stroke so it runs down the middle of the strokes | **The font's stroke** (UV: "dots should be thick when they are drawing"; an approximate size is enough): measured once per font across the middle of a "0" drawn on a hidden canvas, and kept. 17.5px on the sandbox's 4rem counter. The text colour | Asked for |
| `tab` | The chosen tab's pill outline, inset by half the line, from its box and border radius, starting at the top middle | The tab bar's outline width (`.league-nav`); the colour the chosen tab fills with | Asked for |
| `none` | Nothing: the dots stay on the fake ring and the target comes back as they race it (UV, 26 Oct: "the trace as a ring using the shorter dimension is enough on buttons") | | Everything else |

A tab's outline is drawn on the layer's SVG (`svg.tdc-dots-lines`) and placed over the target every frame; at the reveal it fades out in the target's own reveal time while the tab fills, so they crossfade. Every set of lines becomes a list of points carrying the stroke's width at each: a digit's are worked out directly from its curves; an icon's and a tab's are sampled from their SVG paths (every 3 units), and an icon's are kept once worked out, because the browser takes about 4.5 ms per 100 points (sampling a four-digit number that way cost a 47 ms frame and a 14px jump of the dots; it now takes 2 ms). **A switch is served as a ring (UV, 26 Oct)**: its knob is a real ring, so the dots wait on it, the knob slides to its new side when the call is back, and they trace the new tick or cross inside it as it goes (the target is measured every frame, so they follow it).

**Interruptions (spec §3).** Serving a new target takes the dots there at once from wherever they are. The old target stays busy until its own call is back and then comes back **without the dots**. Checked 26 Oct: three targets tapped in quick succession, the first two came back on their own, the last got the race, nothing was left marked.

**The layer.** One `div.tdc-dots`, fixed over the whole screen above the nav (`z-index: 1000`, the nav is 100), `pointer-events: none`. One canvas (trails, and later a group move's extras), one SVG (the lines drawn for a number's or a tab's trace) and four `span.tdc-dot`, moved by `transform` and `opacity` only. Added to the page on the first serve.

**The loop.** One `requestAnimationFrame` for everything. It **stops when the dots are hidden**, so an idle page costs nothing, and starts again on a serve. `dt` is measured in 60 fps frames and capped at 50 ms, so every spring runs the same at any frame rate and a tab coming back does not jump.

**The target is measured every frame**, so scrolling or a layout change never strands the dots:
- **A real ring** is any target holding a `.tdc-ring`: its `circle.ring`'s centre, radius and stroke width, scaled from the SVG's 100 box to the screen.
- **A fake ring** is anything else: centred on its box, its radius **half the box's shorter side** plus `--dots-ring-margin` (UV, 26 Oct): a wide button's height, a tall stepper's width. So a 46px-high full-width button gets a ring 59px across in its middle, and the dots cross its face as they go round. Its stroke is the element's border, or `--dots-fake-stroke` if it has none. (The spec's half-diagonal gave that button a ring about 374px across, far wider than the page.)

**Colour (UV, 26 Oct): the dots take the colour of the line they are on.** On a real ring that is the ring's stroke (cream today); on a fake ring the element's border colour, else its background, else its text. It is read once, at the serve, **before** the busy state makes the border transparent. Colour is part of each dot's pose (below), so it blends wherever the dots do: over a trip with the sphere, into the traced lines' colour as they dive in, back to the ring's as they swing out to race.

**The sphere (spec §4).** Each dot is a unit vector; screen position is the ring centre plus radius × (x, y), and z is height above the page. Size is `stroke × 2^(1.5 × height)`; brightness rises with height. Motion on the sphere is a spring towards a target point, renormalised to the surface each frame, its velocity kept tangent.

**The animation runs, the dots show it (UV, 26 Oct).** The dots' motion lives on a sphere and never stops. Everything in `dots.js` is one class, `Ring`: the dots' own motion (four unit vectors that cruise or race on a unit sphere, `orbit` or `race`) and a **frame** that puts that sphere on the screen (centre, radius, size of the line). On a ring the frame is the ring's. A new `Ring` takes over the dots from the one they were on, so their motion carries on unbroken; hidden, they start a quarter-turn apart.

**Travel: the dots keep cruising and the sphere moves (UV, 26 Oct).** Serving a target makes its `Ring` at once, with a trip from where the dots' sphere was. Through the trip:

| | What it does |
|---|---|
| Centre | Glides straight from the old sphere's centre to the new ring's, eased in and out. No spring, so no overshoot |
| Radius | Lifts from the old sphere's radius to **1.5 times the new ring's** (`LIFT`) over the first 30% of the trip, holds, and settles onto the ring over the last 40% (`RISE`, `FALL`), each eased in and out |
| Line size | Changes to the new ring's stroke as the dots settle (the last 40%) |
| Each dot | Follows the gliding sphere up to 60 ms behind (`LAG`), so they move as particles, never further apart than the sphere is wide |
| The motion | The cruise never stops, so they arrive already moving in it: no arrival step, no lock-on |

Hidden, they appear at a point (where they were last, if on screen, else the middle) and the sphere opens out from it as it goes. A trip takes 450 to 1200 ms, longer the further it is. Tapping something mid-trip starts a new trip from wherever the sphere has got to. The constants are at the top of `dots.js`.

Measured 26 Oct (the widest gap between any two dots): appearing and flying to the tick (a 33px ring, 50px lifted), 0 → 49px, held, settling to 33px; tick to bell, 33 → 51px → 33px; bell to the wide button (a 59px ring, 88px lifted), 33 → 93px → 58px. The few px over come from the lag. The group's centre comes straight in (160px → 2px for the tick).

*Superseded the same day, each after UV watched it:* (1) a 6px formation on a springy centre, which reached the middle of the ring together and came out to the line over the top ("all the dots seem to be moving to one point"); (2) the formation opening out near the ring, which still overshot; (3) each dot sliding on its own path from the old animation to its own place in the new ring's, eased and lifted. In (3) the four dots fanned out across a circle hundreds of px wide in mid-flight, because each swung round towards its own place while still far out ("exploding far from each other"), and the "lift" was worked as the dots' own size, not the sphere's. Glow and stretch were looked at then too and kept in proportion to the dot (`STRETCH` 1.35 times its length at most, `GLOW_REACH`), but they were not the cause. There is no glow while travelling.

**Two animations on one sphere ease into each other.** The race takes over the cruise's own dots where they are and eases its speed (up to three times the cruise's, about two laps a second, slower on a big ring), bob and glow up from the cruise's over `--dots-blend`.

**Tracing (step 2): a second animation beside the sphere, which runs on underneath.** Every animation (`Ring`, `Trace`, `Blend`) has `step()`, which gives one **pose** per dot: place, height, line size, colour, glow, squash, and `lit` (on a traced line: full brightness, no stretch). The dots draw whatever pose they are given.

| Piece | What it does |
|---|---|
| `Trace` | Holds the waiting sphere (`under`) and keeps stepping it, unseen, so its motion never stops. Each dot has a **pen** on the target's lines, joined end to end into one path: its own start (a quarter of the way round each, with jitter), its own share (45 to 70% of the length) and its own time (±15%), slow in and slow out. All the pens start **the moment the call is back**, so the dots slide into a trace already moving. The pens run for `--dots-blend` plus the kind's draw time (icon 1.3 s, tab 1.5 s, number 1.5 s + 0.5 s a digit) ÷ `--dots-draw`; the lines fade in as a whole over the same time |
| On a line | A dot sits exactly on its pen: the line's width and colour, height nearly 0 with a slight wobble (±0.05), a soft glow |
| Where the lines jump | Between strokes or digits, or wrapping from the end back to the start, a pen jumps; the dot **swoops** across instead, eased in and out over 90 ms + 4 ms a px of the gap (at most 380 ms), its size moving to the new stroke's, lifting at most 0.15 (1.17 times its size) on a sine |
| `Blend` | One animation handing the dots to the next: both run, and each dot's pose slides from one to the other, eased in and out, from its own start over its own time. A mix lies between the two, so no dot is ever bigger or further apart than in either |
| Diving in | `Blend(sphere → Trace)`: each dot starts within 150 ms of the others and takes `--dots-blend` ±15%. Size eases from the ring's line to the traced line's (a tick: 2 → 4.2 px), colour from the ring's to the lines' |
| Swinging out | As each dot's pen finishes it slides, over `--dots-blend`, into the race, which takes over the sphere that ran on underneath, exactly as the cruise eases into the race. A number's dots are the font's thickness, so they come back to a small ring large and shrink as they go: fine (UV) |
| The race | **On the ring line itself** (UV, 26 Oct: the race "looks a bit smaller" than its ring). On the sphere a dot's height drew it inwards on screen, so racing dots sat at 97.8–100% of the ring's radius, never outside. Racing, each dot is now put on the line (eased in with the race) and its bob shows only in its size and brightness: 788 measured positions, all at 100% |
| The reveal | The moment the last pen finishes, the target comes in (`--dots-reveal`) |
| The fade | **Only once the target is fully back and every dot is racing on its ring** (UV, 26 Oct), then after 0.5 s of race ÷ `--dots-fade` (`RACE_HOLD`, step 1's race after its ring was in). Counted before from the last dot onto the ring, the full-size race lasted 0.4 s and read as the dots fading with the ring hardly in. Measured on the tick: ring fully in 3.1 s, dots all on it 3.4 s, fade from 3.9 s, radius 100% throughout |
| Leaving mid-trace | Tapping another target: the old one comes back as it is, without the dots. The trip leaves from the sphere that ran on underneath (its ring's size and colour) and the dots slide off the lines onto it over `--dots-blend` |

Measured 26 Oct at 420px: the Accept tick (a 33px ring) — spread between dots never over the ring's 32.5px, 9–13px on the tick; size 2 → 4.2 → 2px; the largest move of any dot in one frame 3.1px. The counter "3586" and "1479" (a 90px fake ring, the font's 17.5px stroke): the longest frame 10 ms, the largest move of a dot in one frame 7px (as in travel); painting every dot's disc over the finished number covers its strokes. Leaving the counter mid-trace for a tab: the dots shrink steadily through the trip and never grow.

*Also tried the same day:* the number traced as thin hand-drawn digits (`--dots-digit-weight` times the font size) that crossfaded into the real one. UV: "Don't use the default text and then switch to my font. Only fade in my font", and the dots thick as the font. A first go measured the stroke at every point of every digit (pulling each point onto the middle of the stroke); UV: an approximate size is fine, so one thickness per font replaced it.

*Tried and changed the same day, both measured before UV saw them:* (1) the prototype's way of following the pen (each frame 38% of the way to it): where the "2" ends and the "0" begins a dot leapt 12.9px in one frame, starting at full speed, and lagged its pen on every curve; replaced by sitting on the pen and swooping only at a jump. Its lift (0.25) and wobble (0.08) made a dot 1.4 times the line; now 0.15 and 0.05. (2) Leaving mid-trace, the trip first started from the dots themselves, carrying the digits' 5.8px line into the lift: a dot reached 9.75px in flight. It now leaves from the sphere underneath.

**The waiting moves (step 4, 26 Oct).** The spec's 18 solo and 16 group moves (§8; pool and merge added by UV the same day), ported from the prototype's `domeStep` and `groupStep`, run inside `Ring` while it waits. Each is one entry in `SOLO` or `GROUP` in `dots.js`: its weight, its length, and `step()`, a function of the move's progress that says where the dot aims on the sphere and what it changes (squash, a squash of its own at its own angle, glow, trail, visibility, size, blur, the spring). A group may also have `start()` (random axes, the ball's four spots, the floor's tilt) and `draw()` (the black hole's disk, the shadows' floor, on the layer's canvas). Adding a move is one entry.

| | How it works |
|---|---|
| Solo moves | Each dot runs its own, one after another, picked by weight. Only one **big** move at a time; the other dots calm to 70% speed and a smaller bob while it runs, easing into and out of it (spec §7) |
| Into a solo move | Its first aim is turned to where the last move was aiming and turned back over `CARRY` (300 ms), so a dot never lurches as a move begins. A move ends where the dot actually is (it lags its aim), and hop, dive, over and under land with a squash (`LAND`, 220 ms) |
| Group moves | Every 2.2 to 4.7 s after the last (the first 1.4 to 2.9 s after the dots begin). A group fades in over `--dots-blend`, runs its time, then fades out over `--dots-blend` **held at its end**, so a burst back to the ring is not cut short. Each dot cruises on from where it is |
| Mixing | A move's wishes and the next's are mixed by weight, the aim **turning along the sphere** (slerp). A straight line between two aims put back on the sphere swept through the middle in a frame or two when they were far apart (3–4px in one frame, measured, on ball, binary, juggle, polar, steamroll) |
| Travelling | The moves carry on in flight, solo and group (UV, 26 Oct) |
| The call is back | A trace starting fades a group out at once and starts no other (UV: never wait for a group to finish). The race takes over the moves as they are and they fade out as it eases up over `--dots-blend`, a group's extras with them |
| Forced (the picker) | A solo move for all four dots on repeat, or a group back to back; a move cut short by the picker ends without its landing |
| Clockwise | Every move with a free direction measured clockwise (the dots' mean turn per move, from the page); over, under and juggle cross the middle by nature |
| Sizes | The prototype's amplitudes, as UV asked to see them: a splat's pancake to about twice its width, a flatten's smear 2.2 times long, the moons 1.7 times, a shadow up to about 3.8 times (faint and blurred). Speed stretch stays capped at 1.35 times and glow in proportion to the dot |

**Three group moves added after the spec (UV, 26 Oct): pool, merge, and a new moons** (described in the spec's §8 table). What they needed from the engine:

| | Why |
|---|---|
| `frame(G, ring, now, dt)`, once a frame before the dots, and `G.ended` | Pool's physics runs once a frame (in 4 ms steps, so a fast ball cannot pass through another), and pool ends when the balls stop, not on a timer. The ball's and the stars' spin moved onto the same hook |
| `snap` (how far a dot is pinned to its aim) | Pool's balls follow the physics exactly once they are in place: until then each dot glides on an eased path from where it was when pool began (pinning a dot whose spring had not arrived pulled it 7.6px in one frame). Merge's pairs move to their next spot at once while unseen. The pin is the same at any frame rate |
| `cut` | A dot moved at once has its trail cleared and its speed zeroed, so nothing is drawn across the gap |
| Trails by time, per move (`tl`, ms) | The moons' trails are 2.6 s long (most of the ring), pool's 1 s, a Hawking escape's 0.7 s; the rest keep 270 ms (the prototype's 16 frames at 60 fps). A trail takes a point every 12 ms, draws in behind the dot when it shortens rather than snapping off, and is drawn in runs of three points (a 2.6 s trail is about 70 strokes, not 200) |

*Pool:* a table at a tilt of 32–57°, radius 0.78 of the ring; set out by 0.9 s, the pull back to 1.25 s, then the shot, evenly faster to an impact speed of 2.8–3.8 table radii a second, cut 8–35° by aiming at the ghost ball. Elastic between equal balls; the cushion keeps 75% of the speed into it and 92% along it; drag 0.3 of the speed a second plus 0.13 rolling; at rest below 0.015, the cushion fades over 0.5 s and the group ends. Measured: a game lasts about 7 s (6.8–7.1 s over ten). Sizes and constants are `POOL` in `dots.js`. *Merge:* five pops 0.9 s apart, each 1.3 s, pairs alternating (so a pair is unseen 0.5 s between its pops), each spot at least about 70° from the last three; a Hawking pop is placed near the ring so the escape is seen; at least one per run. Times are `MERGE`. *Moons:* the moon's orbit plane tips its normal towards the viewer (clockwise) but well off it, so the moon passes in front and behind.

Measured 26 Oct at 420px, on the counter (a 90px ring) and the tick (33px): no frame over 7 ms, the dots' own script at most 0.9 ms a frame and 49 canvas strokes; the largest move of a seen dot in one frame pool 2.7px (0.96 on the tick), merge 1.9 (0.7), moons 3.2 (1.2); size changes at most 13% a frame.

*Changed from the prototype, each because it jumped when measured:* steamroll's ball goes a little over a lap, so the dot it began behind is flattened twice, and on the second pass the prototype sprang from flat to round in one frame (2.4px); a dot now forgets the ball once it is well behind. The black hole's streak snapped round as the dots vanished, still faintly seen (a 56% size change in one frame); it now holds while they are gone and eases round as they burst out. Wobble's and jitter's squash and wave's squash at the bottom switched on at full strength; they now grow in. Shadows' squash on a bounce switched with the floor's strength; it now eases. The black hole's disk was 180 strokes a frame, each with its own canvas blur, which doubled the frame time (14 ms against 7 in headless Chrome); it is now drawn in runs of three segments, with the blur only on the front half. **Splat's impact is left as it was**: the dot squishes to its pancake in one frame (it doubles in size), which is the move.

Measured 26 Oct at 420px (headless Chrome, 7 ms frames), every move forced in turn on the Accept tick (a 33px ring) and on the wide button: the dots stay on the sphere (out to 1.00–1.03 of the ring's radius; a shadow on its floor and a dot in the black hole inside it); the largest move of a dot in one frame 0.5–1.6px for the solo moves (jitter's dash 2.7), 0.9–2.8px for the groups (burst's explosion and collide's bounce 4px, on purpose); size changes of at most 15% a frame except splat's impact; no frame over 7.7 ms. The call coming back mid-black-hole (the dots gone), mid-shadows on the button, mid-comet, and a second target tapped mid-ball: no move over 4.6px in a frame through the trace, race and fade, the largest at the start of a trip.

**Stages built:** travel (above; dots stretch along their path when fast), the waiting moves, tracing, the ring race, and the fade (while still racing).

**Busy, tracing and revealing (`dots.css`).** Busy: a ring icon's ring hides and its icon dims to `--dots-busy-dim`, in `--dots-dim`; anything else has its border made transparent and the whole of it dimmed. Tracing: a ring icon's ring stays hidden and its marks fade in as a whole (`--dots-lines`, set by the script, with their own draw-on transition off); a number fades in as a whole the same way; a tab stays faint and unfilled. Revealing: everything comes back in `--dots-reveal`, which the script reads from the computed transition to know when the ring is fully in.

**Failures.** A target that leaves the page while served is reported with `TDC.error('Dots', …)` and the dots fade where they are. A `reveal` that throws is reported and the target still comes back. The rest of the spec's error handling is step 6.

## 4. Built so far, and what is next

| Step (spec §16) | State |
|---|---|
| 1. Engine: sphere, springs, loop, stroke and colour reading, travel, cruise, race, fade | **Built and approved by UV, 26 Oct** |
| 2. Tracing and the element types | **Built 26 Oct; UV to review in the sandbox** |
| 3. The sandbox's full controls | **Built 26 Oct; UV to review.** Simulate page load waits for step 5's queue |
| 4. The move registry, 18 solo and 16 group moves (pool and merge added, moons redone) | **Built 26 Oct; UV to review in the sandbox** (pause 3 of 3) |
| 5. The page-load queue and `track()` | |
| 6. Reduced motion, error handling | Reduced motion is not handled yet |
| 7. Replace `ring-status.js`'s dots; wire into real elements | |

## 5. Tokens

| Token | Default | What |
|---|---|---|
| `--dots-ring-margin` | 6px | A fake ring's gap beyond the element's shorter side. 0 makes the ring exactly the button's height |
| `--dots-fake-stroke` | 1.5px | The dots' size on a fake ring with no border |
| `--dots-fade` | 1 | How fast the race ends and the dots fade, times the prototype's |
| `--dots-draw` | 1 | How fast the dots trace, times the prototype's (the hand-overs stay `--dots-blend`) |
| `--dots-blend` | 0.6s | The dots moving from one animation to the next: the race easing up from the cruise, waiting into tracing, tracing into the race, a trace into a trip |
| `--dots-busy-dim` | 0.1 | How faint a waiting target is |
| `--dots-dim` | 0.2s | A target dimming as it goes busy |
| `--dots-reveal` | 0.25s | A target coming back (spec: icon and ring in about 0.25 s) |

## 6. Testing it

Headless Chrome is useful here, with two traps found on 26 Oct:
- **A screenshot can show a stale frame.** Headless Chrome kept presenting an old picture of the moving dots (they looked 40px off the ring while the page reported them on it). Change the DOM just before each capture (any attribute) to force a fresh paint.
- **A clipped capture bigger than the screen re-lays out the page**, which moves the fixed layer. Scroll the target into view and capture the screen instead.

Positions are best checked from the page itself: each `.tdc-dot`'s `getBoundingClientRect()` against the target's, and its true size (stretch included) from its computed transform. **Since step 4, use the matrix's singular values**, not the length of its columns: a dot can be squashed at one angle and stretched at another, and the column lengths then change as its direction of travel turns while its shape does not (it read as a 2.4px snap that was not there). With `T = a² + b² + c² + d²` and `D = ad − bc`, the two sizes are `8 × √((T ± √(T² − 4D²)) / 2)`. To test a hand-over at a chosen moment, serve with a promise resolved by hand (`TDCDots.serve(el, new Promise((r) => { done = r; }))`). Record every frame with `requestAnimationFrame` and report the spread between the dots, the biggest dot against the line it is on, and the largest move of any dot from one frame to the next.

**The sandbox (`/sandbox/dots/`, step 3).** The stage: a tab bar (the league pages' bar), four ring icons in four colours, the counter, a list row with a ring icon button, a switch served as a ring, a primary and a secondary button. The controls: network delay, draw speed, fade speed, hand-over and ring margin (each sets its token on that page until a reload; the values to keep are set and saved on the main sandbox, whose token list now has a **Dots** group), the waiting move with Random (solo moves and group moves, in two lists), and the status line (the phase, then each dot's solo move or the group).
