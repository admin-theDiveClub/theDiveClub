// The draw (/tournaments/bracket/?t=<id>).
//
// Reads the whole bracket with tdc_tournament_draw — names, seeds, scores,
// card states and who won, in one call, because a bracket page that asked per
// fixture would make sixty-three requests for a sixty-four draw.
//
// tdc_resolve_draw is called on load and after every write. It is idempotent
// and it is what moves people up as results come in; calling it on load is why
// a TD who played three matches on somebody else's phone sees the bracket
// up to date when they open this one.
//
// Any signed-in player may read a draw. Only the people running it get the
// controls, and that is settled before the first render rather than after.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Draw';

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('t-name'), meta: el('t-meta'),
		setup: el('setup'), who: el('who'), whoHint: el('who-hint'),
		progression: el('progression'), createMatches: el('create-matches'),
		thirdPlace: el('third-place'), generate: el('generate'),
		bracket: el('bracket'), actions: el('draw-actions'),
		resolve: el('resolve'), redraw: el('redraw'),
		status: el('page-status'), entrantsLink: el('entrants-link')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the draw page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const tournamentId = new URLSearchParams(location.search).get('t');

	const FORMAT = {
		single_elimination: 'Single elimination',
		double_elimination: 'Double elimination',
		round_robin: 'Round robin',
		groups_knockout: 'Groups then knockout'
	};
	// What a card state means to somebody reading a bracket, which is not the
	// same as what it means on the match page.
	const CARD = {
		in_progress: { label: 'Playing', cls: 'live' },
		awaiting:    { label: 'Not agreed yet', cls: 'warn' },
		disputed:    { label: 'Disputed', cls: 'disputed' },
		agreed:      { label: '', cls: '' },
		approved:    { label: '', cls: '' }
	};
	const AWARD = {
		bye: 'Bye', walkover: 'Walkover', withdrawal: 'Withdrew', decision: 'Awarded'
	};

	// ─── State ───
	let tournament = null;
	let fixtures = [];
	let readOnly = true;
	let busy = false;

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── Naming the rounds ───
	// "Semi-final" beats "Round 3" for everybody except the person who wrote
	// the schema. Counted back from the last round of the main bracket.
	function roundName(round, lastRound) {
		const fromEnd = lastRound - round;
		if (fromEnd === 0) return 'Final';
		if (fromEnd === 1) return 'Semi-finals';
		if (fromEnd === 2) return 'Quarter-finals';
		return 'Round ' + round;
	}

	// ─── A side of a fixture ───
	function side(f, which) {
		const name = which === 'home' ? f.home_name : f.away_name;
		const seed = which === 'home' ? f.home_seed : f.away_seed;
		const id = which === 'home' ? f.home_entrant_id : f.away_entrant_id;
		const frames = which === 'home' ? f.home_frames : f.away_frames;
		const source = which === 'home' ? f.home_source : f.away_source;
		const feederRound = which === 'home' ? f.home_feeder_round : f.away_feeder_round;
		const feederPos = which === 'home' ? f.home_feeder_position : f.away_feeder_position;

		const row = node('div', 'bracket-side');
		if (f.winner_entrant_id && id && f.winner_entrant_id === id) row.classList.add('won');

		if (name) {
			if (seed != null) row.append(node('span', 'bracket-seed', String(seed)));
			row.append(node('span', 'bracket-name', name));
		} else if (source === 'winner_of' || source === 'loser_of') {
			// Say where the player will come from rather than leaving a blank
			// line: a bracket is readable before it is played, and that is
			// most of what a draw sheet is for.
			const from = feederRound != null ? `${feederRound}-${feederPos}` : '?';
			const word = source === 'winner_of' ? 'Winner' : 'Loser';
			row.append(node('span', 'bracket-name pending', `${word} of ${from}`));
		} else {
			row.append(node('span', 'bracket-name pending', 'Bye'));
		}

		// A score only means something once there is a match behind it.
		if (f.match_id) row.append(node('span', 'bracket-frames', String(frames ?? 0)));
		return row;
	}

	// ─── A fixture ───
	function fixture(f) {
		const box = node('div', 'bracket-fixture');
		box.dataset.fixture = f.fixture_id;
		box.append(node('div', 'bracket-no', f.round + '-' + f.position));
		box.append(side(f, 'home'), side(f, 'away'));

		const tags = node('div', 'bracket-tags');
		if (f.advance_reason) {
			tags.append(node('span', 'badge pending', AWARD[f.advance_reason] || f.advance_reason));
		} else if (f.match_id) {
			const card = CARD[f.card_state];
			if (card && card.label) tags.append(node('span', 'badge ' + card.cls, card.label));
			// A result that has not been published has not happened as far as
			// the draw is concerned, so the bracket says so rather than
			// leaving the TD wondering why nobody moved up.
			if (!f.published && f.card_state && f.card_state !== 'in_progress') {
				tags.append(node('span', 'badge warn', 'Waiting on you'));
			}
			if (f.objection) tags.append(node('span', 'badge disputed', 'Disputed'));
			// A finished card that is level is not a result: the tiebreak has
			// not been recorded, and nobody can advance until it is.
			if (f.match_status === 'complete' && !f.winner_entrant_id) {
				tags.append(node('span', 'badge warn', 'Level, needs a tiebreak'));
			}
		}
		if (tags.childElementCount) box.append(tags);

		if (!readOnly) box.append(controls(f));
		return box;
	}

	// ─── What the TD can do to a fixture ───
	function controls(f) {
		const row = node('div', 'bracket-actions');
		const both = f.home_entrant_id && f.away_entrant_id;

		if (f.match_id) {
			const open = node('a', 'btn btn-secondary btn-sm', 'Open match');
			open.href = '/match/?id=' + encodeURIComponent(f.match_id);
			row.append(open);

			// Publishing is only a separate step where the tournament asks for
			// it. In the other modes submitting already published, so offering
			// a button here would be offering one that does nothing.
			if (f.needs_approval && !f.published && f.card_state && f.card_state !== 'in_progress') {
				row.append(action('publish', f.fixture_id, 'Publish', 'btn-secondary'));
				row.append(action('send-back', f.fixture_id, 'Send back', 'btn-danger'));
			}
		} else if (both && !f.advanced_entrant_id) {
			row.append(action('start', f.fixture_id, 'Start match', 'btn-secondary'));
		}

		// A walkover is the common one at a club night: somebody did not turn
		// up and the other player goes through without playing.
		if (!f.match_id && !f.advanced_entrant_id && (f.home_entrant_id || f.away_entrant_id)) {
			if (f.home_entrant_id) {
				row.append(action('walkover', f.fixture_id, 'W/O to ' + f.home_name, 'btn-secondary', f.home_entrant_id));
			}
			if (f.away_entrant_id) {
				row.append(action('walkover', f.fixture_id, 'W/O to ' + f.away_name, 'btn-secondary', f.away_entrant_id));
			}
		}

		// Undoing an award. Not offered for a bye, which is a fact about the
		// shape of the draw rather than a decision anybody made.
		if (f.advanced_entrant_id && f.advance_reason !== 'bye') {
			row.append(action('undo-award', f.fixture_id, 'Undo', 'btn-danger'));
		}

		return row;
	}

	// Both approval calls take a match, and the buttons carry a fixture.
	const matchOf = (fixtureId) => {
		const f = fixtures.find((x) => x.fixture_id === fixtureId);
		return f ? f.match_id : null;
	};

	function action(kind, fixtureId, label, cls, entrantId) {
		const b = node('button', 'btn btn-sm ' + cls, label);
		b.type = 'button';
		b.dataset.act = kind;
		b.dataset.fixture = fixtureId;
		if (entrantId) b.dataset.entrant = entrantId;
		return b;
	}

	// ─── The whole bracket ───
	function render() {
		els.setup.hidden = !!fixtures.length || readOnly;
		els.actions.hidden = !fixtures.length || readOnly;

		if (!fixtures.length) {
			els.bracket.replaceChildren();
			if (readOnly) {
				els.bracket.append(node('div', 'empty', 'The draw for this tournament has not been made yet.'));
			}
			return;
		}

		const main = fixtures.filter((f) => f.bracket === 'main');
		const lastRound = Math.max(...main.map((f) => f.round));
		const columns = [];

		for (let r = 1; r <= lastRound; r++) {
			const inRound = main.filter((f) => f.round === r);
			if (!inRound.length) continue;
			const col = node('div', 'bracket-round');
			col.append(node('h2', 'bracket-round-name', roundName(r, lastRound)));
			col.append(...inRound.map(fixture));
			columns.push(col);
		}

		// Third place sits beside the final rather than after it, because that
		// is where it is played.
		const third = fixtures.filter((f) => f.bracket === 'third_place');
		if (third.length) {
			const col = node('div', 'bracket-round');
			col.append(node('h2', 'bracket-round-name', 'Third place'));
			col.append(...third.map(fixture));
			columns.push(col);
		}

		els.bracket.replaceChildren(...columns);
	}

	// ─── Reading ───
	async function loadTournament() {
		const { data, error } = await supabaseClient
			.from('tbl_tournaments')
			.select('id, name, format, status, starts_at, third_place, progression, create_matches')
			.eq('id', tournamentId)
			.maybeSingle();

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (!data) {
			TDC.error(AREA, 'no tournament with that id. Check the link.', { tournamentId }, els.status);
			return false;
		}

		tournament = data;
		els.name.textContent = data.name;

		const bits = [FORMAT[data.format] || data.format];
		if (data.starts_at) {
			const d = new Date(data.starts_at);
			if (isNaN(d)) TDC.error(AREA, 'unreadable start date: ' + data.starts_at);
			else bits.push(d.toLocaleString([], {
				weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
			}));
		}
		if (data.progression === 'manual') bits.push('Moved by hand');
		if (data.create_matches === 'manual') bits.push('Matches started by hand');
		els.meta.textContent = bits.join(' · ');

		els.progression.value = data.progression;
		els.createMatches.value = data.create_matches;
		els.thirdPlace.checked = data.third_place;
		return true;
	}

	async function loadDraw() {
		const { data, error } = await supabaseClient.rpc('tdc_tournament_draw', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		fixtures = data || [];
		render();
		return true;
	}

	// Moves people up and starts whatever is ready, according to the
	// tournament's own settings. Harmless to call when there is no draw, and
	// harmless to call twice.
	async function resolve() {
		if (readOnly || !fixtures.length) return true;
		const { error } = await supabaseClient.rpc('tdc_resolve_draw', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		return true;
	}

	// ─── Writing ───
	// One at a time, resolve after, then re-read. The server owns the bracket.
	async function write(what, fn) {
		if (busy) return false;
		busy = true;
		TDC.status(els.status, what + '…', '');

		const { error } = await fn();
		if (error) {
			busy = false;
			TDC.showSupabaseError(AREA, error, els.status);
			await loadDraw();
			return false;
		}

		await resolve();
		const ok = await loadDraw();
		busy = false;
		if (ok) TDC.status(els.status, '', '');
		return ok;
	}

	// ─── How many entrants are waiting ───
	async function describeField() {
		const { data, error } = await supabaseClient.rpc('tdc_tournament_entrants', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const live = (data || []).filter((e) => e.status !== 'withdrawn');
		const confirmed = live.filter((e) => e.status === 'confirmed');
		els.whoHint.textContent =
			`${confirmed.length} confirmed, ${live.length - confirmed.length} interested.`;
	}

	// ─── Generating ───
	els.generate.addEventListener('click', async () => {
		const confirmedOnly = els.who.value === 'confirmed';

		// The three settings are saved before generating, because the draw
		// reads them. Doing it after would generate against the old ones.
		const saved = await write('Saving settings', () =>
			supabaseClient.rpc('tdc_update_tournament', {
				p_tournament_id: tournamentId,
				p_third_place: els.thirdPlace.checked,
				p_progression: els.progression.value,
				p_create_matches: els.createMatches.value
			}));
		if (!saved) return;

		await loadTournament();
		await write('Generating the draw', () =>
			supabaseClient.rpc('tdc_generate_draw', {
				p_tournament_id: tournamentId,
				p_confirmed_only: confirmedOnly
			}));
	});

	els.resolve.addEventListener('click', () => write('Refreshing', async () => ({ error: null })));

	// Redrawing a started tournament is the TD's call. The database refuses it
	// once with a message naming how many matches are attached; that message
	// is what the person is asked to confirm, so the warning they read is the
	// real one rather than a guess written here.
	els.redraw.addEventListener('click', async () => {
		if (busy) return;
		const confirmedOnly = els.who.value === 'confirmed';

		busy = true;
		TDC.status(els.status, 'Redrawing…', '');
		const { error } = await supabaseClient.rpc('tdc_generate_draw', {
			p_tournament_id: tournamentId,
			p_confirmed_only: confirmedOnly,
			p_replace: true
		});
		busy = false;

		if (!error) {
			await write('Redrawing', async () => ({ error: null }));
			return;
		}

		const message = (error && error.message) || '';
		// Anything other than the confirmation is a real failure.
		if (!message.includes('already started')) {
			TDC.showSupabaseError(AREA, error, els.status);
			return;
		}

		if (!confirm(message + '\n\nThe matches themselves are kept either way.')) {
			TDC.status(els.status, '', '');
			return;
		}

		await write('Redrawing', () =>
			supabaseClient.rpc('tdc_generate_draw', {
				p_tournament_id: tournamentId,
				p_confirmed_only: confirmedOnly,
				p_replace: true,
				p_detach_matches: true
			}));
	});

	// ─── Per-fixture actions ───
	els.bracket.addEventListener('click', (e) => {
		const button = e.target.closest('[data-act]');
		if (!button) return;
		const id = button.dataset.fixture;

		if (button.dataset.act === 'start') {
			write('Starting the match', () =>
				supabaseClient.rpc('tdc_create_fixture_match', { p_fixture_id: id }));
			return;
		}

		if (button.dataset.act === 'walkover') {
			if (!confirm(`${button.textContent.replace('W/O to ', '')} goes through without playing. Carry on?`)) return;
			write('Recording the walkover', () =>
				supabaseClient.rpc('tdc_set_fixture', {
					p_fixture_id: id,
					p_advanced_entrant_id: button.dataset.entrant,
					p_advance_reason: 'walkover'
				}));
			return;
		}

		if (button.dataset.act === 'publish') {
			write('Publishing', () =>
				supabaseClient.rpc('tdc_approve_card', { p_match_id: matchOf(id) }));
			return;
		}

		if (button.dataset.act === 'send-back') {
			const why = prompt('What is wrong with it? The players will see this.');
			if (why === null) return;
			if (!why || why.trim().length < 3) {
				TDC.status(els.status, 'Sending a card back needs a reason.', '');
				return;
			}
			write('Sending it back', () =>
				supabaseClient.rpc('tdc_reject_card', { p_match_id: matchOf(id), p_note: why.trim() }));
			return;
		}

		if (button.dataset.act === 'undo-award') {
			write('Undoing', () =>
				supabaseClient.rpc('tdc_set_fixture', {
					p_fixture_id: id,
					p_clear_advance: true
				}));
		}
	});

	// ─── Start ───
	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.status);
			return;
		}

		els.entrantsLink.href = '/tournaments/manage/?t=' + encodeURIComponent(tournamentId);

		if (!await loadTournament()) return;

		// Settled before the first render, so the controls are never offered
		// and then taken away. The database refuses the writes either way.
		const { data: mine, error } = await supabaseClient.rpc('tdc_my_tournaments', { p_limit: 200 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const row = (mine || []).find((t) => t.id === tournamentId);
		readOnly = !row || !row.i_run_it;

		if (!await loadDraw()) return;

		if (!readOnly) {
			// Catches up anything decided on somebody else's phone. Only worth
			// a second read when there was actually a draw to resolve.
			if (fixtures.length) {
				await resolve();
				await loadDraw();
			} else {
				await describeField();
			}
		}
	})();
})();
