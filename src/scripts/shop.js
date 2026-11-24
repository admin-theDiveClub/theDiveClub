// The shop (/shop/; UV, 24 Nov; docs/design/shop.md, Stage 2; canvas artboard 1, no balance).
// Products from tdc_shop (readable signed out), in the owner's categories as tabs; each row a
// picture, the name, "30 credits · R30" (the rand at the venue's current price per credit; UV,
// 24 Nov) and how it is collected, with a + that becomes the quantity in the cart. The cart is
// on the account (tdc_my_cart, tdc_set_cart_qty; the same on every device); signed out, + asks
// for a sign-in and comes back here. The cart bar follows at the foot and opens the cart over
// the page: lines with − and +, a product switched off since marked No longer available and
// left out of the total, then Checkout, which is Stage 3 and so not yet open.
// Needs: supabaseClient.js, tdc.js, credits-card.css (the card's look, reused for the cart).

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
		const title = make('h2', null, 'Your cart');
		title.id = 'shop-cart-title';
		title.tabIndex = -1;
		title.autofocus = true;
		const close = make('button', 'cc-icon', '✕');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close');
		head.append(title, close);
		const lines = make('ul', 'shop-cart-lines');
		const total = make('div', 'shop-cart-total');
		const go = make('button', 'btn btn-primary', 'Checkout · coming next');
		go.type = 'button';
		go.disabled = true;
		const status = make('div', 'status');
		cartDlg.append(head, lines, total, go, status);
		document.body.appendChild(cartDlg);
		cartEls = { lines, total, status };
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
	}

	els.bar.addEventListener('click', () => {
		if (!cartDlg) buildCart();
		TDC.status(cartEls.status, '', '');
		drawCart();
		cartDlg.showModal();
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
