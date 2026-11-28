// The sign-in card (UV, 28 Nov; docs/systems/foundations.md, "The sign-in card"): "a card that
// slides up with a form rather than the wide format", site-wide. TDCSignIn.open({ next, mode, onClose })
// over whatever page you are on: Log In, Google, and the QR for signing this screen in with a phone
// (device-login.js), with Sign up and Forgot password switching inside the card. Signed in, the page
// reloads (UV: "logging in can reload the page"), or goes to `next` when one is given.
// The card is the Add credits card's sheet (credits-card.css: .cc, .cc-head, .cc-icon; TDC.cardOpen).
// Behaviour is the old login page's (auth.js) and the reset page's first step (reset.js), moved.
// Needs: supabaseClient.js, tdc.js, credits-card.js, device-login.js (all loaded by layout.html).

const TDCSignIn = (() => {
	const AREA = 'SignIn';
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const GOOGLE_MARK = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.9 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.9c-.6 3-2.2 5.5-4.7 7.2l7.7 6c4.5-4.2 7-10.3 7-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>';

	let dlg = null, els = null, deviceLogin = null;
	let mode = 'login';           // 'login', 'signup' or 'forgot'
	let opts = {};
	let goingOn = false;

	function closeIcon() {
		const s = document.createElementNS(SVG_NS, 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('fill', 'none');
		s.setAttribute('stroke', 'currentColor');
		s.setAttribute('stroke-width', '2');
		s.setAttribute('stroke-linecap', 'round');
		s.setAttribute('aria-hidden', 'true');
		for (const d of ['M6 6l12 12', 'M18 6L6 18']) {
			const p = document.createElementNS(SVG_NS, 'path');
			p.setAttribute('d', d);
			s.appendChild(p);
		}
		return s;
	}

	// Where Google and the sign-up email bring the person back to: this page (or `next`).
	function returnTo() {
		return location.origin + (opts.next || (location.pathname + location.search));
	}

	// Signed in: reload, or on to `next`. Once only, as signing in also fires the listener below.
	function goOn() {
		if (goingOn) return;
		goingOn = true;
		if (deviceLogin) deviceLogin.close();
		if (typeof TDCLoader !== 'undefined') TDCLoader.leaving();
		if (opts.next) location.replace(opts.next);
		else location.reload();
	}

	function build() {
		dlg = document.createElement('dialog');
		dlg.className = 'cc si';
		dlg.setAttribute('aria-labelledby', 'si-title');
		dlg.dataset.pull = 'off';   // a drag on the card never reloads the page under it
		dlg.innerHTML = `
			<div class="cc-head">
				<h2 id="si-title" tabindex="-1" autofocus>Log In</h2>
				<button type="button" class="cc-icon" id="si-close" aria-label="Close"></button>
			</div>
			<div id="si-google-block">
				<button type="button" class="btn btn-google" id="si-google">
					<span class="btn-google-mark" aria-hidden="true">${GOOGLE_MARK}</span>
					Continue with Google
				</button>
				<div class="si-or">— or —</div>
			</div>
			<form id="si-form" novalidate>
				<div class="field" id="si-display-name-field" hidden>
					<label for="si-display-name">Display name</label>
					<input type="text" id="si-display-name" autocomplete="nickname" maxlength="100">
					<div class="hint">How other players will see you. You can change it later.</div>
				</div>
				<div id="si-names-fields" hidden>
					<div class="field">
						<label for="si-first-name">First name</label>
						<input type="text" id="si-first-name" autocomplete="given-name" maxlength="100">
					</div>
					<div class="field">
						<label for="si-last-name">Surname</label>
						<input type="text" id="si-last-name" autocomplete="family-name" maxlength="100">
						<div class="hint">Optional, but without both you will have no short link to your profile.</div>
					</div>
				</div>
				<div class="field">
					<label for="si-email">Email</label>
					<input type="email" id="si-email" autocomplete="email" required>
				</div>
				<div class="field" id="si-password-field">
					<label for="si-password">Password</label>
					<input type="password" id="si-password" autocomplete="current-password" required minlength="8">
					<div class="hint" id="si-password-hint" hidden>At least 8 characters, with letters and numbers.</div>
				</div>
				<p class="si-forgot-text" id="si-forgot-text" hidden>Enter your email and we will send you a link to choose a new password.</p>
				<button type="submit" class="btn btn-primary" id="si-submit">Log In</button>
			</form>
			<div class="status" id="si-status"></div>
			<div id="si-device-login" hidden></div>
			<div class="link-row">
				<button type="button" class="link" id="si-toggle">Don't have an account? Sign up</button>
			</div>
			<div class="link-row" id="si-forgot-row">
				<button type="button" class="link" id="si-forgot">Forgot password?</button>
			</div>`;
		document.body.appendChild(dlg);

		const $ = (id) => dlg.querySelector('#' + id);
		els = {
			title: $('si-title'), close: $('si-close'), googleBlock: $('si-google-block'), google: $('si-google'),
			form: $('si-form'), displayNameField: $('si-display-name-field'), displayName: $('si-display-name'),
			namesFields: $('si-names-fields'), firstName: $('si-first-name'), lastName: $('si-last-name'),
			email: $('si-email'), passwordField: $('si-password-field'), password: $('si-password'),
			passwordHint: $('si-password-hint'), forgotText: $('si-forgot-text'), submit: $('si-submit'),
			status: $('si-status'), device: $('si-device-login'), toggle: $('si-toggle'),
			forgotRow: $('si-forgot-row'), forgot: $('si-forgot'),
		};
		els.close.append(closeIcon());

		if (typeof TDCDeviceLogin !== 'undefined') deviceLogin = TDCDeviceLogin.mount(els.device, { onSignedIn: goOn });
		else TDC.error(AREA, 'the QR for signing in with a phone is missing (device-login.js).');

		els.close.addEventListener('click', close);
		dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
		// However it closes (✕, the dim, Escape): no more codes (UV, 28 Nov), and the page hears of it.
		dlg.addEventListener('close', () => {
			if (deviceLogin) deviceLogin.close();
			if (!goingOn && opts.onClose) opts.onClose();
		});
		els.toggle.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
		els.forgot.addEventListener('click', () => setMode('forgot'));
		els.form.addEventListener('submit', submit);
		els.google.addEventListener('click', google);

		// Signed in by any route while the card is open (the password, the phone): on.
		supabaseClient.auth.onAuthStateChange((event, session) => {
			if (session && event === 'SIGNED_IN' && dlg.open) goOn();
		});
	}

	function setMode(next) {
		const apply = () => {
			mode = next;
			const signup = mode === 'signup', forgot = mode === 'forgot';
			els.title.textContent      = signup ? 'Sign Up' : forgot ? 'Forgot Password' : 'Log In';
			els.submit.textContent     = signup ? 'Create Account' : forgot ? 'Send Reset Link' : 'Log In';
			els.toggle.textContent     = mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in';
			els.googleBlock.hidden     = forgot;
			els.displayNameField.hidden = !signup;
			els.namesFields.hidden     = !signup;
			els.passwordField.hidden   = forgot;
			els.passwordHint.hidden    = !signup;
			els.forgotText.hidden      = !forgot;
			els.forgotRow.hidden       = mode !== 'login';
			els.password.autocomplete  = signup ? 'new-password' : 'current-password';
			if (forgot) els.toggle.textContent = 'Back to Log In';
			TDC.status(els.status, '', '');
			showDeviceLogin();
			dlg.scrollTop = 0;   // each screen starts at its title
		};
		if (dlg.open) TDC.cardResize(dlg, apply);
		else apply();
	}

	// The QR shows in Log In mode only, and makes codes only while the card is open (UV, 28 Nov).
	function showDeviceLogin() {
		if (!deviceLogin) return;
		const on = mode === 'login' && dlg.open && !goingOn;
		els.device.hidden = !on;
		if (on) deviceLogin.open();
		else deviceLogin.close();
	}

	// Checks done in the browser for quick feedback. Supabase checks again on its side.
	function validate() {
		const email = els.email.value.trim();
		const password = els.password.value;
		if (mode === 'signup' && els.displayName.value.trim() === '') return 'Please enter a display name.';
		if (!email || !els.email.checkValidity()) return 'Please enter a valid email address.';
		if (mode === 'forgot') return null;
		if (password.length < 8) return 'Password must be at least 8 characters.';
		if (mode === 'signup' && !(/[A-Za-z]/.test(password) && /[0-9]/.test(password))) {
			return 'Password must include both letters and numbers.';
		}
		return null;
	}

	async function submit(e) {
		e.preventDefault();
		const problem = validate();
		if (problem) {
			TDC.status(els.status, problem, 'error');
			return;
		}

		els.submit.disabled = true;
		// The dots show it's working (UV, 29 Oct: never a loading message).
		TDC.status(els.status, '', '');
		const email = els.email.value.trim();
		const password = els.password.value;

		try {
			if (mode === 'signup') {
				const { data, error } = await TDC.busy(els.submit, supabaseClient.auth.signUp({
					email,
					password,
					options: {
						data: {
							display_name: els.displayName.value.trim(),
							first_name: els.firstName.value.trim(),
							last_name: els.lastName.value.trim()
						},
						emailRedirectTo: returnTo()
					}
				}), els.status);
				if (error) {
					TDC.showSupabaseError(AREA, error, els.status);
					return;
				}
				console.log('[SignIn] Signup response:', data);
				// Supabase deliberately gives the same answer whether or not the email is already registered,
				// so nobody can use this form to find out who has an account.
				els.form.reset();
				setMode('login');
				TDC.status(els.status, 'Check your email for a confirmation link, then log in.', 'success');
			} else if (mode === 'forgot') {
				const { error } = await TDC.busy(els.submit, supabaseClient.auth.resetPasswordForEmail(email, {
					redirectTo: location.origin + '/accounts/reset/'
				}), els.status);
				if (error) {
					TDC.showSupabaseError(AREA, error, els.status);
					return;
				}
				// Same answer whether or not the email has an account, so the form can't be used to look people up.
				TDC.status(els.status, 'If that email has an account, a reset link is on its way. Check your inbox.', 'success');
				els.form.reset();
			} else {
				const { error } = await TDC.busy(els.submit, supabaseClient.auth.signInWithPassword({ email, password }), els.status);
				if (error) {
					if (error.code === 'email_not_confirmed') {
						TDC.status(els.status, 'Please confirm your email first. Check your inbox for the link.', 'error');
					} else if (error.code === 'invalid_credentials') {
						TDC.status(els.status, 'Incorrect email or password.', 'error');
					} else {
						TDC.showSupabaseError(AREA, error, els.status);
					}
					return;
				}
				goOn();
			}
		} catch (err) {
			TDC.error(AREA, 'unexpected problem while ' + (mode === 'signup' ? 'signing up.' : mode === 'forgot' ? 'sending the reset email.' : 'logging in.'), err, els.status);
		} finally {
			els.submit.disabled = false;
		}
	}

	async function google() {
		els.google.disabled = true;
		const { error } = await supabaseClient.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: returnTo() }
		});
		if (error) {
			els.google.disabled = false;
			TDC.showSupabaseError(AREA, error, els.status);
		}
		// On success the browser goes to Google, then comes back to this page signed in.
	}

	// opts: next (a page on this site to go to once signed in, instead of reloading), mode
	// ('login', 'signup' or 'forgot'), onClose (called when it closes without signing in).
	function open(o = {}) {
		opts = o;
		if (opts.next && !(opts.next.startsWith('/') && !opts.next.startsWith('//'))) opts.next = null;
		if (!dlg) build();
		goingOn = false;
		setMode(o.mode || 'login');
		TDC.cardOpen(dlg);
		showDeviceLogin();
	}

	function close() {
		if (dlg) TDC.cardClose(dlg);
	}

	// Every link to the login page, anywhere on the site, opens the card over this page instead
	// (UV, 28 Nov: "every Sign in / Log in link"). A ?next= naming another page is kept; naming
	// this one, the page simply reloads. A new tab (Ctrl, ⌘, the middle button) still goes there.
	document.addEventListener('click', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const a = e.target.closest && e.target.closest('a[href]');
		if (!a || a.target === '_blank') return;
		const url = new URL(a.href, location.href);
		if (url.origin !== location.origin || url.pathname !== '/accounts/') return;
		if (location.pathname === '/accounts/') return;   // the login page opens the card itself
		e.preventDefault();
		const next = url.searchParams.get('next');
		open(next && next !== location.pathname + location.search ? { next } : {});
	});

	return { open, close };
})();
