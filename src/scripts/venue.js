// A venue's page (UV, 5 Nov): where it is, its tables and hours, how to reach it,
// and every league and tournament tied to it. At /venues/?v=<venue id>.
//
// Two calls, both open to somebody signed out: tdc_venue and
// tdc_venue_competitions. Only what the venue has filled in is shown. A venue
// with no owner cannot be edited yet, so most of the seeded ones are short.
//
// A league opens its join page and a tournament its poster until it starts, then
// its draw, as on the two lists. Both of those but the poster ask a stranger to
// sign in.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'Venue';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		nothing: el('nothing'), venue: el('venue'), pic: el('v-pic'), name: el('v-name'), place: el('v-place'),
		facts: el('v-facts'), links: el('v-links'), aboutBox: el('v-about-box'), about: el('v-about'),
		hoursBox: el('v-hours-box'), hours: el('v-hours'), hoursNote: el('v-hours-note'),
		leagues: el('v-leagues'), tournaments: el('v-tournaments'), status: el('page-status')
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
	const STATUS_CLASS = { draft: 'pending', open: 'needs-you', in_progress: 'live', complete: 'verified', cancelled: 'pending' };
	const NOT_STARTED = ['draft', 'open'];
	const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	const day = (iso) => {
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date: ' + iso); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	};

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

		const facts = [];
		if (v.address) facts.push(['Address', v.address]);
		if (v.table_count != null) facts.push(['Tables', String(v.table_count)]);
		if (v.table_note) facts.push(['The tables', v.table_note]);
		if (v.phone) facts.push(['Phone', v.phone]);
		if (v.whatsapp) facts.push(['WhatsApp', v.whatsapp]);
		if (v.email) facts.push(['Email', v.email]);
		els.facts.hidden = !facts.length;
		els.facts.replaceChildren(...facts.map(([k, val]) => {
			const row = node('div', 'jumbo-fact');
			row.append(node('dt', null, k), node('dd', null, val));
			return row;
		}));
	}

	// The database accepts only https for the addresses, so each is safe to draw
	// as a link. A number is a link only when it can be dialled as written; a
	// WhatsApp link needs the country code, so one without is left as words.
	function renderLinks(v) {
		const links = [];
		if (v.maps_url) links.push(['Open in Maps', v.maps_url]);
		if (v.phone) links.push(['Call', 'tel:' + v.phone.replace(/ /g, '')]);
		if (v.whatsapp && v.whatsapp.startsWith('+')) links.push(['WhatsApp', 'https://wa.me/' + v.whatsapp.replace(/[+ ]/g, '')]);
		if (v.email) links.push(['Email', 'mailto:' + v.email]);
		if (v.website_url) links.push(['Website', v.website_url]);
		if (v.instagram_url) links.push(['Instagram', v.instagram_url]);
		if (v.facebook_url) links.push(['Facebook', v.facebook_url]);
		els.links.hidden = !links.length;
		els.links.replaceChildren(...links.map(([text, href]) => {
			const a = node('a', 'btn btn-secondary btn-sm', text);
			a.href = href;
			if (href.startsWith('https:')) { a.target = '_blank'; a.rel = 'noopener'; }
			return a;
		}));
	}

	// One row a day, Monday first. A day with no row is closed. With no hours at
	// all nothing is known, which is not the same as closed all week.
	function renderHours(v) {
		const hours = v.hours || [];
		els.hoursBox.hidden = !hours.length && !v.hours_note;
		els.hours.replaceChildren(...(hours.length ? DAYS.flatMap((name, i) => {
			const today = hours.filter((h) => h.day === i + 1);
			return [node('dt', null, name),
				node('dd', null, today.length ? today.map((h) => h.opens + ' to ' + h.closes).join(', ') : 'Closed')];
		}) : []));
		els.hoursNote.hidden = !v.hours_note;
		els.hoursNote.textContent = v.hours_note || '';
	}

	function leagueCard(l) {
		const box = node('a', 'match-card');
		box.href = '/leagues/join/?s=' + encodeURIComponent(l.league_season_id);
		const top = node('div', 'match-top');
		top.append(node('span', 'match-opponent', l.league_name));
		const bits = [];
		if (l.season_name && l.season_name !== l.league_name) bits.push(l.season_name);
		if (l.discipline) bits.push(D.DISCIPLINE[l.discipline] || l.discipline);
		if (l.team_size === 1) bits.push('Singles');
		else if (l.team_size) bits.push('Teams of ' + l.team_size);
		if (l.starts_on) bits.push('From ' + day(l.starts_on));
		bits.push(l.players === 1 ? '1 player' : l.players + ' players');
		const tags = node('div', 'match-tags');
		tags.append(node('span', 'badge', D.LEAGUE_STATUS[l.status] || l.status));
		box.append(top, node('div', 'match-meta', bits.join(' · ')), tags);
		return box;
	}

	function tournamentCard(t) {
		const box = node('a', 'match-card');
		box.href = NOT_STARTED.includes(t.status) && t.poster_open
			? '/tournaments/poster/?t=' + encodeURIComponent(t.id)
			: '/tournaments/bracket/?t=' + encodeURIComponent(t.id);
		const top = node('div', 'match-top');
		top.append(node('span', 'match-opponent', t.name));
		const bits = [FORMAT[t.format] || t.format];
		if (t.starts_at) bits.push(day(t.starts_at));
		bits.push(t.max_entrants != null ? t.entrants + ' of ' + t.max_entrants : (t.entrants === 1 ? '1 entrant' : t.entrants + ' entrants'));
		const tags = node('div', 'match-tags');
		tags.append(node('span', 'badge ' + (STATUS_CLASS[t.status] || ''), STATUS[t.status] || t.status));
		box.append(top, node('div', 'match-meta', bits.join(' · ')), tags);
		return box;
	}

	function renderList(box, items, card, none) {
		box.replaceChildren(...(items.length ? items.map(card) : [node('p', 'muted', none)]));
	}

	TDCLoader.hold((async () => {
		const venueId = new URLSearchParams(location.search).get('v');
		if (!venueId) { els.nothing.hidden = false; return; }

		const [venue, comps] = await Promise.all([
			supabaseClient.rpc('tdc_venue', { p_venue_id: venueId }),
			supabaseClient.rpc('tdc_venue_competitions', { p_venue_id: venueId })
		]);
		if (venue.error) { TDC.showSupabaseError(AREA, venue.error, els.status); return; }
		if (comps.error) { TDC.showSupabaseError(AREA, comps.error, els.status); return; }
		if (!venue.data) { els.nothing.hidden = false; return; }

		const v = venue.data;
		renderBanner(v);
		renderLinks(v);
		els.aboutBox.hidden = !v.description;
		els.about.textContent = v.description || '';
		renderHours(v);
		renderList(els.leagues, comps.data.leagues, leagueCard, 'No leagues listed here yet.');
		renderList(els.tournaments, comps.data.tournaments, tournamentCard, 'No tournaments listed here yet.');
		els.venue.hidden = false;
	})(), 'Venue');
})();
