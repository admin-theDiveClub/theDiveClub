// Staff orders page (/staff/orders/; 24 Nov; docs/design/shop.md, Stage 4; canvas artboards 5, 6).
// Any staff at the venue (UV, 24 Nov). Every open order in three columns, New · Preparing · Ready
// to collect (tabs on a phone), oldest first, each with one button to move it on. A tap on a card
// opens it over the page: who it is for, the lines, how it is paid, its next step, one step back
// (UV), and Cancel order (out of stock; credits back at once, UV). A Ready order is handed over
// there: Cash or Card for one paid at the club (UV, as top-ups), then Mark collected. No ID check
// (UV, 24 Nov). Nobody hands over or cancels their own order (the database refuses it too).
//
// The page asks for the queue every 5 s while it is shown (UV); a new order chimes, if Sound is on,
// and its card flashes (UV). Browsers play sound only after a first tap on the page.
// The player's QR is /staff/orders/?order=<id> and opens that order's card. The code box takes an
// order number (B27) or a top-up code (7K4Q, which opens /staff/top-ups/ on it).
// Needs: supabaseClient.js, tdc.js, staff-common.js. Styles: credits-card.css (.cc), staff-orders.css.

TDCLoader.hold((async () => {
	const AREA = 'StaffOrders';
	const AVATAR_BUCKET = 'player-avatars';
	const POLL_MS = 5000;
	const FLASH_MS = 6000;
	const SOUND_KEY = 'tdc.orders.sound';
	const COLS = ['placed', 'preparing', 'ready'];
	const NEXT = { placed: 'preparing', preparing: 'ready' };
	const BACK = { preparing: 'placed', ready: 'preparing' };
	const STEP_WORD = { placed: 'New', preparing: 'Preparing', ready: 'Ready', collected: 'Collected', cancelled: 'Cancelled' };

	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea: el('staff-area'),
		findForm:  el('find-form'),
		findCode:  el('find-code'),
		findBtn:   el('find-btn'),
		topups:    el('topups-link'),
		sound:     el('sound-on'),
		tabTrack:  el('oq-tab-track'),
		board:     el('oq-board'),
		placed:    el('list-placed'),
		preparing: el('list-preparing'),
		ready:     el('list-ready'),
		cPlaced:   el('count-placed'),
		cPreparing: el('count-preparing'),
		cReady:    el('count-ready')
	};
	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'orders page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	const venue = () => els.selectEl.value;
	let orders = [];          // the open orders, as tdc_staff_orders gives them
	let seen = null;          // ids already shown (null until the first read, so nothing chimes then)
	const flashing = new Map();   // id -> when its flash ends
	let writing = 0;          // writes in flight: the quiet checks wait for them
	let pollTimer = null;

	function make(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}
	function rand(cents) {
		return 'R' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
	}
	function credits(n) { return n + (n === 1 ? ' credit' : ' credits'); }
	function ago(iso) {
		const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins} min`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs} h ${mins % 60} min`;
		return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
	}
	// "placed just now", "placed 4 min ago", "placed Tue, 24 Nov".
	function placedAgo(iso) {
		const a = ago(iso);
		return /min$/.test(a) ? a + ' ago' : a;
	}
	// Messages go into the order's card while it is open, else onto the page.
	const msg = () => (sheet.dlg.open ? sheet.status : els.statusEl);
	// Merch waits up to 30 days: "Merch · day 3 of 30" in place of the minutes.
	function when(o) {
		if (!o.collect_by) return ago(o.placed_at);
		const day = Math.max(1, Math.ceil((Date.now() - new Date(o.placed_at).getTime()) / 86400000));
		return `merch · day ${day} of 30`;
	}
	function linesText(o) {
		return o.lines.map((l) => `${l.qty} × ${l.name}`).join(' · ');
	}
	function initials(name) {
		return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
	}
	function payTag(o) {
		const paid = o.pay_with === 'credits';
		return make('span', 'oq-tag ' + (paid ? 'is-paid' : 'is-club'),
			paid ? 'Paid · credits' : `Pay at club · ${rand(o.pay_cents)}`);
	}

	// ─── Sound ───
	// A short two-note chime made in the browser (no sound file). Remembered per device.
	try { els.sound.checked = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { /* storage blocked: stays on */ }
	els.sound.addEventListener('change', () => {
		try { localStorage.setItem(SOUND_KEY, els.sound.checked ? 'on' : 'off'); } catch (e) { /* not remembered */ }
		if (els.sound.checked) wakeAudio();
	});
	let audio = null;
	function wakeAudio() {
		try {
			if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
			if (audio.state === 'suspended') audio.resume();
		} catch (err) {
			console.error(`[${AREA}] sound is not available in this browser.`, err);
		}
	}
	document.addEventListener('pointerdown', wakeAudio, { once: true });
	function chime() {
		if (!els.sound.checked || !audio || audio.state !== 'running') return;
		const t = audio.currentTime;
		[[880, 0], [1320, 0.16]].forEach(([freq, at]) => {
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			osc.type = 'sine';
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, t + at);
			gain.gain.exponentialRampToValueAtTime(0.25, t + at + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.35);
			osc.connect(gain).connect(audio.destination);
			osc.start(t + at);
			osc.stop(t + at + 0.4);
		});
	}

	// ─── Phone tabs ───
	els.tabTrack.addEventListener('click', (e) => {
		const b = e.target.closest('button[data-tab]');
		if (!b) return;
		for (const x of els.tabTrack.querySelectorAll('button')) x.removeAttribute('aria-current');
		b.setAttribute('aria-current', 'page');
		els.board.dataset.tab = b.dataset.tab;
	});

	// ─── The queue ───
	async function load({ quiet } = {}) {
		const call = supabaseClient.rpc('tdc_staff_orders', { p_venue_id: venue() });
		const { data, error } = await (quiet ? call : TDC.busy(els.board, call, els.statusEl));
		if (error) {
			TDC.showSupabaseError(AREA, error, msg());
			return;
		}
		orders = (data && data.orders) || [];
		const waiting = (data && data.top_ups_waiting) || 0;
		els.topups.hidden = !waiting;
		els.topups.textContent = waiting === 1 ? '1 top-up waiting' : `${waiting} top-ups waiting`;

		// New since the last read: chime once, flash each.
		const ids = new Set(orders.map((o) => o.id));
		if (seen) {
			const fresh = orders.filter((o) => !seen.has(o.id) && o.status === 'placed');
			if (fresh.length) {
				chime();
				for (const o of fresh) flashing.set(o.id, Date.now() + FLASH_MS);
			}
		}
		seen = ids;
		draw();
		if (sheet.order) {
			const now = orders.find((o) => o.id === sheet.order.id);
			if (now && now.status !== sheet.order.status) drawSheet(now);
		}
	}

	function draw() {
		const now = Date.now();
		for (const [id, end] of flashing) if (end <= now) flashing.delete(id);
		const counts = { placed: els.cPlaced, preparing: els.cPreparing, ready: els.cReady };
		for (const col of COLS) {
			const rows = orders.filter((o) => o.status === col);
			counts[col].textContent = rows.length ? `· ${rows.length}` : '';
			const tabBtn = els.tabTrack.querySelector(`[data-tab="${col}"]`);
			tabBtn.textContent = (STEP_WORD[col]) + (rows.length ? ` · ${rows.length}` : '');
			if (!rows.length) {
				els[col].replaceChildren(make('p', 'muted oq-none', 'Nothing here.'));
				continue;
			}
			els[col].replaceChildren(...rows.map(card));
		}
	}

	function card(o) {
		const c = make('article', 'oq-card' + (o.status === 'ready' ? ' is-ready' : '') + (flashing.has(o.id) ? ' is-new' : ''));
		const open = make('button', 'oq-open');
		open.type = 'button';
		open.dataset.noDots = '';   // opens the card over the page; no wait of its own
		open.setAttribute('aria-label', `Order ${o.label}, ${o.display_name}`);
		const head = make('div', 'oq-card-head');
		head.append(make('strong', 'oq-label', o.label), make('span', 'oq-when', when(o)));
		open.append(head, make('div', 'oq-name', o.display_name), make('div', 'oq-lines', linesText(o)));
		open.addEventListener('click', () => openSheet(o));

		const foot = make('div', 'oq-card-foot');
		foot.append(payTag(o));
		if (o.status === 'ready') {
			const b = make('button', 'btn btn-primary oq-go', 'Hand over');
			b.type = 'button';
			b.dataset.noDots = '';
			b.addEventListener('click', () => openSheet(o));
			foot.append(b);
		} else {
			const b = make('button', 'btn oq-go ' + (o.status === 'placed' ? 'btn-primary' : 'oq-go-ready'),
				o.status === 'placed' ? 'Start' : 'Ready');
			b.type = 'button';
			b.addEventListener('click', () => move(o, NEXT[o.status], b));
			foot.append(b);
		}
		c.append(open, foot);
		return c;
	}

	// ─── Writes ───
	// After each, the queue is read again from the server (CLAUDE.md, idea 6).
	async function write(control, rpc, args) {
		writing++;
		const out = msg();
		TDC.status(out, '', '');
		try {
			const { data, error } = await TDC.busy(control, supabaseClient.rpc(rpc, args), out);
			if (error) {
				TDC.showSupabaseError(AREA, error, out);
				await load({ quiet: true });
				return null;
			}
			// Ready and Cancel tell the player: start the push now rather than waiting for the nav's.
			TDC.flushPushes();
			return data;
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving that order.', err, out);
			return null;
		} finally {
			writing--;
		}
	}

	async function move(o, to, control) {
		if (control) control.disabled = true;
		const data = await write(control, 'tdc_staff_move_order', {
			p_venue_id: venue(), p_order_id: o.id, p_from: o.status, p_to: to
		});
		if (control) control.disabled = false;
		if (!data) return null;
		await load({ quiet: true });
		return data;
	}

	// ─── One order, over the page (artboard 6) ───
	const sheet = buildSheet();

	function buildSheet() {
		const dlg = make('dialog', 'cc oq-sheet');
		dlg.setAttribute('aria-labelledby', 'oq-sheet-title');
		dlg.dataset.pull = 'off';
		const head = make('div', 'cc-head');
		const title = make('h2', null, 'Order');
		title.id = 'oq-sheet-title';
		title.tabIndex = -1;
		title.autofocus = true;
		const close = make('button', 'cc-icon', '✕');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close');
		head.append(title, close);

		const person = make('div', 'oq-person');
		const pic = make('span', 'oq-pic');
		pic.setAttribute('aria-hidden', 'true');
		const who = make('div');
		const name = make('div', 'oq-person-name');
		const full = make('div', 'oq-person-full');
		who.append(name, full);
		person.append(pic, who);

		const step = make('p', 'oq-step');
		const lines = make('div', 'cc-lines oq-sheet-lines');
		const said = make('p', 'oq-said');
		const ways = make('div', 'oq-ways');
		ways.setAttribute('role', 'group');
		ways.setAttribute('aria-label', 'How they paid');
		const way = (words, key) => {
			const b = make('button', 'cc-way oq-way');
			b.type = 'button';
			b.dataset.method = key;
			b.dataset.noDots = '';   // a choice, with no wait of its own
			b.setAttribute('aria-pressed', 'false');
			b.append(make('span', null, words));
			b.addEventListener('click', () => { s.method = key; drawMethod(); });
			return b;
		};
		const cash = way('Cash', 'cash');
		const cardWay = way('Card', 'card');
		ways.append(cash, cardWay);
		const main = make('button', 'btn btn-primary oq-main');
		main.type = 'button';
		const back = make('button', 'btn btn-secondary oq-back');
		back.type = 'button';
		const cancel = make('button', 'btn btn-secondary oq-cancel', 'Cancel order');
		cancel.type = 'button';
		const status = make('div', 'status');
		dlg.append(head, person, step, lines, said, ways, main, back, cancel, status);
		document.body.appendChild(dlg);

		const s = { dlg, title, pic, name, full, step, lines, said, ways, cash, card: cardWay, main, back, cancel, status, order: null, method: null };
		close.addEventListener('click', () => shutSheet());
		dlg.addEventListener('click', (e) => { if (e.target === dlg) shutSheet(); });
		dlg.addEventListener('close', () => {
			s.order = null;
			// The QR's ?order= is done with once its card is closed.
			if (location.search) history.replaceState(null, '', location.pathname);
		});
		main.addEventListener('click', sheetMain);
		back.addEventListener('click', sheetBack);
		cancel.addEventListener('click', sheetCancel);
		return s;
	}

	function openSheet(o) {
		sheet.method = null;
		TDC.status(sheet.status, '', '');
		drawSheet(o);
		if (!sheet.dlg.open) sheet.dlg.showModal();
	}
	function shutSheet() {
		if (sheet.dlg.open) sheet.dlg.close();
	}

	function drawSheet(o) {
		const s = sheet;
		if (!s.order || s.order.id !== o.id || s.order.status !== o.status) s.method = null;
		s.order = o;
		s.title.textContent = '';
		s.title.append('Order ', make('span', 'oq-sheet-label', o.label));

		s.name.textContent = o.display_name;
		s.full.replaceChildren(TDC.fullNameOf(o.first_name, o.last_name));
		const url = TDC.pictureUrl(AVATAR_BUCKET, o.avatar_path);
		if (url) {
			const img = document.createElement('img');
			img.alt = '';
			img.src = url;
			img.addEventListener('error', () => { s.pic.textContent = initials(o.display_name); });
			s.pic.replaceChildren(img);
		} else {
			s.pic.textContent = initials(o.display_name);
		}

		const open = COLS.includes(o.status);
		s.step.textContent = open ? `${STEP_WORD[o.status]} · placed ${placedAgo(o.placed_at)}` : STEP_WORD[o.status];
		s.step.className = 'oq-step is-' + o.status;

		const row = (cls, a, b) => {
			const r = make('div', 'cc-line' + (cls ? ' ' + cls : ''));
			r.append(make('span', null, a), make('span', null, b));
			return r;
		};
		const rows = o.lines.map((l) => row('', l.qty > 1 ? `${l.name} × ${l.qty}` : l.name, String(l.qty * l.price_credits)));
		if (o.pay_with === 'credits') {
			rows.push(row('is-total oq-paid', 'Paid · credits', credits(o.total_credits)));
		} else if (o.paid_at) {
			rows.push(row('is-total oq-paid', `Paid at the club · ${o.paid_method === 'card' ? 'Card' : 'Cash'}`, rand(o.pay_cents)));
		} else {
			rows.push(row('is-total oq-club', 'To pay', `${rand(o.pay_cents)} · ${credits(o.total_credits)}`));
		}
		s.lines.replaceChildren(...rows);

		// What may be done from here.
		let said = '';
		if (o.status === 'collected') said = 'Handed over. Nothing to do.';
		else if (o.status === 'cancelled') said = 'This order was cancelled.' + (o.pay_with === 'credits' ? ` ${credits(o.total_credits)} went back.` : '');
		else if (o.is_mine) said = 'Your own order: another staff member hands it over.';
		s.said.textContent = said;
		s.said.hidden = !said;

		const handing = o.status === 'ready' && !o.is_mine;
		s.ways.hidden = !(handing && o.pay_with === 'club');
		s.main.hidden = !open || (o.status === 'ready' && o.is_mine);
		s.main.textContent = { placed: 'Start', preparing: 'Ready', ready: o.pay_with === 'club' ? `Mark collected · ${rand(o.pay_cents)}` : 'Mark collected' }[o.status] || '';
		s.back.hidden = !BACK[o.status];
		s.back.textContent = BACK[o.status] ? `Back to ${STEP_WORD[BACK[o.status]]}` : '';
		s.cancel.hidden = !open || o.is_mine;
		drawMethod();
	}

	function drawMethod() {
		const s = sheet;
		for (const b of [s.cash, s.card]) {
			const on = s.method === b.dataset.method;
			b.setAttribute('aria-pressed', on ? 'true' : 'false');
			b.classList.toggle('is-on', on);
		}
		const o = s.order;
		s.main.disabled = !!(o && o.status === 'ready' && o.pay_with === 'club' && !s.method);
	}

	async function sheetMain() {
		const o = sheet.order;
		if (!o) return;
		if (o.status !== 'ready') {
			sheet.main.disabled = true;
			const data = await write(sheet.main, 'tdc_staff_move_order', {
				p_venue_id: venue(), p_order_id: o.id, p_from: o.status, p_to: NEXT[o.status]
			});
			sheet.main.disabled = false;
			if (data) {
				await load({ quiet: true });
				if (sheet.order && sheet.order.id === data.id) drawSheet(data);
			} else {
				await refreshSheet();
			}
			return;
		}
		sheet.main.disabled = true;
		const data = await write(sheet.main, 'tdc_staff_collect_order', {
			p_venue_id: venue(), p_order_id: o.id, p_method: o.pay_with === 'club' ? sheet.method : null
		});
		if (!data) {
			sheet.main.disabled = false;
			await refreshSheet();
			return;
		}
		shutSheet();
		await load({ quiet: true });
		const paid = data.pay_with === 'club' ? ` ${rand(data.pay_cents)} by ${data.paid_method === 'card' ? 'card' : 'cash'}.` : '';
		TDC.status(els.statusEl, `✓ ${data.label} handed over to ${data.display_name}.${paid}`, 'success');
	}

	async function sheetBack() {
		const o = sheet.order;
		if (!o || !BACK[o.status]) return;
		sheet.back.disabled = true;
		const data = await write(sheet.back, 'tdc_staff_move_order', {
			p_venue_id: venue(), p_order_id: o.id, p_from: o.status, p_to: BACK[o.status]
		});
		sheet.back.disabled = false;
		if (data) {
			await load({ quiet: true });
			if (sheet.order && sheet.order.id === data.id) drawSheet(data);
		} else {
			await refreshSheet();
		}
	}

	async function sheetCancel() {
		const o = sheet.order;
		if (!o) return;
		const back = o.pay_with === 'credits' ? `\n\n${o.display_name}'s ${credits(o.total_credits)} go back at once, and they are told.` : `\n\n${o.display_name} is told.`;
		if (!confirm(`Cancel order ${o.label}?${back}`)) return;
		sheet.cancel.disabled = true;
		const data = await write(sheet.cancel, 'tdc_staff_cancel_order', { p_venue_id: venue(), p_order_id: o.id });
		sheet.cancel.disabled = false;
		if (!data) {
			await refreshSheet();
			return;
		}
		shutSheet();
		await load({ quiet: true });
		TDC.status(els.statusEl, `${data.label} cancelled.` + (data.pay_with === 'credits' ? ` ${credits(data.total_credits)} back to ${data.display_name}.` : ''), 'success');
	}

	// The card's order read again by itself (after a refusal, so it shows what is true now).
	async function refreshSheet() {
		const o = sheet.order;
		if (!o) return;
		const { data, error } = await supabaseClient.rpc('tdc_staff_order', { p_venue_id: venue(), p_order_id: o.id });
		if (error) {
			TDC.showSupabaseError(AREA, error, sheet.status);
			return;
		}
		if (sheet.order && sheet.order.id === data.id) drawSheet(data);
	}
	// ─── Find by code ───
	async function find(raw) {
		const clean = (raw || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
		if (!clean) {
			TDC.status(els.statusEl, 'Please enter a code.', 'error');
			return;
		}
		if (/^[A-G]\d{1,5}$/.test(clean)) {
			const { data, error } = await TDC.busy(els.findBtn, supabaseClient.rpc('tdc_staff_find_order', { p_venue_id: venue(), p_label: clean }), els.statusEl);
			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}
			const found = data || [];
			if (found.length) {
				els.findCode.value = '';
				openSheet(found[0]);
				if (found.length > 1) TDC.status(sheet.status, `There are ${found.length} open orders ${clean}; this is the newest.`, '');
				return;
			}
			if (clean.length !== 4) {
				TDC.status(els.statusEl, `No order ${clean} here. Check it, or the venue.`, 'error');
				return;
			}
		}
		if (clean.length === 4) {
			// A top-up code: its own page.
			location.href = '/staff/top-ups/?code=' + encodeURIComponent(clean);
			return;
		}
		TDC.status(els.statusEl, `No order or top-up with the code ${clean}. Check it.`, 'error');
	}
	els.findForm.addEventListener('submit', (e) => {
		e.preventDefault();
		find(els.findCode.value);
	});

	// ─── Checking by itself ───
	function schedule() {
		clearTimeout(pollTimer);
		pollTimer = setTimeout(tick, POLL_MS);
	}
	async function tick() {
		if (!document.hidden && !writing) await load({ quiet: true });
		schedule();
	}
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden && !writing) { load({ quiet: true }); schedule(); }
	});

	els.selectEl.addEventListener('change', () => {
		TDC.status(els.statusEl, '', '');
		shutSheet();
		seen = null;
		load();
	});

	// The player's QR: /staff/orders/?order=<id> opens straight on its card.
	await load();
	schedule();
	const fromQr = new URLSearchParams(location.search).get('order');
	if (fromQr) {
		const { data, error } = await TDC.busy(els.board, supabaseClient.rpc('tdc_staff_order', { p_venue_id: venue(), p_order_id: fromQr }), els.statusEl);
		if (error) TDC.showSupabaseError(AREA, error, els.statusEl);
		else openSheet(data);
	}
})(), 'StaffOrders');
