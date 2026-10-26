// The dots' sandbox (/sandbox/dots/): real site components that pretend to
// call the network, for studying scripts/dots.js. Nothing here touches the
// database. The delay is a fake call's length, give or take a fifth, as in the
// prototype. The sliders set the --dots-* tokens on this page only.

(() => {
	const AREA = 'Sandbox dots';
	const $ = (id) => document.getElementById(id);
	const root = document.documentElement;
	const delay = $('dots-delay'), delayOut = $('dots-delay-out'), stat = $('dots-stat');

	delay.addEventListener('input', () => { delayOut.textContent = (+delay.value).toFixed(1) + 's'; });
	const fakeCall = () => new Promise((resolve) => setTimeout(resolve, +delay.value * 1000 * (0.8 + Math.random() * 0.4)));

	// ─── The stage ───
	// Every ring icon on the stage: a real ring from ring-status.js, showing its
	// icon. Its own dots are never started; the travelling dots serve it.
	function ringOn(face, icons, initial) {
		face.classList.add('tdc-ring');
		face.innerHTML = TDCRing.svg(6);
		try {
			return new TDCRing.RingStatus(face, { icons, initial });
		} catch (err) {
			TDC.error(AREA, 'an icon could not be drawn: ' + icons.join(', '), err);
			return null;
		}
	}
	for (const b of document.querySelectorAll('[data-icon]')) ringOn(b.querySelector('.dots-face'), [b.dataset.icon], b.dataset.icon);

	// What each target shows when its call is back, and what the dots trace.
	const reveals = new Map(), traces = new Map();

	// The counter: the dots trace its new number in the site's font as it fades in.
	const count = $('dots-count');
	reveals.set(count, () => { count.textContent = +count.textContent + 1; });
	traces.set(count, 'number');

	// The tabs: the chosen one's pill is traced, then fills.
	const tabs = [...document.querySelectorAll('.dots-tabs .league-nav-item')];
	for (const tab of tabs) {
		reveals.set(tab, () => { for (const x of tabs) x.toggleAttribute('aria-current', x === tab); tab.setAttribute('aria-current', 'page'); });
		traces.set(tab, 'tab');
	}

	// The switch, served as a ring (UV, 26 Oct): its knob is the site's own
	// ring, tick on and cross off. When the call is back the knob slides to
	// its new side while the dots trace the new icon in it.
	const sw = $('dots-switch');
	const swRing = ringOn(sw.querySelector('.tdc-ring'), ['tick', 'cross'], 'cross');
	sw.style.setProperty('--p', '0');
	function slide(to) {
		const from = parseFloat(sw.style.getPropertyValue('--p')) || 0, t0 = performance.now(), ms = 350;
		const step = (now) => {
			const u = Math.min(1, (now - t0) / ms), e = u * u * (3 - 2 * u);
			sw.style.setProperty('--p', (from + (to - from) * e).toFixed(3));
			if (u < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}
	reveals.set(sw, () => {
		const on = sw.getAttribute('aria-checked') !== 'true';
		sw.setAttribute('aria-checked', String(on));
		if (swRing) swRing.setState(on ? 'tick' : 'cross');
		slide(on ? 1 : 0);
	});

	// A tap on a busy target, or one still being traced, does nothing (spec §3).
	for (const b of document.querySelectorAll('[data-icon], .dots-count, .dots-target, .dots-tabs .league-nav-item, .dots-switch')) {
		b.addEventListener('click', () => {
			if (b.dataset.dots === 'busy' || b.dataset.dots === 'tracing') return;
			if (b.matches('.league-nav-item[aria-current]')) return;   // already the chosen tab
			TDCDots.serve(b, fakeCall(), { reveal: reveals.get(b), trace: traces.get(b) });
		});
	}

	// ─── The controls (spec §13) ───
	// Each slider shows the token's value from variables.css and sets it on
	// this page; the engine reads the tokens afresh on every tap.
	const SLIDERS = [
		{ name: '--dots-draw',          label: 'Draw speed',   unit: '',   min: 0.25, max: 3,   step: 0.05, show: (v) => v.toFixed(2) + '×' },
		{ name: '--dots-fade',          label: 'Fade speed',   unit: '',   min: 0.25, max: 3,   step: 0.05, show: (v) => v.toFixed(2) + '×' },
		{ name: '--dots-blend',         label: 'Hand-over',    unit: 's',  min: 0.1,  max: 1.5, step: 0.05, show: (v) => v.toFixed(2) + 's' },
		{ name: '--dots-ring-margin',   label: 'Ring margin',  unit: 'px', min: 0,    max: 24,  step: 1,    show: (v) => v + 'px' }
	];
	const box = $('dots-sliders');
	for (const s of SLIDERS) {
		const id = 'dots-tok' + s.name.slice(6);
		const now = parseFloat(getComputedStyle(root).getPropertyValue(s.name));
		const field = document.createElement('div');
		field.className = 'field';
		field.innerHTML = `<label for="${id}">${s.label}: <output></output></label>`
			+ `<input type="range" id="${id}" min="${s.min}" max="${s.max}" step="${s.step}" data-control="none">`;
		const input = field.querySelector('input'), out = field.querySelector('output');
		if (isNaN(now)) TDC.error(AREA, `${s.name} is not set in variables.css.`);
		input.value = isNaN(now) ? s.min : now;
		out.textContent = s.show(+input.value);
		input.addEventListener('input', () => {
			root.style.setProperty(s.name, input.value + s.unit);
			out.textContent = s.show(+input.value);
		});
		box.append(field);
	}

	// The waiting move: one on repeat, or Random. Cruise alone until step 4.
	const move = $('dots-move'), random = $('dots-random');
	move.innerHTML = TDCDots.moves.map((m) => `<option value="${m}">${m}</option>`).join('');
	const force = () => TDCDots.force(random.checked ? null : move.value);
	move.addEventListener('change', () => { random.checked = false; force(); });
	random.addEventListener('change', force);

	setInterval(() => {
		const s = TDCDots.state;
		stat.textContent = s.phase === 'hidden' ? 'Hidden'
			: s.phase === 'orbit' ? (s.forced ? 'Forced: ' : 'Solo: ') + s.moves.join(' · ')
			: s.phase === 'trace' ? 'Tracing'
			: s.phase[0].toUpperCase() + s.phase.slice(1);
	}, 120);
})();
