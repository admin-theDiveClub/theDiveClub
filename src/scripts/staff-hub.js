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

	// The Verifications and Credits tools are for owners and admins only (the database checks again).
	const adminTiles = [el('verifications-tile'), el('credits-tile')];
	if (adminTiles.some((t) => !t)) {
		TDC.error(AREA, 'staff page is missing an owner/admin tile.');
		return;
	}
	const showTiles = () => {
		const r = roles.find((x) => x.venue_id === els.selectEl.value);
		const isAdmin = !!(r && ['owner', 'admin'].includes(r.role));
		for (const t of adminTiles) t.hidden = !isAdmin;
	};
	els.selectEl.addEventListener('change', showTiles);
	showTiles();
})();
