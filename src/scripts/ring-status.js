// The ring icons (UV's ring status design, ported 24 Oct from
// ring-status-demo.html; do not redesign the look). A ring of cream holding
// an icon in the brand colour. tdc-controls.js builds the site's checkboxes
// from it (the ring: a tick or empty; the switch: tick on, cross off), and the
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
//     turning into a cross) or appears (a page opening, a field shown)
//   .drawIn()  draw the icon showing in again, stroke by stroke
//   .say(state)  the live text alone ('loading' while a call is out)
//
// Adding an icon: an entry in ICONS, a 100x100 box inside the ring (r = 40),
// at most 4 strokes, each drawn start to finish, outlines not fills. The dots
// trace the strokes in their own order. An icon may give widths: one stroke
// width per stroke, in the 100 box, where the default (10, status.css) is too
// heavy (the cue ball's spots). A stroke may hold several subpaths (spots).
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
		pin:   { label: 'Located', strokes: [
			'M50 72C38 58 34 52 34 44C34 35 41 29 50 29',
			'M50 72C62 58 66 52 66 44C66 35 59 29 50 29'] },
		lock:  { label: 'Locked',  strokes: ['M34 52L66 52L66 70L34 70L34 52', 'M41 52L41 42C41 35 59 35 59 42L59 52'] },
		gear:  { label: 'Settings', strokes: ['M50.0 23.0L53.8 23.3L54.8 30.6L60.3 32.9L66.2 28.4L71.6 33.8L67.1 39.7L69.4 45.2L76.7 46.2L76.7 53.8L69.4 54.8L67.1 60.3L71.6 66.2L66.2 71.6L60.3 67.1L54.8 69.4L53.8 76.7L50.0 77.0', 'M50.0 23.0L46.2 23.3L45.2 30.6L39.7 32.9L33.8 28.4L28.4 33.8L32.9 39.7L30.6 45.2L23.3 46.2L23.3 53.8L30.6 54.8L32.9 60.3L28.4 66.2L33.8 71.6L39.7 67.1L45.2 69.4L46.2 76.7L50.0 77.0', 'M50 42A8 8 0 1 1 50 58A8 8 0 1 1 50 42'] },
		bell:  { label: 'Notifications', strokes: ['M34 62C37 58 38 54 38 46C38 38 43 33 50 33', 'M66 62C63 58 62 54 62 46C62 38 57 33 50 33', 'M34 62L66 62', 'M44 68C45 72 55 72 56 68'] },
		user:  { label: 'Profile', strokes: ['M50 31A9 9 0 1 1 50 49A9 9 0 1 1 50 31', 'M31 70C31 58 40 54 50 54C60 54 69 58 69 70'] },
		smile: { label: 'Happy',   strokes: ['M36 56C42 66 58 66 64 56', 'M40 37L40 42', 'M60 37L60 42'] },
		// Added 24 Oct for the league fixtures' buttons (Move, Take match off).
		calendar: { label: 'Moved', strokes: ['M30 36L70 36L70 70L30 70L30 36', 'M30 47L70 47', 'M40 29L40 40', 'M60 29L60 40'] },
		minus: { label: 'Taken off', strokes: ['M30 50L70 50'] },
		// Added 24 Oct for the nav: the menu (three lines; it turns into the
		// cross when open) and reload (a circle round to its arrowhead).
		menu: { label: 'Menu', strokes: ['M32 35L68 35', 'M32 50L68 50', 'M32 65L68 65'] },
		reload: { label: 'Reload', strokes: ['M66 56A17 17 0 1 1 62 38', 'M52 38L62 38L62 28'] },
		// Added 24 Oct for the team card's lag: a spotted cue ball, the ball and its spot.
		// The spots are foreshortened towards the ball's edge so it reads as a
		// sphere: rounder and heavier near the middle, flatter and lighter out
		// towards the rim. Grouped into three strokes by distance, as the engine
		// has four dots: the ball, the near spot, the middle ring, the rim.
		cue: { label: 'Won the lag', widths: [5, 6, 5, 4], strokes: [
			'M50 20A30 30 0 1 1 50 80A30 30 0 1 1 50 20',
			'M47.3 43.1A1.6 1.4 -33.7 1 1 44.7 44.9A1.6 1.4 -33.7 1 1 47.3 43.1',
			'M64.2 40.4A1.8 0.8 49.8 1 1 61.8 37.6A1.8 0.8 49.8 1 1 64.2 40.4M33.4 54.3A1.8 0.8 -110.6 1 1 34.6 57.7A1.8 0.8 -110.6 1 1 33.4 54.3M53.2 64.6A1.9 1.1 160.3 1 1 56.8 63.4A1.9 1.1 160.3 1 1 53.2 64.6M68.6 56.6A1.7 0.3 104.7 1 1 69.4 53.4A1.7 0.3 104.7 1 1 68.6 56.6',
			'M40.8 30.9A2.1 0.4 -31.4 1 1 37.2 33.1A2.1 0.4 -31.4 1 1 40.8 30.9M45 71.7A2 0.3 -172.2 1 1 49 72.3A2 0.3 -172.2 1 1 45 71.7'] }
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
					p.setAttribute('class', 'mark');
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
