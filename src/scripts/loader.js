// The loader (UV, 29 Oct, items 10 and 11): a screen over every page until it
// has fully loaded, its data included, not just the HTML. Since UV's second
// look (29 Oct) it is see-through with a strong blur, not opaque. Loader A:
// the site's dots, big, in the middle of the screen, and the site icon exactly
// where the nav bar's icon sits, so as the loader fades the real one is left
// in the same spot. The screen itself is in layout.html, first in <body>, so
// it is there from the first paint; loader.css is its look.
//
//   TDCLoader.hold(promise, label)
//     how a page says "I am not ready until this settles". Every page's start
//     (its async block at the end) is wrapped in it; TDCDots.track holds what
//     it tracks, and league-nav.js the first tab's start and the tab bar.
//     Returns the promise. **Held after the screen has gone, it brings the
//     screen back** (UV, 29 Oct: the loader shows wherever a section is still
//     loading), at once, until that is in: a league tab opened for the first
//     time, whose start holds as the page's did. A start that throws is
//     reported ("TDC (Error): …") and the page shown
//   TDCLoader.leaving()
//     the page is going elsewhere (TDC.requireSession sending a stranger to
//     sign in): the loader stays up until the browser has gone, rather than
//     showing a page for a moment on the way
//   TDCLoader.up  true while the screen is up. The dots' page-load queue
//     waits while it is (dots.js): its targets are under the screen
//   TDCLoader.cover(host, label)
//     a screen over one part of the page only (UV, 5 Nov): a tab opened after
//     the page has loaded. The wordmark and the dive, sized to the host, the
//     diver in the part of it on the screen; no blur: the host's content is
//     invisible until it is ready, then fades in. Any hold made while it
//     is up, and the page's screen is not, joins it rather than bringing the
//     page's screen back; it goes when they have all settled, as the page's
//     does. With the page's screen up there is nothing to cover: it is held
//   TDCLoader.covers(el)  true while el is under a screen, the page's or a
//     cover's (dots.js: what is under one is shown, not faded in)
//
// Ready means, in this order: the page's own load (styles, scripts, the icon),
// its fonts, every hold settled, the network quiet (TDCNet: catches the nav's
// bell and picture, and the pages with no start of their own, sign-in for
// one), and the pictures on the page loaded; again until nothing new is held;
// then two frames, so what was drawn is painted behind the screen.
//
// The dive (UV, 3 Nov, replacing Loader A's dots): the wordmark behind, and
// the diver (scripts/dive.js, cloned from the layout's #tdc-dive-art) falling
// the screen's length into the portal at its foot. She starts only after
// GRACE, as for the dots' own page-load queue, so a page that is instant
// shows her still and fades. When the page is ready she is stopped (through
// once more, then the logo pose) as the screen fades; the fade does not wait
// for her. In both motion modes she is the loader, alone: no dots and no
// breathing ring (UV, 3 Nov: the ring is gone from the screen).
//
// The screen going up and down is said on the document as 'tdc-loader'
// ({ detail: { up } }), for the nav's diver (nav.js).
//
// Never silent (CLAUDE.md): a page still not ready after HANG is shown as it
// stands, and the line at the foot of the screen says what it was waiting
// for. If this script never runs at all, loader.css drops the screen after
// 30 s, so a broken script cannot lock the page.
//
// Needs: tdc.js (TDC.error), supabaseClient.js (TDCNet), dive.js.

const TDCLoader = (() => {
	const AREA = 'Loader';
	const GRACE = 150;     // ms, as the dots' page-load queue (dots.js)
	const HANG = 20000;    // ms, as a call with no answer (dots.js)
	const ERROR_MS = 8000;

	const box = document.getElementById('tdc-loader');
	if (box) box.dataset.state = 'up';   // the CSS fallback timer stops

	const holds = new Set();   // { promise, label } still out
	const covers = [];         // the tab covers up (cover()), the newest last
	let up = !!box, away = false;
	let stage = 'the page';    // what it is waiting on, for the hang message
	let hideTimer = 0;         // hides the faded screen; stopped if it comes back

	// The diver: a copy of the layout's drawing, in the screen's stage.
	const dive = (() => {
		const stage = box && box.querySelector('.tdc-loader-dive');
		const art = document.getElementById('tdc-dive-art');
		if (!stage) return null;
		if (!art || typeof TDCDive === 'undefined') {
			console.error(`[${AREA}] the dive (dive.js, #tdc-dive-art) is not on this page, so the loading screen has no diver.`);
			return null;
		}
		const svg = art.content.querySelector('svg.dive').cloneNode(true);
		svg.removeAttribute('role');
		svg.removeAttribute('aria-label');
		stage.append(svg);
		// The scene (portal, ladder and diver) takes the screen's width over
		// the golden ratio (UV, 3 Nov: padding at the sides), within the
		// dive's own height and size limits; the wordmark is as wide as the
		// scene, times --loader-wordmark.
		const onLayout = ({ scene }) => box.style.setProperty('--loader-wordmark-width', `${scene}px`);
		return TDCDive.attach(svg, { frame: 'fit', across: 1 / 1.618, onLayout });
	})();
	const say = () => document.dispatchEvent(new CustomEvent('tdc-loader', { detail: { up } }));

	function hold(promise, label) {
		if (!box) return promise;
		// A tab's cover is up and the page's is not: it waits for this too.
		const local = !up && covers.length ? covers[covers.length - 1] : null;
		if (local) { local.hold(promise, label); return promise; }
		if (!up) raise();
		const h = { promise: Promise.resolve(promise), label: label || 'the page' };
		holds.add(h);
		h.promise.then(() => holds.delete(h), (err) => {
			holds.delete(h);
			fail(`${h.label} could not finish loading, so the page is shown as it stands.`, err);
		});
		return promise;
	}

	function leaving() { away = true; }

	const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
	// Pictures still loading that the page will wait for: not a lazy one,
	// which loads only when scrolled to.
	function pictures() {
		const out = [...document.images].filter((i) => !i.complete && i.loading !== 'lazy');
		return Promise.all(out.map((i) => new Promise((r) => {
			i.addEventListener('load', r, { once: true });
			i.addEventListener('error', r, { once: true });
		})));
	}

	async function ready() {
		stage = 'the page’s files';
		if (document.readyState !== 'complete') await new Promise((r) => addEventListener('load', r, { once: true }));
		stage = 'its fonts';
		if (document.fonts) await document.fonts.ready;
		for (;;) {
			while (holds.size) {
				stage = null;   // what is still held, read when it is asked for (waitingFor)
				await Promise.allSettled([...holds].map((h) => h.promise));
			}
			stage = 'the network';
			if (typeof TDCNet !== 'undefined' && TDCNet.quiet) await TDCNet.quiet();
			stage = 'its pictures';
			await pictures();
			if (!holds.size) break;
		}
		await frame();
		await frame();
	}

	// What it is waiting on now, for the hang message: the holds still out
	// (not those out when the wait began, which named a page's start long
	// finished), else the stage.
	const waitingFor = () => stage || [...new Set([...holds].map((h) => h.label))].join(', ') || 'the page';

	// ─── The screen goes ───
	function hide() {
		if (!up) return;
		up = false;
		box.dataset.state = 'leaving';
		box.setAttribute('aria-busy', 'false');
		if (dive) dive.stop();
		say();
		// Hidden, not removed, once it has faded: it comes back.
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => { box.hidden = true; }, fadeMs() + 50);
	}

	// ─── The screen comes back (a section loading after the page is shown) ───
	// At once, with no fade in: what is under it is not ready to be seen.
	function raise() {
		clearTimeout(hideTimer);
		up = true;
		box.hidden = false;
		box.style.transition = 'none';
		box.dataset.state = 'up';
		box.setAttribute('aria-busy', 'true');
		void box.offsetWidth;   // the opacity lands before the transition is back
		box.style.transition = '';
		say();
		cycle();
	}
	function fadeMs() {
		const s = getComputedStyle(box).getPropertyValue('--loader-fade').trim();
		return (parseFloat(s) || 0) * (s.endsWith('ms') ? 1 : 1000);
	}

	// A failure: to the console, and on its own line at the foot of the screen
	// (the dots' look, dots.css), the page having none that every page shares.
	let errBox = null, errLine = null, errTimer = 0;
	function fail(message, detail) {
		if (!errBox) {
			errBox = document.createElement('div');
			errBox.className = 'tdc-dots-error tdc-loader-error';
			errLine = document.createElement('div');
			errLine.setAttribute('role', 'status');
			errBox.append(errLine);
			document.body.append(errBox);
		}
		TDC.error(AREA, message, detail, errLine);
		errBox.dataset.shown = '';
		clearTimeout(errTimer);
		errTimer = setTimeout(() => { delete errBox.dataset.shown; }, ERROR_MS);
	}

	// One showing of the screen: from up until ready, then the fade. The page
	// opening, and each time a hold brings it back.
	function cycle() {
		const hang = setTimeout(() => {
			if (!up) return;
			fail(`the page was still loading after ${HANG / 1000} s (waiting for ${waitingFor()}), so it is shown as it stands.`);
			hide();
		}, HANG);

		ready().then(() => {
			clearTimeout(hang);
			if (!away) hide();
		}, (err) => {
			clearTimeout(hang);
			fail('the loading screen could not tell when the page was ready, so the page is shown as it stands.', err);
			hide();
		});

		// The diver, once the page has not been instant.
		setTimeout(() => {
			if (up && dive) dive.start();
		}, GRACE);
	}

	if (box) cycle();

	// ─── A screen over one part of the page (UV, 5 Nov) ───
	// A tab opened after the page has loaded: the screen over that tab only,
	// the rest of the page (the nav, the tab bar) left as it is. No blur (UV,
	// 5 Nov, second look): the tab's content is invisible until it has
	// loaded, then fades in (loader.css). The
	// same parts as the page's screen, built into the host: the box over the whole
	// host, and inside it a view that stays on the screen (sticky under the
	// nav) as tall as the part of the host that fits, with the wordmark and
	// the diver in it. The host keeps some height while covered, so a tab
	// that has drawn nothing yet still has room for the screen.
	function cover(host, label) {
		if (!box || !host) return;
		if (up) return;   // the page's screen is over everything already
		if (covers.some((c) => c.host === host)) return;

		const el = document.createElement('div');
		el.className = 'tdc-loader tdc-loader-cover';
		el.dataset.state = 'up';
		el.setAttribute('role', 'status');
		el.setAttribute('aria-label', 'Loading');
		el.setAttribute('aria-busy', 'true');
		const view = document.createElement('div');
		view.className = 'tdc-loader-view';
		for (const img of box.querySelectorAll('.tdc-loader-wordmark')) view.append(img.cloneNode(true));
		const stage = document.createElement('div');
		stage.className = 'tdc-loader-dive';
		stage.setAttribute('aria-hidden', 'true');
		view.append(stage);
		el.append(view);
		host.classList.add('tdc-covered');
		host.append(el);

		// The view: the part of the host on the screen, under the nav. Kept
		// there as the page scrolls or resizes; the dive lays itself out
		// again when its box changes (dive.js).
		// The nav's foot where it is now (it hides as the page scrolls).
		const navTotal = () => {
			const nav = document.querySelector('nav.site-nav');
			return nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
		};
		let placing = 0;
		const place = () => {
			placing = 0;
			const r = host.getBoundingClientRect();
			const top = Math.max(r.top, navTotal());
			const bottom = Math.min(r.bottom, innerHeight);
			view.style.top = `${Math.max(0, top - r.top)}px`;
			view.style.height = `${Math.max(0, bottom - top)}px`;
		};
		const replace = () => { if (!placing) placing = requestAnimationFrame(place); };
		place();
		addEventListener('scroll', replace, { passive: true });
		addEventListener('resize', replace);
		const watchHost = new ResizeObserver(replace);
		watchHost.observe(host);

		let diver = null;
		const art = document.getElementById('tdc-dive-art');
		if (art && typeof TDCDive !== 'undefined') {
			const svg = art.content.querySelector('svg.dive').cloneNode(true);
			svg.removeAttribute('role');
			svg.removeAttribute('aria-label');
			stage.append(svg);
			const onLayout = ({ scene }) => el.style.setProperty('--loader-wordmark-width', `${scene}px`);
			diver = TDCDive.attach(svg, { frame: 'fit', across: 1 / 1.618, onLayout });
		} else {
			console.error(`[${AREA}] the dive (dive.js, #tdc-dive-art) is not on this page, so the tab's loading screen has no diver.`);
		}

		const mine = new Set();
		const c = {
			host,
			hold(promise, what) {
				const h = { promise: Promise.resolve(promise), label: what || label || 'the tab' };
				mine.add(h);
				h.promise.then(() => mine.delete(h), (err) => {
					mine.delete(h);
					fail(`${h.label} could not finish loading, so it is shown as it stands.`, err);
				});
			}
		};
		covers.push(c);

		let gone = false;
		const finish = () => {
			if (gone) return;
			gone = true;
			const at = covers.indexOf(c);
			if (at >= 0) covers.splice(at, 1);
			el.dataset.state = 'leaving';
			el.setAttribute('aria-busy', 'false');
			if (diver) diver.stop();
			// The tab's content, invisible while covered, fades in as the
			// wordmark and diver fade out (loader.css, UV 5 Nov).
			host.classList.add('tdc-revealed');
			setTimeout(() => {
				removeEventListener('scroll', replace);
				removeEventListener('resize', replace);
				watchHost.disconnect();
				cancelAnimationFrame(placing);
				if (diver) diver.destroy();
				el.remove();
				if (!covers.some((o) => o.host === host)) host.classList.remove('tdc-covered', 'tdc-revealed');
			}, fadeMs() + 50);
		};
		const hang = setTimeout(() => {
			if (gone) return;
			const still = [...new Set([...mine].map((h) => h.label))].join(', ') || label || 'the tab';
			fail(`${label || 'the tab'} was still loading after ${HANG / 1000} s (waiting for ${still}), so it is shown as it stands.`);
			finish();
		}, HANG);

		// Ready as the page is: every hold settled, the network quiet, the
		// host's pictures in; again until nothing new is held; two frames.
		// One frame first, so the tab's start (run straight after this) has
		// made its holds.
		const pics = () => Promise.all([...host.querySelectorAll('img')]
			.filter((i) => !i.complete && i.loading !== 'lazy')
			.map((i) => new Promise((r) => {
				i.addEventListener('load', r, { once: true });
				i.addEventListener('error', r, { once: true });
			})));
		(async () => {
			await frame();
			for (;;) {
				while (mine.size) await Promise.allSettled([...mine].map((h) => h.promise));
				if (typeof TDCNet !== 'undefined' && TDCNet.quiet) await TDCNet.quiet();
				await pics();
				if (!mine.size) break;
			}
			await frame();
			await frame();
		})().then(() => { clearTimeout(hang); finish(); }, (err) => {
			clearTimeout(hang);
			fail(`could not tell when ${label || 'the tab'} was ready, so it is shown as it stands.`, err);
			finish();
		});

		setTimeout(() => { if (!gone && diver) diver.start(); }, GRACE);
	}

	const covers_ = (el) => up || (!!el && covers.some((c) => c.host.contains(el)));

	return {
		hold,
		leaving,
		cover,
		covers: covers_,
		get up() { return up; }
	};
})();
