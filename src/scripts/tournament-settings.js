// The Settings tab of a tournament's one page (UV, 5 Nov; tournament-nav.js,
// _includes/tournament/settings.html): every setting offered when the
// tournament was created (tournament-new.js), changeable afterwards, as a
// league's are (league-settings.js). Also the third-place playoff, which was
// on the Draw tab, and who may enter, Paid also confirms and Visible to
// public, which were on Entrants: each setting in one place (UV).
//
// One Save for the lot, through tdc_update_tournament, the one function that
// changes a tournament. The ruleset is sent only when it changed; then every
// match nobody has started (no frame, no card event) takes it, a round with
// its own rules keeping them (20261105130239), and the page says how many
// took it and how many kept their own. The format and the third-place
// playoff are fixed once there is a draw (the database refuses both), so
// they are locked then, with the reason. After the save the tab reads the
// tournament again rather than trusting the form.
//
// The ruleset form is TDCMatchDef's, as on the create page; its changes are
// listened for on this tab only, since the Draw tab's round panel builds the
// same controls.
//
// The venues it is played at (venue-picker.js) are saved after that, with their
// own call and only when they changed.
//
// Needs: tdc.js, match-settings.js, tournament-nav.js, venue-picker.js,
// short-code-field.js.

TDCTournamentNav.panel('settings', () => {
	const AREA = 'Tournament settings';
	const D = TDCMatchDef;

	// As the create page has them (tournament-new.js).
	const FORMAT = {
		single_elimination: 'Single elimination',
		double_elimination: 'Double elimination',
		round_robin: 'Round robin',
		groups_knockout: 'Groups then knockout'
	};
	const FORMAT_HINT = {
		single_elimination: 'Lose once and you are out. The club-night default.',
		double_elimination: 'Two lives each. Takes about half as long again.',
		round_robin: 'Everybody plays everybody. Best for small fields.',
		groups_knockout: 'Groups first, then a knockout between whoever comes through.'
	};
	const ENTRY_HINT = {
		td_only: 'Nobody can put themselves down. You search for them and add them on the Entrants tab.',
		interested: 'Players can mark themselves interested. You confirm them, on whatever basis you use.',
		self_confirm: 'Players can confirm their own entry. Right for a free tournament, or one paid for at the desk.'
	};

	const el = (id) => document.getElementById(id);
	const els = {
		root: document.querySelector('.tournament-panel[data-tab="settings"]'),
		head: el('ts-head'), meta: el('ts-meta'),
		name: el('ts-name'), format: el('ts-format'), formatHint: el('ts-format-hint'),
		when: el('ts-when'), venues: el('ts-venues'), max: el('ts-max'), fee: el('ts-fee'),
		progression: el('ts-progression'), createMatches: el('ts-create-matches'),
		createMatchesHint: el('ts-create-matches-hint'),
		thirdPlace: el('ts-third-place'), thirdPlaceHint: el('ts-third-place-hint'),
		entryMode: el('ts-entry-mode'), entryModeHint: el('ts-entry-mode-hint'),
		paidConfirms: el('ts-paid-confirms'), listed: el('ts-listed'), listedHint: el('ts-listed-hint'),
		main: el('ts-main'), rest: el('ts-rest'),
		shortCode: el('ts-short-code'),
		picPreview: el('ts-pic-preview'), picChoose: el('ts-pic-choose'), picRemove: el('ts-pic-remove'),
		picFile: el('ts-pic-file'), picStatus: el('ts-pic-status'),
		recurring: el('ts-recurring'), recurringStatus: el('ts-recurring-status'),
		save: el('ts-save'), status: el('ts-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the settings tab is missing expected elements: ' + missing.join(', '));
		return;
	}

	const tournamentId = new URLSearchParams(location.search).get('t');

	// ─── State ───
	let saved = null;      // the tournament as last read
	let drawn = false;     // whether it has a draw (format and third place fixed)
	let rules = null;      // the ruleset being edited
	let rulesWas = '';     // as read, to send it only when it changed
	let mayRun = false;
	const openGroups = new Set();
	const venues = TDCVenuePicker.create(els.venues, AREA, els.status);
	const shortCode = TDCShortCode.create(els.shortCode, AREA, 'tournament', tournamentId);

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	for (const [v, text] of Object.entries(FORMAT)) els.format.append(new Option(text, v));

	// A tournament made before a ruleset key existed is at an older version;
	// every key added since defaults to how the system already behaved, as
	// for a league (league-settings.js, upgrade).
	const upgrade = (stored) => Object.assign({}, D.DEFAULT_RULES, stored, { version: D.DEFAULT_RULES.version });

	// ─── The hints, from what the form says now ───
	function hints() {
		els.formatHint.textContent = drawn
			? 'Fixed now there is a draw. Clear the draw to change it.'
			: (FORMAT_HINT[els.format.value] || '');
		els.entryModeHint.textContent = ENTRY_HINT[els.entryMode.value] || '';
		els.createMatchesHint.textContent = els.createMatches.value === 'manual'
			// The thing UV hit: a player could not score because no match
			// existed, and nothing on the page said so.
			? 'Nobody can score a match until you press Start match on it.'
			: 'A match starts on its own once both players are known.';
		els.thirdPlaceHint.textContent = drawn
			? 'Fixed with the draw. Redraw on Generate the draw keeps it as it is.'
			: 'Generated with the draw, so decide before you make it.';
		// Visible to public, as it stands saved: listed only while players
		// can enter themselves (tdc_open_tournaments).
		const on = saved && saved.is_listed;
		els.listedHint.textContent = !on
			? 'Signed-in players can find it under Open for entry on Tournaments, while they can enter themselves. Turning it on shares the poster.'
			: saved.entry_mode === 'td_only'
				? 'On, but players will not see it while you add everybody yourself.'
				: 'Players can find it under Open for entry on Tournaments until the draw is made. Stopping sharing the poster turns this off.';
	}

	// A knockout needs somebody to advance, so draws are turned off in one,
	// as on the create page.
	function applyFormatToRules() {
		if (!rules) return;
		if (els.format.value !== 'round_robin' && rules.draws_allowed) {
			rules.draws_allowed = false;
			TDC.status(els.status, 'Draws turned off: a knockout needs somebody to advance.', '');
			renderSettings();
		}
	}

	els.format.addEventListener('change', () => { hints(); applyFormatToRules(); });
	els.entryMode.addEventListener('change', hints);
	els.createMatches.addEventListener('change', hints);

	// ─── The ruleset ───
	function setValue(def, raw) {
		let v = raw;
		if (def.type === 'bool') v = !!raw;
		if (def.type === 'int') {
			v = parseInt(raw, 10);
			if (isNaN(v)) { TDC.error(AREA, `"${def.label}" needs a number.`, raw, els.status); return false; }
			if (def.min !== undefined) v = Math.max(def.min, v);
			if (def.max !== undefined) v = Math.min(def.max, v);
		}
		rules[def.key] = v;
		return true;
	}

	function renderSettings() {
		const live = D.liveRuleKeys(rules);
		const control = (d) => D.control(d, rules, 'ts');

		const main = live.filter((d) => D.MAIN_KEYS.includes(d.key));
		els.main.replaceChildren(
			node('h2', null, 'How will these matches be played?'),
			...D.layout(main, control)
		);

		els.rest.replaceChildren();
		for (const group of D.GROUPS) {
			const defs = live.filter((d) => d.group === group && !D.MAIN_KEYS.includes(d.key));
			if (!defs.length) continue;
			const box = document.createElement('details');
			box.className = 'set-group';
			box.dataset.group = 'ts-' + group;
			// Rebuilt on every change, so an opened group is put back open.
			box.open = openGroups.has(group);
			box.addEventListener('toggle', () => {
				if (box.open) openGroups.add(group); else openGroups.delete(group);
			});
			const head = document.createElement('summary');
			head.textContent = group;
			box.append(head, ...D.layout(defs, control));
			els.rest.append(box);
		}
	}

	// This tab's ruleset only: the Draw tab's round panel builds the same
	// controls (data-setting) and listens for its own.
	els.root.addEventListener('change', (e) => {
		const input = e.target.closest('[data-setting]');
		if (!input || !rules) return;
		if (!els.main.contains(input) && !els.rest.contains(input)) return;
		const def = D.SETTINGS.find((d) => d.key === input.dataset.setting);
		if (!def) { TDC.error(AREA, 'no definition for setting: ' + input.dataset.setting); return; }
		if (!setValue(def, def.type === 'bool' ? input.checked : input.value)) return;
		D.tidyRules(rules);

		// Turning one on can reveal others, so the form is rebuilt, and focus
		// put back.
		const id = input.id;
		renderSettings();
		applyFormatToRules();
		const again = document.getElementById(id);
		if (again) again.focus({ preventScroll: true });
	});

	// ─── Reading ───
	// A datetime-local field is local time with no zone (tournament-new.js).
	function toLocalField(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable start date: ' + iso, null, els.status); return ''; }
		const p = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
	}

	// ─── The tournament's picture ───
	// As a league's is (league-settings.js; UV, 24 Nov: "same as leagues"):
	// prepared in the browser (square, 512px, re-encoded, EXIF gone), uploaded
	// under a new random name into the tournament's folder of
	// tournament-pictures, then named on the tournament through
	// tdc_set_tournament_picture, which hands back the old one to delete.
	// Saved at once, not with the Save button.
	const PICTURE_BUCKET = 'tournament-pictures';
	let picturePath = null;

	function showPicture() {
		els.picPreview.replaceChildren(TDC.tournamentPic(picturePath, 'The tournament’s picture'));
		els.picRemove.hidden = !picturePath;
		els.picChoose.textContent = picturePath ? 'Change the picture' : 'Choose a picture';
	}

	function pictureBusy(on) {
		els.picChoose.disabled = on;
		els.picRemove.disabled = on;
	}

	els.picChoose.addEventListener('click', () => els.picFile.click());

	// The dots show the work on the button used, from the picture's
	// preparation to the save (UV, 29 Oct: never a loading message).
	els.picFile.addEventListener('change', () => TDC.busy(els.picChoose, (async () => {
		const file = els.picFile.files && els.picFile.files[0];
		els.picFile.value = '';
		if (!file || !tournamentId) return;

		pictureBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			const blob = await TDC.preparePicture(file, 512, AREA, els.picStatus);
			if (!blob) return;

			// A new name every time, so no cached copy of the old picture is
			// served in its place.
			const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
			const path = `${tournamentId}/${crypto.randomUUID()}.${ext}`;

			const { error: upErr } = await supabaseClient.storage
				.from(PICTURE_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
			if (upErr) { TDC.showSupabaseError(AREA, upErr, els.picStatus); return; }

			const { data: old, error } = await supabaseClient.rpc('tdc_set_tournament_picture', {
				p_tournament_id: tournamentId, p_path: path
			});
			if (error) {
				// Not named on the tournament, so the file just uploaded is an orphan.
				await supabaseClient.storage.from(PICTURE_BUCKET).remove([path]);
				TDC.showSupabaseError(AREA, error, els.picStatus);
				return;
			}

			picturePath = path;
			showPicture();
			TDC.status(els.picStatus, 'Picture saved.', 'success');
			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(PICTURE_BUCKET).remove([old]);
				// The new picture is already the tournament's; the old file only takes up room.
				if (delErr) console.error('[' + AREA + '] could not delete the old picture', delErr);
			}
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the picture.', err, els.picStatus);
		} finally {
			pictureBusy(false);
		}
	})(), els.picStatus));

	els.picRemove.addEventListener('click', () => TDC.busy(els.picRemove, (async () => {
		if (!picturePath || !tournamentId) return;
		if (!confirm('Remove the tournament’s picture?\n\nThe poster shows the trophy again.')) return;

		pictureBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			// Cleared on the tournament first: if the file delete fails, the
			// picture is already gone from the poster.
			const { data: old, error } = await supabaseClient.rpc('tdc_set_tournament_picture', {
				p_tournament_id: tournamentId, p_path: null
			});
			if (error) { TDC.showSupabaseError(AREA, error, els.picStatus); return; }

			picturePath = null;
			showPicture();
			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(PICTURE_BUCKET).remove([old]);
				if (delErr) console.error('[' + AREA + '] could not delete the picture file', delErr);
			}
			TDC.status(els.picStatus, 'Picture removed.', 'success');
		} catch (err) {
			TDC.error(AREA, 'unexpected problem removing the picture.', err, els.picStatus);
		} finally {
			pictureBusy(false);
		}
	})(), els.picStatus));

	// ─── Recurring (UV, 25 Nov) ───
	// Saved the moment it is ticked, as the picture is, so the one Save is
	// untouched; then the bar is asked again, so History and Next tournament
	// come and go with it.
	els.recurring.addEventListener('change', () => TDC.busy(els.recurring, (async () => {
		const on = els.recurring.checked;
		els.recurring.disabled = true;
		TDC.status(els.recurringStatus, '', '');
		try {
			const { error } = await supabaseClient.rpc('tdc_set_tournament_recurring', {
				p_tournament_id: tournamentId, p_on: on
			});
			if (error) {
				els.recurring.checked = !on;
				TDC.showSupabaseError(AREA, error, els.recurringStatus);
				return;
			}
			const { data, error: readErr } = await supabaseClient
				.from('tbl_tournaments').select('is_recurring').eq('id', tournamentId).maybeSingle();
			if (readErr) { TDC.showSupabaseError(AREA, readErr, els.recurringStatus); return; }
			els.recurring.checked = !!(data && data.is_recurring);
			TDC.status(els.recurringStatus, els.recurring.checked
				? 'Recurring. Next tournament is under Manage, and History is in the bar.'
				: 'No longer recurring. Its earlier tournaments stay linked if you turn it on again.', 'success');
			await TDCTournamentNav.show(tournamentId);
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving Recurring.', err, els.recurringStatus);
		} finally {
			els.recurring.disabled = false;
		}
	})(), els.recurringStatus));

	async function load() {
		const [t, f, places] = await Promise.all([
			supabaseClient
				.from('tbl_tournaments')
				.select('id, name, format, starts_at, max_entrants, entry_fee_credits, progression, create_matches, third_place, entry_mode, paid_confirms, is_listed, rules, picture_path, is_recurring')
				.eq('id', tournamentId)
				.maybeSingle(),
			supabaseClient
				.from('tbl_tournament_fixtures')
				.select('id', { count: 'exact', head: true })
				.eq('tournament_id', tournamentId),
			supabaseClient.rpc('tdc_tournament_venue_list', { p_tournament_id: tournamentId })
		]);
		if (t.error) { TDC.showSupabaseError(AREA, t.error, els.status); return false; }
		if (f.error) { TDC.showSupabaseError(AREA, f.error, els.status); return false; }
		if (places.error) { TDC.showSupabaseError(AREA, places.error, els.status); return false; }
		if (!t.data) {
			TDC.error(AREA, 'no tournament with that id. Check the link.', { tournamentId }, els.status);
			return false;
		}

		saved = t.data;
		drawn = (f.count || 0) > 0;
		TDC.venueHeading(els.meta, saved.name, places.data);
		els.name.value = saved.name;
		els.format.value = saved.format;
		els.format.disabled = drawn;
		els.when.value = toLocalField(saved.starts_at);
		els.max.value = saved.max_entrants == null ? '' : saved.max_entrants;
		els.fee.value = saved.entry_fee_credits || 0;
		els.progression.value = saved.progression;
		els.createMatches.value = saved.create_matches;
		els.thirdPlace.checked = !!saved.third_place;
		els.thirdPlace.disabled = drawn;
		els.entryMode.value = saved.entry_mode;
		els.paidConfirms.checked = !!saved.paid_confirms;
		els.listed.checked = !!saved.is_listed;
		picturePath = saved.picture_path;
		showPicture();
		els.recurring.checked = !!saved.is_recurring;

		if (!await venues.load('tournament', tournamentId)) return false;

		rules = upgrade(saved.rules);
		rulesWas = JSON.stringify(rules);
		renderSettings();
		hints();
		return true;
	}

	// ─── Reading the fields ───
	function whenValue() {
		const raw = (els.when.value || '').trim();
		if (!raw) return null;
		const d = new Date(raw);
		if (isNaN(d.getTime())) {
			TDC.error(AREA, 'the date entered could not be read: ' + raw, null, els.status);
			return undefined;   // undefined: unreadable; null: not set
		}
		return d.toISOString();
	}

	// Blank is a real answer for both (no limit, free); a number that cannot
	// be read is not.
	function numberValue(input, label, { min, max, blank }) {
		const raw = String(input.value || '').trim();
		if (!raw) return blank;
		const n = parseInt(raw, 10);
		if (isNaN(n)) { TDC.status(els.status, `"${label}" needs to be a number.`, 'error'); return undefined; }
		if (min !== undefined && n < min) { TDC.status(els.status, `"${label}" cannot be less than ${min}.`, 'error'); return undefined; }
		if (max !== undefined && n > max) { TDC.status(els.status, `"${label}" cannot be more than ${max}.`, 'error'); return undefined; }
		return n;
	}

	// What the save did to the matches, as the league settings say it.
	function savedText(r) {
		const n = (k, one, many) => (k === 1 ? one : k + ' ' + many);
		const parts = ['Saved.'];
		if (r && r.matches_updated) {
			parts.push(n(r.matches_updated, 'One match', 'matches') + ' not yet started now ' +
				(r.matches_updated === 1 ? 'uses' : 'use') + ' these rules.');
		}
		if (r && r.matches_kept) {
			parts.push(n(r.matches_kept, 'One match has', 'matches have') +
				' already begun and ' + (r.matches_kept === 1 ? 'keeps' : 'keep') + ' the rules ' +
				(r.matches_kept === 1 ? 'it' : 'they') + ' started with.');
		}
		return parts.join(' ');
	}

	// ─── Saving ───
	els.save.addEventListener('click', () => TDC.busy(els.save, (async () => {
		if (!saved || !mayRun) return;

		const name = (els.name.value || '').trim();
		if (name.length < 2) {
			TDC.status(els.status, 'Give the tournament a name first.', '');
			els.name.focus();
			return;
		}
		const startsAt = whenValue();
		if (startsAt === undefined) return;
		const maxEntrants = numberValue(els.max, 'Maximum entrants', { min: 2, max: 1024, blank: null });
		if (maxEntrants === undefined) return;
		const fee = numberValue(els.fee, 'Entry fee', { min: 0, blank: 0 });
		if (fee === undefined) return;

		const rulesNow = JSON.stringify(rules);
		const args = {
			p_tournament_id: tournamentId,
			p_name: name,
			p_starts_at: startsAt,
			p_clear_starts_at: startsAt === null,
			p_max_entrants: maxEntrants,
			p_clear_max_entrants: maxEntrants === null,
			p_entry_fee_credits: fee,
			p_progression: els.progression.value,
			p_create_matches: els.createMatches.value,
			p_entry_mode: els.entryMode.value,
			p_paid_confirms: els.paidConfirms.checked,
			p_is_listed: els.listed.checked
		};
		// Only what changed for the two a draw fixes, so a save with a draw
		// never trips their refusal; the ruleset only when it changed, so the
		// matches are left alone otherwise.
		if (!drawn) {
			args.p_format = els.format.value;
			args.p_third_place = els.thirdPlace.checked;
		}
		if (rulesNow !== rulesWas) args.p_rules = rules;

		TDC.status(els.status, '', '');
		const { data, error } = await supabaseClient.rpc('tdc_update_tournament', args);
		if (error) { TDC.showSupabaseError(AREA, error, els.status); await load(); return; }
		// Where it is played is its own call, sent only when it changed. A
		// refusal here leaves the rest saved, and says so.
		const placed = venues.changed() ? await venues.save('tournament', tournamentId) : {};
		if (!await load()) return;
		if (placed.error) {
			TDC.showSupabaseError(AREA, placed.error, els.status);
			els.status.textContent += ' Everything else was saved; its venues were not.';
			return;
		}
		TDC.status(els.status, savedText(data), 'success');
	})(), els.status));

	// ─── Start ───
	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.status);
			return;
		}

		// Settled before anything is drawn, as on Entrants: the same private
		// helper the save asks.
		const { data: may, error } = await supabaseClient.rpc('tdc_may_run_tournament', { p_tournament_id: tournamentId });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (!may) { TDCTournamentNav.open('draw'); return; }
		mayRun = true;

		if (!await load()) return;
		await shortCode.load();
		els.save.disabled = false;
	})(), 'Settings');

	// Shown again as a tab: read again, unless a change is half made (the
	// form differs from what was read), which is kept, as the league's
	// settings tab keeps its own.
	return {
		refresh: () => {
			if (!mayRun || !saved) return;
			shortCode.load();
			if (JSON.stringify(rules) !== rulesWas || els.name.value.trim() !== saved.name || venues.changed()) return;
			load().catch((err) => TDC.error(AREA, 'the settings could not be read again.', err, els.status));
		}
	};
});
