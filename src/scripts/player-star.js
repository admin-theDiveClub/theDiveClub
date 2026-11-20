// The player star (UV, 19 Nov; docs/design/player-star.md), defined once:
// UV's standards, the counting from a player's frames, and the drawing. Used
// by the player profile (player.js) and its sandbox (sandbox-star.js).
//
// Five spokes, each a rate: successes out of chances, measured against UV's
// standard for it, never against other players. Every player starts with
// `start` frames played exactly at the standard, so a few real frames move a
// spoke only a little:
//
//   shown = (successes + start × standard) / (chances + start)
//
// The standard is the grey ring halfway out. Ratio: shown ÷ standard, twice
// the standard at the edge. Points: shown − standard, `range` points at the
// edge (above) or the centre (below). How solid a star is follows frames
// played (a league's star: matches played out of scheduled). A spoke with no chances sits on the standard, its label greyed with
// "no data" (UV, 19 Nov). No dots at the corners: the line only (UV, 19 Nov).

const TDCStar = (() => {
	// The spokes, clockwise from the top. n and d name the counts below. The
	// standards and starting frames are UV's (19 Nov).
	// The standards and starting frames are UV's, set on the sandbox on 20 Nov
	// (Win % 67/100, Lags Won 50/20, W | Own Brk 75/100, W | Opp Brk 40/100,
	// B&F | Own Brk 7/100); Break in is the old value (50/10), now unused by any star.
	const SPOKES = [
		{ key: 'win',   label: 'Win rate',    short: 'Win',       n: 'fw',  d: 'fp', std: 67, start: 100,
			help: 'Frames won out of frames played.' },
		{ key: 'own',   label: 'Own break',   short: 'Own brk',   n: 'bw',  d: 'b',  std: 75, start: 100,
			help: 'Frames won out of the frames they broke.' },
		{ key: 'their', label: 'Their break', short: 'Their brk', n: 'obw', d: 'ob', std: 40, start: 100,
			help: 'Frames won out of the frames their opponent broke.' },
		{ key: 'in',    label: 'Break in',    short: 'Brk in',    n: 'i',   d: 'r',  std: 50, start: 10,
			help: 'Breaks with a ball in, out of their breaks with a result recorded.' },
		{ key: 'bf',    label: 'B&F',         short: 'B&F',       n: 'bf',  d: 'b',  std: 7, start: 100,
			help: 'Break & finish or golden break, out of the frames they broke.' }
	];

	// The league star's five spokes (UV, 20 Nov), counted from who broke and who
	// won alone, so every league can draw them. Win rate, Own break, Their break
	// and B&F are the same spokes as above; Lags won replaces Break in. A "lag
	// won" is a frame they broke, so Own break is frames won out of lags won and
	// Their break frames won out of lags lost. The standard is UV's, 50% for Lags
	// won (UV, 20 Nov), set on the sandbox with the others.
	const LAG = { key: 'lag', label: 'Lags won', short: 'Lags won', n: 'b', d: 'fp', std: 50, start: 20,
		help: 'Frames they broke (lags won) out of frames played.' };
	// Its labels read as the question each answers (UV, 20 Nov): the player's
	// win rate, lags won, then wins given who broke, then B&F given their break.
	const LEAGUE_SPOKES = [
		Object.assign({}, SPOKES[0], { short: 'Win %' }),
		Object.assign({}, LAG, { short: 'Lags Won' }),
		Object.assign({}, SPOKES[1], { short: 'W | Own Brk' }),
		Object.assign({}, SPOKES[2], { short: 'W | Opp Brk' }),
		Object.assign({}, SPOKES[4], { short: 'B&F | Own Brk' })
	];
	// Every spoke either star uses, once each: what the sandbox sets standards for.
	const EVERY = [SPOKES[0], LAG, SPOKES[1], SPOKES[2], SPOKES[3], SPOKES[4]];

	// A fresh copy of UV's settings; the sandbox changes its own. startAll gives
	// one starting-frames number to every spoke (the league star gives 0).
	function defaults(startAll) {
		return {
			std: Object.fromEntries(EVERY.map((s) => [s.key, s.std])),
			start: Object.fromEntries(EVERY.map((s) => [s.key, startAll === undefined ? s.start : startAll])),
			solid: 200,
			mode: 'ratio',
			range: 25,
			walkovers: false
		};
	}

	// The counts from tdc_player_profile's frames (finished frames of finished
	// matches; the caller picks the period). broke is null where breaks were
	// not tracked: those frames count for the win rate only. break_outcome
	// (migration 20261119142114) is the breaker's, so it counts on their own
	// breaks only. A walkover ('default') is left out unless asked for.
	function count(frames, walkovers) {
		const c = { fp: 0, fw: 0, b: 0, bw: 0, ob: 0, obw: 0, r: 0, i: 0, bf: 0 };
		for (const f of frames) {
			if (f.result_event === 'default' && !walkovers) continue;
			c.fp++;
			if (f.won) c.fw++;
			if (f.broke === true) {
				c.b++;
				if (f.won) c.bw++;
				if (f.won && (f.result_event === 'break_and_finish' || f.result_event === 'golden_break')) c.bf++;
				if (f.break_outcome) { c.r++; if (f.break_outcome === 'in') c.i++; }
			} else if (f.broke === false) {
				c.ob++;
				if (f.won) c.obw++;
			}
		}
		return c;
	}

	// ─── A league's star (UV, 19 Nov; reworked 20 Nov) ───
	// One player's frames in one league season, on the league spokes. Three
	// lines: the grey pentagon is UV's standards (the sandbox's), the yellow line
	// the league's own average, the green shape the player's current stats, from
	// their frames alone with no starting frames (UV: the league is where you feel
	// the heat, so it is not softened as the player profile is). How solid it is
	// follows matches played out of matches scheduled.

	// The settings for a league's star: UV's standards, no starting frames. avg
	// is the league's pooled counts (tdc_league_star_average), the yellow line;
	// scheduled is how many matches the team has (its fixtures with an opponent,
	// byes left out), read from the made schedule. error is set when either could
	// not be read (the caller says so).
	async function leagueSettings(client, seasonId, teamId) {
		const set = defaults(0);
		const [avg, fixtures] = await Promise.all([
			client.rpc('tdc_league_star_average', { p_league_season_id: seasonId }),
			teamId
				? client.from('tbl_league_fixtures').select('id')
					.eq('league_season_id', seasonId).not('away_team_id', 'is', null)
					.or('home_team_id.eq.' + teamId + ',away_team_id.eq.' + teamId)
				: Promise.resolve({ data: [] })
		]);
		if (avg.error) return { set, error: avg.error };
		if (fixtures.error) return { set, error: fixtures.error };
		return { set, avg: avg.data, scheduled: fixtures.data.length };
	}

	// Every counted frame of a profile (tdc_player_profile): finished, singles
	// matches only, as the profile counts them. For the star on the home page.
	function allFrames(profile) {
		const ids = new Set(profile.matches.filter((m) => m.status === 'complete' && !m.doubles).map((m) => m.match_id));
		return profile.frames.filter((f) => ids.has(f.match_id));
	}

	// A profile's counted frames in one league season: finished matches of that
	// season, doubles left out (as the profile counts).
	function leagueMatchIds(profile, seasonId) {
		return new Set(profile.matches
			.filter((m) => m.league_season_id === seasonId && m.status === 'complete' && !m.doubles)
			.map((m) => m.match_id));
	}
	function leagueFrames(profile, seasonId) {
		const ids = leagueMatchIds(profile, seasonId);
		return profile.frames.filter((f) => ids.has(f.match_id));
	}

	// How solid a league's star is (UV, 19 Nov): the player's matches played out
	// of the matches their team has scheduled, not frames out of `solid`.
	// undefined with no schedule, so the star falls back to frames.
	function leagueSolid(profile, seasonId, scheduled) {
		if (!scheduled) return undefined;
		return Math.min(1, leagueMatchIds(profile, seasonId).size / scheduled);
	}

	// One spoke from the counts: the raw and shown rates (0–1), or null with no chances.
	function spoke(c, s, set) {
		const d = Number(c[s.d]) || 0;
		const had = Number(c[s.n]) || 0;
		if (d <= 0) return null;
		const n = Math.min(had, d);
		const std = set.std[s.key] / 100;
		const start = set.start[s.key];
		return { raw: n / d, shown: (n + start * std) / (d + start), n, d, over: had > d };
	}

	// How far out a rate is drawn, 0 (centre) to 1 (edge); the standard is 0.5.
	function reach(rate, s, set) {
		const std = set.std[s.key] / 100;
		const r = set.mode === 'ratio'
			? (std > 0 ? 0.5 * rate / std : (rate > 0 ? 1 : 0.5))
			: 0.5 + 0.5 * (rate - std) * 100 / set.range;
		return Math.max(0, Math.min(1, r));
	}

	// ─── Drawing ───

	const SVG = 'http://www.w3.org/2000/svg';
	const R = 82;
	const svgEl = (name, attrs) => {
		const e = document.createElementNS(SVG, name);
		for (const k in attrs) e.setAttribute(k, attrs[k]);
		return e;
	};
	// Each drawing function takes the list of spokes to draw (sp): the player
	// star's five, or the league star's.
	const angle = (i, n) => -Math.PI / 2 + i * 2 * Math.PI / n;
	const at = (i, r, n) => [Math.cos(angle(i, n)) * r * R, Math.sin(angle(i, n)) * r * R];
	const ring = (r, sp) => sp.map((s, i) => at(i, r, sp.length).join(',')).join(' ');

	// A label too long for one line is wrapped at its bar (UV, 20 Nov): "W | Own Brk"
	// becomes "W |" over "Own Brk", so the longest line is short and the star can
	// take more of the picture. A label's lines, the numbers and "no data" all go
	// through setLines, which centres the block on the label's place.
	const wrap = (short) => {
		const i = short.indexOf(' | ');
		return i < 0 ? [short] : [short.slice(0, i + 2), short.slice(i + 3)];
	};
	function setLines(t, lines) {
		const x = t.getAttribute('x');
		t.textContent = '';
		lines.forEach((line, i) => {
			const dy = (i === 0 ? -(lines.length - 1) * 0.6 : 1.2) + 'em';
			// { x, nodes }: a line centred on its own x (the player star's two lines of
			// numbers, so the adjusted ones sit centred under the actual ones).
			const ts = Array.isArray(line) || typeof line === 'string'
				? svgEl('tspan', { x, dy })
				: svgEl('tspan', { x: line.x, dy, 'text-anchor': 'middle' });
			if (typeof line === 'string') ts.textContent = line;
			else ts.append(...(Array.isArray(line) ? line : line.nodes));
			t.append(ts);
		});
	}

	// The frame: the edge, the standard ring, the axes and their labels.
	function frame(label, sp, extraWide, bare, tall) {
		// Wide enough for the longest line of a label, which sits to one side of the
		// star; the usual width unless a line is long.
		const longest = Math.max(...sp.flatMap((s) => wrap(s.short)).map((l) => l.length), extraWide || 0);
		// A side label starts about 93 out from the middle and runs outward, about 5.8
		// a character; the picture is as wide as its longest line needs, and no less
		// than the star (UV, 20 Nov: text was running outside the card).
		const half = Math.max(130, Math.ceil(97 + 5.8 * longest));
		// A bare star (UV, 20 Nov: a league on one player's side of Compare, in a half
		// too narrow to read labels) has no labels, so the picture is trimmed to the star.
		const svg = svgEl('svg', { viewBox: bare ? '-92 -92 184 184' : (tall ? `${-half} -134 ${2 * half} 252` : `${-half} -118 ${2 * half} 236`), class: 'star-svg' + (bare ? ' star-bare' : ''), role: 'img' });
		svg.setAttribute('aria-label', label);
		svg.append(svgEl('polygon', { points: ring(1, sp), class: 'star-edge' }));
		svg.append(svgEl('polygon', { points: ring(0.5, sp), class: 'star-std' }));
		sp.forEach((s, i) => {
			const [x, y] = at(i, 1, sp.length);
			svg.append(svgEl('line', { x1: 0, y1: 0, x2: x, y2: y, class: 'star-axis' }));
			if (bare) return;
			const [lx, ly0] = at(i, 1.2, sp.length);
			// With two lines of numbers (a player star) the top label is raised so its
			// last line clears the star's tip.
			const ly = tall && Math.abs(lx) < 4 && ly0 < 0 ? ly0 - 16 : ly0;
			const t = svgEl('text', {
				x: lx, y: ly, class: 'star-label', 'data-spoke': s.key,
				'text-anchor': Math.abs(lx) < 4 ? 'middle' : (lx > 0 ? 'start' : 'end'),
				'dominant-baseline': 'middle'
			});
			svg.append(t);
			setLines(t, wrap(s.short));
		});
		return svg;
	}

	// One player's star on a frame, in a group of its own (cls colours it).
	// raw adds the dashed star of their frames alone, with no starting frames.
	function layer(svg, c, set, opts, sp) {
		const o = opts || {};
		sp = sp || SPOKES;
		const g = svgEl('g', { class: o.cls || '' });
		svg.append(g);
		const rows = sp.map((s) => spoke(c, s, set));
		const shape = (pick) => rows.map((v, i) => at(i, v ? reach(pick(v), sp[i], set) : 0.5, sp.length).join(',')).join(' ');
		const certain = o.certain !== undefined ? o.certain : Math.min(1, (Number(c.fp) || 0) / set.solid);
		// A dashed layer is the line alone, solid cream (UV, 20 Nov: the viewer's
		// line on Compare's shared league star), with no fill. (Swapped on 20 Nov: the cream line
		// is now the other player, the viewer is the green shape.) (It was dashed, in
		// the raw star's style, until UV asked for a solid line.)
		if (o.dashed) {
			g.append(svgEl('polygon', { points: shape((v) => v.shown), class: 'star-me' }));
			// Its raw star too, dashed, in the same cream (UV, 20 Nov: Compare's star).
			if (o.raw) g.append(svgEl('polygon', { points: shape((v) => v.raw), class: 'star-raw' }));
			return { rows, certain };
		}
		const shown = svgEl('polygon', { points: shape((v) => v.shown), class: 'star-shown' });
		shown.style.fillOpacity = (0.08 + 0.42 * certain).toFixed(2);
		shown.style.strokeOpacity = (0.35 + 0.65 * certain).toFixed(2);
		g.append(shown);
		if (o.raw) g.append(svgEl('polygon', { points: shape((v) => v.raw), class: 'star-raw' }));
		// The league's average (UV, 20 Nov): the pooled counts as plain rates, a
		// yellow line. A spoke the league has no chances for sits on the standard.
		if (o.avg) {
			const a = sp.map((s) => spoke(o.avg, s, set));
			g.append(svgEl('polygon', {
				points: a.map((v, i) => at(i, v ? reach(v.raw, sp[i], set) : 0.5, sp.length).join(',')).join(' '),
				class: 'star-avg'
			}));
		}
		return { rows, certain };
	}

	// A spoke no layer has data for: its label greyed, "no data" under it.
	function markNoData(svg, rowsList, sp) {
		(sp || SPOKES).forEach((s, i) => {
			if (rowsList.some((rows) => rows[i])) return;
			const t = svg.querySelector(`[data-spoke="${s.key}"]`);
			t.classList.add('star-nodata');
			setLines(t, [...wrap(s.short), 'no data']);
		});
	}

	// The numbers under each label of a league star (UV, 20 Nov): the player's
	// stat in green, a bar, the league's average in yellow, each a whole number
	// with a % sign (UV, 20 Nov: first without, then with). A spoke the player has no data for gets none
	// (markNoData says so instead); one the league has no data for shows a dash.
	// With a dashed (solid cream) layer too (Compare's shared league star): the
	// green number, then the cream, then the league's: yours | theirs | the league's.
	function markNumbers(svg, out, layers, set, sp) {
		const main = layers.findIndex((l) => l.avg);
		const you = layers.findIndex((l) => l.dashed);
		const avg = layers[main].avg;
		const pct = (v, key) => (v ? Math.round(v[key] * 100) + '%' : '–');
		sp.forEach((s, i) => {
			const v = out[main].rows[i];
			const w = you >= 0 ? out[you].rows[i] : null;
			if (!v && !w) return;
			const a = spoke(avg, s, set);
			const t = svg.querySelector(`[data-spoke="${s.key}"]`);
			const part = (cls, text) => {
				const n = svgEl('tspan', { class: cls });
				n.textContent = text;
				return n;
			};
			const sep = () => part('star-num-sep', ' | ');
			const nums = [part('star-num-p', pct(v, 'shown')), sep()];
			if (you >= 0) nums.push(part('star-num-me', pct(w, 'shown')), sep());
			nums.push(part('star-num-a', pct(a, 'raw')));
			setLines(t, [...wrap(s.short), nums]);
		});
	}

	// The numbers under each label of a player star (UV, 20 Nov), in the players'
	// colours: a line of their own stats, then a line of the adjusted ones (with the
	// starting frames), each "you | them" on Compare and a single number on a
	// profile. The first layer is green (you) unless its cls is star-cream; a dashed
	// layer is the other player, cream.
	function markStats(svg, out, layers, sp) {
		const tone = (l) => (l.dashed || (l.cls && l.cls.indexOf('star-cream') >= 0) ? 'star-num-me' : 'star-num-p');
		const part = (cls, text) => {
			const n = svgEl('tspan', { class: cls });
			n.textContent = text;
			return n;
		};
		const pct = (v, key) => (v ? Math.round(v[key] * 100) + '%' : '–');
		sp.forEach((s, i) => {
			const rows = out.map((o) => o.rows[i]);
			if (!rows.some(Boolean)) return;
			const t = svg.querySelector(`[data-spoke="${s.key}"]`);
			// The adjusted line is smaller and grey (UV, 20 Nov), the players' own in colour.
			const line = (key, adjusted) => {
				const nodes = [];
				layers.forEach((l, k) => {
					if (k) nodes.push(part(adjusted ? 'star-num-adj' : 'star-num-sep', ' | '));
					nodes.push(part(adjusted ? 'star-num-adj' : tone(l), pct(rows[k], key)));
				});
				return nodes;
			};
			// Both number lines are centred on the middle of the actual one, which
			// starts at the label's edge (or ends at it, on the left): its width is
			// estimated at about 5.9 a character.
			const actual = line('raw'), adjusted = line('shown', true);
			const lx = parseFloat(t.getAttribute('x'));
			const anchor = t.getAttribute('text-anchor');
			const width = actual.reduce((n, p) => n + p.textContent.length, 0) * 5.9;
			const cx = anchor === 'start' ? lx + width / 2 : anchor === 'end' ? lx - width / 2 : lx;
			setLines(t, [...wrap(s.short), { x: cx, nodes: actual }, { x: cx, nodes: adjusted }]);
		});
	}

	// A player's star, ready to place: frames in, an <svg> out.
	// opts.bare: the star alone, with no labels or numbers.
	function draw(label, layers, set, spokes, opts) {
		const sp = spokes || SPOKES;
		const bare = !!(opts && opts.bare);
		// Three numbers under a label (a shared league star) are wider than the labels.
		const stats = !!(opts && opts.stats);
		const svg = frame(label, sp, stats ? (layers.length > 1 ? 10 : 4) : (layers.some((l) => l.dashed) && layers.some((l) => l.avg) ? 15 : 0), bare, stats);
		const out = layers.map((l) => layer(svg, l.counts, set, l, sp));
		const league = layers.findIndex((l) => l.avg);
		if (!bare) {
			if (league >= 0) markNumbers(svg, out, layers, set, sp);
			else if (stats) markStats(svg, out, layers, sp);
			markNoData(svg, out.map((x) => x.rows), sp);
		}
		return { svg, layers: out };
	}

	return { SPOKES, LEAGUE_SPOKES, EVERY, defaults, leagueSettings, leagueFrames, leagueSolid, allFrames, count, spoke, reach, frame, layer, markNoData, draw };
})();
