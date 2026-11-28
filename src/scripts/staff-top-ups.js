// Staff top-ups page (/staff/top-ups/; 24 Nov; docs/design/shop.md, Stage 1). Any staff at the venue.
// A player asked for credits on the Add credits card and is paying at the bar. Staff find the request
// (the player's QR opens this page with ?code=; or the code is typed; or tapped in the Waiting list),
// see who it is and what to charge, take the money, tap Cash or Card, and confirm. The credits land at
// once (tdc_staff_confirm_top_up, which also refuses your own request and a paid, cancelled or expired
// one). A wrong confirmation is put right by an owner or admin on /staff/credits/, never undone here.
// Needs: supabaseClient.js, tdc.js, staff-common.js.

TDCLoader.hold((async () => {
	const AREA = 'StaffTopUps';
	const AVATAR_BUCKET = 'player-avatars';

	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea:  el('staff-area'),
		findForm:   el('find-form'),
		findCode:   el('find-code'),
		findBtn:    el('find-btn'),
		scanBtn:    el('scan-btn'),
		request:    el('request'),
		reqPic:     el('req-pic'),
		reqName:    el('req-name'),
		reqFull:    el('req-full'),
		reqCredits: el('req-credits'),
		reqPay:     el('req-pay'),
		reqCode:    el('req-code'),
		reqWhen:    el('req-when'),
		reqSaid:    el('req-said'),
		reqAct:     el('req-act'),
		payCash:    el('pay-cash'),
		payCard:    el('pay-card'),
		confirmBtn: el('confirm-btn'),
		backBtn:    el('back-btn'),
		waiting:    el('waiting'),
		list:       el('waiting-list')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'top-ups page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	const venue = () => els.selectEl.value;
	let current = null;   // the request on screen
	let method = null;    // 'cash' or 'card'

	function rand(cents) {
		return 'R' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
	}
	function ago(iso) {
		const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins} min ago`;
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}
	function initials(name) {
		return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
	}

	// ─── The Waiting list ───
	async function loadList() {
		const { data, error } = await TDC.busy(els.list, supabaseClient.rpc('tdc_staff_top_ups', { p_venue_id: venue() }), els.statusEl);
		if (error) {
			TDC.showSupabaseError(AREA, error, els.statusEl);
			return;
		}
		const rows = data || [];
		if (!rows.length) {
			const none = document.createElement('div');
			none.className = 'muted';
			none.textContent = 'Nothing waiting.';
			els.list.replaceChildren(none);
			return;
		}
		els.list.replaceChildren(...rows.map((t) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'result';
			const name = document.createElement('div');
			name.textContent = t.display_name;
			const sub = document.createElement('div');
			sub.className = 'sub';
			sub.textContent = `${t.code} · ${t.credits} credits · ${rand(t.pay_cents)} · ${ago(t.created_at)}`;
			btn.append(name, sub);
			btn.addEventListener('click', () => show(t));
			return btn;
		}));
	}

	// ─── One request ───
	function show(t) {
		current = t;
		method = null;
		drawMethod();
		TDC.status(els.statusEl, '', '');

		els.reqName.textContent = t.display_name;
		els.reqFull.replaceChildren(TDC.fullNameOf(t.first_name, t.last_name));
		const url = TDC.pictureUrl(AVATAR_BUCKET, t.avatar_path);
		if (url) {
			const img = document.createElement('img');
			img.alt = '';
			img.src = url;
			img.addEventListener('error', () => { els.reqPic.textContent = initials(t.display_name); });
			els.reqPic.replaceChildren(img);
		} else {
			els.reqPic.textContent = initials(t.display_name);
		}
		els.reqCredits.textContent = `${t.credits}` + (t.discount_pct ? ` (${t.discount_pct}% off)` : '');
		els.reqPay.textContent = rand(t.pay_cents);
		els.reqCode.textContent = t.code;
		els.reqWhen.textContent = ago(t.created_at);

		// Only a waiting one can be confirmed; anything else says why.
		const said = {
			paid: `Already paid${t.paid_method ? ' (' + (t.paid_method === 'cash' ? 'Cash' : 'Card') + ')' : ''}. Nothing to do.`,
			expired: 'This request has expired. Ask them to start a new one on their phone.',
			cancelled: 'This request was cancelled. Ask them to show their newest code.'
		}[t.state];
		els.reqSaid.textContent = said || '';
		els.reqSaid.hidden = !said;
		els.reqAct.hidden = t.state !== 'waiting';
		els.confirmBtn.textContent = `Confirm payment · ${rand(t.pay_cents)}`;

		els.request.hidden = false;
		els.waiting.hidden = true;
		els.findForm.hidden = true;
	}

	function backToList() {
		current = null;
		els.request.hidden = true;
		els.waiting.hidden = false;
		els.findForm.hidden = false;
		// The QR's ?code= is done with once its request has been dealt with.
		if (location.search) history.replaceState(null, '', location.pathname);
		return loadList();
	}

	function drawMethod() {
		for (const [btn, m] of [[els.payCash, 'cash'], [els.payCard, 'card']]) {
			btn.setAttribute('aria-pressed', method === m ? 'true' : 'false');
			btn.classList.toggle('is-on', method === m);
		}
		els.confirmBtn.disabled = !method;
	}
	els.payCash.addEventListener('click', () => { method = 'cash'; drawMethod(); });
	els.payCard.addEventListener('click', () => { method = 'card'; drawMethod(); });
	els.backBtn.addEventListener('click', () => { TDC.status(els.statusEl, '', ''); backToList(); });

	async function find(code) {
		const clean = (code || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
		if (!clean) {
			TDC.status(els.statusEl, 'Please enter a code.', 'error');
			return;
		}
		const { data, error } = await TDC.busy(els.findBtn, supabaseClient.rpc('tdc_staff_find_top_up', { p_venue_id: venue(), p_code: clean }), els.statusEl);
		if (error) {
			TDC.showSupabaseError(AREA, error, els.statusEl);
			return;
		}
		if (!data) {
			TDC.status(els.statusEl, `No request with the code ${clean} here. Check it, or the venue.`, 'error');
			return;
		}
		els.findCode.value = '';
		show(data);
	}
	els.findForm.addEventListener('submit', (e) => {
		e.preventDefault();
		find(els.findCode.value);
	});
	// Scan: the player's QR read from inside the app (scripts/qr-scan.js); it opens
	// this page's ?code= link, or an order's on the Orders page.
	els.scanBtn.addEventListener('click', () => TDCScan.open());

	els.confirmBtn.addEventListener('click', async () => {
		if (!current || !method) return;
		const t = current;
		els.confirmBtn.disabled = true;
		try {
			const { data, error } = await TDC.busy(els.confirmBtn, supabaseClient.rpc('tdc_staff_confirm_top_up', {
				p_venue_id: venue(), p_top_up_id: t.id, p_method: method
			}), els.statusEl);
			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				els.confirmBtn.disabled = false;
				return;
			}
			TDC.flushEmails();
			await backToList();
			TDC.status(els.statusEl, `✓ ${t.credits} credits added for ${t.display_name}. Their balance: ${data}.`, 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem confirming that payment.', err, els.statusEl);
			els.confirmBtn.disabled = false;
		}
	});

	els.selectEl.addEventListener('change', () => { TDC.status(els.statusEl, '', ''); backToList(); });

	// The player's QR: /staff/top-ups/?code=7K4Q opens straight on the request.
	const fromQr = new URLSearchParams(location.search).get('code');
	await loadList();
	if (fromQr) await find(fromQr);
})(), 'StaffTopUps');
