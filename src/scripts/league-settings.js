// A league's settings: the Settings tab of its one page
// (/leagues/season/?s=<league season id>&tab=settings; league-nav.js).
//
// The league's name and its ruleset — including the Team play group, where
// team size and the rotation table live (version 3, 23 Oct). The rules belong
// to the league, so this edits every season of it at once. Also this season's
// name and dates (23 Oct), so everything set on the new-league page can be
// changed here.
//
// The ruleset is read from tbl_leagues, not from tdc_league_season_info: that
// one returns the league's rules with this season's overrides laid over them,
// and sending the merged copy back would bake one season's changes into the
// whole league.
//
// The season's status (24 Oct) is the league director's: taking entries,
// running, on break, finished (TDCMatchDef.LEAGUE_STATUS), saved with its
// own call between the two below, and only when it changed.
//
// Saving is two writes, the season first. tdc_update_league_season takes the
// season's name, and its dates only when they changed: the dates live on the
// season period, which another league can share, and a shared one is refused
// — so sending unchanged dates would stop such a league saving anything.
// Then tdc_update_league, which validates the ruleset against every
// season, writes it, and re-freezes it onto every match that has not started.
// It answers how many matches changed and how many kept their old rules, and
// the page says both: a director must not believe a match follows the new
// rules when it does not. Then everything is read again.
//
// The standings columns are a section of this tab with a script of their
// own (league-standings-edit.js), started once the page knows the person
// runs the league; each of its changes saves at once.
//
// Needs: tdc.js, match-settings.js, league-standings-edit.js.

TDCLeagueNav.panel('settings', () => {
	const AREA = 'League settings';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		title: el('l-title'), meta: el('st-meta'), name: el('st-name'),
		picPreview: el('pic-preview'), picChoose: el('pic-choose'), picRemove: el('pic-remove'),
		picFile: el('pic-file'), picStatus: el('pic-status'),
		seasonName: el('s-name'), seasonStatus: el('s-status'),
		start: el('s-start'), end: el('s-end'), reserves: el('s-reserves'),
		sizeRow: el('size-row'), reservesField: el('reserves-field'),
		overrides: el('overrides-note'),
		main: el('settings-main'), rest: el('settings-rest'),
		save: el('save-btn'), status: el('st-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the settings page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');

	// ─── State ───
	let leagueId = null;
	let rules = null;
	let savedDates = { start: '', end: '' };   // as last read, to send only a change
	let savedStatus = '';                      // likewise
	// Team play is what this page is mostly for, so it starts open.
	const openGroups = new Set(['Team play']);
	let busy = false;

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	els.seasonStatus.append(...Object.entries(D.LEAGUE_STATUS).map(([value, text]) => {
		const o = node('option', null, text);
		o.value = value;
		return o;
	}));

	// A league made before 23 Oct is at version 1 or 2. Every key added since
	// defaults to how the system already behaved — no cutoff, any order, no
	// sessions — so filling them in and calling it version 3 changes nothing
	// about how its matches play until the director changes a setting.
	function upgrade(stored) {
		return Object.assign({}, D.DEFAULT_RULES, stored, { version: D.DEFAULT_RULES.version });
	}

	// ─── Ruleset ───
	// The same as the new-league page, which predates TDCMatchDef.control
	// handling the reading back. Kept in step with it.
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
		const control = (d) => D.control(d, rules, 'ls');

		const main = live.filter((d) => D.MAIN_KEYS.includes(d.key));
		els.main.replaceChildren(
			node('h2', null, 'How are these matches played?'),
			...D.layout(main, control)
		);

		// The team size sits up with the season's reserves (UV, 24 Oct),
		// not in Team play.
		const size = live.find((d) => d.key === 'team_size');
		els.sizeRow.replaceChildren(...(size ? [control(size)] : []), els.reservesField);

		els.rest.replaceChildren();
		for (const group of D.GROUPS.concat(D.LEAGUE_GROUPS)) {
			const defs = live.filter((d) => d.group === group && !D.MAIN_KEYS.includes(d.key) && d.key !== 'team_size');
			if (!defs.length) continue;

			const box = document.createElement('details');
			box.className = 'set-group';
			box.dataset.group = group;
			// Rebuilt on every change, so an opened group has to be put back open.
			box.open = openGroups.has(group);
			box.addEventListener('toggle', () => {
				if (box.open) openGroups.add(group); else openGroups.delete(group);
			});

			const head = document.createElement('summary');
			head.textContent = group;
			box.append(head, ...D.layout(defs, control, { league: true }));
			els.rest.append(box);
		}
	}

	document.addEventListener('change', (e) => {
		const input = e.target.closest('[data-setting]');
		if (!input || !rules) return;
		const def = D.SETTINGS.find((d) => d.key === input.dataset.setting);
		if (!def) { TDC.error(AREA, 'no definition for setting: ' + input.dataset.setting); return; }

		if (def.type === 'rotation') D.applyRotation(rules, input);
		else if (!setValue(def, def.type === 'bool' ? input.checked : input.value)) return;
		D.tidyRules(rules);

		const id = input.id;
		renderSettings();
		const again = document.getElementById(id);
		if (again) again.focus({ preventScroll: true });
	});

	// ─── The league's picture ───
	// As a profile picture is (profile.js): prepared in the browser (square,
	// 512px, re-encoded, EXIF gone), uploaded under a new random name into the
	// league's folder of league-pictures, then named on the league through
	// tdc_set_league_picture, which hands back the old one to delete. Saved
	// at once, not with the Save button.
	const PICTURE_BUCKET = 'league-pictures';
	let picturePath = null;

	function trophy() {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = document.createElementNS(NS, 'path');
		path.setAttribute('fill', 'currentColor');
		path.setAttribute('d', 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z');
		svg.append(path);
		return svg;
	}

	function showPicture() {
		const url = TDC.pictureUrl(PICTURE_BUCKET, picturePath);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = 'The league\u2019s picture';
			els.picPreview.replaceChildren(img);
		} else {
			els.picPreview.replaceChildren(trophy());
		}
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
		if (!file || !leagueId) return;

		pictureBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			const blob = await TDC.preparePicture(file, 512, AREA, els.picStatus);
			if (!blob) return;

			// A new name every time, so no cached copy of the old picture is
			// served in its place.
			const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
			const path = `${leagueId}/${crypto.randomUUID()}.${ext}`;

			const { error: upErr } = await supabaseClient.storage
				.from(PICTURE_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
			if (upErr) { TDC.showSupabaseError(AREA, upErr, els.picStatus); return; }

			const { data: old, error } = await supabaseClient.rpc('tdc_set_league_picture', {
				p_league_id: leagueId, p_path: path
			});
			if (error) {
				// Not named on the league, so the file just uploaded is an orphan.
				await supabaseClient.storage.from(PICTURE_BUCKET).remove([path]);
				TDC.showSupabaseError(AREA, error, els.picStatus);
				return;
			}

			picturePath = path;
			showPicture();
			TDC.status(els.picStatus, 'Picture saved.', 'success');
			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(PICTURE_BUCKET).remove([old]);
				// The new picture is already the league's; the old file only takes up room.
				if (delErr) console.error('[' + AREA + '] could not delete the old picture', delErr);
			}
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving the picture.', err, els.picStatus);
		} finally {
			pictureBusy(false);
		}
	})(), els.picStatus));

	els.picRemove.addEventListener('click', () => TDC.busy(els.picRemove, (async () => {
		if (!picturePath || !leagueId) return;
		if (!confirm('Remove the league\u2019s picture?\n\nIts pages show the trophy again.')) return;

		pictureBusy(true);
		TDC.status(els.picStatus, '', '');
		try {
			// Cleared on the league first: if the file delete fails, the picture
			// is already gone from every page.
			const { data: old, error } = await supabaseClient.rpc('tdc_set_league_picture', {
				p_league_id: leagueId, p_path: null
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

	// ─── Reading ───
	async function load() {
		const info = await supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId });
		if (info.error) { TDC.showSupabaseError(AREA, info.error, els.status); return false; }
		const s = (info.data || [])[0];
		if (!s) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}
		leagueId = s.league_id;
		els.meta.textContent = 'Opened from ' + s.name + '. These rules apply to every season of the league.';

		els.seasonName.value = s.name || '';
		savedDates = { start: s.starts_on || '', end: s.ends_on || '' };
		els.start.value = savedDates.start;
		els.end.value = savedDates.end;

		// Not in tdc_league_season_info; the season row is readable directly.
		const row = await supabaseClient
			.from('tbl_league_seasons').select('max_reserves, status').eq('id', seasonId).maybeSingle();
		if (row.error) { TDC.showSupabaseError(AREA, row.error, els.status); return false; }
		if (!row.data) {
			TDC.error(AREA, 'the season\'s reserves and status could not be read.', { seasonId }, els.status);
			return false;
		}
		els.reserves.value = row.data.max_reserves;
		if (!D.LEAGUE_STATUS[row.data.status]) {
			TDC.error(AREA, 'this season has a status the page does not know: ' + row.data.status, { seasonId }, els.status);
			return false;
		}
		savedStatus = row.data.status;
		els.seasonStatus.value = savedStatus;

		// A season's own changes still apply on top. There is no form for
		// them yet, so the director is at least told they exist.
		const own = Object.keys(s.rules_overrides || {});
		els.overrides.hidden = !own.length;
		els.overrides.textContent = own.length
			? `${s.name} changes ${own.length === 1 ? 'one rule' : own.length + ' rules'} on top of these (${own.join(', ')}), and those still apply to it.`
			: '';

		const league = await supabaseClient
			.from('tbl_leagues').select('name, rules, picture_path').eq('id', leagueId).maybeSingle();
		if (league.error) { TDC.showSupabaseError(AREA, league.error, els.status); return false; }
		if (!league.data) {
			TDC.error(AREA, 'the league for this season could not be read.', { leagueId }, els.status);
			return false;
		}

		els.title.textContent = league.data.name + ' — Settings';
		els.name.value = league.data.name;
		picturePath = league.data.picture_path;
		showPicture();
		rules = upgrade(league.data.rules);
		D.tidyRules(rules);
		renderSettings();
		return true;
	}

	// ─── Saving ───
	function savedText(r) {
		const n = (k, one, many) => (k === 1 ? one : k + ' ' + many);
		const parts = ['Saved.'];
		if (r && r.matches_updated) {
			parts.push(n(r.matches_updated, 'One match', 'matches') + ' not yet started now ' +
				(r.matches_updated === 1 ? 'uses' : 'use') + ' these rules.');
		}
		if (r && r.matches_kept) {
			parts.push(n(r.matches_kept, 'One match has', 'matches have') +
				' already begun — a lineup locked, a frame recorded or a signature — and ' +
				(r.matches_kept === 1 ? 'keeps' : 'keep') + ' the rules ' +
				(r.matches_kept === 1 ? 'it' : 'they') + ' started with.');
		}
		return parts.join(' ');
	}

	els.save.addEventListener('click', () => TDC.busy(els.save, (async () => {
		if (busy || !rules) return;

		const name = (els.name.value || '').trim();
		if (name.length < 2) {
			TDC.status(els.status, 'The league needs a name of two characters or more.', '');
			els.name.focus();
			return;
		}

		const seasonName = (els.seasonName.value || '').trim();
		if (seasonName.length < 2) {
			TDC.status(els.status, 'The season needs a name of two characters or more.', '');
			els.seasonName.focus();
			return;
		}

		const start = els.start.value || '';
		const end = els.end.value || '';
		if (start && end && end < start) {
			TDC.status(els.status, 'The season cannot end before it starts.', '');
			els.end.focus();
			return;
		}
		const datesChanged = start !== savedDates.start || end !== savedDates.end;

		const reserves = Number(els.reserves.value);
		if (els.reserves.value === '' || !Number.isInteger(reserves) || reserves < 0 || reserves > 10) {
			TDC.status(els.status, 'Reserves allowed must be a number from 0 to 10.', '');
			els.reserves.focus();
			return;
		}

		// Allowed, but said once more at the moment it matters (UV, 23 Oct).
		if (rules.team_size >= 2) {
			const repeats = D.rotationRepeats(D.rotationGrid(rules));
			if (repeats.length && !confirm(
				`The rotation table has ${repeats.length === 1 ? 'a pairing' : repeats.length + ' pairings'} meeting twice in a night. Save it anyway?`)) {
				return;
			}
		}

		busy = true;
		els.save.disabled = true;
		TDC.status(els.status, '', '');

		// The season first. A refusal here has written nothing at all, so the
		// form keeps what the person chose.
		const seasonArgs = { p_league_season_id: seasonId, p_name: seasonName, p_max_reserves: reserves };
		if (datesChanged) {
			// "Exactly these": a blank box clears that one date.
			Object.assign(seasonArgs, { p_starts_on: start || null, p_ends_on: end || null, p_clear_dates: true });
		}
		const season = await supabaseClient.rpc('tdc_update_league_season', seasonArgs);
		if (season.error) {
			busy = false;
			els.save.disabled = false;
			TDC.showSupabaseError(AREA, season.error, els.status);
			return;
		}

		// The status is its own call (tdc_set_league_season_status), sent only
		// when it changed. A refusal here leaves the season's other changes in.
		if (els.seasonStatus.value !== savedStatus) {
			const st = await supabaseClient.rpc('tdc_set_league_season_status', {
				p_league_season_id: seasonId, p_status: els.seasonStatus.value
			});
			if (st.error) {
				busy = false;
				els.save.disabled = false;
				TDC.showSupabaseError(AREA, st.error, els.status);
				els.status.textContent += ' The season\'s name, dates and reserves were saved; its status and the league\'s name and rules were not.';
				return;
			}
		}

		const { data, error } = await supabaseClient.rpc('tdc_update_league', {
			p_league_id: leagueId,
			p_name: name,
			p_rules: rules
		});

		// A refusal wrote nothing, so the form keeps what the person chose for
		// them to correct — re-reading would throw a dozen changes away over
		// one bad setting. A save is followed by a full re-read.
		if (error) {
			busy = false;
			els.save.disabled = false;
			TDC.showSupabaseError(AREA, error, els.status);
			// Said, because half of it did land.
			els.status.textContent += ' The season\'s name, dates, reserves and status were saved; the league\'s name and rules were not.';
			return;
		}

		const ok = await load();
		busy = false;
		els.save.disabled = false;
		if (ok) TDC.status(els.status, savedText(data), 'success');
	})(), els.status));

	// ─── Start ───
	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the league.', null, els.status);
			return;
		}

		// Settled before anything is drawn. tdc_update_league asks whether the
		// caller may manage the league, which a season's director always may.
		const { data: mayRun, error } = await supabaseClient.rpc('tdc_may_run_league', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (!mayRun) {
			TDC.status(els.status, 'Taking you to the season — this page is for whoever is running the league.', '');
			location.replace('/leagues/season/?s=' + encodeURIComponent(seasonId));
			return;
		}

		if (!await load()) return;
		els.save.disabled = false;

		// The standings columns (29 Oct), saved on their own, not with Save.
		await TDCStandingsEdit.start(seasonId);
	})(), 'League settings');
});
