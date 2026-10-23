// A league season, as a player sees it (/leagues/season/?s=<league season id>).
//
// Three jobs:
//   • Your place. Somebody who has been added to a league has to confirm that
//     they are playing; nobody can do it for them and the league cannot begin
//     until every active player has. This is where they do it, and where they
//     can say they are not playing after all.
//   • The league. Teams with their rosters, and who runs it.
//   • Your team, if you captain one. Claim a player who has confirmed and is on
//     no team, release one, name another captain, rename the team.
//
// A captain only ever controls the team they captain. Whether you may is not
// worked out here: the buttons are shown from what tdc_my_leagues says, and the
// database refuses the rest through private.tdc_can_control_team, the one place
// that question is answered. The director runs everything from the manage page.
//
// Everything is read with one call each and read again after every write.
//
// Needs: tdc.js.

(() => {
	const AREA = 'League season';

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('l-name'), meta: el('l-meta'),
		mePanel: el('me-panel'), meLine: el('me-line'), meDetail: el('me-detail'),
		meConfirm: el('me-confirm'), meWithdraw: el('me-withdraw'),
		readyPanel: el('ready-panel'), readyLine: el('ready-line'), readyDetail: el('ready-detail'),
		poolPanel: el('pool-panel'), poolHint: el('pool-hint'), poolList: el('pool-list'),
		teamCount: el('team-count'), teamList: el('team-list'), teamEmpty: el('team-empty'),
		officialList: el('official-list'),
		status: el('page-status'),
		manageLink: el('manage-link'), manageSep: el('manage-sep'),
		fixturesLink: el('fixtures-link'), meCard: el('me-card')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the season page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');

	// ─── State ───
	let info = null;
	let mine = null;            // my row from tdc_my_leagues, or null
	let teams = [];
	let rosters = new Map();    // team id -> roster rows, loaded when a team is opened
	const openTeams = new Set();
	let officials = [];
	let pool = [];
	let busy = false;           // one write at a time

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	function day(s) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a season: ' + s); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Whether this person may control their own team. Mirrors the database's
	// own rule (active, confirmed captain) only so the right buttons are shown;
	// it is not what protects anything.
	const controlsTeam = () => !!(mine && mine.i_captain && mine.my_team_id
		&& mine.my_status === 'active' && mine.confirmed_at);

	// ─── The season ───
	async function loadInfo() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_info', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		info = (data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}

		els.name.textContent = info.league_name + ' — ' + info.name;
		const bits = [];
		if (info.starts_on) bits.push('From ' + day(info.starts_on));
		if (info.ends_on) bits.push('to ' + day(info.ends_on));
		if (info.venue_name) bits.push(info.venue_name);
		els.meta.textContent = bits.join(' · ');

		els.manageLink.hidden = !info.i_run_it;
		els.manageSep.hidden = !info.i_run_it;
		if (info.i_run_it) els.manageLink.href = '/leagues/manage/?s=' + encodeURIComponent(seasonId);
		return true;
	}

	// ─── Your place ───
	async function loadMine() {
		const { data, error } = await supabaseClient.rpc('tdc_my_leagues', { p_limit: 200 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		mine = (data || []).find((l) => l.league_season_id === seasonId) || null;
		renderMine();
		return true;
	}

	// The next match this person's team is in, so a captain lands on the card
	// rather than hunting through the fixture list for it.
	async function loadMyNext() {
		els.meCard.hidden = true;
		if (!mine || !mine.my_team_id) return;

		const { data, error } = await supabaseClient.rpc('tdc_league_fixtures', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const ours = (data || []).filter((f) =>
			f.match_id && (f.home_team_id === mine.my_team_id || f.away_team_id === mine.my_team_id));
		if (!ours.length) return;

		// The first one not yet finished, or the most recent if they all are.
		const next = ours.find((f) => f.match_status !== 'complete') || ours[ours.length - 1];
		els.meCard.href = '/leagues/card/?m=' + encodeURIComponent(next.match_id);
		els.meCard.textContent = mine.i_captain ? 'Set my lineup' : 'My next match';
		els.meCard.hidden = false;
	}

	function renderMine() {
		// Somebody who only runs the season, and plays nowhere in it, has no
		// place to show. They have the manage page.
		const plays = mine && mine.my_status;
		els.mePanel.hidden = !plays;
		if (!plays) return;

		els.meConfirm.hidden = true;
		els.meWithdraw.hidden = true;

		if (mine.my_status === 'withdrawn') {
			els.meLine.textContent = 'You withdrew from this league.';
			els.meDetail.textContent = 'Whoever runs the league can add you back if you change your mind.';
		} else if (mine.my_status === 'inactive') {
			els.meLine.textContent = 'You are marked inactive in this league.';
			els.meDetail.textContent = 'Ask whoever runs the league to make you active again.';
		} else if (!mine.confirmed_at) {
			els.meLine.textContent = 'You have been added to this league. Are you playing?';
			els.meDetail.textContent = 'The league cannot begin until every player has confirmed. Confirming also lets a team captain claim you.';
			els.meConfirm.hidden = false;
			els.meWithdraw.hidden = false;
		} else if (!mine.my_team_name) {
			els.meLine.textContent = 'You are confirmed.';
			els.meDetail.textContent = 'You are not on a team yet. A captain can claim you, or whoever runs the league can place you.';
			els.meWithdraw.hidden = false;
		} else {
			els.meLine.textContent = 'You are playing for ' + mine.my_team_name
				+ (mine.confirmed_at ? ', and you have confirmed.' : '. You have not confirmed yet.');
			els.meDetail.textContent = controlsTeam() ? 'You are a captain of this team.' : '';
			els.meWithdraw.hidden = false;
		}
	}

	els.meConfirm.addEventListener('click', () =>
		write('Confirming', () => supabaseClient.rpc('tdc_confirm_league_entry', {
			p_league_season_id: seasonId
		})));

	// Taking your confirmation back, not leaving the league. It clears the
	// confirmation and nothing else — the place, the team, the captaincy and
	// the payment all stay, and payment was never a player's to change.
	// Leaving the league altogether is the director's to do.
	els.meWithdraw.addEventListener('click', () => {
		if (!confirm('Say you are not playing?\n\nYour place and your team stay as they are — you just have not confirmed. You can confirm again whenever you like.')) return;
		write('Saving', () => supabaseClient.rpc('tdc_unconfirm_league_entry', {
			p_league_season_id: seasonId
		}));
	});

	// ─── Readiness ───
	// The function answers only the people running the league and its captains.
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
		els.readyDetail.textContent = detail.join(' ');
		return true;
	}

	// ─── Waiting for a team ───
	async function loadPool() {
		// Only a captain can claim, so only a captain asks. The function would
		// also answer the director, but they have the manage page.
		if (!controlsTeam()) {
			pool = [];
			renderPool();
			return true;
		}
		const { data, error } = await supabaseClient.rpc('tdc_league_unplaced', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		pool = data || [];
		renderPool();
		return true;
	}

	function renderPool() {
		els.poolPanel.hidden = !controlsTeam();
		if (els.poolPanel.hidden) return;

		els.poolHint.textContent = pool.length
			? 'These players have confirmed and are on no team. Claiming one puts them on ' + mine.my_team_name + '.'
			: 'Nobody is waiting. A player appears here once they have confirmed their place and are on no team.';

		els.poolList.replaceChildren(...pool.map((p) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(node('span', null, p.display_name));

			const actions = node('div', 'list-row-actions');
			const claim = node('button', 'btn btn-primary btn-sm', 'Claim');
			claim.type = 'button';
			claim.dataset.player = p.player_id;
			claim.dataset.action = 'claim';
			claim.dataset.name = p.display_name;
			actions.append(claim);

			row.append(main, actions);
			return row;
		}));
	}

	els.poolList.addEventListener('click', (e) => {
		const button = e.target.closest('[data-action="claim"]');
		if (!button) return;
		write('Claiming ' + button.dataset.name, () => supabaseClient.rpc('tdc_team_claim_player', {
			p_team_id: mine.my_team_id, p_player_id: button.dataset.player
		}));
	});

	// ─── Teams ───
	async function loadTeams() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_teams', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		teams = data || [];

		// My own team is open from the start; it is the one they came for.
		if (mine && mine.my_team_id) openTeams.add(mine.my_team_id);
		// A team that has gone (deleted while this page was open) is not open.
		for (const id of [...openTeams]) {
			if (!teams.some((t) => t.team_id === id)) openTeams.delete(id);
		}

		// Rosters are read for every open team, again, after every write.
		const fresh = new Map();
		for (const id of openTeams) {
			const { data: roster, error: rosterError } = await supabaseClient.rpc('tdc_team_roster', { p_team_id: id });
			if (rosterError) { TDC.showSupabaseError(AREA, rosterError, els.status); return false; }
			fresh.set(id, roster || []);
		}
		rosters = fresh;
		renderTeams();
		return true;
	}

	function rosterRow(t, r) {
		const row = node('div', 'list-row');
		const main = node('div', 'list-row-main');
		main.append(node('span', null, r.display_name));

		const sub = [];
		if (r.is_captain) sub.push('Captain');
		if (r.status !== 'active') sub.push(r.status === 'withdrawn' ? 'Withdrawn' : 'Inactive');
		else if (!r.confirmed) sub.push('Has not confirmed');
		if (sub.length) main.append(node('span', 'sub', sub.join(' · ')));
		row.append(main);

		// Captain controls, on my own team only.
		if (controlsTeam() && t.team_id === mine.my_team_id) {
			const actions = node('div', 'list-row-actions');

			const cap = node('button', 'btn btn-secondary btn-sm', r.is_captain ? 'Not captain' : 'Make captain');
			cap.type = 'button';
			cap.dataset.action = 'captain';
			cap.dataset.player = r.player_id;
			cap.dataset.captain = r.is_captain ? '0' : '1';
			// Naming a captain needs someone active who has confirmed; the
			// database says so too, this only spares a pointless click.
			cap.disabled = !r.is_captain && (r.status !== 'active' || !r.confirmed);

			const rel = node('button', 'btn btn-danger btn-sm', 'Release');
			rel.type = 'button';
			rel.dataset.action = 'release';
			rel.dataset.player = r.player_id;
			rel.dataset.name = r.display_name;

			actions.append(cap, rel);
			row.append(actions);
		}
		return row;
	}

	function teamCard(t) {
		const box = document.createElement('details');
		box.className = 'set-group';
		box.dataset.team = t.team_id;
		box.open = openTeams.has(t.team_id);

		const head = document.createElement('summary');
		head.textContent = t.name + ' · ' + (t.players === 1 ? '1 player' : t.players + ' players');
		box.append(head);

		const roster = rosters.get(t.team_id);
		if (!roster) {
			box.append(node('p', 'muted', 'Open to see the players.'));
		} else {
			if (controlsTeam() && t.team_id === mine.my_team_id) {
				const field = node('div', 'field');
				const label = node('label', null, 'Team name');
				label.htmlFor = 'rename-input';
				const input = document.createElement('input');
				input.type = 'text';
				input.id = 'rename-input';
				input.maxLength = 120;
				input.value = t.name;
				const save = node('button', 'btn btn-secondary btn-sm', 'Rename');
				save.type = 'button';
				save.dataset.action = 'rename';
				field.append(label, input, save);
				box.append(field);
			}

			if (!roster.length) box.append(node('p', 'muted', 'Nobody is on this team yet.'));
			else box.append(...roster.map((r) => rosterRow(t, r)));
		}

		box.addEventListener('toggle', async () => {
			if (box.open) {
				openTeams.add(t.team_id);
				// First time opened: fetch the players, then draw.
				if (!rosters.has(t.team_id)) {
					const { data, error } = await supabaseClient.rpc('tdc_team_roster', { p_team_id: t.team_id });
					if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
					rosters.set(t.team_id, data || []);
					renderTeams();
				}
			} else {
				openTeams.delete(t.team_id);
			}
		});
		return box;
	}

	function renderTeams() {
		els.teamCount.hidden = !teams.length;
		els.teamCount.textContent = String(teams.length);
		els.teamEmpty.hidden = !!teams.length;
		els.teamList.replaceChildren(...teams.map(teamCard));
	}

	els.teamList.addEventListener('click', (e) => {
		const button = e.target.closest('button[data-action]');
		if (!button || !mine || !mine.my_team_id) return;
		const teamId = mine.my_team_id;

		if (button.dataset.action === 'captain') {
			write('Saving', () => supabaseClient.rpc('tdc_team_set_captain', {
				p_team_id: teamId,
				p_player_id: button.dataset.player,
				p_is_captain: button.dataset.captain === '1'
			}));
		} else if (button.dataset.action === 'release') {
			if (!confirm(`Take ${button.dataset.name} off your team?\n\nThey go back to waiting for a team, and any captain can claim them.`)) return;
			write('Releasing', () => supabaseClient.rpc('tdc_team_release_player', {
				p_team_id: teamId, p_player_id: button.dataset.player
			}));
		} else if (button.dataset.action === 'rename') {
			const input = els.teamList.querySelector('#rename-input');
			const name = (input.value || '').trim();
			if (name.length < 2) { TDC.status(els.status, 'A team needs a name.', ''); return; }
			write('Saving', () => supabaseClient.rpc('tdc_update_team', { p_team_id: teamId, p_name: name }));
		}
	});

	// ─── Who runs it ───
	async function loadOfficials() {
		const { data, error } = await supabaseClient.rpc('tdc_league_officials', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		officials = data || [];

		els.officialList.replaceChildren(...officials.map((o) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(node('span', null, o.display_name), node('span', 'sub', o.role_name));
			row.append(main);
			return row;
		}));
		if (!officials.length) els.officialList.replaceChildren(node('p', 'muted', 'Nobody is listed.'));
		return true;
	}

	// ─── Reading everything ───
	// My row first: what the rest shows depends on whether I captain a team.
	async function loadAll() {
		const results = [];
		results.push(await loadMine());
		results.push(await loadTeams());
		results.push(await loadPool());
		results.push(await loadReadiness());
		results.push(await loadOfficials());
		await loadMyNext();
		return results.every(Boolean);
	}

	// ─── Writing ───
	async function write(what, fn) {
		if (busy) return false;
		busy = true;
		TDC.status(els.status, what + '…', '');

		const { error } = await fn();
		if (error) {
			// Put the screen back to what the server holds, then say why.
			await loadAll();
			busy = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return false;
		}

		const ok = await loadAll();
		busy = false;
		if (ok) TDC.status(els.status, '', '');
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

		els.fixturesLink.href = '/leagues/fixtures/?s=' + encodeURIComponent(seasonId);

		if (!await loadInfo()) return;
		await loadAll();
	})();
})();
