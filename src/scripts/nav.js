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


	// --- Check login state on load ---
	(async () => {
		const session = await TDC.getSession(AREA);
		if (!session) return;

		loggedIn = true;
		profileEmail.textContent = session.user.email || 'TDC (No Email)';

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
})();
