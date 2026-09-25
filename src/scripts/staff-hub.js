// Staff hub (/staff/): lists the staff tools, only for venue staff.
// Needs: supabaseClient.js, tdc.js, staff-common.js.

(async () => {
	const AREA = 'StaffHub';
	const el = (id) => document.getElementById(id);
	const els = { lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg') };
	const area = el('staff-area');

	if (Object.values(els).some((v) => !v) || !area) {
		TDC.error(AREA, 'staff page is missing expected elements.');
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;

	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	area.hidden = false;

	// The Verifications tool is for owners and admins only (the database checks again).
	const tile = el('verifications-tile');
	if (!tile) {
		TDC.error(AREA, 'staff page is missing the verifications tile.');
		return;
	}
	const showTile = () => {
		const r = roles.find((x) => x.venue_id === els.selectEl.value);
		tile.hidden = !(r && ['owner', 'admin'].includes(r.role));
	};
	els.selectEl.addEventListener('change', showTile);
	showTile();
})();
