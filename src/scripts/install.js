// The install tutorial, /install/ (UV, 3 Nov; docs/systems/foundations.md,
// "The install tutorial").
//
// One animation of the whole process in Safari, played over the drawing in
// _includes/install/safari.svg: a green dot for the finger moves, taps, drags
// and types. The timeline is a set of numbers keyed in time (the finger's
// position, how far the keyboard is up, the sheet, the dialog…), eased between
// keys, and render(t) draws any moment from them, so a step can be jumped to
// and the loop restarts cleanly.
//
// The finger's points are coordinates in the drawing's 390 × 844 points: move a
// button in the drawing and its point here moves with it.
//
// Full / Compact: Compact holds a small screen and the live step under the nav,
// short enough to stay above Safari's half-open Share sheet; the heading gives
// way so the block sits right under the nav. The page opens in
// Full until switched (UV, 3 Nov); the choice is kept on the device.

(() => {
	const AREA = 'Install';
	const $ = (id) => document.getElementById('ins-' + id);
	const msg = $('msg');
	if (!$('phone') || !$('stage')) {
		TDC.error(AREA, 'the tutorial could not be drawn.', null, msg);
		return;
	}
	const NS = 'http://www.w3.org/2000/svg';
	const el = (tag, attrs, parent) => {
		const e = document.createElementNS(NS, tag);
		for (const k in attrs) e.setAttribute(k, attrs[k]);
		if (parent) parent.appendChild(e);
		return e;
	};

	// ── The keyboard, from the screenshot's key positions ──
	const KEYPOS = {}, KEYEL = {};
	const keysG = $('keys');
	function addKey(id, cx, cy, w, label, cls, size) {
		KEYEL[id] = el('rect', { x: cx - w / 2, y: cy - 20.5, width: w, height: 41, rx: 6, class: cls || 'i-key' }, keysG);
		KEYPOS[id] = { x: cx, y: cy };
		if (label) {
			const t = el('text', { x: cx, y: cy + 7, class: 'i-keyl' }, keysG);
			if (size) t.setAttribute('font-size', size);
			t.textContent = label;
		}
	}
	const rows = [
		['qwertyuiop', [23, 61, 99, 138, 176, 214, 253, 291, 329, 367], 593],
		['asdfghjkl', [41, 80, 118, 156, 194, 233, 271, 310, 348], 645],
		['zxcvbnm', [80, 118, 156, 194, 233, 271, 310], 698],
	];
	for (const [letters, xs, y] of rows) [...letters].forEach((c, i) => addKey(c, xs[i], y, 32, c));
	addKey('shift', 28, 698, 44, '', 'i-key2');
	addKey('del', 361, 698, 44, '', 'i-key2');
	addKey('123', 51.5, 750, 89, '123', 'i-key2', 17);
	addKey('space', 190, 750, 176, '');
	addKey('.', 300, 750, 32, '.');
	addKey('go', 352.5, 750, 61, '', 'i-keygo');

	// ── The timeline ──
	const K = {};
	const key = (n, t, v) => (K[n] = K[n] || []).push([t, v]);
	const tw = (n, t0, t1, a, b) => { key(n, t0, a); key(n, t1, b); };
	let F = { x: 200, y: 700 };
	const at = (t, x, y) => { key('fx', t, x); key('fy', t, y); F = { x, y }; };
	const ripples = [], presses = [];
	const tap = (t) => { ripples.push({ t, x: F.x, y: F.y }); key('fp', t - 0.1, 0); key('fp', t, 1); key('fp', t + 0.14, 0); };

	const WORD = 'thediveclub.org';
	const S = [0];   // when each step starts

	// Before you start: open the site (the numbered steps start at ⋯, UV 3 Nov)
	key('fo', 0.2, 0); key('fo', 0.6, 1);
	at(0.2, 200, 700); at(0.75, 195, 791); tap(0.9);
	tw('kb', 1.0, 1.45, 0, 1);
	let tk = 1.7;
	for (const ch of WORD) {
		const p = KEYPOS[ch];
		at(tk - 0.12, F.x, F.y); at(tk - 0.02, p.x, p.y); tap(tk);
		presses.push({ t: tk, ch });
		tk += 0.2;
	}
	at(tk - 0.12, F.x, F.y); at(tk + 0.2, 352.5, 750);
	const go = tk + 0.32; tap(go); presses.push({ t: go, ch: 'go' });
	tw('kb', go + 0.1, go + 0.55, 1, 0);
	key('loadO', go + 0.1, 0); key('loadO', go + 0.15, 1); key('loadO', go + 1.1, 1); key('loadO', go + 1.35, 0);
	tw('load', go + 0.15, go + 1.1, 0, 1);
	tw('home', go + 0.3, go + 0.8, 0, 1);

	// 1. ⋯
	const s1 = go + 1.3; S.push(s1);
	at(s1, F.x, F.y); at(s1 + 0.45, 333, 791); tap(s1 + 0.6);
	tw('menu', s1 + 0.7, s1 + 1.0, 0, 1);

	// 2. Share
	const s2 = s1 + 1.3; S.push(s2);
	at(s2, F.x, F.y); at(s2 + 0.45, 205, 566); tap(s2 + 0.6);
	tw('menu', s2 + 0.7, s2 + 0.9, 1, 0);
	tw('sheet', s2 + 0.75, s2 + 1.25, 0, 1);

	// 3. View More, then drag the sheet up by its header (clear of every button)
	const s3 = s2 + 1.6; S.push(s3);
	at(s3, F.x, F.y); at(s3 + 0.45, 323, 757); tap(s3 + 0.6);
	tw('sx', s3 + 0.7, s3 + 1.2, 0, 1);
	at(s3 + 1.3, F.x, F.y); at(s3 + 1.7, 285, 230);
	key('fp', s3 + 1.75, 0); key('fp', s3 + 1.9, 1);
	at(s3 + 1.95, 285, 230); at(s3 + 2.6, 285, 150);
	tw('ls', s3 + 1.95, s3 + 2.6, 0, 1);
	key('fp', s3 + 2.65, 1); key('fp', s3 + 2.8, 0);
	at(s3 + 2.85, F.x, F.y); at(s3 + 3.3, 150, 789); tap(s3 + 3.45);

	// 4. Switch on Open as Web App, then Add
	const s4 = s3 + 3.6; S.push(s4);
	tw('dlg', s4, s4 + 0.5, 0, 1);
	tw('kb', s4 + 0.4, s4 + 0.8, 0, 1);
	at(s4 + 0.4, F.x, F.y); at(s4 + 0.85, 344, 304); tap(s4 + 1.0);
	tw('tog', s4 + 1.05, s4 + 1.3, 0, 1);
	at(s4 + 1.6, 344, 304); at(s4 + 2.05, 343, 107); tap(s4 + 2.2);

	// 5. Open it from the home screen
	const s5 = s4 + 2.35; S.push(s5);
	tw('dlg', s5, s5 + 0.45, 1, 0);
	tw('kb', s5, s5 + 0.35, 1, 0);
	tw('hs', s5 + 0.2, s5 + 0.7, 0, 1);
	tw('pop', s5 + 0.9, s5 + 1.4, 0, 1);
	at(s5 + 1.2, F.x, F.y); at(s5 + 1.65, 330.5, 508); tap(s5 + 1.8);
	tw('app', s5 + 1.9, s5 + 2.5, 0, 1);
	key('fo', s5 + 2.05, 1); key('fo', s5 + 2.45, 0);
	const D = s5 + 5.5;   // the loop's length

	for (const k of Object.values(K)) k.sort((a, b) => a[0] - b[0]);

	function V(n, t) {
		const k = K[n];
		if (!k) return 0;
		if (t <= k[0][0]) return k[0][1];
		for (let i = k.length - 1; i >= 0; i--) {
			if (t >= k[i][0]) {
				if (i === k.length - 1) return k[i][1];
				const [t0, a] = k[i], [t1, b] = k[i + 1];
				if (t1 === t0) return b;
				const p = (t - t0) / (t1 - t0);
				const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
				return a + (b - a) * e;
			}
		}
		return 0;
	}
	const backOut = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
	const op = (id, v) => { $(id).style.opacity = v; };
	const tf = (id, v) => $(id).setAttribute('transform', v);

	// ── The steps: the first is the lead-in, unnumbered ──
	const STEPS = [
		{ lead: true, title: 'Open thediveclub.org in Safari', text: 'Already here in Safari? Start at 1.' },
		{ title: 'Tap ⋯', text: 'The round button at the bottom right.' },
		{ title: 'Tap Share', text: 'At the top of the menu.' },
		{ title: 'Find Add to Home Screen', text: 'Tap View More, then drag the sheet up by its top.' },
		{ title: 'Switch on Open as Web App, then tap Add', text: 'It makes The Dive Club open full screen, like an app.' },
		{ title: 'Open it from your home screen', text: 'The Dive Club now sits with your other apps.' },
	];
	const NUMBERED = STEPS.length - 1;
	const list = $('steps');
	const stepEls = STEPS.map((s, i) => {
		const li = document.createElement('li');
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'install-step' + (s.lead ? ' is-lead' : '');
		b.innerHTML = '<span class="num"></span><span class="st"></span><span class="sd"></span><span class="bar"></span>';
		b.querySelector('.num').textContent = s.lead ? '' : i;
		b.querySelector('.st').textContent = s.title;
		b.querySelector('.sd').textContent = s.text;
		b.addEventListener('click', () => { t = S[i] + 0.001; dirty = true; });
		li.appendChild(b);
		list.appendChild(li);
		return b;
	});

	let shownStep = -1;
	function render(t) {
		const kb = V('kb', t), home = V('home', t), menu = V('menu', t), sheet = V('sheet', t);
		const sx = V('sx', t), ls = V('ls', t), dlg = V('dlg', t), hs = V('hs', t), pop = V('pop', t), app = V('app', t);
		const typing = t < S[1], inDlg = t >= S[4];

		op('typeov', typing ? kb : 0);
		op('bar-rest', typing ? 1 - kb : 1);
		op('bar-type', typing ? kb : 0);
		tf('bar-type', `translate(0 ${(1 - kb) * 273})`);
		tf('kb', `translate(0 ${(1 - kb) * 330})`);
		op('kb-strip', inDlg ? 1 : 0);
		$('kb-bg').setAttribute('y', inDlg ? 522 : 549);
		op('go-arrow', inDlg ? 0 : 1);
		op('go-check', inDlg ? 1 : 0);

		op('f-empty', 1 - home);
		op('f-url', home);
		op('home-safari', home);
		$('loadbar').setAttribute('width', 390 * V('load', t));
		op('loadbar', V('loadO', t));

		op('menu', menu);
		tf('menu', `translate(359 814) scale(${0.5 + 0.5 * menu}) translate(-359 -814)`);
		// The sheet is drawn half open (its top at 329): View More lifts it,
		// the drag lifts it the rest of the way.
		const top = 329 - 188 * sx - 80 * ls;
		tf('sheet', `translate(0 ${top - 329 + (1 - sheet) * 560})`);
		op('sheet', sheet > 0.001 && dlg < 0.999 ? 1 : 0);
		op('dim', Math.max(sheet, dlg) * 0.35);
		op('vm-more', 1 - sx);
		op('vm-more-l', 1 - sx);
		op('vm-less', sx);
		op('vm-less-l', sx);
		op('sh-list', sx);
		op('sh-close', sx);
		tf('dlg', `translate(0 ${(1 - dlg) * 800})`);
		const tog = V('tog', t);
		op('tog-on', tog);
		$('tog-knob').setAttribute('x', 316 + 22 * tog);

		op('hs', hs);
		tf('hs-icon', `translate(330.5 508.5) scale(${Math.max(0, backOut(pop))}) translate(-330.5 -508.5)`);
		op('hs-label', pop);
		op('app', Math.min(1, app * 3));
		const s = 0.16 + 0.84 * app;
		tf('app', `translate(330.5 508.5) scale(${s}) translate(-330.5 -508.5)`);

		// Typing
		let n = 0, lastPress = -9;
		for (const p of presses) if (p.t <= t && p.ch !== 'go') { n++; lastPress = p.t; }
		const typed = $('typed');
		typed.textContent = WORD.slice(0, n);
		const w = n ? typed.getComputedTextLength() : 0;
		$('caret').setAttribute('x', 20 + w + 1);
		op('caret', (t - lastPress < 0.5 || Math.floor(t * 2) % 2 === 0) ? 1 : 0);
		op('sugg', n >= 3 ? 1 : 0);
		for (const id in KEYEL) KEYEL[id].classList.remove('i-down');
		for (const p of presses) if (t >= p.t && t - p.t < 0.16) KEYEL[p.ch].classList.add('i-down');

		// The finger
		const fp = V('fp', t);
		const f = $('finger');
		f.setAttribute('cx', V('fx', t));
		f.setAttribute('cy', V('fy', t));
		f.setAttribute('r', 12 - 3 * fp);
		f.setAttribute('fill-opacity', 0.8 + 0.2 * fp);
		op('finger', V('fo', t));
		const live = ripples.filter((r) => t >= r.t && t - r.t < 0.35);
		for (let i = 0; i < 2; i++) {
			const c = $('rip' + i), r = live[i];
			if (!r) { c.style.opacity = 0; continue; }
			const p = (t - r.t) / 0.35;
			c.setAttribute('cx', r.x);
			c.setAttribute('cy', r.y);
			c.setAttribute('r', 12 + 22 * p);
			c.style.opacity = 0.8 * (1 - p);
		}

		// The steps
		let cur = 0;
		for (let i = 0; i < S.length; i++) if (t >= S[i]) cur = i;
		stepEls.forEach((b, i) => {
			b.classList.toggle('is-live', i === cur);
			b.classList.toggle('is-done', i < cur);
			const end = i + 1 < S.length ? S[i + 1] : D;
			b.querySelector('.bar').style.width = i === cur ? `${Math.min(100, ((t - S[i]) / (end - S[i])) * 100)}%` : '0';
		});
		if (cur !== shownStep) {
			shownStep = cur;
			$('cap-n').textContent = STEPS[cur].lead ? 'Before you start' : `Step ${cur} of ${NUMBERED}`;
			$('cap-t').textContent = STEPS[cur].title;
			positionSteps();
		}
	}

	// In Compact the list scrolls so the live step sits at the top of its window.
	function positionSteps() {
		const li = stepEls[Math.max(0, shownStep)].parentElement;
		list.style.transform = stage.classList.contains('is-compact') ? `translateY(${-li.offsetTop}px)` : '';
	}

	// ── Playback ──
	// The site's own less-motion setting (the profile menu, or the phone's):
	// the animation waits for Play.
	const reduce = typeof TDCPrefs !== 'undefined' ? TDCPrefs.lessMotion : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let playing = !reduce, t = 0, last = null, dirty = true;
	// ?t= and ?mode=compact hold a moment for headless layout checks.
	const q = new URLSearchParams(location.search);
	if (q.has('t')) { t = parseFloat(q.get('t')) || 0; playing = false; }
	const playBtn = $('play');
	const setPlay = (on) => {
		playing = on;
		playBtn.textContent = on ? 'Pause' : 'Play';
		playBtn.classList.toggle('is-on', on);
	};
	setPlay(playing);
	playBtn.addEventListener('click', () => setPlay(!playing));
	$('replay').addEventListener('click', () => { t = 0; dirty = true; setPlay(true); });

	// ── Full / Compact ──
	const stage = $('stage');
	const MODE = 'tdc.install-mode';
	let mode = 'full';
	try { mode = localStorage.getItem(MODE) || 'full'; } catch (e) { /* private browsing: Full */ }
	if (q.get('mode') === 'compact') mode = 'compact';
	function applyMode(m) {
		mode = m;
		stage.classList.toggle('is-compact', m === 'compact');
		stage.parentElement.classList.toggle('is-compact', m === 'compact');
		$('m-full').setAttribute('aria-pressed', String(m === 'full'));
		$('m-compact').setAttribute('aria-pressed', String(m === 'compact'));
		positionSteps();
	}
	function setMode(m) {
		if (m === mode) return;
		try { localStorage.setItem(MODE, m); } catch (e) { /* not kept; the switch still works */ }
		// Into Compact, the page scrolls so the block sits under the nav.
		const toTop = () => { if (m === 'compact') stage.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); };
		if (document.startViewTransition && !reduce) {
			document.startViewTransition(() => applyMode(m)).finished.then(toTop, toTop);
		} else {
			applyMode(m);
			toTop();
		}
	}
	$('m-full').addEventListener('click', () => setMode('full'));
	$('m-compact').addEventListener('click', () => setMode('compact'));
	window.addEventListener('resize', positionSteps);
	applyMode(mode);

	function frame(now) {
		if (last !== null && playing) {
			t += Math.min(0.1, (now - last) / 1000);
			if (t > D) t = 0;
		}
		last = now;
		if (playing || dirty) {
			try {
				render(t);
			} catch (err) {
				playing = false;
				TDC.error(AREA, 'the tutorial stopped.', err, msg);
				return;
			}
			dirty = false;
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
})();
