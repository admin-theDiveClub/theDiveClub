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
// The dive (UV, 3 Nov, replacing Loader A's dots): the wordmark behind, and
// the diver (scripts/dive.js, cloned from the layout's #tdc-dive-art) falling
// the screen's length into the portal at its foot. She starts only after
// GRACE, as for the dots' own page-load queue, so a page that is instant
// shows her still and fades. When the page is ready she is stopped (through
// once more, then the logo pose) as the screen fades; the fade does not wait
// for her. In both motion modes: she is the loader.
//
// With reduced motion the ring in the middle is also served, as before: no
// dots, so it breathes (dots.css's calm pulse) until the screen fades (UV:
// kept for now). With full motion the ring is not served at all.
//
// The screen going up and down is said on the document as 'tdc-loader'
// ({ detail: { up } }), for the nav's diver (nav.js).
//
// Never silent (CLAUDE.md): a page still not ready after HANG is shown as it
// stands, and the line at the foot of the screen says what it was waiting
// for. If this script never runs at all, loader.css drops the screen after
// 30 s, so a broken script cannot lock the page.
//
// Needs: tdc.js (TDC.error), supabaseClient.js (TDCNet), dive.js; dots.js for
// the ring under reduced motion.

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
		// The wordmark's width follows the portal's (UV, 3 Nov: fitted to the
		// screen it was far too big), times --loader-wordmark.
		const onLayout = ({ portal }) => box.style.setProperty('--loader-wordmark-width', `${portal}px`);
		return TDCDive.attach(svg, { frame: 'fit', onLayout });
	})();
	const say = () => document.dispatchEvent(new CustomEvent('tdc-loader', { detail: { up } }));

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
		if (dive) dive.stop();
		say();
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

		// The diver, once the page has not been instant; with reduced motion
		// the ring breathes too. The ring's call is the screen going.
		setTimeout(() => {
			if (!up) return;
			if (dive) dive.start();
			if (!ring) return;
			if (typeof TDCDots === 'undefined') {
				console.error(`[${AREA}] dots.js is not on this page, so the loader's ring cannot breathe.`);
				return;
			}
			if (TDCDots.state.reduced) TDCDots.serve(ring, gone, { trace: 'none', timeout: HANG + 1000 });
		}, GRACE);
	}

	if (box) cycle();

	return {
		hold,
		leaving,
		get up() { return up; }
	};
})();
