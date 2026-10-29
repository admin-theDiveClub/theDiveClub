# The dots — loading and feedback motion

> Built from `docs/design/dots-motion-spec.md` (the architecture and requirements) and `docs/design/dots-prototype.html` (how it should feel). Started 26 Oct 2026. **All seven of the spec's steps (§16) are built; step 7, on the real site, is waiting for UV's review.** This file says what exists and why it is shaped that way.

## 1. What it is

Four dots, **one set for the whole page**, that show that something is happening and where. A target that makes a network call gets them: they fly to it, live on an invisible sphere round it until the call is back, then (from step 2) trace its lines, race its ring and fade. On a fast connection they are barely seen; the network decides how much of the show there is, and the dots never add a delay of their own.

**It replaced the per-element dots** of `scripts/ring-status.js` (UV, 26 Oct; step 7): every checkbox, switch, three-way switch, nav button and fixture icon is served by the one travelling set, and `ring-status.js` is now the icon alone. Where it is used on the site is §7.

## 2. Files

| File | Job |
|---|---|
| `scripts/dots.js` | The engine, `TDCDots`. On every page (`layout.html`, after `tdc.js`) |
| `stylesheets/dots.css` | The layer, and what a target looks like while busy and while it comes back. On every page (`layout.html`, after `status.css`) |
| `scripts/ring-status.js` | The ring icons, with no dots of their own since step 7 |
| `scripts/tdc.js` (`TDC.writer`), `scripts/tdc-controls.js`, `scripts/nav.js`, `scripts/league-fixtures.js` | Where the site hands its calls to the dots (§7) |
| `variables.css` `--dots-*` | Every size and time (§5) |
| `scripts/loader.js` + `stylesheets/loader.css` | The loading screen, whose dots are these (§9, 29 Oct) |
| `sandbox/dots/index.html` + `scripts/sandbox-dots.js` | `/sandbox/dots/`: real components that pretend to call the network. Styles at the end of `sandbox.css` |

## 3. How it works

**The API.** `TDCDots.serve(el, promise, { reveal, trace, status, timeout, follow, leaves })` (`status` and `timeout` since step 6, under Failures below; `follow` and `leaves` since step 7, in §7) marks `el` busy (`data-dots="busy"`), takes the dots to it and returns the promise. When the promise settles, either way, `reveal()` puts the result on the page at once (a new number, a switch flipped), hidden while the dots trace it (`data-dots="tracing"`, `data-dots-trace` the kind); then `data-dots="revealing"` while its transition brings it in, then the attributes go. A target already busy is not served twice; the dots wait for both calls. Served again while it is still being traced, that trace ends at once and a new serve begins. `serve()` is a **tap**; `TDCDots.track(el, promise, { reveal, trace })` is the same for something **loading with the page** (step 5, below).

**The page-load queue (step 5, spec §12).** `track()` makes the same record as `serve()`, marked as loading, and puts it in the queue rather than taking the dots. Decided by UV, 26 Oct:

| When | What happens |
|---|---|
| Tracked | Nothing for `GRACE` (150 ms), so an instant load shows nothing at all. Then **everything still loading dims** (the busy look), and hidden dots go to the first still loading **in the page's order** (`compareDocumentPosition`), **wherever it is**, off the screen included |
| Back while the dots are elsewhere | It simply appears (the reveal transition) |
| Back while the dots are flying to it | It simply appears and they **turn mid-flight** for the next one still loading. If nothing else is loading they land on it anyway and race and fade there |
| Back while the dots wait on it | If anything else is loading, it is **not traced**: it comes in as the dots fly on. Only the **last** is traced, raced and faded. This holds for a tap too: a tap whose call is back while something is still loading is not traced |
| A tap | Takes the dots at once, as always. Whatever is still loading afterwards gets them next. Something loading that is tapped becomes a tap |
| Something new loading while the dots trace, race or fade | Once it has been loading for `GRACE`, it takes them, as a tap would |

A tap abandoned by a later tap is not put back in the queue (the 26 Oct decision: it comes back without the dots). On the sandbox, **Simulate page load** puts all twelve things on the stage into loading for random times (about a quarter under 0.15 s), and logs for each what the dots did.

**Turning mid-trip (step 5).** Page loading makes the dots turn in flight often, so two things changed in travel:
- **The speed carries on.** A trip that starts mid-trip starts at the old trip's speed (centre and radius), which dies away over the first third as the new trip eases in (Hermite's `u(1−u)²` added to the glide). Before, the new trip started from rest: the dots stopped dead and set off again, a change of speed of 26–50px in one frame (measured on the step 4 engine, tabs → button, turning 250–740 ms in).
- **A new trip starts from the frame the dots were last placed in** (`stepAt`), not the clock, or its first frame came out at no progress and the dots stood still for a frame (19.6px).

`trace` says what the dots trace (spec §10), and defaults from the target:

| `trace` | Lines | Their size and colour | Default for |
|---|---|---|---|
| `icon` | The ring icon's own `.mark.on` paths, read after `reveal()` so the **new** icon is traced. They fade in themselves; nothing is copied | The marks' computed stroke and width (the cue ball's per-stroke widths come out exact), scaled from the 100 box | Anything holding a `.tdc-ring` |
| `number` | **The number itself, in the site's font**, fading in as a whole under the dots; nothing is drawn in another hand (UV, 26 Oct). The dots' way round each digit is the prototype's single-line digit (a 10 × 16 box), never drawn: fitted over the real digit's ink (`measureText` and a Range per character), both ways, inset by half the font's stroke so it runs down the middle of the strokes | **The font's stroke** (UV: "dots should be thick when they are drawing"; an approximate size is enough): measured once per font across the middle of a "0" drawn on a hidden canvas, and kept. 17.5px on the sandbox's 4rem counter. The text colour | Asked for |
| `tab` | The chosen tab's pill outline, inset by half the line, from its box and border radius, starting at the top middle | The tab bar's outline width (`.league-nav`); the colour the chosen tab fills with | Asked for |
| `none` | Nothing: the dots stay on the fake ring and the target comes back as they race it (UV, 26 Oct: "the trace as a ring using the shorter dimension is enough on buttons") | | Everything else |

A tab's outline is drawn on the layer's SVG (`svg.tdc-dots-lines`) and placed over the target every frame; at the reveal it fades out in the target's own reveal time while the tab fills, so they crossfade. Every set of lines becomes a list of points carrying the stroke's width at each: a digit's are worked out directly from its curves; an icon's and a tab's are sampled from their SVG paths (every 3 units), and an icon's are kept once worked out, because the browser takes about 4.5 ms per 100 points (sampling a four-digit number that way cost a 47 ms frame and a 14px jump of the dots; it now takes 2 ms). **A switch is served as a ring (UV, 26 Oct)**: its knob is a real ring, so the dots wait on it, the knob slides to its new side when the call is back, and they trace the new tick inside it as it goes (turned off it is an empty ring since 26 Oct, so they race; it was a cross) (the target is measured every frame, so they follow it).

**Interruptions (spec §3).** Serving a new target takes the dots there at once from wherever they are. The old target stays busy until its own call is back and then comes back **without the dots**. Checked 26 Oct: three targets tapped in quick succession, the first two came back on their own, the last got the race, nothing was left marked.

**The layer.** One `div.tdc-dots`, fixed over the whole screen above the nav (`z-index: 1000`, the nav is 100), `pointer-events: none`. One canvas (trails, and later a group move's extras), one SVG (the lines drawn for a number's or a tab's trace) and four `span.tdc-dot`, moved by `transform` and `opacity` only. Added to the page on the first serve.

**The loop.** One `requestAnimationFrame` for everything. It **stops when the dots are hidden**, so an idle page costs nothing, and starts again on a serve. `dt` is measured in 60 fps frames and capped at 50 ms, so every spring runs the same at any frame rate and a tab coming back does not jump.

**The target is measured every frame**, so scrolling or a layout change never strands the dots:
- **A real ring** is any target holding a `.tdc-ring`: its `circle.ring`'s centre, radius and stroke width, scaled from the SVG's 100 box to the screen.
- **A fake ring** is anything else: centred on its box, its radius **half the box's shorter side** (UV, 26 Oct): a wide button's height, a tall stepper's width. `--dots-ring-margin` is added only round a square, which has no shorter side (UV, 28 Oct; before, it was added to every fake ring). So a 47px-high full-width button gets a ring 47px across in its middle, and the dots cross its face as they go round. Its stroke is the element's border, or `--dots-fake-stroke` if it has none. (The spec's half-diagonal gave that button a ring about 374px across, far wider than the page.)

**Colour (UV, 26 Oct): the dots take the colour of the line they are on.** On a real ring that is the ring's stroke (cream today); on a fake ring the element's border colour, else its background, else its text. It is read once, at the serve, **before** the busy state makes the border transparent. Colour is part of each dot's pose (below), so it blends wherever the dots do: over a trip with the sphere, into the traced lines' colour as they dive in, back to the ring's as they swing out to race.

**The sphere (spec §4).** Each dot is a unit vector; screen position is the ring centre plus radius × (x, y), and z is height above the page. Size is `stroke × 2^(1.5 × height)`; brightness rises with height. Motion on the sphere is a spring towards a target point, renormalised to the surface each frame, its velocity kept tangent.

**The animation runs, the dots show it (UV, 26 Oct).** The dots' motion lives on a sphere and never stops. Everything in `dots.js` is one class, `Ring`: the dots' own motion (four unit vectors that cruise or race on a unit sphere, `orbit` or `race`) and a **frame** that puts that sphere on the screen (centre, radius, size of the line). On a ring the frame is the ring's. A new `Ring` takes over the dots from the one they were on, so their motion carries on unbroken; hidden, they start a quarter-turn apart.

**Travel: the dots keep cruising and the sphere moves (UV, 26 Oct).** Serving a target makes its `Ring` at once, with a trip from where the dots' sphere was. Through the trip:

| | What it does |
|---|---|
| Centre | Glides straight from the old sphere's centre to the new ring's, eased in and out. No spring, so no overshoot |
| Radius | Lifts from the old sphere's radius to **1.5 times the new ring's** (`LIFT`) over the first 30% of the trip, holds, and settles onto the ring over the last 40% (`RISE`, `FALL`), each eased in and out |
| Line size | Changes to the new ring's stroke as the dots settle (the last 40%) |
| Each dot | Follows the gliding sphere's centre and radius a little behind, so they move as particles: a smoothing with its own time constant, up to 60 ms (`LAG`), **the dot's for good**. Until step 5 it was a delay of up to 60 ms picked anew each trip; at a turn the delay left a dot where the sphere had been (20.6px in a frame), and a new, shorter lag let a dot that had trailed 17px catch up in one frame |
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
| Where the lines jump | Between strokes or digits, or wrapping from the end back to the start, a pen jumps; the dot **swoops** across instead, eased in and out over 90 ms + 4 ms a px of the gap (at most 380 ms), its size moving to the new stroke's, lifting at most 0.15 (1.17 times its size) on a sine. A jump is a pen passing from one line to another across a gap of more than `JUMP_MIN` (0.75px), or moving more than `JUMP` (6px) in a frame. **Until step 7 only the second counted**, so on a small icon, where every gap is under 6px, a dot leapt the gap in one frame: a tick in a table's 28px ring wrapped 4.9px (a change of speed of 12, on the committed engine too); now 0.6 |
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

**Busy, tracing and revealing (`dots.css`).** Busy: a ring icon's ring hides and its icon dims to `--dots-busy-dim`, in `--dots-dim`; anything else has its border made transparent and the whole of it dimmed. **Which look a target gets is `data-dots-ring`** (step 7), set by the script on a target that is a ring icon (it has a `circle.ring` of its own when served). Until step 7 the rules asked `:has(.tdc-ring)`, so a section holding ring icons (the fixtures planner, loading with the page, full of fixture buttons) took the ring look: every button inside lost its ring, and the section itself was not dimmed. Tracing: a ring icon's ring stays hidden and its marks fade in as a whole (`--dots-lines`, set by the script, with their own draw-on transition off); a number fades in as a whole the same way; a tab stays faint and unfilled. Revealing: everything comes back in `--dots-reveal`, which the script reads from the computed transition to know when the ring is fully in.

**Failures (step 6, spec §14).** Never silent: each goes to the console with `[Dots]` and onto the page as "TDC (Error): …" through `fail()`, and the target still ends as it should, its result shown and no `data-dots` attribute left on it. **Where it shows (UV, 26 Oct):** on the page's own status line if `serve()` / `track()` were given one (`opts.status`), else on the dots' own line, `div.tdc-dots-error`, fixed at the foot of the screen above everything for 6 s (`ERROR_MS`). That line sits outside the layer, which is `aria-hidden`. Messages name the target (its `aria-label`, else its text).

| Failure | What happens |
|---|---|
| An icon's lines missing (no `.mark.on`, or `trace: 'icon'` on something with no ring icon), a number with no digits | Reported by name ("Lag: its icon has no lines to trace"). No trace: the target comes back as the dots race. Before step 6 this was silent |
| Lines that cannot be read (a broken path, a font that cannot be measured, lines of no length) | Reported; no trace. A tab's outline half drawn when it failed is taken off the layer (before, it stayed for good) |
| The target leaves the page **before its result is shown** (mid-flight, waiting, mid-trace), and the page gave no `follow` that finds its replacement and did not say it `leaves` (§7) | `gone()`: reported, and everything the dots put on it (`data-dots`, `data-dots-trace`, `data-dots-calm`, `--dots-lines`) taken off at once, so the element is right if the page puts the same node back (before, one removed mid-trace kept `data-dots="tracing"` and stayed invisible). The dots fade where they are. Its `reveal` still runs when its call is back. Checked every frame (`sweep()`), in the grace check, and when its call settles, so it is reported promptly whether or not the dots are on it |
| The target leaves **after its result is shown** (racing, fading) | **Not a failure:** a page redrawing after a save (CLAUDE.md idea 6) replaces its elements all the time. The dots race and fade where it was. Before step 6 this was reported as an error |
| A ring icon drawn again while served (a new SVG in the same target) | Measured by its new ring. Before, the old ring's `ownerSVGElement` was null and the frame threw |
| A `reveal` that throws | Reported; the target still comes back |
| A call that **never settles** | After `HANG` (20 s, UV) or `opts.timeout`: reported ("its call had no answer for 20 s, so it is shown as it was"), the target comes back **as it was** (no `reveal`, no trace), and the dots move on to whatever is still loading, else race and fade. If the call is answered later, its `reveal` runs then, plainly. Before, the dots orbited it forever and held the queue |
| A call that **fails** (rejects) | **Not traced** (UV): nothing was saved. Its `reveal` still runs, so the page can put back what the database holds, and the page reports its own error; the dots only log it to the console. Before, a failed call was traced like a success |
| The dots themselves throw (in a frame) | `recover()`: reported; the dots hide, the canvas and any drawn lines are cleared, and every target whose call is back is restored now (the rest as theirs come back). The target being served is marked `broken` and not gone to again; the next tap starts afresh. Before, the loop died with `running` still true: every busy target stayed dimmed for good and no later tap animated |
| `serve()` / `track()` on something not on the page, or that cannot be measured (no size: hidden) | Reported; its `reveal` still runs when the call is back |
| **A frame of 0 ms** (found on UV's iPhone, 29 Oct: "dot 0 got d.sp = NaN (phase travel)", then no dots for the rest of the page) | Safari rounds its clock to whole milliseconds and stamps a frame at its start, so the first frame after the dots wake could come 0 ms (or less) after `last`: a still dot's speed was 0 ÷ 0, which a running mean never leaves, and the dot froze where it was (an invalid transform is ignored) for good. Now a frame is at least 1 ms (`tick`), and a speed that is not a number is reset and said once in the console. Reproduced with a whole-millisecond clock: the committed engine froze dot 0 in all ten serves with UV's message; the fixed one moved in all ten, nothing reported. The temporary check that caught it is gone |
| A target hidden by the page while it is served (0 by 0) | Not a failure: it keeps the place it was last seen (step 7). Before, a hidden element measured 0 by 0 at the top left of the screen, and the dots flew there |

**Reduced motion (step 6, spec §14).** `reduced()`: the device's `prefers-reduced-motion`, unless the page's root says `data-motion="reduce"` or `"full"` (the sandbox's switch, so it can be tried without changing the device). Followed live: a `matchMedia` listener and a `MutationObserver` on the root (`motionChanged()`).

| | What happens |
|---|---|
| A tap | No dots. The target is busy as usual and also `data-dots-calm`: a **calm pulse** (`dots.css`), opacity only, nothing moving. A ring icon's **ring** breathes (0 → `--dots-pulse-peak` → 0) while its icon stays dim; anything else breathes **as a whole** (`--dots-busy-dim` → peak). One breath is `--dots-pulse` (2 s). The pulse waits `--dots-dim` so the dimming finishes first, and starts from where it left the target |
| The call is back | No trace, no race: the result goes on and the target **fades in** (`--dots-reveal`) from wherever the pulse had it |
| Page load (`track()`) | **No pulse (UV, 26 Oct):** everything still loading after `GRACE` dims, and fades in as it comes back. The dots never come |
| Switched on while the dots are out | They fade where they are (a trace in hand comes in at once) and every tap still out starts breathing |
| Switched off | The breathing stops (eased) and the dots come for the latest tap still out, else whatever is still loading |
| Failures | As above, reported the same way. With no dots, a target that leaves and comes back before its call is back has not failed |

**Ending the pulse without a jump.** Taking the pulse off snaps the opacity to wherever the CSS sends it, because a CSS transition does not start from a CSS animation's current value (measured in Chrome: the ring and the button went from 0.49 to 1 in one frame). So the script reads the opacity the pulse has (`calmFrom`), takes the pulse off, and runs a Web Animation from that value to wherever the CSS has it (`calmTo`, one keyframe at `offset: 0`; a single keyframe with no offset is taken as the **end**, which first ran it from 1 down to the pulse's value).

## 4. Built so far, and what is next

| Step (spec §16) | State |
|---|---|
| 1. Engine: sphere, springs, loop, stroke and colour reading, travel, cruise, race, fade | **Built and approved by UV, 26 Oct** |
| 2. Tracing and the element types | **Built 26 Oct; UV to review in the sandbox** |
| 3. The sandbox's full controls | **Built 26 Oct; UV to review.** Simulate page load waits for step 5's queue |
| 4. The move registry, 18 solo and 16 group moves (pool and merge added, moons redone) | **Built 26 Oct; UV to review in the sandbox** (pause 3 of 3) |
| 5. The page-load queue and `track()` | **Built 26 Oct; UV to review in the sandbox** (Simulate page load) |
| 6. Reduced motion, error handling | **Built 26 Oct; UV reviewed it ("fine")** |
| 7. Replace `ring-status.js`'s dots; wire into real elements | **Built 26 Oct; UV to review on the real pages** (§7) |

## 5. Tokens

| Token | Default | What |
|---|---|---|
| `--dots-ring-margin` | 16px | A fake ring's gap round a **square** element. Anything else takes its shorter side as the ring, with no gap (UV, 28 Oct: "always use the shorter dimension"); a 360 × 47 button's ring is 47px across |
| `--dots-fake-stroke` | 1.5px | The dots' size on a fake ring with no border |
| `--dots-draw` | 0.5s | **Draw time** (UV, 28 Oct: a time, where it was a speed on the prototype's time per kind): how long the dots trace a result, any kind; a number a third more for each digit after its first. UV set 0.5 s from the sandbox on 29 Oct (was 0.12 s) |
| `--dots-blend` | 0.1s | **Transition time** (UV, 28 Oct): waiting into tracing, tracing into the race, the cruise into the race, a trace into a trip, and the dots fading out (evenly, from wherever they are) |
| `--dots-busy-dim` | 0.1 | How faint a waiting target is |
| `--dots-dim` | 0.2s | A target dimming as it goes busy |
| `--dots-reveal` | 1s | **Fade time** (UV, 28 Oct): how long the target (a ring icon's ring) takes to fade in after the trace. The dots fade out only once it is fully in and every dot is racing; there is no longer a race of its own before they do (`RACE_HOLD` and `--dots-fade` went) |
| `--dots-pulse` | 2s | Reduced motion: one breath of a tapped target while it waits |
| `--dots-pulse-peak` | 0.5 | Reduced motion: how bright the target (or a ring icon's ring) gets at the top of each breath |

## 6. Testing it

Headless Chrome is useful here, with two traps found on 26 Oct:
- **A screenshot can show a stale frame.** Headless Chrome kept presenting an old picture of the moving dots (they looked 40px off the ring while the page reported them on it). Change the DOM just before each capture (any attribute) to force a fresh paint.
- **A clipped capture bigger than the screen re-lays out the page**, which moves the fixed layer. Scroll the target into view and capture the screen instead.

Positions are best checked from the page itself: each `.tdc-dot`'s `getBoundingClientRect()` against the target's, and its true size (stretch included) from its computed transform. **Since step 4, use the matrix's singular values**, not the length of its columns: a dot can be squashed at one angle and stretched at another, and the column lengths then change as its direction of travel turns while its shape does not (it read as a 2.4px snap that was not there). With `T = a² + b² + c² + d²` and `D = ad − bc`, the two sizes are `8 × √((T ± √(T² − 4D²)) / 2)`. To test a hand-over at a chosen moment, serve with a promise resolved by hand (`TDCDots.serve(el, new Promise((r) => { done = r; }))`). Record every frame with `requestAnimationFrame` and report the spread between the dots, the biggest dot against the line it is on, and the largest move of any dot from one frame to the next.

**Since step 5, measure jumps as a change of speed**, not a move: a dot travelling fast honestly moves 10–19px a frame, so the largest move cannot tell a trip from a jump. Take each dot's move per frame divided by that frame's own time (headless Chrome drops frames, and a dropped frame doubles a move), and report the largest change from one frame to the next. Smooth travel and the waiting moves measure 1–3px; a jump shows as a spike, or two in a row (a dot stopping for one frame). Burst's explosion is the exception on purpose (13.5px on the counter's big ring).

**Sample after the frame is drawn (found 26 Oct, step 6).** A recorder reading the dots in its own `requestAnimationFrame` may run before the engine's in that frame, and then pairs the last frame's positions with this frame's time. With even frames that cancels out; after a long frame followed by a short one it shows a false spike of 13–70px, on the committed engine as much as the new. Read positions in a task queued from the rAF (`setTimeout(…, 0)`, skipped if the next frame came first), and leave out frames over three 60 fps frames long.

**To compare with the committed engine**, serve `git show HEAD:src/scripts/dots.js` to the page in place of the new one (the DevTools protocol's `Fetch.requestPaused`, answered with the old file), and run the same script on both.

**A real page with a stand-in database (step 7).** The same `Fetch.requestPaused` answers every request to `https://db.thediveclub.org/*` from the test script (`/rest/v1/rpc/<name>` with the arguments in the body, `/rest/v1/<table>` for a `from`; a `.single()` / `.maybeSingle()` read asks for `vnd.pgrst.object` and wants an object), with a delay per call, so the page is driven by real taps (`Input.dispatchMouseEvent`) and every save is seen in order. Four traps: a signed-in page needs a session put in `localStorage` as `sb-db-auth-token` before the page loads (`Page.addScriptToEvaluateOnNewDocument`), with `expires_at` in the future so nothing tries to refresh it; the realtime socket cannot be answered this way, so replace `WebSocket` for that host with one that never connects (one that throws breaks the fixtures page's re-read); a function returning text must be answered with JSON (`"m-1"`, quoted), or the client reports the text as an error; and `Runtime.enable` replays console messages from earlier loads of the same tab. When the tap scrolls the page, every target moves, and so do the dots: tap without scrolling where the target is already in view.

Measured 26 Oct at 420px (step 5): 25 page loads at a 3 s delay, random moves, every frame 16.8 ms: the largest change of speed 1.4–3 px in 22 of them; burst's explosion (13.5) in one; and two not reproduced since: 20px as the race began on a row the dots had landed on (which move was running was not recorded), and 6.3px in the final trace of the cue ball. Forced, neither came back: the race over each of the 16 group moves and over polar, over, spiral and stars, and five traces of the cue ball, all 1–4px on both engines. Eight sharp turns (tabs → Save settings, 250–740 ms in) 1.5–1.7px, against 26–50 on the step 4 engine. All instant: the dots never shown. The race taking over each of the 16 group moves mid-move: 1.3–2.2px. Nothing left marked after any run.

Measured 26 Oct at 420px (step 6), change of speed: a tap on the tick traced, raced and faded 0.7 (1.1 on the committed engine); tick → tab mid-flight → Save settings 1.6 (1.4); reduced motion switched on mid-orbit 0.65, off mid-pulse 1.0; the bell removed mid-flight 1.1; a call hung with something else loading 1.2–2.3, against 1.1–2.3 for the same call answered; a reveal that throws 0.8. Eighteen page loads (random moves): 0.9–5.8 on the new engine, 0.5–9.8 on the committed one. Reduced motion, per frame: the pulse and the fade-in never step more than the dimming going in (0.07–0.08 of opacity a frame); no dot shown; at page load nothing pulses. Every Failures button, in both modes: reported, and nothing left marked.

*Seen on both engines, not from step 6, for UV to decide on:* (1) **appearing and opening out on a big ring** (the counter's 90px): from their last place the sphere opens from nothing to 1.5 times the ring in the first 30% of a 450 ms trip, so its first frames change speed by 12–41 (13–16 on the committed engine). (2) **The race on a row the dots landed on** (step 5's unreproduced 20px): 5.8–14.7 once in about ten loads, on the "Team 0 : Team 3" row, on even frames.

**The sandbox (`/sandbox/dots/`, step 3).** The stage: a tab bar (the league pages' bar), four ring icons in four colours, the counter, a list row with a ring icon button, a switch served as a ring, a primary and a secondary button. The controls: network delay, draw speed, fade speed, hand-over and ring margin (each sets its token on that page until a reload; the values to keep are set and saved on the main sandbox, whose token list now has a **Dots** group), the waiting move with Random (solo moves and group moves, in two lists), and the status line (the phase, then each dot's solo move or the group). **Motion** (step 6): As the device says / Reduced / Full, which sets `data-motion` on the page's root. **Failures** (step 6): one button for each failure in the table above, each run on a stage element at the network delay (Never settles takes the real 20 s); "Report on this section's line" passes the section's status line as `opts.status`, else the dots' own line shows. When it is all over, the log lists anything still marked by the dots, or "All clear".

## 7. On the site (step 7, 26 Oct)

`dots.js` and `dots.css` load on every page (`layout.html`). `ring-status.js` keeps the ring icons and lost its own dots: `RingStatus` is the icon (`setState`, `drawTo` and `drawIn` to draw it in stroke by stroke, `say` for the live text), and the tokens that only its dots read (`--ring-load`, `--ring-spin`, `--ring-fade`) are gone from `variables.css` and the main sandbox.

**The first list (UV, 26 Oct, spec §15 question 5):**

| Where | What gets the dots | How it hands its call over |
|---|---|---|
| Every saving checkbox, switch and three-way switch (Paid, Captain, Away, Listed, Paid also confirms on league manage; Paid on tournament manage; Here tonight, L and W on the card; the notification switches on the profile) | The control (its ring is the real ring) | `tdc-controls.js`: once the page's change handler has run, the save it made through `TDC.writer` (`TDC.writeSince(mark)`), else any call `TDCNet` counted (`TDCNet.quiet()`), is given to `serve(wrap, call, { reveal, status })`. The reveal slides the knob and shows what the box holds, after the page's re-read |
| The nav: the bell (the tray reading), the account (going to sign-in) and reload | The button | `nav.js`: `serve(button, call)`. Account and reload wait for the page to go (UV): their call ends only if the page comes back from the browser's history; a minute (`LEAVE_MS`) before it counts as hung |
| The fixtures page: Start, Take off and Remove on a fixture; Start all and Remove all on a night | The button | `write(…, { dots, follow, leaves })` through `TDC.writer` (`dotsFor()`) |
| The fixtures page loading | The heading (while the season is read), then the planner (while the fixtures are) | `track(el, promise, { status })` |

**Decided with it (UV, 26 Oct; superseded for the controls on 28 Oct, §8, where every change gets the dots):** a control that changes with no call (a box in a form, a folded section opening, the menu turning into its cross) gets no dots: its icon draws in stroke by stroke (`drawTo`, in `--ring-draw`) and a knob slides at once. A tap whose call goes out gets them. When several saves are out at once the dots go to the latest; the others come back without them.

**`TDC.writer` and the dots.** `write(what, fn, done, { dots: el, follow, leaves })` serves `el` with this save's answer: a promise that settles when the burst has saved **and the page has read itself again**, so what is traced is what the database kept, and that **rejects when this save failed**, so a failed save is not traced (the writer's own message says why, after the re-read). The writer's status line is the dots' `opts.status`. Every write is counted (`TDC.writes`) and the latest kept (`TDC.writeSince(n)`), which is how a custom control learns that its change saved.

**Quick input.** Each change is its own save, queued (`TDC.writer`). Ticking several boxes quickly serves each in turn; the dots go to the latest; all reveal together after the one re-read, each showing what the database holds. Flicking one on and off serves the same control twice, so the dots wait for both calls and show the end. The knob does not move until the answer is back (as before step 7).

**Pages that redraw while the call is out.** Every page reads itself again after a save (CLAUDE.md idea 6), and most draw everything afresh, so the element the dots are on can be thrown away before its result is shown, which step 6 reports as a failure. Three ways round it:

| | How |
|---|---|
| The custom controls | While the dots are on a control (it carries `data-dots`), `tdc-controls.js` hands the control itself to the new checkbox (by id, or `data-action` with `data-entrant` / `data-player` / `data-frame`), so the dots' target never leaves the page |
| `follow` | The page says which element now stands in its place, and the record moves there (`present()`, `moveTo()`): its look comes with it, an icon the page draws in on the new one is shown as it stands, and the ring glides from the old place to the new. The fixtures page follows a fixture's button to the same action on the same fixture, else that fixture's first button (Start becomes the card's arrow; Take off gives back Start), and traces its icon there |
| `leaves` | The call itself may take the target away (a fixture removed, a night's Start all once nothing is left to start): it is let go without a failure, and the dots orbit where it was until the call is back, then race and fade there, with nothing to trace |

**Targets that jump (`settle()`).** A target's ring follows the page exactly as it scrolls and as the target slides (a switch's knob), but a target that jumps would snap the dots with it: the planner grows as the fixtures arrive and its middle moves 185px in one frame (the committed engine snapped 770–1040px a frame there), and the button the dots follow to after a redraw stands elsewhere. A jump is a change in the target's speed of more than `SHIFT` (3px) in one frame both on the screen and on the page (a scroll jumps an element on the screen only; a nav button, fixed to the screen, jumps on the page only as the page scrolls); it is eased out over `SHIFT_MS` (350 ms), the ring starting where it was. A target is measured once a frame.

**A ring showing nothing** (a ring unticked, a three-way switch in the middle) has nothing to trace: the dots race. Before step 7 that was reported as "its icon has no lines to trace".

**Measured 26 Oct at 420px** against a stand-in database (headless Chrome over the DevTools protocol answering every call to `db.thediveclub.org`; change of speed as in §6, on-screen dots):

| | New | Committed engine |
|---|---|---|
| Tournament manage, one Paid tick (a 28px table ring) | 0.6 | 12 (the swoop, above) |
| Four Paid ticks 120 ms apart, five runs | 0.5–4.7; saves in tap order, page = database every time | 12–13 |
| A Paid tick flicked on and off | 0.5–0.8; on then off, saved in order, ends off | 1.0, and "no lines to trace" reported |
| A Paid tick refused by the database | 0.5; not traced; the page's message shown; the tick put back | 0.6 |
| Fixtures page loading, six runs | 5.5–14.8 (the race on the planner's large ring, all four dots stepping together in one frame: the race irregularity of §6) | 770–1040 (the planner growing) |
| Start (the dots follow to the card's arrow and trace it), Take off (follow to Start), Remove (leaves), Start all | 0.6–1.9; nothing left marked, no error | Take off 91 (the snap to the new button) |
| The profile's notification switches: three flicked and one on and off | 0.85; saved in order; page = database | |
| The bell (the tray reading 1.5 s) | 1.3; traced, raced, faded; the tray filled | |
| Reduced motion, a switch saving | No dots; the ring breathes; the right end state | |
| A switch in a form (the main sandbox) | No dots, no call; the knob slid and the tick drew | |
| `/sandbox/dots/`, every target tapped once | 0.4–2.1 | 0.7–12.5 |
| `/sandbox/dots/` Simulate page load, eight runs | 1.0–1.4 | 1.2–1.5 |

Also opened with the stand-in: every main page, all folded groups open, at 420px: no script errors, nothing marked by the dots left behind, nothing wider than the screen. **Not driven:** the team card's L and W (the three-way switch shares the switch's code, `serveChange()`), league manage, and anything against the real database.

*Seen while measuring, not from step 7:* on `/sandbox/dots/`, with the page scrolled down to Simulate page load, the browser's scroll anchoring moves the stage 19px on the screen as things on it change size, and the dots flying to it jump with it; they are off the top of the screen at the time.

## 8. Every control gets the dots (28 Oct)

UV, after trying step 7: steppers, pills, the match page's score, break event and slide, and folding groups had no dots, and a form's switch only drew while a saving one got the dots. **Every control now gets them on every change, call or not** (replacing 26 Oct's "a control revealed with no network call gets no dots"). Done once, in `tdc-controls.js`, for every page.

| | |
|---|---|
| **The rule** | After a change, once the page's handler has run, the dots serve the control with the save its change made (`TDC.writer`, else any call `TDCNet` counted) and **never less than `DOTS_MIN`, 0.2 s** (`saveSince()`, `serveAfter()`). With nothing saved they barely arrive before they trace: UV wants to see that |
| Switch, ring, three-way switch | As in §7, now also with no call |
| **Stepper** | The dots trace the number in the pill (`trace: 'number'`, `ink`: the field). **A chevron held**: they come at the press and stay until the finger lets go (`serveHeld()`), the number lit meanwhile (`data-dots-hold`) so it can be read as it counts, then trace the number it stopped on. Typed or stepped from the keyboard: once committed. An empty field (no limit) has nothing to trace: they race. A save made some time after the release (the fixtures' table numbers, 0.7 s) is not waited for |
| Date | Its three parts are steppers. The calendar and the clear button give the dots to the whole date |
| **Pill** (dropdown) | The dots trace the green pill's outline under the chosen option (`trace: 'tab'`, at the pill's border width), then it fills. `data-icon` names a ring icon shown in the chosen option, and then the dots trace the icon instead: **the match page's break event wears the cue ball** (UV). A page that draws the pill again after the choice is followed by the select's id |
| **Slide** | The dots ride the knob while it is dragged and stay for whatever letting go set off (the undo), at least 0.2 s; let go early, they race and leave. No trace (the knob's arrow is not a ring icon) |
| **Folding group** | The dots on its heading while it opens, at least 0.2 s. No trace |
| **The match page's score** | `scoreDots()` in `match.js`: tapping a player's card (or a special win) serves their score with the frame's save, traces the new number (`ink: '.pc-score'`), and follows the score through each redraw. A refused save is not traced |

**The engine gained:** `ink` (the digits a part of the target; only they dim while it waits and fade in under the dots, so a stepper's chevrons and the score's button stay put); digits read from a number field (laid out from its alignment, padding and font, since a field has no text on the page); `data-dots-hold` (a target under a finger is not dimmed); a pill's outline at its own border width. **Also, at UV's word:** an icon is traced twice as fast as before (`TRACE_MS.icon` 1.3 s → 0.65 s), so its ring comes in sooner.

**Measured 28 Oct at 420px** (stand-in database, change of speed): a stepper tapped 1.4, held 1.3 s 2.3 (the number lit and counting while held, the dots waiting); a pill 2.5; a form switch 0.5–0.7; a folding group 0.5–0.7; the break event (the cue ball traced) 1.3; the match score (the new number traced after the save) 2.0; four quick Paid ticks, five runs, 0.6–3.7, saved in order, page = database. Not driven: the slide by a real drag, a date's calendar.

*Considered, not built:* fewer dots tracing an icon with fewer strokes (UV, "a consideration"), the rest racing.

**After UV's second look (28 Oct):**

| | |
|---|---|
| "asked to serve Saving, which is not on the page" (league settings' switches) | A page that draws its form again **inside** its change handler threw the switch away before the dots came for it: a control was handed to the new form only while the dots were on it. It is now registered the moment it changes (`changing`), so the rebuild hands it over. Same for the three-way switch |
| "7 left the page while the dots were serving it" (the match page's settings steppers) | Steppers and dates follow their field's id to the control the page draws in its place (`followField()`); with no id they are let go quietly (`leaves`). Pills likewise |
| **Buttons** | Every button gets the dots when pressed (a document listener in `tdc-controls.js`): for the save it set off and at least 0.2 s, a ring icon traced, anything else raced round. Not a control's own parts, not the nav (it serves its own), not one the page already gave the dots, not one hidden by its own press (a panel's Close), and not when the page gave the dots to something else in its handler (the match page's special wins serve the score) |
| Words vanishing on a pressed button or pill | A filled button, and a pill's green pill, dim only to `--dots-busy-fill` (0.45, on the main sandbox's Dots group) while waiting and while traced, and the pill keeps its fill while it is traced; the chosen option's words turn cream meanwhile |
| Icons still slow | `TRACE_MS.icon` 0.35 s (from the prototype's 1.3 s). The hand-over in, `--dots-blend` (0.6 s), comes on top |
| The score's dots too big | The dots on a digit are 0.6 of the font's stroke, and at most 16px (`DIG_DOT`, `DIG_DOT_MAX`): on the 255px score they measured 22px across with their wobble, inside its strokes |
| The break event's cue ball | As tall as the green pill allows, at its left, with its ring |

Measured at 420px: every switch and stepper on `/leagues/new/` and `/tournaments/new/` (forms that rebuild on each change) and the match settings panel's stepper served and finished with no error and nothing left marked; a button 0.52 opacity while waiting.

**Nothing fades in before it is ready (UV, 28 Oct):** "only when an element is ready for interaction do we fade in"; until then the dots stand in for it.

| | |
|---|---|
| A folding group opening (`fold()` in `tdc-controls.js`) | **Since 29 Oct (UV) the dots sit on the heading's + / – at its right end** (`TDC.groupDots`: an invisible spot there, coloured the site's green; the + hides while they are on it), not round the group. *Before:* it grows with its contents hidden and the dots on the group itself (`fake: true`: a fake ring from its shorter side, so it widens as the group opens, even though the group holds ring icons; `data-dots-hold` so the group is not dimmed). It is ready once it has opened, 0.2 s have passed, and anything the opening set loading (a call `TDCNet` saw start within 60 ms) is back; the dots then show the contents as they arrive, and they fade in, icons drawing in. Shown anyway 2.5 s after it is ready if the dots never got there. A second tap mid-way closes it and nothing is left hidden |
| Something loading with the page (`track()`) | **Hidden** (`data-dots-load`: opacity 0), not dimmed, until it is back; it fades in as the dots move on, or under their race when it is the last |

The engine gained `opts.fake` and `data-dots-load`. Measured at 420px: a group on `/leagues/new/` stayed at 0 while it grew (48 → 462px) and the dots travelled to it, faded in as they arrived (about 1 s), worst change of speed 2.6; three quick taps left it closed and whole. The fixtures page: the heading hidden until its read was back (about 1.1 s), the planner until the fixtures were (about 3 s).

## 8a. Never a loading message (29 Oct)

UV, said many times: no "Loading…", "Saving…", "Checking…", "Reading…" anywhere; **the dots are how the site shows that something is happening and it is not ready for input**. On 29 Oct every such message went (about 45, across 17 files, and four placeholders in the HTML):

| | How the dots come instead |
|---|---|
| `TDC.busy(el, work, statusEl)` (`tdc.js`) | The dots on `el` for as long as the promise `work` takes. For a handler that awaits anything before its call (a picture prepared before it is uploaded, the profile's multi-step saves), a native field (the match's date and time), or a form sent with Enter. Used on sign-in, reset, profile, push, league new and settings, new match, every staff page, the bracket's checks and swap picker, new tournament |
| `TDC.writer` | Prints no "What…" line. A save is shown by the control or button that made it (`writeSince` marks it claimed); one nobody claims within 30 ms gets the dots on the focused element, else the console says it had nothing to show it on |
| A section loading when opened | The Season tab's teams: the dots on the team (following it through the redraw by its id) until its players are drawn; nothing written inside meanwhile (it said "Open to see the players.") |
| The nav's list, the credits balance | The bell's row already had the dots: "Reading…" went. The balance line keeps its height, blank, with the dots on it |
| Placeholders | The card's state line, the join page's heading, the board: empty until filled (the loading screen covers the first read) |

Checked at 420px on the stand-in: every page opened with nothing reading "Loading" or "Reading" as the screen went and no script error; sign-in pressed with a 1.5 s call: the dots on the button, no status text, the failure then shown as "TDC (Error): …"; a team opened on the Season tab: the dots on it, empty inside, then its players.

## 9. The loading screen (29 Oct, UV's items 10 and 11)

UV: a loading screen on every page, gone only once the page has fully loaded, its data included; **Loader A**: the dots big in the middle of the screen, and the site icon exactly where the nav bar's sits, so the fade leaves the real one in the same spot. ~~The screen is opaque~~ **Since UV's second look (29 Oct) it is see-through with a strong blur** (`--loader-blur`, 24px): the page is there underneath, out of focus, and comes sharp as the screen fades.

**UV's second look (29 Oct): the screen shows wherever a section is still loading, and goes only once the page is present and populated.**

| | What changed |
|---|---|
| A tab opened later | `TDCLoader.hold` made after the screen has gone **brings it back** (`raise()`), at once with no fade in, and runs the same wait as at page load (`cycle()`). A league tab opened for the first time holds through its own start block and league-nav's network wait, so the screen covers it until it is drawn. Its pill gets no dots of its own then (the screen's dots are showing) |
| A tab shown again | No screen: it is drawn already, and reads again in place with its changed text fading (item 13). league-nav holds only on a tab's first start (before, every showing held the network, which would now have raised the screen over a re-read) |
| Sections loading under the screen | Something tracked (`TDCDots.track`) that is back while the screen is up is shown at once (`underScreen()` in `dots.js`), not faded in over `--dots-reveal`: the fixtures planner was still fading in for a second after the screen had gone. Its fade is the screen's |
| A team opened on the Season tab | Not covered: it already stays empty with the dots on it until its players are in (§8, "nothing fades in before it is ready") |

Checked at 420px on the stand-in: the Fixtures tab tapped, the screen up within 60 ms, gone after its reads (3.1 s with 0.7 s calls), the planner whole at that moment; Season shown again, no screen. Every page opened with a watcher noting, at the moment the screen starts to fade, anything still hidden by the dots, busy, or reading "Loading…" / "Reading…": none, except the team card and the join page **with a match or league that was not found**, which leave their "Loading…" placeholder beside the error.

| Piece | Where | What |
|---|---|---|
| The screen | `layout.html`, first in `<body>` | There from the first paint, before any script. See-through, blurring the page by `--loader-blur` (opaque `--bg-base` until UV's second look), `z-index: 900`: over the nav (100), its menu and tray, under the dots (1000) and their error line (1001). It catches taps, so nothing under it can be pressed |
| The icon | `.tdc-loader-icon` (`loader.css`) | Placed with the nav logo's own tokens (`--nav-top`, `--nav-height`, `--nav-logo-height`, now shared with `nav.css`). Measured: 187, 7, 46 × 46 at 420px and 697, 7, 46 × 46 at 1440, identical to the nav's |
| The ring | `.tdc-loader-ring` | A fake ring in the middle (`--loader-size`, a square, so the ring margin is added), its border transparent: only its width counts, the dots' size on it (`--loader-stroke`). The dots take their colour from its text colour (cream) |
| How a page says it is ready | `TDCLoader.hold(promise, label)` | Every page's start block (the `async` block at the end of its script) is wrapped in it: 27 blocks in 26 scripts, the nav's own included. `TDCDots.track` holds what it tracks; `league-nav.js` holds the tab the page opens on and the tab bar. A tab opened later for the first time brings the screen back (below) |
| Ready | `loader.js` `ready()` | The page's `load` (styles, scripts, the icon), its fonts, every hold settled, the network quiet (`TDCNet.quiet()`: the nav's bell and picture, and pages with no start block, sign-in for one), the pictures on the page loaded (not lazy ones); again until nothing new is held; then two frames, so what was drawn is painted behind the screen |
| The end | `hide()` | The screen fades over `--loader-fade`. The dots' call is the screen going: they race the ring and fade once it is back, and its comeback is set to the same `--loader-fade`, so they go as the screen does (measured: the last dot seen 80 ms after the screen). The screen is then hidden, not removed: a target that leaves while the dots race it would read to them as a failure |

**Building on the dots, not beside them.** The loader's ring is an ordinary `serve()`, so it is a tap to the dots and takes them at once. While the screen is up the page-load queue goes nowhere (`nextPending` returns none while `TDCLoader.up`): whatever `track()` is loading is under the screen, and before this the dots could fly off to the fixtures planner underneath. Tracked elements still dim and come back as before, unseen; by the time the screen goes every one of them has settled, since each held it. A tab tapped afterwards gets the dots exactly as before (checked: they go to the Fixtures tab's planner).

**Timing.** The dots come only after `GRACE` (150 ms, the queue's own), so an instant page shows the icon and fades with no dots (the signed-out home page: gone at 173 ms). Measured at 420px on a stand-in with every call 1.2 s: the dots appear at 260 ms, travel, orbit, race, fade; the screen goes once the last read is drawn.

| | What happens |
|---|---|
| Reduced motion | No dots. The ring is drawn (`::before`) and breathes with the dots' calm pulse; it fades with the screen |
| A page still not ready after 20 s (`HANG`) | Shown as it stands; "TDC (Error): the page was still loading after 20 s (waiting for Matches), so it is shown as it stands." on a line at the foot of the screen (the dots' error look) for 8 s, and in the console with `[Loader]`. It names the holds still out at that moment |
| A page's start block that throws | Reported the same way ("Matches could not finish loading…"), and the page is shown |
| A stranger sent to sign in (`TDC.requireSession`) | `TDCLoader.leaving()`: the screen stays up until the browser has gone, so the empty page never shows on the way |
| `loader.js` never runs (a broken or missing script) | `loader.css` drops the screen after 30 s by itself, so the page cannot be locked. The script stops that timer the moment it starts |

**Checked 29 Oct at 420px** against the stand-in (§6): every page (30 addresses, the league tabs and staff pages included) loads, the screen goes, no script error, nothing left marked by the dots, nothing wider than the screen. A hung call: shown at 20.1 s with the message. The league page opened on Fixtures: the screen went just after its last read (2.66 s with 0.5 s calls), the dots never left the ring for the planner. Not checked against the real database or on a phone.

*For UV to judge:* as the dots race at the end, the ring fades in faintly while the screen fades out (as any target's ring comes back under the dots' race); the ring's size and the dots' size (`--loader-size` 9rem, `--loader-stroke` 5px) and the fade (0.5 s), all on the main sandbox's Dots group.
