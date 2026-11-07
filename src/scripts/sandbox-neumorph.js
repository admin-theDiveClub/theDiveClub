// Neumorphism's sandbox (/sandbox/neumorph/): this page's own light, and the
// sliders. UV, 6 Nov: the light moves freely all round the screen, in a band
// just outside it, and never comes inside.
//
// Its place is a share of the way round the screen (round, clockwise from the
// top left corner) and a share of the way out across the band (out). Each is
// eased from one random point to the next, round the short way, and the place
// is always on the screen's edge pushed out by that much, so no move can cross
// the screen, whatever the band's width or the window's size.
//
// page-light.js carries on underneath on its timer, as on every page, but a
// frame's write comes after its write and before the paint, so this light is
// what is seen. It writes the same four properties, so the glow and everything
// cast by the light follow, on this page only. The shadow falls straight away
// from the light, and is longer the nearer the light is to the screen: twice
// --page-inset-offset at the screen's edge, once at the band's outer edge.
// Nothing is saved. With less motion on, page-light.js is left to rest the
// light at the centre.
//
// The sphere (UV, 6 Nov) has no 3D model: a circle shaded by CSS gradients and
// a blurred ellipse on the page, both worked out here on every frame from where
// the light is. The light is given a height above the page, and the sphere's
// centre stands at its height off the page plus its radius. The shadow is where
// a line from the light through that centre meets the page, so it moves away as
// the sphere rises or the light comes lower, and it grows, softens and fades as
// the sphere rises. The sphere looks straight down on the page, as the form does.

(() => {
	const REST = 120000;   // no touch for this long: the light rests
	const SPEED = 120;     // how fast it travels, px a second
	const SHORTEST = 4000; // the least one move takes, ms
	const $ = (id) => document.getElementById(id);
	const root = document.documentElement, layout = $('nm-layout'), readout = $('nm-readout');
	const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

	const OUTER = { key: 'outer', label: 'The outer area', min: 0, max: 800, step: 10, unit: 'px', start: 300 };
	const STRENGTH = { key: 'strength', label: 'Light strength', token: '--nm-light-strength', min: 0, max: 100, step: 1, unit: '%', start: 100 };
	const SHADOWS = [
		{ key: 'reach', label: 'Shadow distance', token: '--nm-reach', min: 0.5, max: 4, step: 0.1, unit: '×' },
		{ key: 'blur', label: 'Blur', token: '--nm-blur', min: 0, max: 60, step: 1, unit: 'px', css: 'px' },
		{ key: 'dark', label: 'Shadow strength', token: '--nm-shadow-alpha', min: 0, max: 1, step: 0.01, unit: '' },
		{ key: 'lit', label: 'Highlight strength', token: '--nm-lit-alpha', min: 0, max: 1, step: 0.01, unit: '' },
	];
	const SPHERE = [
		{ key: 'size', label: 'Size', min: 40, max: 200, step: 1, unit: 'px', start: 96 },
		{ key: 'height', label: 'Height above the page', min: 0, max: 300, step: 1, unit: 'px', start: 60 },
		{ key: 'lightHeight', label: 'Light height above the page', min: 100, max: 2000, step: 10, unit: 'px', start: 600 },
		{ key: 'soft', label: 'Shadow softness', min: 0, max: 1, step: 0.01, unit: '', start: 0.25 },
		{ key: 'cast', label: 'Shadow strength', token: '--nm-sphere-shadow-alpha', min: 0, max: 1, step: 0.01, unit: '' },
		{ key: 'shine', label: 'Highlight strength', min: 0, max: 1, step: 0.01, unit: '', start: 0.85 },
		{ key: 'shineSize', label: 'Highlight size', min: 2, max: 60, step: 1, unit: '%', start: 22 },
	];
	const sliders = {};

	function row(def, into, changed) {
		const box = document.createElement('label');
		box.className = 'nm-slider';
		const name = document.createElement('span');
		name.textContent = def.label;
		const out = document.createElement('output');
		const input = document.createElement('input');
		input.type = 'range';
		input.min = def.min;
		input.max = def.max;
		input.step = def.step;
		input.addEventListener('input', () => {
			out.textContent = input.value + def.unit;
			if (changed) changed(def, +input.value);
		});
		box.append(name, out, input);
		into.append(box);
		sliders[def.key] = { input, out };
	}

	function setSlider(def, value) {
		const s = sliders[def.key];
		s.input.value = value;
		s.out.textContent = s.input.value + def.unit;
	}

	// What the stylesheets say. A theme change comes here too, since each theme
	// has its own strengths.
	function shadowsFromSheet() {
		const castDef = SPHERE.find((def) => def.token);
		setSlider(castDef, parseFloat(getComputedStyle(layout).getPropertyValue(castDef.token)));
		for (const def of SHADOWS) {
			layout.style.removeProperty(def.token);
			setSlider(def, parseFloat(getComputedStyle(layout).getPropertyValue(def.token)));
		}
	}

	// The light's strength and colour, on the body with the glow. The button's
	// words go dark or cream, whichever a colour of the person's choosing can
	// be read against.
	const body = document.body, picker = $('nm-colour'), pickerOut = $('nm-colour-out');
	function pickColour(hex) {
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
		body.style.setProperty('--nm-light-colour', hex);
		body.style.setProperty('--nm-on-light', 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#202020' : '#f4e8d2');
		pickerOut.textContent = hex;
	}
	function lightFromSheet() {
		body.style.removeProperty('--nm-light-colour');
		body.style.removeProperty('--nm-on-light');
		body.style.removeProperty(STRENGTH.token);
		setSlider(STRENGTH, STRENGTH.start);
		picker.value = getComputedStyle(body).getPropertyValue('--color-primary').trim();
		pickerOut.textContent = picker.value;
	}

	// ── The light ──
	const pick = () => ({ round: Math.random(), out: Math.random() });
	const shortWay = (a, b) => ((b - a + 1.5) % 1) - 0.5;   // -0.5 to 0.5, the wrap taken
	const perimeter = () => 2 * (window.innerWidth + window.innerHeight);
	let from = pick(), to = pick(), done = 0, dur = SHORTEST, last = 0;
	let place = { x: 0, y: 0, depth: 0 };

	function timeFor(a, b) {
		return Math.max(SHORTEST, Math.abs(shortWay(a.round, b.round)) * perimeter() / SPEED * 1000);
	}

	// Screen coordinates of a place: on the edge of the screen pushed out by
	// depth, walked clockwise from its top left corner
	function locate(round, depth) {
		const w = window.innerWidth + 2 * depth, h = window.innerHeight + 2 * depth;
		let along = (((round % 1) + 1) % 1) * 2 * (w + h);
		const left = -depth, top = -depth;
		if (along < w) return { x: left + along, y: top };
		along -= w;
		if (along < h) return { x: left + w, y: top + along };
		along -= h;
		if (along < w) return { x: left + w - along, y: top + h };
		along -= w;
		return { x: left, y: top + h - along };
	}

	function put(round, out) {
		const depth = out * +sliders.outer.input.value;
		const at = locate(round, depth);
		const vx = window.innerWidth / 2 - at.x, vy = window.innerHeight / 2 - at.y;
		const len = Math.hypot(vx, vy) || 1;
		const offset = parseFloat(getComputedStyle(root).getPropertyValue('--page-inset-offset'));
		const shadow = offset * (2 - out);
		root.style.setProperty('--page-light-x', (at.x - window.innerWidth / 2).toFixed(1) + 'px');
		root.style.setProperty('--page-light-y', (-at.y).toFixed(1) + 'px');
		root.style.setProperty('--page-shadow-x', (vx / len * shadow).toFixed(1) + 'px');
		root.style.setProperty('--page-shadow-y', (vy / len * shadow).toFixed(1) + 'px');
		place = { x: at.x, y: at.y, depth };
	}

	function step(now) {
		done += Math.min(now - last, 100);
		last = now;
		if (done >= dur) {
			from = to;
			to = pick();
			done = 0;
			dur = timeFor(from, to);
		}
		const t = Math.min(1, done / dur);
		const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
		put(from.round + shortWay(from.round, to.round) * e, from.out + (to.out - from.out) * e);
	}

	// ── The sphere ──
	const ball = $('nm-sphere'), cast = $('nm-sphere-shadow');
	const num = (key) => +sliders[key].input.value;

	function drawSphere() {
		const size = num('size'), r = size / 2, centre = num('height') + r;
		// The light stays above the sphere's centre, or there is no shadow to cast
		const above = Math.max(num('lightHeight') - centre, 50), lightZ = centre + above;
		const box = ball.getBoundingClientRect();
		const s = root.style;
		const dx = window.innerWidth / 2 + (parseFloat(s.getPropertyValue('--page-light-x')) || 0) - (box.left + box.width / 2);
		const dy = -(parseFloat(s.getPropertyValue('--page-light-y')) || 0) - (box.top + box.height / 2);
		const across = Math.hypot(dx, dy);
		const len = Math.hypot(across, above) || 1;

		ball.style.setProperty('--nm-sphere-size', size + 'px');
		ball.style.setProperty('--nm-hx', (50 + 45 * dx / len).toFixed(1) + '%');
		ball.style.setProperty('--nm-hy', (50 + 45 * dy / len).toFixed(1) + '%');
		ball.style.setProperty('--nm-shine', num('shine'));
		ball.style.setProperty('--nm-shine-size', num('shineSize') + '%');

		const push = centre / above;
		const grow = lightZ / above;
		const stretch = Math.min(3, Math.hypot(1, across / lightZ));
		cast.style.width = cast.style.height = size + 'px';
		cast.style.transform = `translate(-50%, -50%) translate(${(-dx * push).toFixed(1)}px, ${(-dy * push).toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(3)}rad) scale(${(grow * stretch).toFixed(3)}, ${grow.toFixed(3)})`;
		cast.style.filter = `blur(${(num('soft') * num('height') / grow).toFixed(1)}px)`;
		cast.style.opacity = (num('cast') / (1 + num('height') / 150)).toFixed(3);
	}

	// ── The meter (UV, 6 Nov): what a setting costs, in ms a frame ──
	// A frame's work runs from its first callback to a message posted there,
	// which is handled once the browser has done the frame's style, layout and
	// paint on this thread. The drawing done off this thread (blurs among it)
	// cannot be timed from a page, so it shows only once it makes frames late:
	// then the time between frames counts instead. Each is the median of the
	// last second, so one slow frame does not swing the number. The hit is that
	// against the same measured for BASE_FOR at the starting values, leaving out
	// the loading screen and the dots, which would inflate it. A setting moved
	// before that is done spoils it, and the meter says so rather than compare
	// against the wrong thing. It is rough (measured 6 Nov, headless): with nothing
	// changed it wandered by about 1 ms on a PC and 4 ms at 4x slower, the cost of
	// a frame depending on where the light is, and Blur at 60 and at 0 could not be
	// told apart.
	const SAMPLES = 60, BASE_FOR = 3000;
	const hitEl = $('nm-hit'), hitDetail = $('nm-hit-detail');
	const channel = new MessageChannel();
	let began = 0, lastFrame = 0, works = [], gaps = [];
	let base = null, baseWorks = [], baseGaps = [], baseSince = 0, spoiled = false;

	const median = (list) => {
		if (!list.length) return 0;
		const sorted = [...list].sort((a, b) => a - b);
		return sorted[Math.floor(sorted.length / 2)];
	};
	const keep = (list, value) => {
		list.push(value);
		if (list.length > SAMPLES) list.shift();
	};
	const measuringBase = () => !base && !spoiled && !(typeof TDCLoader !== 'undefined' && TDCLoader.up)
		&& !(typeof TDCDots !== 'undefined' && TDCDots.playing);

	channel.port1.onmessage = () => {
		const work = performance.now() - began;
		keep(works, work);
		if (measuringBase()) baseWorks.push(work);
	};
	function measure(now) {
		if (lastFrame) {
			const gap = now - lastFrame;
			keep(gaps, gap);
			if (measuringBase()) {
				baseGaps.push(gap);
				if (!baseSince) baseSince = now;
				if (now - baseSince >= BASE_FOR) base = { work: median(baseWorks), gap: median(baseGaps) };
			}
		}
		lastFrame = now;
		began = performance.now();
		channel.port2.postMessage(0);
	}
	function measureAgain() {
		base = null;
		baseWorks = [];
		baseGaps = [];
		baseSince = 0;
		spoiled = false;
	}
	function drawMeter() {
		if (!base) {
			hitEl.textContent = '';
			hitDetail.textContent = spoiled ? 'A setting moved before the starting values were measured. Press Back to the starting values, wait a few seconds, then try again.' : '';
			return;
		}
		const work = median(works), gap = median(gaps);
		const late = gap > base.gap * 1.2;
		const cost = late ? Math.max(work, gap) : work;
		const hit = cost - base.work;
		hitEl.textContent = `${hit < 0 ? '−' : '+'}${Math.abs(hit).toFixed(1)} ms a frame`;
		hitEl.classList.toggle('late', late);
		hitDetail.textContent = `Each frame takes ${cost.toFixed(1)} ms of the ${base.gap.toFixed(1)} ms it has, at ${Math.round(1000 / (gap || 1))} frames a second. Starting values: ${base.work.toFixed(1)} ms.`;
	}

	// ── The frame: the light, and the words saying where it is ──
	let raf = null, touched = performance.now(), shown = 0;

	function isCalm() {
		const m = root.dataset.motion;
		return m === 'reduce' || (m !== 'full' && calm.matches);
	}
	function say(now) {
		shown = now;
		if (isCalm()) {
			readout.textContent = 'Less motion is on: the light rests at the centre, above the screen.';
			drawMeter();
			return;
		}
		const x = parseFloat(root.style.getPropertyValue('--page-shadow-x')) || 0;
		const y = parseFloat(root.style.getPropertyValue('--page-shadow-y')) || 0;
		readout.textContent = `The light is ${Math.round(place.depth)}px outside the screen. `
			+ `Shadow ${Math.abs(y).toFixed(1)}px ${y < 0 ? 'up' : 'down'}, ${Math.abs(x).toFixed(1)}px ${x < 0 ? 'left' : 'right'}.`;
		drawMeter();
	}
	function frame(now) {
		raf = null;
		if (now - touched >= REST) {
			say(now);
			hitDetail.textContent = 'The light is resting, so nothing is being measured. Touch the page.';
			lastFrame = 0;
			return;
		}
		raf = requestAnimationFrame(frame);
		measure(now);
		if (!isCalm()) step(now);
		drawSphere();
		if (now - shown >= 250) say(now);
	}
	function wake() {
		touched = performance.now();
		if (raf === null) {
			last = touched;
			raf = requestAnimationFrame(frame);
		}
	}
	['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'].forEach((type) => {
		window.addEventListener(type, wake, { passive: true, capture: true });
	});
	document.addEventListener('scroll', wake, { passive: true, capture: true });
	document.addEventListener('visibilitychange', () => {
		lastFrame = 0;   // the time away is not a slow frame
		if (!document.hidden) wake();
	});

	// ── The page ──
	$('nm-tests').addEventListener('input', () => { if (!base) spoiled = true; });
	row(OUTER, $('nm-light'));
	row(STRENGTH, $('nm-light-look'), (d, v) => body.style.setProperty(d.token, v / 100));
	picker.addEventListener('input', () => pickColour(picker.value));
	SHADOWS.forEach((def) => row(def, $('nm-shadows'), (d, v) => {
		layout.style.setProperty(d.token, v + (d.css || ''));
	}));
	SPHERE.forEach((def) => {
		row(def, $('nm-sphere-controls'));
		if (def.start !== undefined) setSlider(def, def.start);
	});
	setSlider(OUTER, OUTER.start);
	shadowsFromSheet();
	lightFromSheet();
	dur = timeFor(from, to);
	wake();

	$('nm-reset').addEventListener('click', () => {
		setSlider(OUTER, OUTER.start);
		SPHERE.forEach((def) => { if (def.start !== undefined) setSlider(def, def.start); });
		shadowsFromSheet();
		lightFromSheet();
		measureAgain();
	});
	new MutationObserver(() => {
		shadowsFromSheet();
		lightFromSheet();
		measureAgain();
	}).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

	const scratch = (e) => {
		e.preventDefault();
		TDC.status($('nm-status'), 'A scratch page: nothing happens here.', '');
	};
	$('nm-form').addEventListener('submit', scratch);
	document.querySelectorAll('[data-nm-link]').forEach((a) => a.addEventListener('click', scratch));
})();
