// Staff redeem-codes page (/staff/codes/). Redeeming and generating are open to all staff;
// voiding is owners/admins only (the database checks all of this again).
// Generated codes are shown once, for printing, then never seen again.
// Needs: supabaseClient.js, tdc.js, staff-common.js.

(async () => {
	const AREA = 'StaffCodes';

	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea:        el('staff-area'),
		redeemArea:       el('redeem-area'),
		redeemSearchStep: el('redeem-search-step'),
		redeemSearch:     el('redeem-player-search'),
		redeemResults:    el('redeem-results'),
		redeemForm:       el('redeem-form'),
		redeemSelectedName: el('redeem-selected-name'),
		redeemSelectedSub:  el('redeem-selected-sub'),
		redeemCode:       el('redeem-code'),
		redeemBtn:        el('redeem-btn'),
		redeemBackBtn:    el('redeem-back-btn'),
		generateArea: el('generate-area'),
		generateForm: el('generate-form'),
		credits:      el('gen-credits'),
		quantity:     el('gen-quantity'),
		note:         el('gen-note'),
		expiry:       el('gen-expiry'),
		generateBtn:  el('generate-btn'),
		resultArea:   el('result-area'),
		resultSub:    el('result-sub'),
		codeList:     el('code-list'),
		printBtn:     el('print-btn'),
		newBatchBtn:  el('new-batch-btn'),
		voidArea:     el('void-area'),
		voidForm:     el('void-form'),
		voidCode:     el('void-code'),
		voidBtn:      el('void-btn')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'codes page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	function isAdminHere() {
		const r = roles.find((x) => x.venue_id === els.selectEl.value);
		return !!(r && ['owner', 'admin'].includes(r.role));
	}
	function updateVoidVisibility() {
		els.voidArea.hidden = !isAdminHere();
	}
	els.selectEl.addEventListener('change', updateVoidVisibility);
	updateVoidVisibility();

	// ─── Redeem a code for a player (members and walk-ins; guests never hold credits) ───
	let redeemPlayer = null;

	function redeemBackToSearch() {
		redeemPlayer = null;
		els.redeemForm.hidden = true;
		els.redeemSearchStep.hidden = false;
	}

	TDCStaff.attachSearch(AREA, els.redeemSearch, els.redeemResults, els.statusEl, { types: ['member', 'walk_in'] }, (p) => {
		redeemPlayer = p;
		const label = TDCStaff.playerLabel(p);
		els.redeemSelectedName.textContent = label.name;
		els.redeemSelectedSub.textContent = label.sub;
		els.redeemSearchStep.hidden = true;
		els.redeemForm.hidden = false;
		TDC.status(els.statusEl, '', '');
		els.redeemCode.focus();
	});

	els.redeemBackBtn.addEventListener('click', () => {
		TDC.status(els.statusEl, '', '');
		redeemBackToSearch();
		els.redeemSearch.focus();
	});

	els.redeemForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!redeemPlayer) {
			TDC.error(AREA, 'no player selected.', null, els.statusEl);
			return;
		}
		const code = els.redeemCode.value.trim();
		if (!code) {
			TDC.status(els.statusEl, 'Please enter a code.', 'error');
			return;
		}

		els.redeemBtn.disabled = true;
		TDC.status(els.statusEl, 'Redeeming…', '');
		try {
			const { data, error } = await supabaseClient.rpc('tdc_redeem_code', {
				p_venue_id: els.selectEl.value,
				p_code: code,
				p_player_id: redeemPlayer.id
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}

			const row = (data || [])[0];
			const who = redeemPlayer.display_name;
			redeemBackToSearch();
			els.redeemSearch.value = '';
			els.redeemResults.textContent = '';
			TDC.status(els.statusEl, `✓ ${row ? row.credits_added : ''} credits added for ${who}. New balance: ${row ? row.new_balance : '?'}.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem redeeming that code.', err, els.statusEl);
		} finally {
			els.redeemBtn.disabled = false;
		}
	});

	// ─── Generate ───
	els.generateForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		const credits = parseInt(els.credits.value, 10);
		const quantity = parseInt(els.quantity.value, 10);
		const note = els.note.value.trim();
		const expiryDays = els.expiry.value.trim();

		if (!Number.isInteger(credits) || credits < 1) {
			TDC.status(els.statusEl, 'Please enter how many credits each code is worth.', 'error');
			return;
		}
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) {
			TDC.status(els.statusEl, 'Please enter how many codes to generate (1 to 200).', 'error');
			return;
		}
		let expiresAt = null;
		if (expiryDays) {
			const days = parseInt(expiryDays, 10);
			if (!Number.isInteger(days) || days < 1) {
				TDC.status(els.statusEl, 'Please enter a whole number of days, or leave expiry blank.', 'error');
				return;
			}
			expiresAt = new Date(Date.now() + days * 86400000).toISOString();
		}

		els.generateBtn.disabled = true;
		TDC.status(els.statusEl, 'Generating…', '');
		try {
			const { data, error } = await supabaseClient.rpc('tdc_generate_redeem_codes', {
				p_venue_id: els.selectEl.value,
				p_credits: credits,
				p_quantity: quantity,
				p_note: note || null,
				p_expires_at: expiresAt
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}

			showResult(data || [], credits, note, expiresAt);
			TDC.status(els.statusEl, `✓ Generated ${(data || []).length} code${(data || []).length === 1 ? '' : 's'}.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem generating codes.', err, els.statusEl);
		} finally {
			els.generateBtn.disabled = false;
		}
	});

	function showResult(rows, credits, note, expiresAt) {
		els.codeList.textContent = '';
		for (const row of rows) {
			const item = document.createElement('div');
			item.className = 'code-item';
			const code = document.createElement('div');
			code.className = 'code-value';
			code.textContent = row.code;
			const value = document.createElement('div');
			value.className = 'code-value-credits';
			value.textContent = `${credits} credit${credits === 1 ? '' : 's'}`;
			item.append(code, value);
			els.codeList.appendChild(item);
		}

		const bits = [`${rows.length} code${rows.length === 1 ? '' : 's'}`, `${credits} credit${credits === 1 ? '' : 's'} each`];
		if (expiresAt) bits.push(`expires ${new Date(expiresAt).toLocaleDateString()}`);
		if (note) bits.push(note);
		els.resultSub.textContent = ' · ' + bits.join(' · ');

		els.redeemArea.hidden = true;
		els.generateArea.hidden = true;
		els.voidArea.hidden = true;
		els.resultArea.hidden = false;
	}

	els.printBtn.addEventListener('click', () => window.print());

	els.newBatchBtn.addEventListener('click', () => {
		els.resultArea.hidden = true;
		els.codeList.textContent = '';
		els.generateForm.reset();
		els.quantity.value = '1';
		els.redeemArea.hidden = false;
		els.generateArea.hidden = false;
		updateVoidVisibility();
		TDC.status(els.statusEl, '', '');
	});

	// ─── Void ───
	els.voidForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const code = els.voidCode.value.trim();
		if (!code) {
			TDC.status(els.statusEl, 'Please enter the code to void.', 'error');
			return;
		}

		els.voidBtn.disabled = true;
		TDC.status(els.statusEl, 'Voiding…', '');
		try {
			const { error } = await supabaseClient.rpc('tdc_void_redeem_code', {
				p_venue_id: els.selectEl.value,
				p_code: code
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}

			els.voidForm.reset();
			TDC.status(els.statusEl, '✓ Code voided.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem voiding the code.', err, els.statusEl);
		} finally {
			els.voidBtn.disabled = false;
		}
	});
})();
