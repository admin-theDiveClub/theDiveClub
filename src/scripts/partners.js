// The partners and sponsors banner above the footer (_includes/footer.html; styles
// in footer.css). On a phone (UV, 16 Nov) the icons stay in one row: centred if they
// fit, otherwise the row becomes a carousel that drifts by itself in an endless loop,
// the icons fading out at the banner's edges rather than being cut off. The loop is
// the icons twice over, the copy hidden from screen readers and the keyboard, slid
// left by exactly one set. With less motion (TDCPrefs) it does not drift: the row is
// swiped by hand instead. From 48rem the icons wrap onto more rows and none of this
// applies.
(function () {
	'use strict';
	var view = document.querySelector('.site-partners .pt-view');
	if (!view) return;   // no partners listed: the banner is not drawn
	var list = view.querySelector('.pt-list');
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
