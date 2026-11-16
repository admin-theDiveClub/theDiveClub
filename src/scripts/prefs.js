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
// Saving power (UV, 3 Nov): with no choice made on the toggle, less motion is
// put on while the phone asks for data saving, or runs on SAVE_LEVEL or less
// of its battery and is not charging (Claude's threshold, near where Android's
// own battery saver comes on), and taken off again when that ends. Android
// Chrome tells pages both; Safari tells them neither, so an iPhone is never
// caught by it. A choice on the toggle always wins.
//
// Also the guard against iOS's keyboard bug in the installed app (below,
// "The keyboard's height left cut off").
//
// Loaded in <head>, after the stylesheets and before page-light.js.
// Needs: nothing.
var TDCPrefs = (function () {
	'use strict';
	var root = document.documentElement;
	var THEME = 'tdc.theme';      // 'light' or 'dark'
	var MOTION = 'tdc.motion';    // 'reduce' or 'full'
	var device = window.matchMedia('(prefers-reduced-motion: reduce)');
	var SAVE_LEVEL = 0.2;
	var saving = false;

	function read(key) {
		try { return localStorage.getItem(key); } catch (e) { return null; }   // a private window: the defaults
	}
	function keep(key, value) {
		try { localStorage.setItem(key, value); } catch (e) {
			console.warn('[Prefs] Could not keep the choice on this device; it lasts for this page only.', e);
		}
	}

	// The phone's bar follows the theme too (UV, 3 Nov). theme-color takes the
	// theme's own --bg-base: Android Chrome and Safari repaint their bar at once.
	// An installed iPhone app draws the page under the bar, and its white text
	// cannot be read on cream, so the light theme asks for dark text ('default');
	// iOS reads that when the app opens, which is why it is set here, before the
	// first paint. The styles are loaded by now: a script waits for them.
	var themeColor = document.querySelector('meta[name="theme-color"]');
	var iosBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
	function applyTheme(light) {
		root.setAttribute('data-theme', light ? 'light' : '');
		var bg = getComputedStyle(root).getPropertyValue('--bg-base').trim();
		if (themeColor && bg) themeColor.setAttribute('content', bg);
		if (iosBar) iosBar.setAttribute('content', light ? 'default' : 'black-translucent');
	}
	function applyMotion(m) {
		if (m === 'reduce' || m === 'full') root.dataset.motion = m;
		else delete root.dataset.motion;
	}

	// The toggle's choice if there is one, else less motion while saving power
	function settleMotion() {
		var m = read(MOTION);
		applyMotion(m === 'reduce' || m === 'full' ? m : (saving ? 'reduce' : null));
	}

	applyTheme(read(THEME) === 'light');

	var net = navigator.connection;
	var battery = null;
	function checkSaving() {
		saving = !!(net && net.saveData) || !!(battery && !battery.charging && battery.level <= SAVE_LEVEL);
		settleMotion();
	}
	if (net && net.addEventListener) net.addEventListener('change', checkSaving);
	if (navigator.getBattery) {
		navigator.getBattery().then(function (b) {
			battery = b;
			b.addEventListener('levelchange', checkSaving);
			b.addEventListener('chargingchange', checkSaving);
			checkSaving();
		}, function (e) {
			console.warn('[Prefs] The battery could not be read; motion follows the device and the toggle.', e);
		});
	}
	checkSaving();

	// The keyboard's height left cut off (16 Nov; an iOS bug, WebKit 297779 and
	// 301857). In an app added to an iPhone's home screen, once the keyboard has
	// closed iOS can go on sizing the page as if it were still open, until the
	// app is quit: everything sized to the screen (the loading screen's blur,
	// the page's background, the footer's place) stops where the keyboard's top
	// was, a line across the screen below it. Seen on UV's iPhone: 536 of 874
	// points. Hiding and showing the page in one go makes iOS measure it again
	// (the known way round it; scrolling and visualViewport do not). The app
	// fills the screen there (black-translucent), so the right height is the
	// screen's own; checked when a page opens or is shown again, the screen
	// turns, and a field gives up the keyboard. Never while a field still has
	// it, never in a browser tab, at most once per check.
	if (navigator.standalone === true) {
		var editing = function () {
			var a = document.activeElement;
			return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
		};
		var screenHeight = function () {
			var upright = !window.matchMedia || window.matchMedia('(orientation: portrait)').matches;
			return upright ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
		};
		var healTimer = 0;
		var healFailed = false;   // once measuring again has not helped, never again on this page
		var heal = function () {
			var body = document.body;
			// The light theme's bar ('default') puts the page below it, shorter on purpose
			if (!body || healFailed || editing() || !iosBar || iosBar.getAttribute('content') !== 'black-translucent') return;
			var short = screenHeight() - window.innerHeight;
			if (short <= 4) return;
			var x = window.scrollX, y = window.scrollY;
			body.style.display = 'none';
			void body.offsetHeight;   // the page laid out without it, then with it
			body.style.display = '';
			void body.offsetHeight;
			window.scrollTo(x, y);
			var left = screenHeight() - window.innerHeight;
			if (left > 4) { healFailed = true; console.warn('[Viewport] The page is ' + left + 'px shorter than the screen (the iOS keyboard bug), and measuring it again did not help; not tried again on this page.'); }
			else console.info('[Viewport] The page was ' + short + 'px shorter than the screen (the iOS keyboard bug); measured again.');
		};
		var healSoon = function (ms) {
			clearTimeout(healTimer);
			healTimer = setTimeout(heal, ms);
		};
		// After the keyboard has gone: only when a text field gives up focus (16 Nov,
		// UV: the installed app seemed to refresh every few minutes while scrolling;
		// hiding the page resets every scrolled box and restarts every animation, so
		// it must not run when any button or link merely loses focus).
		document.addEventListener('focusout', function (e) {
			var t = e.target;
			var typed = t && (t.isContentEditable || t.tagName === 'TEXTAREA'
				|| (t.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|reset|color|file|hidden|image)$/.test(t.type)));
			if (typed) healSoon(150);
		});
		window.addEventListener('pageshow', function () { healSoon(0); });
		window.addEventListener('orientationchange', function () { healSoon(400); });
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { healSoon(0); });
		else healSoon(0);
	}

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
