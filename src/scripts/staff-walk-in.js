// Staff: add a walk-in or guest (/staff/walk-in/).
// Needs: supabaseClient.js, tdc.js, staff-common.js.

(async () => {
	const AREA = 'StaffWalkIn';
	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea: el('staff-area'),
		existingSearch: el('existing-search'), existingResults: el('existing-results'),
		form: el('walkin-form'), playerType: el('player-type'),
		hostArea: el('host-area'), hostSearch: el('host-search'), hostResults: el('host-results'),
		hostSelected: el('host-selected'), hostName: el('host-name'), hostSub: el('host-sub'),
		displayName: el('display-name'), firstName: el('first-name'), lastName: el('last-name'),
		docKind: el('doc-kind'), docNumberField: el('doc-number-field'), docNumberLabel: el('doc-number-label'),
		docNumber: el('doc-number'), docCountryField: el('doc-country-field'), docCountry: el('doc-country'),
		phone: el('phone'), email: el('email'), saveBtn: el('save-btn'),
		doneArea: el('done-area'), verifyNowLink: el('verify-now-link'), anotherBtn: el('another-btn')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'walk-in page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	// Existing-player check: tapping a result just says they already exist.
	TDCStaff.attachSearch(AREA, els.existingSearch, els.existingResults, els.statusEl, {}, (p) => {
		TDC.status(els.statusEl, `${p.display_name} is already a player. No need to add them again.`, 'success');
	});

	// Guest host picker.
	let host = null;
	TDCStaff.attachSearch(AREA, els.hostSearch, els.hostResults, els.statusEl, {}, (p) => {
		host = p;
		const label = TDCStaff.playerLabel(p);
		els.hostName.textContent = label.name;
		els.hostSub.textContent = label.sub;
		els.hostSelected.hidden = false;
		els.hostResults.textContent = '';
	});

	els.playerType.addEventListener('change', () => {
		els.hostArea.hidden = els.playerType.value !== 'guest';
	});

	els.docKind.addEventListener('change', () => {
		const kind = els.docKind.value;
		els.docNumberField.hidden = kind === '';
		els.docCountryField.hidden = kind !== 'passport';
		els.docNumberLabel.textContent = kind === 'passport' ? 'Passport number' : 'ID number';
		els.docNumber.inputMode = kind === 'passport' ? 'text' : 'numeric';
	});

	function resetAll() {
		els.form.reset();
		host = null;
		els.hostSelected.hidden = true;
		els.hostResults.textContent = '';
		els.hostArea.hidden = true;
		els.docNumberField.hidden = true;
		els.docCountryField.hidden = true;
		els.existingSearch.value = '';
		els.existingResults.textContent = '';
	}

	els.anotherBtn.addEventListener('click', () => {
		resetAll();
		els.doneArea.hidden = true;
		els.form.hidden = false;
		TDC.status(els.statusEl, '', '');
	});

	els.form.addEventListener('submit', async (e) => {
		e.preventDefault();

		const type = els.playerType.value;
		const displayName = els.displayName.value.trim();
		const docKind = els.docKind.value;
		const docNumber = els.docNumber.value.trim();
		const docCountry = els.docCountry.value.trim();

		if (!displayName) {
			TDC.status(els.statusEl, 'Please enter a display name.', 'error');
			return;
		}
		if (type === 'guest' && !host) {
			TDC.status(els.statusEl, 'Please choose whose guest this is.', 'error');
			return;
		}
		if (docKind && !docNumber) {
			TDC.status(els.statusEl, 'Please enter the document number, or set ID document to None.', 'error');
			return;
		}
		if (docKind === 'passport' && !/^[A-Za-z]{2}$/.test(docCountry)) {
			TDC.status(els.statusEl, 'Please enter the two-letter country code from the passport.', 'error');
			return;
		}

		els.saveBtn.disabled = true;
		TDC.status(els.statusEl, 'Saving…', '');
		try {
			const { data: playerId, error } = await supabaseClient.rpc('tdc_create_walk_in', {
				p_venue_id: els.selectEl.value,
				p_display_name: displayName,
				p_first_name: els.firstName.value.trim() || null,
				p_last_name: els.lastName.value.trim() || null,
				p_player_type: type,
				p_guest_of_player_id: type === 'guest' ? host.id : null,
				p_sa_id: docKind === 'sa_id' ? docNumber : null,
				p_passport: docKind === 'passport' ? docNumber : null,
				p_passport_country: docKind === 'passport' ? docCountry : null,
				p_phone: els.phone.value.trim() || null,
				p_email: els.email.value.trim() || null
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}
			if (!playerId) {
				TDC.error(AREA, 'player was not created (no id returned).', null, els.statusEl);
				return;
			}

			els.form.hidden = true;
			els.doneArea.hidden = false;
			els.verifyNowLink.hidden = !docKind;
			els.verifyNowLink.href = '/staff/verify/?player=' + encodeURIComponent(playerId);
			TDC.status(els.statusEl, `✓ ${displayName} added.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem adding the player.', err, els.statusEl);
		} finally {
			els.saveBtn.disabled = false;
		}
	});
})();
