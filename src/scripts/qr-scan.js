// The shared QR scanner (UV, 28 Nov; DECISIONS 28 Nov, "A Scan button inside the app").
//
//   TDCScan.open()   opens the scanner over the page. A Dive Club link read from a QR
//                    is opened inside the app; anything else is said in the sheet and
//                    scanning goes on. If the camera can't be used, the sheet says why
//                    and stays open until it is closed.
//
// Opened from the menu's "Scan a code" (everyone, every page; nav.js) and the staff
// Top-ups and Orders pages' Scan button. Loaded on every page by layout.html.
//
// Why it exists: on an iPhone, the phone's own camera opens a scanned link in Safari,
// which has its own sign-in, not in the installed app. Scanning from inside keeps staff
// where they are signed in. The phone's own camera, and typing the code, still work.
//
// Reading: the phone's built-in reader (BarcodeDetector, Chrome on Android) when it has
// one; otherwise ZXing (node_modules/@zxing/library, copied at build to
// /scripts/vendor/zxing.js), loaded the first time Scan is tapped, so no other page or
// phone pays for it. The camera stops the moment the sheet closes or the app is left.
// Built on the Add credits card's look (.cc, stylesheets/credits-card.css) and its
// rise and sink (TDC.cardOpen / TDC.cardClose); its own look in stylesheets/qr-scan.css.

const TDCScan = (() => {
	const AREA = 'Scan';
	const EVERY_MS = 150;         // how often a frame is read
	const CROP = 720;             // the frame's middle square is read at no more than this
	// Hosts whose links are ours. The page's own host lets it be tried on localhost.
	const OURS = new Set(['thediveclub.org', 'www.thediveclub.org', location.host]);

	let dlg = null;
	let els = {};
	let stream = null;
	let timer = null;
	let reading = false;
	let session = 0;              // only the latest open scans
	let lastBad = null;           // the last wrong QR, so it is said once, not every frame
	let read = null;              // (video) => Promise<string | null>

	function el(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	function build() {
		dlg = el('dialog', 'cc qs');
		dlg.setAttribute('aria-labelledby', 'qs-title');
		dlg.dataset.pull = 'off';   // a drag on the sheet never reloads the page under it

		const head = el('div', 'cc-head');
		const title = el('h2', null, 'Scan a code');
		title.id = 'qs-title';
		title.tabIndex = -1;
		title.autofocus = true;
		const close = el('button', 'cc-icon');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close');
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '2');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('aria-hidden', 'true');
		for (const d of ['M6 6l12 12', 'M18 6L6 18']) {
			const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			p.setAttribute('d', d);
			svg.appendChild(p);
		}
		close.append(svg);
		head.append(title, close);

		// The camera's picture, its middle square framed: that square is what is read.
		const view = el('div', 'qs-view');
		const video = el('video');
		video.muted = true;
		video.playsInline = true;           // iPhone: in the sheet, not full screen
		video.setAttribute('playsinline', '');
		video.setAttribute('aria-hidden', 'true');
		const frame = el('div', 'qs-frame');
		frame.setAttribute('aria-hidden', 'true');
		view.append(video, frame);

		const hint = el('p', 'muted qs-hint', 'Point the camera at a Dive Club QR.');
		const status = el('div', 'status');
		status.setAttribute('role', 'status');

		dlg.append(head, view, hint, status);
		document.body.append(dlg);

		close.addEventListener('click', shut);
		// Esc or the phone's Back: TDC.cardOpen turns 'cancel' into its own close, so the
		// camera is stopped here as well.
		dlg.addEventListener('cancel', stop);
		dlg.addEventListener('close', stop);

		els = { view, video, status };
	}

	// ─── Reading a frame ───
	let zxingLoad = null;
	function loadZxing() {
		if (typeof ZXing !== 'undefined') return Promise.resolve();
		if (zxingLoad) return zxingLoad;
		const tdcScript = document.querySelector('script[src*="/scripts/tdc.js"]');
		const stamp = tdcScript ? new URL(tdcScript.src).search : '';
		zxingLoad = new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = '/scripts/vendor/zxing.js' + stamp;
			s.onload = () => resolve();
			s.onerror = () => { zxingLoad = null; reject(new Error('zxing.js did not load')); };
			document.head.appendChild(s);
		});
		return zxingLoad;
	}

	async function makeReader() {
		if (read) return read;
		if ('BarcodeDetector' in window) {
			try {
				const formats = await BarcodeDetector.getSupportedFormats();
				if (formats.includes('qr_code')) {
					const detector = new BarcodeDetector({ formats: ['qr_code'] });
					read = async (video) => {
						const found = await detector.detect(video);
						return found.length ? found[0].rawValue : null;
					};
					return read;
				}
			} catch (err) {
				// The built-in reader is there but won't work: ZXing instead, and say so.
				console.error(`[${AREA}] the built-in QR reader failed; using ZXing.`, err);
			}
		}
		await loadZxing();
		const reader = new ZXing.QRCodeReader();
		const hints = new Map([[ZXing.DecodeHintType.TRY_HARDER, true]]);
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		read = async (video) => {
			const w = video.videoWidth, h = video.videoHeight;
			if (!w || !h) return null;
			const side = Math.min(w, h);
			const size = Math.min(side, CROP);
			canvas.width = canvas.height = size;
			ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
			try {
				const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(canvas)));
				return reader.decode(bitmap, hints).getText();
			} catch (err) {
				if (err instanceof ZXing.NotFoundException || err instanceof ZXing.ChecksumException || err instanceof ZXing.FormatException) return null;
				throw err;
			} finally {
				reader.reset();
			}
		};
		return read;
	}

	// ─── What was read ───
	// One of our links → its path, to open here. Anything else → null.
	function ourPath(text) {
		let url;
		try { url = new URL(String(text).trim()); } catch { return null; }
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
		if (!OURS.has(url.host)) return null;
		return url.pathname + url.search + url.hash;
	}

	function found(text) {
		const path = ourPath(text);
		if (!path) {
			if (text !== lastBad) {
				lastBad = text;
				console.error(`[${AREA}] a QR that is not a Dive Club link was read.`, text);
				TDC.status(els.status, 'TDC (Error): That QR isn’t a Dive Club link.', 'error');
			}
			return false;
		}
		if (navigator.vibrate) { try { navigator.vibrate(30); } catch { /* not allowed: no matter */ } }
		stop();
		TDC.status(els.status, '', '');
		// The page it opens reads its ?code= or ?order= from the server, as from the camera.
		location.assign(path);
		return true;
	}

	// ─── The camera ───
	function cameraMessage(err) {
		const name = err && err.name;
		if (name === 'NotAllowedError' || name === 'SecurityError') return 'The camera wasn’t allowed. Allow it in the browser’s settings and try again.';
		if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
		if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is in use by another app. Close it and try again.';
		return 'The camera could not be started.';
	}

	async function startCamera() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			const e = new Error('navigator.mediaDevices.getUserMedia is not available (not HTTPS, or an old browser)');
			e.name = 'Unsupported';
			throw e;
		}
		const s = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
		});
		return s;
	}

	function loop(mine) {
		timer = setTimeout(async () => {
			if (mine !== session || !stream) return;
			if (!reading && els.video.readyState >= 2) {
				reading = true;
				try {
					const text = await read(els.video);
					if (mine === session && text && found(text)) return;
				} catch (err) {
					stop();
					TDC.error(AREA, 'the QR reader stopped unexpectedly. Close this and try again.', err, els.status);
					return;
				} finally {
					reading = false;
				}
			}
			loop(mine);
		}, EVERY_MS);
	}

	function stop() {
		session++;
		clearTimeout(timer);
		timer = null;
		if (stream) {
			for (const t of stream.getTracks()) t.stop();
			stream = null;
		}
		if (els.video) els.video.srcObject = null;
	}

	async function open() {
		if (!dlg) build();
		stop();
		const mine = ++session;
		lastBad = null;
		TDC.status(els.status, '', '');
		TDC.cardOpen(dlg);

		// The camera and the reader start together; if either fails, the camera is
		// stopped, so it is never left on.
		const camera = startCamera();
		const starting = (async () => {
			try {
				const [s] = await Promise.all([camera, makeReader()]);
				if (mine !== session) { for (const t of s.getTracks()) t.stop(); return false; }
				stream = s;
				els.video.srcObject = s;
				await els.video.play();
				return true;
			} catch (err) {
				camera.then((s) => { if (s !== stream) for (const t of s.getTracks()) t.stop(); }, () => {});
				throw err;
			}
		})();

		try {
			const ok = await TDC.busy(els.view, starting, els.status);
			if (!ok || mine !== session) return;
			loop(mine);
		} catch (err) {
			if (mine !== session) return;
			stop();
			// Said in the sheet, which stays open until it is closed: it is opened from
			// the menu on any page, so there may be no status line of the page's to use.
			const cameraFailed = err && /NotAllowed|Security|NotFound|Overconstrained|NotReadable|Abort|Unsupported/.test(err.name || '');
			if (cameraFailed) {
				const message = cameraMessage(err);
				console.error(`[${AREA}] ${message}`, err);
				TDC.status(els.status, 'TDC (Error): ' + message, 'error');
			} else {
				TDC.error(AREA, 'the QR reader could not be loaded. Check the connection and try again.', err, els.status);
			}
		}
	}

	function shut() {
		stop();
		if (dlg) TDC.cardClose(dlg);
	}

	// Leaving the app (or the tab) closes the scanner, so the camera is never left on.
	document.addEventListener('visibilitychange', () => {
		if (document.hidden && dlg && dlg.open) shut();
	});

	return { open, close: shut };
})();
