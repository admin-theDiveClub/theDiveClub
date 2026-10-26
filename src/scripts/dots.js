// The dots: the site's loading and feedback motion (UV, 26 Oct). Four dots,
// one set for the whole page, that go to whatever is waiting on the network,
// live on an invisible sphere round it until the call is back, then race its
// ring and fade. The spec is docs/design/dots-motion-spec.md; how it should
// feel is docs/design/dots-prototype.html, and the moves are ported from it.
//
//   TDCDots.serve(el, promise, { reveal })
//     el       the target. A ring icon (anything holding a .tdc-ring) uses its
//              real ring; anything else gets a fake ring from its shorter side
//     promise  the call; when it settles, the target is revealed
//     reveal   called as the target comes back, to show the result (a new
//              number, a switch flipped)
//   Returns the promise. A target already busy is not served twice: the dots
//   wait for both calls. Serving a new target takes the dots there at once;
//   the old one restores itself, without them, when its own call is back.
//   TDCDots.state  what the dots are doing, for the sandbox's status line
//
// The animation runs; the dots show it (UV, 26 Oct). The dots' motion lives
// on a sphere and never stops: travelling, they keep cruising and the sphere
// moves to the next ring, lifting to 1.5 times its size on the way and
// settling onto it. A change of animation on the same sphere (the cruise into
// the race) eases one into the other over --dots-blend.
//
// The sphere (spec §4): each dot on a ring is a unit vector on a sphere whose
// equator is the ring. x and y are its place on the screen, z its height
// above the page: higher is bigger and brighter. Size on the ring line is the
// stroke width of the line the dots are on.
//
// Built so far (spec §16, step 1): travel, the cruise move, the ring race and
// the fade. Still to come: tracing (2), the other moves (4), the page-load
// queue (5), reduced motion (6).
//
// Needs: tdc.js (TDC.error). Its look is stylesheets/dots.css; its sizes and
// times are tokens in variables.css (--dots-*).

const TDCDots = (() => {
	const AREA = 'Dots';
	const PI = Math.PI;
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

	// ─── Maths ───
	const sm = (x) => x * x * (3 - 2 * x);
	const ease = (x) => x * x * x * (x * (6 * x - 15) + 10);   // slow in, slow out
	const cl = (x) => Math.max(0, Math.min(1, x));
	const mix = (a, b, e) => a + (b - a) * e;
	const sph = (th, ph) => [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
	const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l); };

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
			blend: ms('--dots-blend', 600)
		};
	}
	let T = null;

	// ─── Colour ───
	// A computed colour is rgb() or, from color-mix(), color(srgb r g b) in 0..1.
	function rgbOf(c) {
		const n = (c.match(/[\d.]+/g) || []).map(Number);
		if (c.startsWith('color(')) return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1];
		return [n[0] || 0, n[1] || 0, n[2] || 0, n.length > 3 ? n[3] : 1];
	}
	const seen = (c) => c && rgbOf(c)[3] > 0.05 && c !== 'transparent';

	// ─── The layer ───
	// Fixed over the whole screen, never catching a tap: one canvas (trails and
	// a group move's extras) and the four dots, which move by transform alone.
	let layer = null, canvas = null, ctx = null;
	const D = [];
	function build() {
		if (layer) return;
		layer = document.createElement('div');
		layer.className = 'tdc-dots';
		layer.setAttribute('aria-hidden', 'true');
		canvas = document.createElement('canvas');
		ctx = canvas.getContext('2d');
		layer.append(canvas);
		for (let i = 0; i < 4; i++) {
			const e = document.createElement('span');
			e.className = 'tdc-dot';
			e.style.width = e.style.height = BASE + 'px';
			e.style.margin = (-BASE / 2) + 'px 0 0 ' + (-BASE / 2) + 'px';
			layer.append(e);
			D.push({ e, x: 0, y: 0, h: 0, gs: 1.5, glow: 0, sp: 0, rot: 0, prx: null, pry: null, hist: [] });
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
	// A target that has left the page keeps where it was last seen.
	function measure(t) {
		if (!t.el.isConnected) return;
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
		const t = { el, opts, pending: 0, settled: false, circle: ringCircle(el) };
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
	// The target comes back. data-dots="revealing" carries its transition
	// back in (dots.css) and is taken off once that has run.
	function restore(t) {
		records.delete(t.el);
		t.el.dataset.dots = 'revealing';
		try { if (t.opts.reveal) t.opts.reveal(); }
		catch (err) { TDC.error(AREA, 'a target could not show its result.', err); }
		const ms = revealMs(t);
		setTimeout(() => { if (t.el.dataset.dots === 'revealing') delete t.el.dataset.dots; }, ms + 50);
		return ms;
	}

	// ─── The sphere ───
	// step(now, dt, time) returns one pose per dot: where it is (x, y), its
	// height above the page (h, on the sphere's scale), its size on the line
	// (gs), glow, squash (sq, negative to squash) and whether it trails.
	const pose = (x, y, h, gs) => ({ x, y, h, gs, glow: 0, sq: 0, trail: false });

	// A spring on the sphere: pulled towards P, then put back on the surface,
	// its velocity kept tangent. Overshoot and follow-through come free.
	function springTo(v, P, dt, k, damp) {
		for (let j = 0; j < 3; j++) { v.Vv[j] += (P[j] - v.V[j]) * k * dt; v.Vv[j] *= Math.pow(damp, dt); }
		const nv = v.V.map((x, j) => x + v.Vv[j] * dt), l = Math.hypot(nv[0], nv[1], nv[2]) || 1;
		const l2 = l + (1 - l) * Math.min(1, 0.15 * dt);
		v.V = nv.map((x) => x / l * l2);
		const u = nrm(v.V), rd = dot3(v.Vv, u);
		v.Vv = v.Vv.map((x, j) => x - rd * u[j]);
	}

	// The sphere a target's dots live on: mode 'orbit' (waiting) or 'race'
	// (the call is back). It holds the dots' own motion (four unit vectors that
	// cruise or race on a unit sphere) and a frame that puts that sphere on the
	// screen: centre, radius, and the size of the line. On a ring the frame is
	// the ring's.
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
	// last FALL, with the line's size changing as they settle. Each dot follows
	// the gliding sphere up to LAG ms behind, so they move as particles and
	// can never be further apart than the sphere is wide. (Sending each dot on
	// its own path to its own place on the new ring, the first way, spread
	// them far apart in mid-flight.)
	class Ring {
		constructor(t, mode, now, from, opts = {}) {
			this.t = t; this.mode = mode; this.r0 = now; this.easeMs = opts.easeMs || 1;
			if (from) {
				this.v = from.v.map((v) => ({ V: v.V.slice(), Vv: v.Vv.slice(), th: v.th, w: v.w }));
			} else {
				const a0 = Math.random() * 2 * PI;
				this.v = D.map((d, k) => ({ V: sph(a0 + k * PI / 2, 0), Vv: [0, 0, 0], th: a0 + k * PI / 2, w: 4.6 + Math.random() * 1.2 }));
			}
			this.trip = opts.trip ? Object.assign({}, opts.trip.from, { t0: now, dur: opts.trip.dur, lag: D.map(() => Math.random() * LAG) }) : null;
			this.f = this.frameAt(this.trip ? 0 : 1);
		}
		get travelling() { return !!this.trip; }
		// The sphere's frame at a point in the trip (u from 0 to 1; 1, or no trip,
		// is the ring itself).
		frameAt(u) {
			const t = this.t, p = this.trip;
			if (!p || u >= 1) return { cx: t.cx, cy: t.cy, r: t.r, gs: t.sw };
			const e = ease(u), rise = ease(cl(u / RISE)), fall = ease(cl((1 - u) / FALL));
			return {
				cx: mix(p.cx, t.cx, e), cy: mix(p.cy, t.cy, e),
				r: mix(t.r, mix(p.r, LIFT * t.r, rise), fall),
				gs: mix(p.gs, t.sw, ease(cl((u - (1 - FALL)) / FALL)))
			};
		}
		step(now, dt, time) {
			const t = this.t, p = this.trip;
			measure(t);
			const uOf = (lag) => (p ? cl((now - p.t0 - lag) / p.dur) : 1);
			this.f = this.frameAt(uOf(0));
			let arrived = true;
			const P = this.v.map((v, i) => {
				let glow = 0;
				const cruiseBob = 0.25 * Math.sin(time * 1.6 + i * 2.1);
				if (this.mode === 'orbit') {
					// Cruise, the one waiting move so far: clockwise round the ring
					// with a gentle bob. The registry (step 4) replaces this.
					v.th += v.w * dt * 0.0167;
					springTo(v, sph(v.th, cruiseBob), dt, 0.34, 0.6);
				} else {
					// The race: clockwise at ground size, about two laps a second
					// (three times the cruise, slower on a big ring), with a quicker,
					// slighter bob for depth; eased up from the cruise.
					const e = ease(cl((now - this.r0) / this.easeMs));
					v.th += mix(v.w, v.w * 3 * (19 / Math.max(19, t.r)), e) * dt * 0.0167;
					springTo(v, sph(v.th, mix(cruiseBob, 0.22 * Math.sin(time * 4.2 + i * 1.7), e)), dt, mix(0.34, 0.5, e), mix(0.6, 0.5, e));
					glow = 0.25 * e;
				}
				const u = uOf(p ? p.lag[i] : 0), f = this.frameAt(u);
				if (u < 1) arrived = false;
				const q = pose(f.cx + f.r * v.V[0], f.cy + f.r * v.V[1], v.V[2], f.gs);
				q.glow = glow;
				return q;
			});
			if (p && arrived) this.trip = null;
			return P;
		}
	}

	// ─── Where things stand ───
	let S = null;           // the current state
	let phase = 'hidden';   // hidden · travel · orbit · race · fade
	let cur = null;         // the target the dots are serving
	let alpha = 0, aT = 0, fading = false, revealAt = 0, holdMs = 0;
	let col = [244, 232, 210], tcol = col.slice();
	let running = false, last = 0;

	function serve(el, promise, opts = {}) {
		if (!el || !el.isConnected) {
			TDC.error(AREA, 'asked to serve an element that is not on the page.', el);
			return promise;
		}
		build();
		T = tokens();
		let t = records.get(el);
		if (!t) {
			t = makeRecord(el, opts);
			records.set(el, t);
			el.dataset.dots = 'busy';
			goTo(t);
		}
		t.pending++;
		const done = () => {
			if (--t.pending) return;
			t.settled = true;
			if (t !== cur) restore(t);   // abandoned: it comes back without the dots
			else wake();
		};
		Promise.resolve(promise).then(done, done);
		return promise;
	}

	// Travel: a sphere for the new target takes over the dots, and its frame
	// glides there from where their sphere was (Ring). Hidden, they appear from
	// a point, where they last were if that is on screen, else the middle, and
	// open out from it as they go.
	function goTo(t) {
		const now = performance.now();
		let from;
		if (phase === 'hidden' || !S) {
			const W = innerWidth, H = innerHeight;
			let x = D[0].x, y = D[0].y;
			if (!(x > 0 && x < W && y > 0 && y < H)) { x = W / 2; y = H / 2; }
			D.forEach((d) => { d.x = x; d.y = y; d.h = 0; d.gs = t.sw; d.hist.length = 0; d.prx = d.pry = null; });
			col = t.colour.slice(0, 3);
			S = null;
			from = { cx: x, cy: y, r: 0, gs: t.sw };
		} else {
			from = S.f;
		}
		cur = t;
		const dur = Math.max(TRAVEL_MIN, Math.min(TRAVEL_MAX, TRAVEL_BASE + Math.hypot(t.cx - from.cx, t.cy - from.cy) * TRAVEL_PER_PX));
		S = new Ring(t, 'orbit', now, S, { trip: { from, dur } });
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

	function loop(now) {
		const dt = Math.min(50, now - last) / 16.67;
		last = now;
		const time = now / 1000;

		// The target left the page mid-flight: say so, and fade where we are.
		if (cur && !cur.el.isConnected) {
			TDC.error(AREA, 'the element the dots were serving left the page.', cur.el);
			records.delete(cur.el);
			cur = null;
			phase = 'fade'; fading = true; aT = 0;
		}
		if (cur) tcol = cur.colour;

		const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
		if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);

		alpha += (aT - alpha) * Math.min(1, (fading ? 0.045 * T.fade : 0.1) * dt);
		for (let c = 0; c < 3; c++) col[c] += (tcol[c] - col[c]) * Math.min(1, 0.05 * dt);
		const cR = col.map(Math.round), colS = `rgb(${cR.join(',')})`;

		if (phase === 'travel' && !S.travelling) phase = 'orbit';
		if (phase === 'orbit' && cur.settled) {
			// Step 2 traces here. For now the target comes straight back, and
			// the cruise eases into the race.
			revealAt = now;
			holdMs = Math.max(restore(cur), 750 / T.fade, T.blend);
			S = new Ring(cur, 'race', now, S, { easeMs: T.blend });
			phase = 'race';
		}
		if (phase === 'race' && now - revealAt > holdMs) { phase = 'fade'; fading = true; aT = 0; }
		if (phase === 'fade' && alpha < 0.03) {
			phase = 'hidden'; cur = null; S = null; alpha = 0;
			D.forEach((d) => { d.e.style.opacity = 0; d.hist.length = 0; });
			running = false;
			return;
		}

		const P = S.step(now, dt, time);
		D.forEach((d, i) => draw(d, P[i], dt, cR, colS));
		requestAnimationFrame(loop);
	}

	// One dot onto the screen at its pose: size and brightness from height,
	// stretched along its path when fast, squashed when told, and its trail
	// on the canvas.
	function draw(d, p, dt, cR, colS) {
		d.x = p.x; d.y = p.y; d.h = p.h; d.gs = p.gs;
		d.glow += (p.glow - d.glow) * Math.min(1, 0.18 * dt);
		const size = d.gs * Math.pow(2, 1.5 * d.h), sc = size / BASE;
		const mvx = d.prx === null ? 0 : d.x - d.prx, mvy = d.pry === null ? 0 : d.y - d.pry;
		d.prx = d.x; d.pry = d.y;
		d.sp += (Math.hypot(mvx, mvy) / dt - d.sp) * Math.min(1, 0.3 * dt);
		if (d.sp > 0.4) d.rot = Math.atan2(mvy, mvx);
		let k = Math.min(STRETCH, Math.max(0, (d.sp - 1.6) * 0.13)) + p.sq;
		k = Math.max(-0.6, Math.min(1.6, k));
		const qx = 1 + k, qy = k >= 0 ? 1 / Math.sqrt(1 + k) : 1 - k * 0.9;
		const op = 0.35 + 0.65 * cl((d.h + 1) / 2);
		const oa = alpha * Math.min(1, op + d.glow * 0.3);

		if (p.trail) d.hist.push({ x: d.x, y: d.y, s: size });
		const keep = p.trail ? 16 : 0;
		if (d.hist.length > keep) d.hist.splice(0, p.trail ? d.hist.length - keep : Math.max(1, Math.ceil(d.hist.length / 6)));
		if (d.hist.length > 1) {
			ctx.lineCap = 'round'; ctx.strokeStyle = colS; ctx.shadowColor = colS; ctx.shadowBlur = 8 * d.glow;
			for (let h = 1; h < d.hist.length; h++) {
				const fr = h / d.hist.length, a0 = d.hist[h - 1], a1 = d.hist[h];
				ctx.globalAlpha = oa * fr * 0.55;
				ctx.lineWidth = Math.max(0.4, a1.s * fr * 0.9);
				ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
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
		s.transform = `translate(${d.x}px,${d.y}px) rotate(${d.rot}rad) scale(${sc * qx},${sc * qy})`;
		s.opacity = oa;
	}

	return {
		serve,
		get state() {
			return { phase, moves: phase === 'orbit' ? ['cruise', 'cruise', 'cruise', 'cruise'] : [], busy: records.size };
		}
	};
})();
