// Custom controls for The Dive Club pages.
// Loaded on every page by layout.html, after tdc.js and before the page's own
// scripts. Styles in controls.css, sizes and colours in variables.css (all of
// them editable on /sandbox/).
//
// A control is an ordinary form element that opts in, and stays the real
// element: pages read .value and listen for input and change exactly as
// before, and a page that never loads this file still works. Controls only add
// the visuals and the extra ways in around it. Two ways to opt in:
//
//   data-control="<kind>" on the element itself, e.g.
//     <input type="number" data-control="stepper" min="0" max="10">
//   data-controls="<kind> <kind>" on a container: every element inside it
//     that the kind takes (its "auto" selector) becomes one, including those
//     a script renders later. layout.html puts all three kinds on <body>, so
//     the whole site uses them (UV, 24 Oct). data-control="none" keeps one
//     element native: the long lists of people and teams, and the bracket's
//     score boxes. Nothing inside a table is taken: the cells are too narrow.
//
// Each kind is one define() below. Elements already on the page are enhanced
// once every script has run, and anything added later (forms generated from
// TDCMatchDef, rows re-rendered after a write) is picked up as it arrives.
//
// Kinds:
//   stepper  <input type="number">. The number in a pill, a chevron above to
//            go up and one below to go down. A chevron disappears at its limit
//            (min / max) and the pill shrinks with it. Hold a chevron to keep
//            going; each new number rolls in. Click the number to type one: it
//            is selected, so typing replaces it, letters are refused, phones
//            get the number pad, and Enter or leaving it commits it, pulled
//            into range. Escape undoes. Its label and hint move to its right.
//   date     <input type="date">. Year, month and day as three steppers, with
//            a calendar button and a clear button to their left. Pressing a
//            chevron on an empty date starts it at today; emptying any part,
//            or the clear button, clears the date. Label and hint to its right.
//   select   <select>. The options side by side in a horizontal pill, the
//            chosen one in a green pill of its own that slides to the next.
//            Click an option to choose it, or use the arrows at either end.
//            The real select keeps the keyboard: Tab reaches it and the arrow
//            keys change it.

const TDCControls = (() => {
	const AREA = 'Controls';
	const kinds = {};   // name -> { enhance, auto }
	let started = false;

	// Register a kind. enhance(el) is called once per element; auto is the
	// selector a data-controls container hands to it.
	function define(name, enhance, auto) {
		kinds[name] = { enhance, auto: auto || null };
		if (started) scan(document);
	}

	// The kind el should become, or null. Every data-controls container round
	// it counts, nearest first, so one naming a single kind does not switch off
	// the others named further out (the whole site's, on <body>).
	function kindFor(el) {
		if (el.dataset.control) return el.dataset.control === 'none' ? null : el.dataset.control;
		for (let scope = el.closest('[data-controls]'); scope; scope = scope.parentElement && scope.parentElement.closest('[data-controls]')) {
			for (const name of scope.dataset.controls.split(/\s+/)) {
				const kind = kinds[name];
				if (kind && kind.auto && el.matches(kind.auto)) return name;
			}
		}
		return null;
	}

	// Enhance every opted-in element under root that has not been already.
	function scan(root) {
		const selector = ['[data-control]']
			.concat(Object.values(kinds).filter((k) => k.auto).map((k) => k.auto))
			.join(',');
		const found = root.matches && root.matches(selector) ? [root] : [];
		if (root.querySelectorAll) found.push(...root.querySelectorAll(selector));

		for (const el of found) {
			if (el.dataset.controlReady) continue;
			const name = kindFor(el);
			if (!name) continue;
			if (!kinds[name]) {
				TDC.error(AREA, `no control called "${name}".`, el);
				el.dataset.controlReady = 'unknown';
				continue;
			}
			el.dataset.control = name;
			el.dataset.controlReady = 'yes';
			try { kinds[name].enhance(el); }
			catch (err) { TDC.error(AREA, `the ${name} control could not be set up.`, err); }
		}
	}

	// ─── Helpers ───
	// Tell the page the value changed, as typing would.
	function announce(el) {
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	}

	// Call fn whenever a script sets one of these properties, which fires no
	// event of its own (a settings page filling its form after a read).
	function onPropSet(el, props, fn) {
		const proto = Object.getPrototypeOf(el);
		for (const prop of props) {
			const native = Object.getOwnPropertyDescriptor(proto, prop);
			Object.defineProperty(el, prop, {
				configurable: true,
				get() { return native.get.call(this); },
				set(v) { native.set.call(this, v); fn(); }
			});
		}
	}

	const node = (tag, cls) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		return n;
	};

	// A chevron button. It points up; controls.css turns it for each use.
	const CHEVRON = '<svg viewBox="0 0 24 14" aria-hidden="true"><path pathLength="100" d="M3 11.5 12 3l9 8.5"/></svg>';
	function chevron(cls, label) {
		const b = node('button', 'tdc-chevron ' + cls);
		b.type = 'button';
		b.tabIndex = -1;   // the real element takes the keyboard; one tab stop, not several
		b.setAttribute('aria-label', label);
		b.innerHTML = CHEVRON;
		// Keep focus where it is, and no text selection on a long press.
		b.addEventListener('pointerdown', (e) => { if (e.button === 0) e.preventDefault(); });
		return b;
	}

	const labelFor = (el) => el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;

	// A time token (--control-motion, --ring-draw ...) in ms; 0 when the
	// device asks for less motion.
	const lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
	function timeMs(el, token) {
		if (lessMotion.matches) return 0;
		const v = getComputedStyle(el).getPropertyValue(token).trim();
		const n = parseFloat(v);
		if (isNaN(n)) return 0;
		return v.endsWith('ms') ? n : n * 1000;
	}
	const motionMs = (el) => timeMs(el, '--control-motion');

	// ─── Icons draw themselves ───
	// Every icon in a control draws in stroke by stroke when it appears (the
	// page opens, a chevron comes back from its limit, the date's cross once
	// there is a date) and undraws when it goes, in the ring's draw time,
	// straight away (UV, 24 Oct). Each stroke (an SVG part with pathLength
	// 100) takes its own slice of the time, in order; undrawing runs them
	// backwards. gone(true / false) is the control's own way of hiding it.
	function drawIcon(el, show, gone) {
		if (el.tdcShown === show) return;
		const first = el.tdcShown === undefined;
		el.tdcShown = show;
		clearTimeout(el.tdcGoing);
		const strokes = [...el.querySelectorAll('svg [pathLength]')];
		for (const s of strokes) s.getAnimations().forEach((a) => a.cancel());
		if (first && !show) { gone(true); return; }

		const ms = timeMs(el, '--ring-draw');
		el.classList.toggle('is-going', !show);
		if (show) gone(false);
		const slice = ms / Math.max(1, strokes.length);
		(show ? strokes : strokes.slice().reverse()).forEach((s, i) => {
			s.style.strokeDashoffset = show ? '0' : '100';
			if (!ms) return;
			s.animate([{ strokeDashoffset: show ? 100 : 0 }, { strokeDashoffset: show ? 0 : 100 }],
				{ duration: slice, delay: i * slice, easing: 'ease-out', fill: 'backwards' });
		});
		if (!show) {
			el.tdcGoing = setTimeout(() => {
				if (el.tdcShown) return;
				gone(true);
				el.classList.remove('is-going');
			}, ms);
		}
	}

	// A vertical control sits beside its label and hint rather than under
	// them (UV, 24 Oct): marks its .field so controls.css can lay it out.
	function besideLabel(control) {
		markField(control, 'field-beside');
	}
	// A control centred under its label: the label and hint centre with it.
	function markField(control, cls) {
		const field = control.parentElement;
		if (field && field.classList.contains('field')) field.classList.add(cls);
	}

	// ─── Stepper ───
	const HOLD_DELAY = 400;   // ms before a held chevron starts repeating
	const HOLD_EVERY = 80;    // ms between repeats

	define('stepper', (input) => {
		if (input.type !== 'number') {
			TDC.error(AREA, 'a stepper must be an <input type="number">.', input);
			return;
		}

		// The window clips the number, so a changing one can roll through it.
		const pill = node('span', 'tdc-stepper');
		const up = chevron('tdc-stepper-up', 'Increase');
		const down = chevron('tdc-stepper-down', 'Decrease');
		const view = node('span', 'tdc-stepper-window');
		input.replaceWith(pill);
		view.append(input);
		pill.append(up, view, down);
		besideLabel(pill);

		const min = () => input.min === '' ? -Infinity : Number(input.min);
		const max = () => input.max === '' ? Infinity : Number(input.max);
		const whole = () => input.step !== 'any' && Number.isInteger(Number(input.step || 1));

		// A chevron is shown only while there is somewhere to go. The pill
		// is as wide as the longest number it can hold (--chars).
		function sync() {
			const v = input.valueAsNumber;
			drawIcon(up, isNaN(v) || v < max(), (g) => { up.hidden = g; });
			drawIcon(down, isNaN(v) || v > min(), (g) => { down.hidden = g; });
			pill.classList.toggle('is-disabled', input.disabled);
			pill.style.setProperty('--chars', Math.max(1, input.value.length, input.max.length, input.min.length));
			roll();
		}

		// A new number rolls in and pulls the old one out with it: upwards
		// when it goes up, downwards when it goes down (UV, 24 Oct). Not while
		// it is being typed, and not between the same number written two ways
		// ("4" and "04").
		let shown = input.value;
		let ghost = null;
		function roll() {
			const before = shown;
			const now = input.value;
			shown = now;
			if (before === now || before === '' || now === '') return;
			if (Number(before) === Number(now) || document.activeElement === input) return;
			const ms = motionMs(pill);
			if (!ms) return;

			const dir = Number(now) > Number(before) ? 1 : -1;
			if (ghost) ghost.remove();
			const old = ghost = node('span', 'tdc-stepper-ghost');
			old.textContent = before;
			old.setAttribute('aria-hidden', 'true');
			view.append(old);
			const timing = { duration: ms, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' };
			input.animate([{ transform: `translateY(${dir * 100}%)` }, { transform: 'translateY(0)' }], timing);
			old.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-dir * 100}%)` }], timing)
				.onfinish = () => { old.remove(); if (ghost === old) ghost = null; };
		}

		function step(dir) {
			if (input.disabled || input.readOnly) return;
			const before = input.value;
			try {
				if (dir > 0) input.stepUp(); else input.stepDown();
			} catch (err) {
				TDC.error(AREA, 'could not change the number.', err);
				return;
			}
			sync();
			if (input.value !== before) announce(input);
		}

		// Pointers step on press and repeat while held; a keyboard or screen
		// reader activating the button arrives as a click with no pointer.
		let timer = null;
		const stop = () => { clearTimeout(timer); timer = null; };
		for (const [b, dir] of [[up, 1], [down, -1]]) {
			b.addEventListener('pointerdown', (e) => {
				if (e.button !== 0) return;
				step(dir);
				const repeat = () => {
					if (!b.tdcShown) return stop();
					step(dir);
					timer = setTimeout(repeat, HOLD_EVERY);
				};
				timer = setTimeout(repeat, HOLD_DELAY);
			});
			b.addEventListener('pointerup', stop);
			b.addEventListener('pointerleave', stop);
			b.addEventListener('pointercancel', stop);
			b.addEventListener('click', (e) => { if (e.detail === 0) step(dir); });
		}

		// ─ Typing ─
		// The number pad on a phone, and only the characters a number can
		// have: digits, a minus if the range goes below 0, a point if the step
		// is fractional. A browser lets "e" and "+" into a number field.
		if (!input.hasAttribute('inputmode')) input.inputMode = whole() ? 'numeric' : 'decimal';
		const allowed = () => new RegExp('^[0-9' + (min() < 0 ? '\\-' : '') + (whole() ? '' : '.') + ']*$');
		input.addEventListener('beforeinput', (e) => {
			if (!e.inputType.startsWith('insert')) return;
			const text = e.data != null ? e.data : (e.dataTransfer ? e.dataTransfer.getData('text') : '');
			if (!allowed().test(text)) e.preventDefault();
		});

		// Clicking the number selects it, so typing replaces it. The mouseup
		// that follows the click would otherwise drop the selection.
		let before = '';
		let justFocused = false;
		input.addEventListener('focus', () => {
			before = input.value;
			justFocused = true;
			input.select();
		});
		input.addEventListener('mouseup', (e) => {
			if (justFocused) e.preventDefault();
			justFocused = false;
		});
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
			if (e.key === 'Escape') { input.value = before; input.blur(); }
		});

		// A typed number is pulled into range as it is committed. Caught on the
		// way down (capture), so every listener the page has sees it settled.
		pill.addEventListener('change', (e) => {
			if (e.target !== input || input.value === '') return;
			const v = input.valueAsNumber;
			if (isNaN(v)) return;
			let settled = Math.min(max(), Math.max(min(), v));
			if (whole()) settled = Math.round(settled);
			if (settled !== v) input.value = String(settled);
		}, true);

		input.addEventListener('input', sync);
		input.addEventListener('change', sync);
		onPropSet(input, ['value'], sync);
		new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['min', 'max', 'disabled'] });

		sync();
	}, 'input[type="number"]:not(table input)');

	// ─── Date ───
	// The date's two icons, in a 24 box: the calendar (body, rule, two rings)
	// and the cross, each drawn stroke by stroke.
	const CALENDAR = ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
		'M3 10h18', 'M8 3v4', 'M16 3v4'];
	const CLEAR = ['M6 6l12 12', 'M18 6 6 18'];
	const pad = (n, width) => String(n).padStart(width, '0');
	const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m is 1–12
	const todayParts = () => {
		const d = new Date();
		return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
	};

	define('date', (real) => {
		if (real.type !== 'date') {
			TDC.error(AREA, 'a date control must be an <input type="date">.', real);
			return;
		}

		const label = labelFor(real);
		const name = label ? label.textContent.trim() : 'Date';
		const yearMin = real.min ? Number(real.min.slice(0, 4)) : 1;
		const yearMax = real.max ? Number(real.max.slice(0, 4)) : 9999;

		const part = (cls, placeholder, lo, hi, what) => {
			const p = node('input', 'tdc-date-' + cls);
			p.type = 'number';
			p.placeholder = placeholder;
			p.min = lo;
			p.max = hi;
			p.disabled = real.disabled;
			p.dataset.control = 'stepper';
			p.setAttribute('aria-label', `${name}: ${what}`);
			return p;
		};
		const year = part('year', 'YYYY', yearMin, yearMax, 'year');
		const month = part('month', 'MM', 1, 12, 'month');
		const day = part('day', 'DD', 1, 31, 'day');
		const parts = [year, month, day];

		// The calendar and the clear button stack to the left of the numbers
		// (UV, 24 Oct). The real input sits invisibly under the calendar, so
		// the browser's own picker opens beside it.
		// Drawn icons, so they can draw themselves in like every other.
		const tool = (cls, label, strokes) => {
			const b = node('button', cls);
			b.type = 'button';
			b.setAttribute('aria-label', `${name}: ${label}`);
			b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
				+ strokes.map((d) => `<path pathLength="100" d="${d}"/>`).join('') + '</svg>';
			return b;
		};
		const pick = tool('tdc-date-pick', 'choose from a calendar', CALENDAR);
		const clear = tool('tdc-date-clear', 'clear the date', CLEAR);
		const tools = node('span', 'tdc-date-tools');

		const box = node('span', 'tdc-date');
		real.replaceWith(box);
		tools.append(pick, clear, real);
		box.append(tools, year, month, day);
		real.tabIndex = -1;
		real.setAttribute('aria-hidden', 'true');
		scan(box);   // the three steppers, now rather than on the next tick
		year.closest('.tdc-stepper').classList.add('is-year');
		besideLabel(box);

		// The real input is the record; the parts only show it.
		function show() {
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(real.value);
			year.value = m ? m[1] : '';
			month.value = m ? m[2] : '';
			day.value = m ? m[3] : '';
			day.max = m ? daysIn(Number(m[1]), Number(m[2])) : 31;
			drawIcon(clear, !!m, (g) => clear.classList.toggle('is-empty', g));
		}

		function write(value) {
			const was = real.value;
			real.value = value;   // re-shows the parts
			if (real.value !== was) announce(real);
		}

		const today = () => {
			const t = todayParts();
			write(`${pad(t[0], 4)}-${pad(t[1], 2)}-${pad(t[2], 2)}`);
		};

		// A part changed: build the date from all three. A part left empty
		// beside filled ones is taken from today; an emptied one clears it.
		function compose(changed) {
			if (changed.value === '' || parts.every((p) => p.value === '')) return write('');
			const t = todayParts();
			const [y0, m0, d0] = parts.map((p, i) => p.value === '' ? t[i] : Math.trunc(p.valueAsNumber));
			const y = Math.min(yearMax, Math.max(yearMin, y0));
			const m = Math.min(12, Math.max(1, m0));
			const d = Math.min(daysIn(y, m), Math.max(1, d0));
			write(`${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`);
		}

		// The parts' own events stop here: the page hears only the real input,
		// with a whole date or none.
		for (const type of ['input', 'change']) {
			box.addEventListener(type, (e) => {
				if (e.target === real) { show(); return; }   // the browser's calendar
				e.stopPropagation();
				if (type === 'change' && parts.includes(e.target)) compose(e.target);
			});
		}

		// An empty date starts at today on the first chevron or arrow key,
		// rather than at the year 1.
		box.addEventListener('pointerdown', (e) => {
			if (real.value !== '' || real.disabled || !e.target.closest('.tdc-chevron')) return;
			e.stopPropagation();
			e.preventDefault();
			today();
		}, true);
		box.addEventListener('keydown', (e) => {
			if (real.value !== '' || !parts.includes(e.target)) return;
			if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
			e.preventDefault();
			today();
		}, true);

		pick.addEventListener('click', () => {
			if (typeof real.showPicker !== 'function') {
				TDC.error(AREA, 'this browser cannot open a calendar from a button. Use the numbers instead.');
				return;
			}
			try { real.showPicker(); }
			catch (err) { TDC.error(AREA, 'the calendar could not be opened.', err); }
		});
		clear.addEventListener('click', () => { if (!real.disabled) write(''); });

		// The label points at the hidden input; send it to the year instead.
		if (label) label.addEventListener('click', (e) => { e.preventDefault(); year.focus(); });

		onPropSet(real, ['value'], show);
		show();
		drawIcon(pick, true, () => {});
	}, 'input[type="date"]:not(table input)');

	// ─── Ring and switch (checkboxes) ───
	// UV's ring status design (ring-status.js) on every checkbox (24 Oct). The
	// switch is for a setting: tick on, cross off, its knob sliding in step
	// with the drawing. The ring is for a tick against a person or a thing
	// (paid, here tonight, picked): a tick or empty. Every checkbox is a switch
	// unless it is made with data-control="ring".
	//
	// The checkbox stays the real one, invisible but focusable: Space and its
	// label still toggle it, and pages read .checked and hear change as
	// before. When it changes the dots orbit for as long as the site's own
	// call takes (TDCNet, supabaseClient.js): a box that saves as it changes
	// draws its answer once the network is quiet, after the page's re-read,
	// so what is drawn is what the database kept. A box in a form, with
	// nothing to wait for, orbits for --ring-load (1 s). Draw and fade are
	// fixed tokens too (--ring-draw, --ring-fade).
	//
	// Pages draw themselves again after every write, which makes a new
	// checkbox. The live control is handed on to it by the box's id, or by its
	// data-action with the row's data-entrant / data-player, so the animation
	// carries on through the rebuild.
	const liveChecks = new Map();
	const LIVE_FOR = 20000;   // ms: a save not answered by then is drawn as it stands
	const checkKey = (box) => box.id ? '#' + box.id
		: ['action', 'entrant', 'player', 'box', 'frame'].map((k) => box.dataset[k] || '').join('|');
	const secs = (el, token, fallback) => {
		const ms = timeMs(el, token);
		return lessMotion.matches ? fallback : ms / 1000;
	};

	function checkControl(box, kind) {
		if (box.type !== 'checkbox') {
			TDC.error(AREA, `a ${kind} must be an <input type="checkbox">.`, box);
			return;
		}
		const key = checkKey(box);
		const was = liveChecks.get(key);
		const c = was && was.kind === kind && was.ring.busy ? was : makeCheck(kind, box);
		box.replaceWith(c.wrap);
		c.bind(box, key);
		besideLabel(c.wrap);
	}

	function makeCheck(kind, first) {
		const isSwitch = kind === 'switch';
		const ON = 'tick';
		const OFF = isSwitch ? 'cross' : 'empty';
		const c = { kind, box: null, key: null };
		const state = () => c.box.checked ? ON : OFF;

		const wrap = c.wrap = node('span', isSwitch ? 'tdc-switch' : 'tdc-check');
		const face = node('span', 'tdc-ring');
		face.innerHTML = TDCRing.svg(5);
		if (isSwitch) {
			const knob = node('span', 'tdc-switch-knob');
			knob.append(face);
			wrap.append(node('span', 'tdc-switch-track'), knob);
		} else {
			wrap.append(face);
		}

		// The knob and the track follow --p, 0 off to 1 on (status.css).
		let knobAt = 0, fromAt = 0, moving = false;
		const place = (p) => { knobAt = p; wrap.style.setProperty('--p', p.toFixed(3)); };

		c.ring = new TDCRing.RingStatus(face, {
			icons: isSwitch ? [ON, OFF] : [ON],
			labels: isSwitch ? { tick: 'On', cross: 'Off', loading: 'Saving' } : { tick: 'Ticked', empty: 'Not ticked', loading: 'Saving' },
			initial: first.checked ? ON : OFF,
			onProgress: isSwitch ? (p, target) => {
				if (!moving) { moving = true; fromAt = knobAt; }
				place(fromAt + ((target === ON ? 1 : 0) - fromAt) * p);
			} : null
		});
		if (isSwitch) place(first.checked ? 1 : 0);

		// Changed again while it was drawing: draw that too, the same way.
		c.ring.onDone = () => {
			moving = false;
			liveChecks.delete(c.key);
			if (c.ring.state !== state() && start()) finishWhen(saves);
		};

		// The orbit starts at once, aimed at the new state, and is registered
		// as live before the page's own handler runs: a page that rebuilds its
		// form inside that handler (the ruleset on /leagues/new/) hands this
		// control straight to the new checkbox. Whether to wait for the
		// network is decided once the handler has had its turn, before the
		// dots have moved: if it asked the database anything, the orbit is
		// re-timed to --ring-min (0.2 s), so a quick save is drawn quickly and
		// a slow one keeps the dots going round until the network is quiet;
		// if not, it orbits for --ring-load (1 s).
		//
		// A click is never ignored, drawing or not (UV, 24 Oct). It toggles
		// the box and the page saves it (queued behind the others, TDC.writer);
		// an orbit still running simply draws whatever the box holds by then,
		// and one already drawing draws again once it has finished.
		let mark = 0;
		let saves = false;   // whether this box saves as it changes, learnt from its first change
		const watching = typeof TDCNet !== 'undefined';
		const loadFor = () => saves ? secs(wrap, '--ring-min', 0.2) : secs(wrap, '--ring-load', 1);
		function start() {
			if (c.ring.busy) return false;
			c.ring.load(loadFor(), {
				draw: secs(wrap, '--ring-draw', 0.8),
				fade: secs(wrap, '--ring-fade', 0.5),
				lead: TDCRing.leadOf(state())
			});
			liveChecks.set(c.key, c);
			return true;
		}
		function finishWhen(online) {
			if (!online) { c.ring.resolve(state()); return; }
			const late = new Promise((r) => setTimeout(r, LIVE_FOR));
			Promise.race([TDCNet.quiet(), late])
				.then(() => setTimeout(() => c.ring.resolve(state()), 0));
		}

		wrap.addEventListener('change', (e) => {
			if (e.target === c.box && watching) mark = TDCNet.started;
		}, true);
		wrap.addEventListener('change', (e) => {
			if (e.target !== c.box) return;
			const fresh = start();
			setTimeout(() => {
				if (watching && TDCNet.started > mark && !saves) {
					saves = true;
					c.ring.retime(loadFor());
				}
				if (fresh) finishWhen(saves);
			}, 0);
		});

		// Clicking the drawing clicks the checkbox, which toggles it and tells
		// the page.
		wrap.addEventListener('click', (e) => {
			if (e.target === c.box || c.box.disabled) return;
			c.box.click();
		});

		c.bind = (box, key) => {
			if (c.box && c.box !== box) c.box.remove();   // the one the page threw away
			c.box = box;
			c.key = key;
			box.classList.add('tdc-check-native');
			if (isSwitch) box.setAttribute('role', 'switch');
			wrap.append(box);
			wrap.classList.toggle('is-disabled', box.disabled);
			// Set from a script (a page filling its form): show it, no animation.
			onPropSet(box, ['checked'], () => {
				if (c.ring.busy || c.box !== box) return;
				c.ring.setState(state());
				if (isSwitch) place(box.checked ? 1 : 0);
			});
			new MutationObserver(() => wrap.classList.toggle('is-disabled', box.disabled))
				.observe(box, { attributes: true, attributeFilter: ['disabled'] });
		};
		return c;
	}

	define('switch', (box) => checkControl(box, 'switch'), 'input[type="checkbox"]');
	define('ring', (box) => checkControl(box, 'ring'), null);

	// ─── Select ───
	// Where each select's green pill was the moment an option was chosen, by
	// the select's id. A page that rebuilds its form after every change (the
	// ruleset on /leagues/new/) makes a new control each time; the new one
	// starts its pill here and slides it to the new option.
	const thumbWas = new Map();
	const THUMB_MEMORY = 1000;   // ms: older than this is a different visit

	define('select', (select) => {
		if (select.tagName !== 'SELECT' || select.multiple) {
			TDC.error(AREA, 'a select control must be a single-choice <select>.', select);
			return;
		}

		const box = node('span', 'tdc-select');
		const prev = chevron('tdc-select-prev', 'Previous option');
		const next = chevron('tdc-select-next', 'Next option');
		const track = node('span', 'tdc-select-track scroll-x');
		// The green pill is its own layer under the options, so it can slide
		// over and change width to the next one (UV, 24 Oct).
		const thumb = node('span', 'tdc-select-thumb');
		thumb.setAttribute('aria-hidden', 'true');
		select.replaceWith(box);
		box.append(prev, track, next, select);
		markField(box, 'field-centred');

		const enabled = () => [...select.options].map((o, i) => o.disabled ? -1 : i).filter((i) => i >= 0);
		const chosenButton = () => track.querySelector('.tdc-select-option.is-selected');

		// Put the pill under b. Slides when the track is animated; jumps when
		// it is not (the first drawing, a resize).
		function placeThumb(b) {
			thumb.hidden = !b;
			if (!b) return;
			const ms = motionMs(box);
			thumb.style.transitionDuration = ms + 'ms';
			thumb.style.width = b.offsetWidth + 'px';
			thumb.style.transform = `translateX(${b.offsetLeft}px)`;
		}
		function jump(fn) {
			track.classList.remove('is-animated');
			fn();
			void thumb.offsetWidth;   // apply it before the transition comes back
			track.classList.add('is-animated');
		}

		function build() {
			track.replaceChildren(thumb, ...[...select.options].map((o, i) => {
				const b = node('button', 'tdc-select-option');
				b.type = 'button';
				b.tabIndex = -1;
				b.textContent = o.textContent;
				b.dataset.index = i;
				b.disabled = o.disabled;
				b.addEventListener('pointerdown', (e) => { if (e.button === 0) e.preventDefault(); });
				return b;
			}));
			sync();
		}

		function sync() {
			const at = select.selectedIndex;
			let chosen = null;
			for (const b of track.querySelectorAll('.tdc-select-option')) {
				const on = Number(b.dataset.index) === at;
				b.classList.toggle('is-selected', on);
				b.setAttribute('aria-pressed', String(on));
				if (on) chosen = b;
			}
			const open = enabled();
			drawIcon(prev, open.some((i) => i < at), (g) => prev.classList.toggle('is-end', g));
			drawIcon(next, open.some((i) => i > at), (g) => next.classList.toggle('is-end', g));
			box.classList.toggle('is-disabled', select.disabled);
			placeThumb(chosen);
			reveal(chosen, track.classList.contains('is-animated'));
		}

		// Centre the chosen option in the pill (never scrolling the page), so
		// the soft edges of a sideways scroll fade its neighbours, not it.
		function reveal(b, smooth) {
			if (!b || track.scrollWidth <= track.clientWidth) return;
			const left = b.offsetLeft - (track.clientWidth - b.offsetWidth) / 2;
			track.scrollTo({ left, behavior: smooth && motionMs(box) ? 'smooth' : 'auto' });
		}

		function choose(i) {
			if (select.disabled || i === undefined || i < 0 || i === select.selectedIndex) return;
			const b = chosenButton();
			if (select.id && b) {
				thumbWas.set(select.id, { x: b.offsetLeft, w: b.offsetWidth, scroll: track.scrollLeft, at: Date.now() });
			}
			select.selectedIndex = i;   // syncs
			announce(select);
		}

		track.addEventListener('click', (e) => {
			const b = e.target.closest('.tdc-select-option');
			if (b && !b.disabled) choose(Number(b.dataset.index));
		});
		prev.addEventListener('click', () => choose(enabled().filter((i) => i < select.selectedIndex).pop()));
		next.addEventListener('click', () => choose(enabled().find((i) => i > select.selectedIndex)));

		select.addEventListener('change', sync);
		select.addEventListener('input', sync);
		onPropSet(select, ['value', 'selectedIndex'], sync);
		new MutationObserver(build).observe(select, {
			childList: true, subtree: true, characterData: true,
			attributes: true, attributeFilter: ['disabled', 'label']
		});

		// First drawing. If this select was just changed in a control the
		// page has since rebuilt, start from where its pill was and slide.
		const was = select.id ? thumbWas.get(select.id) : null;
		if (select.id) thumbWas.delete(select.id);
		if (was && Date.now() - was.at < THUMB_MEMORY) {
			jump(() => {
				build();
				thumb.style.width = was.w + 'px';
				thumb.style.transform = `translateX(${was.x}px)`;
				track.scrollLeft = was.scroll;
			});
			sync();
		} else {
			jump(build);
		}

		// A folded group draws its controls at no width, and fonts and the
		// window change size: put the pill back without sliding.
		// Only a real change of width: the observer also reports once on
		// starting, which would cut a slide short.
		let width = track.clientWidth;
		new ResizeObserver(() => {
			if (track.clientWidth === width) return;
			width = track.clientWidth;
			jump(() => {
				const b = chosenButton();
				placeThumb(b);
				reveal(b, false);
			});
		}).observe(track);
	}, 'select:not([multiple]):not(table select)');

	// ─── Start ───
	// Wait for every script at the end of the page, so a kind defined in a
	// later file is known before anything is called unknown.
	function start() {
		started = true;
		for (const scope of document.querySelectorAll('[data-controls]')) {
			for (const name of scope.dataset.controls.split(/\s+/)) {
				if (!kinds[name]) TDC.error(AREA, `data-controls names "${name}", which is not a control.`, scope);
			}
		}
		scan(document);
		new MutationObserver((changes) => {
			for (const c of changes) for (const n of c.addedNodes) {
				if (n.nodeType === 1) scan(n);
			}
		}).observe(document.body, { childList: true, subtree: true });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();

	return { define, scan };
})();
