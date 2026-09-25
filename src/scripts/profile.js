// Profile page (/accounts/profile/).
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).

(async () => {
	const AREA = 'Profile';

	const el = (id) => document.getElementById(id);
	const els = {
		detailsForm:    el('details-form'),
		displayName:    el('display-name'),
		firstName:      el('first-name'),
		lastName:       el('last-name'),
		detailsBtn:     el('details-btn'),
		detailsStatus:  el('details-status'),
		idList:         el('id-list'),
		idForm:         el('id-form'),
		idKind:         el('id-kind'),
		idValue:        el('id-value'),
		idValueLabel:   el('id-value-label'),
		idCountryField: el('id-country-field'),
		idCountry:      el('id-country'),
		idBtn:          el('id-btn'),
		idStatus:       el('id-status'),
		accountEmail:   el('account-email'),
		accountMethods: el('account-methods'),
		passwordForm:   el('password-form'),
		currentPw:      el('current-password'),
		newPw:          el('pw-new'),
		confirmPw:      el('pw-confirm'),
		passwordBtn:    el('password-btn'),
		passwordStatus: el('password-status'),
		pwCodeField:    el('pw-code-field'),
		pwCode:         el('pw-code'),
		emailForm:      el('email-form'),
		newEmail:       el('new-email'),
		emailBtn:       el('email-btn'),
		emailStatus:    el('email-status'),
		logoutBtn:      el('logout-btn'),
		claimSection:   el('claim-section'),
		claimList:      el('claim-list'),
		claimStatus:    el('claim-status'),
		creditsList:    el('credits-list'),
		redeemForm:     el('redeem-form'),
		redeemVenueField: el('redeem-venue-field'),
		redeemVenue:    el('redeem-venue'),
		redeemCode:     el('redeem-code'),
		redeemBtn:      el('redeem-btn'),
		creditsStatus:  el('credits-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'profile page is missing expected elements: ' + missing.join(', '));
		return;
	}

	// Logged-out visitors go to the login page and come back here afterwards.
	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const user = session.user;

	// ─── Log out ───
	els.logoutBtn.addEventListener('click', async () => {
		const { error } = await supabaseClient.auth.signOut();
		if (error) {
			TDC.showSupabaseError(AREA, error, els.passwordStatus);
			return;
		}
		location.replace('/');
	});

	// ─── Account (login details) ───
	els.accountEmail.textContent = user.email || 'TDC (No Email)';

	const providerLabels = { email: 'Email and password', google: 'Google' };
	const providers = (user.app_metadata && user.app_metadata.providers) || [];
	els.accountMethods.textContent = providers.length
		? providers.map((p) => providerLabels[p] || p).join(', ')
		: 'TDC (No sign-in methods)';

	// Only accounts that sign in with email and password can change their password or email here.
	// (Google-only accounts manage these with Google.)
	els.passwordForm.hidden = !providers.includes('email');
	els.emailForm.hidden = !providers.includes('email');

	els.passwordForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const current = els.currentPw.value;
		const password = els.newPw.value;

		if (!current) {
			TDC.status(els.passwordStatus, 'Please enter your current password.', 'error');
			return;
		}
		if (password.length < 8 || !(/[A-Za-z]/.test(password) && /[0-9]/.test(password))) {
			TDC.status(els.passwordStatus, 'New password must be at least 8 characters, with letters and numbers.', 'error');
			return;
		}
		if (password !== els.confirmPw.value) {
			TDC.status(els.passwordStatus, 'The two new passwords don\'t match.', 'error');
			return;
		}

		// If the code box is showing, the emailed code is required.
		const codeNeeded = !els.pwCodeField.hidden;
		const nonce = els.pwCode.value.replace(/\s/g, '');
		if (codeNeeded && !nonce) {
			TDC.status(els.passwordStatus, 'Please enter the code we emailed you.', 'error');
			return;
		}

		els.passwordBtn.disabled = true;
		TDC.status(els.passwordStatus, 'Saving…', '');
		try {
			const attributes = { password, currentPassword: current };
			if (codeNeeded) attributes.nonce = nonce;

			const { error } = await supabaseClient.auth.updateUser(attributes);

			if (error && error.code === 'reauthentication_needed') {
				// Last login was more than 24 hours ago: Supabase wants an emailed code first.
				const { error: reauthErr } = await supabaseClient.auth.reauthenticate();
				if (reauthErr) {
					TDC.showSupabaseError(AREA, reauthErr, els.passwordStatus);
					return;
				}
				els.pwCodeField.hidden = false;
				els.pwCode.focus();
				TDC.status(els.passwordStatus, 'For your security, we\'ve emailed you a verification code. Enter it above and tap Change Password again.', '');
				return;
			}
			if (error && error.code === 'reauthentication_not_valid') {
				TDC.status(els.passwordStatus, 'That code is wrong or has expired. Check the latest email, or reload the page to get a new code.', 'error');
				return;
			}
			if (error) {
				TDC.showSupabaseError(AREA, error, els.passwordStatus);
				return;
			}
			els.passwordForm.reset();
			els.pwCodeField.hidden = true;
			TDC.status(els.passwordStatus, 'Password changed.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem changing your password.', err, els.passwordStatus);
		} finally {
			els.passwordBtn.disabled = false;
		}
	});

	// ─── Change email ───
	els.emailForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const newEmail = els.newEmail.value.trim();

		if (!newEmail || !els.newEmail.checkValidity()) {
			TDC.status(els.emailStatus, 'Please enter a valid email address.', 'error');
			return;
		}
		if (newEmail.toLowerCase() === (user.email || '').toLowerCase()) {
			TDC.status(els.emailStatus, 'That\'s already your email address.', 'error');
			return;
		}

		els.emailBtn.disabled = true;
		TDC.status(els.emailStatus, 'Sending…', '');
		try {
			const { error } = await supabaseClient.auth.updateUser(
				{ email: newEmail },
				{ emailRedirectTo: location.origin + '/accounts/profile/' }
			);
			if (error) {
				TDC.showSupabaseError(AREA, error, els.emailStatus);
				return;
			}
			els.emailForm.reset();
			TDC.status(els.emailStatus, `Check both ${user.email} and ${newEmail} for a confirmation link. Your email changes once both are confirmed.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem changing your email.', err, els.emailStatus);
		} finally {
			els.emailBtn.disabled = false;
		}
	});

	// ─── Player details ───
	const player = await TDC.getMyPlayer(AREA, user.id, els.detailsStatus);
	if (!player) {
		els.detailsForm.hidden = true;
		TDC.error(AREA, 'no player profile, so details and ID can\'t be shown.', null, els.idStatus);
		return;
	}

	els.displayName.value = player.display_name || '';
	els.firstName.value   = player.first_name || '';
	els.lastName.value    = player.last_name || '';

	els.detailsForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const displayName = els.displayName.value.trim();
		if (!displayName) {
			TDC.status(els.detailsStatus, 'Display name can\'t be empty.', 'error');
			return;
		}

		els.detailsBtn.disabled = true;
		TDC.status(els.detailsStatus, 'Saving…', '');
		try {
			const { data, error } = await supabaseClient
				.from('tbl_players')
				.update({
					display_name: displayName,
					first_name:   els.firstName.value.trim() || null,
					last_name:    els.lastName.value.trim() || null
				})
				.eq('id', player.id)
				.select('id');

			if (error) {
				TDC.showSupabaseError(AREA, error, els.detailsStatus);
				return;
			}
			if (!data || data.length !== 1) {
				TDC.error(AREA, 'details were not saved (no row updated).', { data }, els.detailsStatus);
				return;
			}
			TDC.status(els.detailsStatus, 'Details saved.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving your details.', err, els.detailsStatus);
		} finally {
			els.detailsBtn.disabled = false;
		}
	});

	// ─── Credits ───
	// Every active venue you could hold credits at. Today there's one venue, but this works for more later:
	// a venue picker only appears once there's a choice to make.
	async function loadCredits() {
		els.creditsList.textContent = '';

		const { data: venues, error: venErr } = await supabaseClient
			.from('tbl_venues')
			.select('id, name')
			.eq('active', true)
			.order('name');

		if (venErr) {
			TDC.error(AREA, 'could not load venues.', venErr, els.creditsStatus);
			return;
		}
		if (!venues || venues.length === 0) {
			els.creditsList.textContent = 'No venues yet.';
			els.redeemForm.hidden = true;
			return;
		}

		els.redeemVenue.innerHTML = '';
		for (const v of venues) {
			const opt = document.createElement('option');
			opt.value = v.id;
			opt.textContent = v.name;
			els.redeemVenue.appendChild(opt);
		}
		els.redeemVenueField.hidden = venues.length < 2;

		for (const v of venues) {
			const { data: balance, error: balErr } = await supabaseClient.rpc('tdc_my_credit_balance', { p_venue_id: v.id });
			const row = document.createElement('div');
			row.className = 'kv';
			const label = document.createElement('span');
			label.className = 'k';
			label.textContent = v.name;
			const value = document.createElement('span');
			value.className = 'v';
			if (balErr) {
				TDC.error(AREA, `could not load your balance at ${v.name}.`, balErr);
				value.textContent = 'TDC (Error)';
			} else {
				value.textContent = `${balance} credit${balance === 1 ? '' : 's'}`;
			}
			row.append(label, value);
			els.creditsList.appendChild(row);
		}
	}

	els.redeemForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const code = els.redeemCode.value.trim();
		if (!code) {
			TDC.status(els.creditsStatus, 'Please enter a code.', 'error');
			return;
		}

		els.redeemBtn.disabled = true;
		TDC.status(els.creditsStatus, 'Redeeming…', '');
		try {
			const { data, error } = await supabaseClient.rpc('tdc_redeem_code', {
				p_venue_id: els.redeemVenue.value,
				p_code: code
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.creditsStatus);
				return;
			}

			const row = (data || [])[0];
			els.redeemForm.reset();
			TDC.status(els.creditsStatus, `✓ ${row ? row.credits_added : ''} credits added.`, 'success');
			await loadCredits();
		} catch (err) {
			TDC.error(AREA, 'unexpected problem redeeming that code.', err, els.creditsStatus);
		} finally {
			els.redeemBtn.disabled = false;
		}
	});

	await loadCredits();

	// ─── ID verification ───
	function maskValue(identifier) {
		const last = identifier.value.slice(-3);
		return identifier.kind === 'passport'
			? `${identifier.issuing_country} •••••${last}`
			: `•••••••••• ${last}`;
	}

	function makeBadge(text, verified) {
		const span = document.createElement('span');
		span.className = 'badge' + (verified ? ' verified' : '');
		span.textContent = text;
		return span;
	}

	async function loadIdentity() {
		els.idList.textContent = '';

		const { data: identifiers, error: idErr } = await supabaseClient
			.from('tbl_player_identifiers')
			.select('id, kind, value, issuing_country, created_at')
			.eq('player_id', player.id)
			.in('kind', ['sa_id', 'passport'])
			.order('created_at');

		if (idErr) {
			TDC.error(AREA, 'could not load your ID details.', idErr, els.idStatus);
			return;
		}

		const { data: verifications, error: verErr } = await supabaseClient
			.from('tbl_identifier_verifications')
			.select('identifier_id, created_at, tbl_venues ( name )')
			.is('revoked_at', null);

		if (verErr) {
			TDC.error(AREA, 'could not load your verifications.', verErr, els.idStatus);
			return;
		}

		// No ID yet: show the form to add one.
		els.idForm.hidden = identifiers.length > 0;

		for (const identifier of identifiers) {
			const row = document.createElement('div');
			row.className = 'id-row';

			const label = document.createElement('div');
			label.className = 'muted';
			label.textContent = identifier.kind === 'sa_id' ? 'South African ID' : 'Passport';

			const value = document.createElement('div');
			value.className = 'id-value';
			value.textContent = maskValue(identifier);

			const badges = document.createElement('div');
			badges.className = 'badges';

			const mine = verifications.filter((v) => v.identifier_id === identifier.id);
			if (mine.length === 0) {
				badges.appendChild(makeBadge('Not verified', false));
				const hint = document.createElement('div');
				hint.className = 'muted';
				hint.style.marginTop = '0.4rem';
				hint.textContent = 'Show your ID document at the front desk to get verified.';
				row.append(label, value, badges, hint);
			} else {
				for (const v of mine) {
					const venueName = v.tbl_venues && v.tbl_venues.name ? v.tbl_venues.name : 'TDC (Unknown venue)';
					badges.appendChild(makeBadge('✓ Verified · ' + venueName, true));
				}
				row.append(label, value, badges);
			}

			els.idList.appendChild(row);
		}
	}

	// Passport needs a country; SA ID doesn't.
	els.idKind.addEventListener('change', () => {
		const passport = els.idKind.value === 'passport';
		els.idCountryField.hidden = !passport;
		els.idValueLabel.textContent = passport ? 'Passport number' : 'ID number';
		els.idValue.inputMode = passport ? 'text' : 'numeric';
	});

	els.idForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const kind = els.idKind.value;
		const value = els.idValue.value.trim();
		const country = els.idCountry.value.trim();

		if (!value) {
			TDC.status(els.idStatus, 'Please enter your ' + (kind === 'passport' ? 'passport number.' : 'ID number.'), 'error');
			return;
		}
		if (kind === 'passport' && !/^[A-Za-z]{2}$/.test(country)) {
			TDC.status(els.idStatus, 'Please enter the two-letter country code from your passport.', 'error');
			return;
		}

		els.idBtn.disabled = true;
		TDC.status(els.idStatus, 'Saving…', '');
		try {
			const { error } = await supabaseClient.rpc('tdc_add_my_identifier', {
				p_kind: kind,
				p_value: value,
				p_issuing_country: kind === 'passport' ? country : null
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.idStatus);
				return;
			}
			els.idForm.reset();
			TDC.status(els.idStatus, 'ID saved. Show your ID document at the front desk to get verified.', 'success');
			await loadIdentity();
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving your ID.', err, els.idStatus);
		} finally {
			els.idBtn.disabled = false;
		}
	});

	await loadIdentity();

	// ─── Earlier walk-in record with my confirmed email ───
	const { data: walkIns, error: findErr } = await supabaseClient.rpc('tdc_find_my_walk_in');
	if (findErr) {
		TDC.error(AREA, 'could not check for an earlier walk-in record.', findErr);
		return;
	}
	if (!walkIns || walkIns.length === 0) return;

	els.claimSection.hidden = false;
	for (const w of walkIns) {
		const row = document.createElement('div');
		row.className = 'id-row';

		const name = document.createElement('div');
		name.textContent = w.display_name;
		const sub = document.createElement('div');
		sub.className = 'muted';
		const full = [w.first_name, w.last_name].filter(Boolean).join(' ');
		const added = new Date(w.created_at).toLocaleDateString();
		sub.textContent = [full, 'added ' + added].filter(Boolean).join(' · ');

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn-primary';
		btn.style.marginTop = '0.5rem';
		btn.textContent = 'Link to My Account';
		btn.addEventListener('click', async () => {
			btn.disabled = true;
			TDC.status(els.claimStatus, 'Linking…', '');
			const { error } = await supabaseClient.rpc('tdc_claim_my_walk_in', { p_walk_in_player_id: w.player_id });
			if (error) {
				btn.disabled = false;
				TDC.showSupabaseError(AREA, error, els.claimStatus);
				return;
			}
			TDC.status(els.claimStatus, '✓ Linked. Reloading…', 'success');
			location.reload();
		});

		row.append(name, sub, btn);
		els.claimList.appendChild(row);
	}
})();
