// The banner sandbox's speed switches (UV, 16 Nov: "implement all and let me decide"):
// the look-changing speed-ups of banner-table.js (TDCBannerTable.quality), for UV to try
// on a phone in Low Power Mode. Each starts as the site has it. The choices are kept in
// this browser only, so a reload keeps what is being tried; real pages never read them.
// Needs: banner-table.js (TDCBannerTable), tdc.js (TDC.error).
(function () {
	'use strict';
	var AREA = 'Banner sandbox';
	var KEY = 'tdc.sandbox.bannerQuality';
	var statusEl = document.getElementById('banner-status');
	var fields = {
		glow: { el: document.getElementById('bq-glow'), read: function (el) { return el.value; } },
		frost: { el: document.getElementById('bq-frost'), read: function (el) { return el.value; } },
		sharp: { el: document.getElementById('bq-sharp'), read: function (el) { return parseFloat(el.value); } },
		autoSharp: { el: document.getElementById('bq-auto-sharp'), read: function (el) { return el.checked; } },
		autoFrost: { el: document.getElementById('bq-auto-frost'), read: function (el) { return el.checked; } },
		autoPlan: { el: document.getElementById('bq-auto-plan'), read: function (el) { return el.checked; } }
	};
	if (typeof TDCBannerTable === 'undefined') {
		TDC.error(AREA, 'the table\'s script did not load, so the switches do nothing.', null, statusEl);
		return;
	}
	var kept = {};
	try { kept = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { kept = {}; }   // a private window: start as the site has it
	Object.keys(fields).forEach(function (k) {
		var f = fields[k];
		if (!f.el) return;
		if (k in kept) {
			if (f.el.type === 'checkbox') f.el.checked = !!kept[k]; else f.el.value = String(kept[k]);
		}
		f.el.addEventListener('change', take);
	});
	function take() {
		var q = {};
		Object.keys(fields).forEach(function (k) { if (fields[k].el) q[k] = fields[k].read(fields[k].el); });
		try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* kept for this page only */ }
		TDCBannerTable.quality(q);
	}
	take();

	// The physics and look sliders (UV, 17 Nov): each starts at the site's value
	// (TDCBannerTable.tune) and changes this page only, in memory; a reload is back to
	// the site's values.
	var values = TDCBannerTable.tune();

	// What each value means right now (UV, 18 Nov: "so I can better understand what each is
	// doing"), worked from banner-table.js's own physics: a rolling ball slows by cs balls a
	// second each second; a skidding ball's slip falls at 3.5 cg; side decays at cg x wyKeep a
	// second; a cushion keeps 1 - ks of the speed into it and 1 - kg of the spin, and side
	// bends its angle by side x (1 - kg); a full hit passes on 1 - bb of the speed. Several
	// depend on more than their own slider, so every line is redrawn on any change.
	function pct(x) { return Math.round(x * 100) + '%'; }
	function secs(x) { return x >= 10 ? Math.round(x) + ' s' : x >= 1 ? x.toFixed(1) + ' s' : x.toFixed(2) + ' s'; }
	function halfLife(v) { return v.cg * v.wyKeep > 0 ? Math.LN2 / (v.cg * v.wyKeep) : Infinity; }
	var NOW = {
		speed: function (v) { return 'Now: ' + v.speed + '× real time.'; },
		cs: function (v) { return 'Now: a ball rolling at 4 balls a second runs ' + (16 / (2 * v.cs)).toFixed(1) + ' balls before it stops.'; },
		cg: function (v) { return 'Now: a ball skidding at 4 balls a second starts rolling after ' + secs(4 / (3.5 * v.cg)) + '.'; },
		ks: function (v) { return 'Now: a ball keeps ' + pct(1 - v.ks) + ' of its speed into a cushion.'; },
		kg: function (v) { return 'Now: each cushion strips ' + pct(v.kg) + ' of the spin, so side works at ' + pct(1 - v.kg) + ' of its strength off a cushion, and less off the next.'; },
		side: function (v) { return 'Now: it acts as ' + (v.side * (1 - v.kg)).toFixed(2) + ' once the cushion has stripped ' + pct(v.kg) + '.'; },
		wyKeep: function (v) { var h = halfLife(v); return h === Infinity ? 'Now: side never wears off.' : 'Now: half the side is gone after ' + secs(h) + ', nearly all of it after ' + secs(h * 4) + '.'; },
		bb: function (v) { return 'Now: a full hit sends the object ball off at ' + pct(1 - v.bb) + ' of the white\'s speed.'; },
		sw: function (v) { var h = halfLife(v); return v.sw === 0 ? 'Now: no swerve.' : h === Infinity ? 'Now: the curve keeps going, as side never wears off.' : 'Now: the curve weakens as side wears off, half gone after ' + secs(h) + '.'; },
		miss: function (v) { return v.miss === 0 ? 'Now: every pot is aimed true.' : 'Now: about ' + pct(v.miss) + ' of pots are meant to miss.'; }
	};
	var nowEls = document.querySelectorAll('[data-banner-now]');
	function explain() {
		var v = TDCBannerTable.tune();
		nowEls.forEach(function (el) {
			var f = NOW[el.dataset.bannerNow];
			if (!f) { TDC.error(AREA, 'no explanation for the slider "' + el.dataset.bannerNow + '".', null, statusEl); return; }
			el.textContent = f(v);
		});
	}

	document.querySelectorAll('[data-banner-tune]').forEach(function (input) {
		var key = input.dataset.bannerTune, out = document.getElementById(input.id + '-out');
		if (!(key in values)) {
			TDC.error(AREA, 'the slider "' + key + '" has no value in the table\'s script.', null, statusEl);
			return;
		}
		function show() { if (out) out.textContent = key === 'miss' ? Math.round(input.value * 100) + '%' : input.value; }
		input.value = values[key];
		show();
		input.addEventListener('input', function () {
			var c = {};
			c[key] = parseFloat(input.value);
			TDCBannerTable.tune(c);
			show();
			explain();
		});
	});
	explain();
})();
