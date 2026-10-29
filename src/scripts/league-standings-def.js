// The standings' arithmetic (UV, 29 Oct; docs/design/leagues.md §6), shared
// by the Standings tab (league-standings.js) and the columns builder on the
// Settings tab (league-standings-edit.js).
//
// A column's equation is a token array, built from buttons:
//   [{t:'var', v:'frames_won'}, {t:'op', v:'/'}, {t:'var', v:'frames_played'},
//    {t:'op', v:'*'}, {t:'num', v:100}]
// with {t:'paren', v:'('} and ')' for brackets. It is worked out here by
// walking the tokens (shunting-yard into reverse Polish, then a stack), never
// with eval or Function: the tokens can only say what the buttons say. The
// database decides what may be stored (private.tdc_standing_equation_problem);
// what() below mirrors it only so the builder can grey out the buttons that
// would make a bad one.
//
// The counts come from tdc_league_standings, one per value of
// private.tdc_standing_vars, which is also where the buttons' words are.
//
// Needs: nothing.

const TDCStandings = (() => {
	// Precedence and the sign shown for each operator.
	const OPS = {
		'+': { rank: 1, sign: '+', run: (a, b) => a + b },
		'-': { rank: 1, sign: '−', run: (a, b) => a - b },
		'*': { rank: 2, sign: '×', run: (a, b) => a * b },
		'/': { rank: 2, sign: '÷', run: (a, b) => (b === 0 ? null : a / b) }
	};

	const isOpen = (t) => t.t === 'paren' && t.v === '(';
	const isClose = (t) => t.t === 'paren' && t.v === ')';

	// Where a token list stands: whether the next button is a value (a value,
	// a number or "(") or an operator (an operator or ")"), how many brackets
	// are open, and what is wrong with it as it is (null when it could be
	// confirmed). The same rules as the database's.
	function what(tokens) {
		let wantValue = true;
		let depth = 0;
		for (const t of tokens) {
			if (t.t === 'var' || t.t === 'num') wantValue = false;
			else if (t.t === 'op') wantValue = true;
			else if (isOpen(t)) depth++;
			else if (isClose(t)) depth--;
		}
		let problem = null;
		if (!tokens.length) problem = 'Press a value to start the equation.';
		else if (tokens.length > 40) problem = 'An equation can have at most 40 parts.';
		else if (wantValue) problem = 'The equation ends on an operator. Finish it with a value.';
		else if (depth > 0) problem = 'A bracket is still open. Close it before adding the column.';
		return { wantValue, depth, problem };
	}

	// The number an equation comes to for one row's counts, or null when it
	// cannot be worked out (a division by zero, a count the row does not have).
	function evaluate(tokens, stats) {
		const out = [];
		const stack = [];
		for (const t of tokens || []) {
			if (t.t === 'var' || t.t === 'num') out.push(t);
			else if (t.t === 'op') {
				while (stack.length && stack[stack.length - 1].t === 'op'
					&& OPS[stack[stack.length - 1].v].rank >= OPS[t.v].rank) out.push(stack.pop());
				stack.push(t);
			} else if (isOpen(t)) stack.push(t);
			else if (isClose(t)) {
				while (stack.length && !isOpen(stack[stack.length - 1])) out.push(stack.pop());
				stack.pop();
			}
		}
		while (stack.length) out.push(stack.pop());

		const vals = [];
		for (const t of out) {
			if (t.t === 'num') vals.push(Number(t.v));
			else if (t.t === 'var') {
				const n = stats ? Number(stats[t.v]) : NaN;
				vals.push(Number.isFinite(n) ? n : null);
			} else {
				const b = vals.pop();
				const a = vals.pop();
				vals.push(a === null || b === null || a === undefined || b === undefined ? null : OPS[t.v].run(a, b));
			}
		}
		const v = vals.length === 1 ? vals[0] : null;
		return Number.isFinite(v) ? v : null;
	}

	// The equation in words: "Frames won ÷ Frames played × 100".
	function words(tokens, labels) {
		return (tokens || []).map((t) => {
			if (t.t === 'var') return labels.get(t.v) || t.v;
			if (t.t === 'op') return OPS[t.v] ? OPS[t.v].sign : t.v;
			return String(t.v);
		}).join(' ');
	}

	const sign = (op) => (OPS[op] ? OPS[op].sign : op);

	// Rounded to the column's places, which is also what is compared when
	// ranking: two players both shown as 67 are level.
	function rounded(v, decimals) {
		if (v === null) return null;
		const f = Math.pow(10, decimals || 0);
		return Math.round(v * f) / f;
	}
	function shown(v, decimals) {
		return v === null ? '–' : v.toFixed(decimals || 0);
	}

	// rows: [{ stats, name }]. Works out every column for every row
	// (row.values, by column id), sorts them by the ranking columns
	// (priority 1 first; a value that cannot be worked out last) and gives
	// each its place (row.rank), level rows sharing it: 1, 2, 2, 4. With no
	// ranking column every rank is null and the rows are in name order.
	// Returns a new array.
	function rank(rows, columns) {
		const by = columns.filter((c) => c.rank_priority).sort((a, b) => a.rank_priority - b.rank_priority);
		const list = rows.map((r) => {
			const values = {};
			for (const c of columns) values[c.id] = rounded(evaluate(c.equation, r.stats), c.decimals);
			return Object.assign({}, r, { values });
		});
		const compare = (a, b) => {
			for (const c of by) {
				const x = a.values[c.id];
				const y = b.values[c.id];
				if (x === y) continue;
				if (x === null) return 1;
				if (y === null) return -1;
				return c.higher_first ? y - x : x - y;
			}
			return 0;
		};
		list.sort((a, b) => compare(a, b) || String(a.name).localeCompare(String(b.name)));
		list.forEach((r, i) => {
			r.rank = !by.length ? null : (i > 0 && compare(list[i - 1], r) === 0 ? list[i - 1].rank : i + 1);
		});
		return list;
	}

	return { OPS, what, evaluate, words, sign, shown, rank };
})();
