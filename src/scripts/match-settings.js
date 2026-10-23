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
	// ─────────────────────────────────────────────────────────────────

	const GROUPS = ['This match', 'Format', 'Results', 'Timing', 'Officials and approval'];

	// Team play only, and deliberately NOT in GROUPS: every page builds its
	// form by looping GROUPS, so a setting in this group is invisible to the
	// match panel and the create-a-tournament page without either of them
	// having to know it exists. The league pages loop GROUPS.concat(LEAGUE_GROUPS).
	// Both settings are version 2 of the ruleset (20261022220000).
	const LEAGUE_GROUPS = ['Team play'];

	const SETTINGS = [
		// No column for this yet, so it lives only on the screen it is typed on.
		// The create page leaves it out rather than offering a control that
		// forgets what you told it.
		{ group: 'This match', scope: 'match', key: 'referee', label: 'Referee', type: 'text', placeholder: 'None', stored: false },
		{
			group: 'This match', scope: 'match', key: 'first_break_side', label: 'Lag winner', type: 'select', options: SIDES,
			hint: 'Breaks the first frame. Changing this re-derives who broke in every frame.',
			when: (r) => r.track_breaks
		},

		{ group: 'Format', scope: 'rules', key: 'discipline', label: 'Discipline', type: 'select', options: () => DISCIPLINE },
		{ group: 'Format', scope: 'rules', key: 'win_condition_type', label: 'Win condition', type: 'select', options: () => WIN_CONDITION },
		{
			group: 'Format', scope: 'rules', key: 'win_condition_target', label: 'Target frames', type: 'int',
			min: 1, max: 50, when: (r) => r.win_condition_type !== 'free_play'
		},
		{
			group: 'Format', scope: 'rules', key: 'track_breaks', label: 'Record who breaks', type: 'bool',
			hint: 'Off: the card is just the score. On: who broke and what happened on the break.'
		},
		{
			group: 'Format', scope: 'rules', key: 'break_determination', label: 'Breaks', type: 'select', options: () => BREAK_DETERMINATION,
			hint: 'Decides who breaks each frame after the first.', when: (r) => r.track_breaks
		},

		{
			group: 'Results', scope: 'rules', key: 'draws_allowed', label: 'Draws allowed', type: 'bool',
			hint: 'Must be off for knockout rounds — a bracket needs someone to advance.'
		},
		{ group: 'Results', scope: 'rules', key: 'tiebreak_method', label: 'If level', type: 'select', options: () => TIEBREAK, when: (r) => !r.draws_allowed },
		{ group: 'Results', scope: 'rules', key: 'break_finish_enabled', label: 'Break & finish', type: 'bool', when: (r) => r.track_breaks },
		{ group: 'Results', scope: 'rules', key: 'golden_break_enabled', label: 'Golden break', type: 'bool', when: (r) => r.track_breaks && r.break_finish_enabled },
		{ group: 'Results', scope: 'rules', key: 'reverse_break_finish_enabled', label: 'Reverse break & finish', type: 'bool', when: (r) => r.track_breaks },
		{
			group: 'Results', scope: 'rules', key: 'break_finish_requires_breaker', label: 'Break & finish needs the breaker', type: 'bool',
			hint: 'Off: either side can be credited with a break & finish.',
			when: (r) => r.track_breaks && r.break_finish_enabled
		},

		{ group: 'Timing', scope: 'rules', key: 'max_match_minutes', label: 'Match clock (minutes)', type: 'int', min: 0, max: 600, hint: '0 for no match clock.' },
		{ group: 'Timing', scope: 'rules', key: 'on_time_expiry', label: 'When time runs out', type: 'select', options: () => TIME_EXPIRY, when: (r) => r.max_match_minutes > 0 },
		{
			group: 'Timing', scope: 'rules', key: 'shot_clock_enabled', label: 'Shot clock', type: 'bool',
			hint: 'Off for most matches. When on, a referee runs it from the timing panel.'
		},
		{ group: 'Timing', scope: 'rules', key: 'shot_clock_seconds', label: 'Seconds per shot', type: 'int', min: 10, max: 120, when: (r) => r.shot_clock_enabled },
		{ group: 'Timing', scope: 'rules', key: 'shot_clock_first_shot_seconds', label: 'First shot', type: 'int', min: 10, max: 180, when: (r) => r.shot_clock_enabled },
		{ group: 'Timing', scope: 'rules', key: 'extensions_per_player', label: 'Extensions per player', type: 'int', min: 0, max: 10, when: (r) => r.shot_clock_enabled },
		{ group: 'Timing', scope: 'rules', key: 'extension_seconds', label: 'Extension length', type: 'int', min: 5, max: 120, when: (r) => r.shot_clock_enabled },

		{
			group: 'Team play', scope: 'rules', key: 'lineup_cutoff_hours', label: 'Lineup cutoff (hours)', type: 'int',
			min: 0, max: 336,
			hint: 'Hours before a team match. A side with no lineup in by then concedes. 0 for no cutoff.'
		},
		{
			group: 'Team play', scope: 'rules', key: 'strict_frame_order', label: 'Frames in strict order', type: 'bool',
			hint: 'Nationals forbid changing the order. Off lets a scorer record any frame as it finishes, which is how most league nights actually run.'
		},

		{ group: 'Officials and approval', scope: 'rules', key: 'referee_required', label: 'Referee required', type: 'bool' },
		{ group: 'Officials and approval', scope: 'rules', key: 'score_entry_mode', label: 'Scores entered by', type: 'select', options: () => SCORE_ENTRY },
		{ group: 'Officials and approval', scope: 'rules', key: 'approval_mode', label: 'Approval', type: 'select', options: () => APPROVAL },
		{ group: 'Officials and approval', scope: 'rules', key: 'dispute_window_hours', label: 'Dispute window (hours)', type: 'int', min: 0, max: 336, when: (r) => r.approval_mode === 'dispute_window' || r.approval_mode === 'both' }
	];

	// Every key a ruleset must carry, at its quietest setting. A match made
	// without touching anything is the simple card: two names, two scores, a
	// win button each side. Settings are what make it grow.
	//
	// Kept in step with private.tdc_check_match_rules, which refuses a ruleset
	// that is missing a key or carries one it does not know.
	const DEFAULT_RULES = {
		// Version 2 since 22 Oct. Matches frozen at version 1 keep their own
		// ruleset and their own 23 keys; private.tdc_check_match_rules still
		// validates both, and nothing rewrites a match that has been played.
		version: 2,
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
		strict_frame_order: false
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
	//
	// Starting points on the create-a-league form, not rules: every one of
	// them is still a control the league director can change.
	const LEAGUE_DEFAULT_RULES = Object.assign({}, DEFAULT_RULES, {
		win_condition_type: 'fixed_frames',
		win_condition_target: 5,
		draws_allowed: true,
		track_breaks: true,
		break_determination: 'by_schedule',
		approval_mode: 'coordinator_approval'
	});

	// The few worth asking about before a match starts. Everything else is a
	// refinement, and a long form is how someone is lost on their first match.
	const MAIN_KEYS = ['win_condition_type', 'win_condition_target', 'track_breaks',
		'break_determination', 'first_break_side'];

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
		GROUPS, LEAGUE_GROUPS, SETTINGS, DEFAULT_RULES, LEAGUE_DEFAULT_RULES, MAIN_KEYS,
		control, liveRuleKeys, readValue,
		setSideNames(fn) { sideNames = fn; }
	};
})();
