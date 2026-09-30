// Project Board (/staff/board/): the owner's task list for the business and the website.
// Needs: supabaseClient.js, tdc.js (loaded by layout.html). Styles: board.css in this folder.
// Data: tbl_pm_groups, tbl_pm_people, tbl_pm_items, tbl_pm_links (migration 20260928103000_project_board).
// Only venue owners can read or change these tables; the database enforces it.
//
// How it works: loadAll() reads the whole board for the venue into `data`, render() draws it from `data` and `ui`.
// Every change is written to Supabase, then the board is reloaded. It also reloads when you come back to the tab.
//
// Views: List (grouped, nested tasks), Timeline (Gantt bars from start to due date) and Costs (itemised estimates with totals).
// Costs: each task's low–high range is its own; a parent shows its sub-tasks' costs separately. Once-off, monthly and
// yearly costs are totalled separately.
// Overdue is worked out here, not stored: a due date in the past on a task that isn't Done.
//
// Reordering: drag a task by its ⋮⋮ handle (mouse or touch) in the normal List view, or use the arrow keys on the handle.
//
// Sections: constants · state · model helpers · dates · money · rendering (list, timeline, costs) · writes · drag and drop · events · start.

(() => {
	const AREA = 'Board';

	// ─── Constants ───
	const STATUSES = [['next', 'Next'], ['progress', 'In progress'], ['todo', 'To do'], ['waiting', 'Waiting'], ['done', 'Done']];
	const STATUS_LABEL = Object.fromEntries(STATUSES);
	const STATUS_RANK = Object.fromEntries(STATUSES.map(([s], i) => [s, i]));
	const LINK_TYPES = [['waiting_on', 'Waiting on'], ['blocks', 'Blocks'], ['related', 'Related to']];
	const LINK_OUT = { waiting_on: 'Waiting on', blocks: 'Blocks', related: 'Related to' };
	const LINK_IN = { waiting_on: 'Holding up', blocks: 'Blocked by', related: 'Related to' };
	const TRACKS = { business: 'Business', website: 'Website' };
	const UI_KEY = 'tdc-board-ui';
	const DAY = 86400000;
	const ZOOMS = { week: 28, month: 10 };     // timeline pixels per day
	const END_OF_DAY = '23:59';                // a due time left blank is saved as 23:59 and shown as just the date
	const START_OF_DAY = '00:00';              // a start time left blank is saved as 00:00
	const PERIODS = [['once', 'Once-off'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
	const PERIOD_SUFFIX = { once: '', monthly: '/mo', yearly: '/yr' };

	// ─── State ───
	const root = document.getElementById('pm-board');
	const statusEl = document.getElementById('pm-status');
	let venueId = null;
	let data = { items: {}, groups: [], people: [], links: [] };
	let ui = { track: 'business', view: 'list', zoom: 'week', q: '', fStatus: '', fPerson: '', fGroup: '', groupBy: 'group', showDone: false, expanded: [] };
	let editing = null;      // item id, 'new:<track>:<groupId>', 'kid:<parentId>' or 'newgroup'
	let renaming = null;     // 'group:<id>' or 'person:<id>'
	let pendingRender = false;
	let saving = false;
	let lastLoad = 0;

	// Tab, filters and expanded tasks are remembered in this browser only.
	try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || '{}')); } catch (e) { /* optional */ }
	const expanded = new Set(ui.expanded || []);
	const saveUI = () => {
		ui.expanded = [...expanded];
		try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* optional */ }
	};

	const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
	const $ = (sel) => root.querySelector(sel);

	// ─── Model helpers ───
	const allItems = () => Object.values(data.items);
	const kids = (id) => allItems().filter((i) => (i.parent_id || null) === id).sort((a, b) => a.sort_order - b.sort_order);
	const groupById = (id) => data.groups.find((g) => g.id === id);
	const personById = (id) => data.people.find((p) => p.id === id);
	function rootOf(it) {
		let c = it, guard = 0;
		while (c && c.parent_id && data.items[c.parent_id] && guard++ < 50) c = data.items[c.parent_id];
		return c;
	}
	const groupNameOf = (it) => (groupById(rootOf(it).group_id) || {}).name || 'TDC (No group)';
	function ancestors(it) {
		const out = [];
		let c = it, guard = 0;
		while (c.parent_id && data.items[c.parent_id] && guard++ < 50) { c = data.items[c.parent_id]; out.unshift(c); }
		return out;
	}
	function descendants(id) {
		const out = [];
		(function walk(p) { kids(p).forEach((k) => { out.push(k); walk(k.id); }); })(id);
		return out;
	}
	const tracksShown = () => (ui.track === 'all' ? ['business', 'website'] : [ui.track]);
	const groupsFor = (t) => data.groups.filter((g) => g.track === t).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
	const peopleSorted = () => [...data.people].sort((a, b) => a.name.localeCompare(b.name));
	const filtering = () => !!(ui.q || ui.fStatus || ui.fPerson || ui.fGroup);
	const treeMode = () => ui.view === 'list' && ui.groupBy === 'group' && !filtering();
	const isOverdue = (i) => !!i.due_at && i.status !== 'done' && Date.parse(i.due_at) < Date.now();
	const hasOpenDescendant = (id) => descendants(id).some((d) => d.status !== 'done');
	const visibleInTree = (it) => ui.showDone || it.status !== 'done' || hasOpenDescendant(it.id) || editing === it.id;
	const hasCost = (i) => i.cost_low !== null && i.cost_low !== undefined;
	// Totals of the sub-tasks' own costs, per period: { once: { low, high, n }, ... }.
	function subCosts(id) {
		const out = {};
		for (const d of descendants(id)) {
			if (!hasCost(d)) continue;
			const t = out[d.cost_period] || (out[d.cost_period] = { low: 0, high: 0, n: 0 });
			t.low += Number(d.cost_low); t.high += Number(d.cost_high); t.n++;
		}
		return out;
	}
	// Position of every task in list-view order (by group, then each task followed by its sub-tasks).
	function treeOrder() {
		const order = new Map();
		for (const t of tracksShown()) {
			for (const g of groupsFor(t)) {
				(function walk(items) { items.forEach((k) => { order.set(k.id, order.size); walk(kids(k.id)); }); })(kids(null).filter((r) => r.group_id === g.id));
			}
		}
		return order;
	}
	const linksFrom = (id) => data.links.filter((l) => l.from_id === id);
	const linksTo = (id) => data.links.filter((l) => l.to_id === id);

	// ─── Dates ───
	// Dates are stored as timestamps and shown in this device's local time (South Africa for us).
	const pad = (n) => String(n).padStart(2, '0');
	const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

	// "1 Oct", "1 Oct 14:00", "3 Jan 2027". kind 'due' hides 23:59, kind 'start' hides 00:00.
	function fmtDate(iso, kind) {
		if (!iso) return '';
		const d = new Date(iso);
		const opts = { day: 'numeric', month: 'short' };
		if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
		let out = d.toLocaleDateString('en-ZA', opts);
		const t = hm(d);
		if (!((kind === 'due' && t === END_OF_DAY) || (kind === 'start' && t === START_OF_DAY))) out += ' ' + t;
		return out;
	}
	const fmtStamp = (iso) => (iso ? new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

	// Timestamp → the form's separate date and time boxes (time left blank when it's the day's default).
	function toInputs(iso, kind) {
		if (!iso) return { date: '', time: '' };
		const d = new Date(iso);
		const t = hm(d);
		const hide = (kind === 'due' && t === END_OF_DAY) || (kind === 'start' && t === START_OF_DAY);
		return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: hide ? '' : t };
	}
	// The form's date and time boxes → timestamp, or null when there's no date.
	function fromInputs(date, time, fallbackTime) {
		if (!date) return null;
		const [y, m, d] = date.split('-').map(Number);
		const [hh, mm] = (time || fallbackTime).split(':').map(Number);
		const out = new Date(y, m - 1, d, hh, mm);
		if (isNaN(out)) throw new Error('TDC (Error): that date could not be read.');
		return out.toISOString();
	}
	const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

	// ─── Money ───
	const moneyFull = (n) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n));
	// Short form for chips: R950, R7.5k, R75k, R1.2m.
	function moneyShort(n) {
		n = Number(n);
		if (n >= 1e6) return 'R' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'm';
		if (n >= 1e3) return 'R' + (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
		return 'R' + Math.round(n);
	}
	const rangeShort = (low, high) => (Number(low) === Number(high) ? moneyShort(low) : `${moneyShort(low)}–${moneyShort(high)}`);
	// "R75 000", "R25 000,50": what someone typed into a cost box → number, '' → null, anything else → NaN.
	function parseMoney(text) {
		const t = String(text || '').replace(/[R\s]/gi, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '');
		if (!t) return null;
		return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
	}

	// ─── Rendering ───
	function renderShell() {
		root.innerHTML = `
			<header class="pm-head">
				<div>
					<h1>Project Board</h1>
					<p class="muted">Business and website tasks, dates and costs.</p>
				</div>
				<div class="pm-counts" id="pm-counts"></div>
			</header>
			<div class="pm-tabbar">
				<div class="pm-tabs" role="tablist">
					${[['business', 'Business'], ['website', 'Website'], ['all', 'All']].map(([t, l]) => `<button type="button" class="pm-tab" role="tab" data-track="${t}">${l}</button>`).join('')}
				</div>
				<div class="pm-views">
					<button type="button" class="pm-view" data-view="list">List</button>
					<button type="button" class="pm-view" data-view="timeline">Timeline</button>
					<button type="button" class="pm-view" data-view="costs">Costs</button>
					<select id="pm-zoom" aria-label="Timeline scale"><option value="week">Weeks</option><option value="month">Months</option></select>
				</div>
			</div>
			<div class="pm-filters">
				<label class="pm-search">Search<input type="search" id="pm-q" placeholder="Find a task" autocomplete="off"></label>
				<label>Status<select id="pm-fStatus"></select></label>
				<label>Person<select id="pm-fPerson"></select></label>
				<label>Group<select id="pm-fGroup"></select></label>
				<label>Group by<select id="pm-groupBy">
					<option value="group">Group</option><option value="status">Status</option><option value="person">Person</option><option value="none">Nothing</option>
				</select></label>
				<label class="pm-check"><input type="checkbox" id="pm-showDone"> Show done</label>
				<button type="button" class="pm-link" id="pm-clear" hidden>Clear filters</button>
			</div>
			<div id="pm-body" class="pm-body"></div>
			<button type="button" class="pm-btn" id="pm-newGroup" hidden>+ New group</button>`;
	}

	function renderControls() {
		root.querySelectorAll('.pm-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.track === ui.track)));
		root.querySelectorAll('.pm-view').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === ui.view)));
		$('#pm-zoom').hidden = ui.view !== 'timeline';
		$('#pm-zoom').value = ui.zoom;
		const q = $('#pm-q');
		if (document.activeElement !== q) q.value = ui.q;

		$('#pm-fStatus').innerHTML = '<option value="">Any status</option><option value="overdue">Overdue</option>' + STATUSES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
		$('#pm-fStatus').value = ui.fStatus;

		if (ui.fPerson && ui.fPerson !== '__none' && !personById(ui.fPerson)) ui.fPerson = '';
		$('#pm-fPerson').innerHTML = '<option value="">Anyone</option><option value="__none">No one assigned</option>' +
			peopleSorted().map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
		$('#pm-fPerson').value = ui.fPerson;

		const names = [];
		tracksShown().forEach((t) => groupsFor(t).forEach((g) => names.includes(g.name) || names.push(g.name)));
		if (!names.includes(ui.fGroup)) ui.fGroup = '';
		$('#pm-fGroup').innerHTML = '<option value="">Any group</option>' + names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
		$('#pm-fGroup').value = ui.fGroup;

		$('#pm-groupBy').value = ui.groupBy;
		$('#pm-showDone').checked = ui.showDone;
		$('#pm-clear').hidden = !filtering();

		const mine = allItems().filter((i) => tracksShown().includes(i.track));
		const overdue = mine.filter(isOverdue).length;
		$('#pm-counts').innerHTML = (overdue ? `<button type="button" class="pm-count pm-count-overdue" data-show-overdue><b>${overdue}</b>Overdue</button>` : '') +
			STATUSES.map(([s, l]) => `<span class="pm-count"><b>${mine.filter((i) => i.status === s).length}</b>${l}</span>`).join('');
		$('#pm-newGroup').hidden = !treeMode() || ui.track === 'all' || editing === 'newgroup';
	}

	function render() {
		pendingRender = false;
		renderControls();
		if (ui.view === 'timeline') { renderTimeline(); return; }
		if (ui.view === 'costs') { renderCosts(); return; }
		const out = treeMode() ? renderTree() : renderFlat();
		$('#pm-body').innerHTML = out.join('') || '<p class="pm-empty">No tasks yet.</p>';
	}

	// Normal view: each group, with its tasks and their sub-tasks nested underneath.
	function renderTree() {
		const out = [];
		for (const t of tracksShown()) {
			for (const g of groupsFor(t)) {
				const roots = kids(null).filter((i) => i.group_id === g.id);
				const vis = roots.filter(visibleInTree);
				const label = (ui.track === 'all' ? TRACKS[t] + ' · ' : '') + g.name;
				const newKey = `new:${t}:${g.id}`;
				let body = vis.map((r) => nodeHTML(r, 0, false)).join('');
				if (editing === newKey) body += `<div class="pm-node"><div class="pm-row">${formHTML(null, { track: t, group_id: g.id, parent_id: null })}</div></div>`;
				if (!vis.length && editing !== newKey) {
					body += `<div class="pm-empty">${roots.length ? 'All done here.' : 'No tasks in this group yet.'}` +
						(roots.length ? '' : ` <button type="button" class="pm-link" data-delgroup="${g.id}">Remove group</button>`) + '</div>';
				}
				out.push(`<section class="pm-group" data-group="${g.id}">${headHTML('group', g.id, g.name, label, roots.length)}<div class="pm-list">${body}</div></section>`);
			}
		}
		if (editing === 'newgroup') {
			out.push(`<section class="pm-group"><h2><form class="pm-rename" data-newgroup><input id="pm-newGroupName" placeholder="Group name" maxlength="100" required>` +
				`<button class="pm-btn pm-primary">Add group</button><button type="button" class="pm-btn" data-cancel>Cancel</button></form></h2></section>`);
		}
		return out;
	}

	// Filtered or regrouped view: matching tasks in flat sections, each showing its parent path.
	// Tasks with sub-tasks can still be expanded here.
	// Tasks in the shown tab(s) that pass the search and filters.
	// includeDone: keep Done tasks even when "Show done" is off (the Costs view counts everything).
	function filteredItems(includeDone) {
		const q = ui.q.toLowerCase();
		return allItems().filter((i) => tracksShown().includes(i.track)).filter((i) => {
			if (ui.fStatus === 'overdue' && !isOverdue(i)) return false;
			if (ui.fStatus && ui.fStatus !== 'overdue' && i.status !== ui.fStatus) return false;
			if (!includeDone && ui.fStatus !== 'done' && !ui.showDone && i.status === 'done') return false;
			if (ui.fPerson === '__none' && i.person_id) return false;
			if (ui.fPerson && ui.fPerson !== '__none' && i.person_id !== ui.fPerson) return false;
			if (ui.fGroup && groupNameOf(i) !== ui.fGroup) return false;
			if (q && !(i.title + ' ' + i.note).toLowerCase().includes(q)) return false;
			return true;
		});
	}

	// Split tasks into sections by the "Group by" choice. Returns [{ key, label, head }] with .items.
	function bucketize(list) {
		const keyOf = {
			group: (i) => (ui.track === 'all' ? TRACKS[i.track] + ' · ' : '') + groupNameOf(i),
			status: (i) => i.status,
			person: (i) => i.person_id || '',
			none: () => 'all'
		}[ui.groupBy];

		const buckets = new Map();
		if (ui.groupBy === 'status') STATUSES.forEach(([s]) => buckets.set(s, []));
		if (ui.groupBy === 'person') { peopleSorted().forEach((p) => buckets.set(p.id, [])); buckets.set('', []); }
		for (const i of list) {
			const k = keyOf(i);
			if (!buckets.has(k)) buckets.set(k, []);
			buckets.get(k).push(i);
		}

		const sections = [];
		for (const [k, arr] of buckets) {
			if (!arr.length) continue;
			let head, label;
			if (ui.groupBy === 'person' && k) {
				label = personById(k).name;
				head = headHTML('person', k, label, label, arr.length);
			} else {
				label = ui.groupBy === 'status' ? STATUS_LABEL[k] : ui.groupBy === 'person' ? 'No one assigned' : ui.groupBy === 'none' ? 'Matching tasks' : k;
				head = headHTML(null, null, null, label, arr.length);
			}
			sections.push({ key: k, label, head, items: arr });
		}
		return sections;
	}

	function renderFlat() {
		const list = filteredItems().sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.sort_order - b.sort_order);
		const out = bucketize(list).map((sec) => `<section class="pm-group">${sec.head}<div class="pm-list">${sec.items.map((i) => nodeHTML(i, 0, true)).join('')}</div></section>`);
		if (!out.length) out.push('<p class="pm-empty">No tasks match these filters.</p>');
		return out;
	}

	// Section heading. kind 'group' or 'person' gets a Rename button; groups also get "+ Add task".
	function headHTML(kind, id, name, label, count) {
		if (kind && renaming === `${kind}:${id}`) {
			return `<h2><form class="pm-rename" data-rename="${kind}" data-id="${id}"><input id="pm-renameInput" value="${esc(name)}" maxlength="100" required>` +
				`<button class="pm-btn pm-primary">Save</button><button type="button" class="pm-btn" data-cancel>Cancel</button></form></h2>`;
		}
		const group = kind === 'group' ? groupById(id) : null;
		return `<h2><span>${esc(label)}</span><span class="pm-gcount">${count}</span>` +
			(kind ? `<button type="button" class="pm-icon" data-startrename="${kind}:${id}">Rename</button>` : '') +
			'<span class="pm-spacer"></span>' +
			(group ? `<button type="button" class="pm-link" data-add="${group.track}:${group.id}">+ Add task</button>` : '') + '</h2>';
	}

	// "R75k–90k" for the task's own cost, and "Sub-tasks R72k–135k" when its sub-tasks carry costs.
	function costChips(i) {
		let out = hasCost(i) ? `<span class="pm-chip pm-cost">${rangeShort(i.cost_low, i.cost_high)}${PERIOD_SUFFIX[i.cost_period]}</span>` : '';
		const sub = subCosts(i.id);
		const parts = PERIODS.filter(([p]) => sub[p]).map(([p]) => rangeShort(sub[p].low, sub[p].high) + PERIOD_SUFFIX[p]);
		if (parts.length) out += `<span class="pm-chip pm-cost pm-cost-sub" title="Sub-tasks' own costs, not included in this task's cost">Sub-tasks ${parts.join(' + ')}</span>`;
		return out;
	}

	// "Overdue · 25 Sep", "Due 1 Oct 14:00" or "Starts 5 Oct".
	function dueChip(i) {
		if (i.due_at) {
			const od = isOverdue(i);
			return `<span class="pm-chip pm-due${od ? ' pm-overdue' : ''}">${od ? 'Overdue · ' : 'Due '}${esc(fmtDate(i.due_at, 'due'))}</span>`;
		}
		if (i.start_at) return `<span class="pm-chip pm-due">Starts ${esc(fmtDate(i.start_at, 'start'))}</span>`;
		return '';
	}

	function statusSelect(i) {
		return `<select class="pm-pill" data-s="${i.status}" data-id="${i.id}" aria-label="Status">` +
			STATUSES.map(([v, l]) => `<option value="${v}"${v === i.status ? ' selected' : ''}>${l}</option>`).join('') + '</select>';
	}

	// "Waiting on: X" for this task's own links, "Holding up: Y" for links other tasks make to it.
	function linksHTML(i) {
		const lines = [];
		for (const l of linksFrom(i.id)) {
			const t = data.items[l.to_id];
			if (!t) continue;
			const open = l.link_type === 'waiting_on' && t.status !== 'done';
			lines.push(`<span class="pm-rel${open ? ' pm-wait' : ''}"><span class="pm-k">${LINK_OUT[l.link_type]}:</span>` +
				`<button type="button" class="pm-jump${t.status === 'done' ? ' pm-cleared' : ''}" data-jump="${t.id}">${esc(t.title)}</button>${t.status === 'done' ? ' ✓' : ''}</span>`);
		}
		for (const l of linksTo(i.id)) {
			const f = data.items[l.from_id];
			if (!f) continue;
			const open = l.link_type === 'waiting_on' && i.status !== 'done' && f.status !== 'done';
			lines.push(`<span class="pm-rel${open ? ' pm-hold' : ''}"><span class="pm-k">${LINK_IN[l.link_type]}:</span>` +
				`<button type="button" class="pm-jump${f.status === 'done' ? ' pm-cleared' : ''}" data-jump="${f.id}">${esc(f.title)}</button></span>`);
		}
		return lines.join('');
	}

	// One task row, its edit form when open, and (when expanded) its sub-tasks.
	function nodeHTML(i, depth, showPath) {
		const ks = kids(i.id);
		const open = expanded.has(i.id);
		const all = descendants(i.id);
		const doneCount = all.filter((d) => d.status === 'done').length;
		const crumbs = showPath ? ancestors(i).map((a) => esc(a.title)) : [];
		const person = personById(i.person_id);
		const rel = linksHTML(i);

		let h = `<div class="pm-node"><div class="pm-row${i.status === 'done' ? ' pm-done' : ''}" id="pm-row-${i.id}" data-row="${i.id}" style="--depth:${depth}">` +
			(treeMode() ? `<button type="button" class="pm-drag" data-drag="${i.id}" aria-label="Move ${esc(i.title)}: drag, or use the up and down arrow keys" title="Drag to move">⋮⋮</button>` : '') +
			(ks.length ? `<button type="button" class="pm-chev" data-toggle="${i.id}" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} sub-tasks">▶</button>` : '<span class="pm-chev pm-none"></span>') +
			statusSelect(i) +
			'<div class="pm-main">' +
				(crumbs.length ? `<span class="pm-crumb">${crumbs.join(' › ')} ›</span>` : '') +
				`<button type="button" class="pm-title" data-edit="${i.id}" aria-expanded="${editing === i.id}">${esc(i.title)}</button>` +
				(all.length ? `<span class="pm-chip" title="Sub-tasks done">${doneCount}/${all.length}</span>` : '') +
				dueChip(i) + costChips(i) +
				(person ? `<span class="pm-chip pm-person">${esc(person.name)}</span>` : '') +
			'</div>' +
			(i.note || rel ? `<div class="pm-meta">${rel}${i.note ? `<span class="pm-note">${esc(i.note)}</span>` : ''}</div>` : '') +
			(editing === i.id ? formHTML(i) : '') +
			'</div>';

		if (ks.length && open) {
			const vk = ks.filter(visibleInTree);
			h += `<div class="pm-kids" style="--depth:${depth}">` + vk.map((k) => nodeHTML(k, depth + 1, false)).join('') +
				(editing === `kid:${i.id}`
					? `<div class="pm-node"><div class="pm-row" style="--depth:${depth + 1}">${formHTML(null, { track: i.track, parent_id: i.id })}</div></div>`
					: `<div class="pm-addkid" style="--depth:${depth}"><button type="button" class="pm-link" data-addkid="${i.id}">+ Add sub-task</button></div>`) +
				'</div>';
		}
		return h + '</div>';
	}

	// Tasks as dropdown options, indented under their parents, grouped by track.
	// exclude = ids that can't be chosen; onlyTrack limits the list to one track (a parent must be in the same track).
	function taskOptions(exclude, selected, onlyTrack) {
		return ['business', 'website'].filter((t) => !onlyTrack || t === onlyTrack).map((t) => {
			const rows = [];
			(function walk(parent, d) {
				kids(parent).filter((k) => parent !== null || k.track === t).forEach((k) => {
					if (!exclude.has(k.id)) rows.push(`<option value="${k.id}"${k.id === selected ? ' selected' : ''}>${'— '.repeat(d)}${esc(k.title)}${k.status === 'done' ? ' (done)' : ''}</option>`);
					walk(k.id, d + 1);
				});
			})(null, 0);
			return rows.length ? `<optgroup label="${TRACKS[t]}">${rows.join('')}</optgroup>` : '';
		}).join('');
	}

	function linkRowHTML(link, exclude) {
		return '<div class="pm-linkrow">' +
			`<select class="pm-ltype" aria-label="Link type">${LINK_TYPES.map(([v, n]) => `<option value="${v}"${link && link.link_type === v ? ' selected' : ''}>${n}</option>`).join('')}</select>` +
			`<select class="pm-ltarget" aria-label="Task">${link ? '' : '<option value="">Choose a task…</option>'}${taskOptions(exclude, link && link.to_id)}</select>` +
			'<button type="button" class="pm-icon" data-rmlink aria-label="Remove link">✕</button></div>';
	}

	// Add/edit form. i = the task being edited, or null with preset for a new one.
	function formHTML(i, preset) {
		const isNew = !i;
		const it = i || { title: '', note: '', person_id: null, group_id: null, parent_id: null, ...preset };
		const fid = isNew ? 'new' : i.id;
		const track = it.track;
		const exclude = new Set(isNew ? [] : [i.id, ...descendants(i.id).map((d) => d.id)]);
		const groups = groupsFor(track);
		const currentGroup = it.group_id || (groups[0] || {}).id;
		const links = isNew ? [] : linksFrom(i.id).filter((l) => data.items[l.to_id]);
		const start = toInputs(it.start_at, 'start');
		const due = toInputs(it.due_at, 'due');
		const stamp = isNew ? '' : `<p class="pm-hint pm-stamp">Created ${esc(fmtStamp(i.created_at))} · Last changed ${esc(fmtStamp(i.updated_at))}</p>`;

		return `<form class="pm-form" data-form="${fid}" data-track="${track}">
			<label>Task<input id="pm-f-title-${fid}" name="title" value="${esc(it.title)}" maxlength="300" required></label>
			<label>Notes<textarea id="pm-f-note-${fid}" name="note" maxlength="4000">${esc(it.note)}</textarea></label>
			<div class="pm-grid2">
				<label>Sub-task of<select id="pm-f-parent-${fid}" name="parent_id"><option value="">None (top-level task)</option>${taskOptions(exclude, it.parent_id, track)}</select></label>
				<label class="pm-groupfield"${it.parent_id ? ' hidden' : ''}>Group<span class="pm-pair">
					<select id="pm-f-group-${fid}" name="group_id">${groups.map((g) => `<option value="${g.id}"${g.id === currentGroup ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}<option value="__new">+ New group…</option></select>
					<input id="pm-f-newgroup-${fid}" name="new_group" placeholder="New group name" maxlength="100" hidden></span></label>
				<label>Person<span class="pm-pair">
					<select id="pm-f-person-${fid}" name="person_id"><option value="">No one</option>${peopleSorted().map((p) => `<option value="${p.id}"${p.id === it.person_id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="__new">+ New person…</option></select>
					<input id="pm-f-newperson-${fid}" name="new_person" placeholder="Name" maxlength="100" hidden></span></label>
			</div>
			<div class="pm-grid2">
				<label>Start<span class="pm-pair"><input type="date" id="pm-f-sdate-${fid}" name="start_date" value="${start.date}"><input type="time" id="pm-f-stime-${fid}" name="start_time" value="${start.time}" aria-label="Start time (optional)"></span></label>
				<label>Due<span class="pm-pair"><input type="date" id="pm-f-ddate-${fid}" name="due_date" value="${due.date}"><input type="time" id="pm-f-dtime-${fid}" name="due_time" value="${due.time}" aria-label="Due time (optional)"></span></label>
			</div>
			<p class="pm-hint">Times are optional: blank start = start of day, blank due = end of day.</p>
			<div class="pm-grid3">
				<label>Cost from (R)<input id="pm-f-clow-${fid}" name="cost_low" inputmode="decimal" autocomplete="off" value="${hasCost(it) ? esc(it.cost_low) : ''}"></label>
				<label>Cost to (R)<input id="pm-f-chigh-${fid}" name="cost_high" inputmode="decimal" autocomplete="off" value="${hasCost(it) && Number(it.cost_high) !== Number(it.cost_low) ? esc(it.cost_high) : ''}"></label>
				<label>Cost is<select id="pm-f-cperiod-${fid}" name="cost_period">${PERIODS.map(([v, l]) => `<option value="${v}"${v === (it.cost_period || 'once') ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
			</div>
			<p class="pm-hint">One figure = both. This task only; sub-tasks carry their own.</p>
			<fieldset><legend>Links to other tasks</legend>
				<div class="pm-links">${links.map((l) => linkRowHTML(l, exclude)).join('')}</div>
				<div><button type="button" class="pm-link" data-addlink>+ Add link</button></div>
			</fieldset>
			<div class="pm-actions">
				${isNew ? '' : `<button type="button" class="pm-btn pm-danger" data-del="${fid}">Delete</button>`}
				<button type="button" class="pm-btn" data-cancel>Cancel</button>
				<button type="submit" class="pm-btn pm-primary">${isNew ? 'Add task' : 'Save'}</button>
			</div>
			${stamp}
		</form>`;
	}

	// ─── Timeline ───
	// Gantt view: one row per task with dates, a bar from start to due, a diamond for a due date with no start,
	// and a short fading bar for a start with no due date. Sections follow "Group by"; filters and tabs apply.
	// Rows scroll sideways under a fixed label column. Tap a bar or label to open that task in the list.
	function renderTimeline() {
		const body = $('#pm-body');
		const oldScroller = body.querySelector('.pm-tl-scroll');
		const keepScroll = oldScroller ? oldScroller.scrollLeft : null;

		const list = filteredItems();
		const dated = list.filter((i) => i.start_at || i.due_at);
		// Undated tasks in the same order as the list view: by group, then each task followed by its sub-tasks.
		const order = treeOrder();
		const undated = list.filter((i) => !i.start_at && !i.due_at).sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
		const undatedHTML = undated.length
			? `<section class="pm-group"><h2><span>No dates</span><span class="pm-gcount">${undated.length}</span></h2><div class="pm-list">` +
				undated.map((i) => `<button type="button" class="pm-tl-undated" data-open="${i.id}"><span class="pm-tl-dot" data-s="${i.status}"></span>` +
					`${ancestors(i).length ? `<span class="pm-crumb">${ancestors(i).map((a) => esc(a.title)).join(' › ')} ›</span>` : ''}${esc(i.title)}</button>`).join('') +
				'</div></section>'
			: '';

		if (!dated.length) {
			body.innerHTML = '<p class="pm-empty">No tasks with dates here yet. Open a task and give it a start or due date to see it on the timeline.</p>' + undatedHTML;
			return;
		}

		const now = Date.now();
		const px = ZOOMS[ui.zoom] || ZOOMS.week;
		const when = (i) => Date.parse(i.start_at || i.due_at);
		const times = dated.flatMap((i) => [i.start_at, i.due_at].filter(Boolean).map((t) => Date.parse(t)));

		// Range: from the Monday before the earliest date (or last week) to two weeks past the latest date.
		const first = new Date(startOfDay(Math.min(now, ...times)));
		first.setDate(first.getDate() - 7 - ((first.getDay() + 6) % 7));
		const last = new Date(startOfDay(Math.max(now, ...times)));
		last.setDate(last.getDate() + 15);
		const dayList = [];
		for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) dayList.push(new Date(d));
		const min = first.getTime();
		const W = dayList.length * px;
		const x = (ms) => ((ms - min) / DAY) * px;

		// Header: week starts (and month names when zoomed out).
		const ticks = dayList.map((d, ix) => {
			const left = ix * px;
			if (ui.zoom === 'month') {
				if (d.getDate() === 1) {
					const opts = { month: 'short' };
					if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
					return `<span class="pm-tl-tick pm-tl-major" style="left:${left}px">${d.toLocaleDateString('en-ZA', opts)}</span>`;
				}
				return d.getDay() === 1 ? `<span class="pm-tl-tick" style="left:${left}px"></span>` : '';
			}
			return d.getDay() === 1 ? `<span class="pm-tl-tick pm-tl-major" style="left:${left}px">${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>` : '';
		}).join('');

		const barHTML = (i) => {
			const s = i.start_at ? Date.parse(i.start_at) : null;
			const e = i.due_at ? Date.parse(i.due_at) : null;
			const od = isOverdue(i);
			const cls = `pm-tl-bar${od ? ' pm-overdue' : ''}`;
			const tip = [i.title, s ? 'Starts ' + fmtDate(i.start_at, 'start') : '', e ? 'Due ' + fmtDate(i.due_at, 'due') : '', od ? 'Overdue' : STATUS_LABEL[i.status]].filter(Boolean).join(' · ');
			let shape, endX;
			if (s !== null && e !== null) {
				const left = x(s);
				const width = Math.max(6, x(e) - left);
				shape = `<button type="button" class="${cls}" data-s="${i.status}" data-open="${i.id}" title="${esc(tip)}" style="left:${left}px;width:${width}px"></button>`;
				endX = left + width;
			} else if (e !== null) {
				shape = `<button type="button" class="${cls} pm-tl-milestone" data-s="${i.status}" data-open="${i.id}" title="${esc(tip)}" style="left:${x(e) - 7}px"></button>`;
				endX = x(e) + 8;
			} else {
				shape = `<button type="button" class="${cls} pm-tl-openend" data-s="${i.status}" data-open="${i.id}" title="${esc(tip)}" style="left:${x(s)}px;width:${3 * px}px"></button>`;
				endX = x(s) + 3 * px;
			}
			const label = e !== null ? (od ? 'Overdue · ' : '') + fmtDate(i.due_at, 'due') : 'Starts ' + fmtDate(i.start_at, 'start');
			return shape + `<span class="pm-tl-when${od ? ' pm-overdue' : ''}" style="left:${endX + 6}px">${esc(label)}</span>`;
		};

		const rows = bucketize(dated.sort((a, b) => when(a) - when(b))).map((sec) =>
			`<div class="pm-tl-sec"><span class="pm-tl-label">${esc(sec.label)} <span class="pm-gcount">${sec.items.length}</span></span><div class="pm-tl-lane"></div></div>` +
			sec.items.map((i) => {
				const crumbs = ancestors(i).map((a) => esc(a.title));
				const person = personById(i.person_id);
				return `<div class="pm-tl-row${i.status === 'done' ? ' pm-done' : ''}">` +
					`<button type="button" class="pm-tl-label" data-open="${i.id}" title="${esc(i.title)}">` +
						(crumbs.length ? `<span class="pm-crumb">${crumbs.join(' › ')} ›</span>` : '') +
						`<span class="pm-tl-title">${esc(i.title)}</span>${person ? `<span class="pm-chip pm-person">${esc(person.name)}</span>` : ''}</button>` +
					`<div class="pm-tl-lane">${barHTML(i)}</div></div>`;
			}).join('')
		).join('');

		body.innerHTML =
			'<p class="pm-hint">Bar = start to due · ◆ = due only · Red = overdue. Tap to open.</p>' +
			`<div class="pm-tl-scroll"><div class="pm-tl-canvas" style="--px:${px}px;--w:${W}px">` +
				`<div class="pm-tl-head"><span class="pm-tl-label"></span><div class="pm-tl-lane">${ticks}</div></div>` +
				rows +
				`<div class="pm-tl-today" style="--x:${x(now)}px" title="Now"></div>` +
			'</div></div>' + undatedHTML;

		const scroller = body.querySelector('.pm-tl-scroll');
		scroller.scrollLeft = keepScroll !== null ? keepScroll : Math.max(0, x(now) - 3 * px * (ui.zoom === 'month' ? 3 : 1));
	}

	// ─── Costs ───
	// Itemised estimates: one table per period (once-off, monthly, yearly), sections follow "Group by", with subtotals
	// and a total. Tabs, search and filters apply; Done tasks are always included, since their cost still counts.
	function renderCosts() {
		const body = $('#pm-body');
		const order = treeOrder();
		const byTree = (a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9);
		const list = filteredItems(true).sort(byTree);
		const costed = list.filter(hasCost);
		const uncosted = list.filter((i) => !hasCost(i) && !descendants(i.id).some(hasCost));

		const sum = (items) => items.reduce((t, i) => ({ low: t.low + Number(i.cost_low), high: t.high + Number(i.cost_high) }), { low: 0, high: 0 });
		const cell = (low, high) => `<td class="pm-num">${moneyFull(low)}</td><td class="pm-num">${moneyFull(high)}</td>`;
		const gap = '<td class="pm-ct-status"></td><td class="pm-ct-person"></td>';   // empty Status/Person cells (hidden on phones)
		const periods = PERIODS.filter(([p]) => costed.some((i) => i.cost_period === p));

		const tiles = periods.map(([p, label]) => {
			const t = sum(costed.filter((i) => i.cost_period === p));
			return `<div class="pm-tile"><span class="pm-tile-label">${label}</span><span class="pm-tile-value">${Number(t.low) === Number(t.high) ? moneyFull(t.low) : `${moneyFull(t.low)} – ${moneyFull(t.high)}`}${PERIOD_SUFFIX[p]}</span></div>`;
		}).join('');

		const tables = periods.map(([p, label]) => {
			const items = costed.filter((i) => i.cost_period === p);
			const sections = bucketize(items);
			const showHeads = ui.groupBy !== 'none';
			const rows = sections.map((sec) => {
				const t = sum(sec.items);
				return (showHeads ? `<tr class="pm-ct-sec"><th colspan="5" scope="rowgroup">${esc(sec.label)}</th></tr>` : '') +
					sec.items.map((i) => {
						const crumbs = ancestors(i).map((a) => esc(a.title));
						const person = personById(i.person_id);
						const sub = subCosts(i.id)[p];
						return `<tr class="${i.status === 'done' ? 'pm-done' : ''}">` +
							'<td class="pm-ct-task">' +
								(crumbs.length ? `<span class="pm-crumb">${crumbs.join(' › ')} ›</span>` : '') +
								`<button type="button" class="pm-ct-title" data-open="${i.id}">${esc(i.title)}</button>` +
								(sub ? `<span class="pm-chip pm-cost pm-cost-sub" title="Listed separately below their own rows">+ sub-tasks ${rangeShort(sub.low, sub.high)}${PERIOD_SUFFIX[p]}</span>` : '') +
							'</td>' +
							`<td class="pm-ct-status"><span class="pm-tl-dot" data-s="${i.status}"></span>${STATUS_LABEL[i.status]}</td>` +
							`<td class="pm-ct-person">${person ? esc(person.name) : ''}</td>` +
							cell(i.cost_low, i.cost_high) + '</tr>';
					}).join('') +
					(showHeads && sections.length > 1 ? `<tr class="pm-ct-subtotal"><td>Subtotal · ${esc(sec.label)}</td>${gap}${cell(t.low, t.high)}</tr>` : '');
			}).join('');
			const total = sum(items);
			return `<section class="pm-group"><h2><span>${label}</span><span class="pm-gcount">${items.length}</span></h2>` +
				'<div class="pm-ct-wrap"><table class="pm-ct">' +
				`<thead><tr><th scope="col">Task</th><th scope="col" class="pm-ct-status">Status</th><th scope="col" class="pm-ct-person">Person</th><th scope="col" class="pm-num">Low${PERIOD_SUFFIX[p]}</th><th scope="col" class="pm-num">High${PERIOD_SUFFIX[p]}</th></tr></thead>` +
				`<tbody>${rows}</tbody>` +
				`<tfoot><tr><th scope="row">Total ${label.toLowerCase()}</th>${gap}${cell(total.low, total.high)}</tr></tfoot>` +
				'</table></div></section>';
		}).join('');

		const missing = uncosted.length
			? `<details class="pm-ct-missing"><summary>${uncosted.length} task${uncosted.length > 1 ? 's' : ''} without a cost</summary><div class="pm-list">` +
				uncosted.map((i) => `<button type="button" class="pm-tl-undated" data-open="${i.id}"><span class="pm-tl-dot" data-s="${i.status}"></span>` +
					`${ancestors(i).length ? `<span class="pm-crumb">${ancestors(i).map((a) => esc(a.title)).join(' › ')} ›</span>` : ''}${esc(i.title)}</button>`).join('') +
				'</div></details>'
			: '';

		body.innerHTML = costed.length
			? `<div class="pm-tiles">${tiles}</div><p class="pm-hint">Each cost counts once. "+ sub-tasks" = what a task's sub-tasks add (on their own rows). Done tasks included.</p>${tables}${missing}`
			: `<p class="pm-empty">No costs here yet. Open a task and add a cost to see it here.</p>${missing}`;
	}

	// ─── Writes ───
	async function loadAll() {
		const q = (table, cols) => supabaseClient.from(table).select(cols).eq('venue_id', venueId);
		const results = await Promise.all([
			q('tbl_pm_items', 'id, track, group_id, parent_id, person_id, title, note, status, sort_order, start_at, due_at, created_at, updated_at, cost_low, cost_high, cost_period'),
			q('tbl_pm_groups', 'id, track, name, sort_order'),
			q('tbl_pm_people', 'id, name'),
			q('tbl_pm_links', 'id, from_id, to_id, link_type')
		]);
		const failed = results.find((r) => r.error);
		if (failed) {
			TDC.error(AREA, 'could not load the board.', failed.error, statusEl);
			return false;
		}
		const [items, groups, people, links] = results.map((r) => r.data);
		data = { items: {}, groups, people, links };
		items.forEach((i) => { data.items[i.id] = i; });
		lastLoad = Date.now();
		return true;
	}

	async function refresh() {
		if (!(await loadAll())) return;
		if (editing || renaming) pendingRender = true;
		else render();
	}

	// Run one change, report problems, then reload. Returns true on success.
	async function write(fn, okMessage) {
		if (saving) {
			TDC.status(statusEl, 'Still saving the last change. Try again in a moment.', 'error');
			return false;
		}
		saving = true;
		try {
			await fn();
			TDC.status(statusEl, okMessage || '', okMessage ? 'success' : '');
			return true;
		} catch (err) {
			if (err && err.code === '23505') TDC.status(statusEl, 'That name is already used. Pick another.', 'error');
			else if (err && err.code === '23503') TDC.status(statusEl, 'That group still has tasks, so it can\'t be removed.', 'error');
			else TDC.showSupabaseError(AREA, err, statusEl);
			return false;
		} finally {
			saving = false;
			await loadAll();
		}
	}
	const check = ({ data: d, error }) => { if (error) throw error; return d; };

	function nextOrder(parentId, track, groupId) {
		const sibs = allItems().filter((i) => (i.parent_id || null) === parentId && (parentId || (i.track === track && i.group_id === groupId)));
		return sibs.length ? Math.max(...sibs.map((i) => i.sort_order)) + 1 : 1;
	}

	async function addGroup(track, name) {
		const order = Math.max(0, ...groupsFor(track).map((g) => g.sort_order)) + 1;
		return check(await supabaseClient.from('tbl_pm_groups').insert({ venue_id: venueId, track, name, sort_order: order }).select('id').single()).id;
	}
	async function addPerson(name) {
		return check(await supabaseClient.from('tbl_pm_people').insert({ venue_id: venueId, name }).select('id').single()).id;
	}

	// Save the add/edit form: new group or person first if asked for, then the task, then its links.
	async function saveForm(form) {
		const fid = form.dataset.form;
		const track = form.dataset.track;
		const val = (n) => (form.elements[n] ? form.elements[n].value : '').trim();
		const title = val('title');
		if (!title) return false;
		const parentId = val('parent_id') || null;
		const wantGroup = val('group_id');
		const wantPerson = val('person_id');
		if (!parentId && wantGroup === '__new' && !val('new_group')) { TDC.status(statusEl, 'Type a name for the new group.', 'error'); return false; }
		if (wantPerson === '__new' && !val('new_person')) { TDC.status(statusEl, 'Type a name for the new person.', 'error'); return false; }
		let startAt, dueAt;
		try {
			startAt = fromInputs(val('start_date'), val('start_time'), START_OF_DAY);
			dueAt = fromInputs(val('due_date'), val('due_time'), END_OF_DAY);
		} catch (err) {
			TDC.error(AREA, err.message.replace('TDC (Error): ', ''), err, statusEl);
			return false;
		}
		if ((val('start_time') && !val('start_date')) || (val('due_time') && !val('due_date'))) { TDC.status(statusEl, 'A time needs a date too.', 'error'); return false; }
		if (startAt && dueAt && startAt > dueAt) { TDC.status(statusEl, 'The start can\'t be after the due date.', 'error'); return false; }
		let costLow = parseMoney(val('cost_low'));
		let costHigh = parseMoney(val('cost_high'));
		if (Number.isNaN(costLow) || Number.isNaN(costHigh)) { TDC.status(statusEl, 'Costs must be amounts in rand, like 75000 or 75 000.', 'error'); return false; }
		if (costLow === null) costLow = costHigh;
		if (costHigh === null) costHigh = costLow;
		if (costLow !== null && costLow > costHigh) [costLow, costHigh] = [costHigh, costLow];
		const links = [...form.querySelectorAll('.pm-linkrow')]
			.map((r) => ({ link_type: r.querySelector('.pm-ltype').value, to_id: r.querySelector('.pm-ltarget').value }))
			.filter((l) => l.to_id)
			.filter((l, ix, arr) => arr.findIndex((x) => x.to_id === l.to_id && x.link_type === l.link_type) === ix);

		return write(async () => {
			let groupId = null;
			if (!parentId) groupId = wantGroup === '__new' ? await addGroup(track, val('new_group')) : wantGroup;
			if (!parentId && !groupId) throw new Error('TDC (Error): no group chosen for a top-level task.');
			const personId = wantPerson === '__new' ? await addPerson(val('new_person')) : (wantPerson || null);
			const body = { title, note: val('note'), parent_id: parentId, group_id: groupId, person_id: personId, start_at: startAt, due_at: dueAt,
				cost_low: costLow, cost_high: costHigh, cost_period: val('cost_period') || 'once' };

			let id = fid;
			if (fid === 'new') {
				const row = { ...body, venue_id: venueId, track, status: 'todo', sort_order: nextOrder(parentId, track, groupId) };
				id = check(await supabaseClient.from('tbl_pm_items').insert(row).select('id').single()).id;
			} else {
				const cur = data.items[fid];
				if ((cur.parent_id || null) !== parentId || (!parentId && cur.group_id !== groupId)) body.sort_order = nextOrder(parentId, cur.track, groupId);
				check(await supabaseClient.from('tbl_pm_items').update(body).eq('id', fid));
				check(await supabaseClient.from('tbl_pm_links').delete().eq('from_id', fid));
			}
			if (links.length) {
				check(await supabaseClient.from('tbl_pm_links').insert(links.map((l) => ({ ...l, venue_id: venueId, from_id: id }))));
			}
			if (parentId) expanded.add(parentId);
		}, fid === 'new' ? 'Task added.' : 'Saved.');
	}

	// ─── Drag and drop ───
	// Only in the normal List view (Group by Group, no filters), where the order on screen is the real order.
	// Drop on the top or bottom of a row = before/after it; the middle = make it a sub-task; a group heading = move there.
	let drag = null;   // { id, pointerId, x0, y0, started, ghost, target }

	// Siblings of a task's new position, in order, without the task itself.
	function siblingsFor(parentId, groupId, excludeId) {
		const list = parentId ? kids(parentId) : kids(null).filter((r) => r.group_id === groupId);
		return list.filter((k) => k.id !== excludeId);
	}

	// Where would this drop put the task? Returns { parentId, groupId, index } or null if it isn't allowed.
	function dropPlan(id, target) {
		const it = data.items[id];
		if (!it || !target) return null;
		if (target.mode === 'group') {
			const g = groupById(target.groupId);
			if (!g || g.track !== it.track) return null;
			return { parentId: null, groupId: g.id, index: siblingsFor(null, g.id, id).length };
		}
		const t = data.items[target.id];
		if (!t || t.id === id || t.track !== it.track) return null;
		if (descendants(id).some((d) => d.id === t.id)) return null;          // can't go inside its own sub-tasks
		if (target.mode === 'inside') return { parentId: t.id, groupId: null, index: siblingsFor(t.id, null, id).length };
		const parentId = t.parent_id || null;
		const groupId = parentId ? null : t.group_id;
		const sibs = siblingsFor(parentId, groupId, id);
		return { parentId, groupId, index: sibs.findIndex((k) => k.id === t.id) + (target.mode === 'after' ? 1 : 0) };
	}

	// Save a move: the task's new parent/group, and a clean 1, 2, 3… order for its new siblings.
	async function applyMove(id, plan) {
		const it = data.items[id];
		const sibs = siblingsFor(plan.parentId, plan.groupId, id);
		sibs.splice(plan.index, 0, it);
		const moved = (it.parent_id || null) !== plan.parentId || (!plan.parentId && it.group_id !== plan.groupId);
		const ok = await write(async () => {
			for (let n = 0; n < sibs.length; n++) {
				const k = sibs[n];
				if (k.id === id) {
					const body = { sort_order: n + 1 };
					if (moved) Object.assign(body, { parent_id: plan.parentId, group_id: plan.groupId });
					if (moved || k.sort_order !== n + 1) check(await supabaseClient.from('tbl_pm_items').update(body).eq('id', id));
				} else if (k.sort_order !== n + 1) {
					check(await supabaseClient.from('tbl_pm_items').update({ sort_order: n + 1 }).eq('id', k.id));
				}
			}
		}, 'Moved.');
		if (ok && plan.parentId) expanded.add(plan.parentId);
		saveUI();
		render();
		const handle = root.querySelector(`[data-drag="${id}"]`);
		if (handle) handle.focus({ preventScroll: true });
	}

	// What's under the pointer: a row (before/after/inside) or a group.
	function targetAt(x, y) {
		const el = document.elementFromPoint(x, y);
		if (!el) return null;
		const row = el.closest('.pm-row[data-row]');
		if (row && root.contains(row)) {
			const r = row.getBoundingClientRect();
			const f = (y - r.top) / r.height;
			return { id: row.dataset.row, mode: f < 0.3 ? 'before' : f > 0.7 ? 'after' : 'inside', el: row };
		}
		const sec = el.closest('.pm-group[data-group]');
		if (sec && root.contains(sec)) return { mode: 'group', groupId: sec.dataset.group, el: sec };
		return null;
	}

	function clearDropMarks() {
		root.querySelectorAll('.pm-drop-before, .pm-drop-after, .pm-drop-inside, .pm-drop-group')
			.forEach((n) => n.classList.remove('pm-drop-before', 'pm-drop-after', 'pm-drop-inside', 'pm-drop-group'));
	}

	function endDrag() {
		if (!drag) return;
		clearDropMarks();
		if (drag.ghost) drag.ghost.remove();
		document.body.classList.remove('pm-dragging');
		const src = document.getElementById('pm-row-' + drag.id);
		if (src) src.classList.remove('pm-drag-source');
		drag = null;
	}

	root.addEventListener('pointerdown', (e) => {
		const h = e.target.closest('.pm-drag');
		if (!h || !treeMode() || editing || e.button > 0) return;
		e.preventDefault();
		drag = { id: h.dataset.drag, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false, ghost: null, target: null };
		h.setPointerCapture(e.pointerId);
	});

	root.addEventListener('pointermove', (e) => {
		if (!drag || e.pointerId !== drag.pointerId) return;
		if (!drag.started) {
			if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
			drag.started = true;
			document.body.classList.add('pm-dragging');
			const src = document.getElementById('pm-row-' + drag.id);
			if (src) src.classList.add('pm-drag-source');
			drag.ghost = document.createElement('div');
			drag.ghost.className = 'pm-ghost';
			drag.ghost.textContent = data.items[drag.id].title;
			document.body.appendChild(drag.ghost);
		}
		drag.ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY - 14}px)`;

		// Scroll the page when dragging near the top or bottom edge.
		if (e.clientY < 90) window.scrollBy(0, -14);
		else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 14);

		clearDropMarks();
		const t = targetAt(e.clientX, e.clientY);
		drag.target = t && dropPlan(drag.id, t) ? t : null;
		if (drag.target) drag.target.el.classList.add('pm-drop-' + drag.target.mode);
	});

	root.addEventListener('pointerup', async (e) => {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const { id, started, target } = drag;
		endDrag();
		if (!started || !target) return;
		const plan = dropPlan(id, target);
		if (plan) await applyMove(id, plan);
	});
	root.addEventListener('pointercancel', endDrag);

	// Keyboard: on a handle, Up/Down moves the task one place among its siblings.
	root.addEventListener('keydown', async (e) => {
		if (e.key === 'Escape' && drag) { endDrag(); return; }
		const h = e.target.closest && e.target.closest('.pm-drag');
		if (!h || !treeMode() || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		const it = data.items[h.dataset.drag];
		const sibs = siblingsFor(it.parent_id || null, it.parent_id ? null : it.group_id, null);
		const ix = sibs.findIndex((k) => k.id === it.id);
		const other = sibs[ix + (e.key === 'ArrowUp' ? -1 : 1)];
		if (!other) return;
		const plan = dropPlan(it.id, { id: other.id, mode: e.key === 'ArrowUp' ? 'before' : 'after' });
		if (plan) await applyMove(it.id, plan);
	});

	// ─── Events ───
	const focusSoon = (sel) => setTimeout(() => { const el = root.querySelector(sel); if (el) el.focus(); }, 0);

	// Open the normal view at a task (from a link), expanding its parents and flashing the row.
	function jumpTo(id) {
		const it = data.items[id];
		if (!it) return;
		Object.assign(ui, { q: '', fStatus: '', fPerson: '', fGroup: '', groupBy: 'group' });
		if (ui.track !== 'all') ui.track = it.track;
		if (it.status === 'done') ui.showDone = true;
		ancestors(it).forEach((a) => expanded.add(a.id));
		editing = null;
		saveUI();
		render();
		const row = document.getElementById('pm-row-' + id);
		if (!row) return;
		row.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
		row.classList.add('pm-flash');
		setTimeout(() => row.classList.remove('pm-flash'), 1400);
	}

	// From the timeline: open a task in the list view with its edit form.
	function openTask(id) {
		if (!data.items[id]) return;
		ui.view = 'list';
		jumpTo(id);
		editing = id;
		render();
		const row = document.getElementById('pm-row-' + id);
		if (row) row.scrollIntoView({ block: 'center' });
		focusSoon('#pm-f-title-' + id);
	}

	root.addEventListener('click', async (e) => {
		const t = e.target.closest('button');
		if (!t) return;
		const d = t.dataset;

		if (d.track) { ui.track = d.track; editing = null; renaming = null; saveUI(); render(); return; }
		if (d.view) { ui.view = d.view; editing = null; renaming = null; saveUI(); render(); return; }
		if ('showOverdue' in d) { ui.fStatus = 'overdue'; editing = null; saveUI(); render(); return; }
		if (d.open) { openTask(d.open); return; }
		if (d.toggle) { expanded.has(d.toggle) ? expanded.delete(d.toggle) : expanded.add(d.toggle); saveUI(); render(); return; }
		if (d.jump) { jumpTo(d.jump); return; }
		if (d.edit) { editing = editing === d.edit ? null : d.edit; renaming = null; render(); if (editing) focusSoon('#pm-f-title-' + editing); return; }
		if (d.add) { const [tr, gid] = d.add.split(':'); editing = `new:${tr}:${gid}`; renaming = null; render(); focusSoon('#pm-f-title-new'); return; }
		if (d.addkid) { editing = 'kid:' + d.addkid; expanded.add(d.addkid); render(); focusSoon('#pm-f-title-new'); return; }
		if (t.id === 'pm-newGroup') { editing = 'newgroup'; render(); focusSoon('#pm-newGroupName'); return; }
		if (t.id === 'pm-clear') { Object.assign(ui, { q: '', fStatus: '', fPerson: '', fGroup: '' }); saveUI(); render(); return; }
		if ('cancel' in d) { editing = null; renaming = null; render(); return; }
		if (d.startrename) { renaming = d.startrename; editing = null; render(); focusSoon('#pm-renameInput'); return; }
		if ('addlink' in d) {
			const form = t.closest('form');
			const fid = form.dataset.form;
			const exclude = new Set(fid === 'new' ? [] : [fid, ...descendants(fid).map((x) => x.id)]);
			form.querySelector('.pm-links').insertAdjacentHTML('beforeend', linkRowHTML(null, exclude));
			return;
		}
		if ('rmlink' in d) { t.closest('.pm-linkrow').remove(); return; }
		if (d.delgroup) {
			await write(async () => check(await supabaseClient.from('tbl_pm_groups').delete().eq('id', d.delgroup)), 'Group removed.');
			render();
			return;
		}
		if (d.del) {
			const n = descendants(d.del).length;
			if (d.confirm !== '1') {
				d.confirm = '1';
				t.textContent = n ? `Delete with ${n} sub-task${n > 1 ? 's' : ''}?` : 'Tap again to delete';
				return;
			}
			const ok = await write(async () => check(await supabaseClient.from('tbl_pm_items').delete().eq('id', d.del)), 'Deleted.');
			if (ok) editing = null;
			render();
		}
	});

	root.addEventListener('change', async (e) => {
		const el = e.target;
		const filterKeys = { 'pm-fStatus': 'fStatus', 'pm-fPerson': 'fPerson', 'pm-fGroup': 'fGroup', 'pm-groupBy': 'groupBy', 'pm-zoom': 'zoom' };
		if (filterKeys[el.id]) { ui[filterKeys[el.id]] = el.value; editing = null; saveUI(); render(); return; }
		if (el.id === 'pm-showDone') { ui.showDone = el.checked; saveUI(); render(); return; }
		if (el.matches('select.pm-pill')) {
			el.dataset.s = el.value;
			await write(async () => check(await supabaseClient.from('tbl_pm_items').update({ status: el.value }).eq('id', el.dataset.id)));
			if (editing || renaming) pendingRender = true; else render();
			return;
		}
		if (el.name === 'group_id' || el.name === 'person_id') {
			const input = el.parentElement.querySelector('input');
			input.hidden = el.value !== '__new';
			if (!input.hidden) input.focus();
			return;
		}
		if (el.name === 'parent_id') el.closest('form').querySelector('.pm-groupfield').hidden = !!el.value;
	});

	let searchTimer;
	root.addEventListener('input', (e) => {
		if (e.target.id !== 'pm-q') return;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => { ui.q = e.target.value.trim(); saveUI(); render(); }, 250);
	});

	root.addEventListener('submit', async (e) => {
		e.preventDefault();
		const form = e.target;

		if ('newgroup' in form.dataset) {
			const name = form.querySelector('input').value.trim();
			if (!name) return;
			const ok = await write(() => addGroup(ui.track, name), 'Group added.');
			if (ok) { editing = null; render(); }
			return;
		}

		if ('rename' in form.dataset) {
			const name = form.querySelector('input').value.trim();
			if (!name) return;
			const table = form.dataset.rename === 'group' ? 'tbl_pm_groups' : 'tbl_pm_people';
			const ok = await write(async () => check(await supabaseClient.from(table).update({ name }).eq('id', form.dataset.id)), 'Renamed.');
			if (ok) { renaming = null; render(); }
			return;
		}

		// On a problem the form stays open with what was typed, and the message explains what to fix.
		const ok = await saveForm(form);
		if (ok) { editing = null; saveUI(); render(); }
	});

	// Catch up with changes made on another device when you come back to this tab (at most every 5 seconds).
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && venueId && !drag && Date.now() - lastLoad > 5000) refresh();
	});

	// ─── Start ───
	(async () => {
		if (!root || !statusEl) {
			TDC.error(AREA, 'board page is missing expected elements.');
			return;
		}
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		const { data: roles, error } = await supabaseClient
			.from('tbl_venue_staff')
			.select('venue_id, role')
			.eq('user_id', session.user.id)
			.eq('role', 'owner');
		if (error) {
			TDC.error(AREA, 'could not check your role.', error, statusEl);
			return;
		}
		if (!roles || roles.length === 0) {
			root.textContent = '';
			TDC.status(statusEl, 'The Project Board is for venue owners only.', 'error');
			return;
		}
		if (roles.length > 1) console.warn(`[${AREA}] owner at ${roles.length} venues; showing the first. A venue picker isn't built yet.`);
		venueId = roles[0].venue_id;

		if (!(await loadAll())) return;
		renderShell();
		render();
	})();
})();
