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
		runRow: el('run-row'), tProgression: el('t-progression'),
		tCreateMatches: el('t-create-matches'), createMatchesHint: el('create-matches-hint'),
		drift: el('drift'), driftIntro: el('drift-intro'),
		driftList: el('drift-list'), driftApply: el('drift-apply'),
		roundRules: el('round-rules'), roundRulesHead: el('round-rules-head'),
		roundRulesNote: el('round-rules-note'), roundRulesMain: el('round-rules-main'),
		roundRulesRest: el('round-rules-rest'), roundRulesLater: el('round-rules-later'),
		roundRulesSave: el('round-rules-save'), roundRulesClear: el('round-rules-clear'),
		roundRulesCancel: el('round-rules-cancel'), roundRulesStatus: el('round-rules-status'),
		wiring: el('wiring'), wiringHead: el('wiring-head'), wiringNote: el('wiring-note'),
		wiringBody: el('wiring-body'), wiringSave: el('wiring-save'),
		wiringCancel: el('wiring-cancel'), wiringStatus: el('wiring-status')
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
	// The fixture whose score the TD is typing, if any. One at a time: two
	// half-filled score forms on one bracket is a mis-tap waiting to happen.
	let entering = null;
	// The slot whose player is being changed, as { fixtureId, side }, plus the
	// candidate list once it has been read. Same one-at-a-time rule.
	let swapping = null;
	let candidates = [];

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── Naming the rounds ───
	// "Semi-final" beats "Round 3" for everybody except the person who wrote
	// the schema.
	//
	// Counted by how many matches are in each round, not by distance from the
	// end. Distance was right only while a draw was a clean power-of-two
	// ladder, and 20261022160000 made that false on purpose: a TD can put a
	// prelim in front of round 1, after which the old rule called the real
	// quarter-finals the semis.
	//
	// Walking down from the last round, a round is the Final if it holds one
	// match, the semis if the round above was the final and it holds two, and
	// so on. The moment the halving breaks — a prelim, an odd field, a match
	// added by hand — naming stops and everything below is "Round n", which
	// is both true and the thing a TD would say out loud.
	function roundNames(main, lastRound) {
		const names = new Map();
		const LADDER = { 1: 'Final', 2: 'Semi-finals', 4: 'Quarter-finals' };
		let expect = 1;

		for (let r = lastRound; r >= 1; r--) {
			const count = main.filter((f) => f.round === r).length;
			if (count !== expect || !LADDER[expect]) break;
			names.set(r, LADDER[expect]);
			expect *= 2;
		}
		return names;
	}

	// How a fixture is named to a person. "Round 1 · Match 1", not "1-1" —
	// the short form is the schema's way of identifying a fixture, and it was
	// leaking into everything a TD reads. Said in one place so the bracket,
	// the swap warning and the drift list cannot drift apart.
	function fixtureName(bracket, round, position) {
		if (bracket && bracket !== 'main') {
			return bracket.replace(/_/g, ' ') + ' · Match ' + position;
		}
		return `Round ${round} · Match ${position}`;
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

		// The row is a grid of three fixed tracks — swap, name, score — rather
		// than a flex line. 21 Oct: as a flex line the name was a shrinkable
		// item sharing space with the button, and on UV's screen it collapsed
		// to 0 x 20 and vanished, with the frame count left looking like the
		// player. A 1fr grid track cannot be squeezed to nothing by what sits
		// beside it, so the name is safe whatever else the row grows.
		const swapCell = node('div', 'bracket-swap-cell');
		const nameCell = node('div', 'bracket-name-cell');
		const scoreCell = node('div', 'bracket-score-cell');

		// What the slot says. Built first so the swap control can be labelled
		// with it, and so the clickable version below wraps the same text.
		let label, pending = false;
		if (name) {
			label = name;
		} else if (source === 'winner_of' || source === 'loser_of') {
			// Say where the player will come from rather than leaving a blank
			// line: a bracket is readable before it is played, and that is
			// most of what a draw sheet is for.
			// Short form here on purpose: this sits inside a 15rem column and
			// the fixture's own heading above already spells the long form
			// out, so "Winner of R1 · M1" is unambiguous and fits.
			const from = feederRound != null ? `R${feederRound} · M${feederPos}` : '?';
			label = (source === 'winner_of' ? 'Winner' : 'Loser') + ' of ' + from;
			pending = true;
		} else {
			label = 'Bye';
			pending = true;
		}

		if (name && seed != null) nameCell.append(node('span', 'bracket-seed', String(seed)));

		// UV, 21 Oct: "keep that swap button as a small icon before each name
		// and allow clicking directly on the name to change players". So the
		// name itself is the control for a TD, and a plain span for everybody
		// else — a read-only viewer must not be given a dead button.
		if (readOnly) {
			nameCell.append(node('span', 'bracket-name' + (pending ? ' pending' : ''), label));
		} else {
			const nameBtn = node('button', 'bracket-name as-button' + (pending ? ' pending' : ''), label);
			nameBtn.type = 'button';
			nameBtn.dataset.act = 'swap';
			nameBtn.dataset.fixture = f.fixture_id;
			nameBtn.dataset.side = which;
			nameBtn.title = 'Change who is in this slot';
			nameCell.append(nameBtn);

			const icon = node('button', 'bracket-swap', '⇄');
			icon.type = 'button';
			icon.dataset.act = 'swap';
			icon.dataset.fixture = f.fixture_id;
			icon.dataset.side = which;
			icon.title = 'Change who is in this slot';
			icon.setAttribute('aria-label',
				'Change ' + (name || 'the ' + which + ' slot') + ' in this fixture');
			swapCell.append(icon);
		}

		// A score only means something once there is a match behind it.
		if (f.match_id) scoreCell.append(node('span', 'bracket-frames', String(frames ?? 0)));

		// Which slot this is, so an arrow has something to point at. The
		// progression overlay anchors to these rather than to the fixture box,
		// because a slot is what a source feeds — not the match.
		row.dataset.side = which;

		row.append(swapCell, nameCell, scoreCell);
		return row;
	}

	// ─── A fixture ───
	function fixture(f) {
		const box = node('div', 'bracket-fixture');
		box.dataset.fixture = f.fixture_id;
		// UV, 21 Oct: "Instead of just showing 1-2 or 1-1 on matches in the
		// tournament view, show Round 1 - Match 1". The short form was the
		// schema's way of naming a fixture, not a person's.
		box.append(node('div', 'bracket-no', fixtureName(f.bracket, f.round, f.position)));
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
			if (swapping && swapping.fixtureId === f.fixture_id) box.append(swapForm(f));
			else if (entering === f.fixture_id) box.append(scoreForm(f));
			else box.append(controls(f));
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

		// Where the two slots come from, and the undo for adding a match.
		// Both only while nothing has been played: a fixture with a match has
		// settled sides, and the functions refuse either way — offering a
		// button that always refuses is worse than not offering it.
		if (!f.match_id) {
			row.append(action('wiring', f.fixture_id, 'Wiring', 'btn-secondary'));
			row.append(action('remove-fixture', f.fixture_id, 'Remove', 'btn-danger'));
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
		// Native, not the site's stepper: a tall pill would break the
		// one-line "name 5 – 3 name" score. The bracket's own design is due.
		home.type = 'number'; home.min = 0; home.inputMode = 'numeric';
		home.dataset.control = 'none';
		home.value = f.home_frames ?? 0;
		home.setAttribute('aria-label', 'Frames for ' + (f.home_name || 'home'));

		const away = node('input');
		away.type = 'number'; away.min = 0; away.inputMode = 'numeric';
		away.dataset.control = 'none';
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

	// ─────────────────────────────────────────────────────────────────
	// Changing who is in a slot
	//
	// Two taps and a question. The question is the point: tdc_swap_fixture_player
	// rehearses the whole thing first — inside a subtransaction that is rolled
	// back — so what the TD is asked to confirm is what will actually happen,
	// not a guess this page made about what might.
	//
	// Nothing here works out the consequences for itself. The cascade, the
	// detaching of a match and the clearing of a walkover are all decided by
	// the database, and this only renders what it was told.
	// ─────────────────────────────────────────────────────────────────

	function swapForm(f) {
		const box = node('div', 'bracket-entry');
		const current = swapping.side === 'home' ? f.home_name : f.away_name;

		box.append(node('div', 'bracket-entry-name',
			current ? 'Replace ' + current : 'Who goes in this slot'));

		if (!candidates.length) {
			box.append(node('div', 'hint', 'Reading the entrants…'));
		} else {
			const pick = document.createElement('select');
			pick.dataset.control = 'none';   // every entrant: far too many for a pill
			pick.setAttribute('aria-label', 'Who goes in this slot');
			// Empty is a real choice: somebody withdrew and there is no
			// stand-in, which is different from not having decided yet.
			pick.append(new Option(current ? '— take ' + current + ' out —' : '— nobody —', ''));
			for (const c of candidates) {
				const bits = [c.display_name];
				if (c.status !== 'confirmed') bits.push(c.status);
				if (c.paid) bits.push('paid');
				// Where they already are, so a TD can see they are about to
				// put somebody in two places at once.
				if (c.already_in) bits.push('already in ' + c.already_in);
				pick.append(new Option(bits.join(' · '), c.entrant_id));
			}
			box.append(pick);

			const why = node('input');
			why.type = 'text';
			why.placeholder = 'Why (needed once frames are played)';
			why.setAttribute('aria-label', 'Why the player is changing');
			box.append(why);

			const go = node('button', 'btn btn-primary btn-sm', 'Check');
			go.type = 'button';
			go.addEventListener('click', () => trySwap(f, pick.value || null, why.value));

			const cancel = node('button', 'btn btn-secondary btn-sm', 'Cancel');
			cancel.type = 'button';
			cancel.addEventListener('click', () => { swapping = null; candidates = []; render(); });

			const actions = node('div', 'bracket-actions');
			actions.append(go, cancel);
			box.append(actions);
		}

		return box;
	}

	async function loadCandidates(fixtureId) {
		const { data, error } = await supabaseClient.rpc('tdc_fixture_candidates', {
			p_fixture_id: fixtureId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		candidates = data || [];
		render();
	}

	// Turns the rehearsal into the sentence the TD is asked to agree to. Every
	// line comes from the report; nothing is inferred here.
	function swapWarning(r) {
		const lines = [];
		lines.push(`${r.was} out, ${r.now} in — ${fixtureName(r.bracket, r.round, r.position)}.`);

		const d = r.detached || {};
		if (d.match_id) {
			lines.push('');
			lines.push(d.frames
				? `The match already has ${d.frames} frame(s). It keeps them and stops belonging to the draw — nothing is deleted, but this fixture will show no score.`
				: 'The match on this fixture stops belonging to the draw.');
		}

		if (r.award_cleared && r.award_cleared.reason) {
			lines.push('');
			lines.push(`The ${r.award_cleared.reason} awarded to ${r.was} is undone.`);
		}

		const moves = (r.cascade && r.cascade.changes) || [];
		if (moves.length) {
			lines.push('');
			lines.push('Further up the draw:');
			for (const m of moves) {
				lines.push(`  ${fixtureName(m.bracket, m.round, m.position)}: ${m.was} → ${m.now}`);
			}
		}

		const dets = (r.cascade && r.cascade.detached) || [];
		if (dets.length) {
			lines.push('');
			lines.push(`${dets.length} match(es) above also stop belonging to the draw, keeping their frames.`);
		}

		// Allowed, but a bracket with somebody in two fixtures of one round
		// cannot be played, so it is said plainly rather than left to be
		// noticed later.
		const also = (r.also_in || []).filter((x) => x.same_round);
		if (also.length) {
			lines.push('');
			lines.push(`Careful: ${r.now} is already in ${also.map((x) => fixtureName(x.bracket, x.round, x.position)).join(', ')}, in this same round.`);
		}

		lines.push('');
		lines.push('Go ahead?');
		return lines.join('\n');
	}

	async function trySwap(f, entrantId, why) {
		TDC.status(els.status, 'Checking…', '');

		const args = {
			p_fixture_id: f.fixture_id,
			p_side: swapping.side,
			p_entrant_id: entrantId,
			p_reason: why && why.trim() ? why.trim() : null
		};

		// The rehearsal. p_apply defaults to false, so this changes nothing.
		const checked = await rehearse('swap', () => supabaseClient.rpc('tdc_swap_fixture_player', args));
		if (!checked) return;
		const { data, error } = checked;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		// Nothing to do, said rather than confirmed and applied as a no-op.
		if (data && data.note) {
			TDC.status(els.status, data.note, '');
			swapping = null; candidates = [];
			render();
			return;
		}

		if (!confirm(swapWarning(data))) {
			TDC.status(els.status, '', '');
			return;
		}

		swapping = null; candidates = [];
		await write('Changing the player', () =>
			supabaseClient.rpc('tdc_swap_fixture_player',
				Object.assign({}, args, { p_apply: true })));
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
		// Re-asserted here because on first load loadTournament runs before
		// loadDraw, so it decided on an empty fixture list.
		if (tournament) renderRunSettings(tournament);

		if (!fixtures.length) {
			els.bracket.replaceChildren();
			if (readOnly) {
				els.bracket.append(node('div', 'empty', 'The draw for this tournament has not been made yet.'));
			}
			return;
		}

		const main = fixtures.filter((f) => f.bracket === 'main');
		const lastRound = Math.max(...main.map((f) => f.round));
		const names = roundNames(main, lastRound);
		const columns = [];

		// 1..lastRound, not the rounds that happen to have fixtures.
		// tdc_insert_round (20261022160000) renumbers and leaves a gap, and
		// the gap *is* the empty round — there is no rounds table for it to be
		// a row in. Skipping empty rounds here would make an inserted round
		// invisible and the one after it look like it moved for no reason.
		for (let r = 1; r <= lastRound; r++) {
			const inRound = main.filter((f) => f.round === r);

			// The border before this round, where a new one goes in.
			if (!readOnly) columns.push(roundBorder(r));

			const col = node('div', 'bracket-round');
			col.dataset.round = String(r);
			col.dataset.bracket = 'main';

			const head = node('h2', 'bracket-round-name', names.get(r) || 'Round ' + r);
			if (!readOnly) head.append(roundRulesButton('main', r));
			col.append(head);

			if (inRound.length) col.append(...inRound.map(fixture));
			else col.append(node('div', 'bracket-round-empty', 'Empty round'));

			if (!readOnly) col.append(addMatchButton('main', r, inRound.length === 0));
			columns.push(col);
		}

		// A round on the end moves nothing, so it is offered as a plain add
		// rather than an insert.
		if (!readOnly) columns.push(addRoundColumn(lastRound + 1));

		// Third place sits beside the final rather than after it, because that
		// is where it is played.
		const third = fixtures.filter((f) => f.bracket === 'third_place');
		if (third.length) {
			const col = node('div', 'bracket-round');
			const tpHead = node('h2', 'bracket-round-name', 'Third place');
			// Was rest[0] — an identifier that does not exist in this scope, so
			// a TD opening a bracket with a third-place playoff got a
			// ReferenceError and no bracket at all. Introduced 22 Oct with the
			// round-rules button and caught while building the arrows.
			if (!readOnly) tpHead.append(roundRulesButton(third[0].bracket, third[0].round));
			col.append(tpHead);
			col.append(...third.map(fixture));
			columns.push(col);
		}

		els.bracket.replaceChildren(...columns);
		drawArrows();
	}

	// ─── Reading ───
	async function loadTournament() {
		const { data, error } = await supabaseClient
			.from('tbl_tournaments')
			.select('id, name, format, status, starts_at, third_place, progression, create_matches, rules')   // rules: the round panel starts from the tournament's own ruleset
			.eq('id', tournamentId)
			.maybeSingle();

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (!data) {
			TDC.error(AREA, 'no tournament with that id. Check the link.', { tournamentId }, els.status);
			return false;
		}

		tournament = data;
		els.name.textContent = data.name;
		renderRunSettings(data);

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
		await loadRoundRules();
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

	// ─────────────────────────────────────────────────────────────────
	// How the draw runs, while it is running
	//
	// progression and create_matches were settable only in the setup panel,
	// which is hidden once a draw exists — so changing your mind mid-night
	// meant clearing the draw. tdc_update_tournament has taken both since
	// 20261019180000; nothing but the page was missing.
	// ─────────────────────────────────────────────────────────────────

	function renderRunSettings(t) {
		// Only once there is a draw: before that the setup panel above asks
		// the same two questions, and two copies on one screen is a way to
		// set one and wonder why the other disagrees.
		els.runRow.hidden = readOnly || !fixtures.length;
		els.tProgression.value = t.progression;
		els.tCreateMatches.value = t.create_matches;
		els.createMatchesHint.textContent = t.create_matches === 'manual'
			// The thing UV hit: a player could not score because no match
			// existed, and nothing on the page said so.
			? 'Nobody can score a match until you press Start match on it.'
			: 'A match starts on its own once both players are known.';
	}

	els.tProgression.addEventListener('change', () =>
		write('Saving', () => supabaseClient.rpc('tdc_update_tournament', {
			p_tournament_id: tournamentId, p_progression: els.tProgression.value })));

	els.tCreateMatches.addEventListener('change', () =>
		write('Saving', () => supabaseClient.rpc('tdc_update_tournament', {
			p_tournament_id: tournamentId, p_create_matches: els.tCreateMatches.value })));


	// ─────────────────────────────────────────────────────────────────
	// The rules for a round
	//
	// A tournament's ruleset is its default; a round may differ — race to 3
	// early, race to 5 from the semis. Stored per round
	// (20261022140000), so a match created later in that round inherits it
	// rather than quietly getting the tournament's.
	//
	// Every write rehearses first. tdc_set_round_rules returns what it would
	// do — which matches change, how many are being played right now — and
	// that is what the confirmation is built from, rather than a guess made
	// here.
	// ─────────────────────────────────────────────────────────────────

	// What each round's stored ruleset is, keyed "bracket:round". Absent means
	// the round follows the tournament.
	let roundRules = new Map();
	// The round whose panel is open, as { bracket, round }, and the ruleset
	// being edited in it.
	let editingRound = null;
	let draftRules = null;
	const openRuleGroups = new Set();

	const roundKey = (bracket, round) => bracket + ':' + round;

	async function loadRoundRules() {
		if (readOnly) { roundRules = new Map(); return; }

		const { data, error } = await supabaseClient.rpc('tdc_round_rules', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		roundRules = new Map((data || []).map((r) => [roundKey(r.bracket, r.round), r.rules]));
	}

	// The heading button on a round column. Says whether the round differs,
	// because that is the thing a TD scanning the bracket wants to know.
	function roundRulesButton(bracket, round) {
		const own = roundRules.get(roundKey(bracket, round));

		const b = node('button', 'bracket-round-rules' + (own ? ' differs' : ''));
		b.type = 'button';
		b.dataset.act = 'round-rules';
		b.dataset.bracket = bracket;
		b.dataset.round = String(round);

		if (own) {
			// The one setting worth showing at a glance. Everything else is
			// behind the panel.
			const target = own.win_condition_target;
			const kind = TDCMatchDef.WIN_CONDITION[own.win_condition_type] || '';
			b.textContent = target ? `${kind} ${target}` : 'Own rules';
			b.title = 'This round has its own rules';
		} else {
			b.textContent = 'Rules';
			b.title = 'This round follows the tournament';
		}
		return b;
	}

	function openRoundRules(bracket, round) {
		editingRound = { bracket, round };
		// Start from whatever the round is actually played under: its own
		// rules if it has them, the tournament's if not. Copied, so cancelling
		// leaves nothing behind.
		draftRules = Object.assign({},
			roundRules.get(roundKey(bracket, round)) || (tournament && tournament.rules) || {});
		openRuleGroups.clear();
		renderRoundRules();
		els.roundRules.hidden = false;
		els.roundRules.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	function closeRoundRules() {
		editingRound = null;
		draftRules = null;
		els.roundRules.hidden = true;
		TDC.status(els.roundRulesStatus, '', '');
	}

	function renderRoundRules() {
		if (!editingRound) return;
		const { bracket, round } = editingRound;
		const own = roundRules.get(roundKey(bracket, round));

		els.roundRulesHead.textContent = 'Rules for ' + fixtureName(bracket, round, 1)
			.replace(/ · Match 1$/, '');
		els.roundRulesNote.textContent = own
			? 'This round has its own rules. Matches started in it from now on will use these.'
			: 'This round follows the tournament. Changing anything here gives it rules of its own.';
		els.roundRulesClear.hidden = !own;

		const live = TDCMatchDef.liveRuleKeys(draftRules);

		els.roundRulesMain.replaceChildren(
			...live.filter((d) => TDCMatchDef.MAIN_KEYS.includes(d.key))
				.map((d) => TDCMatchDef.control(d, draftRules, 'rr'))
		);

		els.roundRulesRest.replaceChildren();
		for (const group of TDCMatchDef.GROUPS) {
			const defs = live.filter(
				(d) => d.group === group && !TDCMatchDef.MAIN_KEYS.includes(d.key));
			if (!defs.length) continue;

			const box = document.createElement('details');
			box.className = 'set-group';
			// The form is rebuilt whenever a setting changes, so a group that
			// was open has to be put back open — otherwise ticking a box folds
			// away the box you just ticked.
			box.open = openRuleGroups.has(group);
			box.addEventListener('toggle', () => {
				if (box.open) openRuleGroups.add(group); else openRuleGroups.delete(group);
			});

			const head = document.createElement('summary');
			head.textContent = group;
			box.append(head, ...defs.map((d) => TDCMatchDef.control(d, draftRules, 'rr')));
			els.roundRulesRest.append(box);
		}
	}

	els.roundRules.addEventListener('change', (e) => {
		const input = e.target.closest('[data-setting]');
		if (!input || !draftRules) return;

		const def = TDCMatchDef.SETTINGS.find((d) => d.key === input.dataset.setting);
		if (!def) { TDC.error(AREA, 'no definition for setting: ' + input.dataset.setting); return; }

		const value = TDCMatchDef.readValue(def, def.type === 'bool' ? input.checked : input.value);
		if (value === undefined) {
			TDC.status(els.roundRulesStatus,
				def.label + ' needs a number'
					+ (def.min !== undefined ? ' between ' + def.min + ' and ' + def.max : '') + '.', '');
			return;
		}
		draftRules[def.key] = value;
		TDC.status(els.roundRulesStatus, '', '');

		// Turning one setting on can reveal others, so the form is rebuilt and
		// focus put back — otherwise a checkbox throws you to the top.
		const id = input.id;
		renderRoundRules();
		const again = document.getElementById(id);
		if (again) again.focus({ preventScroll: true });
	});

	// Builds the confirmation out of the rehearsal. Every line comes from the
	// report; nothing is worked out here.
	function roundRulesWarning(r) {
		const lines = [];
		const rounds = r.rounds || [];
		lines.push(rounds.length === 1
			? 'Round ' + rounds[0] + '.'
			: 'Rounds ' + rounds.join(', ') + '.');

		const changed = r.changed || [];
		if (!changed.length) {
			lines.push('');
			lines.push('No match has been started in it yet, so this only decides what future matches use.');
		} else {
			lines.push('');
			lines.push(changed.length === 1
				? 'One match already exists and will be changed.'
				: changed.length + ' matches already exist and will be changed.');

			if (r.in_progress > 0) {
				lines.push('');
				lines.push(r.in_progress === 1
					? 'One of them is being played. Its frames are kept, but the break order is worked out again under the new rules.'
					: r.in_progress + ' of them are being played. Their frames are kept, but the break order is worked out again under the new rules.');
			}
		}

		const skipped = r.skipped || [];
		if (skipped.length) {
			lines.push('');
			lines.push('Left alone:');
			for (const s of skipped) {
				lines.push(`  Round ${s.round} · Match ${s.position} — ${s.why}`);
			}
		}

		lines.push('');
		lines.push('Go ahead?');
		return lines.join('\n');
	}

	els.roundRulesSave.addEventListener('click', async () => {
		if (!editingRound) return;
		const { bracket, round } = editingRound;
		const later = els.roundRulesLater.checked;

		TDC.status(els.roundRulesStatus, 'Checking…', '');

		const args = {
			p_tournament_id: tournamentId,
			p_round: round,
			p_rules: draftRules,
			p_bracket: bracket,
			p_and_later: later
		};

		// The rehearsal. p_apply defaults to false, so this changes nothing.
		const checked = await rehearse('round-rules', () => supabaseClient.rpc('tdc_set_round_rules', args));
		if (!checked) return;
		const { data, error } = checked;
		if (error) { TDC.showSupabaseError(AREA, error, els.roundRulesStatus); return; }

		if (!confirm(roundRulesWarning(data))) {
			TDC.status(els.roundRulesStatus, '', '');
			return;
		}

		closeRoundRules();
		await write('Saving the rules', () =>
			supabaseClient.rpc('tdc_set_round_rules', Object.assign({}, args, { p_apply: true })));
	});

	els.roundRulesClear.addEventListener('click', async () => {
		if (!editingRound) return;
		const { bracket, round } = editingRound;
		const later = els.roundRulesLater.checked;

		if (!confirm('Hand this round back to the tournament\'s rules?\n\n'
			+ 'Matches already started keep the rules they were started under — '
			+ 'this decides what future ones use.')) return;

		closeRoundRules();
		await write('Clearing the rules', () =>
			supabaseClient.rpc('tdc_clear_round_rules', {
				p_tournament_id: tournamentId,
				p_round: round,
				p_bracket: bracket,
				p_and_later: later
			}));
	});

	els.roundRulesCancel.addEventListener('click', closeRoundRules);

	// ─── When the draw disagrees with its own results ───
	// A rehearsal, not an estimate: tdc_cascade_draw does the whole thing in a
	// subtransaction and rolls it back, so the list below is exactly what
	// pressing the button will do, knock-on effects included.

	// ─────────────────────────────────────────────────────────────────
	// The progression arrows
	//
	// UV, 22 Oct: "progression arrows between each round where the progression
	// arrows will communicate details like auto-progression and the arrows
	// should be smart so that if TD swaps players as they progress from one
	// round to the next, then the arrows will show that change rather than
	// resorting the entire tournament."
	//
	// They are smart for free. Each arrow is drawn straight from one slot's
	// home_feeder_id / away_feeder_id, which is what the slot actually reads
	// when the draw resolves. There is no second model of progression here to
	// get out of step with the first: repoint a slot and the arrow moves,
	// because the arrow *is* the slot's source.
	//
	// Drawn as one SVG laid over the bracket rather than per-fixture borders,
	// because an arrow crosses between columns and an inserted empty round
	// means it may cross more than one.
	// ─────────────────────────────────────────────────────────────────

	const SVG_NS = 'http://www.w3.org/2000/svg';

	// Redrawing is measurement, so it has to happen after layout and again
	// whenever layout changes. Coalesced into a frame: a resize fires dozens
	// of times and each redraw reads every fixture's box.
	let arrowFrame = 0;

	function redrawArrowsSoon() {
		if (arrowFrame) return;
		arrowFrame = requestAnimationFrame(() => { arrowFrame = 0; drawArrows(); });
	}

	function drawArrows() {
		const old = els.bracket.querySelector('.bracket-arrows');
		if (old) old.remove();
		if (!fixtures.length) return;

		const host = els.bracket.getBoundingClientRect();
		// Zero while the page is hidden or mid-layout. Measuring then puts
		// every arrow at the origin, so the draw is skipped and retried.
		if (!host.width || !host.height) return;

		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('class', 'bracket-arrows'
			+ (tournament && tournament.progression === 'manual' ? ' by-hand' : ''));
		svg.setAttribute('width', String(els.bracket.scrollWidth));
		svg.setAttribute('height', String(els.bracket.scrollHeight));

		// One marker, referenced by every path. Defined inline because the
		// page has no shared SVG sprite and a marker per arrow is waste.
		svg.append(arrowHead('tdc-arrow', 'head'), arrowHead('tdc-arrow-dim', 'head dim'));

		let drawn = 0;
		for (const f of fixtures) {
			for (const which of ['home', 'away']) {
				const feeder = which === 'home' ? f.home_feeder_id : f.away_feeder_id;
				if (!feeder) continue;

				const from = els.bracket.querySelector(`[data-fixture="${feeder}"]`);
				const to = els.bracket.querySelector(
					`[data-fixture="${f.fixture_id}"] [data-side="${which}"]`);
				if (!from || !to) continue;

				const a = from.getBoundingClientRect();
				const b = to.getBoundingClientRect();
				const x1 = a.right - host.left;
				const y1 = a.top + a.height / 2 - host.top;
				const x2 = b.left - host.left;
				const y2 = b.top + b.height / 2 - host.top;

				// An arrow that would run backwards means the TD has wired a
				// round to one above it. Legal, and the draw honours it, but a
				// curve drawn the usual way would read as pointing the wrong
				// way, so it is not hidden — it is marked.
				const back = x2 < x1;
				const source = which === 'home' ? f.home_source : f.away_source;
				const decided = !!(which === 'home' ? f.home_entrant_id : f.away_entrant_id);

				const path = document.createElementNS(SVG_NS, 'path');
				path.setAttribute('d', curve(x1, y1, x2, y2));
				path.setAttribute('class', 'bracket-arrow'
					+ (source === 'loser_of' ? ' loser' : '')
					+ (decided ? ' decided' : ' pending')
					+ (back ? ' backwards' : ''));
				path.setAttribute('marker-end',
					'url(#' + (decided ? 'tdc-arrow' : 'tdc-arrow-dim') + ')');

				// Clickable, because the arrow is the most direct way to say
				// "this, change where it comes from". pointer-events is off on
				// the svg and back on for the paths, so the arrows never eat a
				// click meant for a fixture underneath.
				if (!readOnly) {
					path.dataset.act = 'wiring';
					path.dataset.fixture = f.fixture_id;
					path.style.cursor = 'pointer';
					const title = document.createElementNS(SVG_NS, 'title');
					title.textContent = (source === 'loser_of' ? 'Loser' : 'Winner')
						+ ' of ' + fixtureName(
							which === 'home' ? f.home_feeder_bracket : f.away_feeder_bracket,
							which === 'home' ? f.home_feeder_round : f.away_feeder_round,
							which === 'home' ? f.home_feeder_position : f.away_feeder_position)
						+ ' — click to change';
					path.append(title);
				}
				svg.append(path);
				drawn++;
			}
		}

		if (drawn) els.bracket.append(svg);
	}

	// A flat-ended S. Control points pushed out horizontally by half the gap,
	// so the line leaves a fixture sideways and arrives sideways, which is
	// what makes a bracket readable rather than a plate of spaghetti.
	function curve(x1, y1, x2, y2) {
		const dx = Math.max(18, Math.abs(x2 - x1) / 2);
		return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
	}

	function arrowHead(id, cls) {
		const marker = document.createElementNS(SVG_NS, 'marker');
		marker.setAttribute('id', id);
		marker.setAttribute('class', cls);
		marker.setAttribute('viewBox', '0 0 8 8');
		marker.setAttribute('refX', '7');
		marker.setAttribute('refY', '4');
		marker.setAttribute('markerWidth', '6');
		marker.setAttribute('markerHeight', '6');
		marker.setAttribute('orient', 'auto-start-reverse');
		const tip = document.createElementNS(SVG_NS, 'path');
		tip.setAttribute('d', 'M 0 1 L 7 4 L 0 7 z');
		marker.append(tip);
		return marker;
	}

	// Arrows are measured, so anything that changes the layout has to redraw
	// them. Resize covers rotation and the window; the scroller does not need
	// one, because the svg is inside the scrolling content and moves with it.
	window.addEventListener('resize', redrawArrowsSoon);


	// ─────────────────────────────────────────────────────────────────
	// Adding and removing rounds and matches
	//
	// UV, 22 Oct: "TD can hover on the border between two rounds and then add
	// a round via a '+' button." The border is a real column of its own —
	// a zero-width one that widens on hover — rather than an overlay, so it
	// cannot land on top of a fixture and it survives the bracket scrolling.
	// ─────────────────────────────────────────────────────────────────

	function roundBorder(beforeRound) {
		const slot = node('div', 'bracket-border');
		const b = node('button', 'bracket-border-add', '+');
		b.type = 'button';
		b.dataset.act = 'insert-round';
		b.dataset.round = String(beforeRound);
		b.title = 'Put a round in here';
		slot.append(b);
		return slot;
	}

	function addRoundColumn(round) {
		const col = node('div', 'bracket-round bracket-round-new');
		const b = node('button', 'btn btn-secondary btn-sm', '+ Round');
		b.type = 'button';
		b.dataset.act = 'add-match';
		b.dataset.bracket = 'main';
		b.dataset.round = String(round);
		b.title = 'A round on the end, which moves nothing';
		col.append(b);
		return col;
	}

	function addMatchButton(bracket, round, empty) {
		const b = node('button', 'btn btn-secondary btn-sm bracket-add-match',
			empty ? '+ First match' : '+ Match');
		b.type = 'button';
		b.dataset.act = 'add-match';
		b.dataset.bracket = bracket;
		b.dataset.round = String(round);
		return b;
	}


	// ─────────────────────────────────────────────────────────────────
	// Where a slot comes from
	//
	// Opened by clicking an arrow, or by the Wiring button on a fixture. One
	// panel for both slots of a fixture rather than a control per slot: UV,
	// 21 Oct, had the swap button covering the names, and a third control in
	// each row would be the same mistake again.
	// ─────────────────────────────────────────────────────────────────

	let wiring = null;          // the fixture id whose wiring is open
	let wiringCandidates = [];

	async function openWiring(fixtureId) {
		wiring = fixtureId;
		wiringCandidates = [];
		renderWiring();
		els.wiring.hidden = false;
		els.wiring.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

		const { data, error } = await supabaseClient.rpc('tdc_fixture_source_candidates', {
			p_fixture_id: fixtureId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.wiringStatus); return; }
		// Still the same fixture? The TD may have closed it or opened another
		// while this was in flight.
		if (wiring !== fixtureId) return;
		wiringCandidates = data || [];
		renderWiring();
	}

	function closeWiring() {
		wiring = null;
		wiringCandidates = [];
		els.wiring.hidden = true;
		TDC.status(els.wiringStatus, '', '');
	}

	function renderWiring() {
		if (!wiring) return;
		const f = fixtures.find((x) => x.fixture_id === wiring);
		if (!f) { closeWiring(); return; }

		els.wiringHead.textContent = 'Where ' + fixtureName(f.bracket, f.round, f.position)
			+ ' comes from';
		els.wiringNote.textContent = f.match_id
			? 'This match has started, so its sides are settled. Detach the match to change the wiring.'
			: 'Pointing a slot at a match empties it, so the winner can move in when that match is decided.';

		els.wiringBody.replaceChildren(
			wiringRow(f, 'home'),
			wiringRow(f, 'away'));
	}

	function wiringRow(f, which) {
		const row = node('div', 'field');
		const id = 'wiring-' + which;

		const label = node('label', '', which === 'home' ? 'Top slot' : 'Bottom slot');
		label.htmlFor = id;

		const pick = node('select');
		pick.id = id;
		pick.dataset.side = which;
		pick.disabled = !!f.match_id;

		const source = which === 'home' ? f.home_source : f.away_source;
		const feeder = which === 'home' ? f.home_feeder_id : f.away_feeder_id;
		const entrant = which === 'home' ? f.home_entrant_id : f.away_entrant_id;

		pick.append(new Option('Nobody — leave it empty', '', false,
			!source));

		// Whoever is in it now, kept as an option so choosing something else
		// and changing your mind does not need the entrant picker.
		if (entrant) {
			const name = which === 'home' ? f.home_name : f.away_name;
			pick.append(new Option(name + ' (placed by hand)', 'entrant:' + entrant,
				false, source === 'entrant'));
		}

		for (const c of wiringCandidates) {
			for (const kind of ['winner_of', 'loser_of']) {
				const value = kind + ':' + c.fixture_id;
				const text = (kind === 'winner_of' ? 'Winner of ' : 'Loser of ')
					+ fixtureName(c.bracket, c.round, c.position)
					+ (c.decided ? ' (decided)' : '');
				pick.append(new Option(text, value, false,
					source === kind && feeder === c.fixture_id));
			}
		}

		const hint = node('div', 'hint');
		hint.textContent = feeder
			? 'Currently fed by a match.'
			: (entrant ? 'Currently a player put here by hand.' : 'Currently empty.');

		row.append(label, pick, hint);
		return row;
	}

	els.wiringSave.addEventListener('click', async () => {
		if (!wiring) return;
		const f = fixtures.find((x) => x.fixture_id === wiring);
		if (!f) { closeWiring(); return; }

		// One slot at a time, and only the ones that changed. Two calls would
		// be two rehearsals and two confirmations for one intention, so the
		// unchanged slot is left alone.
		const wanted = [];
		for (const which of ['home', 'away']) {
			const pick = els.wiring.querySelector(`[data-side="${which}"]`);
			if (!pick) continue;
			const [kind, ref] = (pick.value || ':').split(':');
			const source = which === 'home' ? f.home_source : f.away_source;
			const current = which === 'home'
				? (f.home_feeder_id || f.home_entrant_id)
				: (f.away_feeder_id || f.away_entrant_id);
			if ((kind || null) === (source || null) && (ref || null) === (current || null)) continue;
			wanted.push({ side: which, kind: kind || null, ref: ref || null });
		}

		if (!wanted.length) {
			TDC.status(els.wiringStatus, 'Nothing changed.', '');
			return;
		}

		TDC.status(els.wiringStatus, 'Checking…', '');

		// Rehearse every change first, so the TD confirms once against the
		// whole thing rather than being asked twice halfway through.
		const fixtureId = wiring;
		const answers = await rehearse('wiring', async () => {
			const got = [];
			for (const w of wanted) {
				const r = await supabaseClient.rpc('tdc_set_fixture_source', {
					p_fixture_id: fixtureId,
					p_side: w.side,
					p_source_type: w.kind,
					p_source_ref: w.ref
				});
				got.push(r);
				if (r.error) break;
			}
			return got;
		});
		if (!answers) return;
		const lines = [];
		for (const [i, w] of wanted.entries()) {
			if (!answers[i]) break;
			const { data, error } = answers[i];
			if (error) { TDC.showSupabaseError(AREA, error, els.wiringStatus); return; }
			if (data && data.note) continue;
			lines.push(`${w.side === 'home' ? 'Top' : 'Bottom'} slot: ${data.from} → ${data.to}`
				+ (data.displaces ? `\n  turns ${data.displaces} out of it` : '')
				+ (data.award_cleared && data.award_cleared.entrant
					? `\n  clears the bye that sent ${data.award_cleared.entrant} through` : ''));
		}

		if (!lines.length) { TDC.status(els.wiringStatus, 'Nothing changed.', ''); return; }
		if (!confirm(lines.join('\n\n') + '\n\nGo ahead?')) {
			TDC.status(els.wiringStatus, '', '');
			return;
		}

		const todo = wanted.slice();
		closeWiring();
		await write('Rewiring', async () => {
			for (const w of todo) {
				const r = await supabaseClient.rpc('tdc_set_fixture_source', {
					p_fixture_id: f.fixture_id,
					p_side: w.side,
					p_source_type: w.kind,
					p_source_ref: w.ref,
					p_apply: true
				});
				if (r.error) return r;
			}
			return { error: null };
		});
	});

	els.wiringCancel.addEventListener('click', closeWiring);

	// Both of these rehearse, so the TD is told what moves before it moves.
	// Renumbering is the one operation here that touches rounds a TD is not
	// looking at.
	async function insertRound(before) {
		TDC.status(els.status, 'Checking\u2026', '');
		const args = { p_tournament_id: tournamentId, p_before_round: before, p_bracket: 'main' };
		const checked = await rehearse('insert-round', () => supabaseClient.rpc('tdc_insert_round', args));
		if (!checked) return;
		const { data, error } = checked;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const lines = [`A new empty round goes in at ${before}.`, ''];
		lines.push(`${data.fixtures_renumbered} match(es) move up a round`
			+ (data.round_rules_moved
				? `, and ${data.round_rules_moved} round(s) take their own rules with them.` : '.'));
		if (data.matches_in_play > 0) {
			lines.push('');
			lines.push(`${data.matches_in_play} match(es) being played change number only \u2014 `
				+ 'their rules and their frames are untouched.');
		}
		lines.push('', 'Go ahead?');
		if (!confirm(lines.join('\n'))) { TDC.status(els.status, '', ''); return; }

		await write('Inserting the round', () =>
			supabaseClient.rpc('tdc_insert_round', Object.assign({}, args, { p_apply: true })));
	}

	async function removeFixture(id) {
		TDC.status(els.status, 'Checking\u2026', '');
		const checked = await rehearse('remove-' + id, () => supabaseClient.rpc('tdc_remove_fixture', { p_fixture_id: id }));
		if (!checked) return;
		const { data, error } = checked;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		// Anything still wired to it has to be repointed first. Said with the
		// list, because "something depends on this" without naming what is an
		// error message that makes the TD go looking.
		const feeds = data.feeds || [];
		if (feeds.length) {
			alert('This match still feeds:\n\n'
				+ feeds.map((x) => '  ' + fixtureName('main', x.round, x.position)
					+ ' (' + (x.side === 'home' ? 'top' : 'bottom') + ' slot)').join('\n')
				+ '\n\nPoint those somewhere else first.');
			TDC.status(els.status, '', '');
			return;
		}

		if (!confirm(`Take ${fixtureName('main', data.round, data.position)} out of the draw?`)) {
			TDC.status(els.status, '', '');
			return;
		}
		await write('Removing the match', () =>
			supabaseClient.rpc('tdc_remove_fixture', { p_fixture_id: id, p_apply: true }));
	}

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
			const where = fixtureName(c.bracket, c.round, c.position);
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
	// Queued, never refused (TDC.writer): resolve after, then re-read, once a
	// burst has saved. The server owns the bracket.
	const drawWriter = TDC.writer({
		area: AREA, status: els.status,
		reload: async () => {
			await resolve();
			const ok = await loadDraw();
			if (ok) {
				// The tournament row too, not just the draw: the two run settings
				// live on it, and a save that did not re-read would leave the
				// selects showing what was asked for rather than what was stored.
				await loadTournament();
				await loadStatus();
				await checkDrift();
			}
			return ok;
		}
	});
	function write(what, fn) { return drawWriter.write(what, fn); }

	// A rehearsal (the database says what would change and the TD confirms)
	// waits its turn behind any save still going, so it is asked about the
	// draw as it will be. A second press of the same button while its check
	// is still out is the same press: it gets null and stops, so no second
	// question is asked.
	const checking = new Set();
	async function rehearse(key, fn) {
		if (checking.has(key)) return null;
		checking.add(key);
		try { return await TDC.queued(fn); }
		finally { checking.delete(key); }
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
		const confirmedOnly = els.who.value === 'confirmed';

		TDC.status(els.status, 'Redrawing…', '');
		const tried = await rehearse('redraw', () => supabaseClient.rpc('tdc_generate_draw', {
			p_tournament_id: tournamentId,
			p_confirmed_only: confirmedOnly,
			p_replace: true
		}));
		if (!tried) return;
		const { error } = tried;

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

		if (button.dataset.act === 'round-rules') {
			openRoundRules(button.dataset.bracket, parseInt(button.dataset.round, 10));
			return;
		}

		if (button.dataset.act === 'wiring') {
			openWiring(id);
			return;
		}

		if (button.dataset.act === 'add-match') {
			write('Adding the match', () =>
				supabaseClient.rpc('tdc_add_fixture', {
					p_tournament_id: tournamentId,
					p_round: parseInt(button.dataset.round, 10),
					p_bracket: button.dataset.bracket
				}));
			return;
		}

		if (button.dataset.act === 'insert-round') {
			insertRound(parseInt(button.dataset.round, 10));
			return;
		}

		if (button.dataset.act === 'remove-fixture') {
			removeFixture(id);
			return;
		}

		if (button.dataset.act === 'swap') {
			swapping = { fixtureId: id, side: button.dataset.side };
			entering = null;
			candidates = [];
			render();
			loadCandidates(id);
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
		// typed-in score must not be thrown away under the TD's hands. Nor a
		// half-made swap: the picker holds a chosen name and a typed reason.
		clearTimeout(liveTimer);
		liveTimer = setTimeout(() => {
			if (drawWriter.pending || checking.size || entering || swapping || editingRound || wiring) return;
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
