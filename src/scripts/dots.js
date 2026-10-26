// The dots: the site's loading and feedback motion (UV, 26 Oct). Four dots,
// one set for the whole page, that go to whatever is waiting on the network,
// live on an invisible sphere round it until the call is back, then trace its
// lines, race its ring and fade. The spec is docs/design/dots-motion-spec.md;
// how it should feel is docs/design/dots-prototype.html, and the moves are
// ported from it.
//
//   TDCDots.serve(el, promise, { reveal, trace, status, timeout })
//     el       the target. A ring icon (anything holding a .tdc-ring) uses its
//              real ring; anything else gets a fake ring from its shorter side
//     promise  the call; when it settles, the target is revealed
//     reveal   called the moment the call is back, to put the result on the
//              page (a new number, a switch flipped). It is hidden while the
//              dots trace it and comes in when they are done
//     trace    what the dots trace (spec §10): 'icon' for a ring icon (the
//              default when there is one), 'number' (its digits), 'tab' (its
//              pill's outline), or 'none' (the default otherwise: a button's
//              fake ring is enough, UV 26 Oct)
//     status   the page's status line, where a failure of the dots is shown
//              ("TDC (Error): …"); without one the dots show it on their own
//              line at the foot of the screen
//     timeout  how long the call may go unanswered (ms, HANG if not given)
//   Returns the promise. A target already busy is not served twice: the dots
//   wait for both calls. Serving a new target (a tap) takes the dots there at
//   once; the old one restores itself, without them, when its own call is back.
//   TDCDots.track(el, promise, { reveal, trace })
//     the same, for something loading with the page (spec §12). It joins the
//     queue rather than taking the dots: nothing shows for GRACE ms, so an
//     instant load shows nothing; then every element still loading dims and
//     the dots go to the first in the page's order, wherever it is. One that
//     is back before the dots reach it simply appears, and they turn for the
//     next. Only the last is traced and gets the race and fade; the others come
//     in as the dots fly on (UV, 26 Oct), taps included. A tap takes the dots
//     at once, and whatever is still loading afterwards gets them next.
//   TDCDots.state  what the dots are doing (the phase, each dot's solo move
//     or the group move, the target, how many are loading, whether motion
//     is reduced), for the sandbox
//   TDCDots.moves, TDCDots.groups, TDCDots.force(name | null)  the solo and
//     group moves, and one to play on repeat (the sandbox's picker)
//
// The animation runs; the dots show it (UV, 26 Oct). The dots' motion lives
// on a sphere and never stops: travelling, they keep cruising and the sphere
// moves to the next ring, lifting to 1.5 times its size on the way and
// settling onto it. Tracing is a second animation beside it while the sphere
// carries on underneath; the dots slide from one to the other (Blend) over
// --dots-blend, each in its own time, and arrive in an animation that is
// already running.
//
// The sphere (spec §4): each dot on a ring is a unit vector on a sphere whose
// equator is the ring. x and y are its place on the screen, z its height
// above the page: higher is bigger and brighter. Size on the ring line is the
// stroke width of the line the dots are on, and so is their colour.
//
// Reduced motion (spec §14, step 6): when the device asks for less motion
// (or the page's root says data-motion="reduce"; "full" overrides the
// device), nothing orbits or flies. A tapped target breathes while its call
// is out (dots.css) and fades in plainly when it is back; something loading
// with the page dims and fades in, without the pulse (UV, 26 Oct).
//
// Failures (spec §14, step 6) are never silent: each goes to the console with
// [Dots] and onto the page as "TDC (Error): …" (fail), and the target still
// ends as it should, its result shown and no data-dots left on it. A call
// with no answer after HANG is shown as it was and the dots move on; a call
// that fails is not traced (the page reports its own error); a target that
// leaves the page is cleaned at once; and if the dots themselves throw, they
// hide and every target is put right (recover).
//
// Built so far (spec §16, steps 1 to 6): travel, the waiting moves (18 solo,
// 16 group: SOLO and GROUP), tracing, the ring race, the fade, the page-load
// queue, reduced motion and the failures.
//
// Needs: tdc.js (TDC.error). Its look is stylesheets/dots.css; its sizes and
// times are tokens in variables.css (--dots-*).

const TDCDots = (() => {
	const AREA = 'Dots';
	const PI = Math.PI;
	const NS = 'http://www.w3.org/2000/svg';
	const BASE = 8;   // a dot's drawn size in px; every size is a scale of it
	// Travel: how long a trip takes (ms, from its length in px, within limits).
	// LIFT: the sphere's size at cruise height, times the new ring's. RISE and
	// FALL: the share of the trip spent lifting to it and settling onto the
	// ring. LAG: how far behind the sphere a dot may follow (ms), so they move
	// as particles.
	const TRAVEL_BASE = 350, TRAVEL_PER_PX = 2.2, TRAVEL_MIN = 450, TRAVEL_MAX = 1200;
	const LIFT = 1.5, RISE = 0.3, FALL = 0.4, LAG = 60;
	// How far a fast dot may stretch along its path (0.35: to 1.35 times its
	// length, a little thinner), and how far its glow reaches at full glow, as
	// times its size. Both in proportion to the dot: the prototype's (2.5 times,
	// and a fixed 3 to 12px of glow) were made for bigger dots.
	const STRETCH = 0.35, GLOW_REACH = 1.5;
	// Tracing (spec §9): how long each kind takes at draw speed 1 (ms, the
	// prototype's), after the dots' slide in (--dots-blend). DIVE: the most a
	// dot waits before it starts sliding in (ms), so they do not go as one.
	// Where the lines jump (from one stroke or digit to the next) a dot swoops
	// across, eased in and out, in SWOOP_MS plus SWOOP_PER_PX for each px of
	// the gap, lifting at most SWOOP on the way (the sphere's scale: 0.15 is
	// 1.17 times its size). A pen moving more than JUMP px in a frame has
	// jumped.
	const TRACE_MS = { icon: 1300, tab: 1500, number: 1500 }, TRACE_PER_DIGIT = 500;
	const DIVE = 150, SWOOP = 0.15, SWOOP_MS = 90, SWOOP_PER_PX = 4, SWOOP_MAX = 380, JUMP = 6;
	// How long the dots race on the ring once it is fully back and they are
	// all on it, before they fade (ms, at --dots-fade 1): as in step 1, where
	// the race ran 0.75 s from the reveal and the ring took 0.25 s of it.
	const RACE_HOLD = 500;
	// The page-load queue (spec §12): how long something tracked must still be
	// loading before it dims and the dots come for it (ms), so an instant load
	// shows nothing.
	const GRACE = 150;
	// Failures: how long a call may go unanswered before it counts as hung
	// (ms, UV 26 Oct: 20 s), and how long the dots' own error line shows.
	const HANG = 20000, ERROR_MS = 6000;
	// The single-line digits that guide a number's dots (UV, 26 Oct), from
	// the prototype: a 10 by 16 box, absolute commands only. Never drawn: each
	// is fitted over its digit in the site's font and pulled onto the middle
	// of its strokes (digitLines).
	const DIG = {
		'0': 'M5 0 C8 0 10 3 10 8 C10 13 8 16 5 16 C2 16 0 13 0 8 C0 3 2 0 5 0 Z',
		'1': 'M2 3 L6 0 L6 16',
		'2': 'M0 4 C0 1.5 2 0 5 0 C8 0 10 2 10 4.5 C10 7 8 8.5 6 10 L0 16 L10 16',
		'3': 'M0 2 C1 0.5 3 0 5 0 C8 0 10 1.8 10 4 C10 6.3 8 7.6 5 7.6 C8.5 7.6 10 9.6 10 12 C10 14.4 8 16 5 16 C2.5 16 1 15 0 13.5',
		'4': 'M7 16 L7 0 L0 11 L10 11',
		'5': 'M9.5 0 L1 0 L0 7 C1.5 6 3 5.6 5 5.6 C8 5.6 10 7.8 10 10.8 C10 13.8 7.8 16 5 16 C2.6 16 1 15 0 13.5',
		'6': 'M8.5 1 C7.5 0.3 6.3 0 5 0 C2 0 0 3 0 8.5 C0 13.5 2 16 5 16 C8 16 10 14 10 11 C10 8 8 6 5 6 C2.5 6 0.6 7.5 0 9.5',
		'7': 'M0 0 L10 0 L3.5 16',
		'8': 'M5 7.5 C2.5 7.5 1 6 1 3.8 C1 1.5 2.8 0 5 0 C7.2 0 9 1.5 9 3.8 C9 6 7.5 7.5 5 7.5 C2 7.5 0 9.4 0 11.8 C0 14.3 2.2 16 5 16 C7.8 16 10 14.3 10 11.8 C10 9.4 8 7.5 5 7.5 Z',
		'9': 'M10 6.5 C9.4 8.5 7.5 10 5 10 C2 10 0 8 0 5 C0 2 2 0 5 0 C8 0 10 2.5 10 7.5 C10 13 8 16 5 16 C3.7 16 2.5 15.7 1.5 15'
	};
	const PAIR = /(-?[\d.]+) (-?[\d.]+)/g;
	// A glyph's box, from its points (the curves stay inside their control points).
	const boxOf = (d) => {
		const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
		d.replace(PAIR, (m, x, y) => { b.x0 = Math.min(b.x0, +x); b.x1 = Math.max(b.x1, +x); b.y0 = Math.min(b.y0, +y); b.y1 = Math.max(b.y1, +y); return m; });
		return b;
	};
	const DIG_BOX = Object.fromEntries(Object.keys(DIG).map((k) => [k, boxOf(DIG[k])]));
	// The moves (step 4). CARRY: how long a new solo move takes to ease its
	// aim in from where the last one was aiming (ms), so nothing jumps between
	// moves. LAND: the squash after a hop, dive, over or under lands (ms).
	// TRAIL_MS: a trail's length (ms) unless a move asks for longer (the
	// prototype's 16 frames at 60 fps); TRAIL_EVERY: how often a trail takes a
	// point (ms).
	const CARRY = 300, LAND = 220, TRAIL_MS = 270, TRAIL_EVERY = 12;

	// ─── Maths ───
	const sm = (x) => x * x * (3 - 2 * x);
	const ease = (x) => x * x * x * (x * (6 * x - 15) + 10);   // slow in, slow out
	const cl = (x) => Math.max(0, Math.min(1, x));
	const mix = (a, b, e) => a + (b - a) * e;
	const mixC = (a, b, e) => [mix(a[0], b[0], e), mix(a[1], b[1], e), mix(a[2], b[2], e)];
	const sph = (th, ph) => [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
	const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l); };
	const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	// v turned about the unit axis k by a (clockwise on the screen when k
	// points at the viewer: x is right, y down, z out of the page).
	function rotV(v, k, a) {
		const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), kd = dot3(k, v) * (1 - c);
		return [0, 1, 2].map((j) => v[j] * c + kv[j] * s + k[j] * kd);
	}
	const jig = (tau, k = 4.5, f = 16) => Math.exp(-k * tau) * Math.cos(f * tau);   // a jelly wobble, from 1 to rest (tau in s)
	const eob = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);    // out past 1 and back
	const randAxis = () => nrm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
	// A plane through the centre, tilted towards the viewer by nz: its normal
	// and two directions in it.
	function tiltedPlane(nzMin, nzMax) {
		const nz = nzMin + Math.random() * (nzMax - nzMin), a = Math.random() * 2 * PI, s = Math.sqrt(1 - nz * nz);
		const n = [s * Math.cos(a), s * Math.sin(a), nz], u = nrm(cross(n, [0, 0, 1]));
		return { n, u, v: cross(n, u) };
	}
	// One entry of a table of moves, by weight.
	function pick(table) {
		const all = Object.entries(table);
		let r = Math.random() * all.reduce((a, [, m]) => a + m.weight, 0);
		for (const [name, m] of all) if ((r -= m.weight) < 0) return name;
		return all[0][0];
	}

	// ─── The waiting moves (spec §8) ───
	// Ported from the prototype (BEH, DUR, domeStep; GROUPS, startGroup,
	// groupStep, drawDisk, drawFloor). Each is one entry: its weight in random
	// mode, its length (ms: a base and a random extra), and step(), a function
	// of the move's progress p (0 to 1) that says where the dot aims on the
	// unit sphere, either as { th, ph } (longitude, clockwise; latitude, up is
	// towards the viewer) or as a point { aim }, plus whatever it changes:
	//   sq     squash (negative) or stretch along its path
	//   sx sy  a squash or stretch of its own, at the angle srot (null: along
	//          its path); 1 is round
	//   glow, trail, vm (how visible, 1 is fully), szm (size, times), blur
	//   k damp the spring's pull and damping (0.34 and 0.6 if not given)
	// Ring mixes whatever a move gives with the rest (Ring.step), so every
	// move begins and ends without a jump.
	//
	// Solo moves: each dot runs its own, one after another. `big` moves are
	// staged one at a time (spec §7); `land` ones squash as they land.
	// step(v, m, c): v the dot (v.th its longitude, which most moves carry
	// on), m the move (th0, ph0, V0: where the dot was when it began; sg a
	// random sign; inc, sr random angles), c the moment (p, i the dot, t the
	// time in s, step the frame's share of a second, w the dot's own speed,
	// bob the cruise's bob).
	function hopping(s) {
		return (v, m, c) => {
			const p = c.p;
			v.th += c.w * 0.5 * c.step;
			let ph, sq = 0, glow = 0;
			if (p < 0.2) { const q = p / 0.2; ph = -0.15 * s * sm(q); sq = -0.45 * Math.sin(PI * q); }
			else if (p < 0.78) {
				const q = (p - 0.2) / 0.58;
				ph = s * (-0.15 + 0.15 * q + 1.05 * Math.sin(PI * q));
				sq = q < 0.25 ? 0.55 * Math.sin(PI * q / 0.25) : 0;
				if (s > 0) glow = 0.35 * Math.sin(PI * q);
			} else { const q = (p - 0.78) / 0.22; ph = -0.1 * s * Math.sin(PI * q); sq = -0.55 * Math.sin(PI * q); }
			return { th: v.th, ph, sq, glow };
		};
	}
	function shooting(span, lift, gl) {
		return (v, m, c) => {
			const p = c.p;
			let o, sq = 0, glow = gl;
			if (p < 0.22) { const q = p / 0.22; o = -0.35 * sm(q); sq = -0.45 * Math.sin(PI * q); glow *= 0.3; }
			else if (p < 0.85) o = -0.35 + span * sm((p - 0.22) / 0.63);
			else { const q = (p - 0.85) / 0.15; o = span - 0.35 + 0.2 * Math.sin(PI * q); glow *= 1 - q; }
			v.th = m.th0 + o;
			return { th: v.th, ph: m.ph0 * (1 - p) + lift * Math.sin(PI * p) * m.sg, sq, glow };
		};
	}
	// Over (up 1) or under (-1) the sphere, through the middle, to the far side.
	function crossing(up, gl) {
		return (v, m, c) => {
			const p = c.p, u = [Math.cos(m.th0), Math.sin(m.th0), 0];
			const ps = p < 0.12 ? -0.12 * Math.sin(PI * p / 0.12) : PI * sm((p - 0.12) / 0.88);
			return {
				aim: [u[0] * Math.cos(ps), u[1] * Math.cos(ps), up * Math.sin(ps)],
				sq: p < 0.12 ? -0.4 * Math.sin(PI * p / 0.12) : 0, glow: gl * Math.sin(PI * p)
			};
		};
	}
	const SOLO = {
		cruise: { weight: 3, dur: [900, 800], step: (v, m, c) => { v.th += c.w * c.step; return { th: v.th, ph: c.bob }; } },
		splat: {
			weight: 1.2, dur: [1500, 300], big: true,
			step(v, m, c) {
				const p = c.p, o = { ph: 0 };
				v.th += c.w * 0.25 * c.step;
				o.th = v.th;
				if (p < 0.26) { o.ph = 0.95 * Math.sin(PI / 2 * sm(p / 0.26)); o.sx = o.sy = 1 - 0.12 * Math.sin(PI * p / 0.26); }
				else if (p < 0.46) { const q = (p - 0.26) / 0.2; o.ph = 0.95 * (1 - q * q); }
				else {
					// The impact: half the time an even pancake, half an oval.
					const e = jig((p - 0.46) * m.bd / 1000, 4, 15);
					if (m.sg > 0) { o.sx = o.sy = 1 + 0.95 * e; o.srot = 0; }
					else { o.sx = 1 + 1.2 * e; o.sy = 1 - 0.5 * e; o.srot = m.sr; }
					o.glow = p < 0.52 ? 0.8 * (1 - (p - 0.46) / 0.06) : 0;
				}
				return o;
			}
		},
		flatten: {
			weight: 1.2, dur: [1600, 300], big: true, k: 0.5, damp: 0.5,
			step(v, m, c) {
				const p = c.p, rr = v.th + PI / 2;
				v.th += c.w * 0.12 * c.step;
				let ax = 1, pp = 1, push = 0;
				if (p < 0.18) { const q = p / 0.18; ax = 1 + 0.15 * Math.sin(PI * q); pp = 1 - 0.1 * Math.sin(PI * q); }
				else if (p < 0.36) { const q = sm((p - 0.18) / 0.18); ax = 1 - 0.65 * q; pp = 1 + 1.2 * q; push = 0.1 * q; }
				else if (p < 0.48) { ax = 0.35; pp = 2.2; push = 0.1; }
				else { const e = jig((p - 0.48) * m.bd / 1000, 3.5, 13); ax = 1 - 0.65 * e; pp = 1 + 1.2 * e; push = 0.1 * Math.max(0, e); }
				return { th: v.th + push, ph: 0, sx: ax, sy: pp, srot: rr };
			}
		},
		hop: { weight: 1.1, dur: [800, 150], big: true, land: true, step: hopping(1) },
		dive: { weight: 0.9, dur: [800, 150], big: true, land: true, step: hopping(-1) },
		shoot: { weight: 0.8, dur: [950, 200], big: true, step: shooting(5.6, 0.3, 0.55) },
		comet: { weight: 0.9, dur: [1100, 200], big: true, trail: true, step: shooting(6.6, 0.5, 0.95) },
		over: { weight: 0.9, dur: [1000, 250], big: true, land: true, step: crossing(1, 0.35) },
		under: { weight: 0.7, dur: [1000, 250], big: true, land: true, step: crossing(-1, 0.2) },
		tilt: {
			weight: 0.8, dur: [2000, 400], big: true, trail: true,
			step(v, m, c) {
				const h = [-Math.sin(m.th0), Math.cos(m.th0)], A = nrm([h[0] * Math.sin(m.inc), h[1] * Math.sin(m.inc), Math.cos(m.inc)]);
				return { aim: rotV(m.V0, A, 4 * PI * sm(c.p)), glow: 0.4 };
			}
		},
		spiral: {
			weight: 0.8, dur: [1800, 400], big: true, trail: true,
			step(v, m, c) { v.th += c.w * 1.2 * c.step; return { th: v.th, ph: m.sg * 1.3 * Math.sin(PI * sm(c.p)), glow: 0.5 * Math.sin(PI * c.p) }; }
		},
		settle: {
			weight: 0.8, dur: [1100, 300],
			step(v, m, c) {
				const s = Math.sin(PI * c.p);
				v.th += c.w * (1 - s) * c.step;
				return { th: v.th, ph: 0.05 * Math.sin(c.t * 3), sq: 0.22 * s * Math.sin(c.t * 16), glow: 0.3 * s * (0.5 + 0.5 * Math.sin(c.t * 16)) };
			}
		},
		weave: {
			weight: 1, dur: [1600, 400],
			step(v, m, c) { v.th += c.w * c.step; return { th: v.th, ph: 0.6 * Math.sin(3 * (v.th - m.th0)) * Math.sin(PI * c.p) }; }
		},
		reverse: {
			weight: 0.5, dur: [1100, 200],
			step(v, m, c) { const s = Math.sin(PI * c.p); v.th += c.w * (1 - 1.6 * s * s) * c.step; return { th: v.th, ph: 0.15 * Math.sin(c.t * 1.6 + c.i) }; }
		},
		// The prototype's tipsy squash (and jitter's below) began at full
		// strength; here it grows in with the move, so it does not jump.
		wobble: {
			weight: 0.8, dur: [1500, 500],
			step(v, m, c) {
				const s = Math.sin(PI * c.p);
				v.th += c.w * 0.8 * c.step;
				return { th: v.th, ph: 0.35 * Math.sin(c.t * 5.3 + c.i) * Math.sin(c.t * 2.1 + c.i * 3) * s, sq: 0.12 * Math.sin(c.t * 9) * s };
			}
		},
		zigzag: {
			weight: 0.8, dur: [1300, 300],
			step(v, m, c) {
				v.th += c.w * 1.1 * c.step;
				const x = c.p * 6, tri = 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;
				return { th: v.th, ph: 0.42 * tri * Math.sin(PI * c.p) };
			}
		},
		drop: {
			weight: 0.9, dur: [1300, 200], big: true,
			step(v, m, c) {
				const p = c.p;
				v.th += c.w * (p < 0.6 ? 0.3 : 1) * c.step;
				let ph, sq = 0, glow = 0;
				if (p < 0.6) { ph = 0.95 * sm(p / 0.6); sq = 0.15 * Math.sin(PI * p / 0.6); }
				else if (p < 0.74) { const q = (p - 0.6) / 0.14; ph = 0.95 * (1 - q * q); }
				else { const q = (p - 0.74) / 0.26; ph = 0.12 * Math.sin(PI * q) * (1 - q); sq = -0.6 * Math.sin(PI * Math.min(1, q * 2.5)); glow = 1 - q; }
				return { th: v.th, ph, sq, glow };
			}
		},
		jitter: {
			weight: 0.7, dur: [1100, 200], big: true,
			step(v, m, c) {
				const p = c.p;
				if (p < 0.45) {
					return { th: v.th + 0.05 * Math.sin(c.t * 61 + c.i), ph: 0.05 * Math.sin(c.t * 53), sq: 0.18 * Math.sin(c.t * 43) * sm(cl(p / 0.1)), glow: 0.6 * (p / 0.45) };
				}
				const q = (p - 0.45) / 0.55;
				v.th += c.w * (1 + 3 * Math.sin(PI * q)) * c.step;
				return { th: v.th, ph: 0, glow: 0.6 * (1 - q) };
			}
		}
	};

	// Group moves: all four dots at once, every 2 to 5 s. start(G, ring) sets
	// the group up (G.th0 is the first dot's longitude, G.d[i] each dot's own
	// state); frame(G, ring, now, dt) runs once a frame before the dots (a
	// spin, pool's physics); step(c, G) is as a solo's, with c.i the dot, c.g
	// its state, c.ring the sphere and c.now the time (a move that outlasts
	// its length, like merge's ending, reads its own time from it); draw()
	// puts its extras on the canvas. A group ends after its length, or sooner
	// when it sets G.ended (pool, when the balls stop).
	// The ball's and the stars' spots turning on their axis.
	function spin(G, ring, now, dt) {
		const a = G.ball.speed * sm(cl((now - G.t0) / 300)) * dt * 0.0167;
		if (a > 0) G.ball.P = G.ball.P.map((P) => rotV(P, G.ball.axis, a));
	}
	// The four corners of a tetrahedron at a random turn, each given to the
	// dot nearest it.
	function tetraFor(ring) {
		const s = 1 / Math.sqrt(3), ax = randAxis(), a0 = Math.random() * 6;
		const P = [[s, s, s], [s, -s, -s], [-s, s, -s], [-s, -s, s]].map((v) => rotV(v, ax, a0));
		const used = [];
		return ring.v.map((v) => {
			let best = -1, bd = -9;
			P.forEach((q, j) => { if (used.includes(j)) return; const s2 = dot3(q, v.V); if (s2 > bd) { bd = s2; best = j; } });
			used.push(best);
			return P[best];
		});
	}
	// The black hole's disk: a small glowing core and three rings at the
	// group's tilt, their back halves dim and behind the core, a shimmer
	// running round. Each ring is drawn in runs of RUN segments, each run one
	// stroke at its middle's shimmer: the prototype's one stroke per segment,
	// each with its own blur, doubled the frame time.
	function drawDisk(g, G, f, p, a, col, time) {
		const I = sm(cl(p / 0.12)) * (1 - sm(cl((p - 0.78) / 0.1)));
		if (I < 0.01) return;
		const B = G.bh, rd = f.r * 0.78 * I + 1.5, N = 60, RUN = 3, rings = [[rd, 1.1, 0.8], [rd * 0.8, 0.8, 0.55], [rd * 1.12, 0.5, 0.32]];
		g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.shadowColor = col;
		const at = (rr, an) => [0, 1, 2].map((j) => rr * (B.u[j] * Math.cos(an) + B.v[j] * Math.sin(an)));
		const half = (front) => {
			g.shadowBlur = front ? 6 * I : 0;
			for (const [rr, lw, al] of rings) {
				g.lineWidth = lw;
				for (let k = 0; k < N; k += RUN) {
					const mid = (k + RUN / 2) / N * 2 * PI;
					if ((at(rr, mid)[2] >= 0) !== front) continue;
					g.globalAlpha = a * I * al * (0.6 + 0.4 * Math.sin(4 * mid - time * 6)) * (front ? 1 : 0.4);
					g.beginPath();
					for (let s = 0; s <= RUN; s++) {
						const P = at(rr, (k + s) / N * 2 * PI);
						if (s) g.lineTo(f.cx + P[0], f.cy + P[1]); else g.moveTo(f.cx + P[0], f.cy + P[1]);
					}
					g.stroke();
				}
			}
		};
		half(false);
		g.globalAlpha = a * I * 0.9; g.lineWidth = 1; g.shadowBlur = 8 * I;
		g.beginPath(); g.arc(f.cx, f.cy, 2.4 * I + 0.4, 0, 2 * PI); g.stroke();
		half(true);
		g.restore();
	}
	// The shadows' floor: a faint dotted ellipse through the centre.
	function drawFloor(g, G, f, p, a, col) {
		const I = sm(cl(p * 5)) * sm(cl((1 - p) * 5));
		if (I < 0.01) return;
		const S = G.sh, rr = f.r * 1.15, N = 64;
		g.save(); g.strokeStyle = col; g.lineWidth = 0.75; g.setLineDash([1.5, 3]); g.globalAlpha = a * 0.28 * I;
		g.beginPath();
		for (let k = 0; k <= N; k++) {
			const an = k / N * 2 * PI, x = rr * (S.u[0] * Math.cos(an) + S.v[0] * Math.sin(an)), y = rr * (S.u[1] * Math.cos(an) + S.v[1] * Math.sin(an));
			if (k) g.lineTo(f.cx + x, f.cy + y); else g.moveTo(f.cx + x, f.cy + y);
		}
		g.stroke(); g.restore();
	}
	// ─── Pool (UV, 26 Oct) ───
	// A table (a plane through the centre at a random tilt, its edge the
	// cushion, drawn as a faint dotted ellipse) inside the ring. Dots 0 and 1
	// are the cue ball and the object ball, resting just above it; 2 and 3
	// are their shadows on it, cast along a random light. The cue ball pulls
	// back, then accelerates evenly into the object ball, usually with a cut;
	// they collide elastically with a flash, bank off the cushion losing
	// energy, and slow to a stop under drag (proportional to speed, plus a
	// constant rolling friction). Then the group ends and the dots go back
	// onto the sphere. Positions are in the table's own units (its radius is
	// POOL.r of the ring's); the physics runs in POOL.sub steps.
	const POOL = { r: 0.78, ball: 0.07, lift: 0.06, set: 0.9, pull: 0.35, back: 0.07, drag: 0.3, roll: 0.13, bank: 0.75, slide: 0.92, rest: 0.015, hold: 500, max: 12, sub: 0.004 };
	function poolStart(G) {
		const tb = tiltedPlane(0.55, 0.85), la = Math.random() * 2 * PI, lim = POOL.r - POOL.ball - 0.04;
		tb.L = [Math.cos(la), Math.sin(la)];
		// The object ball somewhere near the middle, the cue ball well away.
		let ob, cb;
		do {
			const a = Math.random() * 2 * PI, d = Math.random() * 0.4;
			ob = [d * Math.cos(a), d * Math.sin(a)];
			const b = Math.random() * 2 * PI, e = 0.45 + Math.random() * 0.3;
			cb = [ob[0] + e * Math.cos(b), ob[1] + e * Math.sin(b)];
		} while (Math.hypot(cb[0], cb[1]) > lim);
		// The cut: the line of centres at impact turned 8 to 35 degrees from
		// straight, so the cue ball aims at the ghost ball beside the object.
		const toward = Math.atan2(ob[1] - cb[1], ob[0] - cb[0]), cut = (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.47);
		const ghost = [ob[0] - 2 * POOL.ball * Math.cos(toward + cut), ob[1] - 2 * POOL.ball * Math.sin(toward + cut)];
		const dir = [ghost[0] - cb[0], ghost[1] - cb[1]], l = Math.hypot(dir[0], dir[1]);
		// Its speed at impact, from evenly faster over the run from the pulled-back spot.
		const v0 = 2.8 + Math.random();
		G.pool = {
			tb, dir: [dir[0] / l, dir[1] / l], start: cb, acc: v0 * v0 / (2 * (l + POOL.back)), hit: false, restAt: 0, flash: -1e9,
			b: [{ p: cb.slice(), v: [0, 0] }, { p: ob.slice(), v: [0, 0] }]
		};
	}
	function poolFrame(G, ring, now, dt) {
		const P = G.pool, e = (now - G.t0) / 1000, cue = P.b[0];
		if (P.restAt) { if (now - P.restAt > POOL.hold) G.ended = true; return; }
		// Set up, then the pull back (anticipation), eased out and held.
		if (e < POOL.set + POOL.pull) {
			const q = sm(cl((e - POOL.set) / POOL.pull)) * POOL.back;
			cue.p = [P.start[0] - P.dir[0] * q, P.start[1] - P.dir[1] * q];
			return;
		}
		const lim = POOL.r - POOL.ball;
		let left = dt / 60;
		while (left > 0) {
			const h = Math.min(POOL.sub, left);
			left -= h;
			if (!P.hit) {
				// The shot: evenly faster along the aim until the balls touch.
				cue.v = cue.v.map((x, j) => x + P.dir[j] * P.acc * h);
			} else {
				for (const b of P.b) {
					const s = Math.hypot(b.v[0], b.v[1]);
					if (!s) continue;
					const ns = Math.max(0, s - (POOL.drag * s + POOL.roll) * h);
					b.v = b.v.map((x) => x * ns / s);
				}
			}
			for (const b of P.b) b.p = b.p.map((x, j) => x + b.v[j] * h);
			// The balls meet: equal masses, so they swap the speed along the line
			// between them.
			const [a, b] = P.b, d = [b.p[0] - a.p[0], b.p[1] - a.p[1]], dl = Math.hypot(d[0], d[1]);
			if (dl < 2 * POOL.ball && dl > 0) {
				const n = [d[0] / dl, d[1] / dl], rel = (a.v[0] - b.v[0]) * n[0] + (a.v[1] - b.v[1]) * n[1];
				if (rel > 0) {
					a.v = a.v.map((x, j) => x - rel * n[j]); b.v = b.v.map((x, j) => x + rel * n[j]);
					if (!P.hit) { P.hit = true; P.flash = now; }
				}
				const push = (2 * POOL.ball - dl) / 2;
				a.p = a.p.map((x, j) => x - n[j] * push); b.p = b.p.map((x, j) => x + n[j] * push);
			}
			// The cushion: the round edge, losing some of the speed into it.
			for (const o of P.b) {
				const r = Math.hypot(o.p[0], o.p[1]);
				if (r <= lim) continue;
				const n = [o.p[0] / r, o.p[1] / r], vn = o.v[0] * n[0] + o.v[1] * n[1];
				if (vn > 0) {
					const t = [o.v[0] - vn * n[0], o.v[1] - vn * n[1]];
					o.v = [t[0] * POOL.slide - vn * POOL.bank * n[0], t[1] * POOL.slide - vn * POOL.bank * n[1]];
				}
				o.p = [n[0] * lim, n[1] * lim];
			}
		}
		const still = P.b.every((o) => Math.hypot(o.v[0], o.v[1]) < POOL.rest);
		if ((P.hit && still) || e > POOL.max) { for (const o of P.b) o.v = [0, 0]; P.restAt = now; }
	}
	// A point on the table (its own units) on the unit sphere's scale, `up`
	// above it.
	const onTable = (tb, x, y, up) => [0, 1, 2].map((j) => POOL.r * (x * tb.u[j] + y * tb.v[j]) + up * tb.n[j]);
	// Each dot glides on an eased path from where it was when the group began
	// to its place, and is then held to the physics exactly. (Pinning a dot
	// whose spring had not yet arrived pulled it 7.6px in one frame.)
	function poolPlace(c, G, P3) {
		const e = (c.now - G.t0) / 1000, from = c.g.V0, u = ease(cl(e / POOL.set));
		return { aim: u < 1 ? from.map((x, j) => mix(x, P3[j], u)) : P3, free: 1, snap: sm(cl((e - POOL.set + 0.1) / 0.1)), k: 0.6, damp: 0.4 };
	}
	function poolStep(c, G) {
		const P = G.pool, tb = P.tb, e = (c.now - G.t0) / 1000, k = c.i % 2, o = P.b[k];
		const speed = Math.hypot(o.v[0], o.v[1]);
		if (c.i < 2) {
			const flash = 0.8 * Math.exp(-(c.now - P.flash) / 150);
			const r = Object.assign(poolPlace(c, G, onTable(tb, o.p[0], o.p[1], POOL.lift)), { glow: flash, trail: speed > 0.05, tl: 1000 });
			// The pull back: a slight stretch along the shot.
			if (k === 0 && e > POOL.set && !P.hit) {
				const s = Math.sin(PI * cl((e - POOL.set) / POOL.pull)) * 0.12, dir = onTable(tb, P.dir[0], P.dir[1], 0);
				Object.assign(r, { sx: 1 + s, sy: 1 - s * 0.6, srot: Math.atan2(dir[1], dir[0]) });
			}
			return r;
		}
		// The shadow: on the table, off along the light, flattened to its tilt.
		const off = POOL.lift * 1.6 / POOL.r;
		return Object.assign(poolPlace(c, G, onTable(tb, o.p[0] + tb.L[0] * off, o.p[1] + tb.L[1] * off, 0)), {
			vm: 0.4, blur: 0.6, szm: 1.15, sx: 1.2, sy: 1.2 * tb.n[2], srot: Math.atan2(tb.n[1], tb.n[0]) + PI / 2
		});
	}
	// The cushion: a faint dotted ellipse, in as the balls are set and out
	// as they come to rest.
	function poolDraw(g, G, f, p, a, col, time) {
		const P = G.pool, now = time * 1000, tb = P.tb;
		const I = sm(cl((now - G.t0) / 500)) * (P.restAt ? 1 - sm(cl((now - P.restAt) / POOL.hold)) : 1);
		if (I < 0.01) return;
		g.save(); g.strokeStyle = col; g.lineWidth = 0.75; g.setLineDash([1.5, 3]); g.globalAlpha = a * 0.3 * I;
		g.beginPath();
		for (let k = 0; k <= 64; k++) {
			const an = k / 64 * 2 * PI, q = onTable(tb, Math.cos(an), Math.sin(an), 0);
			if (k) g.lineTo(f.cx + f.r * q[0], f.cy + f.r * q[1]); else g.moveTo(f.cx + f.r * q[0], f.cy + f.r * q[1]);
		}
		g.stroke(); g.restore();
	}

	// ─── Merge (UV, 26 Oct) ───
	// Virtual particle pairs. The pairs take turns: a pair pops into being as
	// one glowing dot somewhere on the sphere (with a squash), splits, runs a
	// small loop and recombines with a flash (annihilation), and pops out.
	// About a third are Hawking pops: a faint core glows at the centre, one
	// partner falls in towards it (stretching, dimming) and the other escapes
	// out past the ring with a glowing trail, and both vanish where they are.
	// Between pops a pair is unseen, and moves to its next spot at once. Each
	// spot is well away from the last few. At the end all four pop back in,
	// evenly round the ring, already cruising. Times in s from the start.
	const MERGE = { first: 0.7, gap: 0.9, len: 1.3, last: 6.0, back: 6.1, end: 7.0, loop: 0.25, apart: 1.2 };
	function mergeStart(G) {
		const pops = [], recent = [];
		for (let k = 0; MERGE.first + k * MERGE.gap + MERGE.len <= MERGE.last + 1e-6; k++) {
			const hawk = Math.random() < 1 / 3;
			let C, n = 0;
			// A Hawking pair starts near the ring, so the one escaping is seen to.
			do { C = sph(Math.random() * 2 * PI, hawk ? (Math.random() - 0.5) * 0.8 : -0.35 + Math.random() * 1.2); }
			while (++n < 50 && recent.some((r) => dot3(r, C) > Math.cos(MERGE.apart)));
			recent.push(C);
			if (recent.length > 3) recent.shift();
			const t1 = nrm(cross(C, randAxis()));
			pops.push({ t: MERGE.first + k * MERGE.gap, pair: k % 2, C, hawk, e1: t1, e2: cross(C, t1), side: Math.random() < 0.5 ? 1 : -1 });
		}
		// About a third, and at least one.
		if (!pops.some((q) => q.hawk)) pops[1 + Math.floor(Math.random() * (pops.length - 1))].hawk = true;
		G.pops = pops;
	}
	// A dot's pop now: the latest of its pair's that has begun.
	function popOf(G, i, e) {
		let found = null;
		for (const q of G.pops) if (q.pair === i >> 1 && e >= q.t) found = q;
		return found;
	}
	function mergeStep(c, G) {
		const e = (c.now - G.t0) / 1000, i = c.i, V = c.ring.v[i].V;
		// The end: all four pop in evenly round the ring and cruise on.
		if (e >= MERGE.back) {
			const s = e - MERGE.back, aim = sph(G.th0 + i * PI / 2 + 5 * Math.max(0, s - 0.05), 0);
			if (s < 0.05) return { aim, snap: 1, vm: 0 };
			const q = cl((s - 0.05) / 0.15);
			return { aim, szm: 0.4 + 0.6 * eob(q), sq: -0.5 * Math.sin(PI * q), glow: 0.6 * (1 - q) };
		}
		const pop = popOf(G, i, e);
		// Unseen, where it is: fading out at the start, between pops.
		if (!pop || e - pop.t > MERGE.len) return { aim: V.slice(), free: Math.hypot(V[0], V[1], V[2]) < 0.98 ? 1 : 0, vm: 0 };
		const s = e - pop.t, sg = i % 2 ? 1 : -1;
		// Moved to the spot at once, unseen.
		if (s < 0.05) return { aim: pop.C, snap: 1, vm: 0 };
		// Popping in as one dot.
		if (s < 0.25) { const q = cl((s - 0.05) / 0.15); return { aim: pop.C, szm: 0.4 + 0.6 * eob(q), sq: -0.5 * Math.sin(PI * q), glow: 0.8 }; }
		const q = cl((s - 0.25) / 0.8);
		if (pop.hawk) {
			// Hawking: one falls in to the core, the other escapes past the ring.
			// Both vanish where they are.
			const gone = s > 1.05 ? 0 : 1;
			if (sg < 0) {
				const f = 0.92 * q * q;
				return { aim: pop.C.map((x) => x * (1 - f)), free: 1, vm: gone * (1 - 0.85 * q), sx: 1 + 1.6 * q, sy: 1 - 0.4 * q, srot: null, glow: 0.3, k: 0.5, damp: 0.5 };
			}
			const l = Math.hypot(pop.C[0], pop.C[1]) || 1, f = 0.9 * q * q;
			return { aim: [pop.C[0] * (1 + f / l), pop.C[1] * (1 + f / l), pop.C[2] * (1 - q)], free: 1, vm: gone, glow: 0.6, trail: true, tl: 700, k: 0.5, damp: 0.5 };
		}
		// A small loop each, point for point opposite, back to where they began.
		if (s < 1.05) {
			const u = sm(q), x = sg * pop.side * MERGE.loop * Math.sin(2 * PI * u), y = sg * MERGE.loop * (1 - Math.cos(2 * PI * u));
			return { aim: nrm(pop.C.map((w, j) => w + x * pop.e1[j] + y * pop.e2[j])), glow: 0.35 + 0.3 * u, k: 0.5, damp: 0.5 };
		}
		// Annihilation: a flash and a squash, then gone.
		const fl = cl((s - 1.05) / 0.1);
		return { aim: pop.C, glow: 1, sq: -0.6 * Math.sin(PI * fl), vm: s > 1.15 ? 0 : 1, szm: s > 1.15 ? 0.5 : 1 };
	}
	// The Hawking core: a faint glow at the centre while a pair is torn apart.
	function mergeDraw(g, G, f, p, a, col, time) {
		const e = (time * 1000 - G.t0) / 1000;
		let I = 0;
		for (const q of G.pops) if (q.hawk) I = Math.max(I, Math.sin(PI * cl((e - q.t - 0.1) / 1.0)));
		if (I < 0.01) return;
		g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10 * I; g.globalAlpha = a * 0.5 * I;
		g.beginPath(); g.arc(f.cx, f.cy, 1.2 + 1.3 * I, 0, 2 * PI); g.fill();
		g.restore();
	}

	const GROUP = {
		shadows: {
			weight: 1.2, dur: 4600,
			start(G) {
				const P = tiltedPlane(0.5, 0.8), la = Math.random() * 2 * PI;
				P.Lt = [0, 1, 2].map((j) => P.u[j] * Math.cos(la) + P.v[j] * Math.sin(la));
				G.sh = P;
			},
			// Two dots bounce above the floor; the other two are their shadows,
			// cast flat onto it along the light (off the sphere: free).
			step(c, G) {
				const p = c.p, i = c.i, env = sm(cl(p * 5)) * sm(cl((1 - p) * 5)), S = G.sh;
				if (i < 2) {
					const b = Math.abs(Math.sin(2.5 * PI * p + i * 0.9)), hgt = 0.15 + 0.85 * b, base = sph(G.th0 + i * PI + 2 * PI * p, 0);
					return {
						aim: nrm(base.map((x, j) => x + S.n[j] * hgt * 1.4 * env)),
						sq: b < 0.14 ? -0.55 * (1 - b / 0.14) * sm(cl((env - 0.4) / 0.2)) : 0, glow: 0.25 * env, k: 0.45, damp: 0.55
					};
				}
				const O = c.ring.v[i - 2].V, h = Math.max(0, dot3(nrm(O), S.n));
				const P = O.map((x, j) => x - h * S.n[j] + h * 0.75 * S.Lt[j]), Pn = nrm(P);
				return {
					aim: P.map((x, j) => x * env + Pn[j] * (1 - env)), free: 1, k: 0.45, damp: 0.5,
					vm: 1 - env * (0.55 + 0.25 * h), szm: 1 + env * (0.8 + 2 * h), blur: env * (0.3 + 1.6 * h),
					sx: 1 + env * 0.5 * h, sy: 1 - env * (1 - S.n[2]) * 0.9, srot: Math.atan2(S.n[1], S.n[0]) + PI / 2, h: -0.2 * env, hw: 1
				};
			},
			draw: drawFloor
		},
		stars: {
			weight: 1.1, dur: 4600,
			start(G, ring) {
				const P = tetraFor(ring).map((v) => sph(Math.atan2(v[1], v[0]), Math.max(-0.5, Math.min(0.7, Math.asin(v[2])))));
				G.ball = { P, axis: nrm([0.15, 0.1, 1]), speed: 0.45 };
			},
			frame: spin,
			step(c, G) {
				const env = sm(cl(c.p * 4)) * sm(cl((1 - c.p) * 4)), tw = Math.pow(0.5 + 0.5 * Math.sin(c.t * c.g.tw.w + c.g.tw.ph), 4);
				return { aim: G.ball.P[c.i], k: 0.1, damp: 0.8, vm: 1 - env + env * (0.25 + 0.75 * tw), szm: 1 + env * (-0.2 + 0.7 * tw), glow: env * 0.95 * tw };
			}
		},
		blackhole: {
			weight: 1.1, dur: 3600,
			start(G) { G.bh = tiltedPlane(0.22, 0.47); },
			step(c, G) {
				const p = c.p, i = c.i, g = c.g;
				if (p < 0.8) {
					const q = cl((p - 0.1 - i * 0.06) / 0.58), ph = -1.48 * Math.pow(q, 1.5), om = (2.5 + 12 * q * q) / Math.max(0.15, Math.cos(ph));
					g.bhL += Math.min(om, 26) * c.dt * 0.0167;
					return { aim: sph(g.bhL, ph), vm: 1 - 0.95 * Math.pow(q, 2.4), glow: 0.55 * q, k: 0.6, damp: 0.45, sx: 1 + 1.4 * q, sy: 1 - 0.4 * q, srot: null, trail: q > 0.15 };
				}
				// Swallowed, then bursting out. The streak holds while they are
				// gone and eases back to round as they come out (the prototype's
				// snapped round while they could still be seen).
				if (p < 0.87) return { aim: sph(g.bhL, -1.5), vm: 0, k: 0.8, damp: 0.4, sx: 2.4, sy: 0.6, srot: null };
				const q = (p - 0.87) / 0.13, st = 1 - sm(cl(q * 3));
				return { aim: sph(G.th0 + i * PI / 2 + 0.6 * q, -1.5 * (1 - eob(q))), vm: cl(q * 2.5), glow: 1 - q, k: 0.6, damp: 0.5, trail: true, sx: 1 + 1.4 * st, sy: 1 - 0.4 * st, srot: null };
			},
			draw: drawDisk
		},
		// Two hosts, enlarged, orbit the ring on the sphere; each has a small
		// moon (about half its size) on a tight orbit round it at a tilt of its
		// own, passing in front (bigger) and behind (smaller), off the sphere
		// (UV, 26 Oct). The moons' trails are long enough to draw most of the
		// ring as their hosts go round.
		moons: {
			weight: 1.1, dur: 5200,
			start(G) {
				// Each moon's orbit: its plane's normal tipped towards the viewer
				// (so it turns clockwise) but well off it, so it passes in front of
				// its host and behind.
				G.orb = [0, 1].map(() => {
					const a = Math.random() * 2 * PI, n = nrm([Math.cos(a), Math.sin(a), 0.15 + Math.random() * 0.5]), e1 = nrm(cross(n, [0, 0, 1]));
					return { e1, e2: cross(n, e1), be: Math.random() * 2 * PI };
				});
			},
			step(c, G) {
				const p = c.p, k = c.i % 2, env = sm(cl(p * 4)) * sm(cl((1 - p) * 4));
				const host = sph(G.th0 + k * PI + 2.4 * PI * p, 0.15 * Math.sin(2 * PI * p + k));
				if (c.i < 2) return { aim: host, szm: 1 + 0.7 * env, glow: 0.3 * env, k: 0.45, damp: 0.55 };
				const O = G.orb[k], be = O.be + 8 * PI * p, r = 0.3 * env;
				return {
					aim: host.map((x, j) => x + r * (Math.cos(be) * O.e1[j] + Math.sin(be) * O.e2[j])), free: 1,
					szm: 1 - 0.15 * env, trail: env > 0.3, tl: 2600, k: 0.6, damp: 0.45
				};
			}
		},
		steamroll: {
			weight: 1, dur: 2800,
			// An unseen ball rolls round and flattens each dot in turn. Once it
			// has passed, the dot jiggles back from as flat as it was (the
			// prototype went round again first, which jumped). The ball goes a
			// little over a lap, so the dot it began behind is passed twice:
			// with the ball well before it again, it waits for the next pass
			// (the prototype's sprang from flat to round in one frame there).
			step(c, G) {
				const g = c.g, lon = G.th0 + PI / 4 + c.i * PI / 2, Bp = G.th0 - 0.5 + (2 * PI + 0.9) * c.p;
				const dd = Math.atan2(Math.sin(Bp - lon), Math.cos(Bp - lon));
				let ax = 1, pp = 1, push = 0;
				if (dd < -0.38) g.passT = null;
				if (Math.abs(dd) < 0.38 && dd > -0.05 && !g.passT) g.passT = c.now;
				if (g.passT && dd > -0.05) {
					const tau = (c.now - g.passT) / 1000 - 0.15, e = tau < 0 ? 1 : jig(tau, 3.8, 14);
					ax = 1 - 0.65 * e; pp = 1 + 1.25 * e; push = 0.12 * Math.max(0, e);
				} else if (Math.abs(dd) < 0.38) {
					const f = Math.pow(Math.cos(dd / 0.38 * PI / 2), 2);
					ax = 1 - 0.65 * f; pp = 1 + 1.25 * f; push = 0.12 * f;
				} else if (dd < -0.38 && dd > -0.75) {
					const q = (dd + 0.75) / 0.37;
					ax = 1 + 0.15 * Math.sin(PI * q); pp = 1 - 0.1 * Math.sin(PI * q);
				}
				return { aim: sph(lon + push, 0), sx: ax, sy: pp, srot: lon + PI / 2, k: 0.5, damp: 0.5 };
			}
		},
		ball: {
			weight: 1, dur: 3600,
			// One random axis, tipped towards the viewer so the spin is clockwise.
			start(G, ring) {
				let ax = randAxis();
				if (ax[2] < 0.15) ax = nrm([ax[0], ax[1], Math.abs(ax[2]) + 0.15]);
				G.ball = { P: tetraFor(ring), axis: ax, speed: 2.5 + Math.random() * 6.5 };
			},
			frame: spin,
			step: (c, G) => ({ aim: G.ball.P[c.i], k: 0.55, damp: 0.5 })
		},
		conga: {
			weight: 1, dur: 2000,
			step(c, G) {
				const p = c.p, i = c.i, L = G.th0 + 4 * PI * sm(p);
				return { aim: sph(L - i * 0.32 * sm(cl(p * 4)), 0.18 * Math.sin(3 * L - i * 0.9)), trail: true, k: 0.4, glow: (i === 0 ? 0.7 : 0.2) * Math.sin(PI * p) };
			}
		},
		atom: {
			weight: 1, dur: 2400,
			step(c, G) {
				const i = c.i, inc = 1.05, a = G.th0 + i * PI / 4;
				const A = [Math.sin(inc) * Math.cos(a), Math.sin(inc) * Math.sin(a), Math.cos(inc)], e1 = nrm(cross(A, [0, 0, 1])), e2 = cross(A, e1), ps = i * PI / 2 + 5 * PI * sm(c.p);
				return { aim: [0, 1, 2].map((j) => e1[j] * Math.cos(ps) + e2[j] * Math.sin(ps)), trail: true, glow: 0.7 * Math.sin(PI * c.p) };
			}
		},
		burst: {
			weight: 1, dur: 1800,
			step(c, G) {
				const p = c.p, i = c.i, off = [PI / 2, PI, 3 * PI / 2, 2 * PI][i];
				if (p < 0.35) return { aim: sph(G.th0 + (i - 1.5) * 0.1 * (1 - p / 0.35), 0), k: 0.45 };
				if (p < 0.55) { const q = (p - 0.35) / 0.2; return { aim: sph(G.th0 + (i - 1.5) * 0.03, 0), sq: -0.55 * Math.sin(PI * q), glow: 0.9 * q, k: 0.45 }; }
				const q = (p - 0.55) / 0.45;
				return { aim: sph(G.th0 + (i - 1.5) * 0.03 + off * eob(q), 0.75 * Math.sin(PI * q) * (i % 2 ? 1 : -1)), trail: q < 0.7, glow: 0.9 * (1 - q), k: 0.45 };
			}
		},
		juggle: {
			weight: 1, dur: 2100,
			step(c, G) {
				const b = G.th0 + c.i * PI / 2, q = cl((c.p - 0.12 - c.i * 0.17) / 0.4);
				if (!(q > 0 && q < 1)) return { aim: sph(q >= 1 ? b + PI : b, 0) };
				const ps = q < 0.1 ? -0.1 * Math.sin(PI * q / 0.1) : PI * sm((q - 0.1) / 0.9);
				let sq = 0;
				if (q < 0.1) sq = -0.4 * Math.sin(PI * q / 0.1);
				if (q > 0.88) sq = -0.5 * Math.sin(PI * (q - 0.88) / 0.12);
				return { aim: [Math.cos(b) * Math.cos(ps), Math.sin(b) * Math.cos(ps), Math.sin(ps)], sq, glow: 0.4 * Math.sin(PI * q) };
			}
		},
		wave: {
			weight: 1, dur: 2000,
			// The squash at the bottom of each wave eases in (the prototype's
			// switched on at full strength).
			step(c, G) {
				const p = c.p, i = c.i, s = Math.sin(2 * PI * p * 2.5 - i * PI / 2), h = Math.pow(Math.max(0, s), 2) * Math.sin(PI * p);
				return { aim: sph(G.th0 + i * PI / 2 + 1.5 * PI * p, 0.95 * h), sq: -0.35 * sm(cl((-s - 0.7) / 0.25)), glow: 0.45 * h };
			}
		},
		binary: {
			weight: 1, dur: 2200,
			step(c, G) {
				const p = c.p, s = c.i % 2 ? 1 : -1, ctr = G.th0 + (c.i >> 1) * PI + 2 * PI * sm(p), be = 6 * PI * p, amp = 0.38 * Math.sin(PI * Math.min(1, p * 1.6));
				return { aim: sph(ctr + s * amp * Math.cos(be), s * amp * Math.sin(be)), trail: true, glow: 0.45 * Math.sin(PI * p) };
			}
		},
		collide: {
			weight: 0.9, dur: 1700,
			step(c, G) {
				const p = c.p, m = G.th0 + (c.i >> 1) * PI;
				let x, sq = 0, glow = 0, trail = false;
				if (p < 0.25) x = PI / 3;
				else if (p < 0.5) { const q = (p - 0.25) / 0.25; x = 0.04 + (PI / 3 - 0.04) * (1 - q * q * q); trail = true; glow = 0.3 * q; }
				else if (p < 0.6) { x = 0.04; sq = -0.65 * Math.sin(PI * (p - 0.5) / 0.1); glow = 1; }
				else { const q = (p - 0.6) / 0.4; x = 0.04 + (PI / 3) * eob(q); glow = 1 - q; }
				return { aim: sph(m + (c.i % 2 ? x : -x), 0), sq, glow, trail, k: 0.5, damp: 0.5 };
			}
		},
		polar: {
			weight: 0.9, dur: 2200,
			step: (c, G) => ({ aim: sph(G.th0 + c.i * PI / 2 + 5 * PI * sm(c.p), 1.3 * Math.sin(PI * sm(c.p))), trail: true, glow: 0.85 * Math.sin(PI * c.p) })
		},
		pool: {
			weight: 1, dur: 13000, start: poolStart, frame: poolFrame, step: poolStep, draw: poolDraw
		},
		merge: {
			weight: 1, dur: MERGE.end * 1000, start: mergeStart, step: mergeStep, draw: mergeDraw
		}
	};
	// What a move changes when it says nothing: round, fully seen, no glow.
	// tl: how long its trail is (ms). snap: how far the dot is pinned to its
	// aim (1: exactly there, which moves it at once when it is far away).
	const RESTING = { sq: 0, glow: 0, trail: 0, tl: TRAIL_MS, snap: 0, k: 0.34, damp: 0.6, vm: 1, szm: 1, blur: 0, sx: 1, sy: 1, srot: 0, h: 0, hw: 0, free: 0 };
	const MIXED = ['sq', 'glow', 'trail', 'tl', 'snap', 'k', 'damp', 'vm', 'szm', 'blur', 'sx', 'sy', 'hw', 'free'];
	const round = (o) => Math.abs(o.sx - 1) < 1e-3 && Math.abs(o.sy - 1) < 1e-3;
	// From one aim to another along the sphere, e of the way: the direction
	// turns at an even rate and the distance from the centre (below 1 for a
	// shadow) moves evenly. A straight line put back on the sphere swept
	// through the middle in a frame or two when the aims were far apart.
	function slerp(a, b, e) {
		const la = Math.hypot(a[0], a[1], a[2]) || 1, lb = Math.hypot(b[0], b[1], b[2]) || 1;
		const ua = a.map((x) => x / la), ub = b.map((x) => x / lb), ax = cross(ua, ub), s = Math.hypot(ax[0], ax[1], ax[2]);
		const u = s < 1e-4 ? nrm(ua.map((x, j) => mix(x, ub[j], e))) : rotV(ua, ax.map((x) => x / s), Math.atan2(s, dot3(ua, ub)) * e);
		return u.map((x) => x * mix(la, lb, e));
	}
	// Two moves' wishes, e of the way from a to b.
	function mixMove(a, b, e) {
		if (e <= 0) return a;
		if (e >= 1) return b;
		const o = {};
		for (const key of MIXED) o[key] = mix(+a[key], +b[key], e);
		o.aim = slerp(a.aim, b.aim, e);
		o.srot = round(a) ? b.srot : round(b) ? a.srot : (e < 0.5 ? a.srot : b.srot);
		o.h = b.hw ? b.h : a.h;
		return o;
	}

	// ─── Tokens ───
	// Read on every serve, so the sandbox's sliders take effect at once.
	function tokens() {
		const cs = getComputedStyle(document.documentElement);
		const num = (name, fallback) => {
			const n = parseFloat(cs.getPropertyValue(name));
			return isNaN(n) ? fallback : n;
		};
		const ms = (name, fallback) => {
			const v = cs.getPropertyValue(name).trim(), n = parseFloat(v);
			return isNaN(n) ? fallback : (v.endsWith('ms') ? n : n * 1000);
		};
		return {
			margin: num('--dots-ring-margin', 6),
			fakeStroke: num('--dots-fake-stroke', 1.5),
			fade: num('--dots-fade', 1) || 1,
			draw: num('--dots-draw', 1) || 1,
			blend: Math.max(1, ms('--dots-blend', 600)),
			dim: ms('--dots-dim', 200)
		};
	}
	let T = null;

	// ─── Reduced motion (spec §14) ───
	// The device's setting, unless the page's root says otherwise
	// (data-motion="reduce" or "full": the sandbox's switch). Followed live
	// (motionChanged, below the loop).
	const lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
	function reduced() {
		const m = document.documentElement.dataset.motion;
		return m === 'reduce' ? true : m === 'full' ? false : lessMotion.matches;
	}
	let calm = reduced();

	// ─── Failures (spec §14) ───
	// Never silent: to the console with [Dots] and onto the page as
	// "TDC (Error): …", on the target's own status line if the page gave one
	// (opts.status), else on the dots' own line at the foot of the screen,
	// shown for ERROR_MS. That line is outside the layer, which screen
	// readers skip.
	let errBox = null, errLine = null, errTimer = 0;
	// A target as a person would name it, for the messages.
	function nameOf(el) {
		if (!el || !el.getAttribute) return 'something';
		// Its pieces of text joined with spaces, so "Team 3" and "Wed" do not
		// run together (innerText would, but in the page's capitals too).
		let s = el.getAttribute('aria-label');
		if (!s) {
			const parts = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.data.trim()) parts.push(n.data.trim());
			s = parts.join(' ').replace(/\s+/g, ' ');
		}
		return s ? (s.length > 40 ? s.slice(0, 40) + '…' : s) : el.tagName.toLowerCase();
	}
	function fail(t, message, detail) {
		const where = t && t.opts && t.opts.status;
		if (where) { TDC.error(AREA, message, detail, where); return; }
		if (!errBox) {
			errBox = document.createElement('div');
			errBox.className = 'tdc-dots-error';
			errLine = document.createElement('div');
			errLine.setAttribute('role', 'status');
			errBox.append(errLine);
			document.body.append(errBox);
		}
		TDC.error(AREA, message, detail, errLine);
		errBox.dataset.shown = '';
		clearTimeout(errTimer);
		errTimer = setTimeout(() => { delete errBox.dataset.shown; }, ERROR_MS);
	}

	// ─── Colour ───
	// A computed colour is rgb() or, from color-mix(), color(srgb r g b) in 0..1.
	function rgbOf(c) {
		const n = (c.match(/[\d.]+/g) || []).map(Number);
		if (c.startsWith('color(')) return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1];
		return [n[0] || 0, n[1] || 0, n[2] || 0, n.length > 3 ? n[3] : 1];
	}
	const seen = (c) => c && rgbOf(c)[3] > 0.05 && c !== 'transparent';
	const css = (c) => `rgb(${c.slice(0, 3).map(Math.round).join(',')})`;

	// ─── The layer ───
	// Fixed over the whole screen, never catching a tap: one canvas (trails and
	// a group move's extras), the lines drawn for a trace (an SVG), and the
	// four dots, which move by transform alone.
	let layer = null, canvas = null, ctx = null, linesLayer = null;
	const D = [];
	function build() {
		if (layer) return;
		layer = document.createElement('div');
		layer.className = 'tdc-dots';
		layer.setAttribute('aria-hidden', 'true');
		canvas = document.createElement('canvas');
		ctx = canvas.getContext('2d');
		linesLayer = document.createElementNS(NS, 'svg');
		linesLayer.setAttribute('class', 'tdc-dots-lines');
		layer.append(canvas, linesLayer);
		for (let i = 0; i < 4; i++) {
			const e = document.createElement('span');
			e.className = 'tdc-dot';
			e.style.width = e.style.height = BASE + 'px';
			e.style.margin = (-BASE / 2) + 'px 0 0 ' + (-BASE / 2) + 'px';
			layer.append(e);
			D.push({ e, x: 0, y: 0, h: 0, gs: 1.5, c: [244, 232, 210], glow: 0, sp: 0, rot: 0, prx: null, pry: null, hist: [] });
		}
		document.body.append(layer);
	}

	// ─── Targets ───
	// A ring icon's ring is the SVG's circle.ring, read from the page: its
	// centre, radius and stroke, scaled from the 100 box to the screen.
	// Anything else gets a fake ring from its shorter side plus the margin
	// (UV, 26 Oct): a wide button's height, a tall stepper's width. Its stroke
	// is its border if it has one.
	const records = new Map();
	function ringCircle(el) {
		const face = el.matches('.tdc-ring') ? el : el.querySelector('.tdc-ring');
		return face && face.querySelector('circle.ring');
	}
	// A target that has left the page keeps where it was last seen. A ring
	// icon the page has drawn again (a new SVG in the same target) is
	// measured by its new ring.
	function measure(t) {
		if (!t.el.isConnected) return;
		if (t.circle && !t.circle.isConnected) {
			const c = ringCircle(t.el);
			if (!c) return;
			t.circle = c;
		}
		if (t.circle) {
			const svg = t.circle.ownerSVGElement, box = svg.getBoundingClientRect();
			const k = box.width / (svg.viewBox.baseVal.width || 100);
			t.cx = box.left + t.circle.cx.baseVal.value * k;
			t.cy = box.top + t.circle.cy.baseVal.value * k;
			t.r = t.circle.r.baseVal.value * k;
			t.sw = (parseFloat(getComputedStyle(t.circle).strokeWidth) || 5) * k;
		} else {
			const q = t.el.getBoundingClientRect();
			t.cx = q.left + q.width / 2;
			t.cy = q.top + q.height / 2;
			t.r = Math.min(q.width, q.height) / 2 + T.margin;
		}
	}
	// The colour of the line the dots will be on (UV, 26 Oct): the ring's, or a
	// fake ring's outline, its fill, else its text. Read before the busy state
	// hides the outline.
	function lineColour(t) {
		if (t.circle) return rgbOf(getComputedStyle(t.circle).stroke);
		const cs = getComputedStyle(t.el);
		if (parseFloat(cs.borderTopWidth) > 0 && seen(cs.borderTopColor)) return rgbOf(cs.borderTopColor);
		if (seen(cs.backgroundColor)) return rgbOf(cs.backgroundColor);
		return rgbOf(cs.color);
	}
	function makeRecord(el, opts) {
		const t = { el, opts, at: performance.now(), pending: 0, settled: false, revealed: false, lines: null, circle: ringCircle(el) };
		t.kind = opts.trace || (t.circle ? 'icon' : 'none');
		t.colour = lineColour(t);
		if (!t.circle) t.sw = parseFloat(getComputedStyle(el).borderTopWidth) || T.fakeStroke;
		measure(t);
		return t;
	}
	// How long the target takes to come back: its own transition (spec §3,
	// stage 7), read from the element that fades.
	function revealMs(t) {
		const cs = getComputedStyle(t.circle || t.el);
		const ms = (s) => s.split(',').map((v) => parseFloat(v) * (v.includes('ms') ? 1 : 1000));
		const dur = ms(cs.transitionDuration), del = ms(cs.transitionDelay);
		return Math.max(0, ...dur.map((d, i) => d + (del[i] || 0)));
	}
	// The result goes onto the page, once, the moment the call is back.
	function reveal(t) {
		if (t.revealed) return;
		t.revealed = true;
		try { if (t.opts.reveal) t.opts.reveal(); }
		catch (err) { fail(t, `${nameOf(t.el)} could not show its result.`, err); }
	}
	// Reduced motion: the breathing stops without a jump. Taking the pulse
	// off snaps the part that breathed (its ring, else the element) to where
	// it is going, because a transition does not start from an animation's
	// value (0.49 to 1 in one frame, measured in Chrome). So its opacity is
	// read first (calmFrom) and eased from there (calmTo).
	const calmNode = (t) => (t.circle && t.circle.isConnected ? t.circle : t.el);
	const calmFrom = (t) => ('dotsCalm' in t.el.dataset ? getComputedStyle(calmNode(t)).opacity : null);
	function calmTo(t, from, ms) {
		// One keyframe at the start: it eases on to wherever the CSS has it.
		if (from !== null && ms > 0) calmNode(t).animate([{ opacity: from, offset: 0 }], { duration: ms, easing: 'ease' });
	}
	// Everything the dots put on an element, taken off at once.
	function clearLook(el) {
		delete el.dataset.dots;
		delete el.dataset.dotsTrace;
		delete el.dataset.dotsCalm;
		el.style.removeProperty('--dots-lines');
	}
	// The target comes back. data-dots="revealing" carries its transition
	// back in (dots.css) and is taken off once that has run; lines drawn for
	// its trace fade out in the same time, so they crossfade into it. A call
	// that hung shows nothing new: the target comes back as it was, and its
	// result shows if it is back after all. One that left the page has been
	// cleaned already (gone) and only reveals; so does one the page has
	// served again since, whose new record owns its look.
	function restore(t) {
		if (t.restored) return 0;
		t.restored = true;
		const el = t.el, mine = records.get(el) === t;
		if (mine) records.delete(el);
		if (!t.hung) reveal(t);
		if (t.gone || (!mine && records.has(el))) { if (t.lines) t.lines.remove(); return 0; }
		const from = calmFrom(t);
		delete el.dataset.dotsCalm;
		el.dataset.dots = 'revealing';
		const ms = revealMs(t);
		calmTo(t, from, ms);
		if (t.lines) t.lines.fadeOut(ms);
		setTimeout(() => { if (el.dataset.dots === 'revealing') clearLook(el); }, ms + 50);
		return ms;
	}
	// A target that left the page before its result was shown (spec §14):
	// said so, and its look taken off at once, so the element is right if the
	// page puts it back. Its call still reveals when it is back (restore). One
	// whose result is already shown (racing, fading) has not failed: a page
	// redrawing after a save replaces its elements all the time.
	function gone(t) {
		if (t.gone || t.restored) return;
		t.gone = true;
		fail(t, `${nameOf(t.el)} left the page while ${t.load ? 'it was still loading' : 'the dots were serving it'}.`, t.el);
		if (records.get(t.el) === t) records.delete(t.el);
		if (t.lines) t.lines.remove();
		clearLook(t.el);
		if (t.settled) t.restored = true;   // mid-trace: its result is already in
	}
	function sweep() {
		for (const t of records.values()) if (!t.el.isConnected) gone(t);
	}

	// ─── Lines to trace ───
	// The lines a target's dots trace (spec §9), joined end to end into one
	// path: a point on it by length, the width of the stroke there, and where
	// that is on the screen now (the target is measured every frame). Each
	// line is a list of points [x, y, width] in the lines' own units. A ring
	// icon's lines are its own marks and a number's are the middle of its
	// digits in the site's font: both fade in themselves. A tab's outline is
	// drawn for the trace on the layer's SVG and crossfades into the real
	// thing at the reveal.
	const fadingLines = new Set();
	class Lines {
		constructor(t, polys, colour, place, g) {
			this.t = t; this.colour = colour; this.place = place; this.g = g;
			let at = 0;
			this.segs = polys.filter((pts) => pts.length > 1).map((pts) => {
				const cum = [0];
				for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
				const s = { pts, cum, at, len: cum[cum.length - 1] };
				at += s.len;
				return s;
			});
			this.L = at;
			this.ox = 0; this.oy = 0; this.k = 1;
			this.where();
		}
		where() {
			if (this.t.el.isConnected) Object.assign(this, this.place());
			if (this.g) this.g.setAttribute('transform', `translate(${this.ox} ${this.oy})`);
		}
		// The point s along the joined path (wrapping round), in the lines' own
		// units, and the width of the stroke there.
		at(s) {
			const L = this.L;
			s = ((s % L) + L) % L;
			let j = 0;
			while (j < this.segs.length - 1 && s >= this.segs[j].at + this.segs[j].len) j++;
			const g = this.segs[j], d = Math.min(g.len, s - g.at), c = g.cum;
			let lo = 0, hi = c.length - 1;
			while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
			const a = g.pts[lo], b = g.pts[hi], f = c[hi] > c[lo] ? (d - c[lo]) / (c[hi] - c[lo]) : 0;
			return { x: mix(a[0], b[0], f), y: mix(a[1], b[1], f), sw: mix(a[2], b[2], f) };
		}
		// The lines fading in as a whole while the dots trace (0 to 1).
		show(f) {
			if (this.g) this.g.style.opacity = f;
			else this.t.el.style.setProperty('--dots-lines', f.toFixed(3));
		}
		fadeOut(ms) {
			if (!this.g) return;
			fadingLines.add(this);
			this.g.style.transition = `opacity ${ms}ms ease`;
			this.g.style.opacity = 0;
			setTimeout(() => this.remove(), ms + 50);
		}
		remove() {
			fadingLines.delete(this);
			if (this.g) this.g.remove();
		}
	}
	// A path on the layer, in px from the target's top left.
	function drawn(g, d, sw, colour) {
		const p = document.createElementNS(NS, 'path');
		p.setAttribute('d', d);
		p.setAttribute('stroke', css(colour));
		p.setAttribute('stroke-width', sw);
		g.append(p);
		return p;
	}
	// An SVG path as points every `step` of its own units, all one width.
	// It must be on the page to be measured. The browser takes about 4.5 ms
	// per 100 points, so an icon's are kept (by its path) once worked out.
	const pathPoints = new Map();
	function pointsOf(p, w, step) {
		const key = p.getAttribute('d') + '|' + step;
		let pts = pathPoints.get(key);
		if (!pts) {
			const len = p.getTotalLength(), n = Math.max(2, Math.ceil(len / step));
			pts = [];
			for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(len * i / n); pts.push([q.x, q.y]); }
			if (pathPoints.size > 200) pathPoints.clear();
			pathPoints.set(key, pts);
		}
		return pts.map(([x, y]) => [x, y, w]);
	}
	// A digit's line (DIG: M, L and C only) as points about `step` apart,
	// worked out here rather than by the browser, through `fit` (its box to
	// the screen).
	function digitPoints(d, fit, w, step) {
		const nums = (d.match(/-?[\d.]+/g) || []).map(Number), cmds = d.match(/[MLCZ]/g) || [];
		const out = [];
		let i = 0, x = 0, y = 0, sx = 0, sy = 0;
		const add = (px, py) => { const q = fit(px, py); out.push([q[0], q[1], w]); };
		const along = (f, len) => { const n = Math.max(1, Math.ceil(len / step)); for (let k = 1; k <= n; k++) { const q = f(k / n); add(q[0], q[1]); } };
		for (const c of cmds) {
			if (c === 'M') { x = sx = nums[i++]; y = sy = nums[i++]; add(x, y); }
			else if (c === 'L' || c === 'Z') {
				const nx = c === 'Z' ? sx : nums[i++], ny = c === 'Z' ? sy : nums[i++];
				const a = fit(x, y), b = fit(nx, ny), x0 = x, y0 = y;
				along((u) => [mix(x0, nx, u), mix(y0, ny, u)], Math.hypot(b[0] - a[0], b[1] - a[1]));
				x = nx; y = ny;
			} else {
				const [x1, y1, x2, y2, x3, y3] = nums.slice(i, i + 6), x0 = x, y0 = y;
				i += 6;
				const bez = (u) => {
					const v = 1 - u;
					return [v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3, v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3];
				};
				const p0 = fit(x0, y0), p1 = fit(x1, y1), p2 = fit(x2, y2), p3 = fit(x3, y3);
				along(bez, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]));
				x = x3; y = y3;
			}
		}
		return out;
	}

	// ─── A number's lines (UV, 26 Oct) ───
	// The dots trace the digits in the site's own font, which fades in under
	// them: nothing is drawn in another hand. The single-line digit (DIG) is
	// the way they go, fitted over each real digit's ink and inset by half the
	// font's stroke so it runs down the middle of the strokes; the dots are as
	// thick as that stroke all the way. One thickness per font is near enough
	// (UV): it is measured once, across the middle of a "0" drawn on a hidden
	// canvas, and kept. (Measuring every digit's stroke at every point cost
	// frames of up to 86 ms, for a precision nobody would see.)
	const DIG_STEP = 1.5;   // px between points on a digit's line
	const strokes = new Map();
	let measureCtx = null;
	// A font, as a canvas reads it, from the element's computed style.
	function fontOf(el) {
		const cs = getComputedStyle(el);
		return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
	}
	// How thick the font's strokes are (css px): the first run of ink across
	// the middle of a "0", drawn at twice its size.
	function strokeOf(font, px) {
		if (strokes.has(font)) return strokes.get(font);
		const S = 2, c2 = measureCtx;
		c2.font = font.replace(/[\d.]+px/, px * S + 'px');
		const m = c2.measureText('0');
		const W = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 4;
		const y = Math.round((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
		c2.canvas.width = Math.max(c2.canvas.width, W);
		c2.canvas.height = Math.max(c2.canvas.height, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 4);
		c2.clearRect(0, 0, c2.canvas.width, c2.canvas.height);
		c2.font = font.replace(/[\d.]+px/, px * S + 'px');
		c2.fillStyle = '#000';
		c2.fillText('0', 2 + m.actualBoundingBoxLeft, 2 + m.actualBoundingBoxAscent);
		const row = c2.getImageData(0, 2 + m.actualBoundingBoxAscent - y, W, 1).data;
		let run = 0, best = 0;
		for (let x = 0; x < W; x++) {
			if (row[x * 4 + 3] > 127) run++;
			else { if (run) { best = run; break; } }
		}
		const w = (best || run) / S || px * 0.1;
		strokes.set(font, w);
		return w;
	}
	// The font's stroke, measured when a number is served, so the trace does
	// not wait on it: the first use of a webfont on a canvas cost a frame of
	// 52 ms when it was measured as the call came back.
	function readyDigits(el) {
		if (!measureCtx) {
			measureCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
		}
		return strokeOf(fontOf(el), parseFloat(getComputedStyle(el).fontSize));
	}
	// A number's lines: each digit's single line over its ink, in px from the
	// number's top left, at the font's stroke.
	function digitLines(el) {
		const sw = readyDigits(el), half = sw / 2;
		const font = fontOf(el), box = el.getBoundingClientRect();
		const out = [], range = document.createRange();
		const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		for (let n = walk.nextNode(); n; n = walk.nextNode()) {
			for (let i = 0; i < n.data.length; i++) {
				const ch = n.data[i];
				if (!DIG[ch]) continue;
				range.setStart(n, i); range.setEnd(n, i + 1);
				const r = range.getBoundingClientRect();
				measureCtx.font = font;
				const m = measureCtx.measureText(ch);
				const base = r.top + (r.height - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent;
				const x0 = r.left - m.actualBoundingBoxLeft, x1 = r.left + m.actualBoundingBoxRight;
				const y0 = base - m.actualBoundingBoxAscent, y1 = base + m.actualBoundingBoxDescent;
				// Fitted to the ink both ways, less half the stroke all round, so
				// a condensed font's digits are traced as narrow as they are.
				const g = DIG_BOX[ch];
				const sx = Math.max(0, x1 - x0 - sw) / Math.max(1, g.x1 - g.x0), sy = Math.max(1, y1 - y0 - sw) / (g.y1 - g.y0);
				const gx = x0 + half - box.left - g.x0 * sx, gy = y0 + half - box.top - g.y0 * sy;
				out.push(digitPoints(DIG[ch], (x, y) => [gx + x * sx, gy + y * sy], sw, DIG_STEP));
			}
		}
		return out;
	}
	// A tab's pill, inset by half its stroke, starting at the top middle.
	function pillPath(el, sw) {
		const q = el.getBoundingClientRect(), hw = sw / 2, w = q.width - sw, h = q.height - sw;
		const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, h / 2, w / 2);
		const x = hw, y = hw;
		return `M${x + w / 2} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
			+ ` H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
	}
	// The lines for a target, read once its result is on the page; null when
	// there is nothing to trace.
	function linesFor(t) {
		const el = t.el;
		if (t.kind === 'icon') {
			if (!t.circle) { fail(t, `${nameOf(el)} was to have its icon traced, but it has no ring icon.`, el); return null; }
			const svg = t.circle.ownerSVGElement, marks = [...svg.querySelectorAll('.mark.on')];
			if (!marks.length) { fail(t, `${nameOf(el)}: its icon has no lines to trace.`, el); return null; }
			return new Lines(t, marks.map((m) => pointsOf(m, parseFloat(getComputedStyle(m).strokeWidth) || 10, 3)), rgbOf(getComputedStyle(marks[0]).stroke), () => {
				const box = svg.getBoundingClientRect();
				return { ox: box.left, oy: box.top, k: box.width / (svg.viewBox.baseVal.width || 100) };
			}, null);
		}
		const cs = getComputedStyle(el);
		const place = () => {
			const q = el.getBoundingClientRect();
			return { ox: q.left, oy: q.top, k: 1 };
		};
		if (t.kind === 'number') {
			const polys = digitLines(el);
			if (!polys.length) { fail(t, `${nameOf(el)} was to have its number traced, but it shows no digits.`, el); return null; }
			return new Lines(t, polys, rgbOf(cs.color), place, null);
		}
		if (t.kind === 'tab') {
			// The tab bar's outline width, in the colour the chosen tab fills with.
			const bar = el.parentElement && el.parentElement.closest('.league-nav');
			const sw = parseFloat(getComputedStyle(bar || el).borderTopWidth) || T.fakeStroke;
			const colour = rgbOf(seen(cs.backgroundColor) ? cs.backgroundColor : cs.color);
			const g = document.createElementNS(NS, 'g');
			linesLayer.append(g);
			// Half drawn when it fails, it would stay on the layer for good.
			try { return new Lines(t, [pointsOf(drawn(g, pillPath(el, sw), sw, colour), sw, 3)], colour, place, g); }
			catch (err) { g.remove(); throw err; }
		}
		if (t.kind !== 'none') fail(t, `there is no trace called "${t.kind}" (${nameOf(el)}).`, el);
		return null;
	}
	// The call is back: the result goes onto the page, hidden
	// (data-dots="tracing"), and the dots get its lines. Null, and nothing
	// hidden, when there is nothing to trace.
	function startTrace(t) {
		reveal(t);
		let lines = null;
		try { lines = linesFor(t); }
		catch (err) { fail(t, `${nameOf(t.el)}: its lines could not be read, so they are not traced.`, err); }
		// Read but empty, or not numbers (a path with no length, a font the
		// browser could not measure).
		if (lines && !(lines.L > 0)) {
			fail(t, `${nameOf(t.el)}: its lines could not be read (they have no length), so they are not traced.`, t.el);
			lines.remove();
			lines = null;
		}
		if (!lines) return null;
		t.lines = lines;
		lines.show(0);
		t.el.dataset.dotsTrace = t.kind;
		t.el.dataset.dots = 'tracing';
		return lines;
	}

	// ─── The sphere ───
	// step(now, dt, time) returns one pose per dot: where it is (x, y), its
	// height above the page (h, on the sphere's scale), its size on the line
	// (gs), its colour (c), glow, squash (sq, negative to squash), lit (on a
	// line it is tracing: full brightness, no stretch), its trail's length (ms,
	// 0 for none) and cut (it has just been moved at once: no trail across);
	// and from a move, a squash of its own (sx, sy at srot; null is along its
	// path), how visible it is (vm), its size (szm, times) and blur.
	const pose = (x, y, h, gs, c) => ({ x, y, h, gs, c, glow: 0, sq: 0, lit: 0, trail: 0, cut: false, sx: 1, sy: 1, srot: 0, vm: 1, szm: 1, blur: 0 });
	const mixPose = (a, b, e) => ({
		x: mix(a.x, b.x, e), y: mix(a.y, b.y, e), h: mix(a.h, b.h, e), gs: mix(a.gs, b.gs, e),
		c: mixC(a.c, b.c, e), glow: mix(a.glow, b.glow, e), sq: mix(a.sq, b.sq, e), lit: mix(a.lit, b.lit, e),
		trail: e < 0.5 ? a.trail : b.trail, cut: a.cut || b.cut,
		sx: mix(a.sx, b.sx, e), sy: mix(a.sy, b.sy, e), srot: round(a) ? b.srot : round(b) ? a.srot : (e < 0.5 ? a.srot : b.srot),
		vm: mix(a.vm, b.vm, e), szm: mix(a.szm, b.szm, e), blur: mix(a.blur, b.blur, e)
	});

	// A spring on the sphere: pulled towards P, then put back on the surface,
	// its velocity kept tangent. Overshoot and follow-through come free. A
	// shadow is free of the sphere (free 1): pulled to P and left there.
	function springTo(v, P, dt, k, damp, free = 0) {
		for (let j = 0; j < 3; j++) { v.Vv[j] += (P[j] - v.V[j]) * k * dt; v.Vv[j] *= Math.pow(damp, dt); }
		const nv = v.V.map((x, j) => x + v.Vv[j] * dt), l = Math.hypot(nv[0], nv[1], nv[2]) || 1;
		const l2 = l + (1 - l) * Math.min(1, 0.15 * dt) * (1 - free);
		v.V = nv.map((x) => x / l * l2);
		const u = nrm(v.V), rd = dot3(v.Vv, u) * (1 - free);
		v.Vv = v.Vv.map((x, j) => x - rd * u[j]);
	}

	// A dot's own state on a sphere: where it is (V, a unit vector) and how it
	// moves (Vv), its longitude and latitude (th, ph), its own speed (w), and
	// its solo move (m).
	function newDot(th, now) {
		const v = { V: sph(th, 0), Vv: [0, 0, 0], th, ph: 0, w: 4.6 + Math.random() * 1.2, lag: Math.random() * LAG, cf: 0, sqAt: -1e9, vmS: 1, szS: 1, blS: 0, T: null };
		v.m = moveOf('cruise', v, now, 300 + Math.random() * 700);
		v.m.carry = { ang: 0 };
		return v;
	}
	function moveOf(name, v, now, bd) {
		const s = Math.random() < 0.5 ? 1 : -1;
		return { name, b0: now, bd, th0: v.th, ph0: v.ph, V0: nrm(v.V), sg: s, inc: 0.6 + Math.random() * 0.7, sr: Math.random() * PI, carry: null, done: false };
	}
	// When the first group comes, from the moment the dots begin to wait.
	const firstGroup = (now) => (GROUP[forced] ? now + 500 : SOLO[forced] ? Infinity : now + 1400 + Math.random() * 1500);

	// The sphere a target's dots live on: mode 'orbit' (waiting) or 'race'
	// (the call is back). It holds the dots' own motion (four unit vectors that
	// cruise or race on a unit sphere) and a frame that puts that sphere on the
	// screen: centre, radius, the size of the line and its colour. On a ring
	// the frame is the ring's.
	//
	// It takes over the dots from the sphere they are on (`from`), so their
	// motion carries on unbroken; hidden, they start a quarter-turn apart. A
	// race eases its speed, bob and glow up from the cruise's over `easeMs`.
	//
	// Travelling (UV, 26 Oct): `trip` is where the dots' sphere was (its
	// frame) and how long the trip takes. The dots keep cruising while the
	// frame glides: the centre straight to the new ring, eased in and out; the
	// radius lifting from the old sphere's to LIFT times the new ring's over
	// the first RISE of the trip, holding, and settling onto the ring over the
	// last FALL, with the line's size changing as they settle and its colour
	// over the whole trip. Each dot follows the gliding sphere up to LAG ms
	// behind, so they move as particles and can never be further apart than
	// the sphere is wide. (Sending each dot on its own path to its own place on
	// the new ring, the first way, spread them far apart in mid-flight.)
	//
	// Waiting, the dots perform the moves (step 4): each its own solo moves,
	// and every 2 to 5 s a group move over all four, travelling included (UV,
	// 26 Oct). Nothing jumps between them: a new solo move eases its aim in
	// from where the last was aiming (CARRY), and a group fades in over
	// --dots-blend and out again after its time, held at its end. The race
	// takes over the moves as they are and they fade out as it eases up, a
	// group's extras with them; a trace starting fades a group out at once,
	// never waiting for it to finish (UV).
	class Ring {
		constructor(t, mode, now, from, opts = {}) {
			this.t = t; this.mode = mode; this.r0 = now; this.easeMs = opts.easeMs || 1;
			if (from) {
				// Copied, not shared: the sphere left behind may still be running.
				this.v = from.v.map((v) => structuredClone(v));
				this.G = from.G ? structuredClone(from.G) : null;
				this.nextGroup = from.nextGroup; this.fv = from.fv;
			} else {
				const a0 = Math.random() * 2 * PI;
				this.v = D.map((d, k) => newDot(a0 + k * PI / 2, now));
				this.G = null; this.nextGroup = Infinity; this.fv = forcedV;
			}
			if (mode === 'race') {
				this.nextGroup = Infinity;
				for (const v of this.v) v.rth = Math.atan2(v.V[1], v.V[0]);
			} else if (!this.G && !(this.nextGroup < Infinity)) this.nextGroup = firstGroup(now);
			this.trip = opts.trip ? Object.assign({ vx: 0, vy: 0, vr: 0 }, opts.trip.from, { t0: now, dur: opts.trip.dur }) : null;
			this.f = this.frameAt(this.trip ? 0 : 1);
			// How fast the frame is moving (px a ms), so a trip that turns for
			// another target leaves at the speed this one had.
			this.vel = this.trip ? { vx: this.trip.vx, vy: this.trip.vy, vr: this.trip.vr } : { vx: 0, vy: 0, vr: 0 };
		}
		get travelling() { return !!this.trip; }
		// The sphere's frame at a point in the trip (u from 0 to 1; 1, or no trip,
		// is the ring itself).
		frameAt(u) {
			const t = this.t, p = this.trip;
			if (!p || u >= 1) return { cx: t.cx, cy: t.cy, r: t.r, gs: t.sw, c: t.colour };
			const e = ease(u), rise = ease(cl(u / RISE)), fall = ease(cl((1 - u) / FALL));
			// Leaving mid-trip, the speed it had carries on and dies away
			// (Hermite's u(1-u)²: that speed at the start, nothing at the end),
			// so a turn for another target curves rather than stopping dead.
			const h = u * (1 - u) * (1 - u) * p.dur;
			return {
				cx: mix(p.cx, t.cx, e) + p.vx * h, cy: mix(p.cy, t.cy, e) + p.vy * h,
				r: Math.max(0, mix(t.r, mix(p.r, LIFT * t.r, rise), fall) + p.vr * h),
				gs: mix(p.gs, t.sw, ease(cl((u - (1 - FALL)) / FALL))),
				c: mixC(p.c, t.colour, e)
			};
		}
		// vis: how much of this sphere is being shown (a Blend's share of it, 0
		// under a trace), for a group's extras on the canvas.
		step(now, dt, time, vis = 1) {
			const t = this.t, p = this.trip;
			measure(t);
			const u0 = p ? cl((now - p.t0) / p.dur) : 1, f0 = this.f;
			this.f = this.frameAt(u0);
			const ms = Math.max(1, dt * 16.67), fc = [this.f.cx, this.f.cy, this.f.r];
			this.vel = { vx: (fc[0] - f0.cx) / ms, vy: (fc[1] - f0.cy) / ms, vr: (fc[2] - f0.r) / ms };
			const eR = this.mode === 'race' ? ease(cl((now - this.r0) / this.easeMs)) : 0;
			if (eR < 1) this.schedule(now, dt); else this.G = null;
			const G = this.G, gw = G ? this.groupWeight(now) * (1 - eR) : 0, gp = G ? cl((now - G.t0) / G.dur) : 0;
			let arrived = true;
			const P = this.v.map((v, i) => {
				let o = eR < 1 ? this.solo(v, i, now, dt, time) : RESTING;
				if (gw > 0) o = mixMove(o, Object.assign({}, RESTING, GROUP[G.name].step({ i, p: gp, now, dt, t: time, ring: this, g: G.d[i] }, G)), gw);
				if (this.mode === 'race') {
					// The race: clockwise at ground size, about two laps a second
					// (three times the cruise, slower on a big ring), with a quicker,
					// slighter bob for depth; eased up from the moves.
					v.rth += mix(v.w, v.w * 3 * (19 / Math.max(19, t.r)), eR) * dt * 0.0167;
					o = mixMove(o, Object.assign({}, RESTING, { aim: sph(v.rth, 0.22 * Math.sin(time * 4.2 + i * 1.7)), glow: 0.25, k: 0.5, damp: 0.5 }), eR);
				}
				const aim = o.free > 0 ? o.aim : nrm(o.aim);
				springTo(v, aim, dt, o.k, o.damp, o.free);
				// Pinned (a pool ball following its physics, a merge pair
				// appearing): put on its aim. Moved far at once, its trail is cut.
				let cut = false;
				if (o.snap > 0) {
					const s = o.snap > 0.999 ? 1 : 1 - Math.pow(1 - o.snap, dt);   // the same at any frame rate
					cut = s === 1 && Math.hypot(v.V[0] - aim[0], v.V[1] - aim[1], v.V[2] - aim[2]) > 0.2;
					v.V = v.V.map((x, j) => mix(x, aim[j], s));
					v.Vv = v.Vv.map((x) => x * (1 - s));
				}
				v.T = nrm(o.aim);
				v.vmS += (o.vm - v.vmS) * Math.min(1, 0.3 * dt);
				v.szS += (o.szm - v.szS) * Math.min(1, 0.2 * dt);
				v.blS += (o.blur - v.blS) * Math.min(1, 0.2 * dt);
				// Each dot follows the frame's centre and radius a little behind
				// (its own lag, up to LAG ms, a smoothing rather than a delay, so
				// a trip that turns never jumps a dot to where the frame is now).
				// The lag is the dot's for good: a new one each trip let a dot
				// that had trailed by 17px catch up in one frame at a turn.
				const f = this.f, a = p && v.lag > 0 ? 1 - Math.exp(-ms / v.lag) : 1;
				v.fc = v.fc ? v.fc.map((x, j) => mix(x, fc[j], a)) : fc.slice();
				if (p && (u0 < 1 || Math.hypot(v.fc[0] - fc[0], v.fc[1] - fc[1], v.fc[2] - fc[2]) > 0.05)) arrived = false;
				// Racing, a dot runs on the ring line itself: its bob shows only
				// in its size and brightness. On the sphere, height drew the
				// dots up to 2% inside the ring, so the race looked a little
				// smaller than the ring it was on (UV, 26 Oct).
				let k = 1;
				if (this.mode === 'race') k = mix(1, 1 / (Math.hypot(v.V[0], v.V[1]) || 1), eR);
				const q = pose(v.fc[0] + v.fc[2] * v.V[0] * k, v.fc[1] + v.fc[2] * v.V[1] * k, mix(v.V[2], o.h, o.hw), f.gs, f.c);
				Object.assign(q, { glow: o.glow, sq: o.sq, trail: o.trail > 0.5 ? o.tl : 0, cut, sx: o.sx, sy: o.sy, srot: o.srot, vm: v.vmS, szm: v.szS, blur: v.blS });
				return q;
			});
			if (p && arrived) this.trip = null;
			const draw = G && GROUP[G.name].draw, a = alpha * vis * gw;
			if (draw && a > 0.005) draw(ctx, G, this.f, gp, a, css(this.f.c), time);
			return P;
		}

		// A dot's solo move this frame: what it wishes (see SOLO). A move that
		// has run its time ends and the next is picked.
		solo(v, i, now, dt, time) {
			let m = v.m, p = (now - m.b0) / m.bd;
			// Cut short (the picker changed), a move ends without its landing.
			if (p >= 1 || m.done) { this.endSolo(v, now, m.done); this.pickSolo(v, now); m = v.m; p = 0; }
			const def = SOLO[m.name];
			// Staging (spec §7): while another dot does a big move, this one
			// calms to 70% speed and a smaller bob, easing into and out of it.
			const calm = !forced && this.v.some((o) => o !== v && SOLO[o.m.name].big) ? 1 : 0;
			v.cf += (calm - v.cf) * Math.min(1, 0.05 * dt);
			const c = { i, p, now, t: time, step: dt * 0.0167, w: v.w * (1 - 0.3 * v.cf), bob: mix(0.25, 0.1, v.cf) * Math.sin(time * 1.6 + i * 2.1) };
			const o = Object.assign({}, RESTING, { k: def.k || 0.34, damp: def.damp || 0.6, trail: def.trail ? 1 : 0 }, def.step(v, m, c));
			if (!o.aim) o.aim = sph(o.th, o.ph);
			// The move's first aim is turned to where the last one was aiming,
			// and turned back over CARRY, so the dot never lurches as a move begins.
			if (!m.carry) {
				const a = nrm(o.aim), b = v.T, ax = b ? cross(a, b) : [0, 0, 0], s = Math.hypot(ax[0], ax[1], ax[2]);
				m.carry = s > 1e-4 ? { axis: ax.map((x) => x / s), ang: Math.atan2(s, dot3(a, b)) } : { ang: 0 };
			}
			if (m.carry.ang) {
				const e = ease(cl((now - m.b0) / CARRY));
				if (e < 1) o.aim = rotV(nrm(o.aim), m.carry.axis, m.carry.ang * (1 - e));
			}
			if (now - v.sqAt < LAND) o.sq -= 0.5 * Math.sin(PI * (now - v.sqAt) / LAND);
			return o;
		}
		// The next solo move: forced, or by weight, but never a second big one
		// while another dot is doing one (spec §7). Winding down into the race,
		// only cruise.
		pickSolo(v, now) {
			let name;
			if (this.mode === 'race') name = 'cruise';
			else if (SOLO[forced]) name = forced;
			else {
				name = pick(SOLO);
				if (SOLO[name].big && this.v.some((o) => o !== v && SOLO[o.m.name].big)) name = Math.random() < 0.5 ? 'cruise' : 'weave';
			}
			const [b, j] = SOLO[name].dur;
			v.m = moveOf(name, v, now, b + Math.random() * j);
		}
		// A move ends where the dot actually is, and may land with a squash.
		endSolo(v, now, quietly) {
			if (!quietly && SOLO[v.m.name].land) v.sqAt = now;
			const l = Math.hypot(v.V[0], v.V[1], v.V[2]) || 1;
			v.th = Math.atan2(v.V[1], v.V[0]);
			v.ph = Math.asin(Math.max(-1, Math.min(1, v.V[2] / l)));
		}

		// Groups: started when one is due, faded out after their time, then the
		// next is due 2.2 to 4.7 s later (the prototype's). Forced, a group
		// plays back to back; a forced solo stops them.
		schedule(now, dt) {
			if (this.fv !== forcedV) this.applyForce(now);
			const G = this.G;
			if (G) {
				if (GROUP[G.name].frame) GROUP[G.name].frame(G, this, now, dt);
				if (!G.out && (now - G.t0 > G.dur || G.ended)) this.groupOut(now);
				else if (G.out && now - G.out > T.blend) this.endGroup(now);
			} else if (this.mode === 'orbit' && !this.hushed && now > this.nextGroup) this.startGroup(now);
		}
		startGroup(now) {
			const name = GROUP[forced] ? forced : pick(GROUP), v0 = this.v[0].V;
			this.G = {
				name, t0: now, dur: GROUP[name].dur, out: 0, th0: Math.atan2(v0[1], v0[0]),
				d: this.v.map((v) => ({ V0: v.V.slice(), passT: null, bhL: Math.atan2(v.V[1], v.V[0]), tw: { w: 1.6 + Math.random() * 2.6, ph: Math.random() * 6.3 } }))
			};
			if (GROUP[name].start) GROUP[name].start(this.G, this);
		}
		// The group fades out, and each dot cruises on from where it is.
		groupOut(now) {
			this.G.out = now;
			for (const v of this.v) {
				this.endSolo(v, now, true);
				v.m = moveOf('cruise', v, now, SOLO[forced] ? 1 : 500 + Math.random() * 700);
			}
		}
		endGroup(now) {
			this.G = null;
			this.nextGroup = GROUP[forced] ? now : SOLO[forced] ? Infinity : now + 2200 + Math.random() * 2500;
		}
		groupWeight(now) {
			const G = this.G;
			return ease(cl((now - G.t0) / T.blend)) * (G.out ? 1 - ease(cl((now - G.out) / T.blend)) : 1);
		}
		applyForce(now) {
			this.fv = forcedV;
			if (this.mode !== 'orbit') return;
			if (this.G && !this.G.out && forced !== this.G.name) this.groupOut(now);
			if (GROUP[forced]) { if (!this.G || this.G.out) this.nextGroup = now; }
			else if (SOLO[forced]) { this.nextGroup = Infinity; for (const v of this.v) v.m.done = true; }
			else this.nextGroup = now + 1500;
		}
		// The call is back and a trace begins: a group fades out at once and no
		// other starts (UV, 26 Oct: never wait for one to finish).
		quiet(now) {
			if (this.G && !this.G.out) this.groupOut(now);
			this.hushed = true;
		}
	}

	// The trace (spec §9), an animation beside the sphere: the sphere it was
	// waiting on (`under`) keeps running underneath, unseen, so the race later
	// takes over the same motion. Each dot has a pen on the joined lines: its
	// own start (spread round, with jitter), its own share of the length
	// (45 to 70%) and its own time (±15%), slow in and slow out, all starting
	// the moment the call is back so the dots slide into a trace already
	// moving. On the lines a dot sits on its pen; where they jump it swoops
	// across to the pen, eased in and out and lifting a little (SWOOP), and
	// its size moves to the new stroke's on the way. On the line it is the
	// stroke's width and colour, nearly flat, with a slight wobble so it still
	// reads as a particle, and a soft glow.
	class Trace {
		constructor(t, lines, under, now, dur) {
			this.t = t; this.lines = lines; this.under = under; this.underP = null;
			this.t0 = now;
			const L = lines.L;
			this.pens = D.map((d, i) => ({
				off: i * L / 4 + (Math.random() - 0.5) * L * 0.1,
				span: L * (0.45 + Math.random() * 0.25),
				dur: dur * (0.85 + Math.random() * 0.3),
				q: null, x: 0, y: 0, sw: 0, hop: null
			}));
			// Tracing is complete when the last pen is done; the lines fade in
			// over the same time.
			this.dur = Math.max(...this.pens.map((p) => p.dur));
		}
		endOf(i) { return this.t0 + this.pens[i].dur; }
		step(now, dt, time, vis = 1, underVis = 0) {
			this.underP = this.under.step(now, dt, time, underVis);
			const L = this.lines;
			L.where();
			return this.pens.map((p, i) => {
				const q = L.at(p.off + p.span * sm(cl((now - this.t0) / p.dur)));
				// The pen jumped: swoop from where the dot is.
				if (p.q && Math.hypot(q.x - p.q.x, q.y - p.q.y) * L.k > JUMP) {
					const gap = Math.hypot(q.x - p.x, q.y - p.y) * L.k;
					p.hop = { x: p.x, y: p.y, sw: p.sw, t0: now, dur: Math.min(SWOOP_MAX, SWOOP_MS + gap * SWOOP_PER_PX) };
				}
				p.q = q;
				let lift = 0;
				if (p.hop) {
					const u = cl((now - p.hop.t0) / p.hop.dur), e = ease(u);
					p.x = mix(p.hop.x, q.x, e); p.y = mix(p.hop.y, q.y, e); p.sw = mix(p.hop.sw, q.sw, e);
					lift = SWOOP * Math.sin(PI * u);
					if (u >= 1) p.hop = null;
				} else {
					p.x = q.x; p.y = q.y; p.sw = q.sw;
				}
				const o = pose(L.ox + p.x * L.k, L.oy + p.y * L.k, 0.05 * Math.sin(time * 5 + i * 1.9) + lift, p.sw * L.k, L.colour);
				o.glow = 0.3; o.lit = 1;
				return o;
			});
		}
	}

	// One animation handing the dots to the next (UV, 26 Oct): both run, and
	// each dot's pose (place, height, size, colour) slides from one to the
	// other, eased in and out, from its own start over its own time. A mix
	// lies between the two, so nothing is ever bigger or further apart than
	// either. When the next is a trace over the sphere being left, the
	// trace already runs that sphere, so it is not stepped twice.
	class Blend {
		constructor(from, to, starts, durs) {
			this.from = from; this.to = to; this.starts = starts; this.durs = durs; this.done = false;
		}
		step(now, dt, time, vis = 1) {
			const E = this.starts.map((s, i) => ease(cl((now - s) / this.durs[i]))), e4 = E.reduce((a, e) => a + e, 0) / 4;
			const shared = this.to.under === this.from;
			const B = shared ? this.to.step(now, dt, time, vis * e4, vis * (1 - e4)) : this.to.step(now, dt, time, vis * e4);
			const A = shared ? this.to.underP : this.from.step(now, dt, time, vis * (1 - e4));
			if (this.from instanceof Blend && this.from.done) this.from = this.from.to;
			let done = true;
			const P = B.map((b, i) => {
				const e = E[i];
				if (e < 1) done = false;
				return mixPose(A[i], b, e);
			});
			this.done = done;
			return P;
		}
	}
	// The sphere whose motion an animation carries on.
	const motionOf = (s) => (s instanceof Ring ? s : s instanceof Trace ? s.under : motionOf(s.to));

	// ─── Where things stand ───
	let S = null;           // the animation the dots show
	let phase = 'hidden';   // hidden · travel · orbit · trace · race · fade
	let cur = null;         // the target the dots are serving
	let tr = null;          // the trace, while tracing
	let alpha = 0, aT = 0, fading = false, revealAt = 0, revealHold = 0, fadeAt = 0;
	let forced = null, forcedV = 0;   // the move on repeat (null: random), and a count of changes to it
	let running = false, last = 0;
	let stepAt = 0;         // the frame the dots were last placed in

	// A tap takes the dots at once; something loading with the page joins the
	// queue (track). Both are a record in `records` until they come back.
	const serve = (el, promise, opts = {}) => enlist(el, promise, opts, false);
	const track = (el, promise, opts = {}) => enlist(el, promise, opts, true);
	function enlist(el, promise, opts, load) {
		// Whatever goes wrong here, the result still goes onto the page when
		// the call is back.
		const plain = () => Promise.resolve(promise).then(() => reveal({ el, opts, revealed: false }), () => {});
		if (!el || !el.isConnected) {
			fail({ opts }, `asked to ${load ? 'track' : 'serve'} ${el ? nameOf(el) : 'nothing'}, which is not on the page.`, el);
			plain();
			return promise;
		}
		build();
		T = tokens();
		let t = records.get(el);
		// Served again while it is still being traced: that trace ends now.
		if (t && t.settled) { restore(t); t = null; }
		if (!t) {
			try { t = makeRecord(el, opts); }
			catch (err) {
				fail({ opts }, `${nameOf(el)} could not be measured, so the dots cannot serve it.`, err);
				plain();
				return promise;
			}
			records.set(el, t);
			if (t.kind === 'number') {
				try { readyDigits(el); }
				catch (err) { fail(t, `${nameOf(el)}: the number's font could not be measured.`, err); }
			}
			if (load) {
				// Not marked busy yet: an instant load must show nothing.
				t.load = true;
				setTimeout(check, GRACE);
			} else busyTap(t);
		} else if (!load && t.load) {
			// Tapped while it is loading: it is a tap now, and takes the dots.
			t.load = false;
			busyTap(t);
		}
		// Each call settles once: answered, failed, or hung after its limit
		// (HANG, or opts.timeout). A hung call that is answered after all
		// shows its result then, plainly. A failed one is not traced: no
		// result was saved, and the page reports its own error (UV, 26 Oct),
		// so the dots only log it.
		t.pending++;
		const limit = opts.timeout > 0 ? opts.timeout : HANG;
		let over = false;
		const finish = () => {
			if (--t.pending) return;
			t.settled = true;
			if (!t.el.isConnected) gone(t);
			if (t !== cur) restore(t);   // abandoned: it comes back without the dots
			else wake();
		};
		const timer = setTimeout(() => {
			if (over) return;
			over = true;
			t.hung = true;
			fail(t, `${nameOf(el)}: its call had no answer for ${Math.round(limit / 1000)} s, so it is shown as it was.`, promise);
			finish();
		}, limit);
		Promise.resolve(promise).then(() => {
			if (over) { reveal(t); return; }   // hung, and back after all
			over = true; clearTimeout(timer); finish();
		}, (err) => {
			if (over) return;
			over = true; clearTimeout(timer);
			t.failed = true;
			console.error(`[${AREA}] ${nameOf(el)}: its call failed, so its result is not traced.`, err);
			finish();
		});
		return promise;
	}
	// A tap: busy at once, and the dots go to it; with reduced motion it
	// breathes instead (dots.css).
	function busyTap(t) {
		t.el.dataset.dots = 'busy';
		if (calm) t.el.dataset.dotsCalm = '';
		else if (t !== cur) goTo(t);
	}

	// ─── The page-load queue (spec §12) ───
	// The next thing loading for the dots to go to: the first in the page's
	// order, wherever it is on the page (UV, 26 Oct). With `grace`, only one
	// that has been loading for GRACE ms: so the dots are never fetched for an
	// instant load, nor pulled off a trace or a race by one.
	const late = (t, now) => now - t.at >= GRACE - 1;
	// With reduced motion there is none: the dots never go anywhere. One
	// whose serving broke the dots (recover) is not gone to again.
	function nextPending(now, grace) {
		if (calm) return null;
		sweep();
		let best = null;
		for (const t of records.values()) {
			if (!t.load || t.settled || t.broken || t === cur || (grace && !late(t, now))) continue;
			if (!best || best.el.compareDocumentPosition(t.el) & Node.DOCUMENT_POSITION_PRECEDING) best = t;
		}
		return best;
	}
	// GRACE ms after something is tracked: everything still loading by then
	// dims, and hidden dots come for the first of them. Shown, the loop
	// decides. With reduced motion they only dim, with no pulse: the pulse is
	// for taps (UV, 26 Oct).
	function check() {
		sweep();
		const now = performance.now();
		for (const t of records.values()) {
			if (t.load && !t.settled && late(t, now)) t.el.dataset.dots = 'busy';
		}
		if (phase === 'hidden') {
			const next = nextPending(now, true);
			if (next) goTo(next);
		}
	}

	// Travel: a sphere for the new target takes over the dots, and its frame
	// glides there from where their sphere was (Ring). Hidden, they appear from
	// a point, where they last were if that is on screen, else the middle, and
	// open out from it as they go. Leaving a trace or a hand-over, the trip
	// starts from the sphere that ran on underneath and the dots slide off
	// what they were showing onto it over --dots-blend.
	function goTo(t) {
		// Shown, a new trip starts from the frame the dots were last placed in,
		// so its first frame carries on at the old trip's speed. Started from
		// the clock instead, that frame came out at no progress at all and a
		// dot turning mid-trip stood still for one frame (19.6px, measured).
		const now = running && S ? stepAt : performance.now();
		t.el.dataset.dots = 'busy';   // something loading may not have dimmed yet
		// Left mid-trace: that target comes back as it is, without the dots.
		if (cur && cur !== t && cur.settled && records.get(cur.el) === cur) restore(cur);
		let from, left = null;
		if (phase === 'hidden' || !S) {
			const W = innerWidth, H = innerHeight;
			let x = D[0].x, y = D[0].y;
			if (!(x > 0 && x < W && y > 0 && y < H)) { x = W / 2; y = H / 2; }
			D.forEach((d) => { d.x = x; d.y = y; d.h = 0; d.gs = t.sw; d.hist.length = 0; d.prx = d.pry = null; });
			S = null;
			from = { cx: x, cy: y, r: 0, gs: t.sw, c: t.colour.slice(0, 3) };
		} else {
			// Mid-trace or mid-hand-over, the sphere has run on underneath: the
			// trip leaves from it (its ring's size and colour, not the traced
			// line's, which flew the digits' heavy line off into the lift).
			// Mid-trip, it leaves at the speed it had.
			from = Object.assign({}, motionOf(S).f, motionOf(S).vel);
			if (!(S instanceof Ring)) left = S;
		}
		cur = t; tr = null;
		const dur = Math.max(TRAVEL_MIN, Math.min(TRAVEL_MAX, TRAVEL_BASE + Math.hypot(t.cx - from.cx, t.cy - from.cy) * TRAVEL_PER_PX));
		const next = new Ring(t, 'orbit', now, S && motionOf(S), { trip: { from, dur } });
		S = left ? new Blend(left, next, D.map(() => now), D.map(() => T.blend)) : next;
		aT = 1; fading = false; revealAt = 0;
		phase = 'travel';
		wake();
	}

	// ─── The loop ───
	// One requestAnimationFrame for everything, stopped while the dots are
	// hidden. dt is in 60 fps frames, so every spring runs at the same speed
	// at any frame rate.
	function wake() {
		if (running) return;
		running = true;
		last = performance.now();
		requestAnimationFrame(loop);
	}
	document.addEventListener('visibilitychange', () => { last = performance.now(); });

	// A throw anywhere in a frame stops the dots and puts the page right
	// (recover), rather than leaving the loop dead and every target dimmed.
	function loop(now) {
		let more = false;
		try { more = tick(now); }
		catch (err) { recover(err); return; }
		if (more) requestAnimationFrame(loop);
		else running = false;
	}
	function tick(now) {
		const dt = Math.min(50, now - last) / 16.67;
		last = now;
		const time = now / 1000;

		// The target left the page before its result was shown (mid-flight,
		// waiting or mid-trace): said so (gone), and the dots fade where they
		// are. Once its result is shown, leaving is no failure (a page
		// redrawing after a save): they race and fade where it was.
		if (cur && !cur.el.isConnected && (!cur.restored || cur.gone)) {
			gone(cur);
			cur = null; tr = null;
			phase = 'fade'; fading = true; aT = 0;
		}
		sweep();

		const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
		if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);

		alpha += (aT - alpha) * Math.min(1, (fading ? 0.045 * T.fade : 0.1) * dt);
		for (const l of fadingLines) l.where();

		// The page-load queue. Only the last is traced and raced (UV, 26 Oct):
		// a target whose call is back while something else is loading comes in
		// as the dots fly on to it (goTo restores it), arrived or not. Loading
		// and back before the dots reach it, with nothing else loading, it
		// simply appears and they land anyway, then race. Something that has
		// been loading for GRACE takes them off a trace, a race or a fade.
		if (cur && cur.settled && (phase === 'travel' || phase === 'orbit')) {
			const next = nextPending(now, false);
			if (next) goTo(next);
			else if (cur.load && phase === 'travel') restore(cur);
		} else if (phase === 'trace' || phase === 'race' || phase === 'fade') {
			const next = nextPending(now, true);
			if (next) goTo(next);
		}

		if (phase === 'travel' && S instanceof Ring && !S.travelling) phase = 'orbit';
		if (phase === 'orbit' && cur.settled) {
			// Back before the dots reached it: it is already on the page. A
			// call that failed or hung has nothing to trace: it comes back
			// plainly as they race.
			const lines = cur.restored || cur.failed || cur.hung ? null : startTrace(cur);
			S.quiet(now);
			if (lines) {
				// Diving in: the trace starts now and each dot slides into it.
				const ms = TRACE_MS[cur.kind] + (cur.kind === 'number' ? TRACE_PER_DIGIT * lines.segs.length : 0);
				tr = new Trace(cur, lines, S, now, T.blend + ms / T.draw);
				S = new Blend(S, tr, D.map(() => now + Math.random() * DIVE), D.map(() => T.blend * (0.85 + Math.random() * 0.3)));
				phase = 'trace';
			} else {
				// Nothing to trace: the target comes straight back, and the
				// cruise eases into the race.
				revealAt = now;
				fadeAt = now + Math.max(restore(cur), 750 / T.fade, T.blend);   // 0 if it is already back
				S = new Ring(cur, 'race', now, S, { easeMs: T.blend });
				phase = 'race';
			}
		}
		if (phase === 'trace') {
			cur.lines.show(sm(cl((now - tr.t0) / tr.dur)));
			// Swinging out: as its pen finishes, each dot slides into the race,
			// which takes over the sphere that ran on underneath.
			if (!tr.out && now >= Math.min(...D.map((d, i) => tr.endOf(i)))) {
				tr.out = true;
				S = new Blend(S, new Ring(cur, 'race', now, tr.under, { easeMs: T.blend }), D.map((d, i) => tr.endOf(i)), D.map(() => T.blend));
			}
			// The moment tracing is complete, the real thing comes in.
			if (!revealAt && now >= tr.t0 + tr.dur) { revealAt = now; revealHold = restore(cur); }
			// The dots fade only once the target is fully back and every dot is
			// racing on its ring (UV, 26 Oct), then after RACE_HOLD of race
			// (÷ --dots-fade). Counted from the last dot onto the ring, the race
			// at full size lasted 0.4 s before the dots faded.
			if (revealAt && S instanceof Ring) {
				phase = 'race';
				fadeAt = Math.max(revealAt + revealHold, now) + RACE_HOLD / T.fade;
			}
		}
		if (phase === 'race' && now > fadeAt) { phase = 'fade'; fading = true; aT = 0; }
		if (phase === 'fade' && alpha < 0.03) {
			phase = 'hidden'; cur = null; S = null; tr = null; alpha = 0;
			D.forEach((d) => { d.e.style.opacity = 0; d.hist.length = 0; });
			return false;
		}

		const P = S.step(now, dt, time);
		stepAt = now;
		if (S instanceof Blend && S.done) S = S.to;
		D.forEach((d, i) => draw(d, P[i], dt, now));
		return true;
	}

	// Something in the dots themselves threw (spec §14). Said so; the dots
	// hide, and every target is put right: one whose call is back shows its
	// result now, the rest come back as their calls do. The one being served
	// is not gone to again (it may throw again); the next tap starts afresh.
	function recover(err) {
		const t = cur;
		running = false;
		cur = null; tr = null; S = null; phase = 'hidden'; alpha = 0; aT = 0; fading = false; revealAt = 0;
		try {
			fail(t, `the dots stopped${t ? ' while serving ' + nameOf(t.el) : ''}, so ${t ? 'it is' : 'the page is'} shown without them.`, err);
			if (t) t.broken = true;
			D.forEach((d) => { d.e.style.opacity = 0; d.hist.length = 0; d.prx = d.pry = null; });
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (const l of [...fadingLines]) l.remove();
			linesLayer.replaceChildren();
			for (const r of [...records.values()]) if (r.settled) restore(r);
		} catch (err2) {
			console.error(`[${AREA}] the dots could not put the page right after stopping.`, err2);
		}
	}

	// Reduced motion switched on or off while the page is open (the device's
	// setting, or the sandbox's switch). On: the dots fade where they are (a
	// trace in hand comes in at once) and every tap still out breathes. Off:
	// the breathing stops and the dots come for the latest tap still out,
	// else whatever is still loading.
	function motionChanged() {
		const now = reduced();
		if (now === calm) return;
		calm = now;
		for (const t of records.values()) {
			if (t.load || t.settled) continue;
			if (calm) { t.el.dataset.dotsCalm = ''; continue; }
			const from = calmFrom(t);
			delete t.el.dataset.dotsCalm;
			calmTo(t, from, T ? T.dim : 200);
		}
		if (calm) {
			if (phase !== 'hidden' && phase !== 'fade') {
				if (cur && cur.settled) restore(cur);
				cur = null; tr = null;
				phase = 'fade'; fading = true; aT = 0;
			}
			return;
		}
		if (phase !== 'hidden' && phase !== 'fade') return;
		let next = null;
		for (const t of records.values()) if (!t.load && !t.settled && !t.broken && (!next || t.at > next.at)) next = t;
		next = next || nextPending(performance.now(), true);
		if (next) { T = tokens(); goTo(next); }
	}
	lessMotion.addEventListener('change', motionChanged);
	new MutationObserver(motionChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });

	// One dot onto the screen at its pose: size and brightness from height,
	// stretched along its path when fast, squashed when told, and its trail
	// on the canvas.
	function draw(d, p, dt, now) {
		// Moved at once (it was unseen): no speed, no trail across the gap.
		if (p.cut) { d.hist.length = 0; d.prx = d.pry = null; d.sp = 0; }
		d.x = p.x; d.y = p.y; d.h = p.h; d.gs = p.gs; d.c = p.c;
		const cR = p.c.map(Math.round), colS = `rgb(${cR.join(',')})`;
		d.glow += (p.glow - d.glow) * Math.min(1, 0.18 * dt);
		const size = d.gs * Math.pow(2, 1.5 * d.h) * p.szm, sc = size / BASE;
		const mvx = d.prx === null ? 0 : d.x - d.prx, mvy = d.pry === null ? 0 : d.y - d.pry;
		d.prx = d.x; d.pry = d.y;
		d.sp += (Math.hypot(mvx, mvy) / dt - d.sp) * Math.min(1, 0.3 * dt);
		if (d.sp > 0.4) d.rot = Math.atan2(mvy, mvx);
		let k = Math.min(STRETCH, Math.max(0, (d.sp - 1.6) * 0.13)) * (1 - p.lit) + p.sq;
		k = Math.max(-0.6, Math.min(1.6, k));
		const qx = 1 + k, qy = k >= 0 ? 1 / Math.sqrt(1 + k) : 1 - k * 0.9;
		const op = 0.35 + 0.65 * cl((d.h + 1) / 2) + 0.4 * p.lit;
		const oa = alpha * p.vm * Math.min(1, op + d.glow * 0.3);

		// The trail: the dot's last d.tl ms, a point every TRAIL_EVERY ms. It
		// lengthens at once when a move asks for more and draws in behind the
		// dot (twice as fast) when it asks for less, so it never snaps off.
		const H = d.hist;
		d.tl = p.trail >= (d.tl || 0) ? p.trail : Math.max(p.trail, d.tl - dt * 16.67 * 2);
		if (d.tl > 0 && (!H.length || now - H[H.length - 1].t >= TRAIL_EVERY)) H.push({ x: d.x, y: d.y, s: size, t: now });
		while (H.length && now - H[0].t > d.tl) H.shift();
		if (H.length > 1) {
			// In runs of three points, each one stroke at its newest's fade.
			ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = colS; ctx.shadowColor = colS; ctx.shadowBlur = 8 * d.glow;
			for (let h = 1; h < H.length; h += 3) {
				const end = Math.min(H.length - 1, h + 2), fr = cl(1 - (now - H[end].t) / Math.max(1, d.tl));
				ctx.globalAlpha = oa * fr * 0.55;
				ctx.lineWidth = Math.max(0.4, H[end].s * fr * 0.9);
				ctx.beginPath(); ctx.moveTo(H[h - 1].x, H[h - 1].y);
				for (let k = h; k <= end; k++) ctx.lineTo(H[k].x, H[k].y);
				ctx.stroke();
			}
			ctx.globalAlpha = 1; ctx.shadowBlur = 0;
		}

		const s = d.e.style;
		s.background = colS;
		// The glow, in the dot's own units (before its scale), so it grows from
		// nothing with the glow and stays in proportion to the dot.
		s.boxShadow = d.glow > 0.005
			? `0 0 ${(BASE * GLOW_REACH * d.glow).toFixed(2)}px rgba(${cR.join(',')},${(0.6 * d.glow).toFixed(3)})`
			: 'none';
		// A move's own squash at its own angle, over the stretch along the path
		// (the two are one when the dot is round).
		const sr = p.srot === null ? d.rot : p.srot;
		s.filter = p.blur > 0.05 ? `blur(${(p.blur / Math.max(0.15, sc)).toFixed(2)}px)` : 'none';
		s.transform = `translate(${d.x}px,${d.y}px) rotate(${sr}rad) scale(${sc * p.sx},${sc * p.sy}) rotate(${d.rot - sr}rad) scale(${qx},${qy})`;
		s.opacity = oa;
	}

	return {
		serve,
		track,
		moves: Object.keys(SOLO),
		groups: Object.keys(GROUP),
		// The waiting move (solo or group) to play on repeat, or null for random.
		force(name) {
			if (name !== null && !SOLO[name] && !GROUP[name]) { fail(null, `there is no move called "${name}".`); return; }
			forced = name;
			forcedV++;
		},
		get state() {
			const r = S && motionOf(S), waiting = r && (phase === 'orbit' || phase === 'travel');
			let loading = 0;
			for (const t of records.values()) if (t.load && !t.settled) loading++;
			return {
				phase, busy: records.size, forced, loading, reduced: calm,
				target: cur && phase !== 'fade' ? cur.el : null,
				group: waiting && r.G ? r.G.name : null, groupAt: waiting && r.G ? r.G.t0 : null,
				moves: waiting && !r.G ? r.v.map((v) => v.m.name) : []
			};
		}
	};
})();
