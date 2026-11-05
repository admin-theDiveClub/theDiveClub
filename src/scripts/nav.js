// Shared nav behavior: hamburger menu + login-aware profile menu.
// Every button on the bar is a ring icon (ring-status.js), drawn here.
// Needs: supabaseClient.js, tdc.js, ring-status.js (loaded by layout.html),
// prefs.js (in the head).

(function () {
	const AREA = 'Nav';

	const menuToggle      = document.getElementById('nav-menu-toggle');
	const menu            = document.getElementById('nav-menu');
	const profileBtn      = document.getElementById('nav-profile');
	const account         = document.getElementById('nav-account');
	const profileIcon     = document.getElementById('nav-profile-icon');
	const profileAvatar   = document.getElementById('nav-avatar');

	if (!menuToggle || !menu || !profileBtn || !account || !profileIcon || !profileAvatar) {
		TDC.error(AREA, 'nav is missing expected elements.');
		return;
	}

	// The profile menu's banner and toggles. Not in the required list: if
	// they are missing, the rest of the nav must still work.
	const accountPic     = document.getElementById('nav-account-pic');
	const accountDisplay = document.getElementById('nav-account-display');
	const accountFull    = document.getElementById('nav-account-full');
	const prefTheme      = document.getElementById('nav-pref-theme');
	const prefMotion     = document.getElementById('nav-pref-motion');

	// Notifications. Deliberately not in the required list above: if this part
	// of the nav is missing, the rest of it must still work. Everything below
	// checks before using them.
	const notifyWrap  = document.getElementById('nav-notify-wrap');
	const notifyBtn   = document.getElementById('nav-notify');
	const notifyPip   = document.getElementById('nav-notify-pip');
	const menuPip     = document.getElementById('nav-menu-pip');
	const notifyTray  = document.getElementById('nav-notify-tray');
	const notifyList  = document.getElementById('nav-notify-list');
	const notifyEmpty = document.getElementById('nav-notify-empty');
	const notifyClearAll = document.getElementById('nav-notify-clear-all');

	let loggedIn = false;

	// ─── The diver (UV, 3 Nov) ────────────────────────────────────────
	// The logo is the dive's drawing (scripts/dive.js, cloned from the
	// layout's #tdc-dive-art), which at rest is the logo exactly; the two
	// <img> stay in the HTML and are hidden once it is in. With reduced
	// motion she is the loader in place of the dots: while anything the dots
	// would be out for is waiting (dots.js, 'tdc-dots-waiting'), she dives,
	// drop after drop; when it is all back she falls in once more and rests.
	// Not while the loading screen is up (its own diver is in front), and not
	// for a wait shorter than GRACE, as for the dots. With full motion she
	// never dives: the dots do that job.
	(() => {
		const GRACE = 150;   // ms, as dots.js and loader.js
		const logo = document.querySelector('.nav-logo');
		const art = document.getElementById('tdc-dive-art');
		if (!logo) return;
		if (!art || typeof TDCDive === 'undefined') {
			console.error(`[${AREA}] the dive (dive.js, #tdc-dive-art) is not on this page, so the nav's icon cannot dive.`);
			return;
		}
		const svg = art.content.querySelector('svg.dive').cloneNode(true);
		svg.classList.add('nav-dive');
		logo.append(svg);
		const dive = TDCDive.attach(svg, { frame: 'logo' });
		if (!dive) { svg.remove(); return; }
		for (const img of logo.querySelectorAll('img')) img.hidden = true;

		let timer = 0;
		function update() {
			const want = typeof TDCDots !== 'undefined' && TDCDots.waiting
				&& !(typeof TDCLoader !== 'undefined' && TDCLoader.up);
			if (!want) { clearTimeout(timer); timer = 0; dive.stop(); return; }
			if (dive.loading || timer) return;
			timer = setTimeout(() => { timer = 0; if (TDCDots.waiting && !TDCLoader.up) dive.start(); }, GRACE);
		}
		document.addEventListener('tdc-dots-waiting', update);
		document.addEventListener('tdc-loader', update);
		update();
	})();

	// ─── Ring icons (UV, 24 Oct) ──────────────────────────────────────
	// Every button on the bar is a ring icon (ring-status.js, UV's design):
	// each draws itself in as the page opens, and the menu turns into a cross
	// and back, with no dots: nothing is waited for. A press that waits on
	// something (the list reading, sign-in, a reload) is served by the site's
	// one set of dots (scripts/dots.js, 26 Oct) until it is done; they trace
	// its icon as they finish. The bell and reload (rows in the menu since
	// 29 Oct) are made when they are first shown, since nothing measures a
	// hidden icon reliably, and draw in again each time the menu opens, or
	// they would only ever draw unseen behind the shut menu.
	const rings = {};

	function makeRing(name, faceId, icons, labels) {
		const face = document.getElementById(faceId);
		if (!face || rings[name]) return rings[name] || null;
		if (typeof TDCRing === 'undefined') {
			TDC.error(AREA, 'ring-status.js is not loaded, so the nav has no icons.');
			return null;
		}
		face.innerHTML = TDCRing.svg();
		try {
			const ring = new TDCRing.RingStatus(face, {
				icons,
				labels: Object.assign({ empty: ' ', loading: 'Working' }, labels),
				initial: 'empty'
			});
			rings[name] = ring;
			drawTo(ring, icons[0]);
			return ring;
		} catch (err) {
			TDC.error(AREA, 'the ' + name + ' icon could not be drawn.', err);
			return null;
		}
	}

	// The icon drawn in, stroke by stroke (at once with less motion).
	function drawTo(ring, icon) {
		if (ring) ring.drawTo(icon);
	}

	// The dots serve the button for as long as `until` takes.
	function serveUntil(button, ring, until, opts) {
		if (!ring) return;
		if (typeof TDCDots === 'undefined') {
			TDC.error(AREA, 'dots.js is not loaded, so the nav cannot show that it is working.');
			return;
		}
		if (button.dataset.dots === 'busy') return;
		ring.say('loading');
		TDCDots.serve(button, Promise.resolve(until).finally(() => ring.say(ring.state)), opts);
	}

	// Leaving the page (sign-in, a reload): the dots stay until it has gone
	// (UV, 26 Oct), as long as a page might take to arrive (LEAVE_MS) before
	// it counts as hung. Back on it from the browser's history (the page
	// kept whole), the call is over: the dots trace the icon and leave.
	const LEAVE_MS = 60000;
	const pageGoes = () => new Promise((done) => {
		window.addEventListener('pageshow', (e) => { if (e.persisted) done(); });
	});

	makeRing('menu', 'nav-menu-ring', ['menu', 'cross'], { menu: 'Menu', cross: 'Close the menu' });
	makeRing('user', 'nav-profile-icon', ['user'], { user: 'Account' });

	// --- Hamburger menu open/close ---
	// The three lines become a cross while it is open. Shut, it folds the
	// notifications away, so the menu always opens on its rows.
	function setMenu(open) {
		menu.classList.toggle('open', open);
		menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		drawTo(rings.menu, open ? 'cross' : 'menu');
		if (open) {
			setAccount(false);
			if (rings.bell) rings.bell.drawIn();
			if (rings.reload) rings.reload.drawIn();
		} else {
			closeNotifications();
		}
	}
	menuToggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));

	// --- The profile menu (UV, 31 Oct) ---
	// Slides in from the right, as the menu does from the left; one of the
	// two at a time.
	function setAccount(open) {
		account.classList.toggle('open', open);
		profileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
		if (open && menu.classList.contains('open')) setMenu(false);
		if (open) loadActive();
	}

	// --- The profile menu's middle: what you're in (UV, 5 Nov) ---
	// Matches, leagues and tournaments that are still going, each row one tap
	// from opening it, to the same place its full list goes. Read every time
	// the menu opens, and only then: most pages never need it. What is on
	// screen stays until the new read arrives, so reopening never flickers.
	const accountList = document.getElementById('nav-account-list');
	const accountDots = document.getElementById('nav-account-dots');
	const ACTIVE_ROWS = 5;   // Each section's most; All › has the rest.
	let activeRead = 0;      // Only the latest read draws.

	// The words only, for a nav that does not load match-settings.js.
	const WIN_SAID = { race_to: 'Race to', best_of: 'Best of', fixed_frames: 'Fixed frames', timed: 'Timed' };
	const LEAGUE_SAID = { taking_entries: 'Taking entries', running: 'Running', on_break: 'On break' };
	const LEAGUE_STRIP = { taking_entries: 'is-go', running: 'is-on', on_break: 'is-rest' };
	const TOURNAMENT_SAID = { draft: 'Draft', open: 'Open for entries', in_progress: 'Running' };
	const TOURNAMENT_STRIP = { draft: '', open: 'is-go', in_progress: 'is-live' };

	function menuEl(tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function menuWhen(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const days = Math.round((midnight(d) - midnight(new Date())) / 86400000);
		const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		if (days === 0) return 'Today ' + time;
		if (days === 1) return 'Tomorrow ' + time;
		if (days === -1) return 'Yesterday ' + time;
		if (days > 1 && days < 7) return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + time;
		return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
	}

	function menuRow(href, strip, name, line, right) {
		const a = menuEl('a', 'nav-account-row' + (strip ? ' ' + strip : ''));
		a.href = href;
		a.append(menuEl('span', 'nav-account-row-name', name));
		if (right) a.append(right);
		a.append(menuEl('span', 'nav-account-row-line', line.filter(Boolean).join(' · ')));
		return a;
	}

	function menuBadge(text) {
		return menuEl('span', 'nav-account-row-right badge needs-you', text);
	}

	function activeMatch(m) {
		// As /matches/: a team night opens the team card.
		const href = m.team_match
			? '/leagues/card/?m=' + encodeURIComponent(m.id)
			: '/match/?id=' + encodeURIComponent(m.id);
		const playing = m.status === 'in_progress';
		const line = [];
		if (m.refereeing) line.push('Referee');
		if (m.set_lineup) line.push('Set your lineup');
		else if (m.team_match) line.push('League night');
		else if (m.card_state === 'awaiting' && !m.needs_me) line.push('Waiting on them');
		else if (m.card_state === 'disputed') line.push('Disputed');
		else line.push(playing ? 'Playing' : 'Not started');
		if (playing && !m.team_match && WIN_SAID[m.win_condition] && m.target) {
			line.push(WIN_SAID[m.win_condition] + ' ' + m.target);
		} else if (m.win_condition === 'free_play' && playing) {
			line.push('Free play');
		} else {
			line.push(menuWhen(m.played_at));
		}
		const scored = m.my_frames + m.their_frames > 0;
		const right = m.needs_me ? menuBadge('Needs you')
			: scored ? menuEl('span', 'nav-account-row-right', m.my_frames + '–' + m.their_frames)
			: null;
		return menuRow(href, playing ? 'is-live' : 'is-go', m.refereeing ? m.opponent : 'vs ' + m.opponent, line, right);
	}

	function activeLeague(l) {
		// As /leagues/: whoever runs it lands on Run it.
		const href = '/leagues/season/?s=' + encodeURIComponent(l.league_season_id) + (l.i_run_it ? '&tab=manage' : '');
		const inIt = l.my_status === 'active';
		return menuRow(href, LEAGUE_STRIP[l.status], l.league_name, [
			LEAGUE_SAID[l.status] || l.status,
			l.my_team_name,
			l.i_captain && inIt ? 'Captain' : '',
			l.my_status === 'inactive' ? 'Inactive' : '',
			l.i_run_it ? 'You run this' : ''
		], inIt && !l.confirmed_at ? menuBadge('Confirm your place') : null);
	}

	function activeTournament(t) {
		// As /tournaments/: the poster until the start, then the draw.
		const href = t.status !== 'in_progress' && t.poster_open
			? '/tournaments/poster/?t=' + encodeURIComponent(t.id)
			: '/tournaments/bracket/?t=' + encodeURIComponent(t.id);
		return menuRow(href, TOURNAMENT_STRIP[t.status], t.name, [
			TOURNAMENT_SAID[t.status] || t.status,
			menuWhen(t.starts_at),
			t.i_run_it ? 'You run this' : ''
		]);
	}

	// A section with nothing in it is not shown.
	function activeSection(title, allHref, rows, draw) {
		if (!rows.length) return null;
		const box = menuEl('section', 'nav-account-section');
		const head = menuEl('a', 'nav-account-head', title);
		head.href = allHref;
		head.append(menuEl('span', '', 'All ›'));
		box.append(head, ...rows.slice(0, ACTIVE_ROWS).map(draw));
		return box;
	}

	function drawActive(data) {
		const sections = [
			activeSection('Matches', '/matches/', data.matches || [], activeMatch),
			activeSection('Leagues', '/leagues/', data.leagues || [], activeLeague),
			activeSection('Tournaments', '/tournaments/', data.tournaments || [], activeTournament)
		].filter(Boolean);
		if (sections.length) {
			accountList.replaceChildren(...sections);
			return;
		}
		const box = menuEl('section', 'nav-account-section');
		box.append(
			menuRow('/matches/new/', '', 'Start a match', []),
			menuRow('/leagues/', '', 'Find a league', []),
			menuRow('/tournaments/', '', 'Find a tournament', []));
		accountList.replaceChildren(menuEl('p', 'nav-account-empty', 'You are not in anything right now.'), box);
	}

	async function loadActive() {
		if (!accountList) return;
		const read = ++activeRead;
		const work = supabaseClient.rpc('tdc_my_active');
		const { data, error } = await TDC.busy(accountDots, work);
		if (read !== activeRead) return;
		if (error) {
			const note = menuEl('div', 'nav-account-note');
			const said = menuEl('p');
			note.append(said);
			accountList.replaceChildren(note);
			TDC.showSupabaseError(AREA, error, said);
			return;
		}
		drawActive(data || {});
	}

	// --- Profile icon: the profile menu when logged in, login page when not ---
	profileBtn.addEventListener('click', () => {
		if (loggedIn) {
			setAccount(!account.classList.contains('open'));
		} else {
			// The dots stay until the sign-in page takes over.
			serveUntil(profileBtn, rings.user, pageGoes(), { timeout: LEAVE_MS });
			const back = encodeURIComponent(location.pathname + location.search);
			window.location.href = '/accounts/?next=' + back;
		}
	});

	// --- Close the menus when clicking outside ---
	document.addEventListener('click', (e) => {
		if (!menu.contains(e.target) && !menuToggle.contains(e.target) && menu.classList.contains('open')) {
			setMenu(false);
		}
		if (!account.contains(e.target) && !profileBtn.contains(e.target) && account.classList.contains('open')) {
			setAccount(false);
		}
		if (notifyBtn && !notifyBtn.contains(e.target) && !notifyTray.contains(e.target)) {
			closeNotifications();
		}
	});

	// Escape closes it, as it should any layer over the page.
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') setAccount(false);
	});

	// --- The toggles: the theme and less motion (prefs.js keeps them) ---
	// Each is a switch with its own icon on each side (tdc-controls.js). A
	// change saves nothing to the network, so the dots serve it briefly.
	if (typeof TDCPrefs === 'undefined') {
		TDC.error(AREA, 'prefs.js is not loaded, so the theme and motion toggles cannot work.');
	} else {
		if (prefTheme) {
			prefTheme.checked = TDCPrefs.light;
			prefTheme.addEventListener('change', () => TDCPrefs.setLight(prefTheme.checked));
		}
		if (prefMotion) {
			prefMotion.checked = TDCPrefs.lessMotion;
			prefMotion.addEventListener('change', () => TDCPrefs.setLessMotion(prefMotion.checked));
		}
	}

	// --- Profile picture in place of the generic icon ---
	// Only ever shown for a signed-in player who has one. If the file has gone
	// (an old path, or deleted on another device) the image fails to load and
	// the generic icon comes back, rather than leaving a broken picture there.
	const AVATAR_BUCKET = 'player-avatars';

	function avatarUrlFor(path) {
		if (!path) return null;
		const { data } = supabaseClient.storage.from(AVATAR_BUCKET).getPublicUrl(path);
		return data && data.publicUrl ? data.publicUrl : null;
	}

	// toggleAttribute, not .hidden: `hidden` is an HTMLElement property and an
	// <svg> does not reflect it, so `svg.hidden = true` sets a plain JavaScript
	// property that reads back true while leaving the icon on screen. Setting
	// the attribute is what the `[hidden]` rule in global.css acts on.
	function setShown(node, shown) {
		node.toggleAttribute('hidden', !shown);
	}

	function showNavAvatar(url) {
		if (!url) {
			setShown(profileAvatar, false);
			profileAvatar.removeAttribute('src');
			setShown(profileIcon, true);
			return;
		}
		profileAvatar.onerror = () => {
			console.error('[' + AREA + '] profile picture could not be loaded, using the icon.', url);
			showNavAvatar(null);
		};
		// Swapped only once the picture has actually loaded, so the nav never
		// shows an empty box.
		profileAvatar.onload = () => {
			setShown(profileIcon, false);
			setShown(profileAvatar, true);
		};
		profileAvatar.src = url;
	}

	// The profile menu's banner: the picture, or the initials in a circle when
	// there is none (as on the Season tab), and the names.
	let bannerName = '';

	function showBannerPic(url) {
		if (!accountPic) return;
		accountPic.replaceChildren();
		if (!url) {
			accountPic.textContent = (bannerName || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
			return;
		}
		const img = document.createElement('img');
		img.alt = '';
		img.onerror = () => {
			console.error('[' + AREA + '] the profile menu\'s picture could not be loaded, using the initials.', url);
			showBannerPic(null);
		};
		img.src = url;
		accountPic.append(img);
	}

	function showBanner(me) {
		bannerName = (me && me.display_name) || '';
		if (accountDisplay) accountDisplay.textContent = bannerName;
		if (accountFull) {
			const full = me ? [me.first_name, me.last_name].filter(Boolean).join(' ') : '';
			accountFull.textContent = full;
			accountFull.hidden = !full;
		}
		showBannerPic(me ? avatarUrlFor(me.avatar_path) : null);
	}

	// The profile page fires this after a picture is changed or removed, so the
	// nav follows without a reload.
	window.addEventListener('tdc:avatar-changed', (e) => {
		const url = avatarUrlFor(e.detail && e.detail.path);
		showNavAvatar(url);
		showBannerPic(url);
	});



	// ─── Notifications ────────────────────────────────────────────────
	//
	// The pip asks a counting function on load — one number, no list. The
	// list is read only when the tray is opened, because most page loads
	// never open it.
	//
	// Opening the tray marks everything seen, which is what clears the pip.
	// The rows already drawn keep the state they were drawn with, so somebody
	// can see what arrived while they were away; those grey out on the next
	// open. Marking seen also prunes, which is why there is no cron.

	let notifyBusy = false;

	async function refreshPip() {
		if (!notifyPip || !loggedIn) return;

		const { data, error } = await supabaseClient.rpc('tdc_unseen_notification_count');
		if (error) {
			// Not worth shouting about in the nav of every page: the bell just
			// stays quiet. The console still carries it.
			console.error('[' + AREA + '] could not count notifications.', error);
			return;
		}
		// Something new since the last look: the menu button, which carries
		// the pip on the bar, draws itself again.
		const was = notifyPip.hidden;
		setPip(data > 0);
		if (was && !notifyPip.hidden && !menu.classList.contains('open')) {
			if (rings.menu) rings.menu.drawIn();
		}
	}

	// The pip is on the bell in the menu and on the menu button on the bar.
	function setPip(on) {
		if (notifyPip) notifyPip.hidden = !on;
		if (menuPip) menuPip.hidden = !on;
	}

	function notifyWhen(iso) {
		const d = new Date(iso);
		if (isNaN(d)) return '';
		const mins = Math.round((Date.now() - d.getTime()) / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return mins + ' min ago';
		const hrs = Math.round(mins / 60);
		if (hrs < 24) return hrs === 1 ? 'An hour ago' : hrs + ' hours ago';
		const days = Math.round(hrs / 24);
		if (days === 1) return 'Yesterday';
		if (days < 7) return days + ' days ago';
		return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
	}

	function notifyRow(n) {
		const row = document.createElement('div');
		row.className = 'nav-notify-item' + (n.seen ? ' seen' : '');

		// A link where there is somewhere to go, a plain div where there is
		// not — never a link to nowhere.
		const main = document.createElement(n.link ? 'a' : 'div');
		main.className = 'nav-notify-main';
		if (n.link) main.href = n.link;

		const title = document.createElement('span');
		title.className = 'nav-notify-title';
		title.textContent = n.title;
		main.append(title);

		if (n.body) {
			const body = document.createElement('span');
			body.className = 'nav-notify-body';
			body.textContent = n.body;
			main.append(body);
		}

		const stamp = document.createElement('span');
		stamp.className = 'nav-notify-when';
		stamp.textContent = notifyWhen(n.created_at);
		main.append(stamp);

		const clear = document.createElement('button');
		clear.type = 'button';
		clear.className = 'nav-notify-clear';
		clear.textContent = '×';
		clear.setAttribute('aria-label', 'Clear: ' + n.title);
		clear.addEventListener('click', (e) => {
			// The row may be inside a link; clearing must not follow it.
			e.preventDefault();
			e.stopPropagation();
			clearOneNotification(n.id, row);
		});

		row.append(main, clear);
		return row;
	}

	async function loadNotifications() {
		if (!notifyList) return;

		const { data, error } = await supabaseClient.rpc('tdc_my_notifications', { p_limit: 50 });
		if (error) {
			TDC.showSupabaseError(AREA, error, notifyEmpty);
			notifyEmpty.hidden = false;
			return;
		}

		const rows = data || [];
		notifyList.replaceChildren(...rows.map(notifyRow));
		notifyEmpty.hidden = rows.length > 0;
		notifyEmpty.textContent = 'Nothing yet.';
		if (notifyClearAll) notifyClearAll.hidden = rows.length === 0;
	}

	async function clearOneNotification(id, row) {
		if (notifyBusy) return;
		notifyBusy = true;

		const { error } = await supabaseClient.rpc('tdc_clear_notification', { p_id: id });
		notifyBusy = false;
		if (error) { TDC.showSupabaseError(AREA, error, notifyEmpty); return; }

		// Taken off the screen rather than the whole list re-read: one row
		// going is not worth a round trip, and the others have not changed.
		row.remove();
		const left = notifyList.childElementCount;
		notifyEmpty.hidden = left > 0;
		if (notifyClearAll) notifyClearAll.hidden = left === 0;
		refreshPip();
	}

	async function openNotifications() {
		notifyTray.classList.add('open');
		notifyBtn.setAttribute('aria-expanded', 'true');

		// No "Reading…": the dots on the bell's row show it (UV, 29 Oct).
		notifyEmpty.hidden = true;
		notifyList.replaceChildren();

		// The list first, so what was unread is still drawn as unread. Marking
		// seen afterwards clears the pip without changing what is on screen:
		// the person gets to see what arrived while they were away, and it
		// greys out next time they look.
		await loadNotifications();

		const { error } = await supabaseClient.rpc('tdc_mark_notifications_seen');
		if (error) {
			console.error('[' + AREA + '] could not mark notifications seen.', error);
			return;
		}
		setPip(false);
	}

	function closeNotifications() {
		if (!notifyTray || !notifyBtn) return;
		notifyTray.classList.remove('open');
		notifyBtn.setAttribute('aria-expanded', 'false');
	}

	if (notifyBtn && notifyTray) {
		notifyBtn.addEventListener('click', () => {
			if (notifyTray.classList.contains('open')) closeNotifications();
			else serveUntil(notifyBtn, rings.bell, openNotifications());   // the dots while the tray reads
		});

		notifyClearAll.addEventListener('click', async () => {
			if (notifyBusy) return;
			if (!confirm('Clear all notifications?')) return;
			notifyBusy = true;

			const { error } = await supabaseClient.rpc('tdc_clear_all_notifications');
			notifyBusy = false;
			if (error) { TDC.showSupabaseError(AREA, error, notifyEmpty); return; }

			notifyList.replaceChildren();
			notifyEmpty.hidden = false;
			notifyEmpty.textContent = 'Nothing yet.';
			notifyClearAll.hidden = true;
			setPip(false);
		});

		// Escape closes it, as it should any layer over the page.
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closeNotifications();
		});

		// Coming back to a tab left open a while. One count, and only while
		// the tray is shut: re-reading under somebody's finger is worse than
		// being a minute out of date.
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden && !notifyTray.classList.contains('open')) {
				refreshPip();
				TDC.flushPushes();
			}
		});
	}

	// --- Check login state on load ---
	TDCLoader.hold((async () => {
		const session = await TDC.getSession(AREA);
		if (!session) return;

		loggedIn = true;

		// Nothing to show a stranger, so the bell appears only now.
		if (notifyWrap) notifyWrap.hidden = false;
		makeRing('bell', 'nav-notify-ring', ['bell'], { bell: 'Notifications' });
		refreshPip();

		// Push anything waiting. The nav is on every page, so this is the
		// backstop: whatever the acting page did not send goes out the next
		// time anybody loads anything. Not awaited — the nav must not wait
		// on it, and a failure costs the push and nothing else.
		TDC.flushPushes();

		// The player's picture and names, for the bar and the profile menu's
		// banner. A missing player row is not worth shouting about in the nav;
		// the generic icon simply stays.
		const { data: me, error: playerErr } = await supabaseClient
			.from('tbl_players')
			.select('avatar_path, display_name, first_name, last_name')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (playerErr) {
			console.error('[' + AREA + '] could not load the profile picture and names.', playerErr);
			showBanner(null);
			return;
		}
		showBanner(me);
		if (me && me.avatar_path) showNavAvatar(avatarUrlFor(me.avatar_path));
	})(), 'Nav');

	// ─── Hiding on scroll (UV, 24 Oct) ────────────────────────────────
	// One long scroll down (SCROLL_FOR pixels without turning back up) slides
	// the bar away, closing whatever was open on it; one long scroll up brings
	// it back, as does the top of the page or tabbing into it. A small nudge
	// either way while reading does nothing (UV, 25 Oct: 200 both ways).
	const navBar = document.querySelector('.site-nav');
	const SCROLL_FOR = 200;
	let lastY = Math.max(0, window.scrollY);
	let upBy = 0, downBy = 0;

	function setNavHidden(hide) {
		if (!navBar || navBar.classList.contains('is-hidden') === hide) return;
		navBar.classList.toggle('is-hidden', hide);
		if (hide) {
			if (menu.classList.contains('open')) setMenu(false);
			setAccount(false);
			closeNotifications();
		}
	}

	window.addEventListener('scroll', () => {
		const y = Math.max(0, window.scrollY);   // a phone's bounce past the top reads negative
		const dy = y - lastY;
		lastY = y;
		if (y <= 4) { upBy = 0; downBy = 0; setNavHidden(false); return; }
		if (dy > 0) {
			upBy = 0;
			downBy += dy;
			if (downBy >= SCROLL_FOR) setNavHidden(true);
		} else if (dy < 0) {
			downBy = 0;
			upBy -= dy;
			if (upBy >= SCROLL_FOR) setNavHidden(false);
		}
	}, { passive: true });

	if (navBar) navBar.addEventListener('focusin', () => setNavHidden(false));

	// ─── Offline ──────────────────────────────────────────────────────
	// The indicator is the nav's job on every page. What a page does about
	// being offline is the page's own business: it listens for tdc:offline
	// and tdc:online, or reads TDCNet.online.
	//
	// navigator.onLine only knows whether the device has a network, not
	// whether our server can be reached, so a page that cares about the
	// difference should treat a failed write as the real answer.
	const offlineTag = document.getElementById('nav-offline');

	function setOffline(off) {
		if (offlineTag) offlineTag.toggleAttribute('hidden', !off);
		document.body.classList.toggle('is-offline', off);
		window.dispatchEvent(new CustomEvent(off ? 'tdc:offline' : 'tdc:online'));
	}

	window.addEventListener('offline', () => setOffline(true));
	window.addEventListener('online', () => setOffline(false));

	// Set the starting state without announcing a change nobody asked about.
	if (offlineTag) offlineTag.toggleAttribute('hidden', navigator.onLine);
	document.body.classList.toggle('is-offline', !navigator.onLine);

	window.TDCNet = { get online() { return navigator.onLine; } };

	// ─── Reload ───────────────────────────────────────────────────────
	// An installed app has no address bar and no reload button, so there is
	// no way out of a page that has gone stale — a live page whose socket
	// dropped, or one opened before the last deploy. Pull-to-refresh is not
	// reliable either: the match page's own scrolling swallows it.
	//
	// Only shown when running installed. In a browser the chrome already has
	// one and a second would be clutter.
	const reloadBtn = document.getElementById('nav-reload');

	function runningInstalled() {
		// iOS Safari predates display-mode and reports navigator.standalone.
		return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
			|| window.navigator.standalone === true;
	}

	if (reloadBtn && runningInstalled()) {
		reloadBtn.hidden = false;
		makeRing('reload', 'nav-reload-ring', ['reload'], { reload: 'Reload' });

		reloadBtn.addEventListener('click', async () => {
			reloadBtn.disabled = true;
			// The dots stay until the page goes.
			serveUntil(reloadBtn, rings.reload, pageGoes(), { timeout: LEAVE_MS });

			// Ask the service worker to look for a new version first, so this
			// also gets a stale install onto the current deploy rather than
			// just redrawing the same old files. Never allowed to hold the
			// reload up: a slow or missing worker must not leave somebody
			// pressing a dead button.
			try {
				if ('serviceWorker' in navigator) {
					const reg = await Promise.race([
						navigator.serviceWorker.getRegistration(),
						new Promise((done) => setTimeout(() => done(null), 1500))
					]);
					if (reg) await Promise.race([
						reg.update(),
						new Promise((done) => setTimeout(done, 1500))
					]);
				}
			} catch (err) {
				console.error('[' + AREA + '] could not check for a new version before reloading.', err);
			}

			location.reload();
		});
	}
})();
