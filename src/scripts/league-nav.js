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
// The tabs only the people running the league can use (Run it, Settings,
// New season) are offered to them alone: tdc_league_season_info says who
// they are, and each of those panels refuses anybody else anyway.
//
// Needs: tdc.js, supabaseClient.js; dots.js for the switch.

const TDCLeagueNav = (() => {
	const AREA = 'League pages';

	// [key, label, only for the people running it]
	const TABS = [
		['season', 'Season', false],
		['fixtures', 'Fixtures', false],
		['manage', 'Run it', true],
		['settings', 'Settings', true]
	];
	const tabUrl = (s, key) => '/leagues/season/?s=' + s + (key === 'season' ? '' : '&tab=' + key);
	const newSeasonUrl = (info) => '/leagues/new/?l=' + encodeURIComponent(info.league_id);

	const starts = new Map();    // key -> the panel's start(), registered as its script loads
	const started = new Set();
	const refreshers = new Map(); // key -> what start() returned to read the tab again (29 Oct)
	let current = null;
	const DOTS_MIN = 200;        // ms, as every control (tdc-controls.js)

	const panels = () => [...document.querySelectorAll('.league-panel')];
	const tabbed = () => panels().length > 0;
	const known = (key) => TABS.some(([k]) => k === key);
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
		const nav = document.getElementById('league-nav');
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
		const target = document.querySelector(`.league-panel[data-tab="${key}"]`);
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
		if (started.has(key)) {
			// Shown again: read again in place (item 13), the changed text
			// fading. Settings returns none, so a half-made change is kept.
			const refresh = refreshers.get(key);
			if (refresh && key !== was) {
				try { refresh(); }
				catch (err) { TDC.error(AREA, `the "${key}" tab could not be read again.`, err, target.querySelector('.status')); }
			}
		} else {
			started.add(key);
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
		// The dots trace the tab's pill while its first load runs (at least
		// DOTS_MIN, so a tab already open still gets them, UV 28 Oct).
		if (tab && typeof TDCDots !== 'undefined') {
			const least = new Promise((r) => setTimeout(r, DOTS_MIN));
			TDCDots.serve(tab, call ? Promise.all([call, least]) : least, { trace: 'tab', status: target.querySelector('.status') });
		}
	}

	async function show(seasonId) {
		const nav = document.getElementById('league-nav');
		if (!nav) return;
		if (!seasonId) { nav.hidden = true; return; }

		const { data, error } = await supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId });
		if (error) { TDC.showSupabaseError(AREA, error, document.getElementById('page-status')); return; }
		const info = (data || [])[0];
		if (!info) { nav.hidden = true; return; }   // the page itself says the season is not there

		const s = encodeURIComponent(seasonId);
		const tabs = tabbed();
		const track = document.createElement('div');
		track.className = 'league-nav-track scroll-x';
		for (const [key, label, runners] of TABS) {
			if (runners && !info.i_run_it) continue;
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
		if (info.i_run_it) {
			const item = document.createElement('a');
			item.className = 'league-nav-item';
			item.href = newSeasonUrl(info);
			item.textContent = 'New season';
			track.append(item);
		}
		nav.replaceChildren(track);
		nav.setAttribute('aria-label', 'This league’s pages');
		nav.hidden = false;
		if (tabs) mark(current); else mark(nav.dataset.page);
	}

	document.addEventListener('click', (e) => {
		const item = e.target.closest('#league-nav button[data-tab]');
		if (!item) return;
		open(item.dataset.tab, { push: true, tab: item });
	});

	// Back and forward between tabs.
	window.addEventListener('popstate', () => { if (tabbed()) open(tabInAddress()); });

	document.addEventListener('DOMContentLoaded', () => {
		if (tabbed()) open(tabInAddress());
		const nav = document.getElementById('league-nav');
		if (!nav || nav.dataset.auto === 'no') return;
		show(new URLSearchParams(location.search).get('s'));
	});

	return { show, panel, open };
})();
