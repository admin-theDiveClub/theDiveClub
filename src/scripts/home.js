// The home page (UV, 16 Nov): the site icon where the loading screen leaves it, and the
// hero's pool table (hero.js) covering the first screen over it.
//
// The icon is the loading screen's own drawing (the layout's #tdc-dive-art, dive.js), at
// rest, in a box the size of the loading screen's (index.html .home-icon) and with the
// same options as loader.js, so its portal lands on the loader's portal (UV: "use the
// portal to align them") and the loader fades into the page with nothing moving. It
// sits at the foot of the first screen, as the loader's does.
//
// The table covers the screen (UV, 16 Nov: "use screen size"): its stage runs from where
// the page's content starts (under the bar, and the strip under it when there is one)
// to the foot of the first screen, edge to edge, and its shape follows the screen
// (hero.js). The icon lies under the table, inside its cloth, so the balls roll over it.
(function () {
	'use strict';
	var AREA = 'Home';
	var box = document.getElementById('home-icon');
	var stage = document.getElementById('hero-stage');
	var statusEl = document.getElementById('hero-status');
	if (!box || !stage) return;
	try { init(); } catch (e) { TDC.error(AREA, 'the home page could not be laid out.', e, statusEl); }

	function init() {
		var art = document.getElementById('tdc-dive-art');
		if (!art || typeof TDCDive === 'undefined') throw new Error('the dive drawing (#tdc-dive-art, dive.js) is not on this page.');
		var svg = art.content.querySelector('svg.dive').cloneNode(true);
		svg.removeAttribute('role');
		svg.removeAttribute('aria-label');
		box.append(svg);
		// As loader.js: frame 'fit', the scene the screen's width over the golden ratio
		if (!TDCDive.attach(svg, { frame: 'fit', across: 1 / 1.618 })) throw new Error('the dive drawing could not be laid out.');

		var parts = [svg.querySelector('.dive-base'), svg.querySelector('.dive-diver')];

		// The foot of the icon's box is the foot of the first screen. The icon itself (the
		// portal, ladder and diver as drawn) goes to hero.js as data-keep, so the table's
		// cloth always holds it (UV, 16 Nov: "as if on the cloth")
		function size() {
			try {
				var foot = box.getBoundingClientRect().bottom, top = stage.getBoundingClientRect().top;
				stage.style.height = Math.max(0, Math.floor(foot - top)) + 'px';
				var s = stage.getBoundingClientRect(), r = parts.map(function (p) { return p.getBoundingClientRect(); });
				var keep = [
					Math.min(r[0].left, r[1].left) - s.left, Math.min(r[0].top, r[1].top) - s.top,
					Math.max(r[0].right, r[1].right) - s.left, Math.max(r[0].bottom, r[1].bottom) - s.top,
				].map(Math.round).join(',');
				if (stage.dataset.keep !== keep) stage.dataset.keep = keep;
			} catch (e) {
				TDC.error(AREA, 'the table could not be sized.', e, statusEl);
			}
		}
		// Whenever the screen or the page above the table changes height (the strip under the bar)
		var watch = new ResizeObserver(size);
		watch.observe(box);
		watch.observe(svg);   // after dive.js has laid the icon out (its watcher is older)
		watch.observe(document.body);
		size();
	}
})();
