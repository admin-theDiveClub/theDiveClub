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
// The logo's section (#home-logo) is sized here to the cloth's visible height, the logo
// the shorter side of that over the golden ratio (UV, 16 Nov), so it is alone on opening.
// Every raised card (.home-raised, index.html) lies over the balls while staying in the
// box, so it scrolls with it and is clipped by it; nothing here moves them. The Get the
// app card shows only outside the installed app.
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
		// The Get the app card (UV, 16 Nov): never in the installed app
		var card = document.getElementById('home-install');
		if (card && !runningInstalled()) card.hidden = false;
		// Its ✕ hides it until the next visit (UV, 16 Nov): nothing is kept
		var cardX = document.getElementById('home-install-x');
		if (card && cardX) cardX.addEventListener('click', function () { card.hidden = true; });
		var bed = null, lastPlace = null;
		// The Get the app card at the top of the table (UV, 16 Nov): centred in the band from
		// the top of what is seen of the cloth (below any banner) to the black's cross, or,
		// the table on its side (the cross at the left), to the logo. In the box's own
		// coordinates, so it scrolls away with the logo and the markings
		function placeCard(under, seen, logo) {
			lastPlace = [under, seen, logo];
			if (!card || card.hidden) return;
			under = Math.max(0, Math.ceil(under));
			var foot = bed.land || !bed.cross ? under + (seen - logo) / 2 : bed.cross.top - bed.top;
			var mid = (under + foot) / 2;
			// Too tall for its band (a phone on its side): one line, the icon and "Get the
			// app" only (UV, 16 Nov)
			card.classList.remove('is-compact');
			if (card.offsetHeight > foot - under) card.classList.add('is-compact');
			card.style.left = Math.round((box.clientWidth - card.offsetWidth) / 2) + 'px';
			card.style.top = Math.round(mid - card.offsetHeight / 2) + 'px';
			if (card.offsetHeight > foot - under) console.error('[' + AREA + '] the Get the app card (' + card.offsetHeight + 'px) is taller than the room above the ' + (bed.land ? 'logo' : 'cross') + ' (' + Math.round(foot - under) + 'px); it is centred there all the same.');
		}
		function place() {
			if (!bed) return;
			try {
				var s = stage.getBoundingClientRect();
				var left = s.left + bed.left, top = s.top + bed.top;
				box.style.left = left + 'px';
				box.style.top = top + 'px';
				box.style.width = Math.max(0, bed.right - bed.left) + 'px';
				box.style.height = Math.max(0, bed.bottom - bed.top) + 'px';
				box.style.borderRadius = Math.round(bed.pocket * 0.6) + 'px';
				// The box is absolute, not fixed (index.html: it must not be a layer of its
				// own), so it is placed from whatever holds it: corrected by where it landed
				var b = box.getBoundingClientRect();
				if (Math.abs(b.left - left) > 0.5 || Math.abs(b.top - top) > 0.5) {
					box.style.left = (2 * left - b.left) + 'px';
					box.style.top = (2 * top - b.top) + 'px';
				}
				// The foot of the bar and of any banner showing under it, as they stand when the
				// bar shows (they slide away, but their sizes stay)
				var foot = bar ? bar.offsetHeight : 0;
				strips.forEach(function (el) { if (el.offsetHeight) foot = Math.max(foot, el.offsetTop + el.offsetHeight); });
				var under = foot - (s.top + bed.top);
				box.style.setProperty('--home-under-bar', Math.max(0, Math.ceil(under)) + 'px');
				// The logo's section is the cloth's visible height, so it is all that shows on
				// opening; the logo is square, the cloth's shorter side over the golden ratio
				// (UV, 16 Nov)
				var seen = Math.max(0, (bed.bottom - bed.top) - Math.max(0, Math.ceil(under)));
				box.style.setProperty('--home-first', Math.floor(seen) + 'px');
				var logo = Math.floor(Math.min(bed.right - bed.left, seen) / 1.618);
				box.style.setProperty('--home-logo-size', logo + 'px');
				placeCard(under, seen, logo);
			} catch (e) {
				TDC.error(AREA, 'the content could not be laid on the table.', e, statusEl);
			}
		}
		stage.addEventListener('tdc-hero-bed', function (e) { bed = e.detail; place(); });
		// A banner shown or closed (nav.js fills them in after the page has loaded)
		var watch = new ResizeObserver(place);
		strips.forEach(function (el) { watch.observe(el); });
		// The card's words wrapping differently, or the font arriving, changes its height
		if (card) new ResizeObserver(function () { if (bed && lastPlace) placeCard.apply(null, lastPlace); }).observe(card);
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
