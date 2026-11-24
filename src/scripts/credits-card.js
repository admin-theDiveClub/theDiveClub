// The Add credits card (UV, 24 Nov; docs/design/shop.md, Stage 1; canvas artboard 2).
// One card over whatever page you are on, never leaving it, in three steps:
//   1. Amount: a typed number and a slider kept in step, discount ticks lit as
//      they are passed (none while the owner has set none), the price in rand.
//   2. Checkout: the order, who it is for, the ways to pay. Card and Instant EFT
//      say Coming soon; Pay at the club is the one that works (DECISIONS 24 Nov).
//   3. The code: a 4-character code and a QR, Waiting for payment, until staff
//      confirm the money came in. The card asks every few seconds while it is
//      open and says so the moment the credits land.
// The QR is a link to /staff/top-ups/?code=…, so staff scan it with the phone's
// own camera (DECISIONS 24 Nov, "The top-up QR is a link to the staff page").
//
// Loaded on every page by layout.html; opened by the profile menu's balance
// (nav.js) and the profile's Credits section:
//   TDCCredits.open()              at the amount
//   TDCCredits.open({ topUp })     straight to that request's code
// When a request is made and when its credits land it fires a window event,
// tdc:credits-changed, so whatever shows a balance or a request reads again. The prices and the sums are the database's
// (migration 20261124112328): the page only previews them, and the code step
// shows what the request was saved with.
// Styles: stylesheets/credits-card.css; tokens --cc-* in variables.css.

const TDCCredits = (() => {
	const AREA = 'Credits';
	const POLL_MS = 4000;
	const AVATAR_BUCKET = 'player-avatars';

	let dlg = null;
	let els = null;
	let venues = [];
	let venueId = null;
	let prices = null;
	let me = null;
	let topUp = null;      // the request on the code step
	let pollTimer = null;
	let opening = 0;       // only the latest open draws

	// ─── Small builders ───
	function el(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}
	const SVG_NS = 'http://www.w3.org/2000/svg';
	// A stroke icon from path strings (decoration only; the words say what it is).
	function icon(paths) {
		const s = document.createElementNS(SVG_NS, 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('fill', 'none');
		s.setAttribute('stroke', 'currentColor');
		s.setAttribute('stroke-width', '2');
		s.setAttribute('stroke-linecap', 'round');
		s.setAttribute('stroke-linejoin', 'round');
		s.setAttribute('aria-hidden', 'true');
		for (const d of paths) {
			const p = document.createElementNS(SVG_NS, 'path');
			p.setAttribute('d', d);
			s.appendChild(p);
		}
		return s;
	}
	const ICON = {
		close: ['M6 6l12 12', 'M18 6L6 18'],
		back: ['M15 5l-7 7 7 7'],
		card: ['M3 6h18v12H3z', 'M3 10h18'],
		eft: ['M4 10l8-5 8 5', 'M5 10v8', 'M19 10v8', 'M9 10v8', 'M15 10v8', 'M3 20h18'],
		club: ['M3 10l9-6 9 6v10H3z', 'M9 20v-6h6v6'],
		tick: ['M5 12l5 5 9-10']
	};

	function rand(cents) {
		const r = cents / 100;
		return 'R ' + (cents % 100 ? r.toFixed(2) : String(r));
	}
	function credits(n) { return n + (n === 1 ? ' credit' : ' credits'); }

	// The database's sums, previewed (tdc_top_up_quote): the biggest discount
	// whose step is reached, money off, rounded to the cent.
	function quote(n) {
		let pct = 0;
		for (const t of prices.tiers || []) if (n >= t.at) pct = Math.max(pct, t.pct);
		const gross = n * prices.cents_per_credit;
		return { pct, gross, pay: gross - Math.round(gross * pct / 100) };
	}

	// Pulled onto the slider: inside the range and on a step.
	function onSlider(n) {
		const { min_credits: min, max_credits: max, step_credits: step } = prices;
		if (!Number.isFinite(n)) return min;
		const s = Math.round((n - min) / step) * step + min;
		return Math.min(max, Math.max(min, s));
	}

	function until(iso) {
		const d = new Date(iso);
		return 'Until ' + d.toLocaleDateString(undefined, { weekday: 'short' }) + ' '
			+ d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	// ─── The card, built once ───
	function build() {
		dlg = el('dialog', 'cc');
		dlg.setAttribute('aria-labelledby', 'cc-title');
		dlg.dataset.pull = 'off';   // a drag on the card never reloads the page under it

		const head = el('div', 'cc-head');
		const back = el('button', 'cc-icon');
		back.type = 'button';
		back.setAttribute('aria-label', 'Back');
		back.append(icon(ICON.back));
		const title = el('h2', null, 'Add credits');
		title.id = 'cc-title';
		// Opening focuses the title, not Close (a ring on it) or the amount (the keyboard).
		title.tabIndex = -1;
		title.autofocus = true;
		const close = el('button', 'cc-icon');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close');
		close.append(icon(ICON.close));
		head.append(back, title, close);

		// A venue to choose only once more than one sells credits.
		const venueField = el('div', 'field cc-venue');
		const venueLabel = el('label', null, 'Venue');
		venueLabel.htmlFor = 'cc-venue';
		const venueSel = el('select');
		venueSel.id = 'cc-venue';
		venueField.append(venueLabel, venueSel);

		// 1. The amount
		const amountStep = el('section');
		const amountBox = el('label', 'cc-amount');
		const amount = el('input');
		amount.type = 'number';
		amount.inputMode = 'numeric';
		amount.dataset.control = 'none';   // the big number, not a stepper
		amount.setAttribute('aria-label', 'Credits to buy');
		amountBox.append(amount, el('span', 'cc-amount-unit', 'credits'));
		const slider = el('div', 'cc-slider');
		const range = el('input', 'cc-range');
		range.type = 'range';
		range.dataset.pull = 'off';
		range.setAttribute('aria-label', 'Credits slider');
		const ticks = el('div', 'cc-ticks');
		slider.append(range, ticks);
		const sum = el('div', 'cc-sum');
		const save = el('span', 'cc-save');
		const price = el('span', 'cc-price');
		sum.append(save, price);
		const toPay = el('button', 'btn btn-primary', 'Checkout');
		toPay.type = 'button';
		const ways = el('div', 'cc-ways');
		const chip = (paths, words, on) => {
			const c = el('span', 'cc-chip' + (on ? ' is-on' : ''));
			c.append(icon(paths), words);
			return c;
		};
		ways.append(chip(ICON.card, 'Card'), chip(ICON.eft, 'Instant EFT'), chip(ICON.club, 'At the club', true));
		amountStep.append(amountBox, slider, sum, toPay, ways);

		// 2. Checkout
		const payStep = el('section');
		const lines = el('div', 'cc-lines');
		const who = el('div', 'cc-who');
		const whoPic = el('span', 'cc-who-pic');
		const whoName = el('span', 'cc-who-name');
		who.append(whoPic, whoName);
		const wayOff = el('div', 'cc-way is-off');
		wayOff.append(icon(ICON.card), el('span', null, 'Card or Instant EFT'), el('small', null, 'Coming soon'));
		const wayOn = el('div', 'cc-way is-on');
		wayOn.append(icon(ICON.club), el('span', null, 'Pay at the club'), icon(ICON.tick));
		const getCode = el('button', 'btn btn-primary cc-pay-go');
		getCode.type = 'button';
		payStep.append(lines, who, el('h3', 'cc-label', 'Pay with'), wayOff, wayOn, getCode);

		// 3. The code
		const codeStep = el('section', 'cc-code-step');
		const codeSaid = el('p');
		const qr = el('div', 'cc-qr');
		qr.setAttribute('role', 'img');
		const code = el('div', 'cc-code');
		const state = el('div', 'cc-state');
		const untilLine = el('p', 'cc-until');
		const again = el('button', 'btn btn-primary', 'New amount');
		again.type = 'button';
		const done = el('button', 'btn btn-secondary', 'Done');
		done.type = 'button';
		codeStep.append(codeSaid, qr, code, state, untilLine, again, done);

		const status = el('div', 'status');
		dlg.append(head, venueField, amountStep, payStep, codeStep, status);
		document.body.appendChild(dlg);

		els = { back, title, close, venueField, venueSel, amountStep, amount, range, ticks, save, price, toPay,
			payStep, lines, whoPic, whoName, getCode, codeStep, codeSaid, qr, code, state, untilLine, again, done, status };

		close.addEventListener('click', shut);
		done.addEventListener('click', shut);
		dlg.addEventListener('close', stopPoll);
		// A tap on the dim round the card closes it, as Escape does.
		dlg.addEventListener('click', (e) => { if (e.target === dlg) shut(); });
		back.addEventListener('click', () => showStep('amount'));
		venueSel.addEventListener('change', () => chooseVenue(venueSel.value));

		amount.addEventListener('input', () => {
			if (!prices) return;
			const n = parseInt(amount.value, 10);
			if (Number.isFinite(n)) range.value = String(onSlider(n));
			drawAmount(Number.isFinite(n) ? n : null);
		});
		amount.addEventListener('change', () => { if (prices) setAmount(onSlider(parseInt(amount.value, 10))); });
		range.addEventListener('input', () => { if (prices) setAmount(parseInt(range.value, 10)); });
		toPay.addEventListener('click', () => {
			if (!prices) return;
			setAmount(onSlider(parseInt(amount.value, 10)));
			drawCheckout();
			showStep('pay');
		});
		getCode.addEventListener('click', startTopUp);
		again.addEventListener('click', () => showStep('amount'));
	}

	function showStep(step) {
		els.amountStep.hidden = step !== 'amount';
		els.payStep.hidden = step !== 'pay';
		els.codeStep.hidden = step !== 'code';
		els.back.hidden = step !== 'pay';
		els.venueField.hidden = step !== 'amount' || venues.length < 2;
		els.title.textContent = step === 'amount' ? 'Add credits' : step === 'pay' ? 'Checkout' : 'Pay at the club';
		TDC.status(els.status, '', '');
		if (step !== 'code') stopPoll();
	}

	// ─── 1. The amount ───
	function setAmount(n) {
		els.amount.value = String(n);
		els.range.value = String(n);
		drawAmount(n);
	}

	function drawAmount(n) {
		const ok = n != null && n >= prices.min_credits && n <= prices.max_credits
			&& (n - prices.min_credits) % prices.step_credits === 0;
		els.toPay.disabled = !ok;
		if (!ok) {
			els.price.textContent = '';
			els.save.textContent = `${prices.min_credits} to ${prices.max_credits} credits, in steps of ${prices.step_credits}`;
			drawTicks(n || 0);
			return;
		}
		const q = quote(n);
		els.price.textContent = rand(q.pay);
		const next = (prices.tiers || []).find((t) => n < t.at);
		if (q.pct) {
			els.save.textContent = `You save ${rand(q.gross - q.pay)}` + (next ? ` · ${next.at - n} more for ${next.pct}%` : '');
		} else if (next) {
			els.save.textContent = `${next.at - n} more for ${next.pct}% off`;
		} else {
			els.save.textContent = '';
		}
		drawTicks(n);
	}

	function drawTicks(n) {
		const span = prices.max_credits - prices.min_credits;
		const rows = (prices.tiers || []).map((t) => {
			const tick = el('span', 'cc-tick' + (n >= t.at ? ' is-passed' : ''));
			tick.style.left = (span ? ((t.at - prices.min_credits) / span) * 100 : 0) + '%';
			tick.append(el('b', null, t.pct + '% off'), String(t.at));
			return tick;
		});
		els.ticks.replaceChildren(...rows);
	}

	// ─── 2. Checkout ───
	function drawCheckout() {
		const n = parseInt(els.amount.value, 10);
		const q = quote(n);
		const line = (cls, a, b) => {
			const row = el('div', 'cc-line' + (cls ? ' ' + cls : ''));
			row.append(el('span', null, a), el('span', null, b));
			return row;
		};
		const rows = [line('', credits(n), rand(q.gross))];
		if (q.pct) rows.push(line('is-off', q.pct + '% off', '− ' + rand(q.gross - q.pay)));
		rows.push(line('is-total', 'Total', rand(q.pay)));
		els.lines.replaceChildren(...rows);
		els.getCode.textContent = `Get my code · ${rand(q.pay)}`;
		drawWho();
	}

	function drawWho() {
		if (!me) return;
		els.whoName.textContent = me.display_name;
		const url = TDC.pictureUrl(AVATAR_BUCKET, me.avatar_path);
		if (url) {
			const img = el('img');
			img.alt = '';
			img.src = url;
			img.addEventListener('error', () => els.whoPic.replaceChildren(initials(me.display_name)));
			els.whoPic.replaceChildren(img);
		} else {
			els.whoPic.replaceChildren(initials(me.display_name));
		}
	}
	// One letter per word, two at most (the profile menu's rule).
	function initials(name) {
		return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
	}

	async function startTopUp() {
		const n = parseInt(els.amount.value, 10);
		els.getCode.disabled = true;
		try {
			const { data, error } = await TDC.busy(els.getCode,
				supabaseClient.rpc('tdc_start_top_up', { p_venue_id: venueId, p_credits: n }), els.status);
			if (error) {
				TDC.showSupabaseError(AREA, error, els.status);
				return;
			}
			showCode(data);
			window.dispatchEvent(new CustomEvent('tdc:credits-changed'));
		} catch (err) {
			TDC.error(AREA, 'could not ask for those credits.', err, els.status);
		} finally {
			els.getCode.disabled = false;
		}
	}

	// ─── 3. The code ───
	function showCode(t) {
		topUp = t;
		showStep('code');
		els.codeSaid.textContent = `Show this at the bar. Pay ${rand(t.pay_cents)}, and ${credits(t.credits)} land here.`;
		els.code.textContent = t.code;
		els.qr.setAttribute('aria-label', `QR code for ${t.code}`);
		drawState(t);      // first, so the QR's box is shown before the dots measure it
		drawQr(t.code);
	}

	function drawState(t) {
		const said = {
			waiting: 'Waiting for payment',
			paid: `Paid · ${credits(t.credits)} added`,
			expired: 'Expired · start a new one',
			cancelled: 'Cancelled · start a new one'
		}[t.state] || 'TDC (Error): unknown state';
		els.state.textContent = said;
		els.title.textContent = t.state === 'paid' ? 'Credits added' : 'Pay at the club';
		els.state.className = 'cc-state ' + (t.state === 'waiting' ? 'is-waiting' : t.state === 'paid' ? 'is-paid' : 'is-over');
		els.untilLine.textContent = t.state === 'waiting' ? `${until(t.expires_at)} · kept in your profile under Credits` : '';
		els.untilLine.hidden = t.state !== 'waiting';
		els.again.hidden = t.state !== 'expired' && t.state !== 'cancelled';
		els.qr.hidden = t.state !== 'waiting';
		els.code.hidden = t.state !== 'waiting';
		els.codeSaid.hidden = t.state !== 'waiting';
		if (t.state === 'waiting') startPoll();
		else stopPoll();
	}

	// The QR maker (node_modules/qrcode-generator, copied at build) is loaded the
	// first time a code is shown, so no other page pays for it.
	let qrLib = null;
	function loadQr() {
		if (typeof qrcode === 'function') return Promise.resolve();
		if (qrLib) return qrLib;
		const tdcScript = document.querySelector('script[src*="/scripts/tdc.js"]');
		const stamp = tdcScript ? new URL(tdcScript.src).search : '';
		qrLib = new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = '/scripts/vendor/qrcode.js' + stamp;
			s.onload = () => resolve();
			s.onerror = () => { qrLib = null; reject(new Error('qrcode.js did not load')); };
			document.head.appendChild(s);
		});
		return qrLib;
	}

	async function drawQr(code) {
		els.qr.replaceChildren();
		try {
			await TDC.busy(els.qr, loadQr(), els.status);
		} catch (err) {
			TDC.error(AREA, 'the QR code could not be drawn; the code above still works.', err, els.status);
			return;
		}
		if (!topUp || topUp.code !== code) return;
		const q = qrcode(0, 'M');
		q.addData(location.origin + '/staff/top-ups/?code=' + encodeURIComponent(code));
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

	// While the code is waiting and the card is open, ask every few seconds
	// whether staff have confirmed it. Quietly: the state badge is the wait.
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
		if (!dlg.open || !topUp) return;
		if (document.hidden) { startPoll(); return; }
		const { data, error } = await supabaseClient.rpc('tdc_my_top_ups', { p_venue_id: topUp.venue_id });
		if (!dlg.open || !topUp) return;
		if (error) {
			TDC.showSupabaseError(AREA, error, els.status);
			startPoll();
			return;
		}
		const now = (data || []).find((r) => r.id === topUp.id);
		if (!now) {
			TDC.error(AREA, 'this request is no longer listed.', topUp, els.status);
			return;
		}
		const wasWaiting = topUp.state === 'waiting';
		topUp = now;
		drawState(now);
		if (wasWaiting && now.state === 'paid') window.dispatchEvent(new CustomEvent('tdc:credits-changed'));
	}

	// ─── Opening and closing ───
	async function chooseVenue(id) {
		venueId = id;
		prices = null;
		const { data, error } = await TDC.busy(els.amountStep, supabaseClient.rpc('tdc_credit_prices', { p_venue_id: id }), els.status);
		if (venueId !== id) return false;
		if (error) {
			TDC.showSupabaseError(AREA, error, els.status);
			els.toPay.disabled = true;
			return false;
		}
		prices = data;
		els.amount.min = els.range.min = String(prices.min_credits);
		els.amount.max = els.range.max = String(prices.max_credits);
		els.amount.step = els.range.step = String(prices.step_credits);
		// Start on a round amount near the middle of the low end: 100 on 10 to 1,000.
		setAmount(onSlider(Math.min(prices.max_credits, Math.max(prices.min_credits, 100))));
		return true;
	}

	async function open(opts = {}) {
		if (!dlg) build();
		const mine = ++opening;
		topUp = null;
		prices = null;
		els.toPay.disabled = true;   // until the price has arrived
		els.price.textContent = '';
		els.save.textContent = '';
		showStep(opts.topUp ? 'code' : 'amount');
		if (!dlg.open) dlg.showModal();

		const session = await TDC.getSession(AREA);
		if (mine !== opening) return;
		if (!session) {
			TDC.status(els.status, 'Please sign in to add credits.', 'error');
			return;
		}

		if (opts.topUp) {
			showCode(opts.topUp);
			return;
		}

		const work = Promise.all([
			supabaseClient.from('tbl_venues').select('id, name').eq('active', true).eq('sells_credits', true).order('name'),
			me ? Promise.resolve(me) : TDC.getMyPlayer(AREA, session.user.id, els.status)
		]);
		const [ven, player] = await TDC.busy(els.amountStep, work, els.status);
		if (mine !== opening) return;
		me = player || me;
		if (ven.error) {
			TDC.error(AREA, 'could not load the venues that sell credits.', ven.error, els.status);
			return;
		}
		venues = ven.data || [];
		if (!venues.length) {
			TDC.status(els.status, 'No venue sells credits online yet.', 'error');
			els.toPay.disabled = true;
			return;
		}
		els.venueSel.replaceChildren(...venues.map((v) => {
			const o = el('option', null, v.name);
			o.value = v.id;
			return o;
		}));
		const chosen = venues.some((v) => v.id === opts.venueId) ? opts.venueId : venues[0].id;
		els.venueSel.value = chosen;
		els.venueField.hidden = venues.length < 2;
		await chooseVenue(chosen);
	}

	function shut() {
		stopPoll();
		if (dlg && dlg.open) dlg.close();
	}

	return { open, close: shut };
})();
