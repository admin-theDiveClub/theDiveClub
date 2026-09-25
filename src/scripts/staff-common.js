// Shared helpers for staff pages (/staff/...).
// Needs: supabaseClient.js, tdc.js (loaded by layout.html). Load before the page's own script.

const TDCStaff = (() => {

	// Venues where the logged-in person is staff. Fills the <select>, shows the picker only for 2+ venues,
	// and keeps lineEl updated ("Working at X as role."). Returns the roles, or null (and shows why) if none.
	async function loadVenues(area, userId, els) {
		const { selectEl, fieldEl, lineEl, statusEl } = els;

		const { data: roles, error } = await supabaseClient
			.from('tbl_venue_staff')
			.select('venue_id, role, tbl_venues ( name )')
			.eq('user_id', userId);

		if (error) {
			TDC.error(area, 'could not check your staff role.', error, statusEl);
			return null;
		}
		if (!roles || roles.length === 0) {
			TDC.status(statusEl, 'This page is for venue staff only.', 'error');
			return null;
		}

		const venueName = (r) => (r.tbl_venues && r.tbl_venues.name) || 'TDC (Unknown venue)';
		for (const r of roles) {
			const opt = document.createElement('option');
			opt.value = r.venue_id;
			opt.textContent = `${venueName(r)} (${r.role})`;
			selectEl.appendChild(opt);
		}
		fieldEl.hidden = roles.length < 2;

		const updateLine = () => {
			const r = roles.find((x) => x.venue_id === selectEl.value);
			lineEl.textContent = r ? `Working at ${venueName(r)} as ${r.role}.` : 'TDC (Error): no venue selected.';
		};
		selectEl.addEventListener('change', updateLine);
		updateLine();
		return roles;
	}

	// Keep only characters that appear in names, so a search can't inject filter syntax.
	function cleanQuery(text) {
		return (text || '').replace(/[^\p{L}\p{N} .'@-]/gu, '').trim();
	}

	// Search players by display name, first name or surname.
	// options.linked: true = only players with an account, false = only players without one, undefined = all.
	// options.types: limit to these player types, e.g. ['walk_in', 'guest'].
	async function searchPlayers(text, options = {}) {
		const q = cleanQuery(text);
		if (q.length < 2) return { data: [], error: null, tooShort: true };

		const pattern = `%${q}%`;
		let query = supabaseClient
			.from('tbl_players')
			.select('id, display_name, first_name, last_name, player_type, user_id, created_at')
			.or(`display_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
			.order('display_name')
			.limit(10);

		if (options.linked === true)  query = query.not('user_id', 'is', null);
		if (options.linked === false) query = query.is('user_id', null);
		if (options.types)            query = query.in('player_type', options.types);

		const { data, error } = await query;
		return { data: data || [], error, tooShort: false };
	}

	const typeLabels = { member: 'member', walk_in: 'walk-in', guest: 'guest' };

	// "Display name" plus a line like "Walter Kerr · walk-in · no account".
	function playerLabel(p) {
		const full = [p.first_name, p.last_name].filter(Boolean).join(' ');
		const account = p.user_id ? 'has account' : 'no account';
		return {
			name: p.display_name,
			sub: [full, typeLabels[p.player_type] || p.player_type, account].filter(Boolean).join(' · ')
		};
	}

	// Show players as tappable buttons in container; onPick(player) is called on tap.
	function renderResults(container, players, onPick) {
		container.textContent = '';
		if (players.length === 0) {
			const none = document.createElement('div');
			none.className = 'muted';
			none.textContent = 'No players found.';
			container.appendChild(none);
			return;
		}
		for (const p of players) {
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
			btn.addEventListener('click', () => onPick(p));
			container.appendChild(btn);
		}
	}

	// Wire a search box to a results list, with a short pause while typing and protection
	// against slow older searches overwriting newer ones.
	function attachSearch(area, inputEl, resultsEl, statusEl, options, onPick) {
		let timer = null;
		let seq = 0;
		inputEl.addEventListener('input', () => {
			clearTimeout(timer);
			timer = setTimeout(async () => {
				const mySeq = ++seq;
				const { data, error, tooShort } = await searchPlayers(inputEl.value, options);
				if (mySeq !== seq) return;
				if (tooShort) {
					resultsEl.textContent = '';
					return;
				}
				if (error) {
					TDC.error(area, 'player search failed.', error, statusEl);
					return;
				}
				renderResults(resultsEl, data, onPick);
			}, 300);
		});
	}

	// One player by id (for links like /staff/verify/?player=...).
	async function getPlayer(area, id, statusEl) {
		const { data, error } = await supabaseClient
			.from('tbl_players')
			.select('id, display_name, first_name, last_name, player_type, user_id, created_at')
			.eq('id', id)
			.maybeSingle();
		if (error) {
			TDC.error(area, 'could not load that player.', error, statusEl);
			return null;
		}
		if (!data) {
			TDC.error(area, 'player not found.', { id }, statusEl);
			return null;
		}
		return data;
	}

	return { loadVenues, cleanQuery, searchPlayers, playerLabel, renderResults, attachSearch, getPlayer };
})();
