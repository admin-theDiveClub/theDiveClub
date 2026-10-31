// The person's own display choices (UV, 31 Oct): the theme and less motion,
// set from the toggles at the foot of the profile menu (nav.js). Kept on this
// device, and put on <html> before the first paint, so a light page never
// flashes dark on the way in.
//
//   data-theme="light"     the light palette (variables.css); dark otherwise
//   data-motion="reduce"   less motion, whatever the device says
//   data-motion="full"     full motion, whatever the device says
//   (no data-motion)       the device's own setting
//
// data-motion is what dots.js and page-light.js read. Everything else that
// moves still follows the device's setting alone.
//
// Loaded in <head>, after the stylesheets and before page-light.js.
// Needs: nothing.
var TDCPrefs = (function () {
	'use strict';
	var root = document.documentElement;
	var THEME = 'tdc.theme';      // 'light' or 'dark'
	var MOTION = 'tdc.motion';    // 'reduce' or 'full'
	var device = window.matchMedia('(prefers-reduced-motion: reduce)');

	function read(key) {
		try { return localStorage.getItem(key); } catch (e) { return null; }   // a private window: the defaults
	}
	function keep(key, value) {
		try { localStorage.setItem(key, value); } catch (e) {
			console.warn('[Prefs] Could not keep the choice on this device; it lasts for this page only.', e);
		}
	}

	function applyTheme(light) { root.setAttribute('data-theme', light ? 'light' : ''); }
	function applyMotion(m) {
		if (m === 'reduce' || m === 'full') root.dataset.motion = m;
		else delete root.dataset.motion;
	}

	applyTheme(read(THEME) === 'light');
	applyMotion(read(MOTION));

	return {
		get light() { return root.getAttribute('data-theme') === 'light'; },
		get lessMotion() {
			var m = root.dataset.motion;
			return m === 'reduce' || (m !== 'full' && device.matches);
		},
		setLight: function (on) {
			keep(THEME, on ? 'light' : 'dark');
			applyTheme(on);
		},
		setLessMotion: function (on) {
			keep(MOTION, on ? 'reduce' : 'full');
			applyMotion(on ? 'reduce' : 'full');
		}
	};
})();
