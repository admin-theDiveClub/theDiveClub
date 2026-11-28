// The tournament follow page (/tournaments/follow/?t=<id>; UV, 28 Nov;
// docs/systems/tournaments.md, "The follow page").
//
// A TD puts it on a TV at the venue and leaves it for the night, "knowing
// that everything will just work". Signed in only (TVs will sign in by QR);
// any signed-in account may open it (UV, 28 Nov).
//
// One read, tdc_tournament_follow, every 10 s while shown, and again when the
// screen wakes or the network comes back. What it shows follows the read:
//   - no draw: the QR opens the tournament's short link (strangers land on the
//     poster to enter, entrants on the draw); the entrants on the right.
//   - a draw: the bracket on the right (UV, 28 Nov: as soon as it exists), the
//     draw page itself in a frame with &tv=1 (tournament-bracket.js), which is
//     live on its own and reads again every 30 s.
//   - play started: the QR opens /tournaments/my-match/, each player's own
//     match on the draw, otherwise the draw (UV, 28 Nov).
// A failed read is said on the page and the next one tries again; the last
// good picture stays up meanwhile. The screen is kept awake where the browser
// allows it, and the site's bar hides itself, as on the wallpaper.
//
// Needs: tdc.js, credits-card.js (the QR look), match-settings.js,
// poster-words.js (the poster's words for the format and rules).

(() => {
	const AREA = 'Follow';
	const EVERY = 10000;    // ms between reads (as the public draw, 27 Nov)
	const IDLE_MS = 4000;   // the bar hides after this long with nothing done (the wallpaper's)
	const W = TDCPosterWords;

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('fw-name'), qr: el('fw-qr'), scan: el('fw-scan'), link: el('fw-link'),
		facts: el('fw-facts'), main: el('fw-main'), entrants: el('fw-entrants'),
		bracket: el('fw-bracket'), status: el('page-status')
	};
	const tournamentId = new URLSearchParams(location.search).get('t');

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── The bar hides itself (as wallpaper.js) ───
	// Back on any mouse move, tap or key (a TV remote's arrows are keys); never
	// hidden while its menu or profile panel is open.
	const bar = document.querySelector('.site-nav');
	let idle = null;
	const anyOpen = () => !!document.querySelector('#nav-menu-toggle[aria-expanded="true"], #nav-profile[aria-expanded="true"]');
	function wake() {
		if (!bar) return;
		bar.classList.remove('is-hidden');
		clearTimeout(idle);
		idle = setTimeout(function sleep() {
			if (anyOpen() || bar.matches(':focus-within')) { idle = setTimeout(sleep, IDLE_MS); return; }
			bar.classList.add('is-hidden');
		}, IDLE_MS);
	}
	['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
		window.addEventListener(type, wake, { passive: true });
	});
	wake();

	// ─── The screen kept awake ───
	// The browser's wake lock, taken again whenever the page is shown (a lock
	// goes when the page is hidden). Some browsers (Safari) refuse it until the
	// screen has been touched: then the page asks for one tap and tries again on
	// it. A browser without one is said: the TV itself must be set not to sleep.
	let lock = null, lockSaid = false, lockAsked = false, lockShown = false;
	async function keepAwake() {
		if (document.visibilityState !== 'visible' || lock) return;
		if (!('wakeLock' in navigator)) {
			if (!lockSaid) TDC.error(AREA, 'this browser cannot keep the screen awake. Set the TV not to sleep.', null, els.status);
			lockSaid = true;
			return;
		}
		try {
			lock = await navigator.wakeLock.request('screen');
			lock.addEventListener('release', () => { lock = null; });
			if (lockShown) { lockShown = false; TDC.status(els.status, ''); }
		} catch (err) {
			TDC.error(AREA, 'the screen is not being kept awake (' + (err && err.message || err) + '). Tap the screen once, or set the TV not to sleep.', err, els.status);
			lockShown = true;
			if (!lockAsked) {
				lockAsked = true;
				const again = () => { lockAsked = false; keepAwake(); };
				window.addEventListener('pointerdown', again, { once: true });
				window.addEventListener('keydown', again, { once: true });
			}
		}
	}

	// ─── Drawing ───
	let shownLink = null;    // the QR's link as drawn, so it is drawn again only when it changes
	let framed = false;      // the bracket's frame loaded

	function drawQr(link) {
		if (link === shownLink) return Promise.resolve();
		shownLink = link;
		return TDC.busy(els.qr, TDCCredits.loadQr(), els.status).then(() => {
			if (shownLink === link) els.qr.replaceChildren(TDCCredits.qrSvg(link));
		});
	}

	function fact(label, value) {
		if (!value) return null;
		const li = node('li');
		li.append(node('span', 'fw-fact-label', label), node('span', 'fw-fact-value', value));
		return li;
	}

	function drawFacts(t, venues) {
		const confirmed = t.entrants.filter((e) => e.status === 'confirmed').length;
		const race = t.win_condition_type
			? (t.win_condition_type === 'free_play' || !t.win_condition_target
				? W.ruleText('win_condition_type', t.win_condition_type)
				: W.ruleText('win_condition_type', t.win_condition_type) + ' ' + t.win_condition_target)
			: null;
		els.facts.replaceChildren(...[
			fact('Where', venues.join(', ')),
			fact('When', W.startsAt(t.starts_at)),
			fact('Game', t.discipline ? W.ruleText('discipline', t.discipline) : null),
			fact('Format', W.FORMAT[t.format] || t.format),
			fact('Matches', race),
			fact('Players', confirmed + (t.max_entrants ? ' of ' + t.max_entrants : '') + ' confirmed')
		].filter(Boolean));
	}

	function avatar(e) {
		const url = TDC.pictureUrl('player-avatars', e.avatar_path);
		if (url) {
			const img = node('img', 'fw-pic');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			return img;
		}
		const initials = (e.display_name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		return node('span', 'fw-pic fw-initials', initials);
	}

	function group(title, list) {
		if (!list.length) return null;
		const sec = node('section', 'fw-group');
		const head = node('h2', 'fw-group-head', title + ' ');
		head.append(node('span', 'fw-count', '(' + list.length + ')'));
		const ul = node('ul', 'fw-list');
		for (const e of list) {
			const li = node('li', 'fw-person');
			li.append(avatar(e), node('span', 'fw-person-name', e.display_name || 'Player'));
			ul.append(li);
		}
		sec.append(head, ul);
		return sec;
	}

	function drawEntrants(t) {
		const confirmed = t.entrants.filter((e) => e.status === 'confirmed');
		const interested = t.entrants.filter((e) => e.status === 'interested');
		const parts = [group('Confirmed', confirmed), group('Interested', interested)].filter(Boolean);
		if (!parts.length) parts.push(node('p', 'fw-empty', 'No one has entered yet. Scan the code to be the first.'));
		const was = els.entrants.textContent;
		els.entrants.replaceChildren(...parts);
		if (els.entrants.textContent !== was) fitEntrants();
	}

	// The entrants fill their part of the screen without scrolling: the largest
	// text (--fw-list-size, rem) at which every name fits, found by halving.
	function fitEntrants() {
		const box = els.entrants;
		if (box.hidden || !box.clientHeight) return;
		const fits = () => box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1;
		let lo = 0.5, hi = 3;
		for (let i = 0; i < 12; i++) {
			const mid = (lo + hi) / 2;
			box.style.setProperty('--fw-list-size', mid + 'rem');
			if (fits()) lo = mid; else hi = mid;
		}
		box.style.setProperty('--fw-list-size', lo + 'rem');
	}
	// On a wide screen the QR is as large as the side leaves once everything
	// else in it is drawn: the side's height less the other lines and the gaps,
	// no wider than the side (follow.css, --fw-qr-size). On a tall screen the
	// side's height follows its content, so the stylesheet sizes it.
	const side = document.querySelector('.fw-side');
	const wide = matchMedia('(orientation: landscape)');
	// A long name on a short screen (a phone on its side) would leave the QR
	// almost nothing, so the side's words shrink first (--fw-side, down to half)
	// until the QR has at least half the side's height or its full width.
	function fitSide() {
		side.style.setProperty('--fw-side', '1');
		if (!wide.matches) { els.qr.style.removeProperty('--fw-qr-size'); return; }
		const roomLeft = () => {
			const gap = parseFloat(getComputedStyle(side).rowGap) || 0;
			let taken = 0, others = 0;
			for (const c of side.children) {
				if (c === els.qr || c.hidden || getComputedStyle(c).display === 'none') continue;
				taken += c.offsetHeight;
				others++;
			}
			return side.clientHeight - taken - gap * others;
		};
		const want = Math.min(side.clientWidth, side.clientHeight / 2);
		let scale = 1, room = roomLeft();
		while (room < want && scale > 0.5) {
			scale = Math.round((scale - 0.1) * 10) / 10;
			side.style.setProperty('--fw-side', String(scale));
			room = roomLeft();
		}
		els.qr.style.setProperty('--fw-qr-size', Math.floor(Math.max(64, Math.min(side.clientWidth, room))) + 'px');
	}
	function fitAll() { fitSide(); fitEntrants(); }
	let resizeTimer = 0;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(fitAll, 200);
	});
	// The display font arriving changes the name's height.
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

	function draw(t, venues) {
		document.title = t.name + ' — The Dive Club';
		els.name.textContent = t.name;
		drawFacts(t, venues);

		// The QR: entering until play starts, then each player's match.
		const enter = t.short_code
			? location.origin + '/T-' + t.short_code
			: location.origin + '/tournaments/poster/?t=' + encodeURIComponent(t.id);
		const link = t.started ? location.origin + '/tournaments/my-match/?t=' + encodeURIComponent(t.id) : enter;
		els.scan.textContent = t.started ? 'Scan for your match' : 'Scan to enter';
		els.link.textContent = t.started ? '' : enter.replace(/^https?:\/\//, '');
		els.link.hidden = t.started;

		// The right: the entrants until there is a draw, then the bracket.
		els.main.classList.toggle('has-draw', t.has_draw);
		els.entrants.hidden = t.has_draw;
		els.bracket.hidden = !t.has_draw;
		if (t.has_draw && !framed) {
			framed = true;
			els.bracket.src = '/tournaments/bracket/?t=' + encodeURIComponent(t.id) + '&tv=1';
		}
		if (!t.has_draw) {
			if (framed) { framed = false; els.bracket.removeAttribute('src'); }
			drawEntrants(t);
		}
		fitSide();
		return drawQr(link);
	}

	// ─── Reading ───
	let venues = null;    // where it is played: read once
	let timer = 0;
	let failing = false;
	let reading = false;  // one read at a time, so two triggers never start two loops

	async function read() {
		if (reading) return;
		reading = true;
		clearTimeout(timer);
		try {
			if (!venues) {
				const places = await supabaseClient.rpc('tdc_tournament_venue_list', { p_tournament_id: tournamentId });
				if (places.error) throw places.error;
				venues = (places.data || []).map((v) => v.name).filter(Boolean);
			}
			const { data, error } = await supabaseClient.rpc('tdc_tournament_follow', { p_tournament_id: tournamentId });
			if (error) throw error;
			if (!data) {
				TDC.error(AREA, 'no tournament with that id. Check the link.', { tournamentId }, els.status);
				reading = false;
				return;   // nothing to follow: no more reads
			}
			await draw(data, venues);
			// Back after a failure: the error goes (the wake lock's warning stays said in the console).
			if (failing) { failing = false; TDC.status(els.status, ''); }
		} catch (err) {
			failing = true;
			TDC.showSupabaseError(AREA, err, els.status);
		}
		reading = false;
		if (document.visibilityState === 'visible') timer = setTimeout(read, EVERY);
	}

	// Shown again, or back online: read now and take the wake lock again.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') { clearTimeout(timer); return; }
		keepAwake();
		read();
	});
	window.addEventListener('online', read);

	// ─── Start ───
	TDCLoader.hold((async () => {
		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament\'s Manage menu.', null, els.status);
			return;
		}
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		keepAwake();
		await read();
	})(), 'the tournament');
})();
