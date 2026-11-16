// The partners and sponsors banner above the footer (_includes/footer.html; styles
// in footer.css). On a phone (UV, 16 Nov) the icons stay in one row: centred if they
// fit, otherwise the row becomes a carousel that drifts by itself in an endless loop,
// the icons fading out at the banner's edges rather than being cut off. The loop is
// the icons twice over, the copy hidden from screen readers and the keyboard, slid
// left by exactly one set. With less motion (TDCPrefs) it does not drift: the row is
// swiped by hand instead. From 48rem the icons wrap onto more rows and none of this
// applies.
//
// Each icon in the site's background colour (UV, 16 Nov), drawn here rather than cut out
// with a mask (Safari flickered the masks while the page's light moved): the file is
// drawn on a canvas, filled with --bg-base where it has ink, and given to every copy of
// that icon as its picture (--pt-tinted). Again when the theme changes.
(function () {
	'use strict';
	var view = document.querySelector('.site-partners .pt-view');
	if (!view) return;   // no partners listed: the banner is not drawn
	var list = view.querySelector('.pt-list');
	var tinted = {};      // file -> 'url(data:…)' in the current colour
	var tintFor = '';     // the colour they were drawn in
	var LONG = 640;       // px, the drawing's longer side: sharp at 10rem on a 2x screen

	function tintAll() {
		var colour = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim();
		if (!colour) { console.error('[Partners] --bg-base is not set, so the icons cannot be drawn in it.'); return; }
		if (colour !== tintFor) { tintFor = colour; tinted = {}; }
		var files = {};
		list.querySelectorAll('.pt-logo[data-pt-icon]').forEach(function (el) { files[el.dataset.ptIcon] = true; });
		Object.keys(files).forEach(function (file) {
			if (tinted[file]) { show(file); return; }
			var img = new Image();
			img.onload = function () {
				try {
					if (colour !== tintFor) return;   // the theme changed while it loaded
					var w = img.naturalWidth || LONG, h = img.naturalHeight || LONG / 2;
					var k = LONG / Math.max(w, h);
					var c = document.createElement('canvas');
					c.width = Math.round(w * k); c.height = Math.round(h * k);
					var g = c.getContext('2d');
					g.drawImage(img, 0, 0, c.width, c.height);
					g.globalCompositeOperation = 'source-in';
					g.fillStyle = colour;
					g.fillRect(0, 0, c.width, c.height);
					tinted[file] = 'url("' + c.toDataURL('image/png') + '")';
					show(file);
				} catch (e) {
					console.error('[Partners] ' + file + ' could not be drawn in the background colour.', e);
				}
			};
			img.onerror = function (e) { console.error('[Partners] ' + file + ' did not load.', e); };
			img.src = file;
		});
	}
	// Every copy of the icon, the carousel's too
	function show(file) {
		list.querySelectorAll('.pt-logo[data-pt-icon="' + file + '"]').forEach(function (el) {
			el.style.setProperty('--pt-tinted', tinted[file]);
		});
	}
	tintAll();
	new MutationObserver(tintAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	var phone = window.matchMedia('(max-width: 47.99rem)');
	var device = window.matchMedia('(prefers-reduced-motion: reduce)');
	var SPEED = 30;   // px a second

	function lessMotion() {
		try { return !!(window.TDCPrefs && TDCPrefs.lessMotion); }
		catch (e) { return device.matches; }
	}

	function clear() {
		list.querySelectorAll('[data-pt-copy]').forEach(function (li) { li.remove(); });
		view.classList.remove('is-carousel', 'is-swipe');
		list.style.removeProperty('--pt-loop');
	}

	function settle() {
		try {
			clear();
			// One row on a phone: does it fit as it is? (Measured icon by icon: a centred
			// row that overflows hides its left overflow from scrollWidth)
			if (!phone.matches) return;
			var originals = Array.prototype.slice.call(list.children);
			var setWidth = originals.reduce(function (s, li) { return s + li.getBoundingClientRect().width; }, 0);
			if (setWidth <= view.clientWidth + 1) return;
			if (lessMotion()) { view.classList.add('is-swipe'); return; }
			originals.forEach(function (li) {
				var copy = li.cloneNode(true);
				copy.setAttribute('data-pt-copy', '');
				copy.setAttribute('aria-hidden', 'true');
				copy.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; });
				list.appendChild(copy);
			});
			list.style.setProperty('--pt-loop', (setWidth / SPEED).toFixed(2) + 's');
			view.classList.add('is-carousel');
		} catch (e) {
			console.error('[Partners] The banner could not be laid out as a carousel.', e);
		}
	}

	var timer = 0;
	function later() { clearTimeout(timer); timer = setTimeout(settle, 120); }
	window.addEventListener('resize', later);
	phone.addEventListener('change', settle);
	device.addEventListener('change', settle);
	// The less-motion toggle sets data-motion on <html> (prefs.js)
	new MutationObserver(settle).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
	// The icons are masks with no size of their own to wait for, but the fonts can move
	// the page; settle once everything has loaded as well
	settle();
	window.addEventListener('load', settle);
})();
