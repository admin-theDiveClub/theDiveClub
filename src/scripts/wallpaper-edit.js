// The wallpaper's upload page (UV, 27 Nov; docs/systems/foundations.md,
// "Wallpapers"): /sandbox/wallpaper/edit/, signed in only.
//
// Everything is chosen on the page first and shown in the preview at once (the
// real wallpaper, TDCWallpaper from wallpaper-show.js); nothing is stored until
// Save. Save uploads the new pictures (shrunk to 1920px and re-encoded, which
// strips a phone photo's GPS position), saves the whole set
// (tdc_save_wallpaper), deletes the pictures taken out, then reads the
// wallpaper back from the server and draws that.
//
// Needs: tdc.js, hero.js, wallpaper-show.js.

(() => {
	const AREA = 'WallpaperEdit';
	const BUCKET = 'wallpaper-pictures';
	const MAX = 8;              // UV, 27 Nov
	const SIZE = 1920;          // the longer side, for a TV (UV asked for high quality)
	const QUALITY = 0.9;
	const COLOURS = {
		cloth_colour: '--bg-base',
		markings_colour: '--text-muted',
		lines_colour: '--color-primary',
		cue_colour: '--color-warning'
	};
	const FITS = [
		['fit', 'Whole, in the middle'],
		['fill', 'Fill the middle'],
		['cloth', 'Fill the cloth']
	];

	const $ = (id) => document.getElementById(id);
	const els = {
		status: $('wpe-status'),
		list: $('wpe-list'),
		count: $('wpe-count'),
		add: $('wpe-add'),
		file: $('wpe-file'),
		transition: $('wpe-transition'),
		seconds: $('wpe-seconds'),
		colours: Array.from(document.querySelectorAll('[data-colour]')),
		reset: $('wpe-reset'),
		link: $('wpe-link'),
		copy: $('wpe-copy'),
		open: $('wpe-open'),
		save: $('wpe-save'),
		saveStatus: $('wpe-save-status')
	};

	const show = TDCWallpaper.create({
		area: AREA,
		scope: $('wp'),
		clothEl: $('wp'),
		stage: $('hero-stage'),
		pics: $('wp-pics'),
		logo: $('wp-logo'),
		icon: null,
		status: els.status
	});

	let uid = null;
	let saved = null;           // the wallpaper as the server last gave it, or null
	// What the page holds: images are { path } once saved, { blob } until then,
	// each with url (to show it) and fit
	let state = blank();

	function blank() {
		return { images: [], cloth_colour: null, markings_colour: null, lines_colour: null, cue_colour: null, transition: 'fade', seconds: 10 };
	}

	// A site colour as #rrggbb, for a colour input's starting value
	const probe = document.createElement('canvas').getContext('2d');
	function siteColour(token) {
		const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
		probe.fillStyle = '#000000';
		probe.fillStyle = v;
		const out = probe.fillStyle;
		return /^#[0-9a-f]{6}$/i.test(out) ? out.toLowerCase() : '#000000';
	}

	function settings() {
		return {
			cloth_colour: state.cloth_colour,
			markings_colour: state.markings_colour,
			lines_colour: state.lines_colour,
			cue_colour: state.cue_colour,
			transition: state.transition,
			seconds: state.seconds
		};
	}

	function changed() {
		draw();
		TDC.status(els.saveStatus, 'Changes not saved yet.', 'warning');
	}

	// ─── Drawing the page from state ───

	function draw() {
		show.set(settings(), state.images.map((im) => ({ src: im.url, fit: im.fit })));

		els.list.replaceChildren(...state.images.map(row));
		els.count.textContent = state.images.length
			? `${state.images.length} of ${MAX} pictures, shown in this order.`
			: `None yet: the club's logo shows. Up to ${MAX} pictures.`;
		els.add.disabled = state.images.length >= MAX;

		els.transition.value = state.transition;
		els.seconds.value = state.seconds;
		els.colours.forEach((input) => {
			const key = input.dataset.colour;
			input.value = state[key] || siteColour(COLOURS[key]);
		});

		const code = saved && saved.code;
		const url = code ? `${location.origin}/${code}` : '';
		els.link.textContent = code ? url.replace(/^https?:\/\//, '') : 'Save to get your link.';
		els.copy.hidden = els.open.hidden = !code;
		els.copy.dataset.url = els.open.dataset.url = url;
	}

	function row(im, i) {
		const li = document.createElement('li');
		li.className = 'wp-item';

		// The outline: the table, its markings, and the picture where it goes
		const outline = document.createElement('div');
		outline.className = 'wp-outline';
		const box = document.createElement('div');
		box.className = im.fit === 'cloth' ? 'wp-outline-cloth' : 'wp-outline-mid' + (im.fit === 'fit' ? ' is-fit' : '');
		const img = document.createElement('img');
		img.src = im.url;
		img.alt = `Picture ${i + 1}`;
		box.appendChild(img);
		const cross = document.createElement('span');
		cross.className = 'wp-outline-cross';
		const baulk = document.createElement('span');
		baulk.className = 'wp-outline-baulk';
		outline.append(box, cross, baulk);

		const controls = document.createElement('div');
		controls.className = 'wp-item-controls';
		const sel = document.createElement('select');
		sel.setAttribute('aria-label', `How picture ${i + 1} is shown`);
		FITS.forEach(([value, words]) => sel.add(new Option(words, value, false, value === im.fit)));
		sel.addEventListener('change', () => { im.fit = sel.value; changed(); });

		const buttons = document.createElement('div');
		buttons.className = 'wp-item-buttons';
		const btn = (label, words, disabled, fn) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'btn btn-secondary btn-sm';
			b.textContent = label;
			b.setAttribute('aria-label', words);
			b.disabled = disabled;
			b.addEventListener('click', fn);
			return b;
		};
		buttons.append(
			btn('↑', `Move picture ${i + 1} earlier`, i === 0, () => move(i, -1)),
			btn('↓', `Move picture ${i + 1} later`, i === state.images.length - 1, () => move(i, 1)),
			btn('✕', `Take picture ${i + 1} out`, false, () => removeAt(i))
		);
		controls.append(sel, buttons);
		li.append(outline, controls);
		return li;
	}

	function move(i, by) {
		const j = i + by;
		[state.images[i], state.images[j]] = [state.images[j], state.images[i]];
		changed();
	}

	function removeAt(i) {
		const [im] = state.images.splice(i, 1);
		if (im.blob) URL.revokeObjectURL(im.url);
		changed();
	}

	// ─── Choosing ───

	els.add.addEventListener('click', () => els.file.click());
	els.file.addEventListener('change', async () => {
		const files = Array.from(els.file.files || []);
		els.file.value = '';
		if (!files.length) return;
		const room = MAX - state.images.length;
		TDC.status(els.status, '');
		if (files.length > room) {
			TDC.status(els.status, `A wallpaper takes at most ${MAX} pictures, so only the first ${room} were added.`, 'warning');
		}
		els.add.disabled = true;
		for (const file of files.slice(0, room)) {
			const blob = await TDC.preparePicture(file, SIZE, AREA, els.status, { whole: true, quality: QUALITY });
			if (!blob) continue;   // preparePicture has said why
			state.images.push({ blob, url: URL.createObjectURL(blob), fit: 'fit' });
		}
		changed();
	});

	els.transition.addEventListener('change', () => { state.transition = els.transition.value; changed(); });
	els.seconds.addEventListener('change', () => {
		const n = Math.round(Number(els.seconds.value));
		state.seconds = Number.isFinite(n) ? Math.max(3, Math.min(300, n)) : 10;
		changed();
	});
	els.colours.forEach((input) => {
		input.addEventListener('input', () => {
			state[input.dataset.colour] = input.value.toLowerCase();
			show.set(settings(), state.images.map((im) => ({ src: im.url, fit: im.fit })));
			TDC.status(els.saveStatus, 'Changes not saved yet.', 'warning');
		});
	});
	els.reset.addEventListener('click', () => {
		Object.keys(COLOURS).forEach((key) => { state[key] = null; });
		changed();
	});

	els.copy.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(els.copy.dataset.url);
			TDC.status(els.saveStatus, 'Link copied.', 'success');
		} catch (err) {
			TDC.error(AREA, 'the link could not be copied. Copy it from above instead.', err, els.saveStatus);
		}
	});
	els.open.addEventListener('click', () => window.open(els.open.dataset.url, '_blank', 'noopener'));

	// ─── Saving ───

	els.save.addEventListener('click', async () => {
		els.save.disabled = true;
		TDC.status(els.saveStatus, 'Saving…');
		const uploaded = [];
		try {
			const images = [];
			for (const im of state.images) {
				if (im.path) { images.push({ path: im.path, fit: im.fit }); continue; }
				const ext = im.blob.type === 'image/webp' ? 'webp' : 'jpg';
				const path = `${uid}/${crypto.randomUUID()}.${ext}`;
				const { error } = await supabaseClient.storage.from(BUCKET)
					.upload(path, im.blob, { contentType: im.blob.type, upsert: false });
				if (error) throw Object.assign(new Error('a picture could not be uploaded.'), { cause: error });
				uploaded.push(path);
				images.push({ path, fit: im.fit });
			}

			const { data, error } = await supabaseClient.rpc('tdc_save_wallpaper', { p_settings: { ...settings(), images } });
			if (error) throw Object.assign(new Error('the wallpaper could not be saved.'), { cause: error });

			// The pictures taken out. Left behind if this fails, which nobody sees; said all the same
			const removed = data.removed || [];
			if (removed.length) {
				const { error: delErr } = await supabaseClient.storage.from(BUCKET).remove(removed);
				if (delErr) TDC.error(AREA, 'saved, but the pictures you took out could not be deleted from storage.', delErr, els.status);
			}

			await read();
			TDC.status(els.saveStatus, 'Saved. The TV shows it next time the wallpaper opens.', 'success');
		} catch (err) {
			// Nothing half-saved: the new uploads go again
			if (uploaded.length) await supabaseClient.storage.from(BUCKET).remove(uploaded);
			TDC.error(AREA, err.message, err.cause || err, els.saveStatus);
		} finally {
			els.save.disabled = false;
		}
	});

	// ─── Reading from the server ───

	async function read() {
		const { data, error } = await supabaseClient.rpc('tdc_my_wallpaper');
		if (error) {
			TDC.error(AREA, 'your wallpaper could not be loaded.', error, els.status);
			return;
		}
		state.images.forEach((im) => { if (im.blob) URL.revokeObjectURL(im.url); });
		saved = data;
		state = blank();
		if (data) {
			state.images = (data.images || []).map((im) => ({ path: im.path, url: TDC.pictureUrl(BUCKET, im.path), fit: im.fit }));
			Object.keys(COLOURS).forEach((key) => { state[key] = data[key] || null; });
			state.transition = data.transition;
			state.seconds = data.seconds;
		}
		draw();
	}

	async function start() {
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		uid = session.user.id;
		await read();
	}

	TDCLoader.hold(start(), 'Opening your wallpaper');
})();
