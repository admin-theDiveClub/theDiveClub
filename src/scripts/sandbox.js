/* UI sandbox (/sandbox/). A scratch page: no data layer, no sign-in.
   Edits the palette and the logo per theme, shows the effect on a mock-up of
   the site, and saves the result into variables.css. Nothing else.

   How a value travels:
     file text  ->  parsed values (per theme)
     a change   ->  a draft (per theme), applied to <html> as an inline
                    custom property, so the whole page follows it at once
     Save       ->  the drafts are patched into variables.css in place
   The page never edits a stylesheet it has loaded. Undo or publish is Fork's job. */
(function () {
	'use strict';

	var STORE_KEY = 'tdc.sandbox.theme';
	var CSS_URL = '/stylesheets/variables.css';
	var INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';
	var XLINK_NS = 'http://www.w3.org/1999/xlink';
	var root = document.documentElement;
	var $ = function (id) { return document.getElementById(id); };

	/* ── Errors are shown, never swallowed ─────────────────────────── */
	function fail(message, err, targetId) {
		console.error('[Sandbox] ' + message, err || '');
		var el = $(targetId || 'sb-status');
		if (el) {
			el.textContent = 'TDC (Error): ' + message;
			el.className = 'status error';
		}
	}
	function clearFail(targetId) {
		var el = $(targetId || 'sb-status');
		if (el) { el.textContent = ''; el.className = 'status'; }
	}
	/* The save line appears twice on the page (palette and artwork). */
	function saveStatus(message, kind, err) {
		if (kind === 'error') console.error('[Sandbox] ' + message, err || '');
		document.querySelectorAll('.sb-save-status').forEach(function (el) {
			el.textContent = (kind === 'error' ? 'TDC (Error): ' : '') + message;
			el.className = 'status sb-save-status' + (kind ? ' ' + kind : '');
		});
	}

	/* ── What is specified ─────────────────────────────────────────────
	   Only the values that are chosen by hand. Everything else (the hover
	   wash, the panel shadow, the scrim colour) is built from these in
	   variables.css. kind: colour | rgba (colour + opacity) | alpha | px (a blur in pixels)
	   | size (a slider from min to max in steps of step, written with unit).
	   A colour the file builds from another (var(--text-primary)) shows the
	   colour it comes to, and becomes a value of its own once it is changed. */
	var TOKENS = [
		['Brand', [
			{ name: '--color-primary',    label: 'Primary',        kind: 'colour', use: 'Buttons, links, field labels, focus lines, the winning score' },
			{ name: '--color-on-primary', label: 'On primary',     kind: 'colour', use: 'Text on a primary-coloured button' }
		]],
		['Backgrounds', [
			{ name: '--bg-base',          label: 'Page',           kind: 'colour', use: 'Behind everything' },
			{ name: '--bg-surface',       label: 'Surface',        kind: 'rgba',   use: 'Nav bar, menu, cards, tiles and panels' },
			{ name: '--surface-blur',    label: 'Surface blur',   kind: 'px',     use: 'How much the page blurs behind a surface (the nav, menus, cards, tiles and panels)' }
		]],
		['Text', [
			{ name: '--text-primary',     label: 'Text',           kind: 'colour', use: 'Headings, body text, the hover wash' },
			{ name: '--text-muted',       label: 'Muted text',     kind: 'colour', use: 'Hints, detail lines, placeholders' }
		]],
		['Lines', [
			{ name: '--border-color',     label: 'Border',         kind: 'colour', use: 'Field lines, card and tile edges, dividers' },
			{ name: '--scrollbar-size',   label: 'Scrollbar',      kind: 'size', unit: 'px', min: 2, max: 16, step: 1, use: 'How thick every scrollbar is' }
		]],
		['Controls', [
			{ name: '--control-line',     label: 'Control line',   kind: 'colour', use: 'The outline and chevrons of a stepper, a date and a select pill, and the calendar icon on every date field. Follows Text until chosen' },
			{ name: '--control-border',   label: 'Outline',        kind: 'size', unit: 'px',  min: 0,    max: 6,   step: 0.5,  use: 'How thick a control\'s outline is' },
			{ name: '--chevron-size',     label: 'Chevron',        kind: 'size', unit: 'rem', min: 0.75, max: 3,   step: 0.05, use: 'How wide a stepper\'s chevrons are; a date\'s and a select\'s are drawn smaller from it' },
			{ name: '--chevron-stroke',   label: 'Chevron weight', kind: 'size', unit: '',    min: 1,    max: 5,   step: 0.25, use: 'How heavy a chevron\'s line is' },
			{ name: '--stepper-width',    label: 'Stepper width',  kind: 'size', unit: 'rem', min: 2,    max: 6,   step: 0.05, use: 'How wide a number stepper is' },
			{ name: '--stepper-number',   label: 'Stepper number', kind: 'size', unit: 'rem', min: 1,    max: 3,   step: 0.05, use: 'How big the number in a stepper is' },
			{ name: '--stepper-across-number', label: 'Across number', kind: 'size', unit: 'rem', min: 0.7, max: 2, step: 0.05, use: 'How big the number in a stepper on its side is (a fixture\'s table numbers)' },
			{ name: '--date-year-width',  label: 'Date year',      kind: 'size', unit: 'rem', min: 2.5,  max: 5,   step: 0.05, use: 'How wide a date\'s year pill is' },
			{ name: '--date-part-width',  label: 'Date month, day', kind: 'size', unit: 'rem', min: 1.8, max: 4,   step: 0.05, use: 'How wide a date\'s month and day pills are' },
			{ name: '--date-number',      label: 'Date numbers',   kind: 'size', unit: 'rem', min: 0.8,  max: 2,   step: 0.05, use: 'How big the numbers in a date are' },
			{ name: '--select-text',      label: 'Select options', kind: 'size', unit: 'rem', min: 0.6,  max: 1.2, step: 0.05, use: 'How big an option in a select pill is' },
			{ name: '--control-motion',   label: 'Motion',         kind: 'size', unit: 's',   min: 0,    max: 0.8, step: 0.02, use: 'How long a number takes to roll and the green pill to slide. 0 for none' },
			{ name: '--control-reveal',   label: 'Reveal',         kind: 'size', unit: 's',   min: 0,    max: 1,   step: 0.05, use: 'How long a field takes to fade in or out, its space opening or closing, when a setting shows or hides it. 0 for none' },
			{ name: '--slide-height',     label: 'Slide height',   kind: 'size', unit: 'rem', min: 2,    max: 5,   step: 0.05, use: 'How tall a slide to confirm is (the match page\'s slide to undo)' },
			{ name: '--slide-knob',       label: 'Slide knob',     kind: 'size', unit: 'rem', min: 1.5,  max: 4.5, step: 0.05, use: 'How big the cream knob of a slide is' },
			{ name: '--slide-text',       label: 'Slide words',    kind: 'size', unit: 'rem', min: 0.6,  max: 1.4, step: 0.05, use: 'How big the words in a slide are' }
		]],
		['Ring and switch', [
			{ name: '--ring-size',        label: 'Ring',           kind: 'size', unit: 'rem', min: 1.25, max: 4,   step: 0.05, use: 'How big a ring is: a tick against a person or a thing (paid, here tonight)' },
			{ name: '--ring-size-table',  label: 'Ring in a table', kind: 'size', unit: 'rem', min: 1,   max: 3,   step: 0.05, use: 'The same ring in a table row' },
			{ name: '--switch-height',    label: 'Switch height',  kind: 'size', unit: 'rem', min: 1.25, max: 4,   step: 0.05, use: 'How tall a switch is; its knob is a ring of 0.8 of this' },
			{ name: '--switch-width',     label: 'Switch width',   kind: 'size', unit: 'rem', min: 2.5,  max: 7,   step: 0.05, use: 'How wide a switch is; the knob travels this less the height' },
			{ name: '--nav-slide',        label: 'Nav slide',        kind: 'size', unit: 's', min: 0, max: 1.5, step: 0.05, use: 'How long the nav bar takes to slide away on a scroll down and back on a scroll up. 0 for none' },
			{ name: '--nav-ring-size',    label: 'Nav icons',        kind: 'size', unit: 'rem', min: 1.25, max: 3, step: 0.05, use: 'How big the ring icons on the nav bar are: menu, reload, the bell and the account (the picture takes the same size)' },
			{ name: '--tri-height',       label: 'Three-way height', kind: 'size', unit: 'rem', min: 1,  max: 3,   step: 0.05, use: 'How tall a three-way switch is (left, nobody, right: the team card\'s L and W)' },
			{ name: '--tri-width',        label: 'Three-way width',  kind: 'size', unit: 'rem', min: 3,  max: 8,   step: 0.05, use: 'How wide a three-way switch is; longer than a switch so the three stops read as three' },
			{ name: '--ring-draw',        label: 'Draw',           kind: 'size', unit: 's',   min: 0.2,  max: 2,   step: 0.1,  use: 'How long an icon takes to draw, stroke by stroke: the ring\'s tick and cross, and the chevrons, calendar and cross of the other controls' },
		]],
		['Match score cards', [
			{ name: '--score-band',       label: 'Card bands',     kind: 'colour', use: 'The solid header and footer of a player\'s card on the match page' },
			{ name: '--score-depth-alpha', label: 'Card depth',    kind: 'alpha',  use: 'How dark the bands\' shadow on the score is, and the score\'s dark inner edge' },
			{ name: '--score-drop-alpha', label: 'Card shadow',    kind: 'alpha',  use: 'How dark the soft shadow under a whole card is' },
			{ name: '--score-stretch',    label: 'Score stretch',  kind: 'size', unit: '',   min: 1,   max: 2,    step: 0.05, use: 'How much taller than its natural shape a score digit is drawn (1 for none)' },
			{ name: '--match-glow-size',  label: 'Glow reach',     kind: 'size', unit: 'px', min: 300, max: 2000, step: 10,   use: 'How far the green glow behind the match page reaches from its centre' },
			{ name: '--match-glow-rise',  label: 'Glow height',    kind: 'size', unit: 'px', min: 0,   max: 1600, step: 10,   use: 'How far above the top of the screen the glow\'s centre is; the closer to the reach, the less of it shows' },
			{ name: '--timeline-line',    label: 'Timeline line',  kind: 'colour', use: 'The grey line through every win on the frame history\'s timeline (landscape)' }
		]],
		['Dots', [
			{ name: '--dots-ring-margin', label: 'Ring margin',    kind: 'size', unit: 'px', min: 0,    max: 24,   step: 1,     use: 'A fake ring\'s gap beyond an element\'s shorter side (anything without a ring of its own: buttons, numbers, tabs). Watch it on /sandbox/dots/' },
			{ name: '--dots-fake-stroke', label: 'Fake ring line', kind: 'size', unit: 'px', min: 0.5,  max: 4,    step: 0.25,  use: 'How big the dots are on a fake ring round an element with no border' },
			{ name: '--dots-draw',        label: 'Draw speed',     kind: 'size', unit: '',   min: 0.25, max: 3,    step: 0.05,  use: 'How fast the dots trace a result (an icon, a number, a tab), times the prototype\'s' },
			{ name: '--dots-fade',        label: 'Fade speed',     kind: 'size', unit: '',   min: 0.25, max: 3,    step: 0.05,  use: 'How fast the ring race ends and the dots fade, times the prototype\'s' },
			{ name: '--dots-blend',       label: 'Hand-over',      kind: 'size', unit: 's',  min: 0.1,  max: 1.5,  step: 0.05,  use: 'How long the dots take to slide from one animation into the next: waiting into tracing, tracing into the ring race' },
			{ name: '--dots-busy-dim',    label: 'Busy dim',       kind: 'size', unit: '',   min: 0,    max: 0.6,  step: 0.05,  use: 'How faint a target is while it waits for its call' },
			{ name: '--dots-busy-fill',   label: 'Busy fill',      kind: 'size', unit: '',   min: 0,    max: 1,    step: 0.05,  use: 'How faint a filled button or a dropdown\'s green pill is while it waits and while the dots trace it, so its words stay readable' },
			{ name: '--dots-dim',         label: 'Dim time',       kind: 'size', unit: 's',  min: 0,    max: 1,    step: 0.05,  use: 'How long a target takes to go faint when it is tapped' },
			{ name: '--dots-reveal',      label: 'Reveal time',    kind: 'size', unit: 's',  min: 0,    max: 1,    step: 0.05,  use: 'How long a target takes to come back once the dots have traced it (spec: about 0.25 s)' },
			{ name: '--dots-pulse',       label: 'Calm pulse',     kind: 'size', unit: 's',  min: 0.8,  max: 4,    step: 0.1,   use: 'Reduced motion: how long one breath of a tapped target takes while it waits (no dots fly then)' },
			{ name: '--dots-pulse-peak',  label: 'Pulse peak',     kind: 'size', unit: '',   min: 0.2,  max: 1,    step: 0.05,  use: 'Reduced motion: how bright the waiting target (or a ring icon\'s ring) gets at the top of each breath' }
		]],
		['States', [
			{ name: '--color-success',    label: 'Success',        kind: 'colour', use: 'Success messages, Paid badge, staff tile glow' },
			{ name: '--color-warning',    label: 'Warning',        kind: 'colour', use: 'Warning badge, offline indicator' },
			{ name: '--color-error',      label: 'Error',          kind: 'colour', use: 'Error messages, danger button' },
			{ name: '--color-owner',      label: 'Owner',          kind: 'colour', use: 'Owner tile glow' },
			{ name: '--color-edited',     label: 'Edited',         kind: 'colour', use: 'Changed after a captain signed: the ring of a team card switch' }
		]],
		['Depth', [
			{ name: '--shadow-alpha',     label: 'Shadow strength', kind: 'alpha', use: 'How dark the shadow under floating panels is (black at this opacity)' },
			{ name: '--pic-shadow-alpha', label: 'Picture shadow', kind: 'alpha', use: 'How dark the shadow under every picture circle is: profile pictures (the nav\'s too), league and team pictures' },
			{ name: '--scrim-alpha',      label: 'Dim strength',    kind: 'alpha', use: 'How dark the page goes behind a slide-over panel (black at this opacity)' }
		]]
	];
	var SPEC = {};
	TOKENS.forEach(function (g) { g[1].forEach(function (t) { SPEC[t.name] = t; }); });

	/* The logo's variables. Saved with the palette, per theme. */
	var LOGO = [
		'--logo-shadow-alpha', '--logo-primary', '--logo-light', '--logo-blur-alpha',
		'--logo-blur', '--logo-grad-start', '--logo-grad-mid', '--logo-grad-end', '--logo-grad-offset'
	];
	var BASE_BLUR = 12.5; /* the blur % the file was saved at, per the brief */

	/* ── Colour helpers ────────────────────────────────────────────── */
	function pad2(n) { return ('0' + Math.round(n).toString(16)).slice(-2); }
	function toHex(r, g, b) { return '#' + pad2(r) + pad2(g) + pad2(b); }
	function rgbOf(hex) {
		return [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
	}
	function validHex(v) {
		var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
		if (!m) return null;
		var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
		return '#' + h.toLowerCase();
	}
	/* "#rrggbb", "#rgb", "rgb(...)" and "rgba(...)" are the forms variables.css holds. */
	function parseColour(value) {
		var hex = validHex(value);
		if (hex) return { hex: hex, alpha: null };
		var m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value.trim());
		if (m) return { hex: toHex(+m[1], +m[2], +m[3]), alpha: m[4] === undefined ? null : m[4] };
		throw new Error('Cannot read "' + value + '" as a colour');
	}
	function rgbaString(hex, alpha) {
		var c = rgbOf(hex);
		return 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', ' + alpha + ')';
	}
	function norm(v) { return String(v).toLowerCase().replace(/\s+/g, ''); }
	function trimNum(v, digits) { return String(Number(Number(v).toFixed(digits))); }

	/* ── Reading and patching variables.css ────────────────────────────
	   The two blocks that matter are  :root  (dark)  and  [data-theme="light"].
	   Comments are blanked (same length) before searching, so a brace or a
	   token name inside a comment is never mistaken for code. */
	function blank(text) {
		return text.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n\r]/g, ' '); });
	}
	function blockRange(text, theme) {
		var clean = blank(text);
		var open = theme === 'light' ? /\[data-theme\s*=\s*"light"\]\s*\{/ : /(^|[\s}])\:root\s*\{/;
		var m = open.exec(clean);
		if (!m) throw new Error('variables.css has no ' + (theme === 'light' ? '[data-theme="light"]' : ':root') + ' block');
		var start = m.index + m[0].length;
		var end = clean.indexOf('}', start);
		if (end < 0) throw new Error('The ' + theme + ' block in variables.css is not closed');
		return [start, end];
	}
	function declarations(text, range) {
		var clean = blank(text.slice(range[0], range[1]));
		var re = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]*?)\s*;/g;
		var out = [], m;
		while ((m = re.exec(clean))) {
			var valueStart = range[0] + m.index + m[0].indexOf(m[2], m[1].length);
			out.push({ name: m[1], value: m[2], valueStart: valueStart, valueEnd: valueStart + m[2].length });
		}
		return out;
	}
	function parseFile(text) {
		var out = { dark: {}, light: {} };
		['dark', 'light'].forEach(function (theme) {
			declarations(text, blockRange(text, theme)).forEach(function (d) { out[theme][d.name] = d.value; });
		});
		return out;
	}
	/* Sets each name to its value inside one theme's block. A value that is
	   there is replaced in place (its trailing comment stays); one that is not
	   is added at the end of the block, in the block's own indentation. */
	function patchTheme(text, theme, changes) {
		var eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
		Object.keys(changes).forEach(function (name) {
			var range = blockRange(text, theme);
			var found = declarations(text, range).filter(function (d) { return d.name === name; })[0];
			if (found) {
				text = text.slice(0, found.valueStart) + changes[name] + text.slice(found.valueEnd);
				return;
			}
			var block = text.slice(range[0], range[1]);
			var tail = /\s*$/.exec(block)[0];
			var body = block.slice(0, block.length - tail.length);
			var indent = (/\n([ \t]+)--/.exec(blank(block)) || [0, '\t'])[1];
			var hasLogo = declarations(text, range).some(function (d) { return d.name.indexOf('--logo-') === 0; });
			var add = eol;
			if (name.indexOf('--logo-') === 0 && !hasLogo) add += eol + indent + '/* Logo. Set from the artwork section of /sandbox/. */' + eol;
			add += indent + name + ': ' + changes[name] + ';';
			text = text.slice(0, range[0]) + body + add + tail + text.slice(range[1]);
		});
		return text;
	}

	/* ── State ─────────────────────────────────────────────────────────
	   fileText   the text of variables.css as last read or written
	   parsed     its values per theme
	   drafts     changes not yet saved, per theme */
	var theme = 'dark';
	var fileText = '';
	var parsed = { dark: {}, light: {} };
	var drafts = { dark: {}, light: {} };
	var logoDefaults = {};
	var inlineSet = [];

	function fileValue(t, name) {
		if (parsed[t][name] !== undefined) return parsed[t][name];
		return t === 'light' ? parsed.dark[name] : undefined;
	}
	function effective(t, name) {
		if (drafts[t][name] !== undefined) return drafts[t][name];
		return fileValue(t, name);
	}
	function effectiveOrDefault(t, name) {
		var v = effective(t, name);
		return v !== undefined ? v : logoDefaults[name];
	}

	function applyInline() {
		inlineSet.forEach(function (n) { root.style.removeProperty(n); });
		inlineSet = [];
		var set = function (n, v) { root.style.setProperty(n, v); inlineSet.push(n); };
		Object.keys(drafts[theme]).forEach(function (n) { set(n, drafts[theme][n]); });
		/* A logo variable the file does not have yet is supplied from the SVG,
		   so the logo draws; it only becomes a saved value if it is changed. */
		LOGO.forEach(function (n) {
			if (effective(theme, n) === undefined && logoDefaults[n] !== undefined) set(n, logoDefaults[n]);
		});
	}

	function setDraft(name, value) {
		var base = fileValue(theme, name);
		if (base !== undefined && norm(base) === norm(value)) delete drafts[theme][name];
		else drafts[theme][name] = value;
		applyInline();
		update();
	}

	function draftCount(t) { return Object.keys(drafts[t]).length; }

	/* ── Theme ─────────────────────────────────────────────────────── */
	function setTheme(name, remember) {
		theme = name === 'light' ? 'light' : 'dark';
		root.setAttribute('data-theme', theme === 'light' ? 'light' : '');
		if (remember) {
			try { localStorage.setItem(STORE_KEY, theme); } catch (e) { /* storage can be blocked; the theme still applies */ }
		}
		document.querySelectorAll('[data-theme-set]').forEach(function (b) {
			b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === theme));
		});
		$('sb-edit-theme').textContent = theme === 'light' ? 'Light' : 'Dark';
		applyInline();
		syncControls();
		logo.refresh();
		update();
	}
	function savedTheme() {
		try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
	}

	/* ── Reading what the page is showing (for contrast) ───────────── */
	var probe = document.createElement('span');
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
	document.body.appendChild(probe);

	function colourOf(name) {
		probe.style.color = '';
		probe.style.color = 'var(' + name + ')';
		var computed = getComputedStyle(probe).color;
		var n = (computed.match(/[\d.]+(?:e-?\d+)?/g) || []).map(Number);
		if (n.length < 3) throw new Error('Could not read ' + name + ' as a colour (' + computed + ')');
		if (/^color\(/.test(computed)) n = n.slice(0, 3).map(function (v) { return v * 255; }).concat(n.slice(3));
		return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
	}
	function over(fg, bg) {
		var a = fg[3];
		return [0, 1, 2].map(function (i) { return fg[i] * a + bg[i] * (1 - a); }).concat([1]);
	}
	function luminance(c) {
		var l = c.slice(0, 3).map(function (v) {
			v = v / 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
	}
	function ratio(a, b) {
		var la = luminance(a), lb = luminance(b);
		return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
	}

	var PAIRS = [
		['Text on page',       '--text-primary',     '--bg-base'],
		['Muted text on page', '--text-muted',       '--bg-base'],
		['Primary on page',    '--color-primary',    '--bg-base'],
		['Text on button',     '--color-on-primary', '--color-primary'],
		['Text on surface',    '--text-primary',     '--bg-surface'],
		['Muted on surface',   '--text-muted',       '--bg-surface'],
		['Success on page',    '--color-success',    '--bg-base'],
		['Warning on page',    '--color-warning',    '--bg-base'],
		['Error on page',      '--color-error',      '--bg-base'],
		['Owner on page',      '--color-owner',      '--bg-base'],
		['Edited on page',     '--color-edited',     '--bg-base'],
		['Control line on page', '--control-line',   '--bg-base']
	];
	function rating(r) {
		if (r >= 7)   return ['AAA', 'paid'];
		if (r >= 4.5) return ['Text', 'paid'];
		if (r >= 3)   return ['UI only', 'warn'];
		return ['Fails', 'disputed'];
	}

	function renderContrast() {
		var body = document.querySelector('#sb-contrast tbody');
		body.innerHTML = '';
		var base = colourOf('--bg-base');
		PAIRS.forEach(function (pair) {
			var fg = over(colourOf(pair[1]), base);
			var bg = over(colourOf(pair[2]), base);
			var r = ratio(fg, bg);
			var grade = rating(r);

			var tr = document.createElement('tr');

			var name = document.createElement('td');
			name.textContent = pair[0];
			var sub = document.createElement('span');
			sub.className = 'sub';
			sub.textContent = pair[1] + ' on ' + pair[2];
			name.appendChild(sub);

			var sampleCell = document.createElement('td');
			var sample = document.createElement('span');
			sample.className = 'sb-sample';
			sample.style.setProperty('--sb-fg', 'var(' + pair[1] + ')');
			sample.style.setProperty('--sb-bg', 'var(' + pair[2] + ')');
			sample.textContent = 'Aa';
			sampleCell.appendChild(sample);

			var num = document.createElement('td');
			num.className = 'num';
			num.textContent = r.toFixed(1);

			var gradeCell = document.createElement('td');
			var badge = document.createElement('span');
			badge.className = 'badge ' + grade[1];
			badge.textContent = grade[0];
			gradeCell.appendChild(badge);

			tr.appendChild(name);
			tr.appendChild(sampleCell);
			tr.appendChild(num);
			tr.appendChild(gradeCell);
			body.appendChild(tr);
		});
	}

	/* ── Palette controls ──────────────────────────────────────────────
	   Built once. Each row writes only its own token, and only when it is
	   touched, so a value left alone is never rounded by a slider. */
	var rows = {}; /* name -> { row, picker, hex, alpha, alphaOut, edited } */
	var mock = $('sb-mock');
	var caption = $('sb-mock-caption');
	var CAPTION_DEFAULT = 'Hover a colour on the left, or any part of this mock-up, to see what uses what.';

	function usesCount(name) {
		return mock.querySelectorAll('[data-uses~="' + name + '"]').length;
	}

	function highlight(name) {
		mock.querySelectorAll('.sb-hit').forEach(function (el) { el.classList.remove('sb-hit'); });
		if (!name) { caption.textContent = CAPTION_DEFAULT; return; }
		var hits = mock.querySelectorAll('[data-uses~="' + name + '"]');
		hits.forEach(function (el) { el.classList.add('sb-hit'); });
		var labels = [];
		hits.forEach(function (el) {
			var l = el.getAttribute('data-label');
			if (l && labels.indexOf(l) < 0) labels.push(l);
		});
		caption.textContent = SPEC[name].label + ': ' + (hits.length ? 'used by ' + labels.join(', ') + '.' : 'not shown in this mock-up.');
	}

	function buildControls() {
		var host = $('sb-palette-controls');
		host.innerHTML = '';
		TOKENS.forEach(function (group) {
			var title = document.createElement('h3');
			title.className = 'sb-group-title';
			title.textContent = group[0];
			host.appendChild(title);

			group[1].forEach(function (spec) {
				var row = document.createElement('div');
				row.className = 'sb-row';
				row.setAttribute('data-token', spec.name);

				var head = document.createElement('div');
				head.className = 'sb-row-head';
				var label = document.createElement('span');
				label.className = 'sb-row-name';
				label.textContent = spec.label;
				var key = document.createElement('span');
				key.className = 'sb-key';
				key.textContent = spec.name;
				var edited = document.createElement('span');
				edited.className = 'sb-edited';
				edited.textContent = 'edited';
				edited.hidden = true;
				head.appendChild(label);
				head.appendChild(key);
				head.appendChild(edited);
				row.appendChild(head);

				var use = document.createElement('div');
				use.className = 'hint';
				use.textContent = spec.use;
				row.appendChild(use);

				var ctl = { row: row, edited: edited };

				if (spec.kind !== 'alpha' && spec.kind !== 'size') {
					var wrap = document.createElement('div');
					wrap.className = 'sb-colour';
					var picker = document.createElement('input');
					picker.type = 'color';
					picker.setAttribute('aria-label', spec.label + ' colour picker');
					var hex = document.createElement('input');
					hex.type = 'text';
					hex.maxLength = 7;
					hex.spellcheck = false;
					hex.setAttribute('aria-label', spec.label + ' as hex');
					wrap.appendChild(picker);
					wrap.appendChild(hex);
					row.appendChild(wrap);
					ctl.picker = picker;
					ctl.hex = hex;

					picker.addEventListener('input', function () {
						hex.value = picker.value;
						writeColour(spec, ctl);
					});
					hex.addEventListener('change', function () {
						var v = validHex(hex.value.charAt(0) === '#' ? hex.value : '#' + hex.value);
						if (!v) {
							fail('"' + hex.value + '" is not a hex colour, like #2b9fa6', null, 'sb-status');
							hex.value = picker.value;
							return;
						}
						clearFail('sb-status');
						picker.value = v;
						hex.value = v;
						writeColour(spec, ctl);
					});
				}

				if (spec.kind !== 'colour') {
					var line = document.createElement('div');
					line.className = 'sb-alpha';
					var alphaLabel = document.createElement('label');
					alphaLabel.textContent = spec.kind === 'rgba' ? 'Opacity' : (spec.kind === 'px' ? 'Blur' : (spec.kind === 'size' ? 'Size' : 'Opacity of the black'));
					var out = document.createElement('output');
					out.className = 'sb-val';
					alphaLabel.appendChild(out);
					var range = document.createElement('input');
					range.type = 'range';
					if (spec.kind === 'size') {
						range.min = String(spec.min);
						range.max = String(spec.max);
						range.step = String(spec.step);
						range.setAttribute('aria-label', spec.label);
					} else {
						range.min = '0';
						range.max = spec.kind === 'px' ? '40' : '1';
						range.step = spec.kind === 'px' ? '1' : '0.01';
						range.setAttribute('aria-label', spec.label + ' opacity');
					}
					line.appendChild(alphaLabel);
					line.appendChild(range);
					row.appendChild(line);
					ctl.alpha = range;
					ctl.alphaOut = out;

					range.addEventListener('input', function () {
						if (spec.kind === 'rgba') writeColour(spec, ctl);
						else if (spec.kind === 'px') setDraft(spec.name, range.value + 'px');
						else if (spec.kind === 'size') {
							var v = trimNum(range.value, 3) + spec.unit;
							out.textContent = v;
							setDraft(spec.name, v);
						}
						else setDraft(spec.name, trimNum(range.value, 2));
					});
				}

				row.addEventListener('mouseenter', function () { highlight(spec.name); });
				row.addEventListener('mouseleave', function () { highlight(null); });
				row.addEventListener('focusin', function () { highlight(spec.name); });
				row.addEventListener('focusout', function () { highlight(null); });

				rows[spec.name] = ctl;
				host.appendChild(row);
			});
		});
	}

	/* The colour and opacity of a surface are two controls but one value. */
	function writeColour(spec, ctl) {
		if (spec.kind === 'rgba') {
			var current = parseColour(effective(theme, spec.name));
			var alpha = ctl.alphaTouched ? trimNum(ctl.alpha.value, 2) : (current.alpha === null ? '1' : current.alpha);
			ctl.alphaTouched = false;
			setDraft(spec.name, rgbaString(ctl.picker.value, alpha));
		} else {
			setDraft(spec.name, ctl.picker.value);
		}
	}

	/* A colour the file builds from another (var(--text-primary)): the colour
	   the page comes to, read off the page. null for a plain value. */
	function builtColour(name, value) {
		if (!/^var\(/.test(String(value).trim())) return null;
		var c = colourOf(name);
		return { hex: toHex(c[0], c[1], c[2]), alpha: null };
	}

	/* Show the current theme's values in the controls. */
	function syncControls() {
		Object.keys(rows).forEach(function (name) {
			var spec = SPEC[name], ctl = rows[name];
			var value = effective(theme, name);
			if (value === undefined) {
				fail('variables.css has no value for ' + name + ' in the ' + theme + ' theme', null, 'sb-status');
				return;
			}
			try {
				if (spec.kind === 'px' || spec.kind === 'size') {
					ctl.alpha.value = parseFloat(value);
					ctl.alphaOut.textContent = value;
				} else if (spec.kind === 'alpha') {
					ctl.alpha.value = value;
					ctl.alphaOut.textContent = trimNum(value, 3);
				} else {
					var c = builtColour(name, value) || parseColour(value);
					ctl.picker.value = c.hex;
					ctl.hex.value = c.hex;
					if (spec.kind === 'rgba') {
						var a = c.alpha === null ? '1' : c.alpha;
						ctl.alpha.value = a;
						ctl.alphaOut.textContent = trimNum(a, 3);
					}
				}
			} catch (e) {
				fail(name + ': ' + e.message, e, 'sb-status');
			}
		});
	}
	/* Moving an opacity slider on a surface marks it, so a colour change
	   alone keeps the file's own opacity digits. */
	function wireAlphaTouch() {
		var ctl = rows['--bg-surface'];
		if (ctl && ctl.alpha) {
			ctl.alpha.addEventListener('pointerdown', function () { ctl.alphaTouched = true; });
			ctl.alpha.addEventListener('keydown', function () { ctl.alphaTouched = true; });
		}
	}

	/* Refresh everything that reports on the current state. */
	function update() {
		Object.keys(rows).forEach(function (name) {
			var ctl = rows[name];
			var changed = drafts[theme][name] !== undefined;
			ctl.edited.hidden = !changed;
			if (ctl.alpha && SPEC[name].kind === 'rgba') {
				var c = parseColour(effective(theme, name));
				ctl.alphaOut.textContent = trimNum(c.alpha === null ? 1 : c.alpha, 3);
			}
		});
		document.querySelectorAll('.sb-save').forEach(function (b) {
			var t = b.getAttribute('data-save');
			var n = draftCount(t);
			b.textContent = 'Save ' + (t === 'light' ? 'Light' : 'Dark') + ' theme' + (n ? ' (' + n + ')' : '');
			b.disabled = n === 0 || !fileText;
		});
		$('sb-discard').disabled = draftCount(theme) === 0;
		try { renderContrast(); } catch (e) { fail(e.message, e); }
		logo.readouts();
	}

	/* ── Saving into variables.css ─────────────────────────────────────
	   Chrome and Edge can write to a file the person picks. The picked file
	   is remembered in this browser so it is asked for once. */
	var fileHandle = null;

	function idb() {
		return new Promise(function (resolve, reject) {
			var req = indexedDB.open('tdc-sandbox', 1);
			req.onupgradeneeded = function () { req.result.createObjectStore('handles'); };
			req.onsuccess = function () { resolve(req.result); };
			req.onerror = function () { reject(req.error); };
		});
	}
	function idbGet(key) {
		return idb().then(function (db) {
			return new Promise(function (resolve, reject) {
				var r = db.transaction('handles').objectStore('handles').get(key);
				r.onsuccess = function () { resolve(r.result); };
				r.onerror = function () { reject(r.error); };
			});
		});
	}
	function idbSet(key, value) {
		return idb().then(function (db) {
			return new Promise(function (resolve, reject) {
				var tx = db.transaction('handles', 'readwrite');
				tx.objectStore('handles').put(value, key);
				tx.oncomplete = function () { resolve(); };
				tx.onerror = function () { reject(tx.error); };
			});
		});
	}

	async function getHandle() {
		if (!window.showOpenFilePicker) {
			throw new Error('This browser cannot save to a file. Use Chrome or Edge, or use "Download variables.css instead".');
		}
		if (fileHandle) {
			var perm = await fileHandle.queryPermission({ mode: 'readwrite' });
			if (perm !== 'granted') perm = await fileHandle.requestPermission({ mode: 'readwrite' });
			if (perm === 'granted') return fileHandle;
			fileHandle = null;
		}
		var picked = await window.showOpenFilePicker({
			id: 'tdc-variables',
			multiple: false,
			types: [{ description: 'Stylesheet', accept: { 'text/css': ['.css'] } }]
		});
		var handle = picked[0];
		if (handle.name !== 'variables.css') {
			throw new Error('That file is called ' + handle.name + '. Choose src/stylesheets/variables.css in the project.');
		}
		var granted = await handle.requestPermission({ mode: 'readwrite' });
		if (granted !== 'granted') throw new Error('Permission to change variables.css was not given');
		fileHandle = handle;
		idbSet('variables', handle).catch(function (e) { console.error('[Sandbox] Could not remember the chosen file', e); });
		return handle;
	}

	/* What would be written for one theme: its drafts, and, if any of them is a
	   logo value, the whole logo set, so the saved file never holds half a logo. */
	function changesFor(t) {
		var out = {};
		Object.keys(drafts[t]).forEach(function (n) { out[n] = drafts[t][n]; });
		var hasLogo = Object.keys(out).some(function (n) { return n.indexOf('--logo-') === 0; });
		if (hasLogo) {
			LOGO.forEach(function (n) {
				var v = effectiveOrDefault(t, n);
				if (v !== undefined) out[n] = v;
			});
		}
		return out;
	}

	function markSaved(t, changes) {
		Object.keys(changes).forEach(function (n) {
			parsed[t][n] = changes[n];
			delete drafts[t][n];
		});
	}

	async function save(t) {
		var changes = changesFor(t);
		var names = Object.keys(changes);
		if (!names.length) { saveStatus('Nothing to save for the ' + t + ' theme.', ''); return; }
		var label = t === 'light' ? 'Light' : 'Dark';
		try {
			saveStatus('Saving the ' + label + ' theme…', '');
			var handle = await getHandle();
			var onDisk = await (await handle.getFile()).text();
			parseFile(onDisk); /* throws if this is not a variables.css */
			var patched = patchTheme(onDisk, t, changes);
			var writable = await handle.createWritable();
			await writable.write(patched);
			await writable.close();
			var check = await (await handle.getFile()).text();
			if (check !== patched) throw new Error('The file on disk does not match what was written. Check it before committing.');
			fileText = patched;
			markSaved(t, changes);
			applyInline();
			syncControls();
			logo.refresh();
			update();
			saveStatus('Saved ' + names.length + ' value' + (names.length === 1 ? '' : 's') + ' to the ' + label + ' theme in variables.css. Commit or undo it in Fork.', 'success');
		} catch (e) {
			if (e && e.name === 'AbortError') { saveStatus('Cancelled. Nothing was saved.', ''); return; }
			saveStatus(e.message || 'Could not save', 'error', e);
		}
	}

	function download() {
		try {
			var text = fileText;
			['dark', 'light'].forEach(function (t) {
				var c = changesFor(t);
				if (Object.keys(c).length) text = patchTheme(text, t, c);
			});
			var url = URL.createObjectURL(new Blob([text], { type: 'text/css' }));
			var a = document.createElement('a');
			a.href = url;
			a.download = 'variables.css';
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
			saveStatus('Downloaded variables.css with both themes\' unsaved changes. Replace src/stylesheets/variables.css with it.', 'success');
		} catch (e) {
			saveStatus(e.message || 'Could not build the download', 'error', e);
		}
	}

	/* ── Mock-up ───────────────────────────────────────────────────── */
	mock.addEventListener('mouseover', function (e) {
		var el = e.target.closest('[data-uses]');
		if (!el) return;
		var names = el.getAttribute('data-uses').split(/\s+/).filter(Boolean).map(function (n) {
			return SPEC[n] ? SPEC[n].label : n;
		});
		caption.textContent = el.getAttribute('data-label') + ': ' + names.join(', ') + '.';
	});
	mock.addEventListener('mouseleave', function () { caption.textContent = CAPTION_DEFAULT; });
	/* It is a picture of the site, not the site: nothing in it goes anywhere. */
	mock.addEventListener('click', function (e) {
		if (e.target.closest('a, button')) e.preventDefault();
	});

	/* ── Artwork ───────────────────────────────────────────────────── */
	var sourceSel = $('sb-source');
	var fileInput = $('sb-file');
	var modeSel = $('sb-mode');
	var backdropSel = $('sb-backdrop');
	var sizeInput = $('sb-size');
	var sizeOut = $('sb-size-out');
	var stage = $('sb-stage');
	var stageBox = $('sb-stage-box');
	var ART_STATUS = 'sb-art-status';

	var localUrl = null;
	var drawCount = 0;

	function currentSource() {
		var opt = sourceSel.options[sourceSel.selectedIndex];
		if (opt.value === 'local') return { url: localUrl, label: opt.textContent, local: true };
		/* A fresh query each time, so a file that was just replaced shows up. */
		return { url: opt.value + '?t=' + Date.now(), label: opt.textContent, local: false };
	}

	/* The SVG is the person's own file, but it is still stripped of anything
	   that could run before it is placed in the page. Event handlers are the
	   real ones (onload, onclick...): letters only, so Inkscape's own
	   attributes such as only_selected are left alone. */
	function cleanSvg(text) {
		var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
		if (doc.querySelector('parsererror')) throw new Error('That file is not valid SVG');
		var svg = doc.documentElement;
		if (svg.nodeName.toLowerCase() !== 'svg') throw new Error('That file does not start with an svg element');

		svg.querySelectorAll('script, foreignObject').forEach(function (n) { n.remove(); });
		[svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*'))).forEach(function (el) {
			Array.prototype.slice.call(el.attributes).forEach(function (a) {
				var isHandler = /^on[a-z]+$/i.test(a.name);
				var isScriptLink = /^(xlink:)?href$/i.test(a.name) && /^\s*javascript:/i.test(a.value);
				if (isHandler || isScriptLink) el.removeAttribute(a.name);
			});
		});

		/* Let it scale to the stage: size comes from the viewBox, not fixed pixels. */
		if (!svg.getAttribute('viewBox')) {
			var w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
			if (w > 0 && h > 0) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
		}
		svg.removeAttribute('width');
		svg.removeAttribute('height');
		return document.importNode(svg, true);
	}

	function drawArt() {
		var mine = ++drawCount;
		var src = currentSource();
		stage.innerHTML = '';
		stage.style.width = sizeInput.value + 'px';
		stageBox.className = 'sb-stage bd-' + backdropSel.value;
		sizeOut.textContent = sizeInput.value + ' px';
		logo.unbind(modeSel.value === 'img' ? 'Switch Render as to Inline to use these controls.' : null);

		if (!src.url) { fail('No local file has been chosen yet', null, ART_STATUS); return; }

		if (modeSel.value === 'img') {
			var img = new Image();
			img.alt = 'Artwork under test';
			img.onload = function () { if (mine === drawCount) clearFail(ART_STATUS); };
			img.onerror = function () {
				if (mine !== drawCount) return;
				fail('Could not load ' + src.label + (src.label.indexOf('Sandbox slot') === 0 ? '. The file has not been added yet.' : '.'), null, ART_STATUS);
			};
			img.src = src.url;
			stage.appendChild(img);
			return;
		}

		fetch(src.url)
			.then(function (res) {
				if (!res.ok) throw new Error('Could not load ' + src.label + ' (' + res.status + ')');
				return res.text();
			})
			.then(function (text) {
				if (mine !== drawCount) return;
				var svg = cleanSvg(text);
				stage.appendChild(svg);
				clearFail(ART_STATUS);
				logo.bind(svg);
			})
			.catch(function (e) {
				if (mine === drawCount) fail(e.message, e, ART_STATUS);
			});
	}

	function useLocalFile(file) {
		if (!file) return;
		if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
			fail(file.name + ' is not an SVG file', null, ART_STATUS);
			return;
		}
		if (localUrl) URL.revokeObjectURL(localUrl);
		localUrl = URL.createObjectURL(file);

		var opt = sourceSel.querySelector('option[value="local"]');
		if (!opt) {
			opt = document.createElement('option');
			opt.value = 'local';
			sourceSel.insertBefore(opt, sourceSel.firstChild);
		}
		opt.textContent = 'Local file: ' + file.name;
		sourceSel.value = 'local';
		drawArt();
	}

	/* ── Logo controls ─────────────────────────────────────────────────
	   The parts of the logo are found by their Inkscape labels, not their
	   ids (Inkscape's ids are generic and change):
	     sha_*      flat shadows        black, opacity is the control
	     col_m_*    primary colour      any colour, no alpha
	     col_l_*    light colour        any colour, no alpha
	     blu_*      blurred shadows     black, opacity and blur are the controls
	     gra_m_all  the gradient        black, stop opacities and one offset
	   The logo is driven by CSS variables, exactly as the live site's inline
	   logo will be: colour and opacity are var(--logo-*) on the parts, and the
	   two things CSS cannot reach (the blur amount and the gradient offset,
	   which are attributes) are set from the same variables by script. Each
	   variable starts at what the SVG file says until one is saved. */
	var logo = (function () {
		var panel = $('sb-logo');
		var note = $('sb-logo-note');

		var parts = null; /* { sha, colm, coll, blu, gra, blurs, stops } once bound */

		function labelOf(el) { return el.getAttributeNS(INKSCAPE_NS, 'label') || ''; }
		function byId(svg, id) { return svg.querySelector('[id="' + id.replace(/"/g, '') + '"]'); }
		function urlId(value) {
			var m = /url\(\s*["']?#([^"')\s]+)/.exec(value || '');
			return m ? m[1] : null;
		}

		/* A gradient's stops may sit on a gradient it links to (Inkscape does this). */
		function stopsFor(svg, el) {
			var id = urlId(el.style.fill || el.getAttribute('fill'));
			var g = id && byId(svg, id);
			var hops = 0;
			while (g && !g.querySelector('stop') && hops++ < 5) {
				var href = g.getAttributeNS(XLINK_NS, 'href') || g.getAttribute('href');
				g = href && byId(svg, href.replace(/^#/, ''));
			}
			return g ? Array.prototype.slice.call(g.querySelectorAll('stop')) : [];
		}

		function blurFor(svg, el) {
			var id = urlId(el.style.filter || el.getAttribute('filter'));
			var filter = id && byId(svg, id);
			var fe = filter && filter.querySelector('feGaussianBlur');
			if (!fe) return null;
			var num = function (name, fallback) {
				var v = parseFloat(filter.getAttribute(name));
				return isNaN(v) ? fallback : v;
			};
			return {
				filter: filter,
				fe: fe,
				std: parseFloat(fe.getAttribute('stdDeviation')),
				x: num('x', -0.1), y: num('y', -0.1), w: num('width', 1.2), h: num('height', 1.2)
			};
		}

		function hexOf(computed) {
			var n = (computed.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
			return n.length < 3 ? null : toHex(n[0], n[1], n[2]);
		}
		function names(list) { return list.map(labelOf).join(', '); }
		function setEnabled(on) {
			panel.querySelectorAll('input, button, textarea').forEach(function (el) { el.disabled = !on; });
		}

		function unbind(message) {
			parts = null;
			logoDefaults = {};
			applyInline();
			setEnabled(false);
			note.textContent = message || 'Choose a source to load the logo.';
			$('sb-logo-values').value = '';
		}

		function bind(svg) {
			var all = Array.prototype.slice.call(svg.querySelectorAll('*'));
			var withPrefix = function (prefix) {
				return all.filter(function (el) { return labelOf(el).indexOf(prefix) === 0; });
			};
			var p = {
				sha: withPrefix('sha_'),
				colm: withPrefix('col_m_'),
				coll: withPrefix('col_l_'),
				blu: withPrefix('blu_'),
				gra: all.filter(function (el) { return labelOf(el) === 'gra_m_all'; })[0] || null
			};
			p.blurs = p.blu.map(function (el) { return blurFor(svg, el); }).filter(Boolean);
			p.stops = p.gra ? stopsFor(svg, p.gra) : [];

			var found = p.sha.length + p.colm.length + p.coll.length + p.blu.length + (p.gra ? 1 : 0);
			if (!found) {
				unbind('This SVG has no parts labelled sha_, col_m_, col_l_, blu_ or gra_m_all, so there is nothing to adjust.');
				return;
			}

			/* What the file says, read before anything is pointed at a variable. */
			var d = {};
			if (p.sha.length) d['--logo-shadow-alpha'] = getComputedStyle(p.sha[0]).fillOpacity;
			if (p.colm.length) d['--logo-primary'] = hexOf(getComputedStyle(p.colm[0]).fill);
			if (p.coll.length) d['--logo-light'] = hexOf(getComputedStyle(p.coll[0]).fill);
			if (p.blu.length) d['--logo-blur-alpha'] = getComputedStyle(p.blu[0]).fillOpacity;
			if (p.blurs.length) d['--logo-blur'] = String(BASE_BLUR);
			if (p.stops.length >= 3) {
				d['--logo-grad-start'] = getComputedStyle(p.stops[0]).stopOpacity;
				d['--logo-grad-mid'] = getComputedStyle(p.stops[1]).stopOpacity;
				d['--logo-grad-end'] = getComputedStyle(p.stops[2]).stopOpacity;
				d['--logo-grad-offset'] = p.stops[1].getAttribute('offset');
			}
			logoDefaults = d;
			parts = p;
			applyInline();

			/* Point the parts at the variables. */
			p.sha.forEach(function (el) { el.style.setProperty('fill-opacity', 'var(--logo-shadow-alpha)'); });
			p.colm.forEach(function (el) { el.style.setProperty('fill', 'var(--logo-primary)'); });
			p.coll.forEach(function (el) { el.style.setProperty('fill', 'var(--logo-light)'); });
			p.blu.forEach(function (el) { el.style.setProperty('fill-opacity', 'var(--logo-blur-alpha)'); });
			if (p.stops.length >= 3) {
				p.stops[0].style.setProperty('stop-opacity', 'var(--logo-grad-start)');
				p.stops[1].style.setProperty('stop-opacity', 'var(--logo-grad-mid)');
				p.stops[2].style.setProperty('stop-opacity', 'var(--logo-grad-end)');
				/* Stop 1 may only move between its neighbours. */
				$('sb-goff').min = p.stops[0].getAttribute('offset');
				$('sb-goff').max = p.stops[2].getAttribute('offset');
			}

			setEnabled(true);
			note.textContent = 'Each control sets one --logo-* variable and the logo follows it. Values start at whatever the SVG file says until you save.';
			if (p.sha.length) $('sb-sha-parts').textContent = names(p.sha);
			if (p.colm.length) $('sb-colm-parts').textContent = names(p.colm);
			if (p.coll.length) $('sb-coll-parts').textContent = names(p.coll);
			if (p.blu.length) $('sb-blu-parts').textContent = names(p.blu);

			var gate = function (list, ids, label) {
				ids.forEach(function (id) { $(id).disabled = !list.length; });
				if (!list.length) fail('No ' + label + ' parts were found in this SVG', null, ART_STATUS);
			};
			gate(p.sha, ['sb-sha'], 'sha_');
			gate(p.colm, ['sb-colm', 'sb-colm-hex'], 'col_m_');
			gate(p.coll, ['sb-coll', 'sb-coll-hex'], 'col_l_');
			gate(p.blu, ['sb-blu'], 'blu_');
			if (!p.blurs.length) $('sb-blur').disabled = true;
			if (p.stops.length < 3) {
				['sb-g0', 'sb-g1', 'sb-g2', 'sb-goff'].forEach(function (id) { $(id).disabled = true; });
				fail(p.gra ? 'The gra_m_all gradient needs three stops and has ' + p.stops.length : 'No gra_m_all part was found in this SVG', null, ART_STATUS);
			}
			refresh();
			update();
		}

		/* The blur % is a multiplier on the saved filter: Inkscape sets the
		   deviation in proportion to the percentage for a given shape, so a
		   change of x% to y% is y/x on the deviation. The filter region is
		   scaled the same way, or a bigger blur would be cut off at the edge. */
		function applyBlur(pctValue) {
			var k = pctValue / BASE_BLUR;
			parts.blurs.forEach(function (b) {
				b.fe.setAttribute('stdDeviation', String(b.std * k));
				b.filter.setAttribute('x', String(b.x * k));
				b.filter.setAttribute('y', String(b.y * k));
				b.filter.setAttribute('width', String(1 + (b.w - 1) * k));
				b.filter.setAttribute('height', String(1 + (b.h - 1) * k));
			});
		}

		function val(name) { return effectiveOrDefault(theme, name); }

		/* The two things CSS cannot do, and the controls' own positions. */
		function refresh() {
			if (!parts) return;
			if (parts.blurs.length) {
				var b = parseFloat(val('--logo-blur'));
				if (!isNaN(b)) applyBlur(Math.min(15, Math.max(10, b)));
			}
			if (parts.stops.length >= 3 && val('--logo-grad-offset') !== undefined) {
				parts.stops[1].setAttribute('offset', val('--logo-grad-offset'));
			}
			syncPositions();
			readouts();
		}

		/* Move the controls to the current theme's values. A slider can only
		   show a rounded position; the variable keeps the exact one. */
		function syncPositions() {
			var set = function (id, v) { if (v !== undefined) $(id).value = v; };
			var pctOf = function (v) { return v === undefined ? undefined : Math.round(parseFloat(v) * 100); };
			set('sb-sha', pctOf(val('--logo-shadow-alpha')));
			set('sb-blu', pctOf(val('--logo-blur-alpha')));
			set('sb-blur', val('--logo-blur'));
			set('sb-g0', val('--logo-grad-start'));
			set('sb-g1', val('--logo-grad-mid'));
			set('sb-g2', val('--logo-grad-end'));
			set('sb-goff', val('--logo-grad-offset'));
			['colm:--logo-primary', 'coll:--logo-light'].forEach(function (pair) {
				var id = pair.split(':')[0], name = pair.split(':')[1];
				var v = val(name);
				if (v !== undefined) { $('sb-' + id).value = v; $('sb-' + id + '-hex').value = v; }
			});
		}

		function readouts() {
			if (!parts) return;
			var out = function (id, v, digits, suffix) { $(id).textContent = v === undefined ? '' : trimNum(v, digits) + (suffix || ''); };
			var sha = val('--logo-shadow-alpha'), blu = val('--logo-blur-alpha');
			out('sb-sha-out', sha === undefined ? undefined : parseFloat(sha) * 100, 2);
			out('sb-blu-out', blu === undefined ? undefined : parseFloat(blu) * 100, 2);
			out('sb-blur-out', val('--logo-blur'), 1, ' %');
			out('sb-g0-out', val('--logo-grad-start'), 3);
			out('sb-g1-out', val('--logo-grad-mid'), 3);
			out('sb-g2-out', val('--logo-grad-end'), 3);
			out('sb-goff-out', val('--logo-grad-offset'), 4);

			var lines = [];
			LOGO.forEach(function (n) {
				var v = val(n);
				if (v !== undefined) lines.push(n + ': ' + v + ';' + (drafts[theme][n] !== undefined ? '   /* unsaved */' : ''));
			});
			$('sb-logo-values').value = lines.join('\n');
		}

		/* Each control sets only its own variable. */
		var writers = {
			'sb-sha':  function () { setDraft('--logo-shadow-alpha', String(+(Number($('sb-sha').value) / 100).toFixed(2))); },
			'sb-colm': function () { setDraft('--logo-primary', $('sb-colm').value); },
			'sb-coll': function () { setDraft('--logo-light', $('sb-coll').value); },
			'sb-blu':  function () { setDraft('--logo-blur-alpha', String(+(Number($('sb-blu').value) / 100).toFixed(2))); },
			'sb-blur': function () { setDraft('--logo-blur', String(Math.min(15, Math.max(10, Number($('sb-blur').value))))); },
			'sb-g0':   function () { setDraft('--logo-grad-start', $('sb-g0').value); },
			'sb-g1':   function () { setDraft('--logo-grad-mid', $('sb-g1').value); },
			'sb-g2':   function () { setDraft('--logo-grad-end', $('sb-g2').value); },
			'sb-goff': function () { setDraft('--logo-grad-offset', $('sb-goff').value); }
		};
		function apply(id) {
			if (!parts) return;
			writers[id]();
			refresh();
		}

		/* Colours: the picker and the hex box stay in step; a bad hex is reported. */
		function wireColour(pickerId, hexId) {
			$(pickerId).addEventListener('input', function () {
				$(hexId).value = $(pickerId).value;
				apply(pickerId);
			});
			$(hexId).addEventListener('change', function () {
				var raw = $(hexId).value.trim();
				var v = validHex(raw.charAt(0) === '#' ? raw : '#' + raw);
				if (!v) {
					fail('"' + raw + '" is not a hex colour, like #3593dd', null, ART_STATUS);
					$(hexId).value = $(pickerId).value;
					return;
				}
				clearFail(ART_STATUS);
				$(pickerId).value = v;
				$(hexId).value = v;
				apply(pickerId);
			});
		}
		wireColour('sb-colm', 'sb-colm-hex');
		wireColour('sb-coll', 'sb-coll-hex');
		['sb-sha', 'sb-blu', 'sb-blur', 'sb-g0', 'sb-g1', 'sb-g2', 'sb-goff'].forEach(function (id) {
			$(id).addEventListener('input', function () { apply(id); });
		});

		/* Forget this theme's unsaved logo changes and read the SVG again. */
		$('sb-logo-reset').addEventListener('click', function () {
			LOGO.forEach(function (n) { delete drafts[theme][n]; });
			drawArt();
		});
		$('sb-logo-copy').addEventListener('click', function () {
			var text = $('sb-logo-values').value;
			if (!navigator.clipboard) { fail('This browser cannot copy from here. Select the text and copy it by hand.', null, ART_STATUS); return; }
			navigator.clipboard.writeText(text).then(
				function () { clearFail(ART_STATUS); },
				function (e) { fail('Could not copy. Select the text and copy it by hand.', e, ART_STATUS); }
			);
		});

		setEnabled(false);
		return { bind: bind, unbind: unbind, refresh: refresh, readouts: readouts };
	})();

	/* ── Wiring ────────────────────────────────────────────────────── */
	document.querySelectorAll('[data-theme-set]').forEach(function (b) {
		b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-set'), true); });
	});
	document.querySelectorAll('.sb-save').forEach(function (b) {
		b.addEventListener('click', function () { save(b.getAttribute('data-save')); });
	});
	$('sb-download').addEventListener('click', download);
	$('sb-discard').addEventListener('click', function () {
		drafts[theme] = {};
		applyInline();
		syncControls();
		logo.refresh();
		update();
		saveStatus('Unsaved ' + theme + ' changes discarded.', '');
	});
	[sourceSel, modeSel, backdropSel].forEach(function (el) { el.addEventListener('change', drawArt); });
	sizeInput.addEventListener('input', function () {
		stage.style.width = sizeInput.value + 'px';
		sizeOut.textContent = sizeInput.value + ' px';
	});
	fileInput.addEventListener('change', function () { useLocalFile(fileInput.files[0]); });

	/* ── Start ─────────────────────────────────────────────────────────
	   Read variables.css first, because every control starts from it. If it
	   cannot be read, say so: the palette stays switched off rather than
	   guess. Then, if a file has been saved into the sandbox slot, start on
	   it; otherwise start on the primary logo, which always exists. */
	caption.textContent = CAPTION_DEFAULT;
	buildControls();
	wireAlphaTouch();

	if (window.indexedDB) {
		idbGet('variables').then(function (h) { if (h) fileHandle = h; }).catch(function (e) {
			console.error('[Sandbox] Could not look up the remembered file', e);
		});
	}

	fetch(CSS_URL, { cache: 'no-store' })
		.then(function (res) {
			if (!res.ok) throw new Error('Could not read ' + CSS_URL + ' (' + res.status + ')');
			return res.text();
		})
		.then(function (text) {
			parsed = parseFile(text);
			fileText = text;
		})
		.catch(function (e) {
			fail(e.message + '. The palette controls are switched off.', e);
			document.querySelectorAll('#sb-palette-controls input').forEach(function (el) { el.disabled = true; });
		})
		.then(function () {
			setTheme(savedTheme() === 'light' ? 'light' : 'dark', false);
			return fetch('/resources/branding/sandbox.svg', { method: 'HEAD', cache: 'no-store' })
				.then(function (res) { if (res.ok) sourceSel.value = '/resources/branding/sandbox.svg'; })
				.catch(function () { /* no probe result: the default stays selected and is visible in the dropdown */ });
		})
		.then(drawArt);
})();
