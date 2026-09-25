// Reset password page (/accounts/reset/).
// Step 1: request a reset email. Step 2: after following the emailed link, choose a new password.
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).

(() => {
	const AREA = 'Reset';

	const title         = document.getElementById('reset-title');
	const requestForm   = document.getElementById('request-form');
	const requestEmail  = document.getElementById('request-email');
	const requestBtn    = document.getElementById('request-btn');
	const updateForm    = document.getElementById('update-form');
	const newPassword   = document.getElementById('new-password');
	const confirmPass   = document.getElementById('confirm-password');
	const updateBtn     = document.getElementById('update-btn');
	const statusEl      = document.getElementById('status-msg');

	if (!requestForm || !updateForm || !statusEl) {
		TDC.error(AREA, 'reset page is missing expected elements.');
		return;
	}

	function showUpdateStep() {
		title.textContent  = 'Choose a New Password';
		requestForm.hidden = true;
		updateForm.hidden  = false;
		TDC.status(statusEl, '', '');
		newPassword.focus();
	}

	// An expired or already-used link comes back with an error in the address instead of a login.
	const hashParams = new URLSearchParams(location.hash.slice(1));
	if (hashParams.get('error')) {
		console.warn('[Reset] Link error:', Object.fromEntries(hashParams));
		const expired = hashParams.get('error_code') === 'otp_expired';
		TDC.status(statusEl,
			expired
				? 'That reset link has expired or was already used. Please request a new one.'
				: 'That reset link didn\'t work: ' + (hashParams.get('error_description') || 'unknown reason') + '. Please request a new one.',
			'error');
		history.replaceState(null, '', location.pathname);
	}

	// Following the emailed link logs the person in for this one purpose and fires PASSWORD_RECOVERY.
	// The address also says type=recovery, which is checked too in case the event fired before this script loaded.
	if (hashParams.get('type') === 'recovery') {
		showUpdateStep();
	}
	supabaseClient.auth.onAuthStateChange((event) => {
		if (event === 'PASSWORD_RECOVERY') {
			showUpdateStep();
		}
	});

	// Step 1: send the reset email.
	requestForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		const email = requestEmail.value.trim();
		if (!email || !requestEmail.checkValidity()) {
			TDC.status(statusEl, 'Please enter a valid email address.', 'error');
			return;
		}

		requestBtn.disabled = true;
		TDC.status(statusEl, 'Sending…', '');

		try {
			const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
				redirectTo: location.origin + '/accounts/reset/'
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, statusEl);
				return;
			}

			// Same answer whether or not the email has an account, so the form can't be used to look people up.
			TDC.status(statusEl, 'If that email has an account, a reset link is on its way. Check your inbox.', 'success');
			requestForm.reset();
		} catch (err) {
			TDC.error(AREA, 'unexpected problem sending the reset email.', err, statusEl);
		} finally {
			requestBtn.disabled = false;
		}
	});

	// Step 2: save the new password.
	updateForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		const password = newPassword.value;

		if (password.length < 8) {
			TDC.status(statusEl, 'Password must be at least 8 characters.', 'error');
			return;
		}
		if (!(/[A-Za-z]/.test(password) && /[0-9]/.test(password))) {
			TDC.status(statusEl, 'Password must include both letters and numbers.', 'error');
			return;
		}
		if (password !== confirmPass.value) {
			TDC.status(statusEl, 'The two passwords don\'t match.', 'error');
			return;
		}

		updateBtn.disabled = true;
		TDC.status(statusEl, 'Saving…', '');

		try {
			const { error } = await supabaseClient.auth.updateUser({ password });

			if (error) {
				TDC.showSupabaseError(AREA, error, statusEl);
				return;
			}

			updateForm.reset();
			updateForm.hidden = true;
			title.textContent = 'Password Updated';
			TDC.status(statusEl, 'Your password has been changed. You\'re logged in.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the new password.', err, statusEl);
		} finally {
			updateBtn.disabled = false;
		}
	});
})();
