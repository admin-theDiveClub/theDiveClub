// A league's standings: the Standings tab of its one page
// (/leagues/season/?s=<league season id>&tab=standings; league-nav.js).
// UV, 29 Oct.
//
// Two views on a pill, kept per device:
//   • Individual Rankings: Rank | picture | Player | the player columns.
//   • Team Rankings: + / – | Rank | picture | Team | the team columns, each team
//     opening (its + / – button) onto its players in the Individual
//     columns, each with their rank in the whole league, in that order.
//     playerTable() draws both player tables.
//
// The counts are tdc_league_standings (every value, every player and team,
// from the frames of the season's signed nights); the columns are the
// season's rows of tbl_league_standing_columns, built by the league director
// on the Settings tab. TDCStandings (league-standings-def.js) works each
// column out from the counts and ranks the rows: never eval.
//
// Read when the tab is first opened (under the loading screen) and again
// each time it is shown, the numbers that changed fading (TDC.liveFade).
//
// Live (UV, 29 Oct; a switch, kept per device): on, tdc_league_standings
// also counts nights not yet signed by both (p_live), and the tab follows
// the season's matches as the fixtures page does: one realtime channel on
// tbl_matches (every frame written moves its card_version), the matches
// named by the function's watch_match_ids, read again 0.4 s after the last
// change. While another tab is showing it does not read; showing it again
// does. Off, nothing is watched.
//
// Needs: tdc.js, ring-status.js, league-standings-def.js, league-nav.js.

TDCLeagueNav.panel('standings', () => {
	const AREA = 'Standings';
	const S = TDCStandings;

	const el = (id) => document.getElementById(id);
	const els = {
		title: el('sd-title'), meta: el('sd-meta'), views: el('sd-views'), live: el('sd-live'), fullNames: el('sd-full-names'),
		player: el('sd-player'), team: el('sd-team'), status: el('sd-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the standings tab is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');

	// ─── State ───
	let info = null;
	let data = null;             // tdc_league_standings
	let columns = [];            // the season's columns, by position
	const openTeams = new Set(); // teams opened, kept through every re-read
	const VIEW_KEY = 'tdc.standings.view';
	let view = 'player';
	try { if (localStorage.getItem(VIEW_KEY) === 'team') view = 'team'; } catch (err) { /* private window: the default */ }
	const LIVE_KEY = 'tdc.standings.live';
	let live = false;
	try { live = localStorage.getItem(LIVE_KEY) === 'on'; } catch (err) { /* private window: off */ }
	els.live.checked = live;
	// Display name (the default) or full name (UV, 29 Oct), per device. A
	// player with no first or last name keeps their display name.
	const NAMES_KEY = 'tdc.standings.names';
	let fullNames = false;
	try { fullNames = localStorage.getItem(NAMES_KEY) === 'full'; } catch (err) { /* private window: display names */ }
	els.fullNames.checked = fullNames;
	const nameOf = (p) => (fullNames && p.full_name) || p.display_name;
	// The signed-in person's own rows glow yellow (UV, 29 Oct): their player
	// row wherever it is, and their team's row in Team Rankings.
	let myPlayerId = null;

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : n + ' ' + (many || one + 's'));
	const colsFor = (scope) => columns.filter((c) => c.scope === scope);

	// A player's picture, from the public player-avatars bucket, or their
	// initials in a circle (as on the Season tab).
	function avatar(path, name) {
		const box = node('span', 'person-pic');
		const url = TDC.pictureUrl('player-avatars', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		return box;
	}

	// "Ranked by Frames Won, then Win %."
	function rankedBy(cols) {
		const by = cols.filter((c) => c.rank_priority).sort((a, b) => a.rank_priority - b.rank_priority);
		if (!by.length) return 'Not ranked yet: the league director chooses what decides the order, on the Settings tab.';
		return 'Ranked by ' + by.map((c) => c.name + (c.higher_first ? '' : ' (lowest first)')).join(', then ') + '.';
	}

	// The head of a standings table: #, a picture, the name, the columns.
	// lead goes before them all: the team table's + / –, first so it is
	// never scrolled out of sight on a phone.
	function head(nameLabel, cols, lead) {
		const thead = node('thead');
		const tr = node('tr');
		const pic = node('th', 'sd-pic');
		pic.setAttribute('aria-label', 'Picture');
		if (lead) tr.append(lead);
		tr.append(node('th', 'num sd-rank', '#'), pic, node('th', 'sd-name', nameLabel));
		for (const c of cols) tr.append(node('th', 'num', c.name));
		thead.append(tr);
		return thead;
	}

	const rankText = (r) => (r.rank === null ? '–' : String(r.rank));

	// ─── The player table: Individual Rankings, and inside each team ───
	// Every player ranked across the whole league, once: Individual Rankings
	// shows them all, and a team shows its own players with these same ranks
	// (UV, 29 Oct: rank within the league; their order is then their order
	// within the team).
	function leagueRanked() {
		return S.rank((data.players || []).map((p) => Object.assign({ name: nameOf(p) }, p)), colsFor('player'));
	}

	// rows: players already ranked (leagueRanked, or a team's share of it).
	// key keeps each table's fading numbers apart (data-live is per page).
	function playerTable(rows, key) {
		const cols = colsFor('player');
		if (!rows.length) return node('div', 'empty', 'Nobody to show yet.');

		const table = node('table', 'tdc-table sd-table');
		table.dataset.key = key;
		table.append(head('Player', cols));
		const body = node('tbody');
		rows.forEach((r, i) => {
			const tr = node('tr', i % 2 ? 'sd-alt' : null);
			tr.dataset.key = r.player_id;
			if (myPlayerId && r.player_id === myPlayerId) tr.classList.add('sd-me');
			const rank = node('td', 'num sd-rank', rankText(r));
			rank.dataset.live = key + ':' + r.player_id + ':rank';
			const pic = node('td', 'sd-pic');
			pic.append(avatar(r.avatar_path, r.name));
			const name = node('td', 'sd-name');
			const a = node('a', null, r.name);
			a.href = '/players/?p=' + encodeURIComponent(r.player_id);
			name.append(a);
			tr.append(rank, pic, name);
			for (const c of cols) {
				const td = node('td', 'num', S.shown(r.values[c.id], c.decimals));
				td.dataset.live = key + ':' + r.player_id + ':' + c.id;
				tr.append(td);
			}
			body.append(tr);
		});
		table.append(body);
		const wrap = node('div', 'table-scroll sd-scroll');
		wrap.append(table);
		return wrap;
	}

	function renderPlayers() {
		const cols = colsFor('player');
		els.player.replaceChildren(
			playerTable(leagueRanked(), 'p'),
			node('p', 'muted sd-by', rankedBy(cols))
		);
	}

	// ─── Team Rankings ───
	// The + / – is a ring icon button like the fixtures page's (.fx-icon):
	// it draws itself in when it first appears, and swaps plus for minus.
	// The site's dots come to it when pressed, as to every button.
	const iconsSeen = new Set();
	function toggleButton(team, open) {
		const b = node('button', 'fx-icon sd-toggle');
		b.type = 'button';
		b.dataset.team = team.team_id;
		b.setAttribute('aria-expanded', open ? 'true' : 'false');
		const label = (open ? 'Close ' : 'Open ') + team.name;
		b.title = label;
		b.setAttribute('aria-label', label);
		const face = node('span', 'tdc-ring');
		face.innerHTML = TDCRing.svg();
		b.append(face);
		return b;
	}

	function wakeIcons(root) {
		for (const b of root.querySelectorAll('.sd-toggle:not([data-awake])')) {
			b.dataset.awake = 'yes';
			const icon = b.getAttribute('aria-expanded') === 'true' ? 'minus' : 'plus';
			const seen = iconsSeen.has(b.dataset.team);
			iconsSeen.add(b.dataset.team);
			try {
				b.tdcRing = new TDCRing.RingStatus(b.querySelector('.tdc-ring'), {
					icons: ['plus', 'minus'],
					labels: { plus: 'Open', minus: 'Close', empty: b.getAttribute('aria-label'), loading: 'Working' },
					initial: seen ? icon : 'empty'
				});
			} catch (err) {
				TDC.error(AREA, 'an icon could not be drawn.', err, els.status);
				continue;
			}
			if (!seen) b.tdcRing.drawTo(icon);
		}
	}

	function renderTeams() {
		const cols = colsFor('team');
		const teams = data.teams || [];
		if (!teams.length) {
			els.team.replaceChildren(node('div', 'empty', 'No teams yet. Whoever runs the league makes them.'));
			return;
		}
		const ranked = leagueRanked();
		const myTeamId = ((data.players || []).find((p) => p.player_id === myPlayerId) || {}).team_id || null;
		const rows = S.rank(teams.map((t) => Object.assign({}, t)), cols);
		const span = 3 + cols.length + 1;

		const table = node('table', 'tdc-table sd-table sd-teams');
		table.dataset.key = 't';
		const toggleHead = node('th', 'sd-toggle-cell');
		toggleHead.setAttribute('aria-label', 'Players');
		table.append(head('Team', cols, toggleHead));
		const body = node('tbody');
		rows.forEach((r, i) => {
			const open = openTeams.has(r.team_id);
			const tr = node('tr', 'sd-team-row' + (i % 2 ? ' sd-alt' : ''));
			tr.dataset.team = r.team_id;
			tr.dataset.key = r.team_id;
			if (myTeamId && r.team_id === myTeamId) tr.classList.add('sd-me');
			const rank = node('td', 'num sd-rank', rankText(r));
			rank.dataset.live = 't:' + r.team_id + ':rank';
			const pic = node('td', 'sd-pic');
			const tp = node('span', 'team-pic');
			tp.append(TDC.teamPic(r.picture_path));
			pic.append(tp);
			const tcell = node('td', 'sd-toggle-cell');
			tcell.append(toggleButton(r, open));
			tr.append(tcell, rank, pic, node('td', 'sd-name', r.name));
			for (const c of cols) {
				const td = node('td', 'num', S.shown(r.values[c.id], c.decimals));
				td.dataset.live = 't:' + r.team_id + ':' + c.id;
				tr.append(td);
			}

			const nested = node('tr', 'sd-nested');
			nested.dataset.team = r.team_id;
			nested.hidden = !open;
			const cell = node('td');
			cell.colSpan = span;
			cell.append(playerTable(ranked.filter((p) => p.team_id === r.team_id), 'tp:' + r.team_id));
			nested.append(cell);
			body.append(tr, nested);
		});
		table.append(body);
		const wrap = node('div', 'table-scroll sd-scroll');
		wrap.append(table);
		els.team.replaceChildren(wrap, node('p', 'muted sd-by', rankedBy(cols)));
		wakeIcons(els.team);
	}

	function toggleTeam(id) {
		const b = els.team.querySelector(`.sd-toggle[data-team="${CSS.escape(id)}"]`);
		const nested = els.team.querySelector(`.sd-nested[data-team="${CSS.escape(id)}"]`);
		if (!b || !nested) { TDC.error(AREA, 'that team is not on the page any more.', { id }, els.status); return; }
		const open = !openTeams.has(id);
		if (open) openTeams.add(id); else openTeams.delete(id);
		const name = els.team.querySelector(`.sd-team-row[data-team="${CSS.escape(id)}"] .sd-name`);
		const label = (open ? 'Close ' : 'Open ') + (name ? name.textContent : 'the team');
		b.setAttribute('aria-expanded', open ? 'true' : 'false');
		b.title = label;
		b.setAttribute('aria-label', label);
		if (b.tdcRing) b.tdcRing.drawTo(open ? 'minus' : 'plus');
		nested.hidden = !open;
		if (open) fadeIn(nested);
	}

	// Only the + / – opens a team: a tap elsewhere on its row highlights it
	// (below; UV, 29 Oct, which replaced "the whole row opens it").
	els.team.addEventListener('click', (e) => {
		const b = e.target.closest('.sd-toggle');
		if (b) toggleTeam(b.dataset.team);
	});

	// ─── Row and column highlight (UV, 29 Oct) ───
	// Hovering a cell (a mouse only) or tapping one lights its row and its
	// column with a green inner glow (league.css, .sd-hl-*). A tap pins it:
	// the same cell again clears it, another cell moves it. A hover shows
	// over a pinned one and the pinned one comes back when the pointer leaves
	// the table. Each table lights alone (a team's players are a table of
	// their own). Pinned by table, row and column, so it survives a redraw
	// (a live update, the names switch).
	let pinned = null;          // { table, row, col }
	const HL = ['sd-hl-row', 'sd-hl-col', 'sd-hl-top', 'sd-hl-bottom'];

	function clearLight() {
		for (const e of els.player.parentElement.querySelectorAll('.sd-hl-row, .sd-hl-col')) e.classList.remove(...HL);
	}

	// The cell a pointer or tap is on: a cell of a standings table, not the
	// cell holding a team's players.
	function cellOf(target) {
		const cell = target.closest('.sd-table td, .sd-table th');
		if (!cell || cell.parentElement.classList.contains('sd-nested')) return null;
		return cell;
	}

	function light(cell) {
		clearLight();
		if (!cell) return;
		const table = cell.closest('table');
		const col = cell.cellIndex;
		cell.parentElement.classList.add('sd-hl-row');
		const inCol = [...table.rows]
			.filter((r) => !r.classList.contains('sd-nested') && !r.hidden && r.cells[col])
			.map((r) => r.cells[col]);
		for (const c of inCol) c.classList.add('sd-hl-col');
		if (inCol.length) {
			inCol[0].classList.add('sd-hl-top');
			inCol[inCol.length - 1].classList.add('sd-hl-bottom');
		}
	}

	function pinnedCell() {
		if (!pinned) return null;
		const table = els.player.parentElement.querySelector(`table.sd-table[data-key="${CSS.escape(pinned.table)}"]`);
		if (!table) return null;
		const row = pinned.row === 'head'
			? table.tHead && table.tHead.rows[0]
			: [...table.tBodies[0].rows].find((r) => r.dataset.key === pinned.row);
		return (row && row.cells[pinned.col]) || null;
	}

	for (const box of [els.player, els.team]) {
		box.addEventListener('pointerover', (e) => {
			if (e.pointerType !== 'mouse') return;
			const cell = cellOf(e.target);
			if (cell) light(cell);
		});
		box.addEventListener('pointerleave', (e) => {
			if (e.pointerType === 'mouse') light(pinnedCell());
		});
		box.addEventListener('click', (e) => {
			// A link (a player's name) and the + / – keep their own jobs.
			if (e.target.closest('a, button')) return;
			const cell = cellOf(e.target);
			if (!cell) return;
			const row = cell.parentElement;
			const here = {
				table: cell.closest('table').dataset.key,
				row: row.parentElement.tagName === 'THEAD' ? 'head' : row.dataset.key,
				col: cell.cellIndex
			};
			if (pinned && pinned.table === here.table && pinned.row === here.row && pinned.col === here.col) {
				pinned = null;
				clearLight();
			} else {
				pinned = here;
				light(cell);
			}
		});
	}

	// ─── The views ───
	function fadeIn(box) {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--control-reveal')) || 0.35;
		box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: s * 1000, easing: 'ease-out' });
	}

	function showView(next, fade) {
		view = next;
		for (const b of els.views.querySelectorAll('[data-sd-view]')) {
			b.setAttribute('aria-pressed', b.dataset.sdView === view ? 'true' : 'false');
		}
		els.player.hidden = view !== 'player';
		els.team.hidden = view !== 'team';
		if (fade) fadeIn(view === 'player' ? els.player : els.team);
	}

	els.views.addEventListener('click', (e) => {
		const b = e.target.closest('[data-sd-view]');
		if (!b || b.dataset.sdView === view) return;
		showView(b.dataset.sdView, true);
		try { localStorage.setItem(VIEW_KEY, view); } catch (err) { /* kept for this visit only */ }
	});

	// ─── Reading ───
	function render(first) {
		const root = els.player.parentElement;
		const snap = first ? null : TDC.liveSnapshot(root);
		const n = data.matches_counted || 0;
		const unsigned = data.matches_unsigned || 0;
		if (live) {
			els.meta.textContent = !n
				? 'Live: nothing counted yet. A night counts from its first finished frame.'
				: !unsigned
					? 'Live: counted from ' + plural(n, 'signed night') + '. Nothing is being played right now.'
					: 'Live: counted from ' + plural(n - unsigned, 'signed night') + ' and ' + plural(unsigned, 'night') + ' not yet signed by both captains.';
		} else {
			els.meta.textContent = n
				? 'Counted from ' + plural(n, 'signed night') + '. A night counts once both captains have signed it.'
				: 'Nothing counted yet. A night counts once both captains have signed it.';
		}
		renderPlayers();
		renderTeams();
		if (pinned) light(pinnedCell());
		if (!first) TDC.liveFade(root, snap);
	}

	async function load(first) {
		const [inf, st, cols] = await Promise.all([
			supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId }),
			// p_live only when on: off is the call 20261029162031 made, so the
			// tab does not depend on 20261029194712 unless Live is used (UV hit
			// a deploy that went out before that push, 29 Oct).
			supabaseClient.rpc('tdc_league_standings', live
				? { p_league_season_id: seasonId, p_live: true }
				: { p_league_season_id: seasonId }),
			supabaseClient.from('tbl_league_standing_columns')
				.select('id, scope, position, name, equation, decimals, rank_priority, higher_first')
				.eq('league_season_id', seasonId).order('position')
		]);
		for (const r of [inf, st, cols]) {
			if (r.error) { TDC.showSupabaseError(AREA, r.error, els.status); return false; }
		}
		info = (inf.data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}
		if (!st.data || !Array.isArray(st.data.players) || !Array.isArray(st.data.teams)) {
			TDC.error(AREA, 'the standings came back in a shape this page does not know.', st.data, els.status);
			return false;
		}
		data = st.data;
		columns = cols.data || [];
		els.title.textContent = info.league_name + ' — Standings';
		render(first);
		if (live) watchLive(data.watch_match_ids || []); else stopLive();
		return true;
	}

	// ─── Live ───
	// As the fixtures page follows its night (league-fixtures.js, watchLive).
	let liveChannel = null;
	let liveKey = '';
	let liveSet = new Set();
	let liveTimer = null;
	const panelShown = () => !els.title.closest('.league-panel').hidden;

	// payload is null for a catch-up (shown again, back online).
	function onLive(payload) {
		if (!live || !data) return;
		if (payload && payload.new && !liveSet.has(payload.new.id)) return;
		clearTimeout(liveTimer);
		liveTimer = setTimeout(() => {
			// Another tab is showing: showing this one reads it anyway.
			if (!panelShown()) return;
			load(false).catch((err) => TDC.error(AREA, 'the live standings could not be read again.', err, els.status));
		}, 400);
	}

	function watchLive(ids) {
		const key = ids.slice().sort().join(',');
		if (key === liveKey && liveChannel) return;
		stopLive();
		liveKey = key;
		liveSet = new Set(ids);
		if (!ids.length) return;

		// A long filter may pass realtime's length limit; a big season drops
		// it and sorts on arrival instead.
		const filter = ids.length <= 20 ? { filter: 'id=in.(' + ids.join(',') + ')' } : {};
		liveChannel = supabaseClient
			.channel('standings:' + seasonId)
			.on('postgres_changes', Object.assign({ event: 'UPDATE', schema: 'public', table: 'tbl_matches' }, filter), onLive)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') return;
				// Not fatal: the tab still shows what it last read. Said, and the
				// tab says so too, rather than left to go stale unseen.
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					TDC.error(AREA, 'live updates are not running (' + status + '). Showing the tab again reads it again.', null, els.status);
				}
			});
	}

	function stopLive() {
		clearTimeout(liveTimer);
		liveKey = '';
		if (!liveChannel) return;
		supabaseClient.removeChannel(liveChannel);
		liveChannel = null;
	}

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') onLive(null);
	});
	window.addEventListener('online', () => onLive(null));

	// The switch reads the tables again at once, counted the new way; the
	// site's dots serve the switch for as long as that read takes.
	// Both names are already on the page: drawn again, nothing read.
	els.fullNames.addEventListener('change', () => {
		fullNames = els.fullNames.checked;
		try { localStorage.setItem(NAMES_KEY, fullNames ? 'full' : 'display'); } catch (err) { /* kept for this visit only */ }
		if (data) render(false);
	});

	els.live.addEventListener('change', () => {
		live = els.live.checked;
		try { localStorage.setItem(LIVE_KEY, live ? 'on' : 'off'); } catch (err) { /* kept for this visit only */ }
		if (!data) return;
		load(false).catch((err) => TDC.error(AREA, 'the standings could not be read again.', err, els.status));
	});

	// ─── Start ───
	showView(view, false);
	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the league.', null, els.status);
			return;
		}
		// For the yellow rows. A failure says so and the tables still draw.
		const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		myPlayerId = me ? me.id : null;
		await load(true);
	})(), 'Standings');

	return {
		refresh: () => {
			if (!data) return;
			load(false).catch((err) => TDC.error(AREA, 'the standings could not be read again.', err, els.status));
		}
	};
});
