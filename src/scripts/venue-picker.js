// The venues a competition is played at: a search box that adds each venue as a
// pill, on the two create pages and the two Settings tabs (UV, 5 Nov; venues
// step 2). The search looks like the referee's (TDCMatchDef.playerPicker).
//
// Played at only. It gives a venue's staff no rights and needs no approval, so
// anyone running a competition may add any open venue. The venue a competition
// BELONGS to is tbl_leagues.venue_id and tbl_tournaments.venue_id, which decide
// staff rights and are not chosen here (docs/systems/foundations.md, "Venues").
//
// A page says where to draw it, reads with load() and, on saving, calls save()
// if changed() says so. tdc_set_tournament_venues and
// tdc_set_league_season_venues take the whole list in order, and the order here
// is the order they were added.
//
// The list is short and already read, so the search filters it here with no
// call. A closed venue is not in tdc_venues, and the database lets one stay on a
// list it is already on. It keeps its pill, unnamed, because a save that left it
// out would quietly take it off.
//
// Needs: tdc.js.

const TDCVenuePicker = (() => {
	const OWNERS = {
		tournament: {
			table: 'tbl_tournament_venues', column: 'tournament_id',
			rpc: 'tdc_set_tournament_venues', arg: 'p_tournament_id'
		},
		season: {
			table: 'tbl_league_season_venues', column: 'league_season_id',
			rpc: 'tdc_set_league_season_venues', arg: 'p_league_season_id'
		}
	};

	const el = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	const place = (v) => [v.area, v.city].filter(Boolean).join(', ');

	function create(root, area, statusEl) {
		let venues = [];   // tdc_venues: every open venue, by name
		let was = [];      // the ids as read, in order, to send only a change
		let chosen = [];   // the ids chosen now, in order

		root.classList.add('player-pick', 'venue-pick');
		const pills = el('div', 'venue-pills');
		const input = el('input');
		input.type = 'search';
		input.id = root.id + '-search';
		input.autocomplete = 'off';
		input.placeholder = 'Search venues';
		const results = el('div', 'pick-results');
		root.replaceChildren(pills, input, results);

		function drawPills() {
			pills.replaceChildren(...chosen.map((id) => {
				const v = venues.find((x) => x.id === id);
				const name = v ? v.name : 'A closed venue';
				const remove = el('button', 'venue-pill-remove', '×');
				remove.type = 'button';
				remove.setAttribute('aria-label', 'Remove ' + name);
				remove.addEventListener('click', () => {
					chosen = chosen.filter((x) => x !== id);
					drawPills();
					search();
				});
				const pill = el('span', 'venue-pill');
				pill.append(el('span', 'venue-pill-name', name), remove);
				return pill;
			}));
		}

		function search() {
			const term = input.value.trim().toLowerCase();
			if (!term) { results.replaceChildren(); return; }
			const found = venues.filter((v) => !chosen.includes(v.id)
				&& (v.name + ' ' + place(v)).toLowerCase().includes(term));
			if (!found.length) {
				results.replaceChildren(el('p', 'muted', 'No other open venue by that name.'));
				return;
			}
			results.replaceChildren(...found.map((v) => {
				const b = el('button', 'pick-result');
				b.type = 'button';
				b.append(el('span', 'result-name', v.name));
				if (place(v)) b.append(el('span', 'result-sub', place(v)));
				b.addEventListener('click', () => {
					chosen = chosen.concat(v.id);
					input.value = '';
					drawPills();
					search();
					input.focus();
				});
				return b;
			}));
		}

		input.addEventListener('input', search);

		// With no owner, nothing is chosen: a competition not made yet. openOnly
		// is for a new season, which tdc_create_league_season gives the last
		// season's list less any venue since closed, so it is shown the same.
		async function load(kind, id, { openOnly = false } = {}) {
			const list = await supabaseClient.rpc('tdc_venues');
			if (list.error) { TDC.showSupabaseError(area, list.error, statusEl); return false; }
			venues = list.data || [];

			let ids = [];
			if (kind) {
				const o = OWNERS[kind];
				const { data, error } = await supabaseClient
					.from(o.table).select('venue_id').eq(o.column, id).order('position');
				if (error) { TDC.showSupabaseError(area, error, statusEl); return false; }
				ids = (data || []).map((r) => r.venue_id);
			}
			if (openOnly) ids = ids.filter((x) => venues.some((v) => v.id === x));

			was = ids;
			chosen = ids.slice();
			input.value = '';
			// The field always shows, and says so when there is nothing to find.
			input.disabled = !venues.length;
			input.placeholder = venues.length ? 'Search venues' : 'No venues are open yet';
			drawPills();
			search();
			return true;
		}

		return {
			load,
			changed: () => JSON.stringify(chosen) !== JSON.stringify(was),
			// Answers { error }, as the call it makes does. The page says what
			// else was saved, and re-reads.
			save: (kind, id) => {
				const o = OWNERS[kind];
				return supabaseClient.rpc(o.rpc, { [o.arg]: id, p_venue_ids: chosen });
			}
		};
	}

	return { create };
})();
