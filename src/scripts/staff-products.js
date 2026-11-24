// Staff products page (/staff/products/; 24 Nov; docs/design/shop.md, Stage 2). Owners and admins
// of a venue that sells credits (the database checks again: private.tdc_can_manage_shop).
// The list: each category with its products (picture, name, price in credits with the rand, how
// collected, and a switch for In the shop: off when it runs out, as there are no stock counts until
// P5). A tap on a product opens its form; Add a product opens an empty one. Under the list, the
// categories: the shop's tabs in order (up and down), renamed, deleted once empty, added.
// A picture is added once the product is saved, as league and team pictures are: cropped square,
// 512px, re-encoded (EXIF gone), a new random name in the product's folder of product-pictures,
// named through tdc_set_shop_product_picture, which hands back the old file to delete.
// After every write the list is read again from the server.
// Needs: supabaseClient.js, tdc.js, staff-common.js.

TDCLoader.hold((async () => {
	const AREA = 'StaffProducts';
	const BUCKET = 'product-pictures';
	const COLLECT = { bar: 'Made at the bar', collect: 'Collect within 30 days' };

	const el = (id) => document.getElementById(id);
	const els = {
		lineEl: el('venue-line'), fieldEl: el('venue-field'), selectEl: el('venue-select'), statusEl: el('status-msg'),
		staffArea: el('staff-area'), manage: el('manage-area'),
		listView: el('list-view'), groups: el('product-groups'), addProduct: el('add-product'),
		catList: el('cat-list'), catForm: el('cat-form'), catName: el('cat-name'), catAdd: el('cat-add'),
		editView: el('edit-view'), editTitle: el('edit-title'), form: el('product-form'), name: el('p-name'),
		category: el('p-category'), price: el('p-price'), rand: el('p-rand'), collect: el('p-collect'),
		active: el('p-active'), save: el('p-save'), picArea: el('pic-area'), picLater: el('pic-later'),
		picPreview: el('pic-preview'), picChoose: el('pic-choose'), picRemove: el('pic-remove'),
		picFile: el('pic-file'), picStatus: el('pic-status'), back: el('edit-back')
	};
	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'products page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const roles = await TDCStaff.loadVenues(AREA, session.user.id, els);
	if (!roles) return;
	els.staffArea.hidden = false;

	const venue = () => els.selectEl.value;
	let shop = null;       // tdc_staff_shop
	let editing = null;    // the product open in the form, or null for a new one

	function make(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}
	function rand(credits) {
		if (!shop || shop.cents_per_credit == null || !Number.isFinite(credits)) return '';
		const cents = credits * shop.cents_per_credit;
		return 'R' + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
	}
	function pic(path, name) {
		const box = make('span', 'shop-pic');
		const url = TDC.pictureUrl(BUCKET, path);
		if (url) {
			const img = make('img');
			img.alt = '';
			img.src = url;
			box.append(img);
		} else {
			box.append(make('span', 'shop-pic-none', (name || '?').slice(0, 1).toUpperCase()));
		}
		return box;
	}
	function isAdminHere() {
		const r = roles.find((x) => x.venue_id === venue());
		return !!(r && ['owner', 'admin'].includes(r.role));
	}

	// ─── Load ───
	async function load() {
		if (!isAdminHere()) {
			els.manage.hidden = true;
			TDC.status(els.statusEl, 'Products are for owners and admins only at this venue.', 'error');
			return;
		}
		const id = venue();
		const { data, error } = await TDC.busy(document.querySelector('.tdc-card h1'), supabaseClient.rpc('tdc_staff_shop', { p_venue_id: id }), els.statusEl);
		if (id !== venue()) return;
		if (error) {
			TDC.showSupabaseError(AREA, error, els.statusEl);
			return;
		}
		shop = data;
		els.manage.hidden = false;
		drawList();
		drawCats();
	}

	// ─── The list ───
	function drawList() {
		const groups = shop.categories.map((c) => {
			const box = make('section', 'pm-group');
			box.append(make('h2', null, c.name));
			if (!c.products.length) {
				box.append(make('p', 'muted pm-none', 'No products yet.'));
				return box;
			}
			const ul = make('ul', 'shop-list');
			for (const p of c.products) {
				const li = make('li', 'shop-item' + (p.active ? '' : ' is-off'));
				const open = make('button', 'pm-open');
				open.type = 'button';
				const words = make('span', 'shop-words');
				const r = rand(p.price_credits);
				words.append(make('span', 'shop-name', p.name),
					make('span', 'shop-price', `${p.price_credits} credits` + (r ? ` · ${r}` : '')),
					make('span', 'shop-collect', p.active ? COLLECT[p.collect] : 'Not in the shop'));
				open.append(pic(p.picture_path, p.name), words);
				open.addEventListener('click', () => openForm(p));
				const sw = make('input');
				sw.type = 'checkbox';
				sw.checked = p.active;
				sw.setAttribute('aria-label', `${p.name} in the shop`);
				sw.addEventListener('change', () => setActive(p, sw));
				li.append(open, sw);
				ul.append(li);
			}
			box.append(ul);
			return box;
		});
		els.groups.replaceChildren(...groups);
	}

	async function setActive(p, sw) {
		const want = sw.checked;
		const { error } = await TDC.busy(sw.closest('.shop-item'), supabaseClient.rpc('tdc_set_shop_product_active', { p_product_id: p.id, p_active: want }), els.statusEl);
		if (error) {
			sw.checked = !want;
			TDC.showSupabaseError(AREA, error, els.statusEl);
			return;
		}
		TDC.status(els.statusEl, want ? `${p.name} is in the shop.` : `${p.name} is out of the shop.`, 'success');
		await load();
	}

	// ─── Categories ───
	function drawCats() {
		const cats = shop.categories;
		els.catList.replaceChildren(...cats.map((c, i) => {
			const li = make('li', 'pm-cat');
			li.append(make('span', 'pm-cat-name', c.name));
			const btn = (text, label, fn, disabled) => {
				const b = make('button', 'btn-sm', text);
				b.type = 'button';
				b.setAttribute('aria-label', label);
				b.disabled = !!disabled;
				b.addEventListener('click', () => fn(b));
				return b;
			};
			li.append(
				btn('↑', `Move ${c.name} up`, (b) => move(i, -1, b), i === 0),
				btn('↓', `Move ${c.name} down`, (b) => move(i, 1, b), i === cats.length - 1),
				btn('Rename', `Rename ${c.name}`, (b) => rename(c, b)),
				btn('Delete', `Delete ${c.name}`, (b) => remove(c, b), c.products.length > 0)
			);
			return li;
		}));
	}

	async function write(btn, call, done) {
		TDC.status(els.statusEl, '', '');
		const { error } = await TDC.busy(btn, call, els.statusEl);
		if (error) {
			TDC.showSupabaseError(AREA, error, els.statusEl);
			return false;
		}
		await load();
		if (done) TDC.status(els.statusEl, done, 'success');
		return true;
	}

	function move(i, step, btn) {
		const ids = shop.categories.map((c) => c.id);
		[ids[i], ids[i + step]] = [ids[i + step], ids[i]];
		return write(btn, supabaseClient.rpc('tdc_set_shop_category_order', { p_venue_id: venue(), p_category_ids: ids }));
	}
	function rename(c, btn) {
		const name = prompt(`Rename ${c.name} to:`, c.name);
		if (name == null || name.trim() === c.name) return;
		return write(btn, supabaseClient.rpc('tdc_save_shop_category', { p_venue_id: venue(), p_category_id: c.id, p_name: name }), 'Category renamed.');
	}
	function remove(c, btn) {
		if (!confirm(`Delete the category ${c.name}?`)) return;
		return write(btn, supabaseClient.rpc('tdc_delete_shop_category', { p_category_id: c.id }), 'Category deleted.');
	}
	els.catForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const name = els.catName.value.trim();
		if (!name) {
			TDC.status(els.statusEl, 'Please give the category a name.', 'error');
			return;
		}
		if (await write(els.catAdd, supabaseClient.rpc('tdc_save_shop_category', { p_venue_id: venue(), p_category_id: null, p_name: name }), `${name} added.`)) {
			els.catName.value = '';
		}
	});

	// ─── One product ───
	function openForm(p) {
		editing = p;
		if (!shop.categories.length) {
			TDC.status(els.statusEl, 'Add a category first.', 'error');
			return;
		}
		els.category.replaceChildren(...shop.categories.map((c) => {
			const o = make('option', null, c.name);
			o.value = c.id;
			return o;
		}));
		els.editTitle.textContent = p ? p.name : 'New product';
		els.name.value = p ? p.name : '';
		els.category.value = p ? p.category_id : shop.categories[0].id;
		els.price.value = p ? String(p.price_credits) : '';
		els.collect.value = p ? p.collect : 'bar';
		els.active.checked = p ? p.active : true;
		els.active.dispatchEvent(new Event('change'));
		drawRand();
		drawPicture();
		TDC.status(els.statusEl, '', '');
		TDC.status(els.picStatus, '', '');
		els.listView.hidden = true;
		els.editView.hidden = false;
		window.scrollTo(0, 0);
	}
	function closeForm() {
		editing = null;
		els.editView.hidden = true;
		els.listView.hidden = false;
	}
	function drawRand() {
		const r = rand(parseInt(els.price.value, 10));
		els.rand.textContent = r ? `${r} at today's price per credit` : '';
	}
	els.price.addEventListener('input', drawRand);
	els.price.addEventListener('change', drawRand);
	els.addProduct.addEventListener('click', () => openForm(null));
	els.back.addEventListener('click', () => { TDC.status(els.statusEl, '', ''); closeForm(); });

	els.form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const price = parseInt(els.price.value, 10);
		if (!els.name.value.trim()) {
			TDC.status(els.statusEl, 'Please give the product a name.', 'error');
			return;
		}
		if (!Number.isInteger(price) || price < 1) {
			TDC.status(els.statusEl, 'Please give a price of at least 1 credit.', 'error');
			return;
		}
		els.save.disabled = true;
		TDC.status(els.statusEl, '', '');
		try {
			const { data: id, error } = await TDC.busy(els.save, supabaseClient.rpc('tdc_save_shop_product', {
				p_venue_id: venue(),
				p_product_id: editing ? editing.id : null,
				p_category_id: els.category.value,
				p_name: els.name.value,
				p_price_credits: price,
				p_collect: els.collect.value,
				p_active: els.active.checked
			}), els.statusEl);
			if (error) {
				TDC.showSupabaseError(AREA, error, els.statusEl);
				return;
			}
			const wasNew = !editing;
			await load();
			// Stay on the product: a new one can now take its picture.
			const saved = shop.categories.flatMap((c) => c.products).find((x) => x.id === id);
			if (saved) {
				editing = saved;
				els.editTitle.textContent = saved.name;
				drawPicture();
			}
			TDC.status(els.statusEl, wasNew ? 'Product added. You can add its picture now.' : 'Saved.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the product.', err, els.statusEl);
		} finally {
			els.save.disabled = false;
		}
	});

	// ─── Its picture ───
	function drawPicture() {
		els.picArea.hidden = !editing;
		els.picLater.hidden = !!editing;
		if (!editing) return;
		els.picPreview.replaceChildren(pic(editing.picture_path, editing.name));
		els.picRemove.hidden = !editing.picture_path;
		els.picChoose.textContent = editing.picture_path ? 'Change the picture' : 'Choose a picture';
	}
	function picBusy(on) {
		els.picChoose.disabled = on;
		els.picRemove.disabled = on;
	}
	async function afterPicture(path) {
		await load();
		const p = shop.categories.flatMap((c) => c.products).find((x) => x.id === editing.id);
		if (p) editing = p;
		else editing.picture_path = path;
		drawPicture();
	}

	els.picChoose.addEventListener('click', () => els.picFile.click());
	els.picFile.addEventListener('change', () => TDC.busy(els.picChoose, (async () => {
		const file = els.picFile.files && els.picFile.files[0];
		els.picFile.value = '';
		if (!file || !editing) return;
		const productId = editing.id;
		picBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			const blob = await TDC.preparePicture(file, 512, AREA, els.picStatus);
			if (!blob) return;
			// A new name every time, so no cached copy of the old picture is served in its place.
			const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
			const path = `${productId}/${crypto.randomUUID()}.${ext}`;
			const { error: upErr } = await supabaseClient.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
			if (upErr) { TDC.showSupabaseError(AREA, upErr, els.picStatus); return; }
			const { data: old, error } = await supabaseClient.rpc('tdc_set_shop_product_picture', { p_product_id: productId, p_path: path });
			if (error) {
				// Not named on the product, so the file just uploaded is an orphan.
				await supabaseClient.storage.from(BUCKET).remove([path]);
				TDC.showSupabaseError(AREA, error, els.picStatus);
				return;
			}
			await afterPicture(path);
			TDC.status(els.picStatus, 'Picture saved.', 'success');
			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(BUCKET).remove([old]);
				// The new picture is already the product's; the old file only takes up room.
				if (delErr) console.error('[' + AREA + '] could not delete the old picture', delErr);
			}
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the picture.', err, els.picStatus);
		} finally {
			picBusy(false);
		}
	})(), els.picStatus));

	els.picRemove.addEventListener('click', () => TDC.busy(els.picRemove, (async () => {
		if (!editing || !editing.picture_path) return;
		if (!confirm(`Remove the picture of ${editing.name}?`)) return;
		picBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			// Cleared on the product first: if the file delete fails, the picture is already gone from the shop.
			const { data: old, error } = await supabaseClient.rpc('tdc_set_shop_product_picture', { p_product_id: editing.id, p_path: null });
			if (error) { TDC.showSupabaseError(AREA, error, els.picStatus); return; }
			await afterPicture(null);
			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(BUCKET).remove([old]);
				if (delErr) console.error('[' + AREA + '] could not delete the picture file', delErr);
			}
			TDC.status(els.picStatus, 'Picture removed.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem removing the picture.', err, els.picStatus);
		} finally {
			picBusy(false);
		}
	})(), els.picStatus));

	els.selectEl.addEventListener('change', () => { TDC.status(els.statusEl, '', ''); closeForm(); load(); });
	await load();
})(), 'StaffProducts');
