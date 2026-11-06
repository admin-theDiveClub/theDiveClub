// The points page (/staff/points/), owners only.
//
// A scenario, a low and a high for each weight and the points they give,
// recalculated live;
// the data points list and the place UV writes a formula. The pseudo code is
// only text: nothing here runs it. UV copies it to Claude, who adds it to
// FORMULAS in points-formula.js, and it then gets its sliders by itself
// (docs/systems/points.md). Weights are not saved yet.
//
// Needs: supabaseClient.js, tdc.js, staff-common.js, match-settings.js, points-formula.js.

TDCLoader.hold((async () => {
	const AREA = 'Points';
	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea: el('staff-area'), name: el('formula-name'), level: el('formula-level'), who: el('formula-who'),
		text: el('formula-text'), copy: el('formula-copy'), clear: el('formula-clear'),
		search: el('data-search'), groups: el('data-groups'), empty: el('data-empty'),
		scenario: el('scenario-select'), scenarioNote: el('scenario-note'), scenarioFields: el('scenario-fields'),
		sets: el('formula-sets'), reset: el('weights-reset'), summary: el('points-summary'), lines: el('points-lines'),
		warnings: el('points-warnings'), writerGroup: el('writer-group')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'points page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;

	const isOwner = () => {
		const r = roles.find((x) => x.venue_id === els.selectEl.value);
		return !!(r && r.role === 'owner');
	};
	const showArea = () => {
		els.staffArea.hidden = !isOwner();
		if (isOwner()) TDC.status(els.statusEl, '', '');
		else TDC.status(els.statusEl, 'This page is for owners only.', 'error');
	};
	els.selectEl.addEventListener('change', showArea);

	// ─── The choices above the pseudo code ───

	const LEVEL_LABEL = { player: 'Player', frame: 'Frame', match: 'Match', tournament: 'Tournament', league: 'League' };
	const WHO_LABEL = { players: 'Players', everyone: 'Everyone', td: 'TD', ld: 'LD', captain: 'Captain', scorer: 'Scorer', referee: 'Referee' };
	const fillSelect = (select, keys, labels) => {
		for (const key of keys) {
			const opt = document.createElement('option');
			opt.value = key;
			opt.textContent = labels[key] || key;
			select.appendChild(opt);
		}
	};
	fillSelect(els.level, TDCPoints.LEVELS, LEVEL_LABEL);
	fillSelect(els.who, ['players'].concat(TDCPoints.WHO.filter((w) => w !== 'players')), WHO_LABEL);

	// ─── The draft: a convenience kept in this browser, safe to lose ───

	const DRAFT_KEY = 'tdc.points.draft';
	const FIELDS = ['name', 'level', 'who', 'text'];
	const saveDraft = () => {
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f, els[f].value]))));
		} catch (err) {
			console.error('[' + AREA + '] could not keep the draft in this browser:', err);
		}
	};
	const loadDraft = () => {
		try {
			const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
			for (const f of FIELDS) {
				if (typeof draft[f] !== 'string') continue;
				els[f].value = draft[f];
				// A level or person that no longer exists leaves the select empty.
				if (els[f].selectedIndex === -1) els[f].selectedIndex = 0;
			}
		} catch (err) {
			console.error('[' + AREA + '] could not read the draft in this browser:', err);
		}
	};
	for (const f of FIELDS) {
		els[f].addEventListener('input', saveDraft);
		els[f].addEventListener('change', saveDraft);
	}

	// ─── Dropping a data point in ───

	function insertName(name) {
		const box = els.text;
		const start = box.selectionStart;
		const before = box.value.charAt(start - 1);
		const after = box.value.charAt(box.selectionEnd);
		const lead = /[\w.)\]]/.test(before) ? ' ' : '';
		const trail = /[\w(\[]/.test(after) ? ' ' : '';
		box.setRangeText(lead + name + trail, start, box.selectionEnd, 'end');
		saveDraft();
	}

	// ─── Copying ───

	const copyText = () => [
		'Formula: ' + (els.name.value.trim() || '(no name)'),
		'Level: ' + els.level.value,
		'For: ' + els.who.value,
		'',
		els.text.value.trim()
	].join('\n');

	els.copy.addEventListener('click', async () => {
		if (!els.text.value.trim()) {
			TDC.status(els.statusEl, 'There is no pseudo code to copy yet.', 'error');
			return;
		}
		try {
			await navigator.clipboard.writeText(copyText());
			TDC.status(els.statusEl, 'Copied. Paste it into the chat with Claude.', 'success');
		} catch (err) {
			TDC.error(AREA, 'could not copy. Select the text and copy it by hand.', err, els.statusEl);
			els.text.focus();
			els.text.select();
		}
	});

	els.clear.addEventListener('click', () => {
		els.name.value = '';
		els.text.value = '';
		saveDraft();
		TDC.status(els.statusEl, '', '');
		els.text.focus();
	});

	// ─── The data points ───

	// A match setting's list of values, for the row that describes it.
	const settingType = (def) => {
		if (def.type === 'bool') return 'yes/no';
		if (def.type === 'int') return 'number';
		if (def.type === 'rotation') return 'grid; match.rotation_custom says if it was changed';
		if (def.type === 'select') return Object.keys(def.options()).join(', ');
		return def.type;
	};
	// Every match setting, read from its one definition, so a new one appears
	// here by itself. Scope 'match' settings (lag winner, referee) are not in
	// the rules; they are match.* data points.
	const settingRows = () => TDCMatchDef.SETTINGS
		.filter((def) => def.scope === 'rules')
		.map((def) => ['rules.' + def.key, settingType(def), def.group + ': ' + def.label]);

	const DATA = TDCPoints.DATA;
	const under = (prefix) => DATA.me.filter(([path]) => path.startsWith(prefix));
	const GROUPS = [
		['This person', DATA.me.filter(([path]) => path.split('.').length === 2)],
		['Roles', under('me.roles.')],
		['Profile', under('me.profile.')],
		['History', under('me.history.')],
		['Frame (frame level only)', DATA.frame],
		['Match', DATA.match],
		['Match settings', settingRows()],
		['Tournament (only in a tournament)', DATA.tournament],
		['League (only in a league)', DATA.league],
		['Site-wide', DATA.site]
	];

	const div = (cls, text) => {
		const d = document.createElement('div');
		d.className = cls;
		d.textContent = text;
		return d;
	};

	const drawn = GROUPS.map(([title, rows]) => {
		const group = document.createElement('details');
		group.className = 'set-group points-sub';
		const summary = document.createElement('summary');
		summary.textContent = title + ' · ' + rows.length;
		group.appendChild(summary);
		const buttons = rows.map(([path, type, label]) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'points-point';
			b.append(div('points-point-name', path), div('points-point-type', type), div('points-point-label', label));
			// Keep the box's cursor and keyboard where they are.
			b.addEventListener('mousedown', (e) => e.preventDefault());
			b.addEventListener('click', () => insertName(path));
			group.appendChild(b);
			return { button: b, words: (path + ' ' + label + ' ' + type).toLowerCase() };
		});
		els.groups.appendChild(group);
		return { group, buttons };
	});

	els.search.addEventListener('input', () => {
		const query = els.search.value.trim().toLowerCase();
		let shown = 0;
		for (const { group, buttons } of drawn) {
			let inGroup = 0;
			for (const { button, words } of buttons) {
				const match = !query || query.split(/\s+/).every((word) => words.includes(word));
				button.hidden = !match;
				if (match) inGroup++;
			}
			group.hidden = !inGroup;
			group.open = !!query && inGroup > 0;
			shown += inGroup;
		}
		els.empty.hidden = shown > 0;
	});

	// ─── The scenario, the sliders and the points ───

	const LEVEL_TITLE = { player: 'Player: profile and history', frame: 'Frames', match: 'Matches', tournament: 'Tournaments', league: 'Leagues' };
	const shown = (n) => String(Math.round(n * 100) / 100);
	// Every weight has a low and a high, so each scenario gives a low and a high
	// total: two runs of the one calculation. Not saved yet.
	const SIDES = ['low', 'high'];

	const startingRange = () => {
		const range = {};
		for (const f of TDCPoints.FORMULAS) {
			range[f.id] = {};
			for (const [key, def] of Object.entries(f.weights || {})) {
				range[f.id][key] = { low: def.low ?? def.value, high: def.value };
			}
		}
		return range;
	};
	let range = startingRange();
	let scenario = null;
	const syncers = [];
	const closed = new Set();
	const formulaTotals = {};

	const weightsFor = (side) => ({
		formulas: Object.fromEntries(Object.entries(range).map(([id, keys]) => [
			id, Object.fromEntries(Object.entries(keys).map(([key, r]) => [key, r[side]]))
		]))
	});

	function drawPoints() {
		const runs = Object.fromEntries(SIDES.map((side) => [side, TDCPoints.calculate(scenario, TDCPoints.FORMULAS, weightsFor(side))]));
		els.summary.textContent = '';
		els.lines.textContent = '';
		const grid = div('points-grid', '');
		const cell = (cls, text) => grid.append(div(cls, text));
		cell('points-grid-name', '');
		cell('points-grid-num points-total-label', 'Low');
		cell('points-grid-num points-total-label', 'High');

		runs.low.people.forEach((person, i) => {
			const high = runs.high.people[i];
			const row = div('points-person', '');
			if (runs.low.people.length > 1) row.append(div('points-person-name', person.name));
			for (const [label, value] of [['Low', person.points], ['High', high.points]]) {
				const total = div('points-total', '');
				total.append(div('points-total-label', label), div('points-total-value', shown(value)));
				row.append(total);
			}
			els.summary.append(row);
			if (!person.has_account) els.summary.append(div('points-would', 'No account, so nothing is earned. It would be ' + shown(person.would_earn) + ' to ' + shown(high.would_earn) + '.'));
			if (person.capped) els.summary.append(div('points-would', 'Over the social cap this week.'));

			person.lines.forEach((line, n) => {
				const other = high.lines[n];
				cell('points-grid-name points-grid-line', line.label);
				cell('points-grid-num points-grid-line', shown(line.amount));
				cell('points-grid-num points-grid-line', shown(other.amount));
				(line.parts || []).forEach((part, m) => {
					cell('points-grid-name points-grid-part', part.label);
					cell('points-grid-num points-grid-part', shown(part.amount));
					cell('points-grid-num points-grid-part', shown(other.parts[m].amount));
				});
			});
		});
		els.lines.append(grid);

		// Each formula's own low and high, on its heading, when one person is shown.
		for (const [id, box] of Object.entries(formulaTotals)) {
			const line = (run) => run.people[0].lines.find((l) => l.formula === id);
			const single = runs.low.people.length === 1;
			box.textContent = single && line(runs.low) ? shown(line(runs.low).amount) + ' to ' + shown(line(runs.high).amount) : '';
		}

		// A formula that fails says so here, never as a quiet low score.
		els.warnings.textContent = '';
		for (const w of new Set(runs.low.warnings.concat(runs.high.warnings))) {
			console.error('[' + AREA + '] ' + w);
			els.warnings.append(div('status error', 'TDC (Error): ' + w));
		}
	}

	// A step of the scenario: a switch, or a small stepper for a number.
	function scenarioControl(item, person) {
		const keys = item.path.split('.');
		const holder = keys.slice(0, -1).reduce((v, k) => v[k], person);
		const key = keys[keys.length - 1];
		const input = document.createElement('input');
		input.setAttribute('aria-label', item.label);
		if (item.type === 'bool') {
			input.type = 'checkbox';
			input.checked = !!holder[key];
		} else {
			input.type = 'number';
			input.dataset.stepper = 'across';
			input.min = item.min;
			input.max = item.max;
			input.value = holder[key];
		}
		const change = () => {
			holder[key] = item.type === 'bool' ? input.checked : (Number(input.value) || 0);
			drawPoints();
		};
		input.addEventListener('input', change);
		input.addEventListener('change', change);
		return input;
	}

	const numberBox = (cls, label, step) => {
		const box = document.createElement('input');
		box.type = 'number';
		box.className = cls;
		box.step = 'any';
		box.dataset.control = 'none';
		box.setAttribute('aria-label', label);
		box.dataset.step = step;
		return box;
	};

	const rangeInput = (cls, label, def) => {
		const r = document.createElement('input');
		r.type = 'range';
		r.className = cls;
		r.step = def.step;
		r.setAttribute('aria-label', label);
		return r;
	};

	function weightRow(formula, key, def, stepItem) {
		const label = def.label || key;
		const row = div('points-row', '');
		const toggle = div('points-row-toggle', '');
		if (stepItem) toggle.append(scenarioControl(stepItem, scenario.people[0]));
		const lowBox = numberBox('points-low', label + ': low', def.step);
		const highBox = numberBox('points-high', label + ': high', def.step);
		const track = div('points-range', '');
		const lowThumb = rangeInput('points-range-low', label + ': low', def);
		const highThumb = rangeInput('points-range-high', label + ': high', def);
		track.append(lowThumb, highThumb);
		row.append(toggle, div('points-row-name', label), lowBox, track, highBox);

		const r = range[formula.id][key];
		// A typed value may go past the slider's ends: the slider grows to fit.
		let min = def.min;
		let max = def.max;
		const sync = (typing) => {
			min = Math.min(def.min, r.low, r.high);
			max = Math.max(def.max, r.low, r.high);
			for (const thumb of [lowThumb, highThumb]) {
				thumb.min = min;
				thumb.max = max;
			}
			lowThumb.value = r.low;
			highThumb.value = r.high;
			if (typing !== lowBox) lowBox.value = shown(r.low);
			if (typing !== highBox) highBox.value = shown(r.high);
			const pct = (v) => (max > min ? ((v - min) / (max - min)) * 100 : 0) + '%';
			track.style.setProperty('--low', pct(r.low));
			track.style.setProperty('--high', pct(r.high));
			// Where the thumbs meet, the one that can still move lies on top.
			lowThumb.style.zIndex = r.low > (min + max) / 2 ? 2 : 1;
			highThumb.style.zIndex = r.low > (min + max) / 2 ? 1 : 2;
		};
		const set = (side, value, typing) => {
			r[side] = value;
			// Low can never pass high: the other follows.
			if (r.low > r.high) r[side === 'low' ? 'high' : 'low'] = value;
			sync(typing);
			drawPoints();
		};
		lowThumb.addEventListener('input', () => set('low', Math.min(Number(lowThumb.value), r.high)));
		highThumb.addEventListener('input', () => set('high', Math.max(Number(highThumb.value), r.low)));
		for (const [side, box] of [['low', lowBox], ['high', highBox]]) {
			box.addEventListener('input', () => {
				if (box.value !== '' && Number.isFinite(Number(box.value))) set(side, Number(box.value), box);
			});
			// Left empty or nonsense: back to the value it has.
			box.addEventListener('change', () => sync());
		}
		sync();
		syncers.push(sync);
		return row;
	}

	function drawSliders(preset) {
		els.sets.textContent = '';
		syncers.length = 0;
		const empty = [];
		for (const level of TDCPoints.LEVELS) {
			const formulas = TDCPoints.FORMULAS.filter((f) => f.level === level);
			if (!formulas.length) {
				empty.push(LEVEL_TITLE[level]);
				continue;
			}
			const group = document.createElement('details');
			group.className = 'set-group points-band';
			group.open = !closed.has(level);
			group.addEventListener('toggle', () => (group.open ? closed.delete(level) : closed.add(level)));
			const summary = document.createElement('summary');
			summary.textContent = LEVEL_TITLE[level] + ' · ' + formulas.length;
			group.append(summary);
			for (const formula of formulas) {
				const inner = document.createElement('details');
				inner.className = 'set-group points-sub';
				inner.open = !closed.has(formula.id);
				inner.addEventListener('toggle', () => (inner.open ? closed.delete(formula.id) : closed.add(formula.id)));
				const name = document.createElement('summary');
				name.append(div('points-sub-name', formula.label || formula.id));
				formulaTotals[formula.id] = div('points-sub-total', '');
				name.append(formulaTotals[formula.id]);
				inner.append(name);
				const head = div('points-row-head', '');
				head.append(div('', ''), div('', ''), div('', 'Low'), div('', 'High'));
				inner.append(head);
				for (const [key, def] of Object.entries(formula.weights || {})) {
					const step = preset.edit.find((item) => item.formula === formula.id && item.weight === key);
					inner.append(weightRow(formula, key, def, step));
				}
				group.append(inner);
			}
			els.sets.append(group);
		}
		if (empty.length) els.sets.append(div('points-empty', 'No formulas yet: ' + empty.join(', ') + '.'));
	}

	function drawScenario() {
		const preset = TDCPoints.SCENARIOS.find((s) => s.id === els.scenario.value);
		scenario = JSON.parse(JSON.stringify(preset));
		els.scenarioNote.textContent = preset.note;
		els.scenarioFields.textContent = '';
		for (const item of preset.edit.filter((e) => !e.weight)) {
			const flag = div('points-flag', '');
			flag.append(scenarioControl(item, scenario.people[0]), div('', item.label));
			els.scenarioFields.append(flag);
		}
		drawSliders(preset);
		drawPoints();
	}

	fillSelect(els.scenario, TDCPoints.SCENARIOS.map((s) => s.id), Object.fromEntries(TDCPoints.SCENARIOS.map((s) => [s.id, s.label])));
	els.scenario.addEventListener('change', drawScenario);
	els.reset.addEventListener('click', () => {
		range = startingRange();
		drawScenario();
	});
	drawScenario();

	loadDraft();
	// A formula half written stays open.
	els.writerGroup.open = !!els.text.value.trim();
	showArea();
})(), 'Points');
