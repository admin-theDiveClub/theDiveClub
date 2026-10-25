// The fixtures of a league season (/leagues/fixtures/?s=<league season id>).
//
// Reads with tdc_league_fixtures, which gives every row in round order with
// the team names, the match and its score already joined — asking per fixture
// would be a request per row on a page that shows thirty.
//
// Writes go through tdc_generate_league_fixtures, tdc_clear_league_fixtures,
// tdc_add_league_fixture, tdc_set_league_fixture, tdc_remove_league_fixture,
// tdc_create_league_match and tdc_detach_league_match, and after every write
// the list is read again rather than patched here: the server decides the
// order, and a page that believes its own copy drifts the first time two
// people are moving games at once.
//
// Generating needs two teams with players in them, and nothing else. Who has
// confirmed is reported beside the button, using the same readiness read the
// manage page uses, but it never disables it: confirmation is a player saying
// whether they are playing, not a gate on the director's season.
//
// The schedule is shown twice (UV, 24 Oct): the planner — a calendar with
// every night marked, and the chosen night's fixtures under it, where a
// fixture is added — and every fixture with filters. Both draw a fixture the
// same way, in a table so the columns line up: its state as a strip, home,
// its buttons, away, and under it the tables it is played on (stepper on its
// side, saved as they change). What changes on the page fades out and in.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Fixtures';

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('l-name'), meta: el('l-meta'),
		generatePanel: el('generate-panel'), generateState: el('generate-state'),
		timesPlayed: el('times-played'), timesHint: el('times-hint'),
		firstRound: el('first-round'), firstHour: el('first-hour'), firstMinute: el('first-minute'),
		daysBetween: el('days-between'), perRound: el('per-round'), tablesPer: el('tables-per'),
		generateBtn: el('generate-btn'), clearBtn: el('clear-btn'),
		cal: el('cal'), undated: el('undated'),
		dayView: el('day-view'), dayActions: el('day-actions'), dayMove: el('day-move'),
		dayTitle: el('day-title'), dayTable: el('day-table'), dayEmpty: el('day-empty'),
		addPanel: el('add-panel'), addTo: el('add-to'),
		addHome: el('add-home'), addAway: el('add-away'), addBtn: el('add-btn'),
		fFrom: el('f-from'), fTo: el('f-to'), fTeam: el('f-team'), fStatus: el('f-status'), fByes: el('f-byes'),
		allView: el('all-view'), allTable: el('all-table'), empty: el('fixtures-empty'), allNone: el('all-none'),
		status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the fixtures page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');

	// ─── State ───
	let fixtures = [];
	let teams = [];
	let teamById = new Map();
	let iRunIt = false;
	let myTeamId = null;        // so a captain can find their own night
	let selected = null;        // { day: 'YYYY-MM-DD' } or { round: n } (a round with no date)
	let moving = null;          // '<where>:<fixture id>', the one fixture being moved
	let movingNight = false;    // the chosen night's own Move is open
	let centreCal = true;       // bring the chosen night's month into view on the next draw
	const tableSaves = new Map();   // fixture id -> timer: a held chevron saves once, when it stops

	// ─── Fading ───
	// What changes on the page fades out and the new fades in (UV, 24 Oct), in
	// the controls' reveal time; at once for somebody who asked for less
	// motion. The last of several quick changes wins.
	const lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
	function revealMs() {
		if (lessMotion.matches) return 0;
		const v = getComputedStyle(document.documentElement).getPropertyValue('--control-reveal').trim();
		const n = parseFloat(v);
		if (isNaN(n)) return 0;
		return v.endsWith('ms') ? n : n * 1000;
	}
	let fadeRun = 0;
	function fade(targets, change) {
		const ms = revealMs() / 2;
		const run = ++fadeRun;
		if (!ms) { change(); return; }
		for (const t of targets) t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
		setTimeout(() => {
			if (run !== fadeRun) return;
			change();
			for (const t of targets) {
				t.getAnimations().forEach((a) => a.cancel());
				t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms });
			}
		}, ms);
	}
	function fadeIn(target) {
		const ms = revealMs();
		if (target && ms) target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms });
	}

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── Dates ───
	// A fixture's night is its local calendar day; the key is that day as
	// YYYY-MM-DD, which also sorts.
	const pad = (n) => String(n).padStart(2, '0');
	const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const dateOfKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
	const time24 = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	const longDate = (key) => dateOfKey(key).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

	function dayKey(iso) {
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable fixture date: ' + iso); return null; }
		return keyOf(d);
	}

	// The value most of a list holds: a round's night is whatever most of its
	// games are on, so one moved game does not relabel the whole round.
	function mostCommon(values) {
		const counts = new Map();
		for (const v of values) if (v !== null && v !== undefined) counts.set(v, (counts.get(v) || 0) + 1);
		let best = null;
		for (const [v, c] of counts) if (best === null || c > counts.get(best)) best = v;
		return best;
	}

	// The other way: a local "YYYY-MM-DDTHH:MM" pinned to a real moment.
	// Date() reads it as local time, which is exactly right for "half seven
	// where the person is standing".
	function fromInput(value, label) {
		const raw = (value || '').trim();
		if (!raw) return null;
		const d = new Date(raw);
		if (isNaN(d.getTime())) {
			TDC.status(els.status, `"${label}" could not be read as a date.`, 'error');
			return undefined;
		}
		return d.toISOString();
	}

	// A date field and an hour and minute stepper, put back together as the
	// local time they mean. '' for no date; 'x' for an hour or minute that is
	// not one, which fromInput then refuses.
	function joinDateTime(date, hour, minute) {
		if (!date) return '';
		const h = parseInt(hour, 10);
		const m = parseInt(minute, 10);
		if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) return 'x';
		return `${date}T${pad(h)}:${pad(m)}`;
	}

	// A fixture's state, shown as the strip down the left of its row (as the
	// leagues list shows a season's): no match yet, a match made and not
	// started, playing, finished, abandoned. A bye has none.
	const STATE = {
		none: 'Not started',
		scheduled: 'Match made',
		in_progress: 'Playing',
		complete: 'Finished',
		abandoned: 'Abandoned'
	};
	const stateOf = (f) => f.is_bye ? 'bye' : (f.match_id ? f.match_status : 'none');

	const plural = (n, one) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + one + 's');

	// Every team's picture until teams can have their own: a shield, in the
	// brand colour, as the leagues list does with its trophy.
	function teamIcon() {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = document.createElementNS(NS, 'path');
		path.setAttribute('d', 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z');
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', 'currentColor');
		path.setAttribute('stroke-width', '2');
		path.setAttribute('stroke-linejoin', 'round');
		svg.append(path);
		return svg;
	}

	// ─── The season ───
	async function loadInfo() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_info', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		const info = (data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}

		els.name.textContent = info.league_name + ' — ' + info.name;
		els.meta.textContent = info.venue_name || '';
		iRunIt = !!info.i_run_it;

		els.generatePanel.hidden = !iRunIt;
		els.addPanel.hidden = !iRunIt;
		return true;
	}

	// ─── Readiness, said before the button is pressed ───
	// The database refuses a schedule built on people who have not confirmed.
	// Saying so here as well means the director reads it as a state of the
	// league rather than as a failure.
	async function loadReadiness() {
		if (!iRunIt) return true;

		const { data, error } = await supabaseClient.rpc('tdc_league_season_readiness', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		const r = (data || [])[0];
		if (!r) { els.generateState.textContent = ''; return true; }

		const noCap = r.teams_no_captain || [];

		// Confirmation is reported, never required — the database stopped
		// refusing on it on 23 Oct and this button has no business doing it
		// either. The only thing that actually stops a schedule is not having
		// two teams with players in them.
		const waiting = r.waiting
			? ' Still to confirm: ' + (r.waiting_names || []).join(', ') + '.'
			: '';
		const capNote = noCap.length
			? ' No captain for ' + noCap.join(', ') + ', so you will be setting their lineups yourself.'
			: '';

		if (!r.active_players) {
			els.generateState.textContent = 'Nobody has been added to this league yet.';
			els.generateBtn.disabled = true;
		} else if (teams.length < 2) {
			els.generateState.textContent = (teams.length === 1 ? '1 team' : teams.length + ' teams')
				+ ' so far. A league needs at least two.' + waiting;
			els.generateBtn.disabled = true;
		} else {
			els.generateState.textContent = r.active_players + ' players across '
				+ teams.length + ' teams.' + waiting + capNote;
			els.generateBtn.disabled = false;
		}

		return true;
	}

	// ─── Teams ───
	// Which team, if any, this person plays for in this season. Used only to
	// mark their own fixtures and label the card button: the card page does
	// its own permission checks.
	async function loadMyTeam() {
		const { data, error } = await supabaseClient.rpc('tdc_my_leagues', { p_limit: 200 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		const mine = (data || []).find((l) => l.league_season_id === seasonId);
		myTeamId = mine ? mine.my_team_id : null;
		return true;
	}

	// Rebuilds a menu's options, keeping what was chosen if it is still there.
	// The selects are pills (tdc-controls), which follow their options.
	function fillSelect(select, options, fallback) {
		// An empty select's value is '' too, which is the bye's: only a select
		// that already had options has a choice to keep.
		const was = select.options.length ? select.value : null;
		select.replaceChildren(...options.map(([value, text]) => new Option(text, value)));
		select.value = options.some(([value]) => value === was) ? was : fallback;
	}

	async function loadTeams() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_teams', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		teams = data || [];
		teamById = new Map(teams.map((t) => [t.team_id, t]));

		const named = teams.map((t) => [t.team_id, t.name]);
		if (iRunIt) {
			fillSelect(els.addHome, named, named.length ? named[0][0] : '');
			fillSelect(els.addAway, named.concat([['', 'Bye']]), named.length > 1 ? named[1][0] : '');
		}
		fillSelect(els.fTeam, [['', 'All teams']].concat(named), '');
		return true;
	}

	// ─── The fixtures ───
	async function loadFixtures() {
		const { data, error } = await supabaseClient.rpc('tdc_league_fixtures', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		fixtures = data || [];
		renderFixtures();
		return true;
	}

	// Every night something is played, YYYY-MM-DD → its fixtures in the
	// server's order.
	function nights() {
		const map = new Map();
		for (const f of fixtures) {
			if (!f.scheduled_at) continue;
			const key = dayKey(f.scheduled_at);
			if (!key) continue;
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(f);
		}
		return map;
	}

	// Rounds with a fixture that has no date, in order.
	function undatedRounds() {
		return [...new Set(fixtures.filter((f) => !f.scheduled_at).map((f) => f.round))].sort((a, b) => a - b);
	}

	const nextRound = () => fixtures.reduce((m, f) => Math.max(m, f.round), 0) + 1;

	// The night the planner opens on: the next one from today, else the last;
	// a round with no date when nothing is dated; a new round when there is
	// nothing at all.
	function defaultSelection(map) {
		const keys = [...map.keys()].sort();
		const today = keyOf(new Date());
		const next = keys.find((k) => k >= today) || keys[keys.length - 1];
		if (next) return { day: next };
		const r = undatedRounds()[0];
		return { round: r || nextRound() };
	}

	// A choice that no longer exists after a re-read (its last game was moved
	// or removed) falls back to the default rather than showing nothing.
	function checkSelection(map) {
		if (selected && selected.day && map.has(selected.day)) return;
		if (selected && selected.round && (undatedRounds().includes(selected.round) || selected.round === nextRound())) return;
		selected = defaultSelection(map);
		centreCal = true;
	}

	function selectedFixtures(map) {
		if (selected.day) return map.get(selected.day) || [];
		return fixtures.filter((f) => f.round === selected.round && !f.scheduled_at);
	}

	// Where a fixture added now goes: the chosen night's round and time, or
	// the chosen round with no date.
	function addTarget(map) {
		if (selected.day) {
			const rows = map.get(selected.day) || [];
			return { round: mostCommon(rows.map((f) => f.round)), at: mostCommon(rows.map((f) => f.scheduled_at)) };
		}
		return { round: selected.round, at: null };
	}

	function renderFixtures() {
		const map = nights();
		checkSelection(map);

		els.empty.hidden = !!fixtures.length;
		els.clearBtn.hidden = !fixtures.length || !iRunIt;

		renderCalendar(map);
		renderUndated();
		renderDay(map);
		renderAll();
	}

	// ─── The calendar ───
	// The months from the first night to the last, side by side; this month
	// alone when nothing has a date. A week starts on Monday.
	function renderCalendar(map) {
		const keys = [...map.keys()].sort();
		const first = keys.length ? dateOfKey(keys[0]) : new Date();
		const last = keys.length ? dateOfKey(keys[keys.length - 1]) : new Date();
		const today = keyOf(new Date());

		const months = [];
		for (let m = new Date(first.getFullYear(), first.getMonth(), 1);
			m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
			months.push(m);
		}

		let chosenMonth = null;
		els.cal.replaceChildren(...months.map((m) => {
			const box = node('div', 'cal-month');
			box.append(node('div', 'cal-month-name',
				m.toLocaleDateString([], { month: 'long', year: 'numeric' })));

			const table = node('table', 'cal');
			const head = table.createTHead().insertRow();
			['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach((d, i) => {
				const th = node('th');
				// The weekend's headings are badges, not buttons (UV, 24 Oct).
				if (i >= 5) th.append(node('span', 'badge', d)); else th.textContent = d;
				head.append(th);
			});

			const body = table.createTBody();
			const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
			const lead = (m.getDay() + 6) % 7;
			let tr = body.insertRow();
			for (let i = 0; i < lead; i++) tr.insertCell();
			for (let d = 1; d <= days; d++) {
				if (tr.cells.length === 7) tr = body.insertRow();
				const key = keyOf(new Date(m.getFullYear(), m.getMonth(), d));
				const td = tr.insertCell();
				const rows = map.get(key);
				if (rows) {
					const b = node('button', 'cal-day', String(d));
					b.type = 'button';
					b.dataset.day = key;
					const rounds = [...new Set(rows.map((f) => f.round))].join(' and ');
					b.setAttribute('aria-label', `${longDate(key)}, round ${rounds}, ${plural(rows.length, 'fixture')}`);
					const on = selected.day === key;
					b.setAttribute('aria-pressed', on ? 'true' : 'false');
					if (on) { b.classList.add('on'); chosenMonth = box; }
					td.append(b);
				} else {
					td.append(node('span', 'cal-num', String(d)));
				}
				if (key === today) td.classList.add('cal-today');
			}
			while (tr.cells.length < 7) tr.insertCell();

			box.append(table);
			return box;
		}));

		if (centreCal && chosenMonth) {
			els.cal.scrollLeft = chosenMonth.offsetLeft - (els.cal.clientWidth - chosenMonth.offsetWidth) / 2;
		}
		centreCal = false;
	}

	// Rounds with no date, and a new round for the director, under the
	// calendar: a night with no date cannot be marked on it.
	function renderUndated() {
		const rounds = undatedRounds();
		const chips = rounds.map((r) => [r, 'Round ' + r + ' · no date']);
		if (iRunIt) chips.push([nextRound(), 'New round']);

		els.undated.hidden = !chips.length;
		els.undated.replaceChildren(...chips.map(([r, text]) => {
			const b = node('button', 'btn btn-sm ' + (selected.round === r ? 'btn-primary' : 'btn-secondary'), text);
			b.type = 'button';
			b.dataset.round = r;
			b.setAttribute('aria-pressed', selected.round === r ? 'true' : 'false');
			return b;
		}));
	}

	// ─── The chosen night ───
	function renderDay(map) {
		const rows = selectedFixtures(map);
		const target = addTarget(map);

		if (selected.day) {
			const rounds = [...new Set(rows.map((f) => f.round))].sort((a, b) => a - b);
			const time = mostCommon(rows.map((f) => time24(new Date(f.scheduled_at))));
			els.dayTitle.textContent = (rounds.length > 1 ? 'Rounds ' + rounds.join(' and ') : 'Round ' + rounds[0])
				+ ' · ' + longDate(selected.day) + (time ? ' · ' + time : '');
		} else {
			els.dayTitle.textContent = 'Round ' + selected.round + ' · no date';
		}
		els.dayTitle.hidden = !fixtures.length && !iRunIt;

		renderNightActions(rows);

		const dayTime = selected.day ? mostCommon(rows.map((f) => time24(new Date(f.scheduled_at)))) : null;
		els.dayTable.replaceChildren(...rows.flatMap((f) => fixtureRows(f, 'day', dayTime)));
		els.dayTable.hidden = !rows.length;
		wakeIcons(els.dayTable);
		els.dayEmpty.hidden = !!rows.length;
		els.dayEmpty.textContent = !fixtures.length && !iRunIt
			? 'No fixtures yet.'
			: 'No fixtures in this round yet.' + (iRunIt ? ' Add one below.' : '');

		const tables = addTables(map, target);
		els.addTo.textContent = 'Adds to round ' + target.round
			+ (target.at
				? ', ' + longDate(dayKey(target.at)) + ' at ' + time24(new Date(target.at))
				: ', with no date (Move gives it one)')
			+ (tables.length ? ', on ' + (tables.length === 1 ? 'table ' : 'tables ') + tables.join(', ') + '.' : '.');
	}

	// The night's own Start, Move and Remove, acting on every fixture in it
	// (UV, 24 Oct). Start leaves byes and fixtures with a match; Remove leaves
	// fixtures with a match, which have to be taken off first.
	function renderNightActions(rows) {
		const startable = rows.filter((f) => !f.is_bye && !f.match_id).length;
		const removable = rows.filter((f) => !f.match_id).length;
		// The same icons as a fixture's, each with a caption: these act on
		// the whole night.
		const buttons = [];
		const button = (action, icon, caption, label, tone) => {
			const box = node('div', 'fx-night-btn');
			box.append(iconButton(icon, label, tone, { night: action }, 'night:' + action),
				node('span', 'fx-night-caption', caption));
			return box;
		};
		if (iRunIt && rows.length) {
			if (startable) buttons.push(button('start', 'play', 'Start all (' + startable + ')', 'Start every match on this night', ''));
			buttons.push(movingNight
				? button('move', 'cross', 'Close', 'Close the night’s move', '')
				: button('move', 'calendar', selected.day ? 'Move all' : 'Date all', 'Move every fixture on this night', ''));
			if (removable) buttons.push(button('remove', 'cross', 'Remove all (' + removable + ')', 'Remove every fixture on this night', 'danger'));
		}
		els.dayActions.replaceChildren(...buttons);
		els.dayActions.hidden = !buttons.length;
		wakeIcons(els.dayActions);

		els.dayMove.replaceChildren();
		if (!movingNight || !iRunIt || !rows.length) { movingNight = false; return; }
		const first = rows.find((f) => f.scheduled_at);
		const at = first ? new Date(mostCommon(rows.map((f) => f.scheduled_at))) : null;
		const box = node('div', 'fx-night-move');
		box.append(dateTimeRow('night', at, selected.day || ''));
		const row = node('div', 'btn-row');
		const save = node('button', 'btn btn-primary btn-sm', 'Move the night');
		save.type = 'button';
		save.dataset.night = 'save';
		const cancel = node('button', 'btn btn-secondary btn-sm', 'Cancel');
		cancel.type = 'button';
		cancel.dataset.night = 'cancel';
		row.append(save, cancel);
		box.append(row);
		els.dayMove.append(box);
	}

	// A date control and the time as two steppers, as the schedule's first
	// round has them: for moving one fixture and for moving a night.
	function dateTimeRow(id, at, fallbackDay) {
		const row = node('div', 'field-row');
		row.dataset.row = 'move-' + id;

		const dateField = node('div', 'field');
		const dateLabel = node('label', null, 'Played on');
		dateLabel.htmlFor = 'move-' + id + '-date';
		const date = document.createElement('input');
		date.type = 'date';
		date.id = 'move-' + id + '-date';
		date.dataset.control = 'date';
		date.value = at ? keyOf(at) : fallbackDay;
		dateField.append(dateLabel, date);

		const timeField = node('div', 'field');
		const timeLabel = node('label', null, 'Time');
		timeLabel.htmlFor = 'move-' + id + '-hour';
		const pair = node('span', 'time-pair');
		const stepper = (suffix, max, step, value, label) => {
			const n = document.createElement('input');
			n.type = 'number';
			n.id = 'move-' + id + '-' + suffix;
			n.inputMode = 'numeric';
			n.min = '0';
			n.max = String(max);
			n.step = String(step);
			n.value = String(value);
			n.dataset.control = 'stepper';
			n.setAttribute('aria-label', label);
			return n;
		};
		pair.append(
			stepper('hour', 23, 1, at ? at.getHours() : 19, 'Hour'),
			node('span', 'time-sep', ':'),
			stepper('minute', 59, 5, at ? at.getMinutes() : 30, 'Minute'));
		timeField.append(timeLabel, pair);
		row.append(dateField, timeField);
		return row;
	}

	const readDateTime = (id) => fromInput(joinDateTime(
		el('move-' + id + '-date').value, el('move-' + id + '-hour').value, el('move-' + id + '-minute').value), 'Played on');

	// ─── A fixture ───
	// One table row (UV, 24 Oct): its state as a strip, home, its buttons,
	// away. Under it the tables it is played on, and a short line before the
	// next. A second row under it while it is being moved.
	function teamCell(teamId, name, side) {
		const td = node('td', 'fx-side fx-' + side);
		// To the season page with this team open and in view (UV, 24 Oct).
		const team = node('a', 'fx-team');
		team.href = '/leagues/season/?s=' + encodeURIComponent(seasonId) + '&team=' + encodeURIComponent(teamId);
		const pic = node('span', 'team-pic');
		pic.append(teamIcon());
		const names = node('span', 'fx-names');
		names.append(node('span', 'fx-name', name));
		const t = teamById.get(teamId);
		if (t) names.append(node('span', 'fx-sub', plural(t.active_players, 'player')));
		team.append(pic, names);
		td.append(team);
		return td;
	}

	// [action, icon, what it does, tone]. The icons are the ring status set
	// (ring-status.js): play, calendar, cross, arrow, minus (UV, 24 Oct).
	function actions(f) {
		const items = [];
		// The card is for whoever is playing, not only for the director: a
		// captain sets their lineup on it. It opens for anybody signed in and
		// decides for itself what they may do once they are there.
		if (f.match_id) {
			const mine = myTeamId && (f.home_team_id === myTeamId || f.away_team_id === myTeamId);
			items.push(['open', 'arrow', mine ? 'Open my card' : 'Open the card', '']);
		}
		if (!iRunIt) return items;
		if (!f.is_bye && !f.match_id) items.push(['start', 'play', 'Start the match', '']);
		if (f.match_id) items.push(['detach', 'minus', 'Take the match off', '']);
		const open = moving && moving.endsWith(':' + f.fixture_id);
		items.push(['move', open ? 'cross' : 'calendar', open ? 'Close the move' : 'Move it', '']);
		if (!f.match_id) items.push(['remove', 'cross', 'Remove it', 'danger']);
		return items;
	}

	// ─── Icon buttons ───
	// A round button with a ring icon: the icon draws itself in the first time
	// the button appears, and a redraw of the page leaves one already showing
	// as it is (only what is new moves). Pressing it sets its dots orbiting
	// until the page is read again. The ring is made once the button is on the
	// page (wakeIcons), since the engine measures the icon's strokes there.
	const iconsSeen = new Set();
	function iconButton(icon, label, tone, data, key) {
		const b = node('button', 'fx-icon' + (tone ? ' fx-icon-' + tone : ''));
		b.type = 'button';
		b.title = label;
		b.setAttribute('aria-label', label);
		Object.assign(b.dataset, data, { icon, iconKey: key });
		const face = node('span', 'tdc-ring');
		face.innerHTML = TDCRing.svg(6);
		b.append(face);
		return b;
	}

	const tokenSecs = (name, fallback) => {
		const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		const n = parseFloat(v);
		return isNaN(n) ? fallback : (v.endsWith('ms') ? n / 1000 : n);
	};

	function wakeIcons(root) {
		for (const b of root.querySelectorAll('.fx-icon:not([data-awake])')) {
			b.dataset.awake = 'yes';
			const icon = b.dataset.icon;
			const seen = iconsSeen.has(b.dataset.iconKey + ':' + icon);
			iconsSeen.add(b.dataset.iconKey + ':' + icon);
			const face = b.querySelector('.tdc-ring');
			try {
				b.tdcRing = new TDCRing.RingStatus(face, {
					icons: [icon],
					labels: { [icon]: b.getAttribute('aria-label'), empty: b.getAttribute('aria-label'), loading: 'Working' },
					initial: seen || lessMotion.matches ? icon : 'empty'
				});
			} catch (err) {
				TDC.error(AREA, 'an icon could not be drawn: ' + icon, err);
				continue;
			}
			if (seen || lessMotion.matches) continue;
			b.tdcRing.load(tokenSecs('--control-reveal', 0.35), {
				draw: tokenSecs('--ring-draw', 0.4), fade: tokenSecs('--ring-fade', 0.1),
				lead: TDCRing.leadOf(icon), spin: tokenSecs('--ring-spin', 1) || 1
			});
			b.tdcRing.resolve(icon, { together: true });
		}
	}

	// A pressed button orbits while its write is out; the read afterwards
	// redraws the page and puts a settled button in its place.
	function working(b) {
		if (!b.tdcRing || b.tdcRing.busy || lessMotion.matches) return;
		b.tdcRing.load(tokenSecs('--ring-load', 1), {
			draw: tokenSecs('--ring-draw', 0.4), fade: tokenSecs('--ring-fade', 0.1),
			lead: TDCRing.leadOf(b.dataset.icon), spin: tokenSecs('--ring-spin', 1) || 1
		});
	}

	const fixtureName = (f) => f.is_bye ? f.home_name + '’s bye' : f.home_name + ' v ' + f.away_name;

	function fixtureRows(f, where, dayTime) {
		const key = where + ':' + f.fixture_id;
		const tr = node('tr', 'fx-row');
		if (myTeamId && (f.home_team_id === myTeamId || f.away_team_id === myTeamId)) tr.classList.add('fx-mine');

		// The strip runs the fixture's whole height: its row and the tables
		// row under it (UV, 24 Oct).
		const state = stateOf(f);
		const strip = node('td', 'fx-state fx-state-' + state);
		strip.rowSpan = f.is_bye ? 1 : 2;
		if (state !== 'bye') {
			strip.title = STATE[state] || state;
			strip.append(node('span', 'visually-hidden', STATE[state] || state));
		}

		// The middle: each side's score beside its team, the buttons between
		// them (UV, 25 Oct). A score shows once any frame has a result, or the
		// match is finished, whether or not the night is.
		const mid = node('td', 'fx-mid');
		const line = node('div', 'fx-mid-line');
		const scored = f.match_id && (f.home_frames || f.away_frames || f.match_status === 'complete');
		if (scored) line.append(node('span', 'fx-score fx-score-home', String(f.home_frames || 0)));
		const items = actions(f);
		if (items.length) {
			const box = node('div', 'fx-actions');
			for (const [action, icon, label, tone] of items) {
				box.append(iconButton(icon, label + ': ' + fixtureName(f), tone,
					{ action, fixture: f.fixture_id, where }, key + ':' + action));
			}
			line.append(box);
		} else {
			line.append(node('span', 'fx-v', 'v'));
		}
		if (scored) line.append(node('span', 'fx-score fx-score-away', String(f.away_frames || 0)));
		mid.append(line);

		// Under the buttons: the time when it is not the night's.
		if (f.scheduled_at && dayTime !== undefined && time24(new Date(f.scheduled_at)) !== dayTime) {
			mid.append(node('span', 'fx-mid-sub', time24(new Date(f.scheduled_at))));
		}

		const away = f.is_bye ? node('td', 'fx-side fx-away') : teamCell(f.away_team_id, f.away_name, 'away');
		if (f.is_bye) away.append(node('span', 'fx-bye', 'Bye'));

		tr.append(strip, teamCell(f.home_team_id, f.home_name, 'home'), mid, away);

		const out = [tr];
		if (!f.is_bye) out.push(tablesRow(f, where));
		if (moving === key) out.push(moveRow(f, where));
		out.push(separator());
		return out;
	}

	// The tables a fixture is played on, as steppers on their side (UV, 24
	// Oct): filled by the generator, changed here, saved a moment after the
	// last change. The row scrolls sideways when a venue gives a match many.
	function tablesRow(f, where) {
		const tr = node('tr', 'fx-tables');
		const td = node('td');
		td.colSpan = 3;
		const nums = f.table_numbers || [];

		const line = node('div', 'fx-tables-line');
		line.append(node('span', 'fx-tables-label', nums.length === 1 ? 'Table' : 'Tables'));

		if (!iRunIt) {
			line.append(node('span', 'fx-tables-read', nums.length ? nums.join(' · ') : 'Not set'));
			td.append(line);
			tr.append(td);
			return tr;
		}

		const row = node('div', 'stepper-row scroll-x');
		nums.forEach((n, i) => {
			const input = document.createElement('input');
			input.type = 'number';
			input.id = 'tbl-' + where + '-' + f.fixture_id + '-' + i;
			input.min = '1';
			input.max = '99';
			input.value = String(n);
			input.dataset.control = 'stepper';
			input.dataset.stepper = 'across';
			input.dataset.tables = f.fixture_id;
			input.setAttribute('aria-label', `Table ${i + 1} for ${fixtureName(f)}`);
			row.append(input);
		});
		if (!nums.length) row.append(node('span', 'fx-tables-read', 'None'));

		const more = node('button', 'fx-table-btn', '+');
		more.type = 'button';
		more.dataset.action = 'table-add';
		more.dataset.fixture = f.fixture_id;
		more.dataset.where = where;
		more.setAttribute('aria-label', 'Another table for ' + fixtureName(f));
		line.append(row, more);
		if (nums.length) {
			const less = node('button', 'fx-table-btn', '−');
			less.type = 'button';
			less.dataset.action = 'table-less';
			less.dataset.fixture = f.fixture_id;
			less.dataset.where = where;
			less.setAttribute('aria-label', 'One table fewer for ' + fixtureName(f));
			line.append(less);
		}
		td.append(line);
		tr.append(td);
		return tr;
	}

	// A short line between one fixture and the next (UV, 24 Oct).
	function separator() {
		const tr = node('tr', 'fx-sep');
		const td = node('td');
		td.colSpan = 4;
		td.append(node('div', 'fx-sep-line'));
		tr.append(td);
		return tr;
	}

	// Moving one fixture, under its own row.
	function moveRow(f, where) {
		const tr = node('tr', 'fx-edit');
		const td = node('td');
		td.colSpan = 4;
		const id = where + '-' + f.fixture_id;
		td.append(dateTimeRow(id, f.scheduled_at ? new Date(f.scheduled_at) : null, selected.day || ''));

		const buttons = node('div', 'btn-row');
		const button = (action, label, cls) => {
			const b = node('button', 'btn btn-sm ' + cls, label);
			b.type = 'button';
			b.dataset.action = action;
			b.dataset.fixture = f.fixture_id;
			b.dataset.where = where;
			return b;
		};
		buttons.append(button('save', 'Save', 'btn-primary'));
		if (f.scheduled_at) buttons.append(button('unschedule', 'Take the date off', 'btn-secondary'));
		buttons.append(button('cancel', 'Cancel', 'btn-secondary'));
		td.append(buttons);
		tr.append(td);
		return tr;
	}

	// ─── Every fixture ───
	function passes(f) {
		const from = els.fFrom.value;
		const to = els.fTo.value;
		if (from || to) {
			if (!f.scheduled_at) return false;
			const key = dayKey(f.scheduled_at);
			if (from && key < from) return false;
			if (to && key > to) return false;
		}
		const team = els.fTeam.value;
		if (team && f.home_team_id !== team && f.away_team_id !== team) return false;
		const status = els.fStatus.value;
		if (status && (f.is_bye || stateOf(f) !== status)) return false;
		if (!els.fByes.checked && f.is_bye) return false;
		return true;
	}

	// Grouped under their date and time, in date order, the fixtures with no
	// date last by round.
	function renderAll() {
		const rows = fixtures.filter(passes).slice().sort((a, b) => {
			if (!a.scheduled_at !== !b.scheduled_at) return a.scheduled_at ? -1 : 1;
			if (a.scheduled_at && a.scheduled_at !== b.scheduled_at) return a.scheduled_at < b.scheduled_at ? -1 : 1;
			return a.round - b.round;
		});

		const out = [];
		let group = null;
		for (const f of rows) {
			const g = f.scheduled_at ? 'at:' + f.scheduled_at : 'round:' + f.round;
			if (g !== group) {
				group = g;
				const head = node('tr', 'fx-when');
				const td = node('td');
				td.colSpan = 4;
				td.textContent = f.scheduled_at
					? longDate(dayKey(f.scheduled_at)) + ' · ' + time24(new Date(f.scheduled_at)) + ' · Round ' + f.round
					: 'Round ' + f.round + ' · no date';
				head.append(td);
				out.push(head);
			}
			out.push(...fixtureRows(f, 'all'));
		}
		els.allTable.replaceChildren(...out);
		els.allTable.hidden = !rows.length;
		wakeIcons(els.allTable);
		els.allNone.hidden = !fixtures.length || !!rows.length;
	}

	for (const f of [els.fFrom, els.fTo, els.fTeam, els.fStatus, els.fByes]) {
		f.addEventListener('change', () => fade([els.allView], renderAll));
	}

	// ─── Generating ───
	const TIMES_HINT = {
		1: 'Every team plays every other once.',
		2: 'Every team plays every other twice, once at home and once away.',
		3: 'Three meetings each. Two at home for one side, two for the other.',
		4: 'Four meetings each, two at home and two away.'
	};

	function showTimesHint() {
		els.timesHint.textContent = TIMES_HINT[els.timesPlayed.value] || '';
	}
	els.timesPlayed.addEventListener('input', showTimesHint);
	els.timesPlayed.addEventListener('change', showTimesHint);

	els.generateBtn.addEventListener('click', async () => {
		const times = parseInt(els.timesPlayed.value, 10);
		if (isNaN(times) || times < 1 || times > 4) {
			TDC.status(els.status, 'Rounds has to be a number from 1 to 4.', 'error');
			return;
		}

		// The first round's date and time are separate fields (the date
		// control takes a date only).
		const first = fromInput(joinDateTime(els.firstRound.value, els.firstHour.value, els.firstMinute.value), 'First round');
		if (first === undefined) return;

		const days = parseInt(els.daysBetween.value, 10);
		if (isNaN(days) || days < 0 || days > 365) {
			TDC.status(els.status, 'Days between rounds has to be a number from 0 to 365.', 'error');
			return;
		}

		const perRound = parseInt(els.perRound.value, 10);
		if (isNaN(perRound) || perRound < 1 || perRound > 6) {
			TDC.status(els.status, 'Matches per team per round has to be a number from 1 to 6.', 'error');
			return;
		}

		const tablesPer = parseInt(els.tablesPer.value, 10);
		if (isNaN(tablesPer) || tablesPer < 0 || tablesPer > 20) {
			TDC.status(els.status, 'Tables per match has to be a number from 0 to 20.', 'error');
			return;
		}

		// Replacing throws away a schedule people may already have read, and
		// if matches are attached it throws away the shape they sit in.
		const replace = !!fixtures.length;
		if (replace) {
			const played = fixtures.filter((f) => f.match_id).length;
			const warning = played
				? `\n\n${played} ${played === 1 ? 'match has' : 'matches have'} already been started. ${played === 1 ? 'It stays' : 'They stay'} in the records, but ${played === 1 ? 'it leaves' : 'they leave'} the schedule.`
				: '';
			if (!confirm('Replace the whole schedule?' + warning)) return;
		}

		// A fresh schedule opens on its own first night.
		selected = null;
		write('Generating', () => supabaseClient.rpc('tdc_generate_league_fixtures', {
			p_league_season_id: seasonId,
			p_times_played: times,
			p_first_round_at: first,
			p_days_between: days,
			p_replace: replace,
			p_detach_matches: replace,
			p_matches_per_round: perRound,
			p_tables_per_match: tablesPer
		}), (made) => made + (made === 1 ? ' fixture made.' : ' fixtures made.'), { single: 'generate' });
	});

	els.clearBtn.addEventListener('click', () => {
		const played = fixtures.filter((f) => f.match_id).length;
		const warning = played
			? `\n\n${played} ${played === 1 ? 'match has' : 'matches have'} already been started. ${played === 1 ? 'It is' : 'They are'} kept, but ${played === 1 ? 'it leaves' : 'they leave'} the schedule.`
			: '';
		if (!confirm('Clear the whole schedule?' + warning)) return;

		write('Clearing', () => supabaseClient.rpc('tdc_clear_league_fixtures', {
			p_league_season_id: seasonId,
			p_detach_matches: true
		}), null, { single: 'clear' });
	});

	// ─── Adding one by hand ───
	// To the chosen night's round and time. A rearranged game, a catch-up
	// week, a team joining late — all ordinary in a league, none a repair.

	// Its tables: as many as the night's other fixtures have (or the schedule
	// form's Tables per match when none has any), numbered on from the
	// highest the night already uses, so it never lands on a table in use.
	function addTables(map, target) {
		const night = target.at
			? (map.get(dayKey(target.at)) || [])
			: fixtures.filter((f) => f.round === target.round && !f.scheduled_at);
		const sized = night.find((f) => (f.table_numbers || []).length);
		let per = sized ? sized.table_numbers.length : parseInt(els.tablesPer.value, 10);
		if (isNaN(per) || per < 0) per = 0;
		const top = night.reduce((m, f) => Math.max(m, ...(f.table_numbers || [0])), 0);
		return Array.from({ length: Math.min(per, 20) }, (_, i) => top + i + 1).filter((n) => n <= 99);
	}

	els.addBtn.addEventListener('click', () => {
		if (!els.addHome.value) {
			TDC.status(els.status, 'Choose the home team first.', '');
			return;
		}
		const map = nights();
		const target = addTarget(map);
		const bye = !els.addAway.value;
		write('Adding', () => supabaseClient.rpc('tdc_add_league_fixture', {
			p_league_season_id: seasonId,
			p_round: target.round,
			p_home_team_id: els.addHome.value,
			p_away_team_id: els.addAway.value || null,
			p_scheduled_at: target.at,
			p_table_numbers: bye ? [] : addTables(map, target)
		}));
	});

	// ─── Choosing a night, and the buttons ───
	const redraw = () => { renderUndated(); renderDay(nights()); renderAll(); };

	document.addEventListener('click', (e) => {
		const day = e.target.closest('[data-day]');
		const round = e.target.closest('#undated [data-round]');
		const night = e.target.closest('[data-night]');
		const action = e.target.closest('.fx-table button[data-action]');

		if (day || round) {
			const next = day ? { day: day.dataset.day } : { round: parseInt(round.dataset.round, 10) };
			moving = null;
			movingNight = false;
			// The calendar's ring moves at once; the night underneath fades.
			selected = next;
			renderCalendar(nights());
			renderUndated();
			fade([els.dayView], () => renderDay(nights()));
			return;
		}
		if (night) { actNight(night.dataset.night, night); return; }
		if (action) act(action);
	});

	// The chosen night's own buttons, on every fixture in it.
	function actNight(what, button) {
		const map = nights();
		const rows = selectedFixtures(map);
		switch (what) {
			case 'start': {
				const todo = rows.filter((f) => !f.is_bye && !f.match_id);
				if (!todo.length) return;
				if (!confirm(`Start ${plural(todo.length, 'match')} on this night?`)) return;
				working(button);
				for (const f of todo) {
					write('Starting', () => supabaseClient.rpc('tdc_create_league_match', { p_fixture_id: f.fixture_id }),
						() => 'Matches created. Open a card to set its lineups.', { single: 'start-' + f.fixture_id });
				}
				return;
			}
			case 'remove': {
				const todo = rows.filter((f) => !f.match_id);
				const kept = rows.length - todo.length;
				if (!todo.length) return;
				const note = kept ? `\n\n${plural(kept, 'fixture')} with a match ${kept === 1 ? 'stays' : 'stay'}: take the match off first.` : '';
				if (!confirm(`Remove ${plural(todo.length, 'fixture')} from the schedule?` + note)) return;
				working(button);
				for (const f of todo) {
					write('Removing', () => supabaseClient.rpc('tdc_remove_league_fixture', { p_fixture_id: f.fixture_id }));
				}
				return;
			}
			case 'move':
				movingNight = !movingNight;
				renderDay(map);
				fadeIn(els.dayMove.firstChild);
				return;
			case 'cancel':
				movingNight = false;
				renderDay(map);
				return;
			case 'save': {
				const value = readDateTime('night');
				if (value === undefined) return;
				if (!value) { TDC.status(els.status, 'Choose the date the night moves to.', ''); return; }
				// Every fixture keeps its place in the night: one an hour later
				// than the rest is still an hour later on the new night.
				const base = rows.find((f) => f.scheduled_at);
				const from = base ? new Date(mostCommon(rows.map((f) => f.scheduled_at))).getTime() : null;
				const to = new Date(value).getTime();
				movingNight = false;
				selected = { day: dayKey(value) };
				centreCal = true;
				for (const f of rows) {
					const at = f.scheduled_at && from !== null
						? new Date(to + (new Date(f.scheduled_at).getTime() - from)).toISOString()
						: value;
					write('Moving the night', () => supabaseClient.rpc('tdc_set_league_fixture', { p_fixture_id: f.fixture_id, p_scheduled_at: at }));
				}
				return;
			}
		}
	}

	function act(button) {
		const id = button.dataset.fixture;
		const where = button.dataset.where;
		const f = fixtures.find((x) => x.fixture_id === id);
		if (!f) { TDC.error(AREA, 'no fixture ' + id + ' on the page. Reload it.', null, els.status); return; }

		switch (button.dataset.action) {
			case 'open':
				location.href = '/leagues/card/?m=' + encodeURIComponent(f.match_id);
				return;
			case 'start':
				working(button);
				// Said plainly: the lineups come next, on the card.
				write('Starting', () => supabaseClient.rpc('tdc_create_league_match', { p_fixture_id: id }),
					() => 'Match created. Open the card to set the lineups.', { single: 'start-' + id });
				return;
			case 'detach':
				if (!confirm('Take the match off this fixture?\n\nThe match and any frames on it are kept — it just stops being part of the schedule.')) return;
				working(button);
				write('Taking it off', () => supabaseClient.rpc('tdc_detach_league_match', { p_fixture_id: id }));
				return;
			case 'remove':
				if (!confirm(`Remove ${fixtureName(f)} from the schedule?`)) return;
				working(button);
				write('Removing', () => supabaseClient.rpc('tdc_remove_league_fixture', { p_fixture_id: id }));
				return;
			case 'move': {
				const key = where + ':' + id;
				moving = moving === key ? null : key;
				redraw();
				fadeIn(document.querySelector('.fx-edit'));
				return;
			}
			case 'cancel':
				moving = null;
				redraw();
				return;
			case 'save': {
				const value = readDateTime(where + '-' + id);
				if (value === undefined) return;
				moving = null;
				// The planner follows the fixture to its new night.
				if (where === 'day' && value) { selected = { day: dayKey(value) }; centreCal = true; }
				write('Saving', () => supabaseClient.rpc('tdc_set_league_fixture', value
					? { p_fixture_id: id, p_scheduled_at: value }
					: { p_fixture_id: id, p_clear_schedule: true }));
				return;
			}
			case 'unschedule':
				moving = null;
				write('Saving', () => supabaseClient.rpc('tdc_set_league_fixture', { p_fixture_id: id, p_clear_schedule: true }));
				return;
			case 'table-add': {
				const nums = (f.table_numbers || []).slice();
				if (nums.length >= 20) { TDC.status(els.status, 'A match can be played on up to 20 tables.', ''); return; }
				nums.push(Math.min(99, Math.max(0, ...nums) + 1));
				saveTables(id, nums, 0);
				return;
			}
			case 'table-less':
				saveTables(id, (f.table_numbers || []).slice(0, -1), 0);
				return;
		}
	}

	// A table number changed on its stepper. Saved once the chevron is let go
	// (a moment after the last change), so holding it is one write, not ten.
	document.addEventListener('change', (e) => {
		const input = e.target.closest('input[data-tables]');
		if (!input) return;
		const id = input.dataset.tables;
		const row = input.closest('.stepper-row');
		const nums = [...row.querySelectorAll('input[data-tables]')].map((i) => parseInt(i.value, 10));
		if (nums.some((n) => isNaN(n) || n < 1 || n > 99)) {
			TDC.status(els.status, 'A table is a number from 1 to 99.', 'error');
			return;
		}
		saveTables(id, nums, 700);
	});

	function saveTables(id, nums, wait) {
		clearTimeout(tableSaves.get(id));
		tableSaves.set(id, setTimeout(() => {
			tableSaves.delete(id);
			write('Saving the tables', () => supabaseClient.rpc('tdc_set_league_fixture', { p_fixture_id: id, p_table_numbers: nums }));
		}, wait));
	}

	// ─── Reading everything ───
	// Teams first: the menus are built from them, and readiness reports how
	// many there are.
	async function loadAll() {
		const results = [];
		results.push(await loadMyTeam());
		results.push(await loadTeams());
		results.push(await loadFixtures());
		results.push(await loadReadiness());
		return results.every(Boolean);
	}

	// ─── Writing ───
	// Every write goes through here: queued, never refused (TDC.writer), the
	// list read again once a burst has saved, and nothing swallowed quietly.
	// A failed write's re-read puts the screen back to what the server holds,
	// and the message goes up after so the re-read cannot wipe it. Generate,
	// clear and start pass { single }, so a double tap does them once.
	const { write } = TDC.writer({
		area: AREA, status: els.status, reload: loadAll, after: () => TDC.flushPushes()
	});

	// ─── Start ───
	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the leagues list.', null, els.status);
			return;
		}


		if (!await loadInfo()) return;
		showTimesHint();
		await loadAll();
	})();
})();
