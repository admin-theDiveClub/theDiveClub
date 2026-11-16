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
})();
