// What a match can be set to.
//
// The labels, the setting definitions and the defaults live here rather than in
// match.js, because two pages need them: the match page's settings panel and
// the create-a-match page. Adding a setting should be one edit, not two that
// drift apart the first time somebody forgets the second one.
//
// Loaded before match.js and before match-new.js.

const TDCMatchDef = (() => {
	// ─────────────────────────────────────────────────────────────────
	// Labels
	// ─────────────────────────────────────────────────────────────────

	const DISCIPLINE = { '8ball': '8-Ball', '9ball': '9-Ball', '10ball': '10-Ball', blackball: 'Blackball' };
	const BREAK_OUTCOME = { dry: 'Dry', in: 'In', scratch: 'Scratch', foul: 'Foul' };
	const RESULT_EVENT = {
		win: 'Win',
		break_and_finish: 'Break & finish',
		reverse_break_and_finish: 'Reverse B&F',
		golden_break: 'Golden break',
		default: 'Won by default'
	};
	// Short forms for the history tables, where a cell is a few characters wide.
	const RESULT_SHORT = {
		win: '',
		break_and_finish: 'B&F',
		reverse_break_and_finish: 'rB&F',
		golden_break: 'GB',
		default: 'w/o'
	};
	// Each one says what actually happens at the table. "Winner breaks" and
	// "Loser breaks" read as a result rather than a rule, and "Lag winner
	// breaks all" was three nouns in a row.
	const BREAK_DETERMINATION = {
		alternate: 'Take turns, frame by frame',
		winner_breaks: 'Whoever won the last frame',
		loser_breaks: 'Whoever lost the last frame',
		first_breaks: 'Whoever broke first breaks them all',
		by_schedule: 'Set by the scoresheet, frame by frame',
		lag_each_frame: 'Lag before every frame'
	};
	const WIN_CONDITION = {
		race_to: 'Race to', best_of: 'Best of', fixed_frames: 'Fixed frames', timed: 'Timed',
		// No target and no end: a running score for two people on a table.
		free_play: 'Free play'
	};
	const TIME_EXPIRY = { stop_immediately: 'Stop play at once', finish_current_frame: 'Finish the current frame' };
	const TIEBREAK = {
		sudden_death_frame: 'Sudden-death frame',
		decider_on_lag: 'Decider, lag for break',
		coordinator_decision: 'Coordinator decides'
	};
	const SCORE_ENTRY = {
		td_only: 'Tournament Director only',
		referee: 'Referee and above',
		scorer: 'Scorer and above',
		players: 'Players may enter their own'
	};
	const APPROVAL = {
		none: 'No approval needed',
		dispute_window: 'Open to dispute, then locked',
		coordinator_approval: 'Coordinator must approve',
		both: 'Dispute window, then coordinator approval'
	};
	// Each page says what its two sides are called: the match page uses the
	// players' names, the create page uses whoever has been chosen so far.
	let sideNames = () => ({ home: 'Home', away: 'Away' });
	const SIDES = () => sideNames();

	// The landscape table's columns are a few characters wide, so sides are A
	// and B there, with a legend underneath.
	const SIDE_TAG = { home: 'A', away: 'B' };

	// ─────────────────────────────────────────────────────────────────
	// Setting definitions. The panel is built from these, so adding a
	// setting here is the only edit needed to make it appear and apply.
	//   scope 'match' writes to MATCH, scope 'rules' writes to MATCH.rules.
	//   group  is the card it appears under.
	//   when() hides a setting that its parent switch makes irrelevant.
	//   row    settings next to each other share a name (layout() below).
	//   rule   draws a line above the setting, inside its group.
	//
	// The order and the groups are UV's (24 Oct). Format is the open part
	// at the top of a form (MAIN_KEYS); the rest fold away.
	// ─────────────────────────────────────────────────────────────────

	const GROUPS = ['Format', 'Match settings', 'Timing', 'Officials and approval'];

	// Team play only, and deliberately NOT in GROUPS: every page builds its
	// form by looping GROUPS, so a setting in this group is invisible to the
	// match panel and the create-a-tournament page without either of them
	// having to know it exists. The league pages loop GROUPS.concat(LEAGUE_GROUPS).
	// The cutoff and strict order are version 2 of the ruleset (20261022220000);
	// team size and the rotation table are version 3 (20261023193153).
	const LEAGUE_GROUPS = ['Team play'];

	// A league season's status, set by its director (20261024102616). Not a
	// match rule, but the league pages' one list of them, in the order the
	// settings page offers them. The database's check constraint holds the
	// same keys; a new status goes in both. Each key has a colour in league.css
	// (.league-status-<key>).
	const LEAGUE_STATUS = {
		taking_entries: 'Taking entries',
		running: 'Running',
		on_break: 'On break',
		finished: 'Finished'
	};

	const SETTINGS = [
		{ group: 'Format', scope: 'rules', key: 'discipline', label: 'Discipline', type: 'select', options: () => DISCIPLINE },
		{ group: 'Format', scope: 'rules', key: 'win_condition_type', label: 'Win condition', type: 'select', options: () => WIN_CONDITION, row: 'win' },
		{
			group: 'Format', scope: 'rules', key: 'win_condition_target', label: 'Target frames', type: 'int',
			min: 1, max: 50, when: (r) => r.win_condition_type !== 'free_play', row: 'win'
		},

		{
			group: 'Match settings', scope: 'rules', key: 'track_breaks', label: 'Record who breaks', type: 'bool',
			hint: 'Off: the card is just the score. On: who broke and what happened on the break.'
		},
		{
			group: 'Match settings', scope: 'match', key: 'first_break_side', label: 'Lag winner', type: 'select', options: SIDES,
			hint: 'Breaks the first frame. Changing this re-derives who broke in every frame.',
			when: (r) => r.track_breaks
		},
		{
			group: 'Match settings', scope: 'rules', key: 'break_determination', label: 'Breaks', type: 'select', options: () => BREAK_DETERMINATION,
			hint: 'Decides who breaks each frame after the first.', when: (r) => r.track_breaks
		},
		{ group: 'Match settings', scope: 'rules', key: 'break_finish_enabled', label: 'Break & finish', type: 'bool', when: (r) => r.track_breaks, row: 'bf' },
		{ group: 'Match settings', scope: 'rules', key: 'golden_break_enabled', label: 'Golden break', type: 'bool', when: (r) => r.track_breaks && r.break_finish_enabled, row: 'bf' },
		{ group: 'Match settings', scope: 'rules', key: 'reverse_break_finish_enabled', label: 'Reverse break & finish', type: 'bool', when: (r) => r.track_breaks, row: 'bf' },
		{
			group: 'Match settings', scope: 'rules', key: 'break_finish_requires_breaker', label: 'Break & finish needs the breaker', type: 'bool',
			hint: 'Off: either side can be credited with a break & finish.',
			when: (r) => r.track_breaks && r.break_finish_enabled
		},
		{
			group: 'Match settings', scope: 'rules', key: 'draws_allowed', label: 'Draws allowed', type: 'bool',
			hint: 'Must be off for knockout rounds — a bracket needs someone to advance.'
		},
		{ group: 'Match settings', scope: 'rules', key: 'tiebreak_method', label: 'If level', type: 'select', options: () => TIEBREAK, when: (r) => !r.draws_allowed },

		{ group: 'Timing', scope: 'rules', key: 'max_match_minutes', label: 'Match clock (minutes)', type: 'int', min: 0, max: 600, hint: '0 for no match clock.', row: 'clock' },
		{ group: 'Timing', scope: 'rules', key: 'on_time_expiry', label: 'When time runs out', type: 'select', options: () => TIME_EXPIRY, when: (r) => r.max_match_minutes > 0, row: 'clock' },
		{
			group: 'Timing', scope: 'rules', key: 'shot_clock_enabled', label: 'Shot clock', type: 'bool', rule: true,
			hint: 'Off for most matches. When on, a referee runs it from the timing panel.'
		},
		{ group: 'Timing', scope: 'rules', key: 'shot_clock_seconds', label: 'Seconds per shot', type: 'int', min: 10, max: 120, when: (r) => r.shot_clock_enabled, row: 'shot' },
		{ group: 'Timing', scope: 'rules', key: 'shot_clock_first_shot_seconds', label: 'First shot', type: 'int', min: 10, max: 180, when: (r) => r.shot_clock_enabled, row: 'shot' },
		{ group: 'Timing', scope: 'rules', key: 'extensions_per_player', label: 'Extensions per player', type: 'int', min: 0, max: 10, when: (r) => r.shot_clock_enabled, row: 'shot' },
		{ group: 'Timing', scope: 'rules', key: 'extension_seconds', label: 'Extension length', type: 'int', min: 5, max: 120, when: (r) => r.shot_clock_enabled, row: 'shot' },

		{
			group: 'Team play', scope: 'rules', key: 'lineup_cutoff_hours', label: 'Lineup cutoff (hours)', type: 'int',
			min: 0, max: 336,
			hint: 'Hours before a team match. A side with no lineup in by then concedes. 0 for no cutoff.'
		},
		{
			group: 'Team play', scope: 'rules', key: 'strict_frame_order', label: 'Frames in strict order', type: 'bool',
			hint: 'Nationals forbid changing the order. Off lets a scorer record any frame as it finishes, which is how most league nights actually run.'
		},
		{
			group: 'Team play', scope: 'rules', key: 'team_size', label: 'Team size', type: 'int',
			// Only the league pages show this group, and every league has a
			// team size (UV, 23 Oct). 0 is still valid in a ruleset — it is
			// what singles and tournaments carry — but not for a league.
			min: 2, max: 10,
			hint: 'Players a side in each session. A five-man team plays five sessions of five frames: 25.'
		},
		{
			// Rendered as a grid by control(), not a single input. Session 1 is
			// the captains' own order; each later row names the away player
			// who meets each home position. null is the cyclic shift.
			group: 'Team play', scope: 'rules', key: 'rotation', label: 'Who meets whom', type: 'rotation',
			when: (r) => r.team_size >= 2
		},

		{ group: 'Officials and approval', scope: 'rules', key: 'referee_required', label: 'Referee required', type: 'bool' },
		// tbl_matches.referee_player_id (20261024162559), saved through
		// tdc_set_match_referee, not with the rules. A 'player' control is
		// playerPicker() below; the ruleset pages never see it (scope 'match').
		{
			group: 'Officials and approval', scope: 'match', key: 'referee', label: 'Referee', type: 'player',
			hint: 'Anyone with an account. Scores the match, and the players cannot overrule their frames.'
		},
		{ group: 'Officials and approval', scope: 'rules', key: 'score_entry_mode', label: 'Scores entered by', type: 'select', options: () => SCORE_ENTRY },
		{ group: 'Officials and approval', scope: 'rules', key: 'approval_mode', label: 'Approval', type: 'select', options: () => APPROVAL, rule: true },
		{ group: 'Officials and approval', scope: 'rules', key: 'dispute_window_hours', label: 'Dispute window (hours)', type: 'int', min: 0, max: 336, when: (r) => r.approval_mode === 'dispute_window' || r.approval_mode === 'both' }
	];

	// Every key a ruleset must carry, at its quietest setting. A match made
	// without touching anything is the simple card: two names, two scores, a
	// win button each side. Settings are what make it grow.
	//
	// Kept in step with private.tdc_check_match_rules, which refuses a ruleset
	// that is missing a key or carries one it does not know.
	const DEFAULT_RULES = {
		// Version 3 since 23 Oct. Matches frozen at versions 1 and 2 keep their
		// own ruleset and keys; private.tdc_check_match_rules still validates
		// all three, and nothing rewrites a match that has been played.
		version: 3,
		discipline: '8ball',
		win_condition_type: 'race_to',
		win_condition_target: 5,
		track_breaks: false,
		break_determination: 'alternate',
		break_finish_enabled: false,
		draws_allowed: false,
		tiebreak_method: 'sudden_death_frame',
		on_time_expiry: 'finish_current_frame',
		max_match_minutes: 0,
		golden_break_enabled: false,
		reverse_break_finish_enabled: false,
		break_finish_requires_breaker: true,
		shot_clock_enabled: false,
		shot_clock_seconds: 45,
		shot_clock_first_shot_seconds: 60,
		extensions_per_player: 0,
		extension_seconds: 45,
		referee_required: false,
		score_entry_mode: 'players',
		// A card nobody has to answer is a card nobody checks. The window is the
		// quiet default: the other player has 48 hours, and silence settles it.
		// "Not needed" is there for a social game, and settles on submission.
		approval_mode: 'dispute_window',
		dispute_window_hours: 48,
		// Version 2. Both are inert outside team play, which is why they are
		// safe defaults for a social match and a tournament alike.
		lineup_cutoff_hours: 0,
		strict_frame_order: false,
		// Version 3. No sessions, and the cyclic shift if there ever are.
		team_size: 0,
		rotation: null
	};

	// What a team league night wants, and why each one differs from the
	// default above. Settled in docs/design/leagues.md §2 and §3:
	//
	//   fixed_frames + draws_allowed — a slot neither captain fills vanishes,
	//     which shrinks the card, so a race to a number can become unreachable
	//     and a level night has to be allowed to stay level.
	//   by_schedule — team play lags every frame and the sheet says who
	//     breaks. winner_breaks and loser_breaks cannot be derived here at
	//     all, because frame 4 routinely finishes before frame 3.
	//   track_breaks — on, because break_determination is only shown when it
	//     is, and a league scoresheet records who broke.
	//   coordinator_approval — a team card is signed by both captains and
	//     then published by the league director. The dispute window means
	//     nothing on it: silence does not settle a team card.
	//   team_size 5 — the mainstream five-man night, 25 frames (UV, 23 Oct).
	//     The target is 25 to match, but the two are separate settings: the
	//     team size decides how long the card is, the win condition who won.
	//
	// Starting points on the create-a-league form, not rules: every one of
	// them is still a control the league director can change.
	const LEAGUE_DEFAULT_RULES = Object.assign({}, DEFAULT_RULES, {
		win_condition_type: 'fixed_frames',
		win_condition_target: 25,
		team_size: 5,
		draws_allowed: true,
		track_breaks: true,
		break_determination: 'by_schedule',
		approval_mode: 'coordinator_approval'
	});

	// The few worth asking about before a match starts. Everything else is a
	// refinement, and a long form is how someone is lost on their first match.
	const MAIN_KEYS = ['discipline', 'win_condition_type', 'win_condition_target'];

	// ─────────────────────────────────────────────────────────────────
	// The control for a setting
	//
	// Here rather than in a page, for the same reason the definitions are: a
	// setting's type and its control are one fact. The create page still has
	// its own copy of this (predates it) and should adopt this one; the round
	// rules panel on the bracket uses it.
	//
	//   def       one entry from SETTINGS
	//   rules     the ruleset being edited, for the current value
	//   prefix    so two panels on one page cannot collide on element ids
	//
	// Returns a .field with a label, the input, and the hint where there is
	// one. The input carries data-setting, which is how a page reads it back.
	// ─────────────────────────────────────────────────────────────────
	function control(def, rules, prefix) {
		const id = (prefix || 'set') + '-' + def.key;
		const value = rules[def.key];

		if (def.type === 'rotation') return rotationControl(def, rules, id);

		const row = document.createElement('div');
		row.className = 'field';

		const label = document.createElement('label');
		label.textContent = def.label;
		label.htmlFor = id;

		let input;
		if (def.type === 'select') {
			input = document.createElement('select');
			const options = typeof def.options === 'function' ? def.options() : def.options;
			for (const [v, text] of Object.entries(options)) {
				input.append(new Option(text, v, false, v === value));
			}
		} else if (def.type === 'bool') {
			input = document.createElement('input');
			input.type = 'checkbox';
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

		input.id = id;
		input.dataset.setting = def.key;

		row.append(label, input);
		if (def.hint) {
			const hint = document.createElement('div');
			hint.className = 'hint';
			hint.textContent = def.hint;
			row.append(hint);
		}
		return row;
	}

	// ─────────────────────────────────────────────────────────────────
	// A group's settings, laid out
	//
	// Every page builds its controls its own way, so it hands its maker in:
	// layout(defs, make) returns the nodes to append. Settings in a row
	// sit in one .field-row (data-row, which tdc-controls.js keys it by, so
	// it fades in and out whole), and a setting with rule: true gets a line
	// above it unless it starts the group. { rows: false } keeps every
	// setting on its own line (the match page's panel, which is label and
	// control on one line already) but still draws the lines.
	// ─────────────────────────────────────────────────────────────────
	function layout(defs, make, opts) {
		const rows = !opts || opts.rows !== false;
		const out = [];
		let row = null;
		for (const def of defs) {
			if (def.rule && out.length) {
				const line = document.createElement('div');
				line.className = 'set-rule';
				out.push(line);
				row = null;
			}
			if (!rows || !def.row) { row = null; out.push(make(def)); continue; }
			if (!row || row.dataset.row !== def.row) {
				row = document.createElement('div');
				row.className = 'field-row';
				row.dataset.row = def.row;
				out.push(row);
			}
			row.append(make(def));
		}
		return out;
	}

	// ─────────────────────────────────────────────────────────────────
	// Picking a player (the referee)
	//
	// A search box like New Match's opponent search, or the chosen player
	// with Change and Remove. It is not an input with data-setting, so the
	// pages' change handlers pass it by; the page hears about a pick through
	// onPick(player | null) and decides whether that saves (the match page)
	// or waits for Start Match (New Match).
	//
	//   id        the search box's id, for the page's label
	//   chosen    { id, display_name, full_name } or null
	//   disabled  shows the name (or None) and nothing to press
	//   status    where a failed search is reported
	//
	// Searches tdc_search_referees, which unlike the opponent search finds
	// the person searching: you may referee your own match (UV, 24 Oct).
	// ─────────────────────────────────────────────────────────────────
	function playerPicker({ id, chosen, disabled, status, onPick }) {
		const AREA = 'Referee';
		const wrap = document.createElement('div');
		wrap.className = 'player-pick';

		const el = (tag, cls, text) => {
			const n = document.createElement(tag);
			if (cls) n.className = cls;
			if (text !== undefined) n.textContent = text;
			return n;
		};
		const linkButton = (text, onClick) => {
			const b = el('button', 'pick-link', text);
			b.type = 'button';
			b.addEventListener('click', onClick);
			return b;
		};

		function showChosen() {
			const line = el('div', 'pick-chosen');
			const names = el('div', 'pick-names');
			names.append(el('div', 'pick-display', chosen.display_name));
			if (chosen.full_name && chosen.full_name !== chosen.display_name) {
				names.append(el('div', 'pick-full', chosen.full_name));
			}
			line.append(names);
			if (!disabled) {
				line.append(
					linkButton('Change', () => showSearch(true)),
					linkButton('Remove', () => onPick(null))
				);
			}
			wrap.replaceChildren(line);
		}

		function showSearch(changing) {
			const input = el('input');
			input.type = 'search';
			input.id = id;
			input.autocomplete = 'off';
			input.placeholder = 'Search players';
			const results = el('div', 'pick-results');

			let run = 0;
			let timer = null;
			input.addEventListener('input', () => {
				clearTimeout(timer);
				const term = input.value;
				timer = setTimeout(() => search(term), 250);
			});

			async function search(term) {
				const mine = ++run;
				if (term.trim().length < 2) { results.replaceChildren(); return; }
				const { data, error } = await supabaseClient.rpc('tdc_search_referees', { p_query: term, p_limit: 20 });
				if (mine !== run) return;   // a later keystroke has overtaken this one
				if (error) { TDC.showSupabaseError(AREA, error, status); return; }
				if (!data.length) {
					results.replaceChildren(el('p', 'muted', 'Nobody by that name. A referee needs an account.'));
					return;
				}
				results.replaceChildren(...data.map((p) => {
					const b = el('button', 'pick-result');
					b.type = 'button';
					b.append(el('span', 'result-name', p.display_name));
					if (p.full_name) b.append(el('span', 'result-sub', p.full_name));
					b.addEventListener('click', () => onPick(p));
					return b;
				}));
			}

			wrap.replaceChildren(input, results);
			if (changing) {
				wrap.append(linkButton('Keep ' + chosen.display_name, showChosen));
				input.focus();
			}
		}

		if (chosen) showChosen();
		else if (disabled) wrap.append(el('div', 'pick-none', 'None'));
		else showSearch(false);
		return wrap;
	}

	// ─────────────────────────────────────────────────────────────────
	// The rotation table (version 3)
	//
	// One row per session; row s names the away position that meets home
	// positions 1, 2, 3 … in that session. Session 1 is always the captains'
	// own order. rules.rotation is null for the cyclic shift — the away column
	// moving up one each session — and an array once the LD makes it their
	// own. private.tdc_check_match_rules and private.tdc_rotation_away are the
	// database's half of this; keep the three in step.
	// ─────────────────────────────────────────────────────────────────

	function cyclicRotation(n) {
		const grid = [];
		for (let s = 0; s < n; s++) {
			const row = [];
			for (let h = 0; h < n; h++) row.push(((h + s) % n) + 1);
			grid.push(row);
		}
		return grid;
	}

	// The table as it stands, written out, whichever form it is stored in.
	function rotationGrid(rules) {
		const n = rules.team_size || 0;
		if (Array.isArray(rules.rotation) && rules.rotation.length === n) {
			return rules.rotation.map((row) => row.slice());
		}
		return cyclicRotation(n);
	}

	// Pairings met more than once across the night. Allowed (UV, 23 Oct), but
	// the LD is told before saving: [{ home, away, sessions: [1, 3] }].
	function rotationRepeats(grid) {
		const seen = new Map();
		grid.forEach((row, s) => row.forEach((away, h) => {
			const key = (h + 1) + '-' + away;
			if (!seen.has(key)) seen.set(key, { home: h + 1, away, sessions: [] });
			seen.get(key).sessions.push(s + 1);
		}));
		return [...seen.values()].filter((p) => p.sessions.length > 1);
	}

	// A change on the grid. Choosing an away player already in that session
	// swaps the two, so a session can never hold somebody twice — design rule
	// 1, which the database also refuses.
	function applyRotation(rules, input) {
		if (input.dataset.rotation === 'mode') {
			rules.rotation = input.value === 'own' ? rotationGrid(rules) : null;
			return;
		}
		const s = parseInt(input.dataset.session, 10) - 1;
		const h = parseInt(input.dataset.home, 10) - 1;
		const v = parseInt(input.value, 10);
		const grid = rotationGrid(rules);
		const row = grid[s];
		if (!row || isNaN(v)) return;
		const other = row.indexOf(v);
		if (other !== -1) row[other] = row[h];
		row[h] = v;
		rules.rotation = grid;
	}

	// After any change: a table that no longer fits the team size goes back to
	// the cyclic shift rather than being sent to be refused.
	function tidyRules(rules) {
		if (!(rules.team_size >= 2)
			|| (Array.isArray(rules.rotation) && rules.rotation.length !== rules.team_size)) {
			rules.rotation = null;
		}
	}

	function rotationControl(def, rules, id) {
		const n = rules.team_size;
		const grid = rotationGrid(rules);
		const own = Array.isArray(rules.rotation);

		const row = document.createElement('div');
		row.className = 'field';

		const label = document.createElement('label');
		label.textContent = def.label;
		label.htmlFor = id;

		const mode = document.createElement('select');
		mode.id = id;
		mode.dataset.setting = def.key;
		mode.dataset.rotation = 'mode';
		mode.append(
			new Option('The standard rotation', 'cyclic', false, !own),
			new Option('My own table', 'own', false, own)
		);

		const table = document.createElement('table');
		table.className = 'tdc-table rotation-grid';
		const head = table.createTHead().insertRow();
		head.append(Object.assign(document.createElement('th'), { textContent: 'Session' }));
		for (let h = 1; h <= n; h++) {
			head.append(Object.assign(document.createElement('th'), { textContent: 'H' + h }));
		}

		const body = table.createTBody();
		grid.forEach((away, s) => {
			const tr = body.insertRow();
			tr.append(Object.assign(document.createElement('th'), { textContent: String(s + 1) }));
			away.forEach((a, h) => {
				const td = tr.insertCell();
				// Session 1 is whatever order the captains set. It is not the
				// LD's to change, so it is shown, not offered.
				if (s === 0) { td.textContent = 'A' + a; return; }
				const pick = document.createElement('select');
				pick.id = id + '-' + (s + 1) + '-' + (h + 1);
				pick.dataset.setting = def.key;
				pick.dataset.session = s + 1;
				pick.dataset.home = h + 1;
				pick.setAttribute('aria-label', `Session ${s + 1}, H${h + 1} plays`);
				for (let v = 1; v <= n; v++) pick.append(new Option('A' + v, v, false, v === a));
				td.append(pick);
			});
		});

		const scroll = document.createElement('div');
		scroll.className = 'table-scroll';
		scroll.append(table);

		const hint = document.createElement('div');
		hint.className = 'hint';
		hint.textContent = own
			? 'H1 is the home captain\'s first player, A1 the away captain\'s. Choosing a player already in that session swaps the two.'
			: 'H1 is the home captain\'s first player, A1 the away captain\'s. Each session the away side moves up one, so everybody meets everybody once. Change any session to make the table your own.';

		row.append(label, mode, scroll, hint);

		const repeats = rotationRepeats(grid);
		if (repeats.length) {
			const warn = document.createElement('div');
			warn.className = 'hint warn';
			warn.textContent = 'This table has players meeting twice: ' + repeats.map((p) =>
				`H${p.home} v A${p.away} in sessions ${p.sessions.join(' and ')}`).join('; ') +
				'. That is allowed, but usually everybody meets everybody once.';
			row.append(warn);
		}
		return row;
	}

	// Which settings belong on a ruleset form right now: the rules ones, that
	// have somewhere to be stored, whose parent switch is on.
	function liveRuleKeys(rules) {
		return SETTINGS.filter((d) =>
			d.scope === 'rules' && d.stored !== false && (!d.when || d.when(rules)));
	}

	// Reads a typed value back off a control into the shape the ruleset wants.
	// Returns undefined for a number that is not one, so a caller can refuse
	// rather than store NaN.
	function readValue(def, raw) {
		if (def.type === 'bool') return !!raw;
		if (def.type === 'int') {
			const n = parseInt(raw, 10);
			if (isNaN(n)) return undefined;
			if (def.min !== undefined && n < def.min) return undefined;
			if (def.max !== undefined && n > def.max) return undefined;
			return n;
		}
		return raw;
	}

	return {
		DISCIPLINE, BREAK_OUTCOME, RESULT_EVENT, RESULT_SHORT, BREAK_DETERMINATION,
		WIN_CONDITION, TIME_EXPIRY, TIEBREAK, SCORE_ENTRY, APPROVAL, SIDE_TAG, SIDES,
		GROUPS, LEAGUE_GROUPS, LEAGUE_STATUS, SETTINGS, DEFAULT_RULES, LEAGUE_DEFAULT_RULES, MAIN_KEYS,
		control, layout, liveRuleKeys, readValue, playerPicker,
		cyclicRotation, rotationGrid, rotationRepeats, applyRotation, tidyRules,
		setSideNames(fn) { sideNames = fn; }
	};
})();
