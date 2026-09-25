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

	if (!menuToggle || !menu || !profileBtn || !profileDropdown || !profileEmail || !staffLink || !logoutBtn) {
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
			return;
		}
		staffLink.hidden = data.length === 0;
	})();
})();
