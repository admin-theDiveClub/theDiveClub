// Builds src/_includes/dive.svg from src/resources/branding/icon-primary.svg:
// the parts are copied, never retyped. Run it after the logo file changes:
//   node tools/dive-svg/build.js
// It stops with an error if a part it expects has gone or changed shape.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const s = fs.readFileSync(path.join(ROOT, 'src/resources/branding/icon-primary.svg'), 'utf8');

function grab(id, tag) {
	const i = s.lastIndexOf('<' + tag, s.indexOf('id="' + id + '"'));
	const re = /<(\/?)([\w:]+)[^>]*?(\/?)>/g;
	re.lastIndex = i;
	let depth = 0, m;
	while ((m = re.exec(s))) {
		if (m[1] === '/') depth--;
		else if (m[3] !== '/') depth++;
		if (depth === 0) return s.slice(i, re.lastIndex);
	}
	throw new Error('no close for ' + id);
}
// Each Inkscape label becomes a class (the sandbox's sha_ / col_m_ / col_l_ / blu_ scheme); ids go.
function tidy(x) {
	x = x.replace(/\s+inkscape:label="([^"]*)"/g, ' class="$1"');
	x = x.replace(/\s+(inkscape|sodipodi):[\w-]+="[^"]*"/g, '');
	x = x.replace(/\s+id="[^"]*"/g, '');
	return x;
}
function swap(str, cls, from, to) {
	const k = str.indexOf('class="' + cls + '"');
	if (k < 0) throw new Error('no ' + cls);
	const a = str.lastIndexOf('<', k), b = str.indexOf('>', k);
	const el = str.slice(a, b);
	const fixed = el.replace(from, to);
	if (fixed === el) throw new Error(cls + ': ' + from + ' not found');
	return str.slice(0, a) + fixed + str.slice(b);
}

let portal = tidy(grab('g84', 'g'));
let stairs = tidy(grab('g59', 'g'));
let diver = tidy(grab('g6', 'g'));
let blur = tidy(grab('filter59', 'filter')).replace('<filter', '<filter id="dive-blur"');
// The rim's shading (3 Nov): gra_m_all over the portal, a black gradient fading out.
// Inkscape splits it in two (stops, and coordinates that href them); here it is one.
const stops = tidy(grab('linearGradient46', 'linearGradient')).replace(/^<linearGradient[^>]*>/, '').replace(/<\/linearGradient>$/, '');
const coords = grab('linearGradient45', 'linearGradient');
const attr = (n) => { const m = coords.match(new RegExp('\\s' + n + '="([^"]*)"')); if (!m) throw new Error('gradient ' + n); return m[1]; };
const rimGrad = `<linearGradient id="dive-rim" gradientUnits="${attr('gradientUnits')}" x1="${attr('x1')}" y1="${attr('y1')}" x2="${attr('x2')}" y2="${attr('y2')}">${stops}</linearGradient>`;
let rim = tidy(grab('path44', 'path'));
rim = swap(rim, 'gra_m_all', 'url(#linearGradient45)', 'url(#dive-rim)');

portal = swap(portal, 'sha_portal', 'fill-opacity:0.32000002', 'fill-opacity:var(--dive-shadow-alpha, 0.32)');
portal = swap(portal, 'col_m_portal', 'fill:#61ffad', 'fill:var(--dive-ring, #61ffad)');
stairs = swap(stairs, 'sha_stairs', 'fill-opacity:0.32000002', 'fill-opacity:var(--dive-shadow-alpha, 0.32)');
stairs = swap(stairs, 'col_l_stairs', 'fill:#f4e8d2', 'fill:var(--dive-stairs, #f4e8d2)');
diver = swap(diver, 'blu_diver', 'fill-opacity:0.64', 'fill-opacity:var(--dive-blur-alpha, 0.64)');
diver = swap(diver, 'blu_diver', 'url(#filter59)', 'url(#dive-blur)');
diver = swap(diver, 'col_l_diver', 'fill:#f4e8d2', 'fill:var(--dive-skin, #f4e8d2)');
diver = swap(diver, 'col_m_diver', 'fill:#61ffad', 'fill:var(--dive-suit, #61ffad)');
diver = swap(diver, 'sha_diver', 'fill-opacity:0.32000002', 'fill-opacity:var(--dive-shadow-alpha, 0.32)');
const g6 = diver.match(/^<g[^>]*>/)[0];
diver = diver.replace(g6, g6.replace(/\s+style="[^"]*"/, ''));
portal = portal.replace(/^<g\s+style="display:inline">/, '<g>');
stairs = stairs.replace(/^<g\s+style="display:inline">/, '<g>');

const out = `<!-- The dive (3 Nov): the email GIF's diver as an inline SVG, for scripts/dive.js.
     The portal, ladder and diver are copied from resources/branding/icon-primary.svg
     by script, never retyped; the parts keep the logo's labels as classes
     (sha_ flat shadow, col_m_ primary colour, col_l_ light colour, blu_ blurred
     shadow, gra_m_all the rim's shading). At rest it is the logo exactly: same
     viewBox, same picture. Rebuilt whenever the logo file changes.
     Colours are custom properties, each falling back to the dark file's own:
     --dive-ring, --dive-stairs, --dive-suit, --dive-skin, --dive-shadow-alpha,
     --dive-blur-alpha. dive.js gives every id here a number of its own, so the
     drawing can be included more than once on a page.
     The diver is clipped to everything above the hole's centre line plus the
     hole itself: she vanishes at its near edge. -->
<svg class="dive" viewBox="0 0 541.86665 541.86666" role="img" aria-label="The Dive Club">
	<defs>
		${blur}
		${rimGrad}
		<clipPath id="dive-hole" clipPathUnits="userSpaceOnUse">
			<rect x="-100000" y="-100000" width="200000" height="100434.80405"/>
			<ellipse cx="270.93332" cy="434.80405" rx="126.47324" ry="39.531925"/>
		</clipPath>
	</defs>
	<g class="dive-scene">
		<g class="dive-art" transform="translate(-7.6625554,18.664924)">
			<g class="dive-base">${portal}${rim}${stairs}</g>
			<g clip-path="url(#dive-hole)"><g class="dive-diver">${diver}</g></g>
		</g>
	</g>
</svg>
`;
fs.writeFileSync(path.join(ROOT, 'src/_includes/dive.svg'), out.replace(/\r?\n/g, '\r\n'));
console.log(out.length, 'chars;', (out.match(/<path/g) || []).length, 'paths;', (out.match(/var\(--dive/g) || []).length, 'colour hooks;', (out.match(/\sid="/g) || []).length, 'ids');

// The wordmark (3 Nov): the loading screen's, behind the falling diver. The
// full logo (logo-primary-dark / -light.svg) without its scene: the portal,
// the ladder and the diver go; the two texts and DIVE's gradient (gra_m_all)
// stay. Cropped to the texts (WORDMARK_BOX, measured in a browser from the
// texts' box plus their blurred shadow; measure again if the texts move).
// Measured 3 Nov in headless Chrome: the scene group's box 23.7, 49.1,
// 494.1 × 413.7, the same in both files; 10 more each side for the blur
// (stdDeviation 3.4, three of them).
const WORDMARK_BOX = '13.6 39.1 514.1 433.7';
function drop(str, label) {
	const k = str.indexOf('inkscape:label="' + label + '"');
	if (k < 0) throw new Error('wordmark: no ' + label);
	const i = str.lastIndexOf('<', k);
	const re = /<(\/?)([\w:]+)[^>]*?(\/?)>/g;
	re.lastIndex = i;
	let depth = 0, m;
	while ((m = re.exec(str))) {
		if (m[1] === '/') depth--;
		else if (m[3] !== '/') depth++;
		if (depth === 0) return str.slice(0, i) + str.slice(re.lastIndex);
	}
	throw new Error('wordmark: no close for ' + label);
}
for (const theme of ['dark', 'light']) {
	let w = fs.readFileSync(path.join(ROOT, `src/resources/branding/logo-primary-${theme}.svg`), 'utf8');
	for (const label of ['TEXT_DIVE', 'TEXT_THE_CLUB', 'gra_m_all']) {
		if (!w.includes('inkscape:label="' + label + '"')) throw new Error('wordmark: no ' + label + ' in the ' + theme + ' logo');
	}
	for (const label of ['PORTAL', 'STAIRS', 'DIVER']) w = drop(w, label);
	// gra_m_all is one path for DIVE's gradient and the portal rim's shading:
	// clipped to the letters, in its own coordinates (measured 3 Nov: the
	// letters end at y -18, the rim's arc begins at 38).
	const g = w.indexOf('inkscape:label="gra_m_all"');
	const gStart = w.lastIndexOf('<path', g);
	if (gStart < 0 || w.slice(gStart, g).includes('>')) throw new Error('wordmark: gra_m_all is not a path in the ' + theme + ' logo');
	w = w.slice(0, gStart) + '<path clip-path="url(#wordmark-letters)"' + w.slice(gStart + 5);
	if (!w.includes('</defs>')) throw new Error('wordmark: no defs in the ' + theme + ' logo');
	w = w.replace('</defs>', '<clipPath id="wordmark-letters" clipPathUnits="userSpaceOnUse"><rect x="-1000" y="-1000" width="3000" height="1010"/></clipPath></defs>');
	const head = w.match(/<svg[\s\S]*?>/)[0];
	const fixed = head.replace(/\s+width="[^"]*"/, '').replace(/\s+height="[^"]*"/, '').replace(/\s+viewBox="[^"]*"/, ` viewBox="${WORDMARK_BOX}"`);
	if (!/viewBox=/.test(fixed)) throw new Error('wordmark: no viewBox in the ' + theme + ' logo');
	w = w.replace(head, fixed);
	w = w.replace(/<svg/, `<!-- The wordmark, made by tools/dive-svg/build.js from logo-primary-${theme}.svg. Do not edit: rebuild. -->\n<svg`);
	fs.writeFileSync(path.join(ROOT, `src/resources/branding/wordmark-${theme}.svg`), w.replace(/\r?\n/g, '\r\n'));
	console.log(`wordmark-${theme}.svg:`, w.length, 'chars');
}
