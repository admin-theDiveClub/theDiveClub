// The animation picker (/sandbox/animations/, UV 31 Oct and 1 Nov): every
// waiting move the dots play on the site, each in its own card (the real
// dots.js in a frame, /sandbox/animations/move/), and a library of new
// scenes, each drawn on its own small stage. Each can be marked for the dots'
// loop; the marks are kept in this browser (localStorage) and copied out as a
// list, and "The loop" plays every marked one in turn. Nothing here is wired
// into dots.js or touches the database.
//
// A scene is run(p, R, n): p from 0 to 1 over its show time, R sixteen random
// numbers, n how many loops have played. It returns the four dots ({x, y, s:
// size against the line, a: opacity, g: glow, z: depth, shape and m: a shape
// it is turning into and how far, 0 a dot, sx, sy, rot}), any extras (fx: c
// a light, o a faint circle, bg a shadow in the page colour, pb a page-colour
// shape, l a line, e an ellipse, sh a ground shadow, sd a dark shadow, pf a
// pool of light, pd a dark shape, hl a highlight; top: over the dots; keep:
// stays through the loop) and whether the dots leave trails.
//
// Two kinds of loop: loop: true, a scene that comes back to where it began
// and simply goes round again (its R kept unless reroll: true); otherwise
// fade: [in, out], a scene that fades in and out, drawn afresh each time
// with new random numbers, so its reset is never seen.
//
// Needs: tdc.js, dots.js, loader.js (layout.html).

(() => {
	const AREA = 'Animations';
	const NS = 'http://www.w3.org/2000/svg';
	const STORE = 'tdc.dots.picker';

	// ─── The sliders ───
	const K = { size: 1, k: 1, kr: 1, speed: 1, trail: 9, glow: 1, depth: 1, stage: 9 };
	const SLIDERS = [
		['size', 'Dot size', 0.4, 2.5, 0.05, '×'],
		['k', 'Line width', 0.3, 2, 0.05, '×'],
		['kr', 'Ring line', 0.4, 2.5, 0.05, '×'],
		['speed', 'Speed', 0, 2.5, 0.05, '×'],
		['trail', 'Trail length', 0, 24, 1, ''],
		['glow', 'Glow', 0, 2, 0.05, '×'],
		['depth', 'Depth', 0, 2, 0.05, '×'],
		['stage', 'Stage size', 6, 16, 0.5, 'rem']
	];
	const DEFAULTS = Object.assign({}, K);

	// ─── Maths and timing ───
	const TAU = Math.PI * 2;
	const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
	const lerp = (a, b, t) => a + (b - a) * t;
	const seg = (p, a, b) => clamp((p - a) / (b - a));
	const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
	const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	const easeOut = (t) => 1 - Math.pow(1 - t, 3);
	const easeIn = (t) => t * t * t;
	const decel = (t) => 1 - (1 - t) * (1 - t);   // constant deceleration: a ball rolling to a stop
	const backOut = (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
	const pulse = (t) => Math.sin(Math.PI * clamp(t));
	const mix2 = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t)];
	const ringAt = (i, r = 40, turn = 0) => { const a = -Math.PI / 2 + i * Math.PI / 2 + turn; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; };
	const pt = (x, y, o) => Object.assign({ x, y, s: 1, a: 1, g: 0 }, o);
	const NONE = () => pt(50, 50, { a: 0 });
	const along = (pts, u) => { const n = pts.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)); return mix2(pts[i], pts[i + 1], f - i); };
	const twinkle = (p, r, n = 2.5) => Math.max(0, Math.sin(TAU * (p * n + r)));
	const f2 = (v) => v.toFixed(2);
	const rnd = () => Array.from({ length: 16 }, Math.random);
	const dotR = (s) => 5 * K.k * K.size * s;
	const deg = (rad) => rad * 180 / Math.PI;
	const poly = (pts) => 'M' + pts.map((q) => f2(q[0]) + ' ' + f2(q[1])).join('L');
	const bez2 = (A, B, C, u) => mix2(mix2(A, B, u), mix2(B, C, u), u);
	// A number from 0 to 1 that is always the same for the same a and b.
	const hash01 = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
	// Organic drift: a few sines out of step. nz runs on for ever; nzl comes
	// back to where it started when p reaches 1, so a loop stays seamless.
	const nz = (t, r) => (Math.sin(t * 1.3 + r * 12.9) + 0.6 * Math.sin(t * 2.1 + r * 7.3) + 0.3 * Math.sin(t * 3.7 + r * 3.1)) / 1.9;
	const nzl = (p, r, k = 1) => (Math.sin(TAU * (k * p + r)) + 0.55 * Math.sin(TAU * (2 * k * p + r * 1.9) + 1) + 0.3 * Math.sin(TAU * (3 * k * p + r * 2.7) + 2)) / 1.85;

	// A curve as a path, worked out once; the same drawn only up to u; and a
	// window of a curve that repeats (u may run past 0 or 1).
	const memo = {};
	const curve = (key, n, fn) => memo[key] || (memo[key] = poly(Array.from({ length: n + 1 }, (_, i) => fn(i / n))));
	const curveTo = (n, fn, u) => { const m = Math.floor(clamp(u) * n), pts = []; for (let i = 0; i <= m; i++) pts.push(fn(i / n)); pts.push(fn(clamp(u))); return poly(pts); };
	const curveWin = (n, fn, u0, u1) => poly(Array.from({ length: n + 1 }, (_, i) => fn(lerp(u0, u1, i / n))));

	// ─── The sphere ───
	// The dots' own idea: the ring is the equator of an invisible sphere. A
	// point turned about the x axis (ax), then the y axis (ay); depth z from
	// -1 (behind) to 1 (in front).
	const rot3 = (x, y, z, ax, ay) => {
		const y1 = y * Math.cos(ax) - z * Math.sin(ax), z1 = y * Math.sin(ax) + z * Math.cos(ax);
		return [x * Math.cos(ay) + z1 * Math.sin(ay), y1, -x * Math.sin(ay) + z1 * Math.cos(ay)];
	};
	const onSphere = (lat, lon, tilt = 0.4, spin = 0, R = 34) => {
		const [X, Y, Z] = rot3(R * Math.cos(lat) * Math.cos(lon + spin), -R * Math.sin(lat), R * Math.cos(lat) * Math.sin(lon + spin), tilt, 0);
		return { x: 50 + X, y: 50 + Y, z: Z / R };
	};
	// A dot at a sphere point: bigger and brighter in front (the spec's size
	// from height, scaled by the Depth slider).
	const sp = (P, base = 1, o) => pt(P.x, P.y, Object.assign({ s: base * Math.pow(2, 1.2 * K.depth * P.z), a: 0.5 + 0.5 * (P.z + 1) / 2, z: P.z }, o));
	const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
	const kepler = (M, e) => { let E = M; for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };

	// ─── The ground in perspective (UV, 1 Nov) ───
	// A floor seen from a little above. World x runs across, y up, z away from
	// the eye; the horizon is at hy and the eye ch above the floor. A dot
	// shrinks with distance; its shadow on the floor grows and fades as it
	// rises; the floor is a grid running to the horizon.
	const CAM = { hy: 30, ch: 24 };
	const P3 = (x, y, z, c = CAM) => { const k = 64 / z; return { x: 50 + x * k, y: c.hy + (c.ch - y) * k, k }; };
	const BR = (s) => dotR(s) * 0.6;   // a dot's radius in world units
	const wpt = (x, y, z, s = 1, o) => { const P = P3(x, y, z); return pt(P.x, P.y, Object.assign({ s: s * P.k * 0.6, z: 100 / z }, o)); };
	const wsh = (x, z, h, s = 1, a = 0.22) => { const P = P3(x, 0, z), rx = dotR(s) * P.k * 0.66; return { sh: [P.x, P.y, rx, rx * CAM.ch / z], a: a * (1 - clamp(h / 40)) }; };
	const wline = (pts) => poly(pts.map(([x, y, z]) => { const P = P3(x, y, z); return [P.x, P.y]; }));
	const wcircle = (cx, cz, r, y = 0, n = 28) => wline(Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(TAU * i / n), y, cz + r * Math.sin(TAU * i / n)]));
	const grid = (c = CAM) => {
		const key = 'grid' + c.hy + '-' + c.ch;
		if (memo[key]) return memo[key];
		const P = (x, z) => { const q = P3(x, 0, z, c); return f2(q.x) + ' ' + f2(q.y); };
		let d = '';
		for (const z of [26, 32, 40, 52, 70, 100, 160]) d += `M${P(-90, z)}L${P(90, z)}`;
		for (const x of [-60, -40, -20, 0, 20, 40, 60]) d += `M${P(x, 24)}L${P(x, 400)}`;
		return (memo[key] = d);
	};
	const floor = () => ({ l: grid(), a: 0.13, w: 1, keep: true });
	// A horizon at hy: everything below hidden, with the floor's grid on top.
	const horizonGround = (hy = 62, ch = 10) => [{ pb: `M0 ${hy}H100V100H0Z`, top: true, keep: true }, { l: grid({ hy, ch }), a: 0.14, w: 1, top: true, keep: true }, { l: `M14 ${hy}L86 ${hy}`, a: 0.5, w: 2.5, top: true, keep: true }];
	const lanes = (ys) => ys.map((y) => ({ l: `M22 ${y}L78 ${y}`, a: 0.12, w: 1, keep: true }));
	// A long thing between two screen points (a domino, a bat, a pin): one
	// dot stretched along the line, width s.
	const stick = (A, B, s, o) => { const L = Math.hypot(B.x - A.x, B.y - A.y), r = dotR(s); return pt((A.x + B.x) / 2, (A.y + B.y) / 2, Object.assign({ s, sy: Math.max(1, L / 2 / r), rot: deg(Math.atan2(B.y - A.y, B.x - A.x)) - 90 }, o)); };
	// A ball dropped from h0: its height t seconds on, bouncing (restitution
	// e) until it rests. since: seconds since it last hit the ground.
	function dropBounce(t, h0, g = 400, e = 0.55) {
		let v = Math.sqrt(2 * g * Math.max(0, h0));
		const tf = v / g;
		if (t < tf) return { h: h0 - 0.5 * g * t * t, since: -1, v: g * t };
		t -= tf;
		for (let n = 1; n < 14; n++) { const vi = v; v *= e; const T = 2 * v / g; if (t < T) return { h: v * t - 0.5 * g * t * t, since: t, v: vi }; t -= T; }
		return { h: 0, since: 9, v: 0 };
	}
	// Squash on landing, stretch with speed (for a dropBounce).
	const squash = (b, k = 1) => {
		const c = b.since >= 0 ? Math.exp(-b.since * 28) * clamp(b.v / 220) : 0;
		if (c > 0.03) return { sx: 1 + 0.55 * c * k, sy: 1 - 0.42 * c * k };
		const st = 1 + 0.25 * k * clamp(Math.abs(b.v) / 300); return { sx: 1 / Math.sqrt(st), sy: st };
	};

	// ─── Light and shadow ───
	// The shadow a light at L (world) casts of a ball at B (B[1] its centre
	// height) on the floor: further and fainter the closer the ball is to the
	// light's height, stretched away from the light.
	const castShadow = (L, B, s = 1, a = 0.5) => {
		const k = L[1] / Math.max(0.6, L[1] - B[1]), x = L[0] + (B[0] - L[0]) * k, z = Math.max(26, L[2] + (B[2] - L[2]) * k);
		const S = P3(x, 0, z), G = P3(L[0], 0, Math.max(26, L[2])), r = dotR(s) * S.k * 0.6, ang = deg(Math.atan2(S.y - G.y, S.x - G.x));
		return { sd: [S.x, S.y, r * (1 + 0.5 * (k - 1)) * 1.2, r * Math.max(0.3, CAM.ch / z), ang], a: a / Math.sqrt(k) };
	};
	// A directional light (the sun): the shadow of a ball at B, the light
	// coming along dir (dir[1] < 0 is downwards).
	const sunShadow = (dir, B, s = 1, a = 0.45) => {
		const t = B[1] / Math.max(0.08, -dir[1]), x = B[0] + dir[0] * t, z = Math.max(26, B[2] + dir[2] * t);
		const S = P3(x, 0, z), F = P3(B[0], 0, B[2]), r = dotR(s) * S.k * 0.6, L = Math.hypot(S.x - F.x, S.y - F.y);
		return { sd: [(S.x + F.x) / 2, (S.y + F.y) / 2, r + L / 2, r * 0.5, deg(Math.atan2(S.y - F.y, S.x - F.x))], a };
	};
	const circPath = (x, y, r) => `M${f2(x - r)} ${f2(y)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0Z`;
	// A big dot shaded as a ball lit from angle la: a highlight towards the
	// light, a darker side away from it.
	const shade = (x, y, R, la, amt = 1) => [
		{ pd: circPath(x - Math.cos(la) * R * 0.15, y - Math.sin(la) * R * 0.15, R * 0.85), a: 0.28 * amt, top: true },
		{ hl: [x + Math.cos(la) * R * 0.2, y + Math.sin(la) * R * 0.2, R * 0.6], a: 0.12 * amt, top: true },
		{ hl: [x + Math.cos(la) * R * 0.36, y + Math.sin(la) * R * 0.36, R * 0.36], a: 0.2 * amt, top: true },
		{ hl: [x + Math.cos(la) * R * 0.5, y + Math.sin(la) * R * 0.5, R * 0.16], a: 0.45 * amt, top: true }
	];
	// A cone of light from S, its middle along angle a, half as wide as w, L long.
	const cone = (S, a, w, L) => poly([S, [S[0] + L * Math.cos(a - w), S[1] + L * Math.sin(a - w)], [S[0] + L * Math.cos(a + w), S[1] + L * Math.sin(a + w)]]) + 'Z';
	// How far inside that cone a point is: 1 on its middle line, 0 at its edges.
	const inCone = (S, a, w, P) => { let d = Math.atan2(P[1] - S[1], P[0] - S[0]) - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return clamp(1 - Math.abs(d) / w); };

	// A big dot's glow: three soft rings round it.
	const corona = (x, y, R, amt) => amt <= 0 ? [] : [[1.2, 0.18], [1.4, 0.1], [1.6, 0.05]].map(([m, a]) => ({ c: [x, y, R * m], a: a * amt }));

	// ─── Small physics engines ───
	function wall(o, cx, cy, lim) {
		const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
		if (d > lim) { const nx = dx / d, ny = dy / d, vn = o.vx * nx + o.vy * ny; if (vn > 0) { o.vx -= 2 * vn * nx; o.vy -= 2 * vn * ny; } o.x = cx + nx * lim; o.y = cy + ny * lim; }
	}
	function collide(b, R) {
		for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
			const A = b[i], B = b[j], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
			if (d > 0 && d < 2 * R) {
				const nx = dx / d, ny = dy / d, rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
				if (rv < 0) { A.vx += rv * nx; A.vy += rv * ny; B.vx -= rv * nx; B.vy -= rv * ny; }
				const push = (2 * R - d) / 2; A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
			}
		}
	}
	// The break inside the ring: a cue dot into a rack of three, off the
	// ring's cushion.
	function breakSim(t, R) {
		const Rr = 4.5, dt = 1 / 120;
		const b = [{ x: 22, y: 50, vx: 78, vy: (R[0] - 0.5) * 6 }, { x: 60, y: 50, vx: 0, vy: 0 }, { x: 68.2, y: 45.2, vx: 0, vy: 0 }, { x: 68.2, y: 54.8, vx: 0, vy: 0 }];
		for (let s = 0, n = Math.floor(t / dt); s < n; s++) {
			for (const o of b) { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 1 - 0.7 * dt; o.vy *= 1 - 0.7 * dt; wall(o, 50, 50, 38 - Rr); }
			collide(b, Rr);
		}
		return b;
	}
	// A pool table in perspective (world x across; in the simulation y is the depth z).
	const TABLE = { x0: -24, x1: 24, z0: 44, z1: 110 };
	const POCKETS = [[-24, 44], [24, 44], [-25, 77], [25, 77], [-24, 110], [24, 110]];
	const tableFx = () => [{ l: wline([[TABLE.x0, 0, TABLE.z0], [TABLE.x1, 0, TABLE.z0], [TABLE.x1, 0, TABLE.z1], [TABLE.x0, 0, TABLE.z1], [TABLE.x0, 0, TABLE.z0]]), a: 0.45, w: 2, keep: true }]
		.concat(POCKETS.map(([x, z]) => ({ l: wcircle(x, z, 2.6, 0, 16), a: 0.4, w: 1.5, keep: true })));
	function poolSim(t, R) {
		const br = 2.7, dt = 1 / 120;
		const b = [{ x: (R[0] - 0.5) * 3, y: 54, vx: (R[1] - 0.5) * 10, vy: 160 }, { x: 0, y: 90, vx: 0, vy: 0 }, { x: -2.75, y: 94.8, vx: 0, vy: 0 }, { x: 2.75, y: 94.8, vx: 0, vy: 0 }];
		for (let s = 0, n = Math.floor(t / dt); s < n; s++) {
			for (const o of b) {
				o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 1 - 0.9 * dt; o.vy *= 1 - 0.9 * dt;
				if (o.x < TABLE.x0 + br) { o.x = TABLE.x0 + br; o.vx = Math.abs(o.vx) * 0.8; }
				if (o.x > TABLE.x1 - br) { o.x = TABLE.x1 - br; o.vx = -Math.abs(o.vx) * 0.8; }
				if (o.y < TABLE.z0 + br) { o.y = TABLE.z0 + br; o.vy = Math.abs(o.vy) * 0.8; }
				if (o.y > TABLE.z1 - br) { o.y = TABLE.z1 - br; o.vy = -Math.abs(o.vy) * 0.8; }
			}
			collide(b, br);
		}
		return b;
	}
	// Sparks in the bulb's glass (centre 50, 40; radius 19, less its line and the spark).
	function sparks(t, R) {
		const dt = 1 / 120;
		const b = [0, 1, 2, 3].map((i) => { const a = R[i] * TAU, v = 45 + R[i + 4] * 25; return { x: 50 + Math.cos(a) * 4, y: 40 + Math.sin(a) * 4, vx: Math.cos(a + 1) * v, vy: Math.sin(a + 1) * v }; });
		for (let s = 0, n = Math.floor(t / dt); s < n; s++) for (const o of b) { o.x += o.vx * dt; o.y += o.vy * dt; o.vy += 30 * dt; wall(o, 50, 40, 19 - 1.5 * K.k - dotR(0.5)); }
		return b;
	}
	function dpend(t, R) {
		const L = 15, g = 420, dt = 1 / 240;
		let a1 = 1.9 + R[0] * 0.8, a2 = 2.2 + R[1] * 0.8, w1 = 0, w2 = 0;
		for (let s = 0, n = Math.floor(t / dt); s < n; s++) {
			const d = a1 - a2, den = L * (3 - Math.cos(2 * d));
			const al1 = (-3 * g * Math.sin(a1) - g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * (w2 * w2 * L + w1 * w1 * L * Math.cos(d))) / den;
			const al2 = (2 * Math.sin(d) * (2 * w1 * w1 * L + 2 * g * Math.cos(a1) + w2 * w2 * L * Math.cos(d))) / den;
			w1 = (w1 + al1 * dt) * 0.9995; w2 = (w2 + al2 * dt) * 0.9995; a1 += w1 * dt; a2 += w2 * dt;
		}
		return [a1, a2];
	}
	function gas(t, R, total) {
		const Rr = 4, dt = 1 / 120;
		const b = [0, 1, 2, 3].map((i) => ({ x: 50 + (i % 2 ? 10 : -10), y: 50 + (i < 2 ? -10 : 10), vx: Math.cos(R[i] * TAU), vy: Math.sin(R[i] * TAU) }));
		for (let s = 0, n = Math.floor(t / dt); s < n; s++) {
			const v = 8 + 90 * Math.sin(Math.PI * clamp(s * dt / total));
			for (const o of b) { const l = Math.hypot(o.vx, o.vy) || 1; o.vx /= l; o.vy /= l; o.x += o.vx * v * dt; o.y += o.vy * v * dt; wall(o, 50, 50, 37 - Rr); }
			collide(b, Rr);
		}
		return b;
	}
	// The Lorenz attractor: four particles started a hair apart, worked out
	// once a loop (the last few kept).
	const lorenzMemo = new Map();
	function lorenz(R) {
		const key = R[0].toFixed(6);
		if (lorenzMemo.has(key)) return lorenzMemo.get(key);
		const out = [];
		for (let i = 0; i < 4; i++) {
			let x = 1 + R[0] * 0.5 + i * 0.002, y = 1, z = 20;
			const pts = [];
			for (let s = 0; s < 1400; s++) { for (let k = 0; k < 2; k++) { const dt = 0.005, dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 / 3 * z; x += dx * dt; y += dy * dt; z += dz * dt; } pts.push([50 + x * 1.3, 84 - z * 1.25, y]); }
			out.push(pts);
		}
		lorenzMemo.set(key, out);
		if (lorenzMemo.size > 6) lorenzMemo.delete(lorenzMemo.keys().next().value);
		return out;
	}
	// The brachistochrone: four tracks from A to B, and how long a ball takes
	// to roll down each under gravity (worked out once).
	let brachMemo = null;
	function brach() {
		if (brachMemo) return brachMemo;
		const A = [24, 30], B = [76, 64], dx = B[0] - A[0], dy = B[1] - A[1];
		let lo = 0.01, hi = TAU - 0.01;
		for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if ((m - Math.sin(m)) / (1 - Math.cos(m)) < dx / dy) lo = m; else hi = m; }
		const th = lo, Rc = dy / (1 - Math.cos(th));
		const fns = [(u) => mix2(A, B, u), (u) => bez2(A, [A[0], B[1]], B, u), (u) => [A[0] + dx * u, A[1] + dy * Math.sqrt(u)], (u) => { const t = u * th; return [A[0] + Rc * (t - Math.sin(t)), A[1] + Rc * (1 - Math.cos(t))]; }];
		const tracks = fns.map((fn) => {
			const pts = [], ts = [0]; let T = 0;
			for (let i = 0; i <= 400; i++) pts.push(fn(i / 400));
			for (let i = 1; i <= 400; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], v = (Math.sqrt(2 * Math.max(0, y0 - A[1])) + Math.sqrt(2 * Math.max(0, y1 - A[1]))) / 2; T += Math.hypot(x1 - x0, y1 - y0) / Math.max(v, 0.05); ts.push(T); }
			return { pts, ts, T };
		});
		const scale = 1.4 / tracks[3].T;   // the cycloid takes 1.4 s
		for (const tr of tracks) { tr.ts = tr.ts.map((v) => v * scale); tr.T *= scale; }
		return (brachMemo = { tracks, path: fns.map((fn) => poly(Array.from({ length: 61 }, (_, i) => fn(i / 60)))) });
	}
	const trackAt = (tr, t) => { if (t <= 0) return tr.pts[0]; if (t >= tr.T) return tr.pts[tr.pts.length - 1]; let lo = 0, hi = tr.ts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr.ts[m] < t) lo = m; else hi = m; } return mix2(tr.pts[lo], tr.pts[hi], (t - tr.ts[lo]) / (tr.ts[hi] - tr.ts[lo] || 1)); };

	// ─── Curves some scenes share ───
	const BIGBULB = 'M43 64L43 59C43 55 31 51 31 40A19 19 0 1 1 69 40C69 51 57 55 57 59L57 64Q57 67 54 67L46 67Q43 67 43 64Z';
	const BULBBASE = 'M45 71L55 71M47 75L53 75';
	const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((c) => c / Math.sqrt(3)));
	const LEM = (u, cx, cy, a) => { const t = TAU * u, d = 1 + Math.sin(t) ** 2; return [cx + a * Math.cos(t) / d, cy + a * Math.sin(t) * Math.cos(t) / d]; };
	const LIS = (u) => [50 + 28 * Math.sin(3 * TAU * u + Math.PI / 2), 50 + 28 * Math.sin(2 * TAU * u)];
	const ROSE = (u) => { const t = TAU * u, r = 30 * Math.cos(2 * t); return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; };
	const SPIRO = (u) => { const t = TAU * 11 * u, R = 30, r = 11, d = 15; return [50 + (R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t), 50 + (R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t)]; };
	const EPI = [[15, 1], [7, -3], [4, 5], [2.5, -7]];
	const epiTips = (u) => { let x = 50, y = 50; return EPI.map(([r, f]) => { const t = TAU * f * u; x += r * Math.cos(t); y += r * Math.sin(t); return [x, y]; }); };
	const GSP = (u) => { const t = u * 15.7, r = 2 * Math.exp(0.18 * t); return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; };
	const BZ = [[24, 66], [34, 22], [70, 28], [76, 68]];
	const bez3 = (u) => { const a = [0, 1, 2].map((i) => mix2(BZ[i], BZ[i + 1], u)), b = [0, 1].map((i) => mix2(a[i], a[i + 1], u)); return mix2(b[0], b[1], u); };
	const CARD = (u) => { const t = TAU * u; return [50 + 9 * (2 * Math.cos(t) - Math.cos(2 * t)), 50 + 9 * (2 * Math.sin(t) - Math.sin(2 * t))]; };
	const TRE = (s) => { const t = TAU * s; return [8 * (Math.sin(t) + 2 * Math.sin(2 * t)), 8 * (Math.cos(t) - 2 * Math.cos(2 * t)), 8 * -Math.sin(3 * t)]; };
	const HIL = (() => {
		const n = 8, pts = [];
		for (let d = 0; d < n * n; d++) {
			let x = 0, y = 0, t = d;
			for (let s = 1; s < n; s *= 2) { const rx = 1 & (t >> 1), ry = 1 & (t ^ rx); if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const tmp = x; x = y; y = tmp; } x += s * rx; y += s * ry; t >>= 2; }
			pts.push([26 + x * 48 / 7, 26 + y * 48 / 7]);
		}
		return pts;
	})();
	const SFORM = [[3, 4.5, 10, 10], [4, 12, 15, 15], [5, 2, 7, 7], [6, 1, 1, 1]];
	const sfR = (phi, [m, n1, n2, n3]) => Math.pow(Math.pow(Math.abs(Math.cos(m * phi / 4)), n2) + Math.pow(Math.abs(Math.sin(m * phi / 4)), n3), -1 / n1);
	const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
	const MANDEL_C = [[-0.12, 0.75], [-0.75, 0.11], [0.28, 0.53], [-1.25, 0.02], [-0.1, 0.65], [0.3, 0.02], [-0.55, 0.6]];

	// ─── The categories ───
	const CATS = [
		['site', 'On the site now', 'The waiting moves dots.js plays today, each on the real dots in its own card.'],
		['light', 'Light', 'For the theme switch: light.'],
		['dark', 'Dark', 'For the theme switch: dark.'],
		['auto', 'Automatic', 'For the theme switch: follows the phone.'],
		['lighting', 'Light and shadow', 'Fake lighting: lamps, sun and spotlights casting shadows, balls shaded by where the light is.'],
		['principles', 'Principles of animation', 'The twelve principles, one scene each.'],
		['maths', 'Maths', 'Curves, number patterns and chaos.'],
		['physics', 'Physics', 'Physical phenomena, most of them simulated.'],
		['sphere', 'On the sphere', 'The dots on their invisible sphere, the ring its equator: bigger and brighter in front.'],
		['shapes', 'Shape shifting', 'The dots turn into a shape for a moment, then back into dots.'],
		['sports', 'Sports', 'Pool first, then the rest, on a floor in perspective where there is one.'],
		['motion', 'Motion modes', 'For the motion switch: most, middle, least.']
	];

	// The moves on the site (dots.js), described from docs/design/dots-motion-spec.md §8.
	const SITE = {
		cruise: 'Clockwise along the ring with a gentle bob.',
		splat: 'Rises, falls faster and faster, squishes on landing, wobbles back to round.',
		flatten: 'As if a ball rolls over it: pressed into a smear, springs back.',
		hop: 'Crouch, spring up stretched, hang, land with a squash.',
		dive: 'A hop, but below the ground.',
		shoot: 'Pulls back, bursts most of a lap, overshoots and settles.',
		comet: 'A bigger shooting star, with a trail.',
		over: 'Winds up, arcs over the top through the middle, lands opposite.',
		under: 'The same, underneath.',
		tilt: 'Two laps on a tilted orbit.',
		spiral: 'Circles while climbing to the top and back.',
		settle: 'Eases to a stop, breathes, picks back up.',
		weave: 'Weaves up and down while orbiting.',
		reverse: 'A brief backpedal, then clockwise again.',
		wobble: 'An unsteady, tipsy path.',
		zigzag: 'Sharp up and down switchbacks.',
		drop: 'Slow rise, sudden fall, big landing squash with a flash.',
		jitter: 'Vibrates as it charges, then dashes.',
		shadows: 'A tilted floor; two dots bounce, the other two are their shadows.',
		stars: 'Spread over the sphere, each twinkling, the sky turning slowly.',
		blackhole: 'A ringed core appears; the dots spiral in and burst back out.',
		moons: 'Two hosts orbit with a small moon each.',
		steamroll: 'An invisible ball rolls round and flattens each dot in turn.',
		ball: 'Four spots on an invisible spinning ball.',
		conga: 'Single file behind a leader, two laps.',
		atom: 'Each on its own tilted orbit, like electrons.',
		burst: 'Gather, crouch together, explode apart and settle.',
		juggle: 'Arc over the top one after another.',
		wave: 'A stadium wave lifts each in turn.',
		binary: 'Two pairs spinning round themselves while orbiting.',
		collide: 'Pairs rush together, flash, bounce apart.',
		polar: 'Spiral up to the top, swirl, come back down.',
		pool: 'A tilted table: two balls and their shadows off the cushion.',
		merge: 'Particle pairs pop in, split, loop and recombine.'
	};

	const LIB = [
		// ── Light ──
		{ tag: 'AL1', cat: 'light', name: 'Fireworks over the horizon', note: 'A rocket climbs from behind the horizon, slowing, and bursts; the sparks fall and flicker out while the four drift down like twinkling stars and set. Somewhere new each time.', show: 4.8, fade: [0.03, 0.9], run(p, R) {
			const S = this.show, T = p * S, launch = 0.95, bx = 50 + (R[0] - 0.5) * 24, by = 27 + R[1] * 9, fx = [], dots = [];
			if (T < launch) {
				const q = easeOut(T / launch);
				for (let i = 0; i < 4; i++) dots.push(pt(bx + nz(T * 6, R[3]) * 1.5 * (1 - q), lerp(74, by, q) + i * 1.8 * (1 - q), { s: 0.8 - i * 0.12, a: 1 - i * 0.2, g: 0.5 }));
			} else {
				const t = T - launch, out = 1 - Math.exp(-5 * t);
				if (t < 0.18) fx.push({ c: [bx, by, 3 + 30 * t / 0.18], a: 0.5 * (1 - t / 0.18) });
				for (let i = 0; i < 4; i++) {
					const ang = Math.PI / 4 + i * Math.PI / 2 + (R[4 + i] - 0.5) * 0.7, v = 17 + R[8 + i] * 6, tw = twinkle(p, R[12 + i % 4], 3.5), settle = seg(t, 0.8, 2);
					dots.push(pt(bx + Math.cos(ang) * v * out + nz(t * 1.5, R[i]) * settle, by + Math.sin(ang) * v * out + 4 * t + 2 * (1 - Math.exp(-2 * t)), { s: lerp(1, 0.5 + 0.5 * tw, settle), a: lerp(1, 0.4 + 0.6 * tw, settle), g: lerp(1, tw, settle) }));
				}
				for (let j = 0; j < 14; j++) {
					const ang = j * TAU / 14 + R[(j % 8) + 4] * 0.5, v = 24 + 10 * hash01(j, R[2]), fl = twinkle(t, j * 0.37, 6), life = clamp(1 - t / (1.3 + 0.7 * hash01(j, 7)));
					if (life > 0) fx.push({ c: [bx + Math.cos(ang) * v * out, by + Math.sin(ang) * v * out + 9 * t * t + 2 * t, 0.4 + 0.9 * life * fl], a: life * (0.4 + 0.6 * fl) });
				}
			}
			return { dots, fx: fx.concat(horizonGround()), trail: T < launch + 0.4 };
		} },
		{ tag: 'AL4', cat: 'light', name: 'Prism', note: 'A beam of four slows as it enters the glass, as light does, and fans out the far side, each ray settling into its angle and shimmering.', show: 3.4, fade: [0.04, 0.9], run(p, R) {
			const tilt = (R[0] - 0.5) * 0.25, dots = [];
			for (let i = 0; i < 4; i++) {
				const d = i * 0.035, enter = seg(p, d, 0.3 + d), inside = seg(p, 0.3 + d, 0.46 + d), out = seg(p, 0.46 + d, 0.82 + d * 0.5);
				let x, y, g = 0.3;
				if (inside === 0) { x = lerp(12, 44, enter); y = lerp(58 - tilt * 30, 50, enter); }
				else if (out === 0) { x = lerp(44, 55, inside); y = 50 - inside; }
				else { const ang = (-24 + i * 16) * Math.PI / 180 + tilt * 0.3, L = 30 * backOut(out, 1.1); x = 55 + L * Math.cos(ang); y = 49 + L * Math.sin(ang); g = 0.4 + 0.6 * twinkle(p, i * 0.2, 3); }
				dots.push(pt(x, y, { s: 0.85, g }));
			}
			return { dots, fx: [{ l: 'M50 36L62 59L38 59Z', a: 0.55, w: 3, keep: true }], trail: true };
		} },
		{ tag: 'AL5', cat: 'light', name: 'Lightning', note: 'The four gather into a charged cloud, crackling, then strike down a new zigzag each time; a double flash, and sparks jump from where it hit.', show: 2.6, fade: [0.03, 0.88], run(p, R) {
			const Z = [[50 + (R[0] - 0.5) * 14, 20]];
			for (let k = 1; k <= 4; k++) Z.push([50 + (R[k] - 0.5) * 24, 20 + k * 12]);
			Z.push([50 + (R[5] - 0.5) * 10, 78]);
			const T = p * this.show, at = 0.85, f1 = T > at + 0.12 && T < at + 0.22, f2b = T > at + 0.32 && T < at + 0.38, fx = [], dots = [], G = Z[5];
			if (T > at && T < at + 0.6) fx.push({ l: poly(Z), a: f1 || f2b ? 1 : 0.25, w: f1 || f2b ? 3 : 1.2 });
			if (f1 || f2b) fx.push({ c: [50, 50, 38], a: f1 ? 0.18 : 0.1 });
			for (let i = 0; i < 4; i++) {
				let x, y, s = 0.75, g = 0.3;
				if (T < at) { const c = T / at; x = Z[0][0] + (i - 1.5) * 4 * (1 - c * 0.7) + 2.5 * nz(T * 6, R[6 + i]); y = Z[0][1] + 2 * nz(T * 5, R[10 + i]); g = c * c; s = 0.6 + 0.35 * c; }
				else if (T < at + 0.14) { [x, y] = along(Z, clamp((T - at) / 0.12 - i * 0.08)); g = 1; s = 0.8; }
				else { const t = T - at - 0.14, ang = -Math.PI / 2 + (i - 1.5) * 0.55, v = 36 + 8 * R[12 + i % 4]; x = G[0] + Math.cos(ang) * v * 0.4 * t; y = Math.min(G[1], G[1] + Math.sin(ang) * v * t + 60 * t * t); s = 0.6; g = Math.max(0, 1 - t); }
				dots.push(pt(x, y, { s, g }));
			}
			return { dots, fx, trail: T > at };
		} },
		{ tag: 'AL6', cat: 'light', name: 'Sunbeams', note: 'A breathing sun at the top throws three beams that sway; a mote of light rides out along each and fades.', show: 4, loop: true, run(p) {
			const br = 1 + 0.06 * Math.sin(TAU * p * 2), fx = corona(50, 24, dotR(2) * br, 1), dots = [pt(50, 24, { s: 2 * br })];
			for (let i = 0; i < 3; i++) {
				const a = Math.PI / 2 + (i - 1) * 0.55 + 0.12 * Math.sin(TAU * p + i * 2.1), u = (p * 2 + i / 3) % 1;
				fx.push({ l: `M50 24L${f2(50 + 50 * Math.cos(a))} ${f2(24 + 50 * Math.sin(a))}`, a: 0.14 + 0.06 * Math.sin(TAU * (p * 2 + i / 3)), w: 5 });
				dots.push(pt(50 + (10 + 34 * u) * Math.cos(a), 24 + (10 + 34 * u) * Math.sin(a), { s: 0.5 + 0.2 * pulse(u), a: pulse(u), g: 0.8 }));
			}
			return { dots, fx, trail: false };
		} },
		{ tag: 'AL7', cat: 'light', name: 'Lighthouse', note: 'A beam turns round a tower over a moving sea; each boat lights up as it is swept.', show: 4, loop: true, run(p) {
			const ang = TAU * p - Math.PI / 2;
			let sea = ''; for (let x = 14; x <= 86; x += 3) sea += (sea ? 'L' : 'M') + x + ' ' + f2(72 + 1.4 * Math.sin(x * 0.35 - TAU * p * 3));
			const fx = [{ l: 'M47 72L49 44L51 44L53 72Z', a: 0.5, w: 2, keep: true }, { pf: cone([50, 44], ang, 0.16, 48), a: 0.1 }, { l: sea, a: 0.35, w: 1.5 }], dots = [pt(50, 42, { s: 0.9, g: 1 })];
			for (const [x0, y0] of [[26, 66], [70, 64], [62, 30]]) { const fl = inCone([50, 44], ang, 0.25, [x0, y0]); dots.push(pt(x0 + Math.sin(TAU * p * 2 + x0) * 0.6, y0 + Math.sin(TAU * p * 3 + x0) * 0.8, { s: 0.6 + 0.5 * fl, a: 0.3 + 0.7 * fl, g: fl })); }
			return { dots, fx, trail: false };
		} },
		{ tag: 'AL8', cat: 'light', name: 'Sparkler', note: 'A sparkler writes a loop in the air, spitting sparks that arc and die.', show: 3, loop: true, run(p) {
			const S = this.show, t = p * S, at = (tt) => { const u = ((tt / S) % 1 + 1) % 1; return [50 + 16 * Math.sin(TAU * u), 46 + 10 * Math.sin(TAU * 2 * u)]; }, [hx, hy] = at(t), fx = [], NSL = Math.round(S / 0.03);
			for (let j = Math.floor(t / 0.03) - 18; j <= Math.floor(t / 0.03); j++) {
				const age = t - j * 0.03; if (age < 0 || age > 0.55) continue;
				const jj = ((j % NSL) + NSL) % NSL, [bx, by] = at(j * 0.03), a = hash01(jj, 1) * TAU, v = 14 + 18 * hash01(jj, 2);
				fx.push({ c: [bx + Math.cos(a) * v * age, by + Math.sin(a) * v * age + 40 * age * age, 0.7 * (1 - age / 0.55)], a: 1 - age / 0.55 });
			}
			const dots = [pt(hx, hy, { s: 0.9, g: 1 })];
			for (let i = 1; i < 4; i++) { const ph = (p * 5 + i / 3) % 1, age = ph * 0.6, [bx, by] = at(t - age), a = hash01(Math.floor(p * 5 + i / 3) % 5, i) * TAU; dots.push(pt(bx + Math.cos(a) * 30 * age, by + Math.sin(a) * 30 * age + 50 * age * age, { s: 0.55, a: pulse(ph), g: 0.6 })); }
			return { dots, fx: fx.concat([{ l: `M${f2(hx)} ${f2(hy)}L${f2(hx + 4)} ${f2(hy + 26)}`, a: 0.35, w: 1.5 }]), trail: true };
		} },
		// ── Dark ──
		{ tag: 'AD1', cat: 'dark', name: 'Eclipse', note: 'A big glowing sun; a moon as big slides in, slowing, and holds just off centre, leaving a crescent and a breathing corona while stars come out. New stars each time.', show: 4.4, fade: [0.06, 0.9], run(p, R) {
			const app = easeInOut(seg(p, 0.08, 0.55)), Rs = dotR(4.2), tot = seg(p, 0.5, 0.6) * (1 - seg(p, 0.82, 0.92)), br = 1 + 0.05 * Math.sin(TAU * p * 3), mx = lerp(98, 54, app), my = lerp(30, 47.5, app);
			const fx = corona(50, 50, Rs * br, 1 - 0.3 * app + 0.3 * tot), dots = [pt(50, 50, { s: 4.2 })];
			for (let i = 1; i < 4; i++) { const ang = R[i] * TAU, rad = 29 + R[i + 3] * 6, tw = twinkle(p, R[i + 6], 2.5); dots.push(pt(50 + rad * Math.cos(ang), 50 + rad * Math.sin(ang), { s: 0.45 + 0.25 * tw, a: (0.15 + 0.6 * app) * (0.5 + 0.5 * tw), g: tw * app })); }
			fx.push({ bg: [mx, my, Rs * 1.03], top: true }, { o: [mx, my, Rs * 1.03], a: 0.15 + 0.1 * tot, w: 1.2, top: true });
			return { dots, fx, trail: false };
		} },
		{ tag: 'AD2', cat: 'dark', name: 'Black hole', note: 'A disc at a new tilt each time; one by one the dots spiral down it, faster and faster, stretching into streaks, and a ripple goes out when the last is gone.', show: 3.6, fade: [0.03, 0.94], run(p, R) {
			const tilt = (R[0] - 0.5) * 50, ct = Math.cos(tilt * Math.PI / 180), st = Math.sin(tilt * Math.PI / 180), dots = [], vis = seg(p, 0.02, 0.2) * (1 - seg(p, 0.88, 1));
			const fx = [{ e: [50, 50, 16, 4.5, tilt], a: 0.45 * vis, w: 2 }, { e: [50, 50, 10, 2.8, tilt], a: 0.3 * vis, w: 1.5 }, { c: [50, 50, 2.4], a: 0.9 * vis }];
			for (let i = 0; i < 4; i++) {
				const t0 = 0.05 + i * 0.1 + R[1 + i] * 0.05, q = seg(p, t0, t0 + 0.55), e = easeIn(q), ang = -Math.PI / 2 + i * Math.PI / 2 + R[5] * TAU + TAU * 2.4 * e, rad = 38 * (1 - e);
				const lx = rad * Math.cos(ang), ly = rad * Math.sin(ang) * 0.3, tx = -Math.sin(ang), ty = Math.cos(ang) * 0.3;
				dots.push(pt(50 + lx * ct - ly * st, 50 + lx * st + ly * ct, { a: 1 - 0.95 * e, s: 1 - 0.55 * e, sx: 1 + 1.6 * e, sy: 1 - 0.3 * e, rot: deg(Math.atan2(tx * st + ty * ct, tx * ct - ty * st)), g: 0.6 }));
			}
			const fl = seg(p, 0.84, 0.95); if (fl > 0 && fl < 1) fx.push({ o: [50, 50, 4 + 22 * easeOut(fl)], a: 0.4 * (1 - fl), w: 1.5 });
			return { dots, fx, trail: true };
		} },
		{ tag: 'AD3', cat: 'dark', name: 'Sunset', note: 'A glowing sun sinks behind the horizon, flattening a little as it touches, and the stars come out one by one. New stars each time.', show: 4.8, fade: [0.03, 0.92], run(p, R) {
			const set = easeInOut(seg(p, 0.04, 0.58)), cy = lerp(36, 84, set), Rs = dotR(3.2), near = clamp(1 - Math.abs(cy - 62) / 12), dots = [], fx = corona(50, cy, Rs, 1 - 0.6 * set);
			const star = (i) => [24 + R[i] * 52, 22 + R[i + 4] * 30], starA = (i) => seg(p, 0.45 + i * 0.07 + R[8 + i] * 0.05, 0.62 + i * 0.07 + R[8 + i] * 0.05);
			if (p < 0.66) dots.push(pt(50, cy, { s: 3.2, sx: 1 + 0.06 * near, sy: 1 - 0.12 * near }));
			else { const [x, y] = star(0), tw = twinkle(p, R[12], 3); dots.push(pt(x, y, { s: 0.5 + 0.45 * tw, a: starA(3) * (0.45 + 0.55 * tw), g: tw * starA(3) })); }
			for (let i = 1; i < 4; i++) { const [x, y] = star(i), tw = twinkle(p, R[12 + i], 3), A = starA(i - 1); dots.push(pt(x, y, { s: 0.35 + A * (0.15 + 0.45 * tw), a: A * (0.45 + 0.55 * tw), g: tw * A })); }
			return { dots, fx: fx.concat(horizonGround()), trail: false };
		} },
		{ tag: 'AD4', cat: 'dark', name: 'Lights out', note: 'Sparks fly round inside a big round bulb, flickering; one after another they die, drop and bounce to rest at the bottom of the glass.', show: 4.4, fade: [0.03, 0.93], run(p, R) {
			const S = this.show, live = 0.55, fx = [{ l: BIGBULB, a: 0.5, w: 3, keep: true }, { l: BULBBASE, a: 0.5, w: 3, keep: true }];
			const sim = sparks(Math.min(p, live) * S, R), glow = p < live ? 0.7 + 0.3 * nz(p * 40, R[9]) : Math.max(0, 1 - (p - live) / 0.06) * 0.7;
			if (glow > 0) fx.push({ c: [50, 40, 14], a: 0.13 * glow });
			const fl = 67 - 1.5 * K.k - dotR(0.38), REST = [[46.1, fl], [50, fl], [53.9, fl], [48.05, fl - 3.9]];
			const dots = sim.map((o, i) => {
				if (p < live) { const f = Math.sin(p * 97 + i * 13 + 6 * nz(p * 20, R[i])) > -0.3 ? 1 : 0.25; return pt(o.x, o.y, { s: 0.5, a: f, g: f }); }
				const die = live + R[10 + i % 6] * 0.1, tt = Math.max(0, (p - die) * S), [rx, ry] = REST[i];
				if (p < die) return pt(o.x, o.y, { s: 0.5, a: 0.8, g: 0.6 });
				const b = dropBounce(tt, Math.max(0, ry - o.y), 300, 0.45);
				return pt(lerp(o.x, rx, decel(clamp(tt / 0.8))), ry - b.h, { s: lerp(0.5, 0.38, clamp(tt / 0.3)), a: lerp(0.8, 0.45, clamp(tt / 0.3)), g: Math.max(0, 0.6 - tt * 2) });
			});
			return { dots, fx, trail: p < live };
		} },
		{ tag: 'AD5', cat: 'dark', name: 'Night sky', note: 'Four stars in a new sky each time, twinkling as it turns slowly.', show: 5, fade: [0.12, 0.88], run(p, R) {
			const rot = 0.25 * p, c = Math.cos(rot), s = Math.sin(rot);
			return { dots: [0, 1, 2, 3].map((i) => { const sx = 26 + R[i] * 48, sy = 26 + R[i + 4] * 48, tw = Math.pow(twinkle(p, R[i + 8], 2 + i * 0.5), 2); return pt(50 + (sx - 50) * c - (sy - 50) * s, 50 + (sx - 50) * s + (sy - 50) * c, { s: 0.45 + 0.6 * tw, a: 0.35 + 0.65 * tw, g: tw }); }), fx: [], trail: false };
		} },
		{ tag: 'AD6', cat: 'dark', name: 'Fireflies', note: 'Four fireflies wander in the dark, each glowing on and off at its own pace.', show: 6, loop: true, run(p, R) {
			return { dots: [0, 1, 2, 3].map((i) => { const on = Math.pow(Math.max(0, Math.sin(TAU * (p * (2 + (i % 2)) + R[i + 8]))), 4); return pt(50 + 24 * nzl(p, R[i], 1), 50 + 18 * nzl(p, R[i + 4], 1), { s: 0.55 + 0.35 * on, a: 0.12 + 0.88 * on, g: on }); }), fx: [], trail: false };
		} },
		{ tag: 'AD7', cat: 'dark', name: 'Candle out', note: 'A flame flickers, leans in a breath of wind and goes out; a curl of smoke rises and thins.', show: 4.2, fade: [0.06, 0.9], run(p) {
			const t = p * this.show, blow = seg(p, 0.45, 0.55), out = seg(p, 0.53, 0.58), lean = pulse(blow) * 25, fl = 1 + 0.12 * nz(t * 9, 0.3) * (1 - out);
			const fx = [{ l: 'M43 78L43 56L57 56L57 78', a: 0.5, w: 2.5, keep: true }, { l: 'M50 56L50 51', a: 0.6, w: 1.5, keep: true }];
			if (out < 1) fx.push(...corona(50, 45, dotR(1.2), (1 - out) * (0.85 + 0.15 * nz(t * 7, 0.7))));
			const dots = [pt(50 + 1.5 * nz(t * 5, 0.1) * (1 - out) + lean * 0.12, 44, { rot: lean, s: 1.1 * fl * (1 - out), sx: 0.75, sy: 1.5 + 0.3 * pulse(blow), a: 1 - out, g: 1 - out })];
			for (let j = 0; j < 3; j++) { const u = clamp((p - 0.56 - j * 0.06) / 0.38); dots.push(pt(50 + 5 * Math.sin(u * 7 + j * 1.3) * u, 50 - 30 * easeOut(u), { s: 0.35 + 0.7 * u, a: 0.45 * pulse(u) })); }
			return { dots, fx, trail: false };
		} },
		{ tag: 'AD8', cat: 'dark', name: 'Shooting star', note: 'A quiet sky of three stars; once a loop, at a new time and angle, a shooting star streaks across.', show: 4, fade: [0.05, 0.95], run(p, R) {
			const dir = R[1] > 0.5 ? 1 : -1, q = easeInOut(seg(p, 0.3 + R[2] * 0.25, 0.48 + R[2] * 0.25)), x0 = dir > 0 ? 20 : 80, y0 = 22 + R[3] * 14, dx = dir * 54, dy = 18 + R[4] * 12;
			const dots = [pt(x0 + dx * q, y0 + dy * q, { s: 0.9, sx: 1 - 0.3 * pulse(q), sy: 1 + 1.6 * pulse(q), rot: deg(Math.atan2(dy, dx)) + 90, a: pulse(q), g: 1 })];
			for (let i = 1; i < 4; i++) { const tw = twinkle(p, R[5 + i], 2.2); dots.push(pt(26 + R[8 + i] * 48, 30 + R[11 + i] * 40, { s: 0.4 + 0.4 * tw, a: 0.3 + 0.7 * tw, g: tw })); }
			return { dots, fx: [], trail: q > 0 && q < 1 };
		} },
		// ── Automatic ──
		{ tag: 'AA1', cat: 'auto', name: 'Day and night', note: 'A sun and a moon turn round each other, setting behind the horizon in turn; stars come out while the moon is up.', show: 6, loop: true, run(p, R) {
			const th = Math.PI + TAU * p - 0.25 * Math.sin(TAU * p), up = (y) => clamp((50 - y) / 10 + 0.5), sun = [50 + 26 * Math.cos(th), 50 + 26 * Math.sin(th)], moon = [50 - 26 * Math.cos(th), 50 - 26 * Math.sin(th)], night = up(moon[1]);
			const fx = corona(sun[0], sun[1], dotR(1.7), up(sun[1])).concat(horizonGround(50, 14));
			return { dots: [pt(sun[0], sun[1], { s: 1.7 }), pt(moon[0], moon[1], { s: 1.15, g: 0.3 * night, a: 0.5 + 0.5 * night }), pt(30 + R[0] * 14, 24 + R[1] * 10, { s: 0.45, a: 0.85 * night * (0.6 + 0.4 * twinkle(p, R[2], 4)) }), pt(58 + R[3] * 14, 22 + R[4] * 12, { s: 0.4, a: 0.75 * night * (0.6 + 0.4 * twinkle(p, R[5], 5)) })], fx, trail: false };
		} },
		{ tag: 'AA2', cat: 'auto', name: 'Pendulum', note: 'A bob swings between the two sides, lit on the light side and dim on the dark, slowing at each end.', show: 3.2, loop: true, run(p) {
			const ang = 0.62 * Math.cos(TAU * 2 * p), pv = [50, 20], L = 38, bob = [pv[0] + L * Math.sin(ang), pv[1] + L * Math.cos(ang)], light = clamp(-Math.sin(ang) * 2 + 0.5);
			const dots = [pt(bob[0], bob[1], { s: 1.7, g: light, a: 0.45 + 0.55 * light })];
			for (let j = 1; j < 4; j++) dots.push(pt(lerp(pv[0], bob[0], j / 4), lerp(pv[1], bob[1], j / 4), { s: 0.45, a: 0.7 }));
			return { dots, fx: [{ l: `M${pv[0]} ${pv[1]}L${f2(bob[0])} ${f2(bob[1])}`, a: 0.35, w: 1.5 }, { c: [pv[0], pv[1], 1.8], a: 0.7, keep: true }], trail: false };
		} },
		{ tag: 'AA3', cat: 'auto', name: 'The flip', note: 'A bright pair above the line and a dim pair below turn over and trade places, hold, and turn back.', show: 4, loop: true, run(p) {
			const ph = Math.PI * (easeInOut(seg(p, 0.08, 0.38)) + easeInOut(seg(p, 0.58, 0.88)));
			return { dots: [[36, 36], [64, 36], [36, 64], [64, 64]].map(([x, y0], i) => { const y = 50 + (y0 - 50) * Math.cos(ph), top = y < 49.5, depth = Math.sin(ph) * (i < 2 ? 1 : -1); return pt(x, y, { s: (top ? 1.25 : 0.8) * Math.pow(2, 0.5 * K.depth * depth), a: top ? 1 : 0.35, g: top ? 1 : 0 }); }), fx: [{ l: 'M18 50L82 50', a: 0.35, w: 2, keep: true }], trail: false };
		} },
		{ tag: 'AA4', cat: 'auto', name: 'Seasons', note: 'A lit dot circles a tilted axis: high in summer, low in winter.', show: 4, loop: true, run(p) {
			const P = onSphere(0.4 * Math.sin(TAU * p), TAU * p * 2, 0.5, 0, 26);
			return { dots: [sp(P, 1.2, { g: clamp((50 - P.y) / 20 + 0.5) }), pt(50, 50, { s: 1.6, a: 0.6 }), NONE(), NONE()], fx: [{ e: [50, 50, 26, 26 * Math.sin(0.5), 0], a: 0.15, w: 1, keep: true }], trail: true };
		} },
		// ── Light and shadow ──
		{ tag: 'LS1', cat: 'lighting', name: 'Wandering lamp', note: 'A lamp circles low over three balls; their shadows swing round opposite it, longest when it is furthest, and each ball is lit on the side facing it.', show: 6, loop: true, run(p) {
			const th = TAU * p, L = [20 * Math.cos(th), 14 + 4 * Math.sin(TAU * p * 2), 74 + 16 * Math.sin(th)], LP = P3(...L), balls = [[-10, 64], [9, 70], [-1, 86]];
			const fx = [floor()].concat(corona(LP.x, LP.y, dotR(0.9) * LP.k * 0.6, 1)), dots = [wpt(L[0], L[1], L[2], 0.9, { g: 1 })];
			for (const [x, z] of balls) {
				const B = [x, BR(1.3), z], P = P3(...B), d = Math.hypot(L[0] - x, L[1] - B[1], L[2] - z), lit = clamp(1.6 - d / 30);
				fx.push(castShadow(L, B, 1.3, 0.55));
				dots.push(wpt(x, B[1], z, 1.3, { a: 0.4 + 0.6 * lit }));
				fx.push(...shade(P.x, P.y, dotR(1.3) * P.k * 0.6, Math.atan2(LP.y - P.y, LP.x - P.x), lit));
			}
			return { dots, fx, trail: false };
		} },
		{ tag: 'LS2', cat: 'lighting', name: 'Spotlight', note: 'A spotlight sweeps the stage; three dancers hop in place, coming alive and throwing a shadow only while it is on them.', show: 5, loop: true, run(p) {
			const S = [50, 8], a = Math.PI / 2 + 0.42 * Math.sin(TAU * p), fx = [floor(), { pf: cone(S, a, 0.17, 90), a: 0.08 }], dots = [pt(50, 8, { s: 0.8, g: 1 })];
			[-12, 0, 12].forEach((x, i) => {
				const z = 70, f = (p * 4 + i / 3) % 1, b = 28 * f * (1 - f), P = P3(x, BR(1.1) + b, z), lit = clamp(inCone(S, a, 0.17, [P.x, P.y]) * 1.6);
				dots.push(wpt(x, BR(1.1) + b, z, 1.1, { a: 0.18 + 0.82 * lit, g: lit }));
				if (lit > 0.05) fx.push(castShadow([0, 60, 30], [x, BR(1.1) + b, z], 1.1, 0.5 * lit));
			});
			return { dots, fx, trail: false };
		} },
		{ tag: 'LS3', cat: 'lighting', name: 'Sundial', note: 'The sun crosses the sky; three posts cast shadows that swing round and stretch long at sunrise and sunset, and vanish at night.', show: 6, loop: true, run(p) {
			const th = Math.PI + TAU * p, up = -Math.sin(th), SP = [50 + 34 * Math.cos(th), 30 + 34 * Math.sin(th)];
			// The sun sets behind the horizon (the horizon's cover is over it); the
			// posts and their shadows stand in front of it (front, top).
			const fx = (up > 0 ? corona(SP[0], SP[1], dotR(1.4), clamp(up * 3)) : []).concat(horizonGround(30, 24)), dots = [pt(SP[0], SP[1], { s: 1.4, a: clamp(up * 4) })];
			for (const [x, z] of [[-12, 62], [0, 76], [12, 66]]) {
				if (up > 0.03) fx.push(Object.assign(sunShadow([-Math.cos(th), -Math.max(0.08, up), -0.35], [x, 10, z], 0.8, 0.45 * clamp(up * 5)), { top: true }));
				dots.push(stick(P3(x, 0, z), P3(x, 10, z), 0.5, { a: 0.5 + 0.5 * clamp(up * 3) }));
			}
			return { dots, fx, trail: false, front: true };
		} },
		{ tag: 'LS4', cat: 'lighting', name: 'Candlelight', note: 'A flame flickers in the middle of the floor; the dots round it are lit by how close they are, and their long shadows flicker with it.', show: 5, loop: true, run(p, R) {
			const fl = 0.85 + 0.15 * nzl(p, R[0], 6), L = [0, 7 + 0.6 * nzl(p, R[1], 7), 74], LP = P3(...L), fx = [floor()].concat(corona(LP.x, LP.y, dotR(0.9) * LP.k * 0.6 * fl, fl)), dots = [wpt(L[0], L[1], L[2], 0.9 * fl, { sy: 1.4, g: fl })];
			for (let i = 0; i < 3; i++) {
				const a = i * TAU / 3 + 0.3, r = 15 + 4 * nzl(p, R[2 + i], 1), x = r * Math.cos(a), z = 74 + r * 0.8 * Math.sin(a), B = [x, BR(1.1), z], P = P3(...B), lit = fl * clamp(1.4 - r / 26);
				fx.push(castShadow(L, B, 1.1, 0.55 * fl));
				dots.push(wpt(x, B[1], z, 1.1, { a: 0.3 + 0.7 * lit }));
				fx.push(...shade(P.x, P.y, dotR(1.1) * P.k * 0.6, Math.atan2(LP.y - P.y, LP.x - P.x), lit));
			}
			return { dots, fx, trail: false };
		} },
		{ tag: 'LS5', cat: 'lighting', name: 'Torch search', note: 'In the dark a torch beam hunts back and forth; the dots hiding there show only when it finds them, and glint.', show: 6, loop: true, run(p, R) {
			const S = [50, 84], a = -Math.PI / 2 + 0.75 * nzl(p, R[0], 1), fx = [{ pf: cone(S, a, 0.2, 70), a: 0.1 }, { c: [50, 84, 2], a: 0.8 }];
			return { dots: [[30, 40], [64, 30], [70, 56], [40, 26]].map(([x, y], i) => { const lit = Math.pow(inCone(S, a, 0.2, [x, y]), 0.7); return pt(x + nzl(p, R[4 + i], 2) * 1.5, y, { s: 0.7 + 0.3 * lit, a: 0.04 + 0.96 * lit, g: lit }); }), fx, trail: false };
		} },
		{ tag: 'LS6', cat: 'lighting', name: 'Disco ball', note: 'Spots of light wheel across the floor from a turning mirror ball; the dancers flash as a spot passes over them.', show: 4, loop: true, run(p) {
			const fx = [floor(), { o: [50, 18, 4], a: 0.6, w: 1.5 }], spots = [];
			for (let j = 0; j < 7; j++) { const a = TAU * (p + j / 7), x = 22 * Math.cos(a), z = 76 + 18 * Math.sin(a + j), P = P3(x, 0, z); spots.push(P); fx.push({ sh: [P.x, P.y, 3.2 * P.k, 3.2 * P.k * CAM.ch / z], a: 0.25 }); }
			const dots = [pt(50, 18, { s: 0.7, g: 0.6 + 0.4 * twinkle(p, 0, 8) })];
			[-10, 0, 10].forEach((x, i) => { const z = 68 + i * 8, f = (p * 8 + i / 3) % 1, b = 16 * f * (1 - f), P = P3(x, 0, z), hit = Math.max(...spots.map((S) => clamp(1 - Math.hypot(S.x - P.x, S.y - P.y) / 6))); dots.push(wpt(x, BR(1.1) + b, z, 1.1, { a: 0.35 + 0.65 * hit, g: hit })); });
			return { dots, fx, trail: false };
		} },
		{ tag: 'LS7', cat: 'lighting', name: 'Lit sphere', note: 'A light circles a big ball: its highlight follows the light round and the dark side turns away, and its shadow swings on the floor beneath.', show: 5, loop: true, run(p) {
			const la = TAU * p - Math.PI / 2, R = dotR(4), lx = 50 + 34 * Math.cos(la), ly = 48 + 22 * Math.sin(la);
			const fx = [{ sh: [50 - Math.cos(la) * 8, 76, R * 1.2, R * 0.28], a: 0.2 }].concat(shade(50, 48, R, la, 1)).concat(corona(lx, ly, dotR(0.8), 0.9));
			return { dots: [pt(50, 48, { s: 4 }), pt(lx, ly, { s: 0.8, z: Math.sin(la) }), NONE(), NONE()], fx, trail: false };
		} },
		{ tag: 'LS8', cat: 'lighting', name: 'Shadow puppets', note: 'A lamp on the left throws the dots\' shadows on a lit wall; walking towards the lamp, a shadow grows huge and soft.', show: 5, loop: true, run(p, R) {
			const L = [16, 50], W = 82, fx = [{ pf: `M${W} 18L${W + 8} 18L${W + 8} 82L${W} 82Z`, a: 0.12, keep: true }, { pf: cone(L, 0, 0.55, 80), a: 0.05 }, { l: `M${W} 18L${W} 82`, a: 0.4, w: 1.5, keep: true }].concat(corona(L[0], L[1], dotR(1), 1));
			const dots = [pt(L[0], L[1], { s: 1, g: 1 })];
			for (let i = 0; i < 3; i++) {
				const x = 46 + 16 * nzl(p, R[i], 1), y = 36 + i * 14 + 4 * nzl(p, R[3 + i], 1), k = (W - L[0]) / (x - L[0]), sy = L[1] + (y - L[1]) * k, r = dotR(0.9) * k;
				fx.push({ sd: [W + 0.5, sy, r * 0.35, r, 0], a: 0.55 / Math.sqrt(k) });
				dots.push(pt(x, y, { s: 0.9 }));
			}
			return { dots, fx, trail: false };
		} },
		{ tag: 'LS9', cat: 'lighting', name: 'Window light', note: 'Shafts of sunlight slant through a window; dust drifts through them, glinting only while in the light.', show: 8, loop: true, run(p, R) {
			const x0k = (k) => 30 + k * 12 + 3 * Math.sin(TAU * p), fx = [0, 1, 2].map((k) => ({ pf: `M${f2(x0k(k))} 14L${f2(x0k(k) + 6)} 14L${f2(x0k(k) + 26)} 86L${f2(x0k(k) + 20)} 86Z`, a: 0.09 }));
			return { dots: [0, 1, 2, 3].map((i) => { const x = 50 + 26 * nzl(p, R[i], 1), y = 50 + 24 * nzl(p, R[i + 4], 1), xs = (y - 14) / 72 * 20, inShaft = [0, 1, 2].some((k) => x > x0k(k) + xs && x < x0k(k) + xs + 6); return pt(x, y, { s: 0.45 + (inShaft ? 0.25 : 0), a: inShaft ? 1 : 0.15, g: inShaft ? 1 : 0 }); }), fx, trail: false };
		} },
		{ tag: 'LS10', cat: 'lighting', name: 'Long shadows', note: 'The sun hangs low on the horizon; three walkers cross the floor trailing shadows many times their size.', show: 6, loop: true, run(p) {
			const sx = 50 + 20 * Math.sin(TAU * p), fx = corona(sx, 32, dotR(1.6), 0.9).concat(horizonGround(34, 22)), dots = [pt(sx, 32, { s: 1.6 })];
			[0, 1, 2].forEach((i) => { const u = (p + i / 3) % 1, x = lerp(-30, 30, u), z = 56 + i * 12, f = (u * 12) % 1, b = 8 * f * (1 - f), B = [x, BR(1) + b, z]; fx.push(Object.assign(sunShadow([(x - (sx - 50) * 2) / 60, -0.12, 1], B, 1, 0.4), { top: true })); dots.push(wpt(x, B[1], z, 1, { a: pulse(u) })); });
			return { dots, fx, trail: false, front: true };
		} },
		{ tag: 'LS11', cat: 'lighting', name: 'Lightning flash', note: 'Pitch dark; at a new moment each time, a flash shows the dots and their hard shadows for an instant, and an after-glow fades.', show: 4, fade: [0.02, 0.97], run(p, R) {
			const at = 0.25 + R[0] * 0.4, f = (q) => Math.max(0, 1 - Math.abs(p - q) / 0.02), fl = Math.max(f(at), 0.7 * f(at + 0.06)), after = p > at ? Math.exp(-(p - at) * 8) * 0.3 : 0, lit = Math.max(fl, after), L = [(R[1] - 0.5) * 40, 60, 40];
			const fx = [{ l: grid(), a: 0.13 * lit, w: 1 }, { c: [50, 50, 38], a: 0.12 * fl }], dots = [NONE()];
			[-12, 2, 14].forEach((x, i) => { const z = 66 + i * 7 + R[2 + i] * 6, B = [x, BR(1.1), z]; fx.push(castShadow(L, B, 1.1, 0.7 * lit)); dots.push(wpt(x, B[1], z, 1.1, { a: 0.03 + 0.97 * lit, g: fl })); });
			return { dots, fx, trail: false };
		} },
		{ tag: 'LS12', cat: 'lighting', name: 'Into the shadow', note: 'A planet lit from the left throws its shadow to the right; a moon circling it dims as it passes through, and is hidden behind.', show: 5, loop: true, run(p) {
			const R = dotR(2.6), th = TAU * p, mx = 50 + 30 * Math.cos(th), my = 50 + 12 * Math.sin(th), behind = Math.sin(th) < 0, inShadow = mx > 50 && Math.abs(my - 50) < R * 0.9 && !behind ? clamp((mx - 50) / 8) : 0;
			const fx = [{ pd: `M50 ${f2(50 - R)}L92 ${f2(50 - R * 0.8)}L92 ${f2(50 + R * 0.8)}L50 ${f2(50 + R)}Z`, a: 0.25, keep: true }].concat(shade(50, 50, R, Math.PI, 1)).concat(corona(14, 50, dotR(1), 0.8));
			return { dots: [pt(50, 50, { s: 2.6, z: 0 }), pt(mx, my, { s: 0.8, a: (behind && Math.abs(mx - 50) < R ? 0 : 1) * (1 - 0.85 * inShadow), z: behind ? -1 : 1 }), pt(14, 50, { s: 1, g: 1 }), NONE()], fx, trail: false };
		} },
		// ── Principles of animation ──
		{ tag: 'PR1', cat: 'principles', name: 'Squash and stretch', note: 'A ball bounces round the floor: stretched by its speed in the air, squashed flat the instant it lands. Its shadow sharpens as it comes down.', show: 3, loop: true, run(p) {
			const f = (p * 3) % 1, th = TAU * p, x = 18 * Math.cos(th), z = 72 + 16 * Math.sin(th), H = 30, h = H * 4 * f * (1 - f), vy = Math.abs(1 - 2 * f), c = Math.exp(-Math.min(f, 1 - f) * 45);
			let sy = 1 + 0.45 * vy * (1 - c), sx = 1 / Math.sqrt(sy);
			if (c > 0.05) { sx = 1 + 0.55 * c; sy = 1 - 0.45 * c; }
			return { dots: [wpt(x, h + BR(1.6) * sy, z, 1.6, { sx, sy }), NONE(), NONE(), NONE()], fx: [floor(), wsh(x, z, h, 1.6)], trail: false };
		} },
		{ tag: 'PR2', cat: 'principles', name: 'Anticipation', note: 'Top: it pulls back before it dashes, overshoots and wobbles to a stop. Bottom, dimmer: the same trip with no wind-up. Both stroll back.', show: 3, loop: true, run(p) {
			const back = seg(p, 0.02, 0.26), go = seg(p, 0.26, 0.36), stop = seg(p, 0.36, 0.62), ret = seg(p, 0.7, 0.98);
			let x = 30, sx = 1, sy = 1, g = 0.1;
			if (ret > 0) x = lerp(70, 30, easeInOut(ret));
			else if (stop > 0) { const w = Math.exp(-stop * 5) * Math.sin(stop * 14); x = 70 + 3 * w; sx = 1 + 0.25 * w; sy = 1 / sx; }
			else if (go > 0) { x = lerp(24, 70, easeIn(go) * 0.4 + go * 0.6); sx = 1 + 0.9 * pulse(go); sy = 1 / Math.sqrt(sx); g = 1; }
			else { const b = easeOut(back); x = 30 - 6 * b; sx = 1 - 0.28 * b; sy = 1 + 0.3 * b; }
			const plain = ret > 0 ? lerp(70, 30, easeInOut(ret)) : lerp(30, 70, easeInOut(seg(p, 0.26, 0.5)));
			return { dots: [pt(x, 40, { s: 1.3, sx, sy, g }), pt(plain, 62, { s: 1.3, a: 0.45 }), NONE(), NONE()], fx: lanes([40, 62]), trail: go > 0 && go < 1 };
		} },
		{ tag: 'PR3', cat: 'principles', name: 'Staging', note: 'One at a time steps into the middle under a spotlight and hops; the others dim so the eye knows exactly where to look.', show: 6, loop: true, run(p) {
			const h = Math.min(3, Math.floor(p * 4)), q = (p * 4) % 1, dots = [], fx = [];
			for (let i = 0; i < 4; i++) {
				const home = ringAt(i, 25);
				if (i === h) {
					const out = easeInOut(seg(q, 0.05, 0.35)), back = easeInOut(seg(q, 0.7, 0.95)), m = out * (1 - back), hop = pulse(seg(q, 0.42, 0.62)), crouch = pulse(seg(q, 0.34, 0.44)), [x, y] = mix2(home, [50, 52], m);
					dots.push(pt(x, y - 9 * hop, { s: 1 + 0.5 * m, sx: 1 + 0.2 * crouch - 0.1 * hop, sy: 1 - 0.2 * crouch + 0.15 * hop, g: m }));
					fx.push({ c: [x, y, 14], a: 0.12 * m });
				} else dots.push(pt(home[0], home[1], { s: 0.8, a: 0.25 + 0.75 * (1 - easeInOut(seg(q, 0.02, 0.3)) * (1 - easeInOut(seg(q, 0.72, 0.98)))) }));
			}
			return { dots, fx, trail: false };
		} },
		{ tag: 'PR4', cat: 'principles', name: 'Straight ahead and pose to pose', note: 'Top: straight ahead, smooth all the way. Bottom: pose to pose, holding each key pose, then snapping to the next with a little overshoot.', show: 4.2, loop: true, run(p) {
			const sm = LEM(p, 50, 38, 26), k = Math.floor(p * 6), fr = (p * 6) % 1, pose = LEM((k + backOut(seg(fr, 0.78, 1), 1.4)) / 6, 50, 64, 26);
			const fx = [{ l: curve('lem38', 80, (u) => LEM(u, 50, 38, 26)), a: 0.12, w: 1, keep: true }, { l: curve('lem64', 80, (u) => LEM(u, 50, 64, 26)), a: 0.12, w: 1, keep: true }];
			for (let j = 0; j < 6; j++) { const [x, y] = LEM(j / 6, 50, 64, 26); fx.push({ c: [x, y, 1.2], a: 0.35, keep: true }); }
			return { dots: [pt(sm[0], sm[1], { g: 0.4 }), pt(pose[0], pose[1], { g: fr > 0.78 ? 0.8 : 0 }), NONE(), NONE()], fx, trail: true };
		} },
		{ tag: 'PR5', cat: 'principles', name: 'Follow through', note: 'The leader stops dead; the ones behind carry on, overshoot and spring back, each a little later. Then the same coming home.', show: 4.4, loop: true, run(p) {
			const S = this.show, T = p * S, dt = 1 / 120, lead = (t) => { const u = t / S; return lerp(34, 70, easeIn(seg(u, 0, 0.12))) - 36 * easeIn(seg(u, 0.5, 0.62)); }, xs = [34, 27.5, 21, 14.5], vs = [0, 0, 0, 0];
			for (let s = 0, n = Math.floor(T / dt); s < n; s++) { xs[0] = lead(s * dt); for (let i = 1; i < 4; i++) { const acc = 170 * (xs[i - 1] - 6.5 - xs[i]) - 9 * vs[i]; vs[i] += acc * dt; xs[i] += vs[i] * dt; } }
			return { dots: xs.map((x, i) => pt(x, 50, { s: [1.3, 1.05, 0.85, 0.65][i], a: [1, 0.85, 0.7, 0.55][i] })), fx: [], trail: false };
		} },
		{ tag: 'PR6', cat: 'principles', name: 'Slow in and slow out', note: 'Top: eased, gathering speed and slowing at each end (its marks bunch up there). Bottom, dimmer: even speed all the way.', show: 3, loop: true, run(p) {
			const go = p < 0.5 ? p * 2 : 2 - p * 2, fx = lanes([40, 62]);
			for (let j = 0; j <= 8; j++) fx.push({ c: [lerp(26, 74, easeInOut(j / 8)), 46, 0.9], a: 0.4, keep: true }, { c: [lerp(26, 74, j / 8), 68, 0.9], a: 0.4, keep: true });
			return { dots: [pt(lerp(26, 74, easeInOut(go)), 40), pt(lerp(26, 74, go), 62, { a: 0.5 }), NONE(), NONE()], fx, trail: true };
		} },
		{ tag: 'PR7', cat: 'principles', name: 'Arcs', note: 'Things move on arcs, not straight lines: a juggler\'s fountain of four, high over and low back, squashing at each catch.', show: 3, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => { const ph = TAU * (p * 2 + i / 4), up = Math.sin(ph), c = Math.exp(-Math.abs(up) * 12); return pt(50 - 22 * Math.cos(ph), up > 0 ? 64 - 34 * up : 64 - 4 * up, { sx: 1 + 0.3 * c, sy: 1 - 0.25 * c, g: up > 0.8 ? 0.6 : 0 }); }), fx: [], trail: true };
		} },
		{ tag: 'PR8', cat: 'principles', name: 'Secondary action', note: 'The main dot hops round the floor; a balloon on a string follows a beat behind and sways, adding life without stealing the show.', show: 4, loop: true, run(p) {
			const pos = (pp) => { const th = TAU * pp; return [16 * Math.cos(th), 70 + 14 * Math.sin(th)]; }, [x, z] = pos(p), f = (p * 8) % 1, hop = 16 * f * (1 - f), c = Math.exp(-Math.min(f, 1 - f) * 30);
			const [lx, lz] = pos(p - 0.03), bx = lx + Math.sin(TAU * p * 4 - 1) * 2.5, by = 24 + 1.5 * Math.sin(TAU * p * 8 - 1.5), W = P3(x, hop + BR(1.3), z), B = P3(bx, by, lz);
			return { dots: [wpt(x, hop + BR(1.3) * (1 - 0.3 * c), z, 1.3, { sx: 1 + 0.3 * c, sy: 1 - 0.3 * c }), wpt(bx, by, lz, 0.9, { g: 0.4 }), NONE(), NONE()], fx: [floor(), wsh(x, z, hop, 1.3), wsh(bx, lz, by, 0.9, 0.12), { l: `M${f2(W.x)} ${f2(W.y)}L${f2(B.x)} ${f2(B.y)}`, a: 0.35, w: 1 }], trail: false };
		} },
		{ tag: 'PR9', cat: 'principles', name: 'Timing', note: 'The same trip at four timings, quick, brisk, easy and slow: timing alone says how light or heavy each one is.', show: 4, loop: true, run(p) {
			const ys = [32, 44, 56, 68];
			return { dots: [4, 3, 2, 1].map((k, i) => pt(50 - 22 * Math.cos(TAU * p * k), ys[i], { s: [0.6, 0.8, 1, 1.3][i] })), fx: lanes(ys), trail: true };
		} },
		{ tag: 'PR10', cat: 'principles', name: 'Exaggeration', note: 'Left: a true-to-life bounce. Right: pushed further, higher and squashier, with a smack each time it lands.', show: 2.6, loop: true, run(p) {
			const f = (p * 2) % 1, c = Math.exp(-Math.min(f, 1 - f) * 40), fx = [floor(), wsh(-12, 70, 14 * 4 * f * (1 - f), 1.3), wsh(12, 70, 36 * 4 * f * (1 - f), 1.3)];
			const ball = (x, H, k) => { const h = H * 4 * f * (1 - f), v = Math.abs(1 - 2 * f); let sy = 1 + 0.5 * k * v * (1 - c), sx = 1 / Math.sqrt(sy); if (c > 0.05) { sx = 1 + 0.7 * k * c; sy = 1 / (1 + 0.7 * k * c); } return wpt(x, h + BR(1.3) * sy, 70, 1.3, { sx, sy }); };
			if (c > 0.4) { const P = P3(12, 0, 70); fx.push({ sh: [P.x, P.y, 14 * c, 4 * c], a: 0.25 * c }); }
			return { dots: [ball(-12, 14, 0.4), ball(12, 36, 1.3), NONE(), NONE()], fx, trail: false };
		} },
		{ tag: 'PR11', cat: 'principles', name: 'Solid drawing', note: 'Four dots at the corners of a spinning tetrahedron: depth alone makes it read as a solid.', show: 5, loop: true, run(p) {
			const P = TETRA.map(([x, y, z]) => { const [X, Y, Z] = rot3(x * 28, y * 28, z * 28, 0.5, TAU * p); return { x: 50 + X, y: 50 + Y, z: Z / 28 }; }), fx = [];
			for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) fx.push({ l: `M${f2(P[i].x)} ${f2(P[i].y)}L${f2(P[j].x)} ${f2(P[j].y)}`, a: 0.1 + 0.2 * ((P[i].z + P[j].z) / 2 + 1) / 2, w: 1.5 });
			return { dots: P.map((q) => sp(q, 0.9)), fx, trail: false };
		} },
		{ tag: 'PR12', cat: 'principles', name: 'Appeal', note: 'Two eyes, two cheeks and a smile: a face that glances about in quick darts, bobs and blinks, sometimes twice.', show: 4.4, loop: true, reroll: true, run(p, R) {
			const dart = (a, b, t0) => lerp(a, b, easeInOut(seg(p, t0, t0 + 0.05)));
			let look = dart(0, (R[0] - 0.5) * 7, 0.15); look = dart(look, (R[1] - 0.5) * 7, 0.45); look = dart(look, 0, 0.8);
			const b1 = 0.3 + R[2] * 0.25, blink = Math.min(1, Math.abs(p - b1) / 0.025, R[3] > 0.5 ? Math.abs(p - b1 - 0.07) / 0.02 : 1);
			const bob = Math.sin(TAU * p * 2) * 1.5, tilt = Math.sin(TAU * p) * 5, c = Math.cos(tilt * Math.PI / 180), s = Math.sin(tilt * Math.PI / 180), P = (x, y) => [50 + (x - 50) * c - (y - 50) * s, 50 + (x - 50) * s + (y - 50) * c + bob];
			const e1 = P(42 + look, 44), e2 = P(58 + look, 44), k1 = P(35, 56), k2 = P(65, 56), m0 = P(41, 57), m1 = P(50 + look * 0.3, 65), m2 = P(59, 57);
			return { dots: [pt(e1[0], e1[1], { s: 1.2, sy: 0.1 + 0.9 * blink, rot: tilt }), pt(e2[0], e2[1], { s: 1.2, sy: 0.1 + 0.9 * blink, rot: tilt }), pt(k1[0], k1[1], { s: 0.8, a: 0.35 }), pt(k2[0], k2[1], { s: 0.8, a: 0.35 })], fx: [{ l: `M${f2(m0[0])} ${f2(m0[1])}Q${f2(m1[0])} ${f2(m1[1])} ${f2(m2[0])} ${f2(m2[1])}`, a: 0.8, w: 3 }], trail: false };
		} },
		// ── Maths ──
		{ tag: 'MA1', cat: 'maths', name: 'Lissajous 3 : 2', note: 'Three swings across for every two up and down; the four chase each other round the figure.', show: 5, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = LIS(p - i * 0.03); return pt(x, y, { s: 1 - 0.15 * i, a: 1 - 0.2 * i, g: i === 0 ? 0.6 : 0 }); }), fx: [{ l: curve('lis', 160, LIS), a: 0.1, w: 1, keep: true }], trail: true };
		} },
		{ tag: 'MA2', cat: 'maths', name: 'Rose curve', note: 'r = cos 2θ: four petals, one dot to a petal, each slowing at the tip.', show: 5, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = ROSE(p + i / 4); return pt(x, y, { g: 0.4 }); }), fx: [{ l: curve('rose', 160, ROSE), a: 0.12, w: 1, keep: true }], trail: true };
		} },
		{ tag: 'MA3', cat: 'maths', name: 'Spirograph', note: 'A wheel rolls inside a ring with a pen in it: the hypotrochoid draws itself.', show: 9, fade: [0.02, 0.93], run(p) {
			const [x, y] = SPIRO(p), t = TAU * 11 * p, cx = 50 + 19 * Math.cos(t), cy = 50 + 19 * Math.sin(t);
			return { dots: [pt(x, y, { s: 0.7, g: 0.8 }), pt(cx, cy, { s: 0.4, a: 0.5 }), NONE(), NONE()], fx: [{ o: [50, 50, 30], a: 0.12, w: 1, keep: true }, { o: [cx, cy, 11], a: 0.25, w: 1 }, { l: `M${f2(cx)} ${f2(cy)}L${f2(x)} ${f2(y)}`, a: 0.2, w: 1 }, { l: curveTo(700, SPIRO, p), a: 0.45, w: 1 }], trail: false };
		} },
		{ tag: 'MA4', cat: 'maths', name: 'Sunflower', note: 'Each new seed 137.5° round from the last, the golden angle, popping in: the spirals of a sunflower appear.', show: 6, fade: [0.02, 0.92], run(p) {
			const F = p * 90, N = Math.floor(F), GA = 137.508 * Math.PI / 180, at = (k) => { const r = 3.5 * Math.sqrt(k), t = k * GA; return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; }, fx = [];
			for (let k = 0; k < Math.max(0, N - 4); k++) { const [x, y] = at(k); fx.push({ c: [x, y, 1.1 * clamp(backOut(clamp((F - k) / 3)), 0, 1.3)], a: 0.45 }); }
			return { dots: [0, 1, 2, 3].map((j) => { const [x, y] = at(Math.max(0, N - 1 - j)); return pt(x, y, { s: 0.9 - 0.12 * j, g: j === 0 ? 0.8 : 0.2 }); }), fx, trail: false };
		} },
		{ tag: 'MA5', cat: 'maths', name: 'Fourier epicycles', note: 'Four circles, each turning on the last at its own speed; their tip draws a shape that trails away behind it.', show: 6, loop: true, run(p) {
			const tips = epiTips(p), fx = []; let cx = 50, cy = 50;
			EPI.forEach(([r], i) => { fx.push({ o: [cx, cy, r], a: 0.18, w: 1 }); [cx, cy] = tips[i]; });
			fx.push({ l: curveWin(180, (u) => epiTips(u)[3], p - 0.7, p), a: 0.5, w: 1.5 });
			return { dots: tips.map((q, i) => pt(q[0], q[1], { s: i === 3 ? 0.9 : 0.5, a: i === 3 ? 1 : 0.6, g: i === 3 ? 0.7 : 0 })), fx, trail: false };
		} },
		{ tag: 'MA6', cat: 'maths', name: 'Travelling wave', note: 'A sine wave runs across while the dots only bob up and down, like corks: the wave moves, the water does not.', show: 3, loop: true, run(p) {
			const wy = (x) => 50 + 12 * Math.sin((x - 18) / 64 * TAU * 1.5 - TAU * p * 2);
			let d = ''; for (let x = 16; x <= 84; x += 2) d += (d ? 'L' : 'M') + x + ' ' + f2(wy(x));
			return { dots: [26, 40, 54, 68].map((x) => pt(x, wy(x), { g: 0.3 })), fx: [{ l: d, a: 0.3, w: 1.5 }], trail: false };
		} },
		{ tag: 'MA7', cat: 'maths', name: 'Times table', note: 'Thirty points on a circle, each joined to the point at times-n: a cardioid at times 2, opening into new shapes as n grows and closing again.', show: 8, loop: true, run(p) {
			const N = 30, m = 2 + 3 * easeInOut(p < 0.5 ? p * 2 : 2 - p * 2), at = (k) => { const t = -Math.PI / 2 + TAU * k / N; return [50 + 33 * Math.cos(t), 50 + 33 * Math.sin(t)]; };
			let d = ''; for (let k = 0; k < N; k++) { const A = at(k), B = at(k * m); d += `M${f2(A[0])} ${f2(A[1])}L${f2(B[0])} ${f2(B[1])}`; }
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = at((p * N + i * N / 4) % N); return pt(x, y, { s: 0.7 }); }), fx: [{ l: d, a: 0.25, w: 0.8 }], trail: false };
		} },
		{ tag: 'MA8', cat: 'maths', name: 'Golden spiral', note: 'Out along a logarithmic spiral, gathering speed and growing as they go.', show: 4, fade: [0.03, 0.9], run(p) {
			return { dots: [0, 1, 2, 3].map((i) => { const v = clamp(p * 1.1 - i * 0.05), u = easeIn(v) * 0.7 + v * 0.3, [x, y] = GSP(u); return pt(x, y, { s: 0.4 + 0.9 * u, a: 1 - 0.18 * i, g: i === 0 ? 0.6 : 0 }); }), fx: [{ l: curve('gsp', 160, GSP), a: 0.12, w: 1, keep: true }], trail: true };
		} },
		{ tag: 'MA9', cat: 'maths', name: 'Infinity', note: "Bernoulli's lemniscate: a chase round the figure of eight.", show: 3.6, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = LEM(p - i * 0.05, 50, 50, 32); return pt(x, y, { s: 1 - 0.12 * i, g: i === 0 ? 0.6 : 0 }); }), fx: [{ l: curve('lem50', 120, (u) => LEM(u, 50, 50, 32)), a: 0.1, w: 1, keep: true }], trail: true };
		} },
		{ tag: 'MA10', cat: 'maths', name: 'Bézier curve', note: "De Casteljau's construction: points sliding along lines between lines draw the curve, there and back.", show: 5, loop: true, run(p) {
			const t = easeInOut(p < 0.5 ? p * 2 : 2 - p * 2), L1 = [0, 1, 2].map((i) => mix2(BZ[i], BZ[i + 1], t)), L2 = [0, 1].map((i) => mix2(L1[i], L1[i + 1], t)), P = mix2(L2[0], L2[1], t);
			const fx = [{ l: poly(BZ), a: 0.15, w: 1, keep: true }, { l: poly(L1), a: 0.3, w: 1 }, { l: poly(L2), a: 0.45, w: 1 }, { l: curveTo(80, bez3, t), a: 0.7, w: 2 }].concat(BZ.map((q) => ({ c: [q[0], q[1], 1.3], a: 0.4, keep: true })));
			return { dots: [pt(P[0], P[1], { g: 0.8 }), pt(L2[0][0], L2[0][1], { s: 0.5, a: 0.7 }), pt(L2[1][0], L2[1][1], { s: 0.5, a: 0.7 }), pt(L1[1][0], L1[1][1], { s: 0.4, a: 0.5 })], fx, trail: false };
		} },
		{ tag: 'MA11', cat: 'maths', name: 'Cardioid', note: 'A wheel rolls round another the same size; a point on it traces a heart that trails away behind.', show: 4.4, loop: true, run(p) {
			const [x, y] = CARD(p), t = TAU * p, cx = 50 + 18 * Math.cos(t), cy = 50 + 18 * Math.sin(t);
			return { dots: [pt(x, y, { g: 0.8 }), pt(cx, cy, { s: 0.4, a: 0.5 }), NONE(), NONE()], fx: [{ o: [50, 50, 9], a: 0.2, w: 1, keep: true }, { o: [cx, cy, 9], a: 0.25, w: 1 }, { l: curveWin(120, CARD, p - 0.75, p), a: 0.5, w: 1.2 }], trail: false };
		} },
		{ tag: 'MA12', cat: 'maths', name: 'Binary counter', note: 'Four bits count from 0 to 15: lit is 1, dim is 0, each flip a little hop.', show: 8, loop: true, run(p) {
			const n = Math.min(15, Math.floor(p * 16)), fr = (p * 16) % 1;
			return { dots: [0, 1, 2, 3].map((i) => { const bit = (n >> (3 - i)) & 1, prev = (((n + 15) % 16) >> (3 - i)) & 1, hop = bit !== prev ? pulse(fr / 0.3) : 0; return pt(32 + i * 12, 50 - 6 * hop, { s: bit ? 1.3 : 0.6, a: bit ? 1 : 0.3, g: bit, sy: 1 + 0.2 * hop }); }), fx: [], trail: false };
		} },
		{ tag: 'MA13', cat: 'maths', name: 'Harmonics', note: 'One, two, three and four laps in the same time: out of step all the way round, together again at the end.', show: 5, loop: true, run(p) {
			const rs = [10, 17, 24, 31], fx = rs.map((r) => ({ o: [50, 50, r], a: 0.08, w: 1, keep: true }));
			const dots = rs.map((r, i) => { const a = -Math.PI / 2 + TAU * p * (i + 1), x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a); fx.push({ l: `M50 50L${f2(x)} ${f2(y)}`, a: 0.15, w: 1 }); return pt(x, y, { s: 0.8 }); });
			return { dots, fx, trail: true };
		} },
		{ tag: 'MA14', cat: 'maths', name: 'Chaos game', note: 'Jump halfway towards a random corner, again and again: Sierpinski\'s triangle comes out of chance. Different every time.', show: 6, fade: [0.02, 0.92], run(p, R) {
			const V = [0, 1, 2].map((k) => ringAt(0, 33, k * TAU / 3));
			let seed = Math.floor(R[0] * 1e6) + 1, x = 50, y = 50, last = 0; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647, fx = [];
			for (let k = 0, N = Math.floor(p * 220); k < N; k++) { last = Math.floor(rand() * 3); x = (x + V[last][0]) / 2; y = (y + V[last][1]) / 2; if (k > 4) fx.push({ c: [x, y, 0.7], a: 0.5 }); }
			return { dots: [pt(x, y, { s: 0.8, g: 0.8 })].concat(V.map((v, i) => pt(v[0], v[1], { s: 0.7, a: i === last ? 1 : 0.4, g: i === last ? 0.6 : 0 }))), fx, trail: false };
		} },
		{ tag: 'MA15', cat: 'maths', name: 'Galton board', note: 'Balls bounce left or right off every peg at random and pile up in the bins: chance makes a bell curve.', show: 6, fade: [0.02, 0.93], run(p, R) {
			const ROWS = 5, peg = (r, j) => [50 + (j - r / 2) * 8, 26 + r * 8], seed = Math.floor(R[0] * 1000), fx = [];
			for (let r = 0; r < ROWS; r++) for (let j = 0; j <= r; j++) { const [x, y] = peg(r, j); fx.push({ c: [x, y, 1.1], a: 0.4, keep: true }); }
			for (let k = 0; k <= ROWS + 1; k++) fx.push({ l: `M${50 + (k - 3) * 8} 64L${50 + (k - 3) * 8} 80`, a: 0.2, w: 1, keep: true });
			const route = (b) => { let j = 0; const pts = [[50, 14]]; for (let r = 0; r < ROWS; r++) { const [x, y] = peg(r, j); pts.push([x, y - 2.8]); if (hash01(seed + b, r) > 0.5) j++; } return { pts, k: j }; };
			const counts = [0, 0, 0, 0, 0, 0];
			for (let b = 0; b < 18; b++) counts[route(b + 100).k]++;
			counts.forEach((n, k) => { for (let m = 0; m < n; m++) fx.push({ c: [50 + (k - 2.5) * 8, 78 - m * 2.4, 1.1], a: 0.5 }); });
			const dots = [0, 1, 2, 3].map((i) => {
				const { pts, k } = route(i), end = [50 + (k - 2.5) * 8, 78 - counts[k] * 2.4 - 2.4], all = pts.concat([end]), t0 = 0.06 + i * 0.19, q = seg(p, t0, t0 + 0.4), n = all.length - 1, f = q * n, s = Math.min(n - 1, Math.floor(f)), u = f - s;
				if (q <= 0) return pt(50, 14, { s: 0.8, a: seg(p, t0 - 0.05, t0) });
				const [x0, y0] = all[s], [x1, y1] = all[s + 1];
				return pt(lerp(x0, x1, u), lerp(y0, y1, easeIn(u) * 0.7 + u * 0.3) - (s > 0 && s < n - 1 ? 3 * pulse(u) : 0), { s: 0.8, g: q < 1 ? 0.4 : 0 });
			});
			return { dots, fx, trail: false };
		} },
		{ tag: 'MA16', cat: 'maths', name: 'Brachistochrone', note: 'Four balls race down four slopes: straight, curved, steep and a cycloid. The cycloid, the curve of fastest descent, wins.', show: 3.6, fade: [0.03, 0.92], run(p) {
			const B = brach(), t = p * this.show - 0.35, fx = B.path.map((d, i) => ({ l: d, a: i === 3 ? 0.35 : 0.15, w: 1, keep: true }));
			return { dots: B.tracks.map((tr, i) => { const [x, y] = trackAt(tr, t), done = t >= tr.T; return pt(x, y, { s: 0.9, g: done && i === 3 ? 1 : 0.2, a: done && i !== 3 ? 0.6 : 1 }); }), fx, trail: true };
		} },
		{ tag: 'MA17', cat: 'maths', name: 'Trefoil knot', note: 'The simplest true knot, turning in space; the four run along it, over and under themselves.', show: 7, loop: true, run(p) {
			const proj = (s) => { const [x, y, z] = TRE(s), [X, Y, Z] = rot3(x, y, z, 0.5, TAU * p); return { x: 50 + X, y: 50 + Y, z: Z / 24 }; }, fx = [];
			for (let k = 0; k < 72; k++) { const P = proj(k / 72); fx.push({ c: [P.x, P.y, 0.8], a: 0.08 + 0.3 * (P.z + 1) / 2 }); }
			return { dots: [0, 1, 2, 3].map((i) => sp(proj(p + i * 0.06), 0.9 - 0.1 * i)), fx, trail: false };
		} },
		{ tag: 'MA18', cat: 'maths', name: 'Hilbert curve', note: 'A line that visits every cell of a grid without crossing itself; the four follow it there and back.', show: 8, loop: true, run(p) {
			const u = easeInOut(p < 0.5 ? p * 2 : 2 - p * 2);
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = along(HIL, clamp(u - i * 0.015)); return pt(x, y, { s: 0.8 - 0.1 * i, g: i === 0 ? 0.6 : 0 }); }), fx: [{ l: memo.hil || (memo.hil = poly(HIL)), a: 0.14, w: 1, keep: true }], trail: true };
		} },
		{ tag: 'MA19', cat: 'maths', name: 'Unit circle', note: 'A point goes round a circle; its height draws the sine wave and its shadow on the axis rides the cosine.', show: 4, loop: true, run(p) {
			const th = TAU * p, cx = 32, tipX = cx + 12 * Math.cos(th), tipY = 50 - 12 * Math.sin(th), wy = (x) => 50 - 12 * Math.sin(th - (x - 50) * 0.2);
			let d = ''; for (let x = 50; x <= 84; x += 1.5) d += (d ? 'L' : 'M') + f2(x) + ' ' + f2(wy(x));
			return { dots: [pt(tipX, tipY, { g: 0.7 }), pt(50, tipY, { s: 0.6 }), pt(tipX, 50, { s: 0.6, a: 0.7 }), pt(70, wy(70), { s: 0.6, a: 0.7 })], fx: [{ o: [cx, 50, 12], a: 0.25, w: 1, keep: true }, { l: 'M16 50L86 50', a: 0.1, w: 1, keep: true }, { l: d, a: 0.4, w: 1.2 }, { l: `M${cx} 50L${f2(tipX)} ${f2(tipY)}L50 ${f2(tipY)}`, a: 0.25, w: 1 }], trail: false };
		} },
		{ tag: 'MA20', cat: 'maths', name: 'Superformula', note: 'One formula, four settings: a triangle, a star, a flower and a circle melt into one another while the four ride the outline.', show: 8, loop: true, run(p) {
			const k = Math.floor(p * 4) % 4, b = easeInOut(seg((p * 4) % 1, 0.5, 1)), par = SFORM[k].map((v, i) => lerp(v, SFORM[(k + 1) % 4][i], b)), rs = Array.from({ length: 121 }, (_, i) => sfR(TAU * i / 120, par)), mx = Math.max(...rs);
			const at = (phi) => { const r = 28 * sfR(phi, par) / mx; return [50 + r * Math.cos(phi - Math.PI / 2), 50 + r * Math.sin(phi - Math.PI / 2)]; };
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = at(TAU * (p * 0.5 + i / 4)); return pt(x, y, { s: 0.8, g: 0.3 }); }), fx: [{ l: poly(rs.map((r, i) => { const phi = TAU * i / 120, rr = 28 * r / mx; return [50 + rr * Math.cos(phi - Math.PI / 2), 50 + rr * Math.sin(phi - Math.PI / 2)]; })) + 'Z', a: 0.35, w: 1.2 }], trail: false };
		} },
		{ tag: 'MA21', cat: 'maths', name: 'Prime hops', note: 'Along the number line from 2 to 29, landing only on the primes; the bigger the gap, the higher the hop.', show: 7, fade: [0.02, 0.93], run(p) {
			const X = (n) => 16 + n * 68 / 30, gaps = PRIMES.slice(1).map((q, i) => q - PRIMES[i]), total = gaps.reduce((a, b) => a + b, 0), fx = [];
			for (let n = 0; n <= 30; n++) fx.push({ l: `M${f2(X(n))} 62L${f2(X(n))} ${n % 5 ? 64 : 66}`, a: 0.2, w: 1, keep: true });
			const at = (u) => { let acc = 0; for (let i = 0; i < gaps.length; i++) { const w = gaps[i] / total; if (u <= acc + w || i === gaps.length - 1) { const f = clamp((u - acc) / w); return { x: lerp(X(PRIMES[i]), X(PRIMES[i + 1]), easeInOut(f)), y: 60 - (3 + gaps[i] * 2.2) * pulse(f), i, f }; } acc += w; } };
			const lead = at(seg(p, 0.05, 0.9));
			PRIMES.forEach((q, i) => { if (i <= lead.i + (lead.f > 0.95 ? 1 : 0)) fx.push({ c: [X(q), 64, 1.4], a: 0.8 }); });
			return { dots: [0, 1, 2, 3].map((j) => { const P = at(clamp(seg(p, 0.05, 0.9) - j * 0.02)); return pt(P.x, P.y, { s: 0.9 - 0.15 * j, a: 1 - 0.2 * j, g: j === 0 ? 0.6 : 0 }); }), fx, trail: false };
		} },
		{ tag: 'MA22', cat: 'maths', name: 'Mandelbrot orbit', note: 'z → z² + c, from zero, for a c near the edge of the Mandelbrot set: the orbit hops about and settles into a pattern. A new c each time.', show: 6, fade: [0.03, 0.93], run(p, R) {
			const c = MANDEL_C[Math.floor(R[0] * MANDEL_C.length)], M = (re, im) => [50 + (re + 0.7) * 22, 50 + im * 22], orbit = [[0, 0]];
			for (let i = 0; i < 40; i++) { const [a, b] = orbit[orbit.length - 1], z = [a * a - b * b + c[0], 2 * a * b + c[1]]; if (Math.hypot(...z) > 2.5) break; orbit.push(z); }
			const F = p * 42, N = Math.min(orbit.length - 1, Math.floor(F)), fr = F - Math.floor(F);
			const fx = [{ l: curve('mcard', 90, (u) => { const t = TAU * u; return M(Math.cos(t) / 2 - Math.cos(2 * t) / 4, Math.sin(t) / 2 - Math.sin(2 * t) / 4); }), a: 0.15, w: 1, keep: true }, { o: [...M(-1, 0), 0.25 * 22], a: 0.15, w: 1, keep: true }, { c: [...M(...c), 1.4], a: 0.6 }];
			for (let i = 0; i < N; i++) fx.push({ c: [...M(...orbit[i]), 0.7], a: 0.35 });
			return { dots: [0, 1, 2, 3].map((j) => { const i = Math.max(0, N - j), P = j === 0 && N < orbit.length - 1 ? mix2(M(...orbit[i]), M(...orbit[i + 1]), easeInOut(clamp(fr * 1.5))) : M(...orbit[i]); return pt(P[0], P[1], { s: 0.8 - 0.12 * j, a: 1 - 0.2 * j, g: j === 0 ? 0.7 : 0 }); }), fx, trail: false };
		} },
		{ tag: 'MA23', cat: 'maths', name: 'Lorenz attractor', note: 'Four particles started a hair apart on the butterfly attractor: together at first, then chaos pulls them each their own way.', show: 7, fade: [0.03, 0.94], run(p, R) {
			const L = lorenz(R), idx = Math.min(1399, Math.floor(p * 1399)), from = Math.max(0, idx - 140);
			return { dots: L.map((pts, i) => { const [x, y, d] = pts[idx]; return pt(x, y, { s: 0.7 * Math.pow(2, 0.6 * K.depth * clamp(d / 25, -1, 1)), g: i === 0 ? 0.5 : 0.2 }); }), fx: [{ l: poly(L[0].slice(from, idx + 1)), a: 0.2, w: 1 }], trail: true };
		} },
		// ── Physics ──
		{ tag: 'AP1', cat: 'physics', name: 'The atom', note: 'A nucleus with three electrons on tilted orbits, growing as they swing towards you.', show: 4, loop: true, run(p) {
			const dots = [pt(50, 50, { s: 1.4, g: 0.7, z: 0 })], fx = [], rots = [0, Math.PI / 3, -Math.PI / 3], turns = [2, 3, 2];
			for (let i = 0; i < 3; i++) { const rot = rots[i], th = TAU * turns[i] * p + i * 2.1, lx = 30 * Math.cos(th), ly = 10 * Math.sin(th), z = Math.sin(th); dots.push(pt(50 + lx * Math.cos(rot) - ly * Math.sin(rot), 50 + lx * Math.sin(rot) + ly * Math.cos(rot), { s: 0.7 * Math.pow(2, 0.6 * K.depth * z), a: 0.55 + 0.45 * (z + 1) / 2, g: 0.3, z })); fx.push({ e: [50, 50, 30, 10, deg(rot)], a: 0.15, w: 1.2, keep: true }); }
			return { dots, fx, trail: true };
		} },
		{ tag: 'AP2', cat: 'physics', name: 'Slingshot', note: 'A comet and two fragments whip round a glowing star, fastest as they pass closest, from a new direction each time.', show: 3.4, fade: [0.02, 0.98], run(p, R) {
			const dots = [pt(50, 50, { s: 1.8 })], fx = corona(50, 50, dotR(1.8), 0.8), rot = -Math.PI / 2 - 0.5 + (R[0] - 0.5) * 2;
			for (let j = 0; j < 3; j++) { const u = clamp(p - j * 0.025), nu = 1.92 * Math.sin((u - 0.5) * Math.PI), r = 18 / (1 + 1.6 * Math.cos(nu)); dots.push(pt(50 + r * Math.cos(nu + rot), 50 + r * Math.sin(nu + rot), { s: [1, 0.6, 0.45][j], a: [1, 0.7, 0.5][j] * seg(u, 0, 0.08) * (1 - seg(u, 0.92, 1)), g: j === 0 ? 0.8 : 0.3 })); }
			return { dots, fx, trail: true };
		} },
		{ tag: 'AP3', cat: 'physics', name: 'Ripples', note: 'A drop falls into a still pond; the rings spread over the water and lift each floating dot as they pass. Somewhere new each time.', show: 3.8, fade: [0.02, 0.94], run(p, R) {
			const T = p * this.show, cx = (R[0] - 0.5) * 10, cz = 76 + R[1] * 8, fallT = 0.55, fx = [floor()], h = T < fallT ? 34 * (1 - (T / fallT) ** 2) : 0;
			const rings = [0, 1, 2].map((k) => (T - fallT - k * 0.35) * 16).filter((r) => r > 0 && r < 30);
			for (const r of rings) fx.push({ l: wcircle(cx, cz, r), a: 0.55 * (1 - r / 30), w: 1.5 });
			const dots = [T < fallT ? wpt(cx, h + BR(1), cz, 1, { sy: 1.3, g: 0.4 }) : wpt(cx, 0, cz, 1, { a: 0 })];
			for (let i = 0; i < 3; i++) { const a = R[2 + i] * TAU, d = 12 + R[5 + i] * 6, x = cx + d * Math.cos(a), z = cz + d * 0.7 * Math.sin(a), lift = rings.reduce((s, r) => s + Math.exp(-Math.pow((r - d) / 3, 2)) * (1 - r / 30), 0); dots.push(wpt(x, BR(1) + 3 * lift, z, 1, { g: clamp(lift) })); }
			if (T > fallT && T < fallT + 0.3) { const q = (T - fallT) / 0.3; for (let j = 0; j < 6; j++) { const a = j * TAU / 6, P = P3(cx + Math.cos(a) * 5 * q, 10 * q - 18 * q * q, cz + Math.sin(a) * 4 * q); fx.push({ c: [P.x, P.y, 0.8], a: 1 - q }); } }
			return { dots, fx, trail: false };
		} },
		{ tag: 'AP4', cat: 'physics', name: 'Magnets', note: 'Opposites creep together, faster and faster, and snap with a buzz; the like pair below shoves apart and slows.', show: 3, fade: [0.04, 0.92], run(p) {
			const pull = Math.pow(seg(p, 0.1, 0.55), 4), snap = p > 0.55, push = easeOut(seg(p, 0.12, 0.75)), wob = snap ? Math.sin((p - 0.55) * 70) * Math.exp(-(p - 0.55) * 14) * 2 : 0, fx = [{ l: 'M30 51L70 51', a: 0.15, w: 1, keep: true }], sq = snap ? Math.exp(-(p - 0.55) * 20) : 0;
			if (snap) fx.push({ c: [50, 40, 4 + 14 * seg(p, 0.55, 0.7)], a: 0.35 * (1 - seg(p, 0.55, 0.7)) });
			return { dots: [pt(lerp(24, 44.8, pull) - wob, 40, { g: snap ? 0.8 : 0.2, sx: 1 - 0.3 * sq, sy: 1 + 0.3 * sq }), pt(lerp(76, 55.2, pull) + wob, 40, { g: snap ? 0.8 : 0.2, sx: 1 - 0.3 * sq, sy: 1 + 0.3 * sq }), pt(lerp(44.8, 26, push), 62, { a: 0.75 }), pt(lerp(55.2, 74, push), 62, { a: 0.75 })], fx, trail: false };
		} },
		{ tag: 'AP5', cat: 'physics', name: 'Springs', note: 'Four dots on springs, let go together; each bounces at its own pace and settles, then a hand pulls them down again.', show: 4.4, loop: true, run(p) {
			const xs = [32, 44, 56, 68], t = p * this.show, pullBack = easeInOut(seg(p, 0.84, 1)), dots = [], fx = [{ l: 'M26 22L74 22', a: 0.5, w: 2, keep: true }];
			for (let i = 0; i < 4; i++) { const free = 50 + 12 * Math.exp(-0.9 * t) * Math.cos(TAU * (1.2 + 0.25 * i) * t), y = lerp(free, 62, pullBack); let d = `M${xs[i]} 22`; for (let k = 1; k <= 8; k++) d += `L${(xs[i] + (k === 8 ? 0 : (k % 2 ? 2.5 : -2.5))).toFixed(1)} ${f2(22 + (y - 22) * k / 8)}`; fx.push({ l: d, a: 0.4, w: 1.2 }); dots.push(pt(xs[i], y)); }
			return { dots, fx, trail: false };
		} },
		{ tag: 'AP6', cat: 'physics', name: 'Brownian motion', note: 'A grain of pollen jostled about by three quick molecules.', show: 6, loop: true, run(p, R) {
			const dots = [pt(50 + 7 * nzl(p, R[0], 2), 50 + 7 * nzl(p, R[1], 2), { s: 1.7, g: 0.3 })];
			for (let i = 1; i < 4; i++) { let x = 30 * nzl(p, R[2 * i], 5 + i), y = 30 * nzl(p, R[2 * i + 1], 4 + i); const d = Math.hypot(x, y); if (d > 33) { x *= 33 / d; y *= 33 / d; } dots.push(pt(50 + x, 50 + y, { s: 0.55, a: 0.7 })); }
			return { dots, fx: [], trail: true };
		} },
		{ tag: 'AP7', cat: 'physics', name: 'Double pendulum', note: 'Two arms, one swinging from the other: chaos, never the same twice.', show: 5, fade: [0.03, 0.94], run(p, R) {
			const [a1, a2] = dpend(p * this.show, R), pv = [50, 46], L = 15, x1 = pv[0] + L * Math.sin(a1), y1 = pv[1] + L * Math.cos(a1), x2 = x1 + L * Math.sin(a2), y2 = y1 + L * Math.cos(a2);
			return { dots: [pt(x2, y2, { g: 0.8 }), pt(x1, y1, { s: 0.8 }), pt(pv[0], pv[1], { s: 0.5, a: 0.7 }), pt((x1 + x2) / 2, (y1 + y2) / 2, { s: 0.35, a: 0.5 })], fx: [{ l: `M${pv[0]} ${pv[1]}L${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`, a: 0.4, w: 1.5 }], trail: true };
		} },
		{ tag: 'AP8', cat: 'physics', name: 'Moon phases', note: 'The shadow crosses a full moon: wane, new moon, wax. Stars brighten while it is dark.', show: 5, loop: true, run(p) {
			const Rm = dotR(3.6), ox = lerp(50 - 2.3 * Rm, 50 + 2.3 * Rm, p), cover = clamp(1 - Math.abs(ox - 50) / (2 * Rm)), dots = [pt(50, 50, { s: 3.6 })], fx = corona(50, 50, Rm, 1 - cover);
			[[28, 30], [72, 34], [66, 72]].forEach((q, i) => { const tw = twinkle(p, i * 0.31, 2); dots.push(pt(q[0], q[1], { s: 0.4 + 0.3 * tw, a: (0.2 + 0.8 * cover) * (0.5 + 0.5 * tw), g: cover * tw })); });
			fx.push({ bg: [ox, 48, Rm * 1.02], top: true });
			return { dots, fx, trail: false };
		} },
		{ tag: 'AP9', cat: 'physics', name: 'Pulsar', note: 'A spinning star sweeps two beams round; each distant dot flashes as a beam passes.', show: 3, loop: true, run(p) {
			const ang = TAU * 2 * p, dots = [pt(50, 50, { s: 1.2, g: 1 })], fx = [0, Math.PI].map((k) => ({ pf: cone([50, 50], ang + k, 0.05, 40), a: 0.3 }));
			for (const d0 of [30, 150, 260]) { const t = d0 * Math.PI / 180; let d = ((ang - t) % Math.PI + Math.PI) % Math.PI; d = Math.min(d, Math.PI - d); const fl = Math.exp(-Math.pow(d / 0.22, 2)); dots.push(pt(50 + 30 * Math.cos(t), 50 + 30 * Math.sin(t), { s: 0.55 + 0.6 * fl, a: 0.35 + 0.65 * fl, g: fl })); }
			return { dots, fx, trail: false };
		} },
		{ tag: 'AP10', cat: 'physics', name: 'Heat', note: 'A gas warms up and cools down: the dots crawl, race and glow, then crawl again.', show: 4.4, fade: [0.04, 0.94], run(p, R) {
			const heat = Math.sin(Math.PI * p);
			return { dots: gas(p * this.show, R, this.show).map((o) => pt(o.x, o.y, { g: heat, a: 0.5 + 0.5 * heat, s: 0.8 + 0.3 * heat })), fx: [], trail: heat > 0.3 };
		} },
		{ tag: 'PH1', cat: 'physics', name: 'Pendulum wave', note: 'Four pendulums of slightly different lengths: in step, then snaking out of step, then in step again.', show: 6, loop: true, run(p) {
			const fx = [{ l: 'M26 20L74 20', a: 0.5, w: 2, keep: true }], dots = [];
			[32, 44, 56, 68].forEach((x0, i) => { const a = 0.5 * Math.cos(TAU * p * (4 + i)), x = x0 + 36 * Math.sin(a), y = 20 + 36 * Math.cos(a); fx.push({ l: `M${x0} 20L${f2(x)} ${f2(y)}`, a: 0.3, w: 1 }); dots.push(pt(x, y)); });
			return { dots, fx, trail: false };
		} },
		{ tag: 'PH2', cat: 'physics', name: 'Projectiles', note: 'Four launched across the floor at 30°, 45°, 60° and 75° at the same speed: 45° goes furthest, and 30° and 60° land together.', show: 3.8, fade: [0.03, 0.92], run(p) {
			const t = p * this.show, g = 120, v = 74, fx = [floor()], dots = [];
			[30, 45, 60, 75].forEach((d0, i) => {
				const a = d0 * Math.PI / 180, z = 62 + i * 6, t0 = 0.2 + 0.22 * i, tt = Math.max(0, t - t0), T = 2 * v * Math.sin(a) / g, u = Math.min(tt, T), x = -26 + v * Math.cos(a) * u * 0.9, h = v * Math.sin(a) * u - 0.5 * g * u * u;
				dots.push(wpt(x, BR(0.9) + h, z, 0.9, { a: t < t0 ? 0.35 : 1, g: tt > 0 && tt < T ? 0.5 : 0 }));
				fx.push(wsh(x, z, h, 0.9));
				if (tt > T && tt < T + 0.4) fx.push({ l: wcircle(x, z, 1 + 10 * (tt - T)), a: 0.4 * (1 - (tt - T) / 0.4), w: 1 });
			});
			return { dots, fx, trail: true };
		} },
		{ tag: 'PH3', cat: 'physics', name: 'Elastic and inelastic', note: 'Top: an elastic knock, the first stops dead and the second takes all its speed. Bottom: they stick and roll on together at half speed.', show: 3.2, fade: [0.04, 0.9], run(p) {
			const t = seg(p, 0.05, 0.9), hit = 0.4, after = decel(clamp((t - hit) / (1 - hit))), fx = lanes([38, 62]);
			const ax = t < hit ? lerp(24, 45, t / hit) : 45, bx = t < hit ? 55 : lerp(55, 76, after), cx = t < hit ? lerp(24, 45, t / hit) : lerp(45, 55.5, after), dx = t < hit ? 55 : lerp(55, 65.5, after), sq = t >= hit ? Math.exp(-(t - hit) * 40) : 0;
			if (Math.abs(t - hit) < 0.04) fx.push({ c: [50, 38, 7], a: 0.3 }, { c: [50, 62, 7], a: 0.3 });
			return { dots: [pt(ax, 38, { sx: 1 - 0.3 * sq, sy: 1 + 0.3 * sq }), pt(bx, 38, { sx: 1 - 0.3 * sq, sy: 1 + 0.3 * sq }), pt(cx, 62, { a: 0.8 }), pt(dx, 62, { a: 0.8 })], fx, trail: false };
		} },
		{ tag: 'PH4', cat: 'physics', name: "Kepler's orbit", note: 'An elliptical orbit round a glowing sun: slow far out, whipping round close in (equal areas in equal times).', show: 5, loop: true, run(p) {
			const a = 26, e = 0.6, b = a * Math.sqrt(1 - e * e), F = [60, 50], pos = (M) => { const E = kepler(M, e); return [F[0] + a * (Math.cos(E) - e), F[1] + b * Math.sin(E)]; };
			return { dots: [pt(F[0], F[1], { s: 1.6 })].concat([0, 1, 2].map((j) => { const [x, y] = pos(TAU * p - j * 0.12); return pt(x, y, { s: [0.9, 0.5, 0.35][j], a: [1, 0.6, 0.4][j], g: j === 0 ? 0.5 : 0 }); })), fx: corona(F[0], F[1], dotR(1.6), 0.8).concat([{ e: [F[0] - a * e, 50, a, b, 0], a: 0.15, w: 1, keep: true }]), trail: true };
		} },
		{ tag: 'PH5', cat: 'physics', name: 'Gyroscope', note: 'A spinning top: its spin keeps it up while its axis slowly circles (precession) and nods (nutation).', show: 5, loop: true, run(p) {
			const phi = TAU * p, tilt = 0.5 + 0.06 * Math.sin(TAU * p * 9), A = [Math.sin(tilt) * Math.cos(phi), Math.cos(tilt), Math.sin(tilt) * Math.sin(phi)], U = norm(cross(A, [0, 0, 1])), V = cross(A, U);
			const proj = ([x, y, z]) => { const [X, Y, Z] = rot3(x, -y, z, -0.45, 0); return { x: 50 + X, y: 58 + Y, z: Z / 30 }; }, tip = proj(A.map((c) => c * 30)), C = A.map((c) => c * 16), dots = [sp(tip, 0.8)], base = proj([0, 0, 0]);
			for (let i = 0; i < 3; i++) { const ps = TAU * p * 7 + i * TAU / 3; dots.push(sp(proj([0, 1, 2].map((k) => C[k] + 13 * (U[k] * Math.cos(ps) + V[k] * Math.sin(ps)))), 0.75)); }
			return { dots, fx: [{ l: `M${f2(base.x)} ${f2(base.y)}L${f2(tip.x)} ${f2(tip.y)}`, a: 0.45, w: 1.5 }, { c: [base.x, base.y, 1.5], a: 0.6 }], trail: false };
		} },
		{ tag: 'PH6', cat: 'physics', name: 'Standing wave', note: 'A string in its third harmonic: three dots ride the loops, the fourth sits on a node and never moves.', show: 3, loop: true, run(p) {
			const amp = 14 * Math.cos(TAU * p * 3), y = (x) => 50 + amp * Math.sin(3 * Math.PI * (x - 18) / 64);
			let d = ''; for (let x = 18; x <= 82; x += 2) d += (d ? 'L' : 'M') + x + ' ' + f2(y(x));
			return { dots: [18 + 64 / 6, 18 + 64 / 2, 18 + 64 * 5 / 6, 18 + 64 * 2 / 3].map((x, i) => pt(x, y(x), { s: i === 3 ? 0.6 : 0.9, a: i === 3 ? 0.6 : 1 })), fx: [{ l: d, a: 0.4, w: 1.5 }, { c: [18, 50, 1.5], a: 0.6, keep: true }, { c: [82, 50, 1.5], a: 0.6, keep: true }], trail: false };
		} },
		{ tag: 'PH7', cat: 'physics', name: 'Doppler', note: 'A moving source sends out rings, bunched up ahead and stretched behind: the listener ahead hears them come faster.', show: 4, fade: [0.03, 0.93], run(p) {
			const S = this.show, t = p * S, src = lerp(26, 74, p), fx = [], rings = [];
			for (let k = 0; k * 0.18 < t; k++) { const te = k * 0.18, ex = lerp(26, 74, te / S), r = 22 * (t - te); if (r < 50) { fx.push({ o: [ex, 50, r], a: 0.5 * (1 - r / 50), w: 1.2 }); rings.push([ex, r]); } }
			const hear = (lx) => clamp(rings.reduce((s, [ex, r]) => s + Math.exp(-Math.pow((Math.hypot(lx - ex, 14) - r) / 2, 2)), 0));
			return { dots: [pt(src, 50, { s: 1.2, g: 0.6 }), pt(22, 64, { s: 0.7 + 0.4 * hear(22), g: hear(22) }), pt(78, 64, { s: 0.7 + 0.4 * hear(78), g: hear(78) }), NONE()], fx, trail: false };
		} },
		{ tag: 'PH8', cat: 'physics', name: 'Buoyancy', note: 'Dropped one by one into water, each with a splash: the light ones bob up and float, the heaviest sinks to the bottom.', show: 4, fade: [0.03, 0.93], run(p) {
			const t = p * this.show, W = 52, fx = [{ l: `M16 ${W}L84 ${W}`, a: 0.5, w: 2, keep: true }], eq = [W - 3, W + 3, W + 10, 74], fallT = Math.sqrt((W - 24) / 80);
			const dots = [32, 44, 56, 68].map((x, i) => {
				const tt = t - (0.2 + i * 0.4); let y = 24;
				if (tt >= 0) { if (tt < fallT) y = 24 + 80 * tt * tt; else { const u = tt - fallT; y = i === 3 ? Math.min(74, W + 30 * u * (1 - u / 4)) : eq[i] + (W + 6 - eq[i]) * Math.exp(-2 * u) * Math.cos(5 * u); if (u < 0.35) fx.push({ o: [x, W, 3 + 20 * u], a: 0.4 * (1 - u / 0.35), w: 1 }); } }
				return pt(x, y, { s: [0.8, 0.9, 1, 1.1][i], a: tt < 0 ? 0.3 : (y > W ? 0.7 : 1) });
			});
			return { dots, fx, trail: false };
		} },
		{ tag: 'PH9', cat: 'physics', name: 'Centrifuge', note: 'Spun faster and faster, they fling outwards, stretched by the speed; as it slows they come back in.', show: 4, loop: true, run(p) {
			const ang = TAU * 2 * (p - Math.sin(TAU * p) / TAU), spin = (1 - Math.cos(TAU * p)) / 2, r = 8 + 24 * spin, fx = [{ c: [50, 50, 2], a: 0.7 }];
			return { dots: [0, 1, 2, 3].map((i) => { const a = ang + i * Math.PI / 2, x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a); fx.push({ l: `M50 50L${f2(x)} ${f2(y)}`, a: 0.25, w: 1 }); return pt(x, y, { g: spin, sx: 1 + 0.4 * spin, rot: deg(a) + 90 }); }), fx, trail: spin > 0.3 };
		} },
		{ tag: 'PH10', cat: 'physics', name: 'Spring and mass', note: 'A weight on a spring, pulled and let go: each swing smaller than the last, until it is pulled again.', show: 4, loop: true, run(p) {
			const t = p * this.show, x = lerp(54 + 16 * Math.exp(-0.9 * t) * Math.cos(TAU * 1.1 * t), 70, easeInOut(seg(p, 0.84, 1)));
			let d = 'M22 50'; for (let k = 1; k <= 10; k++) d += `L${f2(22 + (x - 6 - 22) * k / 10)} ${k === 10 ? 50 : (k % 2 ? 45 : 55)}`;
			return { dots: [pt(x, 50, { s: 1.4 }), NONE(), NONE(), NONE()], fx: [{ l: 'M22 38L22 62', a: 0.5, w: 2, keep: true }, { l: d, a: 0.45, w: 1.2 }], trail: false };
		} },
		{ tag: 'PH11', cat: 'physics', name: 'Dominoes', note: 'A row of dominoes running away across the floor: a flick topples the first, and each knocks the next, quicker as it goes.', show: 3.4, fade: [0.04, 0.9], run(p) {
			const H = 11, fx = [floor()];
			const dots = [[-12, 44], [-6, 56], [0, 70], [6, 88]].map(([x, z], i) => { const t0 = 0.14 + 0.13 * i - i * i * 0.006, ang = (i === 3 ? 88 : 68) * Math.PI / 180 * easeIn(seg(p, t0, t0 + 0.15)); return stick(P3(x, 0, z), P3(x, H * Math.cos(ang), z + H * Math.sin(ang)), 0.6 * 64 / z * 0.6); });
			if (p < 0.14) { const P = P3(-12, 6, 38); fx.push({ c: [P.x, P.y, 1.5], a: 1 - p / 0.14 }); }
			return { dots, fx, trail: false };
		} },
		{ tag: 'PH12', cat: 'physics', name: 'Rolling wheel', note: 'A wheel rolls across the floor without slipping: a point on its rim traces a cycloid, stopping dead each time it touches down.', show: 4.4, fade: [0.06, 0.94], run(p) {
			const R = 9, z = 66, cx = lerp(-28, 28, p), th = (cx + 28) / R, rim = (ph) => [cx - R * Math.sin(th + ph), R - R * Math.cos(th + ph)], C = P3(cx, R, z);
			const pts = [0, TAU / 3, 2 * TAU / 3].map((ph) => { const [x, y] = rim(ph); return wpt(x, y, z, 0.6); }), cyc = (u) => { const x = lerp(-28, 28, u), t = (x + 28) / R; return [x - R * Math.sin(t), R - R * Math.cos(t), z]; };
			return { dots: [Object.assign(pts[0], { s: 0.9 * C.k * 0.6, g: 0.6 }), wpt(cx, R, z, 0.5), Object.assign(pts[1], { a: 0.5 }), Object.assign(pts[2], { a: 0.5 })], fx: [floor(), { o: [C.x, C.y, R * C.k], a: 0.4, w: 1.5 }, { l: wline(Array.from({ length: Math.floor(p * 120) + 1 }, (_, i) => cyc(i / 120))), a: 0.5, w: 1.2 }, wsh(cx, z, 0, 3)], trail: false };
		} },
		{ tag: 'PH13', cat: 'physics', name: 'Entropy', note: 'Sixteen in a neat square spread out at random and never come back: order to disorder.', show: 4.4, fade: [0.03, 0.9], run(p, R) {
			const amp = 30 * Math.sqrt(p), t = p * this.show, dots = [], fx = [];
			for (let k = 0; k < 16; k++) { let x = 44 + (k % 4) * 4 - 50 + amp * nz(t * 0.9, R[k] + k * 0.1) * 0.9, y = 44 + Math.floor(k / 4) * 4 - 50 + amp * nz(t * 0.8, R[(k + 5) % 16] + k * 0.2) * 0.9; const d = Math.hypot(x, y); if (d > 33) { x *= 33 / d; y *= 33 / d; } if (k < 4) dots.push(pt(50 + x, 50 + y, { s: 0.7 })); else fx.push({ c: [50 + x, 50 + y, 1.6], a: 0.5 }); }
			return { dots, fx, trail: false };
		} },
		{ tag: 'PH14', cat: 'physics', name: 'Orbital resonance', note: 'Three moons at 1 : 2 : 4, like Jupiter\'s: they keep lining up again.', show: 5, loop: true, run(p) {
			const rs = [14, 22, 30];
			return { dots: [pt(50, 50, { s: 1.8, g: 0.5 })].concat(rs.map((r, i) => { const a = -Math.PI / 2 + TAU * p * [4, 2, 1][i]; return pt(50 + r * Math.cos(a), 50 + r * Math.sin(a), { s: 0.7 }); })), fx: rs.map((r) => ({ o: [50, 50, r], a: 0.1, w: 1, keep: true })), trail: true };
		} },
		{ tag: 'PH15', cat: 'physics', name: 'Coupled pendulums', note: 'Two pendulums joined by a spring: the swing passes from one to the other and back.', show: 6, loop: true, run(p) {
			const t = p * 4, a1 = 0.5 * Math.cos(TAU * t * 1.5) * Math.abs(Math.cos(Math.PI * p)), a2 = 0.5 * Math.sin(TAU * t * 1.5) * Math.abs(Math.sin(Math.PI * p)), P = (x0, a) => [x0 + 34 * Math.sin(a), 20 + 34 * Math.cos(a)], b1 = P(40, a1), b2 = P(60, a2);
			return { dots: [pt(b1[0], b1[1]), pt(b2[0], b2[1]), NONE(), NONE()], fx: [{ l: 'M30 20L70 20', a: 0.5, w: 2, keep: true }, { l: `M40 20L${f2(b1[0])} ${f2(b1[1])}M60 20L${f2(b2[0])} ${f2(b2[1])}`, a: 0.3, w: 1 }, { l: `M${f2(lerp(40, b1[0], 0.5))} ${f2(lerp(20, b1[1], 0.5))}L${f2(lerp(60, b2[0], 0.5))} ${f2(lerp(20, b2[1], 0.5))}`, a: 0.35, w: 1 }], trail: false };
		} },
		// ── On the sphere ──
		{ tag: 'SP1', cat: 'sphere', name: 'Globe', note: 'Four dots on a turning globe: big and bright in front, small and dim behind.', show: 5, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => sp(onSphere(0.25 * Math.sin(i * 1.7), i * Math.PI / 2, 0.35, TAU * p))), fx: [{ e: [50, 50, 34, 34 * Math.sin(0.35), 0], a: 0.15, w: 1, keep: true }], trail: false };
		} },
		{ tag: 'SP2', cat: 'sphere', name: 'Polar satellites', note: 'Each on its own orbit over the poles, crossing at the top and bottom.', show: 5, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => sp(onSphere(TAU * p + i * 0.8, i * Math.PI / 4, 0.5, 0))), fx: [], trail: true };
		} },
		{ tag: 'SP3', cat: 'sphere', name: 'Tennis ball', note: 'The seam of a tennis ball, and the four running along it as the ball spins.', show: 5, loop: true, run(p) {
			const seam = (s) => onSphere(0.5 * Math.sin(2 * TAU * s), TAU * s, 0.45, TAU * p, 30), fx = [];
			for (let k = 0; k < 48; k++) { const P = seam(k / 48); fx.push({ c: [P.x, P.y, 0.9], a: 0.1 + 0.35 * (P.z + 1) / 2 }); }
			return { dots: [0, 1, 2, 3].map((i) => sp(seam(p + i * 0.04), 0.9 - 0.1 * i)), fx: fx.concat([{ o: [50, 50, 30], a: 0.15, w: 1, keep: true }]), trail: false };
		} },
		{ tag: 'SP4', cat: 'sphere', name: 'Night globe', note: 'A faint globe of points turns; four bright cities come round in front and go round behind.', show: 6, loop: true, run(p) {
			const GA = 137.508 * Math.PI / 180, fx = [];
			for (let i = 0; i < 50; i++) { const y = 1 - 2 * (i + 0.5) / 50, P = onSphere(Math.asin(y), i * GA, 0.4, TAU * p, 32); fx.push({ c: [P.x, P.y, 0.8], a: 0.08 + 0.3 * (P.z + 1) / 2 }); }
			return { dots: [[0.6, 0.3], [0.2, 1.9], [-0.4, 3.4], [0.9, 4.9]].map(([lat, lon]) => sp(onSphere(lat, lon, 0.4, TAU * p, 32), 0.8, { g: 0.6 })), fx, trail: false };
		} },
		{ tag: 'SP5', cat: 'sphere', name: 'Meridians', note: 'Each goes right round the globe over both poles, one behind another.', show: 5, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => sp(onSphere(-Math.PI / 2 + TAU * (p + i * 0.07), i * Math.PI / 2, 0.5, TAU * p))), fx: [], trail: true };
		} },
		{ tag: 'SP6', cat: 'sphere', name: 'Breathing ball', note: 'The four at the corners of a tetrahedron on a ball that turns and breathes in and out.', show: 5, loop: true, run(p) {
			const R = 22 + 10 * Math.sin(TAU * p * 2);
			return { dots: TETRA.map(([x, y, z]) => { const [X, Y, Z] = rot3(x * R, y * R, z * R, 0.6, TAU * p); return sp({ x: 50 + X, y: 50 + Y, z: Z / R }, 0.9); }), fx: [], trail: false };
		} },
		{ tag: 'SP7', cat: 'sphere', name: 'Loxodrome', note: 'A rhumb line: pole to pole at a constant bearing, spiralling round the sphere, there and back.', show: 5, loop: true, run(p) {
			const lox = (u) => { const lat = lerp(-1.3, 1.3, u); return onSphere(lat, 3 * Math.log(Math.tan(Math.PI / 4 + lat / 2)), 0.4, TAU * p, 32); }, fx = [], u0 = easeInOut(p < 0.5 ? p * 2 : 2 - p * 2);
			for (let k = 0; k <= 40; k++) { const P = lox(k / 40); fx.push({ c: [P.x, P.y, 0.7], a: 0.08 + 0.3 * (P.z + 1) / 2 }); }
			return { dots: [0, 1, 2, 3].map((i) => sp(lox(clamp(u0 - i * 0.04)), 0.9 - 0.1 * i)), fx, trail: false };
		} },
		{ tag: 'SP8', cat: 'sphere', name: 'Planet and moons', note: 'Three moons on steep orbits pass in front of a shaded planet and are hidden behind it.', show: 5, loop: true, run(p) {
			const PR = dotR(2.8), dots = [pt(50, 50, { s: 2.8, a: 0.9, z: 0 })];
			for (let i = 0; i < 3; i++) { const th = TAU * p * (1 + i) + i * 2, [X, Y, Z] = rot3(30 * Math.cos(th), 0, 30 * Math.sin(th), 1.2 - 0.1 * i, 0.3 * i), hidden = Z < 0 && Math.hypot(X, Y) < PR; dots.push(sp({ x: 50 + X, y: 50 + Y, z: Z / 30 }, 0.7, { a: hidden ? 0 : 0.5 + 0.5 * (Z / 30 + 1) / 2 })); }
			return { dots, fx: [{ o: [50, 50, PR], a: 0.4, w: 1.5, keep: true }].concat(shade(50, 50, PR, -2.3, 0.8)), trail: false };
		} },
		{ tag: 'SP9', cat: 'sphere', name: 'Orbiting rings', note: 'Two pairs on crossing rings round the sphere, like a gyroscope frame.', show: 5, loop: true, run(p) {
			const ring = (i, th) => { const [X, Y, Z] = rot3(30 * Math.cos(th), 30 * Math.sin(th), 0, i ? 1.2 : 0.3, i ? 0.8 : -0.6); return { x: 50 + X, y: 50 + Y, z: Z / 30 }; };
			return { dots: [0, 1, 2, 3].map((k) => sp(ring(k % 2, TAU * p * (k % 2 ? 1 : -1) + (k > 1 ? Math.PI : 0)), 0.9)), fx: [], trail: true };
		} },
		// ── Shape shifting (UV, 1 Nov: the dots stay dots, turning into a shape for a moment) ──
		{ tag: 'SH1', cat: 'shapes', name: 'Dice', note: 'They crouch and jump; in the air each turns into a die and tumbles, lands square with a thud, then softens back into a dot.', show: 3.6, loop: true, reroll: true, run(p, R) {
			const fx = [floor()];
			const dots = [-15, -5, 5, 15].map((x, i) => {
				const z = 64 + (i % 2) * 6, t0 = 0.08 + i * 0.06 + R[i] * 0.04, q = seg(p, t0, t0 + 0.42), crouch = pulse(seg(q, 0, 0.18)), air = seg(q, 0.15, 0.85), land = seg(q, 0.85, 1);
				const h = 22 * 4 * air * (1 - air), m = clamp(seg(air, 0.05, 0.3) * (1 - seg(p, t0 + 0.5, t0 + 0.62))), turns = 1 + Math.floor(R[4 + i] * 2), sq = pulse(land) * 0.3 + crouch * 0.25;
				fx.push(wsh(x, z, h, 1.2));
				return wpt(x, h + BR(1.2) * (1 - sq), z, 1.2, { shape: 'square', m, rot: 90 * turns * easeInOut(air) * (i % 2 ? 1 : -1), sx: 1 + sq, sy: 1 - sq });
			});
			return { dots, fx, trail: false };
		} },
		{ tag: 'SH2', cat: 'shapes', name: 'Twinkle', note: 'Round the ring, one dot at a time flares into a four-pointed star, turns a little and shrinks back to a dot. A new order each time.', show: 3.6, loop: true, reroll: true, run(p, R) {
			return { dots: [0, 1, 2, 3].map((i) => { const c = 0.12 + ((i + Math.floor(R[0] * 4)) % 4) / 4 * 0.75, w = seg(p, c - 0.1, c + 0.1), m = pulse(w), [x, y] = ringAt(i, 26); return pt(x, y, { shape: 'spark', m: easeOut(m), s: 1 + 0.6 * m, rot: 45 * w, g: m }); }), fx: [], trail: false };
		} },
		{ tag: 'SH3', cat: 'shapes', name: 'Heartbeat', note: 'Lub-dub: on each beat the four swell into hearts and push outwards, then rest as dots until the next.', show: 2.2, loop: true, run(p) {
			const b = Math.max(pulse(seg(p, 0.1, 0.22)) * 0.7, pulse(seg(p, 0.28, 0.44)));
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = ringAt(i, 20 + 4 * b); return pt(x, y, { shape: 'heart', m: b, s: 1 + 0.5 * b, g: b }); }), fx: [{ c: [50, 50, 6 + 10 * b], a: 0.12 * b }], trail: false };
		} },
		{ tag: 'SH4', cat: 'shapes', name: 'Sprinter', note: 'The four cruise round the ring; one breaks away, stretching into an arrow as it sprints an extra lap, then rounds back into a dot as it rejoins.', show: 4, loop: true, reroll: true, run(p, R) {
			const who = Math.floor(R[0] * 4), q = seg(p, 0.25, 0.7);
			return { dots: [0, 1, 2, 3].map((i) => { const extra = i === who ? TAU * easeInOut(q) : 0, sprint = i === who ? Math.sin(Math.PI * q) : 0, a = -Math.PI / 2 + i * Math.PI / 2 + Math.PI * p + extra; return pt(50 + 27 * Math.cos(a), 50 + 27 * Math.sin(a), { shape: 'arrow', m: clamp(sprint * 1.4), rot: deg(a) + 180, sy: 1 + 0.3 * sprint, g: sprint }); }), fx: [], trail: true };
		} },
		{ tag: 'SH5', cat: 'shapes', name: 'Raindrops', note: 'Falling, each dot draws out into a drop; it splashes flat with a ripple, bounces once as a dot and is gone. Somewhere new every drop.', show: 3, loop: true, run(p, R, n) {
			const fx = [floor()], dots = [];
			for (let i = 0; i < 4; i++) {
				const ph = p * 2 + i / 4, u = ph % 1, cyc = n * 2 + Math.floor(ph), x = (hash01(i, cyc) - 0.5) * 36, z = 56 + hash01(i + 9, cyc) * 40, fall = seg(u, 0, 0.55), h = 40 * (1 - fall * fall), splash = seg(u, 0.55, 0.68), bounce = seg(u, 0.62, 0.82);
				if (u < 0.55) dots.push(wpt(x, h + BR(0.9), z, 0.9, { shape: 'drop', m: clamp(fall * 1.5), sy: 1 + 0.3 * fall, a: seg(u, 0, 0.06) }));
				else if (u < 0.62) dots.push(wpt(x, BR(0.9) * 0.4, z, 0.9, { sx: 1 + 0.9 * pulse(splash), sy: 1 - 0.55 * pulse(splash) }));
				else dots.push(wpt(x, BR(0.6) + 24 * bounce * (1 - bounce), z, 0.6, { a: 1 - seg(u, 0.8, 0.9) }));
				if (u > 0.55 && u < 0.95) fx.push({ l: wcircle(x, z, 1 + 14 * seg(u, 0.55, 0.95)), a: 0.45 * (1 - seg(u, 0.55, 0.95)), w: 1 });
				if (u < 0.55) fx.push(wsh(x, z, h, 0.9, 0.15));
			}
			return { dots, fx, trail: false };
		} },
		{ tag: 'SH6', cat: 'shapes', name: 'Bloom', note: 'Buds rise one by one, open into flowers and turn, then close back into dots and sink.', show: 4.4, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => { const c = i * 0.1, up = easeInOut(seg(p, c, c + 0.18)), open = backOut(seg(p, c + 0.16, c + 0.3), 1.6), close = easeInOut(seg(p, c + 0.42, c + 0.54)), down = easeInOut(seg(p, c + 0.5, c + 0.64)), m = clamp(open) * (1 - close); return pt(30 + i * 13.3, lerp(66, 44, up * (1 - down)), { shape: 'flower', m, s: 0.8 + 0.7 * m, rot: 72 * seg(p, c + 0.2, c + 0.6), g: m * 0.6 }); }), fx: [{ l: 'M22 68L78 68', a: 0.25, w: 1.5, keep: true }], trail: false };
		} },
		{ tag: 'SH7', cat: 'shapes', name: 'Plus', note: 'They gather into a cross, each becomes a plus sign and the whole turns a quarter, then they come apart as dots.', show: 4, loop: true, run(p) {
			const gather = easeInOut(seg(p, 0.05, 0.3)), spin = backOut(seg(p, 0.4, 0.62), 1.4), part = easeInOut(seg(p, 0.75, 0.97)), m = clamp(seg(p, 0.28, 0.38)) * (1 - seg(p, 0.66, 0.76)), k = gather * (1 - part), turn = Math.PI / 2 * clamp(spin, 0, 1.2);
			return { dots: [0, 1, 2, 3].map((i) => { const home = ringAt(i, 28), a = -Math.PI / 2 + i * Math.PI / 2 + turn, near = [50 + 12 * Math.cos(a), 50 + 12 * Math.sin(a)], [x, y] = mix2(home, near, k); return pt(x, y, { shape: 'plus', m, s: 1 + 0.3 * m, rot: deg(turn), g: m * 0.5 }); }), fx: [], trail: false };
		} },
		{ tag: 'SH8', cat: 'shapes', name: 'Parade', note: 'Turning slowly round, each dot takes its turn to become something, a square, a diamond, a star, a heart, and goes back.', show: 5, loop: true, run(p) {
			const SHAPES = ['square', 'diamond', 'star', 'heart'];
			return { dots: [0, 1, 2, 3].map((i) => { const c = 0.1 + i * 0.2, m = clamp(backOut(seg(p, c, c + 0.08), 1.5), 0, 1.15) * (1 - easeInOut(seg(p, c + 0.14, c + 0.22))), a = -Math.PI / 2 + i * Math.PI / 2 + Math.PI / 2 * p; return pt(50 + 24 * Math.cos(a), 50 + 24 * Math.sin(a), { shape: SHAPES[i], m, s: 1 + 0.35 * m, g: m * 0.5 }); }), fx: [], trail: false };
		} },
		{ tag: 'SH9', cat: 'shapes', name: 'Comets', note: 'On an elliptical orbit each dot whips round close in, drawn into a teardrop by its speed, and rounds out again far away where it slows.', show: 4, loop: true, run(p) {
			const a = 30, e = 0.65, b = a * Math.sqrt(1 - e * e), pos = (M) => { const E = kepler(M, e); return [50 + a * Math.cos(E), 50 + b * Math.sin(E)]; };
			return { dots: [0, 1, 2, 3].map((i) => { const M = TAU * (p + i / 4), P = pos(M), Q = pos(M + 0.02), vx = Q[0] - P[0], vy = Q[1] - P[1], v = Math.hypot(vx, vy), m = clamp((v - 0.6) / 2); return pt(P[0], P[1], { shape: 'drop', m, rot: deg(Math.atan2(vy, vx)) - 90, g: m }); }), fx: [{ e: [50, 50, a, b, 0], a: 0.1, w: 1, keep: true }, { c: [50 + a * e, 50, 2], a: 0.5, keep: true }], trail: true };
		} },
		{ tag: 'SH10', cat: 'shapes', name: 'Gems', note: 'They drop to the floor and crystallise into diamonds that sparkle, then melt back into dots and float away. A new fall each time.', show: 4.4, fade: [0.05, 0.9], run(p, R) {
			const S = this.show, fx = [floor()];
			const dots = [0, 1, 2, 3].map((i) => {
				const x = -14 + i * 9 + (R[i] - 0.5) * 4, z = 62 + R[4 + i] * 14, t0 = 0.05 + i * 0.07, b = dropBounce(Math.max(0, (p - t0) * S), 30, 300, 0.4), firstHit = t0 + Math.sqrt(60 / 300) / S;
				const m = clamp(seg(p, firstHit, firstHit + 0.05)) * (1 - seg(p, 0.62 + i * 0.03, 0.72 + i * 0.03)), melt = pulse(seg(p, 0.62 + i * 0.03, 0.78 + i * 0.03)), rise = easeIn(seg(p, 0.8, 1)), sq = squash(b);
				if (p > firstHit && p < firstHit + 0.06) { const P = P3(x, 2, z); fx.push({ c: [P.x, P.y, 6 * seg(p, firstHit, firstHit + 0.06) * P.k], a: 0.3 }); }
				fx.push(wsh(x, z, b.h + rise * 30, 1.1));
				return wpt(x, b.h + BR(1.1) + rise * 30, z, 1.1, { shape: 'diamond', m, sx: sq.sx + 0.4 * melt, sy: sq.sy - 0.35 * melt, g: m * twinkle(p, i * 0.3, 6), a: p < t0 ? 0 : 1 });
			});
			return { dots, fx, trail: false };
		} },
		{ tag: 'SH11', cat: 'shapes', name: 'Honeycomb', note: 'The four drift together and turn into hexagons that fit into a honeycomb, hold, then pop apart into dots and drift home.', show: 4.4, loop: true, run(p) {
			const gather = easeInOut(seg(p, 0.05, 0.32)), m = clamp(backOut(seg(p, 0.3, 0.42), 1.4), 0, 1.1) * (1 - seg(p, 0.7, 0.74)), pop = seg(p, 0.7, 1), k = gather * (1 - clamp(backOut(pop, 1.2), 0, 1.1)), r = dotR(1.2) * 1.1, cells = [[-r * 0.95, -r * 0.82], [r * 0.95, -r * 0.82], [-r * 0.95, r * 0.82], [r * 0.95, r * 0.82]], fx = [];
			if (pop > 0 && pop < 0.2) fx.push({ c: [50, 50, 8 + 20 * pop / 0.2], a: 0.25 * (1 - pop / 0.2) });
			return { dots: [0, 1, 2, 3].map((i) => { const home = ringAt(i, 28, Math.PI / 4), [x, y] = mix2(home, [50 + cells[i][0], 50 + cells[i][1]], k); return pt(x, y, { shape: 'hex', m, s: 1.2, rot: 30, g: m * 0.15 * (1 + Math.sin(TAU * p * 3)) }); }), fx, trail: false };
		} },
		{ tag: 'SH12', cat: 'shapes', name: 'Star jumps', note: 'A row doing star jumps in a wave: at the top of each jump a dot spreads into a spinning star, and lands a dot again.', show: 3.2, loop: true, run(p) {
			const fx = [floor()];
			return { dots: [-15, -5, 5, 15].map((x, i) => { const z = 66, q = seg(p, 0.06 + i * 0.12, 0.46 + i * 0.12), crouch = pulse(seg(q, 0, 0.2)), air = seg(q, 0.18, 0.86), land = pulse(seg(q, 0.86, 1)), h = 16 * 4 * air * (1 - air), m = pulse(seg(air, 0.2, 0.8)), sq = 0.25 * crouch + 0.3 * land; fx.push(wsh(x, z, h, 1.2)); return wpt(x, h + BR(1.2) * (1 - sq), z, 1.2, { shape: 'star', m, rot: 72 * easeInOut(air), sx: 1 + sq, sy: 1 - sq, g: m * 0.6 }); }), fx, trail: false };
		} },
		// ── Sports ──
		{ tag: 'SR1', cat: 'sports', name: 'Bank shot', note: 'The cue draws back and strikes; the cue ball cuts the object ball, which runs to the cushion, banks off and rolls into the far pocket.', show: 4.2, fade: [0.04, 0.9], run(p) {
			const O = [-10, 74], T = [24, 86.75], Pk = [-23.5, 108], d = norm([T[0] - O[0], T[1] - O[1], 0]), ghost = [O[0] - d[0] * 5.4, O[1] - d[1] * 5.4], C0 = [-21, 56], aim = norm([ghost[0] - C0[0], ghost[1] - C0[1], 0]);
			const back = easeOut(seg(p, 0.02, 0.18)) * (1 - easeIn(seg(p, 0.18, 0.21))), cueT = seg(p, 0.21, 0.32), obT1 = seg(p, 0.32, 0.6), obT2 = seg(p, 0.6, 0.82), drop = seg(p, 0.82, 0.9), br = BR(0.9);
			const cue = cueT < 1 ? mix2(C0, ghost, cueT * 0.7 + easeOut(cueT) * 0.3) : mix2(ghost, [ghost[0] - d[1] * 6, ghost[1] + d[0] * 6], decel(seg(p, 0.32, 0.55)));
			const ob = obT1 < 1 ? mix2(O, T, decel(obT1) * 0.6 + obT1 * 0.4) : mix2(T, Pk, decel(obT2));
			const fx = tableFx(), sA = P3(cue[0] - aim[0] * (3 + 7 * back), br, cue[1] - aim[1] * (3 + 7 * back)), sB = P3(cue[0] - aim[0] * (30 + 7 * back), br + 4, cue[1] - aim[1] * (30 + 7 * back));
			if (p < 0.24) fx.push({ l: `M${f2(sA.x)} ${f2(sA.y)}L${f2(sB.x)} ${f2(sB.y)}`, a: 0.6, w: 2 });
			if (Math.abs(p - 0.32) < 0.02) { const Q = P3(ghost[0], br, ghost[1]); fx.push({ c: [Q.x, Q.y, 5], a: 0.3 }); }
			fx.push(wsh(cue[0], cue[1], 0, 0.9), wsh(ob[0], ob[1], 0, 0.9));
			return { dots: [wpt(cue[0], br, cue[1], 0.9, { g: 0.3 }), wpt(ob[0], br - drop * 4, ob[1], 0.9 * (1 - 0.5 * drop), { a: 1 - drop }), wpt(12, br, 58, 0.9, { a: 0.7 }), wpt(-2, br, 96, 0.9, { a: 0.7 })], fx, trail: p > 0.32 && p < 0.82 };
		} },
		{ tag: 'SR2', cat: 'sports', name: 'Tennis rally', note: 'Down the court and back: over the net, a bounce with a squash, a return. The players shuffle across to meet it and hop as they hit.', show: 3.4, loop: true, reroll: true, run(p, R) {
			const N = [-3, 9, 42], F = [lerp(-9, 9, R[0]), 9, 116], B1 = [lerp(-8, 8, R[1]), 0, 104], B2 = [lerp(-8, 8, R[2]), 0, 58], out = p < 0.5, q = out ? p * 2 : p * 2 - 1;
			const leg = (A, B, s, arc) => [lerp(A[0], B[0], s), lerp(A[1], B[1], s) + arc * 4 * s * (1 - s), lerp(A[2], B[2], s)];
			const ball = out ? (q < 0.62 ? leg(N, B1, q / 0.62, 16) : leg(B1, F, (q - 0.62) / 0.38, 7)) : (q < 0.62 ? leg(F, B2, q / 0.62, 16) : leg(B2, N, (q - 0.62) / 0.38, 7));
			const bc = Math.exp(-Math.abs(q - 0.62) * 50), farX = out ? lerp(0, F[0], easeOut(q)) : lerp(F[0], 0, easeInOut(q)), nearX = out ? lerp(N[0], 0, easeInOut(q)) : lerp(0, N[0], easeOut(q)), hitN = out ? pulse(1 - q / 0.12) : pulse((q - 0.88) / 0.12), hitF = out ? pulse((q - 0.88) / 0.12) : pulse(1 - q / 0.12);
			const fx = [{ l: wline([[-14, 0, 40], [14, 0, 40], [14, 0, 120], [-14, 0, 120], [-14, 0, 40]]), a: 0.35, w: 1.5, keep: true }, { l: wline([[-16, 5, 80], [16, 5, 80]]), a: 0.55, w: 1.5, keep: true }, { l: wline([[-16, 0, 80], [-16, 5, 80]]) + wline([[16, 0, 80], [16, 5, 80]]), a: 0.4, w: 1, keep: true }, wsh(ball[0], ball[2], ball[1], 0.7)];
			return { dots: [wpt(ball[0], ball[1] + BR(0.7), ball[2], 0.7, { sx: 1 + 0.4 * bc, sy: 1 - 0.35 * bc, g: 0.3 }), wpt(nearX, BR(1.6) + 4 * hitN, 40, 1.6), wpt(farX, BR(1.6) + 4 * hitF, 120, 1.6), NONE()], fx, trail: true };
		} },
		{ tag: 'SR3', cat: 'sports', name: 'Basketball', note: 'Two dribbles, a gather and a jump shot on a high arc into the far hoop: swish, the net shakes, and the ball bounces away under it.', show: 4.4, fade: [0.03, 0.9], run(p) {
			const S = this.show, fx = [floor(), { l: wline([[-6, 26, 108], [6, 26, 108], [6, 38, 108], [-6, 38, 108], [-6, 26, 108]]), a: 0.45, w: 1.5, keep: true }, { l: wcircle(0, 104, 2.6, 30, 18), a: 0.7, w: 1.5, keep: true }];
			const swish = seg(p, 0.72, 0.82), wob = swish > 0 && swish < 1 ? Math.sin(swish * 20) * (1 - swish) * 0.8 : 0;
			fx.push({ l: [0, 1, 2, 3, 4, 5].map((k) => { const a = k * TAU / 6; return wline([[2.6 * Math.cos(a), 30, 104 + 2.6 * Math.sin(a)], [1.6 * Math.cos(a) + wob, 23, 104 + 1.6 * Math.sin(a)]]); }).join(''), a: 0.3, w: 1 });
			let ball, jump = 0, crouch = 0;
			if (p < 0.36) { const f = (p / 0.36 * 2) % 1; ball = [4, 12 * (1 - Math.abs(1 - 2 * f)), 46]; }
			else if (p < 0.46) { const q = seg(p, 0.36, 0.46); ball = [lerp(4, 2, q), lerp(0, 16, easeOut(q)), 46]; crouch = pulse(q); }
			else if (p < 0.72) { const q = seg(p, 0.46, 0.72); ball = [lerp(2, 0, q), lerp(20, 30, q) + 26 * 4 * q * (1 - q), lerp(48, 104, q)]; jump = pulse(clamp(q / 0.5)); }
			else if (p < 0.8) ball = [0, lerp(30, 20, seg(p, 0.72, 0.8)), 104];
			else { const b = dropBounce((p - 0.8) * S, 20, 300, 0.5); ball = [lerp(0, 6, seg(p, 0.8, 1)), b.h, lerp(104, 98, seg(p, 0.8, 1))]; }
			fx.push(wsh(ball[0], ball[2], ball[1], 1));
			return { dots: [wpt(ball[0], ball[1] + BR(1), ball[2], 1, { g: p > 0.46 && p < 0.72 ? 0.4 : 0 }), wpt(-2, BR(1.8) * (1 - 0.25 * crouch) + 8 * jump, 44, 1.8, { sx: 1 + 0.25 * crouch, sy: 1 - 0.25 * crouch + 0.1 * jump }), NONE(), NONE()], fx, trail: p > 0.46 && p < 0.8 };
		} },
		{ tag: 'SR4', cat: 'sports', name: 'Penalty', note: 'The run-up, a curling shot into the top corner, the keeper diving full stretch the wrong way, and the net bulging.', show: 4, fade: [0.03, 0.9], run(p) {
			const kick = 0.3, q = seg(p, kick, 0.52), drop = seg(p, 0.52, 0.7), runner = mix2([-10, 30], [-2, 41], easeIn(seg(p, 0, kick))), dive = easeOut(seg(p, kick + 0.03, 0.5)), fall = easeIn(seg(p, 0.5, 0.62)), net = seg(p, 0.52, 0.8), wob = net > 0 && net < 1 ? Math.sin(net * 18) * 2.5 * (1 - net) : 0;
			const ball = p < kick ? [0, 0, 44] : q < 1 ? [lerp(0, 13, q) + 5 * Math.sin(Math.PI * q), 11 * q + 8 * Math.sin(Math.PI * q), lerp(44, 112, q)] : [13, lerp(11, 0, easeIn(drop)), 112 + 6 * drop];
			const fx = [floor(), { l: wline([[-16, 0, 112], [-16, 13, 112], [16, 13, 112], [16, 0, 112]]), a: 0.6, w: 2, keep: true }, { l: wline([[-16, 0, 120], [-16, 13, 120 + wob], [16, 13, 120 + wob], [16, 0, 120]]), a: 0.2, w: 1 }, { l: wline([[-16, 13, 112], [-16, 13, 120 + wob]]) + wline([[16, 13, 112], [16, 13, 120 + wob]]), a: 0.2, w: 1 }, wsh(ball[0], ball[2], ball[1], 1), wsh(lerp(0, -11, dive), 110, 6 * dive * (1 - fall), 1.6)];
			return { dots: [wpt(ball[0], ball[1] + BR(1), ball[2], 1, { g: q > 0 && q < 1 ? 0.5 : 0 }), wpt(lerp(0, -11, dive), BR(1.6) + 6 * dive * (1 - fall), 110, 1.6, { sx: 1 + 0.7 * dive, sy: 1 - 0.3 * dive, rot: -25 * dive }), wpt(runner[0], BR(1.4) + 1.5 * Math.abs(Math.sin(p * 40)) * (p < kick ? 1 : 0), runner[1], 1.4, { a: 0.8 }), wpt(0, 0.2, 44, 0.4, { a: 0.4 })], fx, trail: q > 0 && q < 1 };
		} },
		{ tag: 'SR5', cat: 'sports', name: 'Golf putt', note: 'A putt across the green that breaks right to left, dying as it nears the hole, curling round the lip and dropping in.', show: 4.4, fade: [0.04, 0.9], run(p) {
			const roll = decel(seg(p, 0.12, 0.78)), [x, z] = bez2([-6, 46], [-16, 84], [6, 100], roll), lip = seg(p, 0.76, 0.84), drop = seg(p, 0.82, 0.88), swing = pulse(seg(p, 0, 0.14)), bx = x + Math.cos(lip * 5) * 1.2 * pulse(lip), bz = z + Math.sin(lip * 5) * 1.2 * pulse(lip);
			const fx = [{ l: wcircle(0, 78, 34), a: 0.14, w: 1, keep: true }, { l: wcircle(6, 100, 1.8, 0, 16), a: 0.7, w: 1.5, keep: true }, { l: wline([[6, 0, 100], [6, 22, 100]]), a: 0.6, w: 1.5, keep: true }, { l: wline([[6, 22, 100], [12, 19.5, 100], [6, 17, 100]]) + 'Z', a: 0.6, w: 1.5, keep: true }, wsh(bx, bz, 0, 0.8)];
			return { dots: [wpt(bx, BR(0.8) - drop * 3, bz, 0.8 * (1 - 0.4 * drop), { a: 1 - drop }), wpt(-8 - 4 * swing, 2, 44, 0.9, { sx: 0.6, sy: 1.6, rot: -20 * swing, a: 0.7 }), NONE(), NONE()], fx, trail: false };
		} },
		{ tag: 'SR6', cat: 'sports', name: 'Bowling', note: 'A hooking ball rolls away down the lane and hits the pocket: the three pins scatter, spinning.', show: 4, fade: [0.03, 0.92], run(p) {
			const roll = seg(p, 0.04, 0.58), imp = seg(p, 0.58, 1), e = easeOut(imp), z = lerp(38, 150, roll * 0.85 + easeIn(roll) * 0.15), x = 4 - 6 * Math.pow(roll, 2.2), fx = [{ l: wline([[-7, 0, 34], [-7, 0, 170]]) + wline([[7, 0, 34], [7, 0, 170]]), a: 0.35, w: 1.5, keep: true }, { l: wline([[-7, 0, 44], [7, 0, 44]]), a: 0.3, w: 1, keep: true }];
			const pins = [[0, 150], [-2.6, 155], [2.6, 155]], dirs = [[0.2, 1.2], [-1.2, 0.8], [1.2, 0.9]];
			if (imp > 0 && imp < 0.15) { const P = P3(0, 3, 152); fx.push({ c: [P.x, P.y, 10 * imp / 0.15 * P.k], a: 0.3 * (1 - imp / 0.15) }); }
			const bx = p < 0.58 ? x : -2 + 2 * e, bz = p < 0.58 ? z : 150 + 25 * e;
			fx.push(wsh(bx, bz, 0, 1.4));
			return { dots: [wpt(bx, BR(1.4), bz, 1.4, { g: 0.2, a: 1 - 0.8 * e })].concat(pins.map(([px, pz], i) => { const h = 10 * 4 * e * (1 - e) * (1 - i * 0.2), X = px + dirs[i][0] * 12 * e, Z = pz + dirs[i][1] * 10 * e, tilt = 180 * e * (i % 2 ? 1 : -1) * clamp(imp * 3), A = P3(X, h, Z), B = P3(X + 4 * Math.sin(tilt * Math.PI / 180), h + 4 * Math.cos(tilt * Math.PI / 180), Z); return stick(A, B, 0.55 * A.k * 0.6 * 1.4, { a: 1 - 0.5 * imp }); })), fx, trail: p < 0.58 };
		} },
		{ tag: 'SR7', cat: 'sports', name: 'Darts', note: 'Each dart turns into an arrow in flight and thuds into the board, quivers, and settles back into a dot. Somewhere new each time.', show: 4, fade: [0.02, 0.92], run(p, R) {
			const fx = [8, 16, 24].map((r) => ({ o: [50, 50, r], a: 0.3, w: 1.2, keep: true })).concat([{ c: [50, 50, 2], a: 0.5, keep: true }]);
			return { dots: [0, 1, 2, 3].map((i) => { const t0 = 0.08 + i * 0.2, q = seg(p, t0, t0 + 0.12), a = R[i] * TAU, rr = Math.sqrt(R[i + 4]) * 20, tx = 50 + rr * Math.cos(a), ty = 50 + rr * Math.sin(a), since = p - t0 - 0.12, wob = q >= 1 ? 8 * Math.sin(since * 70) * Math.exp(-since * 18) : 0, x = lerp(14, tx, q), y = lerp(80, ty, q) - 12 * pulse(q), vx = tx - 14, vy = ty - 80 - 12 * Math.PI * Math.cos(Math.PI * q); return pt(x, y, { shape: 'arrow', m: q > 0 ? 1 - seg(since, 0.1, 0.2) : 0, rot: deg(Math.atan2(vy, vx)) + 90 + wob, s: lerp(1.3, 0.85, q), a: q > 0 ? 1 : 0, g: q > 0 && q < 1 ? 0.4 : 0 }); }), fx, trail: false };
		} },
		{ tag: 'SR8', cat: 'sports', name: 'Cricket', note: 'The bowler runs in from the far end, the ball pitches and rises, the bat swings and it sails high over the far boundary.', show: 4.4, fade: [0.03, 0.9], run(p) {
			const run = seg(p, 0, 0.3), bz = lerp(160, 132, easeIn(run)), rel = 0.3, bnc = 0.48, hit = 0.56, fx = [floor(), { l: wline([[-4, 0, 40], [-4, 0, 150]]) + wline([[4, 0, 40], [4, 0, 150]]), a: 0.25, w: 1, keep: true }, { l: [-1, 0, 1].map((dx) => wline([[dx, 0, 40], [dx, 6, 40]])).join(''), a: 0.5, w: 1, keep: true }];
			let ball;
			if (p < rel) ball = [1, 14 + 2 * Math.abs(Math.sin(run * 20)), bz];
			else if (p < bnc) { const q = seg(p, rel, bnc); ball = [1, lerp(16, 0, q * q), lerp(132, 72, q)]; }
			else if (p < hit) { const q = seg(p, bnc, hit); ball = [lerp(1, -2, q), 9 * Math.sin(Math.PI * q * 0.5), lerp(72, 44, q)]; }
			else { const q = easeOut(seg(p, hit, 0.95)); ball = [lerp(-2, -30, q), lerp(7, 40, q) + 20 * pulse(q), lerp(44, 140, q)]; }
			const swing = easeInOut(seg(p, 0.5, hit + 0.03)), ang = lerp(-80, 50, swing) * Math.PI / 180, batA = P3(-4, 4, 42), batB = P3(-4 + 8 * Math.sin(ang), 10, 42 - 3 * Math.cos(ang));
			fx.push(wsh(ball[0], ball[2], ball[1], 0.6));
			return { dots: [wpt(ball[0], ball[1] + BR(0.6), ball[2], 0.6, { g: p > hit ? 0.8 : 0.3 }), wpt(0, BR(1.6) + Math.abs(Math.sin(run * 22)) * 2 * (1 - seg(p, 0.3, 0.35)), bz, 1.6), stick(batA, batB, 0.45 * batA.k * 0.6 * 1.4), wpt(-5, BR(1.8), 40, 1.8, { a: 0.7 })], fx, trail: p > hit };
		} },
		{ tag: 'SR9', cat: 'sports', name: 'Relay', note: 'Four legs round the track; each runner surges off as the baton comes, and eases down after handing it on.', show: 5.6, fade: [0.03, 0.93], run(p) {
			const pos = (u) => { const t = -Math.PI / 2 + TAU * u; return [24 * Math.cos(t), 78 + 22 * Math.sin(t)]; }, leg = Math.min(3, Math.floor(p * 4)), q = (p * 4) % 1, [bx, bz] = pos((leg + easeInOut(q)) / 4), B = P3(bx, 6, bz);
			const fx = [{ l: wcircle(0, 78, 24) + wcircle(0, 78, 18), a: 0.2, w: 1, keep: true }, { c: [B.x, B.y, 1.2 * B.k], a: 0.9 }];
			return { dots: [0, 1, 2, 3].map((i) => { const u = i < leg ? (i + 1) / 4 : i === leg ? (i + easeInOut(q)) / 4 : i / 4, [x, z] = pos(u), f = (p * 24 + i / 4) % 1; return wpt(x, BR(1.3) + (i === leg ? 8 * f * (1 - f) : 0), z, 1.3, { a: i === leg ? 1 : (i < leg ? 0.35 : 0.6), g: i === leg ? 0.5 : 0 }); }), fx, trail: true };
		} },
		{ tag: 'SR10', cat: 'sports', name: 'Table tennis', note: 'A quick rally down the table: a bounce on each side, the paddles sliding across to meet every shot.', show: 2.4, loop: true, reroll: true, run(p, R) {
			const N = [-2, 8, 48], F = [lerp(-9, 9, R[0]), 8, 112], B1 = [lerp(-8, 8, R[1]), 0, 96], B2 = [lerp(-8, 8, R[2]), 0, 64], out = p < 0.5, q = out ? p * 2 : p * 2 - 1;
			const leg = (A, B, s, arc) => [lerp(A[0], B[0], s), lerp(A[1], B[1], s) + arc * 4 * s * (1 - s), lerp(A[2], B[2], s)];
			const ball = out ? (q < 0.6 ? leg(N, B1, q / 0.6, 7) : leg(B1, F, (q - 0.6) / 0.4, 5)) : (q < 0.6 ? leg(F, B2, q / 0.6, 7) : leg(B2, N, (q - 0.6) / 0.4, 5));
			const nearX = out ? lerp(N[0], 0, easeInOut(q)) : lerp(0, N[0], easeOut(q)), farX = out ? lerp(0, F[0], easeOut(q)) : lerp(F[0], 0, easeInOut(q));
			const fx = [{ l: wline([[-12, 0, 52], [12, 0, 52], [12, 0, 108], [-12, 0, 108], [-12, 0, 52]]), a: 0.35, w: 1.5, keep: true }, { l: wline([[-13, 3, 80], [13, 3, 80]]), a: 0.55, w: 1.5, keep: true }, wsh(ball[0], ball[2], ball[1], 0.5)];
			return { dots: [wpt(ball[0], ball[1] + BR(0.5), ball[2], 0.5, { g: 0.4 }), wpt(nearX, 8, 46, 1.4, { sx: 1.6, sy: 0.6 }), wpt(farX, 8, 114, 1.4, { sx: 1.6, sy: 0.6 }), NONE()], fx, trail: true };
		} },
		{ tag: 'SR11', cat: 'sports', name: 'Swimming', note: 'Four lanes: a length away, a turn at the far wall, and back; each swimmer a little faster or slower, and the winner glows.', show: 5.6, fade: [0.03, 0.93], run(p, R) {
			const xs = [-12, -4, 4, 12], fx = [{ l: [-16, -8, 0, 8, 16].map((x) => wline([[x, 0, 44], [x, 0, 128]])).join(''), a: 0.2, w: 1, keep: true }, { l: wline([[-16, 0, 128], [16, 0, 128]]) + wline([[-16, 0, 44], [16, 0, 44]]), a: 0.4, w: 2, keep: true }], speeds = xs.map((_, i) => 0.85 + 0.15 * R[i]), win = speeds.indexOf(Math.max(...speeds));
			return { dots: xs.map((x, i) => { const u = clamp(seg(p, 0.04, 0.9) * speeds[i] * 1.12), there = u < 0.5, v = there ? u * 2 : u * 2 - 1, z = there ? lerp(46, 126, easeInOut(v) * 0.2 + v * 0.8) : lerp(126, 46, easeInOut(v) * 0.2 + v * 0.8), stroke = Math.sin(p * 46 + i * 1.7), P = P3(x, 0, z); fx.push({ c: [P.x + stroke * 1.2 * P.k, P.y, 0.9 * P.k], a: u < 1 ? 0.3 : 0 }); return wpt(x + stroke * 0.5, BR(1) * 0.5, z, 1, { sx: 0.8, sy: 1.4, g: u >= 1 && i === win ? 1 : 0 }); }), fx, trail: false };
		} },
		{ tag: 'SR12', cat: 'sports', name: 'Screw back', note: 'Snooker: the cue ball pots the ball into the far pocket and spins back towards you with backspin.', show: 3.8, fade: [0.04, 0.9], run(p) {
			const Rd = [0, 74], Pk = [-23.5, 108], d = norm([Pk[0] - Rd[0], Pk[1] - Rd[1], 0]), C0 = [Rd[0] - d[0] * 26, Rd[1] - d[1] * 26], contact = [Rd[0] - d[0] * 5.4, Rd[1] - d[1] * 5.4], hit = 0.32, br = BR(0.9);
			const back = easeOut(seg(p, 0.02, 0.18)) * (1 - easeIn(seg(p, 0.18, 0.21))), cue = p < hit ? mix2(C0, contact, seg(p, 0.21, hit)) : mix2(contact, [contact[0] - d[0] * 18, contact[1] - d[1] * 18], easeOut(seg(p, hit + 0.04, 0.75))), red = p < hit ? Rd : mix2(Rd, Pk, decel(seg(p, hit, 0.7))), sunk = seg(p, 0.66, 0.74);
			const fx = tableFx(), sA = P3(cue[0] - d[0] * (3 + 7 * back), br, cue[1] - d[1] * (3 + 7 * back)), sB = P3(cue[0] - d[0] * (30 + 7 * back), br + 4, cue[1] - d[1] * (30 + 7 * back));
			if (p < 0.24) fx.push({ l: `M${f2(sA.x)} ${f2(sA.y)}L${f2(sB.x)} ${f2(sB.y)}`, a: 0.6, w: 2 });
			fx.push(wsh(cue[0], cue[1], 0, 0.9), wsh(red[0], red[1], 0, 0.9));
			return { dots: [wpt(cue[0], br, cue[1], 0.9, { g: 0.3 }), wpt(red[0], br - sunk * 4, red[1], 0.9 * (1 - 0.5 * sunk), { a: 1 - sunk }), wpt(14, br, 60, 0.9, { a: 0.6 }), wpt(10, br, 98, 0.9, { a: 0.6 })], fx, trail: p > hit && p < 0.8 };
		} },
		{ tag: 'SR13', cat: 'sports', name: 'Volleyball', note: 'A high set, the spiker\'s jump, the spike down into the far court with a thump, and the ball bouncing away.', show: 4, fade: [0.03, 0.9], run(p) {
			const S = this.show, z = 74; let ball;
			if (p < 0.42) ball = bez2([-14, 8], [-9, 52], [-4, 22], p / 0.42);
			else if (p < 0.55) { const q = easeIn(seg(p, 0.42, 0.55)); ball = [lerp(-4, 14, q), lerp(22, 0, q)]; }
			else { const q = seg(p, 0.55, 1); ball = [lerp(14, 26, decel(q)), dropBounce(q * S * 0.6 + 0.2, 10, 300, 0.5).h]; }
			const jump = pulse(seg(p, 0.3, 0.58)), land = seg(p, 0.55, 0.62), fx = [floor(), { l: wline([[0, 12, 56], [0, 12, 100]]), a: 0.55, w: 1.5, keep: true }, { l: wline([[0, 0, 56], [0, 12, 56]]) + wline([[0, 0, 100], [0, 12, 100]]), a: 0.4, w: 1, keep: true }, wsh(ball[0], z, ball[1], 0.8)];
			if (land > 0 && land < 1) fx.push({ l: wcircle(14, z, 2 + 8 * land), a: 0.4 * (1 - land), w: 1 });
			return { dots: [wpt(ball[0], ball[1] + BR(0.8), z, 0.8, { g: p > 0.42 && p < 0.55 ? 0.8 : 0.2 }), wpt(-6, BR(1.6) + 12 * jump, 72, 1.6, { sy: 1 + 0.15 * jump }), wpt(-16, BR(1.5), 78, 1.5, { a: 0.7 }), NONE()], fx, trail: p > 0.42 && p < 0.6 };
		} },
		{ tag: 'SR14', cat: 'sports', name: 'Curling', note: 'The stone glides away down the ice, curling as it slows, with two sweepers brushing hard ahead of it, and taps another stone on.', show: 5.4, fade: [0.03, 0.92], run(p) {
			const glide = decel(seg(p, 0.05, 0.85)), path = (u) => bez2([5, 42], [8, 86], [-1, 106], u), [x, z] = path(glide), tap = decel(seg(p, 0.82, 1)), ahead = path(Math.min(1, glide + 0.05)), sweeping = glide < 0.9;
			const fx = [{ l: wline([[-12, 0, 36], [-12, 0, 150]]) + wline([[12, 0, 36], [12, 0, 150]]), a: 0.25, w: 1, keep: true }, { l: [3, 7, 11].map((r) => wcircle(0, 112, r)).join(''), a: 0.35, w: 1.2, keep: true }, wsh(x, z, 0, 1.4)];
			const brush = (k) => wpt(ahead[0] + (k ? 3.5 : -3.5) + 1.6 * Math.sin(p * 90 + k * 2), BR(0.6), ahead[1] + 2, 0.6, { a: sweeping ? 0.8 : 0 });
			return { dots: [wpt(x, BR(1.4) * 0.6, z, 1.4, { sy: 0.7 }), wpt(2 + 3 * tap, BR(1.4) * 0.6, 110 + 7 * tap, 1.4, { sy: 0.7, a: 0.75 }), brush(0), brush(1)], fx, trail: false };
		} },
		{ tag: 'SR15', cat: 'sports', name: 'Pool break', note: 'The cue draws back and breaks the rack: the balls scatter, kiss and bounce off the cushions until they roll to rest.', show: 4, fade: [0.03, 0.92], run(p, R) {
			const start = 0.18, back = easeOut(seg(p, 0.02, 0.15)) * (1 - easeIn(seg(p, 0.15, start))), b = poolSim(Math.max(0, p - start) * this.show, R), br = BR(0.9), fx = tableFx(), c = b[0], sA = P3(c.x, br, c.y - 3 - 7 * back), sB = P3(c.x, br + 4, c.y - 30 - 7 * back);
			if (p < start + 0.02) fx.push({ l: `M${f2(sA.x)} ${f2(sA.y)}L${f2(sB.x)} ${f2(sB.y)}`, a: 0.6, w: 2 });
			for (const o of b) fx.push(wsh(o.x, o.y, 0, 0.9));
			return { dots: b.map((o) => wpt(o.x, br, o.y, 0.9, { g: 0.2 })), fx, trail: p > start };
		} },
		{ tag: 'SR16', cat: 'sports', name: 'Speed bag', note: 'Left, right, left: the bag rattles back and forth in a steady rhythm under quick punches.', show: 2, loop: true, run(p) {
			const swing = Math.sin(TAU * p * 6) * 0.9, bag = [50 + 18 * Math.sin(swing), 26 + 18 * Math.cos(swing)], pl = Math.max(0, Math.sin(TAU * p * 3)), pr = Math.max(0, -Math.sin(TAU * p * 3));
			return { dots: [pt(bag[0], bag[1], { s: 1.6, sx: 0.8, sy: 1.15, rot: -deg(swing) }), pt(40 + 4 * pl, 66 - 8 * Math.pow(pl, 3), { s: 1.1 }), pt(60 - 4 * pr, 66 - 8 * Math.pow(pr, 3), { s: 1.1 }), NONE()], fx: [{ l: 'M30 26L70 26', a: 0.5, w: 2, keep: true }, { l: `M50 26L${f2(bag[0])} ${f2(bag[1])}`, a: 0.3, w: 1 }], trail: false };
		} },
		{ tag: 'SR17', cat: 'sports', name: 'Cycling sprint', note: 'Four riders in a paceline round the velodrome; the last swings out wide and sprints past the rest.', show: 5, fade: [0.03, 0.93], run(p) {
			const pos = (u, r) => { const t = -Math.PI / 2 + TAU * u; return [r * Math.cos(t), 78 + r * 0.9 * Math.sin(t)]; }, jump = seg(p, 0.45, 0.9);
			return { dots: [0, 1, 2, 3].map((i) => { const u = p * 1.2 - i * 0.035 + (i === 3 ? 0.17 * easeInOut(jump) : 0), [x, z] = pos(u, i === 3 ? 24 + 4 * pulse(jump) : 24); return wpt(x, BR(1.1), z, 1.1, { g: i === 3 ? jump : 0 }); }), fx: [{ l: wcircle(0, 78, 28) + wcircle(0, 78, 20), a: 0.22, w: 1, keep: true }], trail: true };
		} },
		{ tag: 'SR18', cat: 'sports', name: 'Pétanque', note: 'Three boules lobbed high at the jack; each lands with a thud and a puff of dust, and rolls a little. Different every round.', show: 5, fade: [0.03, 0.92], run(p, R) {
			const jack = [(R[0] - 0.5) * 16, 100], fx = [floor(), wsh(jack[0], jack[1], 0, 0.5)], dots = [wpt(jack[0], BR(0.5), jack[1], 0.5, { g: 0.6 })];
			for (let i = 0; i < 3; i++) {
				const t0 = 0.06 + i * 0.26, q = seg(p, t0, t0 + 0.16), roll = decel(seg(p, t0 + 0.16, t0 + 0.28)), land = [jack[0] + (R[1 + i] - 0.5) * 18, jack[1] - 4 + (R[4 + i] - 0.5) * 16], stop = [land[0] * 1.08, land[1] + 3 + R[7 + i] * 4];
				const pos = q < 1 ? mix2([0, 36], land, q) : mix2(land, stop, roll), h = q < 1 ? 6 + 30 * 4 * q * (1 - q) - 6 * q : 0;
				if (q >= 1 && roll < 0.4) fx.push({ l: wcircle(land[0], land[1], 1 + 6 * roll / 0.4), a: 0.35 * (1 - roll / 0.4), w: 1 });
				fx.push(wsh(pos[0], pos[1], h, 1.1));
				dots.push(wpt(pos[0], h + BR(1.1), pos[1], 1.1, { a: p < t0 ? 0 : 1 }));
			}
			return { dots, fx, trail: false };
		} },
		{ tag: 'SR19', cat: 'sports', name: 'Half-pipe', note: 'A skater rolls down one side of the ramp and up the other, slowing near each lip and popping into the air at the top.', show: 3.4, loop: true, run(p) {
			const R = 28, ramp = poly(Array.from({ length: 41 }, (_, i) => { const t = Math.PI * i / 40; return [50 + R * Math.cos(t), 42 + R * Math.sin(t)]; })) + `M${50 - R} 42L${50 - R - 8} 42M${50 + R} 42L${50 + R + 8} 42`;
			const at = (A) => { const ov = Math.max(0, Math.abs(A) - Math.PI / 2 + 0.05), c = clamp(Math.PI / 2 - A, 0, Math.PI), r = R - dotR(1); return { x: 50 + r * Math.cos(c), y: 42 + r * Math.sin(c) - ov * 26, ov }; };
			return { dots: [0, 1, 2, 3].map((i) => { const P = at(1.85 * Math.cos(TAU * (p - i * 0.015))); return pt(P.x, P.y, { s: 1 - 0.2 * i, a: 1 - 0.25 * i, g: P.ov > 0 && i === 0 ? 0.8 : 0 }); }), fx: [{ l: ramp, a: 0.45, w: 2, keep: true }], trail: false };
		} },
		{ tag: 'SR20', cat: 'sports', name: 'Slalom', note: 'A skier comes down the slope towards you, carving round the gates one side then the other, throwing up spray at each turn.', show: 4.4, fade: [0.03, 0.92], run(p, R) {
			const gates = [150, 124, 100, 80, 62].map((z, i) => [(i % 2 ? 1 : -1) * (6 + R[i] * 3), z]), u = seg(p, 0.04, 0.95), z = lerp(166, 40, u * 0.7 + easeIn(u) * 0.3);
			const xAt = (zz) => { const gi = Math.max(0, gates.findIndex((q) => q[1] < zz + 1e-6)), g = gates[gi] || gates[gates.length - 1], prev = gates[gi - 1] || [0, 170], t = clamp((prev[1] - zz) / (prev[1] - g[1] || 1)); return lerp(prev[0] * 1.6, g[0] * 1.6, easeInOut(t)); };
			const x = xAt(z), lean = xAt(z - 2) - x, fx = [floor()].concat(gates.map(([gx, gz]) => ({ l: wline([[gx, 0, gz], [gx, 8, gz]]), a: 0.6, w: 1.5, keep: true })));
			const dots = [wpt(x, BR(1.2) * 1.2, z, 1.2, { sy: 1.3, rot: -lean * 10 })];
			for (let j = 0; j < 3; j++) { const zz = z + 3 + j * 3, xx = xAt(zz) - (xAt(zz - 2) - xAt(zz)) * 3, P = P3(xx, 2 + j, zz); dots.push(pt(P.x, P.y, { s: 0.4 * P.k * 0.6, a: 0.5 * Math.min(1, Math.abs(lean) * 2) })); }
			fx.push(wsh(x, z, 0, 1.2));
			return { dots, fx, trail: true };
		} },
		// ── Motion modes ──
		{ tag: 'AM1', cat: 'motion', level: 'Most', name: 'The break', note: 'A cue dot breaks a rack of three; they scatter off the ring like a cushion until they come to rest.', show: 3.2, fade: [0.03, 0.92], run(p, R) {
			return { dots: breakSim(p * this.show, R).map((o) => pt(o.x, o.y, { g: 0.3 })), fx: [], trail: true };
		} },
		{ tag: 'AM2', cat: 'motion', level: 'Most', name: 'Swarm', note: 'All four fly free and fast, crossing and looping.', show: 4, loop: true, run(p, R) {
			return { dots: [0, 1, 2, 3].map((i) => { let x = 30 * nzl(p, R[i], 3), y = 30 * nzl(p, R[i + 4], 3); const d = Math.hypot(x, y); if (d > 34) { x *= 34 / d; y *= 34 / d; } return pt(50 + x, 50 + y, { g: 0.5 }); }), fx: [], trail: true };
		} },
		{ tag: 'AM3', cat: 'motion', level: 'Middle', name: "Newton's cradle", note: 'Four hanging dots: the end ones knock back and forth, the middle two only flinch at each knock.', show: 3, loop: true, run(p) {
			const xs = [38, 46.4, 54.8, 63.2], w = Math.sin(TAU * 2 * p) * 0.55, angs = [Math.min(0, w), 0, 0, Math.max(0, w)], knock = Math.exp(-Math.abs(Math.sin(TAU * 2 * p)) * 30), dots = [], fx = [{ l: 'M30 26L70 26', a: 0.5, w: 2, keep: true }];
			for (let i = 0; i < 4; i++) { const x = xs[i] + 28 * Math.sin(angs[i]), y = 26 + 28 * Math.cos(angs[i]), mid = i === 1 || i === 2; fx.push({ l: `M${xs[i]} 26L${f2(x)} ${f2(y)}`, a: 0.35, w: 1.2 }); dots.push(pt(x, y, { s: 0.85, sx: mid ? 1 - 0.12 * knock : 1, sy: mid ? 1 + 0.12 * knock : 1 })); }
			return { dots, fx, trail: false };
		} },
		{ tag: 'AM4', cat: 'motion', level: 'Middle', name: 'Slow orbit', note: 'Half a lap on a tilted orbit, growing as they come towards you.', show: 4, loop: true, run(p) {
			return { dots: [0, 1, 2, 3].map((i) => { const th = -Math.PI / 2 + i * Math.PI / 2 + Math.PI * p, z = Math.sin(th); return pt(50 + 30 * Math.cos(th), 50 + 30 * z * 0.38, { s: Math.pow(2, 0.7 * K.depth * z), a: 0.55 + 0.45 * (z + 1) / 2, z }); }), fx: [{ e: [50, 50, 30, 11.4, 0], a: 0.18, w: 1.5, keep: true }], trail: true };
		} },
		{ tag: 'AM5', cat: 'motion', level: 'Least', name: 'Settle', note: 'They drop to the floor one after another, bounce lower and lower and rest, then float gently back up.', show: 4.4, loop: true, run(p) {
			const S = this.show, rise = easeInOut(seg(p, 0.8, 1)), fx = [floor()];
			return { dots: [-15, -5, 5, 15].map((x, i) => { const z = 66, h0 = 30, t0 = 0.04 + i * 0.07, b = dropBounce(Math.max(0, (p - t0) * S), h0, 300, 0.5), h = p < t0 ? h0 : (p < 0.8 ? b.h : lerp(b.h, h0, rise)), sq = p < 0.8 && p >= t0 ? squash(b) : { sx: 1, sy: 1 }; fx.push(wsh(x, z, h, 1.2)); return wpt(x + 1.2 * Math.sin(TAU * rise + i) * rise * (1 - rise), h + BR(1.2) * sq.sy, z, 1.2, { sx: sq.sx, sy: sq.sy }); }), fx, trail: false };
		} },
		{ tag: 'AM6', cat: 'motion', level: 'Least', name: 'Breathe', note: 'They stay on the ring and only breathe, like the calm pulse.', show: 3, loop: true, run(p) {
			const b = Math.pow(Math.sin(Math.PI * p * 2), 2);
			return { dots: [0, 1, 2, 3].map((i) => { const [x, y] = ringAt(i); return pt(x, y, { s: 1 + 0.3 * b, a: 0.55 + 0.45 * b, g: b }); }), fx: [], trail: false };
		} }
	];

	// ─── Drawing ───
	// The shapes a dot can turn into, each as its distance from the middle at
	// SHAPE_N angles round it (1 is the dot's own edge), so a dot melts into a
	// shape and back point by point.
	const SHAPE_N = 48;
	const SHAPE_PTS = {
		square: [[-0.92, -0.92], [0.92, -0.92], [0.92, 0.92], [-0.92, 0.92]],
		diamond: [[0, -1.3], [1, 0], [0, 1.3], [-1, 0]],
		star: Array.from({ length: 10 }, (_, i) => { const t = -Math.PI / 2 + i * Math.PI / 5, m = i % 2 ? 0.55 : 1.4; return [m * Math.cos(t), m * Math.sin(t)]; }),
		spark: Array.from({ length: 8 }, (_, i) => { const t = -Math.PI / 2 + i * Math.PI / 4, m = i % 2 ? 0.38 : 1.6; return [m * Math.cos(t), m * Math.sin(t)]; }),
		arrow: [[0, -1.5], [1, 0.8], [0, 0.4], [-1, 0.8]],
		plus: (() => { const w = 0.38, L = 1.25; return [[-w, -L], [w, -L], [w, -w], [L, -w], [L, w], [w, w], [w, L], [-w, L], [-w, w], [-L, w], [-L, -w], [-w, -w]]; })(),
		hex: Array.from({ length: 6 }, (_, i) => { const t = i * Math.PI / 3; return [1.1 * Math.cos(t), 1.1 * Math.sin(t)]; }),
		heart: Array.from({ length: 40 }, (_, i) => { const t = TAU * i / 40; return [16 * Math.pow(Math.sin(t), 3) / 15, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 15 - 0.25]; }),
		drop: [[0, -1.65]].concat(Array.from({ length: 19 }, (_, i) => { const a = (-40 + i * 260 / 18) * Math.PI / 180; return [0.95 * Math.cos(a), 0.15 + 0.95 * Math.sin(a)]; }))
	};
	const SHAPE_RAD = {};
	function radial(shape) {
		if (SHAPE_RAD[shape]) return SHAPE_RAD[shape];
		const out = new Array(SHAPE_N), P = SHAPE_PTS[shape];
		for (let i = 0; i < SHAPE_N; i++) {
			const th = TAU * i / SHAPE_N, dx = Math.cos(th), dy = Math.sin(th);
			if (shape === 'flower') { out[i] = 0.78 + 0.42 * Math.cos(5 * th); continue; }
			let hit = Infinity;
			if (P) for (let j = 0; j < P.length; j++) {
				const a = P[j], b = P[(j + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
				if (Math.abs(den) < 1e-9) continue;
				const t = (a[0] * ey - a[1] * ex) / den, u = (a[0] * dy - a[1] * dx) / den;
				if (t > 0 && u >= 0 && u <= 1) hit = Math.min(hit, t);
			}
			out[i] = isFinite(hit) ? hit : 1;
		}
		return (SHAPE_RAD[shape] = out);
	}

	function fxStr(x) {
		const a = x.a ?? 1;
		if (a <= 0.005) return '';
		const o = ` opacity="${a.toFixed(3)}"`;
		if (x.c) return `<circle class="ap-fxc" cx="${f2(x.c[0])}" cy="${f2(x.c[1])}" r="${f2(Math.max(0, x.c[2]))}"${o}/>`;
		if (x.hl) return `<circle class="ap-fxhl" cx="${f2(x.hl[0])}" cy="${f2(x.hl[1])}" r="${f2(Math.max(0, x.hl[2]))}"${o}/>`;
		if (x.sh) return `<ellipse class="ap-fxc" cx="${f2(x.sh[0])}" cy="${f2(x.sh[1])}" rx="${f2(Math.max(0, x.sh[2]))}" ry="${f2(Math.max(0, x.sh[3]))}"${o}/>`;
		if (x.sd) return `<ellipse class="ap-fxdark" cx="${f2(x.sd[0])}" cy="${f2(x.sd[1])}" rx="${f2(Math.max(0, x.sd[2]))}" ry="${f2(Math.max(0, x.sd[3]))}" transform="rotate(${f2(x.sd[4] || 0)} ${f2(x.sd[0])} ${f2(x.sd[1])})"${o}/>`;
		if (x.bg) return `<circle class="ap-fxbg" cx="${f2(x.bg[0])}" cy="${f2(x.bg[1])}" r="${f2(x.bg[2])}"${o}/>`;
		if (x.pb) return `<path class="ap-fxbg" d="${x.pb}"${o}/>`;
		if (x.pf) return `<path class="ap-fxc" d="${x.pf}"${o}/>`;
		if (x.pd) return `<path class="ap-fxdark" d="${x.pd}"${o}/>`;
		const w = ` stroke-width="${f2((x.w || 2) * K.k)}"`;
		if (x.o) return `<circle class="ap-fxl" cx="${f2(x.o[0])}" cy="${f2(x.o[1])}" r="${f2(Math.max(0, x.o[2]))}"${w}${o}/>`;
		if (x.l) return `<path class="ap-fxl" d="${x.l}"${w}${o}/>`;
		if (x.e) return `<ellipse class="ap-fxl" cx="${x.e[0]}" cy="${x.e[1]}" rx="${x.e[2]}" ry="${x.e[3]}" transform="rotate(${x.e[4]} ${x.e[0]} ${x.e[1]})"${w}${o}/>`;
		return '';
	}
	// A dot, or a dot part way into a shape (m), about its centre.
	function dotStr(q, r) {
		if (r <= 0 || q.a <= 0.01) return '';
		const a = ` opacity="${q.a.toFixed(3)}"`, tf = ` transform="translate(${f2(q.x)} ${f2(q.y)}) rotate(${f2(q.rot || 0)}) scale(${f2(q.sx || 1)} ${f2(q.sy || 1)})"`;
		if (!q.shape || !(q.m > 0.005)) return `<circle class="ap-dot"${tf} r="${f2(r)}"${a}/>`;
		const rad = radial(q.shape), m = Math.min(1.2, q.m);
		let d = '';
		for (let i = 0; i < SHAPE_N; i++) { const th = TAU * i / SHAPE_N, rr = r * lerp(1, rad[i], m); d += (i ? 'L' : 'M') + f2(rr * Math.cos(th)) + ' ' + f2(rr * Math.sin(th)); }
		return `<path class="ap-dot"${tf} d="${d}Z"${a}/>`;
	}
	const halo = (x, y, r, a) => `<circle class="ap-dot" cx="${f2(x)}" cy="${f2(y)}" r="${f2(Math.max(0, r))}" opacity="${a.toFixed(3)}"/>`;

	let stageCount = 0;
	function makeStage(def) {
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('role', 'img');
		svg.setAttribute('aria-label', def.name + ', animated');
		// Everything the scene draws stays inside the ring.
		const defs = document.createElementNS(NS, 'defs'), clip = document.createElementNS(NS, 'clipPath'), cc = document.createElementNS(NS, 'circle');
		clip.id = 'ap-clip-' + (++stageCount);
		cc.setAttribute('cx', '50'); cc.setAttribute('cy', '50'); cc.setAttribute('r', '37.5');
		clip.append(cc); defs.append(clip);
		const ring = document.createElementNS(NS, 'circle');
		ring.setAttribute('class', 'ap-ring'); ring.setAttribute('cx', '50'); ring.setAttribute('cy', '50'); ring.setAttribute('r', '40');
		const layer = document.createElementNS(NS, 'g');
		layer.setAttribute('clip-path', `url(#${clip.id})`);
		svg.append(defs, ring, layer);
		return { def, svg, layer, hist: [], t: Math.random() * def.show * 0.3, prev: 0, n: 0, R: null, seen: false, failed: false };
	}

	// One frame of a stage. A loop scene wraps straight round; any other
	// fades out, rests a moment unseen and comes back with new random numbers.
	function frame(st, push) {
		const d = st.def, SHOW = d.show, rest = d.loop ? 0 : (d.rest ?? 0.35), t = st.t % (SHOW + rest);
		if (!st.R) st.R = rnd();
		if (t < st.prev) { st.n++; if (!d.loop || d.reroll) st.R = rnd(); if (!d.loop) st.hist.forEach((h) => { h.length = 0; }); }
		st.prev = t;
		const p = Math.min(1, t / SHOW), o = d.run(p, st.R, st.n), env = d.fade ? seg(p, 0, d.fade[0]) * (1 - seg(p, d.fade[1], 1)) : 1, ground = dotR(1);
		const dots = o.dots.map((q) => Object.assign({}, q, { a: q.a * env })), fx = o.fx.map((x) => x.keep || env === 1 ? x : Object.assign({}, x, { a: (x.a ?? 1) * env }));
		let s = fx.filter((x) => !x.top).map(fxStr).join('');
		for (let i = 0; i < dots.length; i++) {
			const hs = st.hist[i] || (st.hist[i] = []), q = dots[i], r = ground * q.s;
			if (push) { if (o.trail && K.trail > 0 && env > 0.05) { hs.push([q.x, q.y, r]); while (hs.length > K.trail) hs.shift(); } else if (hs.length) hs.shift(); }
			hs.forEach((v, j) => { const w = (j + 1) / (hs.length + 1); s += halo(v[0], v[1], v[2] * (0.35 + 0.5 * w), 0.28 * w * q.a); });
		}
		// Front ones over the back ones.
		const order = dots.map((q, i) => i).sort((i, j) => (dots[i].z || 0) - (dots[j].z || 0));
		const dotsStr = order.map((i) => { const q = dots[i]; return (q.g > 0 && q.a > 0 && K.glow > 0 ? halo(q.x, q.y, ground * q.s * 2.6, 0.2 * q.g * q.a * K.glow) : '') + dotStr(q, ground * q.s); }).join('');
		const topStr = fx.filter((x) => x.top).map(fxStr).join('');
		// Most scenes put their top extras over the dots; one walking in front
		// of a horizon (front) puts the dots over them.
		st.layer.innerHTML = o.front ? s + topStr + dotsStr : s + dotsStr + topStr;
	}

	// ─── The page ───
	const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
	const root = document.documentElement;
	const lib = document.getElementById('ap-library'), statusEl = document.getElementById('ap-status');
	const loopBox = document.getElementById('ap-loop-stage'), loopName = document.getElementById('ap-loop-name'), loopCount = document.getElementById('ap-loop-count');
	if (!lib || !statusEl || !loopBox || !loopName || !loopCount) { TDC.error(AREA, 'the page is missing parts it needs.'); return; }

	// The marks: which animations are in the dots' loop. Kept in this browser.
	const siteIds = [];
	let active = null;
	function loadMarks() {
		try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (Array.isArray(v)) active = new Set(v); } catch (err) { console.warn('[' + AREA + '] could not read the marks; starting from the site\'s moves.', err); }
		if (!active) active = new Set(siteIds);
	}
	function saveMarks() {
		try { localStorage.setItem(STORE, JSON.stringify([...active])); }
		catch (err) { TDC.error(AREA, 'could not keep the marks in this browser; they last for this visit only.', err, statusEl); }
	}

	// The sliders.
	const sliderBox = document.getElementById('ap-sliders'), inputs = {};
	for (const [key, label, min, max, step, unit] of SLIDERS) {
		const f = el('div', 'field ap-slider'), lab = el('label'), out = el('output'), inp = el('input');
		inp.type = 'range'; inp.id = 'ap-' + key; inp.min = min; inp.max = max; inp.step = step; inp.value = K[key];
		inp.setAttribute('data-control', 'none');
		lab.htmlFor = inp.id; lab.append(label + ': ', out);
		const show = () => { K[key] = +inp.value; out.textContent = unit === '×' ? '×' + K[key].toFixed(2) : K[key] + unit; if (key === 'stage') root.style.setProperty('--ap-stage', K.stage + 'rem'); if (key === 'kr') root.style.setProperty('--ap-kr', K.kr); };
		inp.addEventListener('input', show);
		f.append(lab, inp); sliderBox.append(f); inputs[key] = { inp, show };
		show();
	}
	document.getElementById('ap-reset').addEventListener('click', () => { for (const key in inputs) { inputs[key].inp.value = DEFAULTS[key]; inputs[key].show(); } });

	// A site move in a card: the real dots in a frame, loaded only while the
	// card is on screen (each frame runs its own dots).
	const moveSrc = (name) => '/sandbox/animations/move/?m=' + encodeURIComponent(name);
	const frames = new IntersectionObserver((list) => {
		for (const e of list) { const f = e.target, src = f.getAttribute('src'); if (e.isIntersecting) { if (src !== f.dataset.src) f.setAttribute('src', f.dataset.src); } else if (src && src !== 'about:blank') f.setAttribute('src', 'about:blank'); }
	}, { rootMargin: '150px' });
	function siteFrame(name) {
		const f = el('iframe', 'ap-move');
		f.title = name + ', on the real dots';
		f.dataset.src = moveSrc(name);
		f.setAttribute('tabindex', '-1');
		return f;
	}

	// The cards.
	const stages = [], cards = [], defs = {};
	const seen = new IntersectionObserver((list) => { for (const e of list) e.target.apStage.seen = e.isIntersecting; });
	function activeSwitch(id, name) {
		const lab = el('label', 'ap-active'), box = el('input');
		box.type = 'checkbox'; box.id = 'ap-on-' + id.replace(/[^a-z0-9]/gi, '-');
		box.checked = active.has(id);
		box.setAttribute('aria-label', 'In the loop: ' + name);
		box.addEventListener('change', () => { if (box.checked) active.add(id); else active.delete(id); saveMarks(); count(); loopList(); });
		lab.append(box, el('span', null, 'In the loop'));
		return lab;
	}

	function build() {
		const names = (typeof TDCDots !== 'undefined') ? { solo: TDCDots.moves, group: TDCDots.groups } : { solo: [], group: [] };
		if (typeof TDCDots === 'undefined') TDC.error(AREA, 'dots.js is not loaded, so the site\'s moves cannot be listed.', null, statusEl);
		for (const n of names.solo.concat(names.group)) siteIds.push('site:' + n);
		loadMarks();
		const filterBox = document.getElementById('ap-filters');
		for (const [cat, title, blurb] of CATS) {
			const sec = el('section', 'sb-section ap-cat'), grid = el('div', 'ap-grid');
			sec.dataset.cat = cat;
			sec.append(el('h2', null, title), el('p', 'muted', blurb), grid);
			lib.append(sec);
			const chip = el('button', 'ap-chip', title);
			chip.type = 'button'; chip.dataset.cat = cat; chip.setAttribute('aria-pressed', 'true');
			chip.addEventListener('click', () => { chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); applyFilter(); });
			filterBox.append(chip);
			if (cat === 'site') {
				for (const [kind, list] of [['Solo', names.solo], ['Group', names.group]]) for (const n of list) {
					const id = 'site:' + n, card = el('article', 'ap-card'), stage = el('div', 'ap-stage'), head = el('h3'), f = siteFrame(n);
					card.dataset.id = id; card.dataset.cat = cat; card.dataset.name = n.toLowerCase();
					stage.append(f); frames.observe(f);
					head.append(el('span', 'ap-tag', kind), document.createTextNode(n));
					card.append(stage, head, el('p', 'muted', SITE[n] || 'On the site.'), activeSwitch(id, n));
					grid.append(card); cards.push(card);
					defs[id] = { site: n, name: n, tag: kind };
				}
				continue;
			}
			for (const def of LIB.filter((d) => d.cat === cat)) {
				const st = makeStage(def), card = el('article', 'ap-card'), stage = el('div', 'ap-stage'), head = el('h3'), err = el('div', 'status');
				card.dataset.id = def.tag; card.dataset.cat = cat; card.dataset.name = (def.tag + ' ' + def.name).toLowerCase();
				stage.append(st.svg); stage.apStage = st; seen.observe(stage);
				head.append(el('span', 'ap-tag', def.tag), document.createTextNode(def.name));
				card.append(stage, head);
				if (def.level) card.append(el('span', 'ap-level', def.level));
				card.append(el('p', 'muted', def.note), err, activeSwitch(def.tag, def.name));
				st.err = err;
				grid.append(card); cards.push(card); stages.push(st);
				defs[def.tag] = def;
			}
		}
		applyFilter();
		loopList();
	}

	// Filters: category chips, active only, search.
	const activeOnly = document.getElementById('ap-active-only'), search = document.getElementById('ap-search'), countEl = document.getElementById('ap-count');
	function applyFilter() {
		const on = new Set([...document.querySelectorAll('.ap-chip[aria-pressed="true"]')].map((c) => c.dataset.cat)), q = search.value.trim().toLowerCase();
		for (const c of cards) c.hidden = !on.has(c.dataset.cat) || (activeOnly.checked && !active.has(c.dataset.id)) || (q && !c.dataset.name.includes(q));
		for (const sec of lib.querySelectorAll('.ap-cat')) sec.hidden = !sec.querySelector('.ap-card:not([hidden])');
		count();
	}
	function count() {
		countEl.textContent = `${cards.length} animations: ${siteIds.length} on the site, ${LIB.length} new. Showing ${cards.filter((c) => !c.hidden).length}. In the loop: ${active.size}.`;
	}
	activeOnly.addEventListener('change', applyFilter);
	search.addEventListener('input', applyFilter);

	document.getElementById('ap-copy').addEventListener('click', async () => {
		const list = [...active].sort(), text = 'Dots loop (' + list.length + '):\n' + list.join('\n');
		try { await navigator.clipboard.writeText(text); TDC.status(statusEl, 'Copied ' + list.length + ' names.', 'success'); }
		catch (err) { console.warn('[' + AREA + '] the clipboard refused; showing the list instead.', err); TDC.status(statusEl, text, ''); }
	});

	// ─── The loop (UV, 1 Nov) ───
	// Every animation marked "In the loop", one after another in the page's
	// order, on one big stage: a new scene for a few of its loops (about six
	// seconds), a site move on the real dots for six seconds.
	let order = [], at = 0, loopSt = null, loopLeft = 0;
	function loopList() {
		order = cards.map((c) => c.dataset.id).filter((id) => active.has(id) && defs[id]);
		if (at >= order.length) at = 0;
		if (!order.length) { loopBox.replaceChildren(); loopSt = null; loopName.textContent = 'Nothing is marked "In the loop" yet.'; loopCount.textContent = ''; return; }
		if (!loopBox.firstChild) showLoop();
		else loopCount.textContent = (at + 1) + ' of ' + order.length;
	}
	function showLoop() {
		if (!order.length) return;
		const d = defs[order[at]];
		let child;
		if (d.site) { child = el('iframe', 'ap-move'); child.title = d.name + ', on the real dots'; child.setAttribute('src', moveSrc(d.site)); loopSt = null; loopLeft = 6; }
		else { loopSt = makeStage(d); loopSt.seen = true; loopSt.t = 0; child = loopSt.svg; loopLeft = (d.show + (d.loop ? 0 : (d.rest ?? 0.35))) * Math.max(1, Math.round(6 / d.show)); }
		loopBox.replaceChildren(child);
		child.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
		loopName.textContent = (d.site ? 'On the site: ' : d.tag + ' ') + d.name;
		loopCount.textContent = (at + 1) + ' of ' + order.length;
	}
	const step = (k) => { if (!order.length) return; at = (at + k + order.length) % order.length; showLoop(); };
	document.getElementById('ap-loop-prev').addEventListener('click', () => step(-1));
	document.getElementById('ap-loop-next').addEventListener('click', () => step(1));

	// Play and pause; less motion starts paused.
	const reduced = (typeof TDCPrefs !== 'undefined') ? TDCPrefs.lessMotion : matchMedia('(prefers-reduced-motion: reduce)').matches;
	let playing = !reduced;
	const playBtn = document.getElementById('ap-play');
	playBtn.textContent = playing ? 'Pause' : 'Play';
	playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; });

	let last = performance.now();
	function advance(st, dt) {
		if (playing) st.t += dt * K.speed;
		try { frame(st, playing); }
		catch (err) { st.failed = true; TDC.error(AREA, st.def.tag + ' ' + st.def.name + ' failed to draw.', err, st.err || statusEl); }
	}
	function tick(now) {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		for (const st of stages) if (st.seen && !st.failed) advance(st, dt);
		if (loopSt && !loopSt.failed) advance(loopSt, dt);
		if (playing && order.length) { loopLeft -= dt * (loopSt ? K.speed : 1); if (loopLeft <= 0) step(1); }
		requestAnimationFrame(tick);
	}

	TDCLoader.hold((async () => { build(); requestAnimationFrame(tick); })(), AREA);
})();
