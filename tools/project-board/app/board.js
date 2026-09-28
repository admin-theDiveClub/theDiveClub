// Project Board (/staff/board/): the owner's task list for the business and the website.
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).
// Data: tbl_pm_groups, tbl_pm_people, tbl_pm_items, tbl_pm_links (migration 20260928103000_project_board).
//
// Step 3 check: confirms the page, login, owner access and data all connect. The full board replaces this.

(async () => {
	const AREA = 'Board';
	const root = document.getElementById('pm-board');
	const statusEl = document.getElementById('pm-status');
	if (!root || !statusEl) {
		TDC.error(AREA, 'board page is missing expected elements.');
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;

	const { data: roles, error: roleErr } = await supabaseClient
		.from('tbl_venue_staff')
		.select('venue_id, role, tbl_venues ( name )')
		.eq('user_id', session.user.id)
		.eq('role', 'owner');
	if (roleErr) {
		TDC.error(AREA, 'could not check your role.', roleErr, statusEl);
		return;
	}
	if (!roles || roles.length === 0) {
		root.textContent = '';
		TDC.status(statusEl, 'The Project Board is for venue owners only.', 'error');
		return;
	}

	const venue = roles[0];
	const count = async (table) => {
		const { count: n, error } = await supabaseClient.from(table).select('id', { count: 'exact', head: true }).eq('venue_id', venue.venue_id);
		if (error) throw error;
		return n;
	};
	try {
		const [items, groups, people, links] = await Promise.all(['tbl_pm_items', 'tbl_pm_groups', 'tbl_pm_people', 'tbl_pm_links'].map(count));
		root.innerHTML = '';
		const h = document.createElement('h1');
		h.textContent = 'Project Board';
		const p = document.createElement('p');
		p.textContent = `Connected to ${venue.tbl_venues ? venue.tbl_venues.name : 'TDC (Unknown venue)'}: ${items} tasks, ${groups} groups, ${people} people, ${links} links.`;
		root.append(h, p);
	} catch (err) {
		TDC.error(AREA, 'could not load the board.', err, statusEl);
	}
})();
