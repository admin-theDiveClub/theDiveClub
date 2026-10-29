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
//
// Ready means, in this order: the page's own load (styles, scripts, the icon),
// its fonts, every hold settled, the network quiet (TDCNet: catches the nav's
// bell and picture, and the pages with no start of their own, sign-in for
// one), and the pictures on the page loaded; again until nothing new is held;
// then two frames, so what was drawn is painted behind the screen.
//
// The dots come only after GRACE, as for the dots' own page-load queue, so a
// page that is instant shows the icon and fades. Otherwise they serve a ring
// in the middle of the screen (a fake ring: invisible, its border's width is
// the dots' size) until the page is ready, then race it and fade as the screen
// does: the ring comes back over --loader-fade, and the dots fade only once it
// is back. With reduced motion there are no dots and the ring breathes
// (dots.css's calm pulse) until the screen fades.
//
// Never silent (CLAUDE.md): a page still not ready after HANG is shown as it
// stands, and the line at the foot of the screen says what it was waiting
// for. If this script never runs at all, loader.css drops the screen after
// 30 s, so a broken script cannot lock the page.
//
// Needs: tdc.js (TDC.error), supabaseClient.js (TDCNet); dots.js for the dots.

const TDCLoader = (() => {
	const AREA = 'Loader';
	const GRACE = 150;     // ms, as the dots' page-load queue (dots.js)
	const HANG = 20000;    // ms, as a call with no answer (dots.js)
	const ERROR_MS = 8000;

	const box = document.getElementById('tdc-loader');
	const ring = document.getElementById('tdc-loader-ring');
	if (box) box.dataset.state = 'up';   // the CSS fallback timer stops

	const holds = new Set();   // { promise, label } still out
	let up = !!box, away = false;
	let stage = 'the page';    // what it is waiting on, for the hang message
	let shown = null;          // resolves when the screen starts to fade
	let hideTimer = 0;         // hides the faded screen; stopped if it comes back

	function hold(promise, label) {
		if (!box) return promise;
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
		shown();
		// Hidden, not removed, once it has faded: the dots may still be racing
		// its ring, and a target that leaves the page before they are done
		// reads to them as a failure (dots.js, gone). It also comes back.
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
		const gone = new Promise((r) => { shown = r; });
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

		// The dots, once the page has not been instant. The ring's call is the
		// screen going.
		setTimeout(() => {
			if (!up || !ring) return;
			if (typeof TDCDots === 'undefined') {
				console.error(`[${AREA}] dots.js is not on this page, so the loader has no dots.`);
				return;
			}
			TDCDots.serve(ring, gone, { trace: 'none', timeout: HANG + 1000 });
		}, GRACE);
	}

	if (box) cycle();

	return {
		hold,
		leaving,
		get up() { return up; }
	};
})();
