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
//
// The Get the app card (UV, 16 Nov), outside the installed app, heads the content but is
// drawn over the balls, so it lives in its own layer (#home-over) given the box's shape
// and moved with the box's scroll, over an empty spot of its height in the content.
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
		// The Get the app card (UV, 16 Nov): over the balls in its own layer (over), clipped
		// to the box's shape, kept over its empty spot at the top of the content (spot)
		var over = document.getElementById('home-over');
		var card = document.getElementById('home-install');
		var spot = document.getElementById('home-install-spot');
		var showCard = !!(over && card && spot) && !runningInstalled();
		if (showCard) { card.hidden = false; spot.hidden = false; }
		var bed = null;
		function placeCard() {
			if (!showCard) return;
			card.style.left = spot.offsetLeft + 'px';
			card.style.width = spot.offsetWidth + 'px';
			spot.style.height = card.offsetHeight + 'px';
			card.style.transform = 'translateY(' + (spot.offsetTop - box.scrollTop) + 'px)';
		}
		function place() {
			if (!bed) return;
			try {
				var s = stage.getBoundingClientRect();
				box.style.left = (s.left + bed.left) + 'px';
				box.style.top = (s.top + bed.top) + 'px';
				box.style.width = Math.max(0, bed.right - bed.left) + 'px';
				box.style.height = Math.max(0, bed.bottom - bed.top) + 'px';
				box.style.borderRadius = Math.round(bed.pocket * 0.6) + 'px';
				if (over) {
					over.style.left = box.style.left;
					over.style.top = box.style.top;
					over.style.width = box.style.width;
					over.style.height = box.style.height;
					over.style.borderRadius = box.style.borderRadius;
				}
				// The foot of the bar and of any banner showing under it, as they stand when the
				// bar shows (they slide away, but their sizes stay)
				var foot = bar ? bar.offsetHeight : 0;
				strips.forEach(function (el) { if (el.offsetHeight) foot = Math.max(foot, el.offsetTop + el.offsetHeight); });
				var under = foot - (s.top + bed.top);
				box.style.setProperty('--home-under-bar', Math.max(0, Math.ceil(under)) + 'px');
				placeCard();
			} catch (e) {
				TDC.error(AREA, 'the content could not be laid on the table.', e, statusEl);
			}
		}
		stage.addEventListener('tdc-hero-bed', function (e) { bed = e.detail; place(); });
		// A banner shown or closed (nav.js fills them in after the page has loaded)
		var watch = new ResizeObserver(place);
		strips.forEach(function (el) { watch.observe(el); });
		if (showCard) {
			// The card's words wrapping differently, or the font arriving, changes its height
			watch.observe(card);
			box.addEventListener('scroll', function () {
				card.style.transform = 'translateY(' + (spot.offsetTop - box.scrollTop) + 'px)';
			}, { passive: true });
			// The card is not in the box, so a mouse wheel over it is handed to the box
			card.addEventListener('wheel', function (e) { box.scrollTop += e.deltaY; }, { passive: true });
		}
		bed = stage.heroBed || null;
		if (!bed) console.error('[' + AREA + '] the table has not said where its cloth is yet; the content waits for it.');
		place();
	}

	// As nav.js decides it: the installed app shows no Get the app card.
	// iOS Safari predates display-mode and reports navigator.standalone.
	function runningInstalled() {
		return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
			|| window.navigator.standalone === true;
	}
})();
