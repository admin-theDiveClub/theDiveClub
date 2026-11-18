// The pull down at the top to reload (UV, 17 Nov). On every page, in the
// browser and the installed app alike: a finger pulling the page down from
// its very top moves the page down under the bar, and the site's dots play
// in the space that opens above it (UV, 17 Nov: their own space, not over
// the content), on a ring that grows to fill that space; let go past REACH
// and the page reloads
// onto the current deploy (TDC.freshReload, as the menu's Reload button
// does), the dots carrying on until it goes; let go before and they gather
// into the ring's middle and vanish.
//
// While a finger pulls, the dots play the waiting moves one after another,
// every solo move then every group move, STEP ms each, round and round (UV:
// "looping through the animation list perpetually"). Where the list had got
// to is kept in this browser, so each pull carries on from the last.
//
// The browser's own pull to refresh is off (global.css, overscroll-behavior
// on the page), so there is one, the same on every phone (UV, 17 Nov).
//
// Universal (UV, 17 Nov: every page), so it gives way to anything already
// using the finger. A pull only starts where nothing could have scrolled or
// dragged instead:
//   - the page, and every box the finger is in that scrolls, at its top (the
//     home page's content scrolls in its own box, not the page)
//   - nothing under the finger takes the gesture itself (touch-action that
//     does not let the page pan up and down: the draw, the board's drags,
//     a slider), and no typing field, dropdown or data-pull="off"
//   - one finger, the page not zoomed in, and the pull mostly downwards
// Touch only: a mouse or trackpad has the browser's own reload.
//
// Needs: tdc.js (TDC.freshReload, TDC.error), dots.js (TDCDots). Its look
// is stylesheets/pull-refresh.css; sizes and colour --pull-* in
// variables.css.

(() => {
	const AREA = 'Pull';
	const START = 40;     // px the finger moves down before it counts as a pull (UV, 18 Nov: was 10, too easy to set off)
	const REACH = 80;     // px the page must come down to reload
	const MAX = 200;      // px it can come down at most; the pull stiffens towards it (UV, 18 Nov: was 128)
	const GAP = 12;       // px kept clear above and below the ring as it fills the space
	const STEP = 3000;   // ms each waiting move plays while pulling
	const MOVE_KEY = 'tdc.pull.move';
	const LEAVE_MS = 60000;   // as nav.js: how long a page may take to go

	if (typeof TDCDots === 'undefined') {
		TDC.error(AREA, 'dots.js is not loaded, so the pull down to reload has nothing to show.');
		return;
	}

	const list = TDCDots.moves.concat(TDCDots.groups);
	const store = {
		get() { try { return parseInt(localStorage.getItem(MOVE_KEY), 10) || 0; } catch { return 0; } },
		set(i) { try { localStorage.setItem(MOVE_KEY, String(i)); } catch { /* a private window: start at the top next time */ } }
	};

	// One gesture at a time: where it began, whether it is a pull yet, and
	// what it put on the page.
	let g = null;

	// Anything under the finger that would take the gesture, or a box it is
	// in that could still scroll up.
	function blocked(target) {
		if (window.visualViewport && window.visualViewport.scale > 1.01) return true;
		const root = document.scrollingElement || document.documentElement;
		if (root.scrollTop > 0 || window.scrollY > 0) return true;
		for (let n = target instanceof Element ? target : target && target.parentElement; n && n !== root && n !== document.body; n = n.parentElement) {
			if (n.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-pull="off"]')) return true;
			const cs = getComputedStyle(n);
			const ta = cs.touchAction;
			if (ta !== 'auto' && ta !== 'manipulation' && !ta.includes('pan-y')) return true;
			if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return true;
		}
		return false;
	}

	// The ring: new for every pull, so a pull straight after the last never
	// meets a ring the dots are still gathering into.
	function makeRing() {
		const el = document.createElement('div');
		el.className = 'tdc-pull';
		el.setAttribute('aria-hidden', 'true');
		document.body.append(el);
		return el;
	}

	// The page under the bar: pulled down with the finger, so the dots play in
	// a space of their own above it, not over it (UV, 17 Nov). The content
	// and the footer move; the bar, the light and the loading screen stay.
	// While moved, anything fixed inside the content moves with it (the
	// transform makes the content its frame), which is the page being pulled.
	const pageParts = () => document.querySelectorAll('body > main, body > footer, body > .site-footer');

	function place(el, y, parts) {
		// The ring fills the space opened above the content, GAP clear of it top
		// and bottom (UV, 18 Nov: the dots grow to fill the pull). The dots keep
		// their own size: they read the ring's size on the screen, not its line.
		const s = Math.max(0.2, (y - 2 * GAP) / el.offsetHeight);
		// The ring centred in the space opened above the content.
		el.style.setProperty('--pull-y', (y / 2 - el.offsetHeight / 2).toFixed(1) + 'px');
		el.style.setProperty('--pull-s', s.toFixed(3));
		for (const p of parts) p.style.transform = y > 0.5 ? `translateY(${y.toFixed(1)}px)` : '';
	}

	// The waiting moves, one after another for as long as the pull lasts.
	function cycle(state) {
		let i = store.get() % list.length;
		const next = () => {
			TDCDots.force(list[i]);
			i = (i + 1) % list.length;
			store.set(i);
		};
		next();
		state.timer = setInterval(next, STEP);
	}
	function stopCycle(state) {
		clearInterval(state.timer);
		state.timer = null;
		TDCDots.force(null);
	}

	function begin() {
		g.pulling = true;
		g.ring = makeRing();
		g.parts = [...pageParts()];
		for (const p of g.parts) p.style.transition = 'none';
		place(g.ring, 0, g.parts);
		// The dots open out of the ring's middle onto its line, play the moves
		// while the finger is down, and gather back in if it is let go short.
		g.call = new Promise((done) => { g.done = done; });
		TDCDots.serve(g.ring, g.call, { line: true, from: 'centre', end: 'gather', timeout: LEAVE_MS });
		cycle(g);
	}

	function pulled(dy) {
		// Stiffens as it nears MAX, never past it.
		const raw = Math.max(0, dy - START);
		return MAX * (1 - Math.exp(-raw / MAX));
	}

	// The finger lifted: the ring and the page ease to y together.
	function settle(state, y, then) {
		const el = state.ring;
		el.classList.add('is-easing');
		const ease = getComputedStyle(el).transitionDuration;
		for (const p of state.parts) p.style.transition = `transform ${ease} ease`;
		place(el, y, state.parts);
		if (then) setTimeout(then, parseFloat(ease) * 1000 || 0);
	}

	function cancel(state) {
		stopCycle(state);
		state.done();
		const el = state.ring;
		settle(state, 0, () => {
			// Back where it was, with nothing of the pull left on the page.
			for (const p of state.parts) { p.style.transition = ''; p.style.transform = ''; }
			setTimeout(() => el.remove(), 1000);
		});
	}

	function reload(state) {
		settle(state, REACH);
		// Back from the browser's history the page is shown as it was left:
		// let the dots go then.
		window.addEventListener('pageshow', (e) => {
			if (!e.persisted) return;
			cancel(state);
		}, { once: true });
		TDC.freshReload();
	}

	document.addEventListener('touchstart', (e) => {
		if (g && g.pulling) return;
		g = null;
		if (e.touches.length !== 1 || blocked(e.target)) return;
		const t = e.touches[0];
		g = { x: t.clientX, y: t.clientY, pulling: false, y1: 0 };
	}, { passive: true });

	document.addEventListener('touchmove', (e) => {
		if (!g) return;
		if (e.touches.length !== 1) {
			if (g.pulling) cancel(g);
			g = null;
			return;
		}
		const t = e.touches[0];
		const dx = t.clientX - g.x, dy = t.clientY - g.y;
		if (!g.pulling) {
			// Up, or more sideways than down: not a pull.
			if (dy < -4 || (Math.abs(dx) > 8 && Math.abs(dx) > dy)) { g = null; return; }
			if (dy < START || dy < Math.abs(dx) * 1.5) return;
			begin();
		}
		g.y1 = pulled(dy);
		place(g.ring, g.y1, g.parts);
	}, { passive: true });

	function end() {
		if (!g) return;
		const state = g;
		g = null;
		if (!state.pulling) return;
		if (state.y1 >= REACH) reload(state);
		else cancel(state);
	}
	document.addEventListener('touchend', end, { passive: true });
	document.addEventListener('touchcancel', () => {
		if (!g) return;
		const state = g;
		g = null;
		if (state.pulling) cancel(state);
	}, { passive: true });
})();
