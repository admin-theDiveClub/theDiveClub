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
		['standings', 'Standings', false],
		['fixtures', 'Fixtures', false],
		['season', 'Season', false],
		['rules', 'Rules', false],
		['manage', 'Run it', true],
		['schedule', 'Schedule', true, 'fixtures'],
		['settings', 'Settings', true]
	];
	// The bottom bar's icon for each of the first pill's tabs (UV, 18 Nov).
	const ICON = { standings: 'podium', fixtures: 'calendar', season: 'shield', rules: 'document' };
	const tabOf = (key) => TABS.find(([k]) => k === key);
	const panelOf = (key) => (tabOf(key) && tabOf(key)[3]) || key;
	// The tab the page opens on with no &tab= in the address (UV, 18 Nov:
	// Standings, first in the pill; until then Season). An address with
	// &team= is a team's link on the Season tab, so it opens Season.
	const DEFAULT_TAB = 'standings';
	const tabUrl = (s, key) => '/leagues/season/?s=' + s + (key === DEFAULT_TAB ? '' : '&tab=' + key);
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
		const q = new URLSearchParams(location.search);
		const t = q.get('tab');
		return known(t) ? t : (q.has('team') ? 'season' : DEFAULT_TAB);
	};

	function panel(key, start) {
		if (starts.has(key)) TDC.error(AREA, `two scripts registered the "${key}" tab.`);
		starts.set(key, start);
	}

	// The tab in the green pill, wherever the bar has got to drawing.
	function mark(key) {
		for (const nav of document.querySelectorAll('#league-nav, #league-nav-admin, #league-tabbar')) {
			for (const item of nav.querySelectorAll('[data-tab]')) {
				if (item.dataset.tab === key) item.setAttribute('aria-current', 'page');
				else item.removeAttribute('aria-current');
			}
			// The bottom bar's Manage stands for the second pill's pages (UV, 18 Nov).
			const admin = nav.querySelector('.league-tab-admin');
			if (admin) {
				if (tabOf(key) && tabOf(key)[2]) admin.setAttribute('aria-current', 'page');
				else admin.removeAttribute('aria-current');
			}
			const here = nav.querySelector('.league-nav-track [aria-current]');
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
			if (key === DEFAULT_TAB) u.searchParams.delete('tab'); else u.searchParams.set('tab', key);
			if (key !== 'season') u.searchParams.delete('team');
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
		if (!seasonId) { nav.hidden = true; hideBar(); return; }

		// Signed out (UV, 10 Nov): the three tabs anybody is shown, and nothing
		// read; each tab says for itself whether that visitor may see it.
		let info = { i_run_it: false };
		if (await TDC.getSession(AREA)) {
			const { data, error } = await supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId });
			if (error) { TDC.showSupabaseError(AREA, error, document.getElementById('page-status')); return; }
			info = (data || [])[0];
			if (!info) { nav.hidden = true; hideBar(); return; }   // the page itself says the season is not there
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
		bottomBar(s, tabs, info);

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

	// ─── The bottom bar (UV, 18 Nov) ───
	// On a phone the first pill's tabs (Standings, Fixtures, Season, Rules)
	// are a bar fixed to the foot of the screen, an icon over each word, so a
	// thumb reaches them; the stylesheet hides the top pill there, and the
	// bar above 48rem. The second pill (Run it, Schedule, Settings) stays at
	// the top. The bar is the body's own child, not the card's: a fixed box
	// inside the card could be clipped by it. It slides away and back with
	// the site's bar (nav.js; league.css follows .site-nav.is-hidden). Its
	// items are the pill's: the same tabs, links on the card, the same thumb
	// (tdc-controls.js, by .league-nav-track) and the same clicks.
	//
	// For whoever runs the league (UV, 18 Nov) a fifth button, Manage (the
	// sliders), opens a menu above it with the second pill's pages (Run it,
	// Schedule, Settings, New season), and the second pill is hidden on a
	// phone too. Manage is marked while one of those pages is open; the menu
	// shuts on a choice, a tap elsewhere, Escape or the bar sliding away.
	function icon(face, name, label) {
		// Shown already drawn: a page load draws nothing in (UV, 16 Nov).
		try {
			face.innerHTML = TDCRing.svg();
			new TDCRing.RingStatus(face, { icons: [name], labels: { [name]: label, empty: label, loading: 'Working' }, initial: name });
		} catch (err) {
			TDC.error(AREA, 'the bottom bar’s icon for ' + label + ' could not be drawn.', err);
		}
	}
	// The bar's two menus: Manage's, and the match pill's when more than one
	// match is live. One open at a time.
	const MENUS = { admin: ['#league-tabmenu', '.league-tab-admin'], live: ['#league-livemenu', '.league-livepill'] };
	function setMenu(bar, which, open) {
		const [menuSel, btnSel] = MENUS[which];
		const menu = bar.querySelector(menuSel);
		const btn = bar.querySelector(btnSel);
		if (!menu || !btn) return;
		menu.classList.toggle('is-open', open);
		btn.setAttribute('aria-expanded', open ? 'true' : 'false');
	}
	const openMenu = (bar) => Object.keys(MENUS).find((k) => bar.querySelector(MENUS[k][0] + '.is-open')) || null;
	function shutMenus(bar) { for (const k of Object.keys(MENUS)) setMenu(bar, k, false); }

	// ─── The match pill (UV, 18 Nov) ───
	// While one of your matches in this league is live (the yellow card under
	// the pill shows, live-match.js), a pill sits on the bar's top edge,
	// centred, apart from the tabs: the other side's name in yellow words, or
	// "2 matches" with more than one (UV, 18 Nov). One match: a tap opens
	// it. Two or more: a tap opens a menu, a row per match. It stays when the
	// card's ✕ is pressed; live-match.js hands over its rows once read, and the
	// bar may be drawn before or after, so both draw it.
	let liveRows = [];
	function live(rows) {
		liveRows = rows || [];
		const bar = document.getElementById('league-tabbar');
		if (bar) drawLive(bar);
	}
	function drawLive(bar) {
		for (const old of bar.querySelectorAll('.league-livepill, #league-livemenu')) old.remove();
		if (!liveRows.length || typeof TDCLiveMatch === 'undefined') return;
		const first = liveRows[0];
		const many = liveRows.length > 1;
		const pill = document.createElement(many ? 'button' : 'a');
		pill.className = 'league-livepill';
		if (many) {
			pill.type = 'button';
			pill.setAttribute('aria-haspopup', 'true');
			pill.setAttribute('aria-expanded', 'false');
			pill.setAttribute('aria-controls', 'league-livemenu');
			pill.setAttribute('aria-label', 'Your matches');
		} else {
			pill.href = TDCLiveMatch.href(first);
			pill.setAttribute('aria-label', 'Your match: v ' + first.opponent + ', ' + TDCLiveMatch.waiting(first));
		}
		// The other side's name, in words alone (UV, 18 Nov; it was the
		// clipboard or play icon); with several, how many.
		const text = document.createElement('span');
		text.className = 'league-livepill-text';
		if (many) text.textContent = liveRows.length + ' matches';
		else {
			// Its state before the name (UV, 18 Nov): "Playing: Cheeky Tiger".
			const state = document.createElement('span');
			state.className = 'league-livepill-state';
			state.textContent = (first.state === 'lineups' ? 'Lineups' : 'Playing') + ': ';
			text.append(state, first.opponent);
		}
		pill.append(text);
		bar.append(pill);
		if (!many) return;
		const menu = document.createElement('div');
		menu.className = 'league-tabmenu league-livemenu';
		menu.id = 'league-livemenu';
		for (const m of liveRows) {
			const a = document.createElement('a');
			a.className = 'league-tabmenu-item league-livemenu-item';
			a.href = TDCLiveMatch.href(m);
			const who = document.createElement('span');
			who.textContent = 'v ' + m.opponent;
			const what = document.createElement('span');
			what.className = 'league-livemenu-sub';
			what.textContent = TDCLiveMatch.waiting(m);
			a.append(who, what);
			menu.append(a);
		}
		bar.append(menu);
	}
	function bottomBar(s, tabs, info) {
		let bar = document.getElementById('league-tabbar');
		if (!bar) {
			bar = document.createElement('nav');
			bar.id = 'league-tabbar';
			bar.className = 'league-tabbar';
			bar.setAttribute('aria-label', 'This league’s pages');
			document.body.append(bar);
		}
		const track = document.createElement('div');
		track.className = 'league-nav-track';
		for (const [key, label, runners] of TABS) {
			if (runners) continue;
			let item;
			if (tabs) {
				item = document.createElement('button');
				item.type = 'button';
			} else {
				item = document.createElement('a');
				item.href = tabUrl(s, key);
			}
			item.className = 'league-nav-item league-tab';
			item.dataset.tab = key;
			const face = document.createElement('span');
			face.className = 'tdc-ring league-tab-icon';
			const word = document.createElement('span');
			word.className = 'league-tab-word';
			word.textContent = label;
			item.append(face, word);
			icon(face, ICON[key], label);
			track.append(item);
		}
		const parts = [track];
		if (info && info.i_run_it) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'league-nav-item league-tab league-tab-admin';
			btn.setAttribute('aria-haspopup', 'true');
			btn.setAttribute('aria-expanded', 'false');
			btn.setAttribute('aria-controls', 'league-tabmenu');
			const face = document.createElement('span');
			face.className = 'tdc-ring league-tab-icon';
			const word = document.createElement('span');
			word.className = 'league-tab-word';
			word.textContent = 'Manage';
			btn.append(face, word);
			icon(face, 'sliders', 'Manage');
			track.append(btn);
			// The green line goes round the four tabs, not Manage (UV, 18 Nov).
			track.classList.add('has-admin');

			const menu = document.createElement('div');
			menu.className = 'league-tabmenu';
			menu.id = 'league-tabmenu';
			for (const [key, label, runners] of TABS) {
				if (!runners) continue;
				let item;
				if (tabs) {
					item = document.createElement('button');
					item.type = 'button';
				} else {
					item = document.createElement('a');
					item.href = tabUrl(s, key);
				}
				item.className = 'league-tabmenu-item';
				item.dataset.tab = key;
				item.textContent = label;
				menu.append(item);
			}
			const fresh = document.createElement('a');
			fresh.className = 'league-tabmenu-item';
			fresh.href = newSeasonUrl(info);
			fresh.textContent = 'New season';
			menu.append(fresh);
			parts.push(menu);
		}
		bar.replaceChildren(...parts);
		drawLive(bar);
		bar.hidden = false;
		document.body.classList.add('has-league-tabbar');
		document.body.classList.toggle('has-league-tabmenu', !!(info && info.i_run_it));
	}
	function hideBar() {
		const bar = document.getElementById('league-tabbar');
		if (bar) bar.hidden = true;
		document.body.classList.remove('has-league-tabbar', 'has-league-tabmenu');
	}

	document.addEventListener('click', (e) => {
		const bar = document.getElementById('league-tabbar');
		// Manage and the match pill (with more than one match) open and shut
		// their menus; any other tap shuts whichever is open.
		const toggle = e.target.closest('#league-tabbar .league-tab-admin, #league-tabbar button.league-livepill');
		if (bar) {
			const was = openMenu(bar);
			if (toggle) {
				const which = toggle.classList.contains('league-livepill') ? 'live' : 'admin';
				shutMenus(bar);
				if (was !== which) setMenu(bar, which, true);
				return;
			}
			if (was) shutMenus(bar);
		}
		const item = e.target.closest('#league-nav button[data-tab], #league-nav-admin button[data-tab], #league-tabbar button[data-tab]');
		if (!item) return;
		// A page chosen in the menu: the dots on Manage, as the menu has shut.
		const fromMenu = item.closest('.league-tabmenu');
		open(item.dataset.tab, { push: true, tab: fromMenu ? bar.querySelector('.league-tab-admin') : item });
	});
	document.addEventListener('keydown', (e) => {
		const bar = document.getElementById('league-tabbar');
		const was = e.key === 'Escape' && bar && openMenu(bar);
		if (!was) return;
		shutMenus(bar);
		bar.querySelector(MENUS[was][1]).focus();
	});
	// Scrolling shuts it, so it never rides away with the bar or hangs over
	// a page that has moved on.
	window.addEventListener('scroll', () => {
		const bar = document.getElementById('league-tabbar');
		if (bar && openMenu(bar)) shutMenus(bar);
	}, { passive: true });

	// Back and forward between tabs.
	window.addEventListener('popstate', () => { if (tabbed()) open(tabInAddress()); });

	document.addEventListener('DOMContentLoaded', () => {
		if (tabbed()) open(tabInAddress());
		const nav = document.getElementById('league-nav');
		if (!nav || nav.dataset.auto === 'no') return;
		const bar = show(new URLSearchParams(location.search).get('s'));
		if (typeof TDCLoader !== 'undefined') TDCLoader.hold(bar, 'the league’s tabs');
	});

	return { show, panel, open, managing, live };
})();
