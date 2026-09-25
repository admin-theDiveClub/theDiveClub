// Login and signup page (/accounts/).
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).

(() => {
	const AREA = 'Auth';

	const form             = document.getElementById('auth-form');
	const formTitle        = document.getElementById('form-title');
	const displayNameField = document.getElementById('display-name-field');
	const displayNameInput = document.getElementById('display-name');
	const emailInput       = document.getElementById('email');
	const passwordInput    = document.getElementById('password');
	const passwordHint     = document.getElementById('password-hint');
	const submitBtn        = document.getElementById('submit-btn');
	const googleBtn        = document.getElementById('google-signin');
	const toggleBtn        = document.getElementById('toggle-mode');
	const forgotRow        = document.getElementById('forgot-row');
	const statusEl         = document.getElementById('status-msg');

	if (!form || !statusEl) {
		TDC.error(AREA, 'login page is missing expected elements.');
		return;
	}

	// Where to go after logging in (only pages on this site).
	const next = TDC.safeNext('/');

	let mode = 'login'; // or 'signup'

	function updateModeUI() {
		const signup = mode === 'signup';
		formTitle.textContent        = signup ? 'Sign Up' : 'Log In';
		submitBtn.textContent        = signup ? 'Create Account' : 'Log In';
		toggleBtn.textContent        = signup ? 'Already have an account? Log in' : "Don't have an account? Sign up";
		displayNameField.hidden      = !signup;
		passwordHint.hidden          = !signup;
		forgotRow.hidden             = signup;
		passwordInput.autocomplete   = signup ? 'new-password' : 'current-password';
		TDC.status(statusEl, '', '');
	}

	toggleBtn.addEventListener('click', () => {
		mode = mode === 'login' ? 'signup' : 'login';
		updateModeUI();
	});

	// Checks done in the browser for quick feedback. Supabase checks again on its side.
	function validate() {
		const email    = emailInput.value.trim();
		const password = passwordInput.value;

		if (mode === 'signup' && displayNameInput.value.trim() === '') {
			return 'Please enter a display name.';
		}
		if (!email || !emailInput.checkValidity()) {
			return 'Please enter a valid email address.';
		}
		if (password.length < 8) {
			return 'Password must be at least 8 characters.';
		}
		if (mode === 'signup' && !(/[A-Za-z]/.test(password) && /[0-9]/.test(password))) {
			return 'Password must include both letters and numbers.';
		}
		return null;
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault();

		const problem = validate();
		if (problem) {
			TDC.status(statusEl, problem, 'error');
			return;
		}

		submitBtn.disabled = true;
		TDC.status(statusEl, mode === 'signup' ? 'Creating account…' : 'Logging in…', '');

		const email    = emailInput.value.trim();
		const password = passwordInput.value;

		try {
			if (mode === 'signup') {
				const { data, error } = await supabaseClient.auth.signUp({
					email,
					password,
					options: {
						data: { display_name: displayNameInput.value.trim() },
						emailRedirectTo: location.origin + '/accounts/'
					}
				});

				if (error) {
					TDC.showSupabaseError(AREA, error, statusEl);
					return;
				}

				console.log('[Auth] Signup response:', data);
				// Supabase deliberately gives the same answer whether or not the email is already registered,
				// so nobody can use this form to find out who has an account.
				form.reset();
				mode = 'login';
				updateModeUI();
				TDC.status(statusEl, 'Check your email for a confirmation link, then log in.', 'success');
			} else {
				const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

				if (error) {
					if (error.code === 'email_not_confirmed') {
						TDC.status(statusEl, 'Please confirm your email first. Check your inbox for the link.', 'error');
					} else if (error.code === 'invalid_credentials') {
						TDC.status(statusEl, 'Incorrect email or password.', 'error');
					} else {
						TDC.showSupabaseError(AREA, error, statusEl);
					}
					return;
				}

				TDC.status(statusEl, 'Logged in, redirecting…', 'success');
				location.replace(next);
			}
		} catch (err) {
			TDC.error(AREA, 'unexpected problem while ' + (mode === 'signup' ? 'signing up.' : 'logging in.'), err, statusEl);
		} finally {
			submitBtn.disabled = false;
		}
	});

	googleBtn.addEventListener('click', async () => {
		googleBtn.disabled = true;
		const returnTo = location.origin + '/accounts/' + (next !== '/' ? '?next=' + encodeURIComponent(next) : '');

		const { error } = await supabaseClient.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: returnTo }
		});

		if (error) {
			googleBtn.disabled = false;
			TDC.showSupabaseError(AREA, error, statusEl);
		}
		// On success the browser goes to Google, then comes back to this page logged in.
	});

	// Already logged in (including coming back from Google or an email link): go on to the next page.
	supabaseClient.auth.onAuthStateChange((event, session) => {
		if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
			location.replace(next);
		}
	});

	updateModeUI();
})();
