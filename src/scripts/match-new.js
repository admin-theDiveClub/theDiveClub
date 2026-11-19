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
		create: el('create-btn'), status: el('create-status'),
		// Doubles (UV, 19 Nov)
		format: el('match-format'), doubles: el('doubles'),
		dblHome: el('dbl-home'), dblAway: el('dbl-away')
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
	let referee = null;             // saved by a second call once the match exists
	const openGroups = new Set();   // which collapsed groups the person has opened
	let me = null;

	// Doubles (UV, 19 Nov; migration 20261119124608). 'singles' or 'doubles';
	// in doubles each side is a list of seats, you in the first home seat, and
	// `target` is the seat the search fills next. Built for 2 v 2 (SEATS), the
	// database takes up to four a side.
	const SEATS = 2;
	let format = 'singles';
	const seats = { home: Array(SEATS).fill(null), away: Array(SEATS).fill(null) };
	let target = { side: 'home', i: 1 };

	const sideName = (side) => seats[side].map((p) => (p ? p.display_name : null)).filter(Boolean).join(' & ');

	// The creator is always home, so the lag winner reads as two names rather
	// than "home" and "away".
	D.setSideNames(() => (format === 'doubles'
		? { home: sideName('home') || 'Your side', away: sideName('away') || 'Your opponents' }
		: {
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

		// The referee is a search, not an input: picking someone redraws the
		// form with them chosen, and nothing saves until Start Match.
		if (def.type === 'player') {
			label.htmlFor = 'new-referee-search';
			row.append(label, D.playerPicker({
				id: 'new-referee-search',
				chosen: referee,
				status: els.status,
				onPick: (p) => { referee = p; renderSettings(); }
			}));
			if (def.hint) row.append(node('div', 'hint', def.hint));
			return row;
		}

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

	// ─── Singles or doubles ───
	// The pill's two buttons; switching keeps whoever was chosen on both, so
	// going back and forth loses nothing.
	function setFormat(f) {
		format = f;
		for (const b of els.format.querySelectorAll('[data-format]')) b.setAttribute('aria-pressed', String(b.dataset.format === f));
		els.doubles.hidden = f !== 'doubles';
		els.search.value = '';
		els.results.replaceChildren();
		if (f === 'doubles') renderSeats(); else showChosen();
	}

	els.format.addEventListener('click', (e) => {
		const b = e.target.closest('[data-format]');
		if (b && b.dataset.format !== format) setFormat(b.dataset.format);
	});

	// A picture in its circle: the photo, or the first letter.
	function paintAvatar(box, p) {
		box.textContent = (p.display_name || '?').trim().charAt(0).toUpperCase();
		box.style.backgroundImage = '';
		if (p.avatar_path) {
			const { data } = supabaseClient.storage.from('player-avatars').getPublicUrl(p.avatar_path);
			if (data) {
				box.style.backgroundImage = `url("${data.publicUrl}")`;
				box.textContent = '';
			}
		}
	}

	const allSeated = () => ['home', 'away'].every((s) => seats[s].every(Boolean));
	const firstEmpty = () => {
		for (const side of ['home', 'away']) {
			const i = seats[side].findIndex((p) => !p);
			if (i >= 0) return { side, i };
		}
		return null;
	};

	// The two sides as seats. You hold the first home seat and cannot leave it;
	// every other seat is a tap to fill (the search below points at it) or,
	// once filled, the player with Remove.
	function renderSeats() {
		seats.home[0] = me;
		if (target && seats[target.side][target.i]) target = firstEmpty();
		if (!target) target = firstEmpty();

		for (const side of ['home', 'away']) {
			const box = side === 'home' ? els.dblHome : els.dblAway;
			box.replaceChildren(...seats[side].map((p, i) => {
				const seat = node('div', 'dbl-seat');
				const pic = node('span', 'chosen-avatar');

				if (p) {
					paintAvatar(pic, p);
					TDC.profilePic(pic, p.id);   // opens their profile, as singles does
					seat.append(pic, node('span', 'dbl-name', p === me ? 'You' : p.display_name));
					if (p !== me) {
						const rm = node('button', 'link', 'Remove');
						rm.type = 'button';
						rm.addEventListener('click', () => {
							seats[side][i] = null;
							target = { side, i };
							renderSeats();
							els.search.focus();
						});
						seat.append(rm);
					}
				} else {
					seat.classList.add('dbl-empty');
					if (target && target.side === side && target.i === i) seat.classList.add('is-target');
					pic.textContent = '+';
					const label = side === 'home' ? 'Add partner' : 'Add player';
					const pick = node('button', 'dbl-pick');
					pick.type = 'button';
					pick.append(pic);
					seat.append(pick);
					pick.setAttribute('aria-label', label);
					pick.addEventListener('click', () => {
						target = { side, i };
						renderSeats();
						els.search.focus();
					});
					seat.append(node('span', 'dbl-name', label));
				}
				return seat;
			}));
		}

		// The search stays only while a seat is empty, labelled for that seat.
		els.chosen.hidden = true;
		els.field.hidden = !target;
		const label = els.field.querySelector('label');
		if (label) label.textContent = !target ? 'Opponent' : target.side === 'home' ? 'Your partner' : 'Opponent';
		if (!target) els.results.replaceChildren();
		els.create.disabled = !allSeated();
		renderSettings();   // the lag winner's options are the two sides
	}

	// ─── Opponent ───
	function showChosen() {
		const label = els.field.querySelector('label');
		if (label) label.textContent = 'Opponent';
		els.chosen.hidden = !opponent;
		els.field.hidden = !!opponent;
		els.results.replaceChildren();
		if (!opponent) { els.create.disabled = true; renderSettings(); return; }

		els.chosenDisplay.textContent = opponent.display_name;
		// Plenty of people sign up with their full name as their display name.
		els.chosenFull.replaceChildren(
			(opponent.full_name && opponent.full_name !== opponent.display_name) ? TDC.fullName(opponent.full_name, opponent.surname) : '');
		els.chosenAvatar.textContent = (opponent.display_name || '?').trim().charAt(0).toUpperCase();
		TDC.profilePic(els.chosenAvatar, opponent.id);   // opens their profile (UV, 5 Nov)
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

		// Doubles: somebody already in a seat is not offered again.
		const seated = new Set(format === 'doubles' ? [...seats.home, ...seats.away].filter(Boolean).map((p) => p.id) : []);
		const found = data.filter((p) => !seated.has(p.id));

		if (!found.length) {
			els.results.replaceChildren(node('p', 'muted', data.length
				? 'Everybody by that name is already in this match.'
				: 'Nobody by that name. They need an account to be played against here.'));
			return;
		}

		els.results.replaceChildren(...found.map((p) => {
			const b = node('button', 'result');
			b.type = 'button';
			b.append(node('span', 'result-name', p.display_name));
			if (p.full_name) {
				const sub = node('span', 'result-sub');
				sub.append(TDC.fullName(p.full_name, p.surname));
				b.append(sub);
			}
			b.addEventListener('click', () => {
				els.search.value = '';
				if (format === 'doubles') {
					if (!target) return;
					seats[target.side][target.i] = p;
					target = firstEmpty();   // on to the next empty seat
					els.results.replaceChildren();
					renderSeats();
					if (target) els.search.focus();
					return;
				}
				opponent = p; showChosen();
			});
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
	// The dots stay on the button through every call (UV, 29 Oct: never a
	// loading message).
	els.create.addEventListener('click', () => TDC.busy(els.create, (async () => {
		const doubles = format === 'doubles';
		if (doubles ? !allSeated() : !opponent) {
			TDC.status(els.status, doubles ? 'Fill every seat first.' : 'Choose who you are playing first.', '');
			return;
		}

		els.create.disabled = true;
		TDC.status(els.status, '', '');

		// Doubles is its own function (20261119124608): a list of players a
		// side, in seat order, you first at home.
		const { data, error } = doubles
			? await supabaseClient.rpc('tdc_create_team_match', {
				p_home_players: seats.home.map((p) => p.id),
				p_away_players: seats.away.map((p) => p.id),
				p_rules: rules,
				p_first_break_side: firstBreakSide,
				p_venue_id: null
			})
			: await supabaseClient.rpc('tdc_create_match', {
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

		// The referee likewise: a second call, and a failure leaves a match
		// with no referee, which the match page can put right.
		if (referee) {
			const { error: refError } = await supabaseClient.rpc('tdc_set_match_referee', {
				p_match_id: data,
				p_player_id: referee.id
			});
			if (refError) {
				console.error('[' + AREA + '] the match was created but the referee was not saved.', refError);
				TDC.status(els.status, 'Match started, but the referee was not saved. Set it on the match page.', '');
			}
		}

		// Tell the opponent they are in a match. Awaited, because the page is
		// about to leave and an unfinished request goes with it — but a failure
		// is logged and ignored. The match exists either way, and the one thing
		// worse than a missing notification is a created match the player is
		// stopped from opening.
		await tellTheOpponent(data);

		location.href = '/match/?id=' + encodeURIComponent(data);
	})(), els.status));

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

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		if (!me) return;

		renderSettings();
		els.search.focus();
	})(), 'New match');
})();
