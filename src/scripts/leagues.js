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
// Needs: tdc.js, match-settings.js (discipline and status names),
// league-standings-def.js (the ranking).

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

	// A card per league season (UV, 9 Nov): the shield beside the names and the
	// dates; the badges and the sunken pill of the league's details; this
	// person's stats in boxes. The strip down the left is the status's colour.
	function shortDay(s, noYear) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a league: ' + s); return ''; }
		return d.toLocaleDateString([], noYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: '2-digit' });
	}
	function dates(l) {
		const b = shortDay(l.ends_on);
		// One year is said once.
		const a = shortDay(l.starts_on, b && l.starts_on && l.starts_on.slice(0, 4) === l.ends_on.slice(0, 4));
		if (a && b) return a + ' – ' + b;
		if (a) return 'From ' + a;
		return b ? 'Until ' + b : '';
	}

	function ordinal(n) {
		const tens = n % 100;
		if (tens >= 11 && tens <= 13) return n + 'th';
		return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
	}

	// Every rule the season has in use, from the one list of settings: a switch
	// that is on, a number that is not 0, a choice as chosen. What its parent
	// switch makes irrelevant is left out, as on the settings page. The game and
	// the team size are details already; the rotation is a grid. [label, value].
	const NOT_A_LINE = ['discipline', 'team_size', 'rotation', 'win_condition_target'];
	function rulesInUse(rules) {
		const out = [];
		for (const s of TDCMatchDef.SETTINGS) {
			if (s.scope !== 'rules' || NOT_A_LINE.includes(s.key) || (s.when && !s.when(rules))) continue;
			const v = rules[s.key];
			if (s.key === 'win_condition_type') {
				const how = said(s.options(), v, 'win condition');
				if (how) out.push(['', v === 'free_play' ? how : how + ' ' + rules.win_condition_target]);
			} else if (s.type === 'bool') { if (v) out.push(['', s.label]); }
			else if (s.type === 'int') { if (v) out.push([s.label, String(v)]); }
			else if (s.type === 'select' && v) out.push([s.label, said(s.options(), v, s.label)]);
		}
		return out;
	}

	// What the pill says: the league's details, then its rules. [label, value].
	function detailsFor(l) {
		const out = [];
		out.push(['', statusSaid(l.status)]);
		if (l.season_name && l.season_name !== l.name) out.push(['', l.season_name]);
		if (l.discipline) out.push(['', disciplineSaid(l.discipline)]);
		if (l.team_size) out.push(['', 'Teams of ' + l.team_size]);
		out.push(['', l.team_count === 1 ? '1 team' : l.team_count + ' teams']);
		out.push(['', l.player_count === 1 ? '1 player' : l.player_count + ' players']);
		out.push(...rulesInUse(seasonRules.get(l.league_season_id) || {}));
		return out;
	}

	// What drifts when it does not fit: fitPills() below finds these.
	function drifter(cls, run) {
		const track = el('div', 'lc-track');
		track.append(run);
		const windowEl = el('div', 'lc-window');
		windowEl.append(track);
		const box = el('div', cls);
		box.append(windowEl);
		return box;
	}

	// Under the pill, for somebody playing in the season: their place, their
	// team's, and the special wins and lags the season's rules count, each
	// only if it is on, as the scorecard offers them.
	function statBoxes(l) {
		const r = ranks.get(l.league_season_id);
		if (!r) return null;
		const out = el('div', 'lc-stats');
		const box = (cells, cls) => {
			const run = el('div', 'lc-run');
			for (const [head, value, valueCls] of cells) {
				const cell = el('div', 'lc-cell');
				cell.append(el('span', null, head), el('b', valueCls, value));
				run.append(cell);
			}
			out.append(drifter('lc-pill lc-stat' + (cls ? ' ' + cls : ''), run));
		};
		const place = (head, hit, of) => (r.counted && hit
			? [head, ordinal(hit.rank) + ' / ' + of, 'lc-rank']
			: [head, 'Not yet']);
		box([place('Rank', r.player, r.playerCount)]);
		if (l.my_team_id) box([place('Team Rank', r.team, r.teamCount)]);
		const rules = seasonRules.get(l.league_season_id) || {};
		const count = (key) => String((r.stats && r.stats[key]) || 0);
		const bf = rules.track_breaks && rules.break_finish_enabled;
		const specials = [
			bf && ['BF', count('break_and_finish')],
			rules.track_breaks && rules.reverse_break_finish_enabled && ['rBF', count('reverse_break_and_finish')],
			bf && rules.golden_break_enabled && ['GB', count('golden_break')],
			rules.track_breaks && ['Lags', count('lags_won')]
		].filter(Boolean);
		if (specials.length) box(specials, 'lc-counts');
		return out;
	}

	function card(l) {
		const box = document.createElement('a');
		box.className = 'lc league-status-' + l.status;
		const needsYou = l.my_status === 'active' && !l.confirmed_at;
		box.href = '/leagues/season/?s='
			+ encodeURIComponent(l.league_season_id)
			+ (l.i_run_it ? '&tab=manage' : '');

		const pic = el('div', 'lc-pic');
		pic.append(TDC.leaguePic(pictures.get(l.league_season_id)));

		const names = el('div', 'lc-names');
		names.append(el('h3', null, l.league_name));
		if (l.name && l.name !== l.league_name) names.append(el('span', 'lc-sub', l.name));
		if (l.venues.length) names.append(el('span', 'lc-sub lc-venue', TDC.venueNames(l.venues)));

		const text = el('div', 'lc-text');
		text.append(names);
		const when = dates(l);
		if (when) text.append(el('div', 'lc-dates', when));
		const top = el('div', 'lc-top');
		top.append(pic, text);

		const tags = el('div', 'lc-badges');
		if (needsYou) tags.append(el('span', 'badge needs-you', 'Confirm your place'));
		if (l.my_status === 'withdrawn') tags.append(el('span', 'badge pending', 'You withdrew'));
		if (l.my_status === 'inactive') tags.append(el('span', 'badge pending', 'Inactive'));
		if (l.my_team_name) tags.append(el('span', 'badge team-name', l.my_team_name));
		if (l.i_captain && l.my_status === 'active' && l.confirmed_at) tags.append(el('span', 'badge live', 'Captain'));
		if (l.i_run_it) tags.append(el('span', 'badge live', 'You run this'));

		const run = el('div', 'lc-run');
		for (const [label, value] of detailsFor(l)) {
			const item = el('span');
			if (label) item.append(label + ' ');
			item.append(el('b', null, value));
			run.append(item);
		}
		const pill = drifter('lc-pill', run);

		const foot = el('div', 'lc-foot');
		if (tags.children.length) foot.append(tags);
		foot.append(pill);

		box.append(top, foot);
		const stats = statBoxes(l);
		if (stats) box.append(stats);
		return box;
	}

	// ─── The pill's drift ───
	// The details pill, the stat boxes and a search tile's lines. Only when
	// what is in it does not fit: a second copy goes after the first and
	// the track slides by one copy, over and over, at a walking pace. A finger
	// or the mouse drags a pill or box, and it drifts on from where it is let
	// go; a tile's lines are left to the swipe that moves the tiles. The
	// page's idle stops them all after 30 s, as the light rests. With less
	// motion nothing drifts and dragging is the only way along it.
	const DRIFT_SPEED = 24;   // px a second
	const REST = 30000;
	const lessMotion = () => {
		const set = document.documentElement.dataset.motion;
		return set === 'reduce' || (set !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
	};
	// All of them back to one copy first, then all measured, then the ones that
	// do not fit changed: a box's second copy would otherwise squeeze the boxes
	// beside it. A box that drifts keeps the width it was measured at.
	function fitPills(root) {
		const pills = [...(root || els.list).querySelectorAll('.lc-pill, .lt-line')].map((pill) => {
			const track = pill.querySelector('.lc-track');
			const run = track.firstElementChild;
			while (run.nextSibling) run.nextSibling.remove();
			pill.classList.remove('is-drifting', 'is-swiped');
			pill.style.flex = '';
			return { pill, track, run };
		});
		for (const p of pills) {
			p.width = p.pill.getBoundingClientRect().width;
			p.overflows = p.run.getBoundingClientRect().width > p.pill.querySelector('.lc-window').getBoundingClientRect().width + 1;
		}
		for (const { pill, track, run, width, overflows } of pills) {
			if (!overflows) continue;
			if (pill.classList.contains('lc-stat')) pill.style.flex = '0 0 ' + width + 'px';
			if (lessMotion()) { pill.classList.add('is-swiped'); continue; }
			const copy = run.cloneNode(true);
			copy.setAttribute('aria-hidden', 'true');
			track.append(copy);
			pill.classList.add('is-drifting');
			track.style.setProperty('--lc-drift', (run.getBoundingClientRect().width / DRIFT_SPEED) + 's');
		}
	}
	let restTimer = null;
	function woken() {
		const lists = [els.list, els.openList];
		lists.forEach((l) => l.classList.remove('is-resting'));
		clearTimeout(restTimer);
		restTimer = setTimeout(() => lists.forEach((l) => l.classList.add('is-resting')), REST);
	}
	for (const type of ['pointerdown', 'keydown', 'wheel', 'scroll']) addEventListener(type, woken, { passive: true });
	// The drift is the browser's own animation, so a drag moves its clock.
	let drag = null;
	let dragged = false;
	els.list.addEventListener('pointerdown', (e) => {
		dragged = false;
		const pill = e.target.closest('.lc-pill');
		if (!pill) return;
		pill.classList.add('is-held');
		const windowEl = pill.querySelector('.lc-window');
		const clock = pill.classList.contains('is-drifting') ? pill.querySelector('.lc-track').getAnimations()[0] : null;
		if (clock || pill.classList.contains('is-swiped')) {
			drag = { x: e.clientX, clock, time: clock ? clock.currentTime : 0, windowEl, scroll: windowEl.scrollLeft };
		}
	});
	addEventListener('pointermove', (e) => {
		if (!drag) return;
		const moved = e.clientX - drag.x;
		if (Math.abs(moved) > 4) dragged = true;
		if (!dragged) return;
		if (drag.clock) {
			const lap = drag.clock.effect.getComputedTiming().duration;
			drag.clock.currentTime = (((drag.time - moved * 1000 / DRIFT_SPEED) % lap) + lap) % lap;
		} else {
			drag.windowEl.scrollLeft = drag.scroll - moved;
		}
	}, { passive: true });
	for (const type of ['pointerup', 'pointercancel']) {
		addEventListener(type, () => {
			drag = null;
			for (const pill of els.list.querySelectorAll('.is-held')) pill.classList.remove('is-held');
		}, { passive: true });
	}
	// A drag is not a tap on the card, and not the browser dragging a link.
	els.list.addEventListener('click', (e) => {
		if (dragged) e.preventDefault();
		dragged = false;
	}, true);
	els.list.addEventListener('dragstart', (e) => { if (drag) e.preventDefault(); });
	let lastWidth = 0;
	new ResizeObserver(() => {
		if (els.list.clientWidth === lastWidth) return;
		lastWidth = els.list.clientWidth;
		fitPills();
		woken();
	}).observe(els.list);

	// ─── Where this person stands ───
	// As the Standings tab counts it: tdc_league_standings and the season's
	// columns, ranked by TDCStandings. Only for seasons they are active in.
	let ranks = new Map();   // league season id -> { counted, player, playerCount, team, teamCount, stats }
	async function loadRanks(rows, session) {
		const mine = rows.filter((l) => l.my_status === 'active');
		if (!mine.length) return;
		const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		if (!me) return;
		const ids = mine.map((l) => l.league_season_id);
		const [cols, ...counts] = await Promise.all([
			supabaseClient.from('tbl_league_standing_columns')
				.select('id, scope, league_season_id, position, name, equation, decimals, rank_priority, higher_first')
				.in('league_season_id', ids).order('position'),
			...ids.map((id) => supabaseClient.rpc('tdc_league_standings', { p_league_season_id: id }))
		]);
		for (const r of [cols, ...counts]) {
			if (r.error) { TDC.showSupabaseError(AREA, r.error, els.status); return; }
		}
		mine.forEach((l, i) => {
			const data = counts[i].data;
			if (!data || !Array.isArray(data.players) || !Array.isArray(data.teams)) {
				TDC.error(AREA, 'the standings came back in a shape this page does not know.', data, els.status);
				return;
			}
			const these = (cols.data || []).filter((c) => c.league_season_id === l.league_season_id);
			const players = TDCStandings.rank(data.players.map((p) => Object.assign({ name: p.display_name }, p)), these.filter((c) => c.scope === 'player'));
			const teams = TDCStandings.rank(data.teams.map((t) => Object.assign({}, t)), these.filter((c) => c.scope === 'team'));
			const mineHere = players.find((p) => p.player_id === me.id);
			ranks.set(l.league_season_id, {
				counted: data.matches_counted || 0,
				player: mineHere && mineHere.rank !== null ? mineHere : null,
				playerCount: players.length,
				team: teams.find((t) => t.team_id === l.my_team_id && t.rank !== null) || null,
				teamCount: teams.length,
				stats: mineHere ? mineHere.stats : null
			});
		});
	}

	// The rules each season plays under, the league's with its own changes
	// laid over, as the database merges them.
	let seasonRules = new Map();   // league season id -> ruleset
	async function loadRules(rows) {
		const got = await Promise.all(rows.map((l) => supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: l.league_season_id })));
		got.forEach((r, i) => {
			if (r.error) { TDC.showSupabaseError(AREA, r.error, els.status); return; }
			const info = (r.data || [])[0];
			if (info) seasonRules.set(rows[i].league_season_id, info.rules || {});
		});
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
	// in its shield; TDC.leaguePic draws it, or the trophy for a league with none.
	let pictures = new Map();   // league season id -> picture_path

	// A line of a tile, which drifts if it does not fit.
	function tileLine(cls, text) {
		const run = el('div', 'lc-run');
		run.append(el('span', null, text));
		return drifter('lt-line ' + cls, run);
	}

	// A result as a tile (UV, 9 Nov): the shield beside the league and the
	// season, a strip in the status's colour, then the venue, the game and its
	// team size, and badges: the season's status, in yellow, and how this
	// person stands with it or how they would get in.
	function tile(l) {
		const box = document.createElement('a');
		box.className = 'league-tile league-status-' + l.status;
		box.href = '/leagues/join/?s=' + encodeURIComponent(l.league_season_id);

		const pic = el('div', 'league-tile-pic');
		pic.append(TDC.leaguePic(pictures.get(l.league_season_id)));
		const top = el('div', 'lt-top');
		const names = el('div', 'lt-names');
		names.append(tileLine('league-tile-name', l.league_name));
		if (l.season_name) names.append(tileLine('league-tile-meta', l.season_name));
		top.append(pic, names);
		box.append(top, el('div', 'lt-strip'));

		const where = TDC.venueNames(l.venues);
		if (where) box.append(tileLine('league-tile-meta lt-venue', where));
		const format = [disciplineSaid(l.discipline)];
		if (l.team_size === 1) format.push('Singles');
		else if (l.team_size) format.push('Teams of ' + l.team_size);
		const game = format.filter(Boolean).join(' · ');
		if (game) box.append(tileLine('league-tile-meta', game));

		const tags = el('div', 'lt-badges');
		tags.append(el('span', 'badge lt-status', statusSaid(l.status)));
		if (l.my_status === 'active') tags.append(el('span', 'badge team-name', STATUS_SAID.active));
		else if (l.my_status) tags.append(el('span', 'badge pending', STATUS_SAID[l.my_status] || l.my_status));
		else if (l.entry_mode === 'self_confirm') tags.append(el('span', 'badge needs-you', 'Join straight away'));
		else tags.append(el('span', 'badge', 'Taking names'));
		box.append(tags);
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
		fitPills(els.openList);
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
			pictures.set(r.id, r.tbl_leagues && r.tbl_leagues.picture_path);
		}
	}

	let typingTimer = null;
	els.search.addEventListener('input', () => {
		clearTimeout(typingTimer);
		typingTimer = setTimeout(searchOpen, 250);
	});
	for (const menu of [els.discipline, els.leagueStatus, els.kind]) menu.addEventListener('change', searchOpen);

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		await searchOpen();

		const { data, error } = await supabaseClient.rpc('tdc_my_leagues', { p_limit: 50 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.intro.textContent = 'You are not in a league yet. Create one below, or ask whoever runs yours to add you. You will be told when they do.';
			els.intro.hidden = false;
			return;
		}

		await Promise.all([loadPictures(data), loadRanks(data, session), loadRules(data)]);
		els.list.replaceChildren(...data.map(card));
		fitPills();
		document.fonts.ready.then(() => { fitPills(); fitPills(els.openList); });
	})(), 'Leagues');
})();
