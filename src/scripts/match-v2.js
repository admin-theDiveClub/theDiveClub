// The new match page (/match-v2/?id=<match id>), built beside /match/ while
// UV designs it (30 Oct). So far: each player's name and picture, and the
// score, counted from the frames as every score is (completed frames each
// side won), read once on opening;
// the frame and win condition inside the cream ring (paintRingIcon), which
// carries the dots for every call the page makes (at the end); the break
// event round it and the special wins (buildBreak), not saved yet. The
// stage's layout is CSS.
//
// Needs: tdc.js, dots.js, loader.js, match-settings.js.

(() => {
	const AREA = 'Match';

	const el = (id) => document.getElementById(id);
	const els = {
		stage: el('mv-stage'), p0: el('mv-p0'), p1: el('mv-p1'),
		scoreHome: el('mv-score-home'), scoreAway: el('mv-score-away'),
		whoHome: el('mv-who-home'), whoAway: el('mv-who-away'),
		more: el('mv-more'), moreClose: el('mv-more-close'),
		moreHome: el('mv-more-who-home'), moreAway: el('mv-more-who-away'),
		ring: el('mv-light'), frame: el('mv-frame'), target: el('mv-target'), breakRing: el('mv-break'), status: el('mv-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the match page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const matchId = new URLSearchParams(location.search).get('id');

	// A score, centred by its own ink (UV, 30 Oct: the space above and below
	// was uneven): each digit of the display face stands a little differently
	// (1.05 to 1.08 of its size tall, up to 0.03 below the baseline), so the
	// score's actual digits are measured and moved down by half their height
	// from the baseline (--mv-score-shift; match-v2.css, .mv-score-n). Measured
	// once the face has loaded; until then the average digit's 0.525.
	const inkCanvas = document.createElement('canvas').getContext('2d');
	function paintScore(node, n) {
		const text = String(n);
		node.textContent = text;
		node.style.setProperty('--digits', text.length);
		// Across too (UV, 30 Oct): centred by its ink, not by the space the face
		// sets aside for each digit (text-anchor's middle), so measured from the
		// middle of the text, the ink's left and right reaches; --mv-score-shift-x
		// moves it by half their difference.
		const centre = () => {
			inkCanvas.font = '100px "Rushford Clean"';
			inkCanvas.textAlign = 'center';
			const m = inkCanvas.measureText(text);
			if (!(m.actualBoundingBoxAscent > 0)) return;
			node.style.setProperty('--mv-score-shift', ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 200).toFixed(4) + 'em');
			node.style.setProperty('--mv-score-shift-x', ((m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 200).toFixed(4) + 'em');
		};
		// Always through load(), which is at once when the face is in: check()
		// said yes before it was, and a fallback face's digits moved the score
		// up 0.19 of its size.
		document.fonts.load('100px "Rushford Clean"').then(centre, (err) => TDC.error(AREA, 'the score\'s face would not load, so it is centred by the average digit', err, els.status));
	}

	// The scores read as buttons (UV, 30 Oct): one filter both share,
	// #mv-score-fx, on the unstretched group round each digit (match-v2.css,
	// .mv-score-n), laying over the digit the buttons' green inner glow
	// (--match-glow-size, --match-win-glow-colour) and an inside shadow cast by
	// the light, built as the halves' (--page-inset-size) but stronger (UV,
	// 30 Oct: --match-score-inset-alpha, and --match-score-inset-reach times
	// the light's offset). The scores' SVGs have no
	// viewBox, so its units are px: a box-shadow's blur is twice the
	// deviation, and the offset is the light's own, set again whenever
	// page-light.js moves it.
	function buildScoreFx() {
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('class', 'mv-fx-defs');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('width', '0');
		svg.setAttribute('height', '0');
		const filter = document.createElementNS(SVG_NS, 'filter');
		filter.id = 'mv-score-fx';
		for (const [k, v] of Object.entries({ x: '-20%', y: '-20%', width: '140%', height: '140%' })) filter.setAttribute(k, v);
		const prim = (name, attrs) => {
			const e = document.createElementNS(SVG_NS, name);
			for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
			filter.append(e);
			return e;
		};
		prim('feFlood', { class: 'mv-glow-flood-win', result: 'green' });
		prim('feComposite', { in: 'green', in2: 'SourceAlpha', operator: 'out', result: 'greenOut' });
		const glowBlur = prim('feGaussianBlur', { in: 'greenOut', stdDeviation: '0', result: 'greenSoft' });
		prim('feComposite', { in: 'greenSoft', in2: 'SourceAlpha', operator: 'in', result: 'glow' });
		prim('feFlood', { class: 'mv-score-inset-flood', result: 'dark' });
		prim('feComposite', { in: 'dark', in2: 'SourceAlpha', operator: 'out', result: 'darkOut' });
		const move = prim('feOffset', { in: 'darkOut', dx: '0', dy: '0', result: 'darkMoved' });
		const insetBlur = prim('feGaussianBlur', { in: 'darkMoved', stdDeviation: '0', result: 'darkSoft' });
		prim('feComposite', { in: 'darkSoft', in2: 'SourceAlpha', operator: 'in', result: 'inset' });
		// The outline, as a button's: a line --match-break-stroke wide centred
		// on the digit's edge, the shape grown by half of it less the shape
		// shrunk by half of it, in green. Made here, in the unstretched group,
		// so it is even all round: a text stroke was stretched with the digit
		// (non-scaling-stroke does not reach text), 3.75px on its flat edges.
		const grow = prim('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: '0', result: 'grown' });
		const shrink = prim('feMorphology', { in: 'SourceAlpha', operator: 'erode', radius: '0', result: 'shrunk' });
		prim('feComposite', { in: 'grown', in2: 'shrunk', operator: 'out', result: 'band' });
		prim('feFlood', { class: 'mv-score-line-flood', result: 'lineColour' });
		prim('feComposite', { in: 'lineColour', in2: 'band', operator: 'in', result: 'line' });
		const merge = prim('feMerge', {});
		// In the buttons' order: the fill, its glow, the line, the inside shadow over all
		for (const input of ['SourceGraphic', 'glow', 'line', 'inset']) {
			const node = document.createElementNS(SVG_NS, 'feMergeNode');
			node.setAttribute('in', input);
			merge.append(node);
		}
		svg.append(filter);
		els.stage.append(svg);
		const root = document.documentElement;
		const place = () => {
			const cs = getComputedStyle(root);
			const glow = px('--match-glow-size'), soft = px('--page-inset-size');
			if (!(glow >= 0) || !(soft >= 0)) { TDC.error(AREA, 'the scores\' glow or inside shadow has no size (--match-glow-size, --page-inset-size)', null, els.status); return; }
			const line = px('--match-break-stroke');
			if (line > 0) { grow.setAttribute('radius', (line / 2).toFixed(2)); shrink.setAttribute('radius', (line / 2).toFixed(2)); }
			const reach = px('--match-score-inset-reach');
			const k = reach > 0 ? reach : 1;
			glowBlur.setAttribute('stdDeviation', (glow / 2).toFixed(2));
			insetBlur.setAttribute('stdDeviation', (soft / 2).toFixed(2));
			move.setAttribute('dx', ((parseFloat(cs.getPropertyValue('--page-shadow-x')) || 0) * k).toFixed(2));
			move.setAttribute('dy', ((parseFloat(cs.getPropertyValue('--page-shadow-y')) || 0) * k).toFixed(2));
		};
		place();
		new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ['style'] });
	}

	// A player's name and picture (UV, 30 Oct): the picture on the left (or
	// their initials in a circle, as on the season page), the display name on
	// the right with the full name under it, unless the two are the same.
	const fullName = (p) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name;
	function div(cls, text) {
		const d = document.createElement('div');
		d.className = cls;
		if (text !== undefined) d.textContent = text;
		return d;
	}
	function paintWho(node, p) {
		const pic = div('mv-pic');
		const url = TDC.pictureUrl('player-avatars', p.avatar_path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			pic.append(img);
		} else {
			pic.textContent = (p.display_name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		const names = div('mv-names');
		names.append(div('mv-name', p.display_name));
		const full = fullName(p);
		if (full !== p.display_name) names.append(div('mv-full', full));
		const person = div('mv-person');
		person.append(pic, names);
		node.replaceChildren(person);
	}

	// ─── The break event (UV, 30 Oct) ─────────────────────────────────
	// A yellow ring inside the cream one, split like an X into a button per
	// break event (TDCMatchDef.BREAK_OUTCOME, so the names are defined once):
	// In at the top, Dry at the bottom, Scratch left and Foul right. The
	// chosen one is filled. As on /match/, nothing is chosen at first and a
	// choice can be changed, never cleared. Not saved yet: the page writes
	// nothing. Drawn in a 100 box: each quadrant an annular sector, its
	// straight edges BREAK_RING.gap from the X's lines on both sides, so the
	// gap between two quadrants is even from the hole to the rim. The words
	// run along the rim (UV, 30 Oct), so the quadrants can be a narrow band and
	// the hole large. Dry's arc runs the other way round, so it reads upright;
	// Scratch reads upwards and Foul downwards, their tops to the rim.
	//
	// Each word's capitals are centred in the band (UV, 30 Oct: the padding
	// was uneven): the word stands on its baseline, which is CAP / 2 of its
	// size off the band's middle, inwards where its top faces the rim and
	// outwards for Dry, whose top faces the hole. CAP is a Rushford Clean
	// capital's height for its size (1.05 with size-adjust, measured 30 Oct;
	// none of these words reaches below the baseline). Centring the font's
	// em box instead (dominant-baseline: central) left the capitals 0.15 of
	// their size off the middle, outwards on three and inwards on Dry.
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const BREAK_AT = { in: -90, foul: 0, dry: 90, scratch: 180 };   // each quadrant's middle, degrees clockwise from the right
	const BREAK_RING = { outer: 48, inner: 35, gap: 2.5 };
	const CAP = 1.05;
	let breakEvent = null;

	const DEG = 180 / Math.PI;
	const at = (r, a) => [50 + r * Math.cos(a / DEG), 50 + r * Math.sin(a / DEG)].map((n) => n.toFixed(2)).join(' ');
	const norm = (a) => ((a + 540) % 360) - 180;   // an angle in degrees, brought into -180 to 180

	function sector(mid) {
		const { outer, inner, gap } = BREAK_RING;
		const oa = Math.asin(gap / outer) * DEG, ia = Math.asin(gap / inner) * DEG;
		return `M ${at(outer, mid - 45 + oa)} A ${outer} ${outer} 0 0 1 ${at(outer, mid + 45 - oa)}`
			+ ` L ${at(inner, mid + 45 - ia)} A ${inner} ${inner} 0 0 0 ${at(inner, mid - 45 + ia)} Z`;
	}

	// The arc a word stands on, centred on the angle mid and reaching half
	// either side of it, its capitals centred on the circle of radius middle:
	// clockwise (its top outwards), except in the lower half, where clockwise
	// would point its top down and out (a special win at 150° read nearly
	// upside down); exactly sideways (0°, 180°: Foul, Scratch) stays
	// clockwise. size: the words' size in the box (--mv-word). The break
	// words' middle is their band's.
	function wordArc(mid, size, half = 40, middle = (BREAK_RING.outer + BREAK_RING.inner) / 2) {
		const lift = CAP * size / 2;
		if (mid > 0 && mid < 180) {
			const r = middle + lift;
			return `M ${at(r, mid + half)} A ${r} ${r} 0 0 0 ${at(r, mid - half)}`;
		}
		const r = middle - lift;
		return `M ${at(r, mid - half)} A ${r} ${r} 0 0 1 ${at(r, mid + half)}`;
	}

	// ─── The special wins (UV, 30 Oct) ────────────────────────────────
	// Four buttons in the break buttons' style, in green, two a slot either
	// side of the ring upright and above and below it sideways: slot A Break
	// & finish and Golden break, slot B Reverse B&F and the more button (UV
	// chose four, two a slot; the fourth was a walkover until UV made it three
	// dots opening the more pop-up, which holds the walkovers; the wins are
	// named by TDCMatchDef.RESULT_SHORT). Each slot is a rounded rectangle split in two by the
	// quadrants' gap, its inner edge a curve round the ring, as far from the
	// ring's line as two quadrants' lines are apart (winR), rounded where it
	// meets the straight edges; its words run along that curve, padded as the
	// break words are. Slot A is the left one upright and the top one sideways;
	// in a slot the first is the top one upright and the left one sideways.
	// Drawn in the break ring's 100 box, reaching outside it, and drawn again
	// when the phone turns. Not saved yet, nor tied to the match's rules: a tap
	// marks one, as a break button's does.
	const WIN_SLOTS = [['break_and_finish', 'golden_break'], ['reverse_break_and_finish', 'more']];
	const WIN = { depth: 40, corner: 4 };   // a slot's depth beyond its curve, and its corners' radius
	const winR = () => BREAK_RING.outer + 2 * BREAK_RING.gap;
	const landscape = matchMedia('(orientation: landscape)');
	let winEvent = null;

	// A slot's button drawn to the left of the ring between the heights y1
	// and y2, then turned rot degrees about the ring's centre (a rotation, so
	// every arc's sweep holds). wordR: the radius its word is centred on.
	function winButton(y1, y2, rot, wordR) {
		const R = winR(), c = WIN.corner, xo = 50 - R - WIN.depth;
		const turn = (x, y) => {
			const a = rot / DEG, dx = x - 50, dy = y - 50;
			return [50 + dx * Math.cos(a) - dy * Math.sin(a), 50 + dx * Math.sin(a) + dy * Math.cos(a)];
		};
		const p = (x, y) => turn(x, y).map((n) => n.toFixed(2)).join(' ');
		// The rounded corner where a straight edge at y meets the curve: a circle
		// of radius c touching the edge on the button's side (s: 1 below it, -1
		// above) and the ring's curve from outside.
		const fillet = (y, s) => {
			const cy = y + s * c, cx = 50 - Math.sqrt((R + c) ** 2 - (cy - 50) ** 2), k = R / (R + c);
			return { line: [cx, y], curve: [50 + (cx - 50) * k, 50 + (cy - 50) * k] };
		};
		const top = fillet(y1, 1), bottom = fillet(y2, -1);
		const d = `M ${p(xo, y1 + c)} A ${c} ${c} 0 0 1 ${p(xo + c, y1)}`
			+ ` L ${p(...top.line)} A ${c} ${c} 0 0 1 ${p(...top.curve)}`
			+ ` A ${R} ${R} 0 0 0 ${p(...bottom.curve)}`
			+ ` A ${c} ${c} 0 0 1 ${p(...bottom.line)}`
			+ ` L ${p(xo + c, y2)} A ${c} ${c} 0 0 1 ${p(xo, y2 - c)} Z`;
		// The word's arc spans the curve between the corners, at wordR
		const angle = (y) => 180 - Math.asin(Math.max(-1, Math.min(1, (y - 50) / wordR))) * DEG;
		const a1 = angle(y1 + c), a2 = angle(y2 - c);
		return { d, mid: norm((a1 + a2) / 2 + rot), half: Math.abs(a1 - a2) / 2, wordR, centre: turn(50 - R, (y1 + y2) / 2) };
	}

	function winButtons(size) {
		const wide = landscape.matches, h = BREAK_RING.outer, g = BREAK_RING.gap;
		const cap = CAP * size, pad = (BREAK_RING.outer - BREAK_RING.inner - cap) / 2;
		const wordR = winR() + pad + cap / 2;
		const rots = wide ? [90, -90] : [0, 180];
		const out = [];
		WIN_SLOTS.forEach((values, i) => {
			const pair = [winButton(50 - h, 50 - g, rots[i], wordR), winButton(50 + g, 50 + h, rots[i], wordR)];
			pair.sort((a, b) => (wide ? a.centre[0] - b.centre[0] : a.centre[1] - b.centre[1]));
			values.forEach((value, j) => out.push(Object.assign({ value }, pair[j])));
		});
		return out;
	}

	// The buttons' inside effects, each a layer of its own over or under them,
	// built as the halves' inset box-shadows are: every path is a button
	// filled, run through a filter that takes a colour from outside the shape,
	// (moves it,) softens it and cuts it back to inside the shape. A
	// box-shadow's blur is twice the Gaussian's deviation, and the box is 100
	// units across whatever its size on screen, so px become units by the
	// ring's size; set again when the ring resizes, and the shadow's offset
	// whenever the light moves.
	//   The glow (UV, 30 Oct: as the breaker's border glows), under the
	//   buttons, so their shadow falls on their lines and words, not on it:
	//   yellow in the break buttons, green in the special wins.
	//   The shadow (UV, 30 Oct: inside the buttons as well as out, cast by the
	//   light as everything else's): the halves' own inset shadow
	//   (--page-inset-*, offset by --page-shadow-x / -y from page-light.js),
	//   over the buttons, so it falls across a chosen one's fill and word.
	//   Their outside shadow is the score digits', on the buttons' layer
	//   (match-v2.css, .mv-break-lines).
	const px = (name) => parseFloat(getComputedStyle(els.stage).getPropertyValue(name));

	function effectLayer(cls, filters) {
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('class', cls);
		svg.setAttribute('aria-hidden', 'true');
		const defs = document.createElementNS(SVG_NS, 'defs');
		const parts = {};
		for (const [id, steps] of Object.entries(filters)) {
			const filter = document.createElementNS(SVG_NS, 'filter');
			filter.id = id;
			for (const [k, v] of Object.entries({ x: '-50%', y: '-50%', width: '200%', height: '200%' })) filter.setAttribute(k, v);
			parts[id] = steps((name, attrs) => {
				const e = document.createElementNS(SVG_NS, name);
				for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
				filter.append(e);
				return e;
			});
			defs.append(filter);
		}
		const shapes = document.createElementNS(SVG_NS, 'g');
		svg.append(defs, shapes);
		// list: [{ d, filter }], the filter by id
		const paint = (list) => shapes.replaceChildren(...list.map(({ d, filter }) => {
			const path = document.createElementNS(SVG_NS, 'path');
			path.setAttribute('d', d);
			path.setAttribute('filter', `url(#${filter})`);
			return path;
		}));
		return { svg, parts, paint };
	}

	function buildGlow() {
		const glow = (flood) => (prim) => {
			prim('feFlood', { class: flood, result: 'colour' });
			prim('feComposite', { in: 'colour', in2: 'SourceAlpha', operator: 'out', result: 'outside' });
			const blur = prim('feGaussianBlur', { in: 'outside', stdDeviation: '0', result: 'soft' });
			prim('feComposite', { in: 'soft', in2: 'SourceAlpha', operator: 'in' });
			return { blur };
		};
		const layer = effectLayer('mv-break-glow', { 'mv-glow-break': glow('mv-glow-flood'), 'mv-glow-win': glow('mv-glow-flood-win') });
		const size = () => {
			const box = layer.svg.getBoundingClientRect().width, glowPx = px('--match-glow-size');
			if (!(box > 0)) return;
			if (!(glowPx >= 0)) { TDC.error(AREA, 'the buttons\' glow has no size (--match-glow-size)', null, els.status); return; }
			for (const part of Object.values(layer.parts)) part.blur.setAttribute('stdDeviation', (glowPx / 2 / (box / 100)).toFixed(3));
		};
		new ResizeObserver(size).observe(layer.svg);
		return layer;
	}

	function buildInset() {
		const layer = effectLayer('mv-break-inset', { 'mv-inset': (prim) => {
			prim('feFlood', { class: 'mv-inset-flood', result: 'colour' });
			prim('feComposite', { in: 'colour', in2: 'SourceAlpha', operator: 'out', result: 'outside' });
			const move = prim('feOffset', { in: 'outside', dx: '0', dy: '0', result: 'moved' });
			const blur = prim('feGaussianBlur', { in: 'moved', stdDeviation: '0', result: 'soft' });
			prim('feComposite', { in: 'soft', in2: 'SourceAlpha', operator: 'in' });
			return { move, blur };
		} });
		const { move, blur } = layer.parts['mv-inset'];
		const root = document.documentElement;
		const place = () => {
			const box = layer.svg.getBoundingClientRect().width;
			if (!(box > 0)) return;
			const k = 100 / box, cs = getComputedStyle(root);
			const dx = parseFloat(cs.getPropertyValue('--page-shadow-x')) || 0;
			const dy = parseFloat(cs.getPropertyValue('--page-shadow-y')) || 0;
			const soft = px('--page-inset-size');
			if (!(soft >= 0)) { TDC.error(AREA, 'the buttons\' inside shadow has no size (--page-inset-size)', null, els.status); return; }
			move.setAttribute('dx', (dx * k).toFixed(3));
			move.setAttribute('dy', (dy * k).toFixed(3));
			blur.setAttribute('stdDeviation', (soft / 2 * k).toFixed(3));
		};
		new ResizeObserver(place).observe(layer.svg);
		// page-light.js writes the light's place on <html>'s style, at most 15
		// times a second
		new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ['style'] });
		return layer;
	}

	// A button: its outline and its word on an arc, as a radio
	function choice(cls, value, label, d, arcId, arcD, defs) {
		const g = document.createElementNS(SVG_NS, 'g');
		g.classList.add(cls);
		g.dataset.value = value;
		g.setAttribute('role', 'radio');
		g.setAttribute('aria-checked', 'false');
		g.setAttribute('aria-label', label);
		g.setAttribute('tabindex', '0');
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', d);
		const arc = document.createElementNS(SVG_NS, 'path');
		arc.id = arcId;
		arc.setAttribute('d', arcD);
		defs.append(arc);
		const text = document.createElementNS(SVG_NS, 'text');
		text.setAttribute('aria-hidden', 'true');
		const onArc = document.createElementNS(SVG_NS, 'textPath');
		onArc.setAttribute('href', '#' + arcId);
		onArc.setAttribute('startOffset', '50%');
		onArc.textContent = label;
		text.append(onArc);
		g.append(path, text);
		return g;
	}

	function buildBreak() {
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('class', 'mv-break-lines');
		const defs = document.createElementNS(SVG_NS, 'defs');
		const ring = document.createElementNS(SVG_NS, 'g');
		ring.setAttribute('role', 'radiogroup');
		ring.setAttribute('aria-label', 'Break event');
		const wins = document.createElementNS(SVG_NS, 'g');
		wins.setAttribute('role', 'radiogroup');
		wins.setAttribute('aria-label', 'Special wins');
		svg.append(defs, ring, wins);
		const size = px('--mv-word');
		if (!(size > 0)) TDC.error(AREA, 'the button words have no size (--mv-word in match-v2.css), so they cannot be placed', null, els.status);
		const word = size > 0 ? size : 0;
		for (const [value, label] of Object.entries(TDCMatchDef.BREAK_OUTCOME)) {
			if (!(value in BREAK_AT)) {
				TDC.error(AREA, `the break ring has no place for "${value}"`, null, els.status);
				continue;
			}
			ring.append(choice('mv-break-q', value, label, sector(BREAK_AT[value]), 'mv-break-arc-' + value, wordArc(BREAK_AT[value], word), defs));
		}
		const glow = buildGlow(), inset = buildInset();
		let buttons = [];

		// The breaker's glow stops at the buttons themselves (UV, 30 Oct: a
		// rectangle round the group cut it with hard edges beside the special
		// wins' rounded corners): each half gets a mask (--mv-glow-mask, used by
		// match-v2.css, .mv-side[data-breaking]::before), an SVG the half's size
		// that hides the glow inside the special wins and the break ring, each
		// grown by half a line so no glow lies under an outline, and shows it
		// everywhere else, the gaps between them included. Drawn from the same
		// shapes as the buttons, in the ring's box placed where it sits on the
		// half, again whenever the stage resizes or the phone turns.
		const glowMasks = () => {
			const br = els.breakRing.getBoundingClientRect();
			const line = px('--match-break-stroke');
			if (!(br.width > 0) || !buttons.length) return;
			const u = br.width / 100;
			const holes = buttons.map((b) => `<path d="${b.d}"/>`).join('') + `<circle cx="50" cy="50" r="${BREAK_RING.outer}"/>`;
			for (const side of [els.p0, els.p1]) {
				const sr = side.getBoundingClientRect();
				const w = sr.width.toFixed(2), h = sr.height.toFixed(2);
				const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
					+ `<mask id="m"><rect width="100%" height="100%" fill="#fff"/>`
					+ `<g transform="translate(${(br.left - sr.left).toFixed(2)} ${(br.top - sr.top).toFixed(2)}) scale(${u.toFixed(4)})" fill="#000" stroke="#000" stroke-width="${(line / u).toFixed(3)}">${holes}</g></mask>`
					+ `<rect width="100%" height="100%" mask="url(#m)"/></svg>`;
				side.style.setProperty('--mv-glow-mask', `url("data:image/svg+xml,${encodeURIComponent(mask)}")`);
			}
		};
		new ResizeObserver(glowMasks).observe(els.stage);

		// The special wins and both effect layers, drawn for how the phone is held
		const paintWins = () => {
			buttons = winButtons(word);
			const winDefs = document.createElementNS(SVG_NS, 'defs');
			wins.replaceChildren(winDefs, ...buttons.map((b) => {
				if (b.value === 'more') return moreButton(b, word);
				const label = TDCMatchDef.RESULT_SHORT[b.value];
				if (!label) TDC.error(AREA, `no short name for the special win "${b.value}"`, null, els.status);
				const g = choice('mv-win-q', b.value, label || b.value, b.d, 'mv-win-arc-' + b.value, wordArc(b.mid, word, b.half, b.wordR), winDefs);
				g.setAttribute('aria-label', TDCMatchDef.RESULT_EVENT[b.value] || label);
				return g;
			}));
			markChosen(wins, '.mv-win-q', winEvent);
			const shapes = [
				...Object.keys(BREAK_AT).map((v) => ({ d: sector(BREAK_AT[v]), kind: 'break' })),
				...buttons.map((b) => ({ d: b.d, kind: 'win' }))
			];
			glow.paint(shapes.map((s) => ({ d: s.d, filter: s.kind === 'break' ? 'mv-glow-break' : 'mv-glow-win' })));
			inset.paint(shapes.map((s) => ({ d: s.d, filter: 'mv-inset' })));
			requestAnimationFrame(glowMasks);   // once the turned layout is in
		};
		paintWins();
		landscape.addEventListener('change', paintWins);

		svg.addEventListener('click', (e) => {
			const q = e.target.closest('.mv-break-q, .mv-win-q');
			if (!q) return;
			if (q.classList.contains('mv-break-q')) chooseBreak(q.dataset.value);
			else if (q.classList.contains('mv-more-q')) openMore();
			else chooseWin(q.dataset.value);
		});
		svg.addEventListener('keydown', (e) => {
			const q = e.target.closest('.mv-break-q, .mv-win-q');
			if (!q || (e.key !== 'Enter' && e.key !== ' ')) return;
			e.preventDefault();
			q.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		els.breakRing.append(glow.svg, svg, inset.svg);
		// For the cream ring that sits in the hole (match-v2.css, .mv-light): the
		// hole's share of the ring's box, and how far apart two quadrants'
		// edges are, as a share of it
		els.stage.style.setProperty('--mv-break-hole', String(BREAK_RING.inner * 2 / 100));
		els.stage.style.setProperty('--mv-break-gap', String(BREAK_RING.gap * 2 / 100));
		// for the breaker's outline and glow, which stop at the buttons
		els.stage.style.setProperty('--mv-break-rim', String(BREAK_RING.outer * 2 / 100));
		// and the whole group's length along the split, the special wins'
		// outside edges apart, as a share of the ring's box: the ring is sized
		// so the group fits (match-v2.css, --mv-centre)
		els.stage.style.setProperty('--mv-cluster', String(2 * (winR() + WIN.depth) / 100));
	}

	// The more button: a special win's shape, three dots along its curve in
	// place of a word (the display face has no ellipsis), a button that opens
	// the more pop-up rather than a choice.
	function moreButton(b, size) {
		const g = document.createElementNS(SVG_NS, 'g');
		g.classList.add('mv-win-q', 'mv-more-q');
		g.dataset.value = 'more';
		g.setAttribute('role', 'button');
		g.setAttribute('aria-label', 'More: walkovers, abandon the frame, pause the match');
		g.setAttribute('aria-haspopup', 'dialog');
		g.setAttribute('tabindex', '0');
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', b.d);
		g.append(path);
		const cap = CAP * size, step = (cap * 0.75 / b.wordR) * DEG;
		for (const k of [-1, 0, 1]) {
			const a = (b.mid + k * step) / DEG;
			const dot = document.createElementNS(SVG_NS, 'circle');
			dot.setAttribute('class', 'mv-more-dot');
			dot.setAttribute('cx', (50 + b.wordR * Math.cos(a)).toFixed(2));
			dot.setAttribute('cy', (50 + b.wordR * Math.sin(a)).toFixed(2));
			dot.setAttribute('r', (cap * 0.16).toFixed(2));
			g.append(dot);
		}
		return g;
	}

	// ─── The more pop-up (UV, 30 Oct) ─────────────────────────────────
	// A dialog: Escape, the close button or a tap outside it closes it (a tap
	// on the scrim lands on the dialog itself; its content fills a wrapper).
	// Its actions do nothing yet but close it: nothing on this page saves.
	function openMore() {
		if (!els.more.open) els.more.showModal();
	}
	els.moreClose.addEventListener('click', () => els.more.close());
	els.more.addEventListener('click', (e) => {
		if (e.target === els.more) { els.more.close(); return; }
		if (e.target.closest('.mv-act')) els.more.close();
	});

	function markChosen(root, sel, value) {
		for (const g of root.querySelectorAll(sel)) {
			const on = g.dataset.value === value;
			g.classList.toggle('is-on', on);
			g.setAttribute('aria-checked', String(on));
		}
	}

	function chooseBreak(value) {
		if (value === breakEvent) return;
		breakEvent = value;
		markChosen(els.breakRing, '.mv-break-q', value);
	}

	function chooseWin(value) {
		if (value === winEvent) return;
		winEvent = value;
		markChosen(els.breakRing, '.mv-win-q', value);
	}

	buildBreak();
	buildScoreFx();

	async function load() {
		const { data: m, error } = await supabaseClient
			.from('tbl_matches')
			.select('id, rules, first_break_side, home_side_kind, home_player_id, away_side_kind, away_player_id')
			.eq('id', matchId)
			.maybeSingle();
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (!m) {
			TDC.error(AREA, 'no match with id ' + matchId + '. Either the link is wrong, or it is not yours to see.', null, els.status);
			return;
		}

		// The two players. A team side has no player to show: a league night is
		// scored on the team card, and this page says so rather than guess.
		const sides = { home: els.whoHome, away: els.whoAway };
		const moreSides = { home: els.moreHome, away: els.moreAway };
		const ids = ['home', 'away'].filter((s) => m[s + '_side_kind'] === 'player' && m[s + '_player_id']).map((s) => m[s + '_player_id']);
		for (const s of ['home', 'away']) {
			if (m[s + '_side_kind'] !== 'player') TDC.error(AREA, `the ${s} side is a ${m[s + '_side_kind']}, not a player. Team matches are scored on the team card.`, null, els.status);
		}
		if (ids.length) {
			const { data: people, error: peopleError } = await supabaseClient
				.from('tbl_players')
				.select('id, display_name, first_name, last_name, avatar_path')
				.in('id', ids);
			if (peopleError) { TDC.showSupabaseError(AREA, peopleError, els.status); return; }
			for (const s of ['home', 'away']) {
				const id = m[s + '_side_kind'] === 'player' ? m[s + '_player_id'] : null;
				if (!id) continue;
				const p = people.find((x) => x.id === id);
				if (p) { paintWho(sides[s], p); paintWho(moreSides[s], p); }
				else TDC.error(AREA, `the ${s} player (${id}) could not be read.`, null, els.status);
			}
		}

		const { data: frames, error: framesError } = await supabaseClient
			.from('tbl_frames')
			.select('frame_no, break_side, winner_side, status')
			.eq('match_id', matchId)
			.order('frame_no');
		if (framesError) { TDC.showSupabaseError(AREA, framesError, els.status); return; }

		const won = (side) => frames.filter((f) => f.status === 'complete' && f.winner_side === side).length;
		paintScore(els.scoreHome, won('home'));
		paintScore(els.scoreAway, won('away'));

		// The frame in play is the one after the last saved, as on /match/
		// (newDraft: breakSideAt(MATCH.frames.length, MATCH.frames)).
		paintBreaker(breakSideAt(frames.length, frames, m));
		paintRingIcon(m.rules, frames.length, won('home'), won('away'));
	}

	// ─── The ring's icon (UV, 30 Oct) ─────────────────────────────────
	// Inside the cream ring, the old page's frame line in two parts: above,
	// the frame in play and the most frames the match can take where there
	// is a most (race to 5: 9, as 5 + 4 decides it; best of n and n fixed
	// frames: n; timed and free play: none), or Final once it is decided;
	// below, the win condition as /match/ words it (free play alone, the rest
	// with their number). Over is worked out as /match/'s matchWinner and
	// matchOver do: a race at its number, best of n past half, fixed frames
	// all played.
	function paintRingIcon(rules, played, home, away) {
		const type = rules.win_condition_type, t = Number(rules.win_condition_target);
		const most = !(t > 0) ? null : type === 'race_to' ? 2 * t - 1 : (type === 'best_of' || type === 'fixed_frames') ? t : null;
		const lead = Math.max(home, away);
		const over = t > 0 && ((type === 'race_to' && lead >= t)
			|| (type === 'best_of' && lead >= Math.floor(t / 2) + 1)
			|| (type === 'fixed_frames' && home + away >= t));
		els.frame.textContent = over ? 'Final' : `Frame ${played + 1}${most ? '/' + most : ''}`;
		const wc = TDCMatchDef.WIN_CONDITION[type];
		if (!wc) TDC.error(AREA, `unknown win condition "${type}"`, null, els.status);
		els.target.textContent = type === 'free_play' ? wc : `${wc || 'TDC (Error)'} ${rules.win_condition_target}`;
	}

	// ─── Who is breaking (UV, 30 Oct) ─────────────────────────────────
	// The frame in play's breaker, worked out as /match/ does it: this is
	// match.js's breakSideAt, unchanged but for reading the match from `m`.
	// The database re-derives every saved frame's break side itself
	// (private.tdc_break_side_for_frame; docs/systems/matches.md), so this is
	// only what the page shows before the frame is saved.
	const otherSide = (side) => (side === 'home' ? 'away' : 'home');
	function breakSideAt(i, frames, m) {
		const rule = m.rules.break_determination;
		const first = m.first_break_side;

		// Nobody is recording breaks, so no frame has a breaking side.
		if (!m.rules.track_breaks) return null;

		if (rule === 'lag_each_frame' || rule === 'by_schedule') return null;
		if (i === 0) return first;

		// Every rule below reckons from who broke first. Without that there is
		// nothing to reckon from, and anything returned here would be invented.
		if (!first) return null;

		const prev = frames[i - 1];
		switch (rule) {
			case 'alternate':     return i % 2 === 0 ? first : otherSide(first);
			case 'winner_breaks': return prev && prev.winner_side ? prev.winner_side : first;
			case 'loser_breaks':  return prev && prev.winner_side ? otherSide(prev.winner_side) : first;
			case 'first_breaks':  return first;
			default:
				TDC.error(AREA, 'unknown break rule: ' + rule, null, els.status);
				return null;
		}
	}

	// The breaker's half of the stage wears a yellow outline and inner glow
	// (match-v2.css, [data-breaking]); nobody's while nobody is known.
	function paintBreaker(side) {
		els.p0.toggleAttribute('data-breaking', side === 'home');
		els.p1.toggleAttribute('data-breaking', side === 'away');
	}

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!matchId || !UUID.test(matchId)) {
			TDC.error(AREA, 'no match in the address. Check the link you were sent.', { id: matchId }, els.status);
			return;
		}
		await load();
	})(), AREA);

	// ─── The dots, always on the ring (UV, 30 Oct) ─────────────────────
	// Every network call on this page is shown by the dots on the cream ring,
	// never by the dots flying to whatever was tapped: they come to the ring
	// and wait on its line, sized by its stroke (line: the ring is its own
	// border), while it dims, words and all (dots.css, the busy look), then
	// race it and fade as it comes back. (Until then they ran on a loop, a
	// pretend 15 s call every 20 s, while there were no calls to show.)
	//   Each call asked for (TDCNet.onAsk, every rpc and from) serves the
	//   ring until the network is quiet; more calls meanwhile are waited for.
	//   Anything else on the page that serves the dots (the nav, a control,
	//   TDC.writer) is sent to the ring instead, its own result still shown
	//   when its call is back. The loading screen keeps its own dots: while it
	//   is up nothing is sent to the ring, and its own ring is let through.
	const serveAt = TDCDots.serve;
	const onRing = (promise) => serveAt(els.ring, promise, { line: true, status: els.status });
	TDCDots.serve = (el, promise, opts = {}) => {
		if (TDCLoader.up || (el && el.closest && el.closest('.tdc-loader'))) return serveAt(el, promise, opts);
		onRing(promise);
		if (opts.reveal) Promise.resolve(promise).then(() => opts.reveal(), () => opts.reveal());
		return promise;
	};
	TDCNet.onAsk(() => {
		if (!TDCLoader.up) onRing(TDCNet.quiet());
	});
})();
