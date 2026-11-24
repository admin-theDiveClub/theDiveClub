// Staff credits page (/staff/credits/). Owners and admins only (the database checks again).
// Staff find a member or walk-in, see their balance, and can add or remove credits by hand with a reason.
// Guests never hold credits (their play is paid by their host), so they don't appear in this search.
// Needs: supabaseClient.js, tdc.js, staff-common.js.

TDCLoader.hold((async () => {
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
		els.selectedSub.replaceChildren(label.sub);
		els.searchStep.hidden = true;
		els.balanceArea.hidden = false;
		els.adjustArea.hidden = true;
		TDC.status(els.statusEl, '', '');
		await loadBalance();
	}

	async function loadBalance() {
		balance = null;
		// Blank but keeping its height, with the dots on it while it loads (UV,
		// 29 Oct: never a loading message).
		els.balanceLine.textContent = '\u00a0';
		els.adjustArea.hidden = true;

		const { data, error } = await TDC.busy(els.balanceLine, supabaseClient.rpc('tdc_staff_credit_balance', {
			p_venue_id: els.selectEl.value,
			p_player_id: selectedPlayer.id
		}), els.statusEl);

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
		TDC.status(els.statusEl, '', '');
		try {
			const { data, error } = await TDC.busy(els.adjustBtn, supabaseClient.rpc('tdc_staff_adjust_credits', {
				p_venue_id: els.selectEl.value,
				p_player_id: selectedPlayer.id,
				p_amount: signedAmount,
				p_reason: reason,
				p_idempotency_key: idempotencyKey
			}), els.statusEl);

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

	// ─── 3. Pricing (24 Nov; docs/design/shop.md, Stage 1) ───
	// What a credit costs on the Add credits card, the slider's range and the
	// discount steps (money off), for a venue that sells credits. The database
	// checks it all again (tdc_set_credit_prices): a step that doesn't fit the
	// range, discounts that don't rise or sit off the slider are refused there
	// with a message written for people.
	const pe = {
		section: el('pricing'), form: el('pricing-form'), rand: el('price-rand'), min: el('price-min'),
		max: el('price-max'), step: el('price-step'), tiers: el('tier-list'), add: el('tier-add'),
		save: el('pricing-save'), status: el('pricing-status')
	};
	const peMissing = Object.entries(pe).filter(([, v]) => !v).map(([k]) => k);
	if (peMissing.length) {
		TDC.error(AREA, 'credits page is missing its pricing elements: ' + peMissing.join(', '), null, els.statusEl);
		return;
	}

	function tierRow(t) {
		const row = document.createElement('div');
		row.className = 'tier-row';
		const at = document.createElement('input');
		at.type = 'number';
		at.inputMode = 'numeric';
		at.min = '1';
		at.step = '1';
		at.className = 'tier-at';
		at.setAttribute('aria-label', 'From this many credits');
		at.value = t ? String(t.at) : '';
		const pct = document.createElement('input');
		pct.type = 'number';
		pct.inputMode = 'numeric';
		pct.min = '1';
		pct.max = '90';
		pct.step = '1';
		pct.className = 'tier-pct';
		pct.setAttribute('aria-label', 'Percent off');
		pct.value = t ? String(t.pct) : '';
		// Plain boxes, not steppers: a stepper's chevrons left no room for "1000".
		at.dataset.control = 'none';
		pct.dataset.control = 'none';
		// Each box kept with its words, so a narrow screen wraps between the pairs.
		const pair = (...parts) => {
			const g = document.createElement('span');
			g.className = 'tier-pair';
			g.append(...parts);
			return g;
		};
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'btn-sm btn-danger';
		remove.textContent = 'Remove';
		remove.addEventListener('click', () => row.remove());
		row.append(pair('From', at, 'credits'), pair(pct, '% off'), remove);
		return row;
	}

	async function loadPricing() {
		pe.section.hidden = true;
		TDC.status(pe.status, '', '');
		if (!isAdminHere()) return;
		const id = els.selectEl.value;
		const { data: v, error: vErr } = await supabaseClient.from('tbl_venues').select('sells_credits').eq('id', id).maybeSingle();
		if (id !== els.selectEl.value) return;
		if (vErr) {
			TDC.error(AREA, 'could not check whether this venue sells credits.', vErr, els.statusEl);
			return;
		}
		if (!v || !v.sells_credits) return;
		pe.section.hidden = false;
		const { data, error } = await TDC.busy(pe.form, supabaseClient.rpc('tdc_credit_prices', { p_venue_id: id }), pe.status);
		if (id !== els.selectEl.value) return;
		if (error) {
			TDC.showSupabaseError(AREA, error, pe.status);
			return;
		}
		pe.rand.value = (data.cents_per_credit / 100).toFixed(2);
		pe.min.value = String(data.min_credits);
		pe.max.value = String(data.max_credits);
		pe.step.value = String(data.step_credits);
		pe.tiers.replaceChildren(...(data.tiers || []).map(tierRow));
	}

	pe.add.addEventListener('click', () => pe.tiers.appendChild(tierRow(null)));

	pe.form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const rand = parseFloat(pe.rand.value);
		const cents = Math.round(rand * 100);
		const ints = [pe.min, pe.max, pe.step].map((i) => parseInt(i.value, 10));
		if (!Number.isFinite(rand) || cents < 1) {
			TDC.status(pe.status, 'Please enter what one credit costs, at least 1 cent.', 'error');
			return;
		}
		if (ints.some((n) => !Number.isInteger(n))) {
			TDC.status(pe.status, 'Please fill in the fewest and most credits and the step.', 'error');
			return;
		}
		const tiers = [];
		for (const row of pe.tiers.querySelectorAll('.tier-row')) {
			const at = parseInt(row.querySelector('.tier-at').value, 10);
			const pct = parseInt(row.querySelector('.tier-pct').value, 10);
			if (!Number.isInteger(at) || !Number.isInteger(pct)) {
				TDC.status(pe.status, 'Each discount needs a number of credits and a percent, or remove it.', 'error');
				return;
			}
			tiers.push({ at, pct });
		}
		tiers.sort((a, b) => a.at - b.at);

		pe.save.disabled = true;
		TDC.status(pe.status, '', '');
		try {
			const { error } = await TDC.busy(pe.save, supabaseClient.rpc('tdc_set_credit_prices', {
				p_venue_id: els.selectEl.value,
				p_cents_per_credit: cents,
				p_min_credits: ints[0],
				p_max_credits: ints[1],
				p_step_credits: ints[2],
				p_tiers: tiers
			}), pe.status);
			if (error) {
				TDC.showSupabaseError(AREA, error, pe.status);
				return;
			}
			await loadPricing();
			TDC.status(pe.status, '✓ Pricing saved. New requests use it; ones already waiting keep their price.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the pricing.', err, pe.status);
		} finally {
			pe.save.disabled = false;
		}
	});

	els.selectEl.addEventListener('change', loadPricing);
	await loadPricing();
})(), 'StaffCredits');
