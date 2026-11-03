// The dive (UV, 3 Nov): the email GIF's diver, drawn inline from the logo
// (_includes/dive.svg), as a loader. At rest she is the logo, perfectly still.
// start(): she dives through the hole, and while loading goes on she falls in
// from the top and through again, straight away (UV, 3 Nov; the GIF pauses).
// stop(): once she is through, she falls in one last time and stays in the
// logo pose.
//
// The fall is the GIF's own, fitted to its 34 frames (within 1.4 px): a steady
// speed-up from an entry speed, in diver lengths (L) per second so it looks the
// same at any size, limited by topSpeed. On a GIF-sized box she takes 0.48 s
// to reach the hole, as the GIF does.
//
// Reduced motion is the caller's business: this always plays when asked.
//
//   const dive = TDCDive.attach(svgElement, { frame: 'fit' });
//   dive.start();  …  dive.stop();
//
// Options (dive.set() changes them for the next drop):
//   frame     'fit'  the scene sits at the bottom of the box, scaled to fit
//                    (the loading overlay); 'logo' the logo file's own framing
//                    (the nav icon), so swapping it for the <img> moves nothing
//   fall      'screen' from just above the top of the box; 'distance'
//             (distance, px on screen) or 'time' (time, seconds to the hole).
//             Never shorter than 'screen': she always comes in from above
//   topSpeed  L/s (the GIF peaks at 2.5)
//   pause     ms between drops
//   maxDiver  px, the tallest she is drawn with frame 'fit'
//   onLayout  called after each layout with { portal }: the portal's width
//             on screen, px (the loading screen sizes its wordmark by it)

const TDCDive = (() => {
	const AREA = 'Dive';
	const V0 = 1.812;   // L/s as she enters
	const ACC = 0.742;  // L/s²
	const HOLE_LIP = 434.80405 + 39.531925; // the hole's near edge, in the logo's units
	const LOGO_BOX = 541.86666;              // the logo file's viewBox
	const HOLE_W = 2 * 126.47324;            // the portal's width, in the logo's units
	// pause 0 (UV, 3 Nov): the next drop starts the moment she is through.
	const DEFAULTS = { frame: 'fit', fall: 'screen', distance: 0, time: 0, topSpeed: 3, pause: 0, maxDiver: 360 };
	let copies = 0;

	// Distance covered after t seconds, and time to cover d, with the speed limit.
	function motion(vmax) {
		const speeds = vmax > V0;
		const t1 = speeds ? (vmax - V0) / ACC : 0;
		const d1 = speeds ? V0 * t1 + 0.5 * ACC * t1 * t1 : 0;
		return {
			pos: (t) => !speeds ? vmax * t : t <= t1 ? V0 * t + 0.5 * ACC * t * t : d1 + vmax * (t - t1),
			timeTo: (d) => !speeds ? d / vmax : d <= d1 ? (-V0 + Math.sqrt(V0 * V0 + 2 * ACC * d)) / ACC : t1 + (d - d1) / vmax,
		};
	}

	// Each copy on a page gets ids of its own, and its references follow.
	function ownIds(svg) {
		const n = ++copies;
		for (const el of svg.querySelectorAll('[id]')) {
			const was = el.id, now = `${was}-${n}`;
			el.id = now;
			for (const user of svg.querySelectorAll('[clip-path], [filter], [style]')) {
				for (const name of ['clip-path', 'filter', 'style']) {
					const v = user.getAttribute(name);
					if (v && v.includes(`url(#${was})`)) user.setAttribute(name, v.split(`url(#${was})`).join(`url(#${now})`));
				}
			}
		}
	}

	function attach(svg, options) {
		const opts = { ...DEFAULTS, ...options };
		const scene = svg.querySelector('.dive-scene');
		const art = svg.querySelector('.dive-art');
		const base = svg.querySelector('.dive-base');
		const diver = svg.querySelector('.dive-diver');
		if (!scene || !art || !base || !diver) {
			TDC.error(AREA, 'this is not the dive drawing (_includes/dive.svg).', svg);
			return null;
		}
		ownIds(svg);

		let geo = null;       // the box as it is now
		let plan = null;      // the drop under way
		let loading = false, resting = true, from = 0, raf = 0, timer = 0;

		function layout() {
			const box = svg.getBoundingClientRect();
			if (!box.width || !box.height) return false;
			const off = art.transform.baseVal.consolidate().matrix;
			const keep = diver.getAttribute('transform');
			diver.removeAttribute('transform');
			const b = base.getBBox(), d = diver.getBBox();
			if (keep) diver.setAttribute('transform', keep);
			let s, tx, ty, top;
			if (opts.frame === 'logo') {
				svg.setAttribute('viewBox', `0 0 ${LOGO_BOX} ${LOGO_BOX}`);
				scene.removeAttribute('transform');
				s = 1; top = -off.f;
				geo = { px: Math.min(box.width, box.height) / LOGO_BOX * d.height };
			} else {
				const W = box.width, H = box.height;
				svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
				const x0 = Math.min(b.x, d.x), x1 = Math.max(b.x + b.width, d.x + d.width);
				const y1 = b.y + b.height;
				const bottom = Math.max(24, H * 0.06);
				s = Math.min((W - 32) / (x1 - x0), (H - bottom - 8) / (y1 - d.y), opts.maxDiver / d.height);
				tx = W / 2 - s * ((x0 + x1) / 2 + off.e);
				ty = H - bottom - s * (y1 + off.f);
				scene.setAttribute('transform', `translate(${tx} ${ty}) scale(${s})`);
				top = -ty / s - off.f;
				geo = { px: s * d.height };
			}
			geo.len = d.height;                                   // one diver length, logo units
			geo.fit = Math.max(0, (d.y + d.height - top) / d.height); // from just above the top edge
			geo.through = (HOLE_LIP - d.y) / d.height;            // logo pose until her toes pass the lip
			const unit = opts.frame === 'logo' ? Math.min(box.width, box.height) / LOGO_BOX : s;
			if (opts.onLayout) opts.onLayout({ portal: unit * HOLE_W });
			return true;
		}

		function makePlan() {
			const m = motion(opts.topSpeed);
			let fallL = geo.fit;
			if (opts.fall === 'distance') fallL = Math.max(geo.fit, opts.distance / geo.px);
			else if (opts.fall === 'time') fallL = Math.max(geo.fit, m.pos(opts.time));
			return { m, fallL, tHole: m.timeTo(fallL), tEnd: m.timeTo(fallL + geo.through) };
		}

		function place(fallenL) {
			if (Math.abs(fallenL - plan.fallL) < 1e-9) diver.removeAttribute('transform');
			else diver.setAttribute('transform', `translate(0 ${(fallenL - plan.fallL) * geo.len})`);
		}

		// A drop from the top, or (fromPose) on from the logo pose.
		function drop(fromPose) {
			timer = 0;
			if (!layout()) { resting = true; return; }
			plan = makePlan();
			plan.cameIn = !fromPose; // came in from the top, so it can end in the logo pose
			resting = false;
			from = performance.now() - (fromPose ? plan.tHole * 1000 : 0);
			raf = requestAnimationFrame(frame);
		}

		function frame(now) {
			raf = 0;
			try {
				const t = (now - from) / 1000;
				if (!loading && plan.cameIn && t >= plan.tHole) return rest();
				if (t >= plan.tEnd) {
					place(plan.fallL + geo.through + 1);
					if (loading && opts.pause > 0) timer = setTimeout(() => drop(false), opts.pause);
					else if (loading) drop(false);
					else drop(false); // loading is over: no pause, straight back to the logo pose
					return;
				}
				place(plan.m.pos(t));
				raf = requestAnimationFrame(frame);
			} catch (err) {
				TDC.error(AREA, 'the dive stopped.', err);
				rest();
			}
		}

		function rest() {
			cancelAnimationFrame(raf); clearTimeout(timer); raf = 0; timer = 0;
			resting = true;
			diver.removeAttribute('transform');
		}

		function start() {
			if (loading) return;
			loading = true;
			if (resting) drop(true);
		}

		function stop() {
			if (!loading) return;
			loading = false;
			// Already past the hole on this drop: let her go through, then fall in once more.
			if (raf && plan.cameIn && (performance.now() - from) / 1000 >= plan.tHole) plan.cameIn = false;
			if (timer) { clearTimeout(timer); drop(false); } // in the pause: fall in now and stay
		}

		const watch = new ResizeObserver(() => layout());
		watch.observe(svg);
		layout();

		return {
			start,
			stop,
			set(changes) { Object.assign(opts, changes); if (resting) layout(); },
			get loading() { return loading; },
			destroy() { watch.disconnect(); rest(); },
		};
	}

	return { attach, DEFAULTS };
})();
