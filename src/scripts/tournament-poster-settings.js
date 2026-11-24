// A tournament's Poster settings page (UV, 24 Nov): the Manage menu's page
// for everything about the poster, for whoever runs the tournament (the
// people tdc_may_run_tournament says, as every Manage page). The poster panel
// moved here unchanged from the Entrants tab (tournament-manage.js) and the
// text for a poster designer from the poster page (tournament-poster.js); its
// words are written by poster-words.js, which the poster draws with too. The
// Entrants tab keeps its link to share and says there whether it opens
// anything yet. Visible to public and the tournament picture stay on Settings
// (UV, 24 Nov: they are the tournament's, not the poster's).
//
// Needs: tdc.js, tournament-nav.js, match-settings.js, poster-words.js.

TDCTournamentNav.panel('poster-settings', () => {
	const AREA = 'Poster settings';

	const el = (id) => document.getElementById(id);
	const els = {
		posterState: el('poster-state'),
		posterBuild: el('poster-build'), posterShare: el('poster-share'),
		posterUnshare: el('poster-unshare'), posterOpen: el('poster-open'),
		posterStatus: el('poster-status'),
		textBox: el('pt-text-box'), text: el('pt-text'), copy: el('pt-copy'), textStatus: el('pt-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the poster settings page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const tournamentId = new URLSearchParams(location.search).get('t');
	let mayRun = false;

	const posterUrl = () => location.origin
		+ '/tournaments/poster/?t=' + encodeURIComponent(tournamentId);


	// ─────────────────────────────────────────────────────────────────
	// The poster
	//
	// Generating and sharing are separate, so a TD can build a poster to read
	// the text out of it without making anything public. Nothing about a
	// tournament is readable outside the app until "Share it" is pressed.
	// ─────────────────────────────────────────────────────────────────

	async function loadPoster() {
		const { data, error } = await supabaseClient.rpc('tdc_tournament_poster', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.posterStatus); return; }

		// The TD sees their own unshared poster, so a row here means one
		// exists — shared or not.
		const row = (data || [])[0];
		renderPoster(row);
	}

	function renderPoster(row) {
		els.posterOpen.href = posterUrl();

		if (!row) {
			els.posterState.textContent =
				'No poster yet. Generate one to get the text for a designer, or to share the tournament.';
			els.posterBuild.hidden = false;
			els.posterShare.hidden = true;
			els.posterUnshare.hidden = true;
			els.posterOpen.hidden = true;
			// The text is written from a poster, so none until there is one.
			els.textBox.hidden = true;
			return;
		}

		// Live (UV, 24 Nov): no date it was made, no Regenerate.
		els.posterState.textContent = row.is_public
			? 'Shared. Anyone with the link can see this poster. It is always up to date.'
			: 'Not shared — only you can open it. It is always up to date.';

		const snap = row.snapshot || {};
		els.posterBuild.hidden = true;
		els.posterShare.hidden = row.is_public;
		els.posterUnshare.hidden = !row.is_public;
		els.posterOpen.hidden = false;

		// The text for a poster designer, from the same live read.
		els.text.value = TDCPosterWords.posterText(snap);
		els.textBox.hidden = false;
	}

	const posterWriter = TDC.writer({
		area: AREA, status: els.posterStatus,
		// Stopping sharing turns Visible to public off; the Settings tab
		// reads it again when it is shown.
		reload: async () => {
			await loadPoster();
			return true;
		}
	});
	function poster(what, args) {
		return posterWriter.write(what, () => supabaseClient.rpc(args.fn,
			Object.assign({ p_tournament_id: tournamentId }, args.params || {})),
		() => args.done || '');
	}

	// The poster always shows everything now (UV, 24 Nov: "All"); the stored
	// choices are kept true so nothing reading them says otherwise.
	els.posterBuild.addEventListener('click', () => poster('Generating', {
		fn: 'tdc_publish_poster',
		params: { p_include_entrants: true, p_include_draw: true },
		done: 'Poster made.'
	}));

	els.posterShare.addEventListener('click', () => poster('Sharing', {
		fn: 'tdc_publish_poster',
		params: { p_include_entrants: true, p_include_draw: true, p_public: true },
		done: 'Shared. Anyone with the link can see it now.'
	}));

	els.posterUnshare.addEventListener('click', () => {
		if (!confirm('Stop sharing this poster?\n\nThe link will show nothing to anybody but you. The poster itself is kept.')) return;
		poster('Stopping', { fn: 'tdc_unpublish_poster', done: 'No longer shared.' });
	});

	els.copy.addEventListener('click', async () => {
		// navigator.clipboard needs a secure context and a permission that can
		// be refused, so the failure is said out loud — the text is on screen
		// and selectable either way.
		try {
			await navigator.clipboard.writeText(els.text.value);
			TDC.status(els.textStatus, 'Copied.', '');
		} catch (e) {
			console.error('[Poster settings] could not write to the clipboard', e);
			els.text.select();
			TDC.status(els.textStatus, 'Could not copy automatically — the text is selected, so copy it yourself.', '');
		}
	});

	// ─── Start ───
	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.posterStatus);
			return;
		}
		// Settled before anything is drawn, as on Settings: the same private
		// helper the writes ask. Anybody else is shown the Draw.
		const { data: may, error } = await supabaseClient.rpc('tdc_may_run_tournament', { p_tournament_id: tournamentId });
		if (error) { TDC.showSupabaseError(AREA, error, els.posterStatus); return; }
		if (!may) { TDCTournamentNav.open('draw'); return; }
		mayRun = true;
		await loadPoster();
	})(), 'Poster settings');

	// Shown again as a tab: read again in place.
	return {
		refresh: () => {
			if (!mayRun) return;
			loadPoster().catch((err) => TDC.error(AREA, 'the poster could not be read again.', err, els.posterStatus));
		}
	};
});
