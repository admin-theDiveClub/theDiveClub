// The dive's sandbox (/sandbox/dive/): one button starts and stops "loading"
// for both copies, the overlay-sized stage and the nav-sized icon. The dive
// itself is scripts/dive.js.

(() => {
	const AREA = 'Sandbox dive';
	const $ = (id) => document.getElementById(id);
	const button = $('dive-load'), stat = $('dive-status');

	const dives = [
		TDCDive.attach($('dive-stage').querySelector('svg.dive'), { frame: 'fit' }),
		TDCDive.attach(document.querySelector('.dive-icon svg.dive'), { frame: 'logo' }),
	];
	if (dives.includes(null)) {
		TDC.error(AREA, 'the dive drawing is missing from the page.', null, stat);
		button.disabled = true;
		return;
	}

	button.addEventListener('click', () => {
		const on = !dives[0].loading;
		for (const d of dives) on ? d.start() : d.stop();
		button.textContent = on ? 'Stop loading' : 'Start loading';
	});
})();
