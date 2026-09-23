// Shared nav behavior: hamburger menu + login-aware profile icon
// Assumes supabaseClient.js has already run and window.supabaseClient exists

(function () {
	const menuToggle = document.getElementById('nav-menu-toggle');
	const menu = document.getElementById('nav-menu');
	const profileBtn = document.getElementById('nav-profile');
	const profileDropdown = document.getElementById('nav-profile-dropdown');
	const profileEmail = document.getElementById('nav-profile-email');
	const logoutBtn = document.getElementById('nav-logout-btn');

	let loggedIn = false;

	// --- Hamburger menu open/close ---
	menuToggle.addEventListener('click', () => {
		const isOpen = menu.classList.toggle('open');
		menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
	});

	// --- Profile icon behavior ---
	profileBtn.addEventListener('click', () => {
		if (loggedIn) {
			profileDropdown.classList.toggle('open');
		} else {
			window.location.href = '/accounts/';
		}
	});

	logoutBtn.addEventListener('click', async () => {
		await supabaseClient.auth.signOut();
		window.location.reload();
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
		const { data: { session } } = await supabaseClient.auth.getSession();
		if (session) {
			loggedIn = true;
			profileEmail.textContent = session.user.email;
		}
	})();
})();