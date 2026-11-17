// A venue's page (UV, 5 Nov): where it is, its tables and hours, how to reach it,
// and every league and tournament tied to it. At /venues/?v=<venue id>.
//
// Two calls, both open to somebody signed out: tdc_venue and
// tdc_venue_competitions. Only what the venue has filled in is shown.
//
// Restyled 17 Nov (UV) in the Season tab's language: the banner with the
// venue's picture, its area, whether it is open now (worked out from the hours
// in the venue's own timezone), Maps, Call, WhatsApp and Email as the corner's icons in a
// row under the names, and every detail with grey lines between them, Who runs it last (the
// owner for everybody; admins and staff only signed in, as tdc_venue decides).
// Website and the socials are words in a Links cell. Leagues and tournaments
// are the Leagues page's tiles, a tournament with a trophy where a league has
// its shield.
//
// Whoever may edit the venue (tdc_venue's i_manage: its owner or admin, or the
// site owner) gets the tab bar, Venue and then Settings in a second pill as a
// league's, at &tab=settings. Settings is venue-settings.js; after it saves,
// the page reads everything again.
//
// A league opens its season page and a tournament its poster until it starts,
// then its draw, as on the two lists. Both of those but the poster ask a
// stranger to sign in.
//
// Needs: tdc.js, match-settings.js, ring-status.js, venue-settings.js.

(() => {
	const AREA = 'Venue';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		list: el('list'), search: el('venue-search'), cards: el('venue-list'), none: el('venue-none'),
		nothing: el('nothing'), venue: el('venue'), settings: el('settings'),
		nav: el('venue-nav'), navAdmin: el('venue-nav-admin'),
		hero: el('v-hero'), corner: el('v-corner'), pic: el('v-pic'), name: el('v-name'), place: el('v-place'), open: el('v-open'),
		facts: el('v-facts'), aboutBox: el('v-about-box'), about: el('v-about'),
		hoursBox: el('v-hours-box'), hours: el('v-hours'), hoursNote: el('v-hours-note'),
		leagues: el('v-leagues'), leagueCount: el('v-league-count'),
		tournaments: el('v-tournaments'), tournamentCount: el('v-tournament-count'),
		status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the venue page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	const FORMAT = {
		single_elimination: 'Single elimination',
		double_elimination: 'Double elimination',
		round_robin: 'Round robin',
		groups_knockout: 'Groups then knockout'
	};
	const STATUS = {
		draft: 'Draft',
		open: 'Open for entries',
		in_progress: 'Running',
		complete: 'Finished',
		cancelled: 'Cancelled'
	};
	const NOT_STARTED = ['draft', 'open'];
	const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const ROLE = { owner: 'Owner', admin: 'Admin', staff: 'Staff' };

	const day = (iso) => {
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date: ' + iso); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	};
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	function pin() {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');
		svg.style.strokeWidth = 'var(--icon-line)';
		for (const d of ['M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z', 'M12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5z']) {
			const path = document.createElementNS(NS, 'path');
			path.setAttribute('d', d);
			path.setAttribute('vector-effect', 'non-scaling-stroke');
			svg.append(path);
		}
		return svg;
	}

	// A tournament's tile wears a trophy where a league's has its shield (UV, 17 Nov).
	function trophy() {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = document.createElementNS(NS, 'path');
		path.setAttribute('fill', 'currentColor');
		path.setAttribute('d', 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z');
		svg.append(path);
		return svg;
	}

	// A person: picture, name and role, one link to their profile, as the
	// Season tab's Who runs it (league-season.js).
	function avatar(path, name) {
		const box = node('span', 'person-pic');
		const url = TDC.pictureUrl('player-avatars', path);
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
	function personLink(p) {
		const a = node('a', 'person');
		a.href = '/players/?p=' + encodeURIComponent(p.player_id);
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', p.display_name), node('span', 'person-sub', ROLE[p.role] || p.role));
		a.append(avatar(p.avatar_path, p.display_name), names);
		return a;
	}

	// ─── Open now ───
	// From the hours, in the venue's own timezone, so somebody abroad reads the
	// club's clock. A closing time earlier than the opening time is the next
	// morning, so yesterday's late hours can still be open. Null with no hours.
	const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
	function clockAt(tz) {
		let parts;
		try {
			parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
				.formatToParts(new Date());
		} catch (err) {
			TDC.error(AREA, 'the venue’s timezone is not one this browser knows: ' + tz, err, els.status);
			return null;
		}
		const get = (type) => (parts.find((p) => p.type === type) || {}).value;
		const dayNo = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
		if (!dayNo) { TDC.error(AREA, 'could not read the day of the week at the venue.', parts, els.status); return null; }
		return { day: dayNo, at: Number(get('hour')) * 60 + Number(get('minute')) };
	}
	function openState(hours, tz) {
		if (!hours.length) return null;
		const now = clockAt(tz);
		if (!now) return null;
		const on = (d) => hours.filter((h) => h.day === d);
		const yesterday = now.day === 1 ? 7 : now.day - 1;
		for (const h of on(now.day)) {
			const o = minutes(h.opens);
			const c = minutes(h.closes);
			if ((c > o && now.at >= o && now.at < c) || (c < o && now.at >= o)) return { open: true, text: 'Open now · until ' + h.closes };
		}
		for (const h of on(yesterday)) {
			if (minutes(h.closes) < minutes(h.opens) && now.at < minutes(h.closes)) return { open: true, text: 'Open now · until ' + h.closes };
		}
		const later = on(now.day).filter((h) => minutes(h.opens) > now.at);
		if (later.length) return { open: false, text: 'Closed · opens at ' + later[0].opens };
		for (let i = 1; i <= 7; i++) {
			const d = ((now.day - 1 + i) % 7) + 1;
			const next = on(d);
			if (next.length) {
				const when = i === 1 ? 'tomorrow' : DAYS[d - 1];
				return { open: false, text: 'Closed · opens ' + when + ' at ' + next[0].opens };
			}
		}
		return null;
	}

	// ─── The banner ───
	function iconLink(icon, label, href) {
		const a = node('a', 'lj-icon');
		a.href = href;
		a.title = label;
		a.setAttribute('aria-label', label);
		if (href.startsWith('https:')) { a.target = '_blank'; a.rel = 'noopener'; }
		const face = node('span', 'tdc-ring');
		a.append(face);
		// Shown already drawn: a page load draws nothing in (UV, 16 Nov).
		try {
			face.innerHTML = TDCRing.svg();
			a.tdcRing = new TDCRing.RingStatus(face, {
				icons: [icon],
				labels: { [icon]: label, empty: label, loading: 'Working' },
				initial: icon
			});
		} catch (err) {
			TDC.error(AREA, 'an icon could not be drawn: ' + icon, err, els.status);
		}
		return a;
	}

	// The database accepts only https for the addresses, so each is safe to draw
	// as a link. A number is a link only when it can be dialled as written; a
	// WhatsApp link needs the country code, so one without is left as words.
	function renderCorner(v) {
		const icons = [];
		if (v.maps_url) icons.push(iconLink('pin', 'Open in Maps', v.maps_url));
		if (v.phone) icons.push(iconLink('phone', 'Call', 'tel:' + v.phone.replace(/ /g, '')));
		if (v.whatsapp && v.whatsapp.startsWith('+')) icons.push(iconLink('chat', 'WhatsApp', 'https://wa.me/' + v.whatsapp.replace(/[+ ]/g, '')));
		if (v.email) icons.push(iconLink('mail', 'Email', 'mailto:' + v.email));
		els.corner.replaceChildren(...icons);
		els.corner.hidden = !icons.length;
	}

	function fact(label, ...content) {
		const row = node('div', 'jumbo-fact');
		const dd = node('dd');
		dd.append(...content);
		row.append(node('dt', null, label), dd);
		return row;
	}

	function renderBanner(v) {
		document.title = v.name + ' — The Dive Club';
		els.name.textContent = v.name;
		els.place.textContent = [v.area, v.city].filter(Boolean).join(', ');
		els.place.hidden = !els.place.textContent;

		const picture = TDC.pictureUrl('venue-pictures', v.picture_path);
		if (picture) {
			const img = document.createElement('img');
			img.src = picture;
			img.alt = '';
			els.pic.replaceChildren(img);
		} else {
			els.pic.replaceChildren(pin());
		}

		// The status strip says whether it is open: green open, grey closed.
		const state = openState(v.hours || [], v.timezone);
		els.open.hidden = !state;
		els.open.textContent = state ? state.text : '';
		els.open.classList.toggle('is-open', !!(state && state.open));
		els.hero.classList.toggle('venue-is-open', !!(state && state.open));
		els.hero.classList.toggle('venue-is-closed', !!(state && !state.open));

		renderCorner(v);

		const facts = [];
		if (v.address) facts.push(fact('Address', v.address));
		if (v.table_count != null || v.table_note) {
			const bits = [];
			if (v.table_count != null) bits.push(String(v.table_count));
			if (v.table_note) bits.push(node('span', 'venue-fact-note', v.table_note));
			facts.push(fact('Tables', ...bits));
		}
		if (v.phone) facts.push(fact('Phone', v.phone));
		if (v.whatsapp) facts.push(fact('WhatsApp', v.whatsapp));
		// An address has no spaces to wrap at: it runs sideways and back, never split.
		if (v.email) facts.push(fact('Email', TDC.runName(node('span'), v.email)));

		const links = [['Website', v.website_url], ['Instagram', v.instagram_url], ['Facebook', v.facebook_url]]
			.filter(([, href]) => href)
			.map(([text, href]) => {
				const a = node('a', 'venue-link', text);
				a.href = href;
				a.target = '_blank';
				a.rel = 'noopener';
				return a;
			});
		if (links.length) facts.push(fact('Links', ...links));

		// Who runs it: the owner for everybody, the rest for somebody signed in.
		// Not .lj-people: the Season tab's lines key on it and expect its badges row.
		const people = node('div', 'jumbo-fact venue-people');
		const list = node('dd');
		const who = v.people || [];
		if (who.length) list.append(...who.map(personLink));
		else list.textContent = 'Nobody is listed yet.';
		people.append(node('dt', null, 'Who runs it'), list);
		facts.push(people);

		els.facts.replaceChildren(...facts);
	}

	// One row a day, Monday first, today marked. A day with no row is closed.
	// With no hours at all nothing is known, which is not the same as closed all
	// week.
	function renderHours(v) {
		const hours = v.hours || [];
		els.hoursBox.hidden = !hours.length && !v.hours_note;
		const now = hours.length ? clockAt(v.timezone) : null;
		els.hours.replaceChildren(...(hours.length ? DAYS.map((name, i) => {
			const today = hours.filter((h) => h.day === i + 1);
			const row = node('div', 'venue-hours-row' + (now && now.day === i + 1 ? ' is-today' : '') + (today.length ? '' : ' is-closed'));
			row.append(node('dt', null, name),
				node('dd', null, today.length ? today.map((h) => h.opens + ' – ' + h.closes).join(', ') : 'Closed'));
			return row;
		}) : []));
		els.hours.hidden = !hours.length;
		els.hoursNote.hidden = !v.hours_note;
		els.hoursNote.textContent = v.hours_note || '';
	}

	// ─── Leagues and tournaments, as the Leagues page's tiles ───
	// A line too long for the tile runs sideways and back (TDC.runName).
	const line = (cls, text) => TDC.runName(node('div', 'lt-line ' + cls), text);

	function tile(href, statusClass, pic, name, sub, meta, badge) {
		const box = node('a', 'league-tile ' + statusClass);
		box.href = href;
		const picBox = node('div', 'league-tile-pic');
		picBox.append(pic);
		const names = node('div', 'lt-names');
		names.append(line('league-tile-name', name));
		if (sub) names.append(line('league-tile-meta', sub));
		const top = node('div', 'lt-top');
		top.append(picBox, names);
		box.append(top, node('div', 'lt-strip'));
		for (const m of meta.filter(Boolean)) box.append(line('league-tile-meta', m));
		const tags = node('div', 'lt-badges');
		tags.append(node('span', 'badge lt-status', badge));
		box.append(tags);
		return box;
	}

	function leagueTile(l) {
		const game = [D.DISCIPLINE[l.discipline] || l.discipline];
		if (l.team_size === 1) game.push('Singles');
		else if (l.team_size) game.push('Teams of ' + l.team_size);
		return tile('/leagues/season/?s=' + encodeURIComponent(l.league_season_id),
			'league-status-' + l.status,
			TDC.leaguePic(l.picture_path),
			l.league_name,
			l.season_name && l.season_name !== l.league_name ? l.season_name : '',
			[game.filter(Boolean).join(' · '), l.starts_on ? 'From ' + day(l.starts_on) : '', plural(l.players, 'player')],
			D.LEAGUE_STATUS[l.status] || l.status);
	}

	function tournamentTile(t) {
		const href = NOT_STARTED.includes(t.status) && t.poster_open
			? '/tournaments/poster/?t=' + encodeURIComponent(t.id)
			: '/tournaments/bracket/?t=' + encodeURIComponent(t.id);
		const entrants = t.max_entrants != null ? t.entrants + ' of ' + t.max_entrants + ' entered' : plural(t.entrants, 'entrant');
		return tile(href, 'tournament-status-' + t.status, trophy(), t.name, FORMAT[t.format] || t.format,
			[t.starts_at ? day(t.starts_at) : '', entrants],
			STATUS[t.status] || t.status);
	}

	function renderList(box, count, items, make, none) {
		box.classList.toggle('is-empty', !items.length);
		box.replaceChildren(...(items.length ? items.map(make) : [node('p', 'muted', none)]));
		count.hidden = !items.length;
		count.textContent = String(items.length);
	}

	// ─── The tab bar, for whoever may edit the venue ───
	// The league's bar (league-nav.js) in shape: the venue in the first pill,
	// Settings in a second pill under it, &tab=settings in the address so a
	// reload or Back keeps the tab. Nobody else sees a bar.
	let manages = false;
	const tabInAddress = () => (manages && new URLSearchParams(location.search).get('tab') === 'settings' ? 'settings' : 'venue');

	function navItem(key, label) {
		const b = node('button', 'league-nav-item', label);
		b.type = 'button';
		b.dataset.tab = key;
		const track = node('div', 'league-nav-track scroll-x');
		track.append(b);
		return track;
	}

	function drawNav() {
		els.nav.hidden = !manages;
		els.navAdmin.hidden = !manages;
		if (!manages) return;
		if (!els.nav.firstChild) {
			els.nav.append(navItem('venue', 'Venue'));
			els.nav.setAttribute('aria-label', 'This venue');
			els.navAdmin.append(navItem('settings', 'Settings'));
			els.navAdmin.setAttribute('aria-label', 'Running this venue');
		}
	}

	function show(key, push) {
		if (push && key !== tabInAddress()) {
			const u = new URL(location.href);
			if (key === 'venue') u.searchParams.delete('tab'); else u.searchParams.set('tab', key);
			history.pushState({ tab: key }, '', u);
		}
		els.venue.hidden = key !== 'venue';
		els.settings.hidden = key !== 'settings';
		for (const item of document.querySelectorAll('#venue-nav [data-tab], #venue-nav-admin [data-tab]')) {
			if (item.dataset.tab === key) item.setAttribute('aria-current', 'page');
			else item.removeAttribute('aria-current');
		}
		const name = els.name.textContent;
		document.title = (key === 'settings' ? 'Venue Settings' : name) + ' — The Dive Club';
	}

	document.addEventListener('click', (e) => {
		const item = e.target.closest('#venue-nav button[data-tab], #venue-nav-admin button[data-tab]');
		if (item) show(item.dataset.tab, true);
	});
	window.addEventListener('popstate', () => { if (manages) show(tabInAddress()); });

	// ─── Reading ───
	// After a save on Settings the page reads everything again (CLAUDE.md §5.6)
	// and draws both tabs from what came back.
	const venueId = new URLSearchParams(location.search).get('v');

	// ─── Every venue: the Affiliate Clubs list (UV, 17 Nov) ───
	// /venues/ with no venue named. One wide card each, as the Leagues page's
	// seasons (.lc): the strip green open, grey closed; the picture whole and
	// plain; name, area and city, address, Open now; badges counting the
	// leagues and tournaments listed there; a pill of the tables and the phone,
	// running sideways when it does not fit. The search filters in the browser.
	function venuePic(path) {
		const box = node('div', 'venue-card-pic');
		const url = TDC.pictureUrl('venue-pictures', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.append(pin());
		}
		return box;
	}

	function venueCard(v) {
		const state = openState(v.hours || [], v.timezone);
		const box = node('a', 'lc venue-card' + (state ? (state.open ? ' venue-is-open' : ' venue-is-closed') : ''));
		box.href = '/venues/?v=' + encodeURIComponent(v.id);

		const names = node('div', 'lc-names');
		names.append(node('h3', null, v.name));
		const place = [v.area, v.city].filter(Boolean).join(', ');
		if (place) names.append(node('span', 'lc-sub', place));
		if (v.address) names.append(node('span', 'lc-sub', v.address));
		const text = node('div', 'lc-text');
		text.append(names);
		if (state) text.append(node('div', 'lc-dates venue-open' + (state.open ? ' is-open' : ''), state.text));
		const top = node('div', 'lc-top');
		top.append(venuePic(v.picture_path), text);

		const foot = node('div', 'lc-foot');
		const tags = node('div', 'lc-badges');
		if (v.league_count) tags.append(node('span', 'badge', plural(v.league_count, 'league')));
		if (v.tournament_count) tags.append(node('span', 'badge', plural(v.tournament_count, 'tournament')));
		if (tags.children.length) foot.append(tags);
		const details = [];
		if (v.table_count != null) details.push(plural(v.table_count, 'table'));
		if (v.table_note) details.push(v.table_note);
		if (v.phone) details.push(v.phone);
		if (details.length) {
			const pill = node('div', 'lc-pill venue-pill');
			pill.append(TDC.runName(node('div', 'venue-pill-run'), details.join(' · ')));
			foot.append(pill);
		}
		box.append(top);
		if (foot.children.length) box.append(foot);
		return box;
	}

	let venues = [];
	function renderVenues() {
		const term = els.search.value.trim().toLowerCase();
		const shown = venues.filter((v) => !term || [v.name, v.area, v.city].some((s) => s && s.toLowerCase().includes(term)));
		els.cards.replaceChildren(...shown.map(venueCard));
		els.none.hidden = shown.length > 0;
		els.none.textContent = venues.length ? 'No club matches that.' : 'No clubs are on the platform yet.';
	}
	els.search.addEventListener('input', renderVenues);

	async function loadList() {
		document.title = 'Affiliate Clubs — The Dive Club';
		const { data, error } = await supabaseClient.rpc('tdc_venues');
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		venues = data || [];
		renderVenues();
		els.list.hidden = false;
	}

	async function load() {
		if (!venueId) { await loadList(); return; }

		const [venue, comps] = await Promise.all([
			supabaseClient.rpc('tdc_venue', { p_venue_id: venueId }),
			supabaseClient.rpc('tdc_venue_competitions', { p_venue_id: venueId })
		]);
		if (venue.error) { TDC.showSupabaseError(AREA, venue.error, els.status); return; }
		if (comps.error) { TDC.showSupabaseError(AREA, comps.error, els.status); return; }
		if (!venue.data) { els.nothing.hidden = false; return; }

		const v = venue.data;
		renderBanner(v);
		els.aboutBox.hidden = !v.description;
		els.about.textContent = v.description || '';
		renderHours(v);
		renderList(els.leagues, els.leagueCount, comps.data.leagues, leagueTile, 'No leagues listed here yet.');
		renderList(els.tournaments, els.tournamentCount, comps.data.tournaments, tournamentTile, 'No tournaments listed here yet.');

		manages = v.i_manage === true;
		drawNav();
		if (manages) TDCVenueSettings.fill(v, load);
		show(tabInAddress());
	}

	TDCLoader.hold(load(), 'Venue');
})();
