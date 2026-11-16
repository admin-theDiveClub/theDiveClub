// The home page (UV, 16 Nov): the hero's table (hero.js) frozen in the screen under the
// bar, which always shows here, and the page's content scrolling in a box laid on its
// cloth, the balls rolling over it (index.html stacks the three).
//
// hero.js says where the cloth is each time it lays the table out ('tdc-hero-bed' on the
// stage, and stage.heroBed for the first time, which comes before this script runs);
// the box is placed on the cushions' noses, its corners rounded clear of the corner
// pockets' jaws. Any part of the box under the bar or the banners under it (nav.html:
// linked to your league record, Get the app; above everything here, as the bar is,
// UV 16 Nov: index.html) is padded (--home-under-bar), so the content's first line
// shows below them.
(function () {
	'use strict';
	var AREA = 'Home';
	var stage = document.getElementById('hero-stage');
	var box = document.getElementById('home-scroll');
	var statusEl = document.getElementById('hero-status');
	if (!stage || !box) return;
	try { init(); } catch (e) { TDC.error(AREA, 'the home page could not be laid out.', e, statusEl); }

	function init() {
		var strips = ['nav-linked', 'nav-get-app'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
		var bar = document.querySelector('.site-nav');
		var bed = null;
		function place() {
			if (!bed) return;
			try {
				var s = stage.getBoundingClientRect();
				box.style.left = (s.left + bed.left) + 'px';
				box.style.top = (s.top + bed.top) + 'px';
				box.style.width = Math.max(0, bed.right - bed.left) + 'px';
				box.style.height = Math.max(0, bed.bottom - bed.top) + 'px';
				box.style.borderRadius = Math.round(bed.pocket * 0.6) + 'px';
				// The foot of the bar and of any banner showing under it, as they stand when the
				// bar shows (they slide away, but their sizes stay)
				var foot = bar ? bar.offsetHeight : 0;
				strips.forEach(function (el) { if (el.offsetHeight) foot = Math.max(foot, el.offsetTop + el.offsetHeight); });
				var under = foot - (s.top + bed.top);
				box.style.setProperty('--home-under-bar', Math.max(0, Math.ceil(under)) + 'px');
			} catch (e) {
				TDC.error(AREA, 'the content could not be laid on the table.', e, statusEl);
			}
		}
		stage.addEventListener('tdc-hero-bed', function (e) { bed = e.detail; place(); });
		// A banner shown or closed (nav.js fills them in after the page has loaded)
		var watch = new ResizeObserver(place);
		strips.forEach(function (el) { watch.observe(el); });
		bed = stage.heroBed || null;
		if (!bed) console.error('[' + AREA + '] the table has not said where its cloth is yet; the content waits for it.');
		place();
	}
})();
