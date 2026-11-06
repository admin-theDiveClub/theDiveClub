// The points page (/staff/points/), owners only.
//
// Built so far: the data points list and the place UV writes a formula. The
// pseudo code is only text: nothing here runs it. UV copies it to Claude, who
// adds it to FORMULAS in points-formula.js (docs/systems/points.md).
//
// Needs: supabaseClient.js, tdc.js, staff-common.js, match-settings.js, points-formula.js.

TDCLoader.hold((async () => {
	const AREA = 'Points';
	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea: el('staff-area'), name: el('formula-name'), level: el('formula-level'), who: el('formula-who'),
		text: el('formula-text'), copy: el('formula-copy'), clear: el('formula-clear'),
		search: el('data-search'), groups: el('data-groups'), empty: el('data-empty')
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
		group.className = 'set-group';
		const summary = document.createElement('summary');
		summary.textContent = title + ' · ' + rows.length;
		group.appendChild(summary);
		const buttons = rows.map(([path, type, label]) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'points-point';
			b.append(div('points-point-name', path), div('points-point-label', label), div('points-point-type', type));
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

	loadDraft();
	showArea();
})(), 'Points');
