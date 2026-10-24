// Start a match (/matches/new/).
//
// Two parts: who you are playing, and how it is being played. The second is
// generated from TDCMatchDef.SETTINGS — the same list the match page's settings
// panel is built from — so a setting added there appears here without an edit.
//
// The defaults are the quietest the ruleset allows, so someone who ignores all
// of it lands on the simple card: two names, two scores, a win button a side.
// Everything else is a refinement, and a long form is how a person is lost on
// their first match.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'New match';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		search: el('opponent-search'), results: el('opponent-results'),
		field: el('opponent-field'),
		chosen: el('opponent-chosen'), chosenAvatar: el('chosen-avatar'),
		chosenDisplay: el('chosen-display'), chosenFull: el('chosen-full'),
		clear: el('opponent-clear'),
		main: el('settings-main'), rest: el('settings-rest'),
		when: el('match-when'),
		create: el('create-btn'), status: el('create-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the new match page is missing expected elements: ' + missing.join(', '));
		return;
	}

	// ─── State ───
	const rules = Object.assign({}, D.DEFAULT_RULES);
	let firstBreakSide = null;
	let opponent = null;
	const openGroups = new Set();   // which collapsed groups the person has opened
	let me = null;

	// The creator is always home, so the lag winner reads as two names rather
	// than "home" and "away".
	D.setSideNames(() => ({
		home: me ? me.display_name : 'You',
		away: opponent ? opponent.display_name : 'Your opponent'
	}));

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── Settings ───
	// Same shape as the match page: scope 'rules' writes to the ruleset, scope
	// 'match' writes to a column. first_break_side is the only one of the
	// second kind that belongs on this page.
	function valueOf(def) {
		return def.scope === 'match' ? (def.key === 'first_break_side' ? firstBreakSide : null) : rules[def.key];
	}

	function setValue(def, raw) {
		let v = raw;
		if (def.type === 'bool') v = !!raw;
		if (def.type === 'int') {
			v = parseInt(raw, 10);
			if (isNaN(v)) { TDC.error(AREA, `"${def.label}" needs a number.`, raw, els.status); return false; }
			if (def.min !== undefined) v = Math.max(def.min, v);
			if (def.max !== undefined) v = Math.min(def.max, v);
		}
		if (def.scope === 'match') firstBreakSide = v || null;
		else rules[def.key] = v;
		return true;
	}

	function control(def) {
		const row = node('div', 'field');
		const label = node('label', null, def.label);
		label.htmlFor = 'new-' + def.key;

		const value = valueOf(def);
		let input;

		if (def.type === 'select') {
			input = document.createElement('select');
			const options = typeof def.options === 'function' ? def.options() : def.options;
			// A setting that is not set yet offers nothing rather than quietly
			// choosing for you — the lag winner is the one that matters.
			if (def.scope === 'match') input.append(new Option('Not decided yet', ''));
			for (const [v, text] of Object.entries(options)) {
				input.append(new Option(text, v, false, v === value));
			}
		} else if (def.type === 'bool') {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.checked = !!value;
		} else if (def.type === 'int') {
			input = document.createElement('input');
			input.type = 'number';
			input.inputMode = 'numeric';
			if (def.min !== undefined) input.min = def.min;
			if (def.max !== undefined) input.max = def.max;
			input.value = value;
		} else {
			input = document.createElement('input');
			input.type = 'text';
			input.value = value == null ? '' : value;
			if (def.placeholder) input.placeholder = def.placeholder;
		}

		input.id = 'new-' + def.key;
		input.dataset.setting = def.key;

		row.append(label, input);
		if (def.hint) row.append(node('div', 'hint', def.hint));
		return row;
	}

	// A setting only appears once whatever it depends on is switched on, which
	// is what keeps this form short for the people who want it short.
	const live = (def) => def.stored !== false && (!def.when || def.when(rules));

	function renderSettings() {
		const main = D.SETTINGS.filter((d) => D.MAIN_KEYS.includes(d.key) && live(d));
		els.main.replaceChildren(
			node('h2', null, 'How are you playing?'),
			...D.layout(main, control)
		);

		els.rest.replaceChildren();
		for (const group of D.GROUPS) {
			const defs = D.SETTINGS.filter(
				(d) => d.group === group && !D.MAIN_KEYS.includes(d.key) && live(d)
			);
			if (!defs.length) continue;

			const box = document.createElement('details');
			box.className = 'set-group';
			box.dataset.group = group;
			// The form is rebuilt whenever a setting changes, so a group the
			// person opened has to be put back open — otherwise ticking a box
			// folds away the box you just ticked.
			box.open = openGroups.has(group);
			box.addEventListener('toggle', () => {
				if (box.open) openGroups.add(group); else openGroups.delete(group);
			});

			const head = document.createElement('summary');
			head.textContent = group;
			box.append(head, ...D.layout(defs, control));
			els.rest.append(box);
		}
	}

	function onSettingChange(e) {
		const input = e.target.closest('[data-setting]');
		if (!input) return;
		const def = D.SETTINGS.find((d) => d.key === input.dataset.setting);
		if (!def) { TDC.error(AREA, 'no definition for setting: ' + input.dataset.setting); return; }

		if (!setValue(def, def.type === 'bool' ? input.checked : input.value)) return;

		// Turning one on can reveal others, so the form is rebuilt. Focus is put
		// back, or changing a checkbox would throw you to the top of the page.
		const id = input.id;
		renderSettings();
		const again = document.getElementById(id);
		if (again) again.focus({ preventScroll: true });
	}

	// ─── Opponent ───
	function showChosen() {
		els.chosen.hidden = !opponent;
		els.field.hidden = !!opponent;
		els.results.replaceChildren();
		if (!opponent) { els.create.disabled = true; renderSettings(); return; }

		els.chosenDisplay.textContent = opponent.display_name;
		// Plenty of people sign up with their full name as their display name.
		els.chosenFull.textContent =
			(opponent.full_name && opponent.full_name !== opponent.display_name) ? opponent.full_name : '';
		els.chosenAvatar.textContent = (opponent.display_name || '?').trim().charAt(0).toUpperCase();
		if (opponent.avatar_path) {
			const { data } = supabaseClient.storage.from('player-avatars').getPublicUrl(opponent.avatar_path);
			if (data) {
				els.chosenAvatar.style.backgroundImage = `url("${data.publicUrl}")`;
				els.chosenAvatar.textContent = '';
			}
		}
		els.create.disabled = false;
		renderSettings();   // the lag winner's options are the two names
	}

	let searchRun = 0;
	async function search(term) {
		const run = ++searchRun;
		if (term.trim().length < 2) { els.results.replaceChildren(); return; }

		const { data, error } = await supabaseClient.rpc('tdc_search_opponents', { p_query: term, p_limit: 20 });
		if (run !== searchRun) return;   // a later keystroke has overtaken this one
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data.length) {
			els.results.replaceChildren(node('p', 'muted', 'Nobody by that name. They need an account to be played against here.'));
			return;
		}

		els.results.replaceChildren(...data.map((p) => {
			const b = node('button', 'result');
			b.type = 'button';
			b.append(node('span', 'result-name', p.display_name));
			if (p.full_name) b.append(node('span', 'result-sub', p.full_name));
			b.addEventListener('click', () => { opponent = p; els.search.value = ''; showChosen(); });
			return b;
		}));
	}

	let typingTimer = null;
	els.search.addEventListener('input', () => {
		clearTimeout(typingTimer);
		const term = els.search.value;
		typingTimer = setTimeout(() => search(term), 250);
	});

	els.clear.addEventListener('click', () => { opponent = null; showChosen(); els.search.focus(); });

	document.addEventListener('change', onSettingChange);

	// ─── Start ───
	els.create.addEventListener('click', async () => {
		if (!opponent) { TDC.status(els.status, 'Choose who you are playing first.', ''); return; }

		els.create.disabled = true;
		TDC.status(els.status, 'Starting…', '');

		const { data, error } = await supabaseClient.rpc('tdc_create_match', {
			p_opponent_player_id: opponent.id,
			p_rules: rules,
			p_first_break_side: firstBreakSide,
			p_venue_id: null,
			p_i_am: 'home'
		});

		if (error) {
			els.create.disabled = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return;
		}
		if (!data) {
			els.create.disabled = false;
			TDC.error(AREA, 'the match was not created and no reason was given.', null, els.status);
			return;
		}

		// The time goes in a second call rather than as another argument to
		// tdc_create_match. It is not part of creating a match — it can be set
		// and changed afterwards by the same function — and adding an argument
		// would mean dropping and recreating a function that works.
		//
		// If this one fails the match still exists with no time on it, which is
		// the state every match was in until today and is fixable on the match
		// page. So it is reported and not treated as a failure to create.
		const when = whenValue();
		if (when) {
			const { error: timeError } = await supabaseClient.rpc('tdc_set_match_time', {
				p_match_id: data,
				p_scheduled_at: when
			});
			if (timeError) {
				console.error('[' + AREA + '] the match was created but the time was not saved.', timeError);
				TDC.status(els.status, 'Match started, but the time was not saved. Set it on the match page.', '');
			}
		}

		// Tell the opponent they are in a match. Awaited, because the page is
		// about to leave and an unfinished request goes with it — but a failure
		// is logged and ignored. The match exists either way, and the one thing
		// worse than a missing notification is a created match the player is
		// stopped from opening.
		await tellTheOpponent(data);

		location.href = '/match/?id=' + encodeURIComponent(data);
	});

	// A datetime-local field has no time zone: "2026-10-21T19:30" means half
	// seven where the person is standing. Date() reads it as local time, which
	// is exactly right, and toISOString() then pins it to a real moment.
	function whenValue() {
		const raw = (els.when.value || '').trim();
		if (!raw) return null;
		const d = new Date(raw);
		if (isNaN(d.getTime())) {
			TDC.error(AREA, 'the date entered could not be read: ' + raw, null, els.status);
			return null;
		}
		return d.toISOString();
	}

	// The page sends only which match and what happened. Who to tell and what to
	// say are decided by the function from the match itself, so this cannot be
	// used to push arbitrary text at anybody.
	async function tellTheOpponent(matchId) {
		try {
			const { data, error } = await supabaseClient.functions.invoke('notify-card', {
				body: { match_id: matchId, kind: 'opponent_added' }
			});
			if (error) {
				console.error('[' + AREA + '] could not tell the opponent about the match.', error);
				return;
			}
			if (data && data.sent === 0) {
				console.log('[' + AREA + '] opponent not notified: ' + (data.note || 'no devices'));
			}
		} catch (err) {
			console.error('[' + AREA + '] could not tell the opponent about the match.', err);
		}
	}

	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		if (!me) return;

		renderSettings();
		els.search.focus();
	})();
})();
