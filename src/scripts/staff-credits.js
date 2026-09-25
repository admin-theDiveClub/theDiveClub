// Staff credits page (/staff/credits/). Owners and admins only (the database checks again).
// Staff find a member or walk-in, see their balance, and can add or remove credits by hand with a reason.
// Guests never hold credits (their play is paid by their host), so they don't appear in this search.
// Needs: supabaseClient.js, tdc.js, staff-common.js.

(async () => {
	const AREA = 'StaffCredits';

	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea:    el('staff-area'),
		searchStep:   el('search-step'),
		search:       el('player-search'),
		results:      el('results'),
		balanceArea:  el('balance-area'),
		selectedName: el('selected-name'),
		selectedSub:  el('selected-sub'),
		balanceLine:  el('balance-line'),
		adjustArea:   el('adjust-area'),
		adjustForm:   el('adjust-form'),
		direction:    el('adjust-direction'),
		amount:       el('adjust-amount'),
		reason:       el('adjust-reason'),
		adjustBtn:    el('adjust-btn'),
		backBtn:      el('back-btn')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'credits page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	// Only owners and admins may be here. Staff-only members see why, and can switch venues if they hold
	// a better role elsewhere.
	function isAdminHere() {
		const r = roles.find((x) => x.venue_id === els.selectEl.value);
		return !!(r && ['owner', 'admin'].includes(r.role));
	}
	// ─── 1. Find the player (members and walk-ins only; guests never hold credits) ───
	let selectedPlayer = null;
	let balance = null;
	let idempotencyKey = null;

	function backToSearch() {
		selectedPlayer = null;
		balance = null;
		els.balanceArea.hidden = true;
		els.adjustArea.hidden = true;
		els.searchStep.hidden = false;
	}

	function updateAccess() {
		const allowed = isAdminHere();
		if (!allowed) {
			backToSearch();
			els.searchStep.hidden = true;
			TDC.status(els.statusEl, 'Credits are for owners and admins only at this venue.', 'error');
		} else {
			TDC.status(els.statusEl, '', '');
			els.searchStep.hidden = false;
		}
	}
	els.selectEl.addEventListener('change', updateAccess);
	updateAccess();

	TDCStaff.attachSearch(AREA, els.search, els.results, els.statusEl, { types: ['member', 'walk_in'] }, selectPlayer);

	async function selectPlayer(p) {
		selectedPlayer = p;
		const label = TDCStaff.playerLabel(p);
		els.selectedName.textContent = label.name;
		els.selectedSub.textContent = label.sub;
		els.searchStep.hidden = true;
		els.balanceArea.hidden = false;
		els.adjustArea.hidden = true;
		TDC.status(els.statusEl, '', '');
		await loadBalance();
	}

	async function loadBalance() {
		balance = null;
		els.balanceLine.textContent = 'Loading balance…';
		els.adjustArea.hidden = true;

		const { data, error } = await supabaseClient.rpc('tdc_staff_credit_balance', {
			p_venue_id: els.selectEl.value,
			p_player_id: selectedPlayer.id
		});

		if (error) {
			TDC.showSupabaseError(AREA, error, els.statusEl);
			els.balanceLine.textContent = 'TDC (Error): could not load balance.';
			return;
		}

		balance = data;
		els.balanceLine.textContent = `Balance: ${balance} credit${balance === 1 ? '' : 's'}`;
		freshKey();
		els.adjustForm.reset();
		els.adjustArea.hidden = false;
	}

	function freshKey() {
		idempotencyKey = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
	}

	els.backBtn.addEventListener('click', () => {
		TDC.status(els.statusEl, '', '');
		backToSearch();
		els.search.focus();
	});

	// ─── 2. Apply an adjustment ───
	els.adjustForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!selectedPlayer) {
			TDC.error(AREA, 'no player selected.', null, els.statusEl);
			return;
		}
		if (!idempotencyKey) {
			TDC.error(AREA, 'missing request id, please reload the balance.', null, els.statusEl);
			return;
		}

		const rawAmount = parseInt(els.amount.value, 10);
		const reason = els.reason.value.trim();

		if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
			TDC.status(els.statusEl, 'Please enter a whole number of credits, more than zero.', 'error');
			return;
		}
		if (reason.length < 3) {
			TDC.status(els.statusEl, 'Please give a reason for the adjustment (at least 3 characters).', 'error');
			return;
		}

		const signedAmount = els.direction.value === 'remove' ? -rawAmount : rawAmount;

		els.adjustBtn.disabled = true;
		TDC.status(els.statusEl, 'Applying…', '');
		try {
			const { data, error } = await supabaseClient.rpc('tdc_staff_adjust_credits', {
				p_venue_id: els.selectEl.value,
				p_player_id: selectedPlayer.id,
				p_amount: signedAmount,
				p_reason: reason,
				p_idempotency_key: idempotencyKey
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}

			balance = data;
			els.balanceLine.textContent = `Balance: ${balance} credit${balance === 1 ? '' : 's'}`;
			freshKey();
			els.adjustForm.reset();
			TDC.status(els.statusEl, `✓ Updated. New balance: ${balance}.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem applying the adjustment.', err, els.statusEl);
		} finally {
			els.adjustBtn.disabled = false;
		}
	});
})();
