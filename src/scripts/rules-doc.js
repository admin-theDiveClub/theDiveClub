// The rules as a written document (UV, 10 Nov): what a league's and a
// tournament's Rules tabs share. Each tab says its own sections and the clauses
// only it has (league-rules.js, tournament-rules.js); this file holds the words
// for the rules that mean the same in both, and draws the document.
//
// A setting's clause is generated from TDCMatchDef. A setting with no words
// still appears, under Other rules, with its label and value, so a new one is
// never lost.
//
// Needs: tdc.js, match-settings.js.

const TDCRulesDoc = (() => {
	const D = TDCMatchDef;

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	// ─── A setting's value, in a few words ───
	function value(def, rules) {
		const v = rules[def.key];
		if (def.key === 'win_condition_type') {
			const name = D.WIN_CONDITION[v] || v;
			return v === 'free_play' || !rules.win_condition_target ? name : name + ' ' + rules.win_condition_target;
		}
		if (def.type === 'rotation') return v ? 'The league’s own order' : 'The standard rotation';
		if (def.type === 'bool') return v ? 'Yes' : 'No';
		if (def.type === 'select') {
			const options = typeof def.options === 'function' ? def.options() : def.options;
			return (options && options[v]) || String(v);
		}
		if (def.type === 'int') {
			if (/_seconds$/.test(def.key)) return v + ' s';
			const unit = /\((\w+)\)$/.exec(def.label);
			if (unit) return v ? v + ' ' + (v === 1 ? unit[1].replace(/s$/, '') : unit[1]) : 'None';
			return String(v);
		}
		return v == null ? '' : String(v);
	}
	const label = (def) => def.label.replace(/\s*\(\w+\)$/, '');

	// ─── The rules that mean the same in a league and a tournament ───
	// sides: who plays a match ('teams', 'players'). runner: 'the league',
	// 'the tournament'. onExpiry: what finishing up means on that kind of night.
	function sharedWords({ sides, runner, onExpiry }) {
		return {
			discipline: (r) => 'Every frame is played as ' + (D.DISCIPLINE[r.discipline] || r.discipline) + '.',
			draws_allowed: (r) => {
				if (r.draws_allowed) return 'If the ' + sides + ' finish level, the match is a draw.';
				return 'A match cannot end level. ' + ({
					sudden_death_frame: 'If the ' + sides + ' finish level, one more frame decides it.',
					decider_on_lag: 'If the ' + sides + ' finish level, one deciding frame is played, and a lag decides who breaks it.',
					coordinator_decision: 'If the ' + sides + ' finish level, whoever runs ' + runner + ' decides the result.'
				}[r.tiebreak_method] || '');
			},
			track_breaks: (r) => (r.track_breaks
				? 'Who breaks each frame is part of the record of the match.'
				: 'Breaks are not tracked here, so a frame is simply won or lost and the card carries no special wins.'),
			break_determination: (r) => ({
				alternate: 'The break alternates from frame to frame.',
				winner_breaks: 'The winner of the previous frame breaks.',
				loser_breaks: 'The loser of the previous frame breaks.',
				first_breaks: 'Whoever breaks the first frame breaks every frame.',
				by_schedule: 'The scoresheet sets who breaks each frame.',
				lag_each_frame: 'The two players lag before every frame, and the winner of the lag breaks.'
			})[r.break_determination],
			break_finish_enabled: (r) => (r.break_finish_enabled
				? 'A frame won in one visit from the break is a break and finish, and is marked on the card as its own result.'
				: 'A break and finish is not marked as a result of its own.'),
			golden_break_enabled: (r) => (r.golden_break_enabled
				? 'A frame won on the break shot itself is a golden break, and is marked on the card as its own result.'
				: 'A golden break is not marked as a result of its own.'),
			reverse_break_finish_enabled: (r) => (r.reverse_break_finish_enabled
				? 'A frame won in one visit by the player who did not break, after a dry break, is a reverse break and finish, and is marked on the card as its own result.'
				: 'A reverse break and finish is not marked as a result of its own.'),
			break_finish_requires_breaker: (r) => (r.break_finish_requires_breaker
				? 'Only the player who broke can be credited with a break and finish.'
				: 'Either player can be credited with a break and finish, whoever broke.'),
			referee_required: (r) => (r.referee_required
				? 'Every match needs a referee.'
				: 'A match does not need a referee.'),
			max_match_minutes: (r) => {
				if (!r.max_match_minutes) return 'There is no match clock.';
				return 'A match has ' + plural(r.max_match_minutes, 'minute') + ' on the clock. ' + ({
					stop_immediately: 'When it runs out, play stops at once.',
					finish_current_frame: 'When it runs out, ' + onExpiry + ' and play stops.'
				}[r.on_time_expiry] || '');
			},
			shot_clock_enabled: (r) => {
				if (!r.shot_clock_enabled) return 'There is no shot clock.';
				return 'Each shot has ' + plural(r.shot_clock_seconds, 'second') + ', and the first shot has ' + plural(r.shot_clock_first_shot_seconds, 'second') + '. '
					+ (r.extensions_per_player
						? 'Each player has ' + plural(r.extensions_per_player, 'extension') + ' of ' + plural(r.extension_seconds, 'second') + '.'
						: 'There are no extensions.');
			}
		};
	}
	// Said inside another setting's clause.
	const SAID_ELSEWHERE = ['win_condition_target', 'tiebreak_method', 'on_time_expiry', 'shot_clock_seconds',
		'shot_clock_first_shot_seconds', 'extensions_per_player', 'extension_seconds'];

	// ─── Drawing it ───
	function shownDef(key, rules) {
		const def = D.SETTINGS.find((s) => s.key === key && s.scope === 'rules');
		if (!def || rules[key] === undefined || (def.when && !def.when(rules))) return null;
		return def;
	}

	function clause(number, row) {
		const box = node('div', 'lr-clause');
		const head = node('div', 'lr-clause-head');
		head.append(node('span', 'lr-no', number), node('h3', null, row.title));
		if (row.value) head.append(node('span', 'lr-value', row.value));
		box.append(head);
		if (row.text) box.append(node('p', null, row.text));
		return box;
	}

	// sections: [{ title, rows: [[title, text, value]] fixed before the settings,
	// keys: setting keys, after: fixed rows after them }]. leftOut: settings
	// that get no clause. ownValue: a tab's own value for a setting, or nothing.
	function sections(list, rules, { words, leftOut = [], ownValue = () => null }) {
		const settingRow = (def) => ({
			title: label(def),
			value: ownValue(def, rules) || value(def, rules),
			text: words[def.key] ? words[def.key](rules) : null
		});
		const fixed = ([title, text, val]) => ({ title, text, value: val });
		const placed = new Set(SAID_ELSEWHERE.concat(leftOut));
		const parts = [];
		for (const s of list) {
			const keys = s.keys || [];
			keys.forEach((k) => placed.add(k));
			const rows = (s.rows || []).map(fixed)
				.concat(keys.map((k) => shownDef(k, rules)).filter(Boolean).map(settingRow))
				.concat((s.after || []).map(fixed));
			if (rows.length) parts.push([s.title, rows]);
		}
		const others = D.SETTINGS
			.filter((def) => def.scope === 'rules' && !placed.has(def.key) && shownDef(def.key, rules))
			.map(settingRow);
		if (others.length) parts.push(['Other rules', others]);
		return parts.map(([title, rows], i) => {
			const box = node('section', 'lr-section');
			box.append(node('h2', null, (i + 1) + '. ' + title));
			rows.forEach((row, j) => box.append(clause((i + 1) + '.' + (j + 1), row)));
			return box;
		});
	}

	function intro(paragraphs) {
		return paragraphs.map((text) => node('p', null, text));
	}

	// ─── Who to ask ───
	function avatar(path, name) {
		const box = node('span', 'person-pic');
		if (path) {
			const { data } = supabaseClient.storage.from('player-avatars').getPublicUrl(path);
			const img = document.createElement('img');
			img.src = data.publicUrl;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		return box;
	}

	// A signed-out visitor is given no ids: the same row, not a link.
	function person(o) {
		const a = node(o.player_id ? 'a' : 'span', 'person');
		if (o.player_id) a.href = '/players/?p=' + encodeURIComponent(o.player_id);
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', o.display_name), node('span', 'person-sub', o.role_name));
		a.append(avatar(o.avatar_path, o.display_name), names);
		return a;
	}

	function contact(box, people) {
		if (people.length) box.replaceChildren(...people.map(person));
		else box.replaceChildren(node('p', 'muted', 'Nobody is listed.'));
	}

	return { value, label, plural, sharedWords, sections, intro, contact };
})();
