// The order card (UV, 24 Nov; docs/design/shop.md, Stage 3; canvas artboard 4).
// One card over the page, never leaving it: the order's number large (B27: the weekday's letter,
// A = Monday, then the day's number at the venue), a QR, Placed → Preparing → Ready → Collected,
// the lines and how it is paid. Cancel order while it is placed (UV, 24 Nov: until staff start
// it), asked first; credits paid come back at once. While it is open and still on its way, it asks
// every few seconds whether staff have moved it on (Stage 4 moves it), as the Add credits card does.
// "We'll email you when it's ready." while it is Placed or Preparing and the player's Ready to
// collect email is on (Stage 5), asked each time the card opens.
// The QR is a link to /staff/orders/?order=<id>, as the top-up QR is to its staff page
// (DECISIONS 24 Nov); that page is Stage 4.
//
// Loaded by the shop and the profile (extraScripts); after credits-card.js (layout.html), whose
// QR maker it borrows. TDCOrder.open(order): order is what tdc_place_order, tdc_my_orders or
// tdc_my_order return (migration 20261124152509). Fires tdc:orders-changed after a cancel, and
// tdc:credits-changed when that gave credits back.
// Styles: credits-card.css (.cc, the card) and shop-order.css.

const TDCOrder = (() => {
	const AREA = 'Orders';
	const POLL_MS = 4000;
	const STEPS = [['placed', 'Placed'], ['preparing', 'Preparing'], ['ready', 'Ready'], ['collected', 'Collected']];
	const SVG_NS = 'http://www.w3.org/2000/svg';

	let dlg = null;
	let els = null;
	let order = null;
	let pollTimer = null;
	let readyEmail = false;   // the player's Ready to collect email is on

	function el(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}
	function rand(cents) {
		return 'R' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
	}
	function credits(n) { return n + (n === 1 ? ' credit' : ' credits'); }
	function day(iso) {
		return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
	}

	function build() {
		dlg = el('dialog', 'cc shop-order');
		dlg.setAttribute('aria-labelledby', 'so-title');
		dlg.dataset.pull = 'off';
		const head = el('div', 'cc-head');
		const title = el('h2', null, 'Your order');
		title.id = 'so-title';
		title.tabIndex = -1;
		title.autofocus = true;
		const close = el('button', 'cc-icon', '✕');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close');
		head.append(title, close);

		const top = el('div', 'so-top');
		const label = el('div', 'so-label');
		const said = el('p', 'so-said', 'Show this when you collect');
		const qr = el('div', 'cc-qr so-qr');
		qr.setAttribute('role', 'img');
		top.append(label, said, qr);

		const steps = el('ol', 'so-steps');
		steps.setAttribute('aria-label', 'Order status');
		const state = el('div', 'cc-state so-state');
		const lines = el('div', 'cc-lines so-lines');
		const collect = el('p', 'so-collect');
		const cancel = el('button', 'btn btn-secondary', 'Cancel order');
		cancel.type = 'button';
		const done = el('button', 'btn btn-primary', 'Done');
		done.type = 'button';
		const status = el('div', 'status');
		dlg.append(head, top, steps, state, lines, collect, cancel, done, status);
		document.body.appendChild(dlg);
		els = { label, said, qr, steps, state, lines, collect, cancel, done, status };

		close.addEventListener('click', shut);
		done.addEventListener('click', shut);
		dlg.addEventListener('close', stopPoll);
		dlg.addEventListener('click', (e) => { if (e.target === dlg) shut(); });
		cancel.addEventListener('click', cancelOrder);
	}

	function draw(o) {
		const live = o.status !== 'cancelled' && o.status !== 'collected';
		els.label.textContent = o.label;
		els.label.classList.toggle('is-over', !live);
		els.qr.setAttribute('aria-label', `QR code for order ${o.label}`);
		els.said.hidden = !live;
		els.qr.hidden = !live;

		// The steps, lit up to where it is; a cancelled order says so instead.
		const at = STEPS.findIndex(([k]) => k === o.status);
		els.steps.hidden = o.status === 'cancelled';
		els.steps.replaceChildren(...STEPS.map(([, words], i) => {
			const li = el('li', i <= at ? 'is-done' : null, words);
			if (i === at) li.setAttribute('aria-current', 'step');
			return li;
		}));
		els.state.hidden = o.status !== 'cancelled';
		els.state.className = 'cc-state so-state is-over';
		els.state.textContent = 'Cancelled' + (o.pay_with === 'credits' ? ` · ${credits(o.total_credits)} back` : '');

		const row = (cls, a, b) => {
			const r = el('div', 'cc-line' + (cls ? ' ' + cls : ''));
			r.append(el('span', null, a), el('span', null, b));
			return r;
		};
		const rows = o.lines.map((l) => row('', l.qty > 1 ? `${l.name} × ${l.qty}` : l.name, String(l.qty * l.price_credits)));
		const paid = o.pay_with === 'credits'
			? row('is-total so-paid', 'Paid · credits', credits(o.total_credits))
			: row('is-total so-club', 'Pay at the club', `${rand(o.pay_cents)} · ${credits(o.total_credits)}`);
		rows.push(paid);
		els.lines.replaceChildren(...rows);

		const bar = o.lines.some((l) => l.collect === 'bar');
		const words = [];
		if (live && bar) words.push('Café: made when you arrive.');
		if (live && o.collect_by) words.push(`Merch: collect by ${day(o.collect_by)}.`);
		if (readyEmail && (o.status === 'placed' || o.status === 'preparing')) words.push('We\'ll email you when it\'s ready.');
		els.collect.textContent = (live ? `${o.venue_name} · ` : `${o.venue_name} · ${day(o.placed_at)}`) + words.join(' ');
		els.cancel.hidden = !o.can_cancel;

		if (live) {
			drawQr(o);
			startPoll();
		} else {
			stopPoll();
		}
	}

	async function drawQr(o) {
		if (els.qr.dataset.order === o.id && els.qr.firstChild) return;
		els.qr.dataset.order = o.id;
		els.qr.replaceChildren();
		try {
			await TDC.busy(els.qr, TDCCredits.loadQr(), els.status);
		} catch (err) {
			TDC.error(AREA, 'the QR code could not be drawn; the order number still works.', err, els.status);
			return;
		}
		if (!order || order.id !== o.id) return;
		const q = qrcode(0, 'M');
		q.addData(location.origin + '/staff/orders/?order=' + encodeURIComponent(o.id));
		q.make();
		const n = q.getModuleCount();
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
		svg.setAttribute('shape-rendering', 'crispEdges');
		svg.setAttribute('aria-hidden', 'true');
		let d = '';
		for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', d);
		path.setAttribute('fill', 'var(--qr-ink)');
		svg.appendChild(path);
		els.qr.replaceChildren(svg);
	}

	async function cancelOrder() {
		if (!order || !confirm(`Cancel order ${order.label}?` + (order.pay_with === 'credits' ? `\n\nYour ${credits(order.total_credits)} come back at once.` : ''))) return;
		els.cancel.disabled = true;
		TDC.status(els.status, '', '');
		try {
			const { data, error } = await TDC.busy(els.cancel, supabaseClient.rpc('tdc_cancel_my_order', { p_order_id: order.id }), els.status);
			if (error) {
				TDC.showSupabaseError(AREA, error, els.status);
				await reread();
				return;
			}
			order = data;
			draw(data);
			TDC.flushEmails();
			window.dispatchEvent(new CustomEvent('tdc:orders-changed'));
			if (data.pay_with === 'credits') window.dispatchEvent(new CustomEvent('tdc:credits-changed'));
		} catch (err) {
			TDC.error(AREA, 'could not cancel that order.', err, els.status);
		} finally {
			els.cancel.disabled = false;
		}
	}

	async function reread() {
		if (!order) return;
		const { data, error } = await supabaseClient.rpc('tdc_my_order', { p_order_id: order.id });
		if (error) {
			TDC.showSupabaseError(AREA, error, els.status);
			return;
		}
		const was = order.status;
		order = data;
		draw(data);
		if (was !== data.status) window.dispatchEvent(new CustomEvent('tdc:orders-changed'));
	}

	// While the order is on its way and the card is open, ask quietly whether it has moved on.
	function startPoll() {
		stopPoll();
		pollTimer = setTimeout(poll, POLL_MS);
	}
	function stopPoll() {
		clearTimeout(pollTimer);
		pollTimer = null;
	}
	async function poll() {
		pollTimer = null;
		if (!dlg.open || !order) return;
		if (document.hidden) { startPoll(); return; }
		await reread();
	}

	function open(o) {
		if (!dlg) build();
		if (!o || !o.id) {
			TDC.error(AREA, 'no order to show.', o);
			return;
		}
		order = o;
		TDC.status(els.status, '', '');
		if (!dlg.open) dlg.showModal();
		draw(o);
		readEmailSetting();
	}

	// A failure only leaves the line off; console only.
	async function readEmailSetting() {
		try {
			const { data, error } = await supabaseClient.rpc('tdc_email_prefs');
			if (error) { console.error('[Orders] could not read your email settings.', error); return; }
			const on = !!data.email && (data.prefs || []).some((p) => p.kind === 'order_ready' && p.enabled);
			if (on !== readyEmail) {
				readyEmail = on;
				if (order && dlg.open) draw(order);
			}
		} catch (err) {
			console.error('[Orders] could not read your email settings.', err);
		}
	}

	function shut() {
		stopPoll();
		if (dlg && dlg.open) dlg.close();
	}

	return { open, close: shut };
})();
