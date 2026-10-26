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
- **A fake ring** is anything else: centred on its box, radius half the box's diagonal plus `--dots-ring-margin`, at most `--dots-ring-cap`. Its stroke is the element's border, or `--dots-fake-stroke` if it has none.

**Colour (UV, 26 Oct): the dots take the colour of the line they are on.** On a real ring that is the ring's stroke (cream today); on a fake ring the element's border colour, else its background, else its text. It is read once, at the serve, **before** the busy state makes the border transparent. The dots blend to it as they travel. From step 2, they take the traced icon's colour while tracing and blend back to the ring's for the race.

**The sphere (spec §4).** Each dot is a unit vector; screen position is the ring centre plus radius × (x, y), and z is height above the page. Size is `stroke × 2^(1.5 × height)`; brightness rises with height. A dot arriving inside the ring joins the sphere over the top, and locks on over a moment rather than snapping. Motion on the sphere is a spring towards a target point, renormalised to the surface each frame, its velocity kept tangent.

**Stages built:** travel (each dot follows the cluster with its own lag, lifts as it goes, stretches along its path when fast), **cruise** (the one waiting move so far: clockwise with a gentle bob), the ring race (clockwise at stroke size, speeding up to about two laps a second, a slight bob) and the fade (while still racing, once the target's own reveal transition has run and at least 0.75 s ÷ `--dots-fade` has passed).

**Busy and revealing (`dots.css`).** A ring icon's ring hides and its icon dims to `--dots-busy-dim`, in `--dots-dim`; both come back in `--dots-reveal`, which the script reads from the computed transition to know when the ring is fully in. Anything else has its border made transparent and the whole of it dimmed. Step 2 gives each kind of element its own (an outline, an underline, a number).

**Failures.** A target that leaves the page while served is reported with `TDC.error('Dots', …)` and the dots fade where they are. A `reveal` that throws is reported and the target still comes back. The rest of the spec's error handling is step 6.

## 4. Built so far, and what is next

| Step (spec §16) | State |
|---|---|
| 1. Engine: sphere, springs, loop, stroke and colour reading, travel, cruise, race, fade | **Built 26 Oct.** UV to review on `/sandbox/dots/` |
| 2. Tracing and the element types | Next |
| 3. The sandbox's full controls | The page exists with a delay slider and status line only |
| 4. The move registry, 18 solo and 14 group moves | `domeStep()` holds cruise alone, to be replaced by the registry |
| 5. The page-load queue and `track()` | |
| 6. Reduced motion, error handling | Reduced motion is not handled yet |
| 7. Replace `ring-status.js`'s dots; wire into real elements | |

## 5. Tokens

| Token | Default | What |
|---|---|---|
| `--dots-ring-margin` | 6px | A fake ring's gap round an element's box |
| `--dots-ring-cap` | none | A fake ring's largest radius. Open question 4: a full-width button's ring is about 187px across a phone, and at that size cruise smears the dots into streaks. To be settled in the sandbox (step 3) |
| `--dots-fake-stroke` | 1.5px | The dots' size on a fake ring with no border |
| `--dots-fade` | 1 | How fast the race ends and the dots fade, times the prototype's |
| `--dots-busy-dim` | 0.1 | How faint a waiting target is |
| `--dots-dim` | 0.2s | A target dimming as it goes busy |
| `--dots-reveal` | 0.25s | A target coming back (spec: icon and ring in about 0.25 s) |

## 6. Testing it

Headless Chrome is useful here, with two traps found on 26 Oct:
- **A screenshot can show a stale frame.** Headless Chrome kept presenting an old picture of the moving dots (they looked 40px off the ring while the page reported them on it). Change the DOM just before each capture (any attribute) to force a fresh paint.
- **A clipped capture bigger than the screen re-lays out the page**, which moves the fixed layer. Scroll the target into view and capture the screen instead.

Positions are best checked from the page itself: each `.tdc-dot`'s `getBoundingClientRect()` against the target's.
