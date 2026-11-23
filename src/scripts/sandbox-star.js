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

	// The spokes are the league star's (UV, 20 Nov): Win %, Lags Won, W | Own Brk,
	// W | Opp Brk and B&F | Own Brk, with the formulas and headings the league
	// stars use (TDCStar.LEAGUE_SPOKES, player-star.js). UV sets the standards and
	// the starting frames for them here. (The profile's own player star still has
	// its five spokes, Break in included, until UV says.)
	// The league star's headings (their short labels) head everything here too.
	const SPOKES = TDCStar.LEAGUE_SPOKES.map((s) => Object.assign({}, s, { label: s.short }));
	const drawSettings = () => settings;

	// The counts, in the table's order.
	const COUNTS = [
		{ key: 'fp',  label: 'Frames' },
		{ key: 'fw',  label: 'Won' },
		{ key: 'b',   label: 'Broke' },
		{ key: 'bw',  label: 'Won on own break' },
		{ key: 'ob',  label: 'Opponent broke' },
		{ key: 'obw', label: 'Won on their break' },
		{ key: 'bf',  label: 'B&F' }
	];

	const players = [
		{ id: 'd1', name: 'The Regular', note: 'Made up: 400 frames, a little above every standard',
			c: { fp: 400, fw: 232, b: 200, bw: 136, ob: 200, obw: 96, bf: 22 } },
		{ id: 'd2', name: 'Newcomer, won 5 of 5', note: 'Made up: five frames, all won',
			c: { fp: 5, fw: 5, b: 3, bw: 3, ob: 2, obw: 2, bf: 1 } },
		{ id: 'd3', name: 'Newcomer, won 1 of 5', note: 'Made up: five frames, one won',
			c: { fp: 5, fw: 1, b: 2, bw: 1, ob: 3, obw: 0, bf: 0 } },
		{ id: 'd4', name: 'The Big Breaker', note: 'Made up: wins on the break, loses on the other',
			c: { fp: 120, fw: 60, b: 60, bw: 45, ob: 60, obw: 15, bf: 12 } },
		{ id: 'd5', name: 'On the Standard', note: 'Made up: 100 frames, exactly at every standard',
			c: { fp: 100, fw: 50, b: 50, bw: 30, ob: 50, obw: 20, bf: 5 } }
	];

	// UV's settings (TDCStar.defaults), changed by this page's sliders.
	// The filled shape is the actual stats, the dotted line the adjusted star (UV, 21 Nov).
	const settings = TDCStar.defaults();

	// ─── The sums ───
	// TDCStar.spoke and TDCStar.reach (player-star.js), with this page's settings.

	const pct = (x) => (x * 100).toFixed(1) + '%';
	const gapText = (x, s) => {
		const g = (x - settings.std[s.key] / 100) * 100;
		return (g >= 0 ? '+' : '−') + Math.abs(g).toFixed(1);
	};

	// ─── The star ───
	// The shared star (player-star.js): the line only, no dots at the corners.

	function star(p) {
		const { svg, layers } = TDCStar.draw('Star for ' + p.name, [{ counts: p.c, adjusted: true }], drawSettings(), SPOKES);
		return { svg, ...layers[0] };
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

		const { svg, layers: [la, lb] } = TDCStar.draw('Star comparing ' + a.name + ' and ' + b.name, [
			{ counts: a.c, cls: 'star-a', adjusted: true },
			{ counts: b.c, cls: 'star-b', adjusted: true }
		], drawSettings(), SPOKES);

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

	function wireDrawing() {
		const solid = el('star-solid');
		const show = () => { el('star-solid-out').textContent = solid.value; };
		solid.addEventListener('input', () => { settings.solid = Number(solid.value); show(); draw(); });
		el('star-walkovers').addEventListener('change', (e) => {
			settings.walkovers = e.target.checked;
			players.forEach((p) => { if (p.frames) p.c = countFrames(p.frames); });
			drawTable();
			draw();
		});
		show();
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

	// The counts from tdc_player_profile's frames: TDCStar.count (player-star.js).
	const countFrames = (frames) => TDCStar.count(frames, settings.walkovers);

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
