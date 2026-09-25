// Staff ID verification page (/staff/verify/).
// Staff find a player, type the number from the physical ID document, and the database checks it
// against what's on file. Staff never see the stored number.
// Opening /staff/verify/?player=<id> selects that player straight away (used after adding a walk-in).
// Needs: supabaseClient.js, tdc.js, staff-common.js.

(async () => {
	const AREA = 'StaffVerify';

	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea:    el('staff-area'),
		searchStep:   el('search-step'),
		search:       el('player-search'),
		results:      el('results'),
		verifyForm:   el('verify-form'),
		selectedName: el('selected-name'),
		selectedSub:  el('selected-sub'),
		docKind:      el('doc-kind'),
		docNumber:    el('doc-number'),
		docLabel:     el('doc-number-label'),
		countryField: el('doc-country-field'),
		docCountry:   el('doc-country'),
		verifyBtn:    el('verify-btn'),
		backBtn:      el('back-btn')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'verify page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	// ─── 1. Find the player ───
	let selectedPlayer = null;

	function selectPlayer(p) {
		selectedPlayer = p;
		const label = TDCStaff.playerLabel(p);
		els.selectedName.textContent = label.name;
		els.selectedSub.textContent = label.sub;
		els.searchStep.hidden = true;
		els.verifyForm.hidden = false;
		TDC.status(els.statusEl, '', '');
		els.docNumber.focus();
	}

	TDCStaff.attachSearch(AREA, els.search, els.results, els.statusEl, {}, selectPlayer);

	function backToSearch() {
		selectedPlayer = null;
		els.verifyForm.reset();
		els.countryField.hidden = true;
		els.verifyForm.hidden = true;
		els.searchStep.hidden = false;
		els.search.focus();
	}
	els.backBtn.addEventListener('click', () => {
		TDC.status(els.statusEl, '', '');
		backToSearch();
	});

	// Came from "Verify their ID now"?
	const preselect = new URLSearchParams(location.search).get('player');
	if (preselect) {
		const p = await TDCStaff.getPlayer(AREA, preselect, els.statusEl);
		if (p) selectPlayer(p);
	}

	// ─── 2. Check the document ───
	els.docKind.addEventListener('change', () => {
		const passport = els.docKind.value === 'passport';
		els.countryField.hidden = !passport;
		els.docLabel.textContent = passport ? 'Passport number on the document' : 'ID number on the document';
		els.docNumber.inputMode = passport ? 'text' : 'numeric';
	});

	els.verifyForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!selectedPlayer) {
			TDC.error(AREA, 'no player selected.', null, els.statusEl);
			return;
		}

		const kind = els.docKind.value;
		const number = els.docNumber.value.trim();
		const country = els.docCountry.value.trim();

		if (!number) {
			TDC.status(els.statusEl, 'Please type the number from the document.', 'error');
			return;
		}
		if (kind === 'passport' && !/^[A-Za-z]{2}$/.test(country)) {
			TDC.status(els.statusEl, 'Please enter the two-letter country code from the passport.', 'error');
			return;
		}

		els.verifyBtn.disabled = true;
		TDC.status(els.statusEl, 'Checking…', '');
		try {
			const { error } = await supabaseClient.rpc('tdc_verify_identifier', {
				p_venue_id: els.selectEl.value,
				p_player_id: selectedPlayer.id,
				p_kind: kind,
				p_value_from_document: number,
				p_issuing_country: kind === 'passport' ? country : null
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}

			const who = selectedPlayer.display_name;
			backToSearch();
			els.search.value = '';
			els.results.textContent = '';
			TDC.status(els.statusEl, `✓ ${who} is now verified.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem verifying.', err, els.statusEl);
		} finally {
			els.verifyBtn.disabled = false;
		}
	});
})();
