// Owners/admins: review and revoke ID verifications done at their venue (/staff/verifications/).
// Revoking keeps the record, marked as revoked with a reason.
// Needs: supabaseClient.js, tdc.js, staff-common.js.

(async () => {
	const AREA = 'StaffVerifications';
	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea: el('staff-area'), filter: el('filter'), list: el('list')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'verifications page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;

	const role = () => (roles.find((r) => r.venue_id === els.selectEl.value) || {}).role;
	els.staffArea.hidden = false;

	const kindLabel = { sa_id: 'SA ID', passport: 'Passport' };
	const when = (ts) => new Date(ts).toLocaleString();

	function line(text, cls) {
		const d = document.createElement('div');
		if (cls) d.className = cls;
		d.textContent = text;
		return d;
	}

	async function load() {
		els.list.textContent = '';
		if (!['owner', 'admin'].includes(role())) {
			TDC.status(els.statusEl, 'Only owners and admins can review verifications.', 'error');
			return;
		}

		const { data, error } = await supabaseClient.rpc('tdc_list_venue_verifications', { p_venue_id: els.selectEl.value });
		if (error) {
			TDC.showSupabaseError(AREA, error, els.statusEl);
			return;
		}

		const show = els.filter.value;
		const rows = (data || []).filter((v) =>
			show === 'all' || (show === 'active' ? !v.revoked_at : !!v.revoked_at));

		if (rows.length === 0) {
			els.list.appendChild(line('No verifications to show.', 'muted'));
			return;
		}

		for (const v of rows) {
			const card = document.createElement('div');
			card.className = 'selected-player';
			if (v.revoked_at) card.style.borderColor = 'var(--border-color)';

			card.append(
				line(v.player_name || 'TDC (No name)'),
				line(`${kindLabel[v.document_kind] || v.document_kind} ${v.document_hint}`, 'sub'),
				line(`Verified by ${v.verified_by_name} · ${when(v.verified_at)}`, 'sub')
			);

			if (v.revoked_at) {
				card.append(line(`Revoked by ${v.revoked_by_name || 'TDC (Unknown staff)'} · ${when(v.revoked_at)} · "${v.revoke_reason}"`, 'sub'));
			} else {
				const reason = document.createElement('input');
				reason.type = 'text';
				reason.placeholder = 'Reason for revoking';
				reason.maxLength = 200;
				reason.style.marginTop = '0.75rem';

				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'btn-secondary';
				btn.style.marginTop = '0.5rem';
				btn.textContent = 'Revoke';
				btn.addEventListener('click', async () => {
					if (!reason.value.trim()) {
						TDC.status(els.statusEl, 'Please give a reason for revoking.', 'error');
						reason.focus();
						return;
					}
					btn.disabled = true;
					const { error: revErr } = await supabaseClient.rpc('tdc_revoke_verification', {
						p_verification_id: v.verification_id,
						p_reason: reason.value.trim()
					});
					if (revErr) {
						btn.disabled = false;
						TDC.showSupabaseError(AREA, revErr, els.statusEl);
						return;
					}
					TDC.status(els.statusEl, `✓ Verification for ${v.player_name} revoked.`, 'success');
					await load();
				});

				card.append(reason, btn);
			}
			els.list.appendChild(card);
		}
	}

	els.filter.addEventListener('change', () => { TDC.status(els.statusEl, '', ''); load(); });
	els.selectEl.addEventListener('change', () => { TDC.status(els.statusEl, '', ''); load(); });
	await load();
})();
