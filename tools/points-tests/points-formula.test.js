// The points formula's tests. No install needed: node --test tools/points-tests/points-formula.test.js
// The formulas here exist only to prove the engine; the real ones are UV's.

const test = require('node:test');
const assert = require('node:assert/strict');
const TDCPoints = require('../../src/scripts/points-formula.js');

const alice = { id: 'a', name: 'Alice', side: 'home' };
const bob = { id: 'b', name: 'Bob', side: 'away' };
const frame = (no, winner, extra = {}) => Object.assign({ frame_no: no, status: 'complete', winner_side: winner, result_event: 'win' }, extra);

// A 5-4 to Alice, with nothing else recorded: UV's scenario A.
const fiveFour = () => ({
	match: { kind: 'social', complete: true },
	people: [alice, bob],
	frames: ['home', 'away', 'home', 'away', 'home', 'away', 'home', 'away', 'home'].map((w, i) => frame(i + 1, w))
});

const pointsOf = (result, id) => result.people.find((p) => p.id === id);

test('a pot split by score: 1000 at 5-4 is 556 and 444', () => {
	const split = {
		id: 'split', level: 'match',
		weights: { pot: { label: 'Pot', value: 1000, min: 0, max: 5000 } },
		calc: (d, w) => w.pot * d.match.my_frames_won / d.match.frames
	};
	const r = TDCPoints.calculate(fiveFour(), [split]);
	assert.equal(Math.round(pointsOf(r, 'a').points), 556);
	assert.equal(Math.round(pointsOf(r, 'b').points), 444);
	assert.deepEqual(r.warnings, []);
});

test('a slider changes the answer: saved weights sit over the defaults', () => {
	const f = { id: 'flat', level: 'match', weights: { n: { value: 10 } }, calc: (d, w) => w.n };
	const r = TDCPoints.calculate(fiveFour(), [f], { formulas: { flat: { n: 25 } } });
	assert.equal(pointsOf(r, 'a').points, 25);
});

test('UV\'s story: the opponent broke in, this player still won the frame, quickly', () => {
	const steal = {
		id: 'steal', level: 'frame',
		weights: { bonus: { value: 100 }, under: { value: 10 } },
		calc: (d, w) => (d.frame.won && d.frame.opp_break_outcome === 'in' && d.frame.frame_minutes !== null && d.frame.frame_minutes < w.under ? w.bonus : 0)
	};
	const s = {
		match: { kind: 'social' },
		people: [alice, bob],
		frames: [
			frame(1, 'home', { break_side: 'away', break_outcome: 'in', frame_seconds: 300 }),
			frame(2, 'home', { break_side: 'away', break_outcome: 'in', frame_seconds: 900 }),
			frame(3, 'home', { break_side: 'away', break_outcome: 'dry', frame_seconds: 300 }),
			frame(4, 'away', { break_side: 'home', break_outcome: 'in', frame_seconds: 300 })
		]
	};
	const r = TDCPoints.calculate(s, [steal]);
	const a = pointsOf(r, 'a');
	assert.equal(a.points, 100, 'only frame 1 has all three');
	assert.deepEqual(a.lines[0].frames, [{ frame_no: 1, amount: 100 }]);
	assert.equal(pointsOf(r, 'b').points, 100, 'frame 4 is Bob\'s, the same story');
});

test('each level runs as often as it says', () => {
	const count = (level, id) => ({ id, level, calc: () => 1 });
	const s = Object.assign(fiveFour(), { tournament: { format: 'single_elim' }, league: null });
	const r = TDCPoints.calculate(s, [count('player', 'p'), count('frame', 'f'), count('match', 'm'), count('tournament', 't'), count('league', 'l')]);
	assert.deepEqual(pointsOf(r, 'a').levels, { player: 1, frame: 9, match: 1, tournament: 1, league: 0 });
});

test('roles earn without playing: a TD with no side', () => {
	const td = { id: 't', name: 'Tess', roles: { td: true } };
	const s = Object.assign(fiveFour(), { people: [alice, bob, td] });
	const f = { id: 'run', level: 'match', who: 'td', calc: () => 500 };
	const played = { id: 'played', level: 'frame', calc: () => 1 };
	const r = TDCPoints.calculate(s, [f, played]);
	assert.equal(pointsOf(r, 't').points, 500);
	assert.equal(pointsOf(r, 'a').points, 9, 'a player is not the TD');
});

test('on a team night, a player formula pays only the frames they played', () => {
	const s = {
		match: { kind: 'league', team: true },
		people: [alice, { id: 'c', name: 'Cara', side: 'home' }, bob],
		frames: [
			frame(1, 'home', { players: { home: ['a'], away: ['b'] } }),
			frame(2, 'home', { players: { home: ['c'], away: ['b'] } })
		]
	};
	const r = TDCPoints.calculate(s, [{ id: 'f', level: 'frame', calc: (d) => (d.frame.won ? 1 : 0) }]);
	assert.equal(pointsOf(r, 'a').points, 1);
	assert.equal(pointsOf(r, 'c').points, 1);
	assert.equal(pointsOf(r, 'b').points, 0);
});

test('a guest or walk-in earns nothing, but what they would have earned is kept', () => {
	const s = Object.assign(fiveFour(), { people: [alice, Object.assign({}, bob, { has_account: false })] });
	const r = TDCPoints.calculate(s, [{ id: 'f', level: 'match', calc: () => 100 }]);
	assert.equal(pointsOf(r, 'b').points, 0);
	assert.equal(pointsOf(r, 'b').would_earn, 100);
	assert.equal(pointsOf(r, 'a').points, 100);
});

test('the social cap stops frames and matches, not history; 0 turns it off', () => {
	const s = Object.assign(fiveFour(), { people: [Object.assign({}, alice, { earlier_this_week: 1 }), bob] });
	const formulas = [
		{ id: 'm', level: 'match', calc: () => 10 },
		{ id: 'f', level: 'frame', calc: () => 1 },
		{ id: 'p', level: 'player', calc: () => 7 }
	];
	const capped = pointsOf(TDCPoints.calculate(s, formulas), 'a');
	assert.equal(capped.capped, true);
	assert.equal(capped.points, 7);
	assert.equal(pointsOf(TDCPoints.calculate(s, formulas), 'b').points, 26, 'the first match this week counts');
	assert.equal(pointsOf(TDCPoints.calculate(s, formulas, { settings: { social_cap: 0 } }), 'a').points, 26);
	const league = Object.assign({}, s, { match: { kind: 'league' } });
	assert.equal(pointsOf(TDCPoints.calculate(league, formulas), 'a').points, 26, 'the cap is for social matches');
});

test('points can go negative', () => {
	const r = TDCPoints.calculate(fiveFour(), [{ id: 'against', level: 'match', calc: () => -50 }]);
	assert.equal(pointsOf(r, 'a').points, -50);
});

test('a broken formula says so and earns nothing', () => {
	const broken = [
		{ id: 'nan', level: 'match', calc: () => 1 / 0 },
		{ id: 'nothing', level: 'match', calc: () => undefined },
		{ id: 'throws', level: 'match', calc: (d) => d.no.such.thing },
		{ id: 'fine', level: 'match', calc: () => 5 }
	];
	const r = TDCPoints.calculate(fiveFour(), broken);
	assert.equal(pointsOf(r, 'a').points, 5);
	assert.equal(r.warnings.filter((w) => w.includes('Alice')).length, 3);
});

test('bad formulas and stale saved weights are reported', () => {
	const r = TDCPoints.calculate(fiveFour(), [
		{ id: 'x', level: 'decade', calc: () => 1 },
		{ id: 'x', level: 'match', who: 'mascot', weights: { n: { value: 2 } }, calc: () => 1 }
	], { formulas: { gone: { n: 1 }, x: { old: 1, n: 'lots' } }, settings: { social_cap: 'many' } });
	const text = r.warnings.join(' | ');
	for (const part of ['unknown level', 'share this id', 'unknown who', 'gone: saved', 'x.old: saved', 'x.n: the saved value', 'social_cap']) {
		assert.ok(text.includes(part), 'expected a warning about ' + part + ': ' + text);
	}
});

test('a director\'s score decides the match; the frames stay as played', () => {
	const s = {
		match: { kind: 'tournament', override: { home: 5, away: 0 } },
		people: [alice, bob],
		frames: [frame(1, 'away')]
	};
	const d = TDCPoints.viewFor(TDCPoints.fillScenario(s).people[0], TDCPoints.fillScenario(s));
	assert.equal(d.match.won, true);
	assert.equal(d.match.overridden, true);
	assert.equal(d.match.side_frames_won, 5);
	assert.equal(d.match.my_frames_lost, 1);
});

test('only complete frames count; the score going in is the story so far', () => {
	const seen = [];
	const s = {
		match: { kind: 'social' },
		people: [alice, bob],
		frames: [frame(1, 'away'), frame(2, 'away'), frame(3, null, { status: 'abandoned' }), frame(4, 'home')]
	};
	TDCPoints.calculate(s, [{ id: 'f', level: 'frame', who: 'captain', calc: () => 0 }, {
		id: 'seen', level: 'frame', calc: (d) => { if (d.me.side === 'home') seen.push([d.frame.frame_no, d.frame.my_score_before, d.frame.opp_score_before]); return 0; }
	}]);
	assert.deepEqual(seen, [[1, 0, 0], [2, 0, 1], [4, 0, 2]]);
});

test('every data point listed exists on what a formula sees', () => {
	const scenario = TDCPoints.fillScenario({
		match: { kind: 'tournament' },
		tournament: {},
		league: {},
		people: [alice],
		frames: [frame(1, 'home')]
	});
	const person = scenario.people[0];
	const d = TDCPoints.viewFor(person, scenario);
	d.frame = TDCPoints.frameView(person, scenario.frames[0], { home: 0, away: 0 });
	for (const [group, entries] of Object.entries(TDCPoints.DATA)) {
		for (const [path] of entries) {
			assert.ok(path.startsWith(group + '.'), path + ' sits under ' + group);
			assert.notEqual(TDCPoints.read(d, path), undefined, path + ' is missing from viewFor');
		}
	}
});

test('the score entry setting is a number too, and every setting is readable', () => {
	const view = (rules) => {
		const s = TDCPoints.fillScenario({ rules, people: [alice] });
		return TDCPoints.viewFor(s.people[0], s);
	};
	assert.equal(view({ score_entry_mode: 'scorer' }).match.score_entry_rank, 30);
	assert.equal(view({ score_entry_mode: 'players' }).match.score_entry_rank, 0);
	assert.equal(view({}).match.score_entry_rank, null);
	assert.equal(view({ rotation: [[1]] }).match.rotation_custom, true);
	assert.equal(view({ rotation: null }).match.rotation_custom, false);
	assert.equal(view({ score_entry_mode: 'scorer' }).rules.score_entry_mode, 'scorer');
});

test('a real frame row becomes a scenario frame, with the design\'s times', () => {
	const f = TDCPoints.frameFromRow({
		id: 'x', frame_no: 3, status: 'complete', winner_side: 'home', result_event: 'win',
		break_side: 'away', break_side_manual: false, break_outcome: 'dry',
		rack_started_at: '2026-11-05T10:00:00Z', started_at: '2026-11-05T10:01:30Z', ended_at: '2026-11-05T10:11:30Z',
		paused_seconds: 60, lineup_slot: null, referee_player_id: null
	}, [{ player_id: 'a', side: 'home' }, { player_id: 'b', side: 'away' }]);
	assert.equal(f.frame_seconds, 540);
	assert.equal(f.racking_seconds, 90);
	assert.deepEqual(f.players, { home: ['a'], away: ['b'] });
	const bare = TDCPoints.frameFromRow({ frame_no: 1, status: 'complete' });
	assert.equal(bare.frame_seconds, null);
	assert.equal(bare.racking_seconds, null);
	assert.equal(bare.players, null);
});

test('a career is counted from frames', () => {
	const h = TDCPoints.historyFromFrames([
		{ side: 'home', frame: frame(1, 'home', { result_event: 'break_and_finish', break_side: 'home', break_outcome: 'in', frame_seconds: 120 }) },
		{ side: 'home', frame: frame(2, 'away', { break_side: 'home', break_outcome: 'dry', frame_seconds: 360 }) },
		{ side: 'away', frame: frame(3, 'away', { result_event: 'golden_break' }) },
		{ side: 'home', frame: frame(4, null, { status: 'abandoned' }) }
	]);
	assert.equal(h.frames, 3);
	assert.equal(h.frames_won, 2);
	assert.equal(h.frames_lost, 1);
	assert.equal(h.bf, 1);
	assert.equal(h.golden, 1);
	assert.equal(h.breaks, 2);
	assert.equal(h.break_in, 1);
	assert.equal(h.break_dry, 1);
	assert.equal(h.avg_frame_minutes, 4, 'a frame with no time is left out of the average');
	assert.equal(h.avg_racking_minutes, null);
});

test('a history is filled in with its difference and percentage', () => {
	const s = TDCPoints.fillScenario({ people: [Object.assign({}, alice, { history: { frames: 95, frames_won: 40, frames_lost: 55 } })] });
	assert.equal(s.people[0].history.frame_diff, -15);
	assert.equal(Math.round(s.people[0].history.win_pct), 42);
});

test('the formula list is well formed, and each has a stream', () => {
	assert.deepEqual(TDCPoints.checkFormulas(TDCPoints.FORMULAS), []);
	for (const f of TDCPoints.FORMULAS) assert.ok(f.stream, f.id + ' has no stream');
});

test('every built-in scenario runs with no warnings, and its edits exist', () => {
	for (const s of TDCPoints.SCENARIOS) {
		assert.deepEqual(TDCPoints.calculate(s).warnings, [], s.id);
		for (const e of s.edit) assert.notEqual(TDCPoints.read(s.people[0], e.path), undefined, e.path);
	}
});

test('a formula\'s parts add up to its amount', () => {
	const half = { has_picture: true, sign_in_methods: 1 };
	const r = TDCPoints.calculate({ people: [Object.assign({}, alice, { profile: half })] });
	for (const line of r.people[0].lines.filter((l) => l.parts)) {
		assert.equal(line.parts.reduce((sum, p) => sum + p.amount, 0), line.amount, line.formula);
	}
});

// UV's profile completeness: each value in 0 to 1, added, then multiplied.
const profile = (fields, weights) => {
	const person = Object.assign({}, alice, { profile: fields });
	const line = TDCPoints.calculate({ people: [person] }, TDCPoints.FORMULAS, weights).people[0].lines.find((l) => l.formula === 'profile_completeness');
	return line.amount;
};
const complete = TDCPoints.SCENARIOS.find((s) => s.id === 'profile_complete').people[0].profile;

test('a scenario\'s steps name weights that exist', () => {
	for (const s of TDCPoints.SCENARIOS) {
		for (const e of s.edit.filter((item) => item.weight)) {
			const f = TDCPoints.FORMULAS.find((x) => x.id === e.formula);
			assert.ok(f && f.weights[e.weight], e.formula + '.' + e.weight);
		}
	}
});

test('every weight\'s low is within its range and not above its high', () => {
	for (const f of TDCPoints.FORMULAS) {
		for (const [key, w] of Object.entries(f.weights || {})) {
			const low = w.low ?? w.value;
			assert.ok(low <= w.value && low >= w.min && w.value <= w.max, f.id + '.' + key);
		}
	}
});

test('profile completeness: the steps add up, then multiply; sign-in methods starts at nothing', () => {
	assert.equal(profile(complete), 50);
	assert.equal(profile({}), 0);
	assert.equal(profile(Object.assign({}, complete, { has_picture: false })), 40);
	assert.equal(profile(Object.assign({}, complete, { sign_in_methods: 0 })), 50, 'no influence');
});

test('profile completeness: given a weight, one of two sign-in methods is worth half, and more do not overpay', () => {
	const on = { formulas: { profile_completeness: { sign_in: 1 } } };
	assert.equal(profile(Object.assign({}, complete, { sign_in_methods: 1 }), on), 55);
	assert.equal(profile(Object.assign({}, complete, { sign_in_methods: 5 }), on), 60);
});

test('profile completeness: each slider moves only its own value, the multiplier all of them', () => {
	const weights = (w) => ({ formulas: { profile_completeness: w } });
	assert.equal(profile(complete, weights({ id_verified: 0.5 })), 45);
	assert.equal(profile(complete, weights({ multiplier: 2 })), 10);
	assert.equal(profile(complete, weights({ picture: 0, multiplier: 1 })), 4);
});

test('profile completeness is for everyone, officials too', () => {
	const official = { id: 't', name: 'Tess', roles: { td: true }, profile: complete };
	assert.equal(pointsOf(TDCPoints.calculate({ people: [official] }), 't').points, 50);
});

test('an ID verified is one bonus and carries into nothing else', () => {
	const noId = Object.assign({}, complete, { id_verified: false });
	const formulas = [TDCPoints.FORMULAS.find((f) => f.id === 'profile_completeness'), { id: 'm', level: 'match', calc: () => 100 }, { id: 'f', level: 'frame', calc: () => 1 }];
	const scenario = (profileFields) => Object.assign(fiveFour(), { people: [Object.assign({}, alice, { profile: profileFields })] });
	const withId = pointsOf(TDCPoints.calculate(scenario(complete), formulas), 'a');
	const without = pointsOf(TDCPoints.calculate(scenario(noId), formulas), 'a');
	assert.equal(withId.points, 50 + 100 + 9);
	assert.equal(without.points, 40 + 100 + 9, 'only its own 10 goes');
});

test('no data point is listed twice', () => {
	const paths = Object.values(TDCPoints.DATA).flat().map(([path]) => path);
	assert.deepEqual(paths.filter((path, i) => paths.indexOf(path) !== i), []);
});
