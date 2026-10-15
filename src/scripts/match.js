// Match scorecard (/match/).
//
// Two modes, decided by the address:
//   /match/            the built-in mockup below. Quickest way to work on layout.
//   /match/?id=<uuid>  that match, read from the database.
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

	// Replaced wholesale when a real match is loaded; see loadMatch().
	let PLAYERS = {
		yesh:   { id: 'yesh',   display_name: 'Yesh',   full_name: 'Yesh Naicker',    avatar_url: null },
		linton: { id: 'linton', display_name: 'Linto',  full_name: 'Linton Pillay',   avatar_url: null },
		damian: { id: 'damian', display_name: 'Dame',   full_name: 'Damian Reddy',    avatar_url: null },
		uv:     { id: 'uv',     display_name: 'UV',     full_name: 'Yuvan Naidoo',    avatar_url: null },
		joe:    { id: 'joe',    display_name: 'Joe',    full_name: 'Joe Abrahams',    avatar_url: null },
		trevor: { id: 'trevor', display_name: 'Trev',   full_name: 'Trevor Mokoena',  avatar_url: null },
		sipho:  { id: 'sipho',  display_name: 'Sipho',  full_name: 'Sipho Dlamini',   avatar_url: null }
	};

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

	let MATCH = {
		id: 'mockup-match',

		// kind is 'league', 'tournament' or 'social'. The page does not branch on
		// it beyond the label: settings do the work.
		context: { kind: 'league', name: 'Fourways Tuesday League', season: 'Season 4', round: 'Round 3' },
		sanctioned: true,

		venue: 'The Dive Club',
		tables: ['Table 1', 'Table 3'],
		scheduled_at: '2026-10-13T18:30:00+02:00',
		referee: 'Linton Pillay',

		// Who won the lag, and so who breaks the first frame. A match-level fact:
		// change it and every frame's breaker moves with it.
		first_break_side: 'home',

		home: { name: 'Dive Club Sharks', crest_url: null, players: ['yesh', 'linton', 'damian', 'uv'] },
		away: { name: 'Kyalami Hustlers', crest_url: null, players: ['joe', 'trevor', 'sipho'] },

		// Every key present with an explicit value, flat, no nesting. The real one
		// is merged (league → season → round) and frozen onto the match.
		rules: {
			version: 1,
			discipline: '8ball',
			win_condition_type: 'race_to',
			win_condition_target: 7,
			track_breaks: true,
			break_determination: 'alternate',
			draws_allowed: false,
			tiebreak_method: 'sudden_death_frame',
			on_time_expiry: 'finish_current_frame',
			max_match_minutes: 0, // 0 = no match clock
			golden_break_enabled: true,
			reverse_break_finish_enabled: true,
			// When false, break & finish and golden break may go to either side.
			break_finish_enabled: true,
			break_finish_requires_breaker: true,
			shot_clock_enabled: false, // off for most matches; a ref runs it when on
			shot_clock_seconds: 45,
			shot_clock_first_shot_seconds: 60,
			extensions_per_player: 1,
			extension_seconds: 45,
			referee_required: true,
			score_entry_mode: 'referee',
			approval_mode: 'dispute_window',
			dispute_window_hours: 48
		},

		// break_side is written by recomputeBreaks(), unless break_side_manual is
		// set — a breaker corrected by hand in the history table is left alone.
		frames: [
			{ no: 1, table: 'Table 1', home_players: ['yesh'],   away_players: ['joe'],    break_side: null, break_side_manual: false, break_outcome: 'in',   result_event: 'break_and_finish',         winner_side: 'home', status: 'complete', rack_started_at: null, started_at: null, ended_at: null, paused_seconds: 0 },
			{ no: 2, table: 'Table 3', home_players: ['linton'], away_players: ['trevor'], break_side: null, break_side_manual: false, break_outcome: 'foul', result_event: 'win',                      winner_side: 'home', status: 'complete', rack_started_at: null, started_at: null, ended_at: null, paused_seconds: 0 },
			{ no: 3, table: 'Table 1', home_players: ['damian'], away_players: ['sipho'],  break_side: null, break_side_manual: false, break_outcome: 'dry',  result_event: 'reverse_break_and_finish', winner_side: 'away', status: 'complete', rack_started_at: null, started_at: null, ended_at: null, paused_seconds: 0 },
			// Scotch doubles: two players a side, which is why participants are
			// their own rows rather than one player column on the frame.
			{ no: 4, table: 'Table 3', home_players: ['yesh', 'uv'], away_players: ['joe', 'sipho'], break_side: null, break_side_manual: false, break_outcome: 'in', result_event: 'win', winner_side: 'away', status: 'complete', rack_started_at: null, started_at: null, ended_at: null, paused_seconds: 0 }
		]
	};

	// ─────────────────────────────────────────────────────────────────
	// Labels and setting definitions live in match-settings.js, because the
	// create-a-match page builds its form from the same list. Adding a setting
	// is one edit there and nothing here.
	// ─────────────────────────────────────────────────────────────────

	const {
		DISCIPLINE, BREAK_OUTCOME, RESULT_EVENT, RESULT_SHORT, BREAK_DETERMINATION,
		WIN_CONDITION, TIME_EXPIRY, TIEBREAK, SCORE_ENTRY, APPROVAL, SIDE_TAG,
		GROUPS, SETTINGS
	} = TDCMatchDef;

	// This page's sides are the two players.
	TDCMatchDef.setSideNames(() => ({ home: MATCH.home.name, away: MATCH.away.name }));

	// ─────────────────────────────────────────────────────────────────
	// Page wiring
	// ─────────────────────────────────────────────────────────────────

	const el = (id) => document.getElementById(id);
	const els = {
		halfHome: el('half-home'), halfAway: el('half-away'),
		midFrame: el('mid-frame'), midTarget: el('mid-target'),
		overlay: el('overlay'), overlayQ: el('overlay-q'), overlayRow: el('overlay-row'), overlayHint: el('overlay-hint'),
		stageStatus: el('stage-status'),
		timeBody: el('time-body'),
		undoBtn: el('undo-btn'),
		tallTable: el('history-tall'), wideTable: el('history-wide'), historyLegend: el('history-legend'),
		scrim: el('panel-scrim'),
		panel: el('settings-panel'), panelClose: el('panel-close'),
		contextLine: el('context-line'), badgeRow: el('badge-row'), panelNote: el('panel-note'),
		setGroups: el('set-groups'),
		notice: el('match-notice')
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

	function matchWinner() {
		if (MATCH.rules.win_condition_type !== 'race_to') return null;
		const t = MATCH.rules.win_condition_target;
		if (framesWon('home') >= t) return 'home';
		if (framesWon('away') >= t) return 'away';
		return null;
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
			case 'alternate':     return i % 2 === 0 ? first : otherSide(first);
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

	function newDraft() {
		return {
			home_players: carriedLineup('home'),
			away_players: carriedLineup('away'),
			table: MATCH.tables[0],
			break_side: breakSideAt(MATCH.frames.length, MATCH.frames),
			break_outcome: null
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
		'breakside', 'outcome', 'result', 'more', 'walkover', 'abandon',
		'changetable', 'settable', 'pick', 'pickplayer',
		'editside', 'editbreak', 'editcell', 'setcell'
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

	// Initials stand in until there is a real picture.
	function initialsOf(text) {
		return text.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
	}

	function avatar(url, label, cls) {
		if (url) {
			const img = document.createElement('img');
			img.className = 'avatar' + (cls ? ' ' + cls : '');
			img.src = url;
			img.alt = '';
			return img;
		}
		const d = div('avatar placeholder' + (cls ? ' ' + cls : ''), initialsOf(label));
		d.setAttribute('aria-hidden', 'true');
		return d;
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
	// The stage
	//
	// Each half is three bands: a header (who), the score, and the buttons.
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
		if (!draft.break_side || !draft.break_outcome) return true;
		if ((ev === 'break_and_finish' || ev === 'golden_break') && draft.break_outcome !== 'in') return true;
		return false;
	}

	// Band 1: who is playing. A team shows its name and the lineup; a singles
	// side shows the player's display name and their full name underneath.
	function renderHalfHeader(side) {
		const head = div('half-head');
		const lineup = draft[side + '_players'];
		const isTeam = MATCH[side].players.length > 1;

		const title = isTeam ? MATCH[side].name : (lineup.length ? player(lineup[0]).display_name : MATCH[side].name);
		const sub = isTeam
			? (lineup.length ? names(lineup) : 'Choose players')
			: (lineup.length ? player(lineup[0]).full_name : '');

		head.append(avatar(isTeam ? MATCH[side].crest_url : (lineup.length ? player(lineup[0]).avatar_url : null), title));

		const text = div('half-head-text');
		const row = div('half-title-row');
		row.append(heading('h3', title, 'half-name'));
		if (draft.break_side === side) {
			const flag = document.createElement('span');
			flag.className = 'break-flag';
			flag.textContent = 'Breaking';
			row.append(flag);
		}
		text.append(row);

		const subEl = document.createElement(isTeam ? 'button' : 'div');
		subEl.className = 'half-sub';
		subEl.textContent = sub;
		if (isTeam) {
			subEl.type = 'button';
			subEl.dataset.act = 'pick';
			subEl.dataset.side = side;
		}
		text.append(subEl);

		head.append(text);
		return head;
	}

	function renderHalf(side) {
		const host = side === 'home' ? els.halfHome : els.halfAway;
		host.replaceChildren();
		host.classList.toggle('breaking', draft.break_side === side);
		host.classList.toggle('leading', framesWon(side) > framesWon(otherSide(side)));

		host.append(renderHalfHeader(side));

		// Band 2: the score.
		const mid = div('half-mid');
		mid.append(div('half-score', framesWon(side)));
		host.append(mid);

		// Band 3: the buttons.
		const foot = div('half-foot');

		if (matchWinner()) {
			foot.append(div('half-group-label', matchWinner() === side ? 'Match won' : ''));
			host.append(foot);
			return;
		}

		if (draft.break_side === side) {
			const g = div('half-group');
			g.append(div('half-group-label', 'On the break'));
			const row = div('half-row');
			for (const [value, label] of Object.entries(BREAK_OUTCOME)) {
				row.append(mbtn(label, draft.break_outcome === value ? 'on' : '', { act: 'outcome', value }));
			}
			g.append(row);
			foot.append(g);
		}

		const rg = div('half-group');
		rg.append(div('half-group-label', 'Frame won by'));
		const rrow = div('half-row');
		for (const ev of resultsFor(side, draft.break_side)) {
			rrow.append(mbtn(RESULT_EVENT[ev], 'result', { act: 'result', side, value: ev }, resultDisabled(ev)));
		}
		rrow.append(mbtn('⋯', 'more', { act: 'more', side }));
		rg.append(rrow);
		foot.append(rg);

		host.append(foot);
	}

	function renderStage() {
		els.midFrame.textContent = matchWinner() ? 'Final' : `Frame ${MATCH.frames.length + 1}`;
		els.midTarget.textContent = `${WIN_CONDITION[MATCH.rules.win_condition_type] || 'TDC (Error)'} ${MATCH.rules.win_condition_target}`;

		if (overlayMode === null) {
			const needsBreak = MATCH.rules.track_breaks && !draft.break_side && !matchWinner();
			if (needsBreak) showBreakOverlay();
			else els.overlay.hidden = true;
		}

		renderHalf('away');
		renderHalf('home');
	}

	// ─────────────────────────────────────────────────────────────────
	// Timing panel
	// ─────────────────────────────────────────────────────────────────

	const isRacking = () => frameStartedAt === null && !matchWinner();

	function renderTimePanel() {
		const r = MATCH.rules;
		const body = els.timeBody;
		for (const k of Object.keys(liveVals)) delete liveVals[k];
		body.replaceChildren();

		body.append(readout('State',
			matchWinner() ? 'Match over' : (isRacking() ? 'Racking' : `Frame ${MATCH.frames.length + 1} running`)));
		body.append(readout('Table', draft.table));
		body.append(readout('Rack time', '—', { live: 'rack' }));
		body.append(readout('Frame time', '—', { live: 'frame' }));
		body.append(readout('Match time', '—', { live: 'match' }));

		const pauseRow = div('time-actions');
		pauseRow.append(
			mbtn(timerRunning(frameTimer) ? 'Pause frame' : 'Resume frame', '', { act: 'toggleframe' },
				frameStartedAt === null || !!matchWinner()),
			mbtn(timerRunning(matchTimer) ? 'Pause match' : 'Resume match', '', { act: 'togglematchtimer' }, !!matchWinner())
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
				mbtn(MATCH.home.name, '', { act: 'turn', side: 'home' }, !!matchWinner()),
				mbtn(MATCH.away.name, '', { act: 'turn', side: 'away' }, !!matchWinner())
			);
			body.append(turns);

			const ctrl = div('time-actions');
			ctrl.append(
				mbtn(clock.running ? 'Pause shot' : 'Resume shot', '', { act: 'toggleshot' }, !clock.side || !!matchWinner()),
				mbtn('Reset shot', '', { act: 'resetshot' }, !clock.side || !!matchWinner())
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
		const set = (key, text, cls) => {
			const v = liveVals[key];
			if (!v) return;
			v.textContent = text;
			if (cls !== undefined) v.parentElement.className = 'time-readout' + (cls ? ' ' + cls : '');
		};

		set('rack', mmss(timerSeconds(rackTimer)), timerRunning(rackTimer) ? 'live' : '');
		set('frame', frameStartedAt === null ? '—' : mmss(timerSeconds(frameTimer)),
			frameStartedAt !== null && timerRunning(frameTimer) ? 'live' : '');
		set('match', mmss(timerSeconds(matchTimer)), timerRunning(matchTimer) ? 'live' : '');

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

	// Portrait: a row per frame, the frame number down the middle, each side's
	// result either side of it.
	function renderTallTable() {
		const t = els.tallTable;
		t.replaceChildren();
		if (!MATCH.frames.length) return;

		const head = document.createElement('tr');
		head.append(cell('th', MATCH.home.name), cell('th', 'Frame', 'col-mid'), cell('th', MATCH.away.name));
		t.append(head);

		for (const f of MATCH.frames) {
			const tr = document.createElement('tr');

			for (const side of ['home', null, 'away']) {
				if (side === null) {
					// Middle: the frame number, and who broke it.
					const mid = cell('td', undefined, 'col-mid edit', { act: 'editbreak', no: f.no });
					mid.append(div('frame-no', f.no));
					mid.append(div('frame-break',
						f.break_side ? `${SIDE_TAG[f.break_side]} broke${f.break_outcome ? ': ' + BREAK_OUTCOME[f.break_outcome] : ''}` : 'no break'));
					tr.append(mid);
					continue;
				}

				const won = f.status === 'complete' && f.winner_side === side;
				const c = cell('td', undefined, 'edit side-cell' + (won ? ' won' : ''),
					{ act: 'editside', no: f.no, side });
				c.append(div('side-val', f.status === 'abandoned' ? '–' : (won ? '1' : '0')));
				const short = won ? RESULT_SHORT[f.result_event] : '';
				if (short) c.append(div('side-sub', short));
				tr.append(c);
			}
			t.append(tr);
		}

		const foot = document.createElement('tr');
		foot.append(
			cell('td', framesWon('home'), 'col-total'),
			cell('td', 'Totals', 'col-mid col-total'),
			cell('td', framesWon('away'), 'col-total')
		);
		t.append(foot);
	}

	// Landscape: frames across, what was recorded down.
	function renderWideTable() {
		const t = els.wideTable;
		t.replaceChildren();
		if (!MATCH.frames.length) return;
		const frames = MATCH.frames;

		const head = document.createElement('tr');
		head.append(cell('th', `Lag: ${SIDE_TAG[MATCH.first_break_side]}`, 'row-head'));
		for (const f of frames) head.append(cell('th', f.no));
		head.append(cell('th', 'Total', 'col-total'));
		t.append(head);

		const breakRow = document.createElement('tr');
		breakRow.append(cell('th', 'Break', 'row-head'));
		for (const f of frames) {
			breakRow.append(cell('td', f.break_side ? SIDE_TAG[f.break_side] : '—',
				'edit' + (f.break_side_manual ? ' manual' : ''),
				{ act: 'editcell', field: 'break_side', no: f.no }));
		}
		const bh = frames.filter((f) => f.break_side === 'home').length;
		const ba = frames.filter((f) => f.break_side === 'away').length;
		breakRow.append(cell('td', `A ${bh} · B ${ba}`, 'col-total'));
		t.append(breakRow);

		const evRow = document.createElement('tr');
		evRow.append(cell('th', 'Break event', 'row-head'));
		for (const f of frames) {
			evRow.append(cell('td', f.break_outcome ? BREAK_OUTCOME[f.break_outcome] : '—', 'edit',
				{ act: 'editcell', field: 'break_outcome', no: f.no }));
		}
		const counts = {};
		for (const f of frames) if (f.break_outcome) counts[f.break_outcome] = (counts[f.break_outcome] || 0) + 1;
		evRow.append(cell('td',
			Object.entries(counts).map(([k, n]) => `${BREAK_OUTCOME[k]} ${n}`).join(' · ') || '—', 'col-total'));
		t.append(evRow);

		const winRow = document.createElement('tr');
		winRow.append(cell('th', 'Frame winner', 'row-head'));
		for (const f of frames) {
			let text = '—';
			if (f.status === 'abandoned') text = 'ab.';
			else if (f.winner_side) {
				const short = RESULT_SHORT[f.result_event] || '';
				text = SIDE_TAG[f.winner_side] + (short ? ` (${short})` : '');
			}
			winRow.append(cell('td', text, 'edit won-' + (f.winner_side || 'none'),
				{ act: 'editcell', field: 'result', no: f.no }));
		}
		winRow.append(cell('td', `${framesWon('home')} — ${framesWon('away')}`, 'col-total'));
		t.append(winRow);
	}

	function renderHistory() {
		els.undoBtn.hidden = MATCH.frames.length === 0 || !canEdit;
		renderTallTable();
		renderWideTable();
		els.historyLegend.textContent = MATCH.frames.length
			? `A = ${MATCH.home.name} · B = ${MATCH.away.name}. Tap any cell to correct it; the score follows.`
			: 'No frames played yet.';
	}

	const frameByNo = (no) => MATCH.frames.find((x) => x.no === Number(no));

	// Portrait: tapping a side's cell says that side won, and offers only the
	// results that fit who broke.
	function editSide(no, side) {
		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'no frame numbered ' + no, null, els.stageStatus); return; }
		overlayMode = 'edit';
		els.overlayQ.textContent = `Frame ${f.no} — ${MATCH[side].name}`;
		els.overlayHint.textContent = 'Only the results that fit who broke are offered.';
		els.overlayRow.replaceChildren(
			...resultsFor(side, f.break_side).map((ev) =>
				mbtn(RESULT_EVENT[ev], f.winner_side === side && f.result_event === ev && f.status === 'complete' ? 'on' : '',
					{ act: 'setcell', field: 'result', no, value: side + ':' + ev })),
			mbtn('Abandoned', f.status === 'abandoned' ? 'on' : '', { act: 'setcell', field: 'result', no, value: 'abandoned' }),
			mbtn('Close', '', { act: 'closeoverlay' })
		);
		els.overlay.hidden = false;
	}

	// Portrait: the middle cell covers both break fields.
	function editBreak(no) {
		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'no frame numbered ' + no, null, els.stageStatus); return; }
		overlayMode = 'edit';
		els.overlayQ.textContent = `Frame ${f.no} — the break`;
		els.overlayHint.textContent = 'Who broke, and what happened.';
		els.overlayRow.replaceChildren(
			mbtn('Who broke', '', { act: 'editcell', field: 'break_side', no }),
			mbtn('Break event', '', { act: 'editcell', field: 'break_outcome', no }),
			mbtn('Close', '', { act: 'closeoverlay' })
		);
		els.overlay.hidden = false;
	}

	function editCell(field, no) {
		const f = frameByNo(no);
		if (!f) { TDC.error(AREA, 'no frame numbered ' + no, null, els.stageStatus); return; }
		overlayMode = 'edit';

		if (field === 'break_side') {
			els.overlayQ.textContent = `Frame ${f.no} — who broke?`;
			els.overlayHint.textContent = f.break_side_manual
				? 'Set by hand, so the break rule leaves it alone.'
				: `Currently derived from "${BREAK_DETERMINATION[MATCH.rules.break_determination]}". Changing it here fixes it in place.`;
			els.overlayRow.replaceChildren(
				mbtn(MATCH.home.name, f.break_side === 'home' ? 'on' : '', { act: 'setcell', field, no, value: 'home' }),
				mbtn(MATCH.away.name, f.break_side === 'away' ? 'on' : '', { act: 'setcell', field, no, value: 'away' }),
				mbtn('Back to the rule', '', { act: 'setcell', field, no, value: 'auto' }, !f.break_side_manual),
				mbtn('Close', '', { act: 'closeoverlay' })
			);
		} else if (field === 'break_outcome') {
			els.overlayQ.textContent = `Frame ${f.no} — on the break`;
			els.overlayHint.textContent = 'Scratch is the cue ball pocketed. Foul is anything else.';
			els.overlayRow.replaceChildren(
				...Object.entries(BREAK_OUTCOME).map(([v, label]) =>
					mbtn(label, f.break_outcome === v ? 'on' : '', { act: 'setcell', field, no, value: v })),
				mbtn('None', f.break_outcome === null ? 'on' : '', { act: 'setcell', field, no, value: 'none' }),
				mbtn('Close', '', { act: 'closeoverlay' })
			);
		} else if (field === 'result') {
			els.overlayQ.textContent = `Frame ${f.no} — who won, and how`;
			els.overlayHint.textContent = 'Only the results that fit who broke are offered.';
			const buttons = [];
			for (const side of ['home', 'away']) {
				for (const ev of resultsFor(side, f.break_side)) {
					const on = f.winner_side === side && f.result_event === ev && f.status === 'complete';
					buttons.push(mbtn(`${SIDE_TAG[side]} — ${RESULT_EVENT[ev]}`, on ? 'on' : '',
						{ act: 'setcell', field: 'result', no, value: side + ':' + ev }));
				}
			}
			buttons.push(mbtn('Abandoned', f.status === 'abandoned' ? 'on' : '', { act: 'setcell', field: 'result', no, value: 'abandoned' }));
			buttons.push(mbtn('Close', '', { act: 'closeoverlay' }));
			els.overlayRow.replaceChildren(...buttons);
		} else {
			TDC.error(AREA, 'unknown history field: ' + field);
			return;
		}
		els.overlay.hidden = false;
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
		overlayMode = 'confirm';
		els.overlayQ.textContent = `Frame ${no} can no longer be a ${name}`;
		els.overlayHint.textContent =
			`A ${name} ${lost.because}. The frame still counts to the same player either way.`;
		els.overlayRow.replaceChildren(
			mbtn(`Record it as a ${RESULT_EVENT.win.toLowerCase()}`, 'result',
				{ act: 'setcell', field, no, value, confirmed: '1' }),
			mbtn('Leave it as it is', '', { act: 'closeoverlay' })
		);
		els.overlay.hidden = false;
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
		closeOverlay();
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
	// Overlays
	// ─────────────────────────────────────────────────────────────────

	function showBreakOverlay() {
		overlayMode = 'break';
		els.overlayQ.textContent = MATCH.rules.break_determination === 'by_schedule'
			? 'Who breaks this frame?'
			: 'Who won the lag?';
		els.overlayHint.textContent = BREAK_DETERMINATION[MATCH.rules.break_determination] || '';
		els.overlayRow.replaceChildren(
			mbtn(MATCH.home.name, '', { act: 'breakside', value: 'home' }),
			mbtn(MATCH.away.name, '', { act: 'breakside', value: 'away' })
		);
		els.overlay.hidden = false;
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

	function showMore(side) {
		overlayMode = 'more:' + side;
		els.overlayQ.textContent = 'More';
		els.overlayHint.textContent = `Actions for ${MATCH[side].name}.`;
		els.overlayRow.replaceChildren(
			mbtn('Walkover to ' + MATCH[side].name, 'result', { act: 'walkover', side }),
			mbtn('Abandon frame', '', { act: 'abandon' }),
			mbtn('Change table', '', { act: 'changetable' }, MATCH.tables.length < 2),
			mbtn('Close', '', { act: 'closeoverlay' })
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

	function closeOverlay() {
		overlayMode = null;
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
		// rather than hidden: knowing it is a race to 7 is the point.
		if (!canEdit) input.disabled = true;

		row.append(label, input);
		if (def.hint) row.append(div('set-hint', def.hint));
		return row;
	}

	function renderPanel() {
		const c = MATCH.context;
		els.contextLine.textContent = c.kind === 'social'
			? 'Social match · not part of a league or tournament'
			: [c.name, c.season, c.round].filter(Boolean).join(' · ');

		els.badgeRow.replaceChildren(
			badge(DISCIPLINE[MATCH.rules.discipline] || 'TDC (Error)'),
			badge(MATCH.sanctioned ? 'Sanctioned' : 'Casual', MATCH.sanctioned ? 'verified' : ''),
			badge(matchWinner() ? 'Complete' : 'In progress'),
			badge(`${framesWon('home')} — ${framesWon('away')}`)
		);

		els.setGroups.replaceChildren();
		for (const group of GROUPS) {
			const defs = SETTINGS.filter((d) => d.group === group && (!d.when || d.when(MATCH.rules)));
			if (!defs.length) continue;
			const card = div('set-card');
			card.append(heading('h3', group));
			for (const def of defs) card.append(renderSetting(def));
			els.setGroups.append(card);
		}
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

		// "referee" is still only on this page — there is no column for it yet,
		// so sending it would be a lie. Everything else is stored.
		if (liveMatchId && def.key !== 'referee') persistSettings();
	}

	const openPanel  = () => { els.panel.hidden = false; els.scrim.hidden = false; };
	const closePanel = () => { els.panel.hidden = true;  els.scrim.hidden = true; };

	function addNavButton() {
		const nav = document.querySelector('.site-nav');
		const profile = nav && nav.querySelector('.nav-profile-wrap');
		if (!nav || !profile) {
			TDC.error(AREA, 'could not add the match settings button: nav not found.');
			return;
		}
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'nav-match-btn';
		b.id = 'nav-match-settings';
		b.textContent = 'Match';
		b.setAttribute('aria-label', 'Match settings');
		b.addEventListener('click', openPanel);
		nav.insertBefore(b, profile);
	}

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
		if (liveMatchId) persistFrame(no, done);
		else TDC.status(els.stageStatus, done, 'success');
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

		switch (act) {
			// ── Stage ────────────────────────────────────────────────
			case 'breakside':
				draft.break_side = b.dataset.value;
				closeOverlay();
				return;
			case 'outcome': {
				const clearing = draft.break_outcome === b.dataset.value;
				draft.break_outcome = clearing ? null : b.dataset.value;
				// Entering a break event is what starts the frame and ends racking.
				// Clearing it does not un-start a frame that has begun.
				if (!clearing) beginFrame();
				TDC.status(els.stageStatus, '', '');
				renderStage();
				renderTimePanel();
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

			// ── Frame history ────────────────────────────────────────
			case 'editside':
				editSide(Number(b.dataset.no), side);
				return;
			case 'editbreak':
				editBreak(Number(b.dataset.no));
				return;
			case 'editcell':
				// Number(), because a data attribute is a string and this ends up
				// as the integer frame number the database is asked for.
				editCell(b.dataset.field, Number(b.dataset.no));
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
	// /match/ on its own keeps the mockup above, which is still the quickest
	// way to work on the layout. /match/?id=<uuid> replaces MATCH and PLAYERS
	// with the real thing. The shape built here is exactly the mockup's shape,
	// so nothing else in this file knows where its data came from.
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

	async function loadMatch(id) {
		const { data: m, error } = await supabaseClient
			.from('tbl_matches')
			.select('id, venue_id, scheduled_at, first_break_side, sanctioned, rules, status, card_version,'
				+ ' home_side_kind, home_player_id, away_side_kind, away_player_id')
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
			m.home_player_id, m.away_player_id,
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
				// There is no league or tournament layer yet, so every match in the
				// database is a social one. This becomes a real lookup later.
				context: { kind: 'social', name: null, season: null, round: null },
				sanctioned: m.sanctioned,
				venue,
				// The tables table does not exist yet. Named plainly rather than
				// invented, so nobody reads it as a real table number.
				tables: ['Table not set'],
				scheduled_at: m.scheduled_at,
				referee: null,
				first_break_side: m.first_break_side,
				home: { name: nameOf(m.home_player_id), crest_url: null, players: [m.home_player_id] },
				away: { name: nameOf(m.away_player_id), crest_url: null, players: [m.away_player_id] },
				rules: m.rules,
				frames
			}
		};
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

	let liveMatchId = null;          // null in mockup mode
	let saving = 0;                  // writes in flight
	let cardVersion = null;          // what the server said when we last read it

	// Whether this person may score this match. The database decides — the page
	// asks tdc_may_edit_match rather than working the rule out again here, so
	// there is one copy of it. The mockup is always editable; it is a drawing.
	let canEdit = true;
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
			showNotice(`<strong>${n} change${n === 1 ? '' : 's'} still to send.</strong> Sending now…`, 'warn');
		} else {
			showNotice('<strong>Live match.</strong> Frames and settings are saved as you change them.', 'warn');
		}
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
		TDC.status(els.stageStatus, 'Everything saved on this phone has been sent.', 'success');
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

	function savingStarted(message) {
		saving += 1;
		TDC.status(els.stageStatus, message, '');
	}

	async function savingFinished(error, okMessage) {
		saving -= 1;
		await reloadFromServer();
		if (error) {
			TDC.showSupabaseError(AREA, error, els.stageStatus);
		} else if (okMessage) {
			TDC.status(els.stageStatus, okMessage, 'success');
		}
	}

	async function reloadFromServer() {
		const loaded = await loadMatch(liveMatchId);
		if (!loaded) return;
		PLAYERS = loaded.players;
		MATCH = loaded.match;
		recomputeBreaks();
		draft = newDraft();
		renderAll();
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

		savingStarted(`Saving frame ${no}…`);
		const { error } = await supabaseClient.rpc('tdc_record_frame', {
			p_match_id: liveMatchId,
			p_frame_no: no,
			p_frame: framePayload(f)
		});
		await savingFinished(error, okMessage);
	}

	// Settings and the lag winner go together, because both move the whole
	// match: the server re-derives every break side and puts back any frame the
	// new rules have made impossible, then says how many of each it touched.
	async function persistSettings() {
		if (!liveMatchId) return;

		savingStarted('Saving settings…');
		const { data, error } = await supabaseClient.rpc('tdc_update_match_settings', {
			p_match_id: liveMatchId,
			p_rules: MATCH.rules,
			p_first_break_side: MATCH.first_break_side
		});

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

		savingStarted(`Removing frame ${no}…`);
		const { error } = await supabaseClient.rpc('tdc_remove_frame', {
			p_match_id: liveMatchId,
			p_frame_no: no
		});
		await savingFinished(error, `Frame ${no} removed.`);
	}

	// ─────────────────────────────────────────────────────────────────

	function start() {
		document.addEventListener('click', onClick);
		els.panel.addEventListener('change', onSettingChange);
		els.undoBtn.addEventListener('click', undo);
		els.panelClose.addEventListener('click', closePanel);
		els.scrim.addEventListener('click', closePanel);
		document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

		addNavButton();
		recomputeBreaks();
		draft = newDraft();
		renderAll();
		setInterval(tick, 250);
	}

	(async () => {
		const id = new URLSearchParams(location.search).get('id');

		if (!id) {
			showNotice('<strong>Mockup match.</strong> Nothing here is real and nothing is saved. '
				+ 'Open a real match with <code>/match/?id=&lt;match id&gt;</code>.');
			start();
			return;
		}

		if (!UUID_RE.test(id)) {
			TDC.error(AREA, 'the id in the address is not a match id: ' + id, null, els.stageStatus);
			showNotice('<strong>That is not a match id.</strong> The address needs the match\'s id, '
				+ 'which looks like <code>215b10ec-de44-4c61-a513-ab9768c43e72</code>. '
				+ 'Showing the mockup instead.', 'error');
			start();
			return;
		}

		// Frames are readable by signed-in users only, so without a session the
		// query would come back empty and read as "no such match".
		const session = await TDC.getSession(AREA);
		if (!session) {
			showNotice('<strong>Please sign in.</strong> Match data is only readable once you have '
				+ 'signed in. <a href="/accounts/?next=' + encodeURIComponent(location.pathname + location.search)
				+ '">Sign in</a>, and this match will open.', 'error');
			start();
			return;
		}

		const loaded = await loadMatch(id);
		if (!loaded) { start(); return; }

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

		window.addEventListener('tdc:offline', renderOfflineNotice);
		window.addEventListener('tdc:online', () => {
			// Repaint first: with nothing queued, flushQueue() returns at once
			// and the offline notice would otherwise stay on screen.
			renderOfflineNotice();
			flushQueue();
		});

		renderOfflineNotice();
		start();

		// Anything left over from a previous visit goes now.
		if (!isOffline() && queuedCount()) flushQueue();
	})();
})();
