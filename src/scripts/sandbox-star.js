// The player star's sandbox (UV, 19 Nov; docs/design/player-star.md).
//
// Five spokes, each a rate: successes out of chances. Each is measured against
// UV's own standard for it, never against other players. A player starts with
// `start` frames played exactly at the standard, so a few real frames move the
// spoke only a little:
//
//   shown = (successes + start × standard) / (chances + start)
//
// The standard is a fixed ring halfway out. Ratio: shown ÷ standard, twice the
// standard at the edge. Points: shown − standard, `range` points at the edge
// (above) or the centre (below). How solid a star is follows frames played.
//
// Made-up players are below. Real ones are added by search (tdc_search_opponents)
// and read through tdc_player_profile, signed in, and counted here. Nothing is saved.

(() => {
	const AREA = 'Star';
	const el = (id) => document.getElementById(id);

	// The spokes, clockwise from the top. n and d name the counts below.
	const SPOKES = [
		// The standards and starting frames are UV's (19 Nov).
		{ key: 'win',   label: 'Win rate',     short: 'Win',       n: 'fw',  d: 'fp',  std: 50, start: 100,
			help: 'Frames won out of frames played.' },
		{ key: 'own',   label: 'Own break',    short: 'Own brk',   n: 'bw',  d: 'b',   std: 70, start: 50,
			help: 'Frames won out of the frames they broke.' },
		{ key: 'their', label: 'Their break',  short: 'Their brk', n: 'obw', d: 'ob',  std: 40, start: 50,
			help: 'Frames won out of the frames their opponent broke.' },
		{ key: 'in',    label: 'Break in',     short: 'Brk in',    n: 'i',   d: 'r',   std: 50, start: 10,
			help: 'Breaks with a ball in, out of breaks with a result recorded.' },
		{ key: 'bf',    label: 'B&F',          short: 'B&F',       n: 'bf',  d: 'b',   std: 10, start: 100,
			help: 'Break & finish or golden break, out of the frames they broke.' }
	];

	// The counts, in the table's order.
	const COUNTS = [
		{ key: 'fp',  label: 'Frames' },
		{ key: 'fw',  label: 'Won' },
		{ key: 'b',   label: 'Broke' },
		{ key: 'bw',  label: 'Won on own break' },
		{ key: 'ob',  label: 'Opponent broke' },
		{ key: 'obw', label: 'Won on their break' },
		{ key: 'r',   label: 'Break result recorded' },
		{ key: 'i',   label: 'Break in' },
		{ key: 'bf',  label: 'B&F' }
	];

	const players = [
		{ id: 'd1', name: 'The Regular', note: 'Made up: 400 frames, a little above every standard',
			c: { fp: 400, fw: 232, b: 200, bw: 136, ob: 200, obw: 96, r: 190, i: 133, bf: 22 } },
		{ id: 'd2', name: 'Newcomer, won 5 of 5', note: 'Made up: five frames, all won',
			c: { fp: 5, fw: 5, b: 3, bw: 3, ob: 2, obw: 2, r: 3, i: 3, bf: 1 } },
		{ id: 'd3', name: 'Newcomer, won 1 of 5', note: 'Made up: five frames, one won',
			c: { fp: 5, fw: 1, b: 2, bw: 1, ob: 3, obw: 0, r: 2, i: 1, bf: 0 } },
		{ id: 'd4', name: 'The Big Breaker', note: 'Made up: wins on the break, loses on the other',
			c: { fp: 120, fw: 60, b: 60, bw: 45, ob: 60, obw: 15, r: 58, i: 49, bf: 12 } },
		{ id: 'd5', name: 'On the Standard', note: 'Made up: 100 frames, exactly at every standard',
			c: { fp: 100, fw: 50, b: 50, bw: 30, ob: 50, obw: 20, r: 50, i: 33, bf: 5 } }
	];

	const settings = {
		std: Object.fromEntries(SPOKES.map((s) => [s.key, s.std])),
		start: Object.fromEntries(SPOKES.map((s) => [s.key, s.start])),
		solid: 200,
		mode: 'ratio',
		range: 25,
		raw: false,
		walkovers: false
	};

	// ─── The sums ───

	// One spoke for one player: the raw and shown rates (0–1), or null with no data.
	function spoke(p, s, start) {
		const d = Number(p.c[s.d]) || 0;
		const n = Math.min(Number(p.c[s.n]) || 0, d);
		if (d <= 0) return null;
		const std = settings.std[s.key] / 100;
		return { raw: n / d, shown: (n + start * std) / (d + start), n, d, over: (Number(p.c[s.n]) || 0) > d };
	}

	// How far out a rate is drawn, 0 (centre) to 1 (edge); the standard is 0.5.
	function reach(rate, s) {
		const std = settings.std[s.key] / 100;
		let r;
		if (settings.mode === 'ratio') {
			r = std > 0 ? 0.5 * rate / std : (rate > 0 ? 1 : 0.5);
		} else {
			const gap = (rate - std) * 100 / settings.range;
			r = 0.5 + 0.5 * gap;
		}
		return Math.max(0, Math.min(1, r));
	}

	const pct = (x) => (x * 100).toFixed(1) + '%';
	const gapText = (x, s) => {
		const g = (x - settings.std[s.key] / 100) * 100;
		return (g >= 0 ? '+' : '−') + Math.abs(g).toFixed(1);
	};

	// ─── The star ───

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
			const t = svgEl('text', { x: lx, y: ly, class: 'star-label', 'text-anchor': Math.abs(lx) < 4 ? 'middle' : (lx > 0 ? 'start' : 'end'), 'dominant-baseline': 'middle' });
			t.textContent = s.short;
			svg.append(t);
		});
		return svg;
	}

	// One player's star on a frame, in a group of its own (cls colours it).
	function layer(svg, p, cls) {
		const g = svgEl('g', { class: cls || '' });
		svg.append(g);
		const rows = SPOKES.map((s) => spoke(p, s, settings.start[s.key]));
		const shape = (pick) => rows.map((v, i) => at(i, v ? reach(pick(v), SPOKES[i]) : 0.5).join(',')).join(' ');

		const certain = Math.min(1, (Number(p.c.fp) || 0) / settings.solid);
		const shown = svgEl('polygon', { points: shape((v) => v.shown), class: 'star-shown' });
		shown.style.fillOpacity = (0.08 + 0.42 * certain).toFixed(2);
		shown.style.strokeOpacity = (0.35 + 0.65 * certain).toFixed(2);
		g.append(shown);
		if (settings.raw) g.append(svgEl('polygon', { points: shape((v) => v.raw), class: 'star-raw' }));

		rows.forEach((v, i) => {
			const [x, y] = at(i, v ? reach(v.shown, SPOKES[i]) : 0.5);
			g.append(svgEl('circle', { cx: x, cy: y, r: 3, class: v ? 'star-dot' : 'star-dot star-none' }));
		});
		return { rows, certain };
	}

	function star(p) {
		const svg = frame('Star for ' + p.name);
		return { svg, ...layer(svg, p) };
	}

	function card(p, index) {
		const box = document.createElement('article');
		box.className = 'star-card';
		const head = document.createElement('div');
		head.className = 'star-card-head';
		const h = document.createElement('h3');
		h.textContent = p.name;
		head.append(h);
		if (p.real) {
			const x = document.createElement('button');
			x.type = 'button';
			x.className = 'btn btn-sm btn-secondary';
			x.textContent = 'Remove';
			x.dataset.noDots = '';
			x.addEventListener('click', () => { players.splice(index, 1); drawTable(); draw(); });
			head.append(x);
		}
		box.append(head);

		const { svg, rows, certain } = star(p);
		const sub = document.createElement('p');
		sub.className = 'muted star-sub';
		sub.textContent = (p.c.fp || 0) + ' frames · ' + Math.round(certain * 100) + '% solid' + (p.note ? ' · ' + p.note : '');
		box.append(sub, svg);

		const t = document.createElement('table');
		t.className = 'tdc-table star-spokes';
		t.innerHTML = '<thead><tr><th>Spoke</th><th class="num">Raw</th><th class="num">Shown</th><th class="num">vs std</th></tr></thead>';
		const body = document.createElement('tbody');
		rows.forEach((v, i) => {
			const s = SPOKES[i];
			const tr = document.createElement('tr');
			const cells = v
				? [s.label, pct(v.raw) + ' (' + v.n + '/' + v.d + ')', pct(v.shown), gapText(v.shown, s)]
				: [s.label, 'no data', '—', '—'];
			cells.forEach((text, j) => {
				const td = document.createElement('td');
				td.textContent = text;
				if (j) td.className = 'num';
				if (j === 3 && v) td.classList.add(v.shown >= settings.std[s.key] / 100 ? 'star-up' : 'star-down');
				tr.append(td);
			});
			body.append(tr);
		});
		t.append(body);
		box.append(t);

		const over = rows.map((v, i) => v && v.over ? SPOKES[i].label : null).filter(Boolean);
		if (over.length) {
			const warn = document.createElement('p');
			warn.className = 'status error';
			warn.textContent = 'More successes than chances on ' + over.join(', ') + ': counted as all of them.';
			box.append(warn);
		}
		return box;
	}

	// ─── Compare (UV, 19 Nov) ───
	// Two players on one star: the first green, the second blue, the standard
	// ring between them. The pickers are refilled when a player comes or goes.

	const compare = { a: 'd1', b: 'd4' };

	function fillPickers() {
		['a', 'b'].forEach((side) => {
			const select = el('star-cmp-' + side);
			if (!players.some((p) => p.id === compare[side])) compare[side] = players[0] ? players[0].id : null;
			select.replaceChildren(...players.map((p) => {
				const o = document.createElement('option');
				o.value = p.id;
				o.textContent = p.name;
				o.selected = p.id === compare[side];
				return o;
			}));
		});
	}

	function drawCompare() {
		const box = el('star-compare');
		const a = players.find((p) => p.id === compare.a);
		const b = players.find((p) => p.id === compare.b);
		if (!a || !b) { box.replaceChildren(); return; }

		const svg = frame('Star comparing ' + a.name + ' and ' + b.name);
		const la = layer(svg, a, 'star-a');
		const lb = layer(svg, b, 'star-b');

		const legend = document.createElement('p');
		legend.className = 'star-legend';
		[[a, 'star-key-a'], [b, 'star-key-b']].forEach(([p, cls]) => {
			const s = document.createElement('span');
			s.className = cls;
			s.textContent = p.name + ' · ' + (p.c.fp || 0) + ' frames';
			legend.append(s);
		});

		const t = document.createElement('table');
		t.className = 'tdc-table star-spokes';
		const hr = document.createElement('tr');
		['Spoke', a.name, b.name].forEach((text, i) => {
			const th = document.createElement('th');
			th.textContent = text;
			if (i) th.className = 'num ' + (i === 1 ? 'star-key-a' : 'star-key-b');
			hr.append(th);
		});
		const head = document.createElement('thead');
		head.append(hr);
		const body = document.createElement('tbody');
		SPOKES.forEach((s, i) => {
			const tr = document.createElement('tr');
			const name = document.createElement('td');
			name.textContent = s.label;
			tr.append(name);
			[la.rows[i], lb.rows[i]].forEach((v) => {
				const td = document.createElement('td');
				td.className = 'num';
				td.textContent = v ? pct(v.shown) + ' (' + gapText(v.shown, s) + ')' : 'no data';
				tr.append(td);
			});
			body.append(tr);
		});
		t.append(head, body);
		box.replaceChildren(legend, svg, t);
	}

	function draw() {
		drawCompare();
		el('star-grid').replaceChildren(...players.map(card));
	}

	// ─── The controls ───

	function slider(id, label, min, max, value, out, help, onInput) {
		const box = el('star-spokes');
		const l = document.createElement('label');
		l.htmlFor = id;
		l.textContent = label;
		const input = document.createElement('input');
		Object.assign(input, { type: 'range', id, min, max, step: 1, value });
		const o = document.createElement('output');
		o.textContent = out(value);
		const p = document.createElement('p');
		p.className = 'star-help';
		p.textContent = help;
		input.addEventListener('input', () => { onInput(Number(input.value)); o.textContent = out(Number(input.value)); draw(); });
		box.append(l, input, o, p);
	}

	function buildSpokes() {
		SPOKES.forEach((s) => {
			const head = document.createElement('h3');
			head.className = 'star-spoke-head';
			head.textContent = s.label;
			el('star-spokes').append(head);
			slider('std-' + s.key, 'Standard', 0, 100, settings.std[s.key], (v) => v + '%', s.help, (v) => { settings.std[s.key] = v; });
			slider('start-' + s.key, 'Starting frames', 0, 100, settings.start[s.key], (v) => String(v),
				'Every player starts with this many frames at the ' + s.label + ' standard.', (v) => { settings.start[s.key] = v; });
		});
	}

	function modeHelp() {
		el('star-mode-help').textContent = settings.mode === 'ratio'
			? 'Ratio: twice the standard reaches the edge, zero the centre. A rare spoke (B&F) swings further for the same points.'
			: 'Points: the same number of points above or below the standard moves every spoke the same distance.';
		document.querySelectorAll('[data-points]').forEach((e) => { e.hidden = settings.mode !== 'points'; });
	}

	function wireDrawing() {
		const solid = el('star-solid');
		const range = el('star-range');
		const show = () => {
			el('star-solid-out').textContent = solid.value;
			el('star-range-out').textContent = range.value;
		};
		solid.addEventListener('input', () => { settings.solid = Number(solid.value); show(); draw(); });
		range.addEventListener('input', () => { settings.range = Number(range.value); show(); draw(); });
		el('star-mode').addEventListener('change', (e) => { settings.mode = e.target.value; modeHelp(); draw(); });
		el('star-raw').addEventListener('change', (e) => { settings.raw = e.target.checked; draw(); });
		el('star-walkovers').addEventListener('change', (e) => {
			settings.walkovers = e.target.checked;
			players.forEach((p) => { if (p.frames) p.c = countFrames(p.frames); });
			drawTable();
			draw();
		});
		show();
		modeHelp();
	}

	// ─── The numbers ───
	// Rebuilt only when a player comes or goes, so typing in it keeps its place.

	function drawTable() {
		const t = el('star-table');
		const head = document.createElement('thead');
		const hr = document.createElement('tr');
		['Player', ...COUNTS.map((c) => c.label)].forEach((text, i) => {
			const th = document.createElement('th');
			th.textContent = text;
			if (i) th.className = 'num';
			hr.append(th);
		});
		head.append(hr);
		const body = document.createElement('tbody');
		players.forEach((p) => {
			const tr = document.createElement('tr');
			const name = document.createElement('td');
			name.textContent = p.name;
			tr.append(name);
			COUNTS.forEach((c) => {
				const td = document.createElement('td');
				td.className = 'num';
				const input = document.createElement('input');
				Object.assign(input, { type: 'number', min: 0, step: 1, value: p.c[c.key] });
				input.setAttribute('aria-label', c.label + ': ' + p.name);
				input.addEventListener('input', () => { p.c[c.key] = Math.max(0, Number(input.value) || 0); draw(); });
				td.append(input);
				tr.append(td);
			});
			body.append(tr);
		});
		t.replaceChildren(head, body);
		fillPickers();   // the same moments: a player came or went
	}

	// ─── League players ───

	// The counts from tdc_player_profile's frames: finished frames of finished
	// matches only. broke is null where breaks were not tracked; those frames
	// count for the win rate only. No break result is returned, so r and i stay 0.
	function countFrames(frames) {
		const c = { fp: 0, fw: 0, b: 0, bw: 0, ob: 0, obw: 0, r: 0, i: 0, bf: 0 };
		frames.forEach((f) => {
			if (f.result_event === 'default' && !settings.walkovers) return;
			c.fp++;
			if (f.won) c.fw++;
			if (f.broke === true) {
				c.b++;
				if (f.won) c.bw++;
				if (f.won && (f.result_event === 'break_and_finish' || f.result_event === 'golden_break')) c.bf++;
			} else if (f.broke === false) {
				c.ob++;
				if (f.won) c.obw++;
			}
		});
		return c;
	}

	async function addPlayer(row, button) {
		if (players.some((p) => p.id === row.id)) {
			TDC.status(el('star-find-note'), row.display_name + ' is already on the page.', '');
			return;
		}
		const { data, error } = await TDC.busy(button, supabaseClient.rpc('tdc_player_profile', { p_player_id: row.id }));
		if (error) { TDC.showSupabaseError(AREA, error, el('star-find-note')); return; }
		if (!data || !Array.isArray(data.frames)) {
			TDC.error(AREA, 'the player’s frames came back in a shape this page does not know.', data, el('star-find-note'));
			return;
		}
		players.push({ id: row.id, real: true, name: row.display_name, note: 'League player', frames: data.frames, c: countFrames(data.frames) });
		TDC.status(el('star-find-note'), row.display_name + ' added: ' + data.frames.length + ' frames read.', 'success');
		drawTable();
		draw();
	}

	let findRun = 0;
	async function find(term) {
		const run = ++findRun;
		const note = el('star-find-note');
		const results = el('star-find-results');
		TDC.status(note, '', '');
		if (term.trim().length < 2) { results.replaceChildren(); return; }
		const { data, error } = await TDC.busy(el('star-find-dots'), supabaseClient.rpc('tdc_search_opponents', { p_query: term, p_limit: 20 }));
		if (run !== findRun) return;
		if (error) { TDC.showSupabaseError(AREA, error, note); return; }
		if (!data.length) TDC.status(note, 'Nobody by that name. Only players with an account can be found.', '');
		results.replaceChildren(...data.map((row) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'btn btn-sm btn-secondary star-find-row';
			b.textContent = 'Add ' + row.display_name;
			b.addEventListener('click', () => addPlayer(row, b));
			return b;
		}));
	}

	TDCLoader.hold((async () => {
		buildSpokes();
		wireDrawing();
		['a', 'b'].forEach((side) => {
			el('star-cmp-' + side).addEventListener('change', (e) => { compare[side] = e.target.value; drawCompare(); });
		});
		drawTable();
		draw();
		const session = await TDC.getSession(AREA);
		el('star-signin').hidden = !!session;
		el('star-find').hidden = !session;
		if (session) {
			let timer = null;
			el('star-find-input').addEventListener('input', (e) => {
				clearTimeout(timer);
				timer = setTimeout(() => find(e.target.value), 250);
			});
		}
	})().catch((err) => TDC.error(AREA, 'the page could not start.', err, el('star-status'))), 'Star sandbox');
})();
