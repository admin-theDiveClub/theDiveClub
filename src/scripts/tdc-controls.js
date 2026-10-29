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
//            data-stepper="across" lays it on its side, chevrons left and
//            right, small, for a row of numbers (a fixture's tables); it is
//            not moved beside a label.
//   date     <input type="date">. Year, month and day as three steppers, with
//            a calendar button and a clear button to their left. Pressing a
//            chevron on an empty date starts it at today; emptying any part,
//            or the clear button, clears the date. Label and hint to its right.
//   select   <select>. The options side by side in a horizontal pill, the
//            chosen one in a green pill of its own that slides to the next.
//            Click an option to choose it, or use the arrows at either end.
//            The real select keeps the keyboard: Tab reaches it and the arrow
//            keys change it.
//   tri      <select> of three options, data-control="tri" only. A switch
//            with three stops: left, middle (an empty ring) and right (a
//            tick). Click an end to choose it, the same end again or the
//            middle for the middle. data-icon picks the ring's icon (a tick
//            by default) and data-tone its colour (warning). The team card's
//            lag (a cue ball, warning) and win.
//   select   data-tone="warning" colours its pill and outline in the warning
//            colour (the match page's break event).
//   slide    <input type="range">, data-control="slide" only. A pill with a
//            cream knob at the max end holding an undo arrow, and the words
//            from data-label. Drag the knob all the way to the min end and the
//            input changes to min (input and change fire, as for any range);
//            let go early and it springs back. The page acts on a change to
//            min; the control then returns to max by itself, quietly. The
//            keyboard keeps the real range. The match page's slide to undo.

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
	// key: which field's chevron this is (see drawIcon), when the field has an id.
	function chevron(cls, label, key) {
		const b = node('button', 'tdc-chevron ' + cls);
		b.type = 'button';
		if (key) b.dataset.iconKey = key;
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
	//
	// Only what the person's own input changes moves (UV, 24 Oct). A page
	// that rebuilds its form after every change makes every control again,
	// so an icon is remembered by its field (data-icon-key, from the field's
	// id): a rebuilt one that was showing before shows at once, and draws in
	// only if it was not.
	const iconSeen = new Map();   // key -> shown
	function drawIcon(el, show, gone) {
		if (el.tdcShown === show) return;
		const first = el.tdcShown === undefined;
		el.tdcShown = show;
		clearTimeout(el.tdcGoing);
		const strokes = [...el.querySelectorAll('svg [pathLength]')];
		for (const s of strokes) s.getAnimations().forEach((a) => a.cancel());
		const key = el.dataset.iconKey;
		const before = key ? iconSeen.get(key) : undefined;
		// Only a control on the page says what its field's icons show; one the
		// page has thrown away must not tell its replacement otherwise.
		if (key && el.isConnected) iconSeen.set(key, show);
		if (first && (!show || before === true)) {
			gone(!show);
			for (const s of strokes) s.style.strokeDashoffset = show ? '0' : '100';
			return;
		}

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

	// ─── The dots on a control ───
	// Every control gets the site's one set of dots when it is changed (UV,
	// 28 Oct, replacing 26 Oct's "no call, no dots"): they come to it and
	// stay for as long as the save its change made and the page's re-read
	// take (TDC.writer, else any call TDCNet counted), and never less than
	// DOTS_MIN, so a change that saves nothing still gets the show: the dots
	// barely arrive before they trace it. scripts/dots.js, docs/systems/dots.md.
	const DOTS_MIN = 200;   // ms
	const dotsOn = () => typeof TDCDots !== 'undefined';
	// Where the page's saves stood as a change began, so that once the page
	// has had its turn it is known whether the change saved.
	const saveMark = () => ({
		writes: TDC.writes || 0,
		net: typeof TDCNet !== 'undefined' ? TDCNet.started : 0
	});
	// What the dots wait for, asked once the page's handler has run: the save
	// made since mark, and DOTS_MIN. A failed save rejects, so it is not traced.
	function saveSince(mark) {
		const w = TDC.writeSince ? TDC.writeSince(mark.writes) : null;
		let call = null, status = null;
		if (w) { call = w.saved; status = w.status; }
		else if (typeof TDCNet !== 'undefined' && TDCNet.started > mark.net) call = TDCNet.quiet();
		const least = new Promise((r) => setTimeout(r, DOTS_MIN));
		return { call: call ? Promise.all([call, least]) : least, status };
	}
	// After a change: once the page has had its turn, the dots serve target
	// (or, if the page has drawn it again, what opts.follow finds).
	function serveAfter(target, mark, opts = {}) {
		if (!dotsOn()) return;
		setTimeout(() => {
			const el = target.isConnected ? target : (opts.follow && opts.follow());
			if (!el || !el.isConnected) return;
			const s = saveSince(mark);
			TDCDots.serve(el, s.call, Object.assign({ status: s.status }, opts));
		}, 0);
	}
	// While a finger is on a control (a chevron held, the slide dragged): the
	// dots come at once, the control stays lit (data-dots-hold), and they stay
	// until it lets go and then for whatever that saved. Returns the release.
	function serveHeld(target, mark, opts = {}) {
		if (!dotsOn()) return () => {};
		let letGo;
		const held = new Promise((r) => { letGo = r; });
		target.dataset.dotsHold = '';
		const call = held.then(() => new Promise((r) => setTimeout(r, 0))).then(() => saveSince(mark).call);
		TDCDots.serve(target, call, opts);
		return () => { delete target.dataset.dotsHold; letGo(); };
	}

	// The dots' options for a control known by its field: a page that draws
	// its form again after a change (the match page's settings, the ruleset
	// pages) throws the control away, so the dots follow the field's id to
	// the new one (wrap: the control round it); with no id they let it go
	// quietly rather than call it a failure.
	function followField(field, wrap, opts) {
		const id = field.id;
		return Object.assign({
			follow: id ? () => { const f = document.getElementById(id); return f && f.closest(wrap); } : null,
			leaves: true
		}, opts);
	}

	// ─── Stepper ───
	// The dots trace the number in the pill's field.
	const STEPPER_TRACE = { trace: 'number', ink: '.tdc-stepper-window > input' };
	const HOLD_DELAY = 400;   // ms before a held chevron starts repeating
	const HOLD_EVERY = 80;    // ms between repeats

	define('stepper', (input) => {
		if (input.type !== 'number') {
			TDC.error(AREA, 'a stepper must be an <input type="number">.', input);
			return;
		}

		// The window clips the number, so a changing one can roll through it.
		// data-stepper="across" lays it on its side (UV, 24 Oct): down on the
		// left, up on the right, small enough for a row of them (a fixture's
		// table numbers). It stays where the page put it, not beside a label.
		const across = input.dataset.stepper === 'across';
		const pill = node('span', across ? 'tdc-stepper is-across' : 'tdc-stepper');
		const up = chevron('tdc-stepper-up', 'Increase', input.id && input.id + ':up');
		const down = chevron('tdc-stepper-down', 'Decrease', input.id && input.id + ':down');
		const view = node('span', 'tdc-stepper-window');
		input.replaceWith(pill);
		view.append(input);
		if (across) pill.append(down, view, up);
		else { pill.append(up, view, down); besideLabel(pill); }

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
			// On its side it rolls sideways: up comes in from the right.
			const axis = across ? 'translateX' : 'translateY';
			input.animate([{ transform: `${axis}(${dir * 100}%)` }, { transform: `${axis}(0)` }], timing);
			old.animate([{ transform: `${axis}(0)` }, { transform: `${axis}(${-dir * 100}%)` }], timing)
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
		//
		// The press ends wherever the finger comes up. A page that rebuilds
		// its form after the step (the ruleset pages) replaces this stepper
		// under the finger, so the release lands on the new one; listening
		// only here once left the old one stepping, unseen, to its limit,
		// where it told the new one its chevron had gone (24 Oct). And a
		// stepper that is no longer on the page stops.
		//
		// The dots come at the press and stay on the pill until the finger
		// lets go (UV, 28 Oct), the number lit meanwhile so it can be read as
		// it counts; then they trace the number it stopped on.
		let timer = null;
		let held = null;   // the release of the dots, while a chevron is down
		const stop = () => {
			clearTimeout(timer); timer = null;
			if (held) { const letGo = held; held = null; letGo(); }
		};
		for (const [b, dir] of [[up, 1], [down, -1]]) {
			b.addEventListener('pointerdown', (e) => {
				if (e.button !== 0) return;
				if (!held && !input.disabled && !input.readOnly) held = serveHeld(pill, saveMark(), followField(input, '.tdc-stepper', STEPPER_TRACE));
				step(dir);
				const repeat = () => {
					if (!b.tdcShown || !pill.isConnected) return stop();
					step(dir);
					timer = setTimeout(repeat, HOLD_EVERY);
				};
				timer = setTimeout(repeat, HOLD_DELAY);
				window.addEventListener('pointerup', stop, { once: true });
				window.addEventListener('pointercancel', stop, { once: true });
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

		// A number typed, or stepped from the keyboard: the dots once it is
		// committed. Held chevrons have them already (above).
		let mark = null;
		pill.addEventListener('change', (e) => { if (e.target === input && !held) mark = saveMark(); }, true);
		pill.addEventListener('change', (e) => {
			if (e.target !== input || held || !mark) return;
			serveAfter(pill, mark, followField(input, '.tdc-stepper', STEPPER_TRACE));
			mark = null;
		});
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
		if (real.id) {
			pick.dataset.iconKey = real.id + ':pick';
			clear.dataset.iconKey = real.id + ':clear';
		}
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
		let composing = false;
		for (const type of ['input', 'change']) {
			box.addEventListener(type, (e) => {
				if (e.target === real) { show(); return; }   // the browser's calendar
				e.stopPropagation();
				if (type === 'change' && parts.includes(e.target)) {
					composing = true;
					try { compose(e.target); } finally { composing = false; }
				}
			});
		}

		// The dots: a part's stepper has them for a number changed there; the
		// calendar and the clear button give them to the whole date.
		let mark = null;
		box.addEventListener('change', (e) => { if (e.target === real && !composing) mark = saveMark(); }, true);
		box.addEventListener('change', (e) => {
			if (e.target !== real || composing || !mark) return;
			serveAfter(box, mark, followField(real, '.tdc-date', { trace: 'none' }));
			mark = null;
		});

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
	// switch is for a setting: an empty ring off, a tick on (UV, 26 Oct; a
	// cross off before), its knob a ring that slides to its side. The ring is
	// for a tick against a person or a thing (paid, here tonight, picked): a
	// tick or empty. Every checkbox is a switch
	// unless it is made with data-control="ring".
	//
	// The checkbox stays the real one, invisible but focusable: Space and its
	// label still toggle it, and pages read .checked and hear change as
	// before. When a change makes the page save (TDC.writer, or any call the
	// site counts, TDCNet), the site's one set of dots serves the control
	// (scripts/dots.js, the dots' step 7, 26 Oct): they come to its ring and
	// stay for as long as the save and the page's re-read take, then the knob
	// slides and the new icon fades in as they trace it, so what is shown is
	// what the database kept. Several saves out at once: the dots go to the
	// latest, and the others come back without them. A change that saves
	// nothing (a box in a form) gets them too, for DOTS_MIN (UV, 28 Oct).
	//
	// A click is never ignored (UV, 24 Oct): it toggles the box and the page
	// saves it, queued behind the others (TDC.writer); served again while the
	// dots are on it, they wait for every call, and show what the box holds
	// at the end.
	//
	// Pages draw themselves again after every write, which makes a new
	// checkbox. While the dots are on a control (it carries data-dots) the
	// control itself is handed on to the new checkbox, by the box's id or its
	// data-action with the row's data-entrant / data-player, so the element
	// the dots serve stays on the page through the rebuild.
	const liveChecks = new Map();
	const checkKey = (box) => box.id ? '#' + box.id
		: ['action', 'entrant', 'player', 'box', 'frame'].map((k) => box.dataset[k] || '').join('|');
	const served = (wrap) => !!wrap.dataset.dots;

	// After a change, once the page's own handler has run: the dots serve the
	// control with the save it made (saveSince: never less than DOTS_MIN),
	// and show() puts what the box holds on the page when that is back
	// (drawn: no dots, so the icon draws itself).
	// The control was registered as live the moment it changed (changing),
	// before the page's handler ran: a page that draws its form again inside
	// that handler (league settings) hands it to the new checkbox, so it is
	// still on the page here.
	function serveChange(c, live, mark, show) {
		c.changing = false;
		if (!dotsOn() || !c.wrap.isConnected) { show(true); if (live.get(c.key) === c && !served(c.wrap)) live.delete(c.key); return; }
		const { call, status } = saveSince(mark);
		c.ring.say('loading');
		live.set(c.key, c);
		TDCDots.serve(c.wrap, call, { reveal: () => show(false), status });
		// Forgotten once the dots have left it.
		const forget = () => {
			if (served(c.wrap)) { setTimeout(forget, 500); return; }
			if (live.get(c.key) === c) live.delete(c.key);
		};
		Promise.resolve(call).catch(() => {}).then(() => setTimeout(forget, 500));
	}

	// The knob gliding to p (0 to 1), eased, in --control-reveal; at once
	// when the device asks for less motion.
	function glide(c, to) {
		cancelAnimationFrame(c.glideFrame);
		const from = c.knobAt, ms = timeMs(c.wrap, '--control-reveal'), t0 = performance.now();
		if (!ms || Math.abs(to - from) < 0.001) { c.place(to); return; }
		const step = (now) => {
			const u = Math.min(1, (now - t0) / ms), e = u * u * (3 - 2 * u);
			c.place(from + (to - from) * e);
			if (u < 1) c.glideFrame = requestAnimationFrame(step);
		};
		c.glideFrame = requestAnimationFrame(step);
	}

	function checkControl(box, kind) {
		if (box.type !== 'checkbox') {
			TDC.error(AREA, `a ${kind} must be an <input type="checkbox">.`, box);
			return;
		}
		const key = checkKey(box);
		const was = liveChecks.get(key);
		const c = was && was.kind === kind && (served(was.wrap) || was.changing) ? was : makeCheck(kind, box);
		box.replaceWith(c.wrap);
		c.bind(box, key);
		besideLabel(c.wrap);
	}

	function makeCheck(kind, first) {
		const isSwitch = kind === 'switch';
		// Off is an empty ring for both (UV, 26 Oct: a switch was a cross off).
		const ON = 'tick';
		const OFF = 'empty';
		const c = { kind, box: null, key: null, knobAt: 0 };
		const state = () => c.box.checked ? ON : OFF;

		const wrap = c.wrap = node('span', isSwitch ? 'tdc-switch' : 'tdc-check');
		wrap.tdcCheck = c;
		const face = node('span', 'tdc-ring');
		face.innerHTML = TDCRing.svg();
		if (isSwitch) {
			const knob = node('span', 'tdc-switch-knob');
			knob.append(face);
			wrap.append(node('span', 'tdc-switch-track'), knob);
		} else {
			wrap.append(face);
		}

		// The knob and the track follow --p, 0 off to 1 on (status.css).
		c.place = (p) => { c.knobAt = p; wrap.style.setProperty('--p', p.toFixed(3)); };

		c.ring = new TDCRing.RingStatus(face, {
			icons: [ON],
			labels: isSwitch ? { tick: 'On', empty: 'Off', loading: 'Saving' } : { tick: 'Ticked', empty: 'Not ticked', loading: 'Saving' },
			initial: first.checked ? ON : OFF
		});
		if (isSwitch) c.place(first.checked ? 1 : 0);

		// What the box holds, on the page: the knob to its side, the icon
		// shown (drawn in, when the dots are not there to trace it).
		const show = (drawn) => {
			if (drawn) c.ring.drawTo(state()); else c.ring.setState(state());
			if (isSwitch) glide(c, c.box.checked ? 1 : 0);
		};

		let mark = null;
		wrap.addEventListener('change', (e) => {
			if (e.target !== c.box) return;
			mark = saveMark();
			c.changing = true;
			liveChecks.set(c.key, c);
		}, true);
		wrap.addEventListener('change', (e) => {
			if (e.target !== c.box) return;
			const m = mark;
			setTimeout(() => serveChange(c, liveChecks, m, show), 0);
		});

		// Newly shown on the page (a setting that brings it into view, a
		// folding section opening): its icon draws in. No call, so no dots
		// (UV, 26 Oct).
		c.appear = () => { if (!served(wrap)) c.ring.drawIn(); };

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
			// Set from a script (a page filling its form): show it, no
			// animation. Not while a save is out: the dots show the answer.
			onPropSet(box, ['checked'], () => {
				if (wrap.dataset.dots === 'busy' || c.box !== box) return;
				c.ring.setState(state());
				if (isSwitch) c.place(box.checked ? 1 : 0);
			});
			new MutationObserver(() => wrap.classList.toggle('is-disabled', box.disabled))
				.observe(box, { attributes: true, attributeFilter: ['disabled'] });
		};
		return c;
	}

	define('switch', (box) => checkControl(box, 'switch'), 'input[type="checkbox"]');
	define('ring', (box) => checkControl(box, 'ring'), null);

	// ─── Three-way switch ───
	// A <select> of exactly three options: left, middle and right, in that
	// order (UV, 24 Oct: the team card's lag and win, home · nobody · away).
	// The knob is a ring, empty in the middle and ticked at either end, on a
	// track a little longer than a switch's so the three stops read as three.
	// Clicking the left or right third chooses that end, or the middle again
	// when it is already there; clicking the middle chooses the middle.
	//
	// The select stays the real one, invisible but focusable, so the arrow
	// keys still move it and pages hear change as before. Saves are served by
	// the dots exactly as a switch's are: the knob slides once the save and
	// the re-read are back, and the control is handed on through the page's
	// redraw by the select's id or its data-action and data-frame while the
	// dots are on it. Opt in with data-control="tri"; nothing becomes one
	// automatically.
	const liveTris = new Map();
	const triKey = (sel) => sel.id ? '#' + sel.id
		: ['action', 'frame', 'player'].map((k) => sel.dataset[k] || '').join('|');

	function triControl(sel) {
		if (sel.tagName !== 'SELECT' || sel.options.length !== 3) {
			TDC.error(AREA, 'a three-way switch must be a <select> with three options.', sel);
			return;
		}
		const key = triKey(sel);
		const was = liveTris.get(key);
		const c = was && (served(was.wrap) || was.changing) ? was : makeTri(sel);
		sel.replaceWith(c.wrap);
		c.bind(sel, key);
	}

	function makeTri(first) {
		const c = { sel: null, key: null, own: false, knobAt: 0.5 };
		// data-icon names the ring's icon at either end (a tick unless it says),
		// data-tone its colour (the brand colour unless it says, e.g. warning).
		const ICON = first.dataset.icon && TDCRing.ICONS[first.dataset.icon] ? first.dataset.icon : 'tick';
		const at = () => (c.sel.selectedIndex < 0 ? 1 : c.sel.selectedIndex) / 2;   // 0 left, 0.5 middle, 1 right
		const MID = 'dot';   // the middle: a small grey dot, so it is traced like the ends
		const state = () => at() === 0.5 ? MID : ICON;
		const chosen = () => c.sel.options[c.sel.selectedIndex] ? c.sel.options[c.sel.selectedIndex].text : 'Chosen';

		const wrap = c.wrap = node('span', 'tdc-tri');
		wrap.tdcTri = c;
		if (first.dataset.tone) wrap.dataset.tone = first.dataset.tone;
		const stops = node('span', 'tdc-tri-stops');
		stops.append(node('i'), node('i'), node('i'));
		const face = node('span', 'tdc-ring');
		face.innerHTML = TDCRing.svg();
		const knob = node('span', 'tdc-tri-knob');
		knob.append(face);
		wrap.append(node('span', 'tdc-tri-track'), stops, knob);

		// --p runs 0 (left) to 1 (right); --lit is how far from the middle,
		// which lights the track as the knob reaches an end (status.css).
		c.place = (p) => {
			c.knobAt = p;
			wrap.style.setProperty('--p', p.toFixed(3));
			wrap.style.setProperty('--lit', (Math.abs(p - 0.5) * 2).toFixed(3));
			// The stop the knob rests on is hidden, so the middle reads blank.
			wrap.dataset.at = p === 0 ? 'left' : p === 1 ? 'right' : p === 0.5 ? 'middle' : '';
		};

		const startAt = (first.selectedIndex < 0 ? 1 : first.selectedIndex) / 2;
		c.ring = new TDCRing.RingStatus(face, {
			icons: [ICON, MID],
			labels: { [ICON]: first.options[first.selectedIndex] ? first.options[first.selectedIndex].text : 'Chosen', [MID]: 'Nobody', loading: 'Saving' },
			initial: startAt === 0.5 ? MID : ICON
		});
		c.place(startAt);

		const show = (drawn) => {
			c.ring.labels[ICON] = chosen();
			if (drawn) c.ring.drawTo(state()); else c.ring.setState(state());
			glide(c, at());
		};

		let mark = null;
		wrap.addEventListener('change', (e) => {
			if (e.target !== c.sel) return;
			mark = saveMark();
			c.changing = true;
			liveTris.set(c.key, c);
		}, true);
		wrap.addEventListener('change', (e) => {
			if (e.target !== c.sel) return;
			const m = mark;
			setTimeout(() => serveChange(c, liveTris, m, show), 0);
		});

		// Which third was clicked decides it. Never ignored, served or not.
		wrap.addEventListener('click', (e) => {
			if (c.sel.disabled) return;
			const r = wrap.getBoundingClientRect();
			const third = Math.max(0, Math.min(2, Math.floor(3 * (e.clientX - r.left) / r.width)));
			const now = c.sel.selectedIndex < 0 ? 1 : c.sel.selectedIndex;
			const next = third === 1 || third === now ? 1 : third;
			if (next === now) return;
			c.own = true;
			c.sel.selectedIndex = next;
			c.own = false;
			announce(c.sel);
		});

		c.bind = (sel, key) => {
			if (c.sel && c.sel !== sel) c.sel.remove();   // the one the page threw away
			c.sel = sel;
			c.key = key;
			sel.classList.add('tdc-tri-native');
			wrap.append(sel);
			wrap.classList.toggle('is-disabled', sel.disabled);
			// Set from a script: show it, no animation. Not while a save is
			// out: the dots show the answer.
			onPropSet(sel, ['value', 'selectedIndex'], () => {
				if (c.own || wrap.dataset.dots === 'busy' || c.sel !== sel) return;
				c.ring.setState(state());
				c.place(at());
			});
			new MutationObserver(() => wrap.classList.toggle('is-disabled', sel.disabled))
				.observe(sel, { attributes: true, attributeFilter: ['disabled'] });
		};
		return c;
	}

	define('tri', triControl, null);

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
		const prev = chevron('tdc-select-prev', 'Previous option', select.id && select.id + ':prev');
		const next = chevron('tdc-select-next', 'Next option', select.id && select.id + ':next');
		const track = node('span', 'tdc-select-track scroll-x');
		// The green pill is its own layer under the options, so it can slide
		// over and change width to the next one (UV, 24 Oct).
		const thumb = node('span', 'tdc-select-thumb');
		thumb.setAttribute('aria-hidden', 'true');
		if (select.dataset.tone) box.dataset.tone = select.dataset.tone;
		select.replaceWith(box);
		box.append(prev, track, next, select);
		markField(box, 'field-centred');

		const enabled = () => [...select.options].map((o, i) => o.disabled ? -1 : i).filter((i) => i >= 0);
		const chosenButton = () => track.querySelector('.tdc-select-option.is-selected');

		// data-icon names a ring icon shown in the chosen option, before its
		// words (UV, 28 Oct: the match page's break event wears the cue ball).
		// Its ring is not drawn; the dots trace the icon when it is chosen.
		let icon = null;
		const iconName = select.dataset.icon;
		if (iconName && TDCRing.ICONS[iconName]) {
			icon = node('span', 'tdc-ring tdc-select-icon');
			icon.setAttribute('aria-hidden', 'true');
			icon.innerHTML = TDCRing.svg();
			try { new TDCRing.RingStatus(icon, { icons: [iconName], initial: iconName }).live.remove(); }
			catch (err) { TDC.error(AREA, 'the pill\'s icon could not be drawn: ' + iconName, err); icon = null; }
		} else if (iconName) {
			TDC.error(AREA, `a pill asks for an icon called "${iconName}", which there is not.`, select);
		}

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
			// Before the pill is measured: the icon widens the option.
			if (icon) { if (chosen) chosen.prepend(icon); else icon.remove(); }
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

		// The dots, on a choice made here (a click, an arrow, the keyboard):
		// they trace the green pill's outline under the chosen option, then it
		// fills; or the icon in it, when it has one. A page that draws the pill
		// again after the choice (the match page's break event) gives a new
		// one, found by the select's id.
		const dotsTarget = (root) => root.querySelector(icon ? '.tdc-select-icon' : '.tdc-select-thumb');
		const follow = () => {
			const s = select.id && document.getElementById(select.id);
			const b = s && s.closest('.tdc-select');
			return b && dotsTarget(b);
		};
		let mark = null;
		box.addEventListener('change', (e) => { if (e.target === select) mark = saveMark(); }, true);
		box.addEventListener('change', (e) => {
			if (e.target !== select || !mark) return;
			const target = dotsTarget(box);
			if (target) serveAfter(target, mark, icon ? { follow, leaves: true } : { trace: 'tab', follow, leaves: true });
			mark = null;
		});
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

	// ─── Slide ───
	// Slide to confirm: the match page's undo (docs/design/match-score-input.md
	// §5). A deliberate drag rather than a tap, so a stray thumb cannot take a
	// frame away. The real range stays inside for the keyboard; the knob's
	// place is --at (1 at max, 0 at min), which the stylesheet turns into a
	// position, so nothing is measured but the drag itself.
	define('slide', (input) => {
		if (input.type !== 'range') {
			TDC.error(AREA, 'a slide control must be an <input type="range">.', input);
			return;
		}
		const min = () => Number(input.min || 0);
		const max = () => Number(input.max || 100);
		input.value = max();

		const box = node('span', 'tdc-slide');
		// data-tone="error": the match page's undo, all in red (UV, 28 Oct).
		if (input.dataset.tone) box.dataset.tone = input.dataset.tone;
		const label = node('span', 'tdc-slide-label');
		label.setAttribute('aria-hidden', 'true');
		const knob = node('span', 'tdc-slide-knob');
		knob.setAttribute('aria-hidden', 'true');
		knob.innerHTML = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
			+ TDCRing.ICONS.undo.strokes.map((d) => `<path d="${d}"/>`).join('') + '</svg>';
		input.replaceWith(box);
		box.append(label, knob, input);

		const setAt = (at) => box.style.setProperty('--at', Math.max(0, Math.min(1, at)));
		const atOf = () => (Number(input.value) - min()) / ((max() - min()) || 1);
		function sync() {
			const text = input.dataset.label || input.getAttribute('aria-label') || '';
			label.textContent = text;
			// Said as it reads; set only when it differs, or the observer below
			// would hear its own change for ever.
			if (input.dataset.label && input.getAttribute('aria-label') !== text) input.setAttribute('aria-label', text);
			box.classList.toggle('is-disabled', input.disabled);
			setAt(atOf());
		}
		// Back to the max end, quietly: it has done its job, or was let go early.
		function home() {
			input.value = max();
			setAt(1);
		}

		// The dots ride the knob while it is dragged (UV, 28 Oct), and stay
		// for whatever letting go set off (the match page's undo), at least
		// DOTS_MIN; let go early, they race round it and leave.
		let held = null;
		const letGo = () => { if (held) { const r = held; held = null; r(); } };

		let drag = null;   // { id, x, at, travel } while a finger is on the knob
		knob.addEventListener('pointerdown', (e) => {
			if (input.disabled || e.button !== 0) return;
			e.preventDefault();
			if (!held) held = serveHeld(knob, saveMark(), { trace: 'none' });
			knob.setPointerCapture(e.pointerId);
			const pad = parseFloat(getComputedStyle(box).paddingLeft) || 0;
			drag = { id: e.pointerId, x: e.clientX, at: atOf(), travel: Math.max(1, box.clientWidth - knob.offsetWidth - 2 * pad) };
			box.classList.add('is-dragging');
		});
		knob.addEventListener('pointermove', (e) => {
			if (!drag || e.pointerId !== drag.id) return;
			setAt(drag.at + (e.clientX - drag.x) / drag.travel);
		});
		function release(e) {
			if (!drag || e.pointerId !== drag.id) return;
			const at = drag.at + (e.clientX - drag.x) / drag.travel;
			drag = null;
			box.classList.remove('is-dragging');
			// A few pixels short of the end still counts: a thumb rarely lands
			// on the last one.
			if (e.type === 'pointerup' && at <= 0.04) {
				setAt(0);
				input.value = min();
				announce(input);
				setTimeout(home, timeMs(box, '--control-motion') + 250);
			} else {
				home();
			}
			letGo();
		}
		knob.addEventListener('pointerup', release);
		knob.addEventListener('pointercancel', release);

		// The keyboard moves the real range in steps; reaching min is the same
		// act as a drag to the end. Leaving it part way puts it back.
		input.addEventListener('input', () => { if (!drag) setAt(atOf()); });
		input.addEventListener('change', () => {
			if (drag) return;
			if (Number(input.value) <= min()) setTimeout(home, timeMs(box, '--control-motion') + 250);
		});
		input.addEventListener('blur', () => { if (Number(input.value) > min()) home(); });

		new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['data-label', 'aria-label', 'disabled'] });
		sync();
	}, null);

	// ─── Fields come and go smoothly ───
	// A page that rebuilds its form after a change (the ruleset on the new
	// league, league settings and new tournament pages, the match panel)
	// shows some fields and hides others. Rather than jump, a field or
	// section that is new fades in as its space opens, its icons drawing in,
	// and one that has gone fades out as its space closes (UV, 24 Oct). Done
	// here rather than in each page: the form is looked at as a change
	// starts, again once the page has rebuilt it in that same moment, and the
	// two are compared, a field known by its control's id, a folding section
	// by its data-group and a row of settings (TDCMatchDef.layout) by its
	// data-row within its section. A field that merely stays does not move.
	const ITEMS = '.field, details.set-group, .field-row';
	let before = null;   // the form as the change started, until the page has had its turn
	const itemKey = (el) => {
		if (el.matches('details')) return el.dataset.group ? 'group:' + el.dataset.group : null;
		if (el.matches('.field-row')) {
			const group = el.closest('details[data-group]');
			return 'row:' + (group ? group.dataset.group + ':' : '') + el.dataset.row;
		}
		const control = el.querySelector('[id]');
		return control ? '#' + control.id : null;
	};
	const keyedItem = (el) => el && el.matches(ITEMS) && !el.classList.contains('tdc-gone') && itemKey(el);
	function sibling(el, dir) {
		let s = el[dir];
		while (s && !keyedItem(s)) s = s[dir];
		return s ? itemKey(s) : null;
	}
	function snapshot() {
		const map = new Map();
		for (const el of document.querySelectorAll(ITEMS)) {
			if (el.closest('table, .tdc-gone')) continue;
			const key = itemKey(el);
			if (!key) continue;
			const parent = el.parentElement.closest(ITEMS);
			map.set(key, {
				el,
				parent: parent ? itemKey(parent) : null,
				prev: sibling(el, 'previousElementSibling'),
				next: sibling(el, 'nextElementSibling'),
				container: el.parentElement
			});
		}
		return map;
	}

	// Open (or, with out, close) an item's space while it fades.
	function grow(el, ms, out) {
		const cs = getComputedStyle(el);
		const open = {
			height: el.offsetHeight + 'px', opacity: 1,
			marginTop: cs.marginTop, marginBottom: cs.marginBottom,
			paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom
		};
		const shut = { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' };
		el.style.overflow = 'hidden';
		const a = el.animate(out ? [open, shut] : [shut, open], { duration: ms, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
		return a.finished.catch(() => {}).then(() => { el.style.overflow = ''; });
	}

	// Returns the form as it is now, to compare the next batch against.
	function morph(old) {
		const now = snapshot();
		const ms = timeMs(document.body, '--control-reveal');
		for (const [key, it] of now) {
			if (old.has(key)) continue;
			if (it.parent && !old.has(it.parent)) continue;   // its section is new and comes in whole
			if (ms) grow(it.el, ms, false);
			// A switch or ring draws its icon in as the demo does; steppers and
			// pills already draw theirs, being new to the page.
			for (const w of it.el.querySelectorAll('.tdc-switch, .tdc-check')) if (w.tdcCheck) w.tdcCheck.appear();
		}
		// Gone ones go back where they were, each after the field above it
		// (or after that field's own fading copy, when it went too), to fade.
		const fading = new Map();
		for (const [key, it] of old) {
			if (now.has(key)) continue;
			if (it.parent && !now.has(it.parent)) continue;   // goes with its section
			const el = it.el;                                // thrown away by the page, still whole
			if (el.isConnected) continue;
			// Its icons are forgotten, so if it comes back they draw in again.
			for (const i of el.querySelectorAll('[data-icon-key]')) iconSeen.delete(i.dataset.iconKey);
			if (!ms) continue;
			const above = it.prev && ((now.get(it.prev) || {}).el || fading.get(it.prev));
			const below = it.next && (now.get(it.next) || {}).el;
			if (above) above.after(el);
			else if (below) below.before(el);
			else if (it.container.isConnected) it.container.append(el);
			else continue;
			fading.set(key, el);
			el.classList.add('tdc-gone');
			el.setAttribute('aria-hidden', 'true');
			el.inert = true;
			grow(el, ms, true).then(() => el.remove());
		}
		return now;
	}

	// ─── Folding sections open and close smoothly ───
	// Opening a folded group (details.set-group) by hand grows it while its
	// settings fade in, their icons drawing in as a newly shown field's do;
	// closing fades them out as it shrinks (UV, 24 Oct). The details stays
	// the real one: open is set before it grows and cleared once it has shut,
	// so the pages' toggle listeners hear what they always did. A second tap
	// mid-way turns it round from where it is.
	function redraw(icon) {
		if (!icon.tdcShown) return;
		const ms = timeMs(icon, '--ring-draw');
		const strokes = [...icon.querySelectorAll('svg [pathLength]')];
		const slice = ms / Math.max(1, strokes.length);
		strokes.forEach((s, i) => {
			s.getAnimations().forEach((a) => a.cancel());
			if (ms) s.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }],
				{ duration: slice, delay: i * slice, easing: 'ease-out', fill: 'backwards' });
		});
	}

	// Opening, the contents are not shown until they are ready to use (UV,
	// 28 Oct): the group grows with its contents hidden and the site's dots
	// on it (a fake ring from its shorter side, so it widens as the group
	// opens), and only once it has opened, DOTS_MIN has passed and anything
	// the opening set loading (a page's toggle listener reading the
	// database) is back do the contents fade in, their icons drawing in.
	const READY_LOOK = 60;   // ms after opening to see whether it set a call going
	const SHOW_ANYWAY = 2500;   // ms after it is ready: shown even if the dots never came
	function fold(box) {
		const ms = timeMs(box, '--control-reveal');
		const opening = !box.open || box.classList.contains('is-closing');
		const summary = box.querySelector(':scope > summary');
		const inside = [...box.children].filter((c) => c !== summary);
		// Where it is now, mid-fold or not, before the last fold lets go.
		const from = box.offsetHeight;
		const faded = inside.map((c) => box.open ? getComputedStyle(c).opacity : 0);
		for (const a of box.tdcFold || []) a.cancel();
		box.tdcFold = null;
		const turn = box.tdcTurn = {};   // this fold; a later tap makes another
		box.classList.toggle('is-closing', !opening);
		if (!ms) { box.open = opening; box.classList.remove('is-closing'); return; }

		const net = typeof TDCNet !== 'undefined' ? TDCNet.started : 0;
		box.open = true;
		const cs = getComputedStyle(box);
		const shut = summary.getBoundingClientRect().bottom - box.getBoundingClientRect().top
			+ parseFloat(getComputedStyle(summary).marginBottom)
			+ parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
		const to = opening ? box.offsetHeight : shut;
		const ease = { duration: ms, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' };
		box.style.overflow = 'hidden';
		const size = box.animate([{ height: from + 'px' }, { height: to + 'px' }], ease);
		// Opening, the contents go (or stay) out of sight while it grows;
		// closing, they fade out as it shrinks.
		const hide = inside.map((c, i) =>
			c.animate([{ opacity: faded[i] }, { opacity: 0 }], Object.assign({ fill: 'forwards' }, ease, opening ? { duration: Math.min(ms, 120) } : {})));
		box.tdcFold = [size, ...hide];

		if (opening) {
			// Ready: open, DOTS_MIN gone, and whatever the opening set loading back.
			const least = new Promise((r) => setTimeout(r, DOTS_MIN));
			const loaded = new Promise((r) => setTimeout(r, READY_LOOK)).then(() =>
				typeof TDCNet !== 'undefined' && TDCNet.started > net ? TDCNet.quiet() : null);
			const ready = Promise.all([size.finished.catch(() => {}), least, loaded]);
			let done = false;
			const show = () => {
				if (done || box.tdcTurn !== turn) return;   // shown already, or closed again meanwhile
				done = true;
				delete box.dataset.dotsHold;
				for (const a of hide) a.cancel();
				const shown = inside.map((c) => c.animate([{ opacity: 0 }, { opacity: 1 }], Object.assign({ fill: 'backwards' }, ease)));
				box.tdcFold = shown;
				Promise.all(shown.map((a) => a.finished)).then(() => { if (box.tdcTurn === turn) box.tdcFold = null; }, () => {});
				for (const i of box.querySelectorAll('[data-icon-key]')) redraw(i);
				for (const w of box.querySelectorAll('.tdc-switch, .tdc-check')) if (w.tdcCheck) w.tdcCheck.appear();
			};
			// The dots show the contents when they have reached the group and it
			// is ready, as for any target. Without them, as soon as it is ready;
			// and if they never get to it (a call that hung is shown "as it
			// was", with no reveal), a moment later all the same.
			if (dotsOn()) {
				box.dataset.dotsHold = '';   // the group itself is not dimmed; its contents are hidden
				TDCDots.serve(box, ready, { trace: 'none', fake: true, reveal: show });
				ready.then(() => setTimeout(show, SHOW_ANYWAY));
			} else {
				ready.then(show);
			}
		} else {
			delete box.dataset.dotsHold;
		}
		size.finished.then(() => {
			box.style.overflow = '';
			size.cancel();
			if (!opening) {
				for (const a of hide) a.cancel();
				box.tdcFold = null;
				box.classList.remove('is-closing');
				box.open = false;
			}
		}, () => {});   // cancelled: a later tap has taken over
	}

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

		// The form as each change starts (capture: before the page hears it),
		// kept until the page has had its turn. The browser hands over DOM
		// changes between one listener and the next, so a control's own small
		// change can arrive before the page's rebuild: each batch is compared
		// with the form as the batch before left it.
		document.addEventListener('change', () => {
			before = snapshot();
			setTimeout(() => { before = null; }, 0);
		}, true);

		document.addEventListener('click', (e) => {
			const summary = e.target.closest('details.set-group > summary');
			if (!summary) return;
			e.preventDefault();
			fold(summary.parentElement);
		});

		// Buttons (UV, 28 Oct): every button on the site gets the dots when it
		// is pressed, for the save it set off and at least DOTS_MIN, a ring
		// icon's traced and anything else raced round (a fake ring). Done here
		// once for every page. Left out: a control's own parts (they serve the
		// control), the nav (nav.js serves its own), and anything the page
		// has already given the dots (data-dots, e.g. the fixtures' buttons).
		// A page that redraws after the press throws the button away: let go
		// quietly (leaves).
		let pressMark = null;
		const BUTTON = 'button, a.btn, [role="button"]';
		const NOT_BUTTON = '.tdc-stepper, .tdc-select, .tdc-date, .tdc-slide, .tdc-switch, .tdc-check, .tdc-tri, .site-nav, summary';
		const pressed = (e) => {
			const b = e.target.closest && e.target.closest(BUTTON);
			return b && !b.closest(NOT_BUTTON) && !b.disabled && !b.matches('[aria-disabled="true"]') ? b : null;
		};
		// The page may give the dots to something else itself (the match page's
		// special wins serve the score): then the button leaves them there.
		const servedCount = () => (dotsOn() ? TDCDots.state.busy : 0);
		document.addEventListener('click', (e) => {
			if (pressed(e)) pressMark = Object.assign(saveMark(), { busy: servedCount() });
		}, true);
		document.addEventListener('click', (e) => {
			const b = pressed(e);
			if (!b || !pressMark) return;
			const mark = pressMark;
			pressMark = null;
			setTimeout(() => {
				// Hidden by its own press (a panel's Close): nowhere to go.
				const q = b.isConnected && b.getBoundingClientRect();
				if (b.dataset.dots || !q || (!q.width && !q.height) || servedCount() > mark.busy) return;
				const s = saveSince(mark);
				if (dotsOn()) TDCDots.serve(b, s.call, { status: s.status, leaves: true });
			}, 0);
		});

		new MutationObserver((changes) => {
			for (const c of changes) for (const n of c.addedNodes) {
				if (n.nodeType === 1) scan(n);
			}
			if (before) before = morph(before);
		}).observe(document.body, { childList: true, subtree: true });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();

	return { define, scan };
})();
