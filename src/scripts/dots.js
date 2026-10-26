// The dots: the site's loading and feedback motion (UV, 26 Oct). Four dots,
// one set for the whole page, that go to whatever is waiting on the network,
// live on an invisible sphere round it until the call is back, then trace its
// lines, race its ring and fade. The spec is docs/design/dots-motion-spec.md;
// how it should feel is docs/design/dots-prototype.html, and the moves are
// ported from it.
//
//   TDCDots.serve(el, promise, { reveal, trace })
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
//   Returns the promise. A target already busy is not served twice: the dots
//   wait for both calls. Serving a new target takes the dots there at once;
//   the old one restores itself, without them, when its own call is back.
//   TDCDots.state  what the dots are doing, for the sandbox's status line
//   TDCDots.moves, TDCDots.force(name | null)  the waiting moves, and one to
//     play on repeat (the sandbox's picker). Cruise alone until step 4
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
// Built so far (spec §16, steps 1 and 2): travel, the cruise move, tracing,
// the ring race and the fade. Still to come: the other moves (4), the
// page-load queue (5), reduced motion (6).
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
	const MOVES = ['cruise'];

	// ─── Maths ───
	const sm = (x) => x * x * (3 - 2 * x);
	const ease = (x) => x * x * x * (x * (6 * x - 15) + 10);   // slow in, slow out
	const cl = (x) => Math.max(0, Math.min(1, x));
	const mix = (a, b, e) => a + (b - a) * e;
	const mixC = (a, b, e) => [mix(a[0], b[0], e), mix(a[1], b[1], e), mix(a[2], b[2], e)];
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
			draw: num('--dots-draw', 1) || 1,
			blend: Math.max(1, ms('--dots-blend', 600))
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
		const t = { el, opts, pending: 0, settled: false, revealed: false, lines: null, circle: ringCircle(el) };
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
		catch (err) { TDC.error(AREA, 'a target could not show its result.', err); }
	}
	// The target comes back. data-dots="revealing" carries its transition
	// back in (dots.css) and is taken off once that has run; lines drawn for
	// its trace fade out in the same time, so they crossfade into it.
	function restore(t) {
		records.delete(t.el);
		reveal(t);
		const el = t.el;
		el.dataset.dots = 'revealing';
		const ms = revealMs(t);
		if (t.lines) t.lines.fadeOut(ms);
		setTimeout(() => {
			if (el.dataset.dots !== 'revealing') return;
			delete el.dataset.dots;
			delete el.dataset.dotsTrace;
			el.style.removeProperty('--dots-lines');
		}, ms + 50);
		return ms;
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
			if (!t.circle) return null;
			const svg = t.circle.ownerSVGElement, marks = [...svg.querySelectorAll('.mark.on')];
			if (!marks.length) return null;
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
			return polys.length ? new Lines(t, polys, rgbOf(cs.color), place, null) : null;
		}
		if (t.kind === 'tab') {
			// The tab bar's outline width, in the colour the chosen tab fills with.
			const bar = el.parentElement && el.parentElement.closest('.league-nav');
			const sw = parseFloat(getComputedStyle(bar || el).borderTopWidth) || T.fakeStroke;
			const colour = rgbOf(seen(cs.backgroundColor) ? cs.backgroundColor : cs.color);
			const g = document.createElementNS(NS, 'g');
			linesLayer.append(g);
			return new Lines(t, [pointsOf(drawn(g, pillPath(el, sw), sw, colour), sw, 3)], colour, place, g);
		}
		if (t.kind !== 'none') TDC.error(AREA, `there is no trace called "${t.kind}".`, el);
		return null;
	}
	// The call is back: the result goes onto the page, hidden
	// (data-dots="tracing"), and the dots get its lines. Null, and nothing
	// hidden, when there is nothing to trace.
	function startTrace(t) {
		reveal(t);
		let lines = null;
		try { lines = linesFor(t); }
		catch (err) { TDC.error(AREA, 'the lines to trace could not be read.', err); }
		if (lines && !(lines.L > 0)) { lines.remove(); lines = null; }
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
	// line it is tracing: full brightness, no stretch) and whether it trails.
	const pose = (x, y, h, gs, c) => ({ x, y, h, gs, c, glow: 0, sq: 0, lit: 0, trail: false });
	const mixPose = (a, b, e) => ({
		x: mix(a.x, b.x, e), y: mix(a.y, b.y, e), h: mix(a.h, b.h, e), gs: mix(a.gs, b.gs, e),
		c: mixC(a.c, b.c, e), glow: mix(a.glow, b.glow, e), sq: mix(a.sq, b.sq, e), lit: mix(a.lit, b.lit, e),
		trail: e < 0.5 ? a.trail : b.trail
	});

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
			if (!p || u >= 1) return { cx: t.cx, cy: t.cy, r: t.r, gs: t.sw, c: t.colour };
			const e = ease(u), rise = ease(cl(u / RISE)), fall = ease(cl((1 - u) / FALL));
			return {
				cx: mix(p.cx, t.cx, e), cy: mix(p.cy, t.cy, e),
				r: mix(t.r, mix(p.r, LIFT * t.r, rise), fall),
				gs: mix(p.gs, t.sw, ease(cl((u - (1 - FALL)) / FALL))),
				c: mixC(p.c, t.colour, e)
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
				// Racing, a dot runs on the ring line itself: its bob shows only
				// in its size and brightness. On the sphere, height drew the
				// dots up to 2% inside the ring, so the race looked a little
				// smaller than the ring it was on (UV, 26 Oct).
				let k = 1;
				if (this.mode === 'race') k = mix(1, 1 / (Math.hypot(v.V[0], v.V[1]) || 1), ease(cl((now - this.r0) / this.easeMs)));
				const q = pose(f.cx + f.r * v.V[0] * k, f.cy + f.r * v.V[1] * k, v.V[2], f.gs, f.c);
				q.glow = glow;
				return q;
			});
			if (p && arrived) this.trip = null;
			return P;
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
		step(now, dt, time) {
			this.underP = this.under.step(now, dt, time);
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
		step(now, dt, time) {
			const B = this.to.step(now, dt, time);
			const A = this.to.under === this.from ? this.to.underP : this.from.step(now, dt, time);
			if (this.from instanceof Blend && this.from.done) this.from = this.from.to;
			let done = true;
			const P = B.map((b, i) => {
				const e = ease(cl((now - this.starts[i]) / this.durs[i]));
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
	let forced = null;
	let running = false, last = 0;

	function serve(el, promise, opts = {}) {
		if (!el || !el.isConnected) {
			TDC.error(AREA, 'asked to serve an element that is not on the page.', el);
			return promise;
		}
		build();
		T = tokens();
		let t = records.get(el);
		// Served again while it is still being traced: that trace ends now.
		if (t && t.settled) { restore(t); t = null; }
		if (!t) {
			t = makeRecord(el, opts);
			records.set(el, t);
			el.dataset.dots = 'busy';
			if (t.kind === 'number') {
				try { readyDigits(el); }
				catch (err) { TDC.error(AREA, 'the number\'s font could not be measured.', err); }
			}
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
	// open out from it as they go. Leaving a trace or a hand-over, the trip
	// starts from the sphere that ran on underneath and the dots slide off
	// what they were showing onto it over --dots-blend.
	function goTo(t) {
		const now = performance.now();
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
			from = motionOf(S).f;
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

	function loop(now) {
		const dt = Math.min(50, now - last) / 16.67;
		last = now;
		const time = now / 1000;

		// The target left the page mid-flight: say so, and fade where we are.
		if (cur && !cur.el.isConnected) {
			TDC.error(AREA, 'the element the dots were serving left the page.', cur.el);
			records.delete(cur.el);
			if (cur.lines) cur.lines.remove();
			cur = null; tr = null;
			phase = 'fade'; fading = true; aT = 0;
		}

		const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
		if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);

		alpha += (aT - alpha) * Math.min(1, (fading ? 0.045 * T.fade : 0.1) * dt);
		for (const l of fadingLines) l.where();

		if (phase === 'travel' && S instanceof Ring && !S.travelling) phase = 'orbit';
		if (phase === 'orbit' && cur.settled) {
			const lines = startTrace(cur);
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
				fadeAt = now + Math.max(restore(cur), 750 / T.fade, T.blend);
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
			running = false;
			return;
		}

		const P = S.step(now, dt, time);
		if (S instanceof Blend && S.done) S = S.to;
		D.forEach((d, i) => draw(d, P[i], dt));
		requestAnimationFrame(loop);
	}

	// One dot onto the screen at its pose: size and brightness from height,
	// stretched along its path when fast, squashed when told, and its trail
	// on the canvas.
	function draw(d, p, dt) {
		d.x = p.x; d.y = p.y; d.h = p.h; d.gs = p.gs; d.c = p.c;
		const cR = p.c.map(Math.round), colS = `rgb(${cR.join(',')})`;
		d.glow += (p.glow - d.glow) * Math.min(1, 0.18 * dt);
		const size = d.gs * Math.pow(2, 1.5 * d.h), sc = size / BASE;
		const mvx = d.prx === null ? 0 : d.x - d.prx, mvy = d.pry === null ? 0 : d.y - d.pry;
		d.prx = d.x; d.pry = d.y;
		d.sp += (Math.hypot(mvx, mvy) / dt - d.sp) * Math.min(1, 0.3 * dt);
		if (d.sp > 0.4) d.rot = Math.atan2(mvy, mvx);
		let k = Math.min(STRETCH, Math.max(0, (d.sp - 1.6) * 0.13)) * (1 - p.lit) + p.sq;
		k = Math.max(-0.6, Math.min(1.6, k));
		const qx = 1 + k, qy = k >= 0 ? 1 / Math.sqrt(1 + k) : 1 - k * 0.9;
		const op = 0.35 + 0.65 * cl((d.h + 1) / 2) + 0.4 * p.lit;
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
		moves: MOVES.slice(),
		// The waiting move to play on repeat, or null for random. Cruise is the
		// only one until step 4 brings the registry.
		force(name) {
			if (name !== null && !MOVES.includes(name)) { TDC.error(AREA, `there is no move called "${name}".`); return; }
			forced = name;
		},
		get state() {
			const m = forced || 'cruise';
			return { phase, moves: phase === 'orbit' ? [m, m, m, m] : [], busy: records.size, forced };
		}
	};
})();
