// A league's Rules tab (UV, 10 Nov): the rules as a written document, in
// numbered sections, with whoever to ask at the foot. It was a folded list of
// labels and values on the Season tab.
//
// Two kinds of clause. A setting's clause is generated from TDCMatchDef and
// worded by WORDS below, from what that setting does on a league night. The
// fixed clauses are how every league runs, whatever its settings: the blind
// exchange of lineups, reserves, walkovers, signing the card. A new setting
// with no words still appears, under Other rules, with its label and value.
//
// Left out on purpose: Approval and the Dispute window. A team card is settled
// by both captains signing (private.tdc_card_state), whatever those two say,
// so describing them here would promise something a league night does not do.
//
// Open to signed-out visitors as the Season tab is, from the same public read;
// that read gives no player ids, so the league director is then not a link.
//
// Needs: tdc.js, match-settings.js, league-nav.js.

TDCLeagueNav.panel('rules', () => {
	const AREA = 'League rules';
	const D = TDCMatchDef;
	const seasonId = new URLSearchParams(location.search).get('s');
	const el = (id) => document.getElementById(id);
	const els = {
		status: el('ru-status'), doc: el('ru-doc'), league: el('ru-league'),
		intro: el('ru-intro'), body: el('ru-body'), people: el('ru-people')
	};

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	let signedOut = false;
	let info = null;
	let reserves = 0;
	let officials = [];

	// ─── A setting's value, in a few words ───
	function ruleValue(def, rules) {
		const v = rules[def.key];
		if (def.key === 'win_condition_type') {
			const name = D.WIN_CONDITION[v] || v;
			return v === 'free_play' || !rules.win_condition_target ? name : name + ' ' + rules.win_condition_target;
		}
		if (def.key === 'team_size') return v + ' a side' + (reserves ? ', up to ' + plural(reserves, 'reserve') : '');
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

	// ─── What each setting means on a league night ───
	const PLAYED_OUT = 'The card is still played to the end, because every frame counts in the standings.';
	const WORDS = {
		discipline: (r) => 'Every frame in this league is played as ' + (D.DISCIPLINE[r.discipline] || r.discipline) + '.',
		win_condition_type: (r) => ({
			race_to: 'The first team to ' + r.win_condition_target + ' frames wins the match. ' + PLAYED_OUT,
			best_of: 'The team that wins the majority of the frames wins the match. ' + PLAYED_OUT,
			fixed_frames: 'The team that wins more frames over the whole card wins the match.',
			timed: 'The team ahead when time is called wins the match.',
			free_play: 'There is no target. Frames are counted and no winner is declared.'
		})[r.win_condition_type],
		draws_allowed: (r) => {
			if (r.draws_allowed) return 'If the teams finish level, the match is a draw.';
			return 'A match cannot end level. ' + ({
				sudden_death_frame: 'If the teams finish level, one more frame decides it.',
				decider_on_lag: 'If the teams finish level, one deciding frame is played, and a lag decides who breaks it.',
				coordinator_decision: 'If the teams finish level, whoever runs the league decides the result.'
			}[r.tiebreak_method] || '');
		},
		team_size: (r) => {
			const n = r.team_size;
			let text = 'Each team fields ' + n + ' players. A match is ' + n + ' sessions of ' + n + ' frames, ' + n * n + ' frames in all, and each frame is one game between two named players.';
			if (reserves) text += ' A team may hold up to ' + (n + reserves) + ' active players: its ' + n + ' and ' + plural(reserves, 'reserve') + '. A player marked away does not count towards that limit.';
			return text;
		},
		rotation: (r) => (r.rotation
			? 'Whoever runs the league has set its own table of who meets whom, and every session follows it.'
			: 'After the first session the away order moves along one place each session, so every home player meets every away player once.'),
		strict_frame_order: (r) => (r.strict_frame_order
			? 'Frames are played in the order on the card, and only the next frame can be entered.'
			: 'Frames may be played in any order as tables come free, and each can be entered as it finishes.'),
		lineup_cutoff_hours: (r) => (r.lineup_cutoff_hours
			? 'Each lineup must be locked ' + plural(r.lineup_cutoff_hours, 'hour') + ' before the match is due to start. A lineup not locked by then is locked as it stands, so a team that has named nobody gives up those frames.'
			: 'There is no cutoff. Captains lock their lineups when they are ready.'),
		track_breaks: (r) => (r.track_breaks
			? 'Who breaks each frame is part of the record of the match.'
			: 'Breaks are not tracked in this league, so a frame is simply won or lost and the card carries no special wins.'),
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
			: 'A break and finish is not marked as a result of its own in this league.'),
		golden_break_enabled: (r) => (r.golden_break_enabled
			? 'A frame won on the break shot itself is a golden break, and is marked on the card as its own result.'
			: 'A golden break is not marked as a result of its own in this league.'),
		reverse_break_finish_enabled: (r) => (r.reverse_break_finish_enabled
			? 'A frame won in one visit by the player who did not break, after a dry break, is a reverse break and finish, and is marked on the card as its own result.'
			: 'A reverse break and finish is not marked as a result of its own in this league.'),
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
				finish_current_frame: 'When it runs out, the frames being played are finished and play stops.'
			}[r.on_time_expiry] || '');
		},
		shot_clock_enabled: (r) => {
			if (!r.shot_clock_enabled) return 'There is no shot clock.';
			return 'Each shot has ' + plural(r.shot_clock_seconds, 'second') + ', and the first shot has ' + plural(r.shot_clock_first_shot_seconds, 'second') + '. '
				+ (r.extensions_per_player
					? 'Each player has ' + plural(r.extensions_per_player, 'extension') + ' of ' + plural(r.extension_seconds, 'second') + '.'
					: 'There are no extensions.');
		},
		score_entry_mode: (r) => ({
			players: 'Players enter the result of their own frame. Captains and whoever runs the league may enter any frame.',
			scorer: 'Scores are entered by a scorer, a referee or whoever runs the league.',
			referee: 'Scores are entered by a referee or whoever runs the league.',
			td_only: 'Only whoever runs the league enters scores.'
		})[r.score_entry_mode]
	};
	// Said inside another setting's clause, or not a rule of a team night (the
	// header says why Approval and the Dispute window are here).
	const NOT_A_CLAUSE = new Set([
		'win_condition_target', 'tiebreak_method', 'on_time_expiry', 'shot_clock_seconds', 'shot_clock_first_shot_seconds',
		'extensions_per_player', 'extension_seconds', 'approval_mode', 'dispute_window_hours'
	]);

	// ─── Clauses that hold in every league ───
	const LINEUP_CLAUSES = () => {
		const size = info.rules && info.rules.team_size;
		return [
			['Naming a lineup', 'Each captain says who is available for the night and sets the order for the first session.'
				+ (size ? ' Every later session follows from that order.' : '')],
			['Blind exchange', 'Neither captain can see the other team’s order until both have locked theirs.'],
			['Once locked', 'When both lineups are locked the frames are made, and the order can no longer change. Only a reserve coming in can change who plays a frame.']
		];
	};
	const RESERVE_CLAUSES = () => (reserves
		? [['Reserves', 'A reserve replaces a player for one frame at a time and never changes the number of frames. No player may play more than one frame in a session, a player in the lineup stays in the same position every session, and a reserve may not face the same opponent twice.']]
		: [['Reserves', 'This season has no reserves.']]);
	const SEAT_CLAUSE = ['Empty seats', 'A seat left empty can be filled by a reserve or a latecomer until the card is signed. A frame with a seat still empty then is a walkover to the side that turned up.'];
	const SIGNING_CLAUSES = [
		['Signing the card', 'A match is finished when both captains have signed the same card. Signing means this is the final card, so it may be signed with frames unplayed, and those frames count for nobody. If a captain will not sign, the league director can sign for that side.'],
		['Changes after signing', 'If a frame is changed after the card is signed, both signatures stop counting and the match is re-opened until both captains sign again. Every change is listed on the card, with who made it.'],
		['Disputes', 'A captain who disagrees with the card can raise a dispute, which re-opens it.'],
		['The standings', 'Standings are counted from matches both captains have signed. The Live switch on the Standings tab also shows matches still being played, and those are not final.']
	];

	// ─── The document ───
	// [heading, setting keys in order, fixed clauses before, fixed clauses after]
	const SECTIONS = () => [
		['Format', ['discipline', 'win_condition_type', 'draws_allowed'], [], []],
		['The match', ['team_size', 'rotation', 'strict_frame_order'], [], []],
		['Lineups and reserves', ['lineup_cutoff_hours'], LINEUP_CLAUSES(), RESERVE_CLAUSES().concat([SEAT_CLAUSE])],
		['At the table', ['track_breaks', 'break_determination', 'break_finish_enabled', 'golden_break_enabled', 'reverse_break_finish_enabled', 'break_finish_requires_breaker', 'referee_required'], [], []],
		['Timing', ['max_match_minutes', 'shot_clock_enabled'], [], []],
		['Scores and signing', ['score_entry_mode'], [], SIGNING_CLAUSES]
	];

	function shownDef(key, rules) {
		const def = D.SETTINGS.find((s) => s.key === key && s.scope === 'rules');
		if (!def || rules[key] === undefined || (def.when && !def.when(rules))) return null;
		return def;
	}
	const cleanLabel = (def) => def.label.replace(/\s*\(\w+\)$/, '');

	function clause(number, title, value, text) {
		const box = node('div', 'lr-clause');
		const head = node('div', 'lr-clause-head');
		head.append(node('span', 'lr-no', number), node('h3', null, title));
		if (value) head.append(node('span', 'lr-value', value));
		box.append(head);
		if (text) box.append(node('p', null, text));
		return box;
	}

	function section(number, title, rows) {
		const box = node('section', 'lr-section');
		box.append(node('h2', null, number + '. ' + title));
		rows.forEach((r, i) => box.append(clause(number + '.' + (i + 1), r.title, r.value, r.text)));
		return box;
	}

	const fixedRow = ([title, text]) => ({ title, text });
	function settingRow(def, rules) {
		const words = WORDS[def.key];
		return { title: cleanLabel(def), value: ruleValue(def, rules), text: words ? words(rules) : null };
	}

	function render() {
		const rules = info.rules || {};
		els.league.textContent = info.league_name + ' · ' + info.name;
		els.intro.replaceChildren(
			node('p', null, 'These rules apply to every match played in ' + info.league_name + ', ' + info.name + ': every team, every night and every frame.'),
			node('p', null, 'Whoever runs the league sets them, and each match keeps its own copy from the moment it is created. If the rules change during the season, matches not yet under way follow the change. A match with a locked lineup or a frame on its card keeps the rules it began with, so nothing already played is ever rescored.')
		);

		const placed = new Set(NOT_A_CLAUSE);
		const parts = [];
		for (const [title, keys, before, after] of SECTIONS()) {
			keys.forEach((k) => placed.add(k));
			const rows = before.map(fixedRow)
				.concat(keys.map((k) => shownDef(k, rules)).filter(Boolean).map((def) => settingRow(def, rules)))
				.concat(after.map(fixedRow));
			if (rows.length) parts.push([title, rows]);
		}
		// A setting nobody has written words for yet.
		const others = D.SETTINGS
			.filter((def) => def.scope === 'rules' && !placed.has(def.key) && shownDef(def.key, rules))
			.map((def) => settingRow(def, rules));
		if (others.length) parts.push(['Other rules', others]);
		els.body.replaceChildren(...parts.map(([title, rows], i) => section(i + 1, title, rows)));

		renderContact();
		els.doc.hidden = false;
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

	function person(o) {
		const a = node(o.player_id ? 'a' : 'span', 'person');
		if (o.player_id) a.href = '/players/?p=' + encodeURIComponent(o.player_id);
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', o.display_name), node('span', 'person-sub', o.role_name));
		a.append(avatar(o.avatar_path, o.display_name), names);
		return a;
	}

	function renderContact() {
		const directors = officials.filter((o) => o.role_name === 'League director');
		const people = directors.length ? directors : officials;
		if (people.length) els.people.replaceChildren(...people.map(person));
		else els.people.replaceChildren(node('p', 'muted', 'Nobody is listed.'));
	}

	// ─── Reading ───
	async function loadPublic() {
		const { data, error } = await supabaseClient.rpc('tdc_public_league_season', { p_league_season_id: seasonId });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (!data) { await TDC.requireSession(AREA); return false; }
		info = data;
		reserves = data.max_reserves || 0;
		officials = data.officials || [];
		return true;
	}

	async function loadMember() {
		const [season, row, people] = await Promise.all([
			supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId }),
			supabaseClient.from('tbl_league_seasons').select('max_reserves').eq('id', seasonId).maybeSingle(),
			supabaseClient.rpc('tdc_league_officials', { p_league_season_id: seasonId })
		]);
		const failed = season.error || row.error || people.error;
		if (failed) { TDC.showSupabaseError(AREA, failed, els.status); return false; }
		info = (season.data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}
		reserves = (row.data && row.data.max_reserves) || 0;
		officials = people.data || [];
		return true;
	}

	async function load() {
		if (await (signedOut ? loadPublic() : loadMember())) render();
	}

	// ─── Start ───
	TDCLoader.hold((async () => {
		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the leagues list.', null, els.status);
			return;
		}
		signedOut = !await TDC.getSession(AREA);
		await load();
	})(), AREA);

	// Shown again as a tab: read again, so a rule saved on Settings shows here.
	return { refresh: () => load().catch((err) => TDC.error(AREA, 'the rules could not be read again.', err, els.status)) };
});
