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
// Since 5 Nov (UV) the Draw tab of the tournament's one page
// (tournament-nav.js; _includes/tournament/draw.html): started the first
// time the tab opens, read again when it is shown again. The third-place
// playoff and the two run settings (moving between rounds, starting
// matches) moved to the Settings tab then (UV: each setting in one place).
//
// Needs: tdc.js, tournament-nav.js.

TDCTournamentNav.panel('draw', () => {
	const AREA = 'Draw';

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('t-name'), meta: el('t-meta'),
		setup: el('setup'), who: el('who'), whoHint: el('who-hint'),
		sizeField: el('size-field'), drawSize: el('draw-size'),
		running: el('running'), generate: el('generate'),
		bracket: el('bracket'), actions: el('draw-actions'),
		viewRow: el('view-row'), fullNames: el('full-names'),
		fontSize: el('font-size'), zoom: el('zoom'), gapV: el('gap-v'), gapH: el('gap-h'),
		resolve: el('resolve'), redraw: el('redraw'),
		status: el('page-status'),
		statusRow: el('status-row'), statusSelect: el('t-status'), statusHint: el('status-hint'),
		drift: el('drift'), driftIntro: el('drift-intro'),
		driftList: el('drift-list'), driftApply: el('drift-apply'),
		roundRules: el('round-rules'), roundRulesHead: el('round-rules-head'),
		roundRulesNote: el('round-rules-note'), roundRulesMain: el('round-rules-main'),
		roundRulesRest: el('round-rules-rest'), roundRulesLater: el('round-rules-later'),
		roundRulesSave: el('round-rules-save'), roundRulesClear: el('round-rules-clear'),
		roundRulesCancel: el('round-rules-cancel'), roundRulesStatus: el('round-rules-status'),
		entrants: el('entrants'), entrantPills: el('entrant-pills'),
		stage: el('stage'), fit: el('fit'), full: el('full'), resetView: el('reset-view'),
		populate: el('populate'), shuffle: el('shuffle')
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
		// Playing is said by the yellow strip alone (UV, 5 Nov), not a badge.
		in_progress: { label: '', cls: '' },
		awaiting:    { label: 'Not agreed yet', cls: 'warn' },
		disputed:    { label: 'Disputed', cls: 'disputed' },
		agreed:      { label: '', cls: '' },
		approved:    { label: '', cls: '' }
	};
	const AWARD = {
		bye: 'Bye', walkover: 'Walkover', withdrawal: 'Withdrew', decision: 'Awarded'
	};
	// A fixture's state, as the strip down the left of its card, in the
	// league fixtures' and the profile's colours (UV, 5 Nov; .fx-state-* in
	// league.css). An award (walkover, withdrawal, decision) is settled, so
	// it reads Finished; a bye has no strip, as a league bye has none.
	const STATE = {
		none: 'Not started', scheduled: 'Match made', in_progress: 'Playing',
		complete: 'Finished', abandoned: 'Abandoned'
	};
	// Every match that exists and is not over is active, and yellow (UV,
	// 5 Nov, said twice): a match is made when its table is called, so a
	// made match is a match being played. Green is for finished only.
	const stateOf = (f) => f.advance_reason === 'bye' ? 'bye'
		: f.match_id
			? (f.match_status === 'complete' || f.match_status === 'abandoned' ? f.match_status : 'in_progress')
		: f.advanced_entrant_id ? 'complete' : 'none';
	// Display name (the default) or full name, per device (UV, 5 Nov: the
	// standings' Full names switch). A player with neither name keeps theirs.
	const NAMES_KEY = 'tdc.draw.names';
	let fullNames = false;
	try { fullNames = localStorage.getItem(NAMES_KEY) === 'full'; } catch (err) { /* private window: display names */ }
	els.fullNames.checked = fullNames;
	const nameOf = (f, which) => which === 'home'
		? (fullNames && f.home_full_name) || f.home_name
		: (fullNames && f.away_full_name) || f.away_name;
	// How the draw is laid out, per device (UV, 5 Nov). The toggles: flow,
	// linear or from the outside in (the final in the middle); rounds, as
	// columns (side by side) or rows (one under another); card, a card's
	// players stacked or across (side by side, as a league fixture); pics,
	// players' pictures shown or hidden. And four numbers: font, the size of
	// the draw's text (50–300%), and zoom, the size of the whole draw
	// (25–300%), any whole number (UV, 5 Nov: so a view can be made to fit
	// any screen); gapV and gapH, the space between cards down and across
	// the page (0–64px; UV, 5 Nov).
	const VIEW_KEY = 'tdc.draw.view';
	const VIEW_DEFAULT = { flow: 'linear', rounds: 'columns', card: 'stacked', pics: 'show', font: 100, zoom: 100, gapV: 8, gapH: 16 };
	const RANGE = { font: [50, 300, 1], zoom: [25, 300, 1], gapV: [0, 64, 1], gapH: [0, 64, 1] };
	let view = Object.assign({}, VIEW_DEFAULT);
	try { Object.assign(view, JSON.parse(localStorage.getItem(VIEW_KEY) || '{}')); } catch (err) { /* private window or unreadable: the defaults */ }
	for (const k of ['flow', 'rounds', 'card', 'pics']) {
		if (!els.viewRow.querySelector(`[data-view-key="${k}"][data-view="${view[k]}"]`)) view[k] = VIEW_DEFAULT[k];
	}
	// A number kept on its step and inside its range.
	const pct = (k, v) => {
		const [lo, hi, step] = RANGE[k];
		const n = Math.round(Number(v) / step) * step;
		return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : VIEW_DEFAULT[k];
	};
	for (const k of Object.keys(RANGE)) view[k] = pct(k, view[k]);
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
	let mayRun = false;
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
	// so on: the quarter-finals, then Last 16, Last 32 and on by the number of
	// players left (UV, 5 Nov). The moment the halving breaks — a prelim, an
	// odd field, a match added by hand — naming stops and everything below is
	// "Round n", which is both true and the thing a TD would say out loud.
	const LADDER = { 1: 'Final', 2: 'Semi-finals', 4: 'Quarter-finals' };
	const SHORT = { 1: 'Final', 2: 'SF', 4: 'QF' };
	function roundNames(main, lastRound) {
		const names = new Map();
		let expect = 1;

		for (let r = lastRound; r >= 1; r--) {
			const count = main.filter((f) => f.round === r).length;
			if (count !== expect) break;
			names.set(r, { long: LADDER[expect] || 'Last ' + expect * 2, short: SHORT[expect] || 'L' + expect * 2, one: expect === 1 });
			expect *= 2;
		}
		return names;
	}
	// The draw's round names as last drawn (render), so a card, a slot, a
	// warning and a heading all say the same name for a round (UV, 5 Nov).
	let roundLabels = new Map();

	// How a fixture is named to a person: its round as the heading names it,
	// then which match ("Quarter-finals · Match 2"; the Final and the playoff
	// alone, being one match). Not "1-1" — the short form is the schema's way
	// of identifying a fixture, and it was leaking into everything a TD
	// reads. Said in one place so the bracket, the swap warning and the drift
	// list cannot drift apart.
	function fixtureName(bracket, round, position) {
		if (bracket === 'third_place') return 'Third place';
		if (bracket && bracket !== 'main') {
			return bracket.replace(/_/g, ' ') + ' · Match ' + position;
		}
		const n = roundLabels.get(round);
		if (n && n.one) return n.long;
		return (n ? n.long : 'Round ' + round) + ' · Match ' + position;
	}
	// The short form, for a slot that says where its player comes from
	// ("Winner of QF 2"), inside a narrow card.
	function fixtureShort(bracket, round, position) {
		if (bracket === 'third_place') return 'Third place';
		if (bracket && bracket !== 'main') return fixtureName(bracket, round, position);
		const n = roundLabels.get(round);
		if (n && n.one) return n.short;
		return n ? n.short + ' ' + position : `R${round} · M${position}`;
	}

	// ─── A side of a fixture ───
	// A player's picture, from the public player-avatars bucket, or their
	// initials in a circle, as on the standings (UV, 5 Nov). A slot with
	// nobody in it has an empty circle, so the names still line up.
	function avatar(path, name) {
		if (!name) return node('span', 'person-pic bracket-pic-empty');
		const box = node('span', 'person-pic');
		const url = TDC.pictureUrl('player-avatars', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		return box;
	}

	function side(f, which) {
		const name = nameOf(f, which);
		const pic = which === 'home' ? f.home_avatar : f.away_avatar;
		const id = which === 'home' ? f.home_entrant_id : f.away_entrant_id;
		const frames = which === 'home' ? f.home_frames : f.away_frames;
		const source = which === 'home' ? f.home_source : f.away_source;
		const feederRound = which === 'home' ? f.home_feeder_round : f.away_feeder_round;
		const feederPos = which === 'home' ? f.home_feeder_position : f.away_feeder_position;

		const row = node('div', 'bracket-side');
		if (f.winner_entrant_id && id && f.winner_entrant_id === id) row.classList.add('won');

		// The row is a grid of fixed tracks — the player, the score — rather
		// than a flex line. 21 Oct: as a flex line the name was a shrinkable
		// item sharing space with a button, and on UV's screen it collapsed
		// to 0 x 20 and vanished, with the frame count left looking like the
		// player. A 1fr grid track cannot be squeezed to nothing by what sits
		// beside it, so the name is safe whatever else the row grows.
		// The picture inside the name's cell, first, so hiding pictures (the
		// view row) takes it out with nothing left to close up.
		// The picture opens the player's profile (UV, 5 Nov); the card round
		// it still opens the match.
		const nameCell = node('div', 'bracket-name-cell');
		nameCell.append(TDC.profilePic(avatar(pic, name), name && (which === 'home' ? f.home_player_id : f.away_player_id)));
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
			// Short form here on purpose: this sits inside a narrow card, and
			// the round's own heading spells the long form out, so "Winner of
			// QF 2" (or "R1 · M2" for an unnamed round) is unambiguous and fits.
			const feederBracket = which === 'home' ? f.home_feeder_bracket : f.away_feeder_bracket;
			const from = feederRound != null ? fixtureShort(feederBracket, feederRound, feederPos) : '?';
			label = (source === 'winner_of' ? 'Winner' : 'Loser') + ' of ' + from;
			pending = true;
		} else {
			// An empty slot that is not a bye (an empty draw, or a slot
			// emptied by hand) is waiting for the TD to put somebody in (UV,
			// 5 Nov). A bye's empty slot says nothing: only the player going
			// through is shown (UV, 5 Nov), and only a director, who can fill
			// it, sees the slot at all (fixture).
			label = f.advance_reason === 'bye' ? '' : 'Open';
			pending = true;
		}

		// No seed number beside the name (UV, 5 Nov).

		// The name as plain text, for a director too: who is in a slot is
		// changed by dragging (a pill onto it, or the player onto the bin), so
		// the swap icon and the name-as-button went (UV, 5 Nov). The name
		// and the frames fade when a re-read changes them (render).
		const slotKey = f.fixture_id + '|' + which;
		const shown = node('span', 'bracket-name' + (pending ? ' pending' : ''), label);
		// A full name with its surname lighter (UV, 12 Nov).
		const full = which === 'home' ? f.home_full_name : f.away_full_name;
		if (name && fullNames && full) shown.replaceChildren(TDC.fullName(full, which === 'home' ? f.home_surname : f.away_surname));
		shown.dataset.live = 'bn|' + slotKey;
		nameCell.append(shown);

		// A score only means something once there is a match behind it.
		if (f.match_id) {
			const shown = node('span', 'bracket-frames', String(frames ?? 0));
			shown.dataset.live = 'bf|' + slotKey;
			scoreCell.append(shown);
		}

		// Which slot this is, so an arrow has something to point at. The
		// progression overlay anchors to these rather than to the fixture box,
		// because a slot is what a source feeds — not the match.
		row.dataset.side = which;
		// For a director, a slot is also something to drag: onto a slot in
		// another round, it sends this match's winner there (dragging, below).
		if (!readOnly) row.dataset.drag = 'slot';

		row.append(nameCell, scoreCell);
		return row;
	}

	// ─── A fixture ───
	function fixture(f) {
		const box = node('div', 'bracket-fixture');
		box.dataset.fixture = f.fixture_id;

		// The state as a strip (UV, 5 Nov), as on the league fixtures and the
		// profile: down the left of a stacked card, along the top or bottom of
		// a side-by-side one (bracket.css). A finished match with a winner is
		// split in two, a part per player: green for the winner, grey for the
		// loser (UV, 5 Nov), each beside its player.
		const state = stateOf(f);
		const bye = f.advance_reason === 'bye';
		const strip = node('span', 'bracket-state');
		const winner = f.winner_entrant_id || f.advanced_entrant_id;
		if (state === 'complete' && winner && !bye) {
			strip.classList.add('split');
			for (const which of ['home', 'away']) {
				const id = which === 'home' ? f.home_entrant_id : f.away_entrant_id;
				strip.append(node('span', 'bracket-seg fx-state-' + (id && id === winner ? 'complete' : 'none')));
			}
			const won = nameOf(f, winner === f.home_entrant_id ? 'home' : 'away');
			strip.title = 'Finished' + (won ? ': ' + won + ' won' : '');
		} else if (!bye) {
			strip.append(node('span', 'bracket-seg fx-state-' + state));
			strip.title = STATE[state] || state;
		}
		if (strip.title) strip.append(node('span', 'visually-hidden', strip.title));
		const body = node('div', 'bracket-body');
		box.append(strip, body);

		// UV, 21 Oct: "Instead of just showing 1-2 or 1-1 on matches in the
		// tournament view, show Round 1 - Match 1". The short form was the
		// schema's way of naming a fixture, not a person's.
		body.append(node('div', 'bracket-no', fixtureName(f.bracket, f.round, f.position)));
		// For a director, a red cross in a ring on every card's top right
		// corner, over its edge rather than inside it (UV, 5 Nov): take the
		// match out of the draw. It checks first (removeFixture), and the
		// database still refuses a match that has been started (its frames
		// were really played) or one a later slot is wired to.
		if (!readOnly) {
			const x = node('button', 'fx-icon bracket-remove');
			x.type = 'button';
			x.dataset.act = 'remove-fixture';
			x.dataset.fixture = f.fixture_id;
			x.title = 'Take ' + fixtureName(f.bracket, f.round, f.position) + ' out of the draw';
			x.setAttribute('aria-label', x.title);
			const face = node('span', 'tdc-ring');
			face.innerHTML = TDCRing.svg();
			x.append(face);
			box.append(x);
		}

		// A bye shows only the player going through (UV, 5 Nov). A director
		// still gets the empty slot, its swap icon alone, because that is how
		// a late arrival is put into it.
		// The two sides in one box, a colon between them that shows only
		// when they sit side by side (bracket.css, data-card="across").
		const sides = node('div', 'bracket-sides' + (f.match_id ? ' scored' : ''));
		for (const which of ['home', 'away']) {
			const empty = !(which === 'home' ? f.home_entrant_id : f.away_entrant_id);
			if (bye && empty && readOnly) continue;
			if (which === 'away' && sides.childElementCount) sides.append(node('span', 'bracket-colon', ':'));
			sides.append(side(f, which));
		}
		body.append(sides);

		// The way into the match, for everybody: the card itself (UV, 5 Nov),
		// anywhere on it but its buttons and names (openCard). It was an
		// "Open match" button until then, and inside the TD's controls before
		// 20 Oct, which left a player looking at their own final with no way
		// to open it. The match page decides for itself what a visitor may do.
		if (f.match_id) {
			box.classList.add('bracket-link');
			box.dataset.match = f.match_id;
			box.tabIndex = 0;
			box.setAttribute('role', 'link');
			box.setAttribute('aria-label', 'Open the match: '
				+ (nameOf(f, 'home') || '?') + ' ' + (f.home_frames ?? 0) + ' : '
				+ (f.away_frames ?? 0) + ' ' + (nameOf(f, 'away') || '?'));
		}

		const tags = node('div', 'bracket-tags');
		// A bye says nothing (UV, 5 Nov): the lone player is the whole story.
		if (f.advance_reason && !bye) {
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
		if (tags.childElementCount) body.append(tags);

		if (!readOnly) {
			if (swapping && swapping.fixtureId === f.fixture_id) body.append(swapForm(f));
			else if (entering === f.fixture_id) body.append(scoreForm(f));
			else body.append(controls(f));
		}
		return box;
	}

	// A card with a match opens it (UV, 5 Nov): a click anywhere on it but
	// its buttons, names and forms, or Enter while it has focus.
	function openCard(e) {
		if (e.target.closest('button, a, input, select, textarea, label, .bracket-entry')) return;
		const box = e.target.closest('.bracket-fixture[data-match]');
		if (!box) return;
		location.href = '/match/?id=' + encodeURIComponent(box.dataset.match);
	}
	els.bracket.addEventListener('click', openCard);
	els.bracket.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && e.target.matches('.bracket-fixture[data-match]')) openCard(e);
	});

	els.fullNames.addEventListener('change', () => {
		fullNames = els.fullNames.checked;
		try { localStorage.setItem(NAMES_KEY, fullNames ? 'full' : 'display'); } catch (err) { /* kept for this visit only */ }
		render();
		renderEntrants();
	});

	// The view toggles: each press sets its key, is kept, and the bracket is
	// drawn again, arrows included (they are measured from the new layout).
	function applyView() {
		for (const b of els.viewRow.querySelectorAll('[data-view-key]')) {
			b.setAttribute('aria-pressed', String(view[b.dataset.viewKey] === b.dataset.view));
		}
		els.bracket.dataset.flow = view.flow;
		els.bracket.dataset.rounds = view.rounds;
		els.bracket.dataset.card = view.card;
		els.bracket.dataset.pics = view.pics;
		applySizes();
	}
	// The numbers change no markup, so they set properties on the bracket
	// and the arrows are measured again; nothing is drawn afresh.
	const SIZE_INPUTS = [[els.fontSize, 'font'], [els.zoom, 'zoom'], [els.gapV, 'gapV'], [els.gapH, 'gapH']];
	function applySizes() {
		els.bracket.style.setProperty('--bracket-font', String(view.font / 100));
		els.bracket.style.setProperty('--bracket-zoom', String(view.zoom / 100));
		els.bracket.style.setProperty('--gap-v', view.gapV + 'px');
		els.bracket.style.setProperty('--gap-h', view.gapH + 'px');
		// The arrows' lines and heads grow with the text (UV, 5 Nov), as the
		// text is drawn: its size times the zoom (the arrows are outside the
		// zoomed lane, so the zoom is not applied to them otherwise).
		els.bracket.style.setProperty('--arrow-scale', String(view.font / 100 * view.zoom / 100));
		for (const [input, k] of SIZE_INPUTS) {
			if (String(input.value) !== String(view[k])) input.value = view[k];
		}
	}
	const keepView = () => {
		try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (err) { /* kept for this visit only */ }
	};
	els.viewRow.addEventListener('click', (e) => {
		const b = e.target.closest('[data-view-key]');
		if (!b || view[b.dataset.viewKey] === b.dataset.view) return;
		view[b.dataset.viewKey] = b.dataset.view;
		keepView();
		render();
	});
	for (const [input, k] of SIZE_INPUTS) {
		const take = () => {
			if (input.value === '') return;   // mid-typing
			const v = pct(k, input.value);
			if (v === view[k]) return;
			view[k] = v;
			keepView();
			applySizes();
			redrawArrowsSoon();
		};
		input.addEventListener('input', take);
		input.addEventListener('change', () => { take(); applySizes(); });
	}

	// ─── Fit, and full screen (UV, 5 Nov) ───
	// Fit keeps the toggles and makes the text as big as it can be with
	// every card still on the screen (UV, 5 Nov: how a director puts the
	// draw on a big screen without touching a setting). The zoom goes back to
	// 100% and the text size is found by halving the range until it fits,
	// any whole number from 50% to 300%; the spacing grows with it, so the
	// draw keeps its proportions. Only if even 50% text is too big does the
	// zoom come down. It measures the draw itself: the cards, headings and
	// buttons, not the lane, which is as wide as the page.
	function fitAll() {
		const lanes = els.bracket.querySelector('.bracket-lanes');
		if (!lanes) return;
		const sc = els.bracket.parentElement;
		const full = isFull();
		const room = {
			w: (full ? els.stage.clientWidth - 32 : sc.clientWidth) - 8,
			// The screen's height, less the stage's own padding when full
			// (the bar there hides itself, so it takes no room).
			h: (full ? els.stage.clientHeight - 32 : innerHeight) - 24
		};
		const measure = () => {
			const z = view.zoom / 100;
			let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
			for (const e of lanes.querySelectorAll('.bracket-fixture, .bracket-round-name, .bracket-round-empty, .bracket-round-tools, .bracket-border, .bracket-round-new')) {
				const rc = e.getBoundingClientRect();
				if (!rc.width && !rc.height) continue;
				l = Math.min(l, rc.left); t = Math.min(t, rc.top);
				r = Math.max(r, rc.right); b = Math.max(b, rc.bottom);
			}
			return { w: (r - l) / z, h: (b - t) / z };
		};
		const clampGap = (k, v) => Math.max(RANGE[k][0], Math.min(RANGE[k][1], Math.round(v)));
		const at = (font) => {
			view.font = font;
			view.gapV = clampGap('gapV', 6 * font / 100);
			view.gapH = clampGap('gapH', 14 * font / 100);
			applySizes();
			return measure();
		};
		const fits = (n) => n.w > 0 && n.h > 0 && n.w <= room.w && n.h <= room.h;
		view.zoom = 100;
		const [lo0, hi0] = RANGE.font;
		const small = at(lo0);
		if (!(small.w > 0 && small.h > 0)) return;
		if (fits(small)) {
			let lo = lo0, hi = hi0 + 1;
			while (hi - lo > 1) {
				const mid = Math.floor((lo + hi) / 2);
				if (fits(at(mid))) lo = mid; else hi = mid;
			}
			at(lo);
		} else {
			// The smallest text still too big: the zoom takes the rest.
			const z = Math.min(room.w / small.w, room.h / small.h);
			view.zoom = Math.max(RANGE.zoom[0], Math.floor(z * 100));
		}
		keepView();
		applySizes();
		drawArrows();
		// What was fitted is what is seen: in full screen the draw is centred
		// in the stage already; otherwise its top goes to the top of the page.
		if (!full) window.scrollTo({ top: sc.getBoundingClientRect().top + scrollY - 8 });
	}
	els.fit.addEventListener('click', fitAll);

	// Reset (UV, 5 Nov): every view setting back to how the page first
	// shows the draw, toggles and numbers alike. Full names is its own
	// switch and is left alone.
	els.resetView.addEventListener('click', () => {
		view = Object.assign({}, VIEW_DEFAULT);
		keepView();
		render();
	});

	// Full screen: the stage alone on the screen. Where the browser has no
	// full screen for a page element (an iPhone), the stage covers the page
	// instead; Escape or the button again brings it back.
	const canFull = !!(els.stage.requestFullscreen || els.stage.webkitRequestFullscreen);
	const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement)
		|| els.stage.classList.contains('is-full');
	function showFull() {
		const on = isFull();
		els.full.setAttribute('aria-pressed', String(on));
		els.full.title = on ? 'Leave full screen' : 'Full screen';
		els.full.setAttribute('aria-label', els.full.title);
		document.documentElement.classList.toggle('bracket-full', els.stage.classList.contains('is-full'));
		if (on) showBar();
		else { clearTimeout(barTimer); els.viewRow.classList.remove('is-hidden'); }
		redrawArrowsSoon();
	}

	// In full screen the view row is a bar along the top that hides itself
	// (UV, 5 Nov: like the nav bar). It shows on going full screen, when the
	// pointer or a finger comes near the top, on a long scroll up (200px, as
	// the nav) or on tabbing into it; it hides on a long scroll down, or
	// after 3 seconds with nobody over it, since a fitted draw never
	// scrolls.
	const BAR_NEAR = 64, BAR_MS = 3000, BAR_SCROLL = 200;
	let barTimer = 0;
	function showBar() {
		els.viewRow.classList.remove('is-hidden');
		clearTimeout(barTimer);
		barTimer = setTimeout(hideBar, BAR_MS);
	}
	function hideBar() {
		if (!isFull()) return;
		// Kept while the pointer is over it, or a keyboard is in it. Not for
		// focus left behind by a click (Fit keeps its focus), or the bar
		// would never go.
		if (els.viewRow.matches(':hover, :has(:focus-visible)')) { barTimer = setTimeout(hideBar, BAR_MS); return; }
		els.viewRow.classList.add('is-hidden');
	}
	els.stage.addEventListener('mousemove', (e) => { if (isFull() && e.clientY < BAR_NEAR) showBar(); });
	els.stage.addEventListener('touchstart', (e) => {
		if (isFull() && e.touches[0] && e.touches[0].clientY < BAR_NEAR) showBar();
	}, { passive: true });
	els.viewRow.addEventListener('focusin', () => { if (isFull()) showBar(); });
	let barY = 0, barUp = 0, barDown = 0;
	els.stage.addEventListener('scroll', () => {
		if (!isFull()) return;
		const y = Math.max(0, els.stage.scrollTop);
		const dy = y - barY;
		barY = y;
		if (y <= 4) { barUp = 0; barDown = 0; showBar(); return; }
		if (dy > 0) { barUp = 0; barDown += dy; if (barDown >= BAR_SCROLL) { clearTimeout(barTimer); els.viewRow.classList.add('is-hidden'); } }
		else if (dy < 0) { barDown = 0; barUp -= dy; if (barUp >= BAR_SCROLL) showBar(); }
	}, { passive: true });
	els.full.addEventListener('click', async () => {
		if (isFull()) {
			if (els.stage.classList.contains('is-full')) els.stage.classList.remove('is-full');
			else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
		} else if (canFull) {
			try {
				await (els.stage.requestFullscreen || els.stage.webkitRequestFullscreen).call(els.stage);
			} catch (err) {
				// Refused (a permission, an iframe): cover the page instead.
				console.error('[Draw] full screen was refused, covering the page instead:', err);
				els.stage.classList.add('is-full');
			}
		} else {
			els.stage.classList.add('is-full');
		}
		showFull();
	});
	document.addEventListener('fullscreenchange', showFull);
	document.addEventListener('webkitfullscreenchange', showFull);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && els.stage.classList.contains('is-full') && !drag) {
			els.stage.classList.remove('is-full');
			showFull();
		}
	});

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

		// Taking a match out of the draw is the red cross on the card's
		// heading line since 5 Nov (UV), on every card; it was a Remove button
		// here, offered only before a match existed. Where a match's slots
		// come from is changed by dragging (UV, 5 Nov).

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
			node('span', 'bracket-entry-v', ':'),
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

		// Until the entrants are read the box holds only its heading, with the
		// dots on it (UV, 29 Oct: never a loading message).
		if (candidates.length) {
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
			go.addEventListener('click', () => trySwap(f, pick.value || null, why.value, go));

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

	async function trySwap(f, entrantId, why, button) {
		TDC.status(els.status, '', '');

		const args = {
			p_fixture_id: f.fixture_id,
			p_side: swapping.side,
			p_entrant_id: entrantId,
			p_reason: why && why.trim() ? why.trim() : null
		};

		// The rehearsal. p_apply defaults to false, so this changes nothing.
		const checked = await TDC.busy(button, rehearse('swap', () => supabaseClient.rpc('tdc_swap_fixture_player', args)), els.status);
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

	// The director's controls show on Run the draw alone; on Draw whoever runs
	// the tournament sees what a player sees (UV, 10 Nov). True if that changed.
	function applyMode() {
		const was = readOnly;
		readOnly = !mayRun || !TDCTournamentNav.managing();
		return was !== readOnly;
	}

	// What only the director's view needs, read as it opens.
	async function editingReads() {
		// The pills, read once: dragging changes the draw, not who entered.
		// Read with no draw too, so they are there once one is generated.
		await loadEntrants();
		// Catches up anything decided on somebody else's phone. Only worth
		// a second read when there was actually a draw to resolve.
		if (fixtures.length) {
			await resolve();
			await loadDraw();
			await checkDrift();
		}
		// Generate the draw is there with a draw too (UV, 5 Nov), so its
		// count of who would go in is always wanted.
		await describeField();
	}

	// ─── The whole bracket ───
	function render() {
		// The director's two groups at the foot, always (UV, 5 Nov). Generate
		// opens by itself while there is no draw, and folds when one appears;
		// after that it is left as the director leaves it.
		const drawn = !!fixtures.length;
		els.setup.hidden = readOnly;
		els.running.hidden = readOnly;
		if (drawn !== setupFor) { els.setup.open = !drawn; setupFor = drawn; }
		els.generate.hidden = drawn;
		els.redraw.hidden = !drawn;
		els.populate.hidden = !drawn;
		els.shuffle.hidden = !drawn;
		els.actions.hidden = !drawn || readOnly;
		els.viewRow.hidden = !fixtures.length;
		els.entrants.hidden = !fixtures.length || readOnly;
		applyView();
		// A read-only viewer's sides have no swap column (bracket.css).
		els.bracket.classList.toggle('bracket-ro', readOnly);

		if (!fixtures.length) {
			els.bracket.replaceChildren(node('div', 'empty', readOnly
				? 'The draw for this tournament has not been made yet.'
				: 'No draw yet. Set it up under Generate the draw, below.'));
			return;
		}

		const main = fixtures.filter((f) => f.bracket === 'main');
		const lastRound = Math.max(...main.map((f) => f.round));
		const names = roundNames(main, lastRound);
		// Kept for fixtureName, before any card is drawn, so the cards'
		// names are the headings' names.
		roundLabels = names;
		const third = fixtures.filter((f) => f.bracket === 'third_place');

		// A round's column (a row when the rounds run downwards): its heading,
		// then its cards in a box of their own, so the rows view can lay them
		// across while the heading stays above.
		function roundColumn(r, list, { addMatch, empty } = {}) {
			const col = node('div', 'bracket-round');
			col.dataset.round = String(r);
			col.dataset.bracket = 'main';

			const head = node('h2', 'bracket-round-name', names.has(r) ? names.get(r).long : 'Round ' + r);
			col.append(head);
			// Under the round's heading, the director's two buttons for the
			// round (UV, 5 Nov): + Match and its rules, alike, turned with the
			// heading in rows. Not among the cards, so the cards alone are
			// spread and centred in their round (bracket.css).
			if (!readOnly) col.append(roundTools(roundRulesButton('main', r), addMatch && addMatchButton('main', r, list.length === 0)));

			const cards = node('div', 'bracket-round-cards');
			if (list.length) cards.append(...list.map(fixture));
			else if (empty) cards.append(node('div', 'bracket-round-empty', 'Empty round'));
			col.append(cards, mirrorOf(head));
			return col;
		}

		// Third place sits beside the final rather than after it, because that
		// is where it is played.
		function thirdColumn() {
			const col = node('div', 'bracket-round');
			const tpHead = node('h2', 'bracket-round-name', 'Third place');
			// Was rest[0] — an identifier that does not exist in this scope, so
			// a TD opening a bracket with a third-place playoff got a
			// ReferenceError and no bracket at all. Introduced 22 Oct with the
			// round-rules button and caught while building the arrows.
			col.append(tpHead);
			if (!readOnly) col.append(roundTools(roundRulesButton(third[0].bracket, third[0].round)));
			const cards = node('div', 'bracket-round-cards');
			cards.append(...third.map(fixture));
			col.append(cards, mirrorOf(tpHead));
			return col;
		}

		function roundTools(...buttons) {
			const row = node('div', 'bracket-round-tools');
			row.append(...buttons.filter(Boolean));
			return row;
		}

		// In rows a round's name runs up its left side and down its right
		// (UV, 5 Nov); this is the right-hand one, the words alone (its
		// buttons are on the left). Hidden in columns (bracket.css), and
		// from a screen reader always: the left one says it.
		function mirrorOf(head) {
			// An h2 like the left one, so it takes the same heading face.
			const m = node('h2', 'bracket-round-name is-mirror', head.firstChild ? head.firstChild.textContent : '');
			m.setAttribute('aria-hidden', 'true');
			return m;
		}

		const columns = [];
		if (view.flow === 'outside') {
			// From the outside in (UV, 5 Nov): each half of the draw at its
			// own end, round 1 outermost, the final and third place in the
			// middle. Which half a match is in follows where it leads (UV:
			// "follow the arrows"), worked out in halves().
			//
			// Editing the draw's shape (a round put in, a match added) is
			// offered on the left half only: an inserted round is one round,
			// and two "+" for it would be two ways to say the same thing. A
			// round on the end belongs to the linear view.
			const half = halves(main, lastRound);
			const on = (r, s) => main.filter((f) => f.round === r && half.get(f.fixture_id) === s);
			for (let r = 1; r < lastRound; r++) {
				const left = on(r, 'L');
				const inRound = main.some((f) => f.round === r);
				if (!readOnly) columns.push(roundBorder(r));
				if (left.length || !inRound) columns.push(roundColumn(r, left, { addMatch: true, empty: true }));
			}
			if (!readOnly) columns.push(roundBorder(lastRound));
			// The final and, under it (beside it in rows), the playoff, each a
			// round of its own inside the middle.
			const mid = node('div', 'bracket-round-mid');
			mid.append(roundColumn(lastRound, on(lastRound, 'M'), { addMatch: true, empty: true }));
			if (third.length) mid.append(thirdColumn());
			columns.push(mid);
			for (let r = lastRound - 1; r >= 1; r--) {
				const right = on(r, 'R');
				if (!right.length) continue;
				const col = roundColumn(r, right);
				// The right half's arrows come in from the far side, so a side
				// by side card's strip there sits on the other edge (bracket.css).
				for (const c of col.querySelectorAll('.bracket-fixture')) c.dataset.half = 'R';
				columns.push(col);
			}
		} else {
			// 1..lastRound, not the rounds that happen to have fixtures.
			// tdc_insert_round (20261022160000) renumbers and leaves a gap,
			// and the gap *is* the empty round — there is no rounds table for
			// it to be a row in. Skipping empty rounds here would make an
			// inserted round invisible and the one after it look like it
			// moved for no reason.
			for (let r = 1; r <= lastRound; r++) {
				// The border before this round, where a new one goes in.
				if (!readOnly) columns.push(roundBorder(r));
				columns.push(roundColumn(r, main.filter((f) => f.round === r), { addMatch: true, empty: true }));
			}

			// A round on the end moves nothing, so it is offered as a plain
			// add rather than an insert.
			if (!readOnly) columns.push(addRoundColumn(lastRound + 1));

			if (third.length) columns.push(thirdColumn());
		}

		// The rounds in a lane of their own, which is what the zoom scales;
		// the arrows are drawn beside it on the bracket, in plain screen
		// pixels, so nothing measured has to be divided by the zoom.
		const lanes = node('div', 'bracket-lanes');
		lanes.append(...columns);

		// A score or a name a re-read changed (a frame scored elsewhere, a
		// winner arriving in the next round) fades out and in (TDC.liveFade,
		// UV 29 Oct); the first draw fades nothing.
		const snap = bracketDrawn ? TDC.liveSnapshot(els.bracket) : null;
		els.bracket.replaceChildren(lanes);
		TDC.liveFade(els.bracket, snap);
		bracketDrawn = true;
		wakeCrosses();
		drawArrows();
	}
	let bracketDrawn = false;
	let setupFor = null;   // whether there was a draw when Generate was last opened or folded

	// The red crosses' rings, made once each card is on the page. Shown at
	// once rather than drawn in: the page is drawn again after every write,
	// and a dozen crosses redrawing themselves each time is noise.
	function wakeCrosses() {
		for (const b of els.bracket.querySelectorAll('.bracket-remove:not([data-awake])')) {
			b.dataset.awake = 'yes';
			try {
				b.tdcRing = new TDCRing.RingStatus(b.querySelector('.tdc-ring'), {
					icons: ['cross'],
					labels: { cross: b.title, empty: b.title, loading: 'Working' },
					initial: 'cross'
				});
			} catch (err) {
				TDC.error(AREA, 'a red cross could not be drawn', err);
			}
		}
	}

	// Which half of the draw each main-bracket match is in, for the outside
	// in view: 'M' for the last round (the final), else 'L' or 'R' by where
	// its winner goes (UV, 5 Nov: follow the arrows). A match feeding the
	// final's home slot is on the left, its away slot on the right, and
	// every match takes the half of the match it feeds. Only winner_of
	// counts: loser_of feeds the third-place playoff, which sits in the
	// middle anyway. A match that leads nowhere (a draw being edited) falls
	// back to its place in its round, the first half on the left.
	function halves(main, lastRound) {
		const half = new Map();
		const leads = new Map();
		for (const f of fixtures) {
			for (const which of ['home', 'away']) {
				const src = which === 'home' ? f.home_source : f.away_source;
				const from = which === 'home' ? f.home_feeder_id : f.away_feeder_id;
				if (src === 'winner_of' && from) leads.set(from, { to: f, slot: which });
			}
		}
		for (const f of main) if (f.round === lastRound) half.set(f.fixture_id, 'M');

		const sideOf = (f, seen) => {
			if (half.has(f.fixture_id)) return half.get(f.fixture_id);
			if (seen.has(f.fixture_id)) return null;   // wired in a loop
			seen.add(f.fixture_id);
			const l = leads.get(f.fixture_id);
			if (!l) return null;
			const there = sideOf(l.to, seen);
			const s = there === 'M' ? (l.slot === 'home' ? 'L' : 'R') : there;
			if (s) half.set(f.fixture_id, s);
			return s;
		};
		for (const f of main) sideOf(f, new Set());

		for (let r = 1; r < lastRound; r++) {
			const loose = main.filter((f) => f.round === r && !half.has(f.fixture_id));
			loose.forEach((f, i) => half.set(f.fixture_id, i < Math.ceil(loose.length / 2) ? 'L' : 'R'));
		}
		return half;
	}

	// ─── Reading ───
	async function loadTournament() {
		const { data, error } = await supabaseClient
			.from('tbl_tournaments')
			.select('id, name, format, status, starts_at, third_place, progression, create_matches, rules, max_entrants')   // rules: the round panel starts from the tournament's own ruleset; max_entrants: where an empty draw's size starts
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

		// Where it is played. A failure is said and the draw still shows.
		const places = await supabaseClient.rpc('tdc_tournament_venue_list', { p_tournament_id: tournamentId });
		if (places.error) TDC.showSupabaseError(AREA, places.error, els.status);
		TDC.venueHeading(els.meta, bits.join(' · '), places.data);
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

	// How the draw runs (moving between rounds, starting matches) was set
	// here, in Running the draw, until 5 Nov; it is on the Settings tab now
	// (tournament-settings.js; UV: each setting in one place).


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

		// A button like + Match, beside it under the round's heading (UV,
		// 5 Nov); it was a small badge inside the heading.
		const b = node('button', 'btn btn-secondary btn-sm bracket-tool bracket-round-rules' + (own ? ' differs' : ''));
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

		const control = (d) => TDCMatchDef.control(d, draftRules, 'rr');
		els.roundRulesMain.replaceChildren(
			...TDCMatchDef.layout(live.filter((d) => TDCMatchDef.MAIN_KEYS.includes(d.key)), control)
		);

		els.roundRulesRest.replaceChildren();
		for (const group of TDCMatchDef.GROUPS) {
			const defs = live.filter(
				(d) => d.group === group && !TDCMatchDef.MAIN_KEYS.includes(d.key));
			if (!defs.length) continue;

			const box = document.createElement('details');
			box.className = 'set-group';
			box.dataset.group = group;
			// The form is rebuilt whenever a setting changes, so a group that
			// was open has to be put back open — otherwise ticking a box folds
			// away the box you just ticked.
			box.open = openRuleGroups.has(group);
			box.addEventListener('toggle', () => {
				if (box.open) openRuleGroups.add(group); else openRuleGroups.delete(group);
			});

			const head = document.createElement('summary');
			head.textContent = group;
			box.append(head, ...TDCMatchDef.layout(defs, control));
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

		TDC.status(els.roundRulesStatus, '', '');

		const args = {
			p_tournament_id: tournamentId,
			p_round: round,
			p_rules: draftRules,
			p_bracket: bracket,
			p_and_later: later
		};

		// The rehearsal. p_apply defaults to false, so this changes nothing.
		const checked = await TDC.busy(els.roundRulesSave, rehearse('round-rules', () => supabaseClient.rpc('tdc_set_round_rules', args)), els.roundRulesStatus);
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
				const card = els.bracket.querySelector(`[data-fixture="${f.fixture_id}"]`);
				const slot = card && card.querySelector(`[data-side="${which}"]`);
				if (!from || !card) continue;

				// Where the arrow leaves and arrives follows the view (UV,
				// 5 Nov). The rounds run across (columns) or down (rows); the
				// arrow leaves the middle of the feeder's edge that faces the
				// card and arrives on the card's edge that faces the feeder,
				// so from the outside in the right half's arrows run leftwards
				// by themselves.
				const a = from.getBoundingClientRect();
				const b = card.getBoundingClientRect();
				const s = slot ? slot.getBoundingClientRect() : b;
				const across = view.rounds !== 'rows';
				// An arrow leaves on the side of the slot it feeds (UV, 5 Nov,
				// for every view the card allows it in): a third of the way
				// along the exit edge for a home slot, two thirds for an away
				// one, as arrows arrive. So the winner and the loser of a
				// semi-final, or two arrows out of one wide card, never start
				// from one point and cross.
				const out = which === 'home' ? 1 / 3 : 2 / 3;
				let x1, y1, x2, y2, dir;
				if (across) {
					dir = (b.left + b.right) / 2 >= (a.left + a.right) / 2 ? 1 : -1;
					x1 = (dir > 0 ? a.right : a.left) - host.left;
					y1 = a.top + a.height * out - host.top;
					x2 = (dir > 0 ? b.left : b.right) - host.left;
					// Arriving on a side edge: at its own player's row when the
					// players are one above the other; side by side they share
					// the edge, so home comes in at a third and away at two
					// thirds (UV, 5 Nov).
					y2 = (view.card === 'across' || !slot
						? b.top + b.height * (which === 'home' ? 1 / 3 : 2 / 3)
						: s.top + s.height / 2) - host.top;
				} else {
					dir = (b.top + b.bottom) / 2 >= (a.top + a.bottom) / 2 ? 1 : -1;
					x1 = a.left + a.width * out - host.left;
					y1 = (dir > 0 ? a.bottom : a.top) - host.top;
					y2 = (dir > 0 ? b.top : b.bottom) - host.top;
					// Arriving on the top or bottom edge: above its own player
					// when they sit side by side; stacked they share the edge,
					// so home at a third and away at two thirds, the same rule
					// turned on its side.
					x2 = (view.card === 'across' && slot
						? s.left + s.width / 2
						: b.left + b.width * (which === 'home' ? 1 / 3 : 2 / 3)) - host.left;
				}

				// An arrow from a round at or above this one means the TD has
				// wired a round to one above it. Legal, and the draw honours
				// it, but it would read as pointing the wrong way, so it is
				// not hidden — it is marked. Told by the rounds rather than by
				// direction on the page, which the outside-in view reverses.
				const feederRound = which === 'home' ? f.home_feeder_round : f.away_feeder_round;
				const feederBracket = which === 'home' ? f.home_feeder_bracket : f.away_feeder_bracket;
				const back = feederBracket === f.bracket && feederRound >= f.round;
				const source = which === 'home' ? f.home_source : f.away_source;
				const decided = !!(which === 'home' ? f.home_entrant_id : f.away_entrant_id);

				const path = document.createElementNS(SVG_NS, 'path');
				path.setAttribute('d', curve(x1, y1, x2, y2, across, dir));
				path.setAttribute('class', 'bracket-arrow'
					+ (source === 'loser_of' ? ' loser' : '')
					+ (decided ? ' decided' : ' pending')
					+ (back ? ' backwards' : ''));
				path.setAttribute('marker-end',
					'url(#' + (decided ? 'tdc-arrow' : 'tdc-arrow-dim') + ')');

				// Says where it comes from when pointed at. Clicking one opened
				// the Wiring panel until 5 Nov; the wiring is now changed by
				// dragging a player onto a slot (UV).
				if (!readOnly) {
					const title = document.createElementNS(SVG_NS, 'title');
					title.textContent = (source === 'loser_of' ? 'Loser' : 'Winner')
						+ ' of ' + fixtureName(
							which === 'home' ? f.home_feeder_bracket : f.away_feeder_bracket,
							which === 'home' ? f.home_feeder_round : f.away_feeder_round,
							which === 'home' ? f.home_feeder_position : f.away_feeder_position);
					path.append(title);
				}
				svg.append(path);
				drawn++;
			}
		}

		if (drawn) els.bracket.append(svg);
	}

	// A flat-ended S. Control points pushed out along the rounds' direction by
	// half the gap, so the line leaves a fixture square to its edge and
	// arrives square to the next, which is what makes a bracket readable
	// rather than a plate of spaghetti. across: the rounds run sideways;
	// dir: 1 when the arrow heads right (or down), -1 left (or up).
	function curve(x1, y1, x2, y2, across = true, dir = 1) {
		if (across) {
			const dx = Math.max(18, Math.abs(x2 - x1) / 2) * dir;
			return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
		}
		const dy = Math.max(18, Math.abs(y2 - y1) / 2) * dir;
		return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
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
		const b = node('button', 'btn btn-secondary btn-sm bracket-tool bracket-add-match',
			empty ? '+ First match' : '+ Match');
		b.type = 'button';
		b.dataset.act = 'add-match';
		b.dataset.bracket = bracket;
		b.dataset.round = String(round);
		return b;
	}


	// ─────────────────────────────────────────────────────────────────
	// The entrants, and dragging a player onto a slot
	//
	// UV, 5 Nov: every entrant as a pill above the draw, dragged onto a slot
	// to put that player in it; and a player dragged from one match onto a
	// slot in another round to rewire the draw, so that slot is fed by the
	// dragged player's match. This replaced the Wiring panel (a select per
	// slot and a Check button, opened from an arrow or a fixture's Wiring
	// button). Either drop asks at once, from the database's rehearsal, as
	// the picker and the panel did: what the director agrees to is what
	// will happen.
	//
	// A mouse or pen uses pointer events: a press that moves a few pixels is
	// a drag. A finger uses touch events, because a finger on the bracket is
	// usually scrolling it: a drag starts only after a short hold without
	// moving, and from then on the page is kept from scrolling under it.
	// Near an edge of the bracket or the screen, the page scrolls itself, so
	// a pill can reach the last round.
	// ─────────────────────────────────────────────────────────────────

	let entrants = [];

	// The entrant list is the director's (tdc_tournament_entrants is gated),
	// which is why the pills are theirs alone.
	async function loadEntrants() {
		if (readOnly) { entrants = []; return; }
		const { data, error } = await supabaseClient.rpc('tdc_tournament_entrants', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		// A withdrawn entrant is out of the draw, so not offered for it. The
		// picker still offers them, to undo a withdrawal entered by mistake.
		entrants = (data || []).filter((e) => e.status !== 'withdrawn');
		renderEntrants();
	}

	// Follows the Full names switch, as the cards do.
	const entrantName = (e) =>
		(fullNames && [e.first_name, e.last_name].filter(Boolean).join(' ')) || e.display_name;

	// A pill only as wide as its name: the picture on the left, the name in it.
	// shown, optional: the name as drawn, a full name with its surname lighter.
	function pill(pic, name, shown) {
		const p = node('div', 'bracket-pill');
		const label = node('span', 'bracket-pill-name', name);
		if (shown) label.replaceChildren(shown);
		p.append(avatar(pic, name), label);
		return p;
	}

	function renderEntrants() {
		els.entrantPills.replaceChildren(...entrants.map((e) => {
			const name = entrantName(e);
			const p = pill(e.avatar_path, name, fullNames && (e.first_name || e.last_name) ? TDC.fullNameOf(e.first_name, e.last_name) : null);
			p.dataset.drag = 'entrant';
			p.dataset.entrant = e.entrant_id;
			p.title = e.status === 'confirmed' ? name : name + ' (' + e.status + ')';
			return p;
		}));
	}

	let drag = null;    // the drag under way
	let press = null;   // a mouse press on something draggable, not yet moved far enough
	let hold = null;    // a finger on something draggable, not yet held long enough
	let swallowClick = 0;

	const DRAG_MOVE = 6;     // px a mouse moves before a press is a drag
	const HOLD_MS = 350;     // how long a finger holds before it drags
	const HOLD_SLOP = 10;    // px a finger may wander while holding; further is a scroll
	const EDGE = 48;         // px from an edge where the page scrolls itself
	const EDGE_STEP = 14;    // px it scrolls a frame

	// What is being picked up: an entrant from the pills, or a slot of a
	// match (standing for whoever comes out of that match).
	function dragSource(target) {
		if (readOnly || !target || !target.closest) return null;
		const src = target.closest('[data-drag]');
		if (!src) return null;
		if (src.dataset.drag === 'entrant') {
			const e = entrants.find((x) => x.entrant_id === src.dataset.entrant);
			return e && { kind: 'entrant', entrantId: e.entrant_id, label: entrantName(e), pic: e.avatar_path, el: src };
		}
		const box = src.closest('.bracket-fixture');
		const f = box && fixtures.find((x) => x.fixture_id === box.dataset.fixture);
		if (!f) return null;
		const which = src.dataset.side;
		return {
			kind: 'slot', fixture: f, el: src, side: which,
			// Whoever is in the slot now, for the bin: dropping them there
			// takes them out of this match.
			entrantId: which === 'home' ? f.home_entrant_id : f.away_entrant_id,
			label: nameOf(f, which) || 'Winner of ' + fixtureName(f.bracket, f.round, f.position),
			pic: which === 'home' ? f.home_avatar : f.away_avatar
		};
	}

	// The slot under the pointer, if it is somewhere this drag may land. A
	// slot dragged onto its own match, or onto another match of its own
	// round, is not a progression, so neither is a target.
	function slotAt(x, y) {
		const hit = document.elementFromPoint(x, y);
		// The bin by the entrants (UV, 5 Nov): a player dragged from a match
		// onto it is taken out of that match. Only a slot with somebody in it.
		const bin = hit && hit.closest('#entrant-bin');
		if (bin) return drag.kind === 'slot' && drag.entrantId ? { row: bin, bin: true } : null;
		const row = hit && hit.closest('#bracket .bracket-side[data-side]');
		const box = row && row.closest('.bracket-fixture');
		const f = box && fixtures.find((x2) => x2.fixture_id === box.dataset.fixture);
		if (!f) return null;
		if (drag.kind === 'slot') {
			const from = drag.fixture;
			if (f.fixture_id === from.fixture_id) return null;
			if (f.bracket === from.bracket && f.round === from.round) return null;
		}
		return { row, f, side: row.dataset.side };
	}

	function beginDrag(src, x, y, touch) {
		const ghost = pill(src.pic, src.label);
		ghost.classList.add('bracket-ghost');
		document.body.append(ghost);
		drag = Object.assign(src, { ghost, touch, x, y, target: null, frame: 0 });
		src.el.classList.add('drag-source');
		document.documentElement.classList.add('bracket-dragging');
		const sel = window.getSelection && window.getSelection();
		if (sel) sel.removeAllRanges();
		moveDrag(x, y);
		drag.frame = requestAnimationFrame(edgeScroll);
	}

	function moveDrag(x, y) {
		drag.x = x;
		drag.y = y;
		// Above the finger, where it can be seen; beside a mouse pointer.
		const g = drag.ghost;
		const gx = drag.touch ? x - g.offsetWidth / 2 : x + 12;
		const gy = drag.touch ? y - g.offsetHeight - 28 : y + 12;
		g.style.transform = `translate(${gx}px, ${gy}px)`;

		const t = slotAt(x, y);
		if ((t && t.row) === (drag.target && drag.target.row)) return;
		if (drag.target) drag.target.row.classList.remove('drop-target');
		drag.target = t;
		if (t) t.row.classList.add('drop-target');
	}

	// Near an edge, the bracket scrolls sideways and the page up or down,
	// and the slot under the pointer is found again.
	function edgeScroll() {
		if (!drag) return;
		const { x, y } = drag;
		const sc = els.bracket.parentElement;
		const r = sc.getBoundingClientRect();
		let moved = false;
		if (y >= r.top && y <= r.bottom) {
			if (x < r.left + EDGE && sc.scrollLeft > 0) {
				sc.scrollLeft -= EDGE_STEP; moved = true;
			} else if (x > r.right - EDGE && sc.scrollLeft < sc.scrollWidth - sc.clientWidth) {
				sc.scrollLeft += EDGE_STEP; moved = true;
			}
		}
		const maxY = document.documentElement.scrollHeight - innerHeight;
		if (y < EDGE && scrollY > 0) {
			window.scrollBy(0, -EDGE_STEP); moved = true;
		} else if (y > innerHeight - EDGE && scrollY < maxY) {
			window.scrollBy(0, EDGE_STEP); moved = true;
		}
		if (moved) moveDrag(x, y);
		drag.frame = requestAnimationFrame(edgeScroll);
	}

	function endDrag(drop) {
		if (!drag) return;
		const d = drag;
		drag = null;
		cancelAnimationFrame(d.frame);
		d.ghost.remove();
		d.el.classList.remove('drag-source');
		if (d.target) d.target.row.classList.remove('drop-target');
		document.documentElement.classList.remove('bracket-dragging');
		// The press that ended a drag is not also a click on what it ended on.
		swallowClick = Date.now();
		if (!drop || !d.target) return;
		// Into the bin: the slot it came from is emptied, through the same
		// rehearsal, reason and warning as putting somebody in.
		if (d.target.bin) { dropEntrant(d.fixture, d.side, null, d.target.row); return; }
		const { f, side: which, row } = d.target;
		if (d.kind === 'entrant') dropEntrant(f, which, d.entrantId, row);
		else dropWire(f, which, d.fixture, d.side, row);
	}

	// A mouse or pen.
	document.addEventListener('pointerdown', (e) => {
		if (e.pointerType === 'touch' || e.button !== 0) return;
		const src = dragSource(e.target);
		press = src ? { src, x: e.clientX, y: e.clientY } : null;
	});
	document.addEventListener('pointermove', (e) => {
		if (e.pointerType === 'touch') return;
		if (drag) { moveDrag(e.clientX, e.clientY); return; }
		if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_MOVE) {
			const src = press.src;
			press = null;
			beginDrag(src, e.clientX, e.clientY, false);
		}
	});
	document.addEventListener('pointerup', (e) => {
		if (e.pointerType === 'touch') return;
		press = null;
		endDrag(true);
	});
	document.addEventListener('pointercancel', (e) => {
		if (e.pointerType === 'touch') return;
		press = null;
		endDrag(false);
	});
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape') endDrag(false); });
	document.addEventListener('click', (e) => {
		if (Date.now() - swallowClick > 400) return;
		swallowClick = 0;
		e.preventDefault();
		e.stopPropagation();
	}, true);
	// The browser's own drag of a picture or a link would take over.
	document.addEventListener('dragstart', (e) => {
		if (e.target.closest && e.target.closest('[data-drag]')) e.preventDefault();
	});

	// A finger. Listened for on the pills and the bracket only, so the rest
	// of the page scrolls as it always has; touchmove is not passive, so a
	// drag can stop the page scrolling under it.
	function cancelHold() {
		if (!hold) return;
		clearTimeout(hold.timer);
		hold = null;
	}
	for (const area of [els.entrantPills, els.bracket]) {
		area.addEventListener('touchstart', (e) => {
			cancelHold();
			if (e.touches.length !== 1) { endDrag(false); return; }
			const src = dragSource(e.target);
			if (!src) return;
			const t = e.touches[0];
			hold = { x: t.clientX, y: t.clientY };
			hold.timer = setTimeout(() => {
				const h = hold;
				hold = null;
				if (h) beginDrag(src, h.x, h.y, true);
			}, HOLD_MS);
		}, { passive: true });
		area.addEventListener('touchmove', (e) => {
			const t = e.touches[0];
			if (drag) { e.preventDefault(); moveDrag(t.clientX, t.clientY); return; }
			if (hold && Math.hypot(t.clientX - hold.x, t.clientY - hold.y) > HOLD_SLOP) cancelHold();
		}, { passive: false });
		area.addEventListener('touchend', (e) => {
			cancelHold();
			if (!drag) return;
			e.preventDefault();   // no click on what the finger let go over
			endDrag(true);
		}, { passive: false });
		area.addEventListener('touchcancel', () => { cancelHold(); endDrag(false); });
	}
	// A long press would otherwise open the phone's menu for a picture.
	document.addEventListener('contextmenu', (e) => { if (drag || hold) e.preventDefault(); });

	// An entrant dropped on a slot: that player goes in it. The same
	// rehearsal and warning as the picker (tdc_swap_fixture_player). Once
	// frames have been played the database wants a reason, so it is asked
	// for and the rehearsal run again.
	async function dropEntrant(f, which, entrantId, row) {
		TDC.status(els.status, '', '');
		const args = { p_fixture_id: f.fixture_id, p_side: which, p_entrant_id: entrantId, p_reason: null };
		const check = () => TDC.busy(row,
			rehearse('drop', () => supabaseClient.rpc('tdc_swap_fixture_player', args)), els.status);

		let checked = await check();
		if (!checked) return;
		if (checked.error && /Say why the player is changing/.test(checked.error.message || '')) {
			const why = prompt(checked.error.message);
			if (why === null) return;
			args.p_reason = why.trim() || null;
			checked = await check();
			if (!checked) return;
		}
		const { data, error } = checked;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		// Nothing to do, said rather than confirmed and applied as a no-op.
		if (data && data.note) { TDC.status(els.status, data.note, ''); return; }

		if (!confirm(swapWarning(data))) return;
		// The dots on the slot dropped on: a drop presses no button for the
		// writer to find them a place on.
		await drawWriter.write('Changing the player', () =>
			supabaseClient.rpc('tdc_swap_fixture_player', Object.assign({}, args, { p_apply: true })),
			null, { dots: row, leaves: true });
	}

	// A slot of one match dropped on a slot in another round: that slot is
	// fed from the dragged match, its winner, or its loser where the slot is
	// in the third-place playoff. And the player dragged goes through (UV,
	// 5 Nov): the match they left is scored to them by the director at the
	// win condition to 0, and they move into the slot (tdc_move_through).
	// Where it cannot be scored (played, settled, third place, no opponent
	// yet) it is a rewire only, and the confirm says why.
	async function dropWire(f, which, from, fromSide, row) {
		TDC.status(els.status, '', '');
		const args = {
			p_fixture_id: f.fixture_id,
			p_side: which,
			p_from_fixture_id: from.fixture_id,
			p_from_side: fromSide
		};
		const checked = await TDC.busy(row,
			rehearse('drop', () => supabaseClient.rpc('tdc_move_through', args)), els.status);
		if (!checked) return;
		const { data, error } = checked;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (data && data.note) {
			TDC.status(els.status, [data.note, data.not_scored].filter(Boolean).join(' '), '');
			return;
		}

		const lines = [];
		if (data.rewired) {
			lines.push(fixtureName(f.bracket, f.round, f.position)
				+ (which === 'home' ? ', top slot: ' : ', bottom slot: ')
				+ `${data.from} → ${data.to}`);
			if (data.displaces) lines.push(`Turns ${data.displaces} out of it.`);
			if (data.award_cleared && data.award_cleared.entrant) {
				lines.push(`Clears the bye that sent ${data.award_cleared.entrant} through.`);
			}
		}
		if (data.scored) {
			const s = data.scored;
			lines.push(`${fixtureName(s.bracket, s.round, s.position)} scored ${s.score} to ${s.winner} over ${s.loser}, by the director ("Moved through on the draw").`,
				`${s.winner} goes into ${fixtureName(f.bracket, f.round, f.position)}.`);
		} else if (data.not_scored) {
			lines.push('Rewired only: ' + data.not_scored);
		}
		lines.push('', 'Go ahead?');
		if (!confirm(lines.join('\n'))) return;

		await drawWriter.write(data.scored ? 'Moving through' : 'Rewiring', () =>
			supabaseClient.rpc('tdc_move_through', Object.assign({}, args, { p_apply: true })),
			null, { dots: row, leaves: true });
	}

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
				// The tournament row too, not just the draw: the status lives on
				// it, and a save that did not re-read would leave the select
				// showing what was asked for rather than what was stored.
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

		// An empty draw's size starts at the smallest place that holds the
		// tournament's max entrants, or everybody signed up when it has none.
		const want = (tournament && tournament.max_entrants) || live.length;
		const sizes = [...els.drawSize.options].map((o) => Number(o.value));
		els.drawSize.value = String(sizes.find((s) => s >= want) || sizes[sizes.length - 1]);
	}

	els.who.addEventListener('change', () => {
		els.sizeField.hidden = els.who.value !== 'none';
	});

	// What Who goes in sends to tdc_generate_draw, shared by Generate and
	// Redraw so the two cannot disagree.
	function drawArgs() {
		const empty = els.who.value === 'none';
		return {
			p_tournament_id: tournamentId,
			p_confirmed_only: els.who.value === 'confirmed',
			p_empty: empty,
			p_size: empty ? Number(els.drawSize.value) : null
		};
	}

	// ─── Generating ───
	els.generate.addEventListener('click', async () => {
		// Read before anything is awaited, as the press saw it.
		const args = drawArgs();

		// The third-place playoff is read by the draw from the tournament,
		// as the Settings tab saved it (5 Nov; until then this saved the
		// Draw's own switch first).
		await write('Generating the draw', () =>
			supabaseClient.rpc('tdc_generate_draw', args));
	});

	els.resolve.addEventListener('click', () => write('Refreshing', async () => ({ error: null })));

	// Filling and shuffling the first round (UV, 5 Nov). Each asks the
	// database first (its rehearsal does the whole thing and rolls back), so
	// the question carries the real numbers, then does it.
	const many = (n, one, more) => n + ' ' + (n === 1 ? one : more);
	els.populate.addEventListener('click', async () => {
		TDC.status(els.status, '', '');
		// Who goes in decides who is offered; No one has nobody to offer,
		// so it fills from the confirmed.
		const args = { p_tournament_id: tournamentId, p_confirmed_only: els.who.value !== 'all' };
		const tried = await TDC.busy(els.populate, rehearse('populate', () => supabaseClient.rpc('tdc_populate_draw', args)), els.status);
		if (!tried) return;
		const { data, error } = tried;
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (!data.placed) {
			TDC.status(els.status, data.open_slots
				? 'Everybody who can go in is in the draw already.'
				: 'The first round has no open slot.', '');
			return;
		}
		const lines = [many(data.placed, 'player goes', 'players go') + ' into the first round, at random.'];
		if (data.byes_cleared) lines.push(many(data.byes_cleared, 'bye is', 'byes are') + ' filled, so nobody goes through on a bye there.');
		const still = data.open_slots - data.placed;
		if (still > 0) lines.push(many(still, 'slot stays', 'slots stay') + ' open.');
		if (data.left_over > 0) lines.push(many(data.left_over, 'player does', 'players do') + ' not fit and stay out.');
		lines.push('', 'Go ahead?');
		if (!confirm(lines.join('\n'))) return;
		await write('Filling the draw', () =>
			supabaseClient.rpc('tdc_populate_draw', Object.assign({}, args, { p_apply: true })));
	});

	els.shuffle.addEventListener('click', async () => {
		TDC.status(els.status, '', '');
		const args = { p_tournament_id: tournamentId };
		const tried = await TDC.busy(els.shuffle, rehearse('shuffle', () => supabaseClient.rpc('tdc_shuffle_draw', args)), els.status);
		if (!tried) return;
		const { data, error } = tried;
		// A refusal (a frame played, an award) is the database's own sentence.
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		const lines = ['The ' + data.shuffled + ' players in the first round are dealt again at random.'];
		if (data.matches_removed) {
			lines.push(many(data.matches_removed, 'match has', 'matches have')
				+ ' not been played yet and will be deleted; the new pairs\' matches start in their place.');
		}
		lines.push('', 'Go ahead?');
		if (!confirm(lines.join('\n'))) return;
		await write('Shuffling the draw', () =>
			supabaseClient.rpc('tdc_shuffle_draw', Object.assign({}, args, { p_apply: true })));
	});

	// Redrawing a started tournament is the TD's call. The database refuses it
	// once with a message naming how many matches are attached; that message
	// is what the person is asked to confirm, so the warning they read is the
	// real one rather than a guess written here.
	els.redraw.addEventListener('click', async () => {
		const args = drawArgs();

		TDC.status(els.status, '', '');
		const tried = await TDC.busy(els.redraw, rehearse('redraw', () => supabaseClient.rpc('tdc_generate_draw', {
			...args,
			p_replace: true
		})), els.status);
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
				...args,
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
			TDC.busy(els.bracket.querySelector('.bracket-entry'), loadCandidates(id), els.status);
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
		// Nor a drag: redrawing would take the slot from under the finger.
		clearTimeout(liveTimer);
		liveTimer = setTimeout(() => {
			if (drawWriter.pending || checking.size || entering || swapping || editingRound || drag || hold) return;
			loadDraw().then(() => { if (!readOnly) checkDrift(); });
		}, 400);
	}

	// The draw's own rows (20261105165641): a player placed, moved or taken
	// out, a slot rewired, a match added. Always watched, matches or not,
	// since a draw nobody has started yet is where most of that happens.
	// A removed fixture sends only its id, which no filter can match, so
	// deletions are heard unfiltered and kept if the fixture was on this draw.
	function onDrawChange(payload) {
		if (payload && payload.eventType === 'DELETE') {
			const id = payload.old && payload.old.id;
			if (!id || !fixtures.some((f) => f.fixture_id === id)) return;
		}
		onLiveChange(null);
	}

	function startLiveUpdates() {
		const ids = liveMatchIds();
		const key = ids.slice().sort().join(',');
		if (liveChannel && key === liveKey) return;      // nothing has changed about who to watch

		stopLiveUpdates();
		liveKey = key;
		liveSet = new Set(ids);

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
				{ event: 'INSERT', schema: 'public', table: 'tbl_tournament_fixtures', filter: 'tournament_id=eq.' + tournamentId },
				onDrawChange)
			.on('postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'tbl_tournament_fixtures', filter: 'tournament_id=eq.' + tournamentId },
				onDrawChange)
			.on('postgres_changes',
				{ event: 'DELETE', schema: 'public', table: 'tbl_tournament_fixtures' },
				onDrawChange);
		if (ids.length) {
			liveChannel
				.on('postgres_changes',
					Object.assign({ event: 'UPDATE', schema: 'public', table: 'tbl_matches' }, matchFilter),
					onLiveChange)
				.on('postgres_changes',
					Object.assign({ event: 'INSERT', schema: 'public', table: 'tbl_match_events' }, eventFilter),
					onLiveChange)
				// A score the director sets (Change score, moving a player
				// through) is its own row, not the match's. Taking it away
				// (Use the frames) is a delete: heard unfiltered, kept if
				// the match is on this draw.
				.on('postgres_changes',
					Object.assign({ event: 'INSERT', schema: 'public', table: 'tbl_match_result_override' }, eventFilter),
					onLiveChange)
				.on('postgres_changes',
					Object.assign({ event: 'UPDATE', schema: 'public', table: 'tbl_match_result_override' }, eventFilter),
					onLiveChange)
				.on('postgres_changes',
					{ event: 'DELETE', schema: 'public', table: 'tbl_match_result_override' },
					(payload) => { if (payload.old && liveSet.has(payload.old.match_id)) onLiveChange(null); });
		}
		liveChannel
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
	// caught up. Both re-read rather than trusting the socket. Hidden, the
	// socket is let go (3 Nov: battery) and taken up again when shown.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') { stopLiveUpdates(); return; }
		startLiveUpdates();
		onLiveChange();
	});
	window.addEventListener('online', onLiveChange);
	window.addEventListener('pagehide', stopLiveUpdates);

	// ─── Start ───
	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.status);
			return;
		}

		if (!await loadTournament()) return;

		// Settled before the first render, so the controls are never offered
		// and then taken away. The database refuses the writes either way.
		const { data: mine, error } = await supabaseClient.rpc('tdc_my_tournaments', { p_limit: 200 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const row = (mine || []).find((t) => t.id === tournamentId);
		mayRun = !!row && !!row.i_run_it;
		applyMode();

		if (!await loadDraw()) return;
		await loadStatus();

		if (!readOnly) await editingReads();
	})(), 'Draw');

	// Shown again as a tab (tournament-nav.js): read again in place, so a
	// setting saved on the Settings tab, or an entrant added, shows here.
	return {
		refresh: () => (async () => {
			if (!tournamentId || !await loadTournament()) return;
			const nowEditing = applyMode() && !readOnly;
			if (!await loadDraw()) return;
			await loadStatus();
			if (nowEditing) await editingReads();
			else if (!readOnly) await describeField();
		})().catch((err) => TDC.error(AREA, 'the draw could not be read again.', err, els.status))
	};
});
