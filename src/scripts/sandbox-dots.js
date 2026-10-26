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
	let countN = +count.textContent;
	reveals.set(count, () => { count.textContent = ++countN; });
	traces.set(count, 'number');

	// The tabs: the chosen one's pill is traced, then fills.
	const tabs = [...document.querySelectorAll('.dots-tabs .league-nav-item')];
	for (const tab of tabs) {
		reveals.set(tab, () => { for (const x of tabs) x.toggleAttribute('aria-current', x === tab); tab.setAttribute('aria-current', 'page'); });
		traces.set(tab, 'tab');
	}

	// The switch, served as a ring (UV, 26 Oct): its knob is the site's own
	// ring, a tick on and empty off. When the call is back the knob slides to
	// its new side while the dots trace the tick in it (off: nothing to trace,
	// they race).
	const sw = $('dots-switch');
	const swRing = ringOn(sw.querySelector('.tdc-ring'), ['tick'], 'empty');
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
		if (swRing) swRing.setState(on ? 'tick' : 'empty');
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

	// The waiting move: one on repeat (a solo move for all four dots, or a
	// group move back to back), or Random.
	const move = $('dots-move'), random = $('dots-random');
	const options = (list) => list.map((m) => `<option value="${m}">${m}</option>`).join('');
	move.innerHTML = `<optgroup label="Solo">${options(TDCDots.moves)}</optgroup><optgroup label="Group">${options(TDCDots.groups)}</optgroup>`;
	const force = () => TDCDots.force(random.checked ? null : move.value);
	move.addEventListener('change', () => { random.checked = false; force(); });
	random.addEventListener('change', force);

	// Reduced motion without changing the device's setting: data-motion on
	// the page's root, which the dots read (scripts/dots.js, dots.css).
	const motion = $('dots-motion'), motionNote = $('dots-motion-note'), lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
	const noteMotion = () => {
		motionNote.textContent = 'This device ' + (lessMotion.matches ? 'asks for less motion.' : 'does not ask for less motion.')
			+ ' Reduced: no dots; a tapped target breathes while it waits and fades in when it is back; things loading with the page only dim.';
	};
	noteMotion();
	lessMotion.addEventListener('change', noteMotion);
	motion.addEventListener('change', () => {
		if (motion.value) root.dataset.motion = motion.value;
		else delete root.dataset.motion;
	});

	setInterval(() => {
		const s = TDCDots.state;
		const moves = s.group ? 'Group: ' + s.group : s.moves.length ? 'Solo: ' + s.moves.join(' · ') : '';
		const phase = s.phase === 'hidden' ? 'Hidden' : s.phase === 'trace' ? 'Tracing' : s.phase[0].toUpperCase() + s.phase.slice(1);
		stat.textContent = (s.phase === 'orbit' && moves ? '' : phase) + (moves ? (s.phase === 'orbit' ? '' : ' · ') + moves : '') + (s.forced ? ' (forced)' : '')
			+ (s.loading ? ` · ${s.loading} loading` : '') + (s.reduced ? ' · reduced motion' : '');
	}, 120);

	// ─── Simulate page load (spec §13) ───
	// Everything on the stage goes back to loading, each for its own time:
	// about a quarter within 0.15 s (they should show nothing), the rest up to
	// the network delay. Each is tracked, not served, so the queue decides
	// where the dots go. The log says, for each, what the dots did, watched
	// every frame from TDCDots.state.
	const loadBtn = $('dots-load'), instant = $('dots-instant'), log = $('dots-log');
	const LOADING = [
		{ el: document.querySelector('.dots-tabs'), name: 'Tabs' },
		...[...document.querySelectorAll('.dots-tiles [data-icon]')].map((el) => ({ el, name: el.getAttribute('aria-label') })),
		{ el: count, name: 'Counter', trace: 'number', before: () => { count.textContent = '–'; }, reveal: () => { count.textContent = countN; } },
		...[...document.querySelectorAll('.dots-sandbox .list-row')].flatMap((row, k) => [
			{ el: row.querySelector('.list-row-main'), name: `Row ${k + 1}` },
			{ el: row.querySelector('.list-row-actions > *'), name: k ? 'Switch' : 'Move' }
		]),
		...[...document.querySelectorAll('.dots-target')].map((el) => ({ el, name: el.textContent }))
	];
	let watch = null;
	function outcome(w) {
		if (w.traced) return 'traced, then the race and fade: the last';
		if (w.raced) return 'back before the dots landed; they landed and raced: the last';
		if (w.waited) return 'the dots waited on it, and it came in as they flew on';
		if (w.went) return 'the dots set off for it; it was back first and they turned';
		return w.ms < 150 ? 'instant: nothing shown' : 'came in while the dots were elsewhere';
	}
	function showLog() {
		log.innerHTML = '';
		for (const w of watch.all) {
			const li = document.createElement('li');
			li.textContent = `${w.name} · ${(w.ms / 1000).toFixed(2)} s · ${w.back ? outcome(w) : 'loading'}`;
			log.append(li);
		}
	}
	function follow() {
		const s = TDCDots.state, w = watch.byEl.get(s.target);
		if (w) {
			w.went = true;
			if (s.phase === 'orbit') w.waited = true;
			if (s.phase === 'trace') w.traced = true;
			if (s.phase === 'race' && !w.traced) w.raced = true;
		}
		if (watch.all.every((x) => x.back) && s.phase === 'hidden') { showLog(); loadBtn.disabled = false; return; }
		requestAnimationFrame(follow);
	}
	// fixed: a load time (ms) for some, by name (Failures uses it).
	function simulate(fixed = {}) {
		if (loadBtn.disabled) return false;
		loadBtn.disabled = true;
		const all = LOADING.map((x) => ({ ...x, ms: fixed[x.name] || (instant.checked || Math.random() < 0.25 ? 20 + Math.random() * 110 : 150 + Math.random() * (+delay.value * 1000 - 150)) }));
		watch = { all, byEl: new Map(all.map((w) => [w.el, w])) };
		for (const w of all) {
			if (w.before) w.before();
			const call = new Promise((resolve) => setTimeout(resolve, w.ms)).then(() => { w.back = true; showLog(); });
			TDCDots.track(w.el, call, { reveal: w.reveal, trace: w.trace });
		}
		showLog();
		requestAnimationFrame(follow);
		return true;
	}
	loadBtn.addEventListener('click', () => simulate());

	// ─── Failures (spec §14) ───
	// Each button makes one thing go wrong on the stage, at the network delay.
	// The dots should say so ("TDC (Error)", on their own line or, ticked,
	// this section's) and the target should still end right: once the dots
	// are hidden and nothing is out, the log lists anything still marked.
	const fails = [...document.querySelectorAll('[data-fail]')];
	const failStatus = $('dots-fail-status'), failLog = $('dots-fail-log'), ownLine = $('dots-own-line');
	const note = (s) => { const li = document.createElement('li'); li.textContent = s; failLog.append(li); };
	const status = () => (ownLine.checked ? failStatus : undefined);
	const label = (el) => el.getAttribute('aria-label') || el.textContent.trim();
	const tile = (icon) => document.querySelector(`.dots-tiles [data-icon="${icon}"]`);
	const [bookBtn, saveBtn] = document.querySelectorAll('.dots-target');
	let away = 0;
	// Off the page for ms, then back where it was.
	function lift(el, ms) {
		const parent = el.parentNode, next = el.nextSibling;
		el.remove();
		away++;
		note(`${label(el)}: taken off the page.`);
		setTimeout(() => { parent.insertBefore(el, next); away--; note(`${label(el)}: put back.`); }, ms);
	}
	// Once it is all over (and anything taken away is back): what is still
	// marked by the dots, then `after` (an icon broken on purpose drawn again).
	function endCheck(after) {
		const t0 = performance.now();
		let quiet = 0;
		const poll = () => {
			const s = TDCDots.state, idle = s.phase === 'hidden' && s.busy === 0 && !away && performance.now() - t0 > 500;
			quiet = idle ? quiet + 1 : 0;
			if (quiet < 6) { setTimeout(poll, 100); return; }
			const marked = [...document.querySelectorAll('[data-dots], [data-dots-trace], [data-dots-calm], [style*="--dots-lines"]')];
			note(marked.length ? 'Still marked: ' + marked.map(label).join(', ') : 'All clear: nothing is left marked.');
			if (after) after();
			for (const b of fails) b.disabled = false;
		};
		poll();
	}
	// The icon's lines broken by its reveal, then drawn again at the end.
	function brokenIcon(how) {
		const b = tile('cue'), face = b.querySelector('.dots-face');
		TDCDots.serve(b, fakeCall(), { status: status(), reveal: () => { for (const m of face.querySelectorAll('.mark.on')) how(m); } });
		return () => { ringOn(face, ['cue'], 'cue'); note('Lag: its icon drawn again.'); };
	}
	const RUNS = {
		missing: () => brokenIcon((m) => m.classList.remove('on')),
		unreadable: () => brokenIcon((m) => m.setAttribute('d', 'not a path')),
		flight() {
			const b = tile('bell');
			TDCDots.serve(b, fakeCall(), { status: status() });
			setTimeout(() => lift(b, 2000), 300);
		},
		trace() {
			TDCDots.serve(count, fakeCall(), { status: status(), trace: 'number', reveal: reveals.get(count) });
			const wait = () => {
				const s = TDCDots.state;
				if (s.phase === 'trace' && s.target === count) { lift(count, 1500); return; }
				if (s.reduced && s.busy === 0) { note('Reduced motion: nothing is traced, so there was nothing to interrupt.'); return; }
				requestAnimationFrame(wait);
			};
			requestAnimationFrame(wait);
		},
		throws() {
			TDCDots.serve(bookBtn, fakeCall(), { status: status(), reveal: () => { throw new Error('a reveal that throws, on purpose'); } });
		},
		hang() {
			note('Profile: its call never comes back; the dots give up on it after 20 s.');
			TDCDots.serve(tile('user'), new Promise(() => {}), { status: status() });
		},
		reject() {
			// The page reports its own call's error; the dots only log it.
			const call = new Promise((ok, no) => setTimeout(() => no(new Error('TDC (Error): Save settings could not be saved (on purpose).')), +delay.value * 1000));
			TDCDots.serve(saveBtn, call, { status: status() }).catch((err) => TDC.showSupabaseError(AREA, err, failStatus));
		},
		leaves() {
			const row = document.querySelector('.dots-sandbox .list-row-main');
			if (!simulate({ 'Row 1': Math.max(2500, +delay.value * 1000) })) { note('A page load is already running: try again when it is done.'); return; }
			setTimeout(() => lift(row, 2500), 300);
		},
		engine() {
			if (TDCDots.state.reduced) { note('Reduced motion: the dots do not run, so there is nothing of theirs to break.'); return; }
			// Measured every frame, the button throws for a moment.
			TDCDots.serve(bookBtn, fakeCall(), { status: status() });
			setTimeout(() => { bookBtn.getBoundingClientRect = () => { throw new Error('a measurement that throws, on purpose'); }; }, 400);
			setTimeout(() => { delete bookBtn.getBoundingClientRect; }, 1500);
		}
	};
	for (const b of fails) {
		b.addEventListener('click', () => {
			for (const x of fails) x.disabled = true;
			failLog.innerHTML = '';
			TDC.status(failStatus, '', '');
			note(b.textContent + ':');
			let after = null;
			try { after = RUNS[b.dataset.fail](); }
			catch (err) { TDC.error(AREA, 'the failure could not be set up.', err, failStatus); }
			endCheck(after);
		});
	}
})();
