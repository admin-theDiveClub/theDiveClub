// Staff: link a walk-in/guest record to a player's account (/staff/link/).
// Needs: supabaseClient.js, tdc.js, staff-common.js.

(async () => {
	const AREA = 'StaffLink';
	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea: el('staff-area'),
		stepWalkin: el('step-walkin'), walkinSearch: el('walkin-search'), walkinResults: el('walkin-results'),
		walkinSelected: el('walkin-selected'), walkinName: el('walkin-name'), walkinSub: el('walkin-sub'),
		stepAccount: el('step-account'), accountSearch: el('account-search'), accountResults: el('account-results'),
		accountSelected: el('account-selected'), accountName: el('account-name'), accountSub: el('account-sub'),
		stepConfirm: el('step-confirm'), linkBtn: el('link-btn'), restartBtn: el('restart-btn')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'link page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	let walkin = null;
	let account = null;

	function show(selectedEl, nameEl, subEl, p) {
		const label = TDCStaff.playerLabel(p);
		nameEl.textContent = label.name;
		subEl.textContent = label.sub;
		selectedEl.hidden = false;
	}

	// 1. Walk-in or guest records without an account.
	TDCStaff.attachSearch(AREA, els.walkinSearch, els.walkinResults, els.statusEl,
		{ linked: false, types: ['walk_in', 'guest'] },
		(p) => {
			walkin = p;
			show(els.walkinSelected, els.walkinName, els.walkinSub, p);
			els.stepWalkin.hidden = true;
			els.stepAccount.hidden = false;
			els.restartBtn.hidden = false;
			els.accountSearch.focus();
		});

	// 2. Players with an account.
	TDCStaff.attachSearch(AREA, els.accountSearch, els.accountResults, els.statusEl,
		{ linked: true },
		(p) => {
			account = p;
			show(els.accountSelected, els.accountName, els.accountSub, p);
			els.stepAccount.hidden = true;
			els.stepConfirm.hidden = false;
		});

	function restart() {
		walkin = null;
		account = null;
		for (const x of [els.walkinSelected, els.accountSelected, els.stepAccount, els.stepConfirm, els.restartBtn]) x.hidden = true;
		els.stepWalkin.hidden = false;
		els.walkinSearch.value = '';
		els.accountSearch.value = '';
		els.walkinResults.textContent = '';
		els.accountResults.textContent = '';
	}
	els.restartBtn.addEventListener('click', () => {
		restart();
		TDC.status(els.statusEl, '', '');
	});

	// 3. Link.
	els.linkBtn.addEventListener('click', async () => {
		if (!walkin || !account) {
			TDC.error(AREA, 'both records must be selected.', { walkin, account }, els.statusEl);
			return;
		}

		els.linkBtn.disabled = true;
		TDC.status(els.statusEl, 'Linking…', '');
		try {
			const { error } = await supabaseClient.rpc('tdc_staff_link_account', {
				p_venue_id: els.selectEl.value,
				p_walk_in_player_id: walkin.id,
				p_account_player_id: account.id
			});

			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}
			const who = account.display_name;
			restart();
			TDC.status(els.statusEl, `✓ Linked. ${who}'s account now holds the walk-in record.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem linking.', err, els.statusEl);
		} finally {
			els.linkBtn.disabled = false;
		}
	});
})();
