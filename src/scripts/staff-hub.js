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
})();
