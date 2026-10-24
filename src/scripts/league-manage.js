// Run a league season (/leagues/manage/?s=<league season id>).
//
// Reads with one call each — tdc_league_season_entrants (the director's list:
// names, status, confirmation, team, captain, paid), tdc_league_season_teams,
// tdc_league_season_readiness and tdc_league_officials — and after every write
// reads all of them again rather than patching its own copy. The server owns
// the answer, and a page that believes its own copy drifts the first time a
// player confirms while the director is looking.
//
// Only players with an account can be added. A league player confirms their
// own place, which takes an account; the database refuses a walk-in by trigger
// and this page does not offer one, so the two cannot disagree.
//
// Only the director makes a team. A captain controls theirs from the season
// page. The director can do all of it from here too, because tdc_set_league_entrant
// is the director's override.
//
// Needs: tdc.js.

(() => {
	const AREA = 'League';


	const el = (id) => document.getElementById(id);
	const els = {
		name: el('l-name'), meta: el('l-meta'),
		readyPanel: el('ready-panel'), readyLine: el('ready-line'), readyDetail: el('ready-detail'),
		search: el('player-search'), results: el('search-results'),
		entryPanel: el('entry-panel'), entryMode: el('entry-mode'),
		entryModeHint: el('entry-mode-hint'), paidConfirms: el('paid-confirms'),
		isListed: el('is-listed'), shareLink: el('share-link'),
		transfer: el('transfer'),
		table: el('player-table'), rows: el('player-rows'),
		count: el('player-count'), empty: el('player-empty'),
		teamNew: el('team-new'), teamAdd: el('team-add'),
		teamTable: el('team-table'), teamRows: el('team-rows'), teamEmpty: el('team-empty'),
		teamOver: el('team-over'),
		officialRole: el('official-role'), officialSearch: el('official-search'),
		officialResults: el('official-results'),
		officialTable: el('official-table'), officialRows: el('official-rows'),
		status: el('page-status'),
		seasonLink: el('season-link'), newSeasonLink: el('new-season-link'),
		fixturesLink: el('fixtures-link'), settingsLink: el('settings-link')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the league page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');

	// ─── State ───
	let players = [];
	let season = null;         // the season row, for the entry settings
	let teams = [];
	let officials = [];
	let busy = false;       // one write at a time, so two clicks cannot race

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// A season's dates are plain dates with no time of day.
	function day(s) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a season: ' + s); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function stamp(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable time: ' + iso); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
	}

	// ─── The season itself ───
	async function loadInfo() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_info', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return null; }

		const info = (data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return null;
		}

		els.name.textContent = info.league_name + ' — ' + info.name;

		const bits = [];
		if (info.starts_on) bits.push('From ' + day(info.starts_on));
		if (info.ends_on) bits.push('to ' + day(info.ends_on));
		if (info.venue_name) bits.push(info.venue_name);
		els.meta.textContent = bits.join(' · ');
		els.newSeasonLink.href = '/leagues/new/?l=' + encodeURIComponent(info.league_id);
		return info;
	}

	// ─── Readiness ───
	async function loadReadiness() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_readiness', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		const r = (data || [])[0];
		els.readyPanel.hidden = !r;
		if (!r) return true;

		if (r.ready) {
			els.readyLine.textContent = 'Yes. All ' + r.active_players + ' active '
				+ (r.active_players === 1 ? 'player has' : 'players have') + ' confirmed.';
		} else if (!r.active_players) {
			els.readyLine.textContent = 'Not yet. Nobody active has been added.';
		} else {
			els.readyLine.textContent = 'Not yet. ' + r.confirmed + ' of ' + r.active_players
				+ ' active players have confirmed.';
		}

		const detail = [];
		if (r.waiting) detail.push('Waiting for ' + (r.waiting_names || []).join(', ') + '.');
		if (r.unplaced) detail.push(r.unplaced === 1 ? '1 player is on no team.' : r.unplaced + ' players are on no team.');
		// Not a reason to stop: a director can run a team's night for them.
		// But setting a lineup and signing the card are a captain's work, so
		// without one that team cannot field a side by itself.
		const noCap = r.teams_no_captain || [];
		if (noCap.length) {
			detail.push((noCap.length === 1 ? 'No captain for ' : 'No captain for ')
				+ noCap.join(', ') + ' — tick Captain beside one of their players, or you will have to run their nights yourself.');
		}
		els.readyDetail.textContent = detail.join(' ');
		return true;
	}

	// ─── How players get in ───
	// The same three choices a tournament has, saved through the one function
	// that changes a season rather than written from here.
	const ENTRY_HINT = {
		ld_only: 'Nobody can put themselves down. Search below to add them.',
		interested: 'Players find the league and put their name down. You confirm them from the first list.',
		self_confirm: 'Players are in as soon as they ask. Right for an open league, or one paid for at the desk.'
	};

	async function loadSeason() {
		const { data, error } = await supabaseClient
			.from('tbl_league_seasons')
			.select('id, entry_mode, paid_confirms, is_listed')
			.eq('id', seasonId)
			.maybeSingle();
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		season = data;
		renderEntry();
		return true;
	}

	function renderEntry() {
		if (!season) return;
		els.entryMode.value = season.entry_mode;

		// Listing a league nobody can put their name down for would show it in
		// the search as a dead end, so tdc_search_leagues leaves it out. That
		// is a surprise if you have just ticked the box, so it is said here
		// rather than left to be worked out.
		let hint = ENTRY_HINT[season.entry_mode] || '';
		if (season.is_listed && season.entry_mode === 'ld_only') {
			hint += ' It will not appear in the league search while this is set:'
				+ ' there would be no way in from there. Share the link below instead,'
				+ ' or let players put their name down.';
		}
		els.entryModeHint.textContent = hint;
		els.paidConfirms.checked = !!season.paid_confirms;
		els.isListed.checked = !!season.is_listed;
		els.shareLink.value = location.origin + '/leagues/join/?s=' + encodeURIComponent(seasonId);
	}

	els.shareLink.addEventListener('focus', () => els.shareLink.select());

	function saveEntry(args) {
		write('Saving', () => supabaseClient.rpc('tdc_update_league_season',
			Object.assign({ p_league_season_id: seasonId }, args)));
	}
	els.entryMode.addEventListener('change', () => saveEntry({ p_entry_mode: els.entryMode.value }));
	els.paidConfirms.addEventListener('change', () => saveEntry({ p_paid_confirms: els.paidConfirms.checked }));
	els.isListed.addEventListener('change', () => saveEntry({ p_is_listed: els.isListed.checked }));

	// ─── The three lists ───
	// Everything is one read; these are three views of it. The checkboxes are
	// kept across a redraw, because a redraw happens after every write and
	// losing a selection of fifteen people mid-job would be its own bug.
	const picked = { interested: new Set(), active: new Set(), suspended: new Set() };

	function transferRow(p, box) {
		const row = node('div', 'transfer-row');

		const tick = document.createElement('input');
		tick.type = 'checkbox';
		tick.dataset.control = 'ring';   // a tick against a person, not a setting
		tick.checked = picked[box].has(p.entrant_id);
		tick.dataset.box = box;
		tick.dataset.entrant = p.entrant_id;
		tick.id = 'pick-' + p.entrant_id;

		const label = document.createElement('label');
		label.htmlFor = tick.id;
		label.append(node('span', null, p.display_name));

		const sub = [];
		const full = [p.first_name, p.last_name].filter(Boolean).join(' ');
		if (full && full !== p.display_name) sub.push(full);
		if (box !== 'interested' && !p.confirmed_at) sub.push('Has not confirmed');
		if (p.team_name) sub.push(p.team_name);
		if (p.paid_at) sub.push('Paid');
		if (sub.length) label.append(node('span', 'sub', sub.join(' · ')));

		row.append(tick, label);
		return row;
	}

	function renderTransfer() {
		for (const box of ['interested', 'active', 'suspended']) {
			const rows = players.filter((p) => p.status === box);
			const ids = new Set(rows.map((r) => r.entrant_id));
			// Somebody who has moved on is no longer selectable here.
			for (const id of [...picked[box]]) if (!ids.has(id)) picked[box].delete(id);

			el('count-' + box).textContent = String(rows.length);
			const list = el('list-' + box);
            if (!rows.length) {
				list.replaceChildren(node('div', 'transfer-empty',
					box === 'interested' ? 'Nobody waiting.'
						: box === 'active' ? 'Nobody in the league yet.'
						: 'Nobody suspended.'));
			} else {
				list.replaceChildren(...rows.map((p) => transferRow(p, box)));
			}
		}
	}

	els.transfer.addEventListener('change', (e) => {
		const tick = e.target.closest('input[data-entrant]');
		if (!tick) return;
		const set = picked[tick.dataset.box];
		if (tick.checked) set.add(tick.dataset.entrant); else set.delete(tick.dataset.entrant);
	});

	els.transfer.addEventListener('click', (e) => {
		const b = e.target.closest('button[data-move]');
		if (!b) return;
		const from = b.dataset.from;
		const ids = [...picked[from]];
		if (!ids.length) {
			TDC.status(els.status, 'Tick whoever you mean first.', '');
			return;
		}
		// Suspending is taking somebody's place away, which is worth a question.
		if (b.dataset.move === 'suspended'
			&& !confirm(`Suspend ${ids.length === 1 ? 'this player' : these(ids.length)}?\n\nThey come off their team and lose their place until you put them back.`)) return;

		picked[from].clear();
		write('Moving', () => supabaseClient.rpc('tdc_set_league_entrants_status', {
			p_entrant_ids: ids, p_status: b.dataset.move
		}), (n) => (n === 1 ? '1 player moved.' : n + ' players moved.'));
	});

	const these = (n) => 'these ' + n + ' players';

	// ─── Teams ───
	async function loadTeams() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_teams', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		teams = data || [];
		renderTeams();
		return true;
	}

	function teamRow(t) {
		const tr = document.createElement('tr');

		const name = document.createElement('td');
		const input = document.createElement('input');
		input.type = 'text';
		input.maxLength = 120;
		input.value = t.name;
		input.dataset.team = t.team_id;
		input.dataset.action = 'rename';
		input.setAttribute('aria-label', 'Name of ' + t.name);
		name.append(input);

		const actions = document.createElement('td');
		const save = node('button', 'btn btn-secondary btn-sm', 'Rename');
		save.type = 'button';
		save.dataset.team = t.team_id;
		save.dataset.action = 'rename';
		const del = node('button', 'btn btn-danger btn-sm', 'Delete');
		del.type = 'button';
		del.dataset.team = t.team_id;
		del.dataset.action = 'delete-team';
		del.dataset.name = t.name;
		actions.append(save, del);

		tr.append(name, node('td', null, teamCount(t)),
			node('td', null, (t.captains || []).join(', ') || '—'), actions);
		return tr;
	}

	// "5 of 7", and the away players beside it: they are still on the team,
	// they just do not take up a place.
	function teamCount(t) {
		const away = t.players - t.active_players;
		return t.active_players + ' of ' + t.team_limit + (away > 0 ? ' (' + away + ' away)' : '');
	}

	function renderTeams() {
		els.teamTable.hidden = !teams.length;
		els.teamEmpty.hidden = !!teams.length;
		els.teamRows.replaceChildren(...teams.map(teamRow));

		const over = teams.filter((t) => t.active_players > t.team_limit);
		els.teamOver.hidden = !over.length;
		els.teamOver.textContent = over.length
			? 'Over the limit: ' + over.map((t) => t.name + ' (' + t.active_players + ' of ' + t.team_limit + ')').join(', ')
				+ '. They keep their players, but cannot add anyone or bring anyone back until they are under.'
			: '';
	}

	els.teamAdd.addEventListener('click', async () => {
		const name = (els.teamNew.value || '').trim();
		if (name.length < 2) {
			TDC.status(els.status, 'Give the team a name first.', '');
			els.teamNew.focus();
			return;
		}
		const done = await write('Adding ' + name, () =>
			supabaseClient.rpc('tdc_create_team', { p_league_season_id: seasonId, p_name: name }));
		if (done) { els.teamNew.value = ''; els.teamNew.focus(); }
	});

	els.teamNew.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') { e.preventDefault(); els.teamAdd.click(); }
	});

	els.teamRows.addEventListener('click', (e) => {
		const button = e.target.closest('button[data-action]');
		if (!button) return;
		const id = button.dataset.team;

		if (button.dataset.action === 'rename') {
			const input = els.teamRows.querySelector(`input[data-team="${id}"]`);
			const name = (input.value || '').trim();
			if (name.length < 2) { TDC.status(els.status, 'A team needs a name.', ''); return; }
			write('Saving', () => supabaseClient.rpc('tdc_update_team', { p_team_id: id, p_name: name }));
			return;
		}

		if (button.dataset.action === 'delete-team') {
			if (!confirm(`Delete ${button.dataset.name}?\n\nA team with players on it, or with matches played, cannot be deleted.`)) return;
			write('Deleting', () => supabaseClient.rpc('tdc_delete_team', { p_team_id: id }));
		}
	});

	// ─── Players ───
	async function loadPlayers() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_entrants', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		players = data || [];
		renderPlayers();
		return true;
	}

	function teamCell(p) {
		const select = document.createElement('select');
		select.append(new Option('No team', '', false, !p.team_id));
		for (const t of teams) {
			select.append(new Option(t.name, t.team_id, false, t.team_id === p.team_id));
		}
		select.dataset.entrant = p.entrant_id;
		select.dataset.action = 'team';
		select.style.minWidth = '9rem';
		select.setAttribute('aria-label', 'Team for ' + p.display_name);
		return select;
	}

	function checkbox(p, action, checked, label, disabled) {
		const box = document.createElement('input');
		box.type = 'checkbox';
		box.dataset.control = 'ring';   // a tick against a person, not a setting
		box.checked = !!checked;
		box.disabled = !!disabled;
		box.dataset.entrant = p.entrant_id;
		box.dataset.action = action;
		box.setAttribute('aria-label', label + ': ' + p.display_name);
		return box;
	}

	function playerRow(p) {
		const tr = document.createElement('tr');

		const who = document.createElement('td');
		who.append(node('span', null, p.display_name));
		const full = [p.first_name, p.last_name].filter(Boolean).join(' ');
		if (full && full !== p.display_name) who.append(node('span', 'sub', full));

		// Confirmation is the player's own act. There is no control here by
		// design: nothing on this page can confirm for somebody.
		const confirmed = node('td', null, '');
		if (p.status === 'withdrawn' || p.status === 'inactive' || p.status === 'suspended') {
			confirmed.append(node('span', 'sub', p.confirmed_at ? 'Confirmed ' + stamp(p.confirmed_at) : '—'));
		} else if (p.confirmed_at) {
			confirmed.append(node('span', 'badge verified', 'Confirmed'));
			confirmed.append(node('span', 'sub', stamp(p.confirmed_at)));
		} else {
			confirmed.append(node('span', 'badge needs-you', 'Waiting'));
		}

		const team = document.createElement('td');
		team.append(teamCell(p));

		const captain = document.createElement('td');
		captain.append(checkbox(p, 'captain', p.is_captain, 'Captain', !p.team_id));

		// Away is inactive: still in the league and on their team, not
		// pickable, not counted against the team's limit. The director's
		// change is not bound by the limit, so a team can end up over it.
		const away = document.createElement('td');
		away.append(checkbox(p, 'away', p.status === 'inactive', 'Away', p.status === 'withdrawn'));

		const paid = document.createElement('td');
		paid.append(checkbox(p, 'paid', !!p.paid_at, 'Paid', false));

		const actions = document.createElement('td');
		const remove = node('button', 'btn btn-danger btn-sm', 'Remove');
		remove.type = 'button';
		remove.dataset.entrant = p.entrant_id;
		remove.dataset.action = 'remove';
		remove.dataset.name = p.display_name;
		actions.append(remove);

		tr.append(who, confirmed, team, captain, away, paid, actions);
		return tr;
	}

	function renderPlayers() {
		// The table below the lists is about teams and payment, so it holds
		// the people who are actually in the league. The rest are in the
		// lists above, where the only question is which list they belong to.
		const inLeague = players.filter((p) => ['active', 'inactive', 'withdrawn'].includes(p.status));

		els.table.hidden = !inLeague.length;
		els.empty.hidden = !!inLeague.length;
		els.count.hidden = !players.length;
		const active = players.filter((p) => p.status === 'active').length;
		els.count.textContent = active === 1 ? '1 in the league' : active + ' in the league';

		els.rows.replaceChildren(...inLeague.map(playerRow));
		renderTransfer();
	}

	els.rows.addEventListener('change', (e) => {
		const control = e.target.closest('[data-action]');
		if (!control) return;
		const id = control.dataset.entrant;

		if (control.dataset.action === 'status') {
			write('Saving', () => supabaseClient.rpc('tdc_set_league_entrant', {
				p_entrant_id: id, p_status: control.value
			}));
		} else if (control.dataset.action === 'team') {
			write('Saving', () => supabaseClient.rpc('tdc_set_league_entrant', control.value
				? { p_entrant_id: id, p_team_id: control.value }
				: { p_entrant_id: id, p_clear_team: true }));
		} else if (control.dataset.action === 'captain') {
			write('Saving', () => supabaseClient.rpc('tdc_set_league_entrant', {
				p_entrant_id: id, p_is_captain: control.checked
			}));
		} else if (control.dataset.action === 'away') {
			write('Saving', () => supabaseClient.rpc('tdc_set_league_entrant', {
				p_entrant_id: id, p_status: control.checked ? 'inactive' : 'active'
			}));
		} else if (control.dataset.action === 'paid') {
			write('Saving', () => supabaseClient.rpc('tdc_set_league_entrant', {
				p_entrant_id: id, p_paid: control.checked
			}));
		}
	});

	els.rows.addEventListener('click', (e) => {
		const button = e.target.closest('[data-action="remove"]');
		if (!button) return;

		// Removing is not withdrawing: it takes the person out of the league's
		// record entirely, so it is worth one question.
		if (!confirm(`Take ${button.dataset.name} out of this league?\n\nTo keep them on the list but out of the league, set their status to Withdrawn instead.`)) return;

		write('Removing', () => supabaseClient.rpc('tdc_remove_league_entrant', {
			p_entrant_id: button.dataset.entrant
		}));
	});

	// ─── Search ───
	// Accounts only. The database function leaves walk-ins out, so what is
	// offered here is exactly what the add will accept.
	let searchRun = 0;
	async function search(term) {
		const run = ++searchRun;
		if (term.trim().length < 2) { els.results.replaceChildren(); return; }

		const { data, error } = await supabaseClient.rpc('tdc_search_league_players', {
			p_league_season_id: seasonId, p_query: term, p_limit: 20
		});
		if (run !== searchRun) return;   // a later keystroke has overtaken this one
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.results.replaceChildren(node('p', 'muted',
				'Nobody with an account by that name. A league player has to have signed up, so they can confirm their own place.'));
			return;
		}

		els.results.replaceChildren(...data.map((p) => {
			const b = node('button', 'result');
			b.type = 'button';
			b.append(node('span', 'result-name', p.display_name));

			const sub = [];
			if (p.full_name && p.full_name !== p.display_name) sub.push(p.full_name);
			if (p.entrant_status === 'withdrawn') sub.push('Withdrew — add back');
			else if (p.entrant_status === 'inactive') sub.push('Already in, inactive');
			else if (p.entrant_status) sub.push('Already in');
			if (sub.length) b.append(node('span', 'result-sub', sub.join(' · ')));

			// Somebody already in is shown so the director can see they are
			// there, rather than vanishing and reading as "not found". A
			// withdrawn player is the one exception: adding them back is the
			// way to bring them in again.
			const canAdd = !p.entrant_status || p.entrant_status === 'withdrawn';
			b.disabled = !canAdd;
			if (canAdd) b.addEventListener('click', () => addPlayer(p.id, p.display_name));
			return b;
		}));
	}

	let typingTimer = null;
	els.search.addEventListener('input', () => {
		clearTimeout(typingTimer);
		const term = els.search.value;
		typingTimer = setTimeout(() => search(term), 250);
	});

	async function addPlayer(playerId, name) {
		const done = await write('Adding ' + name, () =>
			supabaseClient.rpc('tdc_add_league_entrant', {
				p_league_season_id: seasonId,
				p_player_id: playerId
			}));
		if (done) {
			els.search.value = '';
			els.results.replaceChildren();
			els.search.focus();
		}
	}

	// ─── Who runs it ───
	// The director is created with the season and cannot be removed while they
	// are the only one. The role list comes from tbl_competition_role_types
	// rather than being written out here, because that table is a lookup with a
	// rank for exactly this reason.
	async function loadRoleTypes() {
		const { data, error } = await supabaseClient
			.from('tbl_competition_role_types')
			.select('key, name, rank')
			.order('rank', { ascending: false });

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		els.officialRole.replaceChildren(...(data || []).map((r) => {
			// The shared director role is a league director here.
			return new Option(r.key === 'director' ? 'League director' : r.name, r.key);
		}));
		const ref = (data || []).find((r) => r.key === 'referee');
		if (ref) els.officialRole.value = ref.key;
	}

	async function loadOfficials() {
		const { data, error } = await supabaseClient.rpc('tdc_league_officials', {
			p_league_season_id: seasonId
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
		const remove = node('button', 'btn btn-danger btn-sm', 'Remove');
		remove.type = 'button';
		remove.dataset.role = o.role_id;
		remove.dataset.name = o.display_name;
		remove.dataset.what = o.role_name;
		actions.append(remove);
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
			supabaseClient.rpc('tdc_remove_league_role', { p_role_id: button.dataset.role }));
	});

	let officialRun = 0;
	async function searchOfficials(term) {
		const run = ++officialRun;
		if (term.trim().length < 2) { els.officialResults.replaceChildren(); return; }

		const { data, error } = await supabaseClient.rpc('tdc_search_league_players', {
			p_league_season_id: seasonId, p_query: term, p_limit: 20
		});
		if (run !== officialRun) return;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.officialResults.replaceChildren(node('p', 'muted', 'Nobody with an account by that name.'));
			return;
		}

		els.officialResults.replaceChildren(...data.map((p) => {
			const b = node('button', 'result');
			b.type = 'button';
			b.append(node('span', 'result-name', p.display_name));

			const sub = [];
			if (p.full_name && p.full_name !== p.display_name) sub.push(p.full_name);
			const held = officials.filter((o) => o.player_id === p.id).map((o) => o.role_name);
			if (held.length) sub.push('Already ' + held.join(', ').toLowerCase());
			if (sub.length) b.append(node('span', 'result-sub', sub.join(' · ')));

			b.addEventListener('click', () => addOfficial(p.id, p.display_name));
			return b;
		}));
	}

	async function addOfficial(playerId, name) {
		const role = els.officialRole.value;
		const done = await write(`Adding ${name}`, () =>
			supabaseClient.rpc('tdc_add_league_role', {
				p_league_season_id: seasonId,
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

	// ─── Reading everything ───
	// Teams first: the player rows build their team menus from them.
	async function loadAll() {
		const results = [];
		results.push(await loadSeason());
		results.push(await loadTeams());
		results.push(await loadPlayers());
		results.push(await loadReadiness());
		results.push(await loadOfficials());
		return results.every(Boolean);
	}

	// ─── Writing ───
	// Every write goes through here: one at a time, everything read again
	// afterwards, and nothing swallowed quietly.
	async function write(what, fn, done) {
		if (busy) return false;
		busy = true;
		TDC.status(els.status, what + '…', '');

		const { data, error } = await fn();
		if (error) {
			// The screen still shows what the person just clicked, which is now
			// a lie. Re-reading puts it back to what the server actually holds,
			// and the error is put up after so the re-read cannot wipe it.
			await loadAll();
			busy = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return false;
		}

		const ok = await loadAll();
		busy = false;
		if (ok) TDC.status(els.status, done ? done(data) : '', done ? 'success' : '');

		// Adding a player writes a notification inside the database. It goes
		// out now rather than at the next page load. Not awaited: the person
		// is waiting on the list, not on somebody else's phone buzzing.
		TDC.flushPushes();
		return ok;
	}

	// ─── Start ───
	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the leagues list.', null, els.status);
			return;
		}

		els.seasonLink.href = '/leagues/season/?s=' + encodeURIComponent(seasonId);
		els.fixturesLink.href = '/leagues/fixtures/?s=' + encodeURIComponent(seasonId);
		els.settingsLink.href = '/leagues/settings/?s=' + encodeURIComponent(seasonId);

		const info = await loadInfo();
		if (!info) return;

		// Settled before anything is drawn, so the controls are never offered
		// and then taken away. tdc_may_run_league asks the same private helper
		// the writes ask, so the page and the database cannot disagree.
		const { data: mayRun, error } = await supabaseClient.rpc('tdc_may_run_league', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		// The director's list carries payment and private notes, so a player
		// would get an empty one — which would read as "nobody has been added".
		// They are sent to the season page instead, which is for them.
		if (!mayRun) {
			TDC.status(els.status, 'Taking you to the season — this page is for whoever is running it.', '');
			location.replace('/leagues/season/?s=' + encodeURIComponent(seasonId));
			return;
		}

		await loadRoleTypes();
		if (!await loadAll()) return;

		els.search.focus();
	})();
})();
