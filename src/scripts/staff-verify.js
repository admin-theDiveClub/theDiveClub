// Staff ID verification page (/staff/verify/).
// Staff find a player, type the number from the physical ID document, and the database checks it
// against what the player entered. Staff never see the stored number.
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).

(async () => {
	const AREA = 'StaffVerify';

	const el = (id) => document.getElementById(id);
	const els = {
		venueLine:    el('venue-line'),
		staffArea:    el('staff-area'),
		venueField:   el('venue-field'),
		venueSelect:  el('venue-select'),
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
		backBtn:      el('back-btn'),
		statusEl:     el('status-msg')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'verify page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;

	// ─── Which venues is this person staff at? ───
	const { data: roles, error: rolesErr } = await supabaseClient
		.from('tbl_venue_staff')
		.select('venue_id, role, tbl_venues ( name )')
		.eq('user_id', session.user.id);

	if (rolesErr) {
		TDC.error(AREA, 'could not check your staff role.', rolesErr, els.statusEl);
		return;
	}
	if (!roles || roles.length === 0) {
		TDC.status(els.statusEl, 'This page is for venue staff only.', 'error');
		return;
	}

	const venueName = (r) => (r.tbl_venues && r.tbl_venues.name) || 'TDC (Unknown venue)';

	for (const r of roles) {
		const opt = document.createElement('option');
		opt.value = r.venue_id;
		opt.textContent = `${venueName(r)} (${r.role})`;
		els.venueSelect.appendChild(opt);
	}
	els.venueField.hidden = roles.length < 2;

	function updateVenueLine() {
		const r = roles.find((x) => x.venue_id === els.venueSelect.value);
		els.venueLine.textContent = r ? `Verifying for ${venueName(r)} as ${r.role}.` : 'TDC (Error): no venue selected.';
	}
	els.venueSelect.addEventListener('change', updateVenueLine);
	updateVenueLine();
	els.staffArea.hidden = false;

	// ─── 1. Find the player ───
	let selectedPlayer = null;
	let searchTimer = null;
	let searchSeq = 0;

	function playerLabel(p) {
		const full = [p.first_name, p.last_name].filter(Boolean).join(' ');
		return { name: p.display_name, sub: [full, p.player_type].filter(Boolean).join(' · ') };
	}

	async function runSearch() {
		// Keep only characters that can appear in names, so the search can't be used to inject filter syntax.
		const q = els.search.value.replace(/[^\p{L}\p{N} .'@-]/gu, '').trim();
		els.results.textContent = '';
		if (q.length < 2) return;

		const mySeq = ++searchSeq;
		const pattern = `%${q}%`;
		const { data, error } = await supabaseClient
			.from('tbl_players')
			.select('id, display_name, first_name, last_name, player_type, user_id')
			.or(`display_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
			.order('display_name')
			.limit(10);

		if (mySeq !== searchSeq) return; // a newer search has started

		if (error) {
			TDC.error(AREA, 'player search failed.', error, els.statusEl);
			return;
		}
		if (data.length === 0) {
			const none = document.createElement('div');
			none.className = 'muted';
			none.textContent = 'No players found.';
			els.results.appendChild(none);
			return;
		}

		for (const p of data) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'result';
			const label = playerLabel(p);
			const name = document.createElement('div');
			name.textContent = label.name;
			const sub = document.createElement('div');
			sub.className = 'sub';
			sub.textContent = label.sub;
			btn.append(name, sub);
			btn.addEventListener('click', () => selectPlayer(p));
			els.results.appendChild(btn);
		}
	}

	els.search.addEventListener('input', () => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(runSearch, 300);
	});

	function selectPlayer(p) {
		selectedPlayer = p;
		const label = playerLabel(p);
		els.selectedName.textContent = label.name;
		els.selectedSub.textContent = label.sub;
		els.searchStep.hidden = true;
		els.verifyForm.hidden = false;
		TDC.status(els.statusEl, '', '');
		els.docNumber.focus();
	}

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
				p_venue_id: els.venueSelect.value,
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
