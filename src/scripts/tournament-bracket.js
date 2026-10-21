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
		status: el('page-status'), entrantsLink: el('entrants-link'),
		statusRow: el('status-row'), statusSelect: el('t-status'), statusHint: el('status-hint'),
		drift: el('drift'), driftIntro: el('drift-intro'),
		driftList: el('drift-list'), driftApply: el('drift-apply')
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
	const STATUS = {
		draft: 'Draft', open: 'Open for entries', in_progress: 'Running',
		complete: 'Finished', cancelled: 'Cancelled'
	};
	// The value the select uses for "stop overriding me". Not a status, so it
	// cannot collide with one.
	const AUTO = '__auto__';

	// ─── State ───
	let tournament = null;
	let fixtures = [];
	let readOnly = true;
	let busy = false;
	// The fixture whose score the TD is typing, if any. One at a time: two
	// half-filled score forms on one bracket is a mis-tap waiting to happen.
	let entering = null;

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

		// The way into the match, for everybody. It was inside the TD's
		// controls until 20 Oct, which meant a player looking at the draw
		// could see their own final and had no way to open it — they had to
		// go round through /matches/. The match page decides for itself what
		// a visitor may do there.
		if (f.match_id) {
			const open = node('a', 'btn btn-secondary btn-sm', 'Open match');
			open.href = '/match/?id=' + encodeURIComponent(f.match_id);
			const row = node('div', 'bracket-actions');
			row.append(open);
			box.append(row);
		}

		if (!readOnly) {
			box.append(entering === f.fixture_id ? scoreForm(f) : controls(f));
		}
		return box;
	}

	// ─── What the TD can do to a fixture ───
	function controls(f) {
		const row = node('div', 'bracket-actions');
		const both = f.home_entrant_id && f.away_entrant_id;

		if (f.match_id) {
			// Taking a hand-set score back off, which restores the counted
			// frames underneath it.
			if (f.overridden) {
				row.append(action('clear-score', f.fixture_id, 'Use the frames', 'btn-danger'));
			}

			// Approving closes a match in any mode: it publishes one that was
			// waiting on the coordinator, and it ends the players'
			// involvement in one that published itself on submission.
			// Offered wherever there is a result that nobody has approved.
			const hasResult = f.overridden || (f.card_state && f.card_state !== 'in_progress');
			if (hasResult && f.card_state !== 'approved') {
				row.append(action('publish', f.fixture_id,
					f.published ? 'Lock it' : 'Publish', 'btn-secondary'));
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

		// Entering the result by hand, which needs both players known and
		// nothing already awarded. Offered whether or not a match exists: if
		// it does not, saving makes one.
		if (both && !f.advanced_entrant_id) {
			row.append(action('enter', f.fixture_id,
				f.overridden ? 'Change score' : 'Enter score', 'btn-secondary'));
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

	// ─── Entering a result by hand ───
	// The third of UV's three cases: the TD knows it finished 5-3 and has no
	// interest in reconstructing eight frames at eleven at night. Two numbers
	// and a reason, because tdc_set_match_override will not take a score
	// without one.
	function scoreForm(f) {
		const box = node('div', 'bracket-entry');

		const home = node('input');
		home.type = 'number'; home.min = 0; home.inputMode = 'numeric';
		home.value = f.home_frames ?? 0;
		home.setAttribute('aria-label', 'Frames for ' + (f.home_name || 'home'));

		const away = node('input');
		away.type = 'number'; away.min = 0; away.inputMode = 'numeric';
		away.value = f.away_frames ?? 0;
		away.setAttribute('aria-label', 'Frames for ' + (f.away_name || 'away'));

		const why = node('input');
		why.type = 'text';
		why.placeholder = 'Why (kept on the record)';
		why.value = f.override_reason || '';
		why.setAttribute('aria-label', 'Reason');

		const line = node('div', 'bracket-entry-score');
		line.append(node('span', 'bracket-entry-name', f.home_name || '—'), home,
			node('span', 'bracket-entry-v', 'v'),
			away, node('span', 'bracket-entry-name', f.away_name || '—'));

		const save = node('button', 'btn btn-primary btn-sm', 'Save');
		save.type = 'button';
		save.addEventListener('click', () => saveScore(f, home.value, away.value, why.value));

		const cancel = node('button', 'btn btn-secondary btn-sm', 'Cancel');
		cancel.type = 'button';
		cancel.addEventListener('click', () => { entering = null; render(); });

		const actions = node('div', 'bracket-actions');
		actions.append(save, cancel);

		box.append(line, why, actions);
		return box;
	}

	async function saveScore(f, homeRaw, awayRaw, why) {
		const home = parseInt(homeRaw, 10);
		const away = parseInt(awayRaw, 10);
		if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
			TDC.status(els.status, 'A score needs two numbers, neither of them negative.', '');
			return;
		}
		if (!why || why.trim().length < 3) {
			TDC.status(els.status, 'Setting a score by hand needs a reason.', '');
			return;
		}

		// A fixture nobody has started has no match to put a score on, so one
		// is made first. Two calls rather than one, because creating a match
		// and recording its result are different things and the second can
		// fail on its own.
		let matchId = f.match_id;
		if (!matchId) {
			const { data, error } = await supabaseClient.rpc('tdc_create_fixture_match', {
				p_fixture_id: f.fixture_id
			});
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
			matchId = data;
		}

		entering = null;
		await write('Saving the score', () =>
			supabaseClient.rpc('tdc_set_match_override', {
				p_match_id: matchId,
				p_home_score: home,
				p_away_score: away,
				p_reason: why.trim()
			}));
	}

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
		// The set of live matches changes as rounds resolve, so the
		// subscription is re-pointed after every read rather than fixed at
		// load. It is a no-op when the set has not changed.
		startLiveUpdates();
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

	// ─── Status ───
	// Derived from the tournament's facts unless the TD has said otherwise.
	// The select offers the five statuses plus a way back to the derivation,
	// and the hint says what the derivation would say — so handing it back is
	// a known quantity rather than something you find out by pressing it.
	async function loadStatus() {
		if (readOnly) { els.statusRow.hidden = true; return; }

		const { data, error } = await supabaseClient.rpc('tdc_tournament_status', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const row = Array.isArray(data) ? data[0] : data;
		if (!row) return;

		els.statusSelect.replaceChildren(
			...Object.entries(STATUS).map(([v, label]) =>
				new Option(label, v, false, v === row.status && row.set_by_hand)),
			new Option(
				row.set_by_hand ? 'Follow the tournament again' : 'Following the tournament',
				AUTO, false, !row.set_by_hand));

		els.statusHint.textContent = row.set_by_hand
			? `Set by hand. Left to itself this would say "${STATUS[row.would_be] || row.would_be}".`
			: 'Worked out from the entrants and the draw.';

		els.statusRow.hidden = false;
	}

	els.statusSelect.addEventListener('change', () => {
		const v = els.statusSelect.value;
		write('Saving the status', () =>
			supabaseClient.rpc('tdc_update_tournament', v === AUTO
				? { p_tournament_id: tournamentId, p_auto_status: true }
				: { p_tournament_id: tournamentId, p_status: v }));
	});

	// ─── When the draw disagrees with its own results ───
	// A rehearsal, not an estimate: tdc_cascade_draw does the whole thing in a
	// subtransaction and rolls it back, so the list below is exactly what
	// pressing the button will do, knock-on effects included.
	async function checkDrift() {
		els.drift.hidden = true;
		if (readOnly || !fixtures.length) return;

		const { data, error } = await supabaseClient.rpc('tdc_cascade_draw', {
			p_tournament_id: tournamentId,
			p_apply: false
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const changes = (data && data.changes) || [];
		if (!changes.length) return;

		const detached = (data && data.detached) || [];
		const played = detached.filter((d) => d.frames > 0);

		const bits = [changes.length === 1 ? 'One place in the draw changes.'
			: changes.length + ' places in the draw change.'];
		if (played.length) {
			// The thing a TD actually needs to know before pressing it.
			bits.push(played.length === 1
				? 'One match that has already been played is between the wrong two people and comes out of the draw. It is kept, not deleted.'
				: played.length + ' matches that have already been played are between the wrong people and come out of the draw. They are kept, not deleted.');
		}
		els.driftIntro.textContent = bits.join(' ');

		els.driftList.replaceChildren(...changes.map((c) => {
			const where = c.bracket === 'main' ? c.round + '-' + c.position
				: c.bracket.replace('_', ' ') + ' ' + c.position;
			return node('li', null, `${where}: ${c.was} becomes ${c.now}`);
		}));

		els.drift.hidden = false;
	}

	els.driftApply.addEventListener('click', () => {
		if (!confirm('Update the draw to match the results as they now stand?')) return;
		write('Updating the draw', () =>
			supabaseClient.rpc('tdc_cascade_draw', { p_tournament_id: tournamentId, p_apply: true }));
	});

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
		if (ok) {
			TDC.status(els.status, '', '');
			await loadStatus();
			await checkDrift();
		}
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

		if (button.dataset.act === 'enter') {
			entering = id;
			render();
			return;
		}

		if (button.dataset.act === 'clear-score') {
			write('Clearing the score', () =>
				supabaseClient.rpc('tdc_clear_match_override', { p_match_id: matchOf(id) }));
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

	// ─────────────────────────────────────────────────────────────────
	// Live updates
	//
	// A TD at the desk should see a score move as it is tapped at the table.
	// Same two tables the match page watches, and the same reasoning: every
	// frame change bumps card_version on tbl_matches, so one row carries a
	// frame, a correction and a removal alike; agreeing writes only an event
	// and touches nothing on the match, so tbl_match_events is watched too.
	//
	// Only the matches still live are subscribed to. A fixture nobody has
	// approved can still change; one that has been approved is terminal, and
	// a bracket of thirty-two finished matches has nothing to listen for.
	//
	// Realtime is for immediacy, not correctness. Events are missed while a
	// phone is locked or the socket is down, so the page also re-reads when
	// it is shown again and when the connection returns — that is what makes
	// a missed event harmless rather than a bracket that quietly went stale.
	// ─────────────────────────────────────────────────────────────────

	let liveChannel = null;
	let liveKey = '';          // which matches the current channel covers
	let liveTimer = null;

	const liveMatchIds = () => fixtures
		.filter((f) => f.match_id && f.card_state !== 'approved')
		.map((f) => f.match_id);

	let liveSet = new Set();

	// payload is null when this is a catch-up rather than a pushed event.
	function onLiveChange(payload) {
		// Checked here as well as in the filter, because the unfiltered
		// fallback below hears about every match on the site.
		if (payload && payload.new) {
			const id = payload.new.id || payload.new.match_id;
			if (id && !liveSet.has(id)) return;
		}

		// Several frames land in a burst while somebody clears a rack, and a
		// typed-in score must not be thrown away under the TD's hands.
		clearTimeout(liveTimer);
		liveTimer = setTimeout(() => {
			if (busy || entering) return;
			loadDraw().then(() => { if (!readOnly) checkDrift(); });
		}, 400);
	}

	function startLiveUpdates() {
		const ids = liveMatchIds();
		const key = ids.slice().sort().join(',');
		if (key === liveKey) return;      // nothing has changed about who to watch

		stopLiveUpdates();
		liveKey = key;
		liveSet = new Set(ids);
		if (!ids.length) return;

		// A server-side filter is the right thing and keeps the socket quiet,
		// but the first round of a 64 draw is 32 ids in one filter string.
		// Rather than find out where the length limit is on a club night, a
		// large field drops the filter and sorts it out on arrival instead.
		const few = ids.length <= 20;
		const matchFilter  = few ? { filter: 'id=in.(' + ids.join(',') + ')' } : {};
		const eventFilter  = few ? { filter: 'match_id=in.(' + ids.join(',') + ')' } : {};

		liveChannel = supabaseClient
			.channel('draw:' + tournamentId)
			.on('postgres_changes',
				Object.assign({ event: 'UPDATE', schema: 'public', table: 'tbl_matches' }, matchFilter),
				onLiveChange)
			.on('postgres_changes',
				Object.assign({ event: 'INSERT', schema: 'public', table: 'tbl_match_events' }, eventFilter),
				onLiveChange)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') return;
				// Not fatal: the draw still works, it just stops being live
				// until the page is shown again. Said out loud rather than
				// left as a screen that quietly stops updating.
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					console.error('[' + AREA + '] live updates are not running (' + status + ').');
				}
			});
	}

	function stopLiveUpdates() {
		clearTimeout(liveTimer);
		if (!liveChannel) return;
		supabaseClient.removeChannel(liveChannel);
		liveChannel = null;
		liveKey = '';
	}

	// Coming back to the page, or back online, is when a missed event is
	// caught up. Both re-read rather than trusting the socket.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		onLiveChange();
	});
	window.addEventListener('online', onLiveChange);
	window.addEventListener('pagehide', stopLiveUpdates);

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

		// The entrant list is the TD's view as of 21 Oct — it carries payment
		// status and their private notes — so it would send a player straight
		// back here. Hidden rather than left to bounce them.
		if (readOnly) els.entrantsLink.hidden = true;

		if (!await loadDraw()) return;
		await loadStatus();

		if (!readOnly) {
			// Catches up anything decided on somebody else's phone. Only worth
			// a second read when there was actually a draw to resolve.
			if (fixtures.length) {
				await resolve();
				await loadDraw();
				await checkDrift();
			} else {
				await describeField();
			}
		}
	})();
})();
