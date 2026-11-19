// The player star (UV, 19 Nov; docs/design/player-star.md), defined once:
// UV's standards, the counting from a player's frames, and the drawing. Used
// by the player profile (player.js) and its sandbox (sandbox-star.js).
//
// Five spokes, each a rate: successes out of chances, measured against UV's
// standard for it, never against other players. Every player starts with
// `start` frames played exactly at the standard, so a few real frames move a
// spoke only a little:
//
//   shown = (successes + start × standard) / (chances + start)
//
// The standard is the grey ring halfway out. Ratio: shown ÷ standard, twice
// the standard at the edge. Points: shown − standard, `range` points at the
// edge (above) or the centre (below). How solid a star is follows frames
// played. A spoke with no chances sits on the standard, its label greyed with
// "no data" (UV, 19 Nov). No dots at the corners: the line only (UV, 19 Nov).

const TDCStar = (() => {
	// The spokes, clockwise from the top. n and d name the counts below. The
	// standards and starting frames are UV's (19 Nov).
	const SPOKES = [
		{ key: 'win',   label: 'Win rate',    short: 'Win',       n: 'fw',  d: 'fp', std: 50, start: 100,
			help: 'Frames won out of frames played.' },
		{ key: 'own',   label: 'Own break',   short: 'Own brk',   n: 'bw',  d: 'b',  std: 70, start: 50,
			help: 'Frames won out of the frames they broke.' },
		{ key: 'their', label: 'Their break', short: 'Their brk', n: 'obw', d: 'ob', std: 40, start: 50,
			help: 'Frames won out of the frames their opponent broke.' },
		{ key: 'in',    label: 'Break in',    short: 'Brk in',    n: 'i',   d: 'r',  std: 50, start: 10,
			help: 'Breaks with a ball in, out of their breaks with a result recorded.' },
		{ key: 'bf',    label: 'B&F',         short: 'B&F',       n: 'bf',  d: 'b',  std: 10, start: 100,
			help: 'Break & finish or golden break, out of the frames they broke.' }
	];

	// A fresh copy of UV's settings; the sandbox changes its own.
	function defaults() {
		return {
			std: Object.fromEntries(SPOKES.map((s) => [s.key, s.std])),
			start: Object.fromEntries(SPOKES.map((s) => [s.key, s.start])),
			solid: 200,
			mode: 'ratio',
			range: 25,
			walkovers: false
		};
	}

	// The counts from tdc_player_profile's frames (finished frames of finished
	// matches; the caller picks the period). broke is null where breaks were
	// not tracked: those frames count for the win rate only. break_outcome
	// (migration 20261119142114) is the breaker's, so it counts on their own
	// breaks only. A walkover ('default') is left out unless asked for.
	function count(frames, walkovers) {
		const c = { fp: 0, fw: 0, b: 0, bw: 0, ob: 0, obw: 0, r: 0, i: 0, bf: 0 };
		for (const f of frames) {
			if (f.result_event === 'default' && !walkovers) continue;
			c.fp++;
			if (f.won) c.fw++;
			if (f.broke === true) {
				c.b++;
				if (f.won) c.bw++;
				if (f.won && (f.result_event === 'break_and_finish' || f.result_event === 'golden_break')) c.bf++;
				if (f.break_outcome) { c.r++; if (f.break_outcome === 'in') c.i++; }
			} else if (f.broke === false) {
				c.ob++;
				if (f.won) c.obw++;
			}
		}
		return c;
	}

	// One spoke from the counts: the raw and shown rates (0–1), or null with no chances.
	function spoke(c, s, set) {
		const d = Number(c[s.d]) || 0;
		const had = Number(c[s.n]) || 0;
		if (d <= 0) return null;
		const n = Math.min(had, d);
		const std = set.std[s.key] / 100;
		const start = set.start[s.key];
		return { raw: n / d, shown: (n + start * std) / (d + start), n, d, over: had > d };
	}

	// How far out a rate is drawn, 0 (centre) to 1 (edge); the standard is 0.5.
	function reach(rate, s, set) {
		const std = set.std[s.key] / 100;
		const r = set.mode === 'ratio'
			? (std > 0 ? 0.5 * rate / std : (rate > 0 ? 1 : 0.5))
			: 0.5 + 0.5 * (rate - std) * 100 / set.range;
		return Math.max(0, Math.min(1, r));
	}

	// ─── Drawing ───

	const SVG = 'http://www.w3.org/2000/svg';
	const R = 82;
	const svgEl = (name, attrs) => {
		const e = document.createElementNS(SVG, name);
		for (const k in attrs) e.setAttribute(k, attrs[k]);
		return e;
	};
	const angle = (i) => -Math.PI / 2 + i * 2 * Math.PI / SPOKES.length;
	const at = (i, r) => [Math.cos(angle(i)) * r * R, Math.sin(angle(i)) * r * R];
	const ring = (r) => SPOKES.map((s, i) => at(i, r).join(',')).join(' ');

	// The frame: the edge, the standard ring, the axes and their labels.
	function frame(label) {
		const svg = svgEl('svg', { viewBox: '-130 -118 260 236', class: 'star-svg', role: 'img' });
		svg.setAttribute('aria-label', label);
		svg.append(svgEl('polygon', { points: ring(1), class: 'star-edge' }));
		svg.append(svgEl('polygon', { points: ring(0.5), class: 'star-std' }));
		SPOKES.forEach((s, i) => {
			const [x, y] = at(i, 1);
			svg.append(svgEl('line', { x1: 0, y1: 0, x2: x, y2: y, class: 'star-axis' }));
			const [lx, ly] = at(i, 1.2);
			const t = svgEl('text', {
				x: lx, y: ly, class: 'star-label', 'data-spoke': s.key,
				'text-anchor': Math.abs(lx) < 4 ? 'middle' : (lx > 0 ? 'start' : 'end'),
				'dominant-baseline': 'middle'
			});
			t.textContent = s.short;
			svg.append(t);
		});
		return svg;
	}

	// One player's star on a frame, in a group of its own (cls colours it).
	// raw adds the dashed star of their frames alone, with no starting frames.
	function layer(svg, c, set, opts) {
		const o = opts || {};
		const g = svgEl('g', { class: o.cls || '' });
		svg.append(g);
		const rows = SPOKES.map((s) => spoke(c, s, set));
		const shape = (pick) => rows.map((v, i) => at(i, v ? reach(pick(v), SPOKES[i], set) : 0.5).join(',')).join(' ');
		const certain = Math.min(1, (Number(c.fp) || 0) / set.solid);
		const shown = svgEl('polygon', { points: shape((v) => v.shown), class: 'star-shown' });
		shown.style.fillOpacity = (0.08 + 0.42 * certain).toFixed(2);
		shown.style.strokeOpacity = (0.35 + 0.65 * certain).toFixed(2);
		g.append(shown);
		if (o.raw) g.append(svgEl('polygon', { points: shape((v) => v.raw), class: 'star-raw' }));
		return { rows, certain };
	}

	// A spoke no layer has data for: its label greyed, "no data" under it.
	function markNoData(svg, rowsList) {
		SPOKES.forEach((s, i) => {
			if (rowsList.some((rows) => rows[i])) return;
			const t = svg.querySelector(`[data-spoke="${s.key}"]`);
			t.classList.add('star-nodata');
			const x = t.getAttribute('x');
			t.textContent = '';
			const a = svgEl('tspan', { x, dy: '-0.5em' });
			a.textContent = s.short;
			const b = svgEl('tspan', { x, dy: '1.2em' });
			b.textContent = 'no data';
			t.append(a, b);
		});
	}

	// A player's star, ready to place: frames in, an <svg> out.
	function draw(label, layers, set) {
		const svg = frame(label);
		const out = layers.map((l) => layer(svg, l.counts, set, l));
		markNoData(svg, out.map((x) => x.rows));
		return { svg, layers: out };
	}

	return { SPOKES, defaults, count, spoke, reach, frame, layer, markNoData, draw };
})();
