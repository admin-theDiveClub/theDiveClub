// A tournament's pages as tabs (UV, 5 Nov), as a league season's are
// (league-nav.js, whose sibling this is: the same bar, the same way of
// opening a tab, the same loading screens; keep the two in step).
//
// One page, /tournaments/bracket/?t=<tournament id>&tab=<entrants|settings>:
// Draw (everybody), Entrants and Settings (the people running it). Each is a
// panel, <div class="tournament-panel" data-tab="<key>" data-title="<title>">,
// whose script registers with TDCTournamentNav.panel(key, start); start()
// runs the first time the tab opens, and may return { refresh } to read the
// tab again when it is shown again. A tap shows the panel in place and puts
// &tab= in the address, so a reload or a shared link opens the same tab and
// Back steps between tabs. The old Entrants address (/tournaments/manage/)
// forwards here.
//
// The Poster is not a tab (UV, 5 Nov): it is the one page a signed-out
// visitor can open, so it keeps its own address and is a link at the end of
// the bar: always for the people running it, for anybody else once it is
// shared (tdc_tournament_poster returns nothing to them until it is).
//
// The tab the page opens on, and the bar, hold the page's loading screen
// (loader.js); a tab opened later gets a screen over that tab alone. A tab
// shown again is drawn already and reads again in place, with no screen.
//
// Needs: tdc.js, supabaseClient.js; dots.js for the switch; loader.js.

const TDCTournamentNav = (() => {
	const AREA = 'Tournament pages';

	// [key, label, only for the people running it]
	const TABS = [
		['draw', 'Draw', false],
		['entrants', 'Entrants', true],
		['settings', 'Settings', true]
	];
	const posterUrl = (t) => '/tournaments/poster/?t=' + t;

	const starts = new Map();     // key -> the panel's start(), registered as its script loads
	const started = new Set();
	const refreshers = new Map(); // key -> what start() returned to read the tab again
	let current = null;
	const DOTS_MIN = 200;         // ms, as every control (tdc-controls.js)

	const panels = () => [...document.querySelectorAll('.tournament-panel')];
	const known = (key) => TABS.some(([k]) => k === key);
	const tabInAddress = () => {
		const t = new URLSearchParams(location.search).get('tab');
		return known(t) ? t : 'draw';
	};

	function panel(key, start) {
		if (starts.has(key)) TDC.error(AREA, `two scripts registered the "${key}" tab.`);
		starts.set(key, start);
	}

	// The tab in the green pill, wherever the bar has got to drawing.
	function mark(key) {
		const nav = document.getElementById('tournament-nav');
		if (!nav) return;
		for (const item of nav.querySelectorAll('[data-tab]')) {
			if (item.dataset.tab === key) item.setAttribute('aria-current', 'page');
			else item.removeAttribute('aria-current');
		}
		const here = nav.querySelector('[aria-current]');
		const track = nav.querySelector('.league-nav-track');
		if (here && track) track.scrollLeft = here.offsetLeft - (track.clientWidth - here.offsetWidth) / 2;
	}

	// Show a tab's panel, starting its script the first time. push: put it in
	// the address (a tap). tab: the pill item tapped, for the dots.
	function open(key, { push = false, tab = null } = {}) {
		const target = document.querySelector(`.tournament-panel[data-tab="${key}"]`);
		if (!target) { TDC.error(AREA, `this page has no "${key}" tab.`); return; }
		if (push && key !== current) {
			const u = new URL(location.href);
			if (key === 'draw') u.searchParams.delete('tab'); else u.searchParams.set('tab', key);
			history.pushState({ tab: key }, '', u);
		}
		const was = current;
		current = key;
		for (const p of panels()) p.hidden = p !== target;
		document.title = (target.dataset.title || 'Tournament') + ' — The Dive Club';
		mark(key);

		let call = null;
		const before = typeof TDCNet !== 'undefined' ? TDCNet.started : 0;
		const first = !started.has(key);
		if (!first) {
			// Shown again: read again in place, so a change made on another
			// tab (a setting saved, an entrant added) shows here.
			const refresh = refreshers.get(key);
			if (refresh && key !== was) {
				try { refresh(); }
				catch (err) { TDC.error(AREA, `the "${key}" tab could not be read again.`, err, target.querySelector('.status')); }
			}
		} else {
			started.add(key);
			// Opened after the page has loaded: the screen over this tab alone
			// (UV, 5 Nov), up before its script starts so the holds the script
			// makes join it. Opened with the page, the page's own screen is up.
			if (typeof TDCLoader !== 'undefined' && !TDCLoader.up) TDCLoader.cover(target, `the ${target.dataset.title || key} tab`);
			const start = starts.get(key);
			if (!start) {
				TDC.error(AREA, `the "${key}" tab has no script.`, null, target.querySelector('.status'));
			} else {
				try {
					const got = start();
					if (got && typeof got.refresh === 'function') refreshers.set(key, got.refresh);
				} catch (err) { TDC.error(AREA, `the "${key}" tab could not start.`, err, target.querySelector('.status')); }
			}
		}
		if (typeof TDCNet !== 'undefined' && TDCNet.started > before) call = TDCNet.quiet();
		if (call && first && typeof TDCLoader !== 'undefined') TDCLoader.hold(call, `the ${target.dataset.title || key} tab`);
		// The dots trace the tab's pill while its load runs (at least
		// DOTS_MIN), unless a loading screen is over the tab: its diver
		// shows that.
		const covered = typeof TDCLoader !== 'undefined' && TDCLoader.covers(target);
		if (tab && !covered && typeof TDCDots !== 'undefined') {
			const least = new Promise((r) => setTimeout(r, DOTS_MIN));
			TDCDots.serve(tab, call ? Promise.all([call, least]) : least, { trace: 'tab', status: target.querySelector('.status') });
		}
	}

	async function show(tournamentId) {
		const nav = document.getElementById('tournament-nav');
		if (!nav) return;
		if (!tournamentId) { nav.hidden = true; return; }

		// Who runs it: the same private helper the writes ask
		// (tdc_may_run_tournament), so the bar and the database cannot
		// disagree. The poster: offered to anybody else only once shared.
		const [run, poster] = await Promise.all([
			supabaseClient.rpc('tdc_may_run_tournament', { p_tournament_id: tournamentId }),
			supabaseClient.rpc('tdc_tournament_poster', { p_tournament_id: tournamentId })
		]);
		if (run.error) { TDC.showSupabaseError(AREA, run.error, document.getElementById('page-status')); return; }
		if (poster.error) TDC.showSupabaseError(AREA, poster.error, document.getElementById('page-status'));
		const iRunIt = run.data === true;
		const posterRow = Array.isArray(poster.data) ? poster.data[0] : poster.data;

		const t = encodeURIComponent(tournamentId);
		const track = document.createElement('div');
		track.className = 'league-nav-track scroll-x';
		for (const [key, label, runners] of TABS) {
			if (runners && !iRunIt) continue;
			const item = document.createElement('button');
			item.type = 'button';
			item.className = 'league-nav-item';
			item.dataset.tab = key;
			item.textContent = label;
			track.append(item);
		}
		if (iRunIt || posterRow) {
			const item = document.createElement('a');
			item.className = 'league-nav-item';
			item.href = posterUrl(t);
			item.textContent = 'Poster';
			track.append(item);
		}
		nav.replaceChildren(track);
		nav.setAttribute('aria-label', 'This tournament’s pages');
		nav.hidden = false;
		mark(current);

		// A tab for the people running it, opened by somebody who does not:
		// the draw instead (the panel refuses them anyway).
		if (!iRunIt && TABS.some(([k, , runners]) => k === current && runners)) open('draw', { push: false });
	}

	document.addEventListener('click', (e) => {
		const item = e.target.closest('#tournament-nav button[data-tab]');
		if (!item) return;
		open(item.dataset.tab, { push: true, tab: item });
	});

	// Back and forward between tabs.
	window.addEventListener('popstate', () => { if (panels().length) open(tabInAddress()); });

	document.addEventListener('DOMContentLoaded', () => {
		if (panels().length) open(tabInAddress());
		const bar = show(new URLSearchParams(location.search).get('t'));
		if (typeof TDCLoader !== 'undefined') TDCLoader.hold(bar, 'the tournament’s tabs');
	});

	return { show, panel, open };
})();
