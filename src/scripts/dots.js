// The dots: the site's loading and feedback motion (UV, 26 Oct). Four dots,
// one set for the whole page, that go to whatever is waiting on the network,
// live on an invisible sphere round it until the call is back, then race its
// ring and fade. The spec is docs/design/dots-motion-spec.md; how it should
// feel is docs/design/dots-prototype.html, and this is ported from it.
//
//   TDCDots.serve(el, promise, { reveal })
//     el       the target. A ring icon (anything holding a .tdc-ring) uses its
//              real ring; anything else gets a fake ring round its box
//     promise  the call; when it settles, the target is revealed
//     reveal   called as the target comes back, to show the result (a new
//              number, a switch flipped)
//   Returns the promise. A target already busy is not served twice: the dots
//   wait for both calls. Serving a new target takes the dots there at once;
//   the old one restores itself, without them, when its own call is back.
//   TDCDots.state  what the dots are doing, for the sandbox's status line
//
// The sphere (spec §4): each dot is a unit vector on a sphere whose equator
// is the ring. x and y are its place on the screen, z its height above the
// page: higher is bigger and brighter. Size on the ring line is the stroke
// width of the line the dots are on.
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

	// ─── Maths ───
	const sm = (x) => x * x * (3 - 2 * x);
	const cl = (x) => Math.max(0, Math.min(1, x));
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
		return {
			margin: num('--dots-ring-margin', 6),
			cap: num('--dots-ring-cap', Infinity),   // 'none' reads as no cap
			fakeStroke: num('--dots-fake-stroke', 1.5),
			fade: num('--dots-fade', 1) || 1
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
			D.push({ e, x: 0, y: 0, ox: 0, oy: 0, el: 0.7, gs: 1.5, glow: 0, glowT: 0, sp: 0, rot: 0,
				prx: null, pry: null, sqS: 0, soft: null, vm: 1, szm: 1, vmS: 1, szS: 1,
				V: [1, 0, 0], Vv: [0, 0, 0], dome: false, lk: 0, th: 0, ph: 0, w: 5,
				beh: 'cruise', b0: 0, bd: 0, r0: 0, trailOn: false, hist: [] });
		}
		document.body.append(layer);
	}

	// ─── Targets ───
	// A ring icon's ring is the SVG's circle.ring, read from the page: its
	// centre, radius and stroke, scaled from the 100 box to the screen.
	// Anything else gets a fake ring: half its diagonal plus the margin, capped
	// if a cap is set. Its stroke is its border if it has one.
	const records = new Map();
	function ringCircle(el) {
		const face = el.matches('.tdc-ring') ? el : el.querySelector('.tdc-ring');
		return face && face.querySelector('circle.ring');
	}
	function measure(t) {
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
			t.r = Math.min(Math.hypot(q.width, q.height) / 2 + T.margin, T.cap);
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

	// ─── State ───
	let phase = 'hidden';   // hidden · travel · orbit · race · fade
	let cur = null;         // the target the dots are serving
	let sx = 0, sy = 0, vx = 0, vy = 0, tx = 0, ty = 0, ringR = 19, ringSW = 1.5, dist0 = 1;
	let R = 8, ang = 0, alpha = 0, aT = 0, fading = false, revealAt = 0, holdMs = 0;
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

	function centroid() {
		sx = D.reduce((a, d) => a + d.x, 0) / 4;
		sy = D.reduce((a, d) => a + d.y, 0) / 4;
		vx = vy = 0;
	}
	function goTo(t) {
		if (phase === 'hidden') {
			// From where they were last, if that is on screen; else the middle.
			const W = innerWidth, H = innerHeight;
			if (!(sx > 0 && sx < W && sy > 0 && sy < H)) { sx = W / 2; sy = H / 2; }
			vx = vy = 0;
			D.forEach((d) => { d.x = sx; d.y = sy; d.dome = false; d.hist.length = 0; d.prx = d.pry = null; });
			col = t.colour.slice(0, 3);
		} else if (phase !== 'travel') {
			centroid();
		}
		cur = t;
		tx = t.cx; ty = t.cy;
		dist0 = Math.max(1, Math.hypot(tx - sx, ty - sy));
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

	// The travelling formations (prototype modes): blended, one into the next.
	const MODES = [
		(a, t) => [Math.cos(a), Math.sin(a) * 0.35, Math.sin(a)],
		(a, t) => [Math.cos(a) * 0.35, Math.sin(a), Math.cos(a)],
		(a, t) => [Math.sin(a), Math.sin(2 * a) * 0.5, Math.cos(a)],
		(a, t) => { const k = 0.7 + 0.3 * Math.sin(t * 3); return [k * Math.cos(a), k * Math.sin(a) * Math.cos(t * 0.9), Math.sin(a) * Math.sin(t * 0.9)]; }
	];

	// A spring on the sphere: pulled towards T, then put back on the surface,
	// its velocity kept tangent. Overshoot and follow-through come free.
	function springTo(d, P, dt, k, damp) {
		for (let j = 0; j < 3; j++) { d.Vv[j] += (P[j] - d.V[j]) * k * dt; d.Vv[j] *= Math.pow(damp, dt); }
		const nv = d.V.map((x, j) => x + d.Vv[j] * dt), l = Math.hypot(nv[0], nv[1], nv[2]) || 1;
		const l2 = l + (1 - l) * Math.min(1, 0.15 * dt);
		d.V = nv.map((x) => x / l * l2);
		const u = nrm(d.V), rd = dot3(d.Vv, u);
		d.Vv = d.Vv.map((x, j) => x - rd * u[j]);
	}
	function syncAngles(d) {
		d.th = Math.atan2(d.V[1], d.V[0]);
		d.ph = Math.asin(Math.max(-1, Math.min(1, d.V[2] / (Math.hypot(d.V[0], d.V[1], d.V[2]) || 1))));
	}
	// Arriving: each dot joins the sphere where it is (inside the ring it is
	// over the top), and locks on over a moment rather than snapping.
	function initDome(d, i, now) {
		const dx = d.x - tx, dy = d.y - ty, dist = Math.hypot(dx, dy);
		d.dome = true; d.lk = 0;
		d.th = dist < 3 ? ang + i * PI / 2 : Math.atan2(dy, dx);
		d.ph = dist < ringR ? Math.acos(dist / ringR) : 0;
		d.V = sph(d.th, d.ph); d.Vv = [0, 0, 0];
		d.w = 4.6 + Math.random() * 1.2;
		d.beh = 'cruise'; d.b0 = now; d.r0 = now;
		d.trailOn = false;
	}
	// Waiting. Step 1 has one move, cruise: clockwise round the ring with a
	// gentle bob above and below it. The registry (step 4) replaces this.
	function domeStep(d, i, now, dt, t) {
		d.th += d.w * dt * 0.0167;
		springTo(d, sph(d.th, 0.25 * Math.sin(t * 1.6 + i * 2.1)), dt, 0.34, 0.6);
		d.sqS = 0; d.glowT = 0;
	}
	// The ring race: clockwise at ground size, about two laps a second, with
	// a slight bob for depth.
	function raceStep(d, i, now, dt, t) {
		const ramp = 1 + 2 * sm(cl((now - d.r0) / 450));
		d.th += d.w * ramp * (19 / Math.max(19, ringR)) * dt * 0.0167;
		const ph = 0.22 * Math.sin(t * 4.2 + i * 1.7) * sm(cl((now - d.r0) / 300));
		springTo(d, sph(d.th, ph), dt, 0.5, 0.5);
		d.sqS = 0; d.trailOn = false; d.glowT = 0.25;
	}

	function loop(now) {
		const dt = Math.min(50, now - last) / 16.67;
		last = now;
		const t = now / 1000;

		// The target left the page mid-flight: say so, and fade where we are.
		if (cur && !cur.el.isConnected) {
			TDC.error(AREA, 'the element the dots were serving left the page.', cur.el);
			records.delete(cur.el);
			cur = null;
			if (phase === 'travel') centroid();
			phase = 'fade'; fading = true; aT = 0;
		}
		if (cur) {
			measure(cur);
			tx = cur.cx; ty = cur.cy; ringR = cur.r; ringSW = cur.sw;
			tcol = cur.colour;
		}

		const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
		if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);

		alpha += (aT - alpha) * Math.min(1, (fading ? 0.045 * T.fade : 0.1) * dt);
		for (let c = 0; c < 3; c++) col[c] += (tcol[c] - col[c]) * Math.min(1, 0.05 * dt);
		const cR = col.map(Math.round), colS = `rgb(${cR.join(',')})`;

		// The cluster's centre springs towards the target.
		vx += (tx - sx) * 0.05 * dt; vy += (ty - sy) * 0.05 * dt;
		const f = Math.pow(0.8, dt);
		vx *= f; vy *= f; sx += vx * dt; sy += vy * dt;

		if (phase === 'travel' && Math.hypot(tx - sx, ty - sy) < 4) phase = 'orbit';
		if (phase === 'orbit' && cur.settled) {
			// Step 2 traces here. For now the target comes straight back.
			revealAt = now;
			holdMs = Math.max(restore(cur), 750 / T.fade);
			D.forEach((d) => { d.r0 = now; });
			phase = 'race';
		}
		if (phase === 'race' && now - revealAt > holdMs) { phase = 'fade'; fading = true; aT = 0; }
		if (phase === 'fade' && alpha < 0.03) {
			phase = 'hidden'; cur = null; alpha = 0;
			D.forEach((d) => { d.e.style.opacity = 0; d.hist.length = 0; d.dome = false; });
			running = false;
			return;
		}

		const Rt = phase === 'travel' ? 6 : 11;
		R += (Rt - R) * 0.08 * dt;
		ang += (phase === 'travel' ? 5 : 1.6) * 0.0167 * dt;
		const cyc = 2.6, fc = t / cyc, m1 = Math.floor(fc) % 4, m0 = (m1 + 3) % 4, bl = sm(Math.min(1, (fc % 1) / 0.35));
		const L1 = Math.min(1, 0.15 * dt);
		const prog = 1 - cl(Math.hypot(tx - sx, ty - sy) / dist0);
		const lift = sm(cl(prog * 4)) * sm(cl((1 - prog) * 2.5));
		const inDome = phase === 'orbit' || phase === 'race' || (phase === 'fade' && D[0].dome);

		D.forEach((d, i) => {
			const a = ang + i * PI / 2, A = MODES[m0](a, t), B = MODES[m1](a, t);
			const ux = A[0] + (B[0] - A[0]) * bl, uy = A[1] + (B[1] - A[1]) * bl, z = A[2] + (B[2] - A[2]) * bl;
			let eT = 0;
			d.glowT = 0; d.soft = null; d.vm = 1; d.szm = 1;
			if (inDome) {
				if (!d.dome) initDome(d, i, now);
				if (phase === 'orbit') domeStep(d, i, now, dt, t); else raceStep(d, i, now, dt, t);
				eT = d.V[2];
				const px = tx + ringR * d.V[0], py = ty + ringR * d.V[1];
				d.lk = Math.min(1, d.lk + (phase === 'orbit' ? 0.05 : 0.09) * dt);
				const lk = sm(d.lk);
				d.x += (px - d.x) * lk; d.y += (py - d.y) * lk;
				d.ox *= 0.7; d.oy *= 0.7;
			} else {
				// Travelling: each dot follows the cluster with its own lag, lifts
				// off the page, cruises high and settles as it arrives.
				d.dome = false; d.sqS = 0; d.trailOn = false;
				const k = 0.2 + i * 0.06;
				d.x += (sx + ux * R - d.x) * Math.min(1, k * dt);
				d.y += (sy + uy * R - d.y) * Math.min(1, k * dt);
				eT = phase === 'travel' ? 0.25 + 1.15 * lift + 0.3 * z : 0.7 + 0.45 * z;
				if (phase === 'travel') d.glowT = 0.3 * lift;
				d.ox += (0 - d.ox) * L1; d.oy += (0 - d.oy) * L1;
			}
			d.el += (eT - d.el) * Math.min(1, (inDome ? 0.45 : 0.15) * dt);
			d.gs += (ringSW - d.gs) * Math.min(1, 0.25 * dt);   // size changes are always eased
			d.glow += (d.glowT - d.glow) * Math.min(1, 0.18 * dt);
			d.vmS += (d.vm - d.vmS) * Math.min(1, 0.3 * dt);
			d.szS += (d.szm - d.szS) * Math.min(1, 0.2 * dt);
			draw(d, dt, cR, colS, inDome);
		});

		requestAnimationFrame(loop);
	}

	// One dot onto the screen: size and brightness from height, stretched
	// along its path when fast, and its trail on the canvas.
	function draw(d, dt, cR, colS, inDome) {
		const size = d.gs * Math.pow(2, 1.5 * d.el) * d.szS, sc = size / BASE;
		const rx = d.x + d.ox, ry = d.y + d.oy;
		const mvx = d.prx === null ? 0 : rx - d.prx, mvy = d.pry === null ? 0 : ry - d.pry;
		d.prx = rx; d.pry = ry;
		d.sp += (Math.hypot(mvx, mvy) / dt - d.sp) * Math.min(1, 0.3 * dt);
		if (d.sp > 0.4) d.rot = Math.atan2(mvy, mvx);
		let k = Math.min(1.5, Math.max(0, (d.sp - 1.6) * 0.13)) + d.sqS;
		k = Math.max(-0.6, Math.min(1.6, k));
		let qx = 1 + k, qy = k >= 0 ? 1 / Math.sqrt(1 + k) : 1 - k * 0.9, rot = d.rot;
		if (d.soft) { qx = d.soft.x; qy = d.soft.y; rot = d.soft.rot; }
		const op = 0.35 + 0.65 * cl((d.el + 1) / 2);
		const oa = alpha * d.vmS * Math.min(1, op + d.glow * 0.3);

		if (d.trailOn) d.hist.push({ x: rx, y: ry, s: size });
		const keep = d.trailOn ? 16 : 0;
		if (d.hist.length > keep) d.hist.splice(0, d.trailOn ? d.hist.length - keep : Math.max(1, Math.ceil(d.hist.length / 6)));
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
		if (d.glow > 0.02) {
			const gp = (3 + 9 * d.glow) / Math.max(0.15, sc);
			s.boxShadow = `0 0 ${gp}px ${gp * 0.3}px rgba(${cR.join(',')},${(0.6 * d.glow).toFixed(3)})`;
		} else s.boxShadow = 'none';
		s.transform = `translate(${rx}px,${ry}px) rotate(${rot}rad) scale(${sc * qx},${sc * qy})`;
		s.opacity = oa;
	}

	return {
		serve,
		get state() {
			return { phase, moves: phase === 'orbit' ? D.map((d) => d.beh) : [], busy: records.size };
		}
	};
})();
