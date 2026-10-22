// Shared nav behavior: hamburger menu + login-aware profile menu.
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).

(function () {
	const AREA = 'Nav';

	const menuToggle      = document.getElementById('nav-menu-toggle');
	const menu            = document.getElementById('nav-menu');
	const profileBtn      = document.getElementById('nav-profile');
	const profileDropdown = document.getElementById('nav-profile-dropdown');
	const profileEmail    = document.getElementById('nav-profile-email');
	const staffLink       = document.getElementById('nav-staff-link');
	const logoutBtn       = document.getElementById('nav-logout-btn');
	const profileIcon     = document.getElementById('nav-profile-icon');
	const profileAvatar   = document.getElementById('nav-avatar');

	if (!menuToggle || !menu || !profileBtn || !profileDropdown || !profileEmail || !staffLink || !logoutBtn
		|| !profileIcon || !profileAvatar) {
		TDC.error(AREA, 'nav is missing expected elements.');
		return;
	}

	// Notifications. Deliberately not in the required list above: if this part
	// of the nav is missing, the rest of it must still work. Everything below
	// checks before using them.
	const notifyWrap  = document.getElementById('nav-notify-wrap');
	const notifyBtn   = document.getElementById('nav-notify');
	const notifyPip   = document.getElementById('nav-notify-pip');
	const notifyTray  = document.getElementById('nav-notify-tray');
	const notifyList  = document.getElementById('nav-notify-list');
	const notifyEmpty = document.getElementById('nav-notify-empty');
	const notifyClearAll = document.getElementById('nav-notify-clear-all');

	let loggedIn = false;

	// --- Hamburger menu open/close ---
	menuToggle.addEventListener('click', () => {
		const isOpen = menu.classList.toggle('open');
		menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
	});

	// --- Profile icon: menu when logged in, login page when not ---
	profileBtn.addEventListener('click', () => {
		if (loggedIn) {
			profileDropdown.classList.toggle('open');
		} else {
			const back = encodeURIComponent(location.pathname + location.search);
			window.location.href = '/accounts/?next=' + back;
		}
	});

	logoutBtn.addEventListener('click', async () => {
		const { error } = await supabaseClient.auth.signOut();
		if (error) {
			TDC.error(AREA, 'could not log out.', error);
			profileEmail.textContent = 'TDC (Error): could not log out.';
			return;
		}
		window.location.replace('/');
	});

	// --- Close menu/dropdown when clicking outside ---
	document.addEventListener('click', (e) => {
		if (!menu.contains(e.target) && !menuToggle.contains(e.target)) {
			menu.classList.remove('open');
			menuToggle.setAttribute('aria-expanded', 'false');
		}
		if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
			profileDropdown.classList.remove('open');
		}
		if (notifyBtn && !notifyBtn.contains(e.target) && !notifyTray.contains(e.target)) {
			closeNotifications();
		}
	});

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

	// The profile page fires this after a picture is changed or removed, so the
	// nav follows without a reload.
	window.addEventListener('tdc:avatar-changed', (e) => {
		showNavAvatar(avatarUrlFor(e.detail && e.detail.path));
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
		notifyPip.hidden = !(data > 0);
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

		notifyEmpty.hidden = false;
		notifyEmpty.textContent = 'Reading…';
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
		if (notifyPip) notifyPip.hidden = true;
	}

	function closeNotifications() {
		if (!notifyTray) return;
		notifyTray.classList.remove('open');
		notifyBtn.setAttribute('aria-expanded', 'false');
	}

	if (notifyBtn && notifyTray) {
		notifyBtn.addEventListener('click', () => {
			if (notifyTray.classList.contains('open')) closeNotifications();
			else openNotifications();
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
			if (notifyPip) notifyPip.hidden = true;
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
	(async () => {
		const session = await TDC.getSession(AREA);
		if (!session) return;

		loggedIn = true;
		profileEmail.textContent = session.user.email || 'TDC (No Email)';

		// Nothing to show a stranger, so the bell appears only now.
		if (notifyWrap) notifyWrap.hidden = false;
		refreshPip();

		// Push anything waiting. The nav is on every page, so this is the
		// backstop: whatever the acting page did not send goes out the next
		// time anybody loads anything. Not awaited — the nav must not wait
		// on it, and a failure costs the push and nothing else.
		TDC.flushPushes();

		// Show the "Staff" link only to venue staff. The page and the database check again for real.
		const { data, error } = await supabaseClient
			.from('tbl_venue_staff')
			.select('venue_id')
			.eq('user_id', session.user.id)
			.limit(1);

		if (error) {
			TDC.error(AREA, 'could not check staff role.', error);
		} else {
			staffLink.hidden = data.length === 0;
		}

		// The player's picture. A missing player row is not worth shouting about
		// in the nav; the generic icon simply stays.
		const { data: me, error: playerErr } = await supabaseClient
			.from('tbl_players')
			.select('avatar_path')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (playerErr) {
			console.error('[' + AREA + '] could not load the profile picture.', playerErr);
			return;
		}
		if (me && me.avatar_path) showNavAvatar(avatarUrlFor(me.avatar_path));
	})();

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

		reloadBtn.addEventListener('click', async () => {
			reloadBtn.disabled = true;

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
