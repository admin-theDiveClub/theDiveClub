// The QR sandbox (/sandbox/qr/, 28 Nov, UV): try a look for the site's QR
// codes. It starts as the Add credits card and the order card draw theirs
// (square dots, --qr-ink on --qr-paper, error level M). Nothing is saved and
// no real page reads this; a look UV settles on is applied to those cards by
// hand later. "Your settings" is the hand-over.
//
// The QR maker is the site's own (qrcode-generator), loaded through
// TDCCredits.loadQr so it is the same file the cards use. The code is drawn
// as one SVG string, so the preview, the SVG download and the PNG download
// (that string drawn on a canvas) are always the same picture. A logo is put
// in as a data address, because a picture drawn on a canvas may not fetch
// anything of its own.

(() => {
	const AREA = 'Sandbox QR';
	const $ = (id) => document.getElementById(id);
	const form = $('qr-form'), preview = $('qr-preview'), check = $('qr-check'), stat = $('qr-status');

	// What each error level can recover, roughly (the QR standard's figures).
	const RECOVERS = { L: 0.07, M: 0.15, Q: 0.25, H: 0.30 };
	// Corner radii in dots, for a 7-dot frame (outer edge, inner edge) and the 3-dot centre.
	const FRAME_R = { square: [0, 0], rounded: [2, 1.2], round: [3.5, 2.5] };
	const EYE_R = { square: 0, rounded: 0.9, round: 1.5 };
	const DOT_R = { square: 0, rounded: 0.3, round: 0.5 };   // × the dot's size

	let lastSvg = '';
	let drawing = 0;
	const logoData = new Map();   // logo address → data address

	// ─── Reading the controls ───
	function settings() {
		return {
			text: $('qr-text').value,
			level: $('qr-level').value,
			ink: $('qr-ink').value,
			paper: $('qr-paper').value,
			quiet: clamp(parseInt($('qr-quiet').value, 10) || 0, 0, 8),
			size: parseInt($('qr-size').value, 10),
			dot: $('qr-dot').value,
			dotSize: parseInt($('qr-dot-size').value, 10) / 100,
			frame: $('qr-frame').value,
			eye: $('qr-eye').value,
			corner: $('qr-corner-own').checked ? $('qr-corner').value : null,
			logo: $('qr-logo').value || null,
			logoSize: parseInt($('qr-logo-size').value, 10) / 100,
			logoClear: $('qr-logo-clear').checked,
		};
	}

	function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
	function fmt(v) { return +v.toFixed(3); }

	// A colour token as #rrggbb, which a colour box needs.
	const probe = document.createElement('canvas').getContext('2d');
	function token(name, fallback, from) {
		const v = getComputedStyle(from || document.documentElement).getPropertyValue(name).trim();
		probe.fillStyle = fallback;
		probe.fillStyle = v || fallback;
		return probe.fillStyle;
	}

	function siteColours() {
		$('qr-ink').value = token('--qr-ink', '#202020');
		$('qr-paper').value = token('--qr-paper', '#f4e8d2');
	}

	// ─── Shapes ───
	// A rounded rectangle as path commands; r 0 is a plain one.
	function rr(x, y, w, h, r) {
		r = Math.min(r, w / 2, h / 2);
		if (r <= 0) return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
		return `M${fmt(x + r)} ${fmt(y)}h${fmt(w - 2 * r)}a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r)} ${fmt(r)}`
			+ `v${fmt(h - 2 * r)}a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(-r)} ${fmt(r)}`
			+ `h${fmt(-(w - 2 * r))}a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(-r)} ${fmt(-r)}`
			+ `v${fmt(-(h - 2 * r))}a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r)} ${fmt(-r)}z`;
	}

	function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

	// ─── Drawing ───
	// Returns { svg, n, covered } or throws (too much text for any QR).
	function build(s, logoHref) {
		if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
			qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
		}
		const q = qrcode(0, s.level);
		q.addData(s.text);
		q.make();
		const n = q.getModuleCount();
		const qz = s.quiet;
		const total = n + 2 * qz;

		const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

		// The logo's square, in dots, centred; the dots whose centre falls inside
		// it (and half a dot round it) are cleared when asked.
		let logo = null;
		if (logoHref) {
			const side = s.logoSize * n;
			const at = (n - side) / 2;
			logo = { at, side, lo: at - 0.5, hi: at + side + 0.5 };
		}
		const underLogo = (r, c) => logo && r + 0.5 > logo.lo && r + 0.5 < logo.hi && c + 0.5 > logo.lo && c + 0.5 < logo.hi;

		let dots = '';
		let covered = 0;
		const ds = s.dotSize, off = (1 - ds) / 2, dr = DOT_R[s.dot] * ds;
		for (let r = 0; r < n; r++) {
			for (let c = 0; c < n; c++) {
				if (inFinder(r, c)) continue;
				if (underLogo(r, c)) { covered++; if (s.logoClear) continue; }
				if (q.isDark(r, c)) dots += rr(c + qz + off, r + qz + off, ds, ds, dr);
			}
		}

		let corners = '';
		const [ro, ri] = FRAME_R[s.frame];
		for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
			const x = c + qz, y = r + qz;
			corners += rr(x, y, 7, 7, ro) + rr(x + 1, y + 1, 5, 5, ri) + rr(x + 2, y + 2, 3, 3, EYE_R[s.eye]);
		}

		const cornerFill = s.corner || s.ink;
		let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${s.size}" height="${s.size}">`
			+ `<rect width="${total}" height="${total}" fill="${s.paper}"/>`
			+ `<path d="${dots}" fill="${s.ink}"/>`
			+ `<path d="${corners}" fill="${cornerFill}" fill-rule="evenodd"/>`;
		if (logo) {
			svg += `<image href="${esc(logoHref)}" x="${fmt(logo.at + qz)}" y="${fmt(logo.at + qz)}" width="${fmt(logo.side)}" height="${fmt(logo.side)}" preserveAspectRatio="xMidYMid meet"/>`;
		}
		svg += '</svg>';
		return { svg, n, covered };
	}

	async function logoHref(url) {
		if (!url) return null;
		if (logoData.has(url)) return logoData.get(url);
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url} answered ${res.status}`);
		const text = await res.text();
		const data = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
		logoData.set(url, data);
		return data;
	}

	// ─── Checks under the code ───
	function lum(hex) {
		const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
			.map((u) => (u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4));
		return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
	}
	function contrast(a, b) {
		const la = lum(a), lb = lum(b);
		return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
	}

	function say(s, out) {
		const lines = [`${out.n} × ${out.n} dots, error level ${s.level}.`];
		let warn = false;
		if (s.logo) {
			const share = out.covered / (out.n * out.n);
			const can = RECOVERS[s.level];
			const pct = (v) => `${Math.round(v * 100)}%`;
			if (share > can * 0.6) {
				warn = true;
				lines.push(`The logo covers about ${pct(share)} of the code; level ${s.level} recovers about ${pct(can)}. Too close: raise the error correction or shrink the logo.`);
			} else {
				lines.push(`The logo covers about ${pct(share)} of the code; level ${s.level} recovers about ${pct(can)}.`);
			}
		}
		if (lum(s.ink) > lum(s.paper)) {
			warn = true;
			lines.push('The ink is lighter than the paper. Many phone cameras cannot read a code that way round.');
		} else if (contrast(s.ink, s.paper) < 4) {
			warn = true;
			lines.push('The ink and paper are close in brightness; it may not scan in a dim bar.');
		}
		if (s.corner && contrast(s.corner, s.paper) < 3) {
			warn = true;
			lines.push('The corner colour is faint against the paper; the corners are how a camera finds the code.');
		}
		if (s.quiet < 2) {
			warn = true;
			lines.push('A quiet zone under 2 can fail to scan on a busy background.');
		}
		lines.push('Always check it with a phone camera.');
		check.textContent = lines.join(' ');
		check.classList.toggle('is-warn', warn);
	}

	function sayValues(s) {
		$('qr-size-out').textContent = `${s.size}px`;
		$('qr-dot-size-out').textContent = `${Math.round(s.dotSize * 100)}%`;
		$('qr-logo-size-out').textContent = `${Math.round(s.logoSize * 100)}%`;
		$('qr-corner-field').hidden = !s.corner;
		const keep = { ...s };
		delete keep.text;
		delete keep.size;
		if (keep.logo) keep.logo = keep.logo.split('/').pop();
		else { delete keep.logoSize; delete keep.logoClear; }
		$('qr-settings').textContent = JSON.stringify(keep, null, 2);
	}

	async function render() {
		const mine = ++drawing;
		const s = settings();
		sayValues(s);
		if (!s.text.trim()) {
			preview.replaceChildren();
			lastSvg = '';
			check.textContent = 'Type a link or some text to make a code.';
			check.classList.remove('is-warn');
			return;
		}
		let href = null;
		try {
			href = await logoHref(s.logo);
		} catch (err) {
			TDC.error(AREA, 'the logo could not be loaded; the code is drawn without it.', err, stat);
		}
		if (mine !== drawing) return;
		let out;
		try {
			out = build(s, href);
		} catch (err) {
			preview.replaceChildren();
			lastSvg = '';
			TDC.error(AREA, 'that is too much text for a QR code at this error level. Shorten it or lower the level.', err, stat);
			return;
		}
		stat.textContent = '';
		stat.className = 'status';
		lastSvg = out.svg;
		preview.innerHTML = out.svg;
		preview.style.setProperty('--qr-sandbox-size', `${s.size}px`);
		say(s, out);
	}

	let queued = false;
	function soon() {
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => { queued = false; render(); });
	}

	// ─── Downloads ───
	function save(blob, name) {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = name;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	$('qr-svg').addEventListener('click', () => {
		if (!lastSvg) return TDC.error(AREA, 'there is no code to download yet.', null, stat);
		save(new Blob([lastSvg], { type: 'image/svg+xml' }), 'tdc-qr.svg');
	});

	$('qr-png').addEventListener('click', (e) => {
		if (!lastSvg) return TDC.error(AREA, 'there is no code to download yet.', null, stat);
		const px = settings().size * 4;
		const work = (async () => {
			const url = URL.createObjectURL(new Blob([lastSvg], { type: 'image/svg+xml' }));
			try {
				const img = new Image();
				img.src = url;
				await img.decode();
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = px;
				canvas.getContext('2d').drawImage(img, 0, 0, px, px);
				const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
				if (!blob) throw new Error('the canvas gave no picture');
				save(blob, 'tdc-qr.png');
			} finally {
				URL.revokeObjectURL(url);
			}
		})();
		TDC.busy(e.currentTarget, work, stat).catch((err) => TDC.error(AREA, 'the PNG could not be made.', err, stat));
	});

	$('qr-copy').addEventListener('click', (e) => {
		const button = e.currentTarget;
		const work = navigator.clipboard.writeText($('qr-settings').textContent);
		TDC.busy(button, work, stat)
			.then(() => {
				button.textContent = 'Copied';
				setTimeout(() => { button.textContent = 'Copy settings'; }, 1500);
			})
			.catch((err) => TDC.error(AREA, 'the settings could not be copied. Select them and copy by hand.', err, stat));
	});

	$('qr-site-colours').addEventListener('click', () => { siteColours(); soon(); });

	form.addEventListener('submit', (e) => e.preventDefault());
	form.addEventListener('input', soon);
	form.addEventListener('change', soon);

	// ─── Start ───
	TDCLoader.hold((async () => {
		siteColours();
		// The corners' first colour is the light theme's teal: the paper is the
		// light theme's cream, and the dark theme's green is too faint on it.
		const light = document.createElement('span');
		light.dataset.theme = 'light';
		light.hidden = true;
		document.body.appendChild(light);
		$('qr-corner').value = token('--color-primary', '#2b9fa6', light);
		light.remove();
		if (typeof TDCCredits === 'undefined' || !TDCCredits.loadQr) {
			TDC.error(AREA, 'the QR maker is missing from the page (credits-card.js).', null, stat);
			return;
		}
		try {
			await TDC.busy(preview, TDCCredits.loadQr(), stat);
		} catch (err) {
			TDC.error(AREA, 'the QR maker could not be loaded.', err, stat);
			return;
		}
		await render();
	})(), AREA);
})();
