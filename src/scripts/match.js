// Match scorecard (/match/?id=<uuid>).
//
// One mode: the match named in the address, read from the database. There was
// a second — /match/ with no id rendered a hand-written mockup — which was
// removed on 21 Oct once there were real matches to look at.
//
// Frames read and save. Match settings do not save yet, and the notice below
// the stage says so, because a scorer who loses work to a reload will not
// come back.
//
// Saving hooks into the only three places that change the card — pushFrame(),
// setCell() and undo(). After each write the match is read back rather than
// patched, because the server owns the derived break side.
//
// One match page. Leagues, tournaments and social matches are the same page
// reading different settings; there is no second template anywhere.
//
// Principles from the schema design that are visible here:
//   1. Scores are never stored. They are counted from the frames on every render,
//      which is why correcting a frame in the history table moves the scoreboard.
//   2. The ruleset drives the UI. Turning a key off removes its controls, and no
//      key is read with a fallback, so a missing one shows "TDC (Error)".
//   3. The winner is whichever half you tap. There is no separate winner step,
//      which is also what makes impossible frames unreachable: break & finish
//      exists only on the breaking side, reverse break & finish only on the other.
//   4. Who breaks each frame is derived, not entered — from the lag winner plus
//      the break rule plus the results so far — so changing either setting
//      re-derives every frame at once.
//
// Timing runs itself (see the TIMING block). A shot clock is extra, run by a
// referee with a physical clicker and a screen at the table, so the page never
// needs to display a countdown — it is the control and the record.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Match';

	// ─────────────────────────────────────────────────────────────────
	// People. Shaped like tbl_players: a display name people go by, plus
	// the full name, plus an avatar that is usually missing.
	// ─────────────────────────────────────────────────────────────────

	// Filled wholesale when a match is loaded; see loadMatch(). The invented
	// names that used to seed it went with the mockup.
	let PLAYERS = {};

	const player = (id) => {
		const p = PLAYERS[id];
		if (!p) {
			TDC.error(AREA, 'no player with id ' + id);
			return { id, display_name: 'TDC (Error)', full_name: 'TDC (Error)', avatar_url: null };
		}
		return p;
	};
	const names = (ids) => ids.map((i) => player(i).display_name).join(' & ');

	// ─────────────────────────────────────────────────────────────────
	// The match. One object, roughly what a single match fetch returns.
	// ─────────────────────────────────────────────────────────────────

	// Null until a match is loaded. There was a hand-written mockup match here
	// — a league night with seven invented players — which /match/ with no id
	// used to render. It was the quickest way to work on the layout before
	// there was anything real to look at, and it stopped being that a while
	// ago. Removed 21 Oct; the page now needs an id.
	let MATCH = null;

	// ─────────────────────────────────────────────────────────────────
	// Labels and setting definitions live in match-settings.js, because the
	// create-a-match page builds its form from the same list. Adding a setting
	// is one edit there and nothing here.
	// ─────────────────────────────────────────────────────────────────

	const {
		DISCIPLINE, BREAK_OUTCOME, RESULT_EVENT, RESULT_SHORT, BREAK_DETERMINATION,
		WIN_CONDITION, TIME_EXPIRY, TIEBREAK, SCORE_ENTRY, APPROVAL, SIDE_TAG,
		GROUPS, SETTINGS, layout
	} = TDCMatchDef;

	// This page's sides are the two players.
	TDCMatchDef.setSideNames(() => ({ home: MATCH.home.name, away: MATCH.away.name }));

	// ─────────────────────────────────────────────────────────────────
	// Page wiring
	// ─────────────────────────────────────────────────────────────────

	const el = (id) => document.getElementById(id);
	const els = {
		stage: el('mv-stage'), p0: el('mv-p0'), p1: el('mv-p1'),
		scoreHome: el('mv-score-home'), scoreAway: el('mv-score-away'),
		whoHome: el('mv-who-home'), whoAway: el('mv-who-away'),
		yellow: el('mv-yellow'), infos: [...document.querySelectorAll('.mv-info')], breakRing: el('mv-break'), pill: el('mv-pill'), breakerGlows: document.querySelectorAll('.mv-breaker-glow'),
		stageNote: el('stage-note'),
		overlay: el('overlay'), overlayQ: el('overlay-q'), overlayRow: el('overlay-row'), overlayHint: el('overlay-hint'),
		stageStatus: el('stage-status'),
		timeBody: el('time-body'),
		undoRow: el('undo-row'), undoSlide: el('undo-slide'),
		tallTable: el('history-tall'), wideTable: el('history-wide'), historyLegend: el('history-legend'),
		wideBox: el('history-wide-box'), tlLine: el('tl-line'), tlToggle: el('tl-toggle'), tlWidths: el('tl-widths'),
		statsPanel: el('stats-panel'), playerStats: el('player-stats'), matchStats: el('match-stats'),
		scrim: el('panel-scrim'),
		panel: el('settings-panel'), panelClose: el('panel-close'),
		contextLine: el('context-line'), badgeRow: el('badge-row'), panelNote: el('panel-note'),
		banner: el('mv-banner'), bannerName: el('mv-banner-name'), bannerRound: el('mv-banner-round'),
		changeNote: el('change-note'),
		when: el('match-when'),
		setGroups: el('set-groups'),
		notice: el('match-notice'),
		cardPanel: el('card-panel'), cardBody: el('card-body'),
		cellMenu: el('cell-menu'), cellMenuQ: el('cell-menu-q'),
		cellMenuRow: el('cell-menu-row'), cellMenuHint: el('cell-menu-hint'),
		matchPage: el('match-page'), resultView: el('result-view'),
		resultScore: el('result-score'), resultLine: el('result-line'),
		resultLabel: el('result-label'), resultFrames: el('result-frames'),
		resultFacts: el('result-facts'), resultAgreed: el('result-agreed'),
		resultActions: el('result-actions'), resultStatus: el('result-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'match page is missing expected elements: ' + missing.join(', '));
		return;
	}

	let draft = null;
	let overlayMode = null;

	// ─────────────────────────────────────────────────────────────────
	// TIMING
	//
	// The page keeps this itself, with no buttons to forget to press:
	//   match starts            → racking starts
	//   break event entered     → racking ends, frame starts
	//   result entered          → frame ends, racking starts for the next frame
	//
	// A frame ended while still racking — a walkover or an abandon, where no
	// break was ever played — has no break event and no rack time: the whole
	// period from the rack starting to the result is recorded as frame time.
	//
	// Frame time and match time can each be paused independently, for a genuine
	// stoppage. Both the wall clock and the paused total are kept, so stalling
	// still shows up: a long wall clock with no pause is someone taking their time.
	// ─────────────────────────────────────────────────────────────────

	const mkTimer = (running) => ({ accum: 0, since: running ? Date.now() : null });
	const timerSeconds = (t) => (t.accum + (t.since ? Date.now() - t.since : 0)) / 1000;
	const timerRunning = (t) => t.since !== null;
	function timerPause(t) { if (t.since !== null) { t.accum += Date.now() - t.since; t.since = null; } }
	function timerResume(t) { if (t.since === null) t.since = Date.now(); }
	function timerReset(t, running) { t.accum = 0; t.since = running ? Date.now() : null; }

	const matchTimer = mkTimer(true);
	const rackTimer = mkTimer(true);
	const frameTimer = mkTimer(false);

	let rackStartedAt = Date.now();
	let frameStartedAt = null;

	function beginFrame() {
		if (frameStartedAt !== null) return;
		frameStartedAt = Date.now();
		timerPause(rackTimer);
		timerReset(frameTimer, true);
	}

	function endFrameTimes() {
		const now = Date.now();
		const started = frameStartedAt !== null;
		const wall = started ? (now - frameStartedAt) / 1000 : (now - rackStartedAt) / 1000;
		const played = started ? timerSeconds(frameTimer) : wall;

		const times = started
			? { rack_started_at: rackStartedAt, started_at: frameStartedAt, ended_at: now, paused_seconds: Math.max(0, Math.round(wall - played)) }
			: { rack_started_at: null, started_at: rackStartedAt, ended_at: now, paused_seconds: 0 };

		rackStartedAt = now;
		frameStartedAt = null;
		timerReset(frameTimer, false);
		timerReset(rackTimer, true);
		return times;
	}

	// The rack and match clocks are counted from the frames (UV, 26 Oct), so
	// every phone shows the same and a reload keeps them: the match from the
	// first frame's rack starting, the rack from the last frame's end. Before
	// a frame is finished there is nothing to count from, and they run from
	// the page opening. A frame under way on this phone keeps its own clock.
	function syncClocks() {
		const frames = MATCH.frames;
		if (!frames.length) return;
		const now = Date.now();
		const first = frames[0].rack_started_at || frames[0].started_at;
		if (first && timerRunning(matchTimer)) { matchTimer.accum = now - first; matchTimer.since = now; }
		const last = frames[frames.length - 1];
		if (frameStartedAt === null && last.ended_at && last.ended_at <= now) {
			rackStartedAt = last.ended_at;
			rackTimer.accum = now - last.ended_at;
			rackTimer.since = now;
		}
	}

	const clock = {
		running: false, side: null, remaining: 0,
		firstShot: true, expired: false, used: { home: 0, away: 0 }
	};

	// ─────────────────────────────────────────────────────────────────
	// Counting. Nothing here reads a stored total.
	// ─────────────────────────────────────────────────────────────────

	const completed = () => MATCH.frames.filter((f) => f.status === 'complete');
	const framesWon = (side) => completed().filter((f) => f.winner_side === side).length;
	const otherSide = (side) => (side === 'home' ? 'away' : 'home');

	// Who won, if anybody has. Only "race to" was ever worked out, so a best-of
	// or a fixed number of frames never ended: the clocks stayed live, the stage
	// kept offering the next frame and the match never read as complete.
	function matchWinner() {
		const t = Number(MATCH.rules.win_condition_target);
		const home = framesWon('home');
		const away = framesWon('away');

		switch (MATCH.rules.win_condition_type) {
			case 'race_to':
				if (!(t > 0)) return null;
				if (home >= t) return 'home';
				if (away >= t) return 'away';
				return null;

			case 'best_of': {
				// Best of 7 is won at 4: more than half, so the rest cannot change it.
				if (!(t > 0)) return null;
				const need = Math.floor(t / 2) + 1;
				if (home >= need) return 'home';
				if (away >= need) return 'away';
				return null;
			}

			case 'fixed_frames':
				if (!(t > 0) || completed().length < t) return null;
				if (home === away) return null;      // played out, but drawn
				return home > away ? 'home' : 'away';

			default:
				// Timed and free play end when the players say so, not by score.
				return null;
		}
	}

	// Whether there is any more to play. Not the same question as who won: a
	// fixed number of frames can finish level, and a drawn match is over.
	function matchOver() {
		if (MATCH.rules.win_condition_type === 'fixed_frames') {
			const t = Number(MATCH.rules.win_condition_target);
			return t > 0 && completed().length >= t;
		}
		return matchWinner() !== null;
	}

	// ─────────────────────────────────────────────────────────────────
	// Who breaks. Derived, so a settings change moves every frame at once.
	// ─────────────────────────────────────────────────────────────────

	function breakSideAt(i, frames) {
		const rule = MATCH.rules.break_determination;
		const first = MATCH.first_break_side;

		// Nobody is recording breaks, so no frame has a breaking side.
		if (!MATCH.rules.track_breaks) return null;

		if (rule === 'lag_each_frame' || rule === 'by_schedule') return null;
		if (i === 0) return first;

		// Every rule below reckons from who broke first. Without that there is
		// nothing to reckon from, and anything returned here would be invented:
		// otherSide(null) is 'home', which is how a match with no lag winner
		// ended up showing break buttons from the second frame on.
		if (!first) return null;

		const prev = frames[i - 1];
		switch (rule) {
			// The frame before it flipped, as the database does
			// (private.tdc_break_side_for_frame), so a breaker corrected by hand
			// carries through to what follows. Counting from the first frame
			// here (until 30 Oct) put every later frame's breaker on the other
			// side from the database's, and a break & finish offered to the
			// page's breaker was refused.
			case 'alternate':
				if (prev && prev.break_side) return otherSide(prev.break_side);
				return i % 2 === 0 ? first : otherSide(first);
			case 'winner_breaks': return prev && prev.winner_side ? prev.winner_side : first;
			case 'loser_breaks':  return prev && prev.winner_side ? otherSide(prev.winner_side) : first;
			case 'first_breaks':  return first;
			default:
				TDC.error(AREA, 'unknown break rule: ' + rule);
				return null;
		}
	}

	function recomputeBreaks() {
		if (!MATCH.rules.track_breaks) {
			// Settings can be turned off mid-match; clear what they recorded so
			// the card and the database agree on there being no break data.
			for (const f of MATCH.frames) { f.break_side = null; f.break_side_manual = false; f.break_outcome = null; }
			return [];
		}
		MATCH.frames.forEach((f, i) => {
			if (f.break_side_manual) return;
			const derived = breakSideAt(i, MATCH.frames);
			if (derived !== null) f.break_side = derived;
		});

		const changed = [];
		for (const f of MATCH.frames) {
			if (!f.break_side) continue;
			const ev = f.result_event;
			let bad = false;

			if (ev === 'break_and_finish' || ev === 'golden_break') {
				if (MATCH.rules.break_finish_requires_breaker && f.winner_side !== f.break_side) bad = true;
				if (f.break_outcome !== 'in') bad = true;
				if (ev === 'golden_break' && !MATCH.rules.golden_break_enabled) bad = true;
			}
			if (ev === 'reverse_break_and_finish') {
				if (f.winner_side === f.break_side) bad = true;
				if (!MATCH.rules.reverse_break_finish_enabled) bad = true;
			}

			if (bad) {
				changed.push(`Frame ${f.no}: ${RESULT_EVENT[ev]} → ${RESULT_EVENT.win}`);
				f.result_event = 'win';
			}
		}
		return changed;
	}

	function carriedLineup(side) {
		const last = MATCH.frames[MATCH.frames.length - 1];
		if (last && last[side + '_players'] && last[side + '_players'].length) return last[side + '_players'].slice();
		return MATCH[side].players.length === 1 ? MATCH[side].players.slice() : [];
	}

	// The break event saved for the frame in play (MATCH.break_in_play,
	// 20261030155332) comes into a new draft as another phone's: shown on the
	// ring, never making this phone busy. Only for its own frame, so the frame
	// just pushed (pushFrame) does not hand its event to the next.
	function newDraft() {
		const b = MATCH.break_in_play;
		const outcome = b && b.frame_no === MATCH.frames.length + 1 ? b.outcome : null;
		return {
			home_players: carriedLineup('home'),
			away_players: carriedLineup('away'),
			table: MATCH.tables[0],
			break_side: breakSideAt(MATCH.frames.length, MATCH.frames),
			break_outcome: outcome,
			remoteBreak: !!outcome
		};
	}

	// ─────────────────────────────────────────────────────────────────
	// Shot clock
	// ─────────────────────────────────────────────────────────────────

	const shotLength = () => (clock.firstShot
		? MATCH.rules.shot_clock_first_shot_seconds
		: MATCH.rules.shot_clock_seconds);

	const extensionsLeft = (side) => MATCH.rules.extensions_per_player - clock.used[side];

	function startTurn(side) {
		if (!MATCH.rules.shot_clock_enabled) return;
		clock.side = side;
		clock.remaining = shotLength();
		clock.firstShot = false;
		clock.running = true;
		clock.expired = false;
		TDC.status(els.stageStatus, '', '');
	}

	function useExtension(side) {
		if (extensionsLeft(side) <= 0) return;
		clock.used[side]++;
		clock.remaining += MATCH.rules.extension_seconds;
		clock.expired = false;
		clock.running = true;
	}

	function resetClockForNextFrame() {
		clock.running = false;
		clock.side = null;
		clock.remaining = 0;
		clock.firstShot = true;
		clock.expired = false;
		clock.used = { home: 0, away: 0 };
	}

	function mmss(totalSeconds) {
		const s = Math.max(0, Math.floor(totalSeconds));
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	// ─────────────────────────────────────────────────────────────────
	// Small builders
	// ─────────────────────────────────────────────────────────────────

	function badge(text, cls) {
		const b = document.createElement('span');
		b.className = 'badge' + (cls ? ' ' + cls : '');
		b.textContent = text;
		return b;
	}

	// Everything that changes the card. The timing controls are not here: a
	// clock is this screen's own business and changes nothing anyone else sees.
	const WRITE_ACTS = new Set([
		'breakside', 'result', 'more', 'walkover', 'abandon',
		'changetable', 'settable', 'pick', 'pickplayer',
		'editside', 'editbreak', 'editcell', 'setcell'
	]);

	// Scorecard actions are not frame edits. A player answers a card they are
	// not allowed to change, which is exactly what makes the answer worth
	// anything — so these stay out of the read-only guard above.
	const CARD_ACTS = new Set([
		'submitcard', 'agreecard', 'disputecard', 'disputecancel', 'disputesend',
		'deletematch', 'deletecancel', 'deleteconfirm', 'reopencard',
		'finishmatch', 'finishnotyet'
	]);

	function mbtn(label, cls, dataset, disabled) {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'mbtn' + (cls ? ' ' + cls : '');
		b.textContent = label;
		Object.assign(b.dataset, dataset);
		// One place rather than at every call site, so a control added later is
		// covered without anyone having to remember this.
		if (disabled || (!canEdit && WRITE_ACTS.has(dataset && dataset.act))) b.disabled = true;
		return b;
	}

	function div(cls, text) {
		const d = document.createElement('div');
		d.className = cls;
		if (text !== undefined) d.textContent = text;
		return d;
	}

	function heading(tag, text, cls) {
		const h = document.createElement(tag);
		if (cls) h.className = cls;
		h.textContent = text;
		return h;
	}

	const liveVals = {};
	function readout(label, value, opts = {}) {
		const r = div('time-readout' + (opts.cls ? ' ' + opts.cls : ''));
		const v = div('time-val', value);
		if (opts.live) liveVals[opts.live] = v;
		r.append(div('time-key', label), v);
		return r;
	}

	// ─────────────────────────────────────────────────────────────────
	// The stage (docs/design/match-score-input.md)
	//
	// A line with the frame in play, the two players' cards side by side (home
	// on the left), and the break event across both. Each card is three bands:
	// a header (who), the score, and a footer with the buttons.
	// ─────────────────────────────────────────────────────────────────

	function resultsFor(side, breakSide) {
		const r = MATCH.rules;
		const breaking = breakSide === side;
		const list = ['win'];

		// With breaks untracked there is nothing but a winner, which is the
		// whole point of the simple card: one button a side.
		if (!r.track_breaks) return list;

		if (r.break_finish_enabled && (breaking || !r.break_finish_requires_breaker)) {
			list.push('break_and_finish');
			if (r.golden_break_enabled) list.push('golden_break');
		}
		if (!breaking && r.reverse_break_finish_enabled) list.push('reverse_break_and_finish');
		return list;
	}

	function resultDisabled(ev) {
		// Nothing to wait for: the frame is over when somebody says who won it.
		if (!MATCH.rules.track_breaks) return false;
		if (!draft.break_side) return true;
		// A plain win does not wait for the break event (UV, 26 Oct): nobody
		// tapped Dry, the frame was played, and the break is then recorded as
		// not known. Such a frame has no rack time; its whole length is frame
		// time, as for a walkover. The special wins are about the break, so
		// they wait for it.
		if (ev === 'win') return false;
		if (!draft.break_outcome) return true;
		if ((ev === 'break_and_finish' || ev === 'golden_break') && draft.break_outcome !== 'in') return true;
		// A reverse B&F is the other player clearing after a break that potted
		// nothing for the breaker, so not after "In" (UV, 30 Oct).
		if (ev === 'reverse_break_and_finish' && draft.break_outcome === 'in') return true;
		return false;
	}

	// ─────────────────────────────────────────────────────────────────
	// The stage's drawing (UV, 30 Oct: the new match page's look, put onto
	// this page so its behaviour stays this page's). Copied from match-v2.js
	// as it was: the scores, each player's name and picture, the break ring,
	// the special wins and the more button, their glow and inside shadow,
	// the ring's icon and the breaker's half.
	// ─────────────────────────────────────────────────────────────────

	// A score, centred by its own ink (UV, 30 Oct: the space above and below
	// was uneven): each digit of the display face stands a little differently
	// (1.05 to 1.08 of its size tall, up to 0.03 below the baseline), so the
	// score's actual digits are measured and moved down by half their height
	// from the baseline (--mv-score-shift; match.css, .mv-score-n). Measured
	// once the face has loaded; until then the average digit's 0.525.
	const inkCanvas = document.createElement('canvas').getContext('2d');
	// digits: how many digits the size is worked out for, the longer score's,
	// so both scores are always the same size (UV, 2 Nov: if one gets
	// smaller, so does the other).
	function paintScore(node, n, digits = String(n).length) {
		const text = String(n);
		node.textContent = text;
		node.style.setProperty('--digits', digits);
		// Across too (UV, 30 Oct): centred by its ink, not by the space the face
		// sets aside for each digit (text-anchor's middle), so measured from the
		// middle of the text, the ink's left and right reaches; --mv-score-shift-x
		// moves it by half their difference.
		const centre = () => {
			// Drawn again since, or a fade holding the old score (TDC.liveFade)
			if (node.textContent !== text) return;
			inkCanvas.font = '100px "Rushford Clean"';
			inkCanvas.textAlign = 'center';
			const m = inkCanvas.measureText(text);
			if (!(m.actualBoundingBoxAscent > 0)) return;
			node.style.setProperty('--mv-score-shift', ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 200).toFixed(4) + 'em');
			node.style.setProperty('--mv-score-shift-x', ((m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 200).toFixed(4) + 'em');
		};
		// At once when the face itself says it is loaded, so the score is
		// centred in the same task it is drawn in and a fade takes its old
		// centring with the old score (TDC.liveFade); else through load().
		// Not check(): it said yes before the face was in, and a fallback
		// face's digits moved the score up 0.19 of its size.
		if (scoreFaceIn()) centre();
		else document.fonts.load('100px "Rushford Clean"').then(centre, (err) => TDC.error(AREA, 'the score\'s face would not load, so it is centred by the average digit', err, els.stageStatus));
	}
	function scoreFaceIn() {
		for (const f of document.fonts) if (f.family.replace(/["']/g, '') === 'Rushford Clean' && f.status === 'loaded') return true;
		return false;
	}

	// Upright, each player's name and picture fill the room between the
	// stage's edge and the green pill (UV, 2 Nov; until then their score's
	// digits, 30 Oct): the top player's from the top of the stage to the
	// pill's top, the bottom player's from the pill's foot to the stage's foot
	// (match.css, --mv-who-top and --mv-who-size), as the browser has laid
	// the pill out. Again whenever a score changes (paintScore, a live fade),
	// the stage resizes or the phone turns. Sideways the names keep their
	// strip across the top (match.css) and nothing is set.
	//   Both then take the smaller room (--mv-who-fit, its height inside any
	//   padding: the bottom one keeps clear of the home bar), so the top and
	//   bottom players' names and pictures are the same size (UV, 30 Oct).
	//   And no taller than lets the whole of each fit across (fitWho), both
	//   ways up.
	function placeWho() {
		roomWho();
		fitWho();
		fitScores();
	}

	// The scores' size and place (UV, 2 Nov, second look). Each score's box
	// (match.css) runs from the pill's end to the rings, the pill's whole
	// thickness across: the space between its end's buttons and the rings
	// (the old box: from the line through the corners' centres), and,
	// where the pill is thicker than its two corners, the gap between the
	// two buttons as well, as wide as that leaves and the box's whole length.
	// A score takes the gap only if its digits fit there bigger (UV: "only if
	// the numbers will fit in that new space"): the size for each space is
	// the box rule's (0.65 a digit across, 1.1 stretched up and down, --space-3
	// clear), the bigger kept. Both scores take the smaller of the two players'
	// (always the same size, with the longer score's digits), each centred in
	// the space that size fits: the whole box, or the part beside the rings.
	function fitScores() {
		const root = getComputedStyle(document.documentElement);
		const space = getComputedStyle(els.stage).getPropertyValue('--space-3').trim();
		const m = parseFloat(space) * (space.endsWith('rem') ? parseFloat(root.fontSize) : 1);
		const stretch = parseFloat(root.getPropertyValue('--score-stretch')) || 1;
		const rad = parseFloat(getComputedStyle(els.pill).borderTopLeftRadius) || 0, line = px('--match-break-stroke') || 0;
		const nodes = [els.scoreHome, els.scoreAway];
		const digits = Math.max(...nodes.map((n) => n.textContent.length), 1);
		const wide = landscape.matches;
		const fit = (W, H) => Math.max(0, Math.min((W - 2 * m) / (0.65 * digits), (H - 2 * m) / (1.1 * stretch)));
		// Since the special wins became thin bands round the corners (UV, 2 Nov),
		// the whole box is free but for them: the digits, centred in it, as big
		// as keeps them clear of the box's edges (--space-3) and of each band's
		// inside (the corner's circle less the band, cornerBand, less --space-3).
		const br = els.breakRing.getBoundingClientRect(), u = br.width / 100;
		const inner = u > 0 ? cornerBand(rad / u).ri * u - m : 0;
		const each = nodes.map((node) => {
			const box = node.ownerSVGElement.getBoundingClientRect();
			const along = wide ? box.width : box.height, across = wide ? box.height : box.width;
			const corner = Math.max(0, rad - line);
			const beside = wide ? fit(along - corner, across) : fit(across, along - corner);
			// e: from the pill's end along the box; a: across it, from the pill's
			// outer edge. For a size, the nearest the digits' end-side edge may
			// come to the pill's end (their corners inside the bands' insides, or
			// past the corners' centres), and so the span they can sit in, out to
			// the rings: null if they do not fit at all.
			const ce = rad - line;
			const span = (size) => {
				const w = 0.65 * digits * size, h = 1.1 * stretch * size;
				const hE = (wide ? w : h) / 2, hA = (wide ? h : w) / 2, aC = across / 2;
				if (aC - hA < line + m || aC + hA > across - line - m) return null;
				let from = m;
				for (const a of [aC - hA, aC + hA]) {
					if (!(a < rad || a > across - rad)) continue;
					const da = a - (a < across / 2 ? rad : across - rad);
					from = Math.max(from, da * da < inner * inner ? ce - Math.sqrt(inner * inner - da * da) : ce);
				}
				return from + 2 * hE <= along - m ? { from, to: along - m } : null;
			};
			let lo = 0, hi = Math.max(along, across);
			for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (span(mid)) lo = mid; else hi = mid; }
			return { node, corner, beside, all: lo, along, span };
		});
		if (each.some((e) => !(e.beside > 0))) return;   // not laid out yet: the CSS's own fit meanwhile
		const size = Math.min(...each.map((e) => Math.max(e.beside, e.all)));
		each.forEach((e, i) => {
			// Centred in the span the digits can sit in at that size, between the
			// bands and the rings (from the pill's end along the box); else beside
			// the rings, half a corner nearer them. Home's end is above it upright
			// and left of it sideways, so its distances run down or right.
			const sp = e.span(size), sign = i === 0 ? 1 : -1;
			const shift = sp ? sign * ((sp.from + sp.to) / 2 - e.along / 2) : sign * e.corner / 2;
			const set = (name, value) => { if (e.node.style.getPropertyValue(name) !== value) e.node.style.setProperty(name, value); };
			set('--mv-score-size', size.toFixed(2) + 'px');
			set('--mv-score-dx', (wide ? shift : 0).toFixed(2) + 'px');
			set('--mv-score-dy', (wide ? 0 : shift).toFixed(2) + 'px');
		});
	}
	function roomWho() {
		const rooms = [];
		const pill = els.pill.getBoundingClientRect();
		for (const [half, who] of [[els.p0, els.whoHome], [els.p1, els.whoAway]]) {
			if (landscape.matches) { for (const p of ['--mv-who-top', '--mv-who-size', '--mv-who-fit']) who.style.removeProperty(p); continue; }
			const side = half.getBoundingClientRect();
			if (!(pill.height > 0)) continue;   // not laid out yet: the CSS's own place meanwhile
			const [from, to] = half.dataset.side === 'home' ? [side.top, pill.top] : [pill.bottom, side.bottom];
			who.style.setProperty('--mv-who-top', Math.max(0, from - side.top).toFixed(1) + 'px');
			who.style.setProperty('--mv-who-size', Math.max(0, to - from).toFixed(1) + 'px');
			const pad = getComputedStyle(who);
			rooms.push(Math.max(0, to - from - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom)));
		}
		if (rooms.length !== 2) return;
		const fit = Math.min(...rooms).toFixed(1) + 'px';
		for (const who of [els.whoHome, els.whoAway]) who.style.setProperty('--mv-who-fit', fit);
	}
	// Sized to fit, not run past the edge (UV, 30 Oct: the height was held and
	// a long name ended in "…"): the picture, the gap and the names all scale
	// with the block's height, so its width over its height is fixed for a
	// given pair of names, measured as laid out (the names' full text, by a
	// Range, so a cut name counts whole). The height that just fits the room
	// across (the block's max-width) is that width divided by it. Both
	// players take the smaller (--mv-who-cap), as for the room, so a long
	// name shrinks the other player's too. Again with placeWho, after the
	// names are drawn and once the faces have loaded.
	const whoRange = document.createRange();
	function fitWho() {
		const caps = [];
		for (const who of [els.whoHome, els.whoAway]) {
			const person = who.querySelector('.mv-person');
			const h = person ? person.getBoundingClientRect().height : 0;
			if (!(h > 0)) continue;
			let text = 0;
			for (const line of person.querySelectorAll('.mv-name, .mv-full')) {
				whoRange.selectNodeContents(line);
				text = Math.max(text, whoRange.getBoundingClientRect().width);
			}
			const cs = getComputedStyle(person);
			const pic = person.querySelector('.mv-pic');
			const across = (pic ? pic.getBoundingClientRect().width : 0) + (parseFloat(cs.columnGap) || 0) + text;
			const room = parseFloat(cs.maxWidth);
			if (across > 0 && room > 0) caps.push(room * h / across);
		}
		if (!caps.length) return;
		const cap = Math.max(0, Math.min(...caps) - 0.5).toFixed(1) + 'px';   // half a pixel spare for rounding
		for (const who of [els.whoHome, els.whoAway]) who.style.setProperty('--mv-who-cap', cap);
	}
	function followScores() {
		const watch = new MutationObserver(placeWho);
		for (const node of [els.scoreHome, els.scoreAway]) watch.observe(node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
		new ResizeObserver(placeWho).observe(els.stage);
		landscape.addEventListener('change', placeWho);
		document.fonts.addEventListener('loadingdone', placeWho);   // the names' widths in their own faces
		placeWho();
	}

	// The scores read as buttons (UV, 30 Oct): one filter both share,
	// #mv-score-fx, on the unstretched group round each digit (match.css,
	// .mv-score-n), laying over the digit the buttons' green inner glow
	// (--match-glow-size, --match-win-glow-colour) and an inside shadow cast by
	// the light, built as the halves' (--page-inset-size) but stronger (UV,
	// 30 Oct: --match-score-inset-alpha, and --match-score-inset-reach times
	// the light's offset). The scores' SVGs have no
	// viewBox, so its units are px: a box-shadow's blur is twice the
	// deviation, and the offset is the light's own, set again whenever
	// page-light.js moves it.
	function buildScoreFx() {
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('class', 'mv-fx-defs');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('width', '0');
		svg.setAttribute('height', '0');
		const filter = document.createElementNS(SVG_NS, 'filter');
		filter.id = 'mv-score-fx';
		for (const [k, v] of Object.entries({ x: '-20%', y: '-20%', width: '140%', height: '140%' })) filter.setAttribute(k, v);
		const prim = (name, attrs) => {
			const e = document.createElementNS(SVG_NS, name);
			for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
			filter.append(e);
			return e;
		};
		prim('feFlood', { class: 'mv-glow-flood-win', result: 'green' });
		prim('feComposite', { in: 'green', in2: 'SourceAlpha', operator: 'out', result: 'greenOut' });
		const glowBlur = prim('feGaussianBlur', { in: 'greenOut', stdDeviation: '0', result: 'greenSoft' });
		prim('feComposite', { in: 'greenSoft', in2: 'SourceAlpha', operator: 'in', result: 'glow' });
		prim('feFlood', { class: 'mv-score-inset-flood', result: 'dark' });
		prim('feComposite', { in: 'dark', in2: 'SourceAlpha', operator: 'out', result: 'darkOut' });
		const move = prim('feOffset', { in: 'darkOut', dx: '0', dy: '0', result: 'darkMoved' });
		const insetBlur = prim('feGaussianBlur', { in: 'darkMoved', stdDeviation: '0', result: 'darkSoft' });
		prim('feComposite', { in: 'darkSoft', in2: 'SourceAlpha', operator: 'in', result: 'inset' });
		// The outline, as a button's: a line --match-break-stroke wide centred
		// on the digit's edge, the shape grown by half of it less the shape
		// shrunk by half of it, in green. Made here, in the unstretched group,
		// so it is even all round: a text stroke was stretched with the digit
		// (non-scaling-stroke does not reach text), 3.75px on its flat edges.
		const grow = prim('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: '0', result: 'grown' });
		const shrink = prim('feMorphology', { in: 'SourceAlpha', operator: 'erode', radius: '0', result: 'shrunk' });
		prim('feComposite', { in: 'grown', in2: 'shrunk', operator: 'out', result: 'band' });
		prim('feFlood', { class: 'mv-score-line-flood', result: 'lineColour' });
		prim('feComposite', { in: 'lineColour', in2: 'band', operator: 'in', result: 'line' });
		const merge = prim('feMerge', {});
		// In the buttons' order: the fill, its glow, the line, the inside shadow over all
		for (const input of ['SourceGraphic', 'glow', 'line', 'inset']) {
			const node = document.createElementNS(SVG_NS, 'feMergeNode');
			node.setAttribute('in', input);
			merge.append(node);
		}
		svg.append(filter);
		els.stage.append(svg);
		const root = document.documentElement;
		const place = () => {
			const cs = getComputedStyle(root);
			const glow = px('--match-glow-size'), soft = px('--page-inset-size');
			if (!(glow >= 0) || !(soft >= 0)) { TDC.error(AREA, 'the scores\' glow or inside shadow has no size (--match-glow-size, --page-inset-size)', null, els.stageStatus); return; }
			const line = px('--match-break-stroke');
			if (line > 0) { grow.setAttribute('radius', (line / 2).toFixed(2)); shrink.setAttribute('radius', (line / 2).toFixed(2)); }
			const reach = px('--match-score-inset-reach');
			const k = reach > 0 ? reach : 1;
			glowBlur.setAttribute('stdDeviation', (glow / 2).toFixed(2));
			insetBlur.setAttribute('stdDeviation', (soft / 2).toFixed(2));
			move.setAttribute('dx', ((parseFloat(cs.getPropertyValue('--page-shadow-x')) || 0) * k).toFixed(2));
			move.setAttribute('dy', ((parseFloat(cs.getPropertyValue('--page-shadow-y')) || 0) * k).toFixed(2));
		};
		place();
		new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ['style'] });
	}

	// A player's name and picture (UV, 30 Oct): the picture on the left (or
	// their initials in a circle, as on the season page), the display name on
	// the right with the full name under it, unless the two are the same.
	// p is a player as loadPlayers() keeps them (display_name, full_name,
	// avatar_url).
	function paintWho(node, p) {
		const pic = div('mv-pic');
		const url = p.avatar_url;
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			pic.append(img);
		} else {
			pic.textContent = (p.display_name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		const names = div('mv-names');
		names.append(div('mv-name', p.display_name));
		const full = p.full_name;
		if (full !== p.display_name) names.append(div('mv-full', full));
		const person = div('mv-person');
		person.append(pic, names);
		node.replaceChildren(person);
	}

	// ─── The break event (UV, 30 Oct) ─────────────────────────────────
	// A yellow ring, split like an X into a button per
	// break event (TDCMatchDef.BREAK_OUTCOME, so the names are defined once):
	// In at the top, Dry at the bottom, Scratch left and Foul right. The
	// chosen one is filled. As on /match/, nothing is chosen at first and a
	// choice can be changed, never cleared. A tap is match.js's setOutcome
	// (breakTap, step 2): it starts the frame and ends racking, and is saved
	// with the frame. Drawn in a 100 box: each quadrant a quarter circle (UV,
	// 3 Nov: the info left the hole, so they meet in the middle and are
	// easier to tap when small), its straight edges BREAK_RING.gap from the
	// X's lines on both sides, so the gap between two quadrants is even from
	// the middle to the rim. The words run along the rim (UV, 30 Oct), as big
	// as fits (UV, 3 Nov; breakWords). Dry's arc runs the other way round, so
	// it reads upright; Scratch reads upwards and Foul downwards, their tops
	// to the rim.
	//
	// Each word's capitals are centred in the band (UV, 30 Oct: the padding
	// was uneven): the word stands on its baseline, which is CAP / 2 of its
	// size off the band's middle, inwards where its top faces the rim and
	// outwards for Dry, whose top faces the hole. CAP is a Rushford Clean
	// capital's height for its size (1.05 with size-adjust, measured 30 Oct;
	// none of these words reaches below the baseline). Centring the font's
	// em box instead (dominant-baseline: central) left the capitals 0.15 of
	// their size off the middle, outwards on three and inwards on Dry.
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const BREAK_AT = { in: -90, foul: 0, dry: 90, scratch: 180 };   // each quadrant's middle, degrees clockwise from the right
	const BREAK_RING = { outer: 48, gap: 2.5 };
	const CAP = 1.05;

	const DEG = 180 / Math.PI;
	const at = (r, a) => [50 + r * Math.cos(a / DEG), 50 + r * Math.sin(a / DEG)].map((n) => n.toFixed(2)).join(' ');
	const norm = (a) => ((a + 540) % 360) - 180;   // an angle in degrees, brought into -180 to 180

	// A quarter: the rim's arc, then in to where its two straight edges meet,
	// gap from both of the X's lines, so on its middle gap × √2 out
	function sector(mid) {
		const { outer, gap } = BREAK_RING;
		const oa = Math.asin(gap / outer) * DEG;
		return `M ${at(outer, mid - 45 + oa)} A ${outer} ${outer} 0 0 1 ${at(outer, mid + 45 - oa)}`
			+ ` L ${at(gap * Math.SQRT2, mid)} Z`;
	}

	// A word's width in the display face for each unit of its size, for the
	// words' fit (breakWords, cornerBand): measured on the stage, and again
	// once the fonts are in (buildBreak). Nothing is kept while the stage is
	// not laid out (it measures 0), so a rough width stands in.
	const widths = new Map();
	let measurer = null;
	function wordWidth(label) {
		if (widths.has(label)) return widths.get(label);
		if (!measurer) {
			measurer = document.createElementNS(SVG_NS, 'svg');
			measurer.setAttribute('aria-hidden', 'true');
			measurer.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden;';
			els.stage.append(measurer);
		}
		const text = document.createElementNS(SVG_NS, 'text');
		text.setAttribute('class', 'mv-measure');
		text.style.fontSize = '100px';
		text.textContent = label;
		measurer.append(text);
		const w = text.getComputedTextLength() / 100;
		text.remove();
		if (!(w > 0)) return 0.7 * label.length;
		widths.set(label, w);
		return w;
	}

	// The break words' size and the radius their capitals are centred on (UV,
	// 3 Nov: as big as fits the buttons): one size for all four (Claude), the
	// biggest at which the longest still fits its quarter, the special wins'
	// padding (0.46 of a capital) from the rim and from the straight edges.
	// The width is checked at the capitals' inner edge, where the quarter is
	// narrowest and where the words that read outwards stand.
	function breakWords() {
		const { outer, gap } = BREAK_RING;
		const longest = Math.max(...Object.values(TDCMatchDef.BREAK_OUTCOME).map(wordWidth));
		const place = (word) => {
			const cap = CAP * word, pad = cap * 0.46;
			return { pad, middle: outer - pad - cap / 2, inner: outer - pad - cap };
		};
		const fits = (word) => {
			const { pad, inner } = place(word);
			if (inner <= gap + pad) return false;
			return longest * word <= 2 * (Math.PI / 4 - Math.asin((gap + pad) / inner)) * inner;
		};
		let lo = 0, hi = outer;
		for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
		return { word: lo, middle: place(lo).middle };
	}

	// The arc a word stands on, centred on the angle mid and reaching half
	// either side of it, its capitals centred on the circle of radius middle:
	// clockwise (its top outwards), except in the lower half, where clockwise
	// would point its top down and out (a special win at 150° read nearly
	// upside down); exactly sideways (0°, 180°: Foul, Scratch) stays
	// clockwise. size: the words' size in the box. The break words' middle
	// is breakWords'. o: the circle's centre, the ring's unless given (a
	// special win's is its end of the green pill's).
	function wordArc(mid, size, half, middle, o = [50, 50]) {
		const lift = CAP * size / 2;
		const on = (r, a) => [o[0] + r * Math.cos(a / DEG), o[1] + r * Math.sin(a / DEG)].map((n) => n.toFixed(2)).join(' ');
		if (mid > 0 && mid < 180) {
			const r = middle + lift;
			return `M ${on(r, mid + half)} A ${r} ${r} 0 0 0 ${on(r, mid - half)}`;
		}
		const r = middle - lift;
		return `M ${on(r, mid - half)} A ${r} ${r} 0 0 1 ${on(r, mid + half)}`;
	}

	// ─── The special wins (UV, 2 Nov: in the green pill's corners) ────
	// Four buttons in the break buttons' style, in green: Break & finish and
	// Golden break at the breaker's end of the green pill, Reverse B&F and the
	// more button at the other (UV, 30 Oct), so they swap ends when the break
	// passes. In an end the first is the top one sideways and the left one
	// upright (Claude). Each is a pill bent round one of the green pill's
	// rounded corners (UV, 2 Nov: "a horizontal pill with text inside, then
	// bend the pill into the corner radius"; first they were quarter circles
	// filling the round ends): a band round the corner's circle, two
	// quadrants' gaps inside the pill's line (as the special wins lay round
	// the ring), as thick as its word needs (a capital and the break words'
	// padding either side, 0.46 of a capital; the word as big as fits, UV
	// 3 Nov, cornerBand), round at both ends, reaching
	// round the corner short of its straight edges. Its word runs along its
	// middle. Drawn in the break ring's 100 box from where the pill (#mv-pill,
	// sized by match.css) lies against it, so drawn again when the stage
	// resizes, the phone turns or the breaker changes. The corners they leave
	// free are the scores' (fitScores). A tap records the frame (specialWin);
	// which are offered follows the rules (paintButtons). The wins are named
	// by TDCMatchDef.RESULT_SHORT; the fourth button is the more pop-up, which
	// holds the walkovers.
	const WIN_SLOTS = [['break_and_finish', 'reverse_break_and_finish'], ['golden_break', 'more']];   // each slot: [the breaker's end, the other end]
	const WIN_WORDS = ['break_and_finish', 'reverse_break_and_finish', 'golden_break'];
	const landscape = matchMedia('(orientation: landscape)');

	// Where the green pill lies, in the break ring's box: its centre, half its
	// length and half its thickness, its corners' radius (rad), and whether
	// it runs across (sideways). null until both are laid out.
	function pillBox() {
		const br = els.breakRing.getBoundingClientRect(), pr = els.pill.getBoundingClientRect();
		if (!(br.width > 0) || !(pr.width > 0) || !(pr.height > 0)) return null;
		const u = 100 / br.width, thick = Math.min(pr.width, pr.height) / 2;
		const rad = Math.min(thick, parseFloat(getComputedStyle(els.pill).borderTopLeftRadius) || thick);
		return {
			cx: 50 + (pr.left + pr.width / 2 - br.left - br.width / 2) * u,
			cy: 50 + (pr.top + pr.height / 2 - br.top - br.height / 2) * u,
			half: Math.max(pr.width, pr.height) / 2 * u,
			thick: thick * u,
			rad: rad * u,
			wide: pr.width >= pr.height
		};
	}

	// A corner's band for a corner of radius rad (in the box): its outer and
	// inner radius, the radius its word is centred on, and its word's size.
	// fitScores keeps the digits clear of the inner one. The word is as big
	// as fits (UV, 3 Nov; it was 0.16 of the radius): one size for all three
	// (Claude), the biggest at which the longest, a padding clear of each end,
	// fits along the band (winBand's reach) at its capitals' inner edge. The
	// band thickens with it, so the scores' room shrinks.
	function cornerBand(rad) {
		const ro = rad - 2 * BREAK_RING.gap;
		const longest = Math.max(...WIN_WORDS.map((v) => wordWidth(TDCMatchDef.RESULT_SHORT[v] || v)));
		const band = (word) => {
			const cap = CAP * word, pad = cap * 0.46, h = cap + 2 * pad;
			return { ro, ri: ro - h, rm: ro - h / 2, h, word, cap, pad };
		};
		const fits = (word) => {
			const { ri, rm, h, cap, pad } = band(word);
			if (ri <= 0) return false;
			const half = Math.PI / 4 - (h / 2 + BREAK_RING.gap) / rm;
			return longest * word <= 2 * half * (rm - cap / 2) - 2 * pad;
		};
		let lo = 0, hi = Math.max(0, ro);
		for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
		const { ri, rm, h } = band(lo);
		return { ro, ri, rm, h, word: lo };
	}

	// One button: the band about (ox, oy), centred on the angle mid (degrees,
	// clockwise from the right) and reaching round the corner's quarter, short
	// of its straight edges by its round end and a quadrants' gap. Its
	// outline is points along each edge, so no arc's sweep has to be right.
	function winBand(band, ox, oy, mid) {
		const { ro, ri, rm, h } = band;
		const half = 45 - ((h / 2 + BREAK_RING.gap) / rm) * DEG, a1 = mid - half, a2 = mid + half;
		const pts = [];
		const at2 = (cx, cy, r, ang) => [cx + r * Math.cos(ang / DEG), cy + r * Math.sin(ang / DEG)];
		const arc = (cx, cy, r, from, to, n) => { for (let i = 0; i <= n; i++) pts.push(at2(cx, cy, r, from + (to - from) * i / n)); };
		const [c2x, c2y] = at2(ox, oy, rm, a2), [c1x, c1y] = at2(ox, oy, rm, a1);
		arc(ox, oy, ro, a1, a2, 32);                  // the outer edge, clockwise
		arc(c2x, c2y, h / 2, a2, a2 + 180, 10);      // round at the far end
		arc(ox, oy, ri, a2, a1, 32);                  // the inner edge, back
		arc(c1x, c1y, h / 2, a1 + 180, a1 + 360, 10); // round at the near end
		const d = 'M ' + pts.map((p) => p.map((n) => n.toFixed(2)).join(' ')).join(' L ') + ' Z';
		return { d, mid: norm(mid), half, wordR: rm, o: [ox, oy], centre: at2(ox, oy, rm, mid) };
	}

	// breakSide: who is breaking; home's end is the left one sideways and the
	// top one upright. With nobody breaking they sit as for home. Each button
	// carries its word's size (word, in the box).
	function winButtons(breakSide) {
		const box = pillBox();
		if (!box) return [];
		const band = cornerBand(box.rad);
		const out = [];
		[-1, 1].forEach((dir, end) => {
			const reach = dir * (box.half - box.rad), across = box.thick - box.rad;
			const pair = [-1, 1].map((side) => {
				// this corner's centre, and the angle midway round it: out along the
				// pill (dir) and out across it (side)
				const ox = box.cx + (box.wide ? reach : side * across), oy = box.cy + (box.wide ? side * across : reach);
				const mid = box.wide ? Math.atan2(side, dir) * DEG : Math.atan2(dir, side) * DEG;
				return winBand(band, ox, oy, mid);
			});
			pair.sort((p, q) => (box.wide ? p.centre[1] - q.centre[1] : p.centre[0] - q.centre[0]));
			const breakerEnd = (breakSide === 'away') === (end === 1);
			const values = WIN_SLOTS.map((slot) => slot[breakerEnd ? 0 : 1]);
			pair.forEach((q, j) => out.push(Object.assign({ value: values[j], word: band.word }, q)));
		});
		return out;
	}

	// The buttons' inside effects, each a layer of its own over or under them,
	// built as the halves' inset box-shadows are: every path is a button
	// filled, run through a filter that takes a colour from outside the shape,
	// (moves it,) softens it and cuts it back to inside the shape. A
	// box-shadow's blur is twice the Gaussian's deviation, and the box is 100
	// units across whatever its size on screen, so px become units by the
	// ring's size; set again when the ring resizes, and the shadow's offset
	// whenever the light moves.
	//   The glow (UV, 30 Oct: as the breaker's border glows), under the
	//   buttons, so their shadow falls on their lines and words, not on it:
	//   yellow in the break buttons, green in the special wins.
	//   The shadow (UV, 30 Oct: inside the buttons as well as out, cast by the
	//   light as everything else's): the halves' own inset shadow
	//   (--page-inset-*, offset by --page-shadow-x / -y from page-light.js),
	//   over the buttons, so it falls across a chosen one's fill and word.
	//   Their outside shadow is the score digits', on the buttons' layer
	//   (match.css, .mv-break-lines).
	const px = (name) => parseFloat(getComputedStyle(els.stage).getPropertyValue(name));

	function effectLayer(cls, filters) {
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('class', cls);
		svg.setAttribute('aria-hidden', 'true');
		const defs = document.createElementNS(SVG_NS, 'defs');
		const parts = {};
		for (const [id, steps] of Object.entries(filters)) {
			const filter = document.createElementNS(SVG_NS, 'filter');
			filter.id = id;
			for (const [k, v] of Object.entries({ x: '-50%', y: '-50%', width: '200%', height: '200%' })) filter.setAttribute(k, v);
			parts[id] = steps((name, attrs) => {
				const e = document.createElementNS(SVG_NS, name);
				for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
				filter.append(e);
				return e;
			});
			defs.append(filter);
		}
		const shapes = document.createElementNS(SVG_NS, 'g');
		svg.append(defs, shapes);
		// list: [{ d, filter, value, cls }], the filter by id, value the button's
		// (setOff finds a disabled button's glow by it), cls a class (a break
		// quadrant's moves with the yellow toggle: mv-knob-part)
		const paint = (list) => shapes.replaceChildren(...list.map(({ d, filter, value, cls }) => {
			const path = document.createElementNS(SVG_NS, 'path');
			path.setAttribute('d', d);
			path.setAttribute('filter', `url(#${filter})`);
			if (value) path.dataset.value = value;
			if (cls) path.setAttribute('class', cls);
			return path;
		}));
		return { svg, parts, paint };
	}

	function buildGlow() {
		const glow = (flood) => (prim) => {
			prim('feFlood', { class: flood, result: 'colour' });
			prim('feComposite', { in: 'colour', in2: 'SourceAlpha', operator: 'out', result: 'outside' });
			const blur = prim('feGaussianBlur', { in: 'outside', stdDeviation: '0', result: 'soft' });
			prim('feComposite', { in: 'soft', in2: 'SourceAlpha', operator: 'in' });
			return { blur };
		};
		const layer = effectLayer('mv-break-glow', { 'mv-glow-break': glow('mv-glow-flood'), 'mv-glow-win': glow('mv-glow-flood-win') });
		const size = () => {
			const box = layer.svg.getBoundingClientRect().width, glowPx = px('--match-glow-size');
			if (!(box > 0)) return;
			if (!(glowPx >= 0)) { TDC.error(AREA, 'the buttons\' glow has no size (--match-glow-size)', null, els.stageStatus); return; }
			for (const part of Object.values(layer.parts)) part.blur.setAttribute('stdDeviation', (glowPx / 2 / (box / 100)).toFixed(3));
		};
		new ResizeObserver(size).observe(layer.svg);
		return layer;
	}

	function buildInset() {
		const layer = effectLayer('mv-break-inset', { 'mv-inset': (prim) => {
			prim('feFlood', { class: 'mv-inset-flood', result: 'colour' });
			prim('feComposite', { in: 'colour', in2: 'SourceAlpha', operator: 'out', result: 'outside' });
			const move = prim('feOffset', { in: 'outside', dx: '0', dy: '0', result: 'moved' });
			const blur = prim('feGaussianBlur', { in: 'moved', stdDeviation: '0', result: 'soft' });
			prim('feComposite', { in: 'soft', in2: 'SourceAlpha', operator: 'in' });
			return { move, blur };
		} });
		const { move, blur } = layer.parts['mv-inset'];
		const root = document.documentElement;
		const place = () => {
			const box = layer.svg.getBoundingClientRect().width;
			if (!(box > 0)) return;
			const k = 100 / box, cs = getComputedStyle(root);
			const dx = parseFloat(cs.getPropertyValue('--page-shadow-x')) || 0;
			const dy = parseFloat(cs.getPropertyValue('--page-shadow-y')) || 0;
			const soft = px('--page-inset-size');
			if (!(soft >= 0)) { TDC.error(AREA, 'the buttons\' inside shadow has no size (--page-inset-size)', null, els.stageStatus); return; }
			move.setAttribute('dx', (dx * k).toFixed(3));
			move.setAttribute('dy', (dy * k).toFixed(3));
			blur.setAttribute('stdDeviation', (soft / 2 * k).toFixed(3));
		};
		new ResizeObserver(place).observe(layer.svg);
		// page-light.js writes the light's place on <html>'s style, at most 15
		// times a second
		new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ['style'] });
		return layer;
	}

	// A button: its outline and its word on an arc, as a radio
	function choice(cls, value, label, d, arcId, arcD, defs) {
		const g = document.createElementNS(SVG_NS, 'g');
		g.classList.add(cls);
		g.dataset.value = value;
		g.setAttribute('role', 'radio');
		g.setAttribute('aria-checked', 'false');
		g.setAttribute('aria-label', label);
		g.setAttribute('tabindex', '0');
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', d);
		const arc = document.createElementNS(SVG_NS, 'path');
		arc.id = arcId;
		arc.setAttribute('d', arcD);
		defs.append(arc);
		const text = document.createElementNS(SVG_NS, 'text');
		text.setAttribute('aria-hidden', 'true');
		const onArc = document.createElementNS(SVG_NS, 'textPath');
		onArc.setAttribute('href', '#' + arcId);
		onArc.setAttribute('startOffset', '50%');
		onArc.textContent = label;
		text.append(onArc);
		g.append(path, text);
		return g;
	}

	let repaintWins = null, winsBreaker = null, winsShown = null;   // buildBreak's paintWins, and the breaker and buttons (shownKey) it last drew for
	let knobSide = null;   // the side the yellow toggle stands at (placeKnob), behind the breaker while the ring's dots run
	function buildBreak() {
		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('class', 'mv-break-lines');
		const defs = document.createElementNS(SVG_NS, 'defs');
		const ring = document.createElementNS(SVG_NS, 'g');
		ring.setAttribute('role', 'radiogroup');
		ring.setAttribute('aria-label', 'Break event');
		ring.classList.add('mv-knob-part');   // slides with the yellow toggle (match.css); the special wins stay
		const wins = document.createElementNS(SVG_NS, 'g');
		wins.setAttribute('role', 'radiogroup');
		wins.setAttribute('aria-label', 'Special wins');
		svg.append(defs, ring, wins);
		for (const [value, label] of Object.entries(TDCMatchDef.BREAK_OUTCOME)) {
			if (!(value in BREAK_AT)) {
				TDC.error(AREA, `the break ring has no place for "${value}"`, null, els.stageStatus);
				continue;
			}
			ring.append(choice('mv-break-q', value, label, sector(BREAK_AT[value]), 'mv-break-arc-' + value, '', defs));
		}
		// The break words as big as fits (breakWords): each word's size and
		// its arc, by the rim
		const fitBreakWords = () => {
			const { word, middle } = breakWords();
			for (const g of ring.querySelectorAll('.mv-break-q')) {
				const value = g.dataset.value;
				defs.querySelector('#mv-break-arc-' + value).setAttribute('d', wordArc(BREAK_AT[value], word, 44, middle));
				g.querySelector('text').style.fontSize = word.toFixed(2) + 'px';
			}
		};
		fitBreakWords();
		const glow = buildGlow(), inset = buildInset();
		let buttons = [];

		// The glows inside the green pill stop at its buttons (UV, 30 Oct: a
		// glow never lies inside a button; a rectangle round the group, the
		// first way, cut it with hard edges beside their rounded corners): the
		// pill gets a mask (--mv-glow-mask, used by match.css: .mv-pill::before,
		// its own green glow and inside shadow), an SVG the size of the pill
		// inside its line, where that layer starts, and so does each half's
		// .mv-breaker-glow, the breaker's yellow glow, the size of its box;
		// each hides the glow inside the special wins,
		// each grown by half a line so no glow lies under an outline, and shows
		// it everywhere else, the gaps between them included. Drawn from the
		// same shapes as the buttons, in the ring's box placed where it sits on
		// the pill, whenever the buttons are. (Until 2 Nov the breaker's glow
		// was each screen half's, masked the same way round the ring as well;
		// the ring now slides, and its yellow pill keeps the glow clear of it.)
		const glowMasks = () => {
			const br = els.breakRing.getBoundingClientRect();
			const line = px('--match-break-stroke');
			if (!(br.width > 0) || !buttons.length) return;
			const u = br.width / 100;
			// Only what is shown (shownByRules): a hidden button leaves the glow
			const holes = buttons.filter((b) => shownByRules(b.value)).map((b) => `<path d="${b.d}"/>`).join('');
			// The breaker's glow (UV, 2 Nov: behind the buttons and the score,
			// never in them) also keeps out of the whole yellow pill, where the
			// break ring slides: two rings long, its radius --mv-knob-reach
			const reach = BREAK_RING.outer + 2 * BREAK_RING.gap, wide = landscape.matches;
			const [yw, yh] = wide ? [4 * reach, 2 * reach] : [2 * reach, 4 * reach];
			const yellow = `<rect x="${50 - yw / 2}" y="${50 - yh / 2}" width="${yw}" height="${yh}" rx="${reach}"/>`;
			for (const side of [els.pill, ...els.breakerGlows]) {
				const box = side.getBoundingClientRect(), inset = side === els.pill ? line : 0;
				const sr = { left: box.left + inset, top: box.top + inset, width: box.width - 2 * inset, height: box.height - 2 * inset };
				if (!(sr.width > 0) || !(sr.height > 0)) continue;
				const w = sr.width.toFixed(2), h = sr.height.toFixed(2);
				const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
					+ `<mask id="m"><rect width="100%" height="100%" fill="#fff"/>`
					+ `<g transform="translate(${(br.left - sr.left).toFixed(2)} ${(br.top - sr.top).toFixed(2)}) scale(${u.toFixed(4)})" fill="#000" stroke="#000" stroke-width="${(line / u).toFixed(3)}">${holes}${side === els.pill ? '' : yellow}</g></mask>`
					+ `<rect width="100%" height="100%" mask="url(#m)"/></svg>`;
				side.style.setProperty('--mv-glow-mask', `url("data:image/svg+xml,${encodeURIComponent(mask)}")`);
			}
			// The line between the halves (their inside shadow, match.css,
			// .mv-side::before) hidden behind the yellow pill while it shows
			// (UV, 2 Nov), not behind the green one
			// Since UV's next look (2 Nov), out of the whole green pill inside its
			// line, where the centre line is green (match.css, .mv-split), breaks
			// recorded or not; the yellow pill lies inside it.
			const pr = els.pill.getBoundingClientRect(), rad = Math.max(0, (parseFloat(getComputedStyle(els.pill).borderTopLeftRadius) || 0) - line);
			for (const side of [els.p0, els.p1]) {
				const sr = side.getBoundingClientRect();
				const w = sr.width.toFixed(2), h = sr.height.toFixed(2);
				const hole = `<rect x="${(pr.left - sr.left + line).toFixed(2)}" y="${(pr.top - sr.top + line).toFixed(2)}" width="${(pr.width - 2 * line).toFixed(2)}" height="${(pr.height - 2 * line).toFixed(2)}" rx="${rad.toFixed(2)}"/>`;
				const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
					+ `<mask id="m"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${hole}</g></mask>`
					+ `<rect width="100%" height="100%" mask="url(#m)"/></svg>`;
				side.style.setProperty('--mv-split-mask', `url("data:image/svg+xml,${encodeURIComponent(mask)}")`);
			}
		};
		// The buttons follow the pill, whose shape changes with the stage's
		// (UV, 2 Nov), so they are drawn again, and their masks with them,
		// whenever it resizes
		new ResizeObserver(() => paintWins()).observe(els.stage);

		// The special wins and both effect layers, drawn for how the phone is
		// held, where the pill lies and who is breaking
		const paintWins = () => {
			winsBreaker = knobSide;   // where the toggle stands, so they swap ends with it (placeKnob)
			winsShown = shownKey();
			buttons = winButtons(winsBreaker);
			const winDefs = document.createElementNS(SVG_NS, 'defs');
			wins.replaceChildren(winDefs, ...buttons.map((b) => {
				if (b.value === 'more') return moreButton(b, b.word);
				const label = TDCMatchDef.RESULT_SHORT[b.value];
				if (!label) TDC.error(AREA, `no short name for the special win "${b.value}"`, null, els.stageStatus);
				const g = choice('mv-win-q', b.value, label || b.value, b.d, 'mv-win-arc-' + b.value, wordArc(b.mid, b.word, b.half, b.wordR, b.o), winDefs);
				g.querySelector('text').style.fontSize = b.word.toFixed(2) + 'px';   // as big as fits the band (cornerBand)
				g.setAttribute('aria-label', TDCMatchDef.RESULT_EVENT[b.value] || label);
				return g;
			}));
			// The glow and inside shadow only under what is shown (shownByRules)
			const shapes = [
				...Object.keys(BREAK_AT).filter(shownByRules).map((v) => ({ d: sector(BREAK_AT[v]), kind: 'break', value: v })),
				...buttons.filter((b) => shownByRules(b.value)).map((b) => ({ d: b.d, kind: 'win', value: b.value }))
			];
			const knob = (s) => (s.kind === 'break' ? 'mv-knob-part' : undefined);
			glow.paint(shapes.map((s) => ({ d: s.d, filter: s.kind === 'break' ? 'mv-glow-break' : 'mv-glow-win', value: s.value, cls: knob(s) })));
			inset.paint(shapes.map((s) => ({ d: s.d, filter: 'mv-inset', cls: knob(s) })));
			// Offered and greyed as the match stands, once the glow is drawn, so
			// a disabled button's glow is hidden with it (setOff)
			if (MATCH && draft) paintButtons();
			requestAnimationFrame(glowMasks);   // once the turned layout is in
		};
		paintWins();
		repaintWins = paintWins;
		landscape.addEventListener('change', paintWins);
		// The words measured again in the display face once it is in, and
		// everything sized from them drawn again
		document.fonts.ready.then(() => {
			widths.clear();
			fitBreakWords();
			paintWins();
			fitScores();
		});

		svg.addEventListener('click', (e) => {
			const q = e.target.closest('.mv-break-q, .mv-win-q');
			if (!q || q.classList.contains('is-off')) return;   // disabled: nothing happens
			if (q.classList.contains('mv-break-q')) breakTap(q);
			else if (q.classList.contains('mv-more-q')) showMore();
			else specialWin(q.dataset.value);
		});
		svg.addEventListener('keydown', (e) => {
			const q = e.target.closest('.mv-break-q, .mv-win-q');
			if (!q || (e.key !== 'Enter' && e.key !== ' ')) return;
			e.preventDefault();
			q.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		els.breakRing.append(glow.svg, svg, inset.svg);
		// the ring's outside, as a share of its box: the yellow pill's glow stops there
		els.stage.style.setProperty('--mv-break-rim', String(BREAK_RING.outer * 2 / 100));
		// and how far the rings slide either way from the middle, in the box: the
		// yellow pill's radius, two quadrants' gaps outside the ring (match.css,
		// --mv-knob-reach)
		els.stage.style.setProperty('--mv-knob-reach', String(BREAK_RING.outer + 2 * BREAK_RING.gap));
	}

	// The more button: a special win's shape, three dots along its round edge
	// (about its end's centre, b.o) in place of a word (the display face has no ellipsis), a button that opens
	// the more pop-up rather than a choice.
	function moreButton(b, size) {
		const g = document.createElementNS(SVG_NS, 'g');
		g.classList.add('mv-win-q', 'mv-more-q');
		g.dataset.value = 'more';
		g.setAttribute('role', 'button');
		g.setAttribute('aria-label', 'More: walkovers, abandon the frame, pause the match');
		g.setAttribute('aria-haspopup', 'dialog');
		g.setAttribute('tabindex', '0');
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', b.d);
		g.append(path);
		const cap = CAP * size, step = (cap * 0.75 / b.wordR) * DEG;
		for (const k of [-1, 0, 1]) {
			const a = (b.mid + k * step) / DEG;
			const dot = document.createElementNS(SVG_NS, 'circle');
			dot.setAttribute('class', 'mv-more-dot');
			dot.setAttribute('cx', (b.o[0] + b.wordR * Math.cos(a)).toFixed(2));
			dot.setAttribute('cy', (b.o[1] + b.wordR * Math.sin(a)).toFixed(2));
			dot.setAttribute('r', (cap * 0.16).toFixed(2));
			g.append(dot);
		}
		return g;
	}

	function markChosen(root, sel, value) {
		for (const g of root.querySelectorAll(sel)) {
			const on = g.dataset.value === value;
			g.classList.toggle('is-on', on);
			g.setAttribute('aria-checked', String(on));
		}
	}

	buildBreak();
	buildScoreFx();
	followScores();

	// ─── The info (UV, 30 Oct; out of the break ring 3 Nov) ───────────
	// In the grey info rings (match.css, .mv-info), the old page's frame line
	// in two parts: above, the frame in play and the most frames the match
	// can take where there is a most (race to 5: 9, as 5 + 4 decides it; best
	// of n and n fixed frames: n; timed and free play: none), or Final once
	// it is decided (matchOver, as /match/ reckons it); below, the win
	// condition as /match/ words it (free play alone, the rest with their
	// number). Worked out here and written by paintInfo once the toggle's
	// next place is known (paintBreaker), never faded (UV, 3 Nov): the end
	// the break ring is about to slide over keeps what it shows until it is
	// under the ring, and is written then, so the ring it uncovers already
	// holds the new words.
	let infoWords = null;
	function paintRingIcon() {
		const rules = MATCH.rules;
		const type = rules.win_condition_type, t = Number(rules.win_condition_target);
		const most = !(t > 0) ? null : type === 'race_to' ? 2 * t - 1 : (type === 'best_of' || type === 'fixed_frames') ? t : null;
		const wc = WIN_CONDITION[type];
		if (!wc) TDC.error(AREA, `unknown win condition "${type}"`, null, els.stageStatus);
		infoWords = [
			matchOver() ? 'Final' : `Frame ${MATCH.frames.length + 1}${most ? '/' + most : ''}`,
			type === 'free_play' ? wc : `${wc || 'TDC (Error)'} ${rules.win_condition_target}`
		];
	}
	function paintInfo() {
		if (!infoWords) return;
		const shown = ringEl();
		for (const box of els.infos) {
			box.setAttribute('aria-hidden', String(box !== shown));
			const end = box.dataset.for;
			if (end === knobWant && (end !== knobSide || knobSliding)) continue;   // about to be covered: written once it is
			box.querySelectorAll('.mv-frame, .mv-target').forEach((node, i) => {
				if (node.textContent !== infoWords[i]) node.textContent = infoWords[i];
			});
		}
	}

	// The ring the dots use for every call (UV, 3 Nov: the info ring, wherever
	// it is): the middle one while breaks are not recorded; while they are,
	// the one at the end the break ring is not at; and while nobody is known
	// to break (the break ring in the middle, the ends showing only their
	// grey dots), the yellow pill, the dots on a circle along its line round
	// the break ring (UV, 3 Nov: "saves on yellow").
	function ringEl() {
		if (!els.stage.hasAttribute('data-breaks')) return els.infos.find((b) => b.dataset.for === 'middle');
		if (!knobSide) return els.yellow;
		return els.infos.find((b) => b.dataset.for === (knobSide === 'home' ? 'away' : 'home'));
	}
	const ringsBusy = () => [els.yellow, ...els.infos].some((r) => r.dataset.dots === 'busy');
	// A CSS time (0.3s, 300ms) in ms
	const timeMs = (s) => (parseFloat(s) || 0) * (/ms\s*$/.test(s) ? 1 : 1000);

	// ─── The yellow toggle (UV, 2 Nov) ────────────────────────────────
	// While breaks are recorded, a yellow pill two rings long runs round the
	// break ring, and the break ring moves in it, as
	// the team card's switches move: to the breaker's end, the middle while
	// nobody is known. The special wins swap ends with it, and the breaker's
	// yellow glow inside the green pill goes to that half (match.css,
	// --mv-knob: -1 home, 0 nobody, 1 away). It moves only once the load is
	// done: while the ring's dots run (a frame saving, another phone's frame
	// being read) it waits, and slides as they come back, as a switch's knob
	// does; a break tap sends nothing and moves nothing. Drawn where it
	// stands, without sliding, the first time (the page opening). Its side is
	// also data-knob on the stage, unset while nobody is known to break (the
	// info rings shrunk to their dots, match.css). Once a slide is over the
	// end it covered gets the new words (paintInfo).
	let knobWant = null, knobDrawn = false, knobSliding = false, slideTimer = null;
	function paintBreaker(side) {
		knobWant = MATCH && MATCH.rules.track_breaks ? side || null : null;
		els.stage.toggleAttribute('data-breaks', shownByRules('in'));
		paintInfo();
		if (!knobDrawn) { placeKnob(); return; }
		// A frame is drawn before its save is asked for, so the ring is not
		// busy yet: asked again once this task is done (measured: it slid
		// 20ms after the tap, while the save's dots ran)
		setTimeout(() => { if (!ringsBusy()) placeKnob(); }, 0);
	}
	function placeKnob() {
		if (knobSide === knobWant && knobDrawn) return;
		knobSide = knobWant;
		if (!knobDrawn) els.stage.classList.add('mv-knob-still');
		els.stage.style.setProperty('--mv-knob', knobSide === 'home' ? '-1' : knobSide === 'away' ? '1' : '0');
		if (knobSide) els.stage.dataset.knob = knobSide;
		else delete els.stage.dataset.knob;
		if (!knobDrawn) {
			knobDrawn = true;
			requestAnimationFrame(() => requestAnimationFrame(() => els.stage.classList.remove('mv-knob-still')));
		} else {
			// Written once the slide is over and the covered ring has faded out
			// altogether (the dots' reveal can slow its fade: dots.css)
			knobSliding = true;
			clearTimeout(slideTimer);
			const covered = () => {
				const box = els.infos.find((b) => b.dataset.for === knobSide);
				if (box && +getComputedStyle(box).opacity > 0) { slideTimer = setTimeout(covered, 100); return; }
				knobSliding = false;
				paintInfo();
			};
			slideTimer = setTimeout(covered, timeMs(getComputedStyle(els.stage).getPropertyValue('--control-motion')));
		}
		paintInfo();
		if (knobSide !== winsBreaker && repaintWins) repaintWins();
	}
	for (const ring of [els.yellow, ...els.infos]) {
		new MutationObserver(() => { if (!ringsBusy() && knobDrawn) placeKnob(); }).observe(ring, { attributes: true, attributeFilter: ['data-dots'] });
	}

	// ─── The stage's buttons ──────────────────────────────────────────
	// The four special wins keep their places (the stage keeps its shape),
	// but a button the match's settings rule out is hidden (UV, 30 Oct; the
	// old card's footer "offers only what the settings allow", design §2):
	// breaks not tracked, the break ring and every special win, since a
	// special win needs a break event; Break & finish off, B&F and golden
	// break; golden break off, GB; reverse B&F off, rB&F. The more button
	// always stays. One that the settings allow but that cannot act now is
	// greyed, as before (paintButtons).
	function shownByRules(value) {
		if (!MATCH || value === 'more') return true;   // drawn before the match is read: all
		const r = MATCH.rules;
		if (!r.track_breaks) return false;
		if (value === 'break_and_finish') return !!r.break_finish_enabled;
		if (value === 'golden_break') return !!(r.break_finish_enabled && r.golden_break_enabled);
		if (value === 'reverse_break_and_finish') return !!r.reverse_break_finish_enabled;
		return true;   // a break event
	}
	// What is shown, as one string, so the stage knows when to draw again.
	// A declaration, since buildBreak runs before this line is reached.
	function shownKey() {
		return [...Object.keys(BREAK_AT), ...WIN_SLOTS.flat()].filter(shownByRules).join();
	}

	// Which sides a special win can go to on the frame in play
	const winSides = (ev) => ['home', 'away'].filter((s) => resultsFor(s, draft.break_side).includes(ev));

	// Whether a button can act now: exactly match.js's rules for its
	// controls, through its own functions. The break event: renderBreakRow
	// showed it while breaks are tracked, somebody is breaking and the match
	// is not over, disabled for a watcher. A special win: renderHalf offered
	// it by resultsFor and disabled it by resultDisabled (and mbtn for a
	// watcher), with none once the match is over.
	const breakOn = () => canEdit && MATCH.rules.track_breaks && !!draft.break_side && !matchOver();
	const winOn = (ev) => canEdit && !matchOver() && winSides(ev).length > 0 && !resultDisabled(ev);

	// The break ring and the special wins, as the match stands. Called by
	// renderStage, and by buildBreak when the phone turns and they are drawn
	// again. A button that cannot act is disabled, as the old page's were:
	// greyed, out of the tab order, and a tap on it does nothing (UV, 30 Oct).
	function paintButtons() {
		for (const q of els.breakRing.querySelectorAll('.mv-break-q, .mv-win-q')) {
			const gone = !shownByRules(q.dataset.value);
			q.classList.toggle('is-gone', gone);
			q.toggleAttribute('aria-hidden', gone);
		}
		for (const q of els.breakRing.querySelectorAll('.mv-break-q')) setOff(q, !breakOn());
		markChosen(els.breakRing, '.mv-break-q', draft.break_outcome);
		for (const q of els.breakRing.querySelectorAll('.mv-win-q:not(.mv-more-q)')) {
			setOff(q, !winOn(q.dataset.value));
			q.setAttribute('aria-checked', 'false');
		}
	}
	function setOff(q, off) {
		q.classList.toggle('is-off', off);
		// and its glow, a layer of its own under the buttons (UV, 30 Oct: a
		// disabled button is grey with no glow; match.css)
		const glow = els.breakRing.querySelector(`.mv-break-glow path[data-value="${q.dataset.value}"]`);
		if (glow) glow.classList.toggle('is-off', off);
		q.setAttribute('aria-disabled', String(off));
		q.setAttribute('tabindex', off || q.classList.contains('is-gone') ? '-1' : '0');
	}

	// A break ring button: setOutcome. No dots: nothing is sent to the
	// network, and on this page the dots are the cream ring's, for network
	// calls (UV, 30 Oct); a pretend 0.2 s wait blanked the ring for a second
	// on every tap (UV: "glitching").
	function breakTap(q) {
		if (!MATCH || q.classList.contains('is-off')) return;
		setOutcome(q.dataset.value);
	}

	// A special win: the frame to the side it can go to, or the page asks
	// whose when the rules allow either (B&F without "needs the breaker").
	function specialWin(ev) {
		if (!MATCH || !winOn(ev)) return;
		const sides = winSides(ev);
		if (sides.length === 1) { saveFrame(sides[0], ev); return; }
		showWhoOverlay(ev, sides);
	}

	// "Offline · n waiting" and "Someone else has scored" said on the stage
	// too (UV, 30 Oct): the notice is under the stage, out of sight while
	// scoring. A line of its own over the stage's foot, so it never takes the
	// place of a message on the status line.
	let noteOffline = '';
	let noteStale = '';
	function paintStageNote() {
		els.stageNote.textContent = [noteStale, noteOffline].filter(Boolean).join(' · ');
	}

	function setOutcome(value) {
		if (!canEdit) return;
		if (!value || draft.break_outcome === value) return;
		draft.break_outcome = value;
		draft.remoteBreak = false;   // this phone's own now, if it was another's
		// Entering a break event is what starts the frame and ends racking.
		beginFrame();
		TDC.status(els.stageStatus, '', '');
		saveBreakInPlay();
		renderStage();
		renderTimePanel();
		renderHistory();
	}

	let whoDrawn = null;
	function renderStage() {
		// The frame in play and what the match is played to, in the ring
		paintRingIcon();

		if (overlayMode === null) {
			const needsBreak = MATCH.rules.track_breaks && !draft.break_side && !matchOver();
			if (needsBreak) showBreakOverlay();
			else els.overlay.hidden = true;
		}

		// renderHalf's work, on the new stage: the score, who breaks, the
		// names and pictures (drawn again only when the people change), and
		// the score and name as the plain-win button while a win can be given.
		const digits = Math.max(String(framesWon('home')).length, String(framesWon('away')).length);
		paintScore(els.scoreHome, framesWon('home'), digits);
		paintScore(els.scoreAway, framesWon('away'), digits);
		paintBreaker(draft.break_side);
		const who = ['home', 'away'].map((s) => JSON.stringify(player(MATCH[s].players[0]))).join('|');
		if (who !== whoDrawn) {
			whoDrawn = who;
			paintWho(els.whoHome, player(MATCH.home.players[0]));
			paintWho(els.whoAway, player(MATCH.away.players[0]));
			// On the stage a picture opens the player's profile (UV, 5 Nov);
			// the More pop-up's walkover boxes are buttons and keep theirs.
			TDC.profilePic(els.whoHome.querySelector('.mv-pic'), MATCH.home.players[0]);
			TDC.profilePic(els.whoAway.querySelector('.mv-pic'), MATCH.away.players[0]);
			placeWho();   // sized to the new names (fitWho)
		}
		const winnable = !matchOver() && canEdit && !resultDisabled('win');
		for (const [half, side] of [[els.p0, 'home'], [els.p1, 'away']]) {
			half.toggleAttribute('data-winnable', winnable);
			const name = MATCH[side].name;
			// the score (for the keyboard) and the player's half of the green
			// pill (the tap, .mv-hit; UV, 2 Nov: only the space inside the pill),
			// no longer the name
			for (const part of half.querySelectorAll('.mv-score, .mv-hit')) {
				if (winnable) Object.assign(part.dataset, { act: 'result', side, value: 'win' });
				else { delete part.dataset.act; delete part.dataset.side; delete part.dataset.value; }
			}
			const score = half.querySelector('.mv-score');
			score.setAttribute('role', 'button');
			score.tabIndex = winnable ? 0 : -1;
			score.setAttribute('aria-disabled', String(!winnable));
			score.setAttribute('aria-label', `${name}: ${framesWon(side)}. Tap to give ${name} this frame`);
		}
		// renderBreakRow's and the special wins' work: the break ring and the
		// special wins, enabled as the pill and the rings were; drawn again
		// first when the settings have changed, so a button ruled out goes
		// (shownByRules). B&F and GB move to the breaker's end with the
		// yellow toggle (paintBreaker, above).
		if (shownKey() !== winsShown) repaintWins();
		else paintButtons();
	}

	// ─────────────────────────────────────────────────────────────────
	// Timing panel
	// ─────────────────────────────────────────────────────────────────

	const isRacking = () => frameStartedAt === null && !matchOver();

	function renderTimePanel() {
		const r = MATCH.rules;
		const body = els.timeBody;
		for (const k of Object.keys(liveVals)) delete liveVals[k];
		body.replaceChildren();

		body.append(readout('State',
			matchOver() ? 'Match over' : (isRacking() ? 'Racking' : `Frame ${MATCH.frames.length + 1} running`)));
		body.append(readout('Table', draft.table));
		body.append(readout('Rack time', '—', { live: 'rack' }));
		body.append(readout('Frame time', '—', { live: 'frame' }));
		body.append(readout('Match time', '—', { live: 'match' }));

		const pauseRow = div('time-actions');
		pauseRow.append(
			mbtn(timerRunning(frameTimer) ? 'Pause frame' : 'Resume frame', '', { act: 'toggleframe' },
				frameStartedAt === null || !!matchOver()),
			mbtn(timerRunning(matchTimer) ? 'Pause match' : 'Resume match', '', { act: 'togglematchtimer' }, !!matchOver())
		);
		body.append(pauseRow);

		// There is no break event to start the clock on when breaks are not
		// being recorded, so the explanation has to say what actually happens.
		body.append(div('time-note', r.track_breaks
			? 'Racking starts when the last frame ends. The frame starts when a break event is entered, and ends when a result is pressed. Pausing records the stoppage separately, so stalling still shows in the wall clock.'
			: 'A frame runs from the end of the last one until a result is pressed. Pausing records the stoppage separately, so stalling still shows in the wall clock.'));

		if (r.shot_clock_enabled) {
			body.append(heading('h3', 'Shot clock'));
			body.append(readout('On the clock', '—', { live: 'shotside' }));
			body.append(readout('Remaining', '—', { live: 'shot' }));

			const turns = div('time-actions');
			turns.append(
				mbtn(MATCH.home.name, '', { act: 'turn', side: 'home' }, !!matchOver()),
				mbtn(MATCH.away.name, '', { act: 'turn', side: 'away' }, !!matchOver())
			);
			body.append(turns);

			const ctrl = div('time-actions');
			ctrl.append(
				mbtn(clock.running ? 'Pause shot' : 'Resume shot', '', { act: 'toggleshot' }, !clock.side || !!matchOver()),
				mbtn('Reset shot', '', { act: 'resetshot' }, !clock.side || !!matchOver())
			);
			body.append(ctrl);

			if (r.extensions_per_player > 0) {
				body.append(heading('h3', 'Extensions'));
				for (const side of ['home', 'away']) {
					const row = div('ext-line');
					row.append(div('time-key', MATCH[side].name));
					const pips = div('ext-pips');
					const left = extensionsLeft(side);
					for (let i = 0; i < r.extensions_per_player; i++) pips.append(div('pip' + (i < left ? ' on' : '')));
					row.append(pips);
					row.append(mbtn(`+${r.extension_seconds}s`, 'ext', { act: 'ext', side },
						left <= 0 || clock.side !== side || !(clock.running || clock.expired)));
					body.append(row);
				}
				body.append(div('time-note', 'An extension can only be given to the side currently on the clock.'));
			}
		}

		if (r.max_match_minutes > 0) {
			body.append(heading('h3', 'Match clock'));
			body.append(readout('Remaining', '—', { live: 'matchclock' }));
			body.append(readout('When it runs out', TIME_EXPIRY[r.on_time_expiry] || 'TDC (Error)'));
		}

		if (!r.shot_clock_enabled && r.max_match_minutes === 0) {
			body.append(div('time-note', 'No shot clock and no match clock for this match. Both are turned on in Match settings.'));
		}

		paintTimes();
	}

	function paintTimes() {
		// Four times a second, so only what has changed is written: an unchanged
		// readout written again still costs a style pass (3 Nov: battery)
		const set = (key, text, cls) => {
			const v = liveVals[key];
			if (!v) return;
			if (v.textContent !== text) v.textContent = text;
			if (cls === undefined) return;
			const name = 'time-readout' + (cls ? ' ' + cls : '');
			if (v.parentElement.className !== name) v.parentElement.className = name;
		};

		set('rack', mmss(timerSeconds(rackTimer)), timerRunning(rackTimer) ? 'live' : '');
		set('frame', frameStartedAt === null ? '—' : mmss(timerSeconds(frameTimer)),
			frameStartedAt !== null && timerRunning(frameTimer) ? 'live' : '');
		set('match', mmss(timerSeconds(matchTimer)), timerRunning(matchTimer) ? 'live' : '');
		if (liveMatchClock) {
			const so = dur(matchSoFar());
			if (liveMatchClock.textContent !== so) liveMatchClock.textContent = so;
		}

		if (MATCH.rules.shot_clock_enabled) {
			const onClock = clock.side && (clock.running || clock.expired);
			set('shotside', onClock ? MATCH[clock.side].name : 'Nobody');
			set('shot',
				onClock ? `${Math.ceil(clock.remaining)}s` : `${shotLength()}s`,
				clock.expired ? 'expired' : (clock.running && clock.remaining <= 10 ? 'warn' : (clock.running ? 'live' : '')));
		}

		if (MATCH.rules.max_match_minutes > 0) {
			const left = MATCH.rules.max_match_minutes * 60 - timerSeconds(matchTimer);
			set('matchclock', left <= 0 ? 'TIME' : mmss(left), left <= 0 ? 'expired' : (timerRunning(matchTimer) ? 'live' : ''));
		}
	}

	function tick() {
		if (clock.running) {
			clock.remaining -= 0.25;
			if (clock.remaining <= 0) {
				clock.remaining = 0;
				clock.running = false;
				clock.expired = true;
				TDC.status(els.stageStatus, `Time foul — ${MATCH[clock.side].name}.`, 'error');
				renderTimePanel();
				return;
			}
		}
		paintTimes();
	}

	// ─────────────────────────────────────────────────────────────────
	// Frame history
	//
	// Two tables for the two orientations, both from the same frames, shown
	// and hidden by CSS rather than by listening for rotation. Every cell is
	// a correction waiting to happen; the scoreboard follows because the
	// score is counted from these frames rather than stored.
	// ─────────────────────────────────────────────────────────────────

	function cell(tag, text, cls, dataset) {
		const c = document.createElement(tag);
		if (cls) c.className = cls;
		if (text !== undefined) c.textContent = text;

		// A history cell carries its action in a data attribute rather than
		// being a button, so it needs the same read-only rule applied by hand:
		// to a watcher it is a number to read, not a control to press.
		if (dataset && !canEdit && WRITE_ACTS.has(dataset.act)) {
			if (cls) c.className = cls.replace(/\bedit\b/g, '').trim();
			return c;
		}
		if (dataset) Object.assign(c.dataset, dataset);
		return c;
	}

	// What the tables show, counted from each frame. Seconds a frame was
	// played (stoppages taken out) and its rack took; null where the frame
	// does not have the times.
	const frameSecs = (f) => (f.started_at && f.ended_at
		? Math.max(0, (f.ended_at - f.started_at) / 1000 - (f.paused_seconds || 0)) : null);
	const rackSecs = (f) => (f.rack_started_at && f.started_at
		? Math.max(0, (f.started_at - f.rack_started_at) / 1000) : null);
	const sum = (list) => list.reduce((t, v) => t + v, 0);
	const avgOf = (list) => (list.length ? sum(list) / list.length : null);
	const timesOf = (frames, fn) => frames.map(fn).filter((v) => v !== null);

	// A length of time as m:ss, or h:mm:ss from the hour.
	function dur(s) {
		if (s === null || s === undefined) return '–';
		s = Math.max(0, Math.round(s));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const ss = String(s % 60).padStart(2, '0');
		return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
	}
	const timeLine = (cls, s) => div(cls, dur(s));

	// The frame being played, unless the match is over: its number, who is
	// breaking and what they did, and its rack time once racking is done.
	function inPlay() {
		if (matchOver()) return null;
		return {
			no: MATCH.frames.length + 1,
			break_side: draft.break_side,
			break_outcome: draft.break_outcome,
			rack: frameStartedAt !== null ? (frameStartedAt - rackStartedAt) / 1000 : null
		};
	}

	// A side's Break cell: the event in yellow, or a yellow dot when we know
	// they broke but nothing was recorded.
	function breakMark(f, side) {
		if (f.break_side !== side) return null;
		return f.break_outcome ? div('hb-event', BREAK_OUTCOME[f.break_outcome]) : div('hb-dot');
	}

	// A side's Frame cell: a green dot for a win, ringed yellow for a golden
	// break and green for a break & finish. A reverse B&F is a plain dot (UV,
	// 26 Oct). An abandoned frame is a dash on both sides.
	function winMark(f, side) {
		if (f.status === 'abandoned') return div('hw-none', '–');
		if (f.status !== 'complete' || f.winner_side !== side) return null;
		const ring = f.result_event === 'golden_break' ? ' ring-gb'
			: (f.result_event === 'break_and_finish' ? ' ring-bf' : '');
		const d = div('hw-dot' + ring);
		d.title = RESULT_EVENT[f.result_event] || '';
		return d;
	}

	const tr = (cls) => {
		const r = document.createElement('tr');
		if (cls) r.className = cls;
		return r;
	};
	const spanning = (tag, text, cls, cols, rows) => {
		const c = cell(tag, text, cls);
		if (cols) c.colSpan = cols;
		if (rows) c.rowSpan = rows;
		return c;
	};

	// Portrait: a row per frame. Each player's name over their Break and
	// Frame columns, the frame number down the middle, home on the left (UV,
	// 26 Oct). Rack time in yellow under the break, frame time in green under
	// the win. The break columns go when breaks are not recorded.
	function renderTallTable() {
		const t = els.tallTable;
		t.replaceChildren();
		const play = inPlay();
		if (!MATCH.frames.length && !play) return;
		const breaks = MATCH.rules.track_breaks;
		const span = breaks ? 2 : 1;

		const thead = document.createElement('thead');
		const names = tr();
		names.append(spanning('th', MATCH.home.name, 'hn', span), cell('th', '#', 'col-no'),
			spanning('th', MATCH.away.name, 'hn', span));
		const heads = tr('sub-head');
		if (breaks) heads.append(cell('th', 'Break'));
		heads.append(cell('th', 'Frame'), cell('th', '', 'col-no'), cell('th', 'Frame'));
		if (breaks) heads.append(cell('th', 'Break'));
		thead.append(names, heads);
		t.append(thead);

		const breakCell = (f, side, editable) => {
			const c = cell('td', undefined, 'hb' + (editable ? ' edit' : ''), editable ? { act: 'editbreak', no: f.no } : undefined);
			const m = breakMark(f, side);
			const rack = editable ? rackSecs(f) : f.rack;
			if (m) {
				c.append(m);
				if (rack !== null && rack !== undefined) c.append(timeLine('t-rack', rack));
			}
			return c;
		};
		const frameCell = (f, side) => {
			const c = cell('td', undefined, 'hw edit', { act: 'editside', no: f.no, side });
			const m = winMark(f, side);
			if (m) {
				c.append(m);
				if (f.winner_side === side && frameSecs(f) !== null) c.append(timeLine('t-frame', frameSecs(f)));
			}
			return c;
		};

		const body = document.createElement('tbody');
		for (const f of MATCH.frames) {
			const row = tr();
			if (breaks) row.append(breakCell(f, 'home', true));
			row.append(frameCell(f, 'home'), cell('td', f.no, 'col-no'), frameCell(f, 'away'));
			if (breaks) row.append(breakCell(f, 'away', true));
			body.append(row);
		}
		// The frame in play, lightly shaded: who is breaking, and their rack
		// time once racking is done.
		if (play) {
			const row = tr('in-play');
			if (breaks) row.append(breakCell(play, 'home', false));
			row.append(cell('td', '', 'hw'), cell('td', play.no, 'col-no'), cell('td', '', 'hw'));
			if (breaks) row.append(breakCell(play, 'away', false));
			body.append(row);
		}
		t.append(body);

		// Totals: frames won, large and green, with the time of the frames
		// won under them; breaks taken in yellow, with their rack time.
		const tfoot = document.createElement('tfoot');
		const row = tr('totals');
		const totBreak = (side) => {
			const c = cell('td', undefined, 'hb');
			const mine = MATCH.frames.filter((f) => f.break_side === side);
			c.append(div('tot-breaks', mine.length));
			const racks = timesOf(mine, rackSecs);
			if (racks.length) c.append(timeLine('t-rack', sum(racks)));
			return c;
		};
		const totWon = (side) => {
			const c = cell('td', undefined, 'hw');
			c.append(div('tot-won', framesWon(side)));
			const played = timesOf(completed().filter((f) => f.winner_side === side), frameSecs);
			if (played.length) c.append(timeLine('t-frame', sum(played)));
			return c;
		};
		if (breaks) row.append(totBreak('home'));
		row.append(totWon('home'), cell('td', '', 'col-no'), totWon('away'));
		if (breaks) row.append(totBreak('away'));
		tfoot.append(row);
		t.append(tfoot);
	}

	// Landscape: frames across (headed 1, 2, 3 …), Total last. Each player's
	// Break and Frame rows either side of a time row, the name down the side
	// over its two rows. With the timeline on (design §9, an experiment) the
	// time row marks each rack with a yellow tick at the frame's left edge and
	// a grey line runs through every win (drawTimeline()).
	function renderWideTable() {
		const t = els.wideTable;
		t.replaceChildren();
		const play = inPlay();
		const frames = MATCH.frames;
		if (!frames.length && !play) return;
		const breaks = MATCH.rules.track_breaks;
		const tl = timelineOn();

		// "By time" (the timeline's test variant): a frame's column is as wide
		// as its rack and play took, with a floor so a quick frame still reads.
		const lens = frames.map((f) => (rackSecs(f) || 0) + (frameSecs(f) || 0));
		const known = lens.filter(Boolean);
		const byTime = tl && widthsByTime() && known.length > 0;
		const mean = byTime ? avgOf(known) : 0;
		const cols = document.createElement('colgroup');
		const col = (w) => {
			const c = document.createElement('col');
			if (w) c.style.width = w;
			return c;
		};
		cols.append(col(), col());
		for (const len of lens) cols.append(col(byTime ? Math.max(44, Math.round((len || mean) / mean * 72)) + 'px' : null));
		if (play) cols.append(col());
		cols.append(col());
		t.append(cols);
		t.classList.toggle('timeline', tl);
		t.classList.toggle('by-time', byTime);

		const head = tr('row-head');
		head.append(spanning('th', '', 'row-name', 2));
		for (const f of frames) head.append(cell('th', f.no));
		if (play) head.append(cell('th', play.no, 'in-play'));
		head.append(cell('th', 'Total', 'col-total'));

		const sideRows = (side, order) => {
			const rows = [];
			for (const kind of order) {
				if (kind === 'break' && !breaks) continue;
				const row = tr('row-' + kind);
				row.append(cell('th', kind === 'break' ? 'Break' : 'Frame', 'row-label'));
				for (const f of frames) {
					if (kind === 'break') {
						const c = cell('td', undefined, 'hb edit', { act: 'editcell', field: 'break_outcome', no: f.no });
						const m = breakMark(f, side);
						if (m) c.append(m);
						row.append(c);
					} else {
						const c = cell('td', undefined, 'hw edit', { act: 'editside', no: f.no, side });
						const m = winMark(f, side);
						if (m) { m.dataset.no = f.no; c.append(m); }
						row.append(c);
					}
				}
				if (play) {
					const c = cell('td', undefined, (kind === 'break' ? 'hb' : 'hw') + ' in-play');
					const m = kind === 'break' ? breakMark(play, side) : null;
					if (m) c.append(m);
					row.append(c);
				}
				const tot = cell('td', undefined, 'col-total');
				tot.append(kind === 'break'
					? div('tot-breaks', frames.filter((f) => f.break_side === side).length)
					: div('tot-won', framesWon(side)));
				row.append(tot);
				rows.push(row);
			}
			rows[0].prepend(spanning('th', MATCH[side].name, 'row-name', 0, rows.length));
			return rows;
		};

		// Rack in yellow over frame in green; with the timeline on, the rack at
		// the frame's left edge over its tick and the frame time in the middle.
		const timeRow = tr('row-time');
		timeRow.append(spanning('th', tl ? '' : 'Time', 'row-name', 2));
		for (const f of frames) {
			const c = cell('td', undefined, 'ht');
			if (rackSecs(f) !== null) c.append(timeLine('t-rack', rackSecs(f)));
			if (frameSecs(f) !== null) c.append(timeLine('t-frame', frameSecs(f)));
			timeRow.append(c);
		}
		if (play) {
			const c = cell('td', undefined, 'ht in-play');
			if (play.rack !== null) c.append(timeLine('t-rack', play.rack));
			timeRow.append(c);
		}
		const total = cell('td', undefined, 'ht col-total');
		const racks = timesOf(frames, rackSecs);
		const played = timesOf(frames, frameSecs);
		if (racks.length) total.append(timeLine('t-rack', sum(racks)));
		if (played.length) total.append(timeLine('t-frame', sum(played)));
		timeRow.append(total);

		t.append(head, ...sideRows('home', ['break', 'frame']), timeRow, ...sideRows('away', ['frame', 'break']));
	}

	// ─── The timeline (design §9) ───
	// An experiment: UV decides whether it stays. Landscape only. Whether it
	// is drawn, and its column widths, are this viewer's choice, remembered
	// in this browser when it can be.
	const TL_KEY = 'tdc.match.timeline';
	let tlPrefs = (() => {
		try { return JSON.parse(localStorage.getItem(TL_KEY)) || {}; } catch { return {}; }
	})();
	const timelineOn = () => tlPrefs.timeline !== false;
	const widthsByTime = () => tlPrefs.widths === true;
	function setTimelinePref(key, value) {
		tlPrefs = Object.assign({}, tlPrefs, { [key]: value });
		try { localStorage.setItem(TL_KEY, JSON.stringify(tlPrefs)); } catch { /* kept for this visit only */ }
	}

	// One smooth grey line behind the table: from the base line at the first
	// rack tick, through every win dot above and below the time row (an
	// abandoned frame's point is on the base line), and a dashed tail to the
	// frame in play. A Catmull-Rom spline through the points, as Béziers.
	function drawTimeline() {
		const svg = els.tlLine;
		svg.replaceChildren();
		const t = els.wideTable;
		const timeRow = t.querySelector('tr.row-time');
		if (!timelineOn() || !timeRow || !els.wideBox.offsetWidth) return;

		const box = els.wideBox.getBoundingClientRect();
		const rowBox = timeRow.getBoundingClientRect();
		const base = rowBox.top + rowBox.height / 2 - box.top;
		const cells = [...timeRow.querySelectorAll('td.ht:not(.col-total)')];
		if (!cells.length) return;
		const centre = (r) => r.left + r.width / 2 - box.left;

		const pts = [[cells[0].getBoundingClientRect().left - box.left, base]];
		MATCH.frames.forEach((f, i) => {
			const dot = t.querySelector(`.hw-dot[data-no="${f.no}"]`);
			const r = (dot || cells[i]).getBoundingClientRect();
			pts.push([centre(r), dot ? r.top + r.height / 2 - box.top : base]);
		});
		const tail = cells.length > MATCH.frames.length;
		if (tail) pts.push([centre(cells[MATCH.frames.length].getBoundingClientRect()), base]);
		if (pts.length < 2) return;

		const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
		const xy = (p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
		const seg = (i) => {
			const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
			const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
			const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
			return ` C${xy(c1)} ${xy(c2)} ${xy(p2)}`;
		};
		const NS = 'http://www.w3.org/2000/svg';
		const path = (d, cls) => {
			const p = document.createElementNS(NS, 'path');
			p.setAttribute('d', d);
			p.setAttribute('class', cls);
			svg.append(p);
		};
		svg.setAttribute('width', t.offsetWidth);
		svg.setAttribute('height', t.offsetHeight);
		svg.setAttribute('viewBox', `0 0 ${t.offsetWidth} ${t.offsetHeight}`);

		const solid = tail ? pts.length - 2 : pts.length - 1;
		let d = 'M' + xy(pts[0]);
		for (let i = 0; i < solid; i++) d += seg(i);
		if (solid > 0) path(d, 'tl-solid');
		if (tail) path('M' + xy(pts[solid]) + seg(solid), 'tl-tail');
	}

	function renderHistory() {
		// The cells are about to be replaced, so an anchor into them is stale.
		if (cellMenuOpen) closeCellMenu();
		const n = MATCH.frames.length;
		els.undoRow.hidden = n === 0 || !canEdit;
		els.undoSlide.dataset.label = n ? `Slide to undo frame ${n}` : 'Slide to undo the last frame';
		renderTallTable();
		renderWideTable();
		els.tlToggle.textContent = timelineOn() ? 'Timeline on' : 'Timeline off';
		els.tlWidths.textContent = widthsByTime() ? 'Widths by time' : 'Widths even';
		els.tlWidths.hidden = !timelineOn();
		els.historyLegend.textContent = n
			? 'Tap any cell to correct it; the score follows.'
			: 'No frames played yet.';
		drawTimeline();
		renderStats();
	}

	// ─────────────────────────────────────────────────────────────────
	// Stats (design §7 and §8). Every number is counted from the frames on
	// each render; nothing here is stored.
	// ─────────────────────────────────────────────────────────────────

	let liveMatchClock = null;   // the "match time so far" cell, kept going by paintTimes()

	// From the first frame's rack to now, or to the last frame's end once the
	// match is over. The match clock is counted from the frames too
	// (syncClocks()), so before the first frame it is the page's own.
	function matchSoFar() {
		const frames = MATCH.frames;
		const first = frames.length ? (frames[0].rack_started_at || frames[0].started_at) : null;
		const last = frames.length ? frames[frames.length - 1] : null;
		if (matchOver() && first && last.ended_at) return (last.ended_at - first) / 1000;
		return timerSeconds(matchTimer);
	}

	function renderStats() {
		liveMatchClock = null;
		els.statsPanel.hidden = !MATCH.frames.length;
		if (!MATCH.frames.length) return;
		const r = MATCH.rules;
		const done = completed();
		const won = (side, test) => done.filter((f) => f.winner_side === side && test(f)).length;
		const by = (ev) => (f) => f.result_event === ev;
		const broke = (side) => MATCH.frames.filter((f) => f.break_side === side);

		// Each player's: home · what · away.
		const p = els.playerStats;
		p.replaceChildren();
		const ph = document.createElement('thead');
		const phr = tr();
		phr.append(cell('th', MATCH.home.name, 'ps-side'), cell('th', ''), cell('th', MATCH.away.name, 'ps-side'));
		ph.append(phr);
		p.append(ph);
		const group = (title, cls, rows) => {
			const body = document.createElement('tbody');
			if (cls) body.className = cls;
			const g = tr('st-group');
			g.append(spanning('th', title, '', 3));
			body.append(g);
			for (const [label, fn, rowCls] of rows) {
				const row = tr(rowCls);
				const home = cell('td', String(fn('home')), 'st-v'), away = cell('td', String(fn('away')), 'st-v');
				home.dataset.live = 'ps|' + label + '|home';
				away.dataset.live = 'ps|' + label + '|away';
				row.append(home, cell('th', label, 'st-k'), away);
				body.append(row);
			}
			p.append(body);
		};

		const frameRows = [['Frames won', (s) => framesWon(s), 'st-won']];
		if (r.track_breaks && r.break_finish_enabled) frameRows.push(['Break & finish', (s) => won(s, by('break_and_finish'))]);
		if (r.track_breaks && r.golden_break_enabled) frameRows.push(['Golden break', (s) => won(s, by('golden_break'))]);
		if (r.track_breaks && r.reverse_break_finish_enabled) frameRows.push(['Reverse B&F', (s) => won(s, by('reverse_break_and_finish'))]);
		frameRows.push(['Won by default', (s) => won(s, by('default'))]);
		if (r.track_breaks) {
			frameRows.push(['Won on own break', (s) => won(s, (f) => f.break_side === s)]);
			frameRows.push(['Won on the other\'s break', (s) => won(s, (f) => f.break_side === otherSide(s))]);
		}
		frameRows.push(['Average frame won', (s) => dur(avgOf(timesOf(done.filter((f) => f.winner_side === s), frameSecs)))]);
		group('Frames', '', frameRows);

		if (r.track_breaks) {
			const breakRows = [['Breaks taken', (s) => broke(s).length]];
			for (const [k, label] of Object.entries(BREAK_OUTCOME)) {
				breakRows.push([label, (s) => broke(s).filter((f) => f.break_outcome === k).length]);
			}
			breakRows.push(['Not recorded', (s) => broke(s).filter((f) => !f.break_outcome).length]);
			group('Breaks', 'st-yellow', breakRows);

			// The breaker racks their own frame (UV, 26 Oct), so a rack is the
			// breaker's.
			const racks = (s) => timesOf(broke(s), rackSecs);
			group('Racking', 'st-yellow', [
				['Racks', (s) => racks(s).length],
				['Rack time', (s) => (racks(s).length ? dur(sum(racks(s))) : '–')],
				['Average rack', (s) => dur(avgOf(racks(s)))]
			]);
		}

		// The match's: what · value.
		const m = els.matchStats;
		m.replaceChildren();
		const mgroup = (title, rows) => {
			const body = document.createElement('tbody');
			const g = tr('st-group');
			g.append(spanning('th', title, '', 2));
			body.append(g);
			for (const [label, value, rowCls] of rows) {
				const row = tr(rowCls);
				const v = cell('td', value, 'st-v');
				row.append(cell('th', label, 'st-k'), v);
				// The ticking match clock changes every second: not faded.
				if (rowCls === 'live') liveMatchClock = v;
				else v.dataset.live = 'ms|' + title + '|' + label;
				body.append(row);
			}
			m.append(body);
		};

		const play = inPlay();
		const wc = WIN_CONDITION[r.win_condition_type] || 'TDC (Error)';
		mgroup('Result', [
			['Score', `${framesWon('home')} – ${framesWon('away')}`],
			r.win_condition_type === 'free_play' ? ['Format', wc] : [wc, String(r.win_condition_target)],
			['Frames played', String(MATCH.frames.length) + (play ? `, frame ${play.no} in play` : '')]
		]);

		const timed = MATCH.frames.filter((f) => frameSecs(f) !== null);
		const racks = timesOf(MATCH.frames, rackSecs);
		const timeRows = [[matchOver() ? 'Match time' : 'Match time so far', dur(matchSoFar()), 'live']];
		if (timed.length) {
			const longest = timed.reduce((a, f) => (frameSecs(f) > frameSecs(a) ? f : a));
			const shortest = timed.reduce((a, f) => (frameSecs(f) < frameSecs(a) ? f : a));
			timeRows.push(['Playing time', dur(sum(timed.map(frameSecs)))]);
			if (racks.length) timeRows.push(['Racking time', dur(sum(racks))]);
			timeRows.push(['Average frame', dur(avgOf(timed.map(frameSecs)))]);
			if (racks.length) timeRows.push(['Average rack', dur(avgOf(racks))]);
			timeRows.push(['Longest frame', `${dur(frameSecs(longest))} (frame ${longest.no})`]);
			timeRows.push(['Shortest frame', `${dur(frameSecs(shortest))} (frame ${shortest.no})`]);
		}
		mgroup('Time', timeRows);

		if (r.track_breaks) {
			const pct = (a, b) => (b ? `${a} of ${b} (${Math.round(a / b * 100)}%)` : '–');
			const decided = done.filter((f) => f.break_side && f.winner_side);
			const recorded = MATCH.frames.filter((f) => f.break_outcome);
			mgroup('Breaks', [
				['Breaker won the frame', pct(decided.filter((f) => f.winner_side === f.break_side).length, decided.length)],
				['A ball in off the break', pct(recorded.filter((f) => f.break_outcome === 'in').length, recorded.length)]
			]);
		}
	}

	const frameByNo = (no) => MATCH.frames.find((x) => x.no === Number(no));

	// Portrait: tapping a side's cell says that side won, and offers only the
	// results that fit who broke.
	function editSide(no, side, anchor) {
		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'no frame numbered ' + no, null, els.stageStatus); return; }
		openCellMenu(anchor, `Frame ${f.no} — ${MATCH[side].name}`, [
			...resultsFor(side, f.break_side).map((ev) =>
				mbtn(RESULT_EVENT[ev], f.winner_side === side && f.result_event === ev && f.status === 'complete' ? 'on' : '',
					{ act: 'setcell', field: 'result', no, value: side + ':' + ev })),
			mbtn('Abandoned', f.status === 'abandoned' ? 'on' : '', { act: 'setcell', field: 'result', no, value: 'abandoned' })
		], 'Only the results that fit who broke are offered.');
	}

	// Portrait: the middle cell covers both break fields.
	function editBreak(no, anchor) {
		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'no frame numbered ' + no, null, els.stageStatus); return; }
		cellAnchor = anchor;
		openCellMenu(anchor, `Frame ${f.no} — the break`, [
			mbtn('Who broke', '', { act: 'editcell', field: 'break_side', no }),
			mbtn('Break event', '', { act: 'editcell', field: 'break_outcome', no })
		], 'Who broke, and what happened.');
	}

	function editCell(field, no, anchor) {
		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'no frame numbered ' + no, null, els.stageStatus); return; }
		if (anchor) cellAnchor = anchor;

		if (field === 'break_side') {
			openCellMenu(cellAnchor, `Frame ${f.no} — who broke?`, [
				mbtn(MATCH.home.name, f.break_side === 'home' ? 'on' : '', { act: 'setcell', field, no, value: 'home' }),
				mbtn(MATCH.away.name, f.break_side === 'away' ? 'on' : '', { act: 'setcell', field, no, value: 'away' }),
				mbtn('Back to the rule', '', { act: 'setcell', field, no, value: 'auto' }, !f.break_side_manual)
			], f.break_side_manual
				? 'Set by hand, so the break rule leaves it alone.'
				: `Currently derived from "${BREAK_DETERMINATION[MATCH.rules.break_determination]}". Changing it here fixes it in place.`);
		} else if (field === 'break_outcome') {
			openCellMenu(cellAnchor, `Frame ${f.no} — on the break`, [
				...Object.entries(BREAK_OUTCOME).map(([v, label]) =>
					mbtn(label, f.break_outcome === v ? 'on' : '', { act: 'setcell', field, no, value: v })),
				mbtn('None', f.break_outcome === null ? 'on' : '', { act: 'setcell', field, no, value: 'none' })
			], 'Scratch is the cue ball pocketed. Foul is anything else.');
		} else if (field === 'result') {
			const buttons = [];
			for (const side of ['home', 'away']) {
				for (const ev of resultsFor(side, f.break_side)) {
					const on = f.winner_side === side && f.result_event === ev && f.status === 'complete';
					buttons.push(mbtn(`${SIDE_TAG[side]} — ${RESULT_EVENT[ev]}`, on ? 'on' : '',
						{ act: 'setcell', field: 'result', no, value: side + ':' + ev }));
				}
			}
			buttons.push(mbtn('Abandoned', f.status === 'abandoned' ? 'on' : '', { act: 'setcell', field: 'result', no, value: 'abandoned' }));
			openCellMenu(cellAnchor, `Frame ${f.no} — who won, and how`, buttons,
				'Only the results that fit who broke are offered.');
		} else {
			TDC.error(AREA, 'unknown history field: ' + field);
		}
	}

	// Would this correction stop the frame's result from being possible?
	//
	// The result picker only ever offers results that fit who broke, so a frame
	// is always valid when it is recorded. It is a later edit to one of the
	// other two cells that can invalidate it: marking the break dry on a frame
	// already recorded as a break & finish, or moving the break to the side
	// that won a reverse break & finish.
	//
	// Returns { event, because } for the result that would be given up, or null.
	// "because" says which rule is in the way, so the answer teaches the rule
	// rather than just reporting a loss.
	function resultLostBy(f, field, value) {
		if (!f.result_event || f.result_event === 'win' || f.result_event === 'default') return null;

		const after = {
			break_side: f.break_side,
			break_outcome: f.break_outcome,
			winner_side: f.winner_side
		};
		if (field === 'break_side') {
			if (value === 'auto') return null;   // back to the rule; recompute reports it
			after.break_side = value;
		} else if (field === 'break_outcome') {
			after.break_outcome = value === 'none' ? null : value;
		} else {
			return null;
		}

		const lost = (because) => ({ event: f.result_event, because });

		if (f.result_event === 'break_and_finish' || f.result_event === 'golden_break') {
			if (after.break_outcome !== 'in') {
				return lost('needs a ball potted on the break');
			}
			if (MATCH.rules.break_finish_requires_breaker && after.winner_side !== after.break_side) {
				return lost('has to go to the side that broke');
			}
		}
		if (f.result_event === 'reverse_break_and_finish' && after.winner_side === after.break_side) {
			return lost('has to go to the side that did not break');
		}
		return null;
	}

	function confirmCellChange(field, no, value, lost) {
		const name = RESULT_EVENT[lost.event].toLowerCase();
		openCellMenu(cellAnchor, `Frame ${no} can no longer be a ${name}`, [
			mbtn(`Record it as a ${RESULT_EVENT.win.toLowerCase()}`, 'result',
				{ act: 'setcell', field, no, value, confirmed: '1' }),
			mbtn('Leave it as it is', '', { act: 'closecellmenu' })
		], `A ${name} ${lost.because}. The frame still counts to the same player either way.`);
	}

	function setCell(field, no, value, confirmed) {
		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'no frame numbered ' + no, null, els.stageStatus); return; }

		// Asked rather than done quietly, because losing a break & finish is the
		// kind of thing a player notices weeks later in their stats.
		if (!confirmed) {
			const lost = resultLostBy(f, field, value);
			if (lost) { confirmCellChange(field, no, value, lost); return; }
		}

		if (field === 'break_side') {
			if (value === 'auto') f.break_side_manual = false;
			else { f.break_side = value; f.break_side_manual = true; }
		} else if (field === 'break_outcome') {
			f.break_outcome = value === 'none' ? null : value;
		} else if (field === 'result') {
			if (value === 'abandoned') {
				f.status = 'abandoned';
				f.winner_side = null;
				f.result_event = null;
			} else {
				const [side, ev] = value.split(':');
				f.status = 'complete';
				f.winner_side = side;
				f.result_event = ev;
			}
		}

		// Correcting one frame can change what later frames derive, so the whole
		// match is re-derived and anything that no longer fits is reported.
		// A downgrade on the frame just confirmed is not news — they were asked
		// about that one and said yes. Knock-on changes to other frames are.
		const changed = recomputeBreaks()
			.filter((line) => !(confirmed && line.startsWith(`Frame ${no}:`)));
		draft = newDraft();
		closeCellMenu();
		renderAll();

		const done = changed.length
			? `Frame ${no} corrected. Also adjusted: ${changed.join('; ')}`
			: `Frame ${no} corrected.`;

		// The server re-derives the later frames itself, so only the corrected
		// one is sent; reading back is what brings the rest into line.
		if (liveMatchId) persistFrame(no, done);
		else TDC.status(els.stageStatus, done, changed.length ? '' : 'success');
	}

	// ─────────────────────────────────────────────────────────────────
	// The history cell menu
	//
	// Corrections are made in the table, so the choices belong at the cell
	// being corrected. The stage overlay is still right for the questions the
	// stage asks — who won the lag, who is playing — but using it here put the
	// answer a screen away from the question.
	// ─────────────────────────────────────────────────────────────────

	let cellMenuOpen = false;
	let cellAnchor = null;      // the cell the menu belongs to

	function openCellMenu(anchor, question, buttons, hint) {
		els.cellMenuQ.textContent = question;
		els.cellMenuHint.textContent = hint || '';
		els.cellMenuHint.hidden = !hint;
		els.cellMenuRow.replaceChildren(...buttons);
		els.cellMenu.hidden = false;
		cellMenuOpen = true;

		if (!anchor) return;

		// Positioned against the page, under the cell, and nudged back inside
		// the window if the cell is near an edge.
		const cell = anchor.getBoundingClientRect();
		const host = els.cellMenu.offsetParent || document.body;
		const base = host.getBoundingClientRect();
		const menu = els.cellMenu.getBoundingClientRect();

		let left = cell.left - base.left + (cell.width / 2) - (menu.width / 2);
		left = Math.max(8, Math.min(left, base.width - menu.width - 8));

		let top = cell.bottom - base.top + 6;
		// No room below? Put it above the cell instead.
		if (cell.bottom + menu.height + 12 > window.innerHeight && cell.top > menu.height) {
			top = cell.top - base.top - menu.height - 6;
		}

		els.cellMenu.style.left = left + 'px';
		els.cellMenu.style.top = top + 'px';
	}

	function closeCellMenu() {
		els.cellMenu.hidden = true;
		cellMenuOpen = false;
	}

	// ─────────────────────────────────────────────────────────────────
	// Overlays
	// ─────────────────────────────────────────────────────────────────

	function showBreakOverlay() {
		setOverlayMode('break');
		els.overlayQ.textContent = MATCH.rules.break_determination === 'by_schedule'
			? 'Who breaks this frame?'
			: 'Who won the lag?';
		els.overlayHint.textContent = BREAK_DETERMINATION[MATCH.rules.break_determination] || '';
		els.overlayRow.replaceChildren(
			mbtn(MATCH.home.name, '', { act: 'breakside', value: 'home' }),
			mbtn(MATCH.away.name, '', { act: 'breakside', value: 'away' }),
			settingsButton()
		);
		els.overlay.hidden = false;
	}

	// Match settings opens from the more pop-up and from the lag question
	// (UV, 30 Oct: the nav's Match button went when the nav hid on this page;
	// the nav stays since, the button not brought back). Not
	// a data-act: it changes nothing on the card, so a watcher may open it
	// too, as the nav button let them. From More the pop-up closes first;
	// the lag question stays asked under the panel.
	function settingsButton() {
		const b = mbtn('Match settings', '', {});
		b.addEventListener('click', () => {
			if (overlayMode === 'more') closeOverlay();
			openPanel();
		});
		return b;
	}

	function showPicker(side) {
		overlayMode = 'pick:' + side;
		els.overlayQ.textContent = `${MATCH[side].name} — who is at the table?`;
		els.overlayHint.textContent = 'One for singles, two for doubles.';
		els.overlayRow.replaceChildren(
			...MATCH[side].players.map((id) =>
				mbtn(player(id).display_name, draft[side + '_players'].includes(id) ? 'on' : '',
					{ act: 'pickplayer', side, value: id })),
			mbtn('Done', 'result', { act: 'closeoverlay' })
		);
		els.overlay.hidden = false;
	}

	// One ⋯ on the new stage, so one pop-up (UV, 30 Oct): each player's box,
	// headed by their picture and names, with their walkover; the match's
	// actions between them. The same acts as each card's ⋯ had. Off for a
	// watcher as before (mbtn, WRITE_ACTS), and the walkovers and abandon off
	// once the match is over, when the old cards had no ⋯ at all.
	function showMore() {
		overlayMode = 'more';
		els.overlayQ.textContent = 'More';
		els.overlayHint.textContent = '';
		const body = div('mv-more-body');
		const box = (side) => {
			const s = div('mv-more-side');
			const who = div('mv-more-who');
			paintWho(who, player(MATCH[side].players[0]));
			s.append(who, mbtn('Walkover', 'result', { act: 'walkover', side }, matchOver()));
			return s;
		};
		const mid = div('mv-more-match');
		mid.append(
			mbtn('Abandon frame', '', { act: 'abandon' }, matchOver()),
			mbtn('Change table', '', { act: 'changetable' }, MATCH.tables.length < 2),
			mbtn(timerRunning(matchTimer) ? 'Pause match' : 'Resume match', '', { act: 'togglematchtimer' }, !!matchOver()),
			settingsButton(),
			mbtn('Close', '', { act: 'closeoverlay' })
		);
		body.append(box('home'), mid, box('away'));
		els.overlayRow.replaceChildren(body);
		els.overlay.hidden = false;
	}

	// Whose a special win is, when the rules let either player have it: the
	// old cards had a B&F on each, the new stage has one (UV, 30 Oct).
	function showWhoOverlay(ev, sides) {
		setOverlayMode('who');
		els.overlayQ.textContent = `${RESULT_EVENT[ev]}: to whom?`;
		els.overlayHint.textContent = 'Either player can have it under this match\'s rules.';
		els.overlayRow.replaceChildren(
			...sides.map((s) => mbtn(MATCH[s].name, 'result', { act: 'result', side: s, value: ev })),
			mbtn('Close', '', { act: 'closeoverlay' })
		);
		els.overlay.hidden = false;
	}

	// The overlay's own taps, before onClick has them: a result chosen in
	// it puts the overlay away first (the old cards' result buttons were
	// never in one), and Pause match redraws the pop-up so it reads Resume.
	els.overlay.addEventListener('click', (e) => {
		const b = e.target.closest('[data-act]');
		if (!b || b.disabled) return;
		if (b.dataset.act === 'result') { setOverlayMode(null); els.overlay.hidden = true; }
		if (b.dataset.act === 'togglematchtimer') setTimeout(() => { if (overlayMode === 'more') showMore(); }, 0);
	});

	// The match is over on the card. Asking before submitting is the difference
	// between a mis-tap costing a tap and a mis-tap locking the night's match:
	// the frame itself is already saved either way, and only the submission —
	// which is what actually locks the card — waits for an answer.
	function showFinishOverlay() {
		setOverlayMode('finish');
		const home = framesWon('home');
		const away = framesWon('away');
		const winner = matchWinner();

		els.overlayQ.textContent = winner
			? `${MATCH[winner].name} wins it, ${Math.max(home, away)}–${Math.min(home, away)}.`
			: `All square, ${home}–${away}.`;
		els.overlayHint.textContent = cardState && cardState.no_approval
			? 'Submitting settles it — this match needs no approval.'
			: 'Submitting sends it to ' + opponentName() + ' to check.';
		els.overlayRow.replaceChildren(
			mbtn('Submit the card', 'result', { act: 'finishmatch' }),
			mbtn('Not yet', '', { act: 'finishnotyet' })
		);
		els.overlay.hidden = false;
	}

	function showTablePicker() {
		overlayMode = 'table';
		els.overlayQ.textContent = 'Which table?';
		els.overlayHint.textContent = 'Applies to the frame being played.';
		els.overlayRow.replaceChildren(
			...MATCH.tables.map((t) => mbtn(t, draft.table === t ? 'on' : '', { act: 'settable', value: t })),
			mbtn('Close', '', { act: 'closeoverlay' })
		);
		els.overlay.hidden = false;
	}

	// The overlay lives inside the stage, which is a screen tall and scrolled
	// out of sight by the time anyone is editing the history table below it.
	// Opened from down there it floats over the viewport instead, so a tap on a
	// cell does not look like it did nothing.
	function setOverlayMode(mode) {
		overlayMode = mode;
		els.overlay.classList.toggle('floating', mode === 'edit');
	}

	function closeOverlay() {
		setOverlayMode(null);
		els.overlay.hidden = true;
		renderStage();
	}

	// ─────────────────────────────────────────────────────────────────
	// Settings panel, grouped into cards
	// ─────────────────────────────────────────────────────────────────

	const settingValue = (def) => (def.scope === 'match' ? MATCH[def.key] : MATCH.rules[def.key]);

	function setSetting(def, raw) {
		let value = raw;
		if (def.type === 'bool') value = !!raw;
		if (def.type === 'int') {
			value = parseInt(raw, 10);
			if (isNaN(value)) {
				TDC.error(AREA, `"${def.label}" needs a number.`, raw, els.stageStatus);
				return false;
			}
			if (def.min !== undefined) value = Math.max(def.min, value);
			if (def.max !== undefined) value = Math.min(def.max, value);
		}
		if (def.scope === 'match') MATCH[def.key] = value;
		else MATCH.rules[def.key] = value;
		return true;
	}

	function renderSetting(def) {
		// A select's options are often long (team names, rule names), so it gets
		// its own full-width line instead of being squeezed beside the label.
		const row = div('set-row' + (def.type === 'select' ? ' stack' : ''));
		const label = document.createElement('label');
		label.className = 'set-label';
		label.textContent = def.label;
		label.htmlFor = 'set-' + def.key;

		// The referee is a search, saved on its own (persistReferee), and only
		// by whoever may change the rules: a referee scores, they do not pick
		// who referees (UV, 24 Oct).
		if (def.type === 'player') {
			label.htmlFor = 'set-referee-search';
			row.append(label, TDCMatchDef.playerPicker({
				id: 'set-referee-search',
				chosen: MATCH.referee ? PLAYERS[MATCH.referee] || null : null,
				disabled: !canChange || settled(),
				status: els.stageStatus,
				onPick: persistReferee
			}));
			if (def.hint) row.append(div('set-hint', def.hint));
			return row;
		}

		const value = settingValue(def);
		let input;

		if (def.type === 'select') {
			input = document.createElement('select');
			const options = typeof def.options === 'function' ? def.options() : def.options;
			for (const [v, text] of Object.entries(options)) {
				const o = document.createElement('option');
				o.value = v;
				o.textContent = text;
				if (v === value) o.selected = true;
				input.append(o);
			}
		} else if (def.type === 'bool') {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'set-check';
			input.checked = !!value;
		} else if (def.type === 'int') {
			input = document.createElement('input');
			input.type = 'number';
			input.inputMode = 'numeric';
			if (def.min !== undefined) input.min = def.min;
			if (def.max !== undefined) input.max = def.max;
			input.value = value;
		} else {
			input = document.createElement('input');
			input.type = 'text';
			input.value = value == null ? '' : value;
			if (def.placeholder) input.placeholder = def.placeholder;
		}

		input.id = 'set-' + def.key;
		input.dataset.setting = def.key;
		// A watcher sees the match's settings but cannot change them. Disabled
		// rather than hidden: knowing it is a race to 7 is the point. In a
		// tournament the players see them disabled too: the rules are the
		// director's (audit A2, 24 Oct). The lag winner is not a rule: whoever
		// may score records it, and the database lets it through with the
		// rules unchanged.
		if (!(def.key === 'first_break_side' ? canEdit : canChange)) input.disabled = true;

		row.append(label, input);
		if (def.hint) row.append(div('set-hint', def.hint));
		return row;
	}

	function renderPanel() {
		const c = MATCH.context;
		renderBanner();
		els.contextLine.textContent = c.kind === 'social'
			? 'Social match · not part of a league or tournament'
			: [c.name, c.season, c.round].filter(Boolean).join(' · ');

		els.badgeRow.replaceChildren(
			badge(DISCIPLINE[MATCH.rules.discipline] || 'TDC (Error)'),
			badge(MATCH.sanctioned ? 'Sanctioned' : 'Casual', MATCH.sanctioned ? 'verified' : ''),
			badge(matchOver() ? 'Complete' : 'In progress'),
			badge(`${framesWon('home')} — ${framesWon('away')}`)
		);

		renderWhen();
		// Said only to somebody who can score but not change the rules, so a
		// watcher is not told about a tournament they are not in.
		els.changeNote.hidden = canChange || !canEdit;

		els.setGroups.replaceChildren();
		for (const group of GROUPS) {
			const defs = SETTINGS.filter((d) => d.group === group && (!d.when || d.when(MATCH.rules)));
			if (!defs.length) continue;
			const card = div('set-card');
			card.append(heading('h3', group));
			card.append(...layout(defs, renderSetting, { rows: false }));
			els.setGroups.append(card);
		}
	}

	// ─── When the match is played ───
	// A column, not a rule: changing it re-derives nothing, so it has its own
	// function rather than going through tdc_update_match_settings, which
	// rebuilds every break side and can put frames back.

	// A datetime-local input wants "2026-10-21T19:30" in the viewer's own zone,
	// which is what the browser gives back. toISOString would hand it UTC and
	// show the wrong hour to everyone but Greenwich.
	function localInputValue(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const pad = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
			+ `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function renderWhen() {
		// Not while it is being typed in, or the cursor jumps back a character
		// at a time as the panel redraws.
		if (document.activeElement !== els.when) {
			els.when.value = localInputValue(MATCH.scheduled_at);
		}
		els.when.disabled = !canChange || settled();
	}

	async function persistWhen() {
		if (!liveMatchId) return;
		if (isOffline()) { blockedOffline('Changing when the match is played'); return; }

		const raw = (els.when.value || '').trim();
		let iso = null;
		if (raw) {
			const d = new Date(raw);
			if (isNaN(d.getTime())) {
				TDC.error(AREA, 'the date entered could not be read: ' + raw, null, els.stageStatus);
				return;
			}
			iso = d.toISOString();
		}

		// Nothing to say and nobody to tell if it has not moved.
		if ((MATCH.scheduled_at || null) === iso) return;

		// A native field, not a control or a button: given the dots here.
		const { error } = await TDC.busy(els.when, inTurn('Saving the time…', () => supabaseClient.rpc('tdc_set_match_time', {
			p_match_id: liveMatchId,
			p_scheduled_at: iso
		})), els.stageStatus);
		await savingFinished(error, iso ? 'Time saved. Both players have been told.' : 'Time cleared.');
		if (!error) tellTheOther('time_set');
	}

	function showPanelNote(lines) {
		if (!lines.length) {
			els.panelNote.hidden = true;
			return;
		}
		els.panelNote.replaceChildren(
			div('', 'That change did not fit frames already played, so they were adjusted:'),
			...lines.map((t) => div('note-line', t))
		);
		els.panelNote.hidden = false;
	}

	// Rebuilding the panel destroys the element whose change we are handling,
	// which fires blur and re-enters this handler. So the data is updated now
	// and the repaint is deferred to the next frame, with focus put back.
	let settingRenderPending = false;

	function scheduleSettingsRender(focusId) {
		if (settingRenderPending) return;
		settingRenderPending = true;
		requestAnimationFrame(() => {
			settingRenderPending = false;
			renderAll();
			const again = focusId && document.getElementById(focusId);
			if (again) again.focus();
		});
	}

	function onSettingChange(e) {
		if (settingRenderPending) return;
		const input = e.target.closest('[data-setting]');
		if (!input) return;
		const def = SETTINGS.find((d) => d.key === input.dataset.setting);
		if (!def) {
			TDC.error(AREA, 'no definition for setting: ' + input.dataset.setting);
			return;
		}

		if (!canEdit) {
			scheduleSettingsRender(input.id);   // put the control back
			TDC.status(els.stageStatus, 'Only the players and venue staff can change this match.', '');
			return;
		}

		// A settings change moves the whole match, so it waits for a connection
		// rather than being replayed later on top of who knows what.
		if (liveMatchId && isOffline()) {
			scheduleSettingsRender(input.id);   // put the control back
			TDC.status(els.stageStatus, 'Match settings need a connection. Keep scoring — this will come back.', '');
			showPanelNote(['Settings are paused while this phone is offline.']);
			return;
		}
		if (!setSetting(def, def.type === 'bool' ? input.checked : input.value)) return;

		showPanelNote(recomputeBreaks());
		draft = newDraft();
		scheduleSettingsRender(input.id);

		if (liveMatchId) persistSettings();
	}

	// A column, not a rule, like the time: tdc_set_match_referee, which
	// re-derives nothing and leaves card_version alone. Read back after, so
	// the name shown is the one stored.
	async function persistReferee(player) {
		if (!liveMatchId) return;
		if (isOffline()) { blockedOffline('Changing the referee'); return; }

		const { error } = await inTurn('Saving the referee…', () => supabaseClient.rpc('tdc_set_match_referee', {
			p_match_id: liveMatchId,
			p_player_id: player ? player.id : null
		}));
		await savingFinished(error, player ? `${player.display_name} is refereeing.` : 'Referee removed.');
	}

	const openPanel  = () => { els.panel.hidden = false; els.scrim.hidden = false; };
	const closePanel = () => { els.panel.hidden = true;  els.scrim.hidden = true; };

	// ─────────────────────────────────────────────────────────────────
	// Actions
	// ─────────────────────────────────────────────────────────────────

	function pushFrame(extra) {
		MATCH.frames.push(Object.assign({
			no: MATCH.frames.length + 1,
			table: draft.table,
			home_players: draft.home_players.slice(),
			away_players: draft.away_players.slice(),
			break_side: draft.break_side,
			break_side_manual: false,
			break_outcome: draft.break_outcome,
			result_event: null,
			winner_side: null,
			status: 'complete'
		}, endFrameTimes(), extra));
		resetClockForNextFrame();
		draft = newDraft();
		renderAll();
		return MATCH.frames.length;
	}

	function saveFrame(side, ev) {
		const no = pushFrame({ result_event: ev, winner_side: side });
		const done = `Frame ${no} to ${MATCH[side].name}.`;
		if (liveMatchId) scoreDots(side, persistFrame(no, done));
		else { TDC.status(els.stageStatus, done, 'success'); scoreDots(side, null); }
	}

	// The site's dots on a player's score (UV, 28 Oct): they come to the
	// number as the frame is given and trace it once the save is back (at
	// least 0.2 s, as for any control). The stage draws itself again at once,
	// and again after the save, so the dots follow the score to each new one.
	// A save that failed is not traced; the page says why.
	function scoreDots(side, saved) {
		if (typeof TDCDots === 'undefined') return;
		const el = (side === 'home' ? els.p0 : els.p1).querySelector('.mv-score');
		if (!el) return;
		const least = new Promise((r) => setTimeout(r, 200));
		const call = Promise.all([Promise.resolve(saved).then((r) => { if (r && r.error) throw r.error; }), least]);
		TDCDots.serve(el, call, { status: els.stageStatus });
	}

	function walkover(side) {
		const no = pushFrame({ result_event: 'default', winner_side: side, break_outcome: null, break_side: null });
		const done = `Frame ${no} awarded to ${MATCH[side].name} by default.`;
		if (liveMatchId) persistFrame(no, done);
		else TDC.status(els.stageStatus, done, 'success');
	}

	function abandonFrame() {
		const no = pushFrame({ status: 'abandoned', result_event: null, winner_side: null });
		const done = `Frame ${no} abandoned. A reason is required in the real thing.`;
		if (liveMatchId) persistFrame(no, done);
		else TDC.status(els.stageStatus, done, '');
	}

	function onClick(e) {
		const b = e.target.closest('[data-act]');
		if (!b || b.disabled) return;
		const act = b.dataset.act;
		const side = b.dataset.side;

		// Belt and braces with the disabled buttons above: a watcher cannot
		// change the card even if a control is reached some other way.
		if (!canEdit && WRITE_ACTS.has(act)) {
			TDC.status(els.stageStatus, 'Only the players and venue staff can score this match.', '');
			return;
		}

		// Corrections to earlier frames re-derive everything after them, so they
		// wait for a connection. Recording new frames does not, and carries on.
		if (liveMatchId && isOffline()
			&& ['editside', 'editbreak', 'editcell', 'setcell'].includes(act)) {
			closeOverlay();
			blockedOffline('Correcting an earlier frame');
			return;
		}

		if (liveMatchId && isOffline() && CARD_ACTS.has(act)) {
			blockedOffline('Finishing a scorecard');
			return;
		}

		switch (act) {
			// ── Stage ────────────────────────────────────────────────
			case 'breakside': {
				const rule = MATCH.rules.break_determination;

				// Lagging every frame, or following a schedule, answers for this
				// frame only. Every other rule reckons from who won the lag at
				// the start, so the answer belongs to the match — and storing it
				// in the draft alone is why this kept asking the same question
				// before every frame.
				//
				// The answer is recorded before the overlay closes. closeOverlay()
				// re-renders the stage, and a stage with no breaking side opens
				// this overlay again — so closing first left it stuck open with
				// the question already answered.
				if (rule === 'lag_each_frame' || rule === 'by_schedule') {
					draft.break_side = b.dataset.value;
					closeOverlay();
					return;
				}

				MATCH.first_break_side = b.dataset.value;
				recomputeBreaks();
				draft = newDraft();
				closeOverlay();
				renderAll();
				if (liveMatchId) persistSettings();
				return;
			}
			case 'result':
				saveFrame(side, b.dataset.value);
				return;
			case 'more':
				showMore(side);
				return;
			case 'walkover':
				overlayMode = null;
				els.overlay.hidden = true;
				walkover(side);
				return;
			case 'abandon':
				overlayMode = null;
				els.overlay.hidden = true;
				abandonFrame();
				return;
			case 'changetable':
				showTablePicker();
				return;
			case 'settable':
				draft.table = b.dataset.value;
				closeOverlay();
				renderTimePanel();
				return;
			case 'pick':
				showPicker(side);
				return;
			case 'pickplayer': {
				const list = draft[side + '_players'];
				const i = list.indexOf(b.dataset.value);
				if (i >= 0) list.splice(i, 1); else list.push(b.dataset.value);
				showPicker(side);
				return;
			}
			case 'closeoverlay':
				closeOverlay();
				return;
			case 'closecellmenu':
				closeCellMenu();
				return;

			case 'refreshnow':
				refreshFromRemote();
				return;

			// ── Scorecard ────────────────────────────────────────────
			case 'finishmatch':
				closeOverlay();
				submitFinishedCard();
				return;
			case 'finishnotyet':
				// The card stays open and the Submit button is still there.
				closeOverlay();
				TDC.status(els.stageStatus, 'Left open. Submit it when you are ready.', '');
				return;
			case 'submitcard':
				cardAction('tdc_submit_card', { p_match_id: liveMatchId },
					'Submitted. The other player can check it now.', 'submitted');
				return;
			case 'agreecard':
				cardAction('tdc_answer_card', { p_match_id: liveMatchId, p_agree: true, p_note: null },
					'Agreed. The card is settled.', 'agreed');
				return;
			case 'disputecard':
				disputing = true;
				renderCard();
				renderResult();
				{ const box = document.getElementById('dispute-note'); if (box) box.focus(); }
				return;
			case 'disputecancel':
				disputing = false;
				renderCard();
				renderResult();
				return;
			case 'disputesend': {
				const box = document.getElementById('dispute-note');
				const note = box ? box.value.trim() : '';
				if (note.length < 3) {
					TDC.status(els.stageStatus, 'Say briefly what is wrong, so it can be put right.', '');
					return;
				}
				cardAction('tdc_answer_card', { p_match_id: liveMatchId, p_agree: false, p_note: note },
					'Sent. The card is open again.', 'disputed');
				return;
			}
			case 'reopencard':
				cardAction('tdc_reopen_card', { p_match_id: liveMatchId },
					'Taken back. Put it right, then submit it again.', 'reopened');
				return;
			case 'deletematch':
				confirmingDelete = true;
				renderCard();
				renderResult();
				return;
			case 'deletecancel':
				confirmingDelete = false;
				renderCard();
				renderResult();
				return;
			case 'deleteconfirm':
				(async () => {
					if (isOffline()) { blockedOffline('Deleting a match'); return; }
					const { error } = await supabaseClient.rpc('tdc_delete_match', { p_match_id: liveMatchId });
					if (error) { TDC.showSupabaseError(AREA, error, els.stageStatus); return; }

					// Told after the deletion, from the note the database keeps:
					// the match itself no longer exists to be read. Waited for,
					// because leaving the page would cut the call off.
					await tellTheOther('deleted');
					location.href = '/matches/';
				})();
				return;

			// ── Frame history ────────────────────────────────────────
			case 'editside':
				editSide(Number(b.dataset.no), side, b);
				return;
			case 'editbreak':
				editBreak(Number(b.dataset.no), b);
				return;
			case 'editcell':
				// Number(), because a data attribute is a string and this ends up
				// as the integer frame number the database is asked for.
				editCell(b.dataset.field, Number(b.dataset.no), null);
				return;
			case 'setcell':
				setCell(b.dataset.field, Number(b.dataset.no), b.dataset.value, b.dataset.confirmed === '1');
				return;

			// ── Timing panel ─────────────────────────────────────────
			case 'toggleframe':
				if (timerRunning(frameTimer)) timerPause(frameTimer); else timerResume(frameTimer);
				renderTimePanel();
				return;
			case 'togglematchtimer':
				if (timerRunning(matchTimer)) timerPause(matchTimer); else timerResume(matchTimer);
				renderTimePanel();
				return;
			case 'turn':
				startTurn(side);
				renderTimePanel();
				return;
			case 'toggleshot':
				if (clock.running) clock.running = false;
				else if (clock.side && clock.remaining > 0) clock.running = true;
				renderTimePanel();
				return;
			case 'resetshot':
				clock.remaining = shotLength();
				clock.expired = false;
				clock.running = true;
				TDC.status(els.stageStatus, '', '');
				renderTimePanel();
				return;
			case 'ext':
				useExtension(side);
				renderTimePanel();
				return;

			default:
				TDC.error(AREA, 'unhandled action: ' + act);
		}
	}

	function undo() {
		if (!MATCH.frames.length) return;
		if (!canEdit) {
			TDC.status(els.stageStatus, 'Only the players and venue staff can score this match.', '');
			return;
		}
		const no = MATCH.frames.length;

		// Offline, a frame that has already reached the server cannot be undone:
		// removing it renumbers everything after it, and this device cannot see
		// what else may have changed.
		if (liveMatchId && isOffline() && !lastFrameIsQueued(no)) {
			blockedOffline('Undoing a frame that has already been sent');
			return;
		}

		MATCH.frames.pop();
		recomputeBreaks();
		resetClockForNextFrame();
		draft = newDraft();
		renderAll();

		if (liveMatchId) persistRemoval(no);
		else TDC.status(els.stageStatus, 'Last frame removed.', '');
	}

	// ─────────────────────────────────────────────────────────────────

	function renderAll() {
		renderStage();
		renderTimePanel();
		renderHistory();
		renderPanel();
	}

	// ─────────────────────────────────────────────────────────────────
	// Loading a real match
	//
	// /match/?id=<uuid> fills MATCH and PLAYERS. The shape built here is the
	// only shape this file knows, so nothing else in it has to ask where its
	// data came from.
	//
	// Reading is done. Writing is not: the result buttons and the history table
	// still only change this copy. showNotice() says so on screen rather than
	// letting someone score a match that quietly evaporates.
	// ─────────────────────────────────────────────────────────────────

	const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	function showNotice(html, kind) {
		els.notice.className = 'match-notice' + (kind ? ' ' + kind : '');
		els.notice.innerHTML = html;
		els.notice.hidden = false;
	}

	function hideNotice() {
		els.notice.hidden = true;
		els.notice.replaceChildren();
		noteStale = '';
		paintStageNote();
	}

	// Storage paths are turned into URLs here rather than stored, so moving the
	// bucket later is one edit. Matches how the nav and profile pages do it.
	function avatarUrl(path) {
		if (!path) return null;
		const { data } = supabaseClient.storage.from('player-avatars').getPublicUrl(path);
		return data ? data.publicUrl : null;
	}

	const fullName = (p) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name;

	async function loadPlayers(ids) {
		const wanted = [...new Set(ids.filter(Boolean))];
		if (!wanted.length) return {};

		const { data, error } = await supabaseClient
			.from('tbl_players')
			.select('id, display_name, first_name, last_name, avatar_path')
			.in('id', wanted);

		if (error) { TDC.showSupabaseError(AREA, error, els.stageStatus); return null; }

		const map = {};
		for (const p of data) {
			map[p.id] = {
				id: p.id,
				display_name: p.display_name,
				full_name: fullName(p),
				avatar_url: avatarUrl(p.avatar_path)
			};
		}

		// A player we asked for and did not get back is a real problem — a frame
		// would render as "TDC (Error)" with no explanation of why.
		const absent = wanted.filter((id) => !map[id]);
		if (absent.length) {
			TDC.error(AREA, 'these players could not be read: ' + absent.join(', '));
		}
		return map;
	}

	const msOrNull = (t) => (t ? Date.parse(t) : null);

	// ─── The tournament a match is part of (UV, 5 Nov) ───
	// Its fixture on a draw names the tournament and the round, said as the
	// draw says it (tournament-bracket.js, roundNames and fixtureName: keep
	// the two in step): walking down from the last main round, one match is
	// the Final, two the Semi-finals, four the Quarter-finals, then Last 16,
	// Last 32 and on; once the halving breaks, "Round n". Read once per match
	// (a match does not change tournament) rather than on every re-read after
	// a write. A failed read says so and the match opens as social, and is
	// tried again on the next re-read.
	const SOCIAL = { kind: 'social', name: null, season: null, round: null };
	let contextOf = null;   // { id, context }
	async function matchContext(id) {
		if (contextOf && contextOf.id === id) return contextOf.context;
		const { data: f, error } = await supabaseClient
			.from('tbl_tournament_fixtures')
			.select('tournament_id, bracket, round, position, tbl_tournaments(name)')
			.eq('match_id', id)
			.maybeSingle();
		if (error) { TDC.showSupabaseError(AREA, error, els.stageStatus); return SOCIAL; }
		if (!f) { contextOf = { id, context: SOCIAL }; return SOCIAL; }

		let round = null;
		if (f.bracket === 'third_place') round = 'Third place';
		else if (f.bracket !== 'main') round = f.bracket.replace(/_/g, ' ') + ' · Match ' + f.position;
		else {
			const { data: main, error: mainError } = await supabaseClient
				.from('tbl_tournament_fixtures')
				.select('round')
				.eq('tournament_id', f.tournament_id)
				.eq('bracket', 'main');
			if (mainError) { TDC.showSupabaseError(AREA, mainError, els.stageStatus); return SOCIAL; }
			const LADDER = { 1: 'Final', 2: 'Semi-finals', 4: 'Quarter-finals' };
			const last = Math.max(...main.map((x) => x.round));
			let name = null;
			for (let r = last, expect = 1; r >= f.round; r--, expect *= 2) {
				if (main.filter((x) => x.round === r).length !== expect) break;
				if (r === f.round) name = { long: LADDER[expect] || 'Last ' + expect * 2, one: expect === 1 };
			}
			round = name && name.one ? name.long : (name ? name.long : 'Round ' + f.round) + ' · Match ' + f.position;
		}
		const context = {
			kind: 'tournament',
			name: f.tbl_tournaments ? f.tbl_tournaments.name : 'TDC (Error)',
			season: null,
			round,
			tournamentId: f.tournament_id
		};
		contextOf = { id, context };
		return context;
	}

	// The banner under the nav (UV, 5 Nov): a tournament match says which
	// tournament and round it is, and a tap opens the draw. The stage gives
	// up the banner's height so it still fits the screen (match.css).
	function renderBanner() {
		const c = MATCH && MATCH.context;
		if (!c || c.kind !== 'tournament') { els.banner.hidden = true; return; }
		els.banner.href = '/tournaments/bracket/?t=' + encodeURIComponent(c.tournamentId);
		els.bannerName.textContent = c.name;
		els.bannerRound.textContent = c.round || '';
		els.banner.setAttribute('aria-label', [c.name, c.round, 'open the draw'].filter(Boolean).join(', '));
		els.banner.hidden = false;
	}

	async function loadMatch(id) {
		const { data: m, error } = await supabaseClient
			.from('tbl_matches')
			.select('id, venue_id, scheduled_at, first_break_side, sanctioned, rules, status, card_version,'
				+ ' home_side_kind, home_player_id, away_side_kind, away_player_id, referee_player_id,'
				+ ' break_in_play, break_in_play_frame_no, break_in_play_card_version')
			.eq('id', id)
			.maybeSingle();

		if (error) { TDC.showSupabaseError(AREA, error, els.stageStatus); return null; }
		if (m) cardVersion = m.card_version;
		if (!m) {
			TDC.error(AREA, 'no match with id ' + id, null, els.stageStatus);
			showNotice('<strong>Match not found.</strong> Either the link is wrong, or you are not signed in — '
				+ 'matches are only readable once you have signed in.', 'error');
			return null;
		}

		// Teams are not built yet, and guessing at a team name would be worse
		// than saying so.
		if (m.home_side_kind !== 'player' || m.away_side_kind !== 'player') {
			TDC.error(AREA, 'team matches need the teams table, which does not exist yet', m, els.stageStatus);
			showNotice('<strong>This is a team match.</strong> The teams table has not been built yet, '
				+ 'so this page cannot show it. Singles matches work.', 'error');
			return null;
		}

		const { data: rows, error: framesError } = await supabaseClient
			.from('tbl_frames')
			.select('id, frame_no, break_side, break_side_manual, break_player_id, break_outcome,'
				+ ' winner_side, result_event, status, referee_player_id,'
				+ ' rack_started_at, started_at, ended_at, paused_seconds,'
				+ ' tbl_frame_participants (side, player_id, play_order)')
			.eq('match_id', id)
			.order('frame_no');

		if (framesError) { TDC.showSupabaseError(AREA, framesError, els.stageStatus); return null; }

		const frames = rows.map((f) => {
			// play_order is null in singles, so sort on it only when it is set.
			const side = (want) => (f.tbl_frame_participants || [])
				.filter((p) => p.side === want)
				.sort((a, b) => (a.play_order || 0) - (b.play_order || 0))
				.map((p) => p.player_id);

			return {
				no: f.frame_no,
				table: 'Table not set',
				home_players: side('home'),
				away_players: side('away'),
				break_side: f.break_side,
				break_side_manual: f.break_side_manual,
				break_outcome: f.break_outcome,
				result_event: f.result_event,
				winner_side: f.winner_side,
				status: f.status,
				rack_started_at: msOrNull(f.rack_started_at),
				started_at: msOrNull(f.started_at),
				ended_at: msOrNull(f.ended_at),
				paused_seconds: f.paused_seconds
			};
		});

		const players = await loadPlayers([
			m.home_player_id, m.away_player_id, m.referee_player_id,
			...rows.flatMap((f) => (f.tbl_frame_participants || []).map((p) => p.player_id)),
			...rows.map((f) => f.referee_player_id)
		]);
		if (!players) return null;

		let venue = null;
		if (m.venue_id) {
			const { data: v, error: venueError } = await supabaseClient
				.from('tbl_venues').select('name').eq('id', m.venue_id).maybeSingle();
			if (venueError) {
				TDC.error(AREA, 'could not read the venue for this match.', venueError);
			} else if (!v) {
				TDC.error(AREA, 'the match points at a venue that could not be read: ' + m.venue_id);
			} else {
				venue = v.name;
			}
		}

		const nameOf = (pid) => (players[pid] ? players[pid].display_name : 'TDC (Error)');

		return {
			players,
			match: {
				id: m.id,
				// The tournament it is part of, if any (UV, 5 Nov: the banner
				// under the nav); otherwise social. Leagues are not looked up
				// yet: a league night is a team match, which this page does
				// not open.
				context: await matchContext(m.id),
				sanctioned: m.sanctioned,
				venue,
				// The tables table does not exist yet. Named plainly rather than
				// invented, so nobody reads it as a real table number.
				tables: ['Table not set'],
				scheduled_at: m.scheduled_at,
				// The match's own referee (20261024162559), a player id; the
				// name is in players like everybody else's.
				referee: m.referee_player_id,
				first_break_side: m.first_break_side,
				home: { name: nameOf(m.home_player_id), crest_url: null, players: [m.home_player_id] },
				away: { name: nameOf(m.away_player_id), crest_url: null, players: [m.away_player_id] },
				rules: m.rules,
				// The break event tapped for the frame in play (20261030155332),
				// only while the card is as it was when it was tapped: any frame
				// saved, removed or corrected since moved card_version on.
				break_in_play: m.break_in_play && m.break_in_play_card_version === m.card_version
					? { frame_no: m.break_in_play_frame_no, outcome: m.break_in_play } : null,
				frames
			}
		};
	}

	// ─────────────────────────────────────────────────────────────────
	// The scorecard: finished, waiting, agreed or disputed
	//
	// The state is worked out by the database from an append-only log, so this
	// only ever displays it. One rule shapes the whole panel: you submit your
	// own card, and the other player answers it. Signing your own proves
	// nothing, which is the entire point of the step.
	// ─────────────────────────────────────────────────────────────────

	let cardState = null;
	let myPlayerId = null;
	let disputing = false;      // the reason box is open
	let confirmingDelete = false;

	// ─────────────────────────────────────────────────────────────────
	// The result
	//
	// A settled match is not a scorecard any more, so the scoring surface is
	// put away and what happened is shown instead. Same address: a link to a
	// match should still work after it is over.
	// ─────────────────────────────────────────────────────────────────

	// A submitted card is already out of the scorer's hands, so the stage goes
	// away then — not only once it has been agreed. The match is over, the
	// result is what matters, and the submitter can still withdraw it from here
	// until it is answered. A dispute puts the stage back, because that is
	// exactly what a dispute asks for.
	function settled() {
		if (!liveMatchId || !cardState) return false;
		return cardState.state === 'agreed' || cardState.state === 'awaiting'
			// A published tournament result is as settled as a card gets.
			|| cardState.state === 'approved';
	}

	function opponentName() {
		const other = MATCH[otherSide(mySide() || 'home')];
		return other ? other.name : 'the other player';
	}

	function factRow(label, value) {
		const row = div('fact');
		row.append(div('fact-k', label), div('fact-v', value));
		return row;
	}

	function renderResult() {
		const show = settled();
		els.resultView.hidden = !show;
		els.matchPage.hidden = show;
		if (!show) return;

		const home = framesWon('home');
		const away = framesWon('away');
		const winner = home === away ? null : (home > away ? 'home' : 'away');

		// The winner's score first, so the line reads the way people say it.
		const big = div('score-pair');
		const hi = winner ? Math.max(home, away) : home;
		const lo = winner ? Math.min(home, away) : away;
		big.append(div('score-big', String(hi)), div('score-dash', '–'), div('score-big', String(lo)));
		els.resultScore.replaceChildren(big);

		els.resultLabel.textContent = MATCH.sanctioned ? 'Final · counts for ranking' : 'Final';
		els.resultLine.textContent = winner
			? MATCH[winner].name + ' beat ' + MATCH[otherSide(winner)].name
			: MATCH.home.name + ' and ' + MATCH.away.name + ' drew';

		// Every frame, in order, as it was recorded.
		els.resultFrames.replaceChildren(...MATCH.frames.map((f) => {
			const li = document.createElement('li');
			li.className = 'result-frame';
			const who = f.status === 'abandoned'
				? 'Abandoned'
				: (f.winner_side ? MATCH[f.winner_side].name : 'TDC (Error)');
			li.append(div('rf-no', String(f.no)), div('rf-who', who));

			const extra = [];
			if (f.result_event && f.result_event !== 'win') extra.push(RESULT_EVENT[f.result_event]);
			if (MATCH.rules.track_breaks && f.break_side) {
				extra.push(MATCH[f.break_side].name + ' broke'
					+ (f.break_outcome ? ' (' + BREAK_OUTCOME[f.break_outcome].toLowerCase() + ')' : ''));
			}
			if (extra.length) li.append(div('rf-extra', extra.join(' · ')));
			return li;
		}));

		const facts = [];
		facts.push(factRow('Discipline', DISCIPLINE[MATCH.rules.discipline] || 'TDC (Error)'));
		facts.push(factRow('Format', MATCH.rules.win_condition_type === 'free_play'
			? WIN_CONDITION.free_play
			: (WIN_CONDITION[MATCH.rules.win_condition_type] || 'TDC (Error)') + ' ' + MATCH.rules.win_condition_target));
		facts.push(factRow('Frames played', String(MATCH.frames.length)));
		if (MATCH.venue) facts.push(factRow('Venue', MATCH.venue));
		if (MATCH.rules.track_breaks) {
			const bf = MATCH.frames.filter((f) => f.result_event === 'break_and_finish'
				|| f.result_event === 'golden_break').length;
			facts.push(factRow('Break & finishes', String(bf)));
		}
		const timed = MATCH.frames.filter((f) => f.started_at && f.ended_at);
		if (timed.length) {
			const avg = timed.reduce((t, f) => t + (f.ended_at - f.started_at) / 1000, 0) / timed.length;
			facts.push(factRow('Average frame', Math.round(avg / 60) + ' min'));
		}
		els.resultFacts.replaceChildren(...facts);

		// The card can still be waiting on somebody, so this page has to be able
		// to answer it. The scorecard panel lives on the stage, and the stage is
		// not on screen any more.
		const waiting = cardState.state === 'awaiting';
		const mine = cardState.submitted_by && cardState.submitted_by === myPlayerId;
		const myTurn = waiting && myPlayerId && !mine;
		// A published result is settled. There is nothing to agree to, so the
		// only thing a player can still do is say it is wrong, and only while
		// the window the coordinator set is open.
		const canObject = !!cardState.published && !!cardState.can_object && !!myPlayerId;

		const lines = [];
		if (waiting) {
			lines.push(div('card-line', mine
				? 'Submitted. Waiting for ' + opponentName()
					+ (cardState.deadline ? ', until ' + whenText(cardState.deadline) : '') + '.'
				: myPlayerId
					? 'Submitted. Does this look right to you?'
					: 'This card has been submitted.'));
			if (mine && cardState.deadline) {
				lines.push(div('card-note', 'If nobody answers by then it counts as agreed.'));
			}
		} else if (cardState.published) {
			lines.push(div('card-line', cardState.state === 'approved'
				? 'Published by whoever is running this competition.'
				: 'Published — this result counts.'));
			if (cardState.at) lines.push(div('card-note', whenText(cardState.at)));
			if (cardState.objection) {
				lines.push(div('card-line', 'Disputed, and with whoever is running this competition.'));
				if (cardState.objection.note) {
					lines.push(div('card-note', '\u201c' + cardState.objection.note + '\u201d'));
				}
			} else if (canObject) {
				lines.push(div('card-note',
					'If this is wrong, say so by ' + whenText(cardState.object_until)
					+ ' and it goes to whoever is running the competition.'));
			}
		} else {
			lines.push(div('card-line',
				cardState.no_approval ? 'Settled — this match was set to need no approval.'
					: cardState.by_silence ? 'Agreed — nobody disputed it in time.'
						: 'Agreed by both players.'));
			if (cardState.at) lines.push(div('card-note', whenText(cardState.at)));
			lines.push(div('card-note', 'This result is final.'));
		}

		if ((myTurn || canObject) && disputing) {
			const box = document.createElement('textarea');
			box.id = 'dispute-note';
			box.rows = 2;
			box.placeholder = 'What is wrong with it?';
			lines.push(box);
		}
		els.resultAgreed.replaceChildren(...lines);

		// A settled card is final for the players (UV, 23 Oct): there is no
		// Reopen. The submitter can only Withdraw a card nobody has answered.
		const actions = [];
		if (myTurn) {
			actions.push(...(disputing
				? [mbtn('Send', 'result', { act: 'disputesend' }), mbtn('Cancel', '', { act: 'disputecancel' })]
				: [mbtn('Looks right', 'result', { act: 'agreecard' }),
					mbtn('Something is wrong', '', { act: 'disputecard' })]));
		} else if (canObject) {
			// No "Looks right" here: it is already published, and offering it
			// would be offering a button the database refuses.
			actions.push(...(disputing
				? [mbtn('Send', 'result', { act: 'disputesend' }), mbtn('Cancel', '', { act: 'disputecancel' })]
				: [mbtn('Something is wrong', '', { act: 'disputecard' })]));
		} else if (canEdit && !MATCH.sanctioned && (!waiting || mine)) {
			// While a card is waiting, only the person who sent it can take it
			// back. The other player's way in is to say what is wrong.
			if (confirmingDelete && canDelete) {
				actions.push(mbtn('Yes, delete this match', '', { act: 'deleteconfirm' }),
					mbtn('Keep it', '', { act: 'deletecancel' }));
			} else {
				if (waiting) actions.push(mbtn('Withdraw', '', { act: 'reopencard' }));
				if (canDelete) actions.push(mbtn('Delete match', '', { act: 'deletematch' }));
			}
		}
		els.resultActions.replaceChildren(...actions);
	}

	async function loadCardState() {
		if (!liveMatchId) return;
		const { data, error } = await supabaseClient.rpc('tdc_card_state', { p_match_id: liveMatchId });
		if (error) { TDC.showSupabaseError(AREA, error, els.stageStatus); return; }
		cardState = data;
		renderCard();
		renderResult();
	}

	function whenText(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) return '';
		return d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	}

	function renderCard() {
		if (!liveMatchId || !cardState) { els.cardPanel.hidden = true; return; }
		els.cardPanel.hidden = false;

		const state = cardState.state;
		const mine = cardState.submitted_by && cardState.submitted_by === myPlayerId;
		const other = MATCH[otherSide(mySide() || 'home')];
		const rows = [];

		if (noEditNote) rows.push(div('card-line', noEditNote));

		if (state === 'in_progress') {
			if (!MATCH.frames.length) {
				rows.push(div('card-line', 'Play a frame first — there is nothing to submit yet.'));
			} else if (canEdit) {
				rows.push(div('card-line', cardState.no_approval
					? 'When the match is over, submit the card. It settles straight away — this match needs no approval.'
					: 'When the match is over, submit the card and ' +
						(other ? other.name : 'the other player') + ' can check it.'));
				rows.push(rowOf(mbtn(cardState.no_approval ? 'Submit and finish' : 'Submit scorecard',
					'result', { act: 'submitcard' })));
			} else {
				rows.push(div('card-line', 'Not submitted yet.'));
			}
			if (cardState.sent_back) {
				rows.push(div('card-line', 'Sent back by whoever is running this competition.'));
				if (cardState.note) rows.push(div('card-note', '“' + cardState.note + '”'));
			}
		} else if (state === 'awaiting' && (mine || !myPlayerId)) {
			// Without knowing who we are, the answer buttons are a guess, and
			// offering someone the chance to agree with themselves is worse
			// than saying less.
			rows.push(div('card-line', mine
				? 'Submitted. Waiting for ' + (other ? other.name : 'the other player')
					+ (cardState.deadline ? ', until ' + whenText(cardState.deadline) : '') + '.'
				: 'This card has been submitted.'));
			if (mine && cardState.deadline) {
				rows.push(div('card-note', 'If nobody answers by then it counts as agreed.'));
			}
		} else if (state === 'awaiting') {
			rows.push(div('card-line', 'This card has been submitted. Does it look right to you?'));
			if (disputing) {
				const box = document.createElement('textarea');
				box.id = 'dispute-note';
				box.rows = 2;
				box.placeholder = 'What is wrong with it?';
				rows.push(box);
				rows.push(rowOf(
					mbtn('Send', 'result', { act: 'disputesend' }),
					mbtn('Cancel', '', { act: 'disputecancel' })
				));
			} else {
				rows.push(rowOf(
					mbtn('Looks right', 'result', { act: 'agreecard' }),
					mbtn('Something is wrong', '', { act: 'disputecard' })
				));
			}
		} else if (state === 'agreed' && cardState.published) {
			rows.push(div('card-line', 'Published — this result counts.'));
			if (cardState.at) rows.push(div('card-note', whenText(cardState.at)));
		} else if (state === 'agreed') {
			rows.push(div('card-line',
				cardState.no_approval ? 'Settled — this match was set to need no approval.'
					: cardState.by_silence ? 'Agreed — nobody disputed it in time.'
						: 'Agreed by both players.'));
			if (cardState.at) rows.push(div('card-note', whenText(cardState.at)));
		} else if (state === 'disputed') {
			rows.push(div('card-line', 'Disputed, so the card is open again.'));
			if (cardState.note) rows.push(div('card-note', '“' + cardState.note + '”'));
			if (canEdit) rows.push(div('card-note', 'Put it right, then submit it again.'));
		} else if (state === 'approved') {
			// A competition result the coordinator has published. Terminal:
			// nobody below them edits it, and the bracket has already moved.
			rows.push(div('card-line', 'Published by whoever is running this competition.'));
			if (cardState.at) rows.push(div('card-note', whenText(cardState.at)));
		}

		// Somebody has objected to a published result. It does not reopen the
		// card — it sits with the coordinator — so it is said here rather
		// than changing what the card looks like.
		if (cardState.objection) {
			rows.push(div('card-line', 'Disputed, and with whoever is running this competition.'));
			if (cardState.objection.note) {
				rows.push(div('card-note', '“' + cardState.objection.note + '”'));
			}
		}

		// Deleting is for a match started by mistake. It takes the frames with
		// it, so it asks twice.
		if (canDelete && !MATCH.sanctioned) {
			rows.push(confirmingDelete
				? rowOf(
					mbtn('Yes, delete this match', '', { act: 'deleteconfirm' }),
					mbtn('Keep it', '', { act: 'deletecancel' }))
				: rowOf(mbtn('Delete match', '', { act: 'deletematch' })));
			if (confirmingDelete) {
				rows.push(div('card-note', 'Every frame goes with it, for both players. This cannot be undone.'));
			}
		}

		els.cardBody.replaceChildren(...rows);
	}

	function rowOf(...buttons) {
		const row = div('card-row');
		row.append(...buttons);
		return row;
	}

	// Which side am I on? Only meaningful in a singles match for now.
	function mySide() {
		if (!myPlayerId) return null;
		if (MATCH.home.players.includes(myPlayerId)) return 'home';
		if (MATCH.away.players.includes(myPlayerId)) return 'away';
		return null;
	}

	// Telling the other player. The page says which match and what happened;
	// the function works out who to tell and what to say, so a page cannot be
	// talked into pushing arbitrary text at arbitrary people.
	//
	// A notification that does not arrive must never cost somebody their
	// scorecard, so this never throws and never blocks: the card is already
	// saved by the time it runs.
	async function tellTheOther(kind) {
		if (!liveMatchId || isOffline()) return;
		try {
			const { data, error } = await supabaseClient.functions.invoke('notify-card', {
				body: { match_id: liveMatchId, kind }
			});
			if (error) { console.error('[' + AREA + '] could not send the notification.', error); return; }
			if (data && data.sent === 0) {
				console.log('[' + AREA + '] nobody notified: ' + (data.note || 'no devices'));
			}
		} catch (err) {
			console.error('[' + AREA + '] could not send the notification.', err);
		}
	}

	async function cardAction(fn, args, okMessage, notifyKind) {
		if (isOffline()) { blockedOffline('Finishing a scorecard'); return; }

		// On a settled match the stage is put away, so a message there would be
		// written somewhere nobody can see.
		const where = settled() ? els.resultStatus : els.stageStatus;

		TDC.status(where, '', '');
		const { error } = await supabaseClient.rpc(fn, args);
		if (error) { TDC.showSupabaseError(AREA, error, where); return; }

		disputing = false;
		confirmingDelete = false;
		await reloadFromServer();
		await loadCardState();
		TDC.status(settled() ? els.resultStatus : els.stageStatus, okMessage, 'success');

		// After the card is saved and on screen, never before.
		if (notifyKind) tellTheOther(notifyKind);

		// Approving writes a notification to both players
		// (20261022110000), so its push goes out now. Unconditional here,
		// unlike the frame path: a card action is a deliberate press, not
		// something repeated once per frame.
		TDC.flushPushes();
	}

	// ─────────────────────────────────────────────────────────────────
	// Saving
	//
	// Every change to the card goes through one of three places — pushFrame(),
	// setCell() and undo() — so saving hooks in at those three and nowhere else.
	//
	// After each write the match is read back rather than patched locally. The
	// server owns the derived break side: correcting frame 2 can move who breaks
	// frames 3 onwards, and tdc_record_frame re-derives the lot. Reading back is
	// the only way the page is certain to agree with what was stored.
	//
	// A failed write also reloads, so the screen never keeps a change the
	// database refused.
	// ─────────────────────────────────────────────────────────────────

	let liveMatchId = null;          // set once a match has loaded
	let saving = 0;                  // writes in flight
	let cardVersion = null;          // what the server said when we last read it

	// Whether this person may score this match. The database decides — the page
	// asks tdc_may_edit_match rather than working the rule out again here, so
	// there is one copy of it. Read-only until it has answered: a watcher who
	// cannot score is a small annoyance, a scorer whose frames are all refused
	// is a ruined night.
	let canEdit = false;
	// Deleting is a narrower right than scoring: in a tournament or league
	// match only the people running it may (audit A1, 24 Oct).
	let canDelete = false;
	// Changing the rules and the time is narrower too: in a tournament or
	// league match only the people running it may (audit A2/A3, 24 Oct).
	// The lag winner is not part of this; it stays with canEdit.
	let canChange = false;
	// Why not, when the answer is no because of the tournament's rules rather
	// than because this person is a stranger to the match. Null otherwise.
	let noEditNote = null;
	const isoOrNull = (ms) => (ms ? new Date(ms).toISOString() : null);

	// ─────────────────────────────────────────────────────────────────
	// Offline
	//
	// A club with bad wifi is the normal case, not the exception, so losing a
	// frame to a dropped connection is not acceptable. What happens instead:
	//
	//   The stage keeps working. Recording frames is the one thing that must
	//   never stop, and it is also the safest thing to replay: a frame is
	//   appended at the end, and the browser derives who breaks it with the
	//   same rule the server uses, so a queued frame lands exactly as it
	//   looked on screen.
	//
	//   Settings and history corrections lock. Both re-derive or renumber the
	//   whole match, which is where replaying gets guesswork.
	//
	//   Undo still works for a frame that has not been sent yet — it just
	//   drops it from the queue. A frame already on the server cannot be
	//   undone until the connection is back, because that is a renumbering.
	//
	// The queue survives a closed browser. What it cannot survive is somebody
	// else scoring the same match while this device was away, which is what
	// card_version is checked for before anything is replayed.
	// ─────────────────────────────────────────────────────────────────

	const isOffline = () => !navigator.onLine;
	const queueKey = () => 'tdc.match.' + liveMatchId + '.queue';

	function readQueue() {
		if (!liveMatchId) return null;
		try {
			const raw = localStorage.getItem(queueKey());
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			TDC.error(AREA, 'could not read the saved-up changes on this device.', e);
			return null;
		}
	}

	function writeQueue(q) {
		try {
			if (!q || !q.ops.length) localStorage.removeItem(queueKey());
			else localStorage.setItem(queueKey(), JSON.stringify(q));
			return true;
		} catch (e) {
			// Storage can be full or switched off. Say so loudly: the whole
			// point of the queue is that the frame is not lost.
			TDC.error(AREA, 'this device would not store the change. Stay on this page until you are back online.',
				e, els.stageStatus);
			return false;
		}
	}

	function enqueue(op) {
		const q = readQueue() || { card_version: cardVersion, ops: [] };
		q.ops.push(op);
		if (!writeQueue(q)) return;
		renderOfflineNotice();
	}

	function queuedCount() {
		const q = readQueue();
		return q ? q.ops.length : 0;
	}

	// True when the last thing recorded is still sitting in the queue, which is
	// what makes undoing it safe while offline.
	function lastFrameIsQueued(no) {
		const q = readQueue();
		if (!q || !q.ops.length) return false;
		const last = q.ops[q.ops.length - 1];
		return last.kind === 'frame' && last.no === no;
	}

	function dropLastQueued() {
		const q = readQueue();
		if (!q || !q.ops.length) return;
		q.ops.pop();
		writeQueue(q);
		renderOfflineNotice();
	}

	function renderOfflineNotice() {
		if (!liveMatchId) return;
		const n = queuedCount();

		if (!canEdit) {
			showNotice('<strong>Watching this match.</strong> Only the two players and venue staff can score it. '
				+ 'The score updates when they do — reload to see the latest.');
		} else if (isOffline()) {
			showNotice('<strong>Offline.</strong> Keep scoring — frames are kept on this phone and sent when '
				+ 'you are back online'
				+ (n ? `. <strong>${n} waiting.</strong>` : '.')
				+ ' Match settings and corrections to earlier frames are paused until then.', 'warn');
		} else if (n) {
			showNotice(`<strong>${n} change${n === 1 ? '' : 's'} still to send.</strong>`, 'warn');
		} else {
			showNotice('<strong>Live match.</strong> Frames and settings are saved as you change them.', 'warn');
		}
		noteOffline = !canEdit ? '' : isOffline() ? (n ? `Offline · ${n} waiting` : 'Offline') : (n ? `${n} waiting` : '');
		paintStageNote();
	}

	// Anything the page must refuse while offline says why, in the one place
	// the scorer is already looking.
	function blockedOffline(what) {
		TDC.status(els.stageStatus, `${what} needs a connection. Keep scoring — this will come back.`, '');
		return true;
	}

	let flushing = false;

	async function flushQueue() {
		const q = readQueue();
		if (!liveMatchId || !q || !q.ops.length || isOffline()) return;

		// A browser can raise "online" more than once, and a reconnect while a
		// flush is still running would send the same frames twice.
		if (flushing) return;
		flushing = true;
		try {
			await sendQueue(q);
		} finally {
			flushing = false;
		}
	}

	async function sendQueue(q) {

		// Somebody else may have scored this match while this device was away.
		// Replaying on top of that would renumber their frames, so it stops.
		const { data: m, error } = await supabaseClient
			.from('tbl_matches').select('card_version').eq('id', liveMatchId).maybeSingle();

		if (error) { TDC.showSupabaseError(AREA, error, els.stageStatus); return; }
		if (!m) { TDC.error(AREA, 'the match has gone while this device was offline.', null, els.stageStatus); return; }

		if (q.card_version !== null && m.card_version !== q.card_version) {
			const n = q.ops.length;
			showNotice('<strong>Someone else has scored this match.</strong> The '
				+ (n === 1 ? 'change saved on this phone has' : `${n} changes saved on this phone have`)
				+ ' not been sent, because sending them now would renumber their frames. '
				+ 'Check the card against what you wrote down before carrying on.', 'error');
			TDC.error(AREA, 'queue held back: card_version moved from ' + q.card_version + ' to ' + m.card_version);
			noteStale = 'Someone else has scored';
			paintStageNote();
			return;
		}

		renderOfflineNotice();

		// while/shift rather than for-of: the queue is being emptied as it goes,
		// so that a failure halfway leaves exactly what is still unsent.
		while (q.ops.length) {
			const op = q.ops[0];
			const { error: opError } = op.kind === 'remove'
				? await supabaseClient.rpc('tdc_remove_frame', { p_match_id: liveMatchId, p_frame_no: op.no })
				: await supabaseClient.rpc('tdc_record_frame',
					{ p_match_id: liveMatchId, p_frame_no: op.no, p_frame: op.payload });

			if (opError) {
				// Stop at the first refusal rather than pressing on. What is
				// left in the queue is what has not been sent.
				writeQueue(q);
				TDC.showSupabaseError(AREA, opError, els.stageStatus);
				showNotice('<strong>Something saved on this phone was refused.</strong> '
					+ 'Nothing after it has been sent. The message below the scoreboard says what happened.', 'error');
				return;
			}
			q.ops.shift();
		}

		writeQueue(null);
		await reloadFromServer();
		renderOfflineNotice();
	}

	function framePayload(f) {
		const payload = {
			break_outcome: f.break_outcome ?? null,
			winner_side: f.winner_side ?? null,
			result_event: f.result_event ?? null,
			status: f.status,
			home_players: f.home_players || [],
			away_players: f.away_players || [],
			rack_started_at: isoOrNull(f.rack_started_at),
			started_at: isoOrNull(f.started_at),
			ended_at: isoOrNull(f.ended_at),
			paused_seconds: f.paused_seconds || 0
		};

		// Left out unless someone set it by hand, because omitting it is what
		// tells the function to work the breaker out from the rule.
		if (f.break_side_manual && f.break_side) payload.break_side = f.break_side;

		// A frame awarded by default was never broken, and the function refuses
		// a break outcome on one.
		if (f.result_event === 'default') payload.break_outcome = null;

		return payload;
	}

	// ─── Saves, one after another ───
	// A quick second tap is never refused (UV, 24 Oct). Saves go into the
	// site's write queue (TDC.queued) and run in the order they were made,
	// never two at once, and the match is read back once, after the last of a
	// burst, so a frame tapped while another is saving does not blink off the
	// screen. Before, two quick taps ran at once and the second carried a
	// card_version the first had already moved on, so it was refused as
	// "someone else has scored".
	//
	// Every save still checks the card. One queued behind another expects
	// the version the save before it left, read straight back (readVersion),
	// so a burst of this screen's own taps is never taken for somebody
	// else's, while a real second scorer is still caught. Once that happens
	// the rest of the burst is not sent, rather than written over their
	// frames, and the player is told how many taps that was.
	const NOT_SENT = { message: 'not sent: the card had moved on' };
	let burst = { errors: [], ok: '', stopped: false, notSent: 0, wasOver: false };

	// write() is called when this save's turn comes, so it reads cardVersion
	// then. Resolves to { data, error }; pair it with savingFinished().
	function inTurn(message, write) {
		if (saving === 0) burst = { errors: [], ok: '', stopped: false, notSent: 0, wasOver: lastKnownOver };
		saving += 1;
		return TDC.queued(async () => {
			if (burst.stopped) { burst.notSent += 1; return { data: null, error: NOT_SENT }; }
			// message is no longer shown (UV, 29 Oct: never a loading message, only
			// the dots); the line is just cleared of the last one.
			TDC.status(els.stageStatus, '', '');
			let res;
			try { res = (await write()) || {}; } catch (err) { res = { data: null, error: err }; }
			if (res.error && res.error.code === 'TDC01') burst.stopped = true;
			else if (!res.error && saving > 1) await readVersion();
			return res;
		});
	}

	async function readVersion() {
		const { data, error } = await supabaseClient
			.from('tbl_matches').select('card_version').eq('id', liveMatchId).maybeSingle();
		if (error || !data) {
			// The next save then carries the old version and is refused as a
			// moved card: safe, if wrongly worded.
			TDC.error(AREA, 'could not read the card version between two saves.', error);
			return;
		}
		cardVersion = data.card_version;
	}

	// True for the last save of a burst, which is the one that read the match
	// back and said how it went.
	async function savingFinished(error, okMessage) {
		saving -= 1;
		if (error) { if (error !== NOT_SENT) burst.errors.push(error); }
		else if (okMessage) burst.ok = okMessage;
		if (saving > 0) return false;

		const b = burst;
		await reloadFromServer();

		// Somebody else scored while this screen was looking at an older card.
		// The write was refused, and the reload above has already put their
		// version on screen — so this says what happened rather than showing a
		// database message, and the score in front of the player is the real one.
		const moved = b.errors.find((e) => e.code === 'TDC01');
		if (moved) {
			const more = b.notSent
				? ` The ${b.notSent === 1 ? 'change' : b.notSent + ' changes'} you made after it ${b.notSent === 1 ? 'was' : 'were'} not sent either.`
				: '';
			showNotice('<strong>Someone else has scored this match.</strong> Your last change was '
				+ 'not saved, because it was aimed at the card as it was before theirs.' + more
				+ ' The score above is up to date — check it, then carry on.', 'error');
			TDC.status(els.stageStatus, 'Not saved — the card had already moved on.', '');
			noteStale = 'Someone else has scored';
			paintStageNote();
			console.error('[' + AREA + '] write refused: ' + (moved.details || moved.message));
			return true;
		}

		if (b.errors.length) {
			TDC.showSupabaseError(AREA, b.errors[b.errors.length - 1], els.stageStatus);
			if (b.errors.length > 1) {
				els.stageStatus.textContent = `${b.errors.length} changes were not saved. The last: ` + els.stageStatus.textContent;
			}
			return true;
		}

		// The reload above has brought in whatever arrived while this was busy,
		// so a "someone else has scored" banner is now describing something the
		// player is already looking at.
		if (staleKnown) { staleKnown = false; hideNotice(); }

		// Saved: nothing is said (UV, 30 Oct: no line saying what a call did;
		// the score and the dots show it), and an earlier message goes
		if (b.ok) TDC.status(els.stageStatus, '', '');

		// An official editing somebody else's card writes them a notification
		// (20261022110000), so the push for it goes out now rather than
		// waiting for the next page load.
		//
		// Only when the viewer is not a player in this match, which is exactly
		// when that notification fires. A player scoring their own match
		// writes none, and asking the queue on every frame would add a round
		// trip to the hot path for nothing — on a bad signal at the bar, that
		// is the one place it would be felt.
		if (!mySide()) TDC.flushPushes();
		return true;
	}

	async function reloadFromServer() {
		const loaded = await loadMatch(liveMatchId);
		if (!loaded) return;
		PLAYERS = loaded.players;
		MATCH = loaded.match;
		recomputeBreaks();
		syncClocks();
		draft = newDraft();
		lastKnownOver = matchOver();
		renderAll();
		renderResult();
	}

	// Scoring a frame bumps card_version, which can retire a submission, so the
	// panel is asked again rather than left showing something that has lapsed.
	async function refreshCardAfterWrite(wasOver) {
		if (!liveMatchId) return;
		await loadCardState();
		finishIfOver(wasOver);
		lastKnownOver = matchOver();
	}

	// ─────────────────────────────────────────────────────────────────
	// Finishing
	//
	// The target is reached, so the page offers to send the card in rather than
	// leaving it as a step to remember — a forgotten card is the one nobody ever
	// agrees. It asks first, because submitting is what locks the card, and a
	// mis-tap on the deciding frame should cost a tap rather than the night's
	// match. The frame is saved either way; only the submission waits.
	//
	// Only on the frame that *ends* it, which is what wasOver carries. Without
	// that, reopening a finished match to correct something would ask again on
	// the first correction — and answering would lock it after one fix.
	// ─────────────────────────────────────────────────────────────────

	let lastKnownOver = false;   // was the match over before the write in hand?
	let finishing = false;

	function finishIfOver(wasOver) {
		if (finishing || wasOver) return;
		if (!liveMatchId || !canEdit || isOffline()) return;
		if (!matchOver() || !MATCH.frames.length) return;
		if (!cardState || cardState.state !== 'in_progress') return;

		showFinishOverlay();
	}

	async function submitFinishedCard() {
		if (finishing) return;
		finishing = true;
		try {
			const { error } = await supabaseClient.rpc('tdc_submit_card', { p_match_id: liveMatchId });

			// The other player's device got there first. Both saw the same last
			// frame, so this is a race, not a fault.
			const alreadyIn = error && /already been (submitted|agreed)/i.test(error.message || '');
			if (error && !alreadyIn) { TDC.showSupabaseError(AREA, error, els.stageStatus); return; }

			await loadCardState();
			TDC.status(settled() ? els.resultStatus : els.stageStatus,
				cardState && cardState.no_approval
					? 'Match over. The card is settled.'
					: 'Match over. The card has gone to ' + opponentName() + ' to check.',
				'success');

			if (!error) tellTheOther('submitted');
		} finally {
			finishing = false;
		}
	}

	async function persistFrame(no, okMessage) {
		if (!liveMatchId) return;

		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'nothing to save: no frame numbered ' + no, null, els.stageStatus); return; }

		if (isOffline()) {
			enqueue({ kind: 'frame', no, payload: framePayload(f) });
			TDC.status(els.stageStatus, `${okMessage} Kept on this phone until you are back online.`, 'success');
			return;
		}

		// What was tapped, taken now: the save may wait its turn behind others.
		const payload = framePayload(f);
		const { error } = await inTurn(`Saving frame ${no}…`, () => supabaseClient.rpc('tdc_record_frame', {
			p_match_id: liveMatchId,
			p_frame_no: no,
			p_frame: payload,
			p_card_version: cardVersion
		}));
		// Whether the match was over before the burst began (inTurn reads it
		// before anything is written or reloaded: the frame being saved is
		// already in MATCH, so asking afterwards would always say "it was over").
		const wasOver = burst.wasOver;
		if (await savingFinished(error, okMessage)) await refreshCardAfterWrite(wasOver);
		return { error };   // for the dots on the score (scoreDots)
	}

	// Settings and the lag winner go together, because both move the whole
	// match: the server re-derives every break side and puts back any frame the
	// new rules have made impossible, then says how many of each it touched.
	async function persistSettings() {
		if (!liveMatchId) return;

		// The settings as they are now: the save may wait its turn.
		const rules = JSON.parse(JSON.stringify(MATCH.rules));
		const firstBreak = MATCH.first_break_side;
		const { data, error } = await inTurn('Saving settings…', () => supabaseClient.rpc('tdc_update_match_settings', {
			p_match_id: liveMatchId,
			p_rules: rules,
			p_first_break_side: firstBreak
		}));

		let message = 'Settings saved.';
		if (!error && data) {
			const parts = [];
			if (data.breaks_changed) parts.push(`${data.breaks_changed} break${data.breaks_changed === 1 ? '' : 's'} re-worked`);
			if (data.results_downgraded) {
				parts.push(`${data.results_downgraded} frame${data.results_downgraded === 1 ? '' : 's'} no longer a break & finish`);
			}
			if (parts.length) message = 'Settings saved — ' + parts.join(', ') + '.';
		}
		await savingFinished(error, message);
	}

	async function persistRemoval(no) {
		if (!liveMatchId) return;

		// Only reachable offline for a frame still in the queue — undo() checks
		// first — so this drops it rather than queueing a removal of something
		// the server has never seen.
		if (isOffline()) {
			dropLastQueued();
			TDC.status(els.stageStatus, `Frame ${no} removed before it was sent.`, '');
			return;
		}

		const { error } = await inTurn(`Removing frame ${no}…`, () => supabaseClient.rpc('tdc_remove_frame', {
			p_match_id: liveMatchId,
			p_frame_no: no,
			p_card_version: cardVersion
		}));
		await savingFinished(error, `Frame ${no} removed.`);
	}

	// ─────────────────────────────────────────────────────────────────
	// Live updates
	//
	// A match is watched as well as scored — players follow the score from the
	// next table, and the other scorer needs to see a correction land. Without
	// this, a second screen is wrong until somebody thinks to reload.
	//
	// Only two subscriptions are needed, and neither is on tbl_frames:
	//   tbl_matches UPDATE   — every frame change bumps card_version, so this
	//                          one row carries insert, correction and removal
	//                          alike, as well as settings and status
	//   tbl_match_events INSERT — agreeing writes only an event, and nothing on
	//                          the match, so it would otherwise go unheard
	//
	// Avoiding DELETE events is deliberate. Postgres only sends a deleted row's
	// key unless the table keeps a full replica identity, so a filter on
	// match_id could not match one — and turning that on would put every
	// deleted frame's contents on a channel name anybody could guess.
	//
	// Realtime is for immediacy, not for correctness: events are missed while a
	// phone is locked or the socket is down. Re-reading whenever the page is
	// shown again, and whenever the connection returns, is what makes a missed
	// event harmless.
	// ─────────────────────────────────────────────────────────────────

	let liveChannel = null;
	let liveTimer = null;
	let staleKnown = false;      // a change arrived that we chose not to apply

	function startLiveUpdates() {
		if (!liveMatchId || liveChannel) return;

		liveChannel = supabaseClient
			.channel('match:' + liveMatchId)
			.on('postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'tbl_matches', filter: 'id=eq.' + liveMatchId },
				(payload) => {
					// Our own write, already on screen. The reload after every
					// save has set cardVersion to this value. With the card
					// unchanged, it may be a break event tapped (onBreakInPlay).
					if (payload.new && payload.new.card_version === cardVersion) { onBreakInPlay(payload.new); return; }
					onRemoteChange();
				})
			.on('postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'tbl_match_events', filter: 'match_id=eq.' + liveMatchId },
				onRemoteChange)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') return;
				// Not fatal: the page still works, it just stops being live
				// until the next time it is shown. Said out loud rather than
				// left as a screen that quietly stops updating.
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					console.error('[' + AREA + '] live updates are not running (' + status + ').');
				}
			});
	}

	function stopLiveUpdates() {
		if (!liveChannel) return;
		supabaseClient.removeChannel(liveChannel);
		liveChannel = null;
	}

	// The break event is saved on the match as it is tapped (UV, 30 Oct:
	// every phone that opens the match shows it; 20261030155332). In the
	// page's write queue, so it goes after a frame still saving and names the
	// frame that will then be in play; no reload, and no dots (UV: the ring
	// blanking on a break tap read as glitching), so it is asked for quietly
	// (quietAsk, the ring's onAsk at the end). Offline, nothing is sent: the
	// frame carries it once saved. The other phones hear the match change
	// (onBreakInPlay); this phone's own come back too and are let pass.
	let quietAsk = false;
	const ownBreaks = [];   // this phone's saved break events not yet heard back, oldest first
	function saveBreakInPlay() {
		if (!liveMatchId || isOffline()) return;
		const frameNo = MATCH.frames.length + 1, outcome = draft.break_outcome;
		const key = frameNo + '|' + outcome;
		// Noted before it is sent: the match's change can be heard before the
		// call's own answer
		ownBreaks.push(key);
		const unnote = () => { const i = ownBreaks.indexOf(key); if (i >= 0) ownBreaks.splice(i, 1); };
		TDC.queued(() => {
			quietAsk = true;
			try {
				return supabaseClient.rpc('tdc_set_break_in_play', { p_match_id: liveMatchId, p_frame_no: frameNo, p_break_outcome: outcome });
			} finally { quietAsk = false; }
		}).then(({ error }) => {
			if (error) { unnote(); TDC.showSupabaseError(AREA, error, els.stageStatus); }
		}, (err) => { unnote(); TDC.error(AREA, 'the break event could not be saved.', err, els.stageStatus); });
	}

	// Another phone's break event, selected here as if tapped, so the ring and
	// the special wins follow it (renderStage); nothing else changes. Held as
	// another's (draft.remoteBreak), so it never makes this phone busy and the
	// saved frame still comes in by itself. Only for the frame in play on
	// the card as this phone has it.
	function onBreakInPlay(row) {
		if (!MATCH || !draft || !row.break_in_play) return;
		if (row.break_in_play_frame_no !== MATCH.frames.length + 1 || row.break_in_play_card_version !== cardVersion) return;
		const key = row.break_in_play_frame_no + '|' + row.break_in_play;
		// This phone's own, heard back: what it shows already, or older than it
		const own = ownBreaks.indexOf(key);
		if (own >= 0) { ownBreaks.splice(0, own + 1); return; }
		MATCH.break_in_play = { frame_no: row.break_in_play_frame_no, outcome: row.break_in_play };
		if (draft.break_outcome === row.break_in_play) return;
		draft.break_outcome = row.break_in_play;
		draft.remoteBreak = true;
		renderStage();
	}

	// Mid-frame is the wrong moment to redraw: a reload starts a fresh draft,
	// which would throw away a break event somebody has already tapped. So the
	// screen is left alone and the change is offered instead.
	function busyScoring() {
		if (!draft) return false;
		// Another phone's break event is not this phone scoring (onBreakInPlay)
		if (draft.remoteBreak) return !!(overlayMode || cellMenuOpen);
		return !!(draft.break_outcome || frameStartedAt !== null || overlayMode || cellMenuOpen);
	}

	function onRemoteChange() {
		if (liveTimer) clearTimeout(liveTimer);

		// A correction can move every frame, which arrives as a burst. One
		// reload at the end of it is enough.
		liveTimer = setTimeout(async () => {
			liveTimer = null;
			if (saving > 0) { staleKnown = true; return; }
			if (busyScoring()) {
				staleKnown = true;
				showNotice('<strong>Someone else has scored this match.</strong> '
					+ 'Finish what you are doing, then <button type="button" class="link-toggle" '
					+ 'data-act="refreshnow">refresh</button> to see it.', '');
				noteStale = 'Someone else has scored';
				paintStageNote();
				return;
			}
			await refreshFromRemote();
		}, 250);
	}

	// What another phone changed (the score, the frame, the stats) fades out
	// and in (TDC.liveFade, UV 29 Oct). Only here: a tap of this phone's is
	// shown by the dots tracing its score (scoreDots), and this never runs
	// while one of its saves is out.
	async function refreshFromRemote() {
		if (isOffline()) { blockedOffline('Refreshing the match'); return; }
		staleKnown = false;
		hideNotice();
		const snap = TDC.liveSnapshot(document);
		await reloadFromServer();
		// At once, in the same task as the drawing, so the new score is never
		// painted before the old one fades out; the card state's wait came
		// between them, and the new score showed for its length (UV, 30 Oct).
		TDC.liveFade(document, snap);
		await loadCardState();
	}

	// Coming back to the page, or back onto the network, is the moment a missed
	// event would show up as a wrong score. Re-read rather than trust the socket.
	function refreshIfShown() {
		if (document.visibilityState !== 'visible') return;
		if (!liveMatchId || isOffline() || saving > 0 || busyScoring()) return;
		refreshFromRemote();
	}

	// ─────────────────────────────────────────────────────────────────

	function start() {
		document.addEventListener('click', onClick);
		els.panel.addEventListener('change', onSettingChange);
		els.when.addEventListener('change', persistWhen);
		// The slide reaching its end is the undo; the control puts itself back.
		els.undoSlide.addEventListener('change', () => {
			if (Number(els.undoSlide.value) <= Number(els.undoSlide.min)) undo();
		});
		// The score is the plain-win button, as the old card's <button> was
		for (const half of [els.p0, els.p1]) {
			half.querySelector('.mv-score').addEventListener('keydown', (e) => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				e.currentTarget.click();
			});
		}
		els.tlToggle.addEventListener('click', () => { setTimelinePref('timeline', !timelineOn()); renderHistory(); });
		els.tlWidths.addEventListener('click', () => { setTimelinePref('widths', !widthsByTime()); renderHistory(); });
		new ResizeObserver(() => drawTimeline()).observe(els.wideBox);
		els.panelClose.addEventListener('click', closePanel);
		els.scrim.addEventListener('click', closePanel);
		document.addEventListener('keydown', (e) => {
		if (e.key !== 'Escape') return;
		if (cellMenuOpen) closeCellMenu(); else closePanel();
	});

	// Anywhere outside it closes it, the way a menu should. Capture, so it runs
	// before the click handler that might open another one.
	document.addEventListener('click', (e) => {
		if (!cellMenuOpen) return;
		if (els.cellMenu.contains(e.target)) return;
		if (e.target.closest('[data-act="editcell"], [data-act="editbreak"], [data-act="editside"]')) return;
		closeCellMenu();
	}, true);

		recomputeBreaks();
		syncClocks();
		draft = newDraft();
		renderAll();
		setInterval(tick, 250);
	}

	TDCLoader.hold((async () => {
		const id = new URLSearchParams(location.search).get('id');

		// Nothing is drawn without a match. Both of these used to fall back to
		// the mockup, which meant a wrong address quietly showed somebody a
		// fictional league night instead of saying it could not find theirs.
		if (!id) {
			showNotice('<strong>No match in the address.</strong> Open one from '
				+ '<a href="/matches/">your matches</a>, or from a tournament draw.');
			return;
		}

		if (!UUID_RE.test(id)) {
			TDC.error(AREA, 'the id in the address is not a match id: ' + id, null, els.stageStatus);
			showNotice('<strong>That is not a match id.</strong> The address needs the match\'s id, '
				+ 'which looks like <code>215b10ec-de44-4c61-a513-ab9768c43e72</code>. '
				+ 'Open one from <a href="/matches/">your matches</a>.', 'error');
			return;
		}

		// Frames are readable by signed-in users only, so without a session the
		// query would come back empty and read as "no such match".
		const session = await TDC.getSession(AREA);
		if (!session) {
			showNotice('<strong>Please sign in.</strong> Match data is only readable once you have '
				+ 'signed in. <a href="/accounts/?next=' + encodeURIComponent(location.pathname + location.search)
				+ '">Sign in</a>, and this match will open.', 'error');
			return;
		}

		// start() draws the stage from MATCH, so there is nothing to start
		// when there is no match. Both of these used to draw the mockup under
		// the message instead, which is how a failed load ended up looking
		// like somebody else's league night.
		const loaded = await loadMatch(id);
		if (!loaded) return;

		PLAYERS = loaded.players;
		MATCH = loaded.match;
		liveMatchId = loaded.match.id;

		// Ask before drawing the controls, rather than letting someone score a
		// frame and then telling them it was never theirs to score.
		const { data: mayEdit, error: editError } = await supabaseClient
			.rpc('tdc_may_edit_match', { p_match_id: liveMatchId });

		if (editError) {
			// Err towards read-only: a watcher who cannot score is a small
			// annoyance, a scorer whose frames are all refused is a ruined night.
			canEdit = false;
			TDC.showSupabaseError(AREA, editError, els.stageStatus);
		} else {
			canEdit = mayEdit === true;
		}

		// The same helper the delete itself asks, so the button is never
		// offered to somebody it would refuse.
		const { data: mayDelete, error: deleteError } = await supabaseClient
			.rpc('tdc_may_delete_match', { p_match_id: liveMatchId });
		if (deleteError) {
			canDelete = false;
			TDC.showSupabaseError(AREA, deleteError, els.stageStatus);
		} else {
			canDelete = mayDelete === true;
		}

		// And the same for the rules and the time, from the helper both
		// functions ask.
		const { data: mayChange, error: changeError } = await supabaseClient
			.rpc('tdc_may_change_match', { p_match_id: liveMatchId });
		if (changeError) {
			canChange = false;
			TDC.showSupabaseError(AREA, changeError, els.stageStatus);
		} else {
			canChange = mayChange === true;
		}

		// A player who finds the scoring buttons gone deserves a sentence
		// rather than a blank card. Only says anything when the reason is the
		// tournament's score_entry_mode; a stranger to the match gets nothing,
		// because telling them about a tournament they are not in is noise.
		if (!canEdit) {
			const { data: note, error: noteError } = await supabaseClient
				.rpc('tdc_score_entry_note', { p_match_id: liveMatchId });
			if (noteError) {
				console.error('[' + AREA + '] could not check why scoring is closed.', noteError);
			} else {
				noEditNote = note || null;
			}
		}

		const myPlayer = await TDC.getMyPlayer(AREA, session.user.id, null);
		myPlayerId = myPlayer ? myPlayer.id : null;
		await loadCardState();

		window.addEventListener('tdc:offline', renderOfflineNotice);
		window.addEventListener('tdc:online', () => {
			// Repaint first: with nothing queued, flushQueue() returns at once
			// and the offline notice would otherwise stay on screen.
			renderOfflineNotice();
			flushQueue();
			refreshIfShown();
		});

		startLiveUpdates();
		document.addEventListener('visibilitychange', refreshIfShown);
		window.addEventListener('pagehide', stopLiveUpdates);

		renderOfflineNotice();
		start();

		// Anything left over from a previous visit goes now.
		if (!isOffline() && queuedCount()) flushQueue();
	})(), 'Match');

	// ─── The dots, always on the ring (UV, 30 Oct) ─────────────────────
	// Every network call on this page is shown by the dots on the info ring
	// (ringEl: grey, where the idle dot was, since 3 Nov; the cream ring in
	// the break ring's hole before),
	// never by the dots flying to whatever was tapped: they come to the ring
	// and wait on its line, sized by its stroke (line: the ring is its own
	// border), while it dims, words and all (dots.css, the busy look), then
	// race it and fade as it comes back. (Until then they ran on a loop, a
	// pretend 15 s call every 20 s, while there were no calls to show.)
	//   Each call asked for (TDCNet.onAsk, every rpc and from) serves the
	//   ring until the network is quiet; more calls meanwhile are waited for.
	//   Anything else on the page that serves the dots (the nav, a control,
	//   TDC.writer) is sent to the ring instead, its own result still shown
	//   when its call is back. The loading screen keeps its own dots: while it
	//   is up nothing is sent to the ring, and its own ring is let through.
	//   Nor once the card is submitted and the result view has put the
	//   stage away (the ring has no size then): each control there keeps its
	//   own dots, as on every other page.
	const serveAt = TDCDots.serve;
	const ringShown = () => !els.matchPage.hidden && ringEl().offsetWidth > 0;
	const onRing = (promise) => serveAt(ringEl(), promise, { line: true, status: els.stageStatus });
	TDCDots.serve = (el, promise, opts = {}) => {
		if (TDCLoader.up || !ringShown() || (el && el.closest && el.closest('.tdc-loader'))) return serveAt(el, promise, opts);
		onRing(promise);
		if (opts.reveal) Promise.resolve(promise).then(() => opts.reveal(), () => opts.reveal());
		return promise;
	};
	TDCNet.onAsk(() => {
		if (quietAsk) return;   // the break event's save has no dots (saveBreakInPlay)
		if (!TDCLoader.up && ringShown()) { idleCancel(); onRing(TDCNet.quiet()); }
	});

	// ─── The idle dots (UV, 2 Nov; in the info ring since 3 Nov) ──────
	// Between saves the page's one set of dots plays in the info ring the
	// dots use (ringEl; not the yellow pill, while nobody is known to break):
	// still for IDLE_REST, then the ring and its words shrink into a grey dot
	// (data-shape, match.css), the dot shrinks into the dots as they open
	// out of it (its idle box, from 'centre'), they play the pool move (the
	// two balls on a tilted table) for IDLE_PLAY, cut off if it has not
	// finished, they gather back into the dot (end 'gather'), and the dot
	// grows back into the ring and its words (UV, 3 Nov); then round again.
	// Never two things at once (UV): a save takes the dots to the ring
	// itself mid-cycle, the words growing back under them. When a save is
	// back and the break ring is sliding over the ring it ran on, the dots
	// fly to the ring it uncovers, which already shows the new words, and
	// race that. Not with less motion (dots.js's own reading of it), behind
	// the loading screen, or once the stage is put away.
	// Nor once nobody has touched the page for IDLE_SLEEP (UV, 3 Nov:
	// battery): the round due then is not played, and nothing runs until the
	// next touch, key or scroll, or the page being shown again, which starts
	// the rest afresh.
	const IDLE_REST = 10000, IDLE_PLAY = 5000;   // the rest 10 s since UV's second look (2 Nov; it was 5)
	const IDLE_SLEEP = 120000;
	const rings = [els.yellow, ...els.infos];
	const idleBoxes = els.infos.map((b) => b.querySelector('.mv-info-idle'));
	let idleTimer = null, idleEnd = null, idleInfo = null;
	let idleTouched = performance.now(), idleAsleep = false;
	const idleOn = () => ringEl() !== els.yellow && !TDCLoader.up && ringShown() && !TDCDots.state.reduced;
	const idleBusy = () => !!idleEnd || !!idleInfo || idleBoxes.some((b) => b.dataset.dots) || rings.some((r) => r.dataset.dots);
	// The ring and its words grow back out of the dot
	function growBack() {
		if (!idleInfo) return;
		delete idleInfo.dataset.shape;
		idleInfo = null;
	}
	function idleCancel() {
		clearTimeout(idleTimer);
		idleTimer = null;
		if (idleEnd) { const end = idleEnd; idleEnd = null; end(); }
		growBack();
	}
	function idleRest() {
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => { idleTimer = null; idlePlay(); }, IDLE_REST);
	}
	// The ring shrinks into its dot, and once it has (--mv-info-shrink) the
	// pool plays there for IDLE_PLAY
	function idlePlay() {
		if (!idleOn()) return;
		if (performance.now() - idleTouched >= IDLE_SLEEP) { idleAsleep = true; return; }
		if (idleBusy()) { idleRest(); return; }
		const info = ringEl(), box = info.querySelector('.mv-info-idle');
		idleInfo = info;
		info.dataset.shape = 'dot';
		idleTimer = setTimeout(() => {
			let end;
			const play = new Promise((resolve) => { end = resolve; });
			idleEnd = end;
			idleTimer = setTimeout(() => { idleTimer = null; if (idleEnd === end) { idleEnd = null; end(); } }, IDLE_PLAY);
			serveAt(box, play, { move: 'pool', from: 'centre', end: 'gather', line: true, timeout: IDLE_PLAY * 4, status: els.stageStatus });
		}, timeMs(getComputedStyle(info).getPropertyValue('--mv-info-shrink')));
	}
	// A call is back and its dots race the ring it ran on; if the break ring
	// is now sliding over that ring (placeKnob), they go to the one it
	// uncovers instead
	function idleBack(ring) {
		const now = ringEl();
		if (ring === now || ring.dataset.dots !== 'revealing' || !ringShown()) return;
		serveAt(now, Promise.resolve(), { line: true, status: els.stageStatus });
	}
	// Once a call's dots are done, or the pool's have gathered into the dot
	// and it is back (dots.js takes data-dots off), the ring grows back and
	// the rest begins
	for (const ring of rings) {
		new MutationObserver(() => {
			if (ring.dataset.dots === 'revealing') setTimeout(() => idleBack(ring), 0);   // after placeKnob has read the same change
			else if (!ring.dataset.dots && !idleEnd && !idleTimer && !idleInfo) idleRest();
		}).observe(ring, { attributes: true, attributeFilter: ['data-dots'] });
	}
	for (const box of idleBoxes) {
		new MutationObserver(() => {
			if (box.dataset.dots || idleEnd) return;
			if (idleInfo === box.parentElement) growBack();
			if (!idleTimer) idleRest();
		}).observe(box, { attributes: true, attributeFilter: ['data-dots'] });
	}
	function idleWake() {
		idleTouched = performance.now();
		if (idleAsleep) { idleAsleep = false; idleRest(); }
	}
	for (const type of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(type, idleWake, { passive: true, capture: true });
	document.addEventListener('scroll', idleWake, { passive: true, capture: true });
	document.addEventListener('visibilitychange', () => { if (!document.hidden) idleWake(); });
	// The first round once the page is in (the loading screen has no event
	// for it, so it is looked for four times a second until then)
	const idleStart = setInterval(() => {
		if (TDCLoader.up || !knobDrawn) return;
		clearInterval(idleStart);
		idleRest();
	}, 250);
})();
