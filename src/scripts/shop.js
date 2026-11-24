// The shop (/shop/; UV, 24 Nov; docs/design/shop.md, Stage 2; canvas artboard 1, no balance).
// Products from tdc_shop (readable signed out), in the owner's categories as tabs; each row a
// picture, the name, "30 credits · R30" (the rand at the venue's current price per credit; UV,
// 24 Nov) and how it is collected, with a + that becomes the quantity in the cart. The cart is
// on the account (tdc_my_cart, tdc_set_cart_qty; the same on every device); signed out, + asks
// for a sign-in and comes back here. The cart bar follows at the foot and opens the cart over
// the page: lines with − and +, a product switched off since marked No longer available and
// left out of the total.
// The cart is the checkout (Stage 3; canvas artboard 3; one tap from the shop): Pay with
// credits (your balance shown here only, and what it leaves; short, it offers Add credits over
// the page) or at the club (paid at hand-over), where to collect, the total, Place order
// (tdc_place_order; migration 20261124152509). The order card then opens over the page
// (TDCOrder, scripts/shop-order.js).
// Needs: supabaseClient.js, tdc.js, credits-card.js and .css (the card's look, reused for the
// cart), shop-order.js.

TDCLoader.hold((async () => {
	const AREA = 'Shop';
	const BUCKET = 'product-pictures';
	const COLLECT = { bar: 'Made at the bar', collect: 'Collect within 30 days' };

	const el = (id) => document.getElementById(id);
	const els = {
		tabs: el('shop-tabs'), track: el('shop-tab-track'), list: el('shop-list'), empty: el('shop-empty'),
		status: el('shop-status'), bar: el('shop-cartbar'), barCount: el('shop-cartbar-count'), barTotal: el('shop-cartbar-total')
	};
	// The dots wait on the page's card: the list has no size until it has rows.
	const card = document.querySelector('.tdc-card.shop');
	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'shop page is missing expected elements: ' + missing.join(', '));
		return;
	}

	function make(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	let shop = null;       // tdc_shop
	let cart = null;       // tdc_my_cart, or null signed out
	let signedIn = false;
	let tab = null;        // the chosen category's id
	const saving = new Set();   // products with a write in flight

	function rand(credits) {
		if (!shop || shop.cents_per_credit == null) return null;
		const cents = credits * shop.cents_per_credit;
		return 'R' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
	}
	function price(credits) {
		const r = rand(credits);
		return `${credits} credit${credits === 1 ? '' : 's'}` + (r ? ` · ${r}` : '');
	}
	function qtyOf(id) {
		const line = cart && cart.items.find((i) => i.id === id);
		return line ? line.qty : 0;
	}

	// ─── The tabs and the list ───
	function drawTabs() {
		const cats = shop.categories;
		els.tabs.hidden = cats.length < 2;
		els.track.replaceChildren(...cats.map((c) => {
			const b = make('button', 'league-nav-item', c.name);
			b.type = 'button';
			if (c.id === tab) b.setAttribute('aria-current', 'page');
			b.addEventListener('click', () => {
				tab = c.id;
				for (const x of els.track.children) x.removeAttribute('aria-current');
				b.setAttribute('aria-current', 'page');
				drawList();
			});
			return b;
		}));
	}

	function pic(path, name) {
		const box = make('span', 'shop-pic');
		const url = TDC.pictureUrl(BUCKET, path);
		if (url) {
			const img = make('img');
			img.alt = '';
			img.loading = 'lazy';
			img.src = url;
			img.addEventListener('error', () => box.replaceChildren(make('span', 'shop-pic-none', name.slice(0, 1).toUpperCase())));
			box.append(img);
		} else {
			box.append(make('span', 'shop-pic-none', name.slice(0, 1).toUpperCase()));
		}
		return box;
	}

	function drawList() {
		const cat = shop.categories.find((c) => c.id === tab);
		els.empty.hidden = !!cat;
		els.list.replaceChildren(...(cat ? cat.products : []).map((p) => {
			const li = make('li', 'shop-item');
			const words = make('div', 'shop-words');
			words.append(make('div', 'shop-name', p.name), make('div', 'shop-price', price(p.price_credits)), make('div', 'shop-collect', COLLECT[p.collect] || ''));
			const n = qtyOf(p.id);
			const btn = make('button', n ? 'shop-qty' : 'shop-add', n ? String(n) : '+');
			btn.type = 'button';
			btn.setAttribute('aria-label', n ? `${p.name}: ${n} in your cart. Add another` : `Add ${p.name} to your cart`);
			btn.disabled = saving.has(p.id);
			btn.addEventListener('click', () => setQty(p, qtyOf(p.id) + 1, btn));
			li.append(pic(p.picture_path, p.name), words, btn);
			return li;
		}));
	}

	function drawBar() {
		const count = cart ? cart.count : 0;
		els.bar.hidden = !count;
		if (!count) return;
		els.barCount.textContent = `${count} item${count === 1 ? '' : 's'}`;
		els.barTotal.textContent = `· ${cart.total_credits} credits`;
	}

	// ─── Writing the cart: the server's cart comes back and is drawn ───
	async function setQty(p, qty, btn) {
		if (!signedIn) {
			window.location.href = '/accounts/?next=' + encodeURIComponent('/shop/');
			return;
		}
		if (saving.has(p.id)) return;
		saving.add(p.id);
		if (btn) btn.disabled = true;
		TDC.status(els.status, '', '');
		try {
			const { data, error } = await TDC.busy(btn, supabaseClient.rpc('tdc_set_cart_qty', { p_product_id: p.id, p_qty: qty }), els.status);
			if (error) {
				TDC.showSupabaseError(AREA, error, cartOpen() ? cartEls.status : els.status);
				return;
			}
			cart = data;
		} catch (err) {
			TDC.error(AREA, 'could not change your cart.', err, els.status);
		} finally {
			saving.delete(p.id);
			drawList();
			drawBar();
			if (cartOpen()) drawCart();
		}
	}

	// ─── The cart, over the page (the Add credits card's look, credits-card.css) ───
	let cartDlg = null;
	let cartEls = null;
	const cartOpen = () => !!(cartDlg && cartDlg.open);

	function buildCart() {
		cartDlg = make('dialog', 'cc shop-cart');
		cartDlg.setAttribute('aria-labelledby', 'shop-cart-title');
		cartDlg.dataset.pull = 'off';
		const head = make('div', 'cc-head');
		const title = make('h2', null, 'Your order');
		title.id = 'shop-cart-title';
		title.tabIndex = -1;
		title.autofocus = true;
		const close = make('button', 'cc-icon', '✕');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close');
		head.append(title, close);
		const lines = make('ul', 'shop-cart-lines');

		// Pay with: the Add credits card's ways to pay, the chosen one ringed in green.
		const pay = make('section', 'shop-checkout');
		const way = (words, key) => {
			const b = make('button', 'cc-way shop-way');
			b.type = 'button';
			b.dataset.pay = key;
			b.dataset.noDots = '';   // a choice, with no wait of its own to show (tdc-controls.js)
			b.append(make('span', null, words), make('small'));
			b.addEventListener('click', () => { payWith = key; drawPay(); });
			return b;
		};
		const wayCredits = way('Credits', 'credits');
		const wayClub = way('At the club', 'club');
		const payNote = make('p', 'shop-pay-said');
		const addCredits = make('button', 'btn btn-secondary shop-add-credits', 'Add credits');
		addCredits.type = 'button';
		addCredits.addEventListener('click', () => TDCCredits.open({ venueId: shop.venue_id }));
		const collect = make('div', 'shop-collect-box');
		pay.append(make('h3', 'cc-label', 'Pay with'), wayCredits, wayClub, payNote, addCredits,
			make('h3', 'cc-label', 'Collect'), collect);

		const total = make('div', 'shop-cart-total');
		const go = make('button', 'btn btn-primary', 'Place order');
		go.type = 'button';
		go.addEventListener('click', placeOrder);
		const status = make('div', 'status');
		cartDlg.append(head, lines, pay, total, go, status);
		document.body.appendChild(cartDlg);
		cartEls = { lines, pay, wayCredits, wayClub, payNote, addCredits, collect, total, go, status };
		close.addEventListener('click', () => cartDlg.close());
		cartDlg.addEventListener('click', (e) => { if (e.target === cartDlg) cartDlg.close(); });
	}

	function drawCart() {
		const rows = (cart ? cart.items : []).map((p) => {
			const li = make('li', 'shop-cart-line' + (p.active ? '' : ' is-off'));
			const words = make('div', 'shop-words');
			words.append(make('div', 'shop-name', p.name),
				make('div', 'shop-price', p.active ? `${p.qty} × ${p.price_credits} = ${p.qty * p.price_credits} credits` : 'No longer available'));
			const minus = make('button', 'shop-step', p.active ? '−' : 'Remove');
			minus.type = 'button';
			minus.setAttribute('aria-label', p.active ? `One fewer ${p.name}` : `Remove ${p.name}`);
			minus.disabled = saving.has(p.id);
			minus.addEventListener('click', () => setQty(p, p.active ? p.qty - 1 : 0, minus));
			li.append(words, minus);
			if (p.active) {
				const n = make('span', 'shop-step-n', String(p.qty));
				const plus = make('button', 'shop-step is-plus', '+');
				plus.type = 'button';
				plus.setAttribute('aria-label', `One more ${p.name}`);
				plus.disabled = saving.has(p.id) || p.qty >= 99;
				plus.addEventListener('click', () => setQty(p, p.qty + 1, plus));
				li.append(n, plus);
			}
			return li;
		});
		if (!rows.length) rows.push(make('li', 'shop-cart-empty muted', 'Your cart is empty.'));
		cartEls.lines.replaceChildren(...rows);
		const t = cart ? cart.total_credits : 0;
		const r = rand(t);
		cartEls.total.replaceChildren(make('span', null, 'Total'), make('span', 'shop-cart-sum', `${t} credits` + (r ? ` · ${r}` : '')));
		drawPay();
	}

	// ─── Checkout: how to pay, where to collect, Place order ───
	let balance = null;     // tdc_my_credit_balance, read when the cart opens
	let payWith = null;     // 'credits' or 'club'
	let placeKey = null;    // one per attempt: a retry after a lost answer can't place twice
	let placing = false;

	function drawPay() {
		const live = cart ? cart.items.filter((p) => p.active) : [];
		const t = cart ? cart.total_credits : 0;
		const known = balance != null;
		const enough = known && balance >= t;
		if (!payWith && known) payWith = enough ? 'credits' : 'club';

		cartEls.pay.hidden = !live.length;
		cartEls.wayCredits.querySelector('small').textContent = known ? `${balance} credits` : '';
		cartEls.wayCredits.classList.toggle('is-on', payWith === 'credits');
		cartEls.wayClub.classList.toggle('is-on', payWith === 'club');
		cartEls.wayCredits.setAttribute('aria-pressed', String(payWith === 'credits'));
		cartEls.wayClub.setAttribute('aria-pressed', String(payWith === 'club'));

		const short = payWith === 'credits' && known && !enough;
		cartEls.payNote.classList.toggle('is-short', short);
		cartEls.payNote.textContent = payWith === 'club'
			? `Pay ${rand(t) || t + ' credits'} at the bar when you collect.`
			: !known ? '' : enough ? `Leaves ${balance - t} credits.` : `You need ${t - balance} more credits.`;
		cartEls.addCredits.hidden = !short;

		const bar = live.some((p) => p.collect === 'bar');
		const merch = live.some((p) => p.collect === 'collect');
		const words = [];
		if (bar) words.push('Café: made when you arrive.');
		if (merch) words.push('Merch: collect within 30 days.');
		cartEls.collect.replaceChildren(make('div', 'shop-name', shop.venue_name), make('div', 'shop-price', words.join(' ')));

		cartEls.go.hidden = !live.length;
		cartEls.go.disabled = placing || !payWith || short;
	}

	async function loadBalance() {
		const { data, error } = await TDC.busy(cartEls.pay, supabaseClient.rpc('tdc_my_credit_balance', { p_venue_id: shop.venue_id }), cartEls.status);
		if (error) {
			TDC.showSupabaseError(AREA, error, cartEls.status);
			return;
		}
		balance = data;
		if (cartOpen()) drawPay();
	}

	// Credits added from the checkout's Add credits land only when staff confirm; read again then.
	window.addEventListener('tdc:credits-changed', () => { if (cartOpen()) loadBalance(); });

	async function rereadCart() {
		const got = await supabaseClient.rpc('tdc_my_cart', { p_venue_id: shop.venue_id });
		if (got.error) TDC.showSupabaseError(AREA, got.error, els.status);
		else cart = got.data;
		drawList();
		drawBar();
		if (cartOpen()) drawCart();
	}

	async function placeOrder() {
		if (placing || !cart || !payWith) return;
		placing = true;
		cartEls.go.disabled = true;
		TDC.status(cartEls.status, '', '');
		if (!placeKey) placeKey = crypto.randomUUID();
		try {
			const { data, error } = await TDC.busy(cartEls.go, supabaseClient.rpc('tdc_place_order', {
				p_venue_id: shop.venue_id, p_pay_with: payWith, p_expected_total: cart.total_credits, p_idempotency_key: placeKey
			}), cartEls.status);
			if (error) {
				// The database answered: nothing was placed, so the next attempt is a new one.
				placeKey = null;
				TDC.showSupabaseError(AREA, error, cartEls.status);
				await Promise.all([rereadCart(), loadBalance()]);
				return;
			}
			placeKey = null;
			payWith = null;
			cartDlg.close();
			TDCOrder.open(data);
			if (data.pay_with === 'credits') window.dispatchEvent(new CustomEvent('tdc:credits-changed'));
			window.dispatchEvent(new CustomEvent('tdc:orders-changed'));
			await rereadCart();
		} catch (err) {
			// No answer: the key is kept, so trying again returns the order if it was placed.
			TDC.error(AREA, 'could not place your order. Try again: it will not be placed twice.', err, cartEls.status);
		} finally {
			placing = false;
			if (cartOpen()) drawPay();
		}
	}

	els.bar.addEventListener('click', () => {
		if (!cartDlg) buildCart();
		TDC.status(cartEls.status, '', '');
		balance = null;
		payWith = null;
		drawCart();
		cartDlg.showModal();
		loadBalance();
	});

	// ─── Load: the shop (anyone), then my cart (signed in) ───
	const session = await TDC.getSession(AREA);
	signedIn = !!session;
	const { data, error } = await TDC.busy(card, supabaseClient.rpc('tdc_shop', { p_venue_id: null }), els.status);
	if (error) {
		TDC.showSupabaseError(AREA, error, els.status);
		return;
	}
	shop = data;
	if (signedIn) {
		const got = await TDC.busy(card, supabaseClient.rpc('tdc_my_cart', { p_venue_id: shop.venue_id }), els.status);
		if (got.error) TDC.showSupabaseError(AREA, got.error, els.status);
		else cart = got.data;
	}
	tab = shop.categories.length ? shop.categories[0].id : null;
	drawTabs();
	drawList();
	drawBar();
})(), 'Shop');
