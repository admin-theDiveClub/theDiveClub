// Entrants (/tournaments/manage/?t=<id>). The screen a tournament is run from.
//
// Reads with tdc_tournament_entrants, which returns names, status, paid and
// seed together — asking for each separately is a request per row on a page
// that shows thirty.
//
// Writes go through tdc_add_entrant, tdc_set_entrant, tdc_remove_entrant and
// tdc_set_seeds, and after every write the list is read again rather than
// patched here: the server decides the order, and a page that believes its own
// copy drifts from it the first time two people are adding entrants at once.
//
// Seeding is always sent as the whole order, never one seed at a time. That is
// what tdc_set_seeds takes, and it is the only way the result cannot come out
// with two number fours in it.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Entrants';

	const FORMAT = {
		single_elimination: 'Single elimination',
		double_elimination: 'Double elimination',
		round_robin: 'Round robin',
		groups_knockout: 'Groups then knockout'
	};
	const STATUS = { interested: 'Interested', confirmed: 'Confirmed', withdrawn: 'Withdrawn' };

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('t-name'), meta: el('t-meta'),
		search: el('entrant-search'), results: el('search-results'),
		table: el('entrant-table'), rows: el('entrant-rows'),
		count: el('entrant-count'), empty: el('entrant-empty'),
		seedActions: el('seed-actions'),
		seedRandom: el('seed-random'), seedClear: el('seed-clear'),
		entrySettings: el('entry-settings'), entryMode: el('entry-mode'),
		entryModeHint: el('entry-mode-hint'), paidConfirms: el('paid-confirms'),
		entryLink: el('entry-link'),
		status: el('page-status'), drawLink: el('draw-link'),
		officialAdd: el('official-add'), officialSearch: el('official-search'),
		officialRole: el('official-role'), officialResults: el('official-results'),
		officialTable: el('official-table'), officialRows: el('official-rows')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the entrants page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const tournamentId = new URLSearchParams(location.search).get('t');

	// ─── State ───
	let entrants = [];
	let officials = [];
	let busy = false;       // one write at a time, so two clicks cannot race
	// Only the people running the tournament get here at all now — see the
	// redirect at the bottom. Kept because every control still asks it, so
	// nothing is enabled by a re-read going wrong.
	let readOnly = false;

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── The tournament itself ───
	async function loadTournament() {
		const { data, error } = await supabaseClient
			.from('tbl_tournaments')
			.select('id, name, format, status, starts_at, max_entrants, entry_fee_credits, entry_mode, paid_confirms')
			.eq('id', tournamentId)
			.maybeSingle();

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return null; }
		if (!data) {
			TDC.error(AREA, 'no tournament with that id. Check the link.', { tournamentId }, els.status);
			return null;
		}

		els.name.textContent = data.name;

		const bits = [FORMAT[data.format] || data.format];
		if (data.starts_at) {
			const d = new Date(data.starts_at);
			if (isNaN(d)) TDC.error(AREA, 'unreadable start date: ' + data.starts_at);
			else bits.push(d.toLocaleString([], {
				weekday: 'short', day: 'numeric', month: 'short',
				hour: '2-digit', minute: '2-digit'
			}));
		}
		if (data.max_entrants) bits.push('Max ' + data.max_entrants);
		if (data.entry_fee_credits > 0) bits.push(data.entry_fee_credits + ' credits to enter');
		els.meta.textContent = bits.join(' · ');

		return data;
	}

	// ─── The list ───
	async function loadEntrants() {
		const { data, error } = await supabaseClient.rpc('tdc_tournament_entrants', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		entrants = data || [];
		renderEntrants();
		return true;
	}

	// Withdrawn entrants keep their place in the list — a TD needs to see who
	// pulled out — but they are not in the draw and so are never seeded.
	const inTheDraw = (e) => e.status !== 'withdrawn';

	function statusCell(e) {
		const select = document.createElement('select');
		for (const [v, text] of Object.entries(STATUS)) {
			select.append(new Option(text, v, false, v === e.status));
		}
		select.dataset.entrant = e.entrant_id;
		select.dataset.action = 'status';
		select.disabled = readOnly;
		select.setAttribute('aria-label', 'Status for ' + e.display_name);
		return select;
	}

	function paidCell(e) {
		const box = document.createElement('input');
		box.type = 'checkbox';
		box.checked = !!e.paid;
		box.dataset.entrant = e.entrant_id;
		box.dataset.action = 'paid';
		box.disabled = readOnly;
		box.setAttribute('aria-label', 'Paid: ' + e.display_name);
		return box;
	}

	// When they paid. UV asked for this beside the tick, and it answers the
	// question a tick cannot: whether somebody paid at the desk this evening or
	// three weeks ago when entries opened.
	function paidWhen(e) {
		if (!e.paid_at) return '';
		const d = new Date(e.paid_at);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable payment time: ' + e.paid_at); return ''; }

		const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const days = Math.round((midnight(new Date()) - midnight(d)) / 86400000);
		const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

		if (days === 0) return time;
		if (days === 1) return 'Yesterday ' + time;
		return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
	}

	function seedCell(e) {
		const input = document.createElement('input');
		input.type = 'number';
		input.inputMode = 'numeric';
		input.min = 1;
		input.value = e.seed == null ? '' : e.seed;
		input.placeholder = '–';
		input.style.width = '3.5rem';
		input.dataset.entrant = e.entrant_id;
		input.dataset.action = 'seed';
		input.disabled = readOnly || !inTheDraw(e);
		input.setAttribute('aria-label', 'Seed for ' + e.display_name);
		return input;
	}

	function row(e) {
		const tr = document.createElement('tr');

		const seed = node('td', 'num');
		seed.append(seedCell(e));

		const who = document.createElement('td');
		who.append(node('span', null, e.display_name));
		const sub = [];
		// A walk-in cannot be told anything — no account, no notification — and
		// that is the thing a TD needs to know when the draw goes out.
		if (!e.has_account) sub.push('Walk-in');
		if (e.full_name && e.full_name !== e.display_name) sub.unshift(e.full_name);
		if (sub.length) who.append(node('span', 'sub', sub.join(' · ')));

		const status = document.createElement('td');
		status.append(statusCell(e));

		const paid = document.createElement('td');
		paid.append(paidCell(e));

		const actions = document.createElement('td');
		const remove = node('button', 'btn btn-danger btn-sm', 'Remove');
		remove.type = 'button';
		remove.dataset.entrant = e.entrant_id;
		remove.dataset.action = 'remove';
		remove.dataset.name = e.display_name;
		remove.disabled = readOnly;
		actions.append(remove);

		tr.append(seed, who, status, paid, node('td', 'sub', paidWhen(e)), actions);
		return tr;
	}

	function renderEntrants() {
		const playing = entrants.filter(inTheDraw).length;

		els.table.hidden = !entrants.length;
		els.empty.hidden = !!entrants.length;
		els.seedActions.hidden = playing < 2 || readOnly;

		els.count.hidden = !entrants.length;
		els.count.textContent = playing === 1 ? '1 in the draw' : playing + ' in the draw';

		els.rows.replaceChildren(...entrants.map(row));
	}

	// ─────────────────────────────────────────────────────────────────
	// How people get in
	//
	// Both settings go through tdc_update_tournament, the one function that
	// changes a tournament, rather than writing the columns from here.
	// ─────────────────────────────────────────────────────────────────

	const ENTRY_HINT = {
		td_only: 'Nobody can put themselves down. Search above to add them.',
		interested: 'Players can mark themselves interested. You confirm them, on whatever basis you use.',
		self_confirm: 'Players can confirm their own entry. Right for a free tournament, or one paid for at the desk.'
	};

	function renderEntrySettings(t) {
		els.entrySettings.hidden = readOnly;
		els.entryMode.value = t.entry_mode;
		els.entryMode.disabled = readOnly;
		els.entryModeHint.textContent = ENTRY_HINT[t.entry_mode] || '';
		els.paidConfirms.checked = !!t.paid_confirms;
		els.paidConfirms.disabled = readOnly;

		// The poster page is where this will point once it exists — it is the
		// one page meant to be opened by somebody who is not signed in. Until
		// then the draw is the honest destination, because it is what a shared
		// link actually reaches today.
		els.entryLink.value = location.origin
			+ '/tournaments/bracket/?t=' + encodeURIComponent(tournamentId);
	}

	// Changing a setting re-reads the tournament rather than trusting the
	// control, for the same reason the entrant list does.
	async function saveEntrySetting(what, args) {
		if (busy) return;
		busy = true;
		TDC.status(els.status, what + '…', '');

		const { error } = await supabaseClient.rpc('tdc_update_tournament',
			Object.assign({ p_tournament_id: tournamentId }, args));

		busy = false;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); }
		const t = await loadTournament();
		if (t) renderEntrySettings(t);
		if (!error) TDC.status(els.status, '', '');
	}

	els.entryMode.addEventListener('change', () =>
		saveEntrySetting('Saving', { p_entry_mode: els.entryMode.value }));

	els.paidConfirms.addEventListener('change', () =>
		saveEntrySetting('Saving', { p_paid_confirms: els.paidConfirms.checked }));

	els.entryLink.addEventListener('focus', () => els.entryLink.select());

	// ─────────────────────────────────────────────────────────────────
	// Who runs it
	//
	// The director is created with the tournament and cannot be removed while
	// they are the only one, so this is mostly about referees and scorers —
	// which score_entry_mode now actually depends on.
	// ─────────────────────────────────────────────────────────────────

	async function loadRoleTypes() {
		const { data, error } = await supabaseClient
			.from('tbl_competition_role_types')
			.select('key, name, rank')
			.order('rank', { ascending: false });

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		els.officialRole.replaceChildren(
			...(data || []).map((r) => new Option(r.name, r.key)));
		// A referee is the one somebody usually wants to add; the director
		// already exists and a scorer is the narrower case.
		const ref = (data || []).find((r) => r.key === 'referee');
		if (ref) els.officialRole.value = ref.key;
	}

	async function loadOfficials() {
		const { data, error } = await supabaseClient.rpc('tdc_competition_officials', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		officials = data || [];
		renderOfficials();
		return true;
	}

	function officialRow(o) {
		const tr = document.createElement('tr');
		tr.append(node('td', null, o.display_name));
		tr.append(node('td', null, o.role_name));

		const actions = document.createElement('td');
		if (!readOnly) {
			const remove = node('button', 'btn btn-danger btn-sm', 'Remove');
			remove.type = 'button';
			remove.dataset.role = o.role_id;
			remove.dataset.name = o.display_name;
			remove.dataset.what = o.role_name;
			actions.append(remove);
		}
		tr.append(actions);
		return tr;
	}

	function renderOfficials() {
		els.officialTable.hidden = !officials.length;
		els.officialRows.replaceChildren(...officials.map(officialRow));
	}

	els.officialRows.addEventListener('click', (e) => {
		const button = e.target.closest('[data-role]');
		if (!button) return;
		if (!confirm(`Remove ${button.dataset.name} as ${button.dataset.what.toLowerCase()}?`)) return;
		write('Removing', () =>
			supabaseClient.rpc('tdc_remove_competition_role', { p_role_id: button.dataset.role }));
	});

	let officialRun = 0;
	async function searchOfficials(term) {
		const run = ++officialRun;
		if (term.trim().length < 2) { els.officialResults.replaceChildren(); return; }

		// The same search the entrant list uses: it is gated on running the
		// tournament and returns every player, which is right here too —
		// an official need not be entered in the thing they are running.
		const { data, error } = await supabaseClient.rpc('tdc_search_entrants', {
			p_tournament_id: tournamentId, p_query: term, p_limit: 20
		});
		if (run !== officialRun) return;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.officialResults.replaceChildren(node('p', 'muted', 'Nobody by that name.'));
			return;
		}

		els.officialResults.replaceChildren(...data.map((p) => {
			const b = node('button', 'result');
			b.type = 'button';
			b.append(node('span', 'result-name', p.display_name));

			const sub = [];
			if (p.full_name && p.full_name !== p.display_name) sub.push(p.full_name);
			// A walk-in has no account, so they cannot sign in to score
			// anything. Worth saying before somebody appoints one as a scorer.
			if (!p.has_account) sub.push('Walk-in — cannot sign in');
			const held = officials.filter((o) => o.player_id === p.id).map((o) => o.role_name);
			if (held.length) sub.push('Already ' + held.join(', ').toLowerCase());
			if (sub.length) b.append(node('span', 'result-sub', sub.join(' · ')));

			b.disabled = !p.has_account;
			if (p.has_account) {
				b.addEventListener('click', () => addOfficial(p.id, p.display_name));
			}
			return b;
		}));
	}

	async function addOfficial(playerId, name) {
		const role = els.officialRole.value;
		const done = await write(`Adding ${name}`, () =>
			supabaseClient.rpc('tdc_add_competition_role', {
				p_tournament_id: tournamentId,
				p_player_id: playerId,
				p_role: role
			}));
		if (done) {
			els.officialSearch.value = '';
			els.officialResults.replaceChildren();
			els.officialSearch.focus();
		}
	}

	let officialTimer = null;
	els.officialSearch.addEventListener('input', () => {
		clearTimeout(officialTimer);
		const term = els.officialSearch.value;
		officialTimer = setTimeout(() => searchOfficials(term), 250);
	});

	// ─── Writing ───
	// Every write goes through here: one at a time, the list re-read
	// afterwards, and nothing swallowed quietly.
	async function write(what, fn) {
		if (busy) return false;
		busy = true;
		TDC.status(els.status, what + '…', '');

		const { error } = await fn();
		if (error) {
			busy = false;
			TDC.showSupabaseError(AREA, error, els.status);
			// The screen still shows what the person just clicked, which is now
			// a lie. Re-reading puts it back to what the server actually holds.
			await loadEntrants();
			return false;
		}

		const ok = await loadEntrants();
		await loadOfficials();
		busy = false;
		if (ok) TDC.status(els.status, '', '');
		return ok;
	}

	async function addEntrant(playerId, name) {
		const done = await write('Adding ' + name, () =>
			supabaseClient.rpc('tdc_add_entrant', {
				p_tournament_id: tournamentId,
				p_player_id: playerId,
				p_status: 'interested'
			}));
		if (done) {
			els.search.value = '';
			els.results.replaceChildren();
			els.search.focus();
		}
	}

	// ─── Seeding ───
	// The whole order, every time. Entrants are sorted by the seed showing in
	// their box, with anybody unseeded falling to the end in name order, and
	// that sorted list becomes seeds 1..n. Two people typing "3" cannot
	// therefore produce two number threes — the second one just sorts next to
	// the first and they come out 3 and 4.
	function currentOrder() {
		const typed = new Map();
		for (const input of els.rows.querySelectorAll('[data-action="seed"]')) {
			const raw = (input.value || '').trim();
			const n = raw === '' ? null : parseInt(raw, 10);
			typed.set(input.dataset.entrant, isNaN(n) ? null : n);
		}

		return entrants
			.filter(inTheDraw)
			.map((e) => ({ id: e.entrant_id, name: e.display_name, seed: typed.get(e.entrant_id) }))
			.sort((a, b) => {
				const as = a.seed == null ? Infinity : a.seed;
				const bs = b.seed == null ? Infinity : b.seed;
				if (as !== bs) return as - bs;
				return a.name.localeCompare(b.name);
			})
			.map((x) => x.id);
	}

	async function setSeeds(order, what) {
		await write(what, () =>
			supabaseClient.rpc('tdc_set_seeds', {
				p_tournament_id: tournamentId,
				p_order: order
			}));
	}

	// Fisher-Yates. A shuffle done by sorting on Math.random() is not uniform,
	// and a draw is the one place that matters.
	function shuffled(ids) {
		const a = ids.slice();
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	els.seedRandom.addEventListener('click', () => {
		const ids = entrants.filter(inTheDraw).map((e) => e.entrant_id);
		if (ids.length < 2) { TDC.status(els.status, 'Two entrants are needed before there is anything to seed.', ''); return; }
		setSeeds(shuffled(ids), 'Randomising');
	});

	// An empty list is how tdc_set_seeds is told to clear them all.
	els.seedClear.addEventListener('click', () => setSeeds([], 'Clearing seeds'));

	// ─── Row actions ───
	els.rows.addEventListener('change', (e) => {
		const control = e.target.closest('[data-action]');
		if (!control) return;
		const id = control.dataset.entrant;

		if (control.dataset.action === 'status') {
			write('Saving', () => supabaseClient.rpc('tdc_set_entrant', {
				p_entrant_id: id,
				p_status: control.value
			}));
			return;
		}

		if (control.dataset.action === 'paid') {
			write('Saving', () => supabaseClient.rpc('tdc_set_entrant', {
				p_entrant_id: id,
				p_paid: control.checked
			}));
			return;
		}

		if (control.dataset.action === 'seed') {
			setSeeds(currentOrder(), 'Reseeding');
		}
	});

	els.rows.addEventListener('click', (e) => {
		const button = e.target.closest('[data-action="remove"]');
		if (!button) return;

		// Removing is not withdrawing: it takes the person out of the record
		// entirely, so it is worth one question.
		if (!confirm(`Take ${button.dataset.name} out of this tournament?\n\nTo keep them on the list but out of the draw, set their status to Withdrawn instead.`)) return;

		write('Removing', () => supabaseClient.rpc('tdc_remove_entrant', {
			p_entrant_id: button.dataset.entrant
		}));
	});

	// ─── Search ───
	let searchRun = 0;
	async function search(term) {
		const run = ++searchRun;
		if (term.trim().length < 2) { els.results.replaceChildren(); return; }

		const { data, error } = await supabaseClient.rpc('tdc_search_entrants', {
			p_tournament_id: tournamentId,
			p_query: term,
			p_limit: 20
		});
		if (run !== searchRun) return;   // a later keystroke has overtaken this one
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.results.replaceChildren(node('p', 'muted',
				'Nobody by that name. A player without an account has to be created by staff at a venue first, under Staff · Walk-in.'));
			return;
		}

		els.results.replaceChildren(...data.map((p) => {
			const b = node('button', 'result');
			b.type = 'button';
			b.append(node('span', 'result-name', p.display_name));

			const sub = [];
			if (p.full_name && p.full_name !== p.display_name) sub.push(p.full_name);
			if (!p.has_account) sub.push('Walk-in');
			if (p.already_in) sub.push('Already entered');
			if (sub.length) b.append(node('span', 'result-sub', sub.join(' · ')));

			// Somebody already in the list is shown so the TD can see they are
			// there, rather than vanishing and reading as "not found".
			b.disabled = !!p.already_in;
			if (!p.already_in) {
				b.addEventListener('click', () => addEntrant(p.id, p.display_name));
			}
			return b;
		}));
	}

	let typingTimer = null;
	els.search.addEventListener('input', () => {
		clearTimeout(typingTimer);
		const term = els.search.value;
		typingTimer = setTimeout(() => search(term), 250);
	});

	// ─── Start ───
	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.status);
			return;
		}

		els.drawLink.href = '/tournaments/bracket/?t=' + encodeURIComponent(tournamentId);

		const tournament = await loadTournament();
		if (!tournament) return;

		// Settled before anything is drawn, so the controls are never offered
		// and then taken away. tdc_may_run_tournament asks
		// private.tdc_can_run_tournament directly — the same one place the
		// writes themselves ask, so the page and the database cannot disagree.
		// Reading it out of tdc_my_tournaments instead would miss a venue's
		// staff standing in for a director who went home, because that list
		// only holds tournaments you run or are entered in.
		const { data: mayRun, error } = await supabaseClient.rpc('tdc_may_run_tournament', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		// This page used to render read-only for anybody signed in. It cannot
		// any more: tdc_tournament_entrants is gated as of 21 Oct, because it
		// carries payment status and the TD's private notes, so a player now
		// gets an empty list — which would read as "nobody has entered yet".
		//
		// Sending them to the draw instead, which is the page for somebody who
		// is in the tournament rather than running it. A player only lands here
		// from an old link or a typed address; the tournament list has pointed
		// them at the draw since 20 Oct.
		if (!mayRun) {
			readOnly = true;
			TDC.status(els.status, 'Taking you to the draw — the entrant list is for whoever is running this.', '');
			location.replace('/tournaments/bracket/?t=' + encodeURIComponent(tournamentId));
			return;
		}

		renderEntrySettings(tournament);

		if (!await loadEntrants()) return;
		await loadRoleTypes();
		await loadOfficials();

		els.search.focus();
	})();
})();
