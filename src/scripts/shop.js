// The shop (/shop/; UV, 24 Nov; docs/design/shop.md, Stage 2; no balance).
// Restyled 25 Nov (UV): each of the owner's categories is a card on the page (the first
// product's picture, the name, "6 items · from 30 credits"), no tabs. A card opens the
// product sheet over the page: the category's products as rows (one product: straight to it),
// and a row opens that product's card in the same sheet: the picture large, "30 credits · R30"
// (the rand at the venue's current price per credit), how it is collected, a quantity and Add
// to cart. One product card for every category for now; a card of its own per category may
// follow (UV, 25 Nov: "do less, we will review"). The cart is on the account (tdc_my_cart,
// tdc_set_cart_qty; the same on every device); signed out, Add to cart asks for a sign-in and
// comes back here. The cart bar follows at the foot and opens the cart over the page: lines
// with their picture, − and +, a product switched off since marked No longer available and
// left out of the total.
// Moving (UV, 25 Nov): the sheet and the cart rise from the foot and sink away (TDC.cardOpen,
// cardClose); in the sheet each screen slides across, a product's card in from the right and
// the list back from the left, the sheet growing or shrinking to it (TDC.cardTurn); the cart
// grows or shrinks as its lines change (TDC.cardResize). Back is on every screen of the sheet.
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
		cats: el('shop-cats'), empty: el('shop-empty'),
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

	const SVG_NS = 'http://www.w3.org/2000/svg';
	// A stroke icon (decoration only; the button's label says what it is).
	function icon(d) {
		const s = document.createElementNS(SVG_NS, 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('fill', 'none');
		s.setAttribute('stroke', 'currentColor');
		s.setAttribute('stroke-width', '2');
		s.setAttribute('stroke-linecap', 'round');
		s.setAttribute('stroke-linejoin', 'round');
		s.setAttribute('aria-hidden', 'true');
		const p = document.createElementNS(SVG_NS, 'path');
		p.setAttribute('d', d);
		s.appendChild(p);
		return s;
	}

	// ─── The category cards ───
	function drawCats() {
		const cats = shop.categories;
		els.empty.hidden = cats.length > 0;
		els.cats.replaceChildren(...cats.map((c) => {
			const b = make('button', 'shop-cat');
			b.type = 'button';
			b.dataset.noDots = '';   // opens the sheet, no wait of its own (tdc-controls.js)
			const withPic = c.products.find((p) => p.picture_path) || c.products[0];
			const low = Math.min(...c.products.map((p) => p.price_credits));
			const n = c.products.length;
			const words = make('span', 'shop-cat-words');
			words.append(make('span', 'shop-cat-name', c.name),
				make('span', 'shop-cat-sub', n === 1 ? `${low} credits` : `${n} items · from ${low} credits`));
			const inCart = c.products.reduce((t, p) => t + qtyOf(p.id), 0);
			b.append(pic(withPic.picture_path, c.name, 'shop-cat-pic'), words);
			if (inCart) {
				const badge = make('span', 'shop-badge', String(inCart));
				badge.setAttribute('aria-label', `${inCart} in your cart`);
				b.append(badge);
			}
			b.addEventListener('click', () => openSheet(c));
			return b;
		}));
	}

	function pic(path, name, cls) {
		const box = make('span', 'shop-pic' + (cls ? ' ' + cls : ''));
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

	// ─── A product's 3D model (UV, 25 Nov): on its card in place of the large picture ───
	// Which product has one is listed here by its id for now (src/resources/models/); an
	// owner-uploaded model per product is in the backlog. Drag turns it; pinch zooms; no panning.
	// The viewer (node_modules/@google/model-viewer, copied at build) is loaded the first time
	// such a card opens, so no other card or page pays for it; the models' Draco unpacker is
	// served from here too. The viewer's own loading bar is left out: the dots show the wait.
	const MODELS = {
		'fef72a56-01e6-480a-924b-50e37af3dfba': '/resources/models/TAOM_3D_Chalk_V10.glb'   // Taom Chalk
	};
	const stamp = (() => {
		const s = document.querySelector('script[src*="/scripts/tdc.js"]');
		return s ? new URL(s.src).search : '';
	})();
	let viewerLib = null;
	function loadViewer() {
		if (customElements.get('model-viewer')) return Promise.resolve();
		if (viewerLib) return viewerLib;
		// Read by the viewer once, as it loads: so it is set before, never after. The module
		// build, not the UMD one: the UMD wrapper overwrites this global with its own exports
		// before reading it, so the unpacker came from Google's servers.
		self.ModelViewerElement = Object.assign(self.ModelViewerElement || {}, { dracoDecoderLocation: '/scripts/vendor/draco/' });
		viewerLib = new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.type = 'module';
			s.src = '/scripts/vendor/model-viewer.js' + stamp;
			s.onload = () => {
				if (customElements.get('model-viewer')) { resolve(); return; }
				viewerLib = null;
				reject(new Error('model-viewer.js loaded but defined no <model-viewer>'));
			};
			s.onerror = () => { viewerLib = null; reject(new Error('model-viewer.js did not load')); };
			document.head.appendChild(s);
		});
		return viewerLib;
	}

	// ─── The site's light on the model (UV, 25 Nov: "use our light source ... from the correct angle") ───
	// The viewer has no light of its own, only a picture of a room round the model that lights
	// it. So the room is drawn here: dim, with one bright soft light in it. page-light.js
	// publishes where the site's light is on <html> as the shadow it casts (--page-shadow-x/y,
	// pointing away from it), so the light is the other way, a little in front of the screen.
	// Each time that changes, or the model is turned, the room is turned so its light sits
	// there, as seen from where you are looking. Turning it is cheap (no new picture), and it
	// is read only when the style on <html> changes, which page-light.js writes only on a change.
	// The viewer's three.js scene is reached by its own symbol: the viewer is pinned in
	// package.json, so a new version is checked before it is taken.
	// Brighter room and stronger lamp cost the same: both are this one picture (UV, 25 Nov: the
	// model looked dark). The exposure brightens the whole render on top.
	const LIGHT = {
		ambient: '#8a8a8a',   // the room: how much the side away from the light still shows
		lamp: '#ffffff',      // the light
		size: 0.2,            // its glow's radius, as a share of the picture's width
		exposure: 1.5,        // the render's brightness overall
		front: 1.6            // how far toward you it is, against 1 across the screen: mostly on the face you see, still leaning with the page's light (UV, 25 Nov)
	};
	// How big the model sits in its box: the camera's distance as a share of the viewer's own
	// fit. UV, 25 Nov: 10% smaller than the fit. Measured, not worked out: the near face is
	// close to the camera, so 111% made it only 5.5% smaller, 120% 11.6%.
	const CAMERA_FAR = '118%';
	let roomUrl = null;
	function room() {
		if (roomUrl) return Promise.resolve(roomUrl);
		const c = document.createElement('canvas');
		c.width = 1024;
		c.height = 512;
		const g = c.getContext('2d');
		g.fillStyle = LIGHT.ambient;
		g.fillRect(0, 0, c.width, c.height);
		// The light at the middle of the picture: along +X in three's wrapping of it.
		const r = c.width * LIGHT.size;
		const glow = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, r);
		glow.addColorStop(0, LIGHT.lamp);
		glow.addColorStop(0.35, LIGHT.lamp);
		glow.addColorStop(1, LIGHT.ambient);
		g.fillStyle = glow;
		g.fillRect(c.width / 2 - r, c.height / 2 - r, 2 * r, 2 * r);
		return new Promise((resolve, reject) => c.toBlob((b) => {
			if (!b) { reject(new Error('the light could not be drawn')); return; }
			resolve(roomUrl = URL.createObjectURL(b));
		}, 'image/png'));
	}

	// Turns the room so its light (+X) is where the site's light is, until the card is left.
	function followLight(mv) {
		const sym = Object.getOwnPropertySymbols(mv).find((s) => s.description === 'scene');
		const scene = sym && mv[sym];
		if (!scene || !scene.environmentRotation || typeof scene.queueRender !== 'function') {
			throw new Error('the viewer\'s scene was not where expected; check it after a model-viewer update');
		}
		const css = getComputedStyle(document.documentElement);
		const aim = () => {
			if (!mv.isConnected) { stop(); return; }   // the card was left: stop following
			// On the screen: the light is opposite the shadow (screen y runs down, so up is -y).
			let sx = -parseFloat(css.getPropertyValue('--page-shadow-x')) || 0;
			let sy = parseFloat(css.getPropertyValue('--page-shadow-y')) || 0;
			const flat = Math.hypot(sx, sy);
			if (flat) { sx /= flat; sy /= flat; } else { sy = 1; }
			// Where you are looking from: the viewer's orbit round the model.
			const o = mv.getCameraOrbit();
			const back = [Math.sin(o.phi) * Math.sin(o.theta), Math.cos(o.phi), Math.sin(o.phi) * Math.cos(o.theta)];
			let right = [back[2], 0, -back[0]];
			const rl = Math.hypot(right[0], right[2]) || 1;
			right = [right[0] / rl, 0, right[2] / rl];
			const up = [back[1] * right[2] - back[2] * right[1], back[2] * right[0] - back[0] * right[2], back[0] * right[1] - back[1] * right[0]];
			const L = [0, 1, 2].map((i) => sx * right[i] + sy * up[i] + LIGHT.front * back[i]);
			// The turn that takes the room's +X to L: about Y, then about Z.
			const b = Math.atan2(L[2], L[0]);
			const a = Math.atan2(-L[1], Math.hypot(L[0], L[2]));
			scene.environmentRotation.set(0, -b, -a, 'ZYX');
			scene.queueRender();
		};
		const watch = new MutationObserver(aim);
		const stop = () => { watch.disconnect(); mv.removeEventListener('camera-change', aim); };
		aim();
		mv.addEventListener('camera-change', aim);
		watch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
	}

	// ─── It turns, very slowly, about a direction picked at random, until touched; then it stays
	// where it is (UV, 25 Nov). The model turns, not the camera, so the site's light stays where it
	// is on the screen. Not with less motion (the profile menu's toggle or the device's setting).
	const SPIN_DEG_PER_S = 12;   // a whole turn in 30 s
	function spin(mv) {
		if (TDCPrefs.lessMotion) return;
		const sym = Object.getOwnPropertySymbols(mv).find((s) => s.description === 'scene');
		const scene = sym && mv[sym];
		const target = scene && scene.getObjectByName && scene.getObjectByName('Target');
		const model = target && target.children[0];
		if (!model || !model.quaternion || typeof scene.queueRender !== 'function') {
			throw new Error('the viewer\'s model was not where expected; check it after a model-viewer update');
		}
		// A direction picked evenly over every way round.
		const z = Math.random() * 2 - 1, t = Math.random() * 2 * Math.PI, s = Math.sqrt(1 - z * z);
		const axis = { x: s * Math.cos(t), y: s * Math.sin(t), z };
		let angle = 0, last = null, frame = 0;
		const step = (now) => {
			if (!mv.isConnected) return;   // the card was left
			if (last !== null) angle += (now - last) / 1000 * SPIN_DEG_PER_S * Math.PI / 180;
			last = now;
			model.quaternion.setFromAxisAngle(axis, angle);
			scene.queueRender();
			frame = requestAnimationFrame(step);
		};
		const halt = () => cancelAnimationFrame(frame);
		mv.addEventListener('pointerdown', halt, { once: true });
		frame = requestAnimationFrame(step);
	}

	// The box is drawn at once (the hero's size and look); the viewer goes in once loaded.
	// Call show() after the box is on the page, so the dots have somewhere to sit.
	function modelHero(p) {
		const box = make('span', 'shop-pic shop-hero shop-model');
		const show = async () => {
			try {
				await TDC.busy(box, (async () => {
					const [, env] = await Promise.all([loadViewer(), room()]);
					const mv = document.createElement('model-viewer');
					mv.setAttribute('environment-image', env);
					mv.setAttribute('exposure', String(LIGHT.exposure));
					mv.setAttribute('camera-orbit', `auto auto ${CAMERA_FAR}`);
					mv.setAttribute('max-camera-orbit', `Infinity 157.5deg ${CAMERA_FAR}`);   // the viewer's default, but no further out than that
					mv.setAttribute('src', MODELS[p.id] + stamp);
					mv.setAttribute('alt', p.name);
					// Drag turns it, any direction; it never pans (UV, 25 Nov).
					mv.setAttribute('camera-controls', '');
					mv.setAttribute('disable-pan', '');
					mv.setAttribute('touch-action', 'none');
					mv.append(make('span', null));
					mv.lastChild.slot = 'progress-bar';
					await new Promise((resolve, reject) => {
						mv.addEventListener('load', resolve, { once: true });
						mv.addEventListener('error', (e) => reject(new Error((e.detail && e.detail.type) || 'the model did not load')), { once: true });
						box.append(mv);
					});
					// Without the site's light the model still shows, lit by the room alone.
					try { followLight(mv); }
					catch (err) { TDC.error(AREA, `the site's light could not be put on ${p.name}.`, err, sheetEls.status); }
					try { spin(mv); }
					catch (err) { TDC.error(AREA, `${p.name} could not be set turning.`, err, sheetEls.status); }
				})(), sheetEls.status);
			} catch (err) {
				TDC.error(AREA, `the 3D view of ${p.name} could not be shown.`, err, sheetEls.status);
				box.replaceWith(pic(p.picture_path, p.name, 'shop-hero'));
			}
		};
		return { box, show };
	}

	// ─── The product sheet, over the page: a category's products, then one product's card ───
	let sheetDlg = null;
	let sheetEls = null;
	let sheetCat = null;    // the category open in the sheet
	let sheetProd = null;   // the product whose card is showing, or null for the list
	let pickQty = 1;        // the quantity chosen on the product card
	const sheetOpen = () => !!(sheetDlg && sheetDlg.open);

	function buildSheet() {
		sheetDlg = make('dialog', 'cc shop-sheet');
		sheetDlg.setAttribute('aria-labelledby', 'shop-sheet-title');
		sheetDlg.dataset.pull = 'off';
		const head = make('div', 'cc-head');
		const back = make('button', 'cc-icon');
		back.type = 'button';
		back.setAttribute('aria-label', 'Back');
		back.append(icon('M15 5l-7 7 7 7'));
		const title = make('h2');
		title.id = 'shop-sheet-title';
		title.tabIndex = -1;
		title.autofocus = true;
		const close = make('button', 'cc-icon', '✕');
		close.type = 'button';
		close.setAttribute('aria-label', 'Close');
		head.append(back, title, close);
		const body = make('div', 'shop-sheet-body');
		const status = make('div', 'status');
		sheetDlg.append(head, body, status);
		document.body.appendChild(sheetDlg);
		sheetEls = { back, title, body, status, page: null };
		// Back on every screen (UV, 25 Nov): a product's card goes back to its category's list;
		// the list, or the card of a category's only product, goes back to the category cards
		// on the page, closing the sheet.
		back.addEventListener('click', () => {
			if (sheetProd && sheetCat.products.length > 1) { sheetProd = null; drawSheet(-1); }
			else TDC.cardClose(sheetDlg);
		});
		close.addEventListener('click', () => TDC.cardClose(sheetDlg));
		sheetDlg.addEventListener('click', (e) => { if (e.target === sheetDlg) TDC.cardClose(sheetDlg); });
	}

	function openSheet(cat) {
		if (!sheetDlg) buildSheet();
		sheetCat = cat;
		sheetProd = cat.products.length === 1 ? cat.products[0] : null;
		pickQty = sheetProd ? (qtyOf(sheetProd.id) || 1) : 1;
		TDC.status(sheetEls.status, '', '');
		drawSheet(0);
		TDC.cardOpen(sheetDlg);
	}

	// dir: 1 going on to a product, -1 back to the list, 0 opening (no slide).
	function drawSheet(dir) {
		if (sheetProd) drawProduct(sheetProd, dir);
		else drawProducts(sheetCat, dir);
	}

	// Each screen is a page of its own in the sheet's body, so the old one can slide out as the
	// new one slides in (UV, 25 Nov; TDC.cardTurn).
	function showPage(page, dir) {
		const old = sheetEls.page;
		const turn = TDC.cardTurn(sheetDlg, old);
		sheetEls.body.append(page);
		sheetEls.page = page;
		turn(page, dir, (gone) => gone.remove());
	}

	// The category's products as rows; a row opens its card.
	function drawProducts(cat, dir) {
		sheetEls.title.textContent = cat.name;
		const list = make('ul', 'shop-list');
		list.append(...cat.products.map((p) => {
			const li = make('li');
			const b = make('button', 'shop-item');
			b.type = 'button';
			b.dataset.noDots = '';
			const words = make('span', 'shop-words');
			words.append(make('span', 'shop-name', p.name), make('span', 'shop-price', price(p.price_credits)));
			b.append(pic(p.picture_path, p.name), words);
			const n = qtyOf(p.id);
			if (n) {
				const badge = make('span', 'shop-badge', String(n));
				badge.setAttribute('aria-label', `${n} in your cart`);
				b.append(badge);
			}
			b.append(make('span', 'shop-chev', '›'));
			b.addEventListener('click', () => {
				sheetProd = p;
				pickQty = qtyOf(p.id) || 1;
				TDC.status(sheetEls.status, '', '');
				drawSheet(1);
			});
			li.append(b);
			return li;
		}));
		const page = make('div', 'shop-sheet-page');
		page.append(list);
		showPage(page, dir);
	}

	// One product's card: the picture large, the price, how it is collected, a quantity and
	// Add to cart (Update cart once in it; down to 0 it becomes Remove from cart).
	function drawProduct(p, dir) {
		sheetEls.title.textContent = sheetCat.name;   // the product's own name is under its picture
		const had = qtyOf(p.id);
		const model = MODELS[p.id] ? modelHero(p) : null;
		const hero = model ? model.box : pic(p.picture_path, p.name, 'shop-hero');
		const name = make('h3', 'shop-prod-name', p.name);
		const cost = make('div', 'shop-prod-price', price(p.price_credits));
		const how = make('div', 'shop-collect', COLLECT[p.collect] || '');

		const row = make('div', 'shop-prod-qty');
		const minus = make('button', 'shop-step', '−');
		minus.type = 'button';
		minus.dataset.noDots = '';
		minus.setAttribute('aria-label', 'One fewer');
		const n = make('span', 'shop-step-n', String(pickQty));
		n.setAttribute('aria-live', 'polite');
		const plus = make('button', 'shop-step is-plus', '+');
		plus.type = 'button';
		plus.dataset.noDots = '';
		plus.setAttribute('aria-label', 'One more');
		const sum = make('span', 'shop-prod-sum');
		row.append(minus, n, plus, sum);

		const go = make('button', 'btn btn-primary shop-prod-go');
		go.type = 'button';
		const draw = () => {
			n.textContent = String(pickQty);
			minus.disabled = pickQty <= (had ? 0 : 1);
			plus.disabled = pickQty >= 99;
			sum.textContent = pickQty ? `${pickQty * p.price_credits} credits` : '';
			go.textContent = !had ? 'Add to cart' : pickQty ? 'Update cart' : 'Remove from cart';
			go.disabled = saving.has(p.id) || (had && pickQty === had);
		};
		minus.addEventListener('click', () => { pickQty = Math.max(0, pickQty - 1); draw(); });
		plus.addEventListener('click', () => { pickQty = Math.min(99, pickQty + 1); draw(); });
		go.addEventListener('click', async () => {
			const ok = await setQty(p, pickQty, go, sheetEls.status);
			if (!ok || !sheetOpen()) return;
			// Back to the category's list, which shows what is now in the cart; a category of
			// one has no list, so the sheet closes.
			if (sheetCat.products.length === 1) TDC.cardClose(sheetDlg);
			else { sheetProd = null; drawSheet(-1); }
		});
		draw();
		const words = make('div', 'shop-prod-words');
		words.append(name, cost, how);
		const page = make('div', 'shop-sheet-page');
		page.append(hero, words, row, go);
		showPage(page, dir);
		if (model) model.show();
	}

	function drawBar() {
		const count = cart ? cart.count : 0;
		els.bar.hidden = !count;
		if (!count) return;
		els.barCount.textContent = `${count} item${count === 1 ? '' : 's'}`;
		els.barTotal.textContent = `· ${cart.total_credits} credits`;
	}

	// ─── Writing the cart: the server's cart comes back and is drawn ───
	// Answers true once the server's cart is back. statusEl: where a failure shows (the cart's
	// own line when the cart is open, else the page's).
	async function setQty(p, qty, btn, statusEl) {
		if (!signedIn) {
			TDCSignIn.open();   // the sign-in card over the shop (28 Nov); signed in, it reloads
			return false;
		}
		if (saving.has(p.id)) return false;
		const where = statusEl || (cartOpen() ? cartEls.status : els.status);
		saving.add(p.id);
		if (btn) btn.disabled = true;
		TDC.status(where, '', '');
		let ok = false;
		try {
			const { data, error } = await TDC.busy(btn, supabaseClient.rpc('tdc_set_cart_qty', { p_product_id: p.id, p_qty: qty }), where);
			if (error) {
				TDC.showSupabaseError(AREA, error, where);
				return false;
			}
			cart = data;
			ok = true;
		} catch (err) {
			TDC.error(AREA, 'could not change your cart.', err, where);
		} finally {
			saving.delete(p.id);
			if (btn) btn.disabled = false;
			drawCats();
			drawBar();
			if (cartOpen()) drawCart();
		}
		return ok;
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
		close.addEventListener('click', () => TDC.cardClose(cartDlg));
		cartDlg.addEventListener('click', (e) => { if (e.target === cartDlg) TDC.cardClose(cartDlg); });
	}

	// The cart grows or shrinks to what it now holds (UV, 25 Nov; TDC.cardResize).
	function drawCart() { TDC.cardResize(cartDlg, drawCartNow); }
	function drawPay() { TDC.cardResize(cartDlg, drawPayNow); }

	function drawCartNow() {
		const rows = (cart ? cart.items : []).map((p) => {
			const li = make('li', 'shop-cart-line' + (p.active ? '' : ' is-off'));
			const words = make('div', 'shop-words');
			words.append(make('div', 'shop-name', p.name),
				make('div', 'shop-price', p.active ? price(p.qty * p.price_credits) : 'No longer available'));
			li.append(pic(p.picture_path, p.name));
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
		drawPayNow();
	}

	// ─── Checkout: how to pay, where to collect, Place order ───
	let balance = null;     // tdc_my_credit_balance, read when the cart opens
	let payWith = null;     // 'credits' or 'club'
	let placeKey = null;    // one per attempt: a retry after a lost answer can't place twice
	let placing = false;

	function drawPayNow() {
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
		// The venue with its picture (UV, 24 Nov; TDC.venueMark)
		const venue = make('div', 'shop-name');
		venue.append(TDC.venueMark({ picture_path: shop.venue_picture_path }), document.createTextNode(shop.venue_name));
		cartEls.collect.replaceChildren(venue, make('div', 'shop-price', words.join(' ')));

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
		drawCats();
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
			TDC.cardClose(cartDlg);
			TDCOrder.open(data);
			TDC.flushEmails();
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
		TDC.cardOpen(cartDlg);
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
	drawCats();
	drawBar();
})(), 'Shop');
