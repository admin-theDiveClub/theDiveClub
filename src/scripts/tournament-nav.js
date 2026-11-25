// A tournament's pages as tabs (UV, 5 Nov), as a league season's are
// (league-nav.js, whose sibling this is: the same bar, the same way of
// opening a tab, the same loading screens; keep the two in step).
//
// Since 24 Nov (UV) Manage's menu is nine pages in three headed groups (TABS);
// see docs/systems/tournaments.md, "The admin pages, one job each".
//
// One page, /tournaments/bracket/?t=<tournament id>&tab=<rules|history|generate|run|entrants|officials|settings|format|entries|match-rules|poster-settings|next>:
// Draw and Rules (everybody, as a player sees them) in the first pill; Run the draw, Entrants
// and Settings (the people running it) in a second pill under it (UV, 10 Nov).
// Run the draw is the Draw panel with its director's controls on, and managing()
// is how that panel knows which it is being. Each is a
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
// The bottom bar (UV, 24 Nov; docs/ui-list.md item 3), as a league's: Poster,
// Draw and Rules, an icon over each word, in a bar fixed to the foot of the
// screen, on the draw page and on the poster; for whoever runs it, Manage (the
// sliders) opens a menu of Run the draw, Entrants and Settings, and the two
// top pills are hidden. The bar's look is league.css's (.league-tabbar). On the
// poster the items are links, the Poster marked, and it loads this script for
// the bar alone. Signed out (the poster), the bar shows: Draw and Rules are on
// the draw page, which asks them to sign in and brings them back. A poster
// that shows "Nothing here" shows no bar either, so the bar never tells a
// stranger the tournament exists.
//
// The tab the page opens on, and the bar, hold the page's loading screen
// (loader.js); a tab opened later gets a screen over that tab alone. A tab
// shown again is drawn already and reads again in place, with no screen.
//
// A recurring tournament (UV, 25 Nov; migration 20261125130921) also has
// History in the bar, for anybody signed in, and Next tournament at the foot of
// Manage's Settings group; neither shows on one that is not recurring, and
// History not to a signed-out visitor. show() asks again when Recurring is
// switched on Details.
//
// Needs: tdc.js, supabaseClient.js; dots.js for the switch; loader.js;
// ring-status.js for the bar's icons; league.css for the bar's look.

const TDCTournamentNav = (() => {
	const AREA = 'Tournament pages';

	// [key, label, only for the people running it, the panel if not its own,
	//  the panel's data-part sections it shows (null: all), its heading in Manage's menu]
	// The admin pages split so each job is a page of its own, easy to reach on
	// a phone (UV, 24 Nov): several share one panel and show their part of it,
	// the panel's script unchanged. 'settings' is the key Details keeps, so
	// every old &tab=settings link still opens.
	const TABS = [
		['draw', 'Draw', false],
		['rules', 'Rules', false],
		// A recurring tournament's earlier nights (UV, 25 Nov).
		['history', 'History', false],
		['generate', 'Generate the draw', true, 'draw', null, 'Draw'],
		['run', 'Run the draw', true, 'draw', null, 'Draw'],
		['entrants', 'Entrants', true, null, ['entrants'], 'People'],
		['officials', 'Who runs it', true, 'entrants', ['officials'], 'People'],
		['settings', 'Details', true, null, ['details'], 'Settings'],
		['format', 'Format', true, 'settings', ['format'], 'Settings'],
		['entries', 'Entries', true, 'settings', ['entries'], 'Settings'],
		['match-rules', 'Match rules', true, 'settings', ['rules'], 'Settings'],
		// Everything about the poster, and the text for a designer (UV, 24 Nov).
		['poster-settings', 'Poster settings', true, null, null, 'Settings'],
		// The next one of a recurring tournament, as a league's New season ends
		// its Settings (UV, 25 Nov).
		['next', 'Next tournament', true, null, null, 'Settings']
	];
	// Shown only on a recurring tournament.
	const RECURRING_ONLY = new Set(['history', 'next']);
	let recurring = false;
	const offered = (key) => !RECURRING_ONLY.has(key) || recurring;
	// The bottom bar's icon for each (UV, 24 Nov), and its order: the Poster first.
	const ICON = { poster: 'megaphone', draw: 'bracket', rules: 'document', history: 'history' };
	const BAR = [['poster', 'Poster'], ['draw', 'Draw'], ['rules', 'Rules'], ['history', 'History']];
	const tabOf = (key) => TABS.find(([k]) => k === key);
	const panelOf = (key) => (tabOf(key) && tabOf(key)[3]) || key;
	const posterUrl = (t) => '/tournaments/poster/?t=' + t;
	const tabUrl = (t, key) => '/tournaments/bracket/?t=' + t + (key === 'draw' ? '' : '&tab=' + key);
	// The poster page has no panels: there the bar's items are links.
	const onPoster = () => location.pathname.startsWith('/tournaments/poster/');

	const starts = new Map();     // key -> the panel's start(), registered as its script loads
	const started = new Set();
	const refreshers = new Map(); // key -> what start() returned to read the tab again
	let current = null;
	const DOTS_MIN = 200;         // ms, as every control (tdc-controls.js)

	const panels = () => [...document.querySelectorAll('.tournament-panel')];
	const known = (key) => !!tabOf(key);
	// Whether the tab showing is one of the second pill's.
	const managing = () => !!(tabOf(current) && tabOf(current)[2]);
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
		for (const nav of document.querySelectorAll('#tournament-nav, #tournament-nav-admin, #tournament-tabbar')) {
			for (const item of nav.querySelectorAll('[data-tab]')) {
				if (item.dataset.tab === key) item.setAttribute('aria-current', 'page');
				else item.removeAttribute('aria-current');
			}
			// The bottom bar's Manage stands for the second pill's pages, as a league's.
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
		const target = document.querySelector(`.tournament-panel[data-tab="${shown}"]`);
		if (!target) { TDC.error(AREA, `this page has no "${key}" tab.`); return; }
		if (push && key !== current) {
			const u = new URL(location.href);
			if (key === 'draw') u.searchParams.delete('tab'); else u.searchParams.set('tab', key);
			history.pushState({ tab: key }, '', u);
		}
		const was = current;
		current = key;
		for (const p of panels()) p.hidden = p !== target;
		const [, label, runners, , parts] = tabOf(key);
		// This page's parts of a shared panel; the rest are other pages'.
		for (const part of target.querySelectorAll('[data-part]')) {
			part.classList.toggle('tab-off', !!parts && !parts.includes(part.dataset.part));
		}
		for (const head of target.querySelectorAll('[data-tab-head]')) head.textContent = label;
		document.title = (runners ? label : (target.dataset.title || 'Tournament')) + ' — The Dive Club';
		mark(key);

		let call = null;
		const before = typeof TDCNet !== 'undefined' ? TDCNet.started : 0;
		const first = !started.has(shown);
		if (!first) {
			// Shown again: read again in place, so a change made on another
			// tab (a setting saved, an entrant added) shows here.
			const refresh = refreshers.get(shown);
			if (refresh && key !== was) {
				try { refresh(); }
				catch (err) { TDC.error(AREA, `the "${key}" tab could not be read again.`, err, target.querySelector('.status')); }
			}
		} else {
			started.add(shown);
			// Opened after the page has loaded: the screen over this tab alone
			// (UV, 5 Nov), up before its script starts so the holds the script
			// makes join it. Opened with the page, the page's own screen is up.
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
		if (!nav && !onPoster()) return;
		if (!tournamentId) { if (nav) nav.hidden = true; hideBar(); return; }

		// Who runs it: the same private helper the writes ask
		// (tdc_may_run_tournament), so the bar and the database cannot
		// disagree; nobody, signed out (the poster). The poster: offered to
		// anybody else only once shared.
		const signedIn = !!(await TDC.getSession(AREA));
		// Whether it is recurring: signed out, never asked (History is not
		// offered to a stranger).
		const [run, poster, row] = await Promise.all([
			signedIn ? supabaseClient.rpc('tdc_may_run_tournament', { p_tournament_id: tournamentId }) : { data: false },
			supabaseClient.rpc('tdc_tournament_poster', { p_tournament_id: tournamentId }),
			signedIn ? supabaseClient.from('tbl_tournaments').select('is_recurring').eq('id', tournamentId).maybeSingle() : { data: null }
		]);
		if (run.error) { TDC.showSupabaseError(AREA, run.error, document.getElementById('page-status')); return; }
		if (poster.error) TDC.showSupabaseError(AREA, poster.error, document.getElementById('page-status'));
		if (row.error) TDC.showSupabaseError(AREA, row.error, document.getElementById('page-status'));
		recurring = !!(row.data && row.data.is_recurring);
		const iRunIt = run.data === true;
		const posterRow = Array.isArray(poster.data) ? poster.data[0] : poster.data;

		const t = encodeURIComponent(tournamentId);
		// The poster page showing "Nothing here": no bar either.
		if (onPoster() && !posterRow) { hideBar(); return; }
		bottomBar(t, iRunIt, iRunIt || !!posterRow);
		if (!nav) { mark('poster'); return; }
		const pill = (forRunners) => {
			const track = document.createElement('div');
			track.className = 'league-nav-track scroll-x';
			for (const [key, label, runners] of TABS) {
				if (runners !== forRunners || !offered(key)) continue;
				const item = document.createElement('button');
				item.type = 'button';
				item.className = 'league-nav-item';
				item.dataset.tab = key;
				item.textContent = label;
				track.append(item);
			}
			return track;
		};
		const track = pill(false);
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

		const admin = document.getElementById('tournament-nav-admin');
		if (admin && iRunIt) {
			admin.replaceChildren(pill(true));
			admin.setAttribute('aria-label', 'Running this tournament');
			admin.hidden = false;
		}
		mark(current);

		// A tab for the people running it, opened by somebody who does not:
		// the draw instead (the panel refuses them anyway).
		if (!iRunIt && TABS.some(([k, , runners]) => k === current && runners)) open('draw', { push: false });
	}

	// ─── The bottom bar (UV, 24 Nov), copied from league-nav.js's ───
	// The league's without its match pill. The body's own child, so the card
	// cannot clip it; it slides away and back with the site's bar (league.css).
	function icon(face, name, label) {
		// Shown already drawn: a page load draws nothing in (UV, 16 Nov).
		try {
			face.innerHTML = TDCRing.svg();
			new TDCRing.RingStatus(face, { icons: [name], labels: { [name]: label, empty: label, loading: 'Working' }, initial: name });
		} catch (err) {
			TDC.error(AREA, 'the bottom bar’s icon for ' + label + ' could not be drawn.', err);
		}
	}
	function tabItem(t, key, label, className) {
		// A tab switches in place on the draw page; the Poster, and everything
		// on the poster page, is a link.
		let item;
		if (key !== 'poster' && !onPoster()) {
			item = document.createElement('button');
			item.type = 'button';
		} else {
			item = document.createElement('a');
			item.href = key === 'poster' ? posterUrl(t) : tabUrl(t, key);
		}
		item.className = className;
		item.dataset.tab = key;
		return item;
	}
	function setMenu(bar, open) {
		const menu = bar.querySelector('#tournament-tabmenu');
		const btn = bar.querySelector('.league-tab-admin');
		if (!menu || !btn) return;
		menu.classList.toggle('is-open', open);
		btn.setAttribute('aria-expanded', open ? 'true' : 'false');
	}
	const menuOpen = (bar) => !!bar.querySelector('#tournament-tabmenu.is-open');
	function bottomBar(t, iRunIt, posterShown) {
		let bar = document.getElementById('tournament-tabbar');
		if (!bar) {
			bar = document.createElement('nav');
			bar.id = 'tournament-tabbar';
			bar.className = 'league-tabbar';
			bar.setAttribute('aria-label', 'This tournament’s pages');
			document.body.append(bar);
		}
		const track = document.createElement('div');
		track.className = 'league-nav-track';
		let count = 0;
		for (const [key, label] of BAR) {
			if (key === 'poster' && !posterShown) continue;
			if (!offered(key)) continue;
			const item = tabItem(t, key, label, 'league-nav-item league-tab');
			const face = document.createElement('span');
			face.className = 'tdc-ring league-tab-icon';
			const word = document.createElement('span');
			word.className = 'league-tab-word';
			word.textContent = label;
			item.append(face, word);
			icon(face, ICON[key], label);
			track.append(item);
			count++;
		}
		const parts = [track];
		if (iRunIt) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'league-nav-item league-tab league-tab-admin';
			btn.setAttribute('aria-haspopup', 'true');
			btn.setAttribute('aria-expanded', 'false');
			btn.setAttribute('aria-controls', 'tournament-tabmenu');
			const face = document.createElement('span');
			face.className = 'tdc-ring league-tab-icon';
			const word = document.createElement('span');
			word.className = 'league-tab-word';
			word.textContent = 'Manage';
			btn.append(face, word);
			icon(face, 'sliders', 'Manage');
			track.append(btn);
			// The green line round the tabs, not Manage, as a league's.
			track.classList.add('has-admin');
			track.style.setProperty('--tabbar-items', String(count + 1));

			const menu = document.createElement('div');
			menu.className = 'league-tabmenu';
			menu.id = 'tournament-tabmenu';
			let group = null;
			for (const [key, label, runners, , , heading] of TABS) {
				if (!runners || !offered(key)) continue;
				// A heading over each group (UV, 24 Nov).
				if (heading && heading !== group) {
					const head = document.createElement('div');
					head.className = 'league-tabmenu-head';
					head.textContent = heading;
					menu.append(head);
					group = heading;
				}
				const item = tabItem(t, key, label, 'league-tabmenu-item');
				item.textContent = label;
				menu.append(item);
			}
			parts.push(menu);
		}
		bar.replaceChildren(...parts);
		bar.hidden = false;
		document.body.classList.add('has-league-tabbar');
		document.body.classList.toggle('has-league-tabmenu', iRunIt);
	}
	function hideBar() {
		const bar = document.getElementById('tournament-tabbar');
		if (bar) bar.hidden = true;
		document.body.classList.remove('has-league-tabbar', 'has-league-tabmenu');
	}

	document.addEventListener('click', (e) => {
		const bar = document.getElementById('tournament-tabbar');
		// Manage opens and shuts its menu; any other tap shuts it.
		if (bar) {
			const was = menuOpen(bar);
			if (e.target.closest('#tournament-tabbar .league-tab-admin')) { setMenu(bar, !was); return; }
			if (was) setMenu(bar, false);
		}
		const item = e.target.closest('#tournament-nav button[data-tab], #tournament-nav-admin button[data-tab], #tournament-tabbar button[data-tab]');
		if (!item) return;
		// A page chosen in the menu: the dots on Manage, as the menu has shut.
		const fromMenu = item.closest('.league-tabmenu');
		open(item.dataset.tab, { push: true, tab: fromMenu ? bar.querySelector('.league-tab-admin') : item });
	});
	document.addEventListener('keydown', (e) => {
		const bar = document.getElementById('tournament-tabbar');
		if (e.key !== 'Escape' || !bar || !menuOpen(bar)) return;
		setMenu(bar, false);
		bar.querySelector('.league-tab-admin').focus();
	});
	// Scrolling shuts it, so it never rides away with the bar.
	window.addEventListener('scroll', () => {
		const bar = document.getElementById('tournament-tabbar');
		if (bar && menuOpen(bar)) setMenu(bar, false);
	}, { passive: true });

	// Back and forward between tabs.
	window.addEventListener('popstate', () => { if (panels().length) open(tabInAddress()); });

	document.addEventListener('DOMContentLoaded', () => {
		if (panels().length) open(tabInAddress());
		const bar = show(new URLSearchParams(location.search).get('t'));
		if (typeof TDCLoader !== 'undefined') TDCLoader.hold(bar, 'the tournament’s tabs');
	});

	// tab(): the page showing, for a panel two pages share (tournament-bracket.js).
	return { show, panel, open, managing, tab: () => current };
})();
