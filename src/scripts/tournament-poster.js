// The poster (/tournaments/poster/?t=<id>). The one page that works signed out.
//
// Everything on it comes from one call to tdc_tournament_poster, which returns
// one vetted jsonb shape. There is no second read: the page cannot ask for
// anything that shape does not hold, which is the point — anon reaches that
// function and nothing else on the site.
//
// It is live (UV, 24 Nov; migration 20261124210356): the shape is built when
// it is read, with the names and the draw always in, so the page is never out
// of date and there is no Regenerate. Every section still checks for its data
// rather than assuming it (a draw not yet made, nobody entered).
//
// Entry is the exception: those buttons need an account, so they come from
// tdc_my_entry and only appear once there is a session.
//
// Drawn in the league join page's look (UV, 5 Nov): as much as the snapshot
// holds, and nothing the director left unset. No date, no venue, no limit, a
// fee of 0, a switch that is off: each is left out rather than said.
//
// Needs: tdc.js, match-settings.js, poster-words.js.

(() => {
	const AREA = 'Poster';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		nothing: el('nothing'), poster: el('poster'),
		hero: el('p-hero'), pic: el('p-pic'), name: el('p-name'), meta: el('p-meta'),
		statusBadge: el('p-status'), facts: el('p-facts'), more: el('p-more'),
		when: el('p-when'), venue: el('p-venue'),
		private: el('p-private'), numbers: el('p-numbers'),
		rulesBox: el('p-rules-box'), rules: el('p-rules'),
		roundsBox: el('p-rounds-box'), rounds: el('p-rounds'),
		confirmedBox: el('p-confirmed-box'), confirmed: el('p-confirmed'), confirmedCount: el('p-confirmed-count'),
		interestedBox: el('p-interested-box'), interested: el('p-interested'), interestedCount: el('p-interested-count'),
		drawBox: el('p-draw-box'), draw: el('p-draw'),
		entry: el('p-entry'), entryDetail: el('p-entry-detail'),
		entryActions: el('p-entry-actions'), entryStatus: el('p-entry-status'),
		share: el('p-share'), name: el('p-name'),
		status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the poster page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const tournamentId = new URLSearchParams(location.search).get('t');

	// Shared with the poster's settings page (UV, 24 Nov): poster-words.js.
	const { FORMAT, STATUS, startsAt, DEF_BY_KEY, ruleText, ruleRow, withDefaults, roundRules, roundName } = TDCPosterWords;

	// How a player gets in, in the words the join page uses for a league.
	const ENTRY = {
		td_only: 'Added by whoever runs it',
		interested: 'Put your name down',
		self_confirm: 'Join straight away'
	};

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	// A picture, or initials. Its link to the profile is round it (person,
	// fixtureLine), from the player ids the snapshot holds since version 3.
	function face(name, path) {
		const box = node('span', 'person-pic');
		const url = path ? TDC.pictureUrl('player-avatars', path) : null;
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		return box;
	}

	// A person: one link to their profile (UV, 24 Nov), as a league season's
	// people are; a stranger is asked to sign in there. Plain on a poster built
	// before the snapshot held ids (version 3).
	const profileUrl = (playerId) => '/players/?p=' + encodeURIComponent(playerId);
	function person(name, path, sub, playerId) {
		const p = node(playerId ? 'a' : 'span', 'person');
		if (playerId) p.href = profileUrl(playerId);
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', name));
		if (sub) names.append(node('span', 'person-sub', sub));
		p.append(face(name, path), names);
		return p;
	}

	// ─── State ───
	let snap = null;

	// ─────────────────────────────────────────────────────────────────
	// Dates
	//
	// A poster is read in advance, so this says the day out loud rather than
	// leaning on "in 3 days" — somebody looking at it on a wall has no idea
	// when the page was built.
	// ─────────────────────────────────────────────────────────────────

	// The banner's Date and Time, said apart.
	function dayOf(iso) {
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable start date in the snapshot: ' + iso); return ''; }
		return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
	}
	function timeOf(iso) {
		const d = new Date(iso);
		if (isNaN(d)) return '';
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
	}


	// ─────────────────────────────────────────────────────────────────
	// The ruleset, in words
	//
	// Labels come from TDCMatchDef.SETTINGS, so the poster and the settings
	// panel call the same setting the same thing. The snapshot only ever holds
	// the player-facing keys — the server decides that, not this page — so this
	// renders whatever it is given and does not filter.
	// ─────────────────────────────────────────────────────────────────

	function ruleBox(title, rows) {
		const box = node('section', 'lj-rule-box');
		box.append(node('h3', 'lj-rule-title', title));
		const dl = node('dl', 'lj-rule-list');
		for (const [k, v] of rows) {
			const row = node('div', 'lj-rule');
			row.append(node('dt', null, k), node('dd', null, v));
			dl.append(row);
		}
		box.append(dl);
		return box;
	}

	function renderRules(rules) {
		rules = rules || {};
		// A key with no definition is a setting added to the server list and
		// not to TDCMatchDef. Said out loud rather than dropped silently.
		for (const key of Object.keys(rules)) {
			if (!DEF_BY_KEY.has(key)) TDC.error(AREA, 'the poster carries a setting this page has no label for: ' + key);
		}
		const whole = withDefaults(rules);
		const boxes = [];
		for (const group of D.GROUPS) {
			const rows = [];
			for (const def of D.SETTINGS) {
				if (def.group !== group || def.scope !== 'rules') continue;
				if (def.key === 'win_condition_target') continue;   // said with the win condition
				const v = rules[def.key];
				if (v === undefined || v === null || v === false || v === 0) continue;
				if (def.when && !def.when(whole)) continue;
				rows.push(ruleRow(def, rules));
			}
			if (rows.length) boxes.push(ruleBox(group, rows));
		}
		els.rulesBox.hidden = !boxes.length;
		els.rules.replaceChildren(...boxes);
	}

	function renderRoundRules(s) {
		const boxes = roundRules(s).map((r) => ruleBox(r.title, r.rows));
		els.roundsBox.hidden = !boxes.length;
		els.rounds.replaceChildren(...boxes);
	}

	// ─────────────────────────────────────────────────────────────────
	// The draw
	//
	// Grouped by round. A fixture with nobody in it yet is still drawn, because
	// an empty bracket is what a draw sheet on the wall looks like before the
	// night starts.
	// ─────────────────────────────────────────────────────────────────

	// A match as a card set into the page, its state in the strip down the
	// left as the league fixtures have it: yellow being played, green
	// decided, grey not yet. A bye shows only the player going through, as
	// the draw page does.
	function fixtureLine(f) {
		const decided = !!f.winner;
		const bye = decided && (!f.home || !f.away);
		const box = node('div', 'poster-fixture'
			+ (f.match_status === 'in_progress' ? ' is-live' : decided ? ' is-done' : ''));

		// A side's picture and name: one link to the player's profile (UV, 24 Nov),
		// as a league fixture's side; the card itself opens nothing here.
		// The picture from the snapshot since version 5 (UV, 24 Nov).
		const player = (name, playerId, avatar) => {
			const who = node(playerId ? 'a' : 'span', 'poster-side-player');
			if (playerId) who.href = profileUrl(playerId);
			who.append(face(name || '', avatar || null), node('span', 'poster-side-name', name || 'To be decided'));
			return who;
		};

		if (bye) {
			const row = node('div', 'poster-side');
			row.append(f.home
				? player(f.winner, f.home_player_id, f.home_avatar)
				: player(f.winner, f.away_player_id, f.away_avatar));
			box.append(row, node('div', 'poster-fixture-tag', 'Bye: through to the next round'));
			return box;
		}

		const side = (name, frames, isWinner, playerId, avatar) => {
			const row = node('div', 'poster-side' + (isWinner ? ' won' : '') + (name ? '' : ' tbd'));
			row.append(player(name, name ? playerId : null, name ? avatar : null));
			if (frames !== null && frames !== undefined) {
				row.append(node('span', 'poster-side-score', String(frames)));
			}
			return row;
		};

		box.append(
			side(f.home, f.home_frames, decided && f.winner === f.home, f.home_player_id, f.home_avatar),
			side(f.away, f.away_frames, decided && f.winner === f.away, f.away_player_id, f.away_avatar)
		);

		// A result that has not been published is not official, and a poster
		// that showed it as settled would be making a claim the TD has not.
		const tags = [];
		if (f.match_status === 'in_progress') tags.push('Playing now');
		if (decided && !f.published) tags.push('Not confirmed yet');
		if (f.set_by_hand) tags.push('Set by the director');
		if (tags.length) box.append(node('div', 'poster-fixture-tag', tags.join(' · ')));

		return box;
	}

	function renderDraw(draw) {
		els.drawBox.hidden = !draw || !draw.length;
		if (!draw || !draw.length) return;

		els.draw.replaceChildren();

		const main = draw.filter((f) => f.bracket === 'main');
		const rest = draw.filter((f) => f.bracket !== 'main');
		const last = main.length ? Math.max(...main.map((f) => f.round)) : 0;

		const round = (title, list) => {
			const col = node('section', 'poster-round');
			col.append(node('h3', 'lj-rule-title', title));
			const cards = node('div', 'poster-round-cards');
			cards.append(...list.map(fixtureLine));
			col.append(cards);
			return col;
		};

		for (let r = 1; r <= last; r++) {
			const inRound = main.filter((f) => f.round === r);
			if (!inRound.length) continue;
			els.draw.append(round(roundName(r, last), inRound));
		}

		// Third place and anything else that is not the main bracket.
		if (rest.length) els.draw.append(round('Third place', rest));
	}

	// ─────────────────────────────────────────────────────────────────
	// Entering
	// ─────────────────────────────────────────────────────────────────

	async function loadEntry(signedIn) {
		// A stranger is told to sign in rather than shown nothing: a poster
		// advertising for entries with no way in is a dead end, and attracting
		// somebody who has not signed up is the point of the page.
		// Signed out, the button the mode leads with, as a league's Join this
		// league is (UV, 24 Nov): a tap goes to sign in and back here.
		if (!signedIn) {
			if (snap.entry_mode === 'td_only') { els.entry.hidden = true; return; }
			els.entry.hidden = false;
			els.entryDetail.textContent = '';
			els.entryActions.replaceChildren(link(snap.entry_mode === 'self_confirm' ? 'Confirm my entry' : "I'm interested",
				'/accounts/?next=' + encodeURIComponent(location.pathname + location.search)));
			return;
		}

		const { data, error } = await supabaseClient.rpc('tdc_my_entry', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.entryStatus); return; }

		const e = (data || [])[0];
		if (!e) { els.entry.hidden = true; return; }

		els.entry.hidden = false;
		renderEntry(e);
	}

	// The buttons as a league season's Join this league (UV, 24 Nov): the one
	// the TD wants pressed yellow with the ring and plus before its words, the
	// others plain; Withdraw yellow, the plus losing its upright to read as a
	// minus.
	const NS = 'http://www.w3.org/2000/svg';
	function joinMark(minus) {
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('class', 'lj-join-plus');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('aria-hidden', 'true');
		const add = (tag, attrs) => {
			const n = document.createElementNS(NS, tag);
			for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
			svg.append(n);
		};
		add('circle', { cx: 50, cy: 50, r: 42 });
		if (!minus) add('path', { d: 'M50 30L50 70' });
		add('path', { d: 'M30 50L70 50' });
		return svg;
	}
	function marked(b, minus) {
		const word = node('span', 'lj-join-word', b.textContent);
		b.replaceChildren(joinMark(minus), word);
		return b;
	}

	function link(text, href) {
		const a = node('a', 'ls-btn ls-btn-go', text);
		a.href = href;
		return marked(a, false);
	}

	// Where they stand, on the grey line under the buttons.
	const ENTERED = {
		interested: 'Your name is down. Whoever is running this will confirm entries.',
		confirmed: 'You are in.',
		withdrawn: 'You withdrew.'
	};

	// What a press did is said on the button itself for a moment, as on a
	// league season (UV, 24 Nov), then the buttons take their new state.
	let entrySay = null;
	let entrySayTimer = null;
	let lastEntry = null;
	const ENTRY_SAY_MS = 2500;
	function sayOnButton(text) {
		entrySay = text;
		clearTimeout(entrySayTimer);
		entrySayTimer = null;
	}

	function renderEntry(e) {
		lastEntry = e;
		els.entryActions.replaceChildren();

		const inIt = e.status && e.status !== 'withdrawn';
		els.entryDetail.textContent = (e.status ? (ENTERED[e.status] || e.status)
			: (e.may_enter || e.may_confirm ? '' : (e.why_not || '')))
			+ (e.paid ? ' Marked paid.' : '');
		els.entryDetail.textContent = els.entryDetail.textContent.trim();

		if (entrySay) {
			const said = node('button', 'ls-btn ls-btn-go poster-said', entrySay);
			said.type = 'button';
			said.dataset.mode = 'said';
			els.entryActions.append(said);
			// Timed from when it is drawn: the re-read after the press draws it.
			if (!entrySayTimer) entrySayTimer = setTimeout(() => { entrySay = null; entrySayTimer = null; renderEntry(lastEntry); }, ENTRY_SAY_MS);
			return;
		}

		// may_enter already accounts for the mode, the draw and the account, so
		// the page does not work any of that out for itself.
		//
		// Where somebody may confirm themselves they are still offered
		// "interested" — deciding to come is not the same as committing, and a
		// mode that allows the stronger answer should not withhold the weaker
		// one. The confirm button leads, as the one the TD wants pressed.
		if (e.may_confirm && e.status !== 'confirmed') {
			els.entryActions.append(button('Confirm my entry', 'ls-btn-go',
				() => enter('confirmed')));
		}

		if (e.may_enter && !inIt) {
			els.entryActions.append(button("I'm interested",
				e.may_confirm ? '' : 'ls-btn-go',
				() => enter('interested')));
		}

		if (inIt) {
			els.entryActions.append(button('Withdraw', 'ls-btn-go', withdraw, true));
		}
	}

	function button(text, cls, fn, minus) {
		const b = node('button', 'ls-btn ' + cls, text);
		b.type = 'button';
		b.addEventListener('click', fn);
		return cls === 'ls-btn-go' ? marked(b, !!minus) : b;
	}

	// After entering, the whole page is re-read from the server, so the new
	// name and the counts appear at once (the poster is live, 24 Nov).
	// Queued, never refused (TDC.writer): a second press of the same button
	// joins the first.
	const entryWriter = TDC.writer({
		area: AREA, status: els.entryStatus,
		reload: async () => { if (!(await loadPoster())) return false; await loadEntry(true); return true; }
	});

	function enter(status) {
		return entryWriter.write('Entering', () => supabaseClient.rpc('tdc_enter_tournament', {
			p_tournament_id: tournamentId, p_status: status
		}), () => { sayOnButton(status === 'confirmed' ? 'You are in' : 'Your name is down'); return ''; }, { single: 'enter-' + status });
	}

	async function withdraw() {
		if (!confirm('Withdraw from this tournament?')) return;
		return entryWriter.write('Withdrawing', () => supabaseClient.rpc('tdc_withdraw_from_tournament', {
			p_tournament_id: tournamentId
		}), () => { sayOnButton('Your name is off'); return ''; }, { single: 'withdraw' });
	}

	// ─── The banner ───
	// The tournament's picture, as a league's (UV, 24 Nov): its own, read live
	// beside the snapshot, or the trophy in the empty shield. Then the name,
	// the format and the status; then the facts, each only if the director
	// set it.
	function renderBanner(s, picture) {
		els.hero.className = 'jumbo lj-hero poster-status-' + s.status;
		els.pic.replaceChildren(TDC.tournamentPic(picture, s.name));
		els.name.textContent = s.name;
		els.meta.textContent = FORMAT[s.format] || s.format;
		els.statusBadge.textContent = STATUS[s.status] || s.status;

		// The date and the venue under the name, seen with the banner folded
		// (UV, 24 Nov), as a league season shows its venue; so not again in
		// the details. The venue a link to its page.
		els.when.textContent = s.starts_at ? [dayOf(s.starts_at), timeOf(s.starts_at)].filter(Boolean).join(', ') : '';
		els.when.hidden = !s.starts_at;
		const where = s.venues || [];
		els.venue.replaceChildren();
		where.forEach((v, i) => { if (i) els.venue.append(', '); els.venue.append(TDC.venueLink(v)); });
		els.venue.hidden = !where.length;

		const facts = [];
		if (s.rules && s.rules.discipline) facts.push(['Game', ruleText('discipline', s.rules.discipline)]);
		if (s.entry_mode) facts.push(['Entries', ENTRY[s.entry_mode] || s.entry_mode]);
		if (s.max_entrants) facts.push(['Places', String(s.max_entrants)]);
		if (s.entry_fee_credits > 0) facts.push(['Entry fee', plural(s.entry_fee_credits, 'credit')]);
		if (s.sanctioned) facts.push(['Ranked', 'Counts towards the rankings']);
		if (s.third_place) facts.push(['Third place', 'Played off']);

		els.facts.replaceChildren(...facts.map(([k, v]) => {
			const row = node('div', 'jumbo-fact');
			row.append(node('dt', null, k), node('dd', null, v));
			return row;
		}));

		// Who runs it in the details, as on a league season (UV, 24 Nov): each
		// one's picture, with their name over their role. In the snapshot from
		// version 2 (20261105160712); left out when there is nobody.
		const officials = s.officials || [];
		if (officials.length) {
			const people = node('div', 'jumbo-fact lj-people');
			const list = node('dd');
			list.append(...officials.map((o) => person(o.name, o.avatar_path, o.role, o.player_id)));
			people.append(node('dt', null, 'Who runs it'), list);
			els.facts.append(people);
		}
		els.more.hidden = !els.facts.children.length;
	}

	// An icon shows already drawn, as on a league season (league-season.js).
	function wakeIcon(b) {
		if (b.tdcRing) return;
		const icon = b.dataset.icon;
		const label = b.getAttribute('aria-label');
		try {
			const face = b.querySelector('.tdc-ring');
			face.innerHTML = TDCRing.svg();
			b.tdcRing = new TDCRing.RingStatus(face, {
				icons: [icon],
				labels: { [icon]: label, empty: label, loading: 'Working' },
				initial: icon
			});
		} catch (err) {
			TDC.error(AREA, 'an icon could not be drawn: ' + icon, err, els.status);
		}
	}

	// ─── The numbers ───
	// The stage's scores, set into the page. From the snapshot, so they are
	// as of when it was generated, as the footnote says.
	function renderNumbers(s) {
		const c = s.entrants || {};
		const tiles = [['Confirmed', c.confirmed || 0]];
		if (c.interested) tiles.push(['Interested', c.interested]);
		if (s.max_entrants) tiles.push(['Places left', Math.max(0, s.max_entrants - (c.total || 0))]);
		if (s.rounds) tiles.push(['Rounds', s.rounds]);
		const draw = (s.draw || []).filter((f) => f.home && f.away);
		if (draw.length) {
			tiles.push(['Matches', draw.length]);
			tiles.push(['Decided', draw.filter((f) => f.winner).length]);
		}
		els.numbers.replaceChildren(...tiles.map(([label, value]) => {
			const tile = node('div', 'lj-num');
			tile.append(node('span', 'lj-num-value', String(value)), node('span', 'lj-num-label', label));
			return tile;
		}));
	}

	// ─── Who is in ───
	// Counts, not names — unless the TD included names. Confirmed and
	// Interested apart, each with their picture (UV, 24 Nov; snapshot
	// version 4, migration 20261124183008): statuses and pictures sit beside
	// the names in the same order. Every poster was rebuilt at version 4, so
	// names without statuses mean something is wrong, and it is said.
	function renderEntrants(s) {
		const names = s.entrant_names || [];
		const ids = s.entrant_ids || [];
		const statuses = s.entrant_statuses;
		const avatars = s.entrant_avatars || [];
		const lists = { confirmed: [], interested: [] };
		if (names.length && !Array.isArray(statuses)) {
			TDC.error(AREA, 'the poster holds names but not who is confirmed.', null, els.status);
		} else {
			names.forEach((n, i) => {
				const list = lists[statuses[i]];
				if (!list) { TDC.error(AREA, 'unknown entrant status in the snapshot: ' + statuses[i], null, els.status); return; }
				list.push(person(n, avatars[i] || null, null, ids[i]));
			});
		}
		els.confirmedBox.hidden = !lists.confirmed.length;
		els.confirmedCount.textContent = String(lists.confirmed.length);
		els.confirmed.replaceChildren(...lists.confirmed);
		els.interestedBox.hidden = !lists.interested.length;
		els.interestedCount.textContent = String(lists.interested.length);
		els.interested.replaceChildren(...lists.interested);
	}

	// ─── Rendering the whole thing ───
	function render(row) {
		snap = row.snapshot;

		els.poster.hidden = false;
		renderBanner(snap, row.picture_path);
		renderNumbers(snap);
		renderRules(snap.rules);
		renderRoundRules(snap);

		renderEntrants(snap);

		renderDraw(snap.draw);
		// The text for a poster designer is on the poster's settings page now,
		// for whoever runs the tournament (UV, 24 Nov; tournament-poster-settings.js).
		// No "generated on" line: the page is live (UV, 24 Nov).

		els.private.hidden = row.is_public;
		// No small links to Entrants and the Draw at the foot (UV, 24 Nov): the
		// bottom bar (tournament-nav.js) is the way round a tournament's pages.
	}

	// ─── Start ───
	TDCLoader.hold((async () => {
		if (!tournamentId) {
			els.nothing.hidden = false;
			TDC.error(AREA, 'no tournament in the address.', null, els.status);
			return;
		}

		// getSession, not requireSession: a signed-out visitor is the expected
		// case on this page and must not be redirected to the login screen.
		const session = await TDC.getSession(AREA);

		wakeIcon(els.share);
		TDC.shareButton(els.share, 'tournament', tournamentId, {
			area: AREA, status: els.status, title: () => els.name.textContent
		});

		if (!(await loadPoster())) return;
		await loadEntry(!!session);
	})(), 'Poster');

	// Reads the live poster and draws it. False when there is nothing to show
	// (an error, said on the page, or no shared poster).
	async function loadPoster() {
		const { data, error } = await supabaseClient.rpc('tdc_tournament_poster', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		const row = (data || [])[0];
		if (!row) { els.poster.hidden = true; els.nothing.hidden = false; return false; }

		render(row);
		return true;
	}
})();
