// Manage › Next tournament (UV, 25 Nov; migration 20261125130921;
// _includes/tournament/next.html): the next one of a recurring tournament.
// tdc_next_tournament copies every setting, each round's own rules, the
// venues, everybody who runs it and the poster, with nobody entered; the
// name is this one's unless changed, and the start is typed (UV: blank, not
// a week on). The picture must live in its own tournament's folder, so it is
// copied here as a new file after the tournament exists and set with
// tdc_set_tournament_picture. Then to the new tournament's Entrants, as the
// create page goes.
//
// Whoever runs it only (tdc_may_run_tournament, as every Manage page);
// anybody else is shown the Draw.
//
// Needs: tdc.js, tournament-nav.js.

TDCTournamentNav.panel('next', () => {
	const AREA = 'Next tournament';
	const PICTURE_BUCKET = 'tournament-pictures';
	const tournamentId = new URLSearchParams(location.search).get('t');
	const el = (id) => document.getElementById(id);
	const els = {
		meta: el('tn-meta'), off: el('tn-off'), form: el('tn-form'),
		name: el('tn-name'), when: el('tn-when'), carried: el('tn-carried'),
		create: el('tn-create'), status: el('tn-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the next tournament page is missing expected elements: ' + missing.join(', '));
		return;
	}

	let mayRun = false;
	let from = null;   // this tournament, as last read
	let made = false;  // once made, the button stays off: pressing again would make another

	// What tdc_next_tournament carries, said once, here.
	const CARRIED = [
		'Format, match rules and each round’s own rules',
		'Moving between rounds, starting matches and the third-place playoff',
		'Maximum entrants, entry fee, how people enter, Paid also confirms and Visible to public',
		'The venues, the picture and the poster’s settings',
		'Everybody who runs it, and you as a director'
	];

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

	async function load() {
		const { data, error } = await supabaseClient
			.from('tbl_tournaments').select('id, name, is_recurring, picture_path')
			.eq('id', tournamentId).maybeSingle();
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (!data) { TDC.error(AREA, 'no tournament with that id. Check the link.', { tournamentId }, els.status); return; }
		from = data;
		els.meta.textContent = 'The next ' + from.name + '.';
		els.off.hidden = from.is_recurring;
		els.form.hidden = !from.is_recurring;
		if (!els.name.value) els.name.value = from.name;
		els.carried.replaceChildren(...CARRIED.map((text) => {
			const li = document.createElement('li');
			li.textContent = text;
			return li;
		}));
		els.create.disabled = made || !from.is_recurring;
	}

	// The picture, as a new file in the new tournament's folder. A failure
	// here leaves a tournament that is made, so it says so and goes on.
	async function copyPicture(newId) {
		if (!from.picture_path) return true;
		const ext = (from.picture_path.split('.').pop() || 'webp').toLowerCase();
		const path = `${newId}/${crypto.randomUUID()}.${ext}`;
		const { error: cpErr } = await supabaseClient.storage.from(PICTURE_BUCKET).copy(from.picture_path, path);
		if (cpErr) { TDC.showSupabaseError(AREA, cpErr, els.status); return false; }
		const { error } = await supabaseClient.rpc('tdc_set_tournament_picture', { p_tournament_id: newId, p_path: path });
		if (error) {
			await supabaseClient.storage.from(PICTURE_BUCKET).remove([path]);
			TDC.showSupabaseError(AREA, error, els.status);
			return false;
		}
		return true;
	}

	els.create.addEventListener('click', () => TDC.busy(els.create, (async () => {
		const name = (els.name.value || '').trim();
		if (name.length < 2) {
			TDC.status(els.status, 'Give the tournament a name first.', '');
			els.name.focus();
			return;
		}
		const startsAt = whenValue();
		if (startsAt === undefined) return;

		els.create.disabled = true;
		TDC.status(els.status, '', '');
		const { data: newId, error } = await supabaseClient.rpc('tdc_next_tournament', {
			p_from_id: tournamentId, p_starts_at: startsAt, p_name: name
		});
		if (error) {
			els.create.disabled = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return;
		}
		if (!newId) {
			els.create.disabled = false;
			TDC.error(AREA, 'the tournament was not created and no reason was given.', null, els.status);
			return;
		}
		made = true;

		const entrants = '/tournaments/bracket/?t=' + encodeURIComponent(newId) + '&tab=entrants';
		if (!await copyPicture(newId)) {
			const link = document.createElement('a');
			link.href = entrants;
			link.textContent = 'Open it.';
			els.status.append(' The tournament itself was made, without its picture: add it on its Details page. ', link);
			return;
		}
		// Straight to the entrant list: a tournament with nobody in it is not
		// finished being made (as the create page).
		location.href = entrants;
	})(), els.status));

	TDCLoader.hold((async () => {
		if (!await TDC.requireSession(AREA)) return;
		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.status);
			return;
		}
		const { data: may, error } = await supabaseClient.rpc('tdc_may_run_tournament', { p_tournament_id: tournamentId });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (!may) { TDCTournamentNav.open('draw'); return; }
		mayRun = true;
		await load();
	})(), AREA);

	// Shown again: read again (Recurring may have been switched on Details).
	return {
		refresh: () => {
			if (!mayRun) return;
			load().catch((err) => TDC.error(AREA, 'the page could not be read again.', err, els.status));
		}
	};
});
