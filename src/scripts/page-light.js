// The light (UV, 29 Oct): the green glow above every page drifts, slowly,
// from one random point to the next, and the shadow round the screen's edges
// is cast by it, as if the page were set into the phone and lit from above:
// the frame's lip nearest the light shades the top edge and the side the
// light is on. global.css draws both (body::before, body::after); this only moves
// them, through four properties on <html>:
//
//   --page-light-x   the light's distance right of the screen's centre (px)
//   --page-light-y   its distance above the top of the screen (px)
//   --page-shadow-x, --page-shadow-y   the shadow's offset (away from the light,
//                    which puts the shadow on the edges nearest it)
//
// Each move takes --page-glow-move, eased in and out, so the light comes to
// rest at every point before the next is picked. Points stay within
// --page-glow-drift-x (a share of the screen's width either side of the
// centre) and --page-glow-drift-y (px either side of --page-glow-rise), and
// the light never comes below the top of the screen. The tokens are read again
// at every move, so a change on /sandbox/ takes hold at the next one.
//
// The shadow is pushed --page-inset-offset along the line from the light to
// the screen's centre: with the light so far up that is nearly straight down,
// so its sideways part is multiplied by --page-inset-lean to be seen at all.
//
// Loaded in <head>, after the stylesheets, so the first paint already has the
// light where it is. Its place is kept for the session (sessionStorage), so
// moving between pages carries on the drift rather than jumping. Written at
// most every STEP ms: it moves a few pixels a second, and every write
// repaints the background and the blurred surfaces over it. With reduced
// motion the light rests at the centre.
(function () {
	'use strict';
	var STEP = 66;
	var KEY = 'tdc.light';
	var root = document.documentElement;
	var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
	var cfg, from, to, done, dur, last = 0, running = false;

	function read() {
		var cs = getComputedStyle(root);
		function n(name, fallback) {
			var v = parseFloat(cs.getPropertyValue(name));
			return isFinite(v) ? v : fallback;
		}
		var move = cs.getPropertyValue('--page-glow-move').trim();
		cfg = {
			rise: n('--page-glow-rise', 760),
			driftX: n('--page-glow-drift-x', 0.25),
			driftY: n('--page-glow-drift-y', 100),
			move: Math.max(1000, /ms$/.test(move) ? parseFloat(move) : n('--page-glow-move', 30) * 1000),
			offset: n('--page-inset-offset', 30),
			lean: n('--page-inset-lean', 4)
		};
	}

	function pick() {
		return {
			x: (Math.random() * 2 - 1) * cfg.driftX * window.innerWidth,
			y: (Math.random() * 2 - 1) * cfg.driftY
		};
	}

	// p: the light's place, x from the centre and y from the rise
	function put(p) {
		var lx = p.x, ly = Math.max(0, cfg.rise + p.y);
		var vx = -lx, vy = window.innerHeight / 2 + ly;   // light to the screen's centre
		var len = Math.hypot(vx, vy) || 1;
		root.style.setProperty('--page-light-x', lx.toFixed(1) + 'px');
		root.style.setProperty('--page-light-y', ly.toFixed(1) + 'px');
		// An inset shadow lies on the side opposite its offset, so an offset
		// pointing away from the light puts it on the edges nearest the light,
		// as the screen's frame would, set into the phone and lit from above
		root.style.setProperty('--page-shadow-x', (vx / len * cfg.offset * cfg.lean).toFixed(1) + 'px');
		root.style.setProperty('--page-shadow-y', (vy / len * cfg.offset).toFixed(1) + 'px');
	}

	function at() {
		var t = Math.min(1, done / dur);
		var e = 0.5 - 0.5 * Math.cos(Math.PI * t);
		return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
	}

	// The loading screen (loader.js) is up: nothing can be seen through its
	// blur, and on the match page every move of the light repaints the
	// stage's shadows and filters and then the blur over them, which slowed
	// the screen's dots on a phone (30 Oct). Before loader.js has run, the
	// screen is up if it is on the page and not hidden.
	function screenUp() {
		if (typeof TDCLoader !== 'undefined') return TDCLoader.up;
		var box = document.querySelector('.tdc-loader');
		return !!box && !box.hidden;
	}

	function tick(now) {
		if (!running) return;
		requestAnimationFrame(tick);
		// The light holds while the loading screen is up and carries on from
		// there once it goes
		if (screenUp()) { last = now; return; }
		// Time counts only while the page is shown, a frame at most STEP*2, so
		// a page brought back from the background carries on where it was
		if (now - last < STEP) return;
		done += Math.min(now - last, STEP * 2);
		last = now;
		if (done >= dur) {
			from = to;
			read();
			to = pick();
			done = 0;
			dur = cfg.move;
		}
		put(at());
	}

	function start() {
		if (running) return;
		running = true;
		last = performance.now();
		requestAnimationFrame(tick);
	}

	function still() {
		running = false;
		read();
		put({ x: 0, y: 0 });
	}

	read();
	try {
		var kept = JSON.parse(sessionStorage.getItem(KEY) || 'null');
		if (kept && kept.from && kept.to && isFinite(kept.done) && kept.dur > 0) {
			from = kept.from; to = kept.to; done = kept.done; dur = kept.dur;
		}
	} catch (e) {
		console.warn('[Light] Could not read its place; it starts afresh.', e);
	}
	if (!from) {
		from = pick(); to = pick(); done = 0; dur = cfg.move;
	}

	window.addEventListener('pagehide', function () {
		try {
			sessionStorage.setItem(KEY, JSON.stringify({ from: from, to: to, done: done, dur: dur }));
		} catch (e) {
			console.warn('[Light] Could not keep its place for the next page.', e);
		}
	});
	window.addEventListener('resize', function () { if (!running) put({ x: 0, y: 0 }); });
	calm.addEventListener('change', function () { if (calm.matches) still(); else start(); });

	if (calm.matches) still();
	else { put(at()); start(); }
})();
