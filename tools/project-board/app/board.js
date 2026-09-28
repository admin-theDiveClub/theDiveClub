// Project Board (/staff/board/): the owner's task list for the business and the website.
// Needs: supabaseClient.js, tdc.js (loaded by layout.html). Styles: board.css in this folder.
// Data: tbl_pm_groups, tbl_pm_people, tbl_pm_items, tbl_pm_links (migration 20260928103000_project_board).
// Only venue owners can read or change these tables; the database enforces it.
//
// How it works: loadAll() reads the whole board for the venue into `data`, render() draws it from `data` and `ui`.
// Every change is written to Supabase, then the board is reloaded. It also reloads when you come back to the tab.
//
// Sections: constants · state · model helpers · rendering · writes · events · start.

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

	// ─── State ───
	const root = document.getElementById('pm-board');
	const statusEl = document.getElementById('pm-status');
	let venueId = null;
	let data = { items: {}, groups: [], people: [], links: [] };
	let ui = { track: 'business', q: '', fStatus: '', fPerson: '', fGroup: '', groupBy: 'group', showDone: false, expanded: [] };
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
	const treeMode = () => ui.groupBy === 'group' && !filtering();
	const hasOpenDescendant = (id) => descendants(id).some((d) => d.status !== 'done');
	const visibleInTree = (it) => ui.showDone || it.status !== 'done' || hasOpenDescendant(it.id) || editing === it.id;
	const linksFrom = (id) => data.links.filter((l) => l.from_id === id);
	const linksTo = (id) => data.links.filter((l) => l.to_id === id);

	// ─── Rendering ───
	function renderShell() {
		root.innerHTML = `
			<header class="pm-head">
				<div>
					<h1>Project Board</h1>
					<p class="muted">The running list for the business and the website.</p>
				</div>
				<div class="pm-counts" id="pm-counts"></div>
			</header>
			<div class="pm-tabs" role="tablist">
				${[['business', 'Business'], ['website', 'Website'], ['all', 'All']].map(([t, l]) => `<button type="button" class="pm-tab" role="tab" data-track="${t}">${l}</button>`).join('')}
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
		const q = $('#pm-q');
		if (document.activeElement !== q) q.value = ui.q;

		$('#pm-fStatus').innerHTML = '<option value="">Any status</option>' + STATUSES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
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
		$('#pm-counts').innerHTML = STATUSES.map(([s, l]) => `<span class="pm-count"><b>${mine.filter((i) => i.status === s).length}</b>${l}</span>`).join('');
		$('#pm-newGroup').hidden = !treeMode() || ui.track === 'all' || editing === 'newgroup';
	}

	function render() {
		pendingRender = false;
		renderControls();
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
				out.push(`<section class="pm-group">${headHTML('group', g.id, g.name, label, roots.length)}<div class="pm-list">${body}</div></section>`);
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
	function renderFlat() {
		const q = ui.q.toLowerCase();
		const list = allItems().filter((i) => tracksShown().includes(i.track)).filter((i) => {
			if (ui.fStatus && i.status !== ui.fStatus) return false;
			if (!ui.fStatus && !ui.showDone && i.status === 'done') return false;
			if (ui.fPerson === '__none' && i.person_id) return false;
			if (ui.fPerson && ui.fPerson !== '__none' && i.person_id !== ui.fPerson) return false;
			if (ui.fGroup && groupNameOf(i) !== ui.fGroup) return false;
			if (q && !(i.title + ' ' + i.note).toLowerCase().includes(q)) return false;
			return true;
		}).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.sort_order - b.sort_order);

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

		const out = [];
		for (const [k, arr] of buckets) {
			if (!arr.length) continue;
			let head;
			if (ui.groupBy === 'person' && k) {
				head = headHTML('person', k, personById(k).name, personById(k).name, arr.length);
			} else {
				const label = ui.groupBy === 'status' ? STATUS_LABEL[k] : ui.groupBy === 'person' ? 'No one assigned' : ui.groupBy === 'none' ? 'Matching tasks' : k;
				head = headHTML(null, null, null, label, arr.length);
			}
			out.push(`<section class="pm-group">${head}<div class="pm-list">${arr.map((i) => nodeHTML(i, 0, true)).join('')}</div></section>`);
		}
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

		let h = `<div class="pm-node"><div class="pm-row${i.status === 'done' ? ' pm-done' : ''}" id="pm-row-${i.id}" style="--depth:${depth}">` +
			(ks.length ? `<button type="button" class="pm-chev" data-toggle="${i.id}" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} sub-tasks">▶</button>` : '<span class="pm-chev pm-none"></span>') +
			statusSelect(i) +
			'<div class="pm-main">' +
				(crumbs.length ? `<span class="pm-crumb">${crumbs.join(' › ')} ›</span>` : '') +
				`<button type="button" class="pm-title" data-edit="${i.id}" aria-expanded="${editing === i.id}">${esc(i.title)}</button>` +
				(all.length ? `<span class="pm-chip" title="Sub-tasks done">${doneCount}/${all.length}</span>` : '') +
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
			<fieldset><legend>Links to other tasks</legend>
				<div class="pm-links">${links.map((l) => linkRowHTML(l, exclude)).join('')}</div>
				<div><button type="button" class="pm-link" data-addlink>+ Add link</button></div>
			</fieldset>
			<div class="pm-actions">
				${isNew ? '' : `<button type="button" class="pm-btn pm-danger" data-del="${fid}">Delete</button>`}
				<button type="button" class="pm-btn" data-cancel>Cancel</button>
				<button type="submit" class="pm-btn pm-primary">${isNew ? 'Add task' : 'Save'}</button>
			</div>
		</form>`;
	}

	// ─── Writes ───
	async function loadAll() {
		const q = (table, cols) => supabaseClient.from(table).select(cols).eq('venue_id', venueId);
		const results = await Promise.all([
			q('tbl_pm_items', 'id, track, group_id, parent_id, person_id, title, note, status, sort_order'),
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
		const links = [...form.querySelectorAll('.pm-linkrow')]
			.map((r) => ({ link_type: r.querySelector('.pm-ltype').value, to_id: r.querySelector('.pm-ltarget').value }))
			.filter((l) => l.to_id)
			.filter((l, ix, arr) => arr.findIndex((x) => x.to_id === l.to_id && x.link_type === l.link_type) === ix);

		return write(async () => {
			let groupId = null;
			if (!parentId) groupId = wantGroup === '__new' ? await addGroup(track, val('new_group')) : wantGroup;
			if (!parentId && !groupId) throw new Error('TDC (Error): no group chosen for a top-level task.');
			const personId = wantPerson === '__new' ? await addPerson(val('new_person')) : (wantPerson || null);
			const body = { title, note: val('note'), parent_id: parentId, group_id: groupId, person_id: personId };

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

	root.addEventListener('click', async (e) => {
		const t = e.target.closest('button');
		if (!t) return;
		const d = t.dataset;

		if (d.track) { ui.track = d.track; editing = null; renaming = null; saveUI(); render(); return; }
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
		const filterKeys = { 'pm-fStatus': 'fStatus', 'pm-fPerson': 'fPerson', 'pm-fGroup': 'fGroup', 'pm-groupBy': 'groupBy' };
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
			if (ok) editing = null;
			render();
			return;
		}

		if ('rename' in form.dataset) {
			const name = form.querySelector('input').value.trim();
			if (!name) return;
			const table = form.dataset.rename === 'group' ? 'tbl_pm_groups' : 'tbl_pm_people';
			const ok = await write(async () => check(await supabaseClient.from(table).update({ name }).eq('id', form.dataset.id)), 'Renamed.');
			if (ok) renaming = null;
			render();
			return;
		}

		const ok = await saveForm(form);
		if (ok) editing = null;
		saveUI();
		render();
	});

	// Catch up with changes made on another device when you come back to this tab (at most every 5 seconds).
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && venueId && Date.now() - lastLoad > 5000) refresh();
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
