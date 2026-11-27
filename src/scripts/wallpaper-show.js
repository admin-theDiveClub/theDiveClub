// The wallpaper, drawn (UV, 27 Nov; docs/systems/foundations.md, "Wallpapers"):
// the hero's table (hero.js) with the person's colours and their pictures looping
// in the middle, or the club's logo when there are none. Shared by the wallpaper
// itself (/sandbox/wallpaper/, wallpaper.js) and the upload page's preview
// (/sandbox/wallpaper/edit/, wallpaper-edit.js), so the preview is the real thing.
//
// The page lays out, inside one element (scope):
//   .wp-pics     the pictures and the logo, under the table
//   #hero-stage  the table (its see-through bed, outline, pockets and markings)
//   .wp-balls    the balls, over it
// all the same size and place, so the cloth hero.js reports (tdc-hero-bed) is in
// the pictures' coordinates too.
//
// The colours are the site's tokens set on scope, so they reach the table and
// nothing else on the page: the cloth (--bg-base, painted on clothEl), the
// markings (--text-muted), the lines (--color-primary) and the white ball
// (--color-warning, the cue ball's spots, and its glow). hero.js resolves its
// colours inside the stage, and re-reads them on tdc-hero-colours.
//
// Where a picture goes: 'fit' and 'fill' in the middle, the space between the
// black's cross and the baulk line where the logo mark sits on other tables (the
// same box as hero.js's LOGO_PAD), whole or cropped to fill; 'cloth' fills the
// whole cloth, cropped.
//
// Needs: tdc.js, hero.js (loaded before this).

window.TDCWallpaper = (() => {
	const LOGO_PAD = 2.2;     // balls in from the markings, as hero.js's logo
	const CM = 1.8;           // a corner pocket's mouth in balls (hero.js), to turn bed.pocket into a ball
	const CHANGE_MS = 1200;   // the longest change between pictures (wallpaper.css)

	// A colour token and what it drives; the white ball also sets its glow, made
	// from it as the site makes it from --color-warning
	const TOKENS = {
		markings_colour: ['--text-muted'],
		lines_colour: ['--color-primary'],
		cue_colour: ['--color-warning', '--match-glow-colour']
	};

	function create({ area, scope, clothEl, stage, pics, logo, icon, status }) {
		let bed = stage.heroBed || null;
		let slides = [];          // { el, img, ready }
		let current = -1;
		let timer = null;
		let seconds = 10;
		let generation = 0;       // a newer set() retires an older one's late loads

		function place() {
			if (!bed) return;
			const ball = bed.pocket / CM, pad = LOGO_PAD * ball;
			const cx = (bed.left + bed.right) / 2, cy = (bed.top + bed.bottom) / 2;
			let halfW, halfH;
			if (bed.land) {
				// On its side: the cross at the left
				halfW = cx - bed.cross.right - pad;
				halfH = (bed.bottom - bed.top) / 2 - pad;
			} else {
				halfW = (bed.right - bed.left) / 2 - pad;
				halfH = cy - bed.cross.bottom - pad;
			}
			halfW = Math.max(0, halfW); halfH = Math.max(0, halfH);
			const set = (k, v) => pics.style.setProperty(k, v.toFixed(1) + 'px');
			set('--wp-mid-l', cx - halfW); set('--wp-mid-t', cy - halfH);
			set('--wp-mid-w', 2 * halfW); set('--wp-mid-h', 2 * halfH);
			set('--wp-cloth-l', bed.left); set('--wp-cloth-t', bed.top);
			set('--wp-cloth-w', bed.right - bed.left); set('--wp-cloth-h', bed.bottom - bed.top);
			// The logo as the home page draws it: square, the cloth's shorter side over the golden ratio, centred
			const side = Math.min(bed.right - bed.left, bed.bottom - bed.top) / 1.618;
			set('--wp-logo', side);
			set('--wp-cx', cx); set('--wp-cy', cy);
			// The icon (UV, 27 Nov: "a bit down", on the cloth rather than the cushion
			// line): its top a ball below the top cushion's line, clear of the middle
			// pocket and the line's glow. The wallpaper's table fills the screen, so the
			// stage's px are the screen's.
			if (icon) {
				const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-logo-height')) || 46;
				icon.style.top = (bed.top + ball + h / 2).toFixed(1) + 'px';
			}
		}
		stage.addEventListener('tdc-hero-bed', (e) => { bed = e.detail; place(); });
		place();

		function colours(s) {
			const cloth = s.cloth_colour || '';
			scope.style.setProperty('--bg-base', cloth || '');
			if (!cloth) scope.style.removeProperty('--bg-base');
			if (clothEl) clothEl.style.background = cloth;
			Object.keys(TOKENS).forEach((key) => {
				const v = s[key];
				const [main, glow] = TOKENS[key];
				if (v) scope.style.setProperty(main, v); else scope.style.removeProperty(main);
				if (glow) {
					if (v) scope.style.setProperty(glow, `color-mix(in srgb, ${v} 45%, transparent)`);
					else scope.style.removeProperty(glow);
				}
			});
			stage.dispatchEvent(new Event('tdc-hero-colours'));
		}

		function show(i) {
			const was = slides[current];
			current = i;
			slides.forEach((sl, k) => {
				sl.el.classList.toggle('is-on', k === i);
				if (k !== i && sl !== was) sl.el.classList.remove('is-off');
			});
			if (was && was !== slides[i]) {
				was.el.classList.add('is-off');
				const gen = generation;
				setTimeout(() => { if (gen === generation && slides[current] !== was) was.el.classList.remove('is-off'); }, CHANGE_MS);
			}
		}

		// The next picture that has loaded; one still loading is skipped this time round
		function next() {
			if (slides.length < 2) return;
			for (let step = 1; step <= slides.length; step++) {
				const k = (current + step) % slides.length;
				if (slides[k].ready) { if (k !== current) show(k); return; }
			}
		}

		function restart() {
			clearInterval(timer);
			timer = null;
			if (slides.length > 1) timer = setInterval(next, seconds * 1000);
		}

		// settings: the wallpaper's (tdc_wallpaper's shape); images: [{ src, fit }],
		// the addresses already worked out (a public URL, or a picture not yet saved)
		function set(settings, images) {
			generation++;
			const gen = generation;
			colours(settings);
			seconds = Math.max(3, Math.min(300, Number(settings.seconds) || 10));
			pics.dataset.transition = settings.transition || 'fade';

			// Kept where the same picture is shown the same way, so a change of colour
			// or order does not reload everything
			const old = slides;
			const showing = old[current];
			slides = images.map((im) => {
				const found = old.find((sl) => sl.src === im.src && !sl.taken);
				if (found) {
					found.taken = true;
					found.el.className = 'wp-slide fit-' + im.fit + (found.el.classList.contains('is-on') ? ' is-on' : '');
					return found;
				}
				const el = document.createElement('div');
				el.className = 'wp-slide fit-' + im.fit;
				const img = document.createElement('img');
				img.alt = '';
				img.decoding = 'async';
				const sl = { el, img, src: im.src, ready: false };
				img.addEventListener('load', () => {
					sl.ready = true;
					// The first picture to arrive shows at once
					if (gen === generation && (current < 0 || !slides[current] || !slides[current].ready)) show(slides.indexOf(sl));
				});
				img.addEventListener('error', (err) => {
					if (gen === generation) TDC.error(area, 'a wallpaper picture did not load.', err, status);
				});
				img.src = im.src;
				el.appendChild(img);
				return sl;
			});
			old.forEach((sl) => { if (!sl.taken) sl.el.remove(); delete sl.taken; });
			slides.forEach((sl) => { delete sl.taken; pics.appendChild(sl.el); });

			current = slides.indexOf(showing);
			if (current < 0) {
				const first = slides.findIndex((sl) => sl.ready);
				if (first >= 0) show(first);
			} else {
				show(current);
			}

			// The logo when there are no pictures; the nav's icon in its place in the
			// bar when there are, under the bar so it shows once the bar hides (UV, 27 Nov)
			const any = slides.length > 0;
			if (logo) logo.hidden = any;
			if (icon) icon.hidden = !any;
			restart();
		}

		return { set };
	}

	return { create };
})();
