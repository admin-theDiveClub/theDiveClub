// The light (UV, 7 Nov, the site's design): on every page but the match page it moves
// freely all round the screen, in a band just outside it, and never comes inside. Its
// place is a share of the way round the screen (round, clockwise from the top left
// corner) and a share of the way out across the band (out), each eased from one random
// point to the next, round the short way, so no move can cross the screen. Its glow is
// off (design.css): it is seen only in what it casts. The shadow falls straight away
// from it and is longer the nearer it is: twice --page-inset-offset at the screen's
// edge, once at the band's outer edge. A value is written only when it has changed:
// each write restyles the whole page and repaints every shadow. The match page keeps
// the drift below, for the stage.
//
// The light on the match page (UV, 29 Oct): the green glow above every page drifts, slowly,
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
// moving between pages carries on the drift rather than jumping. Written
// every STEP ms, by a timer rather than on every frame (3 Nov: battery), so
// nothing runs between writes: it moves a few pixels a second, and every
// write repaints the background and the blurred surfaces over it. With
// reduced motion the light rests at the centre: the device's setting, unless
// the profile menu's toggle or the phone saving power has put its own on
// <html> (data-motion, prefs.js).
//
// It also rests where it is once nobody has touched the page for REST ms
// (UV, 3 Nov: a phone left open on the table at the bar redrew the screen 15
// times a second for nothing), and drifts on from there at the next touch,
// key, scroll or wheel, or when the page is shown again. Nothing runs while
// the page is hidden.
(function () {
	'use strict';
	var STEP = 66;
	var REST = 30000;
	var ORBIT = !/^\/match\/?$/.test(location.pathname);
	var KEY = ORBIT ? 'tdc.light.orbit' : 'tdc.light';
	var BAND = 300;       // the orbit's band: its width, px
	var SPEED = 120;      // how fast it travels, px a second
	var SHORTEST = 4000;  // the least one move takes, ms
	var shownX = '', shownY = '';
	var root = document.documentElement;
	var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
	var cfg, from, to, done, dur, last = 0, running = false;
	var timer = null, touched = performance.now(), resting = false;

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
		if (ORBIT) return { round: Math.random(), out: Math.random() };
		return {
			x: (Math.random() * 2 - 1) * cfg.driftX * window.innerWidth,
			y: (Math.random() * 2 - 1) * cfg.driftY
		};
	}

	function shortWay(a, b) { return ((b - a + 1.5) % 1) - 0.5; }   // -0.5 to 0.5, the wrap taken

	// How long the next move takes.
	function moveTime() {
		if (!ORBIT) return cfg.move;
		var far = Math.abs(shortWay(from.round, to.round)) * 2 * (window.innerWidth + window.innerHeight);
		return Math.max(SHORTEST, far / SPEED * 1000);
	}

	// Screen coordinates of a place on the orbit: the screen's edge pushed out by depth,
	// walked clockwise from its top left corner.
	function locate(round, depth) {
		var w = window.innerWidth + 2 * depth, h = window.innerHeight + 2 * depth;
		var along = (((round % 1) + 1) % 1) * 2 * (w + h);
		if (along < w) return { x: -depth + along, y: -depth };
		along -= w;
		if (along < h) return { x: w - depth, y: -depth + along };
		along -= h;
		if (along < w) return { x: w - depth - along, y: h - depth };
		along -= w;
		return { x: -depth, y: h - depth - along };
	}

	function writeShadow(x, y) {
		if (x !== shownX) root.style.setProperty('--page-shadow-x', shownX = x);
		if (y !== shownY) root.style.setProperty('--page-shadow-y', shownY = y);
	}

	function putOrbit(p) {
		// At rest (less motion): straight down.
		if (p.round === undefined) { writeShadow('0.0px', cfg.offset.toFixed(1) + 'px'); return; }
		var at = locate(p.round, p.out * BAND);
		var vx = window.innerWidth / 2 - at.x, vy = window.innerHeight / 2 - at.y;
		var len = Math.hypot(vx, vy) || 1;
		var shadow = cfg.offset * (2 - p.out);
		writeShadow((vx / len * shadow).toFixed(1) + 'px', (vy / len * shadow).toFixed(1) + 'px');
	}

	// p: the light's place, x from the centre and y from the rise
	function put(p) {
		if (ORBIT) { putOrbit(p); return; }
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
		if (ORBIT) return { round: from.round + shortWay(from.round, to.round) * e, out: from.out + (to.out - from.out) * e };
		return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
	}

	// The light holds while the loading screen (loader.js) is up or the dots
	// (dots.js) are playing anywhere on the page (UV, 30 Oct). Every move of
	// the light repaints whatever is cast by it, and on the match page that
	// is the stage's shadows and filters (and the loading screen's blur over
	// them): on a phone it took frames from the dots, which crawled, first on
	// the loading screen and then on the cream ring. Nothing is seen moving
	// through the blur, and the drift is too slow to miss for a moment.
	// Before loader.js has run, the screen is up if it is on the page and not
	// hidden.
	function hold() {
		if (performance.now() < (window.TDCLightHeldUntil || 0)) return true;   // a dropdown moving (tdc-controls.js)
		if (typeof TDCDots !== 'undefined' && TDCDots.playing) return true;
		if (typeof TDCLoader !== 'undefined') return TDCLoader.up;
		var box = document.querySelector('.tdc-loader');
		return !!box && !box.hidden;
	}

	function tick() {
		timer = null;
		if (!running || document.hidden) return;
		var now = performance.now();
		// Nobody has touched the page for REST: no timer until somebody does
		if (now - touched >= REST) { resting = true; return; }
		timer = setTimeout(tick, STEP);
		// Held, it carries on from where it was once let go
		if (hold()) { last = now; return; }
		// Time counts only while the page is shown, a step at most STEP*2, so
		// a page brought back from the background carries on where it was
		done += Math.min(now - last, STEP * 2);
		last = now;
		if (done >= dur) {
			from = to;
			read();
			to = pick();
			done = 0;
			dur = moveTime();
		}
		put(at());
	}

	// The timer, if it should be running and is not
	function go() {
		if (!running || timer || resting || document.hidden) return;
		last = performance.now();
		timer = setTimeout(tick, STEP);
	}

	function start() {
		if (running) return;
		running = true;
		touched = performance.now();
		resting = false;
		go();
	}

	function still() {
		running = false;
		clearTimeout(timer);
		timer = null;
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
		from = pick(); to = pick(); done = 0; dur = moveTime();
	}

	window.addEventListener('pagehide', function () {
		try {
			sessionStorage.setItem(KEY, JSON.stringify({ from: from, to: to, done: done, dur: dur }));
		} catch (e) {
			console.warn('[Light] Could not keep its place for the next page.', e);
		}
	});
	window.addEventListener('resize', function () { if (!running) put({ x: 0, y: 0 }); });

	// Somebody is there: the rest starts again, and a resting light drifts on
	function wake() {
		touched = performance.now();
		if (resting) { resting = false; go(); }
	}
	['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
		window.addEventListener(type, wake, { passive: true, capture: true });
	});
	document.addEventListener('scroll', wake, { passive: true, capture: true });
	document.addEventListener('visibilitychange', function () {
		if (document.hidden) { clearTimeout(timer); timer = null; return; }
		wake();
		go();
	});

	// data-motion="reduce" or "full" overrides the device, as in dots.js
	function isCalm() {
		var m = root.dataset.motion;
		return m === 'reduce' || (m !== 'full' && calm.matches);
	}
	function motionChanged() { if (isCalm()) still(); else start(); }
	calm.addEventListener('change', motionChanged);
	new MutationObserver(motionChanged).observe(root, { attributes: true, attributeFilter: ['data-motion'] });

	if (isCalm()) still();
	else { put(at()); start(); }
})();
