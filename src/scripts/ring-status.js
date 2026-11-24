// The ring icons (UV's ring status design, ported 24 Oct from
// ring-status-demo.html; do not redesign the look). A ring of cream holding
// an icon in the brand colour. tdc-controls.js builds the site's checkboxes
// from it (the ring: a tick or empty; the switch: tick on, empty off), and the
// nav and the fixtures page their buttons.
//
// Since 26 Oct (the dots, step 7) a ring has no dots of its own: the one
// travelling set (scripts/dots.js) serves whatever is waiting on the network,
// a ring included, and traces its new icon as the icon fades in. What is left
// here is the icon itself.
//
//   new TDCRing.RingStatus(el, { initial, icons, labels })
//     el       an element holding the SVG from TDCRing.svg()
//     icons    the icon names this control uses; only their paths are built
//     labels   what the hidden live text says for each state
//   .setState(state)  show a state (an icon name, or 'empty') at once; the
//     stylesheet's own transition draws the strokes on and off
//   .drawTo(state)  the same, the new icon drawn in stroke by stroke, in
//     order, in --ring-draw: for an icon that changes with no call (the menu
//     turning into a cross) or a tap shows (a folding group opened). Never
//     for a page load: a ring made then takes its icon as `initial` and shows
//     it at once (UV, 16 Nov; the Schedule tab drew a few hundred at a time)
//   .drawIn()  draw the icon showing in again, stroke by stroke
//   .say(state)  the live text alone ('loading' while a call is out)
//
// Adding an icon: an entry in ICONS, a 100x100 box inside the ring (r = 40),
// at most 4 strokes, each drawn start to finish, outlines not fills. The dots
// trace the strokes in their own order. A line is as heavy as the ring (5 in
// the 100 box, status.css; UV, 5 Nov). An icon may give widths, one per
// stroke, only for marks that are dots or spots and must stay solid (the
// cue ball's spots, the three dots). A stroke may hold several subpaths.
//
// Needs: nothing. Loaded on every page by layout.html, before tdc-controls.js.

const TDCRing = (() => {
	const NS = 'http://www.w3.org/2000/svg';

	// ─── Icons: up to 4 strokes each, drawn start to end ───
	const ICONS = {
		tick:  { label: 'Success', strokes: ['M32 51L45 63', 'M68 39L45 63'] },
		cross: { label: 'Failed',  strokes: ['M36 36L50 50', 'M64 36L50 50', 'M64 64L50 50', 'M36 64L50 50'] },
		plus:  { label: 'Added',   strokes: ['M50 30L50 70', 'M30 50L70 50'] },
		heart: { label: 'Liked',   strokes: [
			'M50 72C30 58 26 48 30 40C34 32 46 33 50 42',
			'M50 72C70 58 74 48 70 40C66 32 54 33 50 42'] },
		star:  { label: 'Starred', strokes: [
			'M50 30L56 44L71 45L59 55L63 70L50 62',
			'M50 30L44 44L29 45L41 55L37 70L50 62'] },
		arrow: { label: 'Next',    strokes: ['M32 50L68 50', 'M54 36L68 50', 'M54 64L68 50'] },
		play:  { label: 'Playing', strokes: ['M40 32L66 50L40 68', 'M40 32L40 68'] },
		bolt:  { label: 'Power',   strokes: ['M56 28L40 54L56 54', 'M44 72L56 54'] },
		home:  { label: 'Home',    strokes: ['M30 50L50 32L70 50', 'M36 46L36 68L64 68L64 46'] },
		mail:  { label: 'Mail',    strokes: ['M28 64L28 36L72 36L72 64L28 64', 'M28 36L50 54L72 36'] },
		// A handset and a speech bubble: the venue page's Call and WhatsApp (17 Nov).
		phone: { label: 'Call',    strokes: ['M40 30L46 41L41 46C44 53 47 56 54 59L59 54L70 60L70 65C70 68 68 70 65 70C46 69 31 54 30 35C30 32 32 30 35 30L40 30'] },
		chat:  { label: 'Message', strokes: ['M37 65A20 20 0 1 0 31 58L28 70L37 65'] },
		// A globe, Instagram's rounded square and Facebook's f, as line drawings:
		// the venue page's links (17 Nov). The footer's own marks, redrawn as rings'.
		globe: { label: 'Website', strokes: ['M50 32A18 18 0 1 1 50 68A18 18 0 1 1 50 32', 'M50 32C42 40 42 60 50 68C58 60 58 40 50 32', 'M32 50L68 50'] },
		instagram: { label: 'Instagram', widths: [5, 5, 7], strokes: ['M41 32L59 32A9 9 0 0 1 68 41L68 59A9 9 0 0 1 59 68L41 68A9 9 0 0 1 32 59L32 41A9 9 0 0 1 41 32', 'M50 42A8 8 0 1 1 50 58A8 8 0 1 1 50 42', 'M61 38.5A0.5 0.5 0 1 1 61 39.5A0.5 0.5 0 1 1 61 38.5'] },
		facebook: { label: 'Facebook', strokes: ['M53 70L53 44C53 37 56 33 64 33', 'M44 50L62 50'] },
		pin:   { label: 'Located', strokes: [
			'M50 72C38 58 34 52 34 44C34 35 41 29 50 29',
			'M50 72C62 58 66 52 66 44C66 35 59 29 50 29'] },
		lock:  { label: 'Locked',  strokes: ['M34 52L66 52L66 70L34 70L34 52', 'M41 52L41 42C41 35 59 35 59 42L59 52'] },
		gear:  { label: 'Settings', strokes: ['M50.0 23.0L53.8 23.3L54.8 30.6L60.3 32.9L66.2 28.4L71.6 33.8L67.1 39.7L69.4 45.2L76.7 46.2L76.7 53.8L69.4 54.8L67.1 60.3L71.6 66.2L66.2 71.6L60.3 67.1L54.8 69.4L53.8 76.7L50.0 77.0', 'M50.0 23.0L46.2 23.3L45.2 30.6L39.7 32.9L33.8 28.4L28.4 33.8L32.9 39.7L30.6 45.2L23.3 46.2L23.3 53.8L30.6 54.8L32.9 60.3L28.4 66.2L33.8 71.6L39.7 67.1L45.2 69.4L46.2 76.7L50.0 77.0', 'M50 42A8 8 0 1 1 50 58A8 8 0 1 1 50 42'] },
		bell:  { label: 'Notifications', strokes: ['M34 62C37 58 38 54 38 46C38 38 43 33 50 33', 'M66 62C63 58 62 54 62 46C62 38 57 33 50 33', 'M34 62L66 62', 'M44 68C45 72 55 72 56 68'] },
		user:  { label: 'Profile', strokes: ['M50 31A9 9 0 1 1 50 49A9 9 0 1 1 50 31', 'M31 70C31 58 40 54 50 54C60 54 69 58 69 70'] },
		smile: { label: 'Happy',   strokes: ['M36 56C42 66 58 66 64 56', 'M40 37L40 42', 'M60 37L60 42'] },
		// Added 24 Oct for the league fixtures' buttons (Move, Take match off).
		// The league tabs' bottom bar (UV, 18 Nov): Standings, Season, Rules
		// (Fixtures is the calendar).
		podium: { label: 'Standings', strokes: ['M30 70L30 56L42 56L42 70', 'M42 70L42 42L58 42L58 70', 'M58 70L58 61L70 61L70 70', 'M26 70L74 70'] },
		shield: { label: 'Season', strokes: ['M50 28L68 34L68 50C68 61 60 68 50 72C40 68 32 61 32 50L32 34L50 28'] },
		// The bar's button for whoever runs the league, opening their pages (UV, 18 Nov).
		sliders: { label: 'Manage', strokes: ['M36 30L36 70', 'M50 30L50 70', 'M64 30L64 70', 'M30 58L42 58M44 40L56 40M58 52L70 52'] },
		document: { label: 'Rules', strokes: ['M37 28L57 28L65 36L65 72L37 72L37 28', 'M57 28L57 36L65 36', 'M44 49L58 49', 'M44 59L58 59'] },
		calendar: { label: 'Moved', strokes: ['M30 36L70 36L70 70L30 70L30 36', 'M30 47L70 47', 'M40 29L40 40', 'M60 29L60 40'] },
		// The tournament tabs' bottom bar (UV, 24 Nov): the Poster, the tournament
		// announced (a megaphone), and the Draw (a bracket: two pairs meeting, then
		// on to the final). Rules is the document, Manage the sliders, as a league's.
		megaphone: { label: 'Poster', strokes: ['M30 45L30 57L40 57L62 68L62 34L40 45L30 45', 'M40 57L43 68L49 68L47 60', 'M68 51L74 51', 'M67 42L72 39M67 60L72 63'] },
		bracket: { label: 'Draw', strokes: ['M28 32L42 32L42 46L28 46', 'M28 54L42 54L42 68L28 68', 'M42 39L56 39L56 61L42 61', 'M56 50L72 50'] },
		minus: { label: 'Taken off', strokes: ['M30 50L70 50'] },
		// Added 11 Nov for the fixtures' Open the card (UV): a scorecard, its
		// outline, the header line and the line between the two sides' columns.
		scorecard: { label: 'Scorecard', strokes: ['M30 28L70 28L70 72L30 72L30 28', 'M30 40L70 40', 'M50 40L50 72'] },
		// Added 11 Nov for a fixture open for lineups (UV's picture): a clipboard,
		// its clip, three ticks down the left and a line beside each.
		checklist: { label: 'Lineups', strokes: [
			'M34 30L66 30L66 74L34 74L34 30',
			'M44 30L44 25L56 25L56 30',
			'M39 42L42 45L47 39M39 53L42 56L47 50M39 64L42 67L47 61',
			'M52 42L61 42M52 53L61 53M52 64L61 64'] },
		// Added 24 Oct for the nav: the menu (three lines; it turns into the
		// cross when open) and reload (a circle round to its arrowhead).
		menu: { label: 'Menu', strokes: ['M32 35L68 35', 'M32 50L68 50', 'M32 65L68 65'] },
		reload: { label: 'Reload', strokes: ['M66 56A17 17 0 1 1 62 38', 'M52 38L62 38L62 28'] },
		// A phone with an arrow down into it: the nav's "Get the app" (13 Nov).
		install: { label: 'Get the app', strokes: ['M38 28L62 28L62 72L38 72L38 28', 'M50 37L50 57', 'M43 50L50 57L57 50', 'M47 65L53 65'] },
		// Added 26 Oct for the match page's slide to undo: an arrow pointing
		// left along the top, its tail curling down and back underneath.
		undo: { label: 'Undo', strokes: ['M36 40L60 40A13 13 0 0 1 60 66L44 66', 'M47 29L36 40L47 51'] },
		// Added 29 Oct for the standings columns' move left: arrow, the other way.
		back: { label: 'Back', strokes: ['M68 50L32 50', 'M46 36L32 50', 'M46 64L32 50'] },
		// Added 29 Oct for the three-way switch's middle: a small dot (grey,
		// status.css), so the middle has a line to trace like the two ends.
		dot: { label: 'Neither', widths: [8], strokes: ['M50 46A4 4 0 1 1 50 54A4 4 0 1 1 50 46'] },
		// Added 31 Oct for the profile menu's toggles (UV): the theme (a moon
		// for dark, a sun for light) and motion (a ball with speed lines, or
		// the ball held still between two bars).
		moon: { label: 'Dark theme', strokes: ['M57 30A21 21 0 1 0 70 58A16 16 0 1 1 57 30'] },
		sun: { label: 'Light theme', strokes: [
			'M50 40A10 10 0 1 1 50 60A10 10 0 1 1 50 40',
			'M50 25L50 31M50 69L50 75M25 50L31 50M69 50L75 50',
			'M32 32L36.5 36.5M63.5 63.5L68 68M68 32L63.5 36.5M36.5 63.5L32 68'] },
		motion: { label: 'Full motion', strokes: [
			'M61 41A9 9 0 1 1 61 59A9 9 0 1 1 61 41',
			'M33 42L46 42M27 50L46 50M33 58L46 58'] },
		still: { label: 'Less motion', strokes: [
			'M50 41A9 9 0 1 1 50 59A9 9 0 1 1 50 41',
			'M31 38L31 62M69 38L69 62'] },
		// Added 29 Oct for the team card's W (UV): a win that was a break &
		// finish or a golden break, the letters in place of the tick.
		bf: { label: 'Break & finish', strokes: [
			'M31 37L31 63',
			'M31 37L38 37A6.5 6.5 0 0 1 38 50L31 50M38 50A6.5 6.5 0 0 1 38 63L31 63',
			'M57 63L57 37L69 37',
			'M57 50L66 50'] },
		// A reverse break & finish (UV, 29 Oct): won by the side that lost
		// the lag, a small r before the BF.
		rbf: { label: 'Reverse break & finish', strokes: [
			'M25 47L25 63M25 53C27 48 31 46 34 47',
			'M39 37L39 63',
			'M39 37L45 37A6.5 6.5 0 0 1 45 50L39 50M45 50A6.5 6.5 0 0 1 45 63L39 63',
			'M58 63L58 37L70 37M58 50L67 50'] },
		gb: { label: 'Golden break', strokes: [
			'M45 43.7A8 13 0 1 0 45 56.3L45 51L39 51',
			'M56 37L56 63',
			'M56 37L63 37A6.5 6.5 0 0 1 63 50L56 50M63 50A6.5 6.5 0 0 1 63 63L56 63'] },
		// Added 19 Nov for the team card's W (UV): the letter in place of the
		// tick on the knob, as tall as the BF and GB above.
		w: { label: 'Won the frame', strokes: [
			'M35 37L42 63L50 42',
			'M50 42L58 63L65 37'] },
		// Added 24 Oct for the team card's lag: a spotted cue ball, the ball and its spot.
		// The spots sit on the 12 corners of an icosahedron (the most even spread
		// of points on a sphere; UV, 20 Nov: evenly placed like a real measles
		// ball), tipped a little so six show on the front. They are foreshortened
		// towards the ball's edge so it reads as a sphere: rounder near the middle,
		// flatter out towards the rim. Grouped by distance, as the engine has four
		// dots: the ball, the near spot, the middle three, the rim two.
		cue: { label: 'Won the lag', widths: [5, 6, 5, 4], strokes: [
			'M50 20A30 30 0 1 1 50 80A30 30 0 1 1 50 20',
			'M56.8 50.8A2 1.9 79.7 1 1 56.1 46.9A2 1.9 79.7 1 1 56.8 50.8',
			'M34.4 53.7A2 1.4 249.6 1 1 35.8 57.4A2 1.4 249.6 1 1 34.4 53.7M43.4 32.7A2 1.1 -27.1 1 1 39.8 34.5A2 1.1 -27.1 1 1 43.4 32.7M51.2 69.5A2 0.9 170.5 1 1 55.2 68.8A2 0.9 170.5 1 1 51.2 69.5',
			'M65.2 34.9A2 0.5 39.8 1 1 62.2 32.3A2 0.5 39.8 1 1 65.2 34.9M70.4 57.5A2 0.4 104.9 1 1 71.4 53.6A2 0.4 104.9 1 1 70.4 57.5'] },
		// Added 5 Nov for the player page's buttons (UV): follow (the person,
		// moved left, with a small plus), share (three small circles joined by
		// two lines; UV, 10 Nov: softer than the box it was) and more (three
		// dots, each its own stroke).
		follow: { label: 'Follow', strokes: [
			'M44 33A8 8 0 1 1 44 49A8 8 0 1 1 44 33',
			'M28 68C28 58 35 54 44 54C53 54 60 58 60 68',
			'M67 37L67 51M60 44L74 44'] },
		share: { label: 'Share', strokes: [
			'M73 32A7 7 0 1 1 59 32A7 7 0 1 1 73 32',
			'M41 50A7 7 0 1 1 27 50A7 7 0 1 1 41 50',
			'M73 68A7 7 0 1 1 59 68A7 7 0 1 1 73 68',
			'M40.1 46.6L59.9 35.4',
			'M40.1 53.4L59.9 64.6'] },
		// Added 19 Nov for the scorecard's picture of its scoresheet (UV: a
		// picture icon, not Share's, which shares the link): a framed picture,
		// two hills and a sun.
		picture: { label: 'Save picture', strokes: [
			'M33 31L67 31Q72 31 72 36L72 64Q72 69 67 69L33 69Q28 69 28 64L28 36Q28 31 33 31',
			'M29 64L43 49L53 59L59 53L71 64',
			'M64 42A4 4 0 1 1 56 42A4 4 0 1 1 64 42'] },
		more: { label: 'More', widths: [8, 8, 8], strokes: [
			'M33 46A4 4 0 1 1 33 54A4 4 0 1 1 33 46',
			'M50 46A4 4 0 1 1 50 54A4 4 0 1 1 50 46',
			'M67 46A4 4 0 1 1 67 54A4 4 0 1 1 67 46'] }
	};
	const NAMES = Object.keys(ICONS);

	// The markup a control hands to RingStatus: the ring, and a group for the
	// icon's strokes.
	function svg() {
		return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
			+ `<circle class="ring" cx="50" cy="50" r="40"/><g class="arms"></g></svg>`;
	}

	const lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
	// --ring-draw in ms, 0 when the device asks for less motion.
	function drawMs(el) {
		if (lessMotion.matches) return 0;
		const v = getComputedStyle(el).getPropertyValue('--ring-draw').trim(), n = parseFloat(v);
		return isNaN(n) ? 400 : (v.endsWith('ms') ? n : n * 1000);
	}

	class RingStatus {
		constructor(btn, opts = {}) {
			this.btn = btn;
			this.labels = opts.labels || {};
			const svgEl = btn.querySelector('svg');
			const armsG = svgEl.querySelector('.arms');
			const used = opts.icons || NAMES;
			this.marks = {};   // icon -> its strokes, in order
			for (const name of used) {
				const ic = ICONS[name];
				if (!ic) throw new Error('there is no ring icon called "' + name + '".');
				this.marks[name] = ic.strokes.map((d, i) => {
					const p = document.createElementNS(NS, 'path');
					p.setAttribute('d', d);
					p.setAttribute('pathLength', '100');
					p.setAttribute('class', 'mark mark-' + name);   // mark-cross: red (status.css)
					if (ic.widths) p.style.strokeWidth = ic.widths[i];
					armsG.appendChild(p);
					return p;
				});
			}
			this.live = document.createElement('span');
			this.live.className = 'sr';
			this.live.setAttribute('role', 'status');
			btn.after(this.live);
			this.setState(opts.initial || 'empty');
		}
		say(s) {
			this.live.textContent = this.labels[s]
				|| (s === 'empty' ? 'Idle' : s === 'loading' ? 'Loading' : ICONS[s].label);
		}
		setState(s) {
			this.state = s; this.btn.dataset.state = s;
			this.say(s);
			for (const name in this.marks) for (const p of this.marks[name]) p.classList.toggle('on', name === s);
		}
		drawTo(s) {
			if (s === this.state) return;
			this.setState(s);
			this.drawIn();
		}
		// Each stroke takes its own slice of the draw time, in order (as the
		// controls' chevrons do). The stylesheet's transition is held off
		// meanwhile: a transition outranks an animation and would draw every
		// stroke at once.
		drawIn() {
			const strokes = this.marks[this.state];
			if (!strokes) return;
			const ms = drawMs(this.btn), slice = ms / strokes.length;
			strokes.forEach((p, i) => {
				for (const a of p.getAnimations()) a.cancel();
				if (!ms) return;
				p.style.transition = 'none';
				const a = p.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }],
					{ duration: slice, delay: i * slice, easing: 'ease-out', fill: 'backwards' });
				a.finished.then(() => { p.style.transition = ''; }, () => { p.style.transition = ''; });
			});
		}
	}

	return { RingStatus, ICONS, svg };
})();
