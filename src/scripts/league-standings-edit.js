// The standings columns, on the Settings tab (UV, 29 Oct;
// docs/design/leagues.md §6). Started by league-settings.js once it knows
// the person runs the league.
//
// A pill picks the table (Individual or Team Rankings). Its columns are a
// table of three rows, one column of it per standings column, left to
// right as the Standings tab shows them:
//   1. move left, remove (red cross), move right: ring icon buttons
//   2. the name, its equation in words under it
//   3. its rank order, a stepper: 1 decides the order, 2 settles a tie…,
//      0 not used. Saved 0.7 s after the last step (POS_SAVE_MS), so
//      stepping 0 to 3 is one save, not three swaps on the way.
// "Put the default columns back" resets that table.
//
// Below, a new column: a name, then the equation from buttons only, one
// per value (tdc_standing_variables, the database's own list), one per
// operator, brackets, and a number typed into its box and added. The
// buttons that would make a bad equation are greyed (TDCStandings.what),
// so only a good one can be built; the database checks it again and is
// the guard (private.tdc_standing_equation_problem, the name once per
// table, the equation once). Never a string, never eval.
//
// Every change goes through the page's writer and is read again after.
//
// Needs: tdc.js, ring-status.js, league-standings-def.js.

const TDCStandingsEdit = (() => {
	const AREA = 'Standings columns';
	const S = TDCStandings;
	const RANK_SAVE_MS = 700;

	function start(seasonId) {
		const el = (id) => document.getElementById(id);
		const els = {
			section: el('sc-edit'), views: el('sc-views'), cols: el('sc-cols'), reset: el('sc-reset'),
			name: el('sc-name'), vars: el('sc-vars'), ops: el('sc-ops'), num: el('sc-num'), numAdd: el('sc-num-add'),
			eq: el('sc-eq'), undo: el('sc-undo'), clear: el('sc-clear'),
			decimals: el('sc-decimals'), higher: el('sc-higher'), add: el('sc-add'), status: el('sc-status')
		};
		const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
		if (missing.length) {
			TDC.error(AREA, 'the settings page is missing expected elements: ' + missing.join(', '));
			return Promise.resolve(false);
		}

		// ─── State ───
		let scope = 'player';
		let columns = [];          // every column of the season, both tables
		let vars = [];             // tdc_standing_variables
		let tokens = [];           // the new column's equation so far
		const rankSaves = new Map();
		const iconsSeen = new Set();

		const node = (tag, cls, text) => {
			const n = document.createElement(tag);
			if (cls) n.className = cls;
			if (text !== undefined) n.textContent = text;
			return n;
		};
		const mine = () => columns.filter((c) => c.scope === scope).sort((a, b) => a.position - b.position);
		const labels = () => new Map(vars.filter((v) => v.scope === scope).map((v) => [v.key, v.label]));
		const tableName = () => (scope === 'player' ? 'Individual Rankings' : 'Team Rankings');

		const { write } = TDC.writer({ area: AREA, status: els.status, reload: () => load() });

		// ─── Icon buttons (as the fixtures page's, .fx-icon) ───
		function iconButton(icon, label, tone, col, act) {
			const b = node('button', 'fx-icon' + (tone ? ' fx-icon-' + tone : ''));
			b.type = 'button';
			b.title = label;
			b.setAttribute('aria-label', label);
			Object.assign(b.dataset, { icon, col, act });
			const face = node('span', 'tdc-ring');
			face.innerHTML = TDCRing.svg();
			b.append(face);
			return b;
		}

		function wakeIcons(root) {
			for (const b of root.querySelectorAll('.fx-icon:not([data-awake])')) {
				b.dataset.awake = 'yes';
				const icon = b.dataset.icon;
				const key = b.dataset.col + ':' + b.dataset.act;
				const seen = iconsSeen.has(key);
				iconsSeen.add(key);
				try {
					b.tdcRing = new TDCRing.RingStatus(b.querySelector('.tdc-ring'), {
						icons: [icon],
						labels: { [icon]: b.getAttribute('aria-label'), empty: b.getAttribute('aria-label'), loading: 'Working' },
						initial: seen ? icon : 'empty'
					});
				} catch (err) {
					TDC.error(AREA, 'an icon could not be drawn: ' + icon, err, els.status);
					continue;
				}
				if (!seen) b.tdcRing.drawTo(icon);
			}
		}

		// ─── The columns ───
		function renderCols() {
			const cols = mine();
			if (!cols.length) {
				els.cols.replaceChildren(node('div', 'empty',
					'No columns: ' + tableName() + ' shows only rank, picture and name. Add one below, or put the default columns back.'));
				return;
			}
			const words = labels();
			const table = node('table', 'tdc-table sc-cols');
			const body = node('tbody');
			const tools = node('tr', 'sc-tools');
			const names = node('tr', 'sc-names');
			const ranks = node('tr', 'sc-ranks');
			tools.append(node('th', 'sc-row-label', 'Move'));
			names.append(node('th', 'sc-row-label', 'Column'));
			ranks.append(node('th', 'sc-row-label', 'Rank order'));

			cols.forEach((c, i) => {
				const td = node('td');
				const row = node('div', 'sc-tool-row');
				const left = iconButton('back', 'Move ' + c.name + ' left', null, c.id, 'left');
				const del = iconButton('cross', 'Remove ' + c.name, 'danger', c.id, 'remove');
				const right = iconButton('arrow', 'Move ' + c.name + ' right', null, c.id, 'right');
				left.disabled = i === 0;
				right.disabled = i === cols.length - 1;
				row.append(left, del, right);
				td.append(row);
				tools.append(td);

				const th = node('th', 'sc-name', c.name);
				th.append(node('span', 'sub', S.words(c.equation, words)
					+ (c.decimals ? ' · ' + c.decimals + ' dp' : '')
					+ (c.higher_first ? '' : ' · lowest first')));
				names.append(th);

				const rc = node('td');
				const input = node('input');
				input.type = 'number';
				input.id = 'sc-rank-' + c.id;
				input.min = '0';
				input.max = String(Math.min(cols.length, 20));
				input.value = String(c.rank_priority || 0);
				input.inputMode = 'numeric';
				input.dataset.control = 'stepper';
				input.dataset.stepper = 'across';
				input.dataset.scRank = c.id;
				input.setAttribute('aria-label', 'Rank order of ' + c.name);
				rc.append(input);
				ranks.append(rc);
			});
			body.append(tools, names, ranks);
			table.append(body);
			els.cols.replaceChildren(table);
			wakeIcons(els.cols);
		}

		// The button standing for this one after the re-read, for the dots.
		const sameButton = (b) => () => els.cols.querySelector(
			`.fx-icon[data-col="${CSS.escape(b.dataset.col)}"][data-act="${CSS.escape(b.dataset.act)}"]`);

		els.cols.addEventListener('click', (e) => {
			const b = e.target.closest('.fx-icon[data-act]');
			if (!b || b.disabled) return;
			const col = columns.find((c) => c.id === b.dataset.col);
			if (!col) { TDC.error(AREA, 'that column is not on the page any more.', b.dataset, els.status); return; }

			if (b.dataset.act === 'remove') {
				if (!confirm(`Remove "${col.name}" from ${tableName()}?\n\nIts equation goes with it.`)) return;
				write('Removing a column', () => supabaseClient.rpc('tdc_remove_standing_column', { p_column_id: col.id }),
					() => `Removed "${col.name}".`, { dots: b, leaves: true });
				return;
			}
			const to = col.position + (b.dataset.act === 'left' ? -1 : 1);
			write('Moving a column', () => supabaseClient.rpc('tdc_move_standing_column', { p_column_id: col.id, p_position: to }),
				null, { dots: b, follow: sameButton(b), leaves: true });
		});

		// A rank order changed on its stepper: saved a moment after the last
		// step, as the fixtures' table numbers are.
		els.cols.addEventListener('change', (e) => {
			const input = e.target.closest('input[data-sc-rank]');
			if (!input) return;
			const id = input.dataset.scRank;
			const n = parseInt(input.value, 10);
			const max = parseInt(input.max, 10);
			if (isNaN(n) || n < 0 || n > max) {
				TDC.status(els.status, `A rank order is a number from 0 (not used) to ${max}.`, 'error');
				return;
			}
			clearTimeout(rankSaves.get(id));
			rankSaves.set(id, setTimeout(() => {
				rankSaves.delete(id);
				write('Saving the rank order', () => supabaseClient.rpc('tdc_set_standing_column_rank', { p_column_id: id, p_priority: n }));
			}, RANK_SAVE_MS));
		});

		els.reset.addEventListener('click', () => {
			if (!confirm(`Put the default columns back in ${tableName()}?\n\nEvery column it has now is replaced.`)) return;
			write('Putting the defaults back', () => supabaseClient.rpc('tdc_reset_standing_columns', { p_league_season_id: seasonId, p_scope: scope }),
				() => tableName() + ' has its default columns again.', { dots: els.reset, single: true });
		});

		// ─── The new column ───
		function keyButton(text, token, title) {
			const b = node('button', 'btn btn-secondary btn-sm sc-key', text);
			b.type = 'button';
			b.dataset.token = JSON.stringify(token);
			if (title) b.title = title;
			return b;
		}

		function renderKeys() {
			els.vars.replaceChildren(...vars.filter((v) => v.scope === scope)
				.map((v) => keyButton(v.label, { t: 'var', v: v.key })));
			els.ops.replaceChildren(
				...Object.keys(S.OPS).map((op) => keyButton(S.sign(op), { t: 'op', v: op })),
				keyButton('(', { t: 'paren', v: '(' }, 'Open a bracket'),
				keyButton(')', { t: 'paren', v: ')' }, 'Close a bracket')
			);
			// Bigger than the value buttons (UV, 29 Oct): a sign alone is small.
			for (const b of els.ops.children) b.classList.add('sc-op');
		}

		// Only the buttons that make a good next part are live.
		function renderDraft() {
			const st = S.what(tokens);
			const full = tokens.length >= 40;
			for (const b of els.vars.querySelectorAll('.sc-key')) b.disabled = full || !st.wantValue;
			for (const b of els.ops.querySelectorAll('.sc-key')) {
				const t = JSON.parse(b.dataset.token);
				if (t.t === 'op') b.disabled = full || st.wantValue;
				else if (t.v === '(') b.disabled = full || !st.wantValue;
				else b.disabled = st.wantValue || st.depth === 0;
			}
			els.numAdd.disabled = full || !st.wantValue;
			els.num.disabled = full || !st.wantValue;

			if (!tokens.length) {
				els.eq.replaceChildren(node('span', 'muted', 'Press a value to start.'));
			} else {
				const words = labels();
				els.eq.replaceChildren(...tokens.map((t) => node('span', 'sc-part sc-part-' + t.t,
					t.t === 'var' ? words.get(t.v) || t.v : t.t === 'op' ? S.sign(t.v) : String(t.v))));
			}
			els.undo.disabled = !tokens.length;
			els.clear.disabled = !tokens.length;
			els.add.disabled = !!st.problem || !els.name.value.trim();
		}

		function push(token) {
			tokens.push(token);
			TDC.status(els.status, '', '');
			renderDraft();
		}

		for (const box of [els.vars, els.ops]) {
			box.addEventListener('click', (e) => {
				const b = e.target.closest('.sc-key');
				if (!b || b.disabled) return;
				push(JSON.parse(b.dataset.token));
			});
		}

		function addNumber() {
			const text = els.num.value.trim().replace(',', '.');
			const n = Number(text);
			if (!text || !Number.isFinite(n) || !/^-?\d*\.?\d+$/.test(text)) {
				TDC.status(els.status, 'Type a number first, like 100 or 0.5.', 'error');
				els.num.focus();
				return;
			}
			if (Math.abs(n) > 1000000) {
				TDC.status(els.status, 'A number in an equation can be at most a million.', 'error');
				return;
			}
			els.num.value = '';
			push({ t: 'num', v: n });
		}
		els.numAdd.addEventListener('click', addNumber);
		els.num.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNumber(); } });

		els.undo.addEventListener('click', () => { tokens.pop(); renderDraft(); });
		els.clear.addEventListener('click', () => { tokens = []; renderDraft(); });
		els.name.addEventListener('input', renderDraft);

		els.add.addEventListener('click', () => {
			const name = els.name.value.trim();
			const st = S.what(tokens);
			if (!name) { TDC.status(els.status, 'The column needs a name.', 'error'); els.name.focus(); return; }
			if (st.problem) { TDC.status(els.status, st.problem, 'error'); return; }
			// Said before sending, for a clearer message; the database refuses it anyway.
			const same = mine().find((c) => c.name.toLowerCase() === name.toLowerCase());
			if (same) { TDC.status(els.status, `There is already a column called "${same.name}" in this table.`, 'error'); els.name.focus(); return; }
			const decimals = parseInt(els.decimals.value, 10);
			if (isNaN(decimals) || decimals < 0 || decimals > 3) {
				TDC.status(els.status, 'Decimal places must be 0 to 3.', 'error');
				return;
			}
			const equation = tokens.slice();
			const where = tableName();
			write('Adding a column', () => supabaseClient.rpc('tdc_add_standing_column', {
				p_league_season_id: seasonId, p_scope: scope, p_name: name, p_equation: equation,
				p_decimals: decimals, p_higher_first: els.higher.checked
			}), () => {
				tokens = [];
				els.name.value = '';
				return `Added "${name}" to ${where}. It is on the Standings tab now; give it a rank order above if it should decide the order.`;
			}, { dots: els.add, single: true });
		});

		// ─── The table chosen ───
		els.views.addEventListener('click', (e) => {
			const b = e.target.closest('[data-sc-scope]');
			if (!b || b.dataset.scScope === scope) return;
			scope = b.dataset.scScope;
			for (const v of els.views.querySelectorAll('[data-sc-scope]')) {
				v.setAttribute('aria-pressed', v.dataset.scScope === scope ? 'true' : 'false');
			}
			// The values differ between the tables, so a half-built equation goes.
			tokens = [];
			TDC.status(els.status, '', '');
			renderCols();
			renderKeys();
			renderDraft();
		});

		// ─── Reading ───
		async function load() {
			const { data, error } = await supabaseClient.from('tbl_league_standing_columns')
				.select('id, scope, position, name, equation, decimals, rank_priority, higher_first')
				.eq('league_season_id', seasonId).order('position');
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			columns = data || [];
			renderCols();
			renderDraft();
			return true;
		}

		return (async () => {
			const v = await supabaseClient.rpc('tdc_standing_variables');
			if (v.error) { TDC.showSupabaseError(AREA, v.error, els.status); return false; }
			vars = v.data || [];
			if (!vars.length) {
				TDC.error(AREA, 'the database listed no values to build a column from.', null, els.status);
				return false;
			}
			renderKeys();
			const ok = await load();
			els.section.hidden = false;
			return ok;
		})();
	}

	return { start };
})();
