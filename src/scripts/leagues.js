// Leagues (/leagues/). The way into a league.
//
// One call to tdc_my_leagues gives the list: the league seasons this account
// runs and the ones it is entered in, newest first. A season you run opens the
// management page; a season you play in opens the season page.
//
// A player who has been added but has not confirmed yet is the one thing on
// this list that needs them, so it says so in the row's badges.
//
// Below it, the search for leagues to join: tdc_search_leagues, filtered in
// the database by discipline, status and team or singles, shown as a row of
// tiles that scrolls sideways.
//
// Needs: tdc.js, match-settings.js (discipline and status names).

(() => {
	const AREA = 'Leagues';

	const els = {
		openList: document.getElementById('open-list'),
		search: document.getElementById('league-search'),
		list: document.getElementById('league-list'),
		status: document.getElementById('list-status'),
		discipline: document.getElementById('filter-discipline'),
		leagueStatus: document.getElementById('filter-status'),
		kind: document.getElementById('filter-kind'),
		intro: document.getElementById('intro')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the leagues page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const el = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// A season's dates are plain dates with no time of day.
	function day(s) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a league: ' + s); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// The columns after the badges. On a PC they line up under a header row;
	// on a phone each cell carries its own label, in a strip under the name.
	const COLUMNS = ['Starts', 'Ends', 'Ranking', 'Teams'];

	function stat(label, value, sub) {
		const c = el('div', 'row-table-stat');
		c.append(el('span', 'row-table-label', label), el('span', null, value));
		if (sub) c.append(el('span', 'sub', sub));
		return c;
	}

	function header() {
		const h = el('div', 'row-table-head');
		h.setAttribute('aria-hidden', 'true');
		h.append(el('span'), el('span', null, 'League'), el('span'), ...COLUMNS.map((c) => el('span', null, c)));
		return h;
	}


	// The names the database's keys stand for. An unknown one is said, then
	// shown as it is, rather than dropped.
	function said(list, key, what) {
		if (!key) return '';
		if (list[key]) return list[key];
		TDC.error(AREA, `unknown ${what} on a league: ${key}`);
		return key;
	}
	const disciplineSaid = (k) => said(TDCMatchDef.DISCIPLINE, k, 'discipline');
	const statusSaid = (k) => said(TDCMatchDef.LEAGUE_STATUS, k, 'status');

	// One row per league season: the league's picture, its name as a heading,
	// its status and format under it, every badge in a column of its own, then the dates
	// and counts. The strip down the left is the status's colour.
	function row(l) {
		const box = document.createElement('a');
		box.className = 'row-table-row league-status-' + l.status;
		const needsYou = l.my_status === 'active' && !l.confirmed_at;
		box.href = (l.i_run_it ? '/leagues/manage/?s=' : '/leagues/season/?s=')
			+ encodeURIComponent(l.league_season_id);

		const bits = [statusSaid(l.status), l.name];
		if (l.season_name && l.season_name !== l.name) bits.push(l.season_name);
		if (l.discipline) bits.push(disciplineSaid(l.discipline));
		if (l.team_size) bits.push('Teams of ' + l.team_size);
		if (l.venue_name) bits.push(l.venue_name);

		const main = el('div', 'row-table-main');
		main.append(el('h3', null, l.league_name), el('div', 'row-table-meta', bits.join(' · ')));

		const strip = el('span', 'row-table-strip');
		strip.setAttribute('aria-hidden', 'true');

		// The league's picture: the default icon until leagues have their own
		// (to be set on the league's settings; docs/STATUS.md).
		const pic = el('div', 'row-table-pic');
		pic.append(leagueIcon(l.league_season_id));

		// Ranking waits for standings (docs/design/leagues.md §6).
		const stats = el('div', 'row-table-stats');
		stats.append(
			stat('Starts', l.starts_on ? day(l.starts_on) : '—'),
			stat('Ends', l.ends_on ? day(l.ends_on) : '—'),
			stat('Ranking', '—'),
			stat('Teams', l.team_count === 1 ? '1 team' : l.team_count + ' teams',
				l.player_count === 1 ? '1 player' : l.player_count + ' players'));

		const tags = el('div', 'row-table-badges');
		if (needsYou) tags.append(el('span', 'badge needs-you', 'Confirm your place'));
		if (l.my_status === 'withdrawn') tags.append(el('span', 'badge pending', 'You withdrew'));
		if (l.my_status === 'inactive') tags.append(el('span', 'badge pending', 'Inactive'));
		if (l.my_team_name) tags.append(el('span', 'badge', l.my_team_name));
		if (l.i_captain && l.my_status === 'active' && l.confirmed_at) tags.append(el('span', 'badge live', 'Captain'));
		if (l.i_run_it) tags.append(el('span', 'badge live', 'You run this'));

		box.append(strip, pic, main, tags, stats);
		return box;
	}

	// ─── Search for a League ───
	// A separate list from the one above: listed seasons a player can get into,
	// whatever their status. The filters are applied by tdc_search_leagues.
	const STATUS_SAID = {
		interested: 'Your name is down',
		active: 'You are in this one',
		withdrawn: 'You withdrew',
		inactive: 'Inactive',
		suspended: 'Suspended'
	};

	// A league's own picture (set on its settings, migration 20261024202149),
	// or a trophy in the brand colour for a league that has none.
	let pictures = new Map();   // league season id -> picture address
	function leagueIcon(seasonId) {
		const url = pictures.get(seasonId);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			return img;
		}
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = document.createElementNS(NS, 'path');
		path.setAttribute('fill', 'currentColor');
		path.setAttribute('d', 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z');
		svg.append(path);
		return svg;
	}

	// A result as a tile: the picture, the name, the details, and how this
	// person stands with it. The top edge is the status's colour.
	function tile(l) {
		const box = document.createElement('a');
		box.className = 'league-tile league-status-' + l.status;
		box.href = '/leagues/join/?s=' + encodeURIComponent(l.league_season_id);

		const pic = el('div', 'league-tile-pic');
		pic.append(leagueIcon(l.league_season_id));
		box.append(pic, el('div', 'league-tile-name', l.league_name));

		// Three short lines: the format, when and where, and where it stands.
		const format = [disciplineSaid(l.discipline)];
		if (l.team_size === 1) format.push('Singles');
		else if (l.team_size) format.push('Teams of ' + l.team_size);
		const when = [l.season_name];
		if (l.starts_on) when.push('From ' + day(l.starts_on));
		if (l.venue_name) when.push(l.venue_name);
		const stands = [statusSaid(l.status), l.players === 1 ? '1 player' : l.players + ' players'];
		for (const line of [format, when, stands]) {
			box.append(el('div', 'league-tile-meta', line.filter(Boolean).join(' · ')));
		}

		if (l.my_status) box.append(el('span', 'badge pending', STATUS_SAID[l.my_status] || l.my_status));
		else if (l.entry_mode === 'self_confirm') box.append(el('span', 'badge needs-you', 'Join straight away'));
		else box.append(el('span', 'badge', 'Taking names'));
		return box;
	}

	function fillMenu(select, list) {
		select.append(...Object.entries(list).map(([value, text]) => {
			const o = el('option', null, text);
			o.value = value;
			return o;
		}));
	}
	fillMenu(els.discipline, TDCMatchDef.DISCIPLINE);
	fillMenu(els.leagueStatus, TDCMatchDef.LEAGUE_STATUS);

	let searchRun = 0;
	async function searchOpen() {
		const run = ++searchRun;
		const term = els.search.value.trim();
		const filtered = els.discipline.value || els.leagueStatus.value || els.kind.value;
		const { data, error } = await supabaseClient.rpc('tdc_search_leagues', {
			p_query: term || null,
			p_limit: 25,
			p_discipline: els.discipline.value || null,
			p_status: els.leagueStatus.value || null,
			p_kind: els.kind.value || null
		});
		if (run !== searchRun) return;   // a later keystroke has overtaken this one
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const empty = !data || !data.length;
		els.openList.classList.toggle('is-empty', empty);
		if (empty) {
			let why = 'No league is taking players at the moment.';
			if (els.kind.value === 'singles') why = 'There are no singles leagues yet.';
			else if (term || filtered) why = 'No league taking players matches that.';
			els.openList.replaceChildren(el('p', 'muted', why));
			return;
		}
		await loadPictures(data);
		if (run !== searchRun) return;
		els.openList.replaceChildren(...data.map(tile));
	}

	// The pictures of the leagues these seasons belong to, in one read: the
	// season's league, embedded. Added to what is already known, so the list
	// and the search share them.
	async function loadPictures(rows) {
		const ids = rows.map((r) => r.league_season_id).filter((id) => !pictures.has(id));
		if (!ids.length) return;
		const { data, error } = await supabaseClient
			.from('tbl_league_seasons').select('id, tbl_leagues(picture_path)').in('id', ids);
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		for (const r of data || []) {
			const path = r.tbl_leagues && r.tbl_leagues.picture_path;
			pictures.set(r.id, TDC.pictureUrl('league-pictures', path));
		}
	}

	let typingTimer = null;
	els.search.addEventListener('input', () => {
		clearTimeout(typingTimer);
		typingTimer = setTimeout(searchOpen, 250);
	});
	for (const menu of [els.discipline, els.leagueStatus, els.kind]) menu.addEventListener('change', searchOpen);

	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		await searchOpen();

		const { data, error } = await supabaseClient.rpc('tdc_my_leagues', { p_limit: 50 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.intro.textContent = 'You are not in a league yet. Create one below, or ask whoever runs yours to add you. You will be told when they do.';
			return;
		}

		await loadPictures(data);
		els.list.replaceChildren(header(), ...data.map(row));
		els.intro.textContent = data.length === 1
			? 'One league season.'
			: `${data.length} league seasons, newest first.`;
	})();
})();
