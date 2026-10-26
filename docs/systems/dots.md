# The dots — loading and feedback motion

> Built from `docs/design/dots-motion-spec.md` (the architecture and requirements) and `docs/design/dots-prototype.html` (how it should feel). Started 26 Oct 2026. **In progress: step 1 of the spec's seven (§16) is built.** This file says what exists and why it is shaped that way; the spec says what is still to come.

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

**The API.** `TDCDots.serve(el, promise, { reveal })` marks `el` busy (`data-dots="busy"`), takes the dots to it and returns the promise. When the promise settles, either way, the target is revealed: `data-dots="revealing"` while its transition runs, `reveal()` called to show the result (a new number), then the attribute goes. A target already busy is not served twice; the dots wait for both calls. Step 5 adds `track()` and the page-load queue on top of this.

**Interruptions (spec §3).** Serving a new target takes the dots there at once from wherever they are. The old target stays busy until its own call is back and then comes back **without the dots**. Checked 26 Oct: three targets tapped in quick succession, the first two came back on their own, the last got the race, nothing was left marked.

**The layer.** One `div.tdc-dots`, fixed over the whole screen above the nav (`z-index: 1000`, the nav is 100), `pointer-events: none`. One canvas (trails, and later a group move's extras) and four `span.tdc-dot`, moved by `transform` and `opacity` only. Added to the page on the first serve.

**The loop.** One `requestAnimationFrame` for everything. It **stops when the dots are hidden**, so an idle page costs nothing, and starts again on a serve. `dt` is measured in 60 fps frames and capped at 50 ms, so every spring runs the same at any frame rate and a tab coming back does not jump.

**The target is measured every frame**, so scrolling or a layout change never strands the dots:
- **A real ring** is any target holding a `.tdc-ring`: its `circle.ring`'s centre, radius and stroke width, scaled from the SVG's 100 box to the screen.
- **A fake ring** is anything else: centred on its box, its radius **half the box's shorter side** plus `--dots-ring-margin` (UV, 26 Oct): a wide button's height, a tall stepper's width. So a 46px-high full-width button gets a ring 59px across in its middle, and the dots cross its face as they go round. Its stroke is the element's border, or `--dots-fake-stroke` if it has none. (The spec's half-diagonal gave that button a ring about 374px across, far wider than the page.)

**Colour (UV, 26 Oct): the dots take the colour of the line they are on.** On a real ring that is the ring's stroke (cream today); on a fake ring the element's border colour, else its background, else its text. It is read once, at the serve, **before** the busy state makes the border transparent. The dots blend to it as they travel. From step 2, they take the traced icon's colour while tracing and blend back to the ring's for the race.

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

**Two animations on one sphere ease into each other.** The race takes over the cruise's own dots where they are and eases its speed (up to three times the cruise's, about two laps a second, slower on a big ring), bob and glow up from the cruise's over `--dots-blend`. From step 2 the trace is a different shape, so the change from waiting to tracing will need its own smooth hand-over over `--dots-blend`.

**Stages built:** travel (above; dots stretch along their path when fast), **cruise** (the one waiting move so far: clockwise with a gentle bob), the ring race, and the fade (while still racing, once the target's own reveal transition has run and at least the longest of 0.75 s ÷ `--dots-fade` and `--dots-blend` has passed).

**Busy and revealing (`dots.css`).** A ring icon's ring hides and its icon dims to `--dots-busy-dim`, in `--dots-dim`; both come back in `--dots-reveal`, which the script reads from the computed transition to know when the ring is fully in. Anything else has its border made transparent and the whole of it dimmed. Step 2 gives each kind of element its own (an outline, an underline, a number).

**Failures.** A target that leaves the page while served is reported with `TDC.error('Dots', …)` and the dots fade where they are. A `reveal` that throws is reported and the target still comes back. The rest of the spec's error handling is step 6.

## 4. Built so far, and what is next

| Step (spec §16) | State |
|---|---|
| 1. Engine: sphere, springs, loop, stroke and colour reading, travel, cruise, race, fade | **Built and approved by UV, 26 Oct** |
| 2. Tracing and the element types | Next |
| 3. The sandbox's full controls | The page exists with a delay slider and status line only |
| 4. The move registry, 18 solo and 14 group moves | `Ring`'s orbit holds cruise alone, to be replaced by the registry |
| 5. The page-load queue and `track()` | |
| 6. Reduced motion, error handling | Reduced motion is not handled yet |
| 7. Replace `ring-status.js`'s dots; wire into real elements | |

## 5. Tokens

| Token | Default | What |
|---|---|---|
| `--dots-ring-margin` | 6px | A fake ring's gap beyond the element's shorter side. 0 makes the ring exactly the button's height |
| `--dots-fake-stroke` | 1.5px | The dots' size on a fake ring with no border |
| `--dots-fade` | 1 | How fast the race ends and the dots fade, times the prototype's |
| `--dots-blend` | 0.6s | The dots moving from one animation to the next: the race easing up from the cruise, and from step 2 waiting into tracing |
| `--dots-busy-dim` | 0.1 | How faint a waiting target is |
| `--dots-dim` | 0.2s | A target dimming as it goes busy |
| `--dots-reveal` | 0.25s | A target coming back (spec: icon and ring in about 0.25 s) |

## 6. Testing it

Headless Chrome is useful here, with two traps found on 26 Oct:
- **A screenshot can show a stale frame.** Headless Chrome kept presenting an old picture of the moving dots (they looked 40px off the ring while the page reported them on it). Change the DOM just before each capture (any attribute) to force a fresh paint.
- **A clipped capture bigger than the screen re-lays out the page**, which moves the fixed layer. Scroll the target into view and capture the screen instead.

Positions are best checked from the page itself: each `.tdc-dot`'s `getBoundingClientRect()` against the target's.
