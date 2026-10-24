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
	const CHEVRON = '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M3 11.5 12 3l9 8.5"/></svg>';
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

	// How long a control's movement takes (--control-motion), in ms; 0 when
	// the device asks for less motion.
	const lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
	function motionMs(el) {
		if (lessMotion.matches) return 0;
		const v = getComputedStyle(el).getPropertyValue('--control-motion').trim();
		const n = parseFloat(v);
		if (isNaN(n)) return 0;
		return v.endsWith('ms') ? n : n * 1000;
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
			up.hidden = !isNaN(v) && v >= max();
			down.hidden = !isNaN(v) && v <= min();
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
					if (b.hidden) return stop();
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
		const tool = (cls, label) => {
			const b = node('button', cls);
			b.type = 'button';
			b.setAttribute('aria-label', `${name}: ${label}`);
			return b;
		};
		const pick = tool('tdc-date-pick', 'choose from a calendar');
		const clear = tool('tdc-date-clear', 'clear the date');
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
			clear.classList.toggle('is-empty', !m);
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
	}, 'input[type="date"]:not(table input)');

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
			prev.classList.toggle('is-end', !open.some((i) => i < at));
			next.classList.toggle('is-end', !open.some((i) => i > at));
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
