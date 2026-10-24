// The ring status engine (UV's design, ported 24 Oct from ring-status-demo.html;
// do not redesign it). A ring of cream with four dots that orbit while
// something loads, then peel off on curved paths and draw an icon stroke by
// stroke. tdc-controls.js builds the site's checkboxes from it: the ring (a
// tick or empty) and the switch (tick on, cross off, its knob sliding in step).
//
//   new TDCRing.RingStatus(el, { initial, icons, labels, onProgress })
//     el       an element holding the SVG from TDCRing.svg()
//     icons    the icon names this control uses; only their paths are built
//     labels   what the hidden live text says for each state
//   .load(seconds, { draw, fade, lead })  start the orbit; the lead dot leaves
//     the ring at `seconds`, and the dots keep orbiting until .resolve()
//   .resolve(iconName | 'empty')  pick the end state, any time after load
//   .setState(state)  jump straight to a state, no animation
//   TDCRing.leadOf(icon)  the lead angle for load() when the end is known
//
// Adding an icon: an entry in ICONS, a 100x100 box inside the ring (r = 40),
// at most 4 strokes, each drawn start to finish, outlines not fills, no stroke
// starting at the exact centre. Exits and dots are worked out from the starts.
//
// Needs: nothing. Loaded on every page by layout.html, before tdc-controls.js.

const TDCRing = (() => {
	const C = 50, R = 40, D2R = Math.PI / 180;
	const LEAD = 55;   // ring degrees before a stroke start where its dot leaves
	const NS = 'http://www.w3.org/2000/svg';
	const nrm = (a) => ((a % 360) + 360) % 360;
	const angOf = (x, y) => nrm(Math.atan2(x - C, C - y) / D2R);

	// ─── Icons: up to 4 strokes each, drawn start to end ───
	const ICONS = {
		tick:  { label: 'Success', strokes: ['M32 51L45 63', 'M68 39L45 63'] },
		cross: { label: 'Failed',  strokes: ['M36 36L50 50', 'M64 36L50 50', 'M64 64L50 50', 'M36 64L50 50'] },
		plus:  { label: 'Added',   strokes: ['M50 30L50 70', 'M30 50L70 50'] },
		heart: { label: 'Liked',   strokes: [
			'M50 72C30 58 26 48 30 40C34 32 46 33 50 42',
			'M50 72C70 58 74 48 70 40C66 32 54 33 50 42'] },
		star:  { label: 'Starred', strokes: [
			'M50 30L56 44L71 45L59 55L63 70L50 62',
			'M50 30L44 44L29 45L41 55L37 70L50 62'] },
		arrow: { label: 'Next',    strokes: ['M32 50L68 50', 'M54 36L68 50', 'M54 64L68 50'] },
		play:  { label: 'Playing', strokes: ['M40 32L66 50L40 68', 'M40 32L40 68'] },
		bolt:  { label: 'Power',   strokes: ['M56 28L40 54L56 54', 'M44 72L56 54'] },
		home:  { label: 'Home',    strokes: ['M30 50L50 32L70 50', 'M36 46L36 68L64 68L64 46'] },
		mail:  { label: 'Mail',    strokes: ['M28 64L28 36L72 36L72 64L28 64', 'M28 36L50 54L72 36'] },
		pin:   { label: 'Located', strokes: [
			'M50 72C38 58 34 52 34 44C34 35 41 29 50 29',
			'M50 72C62 58 66 52 66 44C66 35 59 29 50 29'] },
		lock:  { label: 'Locked',  strokes: ['M34 52L66 52L66 70L34 70L34 52', 'M41 52L41 42C41 35 59 35 59 42L59 52'] },
		gear:  { label: 'Settings', strokes: ['M50.0 23.0L53.8 23.3L54.8 30.6L60.3 32.9L66.2 28.4L71.6 33.8L67.1 39.7L69.4 45.2L76.7 46.2L76.7 53.8L69.4 54.8L67.1 60.3L71.6 66.2L66.2 71.6L60.3 67.1L54.8 69.4L53.8 76.7L50.0 77.0', 'M50.0 23.0L46.2 23.3L45.2 30.6L39.7 32.9L33.8 28.4L28.4 33.8L32.9 39.7L30.6 45.2L23.3 46.2L23.3 53.8L30.6 54.8L32.9 60.3L28.4 66.2L33.8 71.6L39.7 67.1L45.2 69.4L46.2 76.7L50.0 77.0', 'M50 42A8 8 0 1 1 50 58A8 8 0 1 1 50 42'] },
		bell:  { label: 'Notifications', strokes: ['M34 62C37 58 38 54 38 46C38 38 43 33 50 33', 'M66 62C63 58 62 54 62 46C62 38 57 33 50 33', 'M34 62L66 62', 'M44 68C45 72 55 72 56 68'] },
		user:  { label: 'Profile', strokes: ['M50 31A9 9 0 1 1 50 49A9 9 0 1 1 50 31', 'M31 70C31 58 40 54 50 54C60 54 69 58 69 70'] },
		smile: { label: 'Happy',   strokes: ['M36 56C42 66 58 66 64 56', 'M40 37L40 42', 'M60 37L60 42'] }
	};
	const NAMES = Object.keys(ICONS);
	const STR = {};   // key -> stroke geometry
	let geoReady = false;

	// The markup a control hands to RingStatus. dotR: the dots' radius in the
	// 100 box (3 on a big ring, 5 on a small one, as in the demo's switch).
	function svg(dotR) {
		const r = dotR || 5;
		return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
			+ `<circle class="ring" cx="50" cy="50" r="40"/><g class="arms"></g>`
			+ `<g class="dots" fill="currentColor" stroke="none" style="display:none">`
			+ `<circle r="${r}"/><circle r="${r}"/><circle r="${r}"/><circle r="${r}"/></g></svg>`;
	}

	// Sample every stroke once (arc-length table, start tangent, ring exit angle).
	function buildGeometry(host) {
		if (geoReady) return;
		const N = 96;
		for (const name of NAMES) {
			const ic = ICONS[name];
			ic.list = ic.strokes.map((d, i) => {
				const p = document.createElementNS(NS, 'path');
				p.setAttribute('d', d);
				host.appendChild(p);
				const len = p.getTotalLength();
				const X = new Float64Array(N + 1), Y = new Float64Array(N + 1);
				for (let j = 0; j <= N; j++) { const q = p.getPointAtLength(len * j / N); X[j] = q.x; Y[j] = q.y; }
				host.removeChild(p);
				let tx = X[2] - X[0], ty = Y[2] - Y[0];
				const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
				const S = [X[0], Y[0]];
				const near = Math.hypot(S[0] - C, S[1] - C) < 6;
				const st = { key: name + i, icon: name, d, len, N, X, Y, S, tx, ty,
					exit: nrm((near ? angOf(C + S[0] - X[3], C + S[1] - Y[3]) : angOf(S[0], S[1])) - LEAD) };
				STR[st.key] = st;
				return st;
			});
			// dot -> stroke assignments: dot 0 always takes stroke 0, strokes shared evenly
			const n = ic.list.length, cap = Math.ceil(4 / n), out = [];
			for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
				const as = [0, a, b, c], cnt = new Array(n).fill(0);
				as.forEach((x) => cnt[x]++);
				if (cnt.every((x) => x >= 1 && x <= cap)) out.push(as);
			}
			ic.assign = out;
		}
		geoReady = true;
	}
	const leadOf = (t) => (ICONS[t] && ICONS[t].list) ? ICONS[t].list[0].exit : 260;

	// ─── Spin profile scaled to load time L; lead dot reaches `lead` exactly at T = L ───
	function makeProfile(L, lead) {
		L = Math.max(0.05, L);
		const TA = 0.3 * L;
		let laps = Math.max(0, Math.round((360 * L * 0.85 - lead) / 360));
		if (lead + 360 * laps < 30) laps++;
		const total = lead + 360 * laps;
		const V = total / (L - TA / 2);
		const GAP = 90 / V;
		const th = (t) => {
			if (t <= 0) return 0;
			if (t >= TA) return V * TA * 0.5 + V * (t - TA);
			const u = t / TA;
			return V * TA * (u * u * u - u * u * u * u * 0.5);
		};
		const invTh = (a) => {
			if (a <= 0) return 0;
			const edge = V * TA * 0.5;
			if (a >= edge) return TA + (a - edge) / V;
			let lo = 0, hi = 1;
			for (let i = 0; i < 30; i++) {
				const m = (lo + hi) / 2;
				if (V * TA * (m * m * m - m * m * m * m * 0.5) < a) lo = m; else hi = m;
			}
			return hi * TA;
		};
		const peelTime = (k, ex, tp) => {
			const a0 = th(tp - k * GAP);
			let d = nrm(ex - nrm(a0));
			if (d > 359.999) d = 0;
			return invTh(a0 + d) + k * GAP;
		};
		return { L, TA, V, GAP, th, invTh, peelTime };
	}

	// Curved exit from the ring (tangent departure) into the stroke start (along stroke direction)
	function buildPath(st, ex, dur) {
		const r = ex * D2R;
		const px = C + R * Math.sin(r), py = C - R * Math.cos(r);
		const tx = Math.cos(r), ty = Math.sin(r);
		const [sx, sy] = st.S;
		const dist = Math.hypot(sx - px, sy - py);
		const x1 = px + tx * 0.45 * dist, y1 = py + ty * 0.45 * dist;
		const x2 = sx - st.tx * 0.35 * dist, y2 = sy - st.ty * 0.35 * dist;
		const N = 40, X = new Float64Array(N + 1), Y = new Float64Array(N + 1), L = new Float64Array(N + 1);
		X[0] = px; Y[0] = py;
		for (let i = 1; i <= N; i++) {
			const t = i / N, m = 1 - t;
			X[i] = m * m * m * px + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * sx;
			Y[i] = m * m * m * py + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * sy;
			L[i] = L[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
		}
		const Lc = L[N];
		return { X, Y, L, N, Lc, Ll: st.len, total: Lc + st.len, stroke: st, T: dur };
	}
	const out = [0, 0];
	function posAt(p, sd) {
		if (sd <= p.Lc) {
			let i = 1;
			while (i < p.N && p.L[i] < sd) i++;
			const a = p.L[i - 1], b = p.L[i], f = b > a ? (sd - a) / (b - a) : 0;
			out[0] = p.X[i - 1] + (p.X[i] - p.X[i - 1]) * f;
			out[1] = p.Y[i - 1] + (p.Y[i] - p.Y[i - 1]) * f;
		} else {
			const s = p.stroke, g = Math.min(1, (sd - p.Lc) / p.Ll) * s.N;
			const i = Math.min(s.N - 1, Math.floor(g)), f = g - i;
			out[0] = s.X[i] + (s.X[i + 1] - s.X[i]) * f;
			out[1] = s.Y[i] + (s.Y[i + 1] - s.Y[i]) * f;
		}
		return out;
	}

	class RingStatus {
		constructor(btn, opts = {}) {
			this.btn = btn;
			this.onProgress = opts.onProgress;
			this.labels = opts.labels || {};
			const svgEl = btn.querySelector('svg');
			buildGeometry(svgEl);
			this.dotsG = svgEl.querySelector('.dots');
			this.dots = [...this.dotsG.children];
			this.els = {};
			const armsG = svgEl.querySelector('.arms');
			const used = opts.icons || NAMES;
			for (const k in STR) {
				if (!used.includes(STR[k].icon)) continue;
				const p = document.createElementNS(NS, 'path');
				p.setAttribute('d', STR[k].d);
				p.setAttribute('pathLength', '100');
				p.setAttribute('class', 'mark');
				armsG.appendChild(p);
				this.els[k] = p;
			}
			this.keys = Object.keys(this.els);
			this.live = document.createElement('span');
			this.live.className = 'sr';
			this.live.setAttribute('role', 'status');
			btn.after(this.live);
			this.reduce = matchMedia('(prefers-reduced-motion: reduce)');
			this.rev = {}; this.prev = {};
			this.raf = 0; this.running = false;
			this.frame = this.frame.bind(this);
			this.setState(opts.initial || 'empty');
		}
		get busy() { return this.running; }
		setState(s) {
			this.state = s; this.btn.dataset.state = s;
			this.live.textContent = this.labels[s]
				|| (s === 'empty' ? 'Idle' : s === 'loading' ? 'Loading' : ICONS[s].label);
			for (const k of this.keys) this.els[k].classList.toggle('on', STR[k].icon === s);
		}
		// seconds: load time. opts: draw, fade (seconds); lead: ring angle of the first exit (see leadOf)
		load(seconds = 1, opts = {}) {
			if (this.running) return;
			this.pr = makeProfile(seconds, opts.lead ?? 260);
			this.draw = opts.draw ?? 0.8;
			this.fade = opts.fade ?? 0.5;
			this.tf = this.fade * 0.4;
			this.running = true; this.target = null; this.planned = false;
			this.T = 0; this.last = 0; this.tp = 0;
			for (const k of this.keys) { this.rev[k] = 0; this.prev[k] = 0; }
			this.setState('loading');
			if (this.reduce.matches) return;
			this.dotsG.style.display = '';
			this.raf = requestAnimationFrame(this.frame);
		}
		resolve(target) {
			if (!this.running || this.target) return;
			this.target = target;
			if (this.reduce.matches) this.finish();
		}
		plan() {
			const pr = this.pr;
			this.planned = true;
			const tp = Math.max(this.T, pr.L);
			this.tp = tp;
			if (this.target === 'empty') return;
			const ic = ICONS[this.target];
			const wait = (k, ex) => pr.peelTime(k, ex, tp) - tp;
			let best = null, bm = 0, bs = 0;
			for (const as of ic.assign) {
				let m = 0, s = 0;
				for (let k = 0; k < 4; k++) { const w = wait(k, ic.list[as[k]].exit); if (w > m) m = w; s += w; }
				if (!best || m < bm - 1e-6 || (Math.abs(m - bm) < 1e-6 && s < bs)) { best = as; bm = m; bs = s; }
			}
			this.peel = []; this.paths = [];
			for (let k = 0; k < 4; k++) {
				const st = ic.list[best[k]];
				this.peel.push(tp + wait(k, st.exit));
				this.paths.push(buildPath(st, st.exit, this.draw));
			}
		}
		frame(ts) {
			const dt = this.last ? Math.min((ts - this.last) / 1000, 0.05) : 0;
			this.last = ts; this.T += dt;
			const T = this.T, pr = this.pr;
			if (this.target && !this.planned) this.plan();
			let done = this.planned;
			let opSum = 0;
			const rev = this.rev;
			for (const k of this.keys) rev[k] = 0;
			for (let k = 0; k < 4; k++) {
				let x, y, op = 1;
				if (this.planned && this.target === 'empty') {
					const a = pr.th(T - k * pr.GAP) * D2R;
					x = C + R * Math.sin(a); y = C - R * Math.cos(a);
					op = Math.max(0, 1 - Math.max(0, (T - this.tp - k * pr.GAP) / this.fade));
					if (op > 0) done = false;
				} else if (!this.planned || T < this.peel[k]) {
					const a = pr.th(T - k * pr.GAP) * D2R;
					x = C + R * Math.sin(a); y = C - R * Math.cos(a);
					done = false;
				} else {
					const p = this.paths[k];
					const u = Math.min(1, (T - this.peel[k]) / p.T);
					const sd = p.total * (1 - (1 - u) * (1 - u));
					const q = posAt(p, sd);
					x = q[0]; y = q[1];
					if (u < 1) done = false;
					const tf = Math.max(0, T - this.peel[k] - p.T);
					op = Math.max(0, 1 - tf / this.tf);
					if (tf < this.tf) done = false;
					const rv = Math.min(1, Math.max(0, (sd - p.Lc) / p.Ll));
					const key = p.stroke.key;
					if (key in rev && rv > rev[key]) rev[key] = rv;
				}
				opSum += op;
				const d = this.dots[k];
				d.setAttribute('cx', x.toFixed(2));
				d.setAttribute('cy', y.toFixed(2));
				d.setAttribute('opacity', op.toFixed(2));
			}
			for (const k of this.keys) {
				if (rev[k] !== this.prev[k]) {
					const el = this.els[k];
					el.style.transition = 'none';
					el.style.strokeDashoffset = 100 * (1 - rev[k]);
					this.prev[k] = rev[k];
				}
			}
			if (this.planned && this.onProgress) {
				let p;
				if (this.target === 'empty') p = 1 - opSum / 4;
				else {
					const list = ICONS[this.target].list;
					let sum = 0;
					for (const s of list) sum += rev[s.key] || 0;
					p = sum / list.length;
				}
				this.onProgress(p, this.target);
			}
			if (done) this.finish();
			else this.raf = requestAnimationFrame(this.frame);
		}
		finish() {
			cancelAnimationFrame(this.raf);
			for (const k of this.keys) { this.els[k].style.transition = ''; this.els[k].style.strokeDashoffset = ''; }
			this.dotsG.style.display = 'none';
			this.running = false; this.planned = false;
			if (this.onProgress) this.onProgress(1, this.target);
			this.setState(this.target);
			if (this.onDone) this.onDone(this.target);
		}
	}

	return { RingStatus, ICONS, leadOf, svg };
})();
