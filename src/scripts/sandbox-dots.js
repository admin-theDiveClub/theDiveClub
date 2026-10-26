// The dots' sandbox (/sandbox/dots/): real site components that pretend to
// call the network, for studying scripts/dots.js. Nothing here touches the
// database. The delay is a fake call's length, give or take a fifth, as in the
// prototype.

(() => {
	const AREA = 'Sandbox dots';
	const $ = (id) => document.getElementById(id);
	const delay = $('dots-delay'), delayOut = $('dots-delay-out'), stat = $('dots-stat');

	delay.addEventListener('input', () => { delayOut.textContent = (+delay.value).toFixed(1) + 's'; });
	const fakeCall = () => new Promise((resolve) => setTimeout(resolve, +delay.value * 1000 * (0.8 + Math.random() * 0.4)));

	// Every ring icon on the stage: a real ring from ring-status.js, showing its
	// icon. Its own dots are never started; the travelling dots serve it.
	for (const b of document.querySelectorAll('[data-icon]')) {
		const face = b.querySelector('.dots-face');
		face.classList.add('tdc-ring');
		face.innerHTML = TDCRing.svg(6);
		try {
			new TDCRing.RingStatus(face, { icons: [b.dataset.icon], initial: b.dataset.icon });
		} catch (err) {
			TDC.error(AREA, 'an icon could not be drawn: ' + b.dataset.icon, err);
		}
	}

	const count = $('dots-count');
	const reveals = new Map([[count, () => { count.textContent = +count.textContent + 1; }]]);

	// A tap on a busy target does nothing (spec §3).
	for (const b of document.querySelectorAll('[data-icon], .dots-count, .dots-target')) {
		b.addEventListener('click', () => {
			if (b.dataset.dots === 'busy') return;
			TDCDots.serve(b, fakeCall(), { reveal: reveals.get(b) });
		});
	}

	setInterval(() => {
		const s = TDCDots.state;
		stat.textContent = s.phase === 'hidden' ? 'Hidden'
			: s.phase === 'orbit' ? 'Solo: ' + s.moves.join(' · ')
			: s.phase[0].toUpperCase() + s.phase.slice(1);
	}, 120);
})();
