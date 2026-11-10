// The league pages' own navigation (UV, 24 Oct): every page of a league
// season in one horizontal pill at the top of the page, the current one in
// the green pill, as a select pill shows its choice. All leagues is not in
// it: the site's own menu has that (UV, 24 Oct).
//
// Since 29 Oct (UV) Season, Fixtures, Run it and Settings are one page,
// /leagues/season/?s=<league season id>, and the pill's items are real tabs:
// a tap shows that tab's panel in place, with the dots on the tab while it
// loads, and puts &tab=<key> in the address without leaving the page, so a
// reload or a shared link opens the same tab and Back steps between tabs.
// The old addresses (/leagues/fixtures/, /manage/, /settings/) forward here.
// New season is still a link: it is a form for another season, not a view
// of this one.
//
// A panel is <div class="league-panel" data-tab="<key>" data-title="<title>">
// and its script registers with TDCLeagueNav.panel(key, start). start() runs
// the first time the tab is opened, not at page load: a player never starts
// Run it or Settings, and the page does not read four pages' data at once.
// A tab opened again is shown as it was left.
//
// On a page with no panels (the card) the items are links to the tabs. That
// page learns its season late (opened by match), so it puts data-auto="no"
// on the bar and calls TDCLeagueNav.show(seasonId).
//
// The tabs only the people running the league can use (Run it, Schedule,
// Settings, New season) are offered to them alone, in a second pill under the
// first (UV, 10 Nov): tdc_league_season_info says who they are, and each of
// those panels refuses anybody else anyway. The first pill is the league as a
// player sees it, for them too, so a director can show it to somebody on their
// phone. Schedule is the Fixtures panel with its director's controls on, and
// managing() is how a panel shared that way knows which it is being.
//
// The tab the page opens on, and the bar itself, hold the loading screen
// until they have read (loader.js, 29 Oct); a tab opened later gets a screen
// over that tab alone until it has (UV, 5 Nov; from 29 Oct the page's whole
// screen came back). A tab shown again is already drawn and reads again in
// place, with no screen.
//
// Needs: tdc.js, supabaseClient.js; dots.js for the switch; loader.js.

const TDCLeagueNav = (() => {
	const AREA = 'League pages';

	// [key, label, only for the people running it, the panel if not its own]
	const TABS = [
		['season', 'Season', false],
		['fixtures', 'Fixtures', false],
		['standings', 'Standings', false],
		['rules', 'Rules', false],
		['manage', 'Run it', true],
		['schedule', 'Schedule', true, 'fixtures'],
		['settings', 'Settings', true]
	];
	const tabOf = (key) => TABS.find(([k]) => k === key);
	const panelOf = (key) => (tabOf(key) && tabOf(key)[3]) || key;
	const tabUrl = (s, key) => '/leagues/season/?s=' + s + (key === 'season' ? '' : '&tab=' + key);
	const newSeasonUrl = (info) => '/leagues/new/?l=' + encodeURIComponent(info.league_id);

	const starts = new Map();    // key -> the panel's start(), registered as its script loads
	const started = new Set();
	const refreshers = new Map(); // key -> what start() returned to read the tab again (29 Oct)
	let current = null;
	const DOTS_MIN = 200;        // ms, as every control (tdc-controls.js)

	const panels = () => [...document.querySelectorAll('.league-panel')];
	const tabbed = () => panels().length > 0;
	const known = (key) => !!tabOf(key);
	// Whether the tab showing is one of the second pill's.
	const managing = () => !!(tabOf(current) && tabOf(current)[2]);
	const tabInAddress = () => {
		const t = new URLSearchParams(location.search).get('tab');
		return known(t) ? t : 'season';
	};

	function panel(key, start) {
		if (starts.has(key)) TDC.error(AREA, `two scripts registered the "${key}" tab.`);
		starts.set(key, start);
	}

	// The tab in the green pill, wherever the bar has got to drawing.
	function mark(key) {
		for (const nav of document.querySelectorAll('#league-nav, #league-nav-admin')) {
			for (const item of nav.querySelectorAll('[data-tab]')) {
				if (item.dataset.tab === key) item.setAttribute('aria-current', 'page');
				else item.removeAttribute('aria-current');
			}
			const here = nav.querySelector('[aria-current]');
			const track = nav.querySelector('.league-nav-track');
			if (here && track) track.scrollLeft = here.offsetLeft - (track.clientWidth - here.offsetWidth) / 2;
		}
	}

	// Show a tab's panel, starting its script the first time. push: put it in
	// the address (a tap). tab: the pill item tapped, for the dots.
	function open(key, { push = false, tab = null } = {}) {
		const shown = panelOf(key);
		const target = document.querySelector(`.league-panel[data-tab="${shown}"]`);
		if (!target) { TDC.error(AREA, `this page has no "${key}" tab.`); return; }
		if (push && key !== current) {
			const u = new URL(location.href);
			if (key === 'season') u.searchParams.delete('tab'); else u.searchParams.set('tab', key);
			history.pushState({ tab: key }, '', u);
		}
		const was = current;
		current = key;
		for (const p of panels()) p.hidden = p !== target;
		document.title = (target.dataset.title || 'League') + ' — The Dive Club';
		mark(key);

		let call = null;
		const before = typeof TDCNet !== 'undefined' ? TDCNet.started : 0;
		const first = !started.has(shown);
		if (!first) {
			// Shown again: read again in place (item 13), the changed text
			// fading. Settings returns none, so a half-made change is kept.
			const refresh = refreshers.get(shown);
			if (refresh && key !== was) {
				try { refresh(); }
				catch (err) { TDC.error(AREA, `the "${key}" tab could not be read again.`, err, target.querySelector('.status')); }
			}
		} else {
			started.add(shown);
			// Opened after the page has loaded: the screen over this tab
			// alone (UV, 5 Nov), up before its script starts so the holds
			// the script makes join it. Opened with the page, the page's own
			// screen is up and covers it.
			if (typeof TDCLoader !== 'undefined' && !TDCLoader.up) TDCLoader.cover(target, `the ${target.dataset.title || key} tab`);
			const start = starts.get(shown);
			if (!start) {
				TDC.error(AREA, `the "${key}" tab has no script.`, null, target.querySelector('.status'));
			} else {
				try {
					const got = start();
					if (got && typeof got.refresh === 'function') refreshers.set(shown, got.refresh);
				} catch (err) { TDC.error(AREA, `the "${key}" tab could not start.`, err, target.querySelector('.status')); }
			}
		}
		if (typeof TDCNet !== 'undefined' && TDCNet.started > before) call = TDCNet.quiet();
		// A tab that reads holds the loading screen until it has read
		// (loader.js): the page's, for the tab the page opens on; the tab's
		// own cover, for one opened later (UV, 5 Nov; until then the page's
		// screen came back over everything). Shown again, it is drawn
		// already and reads in place: no screen.
		if (call && first && typeof TDCLoader !== 'undefined') TDCLoader.hold(call, `the ${target.dataset.title || key} tab`);
		// The dots trace the tab's pill while its load runs (at least
		// DOTS_MIN, so a tab already open still gets them, UV 28 Oct), unless
		// a loading screen is over the tab: its diver shows that.
		const covered = typeof TDCLoader !== 'undefined' && TDCLoader.covers(target);
		if (tab && !covered && typeof TDCDots !== 'undefined') {
			const least = new Promise((r) => setTimeout(r, DOTS_MIN));
			TDCDots.serve(tab, call ? Promise.all([call, least]) : least, { trace: 'tab', status: target.querySelector('.status') });
		}
	}

	async function show(seasonId) {
		const nav = document.getElementById('league-nav');
		if (!nav) return;
		if (!seasonId) { nav.hidden = true; return; }

		// Signed out (UV, 10 Nov): the three tabs anybody is shown, and nothing
		// read; each tab says for itself whether that visitor may see it.
		let info = { i_run_it: false };
		if (await TDC.getSession(AREA)) {
			const { data, error } = await supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId });
			if (error) { TDC.showSupabaseError(AREA, error, document.getElementById('page-status')); return; }
			info = (data || [])[0];
			if (!info) { nav.hidden = true; return; }   // the page itself says the season is not there
		}

		const s = encodeURIComponent(seasonId);
		const tabs = tabbed();
		const pill = (forRunners) => {
			const track = document.createElement('div');
			track.className = 'league-nav-track scroll-x';
			for (const [key, label, runners] of TABS) {
				if (runners !== forRunners) continue;
				let item;
				if (tabs) {
					item = document.createElement('button');
					item.type = 'button';
				} else {
					item = document.createElement('a');
					item.href = tabUrl(s, key);
				}
				item.className = 'league-nav-item';
				item.dataset.tab = key;
				item.textContent = label;
				track.append(item);
			}
			return track;
		};
		nav.replaceChildren(pill(false));
		nav.setAttribute('aria-label', 'This league’s pages');
		nav.hidden = false;

		const admin = document.getElementById('league-nav-admin');
		if (admin && info.i_run_it) {
			const track = pill(true);
			const item = document.createElement('a');
			item.className = 'league-nav-item';
			item.href = newSeasonUrl(info);
			item.textContent = 'New season';
			track.append(item);
			admin.replaceChildren(track);
			admin.setAttribute('aria-label', 'Running this league');
			admin.hidden = false;
		}
		if (tabs) mark(current); else mark(nav.dataset.page);

		// Schedule in the address for somebody who does not run it: Fixtures.
		if (tabs && !info.i_run_it && current === 'schedule') open('fixtures');
	}

	document.addEventListener('click', (e) => {
		const item = e.target.closest('#league-nav button[data-tab], #league-nav-admin button[data-tab]');
		if (!item) return;
		open(item.dataset.tab, { push: true, tab: item });
	});

	// Back and forward between tabs.
	window.addEventListener('popstate', () => { if (tabbed()) open(tabInAddress()); });

	document.addEventListener('DOMContentLoaded', () => {
		if (tabbed()) open(tabInAddress());
		const nav = document.getElementById('league-nav');
		if (!nav || nav.dataset.auto === 'no') return;
		const bar = show(new URLSearchParams(location.search).get('s'));
		if (typeof TDCLoader !== 'undefined') TDCLoader.hold(bar, 'the league’s tabs');
	});

	return { show, panel, open, managing };
})();
