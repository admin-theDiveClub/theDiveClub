// The title ladder (/staff/titles/), for an owner of The Dive Club.
//
// A matrix: steps down the side, groups across the top, titles in the cells.
// A title's step is the one it unlocks at, so "40+" holds what a player may
// choose from step 40 up. Every change saves at once and the page reads the list
// again (docs/design/points-and-tiers.md §6a, docs/systems/points.md).
//
// Needs: supabaseClient.js, tdc.js.

TDCLoader.hold((async () => {
	const AREA = 'Titles';
	const el = (id) => document.getElementById(id);
	const els = {
		count: el('titles-count'), status: el('status-msg'), area: el('titles-area'), wrap: el('titles-wrap'),
		addTitle: el('add-title'), addGroup: el('add-group'), showAll: el('show-all'),
		titleDialog: el('title-dialog'), titleForm: el('title-form'), titleHeading: el('title-heading'),
		titleName: el('title-name'), titleGroup: el('title-group'), titleStep: el('title-step'), titleNote: el('title-note'),
		titleStatus: el('title-status'), titleSave: el('title-save'), titleCancel: el('title-cancel'), titleDelete: el('title-delete'),
		groupDialog: el('group-dialog'), groupForm: el('group-form'), groupHeading: el('group-heading'), groupName: el('group-name'),
		groupStatus: el('group-status'), groupSave: el('group-save'), groupCancel: el('group-cancel'), groupDelete: el('group-delete')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'titles page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;

	const LAST_STEP = 100;
	let ladder = { groups: [], titles: [] };
	let editingTitle = null;
	let editingGroup = null;

	const node = (tag, className, text) => {
		const n = document.createElement(tag);
		if (className) n.className = className;
		if (text !== undefined) n.textContent = text;
		return n;
	};
	const stepLabel = (step) => (step === LAST_STEP ? String(step) : step + '+');

	// ─── The matrix ───

	function titleButton(title) {
		const b = node('button', 'titles-title');
		b.type = 'button';
		b.dataset.title = title.id;
		b.dataset.noDots = '';
		b.append(node('span', 'titles-name', title.name));
		if (title.note) b.append(node('span', 'titles-note', title.note));
		return b;
	}

	function draw() {
		const { groups, titles } = ladder;
		const inCell = new Map();
		for (const t of titles) {
			const key = t.step + '|' + t.group_id;
			if (!inCell.has(key)) inCell.set(key, []);
			inCell.get(key).push(t);
		}
		const filled = new Set(titles.map((t) => t.step));
		const steps = [];
		for (let s = 1; s <= LAST_STEP; s++) {
			if (els.showAll.checked || filled.has(s)) steps.push(s);
		}

		const table = node('table', 'titles-table');
		const head = node('thead');
		const headRow = node('tr');
		headRow.append(node('th', 'titles-step', 'Step'));
		for (const g of groups) {
			const th = node('th');
			const b = node('button', 'titles-group', g.name);
			b.type = 'button';
			b.dataset.group = g.id;
			b.dataset.noDots = '';
			th.append(b);
			headRow.append(th);
		}
		head.append(headRow);

		const body = node('tbody');
		for (const s of steps) {
			const tr = node('tr');
			tr.append(node('th', 'titles-step', stepLabel(s)));
			for (const g of groups) {
				const td = node('td');
				td.dataset.step = s;
				td.dataset.groupId = g.id;
				for (const t of inCell.get(s + '|' + g.id) || []) td.append(titleButton(t));
				tr.append(td);
			}
			body.append(tr);
		}
		table.append(head, body);

		// A redraw after a save keeps your place in the matrix.
		const { scrollLeft, scrollTop } = els.wrap;
		els.wrap.replaceChildren(table);
		els.wrap.scrollLeft = scrollLeft;
		els.wrap.scrollTop = scrollTop;

		const n = titles.length;
		els.count.textContent = `${n} ${n === 1 ? 'title' : 'titles'} in ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}. Tap a title or a group to change it, or an empty cell to add one there.`;
	}

	async function load() {
		const { data, error } = await supabaseClient.rpc('tdc_title_ladder');
		if (error) {
			els.area.hidden = true;
			els.count.textContent = '';
			TDC.showSupabaseError(AREA, error, els.status);
			return false;
		}
		ladder = data;
		els.area.hidden = false;
		draw();
		return true;
	}

	// ─── A title ───

	const titleWriter = TDC.writer({ area: AREA, status: els.titleStatus, reload: load });

	function openTitle(title, preset) {
		editingTitle = title;
		TDC.status(els.titleStatus, '', '');
		els.titleHeading.textContent = title ? 'Change a title' : 'Add a title';
		els.titleDelete.hidden = !title;
		els.titleGroup.replaceChildren(...ladder.groups.map((g) => {
			const opt = node('option', '', g.name);
			opt.value = g.id;
			return opt;
		}));
		els.titleName.value = title ? title.name : '';
		els.titleNote.value = title && title.note ? title.note : '';
		els.titleStep.value = title ? title.step : (preset && preset.step) || '';
		const groupId = title ? title.group_id : preset && preset.groupId;
		if (groupId) els.titleGroup.value = groupId;
		els.titleDialog.showModal();
		els.titleName.focus();
	}

	els.titleForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const saved = await titleWriter.write('Saving the title', () => supabaseClient.rpc('tdc_save_title', {
			p_id: editingTitle ? editingTitle.id : null,
			p_group_id: els.titleGroup.value,
			p_name: els.titleName.value,
			p_step: els.titleStep.value === '' ? null : Number(els.titleStep.value),
			p_note: els.titleNote.value
		}), null, { single: 'save', dots: els.titleSave, leaves: true });
		if (saved) els.titleDialog.close();
	});

	els.titleDelete.addEventListener('click', async () => {
		if (!editingTitle) return;
		if (!confirm(`Delete the title ${editingTitle.name}?`)) return;
		const id = editingTitle.id;
		const saved = await titleWriter.write('Deleting the title', () => supabaseClient.rpc('tdc_delete_title', { p_id: id }),
			null, { single: 'delete', dots: els.titleDelete, leaves: true });
		if (saved) els.titleDialog.close();
	});

	// ─── A group ───

	const groupWriter = TDC.writer({ area: AREA, status: els.groupStatus, reload: load });

	function openGroup(group) {
		editingGroup = group;
		TDC.status(els.groupStatus, '', '');
		els.groupHeading.textContent = group ? 'Change a group' : 'Add a group';
		els.groupDelete.hidden = !group;
		els.groupName.value = group ? group.name : '';
		els.groupDialog.showModal();
		els.groupName.focus();
	}

	els.groupForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const saved = await groupWriter.write('Saving the group', () => supabaseClient.rpc('tdc_save_title_group', {
			p_id: editingGroup ? editingGroup.id : null,
			p_name: els.groupName.value
		}), null, { single: 'save', dots: els.groupSave, leaves: true });
		if (saved) els.groupDialog.close();
	});

	els.groupDelete.addEventListener('click', async () => {
		if (!editingGroup) return;
		const n = ladder.titles.filter((t) => t.group_id === editingGroup.id).length;
		const also = n ? `\n\nIts ${n === 1 ? 'title goes' : n + ' titles go'} with it.` : '';
		if (!confirm(`Delete the group ${editingGroup.name}?${also}`)) return;
		const id = editingGroup.id;
		const saved = await groupWriter.write('Deleting the group', () => supabaseClient.rpc('tdc_delete_title_group', { p_id: id }),
			null, { single: 'delete', dots: els.groupDelete, leaves: true });
		if (saved) els.groupDialog.close();
	});

	// ─── Opening them ───

	els.addTitle.addEventListener('click', () => {
		if (!ladder.groups.length) {
			TDC.status(els.status, 'Add a group first: every title belongs to one.', 'error');
			return;
		}
		openTitle(null);
	});
	els.addGroup.addEventListener('click', () => openGroup(null));
	els.titleCancel.addEventListener('click', () => els.titleDialog.close());
	els.groupCancel.addEventListener('click', () => els.groupDialog.close());
	els.showAll.addEventListener('change', draw);

	els.wrap.addEventListener('click', (e) => {
		const titleBtn = e.target.closest('[data-title]');
		if (titleBtn) {
			const title = ladder.titles.find((t) => t.id === titleBtn.dataset.title);
			if (title) openTitle(title);
			else TDC.error(AREA, 'that title is not on the page any more.', titleBtn.dataset.title, els.status);
			return;
		}
		const groupBtn = e.target.closest('[data-group]');
		if (groupBtn) {
			const group = ladder.groups.find((g) => g.id === groupBtn.dataset.group);
			if (group) openGroup(group);
			else TDC.error(AREA, 'that group is not on the page any more.', groupBtn.dataset.group, els.status);
			return;
		}
		const cell = e.target.closest('td');
		if (cell) openTitle(null, { step: Number(cell.dataset.step), groupId: cell.dataset.groupId });
	});

	await load();
})(), 'Titles');
