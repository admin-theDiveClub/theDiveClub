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
// Generating refuses until every active player has confirmed. The page says so
// before the button is pressed as well, using the same readiness read the
// manage page uses — but it is the database that enforces it, not this.
//
// A team match cannot be scored yet: the lineups and the captain's scorecard
// are later steps, and the match page refuses to load one. So "Start match"
// creates the record and says what it did, and does not send anybody to a page
// that cannot open it.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Fixtures';

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('l-name'), meta: el('l-meta'),
		generatePanel: el('generate-panel'), generateState: el('generate-state'),
		timesPlayed: el('times-played'), timesHint: el('times-hint'),
		firstRound: el('first-round'), daysBetween: el('days-between'),
		generateBtn: el('generate-btn'), clearBtn: el('clear-btn'),
		addPanel: el('add-panel'), addRound: el('add-round'),
		addHome: el('add-home'), addAway: el('add-away'), addBtn: el('add-btn'),
		rounds: el('round-list'), empty: el('fixtures-empty'),
		status: el('page-status'),
		seasonLink: el('season-link'), manageLink: el('manage-link'), manageSep: el('manage-sep')
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
	let iRunIt = false;
	let moving = null;      // the one fixture whose date is being changed
	let busy = false;       // one write at a time, so two clicks cannot race

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// A fixture is a date in the diary, so this reads forwards as well as back.
	function when(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable fixture date: ' + iso); return ''; }

		const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const days = Math.round((midnight(d) - midnight(new Date())) / 86400000);
		const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

		if (days === 0) return 'Today ' + time;
		if (days === 1) return 'Tomorrow ' + time;
		if (days === -1) return 'Yesterday ' + time;
		if (days > 1 && days < 7) return d.toLocaleDateString([], { weekday: 'long' }) + ' ' + time;
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + time;
	}

	// A datetime-local field wants "YYYY-MM-DDTHH:MM" in local time, which is
	// not what an ISO string from the server is.
	function forInput(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) return '';
		const pad = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

	const MATCH_STATUS = {
		scheduled: 'Not started',
		in_progress: 'Playing',
		complete: 'Finished',
		abandoned: 'Abandoned'
	};

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
		els.manageLink.hidden = !iRunIt;
		els.manageSep.hidden = !iRunIt;
		if (iRunIt) els.manageLink.href = '/leagues/manage/?s=' + encodeURIComponent(seasonId);
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
		const capNote = noCap.length
			? ' No captain for ' + noCap.join(', ') + ', so you will be setting their lineups yourself.'
			: '';

		if (r.ready) {
			els.generateState.textContent = 'Everybody has confirmed. '
				+ (teams.length === 1 ? '1 team' : teams.length + ' teams')
				+ ' to schedule.';
			els.generateBtn.disabled = teams.length < 2;
			if (teams.length < 2) {
				els.generateState.textContent += ' A league needs at least two.';
			}
			els.generateState.textContent += capNote;
		} else if (!r.active_players) {
			els.generateState.textContent = 'Nobody has been added to this league yet.';
			els.generateBtn.disabled = true;
		} else {
			els.generateState.textContent = 'Waiting on ' + (r.waiting_names || []).join(', ')
				+ ' to confirm. The schedule can be made once they have.';
			els.generateBtn.disabled = true;
		}
		return true;
	}

	// ─── Teams, for the add-a-fixture menus ───
	async function loadTeams() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_teams', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		teams = data || [];

		if (iRunIt) {
			const home = els.addHome.value;
			const away = els.addAway.value;
			els.addHome.replaceChildren(...teams.map((t) => new Option(t.name, t.team_id)));
			els.addAway.replaceChildren(
				new Option('Nobody — a bye', ''),
				...teams.map((t) => new Option(t.name, t.team_id)));
			// Keep what was chosen, if those teams are still there.
			if (teams.some((t) => t.team_id === home)) els.addHome.value = home;
			if (!away || teams.some((t) => t.team_id === away)) els.addAway.value = away;
		}
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

	// The names first, then the controls underneath. They were beside the
	// names until a headless render at 420px showed what that costs: the
	// actions are a fixed-width flex item, so three of them squeezed
	// "Charlie v Delta" down to one word a line. A .btn-row nested inside
	// .list-row-main wraps instead, and cannot squeeze anything.
	function fixtureRow(f, roundWhen) {
		const row = node('div', 'list-row');
		const main = node('div', 'list-row-main');

		const sub = [];
		if (f.is_bye) {
			main.append(node('span', null, f.home_name + ' — a bye'));
			sub.push('Sitting this round out.');
		} else {
			main.append(node('span', null, f.home_name + ' v ' + f.away_name));
			// Only when it is not the round's own night: a rearranged game is
			// worth pointing at, and repeating the same date down the whole
			// round is not.
			if (f.scheduled_at && f.scheduled_at !== roundWhen) sub.push('Moved to ' + when(f.scheduled_at));
			if (!f.scheduled_at && roundWhen) sub.push('No date');
			if (f.match_id) {
				sub.push(MATCH_STATUS[f.match_status] || f.match_status);
				// A team match has no frames until the lineups exist, so a
				// 0 – 0 would read as a game that was played and nil-nil.
				if (f.home_frames || f.away_frames) {
					sub.push(f.home_frames + ' – ' + f.away_frames);
				}
			}
			if (f.notes) sub.push(f.notes);
		}
		if (sub.length) main.append(node('span', 'sub', sub.join(' · ')));

		if (iRunIt) {
			const actions = node('div', 'btn-row');

			if (!f.is_bye && !f.match_id) {
				const start = node('button', 'btn btn-primary btn-sm', 'Start match');
				start.type = 'button';
				start.dataset.action = 'start';
				start.dataset.fixture = f.fixture_id;
				actions.append(start);
			}
			if (f.match_id) {
				const detach = node('button', 'btn btn-secondary btn-sm', 'Take match off');
				detach.type = 'button';
				detach.dataset.action = 'detach';
				detach.dataset.fixture = f.fixture_id;
				actions.append(detach);
			}

			// Moving one game is occasional, so the date field is behind a
			// button. Twelve date pickers down a page is a page nobody reads.
			const move = node('button', 'btn btn-secondary btn-sm',
				moving === f.fixture_id ? 'Done' : 'Move');
			move.type = 'button';
			move.dataset.action = 'move';
			move.dataset.fixture = f.fixture_id;
			actions.append(move);

			if (!f.match_id) {
				const remove = node('button', 'btn btn-danger btn-sm', 'Remove');
				remove.type = 'button';
				remove.dataset.action = 'remove';
				remove.dataset.fixture = f.fixture_id;
				remove.dataset.name = f.is_bye ? f.home_name + '\u2019s bye' : f.home_name + ' v ' + f.away_name;
				actions.append(remove);
			}

			main.append(actions);

			if (moving === f.fixture_id) {
				const field = node('div', 'field');
				const label = node('label', null, 'When this one is played');
				label.htmlFor = 'move-' + f.fixture_id;
				const date = document.createElement('input');
				date.type = 'datetime-local';
				date.id = 'move-' + f.fixture_id;
				date.value = forInput(f.scheduled_at);
				date.dataset.action = 'date';
				date.dataset.fixture = f.fixture_id;
				field.append(label, date, node('div', 'hint', 'Clear it to take the date off.'));
				main.append(field);
			}
		}

		row.append(main);
		return row;
	}

	function renderFixtures() {
		els.empty.hidden = !!fixtures.length;
		els.clearBtn.hidden = !fixtures.length || !iRunIt;

		// Grouped by round, in the order the server gave them.
		const byRound = new Map();
		for (const f of fixtures) {
			if (!byRound.has(f.round)) byRound.set(f.round, []);
			byRound.get(f.round).push(f);
		}

		els.rounds.replaceChildren(...[...byRound.entries()].map(([round, rows]) => {
			const box = document.createElement('details');
			box.className = 'set-group';
			// Every round open: a schedule is for reading, and a page of
			// closed boxes makes somebody tap eight times to find their game.
			box.open = true;

			const head = document.createElement('summary');
			// The round's night is whatever most of its games are on, so a
			// single moved game does not relabel the whole round.
			const counts = new Map();
			for (const r of rows) {
				if (r.scheduled_at) counts.set(r.scheduled_at, (counts.get(r.scheduled_at) || 0) + 1);
			}
			let roundWhen = null;
			for (const [iso, c] of counts) {
				if (!roundWhen || c > counts.get(roundWhen)) roundWhen = iso;
			}
			head.textContent = 'Round ' + round + (roundWhen ? ' · ' + when(roundWhen) : '');
			box.append(head, ...rows.map((r) => fixtureRow(r, roundWhen)));
			return box;
		}));
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
	els.timesPlayed.addEventListener('change', showTimesHint);

	els.generateBtn.addEventListener('click', async () => {
		const first = fromInput(els.firstRound.value, 'First round');
		if (first === undefined) return;

		const days = parseInt(els.daysBetween.value, 10);
		if (isNaN(days) || days < 0 || days > 365) {
			TDC.status(els.status, 'Days between rounds has to be a number from 0 to 365.', 'error');
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

		write('Generating', () => supabaseClient.rpc('tdc_generate_league_fixtures', {
			p_league_season_id: seasonId,
			p_times_played: parseInt(els.timesPlayed.value, 10),
			p_first_round_at: first,
			p_days_between: days,
			p_replace: replace,
			p_detach_matches: replace
		}), (made) => made + (made === 1 ? ' fixture made.' : ' fixtures made.'));
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
		}));
	});

	// ─── Adding one by hand ───
	els.addBtn.addEventListener('click', () => {
		const round = parseInt(els.addRound.value, 10);
		if (isNaN(round) || round < 1) {
			TDC.status(els.status, 'A fixture needs a round of 1 or more.', 'error');
			return;
		}
		if (!els.addHome.value) {
			TDC.status(els.status, 'Choose the home team first.', '');
			return;
		}
		write('Adding', () => supabaseClient.rpc('tdc_add_league_fixture', {
			p_league_season_id: seasonId,
			p_round: round,
			p_home_team_id: els.addHome.value,
			p_away_team_id: els.addAway.value || null
		}));
	});

	// ─── Row actions ───
	els.rounds.addEventListener('click', (e) => {
		const button = e.target.closest('button[data-action]');
		if (!button) return;
		const id = button.dataset.fixture;

		if (button.dataset.action === 'start') {
			// Said plainly, because there is nowhere to send them yet: the
			// match page cannot open a team match until the scorecard exists.
			write('Starting', () => supabaseClient.rpc('tdc_create_league_match', { p_fixture_id: id }),
				() => 'Match created. It cannot be scored until the team scorecard is built.');
		} else if (button.dataset.action === 'detach') {
			if (!confirm('Take the match off this fixture?\n\nThe match and any frames on it are kept — it just stops being part of the schedule.')) return;
			write('Taking it off', () => supabaseClient.rpc('tdc_detach_league_match', { p_fixture_id: id }));
		} else if (button.dataset.action === 'move') {
			moving = moving === id ? null : id;
			renderFixtures();
			const field = document.getElementById('move-' + id);
			if (field) field.focus({ preventScroll: true });
		} else if (button.dataset.action === 'remove') {
			if (!confirm(`Remove ${button.dataset.name} from the schedule?`)) return;
			write('Removing', () => supabaseClient.rpc('tdc_remove_league_fixture', { p_fixture_id: id }));
		}
	});

	els.rounds.addEventListener('change', (e) => {
		const input = e.target.closest('[data-action="date"]');
		if (!input) return;

		const value = input.value
			? fromInput(input.value, 'The date')
			: null;
		if (value === undefined) return;

		moving = null;
		write('Saving', () => supabaseClient.rpc('tdc_set_league_fixture', value
			? { p_fixture_id: input.dataset.fixture, p_scheduled_at: value }
			: { p_fixture_id: input.dataset.fixture, p_clear_schedule: true }));
	});

	// ─── Reading everything ───
	// Teams first: the add menus are built from them, and readiness reports
	// how many there are.
	async function loadAll() {
		const results = [];
		results.push(await loadTeams());
		results.push(await loadFixtures());
		results.push(await loadReadiness());
		return results.every(Boolean);
	}

	// ─── Writing ───
	// Every write goes through here: one at a time, the list read again
	// afterwards, and nothing swallowed quietly.
	async function write(what, fn, done) {
		if (busy) return false;
		busy = true;
		TDC.status(els.status, what + '…', '');

		const { data, error } = await fn();
		if (error) {
			// The screen still shows what the person just clicked, which is
			// now a lie. Re-reading puts it back to what the server holds, and
			// the message goes up after so the re-read cannot wipe it.
			await loadAll();
			busy = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return false;
		}

		const ok = await loadAll();
		busy = false;
		if (ok) TDC.status(els.status, done ? done(data) : '', done ? 'success' : '');

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

		if (!await loadInfo()) return;
		showTimesHint();
		await loadAll();
	})();
})();
