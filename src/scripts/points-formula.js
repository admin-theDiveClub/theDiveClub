// The points formula: a scenario + formulas + weights → points per person.
//
// Pure on purpose: no page, no database, no clock. The tuning page
// (/staff/points/) runs it live; the same code can work out real points later,
// and tools/points-tests/ runs it under Node.
//
// UV describes a formula, Claude adds it to FORMULAS below, and the page gives
// each of its weights a slider. docs/systems/points.md has how to add one.
//
//   Levels    A formula belongs to one level, which says how often it runs:
//               player      once a person, from their profile and history
//               frame       once a person, for each complete frame
//               match       once a person, for the match
//               tournament  once a person, when the match is in a tournament
//               league      once a person, when the match is in a league
//   Who       Which people it runs for. 'players' by default; see WHO.
//   calc      (d, w) => a number. d is what that person sees at that level
//             (d.me, d.frame, d.match, d.rules, d.tournament, d.league, d.site)
//             and w is the formula's weights. Negative is allowed.
//
// A new kind of data goes in DATA below and in viewFor, in the same change
// (CLAUDE.md, "Every milestone"). Match settings need no entry: every key of
// the match's frozen rules is d.rules.<key>, and the page lists them from
// TDCMatchDef.

const TDCPoints = (() => {
	const LEVELS = ['player', 'frame', 'match', 'tournament', 'league'];
	const WHO = ['everyone', 'players', 'td', 'ld', 'captain', 'scorer', 'referee'];

	// UV describes each one; none is assumed (UV, 6 Nov: no starting set).
	const FORMULAS = [];

	// Settings that belong to a whole weight set rather than to one formula.
	const SETTINGS = {
		social_cap: {
			label: 'Social matches that count, per opponent per week',
			value: 1, min: 0, max: 7, step: 1,
			hint: '0 turns the cap off.'
		}
	};

	// Every data point a formula can read, by where it lives on d. The page
	// lists these for UV to describe formulas from. A test checks each path
	// exists, so this list cannot drift from viewFor.
	const DATA = {
		me: [
			['me.side', 'text', 'Side played: home, away, or nothing for an official'],
			['me.verified', 'yes/no', 'Verified account'],
			['me.signed', 'yes/no', 'This person signed or approved the result'],
			['me.earlier_this_week', 'number', 'Earlier social matches v this opponent this week'],
			['me.roles.td', 'yes/no', 'Tournament director here'],
			['me.roles.ld', 'yes/no', 'League director here'],
			['me.roles.captain', 'yes/no', 'Captain here'],
			['me.roles.scorer', 'yes/no', 'Scorer here'],
			['me.roles.referee', 'yes/no', 'Referee here'],
			['me.profile.joined_days', 'number', 'Days since the account was made'],
			['me.profile.has_picture', 'yes/no', 'Has a profile picture'],
			['me.profile.followers', 'number', 'Followers'],
			['me.profile.following', 'number', 'Following'],
			['me.history.frames', 'number', 'Career frames'],
			['me.history.frames_won', 'number', 'Career frames won'],
			['me.history.frames_lost', 'number', 'Career frames lost'],
			['me.history.frame_diff', 'number', 'Career frame difference'],
			['me.history.win_pct', 'number', 'Career frames won, %'],
			['me.history.matches', 'number', 'Career matches'],
			['me.history.matches_won', 'number', 'Career matches won'],
			['me.history.matches_locked', 'number', 'Career matches with a locked result'],
			['me.history.breaks', 'number', 'Career breaks'],
			['me.history.break_in', 'number', 'Career breaks: in'],
			['me.history.break_dry', 'number', 'Career breaks: dry'],
			['me.history.break_foul', 'number', 'Career breaks: foul'],
			['me.history.break_scratch', 'number', 'Career breaks: scratch'],
			['me.history.bf', 'number', 'Career B&F'],
			['me.history.rbf', 'number', 'Career reverse B&F'],
			['me.history.golden', 'number', 'Career golden breaks'],
			['me.history.defaults', 'number', 'Career frames won by default'],
			['me.history.avg_frame_minutes', 'number or nothing', 'Career average frame time'],
			['me.history.avg_racking_minutes', 'number or nothing', 'Career average racking time'],
			['me.history.times_captain', 'number', 'Seasons as captain'],
			['me.history.times_scorer', 'number', 'Competitions as scorer'],
			['me.history.times_referee', 'number', 'Competitions and matches as referee'],
			['me.history.times_td', 'number', 'Tournaments run'],
			['me.history.times_ld', 'number', 'League seasons run'],
			['me.history.tournaments_entered', 'number', 'Tournaments entered'],
			['me.history.seasons_entered', 'number', 'League seasons entered']
		],
		frame: [
			['frame.played', 'yes/no', 'This person played the frame'],
			['frame.won', 'yes/no', 'This person\'s side won it'],
			['frame.lost', 'yes/no', 'This person\'s side lost it'],
			['frame.won_by', 'text', 'How they won: win, break_and_finish, reverse_break_and_finish, golden_break, default'],
			['frame.lost_by', 'text', 'How they lost, the same values'],
			['frame.i_broke', 'yes/no', 'This person\'s side broke'],
			['frame.opp_broke', 'yes/no', 'The other side broke'],
			['frame.break_outcome', 'text', 'in, dry, foul, scratch, or nothing'],
			['frame.my_break_outcome', 'text', 'The outcome if this side broke, else nothing'],
			['frame.opp_break_outcome', 'text', 'The outcome if the other side broke, else nothing'],
			['frame.break_by_hand', 'yes/no', 'Breaker set by hand, not by the rule'],
			['frame.frame_minutes', 'number or nothing', 'Frame time, pauses taken off'],
			['frame.racking_minutes', 'number or nothing', 'Racking time'],
			['frame.paused_minutes', 'number', 'Time paused'],
			['frame.frame_no', 'number', 'Frame number'],
			['frame.lineup_slot', 'number or nothing', 'Lineup slot, in team play'],
			['frame.has_referee', 'yes/no', 'The frame was set by a referee'],
			['frame.i_refereed', 'yes/no', 'This person refereed it'],
			['frame.my_score_before', 'number', 'This side\'s score before the frame'],
			['frame.opp_score_before', 'number', 'The other side\'s score before the frame']
		],
		match: [
			['match.kind', 'text', 'social, league or tournament'],
			['match.team', 'yes/no', 'A team match'],
			['match.complete', 'yes/no', 'Finished'],
			['match.locked', 'yes/no', 'The result is locked (agreed, approved or published)'],
			['match.sanctioned', 'yes/no', 'Sanctioned'],
			['match.stage', 'text', 'final, semi_final, quarter_final, third_place, earlier, or nothing'],
			['match.round', 'number or nothing', 'Tournament round number'],
			['match.has_referee', 'yes/no', 'The match has a referee'],
			['match.overridden', 'yes/no', 'A director entered the score'],
			['match.first_break_side_set', 'yes/no', 'The lag winner was recorded'],
			['match.minutes', 'number or nothing', 'Match time'],
			['match.start_delay_minutes', 'number or nothing', 'Actual start minus scheduled start'],
			['match.score_entry_rank', 'number or nothing', 'The lowest rank that may enter scores: TD only 100, referee 50, scorer 30, players 0'],
			['match.rotation_custom', 'yes/no', 'Who meets whom was changed from the default'],
			['match.signatures', 'number', 'Signatures on the card'],
			['match.submitted', 'yes/no', 'The card was submitted'],
			['match.approved', 'yes/no', 'The card was approved'],
			['match.lineup_by_captain', 'yes/no', 'This side\'s lineup was locked by its captain'],
			['match.lineup_by_cutoff', 'yes/no', 'This side\'s lineup was locked by the cutoff'],
			['match.in_squad', 'yes/no', 'This person was in the night\'s squad'],
			['match.frames', 'number', 'Complete frames in the match'],
			['match.side_frames_won', 'number', 'Frames this side won (a director\'s score, if entered)'],
			['match.side_frames_lost', 'number', 'Frames this side lost (a director\'s score, if entered)'],
			['match.won', 'yes/no', 'This side won the match'],
			['match.lost', 'yes/no', 'This side lost the match'],
			['match.drawn', 'yes/no', 'The match was drawn'],
			['match.my_frames_played', 'number', 'Frames this person played'],
			['match.my_frames_won', 'number', 'Frames this person won'],
			['match.my_frames_lost', 'number', 'Frames this person lost'],
			['match.my_breaks', 'number', 'Breaks by this person'],
			['match.my_break_in', 'number', 'Their breaks: in'],
			['match.my_break_dry', 'number', 'Their breaks: dry'],
			['match.my_break_foul', 'number', 'Their breaks: foul'],
			['match.my_break_scratch', 'number', 'Their breaks: scratch'],
			['match.my_bf', 'number', 'Their B&F'],
			['match.my_rbf', 'number', 'Their reverse B&F'],
			['match.my_golden', 'number', 'Their golden breaks'],
			['match.my_defaults', 'number', 'Frames they won by default'],
			['match.avg_frame_minutes', 'number or nothing', 'Average frame time in this match'],
			['match.avg_racking_minutes', 'number or nothing', 'Average racking time in this match']
		],
		tournament: [
			['tournament.format', 'text', 'The format'],
			['tournament.status', 'text', 'The status'],
			['tournament.sanctioned', 'yes/no', 'Sanctioned'],
			['tournament.third_place', 'yes/no', 'Has a third-place playoff'],
			['tournament.progression', 'text', 'How players move on'],
			['tournament.create_matches', 'text', 'How matches start'],
			['tournament.entry_mode', 'text', 'How entry works'],
			['tournament.paid_confirms', 'yes/no', 'Paying confirms an entry'],
			['tournament.is_listed', 'yes/no', 'Visible to the public'],
			['tournament.max_entrants', 'number or nothing', 'Entry limit'],
			['tournament.entry_fee_credits', 'number', 'Entry fee, credits'],
			['tournament.entrants', 'number', 'Entrants'],
			['tournament.has_round_rules', 'yes/no', 'A round has its own rules'],
			['tournament.my_seed', 'number or nothing', 'This person\'s seed'],
			['tournament.my_confirmed', 'yes/no', 'They confirmed their entry'],
			['tournament.my_paid', 'yes/no', 'Their entry is paid']
		],
		league: [
			['league.status', 'text', 'The season\'s status'],
			['league.entry_mode', 'text', 'How entry works'],
			['league.paid_confirms', 'yes/no', 'Paying confirms an entry'],
			['league.is_listed', 'yes/no', 'Listed'],
			['league.max_reserves', 'number', 'Reserves allowed'],
			['league.teams', 'number', 'Teams in the season'],
			['league.entrants', 'number', 'Entrants in the season'],
			['league.my_confirmed', 'yes/no', 'This person confirmed their entry'],
			['league.my_paid', 'yes/no', 'Their entry is paid']
		],
		site: [
			['site.matches', 'number', 'Finished matches, ever, all venues'],
			['site.frames', 'number', 'Complete frames, ever, all venues'],
			['site.avg_frames_per_match', 'number or nothing', 'Average frames per finished match'],
			['site.avg_frame_minutes', 'number or nothing', 'Average frame time'],
			['site.avg_racking_minutes', 'number or nothing', 'Average racking time'],
			['site.bf_pct', 'number or nothing', 'Frames won by B&F, %'],
			['site.rbf_pct', 'number or nothing', 'Frames won by reverse B&F, %'],
			['site.golden_pct', 'number or nothing', 'Frames won by golden break, %'],
			['site.break_in_pct', 'number or nothing', 'Recorded breaks that went in, %']
		]
	};

	const asNumber = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
	const asMinutes = (seconds) => (typeof seconds === 'number' && Number.isFinite(seconds) ? seconds / 60 : null);
	const average = (values) => {
		const known = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
		return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
	};
	const otherSide = (side) => (side === 'home' ? 'away' : side === 'away' ? 'home' : null);
	const isComplete = (frame) => frame.status === 'complete';

	// Read a path from DATA ('me.roles.td') for the page's "this scenario" column.
	const read = (d, path) => path.split('.').reduce((v, key) => (v == null ? undefined : v[key]), d);

	// ─────────────────────────────────────────────────────────────────
	// Filling a scenario in, so a formula always finds every data point.
	// A preset and a real match arrive in the same shape; what a scenario
	// does not say is empty rather than missing.
	// ─────────────────────────────────────────────────────────────────

	const HISTORY_COUNTS = [
		'frames', 'frames_won', 'frames_lost', 'matches', 'matches_won', 'matches_locked',
		'breaks', 'break_in', 'break_dry', 'break_foul', 'break_scratch',
		'bf', 'rbf', 'golden', 'defaults',
		'times_captain', 'times_scorer', 'times_referee', 'times_td', 'times_ld',
		'tournaments_entered', 'seasons_entered'
	];

	const fillHistory = (h = {}) => {
		const out = { avg_frame_minutes: h.avg_frame_minutes ?? null, avg_racking_minutes: h.avg_racking_minutes ?? null };
		for (const key of HISTORY_COUNTS) out[key] = asNumber(h[key]);
		out.frame_diff = out.frames_won - out.frames_lost;
		out.win_pct = out.frames ? (out.frames_won / out.frames) * 100 : 0;
		return out;
	};

	const fillPerson = (p) => ({
		id: p.id,
		name: p.name || '',
		side: p.side || null,
		verified: !!p.verified,
		signed: !!p.signed,
		earlier_this_week: asNumber(p.earlier_this_week),
		roles: {
			td: !!(p.roles && p.roles.td),
			ld: !!(p.roles && p.roles.ld),
			captain: !!(p.roles && p.roles.captain),
			scorer: !!(p.roles && p.roles.scorer),
			referee: !!(p.roles && p.roles.referee)
		},
		profile: {
			joined_days: asNumber(p.profile && p.profile.joined_days),
			has_picture: !!(p.profile && p.profile.has_picture),
			followers: asNumber(p.profile && p.profile.followers),
			following: asNumber(p.profile && p.profile.following)
		},
		history: fillHistory(p.history),
		lineup_by_captain: !!p.lineup_by_captain,
		lineup_by_cutoff: !!p.lineup_by_cutoff,
		in_squad: !!p.in_squad,
		seed: p.seed ?? null,
		confirmed: !!p.confirmed,
		paid: !!p.paid
	});

	const fillFrame = (f) => ({
		id: f.id ?? null,
		frame_no: asNumber(f.frame_no),
		status: f.status || 'complete',
		winner_side: f.winner_side || null,
		result_event: f.result_event || null,
		break_side: f.break_side || null,
		break_side_manual: !!f.break_side_manual,
		break_outcome: f.break_outcome || null,
		frame_seconds: f.frame_seconds ?? null,
		racking_seconds: f.racking_seconds ?? null,
		paused_seconds: asNumber(f.paused_seconds),
		lineup_slot: f.lineup_slot ?? null,
		referee_id: f.referee_id ?? null,
		// { home: [ids], away: [ids] }. Without it, everyone on a side played.
		players: f.players || null
	});

	const fillScenario = (s) => {
		const m = s.match || {};
		const t = s.tournament;
		const l = s.league;
		const site = s.site || {};
		return {
			match: {
				kind: m.kind || 'social',
				team: !!m.team,
				complete: m.complete !== false,
				locked: !!m.locked,
				sanctioned: !!m.sanctioned,
				stage: m.stage || null,
				round: m.round ?? null,
				has_referee: !!m.has_referee,
				override: m.override || null,
				first_break_side_set: !!m.first_break_side_set,
				minutes: m.minutes ?? null,
				start_delay_minutes: m.start_delay_minutes ?? null,
				signatures: asNumber(m.signatures),
				submitted: !!m.submitted,
				approved: !!m.approved
			},
			rules: s.rules || {},
			tournament: t ? {
				format: t.format ?? null,
				status: t.status ?? null,
				sanctioned: !!t.sanctioned,
				third_place: !!t.third_place,
				progression: t.progression ?? null,
				create_matches: t.create_matches ?? null,
				entry_mode: t.entry_mode ?? null,
				paid_confirms: !!t.paid_confirms,
				is_listed: !!t.is_listed,
				max_entrants: t.max_entrants ?? null,
				entry_fee_credits: asNumber(t.entry_fee_credits),
				entrants: asNumber(t.entrants),
				has_round_rules: !!t.has_round_rules
			} : null,
			league: l ? {
				status: l.status ?? null,
				entry_mode: l.entry_mode ?? null,
				paid_confirms: !!l.paid_confirms,
				is_listed: !!l.is_listed,
				max_reserves: asNumber(l.max_reserves),
				teams: asNumber(l.teams),
				entrants: asNumber(l.entrants)
			} : null,
			site: {
				matches: asNumber(site.matches),
				frames: asNumber(site.frames),
				avg_frames_per_match: site.avg_frames_per_match ?? null,
				avg_frame_minutes: site.avg_frame_minutes ?? null,
				avg_racking_minutes: site.avg_racking_minutes ?? null,
				bf_pct: site.bf_pct ?? null,
				rbf_pct: site.rbf_pct ?? null,
				golden_pct: site.golden_pct ?? null,
				break_in_pct: site.break_in_pct ?? null
			},
			people: (s.people || []).map(fillPerson),
			frames: (s.frames || []).map(fillFrame).sort((a, b) => a.frame_no - b.frame_no)
		};
	};

	// ─────────────────────────────────────────────────────────────────
	// What one person sees. Frames are the only record, so every count
	// here is made from them, never read from anywhere else.
	// ─────────────────────────────────────────────────────────────────

	const playedFrame = (person, frame) => {
		if (!person.side) return false;
		if (!frame.players) return true;
		return (frame.players[person.side] || []).includes(person.id);
	};

	const frameView = (person, frame, scoreBefore) => {
		const mine = person.side;
		const theirs = otherSide(mine);
		const won = !!mine && frame.winner_side === mine;
		const lost = !!mine && frame.winner_side === theirs;
		const iBroke = !!mine && frame.break_side === mine;
		const oppBroke = !!mine && frame.break_side === theirs;
		return {
			played: playedFrame(person, frame),
			won,
			lost,
			won_by: won ? frame.result_event : null,
			lost_by: lost ? frame.result_event : null,
			i_broke: iBroke,
			opp_broke: oppBroke,
			break_outcome: frame.break_outcome,
			my_break_outcome: iBroke ? frame.break_outcome : null,
			opp_break_outcome: oppBroke ? frame.break_outcome : null,
			break_by_hand: frame.break_side_manual,
			frame_minutes: asMinutes(frame.frame_seconds),
			racking_minutes: asMinutes(frame.racking_seconds),
			paused_minutes: frame.paused_seconds / 60,
			frame_no: frame.frame_no,
			lineup_slot: frame.lineup_slot,
			has_referee: !!frame.referee_id,
			i_refereed: !!frame.referee_id && frame.referee_id === person.id,
			my_score_before: mine ? scoreBefore[mine] : 0,
			opp_score_before: theirs ? scoreBefore[theirs] : 0
		};
	};

	// The ranks of tbl_competition_role_types, as a number a formula can use.
	const SCORE_ENTRY_RANK = { td_only: 100, referee: 50, scorer: 30, players: 0 };

	const matchView = (person, s) => {
		const complete = s.frames.filter(isComplete);
		const mine = person.side;
		const theirs = otherSide(mine);
		const counted = { home: 0, away: 0 };
		for (const f of complete) if (f.winner_side in counted) counted[f.winner_side]++;
		// A director's entered score is its own record and decides the match,
		// though the frames below stay as they were played.
		const score = s.match.override || counted;
		const sideWon = mine ? asNumber(score[mine]) : 0;
		const sideLost = mine ? asNumber(score[theirs]) : 0;
		const played = complete.filter((f) => playedFrame(person, f));
		const event = (name) => played.filter((f) => f.winner_side === mine && f.result_event === name).length;
		const myBreaks = played.filter((f) => f.break_side === mine);
		const outcome = (name) => myBreaks.filter((f) => f.break_outcome === name).length;
		const decided = !!mine && s.match.complete;
		return {
			kind: s.match.kind,
			team: s.match.team,
			complete: s.match.complete,
			locked: s.match.locked,
			sanctioned: s.match.sanctioned,
			stage: s.match.stage,
			round: s.match.round,
			has_referee: s.match.has_referee,
			overridden: !!s.match.override,
			first_break_side_set: s.match.first_break_side_set,
			minutes: s.match.minutes,
			start_delay_minutes: s.match.start_delay_minutes,
			score_entry_rank: SCORE_ENTRY_RANK[s.rules.score_entry_mode] ?? null,
			rotation_custom: s.rules.rotation != null,
			signatures: s.match.signatures,
			submitted: s.match.submitted,
			approved: s.match.approved,
			lineup_by_captain: person.lineup_by_captain,
			lineup_by_cutoff: person.lineup_by_cutoff,
			in_squad: person.in_squad,
			frames: complete.length,
			side_frames_won: sideWon,
			side_frames_lost: sideLost,
			won: decided && sideWon > sideLost,
			lost: decided && sideWon < sideLost,
			drawn: decided && sideWon === sideLost,
			my_frames_played: played.length,
			my_frames_won: played.filter((f) => f.winner_side === mine).length,
			my_frames_lost: played.filter((f) => f.winner_side === theirs).length,
			my_breaks: myBreaks.length,
			my_break_in: outcome('in'),
			my_break_dry: outcome('dry'),
			my_break_foul: outcome('foul'),
			my_break_scratch: outcome('scratch'),
			my_bf: event('break_and_finish'),
			my_rbf: event('reverse_break_and_finish'),
			my_golden: event('golden_break'),
			my_defaults: event('default'),
			avg_frame_minutes: average(complete.map((f) => asMinutes(f.frame_seconds))),
			avg_racking_minutes: average(complete.map((f) => asMinutes(f.racking_seconds)))
		};
	};

	// Everything a formula can read for one person; d.frame is set per frame.
	const viewFor = (person, s) => ({
		me: {
			side: person.side,
			verified: person.verified,
			signed: person.signed,
			earlier_this_week: person.earlier_this_week,
			roles: person.roles,
			profile: person.profile,
			history: person.history
		},
		frame: null,
		match: matchView(person, s),
		rules: s.rules,
		tournament: s.tournament ? Object.assign({}, s.tournament, {
			my_seed: person.seed,
			my_confirmed: person.confirmed,
			my_paid: person.paid
		}) : null,
		league: s.league ? Object.assign({}, s.league, {
			my_confirmed: person.confirmed,
			my_paid: person.paid
		}) : null,
		site: s.site
	});

	// ─────────────────────────────────────────────────────────────────
	// Weights
	// ─────────────────────────────────────────────────────────────────

	// A formula's own defaults, with a saved weight set over them. Anything
	// saved that no longer fits is reported, never quietly dropped.
	const resolveWeights = (formulas, saved = {}) => {
		const warnings = [];
		const result = { settings: {}, formulas: {} };
		const known = (raw, label, fallback) => {
			if (raw === undefined) return fallback;
			if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
			warnings.push(label + ': the saved value is not a number, so the default was used.');
			return fallback;
		};
		const savedSettings = saved.settings || {};
		for (const [key, def] of Object.entries(SETTINGS)) {
			result.settings[key] = known(savedSettings[key], 'Setting ' + key, def.value);
		}
		const savedFormulas = saved.formulas || {};
		for (const f of formulas) {
			const own = savedFormulas[f.id] || {};
			result.formulas[f.id] = {};
			for (const [key, def] of Object.entries(f.weights || {})) {
				result.formulas[f.id][key] = known(own[key], f.id + '.' + key, def.value);
			}
			for (const key of Object.keys(own)) {
				if (!f.weights || !(key in f.weights)) warnings.push(f.id + '.' + key + ': saved, but this formula no longer has it.');
			}
		}
		for (const id of Object.keys(savedFormulas)) {
			if (!formulas.some((f) => f.id === id)) warnings.push(id + ': saved, but this formula no longer exists.');
		}
		return { weights: result, warnings };
	};

	const checkFormulas = (formulas) => {
		const problems = [];
		const seen = new Set();
		for (const f of formulas) {
			if (!f.id) problems.push('A formula has no id.');
			if (seen.has(f.id)) problems.push(f.id + ': two formulas share this id.');
			seen.add(f.id);
			if (!LEVELS.includes(f.level)) problems.push(f.id + ': unknown level "' + f.level + '".');
			if (f.who !== undefined && !WHO.includes(f.who)) problems.push(f.id + ': unknown who "' + f.who + '".');
			if (typeof f.calc !== 'function') problems.push(f.id + ': calc is not a function.');
		}
		return problems;
	};

	// ─────────────────────────────────────────────────────────────────
	// The calculation
	// ─────────────────────────────────────────────────────────────────

	const appliesTo = (formula, person) => {
		const who = formula.who || 'players';
		if (who === 'everyone') return true;
		if (who === 'players') return !!person.side;
		return person.roles[who];
	};

	const calculate = (scenario, formulas = FORMULAS, savedWeights = {}) => {
		const s = fillScenario(scenario);
		const warnings = checkFormulas(formulas);
		const resolved = resolveWeights(formulas, savedWeights);
		warnings.push(...resolved.warnings);
		const weights = resolved.weights;
		const usable = formulas.filter((f) => LEVELS.includes(f.level) && typeof f.calc === 'function');

		// A formula that throws or gives back something other than a number
		// earns nothing and says so, so a bad formula cannot pass as a low score.
		const run = (formula, d, person, where) => {
			try {
				const out = formula.calc(d, weights.formulas[formula.id] || {});
				if (typeof out === 'number' && Number.isFinite(out)) return out;
				warnings.push(formula.id + ' gave ' + String(out) + ' for ' + person.name + where + '; counted as 0.');
			} catch (err) {
				warnings.push(formula.id + ' failed for ' + person.name + where + ': ' + err.message);
			}
			return 0;
		};

		// The score going into each frame, for the story of a comeback.
		const scoreBefore = new Map();
		const running = { home: 0, away: 0 };
		for (const f of s.frames.filter(isComplete)) {
			scoreBefore.set(f, { home: running.home, away: running.away });
			if (f.winner_side in running) running[f.winner_side]++;
		}

		const cap = weights.settings.social_cap;
		const people = s.people.map((person) => {
			const capped = s.match.kind === 'social' && cap > 0 && person.earlier_this_week >= cap;
			const lines = [];
			const levels = { player: 0, frame: 0, match: 0, tournament: 0, league: 0 };

			for (const formula of usable) {
				if (!appliesTo(formula, person)) continue;
				const d = viewFor(person, s);
				const level = formula.level;
				const line = { formula: formula.id, label: formula.label || formula.id, level, amount: 0, frames: [] };

				if (level === 'player') {
					line.amount = run(formula, d, person, '');
				} else if (level === 'frame') {
					if (capped) continue;
					for (const frame of s.frames.filter(isComplete)) {
						const view = frameView(person, frame, scoreBefore.get(frame));
						// 'players' means those who played this frame, on a team night.
						if ((formula.who || 'players') === 'players' && !view.played) continue;
						const amount = run(formula, Object.assign({}, d, { frame: view }), person, ', frame ' + frame.frame_no);
						line.amount += amount;
						if (amount !== 0) line.frames.push({ frame_no: frame.frame_no, amount });
					}
				} else if (level === 'match') {
					if (capped) continue;
					line.amount = run(formula, d, person, '');
				} else if (s[level]) {
					line.amount = run(formula, d, person, '');
				} else {
					continue;
				}

				levels[level] += line.amount;
				lines.push(line);
			}

			const earned = lines.reduce((sum, l) => sum + l.amount, 0);
			return {
				id: person.id,
				name: person.name,
				verified: person.verified,
				capped,
				// Verified accounts only (UV, 6 Nov). What it would have been is
				// kept beside it, so the sliders still mean something on a real match.
				points: person.verified ? earned : 0,
				would_earn: earned,
				levels,
				lines
			};
		});

		return { people, warnings };
	};

	// ─────────────────────────────────────────────────────────────────
	// Turning real rows into the shape above
	// ─────────────────────────────────────────────────────────────────

	const secondsBetween = (from, to) => {
		if (!from || !to) return null;
		const ms = new Date(to).getTime() - new Date(from).getTime();
		return Number.isFinite(ms) ? ms / 1000 : null;
	};

	// One row of tbl_frames, with its participants, as a scenario's frame.
	// Times as design §8 has them: pauses come off the frame, and racking is
	// empty when no break was played.
	const frameFromRow = (row, participants = []) => {
		const span = secondsBetween(row.started_at, row.ended_at);
		const players = { home: [], away: [] };
		for (const p of participants) if (players[p.side]) players[p.side].push(p.player_id);
		return {
			id: row.id,
			frame_no: row.frame_no,
			status: row.status,
			winner_side: row.winner_side,
			result_event: row.result_event,
			break_side: row.break_side,
			break_side_manual: row.break_side_manual,
			break_outcome: row.break_outcome,
			frame_seconds: span === null ? null : span - asNumber(row.paused_seconds),
			racking_seconds: secondsBetween(row.rack_started_at, row.started_at),
			paused_seconds: row.paused_seconds,
			lineup_slot: row.lineup_slot,
			referee_id: row.referee_player_id,
			players: participants.length ? players : null
		};
	};

	// One person's frame counts, from scenario frames with sides known. Each
	// entry is { side, frame }: the side they played on, and the frame.
	const historyFromFrames = (entries) => {
		const h = { frames: 0, frames_won: 0, frames_lost: 0, breaks: 0, break_in: 0, break_dry: 0, break_foul: 0, break_scratch: 0, bf: 0, rbf: 0, golden: 0, defaults: 0 };
		const frameTimes = [];
		const rackTimes = [];
		for (const { side, frame } of entries) {
			if (frame.status !== 'complete') continue;
			h.frames++;
			if (frame.winner_side === side) {
				h.frames_won++;
				if (frame.result_event === 'break_and_finish') h.bf++;
				if (frame.result_event === 'reverse_break_and_finish') h.rbf++;
				if (frame.result_event === 'golden_break') h.golden++;
				if (frame.result_event === 'default') h.defaults++;
			} else if (frame.winner_side) {
				h.frames_lost++;
			}
			if (frame.break_side === side) {
				h.breaks++;
				if (frame.break_outcome === 'in') h.break_in++;
				if (frame.break_outcome === 'dry') h.break_dry++;
				if (frame.break_outcome === 'foul') h.break_foul++;
				if (frame.break_outcome === 'scratch') h.break_scratch++;
			}
			frameTimes.push(asMinutes(frame.frame_seconds));
			rackTimes.push(asMinutes(frame.racking_seconds));
		}
		h.avg_frame_minutes = average(frameTimes);
		h.avg_racking_minutes = average(rackTimes);
		return h;
	};

	return {
		LEVELS, WHO, FORMULAS, SETTINGS, DATA,
		calculate, resolveWeights, checkFormulas, fillScenario, viewFor, frameView, read,
		frameFromRow, historyFromFrames
	};
})();

if (typeof module !== 'undefined') module.exports = TDCPoints;
