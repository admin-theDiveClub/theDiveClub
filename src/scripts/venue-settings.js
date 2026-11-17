// A venue's Settings tab (UV, 17 Nov), on /venues/?v=<id>&tab=settings, for
// whoever may edit the venue: its owner or admin, or the site owner
// (private.tdc_can_edit_venue decides; the tab only appears for them, and the
// database refuses anybody else anyway).
//
// Every detail tdc_update_venue takes, the week's hours (tdc_set_venue_hours)
// and the picture. The name is not here: it stays in migrations (UV, 17 Nov).
//
// The picture is saved the moment it is chosen, as a league's is
// (league-settings.js): prepared in the browser (its longer side 512px, the whole picture rather than a square, re-encoded, EXIF
// gone), uploaded under a new random name into the venue's folder of
// venue-pictures, named on the venue, then the old file deleted. Everything else
// is saved with Save: the details first, then the hours, then the page reads
// everything again (venue.js). A blank box clears that detail.
//
// The page fills the form each time it reads. While the form holds changes not
// yet saved it is left alone (a picture saved in the meantime re-reads the page
// too), and only the picture follows.
//
// Needs: tdc.js. Started by venue.js through TDCVenueSettings.fill(venue, reload).

const TDCVenueSettings = (() => {
	const AREA = 'Venue settings';
	const BUCKET = 'venue-pictures';
	const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	const el = (id) => document.getElementById(id);
	const els = {
		meta: el('vs-meta'), pic: el('vs-pic'), picChoose: el('vs-pic-choose'), picRemove: el('vs-pic-remove'),
		picFile: el('vs-pic-file'), picStatus: el('vs-pic-status'),
		description: el('vs-description'), address: el('vs-address'), area: el('vs-area'), city: el('vs-city'),
		maps: el('vs-maps'), tableCount: el('vs-table-count'), tableNote: el('vs-table-note'),
		phone: el('vs-phone'), whatsapp: el('vs-whatsapp'), email: el('vs-email'),
		website: el('vs-website'), instagram: el('vs-instagram'), facebook: el('vs-facebook'),
		hours: el('vs-hours'), hoursNote: el('vs-hours-note'), save: el('vs-save'), status: el('vs-status')
	};
	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the venue settings are missing expected elements: ' + missing.join(', '));
		return { fill() {} };
	}

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// The text boxes and the column each one fills, in tdc_update_venue's words.
	const FIELDS = [
		['description', 'description', 'p_description'],
		['address', 'address', 'p_address'],
		['area', 'area', 'p_area'],
		['city', 'city', 'p_city'],
		['maps', 'maps_url', 'p_maps_url'],
		['tableNote', 'table_note', 'p_table_note'],
		['phone', 'phone', 'p_phone'],
		['whatsapp', 'whatsapp', 'p_whatsapp'],
		['email', 'email', 'p_email'],
		['website', 'website_url', 'p_website_url'],
		['instagram', 'instagram_url', 'p_instagram_url'],
		['facebook', 'facebook_url', 'p_facebook_url'],
		['hoursNote', 'hours_note', 'p_hours_note']
	];

	let venue = null;
	let reload = null;
	let dirty = false;
	let hours = [];   // [{ day, opens, closes }], as the form holds them
	let saving = false;

	// ─── Filling the form ───
	function fill(v, reloadPage) {
		venue = v;
		reload = reloadPage;
		els.meta.textContent = v.name;
		showPicture();
		if (dirty) return;
		for (const [key, column] of FIELDS) els[key].value = v[column] || '';
		els.tableCount.value = v.table_count == null ? '' : String(v.table_count);
		hours = (v.hours || []).map((h) => ({ day: h.day, opens: h.opens, closes: h.closes }));
		drawHours();
	}

	document.getElementById('settings').addEventListener('input', (e) => {
		if (e.target.closest('.league-pic-field')) return;
		dirty = true;
	});

	// ─── The hours: a row a day, each time it opens a pair of boxes ───
	function drawHours() {
		els.hours.replaceChildren(...DAYS.map((name, i) => {
			const d = i + 1;
			const row = node('div', 'vs-day');
			row.append(node('span', 'vs-day-name', name));
			const spans = node('div', 'vs-spans');
			const these = hours.filter((h) => h.day === d);
			if (!these.length) spans.append(node('span', 'vs-closed', 'Closed'));
			for (const h of these) {
				const span = node('div', 'vs-span');
				const time = (key, label) => {
					const input = node('input');
					input.type = 'time';
					input.value = h[key];
					input.setAttribute('aria-label', name + ' ' + label);
					input.addEventListener('input', () => { h[key] = input.value; });
					return input;
				};
				const x = node('button', 'btn btn-secondary btn-sm vs-span-x', '✕');
				x.type = 'button';
				x.title = 'Take this time off';
				x.setAttribute('aria-label', 'Take this time off ' + name);
				x.addEventListener('click', () => {
					hours.splice(hours.indexOf(h), 1);
					dirty = true;
					drawHours();
				});
				span.append(time('opens', 'opens'), node('span', 'vs-to', 'to'), time('closes', 'closes'), x);
				spans.append(span);
			}
			const add = node('button', 'btn btn-secondary btn-sm vs-add', these.length ? 'Add a time' : 'Open this day');
			add.type = 'button';
			add.addEventListener('click', () => {
				hours.push({ day: d, opens: '', closes: '' });
				dirty = true;
				drawHours();
				const boxes = els.hours.children[i].querySelectorAll('input[type="time"]');
				if (boxes.length) boxes[boxes.length - 2].focus();
			});
			row.append(spans, add);
			return row;
		}));
	}

	// ─── Save ───
	els.save.addEventListener('click', () => TDC.busy(els.save, (async () => {
		if (saving || !venue) return;
		TDC.status(els.status, '', '');

		const count = els.tableCount.value.trim();
		const tables = count === '' ? null : Number(count);
		if (tables !== null && (!Number.isInteger(tables) || tables < 0 || tables > 200)) {
			TDC.status(els.status, 'The number of tables must be a whole number from 0 to 200, or blank.', '');
			els.tableCount.focus();
			return;
		}
		const unfinished = hours.find((h) => !h.opens || !h.closes);
		if (unfinished) {
			TDC.status(els.status, DAYS[unfinished.day - 1] + ' has a time without both an opening and a closing time.', '');
			return;
		}

		const args = { p_venue_id: venue.id, p_table_count: tables };
		for (const [key, , param] of FIELDS) args[param] = els[key].value.trim() || null;

		saving = true;
		els.save.disabled = true;
		try {
			const details = await supabaseClient.rpc('tdc_update_venue', args);
			if (details.error) { TDC.showSupabaseError(AREA, details.error, els.status); return; }

			const week = await supabaseClient.rpc('tdc_set_venue_hours', {
				p_venue_id: venue.id,
				p_hours: hours.map((h) => ({ day: h.day, opens: h.opens, closes: h.closes }))
			});
			if (week.error) {
				TDC.showSupabaseError(AREA, week.error, els.status);
				els.status.textContent += ' The details were saved; the hours were not.';
				return;
			}

			dirty = false;
			await reload();
			TDC.status(els.status, 'Saved.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the venue.', err, els.status);
		} finally {
			saving = false;
			els.save.disabled = false;
		}
	})(), els.status));

	// ─── The picture ───
	function showPicture() {
		const url = TDC.pictureUrl(BUCKET, venue && venue.picture_path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = 'The venue’s picture';
			els.pic.replaceChildren(img);
		} else {
			els.pic.replaceChildren(node('span', 'vs-no-pic', 'None'));
		}
		els.picRemove.hidden = !(venue && venue.picture_path);
		els.picChoose.textContent = venue && venue.picture_path ? 'Change the picture' : 'Choose a picture';
	}

	function pictureBusy(on) {
		els.picChoose.disabled = on;
		els.picRemove.disabled = on;
	}

	els.picChoose.addEventListener('click', () => els.picFile.click());

	// The dots show the work on the button used, from the picture's preparation
	// to the save (UV, 29 Oct: never a loading message).
	els.picFile.addEventListener('change', () => TDC.busy(els.picChoose, (async () => {
		const file = els.picFile.files && els.picFile.files[0];
		els.picFile.value = '';
		if (!file || !venue) return;

		pictureBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			// The whole picture, not the middle square (UV, 17 Nov: shown in full).
			const blob = await TDC.preparePicture(file, 512, AREA, els.picStatus, { whole: true });
			if (!blob) return;

			// A new name every time, so no cached copy of the old picture is
			// served in its place.
			const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
			const path = `${venue.id}/${crypto.randomUUID()}.${ext}`;

			const { error: upErr } = await supabaseClient.storage
				.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
			if (upErr) { TDC.showSupabaseError(AREA, upErr, els.picStatus); return; }

			const { data: old, error } = await supabaseClient.rpc('tdc_set_venue_picture', {
				p_venue_id: venue.id, p_path: path
			});
			if (error) {
				// Not named on the venue, so the file just uploaded is an orphan.
				await supabaseClient.storage.from(BUCKET).remove([path]);
				TDC.showSupabaseError(AREA, error, els.picStatus);
				return;
			}

			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(BUCKET).remove([old]);
				// The new picture is already the venue's; the old file only takes up room.
				if (delErr) console.error('[' + AREA + '] could not delete the old picture', delErr);
			}
			await reload();
			TDC.status(els.picStatus, 'Picture saved.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the picture.', err, els.picStatus);
		} finally {
			pictureBusy(false);
		}
	})(), els.picStatus));

	els.picRemove.addEventListener('click', () => TDC.busy(els.picRemove, (async () => {
		if (!venue || !venue.picture_path) return;
		if (!confirm('Remove the venue’s picture?\n\nIts page shows the pin again.')) return;

		pictureBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			// Cleared on the venue first: if the file delete fails, the picture
			// is already gone from the page.
			const { data: old, error } = await supabaseClient.rpc('tdc_set_venue_picture', {
				p_venue_id: venue.id, p_path: null
			});
			if (error) { TDC.showSupabaseError(AREA, error, els.picStatus); return; }
			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(BUCKET).remove([old]);
				if (delErr) console.error('[' + AREA + '] could not delete the picture file', delErr);
			}
			await reload();
			TDC.status(els.picStatus, 'Picture removed.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem removing the picture.', err, els.picStatus);
		} finally {
			pictureBusy(false);
		}
	})(), els.picStatus));

	return { fill };
})();
